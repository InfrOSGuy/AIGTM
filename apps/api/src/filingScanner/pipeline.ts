import type { CompanyEnricher } from "../integrations/apollo.js";
import type { NotificationSender } from "../integrations/knock.js";
import type { SyftClient } from "../integrations/syft.js";
import { prisma } from "../lib/prisma.js";
import { type EdgarSearchHit, fetchFilingDocument, searchEdgarFilings } from "./edgarClient.js";
import type { ExtractedSignal, SignalClassifier } from "./extract.js";
import { chunkFilingText, stripHtml } from "./parser.js";
import { scoreSignal } from "./score.js";
import { SIGNAL_TAXONOMY } from "./taxonomy.js";

// LinkedIn post ingestion (Syft's second capability, per PRD §7 step 1)
// is intentionally not wired into this pipeline yet: integrations/syft.ts
// has no verified real implementation to call, and FilingSignal/Filing
// are shaped around SEC filing identifiers (cik, accessionNumber) that
// don't fit a LinkedIn post. Wire it once syft.ts has a real client —
// likely as its own small ingest function reusing the same
// classifier/score/notify steps below, writing into a new signal-source
// table rather than forcing it into Filing.

export interface FilingScanParams {
  forms: string[];
  /** Inclusive, YYYY-MM-DD. */
  startDate: string;
  /** Inclusive, YYYY-MM-DD. */
  endDate: string;
  userAgent: string;
  /** Caps EDGAR results per taxonomy search phrase, to bound scan cost. */
  maxFilingsPerPhrase?: number;
  /** Score at/above which a qualified-hit notification fires. */
  notifyThreshold?: number;
}

export interface FilingScanDeps {
  classifier: SignalClassifier;
  enricher: CompanyEnricher;
  syft: SyftClient;
  notifier: NotificationSender;
}

export interface FilingScanSummary {
  filingsScanned: number;
  filingsAlreadySeen: number;
  signalsFound: number;
  qualifiedHits: number;
}

const DEFAULT_MAX_FILINGS_PER_PHRASE = 10;
const DEFAULT_NOTIFY_THRESHOLD = 70;

async function collectCandidateFilings(
  params: FilingScanParams,
): Promise<{ hits: EdgarSearchHit[]; alreadySeen: number }> {
  const seenAccessionNumbers = new Set<string>();
  const hits: EdgarSearchHit[] = [];
  let alreadySeen = 0;

  for (const entry of SIGNAL_TAXONOMY) {
    for (const phrase of entry.searchPhrases) {
      const results = await searchEdgarFilings({
        query: phrase,
        forms: params.forms,
        startDate: params.startDate,
        endDate: params.endDate,
        userAgent: params.userAgent,
      });

      for (const hit of results.slice(0, params.maxFilingsPerPhrase ?? DEFAULT_MAX_FILINGS_PER_PHRASE)) {
        if (seenAccessionNumbers.has(hit.accessionNumber)) continue;
        seenAccessionNumbers.add(hit.accessionNumber);

        const alreadyScanned = await prisma.filing.findUnique({
          where: { accessionNumber: hit.accessionNumber },
        });
        if (alreadyScanned) {
          alreadySeen += 1;
          continue;
        }
        hits.push(hit);
      }
    }
  }

  return { hits, alreadySeen };
}

/**
 * Resolves the filer to a Company via Apollo (best-effort — enrichment
 * failure never blocks the scan) and, when that succeeds, checks Syft
 * for a corroborating recent website visit.
 */
async function resolveCompany(
  hit: EdgarSearchHit,
  deps: FilingScanDeps,
): Promise<{ companyId: string | null; employeeCount?: number; recentSiteVisit: boolean }> {
  let enrichment;
  try {
    enrichment = await deps.enricher.enrichByName(hit.companyName);
  } catch {
    enrichment = null;
  }

  if (!enrichment) {
    return { companyId: null, recentSiteVisit: false };
  }

  const company = await prisma.company.upsert({
    where: { domain: enrichment.domain },
    create: {
      domain: enrichment.domain,
      name: enrichment.name,
      industry: enrichment.industry,
      employeeCount: enrichment.employeeCount,
    },
    update: {
      industry: enrichment.industry,
      employeeCount: enrichment.employeeCount,
    },
  });

  let recentSiteVisit = false;
  try {
    recentSiteVisit = (await deps.syft.matchWebsiteVisitor(enrichment.domain)) !== null;
  } catch {
    recentSiteVisit = false;
  }

  return { companyId: company.id, employeeCount: enrichment.employeeCount, recentSiteVisit };
}

export async function runFilingScan(
  params: FilingScanParams,
  deps: FilingScanDeps,
): Promise<FilingScanSummary> {
  const { hits, alreadySeen } = await collectCandidateFilings(params);
  const notifyThreshold = params.notifyThreshold ?? DEFAULT_NOTIFY_THRESHOLD;

  let signalsFound = 0;
  let qualifiedHits = 0;

  for (const hit of hits) {
    const { companyId, employeeCount, recentSiteVisit } = await resolveCompany(hit, deps);

    const filing = await prisma.filing.create({
      data: {
        cik: hit.cik,
        companyName: hit.companyName,
        form: hit.form,
        accessionNumber: hit.accessionNumber,
        filedAt: hit.filedAt,
        sourceUrl: hit.sourceUrl,
        companyId,
      },
    });

    let rawDocument: string;
    try {
      rawDocument = await fetchFilingDocument(hit.sourceUrl, params.userAgent);
    } catch {
      continue; // Filing row is kept even if we couldn't fetch/extract its text
    }

    const chunks = chunkFilingText(stripHtml(rawDocument));

    for (const chunk of chunks) {
      let extracted: ExtractedSignal[];
      try {
        extracted = await deps.classifier(chunk);
      } catch {
        continue; // one bad chunk shouldn't abort the whole scan
      }

      for (const signal of extracted) {
        const score = scoreSignal({
          strength: signal.strength,
          confidence: signal.confidence,
          employeeCount,
          recentSiteVisit,
        });

        await prisma.filingSignal.create({
          data: {
            filingId: filing.id,
            signalType: signal.signalType,
            strength: signal.strength,
            quote: signal.quote,
            confidence: signal.confidence,
            extractedSystem: signal.extractedSystem,
            extractedVendor: signal.extractedVendor,
            extractedBudget: signal.extractedBudget,
            extractedTimeline: signal.extractedTimeline,
            score,
          },
        });
        signalsFound += 1;

        if (score >= notifyThreshold) {
          qualifiedHits += 1;
          try {
            await deps.notifier.sendQualifiedHit({
              companyName: hit.companyName,
              signalType: signal.signalType,
              score,
              quote: signal.quote,
              sourceUrl: hit.sourceUrl,
            });
          } catch {
            // a failed alert shouldn't roll back the persisted signal
          }
        }
      }
    }
  }

  return {
    filingsScanned: hits.length,
    filingsAlreadySeen: alreadySeen,
    signalsFound,
    qualifiedHits,
  };
}

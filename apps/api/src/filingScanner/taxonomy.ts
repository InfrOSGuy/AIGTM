import type { SignalType } from "@prisma/client";

/**
 * The signal taxonomy from docs/PRD-IT-INFRA-SCANNER.md §6. Each entry
 * drives two things: the phrase used to query SEC EDGAR's full-text
 * search (see edgarClient.ts), and the category description handed to
 * the LLM classifier (see extract.ts) so both stay in sync with the
 * PRD instead of drifting apart.
 */
export interface TaxonomyEntry {
  signalType: SignalType;
  label: string;
  description: string;
  /** Representative phrases used to build EDGAR full-text-search queries. */
  searchPhrases: string[];
}

export const SIGNAL_TAXONOMY: TaxonomyEntry[] = [
  {
    signalType: "capex_new_infrastructure",
    label: "New infrastructure capex",
    description:
      "The company is committing capex/opex to new infrastructure: data center builds or exits, " +
      "cloud migration (e.g. moving to AWS/Azure/GCP, cloud-first strategy), or colocation changes.",
    searchPhrases: [
      "cloud migration",
      "data center consolidation",
      "colocation facility",
      "cloud-first strategy",
    ],
  },
  {
    signalType: "platform_replatforming",
    label: "Platform replatforming",
    description:
      "The company is replacing a core platform: ERP replacement (SAP, Oracle, Workday), core " +
      "banking/claims/PMS system overhauls, or legacy system modernization.",
    searchPhrases: ["ERP implementation", "core system modernization", "legacy system replacement"],
  },
  {
    signalType: "new_it_leadership",
    label: "New IT leadership with an infra mandate",
    description:
      "A newly appointed CIO/CTO/VP Infrastructure with a stated infrastructure mandate, or a " +
      "newly disclosed IT organizational restructuring.",
    searchPhrases: ["appointed Chief Information Officer", "Chief Technology Officer appointment"],
  },
  {
    signalType: "security_compliance_investment",
    label: "Security/compliance-driven infra investment",
    description:
      "Post-breach remediation, new SOC2/FedRAMP/PCI infrastructure buildout, or zero-trust " +
      "network initiatives.",
    searchPhrases: ["zero trust architecture", "SOC 2 compliance infrastructure", "security remediation"],
  },
  {
    signalType: "ma_it_integration",
    label: "M&A/divestiture-driven IT integration",
    description:
      "Integrating an acquired company's systems, or standing up standalone IT infrastructure " +
      "post-spinoff/carve-out.",
    searchPhrases: ["integrating acquired company systems", "standalone IT infrastructure"],
  },
  {
    signalType: "explicit_budget_or_rfp",
    label: "Explicit budget, timeline, or vendor RFP",
    description:
      "An explicit forward-looking statement naming a budget, timeline, or vendor RFP for any of " +
      "the above categories.",
    searchPhrases: ["request for proposal information technology", "technology infrastructure budget"],
  },
];

/**
 * Boilerplate phrases like "digital transformation" with no named
 * system, vendor, or budget don't get their own SignalType — they're
 * the "weak" strength case within whichever category the LLM
 * classifier still assigns (see extract.ts).
 */
export const WEAK_SIGNAL_HINT =
  "If the passage only uses generic boilerplate (e.g. \"digital transformation\", " +
  "\"technology investment\") with no concrete action, named system, vendor, budget, or " +
  "timeline, classify it as weak rather than strong.";

export function findTaxonomyEntry(signalType: SignalType): TaxonomyEntry {
  const entry = SIGNAL_TAXONOMY.find((e) => e.signalType === signalType);
  if (!entry) {
    throw new Error(`no taxonomy entry for signal type ${signalType}`);
  }
  return entry;
}

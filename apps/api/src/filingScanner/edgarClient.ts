/**
 * Thin client for SEC EDGAR's public full-text search API and filing
 * archive. No API key required, but SEC's fair-access policy requires
 * a descriptive User-Agent identifying the requester (name + contact) —
 * see https://www.sec.gov/os/webmaster-faq#developers. Requests
 * without one get rate-limited or blocked, so this fails loudly rather
 * than silently sending an anonymous request.
 */

const EDGAR_FULL_TEXT_SEARCH_URL = "https://efts.sec.gov/LATEST/search-index";
const EDGAR_ARCHIVES_BASE_URL = "https://www.sec.gov/Archives/edgar/data";

export interface EdgarSearchHit {
  cik: string;
  companyName: string;
  form: string;
  filedAt: Date;
  accessionNumber: string;
  sourceUrl: string;
}

interface EdgarSearchResponseHit {
  _id: string;
  _source: {
    cik: string;
    display_names: string[];
    form: string;
    file_date: string;
    adsh: string;
  };
}

interface EdgarSearchResponse {
  hits: {
    hits: EdgarSearchResponseHit[];
  };
}

export interface EdgarSearchParams {
  query: string;
  forms: string[];
  /** Inclusive, YYYY-MM-DD. */
  startDate: string;
  /** Inclusive, YYYY-MM-DD. */
  endDate: string;
  userAgent: string;
}

function userAgentHeaders(userAgent: string): Record<string, string> {
  if (!userAgent.trim()) {
    throw new Error(
      "SEC_EDGAR_USER_AGENT is required to call EDGAR (must identify a real requester per SEC's " +
        "fair-access policy, e.g. \"InfrOS filing-scanner contact@infros.io\")",
    );
  }
  return { "User-Agent": userAgent };
}

/** Builds the filing document URL from an EDGAR hit's `_id` (`{accession-no-dashes}/{filename}`). */
function buildSourceUrl(cik: string, hitId: string): string {
  const [accessionNoDashes, fileName] = hitId.split(":");
  return `${EDGAR_ARCHIVES_BASE_URL}/${cik}/${accessionNoDashes}/${fileName}`;
}

function toDashedAccessionNumber(adsh: string): string {
  // EDGAR's own accession number format is already dashed
  // (0000320193-24-000123); `adsh` in search results matches that.
  return adsh;
}

/**
 * Searches EDGAR full-text search for a phrase within a set of forms
 * and date range. One call per taxonomy phrase (see taxonomy.ts) — the
 * pipeline dedupes hits across phrases by accessionNumber.
 */
export async function searchEdgarFilings(params: EdgarSearchParams): Promise<EdgarSearchHit[]> {
  const url = new URL(EDGAR_FULL_TEXT_SEARCH_URL);
  url.searchParams.set("q", `"${params.query}"`);
  url.searchParams.set("forms", params.forms.join(","));
  url.searchParams.set("dateRange", "custom");
  url.searchParams.set("startdt", params.startDate);
  url.searchParams.set("enddt", params.endDate);

  const res = await fetch(url, { headers: userAgentHeaders(params.userAgent) });
  if (!res.ok) {
    throw new Error(`EDGAR full-text search failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as EdgarSearchResponse;
  return body.hits.hits.map((hit) => ({
    cik: hit._source.cik,
    companyName: hit._source.display_names[0] ?? "unknown",
    form: hit._source.form,
    filedAt: new Date(hit._source.file_date),
    accessionNumber: toDashedAccessionNumber(hit._source.adsh),
    sourceUrl: buildSourceUrl(hit._source.cik, hit._id),
  }));
}

/** Fetches the raw filing document (HTML or plain text) for parsing. */
export async function fetchFilingDocument(sourceUrl: string, userAgent: string): Promise<string> {
  const res = await fetch(sourceUrl, { headers: userAgentHeaders(userAgent) });
  if (!res.ok) {
    throw new Error(`failed to fetch filing document ${sourceUrl}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

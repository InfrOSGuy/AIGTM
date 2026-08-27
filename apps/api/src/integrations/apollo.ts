/**
 * Apollo enrichment adapter (docs/PRD-IT-INFRA-SCANNER.md §5): resolves
 * a company name (from a filing or LinkedIn post) to a domain and
 * firmographic data, used both to attach a Filing to a Company record
 * and to feed the firmographic-fit component of scoring (score.ts).
 *
 * Wired to Apollo's organization-enrichment endpoint on a best-effort
 * basis — confirm the exact request/response shape against Apollo's
 * current API reference before depending on this in production; we
 * don't have a live key to verify against in this environment, and
 * Apollo has changed its base path/auth scheme before.
 */

export interface CompanyEnrichment {
  domain: string;
  name: string;
  industry?: string;
  employeeCount?: number;
}

export interface CompanyEnricher {
  enrichByName(companyName: string): Promise<CompanyEnrichment | null>;
}

const APOLLO_ENRICH_URL = "https://api.apollo.io/api/v1/organizations/enrich";

interface ApolloEnrichResponse {
  organization?: {
    primary_domain?: string;
    name?: string;
    industry?: string;
    estimated_num_employees?: number;
  };
}

export function createApolloEnricher(apiKey: string): CompanyEnricher {
  return {
    async enrichByName(companyName: string) {
      const url = new URL(APOLLO_ENRICH_URL);
      url.searchParams.set("name", companyName);

      const res = await fetch(url, {
        headers: { "x-api-key": apiKey, accept: "application/json" },
      });

      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`Apollo enrichment request failed: ${res.status} ${res.statusText}`);
      }

      const body = (await res.json()) as ApolloEnrichResponse;
      const org = body.organization;
      if (!org?.primary_domain) return null;

      return {
        domain: org.primary_domain,
        name: org.name ?? companyName,
        industry: org.industry,
        employeeCount: org.estimated_num_employees,
      };
    },
  };
}

/** Used when APOLLO_API_KEY isn't configured — the pipeline still runs, just without company resolution/firmographic fit. */
export function createNullEnricher(): CompanyEnricher {
  return {
    async enrichByName() {
      return null;
    },
  };
}

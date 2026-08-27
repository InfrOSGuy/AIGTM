/**
 * Syft (syftdata.com) adapter (docs/PRD-IT-INFRA-SCANNER.md §5): two
 * distinct capabilities, neither related to filings —
 *   1. website visitor de-anonymization: has a filing/LinkedIn-flagged
 *      company also visited infros.io recently? Used as a
 *      score-boosting corroborating signal in pipeline.ts.
 *   2. LinkedIn post monitoring: a secondary, faster-cadence signal
 *      source alongside SEC filings.
 *
 * Unlike apollo.ts/knock.ts, this repo has no verified reference for
 * Syft's actual API contract — guessing a request/response shape here
 * would look like a real integration while silently being wrong, which
 * is worse than not integrating at all. So `createSyftClient` throws
 * until someone confirms Syft's real API against their docs and fills
 * it in; `createNullSyftClient` is the safe default the pipeline uses
 * until then.
 */

export interface SiteVisitMatch {
  companyDomain: string;
  lastVisitedAt: Date;
}

export interface LinkedInPost {
  companyName: string;
  postText: string;
  postedAt: Date;
  authorTitle?: string;
}

export interface SyftClient {
  matchWebsiteVisitor(companyDomain: string): Promise<SiteVisitMatch | null>;
  fetchRecentLinkedInPosts(companyName: string, sinceDate: Date): Promise<LinkedInPost[]>;
}

/**
 * Not yet implemented — confirm Syft's actual API contract (auth
 * scheme, endpoints, response shape) against https://syftdata.com's
 * own docs before implementing this for real. Throws rather than
 * guessing, so a misconfigured SYFT_API_KEY fails loudly instead of
 * silently returning nothing (which `createNullSyftClient` already
 * does, on purpose, when Syft isn't configured at all).
 */
export function createSyftClient(_apiKey: string): SyftClient {
  const notImplemented = (): never => {
    throw new Error(
      "Syft integration is not yet implemented — confirm the real API contract at " +
        "syftdata.com's docs before wiring this in (see integrations/syft.ts)",
    );
  };
  return {
    matchWebsiteVisitor: notImplemented,
    fetchRecentLinkedInPosts: notImplemented,
  };
}

/** Used when SYFT_API_KEY isn't configured — the pipeline runs filing-only, with no site-visit boost. */
export function createNullSyftClient(): SyftClient {
  return {
    async matchWebsiteVisitor() {
      return null;
    },
    async fetchRecentLinkedInPosts() {
      return [];
    },
  };
}

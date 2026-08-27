/**
 * LinkedIn + LinkedIn Sales Navigator decision-maker verification
 * (docs/PRD-IT-INFRA-SCANNER.md §5). LinkedIn has no public, ToS-
 * compliant API for automated profile lookup or contact verification,
 * and the PRD is explicit that this step is research-only, not
 * automation. So this adapter is intentionally a manual-step marker,
 * not a scraper: the GTM user looks up the flagged company's
 * CIO/CTO/VP Infrastructure in Sales Navigator directly, and this seam
 * exists so that manual step has a clear place in the pipeline.
 */

export interface ContactVerification {
  name: string;
  title: string;
  linkedInUrl: string;
}

export interface ContactVerifier {
  verifyDecisionMaker(companyName: string): Promise<ContactVerification | null>;
}

export function createManualContactVerifier(): ContactVerifier {
  return {
    async verifyDecisionMaker() {
      return null;
    },
  };
}

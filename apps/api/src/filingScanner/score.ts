import type { SignalStrength } from "@prisma/client";

/**
 * Stand-in for the ICP rules engine described in the PRD (which reuses
 * "AIGTM's existing ICP rules engine" — that engine doesn't exist as
 * code yet, only the IcpDefinition/LeadScore Prisma models do). This
 * is a small, explicit rule set scoped to this pipeline; swap it for
 * a call into the real engine once that's built, without changing
 * anything upstream of it.
 */
export interface ScoreInput {
  strength: SignalStrength;
  confidence: number;
  /** Employee count, when the filer was resolved to a Company via Apollo. */
  employeeCount?: number;
  /**
   * Whether Syft's website de-anonymization matched this company as a
   * recent infros.io visitor — a corroborating "active interest"
   * signal per docs/PRD-IT-INFRA-SCANNER.md §7 step 5.
   */
  recentSiteVisit?: boolean;
}

const STRONG_BASE_SCORE = 60;
const WEAK_BASE_SCORE = 25;
const CONFIDENCE_WEIGHT = 30;
const FIRMOGRAPHIC_FIT_BONUS = 10;
const FIRMOGRAPHIC_FIT_MIN_EMPLOYEES = 200;
const FIRMOGRAPHIC_FIT_MAX_EMPLOYEES = 20_000;
const SITE_VISIT_BONUS = 15;

export function scoreSignal(input: ScoreInput): number {
  let score = input.strength === "strong" ? STRONG_BASE_SCORE : WEAK_BASE_SCORE;
  score += Math.round(input.confidence * CONFIDENCE_WEIGHT);

  if (
    input.employeeCount !== undefined &&
    input.employeeCount >= FIRMOGRAPHIC_FIT_MIN_EMPLOYEES &&
    input.employeeCount <= FIRMOGRAPHIC_FIT_MAX_EMPLOYEES
  ) {
    score += FIRMOGRAPHIC_FIT_BONUS;
  }

  if (input.recentSiteVisit) {
    score += SITE_VISIT_BONUS;
  }

  return Math.max(0, Math.min(100, score));
}

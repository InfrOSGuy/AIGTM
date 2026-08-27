import { describe, expect, it } from "vitest";
import { scoreSignal } from "../../src/filingScanner/score.js";

describe("scoreSignal", () => {
  it("scores a strong, high-confidence signal higher than a weak one", () => {
    const strong = scoreSignal({ strength: "strong", confidence: 0.9 });
    const weak = scoreSignal({ strength: "weak", confidence: 0.9 });
    expect(strong).toBeGreaterThan(weak);
  });

  it("gives a firmographic-fit bonus for an in-range employee count", () => {
    const withFit = scoreSignal({ strength: "strong", confidence: 0.5, employeeCount: 5000 });
    const withoutFit = scoreSignal({ strength: "strong", confidence: 0.5 });
    expect(withFit).toBeGreaterThan(withoutFit);
  });

  it("does not award the firmographic bonus outside the target range", () => {
    const tooSmall = scoreSignal({ strength: "strong", confidence: 0.5, employeeCount: 10 });
    const baseline = scoreSignal({ strength: "strong", confidence: 0.5 });
    expect(tooSmall).toBe(baseline);
  });

  it("adds a bonus for a corroborating recent site visit", () => {
    const withVisit = scoreSignal({ strength: "weak", confidence: 0.3, recentSiteVisit: true });
    const withoutVisit = scoreSignal({ strength: "weak", confidence: 0.3, recentSiteVisit: false });
    expect(withVisit).toBeGreaterThan(withoutVisit);
  });

  it("clamps the score to [0, 100]", () => {
    const maxed = scoreSignal({
      strength: "strong",
      confidence: 1,
      employeeCount: 5000,
      recentSiteVisit: true,
    });
    expect(maxed).toBeLessThanOrEqual(100);
    expect(maxed).toBeGreaterThanOrEqual(0);
  });
});

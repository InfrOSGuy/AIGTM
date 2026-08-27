import { describe, expect, it } from "vitest";
import { buildExtractionPrompt, createAnthropicClassifier, ExtractionParseError } from "../../src/filingScanner/extract.js";

describe("buildExtractionPrompt", () => {
  it("includes every taxonomy category and the chunk text", () => {
    const prompt = buildExtractionPrompt("We are migrating our data center to AWS.");
    expect(prompt).toContain("capex_new_infrastructure");
    expect(prompt).toContain("platform_replatforming");
    expect(prompt).toContain("new_it_leadership");
    expect(prompt).toContain("security_compliance_investment");
    expect(prompt).toContain("ma_it_integration");
    expect(prompt).toContain("explicit_budget_or_rfp");
    expect(prompt).toContain("We are migrating our data center to AWS.");
  });

  it("warns the model the input text is untrusted", () => {
    expect(buildExtractionPrompt("anything")).toMatch(/untrusted/i);
  });
});

describe("createAnthropicClassifier", () => {
  const chunk = { heading: "risk factors", text: "We plan to migrate to a new cloud data center." };

  function mockFetchOnce(responseBody: unknown, ok = true, status = 200) {
    return async () =>
      ({
        ok,
        status,
        statusText: ok ? "OK" : "Error",
        json: async () => responseBody,
      }) as Response;
  }

  it("parses a well-formed classifier response into ExtractedSignal[]", async () => {
    const signal = {
      signalType: "capex_new_infrastructure",
      strength: "strong",
      quote: "migrate to a new cloud data center",
      confidence: 0.8,
      extractedSystem: null,
      extractedVendor: "AWS",
      extractedBudget: null,
      extractedTimeline: null,
    };
    const originalFetch = global.fetch;
    global.fetch = mockFetchOnce({ content: [{ type: "text", text: JSON.stringify([signal]) }] });
    try {
      const classifier = createAnthropicClassifier("fake-api-key");
      const result = await classifier(chunk);
      expect(result).toEqual([
        { ...signal, extractedSystem: undefined, extractedBudget: undefined, extractedTimeline: undefined },
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("throws ExtractionParseError on malformed JSON", async () => {
    const originalFetch = global.fetch;
    global.fetch = mockFetchOnce({ content: [{ type: "text", text: "not json" }] });
    try {
      const classifier = createAnthropicClassifier("fake-api-key");
      await expect(classifier(chunk)).rejects.toBeInstanceOf(ExtractionParseError);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("throws when the Anthropic request itself fails", async () => {
    const originalFetch = global.fetch;
    global.fetch = mockFetchOnce({}, false, 500);
    try {
      const classifier = createAnthropicClassifier("fake-api-key");
      await expect(classifier(chunk)).rejects.toThrow(/failed: 500/);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

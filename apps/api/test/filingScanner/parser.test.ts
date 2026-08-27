import { describe, expect, it } from "vitest";
import { chunkFilingText, stripHtml } from "../../src/filingScanner/parser.js";

describe("stripHtml", () => {
  it("removes tags, scripts, and styles, keeping visible text", () => {
    const html = "<html><head><style>.x{color:red}</style></head><body><p>Hello <b>world</b></p>" +
      "<script>alert(1)</script></body></html>";
    expect(stripHtml(html)).toBe("Hello world");
  });

  it("decodes common HTML entities", () => {
    expect(stripHtml("Risk &amp; Reward &nbsp; A &lt;b&gt; B")).toBe("Risk & Reward A <b> B");
  });
});

describe("chunkFilingText", () => {
  it("discards text before the first recognized section heading", () => {
    const text = "Cover page boilerplate\nTicker: ACME\n\nItem 1. Business\nWe make widgets.";
    const chunks = chunkFilingText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.heading).toBe("item 1. business");
    expect(chunks[0]?.text).toContain("We make widgets.");
    expect(chunks[0]?.text).not.toContain("Ticker");
  });

  it("splits distinct sections into separate chunks", () => {
    const text = [
      "Item 1. Business",
      "We make widgets.",
      "Item 1A. Risk Factors",
      "Our supply chain is risky.",
    ].join("\n");

    const chunks = chunkFilingText(text);
    expect(chunks.map((c) => c.heading)).toEqual(["item 1. business", "item 1a. risk factors"]);
    expect(chunks[0]?.text).toContain("widgets");
    expect(chunks[1]?.text).toContain("supply chain");
  });

  it("splits an oversized section into multiple bounded chunks", () => {
    const body = "x".repeat(15_000);
    const text = `Risk Factors\n${body}`;
    const chunks = chunkFilingText(text, 6000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(6000);
    }
  });

  it("returns no chunks when no recognized heading is present", () => {
    expect(chunkFilingText("Just some random text with no headings.")).toEqual([]);
  });
});

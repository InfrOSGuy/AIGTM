/**
 * Deterministic, network-free parsing of a filing document into the
 * chunks worth sending to the LLM classifier. Per PRD §7: MD&A, Risk
 * Factors, and Business Overview are the highest-yield sections;
 * financial statement tables are skipped (they're dense XBRL-tagged
 * numbers, not narrative text a signal would live in).
 */

const HIGH_YIELD_SECTION_HEADINGS = [
  "management's discussion and analysis",
  "risk factors",
  "business overview",
  "item 1. business",
  "item 1a. risk factors",
  "item 7. management's discussion and analysis",
];

export interface FilingChunk {
  heading: string;
  text: string;
}

/** Strips tags/scripts/styles and collapses whitespace, keeping only visible text. */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits filing text into chunks anchored on the high-yield section
 * headings above, discarding everything before the first recognized
 * heading (typically cover-page boilerplate and financial statement
 * tables that precede the narrative sections in a 10-K/10-Q).
 */
export function chunkFilingText(plainText: string, maxChunkChars = 6000): FilingChunk[] {
  const lines = plainText.split("\n");
  const chunks: FilingChunk[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentHeading && currentLines.length > 0) {
      const text = currentLines.join("\n").trim();
      for (let offset = 0; offset < text.length; offset += maxChunkChars) {
        chunks.push({ heading: currentHeading, text: text.slice(offset, offset + maxChunkChars) });
      }
    }
    currentLines = [];
  };

  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    const matchedHeading = HIGH_YIELD_SECTION_HEADINGS.find((heading) => normalized.startsWith(heading));
    if (matchedHeading) {
      flush();
      currentHeading = matchedHeading;
      continue;
    }
    if (currentHeading) {
      currentLines.push(line);
    }
  }
  flush();

  return chunks;
}

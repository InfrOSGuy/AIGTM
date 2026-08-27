import { describe, expect, it } from "vitest";
import { fetchFilingDocument, searchEdgarFilings } from "../../src/filingScanner/edgarClient.js";

describe("searchEdgarFilings", () => {
  it("requires a non-empty User-Agent before calling EDGAR", async () => {
    await expect(
      searchEdgarFilings({
        query: "cloud migration",
        forms: ["10-K"],
        startDate: "2026-01-01",
        endDate: "2026-01-31",
        userAgent: "",
      }),
    ).rejects.toThrow(/SEC_EDGAR_USER_AGENT/);
  });

  it("builds the search URL and maps hits, sending the User-Agent header", async () => {
    const originalFetch = global.fetch;
    let capturedUrl: string | undefined;
    let capturedHeaders: HeadersInit | undefined;

    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = input.toString();
      capturedHeaders = init?.headers;
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          hits: {
            hits: [
              {
                _id: "000032019324000123:acme-20240101.htm",
                _source: {
                  cik: "320193",
                  display_names: ["ACME CORP"],
                  form: "10-K",
                  file_date: "2024-01-05",
                  adsh: "0000320193-24-000123",
                },
              },
            ],
          },
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const hits = await searchEdgarFilings({
        query: "cloud migration",
        forms: ["10-K", "10-Q"],
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        userAgent: "InfrOS filing-scanner contact@infros.io",
      });

      expect(capturedUrl).toContain("efts.sec.gov/LATEST/search-index");
      expect(capturedUrl).toContain("forms=10-K%2C10-Q");
      expect(capturedHeaders).toMatchObject({ "User-Agent": "InfrOS filing-scanner contact@infros.io" });

      expect(hits).toEqual([
        {
          cik: "320193",
          companyName: "ACME CORP",
          form: "10-K",
          filedAt: new Date("2024-01-05"),
          accessionNumber: "0000320193-24-000123",
          sourceUrl: "https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/acme-20240101.htm",
        },
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("fetchFilingDocument", () => {
  it("throws a clear error on a non-OK response", async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () =>
      ({ ok: false, status: 404, statusText: "Not Found" }) as Response) as typeof fetch;
    try {
      await expect(fetchFilingDocument("https://example.com/filing.htm", "test-agent")).rejects.toThrow(
        /404/,
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});

import { MarketAdapterError, fetchMarketStatus, syncMarketPrices } from "../adapters/market";
import type {
  IntegrationErrorResponse,
  MarketStatusResponse,
  MarketSyncResponse
} from "../domain/shared";

function responseJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const statusFixture: MarketStatusResponse = {
  available: true,
  source: {
    id: "markets.lostcity.rs",
    label: "Mock LostCity market",
    origin: "https://markets.lostcity.rs"
  },
  cache: { enabled: false },
  limits: {
    maxItemsPerRequest: 200,
    requestsPerSecond: 1
  }
};

const syncFixture: MarketSyncResponse = {
  priceSet: {
    id: "mock-market-sync",
    label: "Mock market sync",
    source: "scraped",
    createdAt: "2026-07-05T12:00:00.000Z",
    itemPrices: { lobster: 210 },
    alchValues: { lobster: 0 },
    provenance: {
      source: "scraped",
      sourceRef: "markets.lostcity.rs"
    }
  },
  report: {
    requested: 1,
    updated: 1,
    skipped: 0,
    failed: 0,
    startedAt: "2026-07-05T12:00:00.000Z",
    finishedAt: "2026-07-05T12:00:00.000Z",
    source: statusFixture.source,
    items: [{ itemId: "lobster", sourceSlug: "lobster", status: "updated", price: 210 }],
    warnings: []
  }
};

describe("market browser adapter", () => {
  it("fetches market status from same-origin", async () => {
    const seenUrls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      seenUrls.push(String(input));
      return responseJson(statusFixture);
    };

    const status = await fetchMarketStatus({ fetcher, baseUrl: "http://app.local/" });

    expect(status.available).toBe(true);
    expect(new URL(seenUrls[0]).pathname).toBe("/api/market/status");
  });

  it("posts current-monster sync requests and validates PriceSet responses", async () => {
    const seenBodies: unknown[] = [];
    const fetcher: typeof fetch = async (_input, init) => {
      seenBodies.push(JSON.parse(String(init?.body)));
      return responseJson(syncFixture);
    };

    const response = await syncMarketPrices(
      { scope: "monster", monsterId: "green_dragon", includeAlch: true },
      { fetcher, baseUrl: "http://app.local/" }
    );

    expect(seenBodies[0]).toEqual({
      scope: "monster",
      monsterId: "green_dragon",
      includeAlch: true
    });
    expect(response.priceSet.itemPrices.lobster).toBe(210);
  });

  it("maps partial failure and unavailable service errors", async () => {
    const cases: Array<{
      status: number;
      payload: IntegrationErrorResponse;
      expectedCode: MarketAdapterError["code"];
    }> = [
      {
        status: 429,
        payload: {
          error: { code: "rate-limited", message: "Rate limited", retryAfterSeconds: 10 }
        },
        expectedCode: "rate-limited"
      },
      {
        status: 503,
        payload: { error: { code: "upstream-unavailable", message: "Unavailable" } },
        expectedCode: "upstream-unavailable"
      }
    ];

    for (const testCase of cases) {
      const fetcher: typeof fetch = async () => responseJson(testCase.payload, testCase.status);
      await expect(
        syncMarketPrices(
          { scope: "items", itemIds: ["lobster"] },
          { fetcher, baseUrl: "http://app.local/" }
        )
      ).rejects.toMatchObject({
        code: testCase.expectedCode,
        status: testCase.status
      });
    }
  });

  it("fails closed on invalid payloads and cross-origin endpoints", async () => {
    const fetcher: typeof fetch = async () => responseJson({ priceSet: { itemPrices: {} } });

    await expect(
      syncMarketPrices(
        { scope: "items", itemIds: ["lobster"] },
        { fetcher, baseUrl: "http://app.local/" }
      )
    ).rejects.toMatchObject({ code: "upstream-invalid" });

    await expect(
      fetchMarketStatus({
        fetcher,
        endpoint: "https://example.test/api/market/status",
        baseUrl: "http://app.local/"
      })
    ).rejects.toMatchObject({ code: "bad-request" });
  });
});

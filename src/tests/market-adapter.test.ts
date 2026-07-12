import {
  MarketAdapterError,
  createScheduledStaticPriceSnapshotStatus,
  fetchPriceSet,
  fetchMarketStatus,
  loadScheduledStaticPriceSnapshot,
  syncMarketPrices
} from "../adapters/market";
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

function scheduledPricesJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    _scraped_at: 1783512900,
    lobster: 210,
    big_bones: 390,
    ...overrides
  });
}

function scheduledAlchJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    lobster: 0,
    big_bones: 0,
    ...overrides
  });
}

function scheduledProvenanceJson(): string {
  return JSON.stringify({
    version: 1,
    capturedAt: "2026-07-08T12:15:00.000Z",
    refreshSource: "markets.lostcity.rs",
    items: Object.fromEntries(
      ["big_bones", "lobster"].map((itemId) => [
        itemId,
        {
          valueOrigin: "legacy-static",
          refreshStatus: "not-evaluated",
          quality: "unknown",
          reasonCode: "legacy-metadata-unavailable"
        }
      ])
    )
  });
}

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

  it("bounds live and imported price response streams before parsing them", async () => {
    const statusFetcher: typeof fetch = async () => responseJson(statusFixture);
    await expect(
      fetchMarketStatus({
        fetcher: statusFetcher,
        baseUrl: "http://app.local/",
        maxBytes: 32
      })
    ).rejects.toMatchObject({
      code: "upstream-invalid",
      message: "Invalid market API response"
    });

    const priceFetcher: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          id: "too-large",
          label: "Too large",
          source: "manual",
          createdAt: "2026-07-11T00:00:00.000Z",
          itemPrices: { lobster: 200 },
          alchValues: { lobster: 0 }
        })
      );
    await expect(
      fetchPriceSet("/prices.json", {
        fetcher: priceFetcher,
        baseUrl: "http://app.local/",
        maxBytes: 32
      })
    ).rejects.toMatchObject({ name: "ResponseBodyTooLargeError" });
  });

  it("builds scheduled price candidates from prices plus canonical generated alch", async () => {
    const seenPaths: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      seenPaths.push(path);
      if (path === "/prices.json") return new Response(scheduledPricesJson());
      if (path === "/price-provenance.json") return new Response(scheduledProvenanceJson());
      if (path === "/price-history.json") {
        return new Response(
          JSON.stringify([{ t: 1783512900, prices: { lobster: 205, big_bones: 400 } }])
        );
      }
      return responseJson({ error: { code: "not-found", message: "Missing" } }, 404);
    };

    const status = await loadScheduledStaticPriceSnapshot({
      fetcher,
      baseUrl: "http://app.local/",
      canonicalAlchValues: { lobster: 12, big_bones: 1 }
    });

    expect(new Set(seenPaths)).toEqual(
      new Set(["/prices.json", "/price-provenance.json", "/price-history.json"])
    );
    expect(status.status).toBe("loaded");
    expect(status.reason).toBe("Scheduled price snapshot loaded.");
    expect(status.scheduledPriceSet).toMatchObject({
      id: "scheduled-static-prices-2026-07-08T12-15-00-000Z",
      label: "Scheduled static prices",
      source: "scraped",
      createdAt: "2026-07-08T12:15:00.000Z",
      itemPrices: { lobster: 210, big_bones: 390 },
      alchValues: { lobster: 12, big_bones: 1 }
    });
    expect(status.files.alch).toBe("not-requested");
    expect(status.latestHistoryAt).toBe("2026-07-08T12:15:00.000Z");
    expect(status.sharedPriceHistory).toEqual({
      version: 2,
      snapshots: [
        {
          t: 1783512900,
          kind: "legacy-unknown",
          prices: { lobster: 205, big_bones: 400 },
          evaluations: {}
        }
      ]
    });
  });

  it("bounds scheduled static responses without misclassifying oversized files as missing", async () => {
    const oversizedPrices = await loadScheduledStaticPriceSnapshot({
      fetcher: async (input) => {
        const path = new URL(String(input)).pathname;
        if (path === "/prices.json") {
          return new Response(scheduledPricesJson(), { headers: { "Content-Length": "1000" } });
        }
        if (path === "/price-provenance.json") {
          return new Response(scheduledProvenanceJson());
        }
        return new Response("[]");
      },
      baseUrl: "http://app.local/",
      canonicalAlchValues: { lobster: 12 },
      maxBytes: 32
    });
    expect(oversizedPrices).toMatchObject({
      status: "invalid",
      validationCode: "body_too_large",
      files: { prices: "invalid" }
    });

    const oversizedHistory = await loadScheduledStaticPriceSnapshot({
      fetcher: async (input) => {
        const path = new URL(String(input)).pathname;
        if (path === "/prices.json") return new Response(scheduledPricesJson());
        if (path === "/price-provenance.json") {
          return new Response(scheduledProvenanceJson());
        }
        return new Response("[]", { headers: { "Content-Length": "1000" } });
      },
      baseUrl: "http://app.local/",
      canonicalAlchValues: { lobster: 12, big_bones: 1 },
      maxHistoryBytes: 32
    });
    expect(oversizedHistory.status).toBe("loaded");
    expect(oversizedHistory.files.priceHistory).toBe("invalid");
    expect(oversizedHistory.warnings).toContain("Scheduled price history metadata was ignored.");
  });

  it("classifies missing scheduled static files without exposing paths", () => {
    const status = createScheduledStaticPriceSnapshotStatus({
      pricesText: scheduledPricesJson(),
      priceProvenanceText: scheduledProvenanceJson(),
      alchText: null
    });

    expect(status).toMatchObject({
      status: "missing",
      reason: "Scheduled price snapshot is missing. Keeping existing prices available.",
      scheduledPriceSet: null,
      fallbackPriceSet: null,
      files: {
        prices: "loaded",
        priceProvenance: "loaded",
        alch: "missing",
        priceHistory: "not-requested"
      }
    });
    expect(status.reason).not.toContain("alch.json");
  });

  it.each([
    ["invalid JSON", "{bad", scheduledAlchJson(), "invalid_json"],
    [
      "invalid schema data",
      scheduledPricesJson({ lobster: -1 }),
      scheduledAlchJson(),
      "validation_failed"
    ],
    ["duplicate keys", '{"lobster": 200, "lobster": 210}', scheduledAlchJson(), "duplicate_keys"]
  ] as const)(
    "classifies invalid scheduled static price snapshots: %s",
    (_caseName, pricesText, alchText, validationCode) => {
      const status = createScheduledStaticPriceSnapshotStatus({
        pricesText,
        priceProvenanceText: scheduledProvenanceJson(),
        alchText
      });

      expect(status).toMatchObject({
        status: "invalid",
        reason: "Scheduled price snapshot is invalid. Keeping existing prices available.",
        scheduledPriceSet: null,
        fallbackPriceSet: null,
        validationCode
      });
      expect(status.reason).not.toContain(process.cwd());
    }
  );

  it("returns an explicit fallback status when the scheduled snapshot cannot be used", () => {
    const status = createScheduledStaticPriceSnapshotStatus(
      {
        pricesText: "{bad",
        priceProvenanceText: scheduledProvenanceJson(),
        alchText: scheduledAlchJson()
      },
      { fallbackPriceSet: syncFixture.priceSet }
    );

    expect(status).toMatchObject({
      status: "fallback",
      reason: "Scheduled price snapshot is invalid. Using the current PriceSet fallback.",
      scheduledPriceSet: null,
      fallbackReason: "invalid",
      validationCode: "invalid_json"
    });
    expect(status.fallbackPriceSet?.id).toBe("mock-market-sync");
  });

  it("treats optional invalid shared price history as metadata only", () => {
    const status = createScheduledStaticPriceSnapshotStatus({
      pricesText: scheduledPricesJson(),
      priceProvenanceText: scheduledProvenanceJson(),
      alchText: scheduledAlchJson(),
      priceHistoryText: "{bad"
    });

    expect(status.status).toBe("loaded");
    expect(status.files.priceHistory).toBe("invalid");
    expect(status.latestHistoryAt).toBeNull();
    expect(status.warnings).toContain("Scheduled price history metadata was ignored.");
  });

  it("rejects a scheduled provenance sidecar whose capture time does not match prices", () => {
    const provenance = JSON.parse(scheduledProvenanceJson());
    provenance.capturedAt = "2026-01-01T00:00:00.000Z";

    const status = createScheduledStaticPriceSnapshotStatus({
      pricesText: scheduledPricesJson(),
      priceProvenanceText: JSON.stringify(provenance),
      alchText: scheduledAlchJson()
    });

    expect(status).toMatchObject({
      status: "invalid",
      validationCode: "validation_failed",
      files: { priceProvenance: "invalid" }
    });
  });
});

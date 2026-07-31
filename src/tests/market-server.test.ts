import { loadCurrentTestContext } from "./helpers/current-sim";
import type { MarketProvider } from "../server/market-core";
import {
  MarketProviderError,
  createMarketApiHandler,
  createMemoryMarketRateLimiter
} from "../server/market-core";
import type { MarketStatusResponse, MarketSyncResponse, SimulationContext } from "../domain/shared";

function parseBody<T>(body: string): T {
  return JSON.parse(body) as T;
}

const availableStatus: MarketStatusResponse = {
  available: true,
  source: {
    id: "markets.lostcity.rs",
    label: "Mock LostCity market",
    origin: "https://markets.lostcity.rs"
  },
  cache: { enabled: false },
  limits: {
    maxItemsPerRequest: 200,
    requestsPerSecond: 20
  }
};

function fixtureProvider(): MarketProvider {
  return {
    status: () => availableStatus,
    sync: ({ mappings }) =>
      mappings.map((mapping) => {
        if (mapping.itemId === "dragon_bones") {
          return {
            itemId: mapping.itemId,
            sourceSlug: mapping.sourceSlug,
            status: "failed",
            reason: "Mock upstream timeout"
          };
        }
        return {
          itemId: mapping.itemId,
          sourceSlug: mapping.sourceSlug,
          status: "updated",
          price: mapping.itemId === "lobster" ? 210 : 1234,
          alchValue: mapping.itemId === "rune_scimitar" ? 15360 : 0,
          sampleSize: 3
        };
      })
  };
}

function handler(context: SimulationContext, provider: MarketProvider = fixtureProvider()) {
  return createMarketApiHandler({
    provider,
    gameData: context.gameData,
    basePriceSet: context.priceSet,
    rateLimiter: createMemoryMarketRateLimiter({ requestsPerSecond: 20 })
  });
}

describe("market API handler", () => {
  it("exposes disabled status by default", async () => {
    const handle = createMarketApiHandler();
    const response = await handle({ method: "GET", url: "/api/market/status" });

    expect(response?.status).toBe(200);
    expect(parseBody<MarketStatusResponse>(response?.body ?? "")).toMatchObject({
      available: false,
      source: { id: "disabled" },
      limits: { maxItemsPerRequest: 200, requestsPerSecond: 1 }
    });
  });

  it("keeps sync disabled without a provider and runtime data", async () => {
    const handle = createMarketApiHandler();
    const response = await handle({
      method: "POST",
      url: "/api/market/sync",
      body: JSON.stringify({ scope: "items", itemIds: ["lobster"] })
    });

    expect(response?.status).toBe(503);
    expect(parseBody<{ error: { code: string; message: string } }>(response?.body ?? "")).toEqual({
      error: {
        code: "upstream-unavailable",
        message: "Market provider is unavailable"
      }
    });
  });

  it("validates request JSON, body size and item allowlist", async () => {
    const context = await loadCurrentTestContext().then((result) => result.context);
    const handle = handler(context);

    const invalidJson = await handle({ method: "POST", url: "/api/market/sync", body: "{bad" });
    const disallowed = await handle({
      method: "POST",
      url: "/api/market/sync",
      body: JSON.stringify({ scope: "items", itemIds: ["not_a_market_item"] })
    });
    const tooLarge = await handle({
      method: "POST",
      url: "/api/market/sync",
      body: " ".repeat(128_001)
    });

    expect(invalidJson?.status).toBe(400);
    expect(disallowed?.status).toBe(400);
    expect(tooLarge?.status).toBe(400);
  });

  it("syncs current-monster prices into a validated PriceSet with partial failures", async () => {
    const context = await loadCurrentTestContext().then((result) => result.context);
    const response = await handler(context)({
      method: "POST",
      url: "/api/market/sync",
      body: JSON.stringify({ scope: "monster", monsterId: "green_dragon", includeAlch: true })
    });
    const body = parseBody<MarketSyncResponse>(response?.body ?? "");

    expect(response?.status).toBe(200);
    expect(body.priceSet.source).toBe("scraped");
    expect(body.priceSet.itemPrices.dragon_bones).toBe(context.priceSet.itemPrices.dragon_bones);
    expect(body.report).toMatchObject({
      failed: 1,
      source: { id: "markets.lostcity.rs" }
    });
    expect(body.report.warnings.some((warning) => warning.code === "partial-market-sync")).toBe(
      true
    );
  });

  it("supports all-supported and explicit item sync scopes", async () => {
    const context = await loadCurrentTestContext().then((result) => result.context);
    const allSupported = await handler(context)({
      method: "POST",
      url: "/api/market/sync",
      body: JSON.stringify({ scope: "all-supported", includeAlch: true })
    });
    const explicitItems = await handler(context)({
      method: "POST",
      url: "/api/market/sync",
      body: JSON.stringify({ scope: "items", itemIds: ["lobster"], includeAlch: true })
    });

    expect(
      parseBody<MarketSyncResponse>(allSupported?.body ?? "").report.requested
    ).toBeGreaterThan(50);
    expect(
      parseBody<MarketSyncResponse>(explicitItems?.body ?? "").priceSet.itemPrices.lobster
    ).toBe(210);
  });

  it("sanitizes unavailable and invalid provider failures", async () => {
    const context = await loadCurrentTestContext().then((result) => result.context);
    const unavailable = await handler(context, {
      status: () => availableStatus,
      sync: () => {
        throw new MarketProviderError("upstream-unavailable", "Raw upstream details");
      }
    })({
      method: "POST",
      url: "/api/market/sync",
      body: JSON.stringify({ scope: "items", itemIds: ["lobster"] })
    });
    const invalid = await handler(context, {
      status: () => availableStatus,
      sync: () => [{ itemId: "lobster", status: "updated", price: -1 }]
    } as MarketProvider)({
      method: "POST",
      url: "/api/market/sync",
      body: JSON.stringify({ scope: "items", itemIds: ["lobster"] })
    });
    const mismatchedSlug = await handler(context, {
      status: () => availableStatus,
      sync: () => [
        {
          itemId: "lobster",
          sourceSlug: "not_lobster",
          status: "updated",
          price: 210
        }
      ]
    })({
      method: "POST",
      url: "/api/market/sync",
      body: JSON.stringify({ scope: "items", itemIds: ["lobster"] })
    });

    expect(unavailable?.status).toBe(503);
    expect(
      parseBody<{ error: { message: string } }>(unavailable?.body ?? "").error.message
    ).not.toContain("Raw upstream");
    expect(invalid?.status).toBe(502);
    expect(mismatchedSlug?.status).toBe(502);
  });

  it("enforces per-process sync rate limits and provider timeouts", async () => {
    const context = await loadCurrentTestContext().then((result) => result.context);
    const rateLimited = createMarketApiHandler({
      provider: fixtureProvider(),
      gameData: context.gameData,
      basePriceSet: context.priceSet,
      rateLimiter: createMemoryMarketRateLimiter({
        requestsPerSecond: 1,
        windowMs: 1000,
        now: () => 1_000
      })
    });
    const first = await rateLimited({
      method: "POST",
      url: "/api/market/sync",
      body: JSON.stringify({ scope: "items", itemIds: ["lobster"] })
    });
    const second = await rateLimited({
      method: "POST",
      url: "/api/market/sync",
      body: JSON.stringify({ scope: "items", itemIds: ["lobster"] })
    });
    const timedOut = await createMarketApiHandler({
      provider: {
        status: () => availableStatus,
        sync: () => new Promise(() => undefined)
      },
      gameData: context.gameData,
      basePriceSet: context.priceSet,
      timeoutMs: 1
    })({
      method: "POST",
      url: "/api/market/sync",
      body: JSON.stringify({ scope: "items", itemIds: ["lobster"] })
    });
    const statusTimedOut = await createMarketApiHandler({
      provider: {
        status: () => new Promise(() => undefined),
        sync: () => []
      },
      timeoutMs: 1
    })({ method: "GET", url: "/api/market/status" });

    expect(first?.status).toBe(200);
    expect(second?.status).toBe(429);
    expect(timedOut?.status).toBe(503);
    expect(statusTimedOut?.status).toBe(503);
  });

  it("bounds ephemeral market rate-limit client state", () => {
    let currentTime = 1_000;
    const limiter = createMemoryMarketRateLimiter({
      requestsPerSecond: 1,
      windowMs: 1_000,
      maxEntries: 1,
      now: () => currentTime
    });

    expect(limiter.check("client-a").allowed).toBe(true);
    expect(limiter.check("client-b")).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    currentTime = 2_000;
    expect(limiter.check("client-b").allowed).toBe(true);
  });
});

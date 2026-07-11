import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { HiscoresProvider } from "../server/hiscores-core";
import {
  HiscoresProviderError,
  createHiscoresApiHandler,
  createMemoryHiscoresRateLimiter
} from "../server/hiscores-core";
import type { HiscoresResponse, HiscoresStatusResponse } from "../domain/shared";

function readHiscoresFixture(): HiscoresResponse {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "src/tests/fixtures/live-integrations/hiscores-api-success.json"),
      "utf8"
    )
  ) as HiscoresResponse;
}

function parseBody<T>(body: string): T {
  return JSON.parse(body) as T;
}

const availableStatus: HiscoresStatusResponse = {
  available: true,
  source: {
    id: "mock-hiscores",
    label: "Mock hiscores"
  }
};

function fixtureProvider(response: HiscoresResponse = readHiscoresFixture()): HiscoresProvider {
  return {
    status: () => availableStatus,
    lookup: (request) => ({
      ...response,
      player: request.player,
      normalizedPlayer: request.player
    })
  };
}

describe("hiscores API handler", () => {
  it("exposes disabled status when no live provider is configured", async () => {
    const handle = createHiscoresApiHandler();
    const response = await handle({ method: "GET", url: "/api/hiscores/status" });

    expect(response?.status).toBe(200);
    expect(parseBody<HiscoresStatusResponse>(response?.body ?? "")).toMatchObject({
      available: false,
      source: { id: "disabled" },
      limits: { requestsPerMinute: 30 }
    });
  });

  it("keeps lookup disabled without a configured provider", async () => {
    const handle = createHiscoresApiHandler();
    const response = await handle({
      method: "GET",
      url: "/api/hiscores?player=Fixture%20Player"
    });
    const body = parseBody<{ error: { code: string; message: string } }>(response?.body ?? "");

    expect(response?.status).toBe(503);
    expect(body.error.code).toBe("upstream-unavailable");
    expect(body.error.message).not.toContain(process.cwd());
  });

  it("validates player input before provider lookup", async () => {
    const handle = createHiscoresApiHandler({ provider: fixtureProvider() });
    const response = await handle({ method: "GET", url: "/api/hiscores?player=../local/path" });
    const body = parseBody<{ error: { code: string; message: string } }>(response?.body ?? "");

    expect(response?.status).toBe(400);
    expect(body.error.code).toBe("bad-request");
    expect(body.error.message).not.toContain("../local/path");
  });

  it("returns validated provider lookup results", async () => {
    const handle = createHiscoresApiHandler({ provider: fixtureProvider() });
    const response = await handle({
      method: "GET",
      url: "/api/hiscores?player=Fixture%20Player"
    });
    const body = parseBody<HiscoresResponse>(response?.body ?? "");

    expect(response?.status).toBe(200);
    expect(body.player).toBe("Fixture Player");
    expect(body.skills.attack?.level).toBe(61);
  });

  it("sanitizes not-found and upstream-invalid provider failures", async () => {
    const notFoundProvider: HiscoresProvider = {
      status: () => availableStatus,
      lookup: () => {
        throw new HiscoresProviderError("not-found", "Raw upstream player details");
      }
    };
    const invalidProvider = fixtureProvider({
      ...readHiscoresFixture(),
      skills: {
        attack: { level: 120 }
      }
    } as unknown as HiscoresResponse);

    const notFound = await createHiscoresApiHandler({ provider: notFoundProvider })({
      method: "GET",
      url: "/api/hiscores?player=Fixture%20Player"
    });
    const invalid = await createHiscoresApiHandler({ provider: invalidProvider })({
      method: "GET",
      url: "/api/hiscores?player=Fixture%20Player"
    });

    expect(notFound?.status).toBe(404);
    expect(
      parseBody<{ error: { message: string } }>(notFound?.body ?? "").error.message
    ).not.toContain("Raw upstream");
    expect(invalid?.status).toBe(502);
    expect(parseBody<{ error: { code: string } }>(invalid?.body ?? "").error.code).toBe(
      "upstream-invalid"
    );
  });

  it("enforces ephemeral lookup rate limits", async () => {
    const handle = createHiscoresApiHandler({
      provider: fixtureProvider(),
      rateLimiter: createMemoryHiscoresRateLimiter({
        requestsPerMinute: 1,
        windowMs: 60_000,
        now: () => 1_000
      })
    });

    const first = await handle({ method: "GET", url: "/api/hiscores?player=Fixture" });
    const second = await handle({ method: "GET", url: "/api/hiscores?player=Fixture" });

    expect(first?.status).toBe(200);
    expect(second?.status).toBe(429);
    expect(second?.headers["Retry-After"]).toBe("60");
  });

  it("bounds ephemeral rate-limit client state and releases expired entries", () => {
    let currentTime = 1_000;
    const limiter = createMemoryHiscoresRateLimiter({
      requestsPerMinute: 30,
      windowMs: 1_000,
      maxEntries: 2,
      now: () => currentTime
    });

    expect(limiter.check("client-a").allowed).toBe(true);
    expect(limiter.check("client-b").allowed).toBe(true);
    expect(limiter.check("client-c")).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    currentTime = 2_000;
    expect(limiter.check("client-c").allowed).toBe(true);
  });

  it("fails closed when the provider exceeds the runtime guard", async () => {
    const slowProvider: HiscoresProvider = {
      status: () => availableStatus,
      lookup: () => new Promise(() => undefined)
    };
    const response = await createHiscoresApiHandler({
      provider: slowProvider,
      timeoutMs: 1
    })({ method: "GET", url: "/api/hiscores?player=Fixture" });

    expect(response?.status).toBe(503);
    expect(parseBody<{ error: { code: string } }>(response?.body ?? "").error.code).toBe(
      "upstream-unavailable"
    );

    const statusResponse = await createHiscoresApiHandler({
      provider: {
        status: () => new Promise(() => undefined),
        lookup: slowProvider.lookup
      },
      timeoutMs: 1
    })({ method: "GET", url: "/api/hiscores/status" });
    expect(statusResponse?.status).toBe(503);
  });
});

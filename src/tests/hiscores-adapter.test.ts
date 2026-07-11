import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HISCORES_LAST_PLAYER_STORAGE_KEY,
  HiscoresAdapterError,
  fetchHiscoresStatus,
  loadLastHiscoresPlayer,
  lookupHiscores,
  saveLastHiscoresPlayer
} from "../adapters/hiscores";
import { createMemoryStorage } from "../adapters/storage";
import type {
  HiscoresResponse,
  HiscoresStatusResponse,
  IntegrationErrorResponse
} from "../domain/shared";

function readHiscoresFixture(): HiscoresResponse {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "src/tests/fixtures/live-integrations/hiscores-api-success.json"),
      "utf8"
    )
  ) as HiscoresResponse;
}

function responseJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const statusFixture: HiscoresStatusResponse = {
  available: true,
  source: {
    id: "mock-hiscores",
    label: "Mock hiscores"
  },
  limits: {
    requestsPerMinute: 30
  }
};

describe("hiscores browser adapter", () => {
  it("fetches and validates same-origin status", async () => {
    const seenUrls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      seenUrls.push(String(input));
      return responseJson(statusFixture);
    };

    const status = await fetchHiscoresStatus({
      fetcher,
      baseUrl: "http://app.local/"
    });

    expect(status.available).toBe(true);
    expect(new URL(seenUrls[0]).pathname).toBe("/api/hiscores/status");
  });

  it("validates the player name locally and encodes lookup requests", async () => {
    const seenUrls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      seenUrls.push(String(input));
      return responseJson(readHiscoresFixture());
    };

    const response = await lookupHiscores("  Fixture Player  ", {
      fetcher,
      baseUrl: "http://app.local/"
    });
    const target = new URL(seenUrls[0]);

    expect(response.skills.attack?.level).toBe(61);
    expect(target.origin).toBe("http://app.local");
    expect(target.pathname).toBe("/api/hiscores");
    expect(target.searchParams.get("player")).toBe("Fixture Player");

    await expect(
      lookupHiscores("../local/path", {
        fetcher,
        baseUrl: "http://app.local/"
      })
    ).rejects.toMatchObject({ code: "bad-request" });
    expect(seenUrls).toHaveLength(1);
  });

  it("maps sanitized API errors for not-found, rate limits and unavailable providers", async () => {
    const cases: Array<{
      status: number;
      payload: IntegrationErrorResponse;
      expectedCode: HiscoresAdapterError["code"];
    }> = [
      {
        status: 404,
        payload: { error: { code: "not-found", message: "Player not found" } },
        expectedCode: "not-found"
      },
      {
        status: 429,
        payload: {
          error: {
            code: "rate-limited",
            message: "Rate limited",
            retryAfterSeconds: 15
          }
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
        lookupHiscores("Fixture Player", { fetcher, baseUrl: "http://app.local/" })
      ).rejects.toMatchObject({
        code: testCase.expectedCode,
        status: testCase.status
      });
    }
  });

  it("fails closed on invalid success payloads and cross-origin endpoints", async () => {
    const fetcher: typeof fetch = async () => responseJson({ player: "Fixture Player" });

    await expect(
      lookupHiscores("Fixture Player", { fetcher, baseUrl: "http://app.local/" })
    ).rejects.toMatchObject({ code: "upstream-invalid" });

    await expect(
      fetchHiscoresStatus({
        fetcher,
        endpoint: "https://example.test/api/hiscores/status",
        baseUrl: "http://app.local/"
      })
    ).rejects.toMatchObject({ code: "bad-request" });
  });

  it("bounds response streams before parsing them", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(JSON.stringify(readHiscoresFixture()), {
        headers: { "Content-Type": "application/json" }
      });

    await expect(
      lookupHiscores("Fixture Player", {
        fetcher,
        baseUrl: "http://app.local/",
        maxBytes: 64
      })
    ).rejects.toMatchObject({
      code: "upstream-invalid",
      message: "Invalid hiscores API response"
    });
  });

  it("stores only validated last-player input", () => {
    const storage = createMemoryStorage();

    saveLastHiscoresPlayer(storage, " Fixture Player ");
    expect(JSON.parse(storage.getItem(HISCORES_LAST_PLAYER_STORAGE_KEY) ?? "{}")).toMatchObject({
      version: 1,
      data: { player: "Fixture Player" }
    });
    expect(loadLastHiscoresPlayer(storage)).toBe("Fixture Player");

    storage.setItem(
      HISCORES_LAST_PLAYER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: "2026-07-05T12:00:00.000Z",
        data: { player: "../local/path" }
      })
    );
    expect(loadLastHiscoresPlayer(storage)).toBe("");
  });
});

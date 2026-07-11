import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LOSTCITY_HISCORES_ORIGIN,
  createLostCityHiscoresProvider
} from "../server/lostcity-hiscores-provider";

const FIXTURE = readFileSync(
  join(process.cwd(), "src/tests/fixtures/live-integrations/lostcity-hiscores-upstream.json"),
  "utf8"
);

function lookupContext() {
  return { signal: new AbortController().signal };
}

function jsonResponse(body = FIXTURE, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...init.headers
    }
  });
}

describe("LostCity hiscores provider", () => {
  it("reports the configured first-party source without probing upstream", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = createLostCityHiscoresProvider({ fetcher });

    expect(await provider.status()).toEqual({
      available: true,
      source: { id: "lostcity_hiscores", label: "2004Scape hiscores" }
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps the documented type rows and stored XP units through a fixed HTTPS request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse());
    const provider = createLostCityHiscoresProvider({
      fetcher,
      now: () => new Date("2026-07-10T13:00:00.000Z")
    });

    const result = await provider.lookup({ player: "Fixture Player" }, lookupContext());
    const [input, init] = fetcher.mock.calls[0]!;
    const target = new URL(String(input));

    expect(target.origin).toBe(LOSTCITY_HISCORES_ORIGIN);
    expect(target.pathname).toBe("/api/hiscores/player/Fixture%20Player");
    expect(init).toMatchObject({ method: "GET", redirect: "error" });
    expect((init?.headers as Record<string, string>).Accept).toBe("application/json");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toMatchObject({
      player: "Fixture Player",
      normalizedPlayer: "Fixture Player",
      fetchedAt: "2026-07-10T13:00:00.000Z",
      source: { id: "lostcity_hiscores" },
      skills: {
        attack: { level: 61, xp: 333804, rank: 1200 },
        defence: { level: 55, xp: 166636, rank: 1500 },
        strength: { level: 64, xp: 407015, rank: 1100 },
        hitpoints: { level: 63, xp: 368599, rank: 1000 },
        ranged: { level: 50, xp: 101333, rank: 1700 },
        prayer: { level: 43, xp: 50339, rank: 1800 },
        magic: { level: 57, xp: 203254, rank: 1600 }
      },
      warnings: []
    });
  });

  it("accepts the current live row shape when the documented date is omitted", async () => {
    const rows = JSON.parse(FIXTURE) as Array<Record<string, unknown>>;
    const rowsWithoutDate = rows.map((row) => {
      const copy = { ...row };
      delete copy.date;
      return copy;
    });
    const liveShape = [{ type: 0, level: 1578, value: 962_884_055, rank: 51 }, ...rowsWithoutDate];
    const provider = createLostCityHiscoresProvider({
      fetcher: async () => jsonResponse(JSON.stringify(liveShape))
    });

    const result = await provider.lookup({ player: "Fixture" }, lookupContext());

    expect(Object.keys(result.skills)).toHaveLength(7);
    expect(result.skills.attack).toEqual({ level: 61, xp: 333804, rank: 1200 });
    expect(result.warnings).toEqual([]);
  });

  it("keeps partial skill data usable with sanitized missing-skill warnings", async () => {
    const rows = JSON.parse(FIXTURE) as Array<Record<string, unknown>>;
    const provider = createLostCityHiscoresProvider({
      fetcher: async () => jsonResponse(JSON.stringify(rows.slice(0, 1)))
    });

    const result = await provider.lookup({ player: "Fixture" }, lookupContext());

    expect(result.skills).toEqual({ attack: { level: 61, xp: 333804, rank: 1200 } });
    expect(result.warnings).toHaveLength(6);
    expect(result.warnings[0]).toMatchObject({
      code: "missing-hiscores-skill",
      severity: "warning"
    });
    expect(JSON.stringify(result.warnings)).not.toContain(LOSTCITY_HISCORES_ORIGIN);
  });

  it("maps empty, rate-limited and unavailable responses to provider categories", async () => {
    const empty = createLostCityHiscoresProvider({
      fetcher: async () => jsonResponse("[]")
    });
    const rateLimited = createLostCityHiscoresProvider({
      fetcher: async () => new Response("", { status: 429, headers: { "Retry-After": "17" } })
    });
    const unavailable = createLostCityHiscoresProvider({
      fetcher: async () => new Response("", { status: 503 })
    });

    await expect(empty.lookup({ player: "Fixture" }, lookupContext())).rejects.toMatchObject({
      code: "not-found"
    });
    await expect(rateLimited.lookup({ player: "Fixture" }, lookupContext())).rejects.toMatchObject({
      code: "rate-limited",
      retryAfterSeconds: 17
    });
    await expect(unavailable.lookup({ player: "Fixture" }, lookupContext())).rejects.toMatchObject({
      code: "upstream-unavailable"
    });
  });

  it("rejects malformed, duplicate and non-JSON success responses", async () => {
    const rows = JSON.parse(FIXTURE) as Array<Record<string, unknown>>;
    const cases = [
      jsonResponse("{bad"),
      jsonResponse(FIXTURE.replace('"type": 1', '"type": 1, "type": 1')),
      jsonResponse(JSON.stringify([rows[0], rows[0]])),
      jsonResponse(JSON.stringify([{ ...rows[0], level: 120 }])),
      new Response("<html>unexpected</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" }
      })
    ];

    for (const response of cases) {
      const provider = createLostCityHiscoresProvider({ fetcher: async () => response });
      await expect(provider.lookup({ player: "Fixture" }, lookupContext())).rejects.toMatchObject({
        code: "upstream-invalid"
      });
    }
  });

  it("rejects declared and streamed oversized bodies before parsing", async () => {
    const declared = createLostCityHiscoresProvider({
      maxBytes: 32,
      fetcher: async () => jsonResponse("[]", { headers: { "Content-Length": "33" } })
    });
    const streamed = createLostCityHiscoresProvider({
      maxBytes: 32,
      fetcher: async () => jsonResponse("[" + " ".repeat(32) + "]")
    });

    await expect(declared.lookup({ player: "Fixture" }, lookupContext())).rejects.toMatchObject({
      code: "upstream-invalid"
    });
    await expect(streamed.lookup({ player: "Fixture" }, lookupContext())).rejects.toMatchObject({
      code: "upstream-invalid"
    });
  });

  it("fails closed when fetch rejects, including redirect and abort failures", async () => {
    const provider = createLostCityHiscoresProvider({
      fetcher: async () => {
        throw new TypeError("Raw redirect target or local path must stay private");
      }
    });
    const streamFailure = createLostCityHiscoresProvider({
      fetcher: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("Raw stream failure must stay private"));
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    });

    await expect(provider.lookup({ player: "Fixture" }, lookupContext())).rejects.toMatchObject({
      code: "upstream-unavailable",
      message: "Hiscores provider is unavailable"
    });
    await expect(
      streamFailure.lookup({ player: "Fixture" }, lookupContext())
    ).rejects.toMatchObject({
      code: "upstream-unavailable",
      message: "Hiscores provider is unavailable"
    });
  });
});

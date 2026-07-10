import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseMarketsLostcityItemPage } from "../../scripts/markets-lostcity-item-page-adapter";
import { parseMarketsLostcityRawResponseJson } from "../../scripts/markets-lostcity-raw-adapter";
import {
  ScheduledMarketWriterError,
  buildScheduledPriceHistory,
  createScheduledMarketSnapshotOutputs,
  estimateScheduledMarketPrice,
  parseScheduledMarketUpstreamResponseJson,
  type ScheduledMarketSnapshotOutputs,
  type ScheduledMarketUpstreamItem
} from "../../scripts/scheduled-market-writer-core";
import { parseArgs, runScheduledMarketWriter } from "../../scripts/write-scheduled-market-prices";
import { MARKET_SOURCE_MAPPINGS } from "../data/market-source-mapping";
import { PriceHistorySchema } from "../data/schemas";

const CAPTURED_AT = new Date("2026-07-08T00:15:00.000Z");
const CAPTURED_AT_SECONDS = Math.floor(CAPTURED_AT.getTime() / 1000);
const TEST_ITEM_IDS = new Set(["lobster", "rune_scimitar", "dragon_bones"]);
const TEST_MAPPINGS = MARKET_SOURCE_MAPPINGS.filter((mapping) => TEST_ITEM_IDS.has(mapping.itemId));

const BASE_PRICES = {
  _randomherb_avg: 2500,
  _scraped_at: CAPTURED_AT_SECONDS - 90_000,
  dragon_bones: 2800,
  lobster: 200,
  rune_scimitar: 22000,
  static_only: 999
};

const BASE_ALCH_VALUES = {
  dragon_bones: 0,
  lobster: 80,
  rune_scimitar: 15000
};

const BASE_HISTORY = [
  {
    t: CAPTURED_AT_SECONDS - 90_000,
    prices: { dragon_bones: 2700, lobster: 190, rune_scimitar: 21000, static_only: 900 }
  },
  {
    t: CAPTURED_AT_SECONDS - 600,
    prices: { dragon_bones: 2800, lobster: 205, rune_scimitar: 22200, static_only: 999 }
  }
];

function readFixture(fileName: string): string {
  return readFileSync(join(process.cwd(), "src/tests/fixtures/market-writer", fileName), "utf8");
}

function parseFixture(fileName: string) {
  return parseScheduledMarketUpstreamResponseJson(readFixture(fileName));
}

function parseRawFixture(fileName: string) {
  return parseMarketsLostcityRawResponseJson(readFixture(fileName), { mappings: TEST_MAPPINGS });
}

function createOutputs(fileName = "upstream-valid.json"): ScheduledMarketSnapshotOutputs {
  return createScheduledMarketSnapshotOutputs({
    upstream: parseFixture(fileName),
    previousPrices: BASE_PRICES,
    previousPriceHistory: BASE_HISTORY,
    mappings: TEST_MAPPINGS,
    capturedAt: CAPTURED_AT
  });
}

function expectWriterError(
  action: () => unknown,
  code: ScheduledMarketWriterError["code"]
): ScheduledMarketWriterError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ScheduledMarketWriterError);
    expect((error as ScheduledMarketWriterError).code).toBe(code);
    expect((error as ScheduledMarketWriterError).message).not.toContain(process.cwd());
    return error as ScheduledMarketWriterError;
  }
  throw new Error(`Expected ScheduledMarketWriterError with code ${code}`);
}

function writeFixtureFiles(outputDir: string): void {
  writeFileSync(join(outputDir, "prices.json"), JSON.stringify(BASE_PRICES, null, 2));
  writeFileSync(join(outputDir, "alch.json"), JSON.stringify(BASE_ALCH_VALUES, null, 2));
  writeFileSync(join(outputDir, "price-history.json"), JSON.stringify(BASE_HISTORY, null, 2));
}

function readOutputFiles(outputDir: string): Record<string, string> {
  return {
    prices: readFileSync(join(outputDir, "prices.json"), "utf8"),
    alch: readFileSync(join(outputDir, "alch.json"), "utf8"),
    history: readFileSync(join(outputDir, "price-history.json"), "utf8")
  };
}

function writeOutputsIfChanged(
  outputDir: string,
  outputs: ScheduledMarketSnapshotOutputs
): string[] {
  const writes: Array<[string, string]> = [
    ["prices.json", outputs.pricesText],
    ["price-history.json", outputs.priceHistoryText]
  ];
  const changed: string[] = [];
  for (const [fileName, nextText] of writes) {
    const filePath = join(outputDir, fileName);
    if (readFileSync(filePath, "utf8") === nextText) continue;
    writeFileSync(filePath, nextText);
    changed.push(fileName);
  }
  return changed;
}

function soldAt(minutesAgo: number): string {
  return new Date(CAPTURED_AT.getTime() - minutesAgo * 60_000).toISOString();
}

function itemPagePayload(slug: string, prices: number[]): string {
  return JSON.stringify({
    component: "items/show/page",
    props: {
      item: { slug, name: slug.replaceAll("_", " ") },
      soldListings: {
        current_page: 1,
        data: prices.map((price, index) => ({
          price: null,
          quantity: index + 1,
          type: index % 2 === 0 ? "buy" : "sell",
          soldAt: soldAt(index + 1),
          username: `private-${index}`,
          offers: [
            {
              title: "For each item:",
              items: [{ quantity: price, item: { slug: "coins" } }]
            }
          ]
        }))
      }
    }
  });
}

function pageResponse(slug: string, prices: number[], contentType = "application/json"): Response {
  return new Response(itemPagePayload(slug, prices), {
    status: 200,
    headers: { "Content-Type": contentType }
  });
}

describe("scheduled market writer", () => {
  it("creates deterministic price-only outputs from normalized completed trades", () => {
    const outputs = createOutputs();

    expect(Object.keys(outputs.prices)).toEqual([...Object.keys(outputs.prices)].sort());
    expect(outputs).not.toHaveProperty("alchValues");
    expect(outputs).not.toHaveProperty("alchText");
    expect(outputs.prices).toMatchObject({
      _scraped_at: CAPTURED_AT_SECONDS,
      dragon_bones: 2800,
      lobster: 215,
      rune_scimitar: 23000,
      static_only: 999
    });
    expect(outputs.report).toMatchObject({
      source: "markets.lostcity.rs",
      capturedAt: CAPTURED_AT.toISOString(),
      requested: 3,
      updated: 2,
      skipped: 1
    });
    expect(outputs.report.items.find((item) => item.itemId === "lobster")).toMatchObject({
      status: "updated",
      quality: "low",
      observations: 3,
      acceptedObservations: 3,
      rejectedObservations: 0
    });
    expect(outputs.report.items.find((item) => item.itemId === "dragon_bones")).toMatchObject({
      status: "skipped",
      quality: "retained",
      reason: "No recent trade sample in fixture"
    });
    expect(PriceHistorySchema.parse(JSON.parse(outputs.priceHistoryText))).toHaveLength(2);
    expect(outputs.priceHistory.at(-1)).toMatchObject({
      t: CAPTURED_AT_SECONDS,
      prices: { lobster: 215, rune_scimitar: 23000, dragon_bones: 2800, static_only: 999 }
    });
  });

  it("keeps the legacy raw fixture adapter price-only at output generation", () => {
    const outputs = createScheduledMarketSnapshotOutputs({
      upstream: parseRawFixture("raw-valid.json"),
      previousPrices: BASE_PRICES,
      previousPriceHistory: BASE_HISTORY,
      mappings: TEST_MAPPINGS,
      capturedAt: CAPTURED_AT
    });

    expect(outputs.prices).toMatchObject({ lobster: 215, rune_scimitar: 23000 });
    expect(outputs).not.toHaveProperty("alchValues");
  });

  it("uses MAD to reject an extreme completed trade and does not weight quantity", () => {
    const item: ScheduledMarketUpstreamItem = {
      itemId: "lobster",
      sourceSlug: "lobster",
      status: "updated",
      history: [100_000, 100, 101, 99, 100, 102, 98, 100, 101, 99].map((price, index) => ({
        price,
        quantity: index === 1 ? 100_000 : 1,
        type: index % 2 === 0 ? "buy" : "sell",
        soldAt: soldAt(index + 1)
      }))
    };

    expect(estimateScheduledMarketPrice({ item, capturedAt: CAPTURED_AT })).toMatchObject({
      status: "updated",
      price: 100,
      quality: "medium",
      observations: 10,
      acceptedObservations: 9,
      rejectedObservations: 1
    });
  });

  it("retains the previous value for sparse, stale or over-filtered samples", () => {
    const sparse = estimateScheduledMarketPrice({
      item: {
        itemId: "lobster",
        sourceSlug: "lobster",
        status: "updated",
        history: [{ price: 100 }, { price: 101 }]
      },
      capturedAt: CAPTURED_AT
    });
    const stale = estimateScheduledMarketPrice({
      item: {
        itemId: "lobster",
        sourceSlug: "lobster",
        status: "updated",
        history: [100, 101, 102].map((price) => ({
          price,
          soldAt: new Date(CAPTURED_AT.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString()
        }))
      },
      capturedAt: CAPTURED_AT
    });
    const overFiltered = estimateScheduledMarketPrice({
      item: {
        itemId: "lobster",
        sourceSlug: "lobster",
        status: "updated",
        history: [{ price: 100 }, { price: 100 }, { price: 10_000 }]
      },
      capturedAt: CAPTURED_AT
    });

    expect(sparse).toMatchObject({ status: "retained", quality: "retained" });
    expect(stale).toMatchObject({
      status: "retained",
      reason: "Latest usable completed trade is older than 30 days"
    });
    expect(overFiltered).toMatchObject({
      status: "retained",
      reason: "Fewer than 3 trades remained after outlier filtering"
    });
  });

  it("keeps 12-hour snapshots for 90 days and one latest snapshot per older UTC day", () => {
    const day = 24 * 60 * 60;
    const history = buildScheduledPriceHistory({
      existingHistory: [
        { t: CAPTURED_AT_SECONDS - 100 * day, prices: { lobster: 90 } },
        { t: CAPTURED_AT_SECONDS - 100 * day + 12 * 60 * 60, prices: { lobster: 91 } },
        { t: CAPTURED_AT_SECONDS - 89 * day, prices: { lobster: 95 } },
        { t: CAPTURED_AT_SECONDS - 89 * day + 12 * 60 * 60, prices: { lobster: 96 } }
      ],
      currentPrices: { _scraped_at: CAPTURED_AT_SECONDS, lobster: 100 },
      capturedAtSeconds: CAPTURED_AT_SECONDS
    });

    expect(history.map((snapshot) => snapshot.prices.lobster)).toEqual([91, 95, 96, 100]);
  });

  it("parses JSON and HTML Inertia item pages while discarding player identity fields", () => {
    const mapping = TEST_MAPPINGS.find((candidate) => candidate.itemId === "lobster")!;
    const jsonItem = parseMarketsLostcityItemPage({
      text: itemPagePayload("lobster", [200, 210, 220]),
      contentType: "application/json",
      mapping
    });
    const htmlPayload = itemPagePayload("lobster", [200, 210, 220])
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;");
    const htmlItem = parseMarketsLostcityItemPage({
      text: `<main data-page="${htmlPayload}"></main>`,
      contentType: "text/html; charset=UTF-8",
      mapping
    });
    const ambiguousPayload = JSON.parse(itemPagePayload("lobster", [200, 210, 220]));
    ambiguousPayload.props.soldListings.data[1].offers = [
      {
        items: [
          { quantity: 100, item: { slug: "coins" } },
          { quantity: 1, item: { slug: "rune_scimitar" } }
        ]
      }
    ];
    const ambiguousItem = parseMarketsLostcityItemPage({
      text: JSON.stringify(ambiguousPayload),
      contentType: "application/json",
      mapping
    });

    expect(jsonItem).toEqual(htmlItem);
    expect(JSON.stringify(jsonItem)).not.toContain("private-");
    expect(jsonItem.history).toEqual([
      expect.objectContaining({ price: 200, quantity: 1, type: "buy" }),
      expect.objectContaining({ price: 210, quantity: 2, type: "sell" }),
      expect.objectContaining({ price: 220, quantity: 3, type: "buy" })
    ]);
    expect(ambiguousItem.history?.map((trade) => trade.price)).toEqual([200, 220]);
  });

  it("rejects invalid normalized/raw rows and incomplete approved mapping sets", () => {
    expectWriterError(() => parseFixture("upstream-invalid-numeric.json"), "invalid_upstream");
    expectWriterError(() => parseRawFixture("raw-invalid-numeric.json"), "invalid_upstream");
    expectWriterError(() => createOutputs("upstream-missing-item.json"), "missing_item");
    expectWriterError(() => createOutputs("upstream-unknown-item.json"), "unknown_item");
    expectWriterError(() => createOutputs("upstream-unknown-slug.json"), "unknown_source_slug");
    expectWriterError(() => parseRawFixture("raw-duplicate-item.json"), "duplicate_item");
    const allSkipped = parseFixture("upstream-valid.json");
    expectWriterError(
      () =>
        createScheduledMarketSnapshotOutputs({
          upstream: {
            ...allSkipped,
            items: allSkipped.items.map((item) => ({
              itemId: item.itemId,
              sourceSlug: item.sourceSlug,
              status: "skipped" as const,
              reason: "No usable completed trades"
            }))
          },
          previousPrices: BASE_PRICES,
          previousPriceHistory: BASE_HISTORY,
          mappings: TEST_MAPPINGS,
          capturedAt: CAPTURED_AT
        }),
      "invalid_upstream"
    );
  });

  it("keeps an unavailable new market price omitted for generated runtime fallback", () => {
    const outputs = createScheduledMarketSnapshotOutputs({
      upstream: parseFixture("upstream-valid.json"),
      previousPrices: Object.fromEntries(
        Object.entries(BASE_PRICES).filter(([key]) => key !== "dragon_bones")
      ),
      previousPriceHistory: BASE_HISTORY,
      mappings: TEST_MAPPINGS,
      capturedAt: CAPTURED_AT
    });

    expect(outputs.prices).not.toHaveProperty("dragon_bones");
    expect(outputs.report.items.find((item) => item.itemId === "dragon_bones")?.reason).toContain(
      "no previous market price"
    );
  });

  it("writes only prices and history, leaves alch unchanged and skips identical reruns", () => {
    const outputDir = join(process.cwd(), ".vite", `market-writer-idempotent-${process.pid}`);
    rmSync(outputDir, { recursive: true, force: true });
    mkdirSync(outputDir, { recursive: true });
    try {
      writeFixtureFiles(outputDir);
      const alchBefore = readFileSync(join(outputDir, "alch.json"), "utf8");
      const firstOutputs = createOutputs();
      expect(writeOutputsIfChanged(outputDir, firstOutputs).sort()).toEqual([
        "price-history.json",
        "prices.json"
      ]);
      const secondOutputs = createScheduledMarketSnapshotOutputs({
        upstream: parseFixture("upstream-valid.json"),
        previousPrices: JSON.parse(readFileSync(join(outputDir, "prices.json"), "utf8")),
        previousPriceHistory: JSON.parse(
          readFileSync(join(outputDir, "price-history.json"), "utf8")
        ),
        mappings: TEST_MAPPINGS,
        capturedAt: CAPTURED_AT
      });

      expect(writeOutputsIfChanged(outputDir, secondOutputs)).toEqual([]);
      expect(readFileSync(join(outputDir, "alch.json"), "utf8")).toBe(alchBefore);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("fetches one first-page item response per mapping sequentially during dry run", async () => {
    const outputDir = join(process.cwd(), ".vite", `market-writer-cli-${process.pid}`);
    rmSync(outputDir, { recursive: true, force: true });
    mkdirSync(outputDir, { recursive: true });
    try {
      writeFixtureFiles(outputDir);
      const before = readOutputFiles(outputDir);
      const fetchedSlugs: string[] = [];
      const delays: number[] = [];
      const fetchMock = vi.fn(async (url: string) => {
        const slug = decodeURIComponent(new URL(url).pathname.split("/").at(-1) ?? "");
        fetchedSlugs.push(slug);
        if (slug === "dragon_bones") return new Response("", { status: 404 });
        return pageResponse(
          slug,
          slug === "lobster"
            ? [210, 220, 215]
            : slug === "rune_scimitar"
              ? [23000, 22500, 23500]
              : []
        );
      });

      const result = await runScheduledMarketWriter(
        [
          "--upstream-url",
          "https://markets.lostcity.rs/",
          "--output-dir",
          outputDir,
          "--item-ids",
          "lobster,rune_scimitar,dragon_bones",
          "--now",
          CAPTURED_AT.toISOString(),
          "--dry-run"
        ],
        {
          fetchImpl: fetchMock,
          requestDelayMs: 350,
          delayImpl: async (milliseconds) => {
            delays.push(milliseconds);
          }
        }
      );

      expect(fetchedSlugs).toEqual(["dragon_bones", "lobster", "rune_scimitar"]);
      expect(delays).toEqual([350, 350]);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://markets.lostcity.rs/items/lobster",
        expect.objectContaining({
          method: "GET",
          headers: { Accept: "application/json, text/html;q=0.9" },
          redirect: "error",
          signal: expect.any(AbortSignal)
        })
      );
      expect(result.changedFiles.sort()).toEqual(["price-history.json", "prices.json"]);
      expect(result.report).toMatchObject({ updated: 2, skipped: 1 });
      expect(readOutputFiles(outputDir)).toEqual(before);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("parses root-url CLI options and rejects unsafe upstream base URLs", async () => {
    expect(
      parseArgs([
        "--upstream-url",
        "https://markets.lostcity.rs/",
        "--item-ids",
        "lobster",
        "--dry-run"
      ])
    ).toMatchObject({ upstreamUrl: "https://markets.lostcity.rs/", itemIds: ["lobster"] });

    const fetchMock = vi.fn(async () => pageResponse("lobster", [200, 201, 202]));
    for (const upstreamUrl of [
      "https://example.test/",
      "not-a-url",
      "https://user:pass@markets.lostcity.rs/",
      "https://markets.lostcity.rs/?token=private",
      "https://markets.lostcity.rs/items/lobster",
      "https://markets.lostcity.rs/#fragment"
    ]) {
      await expect(
        runScheduledMarketWriter(
          ["--upstream-url", upstreamUrl, "--item-ids", "lobster", "--dry-run"],
          { fetchImpl: fetchMock, requestDelayMs: 0 }
        )
      ).rejects.toMatchObject({ code: "invalid_upstream" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps redirect, timeout, size and response-contract failures sanitized", async () => {
    const args = [
      "--upstream-url",
      "https://markets.lostcity.rs/",
      "--item-ids",
      "lobster",
      "--dry-run"
    ];
    await expect(
      runScheduledMarketWriter(args, {
        fetchImpl: async () => {
          throw new TypeError("Private redirect target");
        },
        requestDelayMs: 0
      })
    ).rejects.toMatchObject({
      code: "invalid_upstream",
      message: "Scheduled market upstream request failed"
    });

    const timeoutFetch = vi.fn(
      async (_url: string, init: { signal: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new Error("private timeout")), {
            once: true
          });
        })
    );
    await expect(
      runScheduledMarketWriter(args, {
        fetchImpl: timeoutFetch,
        upstreamTimeoutMs: 1,
        requestDelayMs: 0
      })
    ).rejects.toMatchObject({
      code: "invalid_upstream",
      message: "Scheduled market upstream request timed out"
    });

    await expect(
      runScheduledMarketWriter(args, {
        fetchImpl: async () =>
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json", "Content-Length": "101" }
          }),
        maxUpstreamBytes: 100,
        requestDelayMs: 0
      })
    ).rejects.toMatchObject({
      code: "invalid_upstream",
      message: "Scheduled market upstream response exceeds safe size limit"
    });

    const contractError = await runScheduledMarketWriter(args, {
      fetchImpl: async () =>
        new Response("plain text", { status: 200, headers: { "Content-Type": "text/plain" } }),
      requestDelayMs: 0
    }).catch((error: unknown) => error);
    expect(contractError).toMatchObject({
      code: "invalid_upstream",
      message: "Market item page response has an unsupported content type",
      issues: ["itemId: lobster"]
    });
  });
});

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MARKET_SOURCE_MAPPINGS } from "../data/market-source-mapping";
import { PriceHistorySchema, createPriceSetFromLegacyRecords } from "../data/schemas";
import {
  ScheduledMarketWriterError,
  createScheduledMarketSnapshotOutputs,
  parseScheduledMarketUpstreamResponseJson,
  type ScheduledMarketSnapshotOutputs
} from "../../scripts/scheduled-market-writer-core";
import { parseMarketsLostcityRawResponseJson } from "../../scripts/markets-lostcity-raw-adapter";
import { parseArgs, runScheduledMarketWriter } from "../../scripts/write-scheduled-market-prices";

const CAPTURED_AT = new Date("2026-07-08T00:15:00.000Z");
const CAPTURED_AT_SECONDS = Math.floor(CAPTURED_AT.getTime() / 1000);
const TEST_ITEM_IDS = new Set(["lobster", "rune_scimitar", "dragon_bones"]);
const TEST_MAPPINGS = MARKET_SOURCE_MAPPINGS.filter((mapping) =>
  TEST_ITEM_IDS.has(mapping.itemId)
);

const BASE_PRICES = {
  _randomherb_avg: 2500,
  _scraped_at: CAPTURED_AT_SECONDS - 90_000,
  dragon_bones: 2800,
  lobster: 200,
  rune_scimitar: 22000,
  static_only: 999
};

const BASE_ALCH_VALUES = {
  _randomherb_avg: 0,
  dragon_bones: 0,
  lobster: 80,
  rune_scimitar: 15000,
  static_only: 4
};

const BASE_HISTORY = [
  {
    t: CAPTURED_AT_SECONDS - 90_000,
    prices: {
      dragon_bones: 2700,
      lobster: 190,
      rune_scimitar: 21000,
      static_only: 900
    }
  },
  {
    t: CAPTURED_AT_SECONDS - 600,
    prices: {
      dragon_bones: 2800,
      lobster: 205,
      rune_scimitar: 22200,
      static_only: 999
    }
  }
];

function readFixture(fileName: string): string {
  return readFileSync(join(process.cwd(), "src/tests/fixtures/market-writer", fileName), "utf8");
}

function parseFixture(fileName: string) {
  return parseScheduledMarketUpstreamResponseJson(readFixture(fileName));
}

function parseRawFixture(fileName: string) {
  return parseMarketsLostcityRawResponseJson(readFixture(fileName), {
    mappings: TEST_MAPPINGS
  });
}

function createOutputs(fileName = "upstream-valid.json"): ScheduledMarketSnapshotOutputs {
  return createScheduledMarketSnapshotOutputs({
    upstream: parseFixture(fileName),
    previousPrices: BASE_PRICES,
    previousAlchValues: BASE_ALCH_VALUES,
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
    ["alch.json", outputs.alchText],
    ["price-history.json", outputs.priceHistoryText]
  ];
  const changed: string[] = [];
  for (const [fileName, nextText] of writes) {
    const filePath = join(outputDir, fileName);
    const currentText = readFileSync(filePath, "utf8");
    if (currentText === nextText) continue;
    writeFileSync(filePath, nextText);
    changed.push(fileName);
  }
  return changed;
}

describe("scheduled market writer", () => {
  it("creates deterministic validated outputs from a normalized upstream fixture", () => {
    const outputs = createOutputs();

    expect(Object.keys(outputs.prices)).toEqual([...Object.keys(outputs.prices)].sort());
    expect(Object.keys(outputs.alchValues)).toEqual([...Object.keys(outputs.alchValues)].sort());
    expect(outputs.prices).toMatchObject({
      _scraped_at: CAPTURED_AT_SECONDS,
      dragon_bones: 2800,
      lobster: 215,
      rune_scimitar: 23000,
      static_only: 999
    });
    expect(outputs.alchValues).toMatchObject({
      dragon_bones: 0,
      lobster: 90,
      rune_scimitar: 15360,
      static_only: 4
    });
    expect(outputs.report).toMatchObject({
      source: "markets.lostcity.rs",
      capturedAt: CAPTURED_AT.toISOString(),
      requested: 3,
      updated: 2,
      skipped: 1
    });
    expect(outputs.report.items.find((item) => item.itemId === "dragon_bones")).toMatchObject({
      status: "skipped",
      reason: "No recent trade sample in fixture"
    });

    expect(
      createPriceSetFromLegacyRecords({
        id: "writer-test",
        label: "Writer test",
        source: "scraped",
        createdAt: CAPTURED_AT.toISOString(),
        itemPrices: JSON.parse(outputs.pricesText),
        alchValues: JSON.parse(outputs.alchText)
      })
    ).toMatchObject({
      source: "scraped"
    });
    expect(PriceHistorySchema.parse(JSON.parse(outputs.priceHistoryText))).toHaveLength(2);
    expect(outputs.priceHistory.at(-1)).toMatchObject({
      t: CAPTURED_AT_SECONDS,
      prices: {
        lobster: 215,
        rune_scimitar: 23000,
        dragon_bones: 2800,
        static_only: 999
      }
    });
  });

  it("normalizes a sanitized raw markets.lostcity.rs fixture before output generation", () => {
    const upstream = parseRawFixture("raw-valid.json");
    const outputs = createScheduledMarketSnapshotOutputs({
      upstream,
      previousPrices: BASE_PRICES,
      previousAlchValues: BASE_ALCH_VALUES,
      previousPriceHistory: BASE_HISTORY,
      mappings: TEST_MAPPINGS,
      capturedAt: CAPTURED_AT
    });

    expect(upstream).toMatchObject({
      source: "markets.lostcity.rs",
      fetchedAt: CAPTURED_AT.toISOString(),
      items: [
        {
          itemId: "lobster",
          sourceSlug: "lobster",
          status: "updated",
          highAlch: 90,
          history: [{ price: 210 }, { price: 220 }, { price: 215 }]
        },
        {
          itemId: "rune_scimitar",
          sourceSlug: "rune_scimitar",
          status: "updated",
          highAlch: 15360,
          history: [{ price: 23000 }, { price: 22500 }, { price: 23500 }]
        },
        {
          itemId: "dragon_bones",
          sourceSlug: "dragon_bones",
          status: "skipped",
          reason: "No recent trade sample in fixture"
        }
      ]
    });
    expect(outputs.prices).toMatchObject({
      lobster: 215,
      rune_scimitar: 23000,
      dragon_bones: 2800
    });
    expect(outputs.alchValues).toMatchObject({
      lobster: 90,
      rune_scimitar: 15360,
      dragon_bones: 0
    });
  });

  it("rejects invalid numeric upstream values before output generation", () => {
    const error = expectWriterError(
      () => parseFixture("upstream-invalid-numeric.json"),
      "invalid_upstream"
    );

    expect(error.issues.join("\n")).toContain("items.0.price");
  });

  it("rejects invalid numeric raw upstream values before output generation", () => {
    const error = expectWriterError(
      () => parseRawFixture("raw-invalid-numeric.json"),
      "invalid_upstream"
    );

    expect(error.issues.join("\n")).toContain("items.lobster.item.price");
  });

  it("rejects missing approved mapping items", () => {
    expectWriterError(() => createOutputs("upstream-missing-item.json"), "missing_item");
    expectWriterError(
      () =>
        createScheduledMarketSnapshotOutputs({
          upstream: parseRawFixture("raw-missing-item.json"),
          previousPrices: BASE_PRICES,
          previousAlchValues: BASE_ALCH_VALUES,
          previousPriceHistory: BASE_HISTORY,
          mappings: TEST_MAPPINGS,
          capturedAt: CAPTURED_AT
        }),
      "missing_item"
    );
  });

  it("rejects unknown item ids and source slugs", () => {
    expectWriterError(() => createOutputs("upstream-unknown-item.json"), "unknown_item");
    expectWriterError(() => createOutputs("upstream-unknown-slug.json"), "unknown_source_slug");
    expectWriterError(() => parseRawFixture("raw-unknown-item.json"), "unknown_item");
    expectWriterError(() => parseRawFixture("raw-unknown-slug.json"), "unknown_source_slug");
  });

  it("rejects duplicate raw upstream item rows", () => {
    expectWriterError(() => parseRawFixture("raw-duplicate-item.json"), "duplicate_item");
  });

  it("requires previous output values for explicitly skipped items", () => {
    expectWriterError(
      () =>
        createScheduledMarketSnapshotOutputs({
          upstream: parseFixture("upstream-valid.json"),
          previousPrices: {
            ...BASE_PRICES,
            dragon_bones: undefined
          },
          previousAlchValues: BASE_ALCH_VALUES,
          previousPriceHistory: BASE_HISTORY,
          mappings: TEST_MAPPINGS,
          capturedAt: CAPTURED_AT
        }),
      "output_validation_failed"
    );

    expectWriterError(
      () =>
        createScheduledMarketSnapshotOutputs({
          upstream: parseFixture("upstream-valid.json"),
          previousPrices: Object.fromEntries(
            Object.entries(BASE_PRICES).filter(([key]) => key !== "dragon_bones")
          ),
          previousAlchValues: BASE_ALCH_VALUES,
          previousPriceHistory: BASE_HISTORY,
          mappings: TEST_MAPPINGS,
          capturedAt: CAPTURED_AT
        }),
      "missing_previous_value"
    );
  });

  it("does not write corrupt output files when upstream validation fails", () => {
    const outputDir = join(process.cwd(), ".vite", `market-writer-${process.pid}`);
    rmSync(outputDir, { recursive: true, force: true });
    mkdirSync(outputDir, { recursive: true });
    try {
      writeFixtureFiles(outputDir);
      const before = readOutputFiles(outputDir);

      expectWriterError(() => {
        const outputs = createOutputs("upstream-unknown-slug.json");
        writeOutputsIfChanged(outputDir, outputs);
      }, "unknown_source_slug");

      expect(readOutputFiles(outputDir)).toEqual(before);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("skips writes on a no-op rerun with identical generated output", () => {
    const outputDir = join(process.cwd(), ".vite", `market-writer-idempotent-${process.pid}`);
    rmSync(outputDir, { recursive: true, force: true });
    mkdirSync(outputDir, { recursive: true });
    try {
      writeFixtureFiles(outputDir);
      const firstOutputs = createOutputs();
      expect(writeOutputsIfChanged(outputDir, firstOutputs).sort()).toEqual([
        "alch.json",
        "price-history.json",
        "prices.json"
      ]);

      const secondOutputs = createScheduledMarketSnapshotOutputs({
        upstream: parseFixture("upstream-valid.json"),
        previousPrices: JSON.parse(readFileSync(join(outputDir, "prices.json"), "utf8")),
        previousAlchValues: JSON.parse(readFileSync(join(outputDir, "alch.json"), "utf8")),
        previousPriceHistory: JSON.parse(
          readFileSync(join(outputDir, "price-history.json"), "utf8")
        ),
        mappings: TEST_MAPPINGS,
        capturedAt: CAPTURED_AT
      });

      expect(writeOutputsIfChanged(outputDir, secondOutputs)).toEqual([]);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("parses scheduled writer CLI options for the raw upstream path", () => {
    expect(
      parseArgs([
        "--upstream-url",
        "https://markets.lostcity.rs/api/sanitized-market-fixture",
        "--output-dir",
        ".vite/market-writer-cli",
        "--item-ids",
        "lobster,rune_scimitar,dragon_bones",
        "--now",
        CAPTURED_AT.toISOString(),
        "--dry-run"
      ])
    ).toMatchObject({
      upstreamUrl: "https://markets.lostcity.rs/api/sanitized-market-fixture",
      outputDir: ".vite/market-writer-cli",
      itemIds: ["lobster", "rune_scimitar", "dragon_bones"],
      dryRun: true
    });
  });

  it("uses the raw adapter for --upstream-url without writing during dry run", async () => {
    const outputDir = join(process.cwd(), ".vite", `market-writer-cli-${process.pid}`);
    rmSync(outputDir, { recursive: true, force: true });
    mkdirSync(outputDir, { recursive: true });
    try {
      writeFixtureFiles(outputDir);
      const before = readOutputFiles(outputDir);
      const fetchMock = vi.fn(async () => ({
        ok: true,
        text: async () => readFixture("raw-valid.json")
      }));

      const result = await runScheduledMarketWriter(
        [
          "--upstream-url",
          "https://markets.lostcity.rs/api/sanitized-market-fixture",
          "--output-dir",
          outputDir,
          "--item-ids",
          "lobster,rune_scimitar,dragon_bones",
          "--now",
          CAPTURED_AT.toISOString(),
          "--dry-run"
        ],
        { fetchImpl: fetchMock }
      );

      expect(fetchMock).toHaveBeenCalledWith(
        "https://markets.lostcity.rs/api/sanitized-market-fixture",
        {
          method: "GET",
          headers: { Accept: "application/json" }
        }
      );
      expect(result.changedFiles.sort()).toEqual([
        "alch.json",
        "price-history.json",
        "prices.json"
      ]);
      expect(result.report).toMatchObject({ updated: 2, skipped: 1 });
      expect(readOutputFiles(outputDir)).toEqual(before);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("rejects unapproved or malformed --upstream-url values before fetch", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => readFixture("raw-valid.json")
    }));

    for (const upstreamUrl of [
      "https://example.test/api/sanitized-market-fixture",
      "not-a-url",
      "https://user:pass@markets.lostcity.rs/api/sanitized-market-fixture"
    ]) {
      await expect(
        runScheduledMarketWriter(
          [
            "--upstream-url",
            upstreamUrl,
            "--item-ids",
            "lobster,rune_scimitar,dragon_bones",
            "--dry-run"
          ],
          { fetchImpl: fetchMock }
        )
      ).rejects.toMatchObject({
        code: "invalid_upstream"
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

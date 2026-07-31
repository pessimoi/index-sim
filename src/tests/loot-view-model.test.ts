import { loadCurrentTestContext } from "./helpers/current-sim";
import { createGeneratedRuntimeContext } from "../adapters/generated";
import { simulateFullSimulation } from "../domain/simulation";
import { DEFAULT_FORM_STATE, formToSimulationRequest } from "../app/state/ui-state";
import { createFullSimulationInput } from "../app/view-models/simulation-input";
import {
  DEFAULT_LOOT_NESTED_TABLE_SORT_STATE,
  DEFAULT_LOOT_TABLE_SORT_STATE,
  createLootPresentationViewModel,
  nextLootNestedTableSortState,
  nextLootTableSortState,
  optimizeLootPrefsForMonster,
  sortLootNestedTableRows,
  sortLootTableRows
} from "../app/view-models/loot";
import type { ItemPriceHistoryContext } from "../app/view-models/price-data";
import { createPriceTimeContext, presentPriceDateTime } from "../app/view-models/price-time";

async function fixture(
  options: {
    lootPrefs?: Record<string, string>;
    history?: Record<string, ItemPriceHistoryContext>;
    settings?: Record<
      string,
      { highAlch?: boolean; overheadSec: number | null; talismanSpot: "underground" | "overground" }
    >;
  } = {}
) {
  const { context } = await loadCurrentTestContext();
  const form = DEFAULT_FORM_STATE;
  const request = formToSimulationRequest(form, context.gameData);
  const fullInput = createFullSimulationInput(form, request, {}, options.settings ?? {});
  const result = simulateFullSimulation(
    { ...fullInput, lootPrefs: options.lootPrefs ?? {} },
    context
  );
  return createLootPresentationViewModel({
    form,
    context,
    tripInput: { ...fullInput, combat: result.combat },
    trip: result.trip,
    lootPrefs: options.lootPrefs ?? {},
    lootSettingsByMonster: options.settings,
    lootPriceHistoryByItem: options.history
  });
}

describe("Loot view model", () => {
  it("uses game-data, row-source and conditional names without replacing technical identity", async () => {
    const { context } = await loadCurrentTestContext();
    const form = DEFAULT_FORM_STATE;
    const request = formToSimulationRequest(form, context.gameData);
    const fullInput = createFullSimulationInput(form, request, {}, {});
    const result = simulateFullSimulation(fullInput, context);
    const templateDrop = result.trip.lootBreakdown[0]!;
    const itemTemplate = Object.values(context.gameData.items)[0]!;
    const fixtureContext = {
      ...context,
      gameData: {
        ...context.gameData,
        items: {
          ...context.gameData.items,
          uncut_dragonstone: { ...itemTemplate, name: "Uncut dragonstone" }
        }
      }
    };
    const sourceBackedParent = {
      ...templateDrop,
      rowId: "fixture-parent-row",
      key: "uncut_dragonstone",
      name: "Row-source dragonstone",
      _expand: [
        {
          key: "rune_spear",
          name: "Rune spear",
          tag: "rare",
          weight: 1,
          price: 30_000
        }
      ]
    };
    const conditionalSourceRow = {
      ...templateDrop,
      rowId: "fixture-conditional-row",
      key: "conditional_fixture_item",
      name: "Conditional source item",
      pref: "skip" as const,
      eligibilityActive: false,
      eligibility: {
        kind: "quest" as const,
        policyId: "fixture-quest",
        description: "Requires the fixture quest."
      }
    };
    const presentation = createLootPresentationViewModel({
      form,
      context: fixtureContext,
      tripInput: { ...fullInput, combat: result.combat },
      trip: {
        ...result.trip,
        lootBreakdown: [sourceBackedParent, conditionalSourceRow]
      },
      lootPrefs: {}
    });

    const parent = presentation.actionableRows.find((row) => row.rowId === "fixture-parent-row");
    expect(parent?.displayLabel).toEqual({
      name: "Uncut dragonstone",
      technicalId: "uncut_dragonstone",
      source: "game-data"
    });
    expect(parent?.expandedRows[0]?.displayLabel).toEqual({
      name: "Rune spear",
      technicalId: "rune_spear",
      source: "row-source"
    });
    expect(presentation.conditionalRows[0]?.displayLabel).toEqual({
      name: "Conditional source item",
      technicalId: "conditional_fixture_item",
      source: "row-source"
    });
  });

  it("owns row partitions, policy presentation and summary composition", async () => {
    const presentation = await fixture();

    expect(presentation.rows.length).toBeGreaterThan(0);
    expect(presentation.actionableRows.length + presentation.conditionalRows.length).toBe(
      presentation.rows.length
    );
    expect(presentation.actionableRows.every((row) => row.eligibilityDescription === null)).toBe(
      true
    );
    expect(presentation.conditionalRows.every((row) => row.eligibilityDescription !== null)).toBe(
      true
    );
    expect(presentation.policySummary).toMatch(/^High alch (on|off) · 0 row choices$/);
    expect(presentation.summary.valueComposition.displayedGpPerKill).toBeTypeOf("number");
    expect(presentation.summary.overrideCount).toBe(0);
  });

  it("keeps settings precedence and local price-history context in the direct owner", async () => {
    const base = await fixture();
    const tracked = base.rows.find((row) => row.key !== null);
    expect(tracked).toBeDefined();
    const history = {
      [tracked!.key!]: {
        itemId: tracked!.key!,
        itemLabel: tracked!.name,
        latestPrice: 120,
        baselinePrice: 100,
        gpDelta: 20,
        percentDelta: 20,
        latestLabel: "Latest",
        baselineLabel: "Baseline",
        latestCaptureTime: presentPriceDateTime(
          "2026-07-20T12:00:00Z",
          createPriceTimeContext(new Date("2026-07-20T13:00:00Z"), "UTC")
        ),
        baselineCaptureTime: presentPriceDateTime(
          "2026-07-19T12:00:00Z",
          createPriceTimeContext(new Date("2026-07-20T13:00:00Z"), "UTC")
        )
      }
    };
    const presentation = await fixture({
      history,
      settings: {
        [DEFAULT_FORM_STATE.monsterId]: {
          highAlch: true,
          overheadSec: 3.5,
          talismanSpot: "overground"
        }
      }
    });
    const row = presentation.rows.find((candidate) => candidate.rowId === tracked!.rowId);

    expect(presentation.highAlchEnabled).toBe(true);
    expect(presentation.overheadMode).toBe("manual");
    expect(presentation.overheadValue).toBe(3.5);
    expect(row?.historyContext).toMatchObject({
      tracked: true,
      latestPrice: 120,
      baselinePrice: 100,
      gpDelta: 20,
      percentDelta: 20,
      latestCaptureTime: { exactVisible: "20 Jul 2026, 12:00 UTC" },
      baselineCaptureTime: { exactVisible: "19 Jul 2026, 12:00 UTC" }
    });
  });

  it("keeps the optimizer deterministic behind the Loot owner", async () => {
    const { context } = await loadCurrentTestContext();
    const first = optimizeLootPrefsForMonster(DEFAULT_FORM_STATE, context);
    const second = optimizeLootPrefsForMonster(DEFAULT_FORM_STATE, context);

    expect(second).toEqual(first);
    expect(first.effectiveNetGpPerHour).toBeGreaterThanOrEqual(first.baseEffectiveNetGpPerHour);
    expect(first.changedRows).toBe(Object.keys(first.prefs).length);
  });

  it("sorts drop-table text and numeric columns without mutating source order", async () => {
    const presentation = await fixture();
    const sourceIds = presentation.actionableRows.map((row) => row.rowId);

    expect(
      sortLootTableRows(presentation.actionableRows, DEFAULT_LOOT_TABLE_SORT_STATE).map(
        (row) => row.rowId
      )
    ).toEqual(sourceIds);

    const dropSort = nextLootTableSortState(DEFAULT_LOOT_TABLE_SORT_STATE, "drop");
    expect(dropSort).toEqual({ key: "drop", direction: "asc" });
    const dropNames = sortLootTableRows(presentation.actionableRows, dropSort).map(
      (row) => row.name
    );
    expect(dropNames).toEqual(
      [...dropNames].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
      )
    );

    const numericCases = [
      [
        "deltaPerHour",
        (row: (typeof presentation.actionableRows)[number]) => row.selectedDeltaNetGpPerHour
      ],
      ["evPerKill", (row: (typeof presentation.actionableRows)[number]) => row.effectiveEvGp],
      ["chance", (row: (typeof presentation.actionableRows)[number]) => row.chance],
      ["quantity", (row: (typeof presentation.actionableRows)[number]) => row.qtyAvg],
      ["price", (row: (typeof presentation.actionableRows)[number]) => row.price]
    ] as const;
    for (const [key, value] of numericCases) {
      const sorted = sortLootTableRows(presentation.actionableRows, {
        key,
        direction: "desc"
      });
      expect(sorted.map(value)).toEqual([...sorted.map(value)].sort((left, right) => right - left));
    }

    expect(nextLootTableSortState(dropSort, "drop")).toEqual({
      key: "drop",
      direction: "desc"
    });
    expect(presentation.actionableRows.map((row) => row.rowId)).toEqual(sourceIds);
  });

  it("sorts expanded nested loot rows while keeping unavailable values last", async () => {
    const presentation = await fixture();
    const parent = presentation.actionableRows.find((row) => row.expandedRows.length > 1);
    expect(parent).toBeDefined();
    const rows = [
      ...parent!.expandedRows,
      { ...parent!.expandedRows[0]!, label: "Unavailable test row", price: null }
    ];
    const sourceLabels = rows.map((row) => row.label);

    expect(
      sortLootNestedTableRows(rows, DEFAULT_LOOT_NESTED_TABLE_SORT_STATE).map((row) => row.label)
    ).toEqual(sourceLabels);

    const childSort = nextLootNestedTableSortState(DEFAULT_LOOT_NESTED_TABLE_SORT_STATE, "child");
    const childLabels = sortLootNestedTableRows(rows, childSort).map((row) => row.label);
    expect(childLabels).toEqual(
      [...childLabels].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
      )
    );

    const priceRows = sortLootNestedTableRows(rows, {
      key: "price",
      direction: "desc"
    });
    const availablePrices = priceRows
      .map((row) => row.price)
      .filter((value): value is number => value !== null);
    expect(availablePrices).toEqual([...availablePrices].sort((left, right) => right - left));
    expect(priceRows.findIndex((row) => row.price === null)).toBeGreaterThanOrEqual(
      availablePrices.length
    );
    expect(nextLootNestedTableSortState(childSort, "child")).toEqual({
      key: "child",
      direction: "desc"
    });
    expect(rows.map((row) => row.label)).toEqual(sourceLabels);
  });

  it("disambiguates repeated Coins rows before sorting while preserving exact row ids and math", () => {
    const { context } = createGeneratedRuntimeContext();
    const form = { ...DEFAULT_FORM_STATE, monsterId: "hobgoblin_armed" };
    const request = formToSimulationRequest(form, context.gameData);
    const fullInput = createFullSimulationInput(form, request, {}, {});
    const baseline = simulateFullSimulation(fullInput, context);
    const baselinePresentation = createLootPresentationViewModel({
      form,
      context,
      tripInput: { ...fullInput, combat: baseline.combat },
      trip: baseline.trip,
      lootPrefs: {}
    });
    const coins = baselinePresentation.actionableRows.filter((row) => row.key === "coins");

    expect(coins).toHaveLength(7);
    expect(new Set(coins.map((row) => row.rowId)).size).toBe(7);
    expect(coins.map((row) => row.name)).toEqual([
      "Coins — qty 15.0 · chance 26.56%",
      "Coins — qty 5.0 · chance 9.38%",
      "Coins — qty 28.0 · chance 3.13%",
      "Coins — qty 62.0 · chance 3.13%",
      "Coins — qty 42.0 · chance 2.34%",
      "Coins — qty 1.0 · chance 2.34%",
      "Coins — qty 1.0 · chance 0.78%"
    ]);
    expect(new Set(coins.map((row) => row.name)).size).toBe(7);
    const labelsById = new Map(coins.map((row) => [row.rowId, row.name]));
    for (const row of sortLootTableRows(baselinePresentation.actionableRows, {
      key: "drop",
      direction: "desc"
    }).filter((candidate) => candidate.key === "coins")) {
      expect(row.name).toBe(labelsById.get(row.rowId));
    }

    const selectedRow = coins[0]!;
    const prefs = { [selectedRow.rowId]: "skip" as const };
    const changed = simulateFullSimulation({ ...fullInput, lootPrefs: prefs }, context);
    const changedPresentation = createLootPresentationViewModel({
      form,
      context,
      tripInput: { ...fullInput, combat: changed.combat },
      trip: changed.trip,
      lootPrefs: prefs
    });
    const changedCoins = changedPresentation.actionableRows.filter((row) => row.key === "coins");

    expect(changedCoins.find((row) => row.rowId === selectedRow.rowId)?.pref).toBe("skip");
    expect(changedCoins.find((row) => row.rowId !== selectedRow.rowId)?.pref).toBe("loot");
    expect(changed.trip.gpPerKill).toBeCloseTo(baseline.trip.gpPerKill - selectedRow.evGp, 10);
    expect(changedCoins.map((row) => row.price)).toEqual(coins.map((row) => row.price));
  });
});

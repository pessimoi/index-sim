import type { ScheduledStaticPriceSnapshotStatus } from "../adapters/market";
import { MARKET_SOURCE_MAPPINGS } from "../data/market-source-mapping";
import {
  DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
  MANUAL_PRICE_OVERRIDES_MAX_ITEMS,
  setManualPriceOverride
} from "../app/state/manual-price-overrides";
import {
  appendAcceptedPriceSetToHistory,
  DEFAULT_PRICE_HISTORY_STATE,
  priceHistorySnapshotKey,
  type BrowserPriceHistoryState,
  type PriceHistoryMoverSortKey
} from "../app/state/price-history";
import {
  createCurrentPriceNoticePresentation,
  createEconomyHistoryPresentation,
  createManualPriceEditorPresentation,
  createPriceHistorySources,
  createPriceHistorySummaryPresentation,
  createPriceSetPresentation,
  createSelectedPriceItemPresentation,
  economyAriaSort,
  economyMoverTone,
  formatPriceAge,
  summarizeItemPriceMetadata
} from "../app/view-models/price-data";
import type { PriceSet } from "../domain/shared";

function priceSet(overrides: Partial<PriceSet> = {}): PriceSet {
  return {
    id: "fixture-prices",
    label: "Fixture prices",
    source: "manual",
    createdAt: "2026-07-14T12:00:00.000Z",
    itemPrices: { lobster: 205, big_bones: 430 },
    itemPriceMetadata: {
      lobster: {
        valueOrigin: "market-observation",
        refreshStatus: "observed",
        quality: "high",
        sourceId: "markets.lostcity.rs",
        sourceSlug: "lobster",
        valueObservedAt: "2026-07-14T11:55:00.000Z",
        evaluatedAt: "2026-07-14T12:00:00.000Z"
      },
      big_bones: {
        valueOrigin: "generated-object-cost",
        refreshStatus: "not-applicable",
        quality: "fallback",
        reasonCode: "generated-price-fallback"
      }
    },
    alchValues: { lobster: 0, big_bones: 0 },
    ...overrides
  };
}

function scheduledStatus(sharedPrice = 190): ScheduledStaticPriceSnapshotStatus {
  const scheduled = priceSet({
    id: "scheduled-prices",
    label: "Scheduled prices",
    source: "scraped",
    createdAt: "2026-07-14T11:00:00.000Z",
    itemPrices: { lobster: 200, big_bones: 420 }
  });
  return {
    status: "loaded",
    reason: "Scheduled snapshot loaded",
    scheduledPriceSet: scheduled,
    fallbackPriceSet: null,
    files: {
      prices: "loaded",
      priceProvenance: "loaded",
      alch: "loaded",
      priceHistory: "loaded"
    },
    itemCount: 2,
    alchCount: 2,
    latestHistoryAt: "2026-07-14T11:00:00.000Z",
    sharedPriceHistory: {
      version: 2,
      snapshots: [
        {
          t: Date.parse("2026-07-14T11:00:00.000Z") / 1000,
          kind: "legacy-unknown",
          prices: { lobster: sharedPrice, big_bones: 420 },
          evaluations: {}
        }
      ]
    },
    warnings: []
  };
}

function localHistory(
  snapshots: Array<{
    id: string;
    label: string;
    capturedAt: string;
    prices: Record<string, number>;
  }>
): BrowserPriceHistoryState {
  return snapshots.reduce(
    (history, snapshot) =>
      appendAcceptedPriceSetToHistory(
        history,
        priceSet({
          id: snapshot.id,
          label: snapshot.label,
          createdAt: snapshot.capturedAt,
          itemPrices: snapshot.prices,
          itemPriceMetadata: undefined,
          alchValues: {}
        }),
        new Date(snapshot.capturedAt)
      ),
    DEFAULT_PRICE_HISTORY_STATE
  );
}

describe("price-data view model", () => {
  it("classifies active issues separately from advisory and row-local price notes", () => {
    const presentation = createCurrentPriceNoticePresentation({
      warnings: [
        {
          code: "price-generated-fallback",
          severity: "warning",
          message: "technical generated message",
          itemId: "bronze_longsword",
          priceContext: {
            consumer: "loot",
            affectsCurrentResult: true,
            lootRowId: "bronze-row"
          }
        },
        {
          code: "missing-price",
          severity: "warning",
          message: "technical missing message",
          itemId: "vial_water",
          priceContext: { consumer: "supply", affectsCurrentResult: true }
        },
        {
          code: "price-generated-fallback",
          severity: "warning",
          message: "technical inactive message",
          itemId: "bones",
          priceContext: {
            consumer: "loot",
            affectsCurrentResult: false,
            lootRowId: "bones-row"
          }
        }
      ],
      gameData: {
        items: {
          bronze_longsword: { id: "bronze_longsword", name: "Bronze longsword" },
          vial_water: { id: "vial_water", name: "Vial of water" },
          bones: { id: "bones", name: "Bones" }
        }
      },
      lootBreakdown: [
        { rowId: "bronze-row", name: "Bronze longsword" },
        { rowId: "bones-row", name: "Bones" }
      ]
    });

    expect(presentation.issues).toEqual([
      expect.objectContaining({
        code: "missing-price",
        itemLabel: "Vial of water",
        summary: "Missing price",
        consumer: "supply"
      })
    ]);
    expect(presentation.issues[0]?.itemDisplayLabel).toEqual({
      name: "Vial of water",
      technicalId: "vial_water",
      source: "game-data"
    });
    expect(presentation.notes).toEqual([
      expect.objectContaining({
        code: "price-generated-fallback",
        itemLabel: "Bronze longsword",
        summary: "Estimated price"
      })
    ]);
    expect(presentation.all.map((notice) => notice.itemLabel)).toEqual([
      "Vial of water",
      "Bronze longsword"
    ]);
    expect(presentation.byLootRowId["bones-row"]).toEqual([
      expect.objectContaining({ itemLabel: "Bones", affectsCurrentResult: false })
    ]);
    expect(presentation.all.map((notice) => notice.detail).join(" ")).not.toContain(
      "bronze_longsword"
    );
  });

  it("derives stable exact-item correction and inspection actions from editable ids", () => {
    const warnings = [
      "price-fallback-used",
      "price-generated-fallback",
      "price-market-retained",
      "price-freshness-unknown",
      "price-alias-used",
      "approximate-data-source"
    ].map((code, index) => ({
      code,
      severity: "warning" as const,
      message: `${code} fixture`,
      itemId: `item_${index}`,
      priceContext: { consumer: "loot" as const, affectsCurrentResult: true }
    }));
    const input = {
      warnings: [
        ...warnings,
        {
          code: "missing-alch-value",
          severity: "warning" as const,
          message: "missing alch fixture",
          itemId: "alch_item",
          priceContext: { consumer: "loot" as const, affectsCurrentResult: true }
        },
        {
          code: "unidentified-herb-price-approximation",
          severity: "warning" as const,
          message: "itemless fixture",
          priceContext: { consumer: "loot" as const, affectsCurrentResult: true }
        }
      ],
      gameData: {
        items: Object.fromEntries([
          ...warnings.map((warning) => [
            warning.itemId,
            { id: warning.itemId, name: warning.itemId }
          ]),
          ["alch_item", { id: "alch_item", name: "Alch item" }]
        ])
      },
      lootBreakdown: []
    };
    const editable = new Set(warnings.map((warning) => warning.itemId));
    const presentation = createCurrentPriceNoticePresentation({
      ...input,
      editableItemIds: editable
    });

    expect(
      presentation.all
        .filter((notice) => notice.itemId?.startsWith("item_"))
        .map((notice) => notice.action)
    ).toEqual(
      expect.arrayContaining(
        warnings.map((warning) =>
          expect.objectContaining({
            kind: "correct-price",
            itemId: warning.itemId,
            label: "Correct price"
          })
        )
      )
    );
    expect(presentation.all.find((notice) => notice.itemId === "alch_item")?.action).toMatchObject({
      kind: "inspect-item",
      itemId: "alch_item",
      label: "Inspect item"
    });
    expect(
      presentation.all.find((notice) => notice.code === "unidentified-herb-price-approximation")
        ?.action
    ).toBeUndefined();
    expect(presentation.all[0]?.noticeId).toBe(
      `${presentation.all[0]?.code}:${presentation.all[0]?.itemId}:${presentation.all[0]?.consumer}:`
    );

    const noLongerEditable = createCurrentPriceNoticePresentation({
      ...input,
      editableItemIds: new Set()
    });
    expect(noLongerEditable.all.find((notice) => notice.itemId === "item_0")?.action).toMatchObject(
      { kind: "inspect-item", itemId: "item_0" }
    );
  });

  it("offers one direct Result action but keeps aggregate review for multiple issues", () => {
    const warning = (itemId: string) => ({
      code: "price-fallback-used",
      severity: "warning" as const,
      message: `fallback ${itemId}`,
      itemId,
      priceContext: { consumer: "supply" as const, affectsCurrentResult: true }
    });
    const common = {
      gameData: {
        items: {
          lobster: { id: "lobster", name: "Lobster" },
          swordfish: { id: "swordfish", name: "Swordfish" }
        }
      },
      lootBreakdown: [],
      editableItemIds: new Set(["lobster", "swordfish"])
    };
    const one = createCurrentPriceNoticePresentation({
      ...common,
      warnings: [warning("lobster")]
    });
    const multiple = createCurrentPriceNoticePresentation({
      ...common,
      warnings: [warning("lobster"), warning("swordfish")]
    });

    expect(one.resultAction).toMatchObject({ kind: "correct-price", itemId: "lobster" });
    expect(multiple.resultAction).toBeNull();
  });

  it("presents active, scheduled and reset price-set ownership without UI dependencies", () => {
    const bundled = priceSet({ id: "bundled-prices", source: "bundled" });
    const selected = priceSet();
    const presentation = createPriceSetPresentation({
      activePriceSet: selected,
      bundledPriceSet: bundled,
      scheduledSnapshotStatus: scheduledStatus(),
      activePriceSetOrigin: "selected",
      priceLabel: "Fallback label",
      activeManualPriceOverrideCount: 2,
      ageNow: new Date("2026-07-14T13:01:00.000Z")
    });

    expect(presentation.active).toMatchObject({
      available: true,
      sourceLabel: "Manual item overrides (2)",
      label: "Fixture prices",
      ageLabel: "1 hr",
      ageAccessibleLabel: "1 hour",
      itemCount: 2,
      alchCount: 2,
      metadata: { observedHigh: 1, generatedFallback: 1 }
    });
    expect(presentation.scheduled).toMatchObject({
      ready: true,
      label: "Scheduled prices",
      ageLabel: "2 hr",
      itemCount: 2
    });
    expect(presentation.reset).toMatchObject({
      fallbackOrigin: "scheduled",
      fallbackLabel: "scheduled prices",
      canReset: true
    });
    expect(presentation.reset.fallbackPriceSet?.id).toBe("scheduled-prices");
  });

  it("preserves empty/loading and bundled fallback status, warnings and metadata buckets", () => {
    const bundled = priceSet({ id: "bundled-prices", source: "bundled" });
    const fallbackStatus: ScheduledStaticPriceSnapshotStatus = {
      ...scheduledStatus(),
      status: "fallback",
      reason: "Scheduled snapshot is invalid.",
      scheduledPriceSet: null,
      fallbackPriceSet: bundled,
      warnings: ["Using last known bundled values."]
    };
    const empty = createPriceSetPresentation({
      activePriceSet: null,
      bundledPriceSet: bundled,
      scheduledSnapshotStatus: null,
      activePriceSetOrigin: "bundled",
      priceLabel: "Fallback label",
      activeManualPriceOverrideCount: 0,
      ageNow: new Date("2026-07-14T13:00:00.000Z")
    });
    const fallback = createPriceSetPresentation({
      activePriceSet: bundled,
      bundledPriceSet: bundled,
      scheduledSnapshotStatus: fallbackStatus,
      activePriceSetOrigin: "bundled",
      priceLabel: "Fallback label",
      activeManualPriceOverrideCount: 0,
      ageNow: new Date("2026-07-14T13:00:00.000Z")
    });
    const metadata = summarizeItemPriceMetadata({
      ...bundled,
      itemPrices: {
        observed_high: 1,
        observed_medium: 2,
        observed_low: 3,
        retained: 4,
        generated: 5,
        manual: 6,
        imported: 7
      },
      itemPriceMetadata: {
        observed_high: {
          valueOrigin: "market-observation",
          refreshStatus: "observed",
          quality: "high"
        },
        observed_medium: {
          valueOrigin: "market-observation",
          refreshStatus: "observed",
          quality: "medium"
        },
        observed_low: {
          valueOrigin: "market-observation",
          refreshStatus: "observed",
          quality: "low"
        },
        retained: {
          valueOrigin: "market-observation",
          refreshStatus: "retained",
          quality: "medium"
        },
        generated: {
          valueOrigin: "generated-object-cost",
          refreshStatus: "not-applicable",
          quality: "fallback"
        },
        manual: {
          valueOrigin: "manual",
          refreshStatus: "not-evaluated",
          quality: "unknown"
        },
        imported: {
          valueOrigin: "imported",
          refreshStatus: "not-evaluated",
          quality: "unknown"
        }
      }
    });

    expect(empty).toMatchObject({
      active: { available: false, label: "Fallback label", ageLabel: "-" },
      scheduled: { ready: false, statusLabel: "Loading", tone: "neutral" },
      reset: { fallbackOrigin: "bundled", canReset: false }
    });
    expect(fallback.scheduled).toMatchObject({
      ready: false,
      statusLabel: "Fallback",
      tone: "warning",
      message: "Scheduled snapshot is invalid. Using last known bundled values."
    });
    expect(metadata).toMatchObject({
      observedHigh: 1,
      observedMedium: 2,
      observedLow: 1,
      retained: 1,
      generatedFallback: 1,
      manual: 1,
      unknown: 1,
      missingMapped: MARKET_SOURCE_MAPPINGS.filter((mapping) => mapping.syncPrice).length
    });
  });

  it("keeps manual override selection, ordering and active/inactive counts deterministic", () => {
    let manual = setManualPriceOverride(
      DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
      "lobster",
      999,
      new Date("2026-07-14T12:30:00.000Z")
    );
    manual = setManualPriceOverride(
      manual,
      "unavailable_item",
      123,
      new Date("2026-07-14T12:31:00.000Z")
    );
    const presentation = createManualPriceEditorPresentation({
      activePriceSet: priceSet({ itemPrices: { lobster: 999, big_bones: 430 } }),
      basePriceSet: priceSet(),
      itemLabels: { lobster: "Lobster", big_bones: "Big bones" },
      manualPriceOverrides: manual,
      selectedItemId: "lobster",
      draft: null
    });

    expect(presentation.itemOptions.map((option) => option.label)).toEqual([
      "Big bones",
      "Lobster"
    ]);
    expect(presentation.itemOptions[1]?.displayLabel).toEqual({
      name: "Lobster",
      technicalId: "lobster",
      source: "game-data"
    });
    expect(presentation).toMatchObject({
      itemId: "lobster",
      itemLabel: "Lobster",
      basePrice: 205,
      activePrice: 999,
      inputValue: 999,
      storedCount: 2,
      activeCount: 1,
      inactiveCount: 1,
      canApply: true
    });
    expect(presentation.selectedOverride?.updatedAt).toBe("2026-07-14T12:30:00.000Z");
  });

  it("disables a new manual override at the storage cap without blocking an existing row", () => {
    const items = Object.fromEntries(
      Array.from({ length: MANUAL_PRICE_OVERRIDES_MAX_ITEMS }, (_, index) => [
        `stored_${index}`,
        { price: index, updatedAt: "2026-07-14T12:00:00.000Z" }
      ])
    );
    const base = priceSet({
      itemPrices: { new_item: 10, stored_0: 0 },
      itemPriceMetadata: undefined,
      alchValues: {}
    });
    const atCapacity = createManualPriceEditorPresentation({
      activePriceSet: base,
      basePriceSet: base,
      itemLabels: { new_item: "New item", stored_0: "Stored item" },
      manualPriceOverrides: { items },
      selectedItemId: "new_item",
      draft: 11
    });
    const existing = createManualPriceEditorPresentation({
      activePriceSet: base,
      basePriceSet: base,
      itemLabels: { new_item: "New item", stored_0: "Stored item" },
      manualPriceOverrides: { items },
      selectedItemId: "stored_0",
      draft: 1
    });

    expect(atCapacity).toMatchObject({ atCapacity: true, canApply: false });
    expect(existing).toMatchObject({ atCapacity: false, canApply: true });
  });

  it("merges shared and local history for movers, trends, loot context and summaries", () => {
    const active = priceSet();
    const local = appendAcceptedPriceSetToHistory(
      DEFAULT_PRICE_HISTORY_STATE,
      active,
      new Date("2026-07-14T12:00:00.000Z")
    );
    const sources = createPriceHistorySources({
      scheduledSnapshotStatus: scheduledStatus(190),
      localPriceHistory: local
    });
    const history = createEconomyHistoryPresentation({
      sources,
      itemLabels: { lobster: "Lobster", big_bones: "Big bones" },
      controls: {
        baselineMode: "previous",
        snapshotKey: "missing-snapshot",
        itemFilter: "lob",
        trendItemId: "lobster",
        sort: { key: "gpDelta", direction: "desc" }
      }
    });
    const summary = createPriceHistorySummaryPresentation({
      analysisState: sources.analysisState,
      activePriceSet: active,
      evaluatedAt: new Date("2026-07-14T12:01:30.000Z")
    });

    expect(sources).toMatchObject({
      sharedSnapshotCount: 1,
      localSnapshotCount: 1,
      sourceStatus: "shared + local"
    });
    expect(history.snapshotOptions).toHaveLength(2);
    expect(history.effectiveSnapshotKey).toBe(history.snapshotOptions[0]?.id);
    expect(history.movers.rows).toEqual([
      expect.objectContaining({
        itemId: "lobster",
        latestPrice: 205,
        baselinePrice: 190,
        gpDelta: 15
      })
    ]);
    expect(history.trend.points.map((point) => point.price)).toEqual([190, 205]);
    expect(history.itemDisplayLabels.lobster).toEqual({
      name: "Lobster",
      technicalId: "lobster",
      source: "game-data"
    });
    expect(history.lootHistoryByItem.lobster).toMatchObject({
      itemLabel: "Lobster",
      latestPrice: 205,
      baselinePrice: 190,
      gpDelta: 15
    });
    expect(summary).toMatchObject({
      snapshotCount: 2,
      trackedItemCount: 2,
      latestAgeSeconds: 90,
      latestAgeLabel: "1 min",
      activeMatchesLatest: true
    });
  });

  it("classifies empty, shared-only and local-only history without hidden reads", () => {
    const local = localHistory([
      {
        id: "local",
        label: "Local",
        capturedAt: "2026-07-14T12:00:00.000Z",
        prices: { lobster: 205 }
      }
    ]);

    expect(
      createPriceHistorySources({
        scheduledSnapshotStatus: null,
        localPriceHistory: DEFAULT_PRICE_HISTORY_STATE
      }).sourceStatus
    ).toBe("empty");
    expect(
      createPriceHistorySources({
        scheduledSnapshotStatus: scheduledStatus(),
        localPriceHistory: DEFAULT_PRICE_HISTORY_STATE
      })
    ).toMatchObject({ sourceStatus: "shared", sharedSnapshotCount: 1, localSnapshotCount: 0 });
    expect(
      createPriceHistorySources({ scheduledSnapshotStatus: null, localPriceHistory: local })
    ).toMatchObject({ sourceStatus: "local", sharedSnapshotCount: 0, localSnapshotCount: 1 });
  });

  it("preserves previous, first and explicit-snapshot baselines", () => {
    const sources = createPriceHistorySources({
      scheduledSnapshotStatus: null,
      localPriceHistory: localHistory([
        {
          id: "first",
          label: "First",
          capturedAt: "2026-07-14T10:00:00.000Z",
          prices: { lobster: 100 }
        },
        {
          id: "middle",
          label: "Middle",
          capturedAt: "2026-07-14T11:00:00.000Z",
          prices: { lobster: 150 }
        },
        {
          id: "latest",
          label: "Latest",
          capturedAt: "2026-07-14T12:00:00.000Z",
          prices: { lobster: 210 }
        }
      ])
    });
    const controls = {
      snapshotKey: "",
      itemFilter: "",
      trendItemId: "lobster",
      sort: { key: "gpDelta" as const, direction: "desc" as const }
    };
    const previous = createEconomyHistoryPresentation({
      sources,
      itemLabels: { lobster: "Lobster" },
      controls: { ...controls, baselineMode: "previous" }
    });
    const first = createEconomyHistoryPresentation({
      sources,
      itemLabels: { lobster: "Lobster" },
      controls: { ...controls, baselineMode: "first" }
    });
    const middleKey = priceHistorySnapshotKey(sources.analysisState.snapshots[1]!);
    const explicit = createEconomyHistoryPresentation({
      sources,
      itemLabels: { lobster: "Lobster" },
      controls: { ...controls, baselineMode: "snapshot", snapshotKey: middleKey }
    });

    expect(previous.movers.rows[0]).toMatchObject({ baselinePrice: 150, gpDelta: 60 });
    expect(first.movers.rows[0]).toMatchObject({ baselinePrice: 100, gpDelta: 110 });
    expect(explicit.movers.rows[0]).toMatchObject({ baselinePrice: 150, gpDelta: 60 });
  });

  it("preserves all mover sort keys, directions and null/zero delta handling", () => {
    const sources = createPriceHistorySources({
      scheduledSnapshotStatus: null,
      localPriceHistory: localHistory([
        {
          id: "baseline",
          label: "Baseline",
          capturedAt: "2026-07-14T10:00:00.000Z",
          prices: { alpha: 200, beta: 100, gamma: 0 }
        },
        {
          id: "latest",
          label: "Latest",
          capturedAt: "2026-07-14T12:00:00.000Z",
          prices: { alpha: 100, beta: 300, gamma: 0 }
        }
      ])
    });
    const itemLabels = { alpha: "Alpha", beta: "Beta", gamma: "Gamma" };
    const expectations: Record<PriceHistoryMoverSortKey, { asc: string[]; desc: string[] }> = {
      item: { asc: ["alpha", "beta", "gamma"], desc: ["gamma", "beta", "alpha"] },
      latestPrice: { asc: ["gamma", "alpha", "beta"], desc: ["beta", "alpha", "gamma"] },
      baselinePrice: { asc: ["gamma", "beta", "alpha"], desc: ["alpha", "beta", "gamma"] },
      gpDelta: { asc: ["alpha", "gamma", "beta"], desc: ["beta", "gamma", "alpha"] },
      percentDelta: { asc: ["alpha", "beta", "gamma"], desc: ["beta", "alpha", "gamma"] }
    };

    for (const [key, expected] of Object.entries(expectations) as Array<
      [PriceHistoryMoverSortKey, { asc: string[]; desc: string[] }]
    >) {
      for (const direction of ["asc", "desc"] as const) {
        const presentation = createEconomyHistoryPresentation({
          sources,
          itemLabels,
          controls: {
            baselineMode: "previous",
            snapshotKey: "",
            itemFilter: "",
            trendItemId: "alpha",
            sort: { key, direction }
          }
        });
        expect(presentation.movers.rows.map((row) => row.itemId)).toEqual(expected[direction]);
      }
    }
    const zero = createEconomyHistoryPresentation({
      sources,
      itemLabels,
      controls: {
        baselineMode: "previous",
        snapshotKey: "",
        itemFilter: "gamma",
        trendItemId: "gamma",
        sort: { key: "gpDelta", direction: "desc" }
      }
    }).movers.rows[0];
    expect(zero).toMatchObject({ latestPrice: 0, baselinePrice: 0, gpDelta: 0 });
    expect(zero?.percentDelta).toBeNull();

    const missingSources = createPriceHistorySources({
      scheduledSnapshotStatus: null,
      localPriceHistory: localHistory([
        {
          id: "baseline-missing",
          label: "Baseline missing",
          capturedAt: "2026-07-14T10:00:00.000Z",
          prices: { baseline_only: 50 }
        },
        {
          id: "latest-missing",
          label: "Latest missing",
          capturedAt: "2026-07-14T12:00:00.000Z",
          prices: { latest_only: 75 }
        }
      ])
    });
    const missingPresentation = createEconomyHistoryPresentation({
      sources: missingSources,
      itemLabels: {},
      controls: {
        baselineMode: "previous",
        snapshotKey: "",
        itemFilter: "",
        trendItemId: "latest_only",
        sort: { key: "item", direction: "asc" }
      }
    });
    const missingRows = missingPresentation.movers.rows;
    expect(missingRows).toEqual([
      expect.objectContaining({ itemId: "baseline_only", latestPrice: null, gpDelta: null }),
      expect.objectContaining({ itemId: "latest_only", baselinePrice: null, gpDelta: null })
    ]);
    expect(missingPresentation.itemDisplayLabels.latest_only).toEqual({
      name: "Latest only",
      technicalId: "latest_only",
      source: "fallback"
    });
    expect(missingPresentation.trendItemOptions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "latest_only", label: "Latest only" })])
    );
  });

  it("derives selected provenance freshness and compact formatter semantics", () => {
    const selected = createSelectedPriceItemPresentation({
      activePriceSet: priceSet(),
      itemId: "lobster",
      itemLabels: { lobster: "Lobster" },
      freshnessNow: new Date("2026-07-14T13:00:00.000Z")
    });

    expect(selected).toMatchObject({
      itemId: "lobster",
      price: 205,
      freshness: "observed-current",
      metadata: { valueOrigin: "market-observation", quality: "high" }
    });
    expect(selected.itemDisplayLabel).toEqual({
      name: "Lobster",
      technicalId: "lobster",
      source: "game-data"
    });
    expect(formatPriceAge(null)).toBe("-");
    expect(formatPriceAge(59)).toBe("<1 min");
    expect(formatPriceAge(86_400)).toBe("1 day");
    expect(economyAriaSort({ key: "gpDelta", direction: "desc" }, "gpDelta")).toBe("descending");
    expect(economyMoverTone({ gpDelta: 1 })).toBe("gain");
    expect(economyMoverTone({ gpDelta: -1 })).toBe("loss");
    expect(economyMoverTone({ gpDelta: 0 })).toBeUndefined();
  });
});

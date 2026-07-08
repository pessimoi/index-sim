import {
  applyMarketSyncResponse,
  formatMarketSyncReportDetails,
  keepMarketSyncFailureContext,
  summarizeMarketSyncReport
} from "../app/state/market-sync";
import { parsePriceSetFileText } from "../adapters/market";
import { createMemoryStorage } from "../adapters/storage";
import {
  analyzePriceHistoryMovers,
  appendAcceptedPriceSetToHistory,
  BrowserPriceHistoryStateSchema,
  DEFAULT_PRICE_HISTORY_STATE,
  keepPriceHistoryOnFailure,
  PRICE_HISTORY_MAX_SNAPSHOTS,
  PRICE_HISTORY_STORAGE_KEY,
  priceHistorySnapshotKey,
  summarizePriceHistory
} from "../app/state/price-history";
import {
  clearSelectedPriceSet,
  loadSelectedPriceSet,
  saveSelectedPriceSet,
  SELECTED_PRICE_SET_STORAGE_KEY,
  SELECTED_PRICE_SET_VERSION
} from "../app/state/selected-price-set";
import { PRICE_SET_IMPORT_MAX_BYTES, PriceSetValidationError } from "../data/schemas";
import type { MarketSyncResponse, PriceSet, SimulationContext } from "../domain/shared";

function fixtureContext(): SimulationContext {
  return {
    gameData: {
      id: "fixture",
      label: "Fixture",
      items: {},
      monsters: {},
      weapons: {},
      ammo: {},
      spells: {},
      equipment: {
        helm: {},
        amulet: {},
        body: {},
        legs: {},
        shield: {},
        gloves: {},
        boots: {},
        cape: {},
        ring: {}
      }
    },
    priceSet: {
      id: "base",
      label: "Base prices",
      source: "bundled",
      createdAt: "2026-07-05",
      itemPrices: { lobster: 200 },
      alchValues: {}
    }
  };
}

const syncResponse: MarketSyncResponse = {
  priceSet: {
    id: "synced",
    label: "Synced prices",
    source: "scraped",
    createdAt: "2026-07-05T12:00:00.000Z",
    itemPrices: { lobster: 210 },
    alchValues: { lobster: 0 }
  },
  report: {
    requested: 1,
    updated: 1,
    skipped: 0,
    failed: 0,
    startedAt: "2026-07-05T12:00:00.000Z",
    finishedAt: "2026-07-05T12:00:00.000Z",
    source: { id: "markets.lostcity.rs", label: "Mock market" },
    items: [{ itemId: "lobster", status: "updated", price: 210 }],
    warnings: []
  }
};

function importedPriceSet(id = "manual-prices"): PriceSet {
  return parsePriceSetFileText(
    JSON.stringify({
      id,
      label: "Manual prices",
      source: "manual",
      createdAt: "2026-07-05T13:00:00.000Z",
      itemPrices: { lobster: 205, big_bones: 430 },
      alchValues: { lobster: 0, big_bones: 0 }
    })
  );
}

describe("market sync UI state helpers", () => {
  it("successful sync swaps the selected PriceSet", () => {
    const context = fixtureContext();
    const next = applyMarketSyncResponse(context, syncResponse);

    expect(next.priceSet.id).toBe("synced");
    expect(next.priceSet.itemPrices.lobster).toBe(210);
    expect(context.priceSet.id).toBe("base");
  });

  it("failure keeps the current PriceSet reference", () => {
    const context = fixtureContext();

    expect(keepMarketSyncFailureContext(context)).toBe(context);
  });

  it("summarizes partial failure reports", () => {
    expect(
      summarizeMarketSyncReport({
        ...syncResponse.report,
        updated: 2,
        skipped: 1,
        failed: 1
      })
    ).toBe("2 updated · 1 skipped · 1 failed");
  });

  it("formats partial failure report item diagnostics with failed rows first", () => {
    const details = formatMarketSyncReportDetails(
      {
        ...syncResponse.report,
        requested: 3,
        updated: 1,
        skipped: 1,
        failed: 1,
        items: [
          {
            itemId: "big_bones",
            sourceSlug: "big_bones",
            status: "updated",
            price: 430,
            alchValue: 0,
            sampleSize: 3
          },
          {
            itemId: "lobster",
            sourceSlug: "lobster",
            status: "failed",
            reason:
              "Mock upstream timeout while reading /Users/example/private-market-dump.json with a very long diagnostic that should be shortened before it reaches the UI surface."
          },
          {
            itemId: "rune_scimitar",
            sourceSlug: "rune_scimitar",
            status: "skipped",
            reason: "No recent samples"
          }
        ],
        warnings: [
          {
            code: "partial-market-sync",
            severity: "warning",
            message: "One mocked item failed; successful prices remain usable",
            itemId: "lobster"
          }
        ]
      },
      {
        itemLabel: (itemId) =>
          itemId === "big_bones"
            ? "Big bones"
            : itemId === "lobster"
              ? "Lobster"
              : undefined
      }
    );

    expect(details.counts).toEqual({ all: 3, updated: 1, skipped: 1, failed: 1 });
    expect(details.items.map((item) => item.status)).toEqual(["failed", "skipped", "updated"]);
    expect(details.items[0]).toMatchObject({
      itemId: "lobster",
      itemLabel: "Lobster",
      sourceSlug: "lobster",
      priceLabel: "-",
      alchValueLabel: "-",
      reason: expect.stringContaining("[path]")
    });
    expect(details.items[0].reason).not.toContain("/Users/example");
    expect(details.items[2]).toMatchObject({
      itemId: "big_bones",
      itemLabel: "Big bones",
      priceLabel: "430",
      alchValueLabel: "0",
      sampleSizeLabel: "3"
    });
    expect(details.warnings).toEqual([
      {
        id: "partial-market-sync:lobster",
        severity: "warning",
        message: "One mocked item failed; successful prices remain usable",
        itemId: "lobster"
      }
    ]);
  });

  it("filters market report details by item status", () => {
    const details = formatMarketSyncReportDetails(
      {
        ...syncResponse.report,
        requested: 2,
        updated: 1,
        skipped: 0,
        failed: 1,
        items: [
          { itemId: "big_bones", sourceSlug: "big_bones", status: "updated", price: 430 },
          {
            itemId: "lobster",
            sourceSlug: "lobster",
            status: "failed",
            reason: "Mock upstream timeout"
          }
        ]
      },
      { filter: "failed" }
    );

    expect(details.items).toHaveLength(1);
    expect(details.items[0]).toMatchObject({ itemId: "lobster", status: "failed" });
    expect(details.counts).toEqual({ all: 2, updated: 1, skipped: 0, failed: 1 });
  });

  it("accepted imported PriceSet adds a browser-local history snapshot", () => {
    const priceSet = importedPriceSet();
    const history = appendAcceptedPriceSetToHistory(
      DEFAULT_PRICE_HISTORY_STATE,
      priceSet,
      new Date("2026-07-05T13:01:00.000Z")
    );
    const summary = summarizePriceHistory(history, priceSet, new Date("2026-07-05T13:02:30.000Z"));

    expect(history.snapshots).toHaveLength(1);
    expect(history.snapshots[0]).toMatchObject({
      capturedAt: "2026-07-05T13:01:00.000Z",
      sourcePriceSetId: "manual-prices",
      label: "Manual prices",
      itemPrices: { big_bones: 430, lobster: 205 }
    });
    expect(summary).toMatchObject({
      snapshotCount: 1,
      trackedItemCount: 2,
      latestAgeSeconds: 90,
      activeLabel: "Manual prices",
      latestLabel: "Manual prices",
      activeMatchesLatest: true
    });
  });

  it("accepted market sync PriceSet adds a browser-local history snapshot", () => {
    const history = appendAcceptedPriceSetToHistory(
      DEFAULT_PRICE_HISTORY_STATE,
      syncResponse.priceSet,
      new Date("2026-07-05T12:00:06.000Z")
    );

    expect(history.snapshots[0]).toMatchObject({
      capturedAt: "2026-07-05T12:00:06.000Z",
      sourcePriceSetId: "synced",
      label: "Synced prices",
      itemPrices: { lobster: 210 }
    });
  });

  it("saves and loads the selected active PriceSet envelope", () => {
    const storage = createMemoryStorage();
    const priceSet = importedPriceSet("selected-manual");

    const envelope = saveSelectedPriceSet(storage, priceSet, {
      now: () => new Date("2026-07-05T13:01:00.000Z")
    });
    const loaded = loadSelectedPriceSet(storage);

    expect(envelope).toMatchObject({
      version: SELECTED_PRICE_SET_VERSION,
      savedAt: "2026-07-05T13:01:00.000Z",
      data: {
        selectedAt: "2026-07-05T13:01:00.000Z",
        priceSet: {
          id: "selected-manual",
          label: "Manual prices"
        }
      }
    });
    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.priceSet.id).toBe("selected-manual");
      expect(loaded.value.selectedAt).toBe("2026-07-05T13:01:00.000Z");
    }
  });

  it("classifies invalid selected PriceSet persisted payloads", () => {
    const validData = {
      priceSet: importedPriceSet("valid-selected"),
      selectedAt: "2026-07-05T13:01:00.000Z"
    };
    const invalidJson = createMemoryStorage({
      [SELECTED_PRICE_SET_STORAGE_KEY]: "{"
    });
    const invalidEnvelope = createMemoryStorage({
      [SELECTED_PRICE_SET_STORAGE_KEY]: JSON.stringify({ data: validData })
    });
    const versionMismatch = createMemoryStorage({
      [SELECTED_PRICE_SET_STORAGE_KEY]: JSON.stringify({
        version: SELECTED_PRICE_SET_VERSION + 1,
        savedAt: "2026-07-05T13:01:00.000Z",
        data: validData
      })
    });
    const invalidData = createMemoryStorage({
      [SELECTED_PRICE_SET_STORAGE_KEY]: JSON.stringify({
        version: SELECTED_PRICE_SET_VERSION,
        savedAt: "2026-07-05T13:01:00.000Z",
        data: {
          priceSet: {
            ...validData.priceSet,
            itemPrices: { lobster: -1 }
          },
          selectedAt: "2026-07-05T13:01:00.000Z"
        }
      })
    });
    const oversized = createMemoryStorage({
      [SELECTED_PRICE_SET_STORAGE_KEY]: "x".repeat(PRICE_SET_IMPORT_MAX_BYTES + 1)
    });

    expect(loadSelectedPriceSet(invalidJson)).toMatchObject({
      status: "invalid",
      reason: "invalid_json"
    });
    expect(loadSelectedPriceSet(invalidEnvelope)).toMatchObject({
      status: "invalid",
      reason: "invalid_envelope"
    });
    expect(loadSelectedPriceSet(versionMismatch)).toMatchObject({
      status: "version-mismatch",
      foundVersion: SELECTED_PRICE_SET_VERSION + 1
    });
    expect(loadSelectedPriceSet(invalidData)).toMatchObject({
      status: "invalid",
      reason: "invalid_data"
    });
    expect(loadSelectedPriceSet(oversized)).toMatchObject({
      status: "invalid",
      reason: "body_too_large"
    });
  });

  it("clears only the selected active PriceSet key", () => {
    const historyEnvelope = JSON.stringify({
      version: 1,
      savedAt: "2026-07-05T13:01:00.000Z",
      data: DEFAULT_PRICE_HISTORY_STATE
    });
    const storage = createMemoryStorage({
      [PRICE_HISTORY_STORAGE_KEY]: historyEnvelope
    });
    saveSelectedPriceSet(storage, importedPriceSet("selected-before-reset"), {
      now: () => new Date("2026-07-05T13:01:00.000Z")
    });

    clearSelectedPriceSet(storage);

    expect(storage.getItem(SELECTED_PRICE_SET_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(PRICE_HISTORY_STORAGE_KEY)).toBe(historyEnvelope);
  });

  it("restoring a selected PriceSet does not append a price history snapshot", () => {
    const storage = createMemoryStorage();
    const restoredPriceSet = importedPriceSet("restore-only");
    saveSelectedPriceSet(storage, restoredPriceSet, {
      now: () => new Date("2026-07-05T13:01:00.000Z")
    });

    const loaded = loadSelectedPriceSet(storage);
    const summary = summarizePriceHistory(DEFAULT_PRICE_HISTORY_STATE, restoredPriceSet);

    expect(loaded.status).toBe("loaded");
    expect(summary.snapshotCount).toBe(0);
    expect(DEFAULT_PRICE_HISTORY_STATE.snapshots).toHaveLength(0);
  });

  it("persists selected PriceSets after accepted imports and keeps them on failed imports", () => {
    const storage = createMemoryStorage();
    const originalPriceSet = importedPriceSet("selected-original");
    saveSelectedPriceSet(storage, originalPriceSet, {
      now: () => new Date("2026-07-05T13:01:00.000Z")
    });

    expect(() => parsePriceSetFileText("{")).toThrow(PriceSetValidationError);
    const afterFailedImport = loadSelectedPriceSet(storage);
    expect(afterFailedImport.status).toBe("loaded");
    if (afterFailedImport.status === "loaded") {
      expect(afterFailedImport.value.priceSet.id).toBe("selected-original");
    }

    const acceptedPriceSet = importedPriceSet("selected-after-import");
    saveSelectedPriceSet(storage, acceptedPriceSet, {
      now: () => new Date("2026-07-05T13:02:00.000Z")
    });
    const afterAcceptedImport = loadSelectedPriceSet(storage);
    expect(afterAcceptedImport.status).toBe("loaded");
    if (afterAcceptedImport.status === "loaded") {
      expect(afterAcceptedImport.value.priceSet.id).toBe("selected-after-import");
      expect(afterAcceptedImport.value.selectedAt).toBe("2026-07-05T13:02:00.000Z");
    }
  });

  it("persists selected PriceSets after accepted syncs and keeps them on failed syncs", () => {
    const storage = createMemoryStorage();
    const originalContext = fixtureContext();
    saveSelectedPriceSet(storage, originalContext.priceSet, {
      now: () => new Date("2026-07-05T12:00:00.000Z")
    });

    const syncedContext = applyMarketSyncResponse(originalContext, syncResponse);
    saveSelectedPriceSet(storage, syncedContext.priceSet, {
      now: () => new Date("2026-07-05T12:00:06.000Z")
    });
    const afterAcceptedSync = loadSelectedPriceSet(storage);
    expect(afterAcceptedSync.status).toBe("loaded");
    if (afterAcceptedSync.status === "loaded") {
      expect(afterAcceptedSync.value.priceSet.id).toBe("synced");
    }

    const failedContext = keepMarketSyncFailureContext(syncedContext);
    const afterFailedSync = loadSelectedPriceSet(storage);
    expect(failedContext.priceSet.id).toBe("synced");
    expect(afterFailedSync.status).toBe("loaded");
    if (afterFailedSync.status === "loaded") {
      expect(afterFailedSync.value.priceSet.id).toBe("synced");
    }
  });

  it("analyzes movers latest-vs-previous, latest-vs-first and explicit snapshot", () => {
    const history = BrowserPriceHistoryStateSchema.parse({
      snapshots: [
        {
          capturedAt: "2026-07-06T12:00:00.000Z",
          sourcePriceSetId: "latest",
          label: "Latest",
          itemPrices: { lobster: 250, big_bones: 350 }
        },
        {
          capturedAt: "2026-07-05T12:00:00.000Z",
          sourcePriceSetId: "previous",
          label: "Previous",
          itemPrices: { lobster: 200, big_bones: 500 }
        },
        {
          capturedAt: "2026-07-04T12:00:00.000Z",
          sourcePriceSetId: "first",
          label: "First",
          itemPrices: { lobster: 100, big_bones: 300 }
        }
      ]
    });
    const previous = analyzePriceHistoryMovers(history, {
      baselineMode: "previous",
      itemLabels: { lobster: "Lobster", big_bones: "Big bones" }
    });
    const first = analyzePriceHistoryMovers(history, {
      baselineMode: "first",
      itemLabels: { lobster: "Lobster", big_bones: "Big bones" }
    });
    const snapshot = analyzePriceHistoryMovers(history, {
      baselineMode: "snapshot",
      baselineSnapshotKey: priceHistorySnapshotKey(history.snapshots[1]),
      itemLabels: { lobster: "Lobster", big_bones: "Big bones" }
    });

    expect(previous.movedItemCount).toBe(2);
    expect(previous.topGainers[0]).toMatchObject({ itemId: "lobster", gpDelta: 50 });
    expect(previous.topFallers[0]).toMatchObject({ itemId: "big_bones", gpDelta: -150 });
    expect(first.rows.find((row) => row.itemId === "lobster")).toMatchObject({
      gpDelta: 150,
      percentDelta: 150
    });
    expect(snapshot.baseline?.sourcePriceSetId).toBe("previous");
    expect(snapshot.rows.find((row) => row.itemId === "big_bones")).toMatchObject({
      gpDelta: -150,
      percentDelta: -30
    });
  });

  it("handles missing and zero baseline prices without NaN or Infinity", () => {
    const history = BrowserPriceHistoryStateSchema.parse({
      snapshots: [
        {
          capturedAt: "2026-07-06T12:00:00.000Z",
          sourcePriceSetId: "latest",
          label: "Latest",
          itemPrices: { zero_base: 10, new_item: 5 }
        },
        {
          capturedAt: "2026-07-05T12:00:00.000Z",
          sourcePriceSetId: "previous",
          label: "Previous",
          itemPrices: { zero_base: 0, old_item: 8 }
        }
      ]
    });
    const analysis = analyzePriceHistoryMovers(history);
    const zeroBase = analysis.rows.find((row) => row.itemId === "zero_base");
    const newItem = analysis.rows.find((row) => row.itemId === "new_item");
    const oldItem = analysis.rows.find((row) => row.itemId === "old_item");

    expect(zeroBase).toMatchObject({ gpDelta: 10, percentDelta: null });
    expect(newItem).toMatchObject({ baselinePrice: null, gpDelta: null, percentDelta: null });
    expect(oldItem).toMatchObject({ latestPrice: null, gpDelta: null, percentDelta: null });
    for (const row of analysis.rows) {
      expect(row.gpDelta === null || Number.isFinite(row.gpDelta)).toBe(true);
      expect(row.percentDelta === null || Number.isFinite(row.percentDelta)).toBe(true);
    }
  });

  it("filters movers by item labels and sorts table rows", () => {
    const history = BrowserPriceHistoryStateSchema.parse({
      snapshots: [
        {
          capturedAt: "2026-07-06T12:00:00.000Z",
          sourcePriceSetId: "latest",
          label: "Latest",
          itemPrices: { lobster: 250, big_bones: 350, rune_arrow: 50 }
        },
        {
          capturedAt: "2026-07-05T12:00:00.000Z",
          sourcePriceSetId: "previous",
          label: "Previous",
          itemPrices: { lobster: 200, big_bones: 500, rune_arrow: 20 }
        }
      ]
    });
    const filtered = analyzePriceHistoryMovers(history, {
      itemFilter: "bones",
      itemLabels: { lobster: "Lobster", big_bones: "Big bones", rune_arrow: "Rune arrow" }
    });
    const sorted = analyzePriceHistoryMovers(history, {
      itemLabels: { lobster: "Lobster", big_bones: "Big bones", rune_arrow: "Rune arrow" },
      sort: { key: "item", direction: "asc" }
    });
    const sortedByDeltaAsc = analyzePriceHistoryMovers(history, {
      sort: { key: "gpDelta", direction: "asc" }
    });

    expect(filtered.rows.map((row) => row.itemId)).toEqual(["big_bones"]);
    expect(sorted.rows.map((row) => row.itemLabel)).toEqual(["Big bones", "Lobster", "Rune arrow"]);
    expect(sortedByDeltaAsc.rows[0]).toMatchObject({ itemId: "big_bones", gpDelta: -150 });
  });

  it("sync failure keeps the current browser-local price history reference", () => {
    const history = appendAcceptedPriceSetToHistory(
      DEFAULT_PRICE_HISTORY_STATE,
      syncResponse.priceSet,
      new Date("2026-07-05T12:00:06.000Z")
    );

    expect(keepPriceHistoryOnFailure(history)).toBe(history);
  });

  it("import failure keeps browser-local price history unchanged", () => {
    const history = DEFAULT_PRICE_HISTORY_STATE;

    expect(() => parsePriceSetFileText("{bad")).toThrow(PriceSetValidationError);
    expect(keepPriceHistoryOnFailure(history)).toBe(history);
  });

  it("caps browser-local price history snapshots", () => {
    let history = DEFAULT_PRICE_HISTORY_STATE;

    for (let index = 0; index < PRICE_HISTORY_MAX_SNAPSHOTS + 3; index += 1) {
      history = appendAcceptedPriceSetToHistory(
        history,
        importedPriceSet(`manual-${index}`),
        new Date(`2026-07-05T13:${String(index).padStart(2, "0")}:00.000Z`)
      );
    }

    expect(history.snapshots).toHaveLength(PRICE_HISTORY_MAX_SNAPSHOTS);
    expect(history.snapshots[0].sourcePriceSetId).toBe(`manual-${PRICE_HISTORY_MAX_SNAPSHOTS + 2}`);
    expect(history.snapshots.at(-1)?.sourcePriceSetId).toBe("manual-3");
  });
});

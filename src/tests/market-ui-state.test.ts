import {
  applyMarketSyncResponse,
  keepMarketSyncFailureContext,
  summarizeMarketSyncReport
} from "../app/state/market-sync";
import { parsePriceSetFileText } from "../adapters/market";
import {
  analyzePriceHistoryMovers,
  appendAcceptedPriceSetToHistory,
  BrowserPriceHistoryStateSchema,
  DEFAULT_PRICE_HISTORY_STATE,
  keepPriceHistoryOnFailure,
  PRICE_HISTORY_MAX_SNAPSHOTS,
  priceHistorySnapshotKey,
  summarizePriceHistory
} from "../app/state/price-history";
import { PriceSetValidationError } from "../data/schemas";
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

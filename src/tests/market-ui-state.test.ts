import {
  applyMarketSyncResponse,
  keepMarketSyncFailureContext,
  summarizeMarketSyncReport
} from "../app/state/market-sync";
import { parsePriceSetFileText } from "../adapters/market";
import {
  appendAcceptedPriceSetToHistory,
  DEFAULT_PRICE_HISTORY_STATE,
  keepPriceHistoryOnFailure,
  PRICE_HISTORY_MAX_SNAPSHOTS,
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
    expect(history.snapshots[0].sourcePriceSetId).toBe(
      `manual-${PRICE_HISTORY_MAX_SNAPSHOTS + 2}`
    );
    expect(history.snapshots.at(-1)?.sourcePriceSetId).toBe("manual-3");
  });
});

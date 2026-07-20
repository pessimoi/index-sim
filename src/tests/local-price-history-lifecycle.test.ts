import { describe, expect, it } from "vitest";
import {
  createFullHistoryReplacementCandidate,
  createLocalPriceHistoryRemovalCandidate,
  deriveFullHistoryReplacement,
  deriveLocalPriceHistoryRemoval,
  localPriceHistoryOccurrences
} from "../app/state/local-price-history-lifecycle";
import {
  BrowserPriceHistoryStateSchema,
  DEFAULT_PRICE_HISTORY_STATE,
  PRICE_HISTORY_MAX_SNAPSHOTS,
  appendAcceptedPriceSetToHistory,
  createPriceHistorySnapshot,
  type BrowserPriceHistoryState
} from "../app/state/price-history";
import { createLocalPriceHistoryManagementViewModel } from "../app/view-models/price-data";
import type { PriceSet } from "../domain/shared";

function priceSet(id: string, price = 100): PriceSet {
  return {
    id,
    label: `Price set ${id}`,
    source: "manual",
    createdAt: "2026-07-20T00:00:00.000Z",
    itemPrices: { lobster: price },
    alchValues: { lobster: 0 }
  };
}

function historyAtCapacity(): BrowserPriceHistoryState {
  return BrowserPriceHistoryStateSchema.parse({
    snapshots: Array.from({ length: PRICE_HISTORY_MAX_SNAPSHOTS }, (_, index) =>
      createPriceHistorySnapshot(
        priceSet(`set-${index}`, 100 + index),
        new Date(`2026-07-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`)
      )
    )
  });
}

describe("local price-history lifecycle", () => {
  it("projects empty and full lifecycle counts without exposing snapshot payload maps", () => {
    const sources = (localPriceHistory: BrowserPriceHistoryState) => ({
      analysisState: { snapshots: [...localPriceHistory.snapshots] },
      sharedHistory: { snapshots: [] },
      localPriceHistory,
      sharedSnapshotCount: 0,
      localSnapshotCount: localPriceHistory.snapshots.length,
      sourceStatus: localPriceHistory.snapshots.length ? ("local" as const) : ("empty" as const)
    });
    const controls = {
      baselineMode: "previous" as const,
      snapshotKey: "",
      itemFilter: "",
      trendItemId: "lobster",
      sort: { key: "gpDelta" as const, direction: "desc" as const }
    };
    const empty = createLocalPriceHistoryManagementViewModel({
      sources: sources(DEFAULT_PRICE_HISTORY_STATE),
      controls,
      effectiveSnapshotKey: ""
    });
    const full = createLocalPriceHistoryManagementViewModel({
      sources: sources(historyAtCapacity()),
      controls,
      effectiveSnapshotKey: ""
    });

    expect(empty).toEqual({ count: 0, maximum: 20, remaining: 20, atCapacity: false, rows: [] });
    expect(full).toMatchObject({ count: 20, maximum: 20, remaining: 0, atCapacity: true });
    expect(Object.keys(full.rows[0] ?? {})).not.toContain("itemPrices");
    expect(JSON.stringify(full.rows)).not.toContain("alchValues");
  });

  it("derives partial capacity, chronological markers and baseline occurrence", () => {
    const older = createPriceHistorySnapshot(
      priceSet("older"),
      new Date("2026-07-01T10:00:00.000Z")
    );
    const newer = createPriceHistorySnapshot(
      priceSet("newer"),
      new Date("2026-07-03T10:00:00.000Z")
    );
    const local = { snapshots: [older, newer] };
    const management = createLocalPriceHistoryManagementViewModel({
      sources: {
        analysisState: { snapshots: [newer, older] },
        sharedHistory: { snapshots: [] },
        localPriceHistory: local,
        sharedSnapshotCount: 0,
        localSnapshotCount: 2,
        sourceStatus: "local"
      },
      controls: {
        baselineMode: "snapshot",
        snapshotKey: `${older.capturedAt}::${older.sourcePriceSetId}`,
        itemFilter: "",
        trendItemId: "lobster",
        sort: { key: "gpDelta", direction: "desc" }
      },
      effectiveSnapshotKey: `${older.capturedAt}::${older.sourcePriceSetId}`
    });

    expect(management).toMatchObject({ count: 2, maximum: 20, remaining: 18, atCapacity: false });
    expect(management.rows.map((row) => row.label)).toEqual([newer.label, older.label]);
    expect(management.rows[0]).toMatchObject({ newest: true, oldest: false });
    expect(management.rows[1]).toMatchObject({ oldest: true, selectedAsBaseline: true });
  });

  it("uses distinct occurrence identities and deterministic equal-time oldest selection", () => {
    const duplicate = createPriceHistorySnapshot(
      priceSet("duplicate"),
      new Date("2026-07-01T10:00:00.000Z")
    );
    const occurrences = localPriceHistoryOccurrences({ snapshots: [duplicate, duplicate] });
    expect(new Set(occurrences.map((row) => row.occurrenceId)).size).toBe(2);
    expect(occurrences[0]).toMatchObject({ sourceIndex: 0, newest: true });
    expect(occurrences[1]).toMatchObject({ sourceIndex: 1, oldest: true });
  });

  it("marks only the exact duplicate occurrence selected by the combined baseline resolver", () => {
    const duplicate = createPriceHistorySnapshot(
      priceSet("duplicate"),
      new Date("2026-07-01T10:00:00.000Z")
    );
    const local = { snapshots: [duplicate, duplicate] };
    const snapshotKey = `${duplicate.capturedAt}::${duplicate.sourcePriceSetId}`;
    const management = createLocalPriceHistoryManagementViewModel({
      sources: {
        analysisState: { snapshots: [...local.snapshots] },
        sharedHistory: { snapshots: [] },
        localPriceHistory: local,
        sharedSnapshotCount: 0,
        localSnapshotCount: 2,
        sourceStatus: "local"
      },
      controls: {
        baselineMode: "snapshot",
        snapshotKey,
        itemFilter: "",
        trendItemId: "lobster",
        sort: { key: "gpDelta", direction: "desc" }
      },
      effectiveSnapshotKey: snapshotKey
    });

    expect(management.rows.filter((row) => row.selectedAsBaseline)).toHaveLength(1);
    expect(management.rows[0]).toMatchObject({ sourceIndex: 0, selectedAsBaseline: true });
  });

  it("prepends an under-cap capture without mutating or reordering prior rows", () => {
    const first = createPriceHistorySnapshot(
      priceSet("first"),
      new Date("2026-07-01T10:00:00.000Z")
    );
    const second = createPriceHistorySnapshot(
      priceSet("second"),
      new Date("2026-07-02T10:00:00.000Z")
    );
    const prior = { snapshots: [second, first] };
    const priorJson = JSON.stringify(prior);
    const next = appendAcceptedPriceSetToHistory(
      prior,
      priceSet("captured"),
      new Date("2026-07-03T10:00:00.000Z")
    );

    expect(next.snapshots.slice(1)).toEqual(prior.snapshots);
    expect(next.snapshots[0]?.sourcePriceSetId).toBe("captured");
    expect(JSON.stringify(prior)).toBe(priorJson);
  });

  it("never silently evicts when automatic capture reaches capacity", () => {
    const full = historyAtCapacity();
    expect(appendAcceptedPriceSetToHistory(full, priceSet("overflow"))).toBe(full);
  });

  it("removes one reviewed duplicate occurrence and stales after any history change", () => {
    const duplicate = createPriceHistorySnapshot(
      priceSet("duplicate"),
      new Date("2026-07-01T10:00:00.000Z")
    );
    const history = { snapshots: [duplicate, duplicate] };
    const target = localPriceHistoryOccurrences(history)[1]!;
    const candidate = createLocalPriceHistoryRemovalCandidate({
      id: 1,
      history,
      occurrenceId: target.occurrenceId
    })!;
    const result = deriveLocalPriceHistoryRemoval(candidate, history);
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.next.snapshots).toHaveLength(1);
    expect(
      deriveLocalPriceHistoryRemoval(candidate, {
        snapshots: [
          ...history.snapshots,
          createPriceHistorySnapshot(priceSet("later"), new Date("2026-07-02T00:00:00.000Z"))
        ]
      }).status
    ).toBe("stale");
  });

  it("derives an empty state when the final local occurrence is removed", () => {
    const history = {
      snapshots: [
        createPriceHistorySnapshot(priceSet("only"), new Date("2026-07-01T00:00:00.000Z"))
      ]
    };
    const candidate = createLocalPriceHistoryRemovalCandidate({
      id: 2,
      history,
      occurrenceId: localPriceHistoryOccurrences(history)[0]!.occurrenceId
    })!;
    const result = deriveLocalPriceHistoryRemoval(candidate, history);
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.next).toEqual(DEFAULT_PRICE_HISTORY_STATE);
  });

  it("reviews and replaces only the chronological oldest point and stales on PriceSet change", () => {
    const full = historyAtCapacity();
    const active = priceSet("active", 999);
    const candidate = createFullHistoryReplacementCandidate({
      id: 3,
      history: full,
      activePriceSet: active,
      capturedAt: new Date("2026-07-20T14:00:00.000Z")
    })!;
    expect(candidate.replacedOccurrence.snapshot.sourcePriceSetId).toBe("set-0");
    const result = deriveFullHistoryReplacement(candidate, full, active);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.next.snapshots).toHaveLength(PRICE_HISTORY_MAX_SNAPSHOTS);
      expect(result.next.snapshots[0]!.sourcePriceSetId).toBe("active");
      expect(result.next.snapshots.some((snapshot) => snapshot.sourcePriceSetId === "set-0")).toBe(
        false
      );
    }
    expect(deriveFullHistoryReplacement(candidate, full, priceSet("changed", 999)).status).toBe(
      "stale"
    );
  });
});

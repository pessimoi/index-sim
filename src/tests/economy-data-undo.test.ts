import { describe, expect, it, vi } from "vitest";
import { createMemoryStorage, type KeyValueStorage } from "../adapters/storage";
import {
  commitEconomyPriceHistory,
  invalidateEconomyDataPendingUndo,
  prepareEconomyDataUndo,
  type EconomyDataRecoveryPort,
  type EconomyDataUndoScope
} from "../app/controllers/economy-data-undo";
import {
  DEFAULT_PRICE_HISTORY_STATE,
  PRICE_HISTORY_STORAGE_KEY,
  type BrowserPriceHistoryState
} from "../app/state/price-history";

const KEYS: Record<EconomyDataUndoScope, string> = {
  "price-history": "index-sim:price-history",
  "manual-price-overrides": "index-sim:manual-price-overrides",
  "selected-price-set": "index-sim:price-set:selected"
};

function prepare(
  storage: KeyValueStorage,
  scope: EconomyDataUndoScope = "price-history",
  persistenceUnavailable = false
) {
  return prepareEconomyDataUndo({
    scope,
    storage,
    persistenceUnavailable,
    liveState: { marker: "before" }
  });
}

function history(label: string): BrowserPriceHistoryState {
  return {
    snapshots: [
      {
        capturedAt: "2026-07-20T12:00:00.000Z",
        sourcePriceSetId: `prices-${label}`,
        label,
        itemPrices: { lobster: 200 }
      }
    ]
  };
}

function recoveryPort(): EconomyDataRecoveryPort {
  return {
    clearStorageFailures: vi.fn(),
    completeExternalUndo: vi.fn(),
    markPersistenceUnavailable: vi.fn(),
    prepareExternalApply: vi.fn(),
    recordStorageFailure: vi.fn(),
    refresh: vi.fn(),
    unblockReplaced: vi.fn()
  };
}

describe("Economy data destructive Undo", () => {
  it("invalidates only an Economy-scoped pending Undo", () => {
    const economyUndo = { id: "economy", scope: "economy-data" };
    const unrelatedUndo = { id: "setup" };

    expect(invalidateEconomyDataPendingUndo(economyUndo)).toBeNull();
    expect(invalidateEconomyDataPendingUndo(unrelatedUndo)).toBe(unrelatedUndo);
    expect(invalidateEconomyDataPendingUndo(null)).toBeNull();
  });

  it("restores the exact raw string and consumes the record once", () => {
    const rawBefore = '{"version":2,"savedAt":"original","data":{"snapshots":[]}}';
    const storage = createMemoryStorage({ [KEYS["price-history"]]: rawBefore });
    const pending = prepare(storage);
    storage.removeItem(KEYS["price-history"]);
    const undo = pending.finish(true);

    expect(undo.undo()).toMatchObject({
      status: "restored",
      durability: "durable",
      liveState: { marker: "before" },
      savedState: "restored-pre-action"
    });
    expect(storage.getItem(KEYS["price-history"])).toBe(rawBefore);
    expect(undo.undo()).toEqual({ status: "consumed" });
  });

  it("restores a null preimage with removeItem", () => {
    const storage = createMemoryStorage();
    const removeItem = vi.spyOn(storage, "removeItem");
    const pending = prepare(storage, "manual-price-overrides");
    storage.setItem(KEYS["manual-price-overrides"], "post-action");
    const undo = pending.finish(true);

    expect(undo.undo()).toMatchObject({ durability: "durable" });
    expect(removeItem).toHaveBeenCalledWith(KEYS["manual-price-overrides"]);
    expect(storage.getItem(KEYS["manual-price-overrides"])).toBeNull();
  });

  it("uses a live-only session restore without any Undo storage operation", () => {
    const base = createMemoryStorage({ [KEYS["selected-price-set"]]: "saved-before" });
    const storage: KeyValueStorage = {
      getItem: vi.fn(base.getItem),
      setItem: vi.fn(base.setItem),
      removeItem: vi.fn(base.removeItem)
    };
    const pending = prepare(storage, "selected-price-set", true);
    const undo = pending.finish(false);

    expect(undo.undo()).toMatchObject({
      durability: "session-only",
      savedState: "pre-action-retained",
      reason: "persistence-unavailable"
    });
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("does not overwrite a later raw value from another mutation or tab", () => {
    const storage = createMemoryStorage({ [KEYS["price-history"]]: "before" });
    const pending = prepare(storage);
    storage.setItem(KEYS["price-history"], "post-action");
    const undo = pending.finish(true);
    storage.setItem(KEYS["price-history"], "later-value");

    expect(undo.undo()).toMatchObject({
      durability: "session-only",
      savedState: "later-value-retained",
      reason: "raw-mismatch"
    });
    expect(storage.getItem(KEYS["price-history"])).toBe("later-value");
  });

  it("falls back safely when current raw reading fails", () => {
    let reads = 0;
    const storage: KeyValueStorage = {
      getItem: () => {
        reads += 1;
        if (reads === 3) throw new Error("private read detail");
        return reads === 1 ? "before" : "post-action";
      },
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    const undo = prepare(storage).finish(true);

    expect(undo.undo()).toMatchObject({
      durability: "session-only",
      reason: "current-read-failed",
      storageFailure: "save_failed"
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("falls back safely when exact setItem restoration fails", () => {
    let raw: string | null = "before";
    let shouldFail = false;
    const storage: KeyValueStorage = {
      getItem: () => raw,
      setItem: (_key, value) => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("private write detail");
        }
        raw = value;
      },
      removeItem: () => {
        raw = null;
      }
    };
    const pending = prepare(storage);
    raw = "post-action";
    const undo = pending.finish(true);
    shouldFail = true;

    expect(undo.undo()).toMatchObject({
      durability: "session-only",
      savedState: "post-action-retained",
      reason: "raw-restore-failed",
      storageFailure: "save_failed"
    });
    expect(raw).toBe("post-action");
  });

  it("falls back safely when exact removeItem restoration fails", () => {
    let raw: string | null = null;
    let shouldFail = false;
    const storage: KeyValueStorage = {
      getItem: () => raw,
      setItem: (_key, value) => {
        raw = value;
      },
      removeItem: () => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("private remove detail");
        }
        raw = null;
      }
    };
    const pending = prepare(storage, "manual-price-overrides");
    raw = "post-action";
    const undo = pending.finish(true);
    shouldFail = true;

    expect(undo.undo()).toMatchObject({
      durability: "session-only",
      savedState: "post-action-retained",
      reason: "raw-restore-failed",
      storageFailure: "clear_failed"
    });
    expect(raw).toBe("post-action");
  });

  it("keeps raw payloads out of public results", () => {
    const secretRaw = "raw-private-user-payload";
    const storage = createMemoryStorage({ [KEYS["price-history"]]: secretRaw });
    const pending = prepare(storage);
    storage.removeItem(KEYS["price-history"]);
    const undo = pending.finish(true);
    const result = undo.undo();

    expect(JSON.stringify({ pending, undo, result })).not.toContain(secretRaw);
  });
});

describe("local price-history commit boundary", () => {
  it("rejects an invalid complete state before reading, writing or applying it", () => {
    const storage: KeyValueStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    const recovery = recoveryPort();
    const applyLiveState = vi.fn();
    const invalid = {
      snapshots: [
        {
          capturedAt: "not-a-time",
          sourcePriceSetId: "invalid",
          label: "Invalid",
          itemPrices: { lobster: 200 }
        }
      ]
    } as BrowserPriceHistoryState;

    const outcome = commitEconomyPriceHistory({
      storage,
      persistenceUnavailable: false,
      persistenceBlocked: false,
      current: DEFAULT_PRICE_HISTORY_STATE,
      next: invalid,
      destructive: true,
      durableMessage: "Saved",
      sessionMessage: "Session",
      recovery,
      applyLiveState,
      now: () => new Date("2026-07-20T12:05:00.000Z")
    });

    expect(outcome).toEqual({
      status: "invalid",
      message: "Local price history could not be validated."
    });
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(applyLiveState).not.toHaveBeenCalled();
    expect(recovery.prepareExternalApply).not.toHaveBeenCalled();
  });

  it("writes a validated v2 envelope before applying one non-destructive live update", () => {
    const storage = createMemoryStorage();
    const next = history("First comparison");
    const recovery = recoveryPort();
    const applyLiveState = vi.fn();

    const outcome = commitEconomyPriceHistory({
      storage,
      persistenceUnavailable: false,
      persistenceBlocked: false,
      current: DEFAULT_PRICE_HISTORY_STATE,
      next,
      destructive: false,
      durableMessage: "Saved local price comparison",
      sessionMessage: "Session only",
      recovery,
      applyLiveState,
      now: () => new Date("2026-07-20T12:05:00.000Z")
    });

    expect(outcome).toMatchObject({
      status: "applied",
      durability: "durable",
      record: null,
      actionStatus: "Saved local price comparison"
    });
    expect(JSON.parse(storage.getItem(PRICE_HISTORY_STORAGE_KEY) ?? "null")).toEqual({
      version: 2,
      savedAt: "2026-07-20T12:05:00.000Z",
      data: next
    });
    expect(recovery.prepareExternalApply).toHaveBeenCalledWith(["price-history"]);
    expect(applyLiveState).toHaveBeenCalledOnce();
    expect(applyLiveState).toHaveBeenCalledWith(next);
  });

  it("removes the final storage key and restores its exact preimage once", () => {
    const before = history("Only comparison");
    const rawBefore = JSON.stringify({
      version: 2,
      savedAt: "2026-07-20T12:00:00.000Z",
      data: before
    });
    const storage = createMemoryStorage({ [PRICE_HISTORY_STORAGE_KEY]: rawBefore });
    const recovery = recoveryPort();

    const outcome = commitEconomyPriceHistory({
      storage,
      persistenceUnavailable: false,
      persistenceBlocked: false,
      current: before,
      next: DEFAULT_PRICE_HISTORY_STATE,
      destructive: true,
      durableMessage: "Removed local comparison",
      sessionMessage: "Removed for session",
      recovery,
      applyLiveState: vi.fn(),
      now: () => new Date("2026-07-20T12:10:00.000Z")
    });

    expect(outcome.status).toBe("applied");
    if (outcome.status !== "applied") throw new Error("expected applied outcome");
    expect(storage.getItem(PRICE_HISTORY_STORAGE_KEY)).toBeNull();
    expect(outcome.record?.undo()).toMatchObject({
      status: "restored",
      durability: "durable",
      liveState: before,
      savedState: "restored-pre-action"
    });
    expect(storage.getItem(PRICE_HISTORY_STORAGE_KEY)).toBe(rawBefore);
    expect(outcome.record?.undo()).toEqual({ status: "consumed" });
  });

  it("applies a blocked destructive change for the session without touching protected raw data", () => {
    const before = history("Protected");
    const base = createMemoryStorage({ [PRICE_HISTORY_STORAGE_KEY]: "protected-raw" });
    const storage: KeyValueStorage = {
      getItem: vi.fn(base.getItem),
      setItem: vi.fn(base.setItem),
      removeItem: vi.fn(base.removeItem)
    };
    const recovery = recoveryPort();
    const applyLiveState = vi.fn();

    const outcome = commitEconomyPriceHistory({
      storage,
      persistenceUnavailable: false,
      persistenceBlocked: true,
      current: before,
      next: DEFAULT_PRICE_HISTORY_STATE,
      destructive: true,
      durableMessage: "Cleared",
      sessionMessage: "Cleared for this session. Saved history was not changed.",
      recovery,
      applyLiveState,
      now: () => new Date("2026-07-20T12:10:00.000Z")
    });

    expect(outcome).toMatchObject({ status: "applied", durability: "session-only" });
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(applyLiveState).toHaveBeenCalledWith(DEFAULT_PRICE_HISTORY_STATE);
  });

  it("reports a failed save as session-only and records only the sanitized failure", () => {
    const storage: KeyValueStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error("private filesystem detail");
      }),
      removeItem: vi.fn()
    };
    const recovery = recoveryPort();
    const next = history("Session comparison");

    const outcome = commitEconomyPriceHistory({
      storage,
      persistenceUnavailable: false,
      persistenceBlocked: false,
      current: DEFAULT_PRICE_HISTORY_STATE,
      next,
      destructive: false,
      durableMessage: "Saved",
      sessionMessage: "Saved for this session. Saved history was not changed.",
      recovery,
      applyLiveState: vi.fn(),
      now: () => new Date("2026-07-20T12:10:00.000Z")
    });

    expect(outcome).toMatchObject({ status: "applied", durability: "session-only" });
    expect(recovery.recordStorageFailure).toHaveBeenCalledWith("price-history", "save_failed");
    expect(JSON.stringify(outcome)).not.toContain("private filesystem detail");
  });

  it("reports a failed final removal as session-only and keeps the saved preimage", () => {
    const before = history("Retained comparison");
    const rawBefore = JSON.stringify({ version: 2, savedAt: "before", data: before });
    const storage: KeyValueStorage = {
      getItem: vi.fn(() => rawBefore),
      setItem: vi.fn(),
      removeItem: vi.fn(() => {
        throw new Error("private remove detail");
      })
    };
    const recovery = recoveryPort();
    const applyLiveState = vi.fn();

    const outcome = commitEconomyPriceHistory({
      storage,
      persistenceUnavailable: false,
      persistenceBlocked: false,
      current: before,
      next: DEFAULT_PRICE_HISTORY_STATE,
      destructive: true,
      durableMessage: "Removed",
      sessionMessage: "Removed for this session. Saved history was not changed.",
      recovery,
      applyLiveState,
      now: () => new Date("2026-07-20T12:10:00.000Z")
    });

    expect(outcome).toMatchObject({ status: "applied", durability: "session-only" });
    expect(recovery.recordStorageFailure).toHaveBeenCalledWith("price-history", "clear_failed");
    expect(applyLiveState).toHaveBeenCalledWith(DEFAULT_PRICE_HISTORY_STATE);
    if (outcome.status !== "applied") throw new Error("expected applied outcome");
    expect(outcome.record?.undo()).toMatchObject({
      status: "restored",
      durability: "session-only",
      savedState: "pre-action-retained",
      reason: "action-not-persisted"
    });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(JSON.stringify(outcome)).not.toContain("private remove detail");
  });
});

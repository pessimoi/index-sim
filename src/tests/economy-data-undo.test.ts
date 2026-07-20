import { describe, expect, it, vi } from "vitest";
import { createMemoryStorage, type KeyValueStorage } from "../adapters/storage";
import {
  invalidateEconomyDataPendingUndo,
  prepareEconomyDataUndo,
  type EconomyDataUndoScope
} from "../app/controllers/economy-data-undo";

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

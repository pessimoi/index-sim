import { describe, expect, it, vi } from "vitest";

import { createMemoryStorage, type KeyValueStorage } from "../adapters/storage";
import {
  SavedSetupChangesTransactionCore,
  type SavedSetupChangesExecutionInput,
  type SavedSetupChangesRecoveryBoundary
} from "../app/controllers/saved-setup-changes";
import {
  DUEL_SNAPSHOTS_STORAGE_KEY,
  DUEL_SNAPSHOTS_VERSION,
  createDuelSnapshot,
  type DuelSnapshotsState
} from "../app/state/duel-snapshots";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";

const now = new Date("2026-07-20T15:00:00.000Z");

function state(id: string, name: string): DuelSnapshotsState {
  return { snapshots: [createDuelSnapshot(id, name, DEFAULT_FORM_STATE)] };
}

function recovery(): SavedSetupChangesRecoveryBoundary {
  return {
    canStartDurableWrite: vi.fn(() => true),
    prepareExternalApply: vi.fn(),
    cancelExternalApply: vi.fn(),
    completeExternalApply: vi.fn(),
    completeExternalUndo: vi.fn(),
    recordExternalApplyFailure: vi.fn(),
    markPersistenceUnavailable: vi.fn(),
    unblockReplaced: vi.fn()
  };
}

function execution(
  storage: KeyValueStorage,
  live: { current: DuelSnapshotsState },
  boundary = recovery(),
  options: { unavailable?: boolean; blocked?: boolean } = {}
): SavedSetupChangesExecutionInput {
  return {
    storageAccess: {
      storage,
      storageUnavailable: options.unavailable ?? false,
      savedDataIgnoredForSession: options.unavailable ?? false
    },
    persistenceUnavailable: options.unavailable ?? false,
    persistenceBlocked: options.blocked ?? false,
    liveState: live.current,
    applyLiveState: (next) => {
      live.current = next;
    },
    recovery: boundary,
    now: () => now
  };
}

function request(current: DuelSnapshotsState, next: DuelSnapshotsState) {
  return {
    current,
    next,
    actionMessage: "Merged saved setups",
    sessionActionMessage: "Merged saved setups for this session. Changes may return after reload.",
    undoMessage: "Restored saved setups from before merge"
  };
}

describe("saved setup single-key transaction", () => {
  it("writes and verifies before applying live state, then restores exact raw bytes on Undo", () => {
    const priorRaw = "opaque prior bytes";
    const storage = createMemoryStorage({ [DUEL_SNAPSHOTS_STORAGE_KEY]: priorRaw });
    const current = state("one", "One");
    const next = state("one", "Renamed");
    const live = { current };
    const boundary = recovery();
    const core = new SavedSetupChangesTransactionCore();

    expect(core.applyDurable(request(current, next), execution(storage, live, boundary))).toEqual({
      status: "applied",
      mode: "durable",
      message: "Merged saved setups",
      undoMessage: "Restored saved setups from before merge"
    });
    expect(live.current).toEqual(next);
    expect(JSON.parse(storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY)!)).toEqual({
      version: DUEL_SNAPSHOTS_VERSION,
      savedAt: now.toISOString(),
      data: next
    });
    expect(boundary.prepareExternalApply).toHaveBeenCalledWith(["duel-snapshots"]);
    expect(boundary.completeExternalApply).toHaveBeenCalledWith(["duel-snapshots"]);

    expect(core.undo(execution(storage, live, boundary))).toEqual({
      status: "undone",
      mode: "durable",
      message: "Restored saved setups from before merge"
    });
    expect(storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY)).toBe(priorRaw);
    expect(live.current).toEqual(current);
    expect(boundary.completeExternalUndo).toHaveBeenCalledWith(["duel-snapshots"]);
  });

  it("offers an explicit session-only action without touching storage when unavailable or blocked", () => {
    for (const options of [{ unavailable: true }, { blocked: true }]) {
      const storage = createMemoryStorage({ [DUEL_SNAPSHOTS_STORAGE_KEY]: "prior" });
      const current = state("one", "One");
      const next = state("one", "Renamed");
      const live = { current };
      const core = new SavedSetupChangesTransactionCore();
      expect(
        core.applyDurable(request(current, next), execution(storage, live, recovery(), options))
      ).toMatchObject({ status: "session-only-available" });
      expect(storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY)).toBe("prior");
      expect(live.current).toEqual(current);

      expect(core.applyForSession(request(current, next), execution(storage, live))).toMatchObject({
        status: "applied",
        mode: "session-only"
      });
      expect(storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY)).toBe("prior");
      expect(live.current).toEqual(next);
      expect(core.undo(execution(storage, live))).toMatchObject({
        status: "undone",
        mode: "session-only"
      });
      expect(live.current).toEqual(current);
    }
  });

  it("rolls a failed durable write back exactly before offering session-only apply", () => {
    let raw: string | null = "prior exact";
    let firstWrite = true;
    const storage: KeyValueStorage = {
      getItem: () => raw,
      setItem: (_key, value) => {
        if (firstWrite) {
          firstWrite = false;
          raw = "partial write";
          throw new Error("write failed");
        }
        raw = value;
      },
      removeItem: () => {
        raw = null;
      }
    };
    const current = state("one", "One");
    const live = { current };
    const boundary = recovery();
    const outcome = new SavedSetupChangesTransactionCore().applyDurable(
      request(current, state("one", "Next")),
      execution(storage, live, boundary)
    );
    expect(outcome).toMatchObject({ status: "session-only-available", reason: "write-failed" });
    expect(raw).toBe("prior exact");
    expect(live.current).toEqual(current);
    expect(boundary.recordExternalApplyFailure).toHaveBeenCalledWith(
      [{ id: "duel-snapshots", reason: "save_failed" }],
      false
    );
  });

  it("blocks recovery when failed storage cannot be rolled back exactly", () => {
    let raw: string | null = "prior";
    const storage: KeyValueStorage = {
      getItem: () => raw,
      setItem: () => {
        raw = "uncertain";
        throw new Error("all writes fail");
      },
      removeItem: () => {
        throw new Error("all writes fail");
      }
    };
    const current = state("one", "One");
    const boundary = recovery();
    expect(
      new SavedSetupChangesTransactionCore().applyDurable(
        request(current, state("one", "Next")),
        execution(storage, { current }, boundary)
      )
    ).toMatchObject({ status: "failed", recoveryRequired: true });
    expect(boundary.recordExternalApplyFailure).toHaveBeenCalledWith(
      [{ id: "duel-snapshots", reason: "save_failed" }],
      true
    );
  });

  it("does not apply a stale request", () => {
    const reviewed = state("one", "Reviewed");
    const newer = state("one", "Newer");
    const live = { current: newer };
    const storage = createMemoryStorage({ [DUEL_SNAPSHOTS_STORAGE_KEY]: "newer raw" });
    expect(
      new SavedSetupChangesTransactionCore().applyDurable(
        request(reviewed, state("one", "Next")),
        execution(storage, live)
      )
    ).toMatchObject({ status: "stale" });
    expect(storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY)).toBe("newer raw");
    expect(live.current).toEqual(newer);
  });

  it("protects later live and saved values from stale Undo", () => {
    const storage = createMemoryStorage();
    const current = state("one", "One");
    const next = state("one", "Next");
    const live = { current };
    const core = new SavedSetupChangesTransactionCore();
    expect(core.applyDurable(request(current, next), execution(storage, live)).status).toBe(
      "applied"
    );
    const laterRaw = "later saved bytes";
    storage.setItem(DUEL_SNAPSHOTS_STORAGE_KEY, laterRaw);
    live.current = state("later", "Later");
    expect(core.undo(execution(storage, live))).toMatchObject({ status: "stale" });
    expect(storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY)).toBe(laterRaw);
    expect(live.current.snapshots[0].id).toBe("later");
  });

  it("keeps the post-action saved state and offers explicit session-only Undo on restore failure", () => {
    const memory = createMemoryStorage();
    let failRestore = false;
    const storage: KeyValueStorage = {
      getItem: (key) => memory.getItem(key),
      setItem: (key, value) => {
        if (failRestore && value === "prior") throw new Error("restore failed");
        memory.setItem(key, value);
      },
      removeItem: (key) => memory.removeItem(key)
    };
    storage.setItem(DUEL_SNAPSHOTS_STORAGE_KEY, "prior");
    const current = state("one", "One");
    const next = state("one", "Next");
    const live = { current };
    const core = new SavedSetupChangesTransactionCore();
    expect(core.applyDurable(request(current, next), execution(storage, live)).status).toBe(
      "applied"
    );
    const postRaw = storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY);
    failRestore = true;
    expect(core.undo(execution(storage, live))).toMatchObject({
      status: "session-only-available"
    });
    expect(storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY)).toBe(postRaw);
    expect(live.current).toEqual(next);
    expect(core.undoForSession(execution(storage, live))).toMatchObject({
      status: "undone",
      mode: "session-only"
    });
    expect(live.current).toEqual(current);
    expect(storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY)).toBe(postRaw);
  });

  it("invalidates its one pending Undo when a later collection action replaces it", () => {
    const core = new SavedSetupChangesTransactionCore();
    const current = state("one", "One");
    const live = { current };
    expect(
      core.applyForSession(
        request(current, state("one", "Next")),
        execution(createMemoryStorage(), live)
      ).status
    ).toBe("applied");
    expect(core.hasPendingUndo()).toBe(true);
    core.invalidateUndo();
    expect(core.hasPendingUndo()).toBe(false);
  });
});

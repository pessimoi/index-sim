import { createGeneratedRuntimeContext } from "../adapters/generated";
import type { KeyValueStorage } from "../adapters/storage";
import { createBrowserStorageAccess } from "../app/application-recovery";
import {
  WORKSPACE_RESTORE_STORAGE_TARGETS,
  WorkspaceRestoreExecutorCore,
  type WorkspaceRestoreExecutionInput,
  type WorkspaceRestoreLiveOutcome,
  type WorkspaceRestoreRecoveryBoundary
} from "../app/controllers/workspace-restore-executor";
import {
  createDefaultWorkspaceRestoreSelection,
  createWorkspaceRestoreReview,
  type WorkspacePrepareImportContext,
  type WorkspaceRestoreSelectionDraft
} from "../app/controllers/workspace-file-transfer-review";
import { createWorkspaceRestorePlan } from "../app/controllers/workspace-restore-plan";
import { createDuelSnapshot } from "../app/state/duel-snapshots";
import { DEFAULT_PLANNER_UI_STATE } from "../app/state/planner";
import { DEFAULT_PRICE_HISTORY_STATE } from "../app/state/price-history";
import { DEFAULT_FORM_STATE, savedSetupFromForm } from "../app/state/ui-state";
import {
  WORKSPACE_TRANSFER_AREA_IDS,
  createWorkspaceBackupExport,
  parseWorkspaceBackupText,
  type WorkspaceLiveState,
  type WorkspaceTransferAreaId
} from "../app/state/workspace-backup";
import { plannerAllowedPool } from "../app/view-models/planner";

const runtime = createGeneratedRuntimeContext().context;
const fixedNow = new Date("2026-07-19T18:00:00.000Z");
const monsterId = DEFAULT_FORM_STATE.monsterId;
const itemId = Object.keys(runtime.priceSet.itemPrices)[0]!;

function sourceLiveState(): WorkspaceLiveState {
  return {
    "rewrite-setup": savedSetupFromForm({
      ...DEFAULT_FORM_STATE,
      levels: { ...DEFAULT_FORM_STATE.levels, attack: 55 }
    }),
    "planner-ui": { ...DEFAULT_PLANNER_UI_STATE, metric: "gph" },
    "loot-prefs": {},
    "loot-settings": {
      [monsterId]: { highAlch: true, overheadSec: 12, talismanSpot: "overground" }
    },
    "hidden-gear-tiers": { bronze: true },
    "duel-snapshots": {
      snapshots: [createDuelSnapshot("workspace-source", "Workspace source", DEFAULT_FORM_STATE)]
    },
    "price-history": DEFAULT_PRICE_HISTORY_STATE,
    "selected-price-set": {
      ...runtime.priceSet,
      id: "workspace-selected",
      label: "Workspace selected"
    },
    "manual-price-overrides": {
      items: { [itemId]: { price: 321, updatedAt: fixedNow.toISOString() } }
    },
    "hiscores-last-player": { player: "Restore Hero" }
  };
}

function currentLiveState(): WorkspaceLiveState {
  return {
    "rewrite-setup": savedSetupFromForm(DEFAULT_FORM_STATE),
    "planner-ui": DEFAULT_PLANNER_UI_STATE,
    "loot-prefs": {},
    "loot-settings": {},
    "hidden-gear-tiers": { iron: true },
    "duel-snapshots": { snapshots: [] },
    "price-history": DEFAULT_PRICE_HISTORY_STATE,
    "selected-price-set": null,
    "manual-price-overrides": { items: {} },
    "hiscores-last-player": null
  };
}

function prepareContext(liveState: WorkspaceLiveState): WorkspacePrepareImportContext {
  return {
    gameData: runtime.gameData,
    liveState,
    allowedPool: plannerAllowedPool(DEFAULT_FORM_STATE.combatStyle, runtime),
    priceFallback: [runtime.priceSet, "bundled"]
  };
}

function planFor(
  source: WorkspaceLiveState,
  current: WorkspaceLiveState,
  selectedIds: readonly WorkspaceTransferAreaId[] = WORKSPACE_TRANSFER_AREA_IDS
) {
  const parsed = parseWorkspaceBackupText(
    createWorkspaceBackupExport({
      gameData: runtime.gameData,
      liveState: source,
      storageAccess: createBrowserStorageAccess(),
      includeLastHiscoresPlayer: true,
      now: fixedNow
    }).text
  );
  const context = prepareContext(current);
  const review = createWorkspaceRestoreReview(1, parsed, context);
  const defaults = createDefaultWorkspaceRestoreSelection(review);
  const selection: WorkspaceRestoreSelectionDraft = {
    ...defaults,
    areas: defaults.areas.map((area) => ({
      ...area,
      selected: selectedIds.includes(area.id)
    }))
  };
  return createWorkspaceRestorePlan({ reviewId: 1, parsed, selection, context }).plan;
}

interface InstrumentedStorage {
  storage: KeyValueStorage;
  values: Map<string, string>;
  mutations: string[];
  reads: string[];
  setFailure(mutation: number, rollbackKey?: string): void;
}

function instrumentedStorage(initial: Record<string, string> = {}): InstrumentedStorage {
  const values = new Map(Object.entries(initial));
  const mutations: string[] = [];
  const reads: string[] = [];
  let failAt = 0;
  let rollbackKey: string | undefined;
  let failed = false;
  let mutationCount = 0;
  const mutate = (kind: "set" | "clear", key: string, value?: string) => {
    mutationCount += 1;
    mutations.push(`${kind}:${key}`);
    if (!failed && failAt === mutationCount) {
      failed = true;
      throw new Error("private write failure");
    }
    if (failed && rollbackKey === key) throw new Error("private rollback failure");
    if (kind === "clear") values.delete(key);
    else values.set(key, value!);
  };
  return {
    storage: {
      getItem: (key) => {
        reads.push(key);
        return values.get(key) ?? null;
      },
      setItem: (key, value) => mutate("set", key, value),
      removeItem: (key) => mutate("clear", key)
    },
    values,
    mutations,
    reads,
    setFailure: (mutation, rollbackFailureKey) => {
      failAt = mutation;
      rollbackKey = rollbackFailureKey;
    }
  };
}

function recoveryBoundary() {
  const recovery: WorkspaceRestoreRecoveryBoundary = {
    canStartDurableWrite: vi.fn(() => true),
    prepareExternalApply: vi.fn(),
    cancelExternalApply: vi.fn(),
    completeExternalApply: vi.fn(),
    completeExternalUndo: vi.fn(),
    recordExternalApplyFailure: vi.fn(),
    markPersistenceUnavailable: vi.fn()
  };
  return recovery;
}

function execution(
  storage: KeyValueStorage,
  live: { current: WorkspaceLiveState },
  recovery: WorkspaceRestoreRecoveryBoundary,
  options: {
    persistenceUnavailable?: boolean;
    failLiveAt?: number;
    outcomes?: WorkspaceRestoreLiveOutcome[];
  } = {}
): WorkspaceRestoreExecutionInput {
  let liveCall = 0;
  return {
    storageAccess: {
      storage,
      storageUnavailable: options.persistenceUnavailable === true,
      savedDataIgnoredForSession: false
    },
    persistenceUnavailable: options.persistenceUnavailable === true,
    context: prepareContext(live.current),
    applyLiveState: (outcome) => {
      liveCall += 1;
      options.outcomes?.push(outcome);
      if (options.failLiveAt === liveCall) throw new Error("private live failure");
      live.current = outcome.liveState;
    },
    recovery,
    now: () => fixedNow
  };
}

function priorRawValues(): Record<string, string> {
  return Object.fromEntries(
    WORKSPACE_RESTORE_STORAGE_TARGETS.map((target) => [target.key, `prior:${target.id}`])
  );
}

describe("Workspace restore executor", () => {
  it("writes every selected target in registry order, applies live only after success and undoes exact raw bytes", () => {
    expect(WORKSPACE_RESTORE_STORAGE_TARGETS.map((target) => target.id)).toEqual(
      WORKSPACE_TRANSFER_AREA_IDS
    );
    const priorRaw = priorRawValues();
    const harness = instrumentedStorage(priorRaw);
    const recovery = recoveryBoundary();
    const live = { current: currentLiveState() };
    const originalLive = structuredClone(live.current);
    const outcomes: WorkspaceRestoreLiveOutcome[] = [];
    const executor = new WorkspaceRestoreExecutorCore();

    const applied = executor.applyDurable(
      planFor(sourceLiveState(), live.current),
      execution(harness.storage, live, recovery, { outcomes })
    );

    expect(applied).toMatchObject({ status: "applied", mode: "durable" });
    expect(harness.reads).toEqual([
      ...WORKSPACE_RESTORE_STORAGE_TARGETS.map((target) => target.key),
      ...WORKSPACE_RESTORE_STORAGE_TARGETS.map((target) => target.key)
    ]);
    expect(harness.mutations.slice(0, 10)).toEqual(
      WORKSPACE_RESTORE_STORAGE_TARGETS.map((target) => `set:${target.key}`)
    );
    expect(outcomes).toHaveLength(1);
    expect(live.current["hiscores-last-player"]).toEqual({ player: "Restore Hero" });
    expect(live.current["manual-price-overrides"].items[itemId]?.price).toBe(321);
    expect(recovery.prepareExternalApply).toHaveBeenCalledTimes(1);
    expect(recovery.completeExternalApply).toHaveBeenCalledWith(WORKSPACE_TRANSFER_AREA_IDS);

    const undone = executor.undo(execution(harness.storage, live, recovery, { outcomes }));

    expect(undone).toMatchObject({ status: "undone", mode: "durable" });
    expect(Object.fromEntries(harness.values)).toEqual(priorRaw);
    expect(live.current).toEqual(originalLive);
    expect(recovery.completeExternalUndo).toHaveBeenCalledWith(WORKSPACE_TRANSFER_AREA_IDS);
    expect(executor.hasPendingUndo()).toBe(false);
  });

  it("rolls an nth write failure back exactly and exposes only explicit session-only Apply", () => {
    const priorRaw = priorRawValues();
    const harness = instrumentedStorage(priorRaw);
    harness.setFailure(4);
    const recovery = recoveryBoundary();
    const live = { current: currentLiveState() };
    const before = structuredClone(live.current);
    const executor = new WorkspaceRestoreExecutorCore();

    const failed = executor.applyDurable(
      planFor(sourceLiveState(), live.current),
      execution(harness.storage, live, recovery)
    );

    expect(failed).toMatchObject({
      status: "session-only-available",
      reason: "write-failed"
    });
    expect(Object.fromEntries(harness.values)).toEqual(priorRaw);
    expect(live.current).toEqual(before);
    expect(recovery.prepareExternalApply).not.toHaveBeenCalled();
    expect(recovery.recordExternalApplyFailure).toHaveBeenCalledWith([
      { id: "loot-settings", reason: "save_failed" }
    ]);

    const session = executor.applyForSession(
      planFor(sourceLiveState(), live.current),
      execution(harness.storage, live, recovery)
    );
    expect(session).toMatchObject({ status: "applied", mode: "session-only" });
    expect(Object.fromEntries(harness.values)).toEqual(priorRaw);
    expect(live.current).not.toEqual(before);
  });

  it("rolls an nth clear failure back to exact prior selected and manual raw values", () => {
    const source = sourceLiveState();
    source["selected-price-set"] = null;
    source["manual-price-overrides"] = { items: {} };
    const current = currentLiveState();
    current["selected-price-set"] = runtime.priceSet;
    current["manual-price-overrides"] = {
      items: { [itemId]: { price: 900, updatedAt: fixedNow.toISOString() } }
    };
    const selected = ["selected-price-set", "manual-price-overrides"] as const;
    const priorRaw = Object.fromEntries(
      WORKSPACE_RESTORE_STORAGE_TARGETS.filter((target) =>
        selected.includes(target.id as never)
      ).map((target) => [target.key, `prior:${target.id}`])
    );
    const harness = instrumentedStorage(priorRaw);
    harness.setFailure(2);
    const recovery = recoveryBoundary();
    const live = { current };

    const outcome = new WorkspaceRestoreExecutorCore().applyDurable(
      planFor(source, current, selected),
      execution(harness.storage, live, recovery)
    );

    expect(outcome).toMatchObject({ status: "session-only-available", reason: "write-failed" });
    expect(harness.mutations.slice(0, 2)).toEqual([
      "clear:index-sim:price-set:selected",
      "clear:index-sim:manual-price-overrides"
    ]);
    expect(Object.fromEntries(harness.values)).toEqual(priorRaw);
    expect(recovery.recordExternalApplyFailure).toHaveBeenCalledWith([
      { id: "manual-price-overrides", reason: "clear_failed" }
    ]);
  });

  it("marks every affected id and refuses session-only success when rollback fails", () => {
    const priorRaw = priorRawValues();
    const harness = instrumentedStorage(priorRaw);
    harness.setFailure(3, WORKSPACE_RESTORE_STORAGE_TARGETS[1]!.key);
    const recovery = recoveryBoundary();
    const live = { current: currentLiveState() };
    const before = structuredClone(live.current);

    const outcome = new WorkspaceRestoreExecutorCore().applyDurable(
      planFor(sourceLiveState(), live.current),
      execution(harness.storage, live, recovery)
    );

    expect(outcome).toMatchObject({
      status: "failed",
      reason: "rollback-failed",
      recoveryRequired: true
    });
    expect(live.current).toEqual(before);
    expect(recovery.recordExternalApplyFailure).toHaveBeenCalledWith(
      [
        { id: "rewrite-setup", reason: "save_failed" },
        { id: "planner-ui", reason: "save_failed" },
        { id: "loot-prefs", reason: "save_failed" }
      ],
      true
    );
    expect(outcome.message).not.toContain("private");
  });

  it("keeps unavailable and safe-session storage untouched until explicit session Apply and live-only Undo", () => {
    const harness = instrumentedStorage(priorRawValues());
    const recovery = recoveryBoundary();
    const live = { current: currentLiveState() };
    const before = structuredClone(live.current);
    const executor = new WorkspaceRestoreExecutorCore();
    const plan = planFor(sourceLiveState(), live.current);

    expect(
      executor.applyDurable(
        plan,
        execution(harness.storage, live, recovery, { persistenceUnavailable: true })
      )
    ).toMatchObject({ status: "session-only-available", reason: "unavailable" });
    expect(harness.reads).toEqual([]);
    expect(harness.mutations).toEqual([]);
    expect(live.current).toEqual(before);

    expect(
      executor.applyForSession(
        plan,
        execution(harness.storage, live, recovery, { persistenceUnavailable: true })
      )
    ).toMatchObject({ status: "applied", mode: "session-only" });
    expect(harness.mutations).toEqual([]);
    expect(live.current).not.toEqual(before);

    expect(
      executor.undo(execution(harness.storage, live, recovery, { persistenceUnavailable: true }))
    ).toMatchObject({ status: "undone", mode: "session-only" });
    expect(live.current).toEqual(before);
    expect(harness.mutations).toEqual([]);
  });

  it("rolls durable storage back when the single live outcome boundary fails", () => {
    const priorRaw = priorRawValues();
    const harness = instrumentedStorage(priorRaw);
    const recovery = recoveryBoundary();
    const live = { current: currentLiveState() };
    const before = structuredClone(live.current);

    const outcome = new WorkspaceRestoreExecutorCore().applyDurable(
      planFor(sourceLiveState(), live.current),
      execution(harness.storage, live, recovery, { failLiveAt: 1 })
    );

    expect(outcome).toMatchObject({ status: "failed", reason: "live-apply-failed" });
    expect(Object.fromEntries(harness.values)).toEqual(priorRaw);
    expect(live.current).toEqual(before);
    expect(recovery.cancelExternalApply).toHaveBeenCalledWith(WORKSPACE_TRANSFER_AREA_IDS);
    expect(executorMessage(outcome)).not.toContain("private");
  });

  it("keeps post-restore durable bytes after a rolled-back Undo failure and offers truthful live-only Undo", () => {
    const harness = instrumentedStorage(priorRawValues());
    const recovery = recoveryBoundary();
    const live = { current: currentLiveState() };
    const before = structuredClone(live.current);
    const executor = new WorkspaceRestoreExecutorCore();
    const applied = executor.applyDurable(
      planFor(sourceLiveState(), live.current),
      execution(harness.storage, live, recovery)
    );
    expect(applied.status).toBe("applied");
    const postRestoreRaw = Object.fromEntries(harness.values);
    harness.setFailure(harness.mutations.length + 2);

    const durableUndo = executor.undo(execution(harness.storage, live, recovery));

    expect(durableUndo).toMatchObject({ status: "session-only-available" });
    expect(Object.fromEntries(harness.values)).toEqual(postRestoreRaw);
    expect(live.current).not.toEqual(before);

    const sessionUndo = executor.undoForSession(execution(harness.storage, live, recovery));
    expect(sessionUndo).toMatchObject({ status: "undone", mode: "session-only" });
    expect(live.current).toEqual(before);
    expect(Object.fromEntries(harness.values)).toEqual(postRestoreRaw);
  });
});

function executorMessage(outcome: { message: string }): string {
  return outcome.message;
}

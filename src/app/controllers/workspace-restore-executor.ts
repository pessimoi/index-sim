import { z } from "zod";
import {
  HISCORES_LAST_PLAYER_STORAGE_KEY,
  HISCORES_LAST_PLAYER_STORAGE_VERSION,
  LastHiscoresPlayerStateSchema
} from "@/adapters/hiscores";
import type { BrowserStorageAccess } from "../application-recovery";
import {
  DUEL_SNAPSHOTS_STORAGE_KEY,
  DUEL_SNAPSHOTS_VERSION,
  DuelSnapshotsStateSchema
} from "../state/duel-snapshots";
import {
  HIDDEN_GEAR_TIERS_STORAGE_KEY,
  HIDDEN_GEAR_TIERS_VERSION,
  HiddenGearTiersStateSchema
} from "../state/hidden-gear-tiers";
import {
  LOOT_PREFS_STORAGE_KEY,
  LOOT_PREFS_VERSION,
  LootPrefsStateSchema
} from "../state/loot-prefs";
import {
  LOOT_SETTINGS_STORAGE_KEY,
  LOOT_SETTINGS_VERSION,
  LootSettingsByMonsterSchema
} from "../state/loot-settings";
import {
  MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
  MANUAL_PRICE_OVERRIDES_VERSION,
  ManualPriceOverridesStateSchema
} from "../state/manual-price-overrides";
import type { LocalStateHealthItemId, LocalStateStorageFailure } from "../state/local-state-health";
import { PLANNER_UI_STORAGE_KEY, PLANNER_UI_VERSION, PlannerUiStateSchema } from "../state/planner";
import {
  PRICE_HISTORY_STORAGE_KEY,
  PRICE_HISTORY_VERSION,
  BrowserPriceHistoryStateSchema
} from "../state/price-history";
import {
  SELECTED_PRICE_SET_STORAGE_KEY,
  SELECTED_PRICE_SET_VERSION,
  SelectedPriceSetStateSchema
} from "../state/selected-price-set";
import {
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  SavedSetupSchema
} from "../state/ui-state";
import {
  WORKSPACE_AREA_REGISTRY,
  WORKSPACE_TRANSFER_AREA_IDS,
  type WorkspaceLiveState,
  type WorkspaceTransferAreaId
} from "../state/workspace-backup";
import type { WorkspacePrepareImportContext } from "./workspace-file-transfer-review";
import {
  composeWorkspaceRestorePrices,
  type WorkspaceRestorePlan,
  type WorkspaceRestorePriceComposition,
  type WorkspaceRestoreSelectedAreaPlan
} from "./workspace-restore-plan";

export interface WorkspaceRestoreLiveOutcome {
  selectedIds: readonly WorkspaceTransferAreaId[];
  liveState: WorkspaceLiveState;
  priceComposition: WorkspaceRestorePriceComposition;
}

export interface WorkspaceRestoreRecoveryBoundary {
  prepareExternalApply(ids: readonly LocalStateHealthItemId[]): void;
  cancelExternalApply(ids: readonly LocalStateHealthItemId[]): void;
  completeExternalApply(ids: readonly LocalStateHealthItemId[]): void;
  completeExternalUndo(ids: readonly LocalStateHealthItemId[]): void;
  recordExternalApplyFailure(
    failures: readonly LocalStateStorageFailure[],
    blockPersistence?: boolean
  ): void;
  markPersistenceUnavailable(): void;
}

export interface WorkspaceRestoreExecutionInput {
  storageAccess: BrowserStorageAccess;
  persistenceUnavailable: boolean;
  context: WorkspacePrepareImportContext;
  applyLiveState(outcome: WorkspaceRestoreLiveOutcome): void;
  recovery: WorkspaceRestoreRecoveryBoundary;
  now(): Date;
}

export type WorkspaceRestoreApplyOutcome =
  | {
      status: "applied";
      mode: "durable" | "session-only";
      selectedIds: readonly WorkspaceTransferAreaId[];
      message: string;
    }
  | {
      status: "session-only-available";
      reason: "unavailable" | "write-failed";
      message: string;
    }
  | {
      status: "failed";
      reason: "invalid-plan" | "rollback-failed" | "live-apply-failed";
      recoveryRequired: boolean;
      message: string;
    };

export type WorkspaceRestoreUndoOutcome =
  | {
      status: "undone";
      mode: "durable" | "session-only";
      message: string;
    }
  | {
      status: "session-only-available";
      reason: "write-failed";
      message: string;
    }
  | {
      status: "failed";
      reason: "no-undo" | "rollback-failed" | "live-apply-failed";
      recoveryRequired: boolean;
      message: string;
    };

interface WorkspaceStorageTarget {
  id: WorkspaceTransferAreaId;
  key: string;
}

export const WORKSPACE_RESTORE_STORAGE_TARGETS: readonly WorkspaceStorageTarget[] = [
  { id: "rewrite-setup", key: REWRITE_SETUP_STORAGE_KEY },
  { id: "planner-ui", key: PLANNER_UI_STORAGE_KEY },
  { id: "loot-prefs", key: LOOT_PREFS_STORAGE_KEY },
  { id: "loot-settings", key: LOOT_SETTINGS_STORAGE_KEY },
  { id: "hidden-gear-tiers", key: HIDDEN_GEAR_TIERS_STORAGE_KEY },
  { id: "duel-snapshots", key: DUEL_SNAPSHOTS_STORAGE_KEY },
  { id: "price-history", key: PRICE_HISTORY_STORAGE_KEY },
  { id: "selected-price-set", key: SELECTED_PRICE_SET_STORAGE_KEY },
  { id: "manual-price-overrides", key: MANUAL_PRICE_OVERRIDES_STORAGE_KEY },
  { id: "hiscores-last-player", key: HISCORES_LAST_PLAYER_STORAGE_KEY }
];

interface RawOperation extends WorkspaceStorageTarget {
  intent: "write" | "clear";
  targetRaw: string | null;
}

interface RawBatchSuccess {
  status: "written";
  preimages: Map<string, string | null>;
}

interface RawBatchUnavailable {
  status: "unavailable";
}

interface RawBatchFailure {
  status: "failed";
  failedOperation: RawOperation;
  affectedOperations: readonly RawOperation[];
  rollbackFailedOperations: readonly RawOperation[];
  preimages: Map<string, string | null>;
}

type RawBatchResult = RawBatchSuccess | RawBatchUnavailable | RawBatchFailure;

interface PreparedRestore {
  selectedIds: readonly WorkspaceTransferAreaId[];
  operations: readonly RawOperation[];
  priorValues: Partial<Record<WorkspaceTransferAreaId, unknown>>;
  priorLiveOutcome: WorkspaceRestoreLiveOutcome;
  targetLiveOutcome: WorkspaceRestoreLiveOutcome;
}

interface WorkspaceUndoRecord {
  mode: "durable" | "session-only";
  selectedIds: readonly WorkspaceTransferAreaId[];
  priorValues: Partial<Record<WorkspaceTransferAreaId, unknown>>;
  rawPreimages: Map<string, string | null> | null;
  sessionOnlyAvailable: boolean;
}

function canonicalJson(value: unknown): string {
  const normalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (candidate === null || typeof candidate !== "object") return candidate;
    return Object.fromEntries(
      Object.entries(candidate as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)])
    );
  };
  return JSON.stringify(normalize(value));
}

function persistedRaw<T>(version: number, schema: z.ZodType<T>, value: T, now: Date): string {
  const data = schema.parse(value);
  return JSON.stringify({ version, savedAt: now.toISOString(), data });
}

function storageTarget(id: WorkspaceTransferAreaId): WorkspaceStorageTarget {
  const target = WORKSPACE_RESTORE_STORAGE_TARGETS.find((candidate) => candidate.id === id);
  if (!target) throw new Error("unregistered Workspace restore target");
  return target;
}

function validateLogicalValue(
  id: WorkspaceTransferAreaId,
  value: unknown,
  allowMissingHiscores: boolean
): unknown {
  if (id === "hiscores-last-player" && value === null && allowMissingHiscores) return null;
  const registration = WORKSPACE_AREA_REGISTRY[id] as {
    codec: { parse(input: unknown): unknown };
  };
  return registration.codec.parse(value);
}

function serializeArea(
  area: WorkspaceRestoreSelectedAreaPlan,
  value: unknown,
  now: Date
): RawOperation {
  const target = storageTarget(area.id);
  const expectedClear =
    (area.id === "selected-price-set" && value === null) ||
    (area.id === "manual-price-overrides" &&
      Object.keys(ManualPriceOverridesStateSchema.parse(value).items).length === 0);
  if ((area.persistence.intent === "clear") !== expectedClear) {
    throw new Error("invalid Workspace persistence intent");
  }
  if (
    area.persistence.intent === "write" &&
    canonicalJson(area.persistence.value) !== canonicalJson(value)
  ) {
    throw new Error("stale Workspace persistence value");
  }
  if (expectedClear) return { ...target, intent: "clear", targetRaw: null };

  let targetRaw: string;
  switch (area.id) {
    case "rewrite-setup":
      targetRaw = persistedRaw(REWRITE_SETUP_VERSION, SavedSetupSchema, value, now);
      break;
    case "planner-ui":
      targetRaw = persistedRaw(PLANNER_UI_VERSION, PlannerUiStateSchema, value, now);
      break;
    case "loot-prefs":
      targetRaw = persistedRaw(LOOT_PREFS_VERSION, LootPrefsStateSchema, value, now);
      break;
    case "loot-settings":
      targetRaw = persistedRaw(LOOT_SETTINGS_VERSION, LootSettingsByMonsterSchema, value, now);
      break;
    case "hidden-gear-tiers":
      targetRaw = persistedRaw(HIDDEN_GEAR_TIERS_VERSION, HiddenGearTiersStateSchema, value, now);
      break;
    case "duel-snapshots":
      targetRaw = persistedRaw(DUEL_SNAPSHOTS_VERSION, DuelSnapshotsStateSchema, value, now);
      break;
    case "price-history":
      targetRaw = persistedRaw(PRICE_HISTORY_VERSION, BrowserPriceHistoryStateSchema, value, now);
      break;
    case "selected-price-set": {
      const selectedAt = now.toISOString();
      targetRaw = persistedRaw(
        SELECTED_PRICE_SET_VERSION,
        SelectedPriceSetStateSchema,
        { priceSet: value, selectedAt },
        now
      );
      break;
    }
    case "manual-price-overrides":
      targetRaw = persistedRaw(
        MANUAL_PRICE_OVERRIDES_VERSION,
        ManualPriceOverridesStateSchema,
        value,
        now
      );
      break;
    case "hiscores-last-player":
      targetRaw = persistedRaw(
        HISCORES_LAST_PLAYER_STORAGE_VERSION,
        LastHiscoresPlayerStateSchema,
        value,
        now
      );
      break;
  }
  return { ...target, intent: "write", targetRaw };
}

function restoreRawOperations(
  storage: BrowserStorageAccess["storage"],
  operations: readonly RawOperation[],
  preimages: ReadonlyMap<string, string | null>
): readonly RawOperation[] {
  const failures: RawOperation[] = [];
  for (const operation of [...operations].reverse()) {
    try {
      const raw = preimages.get(operation.key) ?? null;
      if (raw === null) storage.removeItem(operation.key);
      else storage.setItem(operation.key, raw);
    } catch {
      failures.push(operation);
    }
  }
  return failures;
}

function executeRawBatch(
  storage: BrowserStorageAccess["storage"],
  operations: readonly RawOperation[]
): RawBatchResult {
  const preimages = new Map<string, string | null>();
  try {
    for (const operation of operations)
      preimages.set(operation.key, storage.getItem(operation.key));
  } catch {
    return { status: "unavailable" };
  }

  const affected: RawOperation[] = [];
  for (const operation of operations) {
    affected.push(operation);
    try {
      if (operation.targetRaw === null) storage.removeItem(operation.key);
      else storage.setItem(operation.key, operation.targetRaw);
    } catch {
      return {
        status: "failed",
        failedOperation: operation,
        affectedOperations: affected,
        rollbackFailedOperations: restoreRawOperations(storage, affected, preimages),
        preimages
      };
    }
  }
  return { status: "written", preimages };
}

function storageFailure(operation: RawOperation): LocalStateStorageFailure {
  return {
    id: operation.id,
    reason: operation.intent === "clear" ? "clear_failed" : "save_failed"
  };
}

function liveOutcome(
  liveState: WorkspaceLiveState,
  selectedIds: readonly WorkspaceTransferAreaId[],
  context: WorkspacePrepareImportContext
): WorkspaceRestoreLiveOutcome {
  return {
    selectedIds,
    liveState,
    priceComposition: composeWorkspaceRestorePrices({
      liveState,
      gameData: context.gameData,
      priceFallback: context.priceFallback
    })
  };
}

function prepareRestore(
  plan: WorkspaceRestorePlan,
  input: WorkspaceRestoreExecutionInput
): PreparedRestore | null {
  if (!plan.canApply || plan.status !== "ready" || plan.selectedAreas.length === 0) return null;
  const byId = new Map(plan.selectedAreas.map((area) => [area.id, area]));
  if (byId.size !== plan.selectedAreas.length) return null;
  const selectedIds = WORKSPACE_TRANSFER_AREA_IDS.filter((id) => byId.has(id));
  if (
    selectedIds.length !== plan.selectedIds.length ||
    canonicalJson(selectedIds) !== canonicalJson(plan.selectedIds)
  ) {
    return null;
  }

  const targetLiveState = { ...input.context.liveState } as WorkspaceLiveState;
  const priorValues: Partial<Record<WorkspaceTransferAreaId, unknown>> = {};
  const operations: RawOperation[] = [];
  const now = input.now();
  try {
    for (const id of selectedIds) {
      const area = byId.get(id);
      if (!area) return null;
      const prior = validateLogicalValue(id, input.context.liveState[id], true);
      const next = validateLogicalValue(id, area.nextLiveValue, false);
      priorValues[id] = prior;
      (targetLiveState as unknown as Record<string, unknown>)[id] = next;
      operations.push(serializeArea(area, next, now));
    }
  } catch {
    return null;
  }

  return {
    selectedIds,
    operations,
    priorValues,
    priorLiveOutcome: liveOutcome(input.context.liveState, selectedIds, input.context),
    targetLiveOutcome: liveOutcome(targetLiveState, selectedIds, input.context)
  };
}

function undoLiveOutcome(
  record: WorkspaceUndoRecord,
  input: WorkspaceRestoreExecutionInput
): WorkspaceRestoreLiveOutcome | null {
  const target = { ...input.context.liveState } as WorkspaceLiveState;
  try {
    for (const id of record.selectedIds) {
      const prior = validateLogicalValue(id, record.priorValues[id], true);
      (target as unknown as Record<string, unknown>)[id] = prior;
    }
    return liveOutcome(target, record.selectedIds, input.context);
  } catch {
    return null;
  }
}

function rawUndoOperations(record: WorkspaceUndoRecord): readonly RawOperation[] {
  if (!record.rawPreimages) return [];
  return record.selectedIds.map((id) => {
    const target = storageTarget(id);
    const targetRaw = record.rawPreimages?.get(target.key) ?? null;
    return { ...target, intent: targetRaw === null ? "clear" : "write", targetRaw };
  });
}

function rollbackFailureOutcome(): WorkspaceRestoreApplyOutcome {
  return {
    status: "failed",
    reason: "rollback-failed",
    recoveryRequired: true,
    message:
      "Workspace restore could not be completed and saved data could not be fully rolled back. Review Local state recovery before retrying."
  };
}

export class WorkspaceRestoreExecutorCore {
  private undoRecord: WorkspaceUndoRecord | null = null;

  hasPendingUndo = (): boolean => this.undoRecord !== null;

  applyDurable = (
    plan: WorkspaceRestorePlan,
    input: WorkspaceRestoreExecutionInput
  ): WorkspaceRestoreApplyOutcome => {
    const prepared = prepareRestore(plan, input);
    if (!prepared) {
      return {
        status: "failed",
        reason: "invalid-plan",
        recoveryRequired: false,
        message: "Workspace restore plan is no longer valid. Review the file again."
      };
    }
    if (input.persistenceUnavailable) {
      input.recovery.markPersistenceUnavailable();
      return {
        status: "session-only-available",
        reason: "unavailable",
        message:
          "Saved browser data is unavailable. No changes were made. You can apply this reviewed plan for the current session only."
      };
    }

    const batch = executeRawBatch(input.storageAccess.storage, prepared.operations);
    if (batch.status === "unavailable") {
      input.recovery.markPersistenceUnavailable();
      return {
        status: "session-only-available",
        reason: "unavailable",
        message:
          "Saved browser data is unavailable. No changes were made. You can apply this reviewed plan for the current session only."
      };
    }
    if (batch.status === "failed") {
      if (batch.rollbackFailedOperations.length > 0) {
        input.recovery.recordExternalApplyFailure(
          batch.affectedOperations.map(storageFailure),
          true
        );
        return rollbackFailureOutcome();
      }
      input.recovery.recordExternalApplyFailure([storageFailure(batch.failedOperation)]);
      return {
        status: "session-only-available",
        reason: "write-failed",
        message:
          "Workspace restore could not be saved. Storage was rolled back exactly and no live values changed. You can apply this reviewed plan for the current session only."
      };
    }

    input.recovery.prepareExternalApply(prepared.selectedIds);
    try {
      input.applyLiveState(prepared.targetLiveOutcome);
    } catch {
      const rollbackFailures = restoreRawOperations(
        input.storageAccess.storage,
        prepared.operations,
        batch.preimages
      );
      try {
        input.applyLiveState(prepared.priorLiveOutcome);
      } catch {
        // Fixed failure copy below covers an uncertain live setter boundary.
      }
      input.recovery.cancelExternalApply(prepared.selectedIds);
      if (rollbackFailures.length > 0) {
        input.recovery.recordExternalApplyFailure(prepared.operations.map(storageFailure), true);
      }
      return {
        status: "failed",
        reason: rollbackFailures.length > 0 ? "rollback-failed" : "live-apply-failed",
        recoveryRequired: rollbackFailures.length > 0,
        message:
          "Workspace restore could not be applied safely. Current values were not accepted. Review Local state recovery if saved-data attention is shown."
      };
    }

    input.recovery.completeExternalApply(prepared.selectedIds);
    this.undoRecord = {
      mode: "durable",
      selectedIds: prepared.selectedIds,
      priorValues: prepared.priorValues,
      rawPreimages: batch.preimages,
      sessionOnlyAvailable: false
    };
    return {
      status: "applied",
      mode: "durable",
      selectedIds: prepared.selectedIds,
      message: `Restored ${prepared.selectedIds.length} Workspace areas. Undo is available.`
    };
  };

  applyForSession = (
    plan: WorkspaceRestorePlan,
    input: WorkspaceRestoreExecutionInput
  ): WorkspaceRestoreApplyOutcome => {
    const prepared = prepareRestore(plan, input);
    if (!prepared) {
      return {
        status: "failed",
        reason: "invalid-plan",
        recoveryRequired: false,
        message: "Workspace restore plan is no longer valid. Review the file again."
      };
    }
    input.recovery.prepareExternalApply(prepared.selectedIds);
    try {
      input.applyLiveState(prepared.targetLiveOutcome);
    } catch {
      try {
        input.applyLiveState(prepared.priorLiveOutcome);
      } catch {
        // Fixed failure copy below covers an uncertain live setter boundary.
      }
      input.recovery.cancelExternalApply(prepared.selectedIds);
      return {
        status: "failed",
        reason: "live-apply-failed",
        recoveryRequired: false,
        message: "Workspace restore could not be applied safely. Current values were not accepted."
      };
    }
    this.undoRecord = {
      mode: "session-only",
      selectedIds: prepared.selectedIds,
      priorValues: prepared.priorValues,
      rawPreimages: null,
      sessionOnlyAvailable: false
    };
    return {
      status: "applied",
      mode: "session-only",
      selectedIds: prepared.selectedIds,
      message: `Restored ${prepared.selectedIds.length} Workspace areas for this session only. Changes will be lost on reload; Undo is available.`
    };
  };

  undo = (input: WorkspaceRestoreExecutionInput): WorkspaceRestoreUndoOutcome => {
    const record = this.undoRecord;
    if (!record) {
      return {
        status: "failed",
        reason: "no-undo",
        recoveryRequired: false,
        message: "Workspace Undo is no longer available."
      };
    }
    if (record.mode === "session-only") return this.undoForSession(input, false);
    const targetLiveOutcome = undoLiveOutcome(record, input);
    if (!targetLiveOutcome) {
      return {
        status: "failed",
        reason: "live-apply-failed",
        recoveryRequired: false,
        message: "Workspace Undo is no longer compatible with the current session."
      };
    }
    const operations = rawUndoOperations(record);
    const batch = executeRawBatch(input.storageAccess.storage, operations);
    if (batch.status === "unavailable") {
      record.sessionOnlyAvailable = true;
      input.recovery.markPersistenceUnavailable();
      return {
        status: "session-only-available",
        reason: "write-failed",
        message:
          "Workspace Undo could not update saved data. The restored Workspace remains active. You can restore the prior live values for this session only."
      };
    }
    if (batch.status === "failed") {
      if (batch.rollbackFailedOperations.length > 0) {
        input.recovery.recordExternalApplyFailure(
          batch.affectedOperations.map(storageFailure),
          true
        );
        return {
          status: "failed",
          reason: "rollback-failed",
          recoveryRequired: true,
          message:
            "Workspace Undo could not be completed and saved data could not be fully rolled back. Review Local state recovery."
        };
      }
      record.sessionOnlyAvailable = true;
      input.recovery.recordExternalApplyFailure([storageFailure(batch.failedOperation)]);
      return {
        status: "session-only-available",
        reason: "write-failed",
        message:
          "Workspace Undo could not update saved data. The restored Workspace remains active. You can restore the prior live values for this session only."
      };
    }

    const currentLiveOutcome = liveOutcome(
      input.context.liveState,
      record.selectedIds,
      input.context
    );
    input.recovery.prepareExternalApply(record.selectedIds);
    try {
      input.applyLiveState(targetLiveOutcome);
    } catch {
      const rollbackFailures = restoreRawOperations(
        input.storageAccess.storage,
        operations,
        batch.preimages
      );
      try {
        input.applyLiveState(currentLiveOutcome);
      } catch {
        // Fixed failure copy below covers an uncertain live setter boundary.
      }
      input.recovery.cancelExternalApply(record.selectedIds);
      if (rollbackFailures.length > 0) {
        input.recovery.recordExternalApplyFailure(operations.map(storageFailure), true);
      }
      return {
        status: "failed",
        reason: rollbackFailures.length > 0 ? "rollback-failed" : "live-apply-failed",
        recoveryRequired: rollbackFailures.length > 0,
        message:
          "Workspace Undo could not be applied safely. The restored Workspace remains active."
      };
    }
    input.recovery.completeExternalUndo(record.selectedIds);
    this.undoRecord = null;
    return {
      status: "undone",
      mode: "durable",
      message: "Restored the Workspace state from before the durable restore."
    };
  };

  undoForSession = (
    input: WorkspaceRestoreExecutionInput,
    requireOffer = true
  ): WorkspaceRestoreUndoOutcome => {
    const record = this.undoRecord;
    if (!record || (requireOffer && !record.sessionOnlyAvailable)) {
      return {
        status: "failed",
        reason: "no-undo",
        recoveryRequired: false,
        message: "Session-only Workspace Undo is no longer available."
      };
    }
    const targetLiveOutcome = undoLiveOutcome(record, input);
    if (!targetLiveOutcome) {
      return {
        status: "failed",
        reason: "live-apply-failed",
        recoveryRequired: false,
        message: "Workspace Undo is no longer compatible with the current session."
      };
    }
    const currentLiveOutcome = liveOutcome(
      input.context.liveState,
      record.selectedIds,
      input.context
    );
    input.recovery.prepareExternalApply(record.selectedIds);
    try {
      input.applyLiveState(targetLiveOutcome);
    } catch {
      try {
        input.applyLiveState(currentLiveOutcome);
      } catch {
        // Fixed failure copy below covers an uncertain live setter boundary.
      }
      input.recovery.cancelExternalApply(record.selectedIds);
      return {
        status: "failed",
        reason: "live-apply-failed",
        recoveryRequired: false,
        message: "Workspace Undo could not be applied safely. Current live values were retained."
      };
    }
    this.undoRecord = null;
    return {
      status: "undone",
      mode: "session-only",
      message: "Restored the Workspace live state for this session only. Saved data was unchanged."
    };
  };
}

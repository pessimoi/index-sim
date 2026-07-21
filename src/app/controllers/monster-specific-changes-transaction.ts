import { z } from "zod";
import type { BrowserStorageAccess } from "../application-recovery";
import {
  deriveMonsterSpecificRemoval,
  type MonsterSpecificLiveState,
  type MonsterSpecificRemovalCandidate,
  type MonsterSpecificStorageAreaId
} from "../state/monster-specific-changes";
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
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  SavedSetupSchema
} from "../state/ui-state";
import type { LocalStateHealthItemId, LocalStateStorageFailure } from "../state/local-state-health";
import {
  executeLocalStateBatch,
  restoreLocalStateBatch,
  type LocalStateBatchOperation
} from "./local-state-batch";

export interface MonsterSpecificLiveOutcome {
  selectedIds: readonly MonsterSpecificStorageAreaId[];
  liveState: MonsterSpecificLiveState;
}

export interface MonsterSpecificRecoveryBoundary {
  canStartDurableWrite(ids: readonly LocalStateHealthItemId[]): boolean;
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

export interface MonsterSpecificExecutionInput {
  storageAccess: BrowserStorageAccess;
  persistenceUnavailable: boolean;
  liveState: MonsterSpecificLiveState;
  applyLiveState(outcome: MonsterSpecificLiveOutcome): void;
  recovery: MonsterSpecificRecoveryBoundary;
  now(): Date;
}

export type MonsterSpecificApplyOutcome =
  | {
      status: "applied";
      mode: "durable" | "session-only";
      selectedIds: readonly MonsterSpecificStorageAreaId[];
      message: string;
    }
  | {
      status: "session-only-available";
      reason: "unavailable" | "write-failed";
      message: string;
    }
  | {
      status: "stale" | "no-op" | "failed";
      recoveryRequired: boolean;
      message: string;
    };

export type MonsterSpecificUndoOutcome =
  | { status: "undone"; mode: "durable" | "session-only"; message: string }
  | { status: "session-only-available"; message: string }
  | { status: "failed"; recoveryRequired: boolean; message: string };

type RawOperation = LocalStateBatchOperation<MonsterSpecificStorageAreaId>;

interface PreparedRemoval {
  monsterName: string;
  selectedIds: readonly MonsterSpecificStorageAreaId[];
  operations: readonly RawOperation[];
  prior: MonsterSpecificLiveOutcome;
  next: MonsterSpecificLiveOutcome;
}

interface UndoRecord {
  mode: "durable" | "session-only";
  monsterName: string;
  selectedIds: readonly MonsterSpecificStorageAreaId[];
  prior: MonsterSpecificLiveState;
  rawPreimages: Map<string, string | null> | null;
  sessionOnlyAvailable: boolean;
}

const STORAGE_TARGETS: Readonly<Record<MonsterSpecificStorageAreaId, string>> = {
  "rewrite-setup": REWRITE_SETUP_STORAGE_KEY,
  "loot-prefs": LOOT_PREFS_STORAGE_KEY,
  "loot-settings": LOOT_SETTINGS_STORAGE_KEY
};

function persistedRaw<T>(version: number, schema: z.ZodType<T>, value: T, now: Date): string {
  return JSON.stringify({ version, savedAt: now.toISOString(), data: schema.parse(value) });
}

function serializeArea(
  id: MonsterSpecificStorageAreaId,
  live: MonsterSpecificLiveState,
  now: Date
): RawOperation {
  const key = STORAGE_TARGETS[id];
  switch (id) {
    case "rewrite-setup":
      return {
        id,
        key,
        intent: "write",
        targetRaw: persistedRaw(REWRITE_SETUP_VERSION, SavedSetupSchema, live.setup, now)
      };
    case "loot-prefs":
      return {
        id,
        key,
        intent: "write",
        targetRaw: persistedRaw(LOOT_PREFS_VERSION, LootPrefsStateSchema, live.lootPrefs, now)
      };
    case "loot-settings":
      return {
        id,
        key,
        intent: "write",
        targetRaw: persistedRaw(
          LOOT_SETTINGS_VERSION,
          LootSettingsByMonsterSchema,
          live.lootSettings,
          now
        )
      };
  }
}

function storageFailure(operation: RawOperation): LocalStateStorageFailure {
  return { id: operation.id, reason: "save_failed" };
}

function prepareRemoval(
  candidate: MonsterSpecificRemovalCandidate,
  input: MonsterSpecificExecutionInput
):
  PreparedRemoval | Extract<MonsterSpecificApplyOutcome, { status: "stale" | "no-op" | "failed" }> {
  const derived = deriveMonsterSpecificRemoval(candidate, input.liveState);
  if (derived.status !== "ready") {
    return {
      status: derived.status,
      recoveryRequired: false,
      message: derived.message
    };
  }
  const timestamp = input.now();
  try {
    const selectedIds = derived.candidate.selectedAreaIds;
    return {
      monsterName: derived.candidate.monsterName,
      selectedIds,
      operations: selectedIds.map((id) => serializeArea(id, derived.next, timestamp)),
      prior: { selectedIds, liveState: derived.prior },
      next: { selectedIds, liveState: derived.next }
    };
  } catch {
    return {
      status: "failed",
      recoveryRequired: false,
      message: "Monster changes could not be validated. Review removal again."
    };
  }
}

function isPreparedRemoval(value: ReturnType<typeof prepareRemoval>): value is PreparedRemoval {
  return !("status" in value);
}

function undoOperations(record: UndoRecord): readonly RawOperation[] {
  if (!record.rawPreimages) return [];
  return record.selectedIds.map((id) => {
    const key = STORAGE_TARGETS[id];
    const targetRaw = record.rawPreimages?.get(key) ?? null;
    return { id, key, intent: targetRaw === null ? "clear" : "write", targetRaw };
  });
}

export class MonsterSpecificChangesTransactionCore {
  private undoRecord: UndoRecord | null = null;

  hasPendingUndo = (): boolean => this.undoRecord !== null;

  applyDurable = (
    candidate: MonsterSpecificRemovalCandidate,
    input: MonsterSpecificExecutionInput
  ): MonsterSpecificApplyOutcome => {
    const prepared = prepareRemoval(candidate, input);
    if (!isPreparedRemoval(prepared)) return prepared;
    if (input.persistenceUnavailable) {
      input.recovery.markPersistenceUnavailable();
      return {
        status: "session-only-available",
        reason: "unavailable",
        message:
          "Saved browser data is unavailable. No changes were made. You can remove these changes for this session only."
      };
    }
    if (!input.recovery.canStartDurableWrite(prepared.selectedIds)) {
      return {
        status: "session-only-available",
        reason: "unavailable",
        message:
          "Saved data changed in another tab. No saved values were overwritten. Review the conflict before removing these changes durably."
      };
    }
    const batch = executeLocalStateBatch(input.storageAccess.storage, prepared.operations);
    if (batch.status === "unavailable") {
      input.recovery.markPersistenceUnavailable();
      return {
        status: "session-only-available",
        reason: "unavailable",
        message:
          "Saved browser data is unavailable. No changes were made. You can remove these changes for this session only."
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
          recoveryRequired: true,
          message:
            "Monster changes could not be removed and saved data could not be fully rolled back. Review Local state recovery before retrying."
        };
      }
      input.recovery.recordExternalApplyFailure([storageFailure(batch.failedOperation)]);
      return {
        status: "session-only-available",
        reason: "write-failed",
        message:
          "Monster changes could not be saved. Storage was rolled back exactly and no live values changed. You can remove them for this session only."
      };
    }

    input.recovery.prepareExternalApply(prepared.selectedIds);
    try {
      input.applyLiveState(prepared.next);
    } catch {
      const rollbackFailures = restoreLocalStateBatch(
        input.storageAccess.storage,
        prepared.operations,
        batch.preimages
      );
      try {
        input.applyLiveState(prepared.prior);
      } catch {
        // Fixed failure copy below covers an uncertain live setter boundary.
      }
      input.recovery.cancelExternalApply(prepared.selectedIds);
      if (rollbackFailures.length > 0) {
        input.recovery.recordExternalApplyFailure(prepared.operations.map(storageFailure), true);
      }
      return {
        status: "failed",
        recoveryRequired: rollbackFailures.length > 0,
        message:
          "Monster changes could not be applied safely. Current values were not accepted. Review Local state recovery if saved-data attention is shown."
      };
    }
    input.recovery.completeExternalApply(prepared.selectedIds);
    this.undoRecord = {
      mode: "durable",
      monsterName: prepared.monsterName,
      selectedIds: prepared.selectedIds,
      prior: prepared.prior.liveState,
      rawPreimages: batch.preimages,
      sessionOnlyAvailable: false
    };
    return {
      status: "applied",
      mode: "durable",
      selectedIds: prepared.selectedIds,
      message: `Removed all changes for ${prepared.monsterName}`
    };
  };

  applyForSession = (
    candidate: MonsterSpecificRemovalCandidate,
    input: MonsterSpecificExecutionInput
  ): MonsterSpecificApplyOutcome => {
    const prepared = prepareRemoval(candidate, input);
    if (!isPreparedRemoval(prepared)) return prepared;
    input.recovery.prepareExternalApply(prepared.selectedIds);
    try {
      input.applyLiveState(prepared.next);
    } catch {
      try {
        input.applyLiveState(prepared.prior);
      } catch {
        // Fixed failure copy below covers an uncertain live setter boundary.
      }
      input.recovery.cancelExternalApply(prepared.selectedIds);
      return {
        status: "failed",
        recoveryRequired: false,
        message: "Monster changes could not be applied safely. Current values were not accepted."
      };
    }
    input.recovery.completeExternalApply(prepared.selectedIds);
    this.undoRecord = {
      mode: "session-only",
      monsterName: prepared.monsterName,
      selectedIds: prepared.selectedIds,
      prior: prepared.prior.liveState,
      rawPreimages: null,
      sessionOnlyAvailable: false
    };
    return {
      status: "applied",
      mode: "session-only",
      selectedIds: prepared.selectedIds,
      message: `Removed all changes for ${prepared.monsterName} for this session. Changes may return after reload.`
    };
  };

  undo = (input: MonsterSpecificExecutionInput): MonsterSpecificUndoOutcome => {
    const record = this.undoRecord;
    if (!record) {
      return {
        status: "failed",
        recoveryRequired: false,
        message: "Monster changes Undo is no longer available."
      };
    }
    if (record.mode === "session-only") return this.undoForSession(input, false);
    const target: MonsterSpecificLiveOutcome = {
      selectedIds: record.selectedIds,
      liveState: record.prior
    };
    const operations = undoOperations(record);
    if (!input.recovery.canStartDurableWrite(record.selectedIds)) {
      record.sessionOnlyAvailable = true;
      return {
        status: "session-only-available",
        message:
          "Saved data changed in another tab. Monster changes Undo left the newer saved values unchanged."
      };
    }
    const batch = executeLocalStateBatch(input.storageAccess.storage, operations);
    if (batch.status === "unavailable") {
      record.sessionOnlyAvailable = true;
      input.recovery.markPersistenceUnavailable();
      return {
        status: "session-only-available",
        message:
          "Monster changes Undo could not update saved data. You can restore the prior live values for this session only."
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
          recoveryRequired: true,
          message: "Monster changes Undo could not be completed. Review Local state recovery."
        };
      }
      record.sessionOnlyAvailable = true;
      input.recovery.recordExternalApplyFailure([storageFailure(batch.failedOperation)]);
      return {
        status: "session-only-available",
        message:
          "Monster changes Undo could not update saved data. You can restore the prior live values for this session only."
      };
    }
    const current: MonsterSpecificLiveOutcome = {
      selectedIds: record.selectedIds,
      liveState: input.liveState
    };
    input.recovery.prepareExternalApply(record.selectedIds);
    try {
      input.applyLiveState(target);
    } catch {
      const rollbackFailures = restoreLocalStateBatch(
        input.storageAccess.storage,
        operations,
        batch.preimages
      );
      try {
        input.applyLiveState(current);
      } catch {
        // Fixed failure copy below covers an uncertain live setter boundary.
      }
      input.recovery.cancelExternalApply(record.selectedIds);
      if (rollbackFailures.length > 0) {
        input.recovery.recordExternalApplyFailure(operations.map(storageFailure), true);
      }
      return {
        status: "failed",
        recoveryRequired: rollbackFailures.length > 0,
        message: "Monster changes Undo could not be applied safely."
      };
    }
    input.recovery.completeExternalUndo(record.selectedIds);
    this.undoRecord = null;
    return {
      status: "undone",
      mode: "durable",
      message: `Restored changes for ${record.monsterName}`
    };
  };

  undoForSession = (
    input: MonsterSpecificExecutionInput,
    requireOffer = true
  ): MonsterSpecificUndoOutcome => {
    const record = this.undoRecord;
    if (!record || (requireOffer && !record.sessionOnlyAvailable)) {
      return {
        status: "failed",
        recoveryRequired: false,
        message: "Session-only monster changes Undo is no longer available."
      };
    }
    input.recovery.prepareExternalApply(record.selectedIds);
    try {
      input.applyLiveState({ selectedIds: record.selectedIds, liveState: record.prior });
    } catch {
      input.recovery.cancelExternalApply(record.selectedIds);
      return {
        status: "failed",
        recoveryRequired: false,
        message: "Session-only monster changes Undo could not be applied safely."
      };
    }
    input.recovery.completeExternalUndo(record.selectedIds);
    this.undoRecord = null;
    return {
      status: "undone",
      mode: "session-only",
      message: `Restored changes for ${record.monsterName} for this session`
    };
  };
}

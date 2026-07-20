import type { BrowserStorageAccess } from "../application-recovery";
import {
  DUEL_SNAPSHOTS_STORAGE_KEY,
  DUEL_SNAPSHOTS_VERSION,
  DuelSnapshotsStateSchema,
  fingerprintDuelSnapshots,
  type DuelSnapshotsState
} from "../state/duel-snapshots";
import type { LocalStateStorageFailure } from "../state/local-state-health";

export interface SavedSetupChangesRecoveryBoundary {
  prepareExternalApply(ids: readonly ["duel-snapshots"]): void;
  cancelExternalApply(ids: readonly ["duel-snapshots"]): void;
  completeExternalApply(ids: readonly ["duel-snapshots"]): void;
  completeExternalUndo(ids: readonly ["duel-snapshots"]): void;
  recordExternalApplyFailure(
    failures: readonly LocalStateStorageFailure[],
    blockPersistence?: boolean
  ): void;
  markPersistenceUnavailable(): void;
  unblockReplaced(ids: readonly ["duel-snapshots"]): void;
}

export interface SavedSetupChangesExecutionInput {
  storageAccess: BrowserStorageAccess;
  persistenceUnavailable: boolean;
  persistenceBlocked: boolean;
  liveState: DuelSnapshotsState;
  applyLiveState(next: DuelSnapshotsState): void;
  recovery: SavedSetupChangesRecoveryBoundary;
  now(): Date;
}

export interface SavedSetupChangeRequest {
  current: DuelSnapshotsState;
  next: DuelSnapshotsState;
  actionMessage: string;
  sessionActionMessage: string;
  undoMessage: string;
}

export type SavedSetupChangeApplyOutcome =
  | {
      status: "applied";
      mode: "durable" | "session-only";
      message: string;
      undoMessage: string;
    }
  | {
      status: "session-only-available";
      reason: "unavailable" | "blocked" | "write-failed" | "readback-failed";
      message: string;
    }
  | {
      status: "stale" | "no-op" | "failed";
      recoveryRequired: boolean;
      message: string;
    };

export type SavedSetupChangeUndoOutcome =
  | { status: "undone"; mode: "durable" | "session-only"; message: string }
  | { status: "session-only-available"; message: string }
  | { status: "stale" | "failed"; recoveryRequired: boolean; message: string };

interface PreparedChange {
  current: DuelSnapshotsState;
  next: DuelSnapshotsState;
  currentFingerprint: string;
  nextFingerprint: string;
  actionMessage: string;
  sessionActionMessage: string;
  undoMessage: string;
}

interface UndoRecord extends PreparedChange {
  mode: "durable" | "session-only";
  rawBefore: string | null;
  rawAfter: string | null;
  sessionOnlyAvailable: boolean;
}

const DUEL_SCOPE = ["duel-snapshots"] as const;

function storageFailure(): LocalStateStorageFailure {
  return { id: "duel-snapshots", reason: "save_failed" };
}

function persistedRaw(state: DuelSnapshotsState, now: Date): string {
  return JSON.stringify({
    version: DUEL_SNAPSHOTS_VERSION,
    savedAt: now.toISOString(),
    data: DuelSnapshotsStateSchema.parse(state)
  });
}

function writeExactRaw(storage: BrowserStorageAccess["storage"], raw: string | null): void {
  if (raw === null) storage.removeItem(DUEL_SNAPSHOTS_STORAGE_KEY);
  else storage.setItem(DUEL_SNAPSHOTS_STORAGE_KEY, raw);
}

function writeAndVerify(storage: BrowserStorageAccess["storage"], raw: string | null): boolean {
  try {
    writeExactRaw(storage, raw);
    return storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY) === raw;
  } catch {
    return false;
  }
}

function prepare(
  request: SavedSetupChangeRequest,
  liveState: DuelSnapshotsState
):
  PreparedChange | Extract<SavedSetupChangeApplyOutcome, { status: "stale" | "no-op" | "failed" }> {
  let current: DuelSnapshotsState;
  let next: DuelSnapshotsState;
  try {
    current = DuelSnapshotsStateSchema.parse(request.current);
    next = DuelSnapshotsStateSchema.parse(request.next);
  } catch {
    return {
      status: "failed",
      recoveryRequired: false,
      message: "Saved setup changes could not be validated. Review the action again."
    };
  }
  const currentFingerprint = fingerprintDuelSnapshots(current);
  const nextFingerprint = fingerprintDuelSnapshots(next);
  if (currentFingerprint !== fingerprintDuelSnapshots(liveState)) {
    return {
      status: "stale",
      recoveryRequired: false,
      message: "Saved setups changed. Review the action again."
    };
  }
  if (currentFingerprint === nextFingerprint) {
    return {
      status: "no-op",
      recoveryRequired: false,
      message: "No saved setup changes were selected."
    };
  }
  return {
    current,
    next,
    currentFingerprint,
    nextFingerprint,
    actionMessage: request.actionMessage,
    sessionActionMessage: request.sessionActionMessage,
    undoMessage: request.undoMessage
  };
}

function isPrepared(value: ReturnType<typeof prepare>): value is PreparedChange {
  return !("status" in value);
}

export class SavedSetupChangesTransactionCore {
  private undoRecord: UndoRecord | null = null;

  hasPendingUndo = (): boolean => this.undoRecord !== null;

  invalidateUndo = (): void => {
    this.undoRecord = null;
  };

  applyDurable = (
    request: SavedSetupChangeRequest,
    input: SavedSetupChangesExecutionInput
  ): SavedSetupChangeApplyOutcome => {
    const prepared = prepare(request, input.liveState);
    if (!isPrepared(prepared)) return prepared;
    if (input.persistenceUnavailable || input.storageAccess.storageUnavailable) {
      input.recovery.markPersistenceUnavailable();
      return {
        status: "session-only-available",
        reason: "unavailable",
        message:
          "Saved browser data is unavailable. No saved setups changed. You can apply this action for this session only."
      };
    }
    if (input.persistenceBlocked) {
      return {
        status: "session-only-available",
        reason: "blocked",
        message:
          "Saved setup persistence needs attention. No saved setups changed. You can apply this action for this session only."
      };
    }

    let rawBefore: string | null;
    try {
      rawBefore = input.storageAccess.storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY);
    } catch {
      input.recovery.markPersistenceUnavailable();
      return {
        status: "session-only-available",
        reason: "unavailable",
        message:
          "Saved browser data could not be read. No saved setups changed. You can apply this action for this session only."
      };
    }

    let rawAfter: string;
    try {
      rawAfter = persistedRaw(prepared.next, input.now());
    } catch {
      return {
        status: "failed",
        recoveryRequired: false,
        message: "Saved setup changes could not be validated. Review the action again."
      };
    }

    let writeFailed: boolean;
    try {
      input.storageAccess.storage.setItem(DUEL_SNAPSHOTS_STORAGE_KEY, rawAfter);
      writeFailed = input.storageAccess.storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY) !== rawAfter;
    } catch {
      writeFailed = true;
    }
    if (writeFailed) {
      const rollbackSucceeded = writeAndVerify(input.storageAccess.storage, rawBefore);
      input.recovery.recordExternalApplyFailure([storageFailure()], !rollbackSucceeded);
      return rollbackSucceeded
        ? {
            status: "session-only-available",
            reason: "write-failed",
            message:
              "Saved setup changes could not be saved. Storage was rolled back exactly and no live setups changed. You can apply this action for this session only."
          }
        : {
            status: "failed",
            recoveryRequired: true,
            message:
              "Saved setup changes could not be saved or rolled back exactly. Review Local state recovery before retrying."
          };
    }

    input.recovery.prepareExternalApply(DUEL_SCOPE);
    try {
      input.applyLiveState(prepared.next);
    } catch {
      const rollbackSucceeded = writeAndVerify(input.storageAccess.storage, rawBefore);
      try {
        input.applyLiveState(prepared.current);
      } catch {
        // The fixed failure copy covers an uncertain live setter boundary.
      }
      input.recovery.cancelExternalApply(DUEL_SCOPE);
      if (!rollbackSucceeded) {
        input.recovery.recordExternalApplyFailure([storageFailure()], true);
      }
      return {
        status: "failed",
        recoveryRequired: !rollbackSucceeded,
        message:
          "Saved setup changes could not be applied safely. Current live setups were not accepted. Review Local state recovery if saved-data attention is shown."
      };
    }
    input.recovery.completeExternalApply(DUEL_SCOPE);
    input.recovery.unblockReplaced(DUEL_SCOPE);
    this.undoRecord = {
      ...prepared,
      mode: "durable",
      rawBefore,
      rawAfter,
      sessionOnlyAvailable: false
    };
    return {
      status: "applied",
      mode: "durable",
      message: prepared.actionMessage,
      undoMessage: prepared.undoMessage
    };
  };

  applyForSession = (
    request: SavedSetupChangeRequest,
    input: SavedSetupChangesExecutionInput
  ): SavedSetupChangeApplyOutcome => {
    const prepared = prepare(request, input.liveState);
    if (!isPrepared(prepared)) return prepared;
    input.recovery.prepareExternalApply(DUEL_SCOPE);
    try {
      input.applyLiveState(prepared.next);
    } catch {
      try {
        input.applyLiveState(prepared.current);
      } catch {
        // The fixed failure copy covers an uncertain live setter boundary.
      }
      input.recovery.cancelExternalApply(DUEL_SCOPE);
      return {
        status: "failed",
        recoveryRequired: false,
        message: "Saved setup changes could not be applied safely. Current values were retained."
      };
    }
    input.recovery.completeExternalApply(DUEL_SCOPE);
    this.undoRecord = {
      ...prepared,
      mode: "session-only",
      rawBefore: null,
      rawAfter: null,
      sessionOnlyAvailable: false
    };
    return {
      status: "applied",
      mode: "session-only",
      message: prepared.sessionActionMessage,
      undoMessage: prepared.undoMessage
    };
  };

  undo = (input: SavedSetupChangesExecutionInput): SavedSetupChangeUndoOutcome => {
    const record = this.undoRecord;
    if (!record) {
      return {
        status: "stale",
        recoveryRequired: false,
        message: "Saved setup Undo is no longer available."
      };
    }
    if (record.mode === "session-only") return this.undoForSession(input, false);
    if (fingerprintDuelSnapshots(input.liveState) !== record.nextFingerprint) {
      this.undoRecord = null;
      return {
        status: "stale",
        recoveryRequired: false,
        message: "Saved setups changed after this action. Undo left the newer values unchanged."
      };
    }

    let currentRaw: string | null;
    try {
      currentRaw = input.storageAccess.storage.getItem(DUEL_SNAPSHOTS_STORAGE_KEY);
    } catch {
      record.sessionOnlyAvailable = true;
      input.recovery.markPersistenceUnavailable();
      return {
        status: "session-only-available",
        message:
          "Saved setup Undo could not read saved data. You can restore the prior live setups for this session only."
      };
    }
    if (currentRaw !== record.rawAfter) {
      this.undoRecord = null;
      return {
        status: "stale",
        recoveryRequired: false,
        message:
          "Saved setups changed after this action. Undo left the newer saved value unchanged."
      };
    }

    if (!writeAndVerify(input.storageAccess.storage, record.rawBefore)) {
      const postActionRestored = writeAndVerify(input.storageAccess.storage, record.rawAfter);
      if (postActionRestored) {
        record.sessionOnlyAvailable = true;
      }
      input.recovery.recordExternalApplyFailure([storageFailure()], !postActionRestored);
      return postActionRestored
        ? {
            status: "session-only-available",
            message:
              "Saved setup Undo could not update saved data. The post-action saved value was retained. You can restore prior live setups for this session only."
          }
        : {
            status: "failed",
            recoveryRequired: true,
            message: "Saved setup Undo could not be completed. Review Local state recovery."
          };
    }

    input.recovery.prepareExternalApply(DUEL_SCOPE);
    try {
      input.applyLiveState(record.current);
    } catch {
      const postActionRestored = writeAndVerify(input.storageAccess.storage, record.rawAfter);
      try {
        input.applyLiveState(record.next);
      } catch {
        // The fixed failure copy covers an uncertain live setter boundary.
      }
      input.recovery.cancelExternalApply(DUEL_SCOPE);
      if (!postActionRestored) input.recovery.recordExternalApplyFailure([storageFailure()], true);
      return {
        status: "failed",
        recoveryRequired: !postActionRestored,
        message: "Saved setup Undo could not be applied safely."
      };
    }
    input.recovery.completeExternalUndo(DUEL_SCOPE);
    this.undoRecord = null;
    return { status: "undone", mode: "durable", message: record.undoMessage };
  };

  undoForSession = (
    input: SavedSetupChangesExecutionInput,
    requireOffer = true
  ): SavedSetupChangeUndoOutcome => {
    const record = this.undoRecord;
    if (!record || (requireOffer && !record.sessionOnlyAvailable)) {
      return {
        status: "stale",
        recoveryRequired: false,
        message: "Session-only saved setup Undo is no longer available."
      };
    }
    if (fingerprintDuelSnapshots(input.liveState) !== record.nextFingerprint) {
      this.undoRecord = null;
      return {
        status: "stale",
        recoveryRequired: false,
        message: "Saved setups changed after this action. Undo left the newer values unchanged."
      };
    }
    input.recovery.prepareExternalApply(DUEL_SCOPE);
    try {
      input.applyLiveState(record.current);
    } catch {
      input.recovery.cancelExternalApply(DUEL_SCOPE);
      return {
        status: "failed",
        recoveryRequired: false,
        message: "Session-only saved setup Undo could not be applied safely."
      };
    }
    input.recovery.completeExternalUndo(DUEL_SCOPE);
    this.undoRecord = null;
    return {
      status: "undone",
      mode: "session-only",
      message: `${record.undoMessage} for this session`
    };
  };
}

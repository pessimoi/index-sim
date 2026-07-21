import { savePersisted, tryClearPersisted, type KeyValueStorage } from "@/adapters/storage";
import {
  MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
  saveManualPriceOverrides,
  type ManualPriceOverridesState
} from "../state/manual-price-overrides";
import {
  BrowserPriceHistoryStateSchema,
  PRICE_HISTORY_STORAGE_KEY,
  PRICE_HISTORY_VERSION,
  type BrowserPriceHistoryState
} from "../state/price-history";
import { SELECTED_PRICE_SET_STORAGE_KEY } from "../state/selected-price-set";

export type EconomyDataUndoScope =
  "price-history" | "manual-price-overrides" | "selected-price-set";

type EconomyDataUndoSessionReason =
  | "persistence-unavailable"
  | "action-not-persisted"
  | "preimage-read-failed"
  | "postimage-read-failed"
  | "current-read-failed"
  | "raw-mismatch"
  | "raw-restore-failed";

export type EconomyDataUndoSavedState =
  | "restored-pre-action"
  | "pre-action-retained"
  | "post-action-retained"
  | "later-value-retained"
  | "unknown";

export type EconomyDataUndoResult<TLiveState> =
  | { status: "consumed" }
  | {
      status: "restored";
      durability: "durable" | "session-only";
      liveState: TLiveState;
      savedState: EconomyDataUndoSavedState;
      reason?: EconomyDataUndoSessionReason;
      storageFailure?: "save_failed" | "clear_failed";
    };

type EconomyDataUndoPresentation = {
  status: "restored" | "consumed";
  tone: "success" | "neutral";
  message: string;
};

export interface EconomyDataUndoRecord<TLiveState> {
  readonly scope: EconomyDataUndoScope;
  undo(): EconomyDataUndoResult<TLiveState>;
  restore(input: {
    applyLiveState(liveState: TLiveState): void;
    recovery: EconomyDataRecoveryPort;
    onNotice(notice: { tone: "success" | "neutral"; message: string }): void;
    restoredMessage: string;
  }): EconomyDataUndoPresentation;
}

export interface EconomyDataUndoPreparation<TLiveState> {
  finish(actionPersisted: boolean): EconomyDataUndoRecord<TLiveState>;
}

export interface EconomyDataRecoveryPort {
  canStartDurableWrite(ids: readonly EconomyDataUndoScope[]): boolean;
  clearStorageFailures(ids: readonly EconomyDataUndoScope[]): void;
  completeExternalUndo(ids: readonly EconomyDataUndoScope[]): void;
  markPersistenceUnavailable(): void;
  prepareExternalApply(ids: readonly EconomyDataUndoScope[]): void;
  recordCurrentBaselines(ids: readonly EconomyDataUndoScope[]): void;
  recordStorageFailure(id: EconomyDataUndoScope, reason: "save_failed" | "clear_failed"): void;
  refresh(): void;
  unblockReplaced(ids: readonly EconomyDataUndoScope[]): void;
}

export type EconomyPriceHistoryCommitOutcome =
  | {
      status: "applied";
      durability: "durable" | "session-only";
      record: EconomyDataUndoRecord<BrowserPriceHistoryState> | null;
      actionStatus: string;
      notice: { tone: "success" | "neutral"; message: string };
    }
  | { status: "invalid"; message: string };

export function commitEconomyPriceHistory(input: {
  storage: KeyValueStorage;
  persistenceUnavailable: boolean;
  persistenceBlocked: boolean;
  current: BrowserPriceHistoryState;
  next: BrowserPriceHistoryState;
  destructive: boolean;
  durableMessage: string;
  sessionMessage: string;
  recovery: EconomyDataRecoveryPort;
  applyLiveState(next: BrowserPriceHistoryState): void;
  now(): Date;
}): EconomyPriceHistoryCommitOutcome {
  let current: BrowserPriceHistoryState;
  let next: BrowserPriceHistoryState;
  try {
    current = BrowserPriceHistoryStateSchema.parse(input.current);
    next = BrowserPriceHistoryStateSchema.parse(input.next);
  } catch {
    return { status: "invalid", message: "Local price history could not be validated." };
  }
  const sessionOnlyBeforeStorage =
    input.persistenceUnavailable ||
    input.persistenceBlocked ||
    !input.recovery.canStartDurableWrite(["price-history"]);
  const preparation = input.destructive
    ? prepareEconomyDataUndo({
        scope: "price-history",
        storage: input.storage,
        persistenceUnavailable: sessionOnlyBeforeStorage,
        liveState: current
      })
    : null;
  let persisted = false;
  if (sessionOnlyBeforeStorage) {
    if (input.persistenceUnavailable) input.recovery.markPersistenceUnavailable();
  } else {
    try {
      if (next.snapshots.length === 0) {
        input.storage.removeItem(PRICE_HISTORY_STORAGE_KEY);
      } else {
        savePersisted(
          {
            key: PRICE_HISTORY_STORAGE_KEY,
            version: PRICE_HISTORY_VERSION,
            schema: BrowserPriceHistoryStateSchema,
            storage: input.storage,
            now: input.now
          },
          next
        );
      }
      persisted = true;
      input.recovery.clearStorageFailures(["price-history"]);
      input.recovery.recordCurrentBaselines(["price-history"]);
    } catch {
      input.recovery.recordStorageFailure(
        "price-history",
        next.snapshots.length === 0 ? "clear_failed" : "save_failed"
      );
    }
  }
  input.recovery.prepareExternalApply(["price-history"]);
  input.applyLiveState(next);
  input.recovery.refresh();
  return {
    status: "applied",
    durability: persisted ? "durable" : "session-only",
    record: preparation?.finish(persisted) ?? null,
    actionStatus: persisted ? input.durableMessage : input.sessionMessage,
    notice: {
      tone: persisted ? "success" : "neutral",
      message: persisted ? input.durableMessage : input.sessionMessage
    }
  };
}

const ECONOMY_DATA_STORAGE_KEYS: Readonly<Record<EconomyDataUndoScope, string>> = {
  "price-history": PRICE_HISTORY_STORAGE_KEY,
  "manual-price-overrides": MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
  "selected-price-set": SELECTED_PRICE_SET_STORAGE_KEY
};

export function invalidateEconomyDataPendingUndo<T extends object>(pending: T | null): T | null {
  return pending && "scope" in pending && pending.scope === "economy-data" ? null : pending;
}

function restoreFailureFor(rawBefore: string | null): "save_failed" | "clear_failed" {
  return rawBefore === null ? "clear_failed" : "save_failed";
}

function savedStateCopy(savedState: EconomyDataUndoSavedState): string {
  if (savedState === "pre-action-retained") {
    return "Saved data was left unchanged, so reload may restore the value from before the action.";
  }
  if (savedState === "post-action-retained") {
    return "Saved data still contains the cleared or reset value, so reload may show that value.";
  }
  if (savedState === "later-value-retained") {
    return "A newer saved value was left unchanged, so reload may show that newer value.";
  }
  return "Saved data could not be restored or verified, so reload may show its saved value.";
}

function writeExactRaw(storage: KeyValueStorage, key: string, raw: string | null): void {
  if (raw === null) {
    storage.removeItem(key);
  } else {
    storage.setItem(key, raw);
  }
}

/**
 * Captures one allowlisted Economy key immediately before a destructive action.
 * Raw values remain private to the returned closures and are never included in
 * a result, presentation model or persisted envelope.
 */
export function prepareEconomyDataUndo<TLiveState>(input: {
  scope: EconomyDataUndoScope;
  storage: KeyValueStorage;
  persistenceUnavailable: boolean;
  liveState: TLiveState;
}): EconomyDataUndoPreparation<TLiveState> {
  const key = ECONOMY_DATA_STORAGE_KEYS[input.scope];
  let rawBefore: string | null = null;
  let preimageReadFailed = false;

  if (!input.persistenceUnavailable) {
    try {
      rawBefore = input.storage.getItem(key);
    } catch {
      preimageReadFailed = true;
    }
  }

  let finishedRecord: EconomyDataUndoRecord<TLiveState> | null = null;

  return {
    finish(actionPersisted) {
      if (finishedRecord) return finishedRecord;

      let rawAfter: string | null = null;
      let initialSessionReason: EconomyDataUndoSessionReason | null = null;
      let initialSavedState: EconomyDataUndoSavedState = "unknown";

      if (input.persistenceUnavailable) {
        initialSessionReason = "persistence-unavailable";
        initialSavedState = "pre-action-retained";
      } else if (!actionPersisted) {
        initialSessionReason = "action-not-persisted";
        initialSavedState = "pre-action-retained";
      } else if (preimageReadFailed) {
        initialSessionReason = "preimage-read-failed";
      } else {
        try {
          rawAfter = input.storage.getItem(key);
        } catch {
          initialSessionReason = "postimage-read-failed";
        }
      }

      let consumed = false;
      const record: EconomyDataUndoRecord<TLiveState> = {
        scope: input.scope,
        undo(): EconomyDataUndoResult<TLiveState> {
          if (consumed) return { status: "consumed" };
          consumed = true;

          if (initialSessionReason) {
            return {
              status: "restored",
              durability: "session-only",
              liveState: input.liveState,
              savedState: initialSavedState,
              reason: initialSessionReason
            };
          }

          let currentRaw: string | null;
          try {
            currentRaw = input.storage.getItem(key);
          } catch {
            return {
              status: "restored",
              durability: "session-only",
              liveState: input.liveState,
              savedState: "unknown",
              reason: "current-read-failed",
              storageFailure: restoreFailureFor(rawBefore)
            };
          }

          if (currentRaw !== rawAfter) {
            return {
              status: "restored",
              durability: "session-only",
              liveState: input.liveState,
              savedState: "later-value-retained",
              reason: "raw-mismatch"
            };
          }

          try {
            writeExactRaw(input.storage, key, rawBefore);
          } catch {
            let rollbackSucceeded = false;
            try {
              writeExactRaw(input.storage, key, rawAfter);
              rollbackSucceeded = true;
            } catch {
              // The caller reports the sanitized failure through local-state recovery.
            }
            return {
              status: "restored",
              durability: "session-only",
              liveState: input.liveState,
              savedState: rollbackSucceeded ? "post-action-retained" : "unknown",
              reason: "raw-restore-failed",
              storageFailure: restoreFailureFor(rawBefore)
            };
          }

          return {
            status: "restored",
            durability: "durable",
            liveState: input.liveState,
            savedState: "restored-pre-action"
          };
        },
        restore(options) {
          const result = record.undo();
          if (result.status === "consumed") {
            const presentation: EconomyDataUndoPresentation = {
              status: "consumed",
              tone: "neutral",
              message: "This Economy Undo was already used."
            };
            options.onNotice(presentation);
            return presentation;
          }
          if (input.scope === "price-history") {
            options.recovery.prepareExternalApply([input.scope]);
          }
          options.applyLiveState(result.liveState);
          if (result.durability === "durable") {
            options.recovery.completeExternalUndo([input.scope]);
          } else if (result.storageFailure) {
            options.recovery.recordStorageFailure(input.scope, result.storageFailure);
          }
          const presentation: EconomyDataUndoPresentation = {
            status: "restored",
            tone: result.durability === "durable" ? "success" : "neutral",
            message:
              result.durability === "durable"
                ? options.restoredMessage
                : `${options.restoredMessage} for this session. ${savedStateCopy(result.savedState)}`
          };
          options.onNotice(presentation);
          return presentation;
        }
      };
      finishedRecord = record;
      return record;
    }
  };
}

export function clearEconomyPriceHistory<TLiveState>(input: {
  storage: KeyValueStorage;
  persistenceUnavailable: boolean;
  liveState: TLiveState;
  recovery: EconomyDataRecoveryPort;
}): {
  record: EconomyDataUndoRecord<TLiveState>;
  actionStatus: string;
  marketNotice: { tone: "success" | "neutral"; message: string };
} {
  const canPersist =
    !input.persistenceUnavailable && input.recovery.canStartDurableWrite(["price-history"]);
  const preparation = prepareEconomyDataUndo({
    scope: "price-history",
    storage: input.storage,
    persistenceUnavailable: !canPersist,
    liveState: input.liveState
  });
  const cleared = canPersist
    ? tryClearPersisted({ key: PRICE_HISTORY_STORAGE_KEY, storage: input.storage })
    : { status: "cleared" as const };
  const persisted = cleared.status === "cleared" && canPersist;
  if (cleared.status === "failed") {
    input.recovery.recordStorageFailure("price-history", cleared.reason);
  } else if (persisted) {
    input.recovery.clearStorageFailures(["price-history"]);
    input.recovery.recordCurrentBaselines(["price-history"]);
  } else if (input.persistenceUnavailable) {
    input.recovery.markPersistenceUnavailable();
  }
  return {
    record: preparation.finish(persisted),
    actionStatus: persisted ? "Cleared price history" : "Cleared price history for this session",
    marketNotice: persisted
      ? { tone: "success", message: "Cleared local comparison history" }
      : {
          tone: "neutral",
          message:
            "Cleared price history for this session. Saved history was not changed, so reload may restore it."
        }
  };
}

export function saveEconomyManualPriceOverrides<TLiveState>(input: {
  storage: KeyValueStorage;
  persistenceUnavailable: boolean;
  liveState: TLiveState;
  next: ManualPriceOverridesState;
  successMessage: string;
  undo: boolean;
  recovery: EconomyDataRecoveryPort;
}): {
  record: EconomyDataUndoRecord<TLiveState> | null;
  actionStatus: string;
  marketNotice: { tone: "success" | "neutral"; message: string };
} {
  const preparation = input.undo
    ? prepareEconomyDataUndo({
        scope: "manual-price-overrides",
        storage: input.storage,
        persistenceUnavailable: input.persistenceUnavailable,
        liveState: input.liveState
      })
    : null;
  let persisted =
    !input.persistenceUnavailable &&
    input.recovery.canStartDurableWrite(["manual-price-overrides"]);
  if (persisted) {
    try {
      saveManualPriceOverrides(input.storage, input.next);
      input.recovery.clearStorageFailures(["manual-price-overrides"]);
      input.recovery.recordCurrentBaselines(["manual-price-overrides"]);
    } catch {
      persisted = false;
      input.recovery.recordStorageFailure("manual-price-overrides", "save_failed");
    }
  } else if (input.persistenceUnavailable) {
    persisted = false;
    input.recovery.markPersistenceUnavailable();
  }
  input.recovery.unblockReplaced(["manual-price-overrides"]);
  input.recovery.refresh();
  const actionStatus = persisted
    ? input.successMessage
    : `${input.successMessage} for this session`;
  return {
    record: preparation?.finish(persisted) ?? null,
    actionStatus,
    marketNotice: persisted
      ? { tone: "success", message: input.successMessage }
      : {
          tone: "neutral",
          message: `${actionStatus}. Saved manual prices were not changed, so reload may restore the previous value.`
        }
  };
}

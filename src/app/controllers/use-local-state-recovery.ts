import { useState, useSyncExternalStore } from "react";
import type { VersionedStorageOptions } from "@/adapters/storage";
import type { FileExportOutcome } from "./file-export-outcome";
import type { LocalStateHealthItemId, LocalStateStorageFailure } from "../state/local-state-health";
import {
  LocalStateRecoveryControllerCore,
  type LocalStateClearPendingId,
  type LocalStateRecoveryDependencies,
  type LocalStateRecoveryOutcome,
  type LocalStateRecoverySnapshot
} from "./local-state-recovery";

export interface LocalStateRecoveryController extends LocalStateRecoverySnapshot {
  shouldSkipPersist(id: LocalStateHealthItemId): boolean;
  canStartDurableWrite(ids: readonly LocalStateHealthItemId[]): boolean;
  recordCurrentBaselines(ids: readonly LocalStateHealthItemId[]): void;
  persist<T>(id: LocalStateHealthItemId, options: VersionedStorageOptions<T>, value: T): boolean;
  recordStorageFailure(id: LocalStateHealthItemId, reason: "save_failed" | "clear_failed"): void;
  clearStorageFailures(ids: readonly LocalStateHealthItemId[]): void;
  markPersistenceUnavailable(): void;
  blockContextInvalid(ids: readonly LocalStateHealthItemId[], notice: string | null): void;
  unblockReplaced(ids: readonly LocalStateHealthItemId[]): void;
  prepareExternalApply(ids: readonly LocalStateHealthItemId[]): void;
  cancelExternalApply(ids: readonly LocalStateHealthItemId[]): void;
  completeExternalApply(ids: readonly LocalStateHealthItemId[]): void;
  completeExternalUndo(ids: readonly LocalStateHealthItemId[]): void;
  recordExternalApplyFailure(
    failures: readonly LocalStateStorageFailure[],
    blockPersistence?: boolean
  ): void;
  beginClear(id: Exclude<LocalStateClearPendingId, null>): void;
  cancelClear(): void;
  confirmClearItem(id: LocalStateHealthItemId): LocalStateRecoveryOutcome;
  confirmClearInvalid(): LocalStateRecoveryOutcome;
  exportReport(): FileExportOutcome;
  refresh(): LocalStateRecoverySnapshot["report"];
}

export function useLocalStateRecovery(
  dependencies: LocalStateRecoveryDependencies
): LocalStateRecoveryController {
  const [controller] = useState(() => new LocalStateRecoveryControllerCore(dependencies));
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  return {
    ...snapshot,
    shouldSkipPersist: controller.shouldSkipPersist,
    canStartDurableWrite: controller.canStartDurableWrite,
    recordCurrentBaselines: controller.recordCurrentBaselines,
    persist: controller.persist,
    recordStorageFailure: controller.recordStorageFailure,
    clearStorageFailures: controller.clearStorageFailures,
    markPersistenceUnavailable: controller.markPersistenceUnavailable,
    blockContextInvalid: controller.blockContextInvalid,
    unblockReplaced: controller.unblockReplaced,
    prepareExternalApply: controller.prepareExternalApply,
    cancelExternalApply: controller.cancelExternalApply,
    completeExternalApply: controller.completeExternalApply,
    completeExternalUndo: controller.completeExternalUndo,
    recordExternalApplyFailure: controller.recordExternalApplyFailure,
    beginClear: controller.beginClear,
    cancelClear: controller.cancelClear,
    confirmClearItem: controller.confirmClearItem,
    confirmClearInvalid: controller.confirmClearInvalid,
    exportReport: controller.exportReport,
    refresh: controller.refresh
  };
}

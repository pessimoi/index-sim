import { useEffect, useState, useSyncExternalStore } from "react";
import type { KeyValueStorage } from "@/adapters/storage";
import type { LocalStateBatchOperation } from "./local-state-batch";
import type { LocalStateHealthItemId } from "../state/local-state-health";
import {
  CrossTabConflictControllerCore,
  type CrossTabAreaId,
  type CrossTabConflictSnapshot,
  type CrossTabKeepResult,
  type CrossTabKeepUndoRecord,
  type CrossTabReviewResult,
  type CrossTabUndoResult,
  type CrossTabWriteCheck
} from "./cross-tab-conflicts";

export interface CrossTabConflictController extends CrossTabConflictSnapshot {
  checkFreshness(id: LocalStateHealthItemId): CrossTabWriteCheck;
  checkFreshnessFor(ids: readonly LocalStateHealthItemId[]): CrossTabWriteCheck;
  isSuspended(id: LocalStateHealthItemId): boolean;
  recordVerifiedRaw(id: LocalStateHealthItemId, raw: string | null): void;
  recordCurrentRaw(ids: readonly LocalStateHealthItemId[]): boolean;
  resolveCleared(ids: readonly LocalStateHealthItemId[]): void;
  refreshReview(ids: readonly CrossTabAreaId[]): CrossTabReviewResult;
  useSavedData(ids: readonly CrossTabAreaId[]): CrossTabReviewResult;
  keepCurrent(operations: readonly LocalStateBatchOperation<CrossTabAreaId>[]): CrossTabKeepResult;
  undoKeep(record: CrossTabKeepUndoRecord): CrossTabUndoResult;
}

export interface UseCrossTabConflictsInput {
  storage: KeyValueStorage;
  enabled: boolean;
}

export function useCrossTabConflicts(input: UseCrossTabConflictsInput): CrossTabConflictController {
  const [controller] = useState(() => new CrossTabConflictControllerCore(input.storage));
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  useEffect(() => {
    if (!input.enabled || typeof window === "undefined") return;
    let browserStorage: Storage;
    try {
      browserStorage = window.localStorage;
    } catch {
      return;
    }
    if (browserStorage !== input.storage || !controller.initialize()) return;
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== browserStorage) return;
      controller.handleStorageChange({
        key: event.key,
        oldValue: event.oldValue,
        newValue: event.newValue
      });
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [controller, input.enabled, input.storage]);

  return {
    ...snapshot,
    checkFreshness: controller.checkFreshness,
    checkFreshnessFor: controller.checkFreshnessFor,
    isSuspended: controller.isSuspended,
    recordVerifiedRaw: controller.recordVerifiedRaw,
    recordCurrentRaw: controller.recordCurrentRaw,
    resolveCleared: controller.resolveCleared,
    refreshReview: controller.refreshReview,
    useSavedData: controller.useSavedData,
    keepCurrent: controller.keepCurrent,
    undoKeep: controller.undoKeep
  };
}

import { useEffect, useState, useSyncExternalStore } from "react";
import { fetchHiscoresStatus, lookupHiscores } from "@/adapters/hiscores";
import type { KeyValueStorage } from "@/adapters/storage";
import type { LocalStateHealthItemId } from "../state/local-state-health";
import {
  HiscoresLookupControllerCore,
  type HiscoresApplyOutcome,
  type HiscoresLookupDependencies,
  type HiscoresLookupSnapshot
} from "./hiscores-lookup";

export interface UseHiscoresLookupInput {
  storage: KeyValueStorage;
  clearStorageFailures(ids: readonly LocalStateHealthItemId[]): void;
  recordStorageFailure(id: LocalStateHealthItemId, reason: "save_failed" | "clear_failed"): void;
  unblockReplaced(ids: readonly LocalStateHealthItemId[]): void;
  refreshLocalStateHealth(): void;
  dependencies?: Pick<HiscoresLookupDependencies, "fetchStatus" | "lookupPlayer">;
}

export interface HiscoresLookupController extends HiscoresLookupSnapshot {
  changePlayer(value: string): void;
  lookup(): Promise<void>;
  setPreviewOpen(open: boolean): void;
  closePreview(): void;
  prepareApply(): HiscoresApplyOutcome;
  recordNoChanges(): void;
  replacePersistedPlayer(player: string): boolean;
}

export function useHiscoresLookup(input: UseHiscoresLookupInput): HiscoresLookupController {
  const [controller] = useState(
    () =>
      new HiscoresLookupControllerCore({
        storage: input.storage,
        fetchStatus: input.dependencies?.fetchStatus ?? fetchHiscoresStatus,
        lookupPlayer: input.dependencies?.lookupPlayer ?? lookupHiscores,
        clearStorageFailures: input.clearStorageFailures,
        recordStorageFailure: input.recordStorageFailure,
        unblockReplaced: input.unblockReplaced,
        refreshLocalStateHealth: input.refreshLocalStateHealth
      })
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  useEffect(() => {
    let cancelled = false;
    void controller.loadStatus(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [controller]);

  return {
    ...snapshot,
    changePlayer: controller.changePlayer,
    lookup: controller.lookup,
    setPreviewOpen: controller.setPreviewOpen,
    closePreview: controller.closePreview,
    prepareApply: controller.prepareApply,
    recordNoChanges: controller.recordNoChanges,
    replacePersistedPlayer: controller.replacePersistedPlayer
  };
}

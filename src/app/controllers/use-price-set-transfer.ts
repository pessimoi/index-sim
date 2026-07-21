import { useState, useSyncExternalStore } from "react";
import { downloadJsonFile, readBrowserFileText } from "@/adapters/browser";
import type { KeyValueStorage } from "@/adapters/storage";
import { clearSelectedPriceSet, saveSelectedPriceSet } from "../state/selected-price-set";
import type { LocalStateHealthItemId } from "../state/local-state-health";
import {
  PriceSetTransferControllerCore,
  type AcceptPriceSetInput,
  type AcceptedPriceSetOutcome,
  type ImportPriceSetFileInput,
  type MarketNotice,
  type PriceSetActionOutcome,
  type PriceSetFileImportOutcome,
  type PriceSetTransferDependencies,
  type PriceSetTransferSnapshot,
  type ResetPriceSetInput,
  type ResetPriceSetOutcome
} from "./price-set-transfer";
import type { GameDataSnapshot, PriceSet } from "@/domain/shared";

export interface UsePriceSetTransferInput {
  storage: KeyValueStorage;
  storageUnavailable: boolean;
  clearStorageFailures(ids: readonly LocalStateHealthItemId[]): void;
  recordStorageFailure(id: LocalStateHealthItemId, reason: "save_failed" | "clear_failed"): void;
  markPersistenceUnavailable(): void;
  canStartDurableWrite(ids: readonly LocalStateHealthItemId[]): boolean;
  recordCurrentBaselines(ids: readonly LocalStateHealthItemId[]): void;
  unblockReplaced(ids: readonly LocalStateHealthItemId[]): void;
  refreshLocalStateHealth(): void;
  dependencies?: Pick<
    PriceSetTransferDependencies<File>,
    "readFileText" | "downloadJsonFile" | "now"
  >;
}

export interface PriceSetTransferController extends PriceSetTransferSnapshot {
  acceptPriceSet(input: AcceptPriceSetInput): AcceptedPriceSetOutcome;
  importFile(file: File, input: ImportPriceSetFileInput): Promise<PriceSetFileImportOutcome>;
  exportPriceSet(priceSet: PriceSet, gameData: GameDataSnapshot): PriceSetActionOutcome;
  requestReset(fallbackLabel: string): MarketNotice;
  cancelReset(): void;
  resetToFallback(input: ResetPriceSetInput): ResetPriceSetOutcome;
}

export function usePriceSetTransfer(input: UsePriceSetTransferInput): PriceSetTransferController {
  const [controller] = useState(
    () =>
      new PriceSetTransferControllerCore<File>({
        readFileText: input.dependencies?.readFileText ?? readBrowserFileText,
        downloadJsonFile: input.dependencies?.downloadJsonFile ?? downloadJsonFile,
        saveSelectedPriceSet: (priceSet, selectedAt) => {
          saveSelectedPriceSet(input.storage, priceSet, { now: () => selectedAt });
        },
        clearSelectedPriceSet: () => clearSelectedPriceSet(input.storage),
        storageUnavailable: input.storageUnavailable,
        clearStorageFailures: input.clearStorageFailures,
        recordStorageFailure: input.recordStorageFailure,
        markPersistenceUnavailable: input.markPersistenceUnavailable,
        canStartDurableWrite: input.canStartDurableWrite,
        recordCurrentBaselines: input.recordCurrentBaselines,
        unblockReplaced: input.unblockReplaced,
        refreshLocalStateHealth: input.refreshLocalStateHealth,
        now: input.dependencies?.now ?? (() => new Date())
      })
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  return {
    ...snapshot,
    acceptPriceSet: controller.acceptPriceSet,
    importFile: controller.importFile,
    exportPriceSet: controller.exportPriceSet,
    requestReset: controller.requestReset,
    cancelReset: controller.cancelReset,
    resetToFallback: controller.resetToFallback
  };
}

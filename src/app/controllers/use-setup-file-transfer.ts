import { useState, useSyncExternalStore } from "react";
import { downloadJsonFile, readBrowserFileText } from "@/adapters/browser";
import type { GameDataSnapshot } from "@/domain/shared";
import type { LocalStateHealthItemId } from "../state/local-state-health";
import type { SavedSetupState } from "../state/ui-state";
import {
  SetupFileTransferControllerCore,
  type SetupFileTransferDependencies,
  type SetupFileTransferSnapshot,
  type SetupImportOutcome
} from "./setup-file-transfer";

export interface UseSetupFileTransferInput {
  persistSetup(setup: SavedSetupState): boolean;
  unblockReplaced(ids: readonly LocalStateHealthItemId[]): void;
  refreshLocalStateHealth(): void;
  dependencies?: Pick<
    SetupFileTransferDependencies<File>,
    "readFileText" | "downloadJsonFile" | "now"
  >;
}

export interface SetupFileTransferController extends SetupFileTransferSnapshot {
  importFile(file: File, gameData: GameDataSnapshot): Promise<SetupImportOutcome>;
  exportSetup(setup: SavedSetupState): void;
}

export function useSetupFileTransfer(
  input: UseSetupFileTransferInput
): SetupFileTransferController {
  const [controller] = useState(
    () =>
      new SetupFileTransferControllerCore<File>({
        readFileText: input.dependencies?.readFileText ?? readBrowserFileText,
        persistSetup: input.persistSetup,
        unblockReplaced: input.unblockReplaced,
        refreshLocalStateHealth: input.refreshLocalStateHealth,
        downloadJsonFile: input.dependencies?.downloadJsonFile ?? downloadJsonFile,
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
    importFile: controller.importFile,
    exportSetup: controller.exportSetup
  };
}

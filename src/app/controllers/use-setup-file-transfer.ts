import { useState, useSyncExternalStore } from "react";
import { downloadJsonFile, readBrowserFileText } from "@/adapters/browser";
import type { GameDataSnapshot } from "@/domain/shared";
import type { SavedSetupState } from "../state/ui-state";
import {
  SetupFileTransferControllerCore,
  type SetupImportCandidate,
  type SetupFileTransferDependencies,
  type SetupFileTransferSnapshot,
  type SetupPrepareOutcome
} from "./setup-file-transfer";

export interface UseSetupFileTransferInput {
  dependencies?: SetupFileTransferDependencies<File>;
}

export interface SetupFileTransferController extends SetupFileTransferSnapshot {
  prepareImport(file: File, gameData: GameDataSnapshot): Promise<SetupPrepareOutcome>;
  dismissReview(reviewId: number): boolean;
  consumeReview(reviewId: number): SetupImportCandidate | null;
  exportSetup(setup: SavedSetupState, gameData: GameDataSnapshot): void;
}

export function useSetupFileTransfer(
  input: UseSetupFileTransferInput = {}
): SetupFileTransferController {
  const [controller] = useState(
    () =>
      new SetupFileTransferControllerCore<File>(
        input.dependencies ?? {
          readFileText: readBrowserFileText,
          downloadJsonFile,
          now: () => new Date()
        }
      )
  );
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );

  return {
    ...snapshot,
    prepareImport: controller.prepareImport,
    dismissReview: controller.dismissReview,
    consumeReview: controller.consumeReview,
    exportSetup: controller.exportSetup
  };
}

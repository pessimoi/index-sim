import { useState, useSyncExternalStore } from "react";
import { downloadJsonFile, readBrowserFileText } from "@/adapters/browser";
import type { GameDataSnapshot } from "@/domain/shared";
import type { SavedSetupState } from "../state/ui-state";
import type { FileExportOutcome } from "./file-export-outcome";
import {
  SetupFileTransferControllerCore,
  type SetupFileTransferDependencies,
  type SetupFileTransferSnapshot,
  type SetupPrepareOutcome,
  type SetupReviewConsumeOutcome
} from "./setup-file-transfer";

export interface UseSetupFileTransferInput {
  dependencies?: SetupFileTransferDependencies<File>;
}

export interface SetupFileTransferController extends SetupFileTransferSnapshot {
  prepareImport(
    file: File,
    gameData: GameDataSnapshot,
    currentSetup: SavedSetupState
  ): Promise<SetupPrepareOutcome>;
  dismissReview(reviewId: number): boolean;
  checkReviewFreshness(reviewId: number, currentSetup: SavedSetupState): boolean;
  refreshReview(
    reviewId: number,
    currentSetup: SavedSetupState,
    gameData: GameDataSnapshot
  ): boolean;
  consumeReview(reviewId: number, currentSetup: SavedSetupState): SetupReviewConsumeOutcome;
  exportSetup(setup: SavedSetupState, gameData: GameDataSnapshot): FileExportOutcome;
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
    checkReviewFreshness: controller.checkReviewFreshness,
    refreshReview: controller.refreshReview,
    consumeReview: controller.consumeReview,
    exportSetup: controller.exportSetup
  };
}

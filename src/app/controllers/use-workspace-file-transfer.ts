import { useState, useSyncExternalStore } from "react";
import { downloadJsonFile, readBrowserFileText } from "@/adapters/browser";
import {
  WorkspaceFileTransferControllerCore,
  type WorkspaceExportInput,
  type WorkspaceExportOutcome,
  type WorkspaceFileTransferDependencies,
  type WorkspaceFileTransferSnapshot,
  type WorkspacePrepareImportContext,
  type WorkspacePrepareOutcome,
  type WorkspaceRestorePlanAction,
  type WorkspaceRestorePlanOutcome,
  type WorkspaceRestoreApplyOutcome,
  type WorkspaceRestoreExecutionInput,
  type WorkspaceRestoreUndoOutcome
} from "./workspace-file-transfer";

export interface UseWorkspaceFileTransferInput {
  dependencies?: WorkspaceFileTransferDependencies<File>;
}

export interface WorkspaceFileTransferController extends WorkspaceFileTransferSnapshot {
  setIncludeLastHiscoresPlayer(include: boolean): void;
  exportWorkspace(input: WorkspaceExportInput): WorkspaceExportOutcome;
  prepareImport(file: File, input: WorkspacePrepareImportContext): Promise<WorkspacePrepareOutcome>;
  dismissReview(reviewId: number): boolean;
  updateRestorePlan(
    reviewId: number,
    action: WorkspaceRestorePlanAction,
    input: WorkspacePrepareImportContext
  ): WorkspaceRestorePlanOutcome;
  applyRestore(
    reviewId: number,
    input: WorkspaceRestoreExecutionInput
  ): Promise<WorkspaceRestoreApplyOutcome | { status: "stale" }>;
  applyRestoreForSession(
    reviewId: number,
    input: WorkspaceRestoreExecutionInput
  ): Promise<WorkspaceRestoreApplyOutcome | { status: "stale" }>;
  undoRestore(input: WorkspaceRestoreExecutionInput): WorkspaceRestoreUndoOutcome;
  undoRestoreForSession(input: WorkspaceRestoreExecutionInput): WorkspaceRestoreUndoOutcome;
}

export function useWorkspaceFileTransfer(
  input: UseWorkspaceFileTransferInput = {}
): WorkspaceFileTransferController {
  const [controller] = useState(
    () =>
      new WorkspaceFileTransferControllerCore<File>(
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
    setIncludeLastHiscoresPlayer: controller.setIncludeLastHiscoresPlayer,
    exportWorkspace: controller.exportWorkspace,
    prepareImport: controller.prepareImport,
    dismissReview: controller.dismissReview,
    updateRestorePlan: controller.updateRestorePlan,
    applyRestore: controller.applyRestore,
    applyRestoreForSession: controller.applyRestoreForSession,
    undoRestore: controller.undoRestore,
    undoRestoreForSession: controller.undoRestoreForSession
  };
}

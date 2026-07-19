import type { GameDataSnapshot } from "@/domain/shared";
import type { BrowserStorageAccess } from "../application-recovery";
import {
  WORKSPACE_BACKUP_IMPORT_MAX_BYTES,
  WorkspaceBackupError,
  createWorkspaceBackupExport,
  parseWorkspaceBackupText,
  type CreateWorkspaceBackupExportInput,
  type WorkspaceLiveState
} from "../state/workspace-backup";
import type {
  WorkspacePrepareImportContext,
  WorkspaceRestoreReview,
  WorkspaceRestoreSelectionDraft
} from "./workspace-file-transfer-review";
import type {
  WorkspaceRestorePlan,
  WorkspaceRestorePlanAction,
  WorkspaceRestorePlanSession
} from "./workspace-restore-plan";
import type {
  WorkspaceRestoreApplyOutcome,
  WorkspaceRestoreExecutionInput,
  WorkspaceRestoreExecutorCore,
  WorkspaceRestoreUndoOutcome
} from "./workspace-restore-executor";

export type {
  WorkspaceAreaReview,
  WorkspaceAreaReviewStatus,
  WorkspacePrepareImportContext,
  WorkspaceRestoreReview,
  WorkspaceRestoreSelectionArea,
  WorkspaceRestoreSelectionDraft
} from "./workspace-file-transfer-review";
export type {
  WorkspaceAreaEffectCounts,
  WorkspaceRestoreAreaPreview,
  WorkspaceRestorePlan,
  WorkspaceRestorePlanAction,
  WorkspaceRestorePlanBuildResult,
  WorkspaceRestorePriceComposition,
  WorkspaceRestoreSelectedAreaPlan
} from "./workspace-restore-plan";
export type {
  WorkspaceRestoreApplyOutcome,
  WorkspaceRestoreExecutionInput,
  WorkspaceRestoreLiveOutcome,
  WorkspaceRestoreRecoveryBoundary,
  WorkspaceRestoreUndoOutcome
} from "./workspace-restore-executor";

export interface WorkspaceFileTransferNotice {
  tone: "neutral" | "success" | "warning" | "error";
  message: string;
}

export interface WorkspaceFileTransferSnapshot {
  phase: "idle" | "reading" | "review";
  includeLastHiscoresPlayer: boolean;
  notice: WorkspaceFileTransferNotice | null;
  review: WorkspaceRestoreReview | null;
  selection?: WorkspaceRestoreSelectionDraft | null;
  restorePlan?: WorkspaceRestorePlan | null;
  restoreBusy?: boolean;
  sessionOnlyAvailable?: {
    reviewId: number;
    reason: "unavailable" | "write-failed";
  } | null;
  recoveryRequired?: boolean;
}

export type WorkspacePrepareOutcome =
  { status: "review"; reviewId: number } | { status: "rejected" } | { status: "stale" };

export type WorkspaceExportOutcome = { status: "exported" } | { status: "rejected" };

export type WorkspaceRestorePlanOutcome =
  { status: "updated"; plan: WorkspaceRestorePlan } | { status: "stale" } | { status: "rejected" };

export interface WorkspaceExportInput {
  gameData: GameDataSnapshot;
  liveState: WorkspaceLiveState;
  storageAccess: BrowserStorageAccess;
}

export interface WorkspaceFileTransferDependencies<TFile> {
  readFileText(file: TFile, maxBytes: number): Promise<string>;
  downloadJsonFile(fileName: string, value: unknown): void;
  now(): Date;
}

export function describeWorkspaceFileTransferError(error: unknown): WorkspaceFileTransferNotice {
  if (error instanceof Error && /^File exceeds \d+ bytes$/.test(error.message)) {
    return {
      tone: "error",
      message:
        "Workspace import failed: the file is too large. Choose an exported Workspace JSON under 10 MB."
    };
  }
  if (error instanceof WorkspaceBackupError) {
    if (error.code === "body_too_large") {
      return {
        tone: "error",
        message:
          "Workspace import failed: the file is too large. Choose an exported Workspace JSON under 10 MB."
      };
    }
    if (error.code === "duplicate_keys" || error.code === "duplicate_area") {
      return {
        tone: "error",
        message: "Workspace import failed: the JSON contains duplicate records."
      };
    }
    if (error.code === "unsafe_key") {
      return {
        tone: "error",
        message: "Workspace import failed: the JSON contains an unsafe object key."
      };
    }
    if (error.code === "invalid_json") {
      return { tone: "error", message: "Workspace import failed: the file is not valid JSON." };
    }
    if (error.code === "unsupported_kind" || error.code === "unsupported_version") {
      return {
        tone: "error",
        message: "Workspace import failed: this file kind or Workspace version is not supported."
      };
    }
    if (error.code === "missing_area" || error.code === "unknown_area") {
      return {
        tone: "error",
        message: "Workspace import failed: the file has an incomplete or unknown area registry."
      };
    }
    return {
      tone: "error",
      message: "Workspace import failed: the file is not a valid Workspace export."
    };
  }
  return { tone: "error", message: "Workspace import failed. Check the file and try again." };
}

export class WorkspaceFileTransferControllerCore<TFile> {
  private readonly listeners = new Set<() => void>();
  private latestAttemptId = 0;
  private planUpdater: WorkspaceRestorePlanSession["update"] | null = null;
  private restoreExecutor: WorkspaceRestoreExecutorCore | null = null;
  private snapshot: WorkspaceFileTransferSnapshot = {
    phase: "idle",
    includeLastHiscoresPlayer: false,
    notice: null,
    review: null
  };

  constructor(private readonly dependencies: WorkspaceFileTransferDependencies<TFile>) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): WorkspaceFileTransferSnapshot => this.snapshot;

  private publish(snapshot: WorkspaceFileTransferSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }

  setIncludeLastHiscoresPlayer = (include: boolean): void => {
    if (include === this.snapshot.includeLastHiscoresPlayer) return;
    this.publish({ ...this.snapshot, includeLastHiscoresPlayer: include, notice: null });
  };

  exportWorkspace = (input: WorkspaceExportInput): WorkspaceExportOutcome => {
    try {
      const exportResult = createWorkspaceBackupExport({
        ...input,
        includeLastHiscoresPlayer: this.snapshot.includeLastHiscoresPlayer,
        now: this.dependencies.now()
      } satisfies CreateWorkspaceBackupExportInput);
      this.dependencies.downloadJsonFile(exportResult.fileName, exportResult.envelope);
      this.publish({
        ...this.snapshot,
        notice: { tone: "success", message: "Workspace backup downloaded." }
      });
      return { status: "exported" };
    } catch {
      this.publish({
        ...this.snapshot,
        notice: {
          tone: "error",
          message: "Workspace export failed. Current browser state was not changed."
        }
      });
      return { status: "rejected" };
    }
  };

  prepareImport = async (
    file: TFile,
    input: WorkspacePrepareImportContext
  ): Promise<WorkspacePrepareOutcome> => {
    const attemptId = ++this.latestAttemptId;
    this.planUpdater = null;
    this.publish({
      phase: "reading",
      includeLastHiscoresPlayer: this.snapshot.includeLastHiscoresPlayer,
      notice: null,
      review: null,
      restoreBusy: false,
      sessionOnlyAvailable: null,
      recoveryRequired: false
    });
    try {
      const text = await this.dependencies.readFileText(file, WORKSPACE_BACKUP_IMPORT_MAX_BYTES);
      const parsed = parseWorkspaceBackupText(text, WORKSPACE_BACKUP_IMPORT_MAX_BYTES);
      if (attemptId !== this.latestAttemptId) return { status: "stale" };
      const planModule = await import("./workspace-restore-plan");
      if (attemptId !== this.latestAttemptId) return { status: "stale" };
      const session = planModule.createWorkspaceRestorePlanSession(attemptId, parsed, input);
      const built = session.initial;
      this.planUpdater = session.update;
      this.publish({
        phase: "review",
        includeLastHiscoresPlayer: this.snapshot.includeLastHiscoresPlayer,
        notice: null,
        review: built.review,
        selection: built.selection,
        restorePlan: built.plan
      });
      return { status: "review", reviewId: built.review.id };
    } catch (error) {
      if (attemptId !== this.latestAttemptId) return { status: "stale" };
      this.planUpdater = null;
      this.publish({
        phase: "idle",
        includeLastHiscoresPlayer: this.snapshot.includeLastHiscoresPlayer,
        notice: describeWorkspaceFileTransferError(error),
        review: null,
        restoreBusy: false,
        sessionOnlyAvailable: null,
        recoveryRequired: false
      });
      return { status: "rejected" };
    }
  };

  dismissReview = (reviewId: number): boolean => {
    if (this.snapshot.phase !== "review" || this.snapshot.review?.id !== reviewId) return false;
    this.planUpdater = null;
    this.publish({
      phase: "idle",
      includeLastHiscoresPlayer: this.snapshot.includeLastHiscoresPlayer,
      notice: null,
      review: null,
      restoreBusy: false,
      sessionOnlyAvailable: null,
      recoveryRequired: false
    });
    return true;
  };

  updateRestorePlan = (
    reviewId: number,
    action: WorkspaceRestorePlanAction,
    input: WorkspacePrepareImportContext
  ): WorkspaceRestorePlanOutcome => {
    const review = this.snapshot.review;
    if (!review || review.id !== reviewId || !this.planUpdater) {
      return { status: "stale" };
    }
    const built = this.planUpdater(action, input);
    if (!built) return { status: "rejected" };
    this.publish({
      ...this.snapshot,
      review: built.review,
      selection: built.selection,
      restorePlan: built.plan
    });
    return { status: "updated", plan: built.plan };
  };

  private revalidateRestorePlan(
    reviewId: number,
    input: WorkspacePrepareImportContext
  ): WorkspaceRestorePlan | null {
    if (
      this.snapshot.phase !== "review" ||
      this.snapshot.review?.id !== reviewId ||
      !this.planUpdater
    ) {
      return null;
    }
    const built = this.planUpdater({ kind: "revalidate" }, input);
    if (!built) return null;
    this.publish({
      ...this.snapshot,
      review: built.review,
      selection: built.selection,
      restorePlan: built.plan
    });
    return built.plan.canApply ? built.plan : null;
  }

  private publishApplyOutcome(reviewId: number, outcome: WorkspaceRestoreApplyOutcome): void {
    if (outcome.status === "applied") {
      this.planUpdater = null;
      this.publish({
        phase: "idle",
        includeLastHiscoresPlayer: this.snapshot.includeLastHiscoresPlayer,
        notice: { tone: "success", message: outcome.message },
        review: null,
        restoreBusy: false,
        sessionOnlyAvailable: null,
        recoveryRequired: false
      });
      return;
    }
    if (outcome.status === "session-only-available") {
      this.publish({
        ...this.snapshot,
        notice: { tone: "warning", message: outcome.message },
        restoreBusy: false,
        sessionOnlyAvailable: { reviewId, reason: outcome.reason },
        recoveryRequired: false
      });
      return;
    }
    this.publish({
      ...this.snapshot,
      notice: { tone: "error", message: outcome.message },
      restoreBusy: false,
      sessionOnlyAvailable: null,
      recoveryRequired: outcome.recoveryRequired
    });
  }

  private restoreToolsUnavailable(reviewId: number): WorkspaceRestoreApplyOutcome {
    const outcome: WorkspaceRestoreApplyOutcome = {
      status: "failed",
      reason: "invalid-plan",
      recoveryRequired: false,
      message: "Workspace restore tools could not be loaded. Review the file and try again."
    };
    this.publishApplyOutcome(reviewId, outcome);
    return outcome;
  }

  applyRestore = async (
    reviewId: number,
    input: WorkspaceRestoreExecutionInput
  ): Promise<WorkspaceRestoreApplyOutcome | { status: "stale" }> => {
    if (this.snapshot.restoreBusy) return { status: "stale" };
    const firstPlan = this.revalidateRestorePlan(reviewId, input.context);
    if (!firstPlan) return { status: "stale" };
    this.publish({ ...this.snapshot, restoreBusy: true, notice: null });
    let module: typeof import("./workspace-restore-executor");
    try {
      module = await import("./workspace-restore-executor");
    } catch {
      return this.restoreToolsUnavailable(reviewId);
    }
    const plan = this.revalidateRestorePlan(reviewId, input.context);
    if (!plan) {
      this.publish({ ...this.snapshot, restoreBusy: false });
      return { status: "stale" };
    }
    this.restoreExecutor ??= new module.WorkspaceRestoreExecutorCore();
    const outcome = this.restoreExecutor.applyDurable(plan, input);
    this.publishApplyOutcome(reviewId, outcome);
    return outcome;
  };

  applyRestoreForSession = async (
    reviewId: number,
    input: WorkspaceRestoreExecutionInput
  ): Promise<WorkspaceRestoreApplyOutcome | { status: "stale" }> => {
    if (this.snapshot.restoreBusy || this.snapshot.sessionOnlyAvailable?.reviewId !== reviewId) {
      return { status: "stale" };
    }
    const plan = this.revalidateRestorePlan(reviewId, input.context);
    if (!plan) return { status: "stale" };
    this.publish({ ...this.snapshot, restoreBusy: true, notice: null });
    let module: typeof import("./workspace-restore-executor");
    try {
      module = await import("./workspace-restore-executor");
    } catch {
      return this.restoreToolsUnavailable(reviewId);
    }
    const revalidated = this.revalidateRestorePlan(reviewId, input.context);
    if (!revalidated) {
      this.publish({ ...this.snapshot, restoreBusy: false });
      return { status: "stale" };
    }
    this.restoreExecutor ??= new module.WorkspaceRestoreExecutorCore();
    const outcome = this.restoreExecutor.applyForSession(revalidated, input);
    this.publishApplyOutcome(reviewId, outcome);
    return outcome;
  };

  private publishUndoOutcome(outcome: WorkspaceRestoreUndoOutcome): void {
    this.publish({
      ...this.snapshot,
      notice: {
        tone:
          outcome.status === "undone"
            ? "success"
            : outcome.status === "session-only-available"
              ? "warning"
              : "error",
        message: outcome.message
      },
      recoveryRequired: outcome.status === "failed" && outcome.recoveryRequired
    });
  }

  undoRestore = (input: WorkspaceRestoreExecutionInput): WorkspaceRestoreUndoOutcome => {
    const outcome = this.restoreExecutor?.undo(input) ?? {
      status: "failed" as const,
      reason: "no-undo" as const,
      recoveryRequired: false,
      message: "Workspace Undo is no longer available."
    };
    this.publishUndoOutcome(outcome);
    return outcome;
  };

  undoRestoreForSession = (input: WorkspaceRestoreExecutionInput): WorkspaceRestoreUndoOutcome => {
    const outcome = this.restoreExecutor?.undoForSession(input) ?? {
      status: "failed" as const,
      reason: "no-undo" as const,
      recoveryRequired: false,
      message: "Session-only Workspace Undo is no longer available."
    };
    this.publishUndoOutcome(outcome);
    return outcome;
  };
}

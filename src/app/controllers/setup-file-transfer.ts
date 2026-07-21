import type { GameDataSnapshot } from "@/domain/shared";
import type { JsonDownloadRequestResult } from "@/adapters/browser";
import {
  SETUP_IMPORT_MAX_BYTES,
  SetupImportError,
  createRewriteSetupTransferEnvelope,
  parseSavedSetupExportText
} from "../state/setup-import";
import { REWRITE_SETUP_VERSION, type SavedSetupState } from "../state/ui-state";
import {
  compareSetupTransferContext,
  createSetupTransferContext,
  type SetupTransferContextReview
} from "../state/setup-transfer-context";
import { createTransferArtifactFileName } from "../transfer-artifact-file-name";
import {
  createSetupFileChangeReview,
  setupFileReviewMatchesCurrent,
  type SetupTransferChangeReview
} from "../state/setup-transfer-changes";
import {
  failedFileExportOutcome,
  requestFileExport,
  type FileExportOutcome
} from "./file-export-outcome";

export interface SetupFileTransferNotice {
  tone: "neutral" | "error";
  message: string;
  details?: string[];
}

export interface SetupImportReview {
  id: number;
  setup: SavedSetupState;
  context: SetupTransferContextReview;
  changeReview: SetupTransferChangeReview;
  stale: boolean;
}

export interface SetupImportCandidate {
  setup: SavedSetupState;
  context: SetupTransferContextReview;
}

export interface SetupFileTransferSnapshot {
  phase: "idle" | "reading" | "review";
  notice: SetupFileTransferNotice | null;
  review: SetupImportReview | null;
}

export type SetupPrepareOutcome =
  { status: "review"; reviewId: number } | { status: "rejected" } | { status: "stale" };

export type SetupReviewConsumeOutcome =
  | { status: "accepted"; candidate: SetupImportCandidate }
  | { status: "stale" }
  | { status: "no-changes" }
  | { status: "ignored" };

export interface SetupFileTransferDependencies<TFile> {
  readFileText(file: TFile, maxBytes: number): Promise<string>;
  downloadJsonFile(fileName: string, value: unknown): JsonDownloadRequestResult;
  now(): Date;
}

function sanitizeImportDetail(value: string): string {
  return value
    .replace(/(?:[A-Za-z]:)?[\\/][^\s"']+/g, "[path]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function sanitizedIssues(error: SetupImportError): string[] | undefined {
  const details = error.issues.slice(0, 5).map(sanitizeImportDetail).filter(Boolean);
  return details.length > 0 ? details : undefined;
}

export function describeSetupFileTransferError(error: unknown): SetupFileTransferNotice {
  if (error instanceof Error && /^File exceeds \d+ bytes$/.test(error.message)) {
    return {
      tone: "error",
      message:
        "Setup import failed: the file is too large. Choose an exported setup JSON under 250 KB."
    };
  }

  if (error instanceof SetupImportError) {
    if (error.code === "body_too_large") {
      return {
        tone: "error",
        message:
          "Setup import failed: the file is too large. Choose an exported setup JSON under 250 KB."
      };
    }
    if (error.code === "duplicate_keys") {
      return {
        tone: "error",
        message: "Setup import failed: the JSON contains duplicate keys."
      };
    }
    if (error.code === "invalid_json") {
      return { tone: "error", message: "Setup import failed: the file is not valid JSON." };
    }
    if (error.code === "unsupported_version") {
      return {
        tone: "error",
        message: `Setup import failed: this app supports contextual setup file version 1 or legacy rewrite setup version ${REWRITE_SETUP_VERSION}. Export a fresh setup and try again.`
      };
    }
    if (error.code === "incompatible_entities") {
      return {
        tone: "error",
        message: "Setup import failed: the setup references data unavailable in this game version.",
        details: sanitizedIssues(error)
      };
    }
    return {
      tone: "error",
      message: "Setup import failed: the file is not a valid rewrite setup export.",
      details: sanitizedIssues(error)
    };
  }

  return { tone: "error", message: "Setup import failed. Check the file and try again." };
}

function createSetupImportReview(
  id: number,
  setup: SavedSetupState,
  currentSetup: SavedSetupState,
  gameData: GameDataSnapshot,
  context: SetupTransferContextReview
): SetupImportReview {
  return {
    id,
    setup,
    context,
    changeReview: createSetupFileChangeReview({
      current: currentSetup,
      incoming: setup,
      gameData
    }),
    stale: false
  };
}

export class SetupFileTransferControllerCore<TFile> {
  private readonly listeners = new Set<() => void>();
  private latestAttemptId = 0;
  private snapshot: SetupFileTransferSnapshot = {
    phase: "idle",
    notice: null,
    review: null
  };

  constructor(private readonly dependencies: SetupFileTransferDependencies<TFile>) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SetupFileTransferSnapshot => this.snapshot;

  private publish(snapshot: SetupFileTransferSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }

  prepareImport = async (
    file: TFile,
    gameData: GameDataSnapshot,
    currentSetup: SavedSetupState
  ): Promise<SetupPrepareOutcome> => {
    const attemptId = ++this.latestAttemptId;
    this.publish({ phase: "reading", notice: null, review: null });
    try {
      const text = await this.dependencies.readFileText(file, SETUP_IMPORT_MAX_BYTES);
      const parsed = parseSavedSetupExportText(text, gameData, SETUP_IMPORT_MAX_BYTES);
      if (attemptId !== this.latestAttemptId) return { status: "stale" };
      const review = createSetupImportReview(
        attemptId,
        parsed.data,
        currentSetup,
        gameData,
        compareSetupTransferContext(parsed.context, gameData)
      );
      this.publish({ phase: "review", notice: null, review });
      return { status: "review", reviewId: review.id };
    } catch (error) {
      if (attemptId !== this.latestAttemptId) return { status: "stale" };
      this.publish({ phase: "idle", notice: describeSetupFileTransferError(error), review: null });
      return { status: "rejected" };
    }
  };

  dismissReview = (reviewId: number): boolean => {
    if (this.snapshot.phase !== "review" || this.snapshot.review?.id !== reviewId) return false;
    this.publish({ phase: "idle", notice: null, review: null });
    return true;
  };

  checkReviewFreshness = (reviewId: number, currentSetup: SavedSetupState): boolean => {
    const review = this.snapshot.review;
    if (this.snapshot.phase !== "review" || review?.id !== reviewId) return false;
    if (review.stale) return false;
    if (setupFileReviewMatchesCurrent(review.changeReview, currentSetup)) return true;
    this.publish({ ...this.snapshot, review: { ...review, stale: true } });
    return false;
  };

  refreshReview = (
    reviewId: number,
    currentSetup: SavedSetupState,
    gameData: GameDataSnapshot
  ): boolean => {
    const review = this.snapshot.review;
    if (this.snapshot.phase !== "review" || review?.id !== reviewId) return false;
    this.publish({
      ...this.snapshot,
      review: createSetupImportReview(
        review.id,
        review.setup,
        currentSetup,
        gameData,
        review.context
      )
    });
    return true;
  };

  consumeReview = (reviewId: number, currentSetup: SavedSetupState): SetupReviewConsumeOutcome => {
    const review = this.snapshot.review;
    if (this.snapshot.phase !== "review" || review?.id !== reviewId) {
      return { status: "ignored" };
    }
    if (review.stale || !setupFileReviewMatchesCurrent(review.changeReview, currentSetup)) {
      if (!review.stale) this.publish({ ...this.snapshot, review: { ...review, stale: true } });
      return { status: "stale" };
    }
    if (review.changeReview.changeCount === 0) return { status: "no-changes" };
    const candidate: SetupImportCandidate = {
      setup: review.setup,
      context: review.context
    };
    this.publish({ phase: "idle", notice: null, review: null });
    return { status: "accepted", candidate };
  };

  exportSetup = (setup: SavedSetupState, gameData: GameDataSnapshot): FileExportOutcome => {
    let outcome: FileExportOutcome;
    try {
      const now = this.dependencies.now();
      const fileName = createTransferArtifactFileName({
        artifact: "combat-setup",
        context: gameData.monsters[setup.form.monsterId]?.name ?? "",
        revision: createSetupTransferContext(gameData).gameRevision,
        now
      });
      outcome = requestFileExport("setup", fileName, () =>
        this.dependencies.downloadJsonFile(
          fileName,
          createRewriteSetupTransferEnvelope(setup, gameData, now)
        )
      );
    } catch {
      outcome = failedFileExportOutcome("setup");
    }
    this.publish({ ...this.snapshot, notice: outcome.notice });
    return outcome;
  };
}

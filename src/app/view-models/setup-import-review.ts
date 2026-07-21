import type { SetupTransferContextReview } from "../state/setup-transfer-context";
import type { SetupChangeGroup, SetupTransferChangeReview } from "../state/setup-transfer-changes";

interface SetupImportReviewCandidate {
  id: number;
  context: SetupTransferContextReview;
  changeReview: SetupTransferChangeReview;
  stale: boolean;
}

export interface SetupImportReviewViewModel {
  id: number;
  artifactLabel: string;
  changeSummary: string;
  contextTone: "ready" | "warning";
  contextMessage: string;
  includedScope: readonly string[];
  excludedScope: readonly string[];
  groups: readonly SetupChangeGroup[];
  stale: boolean;
  staleMessage: string | null;
  noChanges: boolean;
  noChangesMessage: string | null;
  canApply: boolean;
  statusLabel: string;
  statusTone: "ready" | "warning" | "neutral";
  consequence: string;
}

export function buildSetupImportReviewViewModel(
  review: SetupImportReviewCandidate
): SetupImportReviewViewModel {
  const changeCount = review.changeReview.changeCount;
  const noChanges = changeCount === 0;
  return {
    id: review.id,
    artifactLabel: "Combat setup file",
    changeSummary:
      changeCount === 1
        ? "1 changed field"
        : `${changeCount.toLocaleString("en-GB")} changed fields`,
    contextTone: review.context.tone,
    contextMessage: review.context.message,
    includedScope: review.changeReview.includedScope,
    excludedScope: review.changeReview.excludedScope,
    groups: review.changeReview.groups,
    stale: review.stale,
    staleMessage: review.stale ? "Current setup changed after this review was prepared." : null,
    noChanges,
    noChangesMessage: noChanges ? "No changes. This file matches the current setup." : null,
    canApply: !review.stale && !noChanges,
    statusLabel: review.stale ? "Refresh required" : noChanges ? "No changes" : "Ready to apply",
    statusTone: review.stale ? "warning" : noChanges ? "neutral" : "ready",
    consequence:
      "Applying replaces the included setup areas only. Excluded browser data and calculated results stay unchanged."
  };
}

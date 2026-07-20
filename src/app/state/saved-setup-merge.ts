import {
  DuelSnapshotsStateSchema,
  MAX_DUEL_SNAPSHOTS,
  fingerprintDuelSnapshots,
  normalizeDuelSnapshotName,
  normalizeDuelSnapshotNameKey,
  normalizeDuelSnapshotsState,
  type DuelSnapshotState,
  type DuelSnapshotsState
} from "./duel-snapshots";

export type SavedSetupMergeClassification =
  "unchanged" | "replacement-candidate" | "addition-candidate" | "capacity-excluded";

export type SavedSetupMergeDecision = "no-change" | "keep" | "replace" | "add" | "exclude";
export type SavedSetupMergeNameStatus = "available" | "conflict" | "invalid" | "not-applicable";

export interface SavedSetupMergePlanRow {
  source: DuelSnapshotState;
  current: DuelSnapshotState | null;
  classification: SavedSetupMergeClassification;
  decision: SavedSetupMergeDecision;
  recipientName: string;
  nameStatus: SavedSetupMergeNameStatus;
}

export interface SavedSetupMergeCounts {
  setupCount: number;
  selectedAddCount: number;
  selectedReplaceCount: number;
  keepCount: number;
  identicalCount: number;
  notSelectedCount: number;
  availableSlots: number;
}

export interface SavedSetupMergePlan {
  reviewId: number;
  source: DuelSnapshotsState;
  current: DuelSnapshotsState;
  currentFingerprint: string;
  currentCount: number;
  rows: SavedSetupMergePlanRow[];
  counts: SavedSetupMergeCounts;
  canMerge: boolean;
}

export type SavedSetupMergeCandidate =
  | {
      status: "ready";
      state: DuelSnapshotsState;
      counts: SavedSetupMergeCounts;
    }
  | { status: "stale" | "invalid" | "no-op"; counts: SavedSetupMergeCounts };

function sameSnapshot(left: DuelSnapshotState, right: DuelSnapshotState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function countsFor(
  plan: Pick<SavedSetupMergePlan, "rows" | "currentCount">
): SavedSetupMergeCounts {
  return {
    setupCount: plan.rows.length,
    selectedAddCount: plan.rows.filter((row) => row.decision === "add").length,
    selectedReplaceCount: plan.rows.filter((row) => row.decision === "replace").length,
    keepCount: plan.rows.filter((row) => row.decision === "keep").length,
    identicalCount: plan.rows.filter((row) => row.decision === "no-change").length,
    notSelectedCount: plan.rows.filter((row) => row.decision === "exclude").length,
    availableSlots: Math.max(0, MAX_DUEL_SNAPSHOTS - plan.currentCount)
  };
}

function resultingSnapshots(plan: SavedSetupMergePlan): DuelSnapshotState[] {
  const replacementById = new Map(
    plan.rows
      .filter((row) => row.decision === "replace")
      .map((row) => [
        row.source.id,
        { ...row.source, name: normalizeDuelSnapshotName(row.recipientName) }
      ])
  );
  const current = normalizeDuelSnapshotsState(plan.current).snapshots;
  const result = current.map((snapshot) => replacementById.get(snapshot.id) ?? snapshot);
  for (const row of plan.rows) {
    if (row.decision === "add") {
      result.push({ ...row.source, name: normalizeDuelSnapshotName(row.recipientName) });
    }
  }
  return result;
}

function reconcile(plan: SavedSetupMergePlan): SavedSetupMergePlan {
  const prospective = resultingSnapshots(plan);
  const rows = plan.rows.map((row): SavedSetupMergePlanRow => {
    if (row.decision !== "add" && row.decision !== "replace") {
      return { ...row, nameStatus: "not-applicable" };
    }
    const name = normalizeDuelSnapshotName(row.recipientName);
    if (!name || name.length > 80) return { ...row, nameStatus: "invalid" };
    const retainsExactCurrentName =
      row.decision === "replace" && row.current !== null && name === row.current.name;
    const key = normalizeDuelSnapshotNameKey(name);
    const conflict = prospective.some(
      (candidate) =>
        candidate.id !== row.source.id && normalizeDuelSnapshotNameKey(candidate.name) === key
    );
    return {
      ...row,
      nameStatus: conflict && !retainsExactCurrentName ? "conflict" : "available"
    };
  });
  const counts = countsFor({ rows, currentCount: plan.currentCount });
  const changed = counts.selectedAddCount + counts.selectedReplaceCount > 0;
  const namesValid = rows.every(
    (row) =>
      (row.decision !== "add" && row.decision !== "replace") || row.nameStatus === "available"
  );
  return {
    ...plan,
    rows,
    counts,
    canMerge: changed && namesValid && counts.selectedAddCount <= counts.availableSlots
  };
}

export function createSavedSetupMergePlan(input: {
  reviewId: number;
  source: DuelSnapshotsState;
  current: DuelSnapshotsState;
}): SavedSetupMergePlan {
  const source = normalizeDuelSnapshotsState(input.source);
  const current = normalizeDuelSnapshotsState(input.current);
  const currentById = new Map(current.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  let available = Math.max(0, MAX_DUEL_SNAPSHOTS - current.snapshots.length);
  const rows = source.snapshots.map((snapshot): SavedSetupMergePlanRow => {
    const match = currentById.get(snapshot.id) ?? null;
    if (match && sameSnapshot(match, snapshot)) {
      return {
        source: snapshot,
        current: match,
        classification: "unchanged",
        decision: "no-change",
        recipientName: snapshot.name,
        nameStatus: "not-applicable"
      };
    }
    if (match) {
      return {
        source: snapshot,
        current: match,
        classification: "replacement-candidate",
        decision: "keep",
        recipientName: snapshot.name,
        nameStatus: "not-applicable"
      };
    }
    const selected = available > 0;
    if (selected) available -= 1;
    return {
      source: snapshot,
      current: null,
      classification: selected ? "addition-candidate" : "capacity-excluded",
      decision: selected ? "add" : "exclude",
      recipientName: snapshot.name,
      nameStatus: selected ? "available" : "not-applicable"
    };
  });
  return reconcile({
    reviewId: input.reviewId,
    source,
    current,
    currentFingerprint: fingerprintDuelSnapshots(current),
    currentCount: current.snapshots.length,
    rows,
    counts: countsFor({ rows, currentCount: current.snapshots.length }),
    canMerge: false
  });
}

export function savedSetupMergePlanIsFresh(
  plan: SavedSetupMergePlan,
  current: DuelSnapshotsState
): boolean {
  return plan.currentFingerprint === fingerprintDuelSnapshots(current);
}

export function setSavedSetupMergeDecision(input: {
  plan: SavedSetupMergePlan;
  current: DuelSnapshotsState;
  snapshotId: string;
  decision: "keep" | "replace" | "add" | "exclude";
}): SavedSetupMergePlan {
  if (!savedSetupMergePlanIsFresh(input.plan, input.current)) return input.plan;
  const row = input.plan.rows.find((candidate) => candidate.source.id === input.snapshotId);
  if (!row) return input.plan;
  if (
    row.classification === "replacement-candidate" &&
    !["keep", "replace"].includes(input.decision)
  ) {
    return input.plan;
  }
  if (
    (row.classification === "addition-candidate" || row.classification === "capacity-excluded") &&
    !["add", "exclude"].includes(input.decision)
  ) {
    return input.plan;
  }
  if (input.decision === "add" && row.decision !== "add") {
    const counts = countsFor(input.plan);
    if (counts.selectedAddCount >= counts.availableSlots) return input.plan;
  }
  return reconcile({
    ...input.plan,
    rows: input.plan.rows.map((candidate) =>
      candidate.source.id === input.snapshotId
        ? { ...candidate, decision: input.decision }
        : candidate
    )
  });
}

export function setSavedSetupMergeRecipientName(input: {
  plan: SavedSetupMergePlan;
  current: DuelSnapshotsState;
  snapshotId: string;
  name: string;
}): SavedSetupMergePlan {
  if (!savedSetupMergePlanIsFresh(input.plan, input.current)) return input.plan;
  return reconcile({
    ...input.plan,
    rows: input.plan.rows.map((row) =>
      row.source.id === input.snapshotId ? { ...row, recipientName: input.name } : row
    )
  });
}

export function buildSavedSetupMergeCandidate(
  plan: SavedSetupMergePlan,
  current: DuelSnapshotsState
): SavedSetupMergeCandidate {
  if (!savedSetupMergePlanIsFresh(plan, current)) return { status: "stale", counts: plan.counts };
  const reconciled = reconcile(plan);
  if (!reconciled.canMerge) {
    const changed = reconciled.counts.selectedAddCount + reconciled.counts.selectedReplaceCount > 0;
    return { status: changed ? "invalid" : "no-op", counts: reconciled.counts };
  }
  try {
    return {
      status: "ready",
      state: DuelSnapshotsStateSchema.parse({ snapshots: resultingSnapshots(reconciled) }),
      counts: reconciled.counts
    };
  } catch {
    return { status: "invalid", counts: reconciled.counts };
  }
}

import { PriceSetSchema } from "@/data/schemas";
import type { PriceSet } from "@/domain/shared";
import {
  BrowserPriceHistoryStateSchema,
  PRICE_HISTORY_MAX_SNAPSHOTS,
  createPriceHistorySnapshot,
  priceHistorySnapshotKey,
  type BrowserPriceHistorySnapshot,
  type BrowserPriceHistoryState
} from "./price-history";

export interface LocalPriceHistoryOccurrence {
  occurrenceId: string;
  sourceIndex: number;
  occurrenceOrdinal: number;
  snapshotKey: string;
  snapshot: BrowserPriceHistorySnapshot;
  newest: boolean;
  oldest: boolean;
  nextReplacement: boolean;
}

export interface LocalPriceHistoryRemovalCandidate {
  id: number;
  sourceHistory: BrowserPriceHistoryState;
  target: {
    occurrenceId: string;
    sourceIndex: number;
    snapshot: BrowserPriceHistorySnapshot;
  };
}

export interface FullHistoryReplacementCandidate {
  id: number;
  sourceHistory: BrowserPriceHistoryState;
  sourceActivePriceSet: PriceSet;
  newSnapshot: BrowserPriceHistorySnapshot;
  replacedOccurrence: {
    occurrenceId: string;
    sourceIndex: number;
    snapshot: BrowserPriceHistorySnapshot;
  };
}

export type LocalPriceHistoryMutationOutcome =
  | { status: "ready"; prior: BrowserPriceHistoryState; next: BrowserPriceHistoryState }
  | { status: "stale"; message: string }
  | { status: "no-op"; message: string };

function canonical(value: unknown): string {
  const normalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (candidate === null || typeof candidate !== "object") return candidate;
    return Object.fromEntries(
      Object.entries(candidate as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)])
    );
  };
  return JSON.stringify(normalize(value));
}

function occurrenceId(snapshotKey: string, ordinal: number): string {
  return `${encodeURIComponent(snapshotKey)}--${ordinal}`;
}

export function localPriceHistoryOccurrences(
  state: BrowserPriceHistoryState
): readonly LocalPriceHistoryOccurrence[] {
  const validated = BrowserPriceHistoryStateSchema.parse(state);
  const ordinalByKey = new Map<string, number>();
  const rows = validated.snapshots.map((snapshot, sourceIndex) => {
    const snapshotKey = priceHistorySnapshotKey(snapshot);
    const occurrenceOrdinal = ordinalByKey.get(snapshotKey) ?? 0;
    ordinalByKey.set(snapshotKey, occurrenceOrdinal + 1);
    return {
      occurrenceId: occurrenceId(snapshotKey, occurrenceOrdinal),
      occurrenceOrdinal,
      sourceIndex,
      snapshotKey,
      snapshot,
      newest: false,
      oldest: false,
      nextReplacement: false
    };
  });
  rows.sort(
    (left, right) =>
      Date.parse(right.snapshot.capturedAt) - Date.parse(left.snapshot.capturedAt) ||
      left.sourceIndex - right.sourceIndex
  );
  return rows.map((row, index) => ({
    ...row,
    newest: index === 0,
    oldest: index === rows.length - 1,
    nextReplacement:
      validated.snapshots.length >= PRICE_HISTORY_MAX_SNAPSHOTS && index === rows.length - 1
  }));
}

export function createLocalPriceHistoryRemovalCandidate(input: {
  id: number;
  history: BrowserPriceHistoryState;
  occurrenceId: string;
}): LocalPriceHistoryRemovalCandidate | null {
  const sourceHistory = BrowserPriceHistoryStateSchema.parse(input.history);
  const occurrence = localPriceHistoryOccurrences(sourceHistory).find(
    (candidate) => candidate.occurrenceId === input.occurrenceId
  );
  if (!occurrence) return null;
  return {
    id: input.id,
    sourceHistory,
    target: {
      occurrenceId: occurrence.occurrenceId,
      sourceIndex: occurrence.sourceIndex,
      snapshot: occurrence.snapshot
    }
  };
}

export function deriveLocalPriceHistoryRemoval(
  candidate: LocalPriceHistoryRemovalCandidate,
  latest: BrowserPriceHistoryState
): LocalPriceHistoryMutationOutcome {
  const current = BrowserPriceHistoryStateSchema.parse(latest);
  if (canonical(current) !== canonical(candidate.sourceHistory)) {
    return { status: "stale", message: "Price history changed. Review removal again." };
  }
  const target = current.snapshots[candidate.target.sourceIndex];
  if (!target || canonical(target) !== canonical(candidate.target.snapshot)) {
    return { status: "no-op", message: "This local comparison is no longer available." };
  }
  return {
    status: "ready",
    prior: current,
    next: BrowserPriceHistoryStateSchema.parse({
      snapshots: current.snapshots.filter((_, index) => index !== candidate.target.sourceIndex)
    })
  };
}

export function createFullHistoryReplacementCandidate(input: {
  id: number;
  history: BrowserPriceHistoryState;
  activePriceSet: PriceSet;
  capturedAt: Date;
}): FullHistoryReplacementCandidate | null {
  const sourceHistory = BrowserPriceHistoryStateSchema.parse(input.history);
  if (sourceHistory.snapshots.length < PRICE_HISTORY_MAX_SNAPSHOTS) return null;
  const sourceActivePriceSet = PriceSetSchema.parse(input.activePriceSet) as PriceSet;
  const oldest = localPriceHistoryOccurrences(sourceHistory).at(-1);
  if (!oldest) return null;
  return {
    id: input.id,
    sourceHistory,
    sourceActivePriceSet,
    newSnapshot: createPriceHistorySnapshot(sourceActivePriceSet, input.capturedAt),
    replacedOccurrence: {
      occurrenceId: oldest.occurrenceId,
      sourceIndex: oldest.sourceIndex,
      snapshot: oldest.snapshot
    }
  };
}

export function deriveFullHistoryReplacement(
  candidate: FullHistoryReplacementCandidate,
  latestHistory: BrowserPriceHistoryState,
  latestActivePriceSet: PriceSet
): LocalPriceHistoryMutationOutcome {
  const history = BrowserPriceHistoryStateSchema.parse(latestHistory);
  const activePriceSet = PriceSetSchema.parse(latestActivePriceSet) as PriceSet;
  if (
    canonical(history) !== canonical(candidate.sourceHistory) ||
    canonical(activePriceSet) !== canonical(candidate.sourceActivePriceSet)
  ) {
    return { status: "stale", message: "Price history changed. Review the replacement again." };
  }
  const target = history.snapshots[candidate.replacedOccurrence.sourceIndex];
  if (!target || canonical(target) !== canonical(candidate.replacedOccurrence.snapshot)) {
    return { status: "no-op", message: "The oldest local comparison is no longer available." };
  }
  return {
    status: "ready",
    prior: history,
    next: BrowserPriceHistoryStateSchema.parse({
      snapshots: [
        candidate.newSnapshot,
        ...history.snapshots.filter(
          (_, index) => index !== candidate.replacedOccurrence.sourceIndex
        )
      ]
    })
  };
}

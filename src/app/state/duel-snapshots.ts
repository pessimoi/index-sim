import { z } from "zod";

import {
  CombatSetupFormSchema,
  normalizeFormState,
  type CombatSetupFormState
} from "./ui-state";

export const DUEL_SNAPSHOTS_STORAGE_KEY = "index-sim:duel-snapshots";
export const DUEL_SNAPSHOTS_VERSION = 1;
export const MAX_DUEL_SNAPSHOTS = 12;
export const DUEL_SNAPSHOT_NAME_MAX_LENGTH = 80;
export const DUEL_SNAPSHOT_ID_MAX_LENGTH = 80;

export interface DuelSnapshotState {
  id: string;
  name: string;
  form: CombatSetupFormState;
}

export interface DuelSnapshotsState {
  snapshots: DuelSnapshotState[];
}

export const DEFAULT_DUEL_SNAPSHOTS_STATE: DuelSnapshotsState = { snapshots: [] };

export function normalizeDuelSnapshotName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

const DuelSnapshotIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(DUEL_SNAPSHOT_ID_MAX_LENGTH)
  .regex(/^[A-Za-z0-9:_-]+$/);

const DuelSnapshotNameSchema = z
  .string()
  .transform(normalizeDuelSnapshotName)
  .pipe(z.string().min(1).max(DUEL_SNAPSHOT_NAME_MAX_LENGTH));

export const DuelSnapshotSchema: z.ZodType<DuelSnapshotState> = z
  .object({
    id: DuelSnapshotIdSchema,
    name: DuelSnapshotNameSchema,
    form: CombatSetupFormSchema
  })
  .strict()
  .transform((snapshot) => ({
    id: snapshot.id,
    name: snapshot.name,
    form: normalizeFormState(snapshot.form)
  }));

function dedupeDuelSnapshots(
  snapshots: readonly DuelSnapshotState[],
  max = MAX_DUEL_SNAPSHOTS
): DuelSnapshotState[] {
  const byId = new Map<string, DuelSnapshotState>();
  const order: string[] = [];
  for (const snapshot of snapshots) {
    if (!byId.has(snapshot.id)) order.push(snapshot.id);
    byId.set(snapshot.id, snapshot);
  }
  return order
    .map((id) => byId.get(id))
    .filter((snapshot): snapshot is DuelSnapshotState => snapshot != null)
    .slice(0, max);
}

export const DuelSnapshotsStateSchema: z.ZodType<DuelSnapshotsState> = z
  .object({
    snapshots: z.array(DuelSnapshotSchema).max(MAX_DUEL_SNAPSHOTS)
  })
  .strict()
  .transform((state) => ({ snapshots: dedupeDuelSnapshots(state.snapshots) }));

export function createDuelSnapshot(
  id: string,
  name: string,
  form: CombatSetupFormState
): DuelSnapshotState {
  return DuelSnapshotSchema.parse({ id, name, form });
}

export function normalizeDuelSnapshotsState(state: DuelSnapshotsState): DuelSnapshotsState {
  return {
    snapshots: dedupeDuelSnapshots(
      state.snapshots.map((snapshot) => DuelSnapshotSchema.parse(snapshot))
    )
  };
}

export function appendDuelSnapshot(
  state: DuelSnapshotsState,
  snapshot: DuelSnapshotState
): DuelSnapshotsState {
  const normalized = DuelSnapshotSchema.parse(snapshot);
  const existing = normalizeDuelSnapshotsState(state).snapshots.filter(
    (candidate) => candidate.id !== normalized.id
  );
  return { snapshots: [...existing, normalized].slice(-MAX_DUEL_SNAPSHOTS) };
}

export function renameDuelSnapshot(
  state: DuelSnapshotsState,
  snapshotId: string,
  name: string
): DuelSnapshotsState {
  const normalizedName = DuelSnapshotNameSchema.parse(name);
  return {
    snapshots: normalizeDuelSnapshotsState(state).snapshots.map((snapshot) =>
      snapshot.id === snapshotId ? { ...snapshot, name: normalizedName } : snapshot
    )
  };
}

export function removeDuelSnapshot(
  state: DuelSnapshotsState,
  snapshotId: string
): DuelSnapshotsState {
  return {
    snapshots: normalizeDuelSnapshotsState(state).snapshots.filter(
      (snapshot) => snapshot.id !== snapshotId
    )
  };
}

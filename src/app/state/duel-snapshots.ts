import { z } from "zod";

import { CombatSetupFormSchema, normalizeFormState, type CombatSetupFormState } from "./ui-state";

export const DUEL_SNAPSHOTS_STORAGE_KEY = "index-sim:duel-snapshots";
export const DUEL_SNAPSHOTS_VERSION = 1;
export const MAX_DUEL_SNAPSHOTS = 12;
export const DUEL_SNAPSHOT_NAME_MAX_LENGTH = 80;
export const DUEL_SNAPSHOT_ID_MAX_LENGTH = 80;
export const DUEL_SNAPSHOTS_IMPORT_MAX_BYTES = 250_000;

export interface DuelSnapshotState {
  id: string;
  name: string;
  form: CombatSetupFormState;
}

export interface DuelSnapshotsState {
  snapshots: DuelSnapshotState[];
}

export interface DuelSnapshotsExportEnvelope {
  version: typeof DUEL_SNAPSHOTS_VERSION;
  exportedAt: string;
  data: DuelSnapshotsState;
}

export type DuelSnapshotsImportErrorCode =
  "body_too_large" | "invalid_json" | "unsupported_version" | "invalid_data";

export class DuelSnapshotsImportError extends Error {
  constructor(readonly code: DuelSnapshotsImportErrorCode) {
    super(code);
    this.name = "DuelSnapshotsImportError";
  }
}

export interface MergeDuelSnapshotsResult {
  state: DuelSnapshotsState;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
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

export const DuelSnapshotsExportEnvelopeSchema: z.ZodType<DuelSnapshotsExportEnvelope> = z
  .object({
    version: z.literal(DUEL_SNAPSHOTS_VERSION),
    exportedAt: z.string().trim().min(1).max(64),
    data: DuelSnapshotsStateSchema
  })
  .strict();

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

export function createDuelSnapshotsExport(
  state: DuelSnapshotsState,
  now = new Date()
): DuelSnapshotsExportEnvelope {
  return DuelSnapshotsExportEnvelopeSchema.parse({
    version: DUEL_SNAPSHOTS_VERSION,
    exportedAt: now.toISOString(),
    data: normalizeDuelSnapshotsState(state)
  });
}

export function parseDuelSnapshotsExportText(
  text: string,
  maxBytes = DUEL_SNAPSHOTS_IMPORT_MAX_BYTES
): DuelSnapshotsExportEnvelope {
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new DuelSnapshotsImportError("body_too_large");
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new DuelSnapshotsImportError("invalid_json");
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version !== DUEL_SNAPSHOTS_VERSION
  ) {
    throw new DuelSnapshotsImportError("unsupported_version");
  }

  const parsed = DuelSnapshotsExportEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw new DuelSnapshotsImportError("invalid_data");
  return parsed.data;
}

export function mergeDuelSnapshots(
  current: DuelSnapshotsState,
  imported: DuelSnapshotsState
): MergeDuelSnapshotsResult {
  const snapshots = [...normalizeDuelSnapshotsState(current).snapshots];
  const incoming = normalizeDuelSnapshotsState(imported).snapshots;
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const snapshot of incoming) {
    const existingIndex = snapshots.findIndex((candidate) => candidate.id === snapshot.id);
    if (existingIndex >= 0) {
      snapshots[existingIndex] = snapshot;
      updatedCount += 1;
    } else if (snapshots.length < MAX_DUEL_SNAPSHOTS) {
      snapshots.push(snapshot);
      addedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  return {
    state: { snapshots },
    addedCount,
    updatedCount,
    skippedCount
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

import { z } from "zod";
import {
  DataReliabilityError,
  assertUniqueRecordIds,
  parseJsonWithDuplicateKeyCheck
} from "@/data/reliability";

import { CombatSetupFormSchema, normalizeFormState, type CombatSetupFormState } from "./ui-state";
import { duelSnapshotsCompatibilityIssues } from "./setup-compatibility";
import type { GameDataSnapshot } from "@/domain/shared";
import {
  SetupTransferContextV1Schema,
  createSetupTransferContext,
  type SetupTransferContextV1
} from "./setup-transfer-context";

export const DUEL_SNAPSHOTS_STORAGE_KEY = "index-sim:duel-snapshots";
export const DUEL_SNAPSHOTS_VERSION = 1;
export const MAX_DUEL_SNAPSHOTS = 12;
export const DUEL_SNAPSHOT_NAME_MAX_LENGTH = 80;
export const DUEL_SNAPSHOT_ID_MAX_LENGTH = 80;
export const DUEL_SNAPSHOTS_IMPORT_MAX_BYTES = 250_000;
export const DUEL_SNAPSHOTS_TRANSFER_KIND = "index-sim-saved-setups";
export const DUEL_SNAPSHOTS_TRANSFER_VERSION = 1;

export interface DuelSnapshotState {
  id: string;
  name: string;
  form: CombatSetupFormState;
}

export interface DuelSnapshotsState {
  snapshots: DuelSnapshotState[];
}

export interface DuelSnapshotsLegacyExportEnvelope {
  version: typeof DUEL_SNAPSHOTS_VERSION;
  exportedAt: string;
  data: DuelSnapshotsState;
}

export interface DuelSnapshotsTransferEnvelopeV1 {
  kind: typeof DUEL_SNAPSHOTS_TRANSFER_KIND;
  version: typeof DUEL_SNAPSHOTS_TRANSFER_VERSION;
  exportedAt: string;
  context: SetupTransferContextV1;
  data: DuelSnapshotsState;
}

export interface ParsedDuelSnapshotsTransfer {
  format: "contextual-v1" | "legacy-v1";
  version: number;
  exportedAt: string;
  context: SetupTransferContextV1 | null;
  data: DuelSnapshotsState;
}

export type DuelSnapshotsImportErrorCode =
  | "body_too_large"
  | "duplicate_keys"
  | "duplicate_ids"
  | "invalid_json"
  | "unsupported_version"
  | "invalid_data"
  | "incompatible_entities";

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

export function createDuelSnapshotId(nowMs = Date.now(), randomValue = Math.random()): string {
  return `duel-${nowMs.toString(36)}-${randomValue.toString(36).slice(2, 8)}`;
}

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

export const DuelSnapshotsLegacyExportEnvelopeSchema: z.ZodType<DuelSnapshotsLegacyExportEnvelope> =
  z
    .object({
      version: z.literal(DUEL_SNAPSHOTS_VERSION),
      exportedAt: z.string().trim().min(1).max(64),
      data: DuelSnapshotsStateSchema
    })
    .strict();

// Retained as the explicit prior external-file parser and test fixture owner.
export const DuelSnapshotsExportEnvelopeSchema = DuelSnapshotsLegacyExportEnvelopeSchema;

export const DuelSnapshotsTransferEnvelopeV1Schema: z.ZodType<DuelSnapshotsTransferEnvelopeV1> = z
  .object({
    kind: z.literal(DUEL_SNAPSHOTS_TRANSFER_KIND),
    version: z.literal(DUEL_SNAPSHOTS_TRANSFER_VERSION),
    exportedAt: z.iso.datetime({ offset: true }).max(64),
    context: SetupTransferContextV1Schema,
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
  gameData: GameDataSnapshot,
  now = new Date()
): DuelSnapshotsTransferEnvelopeV1 {
  return DuelSnapshotsTransferEnvelopeV1Schema.parse({
    kind: DUEL_SNAPSHOTS_TRANSFER_KIND,
    version: DUEL_SNAPSHOTS_TRANSFER_VERSION,
    exportedAt: now.toISOString(),
    context: createSetupTransferContext(gameData),
    data: normalizeDuelSnapshotsState(state)
  });
}

export function parseDuelSnapshotsExportText(
  text: string,
  maxBytes = DUEL_SNAPSHOTS_IMPORT_MAX_BYTES,
  gameData?: GameDataSnapshot
): ParsedDuelSnapshotsTransfer {
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new DuelSnapshotsImportError("body_too_large");
  }

  let value: unknown;
  try {
    value = parseJsonWithDuplicateKeyCheck(text, { maxBytes, source: "Duel snapshot import" });
  } catch (error) {
    if (error instanceof DataReliabilityError && error.code === "duplicate_keys") {
      throw new DuelSnapshotsImportError("duplicate_keys");
    }
    throw new DuelSnapshotsImportError("invalid_json");
  }

  const record = typeof value === "object" && value !== null ? value : null;
  const contextual =
    record !== null && "kind" in record && record.kind === DUEL_SNAPSHOTS_TRANSFER_KIND;
  if (record !== null && "kind" in record && !contextual) {
    throw new DuelSnapshotsImportError("unsupported_version");
  }
  if (
    record !== null &&
    "version" in record &&
    record.version !== (contextual ? DUEL_SNAPSHOTS_TRANSFER_VERSION : DUEL_SNAPSHOTS_VERSION)
  ) {
    throw new DuelSnapshotsImportError("unsupported_version");
  }

  try {
    const data = value !== null && typeof value === "object" && "data" in value ? value.data : null;
    const snapshots =
      data !== null &&
      typeof data === "object" &&
      "snapshots" in data &&
      Array.isArray(data.snapshots)
        ? data.snapshots
        : [];
    assertUniqueRecordIds(
      snapshots.filter(
        (snapshot): snapshot is Record<string, unknown> =>
          snapshot !== null && typeof snapshot === "object" && !Array.isArray(snapshot)
      ),
      { label: "Duel snapshots" }
    );
  } catch (error) {
    if (error instanceof DataReliabilityError && error.code === "duplicate_ids") {
      throw new DuelSnapshotsImportError("duplicate_ids");
    }
    throw error;
  }

  const parsed = contextual
    ? DuelSnapshotsTransferEnvelopeV1Schema.safeParse(value)
    : DuelSnapshotsLegacyExportEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw new DuelSnapshotsImportError("invalid_data");
  if (gameData && duelSnapshotsCompatibilityIssues(parsed.data.data, gameData).length > 0) {
    throw new DuelSnapshotsImportError("incompatible_entities");
  }
  if (contextual) {
    const envelope = parsed.data as DuelSnapshotsTransferEnvelopeV1;
    return {
      format: "contextual-v1",
      version: envelope.version,
      exportedAt: envelope.exportedAt,
      context: envelope.context,
      data: envelope.data
    };
  }
  const envelope = parsed.data as DuelSnapshotsLegacyExportEnvelope;
  return {
    format: "legacy-v1",
    version: envelope.version,
    exportedAt: envelope.exportedAt,
    context: null,
    data: envelope.data
  };
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

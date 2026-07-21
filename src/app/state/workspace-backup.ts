import { z } from "zod";
import {
  HISCORES_LAST_PLAYER_STORAGE_VERSION,
  LastHiscoresPlayerStateSchema,
  type LastHiscoresPlayerState
} from "@/adapters/hiscores";
import { DataReliabilityError, parseJsonWithDuplicateKeyCheck } from "@/data/reliability";
import type { GameDataSnapshot, PriceSet } from "@/domain/shared";
import type { BrowserStorageAccess } from "../application-recovery";
import { createTransferArtifactFileName } from "../transfer-artifact-file-name";
import {
  DUEL_SNAPSHOTS_VERSION,
  DuelSnapshotsStateSchema,
  type DuelSnapshotsState
} from "./duel-snapshots";
import {
  HIDDEN_GEAR_TIERS_VERSION,
  HiddenGearTiersStateSchema,
  type HiddenGearTiersState
} from "./hidden-gear-tiers";
import { LEGACY_MIGRATION_DISMISSED_VERSION } from "./legacy-migration";
import { LOOT_PREFS_VERSION, LootPrefsStateSchema, type LootPrefsState } from "./loot-prefs";
import {
  LOOT_SETTINGS_VERSION,
  LootSettingsByMonsterSchema,
  type LootSettingsByMonsterState
} from "./loot-settings";
import {
  MANUAL_PRICE_OVERRIDES_VERSION,
  ManualPriceOverridesStateSchema,
  type ManualPriceOverridesState
} from "./manual-price-overrides";
import type { LocalStateHealthItemId } from "./local-state-health";
import { PLANNER_UI_VERSION, PlannerUiStateSchema, type PlannerUiState } from "./planner";
import {
  PRICE_HISTORY_VERSION,
  BrowserPriceHistoryStateSchema,
  type BrowserPriceHistoryState
} from "./price-history";
import { SELECTED_PRICE_SET_VERSION, SelectedPriceSetValueSchema } from "./selected-price-set";
import {
  SetupTransferContextV1Schema,
  createSetupTransferContext,
  type SetupTransferContextV1
} from "./setup-transfer-context";
import { REWRITE_SETUP_VERSION, SavedSetupSchema, type SavedSetupState } from "./ui-state";

export const WORKSPACE_BACKUP_KIND = "index-sim-workspace";
export const WORKSPACE_BACKUP_VERSION = 1;
export const WORKSPACE_BACKUP_IMPORT_MAX_BYTES = 10_000_000;
export const WORKSPACE_AREA_TRANSFER_VERSION = 1;

export const WORKSPACE_REQUIRED_AREA_IDS = [
  "rewrite-setup",
  "planner-ui",
  "loot-prefs",
  "loot-settings",
  "hidden-gear-tiers",
  "duel-snapshots",
  "price-history",
  "selected-price-set",
  "manual-price-overrides"
] as const;

export const WORKSPACE_TRANSFER_AREA_IDS = [
  ...WORKSPACE_REQUIRED_AREA_IDS,
  "hiscores-last-player"
] as const;

export type WorkspaceRequiredAreaId = (typeof WORKSPACE_REQUIRED_AREA_IDS)[number];
export type WorkspaceTransferAreaId = (typeof WORKSPACE_TRANSFER_AREA_IDS)[number];
export type WorkspaceAreaPolicy = "included" | "sensitive-opt-in" | "excluded";
export type WorkspaceRestoreMode = "replace" | "merge";

export interface WorkspaceAreaDataById {
  "rewrite-setup": SavedSetupState;
  "planner-ui": PlannerUiState;
  "loot-prefs": LootPrefsState;
  "loot-settings": LootSettingsByMonsterState;
  "hidden-gear-tiers": HiddenGearTiersState;
  "duel-snapshots": DuelSnapshotsState;
  "price-history": BrowserPriceHistoryState;
  "selected-price-set": PriceSet | null;
  "manual-price-overrides": ManualPriceOverridesState;
  "hiscores-last-player": LastHiscoresPlayerState;
}

export type WorkspaceLiveState = {
  [K in WorkspaceRequiredAreaId]: WorkspaceAreaDataById[K];
} & {
  "hiscores-last-player": LastHiscoresPlayerState | null;
};

interface WorkspaceAreaCodec<T> {
  readonly version: typeof WORKSPACE_AREA_TRANSFER_VERSION;
  parse(input: unknown): T;
}

interface WorkspaceTransferAreaRegistration<K extends WorkspaceTransferAreaId> {
  readonly id: K;
  readonly label: string;
  readonly policy: "included" | "sensitive-opt-in";
  readonly required: boolean;
  readonly localVersion: number;
  readonly restoreModes: readonly WorkspaceRestoreMode[];
  readonly codec: WorkspaceAreaCodec<WorkspaceAreaDataById[K]>;
}

interface WorkspaceExcludedAreaRegistration {
  readonly id: "legacy-migration-dismissed";
  readonly label: string;
  readonly policy: "excluded";
  readonly required: false;
  readonly localVersion: number;
  readonly restoreModes: readonly [];
}

type WorkspaceAreaRegistry = {
  [K in LocalStateHealthItemId]: K extends WorkspaceTransferAreaId
    ? WorkspaceTransferAreaRegistration<K>
    : WorkspaceExcludedAreaRegistration;
};

function schemaCodec<T>(schema: { parse(input: unknown): T }): WorkspaceAreaCodec<T> {
  return {
    version: WORKSPACE_AREA_TRANSFER_VERSION,
    parse: (input) => schema.parse(input)
  };
}

function duelSnapshotsCodec(): WorkspaceAreaCodec<DuelSnapshotsState> {
  return {
    version: WORKSPACE_AREA_TRANSFER_VERSION,
    parse: (input) => {
      const snapshots = isRecord(input) && Array.isArray(input.snapshots) ? input.snapshots : [];
      const ids = snapshots.flatMap((snapshot) =>
        isRecord(snapshot) && typeof snapshot.id === "string" ? [snapshot.id] : []
      );
      if (new Set(ids).size !== ids.length) throw new Error("duplicate duel snapshot identity");
      return DuelSnapshotsStateSchema.parse(input);
    }
  };
}

function priceHistoryCodec(): WorkspaceAreaCodec<BrowserPriceHistoryState> {
  return {
    version: WORKSPACE_AREA_TRANSFER_VERSION,
    parse: (input) => {
      const state = BrowserPriceHistoryStateSchema.parse(input);
      const keys = state.snapshots.map(
        (snapshot) => `${snapshot.capturedAt}::${snapshot.sourcePriceSetId}`
      );
      if (new Set(keys).size !== keys.length) throw new Error("duplicate price history identity");
      return state;
    }
  };
}

export const WORKSPACE_AREA_REGISTRY = {
  "rewrite-setup": {
    id: "rewrite-setup",
    label: "Rewrite setup",
    policy: "included",
    required: true,
    localVersion: REWRITE_SETUP_VERSION,
    restoreModes: ["replace"],
    codec: schemaCodec(SavedSetupSchema)
  },
  "planner-ui": {
    id: "planner-ui",
    label: "Planner UI state",
    policy: "included",
    required: true,
    localVersion: PLANNER_UI_VERSION,
    restoreModes: ["replace"],
    codec: schemaCodec(PlannerUiStateSchema)
  },
  "loot-prefs": {
    id: "loot-prefs",
    label: "Loot preferences",
    policy: "included",
    required: true,
    localVersion: LOOT_PREFS_VERSION,
    restoreModes: ["replace", "merge"],
    codec: schemaCodec(LootPrefsStateSchema)
  },
  "loot-settings": {
    id: "loot-settings",
    label: "Loot settings",
    policy: "included",
    required: true,
    localVersion: LOOT_SETTINGS_VERSION,
    restoreModes: ["replace", "merge"],
    codec: schemaCodec(LootSettingsByMonsterSchema)
  },
  "hidden-gear-tiers": {
    id: "hidden-gear-tiers",
    label: "Hidden gear tiers",
    policy: "included",
    required: true,
    localVersion: HIDDEN_GEAR_TIERS_VERSION,
    restoreModes: ["replace", "merge"],
    codec: schemaCodec(HiddenGearTiersStateSchema)
  },
  "duel-snapshots": {
    id: "duel-snapshots",
    label: "Saved setups",
    policy: "included",
    required: true,
    localVersion: DUEL_SNAPSHOTS_VERSION,
    restoreModes: ["replace", "merge"],
    codec: duelSnapshotsCodec()
  },
  "price-history": {
    id: "price-history",
    label: "Price history",
    policy: "included",
    required: true,
    localVersion: PRICE_HISTORY_VERSION,
    restoreModes: ["replace", "merge"],
    codec: priceHistoryCodec()
  },
  "selected-price-set": {
    id: "selected-price-set",
    label: "Selected PriceSet",
    policy: "included",
    required: true,
    localVersion: SELECTED_PRICE_SET_VERSION,
    restoreModes: ["replace"],
    codec: schemaCodec(SelectedPriceSetValueSchema)
  },
  "manual-price-overrides": {
    id: "manual-price-overrides",
    label: "Manual item prices",
    policy: "included",
    required: true,
    localVersion: MANUAL_PRICE_OVERRIDES_VERSION,
    restoreModes: ["replace", "merge"],
    codec: schemaCodec(ManualPriceOverridesStateSchema)
  },
  "hiscores-last-player": {
    id: "hiscores-last-player",
    label: "Hiscores last player",
    policy: "sensitive-opt-in",
    required: false,
    localVersion: HISCORES_LAST_PLAYER_STORAGE_VERSION,
    restoreModes: ["replace"],
    codec: schemaCodec(LastHiscoresPlayerStateSchema)
  },
  "legacy-migration-dismissed": {
    id: "legacy-migration-dismissed",
    label: "Legacy migration dismissed state",
    policy: "excluded",
    required: false,
    localVersion: LEGACY_MIGRATION_DISMISSED_VERSION,
    restoreModes: []
  }
} as const satisfies WorkspaceAreaRegistry;

export type WorkspaceAreaRecordV1 = {
  [K in WorkspaceTransferAreaId]: {
    id: K;
    version: typeof WORKSPACE_AREA_TRANSFER_VERSION;
    data: WorkspaceAreaDataById[K];
  };
}[WorkspaceTransferAreaId];

export interface WorkspaceBackupEnvelopeV1 {
  kind: typeof WORKSPACE_BACKUP_KIND;
  version: typeof WORKSPACE_BACKUP_VERSION;
  exportedAt: string;
  context: SetupTransferContextV1;
  areas: WorkspaceAreaRecordV1[];
}

export type ParsedWorkspaceArea =
  | {
      [K in WorkspaceTransferAreaId]: {
        id: K;
        version: typeof WORKSPACE_AREA_TRANSFER_VERSION;
        status: "ready";
        data: WorkspaceAreaDataById[K];
      };
    }[WorkspaceTransferAreaId]
  | {
      id: WorkspaceTransferAreaId;
      version: number;
      status: "unsupported-version";
      reason: "unsupported_area_version";
    }
  | {
      id: WorkspaceTransferAreaId;
      version: typeof WORKSPACE_AREA_TRANSFER_VERSION;
      status: "invalid-data";
      reason: "invalid_area_data";
    };

export interface ParsedWorkspaceBackupV1 {
  kind: typeof WORKSPACE_BACKUP_KIND;
  version: typeof WORKSPACE_BACKUP_VERSION;
  exportedAt: string;
  context: SetupTransferContextV1;
  byteSize: number;
  areas: ParsedWorkspaceArea[];
}

export type WorkspaceBackupErrorCode =
  | "body_too_large"
  | "duplicate_keys"
  | "invalid_json"
  | "unsafe_key"
  | "invalid_envelope"
  | "unsupported_kind"
  | "unsupported_version"
  | "duplicate_area"
  | "missing_area"
  | "unknown_area"
  | "invalid_export";

export class WorkspaceBackupError extends Error {
  constructor(readonly code: WorkspaceBackupErrorCode) {
    super(code);
    this.name = "WorkspaceBackupError";
  }
}

const WorkspaceAreaRecordOuterSchema = z
  .object({
    id: z.string().min(1).max(80),
    version: z.number().int().min(1).max(9_999),
    data: z.unknown()
  })
  .strict();

const WorkspaceBackupEnvelopeOuterSchema = z
  .object({
    kind: z.literal(WORKSPACE_BACKUP_KIND),
    version: z.literal(WORKSPACE_BACKUP_VERSION),
    exportedAt: z.iso.datetime({ offset: true }).max(64),
    context: SetupTransferContextV1Schema,
    areas: z.array(WorkspaceAreaRecordOuterSchema).min(1).max(32)
  })
  .strict();

const WORKSPACE_TRANSFER_AREA_ID_SET = new Set<string>(WORKSPACE_TRANSFER_AREA_IDS);
const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertNoUnsafeObjectKeys(value: unknown): void {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== "object") continue;
    for (const key of Object.keys(current)) {
      if (UNSAFE_OBJECT_KEYS.has(key)) throw new WorkspaceBackupError("unsafe_key");
      pending.push((current as Record<string, unknown>)[key]);
    }
  }
}

function isWorkspaceTransferAreaId(value: string): value is WorkspaceTransferAreaId {
  return WORKSPACE_TRANSFER_AREA_ID_SET.has(value);
}

function parseWorkspaceArea(
  record: z.infer<typeof WorkspaceAreaRecordOuterSchema>
): ParsedWorkspaceArea {
  const registration = WORKSPACE_AREA_REGISTRY[record.id as WorkspaceTransferAreaId];
  if (record.version !== registration.codec.version) {
    return {
      id: registration.id,
      version: record.version,
      status: "unsupported-version",
      reason: "unsupported_area_version"
    };
  }

  try {
    return {
      id: registration.id,
      version: WORKSPACE_AREA_TRANSFER_VERSION,
      status: "ready",
      data: registration.codec.parse(record.data)
    } as ParsedWorkspaceArea;
  } catch {
    return {
      id: registration.id,
      version: WORKSPACE_AREA_TRANSFER_VERSION,
      status: "invalid-data",
      reason: "invalid_area_data"
    };
  }
}

export function parseWorkspaceBackupText(
  text: string,
  maxBytes = WORKSPACE_BACKUP_IMPORT_MAX_BYTES
): ParsedWorkspaceBackupV1 {
  const byteSize = utf8ByteLength(text);
  if (byteSize > maxBytes) throw new WorkspaceBackupError("body_too_large");

  let value: unknown;
  try {
    value = parseJsonWithDuplicateKeyCheck(text, {
      maxBytes,
      source: "Workspace backup"
    });
  } catch (error) {
    if (error instanceof DataReliabilityError && error.code === "duplicate_keys") {
      throw new WorkspaceBackupError("duplicate_keys");
    }
    throw new WorkspaceBackupError("invalid_json");
  }

  assertNoUnsafeObjectKeys(value);
  if (isRecord(value) && Object.hasOwn(value, "kind") && value.kind !== WORKSPACE_BACKUP_KIND) {
    throw new WorkspaceBackupError("unsupported_kind");
  }
  if (
    isRecord(value) &&
    Object.hasOwn(value, "version") &&
    value.version !== WORKSPACE_BACKUP_VERSION
  ) {
    throw new WorkspaceBackupError("unsupported_version");
  }
  if (
    isRecord(value) &&
    Array.isArray(value.areas) &&
    value.areas.some((area) => !isRecord(area) || !Object.hasOwn(area, "data"))
  ) {
    throw new WorkspaceBackupError("invalid_envelope");
  }

  const outer = WorkspaceBackupEnvelopeOuterSchema.safeParse(value);
  if (!outer.success) throw new WorkspaceBackupError("invalid_envelope");

  const seen = new Set<WorkspaceTransferAreaId>();
  for (const area of outer.data.areas) {
    if (!isWorkspaceTransferAreaId(area.id)) throw new WorkspaceBackupError("unknown_area");
    if (seen.has(area.id)) throw new WorkspaceBackupError("duplicate_area");
    seen.add(area.id);
  }
  if (WORKSPACE_REQUIRED_AREA_IDS.some((id) => !seen.has(id))) {
    throw new WorkspaceBackupError("missing_area");
  }

  return {
    kind: outer.data.kind,
    version: outer.data.version,
    exportedAt: outer.data.exportedAt,
    context: outer.data.context,
    byteSize,
    areas: outer.data.areas.map(parseWorkspaceArea)
  };
}

function validateStorageAccess(access: BrowserStorageAccess): void {
  if (
    !access ||
    typeof access.storage?.getItem !== "function" ||
    typeof access.storage?.setItem !== "function" ||
    typeof access.storage?.removeItem !== "function" ||
    typeof access.storageUnavailable !== "boolean" ||
    typeof access.savedDataIgnoredForSession !== "boolean"
  ) {
    throw new WorkspaceBackupError("invalid_export");
  }
}

function canonicalizeWorkspaceValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeWorkspaceValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalizeWorkspaceValue(child)])
  );
}

export function createWorkspaceAreaFingerprint<K extends WorkspaceTransferAreaId>(
  id: K,
  value: WorkspaceLiveState[K]
): string {
  if (id === "hiscores-last-player" && value === null) return "null";
  const registration = WORKSPACE_AREA_REGISTRY[id];
  const parsed = registration.codec.parse(value as never);
  return JSON.stringify(canonicalizeWorkspaceValue(parsed));
}

export interface CreateWorkspaceBackupExportInput {
  readonly gameData: GameDataSnapshot;
  readonly liveState: WorkspaceLiveState;
  /** The App-selected access boundary is required even though export captures canonical live state. */
  readonly storageAccess: BrowserStorageAccess;
  readonly includeLastHiscoresPlayer?: boolean;
  readonly now?: Date;
}

export interface WorkspaceBackupExport {
  readonly envelope: WorkspaceBackupEnvelopeV1;
  readonly text: string;
  readonly byteSize: number;
  readonly fileName: string;
}

export function createWorkspaceBackupExport(
  input: CreateWorkspaceBackupExportInput
): WorkspaceBackupExport {
  validateStorageAccess(input.storageAccess);

  try {
    const now = input.now ?? new Date();
    const exportedAt = now.toISOString();
    const context = createSetupTransferContext(input.gameData);
    const areas: WorkspaceAreaRecordV1[] = WORKSPACE_REQUIRED_AREA_IDS.map((id) => {
      const registration = WORKSPACE_AREA_REGISTRY[id];
      return {
        id,
        version: registration.codec.version,
        data: registration.codec.parse(input.liveState[id])
      } as WorkspaceAreaRecordV1;
    });

    if (input.includeLastHiscoresPlayer && input.liveState["hiscores-last-player"] !== null) {
      const registration = WORKSPACE_AREA_REGISTRY["hiscores-last-player"];
      areas.push({
        id: registration.id,
        version: registration.codec.version,
        data: registration.codec.parse(input.liveState["hiscores-last-player"])
      });
    }

    const envelope: WorkspaceBackupEnvelopeV1 = {
      kind: WORKSPACE_BACKUP_KIND,
      version: WORKSPACE_BACKUP_VERSION,
      exportedAt,
      context,
      areas
    };
    assertNoUnsafeObjectKeys(envelope);
    const text = JSON.stringify(envelope, null, 2);
    const parsed = parseWorkspaceBackupText(text);
    if (parsed.areas.some((area) => area.status !== "ready")) {
      throw new WorkspaceBackupError("invalid_export");
    }
    return {
      envelope,
      text,
      byteSize: parsed.byteSize,
      fileName: createTransferArtifactFileName({
        artifact: "workspace-backup",
        revision: context.gameRevision,
        now
      })
    };
  } catch (error) {
    if (error instanceof WorkspaceBackupError) throw error;
    throw new WorkspaceBackupError("invalid_export");
  }
}

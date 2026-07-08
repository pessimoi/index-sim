import { z } from "zod";
import {
  loadPersisted,
  tryClearPersisted,
  type KeyValueStorage,
  type LoadPersistedResult,
  type VersionedStorageOptions
} from "@/adapters/storage";
import { HiscoresPlayerNameSchema } from "@/data/schemas";
import {
  HISCORES_LAST_PLAYER_STORAGE_KEY,
  HISCORES_LAST_PLAYER_STORAGE_VERSION
} from "@/adapters/hiscores";
import {
  DUEL_SNAPSHOTS_STORAGE_KEY,
  DUEL_SNAPSHOTS_VERSION,
  DuelSnapshotsStateSchema
} from "./duel-snapshots";
import {
  HIDDEN_GEAR_TIERS_STORAGE_KEY,
  HIDDEN_GEAR_TIERS_VERSION,
  HiddenGearTiersStateSchema
} from "./hidden-gear-tiers";
import {
  LEGACY_MIGRATION_DISMISSED_STORAGE_KEY,
  LEGACY_MIGRATION_DISMISSED_VERSION,
  LegacyMigrationDismissedStateSchema
} from "./legacy-migration";
import { LOOT_PREFS_STORAGE_KEY, LOOT_PREFS_VERSION, LootPrefsStateSchema } from "./loot-prefs";
import {
  LOOT_SETTINGS_STORAGE_KEY,
  LOOT_SETTINGS_VERSION,
  LootSettingsByMonsterSchema
} from "./loot-settings";
import { PLANNER_UI_STORAGE_KEY, PLANNER_UI_VERSION, PlannerUiStateSchema } from "./planner";
import {
  BrowserPriceHistoryStateSchema,
  PRICE_HISTORY_STORAGE_KEY,
  PRICE_HISTORY_VERSION
} from "./price-history";
import {
  SELECTED_PRICE_SET_STORAGE_KEY,
  SELECTED_PRICE_SET_VERSION,
  loadSelectedPriceSet
} from "./selected-price-set";
import {
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  SavedSetupSchema
} from "./ui-state";

export const LOCAL_STATE_HEALTH_REASON_VALUES = [
  "invalid_json",
  "invalid_envelope",
  "invalid_data",
  "body_too_large",
  "storage_unavailable",
  "save_failed",
  "clear_failed"
] as const;

export type LocalStateHealthReason = (typeof LOCAL_STATE_HEALTH_REASON_VALUES)[number];

export type LocalStateHealthStatus =
  | "missing"
  | "loaded"
  | "version-mismatch"
  | "invalid"
  | "unavailable"
  | "save-failed";

export type LocalStateHealthItemId =
  | "rewrite-setup"
  | "planner-ui"
  | "loot-prefs"
  | "loot-settings"
  | "hidden-gear-tiers"
  | "duel-snapshots"
  | "price-history"
  | "selected-price-set"
  | "hiscores-last-player"
  | "legacy-migration-dismissed";

export interface LocalStateHealthItem {
  id: LocalStateHealthItemId;
  label: string;
  storageKey: string;
  status: LocalStateHealthStatus;
  expectedVersion: number;
  foundVersion?: number;
  reason?: LocalStateHealthReason;
  loaded: boolean;
  defaultUsed: boolean;
  clearable: boolean;
  needsAttention: boolean;
}

export interface LocalStateHealthReport {
  generatedAt: string;
  itemCount: number;
  attentionCount: number;
  hasAttention: boolean;
  items: LocalStateHealthItem[];
}

export interface LocalStateStorageFailure {
  id: LocalStateHealthItemId;
  reason: "save_failed" | "clear_failed";
}

export interface LocalStateHealthReportOptions {
  storageUnavailable?: boolean;
  storageFailures?: readonly LocalStateStorageFailure[];
}

export interface LocalStateHealthExport {
  generatedAt: string;
  itemCount: number;
  attentionCount: number;
  items: Array<{
    id: LocalStateHealthItemId;
    label: string;
    storageKey: string;
    status: LocalStateHealthStatus;
    expectedVersion: number;
    foundVersion?: number;
    reason?: LocalStateHealthReason;
    loaded: boolean;
    defaultUsed: boolean;
    clearable: boolean;
    needsAttention: boolean;
  }>;
}

export interface LocalStateClearResult {
  clearedItems: LocalStateHealthItem[];
  clearedKeys: string[];
  failedItems: Array<{
    item: LocalStateHealthItem;
    reason: "clear_failed";
  }>;
  failedKeys: string[];
}

type HealthLoadResult =
  | LoadPersistedResult<unknown>
  | ReturnType<typeof loadSelectedPriceSet>;

interface LocalStateHealthDescriptor {
  id: LocalStateHealthItemId;
  label: string;
  key: string;
  version: number;
  load: (storage: KeyValueStorage) => HealthLoadResult;
}

function persistedDescriptor<T>(
  id: LocalStateHealthItemId,
  label: string,
  options: Omit<VersionedStorageOptions<T>, "storage">
): LocalStateHealthDescriptor {
  return {
    id,
    label,
    key: options.key,
    version: options.version,
    load: (storage) => loadPersisted({ ...options, storage })
  };
}

const LastHiscoresPlayerStateSchema = z
  .object({
    player: HiscoresPlayerNameSchema
  })
  .strict();

export const LOCAL_STATE_HEALTH_DESCRIPTORS: readonly LocalStateHealthDescriptor[] = [
  persistedDescriptor("rewrite-setup", "Rewrite setup", {
    key: REWRITE_SETUP_STORAGE_KEY,
    version: REWRITE_SETUP_VERSION,
    schema: SavedSetupSchema
  }),
  persistedDescriptor("planner-ui", "Planner UI state", {
    key: PLANNER_UI_STORAGE_KEY,
    version: PLANNER_UI_VERSION,
    schema: PlannerUiStateSchema
  }),
  persistedDescriptor("loot-prefs", "Loot preferences", {
    key: LOOT_PREFS_STORAGE_KEY,
    version: LOOT_PREFS_VERSION,
    schema: LootPrefsStateSchema
  }),
  persistedDescriptor("loot-settings", "Loot settings", {
    key: LOOT_SETTINGS_STORAGE_KEY,
    version: LOOT_SETTINGS_VERSION,
    schema: LootSettingsByMonsterSchema
  }),
  persistedDescriptor("hidden-gear-tiers", "Hidden gear tiers", {
    key: HIDDEN_GEAR_TIERS_STORAGE_KEY,
    version: HIDDEN_GEAR_TIERS_VERSION,
    schema: HiddenGearTiersStateSchema
  }),
  persistedDescriptor("duel-snapshots", "Duel snapshots", {
    key: DUEL_SNAPSHOTS_STORAGE_KEY,
    version: DUEL_SNAPSHOTS_VERSION,
    schema: DuelSnapshotsStateSchema
  }),
  persistedDescriptor("price-history", "Price history", {
    key: PRICE_HISTORY_STORAGE_KEY,
    version: PRICE_HISTORY_VERSION,
    schema: BrowserPriceHistoryStateSchema
  }),
  {
    id: "selected-price-set",
    label: "Selected PriceSet",
    key: SELECTED_PRICE_SET_STORAGE_KEY,
    version: SELECTED_PRICE_SET_VERSION,
    load: (storage) => loadSelectedPriceSet(storage)
  },
  persistedDescriptor("hiscores-last-player", "Hiscores last player", {
    key: HISCORES_LAST_PLAYER_STORAGE_KEY,
    version: HISCORES_LAST_PLAYER_STORAGE_VERSION,
    schema: LastHiscoresPlayerStateSchema
  }),
  persistedDescriptor("legacy-migration-dismissed", "Legacy migration dismissed state", {
    key: LEGACY_MIGRATION_DISMISSED_STORAGE_KEY,
    version: LEGACY_MIGRATION_DISMISSED_VERSION,
    schema: LegacyMigrationDismissedStateSchema
  })
];

const LOCAL_STATE_HEALTH_DESCRIPTOR_BY_ID = new Map(
  LOCAL_STATE_HEALTH_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor])
);

function normalizeReason(reason: string): LocalStateHealthReason {
  return LOCAL_STATE_HEALTH_REASON_VALUES.includes(reason as LocalStateHealthReason)
    ? (reason as LocalStateHealthReason)
    : "invalid_data";
}

function emptyClearResult(): LocalStateClearResult {
  return { clearedItems: [], clearedKeys: [], failedItems: [], failedKeys: [] };
}

function healthItemFromResult(
  descriptor: LocalStateHealthDescriptor,
  result: HealthLoadResult
): LocalStateHealthItem {
  if (result.status === "unavailable") {
    return {
      id: descriptor.id,
      label: descriptor.label,
      storageKey: descriptor.key,
      status: "unavailable",
      expectedVersion: descriptor.version,
      reason: "storage_unavailable",
      loaded: false,
      defaultUsed: true,
      clearable: false,
      needsAttention: true
    };
  }
  const rawPresent = result.status !== "missing";
  const needsAttention = result.status === "invalid" || result.status === "version-mismatch";
  return {
    id: descriptor.id,
    label: descriptor.label,
    storageKey: descriptor.key,
    status: result.status,
    expectedVersion: descriptor.version,
    foundVersion: result.status === "version-mismatch" ? result.foundVersion : undefined,
    reason: result.status === "invalid" ? normalizeReason(result.reason) : undefined,
    loaded: result.status === "loaded",
    defaultUsed: result.status !== "loaded",
    clearable: rawPresent,
    needsAttention
  };
}

function unavailableHealthItem(descriptor: LocalStateHealthDescriptor): LocalStateHealthItem {
  return {
    id: descriptor.id,
    label: descriptor.label,
    storageKey: descriptor.key,
    status: "unavailable",
    expectedVersion: descriptor.version,
    reason: "storage_unavailable",
    loaded: false,
    defaultUsed: true,
    clearable: false,
    needsAttention: true
  };
}

function healthItemWithStorageFailure(
  item: LocalStateHealthItem,
  failure: LocalStateStorageFailure
): LocalStateHealthItem {
  return {
    ...item,
    status: "save-failed",
    reason: failure.reason,
    loaded: false,
    defaultUsed: true,
    clearable: failure.reason === "clear_failed" ? item.clearable : false,
    needsAttention: true
  };
}

export function createLocalStateHealthReport(
  storage: KeyValueStorage,
  now: Date = new Date(),
  options: LocalStateHealthReportOptions = {}
): LocalStateHealthReport {
  const failuresById = new Map(
    (options.storageFailures ?? []).map((failure) => [failure.id, failure])
  );
  const items = LOCAL_STATE_HEALTH_DESCRIPTORS.map((descriptor) => {
    const item = options.storageUnavailable
      ? unavailableHealthItem(descriptor)
      : healthItemFromResult(descriptor, descriptor.load(storage));
    const failure = failuresById.get(descriptor.id);
    return failure ? healthItemWithStorageFailure(item, failure) : item;
  });
  const attentionCount = items.filter((item) => item.needsAttention).length;
  return {
    generatedAt: now.toISOString(),
    itemCount: items.length,
    attentionCount,
    hasAttention: attentionCount > 0,
    items
  };
}

export function createLocalStateHealthExport(
  report: LocalStateHealthReport
): LocalStateHealthExport {
  return {
    generatedAt: report.generatedAt,
    itemCount: report.itemCount,
    attentionCount: report.attentionCount,
    items: report.items.map((item) => ({
      id: item.id,
      label: item.label,
      storageKey: item.storageKey,
      status: item.status,
      expectedVersion: item.expectedVersion,
      foundVersion: item.foundVersion,
      reason: item.reason,
      loaded: item.loaded,
      defaultUsed: item.defaultUsed,
      clearable: item.clearable,
      needsAttention: item.needsAttention
    }))
  };
}

export function clearLocalStateItem(
  storage: KeyValueStorage,
  itemId: LocalStateHealthItemId
): LocalStateClearResult {
  const descriptor = LOCAL_STATE_HEALTH_DESCRIPTOR_BY_ID.get(itemId);
  if (!descriptor) return emptyClearResult();
  const item = healthItemFromResult(descriptor, descriptor.load(storage));
  if (!item.clearable) return emptyClearResult();
  const result = tryClearPersisted({ key: descriptor.key, storage });
  if (result.status === "failed") {
    return {
      clearedItems: [],
      clearedKeys: [],
      failedItems: [{ item, reason: result.reason }],
      failedKeys: [descriptor.key]
    };
  }
  return { clearedItems: [item], clearedKeys: [descriptor.key], failedItems: [], failedKeys: [] };
}

export function clearInvalidLocalState(
  storage: KeyValueStorage,
  report: LocalStateHealthReport = createLocalStateHealthReport(storage)
): LocalStateClearResult {
  const clearedItems: LocalStateHealthItem[] = [];
  const clearedKeys: string[] = [];
  const failedItems: LocalStateClearResult["failedItems"] = [];
  const failedKeys: string[] = [];
  for (const item of report.items) {
    if (!item.needsAttention || !item.clearable) continue;
    const result = clearLocalStateItem(storage, item.id);
    clearedItems.push(...result.clearedItems);
    clearedKeys.push(...result.clearedKeys);
    failedItems.push(...result.failedItems);
    failedKeys.push(...result.failedKeys);
  }
  return { clearedItems, clearedKeys, failedItems, failedKeys };
}

export function localStateHealthNeedsAttention(item: LocalStateHealthItem): boolean {
  return item.needsAttention;
}

import type { KeyValueStorage } from "@/adapters/storage";
import type { GameDataSnapshot, PriceSet } from "@/domain/shared";
import type { DenseCompareSortState } from "../dense-compare";
import type { DuelSnapshotsState } from "../duel-snapshots";
import type { HiddenGearTiersState } from "../hidden-gear-tiers";
import type { LootPrefsState } from "../loot-prefs";
import type {
  CannonByMonsterState,
  CombatSetupFormState,
  CustomSetupsByMonsterState
} from "../ui-state";

export const LEGACY_INPUT_STORAGE_KEY = "sim_input_v3";

export const LEGACY_STORAGE_KEYS = [
  LEGACY_INPUT_STORAGE_KEY,
  "sim_planner_v1",
  "sim_loot_prefs_v1",
  "sim_hidden_tiers_v1",
  "sim_compare_sort_v1",
  "sim_irrelevant_v1",
  "sim_loot_comp_open",
  "sim_prices_v1",
  "sim_alch_v1",
  "sim_scraped_at_v1",
  "sim_scraped_keys_v1",
  "sim_price_history_v1",
  "sim_price_history_sanitized_v1",
  "sim_price_history_sanitized_v2",
  "sim_price_history_sanitized_v3",
  "sim_price_history_sanitized_v4",
  "sim_hiscore_player"
] as const;

export type LegacyStorageKey = (typeof LEGACY_STORAGE_KEYS)[number];

export type LegacyStorageKeyMigrationDisposition =
  "migrate" | "review-only" | "intentional-reset" | "legacy-only";

export interface LegacyStorageKeyPolicy {
  key: LegacyStorageKey;
  label: string;
  disposition: LegacyStorageKeyMigrationDisposition;
  handling: string;
  reason: string;
}

export interface LegacyStorageKeyReviewItem extends LegacyStorageKeyPolicy {
  found: boolean;
  clearDeletes: boolean;
}

export interface LegacyMigrationSkippedField {
  field: string;
  reason: string;
  disposition?: LegacyStorageKeyMigrationDisposition;
  handling?: string;
}

export interface LegacySetupMigrationReport {
  foundKeys: LegacyStorageKey[];
  keyReview: LegacyStorageKeyReviewItem[];
  importedFields: string[];
  skippedFields: LegacyMigrationSkippedField[];
  warnings: string[];
  setup: CombatSetupFormState | null;
  hiscoresPlayer: string | null;
  priceSet: PriceSet | null;
  lootPrefs: LootPrefsState | null;
  hiddenGearTiers: HiddenGearTiersState | null;
  denseCompareSort: DenseCompareSortState | null;
  irrelevantMonsterIds: string[] | null;
  customSetupsByMonster: CustomSetupsByMonsterState | null;
  cannonByMonster: CannonByMonsterState | null;
  duelSnapshots: DuelSnapshotsState | null;
}

export interface LegacySetupMigrationOptions {
  storage: KeyValueStorage;
  gameData: GameDataSnapshot;
  currentCustomSetupsByMonster?: CustomSetupsByMonsterState;
  currentCannonByMonster?: CannonByMonsterState;
  currentDuelSnapshots?: DuelSnapshotsState;
  maxInputBytes?: number;
  maxPriceBytes?: number;
  maxHiscoresBytes?: number;
  maxPlannerBytes?: number;
  maxLootPrefsBytes?: number;
  maxUiStateBytes?: number;
}

export const DEFAULT_MAX_LEGACY_INPUT_BYTES = 250_000;
export const DEFAULT_MAX_LEGACY_PRICE_BYTES = 1_000_000;
export const DEFAULT_MAX_LEGACY_HISCORES_BYTES = 200;
export const DEFAULT_MAX_LEGACY_PLANNER_BYTES = 250_000;
export const DEFAULT_MAX_LEGACY_LOOT_PREFS_BYTES = 100_000;
export const DEFAULT_MAX_LEGACY_UI_STATE_BYTES = 50_000;
export const LEGACY_PRICE_HISTORY_KEYS = [
  "sim_price_history_v1",
  "sim_price_history_sanitized_v1",
  "sim_price_history_sanitized_v2",
  "sim_price_history_sanitized_v3",
  "sim_price_history_sanitized_v4"
] as const satisfies readonly LegacyStorageKey[];
export const IMPORT_SUPPORTED_LEGACY_KEYS = new Set<LegacyStorageKey>([
  LEGACY_INPUT_STORAGE_KEY,
  "sim_loot_prefs_v1",
  "sim_hidden_tiers_v1",
  "sim_compare_sort_v1",
  "sim_irrelevant_v1",
  "sim_hiscore_player",
  "sim_prices_v1",
  "sim_alch_v1",
  "sim_scraped_at_v1",
  "sim_price_history_v1"
]);

export const LEGACY_STORAGE_KEY_POLICIES = [
  {
    key: LEGACY_INPUT_STORAGE_KEY,
    label: "Saved setup",
    disposition: "migrate",
    handling: "Compatible setup fields can be imported into rewrite setup state.",
    reason: "The rewrite has versioned setup state and Zod validation for this subset."
  },
  {
    key: "sim_planner_v1",
    label: "Planner state",
    disposition: "review-only",
    handling:
      "Detected only; no planner state is imported into rewrite Planner state in this flow.",
    reason:
      "Legacy planner parity and state migration policy are still open, so the key is kept unless the user confirms Clear."
  },
  {
    key: "sim_loot_prefs_v1",
    label: "Loot preferences",
    disposition: "migrate",
    handling:
      "Compatible legacy drop-name preferences can be imported into unambiguous rewrite loot row ids.",
    reason:
      "Legacy stored a flat drop-name map; the rewrite imports only names that resolve to current validated monster row ids."
  },
  {
    key: "sim_hidden_tiers_v1",
    label: "Hidden gear tiers",
    disposition: "migrate",
    handling: "Compatible tier flags can be imported into rewrite gear-menu preferences.",
    reason: "The rewrite has the same tier ids and versioned hidden-tier preference storage."
  },
  {
    key: "sim_compare_sort_v1",
    label: "Compare sort",
    disposition: "migrate",
    handling: "Compatible sort keys can be imported into rewrite dense compare state.",
    reason: "The rewrite owns a bounded dense-compare sort schema with accepted key mapping."
  },
  {
    key: "sim_irrelevant_v1",
    label: "Compare relevance",
    disposition: "migrate",
    handling: "Known irrelevant monster ids can be imported into rewrite dense compare state.",
    reason: "The rewrite validates the id list against bundled monster data before accepting it."
  },
  {
    key: "sim_loot_comp_open",
    label: "Loot compare drawer",
    disposition: "legacy-only",
    handling: "Kept only for the archived legacy runtime unless cleared.",
    reason: "This is legacy UI presentation state with no rewrite import target."
  },
  {
    key: "sim_prices_v1",
    label: "Current prices",
    disposition: "migrate",
    handling: "Can be imported with the matching legacy alch map as an explicit PriceSet.",
    reason: "The rewrite validates imported price/alch maps before accepting them."
  },
  {
    key: "sim_alch_v1",
    label: "Current alch values",
    disposition: "migrate",
    handling: "Can be imported with the matching legacy price map as an explicit PriceSet.",
    reason: "The rewrite validates imported price/alch maps before accepting them."
  },
  {
    key: "sim_scraped_at_v1",
    label: "Price timestamp",
    disposition: "migrate",
    handling: "Used only as the created-at timestamp for a valid imported PriceSet.",
    reason: "Timestamp metadata is bounded and does not introduce a new provider decision."
  },
  {
    key: "sim_scraped_keys_v1",
    label: "Scraped item keys",
    disposition: "intentional-reset",
    handling: "Not imported; clear removes it after confirmation.",
    reason: "The rewrite does not persist legacy scrape-key metadata or source slugs."
  },
  {
    key: "sim_price_history_v1",
    label: "Legacy price history",
    disposition: "review-only",
    handling: "Detected only; full legacy price history is not imported.",
    reason: "Full history migration needs an accepted policy beyond current price/alch import."
  },
  {
    key: "sim_price_history_sanitized_v1",
    label: "Sanitized price history v1",
    disposition: "review-only",
    handling: "Detected only; full legacy price history is not imported.",
    reason: "Full history migration needs an accepted policy beyond current price/alch import."
  },
  {
    key: "sim_price_history_sanitized_v2",
    label: "Sanitized price history v2",
    disposition: "review-only",
    handling: "Detected only; full legacy price history is not imported.",
    reason: "Full history migration needs an accepted policy beyond current price/alch import."
  },
  {
    key: "sim_price_history_sanitized_v3",
    label: "Sanitized price history v3",
    disposition: "review-only",
    handling: "Detected only; full legacy price history is not imported.",
    reason: "Full history migration needs an accepted policy beyond current price/alch import."
  },
  {
    key: "sim_price_history_sanitized_v4",
    label: "Sanitized price history v4",
    disposition: "review-only",
    handling: "Detected only; full legacy price history is not imported.",
    reason: "Full history migration needs an accepted policy beyond current price/alch import."
  },
  {
    key: "sim_hiscore_player",
    label: "Hiscores player",
    disposition: "migrate",
    handling: "Can be imported into the rewrite last-player field after validation.",
    reason: "The rewrite has bounded player-name validation and versioned last-player storage."
  }
] as const satisfies readonly LegacyStorageKeyPolicy[];

export function detectLegacyStorageKeys(storage: KeyValueStorage): LegacyStorageKey[] {
  return LEGACY_STORAGE_KEYS.filter((key) => storage.getItem(key) !== null);
}

export function clearKnownLegacyStorageKeys(storage: KeyValueStorage): LegacyStorageKey[] {
  const foundKeys = detectLegacyStorageKeys(storage);
  for (const key of foundKeys) {
    storage.removeItem(key);
  }
  return foundKeys;
}

export function createLegacyStorageKeyReview(
  foundKeys: readonly LegacyStorageKey[]
): LegacyStorageKeyReviewItem[] {
  const found = new Set(foundKeys);
  return LEGACY_STORAGE_KEY_POLICIES.map((policy) => ({
    ...policy,
    found: found.has(policy.key),
    clearDeletes: found.has(policy.key)
  }));
}

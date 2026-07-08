import { weaponStances } from "@/domain/combat";
import {
  EQUIPMENT_SLOTS,
  type CombatStyle,
  type DropDefinition,
  type EntityId,
  type GameDataSnapshot,
  type MonsterDefinition,
  type PriceSet
} from "@/domain/shared";
import { FOOD, lootPreferenceKey, lootPreferenceKeysForMonster } from "@/domain/trip";
import { HiscoresPlayerNameSchema, createPriceSetFromLegacyRecords } from "@/data/schemas";
import {
  CombatSetupFormSchema,
  DEFAULT_FORM_STATE,
  normalizeFormState,
  setCombatStyleDefaults,
  type CombatSetupFormState
} from "@/app/state/ui-state";
import {
  DenseCompareSortStateSchema,
  type DenseCompareSortKey,
  type DenseCompareSortState
} from "@/app/state/dense-compare";
import {
  GEAR_TIER_DEFS,
  HiddenGearTiersStateSchema,
  type GearTierId,
  type HiddenGearTiersState
} from "@/app/state/hidden-gear-tiers";
import {
  LootActionSchema,
  LootPrefsStateSchema,
  type LootPrefsState
} from "@/app/state/loot-prefs";
import type { KeyValueStorage } from "./index";

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
}

export interface LegacySetupMigrationOptions {
  storage: KeyValueStorage;
  gameData: GameDataSnapshot;
  maxInputBytes?: number;
  maxPriceBytes?: number;
  maxHiscoresBytes?: number;
  maxPlannerBytes?: number;
  maxLootPrefsBytes?: number;
  maxUiStateBytes?: number;
}

const DEFAULT_MAX_LEGACY_INPUT_BYTES = 250_000;
const DEFAULT_MAX_LEGACY_PRICE_BYTES = 1_000_000;
const DEFAULT_MAX_LEGACY_HISCORES_BYTES = 200;
const DEFAULT_MAX_LEGACY_PLANNER_BYTES = 250_000;
const DEFAULT_MAX_LEGACY_LOOT_PREFS_BYTES = 100_000;
const DEFAULT_MAX_LEGACY_UI_STATE_BYTES = 50_000;
const MAX_LEGACY_LOOT_PREF_KEYS = 500;
const MAX_LEGACY_IRRELEVANT_MONSTER_IDS = 500;
const MAX_LEGACY_NESTED_REVIEW_KEYS = 500;
const COMBAT_STYLES = ["melee", "ranged", "magic"] as const satisfies readonly CombatStyle[];
const PROTECT_PRAYERS = ["none", "melee", "missiles", "magic"] as const;
const PRAYER_MODES = ["potions", "altar", "none"] as const;
const LEGACY_PRICE_HISTORY_KEYS = [
  "sim_price_history_v1",
  "sim_price_history_sanitized_v1",
  "sim_price_history_sanitized_v2",
  "sim_price_history_sanitized_v3",
  "sim_price_history_sanitized_v4"
] as const satisfies readonly LegacyStorageKey[];
const IMPORT_SUPPORTED_LEGACY_KEYS = new Set<LegacyStorageKey>([
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

type MutableFormState = CombatSetupFormState;
type LegacyRecord = Record<string, unknown>;
type TripField = keyof CombatSetupFormState["trip"];
type LegacyJsonField = LegacyStorageKey | string;
interface LootPreferenceCandidate {
  monsterId: EntityId;
  rowId: string;
  ambiguous: boolean;
}

const HIDDEN_GEAR_TIER_IDS = new Set<GearTierId>(GEAR_TIER_DEFS.map((tier) => tier.id));
const LEGACY_COMPARE_SORT_KEY_MAP: Partial<Record<string, DenseCompareSortKey>> = {
  name: "monsterName",
  monsterName: "monsterName",
  hitChance: "hitChance",
  maxHit: "maxHit",
  dps: "dps",
  ttkSec: "ttkSec",
  killsPerHour: "killsPerHour",
  effectiveXpPerHour: "xpPerHour",
  xpPerHour: "xpPerHour",
  gpPerKill: "gpPerKill",
  gpPerHour: "gpPerHour",
  effectiveNetGpPerHour: "netGpPerHour",
  netGpPerHour: "netGpPerHour"
};

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

export function inspectLegacySetupMigration(
  options: LegacySetupMigrationOptions
): LegacySetupMigrationReport {
  const foundKeys = detectLegacyStorageKeys(options.storage);
  const report = createReport(foundKeys);

  const unsupportedKeys = foundKeys.filter((key) => !IMPORT_SUPPORTED_LEGACY_KEYS.has(key));
  if (unsupportedKeys.length > 0) {
    report.warnings.push(
      `Detected legacy keys outside this setup-import foundation: ${unsupportedKeys.join(", ")}`
    );
  }

  inspectLegacySetupInput(options, report);
  inspectLegacyHiscoresPlayer(
    options.storage,
    report,
    options.maxHiscoresBytes ?? DEFAULT_MAX_LEGACY_HISCORES_BYTES
  );
  inspectLegacyLootPrefs(
    options,
    report,
    options.maxLootPrefsBytes ?? DEFAULT_MAX_LEGACY_LOOT_PREFS_BYTES
  );
  inspectLegacyHiddenGearTiers(
    options.storage,
    report,
    options.maxUiStateBytes ?? DEFAULT_MAX_LEGACY_UI_STATE_BYTES
  );
  inspectLegacyCompareSort(
    options.storage,
    report,
    options.maxUiStateBytes ?? DEFAULT_MAX_LEGACY_UI_STATE_BYTES
  );
  inspectLegacyIrrelevantMonsters(
    options,
    report,
    options.maxUiStateBytes ?? DEFAULT_MAX_LEGACY_UI_STATE_BYTES
  );
  inspectLegacyPlannerBoundary(
    options.storage,
    report,
    options.maxPlannerBytes ?? DEFAULT_MAX_LEGACY_PLANNER_BYTES
  );
  inspectLegacyPriceSet(options, report);
  inspectLegacyPriceHistory(options.storage, report);

  return report;
}

function inspectLegacySetupInput(
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport
): void {
  const rawInput = options.storage.getItem(LEGACY_INPUT_STORAGE_KEY);
  if (rawInput == null) return;
  if (byteLength(rawInput) > (options.maxInputBytes ?? DEFAULT_MAX_LEGACY_INPUT_BYTES)) {
    skip(report, LEGACY_INPUT_STORAGE_KEY, "legacy input exceeds safe size limit");
    warn(report, "Legacy setup input was ignored because it exceeds the safe size limit.");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawInput);
  } catch {
    skip(report, LEGACY_INPUT_STORAGE_KEY, "invalid JSON");
    warn(report, "Legacy setup input could not be parsed as JSON.");
    return;
  }

  if (!isRecord(parsed)) {
    skip(report, LEGACY_INPUT_STORAGE_KEY, "expected an object");
    warn(report, "Legacy setup input was ignored because it is not an object.");
    return;
  }

  inspectLegacySetupReviewOnlyAreas(parsed, options.gameData, report);

  const draft = cloneDefaultFormState();
  mapLegacyInput(parsed, draft, options.gameData, report);

  if (report.importedFields.length === 0) {
    warn(report, "Legacy setup input did not contain any safely importable fields.");
    return;
  }

  const validated = CombatSetupFormSchema.safeParse(draft);
  if (!validated.success) {
    skip(report, LEGACY_INPUT_STORAGE_KEY, "mapped setup failed rewrite form validation");
    warn(report, "Mapped legacy setup failed final rewrite form validation.");
    report.setup = null;
    return;
  }

  report.setup = normalizeFormState(validated.data);
}

function inspectLegacySetupReviewOnlyAreas(
  legacy: LegacyRecord,
  gameData: GameDataSnapshot,
  report: LegacySetupMigrationReport
): void {
  inspectNestedReviewOnlyMap({
    value: legacy.monsterSetups,
    field: "sim_input_v3.monsterSetups",
    label: "Legacy custom setup snapshots",
    singular: "custom setup snapshot",
    plural: "custom setup snapshots",
    handling:
      "Detected only; legacy custom setup snapshots are not imported into rewrite custom setups.",
    invalidShapeReason:
      "legacy custom setup snapshots were detected but not imported because the shape is not an object map",
    detectedReason:
      "legacy custom setup snapshots were detected but not imported because no safe import policy is accepted",
    warning: "Legacy custom setup snapshots were detected but not imported.",
    gameData,
    report
  });
  inspectNestedReviewOnlyMap({
    value: legacy.cannonByMonster,
    field: "sim_input_v3.cannonByMonster",
    label: "Legacy cannon map",
    singular: "cannon entry",
    plural: "cannon entries",
    handling:
      "Detected only; legacy cannon map settings are not imported into rewrite cannon state.",
    invalidShapeReason:
      "legacy cannon map was detected but not imported because the shape is not an object map",
    detectedReason:
      "legacy cannon map was detected but not imported because no safe import policy is accepted",
    warning: "Legacy cannon map was detected but not imported.",
    gameData,
    report
  });
}

function inspectNestedReviewOnlyMap(options: {
  value: unknown;
  field: string;
  label: string;
  singular: string;
  plural: string;
  handling: string;
  invalidShapeReason: string;
  detectedReason: string;
  warning: string;
  gameData: GameDataSnapshot;
  report: LegacySetupMigrationReport;
}): void {
  if (options.value === undefined) return;
  if (!isRecord(options.value)) {
    skip(options.report, options.field, options.invalidShapeReason, {
      disposition: "review-only",
      handling: options.handling
    });
    warn(options.report, `${options.label} was detected but its shape is not importable.`);
    return;
  }

  const monsterIds = Object.keys(options.value);
  if (monsterIds.length === 0) return;
  if (monsterIds.length > MAX_LEGACY_NESTED_REVIEW_KEYS) {
    skip(
      options.report,
      options.field,
      `${options.detectedReason}; map exceeds safe review key limit`,
      { disposition: "review-only", handling: options.handling }
    );
    warn(options.report, `${options.label} was detected but exceeds the safe review key limit.`);
    return;
  }

  const knownMonsterIds = new Set(Object.keys(options.gameData.monsters));
  const unknownMonsterCount = monsterIds.filter((monsterId) => !knownMonsterIds.has(monsterId))
    .length;
  const entryCountText = `${monsterIds.length} ${
    monsterIds.length === 1 ? options.singular : options.plural
  }`;
  const unknownText =
    unknownMonsterCount > 0
      ? `; ${unknownMonsterCount} ${
          unknownMonsterCount === 1 ? "entry has" : "entries have"
        } unknown current monster ids`
      : "";

  skip(
    options.report,
    options.field,
    `${options.detectedReason} (${entryCountText}${unknownText})`,
    {
      disposition: "review-only",
      handling: options.handling
    }
  );
  warn(options.report, options.warning);
}

function inspectLegacyHiscoresPlayer(
  storage: KeyValueStorage,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_HISCORES_BYTES
): void {
  const rawPlayer = storage.getItem("sim_hiscore_player");
  if (rawPlayer == null) return;

  if (byteLength(rawPlayer) > maxBytes) {
    skip(report, "hiscores.player", "legacy hiscores player exceeds safe size limit");
    warn(report, "Legacy hiscores player was ignored because it exceeds the safe size limit.");
    return;
  }

  const parsed = HiscoresPlayerNameSchema.safeParse(rawPlayer);
  if (!parsed.success) {
    skip(report, "hiscores.player", "invalid hiscores player name");
    warn(report, "Legacy hiscores player was ignored because it failed validation.");
    return;
  }

  report.hiscoresPlayer = parsed.data;
  importField(report, "hiscores.player");
}

function inspectLegacyLootPrefs(
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_LOOT_PREFS_BYTES
): void {
  const rawValue = options.storage.getItem("sim_loot_prefs_v1");
  if (rawValue == null) return;

  const parsed = parseLegacyJsonStorageValue(
    rawValue,
    "sim_loot_prefs_v1",
    maxBytes,
    report,
    "Legacy loot preferences"
  );
  if (!parsed.ok) return;
  if (!isRecord(parsed.value)) {
    skip(report, "lootPrefs", "expected an object");
    warn(report, "Legacy loot preferences were ignored because the value is not an object.");
    return;
  }

  const entries = Object.entries(parsed.value);
  if (entries.length > MAX_LEGACY_LOOT_PREF_KEYS) {
    skip(report, "lootPrefs", "legacy loot preference map exceeds safe key limit");
    warn(report, "Legacy loot preferences were ignored because they contain too many keys.");
    return;
  }

  const candidatesByName = createLootPreferenceCandidatesByName(options.gameData);
  const nextPrefs: LootPrefsState = {};
  let importedRows = 0;

  for (const [rawDropName, rawAction] of entries) {
    const dropName = rawDropName.trim();
    const fieldName = dropName ? `lootPrefs.${dropName}` : "lootPrefs";
    if (!dropName || dropName.length > 180) {
      skip(report, "lootPrefs", "expected a non-empty drop name up to 180 characters");
      continue;
    }

    const action = LootActionSchema.safeParse(rawAction);
    if (!action.success) {
      skip(report, fieldName, "unknown loot action");
      continue;
    }

    const candidates = candidatesByName.get(dropName);
    if (!candidates || candidates.length === 0) {
      skip(report, fieldName, "unknown loot preference row name");
      continue;
    }

    let importedForName = 0;
    for (const candidate of candidates) {
      if (candidate.ambiguous) {
        skip(
          report,
          `lootPrefs.${candidate.monsterId}.${dropName}`,
          "ambiguous legacy drop name for monster"
        );
        continue;
      }
      nextPrefs[candidate.monsterId] = {
        ...(nextPrefs[candidate.monsterId] ?? {}),
        [candidate.rowId]: action.data
      };
      importedRows += 1;
      importedForName += 1;
    }
    if (importedForName === 0) {
      warn(report, `Legacy loot preference '${dropName}' did not resolve to an importable row.`);
    }
  }

  if (importedRows === 0) {
    if (entries.length > 0) {
      warn(report, "Legacy loot preferences did not contain any safely importable rows.");
    }
    return;
  }

  const validated = LootPrefsStateSchema.safeParse(nextPrefs);
  if (!validated.success) {
    skip(report, "lootPrefs", "legacy loot preferences failed rewrite validation");
    warn(report, "Legacy loot preferences were ignored because they failed rewrite validation.");
    return;
  }

  report.lootPrefs = validated.data;
  importField(report, "lootPrefs");
}

function inspectLegacyHiddenGearTiers(
  storage: KeyValueStorage,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_UI_STATE_BYTES
): void {
  const rawValue = storage.getItem("sim_hidden_tiers_v1");
  if (rawValue == null) return;

  const parsed = parseLegacyJsonStorageValue(
    rawValue,
    "sim_hidden_tiers_v1",
    maxBytes,
    report,
    "Legacy hidden gear tiers"
  );
  if (!parsed.ok) return;
  if (!isRecord(parsed.value)) {
    skip(report, "hiddenGearTiers", "expected an object");
    warn(report, "Legacy hidden gear tiers were ignored because the value is not an object.");
    return;
  }

  const flags: Partial<Record<GearTierId, boolean>> = {};
  let knownFlagCount = 0;
  for (const [tierId, value] of Object.entries(parsed.value)) {
    if (!HIDDEN_GEAR_TIER_IDS.has(tierId as GearTierId)) {
      skip(report, `hiddenGearTiers.${tierId}`, "unknown hidden tier id");
      continue;
    }
    if (typeof value !== "boolean") {
      skip(report, `hiddenGearTiers.${tierId}`, "expected a boolean");
      continue;
    }
    flags[tierId as GearTierId] = value;
    knownFlagCount += 1;
  }

  if (knownFlagCount === 0) {
    warn(report, "Legacy hidden gear tiers did not contain any known tier flags.");
    return;
  }

  const validated = HiddenGearTiersStateSchema.safeParse(flags);
  if (!validated.success) {
    skip(report, "hiddenGearTiers", "legacy hidden tiers failed rewrite validation");
    warn(report, "Legacy hidden gear tiers were ignored because they failed rewrite validation.");
    return;
  }

  report.hiddenGearTiers = validated.data;
  importField(report, "hiddenGearTiers");
}

function inspectLegacyCompareSort(
  storage: KeyValueStorage,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_UI_STATE_BYTES
): void {
  const rawValue = storage.getItem("sim_compare_sort_v1");
  if (rawValue == null) return;

  const parsed = parseLegacyJsonStorageValue(
    rawValue,
    "sim_compare_sort_v1",
    maxBytes,
    report,
    "Legacy compare sort"
  );
  if (!parsed.ok) return;
  if (!isRecord(parsed.value)) {
    skip(report, "compare.sort", "expected an object");
    warn(report, "Legacy compare sort was ignored because the value is not an object.");
    return;
  }

  const legacyKey = readString(parsed.value, ["key"]);
  const mappedKey = legacyKey ? LEGACY_COMPARE_SORT_KEY_MAP[legacyKey] : null;
  if (!legacyKey || !mappedKey) {
    skip(report, "compare.sort", "unknown compare sort key");
    warn(report, "Legacy compare sort was ignored because its sort key is not supported.");
    return;
  }

  const direction = legacyCompareSortDirection(legacyKey, parsed.value);
  if (!direction) {
    skip(report, "compare.sort", "unknown compare sort direction");
    warn(report, "Legacy compare sort was ignored because its direction is not supported.");
    return;
  }

  const validated = DenseCompareSortStateSchema.safeParse({ key: mappedKey, direction });
  if (!validated.success) {
    skip(report, "compare.sort", "legacy compare sort failed rewrite validation");
    warn(report, "Legacy compare sort was ignored because it failed rewrite validation.");
    return;
  }

  report.denseCompareSort = validated.data;
  importField(report, "compare.sort");
}

function inspectLegacyIrrelevantMonsters(
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_UI_STATE_BYTES
): void {
  const rawValue = options.storage.getItem("sim_irrelevant_v1");
  if (rawValue == null) return;

  const parsed = parseLegacyJsonStorageValue(
    rawValue,
    "sim_irrelevant_v1",
    maxBytes,
    report,
    "Legacy compare relevance"
  );
  if (!parsed.ok) return;
  if (!Array.isArray(parsed.value)) {
    skip(report, "compare.irrelevantMonsterIds", "expected an array");
    warn(report, "Legacy compare relevance was ignored because the value is not an array.");
    return;
  }
  if (parsed.value.length > MAX_LEGACY_IRRELEVANT_MONSTER_IDS) {
    skip(
      report,
      "compare.irrelevantMonsterIds",
      "legacy irrelevant monster list exceeds safe size limit"
    );
    warn(report, "Legacy compare relevance was ignored because it has too many monster ids.");
    return;
  }

  const validMonsterIds = new Set(Object.keys(options.gameData.monsters));
  const nextIds: string[] = [];
  const seen = new Set<string>();
  let acceptedInputCount = 0;
  for (const value of parsed.value) {
    if (typeof value !== "string" || !value.trim()) {
      skip(report, "compare.irrelevantMonsterIds", "expected monster id strings");
      continue;
    }
    const monsterId = value.trim();
    if (!validMonsterIds.has(monsterId)) {
      skip(report, `compare.irrelevantMonsterIds.${monsterId}`, "unknown monster id");
      continue;
    }
    acceptedInputCount += 1;
    if (!seen.has(monsterId)) {
      seen.add(monsterId);
      nextIds.push(monsterId);
    }
  }

  if (parsed.value.length > 0 && acceptedInputCount === 0) {
    warn(report, "Legacy compare relevance did not contain any known monster ids.");
    return;
  }

  report.irrelevantMonsterIds = nextIds;
  importField(report, "compare.irrelevantMonsterIds");
}

function inspectLegacyPlannerBoundary(
  storage: KeyValueStorage,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_PLANNER_BYTES
): void {
  const rawPlanner = storage.getItem("sim_planner_v1");
  if (rawPlanner == null) return;

  if (byteLength(rawPlanner) > maxBytes) {
    skip(
      report,
      "planner.state",
      "legacy planner state was detected but not imported because it exceeds safe review size limit"
    );
    warn(
      report,
      "Legacy planner state was detected but not imported; it exceeds the safe review size limit and will be kept unless you clear known legacy keys."
    );
    return;
  }

  skip(report, "planner.state", "legacy planner state was detected but not imported");
  warn(
    report,
    "Legacy planner state was detected but not imported; it will be kept unless you clear known legacy keys."
  );
}

function inspectLegacyPriceSet(
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport
): void {
  const rawPrices = options.storage.getItem("sim_prices_v1");
  const rawAlch = options.storage.getItem("sim_alch_v1");
  const rawScrapedAt = options.storage.getItem("sim_scraped_at_v1");
  const hasAnyCurrentPriceKey = rawPrices != null || rawAlch != null || rawScrapedAt != null;
  if (!hasAnyCurrentPriceKey) return;

  if (rawPrices == null || rawAlch == null) {
    skip(report, "prices.priceSet", "legacy prices and alch maps are both required");
    warn(report, "Legacy prices were detected but could not form a complete price set.");
    return;
  }

  const parsedPrices = parseLegacyJsonStorageValue(
    rawPrices,
    "sim_prices_v1",
    options.maxPriceBytes ?? DEFAULT_MAX_LEGACY_PRICE_BYTES,
    report
  );
  const parsedAlch = parseLegacyJsonStorageValue(
    rawAlch,
    "sim_alch_v1",
    options.maxPriceBytes ?? DEFAULT_MAX_LEGACY_PRICE_BYTES,
    report
  );
  if (!parsedPrices.ok || !parsedAlch.ok) {
    skip(report, "prices.priceSet", "legacy price set could not be parsed safely");
    warn(report, "Legacy prices were ignored because one or more maps failed validation.");
    return;
  }

  const createdAt = createdAtFromLegacyScrapedAt(rawScrapedAt, report);
  let priceSet: PriceSet;
  try {
    priceSet = createPriceSetFromLegacyRecords({
      id: "legacy-browser-prices",
      label: "Legacy browser prices",
      source: "imported",
      createdAt,
      itemPrices: parsedPrices.value,
      alchValues: parsedAlch.value,
      provenance: {
        source: "manual",
        notes: "Imported from legacy browser localStorage keys."
      }
    });
  } catch {
    skip(report, "prices.priceSet", "legacy price set failed schema validation");
    warn(report, "Legacy prices were ignored because they failed price set validation.");
    return;
  }

  const unknownKeys = unknownPriceKeys(priceSet, options.gameData);
  if (unknownKeys.length > 0) {
    skip(report, "prices.priceSet", "legacy price set includes unknown item ids");
    warn(
      report,
      `Legacy prices were ignored because ${unknownKeys.length} item ids are not in game data.`
    );
    return;
  }

  report.priceSet = priceSet;
  importField(report, "prices.priceSet");
}

function inspectLegacyPriceHistory(
  storage: KeyValueStorage,
  report: LegacySetupMigrationReport
): void {
  const hasLegacyPriceHistory = LEGACY_PRICE_HISTORY_KEYS.some(
    (key) => storage.getItem(key) != null
  );
  if (!hasLegacyPriceHistory) return;
  skip(report, "prices.history", "legacy price history migration is not supported in this flow");
  warn(report, "Legacy price history was detected but not imported.");
}

function createReport(foundKeys: LegacyStorageKey[]): LegacySetupMigrationReport {
  return {
    foundKeys,
    keyReview: createLegacyStorageKeyReview(foundKeys),
    importedFields: [],
    skippedFields: [],
    warnings: [],
    setup: null,
    hiscoresPlayer: null,
    priceSet: null,
    lootPrefs: null,
    hiddenGearTiers: null,
    denseCompareSort: null,
    irrelevantMonsterIds: null
  };
}

function mapLegacyInput(
  legacy: LegacyRecord,
  draft: MutableFormState,
  gameData: GameDataSnapshot,
  report: LegacySetupMigrationReport
): void {
  mapCombatStyle(legacy, draft, report);
  mapLevels(legacy, draft, report);
  mapMonster(legacy, draft, gameData, report);
  mapWeapon(legacy, draft, gameData, report);
  mapAmmo(legacy, draft, gameData, report);
  mapSpell(legacy, draft, gameData, report);
  mapGear(legacy, draft, gameData, report);
  mapTrip(legacy, draft, report);
  mapStyle(legacy, draft, gameData, report);
}

function mapCombatStyle(
  legacy: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport
): void {
  const combatStyle = readString(legacy, ["combatType", "combatStyle"]);
  if (combatStyle == null) return;
  if (isOneOf(combatStyle, COMBAT_STYLES)) {
    Object.assign(draft, setCombatStyleDefaults(draft, combatStyle));
    importField(report, "combatStyle");
  } else {
    skip(report, "combatStyle", "unknown combat style");
  }
}

function mapLevels(
  legacy: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport
): void {
  const levelFields = [
    { target: "attack", aliases: ["attack"] },
    { target: "strength", aliases: ["strength"] },
    { target: "defence", aliases: ["defence", "defense"] },
    { target: "hitpoints", aliases: ["hitpoints", "hp"] },
    { target: "ranged", aliases: ["ranged"] },
    { target: "magic", aliases: ["magic"] },
    { target: "prayer", aliases: ["prayer"] }
  ] as const;

  for (const field of levelFields) {
    const value = readNumber(legacy, field.aliases);
    if (value == null) continue;
    const key = field.target;
    if (Number.isInteger(value) && value >= 1 && value <= 99) {
      draft.levels[key] = value;
      importField(report, `levels.${key}`);
    } else {
      skip(report, `levels.${key}`, "expected an integer level from 1 to 99");
    }
  }
}

function mapMonster(
  legacy: LegacyRecord,
  draft: MutableFormState,
  gameData: GameDataSnapshot,
  report: LegacySetupMigrationReport
): void {
  const monsterId =
    readString(legacy, ["_monsterId", "monsterId"]) ?? readEntityObjectId(legacy.monster);
  if (monsterId == null) return;
  if (gameData.monsters[monsterId]) {
    draft.monsterId = monsterId;
    importField(report, "monsterId");
  } else {
    skip(report, "monsterId", "unknown monster id");
  }
}

function mapWeapon(
  legacy: LegacyRecord,
  draft: MutableFormState,
  gameData: GameDataSnapshot,
  report: LegacySetupMigrationReport
): void {
  const weaponId = readString(legacy, ["weapon", "weaponId"]);
  if (weaponId == null) return;
  const weapon = gameData.weapons[weaponId];
  if (weapon && weapon.type === draft.combatStyle) {
    draft.weaponId = weaponId;
    importField(report, "weaponId");
  } else {
    skip(report, "weaponId", "unknown weapon id or weapon does not match combat style");
  }
}

function mapAmmo(
  legacy: LegacyRecord,
  draft: MutableFormState,
  gameData: GameDataSnapshot,
  report: LegacySetupMigrationReport
): void {
  const ammoId = readString(legacy, ["ammo", "ammoId"]);
  if (ammoId == null) return;
  if (ammoId === "none" || gameData.ammo[ammoId]) {
    draft.ammoId = ammoId;
    importField(report, "ammoId");
  } else {
    skip(report, "ammoId", "unknown ammo id");
  }
}

function mapSpell(
  legacy: LegacyRecord,
  draft: MutableFormState,
  gameData: GameDataSnapshot,
  report: LegacySetupMigrationReport
): void {
  const spellId = readString(legacy, ["spell", "spellId"]);
  if (spellId == null) return;
  if (gameData.spells[spellId]) {
    draft.spellId = spellId;
    importField(report, "spellId");
  } else {
    skip(report, "spellId", "unknown spell id");
  }
}

function mapStyle(
  legacy: LegacyRecord,
  draft: MutableFormState,
  gameData: GameDataSnapshot,
  report: LegacySetupMigrationReport
): void {
  const styleId = readString(legacy, ["style", "styleId"]);
  if (styleId == null) return;
  if (validStyleIds(draft.combatStyle, draft.weaponId, gameData).has(styleId)) {
    draft.styleId = styleId;
    importField(report, "styleId");
  } else {
    skip(report, "styleId", "unknown style id for combat style and weapon");
  }
}

function mapGear(
  legacy: LegacyRecord,
  draft: MutableFormState,
  gameData: GameDataSnapshot,
  report: LegacySetupMigrationReport
): void {
  if (!isRecord(legacy.gear)) return;
  for (const slot of EQUIPMENT_SLOTS) {
    const itemId = readString(legacy.gear, [slot]);
    if (itemId == null) continue;
    if (itemId === "none" || !!gameData.equipment[slot][itemId]) {
      draft.gear[slot] = itemId;
      importField(report, `gear.${slot}`);
    } else {
      skip(report, `gear.${slot}`, "unknown gear id for slot");
    }
  }
}

function mapTrip(
  legacy: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport
): void {
  if (!isRecord(legacy.trip)) return;
  mapTripFoodKey(legacy.trip, draft, report);
  mapTripBoolean(legacy.trip, draft, report, "teleport");
  mapTripNullableInteger(legacy.trip, draft, report, "bankSeconds", 0, 3600);
  mapTripInteger(legacy.trip, draft, report, "potionSets", 0, 28);
  mapTripInteger(legacy.trip, draft, report, "potionDoses", 0, 112);
  mapTripBoolean(legacy.trip, draft, report, "singleDose");
  mapTripBoolean(legacy.trip, draft, report, "dbaRestore");
  mapTripEnum(legacy.trip, draft, report, "prayerMode", PRAYER_MODES);
  mapTripBoolean(legacy.trip, draft, report, "alching");
  mapTripBoolean(legacy.trip, draft, report, "recoverAmmo");
  mapTripInteger(legacy.trip, draft, report, "runeSlots", 0, 28);
  mapTripBoolean(legacy.trip, draft, report, "antifire");
  mapTripBoolean(legacy.trip, draft, report, "antipoison");
  mapTripNullableBoolean(legacy.trip, draft, report, "safespot");
  mapTripEnum(legacy.trip, draft, report, "protect", PROTECT_PRAYERS);
  mapTripInteger(legacy.trip, draft, report, "recoilRings", 1, 28);
  mapTripNullableInteger(legacy.trip, draft, report, "foodCount", 0, 28);
  mapTripNullableNumber(legacy.trip, draft, report, "foodPerKillOverride", 0, 999);
  mapTripNullableInteger(legacy.trip, draft, report, "prayerPotionSets", 0, 28);
  mapTripNullableInteger(legacy.trip, draft, report, "prayerPotionDoses", 0, 112);
  mapTripNullableInteger(legacy.trip, draft, report, "altarSeconds", 0, 3600);
}

function mapTripFoodKey(
  trip: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport
): void {
  const value = readString(trip, ["foodKey"]);
  if (value == null) return;
  if (FOOD[value]) {
    draft.trip.foodKey = value;
    importField(report, "trip.foodKey");
  } else {
    skip(report, "trip.foodKey", "unknown food key");
  }
}

function mapTripBoolean(
  trip: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport,
  field: TripField
): void {
  const value = trip[field];
  if (value == null) return;
  if (typeof value === "boolean") {
    setTripField(draft, field, value);
    importField(report, `trip.${field}`);
  } else {
    skip(report, `trip.${field}`, "expected a boolean");
  }
}

function mapTripNullableBoolean(
  trip: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport,
  field: TripField
): void {
  const value = trip[field];
  if (value === undefined) return;
  if (value === null || typeof value === "boolean") {
    setTripField(draft, field, value);
    importField(report, `trip.${field}`);
  } else {
    skip(report, `trip.${field}`, "expected a boolean or null");
  }
}

function mapTripInteger(
  trip: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport,
  field: TripField,
  min: number,
  max: number
): void {
  const value = readNumber(trip, [field]);
  if (value == null) return;
  if (Number.isInteger(value) && value >= min && value <= max) {
    setTripField(draft, field, value);
    importField(report, `trip.${field}`);
  } else {
    skip(report, `trip.${field}`, `expected an integer from ${min} to ${max}`);
  }
}

function mapTripNullableInteger(
  trip: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport,
  field: TripField,
  min: number,
  max: number
): void {
  const value = trip[field];
  if (value === undefined) return;
  if (value === null) {
    setTripField(draft, field, null);
    importField(report, `trip.${field}`);
    return;
  }
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  ) {
    setTripField(draft, field, value);
    importField(report, `trip.${field}`);
  } else {
    skip(report, `trip.${field}`, `expected null or an integer from ${min} to ${max}`);
  }
}

function mapTripNullableNumber(
  trip: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport,
  field: TripField,
  min: number,
  max: number
): void {
  const value = trip[field];
  if (value === undefined) return;
  if (value === null) {
    setTripField(draft, field, null);
    importField(report, `trip.${field}`);
    return;
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max) {
    setTripField(draft, field, value);
    importField(report, `trip.${field}`);
  } else {
    skip(report, `trip.${field}`, `expected null or a finite number from ${min} to ${max}`);
  }
}

function mapTripEnum<const Values extends readonly string[]>(
  trip: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport,
  field: TripField,
  values: Values
): void {
  const value = readString(trip, [field]);
  if (value == null) return;
  if (isOneOf(value, values)) {
    setTripField(draft, field, value);
    importField(report, `trip.${field}`);
  } else {
    skip(report, `trip.${field}`, `expected one of: ${values.join(", ")}`);
  }
}

function validStyleIds(
  combatStyle: CombatStyle,
  weaponId: EntityId,
  gameData: GameDataSnapshot
): Set<EntityId> {
  if (combatStyle === "melee") {
    return new Set(weaponStances(weaponId, gameData).map((stance) => stance.id));
  }
  if (combatStyle === "ranged") return new Set(["accurate", "rapid", "longrange"]);
  return new Set(["accurate", "defensive", "longrange"]);
}

function setTripField<Field extends TripField>(
  draft: MutableFormState,
  field: Field,
  value: CombatSetupFormState["trip"][Field]
): void {
  draft.trip[field] = value;
}

function cloneDefaultFormState(): MutableFormState {
  return {
    ...DEFAULT_FORM_STATE,
    levels: { ...DEFAULT_FORM_STATE.levels },
    gear: { ...DEFAULT_FORM_STATE.gear },
    prayers: [...DEFAULT_FORM_STATE.prayers],
    boosts: [...DEFAULT_FORM_STATE.boosts],
    specialAttack: { ...DEFAULT_FORM_STATE.specialAttack },
    trip: { ...DEFAULT_FORM_STATE.trip },
    plannerTargets: { ...DEFAULT_FORM_STATE.plannerTargets }
  };
}

function readString(record: LegacyRecord, aliases: readonly string[]): string | undefined {
  for (const alias of aliases) {
    const value = record[alias];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function readNumber(record: LegacyRecord, aliases: readonly string[]): number | undefined {
  for (const alias of aliases) {
    const value = record[alias];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function readEntityObjectId(value: unknown): string | undefined {
  return isRecord(value) ? readString(value, ["id"]) : undefined;
}

function isRecord(value: unknown): value is LegacyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function parseLegacyJsonStorageValue(
  rawValue: string,
  field: LegacyJsonField,
  maxBytes: number,
  report: LegacySetupMigrationReport,
  subject = "Legacy price data"
): { ok: true; value: unknown } | { ok: false } {
  if (byteLength(rawValue) > maxBytes) {
    skip(report, field, "legacy value exceeds safe size limit");
    warn(report, `${subject} was ignored because it exceeds the safe size limit.`);
    return { ok: false };
  }

  try {
    return { ok: true, value: JSON.parse(rawValue) };
  } catch {
    skip(report, field, "invalid JSON");
    warn(report, `${subject} could not be parsed as JSON.`);
    return { ok: false };
  }
}

function legacyCompareSortDirection(
  legacyKey: string,
  legacySort: LegacyRecord
): DenseCompareSortState["direction"] | null {
  const direction = readString(legacySort, ["direction"]);
  if (direction === "asc" || direction === "desc") return direction;

  const legacyDir = readNumber(legacySort, ["dir"]);
  if (legacyDir == null || legacyDir === 0) return null;
  if (legacyKey === "name" || legacyKey === "monsterName") {
    return legacyDir < 0 ? "asc" : "desc";
  }
  return legacyDir < 0 ? "desc" : "asc";
}

function createdAtFromLegacyScrapedAt(
  rawValue: string | null,
  report: LegacySetupMigrationReport
): string {
  if (rawValue == null) return "legacy-unknown";
  const trimmed = rawValue.trim();
  if (!trimmed) {
    skip(report, "prices.scrapedAt", "empty legacy scraped timestamp");
    return "legacy-unknown";
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const timestamp = new Date(milliseconds);
    if (Number.isFinite(timestamp.getTime())) return timestamp.toISOString();
  }

  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();

  skip(report, "prices.scrapedAt", "invalid legacy scraped timestamp");
  warn(report, "Legacy price scraped timestamp was ignored.");
  return "legacy-unknown";
}

function unknownPriceKeys(priceSet: PriceSet, gameData: GameDataSnapshot): string[] {
  const itemIds = new Set(Object.keys(gameData.items));
  const keys = new Set([...Object.keys(priceSet.itemPrices), ...Object.keys(priceSet.alchValues)]);
  return [...keys]
    .filter((key) => !itemIds.has(key))
    .sort((left, right) => left.localeCompare(right));
}

function createLootPreferenceCandidatesByName(
  gameData: GameDataSnapshot
): Map<string, LootPreferenceCandidate[]> {
  const candidates = new Map<string, LootPreferenceCandidate[]>();
  for (const monster of Object.values(gameData.monsters)) {
    const drops = flattenMonsterLoot(monster);
    const rowIds = lootPreferenceKeysForMonster(monster);
    const nameCounts = new Map<string, number>();
    for (const drop of drops) {
      nameCounts.set(drop.name, (nameCounts.get(drop.name) ?? 0) + 1);
    }

    for (const [index, drop] of drops.entries()) {
      const rowId = rowIds[index] ?? lootPreferenceKey(drop, index);
      const list = candidates.get(drop.name) ?? [];
      list.push({
        monsterId: monster.id,
        rowId,
        ambiguous: (nameCounts.get(drop.name) ?? 0) > 1
      });
      candidates.set(drop.name, list);
    }
  }
  return candidates;
}

function flattenMonsterLoot(monster: MonsterDefinition): DropDefinition[] {
  const drops: DropDefinition[] = [];
  for (const entry of monster.loot ?? []) {
    if (Array.isArray(entry)) drops.push(...entry);
    else drops.push(entry);
  }
  return drops;
}

function isOneOf<const Values extends readonly string[]>(
  value: string,
  values: Values
): value is Values[number] {
  return values.some((allowed) => allowed === value);
}

function importField(report: LegacySetupMigrationReport, field: string): void {
  report.importedFields.push(field);
}

function skip(
  report: LegacySetupMigrationReport,
  field: string,
  reason: string,
  metadata: Pick<LegacyMigrationSkippedField, "disposition" | "handling"> = {}
): void {
  report.skippedFields.push({ field, reason, ...metadata });
}

function warn(report: LegacySetupMigrationReport, message: string): void {
  report.warnings.push(message);
}

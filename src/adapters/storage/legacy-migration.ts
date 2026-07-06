import { weaponStances } from "@/domain/combat";
import {
  EQUIPMENT_SLOTS,
  type CombatStyle,
  type EntityId,
  type GameDataSnapshot,
  type PriceSet
} from "@/domain/shared";
import { FOOD } from "@/domain/trip";
import { HiscoresPlayerNameSchema, createPriceSetFromLegacyRecords } from "@/data/schemas";
import {
  CombatSetupFormSchema,
  DEFAULT_FORM_STATE,
  normalizeFormState,
  setCombatStyleDefaults,
  type CombatSetupFormState
} from "@/app/state/ui-state";
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
  | "migrate"
  | "review-only"
  | "intentional-reset"
  | "legacy-only";

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
}

export interface LegacySetupMigrationOptions {
  storage: KeyValueStorage;
  gameData: GameDataSnapshot;
  maxInputBytes?: number;
  maxPriceBytes?: number;
  maxHiscoresBytes?: number;
  maxPlannerBytes?: number;
}

const DEFAULT_MAX_LEGACY_INPUT_BYTES = 250_000;
const DEFAULT_MAX_LEGACY_PRICE_BYTES = 1_000_000;
const DEFAULT_MAX_LEGACY_HISCORES_BYTES = 200;
const DEFAULT_MAX_LEGACY_PLANNER_BYTES = 250_000;
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
    disposition: "review-only",
    handling: "Detected only; legacy loot preference row ids are not imported.",
    reason: "Rewrite loot prefs exist, but legacy row-id compatibility is not accepted."
  },
  {
    key: "sim_hidden_tiers_v1",
    label: "Hidden gear tiers",
    disposition: "review-only",
    handling: "Detected only; hidden-tier state is not imported.",
    reason: "Hidden-tier controls and migration policy are outside the current rewrite slice."
  },
  {
    key: "sim_compare_sort_v1",
    label: "Compare sort",
    disposition: "review-only",
    handling: "Detected only; legacy compare sort is not imported.",
    reason: "Rewrite dense compare owns separate versioned sort state."
  },
  {
    key: "sim_irrelevant_v1",
    label: "Compare relevance",
    disposition: "review-only",
    handling: "Detected only; legacy irrelevant/relevance state is not imported.",
    reason: "Rewrite relevance state exists, but legacy relevance migration policy is not accepted."
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
  const hasLegacyPriceHistory = LEGACY_PRICE_HISTORY_KEYS.some((key) => storage.getItem(key) != null);
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
    priceSet: null
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
  const monsterId = readString(legacy, ["_monsterId", "monsterId"]) ?? readEntityObjectId(legacy.monster);
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
  mapTripInteger(legacy.trip, draft, report, "bankSeconds", 0, 3600);
  mapTripEnum(legacy.trip, draft, report, "prayerMode", PRAYER_MODES);
  mapTripBoolean(legacy.trip, draft, report, "alching");
  mapTripBoolean(legacy.trip, draft, report, "recoverAmmo");
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
  key: LegacyStorageKey,
  maxBytes: number,
  report: LegacySetupMigrationReport
): { ok: true; value: unknown } | { ok: false } {
  if (byteLength(rawValue) > maxBytes) {
    skip(report, key, "legacy value exceeds safe size limit");
    warn(report, "Legacy price data was ignored because it exceeds the safe size limit.");
    return { ok: false };
  }

  try {
    return { ok: true, value: JSON.parse(rawValue) };
  } catch {
    skip(report, key, "invalid JSON");
    warn(report, "Legacy price data could not be parsed as JSON.");
    return { ok: false };
  }
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

function isOneOf<const Values extends readonly string[]>(
  value: string,
  values: Values
): value is Values[number] {
  return values.some((allowed) => allowed === value);
}

function importField(report: LegacySetupMigrationReport, field: string): void {
  report.importedFields.push(field);
}

function skip(report: LegacySetupMigrationReport, field: string, reason: string): void {
  report.skippedFields.push({ field, reason });
}

function warn(report: LegacySetupMigrationReport, message: string): void {
  report.warnings.push(message);
}

import { isSupportedSpecialAttackWeapon, weaponStances } from "@/domain/combat";
import {
  EQUIPMENT_SLOTS,
  type CombatStyle,
  type EntityId,
  type GameDataSnapshot
} from "@/domain/shared";
import { FOOD } from "@/domain/trip";
import {
  BOOST_SELECTION_OPTIONS,
  DEFAULT_FORM_STATE,
  PRAYER_SELECTION_OPTIONS,
  normalizeBoostSelection,
  normalizePrayerSelection,
  setCombatStyleDefaults,
  type CombatSetupFormState
} from "../ui-state";
import type { LegacySetupMigrationReport } from "./contracts";
import {
  importField,
  isOneOf,
  isRecord,
  readEntityObjectId,
  readNumber,
  readString,
  skip,
  type LegacyRecord
} from "./report";

type MutableFormState = CombatSetupFormState;
type TripField = keyof CombatSetupFormState["trip"];

interface LegacyInputMappingOptions {
  mapMonster?: boolean;
}

const COMBAT_STYLES = ["melee", "ranged", "magic"] as const satisfies readonly CombatStyle[];
const PROTECT_PRAYERS = ["none", "melee", "missiles", "magic"] as const;
const PRAYER_MODES = ["potions", "altar", "none"] as const;
const LEGACY_PRAYER_IDS = new Set(PRAYER_SELECTION_OPTIONS.map((option) => option.id));
const LEGACY_BOOST_IDS = new Set(BOOST_SELECTION_OPTIONS.map((option) => option.id));

export function mapLegacyInput(
  legacy: LegacyRecord,
  draft: MutableFormState,
  gameData: GameDataSnapshot,
  report: LegacySetupMigrationReport,
  options: LegacyInputMappingOptions = {}
): void {
  mapCombatStyle(legacy, draft, report);
  mapLevels(legacy, draft, report);
  if (options.mapMonster !== false) mapMonster(legacy, draft, gameData, report);
  mapWeapon(legacy, draft, gameData, report);
  mapAmmo(legacy, draft, gameData, report);
  mapSpell(legacy, draft, gameData, report);
  mapGear(legacy, draft, gameData, report);
  mapSelections(legacy, draft, report);
  mapLoadoutPolicy(legacy, draft, gameData, report);
  mapTrip(legacy, draft, report);
  mapStyle(legacy, draft, gameData, report);
}

function mapSelections(
  legacy: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport
): void {
  mapSelectionArray(
    legacy.prayers,
    "prayers",
    LEGACY_PRAYER_IDS,
    normalizePrayerSelection,
    (value) => {
      draft.prayers = value;
    },
    report
  );
  mapSelectionArray(
    legacy.boosts,
    "boosts",
    LEGACY_BOOST_IDS,
    normalizeBoostSelection,
    (value) => {
      draft.boosts = value;
    },
    report
  );
}

function mapSelectionArray(
  value: unknown,
  field: "prayers" | "boosts",
  allowed: ReadonlySet<string>,
  normalize: (keys: readonly string[]) => EntityId[],
  assign: (keys: EntityId[]) => void,
  report: LegacySetupMigrationReport
): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    skip(report, field, "expected an array of selection ids");
    return;
  }

  const accepted: string[] = [];
  for (const [index, key] of value.entries()) {
    if (key === "none") continue;
    if (typeof key === "string" && allowed.has(key)) accepted.push(key);
    else skip(report, `${field}.${index}`, "unknown selection id");
  }
  assign(normalize(accepted));
  importField(report, field);
}

function mapLoadoutPolicy(
  legacy: LegacyRecord,
  draft: MutableFormState,
  gameData: GameDataSnapshot,
  report: LegacySetupMigrationReport
): void {
  mapFormBoolean(legacy, draft, report, "sustained");
  mapFormBoolean(legacy, draft, report, "ringOfWealth");

  if (legacy.repotThreshold !== undefined) {
    const value = legacy.repotThreshold;
    if (
      value === null ||
      (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 120)
    ) {
      draft.repotThreshold = value;
      importField(report, "repotThreshold");
    } else {
      skip(report, "repotThreshold", "expected null or an integer from 1 to 120");
    }
  }

  const specWeapon = readString(legacy, ["specWeapon"]);
  const specAmmo = readString(legacy, ["specAmmo"]);
  if (specWeapon == null && specAmmo == null) return;
  if (specWeapon === "none") {
    draft.specialAttack = { weaponId: "none", ammoId: "none" };
    importField(report, "specialAttack");
    return;
  }
  if (specWeapon == null || !isSupportedSpecialAttackWeapon(specWeapon, draft.combatStyle)) {
    skip(report, "specialAttack.weaponId", "unknown special attack weapon for combat style");
    return;
  }
  if (specAmmo != null && specAmmo !== "none" && !gameData.ammo[specAmmo]) {
    skip(report, "specialAttack.ammoId", "unknown special attack ammo id");
    return;
  }
  draft.specialAttack = { weaponId: specWeapon, ammoId: specAmmo ?? "none" };
  importField(report, "specialAttack");
}

function mapFormBoolean(
  legacy: LegacyRecord,
  draft: MutableFormState,
  report: LegacySetupMigrationReport,
  field: "sustained" | "ringOfWealth"
): void {
  const value = legacy[field];
  if (value === undefined) return;
  if (typeof value === "boolean") {
    draft[field] = value;
    importField(report, field);
  } else {
    skip(report, field, "expected a boolean");
  }
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

export function cloneDefaultFormState(): MutableFormState {
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

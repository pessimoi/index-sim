import { hitChance, potionBoostedLevel, TICK_SECONDS, type PotionStatKey } from "../combat";
import { aliasesForCanonicalItemId, lookupItemPrice, resolveCanonicalItemId } from "../economy";
import { sumEquipmentBonuses } from "../equipment";
import {
  type CombatSimulationResult,
  type CombatStyle,
  type DropDefinition,
  type DropEntry,
  type EntityId,
  type GameDataSnapshot,
  type MonsterDefinition,
  type PriceSet,
  type SimulationContext,
  type SimulationRequest,
  type SimulationWarning
} from "../shared";

export type LootAction = "skip" | "bury" | "alch" | "loot" | "unid" | "value";
export type TripBound = "loot" | "food" | "overfull" | "prayer" | "recoil" | "respawn" | "none";
export type JewelSpot = "underground" | "overground";
export type PotionCarryRecommendationStatus =
  "inactive" | "no-boost" | "manual" | "under" | "over" | "matched";

export interface PotionCarryRecommendation {
  active: boolean;
  status: PotionCarryRecommendationStatus;
  canApply: boolean;
  recommendedVials: number;
  recommendedDoses: number;
  tripMinutes: number | null;
  repotIntervalMinutes: number | null;
  matched: boolean;
  reason: string;
  warnings: string[];
}

export interface PotionCarryRecommendationInput {
  request: SimulationRequest;
  trip: TripPolicy;
  cycleSec: number;
  killsPerTrip: number;
}

interface FoodDefinition {
  name: string;
  heal: number;
  priceKey: EntityId | null;
}

interface PotionSupplyDefinition {
  name: string;
  vials: number;
  priceKey: EntityId;
  fallback: number;
}

interface PrayerData {
  def: number;
  drain: number;
}

export interface TripPolicy {
  foodKey?: EntityId;
  teleport?: boolean;
  bankSeconds?: number | null;
  potionSets?: number;
  potionDoses?: number;
  singleDose?: boolean;
  dbaRestore?: boolean;
  antifire?: boolean;
  antipoison?: boolean;
  prayerMode?: "potions" | "altar" | "none";
  prayerRestore?: boolean;
  prayerPotionSets?: number;
  prayerPotionDoses?: number;
  altarSeconds?: number;
  alching?: boolean;
  runeSlots?: number;
  foodPerKillOverride?: number | null;
  foodCount?: number | null;
  protect?: "none" | "melee" | "missiles" | "magic";
  safespot?: boolean;
  recoverAmmo?: boolean;
  recoilRings?: number;
  scarceSpot?: boolean;
  targetsAtSpot?: number | null;
  respawnSeconds?: number | null;
}

export interface CannonSettings {
  enabled?: boolean;
  targets?: number | null;
  respawnSec?: number | null;
}

export interface CannonOverlayResult {
  enabled: true;
  targets: number;
  respawnSec: number;
  effTargets: number;
  maxBall: number;
  ballsPerSec: number;
  ballsPerHour: number;
  ballsPerKill: number;
  ballPrice: number;
  ballCostPerKill: number;
  ballCostPerHour: number;
  cannonDps: number;
  cannonDmgPerHour: number;
  rangedXpPerHour: number;
  playerDps: number;
  activeFrac: number;
  kphNoCannon: number;
  kphWithCannon: number;
  respawnBound: boolean;
  idle: boolean;
  ballsPerTrip?: number;
  ballCostPerTrip?: number;
}

export interface TripScarceSpotResult {
  enabled: boolean;
  targetsAtSpot: number;
  respawnSeconds: number;
  spawnCycleSec: number;
  maxKph: number;
  respawnBound: boolean;
}

export interface TripLootSupplyInput {
  request: SimulationRequest;
  combat: CombatSimulationResult;
  trip?: TripPolicy;
  lootPrefs?: Record<string, LootAction | string | undefined>;
  ringOfWealth?: boolean;
  legendsComplete?: boolean;
  jewelSpot?: JewelSpot;
  overheadSec?: number | null;
  cannon?: CannonSettings | null;
}

export interface LootContextOptions {
  alching?: boolean;
  lootPrefs?: Record<string, LootAction | string | undefined>;
  ringOfWealth?: boolean;
  legendsComplete?: boolean;
  jewelSpot?: JewelSpot;
}

export interface LootBreakdownEntry extends DropDefinition {
  rowId: string;
  price: number;
  saleValue: number;
  evGp: number;
  pref: LootAction;
  isBone: boolean;
  isHerb: boolean;
  slotFrac: number;
  prayerXp: number;
  alchValue: number;
  bulkDead: boolean;
  _eaten?: boolean;
  _displaced?: boolean;
}

export interface LootEvaluation {
  gpPerKill: number;
  prayerXpPerKill: number;
  alchCastsPerKill: number;
  alchTimePerKill: number;
  lootBreakdown: LootBreakdownEntry[];
  warnings: SimulationWarning[];
}

export interface IncomingDamageResult {
  hpPerKill: number;
  netHpPerKill: number;
  regenPerKill: number;
  monMax: number;
  hitChance: number;
  dragonfire: number;
  poison?: number;
  protected: boolean;
  safespot: boolean;
  safespotAuto: boolean;
}

export interface TripComputationContext {
  monster: MonsterDefinition;
  combatStyle: CombatStyle;
  ttkSec: number;
  cycleSec: number;
  killsPerHour: number;
  lootBreakdown: LootBreakdownEntry[];
  prayerDef: number;
  boostKeys: readonly EntityId[];
  dba: boolean;
  dbaRestore?: boolean;
  hasSpec: boolean;
  prayerPerKill: number;
  prayerLevel: number;
  ringRecoil: boolean;
  recoilDmgPerKill: number;
  cannonOn: boolean;
  scarce: TripScarceSpotResult;
}

export interface TripResult {
  killsPerTrip: number;
  bound: TripBound;
  efficiency: number;
  effectiveKph: number;
  tripMinutes: number;
  lootFraction: number;
  foodPerKill: number;
  foodHeal: number;
  foodPrice: number;
  foodCostPerKill: number;
  foodName: string;
  potionCostPerKill: number;
  potionCostPerTrip: number;
  singleDose: boolean;
  dosesPerType: number;
  prayerActive: boolean;
  prayerPerKill: number;
  prayerCostPerKill: number;
  prayerSlots: number;
  prayerPointsPerDose: number;
  maxKillsPrayer: number;
  prayerMode: "potions" | "altar" | "none";
  prayerDrains: boolean;
  prayerPool: number;
  naturalKills: number;
  altarOn: boolean;
  altarSeconds: number;
  altarSecPerKill: number;
  killsPerAltar: number;
  recoilOn: boolean;
  recoilRings: number;
  recoilSpares: number;
  recoilRingsPerKill: number;
  recoilCostPerKill: number;
  maxKillsRecoil: number;
  recoilDmgPerKill: number;
  scarce: TripScarceSpotResult;
  incoming: IncomingDamageResult;
  eatenFood: Record<string, number>;
  slots: {
    inv: number;
    reserve: number;
    reserveParts: string[];
    stackReserve: number;
    foodCount: number;
    potionSlots: number;
    potionTypes: number;
    potionSets: number;
    potionDoses: number;
    singleDose: boolean;
    potionParts: string[];
    freeAtStart: number;
    lootCapacity: number;
    nonStackPerKill: number;
    lootSlotsAtEnd: number;
    foodLeftAtEnd: number;
    autoFoodCount: number;
    prayerSlots: number;
  };
  bankSeconds: number;
}

export interface SupplyResult {
  foodCostPerKill: number;
  potionCostPerKill: number;
  ammoCostPerKill: number;
  runeCostPerKill: number;
  recoilCostPerKill: number;
  ballCostPerKill: number;
  supplyCostPerKill: number;
  ammoPerKill: number;
  ammoKeyUsed: EntityId | null;
  ammoUnitPrice: number;
  runeCostPerCast: number;
  chargePerCast: number;
  castsPerKill: number;
}

export interface TripLootSupplyResult {
  gpPerKill: number;
  gpPerHour: number;
  netGpPerHour: number;
  effectiveGpPerHour: number;
  effectiveNetGpPerHour: number;
  effectiveKph: number;
  cycleSec: number;
  killsPerHour: number;
  prayerPerKill: number;
  prayerXpPerKill: number;
  prayerXpPerHour: number;
  alchCastsPerKill: number;
  combatXpDamageFraction: number;
  playerAttackTimeSecPerKill: number;
  potionRecommendation: PotionCarryRecommendation;
  cannon: CannonOverlayResult | null;
  lootBreakdown: LootBreakdownEntry[];
  trip: TripResult;
  supply: SupplyResult;
  incoming: IncomingDamageResult;
  warnings: SimulationWarning[];
}

const INVENTORY_SIZE = 28;
const VALUE_THRESHOLD = 2000;
const NATURE_RUNE_FALLBACK = 265;
export const HIGH_ALCH_MAGIC_XP_PER_CAST = 65;
const CANNONBALL_PRICE_KEY = "mcannonball";
const CANNONBALL_FALLBACK_PRICE = 180;
const PROTECT_DRAIN = 12;
const CHARGE_DURATION_SEC = 420;
const DEFAULT_SCARCE_TARGETS = 1;
const DEFAULT_RESPAWN_SEC = 60;

export const FOOD: Record<EntityId, FoodDefinition> = {
  none: { name: "No food", heal: 0, priceKey: null },
  trout: { name: "Trout", heal: 7, priceKey: "trout" },
  salmon: { name: "Salmon", heal: 9, priceKey: "salmon" },
  tuna: { name: "Tuna", heal: 10, priceKey: "tuna" },
  lobster: { name: "Lobster", heal: 12, priceKey: "lobster" },
  bass: { name: "Bass", heal: 13, priceKey: "bass" },
  swordfish: { name: "Swordfish", heal: 14, priceKey: "swordfish" },
  shark: { name: "Shark", heal: 20, priceKey: "shark" }
};

export const BANK_PRESETS: Record<EntityId, number> = {
  green_dragon: 240,
  blue_dragon: 270,
  red_dragon: 300,
  black_dragon: 300,
  ice_warrior: 150,
  firegiant: 210,
  giant: 90,
  mossgiant: 110,
  icegiant: 120,
  hellhound: 150,
  greater_demon: 130,
  lesser_demon: 120,
  black_demon: 160,
  hobgoblin_armed: 120,
  hobgoblin_unarmed: 120,
  bandit: 180,
  ankou: 140,
  chaos_druid: 90,
  dagannoth: 150,
  dagannoth_92: 150,
  elf_warrior_90: 360,
  elf_warrior_108: 360,
  rock_crab: 240,
  thug: 90,
  tribesman: 240
};

export const POTION_SUPPLIES: Record<EntityId, PotionSupplyDefinition> = {
  super_set: { name: "Super set (att/str/def)", vials: 3, priceKey: "super_set", fallback: 7867 },
  super_attack: { name: "Super attack", vials: 1, priceKey: "super_attack", fallback: 1600 },
  super_strength: { name: "Super strength", vials: 1, priceKey: "super_strength", fallback: 4667 },
  super_defence: { name: "Super defence", vials: 1, priceKey: "super_defence", fallback: 1600 },
  ranging: { name: "Ranging potion", vials: 1, priceKey: "ranging_potion", fallback: 5300 },
  magic: { name: "Magic potion", vials: 1, priceKey: "magic_potion", fallback: 4500 },
  restore: { name: "Restore (for DBA spec)", vials: 1, priceKey: "restore_potion", fallback: 200 },
  prayer: { name: "Prayer potion", vials: 1, priceKey: "prayer_potion", fallback: 7000 },
  antifire: { name: "Antifire potion", vials: 1, priceKey: "antifire_potion", fallback: 4200 },
  antipoison: { name: "Super antipoison", vials: 1, priceKey: "super_antipoison", fallback: 760 }
};

const PRAYERS: Record<EntityId, PrayerData> = {
  none: { def: 1, drain: 0 },
  clarity: { def: 1, drain: 3 },
  reflexes: { def: 1, drain: 6 },
  incredible: { def: 1, drain: 12 },
  burst: { def: 1, drain: 3 },
  superhuman: { def: 1, drain: 6 },
  ultimate: { def: 1, drain: 12 },
  thick_skin: { def: 1.05, drain: 3 },
  rock_skin: { def: 1.1, drain: 6 },
  steel_skin: { def: 1.15, drain: 12 }
};

const POTION_CAT: Record<EntityId, PotionStatKey> = {
  attack: "att",
  strength: "str",
  defence: "def",
  super_att: "att",
  super_str: "str",
  super_def: "def",
  ranging: "rng",
  magic: "mag"
};

const MAX_RECOMMENDED_POTION_VIALS = 28;
const MAX_RECOMMENDED_POTION_DOSES = MAX_RECOMMENDED_POTION_VIALS * 4;

const POTION_STAT_LEVEL: Record<PotionStatKey, keyof SimulationRequest["levels"]> = {
  att: "attack",
  str: "strength",
  def: "defence",
  rng: "ranged",
  mag: "magic"
};

const CAT_POTION: Record<PotionStatKey, EntityId> = {
  att: "super_attack",
  str: "super_strength",
  def: "super_defence",
  rng: "ranging",
  mag: "magic"
};

function inactivePotionRecommendation(
  status: PotionCarryRecommendationStatus,
  reason: string,
  warnings: string[] = []
): PotionCarryRecommendation {
  return {
    active: false,
    status,
    canApply: false,
    recommendedVials: 0,
    recommendedDoses: 0,
    tripMinutes: null,
    repotIntervalMinutes: null,
    matched: false,
    reason,
    warnings
  };
}

export function recommendPotionCarry(
  input: PotionCarryRecommendationInput
): PotionCarryRecommendation {
  if (!input.request.sustained) {
    return inactivePotionRecommendation(
      "inactive",
      "Sustained is off; repeat-dose carry recommendation is not needed."
    );
  }

  const selected = input.request.boosts.keys
    .map((key) => ({ key, stat: POTION_CAT[key] }))
    .filter((entry): entry is { key: EntityId; stat: PotionStatKey } => entry.stat != null)
    .filter((entry) => !(isDbaSelected(input.request) && entry.stat === "str"));

  if (!selected.length) {
    return inactivePotionRecommendation(
      "no-boost",
      "Select a general combat boost to enable vials/type or doses/type guidance."
    );
  }

  if (
    !Number.isFinite(input.cycleSec) ||
    input.cycleSec <= 0 ||
    !Number.isFinite(input.killsPerTrip) ||
    input.killsPerTrip <= 0
  ) {
    return inactivePotionRecommendation(
      "manual",
      "No finite trip estimate is available; set vials/type or doses/type manually.",
      ["Set a finite food, loot, prayer, recoil or banking limit to enable this estimate."]
    );
  }

  const tripMinutes = (input.cycleSec * input.killsPerTrip) / 60;
  if (!Number.isFinite(tripMinutes) || tripMinutes <= 0) {
    return inactivePotionRecommendation(
      "manual",
      "No finite active fighting estimate is available; set vials/type or doses/type manually.",
      ["The recommendation stays inactive until active fighting time can be estimated."]
    );
  }

  let repotIntervalMinutes = Infinity;
  for (const { key, stat } of selected) {
    const base = input.request.levels[POTION_STAT_LEVEL[stat]];
    const peak = potionBoostedLevel(key, stat, base);
    if (peak == null || peak <= base) continue;
    const threshold =
      input.request.repotThreshold != null
        ? Math.max(base, Math.min(peak, input.request.repotThreshold))
        : Math.max(base, peak - 10);
    const boost = peak - base;
    const interval = Math.max(1, peak - threshold || boost);
    repotIntervalMinutes = Math.min(repotIntervalMinutes, interval);
  }

  if (!Number.isFinite(repotIntervalMinutes) || repotIntervalMinutes <= 0) {
    return inactivePotionRecommendation(
      "inactive",
      "Selected boosts do not change a general combat stat."
    );
  }

  const rawDoses = Math.max(1, Math.ceil(tripMinutes / repotIntervalMinutes));
  const cappedDoses = Math.min(MAX_RECOMMENDED_POTION_DOSES, rawDoses);
  const cappedVials = Math.min(MAX_RECOMMENDED_POTION_VIALS, Math.ceil(cappedDoses / 4));
  const singleDose = !!input.trip.singleDose;
  const currentCarry = singleDose
    ? Math.max(0, input.trip.potionDoses ?? 4)
    : Math.max(0, input.trip.potionSets ?? 1);
  const matched = currentCarry === (singleDose ? cappedDoses : cappedVials);
  const status: PotionCarryRecommendationStatus = matched
    ? "matched"
    : currentCarry < (singleDose ? cappedDoses : cappedVials)
      ? "under"
      : "over";
  const warnings =
    rawDoses > MAX_RECOMMENDED_POTION_DOSES
      ? [
          `Recommendation capped at ${MAX_RECOMMENDED_POTION_DOSES} doses (${MAX_RECOMMENDED_POTION_VIALS} vials) per potion type.`
        ]
      : [];

  return {
    active: true,
    status,
    canApply: !matched,
    recommendedVials: cappedVials,
    recommendedDoses: cappedDoses,
    tripMinutes,
    repotIntervalMinutes,
    matched,
    reason: `Based on ${Math.round(tripMinutes)} minutes of active fighting and the shortest selected repot interval.`,
    warnings
  };
}

const PRAYER_XP_PER_BONE: Record<string, number> = {
  bones: 4.5,
  "big bones": 15,
  "dragon bones": 72,
  "babydragon bones": 30,
  "jogre bones": 15,
  "monkey bones": 5,
  "wolf bones": 4.5
};

const OVERHEAD_OVERRIDE: Record<EntityId, number> = {
  blue_dragon: 4,
  green_dragon: 4,
  red_dragon: 4,
  pirate: 0.5,
  magicaxe: 0.5,
  ghoul: 0.5,
  earth_warrior: 1,
  ice_warrior: 1,
  rock_crab: 1,
  hellhound: 4,
  thug: 2,
  chaos_druid: 2,
  elf_warrior_90: 3.5,
  elf_warrior_108: 3.5
};

const SKIP_DEFAULTS = new Set([
  "jug of wine",
  "spinach roll",
  "knife",
  "ashes",
  "pineapple",
  "thread",
  "staff",
  "tin ore",
  "copper ore",
  "tinderbox",
  "fishing bait",
  "goblin armour",
  "vial (empty)",
  "vial",
  "druid robe top",
  "druid robe bottom",
  "black robe",
  "black wizard hat",
  "blue wizard hat",
  "grain",
  "fur",
  "raw bear meat",
  "chefs hat",
  "eye patch",
  "bronze bar",
  "wizard robe",
  "raw beef",
  "raw chicken",
  "brass necklace",
  "beer",
  "cabbage",
  "banana",
  "cheese",
  "tomato",
  "half apple pie",
  "pot of flour",
  "flier",
  "ring mould",
  "amulet mould",
  "muddy key",
  "black cape",
  "red cape",
  "blue cape",
  "yellow cape",
  "green cape",
  "purple cape",
  "orange cape",
  "pink cape",
  "white cape",
  "bronze javelin",
  "iron javelin",
  "black javelin",
  "steel javelin",
  "mithril javelin",
  "adamant javelin",
  "bolt",
  "bolts",
  "bronze bolts",
  "iron bolts",
  "steel bolts",
  "lobster pot",
  "raw herring",
  "raw sardine",
  "harpoon",
  "raw tuna",
  "raw lobster",
  "oyster pearls",
  "oyster pearl",
  "opal bolt tips",
  "seaweed"
]);

const SKIP_DEFAULT_ITEM_IDS = new Set(["druidrobetop", "druidrobebottom", "opal_bolttips"]);

const BURY_DEFAULTS = new Set([
  "big bones",
  "jogre bones",
  "ogre bones",
  "bones",
  "burnt bones",
  "wolf bones",
  "babydragon bones"
]);

const ALCH_DEFAULTS = new Set([
  "staff of earth",
  "staff of fire",
  "staff of air",
  "staff of water"
]);

const FOOD_DEFAULTS = new Set([
  "trout",
  "salmon",
  "tuna",
  "bass",
  "lobster",
  "swordfish",
  "shark",
  "herring",
  "sardine",
  "mackerel",
  "cod",
  "pike",
  "anchovies",
  "shrimps",
  "cooked meat",
  "cooked chicken",
  "bread",
  "cake",
  "stew",
  "raw bass",
  "raw tuna",
  "raw lobster",
  "raw swordfish",
  "raw shark",
  "raw herring",
  "raw sardine",
  "raw salmon",
  "raw trout"
]);

const TIER_PREFIXES = ["bronze", "iron", "black", "steel", "mithril", "adamant"];
const RUNE_ALCH_WEAPONS = new Set([
  "rune dagger",
  "rune warhammer",
  "rune mace",
  "rune spear",
  "rune battleaxe",
  "rune longsword",
  "rune sword"
]);
const EQUIP_SUFFIXES = [
  "dagger",
  "sword",
  "longsword",
  "scimitar",
  "2h sword",
  "battleaxe",
  "axe",
  "mace",
  "warhammer",
  "hammer",
  "spear",
  "halberd",
  "claws",
  "hatchet",
  "pickaxe",
  "full helm",
  "med helm",
  "helm",
  "platebody",
  "platelegs",
  "plateskirt",
  "chainbody",
  "chainmail",
  "sq shield",
  "square shield",
  "kiteshield",
  "boots",
  "gauntlets",
  "gloves"
];

const HERB_TABLE = [
  { name: "Guam", weight: 32, keys: ["herb_guam", "guam_leaf", "unidentified_guam"], fallback: 15 },
  {
    name: "Marrentill",
    weight: 24,
    keys: ["herb_marrentill", "marentill", "unidentified_guam"],
    fallback: 12
  },
  { name: "Tarromin", weight: 18, keys: ["herb_tarromin", "unidentified_guam"], fallback: 25 },
  {
    name: "Harralander",
    weight: 14,
    keys: ["herb_harralander", "unidentified_guam"],
    fallback: 45
  },
  { name: "Ranarr", weight: 11, keys: ["herb_ranarr", "unidentified_guam"], fallback: 5000 },
  { name: "Irit", weight: 8, keys: ["herb_irit", "unidentified_guam"], fallback: 80 },
  { name: "Avantoe", weight: 6, keys: ["herb_avantoe", "unidentified_guam"], fallback: 1500 },
  { name: "Kwuarm", weight: 5, keys: ["herb_kwuarm", "unidentified_guam"], fallback: 1200 },
  { name: "Cadantine", weight: 4, keys: ["herb_cadantine", "unidentified_guam"], fallback: 1500 },
  { name: "Lantadyme", weight: 3, keys: ["herb_lantadyme", "unidentified_guam"], fallback: 1800 },
  { name: "Dwarf weed", weight: 3, keys: ["herb_dwarf_weed", "unidentified_guam"], fallback: 2000 }
];

const JEWEL_BANDS = [
  { name: "Uncut sapphire", lo: 0, hi: 32, keys: ["uncut_sapphire", "sapphire"], fallback: 450 },
  { name: "Uncut emerald", lo: 32, hi: 48, keys: ["uncut_emerald", "emerald"], fallback: 680 },
  { name: "Uncut ruby", lo: 48, hi: 56, keys: ["uncut_ruby", "ruby"], fallback: 1050 },
  { name: "Uncut diamond", lo: 56, hi: 58, keys: ["uncut_diamond", "diamond"], fallback: 2200 },
  { name: "Rune javelin x5", lo: 58, hi: 59, keys: ["rune_javelin"], fallback: 150, qty: 5 },
  { name: "Half key (tooth)", lo: 59, hi: 60, keys: ["tooth_half_key"], fallback: 110000 },
  { name: "Half key (loop)", lo: 60, hi: 61, keys: ["loop_half_key"], fallback: 81200 }
];

const MEGA_TABLE = [
  { keys: ["rune_spear"], fallback: 30000, weight: 8 },
  { keys: ["dragonshield_a"], fallback: 50000, weight: 4 },
  { keys: ["dragon_spear"], fallback: 39000, weight: 3 }
];

function asNumeric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function priceFromKeys(
  priceSet: PriceSet,
  keys: readonly EntityId[],
  fallback = 0,
  qty = 1,
  warnings?: SimulationWarning[],
  label?: string
): number {
  const requestedKey = keys[0];
  const canonicalKey = requestedKey
    ? resolveCanonicalItemId(requestedKey).canonicalItemId
    : undefined;
  const lookupKeys = canonicalKey
    ? [
        canonicalKey,
        ...aliasesForCanonicalItemId(canonicalKey),
        ...keys.filter((key) => key !== canonicalKey)
      ]
    : keys;

  for (const key of new Set(lookupKeys)) {
    const price = priceSet.itemPrices[key];
    if (asNumeric(price) !== undefined) {
      if (warnings && key !== canonicalKey && canonicalKey) {
        addWarningOnce(warnings, {
          code: "price-alias-used",
          severity: "info",
          message: `Using alias price '${key}' for ${label ?? canonicalKey}; canonical price '${canonicalKey}' is missing.`
        });
      }
      return price * qty;
    }
  }
  if (warnings && canonicalKey) {
    addWarningOnce(warnings, {
      code: "price-fallback-used",
      severity: "warning",
      message: `Missing price '${canonicalKey}' for ${label ?? canonicalKey}; using fallback ${fallback}.`
    });
  }
  return fallback * qty;
}

function addPriceAliasWarning(
  warnings: SimulationWarning[] | undefined,
  lookup: ReturnType<typeof lookupItemPrice>,
  label: string
): void {
  if (
    !warnings ||
    lookup.lookupSource !== "alias" ||
    !lookup.aliasItemId ||
    !lookup.canonicalItemId
  ) {
    return;
  }
  addWarningOnce(warnings, {
    code: "price-alias-used",
    severity: "info",
    message: `Using alias price '${lookup.aliasItemId}' for ${label}; canonical price '${lookup.canonicalItemId}' is missing.`
  });
}

function itemPrice(priceSet: PriceSet, itemId: EntityId): number | undefined {
  return lookupItemPrice(priceSet, itemId).value ?? undefined;
}

function addWarningOnce(warnings: SimulationWarning[], warning: SimulationWarning): void {
  if (
    warnings.some(
      (existing) => existing.code === warning.code && existing.message === warning.message
    )
  ) {
    return;
  }
  warnings.push(warning);
}

function priceOrFallback(
  priceSet: PriceSet,
  itemId: EntityId | null | undefined,
  fallback: number,
  warnings: SimulationWarning[],
  label: string
): number {
  if (!itemId) return fallback;
  const lookup = lookupItemPrice(priceSet, itemId);
  if (lookup.value !== null) {
    addPriceAliasWarning(warnings, lookup, label);
    return lookup.value;
  }
  addWarningOnce(warnings, {
    code: "price-fallback-used",
    severity: "warning",
    message: `Missing price '${lookup.canonicalItemId ?? itemId}' for ${label}; using fallback ${fallback}.`
  });
  return fallback;
}

function itemApproximationWarning(
  gameData: GameDataSnapshot,
  itemId: EntityId | undefined,
  warnings: SimulationWarning[]
): void {
  if (!itemId) return;
  const source = gameData.items[itemId]?.provenance?.source;
  if (source === "approximation" || source === "hypothetical") {
    addWarningOnce(warnings, {
      code: "approximate-data-source",
      severity: "info",
      message: `Item '${itemId}' uses ${source} provenance.`
    });
  }
}

export function bankSecondsFor(monsterId: EntityId | undefined): number {
  return monsterId ? (BANK_PRESETS[monsterId] ?? 150) : 150;
}

export function normalizeLootName(name: string): string {
  return String(name)
    .toLowerCase()
    .replace(/\s*[x×]\s*\d+/g, "")
    .replace(/['']/g, "")
    .replace(/\s*\((\d+)\)/g, " ($1)")
    .replace(/\(noted\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stableLootPart(value: string): string {
  return (
    normalizeLootName(value)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "drop"
  );
}

export function lootPreferenceKey(
  drop: Pick<DropDefinition, "key" | "name" | "tag">,
  rowIndex: number
): string {
  const source = drop.key
    ? `key_${drop.key}`
    : drop.tag
      ? `tag_${drop.tag}_${drop.name}`
      : drop.name;
  return `${stableLootPart(source)}_${Math.max(0, rowIndex)}`;
}

export function lootPreferenceKeysForMonster(monster: MonsterDefinition): string[] {
  return flattenLoot(monster.loot).map((drop, index) => lootPreferenceKey(drop, index));
}

export function isStackable(key?: EntityId | null, name?: string | null): boolean {
  const normalizedKey = String(key || "").toLowerCase();
  const normalizedName = String(name || "").toLowerCase();
  if (/rune$/.test(normalizedKey) || normalizedKey === "coins") return true;
  if (/(arrow|bolt|dart|javelin|knife|feather|bait|ashes|token)/.test(normalizedKey)) return true;
  if (/\b(coins|arrow|bolt|dart|javelin)\b/.test(normalizedName)) return true;
  if (/\w+\s+runes?\b/.test(normalizedName)) return true;
  return false;
}

export function bonePrayerXp(name: string | undefined): number {
  if (!name) return 0;
  return PRAYER_XP_PER_BONE[String(name).toLowerCase()] ?? 0;
}

export function isTierEquipment(normalizedName: string): boolean {
  if (!TIER_PREFIXES.some((prefix) => normalizedName.startsWith(`${prefix} `))) return false;
  return EQUIP_SUFFIXES.some((suffix) => normalizedName.endsWith(suffix));
}

export function isBulkUnsellable(name: string): boolean {
  const normalizedName = normalizeLootName(name);
  return isTierEquipment(normalizedName) || RUNE_ALCH_WEAPONS.has(normalizedName);
}

export function alchForName(name: string, priceSet: PriceSet): number {
  const normalizedName = normalizeLootName(name);
  const key = normalizedName.replace(/ /g, "_");
  return priceSet.alchValues[key] ?? 0;
}

export function defaultLootAction(drop: DropDefinition, priceSet: PriceSet): LootAction | null {
  const normalizedName = normalizeLootName(drop.name);
  if (BURY_DEFAULTS.has(normalizedName)) return "bury";
  if (drop.key && SKIP_DEFAULT_ITEM_IDS.has(drop.key)) return "skip";
  if (SKIP_DEFAULTS.has(normalizedName)) return "skip";
  if (FOOD_DEFAULTS.has(normalizedName)) return "skip";
  if (ALCH_DEFAULTS.has(normalizedName)) return "alch";
  if (RUNE_ALCH_WEAPONS.has(normalizedName)) {
    const alchValue = alchForName(drop.name, priceSet) || drop.alchValue || 0;
    return alchValue >= 350 ? "alch" : "skip";
  }
  if (isTierEquipment(normalizedName)) {
    const alchValue = alchForName(drop.name, priceSet) || drop.alchValue || 0;
    return alchValue >= 350 ? "alch" : "skip";
  }
  if (!drop.tag && drop.price != null && !isStackable(drop.key, drop.name) && drop.price < 350) {
    return "skip";
  }
  return null;
}

function flattenLoot(entries: readonly DropEntry[] | undefined): DropDefinition[] {
  const out: DropDefinition[] = [];
  for (const entry of entries ?? []) {
    if (Array.isArray(entry)) {
      out.push(...entry);
    } else {
      out.push(entry);
    }
  }
  return out;
}

function herbStats(priceSet: PriceSet, warnings?: SimulationWarning[]) {
  const rows = HERB_TABLE.map((row) => ({
    ...row,
    price: priceFromKeys(priceSet, row.keys, row.fallback, 1, warnings, `${row.name} herb`)
  }));
  const ev = rows.reduce((sum, row) => sum + row.weight * row.price, 0) / 128;
  const highEv =
    rows.reduce((sum, row) => sum + (row.price > VALUE_THRESHOLD ? row.weight * row.price : 0), 0) /
    128;
  const keepFrac =
    rows.reduce((sum, row) => sum + (row.price > VALUE_THRESHOLD ? row.weight : 0), 0) / 128;
  return { ev, highEv, keepFrac, rows };
}

function megaEv(priceSet: PriceSet, warnings?: SimulationWarning[]): number {
  return (
    MEGA_TABLE.reduce(
      (sum, row) =>
        sum +
        row.weight *
          priceFromKeys(priceSet, row.keys, row.fallback, 1, warnings, "mega-rare table"),
      0
    ) / 128
  );
}

function jewelStats(
  priceSet: PriceSet,
  spot: JewelSpot,
  legendsComplete: boolean,
  warnings?: SimulationWarning[]
) {
  const mega = megaEv(priceSet, warnings);
  const talisman =
    spot === "overground"
      ? { name: "Nature talisman", key: "nature_talisman", fallback: 15000 }
      : { name: "Chaos talisman", key: "chaos_talisman", fallback: 500 };
  const rows = [
    ...JEWEL_BANDS.map((band) => ({
      ...band,
      price: priceFromKeys(
        priceSet,
        band.keys,
        band.fallback,
        band.qty ?? 1,
        warnings,
        `${band.name} jewel table`
      )
    })),
    {
      name: talisman.name,
      lo: legendsComplete ? 62 : 61,
      hi: 65,
      price: priceFromKeys(priceSet, [talisman.key], talisman.fallback, 1, warnings, talisman.name)
    },
    ...(legendsComplete
      ? [
          {
            name: "Mega-rare (Legends)",
            lo: 61,
            hi: 62,
            price: mega
          }
        ]
      : [])
  ];
  const ev = (denom: number) =>
    rows.reduce(
      (sum, row) => sum + (Math.max(0, Math.min(row.hi, denom) - row.lo) / denom) * row.price,
      0
    );
  const highEv = (denom: number) =>
    rows.reduce(
      (sum, row) =>
        sum +
        (row.price > VALUE_THRESHOLD
          ? (Math.max(0, Math.min(row.hi, denom) - row.lo) / denom) * row.price
          : 0),
      0
    );
  const keepFrac = (denom: number) =>
    rows.reduce(
      (sum, row) =>
        sum +
        (row.price > VALUE_THRESHOLD ? Math.max(0, Math.min(row.hi, denom) - row.lo) / denom : 0),
      0
    );
  return {
    baseEv: ev(128),
    rowEv: ev(65),
    baseHighEv: highEv(128),
    rowHighEv: highEv(65),
    baseKeepFrac: keepFrac(128),
    rowKeepFrac: keepFrac(65),
    mega,
    rows
  };
}

function ultraRareEv(
  priceSet: PriceSet,
  jewelBaseEv: number,
  mega: number,
  warnings?: SimulationWarning[]
): number {
  const rows = [
    {
      weight: 3,
      price: priceFromKeys(priceSet, ["naturerune"], 180, 67, warnings, "ultra-rare table")
    },
    {
      weight: 2,
      price: priceFromKeys(priceSet, ["adamant_javelin"], 50, 20, warnings, "ultra-rare table")
    },
    {
      weight: 2,
      price: priceFromKeys(priceSet, ["deathrune"], 200, 45, warnings, "ultra-rare table")
    },
    {
      weight: 2,
      price: priceFromKeys(priceSet, ["lawrune"], 240, 45, warnings, "ultra-rare table")
    },
    {
      weight: 2,
      price: priceFromKeys(priceSet, ["rune_arrow"], 160, 42, warnings, "ultra-rare table")
    },
    {
      weight: 2,
      price: priceFromKeys(priceSet, ["steel_arrow"], 18, 150, warnings, "ultra-rare table")
    },
    {
      weight: 3,
      price: priceFromKeys(priceSet, ["rune_2h"], 38000, 1, warnings, "ultra-rare table")
    },
    {
      weight: 3,
      price: priceFromKeys(priceSet, ["rune_battleaxe"], 25000, 1, warnings, "ultra-rare table")
    },
    {
      weight: 2,
      price: priceFromKeys(priceSet, ["rune_sq_shield"], 21000, 1, warnings, "ultra-rare table")
    },
    {
      weight: 1,
      price: priceFromKeys(priceSet, ["dragon_med_helm"], 60000, 1, warnings, "ultra-rare table")
    },
    {
      weight: 1,
      price: priceFromKeys(priceSet, ["rune_kiteshield"], 32000, 1, warnings, "ultra-rare table")
    },
    { weight: 21, price: 3000 },
    {
      weight: 20,
      price: priceFromKeys(priceSet, ["tooth_half_key"], 110000, 1, warnings, "ultra-rare table")
    },
    {
      weight: 20,
      price: priceFromKeys(priceSet, ["loop_half_key"], 81200, 1, warnings, "ultra-rare table")
    },
    {
      weight: 5,
      price: priceFromKeys(priceSet, ["runite_bar"], 6500, 1, warnings, "ultra-rare table")
    },
    {
      weight: 2,
      price: priceFromKeys(priceSet, ["dragonstone"], 16000, 1, warnings, "ultra-rare table")
    },
    {
      weight: 2,
      price: priceFromKeys(priceSet, ["silver_ore"], 62, 100, warnings, "ultra-rare table")
    },
    { weight: 20, price: jewelBaseEv },
    { weight: 15, price: mega }
  ];
  return rows.reduce((sum, row) => sum + row.weight * row.price, 0) / 128;
}

function adjustDropPrices(
  drop: DropDefinition,
  priceSet: PriceSet,
  options: LootContextOptions,
  warnings?: SimulationWarning[]
): DropDefinition {
  if (drop.tag === "gem") {
    const jewels = jewelStats(
      priceSet,
      options.jewelSpot ?? "underground",
      options.legendsComplete !== false,
      warnings
    );
    return {
      ...drop,
      price: options.ringOfWealth ? jewels.rowEv : jewels.baseEv,
      _expand:
        drop._expand ??
        jewels.rows.map((row) => ({
          name: row.name,
          weight: Math.max(0, row.hi - row.lo),
          price: row.price,
          talisman: row.name.endsWith("talisman"),
          mega: row.name.startsWith("Mega-rare")
        }))
    };
  }
  if (drop.tag === "herb") {
    const herbs = herbStats(priceSet, warnings);
    return {
      ...drop,
      price: herbs.ev,
      _expand:
        drop._expand ??
        herbs.rows.map((row) => ({ name: row.name, weight: row.weight, price: row.price }))
    };
  }
  if (drop.tag === "ultrarare") {
    const jewels = jewelStats(
      priceSet,
      options.jewelSpot ?? "underground",
      options.legendsComplete !== false,
      warnings
    );
    return { ...drop, price: ultraRareEv(priceSet, jewels.baseEv, jewels.mega, warnings) };
  }
  if (drop.tag === "mega") {
    const jewels = jewelStats(
      priceSet,
      options.jewelSpot ?? "underground",
      options.legendsComplete !== false,
      warnings
    );
    return { ...drop, price: jewels.mega };
  }
  return drop;
}

export function defaultOverhead(monster: MonsterDefinition): number {
  if (OVERHEAD_OVERRIDE[monster.id] != null) return OVERHEAD_OVERRIDE[monster.id];
  let guaranteedPickups = 0;
  let tableChance = 0;
  for (const drop of monster.loot ?? []) {
    if (Array.isArray(drop)) {
      for (const entry of drop) tableChance += entry.chance || 0;
      continue;
    }
    const chance = drop.chance || 0;
    if (chance >= 1) {
      if (bonePrayerXp(drop.name) === 0) guaranteedPickups += 1;
    } else {
      tableChance += chance;
    }
  }
  const value = 2 + Math.min(1, guaranteedPickups) + Math.min(1, tableChance * 0.5);
  return Math.max(2, Math.min(4, Math.round(value * 2) / 2));
}

interface CannonComputationInput {
  settings?: CannonSettings | null;
  monster: MonsterDefinition;
  priceSet: PriceSet;
  combat: CombatSimulationResult;
  playerDps: number;
  hpEffective: number;
  overheadSec: number;
  baseTtkSec: number;
  baseCycleSec: number;
  baseKillsPerHour: number;
  baseCombatXpDamageFraction: number;
  warnings: SimulationWarning[];
}

interface CannonComputationResult {
  cannon: CannonOverlayResult | null;
  ttkSec: number;
  cycleSec: number;
  killsPerHour: number;
  playerAttackTimeSecPerKill: number;
  combatXpDamageFraction: number;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = asNumeric(value);
  if (numeric === undefined) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function monsterNumber(monster: MonsterDefinition, key: string): number | undefined {
  return asNumeric((monster as unknown as Record<string, unknown>)[key]);
}

function computeScarceSpot(
  trip: TripPolicy,
  monster: MonsterDefinition,
  cycleSec: number
): TripScarceSpotResult {
  const monsterRespawnSec = Math.max(
    1,
    Math.round(monsterNumber(monster, "respawn") ?? DEFAULT_RESPAWN_SEC)
  );
  const targetsAtSpot = Math.round(
    boundedNumber(trip.targetsAtSpot, DEFAULT_SCARCE_TARGETS, 1, 64)
  );
  const respawnSeconds =
    trip.respawnSeconds == null
      ? monsterRespawnSec
      : Math.round(boundedNumber(trip.respawnSeconds, monsterRespawnSec, 1, 3600));
  const spawnCycleSec = respawnSeconds / targetsAtSpot;
  const maxKph = spawnCycleSec > 0 ? 3600 / spawnCycleSec : Infinity;
  const enabled = trip.scarceSpot === true;

  return {
    enabled,
    targetsAtSpot,
    respawnSeconds,
    spawnCycleSec,
    maxKph,
    respawnBound: enabled && spawnCycleSec > cycleSec + 1e-9
  };
}

export function computeCannonOverlay(input: CannonComputationInput): CannonComputationResult {
  const base = {
    cannon: null,
    ttkSec: input.baseTtkSec,
    cycleSec: input.baseCycleSec,
    killsPerHour: input.baseKillsPerHour,
    playerAttackTimeSecPerKill: input.baseTtkSec,
    combatXpDamageFraction: input.baseCombatXpDamageFraction
  };
  if (!input.settings?.enabled || input.playerDps <= 0 || input.hpEffective <= 0) {
    return base;
  }

  const targets = Math.round(boundedNumber(input.settings.targets, 3, 1, 8));
  const monsterRespawnSec = monsterNumber(input.monster, "respawn") ?? 60;
  const respawnSec =
    input.settings.respawnSec == null
      ? Math.max(1, monsterRespawnSec)
      : boundedNumber(input.settings.respawnSec, monsterRespawnSec, 1, 3600);
  const totalSpawns = targets;
  const ballMax = Math.min(30, monsterNumber(input.monster, "cannonMax") ?? 30);
  const averageBallDamage = ballMax / 2;
  const octantCap = Math.min(8, targets);
  const cannonDamagePerSecondPerTarget =
    octantCap > 0 ? (input.combat.hitChance * averageBallDamage) / (8 * TICK_SECONDS) : 0;
  const ballPrice = priceOrFallback(
    input.priceSet,
    CANNONBALL_PRICE_KEY,
    CANNONBALL_FALLBACK_PRICE,
    input.warnings,
    "cannonballs"
  );

  let effectiveTargets =
    cannonDamagePerSecondPerTarget > 0
      ? (totalSpawns - (respawnSec * input.playerDps) / input.hpEffective) /
        (1 + (respawnSec * cannonDamagePerSecondPerTarget) / input.hpEffective)
      : totalSpawns - (respawnSec * input.playerDps) / input.hpEffective;
  let ballsPerSec = 0;
  let cannonDps = 0;
  let killRate: number;
  let activeFrac: number;

  if (effectiveTargets < 0) {
    effectiveTargets = 0;
    killRate = input.playerDps / input.hpEffective;
    activeFrac = 1;
  } else if (effectiveTargets <= octantCap) {
    ballsPerSec = effectiveTargets / (8 * TICK_SECONDS);
    cannonDps = ballsPerSec * input.combat.hitChance * averageBallDamage;
    killRate = (input.playerDps + cannonDps) / input.hpEffective;
    activeFrac = 1;
  } else {
    ballsPerSec = octantCap / (8 * TICK_SECONDS);
    cannonDps = ballsPerSec * input.combat.hitChance * averageBallDamage;
    killRate = (input.playerDps + cannonDps) / input.hpEffective;
    effectiveTargets = totalSpawns - killRate * respawnSec;
    if (effectiveTargets < 0) {
      killRate = totalSpawns / respawnSec;
      const totalDps = killRate * input.hpEffective;
      const playerContribution = Math.min(input.playerDps, totalDps);
      cannonDps = Math.max(0, totalDps - playerContribution);
      ballsPerSec =
        input.combat.hitChance * averageBallDamage > 0
          ? cannonDps / (input.combat.hitChance * averageBallDamage)
          : 0;
      activeFrac = input.playerDps > 0 ? playerContribution / input.playerDps : 0;
      effectiveTargets = 0;
    } else {
      activeFrac = 1;
    }
  }

  const ttkSec = killRate > 0 ? 1 / killRate : input.baseTtkSec;
  const cycleSec = ttkSec + input.overheadSec;
  const killsPerHour = 3600 / cycleSec;
  const ballsPerHour = ballsPerSec * 3600;
  const ballsPerKill = killRate > 0 ? ballsPerSec / killRate : 0;
  const playerXpDamagePerKill = (input.combat.effectiveDps * activeFrac) / Math.max(1e-9, killRate);
  const combatXpDamageFraction =
    input.monster.hp > 0
      ? Math.min(1, playerXpDamagePerKill / input.monster.hp)
      : input.baseCombatXpDamageFraction;

  const cannon: CannonOverlayResult = {
    enabled: true,
    targets,
    respawnSec,
    effTargets: Math.max(0, Math.min(effectiveTargets, totalSpawns)),
    maxBall: ballMax,
    ballsPerSec,
    ballsPerHour,
    ballsPerKill,
    ballPrice,
    ballCostPerKill: ballsPerKill * ballPrice,
    ballCostPerHour: ballsPerHour * ballPrice,
    cannonDps,
    cannonDmgPerHour: cannonDps * 3600,
    rangedXpPerHour: 2 * cannonDps * 3600,
    playerDps: input.playerDps,
    activeFrac,
    kphNoCannon: input.baseKillsPerHour,
    kphWithCannon: killsPerHour,
    respawnBound: ballsPerSec > 0 && activeFrac < 0.999,
    idle: ballsPerSec === 0
  };

  return {
    cannon,
    ttkSec,
    cycleSec,
    killsPerHour,
    playerAttackTimeSecPerKill: activeFrac * ttkSec,
    combatXpDamageFraction
  };
}

export function evaluateLoot(
  monster: MonsterDefinition,
  context: SimulationContext,
  options: LootContextOptions = {}
): LootEvaluation {
  const warnings: SimulationWarning[] = [];
  const priceSet = context.priceSet;
  const lootPrefs = options.lootPrefs ?? {};
  const alchAllowed = !!options.alching;
  const natCost = itemPrice(priceSet, "naturerune") ?? NATURE_RUNE_FALLBACK;
  const herbUnidGp = itemPrice(priceSet, "unidentified_guam") ?? 15;
  let cachedHerbs: ReturnType<typeof herbStats> | undefined;
  let cachedJewels: ReturnType<typeof jewelStats> | undefined;
  const getHerbs = () => {
    cachedHerbs ??= herbStats(priceSet, warnings);
    return cachedHerbs;
  };
  const getJewels = () => {
    cachedJewels ??= jewelStats(
      priceSet,
      options.jewelSpot ?? "underground",
      options.legendsComplete !== false,
      warnings
    );
    return cachedJewels;
  };
  let gpPerKill = 0;
  let prayerXpPerKill = 0;
  let alchCastsPerKill = 0;
  const lootBreakdown: LootBreakdownEntry[] = [];

  for (const [rowIndex, rawDrop] of flattenLoot(monster.loot).entries()) {
    const rowId = lootPreferenceKey(rawDrop, rowIndex);
    const drop = adjustDropPrices(rawDrop, priceSet, options, warnings);
    const isBone = bonePrayerXp(drop.name) > 0;
    const isHerb = drop.tag === "herb";
    itemApproximationWarning(context.gameData, drop.key, warnings);
    const livePriceLookup = drop.key ? lookupItemPrice(priceSet, drop.key) : null;
    const livePrice = livePriceLookup?.value ?? drop.price ?? 0;
    if (livePriceLookup && livePriceLookup.value !== null) {
      addPriceAliasWarning(warnings, livePriceLookup, drop.name);
    } else if (drop.key && drop.price == null) {
      const missingItemId = livePriceLookup?.warning?.itemId ?? drop.key;
      addWarningOnce(warnings, {
        code: "missing-price",
        severity: "warning",
        message:
          missingItemId === drop.key
            ? `Missing price for loot item '${drop.key}'.`
            : `Missing price for loot item '${drop.key}' via canonical '${missingItemId}'.`
      });
    }
    const bulkDead = isBulkUnsellable(drop.name);
    const saleValue = bulkDead ? 0 : livePrice;
    const dropAlch =
      drop.key && priceSet.alchValues[drop.key] != null
        ? priceSet.alchValues[drop.key]
        : (drop.alchValue ?? priceSet.alchValues[drop.name] ?? 0);
    const alchProfit = Math.max(0, dropAlch - natCost);
    const noMarketPrice = !saleValue || saleValue <= 0;
    const gdDefault = defaultLootAction(
      { ...drop, price: livePrice, alchValue: dropAlch },
      priceSet
    );
    const isCoins = drop.key === "coins" || /^coins$/i.test(drop.name);
    const rawPref = lootPrefs[rowId] ?? lootPrefs[drop.name];
    const defaultPref =
      rawPref !== undefined
        ? rawPref
        : isCoins && alchAllowed
          ? "loot"
          : gdDefault !== null && gdDefault !== undefined
            ? gdDefault
            : isBone && /dragon/i.test(drop.name)
              ? "loot"
              : isBone
                ? "bury"
                : noMarketPrice && alchProfit > 0
                  ? "alch"
                  : "loot";
    let pref = isLootAction(defaultPref) ? defaultPref : "loot";
    if (pref === "alch" && !alchAllowed) pref = "loot";
    if (pref === "alch" && dropAlch - natCost <= 0) pref = "loot";

    let unitGp: number;
    if (pref === "skip" || pref === "bury") unitGp = 0;
    else if (pref === "unid") unitGp = isHerb ? herbUnidGp : saleValue;
    else if (pref === "value") {
      unitGp = isHerb
        ? getHerbs().highEv
        : drop.tag === "gem"
          ? options.ringOfWealth
            ? getJewels().rowHighEv
            : getJewels().baseHighEv
          : saleValue;
    } else if (pref === "alch") unitGp = Math.max(0, dropAlch - natCost);
    else unitGp = bulkDead ? Math.max(0, dropAlch - natCost) : saleValue;

    const evGp = drop.chance * drop.qtyAvg * unitGp;
    gpPerKill += evGp;

    let slotFrac = 1;
    if (pref === "value") {
      if (isHerb) slotFrac = getHerbs().keepFrac;
      else if (drop.tag === "gem") {
        slotFrac = options.ringOfWealth ? getJewels().rowKeepFrac : getJewels().baseKeepFrac;
      }
    }
    if (pref === "alch") alchCastsPerKill += drop.chance * drop.qtyAvg;
    if (pref === "bury" && isBone) {
      prayerXpPerKill += drop.chance * drop.qtyAvg * bonePrayerXp(drop.name);
    }

    lootBreakdown.push({
      ...drop,
      rowId,
      price: livePrice,
      saleValue,
      evGp,
      pref,
      isBone,
      isHerb,
      slotFrac,
      prayerXp: isBone ? bonePrayerXp(drop.name) : 0,
      alchValue: dropAlch,
      bulkDead
    });
  }

  return {
    gpPerKill,
    prayerXpPerKill,
    alchCastsPerKill,
    alchTimePerKill: alchCastsPerKill * 3,
    lootBreakdown,
    warnings
  };
}

function isLootAction(value: unknown): value is LootAction {
  return (
    value === "skip" ||
    value === "bury" ||
    value === "alch" ||
    value === "loot" ||
    value === "unid" ||
    value === "value"
  );
}

function combinePrayerData(keys: readonly EntityId[]): PrayerData {
  let def = 1;
  let drain = 0;
  for (const key of keys) {
    const prayer = PRAYERS[key];
    if (!prayer || key === "none") continue;
    def = Math.max(def, prayer.def);
    drain += prayer.drain;
  }
  return { def, drain };
}

function isDbaSelected(request: SimulationRequest): boolean {
  return request.combatStyle === "melee" && request.boosts.keys.includes("dba_spec");
}

export function prayerPerKillForCycle(
  request: SimulationRequest,
  context: SimulationContext,
  cycleSec: number,
  trip: TripPolicy = {}
): number {
  const prayer = combinePrayerData(request.prayers.keys);
  const protectOn = !!trip.protect && trip.protect !== "none";
  const drainRate = prayer.drain + (protectOn ? PROTECT_DRAIN : 0);
  const prayerBonus = sumEquipmentBonuses(request.loadout, context.gameData).prayer || 0;
  const drainResistance = 2 * prayerBonus + 60;
  const prayerPointsPerSec = drainRate > 0 ? drainRate / (drainResistance * TICK_SECONDS) : 0;
  return prayerPointsPerSec * cycleSec;
}

export function computeIncomingDamage(
  request: SimulationRequest,
  context: SimulationContext,
  trip: TripPolicy,
  tripContext: Pick<
    TripComputationContext,
    "monster" | "combatStyle" | "ttkSec" | "cycleSec" | "prayerDef"
  >
): IncomingDamageResult {
  const monster = tripContext.monster;
  const monsterRecord = monster as unknown as Record<string, unknown>;
  const atkType = typeof monsterRecord.atkType === "string" ? monsterRecord.atkType : "melee";
  const monsterStrength = monster.strength ?? monster.attack ?? 1;
  const monMax =
    asNumeric(monsterRecord.maxHit) ??
    Math.floor(((monsterStrength + 9) * ((monster.strBonus ?? 0) + 64) + 320) / 640);
  const monsterAttackBonus = monster.attBonus ?? 0;
  const monsterAttackRoll = ((monster.attack ?? 1) + 9) * (monsterAttackBonus + 64);
  const weapon = context.gameData.weapons[request.loadout.weaponId];
  const safespotAuto =
    tripContext.combatStyle === "ranged" ||
    tripContext.combatStyle === "magic" ||
    weapon?.wclass === "halberd";
  const safespot = trip.safespot != null ? !!trip.safespot : safespotAuto;
  const regenPerKill = (tripContext.cycleSec || 0) / 60;

  if (safespot) {
    return {
      hpPerKill: 0,
      netHpPerKill: 0,
      regenPerKill,
      monMax,
      hitChance: 0,
      dragonfire: 0,
      protected: false,
      safespot: true,
      safespotAuto
    };
  }

  const totals = sumEquipmentBonuses(request.loadout, context.gameData);
  const defKey = atkType === "magic" ? "magDef" : atkType === "ranged" ? "rngDef" : "slashDef";
  const playerDefBonus = totals[defKey as keyof typeof totals] || 0;
  const defLevel = request.levels.defence || 1;
  const playerDefRoll = Math.floor(defLevel * tripContext.prayerDef + 9) * (playerDefBonus + 64);
  const protect = trip.protect || "none";
  const protectedByPrayer =
    (protect === "melee" && atkType === "melee") ||
    (protect === "missiles" && atkType === "ranged") ||
    (protect === "magic" && atkType === "magic");
  let monsterHitChance = hitChance(monsterAttackRoll, playerDefRoll);
  if (protectedByPrayer) monsterHitChance = 0;
  const attackInterval = (monster.attackSpeed || 4) * TICK_SECONDS;
  const attacks = (tripContext.ttkSec || 0) / attackInterval;
  let hpPerKill = attacks * monsterHitChance * (monMax / 2);
  let dragonfire = 0;

  if (monsterRecord.dragonfire) {
    const hasAntiShield = request.loadout.gear.shield === "anti_dragon";
    const antifire = !!trip.antifire;
    if (hasAntiShield && antifire) dragonfire = 0;
    else if (hasAntiShield) dragonfire = 3;
    else if (antifire) dragonfire = 4;
    else dragonfire = 20;
    hpPerKill += dragonfire;
  }

  let poison = 0;
  if (monsterRecord.poisons) {
    const onAntipoison = !!monsterRecord.antipoisonFromDrops || !!trip.antipoison;
    poison = onAntipoison ? 0 : (asNumeric(monsterRecord.poisonMax) ?? 5);
    hpPerKill += poison;
  }

  return {
    hpPerKill,
    netHpPerKill: Math.max(0, hpPerKill - regenPerKill),
    regenPerKill,
    monMax,
    hitChance: monsterHitChance,
    dragonfire,
    poison,
    protected: protectedByPrayer,
    safespot: false,
    safespotAuto
  };
}

export function computeTrip(
  request: SimulationRequest,
  context: SimulationContext,
  trip: TripPolicy,
  tripContext: TripComputationContext
): TripResult {
  const monsterRecord = tripContext.monster as unknown as Record<string, unknown>;
  const food = FOOD[trip.foodKey ?? "lobster"] ?? FOOD.lobster;
  const boostKeys = tripContext.boostKeys;
  let potionCats = boostKeys.filter((key) => POTION_CAT[key]).map((key) => POTION_CAT[key]);
  potionCats = [...new Set(potionCats)];
  if (tripContext.dba) potionCats = potionCats.filter((cat) => cat !== "str");
  const potionTypes = potionCats.length;
  const singleDose = !!trip.singleDose;
  const dosesPerVial = singleDose ? 1 : 4;
  const potionSets = Math.max(0, trip.potionSets ?? 1);
  const potionDoses = Math.max(0, trip.potionDoses ?? 4);
  const qtyPerType = singleDose ? potionDoses : potionSets;
  const dosesPerType = singleDose ? potionDoses : potionSets * dosesPerVial;
  let potionSlots = potionTypes * qtyPerType;
  const dbaRestore = tripContext.dba && tripContext.dbaRestore !== false;
  let restoreDoses = 0;
  let restoreLocked = 0;
  if (dbaRestore) {
    restoreDoses = 1;
    if (singleDose) potionSlots += 1;
    else restoreLocked = 1;
  }
  const potionParts: string[] = [];
  if (potionTypes) {
    potionParts.push(
      singleDose ? `${potionTypes}x${potionDoses} dose` : `${potionTypes}x${potionSets} vial`
    );
  }
  if (dbaRestore) potionParts.push("1 restore");

  const antifireOn = !!trip.antifire && !!monsterRecord.dragonfire;
  const antifireSlots = antifireOn ? qtyPerType : 0;
  const antifireDoses = antifireOn ? dosesPerType : 0;
  if (antifireOn) {
    potionSlots += antifireSlots;
    potionParts.push(singleDose ? `${potionDoses} antifire` : `${potionSets} antifire`);
  }

  const antipoisonOn =
    !!trip.antipoison && !!monsterRecord.poisons && !monsterRecord.antipoisonFromDrops;
  const antipoisonSlots = antipoisonOn ? qtyPerType : 0;
  const antipoisonDoses = antipoisonOn ? dosesPerType : 0;
  if (antipoisonOn) {
    potionSlots += antipoisonSlots;
    potionParts.push(singleDose ? `${potionDoses} antipoison` : `${potionSets} antipoison`);
  }

  const prayerPerKill = tripContext.prayerPerKill || 0;
  const prayerDrains = prayerPerKill > 0;
  const prayerMode = trip.prayerMode || (trip.prayerRestore === false ? "none" : "potions");
  const prayerPotionSets = Math.max(0, trip.prayerPotionSets ?? potionSets);
  const prayerPotionDoses = Math.max(0, trip.prayerPotionDoses ?? potionDoses);
  const hasPrayerDoseOverride = trip.prayerPotionDoses != null;
  const prayerQty = hasPrayerDoseOverride
    ? singleDose
      ? prayerPotionDoses
      : Math.ceil(prayerPotionDoses / 4)
    : singleDose
      ? prayerPotionDoses
      : prayerPotionSets;
  const prayerDosesCarried = hasPrayerDoseOverride
    ? prayerPotionDoses
    : singleDose
      ? prayerPotionDoses
      : prayerPotionSets * dosesPerVial;
  const prayerActive = prayerDrains && prayerMode === "potions";
  const prayerPool = Math.max(1, tripContext.prayerLevel || 1);
  let prayerSlots = 0;
  let maxKillsPrayer = Infinity;
  let prayerPointsPerDose = 0;
  if (prayerActive) {
    prayerPointsPerDose = Math.floor((tripContext.prayerLevel || 1) / 4) + 7;
    prayerSlots = prayerQty;
    potionSlots += prayerSlots;
    const prayerPointsCarried = prayerPool + prayerDosesCarried * prayerPointsPerDose;
    maxKillsPrayer = prayerPerKill > 0 ? prayerPointsCarried / prayerPerKill : Infinity;
    potionParts.push(
      hasPrayerDoseOverride
        ? `${prayerPotionDoses} prayer doses`
        : singleDose
          ? `${prayerPotionDoses} prayer`
          : `${prayerPotionSets} prayer`
    );
  }

  const altarOn = prayerDrains && prayerMode === "altar";
  const altarSeconds = trip.altarSeconds != null ? Math.max(0, trip.altarSeconds) : 30;
  const killsPerAltar = altarOn ? prayerPool / prayerPerKill : Infinity;
  const altarSecPerKill = altarOn && killsPerAltar > 0 ? altarSeconds / killsPerAltar : 0;
  const warnings: SimulationWarning[] = [];
  const perDose = (key: EntityId) => {
    const potion = POTION_SUPPLIES[key];
    const price = priceOrFallback(
      context.priceSet,
      potion?.priceKey,
      potion?.fallback ?? 0,
      warnings,
      `${key} dose`
    );
    return price / 4;
  };

  let potionCostPerTrip = 0;
  for (const cat of potionCats) potionCostPerTrip += dosesPerType * perDose(CAT_POTION[cat]);
  if (dbaRestore) potionCostPerTrip += restoreDoses * perDose("restore");
  if (antifireOn) potionCostPerTrip += antifireDoses * perDose("antifire");
  if (antipoisonOn) potionCostPerTrip += antipoisonDoses * perDose("antipoison");

  let reserve = 0;
  const reserveParts: string[] = [];
  if (trip.teleport !== false) {
    reserve += 1;
    reserveParts.push("teleport");
  }
  if (tripContext.dba) {
    reserve += 1;
    reserveParts.push("DBA switch");
  }
  if (
    !tripContext.dba &&
    tripContext.hasSpec &&
    request.specialAttack?.weaponId !== request.loadout.weaponId
  ) {
    reserve += 1;
    reserveParts.push("spec weapon");
  }
  if (restoreLocked) {
    reserve += 1;
    reserveParts.push("restore vial");
  }
  if (trip.alching) {
    reserve += 2;
    reserveParts.push("alch runes");
  }
  if (tripContext.combatStyle === "magic") {
    const runeSlots = trip.runeSlots ?? 2;
    reserve += runeSlots;
    if (runeSlots) reserveParts.push(`${runeSlots} combat-rune`);
  }
  if (tripContext.cannonOn) {
    reserve += 5;
    reserveParts.push("cannon (4 parts)", "cannonballs");
  }

  const recoilDmgPerKill = tripContext.recoilDmgPerKill || 0;
  const recoilOn = !!tripContext.ringRecoil && recoilDmgPerKill > 0;
  let recoilRings = 0;
  let recoilSpares = 0;
  let recoilRingsPerKill = 0;
  let recoilCostPerKill = 0;
  let maxKillsRecoil = Infinity;
  if (recoilOn) {
    recoilRings = Math.max(1, Math.floor(trip.recoilRings ?? 1));
    recoilSpares = recoilRings - 1;
    recoilRingsPerKill = recoilDmgPerKill / 40;
    const ringPrice = priceOrFallback(
      context.priceSet,
      "ring_of_recoil",
      1500,
      warnings,
      "ring of recoil"
    );
    recoilCostPerKill = recoilRingsPerKill * ringPrice;
    maxKillsRecoil = recoilDmgPerKill > 0 ? (recoilRings * 40) / recoilDmgPerKill : Infinity;
  }

  const transientSlots = potionSlots + recoilSpares;
  const incoming = computeIncomingDamage(request, context, trip, tripContext);
  const foodPerKill =
    trip.foodPerKillOverride != null
      ? Math.max(0, trip.foodPerKillOverride)
      : food.heal > 0
        ? incoming.netHpPerKill / food.heal
        : 0;

  const foodHeals = Object.fromEntries(
    Object.values(FOOD)
      .filter((candidate) => candidate.priceKey)
      .map((candidate) => [candidate.priceKey, candidate.heal])
  ) as Record<string, number>;
  const broughtFoodPrice = food.priceKey
    ? priceOrFallback(context.priceSet, food.priceKey, 0, warnings, `${food.name} food`)
    : 0;
  const eatenFood: Record<string, number> = {};
  let nonStackPerKill = 0;
  const stackKeys = new Set<string>();

  for (const drop of tripContext.lootBreakdown) {
    if (drop.pref === "skip" || drop.pref === "bury" || drop.pref === "alch") continue;
    if (!(drop.evGp > 0)) continue;
    const dropHeal = drop.key ? foodHeals[drop.key] : undefined;
    if (dropHeal && foodPerKill > 0 && drop.pref === "loot") {
      const savedPerItem = food.heal > 0 ? (dropHeal / food.heal) * broughtFoodPrice : 0;
      eatenFood[drop.rowId] = drop.chance * drop.qtyAvg * savedPerItem;
      continue;
    }
    if (isStackable(drop.key, drop.name)) {
      if (trip.alching && (drop.key === "coins" || /^coins$/i.test(drop.name))) continue;
      stackKeys.add(drop.key || drop.name);
    } else {
      nonStackPerKill += drop.chance * drop.qtyAvg * (drop.slotFrac ?? 1);
    }
  }

  const stackReserve = stackKeys.size;
  const lootCapacity = Math.max(0, INVENTORY_SIZE - reserve - stackReserve);
  const kInv = nonStackPerKill > 0 ? lootCapacity / nonStackPerKill : Infinity;
  const startSpace = Math.max(0, Math.floor(INVENTORY_SIZE - reserve - transientSlots));
  const potRate = isFinite(kInv) && kInv > 0 ? transientSlots / kInv : 0;
  const netFill = nonStackPerKill - foodPerKill - potRate;
  const cycle = tripContext.cycleSec || 0;
  const bankSeconds =
    trip.bankSeconds != null ? trip.bankSeconds : bankSecondsFor(tripContext.monster.id);

  interface FoodEvalResult {
    killsPerTrip: number;
    bound: TripBound;
    freeAtStart: number;
    lootFraction: number;
    lootSlotsAtEnd: number;
    foodLeftAtEnd: number;
    efficiency: number;
    effectiveKph: number;
    tripMinutes: number;
  }

  function evalFood(foodCount: number): FoodEvalResult {
    const kFood = foodPerKill > 0 ? foodCount / foodPerKill : Infinity;
    const freeAtStart = Math.max(0, lootCapacity - transientSlots - foodCount);
    const kFill = netFill > 0 ? freeAtStart / netFill : Infinity;
    let killsPerTrip: number;
    let bound: TripBound;
    if (foodPerKill > 0) {
      const foodLeftAtFull = isFinite(kFill) ? foodCount - foodPerKill * kFill : Infinity;
      const slack = Math.max(1.5, 0.1 * foodCount);
      if (isFinite(kFill) && kFood >= kFill && foodLeftAtFull <= slack) {
        killsPerTrip = kFill;
        bound = "loot";
      } else if (!isFinite(kFill) || kFood < kFill) {
        killsPerTrip = kFood;
        bound = "food";
      } else {
        killsPerTrip = kFood;
        bound = "overfull";
      }
    } else {
      killsPerTrip = kInv;
      bound = isFinite(kInv) ? "loot" : "none";
    }
    const finiteKills = isFinite(killsPerTrip) ? killsPerTrip : kInv;
    const dropped = isFinite(finiteKills) ? nonStackPerKill * finiteKills : lootCapacity;
    const collected = isFinite(finiteKills)
      ? Math.min(lootCapacity, dropped, freeAtStart + (foodPerKill + potRate) * finiteKills)
      : lootCapacity;
    const lootFraction = dropped > 0 ? Math.min(1, collected / dropped) : 1;
    const foodLeftAtEnd = isFinite(killsPerTrip)
      ? Math.max(0, foodCount - foodPerKill * killsPerTrip)
      : 0;
    let efficiency: number;
    let effectiveKph: number;
    let tripMinutes: number;
    if (!isFinite(killsPerTrip)) {
      if (altarSecPerKill > 0 && cycle > 0) {
        efficiency = cycle / (cycle + altarSecPerKill);
        effectiveKph = tripContext.killsPerHour * efficiency;
      } else {
        efficiency = 1;
        effectiveKph = tripContext.killsPerHour;
      }
      tripMinutes = Infinity;
    } else if (bankSeconds <= 0 && altarSecPerKill <= 0) {
      efficiency = 1;
      effectiveKph = tripContext.killsPerHour;
      tripMinutes = Infinity;
    } else {
      killsPerTrip = Math.max(1, killsPerTrip);
      const killTripTime = killsPerTrip * cycle;
      const altarTime = killsPerTrip * altarSecPerKill;
      const tripTotal = killTripTime + bankSeconds + altarTime;
      efficiency = killTripTime / tripTotal;
      effectiveKph = tripContext.killsPerHour * efficiency;
      tripMinutes = tripTotal / 60;
    }
    return {
      killsPerTrip,
      bound,
      freeAtStart,
      lootFraction,
      lootSlotsAtEnd: collected,
      foodLeftAtEnd,
      efficiency,
      effectiveKph,
      tripMinutes
    };
  }

  let autoFoodCount: number;
  if (foodPerKill <= 0 || startSpace < 1) {
    autoFoodCount = 0;
  } else {
    const estimate = foodPerKill * (isFinite(kInv) ? kInv : 28);
    const high = Math.min(startSpace, Math.ceil(estimate) + 1);
    const low = Math.min(high, Math.max(1, Math.floor(estimate) - 1));
    let best = low;
    let bestScore = -Infinity;
    for (let foodCountCandidate = low; foodCountCandidate <= high; foodCountCandidate += 1) {
      const result = evalFood(foodCountCandidate);
      const score = result.lootFraction * result.efficiency;
      if (score > bestScore + 1e-9) {
        bestScore = score;
        best = foodCountCandidate;
      }
    }
    autoFoodCount = best;
  }

  const foodCount = trip.foodCount != null ? Math.max(0, trip.foodCount) : autoFoodCount;
  let result = evalFood(foodCount);
  const naturalKills = result.killsPerTrip;

  const capTrip = (killsPerTrip: number, bound: TripBound) => {
    const cappedKills = Math.max(1, killsPerTrip);
    const dropped = nonStackPerKill * cappedKills;
    const collected = Math.min(
      lootCapacity,
      dropped,
      result.freeAtStart + (foodPerKill + potRate) * cappedKills
    );
    let efficiency = result.efficiency;
    let effectiveKph = result.effectiveKph;
    let tripMinutes = result.tripMinutes;
    if (bankSeconds > 0 || altarSecPerKill > 0) {
      const killTripTime = cappedKills * cycle;
      const tripTotal = killTripTime + bankSeconds + cappedKills * altarSecPerKill;
      efficiency = killTripTime / tripTotal;
      effectiveKph = tripContext.killsPerHour * efficiency;
      tripMinutes = tripTotal / 60;
    }
    result = {
      ...result,
      killsPerTrip: cappedKills,
      bound,
      lootFraction: dropped > 0 ? Math.min(1, collected / dropped) : 1,
      lootSlotsAtEnd: collected,
      foodLeftAtEnd: Math.max(0, foodCount - foodPerKill * cappedKills),
      efficiency,
      effectiveKph,
      tripMinutes
    };
  };

  if (prayerActive && isFinite(maxKillsPrayer) && maxKillsPrayer < result.killsPerTrip) {
    capTrip(maxKillsPrayer, "prayer");
  }
  if (recoilOn && isFinite(maxKillsRecoil) && maxKillsRecoil < result.killsPerTrip) {
    capTrip(maxKillsRecoil, "recoil");
  }

  const foodPrice = food.priceKey
    ? priceOrFallback(context.priceSet, food.priceKey, 0, warnings, `${food.name} food`)
    : 0;
  const foodCostPerKill = foodPerKill * foodPrice;
  let prayerCostPerKill = 0;
  if (prayerActive && prayerPointsPerDose > 0) {
    if (isFinite(result.killsPerTrip) && result.killsPerTrip > 0) {
      const dosesUsed = Math.max(
        0,
        (prayerPerKill * result.killsPerTrip - prayerPool) / prayerPointsPerDose
      );
      prayerCostPerKill = (dosesUsed * perDose("prayer")) / result.killsPerTrip;
    } else {
      prayerCostPerKill = (prayerPerKill / prayerPointsPerDose) * perDose("prayer");
    }
  }
  const potionCostPerKill =
    (isFinite(result.killsPerTrip) && result.killsPerTrip > 0
      ? potionCostPerTrip / result.killsPerTrip
      : 0) + prayerCostPerKill;

  return {
    killsPerTrip: result.killsPerTrip,
    bound: result.bound,
    efficiency: result.efficiency,
    effectiveKph: result.effectiveKph,
    tripMinutes: result.tripMinutes,
    lootFraction: result.lootFraction,
    foodPerKill,
    foodHeal: food.heal,
    foodPrice,
    foodCostPerKill,
    foodName: food.name,
    potionCostPerKill,
    potionCostPerTrip,
    singleDose,
    dosesPerType,
    prayerActive,
    prayerPerKill,
    prayerCostPerKill,
    prayerSlots,
    prayerPointsPerDose,
    maxKillsPrayer,
    prayerMode,
    prayerDrains,
    prayerPool,
    naturalKills,
    altarOn,
    altarSeconds,
    altarSecPerKill,
    killsPerAltar,
    recoilOn,
    recoilRings,
    recoilSpares,
    recoilRingsPerKill,
    recoilCostPerKill,
    maxKillsRecoil,
    recoilDmgPerKill,
    scarce: tripContext.scarce,
    incoming,
    eatenFood,
    slots: {
      inv: INVENTORY_SIZE,
      reserve,
      reserveParts,
      stackReserve,
      foodCount,
      potionSlots,
      potionTypes,
      potionSets,
      potionDoses,
      singleDose,
      potionParts,
      freeAtStart: result.freeAtStart,
      lootCapacity,
      nonStackPerKill,
      lootSlotsAtEnd: result.lootSlotsAtEnd,
      foodLeftAtEnd: result.foodLeftAtEnd,
      autoFoodCount,
      prayerSlots
    },
    bankSeconds
  };
}

function ammoPrice(ammoId: EntityId, context: SimulationContext): number {
  const ammo = context.gameData.ammo[ammoId];
  if (!ammo) return 0;
  const record = ammo as unknown as Record<string, unknown>;
  const priceKey = typeof record.priceKey === "string" ? record.priceKey : ammoId;
  const live = itemPrice(context.priceSet, priceKey);
  const numericLive = asNumeric(live);
  if (numericLive !== undefined && numericLive > 0) return numericLive;
  const family = typeof record.fam === "string" ? record.fam : null;
  const tier = asNumeric(record.tier);
  if (family === "knife" && typeof record.barKey === "string") {
    const bar = itemPrice(context.priceSet, record.barKey);
    const numericBar = asNumeric(bar);
    if (numericBar !== undefined && numericBar > 0) return Math.round(numericBar / 5);
  }
  if (family && tier !== undefined) {
    const anchors: Array<{ tier: number; price: number }> = [];
    for (const candidate of Object.values(context.gameData.ammo)) {
      const candidateRecord = candidate as unknown as Record<string, unknown>;
      if (candidateRecord.fam !== family) continue;
      const candidateTier = asNumeric(candidateRecord.tier);
      const candidatePriceKey =
        typeof candidateRecord.priceKey === "string" ? candidateRecord.priceKey : undefined;
      const candidatePrice = candidatePriceKey
        ? itemPrice(context.priceSet, candidatePriceKey)
        : undefined;
      const numericCandidatePrice = asNumeric(candidatePrice);
      if (
        candidateTier !== undefined &&
        numericCandidatePrice !== undefined &&
        numericCandidatePrice > 0
      ) {
        anchors.push({ tier: candidateTier, price: numericCandidatePrice });
      }
    }
    if (anchors.length === 1) {
      const base = Object.values(context.gameData.ammo).find((candidate) => {
        const candidateRecord = candidate as unknown as Record<string, unknown>;
        return candidateRecord.fam === family && candidateRecord.tier === anchors[0]?.tier;
      }) as unknown as Record<string, unknown> | undefined;
      const basePrice = asNumeric(base?.price);
      const ratio = basePrice ? (ammo.price || 0) / basePrice : 1;
      return Math.round(anchors[0].price * ratio);
    }
    if (anchors.length > 1) {
      anchors.sort((left, right) => left.tier - right.tier);
      let low = anchors[0];
      let high = anchors[anchors.length - 1];
      for (let index = 0; index < anchors.length - 1; index += 1) {
        if (anchors[index].tier <= tier && anchors[index + 1].tier >= tier) {
          low = anchors[index];
          high = anchors[index + 1];
          break;
        }
      }
      if (low.tier === high.tier) return Math.round(low.price);
      const t = (tier - low.tier) / (high.tier - low.tier);
      return Math.round(
        Math.exp(Math.log(low.price) + t * (Math.log(high.price) - Math.log(low.price)))
      );
    }
  }
  return ammo.price || 0;
}

function spellRuneCost(spellId: EntityId, weaponId: EntityId, context: SimulationContext): number {
  const spell = context.gameData.spells[spellId];
  if (!spell?.runes) return 0;
  const provided = context.gameData.weapons[weaponId]?.provides;
  let cost = 0;
  for (const [rune, qty] of Object.entries(spell.runes)) {
    if (rune === provided) continue;
    cost += (itemPrice(context.priceSet, rune) || 0) * qty;
  }
  return cost;
}

function chargeCostPerCast(castIntervalSec: number, context: SimulationContext): number {
  const fullCost =
    (itemPrice(context.priceSet, "airrune") || 0) * 3 +
    (itemPrice(context.priceSet, "firerune") || 0) * 3 +
    (itemPrice(context.priceSet, "bloodrune") || 0) * 3;
  const castsPerCharge = Math.max(1, CHARGE_DURATION_SEC / (castIntervalSec || 3));
  return fullCost / castsPerCharge;
}

export function computeSupplyCosts(
  input: TripLootSupplyInput,
  context: SimulationContext,
  tripResult: TripResult,
  playerAttackTimeSecPerKill: number,
  cannon: CannonOverlayResult | null
): SupplyResult {
  const request = input.request;
  let ammoCostPerKill = 0;
  let ammoPerKill = 0;
  let ammoKeyUsed: EntityId | null = null;
  let ammoUnitPrice = 0;
  if (request.combatStyle === "ranged") {
    const weapon = context.gameData.weapons[request.loadout.weaponId];
    ammoKeyUsed =
      weapon?.sub === "thrown" && weapon.ammoKey
        ? weapon.ammoKey
        : (request.loadout.ammoId ?? null);
    if (ammoKeyUsed && context.gameData.ammo[ammoKeyUsed]) {
      const shotsPerKill =
        request.combatStyle === "ranged" && input.combat.attackSpeedSec > 0
          ? playerAttackTimeSecPerKill / input.combat.attackSpeedSec
          : 0;
      const recover = input.trip?.recoverAmmo !== false;
      const destroyFraction = recover ? 1 / 5 : 1;
      ammoUnitPrice = ammoPrice(ammoKeyUsed, context);
      ammoPerKill = shotsPerKill * destroyFraction;
      ammoCostPerKill = ammoPerKill * ammoUnitPrice;
    }
  }

  let runeCostPerKill = 0;
  let castsPerKill = 0;
  let runeCostPerCast = 0;
  let chargePerCast = 0;
  if (request.combatStyle === "magic" && request.spellId) {
    runeCostPerCast = spellRuneCost(request.spellId, request.loadout.weaponId, context);
    const spell = context.gameData.spells[request.spellId];
    if (spell?.god && request.charge !== false) {
      chargePerCast = chargeCostPerCast(input.combat.attackSpeedSec, context);
    }
    castsPerKill =
      input.combat.attackSpeedSec > 0
        ? playerAttackTimeSecPerKill / input.combat.attackSpeedSec
        : 0;
    runeCostPerKill = castsPerKill * (runeCostPerCast + chargePerCast);
  }

  const ballCostPerKill = cannon?.ballCostPerKill ?? 0;
  const supplyCostPerKill =
    tripResult.foodCostPerKill +
    tripResult.potionCostPerKill +
    ammoCostPerKill +
    runeCostPerKill +
    tripResult.recoilCostPerKill +
    ballCostPerKill;

  return {
    foodCostPerKill: tripResult.foodCostPerKill,
    potionCostPerKill: tripResult.potionCostPerKill,
    ammoCostPerKill,
    runeCostPerKill,
    recoilCostPerKill: tripResult.recoilCostPerKill,
    ballCostPerKill,
    supplyCostPerKill,
    ammoPerKill,
    ammoKeyUsed,
    ammoUnitPrice,
    runeCostPerCast,
    chargePerCast,
    castsPerKill
  };
}

export function simulateTripLootSupply(
  input: TripLootSupplyInput,
  context: SimulationContext
): TripLootSupplyResult {
  const monster = context.gameData.monsters[input.request.monsterId];
  if (!monster) throw new Error(`Unknown monster id: ${input.request.monsterId}`);

  const trip = input.trip ?? {};
  const prayer = combinePrayerData(input.request.prayers.keys);
  const recoilProbe = computeIncomingDamage(input.request, context, trip, {
    monster,
    combatStyle: input.request.combatStyle,
    ttkSec: 0,
    cycleSec: 0,
    prayerDef: prayer.def
  });
  const ringRecoil = input.request.loadout.gear.ring === "ring_of_recoil";
  let recoilDps = 0;
  if (ringRecoil && !recoilProbe.safespot && recoilProbe.hitChance > 0 && recoilProbe.monMax > 0) {
    const attackInterval = (monster.attackSpeed || 4) * TICK_SECONDS;
    const recoilPerHit = recoilProbe.monMax / 20 + 1;
    recoilDps = (recoilProbe.hitChance / attackInterval) * recoilPerHit;
  }
  const poisonDps = input.combat.poison?.dps ?? 0;
  const killDps = input.combat.effectiveDps + poisonDps + recoilDps;
  const baseCombatXpDamageFraction =
    killDps > 0 ? input.combat.effectiveDps / killDps : input.combat.directDamageFraction;
  const baseTtkSec =
    killDps > 0 ? (monster.hp + input.combat.maxHit / 4) / killDps : input.combat.ttkSec;
  const recoilDmgPerKill = recoilDps * baseTtkSec;
  const overheadSec = input.overheadSec ?? defaultOverhead(monster);
  const baseCycleSec = baseTtkSec + overheadSec;
  const baseKillsPerHour = 3600 / baseCycleSec;
  const cannonWarnings: SimulationWarning[] = [];
  const cannonComputation = computeCannonOverlay({
    settings: input.cannon,
    monster,
    priceSet: context.priceSet,
    combat: input.combat,
    playerDps: killDps,
    hpEffective: monster.hp + input.combat.maxHit / 4,
    overheadSec,
    baseTtkSec,
    baseCycleSec,
    baseKillsPerHour,
    baseCombatXpDamageFraction,
    warnings: cannonWarnings
  });
  let cannon = cannonComputation.cannon;
  const ttkSec = cannonComputation.ttkSec;
  let cycleSec = cannonComputation.cycleSec;
  let killsPerHour = cannonComputation.killsPerHour;
  const playerAttackTimeSecPerKill = cannonComputation.playerAttackTimeSecPerKill;
  const combatXpDamageFraction = cannonComputation.combatXpDamageFraction;
  const lootEvaluation = evaluateLoot(monster, context, {
    alching: trip.alching,
    lootPrefs: input.lootPrefs,
    ringOfWealth: input.ringOfWealth,
    legendsComplete: input.legendsComplete,
    jewelSpot: input.jewelSpot
  });
  if (lootEvaluation.alchTimePerKill > 0) {
    cycleSec += lootEvaluation.alchTimePerKill;
    killsPerHour = 3600 / cycleSec;
  }
  const scarce = computeScarceSpot(trip, monster, cycleSec);
  if (scarce.respawnBound) {
    cycleSec = scarce.spawnCycleSec;
    killsPerHour = scarce.maxKph;
  }
  const prayerPerKill = prayerPerKillForCycle(input.request, context, cycleSec, trip);
  const tripContext: TripComputationContext = {
    monster,
    combatStyle: input.request.combatStyle,
    ttkSec,
    cycleSec,
    killsPerHour,
    lootBreakdown: lootEvaluation.lootBreakdown,
    prayerDef: prayer.def,
    boostKeys: input.request.boosts.keys,
    dba: isDbaSelected(input.request),
    dbaRestore: trip.dbaRestore,
    hasSpec: !!input.combat.specialAttack,
    prayerPerKill,
    prayerLevel: input.request.levels.prayer,
    ringRecoil,
    recoilDmgPerKill,
    cannonOn: !!cannon,
    scarce
  };
  let tripResult = computeTrip(input.request, context, trip, tripContext);
  let gpPerKill = lootEvaluation.gpPerKill;

  for (const drop of lootEvaluation.lootBreakdown) {
    const saved = tripResult.eatenFood[drop.rowId] ?? tripResult.eatenFood[drop.name];
    if (saved != null && drop.pref === "loot") {
      gpPerKill += saved - drop.evGp;
      drop.evGp = saved;
      drop._eaten = true;
    }
  }

  const displacedRowIds = new Set<string>();
  if (tripResult.bound === "loot") {
    const items = lootEvaluation.lootBreakdown
      .filter(
        (drop) =>
          drop.pref === "loot" &&
          drop.evGp > 0 &&
          !drop.isBone &&
          !drop._eaten &&
          !isStackable(drop.key, drop.name) &&
          !Array.isArray(drop._expand)
      )
      .map((drop) => ({
        drop,
        value: drop.chance * drop.qtyAvg > 0 ? drop.evGp / (drop.chance * drop.qtyAvg) : 0,
        slots: drop.chance * drop.qtyAvg
      }));
    if (items.length > 1) {
      const dominant = items.reduce(
        (left, right) => (right.slots > left.slots ? right : left),
        items[0]
      );
      if (dominant.slots >= 0.5) {
        for (const item of items) {
          if (item !== dominant && item.value < dominant.value) {
            gpPerKill -= item.drop.evGp;
            displacedRowIds.add(item.drop.rowId);
            item.drop._displaced = true;
          }
        }
      }
    }
    if (displacedRowIds.size > 0) {
      const reduced = lootEvaluation.lootBreakdown.map((drop) =>
        displacedRowIds.has(drop.rowId) ? { ...drop, pref: "skip" as LootAction } : drop
      );
      tripResult = computeTrip(input.request, context, trip, {
        ...tripContext,
        lootBreakdown: reduced
      });
    }
  }

  if (cannon) {
    const killsPerTrip = Number.isFinite(tripResult.killsPerTrip) ? tripResult.killsPerTrip : 0;
    cannon = {
      ...cannon,
      ballsPerTrip: cannon.ballsPerKill * killsPerTrip,
      ballCostPerTrip: cannon.ballCostPerKill * killsPerTrip
    };
  }

  const supply = computeSupplyCosts(input, context, tripResult, playerAttackTimeSecPerKill, cannon);
  const potionRecommendation = recommendPotionCarry({
    request: input.request,
    trip,
    cycleSec,
    killsPerTrip: tripResult.killsPerTrip
  });
  const gpPerHour = gpPerKill * killsPerHour;
  const netGpPerHour = gpPerHour - supply.supplyCostPerKill * killsPerHour;
  const efficiency = isFinite(tripResult.efficiency) ? tripResult.efficiency : 1;
  const lootFraction = Number.isFinite(tripResult.lootFraction) ? tripResult.lootFraction : 1;

  return {
    gpPerKill,
    gpPerHour,
    netGpPerHour,
    effectiveGpPerHour: gpPerHour * lootFraction * efficiency,
    effectiveNetGpPerHour:
      (gpPerHour * lootFraction - supply.supplyCostPerKill * killsPerHour) * efficiency,
    effectiveKph: tripResult.effectiveKph,
    cycleSec,
    killsPerHour,
    prayerPerKill,
    prayerXpPerKill: lootEvaluation.prayerXpPerKill,
    prayerXpPerHour: lootEvaluation.prayerXpPerKill * killsPerHour,
    alchCastsPerKill: lootEvaluation.alchCastsPerKill,
    combatXpDamageFraction,
    playerAttackTimeSecPerKill,
    potionRecommendation,
    cannon,
    lootBreakdown: lootEvaluation.lootBreakdown,
    trip: tripResult,
    supply,
    incoming: tripResult.incoming,
    warnings: [...lootEvaluation.warnings, ...cannonWarnings]
  };
}

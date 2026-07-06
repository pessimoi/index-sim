import { loadoutToCombatBonuses, sumEquipmentBonuses } from "../equipment";
import {
  type AttackType,
  type CombatStyle,
  type DbaInfo,
  type EntityId,
  type GameDataSnapshot,
  type MonsterDefinition,
  type SimulationContext,
  type SimulationRequest,
  type SimulationResult,
  type SpecialAttackResult
} from "../shared";

export const TICK_SECONDS = 0.6;
const MIN_ATTACK_SPEED_SEC = TICK_SECONDS;
const MAX_ATTACK_SPEED_SEC = 12;
const MIN_MANUAL_BONUS = -250;
const MAX_MANUAL_BONUS = 350;

type StatKey = "att" | "str" | "def" | "rng" | "mag";

interface PrayerDefinition {
  att: number;
  str: number;
  def: number;
  drain: number;
  cat: string;
  label: string;
}

interface PotionDefinition {
  cat: string;
  label: string;
  apply(stat: StatKey, level: number): number;
  special?: "chaos_gauntlets" | "restore" | "dba";
}

interface StyleDefinition {
  accBonus: number;
  dmgBonus: number;
  defBonus: number;
  xpDist: Record<string, number>;
  label: string;
  tickMod?: number;
}

export interface MeleeStance {
  id: EntityId;
  style: "accurate" | "aggressive" | "controlled" | "defensive";
  type: AttackType;
  name: string;
}

export type CombatXpKey = "att" | "str" | "def" | "rng" | "mag" | "hp";

export interface CombatXpBreakdown {
  xpRouting: Record<string, number>;
  skillXpPerKill: Partial<Record<CombatXpKey, number>>;
  combatXpPerKill: number;
  hpXpPerKill: number;
  spellXpPerKill: number;
}

export interface CombatXpBreakdownOptions {
  directDamageFraction?: number;
}

interface SpecialAttackDefinition {
  combat: CombatStyle;
  cost: number;
  hits: number;
  dmgMult: number;
  accMult: number;
  defField: "defStab" | "defSlash" | "defCrush" | "defRange";
  rngLvlBonus: number;
  guaranteedHit?: boolean;
}

export interface SupportedSpecialAttack {
  weaponId: EntityId;
  combat: CombatStyle;
  requiresAmmo: boolean;
}

const PRAYERS: Record<EntityId, PrayerDefinition> = {
  none: { att: 1, str: 1, def: 1, drain: 0, cat: "none", label: "None" },
  clarity: {
    att: 1.05,
    str: 1,
    def: 1,
    drain: 3,
    cat: "att",
    label: "Clarity of Thought (+5% Att)"
  },
  reflexes: {
    att: 1.1,
    str: 1,
    def: 1,
    drain: 6,
    cat: "att",
    label: "Improved Reflexes (+10% Att)"
  },
  incredible: {
    att: 1.15,
    str: 1,
    def: 1,
    drain: 12,
    cat: "att",
    label: "Incredible Reflexes (+15% Att)"
  },
  burst: { att: 1, str: 1.05, def: 1, drain: 3, cat: "str", label: "Burst of Strength (+5% Str)" },
  superhuman: {
    att: 1,
    str: 1.1,
    def: 1,
    drain: 6,
    cat: "str",
    label: "Superhuman Strength (+10% Str)"
  },
  ultimate: {
    att: 1,
    str: 1.15,
    def: 1,
    drain: 12,
    cat: "str",
    label: "Ultimate Strength (+15% Str)"
  },
  thick_skin: { att: 1, str: 1, def: 1.05, drain: 3, cat: "def", label: "Thick Skin (+5% Def)" },
  rock_skin: { att: 1, str: 1, def: 1.1, drain: 6, cat: "def", label: "Rock Skin (+10% Def)" },
  steel_skin: { att: 1, str: 1, def: 1.15, drain: 12, cat: "def", label: "Steel Skin (+15% Def)" }
};

const POTIONS: Record<EntityId, PotionDefinition> = {
  none: { cat: "none", label: "None", apply: (_stat, level) => level },
  attack: {
    cat: "att",
    label: "Attack potion",
    apply: (stat, level) => (stat === "att" ? level + 3 + Math.trunc(level * 0.1) : level)
  },
  strength: {
    cat: "str",
    label: "Strength potion",
    apply: (stat, level) => (stat === "str" ? level + 3 + Math.trunc(level * 0.1) : level)
  },
  defence: {
    cat: "def",
    label: "Defence potion",
    apply: (stat, level) => (stat === "def" ? level + 3 + Math.trunc(level * 0.1) : level)
  },
  super_att: {
    cat: "att",
    label: "Super attack",
    apply: (stat, level) => (stat === "att" ? level + 5 + Math.trunc(level * 0.15) : level)
  },
  super_str: {
    cat: "str",
    label: "Super strength",
    apply: (stat, level) => (stat === "str" ? level + 5 + Math.trunc(level * 0.15) : level)
  },
  super_def: {
    cat: "def",
    label: "Super defence",
    apply: (stat, level) => (stat === "def" ? level + 5 + Math.trunc(level * 0.15) : level)
  },
  ranging: {
    cat: "rng",
    label: "Ranging potion",
    apply: (stat, level) => (stat === "rng" ? level + 4 + Math.trunc(level * 0.1) : level)
  },
  magic: {
    cat: "mag",
    label: "Magic potion",
    apply: (stat, level) => (stat === "mag" ? level + 4 : level)
  },
  chaos_gauntlets: {
    cat: "gauntlets",
    label: "Chaos gauntlets",
    special: "chaos_gauntlets",
    apply: (_stat, level) => level
  },
  restore: {
    cat: "restore",
    label: "Restore potion (negates DBA drain)",
    special: "restore",
    apply: (_stat, level) => level
  },
  dba_spec: {
    cat: "special",
    label: "DBA spec",
    special: "dba",
    apply: (_stat, level) => level
  }
};

const STYLES: Record<CombatStyle, Record<EntityId, StyleDefinition>> = {
  melee: {
    accurate: { accBonus: 3, dmgBonus: 0, defBonus: 0, xpDist: { att: 4 }, label: "Accurate" },
    aggressive: { accBonus: 0, dmgBonus: 3, defBonus: 0, xpDist: { str: 4 }, label: "Aggressive" },
    controlled: {
      accBonus: 1,
      dmgBonus: 1,
      defBonus: 1,
      xpDist: { att: 4 / 3, str: 4 / 3, def: 4 / 3 },
      label: "Controlled"
    },
    defensive: { accBonus: 0, dmgBonus: 0, defBonus: 3, xpDist: { def: 4 }, label: "Defensive" }
  },
  ranged: {
    accurate: { accBonus: 3, dmgBonus: 0, defBonus: 0, xpDist: { rng: 4 }, label: "Accurate" },
    rapid: {
      accBonus: 0,
      dmgBonus: 0,
      defBonus: 0,
      xpDist: { rng: 4 },
      label: "Rapid (-1 tick)",
      tickMod: -1
    },
    longrange: {
      accBonus: 0,
      dmgBonus: 0,
      defBonus: 3,
      xpDist: { rng: 2, def: 2 },
      label: "Longrange"
    }
  },
  magic: {
    accurate: { accBonus: 0, dmgBonus: 0, defBonus: 0, xpDist: { mag: 2 }, label: "Standard cast" },
    longrange: {
      accBonus: 0,
      dmgBonus: 0,
      defBonus: 3,
      xpDist: { mag: 4 / 3, def: 1 },
      label: "Longrange"
    },
    defensive: {
      accBonus: 0,
      dmgBonus: 0,
      defBonus: 3,
      xpDist: { mag: 4 / 3, def: 1 },
      label: "Defensive casting"
    }
  }
};

const STANCE_TABLES: Record<string, readonly MeleeStance[]> = {
  slash: [
    { id: "accurate", style: "accurate", type: "slash", name: "Chop" },
    { id: "aggressive", style: "aggressive", type: "slash", name: "Slash" },
    { id: "controlled", style: "controlled", type: "stab", name: "Lunge" },
    { id: "defensive", style: "defensive", type: "slash", name: "Block" }
  ],
  stab: [
    { id: "accurate", style: "accurate", type: "stab", name: "Stab" },
    { id: "aggressive", style: "aggressive", type: "stab", name: "Stab" },
    { id: "aggressive_slash", style: "aggressive", type: "slash", name: "Slash" },
    { id: "defensive", style: "defensive", type: "stab", name: "Block" }
  ],
  polearm: [
    { id: "controlled", style: "controlled", type: "stab", name: "Jab" },
    { id: "aggressive", style: "aggressive", type: "slash", name: "Swipe" },
    { id: "defensive", style: "defensive", type: "stab", name: "Fend" }
  ],
  "2h_sword": [
    { id: "accurate", style: "accurate", type: "slash", name: "Chop" },
    { id: "aggressive", style: "aggressive", type: "slash", name: "Slash" },
    { id: "aggressive_crush", style: "aggressive", type: "crush", name: "Smash" },
    { id: "defensive", style: "defensive", type: "slash", name: "Block" }
  ],
  axe: [
    { id: "accurate", style: "accurate", type: "slash", name: "Chop" },
    { id: "aggressive", style: "aggressive", type: "slash", name: "Hack" },
    { id: "aggressive_crush", style: "aggressive", type: "crush", name: "Smash" },
    { id: "defensive", style: "defensive", type: "slash", name: "Block" }
  ],
  blunt: [
    { id: "accurate", style: "accurate", type: "crush", name: "Pound" },
    { id: "aggressive", style: "aggressive", type: "crush", name: "Pummel" },
    { id: "defensive", style: "defensive", type: "crush", name: "Block" }
  ],
  spiked: [
    { id: "accurate", style: "accurate", type: "crush", name: "Pound" },
    { id: "aggressive", style: "aggressive", type: "crush", name: "Pummel" },
    { id: "controlled", style: "controlled", type: "stab", name: "Spike" },
    { id: "defensive", style: "defensive", type: "crush", name: "Block" }
  ],
  spear: [
    { id: "controlled", style: "controlled", type: "stab", name: "Lunge" },
    { id: "controlled_slash", style: "controlled", type: "slash", name: "Swipe" },
    { id: "controlled_crush", style: "controlled", type: "crush", name: "Pound" },
    { id: "defensive", style: "defensive", type: "stab", name: "Block" }
  ],
  claws: [
    { id: "accurate", style: "accurate", type: "slash", name: "Chop" },
    { id: "aggressive", style: "aggressive", type: "slash", name: "Slash" },
    { id: "controlled", style: "controlled", type: "stab", name: "Lunge" },
    { id: "defensive", style: "defensive", type: "slash", name: "Block" }
  ],
  staff: [
    { id: "accurate", style: "accurate", type: "crush", name: "Bash" },
    { id: "aggressive", style: "aggressive", type: "crush", name: "Pound" },
    { id: "defensive", style: "defensive", type: "crush", name: "Focus" }
  ],
  pickaxe: [
    { id: "accurate", style: "accurate", type: "stab", name: "Spike" },
    { id: "aggressive", style: "aggressive", type: "stab", name: "Impale" },
    { id: "aggressive_crush", style: "aggressive", type: "crush", name: "Smash" },
    { id: "defensive", style: "defensive", type: "stab", name: "Block" }
  ],
  scythe: [
    { id: "accurate", style: "accurate", type: "slash", name: "Reap" },
    { id: "aggressive", style: "aggressive", type: "stab", name: "Chop" },
    { id: "aggressive_crush", style: "aggressive", type: "crush", name: "Jab" },
    { id: "defensive", style: "defensive", type: "slash", name: "Block" }
  ]
};

const WCLASS_CATEGORY: Record<string, string> = {
  scimitar: "slash",
  longsword: "slash",
  sword: "slash",
  dagger: "stab",
  halberd: "polearm",
  spear: "spear",
  "2h_sword": "2h_sword",
  "2h": "2h_sword",
  battleaxe: "axe",
  axe: "axe",
  mace: "spiked",
  warhammer: "blunt",
  hammer: "blunt",
  claws: "claws",
  staff: "staff",
  pickaxe: "pickaxe",
  scythe: "scythe"
};

const DEF_FIELD: Record<AttackType, "defStab" | "defSlash" | "defCrush"> = {
  stab: "defStab",
  slash: "defSlash",
  crush: "defCrush"
};

const SPECIAL_ATTACK_DEFINITIONS = {
  dragon_dagger: {
    combat: "melee",
    cost: 25,
    hits: 2,
    dmgMult: 1.15,
    accMult: 1.15,
    defField: "defSlash",
    rngLvlBonus: 0
  },
  dragon_dagger_p: {
    combat: "melee",
    cost: 25,
    hits: 2,
    dmgMult: 1.15,
    accMult: 1.15,
    defField: "defSlash",
    rngLvlBonus: 0
  },
  dragon_longsword: {
    combat: "melee",
    cost: 25,
    hits: 1,
    dmgMult: 1.25,
    accMult: 1,
    defField: "defSlash",
    rngLvlBonus: 0
  },
  dragon_halberd: {
    combat: "melee",
    cost: 30,
    hits: 2,
    dmgMult: 1.1,
    accMult: 1,
    defField: "defSlash",
    rngLvlBonus: 0
  },
  dragon_mace: {
    combat: "melee",
    cost: 25,
    hits: 1,
    dmgMult: 1.5,
    accMult: 1.25,
    defField: "defCrush",
    rngLvlBonus: 0
  },
  magic_shortbow: {
    combat: "ranged",
    cost: 35,
    hits: 2,
    dmgMult: 1,
    accMult: 10 / 7,
    defField: "defRange",
    rngLvlBonus: 10
  },
  magic_longbow: {
    combat: "ranged",
    cost: 35,
    hits: 1,
    dmgMult: 1,
    accMult: 1,
    defField: "defRange",
    rngLvlBonus: 10,
    guaranteedHit: true
  }
} satisfies Record<EntityId, SpecialAttackDefinition>;

export const SUPPORTED_SPECIAL_ATTACK_WEAPON_IDS = Object.keys(SPECIAL_ATTACK_DEFINITIONS) as Array<
  keyof typeof SPECIAL_ATTACK_DEFINITIONS
>;

const SPEC_DATA: Record<EntityId, SpecialAttackDefinition> = SPECIAL_ATTACK_DEFINITIONS;

export function isSupportedSpecialAttackWeapon(
  weaponId: EntityId,
  combatStyle?: CombatStyle
): boolean {
  const specData = SPEC_DATA[weaponId];
  if (!specData) return false;
  return combatStyle ? specData.combat === combatStyle : true;
}

export function supportedSpecialAttacksForCombatStyle(
  combatStyle: CombatStyle,
  gameData: GameDataSnapshot
): SupportedSpecialAttack[] {
  return SUPPORTED_SPECIAL_ATTACK_WEAPON_IDS.flatMap((weaponId) => {
    const specData = SPEC_DATA[weaponId];
    const weapon = gameData.weapons[weaponId];
    if (specData.combat !== combatStyle || !weapon) return [];
    return [
      {
        weaponId,
        combat: specData.combat,
        requiresAmmo: specData.combat === "ranged" && weapon.sub === "bow"
      }
    ];
  });
}

const SA_REGEN_PER_HOUR = (100 / 1000) * (3600 / (50 * TICK_SECONDS)) * 100;

export function maxHitMelee(effectiveStrength: number, strengthBonus: number): number {
  return Math.floor(0.5 + (effectiveStrength * (strengthBonus + 64)) / 640);
}

export function maxHitRanged(effectiveRangedStrength: number, rangedStrengthBonus: number): number {
  return Math.floor(0.5 + (effectiveRangedStrength * (rangedStrengthBonus + 64)) / 640);
}

export function maxHitMagic(spellBase: number, magicDamagePercent: number): number {
  return Math.floor(spellBase * (1 + (magicDamagePercent || 0) / 100));
}

export function roll(effectiveLevel: number, equipmentBonus: number): number {
  return effectiveLevel * (equipmentBonus + 64);
}

export function hitChance(attackRoll: number, defenceRoll: number): number {
  if (attackRoll > defenceRoll) {
    return 1 - (defenceRoll + 2) / (2 * (attackRoll + 1));
  }
  return attackRoll / (2 * (defenceRoll + 1));
}

export function weaponStances(
  weaponId: EntityId,
  gameData: GameDataSnapshot
): readonly MeleeStance[] {
  const category = WCLASS_CATEGORY[gameData.weapons[weaponId]?.wclass ?? ""] ?? "slash";
  return STANCE_TABLES[category] ?? STANCE_TABLES.slash;
}

export function resolveMeleeStance(
  weaponId: EntityId,
  stanceId: EntityId,
  gameData: GameDataSnapshot
): MeleeStance {
  const stances = weaponStances(weaponId, gameData);
  return stances.find((stance) => stance.id === stanceId) ?? stances[0];
}

function firstStyle(styleSet: Record<EntityId, StyleDefinition>): StyleDefinition {
  const first = Object.values(styleSet)[0];
  if (!first) throw new Error("No combat style definitions are available");
  return first;
}

function combinePrayers(keys: readonly EntityId[]) {
  const out = { att: 1, str: 1, def: 1, rng: 1, mag: 1, drain: 0, labels: [] as string[] };
  for (const key of keys) {
    const prayer = PRAYERS[key];
    if (!prayer || key === "none") continue;
    out.att = Math.max(out.att, prayer.att);
    out.str = Math.max(out.str, prayer.str);
    out.def = Math.max(out.def, prayer.def);
    out.drain += prayer.drain;
    out.labels.push(prayer.label);
  }
  return out;
}

function combinePotionFn(keys: readonly EntityId[]) {
  return (stat: StatKey, level: number) => {
    let best = level;
    for (const key of keys) {
      const potion = POTIONS[key];
      if (!potion || key === "none") continue;
      const candidate = potion.apply(stat, level);
      if (candidate > best) best = candidate;
    }
    return best;
  };
}

function decayLevelSamples(
  stats: Array<{ base: number; peakL: number }>,
  repotThreshold: number | null | undefined,
  sustained: boolean | undefined
): number[][] {
  if (!sustained) return [stats.map((stat) => stat.peakL)];
  const thresholdOf = (stat: { base: number; peakL: number }) =>
    repotThreshold != null
      ? Math.max(stat.base, repotThreshold)
      : Math.max(stat.base, stat.peakL - 10);
  const spans = stats.map((stat) => Math.max(0, stat.peakL - thresholdOf(stat)));
  const active = spans.filter((span) => span > 0);
  const sampleCount = active.length ? Math.min(...active) : 1;
  const out: number[][] = [];
  for (let t = 0; t < sampleCount; t += 1) {
    out.push(stats.map((stat) => Math.max(stat.base, stat.peakL - t)));
  }
  return out;
}

function dbaBoost(attack: number, defence: number, ranged: number, magic: number): DbaInfo {
  const drainAtt = Math.floor(attack / 10);
  const drainDef = Math.floor(defence / 10);
  const drainRng = Math.floor(ranged / 10);
  const drainMag = Math.floor(magic / 10);
  const sum = drainAtt + drainDef + drainRng + drainMag;
  return { drainAtt, drainDef, drainRng, drainMag, totalBoost: 10 + Math.floor(sum / 4) };
}

function meanOf(samples: Array<Record<string, number>>, key: string): number {
  return samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length;
}

function finiteOverride(value: number | null | undefined, min: number, max: number): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function monsterDefenceLevel(monster: MonsterDefinition, combatStyle: CombatStyle): number {
  return combatStyle === "magic" ? (monster.magicLevel ?? 1) : (monster.defLevel ?? 1);
}

function monsterDefenceBonus(monster: MonsterDefinition, field: string): number {
  return (monster as unknown as Record<string, number | undefined>)[field] ?? 0;
}

function styleForRequest(request: SimulationRequest, gameData: GameDataSnapshot) {
  if (request.combatStyle === "melee") {
    const stance = resolveMeleeStance(request.loadout.weaponId, request.styleId, gameData);
    return {
      style: STYLES.melee[stance.style] ?? STYLES.melee.aggressive,
      stance
    };
  }

  const styleSet = STYLES[request.combatStyle];
  return {
    style: styleSet[request.styleId] ?? firstStyle(styleSet),
    stance: null
  };
}

function specialAttackResult(
  request: SimulationRequest,
  context: SimulationContext,
  effectiveAccuracy: number,
  effectiveDamage: number,
  monsterDefenceLevelValue: number,
  baseDps: number,
  dbaSelected: boolean
): SpecialAttackResult | null {
  const specKey = request.specialAttack?.weaponId;
  if (!specKey || specKey === "none" || dbaSelected) return null;

  const specData = SPEC_DATA[specKey];
  if (!specData || specData.combat !== request.combatStyle) return null;

  const gameData = context.gameData;
  const specWeapon = gameData.weapons[specKey] ?? {
    name: specKey,
    type: request.combatStyle,
    accBonus: 0,
    dmgBonus: 0,
    speed: 4
  };
  const mainWeapon = gameData.weapons[request.loadout.weaponId] ?? {
    name: request.loadout.weaponId,
    type: request.combatStyle,
    accBonus: 0,
    dmgBonus: 0,
    speed: 4
  };
  let specAmmoId = "none";
  if (request.combatStyle === "ranged" && specWeapon.sub === "bow") {
    specAmmoId =
      request.specialAttack?.ammoId ??
      (mainWeapon.sub === "bow" ? (request.loadout.ammoId ?? "none") : "rune_arrow");
  }

  const specBonuses = sumEquipmentBonuses(
    {
      ...request.loadout,
      weaponId: specKey,
      ammoId: specAmmoId
    },
    gameData
  );

  let accuracyBonusSpec: number;
  let damageBonusSpec: number;
  let specAmmoBonus = 0;
  if (request.combatStyle === "ranged") {
    accuracyBonusSpec = specBonuses.rngAtt;
    damageBonusSpec = specBonuses.rngStr;
  } else if (request.combatStyle === "melee") {
    const specAttackKey =
      specData.defField === "defStab"
        ? "stabAtt"
        : specData.defField === "defCrush"
          ? "crushAtt"
          : "slashAtt";
    accuracyBonusSpec = specBonuses[specAttackKey];
    damageBonusSpec = specBonuses.str;
  } else {
    accuracyBonusSpec = specBonuses.magAtt;
    damageBonusSpec = 0;
    specAmmoBonus = 0;
  }

  const attackRollSpec = roll(effectiveAccuracy, accuracyBonusSpec) * specData.accMult;
  const defenceRollSpec =
    (monsterDefenceLevelValue + 9) *
    (monsterDefenceBonus(gameData.monsters[request.monsterId], specData.defField) + 64);
  const rawHitChance = hitChance(attackRollSpec, defenceRollSpec);
  const effectiveHitChance = specData.guaranteedHit ? 1 : rawHitChance;
  const maxHitSpec =
    request.combatStyle === "ranged"
      ? maxHitRanged(effectiveDamage + specData.rngLvlBonus, damageBonusSpec + specAmmoBonus)
      : Math.floor(maxHitMelee(effectiveDamage, damageBonusSpec) * specData.dmgMult);
  const expPerSpec = specData.hits * effectiveHitChance * (maxHitSpec / 2);
  const specsPerHour = SA_REGEN_PER_HOUR / specData.cost;
  const specSecPerHour = specsPerHour * (specWeapon.speed || 4) * TICK_SECONDS;
  const normalDamagePerHour = baseDps * Math.max(0, 3600 - specSecPerHour);
  const specDamagePerHour = specsPerHour * expPerSpec;
  const dpsWithSpec = (normalDamagePerHour + specDamagePerHour) / 3600;

  return {
    key: specKey,
    weaponName: specWeapon.name,
    specsPerHour,
    expPerSpec,
    maxHit: maxHitSpec,
    hits: specData.hits,
    hitChance: effectiveHitChance,
    dpsBase: baseDps,
    dpsWithSpec,
    dpsGainPct: baseDps > 0 ? (dpsWithSpec / baseDps - 1) * 100 : 0
  };
}

export function simulateCombat(
  request: SimulationRequest,
  context: SimulationContext
): SimulationResult {
  const monster = context.gameData.monsters[request.monsterId];
  if (!monster) {
    throw new Error(`Unknown monster id: ${request.monsterId}`);
  }

  const loadoutBonuses = loadoutToCombatBonuses(
    request.loadout,
    request.combatStyle,
    context.gameData
  );
  const { style, stance } = styleForRequest(request, context.gameData);
  const prayer = combinePrayers(request.prayers.keys);
  const potionFn = combinePotionFn(request.boosts.keys);
  const dbaSelected = request.combatStyle === "melee" && request.boosts.keys.includes("dba_spec");
  const dbaInfo =
    request.combatStyle === "melee"
      ? dbaBoost(
          request.levels.attack,
          request.levels.defence,
          request.levels.ranged,
          request.levels.magic
        )
      : null;

  let accuracyBonusEffective = loadoutBonuses.accBonus;
  if (request.combatStyle === "melee" && stance && loadoutBonuses.accByType) {
    accuracyBonusEffective = loadoutBonuses.accByType[stance.type] ?? accuracyBonusEffective;
  }
  let damageBonusEffective = loadoutBonuses.dmgBonus;
  if (request.combatStyle === "ranged") {
    accuracyBonusEffective = loadoutBonuses.accBonus + loadoutBonuses.ammoRangeBonus;
    damageBonusEffective = loadoutBonuses.dmgBonus + loadoutBonuses.ammoRangeBonus;
  }
  const manualAccuracyBonus = finiteOverride(
    request.manualOverrides?.accuracyBonus,
    MIN_MANUAL_BONUS,
    MAX_MANUAL_BONUS
  );
  const manualDamageBonus = finiteOverride(
    request.manualOverrides?.damageBonus,
    MIN_MANUAL_BONUS,
    MAX_MANUAL_BONUS
  );
  const manualAttackSpeedSec = finiteOverride(
    request.manualOverrides?.attackSpeedSec,
    MIN_ATTACK_SPEED_SEC,
    MAX_ATTACK_SPEED_SEC
  );
  if (manualAccuracyBonus != null) accuracyBonusEffective = manualAccuracyBonus;
  if (manualDamageBonus != null) damageBonusEffective = manualDamageBonus;

  const offSamples: Array<{ effAcc: number; effDmg: number; mh: number }> = [];
  if (request.combatStyle === "melee") {
    const peakAttackLevel = Math.floor(potionFn("att", request.levels.attack));
    const peakStrengthLevel = dbaSelected
      ? request.levels.strength + (dbaInfo?.totalBoost ?? 0)
      : Math.floor(potionFn("str", request.levels.strength));
    const levelSamples = decayLevelSamples(
      [
        { base: request.levels.attack, peakL: peakAttackLevel },
        { base: request.levels.strength, peakL: peakStrengthLevel }
      ],
      request.repotThreshold,
      request.sustained
    );
    for (const [attackLevel, strengthLevel] of levelSamples) {
      const effAcc = Math.floor(attackLevel * prayer.att) + style.accBonus + 8;
      const effDmg = Math.floor(strengthLevel * prayer.str) + style.dmgBonus + 8;
      offSamples.push({ effAcc, effDmg, mh: maxHitMelee(effDmg, damageBonusEffective) });
    }
  } else if (request.combatStyle === "ranged") {
    const peakRangedLevel = Math.floor(potionFn("rng", request.levels.ranged));
    const levelSamples = decayLevelSamples(
      [{ base: request.levels.ranged, peakL: peakRangedLevel }],
      request.repotThreshold,
      request.sustained
    );
    for (const [rangedLevel] of levelSamples) {
      const effDmg = rangedLevel + style.dmgBonus + 8;
      offSamples.push({
        effAcc: rangedLevel + style.accBonus + 8,
        effDmg,
        mh: maxHitRanged(effDmg, damageBonusEffective)
      });
    }
  } else {
    const peakMagicLevel = Math.floor(potionFn("mag", request.levels.magic));
    const spell = request.spellId ? context.gameData.spells[request.spellId] : undefined;
    const spellId = request.spellId ?? "";
    const hasChaosGauntlets = request.boosts.keys.includes("chaos_gauntlets");
    const chaosBonus = hasChaosGauntlets && /bolt/i.test(spellId) ? 3 : 0;
    const spellBase = spell?.god && request.charge !== false ? 30 : (spell?.base ?? 0);
    const maxHit = maxHitMagic(spellBase, damageBonusEffective) + chaosBonus;
    const levelSamples = decayLevelSamples(
      [{ base: request.levels.magic, peakL: peakMagicLevel }],
      request.repotThreshold,
      request.sustained
    );
    for (const [magicLevel] of levelSamples) {
      offSamples.push({ effAcc: magicLevel + 8 + 1, effDmg: request.levels.magic, mh: maxHit });
    }
  }

  const effectiveAccuracy = meanOf(offSamples, "effAcc");
  const effectiveDamage = meanOf(offSamples, "effDmg");
  const maxHit = meanOf(offSamples, "mh");
  const attackRoll = roll(effectiveAccuracy, accuracyBonusEffective);
  const defenceLevel = monsterDefenceLevel(monster, request.combatStyle);
  const defenceField =
    request.combatStyle === "melee" && stance
      ? DEF_FIELD[stance.type]
      : request.combatStyle === "ranged"
        ? "defRange"
        : "defMagic";
  const defenceRoll = (defenceLevel + 9) * (monsterDefenceBonus(monster, defenceField) + 64);
  let hitChanceValue: number;
  let avgHit: number;
  if (offSamples.length > 1) {
    let hitChanceSum = 0;
    let avgHitSum = 0;
    for (const sample of offSamples) {
      const sampleHitChance = hitChance(roll(sample.effAcc, accuracyBonusEffective), defenceRoll);
      hitChanceSum += sampleHitChance;
      avgHitSum += (sample.mh / 2) * sampleHitChance;
    }
    hitChanceValue = hitChanceSum / offSamples.length;
    avgHit = avgHitSum / offSamples.length;
  } else {
    hitChanceValue = hitChance(attackRoll, defenceRoll);
    avgHit = (maxHit / 2) * hitChanceValue;
  }

  const baseTicks =
    loadoutBonuses.attackSpeed ?? context.gameData.weapons[request.loadout.weaponId]?.speed ?? 4;
  const derivedAttackTicks = Math.max(1, baseTicks + (style.tickMod || 0));
  const attackSpeedSec = manualAttackSpeedSec ?? derivedAttackTicks * TICK_SECONDS;
  const attackTicks = attackSpeedSec / TICK_SECONDS;
  const dps = avgHit / attackSpeedSec;
  const specialAttack = specialAttackResult(
    request,
    context,
    effectiveAccuracy,
    effectiveDamage,
    defenceLevel,
    dps,
    dbaSelected
  );
  const effectiveDps = specialAttack?.dpsWithSpec ?? dps;
  const weapon = context.gameData.weapons[request.loadout.weaponId];
  const poisonSeverity = weapon?.poisonSeverity ?? 0;
  const poisonHit = poisonSeverity > 0 ? Math.floor((poisonSeverity + 4) / 5) : 0;
  const poisonDps = poisonSeverity > 0 ? poisonHit / (30 * TICK_SECONDS) : 0;
  const killDps = effectiveDps + poisonDps;
  const directDamageFraction = killDps > 0 ? effectiveDps / killDps : 1;
  const overkillEst = maxHit / 4;
  const ttkSec = (monster.hp + overkillEst) / killDps;

  return {
    combatStyle: request.combatStyle,
    monsterId: request.monsterId,
    maxHit,
    peakMaxHit: offSamples[0].mh,
    hitChance: hitChanceValue,
    avgHit,
    dps,
    effectiveDps,
    attackRoll,
    defenceRoll,
    attackTicks,
    attackSpeedSec,
    ttkSec,
    directDamageFraction,
    specialAttack,
    poison:
      poisonSeverity > 0
        ? {
            severity: poisonSeverity,
            hit: poisonHit,
            intervalSec: 30 * TICK_SECONDS,
            dps: poisonDps,
            directFraction: directDamageFraction
          }
        : null,
    dbaInfo,
    warnings: [],
    debug: {
      effectiveAccuracy,
      effectiveDamage,
      accuracyBonus: accuracyBonusEffective,
      damageBonus: damageBonusEffective,
      defenceField,
      styleId: stance?.style ?? request.styleId,
      attackType: stance?.type
    }
  };
}

export function computeCombatXpBreakdown(
  request: SimulationRequest,
  context: SimulationContext,
  combat: SimulationResult,
  options: CombatXpBreakdownOptions = {}
): CombatXpBreakdown {
  const monster = context.gameData.monsters[request.monsterId];
  if (!monster) {
    throw new Error(`Unknown monster id: ${request.monsterId}`);
  }

  const { style } = styleForRequest(request, context.gameData);
  const xpDist = style.xpDist;
  const directFraction =
    typeof options.directDamageFraction === "number" &&
    Number.isFinite(options.directDamageFraction)
      ? Math.max(0, Math.min(1, options.directDamageFraction))
      : combat.directDamageFraction;
  const combatXpRate = Object.values(xpDist).reduce((sum, value) => sum + value, 0);
  const hpXpPerKill = 1.33 * monster.hp * directFraction;
  let combatXpPerKill = combatXpRate * monster.hp * directFraction;
  let spellXpPerKill = 0;
  const skillXpPerKill: Partial<Record<CombatXpKey, number>> = {};

  for (const [skill, xpRate] of Object.entries(xpDist)) {
    const key = skill as CombatXpKey;
    skillXpPerKill[key] = (skillXpPerKill[key] ?? 0) + xpRate * monster.hp * directFraction;
  }

  if (request.combatStyle === "magic" && request.spellId) {
    const spell = context.gameData.spells[request.spellId];
    const baseXp = spell?.baseXp ?? 0;
    const avgDamagePerHit = Math.max(1, combat.maxHit / 2);
    const landingDamageHp =
      options.directDamageFraction == null ? monster.hp : monster.hp * directFraction;
    const landingCasts = landingDamageHp / avgDamagePerHit;
    const totalCasts = landingCasts / Math.max(0.01, combat.hitChance);
    spellXpPerKill = baseXp * totalCasts;
    combatXpPerKill += spellXpPerKill;
    skillXpPerKill.mag = (skillXpPerKill.mag ?? 0) + spellXpPerKill;
  }

  skillXpPerKill.hp = hpXpPerKill;

  return {
    xpRouting: { ...xpDist, hp: 1.33 },
    skillXpPerKill,
    combatXpPerKill,
    hpXpPerKill,
    spellXpPerKill
  };
}

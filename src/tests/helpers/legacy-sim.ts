import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { createLegacyDerivedStaticRuntimeContext } from "../../adapters/static-runtime";
import { loadoutToCombatBonuses, sumEquipmentBonuses } from "../../domain/equipment";
import { EQUIPMENT_SLOTS, type CombatStyle, type Loadout } from "../../domain/shared";

export const LEGACY_SCRIPT_FILES = ["gamedata.js", "engine.js", "trip.js", "equipment.js"] as const;

export type CombatType = "melee" | "ranged" | "magic";

export interface LegacyGear {
  helm: string;
  amulet: string;
  body: string;
  legs: string;
  shield: string;
  gloves: string;
  boots: string;
  cape: string;
  ring: string;
}

export interface LegacyMonster extends Record<string, unknown> {
  id: string;
  name: string;
}

interface LegacyWeapon extends Record<string, unknown> {
  name: string;
  type: CombatType;
  sub?: string;
  ammoKey?: string;
  speed?: number;
}

interface LegacyAmmo extends Record<string, unknown> {
  name: string;
  rangeBonus?: number;
}

interface LegacySpell extends Record<string, unknown> {
  name: string;
  base: number;
}

interface LegacyLoadoutInput {
  accBonus: number;
  dmgBonus: number;
  accByType: Record<string, number> | null;
  attackSpeed?: number;
}

interface LegacyEngine {
  simulate(input: LegacyInput): Record<string, unknown>;
  WEAPONS: Record<string, LegacyWeapon>;
  ARROWS: Record<string, LegacyAmmo>;
  SPELLS: Record<string, LegacySpell>;
}

interface LegacyEquipment {
  loadoutToInput(
    loadout: LegacyGear & { weapon: string; ammo: string },
    combatType: CombatType
  ): LegacyLoadoutInput;
  sumBonuses(loadout: LegacyGear & { weapon: string; ammo: string }): Record<string, number>;
}

interface LegacyGameData extends Record<string, unknown> {
  MONSTERS: LegacyMonster[];
  ITEM_PRICES: Record<string, number>;
}

export interface LegacyRuntime extends Record<string, unknown> {
  window: LegacyRuntime;
  SimEngine: LegacyEngine;
  GameData: LegacyGameData;
  Equipment: LegacyEquipment;
}

export interface LegacyCaseDefinition {
  id: string;
  description: string;
  combatType: CombatType;
  monsterId: string;
  levels?: Partial<LegacyLevels>;
  style?: string;
  weapon?: string;
  ammo?: string;
  spell?: string;
  charge?: boolean;
  gear?: Partial<LegacyGear>;
  prayers?: string[];
  boosts?: string[];
  sustained?: boolean;
  repotThreshold?: number;
  trip?: Record<string, unknown>;
  ringOfWealth?: boolean;
  legends?: boolean;
  jewelSpot?: "underground" | "overground";
  specWeapon?: string;
  specAmmo?: string;
  cannon?: Record<string, unknown>;
  lootPrefs?: Record<string, string>;
  overheadSec?: number;
  notes?: string[];
}

interface LegacyLevels {
  attack: number;
  strength: number;
  defence: number;
  ranged: number;
  magic: number;
  prayer: number;
}

export interface LegacyInput extends Record<string, unknown> {
  combatType: CombatType;
  monster: LegacyMonster;
  attack: number;
  strength: number;
  defence: number;
  ranged: number;
  magic: number;
  prayer: number;
  style: string;
  weapon: string;
  ammo: string;
  gear: LegacyGear;
  accBonus: number;
  dmgBonus: number;
  accByType: Record<string, number> | null;
  attackSpeed: number;
  ammoRangeBonus: number;
}

const DEFAULT_LEVELS: LegacyLevels = {
  attack: 70,
  strength: 70,
  defence: 60,
  ranged: 70,
  magic: 70,
  prayer: 43
};

const DEFAULT_GEAR: LegacyGear = {
  helm: "none",
  amulet: "none",
  body: "none",
  legs: "none",
  shield: "none",
  gloves: "none",
  boots: "none",
  cape: "none",
  ring: "none"
};

const DEFAULT_WEAPON: Record<CombatType, string> = {
  melee: "rune_scimitar",
  ranged: "magic_shortbow",
  magic: "staff_of_fire"
};

const DEFAULT_STYLE: Record<CombatType, string> = {
  melee: "aggressive",
  ranged: "rapid",
  magic: "accurate"
};

const DEFAULT_TRIP = {
  foodKey: "none",
  teleport: false,
  bankSeconds: 0,
  prayerMode: "none",
  recoverAmmo: true
} satisfies Record<string, unknown>;

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    }
  };
}

export function createLegacyRuntime(rootDir = process.cwd()): LegacyRuntime {
  const context = {
    console,
    localStorage: createMemoryStorage(),
    setTimeout,
    clearTimeout
  } as Partial<LegacyRuntime> & Record<string, unknown>;
  context.window = context as LegacyRuntime;
  createContext(context);

  for (const fileName of LEGACY_SCRIPT_FILES) {
    const source = readFileSync(join(rootDir, fileName), "utf8");
    runInContext(source, context, { filename: fileName });
  }

  return context as LegacyRuntime;
}

/**
 * App-owned, non-executable compatibility facade for historical fixture inputs.
 *
 * Default tests use this committed static snapshot instead of opening root
 * legacy JavaScript. `createLegacyRuntime()` remains only for the explicit
 * manual capture path while that historical tool is retained.
 */
export function createLegacyFixtureRuntime(): LegacyRuntime {
  const { context } = createLegacyDerivedStaticRuntimeContext();
  const { gameData, priceSet } = context;
  const equipment = {
    SLOT_DEFS: EQUIPMENT_SLOTS.map((slot) => ({
      key: slot,
      label: slot,
      items: gameData.equipment[slot]
    })),
    sumBonuses(loadout: LegacyGear & { weapon: string; ammo: string }) {
      return sumEquipmentBonuses(
        {
          weaponId: loadout.weapon,
          ammoId: loadout.ammo,
          gear: loadout
        },
        gameData
      );
    },
    loadoutToInput(loadout: LegacyGear & { weapon: string; ammo: string }, combatType: CombatType) {
      return loadoutToCombatBonuses(
        {
          weaponId: loadout.weapon,
          ammoId: loadout.ammo,
          gear: loadout
        } satisfies Loadout,
        combatType satisfies CombatStyle,
        gameData
      );
    }
  };
  const runtime = {
    GameData: {
      MONSTERS: Object.values(gameData.monsters),
      ITEM_PRICES: priceSet.itemPrices,
      ALCH_VALUES: priceSet.alchValues
    },
    SimEngine: {
      simulate() {
        throw new Error(
          "Static legacy fixtures do not execute archived SimEngine; use committed expected output."
        );
      },
      WEAPONS: gameData.weapons,
      ARROWS: gameData.ammo,
      SPELLS: gameData.spells
    },
    Equipment: equipment
  } as unknown as LegacyRuntime;
  runtime.window = runtime;
  return runtime;
}

export function getMonster(runtime: LegacyRuntime, monsterId: string): LegacyMonster {
  const monster = runtime.GameData.MONSTERS.find((candidate) => candidate.id === monsterId);
  if (!monster) {
    throw new Error(`Unknown legacy monster id: ${monsterId}`);
  }

  return JSON.parse(JSON.stringify(monster)) as LegacyMonster;
}

export function buildLegacyInput(
  runtime: LegacyRuntime,
  definition: LegacyCaseDefinition
): LegacyInput {
  const levels = { ...DEFAULT_LEVELS, ...definition.levels };
  const combatType = definition.combatType;
  const weapon = definition.weapon ?? DEFAULT_WEAPON[combatType];
  const weaponDef = runtime.SimEngine.WEAPONS[weapon];
  const ammo = definition.ammo ?? (weaponDef?.sub === "bow" ? "rune_arrow" : "none");
  const gear = { ...DEFAULT_GEAR, ...definition.gear };
  const loadout = runtime.Equipment.loadoutToInput({ ...gear, weapon, ammo }, combatType);
  const spellKey = definition.spell ?? (combatType === "magic" ? "fire_bolt" : undefined);
  const spell = spellKey ? runtime.SimEngine.SPELLS[spellKey] : undefined;
  const ammoRangeBonus =
    combatType === "ranged" && weaponDef?.sub === "bow"
      ? (runtime.SimEngine.ARROWS[ammo]?.rangeBonus ?? 0)
      : 0;
  const attackSpeed = loadout.attackSpeed ?? weaponDef?.speed ?? 4;

  const input: LegacyInput = {
    ...levels,
    combatType,
    monster: getMonster(runtime, definition.monsterId),
    style: definition.style ?? DEFAULT_STYLE[combatType],
    weapon,
    ammo,
    gear,
    prayers: definition.prayers ?? ["none"],
    boosts: definition.boosts ?? ["none"],
    sustained: definition.sustained ?? false,
    repotThreshold: definition.repotThreshold,
    trip: { ...DEFAULT_TRIP, ...definition.trip },
    ringOfWealth: definition.ringOfWealth ?? gear.ring === "ring_of_wealth",
    legends: definition.legends ?? true,
    jewelSpotByMonster: { [definition.monsterId]: definition.jewelSpot ?? "underground" },
    specWeapon: definition.specWeapon ?? "none",
    specAmmo: definition.specAmmo,
    cannon: definition.cannon,
    lootPrefs: definition.lootPrefs,
    overheadSec: definition.overheadSec,
    accBonus: loadout.accBonus,
    dmgBonus: loadout.dmgBonus,
    accByType: loadout.accByType,
    attackSpeed,
    ammoRangeBonus
  };

  if (spellKey && spell) {
    input.spell = spellKey;
    input.spellBase = spell.base;
    input.charge = definition.charge;
  }

  return input;
}

export function runLegacyCase(definition: LegacyCaseDefinition): Record<string, unknown> {
  const runtime = createLegacyRuntime();
  return runtime.SimEngine.simulate(buildLegacyInput(runtime, definition));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stableNumber(value: unknown): number | null {
  const numeric = finiteNumber(value);
  return numeric === null ? null : Number(numeric.toFixed(6));
}

function stableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function summarizeLoot(rawRows: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(rawRows)) {
    return [];
  }

  return rawRows
    .map((row) => asRecord(row))
    .map((row) => ({
      name: String(row.name ?? ""),
      key: typeof row.key === "string" ? row.key : null,
      pref: typeof row.pref === "string" ? row.pref : null,
      evGp: stableNumber(row.evGp),
      prayerXp: stableNumber(row.prayerXp),
      slotFrac: stableNumber(row.slotFrac),
      alchValue: stableNumber(row.alchValue)
    }))
    .filter((row) => (row.evGp ?? 0) > 0 || (row.prayerXp ?? 0) > 0)
    .sort((left, right) => {
      const gpDelta = (right.evGp ?? 0) - (left.evGp ?? 0);
      return gpDelta !== 0 ? gpDelta : left.name.localeCompare(right.name);
    })
    .slice(0, 5);
}

function summarizeSkills(rawRows: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(rawRows)) {
    return [];
  }

  return rawRows.map((row) => {
    const record = asRecord(row);
    return {
      key: typeof record.key === "string" ? record.key : null,
      name: typeof record.name === "string" ? record.name : null,
      xpPerHour: stableNumber(record.xpPerHour)
    };
  });
}

export function summarizeLegacyResult(result: Record<string, unknown>): Record<string, unknown> {
  const trip = asRecord(result.trip);
  const tripSlots = asRecord(trip.slots);
  const cannon = asRecord(result.cannon);
  const scarce = asRecord(result.scarce);
  const spec = asRecord(result.specInfo);
  const poison = asRecord(result.poison);
  const recoil = asRecord(result.recoil);

  return {
    combatType: result.combatType,
    maxHit: stableNumber(result.maxHit),
    peakMaxHit: stableNumber(result.peakMaxHit),
    hitChance: stableNumber(result.hitChance),
    avgHit: stableNumber(result.avgHit),
    dps: stableNumber(result.dps),
    effDps: stableNumber(result.effDps),
    ttkSec: stableNumber(result.ttkSec),
    cycleSec: stableNumber(result.cycleSec),
    killsPerHour: stableNumber(result.killsPerHour),
    effectiveKph: stableNumber(result.effectiveKph),
    xpPerHour: stableNumber(result.xpPerHour),
    effectiveXpPerHour: stableNumber(result.effectiveXpPerHour),
    totalXpPerHour: stableNumber(result.totalXpPerHour),
    gpPerKill: stableNumber(result.gpPerKill),
    gpPerHour: stableNumber(result.gpPerHour),
    netGpPerHour: stableNumber(result.netGpPerHour),
    effectiveNetGpPerHour: stableNumber(result.effectiveNetGpPerHour),
    supplyCostPerKill: stableNumber(result.supplyCostPerKill),
    foodCostPerKill: stableNumber(result.foodCostPerKill),
    potionCostPerKill: stableNumber(result.potionCostPerKill),
    ammoCostPerKill: stableNumber(result.ammoCostPerKill),
    runeCostPerKill: stableNumber(result.runeCostPerKill),
    castsPerKill: stableNumber(result.castsPerKill),
    prayerXpPerKill: stableNumber(result.prayerXpPerKill),
    prayerPerKill: stableNumber(result.prayerPerKill),
    ammo:
      result.ammoKeyUsed === null || result.ammoKeyUsed === undefined
        ? null
        : {
            key: result.ammoKeyUsed,
            unitPrice: stableNumber(result.ammoUnitPrice),
            perKill: stableNumber(result.ammoPerKill),
            costPerKill: stableNumber(result.ammoCostPerKill)
          },
    trip:
      Object.keys(trip).length === 0
        ? null
        : {
            bound: trip.bound ?? null,
            killsPerTrip: stableNumber(trip.killsPerTrip),
            foodPerKill: stableNumber(trip.foodPerKill),
            lootFraction: stableNumber(trip.lootFraction),
            efficiency: stableNumber(trip.efficiency),
            effectiveKph: stableNumber(trip.effectiveKph),
            bankSeconds: stableNumber(trip.bankSeconds),
            incoming: {
              safespot: stableBoolean(asRecord(trip.incoming).safespot),
              safespotAuto: stableBoolean(asRecord(trip.incoming).safespotAuto),
              hpPerKill: stableNumber(asRecord(trip.incoming).hpPerKill),
              dragonfire: stableNumber(asRecord(trip.incoming).dragonfire),
              poison: stableNumber(asRecord(trip.incoming).poison)
            },
            slots: {
              reserve: stableNumber(tripSlots.reserve),
              stackReserve: stableNumber(tripSlots.stackReserve),
              foodCount: stableNumber(tripSlots.foodCount),
              lootCapacity: stableNumber(tripSlots.lootCapacity),
              nonStackPerKill: stableNumber(tripSlots.nonStackPerKill)
            }
          },
    cannon:
      Object.keys(cannon).length === 0
        ? null
        : {
            ballsPerKill: stableNumber(cannon.ballsPerKill),
            ballsPerHour: stableNumber(cannon.ballsPerHour),
            cannonDps: stableNumber(cannon.cannonDps),
            ballCostPerKill: stableNumber(cannon.ballCostPerKill),
            activeFrac: stableNumber(cannon.activeFrac),
            idle: stableBoolean(cannon.idle),
            respawnBound: stableBoolean(cannon.respawnBound)
          },
    scarce:
      Object.keys(scarce).length === 0
        ? null
        : {
            activeFrac: stableNumber(scarce.activeFrac),
            kph: stableNumber(scarce.kph),
            respawnBound: stableBoolean(scarce.respawnBound)
          },
    spec:
      Object.keys(spec).length === 0
        ? null
        : {
            key: spec.key ?? null,
            maxHit: stableNumber(spec.maxHit),
            hitChance: stableNumber(spec.hitChance),
            expPerSpec: stableNumber(spec.expPerSpec),
            specsPerHour: stableNumber(spec.specsPerHour),
            dpsGainPct: stableNumber(spec.dpsGainPct)
          },
    poison:
      Object.keys(poison).length === 0
        ? null
        : {
            severity: stableNumber(poison.severity),
            dps: stableNumber(poison.dps),
            directFrac: stableNumber(poison.directFrac)
          },
    recoil:
      Object.keys(recoil).length === 0
        ? null
        : {
            dps: stableNumber(recoil.dps),
            dmgPerKill: stableNumber(recoil.dmgPerKill),
            ringsPerKill: stableNumber(recoil.ringsPerKill),
            costPerKill: stableNumber(recoil.costPerKill)
          },
    topLoot: summarizeLoot(result.lootBreakdown),
    skillXpBreakdown: summarizeSkills(result.skillXpBreakdown)
  };
}

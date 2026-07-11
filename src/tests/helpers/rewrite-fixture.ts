import {
  DEFAULT_FORM_STATE,
  applyWeaponSelection,
  normalizeFormState,
  type CannonByMonsterState,
  type CombatSetupFormState
} from "../../app/state/ui-state";
import type { LootPrefsState } from "../../app/state/loot-prefs";
import type { LootSettingsByMonsterState } from "../../app/state/loot-settings";
import { createSimulationViewModel } from "../../app/view-models/simulation";
import { LOOT_ACTION_VALUES } from "../../app/state/loot-prefs";
import { normalizeLootName, type LootAction } from "../../domain/trip";
import type { EquipmentSlot, SimulationContext } from "../../domain/shared";
import type { LegacyCaseDefinition } from "./legacy-sim";

const DEFAULT_FIXTURE_LEVELS = {
  attack: 70,
  strength: 70,
  defence: 60,
  ranged: 70,
  magic: 70,
  prayer: 43
};

const DEFAULT_FIXTURE_GEAR: Record<EquipmentSlot, string> = {
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

const DEFAULT_FIXTURE_WEAPON = {
  melee: "rune_scimitar",
  ranged: "magic_shortbow",
  magic: "staff_of_fire"
} as const;

const DEFAULT_FIXTURE_STYLE = {
  melee: "aggressive",
  ranged: "rapid",
  magic: "accurate"
} as const;

export interface RewriteFixtureCase {
  id: string;
  form: CombatSetupFormState;
  cannonByMonster: CannonByMonsterState;
  lootPrefsByMonster: LootPrefsState;
  lootSettingsByMonster: LootSettingsByMonsterState;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function booleanValue(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  return typeof record[key] === "boolean" ? record[key] : fallback;
}

function numberValue(record: Record<string, unknown>, key: string, fallback: number): number {
  return typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] : fallback;
}

function nullableNumberValue(
  record: Record<string, unknown>,
  key: string,
  fallback: number | null
): number | null {
  return record[key] === null
    ? null
    : typeof record[key] === "number" && Number.isFinite(record[key])
      ? record[key]
      : fallback;
}

function stringValue(record: Record<string, unknown>, key: string, fallback: string): string {
  return typeof record[key] === "string" && record[key].length > 0 ? record[key] : fallback;
}

function fixtureForm(definition: LegacyCaseDefinition): CombatSetupFormState {
  const trip: Record<string, unknown> = {
    foodKey: "none",
    teleport: false,
    bankSeconds: 0,
    prayerMode: "none",
    recoverAmmo: true,
    ...recordValue(definition.trip)
  };
  const levels = { ...DEFAULT_FIXTURE_LEVELS, ...definition.levels };
  const weaponId = definition.weapon ?? DEFAULT_FIXTURE_WEAPON[definition.combatType];
  const ammoId = definition.ammo ?? (definition.combatType === "ranged" ? "rune_arrow" : "none");
  const spellId = definition.spell ?? "fire_bolt";
  const specialWeaponId = definition.specWeapon ?? "none";

  return normalizeFormState({
    ...DEFAULT_FORM_STATE,
    combatStyle: definition.combatType,
    monsterId: definition.monsterId,
    weaponId,
    ammoId,
    spellId,
    styleId: definition.style ?? DEFAULT_FIXTURE_STYLE[definition.combatType],
    levels: {
      ...DEFAULT_FORM_STATE.levels,
      ...levels
    },
    gear: {
      ...DEFAULT_FIXTURE_GEAR,
      ...definition.gear
    },
    prayers: definition.prayers ?? ["none"],
    boosts: definition.boosts ?? ["none"],
    sustained: definition.sustained ?? false,
    repotThreshold: definition.repotThreshold ?? null,
    specialAttack: {
      weaponId: specialWeaponId,
      ammoId: definition.specAmmo ?? (specialWeaponId === "none" ? "none" : ammoId)
    },
    ringOfWealth: definition.ringOfWealth ?? definition.gear?.ring === "ring_of_wealth",
    trip: {
      ...DEFAULT_FORM_STATE.trip,
      foodKey: stringValue(trip, "foodKey", "none"),
      teleport: booleanValue(trip, "teleport", false),
      bankSeconds: nullableNumberValue(trip, "bankSeconds", 0),
      potionSets: numberValue(trip, "potionSets", DEFAULT_FORM_STATE.trip.potionSets),
      potionDoses: numberValue(trip, "potionDoses", DEFAULT_FORM_STATE.trip.potionDoses),
      singleDose: booleanValue(trip, "singleDose", false),
      dbaRestore: booleanValue(trip, "dbaRestore", true),
      prayerMode:
        trip.prayerMode === "potions" || trip.prayerMode === "altar" ? trip.prayerMode : "none",
      alching: booleanValue(trip, "alching", false),
      recoverAmmo: booleanValue(trip, "recoverAmmo", true),
      runeSlots: numberValue(trip, "runeSlots", DEFAULT_FORM_STATE.trip.runeSlots),
      antifire: booleanValue(trip, "antifire", false),
      antipoison: booleanValue(trip, "antipoison", false),
      safespot:
        typeof trip.safespot === "boolean" ? trip.safespot : DEFAULT_FORM_STATE.trip.safespot,
      protect:
        trip.protect === "melee" || trip.protect === "missiles" || trip.protect === "magic"
          ? trip.protect
          : "none",
      recoilRings: numberValue(trip, "recoilRings", DEFAULT_FORM_STATE.trip.recoilRings),
      foodCount: nullableNumberValue(trip, "foodCount", null),
      foodPerKillOverride: nullableNumberValue(trip, "foodPerKillOverride", null),
      prayerPotionSets: nullableNumberValue(trip, "prayerPotionSets", null),
      prayerPotionDoses: nullableNumberValue(trip, "prayerPotionDoses", null),
      altarSeconds: nullableNumberValue(trip, "altarSeconds", null),
      scarceSpot: booleanValue(trip, "scarceSpot", false),
      targetsAtSpot: nullableNumberValue(trip, "targetsAtSpot", null),
      respawnSeconds: nullableNumberValue(trip, "respawnSeconds", null)
    }
  });
}

function fixtureCannonByMonster(definition: LegacyCaseDefinition): CannonByMonsterState {
  const cannon = recordValue(definition.cannon);
  if (!booleanValue(cannon, "enabled", false)) return {};
  return {
    [definition.monsterId]: {
      enabled: true,
      targets: numberValue(cannon, "targets", 3),
      respawnSec: nullableNumberValue(cannon, "respawnSec", null)
    }
  };
}

function fixtureLootSettings(definition: LegacyCaseDefinition): LootSettingsByMonsterState {
  if (definition.jewelSpot == null && definition.overheadSec == null) return {};
  return {
    [definition.monsterId]: {
      overheadSec: definition.overheadSec ?? null,
      talismanSpot: definition.jewelSpot ?? "underground"
    }
  };
}

function isLootAction(value: string): value is LootAction {
  return LOOT_ACTION_VALUES.some((action) => action === value);
}

function fixtureLootPrefs(
  definition: LegacyCaseDefinition,
  form: CombatSetupFormState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState,
  lootSettingsByMonster: LootSettingsByMonsterState
): LootPrefsState {
  if (!definition.lootPrefs || Object.keys(definition.lootPrefs).length === 0) return {};
  const base = createSimulationViewModel(form, context, cannonByMonster, {}, lootSettingsByMonster);
  const monsterPrefs: Record<string, LootAction> = {};

  for (const [name, rawAction] of Object.entries(definition.lootPrefs)) {
    if (!isLootAction(rawAction)) continue;
    const normalizedName = normalizeLootName(name);
    const matches = base.lootRows.filter(
      (row) =>
        normalizeLootName(row.name) === normalizedName ||
        (row.tag != null && normalizeLootName(row.tag) === normalizedName)
    );
    if (matches.length === 0) {
      throw new Error(`Fixture '${definition.id}' loot row '${name}' is not available.`);
    }
    for (const row of matches) monsterPrefs[row.rowId] = rawAction;
  }

  return Object.keys(monsterPrefs).length > 0 ? { [definition.monsterId]: monsterPrefs } : {};
}

export function createRewriteFixtureCase(
  definition: LegacyCaseDefinition,
  context: SimulationContext
): RewriteFixtureCase {
  if (definition.legends === false) {
    throw new Error(`Fixture '${definition.id}' requires unsupported legends=false UI state.`);
  }
  const fixture = fixtureForm(definition);
  const form = applyWeaponSelection(fixture, fixture.weaponId, context.gameData);
  const cannonByMonster = fixtureCannonByMonster(definition);
  const lootSettingsByMonster = fixtureLootSettings(definition);
  const lootPrefsByMonster = fixtureLootPrefs(
    definition,
    form,
    context,
    cannonByMonster,
    lootSettingsByMonster
  );
  return {
    id: definition.id,
    form,
    cannonByMonster,
    lootPrefsByMonster,
    lootSettingsByMonster
  };
}

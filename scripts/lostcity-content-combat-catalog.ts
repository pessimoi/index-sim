import type {
  AmmoDefinition,
  AttackType,
  EntityId,
  GameDataSnapshot,
  WeaponDefinition
} from "../src/domain/shared";
import {
  LostCityContentSourceError,
  configParamValue,
  lastConfigValue,
  resolvedConfigParamValue,
  type LostCityConfigCatalog,
  type LostCityConfigEntry
} from "./lostcity-content-config";
import {
  lostCityAmmoSourceId,
  lostCityWeaponSourceId
} from "./lostcity-content-runtime-mapping";
import { createLostCitySpellCandidate } from "./lostcity-content-spells";

export const LOSTCITY_WEAPON_COMPARISON_FIELDS = [
  "type",
  "wclass",
  "sub",
  "ammoKey",
  "accBonus",
  "dmgBonus",
  "speed",
  "acc.stab",
  "acc.slash",
  "acc.crush",
  "twoHand",
  "poisonSeverity",
  "provides",
  "alch"
] as const;

export const LOSTCITY_AMMO_COMPARISON_FIELDS = [
  "rangeBonus",
  "kind",
  "fam",
  "tier",
  "barKey",
  "priceKey",
  "alch",
  "price"
] as const;

function sourceEntry(
  kind: "weapon" | "ammo",
  runtimeId: EntityId,
  sourceId: EntityId,
  objects: LostCityConfigCatalog
): LostCityConfigEntry {
  const entry = objects.entries.get(sourceId);
  if (!entry) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity ${kind} source \`${sourceId}\` for \`${runtimeId}\` is missing.`
    );
  }
  return entry;
}

function sourceInteger(
  entry: LostCityConfigEntry,
  label: string,
  value: string | undefined,
  fallback = 0
): number {
  if (value === undefined) return fallback;
  if (!/^-?[0-9]+$/.test(value)) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity object \`${entry.sourceRef}\` has invalid ${label}.`
    );
  }
  return Number(value);
}

function sourceCost(entry: LostCityConfigEntry): number {
  return sourceInteger(entry, "cost", lastConfigValue(entry, "cost"), 1);
}

function sourceParamInteger(entry: LostCityConfigEntry, name: string, fallback = 0): number {
  return sourceInteger(entry, `param ${name}`, configParamValue(entry, name), fallback);
}

function sourceAlch(entry: LostCityConfigEntry): number {
  return Math.max(Math.floor((sourceCost(entry) * 6) / 10), 1);
}

function meleePrimaryAccuracy(
  wclass: string | undefined,
  accuracy: Record<AttackType, number>
): number {
  if (wclass === "dagger") return accuracy.stab;
  if (wclass === "mace") return accuracy.crush;
  return accuracy.slash;
}

export function extractLostCityWeaponSource(input: {
  runtimeId: EntityId;
  runtime: WeaponDefinition;
  objects: LostCityConfigCatalog;
  params: LostCityConfigCatalog;
}): WeaponDefinition {
  const sourceId = lostCityWeaponSourceId(input.runtimeId);
  const entry = sourceEntry("weapon", input.runtimeId, sourceId, input.objects);
  const accuracy = {
    stab: sourceParamInteger(entry, "stabattack"),
    slash: sourceParamInteger(entry, "slashattack"),
    crush: sourceParamInteger(entry, "crushattack")
  };
  const speed = sourceInteger(
    entry,
    "param attackrate",
    resolvedConfigParamValue(entry, input.params, "attackrate"),
    4
  );
  const accBonus = input.runtime.type === "melee"
    ? meleePrimaryAccuracy(input.runtime.wclass, accuracy)
    : input.runtime.type === "ranged"
      ? sourceParamInteger(entry, "rangeattack")
      : sourceParamInteger(entry, "magicattack");
  const poisonSeverity = sourceParamInteger(entry, "poison_severity");

  return {
    name: input.runtime.name,
    type: input.runtime.type,
    ...(input.runtime.wclass ? { wclass: input.runtime.wclass } : {}),
    ...(input.runtime.sub ? { sub: input.runtime.sub } : {}),
    ...(input.runtime.ammoKey ? { ammoKey: input.runtime.ammoKey } : {}),
    accBonus,
    dmgBonus: input.runtime.type === "melee" ? sourceParamInteger(entry, "strengthbonus") : 0,
    speed,
    ...(input.runtime.type === "melee" ? { acc: accuracy } : {}),
    ...(lastConfigValue(entry, "wearpos2") === "lefthand" ? { twoHand: true } : {}),
    ...(poisonSeverity > 0 ? { poisonSeverity } : {}),
    ...(input.runtime.provides ? { provides: input.runtime.provides } : {}),
    alch: sourceAlch(entry)
  };
}

export function extractLostCityAmmoSource(input: {
  runtimeId: EntityId;
  runtime: AmmoDefinition;
  objects: LostCityConfigCatalog;
}): AmmoDefinition {
  const sourceId = lostCityAmmoSourceId(input.runtimeId);
  const entry = sourceEntry("ammo", input.runtimeId, sourceId, input.objects);
  const cost = sourceCost(entry);
  return {
    name: input.runtime.name,
    rangeBonus: sourceParamInteger(entry, "rangebonus"),
    ...(input.runtime.kind ? { kind: input.runtime.kind } : {}),
    ...(input.runtime.fam ? { fam: input.runtime.fam } : {}),
    ...(input.runtime.tier !== undefined ? { tier: input.runtime.tier } : {}),
    ...(input.runtime.barKey ? { barKey: input.runtime.barKey } : {}),
    ...(input.runtime.priceKey ? { priceKey: input.runtime.priceKey } : {}),
    alch: Math.max(Math.floor((cost * 6) / 10), 1),
    price: cost
  };
}

export function createLostCityCombatCatalogCandidate(
  reference: GameDataSnapshot,
  objects: LostCityConfigCatalog,
  params: LostCityConfigCatalog,
  dbrows: LostCityConfigCatalog
): GameDataSnapshot {
  const combatCatalogCandidate = {
    ...reference,
    id: `${reference.id}-lostcity-combat-catalog-candidate`,
    label: `${reference.label} with LostCity weapon and ammo fields`,
    weapons: Object.fromEntries(
      Object.entries(reference.weapons).map(([runtimeId, runtime]) => [
        runtimeId,
        extractLostCityWeaponSource({ runtimeId, runtime, objects, params })
      ])
    ),
    ammo: Object.fromEntries(
      Object.entries(reference.ammo).map(([runtimeId, runtime]) => [
        runtimeId,
        extractLostCityAmmoSource({ runtimeId, runtime, objects })
      ])
    )
  };
  return createLostCitySpellCandidate(combatCatalogCandidate, dbrows);
}

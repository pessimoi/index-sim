import type { GameDataSnapshot, MonsterDefinition } from "../src/domain/shared";
import {
  LostCityContentSourceError,
  configParamValue,
  lastConfigValue,
  type LostCityConfigCatalog,
  type LostCityConfigEntry
} from "./lostcity-content-config";
import {
  LOSTCITY_MONSTER_SOURCE_MAPPINGS,
  lostCityMonsterSourceId
} from "./lostcity-content-runtime-mapping";

export const LOSTCITY_MONSTER_COMBAT_FIELDS = [
  "level",
  "hp",
  "attack",
  "strength",
  "defLevel",
  "attackSpeed",
  "attBonus",
  "strBonus",
  "magicLevel",
  "defStab",
  "defSlash",
  "defCrush",
  "defRange",
  "defMagic"
] as const satisfies ReadonlyArray<keyof MonsterDefinition>;

export type LostCityMonsterCombatFields = Pick<
  MonsterDefinition,
  (typeof LOSTCITY_MONSTER_COMBAT_FIELDS)[number]
>;

export interface LostCityMonsterCombatSource {
  runtimeId: string;
  sourceId: string;
  sourceRef: string;
  fields: LostCityMonsterCombatFields;
}

function integerValue(
  entry: LostCityConfigEntry,
  label: string,
  value: string | undefined,
  fallback?: number
): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (value === undefined || !/^-?[0-9]+$/.test(value)) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity config \`${entry.sourceRef}\` has invalid numeric ${label}.`
    );
  }
  return Number(value);
}

function propertyInteger(entry: LostCityConfigEntry, key: string, fallback?: number): number {
  return integerValue(entry, key, lastConfigValue(entry, key), fallback);
}

function paramInteger(entry: LostCityConfigEntry, key: string, fallback: number): number {
  return integerValue(entry, `param ${key}`, configParamValue(entry, key), fallback);
}

export function extractLostCityMonsterCombatSource(
  runtimeId: string,
  catalog: LostCityConfigCatalog
): LostCityMonsterCombatSource {
  const sourceId = lostCityMonsterSourceId(runtimeId);
  const entry = catalog.entries.get(sourceId);
  if (!entry) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity monster mapping for \`${runtimeId}\` does not resolve to a parsed NPC config.`
    );
  }
  const mapping = LOSTCITY_MONSTER_SOURCE_MAPPINGS[runtimeId];
  if (mapping && mapping.sourceRef !== entry.sourceRef) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity monster mapping for \`${runtimeId}\` has stale source evidence.`
    );
  }

  return {
    runtimeId,
    sourceId,
    sourceRef: entry.sourceRef,
    fields: {
      level: propertyInteger(entry, "vislevel"),
      hp: propertyInteger(entry, "hitpoints", 1),
      attack: propertyInteger(entry, "attack", 1),
      strength: propertyInteger(entry, "strength", 1),
      defLevel: propertyInteger(entry, "defence", 1),
      attackSpeed: paramInteger(entry, "attackrate", 4),
      attBonus: paramInteger(entry, "attackbonus", 0),
      strBonus: paramInteger(entry, "strengthbonus", 0),
      magicLevel: propertyInteger(entry, "magic", 1),
      defStab: paramInteger(entry, "stabdefence", 0),
      defSlash: paramInteger(entry, "slashdefence", 0),
      defCrush: paramInteger(entry, "crushdefence", 0),
      defRange: paramInteger(entry, "rangedefence", 0),
      defMagic: paramInteger(entry, "magicdefence", 0)
    }
  };
}

export function createLostCityMonsterCombatCandidate(
  reference: GameDataSnapshot,
  catalog: LostCityConfigCatalog
): GameDataSnapshot {
  return {
    ...reference,
    id: `${reference.id}-lostcity-monster-combat-candidate`,
    label: `${reference.label} with LostCity monster combat fields`,
    monsters: Object.fromEntries(
      Object.entries(reference.monsters).map(([runtimeId, monster]) => [
        runtimeId,
        {
          ...monster,
          ...extractLostCityMonsterCombatSource(runtimeId, catalog).fields
        }
      ])
    )
  };
}

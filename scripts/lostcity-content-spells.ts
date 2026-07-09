import type { EntityId, GameDataSnapshot, SpellDefinition } from "../src/domain/shared";
import {
  LostCityContentSourceError,
  type LostCityConfigCatalog,
  type LostCityConfigEntry
} from "./lostcity-content-config";

export const LOSTCITY_SPELL_COMPARISON_FIELDS = [
  "base",
  "lvl",
  "baseXp",
  "god",
  "staff",
  "runes"
] as const;

const GOD_STAFF_NAMES: Readonly<Record<EntityId, string>> = {
  saradomin_staff: "Staff of Saradomin",
  guthix_staff: "Staff of Guthix",
  zamorak_staff: "Staff of Zamorak"
};

function spellEntry(runtimeId: EntityId, dbrows: LostCityConfigCatalog): LostCityConfigEntry {
  const entry = dbrows.entries.get(`magic_spell_${runtimeId}`);
  if (!entry) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity spell dbrow for \`${runtimeId}\` is missing.`
    );
  }
  return entry;
}

function dataValue(entry: LostCityConfigEntry, column: string): string | undefined {
  const prefix = `${column},`;
  const rows = entry.properties.data ?? [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].startsWith(prefix)) return rows[index].slice(prefix.length);
  }
  return undefined;
}

function requiredDataValue(entry: LostCityConfigEntry, column: string): string {
  const value = dataValue(entry, column);
  if (value === undefined) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity spell \`${entry.sourceRef}\` is missing ${column}.`
    );
  }
  return value;
}

function sourceInteger(entry: LostCityConfigEntry, column: string): number {
  const value = requiredDataValue(entry, column);
  if (!/^[0-9]+$/.test(value)) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity spell \`${entry.sourceRef}\` has invalid ${column}.`
    );
  }
  return Number(value);
}

function sourceRunes(entry: LostCityConfigEntry): Record<EntityId, number> {
  const tokens = requiredDataValue(entry, "runesrequired").split(",");
  if (tokens.length === 0 || tokens.length % 2 !== 0) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity spell \`${entry.sourceRef}\` has invalid runesrequired pairs.`
    );
  }
  const runes: Record<EntityId, number> = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const runeId = tokens[index];
    const quantity = tokens[index + 1];
    if (runeId === "null" && quantity === "null") continue;
    if (!runeId || runeId === "null" || !/^[1-9][0-9]*$/.test(quantity)) {
      throw new LostCityContentSourceError(
        "config_invalid",
        `LostCity spell \`${entry.sourceRef}\` has invalid runesrequired pairs.`
      );
    }
    if (runes[runeId] !== undefined) {
      throw new LostCityContentSourceError(
        "config_invalid",
        `LostCity spell \`${entry.sourceRef}\` repeats rune \`${runeId}\`.`
      );
    }
    runes[runeId] = Number(quantity);
  }
  if (Object.keys(runes).length === 0) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity spell \`${entry.sourceRef}\` has no rune requirements.`
    );
  }
  return runes;
}

export function extractLostCitySpellSource(input: {
  runtimeId: EntityId;
  runtime: SpellDefinition;
  dbrows: LostCityConfigCatalog;
}): SpellDefinition {
  const entry = spellEntry(input.runtimeId, input.dbrows);
  const sourceSpellId = requiredDataValue(entry, "spell");
  if (sourceSpellId !== `^${input.runtimeId}`) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity spell \`${entry.sourceRef}\` points to \`${sourceSpellId}\` instead of \`^${input.runtimeId}\`.`
    );
  }
  const base = sourceInteger(entry, "maxhit");
  const experienceTenths = sourceInteger(entry, "experience");
  const wornRequired = dataValue(entry, "wornrequired");
  const godStaff = wornRequired ? GOD_STAFF_NAMES[wornRequired] : undefined;
  if (wornRequired && !godStaff) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity runtime spell \`${input.runtimeId}\` has unsupported worn requirement \`${wornRequired}\`.`
    );
  }
  const name = dataValue(entry, "name") ?? input.runtime.name;
  return {
    name,
    base,
    lvl: sourceInteger(entry, "levelrequired"),
    baseXp: experienceTenths / 10,
    ...(godStaff ? { god: true, staff: godStaff } : {}),
    ...(input.runtime.label ? { label: input.runtime.label } : {}),
    runes: sourceRunes(entry)
  };
}

export function createLostCitySpellCandidate(
  reference: GameDataSnapshot,
  dbrows: LostCityConfigCatalog
): GameDataSnapshot {
  return {
    ...reference,
    id: `${reference.id}-lostcity-spell-candidate`,
    label: `${reference.label} with LostCity spell fields`,
    spells: Object.fromEntries(
      Object.entries(reference.spells).map(([runtimeId, runtime]) => [
        runtimeId,
        extractLostCitySpellSource({ runtimeId, runtime, dbrows })
      ])
    )
  };
}

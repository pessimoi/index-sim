import {
  BONUS_KEYS,
  EQUIPMENT_SLOTS,
  type BonusKey,
  type EntityId,
  type EquipmentItemDefinition,
  type EquipmentSlot,
  type GameDataSnapshot
} from "../src/domain/shared";
import {
  LostCityContentSourceError,
  configParamValue,
  lastConfigValue,
  type LostCityConfigCatalog,
  type LostCityConfigEntry
} from "./lostcity-content-config";
import { LOSTCITY_EQUIPMENT_SOURCE_MAPPINGS } from "./lostcity-content-runtime-mapping";

const BONUS_PARAM_BY_KEY: Readonly<Record<BonusKey, string>> = {
  stabAtt: "stabattack",
  slashAtt: "slashattack",
  crushAtt: "crushattack",
  magAtt: "magicattack",
  rngAtt: "rangeattack",
  stabDef: "stabdefence",
  slashDef: "slashdefence",
  crushDef: "crushdefence",
  magDef: "magicdefence",
  rngDef: "rangedefence",
  str: "strengthbonus",
  rngStr: "rangebonus",
  magDmg: "magicdamage",
  prayer: "prayerbonus"
};

export const LOSTCITY_EQUIPMENT_COMPARISON_FIELDS = [
  "alch",
  "recoil",
  ...BONUS_KEYS
] as const;

export interface LostCityEquipmentSource {
  slot: EquipmentSlot;
  runtimeId: EntityId;
  sourceItemId?: EntityId;
  sourceRef: string;
  resolution: "direct" | "explicit" | "unique-name" | "synthetic";
  definition: EquipmentItemDefinition;
}

function normalizedEntityName(name: string | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNameSourceId(
  runtimeName: string,
  objects: LostCityConfigCatalog
): EntityId | undefined {
  const normalizedName = normalizedEntityName(runtimeName);
  const matches = [...objects.entries.entries()].flatMap(([sourceId, entry]) =>
    normalizedEntityName(lastConfigValue(entry, "name")) === normalizedName ? [sourceId] : []
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function sourceEntryForEquipment(input: {
  slot: EquipmentSlot;
  runtimeId: EntityId;
  runtimeName: string;
  objects: LostCityConfigCatalog;
}): {
  sourceItemId: EntityId;
  entry: LostCityConfigEntry;
  resolution: "direct" | "explicit" | "unique-name";
} {
  const equipmentId = `${input.slot}:${input.runtimeId}`;
  const explicit = LOSTCITY_EQUIPMENT_SOURCE_MAPPINGS[equipmentId];
  const sourceItemId = explicit?.sourceItemId ??
    (input.objects.entries.has(input.runtimeId)
      ? input.runtimeId
      : uniqueNameSourceId(input.runtimeName, input.objects));
  if (!sourceItemId) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity equipment mapping for \`${equipmentId}\` is unresolved.`
    );
  }
  const entry = input.objects.entries.get(sourceItemId);
  if (!entry) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity equipment source \`${sourceItemId}\` for \`${equipmentId}\` is missing.`
    );
  }
  return {
    sourceItemId,
    entry,
    resolution: explicit
      ? "explicit"
      : sourceItemId === input.runtimeId
        ? "direct"
        : "unique-name"
  };
}

function sourceInteger(
  entry: LostCityConfigEntry,
  property: "cost" | "param",
  value: string | undefined,
  fallback = 0
): number {
  if (value === undefined) return fallback;
  if (!/^-?[0-9]+$/.test(value)) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity object \`${entry.sourceRef}\` has invalid ${property} value.`
    );
  }
  return Number(value);
}

export function extractLostCityEquipmentSource(input: {
  slot: EquipmentSlot;
  runtimeId: EntityId;
  runtime: EquipmentItemDefinition;
  objects: LostCityConfigCatalog;
}): LostCityEquipmentSource {
  if (input.runtimeId === "none") {
    return {
      slot: input.slot,
      runtimeId: input.runtimeId,
      sourceRef: "simulator synthetic None sentinel",
      resolution: "synthetic",
      definition: { name: input.runtime.name }
    };
  }

  const source = sourceEntryForEquipment({
    slot: input.slot,
    runtimeId: input.runtimeId,
    runtimeName: input.runtime.name,
    objects: input.objects
  });
  const cost = sourceInteger(source.entry, "cost", lastConfigValue(source.entry, "cost"), 1);
  const bonuses = Object.fromEntries(
    BONUS_KEYS.flatMap((key) => {
      const value = sourceInteger(
        source.entry,
        "param",
        configParamValue(source.entry, BONUS_PARAM_BY_KEY[key])
      );
      return value === 0 ? [] : [[key, value]];
    })
  ) as Partial<Record<BonusKey, number>>;

  return {
    slot: input.slot,
    runtimeId: input.runtimeId,
    sourceItemId: source.sourceItemId,
    sourceRef: source.entry.sourceRef,
    resolution: source.resolution,
    definition: {
      name: input.runtime.name,
      alch: Math.max(Math.floor((cost * 6) / 10), 1),
      ...(input.runtimeId === "ring_of_recoil" ? { recoil: true } : {}),
      ...bonuses
    }
  };
}

export function createLostCityEquipmentCandidate(
  reference: GameDataSnapshot,
  objects: LostCityConfigCatalog
): GameDataSnapshot {
  const equipment = Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [
      slot,
      Object.fromEntries(
        Object.entries(reference.equipment[slot]).map(([runtimeId, runtime]) => [
          runtimeId,
          extractLostCityEquipmentSource({ slot, runtimeId, runtime, objects }).definition
        ])
      )
    ])
  ) as GameDataSnapshot["equipment"];

  return {
    ...reference,
    id: `${reference.id}-lostcity-equipment-candidate`,
    label: `${reference.label} with LostCity equipment fields`,
    equipment
  };
}

import {
  EQUIPMENT_SLOTS,
  type DataProvenance,
  type EntityId,
  type EquipmentRegistry,
  type GameDataSnapshot,
  type ItemDefinition,
  type PriceSet
} from "../domain/shared";
import { assertUniqueRecordIds } from "./reliability";
import { parseGameDataSnapshot } from "./schemas/game-data";
import { createPriceSetFromLegacyRecords } from "./schemas/price-set";

export const LEGACY_DATA_PROVENANCE = {
  source: "manual",
  sourceRef: "gamedata.js, engine.js and equipment.js in this checkout",
  verifiedAt: "2026-07-05",
  notes:
    "Legacy runtime data mixes generated-looking rev-274 comments, scraped overrides, static placeholders and manual approximations."
} satisfies DataProvenance;

interface LegacyGameDataInput {
  MONSTERS: Array<Record<string, unknown>>;
  ITEM_PRICES: Record<string, unknown>;
  ALCH_VALUES?: Record<string, unknown>;
  scrapedAt?: number | null;
}

interface LegacyEngineInput {
  WEAPONS: Record<string, unknown>;
  ARROWS: Record<string, unknown>;
  SPELLS: Record<string, unknown>;
}

interface LegacyEquipmentInput {
  SLOT_DEFS: Array<{
    key: string;
    items: Record<string, unknown>;
  }>;
}

export interface LegacySnapshotInput {
  gameData: LegacyGameDataInput;
  simEngine: LegacyEngineInput;
  equipment: LegacyEquipmentInput;
  id?: string;
  label?: string;
  provenance?: DataProvenance;
}

export interface LegacyPriceSetInput {
  gameData: LegacyGameDataInput;
  id?: string;
  label?: string;
  source?: PriceSet["source"];
  createdAt?: string;
  provenance?: DataProvenance;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function addName(names: Map<EntityId, string>, id: unknown, name: unknown): void {
  if (typeof id !== "string" || !id || id === "none") return;
  if (typeof name !== "string" || !name) return;
  if (!names.has(id)) names.set(id, name);
}

function collectLootItemNames(loot: unknown, names: Map<EntityId, string>): void {
  if (!Array.isArray(loot)) return;
  for (const entry of loot) {
    const drops = Array.isArray(entry) ? entry : [entry];
    for (const drop of drops) {
      if (!isRecord(drop)) continue;
      addName(names, drop.key, drop.name);
    }
  }
}

function collectItemNames(
  input: LegacySnapshotInput,
  equipment: EquipmentRegistry
): Map<EntityId, string> {
  const names = new Map<EntityId, string>();

  for (const [id, rawWeapon] of Object.entries(input.simEngine.WEAPONS)) {
    if (isRecord(rawWeapon)) addName(names, id, rawWeapon.name);
  }

  for (const [id, rawAmmo] of Object.entries(input.simEngine.ARROWS)) {
    if (!isRecord(rawAmmo)) continue;
    addName(names, id, rawAmmo.name);
    addName(names, rawAmmo.priceKey, rawAmmo.name);
  }

  for (const slotItems of Object.values(equipment)) {
    for (const [id, rawItem] of Object.entries(slotItems)) {
      addName(names, id, rawItem.name);
    }
  }

  for (const monster of input.gameData.MONSTERS) {
    collectLootItemNames(monster.loot, names);
  }

  return names;
}

function createEquipmentRegistry(input: LegacyEquipmentInput): EquipmentRegistry {
  const equipment = Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot, {}])
  ) as EquipmentRegistry;

  for (const slotDef of input.SLOT_DEFS) {
    if (!EQUIPMENT_SLOTS.includes(slotDef.key as (typeof EQUIPMENT_SLOTS)[number])) continue;
    equipment[slotDef.key as (typeof EQUIPMENT_SLOTS)[number]] =
      slotDef.items as EquipmentRegistry[(typeof EQUIPMENT_SLOTS)[number]];
  }

  return equipment;
}

function createItems(
  priceSet: PriceSet,
  names: Map<EntityId, string>,
  provenance: DataProvenance
): Record<EntityId, ItemDefinition> {
  const itemIds = new Set<EntityId>([
    ...Object.keys(priceSet.itemPrices),
    ...Object.keys(priceSet.alchValues),
    ...names.keys()
  ]);
  const items: Record<EntityId, ItemDefinition> = {};

  for (const id of [...itemIds].sort()) {
    if (id === "none") continue;
    const price = numberField(priceSet.itemPrices, id);
    const alch = numberField(priceSet.alchValues, id);
    items[id] = {
      id,
      name: names.get(id) ?? id,
      ...(price !== undefined ? { price } : {}),
      ...(alch !== undefined ? { alch } : {}),
      provenance
    };
  }

  return items;
}

export function createPriceSetFromLegacyGameData(input: LegacyPriceSetInput): PriceSet {
  return createPriceSetFromLegacyRecords({
    id: input.id ?? "legacy-bundled-prices",
    label: input.label ?? "Legacy bundled prices",
    source: input.source ?? "bundled",
    createdAt: input.createdAt,
    itemPrices: input.gameData.ITEM_PRICES,
    alchValues: input.gameData.ALCH_VALUES ?? {},
    provenance: input.provenance ?? LEGACY_DATA_PROVENANCE
  });
}

export function createGameDataSnapshotFromLegacy(input: LegacySnapshotInput): GameDataSnapshot {
  const provenance = input.provenance ?? LEGACY_DATA_PROVENANCE;
  assertUniqueRecordIds(input.gameData.MONSTERS, { label: "legacy monsters" });
  const equipment = createEquipmentRegistry(input.equipment);
  const priceSet = createPriceSetFromLegacyGameData({
    gameData: input.gameData,
    provenance
  });
  const names = collectItemNames(input, equipment);

  const candidate = {
    id: input.id ?? "legacy-runtime",
    label: input.label ?? "Legacy runtime game data",
    items: createItems(priceSet, names, provenance),
    monsters: Object.fromEntries(
      input.gameData.MONSTERS.map((monster) => [stringField(monster, "id") ?? "", monster])
    ),
    weapons: input.simEngine.WEAPONS,
    ammo: input.simEngine.ARROWS,
    spells: input.simEngine.SPELLS,
    equipment,
    provenance
  };

  return parseGameDataSnapshot(candidate);
}

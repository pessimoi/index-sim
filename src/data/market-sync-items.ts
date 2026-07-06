import type {
  DropDefinition,
  DropEntry,
  EntityId,
  GameDataSnapshot,
  MarketSourceMapping,
  MarketSyncRequest
} from "../domain/shared";
import {
  getMarketSourceMapping,
  MARKET_SOURCE_MAPPINGS,
  MARKET_SOURCE_MAPPING_BY_ITEM_ID
} from "./market-source-mapping";

export const MARKET_SYNC_TAG_ITEM_IDS: Record<string, readonly EntityId[]> = {
  gem: ["uncut_sapphire", "uncut_emerald", "uncut_ruby", "uncut_diamond", "dragonstone"],
  casket: [
    "uncut_sapphire",
    "uncut_emerald",
    "uncut_ruby",
    "uncut_diamond",
    "loop_half_key",
    "tooth_half_key",
    "cosmic_talisman"
  ],
  herb: [
    "herb_guam",
    "herb_marrentill",
    "herb_tarromin",
    "herb_harralander",
    "herb_ranarr",
    "herb_irit",
    "herb_avantoe",
    "herb_kwuarm",
    "herb_cadantine",
    "herb_lantadyme",
    "herb_dwarf_weed",
    "unidentified_guam"
  ]
};

export const MARKET_SYNC_SUPPORT_ITEM_IDS: readonly EntityId[] = [
  "ring_of_recoil",
  "chaos_talisman",
  "nature_talisman"
];

export interface MarketSyncItemExpansion {
  itemIds: EntityId[];
  missingMappingItemIds: EntityId[];
}

function addSupportedItem(
  itemIds: Set<EntityId>,
  missingMappingItemIds: Set<EntityId>,
  itemId: EntityId | undefined
): void {
  if (!itemId || itemId === "coins") return;
  if (MARKET_SOURCE_MAPPING_BY_ITEM_ID.has(itemId)) {
    itemIds.add(itemId);
    return;
  }
  missingMappingItemIds.add(itemId);
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

function addDropItems(
  itemIds: Set<EntityId>,
  missingMappingItemIds: Set<EntityId>,
  drop: DropDefinition
): void {
  const tagItems = drop.tag ? MARKET_SYNC_TAG_ITEM_IDS[drop.tag] : undefined;
  if (tagItems) {
    for (const itemId of tagItems) addSupportedItem(itemIds, missingMappingItemIds, itemId);
    return;
  }
  addSupportedItem(itemIds, missingMappingItemIds, drop.key);
}

export function expandMarketSyncItemIdsForMonster(
  gameData: GameDataSnapshot,
  monsterId: EntityId
): MarketSyncItemExpansion {
  const monster = gameData.monsters[monsterId];
  const itemIds = new Set<EntityId>();
  const missingMappingItemIds = new Set<EntityId>();

  for (const drop of flattenLoot(monster?.loot)) {
    addDropItems(itemIds, missingMappingItemIds, drop);
  }

  for (const itemId of MARKET_SYNC_SUPPORT_ITEM_IDS) {
    addSupportedItem(itemIds, missingMappingItemIds, itemId);
  }

  return {
    itemIds: [...itemIds].sort(),
    missingMappingItemIds: [...missingMappingItemIds].sort()
  };
}

export function expandAllSupportedMarketSyncItemIds(): EntityId[] {
  return MARKET_SOURCE_MAPPINGS.filter((mapping) => mapping.syncPrice || mapping.syncAlch)
    .map((mapping) => mapping.itemId)
    .sort();
}

export function marketMappingsForItemIds(itemIds: Iterable<EntityId>): MarketSourceMapping[] {
  return [...itemIds].flatMap((itemId) => {
    const mapping = getMarketSourceMapping(itemId);
    return mapping ? [mapping] : [];
  });
}

export function expandMarketSyncRequestItems(
  gameData: GameDataSnapshot,
  request: MarketSyncRequest
): MarketSyncItemExpansion {
  if (request.scope === "all-supported") {
    return {
      itemIds: expandAllSupportedMarketSyncItemIds(),
      missingMappingItemIds: []
    };
  }

  if (request.scope === "items") {
    const itemIds = new Set<EntityId>();
    const missingMappingItemIds = new Set<EntityId>();
    for (const itemId of request.itemIds ?? []) {
      addSupportedItem(itemIds, missingMappingItemIds, itemId);
    }
    return {
      itemIds: [...itemIds].sort(),
      missingMappingItemIds: [...missingMappingItemIds].sort()
    };
  }

  return expandMarketSyncItemIdsForMonster(gameData, request.monsterId ?? "");
}

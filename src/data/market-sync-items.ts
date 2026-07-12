import type {
  DropDefinition,
  DropEntry,
  EntityId,
  GameDataSnapshot,
  MarketSourceMapping,
  MarketSyncRequest
} from "../domain/shared";
import { DYNAMIC_LOOT_PRICE_DEPENDENCIES } from "../domain/trip";
import {
  getMarketSourceMapping,
  MARKET_SOURCE_MAPPINGS,
  MARKET_SOURCE_MAPPING_BY_ITEM_ID
} from "./market-source-mapping";

export const MARKET_SYNC_TAG_ITEM_IDS: Record<string, readonly EntityId[]> =
  DYNAMIC_LOOT_PRICE_DEPENDENCIES;

export const MARKET_SYNC_SUPPORT_ITEM_IDS: readonly EntityId[] = [
  "ring_of_recoil",
  "chaos_talisman",
  "nature_talisman"
];

export interface MarketSyncItemExpansion {
  itemIds: EntityId[];
  missingMappingItemIds: EntityId[];
}

export interface DynamicLootMarketDependencyRow {
  tag: string;
  monsterIds: EntityId[];
  dropCount: number;
  dependencyItemIds: EntityId[];
  mappedItemIds: EntityId[];
  missingMappingItemIds: EntityId[];
}

export interface DynamicLootMarketDependencyAudit {
  rows: DynamicLootMarketDependencyRow[];
  dependencyItemIds: EntityId[];
  mappedItemIds: EntityId[];
  missingMappingItemIds: EntityId[];
  unrecognizedActiveTags: string[];
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

export function auditDynamicLootMarketDependencies(
  gameData: GameDataSnapshot
): DynamicLootMarketDependencyAudit {
  const usageByTag = new Map<string, { monsterIds: Set<EntityId>; dropCount: number }>();
  const unrecognizedActiveTags = new Set<string>();

  for (const monster of Object.values(gameData.monsters)) {
    for (const drop of flattenLoot(monster.loot)) {
      if (!drop.tag || drop.eligibility) continue;
      if (!MARKET_SYNC_TAG_ITEM_IDS[drop.tag]) {
        unrecognizedActiveTags.add(drop.tag);
        continue;
      }
      const usage = usageByTag.get(drop.tag) ?? { monsterIds: new Set<EntityId>(), dropCount: 0 };
      usage.monsterIds.add(monster.id);
      usage.dropCount += 1;
      usageByTag.set(drop.tag, usage);
    }
  }

  const rows = Object.entries(MARKET_SYNC_TAG_ITEM_IDS)
    .map(([tag, dependencies]): DynamicLootMarketDependencyRow => {
      const usage = usageByTag.get(tag);
      const dependencyItemIds = [...dependencies].sort();
      const mappedItemIds = dependencyItemIds.filter((itemId) =>
        MARKET_SOURCE_MAPPING_BY_ITEM_ID.has(itemId)
      );
      return {
        tag,
        monsterIds: [...(usage?.monsterIds ?? [])].sort(),
        dropCount: usage?.dropCount ?? 0,
        dependencyItemIds,
        mappedItemIds,
        missingMappingItemIds: dependencyItemIds.filter(
          (itemId) => !MARKET_SOURCE_MAPPING_BY_ITEM_ID.has(itemId)
        )
      };
    })
    .sort((left, right) => left.tag.localeCompare(right.tag));
  const dependencyItemIds = [...new Set(rows.flatMap((row) => row.dependencyItemIds))].sort();
  const mappedItemIds = dependencyItemIds.filter((itemId) =>
    MARKET_SOURCE_MAPPING_BY_ITEM_ID.has(itemId)
  );

  return {
    rows,
    dependencyItemIds,
    mappedItemIds,
    missingMappingItemIds: dependencyItemIds.filter(
      (itemId) => !MARKET_SOURCE_MAPPING_BY_ITEM_ID.has(itemId)
    ),
    unrecognizedActiveTags: [...unrecognizedActiveTags].sort()
  };
}

function addDropItems(
  itemIds: Set<EntityId>,
  missingMappingItemIds: Set<EntityId>,
  drop: DropDefinition
): void {
  if (drop.eligibility) return;
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

import { loadCurrentTestContext } from "./helpers/current-sim";
import {
  auditDynamicLootMarketDependencies,
  expandAllSupportedMarketSyncItemIds,
  expandMarketSyncItemIdsForMonster,
  expandMarketSyncRequestItems,
  marketMappingsForItemIds
} from "../data/market-sync-items";
import {
  HIGH_IMPACT_DYNAMIC_LOOT_MARKET_ENTRIES,
  MARKET_SOURCE_MAPPINGS,
  MARKET_SOURCE_MAPPING_BY_ITEM_ID
} from "../data/market-source-mapping";
import { createGeneratedRuntimeContext } from "../adapters/generated";
import { DYNAMIC_LOOT_PRICE_DEPENDENCIES } from "../domain/trip";
import type { GameDataSnapshot } from "../domain/shared";

describe("market sync item expansion", () => {
  it("expands current-monster loot through validated mappings and support dependencies", async () => {
    const { context } = await loadCurrentTestContext();
    const expansion = expandMarketSyncItemIdsForMonster(context.gameData, "green_dragon");

    expect(expansion.itemIds).toEqual(
      expect.arrayContaining(["dragon_bones", "dragonhide_green", "ring_of_recoil"])
    );
    expect(expansion.itemIds).not.toContain("coins");
    expect(marketMappingsForItemIds(expansion.itemIds).map((mapping) => mapping.itemId)).toEqual(
      expansion.itemIds
    );
  });

  it("expands nested loot rows and tagged drops without UI special cases", () => {
    const gameData = {
      id: "fixture",
      label: "Fixture",
      items: {},
      weapons: {},
      ammo: {},
      spells: {},
      equipment: {
        helm: {},
        amulet: {},
        body: {},
        legs: {},
        shield: {},
        gloves: {},
        boots: {},
        cape: {},
        ring: {}
      },
      monsters: {
        fixture_monster: {
          id: "fixture_monster",
          name: "Fixture monster",
          hp: 10,
          loot: [
            [
              { name: "Lobster", key: "lobster", chance: 0.5, qtyAvg: 1 },
              { name: "Coins", key: "coins", chance: 0.5, qtyAvg: 10 }
            ],
            { name: "Random herb", tag: "herb", chance: 0.25, qtyAvg: 1 },
            {
              name: "Quest item",
              key: "conditional_not_mapped",
              chance: 1,
              qtyAvg: 1,
              eligibility: {
                kind: "quest",
                policyId: "quest_item_missing",
                description: "Requires exact player state."
              }
            },
            { name: "Unsupported", key: "not_mapped", chance: 0.25, qtyAvg: 1 }
          ]
        }
      }
    } satisfies GameDataSnapshot;

    const expansion = expandMarketSyncItemIdsForMonster(gameData, "fixture_monster");

    expect(expansion.itemIds).toEqual(
      expect.arrayContaining(["lobster", "herb_guam", "herb_ranarr", "ring_of_recoil"])
    );
    expect(expansion.missingMappingItemIds).toEqual(
      [
        "not_mapped",
        ...DYNAMIC_LOOT_PRICE_DEPENDENCIES.herb.filter(
          (itemId) => !MARKET_SOURCE_MAPPING_BY_ITEM_ID.has(itemId)
        )
      ].sort()
    );
  });

  it("derives every active dynamic-table dependency from the Trip valuation contract", () => {
    const { context } = createGeneratedRuntimeContext();
    const audit = auditDynamicLootMarketDependencies(context.gameData);

    expect(audit.unrecognizedActiveTags).toEqual([]);
    expect(audit.rows.map((row) => [row.tag, row.dropCount])).toEqual([
      ["casket", 3],
      ["gem", 38],
      ["herb", 41],
      ["ultrarare", 3]
    ]);
    expect(audit.rows.find((row) => row.tag === "casket")?.missingMappingItemIds).toEqual([]);
    expect(audit.rows.find((row) => row.tag === "gem")?.missingMappingItemIds).toEqual([]);
    expect(audit.rows.find((row) => row.tag === "herb")?.missingMappingItemIds).toEqual([
      "unidentified_avantoe",
      "unidentified_cadantine",
      "unidentified_dwarf_weed",
      "unidentified_harralander",
      "unidentified_irit",
      "unidentified_kwuarm",
      "unidentified_lantadyme",
      "unidentified_marentill",
      "unidentified_ranarr",
      "unidentified_tarromin"
    ]);
    expect(audit.rows.find((row) => row.tag === "ultrarare")?.missingMappingItemIds).toEqual([]);
    expect(audit.mappedItemIds).toHaveLength(39);
    expect(audit.missingMappingItemIds).toEqual(
      audit.rows.find((row) => row.tag === "herb")?.missingMappingItemIds
    );
    expect(HIGH_IMPACT_DYNAMIC_LOOT_MARKET_ENTRIES).toHaveLength(12);
    expect(audit.dependencyItemIds).toEqual(
      [...new Set(Object.values(DYNAMIC_LOOT_PRICE_DEPENDENCIES).flat())].sort()
    );
  });

  it("expands all-supported to the current market mapping allowlist", () => {
    const itemIds = expandAllSupportedMarketSyncItemIds();

    expect(itemIds.length).toBe(MARKET_SOURCE_MAPPINGS.length);
    expect(itemIds).toEqual(expect.arrayContaining(["lobster", "rune_scimitar"]));
  });

  it("keeps explicit items scope allowlisted and reports missing mappings", async () => {
    const { context } = await loadCurrentTestContext();
    const expansion = expandMarketSyncRequestItems(context.gameData, {
      scope: "items",
      itemIds: ["lobster", "not_mapped"],
      includeAlch: true
    });

    expect(expansion.itemIds).toEqual(["lobster"]);
    expect(expansion.missingMappingItemIds).toEqual(["not_mapped"]);
  });
});

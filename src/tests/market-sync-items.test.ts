import { loadBundledLegacyContext } from "../adapters/browser";
import {
  expandAllSupportedMarketSyncItemIds,
  expandMarketSyncItemIdsForMonster,
  expandMarketSyncRequestItems,
  marketMappingsForItemIds
} from "../data/market-sync-items";
import { MARKET_SOURCE_MAPPINGS } from "../data/market-source-mapping";
import type { GameDataSnapshot } from "../domain/shared";

describe("market sync item expansion", () => {
  it("expands current-monster loot through validated mappings and support dependencies", async () => {
    const { context } = await loadBundledLegacyContext();
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
            { name: "Unsupported", key: "not_mapped", chance: 0.25, qtyAvg: 1 }
          ]
        }
      }
    } satisfies GameDataSnapshot;

    const expansion = expandMarketSyncItemIdsForMonster(gameData, "fixture_monster");

    expect(expansion.itemIds).toEqual(
      expect.arrayContaining(["lobster", "herb_guam", "herb_ranarr", "ring_of_recoil"])
    );
    expect(expansion.missingMappingItemIds).toEqual(["not_mapped"]);
  });

  it("expands all-supported to the current market mapping allowlist", () => {
    const itemIds = expandAllSupportedMarketSyncItemIds();

    expect(itemIds.length).toBe(MARKET_SOURCE_MAPPINGS.length);
    expect(itemIds).toEqual(expect.arrayContaining(["lobster", "rune_scimitar"]));
  });

  it("keeps explicit items scope allowlisted and reports missing mappings", async () => {
    const { context } = await loadBundledLegacyContext();
    const expansion = expandMarketSyncRequestItems(context.gameData, {
      scope: "items",
      itemIds: ["lobster", "not_mapped"],
      includeAlch: true
    });

    expect(expansion.itemIds).toEqual(["lobster"]);
    expect(expansion.missingMappingItemIds).toEqual(["not_mapped"]);
  });
});

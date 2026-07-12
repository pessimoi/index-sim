import type { MarketSourceMapping } from "../domain/shared";
import { MARKET_SOURCE_ID, parseMarketSourceMappings } from "./schemas";

const CATALOG_AUDITED_NOTE =
  "Source slug reviewed against the markets.lostcity.rs item catalog on 2026-07-10.";
const DYNAMIC_LOOT_PAGE_AUDITED_NOTE =
  "High-impact dynamic-loot source slug reviewed against the public markets.lostcity.rs item page on 2026-07-12.";

const slugMapEntries: ReadonlyArray<[string, string]> = [
  ["sapphire", "sapphire"],
  ["emerald", "emerald"],
  ["ruby", "ruby"],
  ["diamond", "diamond"],
  ["dragonstone", "dragonstone"],
  ["bones", "bones"],
  ["big_bones", "big_bones"],
  ["dragon_bones", "dragon_bones"],
  ["airrune", "airrune"],
  ["waterrune", "waterrune"],
  ["earthrune", "earthrune"],
  ["firerune", "firerune"],
  ["mindrune", "mindrune"],
  ["bodyrune", "bodyrune"],
  ["chaosrune", "chaosrune"],
  ["deathrune", "deathrune"],
  ["bloodrune", "bloodrune"],
  ["naturerune", "naturerune"],
  ["lawrune", "lawrune"],
  ["cosmicrune", "cosmicrune"],
  ["soulrune", "soulrune"],
  ["bronze_arrow", "bronze_arrow"],
  ["iron_arrow", "iron_arrow"],
  ["steel_arrow", "steel_arrow"],
  ["rune_arrow", "rune_arrow"],
  ["bolt", "bolt"],
  ["tuna", "tuna"],
  ["lobster", "lobster"],
  ["bass", "bass"],
  ["swordfish", "swordfish"],
  ["shark", "shark"],
  ["dragonhide_green", "dragonhide_green"],
  ["dragonhide_blue", "dragonhide_blue"],
  ["coal", "coal"],
  ["gold_ore", "gold_ore"],
  ["mithril_ore", "mithril_ore"],
  ["adamantite_ore", "adamantite_ore"],
  ["iron_ore", "iron_ore"],
  ["gold_bar", "gold_bar"],
  ["steel_bar", "steel_bar"],
  ["mithril_bar", "mithril_bar"],
  ["adamantite_bar", "adamantite_bar"],
  ["limpwurt_root", "limpwurt_root"],
  ["cow_hide", "cow_hide"],
  ["body_talisman", "body_talisman"],
  ["air_talisman", "air_talisman"],
  ["chaos_talisman", "chaos_talisman"],
  ["nature_talisman", "nature_talisman"],
  ["rune_full_helm", "rune_full_helm"],
  ["rune_med_helm", "rune_med_helm"],
  ["rune_chainbody", "rune_chainbody"],
  ["rune_scimitar", "rune_scimitar"],
  ["rune_dagger", "rune_dagger"],
  ["fire_battlestaff", "fire_battlestaff"],
  ["mithril_sq_shield", "mithril_sq_shield"],
  ["mithril_kiteshield", "mithril_kiteshield"],
  ["mithril_chainbody", "mithril_chainbody"],
  ["adamant_platelegs", "adamant_platelegs"],
  ["adamant_full_helm", "adamant_full_helm"],
  ["ring_of_recoil", "ring_of_recoil"]
];

const specialKeyEntries: ReadonlyArray<[string, string]> = [
  ["uncut_sapphire", "uncut_sapphire"],
  ["uncut_emerald", "uncut_emerald"],
  ["uncut_ruby", "uncut_ruby"],
  ["uncut_diamond", "uncut_diamond"],
  ["uncut_dragonstone", "uncut_dragonstone"],
  ["loop_half_key", "keyhalf2"],
  ["tooth_half_key", "keyhalf1"],
  ["cosmic_talisman", "cosmic_talisman"],
  ["herb_guam", "guam_leaf"],
  ["herb_marrentill", "marentill"],
  ["herb_tarromin", "tarromin"],
  ["herb_harralander", "harralander"],
  ["herb_ranarr", "ranarr_weed"],
  ["herb_irit", "irit_leaf"],
  ["herb_avantoe", "avantoe"],
  ["herb_kwuarm", "kwuarm"],
  ["herb_cadantine", "cadantine"],
  ["herb_lantadyme", "lantadyme"],
  ["herb_dwarf_weed", "dwarf_weed"],
  ["unidentified_guam", "unidentified_guam"]
];

export const HIGH_IMPACT_DYNAMIC_LOOT_MARKET_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ["adamant_javelin", "adamant_javelin"],
  ["dragon_med_helm", "dragon_med_helm"],
  ["dragon_spear", "dragon_spear"],
  ["dragonshield_a", "dragonshield_a"],
  ["rune_2h", "rune_2h_sword"],
  ["rune_battleaxe", "rune_battleaxe"],
  ["rune_javelin", "rune_javelin"],
  ["rune_kiteshield", "rune_kiteshield"],
  ["rune_spear", "rune_spear"],
  ["rune_sq_shield", "rune_sq_shield"],
  ["runite_bar", "runite_bar"],
  ["silver_ore", "silver_ore"]
];

function mapping(itemId: string, sourceSlug: string, notes: string): MarketSourceMapping {
  return {
    itemId,
    sourceSlug,
    source: MARKET_SOURCE_ID,
    tradeable: true,
    syncPrice: true,
    syncAlch: false,
    notes
  };
}

export const MARKET_SOURCE_MAPPING_PROVENANCE = {
  source: "manual",
  sourceRef: "markets.lostcity.rs/api/items catalog lookup",
  verifiedAt: "2026-07-10",
  notes:
    "The bounded allowlist was matched to current catalog slugs by generated item name, with ambiguous dragonhide and half-key identities resolved from canonical item ids/source identities.",
  extensions: [
    {
      sourceRef: "markets.lostcity.rs/items/{slug} bounded item-page status and identity review",
      verifiedAt: "2026-07-12",
      itemIds: HIGH_IMPACT_DYNAMIC_LOOT_MARKET_ENTRIES.map(([itemId]) => itemId),
      notes:
        "Twelve identified high-impact dynamic-loot dependencies were admitted. rune_2h maps to the source slug rune_2h_sword; ten species-specific unidentified-herb item pages returned 404 and remain outside the allowlist."
    }
  ]
} as const;

export const MARKET_SOURCE_MAPPINGS = parseMarketSourceMappings([
  ...slugMapEntries.map(([itemId, sourceSlug]) =>
    mapping(itemId, sourceSlug, CATALOG_AUDITED_NOTE)
  ),
  ...specialKeyEntries.map(([itemId, sourceSlug]) =>
    mapping(itemId, sourceSlug, CATALOG_AUDITED_NOTE)
  ),
  ...HIGH_IMPACT_DYNAMIC_LOOT_MARKET_ENTRIES.map(([itemId, sourceSlug]) =>
    mapping(itemId, sourceSlug, DYNAMIC_LOOT_PAGE_AUDITED_NOTE)
  )
]);

export const MARKET_SOURCE_MAPPING_BY_ITEM_ID = new Map(
  MARKET_SOURCE_MAPPINGS.map((mapping) => [mapping.itemId, mapping])
);

export const MARKET_SOURCE_ITEM_ALLOWLIST = new Set(MARKET_SOURCE_MAPPING_BY_ITEM_ID.keys());

export function getMarketSourceMapping(itemId: string): MarketSourceMapping | null {
  return MARKET_SOURCE_MAPPING_BY_ITEM_ID.get(itemId) ?? null;
}

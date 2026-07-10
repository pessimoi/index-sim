import type { MarketSourceMapping } from "../domain/shared";
import { MARKET_SOURCE_ID, parseMarketSourceMappings } from "./schemas";

const LEGACY_SLUG_MAP_NOTE =
  "Derived from legacy market.js SLUG_MAP evidence; not an authoritative source mapping.";
const LEGACY_SPECIAL_KEYS_NOTE =
  "Derived from legacy market.js SPECIAL_KEYS evidence; source slug is provisional until an authoritative mapping exists.";

const slugMapEntries: ReadonlyArray<[string, string]> = [
  ["sapphire", "uncut_sapphire"],
  ["emerald", "uncut_emerald"],
  ["ruby", "uncut_ruby"],
  ["diamond", "uncut_diamond"],
  ["dragonstone", "uncut_dragonstone"],
  ["bones", "bones"],
  ["big_bones", "big_bones"],
  ["dragon_bones", "dragon_bones"],
  ["airrune", "air_rune"],
  ["waterrune", "water_rune"],
  ["earthrune", "earth_rune"],
  ["firerune", "fire_rune"],
  ["mindrune", "mind_rune"],
  ["bodyrune", "body_rune"],
  ["chaosrune", "chaos_rune"],
  ["deathrune", "death_rune"],
  ["bloodrune", "blood_rune"],
  ["naturerune", "nature_rune"],
  ["lawrune", "law_rune"],
  ["cosmicrune", "cosmic_rune"],
  ["soulrune", "soul_rune"],
  ["bronze_arrow", "bronze_arrow"],
  ["iron_arrow", "iron_arrow"],
  ["steel_arrow", "steel_arrow"],
  ["rune_arrow", "rune_arrow"],
  ["bolt", "crossbow_bolt"],
  ["tuna", "tuna"],
  ["lobster", "lobster"],
  ["bass", "bass"],
  ["swordfish", "swordfish"],
  ["shark", "shark"],
  ["dragonhide_green", "green_dragonhide"],
  ["dragonhide_blue", "blue_dragonhide"],
  ["coal", "coal"],
  ["gold_ore", "gold_ore"],
  ["mithril_ore", "mithril_ore"],
  ["adamantite_ore", "adamantite_ore"],
  ["iron_ore", "iron_ore"],
  ["gold_bar", "gold_bar"],
  ["steel_bar", "steel_bar"],
  ["mithril_bar", "mithril_bar"],
  ["adamantite_bar", "adamant_bar"],
  ["limpwurt_root", "limpwurt_root"],
  ["cow_hide", "cowhide"],
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
  ["loop_half_key", "loop_half_key"],
  ["tooth_half_key", "tooth_half_key"],
  ["cosmic_talisman", "cosmic_talisman"],
  ["herb_guam", "guam_leaf"],
  ["herb_marrentill", "marentill"],
  ["herb_tarromin", "herb_tarromin"],
  ["herb_harralander", "herb_harralander"],
  ["herb_ranarr", "herb_ranarr"],
  ["herb_irit", "herb_irit"],
  ["herb_avantoe", "herb_avantoe"],
  ["herb_kwuarm", "herb_kwuarm"],
  ["herb_cadantine", "herb_cadantine"],
  ["herb_lantadyme", "herb_lantadyme"],
  ["herb_dwarf_weed", "herb_dwarf_weed"],
  ["unidentified_guam", "unidentified_guam"]
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
  sourceRef: "market.js SLUG_MAP and SPECIAL_KEYS",
  verifiedAt: "2026-07-05",
  notes:
    "Initial allowlist is legacy-derived and intentionally non-canonical until an authoritative market source mapping is accepted."
} as const;

export const MARKET_SOURCE_MAPPINGS = parseMarketSourceMappings([
  ...slugMapEntries.map(([itemId, sourceSlug]) =>
    mapping(itemId, sourceSlug, LEGACY_SLUG_MAP_NOTE)
  ),
  ...specialKeyEntries.map(([itemId, sourceSlug]) =>
    mapping(itemId, sourceSlug, LEGACY_SPECIAL_KEYS_NOTE)
  )
]);

export const MARKET_SOURCE_MAPPING_BY_ITEM_ID = new Map(
  MARKET_SOURCE_MAPPINGS.map((mapping) => [mapping.itemId, mapping])
);

export const MARKET_SOURCE_ITEM_ALLOWLIST = new Set(MARKET_SOURCE_MAPPING_BY_ITEM_ID.keys());

export function getMarketSourceMapping(itemId: string): MarketSourceMapping | null {
  return MARKET_SOURCE_MAPPING_BY_ITEM_ID.get(itemId) ?? null;
}

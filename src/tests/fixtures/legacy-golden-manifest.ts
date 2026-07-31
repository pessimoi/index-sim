export type LegacyGoldenClassification = "must-preserve" | "accepted-delta" | "historical-only";

export const LEGACY_GOLDEN_CAPTURE = {
  sourceCommit: "01bf4d54cdee248b8b22c59a176da29f76a45d3c",
  captureScriptSha256: "01d09d90e42aa2b620324abd9b7062cfa614d0dd59acee42fc8d519932988401",
  capturedAt: "2026-07-05",
  executionPolicy:
    "Immutable evidence. Refresh only through an explicit baseline decision; never from the normal test gate."
} as const;

export const LEGACY_GOLDEN_CLASSIFICATIONS = {
  melee_rune_scimitar_hill_giant_super_prayers: "must-preserve",
  melee_green_dragon_antifire_ring_of_wealth: "must-preserve",
  melee_dragon_dagger_poison_lesser_demon_spec: "must-preserve",
  melee_dba_sustained_moss_giant: "must-preserve",
  melee_dragon_halberd_rock_crab_small_target_spec: "must-preserve",
  melee_ring_recoil_fire_giant_food_trip: "accepted-delta",
  ranged_magic_shortbow_dagannoth_cannon: "accepted-delta",
  ranged_magic_shortbow_rock_crab_safespot: "must-preserve",
  ranged_steel_knives_chaos_druid_inventory: "must-preserve",
  ranged_yew_longbow_black_demon_no_recovery: "must-preserve",
  ranged_magic_shortbow_greater_demon_spec: "must-preserve",
  magic_fire_bolt_chaos_druid_alch: "must-preserve",
  magic_fire_wave_blue_dragon_safespot: "must-preserve",
  magic_saradomin_strike_charged_greater_demon: "must-preserve",
  magic_water_bolt_tribesman_poison_safespot: "must-preserve",
  melee_chaos_dwarf_alch_rune_drop: "must-preserve",
  melee_black_dragon_food_limited_trip: "must-preserve",
  melee_low_level_chicken_low_value_loot: "must-preserve"
} as const satisfies Record<string, LegacyGoldenClassification>;

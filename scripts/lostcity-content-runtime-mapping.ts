import type { EntityId } from "../src/domain/shared";

export interface LostCityRuntimeSourceMapping {
  sourceId: EntityId;
  sourceRef: string;
  reason: string;
}

export interface LostCitySourceItemIdentityMapping {
  runtimeId: EntityId;
  sourceRef: string;
  reason: string;
}

export interface LostCityEquipmentSourceMapping {
  sourceItemId: EntityId;
  sourceRef: string;
  reason: string;
}

export const LOSTCITY_MONSTER_SOURCE_MAPPINGS: Readonly<
  Record<EntityId, LostCityRuntimeSourceMapping>
> = {
  baby_blue_dragon: {
    sourceId: "babybluedragon",
    sourceRef: "scripts/_unpack/225/all.npc#babybluedragon",
    reason: "Display name and combat level 48 match."
  },
  bandit: {
    sourceId: "brawling_bandit",
    sourceRef: "scripts/areas/area_wilderness/configs/bandit_camp.npc#brawling_bandit",
    reason: "Display name and combat level 22 match."
  },
  bear: {
    sourceId: "darkbear",
    sourceRef: "scripts/_unpack/225/all.npc#darkbear",
    reason: "Display name and combat level 19 match; brownbear is level 21."
  },
  chaos_dwarf: {
    sourceId: "dwarf_chaos",
    sourceRef: "scripts/_unpack/225/all.npc#dwarf_chaos",
    reason: "Display name and combat level 48 match."
  },
  dagannoth: {
    sourceId: "horror_dagganoth_jr",
    sourceRef: "scripts/quests/quest_horror/configs/quest_horror.npc#horror_dagganoth_jr",
    reason: "Dagannoth junior combat level 74 matches."
  },
  dagannoth_92: {
    sourceId: "horror_dagannoth_medium",
    sourceRef: "scripts/quests/quest_horror/configs/quest_horror.npc#horror_dagannoth_medium",
    reason: "Dagannoth medium combat level 92 matches."
  },
  dark_wizard: {
    sourceId: "young_dark_wizard",
    sourceRef: "scripts/_unpack/225/all.npc#young_dark_wizard",
    reason: "Dark wizard combat level 7 matches."
  },
  dark_wizard_20: {
    sourceId: "bearded_dark_wizard",
    sourceRef: "scripts/_unpack/225/all.npc#bearded_dark_wizard",
    reason: "Dark wizard combat level 20 matches."
  },
  dwarf: {
    sourceId: "dwarf_normal",
    sourceRef: "scripts/_unpack/225/all.npc#dwarf_normal",
    reason: "Default dwarf display name and combat level 10 match."
  },
  earth_warrior: {
    sourceId: "earthwarrior",
    sourceRef: "scripts/_unpack/225/all.npc#earthwarrior",
    reason: "Display name and combat level 51 match."
  },
  elf_warrior_108: {
    sourceId: "regicide_darkelf2",
    sourceRef: "scripts/quests/quest_regicide/configs/quest_regicide.npc#regicide_darkelf2",
    reason: "Elf warrior combat level 108 and melee combat signature match."
  },
  elf_warrior_90: {
    sourceId: "regicide_darkelf",
    sourceRef: "scripts/quests/quest_regicide/configs/quest_regicide.npc#regicide_darkelf",
    reason: "Elf warrior combat level 90 and ranged combat signature match."
  },
  farmer: {
    sourceId: "farmer1",
    sourceRef: "scripts/_unpack/225/all.npc#farmer1",
    reason: "Default farmer display name and combat level 7 match."
  },
  guard: {
    sourceId: "guard1",
    sourceRef: "scripts/_unpack/225/all.npc#guard1",
    reason: "Default guard display name and combat level 21 match."
  },
  ice_warrior: {
    sourceId: "icewarrior",
    sourceRef: "scripts/_unpack/225/all.npc#icewarrior",
    reason: "Default ice warrior display name and combat level 57 match."
  },
  mountain_troll: {
    sourceId: "death_troll_melee1",
    sourceRef: "scripts/quests/quest_death/configs/quest_death.npc#death_troll_melee1",
    reason: "Mountain Troll combat level 69; numbered variants share the same combat signature."
  },
  pirate: {
    sourceId: "pirate1",
    sourceRef: "scripts/_unpack/225/all.npc#pirate1",
    reason: "Default pirate display name and combat level 23 match."
  },
  poison_spider: {
    sourceId: "poisonspider",
    sourceRef: "scripts/_unpack/225/all.npc#poisonspider",
    reason: "Poison spider combat level 64 matches; dungeonspider is level 31."
  },
  rock_crab: {
    sourceId: "horror_rockcrab",
    sourceRef: "scripts/quests/quest_viking/configs/horror_rockcrab.npc#horror_rockcrab",
    reason: "Rock Crab combat level 13; the small variant shares the same combat signature."
  },
  water_elemental: {
    sourceId: "elemental_water",
    sourceRef:
      "scripts/quests/quest_elemental_workshop/configs/quest_elemental_workshop.npc#elemental_water",
    reason: "Display name and combat level 34 match."
  }
};

export const LOSTCITY_SOURCE_ITEM_IDENTITY_MAPPINGS: Readonly<
  Record<EntityId, LostCitySourceItemIdentityMapping>
> = {
  guam_leaf: {
    runtimeId: "herb_guam",
    sourceRef: "scripts/skill_herblore/configs/herbs.obj#guam_leaf",
    reason: "Runtime herb price identity for the Revision 274 Guam leaf object."
  },
  marentill: {
    runtimeId: "herb_marrentill",
    sourceRef: "scripts/skill_herblore/configs/herbs.obj#marentill",
    reason: "Runtime herb price identity for the Revision 274 Marrentill object."
  },
  tarromin: {
    runtimeId: "herb_tarromin",
    sourceRef: "scripts/skill_herblore/configs/herbs.obj#tarromin",
    reason: "Runtime herb price identity for the Revision 274 Tarromin object."
  },
  harralander: {
    runtimeId: "herb_harralander",
    sourceRef: "scripts/skill_herblore/configs/herbs.obj#harralander",
    reason: "Runtime herb price identity for the Revision 274 Harralander object."
  },
  ranarr_weed: {
    runtimeId: "herb_ranarr",
    sourceRef: "scripts/skill_herblore/configs/herbs.obj#ranarr_weed",
    reason: "Runtime herb price identity for the Revision 274 Ranarr weed object."
  },
  irit_leaf: {
    runtimeId: "herb_irit",
    sourceRef: "scripts/skill_herblore/configs/herbs.obj#irit_leaf",
    reason: "Runtime herb price identity for the Revision 274 Irit leaf object."
  },
  avantoe: {
    runtimeId: "herb_avantoe",
    sourceRef: "scripts/skill_herblore/configs/herbs.obj#avantoe",
    reason: "Runtime herb price identity for the Revision 274 Avantoe object."
  },
  kwuarm: {
    runtimeId: "herb_kwuarm",
    sourceRef: "scripts/skill_herblore/configs/herbs.obj#kwuarm",
    reason: "Runtime herb price identity for the Revision 274 Kwuarm object."
  },
  cadantine: {
    runtimeId: "herb_cadantine",
    sourceRef: "scripts/skill_herblore/configs/herbs.obj#cadantine",
    reason: "Runtime herb price identity for the Revision 274 Cadantine object."
  },
  lantadyme: {
    runtimeId: "herb_lantadyme",
    sourceRef: "scripts/skill_herblore/configs/herbs.obj#lantadyme",
    reason: "Runtime herb price identity for the Revision 274 Lantadyme object."
  },
  dwarf_weed: {
    runtimeId: "herb_dwarf_weed",
    sourceRef: "scripts/skill_herblore/configs/herbs.obj#dwarf_weed",
    reason: "Runtime herb price identity for the Revision 274 Dwarf weed object."
  },
  keyhalf1: {
    runtimeId: "tooth_half_key",
    sourceRef: "scripts/_unpack/225/all.obj#keyhalf1",
    reason: "Revision 274 keyhalf1 is the tooth half, as used by the shared drop tables."
  },
  keyhalf2: {
    runtimeId: "loop_half_key",
    sourceRef: "scripts/_unpack/225/all.obj#keyhalf2",
    reason: "Revision 274 keyhalf2 is the loop half, as used by the shared drop tables."
  },
  rune_2h_sword: {
    runtimeId: "rune_2h",
    sourceRef: "scripts/skill_combat/configs/melee/2hswords.obj#rune_2h_sword",
    reason: "Runtime economy identity for the Revision 274 Rune 2h sword object."
  },
  "4dose1antidragon": {
    runtimeId: "antifire_potion",
    sourceRef: "scripts/skill_herblore/configs/brewing/potions.obj#4dose1antidragon",
    reason: "Runtime supply prices one full four-dose antifire potion."
  },
  "4dose1magic": {
    runtimeId: "magic_potion",
    sourceRef: "scripts/skill_herblore/configs/brewing/potions.obj#4dose1magic",
    reason: "Runtime supply prices one full four-dose magic potion."
  },
  "4doseprayerrestore": {
    runtimeId: "prayer_potion",
    sourceRef: "scripts/skill_herblore/configs/brewing/potions.obj#4doseprayerrestore",
    reason: "Runtime supply prices one full four-dose prayer potion."
  },
  "4doserangerspotion": {
    runtimeId: "ranging_potion",
    sourceRef: "scripts/skill_herblore/configs/brewing/potions.obj#4doserangerspotion",
    reason: "Runtime supply prices one full four-dose ranging potion."
  },
  "4dosestatrestore": {
    runtimeId: "restore_potion",
    sourceRef: "scripts/skill_herblore/configs/brewing/potions.obj#4dosestatrestore",
    reason: "DBA restore supply uses the normal four-dose stat restore potion, not super restore."
  },
  "4dose2antipoison": {
    runtimeId: "super_antipoison",
    sourceRef: "scripts/skill_herblore/configs/brewing/potions.obj#4dose2antipoison",
    reason: "Runtime supply prices one full four-dose super antipoison."
  },
  "4dose2attack": {
    runtimeId: "super_attack",
    sourceRef: "scripts/skill_herblore/configs/brewing/potions.obj#4dose2attack",
    reason: "Runtime supply prices one full four-dose super attack potion."
  },
  "4dose2defense": {
    runtimeId: "super_defence",
    sourceRef: "scripts/skill_herblore/configs/brewing/potions.obj#4dose2defense",
    reason: "Runtime supply prices one full four-dose super defence potion."
  },
  "4dose2strength": {
    runtimeId: "super_strength",
    sourceRef: "scripts/skill_herblore/configs/brewing/potions.obj#4dose2strength",
    reason: "Runtime supply prices one full four-dose super strength potion."
  },
  adamnt_warhammer: {
    runtimeId: "adamant_warhammer",
    sourceRef: "scripts/skill_combat/configs/melee/warhammers.obj#adamnt_warhammer",
    reason:
      "Revision 274 uses a misspelled config id/name for the Adamant warhammer; tier, cost and combat parameters identify the existing runtime item."
  },
  wizards_robe: {
    runtimeId: "wizard_robe_top",
    sourceRef: "scripts/skill_magic/configs/magic.obj#wizards_robe",
    reason:
      "Revision 274 Wizards robe is the torso item represented by the existing runtime Wizard robe (top) identity."
  }
};

export const LOSTCITY_WEAPON_SOURCE_MAPPINGS: Readonly<
  Record<EntityId, LostCityRuntimeSourceMapping>
> = {
  addy_dart_w: {
    sourceId: "adamant_dart",
    sourceRef: "scripts/skill_combat/configs/ranged/darts.obj#adamant_dart",
    reason: "Simulator thrown-weapon view of the Revision 274 Adamant dart object."
  },
  addy_knife_w: {
    sourceId: "adamant_knife",
    sourceRef: "scripts/skill_combat/configs/ranged/knives.obj#adamant_knife",
    reason: "Simulator thrown-weapon view of the Revision 274 Adamant knife object."
  },
  bronze_dart_w: {
    sourceId: "bronze_dart",
    sourceRef: "scripts/skill_combat/configs/ranged/darts.obj#bronze_dart",
    reason: "Simulator thrown-weapon view of the Revision 274 Bronze dart object."
  },
  bronze_knife_w: {
    sourceId: "bronze_knife",
    sourceRef: "scripts/skill_combat/configs/ranged/knives.obj#bronze_knife",
    reason: "Simulator thrown-weapon view of the Revision 274 Bronze knife object."
  },
  iron_dart_w: {
    sourceId: "iron_dart",
    sourceRef: "scripts/skill_combat/configs/ranged/darts.obj#iron_dart",
    reason: "Simulator thrown-weapon view of the Revision 274 Iron dart object."
  },
  iron_knife_w: {
    sourceId: "iron_knife",
    sourceRef: "scripts/skill_combat/configs/ranged/knives.obj#iron_knife",
    reason: "Simulator thrown-weapon view of the Revision 274 Iron knife object."
  },
  mith_dart_w: {
    sourceId: "mithril_dart",
    sourceRef: "scripts/skill_combat/configs/ranged/darts.obj#mithril_dart",
    reason: "Simulator thrown-weapon view of the Revision 274 Mithril dart object."
  },
  mith_knife_w: {
    sourceId: "mithril_knife",
    sourceRef: "scripts/skill_combat/configs/ranged/knives.obj#mithril_knife",
    reason: "Simulator thrown-weapon view of the Revision 274 Mithril knife object."
  },
  rune_dart_w: {
    sourceId: "rune_dart",
    sourceRef: "scripts/skill_combat/configs/ranged/darts.obj#rune_dart",
    reason: "Simulator thrown-weapon view of the Revision 274 Rune dart object."
  },
  rune_knife_w: {
    sourceId: "rune_knife",
    sourceRef: "scripts/skill_combat/configs/ranged/knives.obj#rune_knife",
    reason: "Simulator thrown-weapon view of the Revision 274 Rune knife object."
  },
  steel_dart_w: {
    sourceId: "steel_dart",
    sourceRef: "scripts/skill_combat/configs/ranged/darts.obj#steel_dart",
    reason: "Simulator thrown-weapon view of the Revision 274 Steel dart object."
  },
  steel_knife_w: {
    sourceId: "steel_knife",
    sourceRef: "scripts/skill_combat/configs/ranged/knives.obj#steel_knife",
    reason: "Simulator thrown-weapon view of the Revision 274 Steel knife object."
  }
};

export const LOSTCITY_AMMO_SOURCE_MAPPINGS: Readonly<
  Record<EntityId, LostCityRuntimeSourceMapping>
> = {
  addy_arrow: {
    sourceId: "adamant_arrow",
    sourceRef: "scripts/skill_combat/configs/ranged/arrows.obj#adamant_arrow",
    reason: "Runtime abbreviation for the Revision 274 Adamant arrow object."
  },
  addy_dart: {
    sourceId: "adamant_dart",
    sourceRef: "scripts/skill_combat/configs/ranged/darts.obj#adamant_dart",
    reason: "Runtime abbreviation for the Revision 274 Adamant dart object."
  },
  addy_knife: {
    sourceId: "adamant_knife",
    sourceRef: "scripts/skill_combat/configs/ranged/knives.obj#adamant_knife",
    reason: "Runtime abbreviation for the Revision 274 Adamant knife object."
  },
  mith_arrow: {
    sourceId: "mithril_arrow",
    sourceRef: "scripts/skill_combat/configs/ranged/arrows.obj#mithril_arrow",
    reason: "Runtime abbreviation for the Revision 274 Mithril arrow object."
  },
  mith_dart: {
    sourceId: "mithril_dart",
    sourceRef: "scripts/skill_combat/configs/ranged/darts.obj#mithril_dart",
    reason: "Runtime abbreviation for the Revision 274 Mithril dart object."
  },
  mith_knife: {
    sourceId: "mithril_knife",
    sourceRef: "scripts/skill_combat/configs/ranged/knives.obj#mithril_knife",
    reason: "Runtime abbreviation for the Revision 274 Mithril knife object."
  }
};

export const LOSTCITY_SYNTHETIC_RUNTIME_ITEM_IDS: ReadonlySet<EntityId> = new Set([
  ...Object.keys(LOSTCITY_WEAPON_SOURCE_MAPPINGS),
  "cert_swordfish",
  "super_set"
]);

export const LOSTCITY_EQUIPMENT_SOURCE_MAPPINGS: Readonly<
  Record<EntityId, LostCityEquipmentSourceMapping>
> = {
  "body:black_dhide_body": {
    sourceItemId: "black_dragonhide_body",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#black_dragonhide_body",
    reason: "Black dragonhide torso row; source combat bonuses match the runtime entry."
  },
  "body:blue_dhide_body": {
    sourceItemId: "blue_dragonhide_body",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#blue_dragonhide_body",
    reason: "Blue dragonhide torso row; source combat bonuses match the runtime entry."
  },
  "body:green_dhide_body": {
    sourceItemId: "dragonhide_body",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#dragonhide_body",
    reason: "Base dragonhide torso row is the green dragonhide variant."
  },
  "body:monk_robe_top": {
    sourceItemId: "monkrobetop",
    sourceRef: "scripts/skill_prayer/configs/robes.obj#monkrobetop",
    reason: "Torso wear position and prayer bonus identify the Monk robe top."
  },
  "body:red_dhide_body": {
    sourceItemId: "red_dragonhide_body",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#red_dragonhide_body",
    reason: "Red dragonhide torso row; source combat bonuses match the runtime entry."
  },
  "body:wizard_robe_top": {
    sourceItemId: "wizards_robe",
    sourceRef: "scripts/skill_magic/configs/magic.obj#wizards_robe",
    reason: "Torso wear position and magic bonuses identify the Wizard robe top."
  },
  "boots:splitbark_boots": {
    sourceItemId: "splitbark_greaves",
    sourceRef: "scripts/_unpack/274/all.obj#splitbark_greaves",
    reason:
      "Source greaves use the feet wear position and match the runtime Splitbark boots bonuses."
  },
  "boots:wizard_boots": {
    sourceItemId: "boots_wizard",
    sourceRef: "scripts/skill_combat/configs/melee/trails.obj#boots_wizard",
    reason: "Wizard boots source row; wear position, cost and magic bonuses match."
  },
  "cape:god_cape": {
    sourceItemId: "guthix_cape",
    sourceRef: "scripts/areas/area_mage_arena/configs/mage_arena.obj#guthix_cape",
    reason:
      "Representative source row for the generic runtime God cape; Saradomin, Guthix and Zamorak capes share identical simulator-consumed cost and combat bonuses."
  },
  "gloves:black_vambraces": {
    sourceItemId: "black_dragon_vambraces",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#black_dragon_vambraces",
    reason: "Black dragonhide hand row; source combat bonuses match the runtime entry."
  },
  "gloves:blue_vambraces": {
    sourceItemId: "blue_dragon_vambraces",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#blue_dragon_vambraces",
    reason: "Blue dragonhide hand row; source combat bonuses match the runtime entry."
  },
  "gloves:green_vambraces": {
    sourceItemId: "dragon_vambraces",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#dragon_vambraces",
    reason: "Base dragon vambraces row is the green dragonhide variant."
  },
  "gloves:red_vambraces": {
    sourceItemId: "red_dragon_vambraces",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#red_dragon_vambraces",
    reason: "Red dragonhide hand row; source combat bonuses match the runtime entry."
  },
  "helm:green_hat": {
    sourceItemId: "gnome_hat_green",
    sourceRef: "scripts/areas/area_gnome/configs/rometti.obj#gnome_hat_green",
    reason: "Green gnome hat has the runtime cost 160 and matching magic attack/defence bonuses."
  },
  "legs:black_dhide_legs": {
    sourceItemId: "black_dragonhide_chaps",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#black_dragonhide_chaps",
    reason: "Black dragonhide leg row; source combat bonuses match the runtime entry."
  },
  "legs:blue_dhide_legs": {
    sourceItemId: "blue_dragonhide_chaps",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#blue_dragonhide_chaps",
    reason: "Blue dragonhide leg row; source combat bonuses match the runtime entry."
  },
  "legs:green_dhide_legs": {
    sourceItemId: "dragonhide_chaps",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#dragonhide_chaps",
    reason: "Base dragonhide chaps row is the green dragonhide variant."
  },
  "legs:monk_robe_bottom": {
    sourceItemId: "monkrobebottom",
    sourceRef: "scripts/skill_prayer/configs/robes.obj#monkrobebottom",
    reason: "Leg wear position identifies the Monk robe bottom."
  },
  "legs:red_dhide_legs": {
    sourceItemId: "red_dragonhide_chaps",
    sourceRef: "scripts/skill_crafting/configs/leather/leather_gear.obj#red_dragonhide_chaps",
    reason: "Red dragonhide leg row; source combat bonuses match the runtime entry."
  },
  "legs:zamorak_robe_bottom": {
    sourceItemId: "zamrobebottom",
    sourceRef: "scripts/_unpack/225/all.obj#zamrobebottom",
    reason: "Leg wear position and magic/prayer bonuses identify the Zamorak robe bottom."
  },
  "shield:anti_dragon": {
    sourceItemId: "antidragonbreathshield",
    sourceRef: "scripts/skill_combat/configs/melee/shields.obj#antidragonbreathshield",
    reason:
      "Dragonfire shield source row; cost and defence bonuses match the runtime anti-dragon shield."
  },
  "shield:balance_book": {
    sourceItemId: "guthixbook_complete",
    sourceRef: "scripts/quests/quest_horror/configs/quest_horror.obj#guthixbook_complete",
    reason: "Completed Guthix Book of balance row; all simulator-consumed bonuses match."
  },
  "shield:unholy_book": {
    sourceItemId: "zamorakbook_complete",
    sourceRef: "scripts/quests/quest_horror/configs/quest_horror.obj#zamorakbook_complete",
    reason: "Completed Zamorak Unholy book row; all simulator-consumed bonuses match."
  }
};

const LOSTCITY_RUNTIME_TO_SOURCE_ITEM_ID = new Map<EntityId, EntityId>(
  Object.entries(LOSTCITY_SOURCE_ITEM_IDENTITY_MAPPINGS).map(([sourceId, mapping]) => [
    mapping.runtimeId,
    sourceId
  ])
);

export function lostCityMonsterSourceId(runtimeId: EntityId): EntityId {
  return LOSTCITY_MONSTER_SOURCE_MAPPINGS[runtimeId]?.sourceId ?? runtimeId;
}

export function lostCityRuntimeItemId(sourceId: EntityId): EntityId {
  return LOSTCITY_SOURCE_ITEM_IDENTITY_MAPPINGS[sourceId]?.runtimeId ?? sourceId;
}

export function lostCitySourceItemId(runtimeId: EntityId): EntityId {
  return LOSTCITY_RUNTIME_TO_SOURCE_ITEM_ID.get(runtimeId) ?? runtimeId;
}

export function lostCityWeaponSourceId(runtimeId: EntityId): EntityId {
  return LOSTCITY_WEAPON_SOURCE_MAPPINGS[runtimeId]?.sourceId ?? runtimeId;
}

export function lostCityAmmoSourceId(runtimeId: EntityId): EntityId {
  return LOSTCITY_AMMO_SOURCE_MAPPINGS[runtimeId]?.sourceId ?? runtimeId;
}

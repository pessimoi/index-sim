import { xpAt, type PlannerOptions } from "../../domain/planner";
import type { LegacyCaseDefinition, LegacyGear } from "../helpers/legacy-sim";
import { PLANNER_GOLDEN_CASES } from "./planner-case-definitions";

export type PlannerParityMode = "reference-context" | "current-product";

export interface PlannerParityCaseDefinition {
  id: string;
  intent: string;
  modes: readonly PlannerParityMode[];
  definition: LegacyCaseDefinition;
  options: PlannerOptions;
}

const BOTH_MODES = ["reference-context", "current-product"] as const;
const BASIC_GEAR = {
  helm: "none",
  amulet: "none",
  body: "none",
  legs: "none",
  shield: "none",
  gloves: "none",
  boots: "none",
  cape: "none",
  ring: "none"
} satisfies Partial<LegacyGear>;
const EMPTY_ARMOUR_POOL = {
  helm: ["none"],
  body: ["none"],
  legs: ["none"],
  shield: ["none"]
};

const EXISTING_ACCEPTANCE_CASES: PlannerParityCaseDefinition[] = PLANNER_GOLDEN_CASES.map(
  (testCase) => ({
    id: testCase.id,
    intent: testCase.description,
    modes: BOTH_MODES,
    definition: testCase.definition,
    options: testCase.options
  })
);

function meleeDefinition(
  id: string,
  levels: NonNullable<LegacyCaseDefinition["levels"]>,
  overrides: Partial<LegacyCaseDefinition> = {}
): LegacyCaseDefinition {
  return {
    id,
    description: id.replaceAll("_", " "),
    combatType: "melee",
    monsterId: "giant",
    weapon: "adamant_scimitar",
    style: "aggressive",
    levels,
    gear: BASIC_GEAR,
    prayers: ["none"],
    boosts: ["none"],
    trip: { foodKey: "none", teleport: false, bankSeconds: 0, prayerMode: "none" },
    ...overrides
  };
}

const ADDITIONAL_CASES: PlannerParityCaseDefinition[] = [
  {
    id: "melee_attack_strength_greedy_order",
    intent: "Compare Attack and Strength ordering across a nearby max-hit boundary.",
    modes: BOTH_MODES,
    definition: meleeDefinition("planner_parity_attack_strength_order", {
      attack: 39,
      strength: 43,
      defence: 40,
      ranged: 1,
      magic: 1,
      prayer: 1
    }),
    options: {
      metric: "xph",
      targets: { attack: 41, strength: 45 },
      pool: { weapon: ["adamant_scimitar", "rune_scimitar"], ...EMPTY_ARMOUR_POOL },
      maxLevels: 4
    }
  },
  {
    id: "melee_defence_armour_unlock",
    intent: "Defence training unlocks rune armour from a bounded pool.",
    modes: BOTH_MODES,
    definition: meleeDefinition(
      "planner_parity_defence_armour_unlock",
      { attack: 45, strength: 45, defence: 39, ranged: 1, magic: 1, prayer: 1 },
      { weapon: "rune_scimitar", style: "defensive" }
    ),
    options: {
      metric: "xph",
      targets: { defence: 41 },
      pool: {
        weapon: ["rune_scimitar"],
        helm: ["none", "adamant_full_helm", "rune_full_helm"],
        body: ["none", "adamant_platebody", "rune_platebody"],
        legs: ["none", "adamant_platelegs", "rune_platelegs"],
        shield: ["none", "adamant_kite", "rune_kite"]
      },
      maxLevels: 2
    }
  },
  {
    id: "ranged_longrange_defence_training",
    intent: "Longrange planning compares Ranged and Defence stance-aware ordering.",
    modes: BOTH_MODES,
    definition: {
      id: "planner_parity_ranged_longrange",
      description: "Planner parity ranged longrange",
      combatType: "ranged",
      monsterId: "rock_crab",
      weapon: "maple_shortbow",
      ammo: "mith_arrow",
      style: "longrange",
      levels: { attack: 1, strength: 1, defence: 39, ranged: 39, magic: 1, prayer: 1 },
      gear: BASIC_GEAR,
      prayers: ["none"],
      boosts: ["none"],
      trip: { foodKey: "none", teleport: false, bankSeconds: 0, recoverAmmo: true }
    },
    options: {
      metric: "xph",
      targets: { ranged: 41, defence: 41 },
      pool: { weapon: ["maple_shortbow", "yew_shortbow"], ...EMPTY_ARMOUR_POOL },
      maxLevels: 4
    }
  },
  {
    id: "magic_defence_spell_ladder",
    intent: "Magic and Defence ordering includes a bounded elemental spell ladder.",
    modes: BOTH_MODES,
    definition: {
      id: "planner_parity_magic_defence_spell_ladder",
      description: "Planner parity magic defence spell ladder",
      combatType: "magic",
      monsterId: "chaos_druid",
      weapon: "staff_of_fire",
      spell: "fire_strike",
      style: "defensive",
      levels: { attack: 1, strength: 1, defence: 34, ranged: 1, magic: 34, prayer: 1 },
      gear: BASIC_GEAR,
      prayers: ["none"],
      boosts: ["none"],
      trip: { foodKey: "none", teleport: false, bankSeconds: 0, runeSlots: 2 }
    },
    options: {
      metric: "xph",
      targets: { magic: 36, defence: 36 },
      pool: { weapon: [], ...EMPTY_ARMOUR_POOL },
      maxLevels: 4
    }
  },
  {
    id: "partial_current_attack_xp",
    intent: "Only the remaining XP in the current Attack level is charged.",
    modes: BOTH_MODES,
    definition: meleeDefinition("planner_parity_partial_current_xp", {
      attack: 39,
      strength: 45,
      defence: 40,
      ranged: 1,
      magic: 1,
      prayer: 1
    }),
    options: {
      metric: "xph",
      targets: { attack: 40 },
      startXp: { attack: Math.floor((xpAt(39) + xpAt(40)) / 2) },
      pool: { weapon: ["adamant_scimitar", "rune_scimitar"], ...EMPTY_ARMOUR_POOL },
      maxLevels: 1
    }
  },
  {
    id: "locked_attack_strength_training",
    intent: "A current-level Attack target locks Attack while Strength advances.",
    modes: BOTH_MODES,
    definition: meleeDefinition("planner_parity_locked_attack", {
      attack: 39,
      strength: 44,
      defence: 40,
      ranged: 1,
      magic: 1,
      prayer: 1
    }),
    options: {
      metric: "xph",
      targets: { attack: 39, strength: 46 },
      pool: { weapon: ["adamant_scimitar", "rune_scimitar"], ...EMPTY_ARMOUR_POOL },
      maxLevels: 2
    }
  },
  {
    id: "current_gear_lock",
    intent: "Current-gear lock prevents an otherwise eligible weapon replacement.",
    modes: BOTH_MODES,
    definition: meleeDefinition("planner_parity_current_gear_lock", {
      attack: 40,
      strength: 45,
      defence: 40,
      ranged: 1,
      magic: 1,
      prayer: 1
    }),
    options: {
      metric: "xph",
      targets: { attack: 42 },
      lockGear: true,
      pool: { weapon: ["adamant_scimitar", "rune_scimitar"], ...EMPTY_ARMOUR_POOL },
      maxLevels: 2
    }
  },
  {
    id: "magic_negative_gph",
    intent: "GP/hour planning remains finite when rune costs outweigh loot value.",
    modes: BOTH_MODES,
    definition: {
      id: "planner_parity_magic_negative_gph",
      description: "Planner parity magic negative gph",
      combatType: "magic",
      monsterId: "giant",
      weapon: "staff_of_fire",
      spell: "fire_bolt",
      style: "accurate",
      levels: { attack: 1, strength: 1, defence: 30, ranged: 1, magic: 40, prayer: 1 },
      gear: BASIC_GEAR,
      prayers: ["none"],
      boosts: ["none"],
      trip: { foodKey: "none", teleport: false, bankSeconds: 0, runeSlots: 2 }
    },
    options: {
      metric: "gph",
      targets: { magic: 42 },
      pool: { weapon: [], ...EMPTY_ARMOUR_POOL },
      maxLevels: 2
    }
  },
  {
    id: "melee_balanced_metric",
    intent: "Balanced scoring maps rewrite balanced to legacy bal deterministically.",
    modes: BOTH_MODES,
    definition: meleeDefinition("planner_parity_balanced_metric", {
      attack: 39,
      strength: 44,
      defence: 40,
      ranged: 1,
      magic: 1,
      prayer: 1
    }),
    options: {
      metric: "balanced",
      targets: { attack: 41, strength: 46 },
      pool: { weapon: ["adamant_scimitar", "rune_scimitar"], ...EMPTY_ARMOUR_POOL },
      maxLevels: 4
    }
  },
  {
    id: "no_work_target",
    intent: "A plan with targets at current levels returns no steps.",
    modes: BOTH_MODES,
    definition: meleeDefinition("planner_parity_no_work", {
      attack: 40,
      strength: 45,
      defence: 40,
      ranged: 1,
      magic: 1,
      prayer: 1
    }),
    options: {
      metric: "xph",
      targets: { attack: 40, strength: 45, defence: 40 },
      pool: { weapon: ["rune_scimitar"], ...EMPTY_ARMOUR_POOL },
      maxLevels: 1
    }
  },
  {
    id: "max_levels_truncation",
    intent: "A deliberately short maxLevels bound reports truncation.",
    modes: BOTH_MODES,
    definition: meleeDefinition("planner_parity_truncation", {
      attack: 40,
      strength: 45,
      defence: 40,
      ranged: 1,
      magic: 1,
      prayer: 1
    }),
    options: {
      metric: "xph",
      targets: { attack: 45, strength: 50 },
      pool: { weapon: ["rune_scimitar"], ...EMPTY_ARMOUR_POOL },
      maxLevels: 2
    }
  },
  {
    id: "stable_weapon_transition",
    intent: "A longer Strength path exposes stable transition-run behavior.",
    modes: BOTH_MODES,
    definition: meleeDefinition(
      "planner_parity_stable_weapon_transition",
      { attack: 60, strength: 60, defence: 50, ranged: 1, magic: 1, prayer: 1 },
      { weapon: "dragon_longsword" }
    ),
    options: {
      metric: "dps",
      targets: { strength: 70 },
      pool: { weapon: ["dragon_longsword", "rune_scimitar"], ...EMPTY_ARMOUR_POOL },
      maxLevels: 10
    }
  }
];

export const PLANNER_PARITY_CASES: readonly PlannerParityCaseDefinition[] = [
  ...EXISTING_ACCEPTANCE_CASES,
  ...ADDITIONAL_CASES
];

import type { PlannerOptions } from "../../domain/planner";
import type { LegacyCaseDefinition, LegacyGear } from "../helpers/legacy-sim";

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

export interface PlannerGoldenCaseDefinition {
  id: string;
  description: string;
  definition: LegacyCaseDefinition;
  options: PlannerOptions;
}

export const PLANNER_GOLDEN_CASES: readonly PlannerGoldenCaseDefinition[] = [
  {
    id: "melee_rune_scimitar_attack_unlock",
    description: "Attack training unlocks rune scimitar through domain combat scoring.",
    definition: {
      id: "planner_melee_rune_scimitar_attack_unlock",
      description: "Planner melee rune scimitar attack unlock",
      combatType: "melee",
      monsterId: "giant",
      weapon: "adamant_scimitar",
      style: "aggressive",
      levels: { attack: 39, strength: 45, defence: 40, ranged: 1, magic: 1, prayer: 1 },
      gear: BASIC_GEAR,
      prayers: ["none"],
      boosts: ["none"],
      trip: { foodKey: "none", teleport: false, bankSeconds: 0, prayerMode: "none" }
    },
    options: {
      metric: "xph",
      targets: { attack: 41 },
      pool: {
        weapon: ["adamant_scimitar", "rune_scimitar"],
        ...EMPTY_ARMOUR_POOL
      },
      maxLevels: 10
    }
  },
  {
    id: "ranged_yew_shortbow_unlock",
    description: "Ranged training unlocks yew shortbow without copying ranged formulas.",
    definition: {
      id: "planner_ranged_yew_shortbow_unlock",
      description: "Planner ranged yew shortbow unlock",
      combatType: "ranged",
      monsterId: "rock_crab",
      weapon: "maple_shortbow",
      ammo: "mith_arrow",
      style: "rapid",
      levels: { attack: 1, strength: 1, defence: 40, ranged: 39, magic: 1, prayer: 1 },
      gear: BASIC_GEAR,
      prayers: ["none"],
      boosts: ["none"],
      trip: { foodKey: "none", teleport: false, bankSeconds: 0, recoverAmmo: true }
    },
    options: {
      metric: "xph",
      targets: { ranged: 41 },
      pool: {
        weapon: ["maple_shortbow", "yew_shortbow"],
        ...EMPTY_ARMOUR_POOL
      },
      maxLevels: 10
    }
  },
  {
    id: "magic_fire_bolt_unlock",
    description: "Magic training unlocks fire bolt from the staff spell ladder.",
    definition: {
      id: "planner_magic_fire_bolt_unlock",
      description: "Planner magic fire bolt unlock",
      combatType: "magic",
      monsterId: "chaos_druid",
      weapon: "staff_of_fire",
      spell: "fire_strike",
      style: "accurate",
      levels: { attack: 1, strength: 1, defence: 20, ranged: 1, magic: 34, prayer: 1 },
      gear: BASIC_GEAR,
      prayers: ["none"],
      boosts: ["none"],
      trip: { foodKey: "none", teleport: false, bankSeconds: 0, runeSlots: 2 }
    },
    options: {
      metric: "xph",
      targets: { magic: 36 },
      pool: {
        weapon: [],
        ...EMPTY_ARMOUR_POOL
      },
      maxLevels: 10
    }
  },
  {
    id: "boosted_sustained_strength_path",
    description: "Boosted sustained melee training remains deterministic on the V1 rewrite path.",
    definition: {
      id: "planner_boosted_sustained_strength_path",
      description: "Planner boosted sustained strength path",
      combatType: "melee",
      monsterId: "mossgiant",
      weapon: "rune_scimitar",
      style: "aggressive",
      levels: { attack: 50, strength: 50, defence: 45, ranged: 1, magic: 1, prayer: 31 },
      gear: {
        ...BASIC_GEAR,
        amulet: "amu_power",
        body: "rune_chainbody",
        legs: "rune_platelegs"
      },
      prayers: ["ultimate_strength"],
      boosts: ["super_att", "super_str"],
      sustained: false,
      trip: { foodKey: "lobster", teleport: false, bankSeconds: 0, prayerMode: "none" }
    },
    options: {
      metric: "xph",
      targets: { strength: 52 },
      sustained: true,
      pool: {
        weapon: ["rune_scimitar"],
        ...EMPTY_ARMOUR_POOL
      },
      maxLevels: 10
    }
  }
];

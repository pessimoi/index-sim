import fixtureSet from "./fixtures/planner-golden.json";
import { PLANNER_GOLDEN_CASES } from "./fixtures/planner-case-definitions";
import {
  createPlannerRuntime,
  plannerInputFromDefinition,
  summarizePlan
} from "./helpers/domain-planner";
import {
  buildPlan,
  defaultPool,
  equippable,
  evaluatePlannerCandidate,
  plannerXpBounds,
  requirementForItem,
  reqLevel,
  trainingStanceId,
  xpAt
} from "../domain/planner";
import { sumEquipmentBonuses } from "../domain/equipment";
import type { SimulationContext } from "../domain/shared";

interface PlannerGoldenFixture {
  cases: Array<{
    id: string;
    expected: ReturnType<typeof summarizePlan>;
  }>;
}

const fixtures = fixtureSet as PlannerGoldenFixture;
const fixtureById = new Map(fixtures.cases.map((testCase) => [testCase.id, testCase.expected]));
const V1_PLANNER_ACCEPTANCE_CASE_IDS = [
  "melee_rune_scimitar_attack_unlock",
  "ranged_yew_shortbow_unlock",
  "magic_fire_bolt_unlock",
  "boosted_sustained_strength_path"
] as const;

function withGeneratedRequirement(
  context: SimulationContext,
  itemId: string,
  skills: NonNullable<SimulationContext["gameData"]["requirements"]>[string]["skills"]
): SimulationContext {
  return {
    ...context,
    gameData: {
      ...context.gameData,
      requirements: {
        ...(context.gameData.requirements ?? {}),
        [itemId]: {
          itemId,
          skills,
          provenance: {
            source: "generated",
            sourceRef: `test#${itemId}.requirements`
          }
        }
      }
    }
  };
}

describe("planner XP bounds", () => {
  it("uses the canonical inclusive interval at levels 1, 98 and 99", () => {
    expect(plannerXpBounds(1)).toEqual({ level: 1, min: 0, max: xpAt(2) - 1 });
    expect(plannerXpBounds(98)).toEqual({
      level: 98,
      min: xpAt(98),
      max: xpAt(99) - 1
    });
    expect(plannerXpBounds(99)).toEqual({
      level: 99,
      min: xpAt(99),
      max: 200_000_000
    });
  });

  it("normalizes out-of-range and fractional levels before resolving bounds", () => {
    expect(plannerXpBounds(0)).toEqual(plannerXpBounds(1));
    expect(plannerXpBounds(60.9)).toEqual(plannerXpBounds(60));
    expect(plannerXpBounds(120)).toEqual(plannerXpBounds(99));
  });
});

describe("planner requirements and candidate pools", () => {
  it("keeps gear eligibility as explicit planner policy", () => {
    const { context } = createPlannerRuntime();
    expect(reqLevel("rune_scimitar", "attack", context.gameData)).toBe(40);
    expect(reqLevel("rune_scimitar", "strength", context.gameData)).toBe(0);
    expect(
      equippable(
        "rune_scimitar",
        { attack: 39, strength: 50, defence: 40, ranged: 1, magic: 1 },
        context.gameData
      )
    ).toBe(false);
    expect(
      equippable(
        "rune_scimitar",
        { attack: 40, strength: 50, defence: 40, ranged: 1, magic: 1 },
        context.gameData
      )
    ).toBe(true);
  });

  it("uses generated item requirements before the manual fallback", () => {
    const { context } = createPlannerRuntime();
    const generatedContext = withGeneratedRequirement(context, "rune_scimitar", { attack: 45 });

    expect(requirementForItem(generatedContext.gameData, "rune_scimitar")).toMatchObject({
      source: "generated",
      requirements: { attack: 45 },
      warnings: []
    });
    expect(reqLevel("rune_scimitar", "attack", generatedContext.gameData)).toBe(45);
    expect(
      equippable(
        "rune_scimitar",
        { attack: 44, strength: 50, defence: 40, ranged: 1, magic: 1 },
        generatedContext.gameData
      )
    ).toBe(false);
    expect(
      equippable(
        "rune_scimitar",
        { attack: 45, strength: 50, defence: 40, ranged: 1, magic: 1 },
        generatedContext.gameData
      )
    ).toBe(true);
  });

  it("enforces generated Strength requirements in Planner eligibility", () => {
    const { context } = createPlannerRuntime();
    const generatedContext = withGeneratedRequirement(context, "dragon_halberd", {
      attack: 60,
      strength: 30
    });

    expect(reqLevel("dragon_halberd", "strength", generatedContext.gameData)).toBe(30);
    expect(
      equippable(
        "dragon_halberd",
        { attack: 60, strength: 29, defence: 1, ranged: 1, magic: 1 },
        generatedContext.gameData
      )
    ).toBe(false);
    expect(
      equippable(
        "dragon_halberd",
        { attack: 60, strength: 30, defence: 1, ranged: 1, magic: 1 },
        generatedContext.gameData
      )
    ).toBe(true);
  });

  it("does not expose future weapons in the default pool", () => {
    const { context } = createPlannerRuntime();
    const pool = defaultPool("melee", context);
    expect(pool.weapon).not.toContain("dragon_scimitar");
    expect(pool.weapon).not.toContain("abyssal_whip");
  });
});

describe("planner domain scoring", () => {
  it("chooses training stance from the candidate weapon, not the base weapon", () => {
    const { runtime, context } = createPlannerRuntime();
    const input = plannerInputFromDefinition(runtime, {
      id: "planner_mace_stance_regression",
      description: "Planner dragon mace stance regression",
      combatType: "melee",
      monsterId: "firegiant",
      weapon: "rune_scimitar",
      style: "aggressive",
      levels: { attack: 60, strength: 60, defence: 50, ranged: 1, magic: 1, prayer: 1 },
      gear: {
        helm: "none",
        amulet: "none",
        body: "none",
        legs: "none",
        shield: "none",
        gloves: "none",
        boots: "none",
        cape: "none",
        ring: "none"
      },
      prayers: ["none"],
      boosts: ["none"],
      trip: { foodKey: "none", teleport: false, bankSeconds: 0, prayerMode: "none" }
    });

    const styleId = trainingStanceId(
      "melee",
      "dragon_mace",
      "attack",
      context,
      input.request.styleId
    );
    const request = {
      ...input.request,
      loadout: { ...input.request.loadout, weaponId: "dragon_mace" },
      styleId
    };
    const evaluated = evaluatePlannerCandidate(input, context, request, "dps");
    const bonuses = sumEquipmentBonuses(request.loadout, context.gameData);

    expect(styleId).toBe("accurate");
    expect(evaluated.combat.debug.attackType).toBe("crush");
    expect(evaluated.combat.debug.accuracyBonus).toBe(bonuses.crushAtt);
    expect(evaluated.combat.debug.accuracyBonus).not.toBe(bonuses.slashAtt);
  });

  it("reports missing future or unknown weapon candidates instead of adding canonical data", () => {
    const { runtime, context } = createPlannerRuntime();
    const input = plannerInputFromDefinition(runtime, {
      id: "planner_missing_future_weapon",
      description: "Planner missing future weapon warning",
      combatType: "melee",
      monsterId: "giant",
      weapon: "rune_scimitar",
      style: "aggressive",
      levels: { attack: 70, strength: 70, defence: 60, ranged: 1, magic: 1, prayer: 1 },
      prayers: ["none"],
      boosts: ["none"],
      trip: { foodKey: "none", teleport: false, bankSeconds: 0, prayerMode: "none" }
    });

    const plan = buildPlan(input, context, {
      targets: { attack: 71 },
      pool: {
        weapon: ["abyssal_whip"],
        helm: ["none"],
        body: ["none"],
        legs: ["none"],
        shield: ["none"]
      },
      maxLevels: 1
    });

    expect(plan.warnings.map((warning) => warning.code)).toContain("missing-planner-weapon");
  });

  it("surfaces manual requirement fallback when generated data is missing", () => {
    const { runtime, context } = createPlannerRuntime();
    const input = plannerInputFromDefinition(runtime, {
      id: "planner_manual_requirement_policy",
      description: "Planner manual requirement fallback warning",
      combatType: "melee",
      monsterId: "giant",
      weapon: "rune_scimitar",
      style: "aggressive",
      levels: { attack: 40, strength: 40, defence: 40, ranged: 1, magic: 1, prayer: 1 },
      prayers: ["none"],
      boosts: ["none"],
      trip: { foodKey: "none", teleport: false, bankSeconds: 0, prayerMode: "none" }
    });

    const plan = buildPlan(input, context, { targets: { strength: 41 }, maxLevels: 1 });

    expect(plan.warnings).toContainEqual(
      expect.objectContaining({
        code: "manual-planner-requirement-fallback",
        severity: "info",
        message: expect.stringContaining("manual requirement fallback")
      })
    );
  });

  it("uses generated requirements for Planner unlock binding without fallback warning", () => {
    const { runtime, context } = createPlannerRuntime();
    const generatedContext = withGeneratedRequirement(
      withGeneratedRequirement(context, "iron_scimitar", { attack: 1 }),
      "rune_scimitar",
      { attack: 45 }
    );
    const input = plannerInputFromDefinition(runtime, {
      id: "planner_generated_requirement_unlock",
      description: "Planner generated requirement unlock",
      combatType: "melee",
      monsterId: "giant",
      weapon: "iron_scimitar",
      style: "aggressive",
      levels: { attack: 44, strength: 50, defence: 40, ranged: 1, magic: 1, prayer: 1 },
      gear: {
        helm: "none",
        amulet: "none",
        body: "none",
        legs: "none",
        shield: "none",
        gloves: "none",
        boots: "none",
        cape: "none",
        ring: "none"
      },
      prayers: ["none"],
      boosts: ["none"],
      trip: { foodKey: "none", teleport: false, bankSeconds: 0, prayerMode: "none" }
    });

    const plan = buildPlan(input, generatedContext, {
      targets: { attack: 45 },
      pool: {
        weapon: ["iron_scimitar", "rune_scimitar"],
        helm: ["none"],
        body: ["none"],
        legs: ["none"],
        shield: ["none"]
      },
      maxLevels: 1
    });

    expect(plan.warnings.map((warning) => warning.code)).not.toContain(
      "manual-planner-requirement-fallback"
    );
    expect(plan.unlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: "rune_scimitar",
          reqSkill: "attack",
          reqLevel: 45
        })
      ])
    );
  });
});

describe("planner golden plans", () => {
  it("locks the V1 rewrite acceptance golden case set", () => {
    expect(PLANNER_GOLDEN_CASES.map((testCase) => testCase.id)).toEqual([
      ...V1_PLANNER_ACCEPTANCE_CASE_IDS
    ]);
    expect([...fixtureById.keys()]).toEqual([...V1_PLANNER_ACCEPTANCE_CASE_IDS]);

    const boosted = PLANNER_GOLDEN_CASES.find(
      (testCase) => testCase.id === "boosted_sustained_strength_path"
    );
    expect(boosted?.definition.boosts).toEqual(["super_att", "super_str"]);
    expect(boosted?.definition.sustained).toBe(false);
    expect(boosted?.options.sustained).toBe(true);
  });

  for (const testCase of PLANNER_GOLDEN_CASES) {
    it(`matches ${testCase.id}`, () => {
      const { runtime, context } = createPlannerRuntime();
      const plan = buildPlan(
        plannerInputFromDefinition(runtime, testCase.definition),
        context,
        testCase.options
      );
      expect(summarizePlan(plan)).toEqual(fixtureById.get(testCase.id));
    });
  }
});

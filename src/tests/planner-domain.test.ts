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
  reqLevel,
  trainingStanceId
} from "../domain/planner";
import { sumEquipmentBonuses } from "../domain/equipment";

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

describe("planner requirements and candidate pools", () => {
  it("keeps gear eligibility as explicit planner policy", () => {
    expect(reqLevel("rune_scimitar", "attack")).toBe(40);
    expect(reqLevel("rune_scimitar", "strength")).toBe(0);
    expect(
      equippable("rune_scimitar", { attack: 39, strength: 50, defence: 40, ranged: 1, magic: 1 })
    ).toBe(false);
    expect(
      equippable("rune_scimitar", { attack: 40, strength: 50, defence: 40, ranged: 1, magic: 1 })
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

  it("surfaces the manual item requirement policy until generated requirements are accepted", () => {
    const { runtime, context } = createPlannerRuntime();
    const input = plannerInputFromDefinition(runtime, {
      id: "planner_manual_requirement_policy",
      description: "Planner manual requirement policy warning",
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
        code: "manual-planner-requirement-policy",
        severity: "info",
        message: expect.stringContaining("manual requirement policy")
      })
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

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import baselineJson from "./fixtures/planner-parity-baseline.json";
import { PLANNER_PARITY_CASES } from "./fixtures/planner-parity-cases";
import {
  createCurrentProductContext,
  normalizeRewritePlan,
  plannerParityDigest,
  type PlannerParityBaseline
} from "./helpers/planner-parity";
import { buildPlan } from "../domain/planner";
import { createPlannerRuntime, plannerInputFromDefinition } from "./helpers/domain-planner";

const baseline = baselineJson as PlannerParityBaseline;

describe("legacy Planner representative matrix", () => {
  it("keeps the required bounded case intents and both comparison modes", () => {
    expect(PLANNER_PARITY_CASES).toHaveLength(16);
    expect(PLANNER_PARITY_CASES.map((testCase) => testCase.id)).toEqual([
      "melee_rune_scimitar_attack_unlock",
      "ranged_yew_shortbow_unlock",
      "magic_fire_bolt_unlock",
      "boosted_sustained_strength_path",
      "melee_attack_strength_greedy_order",
      "melee_defence_armour_unlock",
      "ranged_longrange_defence_training",
      "magic_defence_spell_ladder",
      "partial_current_attack_xp",
      "locked_attack_strength_training",
      "current_gear_lock",
      "magic_negative_gph",
      "melee_balanced_metric",
      "no_work_target",
      "max_levels_truncation",
      "stable_weapon_transition"
    ]);
    for (const testCase of PLANNER_PARITY_CASES) {
      expect(testCase.modes).toEqual(["reference-context", "current-product"]);
      expect(testCase.options.maxLevels).toBeLessThanOrEqual(120);
    }
  });

  it("keeps reviewed historical rows complete and current rewrite digests stable", () => {
    const baselineById = new Map(baseline.comparisons.map((entry) => [entry.id, entry]));
    const { runtime, context: referenceContext } = createPlannerRuntime();
    const currentContext = createCurrentProductContext();

    expect(baseline.comparisons).toHaveLength(32);
    expect(
      baseline.comparisons.filter(
        (entry) => entry.classification === "needs-review" || entry.classification === "rewrite-gap"
      )
    ).toEqual([]);

    for (const testCase of PLANNER_PARITY_CASES) {
      for (const mode of testCase.modes) {
        const entry = baselineById.get(`${testCase.id}::${mode}`);
        expect(
          entry,
          `Missing immutable Planner baseline for ${testCase.id}::${mode}`
        ).toBeDefined();
        if (!entry) continue;
        const context = mode === "reference-context" ? referenceContext : currentContext;
        const rewrite = normalizeRewritePlan(
          buildPlan(
            plannerInputFromDefinition(runtime, testCase.definition),
            context,
            testCase.options
          )
        );
        expect(plannerParityDigest(rewrite)).toBe(entry.rewriteDigest);
      }
    }
  }, 60_000);
});

describe("legacy Planner production boundary", () => {
  it("keeps planner-core execution out of production TypeScript modules", () => {
    const roots = ["src/app", "src/adapters", "src/domain", "src/data"];
    const offenders = roots
      .flatMap((root) => sourceFiles(root))
      .filter((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return (
          /from\s+["'][^"']*legacy-planner/.test(source) ||
          /(?:readFileSync|runInContext)[^\n]*planner-core\.js/.test(source)
        );
      });

    expect(offenders).toEqual([]);
  });
});

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const filePath = join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(filePath));
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(filePath);
  }
  return files;
}

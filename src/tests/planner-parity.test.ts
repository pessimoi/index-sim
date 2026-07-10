import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import baselineJson from "./fixtures/planner-parity-baseline.json";
import { PLANNER_PARITY_CASES } from "./fixtures/planner-parity-cases";
import {
  checkPlannerParityBaseline,
  createPlannerParityBaseline,
  normalizeLegacyPlan,
  normalizeRewritePlan,
  runPlannerParityAudit,
  type PlannerParityBaseline
} from "./helpers/planner-parity";
import { buildPlan } from "../domain/planner";
import { createPlannerRuntime, plannerInputFromDefinition } from "./helpers/domain-planner";
import { createLegacyPlannerRuntime, runLegacyPlannerCase } from "./helpers/legacy-planner";

const baseline = baselineJson as PlannerParityBaseline;

describe("legacy Planner audit adapter", () => {
  it("runs a fixed-source case deterministically", () => {
    const runtime = createLegacyPlannerRuntime();
    const testCase = PLANNER_PARITY_CASES[0]!;
    const first = normalizeLegacyPlan(
      runLegacyPlannerCase(runtime, testCase.definition, testCase.options),
      runtime
    );
    const second = normalizeLegacyPlan(
      runLegacyPlannerCase(runtime, testCase.definition, testCase.options),
      runtime
    );

    expect(second).toEqual(first);
  });

  it("rejects duplicate and unknown pool ids before execution", () => {
    const runtime = createLegacyPlannerRuntime();
    const testCase = PLANNER_PARITY_CASES[0]!;
    expect(() =>
      runLegacyPlannerCase(runtime, testCase.definition, {
        ...testCase.options,
        pool: { ...testCase.options.pool, weapon: ["rune_scimitar", "rune_scimitar"] }
      })
    ).toThrow("duplicate ids");
    expect(() =>
      runLegacyPlannerCase(runtime, testCase.definition, {
        ...testCase.options,
        pool: { ...testCase.options.pool, weapon: ["not_a_real_weapon"] }
      })
    ).toThrow("weapon is unknown");
  });

  it("rejects future gear and invalid numeric output", () => {
    const runtime = createLegacyPlannerRuntime();
    const testCase = PLANNER_PARITY_CASES[0]!;
    expect(() =>
      runLegacyPlannerCase(runtime, testCase.definition, {
        ...testCase.options,
        pool: { ...testCase.options.pool, weapon: ["abyssal_whip"] }
      })
    ).toThrow("Hypothetical Planner gear");

    const { runtime: domainRuntime, context } = createPlannerRuntime();
    const plan = buildPlan(
      plannerInputFromDefinition(domainRuntime, testCase.definition),
      context,
      testCase.options
    );
    plan.start.dps = Number.NaN;
    expect(() => normalizeRewritePlan(plan)).toThrow("invalid number");
  });
});

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

  it("matches the reviewed deterministic baseline", () => {
    const audit = runPlannerParityAudit();
    const status = checkPlannerParityBaseline(audit, baseline);

    expect(audit.caseCount).toBe(16);
    expect(audit.comparisonCount).toBe(32);
    expect(status).toEqual({
      valid: true,
      missing: [],
      unexpected: [],
      stale: [],
      needsReview: [],
      rewriteGaps: []
    });

    const changedAudit = {
      ...audit,
      comparisons: audit.comparisons.map((comparison, index) =>
        index === 0 ? { ...comparison, differenceDigest: "changed" } : comparison
      )
    };
    expect(createPlannerParityBaseline(changedAudit, baseline).comparisons[0]?.classification).toBe(
      "needs-review"
    );
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

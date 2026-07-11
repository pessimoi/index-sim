import { createGeneratedRuntimeContext } from "../adapters/generated";
import { createFullSimulationInputForForm } from "../app/view-models/simulation";
import { DEFAULT_FORM_STATE, normalizeFormState } from "../app/state/ui-state";
import {
  analyzeRisk,
  createRiskRandom,
  riskTargetDropOptions,
  selectExclusiveLootIndex,
  summarizeDistribution
} from "../domain/risk";
import { simulateFullSimulation } from "../domain/simulation";

function defaultInput() {
  const { context } = createGeneratedRuntimeContext();
  return {
    context,
    simulation: createFullSimulationInputForForm(DEFAULT_FORM_STATE, context)
  };
}

describe("risk and variability analysis", () => {
  it("keeps the versioned PRNG sequence deterministic", () => {
    const random = createRiskRandom(123);
    expect([random.next(), random.next(), random.next(), random.next()]).toEqual([
      0.7872516233474016, 0.1785435655619949, 0.49531551403924823, 0.23136196262203157
    ]);
  });

  it("uses ordered linearly interpolated distribution summaries", () => {
    expect(summarizeDistribution([50, 10, 40, 20, 30])).toEqual({
      mean: 30,
      p10: 14,
      p50: 30,
      p90: 46
    });
  });

  it("selects at most one row from a mutually exclusive loot roll", () => {
    const chances = [0.25, 0.5];
    expect(selectExclusiveLootIndex(chances, 0.1)).toBe(0);
    expect(selectExclusiveLootIndex(chances, 0.3)).toBe(1);
    expect(selectExclusiveLootIndex(chances, 0.9)).toBeNull();
  });

  it("reproduces all modeled outputs for identical inputs and explicit seed", () => {
    const input = defaultInput();
    const analysis = {
      targetKills: 25,
      horizonMinutes: 30,
      gpTarget: 10_000,
      targetDropRowId: null,
      sampleCount: 200,
      seed: 42
    };
    const first = analyzeRisk({ ...input, analysis });
    const second = analyzeRisk({ ...input, analysis });

    expect(second).toEqual(first);
    expect(() => structuredClone(first)).not.toThrow();
    expect(first.inputFingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(first.sampleCount).toBe(200);
  });

  it("keeps quantiles finite and probabilities bounded", () => {
    const result = analyzeRisk({
      ...defaultInput(),
      analysis: {
        targetKills: 50,
        horizonMinutes: 60,
        gpTarget: 100_000,
        targetDropRowId: null,
        sampleCount: 300,
        seed: 7
      }
    });

    for (const summary of [
      result.killTimeSeconds,
      result.killsPerTrip,
      result.tripCycleMinutes,
      result.timedNetGp
    ]) {
      if (!summary) continue;
      expect(Number.isFinite(summary.mean)).toBe(true);
      expect(summary.p10).toBeLessThanOrEqual(summary.p50);
      expect(summary.p50).toBeLessThanOrEqual(summary.p90);
    }
    expect(result.foodRunsOutProbability).toBeGreaterThanOrEqual(0);
    expect(result.foodRunsOutProbability).toBeLessThanOrEqual(1);
    expect(result.gpTargetProbability).toBeGreaterThanOrEqual(0);
    expect(result.gpTargetProbability).toBeLessThanOrEqual(1);
    expect(result.coverage.lootOccurrence).toBeGreaterThanOrEqual(0);
    expect(result.coverage.lootOccurrence).toBeLessThanOrEqual(1);
  });

  it("samples exact incoming descriptors and reports partial and compatibility models as mean-only", () => {
    const exactInput = defaultInput();
    const analysis = {
      targetKills: 25,
      horizonMinutes: 15,
      gpTarget: 0,
      targetDropRowId: null,
      sampleCount: 100,
      seed: 73
    };
    const exact = analyzeRisk({ ...exactInput, analysis });
    expect(exact.coverage.incomingModel).toBe("Source-backed");
    expect(["sampled", "none"]).toContain(exact.coverage.incomingDamage);

    const partialForm = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "black_dragon",
      trip: { ...DEFAULT_FORM_STATE.trip, safespot: false }
    });
    const partialSimulation = createFullSimulationInputForForm(partialForm, exactInput.context);
    const partial = analyzeRisk({
      context: exactInput.context,
      simulation: partialSimulation,
      analysis
    });
    expect(partial.coverage).toMatchObject({
      incomingModel: "Partial model",
      incomingDamage: "mean-only"
    });
    expect(partial.coverage.meanOnlySources).toContain("Partial incoming attack model");
    expect(partial.warnings.map((warning) => warning.code)).toContain(
      "risk-incoming-partial-mean-only"
    );

    const monsterId = exactInput.simulation.request.monsterId;
    const legacyMonster = structuredClone(exactInput.context.gameData.monsters[monsterId]!);
    delete legacyMonster.incomingAttacks;
    delete legacyMonster.incomingAttackCoverage;
    const compatibilityContext = {
      ...exactInput.context,
      gameData: {
        ...exactInput.context.gameData,
        monsters: {
          ...exactInput.context.gameData.monsters,
          [monsterId]: legacyMonster
        }
      }
    };
    const compatibility = analyzeRisk({
      context: compatibilityContext,
      simulation: exactInput.simulation,
      analysis
    });
    expect(compatibility.coverage.incomingModel).toBe("Compatibility fallback");
    if (compatibility.coverage.incomingDamage !== "none") {
      expect(compatibility.coverage.incomingDamage).toBe("mean-only");
      expect(compatibility.coverage.meanOnlySources).toContain(
        "Compatibility incoming attack fallback"
      );
    }
  });

  it("keeps modeled means aligned with the accepted deterministic expectations", () => {
    const input = defaultInput();
    const baseline = simulateFullSimulation(input.simulation, input.context);
    const result = analyzeRisk({
      ...input,
      analysis: {
        targetKills: 50,
        horizonMinutes: 60,
        gpTarget: 0,
        targetDropRowId: null,
        sampleCount: 2_000,
        seed: 321
      }
    });

    expect(result.killTimeSeconds.mean).toBeCloseTo(baseline.rates.ttkSec, 0);
    expect(result.killsPerTrip?.mean).toBeCloseTo(baseline.trip.trip.killsPerTrip, 0);
    expect(result.timedNetGp.mean).toBeCloseTo(baseline.rates.effectiveNetGpPerHour, -3);
  });

  it("reports zero food risk when the active safespot has no incoming food demand", () => {
    const { context } = createGeneratedRuntimeContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      combatStyle: "ranged",
      weaponId: "magic_shortbow",
      ammoId: "rune_arrow",
      styleId: "rapid",
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        foodKey: "none",
        foodCount: 0,
        safespot: true,
        prayerMode: "none",
        recoilRings: 0
      }
    });
    const result = analyzeRisk({
      context,
      simulation: createFullSimulationInputForForm(form, context),
      analysis: {
        targetKills: 500,
        horizonMinutes: 15,
        gpTarget: 0,
        targetDropRowId: null,
        sampleCount: 100,
        seed: 11
      }
    });

    expect(result.foodRunsOutProbability).toBe(0);
    expect(result.coverage.incomingDamage).toBe("none");
    expect(result.killsPerTrip?.p50 ?? 0).toBeGreaterThan(0);
  });

  it("reports certain food insufficiency when no food is carried against positive demand", () => {
    const { context } = createGeneratedRuntimeContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        foodKey: "none",
        foodCount: 0,
        safespot: false
      }
    });
    const result = analyzeRisk({
      context,
      simulation: createFullSimulationInputForForm(form, context),
      analysis: {
        targetKills: 1,
        horizonMinutes: 10,
        gpTarget: 0,
        targetDropRowId: null,
        sampleCount: 100,
        seed: 12
      }
    });

    expect(result.foodRunsOutProbability).toBe(1);
  });

  it("treats a manual food-per-kill override as deterministic sufficiency demand", () => {
    const { context } = createGeneratedRuntimeContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        foodKey: "lobster",
        foodCount: 1,
        foodPerKillOverride: 0.5
      }
    });
    const simulation = createFullSimulationInputForForm(form, context);
    const common = {
      context,
      simulation,
      analysis: {
        targetKills: 2,
        horizonMinutes: 10,
        gpTarget: 0,
        targetDropRowId: null,
        sampleCount: 100,
        seed: 12
      }
    };

    expect(analyzeRisk(common).foodRunsOutProbability).toBe(0);
    expect(
      analyzeRisk({
        ...common,
        analysis: { ...common.analysis, targetKills: 3 }
      }).foodRunsOutProbability
    ).toBe(1);
    expect(analyzeRisk(common).coverage.incomingDamage).toBe("deterministic-override");
  });

  it("computes target-drop fixed-kill probability analytically", () => {
    const input = defaultInput();
    const options = riskTargetDropOptions(input.simulation, input.context);
    expect(options.length).toBeGreaterThan(0);
    const target = options[0]!;
    const baseline = simulateFullSimulation(input.simulation, input.context);
    const row = baseline.trip.lootBreakdown.find((candidate) => candidate.rowId === target.id)!;
    const targetKills = 40;
    const result = analyzeRisk({
      ...input,
      analysis: {
        targetKills,
        horizonMinutes: 60,
        gpTarget: 0,
        targetDropRowId: target.id,
        sampleCount: 200,
        seed: 99
      }
    });

    expect(result.targetDrop?.name).toBe(target.label);
    expect(result.targetDrop?.fixedKillProbability).toBeCloseTo(
      1 - Math.pow(1 - row.chance, targetKills),
      12
    );
    expect(result.targetDrop!.timedProbability).toBeGreaterThanOrEqual(0);
    expect(result.targetDrop!.timedProbability).toBeLessThanOrEqual(1);
  });

  it("rejects skipped or unavailable target rows without leaking raw data", () => {
    const result = analyzeRisk({
      ...defaultInput(),
      analysis: {
        targetKills: 10,
        horizonMinutes: 10,
        gpTarget: 0,
        targetDropRowId: "missing-private-row",
        sampleCount: 100,
        seed: 1
      }
    });

    expect(result.targetDrop).toBeNull();
    expect(result.warnings).toContainEqual({
      code: "risk-target-drop-unavailable",
      severity: "warning",
      message:
        "The selected target drop is skipped, inactive or unavailable for the current monster."
    });
  });

  it("keeps a full-day horizon finite through deterministic hour blocks", () => {
    const result = analyzeRisk({
      ...defaultInput(),
      analysis: {
        targetKills: 50,
        horizonMinutes: 1_440,
        gpTarget: 1_000_000,
        targetDropRowId: null,
        sampleCount: 100,
        seed: 1234
      }
    });

    expect(Number.isFinite(result.timedNetGp.p10)).toBe(true);
    expect(result.timedNetGp.p10).toBeLessThanOrEqual(result.timedNetGp.p90);
    expect(
      result.warnings.some((warning) => warning.code === "risk-long-horizon-hour-blocks")
    ).toBe(true);
  });
});

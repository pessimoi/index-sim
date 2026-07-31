import fixtureSet from "./fixtures/legacy-golden.json";
import { loadCurrentTestContext } from "./helpers/current-sim";
import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  DEFAULT_FORM_STATE,
  applyWeaponSelection,
  formToSimulationRequest,
  formToTripPolicy,
  normalizeFormState,
  setCustomSetupForMonster,
  switchCombatStyleLoadout,
  type CombatSetupFormState
} from "../app/state/ui-state";
import {
  DEFAULT_DENSE_COMPARE_STATE,
  DEFAULT_DENSE_COMPARE_SORT_STATE
} from "../app/state/dense-compare";
import { MAX_DUEL_SNAPSHOTS, createDuelSnapshot } from "../app/state/duel-snapshots";
import { createSimulationViewModel } from "../app/view-models/simulation";
import { optimizeLootPrefsForMonster } from "../app/view-models/loot";
import { createPlannerViewModel } from "../app/view-models/planner";
import {
  createCompareRows,
  createDenseCompareRows,
  createDenseCompareScaleModel,
  sortDenseCompareRows,
  type DenseCompareRowViewModel
} from "../app/view-models/compare";
import { createDuelComparisonViewModel, createDuelMatrixViewModel } from "../app/view-models/duel";
import { formatNumber } from "../app/view-models/formatting";
import { createStatsCombatRollDetailViewModel } from "../app/view-models/stats";
import {
  ammoOptions,
  equipmentSlotOptions,
  gearQuickActionForSlot,
  optimizeVisibleLoadout,
  spellOptions,
  weaponOptions
} from "../app/view-models/loadout";
import { simulateFullSimulation } from "../domain/simulation";
import { casketStats, HIGH_ALCH_MAGIC_XP_PER_CAST } from "../domain/trip";
import { EQUIPMENT_SLOTS, type SimulationContext } from "../domain/shared";

interface GoldenFixture {
  tolerances: {
    defaultNumericAbs: number;
  };
  cases: Array<{
    id: string;
    expected: Record<string, unknown>;
  }>;
}

const fixtures = fixtureSet as GoldenFixture;
const fixturesById = new Map(fixtures.cases.map((testCase) => [testCase.id, testCase]));
const numericRoundingGuard = 0.000000001;

export function withGeneratedRequirement(
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

function stableNumber(value: number): number {
  return Number(value.toFixed(6));
}

export function expectCloseToFixture(actual: number, expected: unknown): void {
  expect(typeof expected).toBe("number");
  expect(Math.abs(stableNumber(actual) - (expected as number))).toBeLessThanOrEqual(
    fixtures.tolerances.defaultNumericAbs + numericRoundingGuard
  );
}

export function expectedFor(caseId: string): Record<string, unknown> {
  const fixture = fixturesById.get(caseId);
  expect(fixture, `Missing legacy fixture for ${caseId}`).toBeDefined();
  if (!fixture) throw new Error(`Missing legacy fixture for ${caseId}`);
  return fixture.expected;
}

export function rangedRockCrabForm(): CombatSetupFormState {
  return {
    ...DEFAULT_FORM_STATE,
    combatStyle: "ranged",
    monsterId: "rock_crab",
    weaponId: "magic_shortbow",
    ammoId: "mith_arrow",
    styleId: "rapid",
    levels: {
      attack: 40,
      strength: 40,
      defence: 40,
      hitpoints: 50,
      ranged: 60,
      magic: 40,
      prayer: 31
    },
    gear: {
      helm: "archer_helm",
      amulet: "amu_power",
      body: "black_dhide_body",
      legs: "black_dhide_legs",
      shield: "none",
      gloves: "black_vambraces",
      boots: "ranger_boots",
      cape: "cape_legends",
      ring: "none"
    },
    prayers: ["none"],
    boosts: ["none"],
    sustained: false,
    repotThreshold: null,
    ringOfWealth: false,
    trip: {
      ...DEFAULT_FORM_STATE.trip,
      foodKey: "none",
      teleport: false,
      bankSeconds: 0,
      prayerMode: "none",
      alching: false,
      recoverAmmo: true,
      antifire: false,
      antipoison: false
    }
  };
}

export function rangedDagannothForm(): CombatSetupFormState {
  return {
    ...rangedRockCrabForm(),
    monsterId: "dagannoth",
    ammoId: "rune_arrow",
    trip: {
      ...rangedRockCrabForm().trip,
      bankSeconds: 150
    }
  };
}

export function activeAssumptionRows(result: ReturnType<typeof createSimulationViewModel>) {
  return [...result.activeAssumptions.visibleRows, ...result.activeAssumptions.hiddenRows];
}

export function activeAssumptionRow(
  result: ReturnType<typeof createSimulationViewModel>,
  id: string
) {
  return activeAssumptionRows(result).find((row) => row.id === id);
}

type StatsSourceDetailForTest = ReturnType<
  typeof createSimulationViewModel
>["statsSourceBreakdown"]["details"][number];

export function statsSourceDetail(
  result: ReturnType<typeof createSimulationViewModel>,
  id: StatsSourceDetailForTest["id"]
) {
  return result.statsSourceBreakdown.details.find((detail) => detail.id === id);
}

export function statsSourceMetrics(detail: StatsSourceDetailForTest | undefined) {
  return new Map((detail?.metrics ?? []).map((metric) => [metric.id, metric]));
}

export function combatRollMetrics(result: ReturnType<typeof createSimulationViewModel>) {
  return new Map(result.combatRollDetail.metrics.map((metric) => [metric.id, metric]));
}
export {
  DEFAULT_DENSE_COMPARE_SORT_STATE,
  DEFAULT_DENSE_COMPARE_STATE,
  DEFAULT_FORM_STATE,
  EQUIPMENT_SLOTS,
  HIGH_ALCH_MAGIC_XP_PER_CAST,
  MAX_DUEL_SNAPSHOTS,
  ammoOptions,
  applyWeaponSelection,
  casketStats,
  createCompareRows,
  createDenseCompareRows,
  createDenseCompareScaleModel,
  createDuelComparisonViewModel,
  createDuelMatrixViewModel,
  createDuelSnapshot,
  createGeneratedRuntimeContext,
  createPlannerViewModel,
  createSimulationViewModel,
  createStatsCombatRollDetailViewModel,
  equipmentSlotOptions,
  formToSimulationRequest,
  formToTripPolicy,
  formatNumber,
  gearQuickActionForSlot,
  loadCurrentTestContext,
  normalizeFormState,
  optimizeLootPrefsForMonster,
  optimizeVisibleLoadout,
  setCustomSetupForMonster,
  simulateFullSimulation,
  sortDenseCompareRows,
  spellOptions,
  switchCombatStyleLoadout,
  weaponOptions
};
export type { CombatSetupFormState, DenseCompareRowViewModel, SimulationContext };

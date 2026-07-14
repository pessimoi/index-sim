import { createGeneratedRuntimeContext } from "@/adapters/generated";
import {
  startMeasuredCalculationTask,
  type CalculationTaskMeasurement
} from "@/app/calculation-worker-client";
import type { CalculationRequest } from "@/app/calculation-task";
import {
  createDuelSnapshot,
  MAX_DUEL_SNAPSHOTS,
  type DuelSnapshotsState
} from "@/app/state/duel-snapshots";
import { DEFAULT_PLANNER_UI_STATE, type PlannerUiState } from "@/app/state/planner";
import {
  DEFAULT_FORM_STATE,
  normalizeFormState,
  type CombatSetupFormState,
  type CustomSetupsByMonsterState
} from "@/app/state/ui-state";
import { DEFAULT_RISK_SAMPLE_COUNT, MAX_RISK_SAMPLE_COUNT } from "@/domain/risk";

const context = createGeneratedRuntimeContext().context;
const monsterIds = Object.keys(context.gameData.monsters).sort();
const MEASUREMENT_TASK_TIMEOUT_MS = 120_000;

const CASES = [
  { id: "dense-typical", task: "dense-compare", profile: "typical" },
  { id: "dense-heavy", task: "dense-compare", profile: "heavy" },
  { id: "planner-typical", task: "planner", profile: "typical" },
  { id: "planner-heavy", task: "planner", profile: "heavy" },
  { id: "duel-typical", task: "duel-matrix", profile: "typical" },
  { id: "duel-heavy", task: "duel-matrix", profile: "heavy" },
  { id: "risk-typical", task: "risk-analysis", profile: "typical" },
  { id: "risk-heavy", task: "risk-analysis", profile: "heavy" }
] as const;

type MeasurementCase = (typeof CASES)[number];
type MeasurementCaseId = MeasurementCase["id"];

export interface CalculationWorkerBrowserSample {
  caseId: MeasurementCaseId;
  task: MeasurementCase["task"];
  profile: MeasurementCase["profile"];
  requestJsonBytes: number;
  resultJsonBytes: number;
  timing: CalculationTaskMeasurement;
}

export interface CalculationWorkerMeasurementBrowserApi {
  cases: readonly MeasurementCase[];
  run(caseId: MeasurementCaseId): Promise<CalculationWorkerBrowserSample>;
}

function levelVariant(
  index: number,
  monsterId = DEFAULT_FORM_STATE.monsterId
): CombatSetupFormState {
  return normalizeFormState({
    ...DEFAULT_FORM_STATE,
    monsterId,
    levels: {
      ...DEFAULT_FORM_STATE.levels,
      attack: Math.min(99, DEFAULT_FORM_STATE.levels.attack + index),
      strength: Math.min(99, DEFAULT_FORM_STATE.levels.strength + index),
      ranged: Math.min(99, DEFAULT_FORM_STATE.levels.ranged + Math.floor(index / 2)),
      magic: Math.min(99, DEFAULT_FORM_STATE.levels.magic + Math.floor(index / 3))
    }
  });
}

function denseRequest(heavy: boolean): CalculationRequest {
  const customSetupsByMonster: CustomSetupsByMonsterState = heavy
    ? Object.fromEntries(
        monsterIds.map((monsterId, index) => [monsterId, levelVariant(index, monsterId)])
      )
    : {};
  return {
    kind: "dense-compare",
    form: DEFAULT_FORM_STATE,
    context,
    cannonByMonster: {},
    lootPrefsByMonster: {},
    customSetupsByMonster,
    lootSettingsByMonster: {}
  };
}

function plannerRequest(heavy: boolean): CalculationRequest {
  const plannerState: PlannerUiState = heavy
    ? {
        ...DEFAULT_PLANNER_UI_STATE,
        metric: "balanced",
        targetLevels: {
          attack: 70,
          strength: 70,
          defence: 60,
          ranged: 60,
          magic: 60
        }
      }
    : DEFAULT_PLANNER_UI_STATE;
  return {
    kind: "planner",
    form: DEFAULT_FORM_STATE,
    context,
    lootSettingsByMonster: {},
    plannerState
  };
}

function duelSnapshots(count: number): DuelSnapshotsState {
  return {
    snapshots: Array.from({ length: count }, (_, index) =>
      createDuelSnapshot(
        `worker-measure-${index + 1}`,
        `Worker measurement ${index + 1}`,
        levelVariant(index)
      )
    )
  };
}

function duelRequest(heavy: boolean): CalculationRequest {
  return {
    kind: "duel-matrix",
    form: DEFAULT_FORM_STATE,
    snapshots: duelSnapshots(heavy ? MAX_DUEL_SNAPSHOTS : 1),
    context,
    cannonByMonster: {},
    lootPrefsByMonster: {},
    lootSettingsByMonster: {}
  };
}

function riskRequest(heavy: boolean): CalculationRequest {
  return {
    kind: "risk-analysis",
    form: DEFAULT_FORM_STATE,
    context,
    cannonByMonster: {},
    lootPrefs: {},
    lootSettingsByMonster: {},
    analysis: {
      targetKills: 50,
      horizonMinutes: 60,
      gpTarget: 100_000,
      targetDropRowId: null,
      sampleCount: heavy ? MAX_RISK_SAMPLE_COUNT : DEFAULT_RISK_SAMPLE_COUNT,
      seed: 27
    }
  };
}

function requestFor(caseId: MeasurementCaseId): CalculationRequest {
  if (caseId === "dense-typical") return denseRequest(false);
  if (caseId === "dense-heavy") return denseRequest(true);
  if (caseId === "planner-typical") return plannerRequest(false);
  if (caseId === "planner-heavy") return plannerRequest(true);
  if (caseId === "duel-typical") return duelRequest(false);
  if (caseId === "duel-heavy") return duelRequest(true);
  if (caseId === "risk-typical") return riskRequest(false);
  return riskRequest(true);
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

const api: CalculationWorkerMeasurementBrowserApi = {
  cases: CASES,
  async run(caseId) {
    const definition = CASES.find((entry) => entry.id === caseId);
    if (!definition) throw new Error("Unknown calculation worker measurement case");
    const request = requestFor(caseId);
    const requestJsonBytes = jsonBytes(request);
    const measured = await startMeasuredCalculationTask(
      request,
      undefined,
      MEASUREMENT_TASK_TIMEOUT_MS
    ).promise;
    return {
      caseId,
      task: definition.task,
      profile: definition.profile,
      requestJsonBytes,
      resultJsonBytes: jsonBytes(measured.result),
      timing: measured.timing
    };
  }
};

(
  globalThis as typeof globalThis & {
    __calculationWorkerMeasurement: CalculationWorkerMeasurementBrowserApi;
  }
).__calculationWorkerMeasurement = api;

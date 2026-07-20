import type { SimulationContext } from "@/domain/shared";
import { analyzeRisk, type RiskAnalysisParameters, type RiskAnalysisResult } from "@/domain/risk";
import type { LootPrefsState } from "./state/loot-prefs";
import type { LootSettingsByMonsterState } from "./state/loot-settings";
import type { PlannerUiState } from "./state/planner";
import { DEFAULT_DENSE_COMPARE_STATE } from "./state/dense-compare";
import type {
  CannonByMonsterState,
  CombatSetupFormState,
  CustomSetupsByMonsterState
} from "./state/ui-state";
import type { DuelSnapshotsState } from "./state/duel-snapshots";
import { createDenseCompareRows, type DenseCompareRowViewModel } from "./view-models/compare";
import { createDuelMatrixViewModel, type DuelMatrixViewModel } from "./view-models/duel";
import {
  createPlannerPanelViewModel,
  createPlannerViewModel,
  type PlannerPanelViewModel
} from "./view-models/planner";
import { createFullSimulationInputForForm } from "./view-models/simulation-input";

export interface DenseCompareCalculationRequest {
  kind: "dense-compare";
  form: CombatSetupFormState;
  context: SimulationContext;
  cannonByMonster: CannonByMonsterState;
  lootPrefsByMonster: LootPrefsState;
  customSetupsByMonster: CustomSetupsByMonsterState;
  lootSettingsByMonster: LootSettingsByMonsterState;
}

export interface PlannerCalculationRequest {
  kind: "planner";
  form: CombatSetupFormState;
  context: SimulationContext;
  lootSettingsByMonster: LootSettingsByMonsterState;
  plannerState: PlannerUiState;
}

export interface DuelMatrixCalculationRequest {
  kind: "duel-matrix";
  form: CombatSetupFormState;
  snapshots: DuelSnapshotsState;
  context: SimulationContext;
  cannonByMonster: CannonByMonsterState;
  lootPrefsByMonster: LootPrefsState;
  lootSettingsByMonster: LootSettingsByMonsterState;
}

export interface RiskAnalysisCalculationRequest {
  kind: "risk-analysis";
  form: CombatSetupFormState;
  context: SimulationContext;
  cannonByMonster: CannonByMonsterState;
  lootPrefs: Record<string, string | undefined>;
  lootSettingsByMonster: LootSettingsByMonsterState;
  analysis: RiskAnalysisParameters;
}

export type CalculationRequest =
  | DenseCompareCalculationRequest
  | PlannerCalculationRequest
  | DuelMatrixCalculationRequest
  | RiskAnalysisCalculationRequest;

export interface CalculationResultByKind {
  "dense-compare": DenseCompareRowViewModel[];
  planner: PlannerPanelViewModel;
  "duel-matrix": DuelMatrixViewModel;
  "risk-analysis": RiskAnalysisResult;
}

export type CalculationResult<T extends CalculationRequest> = CalculationResultByKind[T["kind"]];

export function executeCalculationTask<T extends CalculationRequest>(
  request: T
): CalculationResult<T> {
  if (request.kind === "dense-compare") {
    return createDenseCompareRows(
      request.form,
      request.context,
      DEFAULT_DENSE_COMPARE_STATE,
      request.cannonByMonster,
      request.lootPrefsByMonster,
      request.customSetupsByMonster,
      request.lootSettingsByMonster
    ) as CalculationResult<T>;
  }
  if (request.kind === "planner") {
    return createPlannerPanelViewModel(
      createPlannerViewModel(
        request.form,
        request.context,
        request.lootSettingsByMonster,
        request.plannerState
      ),
      request.context
    ) as CalculationResult<T>;
  }
  if (request.kind === "risk-analysis") {
    return analyzeRisk({
      simulation: createFullSimulationInputForForm(
        request.form,
        request.context,
        request.cannonByMonster,
        request.lootPrefs,
        request.lootSettingsByMonster
      ),
      context: request.context,
      analysis: request.analysis
    }) as CalculationResult<T>;
  }
  return createDuelMatrixViewModel(
    request.form,
    request.snapshots,
    request.context,
    request.cannonByMonster,
    request.lootPrefsByMonster,
    request.lootSettingsByMonster
  ) as CalculationResult<T>;
}

export type CalculationWorkerResponse<T extends CalculationRequest = CalculationRequest> =
  | { ok: true; kind: T["kind"]; result: CalculationResult<T> }
  | { ok: false; kind: T["kind"]; error: "calculation_failed" };

export const CALCULATION_WORKER_MEASUREMENT_TYPE = "calculation-worker-measurement" as const;

export interface CalculationWorkerMeasurementRequest<
  T extends CalculationRequest = CalculationRequest
> {
  type: typeof CALCULATION_WORKER_MEASUREMENT_TYPE;
  request: T;
}

export interface CalculationWorkerExecutionTiming {
  receivedAtMs: number;
  startedAtMs: number;
  finishedAtMs: number;
}

export interface CalculationWorkerMeasurementResponse<
  T extends CalculationRequest = CalculationRequest
> {
  type: typeof CALCULATION_WORKER_MEASUREMENT_TYPE;
  kind: T["kind"];
  response: CalculationWorkerResponse<T>;
  timing: CalculationWorkerExecutionTiming;
}

export type CalculationWorkerInput = CalculationRequest | CalculationWorkerMeasurementRequest;
export type CalculationWorkerOutput =
  CalculationWorkerResponse | CalculationWorkerMeasurementResponse;

function isMeasurementRequest(
  input: CalculationWorkerInput
): input is CalculationWorkerMeasurementRequest {
  return "type" in input && input.type === CALCULATION_WORKER_MEASUREMENT_TYPE;
}

export function executeCalculationWorkerInput(
  input: CalculationWorkerInput,
  now: () => number
): CalculationWorkerOutput {
  const measured = isMeasurementRequest(input);
  const request = measured ? input.request : input;
  const receivedAtMs = now();
  const startedAtMs = now();
  let response: CalculationWorkerResponse;
  try {
    response = {
      ok: true,
      kind: request.kind,
      result: executeCalculationTask(request)
    } as CalculationWorkerResponse;
  } catch {
    response = { ok: false, kind: request.kind, error: "calculation_failed" };
  }
  const finishedAtMs = now();

  if (!measured) return response;
  return {
    type: CALCULATION_WORKER_MEASUREMENT_TYPE,
    kind: request.kind,
    response,
    timing: { receivedAtMs, startedAtMs, finishedAtMs }
  };
}

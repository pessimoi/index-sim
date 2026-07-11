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
import {
  createDenseCompareRows,
  createDuelMatrixViewModel,
  createFullSimulationInputForForm,
  createPlannerPanelViewModel,
  createPlannerViewModel,
  type DenseCompareRowViewModel,
  type DuelMatrixViewModel,
  type PlannerPanelViewModel
} from "./view-models/simulation";

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
      )
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

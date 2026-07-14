import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlannerMetric } from "@/domain/planner";
import type { SimulationContext } from "@/domain/shared";
import {
  CalculationTaskCancelledError,
  startCalculationTask,
  type RunningCalculationTask
} from "../calculation-worker-client";
import type { PlannerCalculationRequest } from "../calculation-task";
import type { LootSettingsByMonsterState } from "../state/loot-settings";
import { normalizePlannerUiState, type PlannerUiState } from "../state/planner";
import type { CombatSetupFormState } from "../state/ui-state";
import {
  createPlannerGearPoolEditorViewModel,
  type PlannerGearPoolEditorViewModel,
  type PlannerPanelViewModel,
  type PlannerStatus
} from "../view-models/planner";

export interface PlannerCalculationSource {
  form: CombatSetupFormState;
  context: SimulationContext;
  lootSettingsByMonster: LootSettingsByMonsterState;
  plannerState: PlannerUiState;
}

interface PlannerCalculationBuild {
  panel: PlannerPanelViewModel | null;
  error: string | null;
  source: PlannerCalculationSource;
}

export interface UsePlannerCalculationInput {
  active: boolean;
  draftState: PlannerUiState;
  form: CombatSetupFormState;
  context: SimulationContext | null;
  lootSettingsByMonster: LootSettingsByMonsterState;
}

export interface PlannerCalculationController {
  panel: PlannerPanelViewModel | null;
  gearPoolEditor: PlannerGearPoolEditorViewModel | null;
  error: string | null;
  pending: boolean;
  draftDirty: boolean;
  status: PlannerStatus;
  computedMetric: PlannerMetric;
  recompute(): void;
}

type PlannerTaskStarter = (
  request: PlannerCalculationRequest
) => RunningCalculationTask<PlannerCalculationRequest>;

const startPlannerTask: PlannerTaskStarter = (request) => startCalculationTask(request);

export function isPlannerBuildFresh(
  build: PlannerCalculationBuild | null,
  source: PlannerCalculationSource | null
): boolean {
  return (
    build != null &&
    source != null &&
    build.source.form === source.form &&
    build.source.context === source.context &&
    build.source.lootSettingsByMonster === source.lootSettingsByMonster &&
    build.source.plannerState === source.plannerState
  );
}

export function plannerDraftIsDirty(draft: PlannerUiState, computed: PlannerUiState): boolean {
  return JSON.stringify(draft) !== JSON.stringify(computed);
}

export function plannerStatusFor(input: {
  error: string | null;
  draftDirty: boolean;
  pending: boolean;
  panel: PlannerPanelViewModel | null;
}): PlannerStatus {
  if (input.error) return "error";
  if (input.draftDirty) return "pending";
  if (input.pending) return "running";
  if (input.panel?.isEmpty) return "empty";
  if (input.panel) return "ready";
  return "idle";
}

export function usePlannerCalculation(
  input: UsePlannerCalculationInput,
  options: { startTask?: PlannerTaskStarter } = {}
): PlannerCalculationController {
  const [computedState, setComputedState] = useState(() =>
    normalizePlannerUiState(input.draftState)
  );
  const [build, setBuild] = useState<PlannerCalculationBuild | null>(null);
  const startTask = options.startTask ?? startPlannerTask;
  const draftStateForCompute = useMemo(
    () => normalizePlannerUiState(input.draftState),
    [input.draftState]
  );
  const draftDirty = useMemo(
    () => plannerDraftIsDirty(draftStateForCompute, computedState),
    [computedState, draftStateForCompute]
  );
  const source = useMemo<PlannerCalculationSource | null>(
    () =>
      input.context
        ? {
            form: input.form,
            context: input.context,
            lootSettingsByMonster: input.lootSettingsByMonster,
            plannerState: computedState
          }
        : null,
    [computedState, input.context, input.form, input.lootSettingsByMonster]
  );

  useEffect(() => {
    if (!input.active || !source) return;
    const task = startTask({ kind: "planner", ...source });
    void task.promise
      .then((panel) => setBuild({ panel, error: null, source }))
      .catch((error: unknown) => {
        if (error instanceof CalculationTaskCancelledError) return;
        setBuild({ panel: null, error: "Planner could not compute the current plan", source });
      });
    return task.cancel;
  }, [input.active, source, startTask]);

  const buildFresh = isPlannerBuildFresh(build, source);
  const result = buildFresh ? build : null;
  const pending = input.active && source != null && !buildFresh;
  const panel = result?.panel ?? null;
  const error = result?.error ?? null;
  const gearPoolEditor = useMemo(
    () =>
      input.context
        ? createPlannerGearPoolEditorViewModel(input.form, input.context, input.draftState)
        : null,
    [input.context, input.draftState, input.form]
  );
  const recompute = useCallback(
    () => setComputedState(draftStateForCompute),
    [draftStateForCompute]
  );

  return {
    panel,
    gearPoolEditor,
    error,
    pending,
    draftDirty,
    status: plannerStatusFor({ error, draftDirty, pending, panel }),
    computedMetric: computedState.metric,
    recompute
  };
}

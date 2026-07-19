import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlannerMetric } from "@/domain/planner";
import type { SimulationContext } from "@/domain/shared";
import {
  CalculationTaskCancelledError,
  startCalculationTask,
  type RunningCalculationTask
} from "../calculation-worker-client";
import type { PlannerCalculationRequest } from "../calculation-task";
import type { LootSettingsByMonsterState } from "../state/loot-settings";
import {
  normalizePlannerUiState,
  reconcilePlannerProgressWithLevels,
  type PlannerProgressAdjustment,
  type PlannerUiState
} from "../state/planner";
import type { CombatSetupFormState } from "../state/ui-state";
import {
  createPlannerGearPoolEditorViewModel,
  type PlannerGearPoolEditorViewModel,
  type PlannerPanelViewModel
} from "../view-models/planner";
import type { CalculationLifecycleStatus } from "./calculation-lifecycle";

export interface PlannerCalculationSource {
  form: CombatSetupFormState;
  context: SimulationContext;
  lootSettingsByMonster: LootSettingsByMonsterState;
  plannerState: PlannerUiState;
}

export interface PlannerCalculationBuild {
  panel: PlannerPanelViewModel;
  source: PlannerCalculationSource;
}

export interface PlannerCalculationFailure {
  source: PlannerCalculationSource;
  message: "Planner could not compute the current plan. Your inputs are unchanged.";
}

interface PlannerCalculationPending {
  task: RunningCalculationTask<PlannerCalculationRequest>;
  source: PlannerCalculationSource;
}

export interface PlannerCalculationPresentation {
  status: CalculationLifecycleStatus;
  displayIsCurrent: boolean;
  message: string;
  canRetry: boolean;
  retryActionLabel: "Retry plan";
}

export interface UsePlannerCalculationInput {
  active: boolean;
  draftState: PlannerUiState;
  form: CombatSetupFormState;
  context: SimulationContext | null;
  lootSettingsByMonster: LootSettingsByMonsterState;
  onDraftReconciled?(
    state: PlannerUiState,
    adjustments: readonly PlannerProgressAdjustment[]
  ): void;
}

export interface PlannerCalculationController {
  panel: PlannerPanelViewModel | null;
  gearPoolEditor: PlannerGearPoolEditorViewModel | null;
  error: string | null;
  pending: boolean;
  draftDirty: boolean;
  status: CalculationLifecycleStatus;
  presentation: PlannerCalculationPresentation;
  computedMetric: PlannerMetric;
  recompute(): void;
  retry(): void;
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

export function isPlannerSourceCurrent(
  candidate: PlannerCalculationSource | null,
  source: PlannerCalculationSource | null
): boolean {
  return (
    candidate != null &&
    source != null &&
    candidate.form === source.form &&
    candidate.context === source.context &&
    candidate.lootSettingsByMonster === source.lootSettingsByMonster &&
    candidate.plannerState === source.plannerState
  );
}

export function plannerDraftIsDirty(draft: PlannerUiState, computed: PlannerUiState): boolean {
  return JSON.stringify(draft) !== JSON.stringify(computed);
}

export function derivePlannerCalculationPresentation(input: {
  active: boolean;
  source: PlannerCalculationSource | null;
  lastSuccessfulBuild: PlannerCalculationBuild | null;
  failure: PlannerCalculationFailure | null;
  pendingSource: PlannerCalculationSource | null;
  draftDirty: boolean;
}): PlannerCalculationPresentation {
  const pendingIsCurrent = isPlannerSourceCurrent(input.pendingSource, input.source);
  const failureIsCurrent = isPlannerSourceCurrent(input.failure?.source ?? null, input.source);
  const successIsCurrent = isPlannerSourceCurrent(
    input.lastSuccessfulBuild?.source ?? null,
    input.source
  );
  const hasDisplay = input.lastSuccessfulBuild != null;

  if (
    pendingIsCurrent ||
    (input.active && input.source != null && !failureIsCurrent && !successIsCurrent)
  ) {
    return {
      status: "building",
      displayIsCurrent: false,
      message: hasDisplay
        ? "Calculating the current plan. Showing the previous result."
        : "Calculating the plan for current inputs.",
      canRetry: false,
      retryActionLabel: "Retry plan"
    };
  }
  if (failureIsCurrent) {
    return {
      status: "failed",
      displayIsCurrent: false,
      message: hasDisplay
        ? "Planner could not compute the current plan. Showing the previous result."
        : input.failure!.message,
      canRetry: input.active && input.source != null,
      retryActionLabel: "Retry plan"
    };
  }
  if (successIsCurrent && !input.draftDirty) {
    return {
      status: "ready",
      displayIsCurrent: true,
      message: "",
      canRetry: false,
      retryActionLabel: "Retry plan"
    };
  }
  if (hasDisplay) {
    return {
      status: "stale",
      displayIsCurrent: false,
      message: input.draftDirty
        ? "Planner inputs changed. This plan uses the last recomputed inputs."
        : "Inputs changed. This plan does not include the current setup or price context.",
      canRetry: false,
      retryActionLabel: "Retry plan"
    };
  }
  return {
    status: "idle",
    displayIsCurrent: false,
    message: "",
    canRetry: false,
    retryActionLabel: "Retry plan"
  };
}

export function usePlannerCalculation(
  input: UsePlannerCalculationInput,
  options: { startTask?: PlannerTaskStarter } = {}
): PlannerCalculationController {
  const [computedState, setComputedState] = useState(
    () =>
      reconcilePlannerProgressWithLevels(
        normalizePlannerUiState(input.draftState),
        input.form.levels
      ).state
  );
  const [lastSuccessfulBuild, setLastSuccessfulBuild] = useState<PlannerCalculationBuild | null>(
    null
  );
  const [failure, setFailure] = useState<PlannerCalculationFailure | null>(null);
  const [pending, setPending] = useState<PlannerCalculationPending | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const pendingRef = useRef<PlannerCalculationPending | null>(null);
  const startTask = options.startTask ?? startPlannerTask;
  const onDraftReconciled = input.onDraftReconciled;
  const draftReconciliation = useMemo(
    () =>
      reconcilePlannerProgressWithLevels(
        normalizePlannerUiState(input.draftState),
        input.form.levels
      ),
    [input.draftState, input.form.levels]
  );
  const computedStateForLevels = useMemo(
    () => reconcilePlannerProgressWithLevels(computedState, input.form.levels).state,
    [computedState, input.form.levels]
  );
  const draftDirty = useMemo(
    () => plannerDraftIsDirty(draftReconciliation.state, computedStateForLevels),
    [computedStateForLevels, draftReconciliation.state]
  );

  useEffect(() => {
    if (draftReconciliation.adjustments.length === 0) return;
    onDraftReconciled?.(draftReconciliation.state, draftReconciliation.adjustments);
  }, [draftReconciliation, onDraftReconciled]);

  /* eslint-disable react-hooks/set-state-in-effect -- Live-level changes must permanently reconcile the last computed Planner snapshot before a replacement Worker source is created. */
  useEffect(() => {
    if (computedStateForLevels !== computedState) setComputedState(computedStateForLevels);
  }, [computedState, computedStateForLevels]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const source = useMemo<PlannerCalculationSource | null>(
    () =>
      input.context
        ? {
            form: input.form,
            context: input.context,
            lootSettingsByMonster: input.lootSettingsByMonster,
            plannerState: computedStateForLevels
          }
        : null,
    [computedStateForLevels, input.context, input.form, input.lootSettingsByMonster]
  );
  const currentRequestRef = useRef({ active: input.active, source });

  /* eslint-disable react-hooks/set-state-in-effect -- Exact Planner source identity owns obsolete task cancellation and source-scoped failure cleanup before a Worker microtask can settle. */
  useLayoutEffect(() => {
    currentRequestRef.current = { active: input.active, source };
    const current = pendingRef.current;
    if (current && (!input.active || !isPlannerSourceCurrent(current.source, source))) {
      current.task.cancel();
      pendingRef.current = null;
      setPending(null);
    }
    setFailure((currentFailure) =>
      currentFailure && !isPlannerSourceCurrent(currentFailure.source, source)
        ? null
        : currentFailure
    );
  }, [input.active, source]);

  useEffect(() => {
    if (!input.active || !source) return;
    const task = startTask({ kind: "planner", ...source });
    const current = { task, source } satisfies PlannerCalculationPending;
    pendingRef.current = current;
    setPending(current);
    setFailure((currentFailure) =>
      isPlannerSourceCurrent(currentFailure?.source ?? null, source) ? null : currentFailure
    );
    const ownsCurrentSlot = () => {
      const currentRequest = currentRequestRef.current;
      return (
        pendingRef.current?.task === task &&
        currentRequest.active &&
        isPlannerSourceCurrent(source, currentRequest.source)
      );
    };
    void task.promise
      .then((panel) => {
        if (!ownsCurrentSlot()) return;
        setLastSuccessfulBuild({ panel, source });
        setFailure((currentFailure) =>
          isPlannerSourceCurrent(currentFailure?.source ?? null, source) ? null : currentFailure
        );
      })
      .catch((error: unknown) => {
        if (error instanceof CalculationTaskCancelledError) return;
        if (!ownsCurrentSlot()) return;
        setFailure({
          source,
          message: "Planner could not compute the current plan. Your inputs are unchanged."
        });
      })
      .finally(() => {
        if (!ownsCurrentSlot()) return;
        pendingRef.current = null;
        setPending(null);
      });
    return () => {
      if (pendingRef.current?.task !== task) return;
      task.cancel();
      pendingRef.current = null;
      setPending(null);
    };
  }, [input.active, retryVersion, source, startTask]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const presentation = useMemo(
    () =>
      derivePlannerCalculationPresentation({
        active: input.active,
        source,
        lastSuccessfulBuild,
        failure,
        pendingSource: pending?.source ?? null,
        draftDirty
      }),
    [draftDirty, failure, input.active, lastSuccessfulBuild, pending?.source, source]
  );
  const panel = lastSuccessfulBuild?.panel ?? null;
  const error = presentation.status === "failed" ? presentation.message : null;
  const gearPoolEditor = useMemo(
    () =>
      input.context
        ? createPlannerGearPoolEditorViewModel(input.form, input.context, input.draftState)
        : null,
    [input.context, input.draftState, input.form]
  );
  const recompute = useCallback(() => {
    if (draftReconciliation.adjustments.length > 0) {
      onDraftReconciled?.(draftReconciliation.state, draftReconciliation.adjustments);
    }
    setComputedState(draftReconciliation.state);
    if (!draftDirty && presentation.status === "failed") {
      setRetryVersion((current) => current + 1);
    }
  }, [draftDirty, draftReconciliation, onDraftReconciled, presentation.status]);
  const retry = useCallback(() => {
    if (!presentation.canRetry) return;
    if (draftReconciliation.adjustments.length > 0) {
      onDraftReconciled?.(draftReconciliation.state, draftReconciliation.adjustments);
    }
    setComputedState(draftReconciliation.state);
    setRetryVersion((current) => current + 1);
  }, [draftReconciliation, onDraftReconciled, presentation.canRetry]);

  return {
    panel,
    gearPoolEditor,
    error,
    pending: presentation.status === "building",
    draftDirty,
    status: presentation.status,
    presentation,
    computedMetric:
      lastSuccessfulBuild?.source.plannerState.metric ?? computedStateForLevels.metric,
    recompute,
    retry
  };
}

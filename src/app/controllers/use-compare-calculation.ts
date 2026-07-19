import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { SimulationContext } from "@/domain/shared";
import {
  CalculationTaskCancelledError,
  startCalculationTask,
  type RunningCalculationTask
} from "../calculation-worker-client";
import type { DenseCompareCalculationRequest } from "../calculation-task";
import type { DenseCompareUiState } from "../state/dense-compare";
import type { LootPrefsState } from "../state/loot-prefs";
import type { LootSettingsByMonsterState } from "../state/loot-settings";
import type {
  CannonByMonsterState,
  CombatSetupFormState,
  CustomSetupsByMonsterState
} from "../state/ui-state";
import {
  createDenseCompareScaleModel,
  presentDenseCompareRows,
  type DenseCompareRowViewModel,
  type DenseCompareScaleViewModel
} from "../view-models/compare";
import type { CalculationLifecycleStatus } from "./calculation-lifecycle";

const EMPTY_DENSE_COMPARE_ROWS: DenseCompareRowViewModel[] = [];

export interface DenseCompareCalculationSource {
  form: CombatSetupFormState;
  context: SimulationContext;
  cannonByMonster: CannonByMonsterState;
  lootPrefsByMonster: LootPrefsState;
  customSetupsByMonster: CustomSetupsByMonsterState;
  lootSettingsByMonster: LootSettingsByMonsterState;
}

export interface DenseCompareCalculationBuild {
  rows: DenseCompareRowViewModel[];
  source: DenseCompareCalculationSource;
}

export interface DenseCompareCalculationFailure {
  source: DenseCompareCalculationSource;
  message: "Comparison could not be calculated. Your inputs are unchanged.";
}

interface DenseCompareCalculationPending {
  task: RunningCalculationTask<DenseCompareCalculationRequest>;
  source: DenseCompareCalculationSource;
}

export interface DenseComparePresentation {
  status: CalculationLifecycleStatus;
  displayIsCurrent: boolean;
  message: string;
  statusLabel: "Not calculated" | "Updating" | "Current" | "Previous result" | "Calculation failed";
  summary:
    | "no calculated rows"
    | "calculating current inputs"
    | "current loadout"
    | "previous inputs"
    | "calculation failed";
  aria: string;
  canRetry: boolean;
  retryActionLabel: "Retry comparison";
}

export interface UseCompareCalculationInput {
  active: boolean;
  form: CombatSetupFormState;
  context: SimulationContext | null;
  cannonByMonster: CannonByMonsterState;
  lootPrefsByMonster: LootPrefsState;
  customSetupsByMonster: CustomSetupsByMonsterState;
  lootSettingsByMonster: LootSettingsByMonsterState;
  denseCompare: DenseCompareUiState;
}

export interface CompareCalculationController {
  rows: DenseCompareRowViewModel[];
  scale: DenseCompareScaleViewModel;
  totalRows: number;
  presentation: DenseComparePresentation;
  pending: boolean;
  failed: boolean;
  retry(): void;
}

type DenseCompareTaskStarter = (
  request: DenseCompareCalculationRequest
) => RunningCalculationTask<DenseCompareCalculationRequest>;

const startDenseCompareTask: DenseCompareTaskStarter = (request) => startCalculationTask(request);

export function isDenseCompareBuildFresh(
  build: DenseCompareCalculationBuild | null,
  source: DenseCompareCalculationSource | null
): boolean {
  return (
    build != null &&
    source != null &&
    build.source.form === source.form &&
    build.source.context === source.context &&
    build.source.cannonByMonster === source.cannonByMonster &&
    build.source.lootPrefsByMonster === source.lootPrefsByMonster &&
    build.source.customSetupsByMonster === source.customSetupsByMonster &&
    build.source.lootSettingsByMonster === source.lootSettingsByMonster
  );
}

export function isDenseCompareSourceCurrent(
  candidate: DenseCompareCalculationSource | null,
  source: DenseCompareCalculationSource | null
): boolean {
  return (
    candidate != null &&
    source != null &&
    candidate.form === source.form &&
    candidate.context === source.context &&
    candidate.cannonByMonster === source.cannonByMonster &&
    candidate.lootPrefsByMonster === source.lootPrefsByMonster &&
    candidate.customSetupsByMonster === source.customSetupsByMonster &&
    candidate.lootSettingsByMonster === source.lootSettingsByMonster
  );
}

export function deriveDenseComparePresentation(input: {
  active: boolean;
  source: DenseCompareCalculationSource | null;
  taskSource: DenseCompareCalculationSource | null;
  lastSuccessfulBuild: DenseCompareCalculationBuild | null;
  failure: DenseCompareCalculationFailure | null;
  pendingSource: DenseCompareCalculationSource | null;
}): DenseComparePresentation {
  const pendingIsCurrent = isDenseCompareSourceCurrent(input.pendingSource, input.source);
  const failureIsCurrent = isDenseCompareSourceCurrent(input.failure?.source ?? null, input.source);
  const successIsCurrent = isDenseCompareSourceCurrent(
    input.lastSuccessfulBuild?.source ?? null,
    input.source
  );
  const taskSourceIsCurrent = isDenseCompareSourceCurrent(input.taskSource, input.source);
  const hasDisplay = input.lastSuccessfulBuild != null;

  if (
    pendingIsCurrent ||
    (input.active && taskSourceIsCurrent && !failureIsCurrent && !successIsCurrent)
  ) {
    return {
      status: "building",
      displayIsCurrent: false,
      message: hasDisplay
        ? "Calculating current comparison. Showing the previous result."
        : "Calculating comparison for current inputs.",
      statusLabel: "Updating",
      summary: "calculating current inputs",
      aria: hasDisplay
        ? "Compare calculation status: Updating. Showing the previous result."
        : "Compare calculation status: Updating. Calculating current inputs.",
      canRetry: false,
      retryActionLabel: "Retry comparison"
    };
  }
  if (failureIsCurrent) {
    return {
      status: "failed",
      displayIsCurrent: false,
      message: hasDisplay
        ? "Comparison could not be calculated. Showing the previous result."
        : input.failure!.message,
      statusLabel: "Calculation failed",
      summary: "calculation failed",
      aria: hasDisplay
        ? "Compare calculation status: Failed. Showing the previous result."
        : "Compare calculation status: Failed. No result is available.",
      canRetry: input.active && input.source != null,
      retryActionLabel: "Retry comparison"
    };
  }
  if (successIsCurrent) {
    return {
      status: "ready",
      displayIsCurrent: true,
      message: "",
      statusLabel: "Current",
      summary: "current loadout",
      aria: "Compare calculation status: Current. Rows match the live setup.",
      canRetry: false,
      retryActionLabel: "Retry comparison"
    };
  }
  if (hasDisplay) {
    return {
      status: "stale",
      displayIsCurrent: false,
      message: "Inputs changed. These rows do not include the current inputs.",
      statusLabel: "Previous result",
      summary: "previous inputs",
      aria: "Compare calculation status: Previous result. Rows do not match the live setup.",
      canRetry: false,
      retryActionLabel: "Retry comparison"
    };
  }
  return {
    status: "idle",
    displayIsCurrent: false,
    message: "Comparison has not been calculated for the current inputs.",
    statusLabel: "Not calculated",
    summary: "no calculated rows",
    aria: "Compare calculation status: Not calculated. No result is available.",
    canRetry: false,
    retryActionLabel: "Retry comparison"
  };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timerId = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timerId);
  }, [delayMs, value]);
  return debounced;
}

export function useCompareCalculation(
  input: UseCompareCalculationInput,
  options: { startTask?: DenseCompareTaskStarter } = {}
): CompareCalculationController {
  const heavyForm = useDebouncedValue(input.form, 250);
  const [lastSuccessfulBuild, setLastSuccessfulBuild] =
    useState<DenseCompareCalculationBuild | null>(null);
  const [failure, setFailure] = useState<DenseCompareCalculationFailure | null>(null);
  const [pending, setPending] = useState<DenseCompareCalculationPending | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const pendingRef = useRef<DenseCompareCalculationPending | null>(null);
  const startTask = options.startTask ?? startDenseCompareTask;
  const source = useMemo<DenseCompareCalculationSource | null>(
    () =>
      input.context
        ? {
            form: input.form,
            context: input.context,
            cannonByMonster: input.cannonByMonster,
            lootPrefsByMonster: input.lootPrefsByMonster,
            customSetupsByMonster: input.customSetupsByMonster,
            lootSettingsByMonster: input.lootSettingsByMonster
          }
        : null,
    [
      input.cannonByMonster,
      input.context,
      input.customSetupsByMonster,
      input.form,
      input.lootPrefsByMonster,
      input.lootSettingsByMonster
    ]
  );
  const taskSource = useMemo<DenseCompareCalculationSource | null>(
    () =>
      input.context
        ? {
            form: heavyForm,
            context: input.context,
            cannonByMonster: input.cannonByMonster,
            lootPrefsByMonster: input.lootPrefsByMonster,
            customSetupsByMonster: input.customSetupsByMonster,
            lootSettingsByMonster: input.lootSettingsByMonster
          }
        : null,
    [
      heavyForm,
      input.cannonByMonster,
      input.context,
      input.customSetupsByMonster,
      input.lootPrefsByMonster,
      input.lootSettingsByMonster
    ]
  );
  const currentRequestRef = useRef({ active: input.active, source });

  /* eslint-disable react-hooks/set-state-in-effect -- Exact live-source identity owns obsolete task cancellation and source-scoped failure cleanup before a Worker microtask can settle. */
  useLayoutEffect(() => {
    currentRequestRef.current = { active: input.active, source };
    const current = pendingRef.current;
    if (current && (!input.active || !isDenseCompareSourceCurrent(current.source, source))) {
      current.task.cancel();
      pendingRef.current = null;
      setPending(null);
    }
    setFailure((currentFailure) =>
      currentFailure && !isDenseCompareSourceCurrent(currentFailure.source, source)
        ? null
        : currentFailure
    );
  }, [input.active, source]);

  useEffect(() => {
    if (!input.active || !taskSource) return;
    const task = startTask({ kind: "dense-compare", ...taskSource });
    const current = { task, source: taskSource } satisfies DenseCompareCalculationPending;
    pendingRef.current = current;
    setPending(current);
    setFailure((currentFailure) =>
      isDenseCompareSourceCurrent(currentFailure?.source ?? null, taskSource)
        ? null
        : currentFailure
    );
    const ownsCurrentSlot = () => {
      const currentRequest = currentRequestRef.current;
      return (
        pendingRef.current?.task === task &&
        currentRequest.active &&
        isDenseCompareSourceCurrent(taskSource, currentRequest.source)
      );
    };
    void task.promise
      .then((rows) => {
        if (!ownsCurrentSlot()) return;
        setLastSuccessfulBuild({ rows, source: taskSource });
        setFailure((currentFailure) =>
          isDenseCompareSourceCurrent(currentFailure?.source ?? null, taskSource)
            ? null
            : currentFailure
        );
      })
      .catch((error: unknown) => {
        if (error instanceof CalculationTaskCancelledError) return;
        if (!ownsCurrentSlot()) return;
        setFailure({
          source: taskSource,
          message: "Comparison could not be calculated. Your inputs are unchanged."
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
  }, [input.active, retryVersion, startTask, taskSource]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const presentation = useMemo(
    () =>
      deriveDenseComparePresentation({
        active: input.active,
        source,
        taskSource,
        lastSuccessfulBuild,
        failure,
        pendingSource: pending?.source ?? null
      }),
    [failure, input.active, lastSuccessfulBuild, pending?.source, source, taskSource]
  );
  const rows = useMemo(
    () =>
      input.context
        ? presentDenseCompareRows(
            lastSuccessfulBuild?.rows ?? EMPTY_DENSE_COMPARE_ROWS,
            input.context.gameData,
            input.denseCompare
          )
        : EMPTY_DENSE_COMPARE_ROWS,
    [input.context, input.denseCompare, lastSuccessfulBuild?.rows]
  );
  const retry = useCallback(() => {
    if (!presentation.canRetry) return;
    setRetryVersion((current) => current + 1);
  }, [presentation.canRetry]);

  return {
    rows,
    scale: createDenseCompareScaleModel(rows),
    totalRows: input.context ? Object.keys(input.context.gameData.monsters).length : 0,
    presentation,
    pending: presentation.status === "building",
    failed: presentation.status === "failed",
    retry
  };
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RiskAnalysisResult } from "@/domain/risk";
import type { SimulationContext } from "@/domain/shared";
import {
  CalculationTaskCancelledError,
  startCalculationTask,
  type RunningCalculationTask
} from "../calculation-worker-client";
import type { RiskAnalysisCalculationRequest } from "../calculation-task";
import type { LootSettingsByMonsterState } from "../state/loot-settings";
import type { CannonByMonsterState, CombatSetupFormState } from "../state/ui-state";
import { formatNumber } from "../view-models/formatting";
import {
  DEFAULT_RISK_CONTROLS,
  createRiskTargetDropOptions,
  type RiskControls,
  type RiskTargetDropCandidate,
  type RiskTargetDropOption
} from "../view-models/risk";
import type { CalculationLifecycleStatus } from "./calculation-lifecycle";

export interface RiskAnalysisSource {
  form: CombatSetupFormState;
  context: SimulationContext;
  cannonByMonster: CannonByMonsterState;
  lootPrefs: Record<string, string | undefined>;
  lootSettingsByMonster: LootSettingsByMonsterState;
  analysis: RiskControls;
}

export interface RiskAnalysisBuild {
  result: RiskAnalysisResult;
  source: RiskAnalysisSource;
}

export interface RiskAnalysisFailure {
  source: RiskAnalysisSource;
  message: "Risk analysis could not be completed. Your inputs are unchanged.";
}

interface RiskAnalysisPending {
  task: RunningCalculationTask<RiskAnalysisCalculationRequest>;
  source: RiskAnalysisSource;
}

export interface RiskAnalysisPresentation {
  status: CalculationLifecycleStatus;
  displayIsCurrent: boolean;
  message: string;
  canRun: boolean;
  runActionLabel: "Run analysis" | "Running…" | "Retry analysis";
}

export interface UseRiskAnalysisInput {
  form: CombatSetupFormState;
  context: SimulationContext | null;
  cannonByMonster: CannonByMonsterState;
  lootPrefs: Record<string, string | undefined>;
  lootSettingsByMonster: LootSettingsByMonsterState;
  targetDropCandidates: readonly RiskTargetDropCandidate[];
  onStatus(message: string): void;
}

export interface RiskResultSnapshot {
  result: RiskAnalysisResult;
  controls: RiskControls;
}

export interface RiskDisplaySnapshot extends RiskResultSnapshot {
  fresh: boolean;
}

export interface RiskAnalysisController {
  controls: RiskControls;
  presentation: RiskAnalysisPresentation;
  targetDropOptions: RiskTargetDropOption[];
  display: RiskDisplaySnapshot | null;
  fresh: RiskResultSnapshot | null;
  setTargetKills(value: number): void;
  setHorizonMinutes(value: number): void;
  setGpTarget(value: number): void;
  setTargetDropRowId(value: string | null): void;
  run(): void;
  cancel(): void;
}

type RiskTaskStarter = (
  request: RiskAnalysisCalculationRequest
) => RunningCalculationTask<RiskAnalysisCalculationRequest>;

const startRiskTask: RiskTaskStarter = (request) => startCalculationTask(request);

export function isRiskBuildFresh(
  build: RiskAnalysisBuild | null,
  source: RiskAnalysisSource | null
): boolean {
  return (
    build != null &&
    source != null &&
    build.source.form === source.form &&
    build.source.context === source.context &&
    build.source.cannonByMonster === source.cannonByMonster &&
    build.source.lootPrefs === source.lootPrefs &&
    build.source.lootSettingsByMonster === source.lootSettingsByMonster &&
    build.source.analysis === source.analysis
  );
}

export function isRiskSourceCurrent(
  candidate: RiskAnalysisSource | null,
  source: RiskAnalysisSource | null
): boolean {
  return (
    candidate != null &&
    source != null &&
    candidate.form === source.form &&
    candidate.context === source.context &&
    candidate.cannonByMonster === source.cannonByMonster &&
    candidate.lootPrefs === source.lootPrefs &&
    candidate.lootSettingsByMonster === source.lootSettingsByMonster &&
    candidate.analysis === source.analysis
  );
}

export function deriveRiskAnalysisPresentation(input: {
  source: RiskAnalysisSource | null;
  lastSuccessfulBuild: RiskAnalysisBuild | null;
  failure: RiskAnalysisFailure | null;
  pendingSource: RiskAnalysisSource | null;
}): RiskAnalysisPresentation {
  const pendingIsCurrent = isRiskSourceCurrent(input.pendingSource, input.source);
  const failureIsCurrent = isRiskSourceCurrent(input.failure?.source ?? null, input.source);
  const successIsCurrent = isRiskSourceCurrent(
    input.lastSuccessfulBuild?.source ?? null,
    input.source
  );
  const hasDisplay = input.lastSuccessfulBuild != null;
  const canRun = input.source != null;

  if (pendingIsCurrent) {
    return {
      status: "building",
      displayIsCurrent: false,
      message: hasDisplay
        ? "Running the current analysis. Showing the previous result."
        : "Running the analysis for current inputs.",
      canRun: false,
      runActionLabel: "Running…"
    };
  }
  if (failureIsCurrent) {
    return {
      status: "failed",
      displayIsCurrent: false,
      message: hasDisplay
        ? "Risk analysis could not be completed. Showing the previous result."
        : input.failure!.message,
      canRun,
      runActionLabel: "Retry analysis"
    };
  }
  if (successIsCurrent) {
    return {
      status: "ready",
      displayIsCurrent: true,
      message: "",
      canRun,
      runActionLabel: "Run analysis"
    };
  }
  if (hasDisplay) {
    return {
      status: "stale",
      displayIsCurrent: false,
      message:
        "Inputs changed. These results do not include the current setup, prices, loot policy or analysis controls.",
      canRun,
      runActionLabel: "Run analysis"
    };
  }
  return {
    status: "idle",
    displayIsCurrent: false,
    message: "",
    canRun,
    runActionLabel: "Run analysis"
  };
}

export function useRiskAnalysis(
  input: UseRiskAnalysisInput,
  options: { startTask?: RiskTaskStarter } = {}
): RiskAnalysisController {
  const [controls, setControls] = useState<RiskControls>(DEFAULT_RISK_CONTROLS);
  const [lastSuccessfulBuild, setLastSuccessfulBuild] = useState<RiskAnalysisBuild | null>(null);
  const [failure, setFailure] = useState<RiskAnalysisFailure | null>(null);
  const [pending, setPending] = useState<RiskAnalysisPending | null>(null);
  const pendingRef = useRef<RiskAnalysisPending | null>(null);
  const startTask = options.startTask ?? startRiskTask;
  const source = useMemo<RiskAnalysisSource | null>(
    () =>
      input.context
        ? {
            form: input.form,
            context: input.context,
            cannonByMonster: input.cannonByMonster,
            lootPrefs: input.lootPrefs,
            lootSettingsByMonster: input.lootSettingsByMonster,
            analysis: controls
          }
        : null,
    [
      controls,
      input.cannonByMonster,
      input.context,
      input.form,
      input.lootPrefs,
      input.lootSettingsByMonster
    ]
  );
  const currentSourceRef = useRef(source);
  const targetDropOptions = useMemo(
    () => createRiskTargetDropOptions(input.targetDropCandidates),
    [input.targetDropCandidates]
  );
  const presentation = useMemo(
    () =>
      deriveRiskAnalysisPresentation({
        source,
        lastSuccessfulBuild,
        failure,
        pendingSource: pending?.source ?? null
      }),
    [failure, lastSuccessfulBuild, pending?.source, source]
  );
  const display = lastSuccessfulBuild
    ? {
        result: lastSuccessfulBuild.result,
        controls: lastSuccessfulBuild.source.analysis,
        fresh: presentation.displayIsCurrent
      }
    : null;
  const fresh =
    presentation.displayIsCurrent && lastSuccessfulBuild
      ? {
          result: lastSuccessfulBuild.result,
          controls: lastSuccessfulBuild.source.analysis
        }
      : null;

  /* eslint-disable react-hooks/set-state-in-effect -- Exact Risk source identity owns obsolete task cancellation and source-scoped failure cleanup before a Worker microtask can settle. */
  useLayoutEffect(() => {
    currentSourceRef.current = source;
    const current = pendingRef.current;
    if (current && !isRiskSourceCurrent(current.source, source)) {
      current.task.cancel();
      pendingRef.current = null;
      setPending(null);
    }
    setFailure((currentFailure) =>
      currentFailure && !isRiskSourceCurrent(currentFailure.source, source) ? null : currentFailure
    );
  }, [source]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(
    () => () => {
      pendingRef.current?.task.cancel();
      pendingRef.current = null;
    },
    []
  );

  const run = useCallback(() => {
    if (!source) return;
    pendingRef.current?.task.cancel();
    const task = startTask({ kind: "risk-analysis", ...source });
    const current = { task, source } satisfies RiskAnalysisPending;
    pendingRef.current = current;
    setPending(current);
    setFailure((currentFailure) =>
      isRiskSourceCurrent(currentFailure?.source ?? null, source) ? null : currentFailure
    );
    const ownsCurrentSlot = () =>
      pendingRef.current?.task === task && isRiskSourceCurrent(source, currentSourceRef.current);
    input.onStatus("Running modeled risk analysis");
    void task.promise
      .then((result) => {
        if (!ownsCurrentSlot()) return;
        setLastSuccessfulBuild({ result, source });
        setFailure((currentFailure) =>
          isRiskSourceCurrent(currentFailure?.source ?? null, source) ? null : currentFailure
        );
        input.onStatus(`Risk analysis ready: ${formatNumber(result.sampleCount)} trials`);
      })
      .catch((error: unknown) => {
        if (!ownsCurrentSlot()) return;
        if (error instanceof CalculationTaskCancelledError) {
          return;
        }
        setFailure({
          source,
          message: "Risk analysis could not be completed. Your inputs are unchanged."
        });
        input.onStatus("Risk analysis could not be completed");
      })
      .finally(() => {
        if (!ownsCurrentSlot()) return;
        pendingRef.current = null;
        setPending(null);
      });
  }, [input, source, startTask]);

  const cancel = useCallback(() => {
    const current = pendingRef.current;
    if (!current) return;
    current.task.cancel();
    pendingRef.current = null;
    setPending(null);
    input.onStatus("Risk analysis cancelled");
  }, [input]);

  return {
    controls,
    presentation,
    targetDropOptions,
    display,
    fresh,
    setTargetKills: (targetKills) => setControls((current) => ({ ...current, targetKills })),
    setHorizonMinutes: (horizonMinutes) =>
      setControls((current) => ({ ...current, horizonMinutes })),
    setGpTarget: (gpTarget) => setControls((current) => ({ ...current, gpTarget })),
    setTargetDropRowId: (targetDropRowId) =>
      setControls((current) => ({ ...current, targetDropRowId })),
    run,
    cancel
  };
}

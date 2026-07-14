import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  riskStatusLabelFor,
  type RiskControls,
  type RiskRunStatus,
  type RiskStatusLabel,
  type RiskTargetDropCandidate,
  type RiskTargetDropOption
} from "../view-models/risk";

export interface RiskAnalysisSource {
  form: CombatSetupFormState;
  context: SimulationContext;
  cannonByMonster: CannonByMonsterState;
  lootPrefs: Record<string, string | undefined>;
  lootSettingsByMonster: LootSettingsByMonsterState;
  analysis: RiskControls;
}

interface RiskAnalysisBuild {
  result: RiskAnalysisResult;
  source: RiskAnalysisSource;
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
  runStatus: RiskRunStatus;
  statusLabel: RiskStatusLabel;
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

export function useRiskAnalysis(
  input: UseRiskAnalysisInput,
  options: { startTask?: RiskTaskStarter } = {}
): RiskAnalysisController {
  const [controls, setControls] = useState<RiskControls>(DEFAULT_RISK_CONTROLS);
  const [build, setBuild] = useState<RiskAnalysisBuild | null>(null);
  const [runStatus, setRunStatus] = useState<RiskRunStatus>("idle");
  const taskRef = useRef<RunningCalculationTask<RiskAnalysisCalculationRequest> | null>(null);
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
  const targetDropOptions = useMemo(
    () => createRiskTargetDropOptions(input.targetDropCandidates),
    [input.targetDropCandidates]
  );
  const buildFresh = isRiskBuildFresh(build, source);
  const display = build
    ? { result: build.result, controls: build.source.analysis, fresh: buildFresh }
    : null;
  const fresh =
    buildFresh && build ? { result: build.result, controls: build.source.analysis } : null;

  useEffect(() => {
    if (!taskRef.current) return;
    taskRef.current.cancel();
    taskRef.current = null;
    setRunStatus("cancelled");
  }, [source]);

  useEffect(
    () => () => {
      taskRef.current?.cancel();
      taskRef.current = null;
    },
    []
  );

  const run = useCallback(() => {
    if (!source) return;
    taskRef.current?.cancel();
    const task = startTask({ kind: "risk-analysis", ...source });
    taskRef.current = task;
    setRunStatus("running");
    input.onStatus("Running modeled risk analysis");
    void task.promise
      .then((result) => {
        if (taskRef.current !== task) return;
        setBuild({ result, source });
        setRunStatus("ready");
        input.onStatus(`Risk analysis ready: ${formatNumber(result.sampleCount)} trials`);
      })
      .catch((error: unknown) => {
        if (taskRef.current !== task) return;
        if (error instanceof CalculationTaskCancelledError) {
          setRunStatus("cancelled");
          input.onStatus("Risk analysis cancelled");
          return;
        }
        setRunStatus("unavailable");
        input.onStatus("Risk analysis unavailable");
      })
      .finally(() => {
        if (taskRef.current === task) taskRef.current = null;
      });
  }, [input, source, startTask]);

  const cancel = useCallback(() => {
    if (!taskRef.current) return;
    taskRef.current.cancel();
    taskRef.current = null;
    setRunStatus("cancelled");
    input.onStatus("Risk analysis cancelled");
  }, [input]);

  return {
    controls,
    runStatus,
    statusLabel: riskStatusLabelFor({ runStatus, hasBuild: build != null, fresh: buildFresh }),
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

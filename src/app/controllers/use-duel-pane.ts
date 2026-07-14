import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationContext } from "@/domain/shared";
import {
  CalculationTaskCancelledError,
  startCalculationTask,
  type RunningCalculationTask
} from "../calculation-worker-client";
import type { DuelMatrixCalculationRequest } from "../calculation-task";
import type { DuelSnapshotsState } from "../state/duel-snapshots";
import type { LootPrefsState } from "../state/loot-prefs";
import type { LootSettingsByMonsterState } from "../state/loot-settings";
import type { CannonByMonsterState, CombatSetupFormState } from "../state/ui-state";
import {
  createDuelComparisonViewModel,
  type DuelComparisonViewModel,
  type DuelMatrixMetricId,
  type DuelMatrixRowViewModel,
  type DuelMatrixViewModel,
  type DuelViewMode
} from "../view-models/duel";

export interface DuelMatrixSource {
  form: CombatSetupFormState;
  snapshots: DuelSnapshotsState;
  context: SimulationContext;
  cannonByMonster: CannonByMonsterState;
  lootPrefsByMonster: LootPrefsState;
  lootSettingsByMonster: LootSettingsByMonsterState;
}

interface DuelMatrixBuild {
  model: DuelMatrixViewModel;
  source: DuelMatrixSource;
}

export interface UseDuelPaneInput {
  active: boolean;
  form: CombatSetupFormState;
  snapshots: DuelSnapshotsState;
  context: SimulationContext | null;
  cannonByMonster: CannonByMonsterState;
  lootPrefsByMonster: LootPrefsState;
  lootSettingsByMonster: LootSettingsByMonsterState;
  onStatus(message: string): void;
}

export interface DuelPaneController {
  comparison: DuelComparisonViewModel | null;
  viewMode: DuelViewMode;
  expandedDiffId: string | null;
  matrixMetric: DuelMatrixMetricId;
  matrixFilter: string;
  matrix: DuelMatrixViewModel | null;
  filteredMatrixRows: DuelMatrixRowViewModel[];
  matrixBusy: boolean;
  showCurrentTarget(): void;
  showMonsterMatrix(): void;
  toggleDiff(snapshotId: string): void;
  setMatrixMetric(metric: DuelMatrixMetricId): void;
  setMatrixFilter(value: string): void;
  buildMatrix(): void;
}

type DuelMatrixTaskStarter = (
  request: DuelMatrixCalculationRequest
) => RunningCalculationTask<DuelMatrixCalculationRequest>;

const startDuelMatrixTask: DuelMatrixTaskStarter = (request) => startCalculationTask(request);

export function isDuelMatrixBuildFresh(
  build: DuelMatrixBuild | null,
  source: DuelMatrixSource | null
): boolean {
  return (
    build != null &&
    source != null &&
    build.source.form === source.form &&
    build.source.snapshots === source.snapshots &&
    build.source.context === source.context &&
    build.source.cannonByMonster === source.cannonByMonster &&
    build.source.lootPrefsByMonster === source.lootPrefsByMonster &&
    build.source.lootSettingsByMonster === source.lootSettingsByMonster
  );
}

export function filterDuelMatrixRows(
  matrix: DuelMatrixViewModel | null,
  filter: string
): DuelMatrixRowViewModel[] {
  if (!matrix) return [];
  const query = filter.trim().toLocaleLowerCase();
  if (!query) return matrix.rows;
  return matrix.rows.filter(
    (row) =>
      row.monsterName.toLocaleLowerCase().includes(query) ||
      row.monsterId.toLocaleLowerCase().includes(query)
  );
}

export function useDuelPane(
  input: UseDuelPaneInput,
  options: { startTask?: DuelMatrixTaskStarter } = {}
): DuelPaneController {
  const {
    active,
    form,
    snapshots,
    context,
    cannonByMonster,
    lootPrefsByMonster,
    lootSettingsByMonster,
    onStatus
  } = input;
  const [viewMode, setViewMode] = useState<DuelViewMode>("current-target");
  const [expandedDiffId, setExpandedDiffId] = useState<string | null>(null);
  const [matrixMetric, setMatrixMetric] = useState<DuelMatrixMetricId>("effectiveXpPerHour");
  const [matrixFilter, setMatrixFilter] = useState("");
  const [matrixBuild, setMatrixBuild] = useState<DuelMatrixBuild | null>(null);
  const [matrixBusy, setMatrixBusy] = useState(false);
  const taskRef = useRef<RunningCalculationTask<DuelMatrixCalculationRequest> | null>(null);
  const startTask = options.startTask ?? startDuelMatrixTask;

  useEffect(
    () => () => {
      taskRef.current?.cancel();
      taskRef.current = null;
    },
    []
  );

  const comparison = useMemo(
    () =>
      active && context
        ? createDuelComparisonViewModel(
            form,
            snapshots,
            context,
            cannonByMonster,
            lootPrefsByMonster,
            lootSettingsByMonster
          )
        : null,
    [active, cannonByMonster, context, form, lootPrefsByMonster, lootSettingsByMonster, snapshots]
  );
  const source = useMemo<DuelMatrixSource | null>(
    () =>
      context
        ? {
            form,
            snapshots,
            context,
            cannonByMonster,
            lootPrefsByMonster,
            lootSettingsByMonster
          }
        : null,
    [cannonByMonster, context, form, lootPrefsByMonster, lootSettingsByMonster, snapshots]
  );
  const matrix = isDuelMatrixBuildFresh(matrixBuild, source) ? matrixBuild!.model : null;
  const filteredMatrixRows = useMemo(
    () => filterDuelMatrixRows(matrix, matrixFilter),
    [matrix, matrixFilter]
  );

  const buildMatrix = useCallback(() => {
    if (matrixBusy || snapshots.snapshots.length === 0 || !source) return;
    taskRef.current?.cancel();
    const task = startTask({ kind: "duel-matrix", ...source });
    taskRef.current = task;
    setViewMode("monster-matrix");
    setMatrixBusy(true);
    onStatus("Building setup comparison across monsters");
    void task.promise
      .then((model) => {
        if (taskRef.current !== task) return;
        setMatrixBuild({ model, source });
        onStatus(
          `Setup comparison ready: ${model.monsterCount} monsters, ${model.setupCount} setups`
        );
      })
      .catch((error: unknown) => {
        if (error instanceof CalculationTaskCancelledError) return;
        if (taskRef.current !== task) return;
        setMatrixBuild(null);
        onStatus("Setup comparison across monsters could not be built");
      })
      .finally(() => {
        if (taskRef.current !== task) return;
        taskRef.current = null;
        setMatrixBusy(false);
      });
  }, [matrixBusy, onStatus, snapshots.snapshots.length, source, startTask]);

  const showMonsterMatrix = useCallback(() => {
    if (matrix) setViewMode("monster-matrix");
    else buildMatrix();
  }, [buildMatrix, matrix]);

  return {
    comparison,
    viewMode,
    expandedDiffId,
    matrixMetric,
    matrixFilter,
    matrix,
    filteredMatrixRows,
    matrixBusy,
    showCurrentTarget: () => setViewMode("current-target"),
    showMonsterMatrix,
    toggleDiff: (snapshotId) =>
      setExpandedDiffId((current) => (current === snapshotId ? null : snapshotId)),
    setMatrixMetric,
    setMatrixFilter,
    buildMatrix
  };
}

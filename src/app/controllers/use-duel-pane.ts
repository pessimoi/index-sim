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
  DEFAULT_DUEL_COMPARISON_SORT_STATE,
  DEFAULT_DUEL_MATRIX_SORT_STATE,
  createDuelComparisonViewModel,
  nextDuelComparisonSortState,
  nextDuelMatrixSortState,
  sortDuelComparisonRows,
  sortDuelMatrixRows,
  type DuelComparisonRowViewModel,
  type DuelComparisonSortKey,
  type DuelComparisonSortState,
  type DuelComparisonViewModel,
  type DuelMatrixMetricId,
  type DuelMatrixRowViewModel,
  type DuelMatrixSortState,
  type DuelMatrixSortTarget,
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

export interface DuelMatrixBuild {
  model: DuelMatrixViewModel;
  source: DuelMatrixSource;
}

export interface DuelMatrixFailure {
  source: DuelMatrixSource;
  message: "Comparison could not be built. Your inputs are unchanged.";
}

interface DuelMatrixPending {
  task: RunningCalculationTask<DuelMatrixCalculationRequest>;
  source: DuelMatrixSource;
}

export type DuelMatrixStatus = "idle" | "building" | "ready" | "stale" | "failed";

export interface DuelMatrixPresentation {
  status: DuelMatrixStatus;
  displayModel: DuelMatrixViewModel | null;
  displayIsCurrent: boolean;
  message: string;
  canBuild: boolean;
  buildActionLabel: "Build comparison" | "Refresh comparison" | "Retry comparison" | "Building…";
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
  comparisonRows: DuelComparisonRowViewModel[];
  comparisonSort: DuelComparisonSortState;
  viewMode: DuelViewMode;
  expandedDiffId: string | null;
  matrixMetric: DuelMatrixMetricId;
  matrixFilter: string;
  matrixPresentation: DuelMatrixPresentation;
  filteredMatrixRows: DuelMatrixRowViewModel[];
  matrixSort: DuelMatrixSortState;
  showCurrentTarget(): void;
  showMonsterMatrix(): void;
  toggleDiff(snapshotId: string): void;
  setMatrixMetric(metric: DuelMatrixMetricId): void;
  setMatrixFilter(value: string): void;
  sortComparisonBy(key: DuelComparisonSortKey): void;
  sortMatrixBy(target: DuelMatrixSortTarget): void;
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

export function isDuelMatrixSourceCurrent(
  candidate: DuelMatrixSource | null,
  source: DuelMatrixSource | null
): boolean {
  return (
    candidate != null &&
    source != null &&
    candidate.form === source.form &&
    candidate.snapshots === source.snapshots &&
    candidate.context === source.context &&
    candidate.cannonByMonster === source.cannonByMonster &&
    candidate.lootPrefsByMonster === source.lootPrefsByMonster &&
    candidate.lootSettingsByMonster === source.lootSettingsByMonster
  );
}

export function deriveDuelMatrixPresentation(input: {
  source: DuelMatrixSource | null;
  lastSuccessfulBuild: DuelMatrixBuild | null;
  failure: DuelMatrixFailure | null;
  pendingSource: DuelMatrixSource | null;
  hasSavedSetups: boolean;
}): DuelMatrixPresentation {
  const pendingIsCurrent = isDuelMatrixSourceCurrent(input.pendingSource, input.source);
  const failureIsCurrent = isDuelMatrixSourceCurrent(input.failure?.source ?? null, input.source);
  const successIsCurrent = isDuelMatrixSourceCurrent(
    input.lastSuccessfulBuild?.source ?? null,
    input.source
  );
  const displayModel = input.lastSuccessfulBuild?.model ?? null;
  const buildPossible = input.source != null && input.hasSavedSetups;

  if (pendingIsCurrent) {
    return {
      status: "building",
      displayModel,
      displayIsCurrent: false,
      message: displayModel
        ? "Building current comparison. Showing the previous result."
        : "Building comparison for current inputs.",
      canBuild: false,
      buildActionLabel: "Building…"
    };
  }
  if (failureIsCurrent) {
    return {
      status: "failed",
      displayModel,
      displayIsCurrent: false,
      message: displayModel
        ? "Comparison could not be built. Showing the previous result."
        : input.failure!.message,
      canBuild: buildPossible,
      buildActionLabel: "Retry comparison"
    };
  }
  if (successIsCurrent) {
    return {
      status: "ready",
      displayModel,
      displayIsCurrent: true,
      message: "",
      canBuild: buildPossible,
      buildActionLabel: "Refresh comparison"
    };
  }
  if (displayModel) {
    return {
      status: "stale",
      displayModel,
      displayIsCurrent: false,
      message: "Inputs changed. This table does not include the current inputs.",
      canBuild: buildPossible,
      buildActionLabel: "Refresh comparison"
    };
  }
  return {
    status: "idle",
    displayModel: null,
    displayIsCurrent: false,
    message: "Build the all-monster comparison for the current inputs.",
    canBuild: buildPossible,
    buildActionLabel: "Build comparison"
  };
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
  const [comparisonSort, setComparisonSort] = useState<DuelComparisonSortState>(
    DEFAULT_DUEL_COMPARISON_SORT_STATE
  );
  const [matrixMetric, setMatrixMetric] = useState<DuelMatrixMetricId>("effectiveXpPerHour");
  const [matrixFilter, setMatrixFilter] = useState("");
  const [matrixSort, setMatrixSort] = useState<DuelMatrixSortState>(DEFAULT_DUEL_MATRIX_SORT_STATE);
  const [lastSuccessfulBuild, setLastSuccessfulBuild] = useState<DuelMatrixBuild | null>(null);
  const [matrixFailure, setMatrixFailure] = useState<DuelMatrixFailure | null>(null);
  const [matrixPending, setMatrixPending] = useState<DuelMatrixPending | null>(null);
  const pendingRef = useRef<DuelMatrixPending | null>(null);
  const startTask = options.startTask ?? startDuelMatrixTask;

  useEffect(
    () => () => {
      pendingRef.current?.task.cancel();
      pendingRef.current = null;
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
  const comparisonRows = useMemo(
    () => sortDuelComparisonRows(comparison?.rows ?? [], comparisonSort),
    [comparison, comparisonSort]
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
  const matrixPresentation = useMemo(
    () =>
      deriveDuelMatrixPresentation({
        source,
        lastSuccessfulBuild,
        failure: matrixFailure,
        pendingSource: matrixPending?.source ?? null,
        hasSavedSetups: snapshots.snapshots.length > 0
      }),
    [lastSuccessfulBuild, matrixFailure, matrixPending?.source, snapshots.snapshots.length, source]
  );
  const filteredMatrixRows = useMemo(
    () =>
      sortDuelMatrixRows(
        filterDuelMatrixRows(matrixPresentation.displayModel, matrixFilter),
        matrixSort,
        matrixMetric
      ),
    [matrixFilter, matrixMetric, matrixPresentation.displayModel, matrixSort]
  );

  /* eslint-disable react-hooks/set-state-in-effect -- Source identity owns cancellation and the zero-snapshot matrix session reset. */
  useEffect(() => {
    const pending = pendingRef.current;
    if (pending && !isDuelMatrixSourceCurrent(pending.source, source)) {
      pending.task.cancel();
      pendingRef.current = null;
      setMatrixPending(null);
    }
    setMatrixFailure((current) =>
      current && !isDuelMatrixSourceCurrent(current.source, source) ? null : current
    );
  }, [source]);

  useEffect(() => {
    if (snapshots.snapshots.length > 0) return;
    pendingRef.current?.task.cancel();
    pendingRef.current = null;
    setMatrixPending(null);
    setLastSuccessfulBuild(null);
    setMatrixFailure(null);
    setViewMode("current-target");
  }, [snapshots.snapshots.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const buildMatrix = useCallback(() => {
    if (snapshots.snapshots.length === 0 || !source) return;
    const existing = pendingRef.current;
    if (existing && isDuelMatrixSourceCurrent(existing.source, source)) return;
    existing?.task.cancel();
    const task = startTask({ kind: "duel-matrix", ...source });
    const pending = { task, source } satisfies DuelMatrixPending;
    pendingRef.current = pending;
    setMatrixPending(pending);
    setMatrixFailure((current) =>
      isDuelMatrixSourceCurrent(current?.source ?? null, source) ? null : current
    );
    setViewMode("monster-matrix");
    onStatus("Building setup comparison across monsters");
    void task.promise
      .then((model) => {
        if (pendingRef.current?.task !== task) return;
        setLastSuccessfulBuild({ model, source });
        setMatrixFailure((current) =>
          isDuelMatrixSourceCurrent(current?.source ?? null, source) ? null : current
        );
        onStatus(
          `Setup comparison ready: ${model.monsterCount} monsters, ${model.setupCount} setups`
        );
      })
      .catch((error: unknown) => {
        if (error instanceof CalculationTaskCancelledError) return;
        if (pendingRef.current?.task !== task) return;
        setMatrixFailure({
          source,
          message: "Comparison could not be built. Your inputs are unchanged."
        });
        onStatus("Setup comparison across monsters could not be built");
      })
      .finally(() => {
        if (pendingRef.current?.task !== task) return;
        pendingRef.current = null;
        setMatrixPending(null);
      });
  }, [onStatus, snapshots.snapshots.length, source, startTask]);

  const showMonsterMatrix = useCallback(() => {
    setViewMode("monster-matrix");
    if (matrixPresentation.status === "idle") buildMatrix();
  }, [buildMatrix, matrixPresentation.status]);

  return {
    comparison,
    comparisonRows,
    comparisonSort,
    viewMode,
    expandedDiffId,
    matrixMetric,
    matrixFilter,
    matrixPresentation,
    filteredMatrixRows,
    matrixSort,
    showCurrentTarget: () => setViewMode("current-target"),
    showMonsterMatrix,
    toggleDiff: (snapshotId) =>
      setExpandedDiffId((current) => (current === snapshotId ? null : snapshotId)),
    setMatrixMetric,
    setMatrixFilter,
    sortComparisonBy: (key) =>
      setComparisonSort((current) => nextDuelComparisonSortState(current, key)),
    sortMatrixBy: (target) => setMatrixSort((current) => nextDuelMatrixSortState(current, target)),
    buildMatrix
  };
}

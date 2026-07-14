import { useEffect, useMemo, useState } from "react";
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

const EMPTY_DENSE_COMPARE_ROWS: DenseCompareRowViewModel[] = [];

export interface DenseCompareCalculationSource {
  form: CombatSetupFormState;
  context: SimulationContext;
  cannonByMonster: CannonByMonsterState;
  lootPrefsByMonster: LootPrefsState;
  customSetupsByMonster: CustomSetupsByMonsterState;
  lootSettingsByMonster: LootSettingsByMonsterState;
}

interface DenseCompareCalculationBuild {
  rows: DenseCompareRowViewModel[];
  error: boolean;
  source: DenseCompareCalculationSource;
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
  pending: boolean;
  failed: boolean;
  freshnessLabel: "Unavailable" | "Updating" | "Current";
  freshnessSummary: "calculation failed" | "rows may reflect previous loadout" | "current loadout";
  freshnessAria: string;
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

export function denseCompareFreshnessState(input: {
  pending: boolean;
  failed: boolean;
}): Pick<CompareCalculationController, "freshnessLabel" | "freshnessSummary" | "freshnessAria"> {
  if (input.failed) {
    return {
      freshnessLabel: "Unavailable",
      freshnessSummary: "calculation failed",
      freshnessAria: "Compare calculation status: Unavailable. The latest calculation failed."
    };
  }
  if (input.pending) {
    return {
      freshnessLabel: "Updating",
      freshnessSummary: "rows may reflect previous loadout",
      freshnessAria: "Compare calculation status: Updating. Rows may reflect the previous loadout."
    };
  }
  return {
    freshnessLabel: "Current",
    freshnessSummary: "current loadout",
    freshnessAria: "Compare calculation status: Current. Rows match the live setup."
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
  const [build, setBuild] = useState<DenseCompareCalculationBuild | null>(null);
  const startTask = options.startTask ?? startDenseCompareTask;
  const source = useMemo<DenseCompareCalculationSource | null>(
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

  useEffect(() => {
    if (!input.active || !source) return;
    const task = startTask({ kind: "dense-compare", ...source });
    void task.promise
      .then((rows) => setBuild({ rows, error: false, source }))
      .catch((error: unknown) => {
        if (error instanceof CalculationTaskCancelledError) return;
        setBuild({ rows: [], error: true, source });
      });
    return task.cancel;
  }, [input.active, source, startTask]);

  const buildFresh = isDenseCompareBuildFresh(build, source);
  const rows = useMemo(
    () =>
      input.context
        ? presentDenseCompareRows(
            build?.rows ?? EMPTY_DENSE_COMPARE_ROWS,
            input.context.gameData,
            input.denseCompare
          )
        : EMPTY_DENSE_COMPARE_ROWS,
    [build?.rows, input.context, input.denseCompare]
  );
  const pending = JSON.stringify(input.form) !== JSON.stringify(heavyForm) || !buildFresh;
  const failed = buildFresh && build?.error === true;

  return {
    rows,
    scale: createDenseCompareScaleModel(rows),
    totalRows: input.context ? Object.keys(input.context.gameData.monsters).length : 0,
    pending,
    failed,
    ...denseCompareFreshnessState({ pending, failed })
  };
}

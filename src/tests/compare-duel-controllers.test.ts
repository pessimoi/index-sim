/* @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { loadBundledLegacyContext } from "../adapters/legacy-runtime";
import type { RunningCalculationTask } from "../app/calculation-worker-client";
import type {
  DenseCompareCalculationRequest,
  DuelMatrixCalculationRequest
} from "../app/calculation-task";
import {
  denseCompareFreshnessState,
  useCompareCalculation,
  type CompareCalculationController,
  type UseCompareCalculationInput
} from "../app/controllers/use-compare-calculation";
import {
  filterDuelMatrixRows,
  useDuelPane,
  type DuelPaneController,
  type UseDuelPaneInput
} from "../app/controllers/use-duel-pane";
import { DEFAULT_DENSE_COMPARE_STATE } from "../app/state/dense-compare";
import { createDuelSnapshot } from "../app/state/duel-snapshots";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import type { DuelMatrixViewModel } from "../app/view-models/duel";
import type { SimulationContext } from "../domain/shared";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

interface CompareHarnessProps {
  input: UseCompareCalculationInput;
  startTask(
    request: DenseCompareCalculationRequest
  ): RunningCalculationTask<DenseCompareCalculationRequest>;
  capture(value: CompareCalculationController): void;
}

function CompareHarness({ input, startTask, capture }: CompareHarnessProps) {
  capture(useCompareCalculation(input, { startTask }));
  return null;
}

interface DuelHarnessProps {
  input: UseDuelPaneInput;
  startTask(
    request: DuelMatrixCalculationRequest
  ): RunningCalculationTask<DuelMatrixCalculationRequest>;
  capture(value: DuelPaneController): void;
}

function DuelHarness({ input, startTask, capture }: DuelHarnessProps) {
  capture(useDuelPane(input, { startTask }));
  return null;
}

function compareInput(context: SimulationContext): UseCompareCalculationInput {
  return {
    active: true,
    form: DEFAULT_FORM_STATE,
    context,
    cannonByMonster: {},
    lootPrefsByMonster: {},
    customSetupsByMonster: {},
    lootSettingsByMonster: {},
    denseCompare: DEFAULT_DENSE_COMPARE_STATE
  };
}

function matrixFixture(): DuelMatrixViewModel {
  return {
    currentMonsterId: "rock_crab",
    monsterCount: 2,
    setupCount: 1,
    cellCount: 2,
    setups: [
      {
        id: "duel-live",
        snapshotId: null,
        source: "live",
        name: "Live setup",
        combatStyle: "melee",
        loadoutLabel: "melee"
      }
    ],
    rows: [
      {
        monsterId: "rock_crab",
        monsterName: "Rock Crab",
        monsterLevel: 13,
        isCurrentTarget: true,
        cells: []
      },
      {
        monsterId: "giant",
        monsterName: "Hill Giant",
        monsterLevel: 28,
        isCurrentTarget: false,
        cells: []
      }
    ]
  };
}

describe("Compare and Duel controllers", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("preserves Dense debounce, source replacement cancellation and inactive-tab cancellation", async () => {
    vi.useFakeTimers();
    const { context } = await loadBundledLegacyContext();
    const requests: DenseCompareCalculationRequest[] = [];
    const cancels: Array<ReturnType<typeof vi.fn>> = [];
    const startTask = (request: DenseCompareCalculationRequest) => {
      requests.push(request);
      const cancel = vi.fn();
      cancels.push(cancel);
      return {
        promise: new Promise<never>(() => undefined),
        cancel
      } satisfies RunningCalculationTask<DenseCompareCalculationRequest>;
    };
    let controller: CompareCalculationController | null = null;
    const initial = compareInput(context);

    await act(async () => {
      root.render(
        createElement(CompareHarness, {
          input: initial,
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    expect(requests).toHaveLength(1);
    expect(controller!.pending).toBe(true);

    const changed = {
      ...initial,
      form: {
        ...initial.form,
        levels: { ...initial.form.levels, attack: initial.form.levels.attack + 1 }
      }
    };
    await act(async () => {
      root.render(
        createElement(CompareHarness, {
          input: changed,
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    expect(requests).toHaveLength(1);

    await act(async () => vi.advanceTimersByTime(250));
    expect(cancels[0]).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(2);
    expect(requests[1]!.form).toBe(changed.form);

    await act(async () => {
      root.render(
        createElement(CompareHarness, {
          input: { ...changed, active: false },
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    expect(cancels[1]).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(2);
  });

  it("keeps fixed Dense freshness labels and Duel matrix filtering pure", () => {
    expect(denseCompareFreshnessState({ pending: false, failed: false })).toEqual({
      freshnessLabel: "Current",
      freshnessSummary: "current loadout",
      freshnessAria: "Compare calculation status: Current. Rows match the live setup."
    });
    expect(denseCompareFreshnessState({ pending: true, failed: false }).freshnessLabel).toBe(
      "Updating"
    );
    expect(denseCompareFreshnessState({ pending: false, failed: true }).freshnessLabel).toBe(
      "Unavailable"
    );

    const matrix = matrixFixture();
    expect(filterDuelMatrixRows(matrix, "rock").map((row) => row.monsterId)).toEqual(["rock_crab"]);
    expect(filterDuelMatrixRows(matrix, "GIANT").map((row) => row.monsterId)).toEqual(["giant"]);
    expect(filterDuelMatrixRows(null, "rock")).toEqual([]);
  });

  it("starts Duel matrix only on intent, guards busy reruns and cancels on unmount", async () => {
    const { context } = await loadBundledLegacyContext();
    const snapshot = createDuelSnapshot("saved", "Saved", DEFAULT_FORM_STATE);
    const requests: DuelMatrixCalculationRequest[] = [];
    const cancel = vi.fn();
    const status = vi.fn();
    const startTask = (request: DuelMatrixCalculationRequest) => {
      requests.push(request);
      return {
        promise: new Promise<never>(() => undefined),
        cancel
      } satisfies RunningCalculationTask<DuelMatrixCalculationRequest>;
    };
    const input: UseDuelPaneInput = {
      active: true,
      form: DEFAULT_FORM_STATE,
      snapshots: { snapshots: [snapshot] },
      context,
      cannonByMonster: {},
      lootPrefsByMonster: {},
      lootSettingsByMonster: {},
      onStatus: status
    };
    let controller: DuelPaneController | null = null;

    await act(async () => {
      root.render(
        createElement(DuelHarness, {
          input,
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    expect(requests).toHaveLength(0);

    await act(async () => controller!.showMonsterMatrix());
    expect(requests).toHaveLength(1);
    expect(controller!.viewMode).toBe("monster-matrix");
    expect(controller!.matrixBusy).toBe(true);
    expect(status).toHaveBeenCalledWith("Building setup comparison across monsters");

    await act(async () => controller!.buildMatrix());
    expect(requests).toHaveLength(1);

    await act(async () => root.unmount());
    expect(cancel).toHaveBeenCalledOnce();
    root = createRoot(container);
  });

  it("reuses a fresh Duel matrix and requires an explicit rebuild after its sources change", async () => {
    const { context } = await loadBundledLegacyContext();
    const snapshot = createDuelSnapshot("saved", "Saved", DEFAULT_FORM_STATE);
    const requests: DuelMatrixCalculationRequest[] = [];
    const resolvers: Array<(value: DuelMatrixViewModel) => void> = [];
    const startTask = (request: DuelMatrixCalculationRequest) => {
      requests.push(request);
      return {
        promise: new Promise<DuelMatrixViewModel>((resolve) => resolvers.push(resolve)),
        cancel: vi.fn()
      } satisfies RunningCalculationTask<DuelMatrixCalculationRequest>;
    };
    const input: UseDuelPaneInput = {
      active: true,
      form: DEFAULT_FORM_STATE,
      snapshots: { snapshots: [snapshot] },
      context,
      cannonByMonster: {},
      lootPrefsByMonster: {},
      lootSettingsByMonster: {},
      onStatus: vi.fn()
    };
    let controller: DuelPaneController | null = null;
    const render = async (nextInput: UseDuelPaneInput) => {
      await act(async () => {
        root.render(
          createElement(DuelHarness, {
            input: nextInput,
            startTask,
            capture: (value) => {
              controller = value;
            }
          })
        );
      });
    };

    await render(input);
    await act(async () => controller!.showMonsterMatrix());
    await act(async () => resolvers[0]!(matrixFixture()));
    expect(controller!.matrix?.monsterCount).toBe(2);
    expect(controller!.matrixBusy).toBe(false);

    await act(async () => controller!.sortComparisonBy("setup"));
    expect(controller!.comparisonSort).toEqual({ key: "setup", direction: "asc" });
    await act(async () => controller!.sortComparisonBy("setup"));
    expect(controller!.comparisonSort).toEqual({ key: "setup", direction: "desc" });
    await act(async () => controller!.sortMatrixBy({ kind: "monster" }));
    expect(controller!.matrixSort).toEqual({
      target: { kind: "monster" },
      direction: "asc"
    });
    expect(controller!.filteredMatrixRows.map((row) => row.monsterName)).toEqual([
      "Hill Giant",
      "Rock Crab"
    ]);

    await act(async () => controller!.showCurrentTarget());
    await act(async () => controller!.showMonsterMatrix());
    expect(controller!.viewMode).toBe("monster-matrix");
    expect(requests).toHaveLength(1);

    const changedInput = { ...input, form: { ...input.form } };
    await render(changedInput);
    expect(controller!.matrix).toBeNull();
    expect(requests).toHaveLength(1);

    await act(async () => controller!.buildMatrix());
    expect(requests).toHaveLength(2);
    expect(requests[1]!.form).toBe(changedInput.form);
  });
});

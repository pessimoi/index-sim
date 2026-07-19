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
  deriveDuelMatrixPresentation,
  filterDuelMatrixRows,
  isDuelMatrixSourceCurrent,
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

  it("derives every Duel matrix lifecycle state with strict source identity", async () => {
    const { context } = await loadBundledLegacyContext();
    const snapshot = createDuelSnapshot("saved", "Saved", DEFAULT_FORM_STATE);
    const source = {
      form: DEFAULT_FORM_STATE,
      snapshots: { snapshots: [snapshot] },
      context,
      cannonByMonster: {},
      lootPrefsByMonster: {},
      lootSettingsByMonster: {}
    };
    const changedSource = { ...source, form: { ...source.form } };
    const success = { model: matrixFixture(), source };
    const failure = {
      source,
      message: "Comparison could not be built. Your inputs are unchanged." as const
    };

    expect(isDuelMatrixSourceCurrent(source, source)).toBe(true);
    expect(isDuelMatrixSourceCurrent(source, changedSource)).toBe(false);
    expect(
      deriveDuelMatrixPresentation({
        source,
        lastSuccessfulBuild: null,
        failure: null,
        pendingSource: null,
        hasSavedSetups: true
      })
    ).toMatchObject({
      status: "idle",
      displayModel: null,
      buildActionLabel: "Build comparison",
      canBuild: true
    });
    expect(
      deriveDuelMatrixPresentation({
        source,
        lastSuccessfulBuild: null,
        failure: null,
        pendingSource: source,
        hasSavedSetups: true
      })
    ).toMatchObject({ status: "building", displayModel: null, canBuild: false });
    expect(
      deriveDuelMatrixPresentation({
        source,
        lastSuccessfulBuild: success,
        failure: null,
        pendingSource: null,
        hasSavedSetups: true
      })
    ).toMatchObject({ status: "ready", displayIsCurrent: true });
    expect(
      deriveDuelMatrixPresentation({
        source: changedSource,
        lastSuccessfulBuild: success,
        failure: null,
        pendingSource: null,
        hasSavedSetups: true
      })
    ).toMatchObject({
      status: "stale",
      displayModel: success.model,
      displayIsCurrent: false,
      buildActionLabel: "Refresh comparison"
    });
    expect(
      deriveDuelMatrixPresentation({
        source,
        lastSuccessfulBuild: null,
        failure,
        pendingSource: null,
        hasSavedSetups: true
      })
    ).toMatchObject({
      status: "failed",
      displayModel: null,
      message: "Comparison could not be built. Your inputs are unchanged.",
      buildActionLabel: "Retry comparison"
    });
    expect(
      deriveDuelMatrixPresentation({
        source,
        lastSuccessfulBuild: success,
        failure,
        pendingSource: source,
        hasSavedSetups: true
      })
    ).toMatchObject({
      status: "building",
      displayModel: success.model,
      message: "Building current comparison. Showing the previous result."
    });
    expect(
      deriveDuelMatrixPresentation({
        source,
        lastSuccessfulBuild: success,
        failure,
        pendingSource: null,
        hasSavedSetups: true
      })
    ).toMatchObject({
      status: "failed",
      displayModel: success.model,
      message: "Comparison could not be built. Showing the previous result."
    });
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
    expect(controller!.matrixPresentation.status).toBe("idle");

    await act(async () => controller!.showMonsterMatrix());
    expect(requests).toHaveLength(1);
    expect(controller!.viewMode).toBe("monster-matrix");
    expect(controller!.matrixPresentation.status).toBe("building");
    expect(controller!.matrixPresentation.canBuild).toBe(false);
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
    expect(controller!.matrixPresentation.status).toBe("ready");
    expect(controller!.matrixPresentation.displayModel?.monsterCount).toBe(2);

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
    expect(controller!.matrixPresentation.status).toBe("stale");
    expect(controller!.matrixPresentation.displayModel?.monsterCount).toBe(2);
    expect(requests).toHaveLength(1);

    await act(async () => controller!.buildMatrix());
    expect(requests).toHaveLength(2);
    expect(requests[1]!.form).toBe(changedInput.form);
    expect(controller!.matrixPresentation.status).toBe("building");
    expect(controller!.matrixPresentation.displayModel?.monsterCount).toBe(2);
  });

  it("shows a fixed first-build failure and lets Retry replace it without leaking raw errors", async () => {
    const { context } = await loadBundledLegacyContext();
    const snapshot = createDuelSnapshot("saved", "Saved", DEFAULT_FORM_STATE);
    const resolvers: Array<(value: DuelMatrixViewModel) => void> = [];
    const rejectors: Array<(reason: unknown) => void> = [];
    const status = vi.fn();
    const startTask = () =>
      ({
        promise: new Promise<DuelMatrixViewModel>((resolve, reject) => {
          resolvers.push(resolve);
          rejectors.push(reject);
        }),
        cancel: vi.fn()
      }) satisfies RunningCalculationTask<DuelMatrixCalculationRequest>;
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

    await act(async () => controller!.showMonsterMatrix());
    await act(async () => rejectors[0]!(new Error("private worker path /Users/example")));
    expect(controller!.matrixPresentation).toMatchObject({
      status: "failed",
      displayModel: null,
      message: "Comparison could not be built. Your inputs are unchanged.",
      buildActionLabel: "Retry comparison"
    });
    expect(JSON.stringify(controller!.matrixPresentation)).not.toContain("private worker path");
    expect(status).toHaveBeenLastCalledWith("Setup comparison across monsters could not be built");

    await act(async () => controller!.buildMatrix());
    expect(controller!.matrixPresentation.status).toBe("building");
    await act(async () => resolvers[1]!(matrixFixture()));
    expect(controller!.matrixPresentation).toMatchObject({
      status: "ready",
      displayIsCurrent: true
    });
  });

  it("retains previous output across failed refresh and silently replaces obsolete tasks", async () => {
    const { context } = await loadBundledLegacyContext();
    const snapshot = createDuelSnapshot("saved", "Saved", DEFAULT_FORM_STATE);
    const requests: DuelMatrixCalculationRequest[] = [];
    const resolvers: Array<(value: DuelMatrixViewModel) => void> = [];
    const rejectors: Array<(reason: unknown) => void> = [];
    const cancels: Array<ReturnType<typeof vi.fn>> = [];
    const startTask = (request: DuelMatrixCalculationRequest) => {
      requests.push(request);
      const cancel = vi.fn();
      cancels.push(cancel);
      return {
        promise: new Promise<DuelMatrixViewModel>((resolve, reject) => {
          resolvers.push(resolve);
          rejectors.push(reject);
        }),
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
    await act(async () => controller!.buildMatrix());
    expect(controller!.matrixPresentation).toMatchObject({
      status: "building",
      displayModel: expect.any(Object),
      displayIsCurrent: false
    });
    await act(async () => rejectors[1]!(new Error("raw refresh failure")));
    expect(controller!.matrixPresentation).toMatchObject({
      status: "failed",
      displayModel: expect.any(Object),
      message: "Comparison could not be built. Showing the previous result."
    });

    await act(async () => controller!.setMatrixFilter("rock"));
    await act(async () => controller!.setMatrixMetric("dps"));
    await act(async () => controller!.sortMatrixBy({ kind: "monster" }));
    expect(controller!.matrixPresentation.status).toBe("failed");
    expect(controller!.filteredMatrixRows.map((row) => row.monsterId)).toEqual(["rock_crab"]);

    const changed = { ...input, form: { ...input.form } };
    await render(changed);
    expect(controller!.matrixPresentation.status).toBe("stale");
    await render(input);
    expect(controller!.matrixPresentation.status).toBe("ready");
    await render(changed);
    await act(async () => controller!.buildMatrix());
    expect(requests).toHaveLength(3);
    const changedAgain = { ...changed, form: { ...changed.form } };
    await render(changedAgain);
    expect(cancels[2]).toHaveBeenCalledOnce();
    expect(controller!.matrixPresentation.status).toBe("stale");
    await act(async () => rejectors[2]!(new Error("late obsolete failure")));
    expect(controller!.matrixPresentation.status).toBe("stale");
    await act(async () => controller!.buildMatrix());
    expect(requests).toHaveLength(4);
    expect(requests[3]!.form).toBe(changedAgain.form);

    await render({ ...changedAgain, snapshots: { snapshots: [] } });
    expect(cancels[3]).toHaveBeenCalledOnce();
    expect(controller!.viewMode).toBe("current-target");
    expect(controller!.matrixPresentation).toMatchObject({ status: "idle", displayModel: null });
  });
});

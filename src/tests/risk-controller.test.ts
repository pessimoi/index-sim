/* @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { loadCurrentTestContext } from "./helpers/current-sim";
import type { RunningCalculationTask } from "../app/calculation-worker-client";
import type { RiskAnalysisCalculationRequest } from "../app/calculation-task";
import {
  useRiskAnalysis,
  type RiskAnalysisController,
  type UseRiskAnalysisInput
} from "../app/controllers/use-risk-analysis";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import type { RiskAnalysisResult } from "../domain/risk";
import type { SimulationContext } from "../domain/shared";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

interface RiskHarnessProps {
  input: UseRiskAnalysisInput;
  startTask(
    request: RiskAnalysisCalculationRequest
  ): RunningCalculationTask<RiskAnalysisCalculationRequest>;
  capture(value: RiskAnalysisController): void;
}

function RiskHarness({ input, startTask, capture }: RiskHarnessProps) {
  capture(useRiskAnalysis(input, { startTask }));
  return null;
}

function riskInput(
  context: SimulationContext,
  onStatus: (message: string) => void,
  overrides: Partial<UseRiskAnalysisInput> = {}
): UseRiskAnalysisInput {
  return {
    form: DEFAULT_FORM_STATE,
    context,
    cannonByMonster: {},
    lootPrefs: {},
    lootSettingsByMonster: {},
    targetDropCandidates: [
      { rowId: "keep", name: "Kept drop", pref: "loot", chance: 0.25 },
      { rowId: "skip", name: "Skipped drop", pref: "skip", chance: 0.5 },
      { rowId: "zero", name: "Impossible drop", pref: "loot", chance: 0 }
    ],
    onStatus,
    ...overrides
  };
}

function riskResult(sampleCount = 100): RiskAnalysisResult {
  const summary = { mean: 10, p10: 5, p50: 10, p90: 15 };
  return {
    modelVersion: 2,
    inputFingerprint: "risk-fixture",
    sampleCount,
    killTimeSeconds: summary,
    foodRunsOutProbability: 0.1,
    killsPerTrip: summary,
    tripCycleMinutes: summary,
    timedNetGp: summary,
    gpTargetProbability: 0.2,
    targetDrop: null,
    coverage: {
      playerDamage: "sampled",
      incomingDamage: "sampled",
      incomingModel: "Source-backed",
      lootOccurrence: 1,
      lootQuantityCorrelation: 0,
      meanOnlySources: []
    },
    warnings: []
  };
}

function deferredTask() {
  let resolve!: (result: RiskAnalysisResult) => void;
  let reject!: (error: unknown) => void;
  const cancel = vi.fn();
  const promise = new Promise<RiskAnalysisResult>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { task: { promise, cancel }, resolve, reject };
}

describe("Risk analysis controller", () => {
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
  });

  it("starts idle with exact defaults and filters target-drop options", async () => {
    const { context } = await loadCurrentTestContext();
    const startTask = vi.fn();
    let controller: RiskAnalysisController | null = null;

    await act(async () => {
      root.render(
        createElement(RiskHarness, {
          input: riskInput(context, vi.fn()),
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });

    expect(startTask).not.toHaveBeenCalled();
    expect(controller!.controls).toEqual({
      targetKills: 50,
      horizonMinutes: 60,
      gpTarget: 100_000,
      targetDropRowId: null
    });
    expect(controller!.presentation.status).toBe("idle");
    expect(controller!.targetDropOptions).toEqual([
      { id: "", label: "No target drop" },
      { id: "keep", label: "Kept drop" }
    ]);
  });

  it("runs only explicitly and retains a stale display after control edits", async () => {
    const { context } = await loadCurrentTestContext();
    const statuses: string[] = [];
    const requests: RiskAnalysisCalculationRequest[] = [];
    const deferred = deferredTask();
    const startTask = (request: RiskAnalysisCalculationRequest) => {
      requests.push(request);
      return deferred.task satisfies RunningCalculationTask<RiskAnalysisCalculationRequest>;
    };
    let controller: RiskAnalysisController | null = null;

    await act(async () => {
      root.render(
        createElement(RiskHarness, {
          input: riskInput(context, (message) => statuses.push(message)),
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    await act(async () => controller!.run());
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ kind: "risk-analysis", analysis: controller!.controls });
    expect(controller!.presentation.status).toBe("building");
    expect(statuses).toEqual(["Running modeled risk analysis"]);

    await act(async () => deferred.resolve(riskResult(1_000)));
    expect(controller!.presentation.status).toBe("ready");
    expect(controller!.display).toMatchObject({ fresh: true, result: { sampleCount: 1_000 } });
    expect(controller!.fresh?.result.sampleCount).toBe(1_000);
    expect(statuses.at(-1)).toBe("Risk analysis ready: 1,000 trials");

    await act(async () => controller!.setTargetKills(75));
    expect(requests).toHaveLength(1);
    expect(controller!.controls.targetKills).toBe(75);
    expect(controller!.display?.controls.targetKills).toBe(50);
    expect(controller!.display?.fresh).toBe(false);
    expect(controller!.fresh).toBeNull();
    expect(controller!.presentation.status).toBe("stale");
  });

  it("cancels a running task silently when an exact source reference changes", async () => {
    const { context } = await loadCurrentTestContext();
    const statuses: string[] = [];
    const obsolete = deferredTask();
    const current = deferredTask();
    const tasks = [obsolete, current];
    let index = 0;
    const startTask = () =>
      tasks[index++]!.task satisfies RunningCalculationTask<RiskAnalysisCalculationRequest>;
    let controller: RiskAnalysisController | null = null;
    const initialInput = riskInput(context, (message) => statuses.push(message));

    const render = async (input: UseRiskAnalysisInput) => {
      await act(async () => {
        root.render(
          createElement(RiskHarness, {
            input,
            startTask,
            capture: (value) => {
              controller = value;
            }
          })
        );
      });
    };
    await render(initialInput);
    await act(async () => controller!.run());
    await render({ ...initialInput, lootPrefs: { keep: "skip" } });

    expect(obsolete.task.cancel).toHaveBeenCalledOnce();
    expect(controller!.presentation.status).toBe("idle");
    expect(statuses).toEqual(["Running modeled risk analysis"]);
    await act(async () => obsolete.reject(new Error("late obsolete risk failure")));
    expect(controller!.display).toBeNull();
    expect(controller!.presentation.status).toBe("idle");

    await act(async () => controller!.run());
    expect(controller!.presentation.status).toBe("building");
    await act(async () => current.resolve(riskResult(555)));
    expect(controller!.fresh?.result.sampleCount).toBe(555);
  });

  it("keeps a first failure sanitized and recoverable through explicit Retry", async () => {
    const { context } = await loadCurrentTestContext();
    const first = deferredTask();
    const retry = deferredTask();
    const tasks = [first, retry];
    let index = 0;
    const startTask = () =>
      tasks[index++]!.task satisfies RunningCalculationTask<RiskAnalysisCalculationRequest>;
    let controller: RiskAnalysisController | null = null;

    await act(async () => {
      root.render(
        createElement(RiskHarness, {
          input: riskInput(context, vi.fn()),
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    await act(async () => controller!.run());
    await act(async () => first.reject(new Error("private risk worker path")));
    expect(controller!.presentation).toMatchObject({
      status: "failed",
      message: "Risk analysis could not be completed. Your inputs are unchanged.",
      runActionLabel: "Retry analysis"
    });
    expect(controller!.display).toBeNull();
    expect(JSON.stringify(controller!.presentation)).not.toContain("private risk worker path");

    await act(async () => controller!.run());
    expect(controller!.presentation.status).toBe("building");
    await act(async () => retry.resolve(riskResult(444)));
    expect(controller!.presentation).toMatchObject({ status: "ready", displayIsCurrent: true });
    expect(controller!.fresh?.result.sampleCount).toBe(444);
  });

  it("settles only the latest replacement task and supports explicit cancellation", async () => {
    const { context } = await loadCurrentTestContext();
    const statuses: string[] = [];
    const first = deferredTask();
    const second = deferredTask();
    const tasks = [first, second];
    let index = 0;
    const startTask = () =>
      tasks[index++]!.task satisfies RunningCalculationTask<RiskAnalysisCalculationRequest>;
    let controller: RiskAnalysisController | null = null;

    await act(async () => {
      root.render(
        createElement(RiskHarness, {
          input: riskInput(context, (message) => statuses.push(message)),
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    await act(async () => controller!.run());
    await act(async () => controller!.run());
    expect(first.task.cancel).toHaveBeenCalledOnce();
    await act(async () => first.resolve(riskResult(111)));
    expect(controller!.display).toBeNull();
    await act(async () => second.resolve(riskResult(222)));
    expect(controller!.fresh?.result.sampleCount).toBe(222);

    const third = deferredTask();
    const cancelStarter = () =>
      third.task satisfies RunningCalculationTask<RiskAnalysisCalculationRequest>;
    await act(async () => {
      root.render(
        createElement(RiskHarness, {
          input: riskInput(context, (message) => statuses.push(message)),
          startTask: cancelStarter,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    await act(async () => controller!.run());
    await act(async () => controller!.cancel());
    expect(third.task.cancel).toHaveBeenCalledOnce();
    expect(controller!.presentation.status).toBe("stale");
    expect(statuses.at(-1)).toBe("Risk analysis cancelled");
  });

  it("sanitizes failures, retains the previous build and cancels on unmount", async () => {
    const { context } = await loadCurrentTestContext();
    const statuses: string[] = [];
    const ready = deferredTask();
    const failed = deferredTask();
    const tasks = [ready, failed];
    let index = 0;
    const startTask = () =>
      tasks[index++]!.task satisfies RunningCalculationTask<RiskAnalysisCalculationRequest>;
    let controller: RiskAnalysisController | null = null;

    await act(async () => {
      root.render(
        createElement(RiskHarness, {
          input: riskInput(context, (message) => statuses.push(message)),
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    await act(async () => controller!.run());
    await act(async () => ready.resolve(riskResult(321)));
    await act(async () => controller!.run());
    await act(async () => failed.reject(new Error("worker detail must not leak")));
    expect(controller!.presentation.status).toBe("failed");
    expect(controller!.presentation).toMatchObject({
      message: "Risk analysis could not be completed. Showing the previous result.",
      runActionLabel: "Retry analysis"
    });
    expect(controller!.display).toMatchObject({ fresh: false, result: { sampleCount: 321 } });
    expect(controller!.fresh).toBeNull();
    expect(statuses.at(-1)).toBe("Risk analysis could not be completed");

    const pending = deferredTask();
    const pendingStarter = () =>
      pending.task satisfies RunningCalculationTask<RiskAnalysisCalculationRequest>;
    await act(async () => {
      root.render(
        createElement(RiskHarness, {
          input: riskInput(context, (message) => statuses.push(message)),
          startTask: pendingStarter,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    await act(async () => controller!.run());
    await act(async () => root.unmount());
    expect(pending.task.cancel).toHaveBeenCalledOnce();
    root = createRoot(container);
  });
});

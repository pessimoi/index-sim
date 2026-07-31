/* @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { loadCurrentTestContext } from "./helpers/current-sim";
import type { RunningCalculationTask } from "../app/calculation-worker-client";
import type { PlannerCalculationRequest } from "../app/calculation-task";
import {
  derivePlannerCalculationPresentation,
  isPlannerSourceCurrent,
  usePlannerCalculation,
  type PlannerCalculationController,
  type UsePlannerCalculationInput
} from "../app/controllers/use-planner-calculation";
import {
  PlannerUiStateSchema,
  createDefaultPlannerUiState,
  reconcilePlannerProgressWithLevels
} from "../app/state/planner";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import type { PlannerPanelViewModel } from "../app/view-models/planner";
import type { SimulationContext } from "../domain/shared";
import { xpAt } from "../domain/planner";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

interface PlannerHarnessProps {
  input: UsePlannerCalculationInput;
  startTask(request: PlannerCalculationRequest): RunningCalculationTask<PlannerCalculationRequest>;
  capture(value: PlannerCalculationController): void;
}

function PlannerHarness({ input, startTask, capture }: PlannerHarnessProps) {
  capture(usePlannerCalculation(input, { startTask }));
  return null;
}

function plannerInput(
  context: SimulationContext,
  overrides: Partial<UsePlannerCalculationInput> = {}
): UsePlannerCalculationInput {
  return {
    active: true,
    draftState: createDefaultPlannerUiState(DEFAULT_FORM_STATE),
    form: DEFAULT_FORM_STATE,
    context,
    lootSettingsByMonster: {},
    ...overrides
  };
}

function panelFixture(isEmpty = false): PlannerPanelViewModel {
  return {
    summary: {
      totalXp: 0,
      stepCount: 0,
      phaseCount: 0,
      unlockCount: 0,
      startDps: 1,
      endDps: 1,
      startMetric: 1,
      endMetric: 1,
      truncated: false
    },
    trainingOrder: [],
    unlocks: [],
    timeline: [],
    chart: {
      points: [],
      minDps: 1,
      maxDps: 1,
      maxCumXp: 0,
      isEmpty: true
    },
    notices: {
      warningSetId: "planner-warning-set-empty",
      issueCount: 0,
      noteCount: 0,
      occurrenceCount: 0,
      rows: []
    },
    isEmpty
  };
}

describe("Planner calculation controller", () => {
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

  it("starts only while active and cancels on deactivation or unmount", async () => {
    const { context } = await loadCurrentTestContext();
    const requests: PlannerCalculationRequest[] = [];
    const cancels: Array<ReturnType<typeof vi.fn>> = [];
    const startTask = (request: PlannerCalculationRequest) => {
      requests.push(request);
      const cancel = vi.fn();
      cancels.push(cancel);
      return {
        promise: new Promise<never>(() => undefined),
        cancel
      } satisfies RunningCalculationTask<PlannerCalculationRequest>;
    };
    let controller: PlannerCalculationController | null = null;
    const inactive = plannerInput(context, { active: false });

    await act(async () => {
      root.render(
        createElement(PlannerHarness, {
          input: inactive,
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    expect(requests).toHaveLength(0);
    expect(controller!.pending).toBe(false);

    await act(async () => {
      root.render(
        createElement(PlannerHarness, {
          input: { ...inactive, active: true },
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.kind).toBe("planner");
    expect(controller!.pending).toBe(true);
    expect(controller!.status).toBe("building");

    await act(async () => {
      root.render(
        createElement(PlannerHarness, {
          input: inactive,
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    expect(cancels[0]).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(1);

    await act(async () => {
      root.render(
        createElement(PlannerHarness, {
          input: { ...inactive, active: true },
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    expect(requests).toHaveLength(2);
    await act(async () => root.unmount());
    expect(cancels[1]).toHaveBeenCalledOnce();
    root = createRoot(container);
  });

  it("keeps draft edits pending until Recompute and retains automatic source refreshes", async () => {
    const { context } = await loadCurrentTestContext();
    const requests: PlannerCalculationRequest[] = [];
    const resolvers: Array<(value: PlannerPanelViewModel) => void> = [];
    const startTask = (request: PlannerCalculationRequest) => {
      requests.push(request);
      return {
        promise: new Promise<PlannerPanelViewModel>((resolve) => resolvers.push(resolve)),
        cancel: vi.fn()
      } satisfies RunningCalculationTask<PlannerCalculationRequest>;
    };
    let controller: PlannerCalculationController | null = null;
    const initial = plannerInput(context);
    const render = async (input: UsePlannerCalculationInput) => {
      await act(async () => {
        root.render(
          createElement(PlannerHarness, {
            input,
            startTask,
            capture: (value) => {
              controller = value;
            }
          })
        );
      });
    };

    await render(initial);
    expect(requests).toHaveLength(1);
    await act(async () => resolvers[0]!(panelFixture()));
    expect(controller!.panel).not.toBeNull();
    expect(controller!.status).toBe("ready");

    const changedDraft = { ...initial.draftState, metric: "dps" as const };
    await render({ ...initial, draftState: changedDraft });
    expect(requests).toHaveLength(1);
    expect(controller!.draftDirty).toBe(true);
    expect(controller!.status).toBe("stale");
    expect(controller!.panel).not.toBeNull();

    await act(async () => controller!.recompute());
    expect(requests).toHaveLength(2);
    expect(requests[1]!.plannerState.metric).toBe("dps");
    expect(controller!.computedMetric).toBe("xph");
    expect(controller!.panel).not.toBeNull();
    expect(controller!.status).toBe("building");
    await act(async () => resolvers[1]!(panelFixture(true)));
    expect(controller!.status).toBe("ready");
    expect(controller!.computedMetric).toBe("dps");

    const changedForm = {
      ...initial.form,
      levels: { ...initial.form.levels, attack: initial.form.levels.attack + 1 }
    };
    await render({ ...initial, draftState: changedDraft, form: changedForm });
    expect(requests).toHaveLength(3);
    expect(requests[2]!.form).toBe(changedForm);
    expect(requests[2]!.plannerState.metric).toBe("dps");
  });

  it("reconciles Apply and Undo sources and rejects the late applied-level result", async () => {
    const { context } = await loadCurrentTestContext();
    const requests: PlannerCalculationRequest[] = [];
    const resolvers: Array<(value: PlannerPanelViewModel) => void> = [];
    const cancels: Array<ReturnType<typeof vi.fn>> = [];
    const startTask = (request: PlannerCalculationRequest) => {
      requests.push(request);
      const cancel = vi.fn();
      cancels.push(cancel);
      return {
        promise: new Promise<PlannerPanelViewModel>((resolve) => resolvers.push(resolve)),
        cancel
      } satisfies RunningCalculationTask<PlannerCalculationRequest>;
    };
    const oldForm = {
      ...DEFAULT_FORM_STATE,
      levels: { ...DEFAULT_FORM_STATE.levels, attack: 60 }
    };
    const draftState = PlannerUiStateSchema.parse({
      ...createDefaultPlannerUiState(oldForm),
      currentXp: {
        ...createDefaultPlannerUiState(oldForm).currentXp,
        attack: xpAt(60) + 10
      },
      targetLevels: {
        ...createDefaultPlannerUiState(oldForm).targetLevels,
        attack: 60
      }
    });
    const onDraftReconciled = vi.fn();
    let controller: PlannerCalculationController | null = null;
    const render = async (input: UsePlannerCalculationInput) => {
      await act(async () => {
        root.render(
          createElement(PlannerHarness, {
            input,
            startTask,
            capture: (value) => {
              controller = value;
            }
          })
        );
      });
    };

    const initial = plannerInput(context, { form: oldForm, draftState, onDraftReconciled });
    await render(initial);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.plannerState.currentXp.attack).toBe(xpAt(60) + 10);

    const newForm = { ...oldForm, levels: { ...oldForm.levels, attack: 61 } };
    await render({ ...initial, form: newForm });
    expect(onDraftReconciled).toHaveBeenCalled();
    expect(onDraftReconciled.mock.calls.at(-1)?.[0]).toMatchObject({
      currentXp: { attack: 0 },
      targetLevels: { attack: 61 }
    });
    expect(requests.at(-1)?.plannerState).toMatchObject({
      currentXp: { attack: 0 },
      targetLevels: { attack: 61 }
    });
    expect(cancels[0]).toHaveBeenCalledOnce();

    await act(async () => resolvers[0]!(panelFixture()));
    expect(controller!.panel).toBeNull();

    const appliedTaskIndex = requests.length - 1;
    const appliedDraft = reconcilePlannerProgressWithLevels(draftState, newForm.levels).state;
    await render({ ...initial, form: oldForm, draftState: appliedDraft });
    expect(cancels[appliedTaskIndex]).toHaveBeenCalledOnce();
    expect(requests.at(-1)?.form).toBe(oldForm);
    expect(requests.at(-1)?.plannerState).toMatchObject({
      currentXp: { attack: 0 },
      targetLevels: { attack: 61 }
    });

    await act(async () => resolvers[appliedTaskIndex]!(panelFixture()));
    expect(controller!.panel).toBeNull();
    await act(async () => resolvers.at(-1)!(panelFixture()));
    expect(controller!.panel).not.toBeNull();
  });

  it("retries first and refresh failures while retaining the previous plan", async () => {
    const { context } = await loadCurrentTestContext();
    const requests: PlannerCalculationRequest[] = [];
    const resolvers: Array<(panel: PlannerPanelViewModel) => void> = [];
    const rejectors: Array<(reason: unknown) => void> = [];
    const cancels: Array<ReturnType<typeof vi.fn>> = [];
    const startTask = (request: PlannerCalculationRequest) => {
      requests.push(request);
      const cancel = vi.fn();
      cancels.push(cancel);
      return {
        promise: new Promise<PlannerPanelViewModel>((resolve, reject) => {
          resolvers.push(resolve);
          rejectors.push(reject);
        }),
        cancel
      } satisfies RunningCalculationTask<PlannerCalculationRequest>;
    };
    let controller: PlannerCalculationController | null = null;
    const initial = plannerInput(context);
    const render = async (input: UsePlannerCalculationInput) => {
      await act(async () => {
        root.render(
          createElement(PlannerHarness, {
            input,
            startTask,
            capture: (value) => {
              controller = value;
            }
          })
        );
      });
    };

    await render(initial);
    await act(async () => rejectors[0]!(new Error("private planner worker path")));
    expect(controller!.presentation).toMatchObject({
      status: "failed",
      message: "Planner could not compute the current plan. Your inputs are unchanged.",
      canRetry: true
    });
    expect(controller!.panel).toBeNull();
    expect(JSON.stringify(controller!.presentation)).not.toContain("private planner worker path");

    await act(async () => controller!.retry());
    expect(requests).toHaveLength(2);
    await act(async () => resolvers[1]!(panelFixture()));
    expect(controller!.presentation.status).toBe("ready");
    expect(controller!.panel).not.toBeNull();

    const changedForm = { ...initial.form };
    await render({ ...initial, form: changedForm });
    expect(requests).toHaveLength(3);
    expect(controller!.presentation).toMatchObject({
      status: "building",
      message: "Calculating the current plan. Showing the previous result."
    });
    await act(async () => rejectors[2]!(new Error("raw planner refresh failure")));
    expect(controller!.presentation).toMatchObject({
      status: "failed",
      message: "Planner could not compute the current plan. Showing the previous result."
    });
    expect(controller!.panel).not.toBeNull();

    await act(async () => controller!.retry());
    expect(requests).toHaveLength(4);
    await act(async () => resolvers[3]!(panelFixture(true)));
    expect(controller!.presentation).toMatchObject({ status: "ready", displayIsCurrent: true });

    const lateForm = { ...changedForm };
    await render({ ...initial, form: lateForm });
    expect(requests).toHaveLength(5);
    const latestForm = { ...lateForm };
    await render({ ...initial, form: latestForm });
    expect(cancels[4]).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(6);
    await act(async () => resolvers[4]!(panelFixture()));
    expect(controller!.presentation.status).toBe("building");
    await act(async () => resolvers[5]!(panelFixture()));
    expect(controller!.presentation.status).toBe("ready");

    const lateFailureForm = { ...latestForm };
    await render({ ...initial, form: lateFailureForm });
    expect(requests).toHaveLength(7);
    const finalForm = { ...lateFailureForm };
    await render({ ...initial, form: finalForm });
    expect(cancels[6]).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(8);
    await act(async () => rejectors[6]!(new Error("late obsolete planner failure")));
    expect(controller!.presentation.status).toBe("building");
    await act(async () => resolvers[7]!(panelFixture()));
    expect(controller!.presentation.status).toBe("ready");
  });

  it("keeps status precedence and the fixed Planner error contract", async () => {
    const { context } = await loadCurrentTestContext();
    const plannerState = createDefaultPlannerUiState(DEFAULT_FORM_STATE);
    const source = {
      form: DEFAULT_FORM_STATE,
      context,
      lootSettingsByMonster: {},
      plannerState
    };
    const failure = {
      source,
      message: "Planner could not compute the current plan. Your inputs are unchanged." as const
    };
    expect(isPlannerSourceCurrent(source, source)).toBe(true);
    expect(isPlannerSourceCurrent(source, { ...source, form: { ...source.form } })).toBe(false);
    expect(
      derivePlannerCalculationPresentation({
        active: true,
        source,
        lastSuccessfulBuild: { panel: panelFixture(), source },
        failure,
        pendingSource: source,
        draftDirty: true
      }).status
    ).toBe("building");
    expect(
      derivePlannerCalculationPresentation({
        active: true,
        source,
        lastSuccessfulBuild: { panel: panelFixture(), source },
        failure,
        pendingSource: null,
        draftDirty: true
      })
    ).toMatchObject({
      status: "failed",
      message: "Planner could not compute the current plan. Showing the previous result."
    });

    const startTask = () =>
      ({
        promise: Promise.reject(new Error("worker detail must not leak")),
        cancel: vi.fn()
      }) satisfies RunningCalculationTask<PlannerCalculationRequest>;
    let controller: PlannerCalculationController | null = null;

    await act(async () => {
      root.render(
        createElement(PlannerHarness, {
          input: plannerInput(context),
          startTask,
          capture: (value) => {
            controller = value;
          }
        })
      );
    });
    expect(controller!.status).toBe("failed");
    expect(controller!.error).toBe(
      "Planner could not compute the current plan. Your inputs are unchanged."
    );
    expect(controller!.presentation.canRetry).toBe(true);
  });
});

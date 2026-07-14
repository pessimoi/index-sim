/* @vitest-environment jsdom */

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { loadBundledLegacyContext } from "../adapters/legacy-runtime";
import type { RunningCalculationTask } from "../app/calculation-worker-client";
import type { PlannerCalculationRequest } from "../app/calculation-task";
import {
  plannerStatusFor,
  usePlannerCalculation,
  type PlannerCalculationController,
  type UsePlannerCalculationInput
} from "../app/controllers/use-planner-calculation";
import { createDefaultPlannerUiState } from "../app/state/planner";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import type { PlannerPanelViewModel } from "../app/view-models/planner";
import type { SimulationContext } from "../domain/shared";

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
    warnings: [],
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
    const { context } = await loadBundledLegacyContext();
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
    expect(controller!.status).toBe("running");

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
    const { context } = await loadBundledLegacyContext();
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
    expect(controller!.status).toBe("pending");
    expect(controller!.panel).not.toBeNull();

    await act(async () => controller!.recompute());
    expect(requests).toHaveLength(2);
    expect(requests[1]!.plannerState.metric).toBe("dps");
    expect(controller!.computedMetric).toBe("dps");
    expect(controller!.panel).toBeNull();
    expect(controller!.status).toBe("running");
    await act(async () => resolvers[1]!(panelFixture(true)));
    expect(controller!.status).toBe("empty");

    const changedForm = {
      ...initial.form,
      levels: { ...initial.form.levels, attack: initial.form.levels.attack + 1 }
    };
    await render({ ...initial, draftState: changedDraft, form: changedForm });
    expect(requests).toHaveLength(3);
    expect(requests[2]!.form).toBe(changedForm);
    expect(requests[2]!.plannerState.metric).toBe("dps");
  });

  it("keeps status precedence and the fixed Planner error contract", async () => {
    expect(
      plannerStatusFor({ error: "failed", draftDirty: true, pending: true, panel: panelFixture() })
    ).toBe("error");
    expect(
      plannerStatusFor({ error: null, draftDirty: true, pending: true, panel: panelFixture() })
    ).toBe("pending");

    const { context } = await loadBundledLegacyContext();
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
    expect(controller!.status).toBe("error");
    expect(controller!.error).toBe("Planner could not compute the current plan");
  });
});

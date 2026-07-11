import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  CalculationTaskCancelledError,
  CalculationTaskError,
  startCalculationTask
} from "../app/calculation-worker-client";
import { executeCalculationTask } from "../app/calculation-task";
import { DEFAULT_PLANNER_UI_STATE } from "../app/state/planner";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: unknown = null;
  terminated = false;

  postMessage(message: unknown): void {
    this.posted = message;
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

class ThrowingPostWorker extends FakeWorker {
  override postMessage(): void {
    throw new DOMException("private clone details", "DataCloneError");
  }
}

function denseRequest() {
  const { context } = createGeneratedRuntimeContext();
  return {
    kind: "dense-compare" as const,
    form: DEFAULT_FORM_STATE,
    context,
    cannonByMonster: {},
    lootPrefsByMonster: {},
    customSetupsByMonster: {},
    lootSettingsByMonster: {}
  };
}

describe("calculation task boundary", () => {
  it("executes dense compare, Planner, Duel and Risk requests through pure structured results", () => {
    const dense = denseRequest();
    const rows = executeCalculationTask(dense);
    expect(rows).toHaveLength(Object.keys(dense.context.gameData.monsters).length);

    const planner = executeCalculationTask({
      kind: "planner",
      form: DEFAULT_FORM_STATE,
      context: dense.context,
      lootSettingsByMonster: {},
      plannerState: DEFAULT_PLANNER_UI_STATE
    });
    expect(planner.summary.stepCount).toBeGreaterThanOrEqual(0);

    const matrix = executeCalculationTask({
      kind: "duel-matrix",
      form: DEFAULT_FORM_STATE,
      snapshots: { snapshots: [] },
      context: dense.context,
      cannonByMonster: {},
      lootPrefsByMonster: {},
      lootSettingsByMonster: {}
    });
    expect(matrix.cellCount).toBe(matrix.monsterCount);
    const risk = executeCalculationTask({
      kind: "risk-analysis",
      form: DEFAULT_FORM_STATE,
      context: dense.context,
      cannonByMonster: {},
      lootPrefs: {},
      lootSettingsByMonster: {},
      analysis: {
        targetKills: 10,
        horizonMinutes: 10,
        gpTarget: 1_000,
        targetDropRowId: null,
        sampleCount: 100,
        seed: 5
      }
    });
    expect(risk.sampleCount).toBe(100);
    expect(() => structuredClone({ rows, planner, matrix, risk })).not.toThrow();
  });

  it("resolves only a matching worker response and terminates the worker", async () => {
    const worker = new FakeWorker();
    const request = denseRequest();
    const task = startCalculationTask(request, () => worker as unknown as Worker);
    expect(worker.posted).toBe(request);

    worker.respond({ ok: true, kind: "dense-compare", result: [] });
    await expect(task.promise).resolves.toEqual([]);
    expect(worker.terminated).toBe(true);
  });

  it("cancels work and sanitizes invalid worker responses", async () => {
    const cancelledWorker = new FakeWorker();
    const cancelled = startCalculationTask(
      denseRequest(),
      () => cancelledWorker as unknown as Worker
    );
    cancelled.cancel();
    await expect(cancelled.promise).rejects.toBeInstanceOf(CalculationTaskCancelledError);
    expect(cancelledWorker.terminated).toBe(true);

    const invalidWorker = new FakeWorker();
    const invalid = startCalculationTask(denseRequest(), () => invalidWorker as unknown as Worker);
    invalidWorker.respond({ ok: true, kind: "planner", result: { raw: "private details" } });
    await expect(invalid.promise).rejects.toBeInstanceOf(CalculationTaskError);
    expect(invalidWorker.terminated).toBe(true);

    const unavailable = startCalculationTask(denseRequest(), () => {
      throw new Error("private worker construction details");
    });
    await expect(unavailable.promise).rejects.toEqual(new CalculationTaskError());

    const cloneFailureWorker = new ThrowingPostWorker();
    const cloneFailure = startCalculationTask(
      denseRequest(),
      () => cloneFailureWorker as unknown as Worker
    );
    await expect(cloneFailure.promise).rejects.toEqual(new CalculationTaskError());
    expect(cloneFailureWorker.terminated).toBe(true);
  });

  it("terminates a worker that does not answer before the bounded timeout", async () => {
    const worker = new FakeWorker();
    const task = startCalculationTask(denseRequest(), () => worker as unknown as Worker, 1);

    await expect(task.promise).rejects.toBeInstanceOf(CalculationTaskError);
    expect(worker.terminated).toBe(true);
  });
});

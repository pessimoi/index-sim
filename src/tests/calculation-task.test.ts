import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  CalculationTaskCancelledError,
  CalculationTaskError,
  startCalculationTask,
  startMeasuredCalculationTask
} from "../app/calculation-worker-client";
import {
  CALCULATION_WORKER_MEASUREMENT_TYPE,
  executeCalculationTask,
  executeCalculationWorkerInput
} from "../app/calculation-task";
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
  }, 15_000);

  it("resolves only a matching worker response and terminates the worker", async () => {
    const worker = new FakeWorker();
    const request = denseRequest();
    const task = startCalculationTask(request, () => worker as unknown as Worker);
    expect(worker.posted).toBe(request);

    worker.respond({ ok: true, kind: "dense-compare", result: [] });
    await expect(task.promise).resolves.toEqual([]);
    expect(worker.terminated).toBe(true);
  });

  it("keeps raw worker responses unchanged and wraps only explicit measurement requests", () => {
    const request = denseRequest();
    const raw = executeCalculationWorkerInput(request, () => 10);
    expect(raw).toMatchObject({ ok: true, kind: "dense-compare" });
    expect(raw).not.toHaveProperty("type");

    const times = [20, 21, 35];
    const measured = executeCalculationWorkerInput(
      { type: CALCULATION_WORKER_MEASUREMENT_TYPE, request },
      () => times.shift() ?? 35
    );
    expect(measured).toMatchObject({
      type: CALCULATION_WORKER_MEASUREMENT_TYPE,
      kind: "dense-compare",
      response: { ok: true, kind: "dense-compare" },
      timing: { receivedAtMs: 20, startedAtMs: 21, finishedAtMs: 35 }
    });
  });

  it("measures the real worker phases from aligned deterministic clocks", async () => {
    const worker = new FakeWorker();
    const request = denseRequest();
    const times = [100, 102, 103, 105, 150];
    const task = startMeasuredCalculationTask(
      request,
      () => worker as unknown as Worker,
      1_000,
      () => times.shift() ?? 150
    );
    expect(worker.posted).toEqual({
      type: CALCULATION_WORKER_MEASUREMENT_TYPE,
      request
    });

    worker.respond({
      type: CALCULATION_WORKER_MEASUREMENT_TYPE,
      kind: "dense-compare",
      response: { ok: true, kind: "dense-compare", result: [] },
      timing: { receivedAtMs: 120, startedAtMs: 121, finishedAtMs: 140 }
    });

    await expect(task.promise).resolves.toEqual({
      result: [],
      timing: {
        workerCreateMs: 2,
        requestPostMs: 2,
        startupAndRequestDeliveryMs: 15,
        workerQueueMs: 1,
        executionMs: 19,
        responseDeliveryMs: 10,
        totalMs: 50,
        clockAligned: true
      }
    });
    expect(worker.terminated).toBe(true);
  });

  it("keeps measured work cancellable, bounded and sanitized", async () => {
    const cancelledWorker = new FakeWorker();
    const cancelled = startMeasuredCalculationTask(
      denseRequest(),
      () => cancelledWorker as unknown as Worker
    );
    cancelled.cancel();
    await expect(cancelled.promise).rejects.toBeInstanceOf(CalculationTaskCancelledError);
    expect(cancelledWorker.terminated).toBe(true);

    const invalidWorker = new FakeWorker();
    const invalid = startMeasuredCalculationTask(
      denseRequest(),
      () => invalidWorker as unknown as Worker
    );
    invalidWorker.respond({
      type: CALCULATION_WORKER_MEASUREMENT_TYPE,
      kind: "planner",
      response: { ok: false, kind: "planner", error: "calculation_failed" },
      timing: { receivedAtMs: 1, startedAtMs: 2, finishedAtMs: 3 }
    });
    await expect(invalid.promise).rejects.toBeInstanceOf(CalculationTaskError);
    expect(invalidWorker.terminated).toBe(true);

    const cloneFailureWorker = new ThrowingPostWorker();
    const cloneFailure = startMeasuredCalculationTask(
      denseRequest(),
      () => cloneFailureWorker as unknown as Worker
    );
    await expect(cloneFailure.promise).rejects.toEqual(new CalculationTaskError());
    expect(cloneFailureWorker.terminated).toBe(true);

    const timeoutWorker = new FakeWorker();
    const timedOut = startMeasuredCalculationTask(
      denseRequest(),
      () => timeoutWorker as unknown as Worker,
      1
    );
    await expect(timedOut.promise).rejects.toBeInstanceOf(CalculationTaskError);
    expect(timeoutWorker.terminated).toBe(true);
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

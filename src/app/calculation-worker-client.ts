import type {
  CalculationRequest,
  CalculationResult,
  CalculationWorkerMeasurementResponse,
  CalculationWorkerResponse
} from "./calculation-task";
import { CALCULATION_WORKER_MEASUREMENT_TYPE } from "./calculation-task";

export class CalculationTaskCancelledError extends Error {
  constructor() {
    super("Calculation task was cancelled");
    this.name = "CalculationTaskCancelledError";
  }
}

export class CalculationTaskError extends Error {
  constructor() {
    super("Calculation task failed");
    this.name = "CalculationTaskError";
  }
}

export const CALCULATION_TASK_TIMEOUT_MS = 30_000;

export interface RunningCalculationTask<T extends CalculationRequest> {
  promise: Promise<CalculationResult<T>>;
  cancel(): void;
}

export interface CalculationTaskMeasurement {
  workerCreateMs: number;
  requestPostMs: number;
  startupAndRequestDeliveryMs: number;
  workerQueueMs: number;
  executionMs: number;
  responseDeliveryMs: number;
  totalMs: number;
  clockAligned: boolean;
}

export interface MeasuredCalculationTaskResult<T extends CalculationRequest> {
  result: CalculationResult<T>;
  timing: CalculationTaskMeasurement;
}

export interface RunningMeasuredCalculationTask<T extends CalculationRequest> {
  promise: Promise<MeasuredCalculationTaskResult<T>>;
  cancel(): void;
}

type WorkerFactory = () => Worker;

function defaultWorkerFactory(): Worker {
  return new Worker(new URL("./calculation-worker.ts", import.meta.url), { type: "module" });
}

function absoluteNow(): number {
  return performance.timeOrigin + performance.now();
}

function nonNegativeDuration(finishedAtMs: number, startedAtMs: number): number {
  const duration = finishedAtMs - startedAtMs;
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
}

export function startCalculationTask<T extends CalculationRequest>(
  request: T,
  workerFactory: WorkerFactory = defaultWorkerFactory,
  timeoutMs = CALCULATION_TASK_TIMEOUT_MS
): RunningCalculationTask<T> {
  let worker: Worker;
  try {
    worker = workerFactory();
  } catch {
    return {
      promise: Promise.reject(new CalculationTaskError()),
      cancel: () => undefined
    };
  }
  let settled = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let rejectPromise: (reason: unknown) => void = () => undefined;
  const finish = (): void => {
    settled = true;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    worker.terminate();
  };
  const promise = new Promise<CalculationResult<T>>((resolve, reject) => {
    rejectPromise = reject;
    worker.onmessage = (event: MessageEvent<CalculationWorkerResponse<T>>) => {
      if (settled) return;
      const response = event.data;
      if (!response || response.kind !== request.kind || !response.ok) {
        finish();
        reject(new CalculationTaskError());
        return;
      }
      finish();
      resolve(response.result);
    };
    worker.onerror = () => {
      if (settled) return;
      finish();
      reject(new CalculationTaskError());
    };
    const boundedTimeoutMs =
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : CALCULATION_TASK_TIMEOUT_MS;
    timeoutId = setTimeout(() => {
      if (settled) return;
      finish();
      reject(new CalculationTaskError());
    }, boundedTimeoutMs);
    try {
      worker.postMessage(request);
    } catch {
      finish();
      reject(new CalculationTaskError());
    }
  });

  return {
    promise,
    cancel() {
      if (settled) return;
      finish();
      rejectPromise(new CalculationTaskCancelledError());
    }
  };
}

export function startMeasuredCalculationTask<T extends CalculationRequest>(
  request: T,
  workerFactory: WorkerFactory = defaultWorkerFactory,
  timeoutMs = CALCULATION_TASK_TIMEOUT_MS,
  now: () => number = absoluteNow
): RunningMeasuredCalculationTask<T> {
  const workerCreateStartedAtMs = now();
  let worker: Worker;
  try {
    worker = workerFactory();
  } catch {
    return {
      promise: Promise.reject(new CalculationTaskError()),
      cancel: () => undefined
    };
  }
  const workerCreateFinishedAtMs = now();
  let requestPostStartedAtMs = workerCreateFinishedAtMs;
  let requestPostFinishedAtMs = workerCreateFinishedAtMs;
  let settled = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let rejectPromise: (reason: unknown) => void = () => undefined;
  const finish = (): void => {
    settled = true;
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    worker.terminate();
  };
  const promise = new Promise<MeasuredCalculationTaskResult<T>>((resolve, reject) => {
    rejectPromise = reject;
    worker.onmessage = (event: MessageEvent<CalculationWorkerMeasurementResponse<T>>) => {
      if (settled) return;
      const receivedAtMs = now();
      const measured = event.data;
      const response = measured?.response;
      if (
        !measured ||
        measured.type !== CALCULATION_WORKER_MEASUREMENT_TYPE ||
        measured.kind !== request.kind ||
        !response ||
        response.kind !== request.kind ||
        !response.ok
      ) {
        finish();
        reject(new CalculationTaskError());
        return;
      }
      const workerTiming = measured.timing;
      const clockAligned =
        workerTiming.receivedAtMs >= requestPostFinishedAtMs - 1 &&
        workerTiming.startedAtMs >= workerTiming.receivedAtMs - 1 &&
        workerTiming.finishedAtMs >= workerTiming.startedAtMs - 1 &&
        receivedAtMs >= workerTiming.finishedAtMs - 1;
      const timing: CalculationTaskMeasurement = {
        workerCreateMs: nonNegativeDuration(workerCreateFinishedAtMs, workerCreateStartedAtMs),
        requestPostMs: nonNegativeDuration(requestPostFinishedAtMs, requestPostStartedAtMs),
        startupAndRequestDeliveryMs: nonNegativeDuration(
          workerTiming.receivedAtMs,
          requestPostFinishedAtMs
        ),
        workerQueueMs: nonNegativeDuration(workerTiming.startedAtMs, workerTiming.receivedAtMs),
        executionMs: nonNegativeDuration(workerTiming.finishedAtMs, workerTiming.startedAtMs),
        responseDeliveryMs: nonNegativeDuration(receivedAtMs, workerTiming.finishedAtMs),
        totalMs: nonNegativeDuration(receivedAtMs, workerCreateStartedAtMs),
        clockAligned
      };
      finish();
      resolve({ result: response.result, timing });
    };
    worker.onerror = () => {
      if (settled) return;
      finish();
      reject(new CalculationTaskError());
    };
    const boundedTimeoutMs =
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : CALCULATION_TASK_TIMEOUT_MS;
    timeoutId = setTimeout(() => {
      if (settled) return;
      finish();
      reject(new CalculationTaskError());
    }, boundedTimeoutMs);
    try {
      requestPostStartedAtMs = now();
      worker.postMessage({ type: CALCULATION_WORKER_MEASUREMENT_TYPE, request });
      requestPostFinishedAtMs = now();
    } catch {
      finish();
      reject(new CalculationTaskError());
    }
  });

  return {
    promise,
    cancel() {
      if (settled) return;
      finish();
      rejectPromise(new CalculationTaskCancelledError());
    }
  };
}

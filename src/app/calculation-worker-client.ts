import type {
  CalculationRequest,
  CalculationResult,
  CalculationWorkerResponse
} from "./calculation-task";

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

type WorkerFactory = () => Worker;

function defaultWorkerFactory(): Worker {
  return new Worker(new URL("./calculation-worker.ts", import.meta.url), { type: "module" });
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

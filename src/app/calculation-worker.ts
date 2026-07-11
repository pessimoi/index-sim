import {
  executeCalculationTask,
  type CalculationRequest,
  type CalculationWorkerResponse
} from "./calculation-task";

interface CalculationWorkerScope {
  onmessage: ((event: MessageEvent<CalculationRequest>) => void) | null;
  postMessage(message: CalculationWorkerResponse): void;
}

const workerScope = globalThis as unknown as CalculationWorkerScope;

workerScope.onmessage = (event) => {
  const request = event.data;
  try {
    workerScope.postMessage({
      ok: true,
      kind: request.kind,
      result: executeCalculationTask(request)
    } as CalculationWorkerResponse);
  } catch {
    workerScope.postMessage({ ok: false, kind: request.kind, error: "calculation_failed" });
  }
};

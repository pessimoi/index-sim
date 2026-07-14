import {
  executeCalculationWorkerInput,
  type CalculationWorkerInput,
  type CalculationWorkerOutput
} from "./calculation-task";

interface CalculationWorkerScope {
  onmessage: ((event: MessageEvent<CalculationWorkerInput>) => void) | null;
  postMessage(message: CalculationWorkerOutput): void;
}

const workerScope = globalThis as unknown as CalculationWorkerScope;
const absoluteNow = (): number => performance.timeOrigin + performance.now();

workerScope.onmessage = (event) => {
  workerScope.postMessage(executeCalculationWorkerInput(event.data, absoluteNow));
};

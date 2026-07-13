import { useEffect, useRef, useState } from "react";
import { loadScheduledStaticPriceSnapshot } from "@/adapters/market";
import { loadSelectedPriceSet } from "../state/selected-price-set";
import {
  runRuntimeBootstrap,
  runtimeBootstrapFailureState,
  type RuntimeBootstrapDependencies,
  type RuntimeBootstrapInput,
  type RuntimeBootstrapState
} from "./runtime-bootstrap";

const DEFAULT_RUNTIME_BOOTSTRAP_DEPENDENCIES: RuntimeBootstrapDependencies = {
  loadGeneratedRuntimeContext: async () => {
    const { loadGeneratedRuntimeContext } = await import("@/adapters/generated");
    return loadGeneratedRuntimeContext();
  },
  loadSelectedPriceSet,
  loadScheduledStaticPriceSnapshot
};

export function useRuntimeBootstrap(
  input: RuntimeBootstrapInput,
  options: { dependencies?: RuntimeBootstrapDependencies } = {}
): RuntimeBootstrapState {
  const initialRunRef = useRef({
    input,
    dependencies: options.dependencies ?? DEFAULT_RUNTIME_BOOTSTRAP_DEPENDENCIES
  });
  const [state, setState] = useState<RuntimeBootstrapState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const initialRun = initialRunRef.current;
    void runRuntimeBootstrap(initialRun.input, initialRun.dependencies, {
      isCancelled: () => cancelled
    })
      .then((nextState) => {
        if (!cancelled) setState(nextState);
      })
      .catch(() => {
        if (!cancelled) setState(runtimeBootstrapFailureState());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

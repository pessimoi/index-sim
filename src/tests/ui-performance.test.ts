import { performance } from "node:perf_hooks";
import { loadBundledLegacyContext } from "../adapters/browser";
import { DEFAULT_FORM_STATE, type CombatSetupFormState } from "../app/state/ui-state";
import {
  createCompareRows,
  createPlannerViewModel,
  createSimulationViewModel
} from "../app/view-models/simulation";
import type { SimulationContext } from "../domain/shared";

function levelVariant(index: number): CombatSetupFormState {
  return {
    ...DEFAULT_FORM_STATE,
    levels: {
      ...DEFAULT_FORM_STATE.levels,
      attack: Math.min(99, DEFAULT_FORM_STATE.levels.attack + index),
      strength: Math.min(99, DEFAULT_FORM_STATE.levels.strength + index)
    }
  };
}

function measureMs(work: () => void): number {
  const started = performance.now();
  work();
  return performance.now() - started;
}

describe("rewrite UI performance smoke", () => {
  let context: SimulationContext;

  beforeAll(async () => {
    const loaded = await loadBundledLegacyContext();
    context = loaded.context;
  });

  it("keeps the immediate level-input calculation path small", () => {
    const forms = Array.from({ length: 12 }, (_, index) => levelVariant(index));
    const immediateMs = measureMs(() => {
      for (const form of forms) createSimulationViewModel(form, context);
    });
    const immediateAverageMs = immediateMs / forms.length;

    expect(immediateAverageMs).toBeLessThan(75);
  });

  it("documents compare and planner as heavy deferred work", () => {
    const forms = [levelVariant(0), levelVariant(1)];
    const immediateMs = measureMs(() => {
      for (const form of forms) createSimulationViewModel(form, context);
    });
    const fullPanelMs = measureMs(() => {
      for (const form of forms) {
        createSimulationViewModel(form, context);
        createCompareRows(form, context, 8);
        createPlannerViewModel(form, context);
      }
    });

    expect(fullPanelMs).toBeGreaterThan(immediateMs * 3);
  }, 15_000);
});

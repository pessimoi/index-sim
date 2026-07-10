import { loadBundledLegacyContext } from "../adapters/browser";
import { createDuelSnapshot } from "../app/state/duel-snapshots";
import { DEFAULT_FORM_STATE, type CombatSetupFormState } from "../app/state/ui-state";
import {
  createCompareRows,
  createDuelMatrixViewModel,
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

function measureCpuMs(work: () => void): number {
  const started = process.cpuUsage();
  work();
  const elapsed = process.cpuUsage(started);
  return (elapsed.user + elapsed.system) / 1_000;
}

describe("rewrite UI performance smoke", () => {
  let context: SimulationContext;

  beforeAll(async () => {
    const loaded = await loadBundledLegacyContext();
    context = loaded.context;
  });

  it("keeps the immediate level-input calculation path small", () => {
    const forms = Array.from({ length: 12 }, (_, index) => levelVariant(index));
    const immediateMs = measureCpuMs(() => {
      for (const form of forms) createSimulationViewModel(form, context);
    });
    const immediateAverageMs = immediateMs / forms.length;

    expect(immediateAverageMs).toBeLessThan(75);
  });

  it("documents compare and planner as heavy deferred work", () => {
    const forms = [levelVariant(0), levelVariant(1)];
    const immediateMs = measureCpuMs(() => {
      for (const form of forms) createSimulationViewModel(form, context);
    });
    const fullPanelMs = measureCpuMs(() => {
      for (const form of forms) {
        createSimulationViewModel(form, context);
        createCompareRows(form, context, 8);
        createPlannerViewModel(form, context);
      }
    });

    expect(fullPanelMs).toBeGreaterThan(immediateMs * 3);
  }, 15_000);

  it("keeps the explicitly requested maximum-size Duel matrix bounded", () => {
    const snapshots = Array.from({ length: 12 }, (_, index) =>
      createDuelSnapshot(`matrix-${index}`, `Matrix ${index + 1}`, levelVariant(index))
    );
    let cellCount = 0;
    const matrixMs = measureCpuMs(() => {
      cellCount = createDuelMatrixViewModel(DEFAULT_FORM_STATE, { snapshots }, context).cellCount;
    });

    expect(cellCount).toBe(Object.keys(context.gameData.monsters).length * 13);
    expect(matrixMs).toBeLessThan(12_000);
  }, 20_000);
});

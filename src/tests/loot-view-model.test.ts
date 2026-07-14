import { loadBundledLegacyContext } from "../adapters/legacy-runtime";
import { simulateFullSimulation } from "../domain/simulation";
import { DEFAULT_FORM_STATE, formToSimulationRequest } from "../app/state/ui-state";
import { createFullSimulationInput } from "../app/view-models/simulation-input";
import {
  createLootPresentationViewModel,
  optimizeLootPrefsForMonster
} from "../app/view-models/loot";
import type { ItemPriceHistoryContext } from "../app/view-models/price-data";

async function fixture(
  options: {
    lootPrefs?: Record<string, string>;
    history?: Record<string, ItemPriceHistoryContext>;
    settings?: Record<
      string,
      { highAlch?: boolean; overheadSec: number | null; talismanSpot: "underground" | "overground" }
    >;
  } = {}
) {
  const { context } = await loadBundledLegacyContext();
  const form = DEFAULT_FORM_STATE;
  const request = formToSimulationRequest(form, context.gameData);
  const fullInput = createFullSimulationInput(form, request, {}, options.settings ?? {});
  const result = simulateFullSimulation(
    { ...fullInput, lootPrefs: options.lootPrefs ?? {} },
    context
  );
  return createLootPresentationViewModel({
    form,
    context,
    tripInput: { ...fullInput, combat: result.combat },
    trip: result.trip,
    lootPrefs: options.lootPrefs ?? {},
    lootSettingsByMonster: options.settings,
    lootPriceHistoryByItem: options.history
  });
}

describe("Loot view model", () => {
  it("owns row partitions, policy presentation and summary composition", async () => {
    const presentation = await fixture();

    expect(presentation.rows.length).toBeGreaterThan(0);
    expect(presentation.actionableRows.length + presentation.conditionalRows.length).toBe(
      presentation.rows.length
    );
    expect(presentation.actionableRows.every((row) => row.eligibilityDescription === null)).toBe(
      true
    );
    expect(presentation.conditionalRows.every((row) => row.eligibilityDescription !== null)).toBe(
      true
    );
    expect(presentation.policySummary).toMatch(/^High alch (on|off) · 0 row choices$/);
    expect(presentation.summary.valueComposition.displayedGpPerKill).toBeTypeOf("number");
    expect(presentation.summary.overrideCount).toBe(0);
  });

  it("keeps settings precedence and local price-history context in the direct owner", async () => {
    const base = await fixture();
    const tracked = base.rows.find((row) => row.key !== null);
    expect(tracked).toBeDefined();
    const history = {
      [tracked!.key!]: {
        itemId: tracked!.key!,
        itemLabel: tracked!.name,
        latestPrice: 120,
        baselinePrice: 100,
        gpDelta: 20,
        percentDelta: 20,
        latestLabel: "Latest",
        baselineLabel: "Baseline"
      }
    };
    const presentation = await fixture({
      history,
      settings: {
        [DEFAULT_FORM_STATE.monsterId]: {
          highAlch: true,
          overheadSec: 3.5,
          talismanSpot: "overground"
        }
      }
    });
    const row = presentation.rows.find((candidate) => candidate.rowId === tracked!.rowId);

    expect(presentation.highAlchEnabled).toBe(true);
    expect(presentation.overheadMode).toBe("manual");
    expect(presentation.overheadValue).toBe(3.5);
    expect(row?.historyContext).toMatchObject({
      tracked: true,
      latestPrice: 120,
      baselinePrice: 100,
      gpDelta: 20,
      percentDelta: 20
    });
  });

  it("keeps the optimizer deterministic behind the Loot owner", async () => {
    const { context } = await loadBundledLegacyContext();
    const first = optimizeLootPrefsForMonster(DEFAULT_FORM_STATE, context);
    const second = optimizeLootPrefsForMonster(DEFAULT_FORM_STATE, context);

    expect(second).toEqual(first);
    expect(first.effectiveNetGpPerHour).toBeGreaterThanOrEqual(first.baseEffectiveNetGpPerHour);
    expect(first.changedRows).toBe(Object.keys(first.prefs).length);
  });
});

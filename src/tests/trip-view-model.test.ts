import { loadCurrentTestContext } from "./helpers/current-sim";
import { DEFAULT_FORM_STATE, normalizeFormState } from "../app/state/ui-state";
import { createSimulationViewModel } from "../app/view-models/simulation";
import { createTripPaneViewModel } from "../app/view-models/trip";

describe("Trip view model", () => {
  it("owns the exact group order, quick summaries and negative-economy predicate", async () => {
    const { context } = await loadCurrentTestContext();
    const simulation = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const presentation = createTripPaneViewModel({
      form: DEFAULT_FORM_STATE,
      result: simulation.trip
    });

    expect(presentation.groups.map((group) => group.title)).toEqual([
      "Survival",
      "Prayer",
      "Food",
      "Inventory reserve",
      "Potions",
      "Scarce cap",
      "Recoil",
      "Outcome"
    ]);
    expect(presentation.groups.at(-1)?.items.map((item) => item.label)).toEqual([
      "Bank time",
      "Kills/trip",
      "Trip length",
      "Effective kills/hr",
      "Supply/kill",
      "Ammo/kill",
      "Effective net GP/hr"
    ]);
    expect(presentation.potionCarrySummary).toMatch(/(vials|doses)\/type$/);
    expect(presentation.supplyGapPerKill).toBe(
      simulation.trip.supply.supplyCostPerKill - simulation.trip.gpPerKill
    );
  });

  it("derives manual modes and mutually exclusive prayer controls from form truth", async () => {
    const { context } = await loadCurrentTestContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      combatStyle: "magic",
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        bankSeconds: 45,
        foodCount: 12,
        foodPerKillOverride: 1.25,
        prayerMode: "potions",
        prayerPotionSets: null,
        prayerPotionDoses: 9,
        altarSeconds: null
      }
    });
    const simulation = createSimulationViewModel(form, context);
    const presentation = createTripPaneViewModel({ form, result: simulation.trip });

    expect(presentation.controls).toMatchObject({
      bankTimeMode: "manual",
      bankSecondsValue: 45,
      foodCountMode: "manual",
      foodCountValue: 12,
      foodPerKillOverrideMode: "on",
      foodPerKillOverrideValue: 1.25,
      prayerRestoreMode: "manual_doses",
      prayerRestoreValue: 9,
      runeSlotsApplies: true,
      recoverAmmoApplies: false
    });
  });

  it("keeps recommendation presentation and non-finite fallbacks DOM-free", async () => {
    const { context } = await loadCurrentTestContext();
    const simulation = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const result = {
      ...simulation.trip,
      trip: {
        ...simulation.trip.trip,
        maxKillsPrayer: Number.POSITIVE_INFINITY,
        tripMinutes: Number.POSITIVE_INFINITY
      }
    };
    const presentation = createTripPaneViewModel({ form: DEFAULT_FORM_STATE, result });
    const prayer = presentation.groups.find((group) => group.title === "Prayer");
    const outcome = presentation.groups.find((group) => group.title === "Outcome");

    expect(prayer?.items.find((item) => item.label === "Max kills prayer")?.value).toBe("-");
    expect(outcome?.items.find((item) => item.label === "Trip length")?.value).toBe("-");
    expect(presentation.recommendation.statusLabel).toBeTruthy();
    expect(presentation.recommendation.patch).toEqual(
      DEFAULT_FORM_STATE.trip.singleDose
        ? { potionDoses: simulation.trip.potionRecommendation.recommendedDoses }
        : { potionSets: simulation.trip.potionRecommendation.recommendedVials }
    );
  });
});

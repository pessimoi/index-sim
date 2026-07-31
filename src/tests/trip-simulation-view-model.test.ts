import {
  DEFAULT_FORM_STATE,
  createSimulationViewModel,
  formToSimulationRequest,
  formToTripPolicy,
  formatNumber,
  loadCurrentTestContext,
  normalizeFormState,
  rangedDagannothForm,
  rangedRockCrabForm,
  switchCombatStyleLoadout
} from "./ui-view-model-fixture";
import type { CombatSetupFormState } from "./ui-view-model-fixture";

describe("rewrite UI view models", () => {
  it("maps extended trip controls to the domain policy without leaking into SimulationRequest", async () => {
    const { context } = await loadCurrentTestContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        altarSeconds: 45,
        antifire: true,
        antipoison: true,
        bankSeconds: null,
        dbaRestore: false,
        foodCount: 12,
        foodPerKillOverride: 1.5,
        potionDoses: 7,
        potionSets: 2,
        prayerPotionDoses: 6,
        prayerPotionSets: 2,
        protect: "missiles",
        recoilRings: 4,
        runeSlots: 3,
        safespot: true,
        scarceSpot: true,
        singleDose: true,
        targetsAtSpot: 2,
        respawnSeconds: 45
      }
    };
    const request = formToSimulationRequest(form);
    const trip = formToTripPolicy(form);

    expect(request).not.toHaveProperty("trip");
    expect(context.gameData.monsters[request.monsterId]).toBeDefined();
    expect(trip).toMatchObject({
      antifire: true,
      antipoison: true,
      bankSeconds: null,
      dbaRestore: false,
      foodCount: 12,
      foodPerKillOverride: 1.5,
      potionDoses: 7,
      potionSets: 2,
      prayerPotionDoses: 6,
      protect: "missiles",
      recoilRings: 4,
      runeSlots: 3,
      safespot: true,
      scarceSpot: true,
      singleDose: true,
      targetsAtSpot: 2,
      respawnSeconds: 45
    });
    expect(trip.prayerPotionSets).toBeUndefined();
    expect(trip.altarSeconds).toBeUndefined();
  });

  it("maps forced-off safespot and protection choices to TripPolicy", () => {
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        antifire: true,
        antipoison: true,
        protect: "magic",
        safespot: false
      }
    };
    const trip = formToTripPolicy(form);

    expect(trip).toMatchObject({
      antifire: true,
      antipoison: true,
      protect: "magic",
      safespot: false
    });
  });

  it("applies manual food count and food-per-kill override to the trip view model", async () => {
    const { context } = await loadCurrentTestContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        foodCount: 1,
        foodPerKillOverride: 1
      }
    };
    const result = createSimulationViewModel(form, context);

    expect(result.trip.trip.foodPerKill).toBe(1);
    expect(result.trip.trip.slots.foodCount).toBe(1);
    expect(result.trip.trip.slots.autoFoodCount).toBeGreaterThanOrEqual(1);
    expect(result.trip.trip.killsPerTrip).toBe(1);
  });

  it("applies recoil ring count when ring of recoil is equipped", async () => {
    const { context } = await loadCurrentTestContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      monsterId: "firegiant",
      gear: {
        ...DEFAULT_FORM_STATE.gear,
        ring: "ring_of_recoil"
      },
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        foodKey: "lobster",
        protect: "none",
        recoilRings: 3,
        safespot: false
      }
    };
    const result = createSimulationViewModel(form, context);

    expect(result.trip.trip.recoilOn).toBe(true);
    expect(result.trip.trip.recoilRings).toBe(3);
    expect(result.trip.trip.recoilSpares).toBe(2);
    expect(result.trip.trip.recoilDmgPerKill).toBeGreaterThan(0);
  });

  it("keeps null trip controls on domain defaults", () => {
    const trip = formToTripPolicy(DEFAULT_FORM_STATE);

    expect(trip.bankSeconds).toBeNull();
    expect(trip.safespot).toBeUndefined();
    expect(trip.foodCount).toBeUndefined();
    expect(trip.foodPerKillOverride).toBeUndefined();
    expect(trip.potionSets).toBe(1);
    expect(trip.potionDoses).toBe(4);
    expect(trip.singleDose).toBe(false);
    expect(trip.dbaRestore).toBe(true);
    expect(trip.runeSlots).toBe(2);
    expect(trip.prayerPotionSets).toBeUndefined();
    expect(trip.prayerPotionDoses).toBeUndefined();
    expect(trip.altarSeconds).toBeUndefined();
    expect(trip.scarceSpot).toBe(false);
    expect(trip.targetsAtSpot).toBeUndefined();
    expect(trip.respawnSeconds).toBeUndefined();
    expect(trip.protect).toBe("none");
    expect(trip.recoilRings).toBe(1);
  });

  it("applies scarce spot controls to the trip view model", async () => {
    const { context } = await loadCurrentTestContext();
    const form: CombatSetupFormState = {
      ...rangedRockCrabForm(),
      trip: {
        ...rangedRockCrabForm().trip,
        teleport: true,
        scarceSpot: true,
        targetsAtSpot: 1,
        respawnSeconds: 60
      }
    };
    const baseline = createSimulationViewModel(rangedRockCrabForm(), context);
    const scarce = createSimulationViewModel(form, context);

    expect(scarce.trip.trip.scarce.enabled).toBe(true);
    expect(scarce.trip.trip.scarce.respawnBound).toBe(true);
    expect(scarce.trip.effectiveKph).toBeLessThan(baseline.trip.effectiveKph);
    expect(scarce.trip.effectiveGpPerHour).toBeLessThan(baseline.trip.effectiveGpPerHour);
    expect(scarce.trip.trip.slots.reserveParts).toContain("teleport");
  });

  it("applies potion, auto-bank and reserve defaults to the trip view model", async () => {
    const { context } = await loadCurrentTestContext();
    const magicForm = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "magic"),
      boosts: ["magic"],
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        bankSeconds: null,
        potionDoses: 6,
        potionSets: 3,
        prayerMode: "none",
        runeSlots: 4,
        singleDose: true
      }
    });
    const dbaRestoreForm: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      boosts: ["dba_spec"],
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        dbaRestore: true
      }
    };
    const dbaNoRestoreForm: CombatSetupFormState = {
      ...dbaRestoreForm,
      trip: {
        ...dbaRestoreForm.trip,
        dbaRestore: false
      }
    };

    const magic = createSimulationViewModel(magicForm, context);
    const dbaRestore = createSimulationViewModel(dbaRestoreForm, context);
    const dbaNoRestore = createSimulationViewModel(dbaNoRestoreForm, context);

    expect(magic.trip.trip.bankSeconds).toBe(90);
    expect(magic.trip.trip.singleDose).toBe(true);
    expect(magic.trip.trip.slots.potionDoses).toBe(6);
    expect(magic.trip.trip.slots.potionSets).toBe(3);
    expect(magic.trip.trip.slots.reserveParts).toContain("4 combat-rune");
    expect(dbaRestore.trip.trip.slots.reserveParts).toContain("restore vial");
    expect(dbaRestore.trip.trip.slots.potionParts).toContain("1 restore");
    expect(dbaNoRestore.trip.trip.slots.reserveParts).not.toContain("restore vial");
    expect(dbaNoRestore.trip.trip.slots.potionParts).not.toContain("1 restore");
  });

  it("exposes potion carry recommendation without adding it to SimulationRequest", async () => {
    const { context } = await loadCurrentTestContext();
    const vialMode = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        trip: { ...DEFAULT_FORM_STATE.trip, potionSets: 0, singleDose: false }
      },
      context
    );
    const singleDoseMode = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        trip: { ...DEFAULT_FORM_STATE.trip, potionDoses: 0, singleDose: true }
      },
      context
    );
    const noBoost = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        boosts: ["none"],
        trip: { ...DEFAULT_FORM_STATE.trip, potionSets: 0, singleDose: false }
      },
      context
    );
    const sustainedOff = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        sustained: false,
        trip: { ...DEFAULT_FORM_STATE.trip, potionSets: 0, singleDose: false }
      },
      context
    );

    expect(vialMode.request).not.toHaveProperty("potionRecommendation");
    expect(vialMode.trip.potionRecommendation).toMatchObject({
      active: true,
      status: "under",
      canApply: true,
      recommendedVials: 1,
      matched: false
    });
    expect(singleDoseMode.trip.potionRecommendation).toMatchObject({
      active: true,
      status: "under",
      canApply: true,
      recommendedDoses: 1,
      matched: false
    });
    expect(noBoost.trip.potionRecommendation).toMatchObject({
      active: false,
      status: "no-boost",
      canApply: false,
      recommendedVials: 0,
      recommendedDoses: 0
    });
    expect(sustainedOff.trip.potionRecommendation).toMatchObject({
      active: false,
      status: "inactive",
      canApply: false
    });
  });

  it("maps prayer restore detail controls only for the active restore mode", () => {
    const manualVials = formToTripPolicy({
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        prayerMode: "potions",
        prayerPotionSets: 3,
        prayerPotionDoses: null,
        altarSeconds: 45
      }
    });
    const manualDoses = formToTripPolicy({
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        prayerMode: "potions",
        prayerPotionSets: null,
        prayerPotionDoses: 10
      }
    });
    const altar = formToTripPolicy({
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        prayerMode: "altar",
        prayerPotionSets: 3,
        prayerPotionDoses: 10,
        altarSeconds: 45
      }
    });
    const flick = formToTripPolicy({
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        prayerMode: "none",
        prayerPotionSets: 3,
        prayerPotionDoses: 10,
        altarSeconds: 45
      }
    });

    expect(manualVials.prayerPotionSets).toBe(3);
    expect(manualVials.prayerPotionDoses).toBeUndefined();
    expect(manualVials.altarSeconds).toBeUndefined();
    expect(manualDoses.prayerPotionDoses).toBe(10);
    expect(manualDoses.prayerPotionSets).toBeUndefined();
    expect(altar.altarSeconds).toBe(45);
    expect(altar.prayerPotionSets).toBeUndefined();
    expect(altar.prayerPotionDoses).toBeUndefined();
    expect(flick.prayerMode).toBe("none");
    expect(flick.prayerPotionSets).toBeUndefined();
    expect(flick.prayerPotionDoses).toBeUndefined();
    expect(flick.altarSeconds).toBeUndefined();
  });

  it("applies manual prayer restore controls to the trip view model", async () => {
    const { context } = await loadCurrentTestContext();
    const auto = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const manualDoses = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        trip: {
          ...DEFAULT_FORM_STATE.trip,
          prayerMode: "potions",
          prayerPotionSets: null,
          prayerPotionDoses: 8
        }
      },
      context
    );
    const altar = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        trip: {
          ...DEFAULT_FORM_STATE.trip,
          prayerMode: "altar",
          prayerPotionSets: null,
          prayerPotionDoses: null,
          altarSeconds: 45
        }
      },
      context
    );

    expect(manualDoses.trip.trip.prayerSlots).toBe(2);
    expect(manualDoses.trip.trip.maxKillsPrayer).toBeGreaterThan(auto.trip.trip.maxKillsPrayer);
    expect(altar.trip.trip.altarOn).toBe(true);
    expect(altar.trip.trip.altarSeconds).toBe(45);
    expect(altar.trip.trip.altarSecPerKill).toBeGreaterThan(0);
    expect(altar.trip.trip.prayerActive).toBe(false);
  });

  it("builds the Stats Trip and banking summary from the trip result", async () => {
    const { context } = await loadCurrentTestContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        bankSeconds: 150,
        safespot: false,
        protect: "melee"
      }
    });
    const result = createSimulationViewModel(form, context);
    const rows = new Map(result.tripBankingSummary.rows.map((row) => [row.id, row]));
    const expectedBound = result.trip.trip.scarce.respawnBound
      ? "respawn-bound"
      : result.trip.trip.bound;

    expect(rows.get("kills-trip")).toMatchObject({
      label: "Kills/trip",
      value: formatNumber(result.trip.trip.killsPerTrip, 1),
      numericValue: result.trip.trip.killsPerTrip
    });
    expect(rows.get("trip-length")).toMatchObject({
      label: "Trip length",
      numericValue: result.trip.trip.tripMinutes
    });
    expect(rows.get("bank-time")).toMatchObject({
      label: "Bank time",
      value: "150 s",
      numericValue: 150
    });
    expect(rows.get("effective-kills-hour")?.numericValue).toBe(result.trip.effectiveKph);
    expect(rows.get("supply-kill")?.numericValue).toBe(result.trip.supply.supplyCostPerKill);
    expect(rows.get("net-gp-hour")?.numericValue).toBe(result.trip.effectiveNetGpPerHour);
    expect(rows.get("trip-bound")?.value).toBe(expectedBound);
    expect(rows.get("safespot-state")?.value).toBe("Off");
    expect(rows.get("protection-state")?.label).toBe("Protection prayer");
    expect(rows.get("protection-state")?.value).toContain("active");
    expect(rows.get("incoming-model")).toMatchObject({
      label: "Incoming model",
      value: result.trip.trip.incoming.descriptor.sourceLabel
    });
  }, 15_000);

  it("applies per-monster cannon settings to visible rates", async () => {
    const { context } = await loadCurrentTestContext();
    const form = rangedDagannothForm();
    const withoutCannon = createSimulationViewModel(form, context);
    const withCannon = createSimulationViewModel(form, context, {
      dagannoth: { enabled: true, targets: 6, respawnSec: 30 }
    });

    expect(withoutCannon.trip.cannon).toBeNull();
    expect(withCannon.trip.cannon).not.toBeNull();
    expect(withCannon.cannonEffectiveXpPerHour).toBeGreaterThan(0);
    expect(withCannon.effectiveXpPerHour).toBeGreaterThan(withoutCannon.effectiveXpPerHour);
    expect(withCannon.trip.killsPerHour).toBeGreaterThan(withoutCannon.trip.killsPerHour);
    expect(withCannon.trip.gpPerHour).toBeGreaterThan(withoutCannon.trip.gpPerHour);
    expect(withCannon.trip.supply.supplyCostPerKill).toBeGreaterThan(
      withoutCannon.trip.supply.supplyCostPerKill
    );
    expect(withCannon.trip.effectiveNetGpPerHour).not.toBe(
      withoutCannon.trip.effectiveNetGpPerHour
    );
  });

  it("keeps cannon output and linked sparse trip assumptions in one view model", async () => {
    const { context } = await loadCurrentTestContext();
    const form: CombatSetupFormState = {
      ...rangedDagannothForm(),
      trip: {
        ...rangedDagannothForm().trip,
        scarceSpot: true,
        targetsAtSpot: 6,
        respawnSeconds: 30
      }
    };
    const result = createSimulationViewModel(form, context, {
      dagannoth: { enabled: true, targets: 6, respawnSec: 30 }
    });

    expect(result.trip.cannon).not.toBeNull();
    expect(result.trip.cannon?.targets).toBe(6);
    expect(result.trip.cannon?.respawnSec).toBe(30);
    expect(result.trip.trip.scarce.enabled).toBe(true);
    expect(result.trip.trip.scarce.targetsAtSpot).toBe(6);
    expect(result.trip.trip.scarce.respawnSeconds).toBe(30);
    expect(result.trip.trip.slots.reserveParts).toEqual(
      expect.arrayContaining(["cannon (4 parts)", "cannonballs"])
    );
    expect(result.cannonEffectiveXpPerHour).toBeGreaterThan(0);
    expect(result.trip.supply.ballCostPerKill).toBeGreaterThan(0);
  });
});

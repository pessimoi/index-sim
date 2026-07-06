import fixtureSet from "./fixtures/legacy-golden.json";
import { loadBundledLegacyContext } from "../adapters/browser";
import {
  DEFAULT_FORM_STATE,
  applyWeaponSelection,
  formToSimulationRequest,
  formToTripPolicy,
  normalizeFormState,
  setCustomSetupForMonster,
  switchCombatStyleLoadout,
  type CombatSetupFormState
} from "../app/state/ui-state";
import {
  DEFAULT_DENSE_COMPARE_STATE,
  DEFAULT_DENSE_COMPARE_SORT_STATE
} from "../app/state/dense-compare";
import {
  ammoOptions,
  createCompareRows,
  createDenseCompareRows,
  createPlannerViewModel,
  createSimulationViewModel,
  equipmentSlotOptions,
  optimizeLootPrefsForMonster,
  spellOptions,
  sortDenseCompareRows,
  weaponOptions
} from "../app/view-models/simulation";

interface GoldenFixture {
  tolerances: {
    defaultNumericAbs: number;
  };
  cases: Array<{
    id: string;
    expected: Record<string, unknown>;
  }>;
}

const fixtures = fixtureSet as GoldenFixture;
const fixturesById = new Map(fixtures.cases.map((testCase) => [testCase.id, testCase]));
const numericRoundingGuard = 0.000000001;

function stableNumber(value: number): number {
  return Number(value.toFixed(6));
}

function expectCloseToFixture(actual: number, expected: unknown): void {
  expect(typeof expected).toBe("number");
  expect(Math.abs(stableNumber(actual) - (expected as number))).toBeLessThanOrEqual(
    fixtures.tolerances.defaultNumericAbs + numericRoundingGuard
  );
}

function expectedFor(caseId: string): Record<string, unknown> {
  const fixture = fixturesById.get(caseId);
  expect(fixture, `Missing legacy fixture for ${caseId}`).toBeDefined();
  if (!fixture) throw new Error(`Missing legacy fixture for ${caseId}`);
  return fixture.expected;
}

function rangedRockCrabForm(): CombatSetupFormState {
  return {
    ...DEFAULT_FORM_STATE,
    combatStyle: "ranged",
    monsterId: "rock_crab",
    weaponId: "magic_shortbow",
    ammoId: "mith_arrow",
    styleId: "rapid",
    levels: {
      attack: 40,
      strength: 40,
      defence: 40,
      hitpoints: 50,
      ranged: 60,
      magic: 40,
      prayer: 31
    },
    gear: {
      helm: "archer_helm",
      amulet: "amu_power",
      body: "black_dhide_body",
      legs: "black_dhide_legs",
      shield: "none",
      gloves: "black_vambraces",
      boots: "ranger_boots",
      cape: "cape_legends",
      ring: "none"
    },
    prayers: ["none"],
    boosts: ["none"],
    sustained: false,
    repotThreshold: null,
    ringOfWealth: false,
    trip: {
      ...DEFAULT_FORM_STATE.trip,
      foodKey: "none",
      teleport: false,
      bankSeconds: 0,
      prayerMode: "none",
      alching: false,
      recoverAmmo: true,
      antifire: false,
      antipoison: false
    }
  };
}

function rangedDagannothForm(): CombatSetupFormState {
  return {
    ...rangedRockCrabForm(),
    monsterId: "dagannoth",
    ammoId: "rune_arrow",
    trip: {
      ...rangedRockCrabForm().trip,
      bankSeconds: 150
    }
  };
}

describe("rewrite UI view models", () => {
  it("keeps form state separate from SimulationRequest", async () => {
    const { context } = await loadBundledLegacyContext();
    const request = formToSimulationRequest(DEFAULT_FORM_STATE);

    expect(request.monsterId).toBe(DEFAULT_FORM_STATE.monsterId);
    expect(request).not.toHaveProperty("plannerTargets");
    expect(request).not.toHaveProperty("trip");
    expect(context.gameData.monsters[request.monsterId]).toBeDefined();
  });

  it("builds searchable loadout option view models from the validated game snapshot", async () => {
    const { context } = await loadBundledLegacyContext();

    expect(weaponOptions(context.gameData, "melee")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "dragon_dagger_p", label: "Dragon dagger(p)" })
      ])
    );
    expect(
      weaponOptions(context.gameData, "ranged").find((option) => option.id === "magic_shortbow")
        ?.hint
    ).toContain("2h");
    expect(equipmentSlotOptions(context.gameData, "shield")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "unholy_book",
          label: "Unholy book (Zamorak)",
          hint: expect.stringContaining("stabAtt +8")
        })
      ])
    );
    expect(ammoOptions(context.gameData, "arrow")).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "rune_arrow" })])
    );
    expect(ammoOptions(context.gameData, "arrow")).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "steel_knife" })])
    );
    expect(ammoOptions(context.gameData, "thrown")).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "steel_knife" })])
    );
    expect(spellOptions(context.gameData)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "fire_wave", hint: expect.stringContaining("base") })
      ])
    );
  });

  it("clears and locks shield state when a two-handed weapon is selected", async () => {
    const { context } = await loadBundledLegacyContext();
    const ranged = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged"),
      weaponId: "steel_knife_w",
      ammoId: "none",
      gear: {
        ...DEFAULT_FORM_STATE.gear,
        shield: "unholy_book"
      }
    });

    const bow = applyWeaponSelection(ranged, "magic_shortbow", context.gameData);
    const bowFromThrownAmmo = applyWeaponSelection(
      { ...ranged, ammoId: "steel_knife" },
      "magic_shortbow",
      context.gameData
    );
    const thrown = applyWeaponSelection(
      {
        ...bow,
        gear: { ...bow.gear, shield: "unholy_book" }
      },
      "steel_knife_w",
      context.gameData
    );

    expect(bow.weaponId).toBe("magic_shortbow");
    expect(bow.ammoId).toBe("rune_arrow");
    expect(bow.gear.shield).toBe("none");
    expect(bowFromThrownAmmo.ammoId).toBe("rune_arrow");
    expect(thrown.weaponId).toBe("steel_knife_w");
    expect(thrown.ammoId).toBe("steel_knife");
    expect(thrown.gear.shield).toBe("unholy_book");
  });

  it("builds SimulationRequest from the restored active per-style loadout", async () => {
    const { context } = await loadBundledLegacyContext();
    const melee = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      weaponId: "dragon_dagger_p",
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    });
    const ranged = normalizeFormState({
      ...switchCombatStyleLoadout(melee, "ranged"),
      weaponId: "magic_shortbow",
      ammoId: "mith_arrow",
      specialAttack: { weaponId: "magic_shortbow", ammoId: "mith_arrow" }
    });

    const restoredMelee = switchCombatStyleLoadout(ranged, "melee");
    const meleeRequest = formToSimulationRequest(restoredMelee, context.gameData);
    const restoredRanged = switchCombatStyleLoadout(restoredMelee, "ranged");
    const rangedRequest = formToSimulationRequest(restoredRanged, context.gameData);

    expect(meleeRequest).toMatchObject({
      combatStyle: "melee",
      loadout: { weaponId: "dragon_dagger_p", ammoId: "none" },
      specialAttack: { weaponId: "dragon_dagger_p" }
    });
    expect(rangedRequest).toMatchObject({
      combatStyle: "ranged",
      loadout: { weaponId: "magic_shortbow", ammoId: "mith_arrow" },
      specialAttack: { weaponId: "magic_shortbow", ammoId: "mith_arrow" }
    });
  });

  it("maps restored active gear, ammo and spell selections into SimulationRequest", async () => {
    const { context } = await loadBundledLegacyContext();
    const magic = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "magic"),
      weaponId: "staff_of_fire",
      spellId: "fire_wave",
      gear: {
        ...DEFAULT_FORM_STATE.gear,
        helm: "farseer_helm",
        body: "splitbark_body",
        shield: "unholy_book"
      },
      boosts: ["magic"]
    });
    const ranged = normalizeFormState({
      ...switchCombatStyleLoadout(magic, "ranged"),
      weaponId: "magic_shortbow",
      ammoId: "addy_arrow",
      gear: {
        ...magic.gear,
        body: "black_dhide_body"
      }
    });
    const restoredMagic = switchCombatStyleLoadout(ranged, "magic");
    const request = formToSimulationRequest(restoredMagic, context.gameData);

    expect(request).toMatchObject({
      combatStyle: "magic",
      loadout: {
        weaponId: "staff_of_fire",
        gear: {
          helm: "farseer_helm",
          body: "splitbark_body",
          shield: "unholy_book"
        }
      },
      spellId: "fire_wave",
      boosts: { keys: ["magic"] }
    });
  });

  it("maps manual combat overrides into SimulationRequest and visible combat metrics", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      manualOverrides: {
        accuracyBonus: 350,
        damageBonus: 200,
        attackSpeedSec: 1.2
      }
    };
    const request = formToSimulationRequest(form, context.gameData);
    const derived = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const overridden = createSimulationViewModel(form, context);

    expect(request.manualOverrides).toEqual({
      accuracyBonus: 350,
      damageBonus: 200,
      attackSpeedSec: 1.2
    });
    expect(overridden.combat.debug.accuracyBonus).toBe(350);
    expect(overridden.combat.debug.damageBonus).toBe(200);
    expect(overridden.combat.attackSpeedSec).toBe(1.2);
    expect(overridden.combat.hitChance).toBeGreaterThan(derived.combat.hitChance);
    expect(overridden.combat.maxHit).toBeGreaterThan(derived.combat.maxHit);
    expect(overridden.combat.dps).toBeGreaterThan(derived.combat.dps);
  });

  it("maps extended trip controls to the domain policy without leaking into SimulationRequest", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        altarSeconds: 45,
        antifire: true,
        antipoison: true,
        foodCount: 12,
        foodPerKillOverride: 1.5,
        prayerPotionDoses: 6,
        prayerPotionSets: 2,
        protect: "missiles",
        recoilRings: 4,
        safespot: true,
        scarceSpot: true,
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
      foodCount: 12,
      foodPerKillOverride: 1.5,
      prayerPotionDoses: 6,
      protect: "missiles",
      recoilRings: 4,
      safespot: true,
      scarceSpot: true,
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
    const { context } = await loadBundledLegacyContext();
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
    const { context } = await loadBundledLegacyContext();
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

    expect(trip.safespot).toBeUndefined();
    expect(trip.foodCount).toBeUndefined();
    expect(trip.foodPerKillOverride).toBeUndefined();
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
    const { context } = await loadBundledLegacyContext();
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

  it("maps selected melee special attack into SimulationRequest only when valid", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      weaponId: "dragon_dagger_p",
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    };
    const invalidForm = {
      ...form,
      specialAttack: { weaponId: "magic_shortbow", ammoId: "rune_arrow" }
    };

    expect(formToSimulationRequest(form, context.gameData).specialAttack).toEqual({
      weaponId: "dragon_dagger_p"
    });
    expect(formToSimulationRequest(invalidForm, context.gameData).specialAttack).toBeUndefined();
  });

  it("maps ranged special attack ammo through current valid arrow fallback", async () => {
    const { context } = await loadBundledLegacyContext();
    const thrownMainForm: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      combatStyle: "ranged",
      monsterId: "greater_demon",
      weaponId: "rune_knife_w",
      ammoId: "none",
      styleId: "rapid",
      specialAttack: { weaponId: "magic_shortbow", ammoId: "none" }
    };
    const bowMainForm: CombatSetupFormState = {
      ...thrownMainForm,
      weaponId: "magic_shortbow",
      ammoId: "mith_arrow",
      specialAttack: { weaponId: "magic_shortbow", ammoId: "none" }
    };

    expect(formToSimulationRequest(thrownMainForm, context.gameData).specialAttack).toEqual({
      weaponId: "magic_shortbow",
      ammoId: "rune_arrow"
    });
    expect(formToSimulationRequest(bowMainForm, context.gameData).specialAttack).toEqual({
      weaponId: "magic_shortbow",
      ammoId: "mith_arrow"
    });
  });

  it("exposes special attack metrics in the simulation view model", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      weaponId: "dragon_dagger_p",
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    };
    const result = createSimulationViewModel(form, context);

    expect(result.request.specialAttack).toEqual({ weaponId: "dragon_dagger_p" });
    expect(result.combat.specialAttack).toMatchObject({
      key: "dragon_dagger_p",
      weaponName: "Dragon dagger(p)",
      hits: 2
    });
    expect(result.combat.specialAttack?.maxHit).toBeGreaterThan(0);
    expect(result.combat.specialAttack?.specsPerHour).toBeGreaterThan(0);
    expect(result.combat.effectiveDps).toBe(result.combat.specialAttack?.dpsWithSpec);
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
    const { context } = await loadBundledLegacyContext();
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

  it("builds result, compare and planner models from the domain", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const compareRows = createCompareRows(DEFAULT_FORM_STATE, context, 3);
    const planner = createPlannerViewModel(DEFAULT_FORM_STATE, context);

    expect(result.combat.effectiveDps).toBeGreaterThan(0);
    expect(result.effectiveXpPerHour).toBeGreaterThan(0);
    expect(result.topLoot.length).toBeGreaterThan(0);
    expect(compareRows).toHaveLength(3);
    expect(planner.ok).toBe(true);
    expect(planner.phases.length).toBeGreaterThan(0);
  }, 15_000);

  it("builds full current-monster loot rows with stable duplicate-safe row ids", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      monsterId: "jogre"
    };
    const base = createSimulationViewModel(form, context);
    const bigBonesRows = base.lootRows.filter((row) => row.name.startsWith("Big bones"));
    const skipped = createSimulationViewModel(
      form,
      context,
      {},
      { [bigBonesRows[1]!.rowId]: "skip" }
    );

    expect(base.lootRows.length).toBeGreaterThan(base.topLoot.length);
    expect(bigBonesRows.length).toBeGreaterThanOrEqual(2);
    expect(new Set(bigBonesRows.map((row) => row.rowId)).size).toBe(bigBonesRows.length);
    expect(skipped.request).not.toHaveProperty("lootPrefs");
    expect(skipped.lootRows.find((row) => row.rowId === bigBonesRows[1]!.rowId)?.pref).toBe("skip");
    expect(skipped.lootRows.find((row) => row.rowId === bigBonesRows[0]!.rowId)?.pref).toBe(
      base.lootRows.find((row) => row.rowId === bigBonesRows[0]!.rowId)?.pref
    );
  });

  it("exposes sensible loot actions and per-action net GP/hr impacts", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        alching: true
      }
    };
    const result = createSimulationViewModel(form, context);
    const bones = result.lootRows.find((row) => row.name === "Big bones");
    const herb = result.lootRows.find((row) => row.tag === "herb");
    const gem = result.lootRows.find((row) => row.tag === "gem");
    const alchResult = createSimulationViewModel({ ...form, monsterId: "green_dragon" }, context);
    const alchable = alchResult.lootRows.find((row) => row.availableActions.includes("alch"));

    expect(bones?.availableActions).toEqual(expect.arrayContaining(["loot", "skip", "bury"]));
    expect(herb?.availableActions).toEqual(
      expect.arrayContaining(["loot", "skip", "unid", "value"])
    );
    expect(gem?.availableActions).toEqual(expect.arrayContaining(["loot", "skip", "value"]));
    expect(alchable).toBeDefined();
    expect(alchable?.availableActions).toContain("alch");
    expect(bones?.actionImpacts.length).toBe(bones?.availableActions.length);
    expect(Number.isFinite(bones?.selectedDeltaNetGpPerHour ?? NaN)).toBe(true);
  });

  it("applies per-monster high-alch, overhead and talisman loot settings", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      monsterId: "green_dragon"
    };
    const alchEnabled = createSimulationViewModel(
      form,
      context,
      {},
      {},
      {
        green_dragon: {
          highAlch: true,
          overheadSec: null,
          talismanSpot: "underground"
        }
      }
    );
    const alchable = alchEnabled.lootRows.find((row) => row.availableActions.includes("alch"));
    expect(alchable).toBeDefined();
    if (!alchable) throw new Error("Expected green dragon to have an alchable drop");

    const forcedAlch = createSimulationViewModel(
      form,
      context,
      {},
      { [alchable.rowId]: "alch" },
      {
        green_dragon: {
          highAlch: true,
          overheadSec: null,
          talismanSpot: "underground"
        }
      }
    );
    const alchDisabled = createSimulationViewModel(
      form,
      context,
      {},
      { [alchable.rowId]: "alch" },
      {
        green_dragon: {
          highAlch: false,
          overheadSec: null,
          talismanSpot: "underground"
        }
      }
    );
    const slowOverhead = createSimulationViewModel(
      form,
      context,
      {},
      {},
      {
        green_dragon: {
          highAlch: false,
          overheadSec: 60,
          talismanSpot: "underground"
        }
      }
    );
    const overground = createSimulationViewModel(
      form,
      context,
      {},
      {},
      {
        green_dragon: {
          highAlch: false,
          overheadSec: null,
          talismanSpot: "overground"
        }
      }
    );

    expect(forcedAlch.lootRows.find((row) => row.rowId === alchable.rowId)?.pref).toBe("alch");
    expect(alchDisabled.lootRows.find((row) => row.rowId === alchable.rowId)?.pref).not.toBe(
      "alch"
    );
    expect(forcedAlch.trip.alchCastsPerKill).toBeGreaterThan(alchDisabled.trip.alchCastsPerKill);
    expect(slowOverhead.trip.killsPerHour).toBeLessThan(alchDisabled.trip.killsPerHour);
    expect(overground.trip.gpPerKill).not.toBe(alchDisabled.trip.gpPerKill);
  });

  it("optimizes loot prefs deterministically from canonical defaults", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        alching: true
      }
    };
    const base = createSimulationViewModel(form, context);
    const first = optimizeLootPrefsForMonster(form, context);
    const second = optimizeLootPrefsForMonster(form, context);
    const optimized = createSimulationViewModel(form, context, {}, first.prefs);

    expect(first).toEqual(second);
    expect(first.iterations).toBeLessThanOrEqual(30);
    expect(optimized.trip.effectiveNetGpPerHour).toBeGreaterThanOrEqual(
      base.trip.effectiveNetGpPerHour
    );
  });

  it("builds dense compare rows for every monster with the active target marked", async () => {
    const { context } = await loadBundledLegacyContext();
    const rows = createDenseCompareRows(DEFAULT_FORM_STATE, context);
    const monsterCount = Object.keys(context.gameData.monsters).length;

    expect(rows).toHaveLength(monsterCount);
    expect(rows.length).toBeGreaterThan(8);
    expect(rows[0]?.xpPerHour).toBeGreaterThanOrEqual(rows[1]?.xpPerHour ?? 0);

    const activeRow = rows.find((row) => row.isActiveTarget);
    expect(activeRow).toMatchObject({
      monsterId: DEFAULT_FORM_STATE.monsterId,
      isActiveTarget: true
    });
    expect(activeRow?.monsterName).toBe(
      context.gameData.monsters[DEFAULT_FORM_STATE.monsterId].name
    );
    expect(activeRow?.hitChance).toBeGreaterThanOrEqual(0);
    expect(activeRow?.maxHit).toBeGreaterThan(0);
    expect(activeRow?.dps).toBeGreaterThan(0);
    expect(activeRow?.ttkSec).toBeGreaterThan(0);
    expect(activeRow?.killsPerHour).toBeGreaterThan(0);
    expect(activeRow?.gpPerKill).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(activeRow?.gpPerHour)).toBe(true);
    expect(Number.isFinite(activeRow?.netGpPerHour)).toBe(true);
  }, 15_000);

  it("uses monster-specific custom setup snapshots in dense compare rows", async () => {
    const { context } = await loadBundledLegacyContext();
    const customRockCrab = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged"),
      monsterId: "rock_crab",
      weaponId: "magic_shortbow",
      ammoId: "rune_arrow",
      boosts: ["ranging"]
    });
    const customSetups = setCustomSetupForMonster({}, customRockCrab);
    const rows = createDenseCompareRows(
      DEFAULT_FORM_STATE,
      context,
      DEFAULT_DENSE_COMPARE_SORT_STATE,
      {},
      {},
      customSetups
    );
    const rockCrabRow = rows.find((row) => row.monsterId === "rock_crab");
    const customVm = createSimulationViewModel(customRockCrab, context);

    expect(rockCrabRow).toMatchObject({
      monsterId: "rock_crab",
      hasCustomSetup: true
    });
    expect(rockCrabRow?.markers.map((marker) => marker.id)).toContain("custom");
    expect(rockCrabRow?.dps).toBe(customVm.combat.effectiveDps);
    expect(rows.find((row) => row.monsterId === DEFAULT_FORM_STATE.monsterId)?.hasCustomSetup).toBe(
      false
    );
  }, 15_000);

  it("adds dense compare markers for rewrite-owned per-monster state", async () => {
    const { context } = await loadBundledLegacyContext();
    const customGreenDragon = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "green_dragon"
    });
    const rows = createDenseCompareRows(
      DEFAULT_FORM_STATE,
      context,
      {
        ...DEFAULT_DENSE_COMPARE_STATE,
        showIrrelevant: true,
        irrelevantMonsterIds: ["green_dragon"]
      },
      {},
      {},
      setCustomSetupForMonster({}, customGreenDragon),
      {
        green_dragon: {
          highAlch: false,
          overheadSec: 12.5,
          talismanSpot: "overground"
        }
      }
    );
    const greenDragonRow = rows.find((row) => row.monsterId === "green_dragon");

    expect(greenDragonRow).toMatchObject({
      hasCustomSetup: true,
      hasHighAlchOverride: true,
      hasOverheadOverride: true,
      isIrrelevant: true
    });
    expect(greenDragonRow?.markers.map((marker) => marker.id)).toEqual([
      "custom",
      "alch",
      "overhead",
      "hidden"
    ]);
    expect(greenDragonRow?.markers.find((marker) => marker.id === "alch")).toMatchObject({
      label: "alch",
      ariaLabel: "High alch override"
    });
  }, 15_000);

  it("sorts dense compare rows with explicit keys and falls back on invalid sort state", async () => {
    const { context } = await loadBundledLegacyContext();
    const defaultRows = createDenseCompareRows(
      DEFAULT_FORM_STATE,
      context,
      DEFAULT_DENSE_COMPARE_SORT_STATE
    );
    const sortedByName = sortDenseCompareRows(defaultRows, {
      key: "monsterName",
      direction: "asc"
    });
    const invalidSortRows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      key: "not-a-sort-key",
      direction: "desc"
    });

    expect(sortedByName.map((row) => row.monsterName)).toEqual(
      [...sortedByName.map((row) => row.monsterName)].sort((left, right) =>
        left.localeCompare(right)
      )
    );
    expect(invalidSortRows.map((row) => row.monsterId)).toEqual(
      defaultRows.map((row) => row.monsterId)
    );
  }, 15_000);

  it("filters dense compare rows by monster name and keeps the current target visible", async () => {
    const { context } = await loadBundledLegacyContext();
    const rows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      ...DEFAULT_DENSE_COMPARE_STATE,
      monsterFilter: "rock crab"
    });
    const rockCrabRow = rows.find((row) => row.monsterId === "rock_crab");
    const activeRow = rows.find((row) => row.monsterId === DEFAULT_FORM_STATE.monsterId);

    expect(rockCrabRow?.monsterName).toBe("Rock Crab");
    expect(activeRow).toMatchObject({
      isActiveTarget: true,
      isForcedVisible: true
    });
    expect(rows.every((row) => row.monsterId === "rock_crab" || row.isActiveTarget)).toBe(true);
  }, 15_000);

  it("filters dense compare rows by drop names, item keys and nested expanded rows", async () => {
    const { context } = await loadBundledLegacyContext();
    const bigBoneRows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      ...DEFAULT_DENSE_COMPARE_STATE,
      dropFilter: "big_bones"
    });
    const nestedGemRows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      ...DEFAULT_DENSE_COMPARE_STATE,
      dropFilter: "diamond"
    });

    expect(bigBoneRows.length).toBeGreaterThan(1);
    expect(bigBoneRows.some((row) => row.monsterId === DEFAULT_FORM_STATE.monsterId)).toBe(true);
    expect(nestedGemRows.length).toBeGreaterThan(1);
    expect(nestedGemRows.some((row) => row.isActiveTarget)).toBe(true);
    expect(nestedGemRows.some((row) => !row.isActiveTarget)).toBe(true);
  }, 15_000);

  it("hides irrelevant dense compare rows unless showIrrelevant is enabled", async () => {
    const { context } = await loadBundledLegacyContext();
    const hiddenRows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      ...DEFAULT_DENSE_COMPARE_STATE,
      irrelevantMonsterIds: [DEFAULT_FORM_STATE.monsterId, "rock_crab"]
    });
    const shownRows = createDenseCompareRows(DEFAULT_FORM_STATE, context, {
      ...DEFAULT_DENSE_COMPARE_STATE,
      showIrrelevant: true,
      irrelevantMonsterIds: [DEFAULT_FORM_STATE.monsterId, "rock_crab"]
    });

    expect(hiddenRows.find((row) => row.monsterId === "rock_crab")).toBeUndefined();
    expect(hiddenRows.find((row) => row.monsterId === DEFAULT_FORM_STATE.monsterId)).toMatchObject({
      isActiveTarget: true,
      isForcedVisible: true,
      isIrrelevant: true
    });
    expect(
      hiddenRows
        .find((row) => row.monsterId === DEFAULT_FORM_STATE.monsterId)
        ?.markers.map((marker) => marker.id)
    ).toEqual(["hidden", "target"]);
    expect(shownRows.find((row) => row.monsterId === "rock_crab")).toMatchObject({
      isIrrelevant: true
    });
  }, 15_000);

  it("matches the legacy fixture numbers for the default melee summary", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const expected = expectedFor("melee_rune_scimitar_hill_giant_super_prayers");

    expectCloseToFixture(result.combat.effectiveDps, expected.effDps);
    expectCloseToFixture(result.effectiveXpPerHour, expected.effectiveXpPerHour);
    expectCloseToFixture(result.trip.gpPerKill, expected.gpPerKill);
    expectCloseToFixture(result.trip.effectiveNetGpPerHour, expected.effectiveNetGpPerHour);
  });

  it("matches the legacy fixture numbers for a ranged safespot summary", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(rangedRockCrabForm(), context);
    const expected = expectedFor("ranged_magic_shortbow_rock_crab_safespot");

    expectCloseToFixture(result.combat.effectiveDps, expected.effDps);
    expectCloseToFixture(result.effectiveXpPerHour, expected.effectiveXpPerHour);
    expectCloseToFixture(result.trip.gpPerKill, expected.gpPerKill);
    expectCloseToFixture(result.trip.effectiveNetGpPerHour, expected.effectiveNetGpPerHour);
  });

  it("applies per-monster cannon settings to visible rates", async () => {
    const { context } = await loadBundledLegacyContext();
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
    const { context } = await loadBundledLegacyContext();
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

import fixtureSet from "./fixtures/legacy-golden.json";
import { loadBundledLegacyContext } from "../adapters/browser";
import {
  DEFAULT_FORM_STATE,
  formToSimulationRequest,
  formToTripPolicy,
  type CombatSetupFormState
} from "../app/state/ui-state";
import { DEFAULT_DENSE_COMPARE_SORT_STATE } from "../app/state/dense-compare";
import {
  createCompareRows,
  createDenseCompareRows,
  createPlannerViewModel,
  createSimulationViewModel,
  optimizeLootPrefsForMonster,
  sortDenseCompareRows
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
        safespot: true
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
      safespot: true
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
    expect(trip.protect).toBe("none");
    expect(trip.recoilRings).toBe(1);
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
    const skipped = createSimulationViewModel(form, context, {}, { [bigBonesRows[1]!.rowId]: "skip" });

    expect(base.lootRows.length).toBeGreaterThan(base.topLoot.length);
    expect(bigBonesRows.length).toBeGreaterThanOrEqual(2);
    expect(new Set(bigBonesRows.map((row) => row.rowId)).size).toBe(bigBonesRows.length);
    expect(skipped.request).not.toHaveProperty("lootPrefs");
    expect(skipped.lootRows.find((row) => row.rowId === bigBonesRows[1]!.rowId)?.pref).toBe(
      "skip"
    );
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
    const alchResult = createSimulationViewModel(
      { ...form, monsterId: "green_dragon" },
      context
    );
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
});

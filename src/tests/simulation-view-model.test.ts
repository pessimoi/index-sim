import {
  DEFAULT_FORM_STATE,
  activeAssumptionRow,
  casketStats,
  createCompareRows,
  createPlannerViewModel,
  createSimulationViewModel,
  expectCloseToFixture,
  expectedFor,
  formToSimulationRequest,
  loadCurrentTestContext,
  normalizeFormState,
  rangedRockCrabForm,
  switchCombatStyleLoadout
} from "./ui-view-model-fixture";
import { createLegacyDerivedStaticRuntimeContext } from "../adapters/static-runtime";
import type { CombatSetupFormState } from "./ui-view-model-fixture";

describe("rewrite UI view models", () => {
  it("keeps form state separate from SimulationRequest", async () => {
    const { context } = await loadCurrentTestContext();
    const request = formToSimulationRequest(DEFAULT_FORM_STATE);

    expect(request.monsterId).toBe(DEFAULT_FORM_STATE.monsterId);
    expect(request).not.toHaveProperty("plannerTargets");
    expect(request).not.toHaveProperty("trip");
    expect(context.gameData.monsters[request.monsterId]).toBeDefined();
  });

  it("maps normalized multi-prayer and multi-boost selections into SimulationRequest", () => {
    const request = formToSimulationRequest({
      ...DEFAULT_FORM_STATE,
      prayers: ["none", "clarity", "incredible", "ultimate", "unknown_prayer"],
      boosts: ["none", "super_att", "super_str", "magic", "unknown_boost"]
    });
    const emptyRequest = formToSimulationRequest({
      ...DEFAULT_FORM_STATE,
      prayers: ["none", "unknown_prayer"],
      boosts: ["none", "unknown_boost"]
    });

    expect(request.prayers.keys).toEqual(["incredible", "ultimate"]);
    expect(request.boosts.keys).toEqual(["super_att", "super_str", "magic"]);
    expect(emptyRequest.prayers.keys).toEqual(["none"]);
    expect(emptyRequest.boosts.keys).toEqual(["none"]);
  });

  it("builds SimulationRequest from the restored active per-style loadout", async () => {
    const { context } = await loadCurrentTestContext();
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
    const { context } = await loadCurrentTestContext();
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
    const { context } = await loadCurrentTestContext();
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
    expect(activeAssumptionRow(overridden, "manual-combat-overrides")).toMatchObject({
      label: "Manual combat overrides",
      value: "3 fields",
      reviewTab: "melee",
      detail: expect.stringContaining("accuracy +350"),
      resetAction: {
        target: "manual-combat-overrides",
        label: "Reset",
        ariaLabel: "Reset manual combat overrides",
        statusLabel: "Manual overrides reset"
      }
    });
    expect(activeAssumptionRow(overridden, "manual-combat-overrides")?.detail).toContain(
      "speed 1.2 s"
    );
  });

  it("composes MonsterCard presentation from the full simulation combat result", async () => {
    const { context } = await loadCurrentTestContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);

    expect(result.monsterCard).toMatchObject({
      monsterId: result.request.monsterId,
      activeDefenceField: result.combat.debug.defenceField,
      setupOverview: {
        attackType: result.combat.debug.attackType,
        accuracyBonus: result.combat.debug.accuracyBonus,
        damageBonus: result.combat.debug.damageBonus,
        attackSpeedSec: result.combat.attackSpeedSec
      }
    });
    expect(result.monsterCard.defenceRows.filter((row) => row.active)).toHaveLength(1);
    expect(result.monsterCard.setupOverview.summary).toContain(
      `Weapon: ${result.monsterCard.setupOverview.weapon.label}`
    );
  });

  it("builds result, compare and planner models from the domain", async () => {
    const { context } = await loadCurrentTestContext();
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

  it("matches the legacy fixture numbers for the default melee summary", async () => {
    const { context } = createLegacyDerivedStaticRuntimeContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const expected = expectedFor("melee_rune_scimitar_hill_giant_super_prayers");

    expectCloseToFixture(result.combat.effectiveDps, expected.effDps);
    expectCloseToFixture(result.effectiveXpPerHour, expected.effectiveXpPerHour);
    expectCloseToFixture(result.trip.gpPerKill, expected.gpPerKill);
    expectCloseToFixture(result.trip.effectiveNetGpPerHour, expected.effectiveNetGpPerHour);
  });

  it("matches the legacy fixture numbers for a ranged safespot summary", async () => {
    const { context } = createLegacyDerivedStaticRuntimeContext();
    const form = rangedRockCrabForm();
    const result = createSimulationViewModel(form, context);
    const expected = expectedFor("ranged_magic_shortbow_rock_crab_safespot");
    const casketDrop = context.gameData.monsters.rock_crab.loot
      ?.flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .find((drop) => drop.tag === "casket");
    const casketCorrection = casketDrop
      ? casketDrop.chance *
        casketDrop.qtyAvg *
        (casketStats(context.priceSet, context.gameData).ev -
          (context.priceSet.itemPrices.casket ?? 0))
      : 0;

    expectCloseToFixture(result.combat.effectiveDps, expected.effDps);
    expectCloseToFixture(result.effectiveXpPerHour, expected.effectiveXpPerHour);
    expectCloseToFixture(result.trip.gpPerKill, Number(expected.gpPerKill) + casketCorrection);
    expectCloseToFixture(
      result.trip.effectiveNetGpPerHour,
      Number(expected.effectiveNetGpPerHour) + casketCorrection * result.trip.trip.effectiveKph
    );
  });
});

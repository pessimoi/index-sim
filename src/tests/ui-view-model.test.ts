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
import { MAX_DUEL_SNAPSHOTS, createDuelSnapshot } from "../app/state/duel-snapshots";
import {
  ammoOptions,
  createCompareRows,
  createDenseCompareRows,
  createDenseCompareScaleModel,
  createDuelComparisonViewModel,
  createMonsterCardViewModel,
  createPlannerViewModel,
  createSimulationViewModel,
  createStatsCombatRollDetailViewModel,
  equipmentSlotOptions,
  formatNumber,
  gearQuickActionForSlot,
  optimizeLootPrefsForMonster,
  spellOptions,
  sortDenseCompareRows,
  type DenseCompareRowViewModel,
  weaponOptions
} from "../app/view-models/simulation";
import { simulateFullSimulation } from "../domain/simulation";
import { HIGH_ALCH_MAGIC_XP_PER_CAST } from "../domain/trip";

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

function activeDefenceKeys(card: ReturnType<typeof createMonsterCardViewModel>): string[] {
  return card.defenceRows.filter((row) => row.active).map((row) => row.key);
}

function activeAssumptionRows(result: ReturnType<typeof createSimulationViewModel>) {
  return [...result.activeAssumptions.visibleRows, ...result.activeAssumptions.hiddenRows];
}

function activeAssumptionRow(result: ReturnType<typeof createSimulationViewModel>, id: string) {
  return activeAssumptionRows(result).find((row) => row.id === id);
}

type StatsSourceDetailForTest = ReturnType<
  typeof createSimulationViewModel
>["statsSourceBreakdown"]["details"][number];

function statsSourceDetail(
  result: ReturnType<typeof createSimulationViewModel>,
  id: StatsSourceDetailForTest["id"]
) {
  return result.statsSourceBreakdown.details.find((detail) => detail.id === id);
}

function statsSourceMetrics(detail: StatsSourceDetailForTest | undefined) {
  return new Map((detail?.metrics ?? []).map((metric) => [metric.id, metric]));
}

function combatRollMetrics(result: ReturnType<typeof createSimulationViewModel>) {
  return new Map(result.combatRollDetail.metrics.map((metric) => [metric.id, metric]));
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

  it("summarizes default active assumptions as an empty read-only state", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, {
      ...context,
      priceSet: {
        ...context.priceSet,
        itemPrices: {
          ...context.priceSet.itemPrices,
          chaos_talisman: 500,
          dragon_spear: 39000,
          dragonshield_a: 50000,
          rune_spear: 30000
        }
      }
    });

    expect(result.activeAssumptions).toMatchObject({
      statusLabel: "Default assumptions active",
      totalCount: 0,
      hasActiveRows: false,
      hiddenCount: 0
    });
    expect(result.activeAssumptions.visibleRows).toEqual([]);
    expect(result.activeAssumptions.hiddenRows).toEqual([]);
  });

  it("keeps inherited trip loot settings review-only in active assumptions", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        trip: {
          ...DEFAULT_FORM_STATE.trip,
          alching: true
        }
      },
      context
    );

    expect(activeAssumptionRow(result, "loot-settings")).toMatchObject({
      label: "Loot settings",
      detail: "high alch on",
      reviewTab: "loot"
    });
    expect(activeAssumptionRow(result, "loot-settings")?.resetAction).toBeUndefined();
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

  it("selects deterministic visible gear quick actions for the active combat style", async () => {
    const { context } = await loadBundledLegacyContext();
    const helmOptions = equipmentSlotOptions(context.gameData, "helm");
    const bodyOptions = equipmentSlotOptions(context.gameData, "body");

    const meleeHelm = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_full_helm",
      options: helmOptions
    });
    const rangedHelm = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "ranged",
      weaponId: "magic_shortbow",
      styleId: "rapid",
      currentItemId: "rune_full_helm",
      options: helmOptions
    });
    const magicHelm = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "magic",
      weaponId: "staff_of_fire",
      styleId: "accurate",
      currentItemId: "rune_full_helm",
      options: helmOptions
    });
    const currentTie = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "body",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_platebody",
      options: bodyOptions
    });

    expect(meleeHelm).toMatchObject({ itemId: "berserker_helm", disabled: false });
    expect(rangedHelm).toMatchObject({ itemId: "robin_hood_hat", disabled: false });
    expect(magicHelm).toMatchObject({ itemId: "farseer_helm", disabled: false });
    expect(currentTie).toMatchObject({ itemId: "rune_platebody", disabled: true });
  });

  it("limits gear quick actions to the supplied visible candidates and shield lock", async () => {
    const { context } = await loadBundledLegacyContext();
    const hiddenBestOptions = equipmentSlotOptions(context.gameData, "helm").filter(
      (option) => option.id !== "berserker_helm"
    );
    const hiddenBest = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_full_helm",
      options: hiddenBestOptions
    });
    const lockedShield = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "shield",
      combatStyle: "melee",
      weaponId: "dragon_halberd",
      styleId: "aggressive",
      currentItemId: "rune_kite",
      options: equipmentSlotOptions(context.gameData, "shield"),
      shieldLocked: true
    });

    expect(hiddenBest.itemId).not.toBe("berserker_helm");
    expect(hiddenBest).toMatchObject({ itemId: "warrior_helm", disabled: false });
    expect(lockedShield).toMatchObject({
      itemId: "none",
      disabled: true,
      reason: "Shield locked by two-handed weapon"
    });
  });

  it("includes unmet requirements in gear quick action reasons", async () => {
    const { context } = await loadBundledLegacyContext();
    const action = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_full_helm",
      levels: { ...DEFAULT_FORM_STATE.levels, defence: 1 },
      options: equipmentSlotOptions(context.gameData, "helm")
    });

    expect(action).toMatchObject({
      itemId: "berserker_helm",
      disabled: false,
      reason: "Apply Berserker helm - requires Defence 45, current 1"
    });
  });

  it("keeps normal gear quick action reasons when requirements are met", async () => {
    const { context } = await loadBundledLegacyContext();
    const action = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_full_helm",
      levels: DEFAULT_FORM_STATE.levels,
      options: equipmentSlotOptions(context.gameData, "helm")
    });

    expect(action).toMatchObject({
      itemId: "berserker_helm",
      disabled: false,
      reason: "Apply Berserker helm"
    });
  });

  it("includes unmet requirements when the current gear is already the best option", async () => {
    const { context } = await loadBundledLegacyContext();
    const action = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "body",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_platebody",
      levels: { ...DEFAULT_FORM_STATE.levels, defence: 1 },
      options: equipmentSlotOptions(context.gameData, "body")
    });

    expect(action).toMatchObject({
      itemId: "rune_platebody",
      disabled: true,
      reason: "Best visible option: Rune platebody - requires Defence 40, current 1"
    });
  });

  it("does not add requirement copy for gear with no known requirement", async () => {
    const { context } = await loadBundledLegacyContext();
    const action = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "amulet",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "none",
      levels: { ...DEFAULT_FORM_STATE.levels, attack: 1, defence: 1 },
      options: equipmentSlotOptions(context.gameData, "amulet").filter(
        (option) => option.id === "none" || option.id === "amu_power"
      )
    });

    expect(action).toMatchObject({
      itemId: "amu_power",
      disabled: false,
      reason: "Apply Amulet of power"
    });
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
      "speed 1.2s"
    );
  });

  it("summarizes enabled cannon settings with a Cannon review target", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(
      DEFAULT_FORM_STATE,
      context,
      {
        giant: {
          enabled: true,
          targets: 6,
          respawnSec: 30
        }
      }
    );

    expect(activeAssumptionRow(result, "cannon-enabled")).toMatchObject({
      label: "Cannon",
      value: expect.stringContaining("Enabled"),
      reviewTab: "cannon",
      detail: "targets 6, respawn 30s",
      resetAction: {
        target: "cannon-enabled",
        ariaLabel: "Reset current monster cannon",
        statusLabel: "Current monster cannon reset"
      }
    });
  });

  it("builds MonsterCard active defence rows from melee attack types", async () => {
    const { context } = await loadBundledLegacyContext();
    const stab = createSimulationViewModel(
      { ...DEFAULT_FORM_STATE, weaponId: "dragon_dagger_p", styleId: "accurate" },
      context
    );
    const slash = createSimulationViewModel(
      { ...DEFAULT_FORM_STATE, weaponId: "rune_scimitar", styleId: "aggressive" },
      context
    );
    const crush = createSimulationViewModel(
      { ...DEFAULT_FORM_STATE, weaponId: "dragon_mace", styleId: "aggressive" },
      context
    );

    expect(stab.combat.debug.attackType).toBe("stab");
    expect(stab.monsterCard.activeDefenceField).toBe("defStab");
    expect(activeDefenceKeys(stab.monsterCard)).toEqual(["stab"]);
    expect(slash.combat.debug.attackType).toBe("slash");
    expect(slash.monsterCard.activeDefenceField).toBe("defSlash");
    expect(activeDefenceKeys(slash.monsterCard)).toEqual(["slash"]);
    expect(crush.combat.debug.attackType).toBe("crush");
    expect(crush.monsterCard.activeDefenceField).toBe("defCrush");
    expect(activeDefenceKeys(crush.monsterCard)).toEqual(["crush"]);
  });

  it("builds MonsterCard active defence rows for ranged and magic", async () => {
    const { context } = await loadBundledLegacyContext();
    const ranged = createSimulationViewModel(rangedRockCrabForm(), context);
    const magicForm = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "magic"),
      monsterId: "chaos_druid",
      weaponId: "staff_of_fire",
      spellId: "fire_wave",
      styleId: "accurate",
      boosts: ["magic"]
    });
    const magic = createSimulationViewModel(magicForm, context);

    expect(ranged.monsterCard.activeDefenceField).toBe("defRange");
    expect(activeDefenceKeys(ranged.monsterCard)).toEqual(["range"]);
    expect(ranged.monsterCard.setupOverview.attackType).toBe("ranged");
    expect(magic.monsterCard.activeDefenceField).toBe("defMagic");
    expect(activeDefenceKeys(magic.monsterCard)).toEqual(["magic"]);
    expect(magic.monsterCard.setupOverview.attackType).toBe("magic");
  });

  it("keeps missing MonsterCard stat and defence fields nullable", async () => {
    const { context } = await loadBundledLegacyContext();
    const sparseContext = {
      ...context,
      gameData: {
        ...context.gameData,
        monsters: {
          ...context.gameData.monsters,
          giant: {
            ...context.gameData.monsters.giant,
            attack: undefined,
            strength: undefined,
            defLevel: undefined,
            magicLevel: undefined,
            attackSpeed: undefined,
            defStab: undefined,
            defSlash: undefined,
            defCrush: undefined,
            defRange: undefined,
            defMagic: undefined
          }
        }
      }
    };
    const card = createMonsterCardViewModel(DEFAULT_FORM_STATE, sparseContext);

    expect(card.stats.filter((row) => row.missing).map((row) => row.key)).toEqual(
      expect.arrayContaining(["attack", "strength", "defence", "magic", "attackSpeed"])
    );
    expect(card.stats.find((row) => row.key === "hitpoints")).toMatchObject({
      value: context.gameData.monsters.giant.hp,
      missing: false
    });
    expect(card.defenceRows.every((row) => row.value === null && row.missing)).toBe(true);
    expect(card.activeDefenceField).toBe("defSlash");
    expect(activeDefenceKeys(card)).toEqual(["slash"]);
  });

  it("builds MonsterCard setup badge and compact weapon, ammo and spell summary", async () => {
    const { context } = await loadBundledLegacyContext();
    const defaultCard = createMonsterCardViewModel(DEFAULT_FORM_STATE, context, {
      hasCustomSetup: true
    });
    const rangedCard = createMonsterCardViewModel(rangedRockCrabForm(), context);
    const magicCard = createMonsterCardViewModel(
      normalizeFormState({
        ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "magic"),
        weaponId: "staff_of_fire",
        spellId: "fire_wave",
        styleId: "accurate"
      }),
      context,
      { setupMode: "custom" }
    );

    expect(defaultCard.setupBadge).toMatchObject({
      mode: "default",
      label: "Default setup (custom saved)",
      tone: "default",
      hasCustomSetup: true
    });
    expect(defaultCard.setupOverview.weapon).toMatchObject({
      id: "rune_scimitar",
      label: "Rune scimitar"
    });
    expect(defaultCard.setupOverview.ammo).toBeNull();
    expect(defaultCard.setupOverview.spell).toBeNull();
    expect(defaultCard.setupOverview.summary).toContain("Weapon: Rune scimitar");
    expect(rangedCard.setupOverview.ammo).toMatchObject({
      id: "mith_arrow",
      label: "Mithril arrow"
    });
    expect(magicCard.setupBadge).toMatchObject({
      mode: "custom",
      label: "Custom setup",
      tone: "custom",
      hasCustomSetup: true
    });
    expect(magicCard.setupOverview.spell).toMatchObject({
      id: "fire_wave",
      label: "Fire Wave"
    });
    expect(magicCard.setupOverview.summary).toEqual(
      expect.arrayContaining(["Weapon: Staff of fire", "Spell: Fire Wave"])
    );
  });

  it("keeps structured money warnings available for UI surfacing", async () => {
    const { context } = await loadBundledLegacyContext();
    const { uncut_sapphire: _uncutSapphire, ...itemPrices } = context.priceSet.itemPrices;
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, {
      ...context,
      priceSet: {
        ...context.priceSet,
        itemPrices: { ...itemPrices, sapphire: 451 }
      }
    });

    expect(result.moneyWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "price-alias-used",
          severity: "info"
        })
      ])
    );
    expect(result.warnings.join("\n")).toContain("Using alias price");
    expect(activeAssumptionRow(result, "price-warnings")).toMatchObject({
      label: "Price confidence",
      reviewTab: "economy",
      value: `${result.moneyWarnings.length} warnings`,
      detail: result.moneyWarnings[0]?.message
    });
  });

  it("surfaces unmet setup requirements for low defence rune armour", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        levels: { ...DEFAULT_FORM_STATE.levels, defence: 1 }
      },
      context
    );
    const runeBodyWarning = result.setupRequirements.warnings.find(
      (warning) => warning.itemId === "rune_platebody" && warning.skill === "defence"
    );

    expect(runeBodyWarning).toMatchObject({
      itemName: "Rune platebody",
      slot: "body",
      slotLabel: "Body",
      skillLabel: "Defence",
      requiredLevel: 40,
      currentLevel: 1,
      severity: "warning"
    });
    expect(runeBodyWarning?.message).toContain("Rune platebody requires Defence 40");
    expect(activeAssumptionRow(result, "setup-requirements")).toMatchObject({
      label: "Setup requirements",
      reviewTab: "melee",
      tone: "warning"
    });
    expect(activeAssumptionRow(result, "setup-requirements")?.resetAction).toBeUndefined();
  });

  it("surfaces unmet setup requirements for low attack dragon weapons", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = applyWeaponSelection(
      {
        ...DEFAULT_FORM_STATE,
        levels: { ...DEFAULT_FORM_STATE.levels, attack: 1 }
      },
      "dragon_longsword",
      context.gameData
    );
    const result = createSimulationViewModel(form, context);

    expect(result.setupRequirements.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: "dragon_longsword",
          itemName: "Dragon longsword",
          slot: "weapon",
          slotLabel: "Weapon",
          skill: "attack",
          skillLabel: "Attack",
          requiredLevel: 60,
          currentLevel: 1
        })
      ])
    );
    expect(activeAssumptionRow(result, "setup-requirements")).toMatchObject({
      reviewTab: "melee"
    });
  });

  it("keeps matching setup levels free of requirement warnings", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);

    expect(result.setupRequirements.warnings).toEqual([]);
    expect(activeAssumptionRow(result, "setup-requirements")).toBeUndefined();
  });

  it("ignores selected gear with no known setup requirement", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = applyWeaponSelection(
      {
        ...DEFAULT_FORM_STATE,
        levels: { ...DEFAULT_FORM_STATE.levels, attack: 1, defence: 1 },
        gear: {
          helm: "none",
          amulet: "amu_power",
          body: "none",
          legs: "none",
          shield: "none",
          gloves: "none",
          boots: "none",
          cape: "none",
          ring: "none"
        }
      },
      "iron_scimitar",
      context.gameData
    );
    const result = createSimulationViewModel(form, context);

    expect(result.setupRequirements.warnings).toEqual([]);
    expect(activeAssumptionRow(result, "setup-requirements")).toBeUndefined();
  });

  it("summarizes imported and synced PriceSet modifiers", async () => {
    const { context } = await loadBundledLegacyContext();
    const imported = createSimulationViewModel(DEFAULT_FORM_STATE, {
      ...context,
      priceSet: {
        ...context.priceSet,
        id: "imported-empty",
        label: "Imported empty",
        source: "imported",
        itemPrices: {},
        alchValues: {}
      }
    });
    const synced = createSimulationViewModel(DEFAULT_FORM_STATE, {
      ...context,
      priceSet: {
        ...context.priceSet,
        id: "synced-test",
        label: "Synced test snapshot",
        source: "scraped"
      }
    });

    expect(activeAssumptionRow(imported, "active-price-set")).toMatchObject({
      label: "Active PriceSet",
      value: "Imported",
      detail: "Imported empty",
      reviewTab: "economy"
    });
    expect(activeAssumptionRow(imported, "active-price-set")?.resetAction).toBeUndefined();
    expect(activeAssumptionRow(imported, "price-warnings")).toMatchObject({
      label: "Price confidence",
      reviewTab: "economy"
    });
    expect(activeAssumptionRow(imported, "price-warnings")?.resetAction).toBeUndefined();
    expect(activeAssumptionRow(synced, "active-price-set")).toMatchObject({
      value: "Synced",
      detail: "Synced test snapshot"
    });
  });

  it("keeps active assumption priority order and five-row visibility stable", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      manualOverrides: {
        accuracyBonus: 12,
        damageBonus: 5,
        attackSpeedSec: 2.4
      },
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        bankSeconds: 120,
        foodCount: 8,
        prayerPotionDoses: 6,
        potionSets: 2,
        protect: "melee",
        safespot: false,
        scarceSpot: true,
        targetsAtSpot: 2,
        respawnSeconds: 45
      }
    };
    const result = createSimulationViewModel(
      form,
      {
        ...context,
        priceSet: {
          ...context.priceSet,
          id: "imported-empty",
          label: "Imported empty",
          source: "imported",
          itemPrices: {},
          alchValues: {}
        }
      },
      {
        giant: {
          enabled: true,
          targets: 4,
          respawnSec: 45
        }
      },
      {},
      {
        giant: {
          highAlch: true,
          overheadSec: 12.5,
          talismanSpot: "overground"
        }
      },
      {
        activeAssumptions: {
          setupMode: "custom",
          hasCustomSetup: true,
          hiddenGearTierCount: 2
        }
      }
    );

    expect(result.activeAssumptions.visibleRows).toHaveLength(5);
    expect(result.activeAssumptions.hiddenCount).toBeGreaterThan(0);
    expect(result.activeAssumptions.visibleRows.map((row) => row.id)).toEqual([
      "price-warnings",
      "custom-setup",
      "cannon-enabled",
      "manual-combat-overrides",
      "active-price-set"
    ]);
    expect(activeAssumptionRows(result).map((row) => row.id)).toEqual([
      "price-warnings",
      "custom-setup",
      "cannon-enabled",
      "manual-combat-overrides",
      "active-price-set",
      "loot-settings",
      "scarce-spot",
      "explicit-safespot",
      "protection-prayer",
      "manual-trip-controls",
      "supply-settings",
      "hidden-gear-tiers"
    ]);
    expect(activeAssumptionRow(result, "hidden-gear-tiers")?.resetAction).toMatchObject({
      target: "hidden-gear-tiers",
      ariaLabel: "Reset hidden gear tiers",
      statusLabel: "Hidden gear tiers shown"
    });
  });

  it("keeps targeted active-assumption resets scoped in the view model", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      manualOverrides: {
        accuracyBonus: 12,
        damageBonus: null,
        attackSpeedSec: null
      },
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        protect: "magic",
        safespot: false,
        scarceSpot: true,
        targetsAtSpot: 6,
        respawnSeconds: 30
      }
    };
    const beforeReset = createSimulationViewModel(form, context, {
      giant: { enabled: true, targets: 6, respawnSec: 30 }
    });
    const afterManualReset = createSimulationViewModel(
      { ...form, manualOverrides: DEFAULT_FORM_STATE.manualOverrides },
      context,
      {
        giant: { enabled: true, targets: 6, respawnSec: 30 }
      }
    );
    const afterSafespotResetForm: CombatSetupFormState = {
      ...form,
      trip: {
        ...form.trip,
        safespot: null
      }
    };
    const afterSafespotReset = createSimulationViewModel(afterSafespotResetForm, context, {
      giant: { enabled: true, targets: 6, respawnSec: 30 }
    });
    const afterScarceResetForm: CombatSetupFormState = {
      ...form,
      trip: {
        ...form.trip,
        scarceSpot: false
      }
    };
    const afterScarceReset = createSimulationViewModel(afterScarceResetForm, context, {
      giant: { enabled: true, targets: 6, respawnSec: 30 }
    });
    const afterCannonReset = createSimulationViewModel(form, context, {});

    expect(activeAssumptionRow(beforeReset, "manual-combat-overrides")).toBeDefined();
    expect(activeAssumptionRow(beforeReset, "explicit-safespot")).toMatchObject({
      label: "Safespot override",
      value: "Off",
      resetAction: {
        target: "explicit-safespot",
        ariaLabel: "Reset safespot override",
        statusLabel: "Safespot override reset to auto"
      }
    });
    expect(activeAssumptionRow(beforeReset, "protection-prayer")).toMatchObject({
      label: "Protection prayer",
      value: "Protect from magic",
      reviewTab: "trip"
    });
    expect(activeAssumptionRow(beforeReset, "protection-prayer")?.resetAction).toBeUndefined();
    expect(activeAssumptionRow(beforeReset, "scarce-spot")?.resetAction).toMatchObject({
      target: "scarce-spot",
      ariaLabel: "Reset scarce spot",
      statusLabel: "Scarce spot disabled; target and respawn values kept"
    });

    expect(activeAssumptionRow(afterManualReset, "manual-combat-overrides")).toBeUndefined();
    expect(activeAssumptionRow(afterManualReset, "explicit-safespot")).toBeDefined();

    expect(activeAssumptionRow(afterSafespotReset, "explicit-safespot")).toBeUndefined();
    expect(activeAssumptionRow(afterSafespotReset, "protection-prayer")).toBeDefined();

    expect(afterScarceResetForm.trip.targetsAtSpot).toBe(6);
    expect(afterScarceResetForm.trip.respawnSeconds).toBe(30);
    expect(activeAssumptionRow(afterScarceReset, "scarce-spot")).toBeUndefined();
    expect(activeAssumptionRow(afterScarceReset, "explicit-safespot")).toBeDefined();

    expect(afterCannonReset.trip.cannon).toBeNull();
    expect(afterCannonReset.trip.trip.scarce.enabled).toBe(true);
    expect(afterCannonReset.trip.trip.scarce.targetsAtSpot).toBe(6);
    expect(afterCannonReset.trip.trip.scarce.respawnSeconds).toBe(30);
    expect(activeAssumptionRow(afterCannonReset, "cannon-enabled")).toBeUndefined();
    expect(activeAssumptionRow(afterCannonReset, "scarce-spot")).toBeDefined();
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

  it("applies potion, auto-bank and reserve defaults to the trip view model", async () => {
    const { context } = await loadBundledLegacyContext();
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
    const { context } = await loadBundledLegacyContext();
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
    const dbaBoostForm: CombatSetupFormState = {
      ...form,
      boosts: ["dba_spec", "super_att"],
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    };
    const magicForm = normalizeFormState({
      ...switchCombatStyleLoadout(form, "magic"),
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    });

    expect(formToSimulationRequest(form, context.gameData).specialAttack).toEqual({
      weaponId: "dragon_dagger_p"
    });
    expect(formToSimulationRequest(invalidForm, context.gameData).specialAttack).toBeUndefined();
    expect(formToSimulationRequest(dbaBoostForm, context.gameData).specialAttack).toBeUndefined();
    expect(formToSimulationRequest(magicForm, context.gameData).specialAttack).toBeUndefined();
    expect(createSimulationViewModel(dbaBoostForm, context).combat.specialAttack).toBeNull();
    const dbaBoostResult = createSimulationViewModel(dbaBoostForm, context);
    const dbaSpecialDetail = statsSourceDetail(dbaBoostResult, "special-attack");
    const dbaSpecialMetrics = statsSourceMetrics(dbaSpecialDetail);

    expect(dbaSpecialDetail).toMatchObject({
      status: "inactive",
      statusLabel: "inactive",
      histogram: null,
      warnings: []
    });
    expect(dbaSpecialDetail?.notes.join("\n")).toContain(
      "DBA special boost is modeled as a boost, not a DPS special attack."
    );
    expect(dbaSpecialMetrics.get("dps")).toMatchObject({ value: "-", numericValue: null });
    expect(magicForm.specialAttack).toEqual({ weaponId: "none", ammoId: "none" });
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
    const rangedResult = createSimulationViewModel(bowMainForm, context);
    const rangedSpecialDetail = statsSourceDetail(rangedResult, "special-attack");
    const rangedSpecialMetrics = statsSourceMetrics(rangedSpecialDetail);

    expect(rangedResult.combat.specialAttack?.key).toBe("magic_shortbow");
    expect(rangedSpecialDetail).toMatchObject({
      status: "modeled",
      statusLabel: "modeled",
      histogram: null,
      warnings: []
    });
    expect(rangedSpecialMetrics.get("specs-hr")?.numericValue).toBeGreaterThan(0);
    expect(rangedSpecialMetrics.get("spec-weapon")?.value).toBe("Magic shortbow");
    expect(rangedSpecialMetrics.get("dps-with-spec")?.numericValue).toBe(
      rangedResult.combat.specialAttack?.dpsWithSpec
    );
    expect(rangedSpecialMetrics.get("dps-gain")?.numericValue).toBe(
      rangedResult.combat.specialAttack?.dpsGainPct
    );
  });

  it("exposes special attack metrics in the simulation view model", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      weaponId: "dragon_dagger_p",
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    };
    const result = createSimulationViewModel(form, context);
    const specialDetail = statsSourceDetail(result, "special-attack");
    const specialMetrics = statsSourceMetrics(specialDetail);

    expect(result.request.specialAttack).toEqual({ weaponId: "dragon_dagger_p" });
    expect(result.combat.specialAttack).toMatchObject({
      key: "dragon_dagger_p",
      weaponName: "Dragon dagger(p)",
      hits: 2
    });
    expect(result.combat.specialAttack?.maxHit).toBeGreaterThan(0);
    expect(result.combat.specialAttack?.specsPerHour).toBeGreaterThan(0);
    expect(result.combat.effectiveDps).toBe(result.combat.specialAttack?.dpsWithSpec);
    expect(result.specialWarnings).toEqual([]);
    expect(
      result.statsSourceBreakdown.rows.find((row) => row.id === "special-attack")
    ).toMatchObject({
      label: "Special attack",
      status: "modeled",
      dpsGainPct: result.combat.specialAttack?.dpsGainPct,
      hitChance: result.combat.specialAttack?.hitChance,
      maxHit: result.combat.specialAttack?.maxHit
    });
    expect(result.statsSourceBreakdown.rows.find((row) => row.id === "special-attack")?.dps).toBe(
      (result.combat.specialAttack?.dpsWithSpec ?? 0) -
        (result.combat.specialAttack?.dpsBase ?? 0)
    );
    expect(specialDetail).toMatchObject({
      id: "special-attack",
      label: "Special attack",
      status: "modeled",
      statusLabel: "modeled",
      histogram: null,
      warnings: []
    });
    expect(specialMetrics.get("dps-gain")?.numericValue).toBe(
      result.combat.specialAttack?.dpsGainPct
    );
    expect(specialMetrics.get("spec-weapon")?.value).toBe("Dragon dagger(p)");
    expect(specialMetrics.get("dps-with-spec")?.numericValue).toBe(
      result.combat.specialAttack?.dpsWithSpec
    );
    expect(specialMetrics.get("specs-hr")?.numericValue).toBe(
      result.combat.specialAttack?.specsPerHour
    );
    expect(specialMetrics.get("hits")?.numericValue).toBe(result.combat.specialAttack?.hits);
    expect(specialDetail?.notes.join("\n")).toContain(
      "Special attack XP is included in player combat XP/hr"
    );
  });

  it("surfaces dragon halberd NPC-size fallback warning only for that special path", async () => {
    const { context } = await loadBundledLegacyContext();
    const warningText =
      "NPC size data is not modeled; dragon halberd second-hit behavior follows the current legacy fixture assumption.";
    const daggerResult = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        weaponId: "dragon_dagger_p",
        specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
      },
      context
    );
    const halberdResult = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        monsterId: "rock_crab",
        weaponId: "dragon_halberd",
        styleId: "aggressive",
        gear: { ...DEFAULT_FORM_STATE.gear, shield: "none" },
        boosts: ["super_att", "super_str"],
        specialAttack: { weaponId: "dragon_halberd", ammoId: "none" }
      },
      context
    );

    expect(daggerResult.specialWarnings).toEqual([]);
    expect(halberdResult.combat.specialAttack?.key).toBe("dragon_halberd");
    expect(halberdResult.specialWarnings).toEqual([
      {
        code: "dragon-halberd-npc-size-fallback",
        severity: "info",
        message: warningText
      }
    ]);
    expect(halberdResult.warnings).toContain(warningText);
    expect(activeAssumptionRow(halberdResult, "special-warnings")).toMatchObject({
      label: "Special attack assumption",
      reviewTab: "melee",
      detail: warningText
    });
    expect(
      halberdResult.statsSourceBreakdown.rows.find((row) => row.id === "special-attack")
    ).toMatchObject({
      label: "Special attack",
      status: "partial",
      statusLabel: "partial"
    });
    expect(
      halberdResult.statsSourceBreakdown.rows
        .find((row) => row.id === "special-attack")
        ?.notes.join("\n")
    ).toContain(warningText);
    expect(statsSourceDetail(halberdResult, "special-attack")).toMatchObject({
      status: "partial",
      statusLabel: "partial",
      histogram: null,
      warnings: halberdResult.specialWarnings
    });
    expect(statsSourceDetail(halberdResult, "special-attack")?.notes.join("\n")).toContain(
      warningText
    );
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

  it("builds hit distribution histogram data from the combat result", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const distribution = result.hitDistribution;
    const probabilityTotal = distribution.buckets.reduce(
      (sum, bucket) => sum + bucket.probability,
      0
    );
    const missBucket = distribution.buckets[0]!;
    const maxBucket = distribution.buckets.find((bucket) => bucket.isMaxHit);

    expect(distribution.hitChance).toBe(result.combat.hitChance);
    expect(distribution.averageHit).toBe(result.combat.avgHit);
    expect(distribution.maxHit).toBe(result.combat.maxHit);
    expect(distribution.hitChanceLabel).toBe(`${formatNumber(result.combat.hitChance * 100, 1)}%`);
    expect(distribution.averageHitLabel).toBe(formatNumber(result.combat.avgHit, 2));
    expect(distribution.maxHitLabel).toBe(formatNumber(result.combat.maxHit, 1));
    expect(probabilityTotal).toBeCloseTo(1);
    expect(distribution.probabilityTotal).toBeCloseTo(1);
    expect(missBucket).toMatchObject({
      id: "miss-zero",
      label: "Miss / 0",
      isMiss: true
    });
    expect(missBucket.ariaLabel).toContain("miss or zero damage");
    expect(maxBucket).toBeDefined();
    expect(maxBucket?.ariaLabel).toContain("max hit bucket");
  }, 15_000);

  it("builds default melee Stats combat roll detail metrics from current result data", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const metrics = combatRollMetrics(result);

    expect(result.combatRollDetail).toMatchObject({
      status: "modeled",
      statusLabel: "modeled"
    });
    expect(metrics.get("effective-accuracy")).toMatchObject({
      value: formatNumber(result.combat.debug.effectiveAccuracy),
      numericValue: result.combat.debug.effectiveAccuracy
    });
    expect(metrics.get("effective-damage")).toMatchObject({
      value: formatNumber(result.combat.debug.effectiveDamage),
      numericValue: result.combat.debug.effectiveDamage
    });
    expect(metrics.get("attack-roll")).toMatchObject({
      value: formatNumber(result.combat.attackRoll),
      numericValue: result.combat.attackRoll
    });
    expect(metrics.get("defence-roll")).toMatchObject({
      value: formatNumber(result.combat.defenceRoll),
      numericValue: result.combat.defenceRoll
    });
    expect(metrics.get("hit-chance")).toMatchObject({
      value: `${formatNumber(result.combat.hitChance * 100, 1)}%`,
      numericValue: result.combat.hitChance
    });
    expect(metrics.get("max-hit")).toMatchObject({
      value: formatNumber(result.combat.maxHit, 1),
      numericValue: result.combat.maxHit
    });
    expect(metrics.get("average-hit")).toMatchObject({
      value: formatNumber(result.hitDistribution.averageHit, 2),
      numericValue: result.hitDistribution.averageHit
    });
    expect(metrics.get("attack-speed")).toMatchObject({
      value: `${formatNumber(result.combat.attackSpeedSec, 1)}s`,
      numericValue: result.combat.attackSpeedSec
    });
    expect(metrics.get("attack-cycle")).toMatchObject({
      value: `${formatNumber(result.combat.attackTicks, 1)} ticks`,
      numericValue: result.combat.attackTicks
    });
    expect(metrics.get("ttk")?.numericValue).toBe(result.combat.ttkSec);
    expect(metrics.get("kills-per-hour")?.numericValue).toBe(result.trip.killsPerHour);
    expect(metrics.get("gp-per-kill")?.numericValue).toBe(result.trip.gpPerKill);
    expect(result.combatRollDetail.notes.join("\n")).toContain(
      "Roll and hit metrics describe the normal player attack."
    );
  }, 15_000);

  it("builds ranged Stats combat roll detail without melee-only assumptions", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(rangedRockCrabForm(), context);
    const metrics = combatRollMetrics(result);
    const notes = result.combatRollDetail.metrics.map((metric) => metric.note).join("\n");

    expect(result.request.combatStyle).toBe("ranged");
    expect(result.combatRollDetail.status).toBe("modeled");
    expect(metrics.get("effective-accuracy")?.numericValue).toBe(
      result.combat.debug.effectiveAccuracy
    );
    expect(metrics.get("effective-damage")?.numericValue).toBe(
      result.combat.debug.effectiveDamage
    );
    expect(metrics.get("hit-chance")?.numericValue).toBe(result.combat.hitChance);
    expect(metrics.get("attack-cycle")?.numericValue).toBe(result.combat.attackTicks);
    expect(metrics.get("ttk")?.numericValue).toBe(result.combat.ttkSec);
    expect(notes.toLowerCase()).not.toContain("melee");
  }, 15_000);

  it("builds magic Stats combat roll detail without special or cannon histogram claims", async () => {
    const { context } = await loadBundledLegacyContext();
    const magicForm = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "magic"),
      weaponId: "staff_of_fire",
      spellId: "fire_wave",
      styleId: "accurate"
    });
    const result = createSimulationViewModel(magicForm, context);
    const metrics = combatRollMetrics(result);

    expect(result.request.combatStyle).toBe("magic");
    expect(result.combatRollDetail.status).toBe("modeled");
    expect(metrics.get("effective-accuracy")?.numericValue).toBe(
      result.combat.debug.effectiveAccuracy
    );
    expect(metrics.get("average-hit")?.numericValue).toBe(result.hitDistribution.averageHit);
    expect(statsSourceDetail(result, "special-attack")?.histogram).toBeNull();
    expect(statsSourceDetail(result, "cannon")?.histogram).toBeNull();
  }, 15_000);

  it("renders unavailable Stats combat roll values as fallbacks instead of zero", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const detail = createStatsCombatRollDetailViewModel({
      combat: {
        ...result.combat,
        attackRoll: Number.NaN,
        hitChance: Number.NaN,
        maxHit: Number.NaN,
        attackTicks: Number.NaN,
        attackSpeedSec: Number.NaN,
        ttkSec: Number.POSITIVE_INFINITY,
        debug: {
          ...result.combat.debug,
          effectiveAccuracy: Number.NaN
        }
      },
      trip: {
        ...result.trip,
        killsPerHour: Number.NaN,
        gpPerKill: Number.NaN
      },
      hitDistribution: {
        ...result.hitDistribution,
        averageHit: Number.NaN
      }
    });
    const metrics = new Map(detail.metrics.map((metric) => [metric.id, metric]));

    expect(detail.status).toBe("partial");
    expect(metrics.get("effective-accuracy")).toMatchObject({
      value: "-",
      numericValue: null
    });
    expect(metrics.get("attack-roll")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("hit-chance")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("average-hit")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("attack-speed")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("attack-cycle")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("ttk")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("kills-per-hour")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("gp-per-kill")).toMatchObject({ value: "-", numericValue: null });
    expect(detail.notes.join("\n")).toContain("shown as fallbacks");
  }, 15_000);

  it("builds Stats XP routing rows with player, skill and modeled loot XP rows", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const rows = new Map(result.xpRouting.rows.map((row) => [row.id, row]));
    const skillRows = result.xpRouting.rows.filter((row) => row.id.startsWith("skill-"));
    const modeledSourceTotal = result.xpRouting.rows
      .filter((row) => row.id !== "player-combat")
      .reduce((sum, row) => sum + (row.xpPerHour ?? 0), 0);

    expect(result.xpRouting.effectiveXpPerHour).toBe(result.effectiveXpPerHour);
    expect(result.xpRouting.totalXpPerHour).toBe(result.totalXpPerHour);
    expect(result.xpRouting.effectiveXpPerHourLabel).toBe(formatNumber(result.effectiveXpPerHour));
    expect(modeledSourceTotal).toBeCloseTo(result.totalXpPerHour, 6);
    expect(rows.get("player-combat")).toMatchObject({
      label: "Player combat XP/hr",
      xpPerHour: result.playerEffectiveXpPerHour,
      status: "modeled"
    });
    expect(rows.has("cannon-ranged")).toBe(false);
    expect(skillRows.length).toBeGreaterThan(0);
    expect(rows.get("skill-hp")).toMatchObject({
      label: "Hitpoints",
      status: "modeled"
    });
    expect(rows.get("prayer")).toMatchObject({
      label: "Prayer XP/hr",
      xpPerHour: result.trip.prayerXpPerKill * result.trip.effectiveKph,
      status: "modeled",
      statusLabel: "modeled"
    });
    expect(rows.get("prayer")?.note).toContain("Bury XP");
    expect(rows.get("alch")).toMatchObject({
      label: "Magic (alch) XP/hr",
      xpPerHour: 0,
      value: "0",
      status: "modeled",
      statusLabel: "modeled"
    });
  }, 15_000);

  it("adapts the composed full simulation result as the primary numeric source", async () => {
    const { context } = await loadBundledLegacyContext();
    const request = formToSimulationRequest(DEFAULT_FORM_STATE, context.gameData);
    const fullResult = simulateFullSimulation(
      {
        request,
        trip: formToTripPolicy(DEFAULT_FORM_STATE),
        ringOfWealth: DEFAULT_FORM_STATE.ringOfWealth,
        legendsComplete: true
      },
      context
    );
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const normalAttack = result.statsSourceBreakdown.rows.find(
      (row) => row.id === "normal-attack"
    );

    expect(result.combat).toEqual(fullResult.combat);
    expect(result.trip).toEqual(fullResult.trip);
    expect(result.result).toEqual(fullResult);
    expect(result.playerEffectiveXpPerHour).toBe(fullResult.xp.playerEffectiveXpPerHour);
    expect(result.cannonEffectiveXpPerHour).toBe(fullResult.xp.cannonEffectiveXpPerHour);
    expect(result.effectiveXpPerHour).toBe(fullResult.xp.effectiveXpPerHour);
    expect(result.totalXpPerHour).toBe(fullResult.xp.totalXpPerHour);
    expect(result.xpRouting.effectiveXpPerHour).toBe(fullResult.xp.effectiveXpPerHour);
    expect(result.xpRouting.totalXpPerHour).toBe(fullResult.xp.totalXpPerHour);
    expect(normalAttack).toMatchObject({
      dps: fullResult.rates.dps,
      xpPerHour: fullResult.xp.playerEffectiveXpPerHour
    });
    expect(result.warnings).toEqual(fullResult.warnings.map((warning) => warning.message));
  }, 15_000);

  it("builds Stats source breakdown rows from current combat and trip outputs", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const rows = new Map(result.statsSourceBreakdown.rows.map((row) => [row.id, row]));
    const normalDetail = statsSourceDetail(result, "normal-attack");
    const specialDetail = statsSourceDetail(result, "special-attack");
    const cannonDetail = statsSourceDetail(result, "cannon");
    const normalMetrics = statsSourceMetrics(normalDetail);
    const specialMetrics = statsSourceMetrics(specialDetail);

    expect(result.statsSourceBreakdown.rows).toHaveLength(3);
    expect(result.statsSourceBreakdown.details).toHaveLength(3);
    expect(rows.get("normal-attack")).toMatchObject({
      label: "Normal attack",
      status: "modeled",
      statusLabel: "modeled",
      dps: result.combat.dps,
      xpPerHour: result.playerEffectiveXpPerHour,
      hitChance: result.combat.hitChance,
      maxHit: result.combat.maxHit,
      supplyCostPerKill: result.trip.supply.supplyCostPerKill
    });
    expect(rows.get("normal-attack")?.supplyCostPerHour).toBeCloseTo(
      result.trip.supply.supplyCostPerKill * result.trip.effectiveKph
    );
    expect(normalDetail).toMatchObject({
      id: "normal-attack",
      label: "Normal attack",
      status: "modeled",
      statusLabel: "modeled",
      warnings: result.moneyWarnings
    });
    expect(normalDetail?.histogram).toBe(result.hitDistribution);
    expect(normalMetrics.get("dps")).toMatchObject({
      value: formatNumber(result.combat.dps, 2),
      numericValue: result.combat.dps
    });
    expect(normalMetrics.get("xp-hr")?.numericValue).toBe(result.playerEffectiveXpPerHour);
    expect(normalMetrics.get("hit-chance")).toMatchObject({
      value: `${formatNumber(result.combat.hitChance * 100, 1)}%`,
      numericValue: result.combat.hitChance
    });
    expect(rows.get("special-attack")).toMatchObject({
      label: "Special attack",
      status: "inactive",
      statusLabel: "inactive",
      dps: null,
      xpPerHour: null
    });
    expect(rows.get("special-attack")?.notes.join("\n")).toContain(
      "No supported melee/ranged DPS special selected."
    );
    expect(specialDetail).toMatchObject({
      status: "inactive",
      statusLabel: "inactive",
      histogram: null,
      warnings: []
    });
    expect(specialMetrics.get("dps")).toMatchObject({ value: "-", numericValue: null });
    expect(rows.get("cannon")).toMatchObject({
      label: "Cannon",
      status: "inactive",
      statusLabel: "inactive",
      dps: null,
      xpPerHour: null
    });
    expect(rows.get("cannon")?.notes.join("\n")).toContain("Cannon is off");
    expect(cannonDetail).toMatchObject({
      status: "inactive",
      statusLabel: "inactive",
      histogram: null,
      warnings: []
    });
  }, 15_000);

  it("marks magic special source breakdown as not modeled without adding formulas", async () => {
    const { context } = await loadBundledLegacyContext();
    const magicForm = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "magic"),
      weaponId: "staff_of_fire",
      spellId: "fire_wave",
      styleId: "accurate"
    });
    const result = createSimulationViewModel(magicForm, context);
    const special = result.statsSourceBreakdown.rows.find((row) => row.id === "special-attack");
    const detail = statsSourceDetail(result, "special-attack");
    const metrics = statsSourceMetrics(detail);

    expect(result.combat.specialAttack).toBeNull();
    expect(special).toMatchObject({
      label: "Special attack",
      status: "not-modeled",
      statusLabel: "not modeled",
      dps: null,
      xpPerHour: null,
      hitChance: null,
      maxHit: null
    });
    expect(special?.notes.join("\n")).toContain("Magic DPS special attacks are not modeled yet.");
    expect(detail).toMatchObject({
      status: "not-modeled",
      statusLabel: "not modeled",
      histogram: null,
      warnings: []
    });
    expect(metrics.get("dps")).toMatchObject({ value: "-", numericValue: null });
    expect(detail?.notes.join("\n")).toContain("Magic DPS special attacks are not modeled yet.");
  }, 15_000);

  it("models Magic alch XP from tracked in-trip alch casts", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "chaos_dwarf",
      levels: {
        attack: 70,
        strength: 72,
        defence: 60,
        hitpoints: DEFAULT_FORM_STATE.levels.hitpoints,
        ranged: 50,
        magic: 55,
        prayer: 43
      },
      prayers: ["ultimate", "incredible"],
      boosts: ["super_att", "super_str"],
      sustained: true,
      repotThreshold: 74,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        foodKey: "lobster",
        teleport: true,
        bankSeconds: 120,
        alching: true,
        prayerMode: "none"
      }
    });
    const result = createSimulationViewModel(form, context);
    const rows = new Map(result.xpRouting.rows.map((row) => [row.id, row]));
    const expectedAlchXp =
      result.trip.alchCastsPerKill * HIGH_ALCH_MAGIC_XP_PER_CAST * result.trip.effectiveKph;
    const modeledSourceTotal = result.xpRouting.rows
      .filter((row) => row.id !== "player-combat")
      .reduce((sum, row) => sum + (row.xpPerHour ?? 0), 0);

    expect(result.trip.alchCastsPerKill).toBeGreaterThan(0);
    expect(rows.get("alch")).toMatchObject({
      label: "Magic (alch) XP/hr",
      xpPerHour: expectedAlchXp,
      status: "modeled",
      statusLabel: "modeled"
    });
    expect(rows.get("alch")?.note).toContain(`${HIGH_ALCH_MAGIC_XP_PER_CAST} Magic XP/cast`);
    expect(modeledSourceTotal).toBeCloseTo(result.totalXpPerHour, 6);
  }, 15_000);

  it("adds the Stats cannon XP routing row only when cannon contributes", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = rangedDagannothForm();
    const withoutCannon = createSimulationViewModel(form, context);
    const withCannon = createSimulationViewModel(form, context, {
      dagannoth: { enabled: true, targets: 6, respawnSec: 30 }
    });
    const withoutRows = new Map(withoutCannon.xpRouting.rows.map((row) => [row.id, row]));
    const withRows = new Map(withCannon.xpRouting.rows.map((row) => [row.id, row]));
    const withoutCannonSource = withoutCannon.statsSourceBreakdown.rows.find(
      (row) => row.id === "cannon"
    );
    const withCannonSource = withCannon.statsSourceBreakdown.rows.find(
      (row) => row.id === "cannon"
    );
    const withCannonDetail = statsSourceDetail(withCannon, "cannon");
    const withCannonMetrics = statsSourceMetrics(withCannonDetail);

    expect(withoutRows.has("cannon-ranged")).toBe(false);
    expect(withRows.get("cannon-ranged")).toMatchObject({
      label: "Cannon ranged XP/hr",
      xpPerHour: withCannon.cannonEffectiveXpPerHour,
      status: "modeled"
    });
    expect(withCannon.cannonEffectiveXpPerHour).toBeGreaterThan(0);

    expect(withoutCannonSource).toMatchObject({
      label: "Cannon",
      status: "inactive"
    });
    expect(withCannonSource).toMatchObject({
      label: "Cannon",
      status: "modeled",
      dps: withCannon.trip.cannon?.cannonDps,
      xpPerHour: withCannon.cannonEffectiveXpPerHour,
      hitChance: withCannon.combat.hitChance,
      maxHit: withCannon.trip.cannon?.maxBall,
      supplyCostPerKill: withCannon.trip.supply.ballCostPerKill
    });
    expect(withCannonSource?.supplyCostPerHour).toBeCloseTo(
      withCannon.trip.supply.ballCostPerKill * withCannon.trip.effectiveKph
    );
    expect(withCannonDetail).toMatchObject({
      label: "Cannon",
      status: "modeled",
      statusLabel: "modeled",
      histogram: null
    });
    expect(withCannonMetrics.get("effective-targets")?.numericValue).toBe(
      withCannon.trip.cannon?.effTargets
    );
    expect(withCannonMetrics.get("balls-hr")?.numericValue).toBe(
      withCannon.trip.cannon?.ballsPerHour
    );
    expect(withCannonMetrics.get("respawn-bound")?.value).toBe(
      withCannon.trip.cannon?.respawnBound ? "Yes" : "No"
    );
    expect(withCannonMetrics.get("cannon-ranged-xp-hr")?.numericValue).toBe(
      withCannon.trip.cannon?.rangedXpPerHour
    );
    expect(withCannonMetrics.get("ball-cost-hour")?.numericValue).toBe(
      withCannon.trip.cannon?.ballCostPerHour
    );
    expect(withCannonMetrics.get("ball-cost-kill")?.numericValue).toBe(
      withCannon.trip.cannon?.ballCostPerKill
    );
    expect(withCannonMetrics.get("cannonballs-trip")?.numericValue).toBe(
      withCannon.trip.cannon?.ballsPerTrip
    );
    expect(withCannonMetrics.get("sparse-state")?.value).toBe(
      withCannon.trip.cannon?.idle
        ? "Idle"
        : withCannon.trip.cannon?.respawnBound
          ? "Respawn-bound"
          : "Active"
    );
  }, 15_000);

  it("builds cannon source details for idle cannon spots without inventing a histogram", async () => {
    const { context } = await loadBundledLegacyContext();
    const idleResult = createSimulationViewModel(rangedRockCrabForm(), context, {
      rock_crab: { enabled: true, targets: 1, respawnSec: 3600 }
    });
    const detail = statsSourceDetail(idleResult, "cannon");
    const metrics = statsSourceMetrics(detail);

    expect(idleResult.trip.cannon).toMatchObject({
      idle: true,
      respawnBound: false,
      cannonDps: 0
    });
    expect(detail).toMatchObject({
      status: "inactive",
      statusLabel: "inactive",
      histogram: null
    });
    expect(detail?.notes.join("\n")).toContain(
      "Idle: this spot is too sparse for the cannon to fire."
    );
    expect(metrics.get("dps")).toMatchObject({ value: "0.00", numericValue: 0 });
    expect(metrics.get("sparse-state")?.value).toBe("Idle");
    expect(metrics.get("idle")?.value).toBe("Yes");
    expect(metrics.get("respawn-bound")?.value).toBe("No");
  }, 15_000);

  it("builds the Stats Trip and banking summary from the trip result", async () => {
    const { context } = await loadBundledLegacyContext();
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
      value: "150s",
      numericValue: 150
    });
    expect(rows.get("effective-kills-hour")?.numericValue).toBe(result.trip.effectiveKph);
    expect(rows.get("supply-kill")?.numericValue).toBe(result.trip.supply.supplyCostPerKill);
    expect(rows.get("net-gp-hour")?.numericValue).toBe(result.trip.effectiveNetGpPerHour);
    expect(rows.get("trip-bound")?.value).toBe(expectedBound);
    expect(rows.get("safespot-state")?.value).toBe("Off");
    expect(rows.get("protection-state")?.label).toBe("Protection prayer");
    expect(rows.get("protection-state")?.value).toContain("active");
  }, 15_000);

  it("builds duel comparison rows for live and snapshots on the current monster", async () => {
    const { context } = await loadBundledLegacyContext();
    const snapshotForm = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged"),
      monsterId: "firegiant",
      weaponId: "magic_shortbow",
      ammoId: "mith_arrow",
      prayers: ["none"],
      boosts: ["ranging"]
    });
    const snapshot = createDuelSnapshot("snap-ranged", "Ranged saved", snapshotForm);

    const duel = createDuelComparisonViewModel(
      DEFAULT_FORM_STATE,
      { snapshots: [snapshot] },
      context
    );
    const snapshotRow = duel.snapshotRows[0]!;
    const liveVm = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const snapshotVm = createSimulationViewModel(
      normalizeFormState({
        ...snapshot.form,
        monsterId: DEFAULT_FORM_STATE.monsterId
      }),
      context
    );

    expect(duel).toMatchObject({
      monsterId: DEFAULT_FORM_STATE.monsterId,
      monsterName: context.gameData.monsters[DEFAULT_FORM_STATE.monsterId]?.name,
      snapshotCount: 1,
      snapshotLimit: MAX_DUEL_SNAPSHOTS
    });
    expect(duel.rows).toHaveLength(2);
    expect(duel.liveRow).toMatchObject({
      id: "duel-live",
      source: "live",
      snapshotId: null,
      name: "Live loadout",
      monsterId: DEFAULT_FORM_STATE.monsterId,
      combatStyle: "melee"
    });
    expect(snapshotRow).toMatchObject({
      source: "snapshot",
      snapshotId: "snap-ranged",
      name: "Ranged saved",
      monsterId: DEFAULT_FORM_STATE.monsterId,
      combatStyle: "ranged"
    });
    expect(snapshot.form.monsterId).toBe("firegiant");
    expect(snapshotRow.dps).toBeGreaterThan(0);
    expect(Number.isFinite(snapshotRow.effectiveXpPerHour)).toBe(true);
    expect(Number.isFinite(snapshotRow.effectiveNetGpPerHour)).toBe(true);
    expect(duel.liveRow.dps).toBe(liveVm.result.rates.effectiveDps);
    expect(duel.liveRow.effectiveXpPerHour).toBe(liveVm.result.xp.effectiveXpPerHour);
    expect(duel.liveRow.effectiveNetGpPerHour).toBe(
      liveVm.result.rates.effectiveNetGpPerHour
    );
    expect(snapshotRow.dps).toBe(snapshotVm.result.rates.effectiveDps);
    expect(snapshotRow.effectiveXpPerHour).toBe(snapshotVm.result.xp.effectiveXpPerHour);
    expect(snapshotRow.effectiveNetGpPerHour).toBe(
      snapshotVm.result.rates.effectiveNetGpPerHour
    );
    expect(snapshotRow.deltas.dps).toBeCloseTo(snapshotRow.dps - duel.liveRow.dps);
    expect(
      duel.rows.some(
        (row) =>
          row.best.effectiveXpPerHour || row.best.effectiveNetGpPerHour || row.best.gpPerXp
      )
    ).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain("effectiveXpPerHour");
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

  it("builds loot value composition with top contributors, tail grouping and full nested rows", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      monsterId: "firegiant"
    };
    const result = createSimulationViewModel(form, context);
    const composition = result.lootSummary.valueComposition;
    const positiveRows = result.lootRows
      .filter((row) => row.effectiveEvGp > 0)
      .sort((left, right) => right.effectiveEvGp - left.effectiveEvGp);
    const otherRow = composition.rows.find((row) => row.isOther);
    const nestedRow = result.lootRows.find((row) => row.expandedRows.length > 8);

    expect(positiveRows.length).toBeGreaterThan(8);
    expect(composition.rows[0]?.rowId).toBe(positiveRows[0]?.rowId);
    expect(composition.rows[0]?.shareOfPositivePct).toBeGreaterThan(0);
    expect(otherRow?.name).toBe("Other drops");
    expect(composition.rows.reduce((sum, row) => sum + row.gpPerKill, 0)).toBeCloseTo(
      composition.positiveGpPerKill,
      6
    );
    expect(composition.displayedGpPerKill).toBeCloseTo(result.trip.gpPerKill, 6);
    expect(nestedRow).toBeDefined();
    expect(nestedRow?.expandedRows.length).toBeGreaterThan(8);
    expect(nestedRow?.expandedRows.every((row) => row.weightLabel !== null)).toBe(true);
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
    expect(bones?.prefLabel).toBe("Bury");
    expect(bones?.effectiveEvGp).toBe(0);
    expect(bones?.valueDetails.some((detail) => detail.label === "Bury prayer XP")).toBe(true);
    const buryImpact = bones?.actionImpacts.find((impact) => impact.action === "bury");
    const lootImpact = bones?.actionImpacts.find((impact) => impact.action === "loot");
    const skipImpact = bones?.actionImpacts.find((impact) => impact.action === "skip");
    expect(buryImpact?.label).toBe("Bury");
    expect(buryImpact?.isSelected).toBe(true);
    expect(buryImpact?.isDefault).toBe(true);
    expect(buryImpact?.notes.some((note) => note.includes("prayer XP/kill"))).toBe(true);
    expect(lootImpact?.gpPerKillContribution).toBeGreaterThan(0);
    expect(skipImpact?.gpPerKillContribution).toBe(0);
  });

  it("labels trip-layer eaten or displaced loot rows in the view model when present", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        monsterId: "green_dragon",
        trip: {
          ...DEFAULT_FORM_STATE.trip,
          foodKey: "none",
          foodCount: 0,
          foodPerKillOverride: 0,
          safespot: false,
          protect: "none",
          teleport: true,
          bankSeconds: 300,
          prayerMode: "none",
          antifire: true
        }
      },
      context
    );
    const stateful = result.lootRows.find((row) => row.stateLabel !== null);

    expect(stateful).toBeDefined();
    expect(stateful?.stateLabel).toBe("Displaced by inventory");
    expect(stateful?.effectiveEvGp).toBe(0);
    expect(stateful?.valueDetails.some((detail) => detail.label === "Trip state")).toBe(true);
  });

  it("adds browser-local price history context to loot rows without changing loot math", async () => {
    const { context } = await loadBundledLegacyContext();
    const base = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const withHistory = createSimulationViewModel(
      DEFAULT_FORM_STATE,
      context,
      {},
      {},
      {},
      {
        lootPriceHistoryByItem: {
          big_bones: {
            itemId: "big_bones",
            itemLabel: "Big bones",
            latestPrice: 350,
            baselinePrice: 500,
            gpDelta: -150,
            percentDelta: -30,
            latestLabel: "Latest test prices",
            baselineLabel: "Previous test prices"
          }
        }
      }
    );
    const parentOnlyModel = createSimulationViewModel(
      { ...DEFAULT_FORM_STATE, monsterId: "firegiant" },
      context,
      {},
      {},
      {},
      { lootPriceHistoryByItem: {} }
    );
    const bones = withHistory.lootRows.find((row) => row.key === "big_bones");
    const untracked = withHistory.lootRows.find((row) => row.key && row.key !== "big_bones");
    const parentOnly = parentOnlyModel.lootRows.find((row) => row.key === null);

    expect(withHistory.trip.gpPerKill).toBeCloseTo(base.trip.gpPerKill, 6);
    expect(withHistory.trip.effectiveNetGpPerHour).toBeCloseTo(base.trip.effectiveNetGpPerHour, 6);
    expect(bones?.historyContext).toMatchObject({
      itemId: "big_bones",
      itemLabel: "Big bones",
      tracked: true,
      latestPrice: 350,
      baselinePrice: 500,
      gpDelta: -150,
      percentDelta: -30,
      statusLabel: "Tracked locally"
    });
    expect(untracked?.historyContext.statusLabel).toBe("No local history");
    expect(parentOnly?.historyContext.statusLabel).toBe("No item key");
  });

  it("normalizes malformed loot price history display numbers to a neutral missing state", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(
      DEFAULT_FORM_STATE,
      context,
      {},
      {},
      {},
      {
        lootPriceHistoryByItem: {
          big_bones: {
            itemId: "big_bones",
            latestPrice: Number.POSITIVE_INFINITY,
            baselinePrice: Number.NaN,
            gpDelta: Number.NEGATIVE_INFINITY,
            percentDelta: Number.POSITIVE_INFINITY,
            latestLabel: "Malformed latest",
            baselineLabel: "Malformed baseline"
          }
        }
      }
    );
    const bones = result.lootRows.find((row) => row.key === "big_bones");

    expect(bones?.historyContext.tracked).toBe(true);
    expect(bones?.historyContext.latestPrice).toBeNull();
    expect(bones?.historyContext.baselinePrice).toBeNull();
    expect(bones?.historyContext.gpDelta).toBeNull();
    expect(bones?.historyContext.percentDelta).toBeNull();
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

    const overrideAction = alchable.availableActions.find((action) => action !== alchable.defaultPref);
    expect(overrideAction).toBeDefined();
    if (!overrideAction) throw new Error("Expected an available loot override action");
    const summarized = createSimulationViewModel(
      form,
      context,
      {},
      { [alchable.rowId]: overrideAction },
      {
        green_dragon: {
          highAlch: true,
          overheadSec: 12.5,
          talismanSpot: "overground"
        }
      }
    );
    expect(activeAssumptionRow(summarized, "loot-settings")).toMatchObject({
      label: "Loot settings",
      reviewTab: "loot",
      detail: expect.stringContaining("high alch on"),
      resetAction: {
        target: "loot-settings",
        ariaLabel: "Reset current monster loot settings",
        statusLabel: "Current monster loot settings reset"
      }
    });
    expect(activeAssumptionRow(summarized, "loot-settings")?.detail).toContain("overhead 12.5s");
    expect(activeAssumptionRow(summarized, "loot-settings")?.detail).toContain(
      "talisman overground"
    );
    expect(activeAssumptionRow(summarized, "loot-action-overrides")).toMatchObject({
      label: "Loot action overrides",
      value: "1 drop",
      reviewTab: "loot",
      resetAction: {
        target: "loot-action-overrides",
        ariaLabel: "Reset current monster loot overrides",
        statusLabel: "Current monster loot overrides reset"
      }
    });

    const afterLootSettingsReset = createSimulationViewModel(
      form,
      context,
      {},
      { [alchable.rowId]: overrideAction },
      {}
    );
    expect(activeAssumptionRow(afterLootSettingsReset, "loot-settings")).toBeUndefined();
    expect(activeAssumptionRow(afterLootSettingsReset, "loot-action-overrides")).toBeDefined();

    const afterLootPrefsReset = createSimulationViewModel(
      form,
      context,
      {},
      {},
      {
        green_dragon: {
          highAlch: true,
          overheadSec: 12.5,
          talismanSpot: "overground"
        }
      }
    );
    expect(activeAssumptionRow(afterLootPrefsReset, "loot-settings")).toBeDefined();
    expect(activeAssumptionRow(afterLootPrefsReset, "loot-action-overrides")).toBeUndefined();
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
    const activeVm = createSimulationViewModel(DEFAULT_FORM_STATE, context);
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
    expect(activeRow?.dps).toBe(activeVm.result.rates.effectiveDps);
    expect(activeRow?.xpPerHour).toBe(activeVm.result.xp.effectiveXpPerHour);
    expect(activeRow?.netGpPerHour).toBe(activeVm.result.rates.effectiveNetGpPerHour);
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
    expect(rockCrabRow?.dps).toBe(customVm.result.rates.effectiveDps);
    expect(rockCrabRow?.xpPerHour).toBe(customVm.result.xp.effectiveXpPerHour);
    expect(rockCrabRow?.netGpPerHour).toBe(customVm.result.rates.effectiveNetGpPerHour);
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

  it("scales dense compare XP and net GP affordances against the visible rows", () => {
    const row = (
      monsterId: string,
      xpPerHour: number,
      netGpPerHour: number
    ): DenseCompareRowViewModel => ({
      monsterId,
      monsterName: monsterId,
      monsterLevel: null,
      isActiveTarget: false,
      isForcedVisible: false,
      isIrrelevant: false,
      hasCustomSetup: false,
      hasHighAlchOverride: false,
      hasOverheadOverride: false,
      markers: [],
      hitChance: 0,
      maxHit: 0,
      dps: 0,
      ttkSec: 0,
      killsPerHour: 0,
      xpPerHour,
      gpPerKill: 0,
      gpPerHour: 0,
      netGpPerHour,
      bound: "none"
    });
    const rows = [row("visible-low", 50, -100), row("visible-best", 200, 300), row("visible-loss", 100, -400)];
    const scales = createDenseCompareScaleModel(rows);

    expect(scales["visible-best"].xpPerHour).toMatchObject({
      value: 200,
      widthPercent: 100,
      tone: "positive"
    });
    expect(scales["visible-low"].xpPerHour.widthPercent).toBeCloseTo(25);
    expect(scales["visible-best"].netGpPerHour).toMatchObject({
      value: 300,
      widthPercent: 100,
      tone: "positive"
    });
    expect(scales["visible-loss"].netGpPerHour).toMatchObject({
      value: -400,
      widthPercent: 100,
      tone: "negative"
    });
    expect(scales["visible-low"].netGpPerHour.widthPercent).toBeCloseTo(25);
    expect(scales["visible-loss"].netGpPerHour.ariaLabel).toContain("loss scaled to visible rows");
  });

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

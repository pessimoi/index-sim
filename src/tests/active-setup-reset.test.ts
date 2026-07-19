import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  ACTIVE_SETUP_RESET_NOOP_NOTICE,
  ACTIVE_SETUP_RESET_STALE_NOTICE,
  INITIAL_ACTIVE_SETUP_RESET_STATE,
  activeSetupResetCandidateIsCurrent,
  cancelActiveSetupReset,
  consumeActiveSetupReset,
  createActiveSetupResetCandidate,
  createCanonicalActiveForm,
  invalidateStaleActiveSetupReset,
  openActiveSetupReset
} from "../app/state/active-setup-reset";
import {
  DEFAULT_FORM_STATE,
  createDefaultPerStyleLoadouts,
  normalizeFormState,
  savedSetupFromForm,
  setCustomSetupForMonster,
  switchCombatStyleLoadout,
  type CombatSetupFormState,
  type SavedSetupState,
  type SetupMode
} from "../app/state/ui-state";

const { context } = createGeneratedRuntimeContext();

function experimentedForm(monsterId = "rock_crab"): CombatSetupFormState {
  const ranged = switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged");
  return normalizeFormState({
    ...ranged,
    monsterId,
    weaponId: "yew_longbow",
    ammoId: "addy_arrow",
    styleId: "longrange",
    levels: {
      attack: 74,
      strength: 75,
      defence: 76,
      hitpoints: 77,
      ranged: 78,
      magic: 79,
      prayer: 80
    },
    gear: { ...ranged.gear, body: "black_dhide_body" },
    prayers: ["clarity", "steel_skin"],
    boosts: ["ranging"],
    sustained: false,
    repotThreshold: null,
    specialAttack: { weaponId: "magic_shortbow", ammoId: "rune_arrow" },
    manualOverrides: { accuracyBonus: 12, damageBonus: 8, attackSpeedSec: 3.2 },
    perStyleLoadouts: {
      ...ranged.perStyleLoadouts,
      melee: {
        ...ranged.perStyleLoadouts.melee,
        weaponId: "dragon_halberd",
        gear: { ...ranged.perStyleLoadouts.melee.gear, shield: "none" },
        prayers: ["clarity"],
        boosts: ["super_def"],
        specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" },
        manualOverrides: { accuracyBonus: 9, damageBonus: null, attackSpeedSec: null }
      },
      ranged: {
        ...ranged.perStyleLoadouts.ranged,
        weaponId: "yew_longbow",
        ammoId: "addy_arrow",
        styleId: "longrange",
        gear: { ...ranged.perStyleLoadouts.ranged.gear, body: "black_dhide_body" },
        prayers: ["clarity", "steel_skin"],
        boosts: ["ranging"],
        sustained: false,
        repotThreshold: null,
        specialAttack: { weaponId: "magic_shortbow", ammoId: "rune_arrow" },
        manualOverrides: { accuracyBonus: 12, damageBonus: 8, attackSpeedSec: 3.2 }
      },
      magic: {
        ...ranged.perStyleLoadouts.magic,
        spellId: "fire_wave",
        prayers: ["steel_skin"],
        boosts: ["magic"],
        manualOverrides: { accuracyBonus: null, damageBonus: 11, attackSpeedSec: null }
      }
    },
    ringOfWealth: true,
    trip: {
      ...ranged.trip,
      foodKey: "swordfish",
      teleport: false,
      bankSeconds: 45,
      prayerMode: "altar",
      altarSeconds: 12,
      recoilRings: 3,
      scarceSpot: true,
      targetsAtSpot: 2,
      respawnSeconds: 20
    },
    plannerTargets: { attack: 90, strength: 91, defence: 92, ranged: 93, magic: 94 }
  });
}

function setupFixture(mode: SetupMode = "default"): SavedSetupState {
  const form = experimentedForm();
  const unrelatedCustom = normalizeFormState({
    ...DEFAULT_FORM_STATE,
    monsterId: "giant",
    levels: { ...DEFAULT_FORM_STATE.levels, attack: 67 }
  });
  let customSetups = setCustomSetupForMonster({}, unrelatedCustom);
  if (mode === "custom") customSetups = setCustomSetupForMonster(customSetups, form);
  return savedSetupFromForm(
    form,
    {
      monsterFilter: "dragon",
      dropFilter: "bones",
      showIrrelevant: false,
      irrelevantMonsterIds: ["giant"],
      sort: { key: "xpPerHour", direction: "desc" }
    },
    { rock_crab: { enabled: true, targets: 3, respawnSec: null } },
    customSetups,
    normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "lesser_demon",
      levels: { ...DEFAULT_FORM_STATE.levels, strength: 68 }
    }),
    mode
  );
}

describe("active setup reset candidate", () => {
  it("builds fresh canonical defaults while preserving target, style and all three cache owners", () => {
    const current = experimentedForm();
    const before = JSON.stringify(current);
    const canonical = createCanonicalActiveForm(current);
    const canonicalCaches = createDefaultPerStyleLoadouts();

    expect(canonical.monsterId).toBe("rock_crab");
    expect(canonical.combatStyle).toBe("ranged");
    expect(canonical.levels).toEqual(DEFAULT_FORM_STATE.levels);
    expect(canonical.trip).toEqual(DEFAULT_FORM_STATE.trip);
    expect(canonical.plannerTargets).toEqual(DEFAULT_FORM_STATE.plannerTargets);
    expect(canonical.perStyleLoadouts).toEqual(canonicalCaches);
    expect(canonical.weaponId).toBe(canonical.perStyleLoadouts.ranged.weaponId);
    expect(canonical.ammoId).toBe(canonical.perStyleLoadouts.ranged.ammoId);
    expect(canonical.gear).toEqual(canonical.perStyleLoadouts.ranged.gear);
    expect(JSON.stringify(current)).toBe(before);
    expect(canonical).not.toBe(DEFAULT_FORM_STATE);
    expect(canonical.perStyleLoadouts).not.toBe(DEFAULT_FORM_STATE.perStyleLoadouts);
  });

  it("replaces the Default owner but preserves custom, Dense and Cannon families", () => {
    const source = setupFixture("default");
    const sourceJson = JSON.stringify(source);
    const candidate = createActiveSetupResetCandidate(7, source, context.gameData);

    expect(candidate.scope).toEqual({
      targetId: "rock_crab",
      combatStyle: "ranged",
      setupMode: "default",
      owner: "default",
      resetStyleCaches: ["melee", "ranged", "magic"]
    });
    expect(candidate.setup.form).toEqual(candidate.setup.defaultForm);
    expect(candidate.setup.setupMode).toBe("default");
    expect(candidate.setup.customSetupsByMonster).toEqual(source.customSetupsByMonster);
    expect(candidate.setup.denseCompare).toEqual(source.denseCompare);
    expect(candidate.setup.cannonByMonster).toEqual(source.cannonByMonster);
    expect(JSON.stringify(source)).toBe(sourceJson);
  });

  it("replaces only the current-target Custom owner and preserves the default and other rows", () => {
    const source = setupFixture("custom");
    const candidate = createActiveSetupResetCandidate(8, source, context.gameData);

    expect(candidate.scope.owner).toBe("current-target-custom");
    expect(candidate.setup.setupMode).toBe("custom");
    expect(candidate.setup.form).toEqual(candidate.setup.customSetupsByMonster.rock_crab);
    expect(candidate.setup.defaultForm).toEqual(source.defaultForm);
    expect(candidate.setup.customSetupsByMonster.giant).toEqual(source.customSetupsByMonster.giant);
    expect(candidate.setup.customSetupsByMonster.rock_crab).not.toEqual(
      source.customSetupsByMonster.rock_crab
    );
    expect(candidate.setup.denseCompare).toEqual(source.denseCompare);
    expect(candidate.setup.cannonByMonster).toEqual(source.cannonByMonster);
  });

  it("orders bounded labeled review groups without duplicating selected top-level loadout fields", () => {
    const candidate = createActiveSetupResetCandidate(9, setupFixture(), context.gameData);

    expect(candidate.review.targetLabel).toBe("Rock Crab");
    expect(candidate.review.combatStyleLabel).toBe("Ranged");
    expect(candidate.review.ownerLabel).toBe("Default");
    expect(candidate.review.groups.map((group) => group.label)).toEqual([
      "Player levels",
      "Loadouts and equipment",
      "Prayers and boosts",
      "Special attacks and combat overrides",
      "Trip and supplies",
      "Planner targets"
    ]);
    expect(candidate.review.groups.find((group) => group.id === "loadouts")?.subgroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "melee", label: "Melee" }),
        expect.objectContaining({ id: "ranged", label: "Ranged" }),
        expect.objectContaining({ id: "magic", label: "Magic" })
      ])
    );
    const ids = candidate.review.groups.flatMap((group) => [
      ...group.changes.map((change) => change.id),
      ...group.subgroups.flatMap((subgroup) => subgroup.changes.map((change) => change.id))
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.endsWith("-weapon"))).toEqual(
      expect.arrayContaining([
        "loadouts-melee-weapon",
        "loadouts-ranged-weapon",
        "special-overrides-melee-special-weapon",
        "special-overrides-ranged-special-weapon"
      ])
    );
    expect(ids).not.toContain("weapon");
    const renderedValues = candidate.review.groups
      .flatMap((group) => [
        ...group.changes,
        ...group.subgroups.flatMap((subgroup) => subgroup.changes)
      ])
      .flatMap((change) => [change.currentValue, change.defaultValue])
      .join("\n");
    expect(renderedValues).toContain("Dragon halberd");
    expect(renderedValues).not.toContain("dragon_halberd");
    expect(renderedValues).not.toContain("index-sim:rewrite-setup");
  });
});

describe("active setup reset transition", () => {
  it("returns a no-op notice without a consumable candidate", () => {
    const canonical = createCanonicalActiveForm(DEFAULT_FORM_STATE);
    const source = savedSetupFromForm(canonical);
    const state = openActiveSetupReset(INITIAL_ACTIVE_SETUP_RESET_STATE, source, context.gameData);

    expect(state.candidate).toBeNull();
    expect(state.notice).toBe(ACTIVE_SETUP_RESET_NOOP_NOTICE);
    expect(state.nextId).toBe(2);
  });

  it("cancels only the matching candidate and leaves stale ids unchanged", () => {
    const opened = openActiveSetupReset(
      INITIAL_ACTIVE_SETUP_RESET_STATE,
      setupFixture(),
      context.gameData
    );
    expect(cancelActiveSetupReset(opened, 999)).toBe(opened);
    expect(cancelActiveSetupReset(opened, opened.candidate!.id)).toMatchObject({
      candidate: null,
      notice: null
    });
  });

  it("invalidates any semantically changed six-family source before consume", () => {
    const source = setupFixture();
    const opened = openActiveSetupReset(INITIAL_ACTIVE_SETUP_RESET_STATE, source, context.gameData);
    const changed = {
      ...source,
      denseCompare: { ...source.denseCompare, monsterFilter: "changed" }
    };

    expect(activeSetupResetCandidateIsCurrent(opened.candidate!, source)).toBe(true);
    expect(activeSetupResetCandidateIsCurrent(opened.candidate!, changed)).toBe(false);
    expect(invalidateStaleActiveSetupReset(opened, changed)).toMatchObject({
      candidate: null,
      notice: ACTIVE_SETUP_RESET_STALE_NOTICE
    });
    expect(consumeActiveSetupReset(opened, opened.candidate!.id, changed)).toMatchObject({
      outcome: { status: "stale" },
      state: { candidate: null, notice: ACTIVE_SETUP_RESET_STALE_NOTICE }
    });
  });

  it("consumes an accepted candidate exactly once", () => {
    const source = setupFixture("custom");
    const opened = openActiveSetupReset(INITIAL_ACTIVE_SETUP_RESET_STATE, source, context.gameData);
    const first = consumeActiveSetupReset(opened, opened.candidate!.id, source);
    expect(first.outcome).toMatchObject({ status: "accepted", candidate: opened.candidate });

    const duplicate = consumeActiveSetupReset(first.state, opened.candidate!.id, source);
    expect(duplicate.outcome).toEqual({ status: "ignored" });
    expect(duplicate.state).toBe(first.state);
  });
});

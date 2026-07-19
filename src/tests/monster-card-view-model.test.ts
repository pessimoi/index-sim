import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  DEFAULT_FORM_STATE,
  formToSimulationRequest,
  normalizeFormState,
  switchCombatStyleLoadout,
  type CombatSetupFormState
} from "../app/state/ui-state";
import {
  createMonsterCardViewModel,
  createMonsterCardViewModelFromCombat,
  monsterOptions,
  type MonsterCardViewModel
} from "../app/view-models/monster-card";
import { simulateCombat } from "../domain/combat";

function rangedRockCrabForm(): CombatSetupFormState {
  return normalizeFormState({
    ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged"),
    monsterId: "rock_crab",
    weaponId: "magic_shortbow",
    ammoId: "mith_arrow",
    styleId: "rapid"
  });
}

function magicForm(): CombatSetupFormState {
  return normalizeFormState({
    ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "magic"),
    monsterId: "chaos_druid",
    weaponId: "staff_of_fire",
    spellId: "fire_wave",
    styleId: "accurate",
    boosts: ["magic"]
  });
}

function activeDefenceKeys(card: MonsterCardViewModel): string[] {
  return card.defenceRows.filter((row) => row.active).map((row) => row.key);
}

describe("MonsterCard view model", () => {
  it("maps melee stab, slash and crush styles to one active defence row", () => {
    const { context } = createGeneratedRuntimeContext();
    const cases = [
      {
        form: { ...DEFAULT_FORM_STATE, weaponId: "dragon_dagger_p", styleId: "accurate" },
        field: "defStab",
        key: "stab"
      },
      {
        form: { ...DEFAULT_FORM_STATE, weaponId: "rune_scimitar", styleId: "aggressive" },
        field: "defSlash",
        key: "slash"
      },
      {
        form: { ...DEFAULT_FORM_STATE, weaponId: "dragon_mace", styleId: "aggressive" },
        field: "defCrush",
        key: "crush"
      }
    ] as const;

    for (const testCase of cases) {
      const card = createMonsterCardViewModel(testCase.form, context);
      expect(card.activeDefenceField).toBe(testCase.field);
      expect(activeDefenceKeys(card)).toEqual([testCase.key]);
      expect(card.setupOverview.attackType).toBe(testCase.key);
    }
  });

  it("maps ranged and magic setups to their matching defence rows", () => {
    const { context } = createGeneratedRuntimeContext();
    const ranged = createMonsterCardViewModel(rangedRockCrabForm(), context);
    const magic = createMonsterCardViewModel(magicForm(), context);

    expect(ranged.activeDefenceField).toBe("defRange");
    expect(activeDefenceKeys(ranged)).toEqual(["range"]);
    expect(ranged.setupOverview.attackType).toBe("ranged");
    expect(magic.activeDefenceField).toBe("defMagic");
    expect(activeDefenceKeys(magic)).toEqual(["magic"]);
    expect(magic.setupOverview.attackType).toBe("magic");
  });

  it("keeps missing monster stat and defence fields nullable", () => {
    const { context } = createGeneratedRuntimeContext();
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

  it("builds setup badges and compact weapon, ammo and spell summaries", () => {
    const { context } = createGeneratedRuntimeContext();
    const defaultCard = createMonsterCardViewModel(DEFAULT_FORM_STATE, context, {
      hasCustomSetup: true
    });
    const rangedCard = createMonsterCardViewModel(rangedRockCrabForm(), context);
    const magicCard = createMonsterCardViewModel(magicForm(), context, {
      setupMode: "custom"
    });

    expect(defaultCard.setupBadge).toEqual({
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
    expect(magicCard.setupBadge).toEqual({
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

  it("uses a supplied combat result in the composed builder", () => {
    const { context } = createGeneratedRuntimeContext();
    const request = formToSimulationRequest(DEFAULT_FORM_STATE, context.gameData);
    const combat = simulateCombat(request, context);
    const suppliedCombat = {
      ...combat,
      debug: {
        ...combat.debug,
        accuracyBonus: 987,
        damageBonus: -321
      }
    };
    const card = createMonsterCardViewModelFromCombat(request, context, suppliedCombat);

    expect(card.setupOverview.accuracyBonus).toBe(987);
    expect(card.setupOverview.damageBonus).toBe(-321);
    expect(card.setupOverview.summary).toEqual(expect.arrayContaining(["ACC +987", "DMG -321"]));
  });

  it("keeps source monster speed in game ticks and player setup speed in seconds", () => {
    const { context } = createGeneratedRuntimeContext();
    const card = createMonsterCardViewModel(DEFAULT_FORM_STATE, context);
    const sourceSpeed = card.stats.find((row) => row.key === "attackSpeed");

    expect(sourceSpeed).toMatchObject({
      value: context.gameData.monsters[DEFAULT_FORM_STATE.monsterId].attackSpeed,
      displayValue: "6 ticks",
      accessibleValue: "6 game ticks"
    });
    expect(card.setupOverview.attackSpeedSec).toBe(2.4);
    expect(card.setupOverview.summary).toContain("Speed 2.4 s");
  });

  it("sorts target options by the visible monster label", () => {
    const { context } = createGeneratedRuntimeContext();
    const options = monsterOptions(context.gameData);

    expect(options).toHaveLength(Object.keys(context.gameData.monsters).length);
    expect(options).toEqual(
      [...options].sort((left, right) => left.label.localeCompare(right.label))
    );
    expect(new Set(options.map((option) => option.id)).size).toBe(options.length);
  });
});

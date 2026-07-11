import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  DEFAULT_FORM_STATE,
  SavedSetupSchema,
  savedSetupFromForm,
  switchCombatStyleLoadout
} from "../app/state/ui-state";
import { savedSetupCompatibilityIssues } from "../app/state/setup-compatibility";
import { createSimulationViewModel } from "../app/view-models/simulation";
import { LEGACY_GOLDEN_CASES } from "./fixtures/legacy-case-definitions";
import { createRewriteFixtureCase } from "./helpers/rewrite-fixture";

describe("rewrite browser fixture adapter", () => {
  const { context } = createGeneratedRuntimeContext({
    loadedAt: "2026-07-10T00:00:00.000Z"
  });

  it("maps every current golden case into valid rewrite-owned browser state", () => {
    const cases = LEGACY_GOLDEN_CASES.map((definition) =>
      createRewriteFixtureCase(definition, context)
    );

    expect(cases).toHaveLength(18);
    expect(cases.map((fixture) => fixture.id)).toEqual(
      LEGACY_GOLDEN_CASES.map((definition) => definition.id)
    );
    for (const fixture of cases) {
      const savedSetup = savedSetupFromForm(fixture.form, undefined, fixture.cannonByMonster);
      expect(SavedSetupSchema.safeParse(savedSetup).success, fixture.id).toBe(true);
      expect(savedSetupCompatibilityIssues(savedSetup, context.gameData), fixture.id).toEqual([]);
    }
  });

  it("produces finite visible result metrics for every mapped case", () => {
    for (const definition of LEGACY_GOLDEN_CASES) {
      const fixture = createRewriteFixtureCase(definition, context);
      const result = createSimulationViewModel(
        fixture.form,
        context,
        fixture.cannonByMonster,
        fixture.lootPrefsByMonster[fixture.form.monsterId] ?? {},
        fixture.lootSettingsByMonster,
        { includeLootRows: false }
      );
      const metrics = [
        result.combat.effectiveDps,
        result.combat.maxHit,
        result.combat.hitChance,
        result.combat.ttkSec,
        result.trip.killsPerHour,
        result.effectiveXpPerHour,
        result.trip.gpPerHour,
        result.trip.effectiveNetGpPerHour,
        result.trip.supply.supplyCostPerKill,
        result.trip.gpPerKill
      ];

      expect(metrics.every(Number.isFinite), definition.id).toBe(true);
    }
  });

  it("maps fixture-owned cannon, jewel and loot preferences into current row ids", () => {
    const cannon = createRewriteFixtureCase(
      LEGACY_GOLDEN_CASES.find(
        (definition) => definition.id === "ranged_magic_shortbow_dagannoth_cannon"
      )!,
      context
    );
    const jewel = createRewriteFixtureCase(
      LEGACY_GOLDEN_CASES.find(
        (definition) => definition.id === "melee_green_dragon_antifire_ring_of_wealth"
      )!,
      context
    );
    const loot = createRewriteFixtureCase(
      LEGACY_GOLDEN_CASES.find(
        (definition) => definition.id === "ranged_steel_knives_chaos_druid_inventory"
      )!,
      context
    );

    expect(cannon.cannonByMonster.dagannoth).toEqual({
      enabled: true,
      targets: 6,
      respawnSec: 30
    });
    expect(jewel.lootSettingsByMonster.green_dragon?.talismanSpot).toBe("overground");
    expect(Object.values(loot.lootPrefsByMonster.chaos_druid ?? {})).toContain("value");
    expect(Object.keys(loot.lootPrefsByMonster.chaos_druid ?? {})).not.toContain("Herb");
  });

  it("keeps every generated monster and combat-style result within visible numeric invariants", () => {
    for (const monsterId of Object.keys(context.gameData.monsters)) {
      for (const combatStyle of ["melee", "ranged", "magic"] as const) {
        const form = {
          ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, combatStyle),
          monsterId
        };
        const result = createSimulationViewModel(
          form,
          context,
          {},
          {},
          {},
          {
            includeLootRows: false
          }
        );
        const nonNegativeFiniteMetrics = [
          result.combat.effectiveDps,
          result.combat.maxHit,
          result.combat.attackRoll,
          result.combat.defenceRoll,
          result.combat.ttkSec,
          result.trip.killsPerHour,
          result.effectiveXpPerHour,
          result.trip.supply.supplyCostPerKill
        ];

        expect(
          nonNegativeFiniteMetrics.every((value) => Number.isFinite(value) && value >= 0),
          `${monsterId}:${combatStyle}`
        ).toBe(true);
        expect(result.combat.hitChance, `${monsterId}:${combatStyle}`).toBeGreaterThanOrEqual(0);
        expect(result.combat.hitChance, `${monsterId}:${combatStyle}`).toBeLessThanOrEqual(1);
        expect(result.trip.trip.lootFraction, `${monsterId}:${combatStyle}`).toBeGreaterThanOrEqual(
          0
        );
        expect(result.trip.trip.lootFraction, `${monsterId}:${combatStyle}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

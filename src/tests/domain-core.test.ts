import { readFileSync } from "node:fs";
import { join } from "node:path";
import fixtureSet from "./fixtures/legacy-golden.json";
import { LEGACY_GOLDEN_CASES } from "./fixtures/legacy-case-definitions";
import {
  buildLegacyInput,
  createLegacyRuntime,
  type LegacyInput,
  type LegacyRuntime
} from "./helpers/legacy-sim";
import {
  createHitDistribution,
  hitChance,
  maxHitMagic,
  maxHitMelee,
  maxHitRanged,
  resolveMeleeStance,
  simulateCombat
} from "../domain/combat";
import { loadoutToCombatBonuses, sumEquipmentBonuses } from "../domain/equipment";
import {
  EQUIPMENT_SLOTS,
  type AmmoDefinition,
  type EquipmentItemDefinition,
  type EquipmentRegistry,
  type EquipmentSlot,
  type GameDataSnapshot,
  type MonsterDefinition,
  type PriceSet,
  type SimulationContext,
  type SimulationRequest,
  type SpellDefinition,
  type WeaponDefinition
} from "../domain/shared";

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
const definitionsById = new Map(
  LEGACY_GOLDEN_CASES.map((definition) => [definition.id, definition])
);

function expectClose(
  actual: number,
  expected: unknown,
  tolerance = fixtures.tolerances.defaultNumericAbs
): void {
  expect(typeof expected).toBe("number");
  expect(Math.abs(actual - (expected as number))).toBeLessThanOrEqual(tolerance);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : ["none"];
}

function domainContextFromLegacy(runtime: LegacyRuntime): SimulationContext {
  const equipmentSource = runtime.Equipment as unknown as {
    SLOT_DEFS: Array<{ key: EquipmentSlot; items: Record<string, EquipmentItemDefinition> }>;
  };
  const equipment = Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot, {}])
  ) as EquipmentRegistry;
  for (const slotDef of equipmentSource.SLOT_DEFS) {
    equipment[slotDef.key] = slotDef.items;
  }
  const gameDataSource = runtime.GameData as unknown as {
    ITEM_PRICES: Record<string, number>;
    ALCH_VALUES?: Record<string, number>;
  };
  const gameData: GameDataSnapshot = {
    id: "legacy-vm",
    label: "Legacy VM snapshot",
    items: {},
    monsters: Object.fromEntries(
      runtime.GameData.MONSTERS.map((monster) => [
        monster.id,
        monster as unknown as MonsterDefinition
      ])
    ),
    weapons: runtime.SimEngine.WEAPONS as unknown as Record<string, WeaponDefinition>,
    ammo: runtime.SimEngine.ARROWS as Record<string, AmmoDefinition>,
    spells: runtime.SimEngine.SPELLS as Record<string, SpellDefinition>,
    equipment
  };
  const priceSet: PriceSet = {
    id: "legacy-vm-prices",
    label: "Legacy embedded prices",
    source: "bundled",
    createdAt: "2026-07-05",
    itemPrices: gameDataSource.ITEM_PRICES,
    alchValues: gameDataSource.ALCH_VALUES ?? {}
  };

  return { gameData, priceSet };
}

function domainRequestFromLegacyInput(input: LegacyInput): SimulationRequest {
  const specWeapon = optionalString(input.specWeapon);
  const specAmmo = optionalString(input.specAmmo);
  const spellId = optionalString(input.spell);
  return {
    combatStyle: input.combatType,
    monsterId: input.monster.id,
    levels: {
      attack: input.attack,
      strength: input.strength,
      defence: input.defence,
      ranged: input.ranged,
      magic: input.magic,
      prayer: input.prayer
    },
    loadout: {
      weaponId: input.weapon,
      ammoId: input.ammo,
      gear: input.gear
    },
    styleId: input.style,
    prayers: { keys: stringArray(input.prayers) },
    boosts: { keys: stringArray(input.boosts) },
    sustained: Boolean(input.sustained),
    repotThreshold: typeof input.repotThreshold === "number" ? input.repotThreshold : null,
    spellId,
    charge: typeof input.charge === "boolean" ? input.charge : undefined,
    specialAttack:
      specWeapon && specWeapon !== "none" ? { weaponId: specWeapon, ammoId: specAmmo } : undefined
  };
}

describe("pure combat formulas", () => {
  it("matches legacy max-hit and hit-chance equations", () => {
    expect(maxHitMelee(90, 44)).toBe(15);
    expect(maxHitRanged(86, 49)).toBe(15);
    expect(maxHitMagic(20, 0)).toBe(20);
    expect(hitChance(10_000, 5_000)).toBeCloseTo(0.7499500049995);
    expect(hitChance(5_000, 10_000)).toBeCloseTo(0.24997500249975);
  });

  it("builds a bounded hit distribution with miss and max-hit buckets", () => {
    const distribution = createHitDistribution({
      hitChance: 0.75,
      averageHit: 7.5,
      maxHit: 20,
      peakMaxHit: 20
    });
    const miss = distribution.buckets[0]!;
    const max = distribution.buckets.at(-1)!;

    expect(miss).toMatchObject({
      id: "miss-zero",
      label: "Miss / 0",
      minDamage: 0,
      maxDamage: 0,
      isMiss: true
    });
    expect(miss.probability).toBeCloseTo(0.25 + 0.75 / 21);
    expect(max).toMatchObject({ label: "20", isMaxHit: true });
    expect(max.probability).toBeCloseTo(0.75 / 21);
    expect(distribution.probabilityTotal).toBeCloseTo(1);
  });

  it("resolves melee stance ids through the equipped weapon", () => {
    const context = domainContextFromLegacy(createLegacyRuntime());

    expect(resolveMeleeStance("dragon_halberd", "accurate", context.gameData)).toMatchObject({
      id: "controlled",
      type: "stab"
    });
    expect(
      resolveMeleeStance("dragon_dagger_p", "aggressive_slash", context.gameData)
    ).toMatchObject({
      id: "aggressive_slash",
      type: "slash"
    });
  });

  it("applies bounded manual combat overrides without changing the derived default path", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("melee_rune_scimitar_hill_giant_super_prayers");
    expect(definition).toBeDefined();
    if (!definition) {
      throw new Error("Missing melee_rune_scimitar_hill_giant_super_prayers case definition");
    }

    const baseRequest = domainRequestFromLegacyInput(buildLegacyInput(runtime, definition));
    const derived = simulateCombat(baseRequest, context);
    const overridden = simulateCombat(
      {
        ...baseRequest,
        manualOverrides: {
          accuracyBonus: 350,
          damageBonus: 200,
          attackSpeedSec: 1.2
        }
      },
      context
    );
    const invalid = simulateCombat(
      {
        ...baseRequest,
        manualOverrides: {
          accuracyBonus: Number.POSITIVE_INFINITY,
          damageBonus: -999,
          attackSpeedSec: 0
        }
      },
      context
    );

    expect(overridden.debug.accuracyBonus).toBe(350);
    expect(overridden.debug.damageBonus).toBe(200);
    expect(overridden.attackSpeedSec).toBe(1.2);
    expect(overridden.hitChance).toBeGreaterThan(derived.hitChance);
    expect(overridden.maxHit).toBeGreaterThan(derived.maxHit);
    expect(overridden.dps).toBeGreaterThan(derived.dps);
    expect(invalid.debug.accuracyBonus).toBe(derived.debug.accuracyBonus);
    expect(invalid.debug.damageBonus).toBe(derived.debug.damageBonus);
    expect(invalid.attackSpeedSec).toBe(derived.attackSpeedSec);
  });

  it("uses source-backed NPC size for dragon halberd selected-target hits", () => {
    const runtime = createLegacyRuntime();
    const legacyContext = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("melee_dragon_halberd_rock_crab_small_target_spec");
    expect(definition).toBeDefined();
    if (!definition) throw new Error("Missing dragon halberd golden definition");
    const request = domainRequestFromLegacyInput(buildLegacyInput(runtime, definition));
    const withSize = (size: number): SimulationContext => ({
      ...legacyContext,
      gameData: {
        ...legacyContext.gameData,
        monsters: {
          ...legacyContext.gameData.monsters,
          [request.monsterId]: {
            ...legacyContext.gameData.monsters[request.monsterId],
            size
          }
        }
      }
    });

    const legacy = simulateCombat(request, legacyContext);
    const small = simulateCombat(request, withSize(1));
    const large = simulateCombat(request, withSize(2));

    expect(legacy.specialAttack?.hits).toBe(2);
    expect(legacy.warnings.map((warning) => warning.code)).toContain(
      "dragon-halberd-npc-size-fallback"
    );
    expect(small.specialAttack?.hits).toBe(1);
    expect(small.specialAttack?.expPerSpec).toBeCloseTo((large.specialAttack?.expPerSpec ?? 0) / 2);
    expect(small.warnings).toEqual([]);
    expect(large.specialAttack?.hits).toBe(2);
    expect(large.warnings).toEqual([]);
  });
});

describe("pure equipment core", () => {
  it("sums weapon, ammo and gear bonuses without browser globals", () => {
    const context = domainContextFromLegacy(createLegacyRuntime());
    const twoHanded = sumEquipmentBonuses(
      {
        weaponId: "magic_shortbow",
        ammoId: "rune_arrow",
        gear: { shield: "unholy_book" }
      },
      context.gameData
    );
    expect(twoHanded.rngAtt).toBe(118);
    expect(twoHanded.prayer).toBe(0);

    const thrown = sumEquipmentBonuses(
      {
        weaponId: "steel_knife_w",
        ammoId: "none",
        gear: { shield: "unholy_book" }
      },
      context.gameData
    );
    expect(thrown.rngAtt).toBe(15);
    expect(thrown.rngStr).toBe(7);
    expect(thrown.prayer).toBe(5);
  });

  it("maps summed bonuses into combat input fields", () => {
    const context = domainContextFromLegacy(createLegacyRuntime());
    const bonuses = loadoutToCombatBonuses(
      {
        weaponId: "dragon_dagger_p",
        ammoId: "none",
        gear: { amulet: "amu_power", boots: "climbing_boots" }
      },
      "melee",
      context.gameData
    );

    expect(bonuses.accByType).toEqual({ stab: 46, slash: 31, crush: 2 });
    expect(bonuses.dmgBonus).toBe(48);
    expect(bonuses.attackSpeed).toBe(4);
  });
});

describe("combat/equipment domain parity with legacy golden fixtures", () => {
  for (const testCase of fixtures.cases) {
    it(`matches ported combat fields for ${testCase.id}`, () => {
      const runtime = createLegacyRuntime();
      const context = domainContextFromLegacy(runtime);
      const definition = definitionsById.get(testCase.id);
      expect(definition, `Missing case definition for ${testCase.id}`).toBeDefined();
      if (!definition) throw new Error(`Missing case definition for ${testCase.id}`);

      const legacyInput = buildLegacyInput(runtime, definition);
      const result = simulateCombat(domainRequestFromLegacyInput(legacyInput), context);

      expect(result.combatStyle).toBe(testCase.expected.combatType);
      expectClose(result.maxHit, testCase.expected.maxHit);
      expectClose(result.peakMaxHit, testCase.expected.peakMaxHit);
      expectClose(result.hitChance, testCase.expected.hitChance);
      expectClose(result.avgHit, testCase.expected.avgHit);
      expectClose(result.dps, testCase.expected.dps);
      expectClose(result.effectiveDps, testCase.expected.effDps);

      const expectedSpec = testCase.expected.spec as Record<string, unknown> | null;
      if (expectedSpec) {
        expect(result.specialAttack?.key).toBe(expectedSpec.key);
        expectClose(result.specialAttack?.maxHit ?? NaN, expectedSpec.maxHit);
        expectClose(result.specialAttack?.hitChance ?? NaN, expectedSpec.hitChance);
        expectClose(result.specialAttack?.expPerSpec ?? NaN, expectedSpec.expPerSpec);
        expectClose(result.specialAttack?.specsPerHour ?? NaN, expectedSpec.specsPerHour);
        expectClose(result.specialAttack?.dpsGainPct ?? NaN, expectedSpec.dpsGainPct);
      } else {
        expect(result.specialAttack).toBeNull();
      }
    });
  }
});

describe("domain boundary", () => {
  it("does not reference browser globals, persistence, network or current time", () => {
    const domainFiles = [
      "src/domain/shared/index.ts",
      "src/domain/equipment/index.ts",
      "src/domain/combat/index.ts",
      "src/domain/economy/index.ts",
      "src/domain/trip/index.ts",
      "src/domain/planner/index.ts"
    ];
    for (const file of domainFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/\b(window|document|localStorage|fetch|Date\.now|new Date)\b/);
    }
  });
});

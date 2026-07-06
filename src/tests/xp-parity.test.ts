import fixtureSet from "./fixtures/legacy-golden.json";
import { LEGACY_GOLDEN_CASES } from "./fixtures/legacy-case-definitions";
import {
  buildLegacyInput,
  createLegacyRuntime,
  type LegacyCaseDefinition,
  type LegacyInput,
  type LegacyRuntime
} from "./helpers/legacy-sim";
import { computeCombatXpBreakdown, simulateCombat } from "../domain/combat";
import {
  simulateTripLootSupply,
  type CannonSettings,
  type TripLootSupplyInput,
  type TripPolicy
} from "../domain/trip";
import {
  createGameDataSnapshotFromLegacy,
  createPriceSetFromLegacyGameData,
  type LegacySnapshotInput
} from "../data";
import type { SimulationContext, SimulationRequest } from "../domain/shared";

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
const definitionsById = new Map(
  LEGACY_GOLDEN_CASES.map((definition) => [definition.id, definition])
);
const numericRoundingGuard = 0.000000001;
const knownXpParityExclusions = new Set(["melee_ring_recoil_fire_giant_food_trip"]);

function stableNumber(value: number): number {
  return Number(value.toFixed(6));
}

function expectClose(actual: number, expected: unknown): void {
  expect(typeof expected).toBe("number");
  expect(Math.abs(stableNumber(actual) - (expected as number))).toBeLessThanOrEqual(
    fixtures.tolerances.defaultNumericAbs + numericRoundingGuard
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : ["none"];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numericField(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected numeric field ${key}`);
  }
  return value;
}

function domainContextFromLegacy(runtime: LegacyRuntime): SimulationContext {
  const gameData = createGameDataSnapshotFromLegacy({
    gameData: runtime.GameData,
    simEngine: runtime.SimEngine,
    equipment: runtime.Equipment as unknown as LegacySnapshotInput["equipment"]
  });
  const priceSet = createPriceSetFromLegacyGameData({ gameData: runtime.GameData });
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

function buildTripInput(
  runtime: LegacyRuntime,
  definition: LegacyCaseDefinition,
  context: SimulationContext
): TripLootSupplyInput {
  const legacyInput = buildLegacyInput(runtime, definition);
  const request = domainRequestFromLegacyInput(legacyInput);
  const combat = simulateCombat(request, context);
  return {
    request,
    combat,
    trip: legacyInput.trip as TripPolicy,
    lootPrefs: legacyInput.lootPrefs as Record<string, string | undefined> | undefined,
    ringOfWealth: Boolean(legacyInput.ringOfWealth),
    legendsComplete: legacyInput.legends !== false,
    cannon: legacyInput.cannon as CannonSettings | undefined,
    jewelSpot:
      (
        legacyInput.jewelSpotByMonster as Record<string, "underground" | "overground"> | undefined
      )?.[legacyInput.monster.id] ?? "underground",
    overheadSec: typeof legacyInput.overheadSec === "number" ? legacyInput.overheadSec : null
  };
}

describe("XP parity with legacy golden fixtures", () => {
  const parityCases = fixtures.cases.filter(
    (testCase) => !knownXpParityExclusions.has(testCase.id)
  );

  it("keeps known XP parity exclusions explicit", () => {
    expect([...knownXpParityExclusions].sort()).toEqual(["melee_ring_recoil_fire_giant_food_trip"]);
  });

  for (const testCase of parityCases) {
    it(`matches combat XP/hr fields for ${testCase.id}`, () => {
      const runtime = createLegacyRuntime();
      const context = domainContextFromLegacy(runtime);
      const definition = definitionsById.get(testCase.id);
      expect(definition, `Missing case definition for ${testCase.id}`).toBeDefined();
      if (!definition) throw new Error(`Missing case definition for ${testCase.id}`);

      const tripInput = buildTripInput(runtime, definition, context);
      const trip = simulateTripLootSupply(tripInput, context);
      const xp = computeCombatXpBreakdown(
        tripInput.request,
        context,
        tripInput.combat,
        trip.cannon ? { directDamageFraction: trip.combatXpDamageFraction } : undefined
      );

      expectClose(xp.combatXpPerKill * trip.killsPerHour, testCase.expected.xpPerHour);
      expectClose(xp.combatXpPerKill * trip.effectiveKph, testCase.expected.effectiveXpPerHour);

      const expectedRows = testCase.expected.skillXpBreakdown as Array<{
        key: string;
        xpPerHour: number;
      }>;
      const actualRows = new Map(
        Object.entries(xp.skillXpPerKill).map(([key, xpPerKill]) => [
          key,
          stableNumber((xpPerKill ?? 0) * trip.effectiveKph)
        ])
      );
      if (trip.cannon) {
        actualRows.set(
          "rngcannon",
          stableNumber(trip.cannon.rangedXpPerHour * trip.trip.efficiency)
        );
      }
      const comparableRows = expectedRows.filter((row) => actualRows.has(row.key));

      expect(comparableRows.length).toBeGreaterThan(0);
      for (const row of comparableRows) {
        expectClose(actualRows.get(row.key) ?? NaN, row.xpPerHour);
      }

      if (comparableRows.length === expectedRows.length) {
        const actualTotal = Array.from(actualRows.values()).reduce((sum, value) => sum + value, 0);
        expectClose(actualTotal, testCase.expected.totalXpPerHour);
      }
    });
  }
});

describe("cannon XP parity", () => {
  it("models cannon ranged XP as a separate effective XP row", () => {
    const caseId = "ranged_magic_shortbow_dagannoth_cannon";
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get(caseId);
    const fixture = fixturesById.get(caseId);
    expect(definition, `Missing case definition for ${caseId}`).toBeDefined();
    expect(fixture, `Missing golden fixture for ${caseId}`).toBeDefined();
    if (!definition || !fixture) throw new Error(`Missing test data for ${caseId}`);

    const tripInput = buildTripInput(runtime, definition, context);
    const trip = simulateTripLootSupply(tripInput, context);
    const xp = computeCombatXpBreakdown(tripInput.request, context, tripInput.combat, {
      directDamageFraction: trip.combatXpDamageFraction
    });
    const expectedRows = new Map(
      (
        fixture.expected.skillXpBreakdown as Array<{
          key: string;
          xpPerHour: number;
        }>
      ).map((row) => [row.key, row.xpPerHour])
    );
    const playerRowsTotal = Object.values(xp.skillXpPerKill).reduce(
      (sum, value) => sum + (value ?? 0) * trip.effectiveKph,
      0
    );
    const cannonXpPerHour = (trip.cannon?.rangedXpPerHour ?? 0) * trip.trip.efficiency;
    const prayerXpPerHour = trip.prayerXpPerKill * trip.effectiveKph;

    expect(trip.cannon).not.toBeNull();
    expectClose(cannonXpPerHour, expectedRows.get("rngcannon"));
    expectClose(
      playerRowsTotal + cannonXpPerHour + prayerXpPerHour,
      fixture.expected.totalXpPerHour
    );
  });
});

describe("XP parity diagnostics", () => {
  it("locates the ring-of-recoil XP/hr exclusion at recoil direct-damage attribution", () => {
    const caseId = "melee_ring_recoil_fire_giant_food_trip";
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get(caseId);
    const fixture = fixturesById.get(caseId);
    expect(definition, `Missing case definition for ${caseId}`).toBeDefined();
    expect(fixture, `Missing golden fixture for ${caseId}`).toBeDefined();
    if (!definition || !fixture) throw new Error(`Missing test data for ${caseId}`);

    const tripInput = buildTripInput(runtime, definition, context);
    const trip = simulateTripLootSupply(tripInput, context);
    const xp = computeCombatXpBreakdown(tripInput.request, context, tripInput.combat);
    const expected = fixture.expected;
    const recoil = asRecord(expected.recoil);
    const legacyEffDps = numericField(expected, "effDps");
    const legacyRecoilDps = numericField(recoil, "dps");
    const rewriteXpPerHour = xp.combatXpPerKill * trip.killsPerHour;
    const rewriteEffectiveXpPerHour = xp.combatXpPerKill * trip.effectiveKph;
    const expectedXpPerHour = numericField(expected, "xpPerHour");
    const expectedEffectiveXpPerHour = numericField(expected, "effectiveXpPerHour");
    const legacyXpDirectFraction = expectedXpPerHour / (xp.combatXpPerKill * trip.killsPerHour);
    const legacyEffectiveXpDirectFraction =
      expectedEffectiveXpPerHour / (xp.combatXpPerKill * trip.effectiveKph);
    const legacyRecoilDirectFraction = legacyEffDps / (legacyEffDps + legacyRecoilDps);
    const expectedExplainedXpGap =
      xp.combatXpPerKill * trip.killsPerHour * (1 - legacyXpDirectFraction);
    const expectedExplainedEffectiveXpGap =
      xp.combatXpPerKill * trip.effectiveKph * (1 - legacyEffectiveXpDirectFraction);

    expectClose(trip.killsPerHour, expected.killsPerHour);
    expectClose(trip.effectiveKph, expected.effectiveKph);
    expectClose(trip.trip.recoilDmgPerKill, recoil.dmgPerKill);
    expectClose(tripInput.combat.directDamageFraction, 1);
    expect(legacyXpDirectFraction).toBeLessThan(tripInput.combat.directDamageFraction);
    expectClose(legacyXpDirectFraction, legacyRecoilDirectFraction);
    expectClose(legacyEffectiveXpDirectFraction, legacyRecoilDirectFraction);
    expectClose(rewriteXpPerHour - expectedXpPerHour, expectedExplainedXpGap);
    expectClose(
      rewriteEffectiveXpPerHour - expectedEffectiveXpPerHour,
      expectedExplainedEffectiveXpGap
    );
  });
});

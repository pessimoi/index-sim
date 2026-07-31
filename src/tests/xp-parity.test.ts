import fixtureSet from "./fixtures/legacy-golden.json";
import { LEGACY_GOLDEN_CASES } from "./fixtures/legacy-case-definitions";
import {
  buildLegacyInput,
  createLegacyFixtureRuntime,
  type LegacyCaseDefinition,
  type LegacyInput,
  type LegacyRuntime
} from "./helpers/legacy-sim";
import { computeCombatXpBreakdown, simulateCombat } from "../domain/combat";
import {
  HIGH_ALCH_MAGIC_XP_PER_CAST,
  simulateTripLootSupply,
  type CannonSettings,
  type TripLootSupplyInput,
  type TripPolicy
} from "../domain/trip";
import {
  createGameDataSnapshotFromLegacy,
  createPriceSetFromLegacyGameData,
  type LegacySnapshotInput
} from "../data/legacy-adapter";
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
const acceptedXpIntentionalDeltas = new Set([
  "melee_ring_recoil_fire_giant_food_trip",
  "ranged_magic_shortbow_dagannoth_cannon"
]);

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

function modeledXpRows(
  xp: ReturnType<typeof computeCombatXpBreakdown>,
  trip: ReturnType<typeof simulateTripLootSupply>
): Map<string, number> {
  const rows = new Map<string, number>();
  for (const [key, xpPerKill] of Object.entries(xp.skillXpPerKill)) {
    const xpPerHour = (xpPerKill ?? 0) * trip.effectiveKph;
    if (xpPerHour > 0) rows.set(key, xpPerHour);
  }
  if (trip.cannon) {
    const cannonXpPerHour = trip.cannon.rangedXpPerHour * trip.trip.efficiency;
    if (cannonXpPerHour > 0) rows.set("rngcannon", cannonXpPerHour);
  }
  const prayerXpPerHour = trip.prayerXpPerKill * trip.effectiveKph;
  if (prayerXpPerHour > 0) rows.set("prayer", prayerXpPerHour);

  const alchXpPerHour = trip.alchCastsPerKill * HIGH_ALCH_MAGIC_XP_PER_CAST * trip.effectiveKph;
  if (alchXpPerHour > 0) rows.set("alch", alchXpPerHour);

  return rows;
}

function expectedXpRows(fixture: Record<string, unknown>): Map<string, number> {
  return new Map(
    (
      fixture.skillXpBreakdown as Array<{
        key: string;
        xpPerHour: number;
      }>
    ).map((row) => [row.key, row.xpPerHour])
  );
}

function expectModeledXpRowParity(caseId: string, rowKey: string): void {
  const runtime = createLegacyFixtureRuntime();
  const context = domainContextFromLegacy(runtime);
  const definition = definitionsById.get(caseId);
  const fixture = fixturesById.get(caseId);
  expect(definition, `Missing case definition for ${caseId}`).toBeDefined();
  expect(fixture, `Missing golden fixture for ${caseId}`).toBeDefined();
  if (!definition || !fixture) throw new Error(`Missing test data for ${caseId}`);

  const tripInput = buildTripInput(runtime, definition, context);
  const trip = simulateTripLootSupply(tripInput, context);
  const xp = computeCombatXpBreakdown(
    tripInput.request,
    context,
    tripInput.combat,
    trip.cannon ? { directDamageFraction: trip.combatXpDamageFraction } : undefined
  );
  const actualRows = modeledXpRows(xp, trip);
  const expectedRows = expectedXpRows(fixture.expected);

  expect(expectedRows.has(rowKey), `${caseId} should have a legacy ${rowKey} row`).toBe(true);
  expect(actualRows.has(rowKey), `${caseId} should have a rewrite ${rowKey} row`).toBe(true);
  expectClose(actualRows.get(rowKey) ?? NaN, expectedRows.get(rowKey));
  expectClose(
    Array.from(actualRows.values()).reduce((sum, value) => sum + value, 0),
    fixture.expected.totalXpPerHour
  );
}

describe("XP parity with legacy golden fixtures", () => {
  const parityCases = fixtures.cases.filter(
    (testCase) => !acceptedXpIntentionalDeltas.has(testCase.id)
  );

  it("keeps accepted XP intentional deltas explicit", () => {
    expect([...acceptedXpIntentionalDeltas].sort()).toEqual([
      "melee_ring_recoil_fire_giant_food_trip",
      "ranged_magic_shortbow_dagannoth_cannon"
    ]);
  });

  for (const testCase of parityCases) {
    it(`matches combat XP/hr fields for ${testCase.id}`, () => {
      const runtime = createLegacyFixtureRuntime();
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

      const expectedRows = expectedXpRows(testCase.expected);
      const actualRows = modeledXpRows(xp, trip);

      expect([...actualRows.keys()].sort()).toEqual([...expectedRows.keys()].sort());
      for (const [key, xpPerHour] of expectedRows) {
        expectClose(actualRows.get(key) ?? NaN, xpPerHour);
      }

      const actualTotal = Array.from(actualRows.values()).reduce((sum, value) => sum + value, 0);
      expectClose(actualTotal, testCase.expected.totalXpPerHour);
    });
  }
});

describe("cannon XP ownership", () => {
  it("models combined cannon damage, rather than theoretical cannon-only DPS, as XP", () => {
    const caseId = "ranged_magic_shortbow_dagannoth_cannon";
    const runtime = createLegacyFixtureRuntime();
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
    const actualRows = modeledXpRows(xp, trip);
    const playerRowsTotal = Object.values(xp.skillXpPerKill).reduce(
      (sum, value) => sum + (value ?? 0) * trip.effectiveKph,
      0
    );
    const cannonXpPerHour = (trip.cannon?.rangedXpPerHour ?? 0) * trip.trip.efficiency;
    const prayerXpPerHour = trip.prayerXpPerKill * trip.effectiveKph;

    expect(trip.cannon).not.toBeNull();
    expect(actualRows.get("rngcannon")).toBeCloseTo(cannonXpPerHour, 10);
    expect(cannonXpPerHour).toBeLessThan(
      (trip.cannon?.cannonOnlyDps ?? 0) * 2 * 3600 * trip.trip.efficiency
    );
    expect(Array.from(actualRows.values()).reduce((sum, value) => sum + value, 0)).toBeCloseTo(
      playerRowsTotal + cannonXpPerHour + prayerXpPerHour,
      10
    );
  });
});

describe("loot XP ownership parity", () => {
  it("models Prayer XP from bury loot rows as a total-XP source", () => {
    expectModeledXpRowParity("melee_rune_scimitar_hill_giant_super_prayers", "prayer");
  });

  it("models Magic alch XP from in-trip alch casts as a total-XP source", () => {
    expectModeledXpRowParity("melee_chaos_dwarf_alch_rune_drop", "alch");
  });
});

describe("XP intentional delta diagnostics", () => {
  it("documents the accepted ring-of-recoil XP/hr direct-damage attribution delta", () => {
    const caseId = "melee_ring_recoil_fire_giant_food_trip";
    const runtime = createLegacyFixtureRuntime();
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

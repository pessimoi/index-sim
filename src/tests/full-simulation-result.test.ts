import { LEGACY_GOLDEN_CASES } from "./fixtures/legacy-case-definitions";
import { buildLegacyInput, createLegacyRuntime } from "./helpers/legacy-sim";
import {
  domainContextFromLegacy,
  domainRequestFromLegacyInput
} from "./helpers/domain-planner";
import { computeCombatXpBreakdown, simulateCombat } from "../domain/combat";
import {
  composeFullSimulationResult,
  simulateFullSimulation,
  type FullSimulationInput
} from "../domain/simulation";
import { HIGH_ALCH_MAGIC_XP_PER_CAST, simulateTripLootSupply } from "../domain/trip";

const definitionsById = new Map(
  LEGACY_GOLDEN_CASES.map((definition) => [definition.id, definition])
);

function fullSimulationInputFromFixture(caseId: string): {
  context: ReturnType<typeof domainContextFromLegacy>;
  input: FullSimulationInput;
} {
  const definition = definitionsById.get(caseId);
  expect(definition).toBeDefined();
  if (!definition) throw new Error(`Missing fixture definition: ${caseId}`);

  const runtime = createLegacyRuntime();
  const context = domainContextFromLegacy(runtime);
  const legacyInput = buildLegacyInput(runtime, definition);
  const request = domainRequestFromLegacyInput(legacyInput);

  return {
    context,
    input: {
      request,
      trip: legacyInput.trip as FullSimulationInput["trip"],
      lootPrefs: legacyInput.lootPrefs as FullSimulationInput["lootPrefs"],
      ringOfWealth: Boolean(legacyInput.ringOfWealth),
      legendsComplete: legacyInput.legends !== false,
      cannon: legacyInput.cannon as FullSimulationInput["cannon"],
      jewelSpot:
        (
          legacyInput.jewelSpotByMonster as
            | Record<string, "underground" | "overground">
            | undefined
        )?.[legacyInput.monster.id] ?? "underground",
      overheadSec: typeof legacyInput.overheadSec === "number" ? legacyInput.overheadSec : null
    }
  };
}

describe("full simulation result contract", () => {
  it("composes current combat, trip and XP slices without changing numeric formulas", () => {
    const { context, input } = fullSimulationInputFromFixture(
      "ranged_magic_shortbow_dagannoth_cannon"
    );

    const full = simulateFullSimulation(input, context);
    const combat = simulateCombat(input.request, context);
    const trip = simulateTripLootSupply({ ...input, combat }, context);
    const xp = computeCombatXpBreakdown(
      input.request,
      context,
      combat,
      trip.cannon ? { directDamageFraction: trip.combatXpDamageFraction } : undefined
    );
    const composed = composeFullSimulationResult({ request: input.request, combat, trip, xp });
    const combatSkillXpPerHour =
      Object.values(xp.skillXpPerKill).reduce((sum, value) => sum + (value ?? 0), 0) *
      trip.effectiveKph;
    const playerEffectiveXpPerHour = xp.combatXpPerKill * trip.effectiveKph;
    const cannonEffectiveXpPerHour = (trip.cannon?.rangedXpPerHour ?? 0) * trip.trip.efficiency;
    const prayerXpPerHour = trip.prayerXpPerKill * trip.effectiveKph;
    const magicAlchXpPerHour =
      trip.alchCastsPerKill * HIGH_ALCH_MAGIC_XP_PER_CAST * trip.effectiveKph;

    expect(full).toEqual(composed);
    expect(full.combat).toEqual(combat);
    expect(full.trip).toEqual(trip);
    expect(full.xp.combat).toEqual(xp);
    expect(full.xp.playerEffectiveXpPerHour).toBeCloseTo(playerEffectiveXpPerHour, 12);
    expect(full.xp.cannonEffectiveXpPerHour).toBeCloseTo(cannonEffectiveXpPerHour, 12);
    expect(full.xp.effectiveXpPerHour).toBeCloseTo(
      playerEffectiveXpPerHour + cannonEffectiveXpPerHour,
      12
    );
    expect(full.xp.totalXpPerHour).toBeCloseTo(
      combatSkillXpPerHour + cannonEffectiveXpPerHour + prayerXpPerHour + magicAlchXpPerHour,
      12
    );
    expect(full.rates.effectiveNetGpPerHour).toBe(trip.effectiveNetGpPerHour);
    expect(full.debug.combatXpDamageFraction).toBe(trip.combatXpDamageFraction);
  });

  it("keeps warnings structured and scoped at the composed boundary", () => {
    const { context, input } = fullSimulationInputFromFixture(
      "ranged_magic_shortbow_dagannoth_cannon"
    );
    const combat = simulateCombat(input.request, context);
    const trip = simulateTripLootSupply({ ...input, combat }, context);
    const xp = computeCombatXpBreakdown(
      input.request,
      context,
      combat,
      trip.cannon ? { directDamageFraction: trip.combatXpDamageFraction } : undefined
    );
    const result = composeFullSimulationResult({
      request: input.request,
      combat: {
        ...combat,
        warnings: [{ code: "combat-note", severity: "info", message: "Combat note" }]
      },
      trip: {
        ...trip,
        warnings: [{ code: "trip-note", severity: "warning", message: "Trip note" }]
      },
      xp
    });

    expect(result.warnings).toEqual([
      { code: "combat-note", severity: "info", message: "Combat note", scope: "combat" },
      { code: "trip-note", severity: "warning", message: "Trip note", scope: "trip" }
    ]);
  });
});

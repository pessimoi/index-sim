import { computeCombatXpBreakdown, simulateCombat, type CombatXpBreakdown } from "../combat";
import {
  HIGH_ALCH_MAGIC_XP_PER_CAST,
  simulateTripLootSupply,
  type TripLootSupplyInput,
  type TripLootSupplyResult
} from "../trip";
import type {
  CombatSimulationResult,
  SimulationContext,
  SimulationRequest,
  SimulationWarning
} from "../shared";

export type FullSimulationWarningScope = "combat" | "trip" | "xp" | "economy" | "simulation";

export interface FullSimulationWarning extends SimulationWarning {
  scope: FullSimulationWarningScope;
}

export interface FullSimulationXpResult {
  combat: CombatXpBreakdown;
  playerEffectiveXpPerHour: number;
  cannonEffectiveXpPerHour: number;
  effectiveXpPerHour: number;
  combatSkillXpPerHour: number;
  prayerXpPerHour: number;
  magicAlchXpPerHour: number;
  totalXpPerHour: number;
}

export interface FullSimulationRateResult {
  dps: number;
  effectiveDps: number;
  ttkSec: number;
  cycleSec: number;
  killsPerHour: number;
  effectiveKph: number;
  gpPerKill: number;
  gpPerHour: number;
  netGpPerHour: number;
  effectiveGpPerHour: number;
  effectiveNetGpPerHour: number;
  supplyCostPerKill: number;
}

export interface FullSimulationDebugResult {
  combat: CombatSimulationResult["debug"];
  combatXpDamageFraction: number;
}

export interface FullSimulationResult {
  request: SimulationRequest;
  combat: CombatSimulationResult;
  trip: TripLootSupplyResult;
  xp: FullSimulationXpResult;
  rates: FullSimulationRateResult;
  warnings: FullSimulationWarning[];
  debug: FullSimulationDebugResult;
}

export type FullSimulationInput = Omit<TripLootSupplyInput, "combat">;

export interface FullSimulationParts {
  request: SimulationRequest;
  combat: CombatSimulationResult;
  trip: TripLootSupplyResult;
  xp: CombatXpBreakdown;
}

function scopedWarnings(
  scope: FullSimulationWarningScope,
  warnings: readonly SimulationWarning[]
): FullSimulationWarning[] {
  return warnings.map((warning) => ({ ...warning, scope }));
}

function combatSkillXpPerHour(xp: CombatXpBreakdown, trip: TripLootSupplyResult): number {
  const combatSkillXpPerKill = Object.values(xp.skillXpPerKill).reduce(
    (sum, value) => sum + (value ?? 0),
    0
  );
  return combatSkillXpPerKill * trip.effectiveKph;
}

function prayerEffectiveXpPerHour(trip: TripLootSupplyResult): number {
  return trip.prayerXpPerKill * trip.effectiveKph;
}

function alchMagicXpPerHour(trip: TripLootSupplyResult): number {
  return trip.alchCastsPerKill * HIGH_ALCH_MAGIC_XP_PER_CAST * trip.effectiveKph;
}

export function composeFullSimulationResult(parts: FullSimulationParts): FullSimulationResult {
  const { request, combat, trip, xp } = parts;
  const playerEffectiveXpPerHour = xp.combatXpPerKill * trip.effectiveKph;
  const cannonEffectiveXpPerHour = (trip.cannon?.rangedXpPerHour ?? 0) * trip.trip.efficiency;
  const effectiveXpPerHour = playerEffectiveXpPerHour + cannonEffectiveXpPerHour;
  const combatSkillXpPerHourValue = combatSkillXpPerHour(xp, trip);
  const prayerXpPerHour = prayerEffectiveXpPerHour(trip);
  const magicAlchXpPerHour = alchMagicXpPerHour(trip);

  return {
    request,
    combat,
    trip,
    xp: {
      combat: xp,
      playerEffectiveXpPerHour,
      cannonEffectiveXpPerHour,
      effectiveXpPerHour,
      combatSkillXpPerHour: combatSkillXpPerHourValue,
      prayerXpPerHour,
      magicAlchXpPerHour,
      totalXpPerHour:
        combatSkillXpPerHourValue + cannonEffectiveXpPerHour + prayerXpPerHour + magicAlchXpPerHour
    },
    rates: {
      dps: combat.dps,
      effectiveDps: combat.effectiveDps,
      ttkSec: trip.ttkSec,
      cycleSec: trip.cycleSec,
      killsPerHour: trip.killsPerHour,
      effectiveKph: trip.effectiveKph,
      gpPerKill: trip.gpPerKill,
      gpPerHour: trip.gpPerHour,
      netGpPerHour: trip.netGpPerHour,
      effectiveGpPerHour: trip.effectiveGpPerHour,
      effectiveNetGpPerHour: trip.effectiveNetGpPerHour,
      supplyCostPerKill: trip.supply.supplyCostPerKill
    },
    warnings: [
      ...scopedWarnings("combat", combat.warnings),
      ...scopedWarnings("trip", trip.warnings)
    ],
    debug: {
      combat: combat.debug,
      combatXpDamageFraction: trip.combatXpDamageFraction
    }
  };
}

export function simulateFullSimulation(
  input: FullSimulationInput,
  context: SimulationContext
): FullSimulationResult {
  const combat = simulateCombat(input.request, context);
  const trip = simulateTripLootSupply({ ...input, combat }, context);
  const xp = computeCombatXpBreakdown(
    input.request,
    context,
    combat,
    trip.cannon ? { directDamageFraction: trip.combatXpDamageFraction } : undefined
  );

  return composeFullSimulationResult({
    request: input.request,
    combat,
    trip,
    xp
  });
}

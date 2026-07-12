import { createHitDistributionMixture } from "../combat";
import { simulateFullSimulation, type FullSimulationInput } from "../simulation";
import type { EntityId, SimulationContext, SimulationWarning } from "../shared";
import {
  isStackable,
  lootPreferenceKey,
  type IncomingDamageDescriptor,
  type NormalizedIncomingAttackProfile,
  type LootBreakdownEntry,
  type TripLootSupplyResult
} from "../trip";

export const RISK_MODEL_VERSION = 2 as const;
export const DEFAULT_RISK_SAMPLE_COUNT = 10_000;
export const MIN_RISK_SAMPLE_COUNT = 100;
export const MAX_RISK_SAMPLE_COUNT = 50_000;

export interface RiskAnalysisParameters {
  targetKills: number;
  horizonMinutes: number;
  gpTarget: number;
  targetDropRowId: string | null;
  sampleCount?: number;
  seed?: number;
}

export interface DistributionSummary {
  mean: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface RiskModelCoverage {
  playerDamage: "sampled" | "mean-only";
  incomingDamage: "sampled" | "deterministic-override" | "none" | "mean-only";
  incomingModel: "Source-backed" | "Partial model" | "Compatibility fallback";
  lootOccurrence: number;
  lootQuantityCorrelation: number;
  meanOnlySources: string[];
}

export interface RiskTargetDropResult {
  rowId: string;
  name: string;
  fixedKillProbability: number;
  timedProbability: number;
}

export interface RiskAnalysisResult {
  modelVersion: typeof RISK_MODEL_VERSION;
  inputFingerprint: string;
  sampleCount: number;
  killTimeSeconds: DistributionSummary;
  foodRunsOutProbability: number;
  killsPerTrip: DistributionSummary | null;
  tripCycleMinutes: DistributionSummary | null;
  timedNetGp: DistributionSummary;
  gpTargetProbability: number;
  targetDrop: RiskTargetDropResult | null;
  coverage: RiskModelCoverage;
  warnings: SimulationWarning[];
}

export interface RiskAnalysisInput {
  simulation: FullSimulationInput;
  context: SimulationContext;
  analysis: RiskAnalysisParameters;
}

export interface RiskRandom {
  next(): number;
}

interface LootModelRow {
  rowId: string;
  name: string;
  chance: number;
  expectedGp: number;
  gpOnSuccess: number;
  slotsOnSuccess: number;
  groupId: string | null;
  activeTarget: boolean;
}

interface LootModel {
  independent: LootModelRow[];
  groups: LootModelRow[][];
  all: LootModelRow[];
  deterministicGpPerKill: number;
  occurrenceCoverage: number;
  quantityCorrelationCoverage: number;
}

interface RiskModel {
  monsterHp: number;
  hitChance: number;
  peakMaxHit: number;
  attackSpeedSec: number;
  continuousDamagePerSec: number;
  cycleExtraSec: number;
  expectedKillSeconds: number;
  incomingDescriptor: IncomingDamageDescriptor;
  deterministicFoodPerKill: number | null;
  foodHeal: number;
  foodCount: number;
  foodPrice: number;
  nonFoodSupplyCostPerKill: number;
  lootCapacity: number;
  freeAtStart: number;
  deterministicTripCap: number | null;
  bankSeconds: number;
  altarSecondsPerKill: number;
  tripCanEnd: boolean;
  loot: LootModel;
}

interface KillSample {
  seconds: number;
  foodUnits: number;
}

interface LootSample {
  gp: number;
  slots: number;
}

interface TripSample {
  kills: number;
  seconds: number;
  unbounded: boolean;
}

interface HorizonSample {
  kills: number;
  netGp: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value != null && Number.isFinite(value) ? value : fallback;
}

function normalizeAnalysis(parameters: RiskAnalysisParameters): Required<RiskAnalysisParameters> {
  return {
    targetKills: Math.round(clamp(finiteOr(parameters.targetKills, 50), 1, 10_000)),
    horizonMinutes: clamp(finiteOr(parameters.horizonMinutes, 60), 1, 1_440),
    gpTarget: clamp(finiteOr(parameters.gpTarget, 100_000), 0, 1_000_000_000),
    targetDropRowId:
      typeof parameters.targetDropRowId === "string" && parameters.targetDropRowId.length > 0
        ? parameters.targetDropRowId
        : null,
    sampleCount: Math.round(
      clamp(
        finiteOr(parameters.sampleCount, DEFAULT_RISK_SAMPLE_COUNT),
        MIN_RISK_SAMPLE_COUNT,
        MAX_RISK_SAMPLE_COUNT
      )
    ),
    seed: Math.round(finiteOr(parameters.seed, 0)) >>> 0
  };
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createRiskRandom(seed: number): RiskRandom {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    }
  };
}

function quantile(sorted: readonly number[], probability: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const position = clamp(probability, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower]! * (1 - fraction) + sorted[upper]! * fraction;
}

export function summarizeDistribution(values: readonly number[]): DistributionSummary {
  const finite = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (finite.length === 0) return { mean: 0, p10: 0, p50: 0, p90: 0 };
  return {
    mean: finite.reduce((sum, value) => sum + value, 0) / finite.length,
    p10: quantile(finite, 0.1),
    p50: quantile(finite, 0.5),
    p90: quantile(finite, 0.9)
  };
}

export function selectExclusiveLootIndex(chances: readonly number[], roll: number): number | null {
  const boundedRoll = clamp(roll, 0, 1);
  let cumulative = 0;
  for (let index = 0; index < chances.length; index += 1) {
    cumulative += clamp(finiteOr(chances[index], 0), 0, 1);
    if (boundedRoll < cumulative) return index;
  }
  return null;
}

function rowGroupsById(
  input: FullSimulationInput,
  context: SimulationContext
): Map<string, string> {
  const groups = new Map<string, string>();
  const monster = context.gameData.monsters[input.request.monsterId];
  let rowIndex = 0;
  let groupIndex = 0;
  for (const entry of monster?.loot ?? []) {
    if (Array.isArray(entry)) {
      const groupId = `group-${groupIndex}`;
      for (const drop of entry) {
        groups.set(lootPreferenceKey(drop, rowIndex), groupId);
        rowIndex += 1;
      }
      groupIndex += 1;
    } else {
      rowIndex += 1;
    }
  }
  return groups;
}

function activeLootValue(drop: LootBreakdownEntry): boolean {
  return drop.eligibilityActive && drop.pref !== "skip" && drop.pref !== "bury";
}

function lootSlotOnSuccess(drop: LootBreakdownEntry): number {
  if (
    !activeLootValue(drop) ||
    drop.pref === "alch" ||
    drop._eaten ||
    isStackable(drop.key, drop.name)
  ) {
    return 0;
  }
  return Math.max(0, drop.qtyAvg * (drop.slotFrac ?? 1));
}

function buildLootModel(
  input: FullSimulationInput,
  context: SimulationContext,
  trip: TripLootSupplyResult,
  warnings: SimulationWarning[]
): LootModel {
  const groupByRowId = rowGroupsById(input, context);
  const all = trip.lootBreakdown.map<LootModelRow>((drop) => {
    const chance = clamp(finiteOr(drop.chance, 0), 0, 1);
    const expectedGp = activeLootValue(drop) ? finiteOr(drop.evGp, 0) : 0;
    return {
      rowId: drop.rowId,
      name: drop.name,
      chance,
      expectedGp,
      gpOnSuccess: chance > 0 ? expectedGp / chance : 0,
      slotsOnSuccess: lootSlotOnSuccess(drop),
      groupId: groupByRowId.get(drop.rowId) ?? null,
      activeTarget: drop.eligibilityActive && drop.pref !== "skip" && chance > 0
    };
  });
  const grouped = new Map<string, LootModelRow[]>();
  const independent: LootModelRow[] = [];
  for (const row of all) {
    if (row.groupId) {
      const group = grouped.get(row.groupId) ?? [];
      group.push(row);
      grouped.set(row.groupId, group);
    } else {
      independent.push(row);
    }
  }
  const groups: LootModelRow[][] = [];
  for (const rows of grouped.values()) {
    const probabilityTotal = rows.reduce((sum, row) => sum + row.chance, 0);
    if (probabilityTotal <= 1 + 1e-9) {
      groups.push(rows);
    } else {
      warnings.push({
        code: "risk-loot-group-mean-only",
        severity: "warning",
        message:
          "A loot roll group has unsupported probability semantics; its expected GP remains mean-only."
      });
    }
  }
  const sampledExpectedGp = [...independent, ...groups.flat()].reduce(
    (sum, row) => sum + row.expectedGp,
    0
  );
  const totalExpectedGp = Math.abs(trip.gpPerKill);
  return {
    independent,
    groups,
    all,
    deterministicGpPerKill: trip.gpPerKill - sampledExpectedGp,
    occurrenceCoverage:
      totalExpectedGp > 0 ? clamp(Math.abs(sampledExpectedGp) / totalExpectedGp, 0, 1) : 1,
    quantityCorrelationCoverage: sampledExpectedGp === 0 ? 1 : 0
  };
}

function deterministicTripCap(trip: TripLootSupplyResult): number | null {
  if (
    trip.trip.bound === "prayer" ||
    trip.trip.bound === "recoil" ||
    trip.trip.bound === "respawn"
  ) {
    return Number.isFinite(trip.trip.killsPerTrip)
      ? Math.max(1, Math.floor(trip.trip.killsPerTrip))
      : null;
  }
  return null;
}

function buildModel(
  input: FullSimulationInput,
  context: SimulationContext,
  trip: TripLootSupplyResult,
  warnings: SimulationWarning[]
): RiskModel {
  const fullResult = simulateFullSimulation(input, context);
  const combatResult = fullResult.combat;
  const monster = context.gameData.monsters[input.request.monsterId];
  const distribution = createHitDistributionMixture(combatResult.debug.normalHitRolls);
  const modeledNormalDps = distribution.averageHit / Math.max(0.001, combatResult.attackSpeedSec);
  const calibratedKillDps =
    trip.ttkSec > 0 && monster
      ? (monster.hp + Math.max(0, combatResult.maxHit / 4)) / trip.ttkSec
      : combatResult.effectiveDps + (combatResult.poison?.dps ?? 0);
  const continuousDamagePerSec = Math.max(0, calibratedKillDps - modeledNormalDps);
  const foodPerKill = Math.max(0, trip.trip.foodPerKill);
  const noFoodPositiveDemand = trip.trip.foodHeal <= 0 && trip.incoming.netHpPerKill > 0;
  const manualFoodOverride = input.trip?.foodPerKillOverride;
  const loot = buildLootModel(input, context, trip, warnings);
  const cap = deterministicTripCap(trip);
  const hasFoodBound = foodPerKill > 0;
  const hasLootBound = loot.all.some((row) => row.slotsOnSuccess > 0);
  return {
    monsterHp: Math.max(1, finiteOr(monster?.hp, 1)),
    hitChance: clamp(combatResult.hitChance, 0, 1),
    peakMaxHit: Math.max(0, Math.round(combatResult.peakMaxHit)),
    attackSpeedSec: Math.max(0.001, combatResult.attackSpeedSec),
    continuousDamagePerSec,
    cycleExtraSec: Math.max(0, trip.cycleSec - trip.ttkSec),
    expectedKillSeconds: Math.max(0.001, trip.ttkSec),
    incomingDescriptor: trip.incoming.descriptor,
    deterministicFoodPerKill:
      manualFoodOverride != null
        ? Math.max(0, manualFoodOverride)
        : noFoodPositiveDemand
          ? 1
          : trip.incoming.descriptor.coverage === "source-backed" &&
              !trip.incoming.descriptor.safespot &&
              trip.trip.foodHeal > 0 &&
              trip.incoming.netHpPerKill > 0
            ? null
            : foodPerKill,
    foodHeal: Math.max(0, trip.trip.foodHeal),
    foodCount: Math.max(0, trip.trip.slots.foodCount),
    foodPrice: Math.max(0, trip.trip.foodPrice),
    nonFoodSupplyCostPerKill: Math.max(
      0,
      trip.supply.supplyCostPerKill - trip.supply.foodCostPerKill
    ),
    lootCapacity: Math.max(0, trip.trip.slots.lootCapacity),
    freeAtStart: Math.max(0, trip.trip.slots.freeAtStart),
    deterministicTripCap: cap,
    bankSeconds: Math.max(0, trip.trip.bankSeconds),
    altarSecondsPerKill: Math.max(0, trip.trip.altarSecPerKill),
    tripCanEnd: noFoodPositiveDemand || hasFoodBound || hasLootBound || cap != null,
    loot
  };
}

function sampleNormalDamage(model: RiskModel, random: RiskRandom): number {
  if (model.peakMaxHit <= 0 || random.next() >= model.hitChance) return 0;
  return Math.floor(random.next() * (model.peakMaxHit + 1));
}

function sampleKillSeconds(model: RiskModel, random: RiskRandom): number {
  let remainingHp = model.monsterHp;
  let elapsed = 0;
  for (let attack = 0; attack < 100_000; attack += 1) {
    elapsed += model.attackSpeedSec;
    remainingHp -=
      sampleNormalDamage(model, random) + model.continuousDamagePerSec * model.attackSpeedSec;
    if (remainingHp <= 0) return elapsed;
  }
  return 0;
}

function selectIncomingProfile(
  profiles: NormalizedIncomingAttackProfile[],
  value: number
): NormalizedIncomingAttackProfile {
  let cumulative = 0;
  for (const profile of profiles) {
    cumulative += profile.selectionProbability;
    if (value < cumulative) return profile;
  }
  return profiles[profiles.length - 1]!;
}

function sampleIncomingFoodUnits(
  model: RiskModel,
  random: RiskRandom,
  killCount: number,
  sampledKillSeconds?: number
): number {
  if (model.deterministicFoodPerKill != null) {
    return model.deterministicFoodPerKill * killCount;
  }
  const descriptor = model.incomingDescriptor;
  if (
    descriptor.coverage !== "source-backed" ||
    descriptor.safespot ||
    descriptor.profiles.length === 0 ||
    !(model.foodHeal > 0)
  ) {
    return 0;
  }
  const timingFactor =
    sampledKillSeconds != null && killCount === 1
      ? clamp(sampledKillSeconds / model.expectedKillSeconds, 0.1, 100)
      : 1;
  const attackSpeedTicks = descriptor.profiles[0]!.attackSpeedTicks;
  const expectedOpportunities =
    (model.expectedKillSeconds * killCount * timingFactor) / Math.max(0.6, attackSpeedTicks * 0.6);
  let opportunityCount = Math.floor(expectedOpportunities);
  if (random.next() < expectedOpportunities - opportunityCount) opportunityCount += 1;
  let sampledDamage = 0;
  for (let index = 0; index < Math.min(opportunityCount, 100_000); index += 1) {
    const profile = selectIncomingProfile(descriptor.profiles, random.next());
    if (random.next() >= profile.hitChance) continue;
    sampledDamage += Math.floor(random.next() * (profile.maxHit + 1));
  }
  const scaledOverlay = descriptor.overlayDamagePerKill * killCount;
  const grossExpected = descriptor.attackDamagePerKill + descriptor.overlayDamagePerKill;
  const netScale = grossExpected > 0 ? descriptor.netDamagePerKill / grossExpected : 0;
  return (Math.max(0, sampledDamage + scaledOverlay) * netScale) / model.foodHeal;
}

function sampleKill(model: RiskModel, random: RiskRandom): KillSample {
  const seconds = sampleKillSeconds(model, random);
  return {
    seconds,
    foodUnits: sampleIncomingFoodUnits(model, random, 1, seconds)
  };
}

function sampleLoot(model: LootModel, random: RiskRandom): LootSample {
  let gp = model.deterministicGpPerKill;
  let slots = 0;
  for (const row of model.independent) {
    if (row.chance > 0 && random.next() < row.chance) {
      gp += row.gpOnSuccess;
      slots += row.slotsOnSuccess;
    }
  }
  for (const group of model.groups) {
    const selectedIndex = selectExclusiveLootIndex(
      group.map((row) => row.chance),
      random.next()
    );
    if (selectedIndex != null) {
      const row = group[selectedIndex]!;
      gp += row.gpOnSuccess;
      slots += row.slotsOnSuccess;
    }
  }
  return { gp, slots };
}

function tripBoundReached(
  model: RiskModel,
  kills: number,
  foodUsed: number,
  lootSlots: number
): boolean {
  if (model.deterministicTripCap != null && kills >= model.deterministicTripCap) return true;
  if (foodUsed > model.foodCount + 1e-9) return true;
  const availableLootSlots = Math.min(
    model.lootCapacity,
    model.freeAtStart + Math.floor(Math.min(model.foodCount, foodUsed))
  );
  return lootSlots > availableLootSlots + 1e-9;
}

function sampleTrip(model: RiskModel, random: RiskRandom): TripSample {
  if (!model.tripCanEnd) return { kills: 0, seconds: 0, unbounded: true };
  let kills = 0;
  let seconds = 0;
  let foodUsed = 0;
  let lootSlots = 0;
  for (let index = 0; index < 10_000; index += 1) {
    const kill = sampleKill(model, random);
    if (!(kill.seconds > 0)) return { kills, seconds, unbounded: true };
    const nextFoodUsed = foodUsed + kill.foodUnits;
    if (nextFoodUsed > model.foodCount + 1e-9 && kills > 0) break;
    const loot = sampleLoot(model.loot, random);
    kills += 1;
    seconds += kill.seconds + model.cycleExtraSec;
    foodUsed = nextFoodUsed;
    lootSlots += loot.slots;
    if (tripBoundReached(model, kills, foodUsed, lootSlots)) break;
  }
  if (kills >= 10_000) return { kills, seconds, unbounded: true };
  seconds += model.bankSeconds + model.altarSecondsPerKill * kills;
  return { kills, seconds, unbounded: false };
}

function sampleHorizon(
  model: RiskModel,
  random: RiskRandom,
  horizonSeconds: number
): HorizonSample {
  let elapsed = 0;
  let kills = 0;
  let netGp = 0;
  let foodUsed = 0;
  let lootSlots = 0;
  let tripKills = 0;
  let progressGuard = 0;
  while (elapsed < horizonSeconds && progressGuard < 100_000) {
    progressGuard += 1;
    const kill = sampleKill(model, random);
    if (!(kill.seconds > 0)) break;
    if (foodUsed + kill.foodUnits > model.foodCount + 1e-9 && tripKills > 0) {
      const resetSeconds = model.bankSeconds + model.altarSecondsPerKill * tripKills;
      if (elapsed + resetSeconds >= horizonSeconds) break;
      elapsed += resetSeconds;
      foodUsed = 0;
      lootSlots = 0;
      tripKills = 0;
      continue;
    }
    const completion = elapsed + kill.seconds + model.cycleExtraSec;
    if (completion > horizonSeconds) break;
    const loot = sampleLoot(model.loot, random);
    elapsed = completion;
    kills += 1;
    tripKills += 1;
    foodUsed += kill.foodUnits;
    lootSlots += loot.slots;
    const sampledFoodCost = kill.foodUnits * model.foodPrice;
    netGp += loot.gp - model.nonFoodSupplyCostPerKill - sampledFoodCost;
    if (tripBoundReached(model, tripKills, foodUsed, lootSlots)) {
      const resetSeconds = model.bankSeconds + model.altarSecondsPerKill * tripKills;
      if (elapsed + resetSeconds >= horizonSeconds) break;
      elapsed += resetSeconds;
      foodUsed = 0;
      lootSlots = 0;
      tripKills = 0;
    }
  }
  return { kills, netGp };
}

function probabilityAtLeastOne(chance: number, kills: number): number {
  if (!(chance > 0) || kills <= 0) return 0;
  if (chance >= 1) return 1;
  return clamp(-Math.expm1(kills * Math.log1p(-chance)), 0, 1);
}

function coverageFor(
  input: FullSimulationInput,
  trip: TripLootSupplyResult,
  model: RiskModel
): RiskModelCoverage {
  const meanOnlySources: string[] = [];
  if (trip.cannon?.enabled) meanOnlySources.push("Cannon damage variance");
  if (model.continuousDamagePerSec > 0) meanOnlySources.push("Special, poison or overlay damage");
  if (model.loot.quantityCorrelationCoverage < 1) {
    meanOnlySources.push("Loot quantity ranges");
  }
  if (trip.incoming.netHpPerKill > 0 && trip.incoming.descriptor.coverage === "partial") {
    meanOnlySources.push("Partial incoming attack model");
  }
  if (
    trip.incoming.netHpPerKill > 0 &&
    trip.incoming.descriptor.coverage === "compatibility-fallback"
  ) {
    meanOnlySources.push("Compatibility incoming attack fallback");
  }
  return {
    playerDamage: model.peakMaxHit > 0 ? "sampled" : "mean-only",
    incomingDamage:
      input.trip?.foodPerKillOverride != null
        ? "deterministic-override"
        : trip.incoming.netHpPerKill <= 0
          ? "none"
          : trip.trip.foodHeal <= 0
            ? "mean-only"
            : trip.incoming.descriptor.coverage === "source-backed"
              ? "sampled"
              : "mean-only",
    incomingModel: trip.incoming.descriptor.sourceLabel,
    lootOccurrence: model.loot.occurrenceCoverage,
    lootQuantityCorrelation: model.loot.quantityCorrelationCoverage,
    meanOnlySources: [...new Set(meanOnlySources)]
  };
}

function fingerprintPayload(
  input: FullSimulationInput,
  context: SimulationContext,
  analysis: Required<RiskAnalysisParameters>,
  trip: TripLootSupplyResult
): string {
  const monster = context.gameData.monsters[input.request.monsterId];
  return JSON.stringify({
    modelVersion: RISK_MODEL_VERSION,
    request: input.request,
    trip: input.trip,
    cannon: input.cannon,
    lootPrefs: input.lootPrefs,
    ringOfWealth: input.ringOfWealth,
    legendsComplete: input.legendsComplete,
    jewelSpot: input.jewelSpot,
    overheadSec: input.overheadSec,
    priceSet: context.priceSet,
    monster,
    loot: trip.lootBreakdown.map((row) => [
      row.rowId,
      row.chance,
      row.qtyAvg,
      row.evGp,
      row.pref,
      row.slotFrac,
      row.eligibilityActive
    ]),
    analysis: { ...analysis, seed: 0 }
  });
}

function probabilityWarning(sampleCount: number): SimulationWarning {
  const marginPoints = (2 * Math.sqrt(0.25 / sampleCount) * 100).toFixed(1);
  return {
    code: "risk-sampling-error",
    severity: "info",
    message: `Monte Carlo probabilities have about +/-${marginPoints} percentage-point sampling error near 50%.`
  };
}

export function analyzeRisk(input: RiskAnalysisInput): RiskAnalysisResult {
  const analysis = normalizeAnalysis(input.analysis);
  const fullResult = simulateFullSimulation(input.simulation, input.context);
  const warnings: SimulationWarning[] = [probabilityWarning(analysis.sampleCount)];
  const model = buildModel(input.simulation, input.context, fullResult.trip, warnings);
  const fingerprintSource = fingerprintPayload(
    input.simulation,
    input.context,
    analysis,
    fullResult.trip
  );
  const fingerprintHash = stableHash(fingerprintSource);
  const seed = input.analysis.seed == null ? fingerprintHash : analysis.seed;
  const killTimes: number[] = [];
  const foodOutcomes: number[] = [];
  const tripKills: number[] = [];
  const tripMinutes: number[] = [];
  const blockGp: number[] = [];
  const blockKills: number[] = [];
  const remainderGp: number[] = [];
  const remainderKills: number[] = [];
  let unboundedTrips = 0;
  const horizonSeconds = analysis.horizonMinutes * 60;
  const fullHourBlocks = Math.floor(horizonSeconds / 3_600);
  const remainderSeconds = horizonSeconds % 3_600;
  const blockSeconds = horizonSeconds > 3_600 ? 3_600 : horizonSeconds;

  for (let trial = 0; trial < analysis.sampleCount; trial += 1) {
    const trialSeed = Math.imul((seed ^ trial) >>> 0, 0x9e3779b1) >>> 0;
    const trialRandom = createRiskRandom(trialSeed);
    const killSeconds = sampleKillSeconds(model, trialRandom);
    killTimes.push(killSeconds > 0 ? killSeconds : fullResult.trip.ttkSec);
    const targetFood = sampleIncomingFoodUnits(model, trialRandom, analysis.targetKills);
    foodOutcomes.push(targetFood > model.foodCount + 1e-9 ? 1 : 0);

    const trip = sampleTrip(model, trialRandom);
    if (trip.unbounded) {
      unboundedTrips += 1;
    } else {
      tripKills.push(trip.kills);
      tripMinutes.push(trip.seconds / 60);
    }

    const horizon = sampleHorizon(model, trialRandom, blockSeconds);
    blockGp.push(horizon.netGp);
    blockKills.push(horizon.kills);
    if (horizonSeconds > 3_600 && remainderSeconds > 0) {
      const remainder = sampleHorizon(model, trialRandom, remainderSeconds);
      remainderGp.push(remainder.netGp);
      remainderKills.push(remainder.kills);
    }
  }

  const timedGp: number[] = [];
  const timedKills: number[] = [];
  if (horizonSeconds <= 3_600) {
    timedGp.push(...blockGp);
    timedKills.push(...blockKills);
  } else {
    const blockRandom = createRiskRandom(seed ^ 0xa5a5a5a5);
    for (let trial = 0; trial < analysis.sampleCount; trial += 1) {
      let gp = blockGp[trial]!;
      let kills = blockKills[trial]!;
      for (let hour = 1; hour < fullHourBlocks; hour += 1) {
        const index = Math.floor(blockRandom.next() * analysis.sampleCount);
        gp += blockGp[index]!;
        kills += blockKills[index]!;
      }
      if (remainderSeconds > 0) {
        gp += remainderGp[trial]!;
        kills += remainderKills[trial]!;
      }
      timedGp.push(gp);
      timedKills.push(kills);
    }
    warnings.push({
      code: "risk-long-horizon-hour-blocks",
      severity: "info",
      message:
        "Horizons over 60 minutes are composed from deterministic independent hour blocks; trip state at an hour boundary is approximated."
    });
  }
  const gpTargetHits = timedGp.filter((value) => value >= analysis.gpTarget).length;

  if (model.continuousDamagePerSec > 0) {
    warnings.push({
      code: "risk-auxiliary-damage-mean-only",
      severity: "info",
      message:
        "Special, poison or cannon/overlay damage contributes its mean; its event variance is not sampled."
    });
  }
  if (
    fullResult.trip.incoming.netHpPerKill > 0 &&
    fullResult.trip.incoming.descriptor.coverage !== "source-backed"
  ) {
    warnings.push({
      code:
        fullResult.trip.incoming.descriptor.coverage === "partial"
          ? "risk-incoming-partial-mean-only"
          : "risk-incoming-compatibility-mean-only",
      severity: "info",
      message:
        fullResult.trip.incoming.descriptor.coverage === "partial"
          ? "Contextual or partial incoming attacks use the Trip expected value; their event variance is mean-only."
          : "Compatibility incoming damage uses the Trip expected value; its event variance is mean-only."
    });
  }
  if (model.loot.quantityCorrelationCoverage < 1) {
    warnings.push({
      code: "risk-loot-quantity-mean-only",
      severity: "info",
      message:
        "Loot occurrence is sampled, but source quantity ranges use their current average quantities."
    });
  }
  if (unboundedTrips > 0) {
    warnings.push({
      code: "risk-trip-unbounded",
      severity: "info",
      message: "Trip length is unbounded under the active food, loot and supply assumptions."
    });
  }
  if (input.simulation.trip?.foodPerKillOverride != null) {
    warnings.push({
      code: "risk-food-override-deterministic",
      severity: "info",
      message: "Manual food per kill is treated as deterministic in the food-sufficiency model."
    });
  }

  const targetRow = analysis.targetDropRowId
    ? model.loot.all.find((row) => row.rowId === analysis.targetDropRowId && row.activeTarget)
    : null;
  if (analysis.targetDropRowId && !targetRow) {
    warnings.push({
      code: "risk-target-drop-unavailable",
      severity: "warning",
      message:
        "The selected target drop is skipped, inactive or unavailable for the current monster."
    });
  }
  const timedDropProbability = targetRow
    ? timedKills.reduce((sum, kills) => sum + probabilityAtLeastOne(targetRow.chance, kills), 0) /
      analysis.sampleCount
    : 0;
  const expectedFoodPerKill =
    model.deterministicFoodPerKill ??
    (model.foodHeal > 0 ? model.incomingDescriptor.netDamagePerKill / model.foodHeal : 0);
  const foodRunsOutProbability =
    model.foodCount === 0 && expectedFoodPerKill > 0
      ? 1
      : foodOutcomes.reduce((sum, outcome) => sum + outcome, 0) / analysis.sampleCount;

  return {
    modelVersion: RISK_MODEL_VERSION,
    inputFingerprint: fingerprintHash.toString(16).padStart(8, "0"),
    sampleCount: analysis.sampleCount,
    killTimeSeconds: summarizeDistribution(killTimes),
    foodRunsOutProbability,
    killsPerTrip: unboundedTrips > 0 ? null : summarizeDistribution(tripKills),
    tripCycleMinutes: unboundedTrips > 0 ? null : summarizeDistribution(tripMinutes),
    timedNetGp: summarizeDistribution(timedGp),
    gpTargetProbability: gpTargetHits / analysis.sampleCount,
    targetDrop: targetRow
      ? {
          rowId: targetRow.rowId,
          name: targetRow.name,
          fixedKillProbability: probabilityAtLeastOne(targetRow.chance, analysis.targetKills),
          timedProbability: timedDropProbability
        }
      : null,
    coverage: coverageFor(input.simulation, fullResult.trip, model),
    warnings
  };
}

export function riskTargetDropOptions(
  input: FullSimulationInput,
  context: SimulationContext
): Array<{ id: EntityId; label: string }> {
  const result = simulateFullSimulation(input, context);
  return result.trip.lootBreakdown
    .filter((row) => row.eligibilityActive && row.pref !== "skip" && row.chance > 0)
    .map((row) => ({ id: row.rowId, label: row.name }));
}

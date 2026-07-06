import {
  createGameDataSnapshotFromLegacy,
  createPriceSetFromLegacyGameData,
  type LegacySnapshotInput
} from "../../data";
import type {
  CombatStyle,
  EntityId,
  SimulationContext,
  SimulationRequest
} from "../../domain/shared";
import {
  buildPlan,
  type PlannerInput,
  type PlannerOptions,
  type PlannerPlan
} from "../../domain/planner";
import {
  buildLegacyInput,
  createLegacyRuntime,
  type LegacyCaseDefinition,
  type LegacyInput,
  type LegacyRuntime
} from "./legacy-sim";

export interface PlannerGoldenSummary {
  combatStyle: CombatStyle;
  metric: string;
  totalXp: number;
  start: {
    dps: number;
    metricValue: number;
    weaponId: EntityId;
    spellId: EntityId | null;
  };
  end: {
    skill: string;
    to: number;
    dps: number;
    metricValue: number;
    weaponId: EntityId;
    spellId: EntityId | null;
  } | null;
  phases: Array<{
    skill: string;
    from: number;
    to: number;
    xp: number;
    cumXp: number;
    startDps: number;
    endDps: number;
    startMetric: number;
    endMetric: number;
    unlocks: string[];
  }>;
  unlocks: Array<{
    slot: string;
    type: string;
    itemId: EntityId;
    skill: string;
    level: number;
    reqSkill: string;
    reqLevel: number;
    cumXp: number;
    dpsBefore: number;
    dpsAfter: number;
  }>;
}

export function domainContextFromLegacy(runtime: LegacyRuntime): SimulationContext {
  const gameData = createGameDataSnapshotFromLegacy({
    gameData: runtime.GameData,
    simEngine: runtime.SimEngine,
    equipment: runtime.Equipment as unknown as LegacySnapshotInput["equipment"]
  });
  const priceSet = createPriceSetFromLegacyGameData({ gameData: runtime.GameData });
  return { gameData, priceSet };
}

export function domainRequestFromLegacyInput(input: LegacyInput): SimulationRequest {
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

export function plannerInputFromDefinition(
  runtime: LegacyRuntime,
  definition: LegacyCaseDefinition
): PlannerInput {
  const legacyInput = buildLegacyInput(runtime, definition);
  const request = domainRequestFromLegacyInput(legacyInput);
  return {
    request,
    trip: legacyInput.trip as PlannerInput["trip"],
    lootPrefs: legacyInput.lootPrefs as PlannerInput["lootPrefs"],
    ringOfWealth: Boolean(legacyInput.ringOfWealth),
    legendsComplete: legacyInput.legends !== false,
    jewelSpot:
      (
        legacyInput.jewelSpotByMonster as Record<string, "underground" | "overground"> | undefined
      )?.[legacyInput.monster.id] ?? "underground",
    overheadSec: typeof legacyInput.overheadSec === "number" ? legacyInput.overheadSec : null
  };
}

export function createPlannerRuntime() {
  const runtime = createLegacyRuntime();
  return {
    runtime,
    context: domainContextFromLegacy(runtime)
  };
}

export function summarizePlan(plan: PlannerPlan): PlannerGoldenSummary {
  return {
    combatStyle: plan.combatStyle,
    metric: plan.metric,
    totalXp: stableNumber(plan.totalXp),
    start: {
      dps: stableNumber(plan.start.dps),
      metricValue: stableNumber(plan.start.metricValue),
      weaponId: plan.start.cfg.weaponId,
      spellId: plan.start.cfg.spellId
    },
    end: plan.end
      ? {
          skill: plan.end.skill,
          to: plan.end.to,
          dps: stableNumber(plan.end.dps),
          metricValue: stableNumber(plan.end.metricValue),
          weaponId: plan.end.cfg.weaponId,
          spellId: plan.end.cfg.spellId
        }
      : null,
    phases: plan.phases.map((phase) => ({
      skill: phase.skill,
      from: phase.from,
      to: phase.to,
      xp: stableNumber(phase.xp),
      cumXp: stableNumber(phase.cumXp),
      startDps: stableNumber(phase.startDps),
      endDps: stableNumber(phase.endDps),
      startMetric: stableNumber(phase.startMetric),
      endMetric: stableNumber(phase.endMetric),
      unlocks: phase.unlocks.map((unlock) => unlock.itemId)
    })),
    unlocks: plan.unlocks.map((unlock) => ({
      slot: unlock.slot,
      type: unlock.type,
      itemId: unlock.itemId,
      skill: unlock.skill,
      level: unlock.level,
      reqSkill: unlock.reqSkill,
      reqLevel: unlock.reqLevel,
      cumXp: stableNumber(unlock.cumXp),
      dpsBefore: stableNumber(unlock.dpsBefore),
      dpsAfter: stableNumber(unlock.dpsAfter)
    }))
  };
}

export function buildPlannerPlanForDefinition(
  definition: LegacyCaseDefinition,
  options: PlannerOptions
) {
  const { runtime, context } = createPlannerRuntime();
  return buildPlan(plannerInputFromDefinition(runtime, definition), context, options);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : ["none"];
}

function stableNumber(value: number): number {
  return Number(value.toFixed(6));
}

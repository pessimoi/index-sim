import { computeCombatXpBreakdown, simulateCombat, weaponStances } from "@/domain/combat";
import { buildPlan, defaultPool, type PlannerPlan } from "@/domain/planner";
import type {
  CombatStyle,
  EntityId,
  GameDataSnapshot,
  SimulationContext,
  SimulationRequest
} from "@/domain/shared";
import {
  simulateTripLootSupply,
  type LootAction,
  type LootBreakdownEntry,
  type TripLootSupplyInput,
  type TripLootSupplyResult
} from "@/domain/trip";
import {
  DEFAULT_DENSE_COMPARE_SORT_STATE,
  normalizeDenseCompareSortState,
  type DenseCompareSortKey,
  type DenseCompareSortState
} from "../state/dense-compare";
import {
  type CannonByMonsterState,
  formToSimulationRequest,
  formToTripPolicy,
  type CombatSetupFormState
} from "../state/ui-state";

export interface SimulationViewModel {
  request: SimulationRequest;
  combat: ReturnType<typeof simulateCombat>;
  trip: TripLootSupplyResult;
  playerEffectiveXpPerHour: number;
  cannonEffectiveXpPerHour: number;
  effectiveXpPerHour: number;
  totalXpPerHour: number;
  warnings: string[];
  topLoot: Array<{
    name: string;
    pref: string;
    evGp: number;
    price: number;
    prayerXp: number;
  }>;
  lootRows: LootDropRowViewModel[];
  lootSummary: {
    defaultEffectiveNetGpPerHour: number;
    currentDeltaNetGpPerHour: number;
    overrideCount: number;
  };
}

export interface LootActionImpactViewModel {
  action: LootAction;
  effectiveNetGpPerHour: number;
  deltaNetGpPerHour: number;
}

export interface LootDropRowViewModel {
  rowId: string;
  name: string;
  key: string | null;
  tag: string | null;
  chance: number;
  qtyAvg: number;
  price: number;
  saleValue: number;
  evGp: number;
  pref: LootAction;
  defaultPref: LootAction;
  availableActions: LootAction[];
  actionImpacts: LootActionImpactViewModel[];
  selectedDeltaNetGpPerHour: number;
  isOverride: boolean;
  prayerXp: number;
  alchValue: number;
  slotFrac: number;
  expandedRows: Array<{
    label: string;
    weight: string | null;
    price: number | null;
  }>;
}

export interface LootOptimizeResult {
  prefs: Record<string, LootAction>;
  effectiveNetGpPerHour: number;
  baseEffectiveNetGpPerHour: number;
  deltaNetGpPerHour: number;
  iterations: number;
  changedRows: number;
  capped: boolean;
}

export interface CompareRowViewModel {
  monsterId: EntityId;
  monsterName: string;
  dps: number;
  effectiveXpPerHour: number;
  effectiveNetGpPerHour: number;
  bound: string;
}

export interface DenseCompareRowViewModel {
  monsterId: EntityId;
  monsterName: string;
  monsterLevel: number | null;
  isActiveTarget: boolean;
  hitChance: number;
  maxHit: number;
  dps: number;
  ttkSec: number;
  killsPerHour: number;
  xpPerHour: number;
  gpPerKill: number;
  gpPerHour: number;
  netGpPerHour: number;
  bound: string;
}

const denseCompareSortValue: Record<
  DenseCompareSortKey,
  (row: DenseCompareRowViewModel) => number | string
> = {
  monsterName: (row) => row.monsterName,
  hitChance: (row) => row.hitChance,
  maxHit: (row) => row.maxHit,
  dps: (row) => row.dps,
  ttkSec: (row) => row.ttkSec,
  killsPerHour: (row) => row.killsPerHour,
  xpPerHour: (row) => row.xpPerHour,
  gpPerKill: (row) => row.gpPerKill,
  gpPerHour: (row) => row.gpPerHour,
  netGpPerHour: (row) => row.netGpPerHour
};

const NATURE_RUNE_FALLBACK = 265;
const LOOT_ACTION_ORDER: LootAction[] = ["loot", "skip", "bury", "alch", "unid", "value"];
const MAX_LOOT_OPTIMIZE_ITERATIONS = 30;

function uniqueLootActions(actions: LootAction[]): LootAction[] {
  return LOOT_ACTION_ORDER.filter((action) => actions.includes(action));
}

function availableLootActions(
  drop: LootBreakdownEntry,
  alching: boolean,
  natureRuneCost: number
): LootAction[] {
  const actions: LootAction[] = ["loot", "skip"];
  if (drop.isBone) actions.push("bury");
  if (alching && drop.alchValue - natureRuneCost > 0) actions.push("alch");
  if (drop.isHerb) actions.push("unid", "value");
  if (drop.tag === "gem") actions.push("value");
  if (!actions.includes(drop.pref)) actions.push(drop.pref);
  return uniqueLootActions(actions);
}

function expandedRows(drop: LootBreakdownEntry): LootDropRowViewModel["expandedRows"] {
  if (!Array.isArray(drop._expand)) return [];
  return drop._expand.map((row, index) => {
    const record = row as Record<string, unknown>;
    return {
      label: typeof record.name === "string" ? record.name : `Row ${index + 1}`,
      weight:
        typeof record.weight === "number"
          ? formatNumber(record.weight)
          : typeof record.weight === "string"
            ? record.weight
            : null,
      price:
        typeof record.price === "number" && Number.isFinite(record.price) ? record.price : null
    };
  });
}

function tripInputFor(
  form: CombatSetupFormState,
  request: SimulationRequest,
  combat: ReturnType<typeof simulateCombat>,
  cannonByMonster: CannonByMonsterState
): TripLootSupplyInput {
  return {
    request,
    combat,
    trip: formToTripPolicy(form),
    ringOfWealth: form.ringOfWealth,
    legendsComplete: true,
    jewelSpot: "underground",
    cannon: cannonByMonster[request.monsterId]
  };
}

function simulateWithLootPrefs(
  input: TripLootSupplyInput,
  context: SimulationContext,
  lootPrefs: Record<string, LootAction | string | undefined> | undefined
): TripLootSupplyResult {
  return simulateTripLootSupply({ ...input, lootPrefs }, context);
}

function createLootRows(
  input: TripLootSupplyInput,
  context: SimulationContext,
  currentTrip: TripLootSupplyResult,
  lootPrefs: Record<string, LootAction | string | undefined>
): {
  rows: LootDropRowViewModel[];
  defaultEffectiveNetGpPerHour: number;
  currentDeltaNetGpPerHour: number;
  overrideCount: number;
} {
  const defaultTrip = simulateWithLootPrefs(input, context, undefined);
  const defaultRows = new Map(defaultTrip.lootBreakdown.map((drop) => [drop.rowId, drop]));
  const natureRuneCost = context.priceSet.itemPrices.naturerune ?? NATURE_RUNE_FALLBACK;

  const rows = currentTrip.lootBreakdown.map((drop) => {
    const defaultDrop = defaultRows.get(drop.rowId) ?? drop;
    const availableActions = availableLootActions(
      defaultDrop,
      !!input.trip?.alching,
      natureRuneCost
    );
    const actionImpacts = availableActions.map((action) => {
      const candidatePrefs: Record<string, LootAction> =
        action === defaultDrop.pref ? {} : { [drop.rowId]: action };
      const candidate = simulateWithLootPrefs(input, context, candidatePrefs);
      return {
        action,
        effectiveNetGpPerHour: candidate.effectiveNetGpPerHour,
        deltaNetGpPerHour:
          candidate.effectiveNetGpPerHour - defaultTrip.effectiveNetGpPerHour
      };
    });
    const selectedImpact = actionImpacts.find((impact) => impact.action === drop.pref);

    return {
      rowId: drop.rowId,
      name: drop.name,
      key: drop.key ?? null,
      tag: typeof drop.tag === "string" ? drop.tag : null,
      chance: drop.chance,
      qtyAvg: drop.qtyAvg,
      price: drop.price,
      saleValue: drop.saleValue,
      evGp: drop.evGp,
      pref: drop.pref,
      defaultPref: defaultDrop.pref,
      availableActions,
      actionImpacts,
      selectedDeltaNetGpPerHour: selectedImpact?.deltaNetGpPerHour ?? 0,
      isOverride: lootPrefs[drop.rowId] != null && lootPrefs[drop.rowId] !== defaultDrop.pref,
      prayerXp: drop.prayerXp,
      alchValue: drop.alchValue,
      slotFrac: drop.slotFrac,
      expandedRows: expandedRows(drop)
    };
  });

  return {
    rows,
    defaultEffectiveNetGpPerHour: defaultTrip.effectiveNetGpPerHour,
    currentDeltaNetGpPerHour:
      currentTrip.effectiveNetGpPerHour - defaultTrip.effectiveNetGpPerHour,
    overrideCount: rows.filter((row) => row.isOverride).length
  };
}

function compareNumbers(left: number, right: number, direction: "asc" | "desc"): number {
  const leftFinite = Number.isFinite(left);
  const rightFinite = Number.isFinite(right);
  if (leftFinite !== rightFinite) return leftFinite ? -1 : 1;
  if (!leftFinite && !rightFinite) return 0;
  return direction === "asc" ? left - right : right - left;
}

function compareDenseRows(
  left: DenseCompareRowViewModel,
  right: DenseCompareRowViewModel,
  sort: DenseCompareSortState
): number {
  const leftValue = denseCompareSortValue[sort.key](left);
  const rightValue = denseCompareSortValue[sort.key](right);
  const directionMultiplier = sort.direction === "asc" ? 1 : -1;

  if (typeof leftValue === "string" || typeof rightValue === "string") {
    const primary = String(leftValue).localeCompare(String(rightValue)) * directionMultiplier;
    if (primary !== 0) return primary;
  } else {
    const primary = compareNumbers(leftValue, rightValue, sort.direction);
    if (primary !== 0) return primary;
  }

  return left.monsterName.localeCompare(right.monsterName);
}

export function createSimulationViewModel(
  form: CombatSetupFormState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefs: Record<string, LootAction | string | undefined> = {},
  options: { includeLootRows?: boolean } = {}
): SimulationViewModel {
  const request = formToSimulationRequest(form, context.gameData);
  const combat = simulateCombat(request, context);
  const tripInput = tripInputFor(form, request, combat, cannonByMonster);
  const trip = simulateWithLootPrefs(tripInput, context, lootPrefs);
  const xp = computeCombatXpBreakdown(
    request,
    context,
    combat,
    trip.cannon ? { directDamageFraction: trip.combatXpDamageFraction } : undefined
  );
  const playerEffectiveXpPerHour = xp.combatXpPerKill * trip.effectiveKph;
  const cannonEffectiveXpPerHour = (trip.cannon?.rangedXpPerHour ?? 0) * trip.trip.efficiency;
  const effectiveXpPerHour = playerEffectiveXpPerHour + cannonEffectiveXpPerHour;
  const totalXpPerHour =
    Object.values(xp.skillXpPerKill).reduce((sum, value) => sum + (value ?? 0), 0) *
      trip.effectiveKph +
    cannonEffectiveXpPerHour;

  const lootRows =
    options.includeLootRows === false
      ? {
          rows: [],
          defaultEffectiveNetGpPerHour: trip.effectiveNetGpPerHour,
          currentDeltaNetGpPerHour: 0,
          overrideCount: 0
        }
      : createLootRows(tripInput, context, trip, lootPrefs);

  return {
    request,
    combat,
    trip,
    playerEffectiveXpPerHour,
    cannonEffectiveXpPerHour,
    effectiveXpPerHour,
    totalXpPerHour,
    warnings: [...combat.warnings, ...trip.warnings].map((warning) => warning.message),
    topLoot: trip.lootBreakdown
      .filter((drop) => drop.evGp > 0 || drop.prayerXp > 0)
      .sort((left, right) => right.evGp - left.evGp)
      .slice(0, 8)
      .map((drop) => ({
        name: drop.name,
        pref: drop.pref,
        evGp: drop.evGp,
        price: drop.price,
        prayerXp: drop.prayerXp
      })),
    lootRows: lootRows.rows,
    lootSummary: {
      defaultEffectiveNetGpPerHour: lootRows.defaultEffectiveNetGpPerHour,
      currentDeltaNetGpPerHour: lootRows.currentDeltaNetGpPerHour,
      overrideCount: lootRows.overrideCount
    }
  };
}

export function sortDenseCompareRows(
  rows: readonly DenseCompareRowViewModel[],
  sort: unknown = DEFAULT_DENSE_COMPARE_SORT_STATE
): DenseCompareRowViewModel[] {
  const normalizedSort = normalizeDenseCompareSortState(sort);
  return [...rows].sort((left, right) => compareDenseRows(left, right, normalizedSort));
}

export function createDenseCompareRows(
  form: CombatSetupFormState,
  context: SimulationContext,
  sort: unknown = DEFAULT_DENSE_COMPARE_SORT_STATE,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefsByMonster: Record<string, Record<string, LootAction | string | undefined>> = {}
): DenseCompareRowViewModel[] {
  const rows = Object.values(context.gameData.monsters).map((monster) => {
    const rowForm = { ...form, monsterId: monster.id };
    const vm = createSimulationViewModel(
      rowForm,
      context,
      cannonByMonster,
      lootPrefsByMonster[monster.id] ?? {},
      { includeLootRows: false }
    );
    return {
      monsterId: monster.id,
      monsterName: monster.name,
      monsterLevel: monster.level ?? null,
      isActiveTarget: monster.id === form.monsterId,
      hitChance: vm.combat.hitChance,
      maxHit: vm.combat.maxHit,
      dps: vm.combat.effectiveDps,
      ttkSec: vm.combat.ttkSec,
      killsPerHour: vm.trip.killsPerHour,
      xpPerHour: vm.effectiveXpPerHour,
      gpPerKill: vm.trip.gpPerKill,
      gpPerHour: vm.trip.gpPerHour,
      netGpPerHour: vm.trip.effectiveNetGpPerHour,
      bound: vm.trip.trip.bound
    };
  });

  return sortDenseCompareRows(rows, sort);
}

export function createCompareRows(
  form: CombatSetupFormState,
  context: SimulationContext,
  limit = 8,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefsByMonster: Record<string, Record<string, LootAction | string | undefined>> = {}
): CompareRowViewModel[] {
  return createDenseCompareRows(
    form,
    context,
    DEFAULT_DENSE_COMPARE_SORT_STATE,
    cannonByMonster,
    lootPrefsByMonster
  )
    .filter((row) => Number.isFinite(row.xpPerHour))
    .slice(0, limit)
    .map((row) => ({
      monsterId: row.monsterId,
      monsterName: row.monsterName,
      dps: row.dps,
      effectiveXpPerHour: row.xpPerHour,
      effectiveNetGpPerHour: row.netGpPerHour,
      bound: row.bound
    }));
}

export function createPlannerViewModel(
  form: CombatSetupFormState,
  context: SimulationContext
): PlannerPlan {
  const request = formToSimulationRequest(form, context.gameData);
  const targets = {
    attack: form.plannerTargets.attack ?? form.levels.attack,
    strength: form.plannerTargets.strength ?? form.levels.strength,
    defence: form.plannerTargets.defence ?? form.levels.defence,
    ranged: form.plannerTargets.ranged ?? form.levels.ranged,
    magic: form.plannerTargets.magic ?? form.levels.magic
  };
  return buildPlan(
    {
      request,
      trip: formToTripPolicy(form),
      ringOfWealth: form.ringOfWealth,
      legendsComplete: true,
      jewelSpot: "underground"
    },
    context,
    {
      metric: "xph",
      targets,
      pool: defaultPool(request.combatStyle, context),
      sustained: form.sustained,
      maxLevels: 120
    }
  );
}

export function optimizeLootPrefsForMonster(
  form: CombatSetupFormState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {}
): LootOptimizeResult {
  const request = formToSimulationRequest(form, context.gameData);
  const combat = simulateCombat(request, context);
  const input = tripInputFor(form, request, combat, cannonByMonster);
  const defaultTrip = simulateWithLootPrefs(input, context, undefined);
  const natureRuneCost = context.priceSet.itemPrices.naturerune ?? NATURE_RUNE_FALLBACK;
  const defaultRows = defaultTrip.lootBreakdown;
  const defaultByRowId = new Map(defaultRows.map((drop) => [drop.rowId, drop]));
  const maxIterations = Math.min(MAX_LOOT_OPTIMIZE_ITERATIONS, defaultRows.length);
  let prefs: Record<string, LootAction> = {};
  let bestScore = defaultTrip.effectiveNetGpPerHour;
  let iterations = 0;
  let capped = false;

  for (; iterations < maxIterations; iterations += 1) {
    let improvedPrefs: Record<string, LootAction> | null = null;
    let improvedScore = bestScore;

    for (const row of defaultRows) {
      const availableActions = availableLootActions(row, !!input.trip?.alching, natureRuneCost);
      for (const action of availableActions) {
        const defaultAction = defaultByRowId.get(row.rowId)?.pref ?? row.pref;
        const candidatePrefs = { ...prefs };
        if (action === defaultAction) delete candidatePrefs[row.rowId];
        else candidatePrefs[row.rowId] = action;

        const candidate = simulateWithLootPrefs(input, context, candidatePrefs);
        if (candidate.effectiveNetGpPerHour > improvedScore + 0.000001) {
          improvedScore = candidate.effectiveNetGpPerHour;
          improvedPrefs = candidatePrefs;
        }
      }
    }

    if (!improvedPrefs) break;
    prefs = improvedPrefs;
    bestScore = improvedScore;
  }

  if (iterations >= maxIterations && maxIterations > 0) capped = true;

  return {
    prefs,
    effectiveNetGpPerHour: bestScore,
    baseEffectiveNetGpPerHour: defaultTrip.effectiveNetGpPerHour,
    deltaNetGpPerHour: bestScore - defaultTrip.effectiveNetGpPerHour,
    iterations,
    changedRows: Object.keys(prefs).length,
    capped
  };
}

export function weaponOptions(gameData: GameDataSnapshot, combatStyle: CombatStyle) {
  return Object.entries(gameData.weapons)
    .filter(([, weapon]) => weapon.type === combatStyle)
    .map(([id, weapon]) => ({ id, label: weapon.name }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function monsterOptions(gameData: GameDataSnapshot) {
  return Object.values(gameData.monsters)
    .map((monster) => ({ id: monster.id, label: monster.name }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function styleOptions(
  gameData: GameDataSnapshot,
  combatStyle: CombatStyle,
  weaponId: EntityId
) {
  if (combatStyle === "melee") {
    return weaponStances(weaponId, gameData).map((stance) => ({
      id: stance.id,
      label: `${stance.name} (${stance.style}/${stance.type})`
    }));
  }
  if (combatStyle === "ranged") {
    return [
      { id: "accurate", label: "Accurate" },
      { id: "rapid", label: "Rapid" },
      { id: "longrange", label: "Longrange" }
    ];
  }
  return [
    { id: "accurate", label: "Standard cast" },
    { id: "defensive", label: "Defensive casting" },
    { id: "longrange", label: "Longrange" }
  ];
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "unlimited";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

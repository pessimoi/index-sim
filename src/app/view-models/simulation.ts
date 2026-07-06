import { computeCombatXpBreakdown, simulateCombat, weaponStances } from "@/domain/combat";
import {
  buildPlan,
  defaultPool,
  SKILL_LABEL,
  SLOT_LABEL,
  reqOf,
  type PlannerInput,
  type PlannerOptions,
  type PlannerPhase,
  type PlannerGearSlot,
  type PlannerPlan,
  type PlannerPool,
  type PlannerSkill,
  type PlannerTransition
} from "@/domain/planner";
import type {
  BonusKey,
  CombatStyle,
  EquipmentItemDefinition,
  EquipmentSlot,
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
  normalizeDenseCompareUiState,
  normalizeDenseCompareSortState,
  type DenseCompareSortKey,
  type DenseCompareSortState,
  type DenseCompareUiState
} from "../state/dense-compare";
import { lootSettingsForMonster, type LootSettingsByMonsterState } from "../state/loot-settings";
import {
  PLANNER_GEAR_SLOTS,
  PLANNER_SKILLS,
  cleanPlannerUiStateForPool,
  createDefaultPlannerUiState,
  effectivePlannerGearPool,
  normalizePlannerUiState,
  type PlannerUiState
} from "../state/planner";
import {
  type CannonByMonsterState,
  formToSimulationRequest,
  formToTripPolicy,
  type CombatSetupFormState,
  type CustomSetupsByMonsterState
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

export type DenseCompareRowMarkerId = "custom" | "alch" | "overhead" | "hidden" | "target";

export interface DenseCompareRowMarkerViewModel {
  id: DenseCompareRowMarkerId;
  label: string;
  ariaLabel: string;
}

export interface DenseCompareRowViewModel {
  monsterId: EntityId;
  monsterName: string;
  monsterLevel: number | null;
  isActiveTarget: boolean;
  isForcedVisible: boolean;
  isIrrelevant: boolean;
  hasCustomSetup: boolean;
  hasHighAlchOverride: boolean;
  hasOverheadOverride: boolean;
  markers: DenseCompareRowMarkerViewModel[];
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
const OPTION_BONUS_KEYS: BonusKey[] = [
  "stabAtt",
  "slashAtt",
  "crushAtt",
  "rngAtt",
  "magAtt",
  "str",
  "rngStr",
  "magDmg",
  "prayer"
];

export interface SelectOptionViewModel {
  id: EntityId;
  label: string;
  hint?: string;
}

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
      price: typeof record.price === "number" && Number.isFinite(record.price) ? record.price : null
    };
  });
}

function tripInputFor(
  form: CombatSetupFormState,
  request: SimulationRequest,
  combat: ReturnType<typeof simulateCombat>,
  cannonByMonster: CannonByMonsterState,
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): TripLootSupplyInput {
  const lootSettings = lootSettingsForMonster(lootSettingsByMonster, request.monsterId);
  const trip = formToTripPolicy(form);
  return {
    request,
    combat,
    trip: {
      ...trip,
      alching: lootSettings.highAlch ?? trip.alching
    },
    ringOfWealth: form.ringOfWealth,
    legendsComplete: true,
    jewelSpot: lootSettings.talismanSpot,
    overheadSec: lootSettings.overheadSec,
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
        deltaNetGpPerHour: candidate.effectiveNetGpPerHour - defaultTrip.effectiveNetGpPerHour
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
    currentDeltaNetGpPerHour: currentTrip.effectiveNetGpPerHour - defaultTrip.effectiveNetGpPerHour,
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

function normalizedFilterQuery(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function stringMatchesFilter(value: string | undefined, query: string): boolean {
  return query.length === 0 || (value ?? "").toLocaleLowerCase().includes(query);
}

function collectDropSearchTerms(input: unknown, terms: string[] = []): string[] {
  if (Array.isArray(input)) {
    for (const child of input) collectDropSearchTerms(child, terms);
    return terms;
  }
  if (!input || typeof input !== "object") return terms;
  const record = input as Record<string, unknown>;

  for (const key of ["name", "key", "tag"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) terms.push(value);
  }

  const expanded = record._expand;
  if (Array.isArray(expanded)) {
    for (const child of expanded) collectDropSearchTerms(child, terms);
  }

  return terms;
}

function monsterMatchesDropFilter(
  gameData: GameDataSnapshot,
  monsterId: EntityId,
  query: string
): boolean {
  if (query.length === 0) return true;
  const monster = gameData.monsters[monsterId];
  if (!monster?.loot) return false;
  return monster.loot.some((drop) =>
    collectDropSearchTerms(drop).some((term) => stringMatchesFilter(term, query))
  );
}

function rowMatchesDenseFilters(
  row: DenseCompareRowViewModel,
  gameData: GameDataSnapshot,
  state: DenseCompareUiState
): boolean {
  const monsterQuery = normalizedFilterQuery(state.monsterFilter);
  const dropQuery = normalizedFilterQuery(state.dropFilter);
  const monsterMatches =
    stringMatchesFilter(row.monsterName, monsterQuery) ||
    stringMatchesFilter(row.monsterId, monsterQuery);
  const dropMatches = monsterMatchesDropFilter(gameData, row.monsterId, dropQuery);
  const relevanceMatches = state.showIrrelevant || !row.isIrrelevant;

  return monsterMatches && dropMatches && relevanceMatches;
}

function createDenseCompareRowMarkers(row: {
  hasCustomSetup: boolean;
  hasHighAlchOverride: boolean;
  hasOverheadOverride: boolean;
  isIrrelevant: boolean;
  isForcedVisible: boolean;
}): DenseCompareRowMarkerViewModel[] {
  const markers: DenseCompareRowMarkerViewModel[] = [];

  if (row.hasCustomSetup) {
    markers.push({ id: "custom", label: "custom", ariaLabel: "Custom setup" });
  }
  if (row.hasHighAlchOverride) {
    markers.push({ id: "alch", label: "alch", ariaLabel: "High alch override" });
  }
  if (row.hasOverheadOverride) {
    markers.push({ id: "overhead", label: "overhead", ariaLabel: "Kill overhead override" });
  }
  if (row.isIrrelevant) {
    markers.push({ id: "hidden", label: "hidden", ariaLabel: "Marked irrelevant" });
  }
  if (row.isForcedVisible) {
    markers.push({
      id: "target",
      label: "target",
      ariaLabel: "Current target kept visible"
    });
  }

  return markers;
}

export function createSimulationViewModel(
  form: CombatSetupFormState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefs: Record<string, LootAction | string | undefined> = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {},
  options: { includeLootRows?: boolean } = {}
): SimulationViewModel {
  const request = formToSimulationRequest(form, context.gameData);
  const combat = simulateCombat(request, context);
  const tripInput = tripInputFor(form, request, combat, cannonByMonster, lootSettingsByMonster);
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
  denseCompare: unknown = DEFAULT_DENSE_COMPARE_SORT_STATE,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefsByMonster: Record<string, Record<string, LootAction | string | undefined>> = {},
  customSetupsByMonster: CustomSetupsByMonsterState = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): DenseCompareRowViewModel[] {
  const denseState = normalizeDenseCompareUiState(denseCompare);
  const sort = denseState.sort;
  const irrelevantMonsterIds = new Set(denseState.irrelevantMonsterIds);
  const rows = Object.values(context.gameData.monsters).map((monster) => {
    const customSetup = customSetupsByMonster[monster.id];
    const lootSettings = lootSettingsByMonster[monster.id];
    const hasHighAlchOverride = lootSettings?.highAlch != null;
    const hasOverheadOverride = lootSettings?.overheadSec != null;
    const rowForm = customSetup ?? { ...form, monsterId: monster.id };
    const vm = createSimulationViewModel(
      rowForm,
      context,
      cannonByMonster,
      lootPrefsByMonster[monster.id] ?? {},
      lootSettingsByMonster,
      { includeLootRows: false }
    );
    return {
      monsterId: monster.id,
      monsterName: monster.name,
      monsterLevel: monster.level ?? null,
      isActiveTarget: monster.id === form.monsterId,
      isForcedVisible: false,
      isIrrelevant: irrelevantMonsterIds.has(monster.id),
      hasCustomSetup: customSetup != null,
      hasHighAlchOverride,
      hasOverheadOverride,
      markers: createDenseCompareRowMarkers({
        hasCustomSetup: customSetup != null,
        hasHighAlchOverride,
        hasOverheadOverride,
        isIrrelevant: irrelevantMonsterIds.has(monster.id),
        isForcedVisible: false
      }),
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

  const filteredRows = rows
    .map((row) => {
      const isForcedVisible =
        row.isActiveTarget && !rowMatchesDenseFilters(row, context.gameData, denseState);
      return {
        ...row,
        isForcedVisible,
        markers: createDenseCompareRowMarkers({ ...row, isForcedVisible })
      };
    })
    .filter(
      (row) => row.isForcedVisible || rowMatchesDenseFilters(row, context.gameData, denseState)
    );

  return sortDenseCompareRows(filteredRows, sort);
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

export interface PlannerDomainAdapterViewModel {
  input: PlannerInput;
  options: PlannerOptions;
  state: PlannerUiState;
  defaultPool: PlannerPool;
  pool: PlannerPool;
}

export interface PlannerPanelSummaryViewModel {
  totalXp: number;
  stepCount: number;
  phaseCount: number;
  unlockCount: number;
  startDps: number;
  endDps: number;
  startMetric: number;
  endMetric: number;
  truncated: boolean;
}

export interface PlannerTrainingOrderRowViewModel {
  id: string;
  skill: PlannerSkill;
  skillLabel: string;
  from: number;
  to: number;
  xp: number;
  cumXp: number;
  startDps: number;
  endDps: number;
  startMetric: number;
  endMetric: number;
  unlockCount: number;
}

export interface PlannerUnlockRowViewModel {
  id: string;
  itemName: string;
  slotLabel: string;
  type: PlannerTransition["type"];
  skillLabel: string;
  level: number;
  reqSkillLabel: string;
  reqLevel: number;
  cumXp: number;
  dpsBefore: number;
  dpsAfter: number;
}

export interface PlannerGearPoolOptionViewModel {
  id: EntityId;
  label: string;
  hint: string;
  selected: boolean;
}

export interface PlannerGearPoolSlotViewModel {
  slot: PlannerGearSlot;
  label: string;
  selectedCount: number;
  totalCount: number;
  options: PlannerGearPoolOptionViewModel[];
}

export interface PlannerTimelineEventViewModel {
  id: string;
  itemName: string;
  slotLabel: string;
  type: PlannerTransition["type"];
  skillLabel: string;
  level: number;
  cumXp: number;
  dpsDelta: number;
}

export interface PlannerChartPointViewModel {
  id: string;
  label: string;
  cumXp: number;
  dps: number;
  x: number;
  y: number;
}

export interface PlannerChartViewModel {
  points: PlannerChartPointViewModel[];
  minDps: number;
  maxDps: number;
  maxCumXp: number;
  isEmpty: boolean;
}

export interface PlannerPanelViewModel {
  summary: PlannerPanelSummaryViewModel;
  trainingOrder: PlannerTrainingOrderRowViewModel[];
  unlocks: PlannerUnlockRowViewModel[];
  timeline: PlannerTimelineEventViewModel[];
  chart: PlannerChartViewModel;
  warnings: string[];
  isEmpty: boolean;
}

export interface PlannerGearPoolEditorViewModel {
  slots: PlannerGearPoolSlotViewModel[];
  totalSelectedCount: number;
  totalOptionCount: number;
}

function isHypotheticalPlannerItem(gameData: GameDataSnapshot, itemId: EntityId): boolean {
  return gameData.items[itemId]?.provenance?.source === "hypothetical";
}

function itemExistsInPlannerSlot(
  gameData: GameDataSnapshot,
  slot: PlannerGearSlot,
  itemId: EntityId
): boolean {
  if (itemId === "none") return true;
  if (slot === "weapon") return !!gameData.weapons[itemId];
  return !!gameData.equipment[slot as EquipmentSlot]?.[itemId];
}

export function plannerAllowedPool(
  combatStyle: CombatStyle,
  context: SimulationContext
): PlannerPool {
  const source = defaultPool(combatStyle, context);
  const pool: PlannerPool = {};
  for (const slot of PLANNER_GEAR_SLOTS) {
    const itemIds = source[slot] ?? [];
    pool[slot] = itemIds.filter(
      (itemId) =>
        itemExistsInPlannerSlot(context.gameData, slot, itemId) &&
        !isHypotheticalPlannerItem(context.gameData, itemId)
    );
  }
  return pool;
}

function plannerPoolItemLabel(
  context: SimulationContext,
  slot: PlannerGearSlot,
  itemId: EntityId
): string {
  if (itemId === "none") return "None";
  if (slot === "weapon") return context.gameData.weapons[itemId]?.name ?? itemId;
  return context.gameData.equipment[slot as EquipmentSlot]?.[itemId]?.name ?? itemId;
}

function plannerPoolItemHint(
  context: SimulationContext,
  slot: PlannerGearSlot,
  itemId: EntityId
): string {
  const req = reqOf(itemId);
  const reqs = Object.entries(req)
    .map(([skill, level]) => `${SKILL_LABEL[skill as PlannerSkill]} ${level}`)
    .join(", ");
  if (slot === "weapon") {
    const weapon = context.gameData.weapons[itemId];
    return [weapon ? `speed ${weapon.speed}` : null, reqs || null].filter(Boolean).join(", ");
  }
  return reqs || "no requirement";
}

export function createPlannerGearPoolEditorViewModel(
  form: CombatSetupFormState,
  context: SimulationContext,
  plannerUiState: PlannerUiState
): PlannerGearPoolEditorViewModel {
  const allowedPool = plannerAllowedPool(form.combatStyle, context);
  const state = cleanPlannerUiStateForPool(plannerUiState, allowedPool);
  const effectivePool = effectivePlannerGearPool(state, allowedPool);
  const slots = PLANNER_GEAR_SLOTS.map((slot): PlannerGearPoolSlotViewModel => {
    const itemIds = allowedPool[slot] ?? [];
    const selected = new Set(effectivePool[slot] ?? []);
    const options = itemIds.map((itemId) => ({
      id: itemId,
      label: plannerPoolItemLabel(context, slot, itemId),
      hint: plannerPoolItemHint(context, slot, itemId),
      selected: selected.has(itemId)
    }));
    return {
      slot,
      label: SLOT_LABEL[slot],
      selectedCount: options.filter((option) => option.selected).length,
      totalCount: options.length,
      options
    };
  }).filter((slot) => slot.totalCount > 0);

  return {
    slots,
    totalSelectedCount: slots.reduce((sum, slot) => sum + slot.selectedCount, 0),
    totalOptionCount: slots.reduce((sum, slot) => sum + slot.totalCount, 0)
  };
}

function plannerTargetsForState(
  form: CombatSetupFormState,
  plannerState: PlannerUiState
): Record<PlannerSkill, number> {
  const targets = {} as Record<PlannerSkill, number>;
  for (const skill of PLANNER_SKILLS) {
    targets[skill] = plannerState.skillLocks[skill]
      ? form.levels[skill]
      : Math.max(form.levels[skill], plannerState.targetLevels[skill]);
  }
  return targets;
}

export function createPlannerDomainAdapter(
  form: CombatSetupFormState,
  context: SimulationContext,
  lootSettingsByMonster: LootSettingsByMonsterState = {},
  plannerUiState?: PlannerUiState
): PlannerDomainAdapterViewModel {
  const request = formToSimulationRequest(form, context.gameData);
  const lootSettings = lootSettingsForMonster(lootSettingsByMonster, request.monsterId);
  const trip = formToTripPolicy(form);
  const defaultPlannerPool = plannerAllowedPool(request.combatStyle, context);
  const state = cleanPlannerUiStateForPool(
    normalizePlannerUiState(plannerUiState ?? createDefaultPlannerUiState(form)),
    defaultPlannerPool
  );
  const pool = effectivePlannerGearPool(state, defaultPlannerPool);

  return {
    input: {
      request,
      trip: { ...trip, alching: lootSettings.highAlch ?? trip.alching },
      ringOfWealth: form.ringOfWealth,
      legendsComplete: true,
      jewelSpot: lootSettings.talismanSpot,
      overheadSec: lootSettings.overheadSec
    },
    options: {
      metric: state.metric,
      targets: plannerTargetsForState(form, state),
      startXp: state.currentXp,
      pool,
      lockGear: state.onlyCurrentGear,
      sustained: form.sustained,
      maxLevels: 120
    },
    state,
    defaultPool: defaultPlannerPool,
    pool
  };
}

export function createPlannerViewModel(
  form: CombatSetupFormState,
  context: SimulationContext,
  lootSettingsByMonster: LootSettingsByMonsterState = {},
  plannerUiState?: PlannerUiState
): PlannerPlan {
  const adapter = createPlannerDomainAdapter(form, context, lootSettingsByMonster, plannerUiState);
  return buildPlan(adapter.input, context, adapter.options);
}

function trainingOrderRow(phase: PlannerPhase, index: number): PlannerTrainingOrderRowViewModel {
  return {
    id: `${index}:${phase.skill}:${phase.from}-${phase.to}`,
    skill: phase.skill,
    skillLabel: SKILL_LABEL[phase.skill],
    from: phase.from,
    to: phase.to,
    xp: phase.xp,
    cumXp: phase.cumXp,
    startDps: phase.startDps,
    endDps: phase.endDps,
    startMetric: phase.startMetric,
    endMetric: phase.endMetric,
    unlockCount: phase.unlocks.length
  };
}

function unlockRow(unlock: PlannerTransition, index: number): PlannerUnlockRowViewModel {
  return {
    id: `${index}:${unlock.slot}:${unlock.itemId}:${unlock.level}`,
    itemName: unlock.name,
    slotLabel: SLOT_LABEL[unlock.slot],
    type: unlock.type,
    skillLabel: SKILL_LABEL[unlock.skill],
    level: unlock.level,
    reqSkillLabel: SKILL_LABEL[unlock.reqSkill],
    reqLevel: unlock.reqLevel,
    cumXp: unlock.cumXp,
    dpsBefore: unlock.dpsBefore,
    dpsAfter: unlock.dpsAfter
  };
}

function timelineEvent(unlock: PlannerTransition, index: number): PlannerTimelineEventViewModel {
  return {
    id: `${index}:${unlock.slot}:${unlock.itemId}:${unlock.cumXp}`,
    itemName: unlock.name,
    slotLabel: SLOT_LABEL[unlock.slot],
    type: unlock.type,
    skillLabel: SKILL_LABEL[unlock.skill],
    level: unlock.level,
    cumXp: unlock.cumXp,
    dpsDelta: unlock.dpsAfter - unlock.dpsBefore
  };
}

function createPlannerChartViewModel(plan: PlannerPlan): PlannerChartViewModel {
  const rawPoints = [
    {
      id: "start",
      label: "Start",
      cumXp: 0,
      dps: plan.start.dps
    },
    ...plan.steps.map((step, index) => ({
      id: `step-${index + 1}`,
      label: `${SKILL_LABEL[step.skill]} ${step.to}`,
      cumXp: step.cumXp,
      dps: step.dps
    }))
  ];
  const maxCumXp = Math.max(0, ...rawPoints.map((point) => point.cumXp));
  const minDps = Math.min(...rawPoints.map((point) => point.dps));
  const maxDps = Math.max(...rawPoints.map((point) => point.dps));
  const dpsRange = Math.max(0.000001, maxDps - minDps);
  const xpRange = Math.max(1, maxCumXp);

  return {
    points: rawPoints.map((point) => ({
      ...point,
      x: (point.cumXp / xpRange) * 100,
      y: 100 - ((point.dps - minDps) / dpsRange) * 100
    })),
    minDps,
    maxDps,
    maxCumXp,
    isEmpty: rawPoints.length < 2
  };
}

export function createPlannerPanelViewModel(plan: PlannerPlan): PlannerPanelViewModel {
  const timeline = plan.unlocks.map(timelineEvent);
  return {
    summary: {
      totalXp: plan.totalXp,
      stepCount: plan.steps.length,
      phaseCount: plan.phases.length,
      unlockCount: plan.unlocks.length,
      startDps: plan.start.dps,
      endDps: plan.end?.dps ?? plan.start.dps,
      startMetric: plan.start.metricValue,
      endMetric: plan.end?.metricValue ?? plan.start.metricValue,
      truncated: plan.truncated
    },
    trainingOrder: plan.phases.map(trainingOrderRow),
    unlocks: plan.unlocks.map(unlockRow),
    timeline,
    chart: createPlannerChartViewModel(plan),
    warnings: plan.warnings.map((warning) => warning.message),
    isEmpty: plan.steps.length === 0
  };
}

export function optimizeLootPrefsForMonster(
  form: CombatSetupFormState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): LootOptimizeResult {
  const request = formToSimulationRequest(form, context.gameData);
  const combat = simulateCombat(request, context);
  const input = tripInputFor(form, request, combat, cannonByMonster, lootSettingsByMonster);
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

function signedBonus(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function equipmentHint(item: EquipmentItemDefinition): string | undefined {
  const bonuses = OPTION_BONUS_KEYS.flatMap((key) => {
    const value = item[key] ?? 0;
    return value === 0 ? [] : `${key} ${signedBonus(value)}`;
  });
  if (item.note) bonuses.push(item.note);
  return bonuses.slice(0, 4).join(", ") || undefined;
}

export function weaponOptions(
  gameData: GameDataSnapshot,
  combatStyle: CombatStyle
): SelectOptionViewModel[] {
  return Object.entries(gameData.weapons)
    .filter(([, weapon]) => weapon.type === combatStyle)
    .map(([id, weapon]) => ({
      id,
      label: weapon.name,
      hint: [
        `speed ${weapon.speed}`,
        weapon.twoHand ? "2h" : null,
        weapon.sub ?? weapon.wclass ?? null,
        combatStyle === "melee"
          ? `acc ${weapon.accBonus}, str ${weapon.dmgBonus}`
          : combatStyle === "ranged"
            ? `rng ${weapon.accBonus}`
            : `magic ${weapon.accBonus}`
      ]
        .filter(Boolean)
        .join(", ")
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function monsterOptions(gameData: GameDataSnapshot) {
  return Object.values(gameData.monsters)
    .map((monster) => ({ id: monster.id, label: monster.name }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function ammoOptions(
  gameData: GameDataSnapshot,
  kind?: GameDataSnapshot["ammo"][string]["kind"]
): SelectOptionViewModel[] {
  return [
    { id: "none", label: "None" },
    ...Object.entries(gameData.ammo)
      .filter(([, ammo]) => !kind || ammo.kind === kind)
      .map(([id, ammo]) => ({
        id,
        label: ammo.name,
        hint: [ammo.kind, `range ${signedBonus(ammo.rangeBonus)}`].filter(Boolean).join(", ")
      }))
      .sort((left, right) => left.label.localeCompare(right.label))
  ];
}

export function spellOptions(gameData: GameDataSnapshot): SelectOptionViewModel[] {
  return Object.entries(gameData.spells)
    .map(([id, spell]) => ({
      id,
      label: spell.name,
      hint: [
        spell.lvl == null ? null : `lvl ${spell.lvl}`,
        `base ${spell.base}`,
        spell.god ? "god" : null
      ]
        .filter(Boolean)
        .join(", ")
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function equipmentSlotOptions(
  gameData: GameDataSnapshot,
  slot: EquipmentSlot
): SelectOptionViewModel[] {
  return Object.entries(gameData.equipment[slot] ?? {})
    .map(([id, item]) => ({
      id,
      label: item.name,
      hint: equipmentHint(item)
    }))
    .sort((left, right) => {
      if (left.id === "none") return -1;
      if (right.id === "none") return 1;
      return left.label.localeCompare(right.label);
    });
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

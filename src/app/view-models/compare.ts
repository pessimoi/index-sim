import type { EntityId, GameDataSnapshot, SimulationContext } from "@/domain/shared";
import type { LootAction } from "@/domain/trip";
import {
  DEFAULT_DENSE_COMPARE_SORT_STATE,
  normalizeDenseCompareSortState,
  normalizeDenseCompareUiState,
  type DenseCompareSortKey,
  type DenseCompareSortState,
  type DenseCompareUiState
} from "../state/dense-compare";
import type { LootSettingsByMonsterState } from "../state/loot-settings";
import type {
  CannonByMonsterState,
  CombatSetupFormState,
  CustomSetupsByMonsterState
} from "../state/ui-state";
import { formatNumber } from "./formatting";
import { createSimulationViewModel } from "./simulation";

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

export type DenseCompareScaleTone = "positive" | "negative" | "neutral";

export interface DenseCompareScaleCellViewModel {
  value: number;
  widthPercent: number;
  tone: DenseCompareScaleTone;
  ariaLabel: string;
}

export interface DenseCompareScaleRowViewModel {
  xpPerHour: DenseCompareScaleCellViewModel;
  netGpPerHour: DenseCompareScaleCellViewModel;
}

export type DenseCompareScaleViewModel = Record<EntityId, DenseCompareScaleRowViewModel>;

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

function finitePositiveMax(values: number[]): number {
  return Math.max(0, ...values.filter((value) => Number.isFinite(value) && value > 0));
}

function scalePercent(value: number, maxValue: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) return 0;
  return Math.max(0, Math.min(100, (value / maxValue) * 100));
}

export function createDenseCompareScaleModel(
  rows: DenseCompareRowViewModel[]
): DenseCompareScaleViewModel {
  const maxXp = finitePositiveMax(rows.map((row) => row.xpPerHour));
  const maxPositiveNetGp = finitePositiveMax(rows.map((row) => row.netGpPerHour));
  const maxNegativeNetGp = finitePositiveMax(
    rows.map((row) => (row.netGpPerHour < 0 ? Math.abs(row.netGpPerHour) : 0))
  );

  return Object.fromEntries(
    rows.map((row) => {
      const netTone: DenseCompareScaleTone =
        row.netGpPerHour > 0 ? "positive" : row.netGpPerHour < 0 ? "negative" : "neutral";
      const netWidth =
        row.netGpPerHour < 0
          ? scalePercent(Math.abs(row.netGpPerHour), maxNegativeNetGp)
          : scalePercent(row.netGpPerHour, maxPositiveNetGp);

      return [
        row.monsterId,
        {
          xpPerHour: {
            value: row.xpPerHour,
            widthPercent: scalePercent(row.xpPerHour, maxXp),
            tone: row.xpPerHour > 0 ? "positive" : "neutral",
            ariaLabel: `${row.monsterName} XP/hr ${formatNumber(row.xpPerHour)}, scaled to visible rows`
          },
          netGpPerHour: {
            value: row.netGpPerHour,
            widthPercent: netWidth,
            tone: netTone,
            ariaLabel: `${row.monsterName} net GP/hr ${formatNumber(row.netGpPerHour)}, ${
              netTone === "negative" ? "loss" : netTone === "positive" ? "profit" : "break-even"
            } scaled to visible rows`
          }
        }
      ];
    })
  );
}

export function sortDenseCompareRows(
  rows: readonly DenseCompareRowViewModel[],
  sort: unknown = DEFAULT_DENSE_COMPARE_SORT_STATE
): DenseCompareRowViewModel[] {
  const normalizedSort = normalizeDenseCompareSortState(sort);
  return [...rows].sort((left, right) => compareDenseRows(left, right, normalizedSort));
}

export function presentDenseCompareRows(
  rows: readonly DenseCompareRowViewModel[],
  gameData: GameDataSnapshot,
  denseCompare: unknown = DEFAULT_DENSE_COMPARE_SORT_STATE
): DenseCompareRowViewModel[] {
  const denseState = normalizeDenseCompareUiState(denseCompare);
  const irrelevantMonsterIds = new Set(denseState.irrelevantMonsterIds);
  const presentedRows = rows
    .map((row) => {
      const rowWithRelevance = {
        ...row,
        isIrrelevant: irrelevantMonsterIds.has(row.monsterId),
        isForcedVisible: false
      };
      const isForcedVisible =
        rowWithRelevance.isActiveTarget &&
        !rowMatchesDenseFilters(rowWithRelevance, gameData, denseState);
      return {
        ...rowWithRelevance,
        isForcedVisible,
        markers: createDenseCompareRowMarkers({ ...rowWithRelevance, isForcedVisible })
      };
    })
    .filter((row) => row.isForcedVisible || rowMatchesDenseFilters(row, gameData, denseState));

  return sortDenseCompareRows(presentedRows, denseState.sort);
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
      { includeLootRows: false, includeHitDistributionAnalysis: false }
    );
    return {
      monsterId: monster.id,
      monsterName: monster.name,
      monsterLevel: monster.level ?? null,
      isActiveTarget: monster.id === form.monsterId,
      isForcedVisible: false,
      isIrrelevant: false,
      hasCustomSetup: customSetup != null,
      hasHighAlchOverride,
      hasOverheadOverride,
      markers: createDenseCompareRowMarkers({
        hasCustomSetup: customSetup != null,
        hasHighAlchOverride,
        hasOverheadOverride,
        isIrrelevant: false,
        isForcedVisible: false
      }),
      hitChance: vm.result.combat.hitChance,
      maxHit: vm.result.combat.maxHit,
      dps: vm.result.rates.effectiveDps,
      ttkSec: vm.result.rates.ttkSec,
      killsPerHour: vm.result.rates.killsPerHour,
      xpPerHour: vm.result.xp.effectiveXpPerHour,
      gpPerKill: vm.result.rates.gpPerKill,
      gpPerHour: vm.result.rates.gpPerHour,
      netGpPerHour: vm.result.rates.effectiveNetGpPerHour,
      bound: vm.result.trip.trip.bound
    };
  });
  return presentDenseCompareRows(rows, context.gameData, denseCompare);
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

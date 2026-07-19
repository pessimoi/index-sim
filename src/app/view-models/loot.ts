import { simulateCombat } from "@/domain/combat";
import type { SimulationContext, SimulationRequest } from "@/domain/shared";
import {
  defaultOverhead,
  simulateTripLootSupply,
  type LootAction,
  type LootBreakdownEntry,
  type TripLootSupplyInput,
  type TripLootSupplyResult
} from "@/domain/trip";
import { lootSettingsForMonster, type LootSettingsByMonsterState } from "../state/loot-settings";
import {
  formToSimulationRequest,
  type CannonByMonsterState,
  type CombatSetupFormState
} from "../state/ui-state";
import { formatNumber } from "./formatting";
import type { ItemPriceHistoryContext, PriceDataNotice } from "./price-data";
import { createEntityDisplayLabel, type EntityDisplayLabel } from "./presentation-language";
import { createFullSimulationInput } from "./simulation-input";

export interface LootActionImpactViewModel {
  action: LootAction;
  label: string;
  effectiveNetGpPerHour: number;
  deltaNetGpPerHour: number;
  gpPerKillContribution: number;
  isSelected: boolean;
  isDefault: boolean;
  stateLabel: string | null;
  notes: string[];
}

export interface LootValueCompositionRowViewModel {
  rowId: string | null;
  name: string;
  action: LootAction | null;
  actionLabel: string;
  gpPerKill: number;
  shareOfPositivePct: number | null;
  stateLabel: string | null;
  childCount: number;
  isOther: boolean;
}

export interface LootValueCompositionViewModel {
  rows: LootValueCompositionRowViewModel[];
  positiveGpPerKill: number;
  displayedGpPerKill: number;
  residualGpPerKill: number;
  note: string | null;
}

export interface LootExpandedRowViewModel {
  label: string;
  displayLabel: EntityDisplayLabel;
  key: string | null;
  tag: string | null;
  weight: number | null;
  weightLabel: string | null;
  chance: number | null;
  qty: number | null;
  qtyLabel: string | null;
  price: number | null;
  evGp: number | null;
  shareOfParentPct: number | null;
  notes: string[];
  priceNotices: readonly PriceDataNotice[];
}

export interface LootDropValueDetailViewModel {
  label: string;
  value: string;
  tone: "default" | "warning" | "muted";
}

export interface LootPriceHistoryContextViewModel {
  itemId: string | null;
  itemLabel: string;
  tracked: boolean;
  latestPrice: number | null;
  baselinePrice: number | null;
  gpDelta: number | null;
  percentDelta: number | null;
  latestLabel: string | null;
  baselineLabel: string | null;
  statusLabel: string;
  emptyMessage: string;
}

export interface LootDropRowViewModel {
  rowId: string;
  name: string;
  displayLabel: EntityDisplayLabel;
  key: string | null;
  tag: string | null;
  chance: number;
  qtyAvg: number;
  price: number;
  saleValue: number;
  evGp: number;
  effectiveEvGp: number;
  stateLabel: string | null;
  eligibilityDescription: string | null;
  pref: LootAction;
  prefLabel: string;
  defaultPref: LootAction;
  availableActions: LootAction[];
  actionImpacts: LootActionImpactViewModel[];
  selectedDeltaNetGpPerHour: number;
  isOverride: boolean;
  prayerXp: number;
  alchValue: number;
  slotFrac: number;
  expandedRows: LootExpandedRowViewModel[];
  valueDetails: LootDropValueDetailViewModel[];
  historyContext: LootPriceHistoryContextViewModel;
  priceNotices: readonly PriceDataNotice[];
}

export interface LootSummaryViewModel {
  defaultEffectiveNetGpPerHour: number;
  currentDeltaNetGpPerHour: number;
  overrideCount: number;
  valueComposition: LootValueCompositionViewModel;
}

export interface LootPresentationViewModel {
  rows: LootDropRowViewModel[];
  actionableRows: LootDropRowViewModel[];
  conditionalRows: LootDropRowViewModel[];
  summary: LootSummaryViewModel;
  highAlchEnabled: boolean;
  overheadMode: "auto" | "manual";
  overheadValue: number;
  derivedOverheadSec: number;
  policySummary: string;
}

export type LootTableSortKey =
  "drop" | "action" | "deltaPerHour" | "evPerKill" | "chance" | "quantity" | "price";

export interface LootTableSortState {
  key: LootTableSortKey | null;
  direction: "asc" | "desc";
}

export const DEFAULT_LOOT_TABLE_SORT_STATE: LootTableSortState = {
  key: null,
  direction: "asc"
};

export type LootNestedTableSortKey =
  "child" | "weight" | "chance" | "quantity" | "price" | "evShare";

export interface LootNestedTableSortState {
  key: LootNestedTableSortKey | null;
  direction: "asc" | "desc";
}

export const DEFAULT_LOOT_NESTED_TABLE_SORT_STATE: LootNestedTableSortState = {
  key: null,
  direction: "asc"
};

export interface LootOptimizeResult {
  prefs: Record<string, LootAction>;
  effectiveNetGpPerHour: number;
  baseEffectiveNetGpPerHour: number;
  deltaNetGpPerHour: number;
  iterations: number;
  changedRows: number;
  capped: boolean;
}

export function nextLootTableSortState(
  current: LootTableSortState,
  key: LootTableSortKey
): LootTableSortState {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }

  return {
    key,
    direction: key === "drop" || key === "action" ? "asc" : "desc"
  };
}

function compareLootTableRows(
  left: LootDropRowViewModel,
  right: LootDropRowViewModel,
  key: LootTableSortKey
): number {
  if (key === "drop" || key === "action") {
    const leftValue = key === "drop" ? left.name : left.prefLabel;
    const rightValue = key === "drop" ? right.name : right.prefLabel;
    return leftValue.localeCompare(rightValue, undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  const numericValues: Record<
    Exclude<LootTableSortKey, "drop" | "action">,
    (row: LootDropRowViewModel) => number
  > = {
    deltaPerHour: (row) => row.selectedDeltaNetGpPerHour,
    evPerKill: (row) => row.effectiveEvGp,
    chance: (row) => row.chance,
    quantity: (row) => row.qtyAvg,
    price: (row) => row.price
  };
  return numericValues[key](left) - numericValues[key](right);
}

export function sortLootTableRows(
  rows: readonly LootDropRowViewModel[],
  sort: LootTableSortState
): LootDropRowViewModel[] {
  const key = sort.key;
  if (key === null) return [...rows];

  const direction = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const compared = compareLootTableRows(left.row, right.row, key);
      return compared === 0 ? left.index - right.index : compared * direction;
    })
    .map(({ row }) => row);
}

export function nextLootNestedTableSortState(
  current: LootNestedTableSortState,
  key: LootNestedTableSortKey
): LootNestedTableSortState {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: key === "child" ? "asc" : "desc" };
}

export function sortLootNestedTableRows(
  rows: readonly LootExpandedRowViewModel[],
  sort: LootNestedTableSortState
): LootExpandedRowViewModel[] {
  if (sort.key === null) return [...rows];
  const key = sort.key;
  const direction = sort.direction === "asc" ? 1 : -1;
  const numericValues: Record<
    Exclude<LootNestedTableSortKey, "child">,
    (row: LootExpandedRowViewModel) => number | null
  > = {
    weight: (row) => row.weight,
    chance: (row) => row.chance,
    quantity: (row) => row.qty,
    price: (row) => row.price,
    evShare: (row) => row.evGp
  };

  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      let compared: number;
      if (key === "child") {
        compared =
          left.row.label.localeCompare(right.row.label, undefined, {
            numeric: true,
            sensitivity: "base"
          }) * direction;
      } else {
        const leftValue = numericValues[key](left.row);
        const rightValue = numericValues[key](right.row);
        const leftMissing = leftValue === null || !Number.isFinite(leftValue);
        const rightMissing = rightValue === null || !Number.isFinite(rightValue);
        if (leftMissing || rightMissing) {
          compared = leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1;
        } else {
          compared = (leftValue - rightValue) * direction;
        }
      }
      return compared === 0 ? left.index - right.index : compared;
    })
    .map(({ row }) => row);
}

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
  if (!drop.eligibilityActive) return ["skip"];
  const actions: LootAction[] = ["loot", "skip"];
  if (drop.isBone) actions.push("bury");
  if (alching && drop.alchValue - natureRuneCost > 0) actions.push("alch");
  if (drop.isHerb) actions.push("unid", "value");
  if (drop.tag === "gem") actions.push("value");
  if (!actions.includes(drop.pref)) actions.push(drop.pref);
  return uniqueLootActions(actions);
}

export function lootActionLabel(action: LootAction): string {
  return action === "unid" ? "Unid" : action.charAt(0).toUpperCase() + action.slice(1);
}

function lootRowStateLabel(
  drop: Pick<LootBreakdownEntry, "_eaten" | "_displaced" | "eligibility" | "eligibilityActive">
): string | null {
  if (!drop.eligibilityActive && drop.eligibility?.kind === "quest") {
    return "Quest state not modeled";
  }
  if (!drop.eligibilityActive && drop.eligibility?.kind === "clue") {
    return "Clue eligibility not modeled";
  }
  if (drop._eaten) return "Eaten as food";
  if (drop._displaced) return "Displaced by inventory";
  return null;
}

function effectiveDropEvGp(drop: LootBreakdownEntry): number {
  return drop._displaced ? 0 : drop.evGp;
}

function finiteNumberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function expandedRows(
  drop: LootBreakdownEntry,
  gameData: SimulationContext["gameData"],
  priceNotices: readonly PriceDataNotice[] = []
): LootExpandedRowViewModel[] {
  if (!Array.isArray(drop._expand)) return [];
  const normalized = drop._expand.map((row, index) => {
    const record = row as Record<string, unknown>;
    const weight = finiteNumberField(record, "weight");
    const stringWeight = stringField(record, "weight");
    const chance = finiteNumberField(record, "chance");
    const qty = finiteNumberField(record, "qtyAvg") ?? finiteNumberField(record, "qty");
    const price = finiteNumberField(record, "price");
    const rowValue = finiteNumberField(record, "rowValue") ?? price;
    const note = stringField(record, "note");

    const key = stringField(record, "key");
    const rowSourceName = typeof record.name === "string" ? record.name : `Row ${index + 1}`;
    const displayLabel = createEntityDisplayLabel({
      technicalId: key,
      gameDataName: key ? gameData.items[key]?.name : null,
      rowSourceName
    });
    return {
      label: displayLabel.name,
      displayLabel,
      key,
      tag: stringField(record, "tag"),
      weight,
      weightLabel:
        weight !== null ? formatNumber(weight) : stringWeight !== null ? stringWeight : null,
      chance,
      qty,
      qtyLabel: qty !== null ? formatNumber(qty, 2) : null,
      price,
      rowValue,
      evGp: null,
      shareOfParentPct: null,
      notes: [
        record.talisman === true ? "Talisman band" : null,
        record.mega === true ? "Nested mega-rare table" : null,
        record.proxy === true ? "Uses generic unidentified-herb price proxy" : null,
        note
      ].filter((item): item is string => item !== null),
      priceNotices: priceNotices.filter(
        (notice) => notice.itemId !== undefined && notice.itemId === stringField(record, "key")
      )
    };
  });

  const totalWeight = normalized.reduce((sum, row) => sum + (row.weight ?? 0), 0);
  const weightedValues = normalized.map((row) =>
    row.weight !== null && row.rowValue !== null ? row.weight * row.rowValue : 0
  );
  const totalWeightedValue = weightedValues.reduce((sum, value) => sum + value, 0);
  const canDeriveWeightedShare =
    totalWeight > 0 &&
    totalWeightedValue > 0 &&
    effectiveDropEvGp(drop) > 0 &&
    drop.pref !== "alch" &&
    drop.pref !== "bury" &&
    drop.pref !== "skip";

  return normalized.map((row, index) => {
    const weightChance = row.weight !== null && totalWeight > 0 ? row.weight / totalWeight : null;
    const share =
      canDeriveWeightedShare && weightedValues[index] > 0
        ? weightedValues[index] / totalWeightedValue
        : null;

    return {
      ...row,
      chance: row.chance ?? weightChance,
      evGp: share === null ? null : effectiveDropEvGp(drop) * share,
      shareOfParentPct: share === null ? null : share * 100
    };
  });
}

function lootValueDetails(drop: LootBreakdownEntry): LootDropValueDetailViewModel[] {
  const effectiveEvGp = effectiveDropEvGp(drop);
  const rows: LootDropValueDetailViewModel[] = [
    { label: "Post-trip EV/kill", value: `${formatNumber(effectiveEvGp, 1)} GP`, tone: "default" },
    { label: "Sale value", value: `${formatNumber(drop.saleValue)} GP`, tone: "muted" },
    { label: "Alch value", value: `${formatNumber(drop.alchValue)} GP`, tone: "muted" },
    { label: "Slot fraction", value: formatNumber(drop.slotFrac, 2), tone: "muted" }
  ];

  if (drop._compositePrice === "opened-casket") {
    rows.unshift({ label: "Valuation", value: "Opened contents EV", tone: "default" });
  }

  if (!drop.eligibilityActive && drop.eligibility) {
    rows.push({
      label: "Eligibility",
      value:
        drop.eligibility.kind === "quest"
          ? drop.eligibility.description
          : "Requires a members area and no existing clue scroll.",
      tone: "warning"
    });
  }

  if (drop._displaced) {
    rows.push({
      label: "Pre-displacement EV",
      value: `${formatNumber(drop.evGp, 1)} GP`,
      tone: "warning"
    });
  }
  if (drop.prayerXp > 0) {
    rows.push({
      label: "Bury prayer XP",
      value: `${formatNumber(drop.chance * drop.qtyAvg * drop.prayerXp, 1)} XP/kill`,
      tone: "muted"
    });
  }
  const stateLabel = lootRowStateLabel(drop);
  if (stateLabel) rows.push({ label: "Trip state", value: stateLabel, tone: "warning" });

  return rows;
}

function cleanNullableNumber(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function lootPriceHistoryContext(
  drop: LootBreakdownEntry,
  historyByItem: Record<string, ItemPriceHistoryContext | undefined> = {}
): LootPriceHistoryContextViewModel {
  if (drop._compositePrice === "opened-casket") {
    return {
      itemId: null,
      itemLabel: drop.name,
      tracked: false,
      latestPrice: null,
      baselinePrice: null,
      gpDelta: null,
      percentDelta: null,
      latestLabel: null,
      baselineLabel: null,
      statusLabel: "Component-derived",
      emptyMessage: "Opened contents EV uses component prices; parent casket history is not used."
    };
  }
  const itemId = drop.key ?? null;
  if (!itemId) {
    return {
      itemId: null,
      itemLabel: drop.name,
      tracked: false,
      latestPrice: null,
      baselinePrice: null,
      gpDelta: null,
      percentDelta: null,
      latestLabel: null,
      baselineLabel: null,
      statusLabel: "No item key",
      emptyMessage: "This parent row has no item key."
    };
  }

  const history = historyByItem[itemId];
  if (!history) {
    return {
      itemId,
      itemLabel: drop.name,
      tracked: false,
      latestPrice: null,
      baselinePrice: null,
      gpDelta: null,
      percentDelta: null,
      latestLabel: null,
      baselineLabel: null,
      statusLabel: "No history",
      emptyMessage: `${drop.name} is not in local history.`
    };
  }

  return {
    itemId,
    itemLabel: history.itemLabel ?? drop.name,
    tracked: true,
    latestPrice: cleanNullableNumber(history.latestPrice),
    baselinePrice: cleanNullableNumber(history.baselinePrice),
    gpDelta: cleanNullableNumber(history.gpDelta),
    percentDelta: cleanNullableNumber(history.percentDelta),
    latestLabel: history.latestLabel,
    baselineLabel: history.baselineLabel,
    statusLabel: "Tracked",
    emptyMessage: ""
  };
}

function actionImpactNotes(
  action: LootAction,
  drop: LootBreakdownEntry,
  natureRuneCost: number
): string[] {
  const notes: string[] = [];
  const rollsPerKill = drop.chance * drop.qtyAvg;

  if (action === "bury" && drop.isBone && drop.prayerXp > 0) {
    notes.push(`${formatNumber(rollsPerKill * drop.prayerXp, 1)} Prayer XP/kill`);
  }
  if (action === "alch") {
    notes.push(`${formatNumber(Math.max(0, drop.alchValue - natureRuneCost))} GP/item after rune`);
    notes.push(`${formatNumber(rollsPerKill, 2)} casts/kill`);
  }
  if (action === "unid" && drop.isHerb) {
    notes.push("Uses source-weighted unidentified herb values");
  }
  if (action === "value" && drop.isHerb) notes.push("Keeps high-value herb rolls");
  if (action === "value" && drop.tag === "gem") notes.push("Keeps high-value jewel rolls");
  if (action === "skip") notes.push("Leaves the parent row out");
  return notes;
}

function createLootValueComposition(
  trip: TripLootSupplyResult,
  gameData: SimulationContext["gameData"]
): LootValueCompositionViewModel {
  const positiveDrops = trip.lootBreakdown
    .map((drop) => ({ drop, contribution: effectiveDropEvGp(drop) }))
    .filter((entry) => entry.contribution > 0)
    .sort((left, right) => right.contribution - left.contribution);
  const positiveGpPerKill = positiveDrops.reduce((sum, entry) => sum + entry.contribution, 0);
  const visibleDrops = positiveDrops.slice(0, 8);
  const hiddenDrops = positiveDrops.slice(8);
  const rows: LootValueCompositionRowViewModel[] = visibleDrops.map(({ drop, contribution }) => ({
    rowId: drop.rowId,
    name: createEntityDisplayLabel({
      technicalId: drop.key ?? null,
      gameDataName: drop.key ? gameData.items[drop.key]?.name : null,
      rowSourceName: drop.name
    }).name,
    action: drop.pref,
    actionLabel: lootActionLabel(drop.pref),
    gpPerKill: contribution,
    shareOfPositivePct: positiveGpPerKill > 0 ? (contribution / positiveGpPerKill) * 100 : null,
    stateLabel: lootRowStateLabel(drop),
    childCount: Array.isArray(drop._expand) ? drop._expand.length : 0,
    isOther: false
  }));
  const otherGpPerKill = hiddenDrops.reduce((sum, entry) => sum + entry.contribution, 0);

  if (otherGpPerKill > 0) {
    rows.push({
      rowId: null,
      name: "Other drops",
      action: null,
      actionLabel: "Mixed",
      gpPerKill: otherGpPerKill,
      shareOfPositivePct: positiveGpPerKill > 0 ? (otherGpPerKill / positiveGpPerKill) * 100 : null,
      stateLabel: null,
      childCount: hiddenDrops.reduce(
        (sum, entry) => sum + (Array.isArray(entry.drop._expand) ? entry.drop._expand.length : 0),
        0
      ),
      isOther: true
    });
  }

  const residualGpPerKill = trip.gpPerKill - positiveGpPerKill;
  const note =
    Math.abs(residualGpPerKill) >= 0.05
      ? `Displayed GP/kill differs by ${formatNumber(residualGpPerKill, 1)} GP because trip state or zero-value rows are applied outside the positive-contributor list.`
      : null;

  return {
    rows,
    positiveGpPerKill,
    displayedGpPerKill: trip.gpPerKill,
    residualGpPerKill,
    note
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
  lootPrefs: Record<string, LootAction | string | undefined>,
  lootPriceHistoryByItem: Readonly<Record<string, ItemPriceHistoryContext | undefined>> = {},
  priceNoticesByLootRowId: Readonly<Record<string, readonly PriceDataNotice[]>> = {}
): Omit<LootSummaryViewModel, "valueComposition"> & { rows: LootDropRowViewModel[] } {
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
      const candidateDrop =
        candidate.lootBreakdown.find((entry) => entry.rowId === drop.rowId) ?? drop;
      return {
        action,
        label: lootActionLabel(action),
        effectiveNetGpPerHour: candidate.effectiveNetGpPerHour,
        deltaNetGpPerHour: candidate.effectiveNetGpPerHour - defaultTrip.effectiveNetGpPerHour,
        gpPerKillContribution: effectiveDropEvGp(candidateDrop),
        isSelected: action === drop.pref,
        isDefault: action === defaultDrop.pref,
        stateLabel: lootRowStateLabel(candidateDrop),
        notes: actionImpactNotes(action, candidateDrop, natureRuneCost)
      };
    });
    const selectedImpact = actionImpacts.find((impact) => impact.action === drop.pref);
    const rowPriceNotices = priceNoticesByLootRowId[drop.rowId] ?? [];
    const expandedPriceRows = expandedRows(drop, context.gameData, rowPriceNotices);
    const nestedPriceItemIds = new Set(
      expandedPriceRows.flatMap((detail) =>
        detail.priceNotices.flatMap((notice) => notice.itemId ?? [])
      )
    );

    const displayLabel = createEntityDisplayLabel({
      technicalId: drop.key ?? null,
      gameDataName: drop.key ? context.gameData.items[drop.key]?.name : null,
      rowSourceName: drop.name
    });

    return {
      rowId: drop.rowId,
      name: displayLabel.name,
      displayLabel,
      key: drop.key ?? null,
      tag: typeof drop.tag === "string" ? drop.tag : null,
      chance: drop.chance,
      qtyAvg: drop.qtyAvg,
      price: drop.price,
      saleValue: drop.saleValue,
      evGp: drop.evGp,
      effectiveEvGp: effectiveDropEvGp(drop),
      stateLabel: lootRowStateLabel(drop),
      eligibilityDescription:
        drop.eligibility?.kind === "quest"
          ? drop.eligibility.description
          : drop.eligibility?.kind === "clue"
            ? "Requires a members area and no existing clue scroll."
            : null,
      pref: drop.pref,
      prefLabel: lootActionLabel(drop.pref),
      defaultPref: defaultDrop.pref,
      availableActions,
      actionImpacts,
      selectedDeltaNetGpPerHour: selectedImpact?.deltaNetGpPerHour ?? 0,
      isOverride:
        drop.eligibilityActive &&
        lootPrefs[drop.rowId] != null &&
        lootPrefs[drop.rowId] !== defaultDrop.pref,
      prayerXp: drop.prayerXp,
      alchValue: drop.alchValue,
      slotFrac: drop.slotFrac,
      expandedRows: expandedPriceRows,
      valueDetails: lootValueDetails(drop),
      historyContext: lootPriceHistoryContext(
        { ...drop, name: displayLabel.name },
        lootPriceHistoryByItem
      ),
      priceNotices: rowPriceNotices.filter(
        (notice) => notice.itemId === undefined || !nestedPriceItemIds.has(notice.itemId)
      )
    };
  });

  return {
    rows,
    defaultEffectiveNetGpPerHour: defaultTrip.effectiveNetGpPerHour,
    currentDeltaNetGpPerHour: currentTrip.effectiveNetGpPerHour - defaultTrip.effectiveNetGpPerHour,
    overrideCount: rows.filter((row) => row.isOverride).length
  };
}

export function createLootPresentationViewModel(input: {
  form: CombatSetupFormState;
  context: SimulationContext;
  tripInput: TripLootSupplyInput;
  trip: TripLootSupplyResult;
  lootPrefs: Record<string, LootAction | string | undefined>;
  lootSettingsByMonster?: LootSettingsByMonsterState;
  lootPriceHistoryByItem?: Readonly<Record<string, ItemPriceHistoryContext | undefined>>;
  priceNoticesByLootRowId?: Readonly<Record<string, readonly PriceDataNotice[]>>;
  includeRows?: boolean;
}): LootPresentationViewModel {
  const settings = lootSettingsForMonster(input.lootSettingsByMonster ?? {}, input.form.monsterId);
  const monster = input.context.gameData.monsters[input.form.monsterId];
  const derivedOverheadSec = monster ? defaultOverhead(monster) : 2;
  const highAlchEnabled = settings.highAlch ?? input.form.trip.alching;
  const overheadMode = settings.overheadSec == null ? "auto" : "manual";
  const overheadValue = settings.overheadSec ?? derivedOverheadSec;
  const rowResult =
    input.includeRows === false
      ? {
          rows: [],
          defaultEffectiveNetGpPerHour: input.trip.effectiveNetGpPerHour,
          currentDeltaNetGpPerHour: 0,
          overrideCount: 0
        }
      : createLootRows(
          input.tripInput,
          input.context,
          input.trip,
          input.lootPrefs,
          input.lootPriceHistoryByItem,
          input.priceNoticesByLootRowId
        );
  const actionableRows = rowResult.rows.filter((row) => row.eligibilityDescription === null);
  const conditionalRows = rowResult.rows.filter((row) => row.eligibilityDescription !== null);
  const explicitChoiceCount = Object.keys(input.lootPrefs).length;

  return {
    rows: rowResult.rows,
    actionableRows,
    conditionalRows,
    summary: {
      defaultEffectiveNetGpPerHour: rowResult.defaultEffectiveNetGpPerHour,
      currentDeltaNetGpPerHour: rowResult.currentDeltaNetGpPerHour,
      overrideCount: rowResult.overrideCount,
      valueComposition: createLootValueComposition(input.trip, input.context.gameData)
    },
    highAlchEnabled,
    overheadMode,
    overheadValue,
    derivedOverheadSec,
    policySummary: `${highAlchEnabled ? "High alch on" : "High alch off"} · ${formatNumber(
      explicitChoiceCount
    )} row ${explicitChoiceCount === 1 ? "choice" : "choices"}`
  };
}

function tripInputFor(
  form: CombatSetupFormState,
  request: SimulationRequest,
  combat: ReturnType<typeof simulateCombat>,
  cannonByMonster: CannonByMonsterState,
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): TripLootSupplyInput {
  return {
    ...createFullSimulationInput(form, request, cannonByMonster, lootSettingsByMonster),
    combat
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

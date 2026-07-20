import type { ScheduledStaticPriceSnapshotStatus } from "@/adapters/market";
import { MARKET_SOURCE_MAPPINGS } from "@/data/market-source-mapping";
import { deriveItemPriceFreshness, type ItemPriceFreshnessDisplay } from "@/domain/economy";
import type { GameDataSnapshot, ItemPriceMetadata, PriceSet } from "@/domain/shared";
import type { LootBreakdownEntry } from "@/domain/trip";
import {
  activeManualPriceOverridesForPriceSet,
  canSetManualPriceOverride,
  DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
  MANUAL_PRICE_OVERRIDES_MAX_ITEMS,
  type ManualPriceOverride,
  type ManualPriceOverridesState
} from "../state/manual-price-overrides";
import {
  activePriceSetOriginLabel,
  createScheduledPriceSnapshotViewModel,
  scheduledPriceSetFromStatus,
  type ActivePriceSetOrigin
} from "../state/market-sync";
import {
  analyzePriceHistoryMovers,
  analyzePriceHistoryTrend,
  createSharedPriceHistoryAnalysis,
  mergePriceHistoryForAnalysis,
  PRICE_HISTORY_MAX_SNAPSHOTS,
  priceHistorySnapshotKey,
  summarizePriceHistory,
  type BrowserPriceHistoryState,
  type PriceHistoryAnalysisState,
  type PriceHistoryBaselineMode,
  type PriceHistoryMoverSortKey,
  type PriceHistoryMoverSortState,
  type PriceHistoryMoversAnalysis,
  type PriceHistoryMoverRow,
  type PriceHistorySummary,
  type PriceHistoryTrendAnalysis,
  type PriceHistoryTrendPoint
} from "../state/price-history";
import {
  localPriceHistoryOccurrences,
  type LocalPriceHistoryOccurrence
} from "../state/local-price-history-lifecycle";
import { formatNumber } from "./formatting";
import type { CalculationWarningViewModel } from "./contracts";
import { createEntityDisplayLabel, type EntityDisplayLabel } from "./presentation-language";
import {
  createPriceTimeContext,
  presentPriceDateTime,
  presentPriceDateTimeOccurrences,
  type PriceDateTimePresentation,
  type PriceTimeContext
} from "./price-time";
import {
  PRICE_WARNING_PRIORITY,
  friendlyPriceWarningCopy,
  isMoneyWarningCode,
  isPriceIssueWarningCode
} from "./warning-presentation";

export { isMoneyWarningCode } from "./warning-presentation";

export interface PriceDataNotice {
  noticeId: string;
  code: string;
  itemId?: string;
  itemLabel: string;
  itemDisplayLabel: EntityDisplayLabel;
  level: "issue" | "note";
  consumer: "loot" | "supply" | "cannon";
  affectsCurrentResult: boolean;
  lootRowId?: string;
  summary: string;
  detail: string;
  action?: PriceNoticeAction;
}

export interface PriceNoticeAction {
  kind: "correct-price" | "inspect-item";
  itemId: string;
  noticeId: string;
  label: "Correct price" | "Inspect item";
}

export interface CurrentPriceNoticePresentation {
  issues: readonly PriceDataNotice[];
  notes: readonly PriceDataNotice[];
  all: readonly PriceDataNotice[];
  byLootRowId: Readonly<Record<string, readonly PriceDataNotice[]>>;
  resultAction: PriceNoticeAction | null;
}

export interface PriceDataSelectOption {
  id: string;
  label: string;
  displayLabel?: EntityDisplayLabel;
}

export const PRICE_HISTORY_BASELINE_OPTIONS: ReadonlyArray<{
  id: PriceHistoryBaselineMode;
  label: string;
}> = [
  { id: "previous", label: "Previous" },
  { id: "first", label: "First" },
  { id: "snapshot", label: "Snapshot" }
];

export interface ItemPriceMetadataSummary {
  observedHigh: number;
  observedMedium: number;
  observedLow: number;
  retained: number;
  generatedFallback: number;
  manual: number;
  unknown: number;
  missingMapped: number;
}

export interface ActivePriceSetPresentation {
  available: boolean;
  sourceLabel: string;
  label: string;
  source: string;
  timeLabel:
    | "Active prices updated"
    | "Active snapshot captured"
    | "Bundled price set created"
    | "Selected price set created";
  time: PriceDateTimePresentation;
  itemCount: number;
  alchCount: number;
  metadata: ItemPriceMetadataSummary;
}

export interface ScheduledPriceSetPresentation {
  ready: boolean;
  statusLabel: string;
  tone: "success" | "neutral" | "warning" | "error";
  message: string;
  fallbackLabel: string;
  label: string;
  timeLabel: "Snapshot captured";
  time: PriceDateTimePresentation;
  itemCount: number;
  alchCount: number;
  metadata: ItemPriceMetadataSummary;
}

export interface PriceSetResetPresentation {
  fallbackPriceSet: PriceSet | null;
  fallbackOrigin: Extract<ActivePriceSetOrigin, "scheduled" | "bundled">;
  fallbackLabel: string;
  canReset: boolean;
}

export interface PriceSetPresentation {
  active: ActivePriceSetPresentation;
  scheduled: ScheduledPriceSetPresentation;
  reset: PriceSetResetPresentation;
}

export interface ManualPriceEditorPresentation {
  itemOptions: PriceDataSelectOption[];
  itemId: string;
  itemLabel: string;
  itemDisplayLabel: EntityDisplayLabel;
  basePrice: number | null;
  activePrice: number | null;
  selectedOverride: ManualPriceOverride | null;
  updatedTime: PriceDateTimePresentation;
  inputValue: number;
  atCapacity: boolean;
  canApply: boolean;
  storedCount: number;
  activeCount: number;
  inactiveCount: number;
  maxItems: number;
}

export interface EconomyPriceHistoryControls {
  baselineMode: PriceHistoryBaselineMode;
  snapshotKey: string;
  itemFilter: string;
  trendItemId: string;
  sort: PriceHistoryMoverSortState;
}

export interface ItemPriceHistoryContext {
  itemId: string;
  itemLabel?: string;
  latestPrice: number | null;
  baselinePrice: number | null;
  gpDelta: number | null;
  percentDelta: number | null;
  latestLabel: string | null;
  baselineLabel: string | null;
  latestCaptureTime: PriceDateTimePresentation | null;
  baselineCaptureTime: PriceDateTimePresentation | null;
}

export interface PriceHistoryMoverRowPresentation extends PriceHistoryMoverRow {
  firstCaptureTime: PriceDateTimePresentation | null;
  latestCaptureTime: PriceDateTimePresentation | null;
}

export interface PriceHistoryMoversPresentation extends Omit<
  PriceHistoryMoversAnalysis,
  "rows" | "topGainers" | "topFallers"
> {
  rows: PriceHistoryMoverRowPresentation[];
  topGainers: PriceHistoryMoverRowPresentation[];
  topFallers: PriceHistoryMoverRowPresentation[];
}

export interface PriceHistoryTrendPointPresentation extends PriceHistoryTrendPoint {
  captureTime: PriceDateTimePresentation;
  observedTime: PriceDateTimePresentation;
  evaluatedTime: PriceDateTimePresentation;
}

export interface PriceHistoryTrendPresentation extends Omit<PriceHistoryTrendAnalysis, "points"> {
  points: PriceHistoryTrendPointPresentation[];
  firstCaptureTime: PriceDateTimePresentation | null;
  latestCaptureTime: PriceDateTimePresentation | null;
}

export interface EconomyHistoryAnalysisPresentation {
  controls: EconomyPriceHistoryControls;
  analysisState: PriceHistoryAnalysisState;
  sharedSnapshotCount: number;
  localSnapshotCount: number;
  sourceStatus: "shared + local" | "shared" | "local" | "empty";
  snapshotOptions: PriceDataSelectOption[];
  effectiveSnapshotKey: string;
  movers: PriceHistoryMoversPresentation;
  trendItemOptions: PriceDataSelectOption[];
  effectiveTrendItemId: string;
  trend: PriceHistoryTrendPresentation;
  latestSnapshotLabel: string;
  baselineSnapshotLabel: string;
  latestCaptureTime: PriceDateTimePresentation;
  baselineCaptureTime: PriceDateTimePresentation;
  lootHistoryByItem: Readonly<Record<string, ItemPriceHistoryContext>>;
  itemDisplayLabels: Readonly<Record<string, EntityDisplayLabel>>;
  localManagement: LocalPriceHistoryManagementViewModel;
}

export interface LocalPriceHistoryRowViewModel {
  occurrenceId: string;
  sourceIndex: number;
  snapshotKey: string;
  label: string;
  capturedAt: string;
  captureTime: PriceDateTimePresentation;
  sourcePriceSetId: string;
  itemCount: number;
  newest: boolean;
  oldest: boolean;
  nextReplacement: boolean;
  selectedAsBaseline: boolean;
}

export interface LocalPriceHistoryManagementViewModel {
  count: number;
  maximum: number;
  remaining: number;
  atCapacity: boolean;
  rows: readonly LocalPriceHistoryRowViewModel[];
}

export interface PriceHistorySources {
  analysisState: PriceHistoryAnalysisState;
  sharedHistory: PriceHistoryAnalysisState;
  localPriceHistory: BrowserPriceHistoryState;
  sharedSnapshotCount: number;
  localSnapshotCount: number;
  sourceStatus: "shared + local" | "shared" | "local" | "empty";
}

export interface PriceHistorySummaryPresentation extends PriceHistorySummary {
  latestTime: PriceDateTimePresentation;
}

export interface SelectedPriceItemPresentation {
  itemId: string;
  itemDisplayLabel: EntityDisplayLabel;
  price: number | null;
  metadata: ItemPriceMetadata | null;
  freshness: ItemPriceFreshnessDisplay;
  observedTime: PriceDateTimePresentation;
  evaluatedTime: PriceDateTimePresentation;
}

export interface EconomyHistoryPresentation extends EconomyHistoryAnalysisPresentation {
  summary: PriceHistorySummaryPresentation;
  selectedItem: SelectedPriceItemPresentation;
}

export interface PriceDataViewModel extends PriceSetPresentation {
  manual: ManualPriceEditorPresentation;
  history: EconomyHistoryPresentation;
}

export function economyAriaSort(
  sort: PriceHistoryMoverSortState,
  key: PriceHistoryMoverSortKey
): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

export function economyMoverTone(row: { gpDelta: number | null }): "gain" | "loss" | undefined {
  if (row.gpDelta === null || row.gpDelta === 0) return undefined;
  return row.gpDelta > 0 ? "gain" : "loss";
}

export function createPriceItemLabels(
  gameData: Pick<GameDataSnapshot, "items"> | null
): Record<string, string> {
  if (!gameData) return {};
  return Object.fromEntries(
    Object.entries(gameData.items).map(([itemId, item]) => [itemId, item.name])
  );
}

function comparePriceNotices(left: PriceDataNotice, right: PriceDataNotice): number {
  const priority =
    (PRICE_WARNING_PRIORITY[left.code] ?? Number.MAX_SAFE_INTEGER) -
    (PRICE_WARNING_PRIORITY[right.code] ?? Number.MAX_SAFE_INTEGER);
  if (priority !== 0) return priority;
  return left.itemLabel.localeCompare(right.itemLabel, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function priceNoticeId(...parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join(":");
}

export function createCurrentPriceNoticePresentation(input: {
  warnings: readonly CalculationWarningViewModel[];
  gameData: Pick<GameDataSnapshot, "items">;
  lootBreakdown: readonly Pick<LootBreakdownEntry, "rowId" | "name">[];
  editableItemIds?: ReadonlySet<string>;
}): CurrentPriceNoticePresentation {
  const lootLabelByRowId = new Map(input.lootBreakdown.map((row) => [row.rowId, row.name]));
  const notices: PriceDataNotice[] = [];
  const seen = new Set<string>();

  for (const warning of input.warnings) {
    if (!isMoneyWarningCode(warning.code)) continue;
    const context = warning.priceContext;
    const rowSourceName =
      warning.code === "unidentified-herb-price-approximation"
        ? "Unidentified herbs"
        : context?.lootRowId
          ? (lootLabelByRowId.get(context.lootRowId) ?? null)
          : warning.itemId
            ? null
            : "Price data";
    const itemDisplayLabel = createEntityDisplayLabel({
      technicalId: warning.itemId ?? null,
      gameDataName: warning.itemId ? input.gameData.items[warning.itemId]?.name : null,
      rowSourceName
    });
    const itemLabel = itemDisplayLabel.name;
    const consumer = context?.consumer ?? "loot";
    const affectsCurrentResult = context?.affectsCurrentResult ?? true;
    const level = isPriceIssueWarningCode(warning.code) ? "issue" : "note";
    const copy = friendlyPriceWarningCopy(warning.code, itemLabel);
    const noticeId = priceNoticeId(
      warning.code,
      warning.itemId ?? itemLabel,
      consumer,
      context?.lootRowId ?? ""
    );
    if (seen.has(noticeId)) continue;
    seen.add(noticeId);
    const correctable =
      warning.itemId !== undefined &&
      warning.code !== "missing-alch-value" &&
      input.editableItemIds?.has(warning.itemId) === true;
    const action = warning.itemId
      ? correctable
        ? ({
            kind: "correct-price",
            itemId: warning.itemId,
            noticeId,
            label: "Correct price"
          } satisfies PriceNoticeAction)
        : affectsCurrentResult
          ? ({
              kind: "inspect-item",
              itemId: warning.itemId,
              noticeId,
              label: "Inspect item"
            } satisfies PriceNoticeAction)
          : undefined
      : undefined;
    notices.push({
      noticeId,
      code: warning.code,
      ...(warning.itemId ? { itemId: warning.itemId } : {}),
      itemLabel,
      itemDisplayLabel,
      level,
      consumer,
      affectsCurrentResult,
      ...(context?.lootRowId ? { lootRowId: context.lootRowId } : {}),
      ...(action ? { action } : {}),
      ...copy
    });
  }

  notices.sort(comparePriceNotices);
  const active = notices.filter((notice) => notice.affectsCurrentResult);
  const byLootRowId: Record<string, PriceDataNotice[]> = {};
  for (const notice of notices) {
    if (!notice.lootRowId) continue;
    (byLootRowId[notice.lootRowId] ??= []).push(notice);
  }

  const issues = active.filter((notice) => notice.level === "issue");
  const distinctIssueActions = new Map<string, PriceNoticeAction>();
  for (const issue of issues) {
    if (!issue.action) continue;
    distinctIssueActions.set(
      `${issue.action.kind}:${issue.action.itemId}:${issue.action.noticeId}`,
      issue.action
    );
  }

  return {
    issues,
    notes: active.filter((notice) => notice.level === "note"),
    all: active,
    byLootRowId,
    resultAction:
      issues.length === 1 && distinctIssueActions.size === 1
        ? (distinctIssueActions.values().next().value ?? null)
        : null
  };
}

export function summarizeItemPriceMetadata(priceSet: PriceSet | null): ItemPriceMetadataSummary {
  const metadata = Object.values(priceSet?.itemPriceMetadata ?? {});
  return {
    observedHigh: metadata.filter(
      (item) => item.valueOrigin === "market-observation" && item.quality === "high"
    ).length,
    observedMedium: metadata.filter(
      (item) => item.valueOrigin === "market-observation" && item.quality === "medium"
    ).length,
    observedLow: metadata.filter(
      (item) => item.valueOrigin === "market-observation" && item.quality === "low"
    ).length,
    retained: metadata.filter((item) => item.refreshStatus === "retained").length,
    generatedFallback: metadata.filter(
      (item) => item.valueOrigin === "generated-object-cost" || item.quality === "fallback"
    ).length,
    manual: metadata.filter((item) => item.valueOrigin === "manual").length,
    unknown: metadata.filter((item) =>
      ["legacy-static", "imported", "unknown"].includes(item.valueOrigin)
    ).length,
    missingMapped: priceSet
      ? MARKET_SOURCE_MAPPINGS.filter(
          (mapping) => mapping.syncPrice && priceSet.itemPrices[mapping.itemId] === undefined
        ).length
      : 0
  };
}

export function createPriceSetPresentation(input: {
  activePriceSet: PriceSet | null;
  bundledPriceSet: PriceSet | null;
  scheduledSnapshotStatus: ScheduledStaticPriceSnapshotStatus | null;
  activePriceSetOrigin: ActivePriceSetOrigin;
  priceLabel: string;
  activeManualPriceOverrideCount: number;
  timeContext?: PriceTimeContext;
  ageNow?: Date;
}): PriceSetPresentation {
  const timeContext =
    input.timeContext ?? createPriceTimeContext(input.ageNow ?? new Date(0), "UTC");
  const scheduledPriceSet = scheduledPriceSetFromStatus(input.scheduledSnapshotStatus);
  const scheduledStatus = createScheduledPriceSnapshotViewModel(
    input.scheduledSnapshotStatus,
    input.activePriceSetOrigin
  );
  const scheduledMessage = input.scheduledSnapshotStatus?.warnings.length
    ? `${scheduledStatus.message} ${input.scheduledSnapshotStatus.warnings[0]}`
    : scheduledStatus.message;
  const activeSourceLabel = input.activeManualPriceOverrideCount
    ? `Manual item overrides (${formatNumber(input.activeManualPriceOverrideCount)})`
    : activePriceSetOriginLabel(input.activePriceSetOrigin);
  const resetFallbackPriceSet = scheduledPriceSet ?? input.bundledPriceSet;
  const resetFallbackOrigin: PriceSetResetPresentation["fallbackOrigin"] = scheduledPriceSet
    ? "scheduled"
    : "bundled";
  const resetFallbackLabel =
    resetFallbackOrigin === "scheduled" ? "scheduled prices" : "bundled prices";
  const activeTimeLabel = input.activeManualPriceOverrideCount
    ? "Active prices updated"
    : input.activePriceSetOrigin === "scheduled"
      ? "Active snapshot captured"
      : input.activePriceSetOrigin === "selected"
        ? "Selected price set created"
        : "Bundled price set created";

  return {
    active: {
      available: input.activePriceSet !== null,
      sourceLabel: activeSourceLabel,
      label: input.activePriceSet?.label ?? input.priceLabel,
      source: input.activePriceSet?.source ?? "-",
      timeLabel: activeTimeLabel,
      time: presentPriceDateTime(input.activePriceSet?.createdAt, timeContext),
      itemCount: Object.keys(input.activePriceSet?.itemPrices ?? {}).length,
      alchCount: Object.keys(input.activePriceSet?.alchValues ?? {}).length,
      metadata: summarizeItemPriceMetadata(input.activePriceSet)
    },
    scheduled: {
      ready: input.scheduledSnapshotStatus?.status === "loaded",
      statusLabel: scheduledStatus.statusLabel,
      tone: scheduledStatus.tone,
      message: scheduledMessage,
      fallbackLabel: scheduledStatus.fallbackLabel,
      label: scheduledPriceSet?.label ?? "-",
      timeLabel: "Snapshot captured",
      time: presentPriceDateTime(scheduledPriceSet?.createdAt, timeContext),
      itemCount: Object.keys(scheduledPriceSet?.itemPrices ?? {}).length,
      alchCount: Object.keys(scheduledPriceSet?.alchValues ?? {}).length,
      metadata: summarizeItemPriceMetadata(scheduledPriceSet)
    },
    reset: {
      fallbackPriceSet: resetFallbackPriceSet,
      fallbackOrigin: resetFallbackOrigin,
      fallbackLabel: resetFallbackLabel,
      canReset: Boolean(
        input.activePriceSet && resetFallbackPriceSet && input.activePriceSetOrigin === "selected"
      )
    }
  };
}

export function createManualPriceEditorPresentation(input: {
  activePriceSet: PriceSet | null;
  basePriceSet: PriceSet | null;
  itemLabels: Readonly<Record<string, string>>;
  manualPriceOverrides: ManualPriceOverridesState;
  selectedItemId: string;
  draft: number | null;
  timeContext?: PriceTimeContext;
}): ManualPriceEditorPresentation {
  const timeContext = input.timeContext ?? createPriceTimeContext(new Date(0), "UTC");
  const activeOverrides = input.basePriceSet
    ? activeManualPriceOverridesForPriceSet(input.manualPriceOverrides, input.basePriceSet)
    : DEFAULT_MANUAL_PRICE_OVERRIDES_STATE;
  const itemOptions = Object.keys(input.basePriceSet?.itemPrices ?? {})
    .map((itemId) => {
      const displayLabel = createEntityDisplayLabel({
        technicalId: itemId,
        gameDataName: input.itemLabels[itemId]
      });
      return { id: itemId, label: displayLabel.name, displayLabel };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
  const itemId = itemOptions.some((option) => option.id === input.selectedItemId)
    ? input.selectedItemId
    : (itemOptions[0]?.id ?? "");
  const basePrice = itemId ? (input.basePriceSet?.itemPrices[itemId] ?? null) : null;
  const activePrice = itemId ? (input.activePriceSet?.itemPrices[itemId] ?? null) : null;
  const selectedOverride = itemId ? (activeOverrides.items[itemId] ?? null) : null;
  const inputValue = input.draft ?? activePrice ?? basePrice ?? 0;
  const atCapacity =
    basePrice !== null &&
    inputValue !== basePrice &&
    !canSetManualPriceOverride(input.manualPriceOverrides, itemId);
  const storedCount = Object.keys(input.manualPriceOverrides.items).length;
  const activeCount = Object.keys(activeOverrides.items).length;
  const itemDisplayLabel =
    itemOptions.find((option) => option.id === itemId)?.displayLabel ??
    createEntityDisplayLabel({ technicalId: itemId || null });

  return {
    itemOptions,
    itemId,
    itemLabel: itemDisplayLabel.name,
    itemDisplayLabel,
    basePrice,
    activePrice,
    selectedOverride,
    updatedTime: presentPriceDateTime(selectedOverride?.updatedAt, timeContext, {
      missingText: "Not applicable"
    }),
    inputValue,
    atCapacity,
    canApply: basePrice !== null && !atCapacity,
    storedCount,
    activeCount,
    inactiveCount: storedCount - activeCount,
    maxItems: MANUAL_PRICE_OVERRIDES_MAX_ITEMS
  };
}

export function createPriceHistorySources(input: {
  scheduledSnapshotStatus: ScheduledStaticPriceSnapshotStatus | null;
  localPriceHistory: BrowserPriceHistoryState;
}): PriceHistorySources {
  const sharedHistory = createSharedPriceHistoryAnalysis(
    input.scheduledSnapshotStatus?.sharedPriceHistory ?? []
  );
  const analysisState = mergePriceHistoryForAnalysis({
    shared: sharedHistory,
    local: input.localPriceHistory
  });
  const sharedSnapshotCount = sharedHistory.snapshots.length;
  const localSnapshotCount = input.localPriceHistory.snapshots.length;
  return {
    analysisState,
    sharedHistory,
    localPriceHistory: input.localPriceHistory,
    sharedSnapshotCount,
    localSnapshotCount,
    sourceStatus: sharedSnapshotCount
      ? localSnapshotCount
        ? "shared + local"
        : "shared"
      : localSnapshotCount
        ? "local"
        : "empty"
  };
}

function selectedLocalBaselineSourceIndex(input: {
  sources: PriceHistorySources;
  controls: EconomyPriceHistoryControls;
  effectiveSnapshotKey: string;
}): number | null {
  const combined = [
    ...input.sources.sharedHistory.snapshots.map((snapshot, sourceIndex) => ({
      origin: "shared" as const,
      sourceIndex,
      snapshot
    })),
    ...input.sources.localPriceHistory.snapshots.map((snapshot, sourceIndex) => ({
      origin: "local" as const,
      sourceIndex,
      snapshot
    }))
  ].sort(
    (left, right) => Date.parse(right.snapshot.capturedAt) - Date.parse(left.snapshot.capturedAt)
  );
  const selected =
    input.controls.baselineMode === "first"
      ? (combined.at(-1) ?? null)
      : input.controls.baselineMode === "snapshot"
        ? (combined.find(
            (entry) => priceHistorySnapshotKey(entry.snapshot) === input.effectiveSnapshotKey
          ) ??
          combined[1] ??
          null)
        : (combined[1] ?? null);
  return selected?.origin === "local" ? selected.sourceIndex : null;
}

export function createLocalPriceHistoryManagementViewModel(input: {
  sources: PriceHistorySources;
  controls: EconomyPriceHistoryControls;
  effectiveSnapshotKey: string;
  timeContext?: PriceTimeContext;
}): LocalPriceHistoryManagementViewModel {
  const occurrences: readonly LocalPriceHistoryOccurrence[] = localPriceHistoryOccurrences(
    input.sources.localPriceHistory
  );
  const selectedSourceIndex = selectedLocalBaselineSourceIndex(input);
  const maximum = PRICE_HISTORY_MAX_SNAPSHOTS;
  const captureTimes = presentPriceDateTimeOccurrences(
    occurrences.map((occurrence) => occurrence.snapshot.capturedAt),
    input.timeContext ?? createPriceTimeContext(new Date(0), "UTC")
  );
  return {
    count: occurrences.length,
    maximum,
    remaining: Math.max(0, maximum - occurrences.length),
    atCapacity: occurrences.length >= maximum,
    rows: occurrences.map((occurrence, index) => ({
      occurrenceId: occurrence.occurrenceId,
      sourceIndex: occurrence.sourceIndex,
      snapshotKey: occurrence.snapshotKey,
      label: occurrence.snapshot.label,
      capturedAt: occurrence.snapshot.capturedAt,
      captureTime: captureTimes[index]!,
      sourcePriceSetId: occurrence.snapshot.sourcePriceSetId,
      itemCount: Object.keys(occurrence.snapshot.itemPrices).length,
      newest: occurrence.newest,
      oldest: occurrence.oldest,
      nextReplacement: occurrence.nextReplacement,
      selectedAsBaseline: occurrence.sourceIndex === selectedSourceIndex
    }))
  };
}

export function createEconomyHistoryPresentation(input: {
  sources: PriceHistorySources;
  itemLabels: Readonly<Record<string, string>>;
  controls: EconomyPriceHistoryControls;
  timeZone?: string;
}): EconomyHistoryAnalysisPresentation {
  const { analysisState } = input.sources;
  const exactTimeContext = createPriceTimeContext(new Date(0), input.timeZone ?? "UTC");
  const snapshotTimes = presentPriceDateTimeOccurrences(
    analysisState.snapshots.map((snapshot) => snapshot.capturedAt),
    exactTimeContext
  );
  const snapshotOptions = analysisState.snapshots.map((snapshot, index) => ({
    id: priceHistorySnapshotKey(snapshot),
    label: `${snapshot.label} · ${snapshotTimes[index]!.exactVisible}`
  }));
  const effectiveSnapshotKey = snapshotOptions.some(
    (option) => option.id === input.controls.snapshotKey
  )
    ? input.controls.snapshotKey
    : (snapshotOptions[0]?.id ?? "");
  const trendItemIds = new Set(
    analysisState.snapshots.flatMap((snapshot) => Object.keys(snapshot.itemPrices))
  );
  const itemDisplayLabels = Object.fromEntries(
    [...trendItemIds].map((itemId) => [
      itemId,
      createEntityDisplayLabel({
        technicalId: itemId,
        gameDataName: input.itemLabels[itemId]
      })
    ])
  );
  const resolvedItemLabels = Object.fromEntries(
    Object.entries(itemDisplayLabels).map(([itemId, displayLabel]) => [itemId, displayLabel.name])
  );
  const moverAnalysis = analyzePriceHistoryMovers(analysisState, {
    baselineMode: input.controls.baselineMode,
    baselineSnapshotKey: effectiveSnapshotKey,
    itemFilter: input.controls.itemFilter,
    itemLabels: resolvedItemLabels,
    sort: input.controls.sort
  });
  const trendItemOptions = [...trendItemIds]
    .map((itemId) => ({
      id: itemId,
      label: itemDisplayLabels[itemId]!.name,
      displayLabel: itemDisplayLabels[itemId]
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const effectiveTrendItemId = trendItemOptions.some(
    (option) => option.id === input.controls.trendItemId
  )
    ? input.controls.trendItemId
    : (moverAnalysis.rows[0]?.itemId ?? trendItemOptions[0]?.id ?? "");
  const trendAnalysis = analyzePriceHistoryTrend(analysisState, effectiveTrendItemId, {
    ...resolvedItemLabels
  });
  const moverRows = moverAnalysis.rows.map((row): PriceHistoryMoverRowPresentation => {
    const pointIndexes = analysisState.snapshots.flatMap((snapshot, index) =>
      Number.isFinite(snapshot.itemPrices[row.itemId]) ? [index] : []
    );
    return {
      ...row,
      firstCaptureTime:
        pointIndexes.length > 0 ? (snapshotTimes[pointIndexes.at(-1)!] ?? null) : null,
      latestCaptureTime: pointIndexes.length > 0 ? (snapshotTimes[pointIndexes[0]!] ?? null) : null
    };
  });
  const moverRowByItemId = new Map(moverRows.map((row) => [row.itemId, row]));
  const movers: PriceHistoryMoversPresentation = {
    ...moverAnalysis,
    rows: moverRows,
    topGainers: moverAnalysis.topGainers.flatMap((row) => {
      const presentation = moverRowByItemId.get(row.itemId);
      return presentation ? [presentation] : [];
    }),
    topFallers: moverAnalysis.topFallers.flatMap((row) => {
      const presentation = moverRowByItemId.get(row.itemId);
      return presentation ? [presentation] : [];
    })
  };
  const trendCaptureTimes = presentPriceDateTimeOccurrences(
    trendAnalysis.points.map((point) => point.capturedAt),
    exactTimeContext
  );
  const trendSourceSnapshots = [...analysisState.snapshots]
    .reverse()
    .filter((snapshot) => Number.isFinite(snapshot.itemPrices[effectiveTrendItemId]));
  const trendPoints = trendAnalysis.points.map(
    (point, index): PriceHistoryTrendPointPresentation => {
      const metadata = trendSourceSnapshots[index]?.itemPriceMetadata?.[effectiveTrendItemId];
      const observationMissingText =
        metadata?.valueOrigin === "manual" || metadata?.valueOrigin === "generated-object-cost"
          ? "Not applicable"
          : "Not recorded";
      return {
        ...point,
        captureTime: trendCaptureTimes[index]!,
        observedTime: presentPriceDateTime(metadata?.valueObservedAt, exactTimeContext, {
          missingText: observationMissingText
        }),
        evaluatedTime: presentPriceDateTime(metadata?.evaluatedAt, exactTimeContext, {
          missingText: "Not evaluated"
        })
      };
    }
  );
  const trend: PriceHistoryTrendPresentation = {
    ...trendAnalysis,
    points: trendPoints,
    firstCaptureTime: trendPoints[0]?.captureTime ?? null,
    latestCaptureTime: trendPoints.at(-1)?.captureTime ?? null
  };
  const lootMovers = analyzePriceHistoryMovers(analysisState, {
    baselineMode: input.controls.baselineMode,
    baselineSnapshotKey: effectiveSnapshotKey,
    itemLabels: resolvedItemLabels,
    sort: { key: "item", direction: "asc" }
  });
  const latestLabel = lootMovers.latest?.label ?? null;
  const baselineLabel = lootMovers.baseline?.label ?? null;
  const latestIndex = lootMovers.latest
    ? analysisState.snapshots.findIndex(
        (snapshot) =>
          priceHistorySnapshotKey(snapshot) === priceHistorySnapshotKey(lootMovers.latest!)
      )
    : -1;
  const baselineIndex = lootMovers.baseline
    ? analysisState.snapshots.findIndex(
        (snapshot) =>
          priceHistorySnapshotKey(snapshot) === priceHistorySnapshotKey(lootMovers.baseline!)
      )
    : -1;
  const latestCaptureTime = latestIndex >= 0 ? (snapshotTimes[latestIndex] ?? null) : null;
  const baselineCaptureTime = baselineIndex >= 0 ? (snapshotTimes[baselineIndex] ?? null) : null;
  const lootHistoryByItem = Object.fromEntries(
    lootMovers.rows.map((row) => [
      row.itemId,
      {
        itemId: row.itemId,
        itemLabel: row.itemLabel,
        latestPrice: row.latestPrice,
        baselinePrice: row.baselinePrice,
        gpDelta: row.gpDelta,
        percentDelta: row.percentDelta,
        latestLabel,
        baselineLabel,
        latestCaptureTime,
        baselineCaptureTime
      }
    ])
  );
  return {
    controls: input.controls,
    analysisState,
    sharedSnapshotCount: input.sources.sharedSnapshotCount,
    localSnapshotCount: input.sources.localSnapshotCount,
    sourceStatus: input.sources.sourceStatus,
    snapshotOptions,
    effectiveSnapshotKey,
    movers,
    trendItemOptions,
    effectiveTrendItemId,
    trend,
    latestSnapshotLabel: latestLabel ?? "Unavailable",
    baselineSnapshotLabel: baselineLabel ?? "Unavailable",
    latestCaptureTime: latestCaptureTime ?? presentPriceDateTime(null, exactTimeContext),
    baselineCaptureTime: baselineCaptureTime ?? presentPriceDateTime(null, exactTimeContext),
    lootHistoryByItem,
    itemDisplayLabels,
    localManagement: createLocalPriceHistoryManagementViewModel({
      sources: input.sources,
      controls: input.controls,
      effectiveSnapshotKey,
      timeContext: exactTimeContext
    })
  };
}

export function createPriceHistorySummaryPresentation(input: {
  analysisState: PriceHistoryAnalysisState;
  activePriceSet: PriceSet | null;
  evaluatedAt: Date;
  timeZone?: string;
  latestExactTime?: PriceDateTimePresentation;
}): PriceHistorySummaryPresentation {
  const summary = summarizePriceHistory(
    input.analysisState,
    input.activePriceSet,
    input.evaluatedAt
  );
  const relativeTime = presentPriceDateTime(
    input.analysisState.snapshots[0]?.capturedAt,
    createPriceTimeContext(input.evaluatedAt, input.timeZone ?? "UTC")
  );
  return {
    ...summary,
    latestTime: input.latestExactTime
      ? {
          ...input.latestExactTime,
          relativeVisible: relativeTime.relativeVisible,
          relativeAccessible: relativeTime.relativeAccessible
        }
      : relativeTime
  };
}

export function createSelectedPriceItemPresentation(input: {
  activePriceSet: PriceSet | null;
  itemId: string;
  itemLabels?: Readonly<Record<string, string>>;
  freshnessNow: Date;
  timeContext?: PriceTimeContext;
}): SelectedPriceItemPresentation {
  const metadata = input.itemId
    ? (input.activePriceSet?.itemPriceMetadata?.[input.itemId] ?? null)
    : null;
  const observationMissingText =
    metadata?.valueOrigin === "manual" || metadata?.valueOrigin === "generated-object-cost"
      ? "Not applicable"
      : "Not recorded";
  const timeContext = input.timeContext ?? createPriceTimeContext(input.freshnessNow, "UTC");
  return {
    itemId: input.itemId,
    itemDisplayLabel: createEntityDisplayLabel({
      technicalId: input.itemId || null,
      gameDataName: input.itemLabels?.[input.itemId]
    }),
    price: input.itemId ? (input.activePriceSet?.itemPrices[input.itemId] ?? null) : null,
    metadata,
    freshness: deriveItemPriceFreshness(metadata ?? undefined, input.freshnessNow),
    observedTime: presentPriceDateTime(metadata?.valueObservedAt, timeContext, {
      missingText: observationMissingText
    }),
    evaluatedTime: presentPriceDateTime(metadata?.evaluatedAt, timeContext, {
      missingText: "Not evaluated"
    })
  };
}

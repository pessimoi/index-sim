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
  priceHistorySnapshotKey,
  summarizePriceHistory,
  type BrowserPriceHistoryState,
  type PriceHistoryAnalysisState,
  type PriceHistoryBaselineMode,
  type PriceHistoryMoverSortKey,
  type PriceHistoryMoverSortState,
  type PriceHistoryMoversAnalysis,
  type PriceHistorySummary,
  type PriceHistoryTrendAnalysis
} from "../state/price-history";
import { formatNumber } from "./formatting";
import type { CalculationWarningViewModel } from "./contracts";
import {
  createEntityDisplayLabel,
  formatSemanticUnitValue,
  type EntityDisplayLabel,
  type SemanticUnitValue
} from "./presentation-language";

const MONEY_WARNING_CODES = new Set([
  "missing-price",
  "missing-alch-value",
  "price-alias-used",
  "price-fallback-used",
  "price-generated-fallback",
  "price-market-retained",
  "price-freshness-unknown",
  "approximate-data-source",
  "unidentified-herb-price-approximation"
]);

const PRICE_ISSUE_CODES = new Set(["missing-price", "missing-alch-value", "price-fallback-used"]);

const PRICE_NOTICE_PRIORITY: Readonly<Record<string, number>> = {
  "missing-price": 0,
  "missing-alch-value": 1,
  "price-fallback-used": 2,
  "price-generated-fallback": 3,
  "price-market-retained": 4,
  "price-freshness-unknown": 5,
  "price-alias-used": 6,
  "approximate-data-source": 7,
  "unidentified-herb-price-approximation": 8
};

export function isMoneyWarningCode(code: string): boolean {
  return MONEY_WARNING_CODES.has(code);
}

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
  createdAt: string;
  ageLabel: string;
  ageAccessibleLabel: string;
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
  createdAt: string;
  ageLabel: string;
  ageAccessibleLabel: string;
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
}

export interface EconomyHistoryAnalysisPresentation {
  controls: EconomyPriceHistoryControls;
  analysisState: PriceHistoryAnalysisState;
  sharedSnapshotCount: number;
  localSnapshotCount: number;
  sourceStatus: "shared + local" | "shared" | "local" | "empty";
  snapshotOptions: PriceDataSelectOption[];
  effectiveSnapshotKey: string;
  movers: PriceHistoryMoversAnalysis;
  trendItemOptions: PriceDataSelectOption[];
  effectiveTrendItemId: string;
  trend: PriceHistoryTrendAnalysis;
  lootHistoryByItem: Readonly<Record<string, ItemPriceHistoryContext>>;
  itemDisplayLabels: Readonly<Record<string, EntityDisplayLabel>>;
}

export interface PriceHistorySources {
  analysisState: PriceHistoryAnalysisState;
  sharedSnapshotCount: number;
  localSnapshotCount: number;
  sourceStatus: "shared + local" | "shared" | "local" | "empty";
}

export interface PriceHistorySummaryPresentation extends PriceHistorySummary {
  latestAgeLabel: string;
  latestAgeAccessibleLabel: string;
}

export interface SelectedPriceItemPresentation {
  itemId: string;
  itemDisplayLabel: EntityDisplayLabel;
  price: number | null;
  metadata: ItemPriceMetadata | null;
  freshness: ItemPriceFreshnessDisplay;
}

export interface EconomyHistoryPresentation extends EconomyHistoryAnalysisPresentation {
  summary: PriceHistorySummaryPresentation;
  selectedItem: SelectedPriceItemPresentation;
}

export interface PriceDataViewModel extends PriceSetPresentation {
  manual: ManualPriceEditorPresentation;
  history: EconomyHistoryPresentation;
}

export function formatPriceAgeValue(seconds: number | null): SemanticUnitValue {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return { visible: "-", accessible: "-" };
  }
  if (seconds < 60) return { visible: "<1 min", accessible: "less than 1 minute" };
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return formatSemanticUnitValue(formatNumber(minutes), minutes, "minute");
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return formatSemanticUnitValue(formatNumber(hours), hours, "hour");
  }
  const days = Math.floor(seconds / 86400);
  return formatSemanticUnitValue(formatNumber(days), days, "day");
}

export function formatPriceAge(seconds: number | null): string {
  return formatPriceAgeValue(seconds).visible;
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

function priceNoticeCopy(
  code: string,
  itemLabel: string
): Pick<PriceDataNotice, "summary" | "detail"> {
  if (code === "missing-price") {
    return {
      summary: "Missing price",
      detail: `${itemLabel} has no usable price, so its active value is incomplete.`
    };
  }
  if (code === "missing-alch-value") {
    return {
      summary: "Missing alch value",
      detail: `${itemLabel} has no usable alch value for the selected action.`
    };
  }
  if (code === "price-fallback-used") {
    return {
      summary: "Fallback used",
      detail: `${itemLabel} uses a fallback value in the current calculation.`
    };
  }
  if (code === "price-generated-fallback") {
    return {
      summary: "Estimated price",
      detail: `${itemLabel} uses a game-data estimate instead of an observed market price.`
    };
  }
  if (code === "price-market-retained") {
    return {
      summary: "Previous price retained",
      detail: `${itemLabel} keeps its previous accepted price because the latest evaluation could not replace it.`
    };
  }
  if (code === "price-freshness-unknown") {
    return {
      summary: "Price date unknown",
      detail: `${itemLabel} has a usable price but no verified market observation time.`
    };
  }
  if (code === "price-alias-used") {
    return {
      summary: "Related item price",
      detail: `${itemLabel} uses a compatible related-item price because its canonical price is missing.`
    };
  }
  if (code === "unidentified-herb-price-approximation") {
    return {
      summary: "Estimated herb price",
      detail: "Unidentified herbs use a shared proxy where species-specific prices are unavailable."
    };
  }
  return {
    summary: "Approximate source",
    detail: `${itemLabel} uses approximate source data in the current valuation.`
  };
}

function comparePriceNotices(left: PriceDataNotice, right: PriceDataNotice): number {
  const priority =
    (PRICE_NOTICE_PRIORITY[left.code] ?? Number.MAX_SAFE_INTEGER) -
    (PRICE_NOTICE_PRIORITY[right.code] ?? Number.MAX_SAFE_INTEGER);
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
    const level = PRICE_ISSUE_CODES.has(warning.code) ? "issue" : "note";
    const copy = priceNoticeCopy(warning.code, itemLabel);
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

function ageSeconds(priceSet: PriceSet | null, ageNow: Date): number | null {
  const createdAtMs = priceSet ? Date.parse(priceSet.createdAt) : NaN;
  return priceSet && Number.isFinite(createdAtMs)
    ? Math.max(0, Math.floor((ageNow.getTime() - createdAtMs) / 1000))
    : null;
}

export function createPriceSetPresentation(input: {
  activePriceSet: PriceSet | null;
  bundledPriceSet: PriceSet | null;
  scheduledSnapshotStatus: ScheduledStaticPriceSnapshotStatus | null;
  activePriceSetOrigin: ActivePriceSetOrigin;
  priceLabel: string;
  activeManualPriceOverrideCount: number;
  ageNow: Date;
}): PriceSetPresentation {
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
  const activeAge = formatPriceAgeValue(ageSeconds(input.activePriceSet, input.ageNow));
  const scheduledAge = formatPriceAgeValue(ageSeconds(scheduledPriceSet, input.ageNow));

  return {
    active: {
      available: input.activePriceSet !== null,
      sourceLabel: activeSourceLabel,
      label: input.activePriceSet?.label ?? input.priceLabel,
      source: input.activePriceSet?.source ?? "-",
      createdAt: input.activePriceSet?.createdAt ?? "-",
      ageLabel: activeAge.visible,
      ageAccessibleLabel: activeAge.accessible,
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
      createdAt: scheduledPriceSet?.createdAt ?? "-",
      ageLabel: scheduledAge.visible,
      ageAccessibleLabel: scheduledAge.accessible,
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
}): ManualPriceEditorPresentation {
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

export function createEconomyHistoryPresentation(input: {
  sources: PriceHistorySources;
  itemLabels: Readonly<Record<string, string>>;
  controls: EconomyPriceHistoryControls;
}): EconomyHistoryAnalysisPresentation {
  const { analysisState } = input.sources;
  const snapshotOptions = analysisState.snapshots.map((snapshot) => ({
    id: priceHistorySnapshotKey(snapshot),
    label: `${snapshot.label} - ${snapshot.capturedAt}`
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
  const movers = analyzePriceHistoryMovers(analysisState, {
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
    : (movers.rows[0]?.itemId ?? trendItemOptions[0]?.id ?? "");
  const trend = analyzePriceHistoryTrend(analysisState, effectiveTrendItemId, {
    ...resolvedItemLabels
  });
  const lootMovers = analyzePriceHistoryMovers(analysisState, {
    baselineMode: input.controls.baselineMode,
    baselineSnapshotKey: effectiveSnapshotKey,
    itemLabels: resolvedItemLabels,
    sort: { key: "item", direction: "asc" }
  });
  const latestLabel = lootMovers.latest?.label ?? null;
  const baselineLabel = lootMovers.baseline?.label ?? null;
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
        baselineLabel
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
    lootHistoryByItem,
    itemDisplayLabels
  };
}

export function createPriceHistorySummaryPresentation(input: {
  analysisState: PriceHistoryAnalysisState;
  activePriceSet: PriceSet | null;
  evaluatedAt: Date;
}): PriceHistorySummaryPresentation {
  const summary = summarizePriceHistory(
    input.analysisState,
    input.activePriceSet,
    input.evaluatedAt
  );
  const latestAge = formatPriceAgeValue(summary.latestAgeSeconds);
  return {
    ...summary,
    latestAgeLabel: latestAge.visible,
    latestAgeAccessibleLabel: latestAge.accessible
  };
}

export function createSelectedPriceItemPresentation(input: {
  activePriceSet: PriceSet | null;
  itemId: string;
  itemLabels?: Readonly<Record<string, string>>;
  freshnessNow: Date;
}): SelectedPriceItemPresentation {
  const metadata = input.itemId
    ? (input.activePriceSet?.itemPriceMetadata?.[input.itemId] ?? null)
    : null;
  return {
    itemId: input.itemId,
    itemDisplayLabel: createEntityDisplayLabel({
      technicalId: input.itemId || null,
      gameDataName: input.itemLabels?.[input.itemId]
    }),
    price: input.itemId ? (input.activePriceSet?.itemPrices[input.itemId] ?? null) : null,
    metadata,
    freshness: deriveItemPriceFreshness(metadata ?? undefined, input.freshnessNow)
  };
}

import type { ScheduledStaticPriceSnapshotStatus } from "@/adapters/market";
import { MARKET_SOURCE_MAPPINGS } from "@/data/market-source-mapping";
import { deriveItemPriceFreshness, type ItemPriceFreshnessDisplay } from "@/domain/economy";
import type { GameDataSnapshot, ItemPriceMetadata, PriceSet } from "@/domain/shared";
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

export interface PriceDataSelectOption {
  id: string;
  label: string;
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
}

export interface PriceHistorySources {
  analysisState: PriceHistoryAnalysisState;
  sharedSnapshotCount: number;
  localSnapshotCount: number;
  sourceStatus: "shared + local" | "shared" | "local" | "empty";
}

export interface PriceHistorySummaryPresentation extends PriceHistorySummary {
  latestAgeLabel: string;
}

export interface SelectedPriceItemPresentation {
  itemId: string;
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

export function formatPriceAge(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "-";
  if (seconds < 60) return "<1m";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
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

  return {
    active: {
      available: input.activePriceSet !== null,
      sourceLabel: activeSourceLabel,
      label: input.activePriceSet?.label ?? input.priceLabel,
      source: input.activePriceSet?.source ?? "-",
      createdAt: input.activePriceSet?.createdAt ?? "-",
      ageLabel: formatPriceAge(ageSeconds(input.activePriceSet, input.ageNow)),
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
      ageLabel: formatPriceAge(ageSeconds(scheduledPriceSet, input.ageNow)),
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
    .map((itemId) => ({ id: itemId, label: input.itemLabels[itemId] ?? itemId }))
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

  return {
    itemOptions,
    itemId,
    itemLabel: (input.itemLabels[itemId] ?? itemId) || "-",
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
  const movers = analyzePriceHistoryMovers(analysisState, {
    baselineMode: input.controls.baselineMode,
    baselineSnapshotKey: effectiveSnapshotKey,
    itemFilter: input.controls.itemFilter,
    itemLabels: { ...input.itemLabels },
    sort: input.controls.sort
  });
  const trendItemIds = new Set(
    analysisState.snapshots.flatMap((snapshot) => Object.keys(snapshot.itemPrices))
  );
  const trendItemOptions = [...trendItemIds]
    .map((itemId) => ({ id: itemId, label: input.itemLabels[itemId] ?? itemId }))
    .sort((left, right) => left.label.localeCompare(right.label));
  const effectiveTrendItemId = trendItemOptions.some(
    (option) => option.id === input.controls.trendItemId
  )
    ? input.controls.trendItemId
    : (movers.rows[0]?.itemId ?? trendItemOptions[0]?.id ?? "");
  const trend = analyzePriceHistoryTrend(analysisState, effectiveTrendItemId, {
    ...input.itemLabels
  });
  const lootMovers = analyzePriceHistoryMovers(analysisState, {
    baselineMode: input.controls.baselineMode,
    baselineSnapshotKey: effectiveSnapshotKey,
    itemLabels: { ...input.itemLabels },
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
    lootHistoryByItem
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
  return { ...summary, latestAgeLabel: formatPriceAge(summary.latestAgeSeconds) };
}

export function createSelectedPriceItemPresentation(input: {
  activePriceSet: PriceSet | null;
  itemId: string;
  freshnessNow: Date;
}): SelectedPriceItemPresentation {
  const metadata = input.itemId
    ? (input.activePriceSet?.itemPriceMetadata?.[input.itemId] ?? null)
    : null;
  return {
    itemId: input.itemId,
    price: input.itemId ? (input.activePriceSet?.itemPrices[input.itemId] ?? null) : null,
    metadata,
    freshness: deriveItemPriceFreshness(metadata ?? undefined, input.freshnessNow)
  };
}

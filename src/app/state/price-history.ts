import { z } from "zod";
import { PriceMapSchema, PriceSetSchema, parsePriceHistory } from "@/data/schemas";
import type { PriceSet } from "@/domain/shared";

export const PRICE_HISTORY_STORAGE_KEY = "index-sim:price-history";
export const PRICE_HISTORY_VERSION = 1;
export const PRICE_HISTORY_MAX_SNAPSHOTS = 20;
export const PRICE_HISTORY_MAX_ITEMS_PER_SNAPSHOT = 2_000;
export const PRICE_HISTORY_ANALYSIS_MAX_SNAPSHOTS = 10_000;

const IsoTimestampSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid timestamp");

const CappedPriceMapSchema = PriceMapSchema.refine(
  (prices) => Object.keys(prices).length <= PRICE_HISTORY_MAX_ITEMS_PER_SNAPSHOT,
  `At most ${PRICE_HISTORY_MAX_ITEMS_PER_SNAPSHOT} item prices can be stored per snapshot`
);

export const BrowserPriceHistorySnapshotSchema = z
  .object({
    capturedAt: IsoTimestampSchema,
    sourcePriceSetId: z.string().min(1),
    label: z.string().min(1).max(160),
    itemPrices: CappedPriceMapSchema
  })
  .strict();

export const BrowserPriceHistoryStateSchema = z
  .object({
    snapshots: z.array(BrowserPriceHistorySnapshotSchema).max(PRICE_HISTORY_MAX_SNAPSHOTS)
  })
  .strict();

export type BrowserPriceHistorySnapshot = z.infer<typeof BrowserPriceHistorySnapshotSchema>;
export type BrowserPriceHistoryState = z.infer<typeof BrowserPriceHistoryStateSchema>;

export const PriceHistoryAnalysisStateSchema = z
  .object({
    snapshots: z.array(BrowserPriceHistorySnapshotSchema).max(PRICE_HISTORY_ANALYSIS_MAX_SNAPSHOTS)
  })
  .strict();

export type PriceHistoryAnalysisState = z.infer<typeof PriceHistoryAnalysisStateSchema>;

export const DEFAULT_PRICE_HISTORY_STATE: BrowserPriceHistoryState = {
  snapshots: []
};

export type PriceHistoryBaselineMode = "previous" | "first" | "snapshot";
export type PriceHistoryMoverSortKey =
  "item" | "latestPrice" | "baselinePrice" | "gpDelta" | "percentDelta";
export type PriceHistoryMoverSortDirection = "asc" | "desc";

export interface PriceHistoryMoverSortState {
  key: PriceHistoryMoverSortKey;
  direction: PriceHistoryMoverSortDirection;
}

export interface PriceHistorySummary {
  snapshotCount: number;
  trackedItemCount: number;
  latestAgeSeconds: number | null;
  activeLabel: string;
  latestLabel: string;
  activeMatchesLatest: boolean;
}

export interface PriceHistoryMoverRow {
  itemId: string;
  itemLabel: string;
  latestPrice: number | null;
  baselinePrice: number | null;
  gpDelta: number | null;
  percentDelta: number | null;
  trendPrices: number[];
}

export interface PriceHistoryMoversAnalysis {
  latest: BrowserPriceHistorySnapshot | null;
  baseline: BrowserPriceHistorySnapshot | null;
  baselineLabel: string;
  movedItemCount: number;
  rows: PriceHistoryMoverRow[];
  topGainers: PriceHistoryMoverRow[];
  topFallers: PriceHistoryMoverRow[];
}

export interface PriceHistoryTrendPoint {
  snapshotKey: string;
  capturedAt: string;
  snapshotLabel: string;
  sourcePriceSetId: string;
  price: number;
  gpDeltaFromPrevious: number | null;
  percentDeltaFromPrevious: number | null;
}

export interface PriceHistoryTrendAnalysis {
  itemId: string;
  itemLabel: string;
  points: PriceHistoryTrendPoint[];
  firstPrice: number | null;
  latestPrice: number | null;
  minimumPrice: number | null;
  maximumPrice: number | null;
  netGpDelta: number | null;
  netPercentDelta: number | null;
}

export interface AnalyzePriceHistoryMoversOptions {
  baselineMode?: PriceHistoryBaselineMode;
  baselineSnapshotKey?: string;
  itemFilter?: string;
  itemLabels?: Record<string, string>;
  sort?: PriceHistoryMoverSortState;
}

function capItemPrices(itemPrices: PriceSet["itemPrices"]): PriceSet["itemPrices"] {
  return Object.fromEntries(
    Object.entries(itemPrices)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, PRICE_HISTORY_MAX_ITEMS_PER_SNAPSHOT)
  );
}

export function priceHistorySnapshotKey(snapshot: BrowserPriceHistorySnapshot): string {
  return `${snapshot.capturedAt}::${snapshot.sourcePriceSetId}`;
}

function snapshotLabel(snapshot: BrowserPriceHistorySnapshot | null): string {
  return snapshot ? `${snapshot.label} (${snapshot.capturedAt})` : "-";
}

export function createPriceHistorySnapshot(
  priceSet: PriceSet,
  capturedAt: Date = new Date()
): BrowserPriceHistorySnapshot {
  const validated = PriceSetSchema.parse(priceSet) as PriceSet;
  return BrowserPriceHistorySnapshotSchema.parse({
    capturedAt: capturedAt.toISOString(),
    sourcePriceSetId: validated.id,
    label: validated.label,
    itemPrices: capItemPrices(validated.itemPrices)
  });
}

export function appendAcceptedPriceSetToHistory(
  current: BrowserPriceHistoryState,
  priceSet: PriceSet,
  capturedAt: Date = new Date()
): BrowserPriceHistoryState {
  const validatedCurrent = BrowserPriceHistoryStateSchema.parse(current);
  const snapshot = createPriceHistorySnapshot(priceSet, capturedAt);

  return {
    snapshots: [snapshot, ...validatedCurrent.snapshots].slice(0, PRICE_HISTORY_MAX_SNAPSHOTS)
  };
}

export function keepPriceHistoryOnFailure(
  current: BrowserPriceHistoryState
): BrowserPriceHistoryState {
  return current;
}

export function createSharedPriceHistoryAnalysis(input: unknown): PriceHistoryAnalysisState {
  const snapshots = parsePriceHistory(input)
    .map((snapshot) =>
      BrowserPriceHistorySnapshotSchema.parse({
        capturedAt: new Date(snapshot.t * 1000).toISOString(),
        sourcePriceSetId: `scheduled-market-${snapshot.t}`,
        label: "Scheduled market",
        itemPrices: capItemPrices(snapshot.prices)
      })
    )
    .sort((left, right) => Date.parse(right.capturedAt) - Date.parse(left.capturedAt));
  return PriceHistoryAnalysisStateSchema.parse({ snapshots });
}

export function mergePriceHistoryForAnalysis(input: {
  shared: PriceHistoryAnalysisState;
  local: BrowserPriceHistoryState;
}): PriceHistoryAnalysisState {
  const shared = PriceHistoryAnalysisStateSchema.parse(input.shared);
  const local = BrowserPriceHistoryStateSchema.parse(input.local);
  const snapshots = [...shared.snapshots, ...local.snapshots]
    .sort((left, right) => Date.parse(right.capturedAt) - Date.parse(left.capturedAt))
    .slice(0, PRICE_HISTORY_ANALYSIS_MAX_SNAPSHOTS);
  return PriceHistoryAnalysisStateSchema.parse({ snapshots });
}

export function summarizePriceHistory(
  history: PriceHistoryAnalysisState,
  activePriceSet: PriceSet | null,
  now: Date = new Date()
): PriceHistorySummary {
  const validatedHistory = PriceHistoryAnalysisStateSchema.parse(history);
  const latest = validatedHistory.snapshots[0] ?? null;
  const latestAgeSeconds = latest
    ? Math.max(0, Math.floor((now.getTime() - Date.parse(latest.capturedAt)) / 1000))
    : null;

  return {
    snapshotCount: validatedHistory.snapshots.length,
    trackedItemCount: latest ? Object.keys(latest.itemPrices).length : 0,
    latestAgeSeconds,
    activeLabel: activePriceSet?.label ?? "-",
    latestLabel: latest?.label ?? "-",
    activeMatchesLatest:
      !!activePriceSet &&
      !!latest &&
      activePriceSet.id === latest.sourcePriceSetId &&
      activePriceSet.label === latest.label
  };
}

function resolveBaselineSnapshot(
  snapshots: readonly BrowserPriceHistorySnapshot[],
  mode: PriceHistoryBaselineMode,
  snapshotKey?: string
): BrowserPriceHistorySnapshot | null {
  if (mode === "first") return snapshots.at(-1) ?? null;
  if (mode === "snapshot") {
    return (
      snapshots.find((snapshot) => priceHistorySnapshotKey(snapshot) === snapshotKey) ??
      snapshots[1] ??
      null
    );
  }
  return snapshots[1] ?? null;
}

function nullablePrice(prices: Record<string, number>, itemId: string): number | null {
  const value = prices[itemId];
  return Number.isFinite(value) ? value : null;
}

function priceDelta(latestPrice: number | null, baselinePrice: number | null): number | null {
  if (latestPrice === null || baselinePrice === null) return null;
  return latestPrice - baselinePrice;
}

function percentDelta(latestPrice: number | null, baselinePrice: number | null): number | null {
  if (latestPrice === null || baselinePrice === null || baselinePrice <= 0) return null;
  return ((latestPrice - baselinePrice) / baselinePrice) * 100;
}

export function analyzePriceHistoryTrend(
  history: PriceHistoryAnalysisState,
  itemId: string,
  itemLabels: Record<string, string> = {}
): PriceHistoryTrendAnalysis {
  const validatedHistory = PriceHistoryAnalysisStateSchema.parse(history);
  const normalizedItemId = itemId.trim();
  const points = [...validatedHistory.snapshots]
    .reverse()
    .flatMap((snapshot): PriceHistoryTrendPoint[] => {
      const price = normalizedItemId ? nullablePrice(snapshot.itemPrices, normalizedItemId) : null;
      if (price === null) return [];
      return [
        {
          snapshotKey: priceHistorySnapshotKey(snapshot),
          capturedAt: snapshot.capturedAt,
          snapshotLabel: snapshot.label,
          sourcePriceSetId: snapshot.sourcePriceSetId,
          price,
          gpDeltaFromPrevious: null,
          percentDeltaFromPrevious: null
        }
      ];
    })
    .map((point, index, allPoints) => {
      const previousPrice = allPoints[index - 1]?.price ?? null;
      return {
        ...point,
        gpDeltaFromPrevious: priceDelta(point.price, previousPrice),
        percentDeltaFromPrevious: percentDelta(point.price, previousPrice)
      };
    });
  const firstPrice = points[0]?.price ?? null;
  const latestPrice = points.at(-1)?.price ?? null;
  const prices = points.map((point) => point.price);

  return {
    itemId: normalizedItemId,
    itemLabel: itemLabels[normalizedItemId] ?? (normalizedItemId.replaceAll("_", " ") || "-"),
    points,
    firstPrice,
    latestPrice,
    minimumPrice: prices.length ? Math.min(...prices) : null,
    maximumPrice: prices.length ? Math.max(...prices) : null,
    netGpDelta: priceDelta(latestPrice, firstPrice),
    netPercentDelta: percentDelta(latestPrice, firstPrice)
  };
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: PriceHistoryMoverSortDirection
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "asc" ? left - right : right - left;
}

function compareMoverRows(
  left: PriceHistoryMoverRow,
  right: PriceHistoryMoverRow,
  sort: PriceHistoryMoverSortState
): number {
  if (sort.key === "item") {
    const compared = left.itemLabel.localeCompare(right.itemLabel);
    return sort.direction === "asc" ? compared : -compared;
  }
  return compareNullableNumbers(left[sort.key], right[sort.key], sort.direction);
}

export function analyzePriceHistoryMovers(
  history: PriceHistoryAnalysisState,
  options: AnalyzePriceHistoryMoversOptions = {}
): PriceHistoryMoversAnalysis {
  const validatedHistory = PriceHistoryAnalysisStateSchema.parse(history);
  const snapshots = validatedHistory.snapshots;
  const latest = snapshots[0] ?? null;
  const baseline = resolveBaselineSnapshot(
    snapshots,
    options.baselineMode ?? "previous",
    options.baselineSnapshotKey
  );
  const itemLabels = options.itemLabels ?? {};
  const filter = (options.itemFilter ?? "").trim().toLocaleLowerCase();
  const sort = options.sort ?? { key: "gpDelta", direction: "desc" };

  const itemIds = Array.from(
    new Set([...Object.keys(latest?.itemPrices ?? {}), ...Object.keys(baseline?.itemPrices ?? {})])
  );

  const rows = itemIds
    .map((itemId): PriceHistoryMoverRow => {
      const itemLabel = itemLabels[itemId] ?? itemId.replaceAll("_", " ");
      const latestPrice = latest ? nullablePrice(latest.itemPrices, itemId) : null;
      const baselinePrice = baseline ? nullablePrice(baseline.itemPrices, itemId) : null;
      return {
        itemId,
        itemLabel,
        latestPrice,
        baselinePrice,
        gpDelta: priceDelta(latestPrice, baselinePrice),
        percentDelta: percentDelta(latestPrice, baselinePrice),
        trendPrices: [...snapshots].reverse().flatMap((snapshot) => {
          const price = nullablePrice(snapshot.itemPrices, itemId);
          return price === null ? [] : [price];
        })
      };
    })
    .filter((row) =>
      filter.length === 0
        ? true
        : `${row.itemLabel} ${row.itemId}`.toLocaleLowerCase().includes(filter)
    )
    .sort((left, right) => compareMoverRows(left, right, sort));

  const movedRows = rows.filter((row) => row.gpDelta !== null && row.gpDelta !== 0);
  const byDeltaDesc = [...movedRows].sort((left, right) =>
    compareNullableNumbers(left.gpDelta, right.gpDelta, "desc")
  );
  const byDeltaAsc = [...movedRows].sort((left, right) =>
    compareNullableNumbers(left.gpDelta, right.gpDelta, "asc")
  );

  return {
    latest,
    baseline,
    baselineLabel: snapshotLabel(baseline),
    movedItemCount: movedRows.length,
    rows,
    topGainers: byDeltaDesc.filter((row) => (row.gpDelta ?? 0) > 0).slice(0, 5),
    topFallers: byDeltaAsc.filter((row) => (row.gpDelta ?? 0) < 0).slice(0, 5)
  };
}

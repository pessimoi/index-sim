import { z } from "zod";
import {
  ItemPriceMetadataMapSchema,
  PriceMapSchema,
  PriceSetSchema,
  completeItemPriceMetadata,
  parsePriceHistory
} from "@/data/schemas";
import type { ItemPriceMetadata, PriceSet } from "@/domain/shared";
import {
  loadPersisted,
  savePersisted,
  type KeyValueStorage,
  type LoadPersistedResult
} from "@/adapters/storage";

export const PRICE_HISTORY_STORAGE_KEY = "index-sim:price-history";
export const PRICE_HISTORY_VERSION = 2;
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

const PricePointStatusSchema = z.enum([
  "observed",
  "retained",
  "carried-forward",
  "legacy-unknown",
  "local-capture"
]);

export const BrowserPriceHistorySnapshotSchema = z
  .object({
    capturedAt: IsoTimestampSchema,
    sourcePriceSetId: z.string().min(1),
    label: z.string().min(1).max(160),
    itemPrices: CappedPriceMapSchema,
    itemPriceMetadata: ItemPriceMetadataMapSchema.optional(),
    itemPriceStatuses: z.record(z.string().min(1), PricePointStatusSchema).optional()
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    const priceKeys = Object.keys(snapshot.itemPrices).sort();
    if (!snapshot.itemPriceMetadata) return;
    const metadataKeys = Object.keys(snapshot.itemPriceMetadata).sort();
    if (JSON.stringify(priceKeys) !== JSON.stringify(metadataKeys)) {
      ctx.addIssue({
        code: "custom",
        path: ["itemPriceMetadata"],
        message: "history metadata keys must match item price keys"
      });
    }
  });

const BrowserPriceHistorySnapshotV1Schema = z
  .object({
    capturedAt: IsoTimestampSchema,
    sourcePriceSetId: z.string().min(1),
    label: z.string().min(1).max(160),
    itemPrices: CappedPriceMapSchema
  })
  .strict();

const BrowserPriceHistoryStateV1Schema = z
  .object({
    snapshots: z.array(BrowserPriceHistorySnapshotV1Schema).max(PRICE_HISTORY_MAX_SNAPSHOTS)
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

function unknownHistoryMetadata(itemPrices: Record<string, number>) {
  return completeItemPriceMetadata({
    itemPrices,
    fallbackOrigin: "unknown",
    fallbackReasonCode: "legacy-metadata-unavailable"
  });
}

export function loadBrowserPriceHistory(
  storage: KeyValueStorage
): LoadPersistedResult<BrowserPriceHistoryState> {
  const currentOptions = {
    key: PRICE_HISTORY_STORAGE_KEY,
    version: PRICE_HISTORY_VERSION,
    schema: BrowserPriceHistoryStateSchema,
    storage
  };
  const current = loadPersisted(currentOptions);
  if (current.status !== "version-mismatch" || current.foundVersion !== 1) return current;

  const legacy = loadPersisted({
    ...currentOptions,
    version: 1,
    schema: BrowserPriceHistoryStateV1Schema
  });
  if (legacy.status !== "loaded") return current;
  const value = BrowserPriceHistoryStateSchema.parse({
    snapshots: legacy.value.snapshots.map((snapshot) => ({
      ...snapshot,
      itemPriceMetadata: unknownHistoryMetadata(snapshot.itemPrices),
      itemPriceStatuses: Object.fromEntries(
        Object.keys(snapshot.itemPrices).map((itemId) => [itemId, "legacy-unknown"])
      )
    }))
  });
  try {
    const envelope = savePersisted(currentOptions, value);
    return { status: "loaded", value, envelope };
  } catch {
    return {
      status: "loaded",
      value,
      envelope: { version: PRICE_HISTORY_VERSION, savedAt: legacy.envelope.savedAt, data: value }
    };
  }
}

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
  priceStatus: z.infer<typeof PricePointStatusSchema>;
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

function metadataForCappedPrices(
  itemPrices: Record<string, number>,
  metadata: Record<string, ItemPriceMetadata> | undefined
): Record<string, ItemPriceMetadata> {
  return completeItemPriceMetadata({
    itemPrices,
    itemPriceMetadata: Object.fromEntries(
      Object.keys(itemPrices).flatMap((itemId) =>
        metadata?.[itemId] ? [[itemId, metadata[itemId]]] : []
      )
    ),
    fallbackOrigin: "unknown",
    fallbackReasonCode: "legacy-metadata-unavailable"
  });
}

export function priceHistorySnapshotKey(snapshot: BrowserPriceHistorySnapshot): string {
  return `${snapshot.capturedAt}::${snapshot.sourcePriceSetId}`;
}

function snapshotLabel(snapshot: BrowserPriceHistorySnapshot | null): string {
  return snapshot ? `${snapshot.label} (${snapshot.capturedAt})` : "-";
}

function activePriceSetMatchesSnapshot(
  activePriceSet: PriceSet,
  snapshot: BrowserPriceHistorySnapshot
): boolean {
  const identityMatches =
    (activePriceSet.id === snapshot.sourcePriceSetId && activePriceSet.label === snapshot.label) ||
    activePriceSet.createdAt === snapshot.capturedAt;
  if (!identityMatches) return false;
  const prices = Object.entries(snapshot.itemPrices);
  return (
    prices.length > 0 &&
    prices.every(([itemId, price]) => activePriceSet.itemPrices[itemId] === price)
  );
}

export function createPriceHistorySnapshot(
  priceSet: PriceSet,
  capturedAt: Date = new Date()
): BrowserPriceHistorySnapshot {
  const validated = PriceSetSchema.parse(priceSet) as PriceSet;
  const itemPrices = capItemPrices(validated.itemPrices);
  return BrowserPriceHistorySnapshotSchema.parse({
    capturedAt: capturedAt.toISOString(),
    sourcePriceSetId: validated.id,
    label: validated.label,
    itemPrices,
    itemPriceMetadata: metadataForCappedPrices(itemPrices, validated.itemPriceMetadata),
    itemPriceStatuses: Object.fromEntries(
      Object.keys(itemPrices).map((itemId) => [itemId, "local-capture"])
    )
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
    .snapshots.map((snapshot) =>
      BrowserPriceHistorySnapshotSchema.parse(
        (() => {
          const itemPrices = capItemPrices(snapshot.prices);
          const metadata = unknownHistoryMetadata(itemPrices);
          const itemPriceStatuses = Object.fromEntries(
            Object.keys(itemPrices).map((itemId) => [
              itemId,
              snapshot.kind === "legacy-unknown" ? "legacy-unknown" : "carried-forward"
            ])
          );
          for (const [itemId, evaluation] of Object.entries(snapshot.evaluations)) {
            if (itemPrices[itemId] === undefined) continue;
            itemPriceStatuses[itemId] = evaluation.result;
            metadata[itemId] =
              evaluation.result === "observed"
                ? {
                    valueOrigin: "market-observation",
                    refreshStatus: "observed",
                    quality: evaluation.quality,
                    sourceId: "markets.lostcity.rs",
                    sourceSlug: evaluation.sourceSlug,
                    valueObservedAt: evaluation.valueObservedAt,
                    evaluatedAt: new Date(snapshot.t * 1000).toISOString()
                  }
                : {
                    ...metadata[itemId],
                    refreshStatus: "retained",
                    evaluatedAt: new Date(snapshot.t * 1000).toISOString(),
                    reasonCode: evaluation.reasonCode
                  };
          }
          return {
            capturedAt: new Date(snapshot.t * 1000).toISOString(),
            sourcePriceSetId: `scheduled-market-${snapshot.t}`,
            label: "Scheduled market",
            itemPrices,
            itemPriceMetadata: metadata,
            itemPriceStatuses
          };
        })()
      )
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
      !!activePriceSet && !!latest && activePriceSetMatchesSnapshot(activePriceSet, latest)
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
          priceStatus: snapshot.itemPriceStatuses?.[normalizedItemId] ?? "local-capture",
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

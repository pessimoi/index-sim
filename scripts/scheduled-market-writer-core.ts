import { z } from "zod";
import {
  ItemPriceMetadataMapSchema,
  MARKET_SOURCE_ID,
  PRICE_SET_IMPORT_MAX_BYTES,
  PriceHistoryArtifactV2Schema,
  PriceMapSchema,
  ScheduledPriceProvenanceArtifactSchema,
  parsePriceHistory
} from "../src/data/schemas";
import { NonNegativeNumberSchema } from "../src/data/schemas/game-data";
import { DataReliabilityError, parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import type {
  ItemPriceMetadata,
  ItemPriceQuality,
  ItemPriceReasonCode,
  MarketSourceMapping
} from "../src/domain/shared";
import type {
  PriceHistoryArtifactV2,
  ScheduledPriceProvenanceArtifact,
  ValidatedPriceHistorySnapshot
} from "../src/data/schemas";

export const SCHEDULED_MARKET_HISTORY_BUCKET_SECONDS = 12 * 60 * 60;
export const SCHEDULED_MARKET_SAMPLE_SIZE = 5;
export const SCHEDULED_MARKET_FINE_HISTORY_RETENTION_SECONDS = 90 * 24 * 60 * 60;
export const SCHEDULED_MARKET_MAX_TRADE_AGE_SECONDS = 90 * 24 * 60 * 60;
export const SCHEDULED_MARKET_MAX_LATEST_TRADE_AGE_SECONDS = 30 * 24 * 60 * 60;
export const SCHEDULED_MARKET_FRESH_TRADE_AGE_SECONDS = 7 * 24 * 60 * 60;
export const SCHEDULED_MARKET_MAD_THRESHOLD = 3.5;
export const SCHEDULED_MARKET_MEDIAN_RATIO_LIMIT = 3;

export type ScheduledMarketWriterErrorCode =
  | "invalid_upstream"
  | "unknown_item"
  | "unknown_source_slug"
  | "duplicate_item"
  | "missing_item"
  | "output_validation_failed";

export class ScheduledMarketWriterError extends Error {
  readonly code: ScheduledMarketWriterErrorCode;
  readonly issues: string[];

  constructor(code: ScheduledMarketWriterErrorCode, message: string, issues: string[] = []) {
    super(message);
    this.name = "ScheduledMarketWriterError";
    this.code = code;
    this.issues = issues;
  }
}

const UpstreamItemSchema = z
  .object({
    itemId: z.string().min(1),
    sourceSlug: z.string().min(1),
    status: z.enum(["updated", "skipped"]).default("updated"),
    reason: z.string().min(1).optional(),
    price: NonNegativeNumberSchema.optional(),
    highAlch: NonNegativeNumberSchema.optional(),
    highalch: NonNegativeNumberSchema.optional(),
    high_alch: NonNegativeNumberSchema.optional(),
    alch: NonNegativeNumberSchema.optional(),
    item: z
      .object({
        price: NonNegativeNumberSchema.optional(),
        highAlch: NonNegativeNumberSchema.optional(),
        highalch: NonNegativeNumberSchema.optional(),
        high_alch: NonNegativeNumberSchema.optional(),
        alch: NonNegativeNumberSchema.optional()
      })
      .strict()
      .optional(),
    history: z
      .array(
        z
          .object({
            price: NonNegativeNumberSchema,
            quantity: z.number().int().positive().optional(),
            type: z.enum(["buy", "sell"]).optional(),
            soldAt: z
              .string()
              .min(1)
              .refine((value) => Number.isFinite(Date.parse(value)), "Invalid sold timestamp")
              .optional()
          })
          .strict()
      )
      .optional()
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.status === "skipped" && !item.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "skipped upstream item requires reason"
      });
    }
  });

const UpstreamResponseSchema = z
  .object({
    source: z.literal(MARKET_SOURCE_ID).optional(),
    fetchedAt: z.string().min(1).optional(),
    items: z.array(UpstreamItemSchema).min(1)
  })
  .strict();

export type ScheduledMarketUpstreamItem = z.infer<typeof UpstreamItemSchema>;
export type ScheduledMarketUpstreamResponse = z.infer<typeof UpstreamResponseSchema>;
export type ScheduledMarketPriceQuality = "high" | "medium" | "low" | "retained";

export interface ScheduledMarketWriterReportItem {
  itemId: string;
  sourceSlug: string;
  status: "updated" | "skipped";
  price?: number;
  quality: ScheduledMarketPriceQuality;
  sourceObservations: number;
  observations: number;
  acceptedObservations: number;
  rejectedObservations: number;
  latestTradeAt?: string;
  reason?: string;
}

export interface ScheduledMarketWriterReport {
  source: typeof MARKET_SOURCE_ID;
  capturedAt: string;
  requested: number;
  updated: number;
  skipped: number;
  items: ScheduledMarketWriterReportItem[];
}

export interface ScheduledMarketSnapshotOutputs {
  prices: Record<string, number>;
  priceProvenance: ScheduledPriceProvenanceArtifact;
  priceHistory: PriceHistoryArtifactV2;
  pricesText: string;
  priceProvenanceText: string;
  priceHistoryText: string;
  report: ScheduledMarketWriterReport;
}

export interface CreateScheduledMarketSnapshotOutputInput {
  upstream: ScheduledMarketUpstreamResponse;
  previousPrices: unknown;
  previousPriceProvenance?: unknown;
  previousPriceHistory: unknown;
  mappings: readonly MarketSourceMapping[];
  capturedAt?: Date;
  sampleSize?: number;
}

function formatZodIssue(issue: { path: PropertyKey[]; message: string }): string {
  const path = issue.path.length ? issue.path.map(String).join(".") : "<root>";
  return `${path}: ${issue.message}`;
}

function parseUpstreamWithSchema(input: unknown): ScheduledMarketUpstreamResponse {
  const result = UpstreamResponseSchema.safeParse(input);
  if (!result.success) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Scheduled market upstream response failed schema validation",
      result.error.issues.map(formatZodIssue)
    );
  }
  return result.data;
}

export function parseScheduledMarketUpstreamResponse(
  input: unknown
): ScheduledMarketUpstreamResponse {
  return parseUpstreamWithSchema(input);
}

export function parseScheduledMarketUpstreamResponseJson(
  jsonText: string,
  options: { maxBytes?: number } = {}
): ScheduledMarketUpstreamResponse {
  try {
    return parseUpstreamWithSchema(
      parseJsonWithDuplicateKeyCheck(jsonText, {
        maxBytes: options.maxBytes ?? PRICE_SET_IMPORT_MAX_BYTES,
        source: "scheduled market upstream response"
      })
    );
  } catch (error) {
    if (error instanceof ScheduledMarketWriterError) throw error;
    if (error instanceof DataReliabilityError) {
      throw new ScheduledMarketWriterError(
        "invalid_upstream",
        "Scheduled market upstream response is not valid JSON",
        error.issues
      );
    }
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Scheduled market upstream response is invalid"
    );
  }
}

function parseRawPriceRecord(input: unknown, label: string): Record<string, number> {
  const result = z.record(z.string().min(1), NonNegativeNumberSchema).safeParse(input);
  if (!result.success) {
    throw new ScheduledMarketWriterError(
      "output_validation_failed",
      `${label} failed schema validation`,
      result.error.issues.map(formatZodIssue)
    );
  }
  return result.data;
}

function sortedNumericRecord(input: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  );
}

function sortedRecord<T>(input: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  );
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function unixSeconds(date: Date): number {
  const seconds = Math.floor(date.getTime() / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Scheduled market capture time is invalid"
    );
  }
  return seconds;
}

function historyBucket(timestampSeconds: number): number {
  return Math.floor(timestampSeconds / SCHEDULED_MARKET_HISTORY_BUCKET_SECONDS);
}

function dayBucket(timestampSeconds: number): number {
  return Math.floor(timestampSeconds / (24 * 60 * 60));
}

function priceWithoutMetadata(prices: Record<string, number>): Record<string, number> {
  return PriceMapSchema.parse(
    Object.fromEntries(Object.entries(prices).filter(([key]) => !key.startsWith("_")))
  );
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function withinMedianRatio(price: number, medianPrice: number): boolean {
  if (medianPrice <= 0) return price === medianPrice;
  return (
    price >= medianPrice / SCHEDULED_MARKET_MEDIAN_RATIO_LIMIT &&
    price <= medianPrice * SCHEDULED_MARKET_MEDIAN_RATIO_LIMIT
  );
}

interface MarketTradeObservation {
  price: number;
  soldAtMs: number;
}

export interface ScheduledMarketPriceEstimate {
  status: "updated" | "retained";
  price?: number;
  quality: ScheduledMarketPriceQuality;
  sourceObservations: number;
  observations: number;
  acceptedObservations: number;
  rejectedObservations: number;
  latestTradeAt?: string;
  reasonCode?: ItemPriceReasonCode;
  reason?: string;
}

function acceptedOutlierFilteredTrades(
  trades: readonly MarketTradeObservation[]
): MarketTradeObservation[] {
  const medianPrice = median(trades.map((trade) => trade.price));
  if (trades.length <= 4) {
    return trades.filter((trade) => withinMedianRatio(trade.price, medianPrice));
  }

  const absoluteDeviations = trades.map((trade) => Math.abs(trade.price - medianPrice));
  const mad = median(absoluteDeviations);
  if (mad === 0) {
    return trades.filter((trade) => withinMedianRatio(trade.price, medianPrice));
  }
  return trades.filter(
    (trade) =>
      (0.6745 * Math.abs(trade.price - medianPrice)) / mad <= SCHEDULED_MARKET_MAD_THRESHOLD
  );
}

function estimateQuality(
  acceptedCount: number,
  latestAgeSeconds: number
): ScheduledMarketPriceQuality {
  if (acceptedCount >= 10 && latestAgeSeconds <= SCHEDULED_MARKET_FRESH_TRADE_AGE_SECONDS) {
    return "high";
  }
  if (acceptedCount >= 5) return "medium";
  return "low";
}

export function estimateScheduledMarketPrice(input: {
  item: ScheduledMarketUpstreamItem;
  capturedAt: Date;
  sampleSize?: number;
}): ScheduledMarketPriceEstimate {
  const capturedAtMs = input.capturedAt.getTime();
  const oldestAcceptedMs = capturedAtMs - SCHEDULED_MARKET_MAX_TRADE_AGE_SECONDS * 1000;
  const latestAcceptedMs = capturedAtMs + 5 * 60 * 1000;
  const fallbackTimestampMs = capturedAtMs;
  const history = input.item.history ?? [];
  const directPrice = input.item.price ?? input.item.item?.price;
  const candidates = history.length
    ? history
    : directPrice === undefined
      ? []
      : [{ price: directPrice }];
  const trades = candidates
    .map((trade, index): MarketTradeObservation | null => {
      if (trade.price <= 0) return null;
      const soldAtMs = trade.soldAt ? Date.parse(trade.soldAt) : fallbackTimestampMs - index;
      if (
        !Number.isFinite(soldAtMs) ||
        soldAtMs < oldestAcceptedMs ||
        soldAtMs > latestAcceptedMs
      ) {
        return null;
      }
      return { price: trade.price, soldAtMs };
    })
    .filter((trade): trade is MarketTradeObservation => trade !== null)
    .sort((left, right) => right.soldAtMs - left.soldAtMs);

  if (trades.length < 3) {
    return {
      status: "retained",
      quality: "retained",
      sourceObservations: candidates.length,
      observations: trades.length,
      acceptedObservations: trades.length,
      rejectedObservations: candidates.length - trades.length,
      reasonCode: "insufficient-observations",
      reason: "Fewer than 3 usable completed trades"
    };
  }

  const accepted = acceptedOutlierFilteredTrades(trades);
  const latestTrade = accepted[0];
  if (accepted.length < 3 || !latestTrade) {
    return {
      status: "retained",
      quality: "retained",
      sourceObservations: candidates.length,
      observations: trades.length,
      acceptedObservations: accepted.length,
      rejectedObservations: candidates.length - accepted.length,
      reasonCode: "outlier-filter-insufficient",
      reason: "Fewer than 3 trades remained after outlier filtering"
    };
  }

  const latestAgeSeconds = Math.max(0, Math.floor((capturedAtMs - latestTrade.soldAtMs) / 1000));
  const latestTradeAt = new Date(latestTrade.soldAtMs).toISOString();
  if (latestAgeSeconds > SCHEDULED_MARKET_MAX_LATEST_TRADE_AGE_SECONDS) {
    return {
      status: "retained",
      quality: "retained",
      sourceObservations: candidates.length,
      observations: trades.length,
      acceptedObservations: accepted.length,
      rejectedObservations: candidates.length - accepted.length,
      latestTradeAt,
      reasonCode: "latest-observation-too-old",
      reason: "Latest usable completed trade is older than 30 days"
    };
  }

  const priceSamples = accepted.slice(0, input.sampleSize ?? SCHEDULED_MARKET_SAMPLE_SIZE);
  return {
    status: "updated",
    price: Math.round(
      priceSamples.reduce((sum, trade) => sum + trade.price, 0) / priceSamples.length
    ),
    quality: estimateQuality(accepted.length, latestAgeSeconds),
    sourceObservations: candidates.length,
    observations: trades.length,
    acceptedObservations: accepted.length,
    rejectedObservations: candidates.length - accepted.length,
    latestTradeAt
  };
}

function requiredMappings(mappings: readonly MarketSourceMapping[]): MarketSourceMapping[] {
  return mappings.filter((mapping) => mapping.syncPrice);
}

function buildUpstreamItemMap(
  upstream: ScheduledMarketUpstreamResponse,
  mappings: readonly MarketSourceMapping[]
): Map<string, ScheduledMarketUpstreamItem> {
  const mappingsByItemId = new Map(mappings.map((mapping) => [mapping.itemId, mapping]));
  const items = new Map<string, ScheduledMarketUpstreamItem>();

  for (const item of upstream.items) {
    const mapping = mappingsByItemId.get(item.itemId);
    if (!mapping) {
      throw new ScheduledMarketWriterError(
        "unknown_item",
        "Scheduled market upstream response contains an item outside the approved mapping",
        [`itemId: ${item.itemId}`]
      );
    }
    if (mapping.sourceSlug !== item.sourceSlug) {
      throw new ScheduledMarketWriterError(
        "unknown_source_slug",
        "Scheduled market upstream response contains a source slug outside the approved mapping",
        [`itemId: ${item.itemId}`]
      );
    }
    if (items.has(item.itemId)) {
      throw new ScheduledMarketWriterError(
        "duplicate_item",
        "Scheduled market upstream response contains a duplicate item",
        [`itemId: ${item.itemId}`]
      );
    }
    items.set(item.itemId, item);
  }

  return items;
}

function retainedReason(reason: string | undefined, hasPreviousValue: boolean): string {
  const base = reason ?? "No usable completed trade price";
  return hasPreviousValue ? base : `${base}; no previous market price`;
}

function initialPriceMetadata(
  prices: Record<string, number>,
  mappings: readonly MarketSourceMapping[]
): Record<string, ItemPriceMetadata> {
  const mappingsByItemId = new Map(mappings.map((mapping) => [mapping.itemId, mapping]));
  return Object.fromEntries(
    Object.keys(priceWithoutMetadata(prices))
      .sort()
      .map((itemId) => {
        const mapping = mappingsByItemId.get(itemId);
        return [
          itemId,
          {
            valueOrigin: "legacy-static",
            refreshStatus: "not-evaluated",
            quality: "unknown",
            ...(mapping
              ? {
                  sourceId: MARKET_SOURCE_ID,
                  sourceSlug: mapping.sourceSlug,
                  reasonCode: "legacy-metadata-unavailable" as const
                }
              : { reasonCode: "outside-market-allowlist" as const })
          } satisfies ItemPriceMetadata
        ];
      })
  );
}

function parsePreviousPriceProvenance(input: {
  value: unknown;
  prices: Record<string, number>;
  mappings: readonly MarketSourceMapping[];
}): Record<string, ItemPriceMetadata> {
  if (input.value === undefined || input.value === null) {
    return initialPriceMetadata(input.prices, input.mappings);
  }

  const parsed = ScheduledPriceProvenanceArtifactSchema.safeParse(input.value);
  if (!parsed.success) {
    throw new ScheduledMarketWriterError(
      "output_validation_failed",
      "price-provenance.json failed schema validation",
      parsed.error.issues.map(formatZodIssue)
    );
  }
  const priceKeys = Object.keys(priceWithoutMetadata(input.prices)).sort();
  const metadataKeys = Object.keys(parsed.data.items).sort();
  const previousCapturedAt = input.prices._scraped_at;
  const expectedCapturedAt =
    typeof previousCapturedAt === "number" && previousCapturedAt > 0
      ? new Date(previousCapturedAt * 1000).toISOString()
      : null;
  if (
    JSON.stringify(priceKeys) !== JSON.stringify(metadataKeys) ||
    expectedCapturedAt === null ||
    parsed.data.capturedAt !== expectedCapturedAt
  ) {
    throw new ScheduledMarketWriterError(
      "output_validation_failed",
      "price-provenance.json does not match prices.json"
    );
  }
  return parsed.data.items as Record<string, ItemPriceMetadata>;
}

export function buildScheduledPriceHistory(input: {
  existingHistory: PriceHistoryArtifactV2;
  currentPrices: Record<string, number>;
  capturedAtSeconds: number;
  evaluations: ValidatedPriceHistorySnapshot["evaluations"];
}): PriceHistoryArtifactV2 {
  const snapshotsByBucket = new Map<number, ValidatedPriceHistorySnapshot>();

  for (const snapshot of input.existingHistory.snapshots) {
    snapshotsByBucket.set(historyBucket(snapshot.t), {
      ...snapshot,
      prices: sortedNumericRecord(snapshot.prices),
      evaluations: sortedRecord(snapshot.evaluations)
    });
  }

  snapshotsByBucket.set(historyBucket(input.capturedAtSeconds), {
    t: input.capturedAtSeconds,
    kind: "writer-evaluated",
    prices: sortedNumericRecord(priceWithoutMetadata(input.currentPrices)),
    evaluations: sortedRecord(input.evaluations)
  });

  const fineRetentionCutoff =
    input.capturedAtSeconds - SCHEDULED_MARKET_FINE_HISTORY_RETENTION_SECONDS;
  const fineSnapshots: ValidatedPriceHistorySnapshot[] = [];
  const olderSnapshotsByDay = new Map<number, ValidatedPriceHistorySnapshot>();

  for (const snapshot of [...snapshotsByBucket.values()].sort((left, right) => left.t - right.t)) {
    if (snapshot.t >= fineRetentionCutoff) {
      fineSnapshots.push(snapshot);
      continue;
    }
    const bucket = dayBucket(snapshot.t);
    const current = olderSnapshotsByDay.get(bucket);
    if (!current || snapshot.t > current.t) olderSnapshotsByDay.set(bucket, snapshot);
  }

  return {
    version: 2,
    snapshots: [...olderSnapshotsByDay.values(), ...fineSnapshots].sort(
      (left, right) => left.t - right.t
    )
  };
}

function validateOutputs(input: {
  prices: Record<string, number>;
  priceProvenance: ScheduledPriceProvenanceArtifact;
  priceHistory: PriceHistoryArtifactV2;
}): void {
  try {
    PriceMapSchema.parse(input.prices);
    ScheduledPriceProvenanceArtifactSchema.parse(input.priceProvenance);
    PriceHistoryArtifactV2Schema.parse(input.priceHistory);
    const priceKeys = Object.keys(priceWithoutMetadata(input.prices)).sort();
    const metadataKeys = Object.keys(input.priceProvenance.items).sort();
    if (JSON.stringify(priceKeys) !== JSON.stringify(metadataKeys)) throw new Error("key mismatch");
  } catch {
    throw new ScheduledMarketWriterError(
      "output_validation_failed",
      "Scheduled market writer generated invalid output"
    );
  }
}

export function createScheduledMarketSnapshotOutputs(
  input: CreateScheduledMarketSnapshotOutputInput
): ScheduledMarketSnapshotOutputs {
  const upstream = parseScheduledMarketUpstreamResponse(input.upstream);
  const previousPrices = parseRawPriceRecord(input.previousPrices, "prices.json");
  const previousPriceHistory = parsePriceHistory(input.previousPriceHistory);
  const mappings = requiredMappings(input.mappings);
  const previousMetadata = parsePreviousPriceProvenance({
    value: input.previousPriceProvenance,
    prices: previousPrices,
    mappings
  });
  const upstreamItems = buildUpstreamItemMap(upstream, mappings);
  const capturedAt =
    input.capturedAt ?? (upstream.fetchedAt ? new Date(upstream.fetchedAt) : new Date());
  const capturedAtSeconds = unixSeconds(capturedAt);
  const capturedAtIso = new Date(capturedAtSeconds * 1000).toISOString();
  const sampleSize = input.sampleSize ?? SCHEDULED_MARKET_SAMPLE_SIZE;

  const prices: Record<string, number> = {
    ...previousPrices,
    _scraped_at: capturedAtSeconds
  };
  const reportItems: ScheduledMarketWriterReportItem[] = [];
  const itemMetadata: Record<string, ItemPriceMetadata> = { ...previousMetadata };
  const historyEvaluations: ValidatedPriceHistorySnapshot["evaluations"] = {};

  for (const mapping of mappings) {
    const upstreamItem = upstreamItems.get(mapping.itemId);
    if (!upstreamItem) {
      throw new ScheduledMarketWriterError(
        "missing_item",
        "Scheduled market upstream response is missing an approved mapping item",
        [`itemId: ${mapping.itemId}`]
      );
    }

    if (upstreamItem.status === "skipped") {
      const hasPreviousValue = prices[mapping.itemId] !== undefined;
      reportItems.push({
        itemId: mapping.itemId,
        sourceSlug: mapping.sourceSlug,
        status: "skipped",
        quality: "retained",
        sourceObservations: 0,
        observations: 0,
        acceptedObservations: 0,
        rejectedObservations: 0,
        reason: retainedReason(upstreamItem.reason, hasPreviousValue)
      });
      if (hasPreviousValue) {
        itemMetadata[mapping.itemId] = {
          ...itemMetadata[mapping.itemId],
          refreshStatus: "retained",
          sourceId: MARKET_SOURCE_ID,
          sourceSlug: mapping.sourceSlug,
          evaluatedAt: capturedAtIso,
          sourceObservations: 0,
          usableObservations: 0,
          acceptedObservations: 0,
          rejectedObservations: 0,
          reasonCode: "source-item-unavailable"
        };
      }
      historyEvaluations[mapping.itemId] = {
        result: "retained",
        reasonCode: "source-item-unavailable"
      };
      continue;
    }

    const estimate = estimateScheduledMarketPrice({
      item: upstreamItem,
      capturedAt,
      sampleSize
    });
    if (estimate.status === "retained") {
      const hasPreviousValue = prices[mapping.itemId] !== undefined;
      reportItems.push({
        itemId: mapping.itemId,
        sourceSlug: mapping.sourceSlug,
        status: "skipped",
        quality: estimate.quality,
        sourceObservations: estimate.sourceObservations,
        observations: estimate.observations,
        acceptedObservations: estimate.acceptedObservations,
        rejectedObservations: estimate.rejectedObservations,
        latestTradeAt: estimate.latestTradeAt,
        reason: retainedReason(estimate.reason, hasPreviousValue)
      });
      const reasonCode = estimate.reasonCode ?? "insufficient-observations";
      if (hasPreviousValue) {
        itemMetadata[mapping.itemId] = {
          ...itemMetadata[mapping.itemId],
          refreshStatus: "retained",
          sourceId: MARKET_SOURCE_ID,
          sourceSlug: mapping.sourceSlug,
          evaluatedAt: capturedAtIso,
          ...(estimate.latestTradeAt ? { latestCandidateAt: estimate.latestTradeAt } : {}),
          sourceObservations: estimate.sourceObservations,
          usableObservations: estimate.observations,
          acceptedObservations: estimate.acceptedObservations,
          rejectedObservations: estimate.rejectedObservations,
          reasonCode
        };
      }
      historyEvaluations[mapping.itemId] = { result: "retained", reasonCode };
      continue;
    }
    prices[mapping.itemId] = estimate.price as number;

    reportItems.push({
      itemId: mapping.itemId,
      sourceSlug: mapping.sourceSlug,
      status: "updated",
      price: estimate.price,
      quality: estimate.quality,
      sourceObservations: estimate.sourceObservations,
      observations: estimate.observations,
      acceptedObservations: estimate.acceptedObservations,
      rejectedObservations: estimate.rejectedObservations,
      latestTradeAt: estimate.latestTradeAt
    });
    itemMetadata[mapping.itemId] = {
      valueOrigin: "market-observation",
      refreshStatus: "observed",
      quality: estimate.quality as Exclude<ItemPriceQuality, "fallback" | "unknown">,
      sourceId: MARKET_SOURCE_ID,
      sourceSlug: mapping.sourceSlug,
      valueObservedAt: estimate.latestTradeAt as string,
      evaluatedAt: capturedAtIso,
      sourceObservations: estimate.sourceObservations,
      usableObservations: estimate.observations,
      acceptedObservations: estimate.acceptedObservations,
      rejectedObservations: estimate.rejectedObservations
    };
    historyEvaluations[mapping.itemId] = {
      result: "observed",
      sourceSlug: mapping.sourceSlug,
      valueObservedAt: estimate.latestTradeAt as string,
      quality: estimate.quality as "high" | "medium" | "low"
    };
  }

  const sortedPrices = sortedNumericRecord(prices);
  const priceProvenance = ScheduledPriceProvenanceArtifactSchema.parse({
    version: 1,
    capturedAt: capturedAtIso,
    refreshSource: MARKET_SOURCE_ID,
    items: ItemPriceMetadataMapSchema.parse(sortedRecord(itemMetadata))
  });
  const priceHistory = buildScheduledPriceHistory({
    existingHistory: previousPriceHistory,
    currentPrices: sortedPrices,
    capturedAtSeconds,
    evaluations: historyEvaluations
  });

  validateOutputs({
    prices: sortedPrices,
    priceProvenance,
    priceHistory
  });

  const skipped = reportItems.filter((item) => item.status === "skipped").length;
  const updated = reportItems.length - skipped;
  if (updated === 0) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Scheduled market writer produced no updated item prices",
      [`requested: ${reportItems.length}`]
    );
  }

  return {
    prices: sortedPrices,
    priceProvenance,
    priceHistory,
    pricesText: stableJson(sortedPrices),
    priceProvenanceText: stableJson(priceProvenance),
    priceHistoryText: stableJson(priceHistory),
    report: {
      source: MARKET_SOURCE_ID,
      capturedAt: capturedAtIso,
      requested: reportItems.length,
      updated,
      skipped,
      items: reportItems
    }
  };
}

import { z } from "zod";
import {
  MARKET_SOURCE_ID,
  PRICE_SET_IMPORT_MAX_BYTES,
  PriceHistorySchema,
  PriceMapSchema,
  createPriceSetFromLegacyRecords,
  parsePriceHistory
} from "../src/data/schemas";
import { NonNegativeNumberSchema } from "../src/data/schemas/game-data";
import { DataReliabilityError, parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import type { MarketSourceMapping } from "../src/domain/shared";

export const SCHEDULED_MARKET_HISTORY_BUCKET_SECONDS = 12 * 60 * 60;
export const SCHEDULED_MARKET_SAMPLE_SIZE = 5;

export type ScheduledMarketWriterErrorCode =
  | "invalid_upstream"
  | "unknown_item"
  | "unknown_source_slug"
  | "duplicate_item"
  | "missing_item"
  | "missing_previous_value"
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
            price: NonNegativeNumberSchema
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

export interface ScheduledMarketWriterReportItem {
  itemId: string;
  sourceSlug: string;
  status: "updated" | "skipped";
  price?: number;
  alchValue?: number;
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
  alchValues: Record<string, number>;
  priceHistory: Array<{ t: number; prices: Record<string, number> }>;
  pricesText: string;
  alchText: string;
  priceHistoryText: string;
  report: ScheduledMarketWriterReport;
}

export interface CreateScheduledMarketSnapshotOutputInput {
  upstream: ScheduledMarketUpstreamResponse;
  previousPrices: unknown;
  previousAlchValues: unknown;
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

function priceWithoutMetadata(prices: Record<string, number>): Record<string, number> {
  return PriceMapSchema.parse(
    Object.fromEntries(Object.entries(prices).filter(([key]) => !key.startsWith("_")))
  );
}

function highAlchFromItem(item: ScheduledMarketUpstreamItem): number | undefined {
  return (
    item.highAlch ??
    item.highalch ??
    item.high_alch ??
    item.alch ??
    item.item?.highAlch ??
    item.item?.highalch ??
    item.item?.high_alch ??
    item.item?.alch
  );
}

function averageRecentPrice(
  item: ScheduledMarketUpstreamItem,
  sampleSize: number
): number | undefined {
  const historyPrices = (item.history ?? []).slice(0, sampleSize).map((entry) => entry.price);
  const samples = historyPrices.length
    ? historyPrices
    : item.price !== undefined
      ? [item.price]
      : item.item?.price !== undefined
        ? [item.item.price]
        : [];
  if (!samples.length) return undefined;
  return Math.round(samples.reduce((sum, price) => sum + price, 0) / samples.length);
}

function requiredMappings(mappings: readonly MarketSourceMapping[]): MarketSourceMapping[] {
  return mappings.filter((mapping) => mapping.syncPrice || mapping.syncAlch);
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

function existingValue(record: Record<string, number>, itemId: string, outputName: string): number {
  const value = record[itemId];
  if (value !== undefined) return value;
  throw new ScheduledMarketWriterError(
    "missing_previous_value",
    "Skipped scheduled market item has no previous output value",
    [`${outputName}: ${itemId}`]
  );
}

function buildPriceHistory(input: {
  existingHistory: Array<{ t: number; prices: Record<string, number> }>;
  currentPrices: Record<string, number>;
  capturedAtSeconds: number;
}): Array<{ t: number; prices: Record<string, number> }> {
  const snapshotsByBucket = new Map<number, { t: number; prices: Record<string, number> }>();

  for (const snapshot of input.existingHistory) {
    snapshotsByBucket.set(historyBucket(snapshot.t), {
      t: snapshot.t,
      prices: sortedNumericRecord(snapshot.prices)
    });
  }

  snapshotsByBucket.set(historyBucket(input.capturedAtSeconds), {
    t: input.capturedAtSeconds,
    prices: sortedNumericRecord(priceWithoutMetadata(input.currentPrices))
  });

  return [...snapshotsByBucket.values()].sort((left, right) => left.t - right.t);
}

function validateOutputs(input: {
  prices: Record<string, number>;
  alchValues: Record<string, number>;
  priceHistory: Array<{ t: number; prices: Record<string, number> }>;
  capturedAt: string;
}): void {
  try {
    createPriceSetFromLegacyRecords({
      id: "scheduled-market-writer-validation",
      label: "Scheduled market writer validation",
      source: "scraped",
      createdAt: input.capturedAt,
      itemPrices: input.prices,
      alchValues: input.alchValues
    });
    PriceHistorySchema.parse(input.priceHistory);
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
  const previousAlchValues = parseRawPriceRecord(input.previousAlchValues, "alch.json");
  const previousPriceHistory = parsePriceHistory(input.previousPriceHistory);
  const mappings = requiredMappings(input.mappings);
  const upstreamItems = buildUpstreamItemMap(upstream, mappings);
  const capturedAt =
    input.capturedAt ?? (upstream.fetchedAt ? new Date(upstream.fetchedAt) : new Date());
  const capturedAtSeconds = unixSeconds(capturedAt);
  const sampleSize = input.sampleSize ?? SCHEDULED_MARKET_SAMPLE_SIZE;

  const prices: Record<string, number> = {
    ...previousPrices,
    _scraped_at: capturedAtSeconds
  };
  const alchValues: Record<string, number> = { ...previousAlchValues };
  const reportItems: ScheduledMarketWriterReportItem[] = [];

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
      if (mapping.syncPrice) existingValue(prices, mapping.itemId, "prices.json");
      if (mapping.syncAlch) existingValue(alchValues, mapping.itemId, "alch.json");
      reportItems.push({
        itemId: mapping.itemId,
        sourceSlug: mapping.sourceSlug,
        status: "skipped",
        reason: upstreamItem.reason
      });
      continue;
    }

    const price = averageRecentPrice(upstreamItem, sampleSize);
    const alch = highAlchFromItem(upstreamItem);

    if (mapping.syncPrice) {
      if (price === undefined) {
        throw new ScheduledMarketWriterError(
          "invalid_upstream",
          "Updated scheduled market item is missing price data",
          [`itemId: ${mapping.itemId}`]
        );
      }
      prices[mapping.itemId] = price;
    }

    if (mapping.syncAlch) {
      if (alch === undefined) {
        throw new ScheduledMarketWriterError(
          "invalid_upstream",
          "Updated scheduled market item is missing high-alch data",
          [`itemId: ${mapping.itemId}`]
        );
      }
      alchValues[mapping.itemId] = alch;
    }

    reportItems.push({
      itemId: mapping.itemId,
      sourceSlug: mapping.sourceSlug,
      status: "updated",
      price: mapping.syncPrice ? price : undefined,
      alchValue: mapping.syncAlch ? alch : undefined
    });
  }

  const sortedPrices = sortedNumericRecord(prices);
  const sortedAlchValues = sortedNumericRecord(alchValues);
  const priceHistory = buildPriceHistory({
    existingHistory: previousPriceHistory,
    currentPrices: sortedPrices,
    capturedAtSeconds
  });
  const capturedAtIso = new Date(capturedAtSeconds * 1000).toISOString();

  validateOutputs({
    prices: sortedPrices,
    alchValues: sortedAlchValues,
    priceHistory,
    capturedAt: capturedAtIso
  });

  const skipped = reportItems.filter((item) => item.status === "skipped").length;
  const updated = reportItems.length - skipped;

  return {
    prices: sortedPrices,
    alchValues: sortedAlchValues,
    priceHistory,
    pricesText: stableJson(sortedPrices),
    alchText: stableJson(sortedAlchValues),
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

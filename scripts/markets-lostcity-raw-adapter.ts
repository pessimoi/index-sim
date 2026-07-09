import { z } from "zod";
import { MARKET_SOURCE_ID, PRICE_SET_IMPORT_MAX_BYTES } from "../src/data/schemas";
import { NonNegativeNumberSchema } from "../src/data/schemas/game-data";
import { DataReliabilityError, parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import type { MarketSourceMapping } from "../src/domain/shared";
import {
  ScheduledMarketWriterError,
  type ScheduledMarketUpstreamItem,
  type ScheduledMarketUpstreamResponse
} from "./scheduled-market-writer-core";

type RawMarketItemEntry = {
  key?: string;
  value: unknown;
  path: PropertyKey[];
};

const RawPriceHolderSchema = z
  .object({
    price: NonNegativeNumberSchema.optional(),
    value: NonNegativeNumberSchema.optional(),
    gold: NonNegativeNumberSchema.optional(),
    lastSale: NonNegativeNumberSchema.optional(),
    highAlch: NonNegativeNumberSchema.optional(),
    highalch: NonNegativeNumberSchema.optional(),
    high_alch: NonNegativeNumberSchema.optional(),
    alchhigh: NonNegativeNumberSchema.optional(),
    alch: NonNegativeNumberSchema.optional(),
    alchemy: NonNegativeNumberSchema.optional(),
    highalchemy: NonNegativeNumberSchema.optional()
  })
  .passthrough();

const RawHistoryEntrySchema = z.union([NonNegativeNumberSchema, RawPriceHolderSchema]);

const RawMarketItemSchema = RawPriceHolderSchema.extend({
  itemId: z.string().min(1).optional(),
  sourceSlug: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  status: z.enum(["updated", "skipped"]).default("updated"),
  reason: z.string().min(1).optional(),
  item: RawPriceHolderSchema.optional(),
  history: z.array(RawHistoryEntrySchema).optional(),
  recentSales: z.array(RawHistoryEntrySchema).optional(),
  trades: z.array(RawHistoryEntrySchema).optional(),
  sales: z.array(RawHistoryEntrySchema).optional()
})
  .passthrough()
  .superRefine((item, ctx) => {
    if (item.status === "skipped" && !item.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "skipped raw market item requires reason"
      });
    }
  });

type RawPriceHolder = z.infer<typeof RawPriceHolderSchema>;
type RawHistoryEntry = z.infer<typeof RawHistoryEntrySchema>;
type RawMarketItem = z.infer<typeof RawMarketItemSchema>;

function formatZodIssue(issue: { path: PropertyKey[]; message: string }): string {
  const path = issue.path.length ? issue.path.map(String).join(".") : "<root>";
  return `${path}: ${issue.message}`;
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.length ? path.map(String).join(".") : "<root>";
}

function assertObjectRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

function extractRawEntries(input: unknown): RawMarketItemEntry[] {
  if (Array.isArray(input)) {
    return input.map((value, index) => ({ value, path: [index] }));
  }
  if (!assertObjectRecord(input)) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Raw markets.lostcity.rs response must be a JSON object or array"
    );
  }

  const container =
    input.items !== undefined
      ? { value: input.items, path: ["items"] }
      : input.data !== undefined
        ? { value: input.data, path: ["data"] }
        : input.results !== undefined
          ? { value: input.results, path: ["results"] }
          : { value: input, path: [] };

  if (Array.isArray(container.value)) {
    return container.value.map((value, index) => ({
      value,
      path: [...container.path, index]
    }));
  }
  if (!assertObjectRecord(container.value)) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Raw markets.lostcity.rs item container must be an object or array",
      [formatIssuePath(container.path)]
    );
  }

  const metadataKeys = new Set(["source", "fetchedAt"]);
  return Object.entries(container.value)
    .filter(([key]) => container.path.length > 0 || !metadataKeys.has(key))
    .map(([key, value]) => ({
      key,
      value,
      path: [...container.path, key]
    }));
}

function parseRawItem(entry: RawMarketItemEntry): RawMarketItem {
  const result = RawMarketItemSchema.safeParse(entry.value);
  if (!result.success) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Raw markets.lostcity.rs item failed schema validation",
      result.error.issues.map((issue) =>
        formatZodIssue({ path: [...entry.path, ...issue.path], message: issue.message })
      )
    );
  }
  return result.data;
}

function priceFromHolder(holder: RawPriceHolder | undefined): number | undefined {
  return holder?.price ?? holder?.value ?? holder?.gold ?? holder?.lastSale;
}

function highAlchFromHolder(holder: RawPriceHolder | undefined): number | undefined {
  return (
    holder?.highAlch ??
    holder?.highalch ??
    holder?.high_alch ??
    holder?.alchhigh ??
    holder?.alch ??
    holder?.alchemy ??
    holder?.highalchemy
  );
}

function priceFromHistoryEntry(entry: RawHistoryEntry): number | undefined {
  return typeof entry === "number" ? entry : priceFromHolder(entry);
}

function historyFromRawItem(item: RawMarketItem): Array<{ price: number }> | undefined {
  const history = item.history ?? item.recentSales ?? item.trades ?? item.sales;
  if (!history?.length) return undefined;
  return history
    .map((entry) => priceFromHistoryEntry(entry))
    .filter((price): price is number => price !== undefined)
    .map((price) => ({ price }));
}

function mappingForRawItem(input: {
  rawItem: RawMarketItem;
  entry: RawMarketItemEntry;
  mappingsByItemId: Map<string, MarketSourceMapping>;
  mappingsBySourceSlug: Map<string, MarketSourceMapping>;
}): MarketSourceMapping {
  const sourceSlug = input.rawItem.sourceSlug ?? input.rawItem.slug ?? input.entry.key;
  if (input.rawItem.itemId) {
    const mapping = input.mappingsByItemId.get(input.rawItem.itemId);
    if (!mapping) {
      throw new ScheduledMarketWriterError(
        "unknown_item",
        "Raw markets.lostcity.rs response contains an item outside the approved mapping",
        [`itemId: ${input.rawItem.itemId}`]
      );
    }
    if (sourceSlug && mapping.sourceSlug !== sourceSlug) {
      throw new ScheduledMarketWriterError(
        "unknown_source_slug",
        "Raw markets.lostcity.rs response contains a source slug outside the approved mapping",
        [`itemId: ${input.rawItem.itemId}`]
      );
    }
    return mapping;
  }

  if (!sourceSlug) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Raw markets.lostcity.rs item is missing source slug",
      [formatIssuePath(input.entry.path)]
    );
  }
  const mapping = input.mappingsBySourceSlug.get(sourceSlug);
  if (!mapping) {
    throw new ScheduledMarketWriterError(
      "unknown_source_slug",
      "Raw markets.lostcity.rs response contains a source slug outside the approved mapping",
      [`sourceSlug: ${sourceSlug}`]
    );
  }
  return mapping;
}

function fetchedAtFromRawResponse(input: unknown): string | undefined {
  if (!assertObjectRecord(input) || input.fetchedAt === undefined) return undefined;
  if (typeof input.fetchedAt !== "string" || !input.fetchedAt.trim()) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Raw markets.lostcity.rs fetchedAt value is invalid",
      ["fetchedAt"]
    );
  }
  return input.fetchedAt;
}

function assertAcceptedSource(input: unknown): void {
  if (!assertObjectRecord(input) || input.source === undefined) return;
  if (input.source !== MARKET_SOURCE_ID) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Raw markets.lostcity.rs source value is invalid",
      ["source"]
    );
  }
}

export function normalizeMarketsLostcityRawResponse(
  input: unknown,
  mappings: readonly MarketSourceMapping[]
): ScheduledMarketUpstreamResponse {
  assertAcceptedSource(input);
  const mappingsByItemId = new Map(mappings.map((mapping) => [mapping.itemId, mapping]));
  const mappingsBySourceSlug = new Map(mappings.map((mapping) => [mapping.sourceSlug, mapping]));
  const entries = extractRawEntries(input);
  if (!entries.length) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Raw markets.lostcity.rs response did not contain item rows"
    );
  }

  const itemsByItemId = new Map<string, ScheduledMarketUpstreamItem>();
  for (const entry of entries) {
    const rawItem = parseRawItem(entry);
    const mapping = mappingForRawItem({
      rawItem,
      entry,
      mappingsByItemId,
      mappingsBySourceSlug
    });
    if (itemsByItemId.has(mapping.itemId)) {
      throw new ScheduledMarketWriterError(
        "duplicate_item",
        "Raw markets.lostcity.rs response contains a duplicate item",
        [`itemId: ${mapping.itemId}`]
      );
    }

    const normalized: ScheduledMarketUpstreamItem = {
      itemId: mapping.itemId,
      sourceSlug: mapping.sourceSlug,
      status: rawItem.status
    };
    if (rawItem.reason) normalized.reason = rawItem.reason;

    const directPrice = priceFromHolder(rawItem) ?? priceFromHolder(rawItem.item);
    if (directPrice !== undefined) normalized.price = directPrice;
    const highAlch = highAlchFromHolder(rawItem.item) ?? highAlchFromHolder(rawItem);
    if (highAlch !== undefined) normalized.highAlch = highAlch;
    const history = historyFromRawItem(rawItem);
    if (history) normalized.history = history;

    itemsByItemId.set(mapping.itemId, normalized);
  }

  const fetchedAt = fetchedAtFromRawResponse(input);
  return {
    source: MARKET_SOURCE_ID,
    ...(fetchedAt ? { fetchedAt } : {}),
    items: [...itemsByItemId.values()]
  };
}

export function parseMarketsLostcityRawResponseJson(
  jsonText: string,
  options: {
    mappings: readonly MarketSourceMapping[];
    maxBytes?: number;
  }
): ScheduledMarketUpstreamResponse {
  try {
    const parsed = parseJsonWithDuplicateKeyCheck(jsonText, {
      maxBytes: options.maxBytes ?? PRICE_SET_IMPORT_MAX_BYTES,
      source: "markets.lostcity.rs raw response"
    });
    return normalizeMarketsLostcityRawResponse(parsed, options.mappings);
  } catch (error) {
    if (error instanceof ScheduledMarketWriterError) throw error;
    if (error instanceof DataReliabilityError) {
      throw new ScheduledMarketWriterError(
        "invalid_upstream",
        "Raw markets.lostcity.rs response is not valid JSON",
        error.issues
      );
    }
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Raw markets.lostcity.rs response is invalid"
    );
  }
}

import { z } from "zod";
import { parseJsonWithDuplicateKeyCheck } from "../reliability";
import type {
  HiscoresLookupRequest,
  HiscoresResponse,
  HiscoresStatusResponse,
  IntegrationErrorResponse,
  MarketSourceMapping,
  MarketSyncRequest,
  MarketSyncResponse,
  MarketStatusResponse,
  PriceSet
} from "../../domain/shared";
import { EntityIdSchema, NonNegativeNumberSchema } from "./game-data";
import { PriceSetSchema } from "./price-set";

export const LIVE_INTEGRATION_JSON_MAX_BYTES = 128_000;
export const HISCORES_PLAYER_MAX_CHARS = 32;
export const MARKET_SYNC_MAX_ITEMS = 200;
export const MARKET_SOURCE_ID = "markets.lostcity.rs";
export const MARKET_FIXTURE_SAMPLE_SIZE = 5;

export type LiveIntegrationValidationErrorCode =
  | "body_too_large"
  | "invalid_json"
  | "validation_failed"
  | "disallowed_market_items"
  | "item_count_exceeded";

export class LiveIntegrationValidationError extends Error {
  readonly code: LiveIntegrationValidationErrorCode;
  readonly issues: string[];

  constructor(code: LiveIntegrationValidationErrorCode, message: string, issues: string[] = []) {
    super(message);
    this.name = "LiveIntegrationValidationError";
    this.code = code;
    this.issues = issues;
  }
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function formatZodIssue(issue: { path: PropertyKey[]; message: string }): string {
  const path = issue.path.length ? issue.path.map(String).join(".") : "<root>";
  return `${path}: ${issue.message}`;
}

function parseJsonText(jsonText: string, maxBytes: number): unknown {
  if (byteLength(jsonText) > maxBytes) {
    throw new LiveIntegrationValidationError(
      "body_too_large",
      `Live integration payload exceeds ${maxBytes} bytes`
    );
  }

  try {
    return parseJsonWithDuplicateKeyCheck(jsonText, {
      maxBytes,
      source: "Live integration payload"
    });
  } catch {
    throw new LiveIntegrationValidationError(
      "invalid_json",
      "Live integration payload is not valid JSON"
    );
  }
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown, label: string): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new LiveIntegrationValidationError(
      "validation_failed",
      `${label} failed schema validation`,
      result.error.issues.map(formatZodIssue)
    );
  }
  return result.data;
}

const IntegrationTimestampSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid timestamp");

export function parseLiveIntegrationJson<T>(
  jsonText: string,
  schema: z.ZodType<T>,
  label: string,
  options: { maxBytes?: number } = {}
): T {
  const parsed = parseJsonText(jsonText, options.maxBytes ?? LIVE_INTEGRATION_JSON_MAX_BYTES);
  return parseWithSchema(schema, parsed, label);
}

export const HiscoresSkillSchema = z.enum([
  "attack",
  "strength",
  "defence",
  "hitpoints",
  "prayer",
  "ranged",
  "magic"
]);

export const IntegrationWarningSchema = z
  .object({
    code: z.string().min(1),
    severity: z.enum(["info", "warning", "error"]),
    message: z.string().min(1),
    itemId: EntityIdSchema.optional(),
    skill: HiscoresSkillSchema.optional()
  })
  .strict();

export const IntegrationErrorResponseSchema: z.ZodType<IntegrationErrorResponse> = z
  .object({
    error: z
      .object({
        code: z.enum([
          "bad-request",
          "not-found",
          "rate-limited",
          "upstream-unavailable",
          "upstream-invalid",
          "internal-error"
        ]),
        message: z.string().min(1),
        retryAfterSeconds: z.number().int().positive().optional()
      })
      .strict(),
    warnings: z.array(IntegrationWarningSchema).optional()
  })
  .strict();

export const HiscoresPlayerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(HISCORES_PLAYER_MAX_CHARS)
  .regex(/^[A-Za-z0-9 _-]+$/, "Player name contains unsupported characters");

export const HiscoresLookupRequestSchema: z.ZodType<HiscoresLookupRequest> = z
  .object({
    player: HiscoresPlayerNameSchema
  })
  .strict();

export const HiscoresSourceSchema = z
  .object({
    id: EntityIdSchema,
    label: z.string().min(1),
    url: z.string().url().optional()
  })
  .strict();

export const HiscoresStatusResponseSchema: z.ZodType<HiscoresStatusResponse> = z
  .object({
    available: z.boolean(),
    source: HiscoresSourceSchema,
    limits: z
      .object({
        requestsPerMinute: z.number().int().positive().optional()
      })
      .strict()
      .optional()
  })
  .strict();

export const HiscoresSkillValueSchema = z
  .object({
    level: z.number().int().min(1).max(99),
    xp: z.number().int().nonnegative().optional(),
    rank: z.number().int().nonnegative().optional()
  })
  .strict();

export const HiscoresSkillsSchema = z
  .object({
    attack: HiscoresSkillValueSchema.optional(),
    strength: HiscoresSkillValueSchema.optional(),
    defence: HiscoresSkillValueSchema.optional(),
    hitpoints: HiscoresSkillValueSchema.optional(),
    prayer: HiscoresSkillValueSchema.optional(),
    ranged: HiscoresSkillValueSchema.optional(),
    magic: HiscoresSkillValueSchema.optional()
  })
  .strict();

export const HiscoresResponseSchema: z.ZodType<HiscoresResponse> = z
  .object({
    player: HiscoresPlayerNameSchema,
    normalizedPlayer: HiscoresPlayerNameSchema,
    source: HiscoresSourceSchema,
    fetchedAt: IntegrationTimestampSchema,
    skills: HiscoresSkillsSchema,
    warnings: z.array(IntegrationWarningSchema)
  })
  .strict();

export const MarketSourceSchema = z
  .object({
    id: EntityIdSchema,
    label: z.string().min(1),
    origin: z.string().url().optional()
  })
  .strict();

export const MarketStatusResponseSchema: z.ZodType<MarketStatusResponse> = z
  .object({
    available: z.boolean(),
    source: MarketSourceSchema,
    cache: z
      .object({
        enabled: z.boolean(),
        ttlSeconds: z.number().int().positive().optional()
      })
      .strict()
      .optional(),
    limits: z
      .object({
        maxItemsPerRequest: z.number().int().positive(),
        requestsPerSecond: z.number().positive()
      })
      .strict()
  })
  .strict();

export const MarketSyncScopeSchema = z.enum(["monster", "all-supported", "items"]);

export const MarketSyncRequestSchema: z.ZodType<MarketSyncRequest> = z
  .object({
    scope: MarketSyncScopeSchema,
    monsterId: EntityIdSchema.optional(),
    itemIds: z.array(EntityIdSchema).optional(),
    includeAlch: z.boolean().optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scope === "monster" && !value.monsterId) {
      ctx.addIssue({
        code: "custom",
        path: ["monsterId"],
        message: "monster sync requires monsterId"
      });
    }
    if (value.scope === "items" && (!value.itemIds || value.itemIds.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["itemIds"],
        message: "items sync requires at least one itemId"
      });
    }
  });

export const MarketItemReportSchema = z
  .object({
    itemId: EntityIdSchema,
    sourceSlug: z.string().min(1).optional(),
    status: z.enum(["updated", "skipped", "failed"]),
    price: NonNegativeNumberSchema.optional(),
    alchValue: NonNegativeNumberSchema.optional(),
    sampleSize: z.number().int().nonnegative().optional(),
    reason: z.string().min(1).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "updated" && value.price === undefined && value.alchValue === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "updated market item report requires price or alchValue"
      });
    }
    if (value.status !== "updated" && !value.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "skipped or failed market item report requires reason"
      });
    }
  });

export const MarketSyncReportSchema = z
  .object({
    requested: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    startedAt: IntegrationTimestampSchema,
    finishedAt: IntegrationTimestampSchema,
    source: MarketSourceSchema,
    items: z.array(MarketItemReportSchema),
    warnings: z.array(IntegrationWarningSchema)
  })
  .strict()
  .superRefine((value, ctx) => {
    const total = value.updated + value.skipped + value.failed;
    if (value.requested !== total) {
      ctx.addIssue({
        code: "custom",
        path: ["requested"],
        message: "requested must equal updated + skipped + failed"
      });
    }
    if (value.items.length !== value.requested) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "items length must equal requested"
      });
    }
    const seenItemIds = new Set<string>();
    value.items.forEach((item, index) => {
      if (seenItemIds.has(item.itemId)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "itemId"],
          message: `duplicate market report item '${item.itemId}'`
        });
      }
      seenItemIds.add(item.itemId);
    });
    if (Date.parse(value.finishedAt) < Date.parse(value.startedAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["finishedAt"],
        message: "finishedAt must not precede startedAt"
      });
    }
  });

export const MarketSyncResponseSchema: z.ZodType<MarketSyncResponse> = z
  .object({
    priceSet: PriceSetSchema,
    report: MarketSyncReportSchema
  })
  .strict();

export const MarketSourceMappingSchema: z.ZodType<MarketSourceMapping> = z
  .object({
    itemId: EntityIdSchema,
    sourceSlug: z.string().min(1),
    source: z.literal(MARKET_SOURCE_ID),
    tradeable: z.boolean(),
    syncPrice: z.boolean(),
    syncAlch: z.boolean(),
    notes: z.string().min(1).optional()
  })
  .strict();

export const MarketSourceMappingsSchema = z
  .array(MarketSourceMappingSchema)
  .superRefine((mappings, ctx) => {
    const seenItemIds = new Set<string>();
    const seenSourceSlugs = new Set<string>();
    for (const [index, mapping] of mappings.entries()) {
      if (seenItemIds.has(mapping.itemId)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "itemId"],
          message: `duplicate market item mapping '${mapping.itemId}'`
        });
      }
      seenItemIds.add(mapping.itemId);
      if (seenSourceSlugs.has(mapping.sourceSlug)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "sourceSlug"],
          message: `duplicate market source slug '${mapping.sourceSlug}'`
        });
      }
      seenSourceSlugs.add(mapping.sourceSlug);
    }
  });

export const MarketUpstreamFixtureItemSchema = z
  .object({
    itemId: EntityIdSchema,
    sourceSlug: z.string().min(1),
    item: z
      .object({
        price: NonNegativeNumberSchema.optional(),
        highalch: NonNegativeNumberSchema.optional(),
        high_alch: NonNegativeNumberSchema.optional(),
        highAlch: NonNegativeNumberSchema.optional(),
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
  .strict();

export const MarketUpstreamFixtureItemsSchema = z.array(MarketUpstreamFixtureItemSchema);

export type MarketUpstreamFixtureItem = z.infer<typeof MarketUpstreamFixtureItemSchema>;

export interface MarketSyncRequestValidationOptions {
  maxItems?: number;
  allowedItemIds?: Iterable<string>;
}

export function parseHiscoresLookupRequest(input: unknown): HiscoresLookupRequest {
  return parseWithSchema(HiscoresLookupRequestSchema, input, "Hiscores lookup request");
}

export function parseHiscoresResponse(input: unknown): HiscoresResponse {
  return parseWithSchema(HiscoresResponseSchema, input, "Hiscores response");
}

export function parseHiscoresResponseJson(
  jsonText: string,
  options: { maxBytes?: number } = {}
): HiscoresResponse {
  return parseLiveIntegrationJson(jsonText, HiscoresResponseSchema, "Hiscores response", options);
}

export function parseHiscoresStatusResponse(input: unknown): HiscoresStatusResponse {
  return parseWithSchema(HiscoresStatusResponseSchema, input, "Hiscores status response");
}

export function parseHiscoresStatusResponseJson(
  jsonText: string,
  options: { maxBytes?: number } = {}
): HiscoresStatusResponse {
  return parseLiveIntegrationJson(
    jsonText,
    HiscoresStatusResponseSchema,
    "Hiscores status response",
    options
  );
}

export function parseIntegrationErrorResponseJson(
  jsonText: string,
  options: { maxBytes?: number } = {}
): IntegrationErrorResponse {
  return parseLiveIntegrationJson(
    jsonText,
    IntegrationErrorResponseSchema,
    "Integration error response",
    options
  );
}

export function parseMarketStatusResponse(input: unknown): MarketStatusResponse {
  return parseWithSchema(MarketStatusResponseSchema, input, "Market status response");
}

export function parseMarketStatusResponseJson(
  jsonText: string,
  options: { maxBytes?: number } = {}
): MarketStatusResponse {
  return parseLiveIntegrationJson(
    jsonText,
    MarketStatusResponseSchema,
    "Market status response",
    options
  );
}

export function parseMarketSyncRequest(
  input: unknown,
  options: MarketSyncRequestValidationOptions = {}
): MarketSyncRequest {
  const request = parseWithSchema(MarketSyncRequestSchema, input, "Market sync request");
  const maxItems = options.maxItems ?? MARKET_SYNC_MAX_ITEMS;
  const itemIds = request.itemIds ?? [];

  if (itemIds.length > maxItems) {
    throw new LiveIntegrationValidationError(
      "item_count_exceeded",
      `Market sync request exceeds ${maxItems} items`,
      [`itemIds: expected at most ${maxItems} items`]
    );
  }

  if (options.allowedItemIds && itemIds.length) {
    const allowed = new Set(options.allowedItemIds);
    const disallowed = itemIds.filter((itemId) => !allowed.has(itemId));
    if (disallowed.length) {
      throw new LiveIntegrationValidationError(
        "disallowed_market_items",
        "Market sync request includes item ids outside the approved mapping",
        disallowed.map((itemId) => `itemIds: '${itemId}' is not in the approved mapping`)
      );
    }
  }

  return request;
}

export function parseMarketSyncRequestJson(
  jsonText: string,
  options: MarketSyncRequestValidationOptions & { maxBytes?: number } = {}
): MarketSyncRequest {
  const parsed = parseJsonText(jsonText, options.maxBytes ?? LIVE_INTEGRATION_JSON_MAX_BYTES);
  return parseMarketSyncRequest(parsed, options);
}

export function parseMarketSyncResponse(input: unknown): MarketSyncResponse {
  return parseWithSchema(MarketSyncResponseSchema, input, "Market sync response");
}

export function parseMarketSyncResponseJson(
  jsonText: string,
  options: { maxBytes?: number } = {}
): MarketSyncResponse {
  return parseLiveIntegrationJson(
    jsonText,
    MarketSyncResponseSchema,
    "Market sync response",
    options
  );
}

export function parseMarketSourceMappings(input: unknown): MarketSourceMapping[] {
  return parseWithSchema(MarketSourceMappingsSchema, input, "Market source mappings");
}

export function parseMarketUpstreamFixtureItems(input: unknown): MarketUpstreamFixtureItem[] {
  return parseWithSchema(MarketUpstreamFixtureItemsSchema, input, "Market upstream fixture items");
}

function highAlchFromFixture(item: MarketUpstreamFixtureItem): number | undefined {
  return item.item?.highalch ?? item.item?.high_alch ?? item.item?.highAlch ?? item.item?.alch;
}

function averageRecentPrices(
  item: MarketUpstreamFixtureItem,
  sampleSize: number
): number | undefined {
  const recent = (item.history ?? []).slice(0, sampleSize).map((entry) => entry.price);
  const samples = recent.length ? recent : item.item?.price !== undefined ? [item.item.price] : [];
  if (!samples.length) return undefined;
  return Math.round(samples.reduce((sum, price) => sum + price, 0) / samples.length);
}

export function createPriceSetFromMarketFixtureItems(input: {
  id: string;
  label: string;
  createdAt: string;
  items: readonly MarketUpstreamFixtureItem[];
  sampleSize?: number;
  provenanceNotes?: string;
}): PriceSet {
  const sampleSize = input.sampleSize ?? MARKET_FIXTURE_SAMPLE_SIZE;
  const itemPrices: Record<string, number> = {};
  const alchValues: Record<string, number> = {};

  for (const item of input.items) {
    const price = averageRecentPrices(item, sampleSize);
    const alch = highAlchFromFixture(item);
    if (price !== undefined) itemPrices[item.itemId] = price;
    if (alch !== undefined) alchValues[item.itemId] = alch;
  }

  return PriceSetSchema.parse({
    id: input.id,
    label: input.label,
    source: "scraped",
    createdAt: input.createdAt,
    itemPrices,
    alchValues,
    provenance: {
      source: "scraped",
      sourceRef: MARKET_SOURCE_ID,
      notes:
        input.provenanceNotes ??
        "Created from mocked market upstream fixtures for validation tests; not a live upstream response."
    }
  }) as PriceSet;
}

export function validateMarketSourceMappingCoverage(input: {
  mappings: readonly MarketSourceMapping[];
  requiredItemIds: Iterable<string>;
}): string[] {
  const known = new Set(input.mappings.map((mapping) => mapping.itemId));
  return [...input.requiredItemIds].filter((itemId) => !known.has(itemId));
}

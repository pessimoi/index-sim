import { z } from "zod";
import {
  type ItemPriceMetadata,
  type ItemPriceReasonCode,
  type ItemPriceValueOrigin,
  type PriceSet
} from "../../domain/shared";
import { DataReliabilityError, assertNoDuplicateJsonKeys } from "../reliability";
import {
  DataProvenanceSchema,
  EntityIdSchema,
  NonNegativeNumberSchema,
  PriceSourceSchema
} from "./game-data";

export const PRICE_SET_IMPORT_MAX_BYTES = 1_000_000;

export const PriceMapSchema = z.record(EntityIdSchema, NonNegativeNumberSchema);

const IsoTimestampSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid timestamp");

const ObservationCountSchema = z.number().int().nonnegative().max(1_000_000);

export const ItemPriceValueOriginSchema = z.enum([
  "market-observation",
  "legacy-static",
  "generated-object-cost",
  "imported",
  "manual",
  "unknown"
]);

export const ItemPriceRefreshStatusSchema = z.enum([
  "observed",
  "retained",
  "not-evaluated",
  "not-applicable"
]);

export const ItemPriceQualitySchema = z.enum(["high", "medium", "low", "fallback", "unknown"]);

export const ItemPriceReasonCodeSchema = z.enum([
  "insufficient-observations",
  "outlier-filter-insufficient",
  "latest-observation-too-old",
  "source-item-unavailable",
  "outside-market-allowlist",
  "generated-price-fallback",
  "legacy-metadata-unavailable",
  "import-metadata-unavailable",
  "manual-value"
]);

export const ItemPriceMetadataSchema = z
  .object({
    valueOrigin: ItemPriceValueOriginSchema,
    refreshStatus: ItemPriceRefreshStatusSchema,
    quality: ItemPriceQualitySchema,
    sourceId: z.literal("markets.lostcity.rs").optional(),
    sourceSlug: z.string().min(1).max(160).optional(),
    sourceRef: z.string().min(1).max(400).optional(),
    verifiedAt: IsoTimestampSchema.optional(),
    valueObservedAt: IsoTimestampSchema.optional(),
    evaluatedAt: IsoTimestampSchema.optional(),
    latestCandidateAt: IsoTimestampSchema.optional(),
    sourceObservations: ObservationCountSchema.optional(),
    usableObservations: ObservationCountSchema.optional(),
    acceptedObservations: ObservationCountSchema.optional(),
    rejectedObservations: ObservationCountSchema.optional(),
    reasonCode: ItemPriceReasonCodeSchema.optional()
  })
  .strict()
  .superRefine((metadata, ctx) => {
    if (
      metadata.valueOrigin === "market-observation" &&
      (!metadata.sourceId || !metadata.sourceSlug)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceId"],
        message: "market-observation requires approved source id and slug"
      });
    }
    if (
      metadata.refreshStatus === "observed" &&
      (metadata.valueOrigin !== "market-observation" ||
        !metadata.valueObservedAt ||
        !metadata.evaluatedAt)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["refreshStatus"],
        message: "observed refresh requires market origin and observation/evaluation timestamps"
      });
    }
    if (metadata.refreshStatus === "retained" && (!metadata.evaluatedAt || !metadata.reasonCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["refreshStatus"],
        message: "retained refresh requires evaluation time and reason code"
      });
    }
    if (
      metadata.valueOrigin === "generated-object-cost" &&
      (metadata.quality !== "fallback" ||
        metadata.refreshStatus !== "not-applicable" ||
        metadata.reasonCode !== "generated-price-fallback")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["valueOrigin"],
        message: "generated object cost requires explicit fallback metadata"
      });
    }
    if (
      ["legacy-static", "imported", "manual", "unknown"].includes(metadata.valueOrigin) &&
      metadata.valueObservedAt
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["valueObservedAt"],
        message: "non-market value origin cannot claim a market observation time"
      });
    }

    const counts = [
      metadata.sourceObservations,
      metadata.usableObservations,
      metadata.acceptedObservations,
      metadata.rejectedObservations
    ];
    if (counts.some((count) => count !== undefined)) {
      if (counts.some((count) => count === undefined)) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceObservations"],
          message: "observation counts must be supplied as one complete set"
        });
      } else {
        const [source, usable, accepted, rejected] = counts as [number, number, number, number];
        if (accepted > usable || usable > source || accepted + rejected !== source) {
          ctx.addIssue({
            code: "custom",
            path: ["sourceObservations"],
            message: "observation counts are inconsistent"
          });
        }
      }
    }
  });

export const ItemPriceMetadataMapSchema = z.record(EntityIdSchema, ItemPriceMetadataSchema);

export const ScheduledPriceProvenanceArtifactSchema = z
  .object({
    version: z.literal(1),
    capturedAt: IsoTimestampSchema,
    refreshSource: z.literal("markets.lostcity.rs"),
    items: ItemPriceMetadataMapSchema
  })
  .strict();

export const PriceSetSchema = z
  .object({
    id: EntityIdSchema,
    label: z.string().min(1),
    source: PriceSourceSchema,
    createdAt: z.string().min(1),
    itemPrices: PriceMapSchema,
    itemPriceMetadata: ItemPriceMetadataMapSchema.optional(),
    alchValues: PriceMapSchema,
    provenance: DataProvenanceSchema.optional()
  })
  .strict()
  .superRefine((priceSet, ctx) => {
    for (const itemId of Object.keys(priceSet.itemPriceMetadata ?? {})) {
      if (priceSet.itemPrices[itemId] !== undefined) continue;
      ctx.addIssue({
        code: "custom",
        path: ["itemPriceMetadata", itemId],
        message: "item price metadata requires a matching numeric item price"
      });
    }
  });

export const LegacyPriceHistorySnapshotSchema = z
  .object({
    t: z.number().int().nonnegative(),
    prices: PriceMapSchema
  })
  .strict();

export const LegacyPriceHistorySchema = z.array(LegacyPriceHistorySnapshotSchema);

export const PriceHistoryEvaluationSchema = z.discriminatedUnion("result", [
  z
    .object({
      result: z.literal("observed"),
      sourceSlug: z.string().min(1).max(160),
      valueObservedAt: IsoTimestampSchema,
      quality: z.enum(["high", "medium", "low"])
    })
    .strict(),
  z
    .object({
      result: z.literal("retained"),
      reasonCode: ItemPriceReasonCodeSchema
    })
    .strict()
]);

export const PriceHistorySnapshotSchema = z
  .object({
    t: z.number().int().nonnegative(),
    kind: z.enum(["writer-evaluated", "legacy-unknown"]),
    prices: PriceMapSchema,
    evaluations: z.record(EntityIdSchema, PriceHistoryEvaluationSchema)
  })
  .strict();

export const PriceHistoryArtifactV2Schema = z
  .object({
    version: z.literal(2),
    snapshots: z.array(PriceHistorySnapshotSchema)
  })
  .strict();

export type PriceHistoryArtifactV2 = z.infer<typeof PriceHistoryArtifactV2Schema>;

export const PriceHistorySchema: z.ZodType<PriceHistoryArtifactV2> = z.preprocess(
  (history) =>
    Array.isArray(history)
      ? {
          version: 2 as const,
          snapshots: history.map((snapshot: unknown) => ({
            ...(snapshot as Record<string, unknown>),
            kind: "legacy-unknown" as const,
            evaluations: {}
          }))
        }
      : history,
  PriceHistoryArtifactV2Schema
);

export type ValidatedPriceSet = z.infer<typeof PriceSetSchema>;
export type ValidatedPriceHistory = z.infer<typeof PriceHistorySchema>;
export type ValidatedPriceHistorySnapshot = z.infer<typeof PriceHistorySnapshotSchema>;
export type ValidatedItemPriceMetadata = z.infer<typeof ItemPriceMetadataSchema>;
export type ScheduledPriceProvenanceArtifact = z.infer<
  typeof ScheduledPriceProvenanceArtifactSchema
>;

export type PriceSetValidationErrorCode =
  "body_too_large" | "duplicate_keys" | "invalid_json" | "validation_failed";

export class PriceSetValidationError extends Error {
  readonly code: PriceSetValidationErrorCode;
  readonly issues: string[];

  constructor(code: PriceSetValidationErrorCode, message: string, issues: string[] = []) {
    super(message);
    this.name = "PriceSetValidationError";
    this.code = code;
    this.issues = issues;
  }
}

interface LegacyNumericMapResult {
  values: Record<string, number>;
  metadata: Record<string, number | string | boolean | null>;
}

interface CreatePriceSetFromLegacyRecordsInput {
  id: string;
  label: string;
  source?: PriceSet["source"];
  createdAt?: string;
  itemPrices: unknown;
  itemPriceMetadata?: unknown;
  alchValues: unknown;
  provenance?: PriceSet["provenance"];
  metadataFallbackOrigin?: ItemPriceValueOrigin;
  metadataFallbackReasonCode?: ItemPriceReasonCode;
}

function fallbackMetadata(
  valueOrigin: ItemPriceValueOrigin,
  reasonCode?: ItemPriceReasonCode
): ItemPriceMetadata {
  return ItemPriceMetadataSchema.parse({
    valueOrigin,
    refreshStatus: valueOrigin === "generated-object-cost" ? "not-applicable" : "not-evaluated",
    quality: valueOrigin === "generated-object-cost" ? "fallback" : "unknown",
    reasonCode:
      reasonCode ??
      (valueOrigin === "generated-object-cost"
        ? "generated-price-fallback"
        : valueOrigin === "imported"
          ? "import-metadata-unavailable"
          : valueOrigin === "manual"
            ? "manual-value"
            : "legacy-metadata-unavailable")
  }) as ItemPriceMetadata;
}

export function completeItemPriceMetadata(input: {
  itemPrices: Record<string, number>;
  itemPriceMetadata?: Record<string, ItemPriceMetadata>;
  fallbackOrigin: ItemPriceValueOrigin;
  fallbackReasonCode?: ItemPriceReasonCode;
}): Record<string, ItemPriceMetadata> {
  const metadata = ItemPriceMetadataMapSchema.parse(input.itemPriceMetadata ?? {}) as Record<
    string,
    ItemPriceMetadata
  >;
  const completed = Object.fromEntries(
    Object.keys(input.itemPrices)
      .sort()
      .map((itemId) => [
        itemId,
        metadata[itemId] ?? fallbackMetadata(input.fallbackOrigin, input.fallbackReasonCode)
      ])
  );
  return ItemPriceMetadataMapSchema.parse(completed) as Record<string, ItemPriceMetadata>;
}

export function normalizePriceSetItemMetadata(
  priceSet: PriceSet,
  options: {
    fallbackOrigin?: ItemPriceValueOrigin;
    fallbackReasonCode?: ItemPriceReasonCode;
  } = {}
): PriceSet {
  const parsed = PriceSetSchema.parse(priceSet) as PriceSet;
  return PriceSetSchema.parse({
    ...parsed,
    itemPriceMetadata: completeItemPriceMetadata({
      itemPrices: parsed.itemPrices,
      itemPriceMetadata: parsed.itemPriceMetadata,
      fallbackOrigin: options.fallbackOrigin ?? "unknown",
      fallbackReasonCode: options.fallbackReasonCode
    })
  }) as PriceSet;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function formatZodIssue(issue: { path: PropertyKey[]; message: string }): string {
  const path = issue.path.length ? issue.path.map(String).join(".") : "<root>";
  return `${path}: ${issue.message}`;
}

export function stripLegacyPriceMetadata(input: unknown): LegacyNumericMapResult {
  const raw = z.record(z.string(), z.unknown()).parse(input);
  const values: Record<string, number> = {};
  const metadata: Record<string, number | string | boolean | null> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("_")) {
      if (
        typeof value === "number" ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        value === null
      ) {
        metadata[key] = value;
      }
      continue;
    }
    values[key] = value as number;
  }

  return {
    values: PriceMapSchema.parse(values),
    metadata
  };
}

function createdAtFromMetadata(metadata: Record<string, number | string | boolean | null>): string {
  const scrapedAt = metadata._scraped_at;
  if (typeof scrapedAt === "number" && Number.isFinite(scrapedAt) && scrapedAt > 0) {
    return new Date(scrapedAt * 1000).toISOString();
  }
  return "legacy-unknown";
}

export function createPriceSetFromLegacyRecords(
  input: CreatePriceSetFromLegacyRecordsInput
): PriceSet {
  const itemPriceMap = stripLegacyPriceMetadata(input.itemPrices);
  const alchValueMap = stripLegacyPriceMetadata(input.alchValues);

  const candidate = {
    id: input.id,
    label: input.label,
    source: input.source ?? "bundled",
    createdAt: input.createdAt ?? createdAtFromMetadata(itemPriceMap.metadata),
    itemPrices: itemPriceMap.values,
    itemPriceMetadata:
      input.itemPriceMetadata === undefined
        ? undefined
        : ItemPriceMetadataMapSchema.parse(input.itemPriceMetadata),
    alchValues: alchValueMap.values,
    provenance: input.provenance
  };

  return normalizePriceSetItemMetadata(PriceSetSchema.parse(candidate) as PriceSet, {
    fallbackOrigin: input.metadataFallbackOrigin ?? "legacy-static",
    fallbackReasonCode: input.metadataFallbackReasonCode
  });
}

export function parsePriceSetJson(jsonText: string, options: { maxBytes?: number } = {}): PriceSet {
  const maxBytes = options.maxBytes ?? PRICE_SET_IMPORT_MAX_BYTES;
  if (byteLength(jsonText) > maxBytes) {
    throw new PriceSetValidationError(
      "body_too_large",
      `Price set import exceeds ${maxBytes} bytes`
    );
  }

  let parsed: unknown;
  try {
    assertNoDuplicateJsonKeys(jsonText, { source: "Price set import" });
    parsed = JSON.parse(jsonText);
  } catch (error) {
    if (error instanceof DataReliabilityError && error.code === "duplicate_keys") {
      throw new PriceSetValidationError(
        "duplicate_keys",
        "Price set import contains duplicate JSON keys",
        error.issues
      );
    }
    throw new PriceSetValidationError("invalid_json", "Price set import is not valid JSON");
  }

  const result = PriceSetSchema.safeParse(parsed);
  if (!result.success) {
    throw new PriceSetValidationError(
      "validation_failed",
      "Price set import failed schema validation",
      result.error.issues.map(formatZodIssue)
    );
  }

  return normalizePriceSetItemMetadata(result.data as PriceSet, {
    fallbackOrigin: "imported",
    fallbackReasonCode: "import-metadata-unavailable"
  });
}

export function parsePriceHistory(input: unknown): ValidatedPriceHistory {
  return PriceHistorySchema.parse(input);
}

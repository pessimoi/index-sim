import { z } from "zod";
import { type PriceSet } from "../../domain/shared";
import { DataReliabilityError, assertNoDuplicateJsonKeys } from "../reliability";
import {
  DataProvenanceSchema,
  EntityIdSchema,
  NonNegativeNumberSchema,
  PriceSourceSchema
} from "./game-data";

export const PRICE_SET_IMPORT_MAX_BYTES = 1_000_000;

export const PriceMapSchema = z.record(EntityIdSchema, NonNegativeNumberSchema);

export const PriceSetSchema = z
  .object({
    id: EntityIdSchema,
    label: z.string().min(1),
    source: PriceSourceSchema,
    createdAt: z.string().min(1),
    itemPrices: PriceMapSchema,
    alchValues: PriceMapSchema,
    provenance: DataProvenanceSchema.optional()
  })
  .strict();

export const PriceHistorySnapshotSchema = z
  .object({
    t: z.number().int().nonnegative(),
    prices: PriceMapSchema
  })
  .strict();

export const PriceHistorySchema = z.array(PriceHistorySnapshotSchema);

export type ValidatedPriceSet = z.infer<typeof PriceSetSchema>;
export type ValidatedPriceHistory = z.infer<typeof PriceHistorySchema>;

export type PriceSetValidationErrorCode =
  | "body_too_large"
  | "duplicate_keys"
  | "invalid_json"
  | "validation_failed";

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
  alchValues: unknown;
  provenance?: PriceSet["provenance"];
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
    alchValues: alchValueMap.values,
    provenance: input.provenance
  };

  return PriceSetSchema.parse(candidate) as PriceSet;
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

  return result.data as PriceSet;
}

export function parsePriceHistory(input: unknown): ValidatedPriceHistory {
  return PriceHistorySchema.parse(input);
}

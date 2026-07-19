import { z } from "zod";
import type { GameDataSnapshot } from "@/domain/shared";
import { DataReliabilityError, parseJsonWithDuplicateKeyCheck } from "@/data/reliability";
import { REWRITE_SETUP_VERSION, SavedSetupEnvelopeSchema, type SavedSetupState } from "./ui-state";
import { savedSetupCompatibilityIssues } from "./setup-compatibility";
import {
  SetupTransferContextV1Schema,
  createSetupTransferContext,
  type SetupTransferContextV1
} from "./setup-transfer-context";

export const SETUP_IMPORT_MAX_BYTES = 250_000;
export const REWRITE_SETUP_TRANSFER_KIND = "index-sim-rewrite-setup";
export const REWRITE_SETUP_TRANSFER_VERSION = 1;

export interface RewriteSetupTransferEnvelopeV1 {
  kind: typeof REWRITE_SETUP_TRANSFER_KIND;
  version: typeof REWRITE_SETUP_TRANSFER_VERSION;
  exportedAt: string;
  context: SetupTransferContextV1;
  data: SavedSetupState;
}

export interface ParsedRewriteSetupTransfer {
  format: "contextual-v1" | "legacy-storage-v3";
  version: number;
  exportedAt: string;
  context: SetupTransferContextV1 | null;
  data: SavedSetupState;
}

export const RewriteSetupTransferEnvelopeV1Schema: z.ZodType<RewriteSetupTransferEnvelopeV1> = z
  .object({
    kind: z.literal(REWRITE_SETUP_TRANSFER_KIND),
    version: z.literal(REWRITE_SETUP_TRANSFER_VERSION),
    exportedAt: z.iso.datetime({ offset: true }).max(64),
    context: SetupTransferContextV1Schema,
    data: SavedSetupEnvelopeSchema.shape.data
  })
  .strict();

export type SetupImportErrorCode =
  | "body_too_large"
  | "duplicate_keys"
  | "invalid_json"
  | "unsupported_version"
  | "invalid_data"
  | "incompatible_entities";

export class SetupImportError extends Error {
  constructor(
    readonly code: SetupImportErrorCode,
    readonly issues: string[] = []
  ) {
    super(code);
    this.name = "SetupImportError";
  }
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function zodIssuePath(path: PropertyKey[]): string {
  return path.length ? path.map(String).join(".") : "setup";
}

export function parseSavedSetupExportText(
  text: string,
  gameData: GameDataSnapshot,
  maxBytes = SETUP_IMPORT_MAX_BYTES
): ParsedRewriteSetupTransfer {
  if (byteLength(text) > maxBytes) throw new SetupImportError("body_too_large");

  let value: unknown;
  try {
    value = parseJsonWithDuplicateKeyCheck(text, { maxBytes, source: "Setup import" });
  } catch (error) {
    if (error instanceof DataReliabilityError && error.code === "duplicate_keys") {
      throw new SetupImportError("duplicate_keys");
    }
    throw new SetupImportError("invalid_json");
  }

  const record = value !== null && typeof value === "object" ? value : null;
  const contextual =
    record !== null && "kind" in record && record.kind === REWRITE_SETUP_TRANSFER_KIND;
  if (record !== null && "kind" in record && !contextual) {
    throw new SetupImportError("unsupported_version");
  }
  if (
    record !== null &&
    "version" in record &&
    record.version !== (contextual ? REWRITE_SETUP_TRANSFER_VERSION : REWRITE_SETUP_VERSION)
  ) {
    throw new SetupImportError("unsupported_version");
  }

  const parsed = contextual
    ? RewriteSetupTransferEnvelopeV1Schema.safeParse(value)
    : SavedSetupEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    throw new SetupImportError(
      "invalid_data",
      parsed.error.issues.slice(0, 5).map((issue) => zodIssuePath(issue.path))
    );
  }
  const compatibilityIssues = savedSetupCompatibilityIssues(parsed.data.data, gameData);
  if (compatibilityIssues.length) {
    throw new SetupImportError("incompatible_entities", compatibilityIssues.slice(0, 5));
  }
  if (contextual) {
    const envelope = parsed.data as RewriteSetupTransferEnvelopeV1;
    return {
      format: "contextual-v1",
      version: envelope.version,
      exportedAt: envelope.exportedAt,
      context: envelope.context,
      data: envelope.data
    };
  }
  const envelope = parsed.data as z.infer<typeof SavedSetupEnvelopeSchema>;
  return {
    format: "legacy-storage-v3",
    version: envelope.version,
    exportedAt: envelope.savedAt,
    context: null,
    data: envelope.data
  };
}

export function createRewriteSetupTransferEnvelope(
  setup: SavedSetupState,
  gameData: GameDataSnapshot,
  now = new Date()
): RewriteSetupTransferEnvelopeV1 {
  return RewriteSetupTransferEnvelopeV1Schema.parse({
    kind: REWRITE_SETUP_TRANSFER_KIND,
    version: REWRITE_SETUP_TRANSFER_VERSION,
    exportedAt: now.toISOString(),
    context: createSetupTransferContext(gameData),
    data: setup
  });
}

import type { GameDataSnapshot } from "@/domain/shared";
import { DataReliabilityError, parseJsonWithDuplicateKeyCheck } from "@/data/reliability";
import { REWRITE_SETUP_VERSION, SavedSetupEnvelopeSchema, type SavedSetupState } from "./ui-state";
import { savedSetupCompatibilityIssues } from "./setup-compatibility";

export const SETUP_IMPORT_MAX_BYTES = 250_000;

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
): { version: number; savedAt: string; data: SavedSetupState } {
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

  if (
    value !== null &&
    typeof value === "object" &&
    "version" in value &&
    value.version !== REWRITE_SETUP_VERSION
  ) {
    throw new SetupImportError("unsupported_version");
  }

  const parsed = SavedSetupEnvelopeSchema.safeParse(value);
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
  return parsed.data;
}

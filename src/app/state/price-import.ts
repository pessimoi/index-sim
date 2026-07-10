import {
  PRICE_SET_IMPORT_MAX_BYTES,
  PriceSetValidationError,
  type PriceSetValidationErrorCode
} from "@/data/schemas";

export interface PriceImportNotice {
  tone: "success" | "error";
  message: string;
  code?: PriceSetValidationErrorCode;
  details?: string[];
}

const PRICE_IMPORT_MAX_ISSUES = 5;
const PRICE_IMPORT_INACTIVE_DETAIL =
  "Import was not applied. The current PriceSet remains active and price history was not changed.";

function formatBytes(bytes: number): string {
  if (bytes % 1_000_000 === 0) return `${bytes / 1_000_000} MB`;
  if (bytes % 1_000 === 0) return `${bytes / 1_000} KB`;
  return `${bytes} bytes`;
}

function sanitizeImportDetail(value: string): string {
  return value
    .replace(/(?:[A-Za-z]:)?[\\/][^\s"']+/g, "[path]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function issueDetails(issues: readonly string[]): string[] {
  return issues.slice(0, PRICE_IMPORT_MAX_ISSUES).map(sanitizeImportDetail);
}

function isFileSizeError(error: Error): boolean {
  return (
    /^File exceeds \d+ bytes$/.test(error.message) ||
    /^Price file exceeds \d+ bytes$/.test(error.message)
  );
}

function priceImportFailureNotice(
  code: PriceSetValidationErrorCode,
  message: string,
  issues: readonly string[] = []
): PriceImportNotice {
  return {
    tone: "error",
    code,
    message,
    details: [...issueDetails(issues), PRICE_IMPORT_INACTIVE_DETAIL]
  };
}

export function describePriceImportError(error: unknown): PriceImportNotice {
  if (error instanceof PriceSetValidationError) {
    if (error.code === "body_too_large") {
      return priceImportFailureNotice(
        "body_too_large",
        `Price import failed: the file is too large. Choose a PriceSet JSON under ${formatBytes(PRICE_SET_IMPORT_MAX_BYTES)}.`
      );
    }
    if (error.code === "duplicate_keys") {
      return priceImportFailureNotice(
        "duplicate_keys",
        "Price import failed: the JSON contains duplicate keys. Remove the duplicates and try again.",
        error.issues
      );
    }
    if (error.code === "invalid_json") {
      return priceImportFailureNotice(
        "invalid_json",
        "Price import failed: the file is not valid JSON."
      );
    }
    return priceImportFailureNotice(
      "validation_failed",
      "Price import failed: the file is not a valid PriceSet export.",
      error.issues
    );
  }

  if (error instanceof Error && isFileSizeError(error)) {
    return priceImportFailureNotice(
      "body_too_large",
      `Price import failed: the file is too large. Choose a PriceSet JSON under ${formatBytes(PRICE_SET_IMPORT_MAX_BYTES)}.`
    );
  }

  return {
    tone: "error",
    message: "Price import failed. Check the file and try again.",
    details: [PRICE_IMPORT_INACTIVE_DETAIL]
  };
}

export function createPriceImportSuccessNotice(label: string): PriceImportNotice {
  return {
    tone: "success",
    message: `Imported market prices: ${label}. High alch values use current generated game data.`
  };
}

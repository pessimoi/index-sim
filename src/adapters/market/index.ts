import {
  LIVE_INTEGRATION_JSON_MAX_BYTES,
  LiveIntegrationValidationError,
  PRICE_SET_IMPORT_MAX_BYTES,
  PriceSetSchema,
  createPriceSetFromLegacyRecords,
  parseIntegrationErrorResponseJson,
  parseMarketStatusResponseJson,
  parseMarketSyncRequest,
  parseMarketSyncResponseJson,
  parsePriceHistory,
  parsePriceSetJson
} from "@/data/schemas";
import { DataReliabilityError, parseJsonWithDuplicateKeyCheck } from "@/data/reliability";
import type {
  IntegrationErrorResponse,
  MarketStatusResponse,
  MarketSyncRequest,
  MarketSyncResponse,
  PriceSet
} from "@/domain/shared";

export interface PriceSetImportOptions {
  maxBytes?: number;
}

type Fetcher = typeof fetch;

export interface MarketFetchOptions {
  fetcher?: Fetcher;
  endpoint?: string;
  baseUrl?: string;
  allowedOrigin?: string;
  maxBytes?: number;
}

export type ScheduledStaticPriceSnapshotStatusCode =
  | "loaded"
  | "missing"
  | "invalid"
  | "fallback";

export type ScheduledStaticPriceSnapshotFileStatus =
  | "loaded"
  | "missing"
  | "invalid"
  | "not-requested";

export type ScheduledStaticPriceSnapshotValidationCode =
  | "body_too_large"
  | "duplicate_keys"
  | "invalid_json"
  | "validation_failed";

export interface ScheduledStaticPriceSnapshotFiles {
  prices: ScheduledStaticPriceSnapshotFileStatus;
  alch: ScheduledStaticPriceSnapshotFileStatus;
  priceHistory: ScheduledStaticPriceSnapshotFileStatus;
}

export interface ScheduledStaticPriceSnapshotStatus {
  status: ScheduledStaticPriceSnapshotStatusCode;
  reason: string;
  scheduledPriceSet: PriceSet | null;
  fallbackPriceSet: PriceSet | null;
  fallbackReason?: "missing" | "invalid";
  validationCode?: ScheduledStaticPriceSnapshotValidationCode;
  files: ScheduledStaticPriceSnapshotFiles;
  itemCount: number | null;
  alchCount: number | null;
  latestHistoryAt: string | null;
  warnings: string[];
}

export interface ScheduledStaticPriceSnapshotContent {
  pricesText?: string | null;
  alchText?: string | null;
  priceHistoryText?: string | null;
}

export interface ScheduledStaticPriceSnapshotOptions {
  fallbackPriceSet?: PriceSet | null;
  loadedAt?: string;
  maxBytes?: number;
}

export interface ScheduledStaticPriceSnapshotLoadOptions
  extends Omit<MarketFetchOptions, "endpoint">,
    ScheduledStaticPriceSnapshotOptions {
  paths?: {
    prices?: string;
    alch?: string;
    priceHistory?: string | null;
  };
}

export class MarketAdapterError extends Error {
  readonly code: IntegrationErrorResponse["error"]["code"];
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: IntegrationErrorResponse["error"]["code"],
    message: string,
    options: { status?: number; retryAfterSeconds?: number } = {}
  ) {
    super(message);
    this.name = "MarketAdapterError";
    this.code = code;
    this.status = options.status ?? 0;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

function browserBaseUrl(options: Pick<MarketFetchOptions, "baseUrl">): string {
  return options.baseUrl ?? globalThis.location?.href ?? "http://localhost/";
}

function sameOriginUrl(path: string, options: MarketFetchOptions): URL {
  const baseUrl = browserBaseUrl(options);
  const target = new URL(path, baseUrl);
  const allowedOrigin = options.allowedOrigin ?? new URL(baseUrl).origin;

  if (target.origin !== allowedOrigin) {
    throw new MarketAdapterError("bad-request", "Refusing cross-origin market request");
  }

  return target;
}

function adapterErrorFromStatus(status: number): IntegrationErrorResponse["error"]["code"] {
  if (status === 400) return "bad-request";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status === 502) return "upstream-invalid";
  if (status === 503) return "upstream-unavailable";
  return "internal-error";
}

function validationToAdapterError(
  error: unknown,
  fallbackCode: IntegrationErrorResponse["error"]["code"]
) {
  if (error instanceof LiveIntegrationValidationError) {
    return new MarketAdapterError(fallbackCode, "Invalid market API response");
  }
  return error;
}

function parseSyncRequest(request: MarketSyncRequest): MarketSyncRequest {
  try {
    return parseMarketSyncRequest(request);
  } catch (error) {
    if (error instanceof LiveIntegrationValidationError) {
      throw new MarketAdapterError("bad-request", "Invalid market sync request");
    }
    throw error;
  }
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function safeIdSegment(value: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "unknown"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function createdAtFromPriceMetadata(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const scrapedAt = value._scraped_at;
  if (typeof scrapedAt !== "number" || !Number.isFinite(scrapedAt) || scrapedAt <= 0) {
    return null;
  }
  return new Date(scrapedAt * 1000).toISOString();
}

function latestHistoryTimestamp(value: unknown): string | null {
  const history = parsePriceHistory(value);
  const latestSeconds = history.reduce((latest, snapshot) => Math.max(latest, snapshot.t), 0);
  return latestSeconds > 0 ? new Date(latestSeconds * 1000).toISOString() : null;
}

function invalidStatus(
  files: ScheduledStaticPriceSnapshotFiles,
  code: ScheduledStaticPriceSnapshotValidationCode,
  warnings: string[],
  fallbackPriceSet?: PriceSet | null
): ScheduledStaticPriceSnapshotStatus {
  if (fallbackPriceSet) {
    return {
      status: "fallback",
      reason: "Scheduled price snapshot is invalid. Using the current PriceSet fallback.",
      scheduledPriceSet: null,
      fallbackPriceSet: PriceSetSchema.parse(fallbackPriceSet) as PriceSet,
      fallbackReason: "invalid",
      validationCode: code,
      files,
      itemCount: null,
      alchCount: null,
      latestHistoryAt: null,
      warnings
    };
  }

  return {
    status: "invalid",
    reason: "Scheduled price snapshot is invalid. Keeping existing prices available.",
    scheduledPriceSet: null,
    fallbackPriceSet: null,
    validationCode: code,
    files,
    itemCount: null,
    alchCount: null,
    latestHistoryAt: null,
    warnings
  };
}

function missingStatus(
  files: ScheduledStaticPriceSnapshotFiles,
  fallbackPriceSet?: PriceSet | null
): ScheduledStaticPriceSnapshotStatus {
  if (fallbackPriceSet) {
    return {
      status: "fallback",
      reason: "Scheduled price snapshot is missing. Using the current PriceSet fallback.",
      scheduledPriceSet: null,
      fallbackPriceSet: PriceSetSchema.parse(fallbackPriceSet) as PriceSet,
      fallbackReason: "missing",
      files,
      itemCount: null,
      alchCount: null,
      latestHistoryAt: null,
      warnings: []
    };
  }

  return {
    status: "missing",
    reason: "Scheduled price snapshot is missing. Keeping existing prices available.",
    scheduledPriceSet: null,
    fallbackPriceSet: null,
    files,
    itemCount: null,
    alchCount: null,
    latestHistoryAt: null,
    warnings: []
  };
}

function parseStaticJson(
  text: string,
  source: string,
  maxBytes: number
):
  | { status: "loaded"; value: unknown }
  | { status: "invalid"; code: ScheduledStaticPriceSnapshotValidationCode } {
  if (byteLength(text) > maxBytes) {
    return { status: "invalid", code: "body_too_large" };
  }

  try {
    return {
      status: "loaded",
      value: parseJsonWithDuplicateKeyCheck(text, { maxBytes, source })
    };
  } catch (error) {
    if (error instanceof DataReliabilityError && error.code === "duplicate_keys") {
      return { status: "invalid", code: "duplicate_keys" };
    }
    return { status: "invalid", code: "invalid_json" };
  }
}

export function createScheduledStaticPriceSnapshotStatus(
  content: ScheduledStaticPriceSnapshotContent,
  options: ScheduledStaticPriceSnapshotOptions = {}
): ScheduledStaticPriceSnapshotStatus {
  const maxBytes = options.maxBytes ?? PRICE_SET_IMPORT_MAX_BYTES;
  const files: ScheduledStaticPriceSnapshotFiles = {
    prices: content.pricesText == null ? "missing" : "loaded",
    alch: content.alchText == null ? "missing" : "loaded",
    priceHistory:
      content.priceHistoryText === undefined
        ? "not-requested"
        : content.priceHistoryText === null
          ? "missing"
          : "loaded"
  };

  if (content.pricesText == null || content.alchText == null) {
    return missingStatus(files, options.fallbackPriceSet);
  }

  const warnings: string[] = [];
  const prices = parseStaticJson(content.pricesText, "Scheduled prices", maxBytes);
  if (prices.status === "invalid") {
    files.prices = "invalid";
    return invalidStatus(files, prices.code, warnings, options.fallbackPriceSet);
  }

  const alch = parseStaticJson(content.alchText, "Scheduled alch values", maxBytes);
  if (alch.status === "invalid") {
    files.alch = "invalid";
    return invalidStatus(files, alch.code, warnings, options.fallbackPriceSet);
  }

  let latestHistoryAt: string | null = null;
  if (content.priceHistoryText !== undefined && content.priceHistoryText !== null) {
    const history = parseStaticJson(content.priceHistoryText, "Scheduled price history", maxBytes);
    if (history.status === "invalid") {
      files.priceHistory = "invalid";
      warnings.push("Scheduled price history metadata was ignored.");
    } else {
      try {
        latestHistoryAt = latestHistoryTimestamp(history.value);
      } catch {
        files.priceHistory = "invalid";
        latestHistoryAt = null;
        warnings.push("Scheduled price history metadata was ignored.");
      }
    }
  }

  const createdAt =
    createdAtFromPriceMetadata(prices.value) ??
    latestHistoryAt ??
    options.loadedAt ??
    new Date().toISOString();

  try {
    const scheduledPriceSet = createPriceSetFromLegacyRecords({
      id: `scheduled-static-prices-${safeIdSegment(createdAt)}`,
      label: "Scheduled static prices",
      source: "scraped",
      createdAt,
      itemPrices: prices.value,
      alchValues: alch.value,
      provenance: {
        source: "scraped",
        sourceRef: "prices.json and alch.json",
        verifiedAt: createdAt,
        notes:
          "Read-only scheduled static snapshot candidate validated by the current PriceSet schema."
      }
    });

    return {
      status: "loaded",
      reason: "Scheduled price snapshot loaded.",
      scheduledPriceSet,
      fallbackPriceSet: null,
      files,
      itemCount: Object.keys(scheduledPriceSet.itemPrices).length,
      alchCount: Object.keys(scheduledPriceSet.alchValues).length,
      latestHistoryAt,
      warnings
    };
  } catch {
    return invalidStatus(files, "validation_failed", warnings, options.fallbackPriceSet);
  }
}

async function fetchStaticText(
  path: string | null | undefined,
  options: ScheduledStaticPriceSnapshotLoadOptions
): Promise<string | null | undefined> {
  if (path === null) return undefined;
  if (path === undefined) return null;
  const fetcher = options.fetcher ?? globalThis.fetch;
  const target = sameOriginUrl(path, options);

  try {
    const response = await fetcher(target.href, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function loadScheduledStaticPriceSnapshot(
  options: ScheduledStaticPriceSnapshotLoadOptions = {}
): Promise<ScheduledStaticPriceSnapshotStatus> {
  const paths = {
    prices: options.paths?.prices ?? "/prices.json",
    alch: options.paths?.alch ?? "/alch.json",
    priceHistory:
      options.paths?.priceHistory === undefined ? "/price-history.json" : options.paths.priceHistory
  };

  const [pricesText, alchText, priceHistoryText] = await Promise.all([
    fetchStaticText(paths.prices, options),
    fetchStaticText(paths.alch, options),
    fetchStaticText(paths.priceHistory, options)
  ]);

  return createScheduledStaticPriceSnapshotStatus(
    {
      pricesText,
      alchText,
      priceHistoryText
    },
    options
  );
}

async function errorFromResponse(
  response: Response,
  options: Pick<MarketFetchOptions, "maxBytes">
): Promise<MarketAdapterError> {
  const fallbackCode = adapterErrorFromStatus(response.status);
  try {
    const parsed = parseIntegrationErrorResponseJson(await response.text(), {
      maxBytes: options.maxBytes ?? LIVE_INTEGRATION_JSON_MAX_BYTES
    });
    return new MarketAdapterError(parsed.error.code, parsed.error.message, {
      status: response.status,
      retryAfterSeconds: parsed.error.retryAfterSeconds
    });
  } catch {
    return new MarketAdapterError(fallbackCode, "Market request failed", {
      status: response.status
    });
  }
}

export async function readTextFile(
  file: File,
  options: PriceSetImportOptions = {}
): Promise<string> {
  const maxBytes = options.maxBytes ?? PRICE_SET_IMPORT_MAX_BYTES;
  if (file.size > maxBytes) {
    throw new Error(`Price file exceeds ${maxBytes} bytes`);
  }
  return file.text();
}

export function parsePriceSetFileText(text: string, options: PriceSetImportOptions = {}): PriceSet {
  return parsePriceSetJson(text, { maxBytes: options.maxBytes });
}

export async function readPriceSetFile(
  file: File,
  options: PriceSetImportOptions = {}
): Promise<PriceSet> {
  return parsePriceSetFileText(await readTextFile(file, options), options);
}

export async function fetchPriceSet(
  url: string,
  options: PriceSetImportOptions & { allowedOrigin?: string } = {}
): Promise<PriceSet> {
  const target = new URL(url, globalThis.location?.href);
  const allowedOrigin = options.allowedOrigin ?? globalThis.location?.origin;
  if (allowedOrigin && target.origin !== allowedOrigin) {
    throw new Error("Refusing to fetch prices from an unapproved origin");
  }

  const response = await fetch(target.href, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Price fetch failed with HTTP ${response.status}`);
  }
  return parsePriceSetFileText(await response.text(), options);
}

export async function fetchMarketStatus(
  options: MarketFetchOptions = {}
): Promise<MarketStatusResponse> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  const target = sameOriginUrl(options.endpoint ?? "/api/market/status", options);
  const response = await fetcher(target.href, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw await errorFromResponse(response, options);
  }

  try {
    return parseMarketStatusResponseJson(await response.text(), {
      maxBytes: options.maxBytes ?? LIVE_INTEGRATION_JSON_MAX_BYTES
    });
  } catch (error) {
    throw validationToAdapterError(error, "upstream-invalid");
  }
}

export async function syncMarketPrices(
  request: MarketSyncRequest,
  options: MarketFetchOptions = {}
): Promise<MarketSyncResponse> {
  const syncRequest = parseSyncRequest(request);
  const fetcher = options.fetcher ?? globalThis.fetch;
  const target = sameOriginUrl(options.endpoint ?? "/api/market/sync", options);
  const response = await fetcher(target.href, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(syncRequest)
  });

  if (!response.ok) {
    throw await errorFromResponse(response, options);
  }

  try {
    return parseMarketSyncResponseJson(await response.text(), {
      maxBytes: options.maxBytes ?? LIVE_INTEGRATION_JSON_MAX_BYTES
    });
  } catch (error) {
    throw validationToAdapterError(error, "upstream-invalid");
  }
}

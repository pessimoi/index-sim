import {
  LIVE_INTEGRATION_JSON_MAX_BYTES,
  LiveIntegrationValidationError,
  PRICE_SET_IMPORT_MAX_BYTES,
  parseIntegrationErrorResponseJson,
  parseMarketStatusResponseJson,
  parseMarketSyncRequest,
  parseMarketSyncResponseJson,
  parsePriceSetJson
} from "@/data/schemas";
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

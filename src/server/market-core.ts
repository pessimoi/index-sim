import {
  MARKET_SOURCE_ID,
  MARKET_SYNC_MAX_ITEMS,
  LiveIntegrationValidationError,
  parseMarketStatusResponse,
  parseMarketSyncRequestJson,
  parseMarketSyncResponse
} from "../data/schemas";
import {
  MARKET_SOURCE_ITEM_ALLOWLIST,
  getMarketSourceMapping
} from "../data/market-source-mapping";
import { expandMarketSyncRequestItems, marketMappingsForItemIds } from "../data/market-sync-items";
import type {
  GameDataSnapshot,
  IntegrationErrorResponse,
  IntegrationWarning,
  MarketItemReport,
  MarketSource,
  MarketSourceMapping,
  MarketStatusResponse,
  MarketSyncRequest,
  MarketSyncResponse,
  PriceSet
} from "../domain/shared";

export const MARKET_API_PATH = "/api/market/sync";
export const MARKET_STATUS_API_PATH = "/api/market/status";
export const MARKET_PROVIDER_TIMEOUT_MS = 6_000;
export const MARKET_SYNC_REQUESTS_PER_SECOND = 1;
export const MARKET_RATE_LIMIT_MAX_CLIENTS = 10_000;

const DISABLED_MARKET_SOURCE: MarketSource = {
  id: "disabled",
  label: "Market provider disabled"
};

const ERROR_MESSAGES: Record<IntegrationErrorResponse["error"]["code"], string> = {
  "bad-request": "Invalid market sync request",
  "not-found": "Market sync target was not found",
  "rate-limited": "Market sync rate limit reached",
  "upstream-unavailable": "Market provider is unavailable",
  "upstream-invalid": "Market provider returned an invalid response",
  "internal-error": "Market sync failed"
};

const ERROR_STATUS: Record<IntegrationErrorResponse["error"]["code"], number> = {
  "bad-request": 400,
  "not-found": 404,
  "rate-limited": 429,
  "upstream-unavailable": 503,
  "upstream-invalid": 502,
  "internal-error": 500
};

export interface MarketProviderSyncContext {
  request: MarketSyncRequest;
  mappings: readonly MarketSourceMapping[];
  signal: AbortSignal;
}

export interface MarketProvider {
  status(): Promise<MarketStatusResponse> | MarketStatusResponse;
  sync(context: MarketProviderSyncContext): Promise<MarketItemReport[]> | MarketItemReport[];
}

export class MarketProviderError extends Error {
  readonly code: IntegrationErrorResponse["error"]["code"];
  readonly retryAfterSeconds?: number;
  readonly warnings?: IntegrationWarning[];

  constructor(
    code: IntegrationErrorResponse["error"]["code"],
    message = ERROR_MESSAGES[code],
    options: { retryAfterSeconds?: number; warnings?: IntegrationWarning[] } = {}
  ) {
    super(message);
    this.name = "MarketProviderError";
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.warnings = options.warnings;
  }
}

export function createDisabledMarketProvider(): MarketProvider {
  return {
    status: () => ({
      available: false,
      source: DISABLED_MARKET_SOURCE,
      cache: { enabled: false },
      limits: {
        maxItemsPerRequest: MARKET_SYNC_MAX_ITEMS,
        requestsPerSecond: MARKET_SYNC_REQUESTS_PER_SECOND
      }
    }),
    sync: () => {
      throw new MarketProviderError("upstream-unavailable");
    }
  };
}

export interface MarketApiRequest {
  method: string;
  url: string;
  body?: string;
  remoteAddress?: string;
}

export interface MarketApiResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface MarketRateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface MarketRateLimiter {
  readonly requestsPerSecond: number;
  check(key: string): MarketRateLimitResult;
}

export interface MarketApiHandlerOptions {
  provider?: MarketProvider;
  gameData?: GameDataSnapshot;
  basePriceSet?: PriceSet;
  rateLimiter?: MarketRateLimiter;
  timeoutMs?: number;
  now?: () => Date;
}

export function createMemoryMarketRateLimiter(
  options: {
    requestsPerSecond?: number;
    windowMs?: number;
    maxEntries?: number;
    now?: () => number;
  } = {}
): MarketRateLimiter {
  const requestsPerSecond = options.requestsPerSecond ?? MARKET_SYNC_REQUESTS_PER_SECOND;
  const windowMs = options.windowMs ?? 1000;
  const maxEntries = options.maxEntries ?? MARKET_RATE_LIMIT_MAX_CLIENTS;
  const now = options.now ?? (() => Date.now());
  const windows = new Map<string, { startedAt: number; count: number }>();

  return {
    requestsPerSecond,
    check(key) {
      const currentTime = now();
      for (const [entryKey, entry] of windows) {
        if (currentTime - entry.startedAt < windowMs) break;
        windows.delete(entryKey);
      }

      const existing = windows.get(key);
      if (!existing || currentTime - existing.startedAt >= windowMs) {
        if (windows.size >= maxEntries) {
          const oldest = windows.values().next().value as
            { startedAt: number; count: number } | undefined;
          return {
            allowed: false,
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((windowMs - (currentTime - (oldest?.startedAt ?? currentTime))) / 1000)
            )
          };
        }
        windows.set(key, { startedAt: currentTime, count: 1 });
        return { allowed: true };
      }

      if (existing.count >= requestsPerSecond) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((windowMs - (currentTime - existing.startedAt)) / 1000)
          )
        };
      }

      existing.count += 1;
      return { allowed: true };
    }
  };
}

function integrationError(
  code: IntegrationErrorResponse["error"]["code"],
  options: { retryAfterSeconds?: number; warnings?: IntegrationWarning[] } = {}
): IntegrationErrorResponse {
  return {
    error: {
      code,
      message: ERROR_MESSAGES[code],
      retryAfterSeconds: options.retryAfterSeconds
    },
    warnings: options.warnings
  };
}

function jsonResponse(
  status: number,
  payload: unknown,
  headers: Record<string, string> = {}
): MarketApiResponse {
  return {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    },
    body: JSON.stringify(payload)
  };
}

function errorResponse(
  code: IntegrationErrorResponse["error"]["code"],
  options: { retryAfterSeconds?: number; warnings?: IntegrationWarning[] } = {}
): MarketApiResponse {
  const headers: Record<string, string> = {};
  if (code === "rate-limited" && options.retryAfterSeconds) {
    headers["Retry-After"] = String(options.retryAfterSeconds);
  }
  return jsonResponse(ERROR_STATUS[code], integrationError(code, options), headers);
}

function requestKey(request: MarketApiRequest): string {
  return request.remoteAddress?.trim() || "same-origin-client";
}

async function withTimeout<T>(
  timeoutMs: number,
  action: (signal: AbortSignal) => Promise<T> | T
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new MarketProviderError("upstream-unavailable"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(action(controller.signal)), timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function providerStatus(provider: MarketProvider, rateLimiter: MarketRateLimiter) {
  const status = parseMarketStatusResponse(await provider.status());
  return {
    ...status,
    limits: {
      maxItemsPerRequest: status.limits.maxItemsPerRequest,
      requestsPerSecond: status.limits.requestsPerSecond ?? rateLimiter.requestsPerSecond
    }
  };
}

function missingMappingWarnings(itemIds: readonly string[]): IntegrationWarning[] {
  return itemIds.map((itemId) => ({
    code: "market-mapping-missing",
    severity: "warning",
    message: "Item is not present in the approved market source mapping",
    itemId
  }));
}

function normalizeProviderReports(
  mappings: readonly MarketSourceMapping[],
  providerReports: readonly MarketItemReport[]
): MarketItemReport[] {
  const expectedMappings = new Map(mappings.map((mapping) => [mapping.itemId, mapping]));
  const reportsByItemId = new Map<string, MarketItemReport>();

  for (const report of providerReports) {
    const mapping = expectedMappings.get(report.itemId);
    if (!mapping) {
      throw new MarketProviderError("upstream-invalid");
    }
    if (report.sourceSlug !== undefined && report.sourceSlug !== mapping.sourceSlug) {
      throw new MarketProviderError("upstream-invalid");
    }
    if (reportsByItemId.has(report.itemId)) {
      throw new MarketProviderError("upstream-invalid");
    }
    reportsByItemId.set(report.itemId, report);
  }

  return mappings.map((mapping) => {
    const report = reportsByItemId.get(mapping.itemId);
    if (report) {
      return {
        ...report,
        sourceSlug: report.sourceSlug ?? mapping.sourceSlug
      };
    }
    return {
      itemId: mapping.itemId,
      sourceSlug: mapping.sourceSlug,
      status: "failed",
      reason: "Provider did not return an item result"
    };
  });
}

function reportCounts(reports: readonly MarketItemReport[]) {
  return {
    updated: reports.filter((report) => report.status === "updated").length,
    skipped: reports.filter((report) => report.status === "skipped").length,
    failed: reports.filter((report) => report.status === "failed").length
  };
}

function createPriceSetFromReports(input: {
  basePriceSet: PriceSet;
  source: MarketSource;
  finishedAt: string;
  reports: readonly MarketItemReport[];
  includeAlch: boolean;
}): PriceSet {
  const itemPrices = { ...input.basePriceSet.itemPrices };
  const alchValues = { ...input.basePriceSet.alchValues };

  for (const report of input.reports) {
    const mapping = getMarketSourceMapping(report.itemId);
    if (!mapping || report.status !== "updated") continue;
    if (mapping.syncPrice && report.price !== undefined) itemPrices[report.itemId] = report.price;
    if (input.includeAlch && mapping.syncAlch && report.alchValue !== undefined) {
      alchValues[report.itemId] = report.alchValue;
    }
  }

  return {
    id: `market-sync-${input.finishedAt.replace(/[^0-9]/g, "").slice(0, 14)}`,
    label: `Market sync ${input.finishedAt}`,
    source: "scraped",
    createdAt: input.finishedAt,
    itemPrices,
    alchValues,
    provenance: {
      source: "scraped",
      sourceRef: input.source.id,
      verifiedAt: input.finishedAt,
      notes: "Created by the same-origin market sync boundary from validated provider item reports."
    }
  };
}

function validateExpandedItemCount(itemIds: readonly string[]): void {
  if (itemIds.length > MARKET_SYNC_MAX_ITEMS) {
    throw new LiveIntegrationValidationError(
      "item_count_exceeded",
      `Market sync request exceeds ${MARKET_SYNC_MAX_ITEMS} items`,
      [`itemIds: expected at most ${MARKET_SYNC_MAX_ITEMS} items after expansion`]
    );
  }
}

export function createMarketApiHandler(options: MarketApiHandlerOptions = {}) {
  const provider = options.provider ?? createDisabledMarketProvider();
  const rateLimiter = options.rateLimiter ?? createMemoryMarketRateLimiter();
  const timeoutMs = options.timeoutMs ?? MARKET_PROVIDER_TIMEOUT_MS;
  const now = options.now ?? (() => new Date());

  return async function handleMarketApiRequest(
    request: MarketApiRequest
  ): Promise<MarketApiResponse | null> {
    const url = new URL(request.url, "http://index-sim.local");

    if (url.pathname !== MARKET_API_PATH && url.pathname !== MARKET_STATUS_API_PATH) {
      return null;
    }

    if (url.pathname === MARKET_STATUS_API_PATH) {
      if (request.method.toUpperCase() !== "GET") {
        return jsonResponse(405, integrationError("bad-request"), { Allow: "GET" });
      }
      try {
        return jsonResponse(
          200,
          await withTimeout(timeoutMs, () => providerStatus(provider, rateLimiter))
        );
      } catch (error) {
        if (error instanceof MarketProviderError) return errorResponse(error.code);
        return errorResponse("upstream-invalid");
      }
    }

    if (request.method.toUpperCase() !== "POST") {
      return jsonResponse(405, integrationError("bad-request"), { Allow: "POST" });
    }

    let syncRequest: MarketSyncRequest;
    try {
      syncRequest = parseMarketSyncRequestJson(request.body ?? "", {
        allowedItemIds: MARKET_SOURCE_ITEM_ALLOWLIST,
        maxItems: MARKET_SYNC_MAX_ITEMS
      });
    } catch (error) {
      if (error instanceof LiveIntegrationValidationError) return errorResponse("bad-request");
      return errorResponse("internal-error");
    }

    const rateLimit = rateLimiter.check(requestKey(request));
    if (!rateLimit.allowed) {
      return errorResponse("rate-limited", {
        retryAfterSeconds: rateLimit.retryAfterSeconds
      });
    }

    if (!options.gameData || !options.basePriceSet) {
      return errorResponse("upstream-unavailable");
    }

    if (
      syncRequest.scope === "monster" &&
      !options.gameData.monsters[syncRequest.monsterId ?? ""]
    ) {
      return errorResponse("not-found");
    }

    try {
      const status = await withTimeout(timeoutMs, () => providerStatus(provider, rateLimiter));
      if (!status.available) return errorResponse("upstream-unavailable");

      const expanded = expandMarketSyncRequestItems(options.gameData, syncRequest);
      validateExpandedItemCount(expanded.itemIds);
      const mappings = marketMappingsForItemIds(expanded.itemIds);
      const startedAt = now().toISOString();
      const providerReports = await withTimeout(timeoutMs, (signal) =>
        provider.sync({ request: syncRequest, mappings, signal })
      );
      const reports = normalizeProviderReports(mappings, providerReports);
      const finishedAt = now().toISOString();
      const counts = reportCounts(reports);
      const warnings = [
        ...missingMappingWarnings(expanded.missingMappingItemIds),
        ...reports
          .filter((report) => report.status === "failed")
          .map((report) => ({
            code: "partial-market-sync",
            severity: "warning" as const,
            message: "Market sync failed for one item; successful prices remain usable",
            itemId: report.itemId
          }))
      ];

      const response: MarketSyncResponse = {
        priceSet: createPriceSetFromReports({
          basePriceSet: options.basePriceSet,
          source: status.source,
          finishedAt,
          reports,
          includeAlch: syncRequest.includeAlch !== false
        }),
        report: {
          requested: reports.length,
          ...counts,
          startedAt,
          finishedAt,
          source:
            status.source.id === "disabled"
              ? { id: MARKET_SOURCE_ID, label: status.source.label }
              : status.source,
          items: reports,
          warnings
        }
      };

      return jsonResponse(200, parseMarketSyncResponse(response));
    } catch (error) {
      if (error instanceof MarketProviderError) {
        return errorResponse(error.code, {
          retryAfterSeconds: error.retryAfterSeconds,
          warnings: error.warnings
        });
      }
      if (error instanceof LiveIntegrationValidationError) {
        return errorResponse(
          error.code === "item_count_exceeded" || error.code === "disallowed_market_items"
            ? "bad-request"
            : "upstream-invalid"
        );
      }
      return errorResponse("internal-error");
    }
  };
}

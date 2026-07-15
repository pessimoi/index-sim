import {
  LiveIntegrationValidationError,
  parseHiscoresLookupRequest,
  parseHiscoresResponse,
  parseHiscoresStatusResponse
} from "../data/schemas";
import type {
  HiscoresLookupRequest,
  HiscoresResponse,
  HiscoresStatusResponse,
  IntegrationErrorResponse,
  IntegrationWarning
} from "../domain/shared";

export const HISCORES_API_PATH = "/api/hiscores";
export const HISCORES_STATUS_API_PATH = "/api/hiscores/status";
export const HISCORES_PROVIDER_TIMEOUT_MS = 4_000;
export const HISCORES_PROVIDER_BUDGET_TIMEOUT_MS = 1_000;
export const HISCORES_LOOKUP_RATE_LIMIT_PER_MINUTE = 30;
export const HISCORES_RATE_LIMIT_MAX_CLIENTS = 10_000;

const DISABLED_HISCORES_STATUS: HiscoresStatusResponse = {
  available: false,
  source: {
    id: "disabled",
    label: "Hiscores provider disabled"
  },
  limits: {
    requestsPerMinute: HISCORES_LOOKUP_RATE_LIMIT_PER_MINUTE
  }
};

const ERROR_MESSAGES: Record<IntegrationErrorResponse["error"]["code"], string> = {
  "bad-request": "Invalid hiscores request",
  "not-found": "Player was not found in hiscores",
  "rate-limited": "Hiscores lookup rate limit reached",
  "upstream-unavailable": "Hiscores provider is unavailable",
  "upstream-invalid": "Hiscores provider returned an invalid response",
  "internal-error": "Hiscores lookup failed"
};

const ERROR_STATUS: Record<IntegrationErrorResponse["error"]["code"], number> = {
  "bad-request": 400,
  "not-found": 404,
  "rate-limited": 429,
  "upstream-unavailable": 503,
  "upstream-invalid": 502,
  "internal-error": 500
};

export interface HiscoresProviderLookupContext {
  signal: AbortSignal;
}

export interface HiscoresProvider {
  status(): Promise<HiscoresStatusResponse> | HiscoresStatusResponse;
  lookup(
    request: HiscoresLookupRequest,
    context: HiscoresProviderLookupContext
  ): Promise<HiscoresResponse> | HiscoresResponse;
}

export class HiscoresProviderError extends Error {
  readonly code: IntegrationErrorResponse["error"]["code"];
  readonly retryAfterSeconds?: number;
  readonly warnings?: IntegrationWarning[];

  constructor(
    code: IntegrationErrorResponse["error"]["code"],
    message = ERROR_MESSAGES[code],
    options: { retryAfterSeconds?: number; warnings?: IntegrationWarning[] } = {}
  ) {
    super(message);
    this.name = "HiscoresProviderError";
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.warnings = options.warnings;
  }
}

export function createDisabledHiscoresProvider(): HiscoresProvider {
  return {
    status: () => DISABLED_HISCORES_STATUS,
    lookup: () => {
      throw new HiscoresProviderError("upstream-unavailable");
    }
  };
}

export interface HiscoresApiRequest {
  method: string;
  url: string;
  remoteAddress?: string;
}

export interface HiscoresApiResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface HiscoresRateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface HiscoresRateLimiter {
  readonly requestsPerMinute: number;
  check(key: string): HiscoresRateLimitResult;
}

export interface HiscoresProviderBudgetGate {
  check(): Promise<HiscoresRateLimitResult>;
}

export interface HiscoresApiHandlerOptions {
  provider?: HiscoresProvider;
  rateLimiter?: HiscoresRateLimiter;
  providerBudgetGate?: HiscoresProviderBudgetGate;
  providerBudgetTimeoutMs?: number;
  timeoutMs?: number;
}

export function createMemoryHiscoresRateLimiter(
  options: {
    requestsPerMinute?: number;
    windowMs?: number;
    maxEntries?: number;
    now?: () => number;
  } = {}
): HiscoresRateLimiter {
  const requestsPerMinute = options.requestsPerMinute ?? HISCORES_LOOKUP_RATE_LIMIT_PER_MINUTE;
  const windowMs = options.windowMs ?? 60_000;
  const maxEntries = options.maxEntries ?? HISCORES_RATE_LIMIT_MAX_CLIENTS;
  const now = options.now ?? (() => Date.now());
  const windows = new Map<string, { startedAt: number; count: number }>();

  return {
    requestsPerMinute,
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

      if (existing.count >= requestsPerMinute) {
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
): HiscoresApiResponse {
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
): HiscoresApiResponse {
  const headers: Record<string, string> = {};
  if (code === "rate-limited" && options.retryAfterSeconds) {
    headers["Retry-After"] = String(options.retryAfterSeconds);
  }
  return jsonResponse(ERROR_STATUS[code], integrationError(code, options), headers);
}

function requestKey(request: HiscoresApiRequest): string {
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
      reject(new HiscoresProviderError("upstream-unavailable"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(action(controller.signal)), timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

async function providerStatus(provider: HiscoresProvider, requestsPerMinute: number) {
  const status = parseHiscoresStatusResponse(await provider.status());
  return {
    ...status,
    limits: {
      ...status.limits,
      requestsPerMinute: status.limits?.requestsPerMinute ?? requestsPerMinute
    }
  };
}

export function createHiscoresApiHandler(options: HiscoresApiHandlerOptions = {}) {
  const provider = options.provider ?? createDisabledHiscoresProvider();
  const rateLimiter = options.rateLimiter ?? createMemoryHiscoresRateLimiter();
  const providerBudgetGate = options.providerBudgetGate ?? {
    check: async () => ({ allowed: true })
  };
  const providerBudgetTimeoutMs =
    options.providerBudgetTimeoutMs ?? HISCORES_PROVIDER_BUDGET_TIMEOUT_MS;
  const timeoutMs = options.timeoutMs ?? HISCORES_PROVIDER_TIMEOUT_MS;

  return async function handleHiscoresApiRequest(
    request: HiscoresApiRequest
  ): Promise<HiscoresApiResponse | null> {
    const url = new URL(request.url, "http://index-sim.local");

    if (url.pathname !== HISCORES_API_PATH && url.pathname !== HISCORES_STATUS_API_PATH) {
      return null;
    }

    if (request.method.toUpperCase() !== "GET") {
      return jsonResponse(405, integrationError("bad-request"), { Allow: "GET" });
    }

    if (url.pathname === HISCORES_STATUS_API_PATH) {
      try {
        return jsonResponse(
          200,
          await withTimeout(timeoutMs, () =>
            providerStatus(provider, rateLimiter.requestsPerMinute)
          )
        );
      } catch (error) {
        if (error instanceof HiscoresProviderError) return errorResponse(error.code);
        return errorResponse("upstream-invalid");
      }
    }

    let lookupRequest: HiscoresLookupRequest;
    try {
      lookupRequest = parseHiscoresLookupRequest({ player: url.searchParams.get("player") ?? "" });
    } catch (error) {
      if (error instanceof LiveIntegrationValidationError) {
        return errorResponse("bad-request");
      }
      return errorResponse("internal-error");
    }

    const rateLimit = rateLimiter.check(requestKey(request));
    if (!rateLimit.allowed) {
      return errorResponse("rate-limited", {
        retryAfterSeconds: rateLimit.retryAfterSeconds
      });
    }

    let providerBudget: HiscoresRateLimitResult;
    try {
      providerBudget = await withTimeout(providerBudgetTimeoutMs, () => providerBudgetGate.check());
    } catch {
      return errorResponse("upstream-unavailable");
    }
    if (!providerBudget.allowed) {
      return errorResponse("rate-limited", {
        retryAfterSeconds: providerBudget.retryAfterSeconds
      });
    }

    try {
      const response = await withTimeout(timeoutMs, (signal) =>
        provider.lookup(lookupRequest, { signal })
      );
      return jsonResponse(200, parseHiscoresResponse(response));
    } catch (error) {
      if (error instanceof HiscoresProviderError) {
        return errorResponse(error.code, {
          retryAfterSeconds: error.retryAfterSeconds,
          warnings: error.warnings
        });
      }
      if (error instanceof LiveIntegrationValidationError) {
        return errorResponse("upstream-invalid");
      }
      return errorResponse("internal-error");
    }
  };
}

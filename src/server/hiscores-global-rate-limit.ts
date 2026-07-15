import type { HiscoresProviderBudgetGate, HiscoresRateLimitResult } from "./hiscores-core";

export const HISCORES_GLOBAL_RATE_LIMIT_MODE_VAR = "HISCORES_GLOBAL_RATE_LIMIT_MODE";
export const HISCORES_GLOBAL_RATE_LIMIT_REQUESTS_PER_MINUTE_VAR =
  "HISCORES_GLOBAL_RATE_LIMIT_REQUESTS_PER_MINUTE";
export const HISCORES_GLOBAL_RATE_LIMIT_BINDING = "HISCORES_GLOBAL_RATE_LIMITER";
export const HISCORES_GLOBAL_RATE_LIMIT_OBJECT_NAME = "lostcity-hiscores-provider-budget-v1";
export const HISCORES_GLOBAL_RATE_LIMIT_PERIOD_MS = 60_000;

const HISCORES_GLOBAL_RATE_LIMIT_MAX_REQUESTS_PER_MINUTE = 1_000_000;
const HISCORES_GLOBAL_RATE_LIMIT_REQUEST_MAX_BYTES = 256;
const HISCORES_GLOBAL_RATE_LIMIT_RESPONSE_MAX_BYTES = 512;
const HISCORES_GLOBAL_RATE_LIMIT_STATE_KEY = "hiscores-provider-budget-v1";

interface HiscoresGlobalRateLimitState {
  version: 1;
  windowStartedAtMs: number;
  used: number;
  requestsPerMinute: number;
}

export interface CloudflareDurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface CloudflareDurableObjectNamespace {
  getByName(name: string): CloudflareDurableObjectStub;
}

export interface CloudflareHiscoresGlobalRateLimitEnvironment {
  HISCORES_GLOBAL_RATE_LIMIT_MODE?: string;
  HISCORES_GLOBAL_RATE_LIMIT_REQUESTS_PER_MINUTE?: string | number;
  HISCORES_GLOBAL_RATE_LIMITER?: CloudflareDurableObjectNamespace;
}

export interface CloudflareDurableObjectTransaction {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

export interface CloudflareDurableObjectStorage {
  transaction<T>(
    closure: (transaction: CloudflareDurableObjectTransaction) => Promise<T>
  ): Promise<T>;
}

export interface CloudflareDurableObjectState {
  storage: CloudflareDurableObjectStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequestsPerMinute(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed <= 0 ||
    parsed > HISCORES_GLOBAL_RATE_LIMIT_MAX_REQUESTS_PER_MINUTE
  ) {
    throw new Error("Invalid Hiscores global rate-limit configuration");
  }
  return parsed;
}

function parseStoredState(value: unknown): HiscoresGlobalRateLimitState {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.windowStartedAtMs) ||
    (value.windowStartedAtMs as number) < 0 ||
    !Number.isSafeInteger(value.used) ||
    (value.used as number) < 0 ||
    !Number.isSafeInteger(value.requestsPerMinute) ||
    (value.requestsPerMinute as number) <= 0
  ) {
    throw new Error("Invalid Hiscores global rate-limit state");
  }
  return value as unknown as HiscoresGlobalRateLimitState;
}

function parseDecision(value: unknown): HiscoresRateLimitResult {
  if (!isRecord(value) || typeof value.allowed !== "boolean") {
    throw new Error("Invalid Hiscores global rate-limit response");
  }
  if (value.allowed) return { allowed: true };
  if (
    !Number.isSafeInteger(value.retryAfterSeconds) ||
    (value.retryAfterSeconds as number) <= 0 ||
    (value.retryAfterSeconds as number) > HISCORES_GLOBAL_RATE_LIMIT_PERIOD_MS / 1_000
  ) {
    throw new Error("Invalid Hiscores global rate-limit response");
  }
  return {
    allowed: false,
    retryAfterSeconds: value.retryAfterSeconds as number
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function consumeHiscoresGlobalProviderBudget(
  storage: CloudflareDurableObjectStorage,
  requestsPerMinute: number,
  nowMs: number
): Promise<HiscoresRateLimitResult> {
  const limit = parseRequestsPerMinute(requestsPerMinute);
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new Error("Invalid Hiscores global rate-limit clock");
  }

  return storage.transaction(async (transaction) => {
    const storedValue = await transaction.get<unknown>(HISCORES_GLOBAL_RATE_LIMIT_STATE_KEY);
    if (storedValue === undefined) {
      await transaction.put<HiscoresGlobalRateLimitState>(HISCORES_GLOBAL_RATE_LIMIT_STATE_KEY, {
        version: 1,
        windowStartedAtMs: nowMs,
        used: 1,
        requestsPerMinute: limit
      });
      return { allowed: true };
    }

    const stored = parseStoredState(storedValue);
    if (nowMs < stored.windowStartedAtMs) {
      throw new Error("Hiscores global rate-limit clock moved backwards");
    }
    if (nowMs - stored.windowStartedAtMs >= HISCORES_GLOBAL_RATE_LIMIT_PERIOD_MS) {
      await transaction.put<HiscoresGlobalRateLimitState>(HISCORES_GLOBAL_RATE_LIMIT_STATE_KEY, {
        version: 1,
        windowStartedAtMs: nowMs,
        used: 1,
        requestsPerMinute: limit
      });
      return { allowed: true };
    }
    if (stored.used >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            (HISCORES_GLOBAL_RATE_LIMIT_PERIOD_MS - (nowMs - stored.windowStartedAtMs)) / 1_000
          )
        )
      };
    }

    await transaction.put<HiscoresGlobalRateLimitState>(HISCORES_GLOBAL_RATE_LIMIT_STATE_KEY, {
      version: 1,
      windowStartedAtMs: stored.windowStartedAtMs,
      used: stored.used + 1,
      requestsPerMinute: limit
    });
    return { allowed: true };
  });
}

export function createCloudflareHiscoresProviderBudgetGate(
  environment: CloudflareHiscoresGlobalRateLimitEnvironment
): HiscoresProviderBudgetGate {
  const mode = environment.HISCORES_GLOBAL_RATE_LIMIT_MODE?.trim() || "off";
  if (mode === "off") {
    return { check: async () => ({ allowed: true }) };
  }

  return {
    async check() {
      if (mode !== "enforce") {
        throw new Error("Invalid Hiscores global rate-limit mode");
      }
      const requestsPerMinute = parseRequestsPerMinute(
        environment.HISCORES_GLOBAL_RATE_LIMIT_REQUESTS_PER_MINUTE
      );
      const namespace = environment.HISCORES_GLOBAL_RATE_LIMITER;
      if (!namespace) {
        throw new Error("Missing Hiscores global rate-limit binding");
      }

      const response = await namespace
        .getByName(HISCORES_GLOBAL_RATE_LIMIT_OBJECT_NAME)
        .fetch("https://hiscores-global-rate-limit.internal/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestsPerMinute })
        });
      if (!response.ok) {
        throw new Error("Hiscores global rate-limit coordinator failed");
      }
      const body = await response.text();
      if (
        new TextEncoder().encode(body).byteLength > HISCORES_GLOBAL_RATE_LIMIT_RESPONSE_MAX_BYTES
      ) {
        throw new Error("Hiscores global rate-limit response was too large");
      }
      try {
        return parseDecision(JSON.parse(body) as unknown);
      } catch {
        throw new Error("Invalid Hiscores global rate-limit response");
      }
    }
  };
}

export class HiscoresGlobalRateLimit {
  constructor(private readonly state: CloudflareDurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/check") {
      return jsonResponse({ error: "not-found" }, 404);
    }

    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > HISCORES_GLOBAL_RATE_LIMIT_REQUEST_MAX_BYTES) {
      return jsonResponse({ error: "bad-request" }, 400);
    }

    let requestsPerMinute: number;
    try {
      const input = JSON.parse(body) as unknown;
      if (!isRecord(input) || Object.keys(input).length !== 1 || !("requestsPerMinute" in input)) {
        throw new Error("Invalid coordinator request");
      }
      requestsPerMinute = parseRequestsPerMinute(input.requestsPerMinute);
    } catch {
      return jsonResponse({ error: "bad-request" }, 400);
    }

    return jsonResponse(
      await consumeHiscoresGlobalProviderBudget(this.state.storage, requestsPerMinute, Date.now())
    );
  }
}

import { z } from "zod";
import type { KeyValueStorage } from "@/adapters/storage";
import { loadPersisted, savePersisted } from "@/adapters/storage";
import {
  HiscoresPlayerNameSchema,
  LIVE_INTEGRATION_JSON_MAX_BYTES,
  LiveIntegrationValidationError,
  parseHiscoresLookupRequest,
  parseHiscoresResponseJson,
  parseHiscoresStatusResponseJson,
  parseIntegrationErrorResponseJson
} from "@/data/schemas";
import type {
  HiscoresLookupRequest,
  HiscoresResponse,
  HiscoresStatusResponse,
  IntegrationErrorResponse
} from "@/domain/shared";
import {
  ResponseBodyTooLargeError,
  readBoundedResponseText
} from "@/adapters/browser/bounded-response";

export const HISCORES_LAST_PLAYER_STORAGE_KEY = "index-sim:hiscores:last-player";
export const HISCORES_LAST_PLAYER_STORAGE_VERSION = 1;

type Fetcher = typeof fetch;

const LastHiscoresPlayerSchema = z
  .object({
    player: HiscoresPlayerNameSchema
  })
  .strict();

export interface HiscoresFetchOptions {
  fetcher?: Fetcher;
  endpoint?: string;
  baseUrl?: string;
  allowedOrigin?: string;
  maxBytes?: number;
}

export class HiscoresAdapterError extends Error {
  readonly code: IntegrationErrorResponse["error"]["code"];
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: IntegrationErrorResponse["error"]["code"],
    message: string,
    options: { status?: number; retryAfterSeconds?: number } = {}
  ) {
    super(message);
    this.name = "HiscoresAdapterError";
    this.code = code;
    this.status = options.status ?? 0;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

function browserBaseUrl(options: Pick<HiscoresFetchOptions, "baseUrl">): string {
  return options.baseUrl ?? globalThis.location?.href ?? "http://localhost/";
}

function sameOriginUrl(path: string, options: HiscoresFetchOptions): URL {
  const baseUrl = browserBaseUrl(options);
  const target = new URL(path, baseUrl);
  const allowedOrigin = options.allowedOrigin ?? new URL(baseUrl).origin;

  if (target.origin !== allowedOrigin) {
    throw new HiscoresAdapterError("bad-request", "Refusing cross-origin hiscores request");
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
    return new HiscoresAdapterError(fallbackCode, "Invalid hiscores API response");
  }
  if (error instanceof ResponseBodyTooLargeError) {
    return new HiscoresAdapterError(fallbackCode, "Invalid hiscores API response");
  }
  return error;
}

function parseLookupRequest(player: string): HiscoresLookupRequest {
  try {
    return parseHiscoresLookupRequest({ player });
  } catch (error) {
    if (error instanceof LiveIntegrationValidationError) {
      throw new HiscoresAdapterError("bad-request", "Invalid player name");
    }
    throw error;
  }
}

async function errorFromResponse(
  response: Response,
  options: Pick<HiscoresFetchOptions, "maxBytes">
): Promise<HiscoresAdapterError> {
  const fallbackCode = adapterErrorFromStatus(response.status);
  try {
    const maxBytes = options.maxBytes ?? LIVE_INTEGRATION_JSON_MAX_BYTES;
    const parsed = parseIntegrationErrorResponseJson(
      await readBoundedResponseText(response, maxBytes),
      {
        maxBytes
      }
    );
    return new HiscoresAdapterError(parsed.error.code, parsed.error.message, {
      status: response.status,
      retryAfterSeconds: parsed.error.retryAfterSeconds
    });
  } catch {
    return new HiscoresAdapterError(fallbackCode, "Hiscores request failed", {
      status: response.status
    });
  }
}

export async function fetchHiscoresStatus(
  options: HiscoresFetchOptions = {}
): Promise<HiscoresStatusResponse> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  const target = sameOriginUrl(options.endpoint ?? "/api/hiscores/status", options);
  const response = await fetcher(target.href, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw await errorFromResponse(response, options);
  }

  try {
    const maxBytes = options.maxBytes ?? LIVE_INTEGRATION_JSON_MAX_BYTES;
    return parseHiscoresStatusResponseJson(await readBoundedResponseText(response, maxBytes), {
      maxBytes
    });
  } catch (error) {
    throw validationToAdapterError(error, "upstream-invalid");
  }
}

export async function lookupHiscores(
  player: string,
  options: HiscoresFetchOptions = {}
): Promise<HiscoresResponse> {
  const request = parseLookupRequest(player);
  const fetcher = options.fetcher ?? globalThis.fetch;
  const target = sameOriginUrl(options.endpoint ?? "/api/hiscores", options);
  target.searchParams.set("player", request.player);

  const response = await fetcher(target.href, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw await errorFromResponse(response, options);
  }

  try {
    const maxBytes = options.maxBytes ?? LIVE_INTEGRATION_JSON_MAX_BYTES;
    return parseHiscoresResponseJson(await readBoundedResponseText(response, maxBytes), {
      maxBytes
    });
  } catch (error) {
    throw validationToAdapterError(error, "upstream-invalid");
  }
}

export function loadLastHiscoresPlayer(storage: KeyValueStorage): string {
  const result = loadPersisted({
    key: HISCORES_LAST_PLAYER_STORAGE_KEY,
    version: HISCORES_LAST_PLAYER_STORAGE_VERSION,
    schema: LastHiscoresPlayerSchema,
    storage
  });
  return result.status === "loaded" ? result.value.player : "";
}

export function saveLastHiscoresPlayer(storage: KeyValueStorage, player: string): void {
  const request = parseLookupRequest(player);
  savePersisted(
    {
      key: HISCORES_LAST_PLAYER_STORAGE_KEY,
      version: HISCORES_LAST_PLAYER_STORAGE_VERSION,
      schema: LastHiscoresPlayerSchema,
      storage
    },
    { player: request.player }
  );
}

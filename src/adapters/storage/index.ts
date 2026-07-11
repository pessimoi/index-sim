import { z } from "zod";
import { DataReliabilityError, parseJsonWithDuplicateKeyCheck } from "../../data/reliability";

export const DEFAULT_PERSISTED_STATE_MAX_BYTES = 5_000_000;

export interface PersistedEnvelope<T> {
  version: number;
  savedAt: string;
  data: T;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface VersionedStorageOptions<T> {
  key: string;
  version: number;
  schema: z.ZodType<T>;
  storage: KeyValueStorage;
  now?: () => Date;
  maxBytes?: number;
}

export type LoadPersistedResult<T> =
  | { status: "missing"; value: null }
  | { status: "loaded"; value: T; envelope: PersistedEnvelope<T> }
  | { status: "version-mismatch"; value: null; foundVersion: number }
  | {
      status: "invalid";
      value: null;
      reason:
        "body_too_large" | "duplicate_keys" | "invalid_json" | "invalid_envelope" | "invalid_data";
    }
  | { status: "unavailable"; value: null; reason: "read_failed" };

export type SavePersistedResult<T> =
  { status: "saved"; envelope: PersistedEnvelope<T> } | { status: "failed"; reason: "save_failed" };

export type ClearPersistedResult =
  { status: "cleared" } | { status: "failed"; reason: "clear_failed" };

const EnvelopeSchema = z
  .object({
    version: z.number().int().positive(),
    savedAt: z.string().min(1),
    data: z.unknown()
  })
  .strict();

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function loadPersisted<T>(options: VersionedStorageOptions<T>): LoadPersistedResult<T> {
  let raw: string | null;
  try {
    raw = options.storage.getItem(options.key);
  } catch {
    return { status: "unavailable", value: null, reason: "read_failed" };
  }
  if (!raw) return { status: "missing", value: null };
  if (byteLength(raw) > (options.maxBytes ?? DEFAULT_PERSISTED_STATE_MAX_BYTES)) {
    return { status: "invalid", value: null, reason: "body_too_large" };
  }

  let parsed: unknown;
  try {
    parsed = parseJsonWithDuplicateKeyCheck(raw, { source: "Persisted browser state" });
  } catch (error) {
    if (error instanceof DataReliabilityError && error.code === "duplicate_keys") {
      return { status: "invalid", value: null, reason: "duplicate_keys" };
    }
    return { status: "invalid", value: null, reason: "invalid_json" };
  }

  const envelopeResult = EnvelopeSchema.safeParse(parsed);
  if (!envelopeResult.success) {
    return { status: "invalid", value: null, reason: "invalid_envelope" };
  }

  const envelope = envelopeResult.data;
  if (envelope.version !== options.version) {
    return { status: "version-mismatch", value: null, foundVersion: envelope.version };
  }

  const dataResult = options.schema.safeParse(envelope.data);
  if (!dataResult.success) {
    return { status: "invalid", value: null, reason: "invalid_data" };
  }

  return {
    status: "loaded",
    value: dataResult.data,
    envelope: {
      version: envelope.version,
      savedAt: envelope.savedAt,
      data: dataResult.data
    }
  };
}

function createPersistedEnvelope<T>(
  options: VersionedStorageOptions<T>,
  value: T
): PersistedEnvelope<T> {
  const data = options.schema.parse(value);
  return {
    version: options.version,
    savedAt: (options.now ?? (() => new Date()))().toISOString(),
    data
  };
}

export function savePersisted<T>(
  options: VersionedStorageOptions<T>,
  value: T
): PersistedEnvelope<T> {
  const envelope = createPersistedEnvelope(options, value);
  options.storage.setItem(options.key, JSON.stringify(envelope));
  return envelope;
}

export function trySavePersisted<T>(
  options: VersionedStorageOptions<T>,
  value: T
): SavePersistedResult<T> {
  const envelope = createPersistedEnvelope(options, value);
  const serialized = JSON.stringify(envelope);
  try {
    options.storage.setItem(options.key, serialized);
    return { status: "saved", envelope };
  } catch {
    return { status: "failed", reason: "save_failed" };
  }
}

export function clearPersisted(
  options: Pick<VersionedStorageOptions<unknown>, "key" | "storage">
): void {
  options.storage.removeItem(options.key);
}

export function tryClearPersisted(
  options: Pick<VersionedStorageOptions<unknown>, "key" | "storage">
): ClearPersistedResult {
  try {
    clearPersisted(options);
    return { status: "cleared" };
  } catch {
    return { status: "failed", reason: "clear_failed" };
  }
}

export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    }
  };
}

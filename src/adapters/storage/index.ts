import { z } from "zod";

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
}

export type LoadPersistedResult<T> =
  | { status: "missing"; value: null }
  | { status: "loaded"; value: T; envelope: PersistedEnvelope<T> }
  | { status: "version-mismatch"; value: null; foundVersion: number }
  | { status: "invalid"; value: null; reason: string };

const EnvelopeSchema = z
  .object({
    version: z.number().int().positive(),
    savedAt: z.string().min(1),
    data: z.unknown()
  })
  .strict();

export function loadPersisted<T>(options: VersionedStorageOptions<T>): LoadPersistedResult<T> {
  const raw = options.storage.getItem(options.key);
  if (!raw) return { status: "missing", value: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
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

export function savePersisted<T>(
  options: VersionedStorageOptions<T>,
  value: T
): PersistedEnvelope<T> {
  const data = options.schema.parse(value);
  const envelope: PersistedEnvelope<T> = {
    version: options.version,
    savedAt: (options.now ?? (() => new Date()))().toISOString(),
    data
  };
  options.storage.setItem(options.key, JSON.stringify(envelope));
  return envelope;
}

export function clearPersisted(
  options: Pick<VersionedStorageOptions<unknown>, "key" | "storage">
): void {
  options.storage.removeItem(options.key);
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

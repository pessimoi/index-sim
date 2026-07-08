import { z } from "zod";
import { PRICE_SET_IMPORT_MAX_BYTES, PriceSetSchema } from "@/data/schemas";
import type { PriceSet } from "@/domain/shared";
import {
  clearPersisted,
  loadPersisted,
  savePersisted,
  type KeyValueStorage,
  type PersistedEnvelope
} from "@/adapters/storage";

export const SELECTED_PRICE_SET_STORAGE_KEY = "index-sim:price-set:selected";
export const SELECTED_PRICE_SET_VERSION = 1;

const IsoTimestampSchema = z.string().min(1).refine((value) => Number.isFinite(Date.parse(value)), {
  message: "Expected an ISO timestamp"
});

export const SelectedPriceSetStateSchema = z
  .object({
    priceSet: PriceSetSchema,
    selectedAt: IsoTimestampSchema
  })
  .strict();

export type SelectedPriceSetState = z.infer<typeof SelectedPriceSetStateSchema>;

export type LoadSelectedPriceSetResult =
  | { status: "missing"; value: null }
  | {
      status: "loaded";
      value: SelectedPriceSetState;
      envelope: PersistedEnvelope<SelectedPriceSetState>;
    }
  | { status: "version-mismatch"; value: null; foundVersion: number }
  | {
      status: "invalid";
      value: null;
      reason: "body_too_large" | "invalid_json" | "invalid_envelope" | "invalid_data";
    }
  | { status: "unavailable"; value: null; reason: "read_failed" };

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function selectedPriceSetStorageOptions(storage: KeyValueStorage, now?: () => Date) {
  return {
    key: SELECTED_PRICE_SET_STORAGE_KEY,
    version: SELECTED_PRICE_SET_VERSION,
    schema: SelectedPriceSetStateSchema,
    storage,
    now
  };
}

export function loadSelectedPriceSet(storage: KeyValueStorage): LoadSelectedPriceSetResult {
  let raw: string | null;
  try {
    raw = storage.getItem(SELECTED_PRICE_SET_STORAGE_KEY);
  } catch {
    return { status: "unavailable", value: null, reason: "read_failed" };
  }
  if (!raw) return { status: "missing", value: null };
  if (byteLength(raw) > PRICE_SET_IMPORT_MAX_BYTES) {
    return { status: "invalid", value: null, reason: "body_too_large" };
  }

  const loaded = loadPersisted(selectedPriceSetStorageOptions(storage));
  if (loaded.status === "loaded") {
    return loaded;
  }
  if (loaded.status === "version-mismatch") {
    return loaded;
  }
  if (loaded.status === "unavailable") {
    return loaded;
  }
  if (loaded.status === "invalid") {
    return {
      status: "invalid",
      value: null,
      reason:
        loaded.reason === "invalid_json" ||
        loaded.reason === "invalid_envelope" ||
        loaded.reason === "invalid_data"
          ? loaded.reason
          : "invalid_data"
    };
  }
  return loaded;
}

export function saveSelectedPriceSet(
  storage: KeyValueStorage,
  priceSet: PriceSet,
  options: { now?: () => Date } = {}
): PersistedEnvelope<SelectedPriceSetState> {
  return savePersisted(selectedPriceSetStorageOptions(storage, options.now), {
    priceSet,
    selectedAt: (options.now ?? (() => new Date()))().toISOString()
  });
}

export function clearSelectedPriceSet(storage: KeyValueStorage): void {
  clearPersisted({ key: SELECTED_PRICE_SET_STORAGE_KEY, storage });
}

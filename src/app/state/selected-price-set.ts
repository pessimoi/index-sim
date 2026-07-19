import { z } from "zod";
import {
  PRICE_SET_IMPORT_MAX_BYTES,
  PriceSetSchema,
  normalizePriceSetItemMetadata
} from "@/data/schemas";
import type { PriceSet } from "@/domain/shared";
import {
  clearPersisted,
  loadPersisted,
  savePersisted,
  type KeyValueStorage,
  type PersistedEnvelope
} from "@/adapters/storage";

export const SELECTED_PRICE_SET_STORAGE_KEY = "index-sim:price-set:selected";
export const SELECTED_PRICE_SET_VERSION = 2;

const IsoTimestampSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), {
    message: "Expected an ISO timestamp"
  });

export const SelectedPriceSetStateSchema = z
  .object({
    priceSet: PriceSetSchema,
    selectedAt: IsoTimestampSchema
  })
  .strict()
  .superRefine((state, ctx) => {
    const priceKeys = Object.keys(state.priceSet.itemPrices).sort();
    const metadataKeys = Object.keys(state.priceSet.itemPriceMetadata ?? {}).sort();
    if (JSON.stringify(priceKeys) !== JSON.stringify(metadataKeys)) {
      ctx.addIssue({
        code: "custom",
        path: ["priceSet", "itemPriceMetadata"],
        message: "selected PriceSet requires metadata for every item price"
      });
    }
  });

const SelectedPriceSetStateV1Schema = z
  .object({
    priceSet: PriceSetSchema,
    selectedAt: IsoTimestampSchema
  })
  .strict();

export type SelectedPriceSetState = z.infer<typeof SelectedPriceSetStateSchema>;

/** Canonical logical value used by aggregate transfers, without persistence metadata. */
export const SelectedPriceSetValueSchema: z.ZodType<PriceSet | null> =
  PriceSetSchema.nullable().transform((priceSet) =>
    priceSet === null ? null : normalizePriceSetItemMetadata(priceSet)
  );

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
      reason:
        "body_too_large" | "duplicate_keys" | "invalid_json" | "invalid_envelope" | "invalid_data";
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
  if (loaded.status === "version-mismatch" && loaded.foundVersion === 1) {
    const legacy = loadPersisted({
      key: SELECTED_PRICE_SET_STORAGE_KEY,
      version: 1,
      schema: SelectedPriceSetStateV1Schema,
      storage
    });
    if (legacy.status === "loaded") {
      const value = SelectedPriceSetStateSchema.parse({
        ...legacy.value,
        priceSet: normalizePriceSetItemMetadata(legacy.value.priceSet as PriceSet, {
          fallbackOrigin: "imported",
          fallbackReasonCode: "import-metadata-unavailable"
        })
      });
      try {
        const envelope = savePersisted(selectedPriceSetStorageOptions(storage), value);
        return { status: "loaded", value, envelope };
      } catch {
        return {
          status: "loaded",
          value,
          envelope: {
            version: SELECTED_PRICE_SET_VERSION,
            savedAt: legacy.envelope.savedAt,
            data: value
          }
        };
      }
    }
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
        loaded.reason === "duplicate_keys" ||
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
    priceSet: normalizePriceSetItemMetadata(priceSet),
    selectedAt: (options.now ?? (() => new Date()))().toISOString()
  });
}

export function clearSelectedPriceSet(storage: KeyValueStorage): void {
  clearPersisted({ key: SELECTED_PRICE_SET_STORAGE_KEY, storage });
}

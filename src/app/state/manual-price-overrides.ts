import { z } from "zod";
import {
  EntityIdSchema,
  NonNegativeNumberSchema,
  PriceSetSchema,
  normalizePriceSetItemMetadata
} from "@/data/schemas";
import type { PriceSet } from "@/domain/shared";
import {
  clearPersisted,
  loadPersisted,
  savePersisted,
  type KeyValueStorage,
  type LoadPersistedResult,
  type PersistedEnvelope
} from "@/adapters/storage";

export const MANUAL_PRICE_OVERRIDES_STORAGE_KEY = "index-sim:manual-price-overrides";
export const MANUAL_PRICE_OVERRIDES_VERSION = 1;
export const MANUAL_PRICE_OVERRIDES_MAX_ITEMS = 512;

const IsoTimestampSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid timestamp");

export const ManualPriceOverrideSchema = z
  .object({
    price: NonNegativeNumberSchema.max(1_000_000_000_000),
    updatedAt: IsoTimestampSchema
  })
  .strict();

export const ManualPriceOverridesStateSchema = z
  .object({
    items: z
      .record(EntityIdSchema, ManualPriceOverrideSchema)
      .refine(
        (items) => Object.keys(items).length <= MANUAL_PRICE_OVERRIDES_MAX_ITEMS,
        `At most ${MANUAL_PRICE_OVERRIDES_MAX_ITEMS} manual item prices can be stored`
      )
  })
  .strict();

export type ManualPriceOverride = z.infer<typeof ManualPriceOverrideSchema>;
export type ManualPriceOverridesState = z.infer<typeof ManualPriceOverridesStateSchema>;

export const DEFAULT_MANUAL_PRICE_OVERRIDES_STATE: ManualPriceOverridesState = { items: {} };

function storageOptions(storage: KeyValueStorage, now?: () => Date) {
  return {
    key: MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
    version: MANUAL_PRICE_OVERRIDES_VERSION,
    schema: ManualPriceOverridesStateSchema,
    storage,
    now
  };
}

export function loadManualPriceOverrides(
  storage: KeyValueStorage
): LoadPersistedResult<ManualPriceOverridesState> {
  return loadPersisted(storageOptions(storage));
}

export function saveManualPriceOverrides(
  storage: KeyValueStorage,
  state: ManualPriceOverridesState,
  options: { now?: () => Date } = {}
): PersistedEnvelope<ManualPriceOverridesState> | null {
  const parsed = ManualPriceOverridesStateSchema.parse(state);
  if (Object.keys(parsed.items).length === 0) {
    clearPersisted({ key: MANUAL_PRICE_OVERRIDES_STORAGE_KEY, storage });
    return null;
  }
  return savePersisted(storageOptions(storage, options.now), parsed);
}

export function setManualPriceOverride(
  state: ManualPriceOverridesState,
  itemId: string,
  price: number,
  updatedAt: Date
): ManualPriceOverridesState {
  return ManualPriceOverridesStateSchema.parse({
    items: {
      ...state.items,
      [EntityIdSchema.parse(itemId)]: {
        price,
        updatedAt: updatedAt.toISOString()
      }
    }
  });
}

export function canSetManualPriceOverride(
  state: ManualPriceOverridesState,
  itemId: string
): boolean {
  return (
    state.items[itemId] !== undefined ||
    Object.keys(state.items).length < MANUAL_PRICE_OVERRIDES_MAX_ITEMS
  );
}

export function removeManualPriceOverride(
  state: ManualPriceOverridesState,
  itemId: string
): ManualPriceOverridesState {
  if (!state.items[itemId]) return state;
  const items = { ...state.items };
  delete items[itemId];
  return ManualPriceOverridesStateSchema.parse({ items });
}

export function activeManualPriceOverridesForPriceSet(
  state: ManualPriceOverridesState,
  basePriceSet: PriceSet
): ManualPriceOverridesState {
  return ManualPriceOverridesStateSchema.parse({
    items: Object.fromEntries(
      Object.entries(state.items).filter(
        ([itemId]) => basePriceSet.itemPrices[itemId] !== undefined
      )
    )
  });
}

export function applyManualPriceOverrides(
  basePriceSet: PriceSet,
  state: ManualPriceOverridesState
): PriceSet {
  const base = normalizePriceSetItemMetadata(basePriceSet);
  const activeOverrides = activeManualPriceOverridesForPriceSet(state, base);
  const entries = Object.entries(activeOverrides.items);
  if (entries.length === 0) return base;

  const latestUpdatedAt = entries
    .map(([, override]) => override.updatedAt)
    .sort((left, right) => right.localeCompare(left))[0];
  const itemPrices = { ...base.itemPrices };
  const itemPriceMetadata = { ...base.itemPriceMetadata };
  for (const [itemId, override] of entries) {
    itemPrices[itemId] = override.price;
    itemPriceMetadata[itemId] = {
      valueOrigin: "manual",
      refreshStatus: "not-evaluated",
      quality: "unknown",
      reasonCode: "manual-value"
    };
  }

  return PriceSetSchema.parse({
    ...base,
    id: `${base.id}-manual-overrides`,
    label: `${base.label} + local manual prices`,
    source: "manual",
    createdAt: latestUpdatedAt,
    itemPrices,
    itemPriceMetadata,
    provenance: {
      source: "manual",
      sourceRef: "browser-local manual item price overrides",
      notes:
        "Manual item prices overlay the active base PriceSet; high-alch values remain generated game-data truth."
    }
  }) as PriceSet;
}

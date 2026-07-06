import { z } from "zod";
import { PriceMapSchema, PriceSetSchema } from "@/data/schemas";
import type { PriceSet } from "@/domain/shared";

export const PRICE_HISTORY_STORAGE_KEY = "index-sim:price-history";
export const PRICE_HISTORY_VERSION = 1;
export const PRICE_HISTORY_MAX_SNAPSHOTS = 20;
export const PRICE_HISTORY_MAX_ITEMS_PER_SNAPSHOT = 2_000;

const IsoTimestampSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid timestamp");

const CappedPriceMapSchema = PriceMapSchema.refine(
  (prices) => Object.keys(prices).length <= PRICE_HISTORY_MAX_ITEMS_PER_SNAPSHOT,
  `At most ${PRICE_HISTORY_MAX_ITEMS_PER_SNAPSHOT} item prices can be stored per snapshot`
);

export const BrowserPriceHistorySnapshotSchema = z
  .object({
    capturedAt: IsoTimestampSchema,
    sourcePriceSetId: z.string().min(1),
    label: z.string().min(1).max(160),
    itemPrices: CappedPriceMapSchema
  })
  .strict();

export const BrowserPriceHistoryStateSchema = z
  .object({
    snapshots: z
      .array(BrowserPriceHistorySnapshotSchema)
      .max(PRICE_HISTORY_MAX_SNAPSHOTS)
  })
  .strict();

export type BrowserPriceHistorySnapshot = z.infer<typeof BrowserPriceHistorySnapshotSchema>;
export type BrowserPriceHistoryState = z.infer<typeof BrowserPriceHistoryStateSchema>;

export const DEFAULT_PRICE_HISTORY_STATE: BrowserPriceHistoryState = {
  snapshots: []
};

export interface PriceHistorySummary {
  snapshotCount: number;
  trackedItemCount: number;
  latestAgeSeconds: number | null;
  activeLabel: string;
  latestLabel: string;
  activeMatchesLatest: boolean;
}

function capItemPrices(itemPrices: PriceSet["itemPrices"]): PriceSet["itemPrices"] {
  return Object.fromEntries(
    Object.entries(itemPrices)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, PRICE_HISTORY_MAX_ITEMS_PER_SNAPSHOT)
  );
}

export function createPriceHistorySnapshot(
  priceSet: PriceSet,
  capturedAt: Date = new Date()
): BrowserPriceHistorySnapshot {
  const validated = PriceSetSchema.parse(priceSet) as PriceSet;
  return BrowserPriceHistorySnapshotSchema.parse({
    capturedAt: capturedAt.toISOString(),
    sourcePriceSetId: validated.id,
    label: validated.label,
    itemPrices: capItemPrices(validated.itemPrices)
  });
}

export function appendAcceptedPriceSetToHistory(
  current: BrowserPriceHistoryState,
  priceSet: PriceSet,
  capturedAt: Date = new Date()
): BrowserPriceHistoryState {
  const validatedCurrent = BrowserPriceHistoryStateSchema.parse(current);
  const snapshot = createPriceHistorySnapshot(priceSet, capturedAt);

  return {
    snapshots: [snapshot, ...validatedCurrent.snapshots].slice(0, PRICE_HISTORY_MAX_SNAPSHOTS)
  };
}

export function keepPriceHistoryOnFailure(
  current: BrowserPriceHistoryState
): BrowserPriceHistoryState {
  return current;
}

export function summarizePriceHistory(
  history: BrowserPriceHistoryState,
  activePriceSet: PriceSet | null,
  now: Date = new Date()
): PriceHistorySummary {
  const validatedHistory = BrowserPriceHistoryStateSchema.parse(history);
  const latest = validatedHistory.snapshots[0] ?? null;
  const latestAgeSeconds = latest
    ? Math.max(0, Math.floor((now.getTime() - Date.parse(latest.capturedAt)) / 1000))
    : null;

  return {
    snapshotCount: validatedHistory.snapshots.length,
    trackedItemCount: latest ? Object.keys(latest.itemPrices).length : 0,
    latestAgeSeconds,
    activeLabel: activePriceSet?.label ?? "-",
    latestLabel: latest?.label ?? "-",
    activeMatchesLatest:
      !!activePriceSet &&
      !!latest &&
      activePriceSet.id === latest.sourcePriceSetId &&
      activePriceSet.label === latest.label
  };
}

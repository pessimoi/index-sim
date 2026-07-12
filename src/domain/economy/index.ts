import {
  type EntityId,
  type ItemPriceMetadata,
  type PriceSet,
  type SimulationWarning
} from "../shared";
import { aliasesForCanonicalItemId, resolveCanonicalItemId } from "./canonical-item-id";
export * from "./canonical-item-id";

export type PriceLookupKind = "item-price" | "alch-value";

export type ItemPriceFreshnessDisplay =
  "observed-current" | "retained" | "observed-stale" | "unknown" | "not-market-priced";

export function deriveItemPriceFreshness(
  metadata: ItemPriceMetadata | undefined,
  now: Date
): ItemPriceFreshnessDisplay {
  if (!metadata) return "unknown";
  if (metadata.valueOrigin !== "market-observation") {
    return ["generated-object-cost", "manual"].includes(metadata.valueOrigin) ||
      metadata.refreshStatus === "not-applicable"
      ? "not-market-priced"
      : metadata.refreshStatus === "retained"
        ? "retained"
        : "unknown";
  }
  if (metadata.refreshStatus === "retained") return "retained";
  const observedAt = metadata.valueObservedAt ? Date.parse(metadata.valueObservedAt) : NaN;
  if (!Number.isFinite(observedAt)) return "unknown";
  const ageMs = Math.max(0, now.getTime() - observedAt);
  return ageMs > 30 * 24 * 60 * 60 * 1000 ? "observed-stale" : "observed-current";
}

export interface PriceLookupWarning extends SimulationWarning {
  code: "missing-price" | "missing-alch-value";
  itemId: EntityId;
  priceSetId: EntityId;
  lookupKind: PriceLookupKind;
}

export interface PriceLookupResult {
  itemId: EntityId;
  requestedItemId?: EntityId;
  canonicalItemId?: EntityId;
  lookupSource?: "identity" | "canonical" | "alias";
  aliasItemId?: EntityId;
  value: number | null;
  metadata?: ItemPriceMetadata;
  warning?: PriceLookupWarning;
}

function hasUsablePrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function missingWarning(
  priceSet: PriceSet,
  itemId: EntityId,
  lookupKind: PriceLookupKind
): PriceLookupWarning {
  const code = lookupKind === "item-price" ? "missing-price" : "missing-alch-value";
  return {
    code,
    severity: "warning",
    itemId,
    priceSetId: priceSet.id,
    lookupKind,
    message: `${lookupKind === "item-price" ? "Price" : "Alch value"} is missing for item '${itemId}' in PriceSet '${priceSet.id}'.`
  };
}

function lookupPrice(
  priceSet: PriceSet,
  itemId: EntityId,
  lookupKind: PriceLookupKind,
  values: Record<EntityId, number>
): PriceLookupResult {
  const value = values[itemId];
  if (hasUsablePrice(value)) {
    return { itemId, value };
  }
  return {
    itemId,
    value: null,
    warning: missingWarning(priceSet, itemId, lookupKind)
  };
}

export function lookupItemPrice(priceSet: PriceSet, itemId: EntityId): PriceLookupResult {
  const resolved = resolveCanonicalItemId(itemId);
  const canonicalItemId = resolved.canonicalItemId;
  const directValue = priceSet.itemPrices[itemId];
  if (hasUsablePrice(directValue)) {
    return {
      itemId,
      requestedItemId: itemId,
      canonicalItemId,
      lookupSource: "identity",
      value: directValue,
      metadata: priceSet.itemPriceMetadata?.[itemId]
    };
  }
  const candidateIds = [
    ...(canonicalItemId === itemId ? [] : [canonicalItemId]),
    ...aliasesForCanonicalItemId(canonicalItemId).filter((alias) => alias !== itemId)
  ];

  for (const candidateId of candidateIds) {
    const value = priceSet.itemPrices[candidateId];
    if (hasUsablePrice(value)) {
      return {
        itemId: candidateId,
        requestedItemId: itemId,
        canonicalItemId,
        lookupSource:
          candidateId === itemId
            ? "identity"
            : candidateId === canonicalItemId
              ? "canonical"
              : "alias",
        ...(candidateId !== canonicalItemId ? { aliasItemId: candidateId } : {}),
        value,
        metadata: priceSet.itemPriceMetadata?.[candidateId]
      };
    }
  }

  return {
    itemId: canonicalItemId,
    requestedItemId: itemId,
    canonicalItemId,
    lookupSource: canonicalItemId === itemId ? "identity" : "canonical",
    value: null,
    warning: missingWarning(priceSet, canonicalItemId, "item-price")
  };
}

export function lookupAlchValue(priceSet: PriceSet, itemId: EntityId): PriceLookupResult {
  return lookupPrice(priceSet, itemId, "alch-value", priceSet.alchValues);
}

export function collectMissingPriceWarnings(
  priceSet: PriceSet,
  itemIds: Iterable<EntityId>,
  lookupKind: PriceLookupKind = "item-price"
): PriceLookupWarning[] {
  const values = lookupKind === "item-price" ? priceSet.itemPrices : priceSet.alchValues;
  const warnings: PriceLookupWarning[] = [];
  const seenWarningKeys = new Set<string>();

  for (const itemId of itemIds) {
    const result =
      lookupKind === "item-price"
        ? lookupItemPrice(priceSet, itemId)
        : lookupPrice(priceSet, itemId, lookupKind, values);
    if (result.warning) {
      const key = `${result.warning.code}:${result.warning.itemId}`;
      if (seenWarningKeys.has(key)) continue;
      seenWarningKeys.add(key);
      warnings.push(result.warning);
    }
  }

  return warnings;
}

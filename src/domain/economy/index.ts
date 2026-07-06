import { type EntityId, type PriceSet, type SimulationWarning } from "../shared";

export type PriceLookupKind = "item-price" | "alch-value";

export interface PriceLookupWarning extends SimulationWarning {
  code: "missing-price" | "missing-alch-value";
  itemId: EntityId;
  priceSetId: EntityId;
  lookupKind: PriceLookupKind;
}

export interface PriceLookupResult {
  itemId: EntityId;
  value: number | null;
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
  return lookupPrice(priceSet, itemId, "item-price", priceSet.itemPrices);
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

  for (const itemId of itemIds) {
    const result = lookupPrice(priceSet, itemId, lookupKind, values);
    if (result.warning) warnings.push(result.warning);
  }

  return warnings;
}

import { PriceSetSchema, normalizePriceSetItemMetadata } from "../../data/schemas/price-set";
import type { GameDataSnapshot, PriceSet } from "../../domain/shared";

export function generatedItemValues(
  gameData: GameDataSnapshot,
  field: "price" | "alch"
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(gameData.items).flatMap(([itemId, item]) =>
      item[field] === undefined ? [] : [[itemId, item[field]]]
    )
  );
}

export function withGeneratedAlchAuthority(
  priceSet: PriceSet,
  gameData: GameDataSnapshot,
  options: { fillMissingItemPrices?: boolean; label?: string } = {}
): PriceSet {
  const normalizedPriceSet = normalizePriceSetItemMetadata(priceSet);
  const generatedPrices = options.fillMissingItemPrices
    ? generatedItemValues(gameData, "price")
    : {};
  const generatedFallbackMetadata = Object.fromEntries(
    Object.keys(generatedPrices)
      .filter((itemId) => normalizedPriceSet.itemPrices[itemId] === undefined)
      .map((itemId) => [
        itemId,
        {
          valueOrigin: "generated-object-cost" as const,
          refreshStatus: "not-applicable" as const,
          quality: "fallback" as const,
          sourceRef: "generated game-data object cost",
          verifiedAt: gameData.provenance?.verifiedAt,
          reasonCode: "generated-price-fallback" as const
        }
      ])
  );
  return PriceSetSchema.parse({
    ...normalizedPriceSet,
    label: options.label ?? normalizedPriceSet.label,
    itemPrices: options.fillMissingItemPrices
      ? {
          ...generatedPrices,
          ...normalizedPriceSet.itemPrices
        }
      : normalizedPriceSet.itemPrices,
    itemPriceMetadata: {
      ...generatedFallbackMetadata,
      ...normalizedPriceSet.itemPriceMetadata
    },
    alchValues: generatedItemValues(gameData, "alch"),
    provenance: {
      source: "generated",
      sourceRef: "active item prices + generated game-data high-alch values",
      verifiedAt:
        gameData.provenance?.verifiedAt ??
        normalizedPriceSet.provenance?.verifiedAt ??
        normalizedPriceSet.createdAt,
      notes:
        "Item prices keep the active PriceSet source; high-alch values are authoritative generated game data for the current revision."
    }
  }) as PriceSet;
}

export function createGeneratedRuntimePriceSet(
  scheduledPriceSet: PriceSet,
  gameData: GameDataSnapshot
): PriceSet {
  return withGeneratedAlchAuthority(scheduledPriceSet, gameData, {
    fillMissingItemPrices: true,
    label: `${scheduledPriceSet.label} + generated item fallbacks`
  });
}

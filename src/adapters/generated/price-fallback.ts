import { PriceSetSchema } from "../../data/schemas/price-set";
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
  return PriceSetSchema.parse({
    ...priceSet,
    label: options.label ?? priceSet.label,
    itemPrices: options.fillMissingItemPrices
      ? {
          ...generatedItemValues(gameData, "price"),
          ...priceSet.itemPrices
        }
      : priceSet.itemPrices,
    alchValues: generatedItemValues(gameData, "alch"),
    provenance: {
      source: "generated",
      sourceRef: "active item prices + generated game-data high-alch values",
      verifiedAt:
        gameData.provenance?.verifiedAt ?? priceSet.provenance?.verifiedAt ?? priceSet.createdAt,
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

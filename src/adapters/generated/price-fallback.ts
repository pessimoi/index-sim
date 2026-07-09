import { PriceSetSchema } from "../../data/schemas/price-set";
import type { GameDataSnapshot, PriceSet } from "../../domain/shared";

function embeddedItemValues(
  gameData: GameDataSnapshot,
  field: "price" | "alch"
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(gameData.items).flatMap(([itemId, item]) =>
      item[field] === undefined ? [] : [[itemId, item[field]]]
    )
  );
}

export function createGeneratedRuntimePriceSet(
  scheduledPriceSet: PriceSet,
  gameData: GameDataSnapshot
): PriceSet {
  return PriceSetSchema.parse({
    ...scheduledPriceSet,
    label: `${scheduledPriceSet.label} + generated item fallbacks`,
    itemPrices: {
      ...embeddedItemValues(gameData, "price"),
      ...scheduledPriceSet.itemPrices
    },
    alchValues: {
      ...embeddedItemValues(gameData, "alch"),
      ...scheduledPriceSet.alchValues
    },
    provenance: {
      source: "generated",
      sourceRef: "scheduled static prices + generated game-data item fallbacks",
      verifiedAt:
        gameData.provenance?.verifiedAt ??
        scheduledPriceSet.provenance?.verifiedAt ??
        scheduledPriceSet.createdAt,
      notes:
        "Scheduled item and alch values take precedence; generated item values fill only missing ids in the staged runtime candidate."
    }
  }) as PriceSet;
}

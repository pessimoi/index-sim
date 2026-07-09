import legacyDerivedGameData from "../../data/generated/legacy-derived-runtime-game-data.json";
import legacyDerivedPriceSet from "../../data/generated/legacy-derived-runtime-price-set.json";
import { parseGameDataSnapshot } from "../../data/schemas/game-data";
import { PriceSetSchema } from "../../data/schemas/price-set";
import type { PriceSet, SimulationContext } from "../../domain/shared";

export interface StaticRuntimeBootstrapResult {
  context: SimulationContext;
  source: "legacy-derived-static-snapshot";
}

export interface StaticRuntimeContextOptions {
  gameData?: unknown;
  priceSet?: unknown;
}

export function createLegacyDerivedStaticRuntimeContext(
  options: StaticRuntimeContextOptions = {}
): StaticRuntimeBootstrapResult {
  const gameData = parseGameDataSnapshot(options.gameData ?? legacyDerivedGameData);
  const priceSet = PriceSetSchema.parse(options.priceSet ?? legacyDerivedPriceSet) as PriceSet;

  return {
    context: {
      gameData,
      priceSet
    },
    source: "legacy-derived-static-snapshot"
  };
}

export async function loadLegacyDerivedStaticRuntimeContext(): Promise<StaticRuntimeBootstrapResult> {
  return createLegacyDerivedStaticRuntimeContext();
}

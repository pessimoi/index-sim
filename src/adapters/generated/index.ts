import { createScheduledStaticPriceSnapshotStatus } from "../market";
import generatedGameData from "../../data/generated/game-data.json";
import {
  parseGameDataSnapshot,
  requireGameDataRevisionContext
} from "../../data/schemas/game-data";
import type { SimulationContext } from "../../domain/shared";
import { createGeneratedRuntimePriceSet, generatedItemValues } from "./price-fallback";
import priceHistoryText from "../../../price-history.json?raw";
import priceProvenanceText from "../../../price-provenance.json?raw";
import pricesText from "../../../prices.json?raw";
export {
  createGeneratedRuntimeReadinessReport,
  type GeneratedRuntimeReadinessReport,
  type GeneratedRuntimeSource,
  type RuntimeCoverageSection,
  type RuntimeCoverageSummary
} from "./readiness";
export {
  createGeneratedRuntimePriceSet,
  generatedItemValues,
  withGeneratedAlchAuthority
} from "./price-fallback";

export interface GeneratedRuntimeContextOptions {
  gameData?: unknown;
  pricesText?: string | null;
  priceProvenanceText?: string | null;
  alchText?: string | null;
  priceHistoryText?: string | null;
  loadedAt?: string;
}

export interface GeneratedRuntimeBootstrapResult {
  context: SimulationContext;
  source: "generated-static-snapshot";
}

export function createGeneratedRuntimeContext(
  options: GeneratedRuntimeContextOptions = {}
): GeneratedRuntimeBootstrapResult {
  const gameData = parseGameDataSnapshot(options.gameData ?? generatedGameData);
  requireGameDataRevisionContext(gameData);
  const priceStatus = createScheduledStaticPriceSnapshotStatus(
    {
      pricesText: options.pricesText ?? pricesText,
      priceProvenanceText: options.priceProvenanceText ?? priceProvenanceText,
      alchText: options.alchText,
      priceHistoryText: options.priceHistoryText ?? priceHistoryText
    },
    {
      canonicalAlchValues: generatedItemValues(gameData, "alch"),
      loadedAt: options.loadedAt
    }
  );

  if (priceStatus.status !== "loaded" || priceStatus.scheduledPriceSet === null) {
    throw new Error(`Generated runtime PriceSet is unavailable (${priceStatus.status}).`);
  }

  return {
    context: {
      gameData,
      priceSet: createGeneratedRuntimePriceSet(priceStatus.scheduledPriceSet, gameData)
    },
    source: "generated-static-snapshot"
  };
}

export async function loadGeneratedRuntimeContext(
  options: GeneratedRuntimeContextOptions = {}
): Promise<GeneratedRuntimeBootstrapResult> {
  return createGeneratedRuntimeContext(options);
}

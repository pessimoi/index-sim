import type { MarketSyncReport, MarketSyncResponse, SimulationContext } from "@/domain/shared";

export function applyMarketSyncResponse(
  context: SimulationContext,
  response: MarketSyncResponse
): SimulationContext {
  return {
    ...context,
    priceSet: response.priceSet
  };
}

export function keepMarketSyncFailureContext(context: SimulationContext): SimulationContext {
  return context;
}

export function summarizeMarketSyncReport(report: MarketSyncReport): string {
  return `${report.updated} updated · ${report.skipped} skipped · ${report.failed} failed`;
}

import type {
  IntegrationSeverity,
  MarketItemReport,
  MarketSyncReport,
  MarketSyncResponse,
  SimulationContext
} from "@/domain/shared";

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

export type MarketReportStatusFilter = "all" | MarketItemReport["status"];

export interface MarketReportItemDetail {
  itemId: string;
  itemLabel: string;
  sourceSlug: string;
  status: MarketItemReport["status"];
  priceLabel: string;
  alchValueLabel: string;
  sampleSizeLabel: string;
  reason: string;
}

export interface MarketReportWarningDetail {
  id: string;
  severity: IntegrationSeverity;
  message: string;
  itemId: string | null;
}

export interface MarketReportDetailViewModel {
  counts: Record<MarketReportStatusFilter, number>;
  items: MarketReportItemDetail[];
  warnings: MarketReportWarningDetail[];
}

const MARKET_REPORT_REASON_MAX_LENGTH = 140;
const MARKET_REPORT_STATUS_PRIORITY: Record<MarketItemReport["status"], number> = {
  failed: 0,
  skipped: 1,
  updated: 2
};

function formatMarketNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function sanitizeMarketReportText(value: string | undefined): string {
  if (!value) return "-";
  const normalized = value
    .replace(/(?:[A-Za-z]:)?[\\/][^\s"']+/g, "[path]")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= MARKET_REPORT_REASON_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, MARKET_REPORT_REASON_MAX_LENGTH - 3).trimEnd()}...`;
}

export function formatMarketSyncReportDetails(
  report: MarketSyncReport,
  options: {
    filter?: MarketReportStatusFilter;
    itemLabel?: (itemId: string) => string | undefined;
  } = {}
): MarketReportDetailViewModel {
  const filter = options.filter ?? "all";
  const rows = report.items
    .map((item, index) => ({
      item,
      index,
      priority: MARKET_REPORT_STATUS_PRIORITY[item.status]
    }))
    .filter(({ item }) => filter === "all" || item.status === filter)
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ item }) => ({
      itemId: item.itemId,
      itemLabel: options.itemLabel?.(item.itemId) ?? item.itemId,
      sourceSlug: item.sourceSlug ?? "-",
      status: item.status,
      priceLabel: formatMarketNumber(item.price),
      alchValueLabel: formatMarketNumber(item.alchValue),
      sampleSizeLabel: formatMarketNumber(item.sampleSize),
      reason: sanitizeMarketReportText(item.reason)
    }));

  return {
    counts: {
      all: report.items.length,
      updated: report.updated,
      skipped: report.skipped,
      failed: report.failed
    },
    items: rows,
    warnings: report.warnings.map((warning, index) => ({
      id: `${warning.code}:${warning.itemId ?? warning.skill ?? index}`,
      severity: warning.severity,
      message: sanitizeMarketReportText(warning.message),
      itemId: warning.itemId ?? null
    }))
  };
}

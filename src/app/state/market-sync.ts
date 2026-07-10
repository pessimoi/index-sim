import { createGeneratedRuntimePriceSet } from "@/adapters/generated/price-fallback";
import type { ScheduledStaticPriceSnapshotStatus } from "@/adapters/market";
import type {
  GameDataSnapshot,
  PriceSet,
  IntegrationSeverity,
  MarketItemReport,
  MarketSyncReport,
  MarketSyncResponse,
  SimulationContext
} from "@/domain/shared";

export type ActivePriceSetOrigin = "selected" | "scheduled" | "bundled";

export interface ActivePriceSetFallbackResolution {
  priceSet: PriceSet;
  origin: ActivePriceSetOrigin;
}

export interface ScheduledPriceSnapshotViewModel {
  statusLabel: string;
  tone: "success" | "neutral" | "warning" | "error";
  message: string;
  fallbackLabel: string;
}

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

export function scheduledPriceSetFromStatus(
  status: ScheduledStaticPriceSnapshotStatus | null
): PriceSet | null {
  return status?.status === "loaded" ? status.scheduledPriceSet : null;
}

export function withGeneratedScheduledPriceFallbacks(
  status: ScheduledStaticPriceSnapshotStatus,
  gameData: GameDataSnapshot
): ScheduledStaticPriceSnapshotStatus {
  if (status.status !== "loaded" || status.scheduledPriceSet === null) {
    return status;
  }

  return {
    ...status,
    scheduledPriceSet: createGeneratedRuntimePriceSet(status.scheduledPriceSet, gameData)
  };
}

export function resolveActivePriceSetFallback(input: {
  bundledPriceSet: PriceSet;
  selectedPriceSet: PriceSet | null;
  scheduledSnapshotStatus: ScheduledStaticPriceSnapshotStatus | null;
}): ActivePriceSetFallbackResolution {
  if (input.selectedPriceSet) {
    return {
      priceSet: input.selectedPriceSet,
      origin: "selected"
    };
  }

  const scheduledPriceSet = scheduledPriceSetFromStatus(input.scheduledSnapshotStatus);
  if (scheduledPriceSet) {
    return {
      priceSet: scheduledPriceSet,
      origin: "scheduled"
    };
  }

  return {
    priceSet: input.bundledPriceSet,
    origin: "bundled"
  };
}

export function activePriceSetOriginLabel(origin: ActivePriceSetOrigin): string {
  if (origin === "selected") return "Local override";
  if (origin === "scheduled") return "Scheduled snapshot";
  return "Bundled fallback";
}

function fallbackLabelForOrigin(origin: ActivePriceSetOrigin): string {
  if (origin === "selected") return "Local override active";
  if (origin === "scheduled") return "Scheduled snapshot active";
  return "Bundled prices active";
}

export function createScheduledPriceSnapshotViewModel(
  status: ScheduledStaticPriceSnapshotStatus | null,
  activeOrigin: ActivePriceSetOrigin
): ScheduledPriceSnapshotViewModel {
  if (!status) {
    return {
      statusLabel: "Loading",
      tone: "neutral",
      message: "Checking scheduled price snapshot.",
      fallbackLabel: fallbackLabelForOrigin(activeOrigin)
    };
  }

  if (status.status === "loaded") {
    return {
      statusLabel: "Loaded",
      tone: "success",
      message: "Scheduled prices loaded.",
      fallbackLabel: fallbackLabelForOrigin(activeOrigin)
    };
  }

  if (status.status === "fallback") {
    return {
      statusLabel: "Fallback",
      tone: "warning",
      message: status.reason,
      fallbackLabel: fallbackLabelForOrigin(activeOrigin)
    };
  }

  return {
    statusLabel: status.status === "missing" ? "Unavailable" : "Invalid",
    tone: status.status === "missing" ? "neutral" : "warning",
    message: status.reason,
    fallbackLabel: fallbackLabelForOrigin(activeOrigin)
  };
}

export function summarizeMarketSyncReport(report: MarketSyncReport): string {
  return `${report.updated} updated · ${report.skipped} skipped · ${report.failed} failed`;
}

export type MarketReportStatusFilter = "all" | MarketItemReport["status"];

export interface MarketReportItemDetail {
  itemId: string;
  itemLabel: string;
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

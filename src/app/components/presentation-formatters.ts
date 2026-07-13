import { formatNumber } from "../view-models/simulation";

export function formatDelta(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) < 0.5) return "0";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

export function signedPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${formatNumber(value, 1)}%`;
}

export function itemPriceMetadataLabel(value: string | undefined): string {
  return value ? value.replaceAll("-", " ") : "unknown";
}

export function optionalPrice(value: number | null): string {
  return value === null ? "-" : formatNumber(value);
}

export function optionalDelta(value: number | null): string {
  return value === null ? "-" : formatDelta(value);
}

export function optionalPercent(value: number | null): string {
  return value === null ? "-" : signedPercent(value);
}

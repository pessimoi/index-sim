import { formatSemanticUnitValue, type SemanticUnitValue } from "./presentation-language";

export function formatNumber(value: number, digits = 0): string {
  if (value === Number.POSITIVE_INFINITY) return "unlimited";
  if (!Number.isFinite(value)) return "-";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

export function signedDecimal(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

export function formatDurationValue(seconds: number): SemanticUnitValue {
  if (seconds === Number.POSITIVE_INFINITY) {
    return { visible: "unlimited", accessible: "unlimited" };
  }
  if (!Number.isFinite(seconds)) return { visible: "-", accessible: "-" };
  if (seconds < 60) return formatSemanticUnitValue(formatNumber(seconds, 1), seconds, "second");
  const roundedSeconds = Math.round(seconds);
  const days = Math.floor(roundedSeconds / 86_400);
  const hours = Math.floor((roundedSeconds % 86_400) / 3_600);
  const minutes = Math.floor((roundedSeconds % 3_600) / 60);
  const remainingSeconds = roundedSeconds % 60;
  const parts: SemanticUnitValue[] = [];
  if (days > 0) parts.push(formatSemanticUnitValue(formatNumber(days), days, "day"));
  if (hours > 0) parts.push(formatSemanticUnitValue(formatNumber(hours), hours, "hour"));
  if (minutes > 0) parts.push(formatSemanticUnitValue(formatNumber(minutes), minutes, "minute"));
  if (remainingSeconds > 0) {
    parts.push(formatSemanticUnitValue(formatNumber(remainingSeconds), remainingSeconds, "second"));
  }
  return {
    visible: parts.map((part) => part.visible).join(" "),
    accessible: parts.map((part) => part.accessible).join(" ")
  };
}

export function formatDuration(seconds: number): string {
  return formatDurationValue(seconds).visible;
}

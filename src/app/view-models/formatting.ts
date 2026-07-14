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

export function formatDuration(seconds: number): string {
  if (seconds === Number.POSITIVE_INFINITY) return "unlimited";
  if (!Number.isFinite(seconds)) return "-";
  if (seconds < 60) return `${formatNumber(seconds, 1)}s`;
  const roundedSeconds = Math.round(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = (roundedSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

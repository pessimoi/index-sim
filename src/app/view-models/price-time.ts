export const PRICE_TIME_LOCALE = "en-GB" as const;
export const PRICE_TIME_FALLBACK_ZONE = "UTC" as const;

export interface PriceTimeContext {
  now: Date;
  locale: typeof PRICE_TIME_LOCALE;
  timeZone: string;
}

export type PriceTimePrecision = "instant" | "date" | "missing" | "invalid";

export interface PriceDateTimePresentation {
  precision: PriceTimePrecision;
  dateTime: string | null;
  exactVisible: string;
  exactAccessible: string;
  exactUtcTitle: string | null;
  relativeVisible: string | null;
  relativeAccessible: string | null;
}

export interface PresentPriceDateTimeOptions {
  missingText?: string;
  includeSeconds?: boolean;
}

const ISO_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function validInstant(value: string, match: RegExpMatchArray): Date | null {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offset = match[8] ?? "";
  if (!validCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  if (offset !== "Z") {
    const offsetHour = Number(offset.slice(1, 3));
    const offsetMinute = Number(offset.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return null;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds) : null;
}

function resolvedTimeZone(candidate: string): string {
  try {
    new Intl.DateTimeFormat(PRICE_TIME_LOCALE, { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return PRICE_TIME_FALLBACK_ZONE;
  }
}

export function resolveBrowserPriceTimeZone(): string {
  try {
    const candidate = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return candidate ? resolvedTimeZone(candidate) : PRICE_TIME_FALLBACK_ZONE;
  } catch {
    return PRICE_TIME_FALLBACK_ZONE;
  }
}

export function createPriceTimeContext(now: Date, timeZone: string): PriceTimeContext {
  return {
    now: new Date(now.getTime()),
    locale: PRICE_TIME_LOCALE,
    timeZone: resolvedTimeZone(timeZone)
  };
}

function formatInstant(
  instant: Date,
  timeZone: string,
  month: "short" | "long",
  zoneName: "short" | "long",
  includeSeconds: boolean
): string {
  const formatted = new Intl.DateTimeFormat(PRICE_TIME_LOCALE, {
    timeZone,
    day: "numeric",
    month,
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" as const } : {}),
    hourCycle: "h23",
    timeZoneName: zoneName
  }).format(instant);
  return month === "short" && zoneName === "short"
    ? formatted.replace(/\s+at\s+/u, ", ")
    : formatted;
}

function exactInstant(
  instant: Date,
  context: PriceTimeContext,
  includeSeconds: boolean
): Pick<PriceDateTimePresentation, "exactVisible" | "exactAccessible" | "exactUtcTitle"> {
  const timeZone = resolvedTimeZone(context.timeZone);
  try {
    return {
      exactVisible: formatInstant(instant, timeZone, "short", "short", includeSeconds),
      exactAccessible: formatInstant(instant, timeZone, "long", "long", includeSeconds),
      exactUtcTitle: formatInstant(instant, PRICE_TIME_FALLBACK_ZONE, "short", "short", true)
    };
  } catch {
    return {
      exactVisible: formatInstant(
        instant,
        PRICE_TIME_FALLBACK_ZONE,
        "short",
        "short",
        includeSeconds
      ),
      exactAccessible: formatInstant(
        instant,
        PRICE_TIME_FALLBACK_ZONE,
        "long",
        "long",
        includeSeconds
      ),
      exactUtcTitle: formatInstant(instant, PRICE_TIME_FALLBACK_ZONE, "short", "short", true)
    };
  }
}

function plural(value: number, unit: "minute" | "hour" | "day"): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

function relativeTime(
  instant: Date,
  now: Date
): Pick<PriceDateTimePresentation, "relativeVisible" | "relativeAccessible"> {
  const deltaSeconds = Math.trunc((instant.getTime() - now.getTime()) / 1000);
  const future = deltaSeconds > 0;
  const distance = Math.abs(deltaSeconds);
  if (distance < 60) {
    return future
      ? {
          relativeVisible: "in less than 1 minute",
          relativeAccessible: "in less than 1 minute"
        }
      : { relativeVisible: "just now", relativeAccessible: "less than 1 minute ago" };
  }
  const [amount, baseVisibleUnit, accessibleUnit] =
    distance < 3_600
      ? ([Math.max(1, Math.floor(distance / 60)), "min", "minute"] as const)
      : distance < 86_400
        ? ([Math.max(1, Math.floor(distance / 3_600)), "hr", "hour"] as const)
        : ([Math.max(1, Math.floor(distance / 86_400)), "day", "day"] as const);
  const visibleUnit =
    accessibleUnit === "day" && amount !== 1 ? `${baseVisibleUnit}s` : baseVisibleUnit;
  return future
    ? {
        relativeVisible: `in ${amount} ${visibleUnit}`,
        relativeAccessible: `in ${plural(amount, accessibleUnit)}`
      }
    : {
        relativeVisible: `${amount} ${visibleUnit} ago`,
        relativeAccessible: `${plural(amount, accessibleUnit)} ago`
      };
}

function dateOnlyPresentation(value: string, match: RegExpMatchArray): PriceDateTimePresentation {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!validCalendarDate(year, month, day)) return invalidPresentation();
  const date = new Date(Date.UTC(year, month - 1, day));
  const exactVisible = new Intl.DateTimeFormat(PRICE_TIME_LOCALE, {
    timeZone: PRICE_TIME_FALLBACK_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
  const exactAccessible = new Intl.DateTimeFormat(PRICE_TIME_LOCALE, {
    timeZone: PRICE_TIME_FALLBACK_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
  return {
    precision: "date",
    dateTime: value,
    exactVisible,
    exactAccessible,
    exactUtcTitle: null,
    relativeVisible: null,
    relativeAccessible: null
  };
}

function missingPresentation(text = "Unavailable"): PriceDateTimePresentation {
  return {
    precision: "missing",
    dateTime: null,
    exactVisible: text,
    exactAccessible: text,
    exactUtcTitle: null,
    relativeVisible: null,
    relativeAccessible: null
  };
}

function invalidPresentation(): PriceDateTimePresentation {
  return {
    precision: "invalid",
    dateTime: null,
    exactVisible: "Date unavailable",
    exactAccessible: "The stored date could not be displayed.",
    exactUtcTitle: null,
    relativeVisible: null,
    relativeAccessible: null
  };
}

export function presentPriceDateTime(
  value: string | null | undefined,
  context: PriceTimeContext,
  options: PresentPriceDateTimeOptions = {}
): PriceDateTimePresentation {
  if (value === null || value === undefined || value === "") {
    return missingPresentation(options.missingText);
  }
  const dateMatch = value.match(ISO_DATE_PATTERN);
  if (dateMatch) return dateOnlyPresentation(value, dateMatch);
  const instantMatch = value.match(ISO_INSTANT_PATTERN);
  if (!instantMatch) return invalidPresentation();
  const instant = validInstant(value, instantMatch);
  if (!instant) return invalidPresentation();
  return {
    precision: "instant",
    dateTime: value,
    ...exactInstant(instant, context, options.includeSeconds ?? false),
    ...relativeTime(instant, context.now)
  };
}

export function presentPriceDateTimeOccurrences(
  values: readonly (string | null | undefined)[],
  context: PriceTimeContext
): PriceDateTimePresentation[] {
  const minutePresentations = values.map((value) => presentPriceDateTime(value, context));
  const minuteCounts = new Map<string, number>();
  for (const presentation of minutePresentations) {
    if (presentation.precision !== "instant") continue;
    minuteCounts.set(
      presentation.exactVisible,
      (minuteCounts.get(presentation.exactVisible) ?? 0) + 1
    );
  }
  const withSeconds = values.map((value, index) => {
    const presentation = minutePresentations[index]!;
    return presentation.precision === "instant" &&
      (minuteCounts.get(presentation.exactVisible) ?? 0) > 1
      ? presentPriceDateTime(value, context, { includeSeconds: true })
      : presentation;
  });
  const duplicateCounts = new Map<string, number>();
  for (const presentation of withSeconds) {
    if (presentation.precision !== "instant" || !presentation.dateTime) continue;
    const instantKey = String(Date.parse(presentation.dateTime));
    duplicateCounts.set(instantKey, (duplicateCounts.get(instantKey) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return withSeconds.map((presentation) => {
    const key = presentation.dateTime ? String(Date.parse(presentation.dateTime)) : null;
    if (presentation.precision !== "instant" || !key || (duplicateCounts.get(key) ?? 0) < 2) {
      return presentation;
    }
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    const ordinal = `${occurrence} of ${duplicateCounts.get(key)}`;
    return {
      ...presentation,
      exactVisible: `${presentation.exactVisible} (${ordinal})`,
      exactAccessible: `${presentation.exactAccessible}, ${ordinal}`
    };
  });
}

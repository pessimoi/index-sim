import { parseJsonWithDuplicateKeyCheck } from "@/data/reliability";
import {
  createLegacyStorageKeyReview,
  type LegacyMigrationSkippedField,
  type LegacySetupMigrationReport,
  type LegacyStorageKey
} from "./contracts";

export type LegacyRecord = Record<string, unknown>;
type LegacyJsonField = LegacyStorageKey | string;

export function createReport(foundKeys: LegacyStorageKey[]): LegacySetupMigrationReport {
  return {
    foundKeys,
    keyReview: createLegacyStorageKeyReview(foundKeys),
    importedFields: [],
    skippedFields: [],
    warnings: [],
    setup: null,
    hiscoresPlayer: null,
    priceSet: null,
    lootPrefs: null,
    hiddenGearTiers: null,
    denseCompareSort: null,
    irrelevantMonsterIds: null,
    customSetupsByMonster: null,
    cannonByMonster: null,
    duelSnapshots: null
  };
}

export function readString(record: LegacyRecord, aliases: readonly string[]): string | undefined {
  for (const alias of aliases) {
    const value = record[alias];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function readNumber(record: LegacyRecord, aliases: readonly string[]): number | undefined {
  for (const alias of aliases) {
    const value = record[alias];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

export function readEntityObjectId(value: unknown): string | undefined {
  return isRecord(value) ? readString(value, ["id"]) : undefined;
}

export function isRecord(value: unknown): value is LegacyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isSafeLegacyMapKey(key: string): boolean {
  return key !== "__proto__" && key !== "prototype" && key !== "constructor";
}

export function copyNestedReportFindings(
  child: LegacySetupMigrationReport,
  prefix: string,
  report: LegacySetupMigrationReport
): void {
  for (const field of child.importedFields) {
    importField(report, `${prefix}.${field}`);
  }
  for (const field of child.skippedFields) {
    skip(report, `${prefix}.${field.field}`, field.reason, {
      disposition: field.disposition,
      handling: field.handling
    });
  }
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function parseLegacyJsonStorageValue(
  rawValue: string,
  field: LegacyJsonField,
  maxBytes: number,
  report: LegacySetupMigrationReport,
  subject = "Legacy price data"
): { ok: true; value: unknown } | { ok: false } {
  if (byteLength(rawValue) > maxBytes) {
    skip(report, field, "legacy value exceeds safe size limit");
    warn(report, `${subject} was ignored because it exceeds the safe size limit.`);
    return { ok: false };
  }

  try {
    return {
      ok: true,
      value: parseJsonWithDuplicateKeyCheck(rawValue, { source: "Legacy browser state" })
    };
  } catch {
    skip(report, field, "invalid JSON");
    warn(report, `${subject} could not be parsed as JSON.`);
    return { ok: false };
  }
}

export function isOneOf<const Values extends readonly string[]>(
  value: string,
  values: Values
): value is Values[number] {
  return values.some((allowed) => allowed === value);
}

export function importField(report: LegacySetupMigrationReport, field: string): void {
  report.importedFields.push(field);
}

export function skip(
  report: LegacySetupMigrationReport,
  field: string,
  reason: string,
  metadata: Pick<LegacyMigrationSkippedField, "disposition" | "handling"> = {}
): void {
  report.skippedFields.push({ field, reason, ...metadata });
}

export function warn(report: LegacySetupMigrationReport, message: string): void {
  report.warnings.push(message);
}

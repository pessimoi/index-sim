import type { KeyValueStorage } from "@/adapters/storage";
import { createPriceSetFromLegacyRecords } from "@/data/schemas";
import type { GameDataSnapshot, PriceSet } from "@/domain/shared";
import {
  DEFAULT_MAX_LEGACY_PLANNER_BYTES,
  DEFAULT_MAX_LEGACY_PRICE_BYTES,
  LEGACY_PRICE_HISTORY_KEYS,
  type LegacySetupMigrationOptions,
  type LegacySetupMigrationReport
} from "./contracts";
import { byteLength, importField, parseLegacyJsonStorageValue, skip, warn } from "./report";

export function inspectLegacyPlannerBoundary(
  storage: KeyValueStorage,
  report: LegacySetupMigrationReport,
  maxBytes = DEFAULT_MAX_LEGACY_PLANNER_BYTES
): void {
  const rawPlanner = storage.getItem("sim_planner_v1");
  if (rawPlanner == null) return;

  if (byteLength(rawPlanner) > maxBytes) {
    skip(
      report,
      "planner.state",
      "legacy planner state was detected but not imported because it exceeds safe review size limit"
    );
    warn(
      report,
      "Legacy planner state was detected but not imported; it exceeds the safe review size limit and will be kept unless you clear known legacy keys."
    );
    return;
  }

  skip(report, "planner.state", "legacy planner state was detected but not imported");
  warn(
    report,
    "Legacy planner state was detected but not imported; it will be kept unless you clear known legacy keys."
  );
}

export function inspectLegacyPriceSet(
  options: LegacySetupMigrationOptions,
  report: LegacySetupMigrationReport
): void {
  const rawPrices = options.storage.getItem("sim_prices_v1");
  const rawAlch = options.storage.getItem("sim_alch_v1");
  const rawScrapedAt = options.storage.getItem("sim_scraped_at_v1");
  const hasAnyCurrentPriceKey = rawPrices != null || rawAlch != null || rawScrapedAt != null;
  if (!hasAnyCurrentPriceKey) return;

  if (rawPrices == null || rawAlch == null) {
    skip(report, "prices.priceSet", "legacy prices and alch maps are both required");
    warn(report, "Legacy prices were detected but could not form a complete price set.");
    return;
  }

  const parsedPrices = parseLegacyJsonStorageValue(
    rawPrices,
    "sim_prices_v1",
    options.maxPriceBytes ?? DEFAULT_MAX_LEGACY_PRICE_BYTES,
    report
  );
  const parsedAlch = parseLegacyJsonStorageValue(
    rawAlch,
    "sim_alch_v1",
    options.maxPriceBytes ?? DEFAULT_MAX_LEGACY_PRICE_BYTES,
    report
  );
  if (!parsedPrices.ok || !parsedAlch.ok) {
    skip(report, "prices.priceSet", "legacy price set could not be parsed safely");
    warn(report, "Legacy prices were ignored because one or more maps failed validation.");
    return;
  }

  const createdAt = createdAtFromLegacyScrapedAt(rawScrapedAt, report);
  let priceSet: PriceSet;
  try {
    priceSet = createPriceSetFromLegacyRecords({
      id: "legacy-browser-prices",
      label: "Legacy browser prices",
      source: "imported",
      createdAt,
      itemPrices: parsedPrices.value,
      alchValues: Object.fromEntries(
        Object.entries(options.gameData.items).flatMap(([itemId, item]) =>
          item.alch === undefined ? [] : [[itemId, item.alch]]
        )
      ),
      provenance: {
        source: "generated",
        notes:
          "Market prices were imported from legacy browser storage; high-alch values use current generated game data."
      }
    });
  } catch {
    skip(report, "prices.priceSet", "legacy price set failed schema validation");
    warn(report, "Legacy prices were ignored because they failed price set validation.");
    return;
  }

  const unknownKeys = unknownPriceKeys(priceSet, options.gameData);
  if (unknownKeys.length > 0) {
    skip(report, "prices.priceSet", "legacy price set includes unknown item ids");
    warn(
      report,
      `Legacy prices were ignored because ${unknownKeys.length} item ids are not in game data.`
    );
    return;
  }

  report.priceSet = priceSet;
  importField(report, "prices.priceSet");
  warn(report, "Legacy high-alch overrides were replaced with current generated game data.");
}

export function inspectLegacyPriceHistory(
  storage: KeyValueStorage,
  report: LegacySetupMigrationReport
): void {
  const hasLegacyPriceHistory = LEGACY_PRICE_HISTORY_KEYS.some(
    (key) => storage.getItem(key) != null
  );
  if (!hasLegacyPriceHistory) return;
  skip(report, "prices.history", "legacy price history migration is not supported in this flow");
  warn(report, "Legacy price history was detected but not imported.");
}

function createdAtFromLegacyScrapedAt(
  rawValue: string | null,
  report: LegacySetupMigrationReport
): string {
  if (rawValue == null) return "legacy-unknown";
  const trimmed = rawValue.trim();
  if (!trimmed) {
    skip(report, "prices.scrapedAt", "empty legacy scraped timestamp");
    return "legacy-unknown";
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const timestamp = new Date(milliseconds);
    if (Number.isFinite(timestamp.getTime())) return timestamp.toISOString();
  }

  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();

  skip(report, "prices.scrapedAt", "invalid legacy scraped timestamp");
  warn(report, "Legacy price scraped timestamp was ignored.");
  return "legacy-unknown";
}

function unknownPriceKeys(priceSet: PriceSet, gameData: GameDataSnapshot): string[] {
  const itemIds = new Set(Object.keys(gameData.items));
  return Object.keys(priceSet.itemPrices)
    .filter((key) => !itemIds.has(key))
    .sort((left, right) => left.localeCompare(right));
}

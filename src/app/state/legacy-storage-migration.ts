import {
  DEFAULT_MAX_LEGACY_HISCORES_BYTES,
  DEFAULT_MAX_LEGACY_LOOT_PREFS_BYTES,
  DEFAULT_MAX_LEGACY_PLANNER_BYTES,
  DEFAULT_MAX_LEGACY_UI_STATE_BYTES,
  IMPORT_SUPPORTED_LEGACY_KEYS,
  detectLegacyStorageKeys,
  type LegacySetupMigrationOptions,
  type LegacySetupMigrationReport
} from "./legacy-migration/contracts";
import {
  inspectLegacyCompareSort,
  inspectLegacyHiddenGearTiers,
  inspectLegacyHiscoresPlayer,
  inspectLegacyIrrelevantMonsters,
  inspectLegacyLootPrefs
} from "./legacy-migration/preference-inspectors";
import {
  inspectLegacyPlannerBoundary,
  inspectLegacyPriceHistory,
  inspectLegacyPriceSet
} from "./legacy-migration/price-review-inspectors";
import { createReport } from "./legacy-migration/report";
import { inspectLegacySetupInput } from "./legacy-migration/setup-inspector";

export {
  LEGACY_INPUT_STORAGE_KEY,
  LEGACY_STORAGE_KEYS,
  LEGACY_STORAGE_KEY_POLICIES,
  clearKnownLegacyStorageKeys,
  createLegacyStorageKeyReview,
  detectLegacyStorageKeys
} from "./legacy-migration/contracts";
export type {
  LegacyMigrationSkippedField,
  LegacySetupMigrationOptions,
  LegacySetupMigrationReport,
  LegacyStorageKey,
  LegacyStorageKeyMigrationDisposition,
  LegacyStorageKeyPolicy,
  LegacyStorageKeyReviewItem
} from "./legacy-migration/contracts";

export function inspectLegacySetupMigration(
  options: LegacySetupMigrationOptions
): LegacySetupMigrationReport {
  const foundKeys = detectLegacyStorageKeys(options.storage);
  const report = createReport(foundKeys);

  const unsupportedKeys = foundKeys.filter((key) => !IMPORT_SUPPORTED_LEGACY_KEYS.has(key));
  if (unsupportedKeys.length > 0) {
    report.warnings.push(
      `Detected legacy keys outside this setup-import foundation: ${unsupportedKeys.join(", ")}`
    );
  }

  inspectLegacySetupInput(options, report);
  inspectLegacyHiscoresPlayer(
    options.storage,
    report,
    options.maxHiscoresBytes ?? DEFAULT_MAX_LEGACY_HISCORES_BYTES
  );
  inspectLegacyLootPrefs(
    options,
    report,
    options.maxLootPrefsBytes ?? DEFAULT_MAX_LEGACY_LOOT_PREFS_BYTES
  );
  inspectLegacyHiddenGearTiers(
    options.storage,
    report,
    options.maxUiStateBytes ?? DEFAULT_MAX_LEGACY_UI_STATE_BYTES
  );
  inspectLegacyCompareSort(
    options.storage,
    report,
    options.maxUiStateBytes ?? DEFAULT_MAX_LEGACY_UI_STATE_BYTES
  );
  inspectLegacyIrrelevantMonsters(
    options,
    report,
    options.maxUiStateBytes ?? DEFAULT_MAX_LEGACY_UI_STATE_BYTES
  );
  inspectLegacyPlannerBoundary(
    options.storage,
    report,
    options.maxPlannerBytes ?? DEFAULT_MAX_LEGACY_PLANNER_BYTES
  );
  inspectLegacyPriceSet(options, report);
  inspectLegacyPriceHistory(options.storage, report);

  return report;
}

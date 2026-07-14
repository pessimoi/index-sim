import {
  LEGACY_INPUT_STORAGE_KEY,
  type LegacySetupMigrationReport,
  type LegacyStorageKey,
  type LegacyStorageKeyMigrationDisposition
} from "../state/legacy-storage-migration";
import { formatNumber } from "./formatting";

const LEGACY_PRICE_STORAGE_KEYS = new Set<LegacyStorageKey>([
  "sim_prices_v1",
  "sim_alch_v1",
  "sim_scraped_at_v1",
  "sim_scraped_keys_v1",
  "sim_price_history_v1",
  "sim_price_history_sanitized_v1",
  "sim_price_history_sanitized_v2",
  "sim_price_history_sanitized_v3",
  "sim_price_history_sanitized_v4"
]);

export interface LegacyMigrationKeyRowViewModel {
  key: LegacyStorageKey;
  label: string;
  found: boolean;
  foundLabel: "found" | "not found";
  dispositionLabel: "migrate" | "review only" | "intentional reset" | "legacy-only";
  handling: string;
  reason: string;
  clearLabel: "delete on clear" | "not present";
}

export interface LegacyMigrationViewModel {
  tone: "" | "ready";
  statusLabel: string;
  importReady: boolean;
  summaryItems: string[];
  outcomeItems: string[];
  importPlan: string[];
  reviewPlan: string[];
  keyRows: LegacyMigrationKeyRowViewModel[];
  clearKeyList: string;
  showExistingRewriteSetupNotice: boolean;
  showUnsupportedDataNotice: boolean;
}

export function legacyMigrationDispositionLabel(
  disposition: LegacyStorageKeyMigrationDisposition
): LegacyMigrationKeyRowViewModel["dispositionLabel"] {
  if (disposition === "migrate") return "migrate";
  if (disposition === "review-only") return "review only";
  if (disposition === "intentional-reset") return "intentional reset";
  return "legacy-only";
}

function createSummaryItems(report: LegacySetupMigrationReport): string[] {
  const foundKeys = new Set(report.foundKeys);
  const pricesFound = report.foundKeys.some((key) => LEGACY_PRICE_STORAGE_KEYS.has(key));
  const compareFound = foundKeys.has("sim_compare_sort_v1") || foundKeys.has("sim_irrelevant_v1");
  const historyFound = report.keyReview.some(
    (item) => item.found && item.key.startsWith("sim_price_history")
  );
  const customSetupsFound =
    report.customSetupsByMonster != null ||
    report.skippedFields.some((field) => field.field.startsWith("sim_input_v3.monsterSetups"));
  const cannonMapFound =
    report.cannonByMonster != null ||
    report.skippedFields.some((field) => field.field.startsWith("sim_input_v3.cannonByMonster"));
  const duelSnapshotsFound =
    report.duelSnapshots != null ||
    report.skippedFields.some((field) => field.field.startsWith("sim_input_v3.duelSetups"));
  const reviewNeeded = report.keyReview.some(
    (item) => item.found && item.disposition !== "migrate"
  );

  return [
    report.setup
      ? "Legacy setup ready"
      : foundKeys.has(LEGACY_INPUT_STORAGE_KEY)
        ? "Legacy setup skipped"
        : "No legacy setup",
    report.hiscoresPlayer
      ? "Hiscores player ready"
      : foundKeys.has("sim_hiscore_player")
        ? "Hiscores player skipped"
        : "No hiscores player",
    report.lootPrefs != null
      ? "Loot preferences ready"
      : foundKeys.has("sim_loot_prefs_v1")
        ? "Loot preferences skipped"
        : "No loot preferences",
    report.customSetupsByMonster != null
      ? "Custom setups ready"
      : customSetupsFound
        ? "Custom setups skipped"
        : "No custom setups",
    report.cannonByMonster != null
      ? "Cannon map ready"
      : cannonMapFound
        ? "Cannon map skipped"
        : "No cannon map",
    report.duelSnapshots != null
      ? "Saved setups ready"
      : duelSnapshotsFound
        ? "Saved setups skipped"
        : "No saved setups",
    report.hiddenGearTiers != null
      ? "Hidden gear tiers ready"
      : foundKeys.has("sim_hidden_tiers_v1")
        ? "Hidden gear tiers skipped"
        : "No hidden gear tiers",
    report.denseCompareSort != null || report.irrelevantMonsterIds != null
      ? "Compare state ready"
      : compareFound
        ? "Compare state skipped"
        : "No compare state",
    report.priceSet ? "Prices ready" : pricesFound ? "Prices skipped" : "No prices",
    historyFound ? "Price history review-only" : "No price history",
    foundKeys.has("sim_planner_v1") ? "Planner review-only" : "No planner data",
    reviewNeeded || report.skippedFields.length > 0
      ? "Review-only decisions shown"
      : "No review-only data"
  ];
}

function createImportPlan(report: LegacySetupMigrationReport): string[] {
  const items: string[] = [];
  if (report.setup) items.push("Compatible setup fields into rewrite setup");
  if (report.customSetupsByMonster != null) {
    items.push("Legacy custom setups into rewrite monster-specific setups");
  }
  if (report.cannonByMonster != null) {
    items.push("Legacy cannon map into rewrite per-monster cannon settings");
  }
  if (report.duelSnapshots != null) {
    items.push("Legacy setup comparisons into saved setup storage");
  }
  if (report.lootPrefs != null) {
    items.push("Loot preferences into rewrite per-monster drop actions");
  }
  if (report.hiddenGearTiers != null) {
    items.push("Hidden gear tiers into rewrite gear-menu preferences");
  }
  if (report.denseCompareSort != null) items.push("Compare sort into dense compare state");
  if (report.irrelevantMonsterIds != null) {
    items.push("Compare hidden monsters into dense compare state");
  }
  if (report.hiscoresPlayer) items.push("Validated hiscores player into last-player storage");
  if (report.priceSet) items.push("Validated current price/alch maps as a PriceSet snapshot");
  return items;
}

function createReviewPlan(report: LegacySetupMigrationReport): string[] {
  const reviewItems = report.keyReview
    .filter((item) => item.found && item.disposition !== "migrate")
    .map(
      (item) => `${item.key}: ${legacyMigrationDispositionLabel(item.disposition)} - ${item.reason}`
    );
  const skippedItems = report.skippedFields.map((field) => {
    const disposition = field.disposition
      ? `${legacyMigrationDispositionLabel(field.disposition)} - `
      : "";
    const handling = field.handling ? `${field.handling} ` : "";
    return `${field.field}: ${disposition}${handling}${field.reason}`;
  });
  return [...reviewItems, ...skippedItems];
}

function countSkippedLegacyFields(report: LegacySetupMigrationReport, prefix: string): number {
  return report.skippedFields.filter((field) => field.field.startsWith(prefix)).length;
}

function countFoundLegacyKeys(
  report: LegacySetupMigrationReport,
  predicate: (key: LegacyStorageKey) => boolean
): number {
  return report.foundKeys.filter(predicate).length;
}

function createOutcomeItems(
  report: LegacySetupMigrationReport,
  importPlan: readonly string[]
): string[] {
  const customSetupImportCount = Object.keys(report.customSetupsByMonster ?? {}).length;
  const customSetupSkipCount = countSkippedLegacyFields(report, "sim_input_v3.monsterSetups");
  const cannonImportCount = Object.keys(report.cannonByMonster ?? {}).length;
  const cannonSkipCount = countSkippedLegacyFields(report, "sim_input_v3.cannonByMonster");
  const duelSnapshotImportCount = report.duelSnapshots?.snapshots.length ?? 0;
  const duelSnapshotSkipCount = countSkippedLegacyFields(report, "sim_input_v3.duelSetups");
  const reviewOnlyKeyCount = report.keyReview.filter(
    (item) => item.found && item.disposition === "review-only"
  ).length;
  const clearKeyCount = report.keyReview.filter((item) => item.clearDeletes).length;
  const priceHistoryKeyCount = countFoundLegacyKeys(report, (key) =>
    key.startsWith("sim_price_history")
  );
  const skippedCount = report.skippedFields.length;
  const items: string[] = [];

  items.push(
    `Import action: ${formatNumber(importPlan.length)} compatible area${
      importPlan.length === 1 ? "" : "s"
    } ready; legacy keys stay in storage.`
  );
  items.push(
    `Skipped status: ${formatNumber(skippedCount)} sanitized skip reason${
      skippedCount === 1 ? "" : "s"
    } shown below.`
  );
  items.push(
    `Review-only status: ${formatNumber(reviewOnlyKeyCount)} found key${
      reviewOnlyKeyCount === 1 ? "" : "s"
    } kept unless Clear is confirmed.`
  );
  if (customSetupImportCount > 0 || customSetupSkipCount > 0) {
    items.push(
      `Custom setups: ${formatNumber(customSetupImportCount)} importable, ${formatNumber(
        customSetupSkipCount
      )} skipped.`
    );
  }
  if (cannonImportCount > 0 || cannonSkipCount > 0) {
    items.push(
      `Cannon map: ${formatNumber(cannonImportCount)} importable, ${formatNumber(
        cannonSkipCount
      )} skipped.`
    );
  }
  if (duelSnapshotImportCount > 0 || duelSnapshotSkipCount > 0) {
    items.push(
      `Saved setups: ${formatNumber(duelSnapshotImportCount)} importable, ${formatNumber(
        duelSnapshotSkipCount
      )} skipped.`
    );
  }
  if (report.foundKeys.includes("sim_planner_v1")) {
    items.push(
      "Rewrite Planner V1 does not import legacy Planner state; Import and Keep leave it in legacy storage."
    );
  }
  if (priceHistoryKeyCount > 0) {
    items.push(
      `Full legacy price history is review-only in V1; ${formatNumber(
        priceHistoryKeyCount
      )} history key${priceHistoryKeyCount === 1 ? "" : "s"} detected and not migrated.`
    );
  }
  items.push(
    `Keep action: dismisses this review and keeps ${formatNumber(report.foundKeys.length)} found legacy key${
      report.foundKeys.length === 1 ? "" : "s"
    } untouched.`
  );
  items.push(
    `Clear action: deletes ${formatNumber(clearKeyCount)} known legacy key${
      clearKeyCount === 1 ? "" : "s"
    } only after confirmation; unknown keys are not touched.`
  );
  return items;
}

function isImportReady(report: LegacySetupMigrationReport): boolean {
  // Preserve the current App predicate. Duel snapshots alone intentionally do
  // not make the button ready; the specification records that as a follow-up.
  return (
    report.setup != null ||
    report.customSetupsByMonster != null ||
    report.cannonByMonster != null ||
    report.lootPrefs != null ||
    report.hiddenGearTiers != null ||
    report.denseCompareSort != null ||
    report.irrelevantMonsterIds != null ||
    report.hiscoresPlayer != null ||
    report.priceSet != null
  );
}

export function createLegacyMigrationViewModel(input: {
  report: LegacySetupMigrationReport;
  hasRewriteSetup: boolean;
}): LegacyMigrationViewModel {
  const { report, hasRewriteSetup } = input;
  const importPlan = createImportPlan(report);
  const importReady = isImportReady(report);
  const clearKeys = report.keyReview.filter((item) => item.clearDeletes).map((item) => item.key);

  return {
    tone: !hasRewriteSetup && report.foundKeys.includes(LEGACY_INPUT_STORAGE_KEY) ? "ready" : "",
    statusLabel: importReady ? `${report.importedFields.length} compatible fields` : "review only",
    importReady,
    summaryItems: createSummaryItems(report),
    outcomeItems: createOutcomeItems(report, importPlan),
    importPlan,
    reviewPlan: createReviewPlan(report),
    keyRows: report.keyReview.map((item) => ({
      key: item.key,
      label: item.label,
      found: item.found,
      foundLabel: item.found ? "found" : "not found",
      dispositionLabel: legacyMigrationDispositionLabel(item.disposition),
      handling: item.handling,
      reason: item.reason,
      clearLabel: item.clearDeletes ? "delete on clear" : "not present"
    })),
    clearKeyList: clearKeys.join(", "),
    showExistingRewriteSetupNotice: hasRewriteSetup,
    showUnsupportedDataNotice: report.warnings.length > 0
  };
}

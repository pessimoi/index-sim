import { DEFAULT_DENSE_COMPARE_SORT_STATE } from "../app/state/dense-compare";
import { createDuelSnapshot } from "../app/state/duel-snapshots";
import {
  LEGACY_INPUT_STORAGE_KEY,
  createLegacyStorageKeyReview,
  type LegacySetupMigrationReport,
  type LegacyStorageKey
} from "../app/state/legacy-storage-migration";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import { createLegacyMigrationViewModel } from "../app/view-models/legacy-migration";
import type { PriceSet } from "../domain/shared";

function report(
  foundKeys: LegacyStorageKey[] = [],
  overrides: Partial<LegacySetupMigrationReport> = {}
): LegacySetupMigrationReport {
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
    duelSnapshots: null,
    ...overrides
  };
}

const priceSet: PriceSet = {
  id: "legacy-prices",
  label: "Legacy prices",
  source: "imported",
  createdAt: "2026-07-14T12:00:00.000Z",
  itemPrices: { lobster: 200 },
  alchValues: { lobster: 0 }
};

const singleAreaReports: Array<{
  label: string;
  overrides: Partial<LegacySetupMigrationReport>;
}> = [
  { label: "setup", overrides: { setup: DEFAULT_FORM_STATE } },
  { label: "custom setup", overrides: { customSetupsByMonster: {} } },
  { label: "cannon", overrides: { cannonByMonster: {} } },
  {
    label: "saved setup",
    overrides: {
      duelSnapshots: {
        snapshots: [createDuelSnapshot("single-duel", "Single Duel", DEFAULT_FORM_STATE)]
      }
    }
  },
  { label: "loot preference", overrides: { lootPrefs: {} } },
  { label: "hidden tier", overrides: { hiddenGearTiers: {} } },
  { label: "Compare sort", overrides: { denseCompareSort: DEFAULT_DENSE_COMPARE_SORT_STATE } },
  { label: "hidden monster", overrides: { irrelevantMonsterIds: [] } },
  { label: "Hiscores player", overrides: { hiscoresPlayer: "Fixture Player" } },
  { label: "PriceSet", overrides: { priceSet } }
];

describe("legacy migration view model", () => {
  it("presents an empty report without inventing importable data", () => {
    const viewModel = createLegacyMigrationViewModel({
      report: report(),
      hasRewriteSetup: false
    });

    expect(viewModel).toMatchObject({
      tone: "",
      statusLabel: "review only",
      importReady: false,
      importPlan: [],
      reviewPlan: [],
      clearKeyList: "",
      showExistingRewriteSetupNotice: false,
      showUnsupportedDataNotice: false
    });
    expect(viewModel.summaryItems).toEqual([
      "No legacy setup",
      "No hiscores player",
      "No loot preferences",
      "No custom setups",
      "No cannon map",
      "No saved setups",
      "No hidden gear tiers",
      "No compare state",
      "No prices",
      "No price history",
      "No planner data",
      "No review-only data"
    ]);
    expect(viewModel.outcomeItems).toEqual(
      expect.arrayContaining([
        "Import action: 0 compatible areas ready; legacy keys stay in storage.",
        "Keep action: dismisses this review and keeps 0 found legacy keys untouched.",
        "Clear action: deletes 0 known legacy keys only after confirmation; unknown keys are not touched."
      ])
    );
  });

  it("maps every compatible family, skip and key policy to sanitized presentation", () => {
    const foundKeys: LegacyStorageKey[] = [
      LEGACY_INPUT_STORAGE_KEY,
      "sim_planner_v1",
      "sim_loot_prefs_v1",
      "sim_hidden_tiers_v1",
      "sim_compare_sort_v1",
      "sim_irrelevant_v1",
      "sim_prices_v1",
      "sim_price_history_v1",
      "sim_hiscore_player"
    ];
    const richReport = report(foundKeys, {
      importedFields: ["combatStyle", "monsterId", "prices"],
      skippedFields: [
        {
          field: "sim_input_v3.monsterSetups.bad",
          reason: "Invalid setup",
          disposition: "migrate",
          handling: "Skipped."
        }
      ],
      warnings: ["unsupported legacy row"],
      setup: DEFAULT_FORM_STATE,
      hiscoresPlayer: "zezima",
      priceSet,
      lootPrefs: { goblin: { coins: "loot" } },
      hiddenGearTiers: { bronze: true },
      denseCompareSort: DEFAULT_DENSE_COMPARE_SORT_STATE,
      irrelevantMonsterIds: ["goblin"],
      customSetupsByMonster: {},
      cannonByMonster: {},
      duelSnapshots: {
        snapshots: [createDuelSnapshot("legacy-duel", "Legacy setup", DEFAULT_FORM_STATE)]
      }
    });

    const viewModel = createLegacyMigrationViewModel({
      report: richReport,
      hasRewriteSetup: true
    });

    expect(viewModel.tone).toBe("");
    expect(viewModel.statusLabel).toBe("10 compatible areas");
    expect(viewModel.importReady).toBe(true);
    expect(viewModel.importPlan).toEqual(
      expect.arrayContaining([
        "Compatible setup fields into rewrite setup",
        "Legacy custom setups into rewrite monster-specific setups",
        "Legacy cannon map into rewrite per-monster cannon settings",
        "Legacy setup comparisons into saved setup storage",
        "Loot preferences into rewrite per-monster drop actions",
        "Hidden gear tiers into rewrite gear-menu preferences",
        "Compare sort into dense compare state",
        "Compare hidden monsters into dense compare state",
        "Validated hiscores player into last-player storage",
        "Validated current price/alch maps as a PriceSet snapshot"
      ])
    );
    expect(viewModel.reviewPlan).toEqual(
      expect.arrayContaining([
        expect.stringContaining("sim_planner_v1: review only"),
        expect.stringContaining("sim_price_history_v1: review only"),
        "sim_input_v3.monsterSetups.bad: migrate - Skipped. Invalid setup"
      ])
    );
    expect(viewModel.outcomeItems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Saved setups: 1 importable"),
        expect.stringContaining("Rewrite Planner V1 does not import"),
        expect.stringContaining("Full legacy price history is review-only")
      ])
    );
    expect(viewModel.keyRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "sim_planner_v1",
          foundLabel: "found",
          dispositionLabel: "review only",
          clearLabel: "delete on clear"
        })
      ])
    );
    expect(viewModel.clearKeyList).toContain(LEGACY_INPUT_STORAGE_KEY);
    expect(viewModel.showExistingRewriteSetupNotice).toBe(true);
    expect(viewModel.showUnsupportedDataNotice).toBe(true);
    expect(JSON.stringify(viewModel)).not.toContain("itemPrices");
  });

  it("makes a validated Duel-only plan actionable with aligned area copy", () => {
    const duelOnly = report([LEGACY_INPUT_STORAGE_KEY], {
      duelSnapshots: {
        snapshots: [createDuelSnapshot("duel-only", "Duel only", DEFAULT_FORM_STATE)]
      }
    });
    const viewModel = createLegacyMigrationViewModel({
      report: duelOnly,
      hasRewriteSetup: false
    });

    expect(viewModel.importPlan).toContain("Legacy setup comparisons into saved setup storage");
    expect(viewModel.importReady).toBe(true);
    expect(viewModel.statusLabel).toBe("1 compatible area");
    expect(viewModel.tone).toBe("ready");
    expect(viewModel.summaryItems).toContain("Saved setups ready");
    expect(viewModel.outcomeItems).toContain(
      "Import action: 1 compatible area ready; legacy keys stay in storage."
    );
  });

  it("keeps a defensive empty Duel state non-actionable", () => {
    const viewModel = createLegacyMigrationViewModel({
      report: report([LEGACY_INPUT_STORAGE_KEY], {
        duelSnapshots: { snapshots: [] }
      }),
      hasRewriteSetup: false
    });

    expect(viewModel.importPlan).toEqual([]);
    expect(viewModel.importReady).toBe(false);
    expect(viewModel.statusLabel).toBe("review only");
    expect(viewModel.summaryItems).toContain("Saved setups skipped");
  });

  it.each(singleAreaReports)("makes the single $label plan item actionable", ({ overrides }) => {
    const viewModel = createLegacyMigrationViewModel({
      report: report([LEGACY_INPUT_STORAGE_KEY], overrides),
      hasRewriteSetup: false
    });

    expect(viewModel.importPlan).toHaveLength(1);
    expect(viewModel.importReady).toBe(true);
    expect(viewModel.statusLabel).toBe("1 compatible area");
  });

  it("uses plan areas instead of field-level audit findings for mixed status copy", () => {
    const viewModel = createLegacyMigrationViewModel({
      report: report([LEGACY_INPUT_STORAGE_KEY], {
        importedFields: ["combatStyle", "monsterId", "weaponId", "another-field"],
        setup: DEFAULT_FORM_STATE,
        duelSnapshots: {
          snapshots: [createDuelSnapshot("mixed-duel", "Mixed Duel", DEFAULT_FORM_STATE)]
        }
      }),
      hasRewriteSetup: false
    });

    expect(viewModel.importPlan).toHaveLength(2);
    expect(viewModel.statusLabel).toBe("2 compatible areas");
    expect(viewModel.outcomeItems).toContain(
      "Import action: 2 compatible areas ready; legacy keys stay in storage."
    );
  });
});

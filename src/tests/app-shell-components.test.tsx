import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppHeader } from "../app/components/shell/app-header";
import { LegacyMigrationPanel } from "../app/components/shell/legacy-migration-panel";
import { SharedSetupReview } from "../app/components/shell/shared-setup-review";
import { WorkbenchShell } from "../app/components/shell/workbench-shell";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import {
  createAppShellSetupViewModel,
  createWorkbenchResultViewModel,
  type SharedSetupReviewViewModel
} from "../app/view-models/app-shell";
import type { LegacyMigrationViewModel } from "../app/view-models/legacy-migration";

const noOp = () => undefined;
const asyncNoOp = async () => undefined;

function inOrder(markup: string, fragments: readonly string[]): void {
  let previous = -1;
  for (const fragment of fragments) {
    const next = markup.indexOf(fragment, previous + 1);
    expect(next, `missing or out-of-order fragment: ${fragment}`).toBeGreaterThan(previous);
    previous = next;
  }
}

describe("app shell components", () => {
  it("keeps skip link, header, Hiscores, file actions and notices in order", () => {
    const markup = renderToStaticMarkup(
      <AppHeader
        hiscores={{
          statusLabel: "disabled",
          available: false,
          player: "",
          response: null,
          busy: false,
          previewOpen: false,
          notice: null,
          previewRows: [],
          canApply: false,
          onPlayerChange: noOp,
          onLookup: asyncNoOp,
          onPreviewOpenChange: noOp,
          onApply: noOp
        }}
        priceImportNotice={{
          tone: "error",
          message: "Price fixture",
          surface: "topbar"
        }}
        setupImportNotice={{ tone: "success", message: "Setup fixture" }}
        shareCreateNotice="Share fixture"
        shareButtonRef={null}
        onImportPrices={asyncNoOp}
        onImportSetup={asyncNoOp}
        onExportSetup={noOp}
        onShareSetup={noOp}
      />
    );

    inOrder(markup, [
      'class="skip-link"',
      'class="topbar"',
      'aria-label="Hiscores"',
      "Import prices",
      "Import setup",
      "Export setup",
      "Share setup",
      "Price fixture",
      "Setup fixture",
      "Share fixture"
    ]);
    expect(markup).toContain('href="#workbench-active-panel"');
    expect(markup.match(/accept="application\/json,.json"/g)).toHaveLength(2);
  });

  it("keeps shared ready and invalid review branches exact", () => {
    const ready: SharedSetupReviewViewModel = {
      status: "ready",
      tone: "warning",
      statusLabel: "Ready to load",
      targetLine: "Goblin · melee",
      cannonLabel: "Cannon on",
      lootChoiceLabel: "2 loot choices",
      gameDataWarning: "Different game-data version. Available ids were validated before loading.",
      droppedLootWarning: "2 stale loot choices will be skipped."
    };
    const readyMarkup = renderToStaticMarkup(
      <SharedSetupReview viewModel={ready} onLoad={noOp} onDismiss={noOp} />
    );
    const errorMarkup = renderToStaticMarkup(
      <SharedSetupReview
        viewModel={{
          status: "error",
          tone: "error",
          statusLabel: "Invalid",
          message: "Invalid fixture"
        }}
        onLoad={noOp}
        onDismiss={noOp}
      />
    );

    expect(readyMarkup).toContain('class="shared-setup-strip warning"');
    expect(readyMarkup).toContain("Load setup");
    expect(readyMarkup).toContain('aria-label="Shared setup summary"');
    expect(errorMarkup).toContain('<p role="alert">Invalid fixture</p>');
    expect(errorMarkup).not.toContain("Load setup");
    expect(errorMarkup).toContain("Dismiss");
  });

  it("keeps legacy key table and clear confirmation branches", () => {
    const viewModel: LegacyMigrationViewModel = {
      tone: "ready",
      statusLabel: "1 compatible fields",
      importReady: true,
      summaryItems: ["Legacy setup ready"],
      outcomeItems: ["Import action fixture"],
      importPlan: ["Compatible setup fields into rewrite setup"],
      reviewPlan: ["Planner review only"],
      keyRows: [
        {
          key: "sim_input_v3",
          label: "Saved combat setup",
          found: true,
          foundLabel: "found",
          dispositionLabel: "migrate",
          handling: "Import compatible fields.",
          reason: "Fixture reason",
          clearLabel: "delete on clear"
        }
      ],
      clearKeyList: "sim_input_v3",
      showExistingRewriteSetupNotice: true,
      showUnsupportedDataNotice: true
    };
    const initial = renderToStaticMarkup(
      <LegacyMigrationPanel
        viewModel={viewModel}
        clearPending={false}
        onImport={noOp}
        onKeep={noOp}
        onRequestClear={noOp}
        onConfirmClear={noOp}
        onCancelClear={noOp}
      />
    );
    const confirming = renderToStaticMarkup(
      <LegacyMigrationPanel
        viewModel={viewModel}
        clearPending
        onImport={noOp}
        onKeep={noOp}
        onRequestClear={noOp}
        onConfirmClear={noOp}
        onCancelClear={noOp}
      />
    );

    expect(initial).toContain('aria-label="Legacy storage key review"');
    expect(initial).toContain("Clear legacy data");
    expect(initial).not.toContain("Confirm clear");
    expect(confirming).toContain("Clear will remove these known legacy keys: sim_input_v3.");
    expect(confirming).toContain("Confirm clear");
    expect(confirming).toContain("Cancel");
  });

  it("keeps workbench landmarks, tab state, shell strips, children and rail in order", () => {
    const shellSetup = createAppShellSetupViewModel({
      form: DEFAULT_FORM_STATE,
      hasCurrentCustomSetup: false,
      activeSetupIsCustom: false,
      weaponName: "Rune scimitar",
      ammoName: "None",
      spellName: "None",
      styleName: "Accurate",
      effectiveAccuracy: 75,
      effectiveDamage: 80,
      derivedAccuracyBonus: 5,
      derivedDamageBonus: 6,
      derivedAttackSpeedSec: 2.4,
      setupRequirementWarningCount: 0,
      potionCarrySummary: "2 sets",
      prayerRestoreSourceSummary: "None",
      lootPolicySummary: "Loot defaults"
    });
    const result = createWorkbenchResultViewModel({
      effectiveDps: 4,
      maxHit: 10,
      hitChance: 0.5,
      ttkSec: 30,
      killsPerHour: 100,
      effectiveXpPerHour: 20_000,
      gpPerHour: 5_000,
      effectiveNetGpPerHour: -1_000,
      supplyCostPerKill: 60,
      gpPerKill: 50,
      supplyGapPerKill: 10,
      supplyCostsExceedLoot: true,
      risk: null
    });
    const markup = renderToStaticMarkup(
      <WorkbenchShell
        activeTab="stats"
        form={DEFAULT_FORM_STATE}
        shellSetup={shellSetup}
        result={result}
        currentMonsterLabel="Fixture monster"
        hasCurrentCustomSetup={false}
        activeSetupIsCustom={false}
        monsterOptions={[{ id: DEFAULT_FORM_STATE.monsterId, label: "Fixture monster" }]}
        styleOptions={[{ id: DEFAULT_FORM_STATE.styleId, label: "Accurate" }]}
        spellOptions={[{ id: DEFAULT_FORM_STATE.spellId, label: "None" }]}
        foodPerKill={1.5}
        moneyWarnings={[]}
        activeAssumptions={{
          statusLabel: "No active assumptions",
          totalCount: 0,
          hasActiveRows: false,
          visibleRows: [],
          hiddenRows: [],
          hiddenCount: 0
        }}
        actions={{
          activateTab: noOp,
          selectCombatStyle: noOp,
          updateLevel: noOp,
          setStyle: noOp,
          selectTarget: noOp,
          createCustomSetup: noOp,
          editDefaultSetup: noOp,
          editCustomSetup: noOp,
          removeCurrentCustomSetup: noOp,
          setSpell: noOp,
          setPrimaryPrayer: noOp,
          setPrimaryBoost: noOp,
          setManualOverride: noOp,
          reviewActiveAssumption: noOp,
          resetActiveAssumption: noOp
        }}
        rail={createElement("aside", { "aria-label": "Monster information" }, "Rail fixture")}
      >
        <section aria-label="Feature pane fixture">Pane fixture</section>
      </WorkbenchShell>
    );

    inOrder(markup, [
      'aria-label="Setup quick navigation"',
      'aria-label="Workbench shell"',
      'aria-label="Player sidebar"',
      'aria-label="Active player setup"',
      'aria-label="Setup context"',
      'aria-label="Workbench tabs"',
      'aria-label="Active workbench pane"',
      'aria-label="Combat setup"',
      'aria-label="Simulation results"',
      'aria-label="Net GP explanation"',
      'aria-label="Feature pane fixture"',
      'aria-label="Monster information"'
    ]);
    expect(markup).toContain(
      'id="workbench-tab-stats" type="button" role="tab" class="active" aria-selected="true"'
    );
    expect(markup).toContain('id="workbench-tab-loadout" type="button" role="tab"');
    expect(markup).toContain("Melee setup");
    expect(markup).toContain("Active setup");
    expect(markup).toContain("Rune scimitar");
    expect(markup).toContain("Requirements met");
    expect(markup).toContain("Open loadout");
    expect(markup).toContain("View stats");
    expect(markup).toContain("Effective XP/hr");
    expect(markup).not.toContain('aria-label="Effective trip rates"');
    expect(markup).toContain('hidden=""');
  });
});

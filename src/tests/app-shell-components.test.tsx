import { createElement, createRef, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppHeader } from "../app/components/shell/app-header";
import {
  ActionStatus,
  PendingUndoStatus,
  type PendingUndo
} from "../app/components/app-presenters";
import { globalStatusAnnouncement } from "../app/view-models/global-status";
import { LegacyMigrationPanel } from "../app/components/shell/legacy-migration-panel";
import { SharedSetupReview } from "../app/components/shell/shared-setup-review";
import { WorkbenchShell } from "../app/components/shell/workbench-shell";
import {
  scrollLeftForAdjacentTab,
  scrollLeftForVisibleItem
} from "../app/components/shell/workbench-tab-scroll";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import {
  createAppShellSetupViewModel,
  createWorkbenchResultViewModel,
  type SharedSetupReviewViewModel
} from "../app/view-models/app-shell";
import type { LegacyMigrationViewModel } from "../app/view-models/legacy-migration";
import type { SetupTransferChangeReview } from "../app/state/setup-transfer-changes";

const noOp = () => undefined;
const asyncNoOp = async () => undefined;
const emptySharedChangeReview: SetupTransferChangeReview = {
  kind: "shared-link",
  currentFingerprint: "current",
  incomingFingerprint: "incoming",
  changeCount: 1,
  groups: [],
  includedScope: ["Active setup"],
  excludedScope: ["Prices"]
};

function inOrder(markup: string, fragments: readonly string[]): void {
  let previous = -1;
  for (const fragment of fragments) {
    const next = markup.indexOf(fragment, previous + 1);
    expect(next, `missing or out-of-order fragment: ${fragment}`).toBeGreaterThan(previous);
    previous = next;
  }
}

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const children = (node.props as { children?: ReactNode }).children;
  return [node, ...elements(children)];
}

describe("app shell components", () => {
  it("renders one labelled polite Undo surface and suppresses its duplicate global announcement", () => {
    const pendingUndo: PendingUndo = {
      id: "undo-1",
      label: "A long reset result that must remain visible without losing the native action",
      restoreLabel: "Restored reset",
      createdAt: 1,
      restore: noOp
    };
    const markup = renderToStaticMarkup(
      <PendingUndoStatus pendingUndo={pendingUndo} onUndo={noOp} />
    );

    expect(markup.match(/role="status"/g)).toHaveLength(1);
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-label="Local state undo"');
    expect(markup).toContain("A long reset result");
    expect(markup).toContain(">Undo</button>");
    expect(globalStatusAnnouncement(pendingUndo.label, pendingUndo)).toBe("");
    expect(globalStatusAnnouncement("Unrelated status", pendingUndo)).toBe("Unrelated status");
    expect(globalStatusAnnouncement("Visible transfer", null, ["Visible transfer"])).toBe("");
    expect(globalStatusAnnouncement("Loaded scheduled prices", null, ["Loaded scheduled prices"])).toBe(
      ""
    );
    expect(renderToStaticMarkup(<PendingUndoStatus pendingUndo={null} onUndo={noOp} />)).toBe("");
  });

  it("renders one visible polite action status for unsuppressed global outcomes", () => {
    const markup = renderToStaticMarkup(<ActionStatus message="Current loadout is already best" />);

    expect(markup.match(/role="status"/g)).toHaveLength(1);
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-label="Action status"');
    expect(markup).toContain("Current loadout is already best");
    expect(renderToStaticMarkup(<ActionStatus message="" />)).toBe("");
  });

  it("computes minimal bounded workbench-tab scroll targets", () => {
    const tabs = [
      { start: 0, end: 80 },
      { start: 84, end: 180 },
      { start: 184, end: 280 },
      { start: 284, end: 380 }
    ];

    expect(scrollLeftForVisibleItem(0, 200, 380, tabs[1]!)).toBe(0);
    expect(scrollLeftForVisibleItem(0, 200, 380, tabs[2]!)).toBe(80);
    expect(scrollLeftForVisibleItem(180, 200, 380, tabs[0]!)).toBe(0);
    expect(scrollLeftForAdjacentTab("right", 0, 200, 380, tabs)).toBe(80);
    expect(scrollLeftForAdjacentTab("left", 180, 200, 380, tabs)).toBe(84);
    expect(scrollLeftForAdjacentTab("right", 180, 200, 380, tabs)).toBe(180);
  });

  it("keeps skip link, header, Hiscores, setup actions and notices in order", () => {
    const markup = renderToStaticMarkup(
      <AppHeader
        activeGameRevisionLabel="Revision 274"
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
          onApply: noOp,
          onEditManually: noOp
        }}
        setupImportPhase="idle"
        setupImportNotice={{ tone: "success", message: "Setup fixture" }}
        setupImportInputRef={null}
        shareCreateNotice="Share fixture"
        shareButtonRef={null}
        onImportSetup={asyncNoOp}
        onExportSetup={noOp}
        onShareSetup={noOp}
        onOpenWorkspaceBackup={noOp}
      />
    );

    inOrder(markup, [
      'class="skip-link"',
      'class="topbar"',
      "Revision 274",
      'aria-label="Hiscores"',
      "Download full Workspace backup",
      "Review combat setup file",
      "Export combat setup",
      "Share setup",
      "Setup fixture",
      "Share fixture"
    ]);
    expect(markup).toContain('href="#workbench-active-panel"');
    expect(markup).toContain('aria-label="Active game data: Revision 274"');
    expect(markup).toContain(
      "Combat setup files replace setup, custom-monster, cannon and Dense preferences. They are not full Workspace backups and do not include loot or prices."
    );
    expect(markup.match(/aria-describedby="combat-setup-transfer-scope"/g)).toHaveLength(3);
    expect(markup.match(/accept="application\/json,.json"/g)).toHaveLength(1);
    expect(markup).not.toContain("Import prices");
  });

  it("disables only setup file selection while a setup is being reviewed", () => {
    const markup = renderToStaticMarkup(
      <AppHeader
        activeGameRevisionLabel="Revision 274"
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
          onApply: noOp,
          onEditManually: noOp
        }}
        setupImportPhase="reading"
        setupImportNotice={null}
        setupImportInputRef={null}
        shareCreateNotice={null}
        shareButtonRef={null}
        onImportSetup={asyncNoOp}
        onExportSetup={noOp}
        onShareSetup={noOp}
        onOpenWorkspaceBackup={noOp}
      />
    );

    expect(markup).toContain("Reviewing setup file…");
    expect(markup).toContain(
      'type="file" accept="application/json,.json" aria-describedby="combat-setup-transfer-scope" disabled=""'
    );
    expect(markup).not.toContain('<button type="button" disabled=""');
  });

  it("keeps shared ready and invalid review branches exact", () => {
    const ready: SharedSetupReviewViewModel = {
      status: "ready",
      tone: "warning",
      statusLabel: "Ready to load",
      targetLine: "Goblin · melee",
      cannonLabel: "Cannon on",
      lootChoiceLabel: "2 loot choices",
      contextMessage:
        "Created with another Revision 274 snapshot. Available ids are compatible, but results may differ.",
      contextTone: "warning",
      droppedLootWarning: "2 stale loot choices will be skipped.",
      stale: false,
      canLoad: true,
      changeReview: emptySharedChangeReview
    };
    const readyMarkup = renderToStaticMarkup(
      <SharedSetupReview viewModel={ready} onLoad={noOp} onRefresh={noOp} onDismiss={noOp} />
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
        onRefresh={noOp}
        onDismiss={noOp}
      />
    );
    const staleMarkup = renderToStaticMarkup(
      <SharedSetupReview
        viewModel={{ ...ready, stale: true, canLoad: false, statusLabel: "Refresh required" }}
        onLoad={noOp}
        onRefresh={noOp}
        onDismiss={noOp}
      />
    );
    const noOpMarkup = renderToStaticMarkup(
      <SharedSetupReview
        viewModel={{
          ...ready,
          statusLabel: "No changes",
          canLoad: false,
          changeReview: { ...emptySharedChangeReview, changeCount: 0 }
        }}
        onLoad={noOp}
        onRefresh={noOp}
        onDismiss={noOp}
      />
    );

    expect(readyMarkup).toContain('class="shared-setup-strip warning"');
    expect(readyMarkup).toContain("Load setup");
    expect(readyMarkup).toContain('aria-label="Shared setup summary"');
    expect(readyMarkup).toContain("Included in this link");
    expect(staleMarkup).toContain("Refresh comparison");
    expect(staleMarkup).not.toContain(">Load setup</button>");
    expect(noOpMarkup).toContain("This link has no applicable changes.");
    expect(noOpMarkup).toContain('<button type="button" disabled="">Load setup</button>');
    expect(errorMarkup).toContain('<p role="alert">Invalid fixture</p>');
    expect(errorMarkup).not.toContain("Load setup");
    expect(errorMarkup).toContain("Dismiss");
  });

  it("keeps legacy key table and clear confirmation branches", () => {
    const viewModel: LegacyMigrationViewModel = {
      tone: "ready",
      statusLabel: "1 compatible area",
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
      setupMode: "default",
      hasCurrentCustomSetup: false,
      currentMonsterLabel: "Fixture monster",
      setupPersistenceKind: "saved",
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
      effectiveKph: 60,
      effectiveXpPerHour: 20_000,
      effectiveGpPerHour: 3_000,
      effectiveNetGpPerHour: -1_000,
      supplyCostPerKill: 60,
      gpPerKill: 50,
      supplyGapPerKill: 10,
      supplyCostsExceedLoot: true,
      risk: null
    });
    const reviewCalls: unknown[] = [];
    const directAction = {
      kind: "correct-price" as const,
      itemId: "lobster",
      noticeId: "missing-price:lobster:supply:",
      label: "Correct price" as const
    };
    const shellElement = (
      <WorkbenchShell
        activeTab="stats"
        activePaneFamily="stats"
        activePaneLoadState="ready"
        form={DEFAULT_FORM_STATE}
        shellSetup={shellSetup}
        result={result}
        currentMonsterLabel="Fixture monster"
        setupModeHeadingRef={createRef<HTMLElement>()}
        resetSetupButtonRef={createRef<HTMLButtonElement>()}
        playerLevelGroupRef={createRef<HTMLDivElement>()}
        monsterOptions={[{ id: DEFAULT_FORM_STATE.monsterId, label: "Fixture monster" }]}
        styleOptions={[{ id: DEFAULT_FORM_STATE.styleId, label: "Accurate" }]}
        spellOptions={[{ id: DEFAULT_FORM_STATE.spellId, label: "None" }]}
        foodPerKill={1.5}
        priceNotices={{
          issues: [
            {
              noticeId: "missing-price:lobster:supply:",
              code: "missing-price",
              itemId: "lobster",
              itemLabel: "Lobster",
              itemDisplayLabel: {
                name: "Lobster",
                technicalId: "lobster",
                source: "game-data"
              },
              level: "issue",
              consumer: "supply",
              affectsCurrentResult: true,
              summary: "Missing price",
              detail: "Lobster has no usable price.",
              action: directAction
            }
          ],
          notes: [],
          all: [],
          byLootRowId: {},
          resultAction: directAction
        }}
        activeAssumptions={{
          statusLabel: "No active assumptions",
          totalCount: 0,
          hasActiveRows: false,
          visibleRows: [],
          hiddenRows: [],
          hiddenCount: 0
        }}
        setupReview={null}
        actions={{
          activateTab: noOp,
          routeToTab: noOp,
          selectCombatStyle: noOp,
          updateLevel: noOp,
          setStyle: noOp,
          selectTarget: noOp,
          createCustomSetup: noOp,
          editDefaultSetup: noOp,
          editCustomSetup: noOp,
          removeCurrentCustomSetup: noOp,
          resetActiveSetup: noOp,
          setSpell: noOp,
          setPrimaryPrayer: noOp,
          setPrimaryBoost: noOp,
          setManualOverride: noOp,
          reviewPriceData: noOp,
          reviewPriceItem: (action) => reviewCalls.push(action),
          reviewActiveAssumption: noOp,
          resetActiveAssumption: noOp
        }}
        rail={createElement("aside", { "aria-label": "Monster information" }, "Rail fixture")}
      >
        <section aria-label="Feature pane fixture">Pane fixture</section>
      </WorkbenchShell>
    );
    const tree = WorkbenchShell(shellElement.props);
    const markup = renderToStaticMarkup(tree);

    inOrder(markup, [
      'aria-label="Setup quick navigation"',
      'aria-label="Workbench shell"',
      'aria-label="Player sidebar"',
      'aria-label="Player setup"',
      'id="player-level-fields"',
      'aria-label="Mobile result summary"',
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
    expect(markup.match(/role="tablist"/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="Scroll workbench tabs left"');
    expect(markup).toContain('aria-label="Scroll workbench tabs right"');
    expect(markup).toContain("More tabs");
    expect(markup).toContain('aria-label="All workbench tabs"');
    expect(markup).toContain('aria-current="page"');
    expect(markup.match(/class="visually-hidden">Damage per second: 4\.00/g)).toHaveLength(3);
    expect(markup.match(/>EFF\. XP\/HR<\/span>/g)).toHaveLength(3);
    expect(markup.match(/>EFF\. NET GP\/HR<\/span>/g)).toHaveLength(3);
    expect(markup).toContain(
      'id="workbench-tab-stats" type="button" role="tab" class="active" aria-selected="true"'
    );
    expect(markup).toContain('id="workbench-tab-loadout" type="button" role="tab"');
    expect(markup).toContain("Melee setup");
    expect(markup).toContain(
      'id="player-level-fields" class="level-grid sidebar-levels" aria-label="Player levels" tabindex="-1"'
    );
    expect(markup).toContain("Active setup");
    expect(markup).toContain("Rune scimitar");
    expect(markup).not.toContain("Monster details");
    const compareMarkup = renderToStaticMarkup(
      WorkbenchShell({
        ...shellElement.props,
        activeTab: "compare",
        activePaneFamily: "compare"
      })
    );
    expect(compareMarkup).toContain('class="mobile-monster-jump" href="#monster-card-panel"');
    expect(compareMarkup).toContain("Monster details");
    expect(markup).toContain("Requirements met");
    expect(markup).toContain('aria-label="Melee setup">Melee setup</button>');
    expect(markup).not.toContain("Open loadout");
    expect(markup).toContain("View stats");
    expect(markup).toContain("Editing default");
    expect(markup).toContain("Default applies to monsters without their own setup");
    expect(markup).toContain("Saved locally");
    expect(markup).toContain("Changes save automatically in this browser.");
    expect(markup).toContain(
      'aria-label="Create monster setup" title="Create monster setup">Create monster setup</button>'
    );
    expect(markup).not.toContain('aria-label="Edit default"');
    expect(markup).not.toContain('aria-label="Edit custom"');
    expect(markup).not.toContain(">Edit</button>");
    expect(markup).not.toContain("Remove monster setup");
    expect(markup).toContain('aria-label="Reset active setup" title="Reset active setup"');
    expect(markup).toContain("EFF. XP/HR");
    expect(markup).toContain(">SPD</label>");
    expect(markup).toContain('aria-label="Attack speed in seconds"');
    expect(markup).toContain(">F/KL</span>");
    expect(markup).toContain('aria-label="Food per kill: 1.50"');
    expect(markup).toContain('class="visually-hidden">Time to kill: 30.0 s');
    expect(markup).toContain(
      'class="visually-hidden">Effective experience points per hour: 20,000'
    );
    expect(markup).toContain('class="visually-hidden">Effective kills per hour: 60');
    expect(markup).toContain('class="visually-hidden">Effective gross gold pieces per hour: 3,000');
    expect(markup).toContain('class="visually-hidden">Gold pieces per kill: 50');
    expect(markup).toContain('aria-label="Price data issue"');
    expect(markup).toContain("Price data incomplete");
    expect(markup).toContain('aria-label="Correct price for Lobster"');
    expect(markup).not.toContain("Review price data");
    expect(markup).not.toContain("Price warnings");
    expect(markup).not.toContain('aria-label="Effective trip rates"');
    expect(markup).toContain('hidden=""');
    const correctionButton = elements(tree).find(
      (element) =>
        element.type === "button" &&
        (element.props as { "aria-label"?: string })["aria-label"] === "Correct price for Lobster"
    );
    (correctionButton!.props as { onClick(): void }).onClick();
    expect(reviewCalls).toEqual([directAction]);
  });
});

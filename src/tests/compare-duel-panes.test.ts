import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadBundledLegacyContext } from "../adapters/legacy-runtime";
import {
  ComparePane,
  type ComparePaneActions,
  type ComparePaneModel
} from "../app/components/panes/compare-pane";
import {
  DuelPane,
  type DuelPaneActions,
  type DuelPaneModel
} from "../app/components/panes/duel-pane";
import { DEFAULT_DENSE_COMPARE_STATE } from "../app/state/dense-compare";
import { createDuelSnapshot } from "../app/state/duel-snapshots";
import { createSavedSetupMergePlan } from "../app/state/saved-setup-merge";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import { createDenseCompareRows, createDenseCompareScaleModel } from "../app/view-models/compare";
import {
  DEFAULT_DUEL_COMPARISON_SORT_STATE,
  DEFAULT_DUEL_MATRIX_SORT_STATE,
  createDuelComparisonViewModel,
  createSavedSetupMergeReviewViewModel,
  type DuelMatrixViewModel
} from "../app/view-models/duel";

const noOp = () => undefined;

const compareActions: ComparePaneActions = {
  setDenseMonsterFilter: noOp,
  setDenseDropFilter: noOp,
  setDenseShowIrrelevant: noOp,
  resetDenseFilters: noOp,
  sortBy: noOp,
  selectTarget: noOp,
  toggleDenseIrrelevant: noOp,
  retryDenseCompare: noOp
};

const duelActions: DuelPaneActions = {
  snapshotCurrentSetup: noOp,
  exportDuelSnapshots: noOp,
  importDuelSnapshots: async () => undefined,
  mergeDuelSnapshotsImport: noOp,
  dismissDuelSnapshotsImport: noOp,
  setDuelSnapshotsImportDecision: noOp,
  setDuelSnapshotsImportName: noOp,
  refreshDuelSnapshotsImport: noOp,
  applyDuelSessionOnlyChange: noOp,
  commitDuelSnapshotName: () => "renamed",
  loadDuelSnapshot: noOp,
  refreshDuelSnapshotLoad: noOp,
  confirmDuelSnapshotLoad: noOp,
  dismissDuelSnapshotLoad: noOp,
  deleteDuelSnapshot: noOp,
  showCurrentDuelTarget: noOp,
  showDuelMonsterMatrix: noOp,
  toggleDuelDiff: noOp,
  sortDuelComparisonBy: noOp,
  setDuelMatrixFilter: noOp,
  setDuelMatrixMetric: noOp,
  sortDuelMatrixBy: noOp,
  buildDuelMatrix: noOp
};

function inOrder(markup: string, fragments: readonly string[]): void {
  let previous = -1;
  for (const fragment of fragments) {
    const next = markup.indexOf(fragment, previous + 1);
    expect(next, `missing or out-of-order fragment: ${fragment}`).toBeGreaterThan(previous);
    previous = next;
  }
}

describe("Compare and Duel panes", () => {
  it("keeps the Compare landmark, freshness, filters, sortable table and selected row contract", async () => {
    const { context } = await loadBundledLegacyContext();
    const allRows = createDenseCompareRows(DEFAULT_FORM_STATE, context);
    const activeRow = allRows.find((row) => row.monsterId === DEFAULT_FORM_STATE.monsterId)!;
    const rows = [activeRow, ...allRows.filter((row) => row !== activeRow)].slice(0, 4);
    const model: ComparePaneModel = {
      denseCompare: DEFAULT_DENSE_COMPARE_STATE,
      denseCompareRows: rows,
      denseCompareScale: createDenseCompareScaleModel(rows),
      denseCompareTotalRows: Object.keys(context.gameData.monsters).length,
      denseComparePresentation: {
        status: "building",
        displayIsCurrent: false,
        message: "Calculating current comparison. Showing the previous result.",
        statusLabel: "Updating",
        summary: "calculating current inputs",
        aria: "Compare calculation status: Updating. Showing the previous result.",
        canRetry: false,
        retryActionLabel: "Retry comparison"
      },
      selectedMonsterId: DEFAULT_FORM_STATE.monsterId
    };
    const markup = renderToStaticMarkup(
      createElement(ComparePane, { hidden: true, model, actions: compareActions })
    );

    expect(
      markup.startsWith(
        '<section class="dense-table-panel" aria-label="Monster comparison" hidden="">'
      )
    ).toBe(true);
    inOrder(markup, [
      "<h2>All monsters</h2>",
      'aria-label="Compare calculation status: Updating. Showing the previous result."',
      'aria-label="Dense compare filters"',
      "Monster filter",
      "Drop filter",
      "Show hidden / irrelevant",
      'aria-label="All monsters"'
    ]);
    expect(markup).toContain('aria-sort="descending"');
    expect(markup).toContain('aria-label="Sort by time to kill"');
    expect(markup).toContain('aria-label="Sort by effective kills per hour"');
    expect(markup).toContain('aria-label="Sort by effective experience points per hour"');
    expect(markup).toContain('aria-label="Sort by gold pieces per kill"');
    expect(markup).toContain('aria-label="Sort by effective gross gold pieces per hour"');
    expect(markup).toContain('aria-label="Sort by effective net gold pieces per hour"');
    expect(markup).toContain(`data-monster-id="${DEFAULT_FORM_STATE.monsterId}"`);
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain("Reset filters");
    expect(markup).toContain("Calculating current comparison. Showing the previous result.");
    expect(markup).toContain('aria-label="Previous Dense result"');
  });

  it("shows a fixed Dense failure, retained previous rows and Retry", async () => {
    const { context } = await loadBundledLegacyContext();
    const rows = createDenseCompareRows(DEFAULT_FORM_STATE, context).slice(0, 2);
    const markup = renderToStaticMarkup(
      createElement(ComparePane, {
        hidden: false,
        model: {
          denseCompare: DEFAULT_DENSE_COMPARE_STATE,
          denseCompareRows: rows,
          denseCompareScale: createDenseCompareScaleModel(rows),
          denseCompareTotalRows: Object.keys(context.gameData.monsters).length,
          denseComparePresentation: {
            status: "failed",
            displayIsCurrent: false,
            message: "Comparison could not be calculated. Showing the previous result.",
            statusLabel: "Calculation failed",
            summary: "calculation failed",
            aria: "Compare calculation status: Failed. Showing the previous result.",
            canRetry: true,
            retryActionLabel: "Retry comparison"
          },
          selectedMonsterId: DEFAULT_FORM_STATE.monsterId
        },
        actions: compareActions
      })
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Comparison could not be calculated. Showing the previous result.");
    expect(markup).toContain("Retry comparison");
    expect(markup).toContain('aria-label="Previous Dense result"');
    expect(markup).toContain('aria-label="All monsters"');
  });

  it("keeps zero-result Compare recovery copy adjacent to Reset filters", () => {
    const markup = renderToStaticMarkup(
      createElement(ComparePane, {
        hidden: false,
        model: {
          denseCompare: {
            ...DEFAULT_DENSE_COMPARE_STATE,
            monsterFilter: "no-match"
          },
          denseCompareRows: [],
          denseCompareScale: {},
          denseCompareTotalRows: 63,
          denseComparePresentation: {
            status: "ready",
            displayIsCurrent: true,
            message: "",
            statusLabel: "Current",
            summary: "current loadout",
            aria: "Compare calculation status: Ready.",
            canRetry: false,
            retryActionLabel: "Retry comparison"
          },
          selectedMonsterId: DEFAULT_FORM_STATE.monsterId
        },
        actions: compareActions
      })
    );

    inOrder(markup, [
      "Reset filters",
      "No monsters match the current filters. Reset filters to show the full comparison again."
    ]);
  });

  it("keeps saved setup controls, current-target comparison and diff disclosure semantics", async () => {
    const { context } = await loadBundledLegacyContext();
    const snapshot = createDuelSnapshot("saved-ranged", "Saved ranged", {
      ...DEFAULT_FORM_STATE,
      combatStyle: "ranged",
      weaponId: "magic_shortbow",
      ammoId: "rune_arrow",
      styleId: "rapid"
    });
    const comparison = createDuelComparisonViewModel(
      DEFAULT_FORM_STATE,
      { snapshots: [snapshot] },
      context
    );
    const model: DuelPaneModel = {
      targetLabel: comparison.monsterName,
      snapshotCount: 1,
      duelComparison: comparison,
      duelComparisonRows: comparison.rows,
      duelComparisonSort: DEFAULT_DUEL_COMPARISON_SORT_STATE,
      duelViewMode: "current-target",
      expandedDuelDiffId: snapshot.id,
      duelMatrixMetric: "effectiveXpPerHour",
      duelMatrixFilter: "",
      duelMatrixPresentation: {
        status: "idle",
        displayModel: null,
        displayIsCurrent: false,
        message: "Build the all-monster comparison for the current inputs.",
        canBuild: true,
        buildActionLabel: "Build comparison"
      },
      filteredDuelMatrixRows: [],
      duelMatrixSort: DEFAULT_DUEL_MATRIX_SORT_STATE,
      duelImportNotice: { tone: "success", message: "Imported saved setups." },
      duelImportReview: {
        ...createSavedSetupMergeReviewViewModel({
          plan: createSavedSetupMergePlan({
            reviewId: 4,
            current: { snapshots: [snapshot] },
            source: {
              snapshots: [
                createDuelSnapshot(snapshot.id, "Imported ranged", DEFAULT_FORM_STATE),
                createDuelSnapshot("new-saved", "New saved", DEFAULT_FORM_STATE)
              ]
            }
          }),
          current: { snapshots: [snapshot] },
          context
        }),
        contextTone: "warning",
        contextMessage:
          "This older format does not record a game revision. It will use the current Revision 274 data."
      },
      duelLoadReview: null,
      duelSessionOnlyAvailable: false,
      duelChangeRevision: 0
    };
    const markup = renderToStaticMarkup(
      createElement(DuelPane, { hidden: true, model, actions: duelActions })
    );

    expect(
      markup.startsWith('<section class="duel-pane" aria-label="Setup comparison" hidden="">')
    ).toBe(true);
    inOrder(markup, [
      "<h2>Setup comparison</h2>",
      'aria-label="Saved setup controls"',
      "Save current setup",
      "Manage saved setups",
      "Review saved setup collection",
      "Export saved setup collection",
      'aria-label="Setup comparison view"',
      'aria-label="Saved setup transfer notice"',
      'aria-label="Saved setup import review"',
      "Merge selected setups",
      "Dismiss",
      'aria-label="Setup comparison table"',
      'aria-label="Saved ranged setup and impact diff"',
      'aria-label="Calculated impact"'
    ]);
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain(
      "This file contains the saved comparison collection only. It does not replace the active setup until you later load an individual saved row."
    );
    expect(markup.match(/aria-describedby="saved-setup-collection-scope"/g)).toHaveLength(2);
    expect(markup).toContain('aria-sort="none"');
    expect(markup).toContain("Hide diff");
    expect(markup).toContain("Saved setup compared with live");
    expect(markup).toContain("This older format does not record a game revision");
    expect(markup).toContain(comparison.snapshotRows[0]!.setupDiff!.sharedContextNote);
  });

  it("keeps the Duel matrix filter, metric, rebuild and stale/ready table contracts", () => {
    const matrix: DuelMatrixViewModel = {
      currentMonsterId: "rock_crab",
      monsterCount: 1,
      setupCount: 1,
      cellCount: 1,
      setups: [
        {
          id: "duel-live",
          snapshotId: null,
          source: "live",
          name: "Live setup",
          displayName: "Live setup",
          combatStyle: "melee",
          loadoutLabel: "melee · Rune scimitar"
        }
      ],
      rows: [
        {
          monsterId: "rock_crab",
          monsterName: "Rock Crab",
          monsterLevel: 13,
          isCurrentTarget: true,
          cells: [
            {
              setupId: "duel-live",
              values: {
                dps: 3.25,
                effectiveXpPerHour: 42_000,
                effectiveNetGpPerHour: -500,
                gpPerXp: -0.01
              },
              best: {
                dps: false,
                effectiveXpPerHour: false,
                effectiveNetGpPerHour: false,
                gpPerXp: false
              }
            }
          ]
        }
      ]
    };
    const model: DuelPaneModel = {
      targetLabel: "Rock Crab",
      snapshotCount: 1,
      duelComparison: null,
      duelComparisonRows: [],
      duelComparisonSort: DEFAULT_DUEL_COMPARISON_SORT_STATE,
      duelViewMode: "monster-matrix",
      expandedDuelDiffId: null,
      duelMatrixMetric: "effectiveXpPerHour",
      duelMatrixFilter: "rock",
      duelMatrixPresentation: {
        status: "ready",
        displayModel: matrix,
        displayIsCurrent: true,
        message: "",
        canBuild: true,
        buildActionLabel: "Refresh comparison"
      },
      filteredDuelMatrixRows: matrix.rows,
      duelMatrixSort: DEFAULT_DUEL_MATRIX_SORT_STATE,
      duelImportNotice: null,
      duelImportReview: null,
      duelLoadReview: null,
      duelSessionOnlyAvailable: false,
      duelChangeRevision: 0
    };
    const markup = renderToStaticMarkup(
      createElement(DuelPane, { hidden: false, model, actions: duelActions })
    );

    inOrder(markup, [
      'aria-label="Setup comparison across monsters"',
      'aria-label="Find monster in setup comparison"',
      'aria-label="Setup comparison metric"',
      "Refresh comparison",
      'aria-label="All-monster setup comparison"'
    ]);
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-current="true"');
    expect(markup).toContain('aria-sort="none"');
    expect(markup).toContain("1 monsters - 1 setups");
    expect(markup).toContain("42,000");

    const staleMarkup = renderToStaticMarkup(
      createElement(DuelPane, {
        hidden: false,
        model: {
          ...model,
          duelMatrixPresentation: {
            status: "stale",
            displayModel: matrix,
            displayIsCurrent: false,
            message: "Inputs changed. This table does not include the current inputs.",
            canBuild: true,
            buildActionLabel: "Refresh comparison"
          }
        },
        actions: duelActions
      })
    );
    expect(staleMarkup).toContain(
      "Inputs changed. This table does not include the current inputs."
    );
    expect(staleMarkup).toContain("previous result");
    expect(staleMarkup).toContain("Refresh comparison");
    expect(staleMarkup).toContain('aria-label="Previous all-monster setup comparison"');

    const failedMarkup = renderToStaticMarkup(
      createElement(DuelPane, {
        hidden: false,
        model: {
          ...model,
          duelMatrixPresentation: {
            status: "failed",
            displayModel: matrix,
            displayIsCurrent: false,
            message: "Comparison could not be built. Showing the previous result.",
            canBuild: true,
            buildActionLabel: "Retry comparison"
          }
        },
        actions: duelActions
      })
    );
    expect(failedMarkup).toContain('role="alert"');
    expect(failedMarkup).toContain("Comparison could not be built. Showing the previous result.");
    expect(failedMarkup).toContain("Retry comparison");
  });
});

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
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import { createDenseCompareRows, createDenseCompareScaleModel } from "../app/view-models/compare";
import {
  DEFAULT_DUEL_COMPARISON_SORT_STATE,
  DEFAULT_DUEL_MATRIX_SORT_STATE,
  createDuelComparisonViewModel,
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
  toggleDenseIrrelevant: noOp
};

const duelActions: DuelPaneActions = {
  snapshotCurrentSetup: noOp,
  exportDuelSnapshots: noOp,
  importDuelSnapshots: async () => undefined,
  commitDuelSnapshotName: () => true,
  loadDuelSnapshot: noOp,
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
      denseComparePending: true,
      denseCompareFreshnessLabel: "Updating",
      denseCompareFreshnessSummary: "rows may reflect previous loadout",
      denseCompareFreshnessAria:
        "Compare calculation status: Updating. Rows may reflect the previous loadout.",
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
      'aria-label="Compare calculation status: Updating. Rows may reflect the previous loadout."',
      'aria-label="Dense compare filters"',
      "Monster filter",
      "Drop filter",
      "Show hidden / irrelevant",
      'aria-label="All monsters"'
    ]);
    expect(markup).toContain('aria-sort="descending"');
    expect(markup).toContain(`data-monster-id="${DEFAULT_FORM_STATE.monsterId}"`);
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain("Reset filters");
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
      duelMatrix: null,
      filteredDuelMatrixRows: [],
      duelMatrixSort: DEFAULT_DUEL_MATRIX_SORT_STATE,
      duelMatrixBusy: false,
      duelImportNotice: { tone: "success", message: "Imported saved setups." }
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
      "Import setups",
      "Export setups",
      'aria-label="Setup comparison view"',
      'aria-label="Saved setup import notice"',
      'aria-label="Setup comparison table"',
      'aria-label="Saved ranged setup and impact diff"',
      'aria-label="Calculated impact"'
    ]);
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('aria-sort="none"');
    expect(markup).toContain("Hide diff");
    expect(markup).toContain("Saved setup compared with live");
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
      duelMatrix: matrix,
      filteredDuelMatrixRows: matrix.rows,
      duelMatrixSort: DEFAULT_DUEL_MATRIX_SORT_STATE,
      duelMatrixBusy: false,
      duelImportNotice: null
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
        model: { ...model, duelMatrix: null, filteredDuelMatrixRows: [] },
        actions: duelActions
      })
    );
    expect(staleMarkup).toContain('aria-label="Setup comparison across monsters status"');
    expect(staleMarkup).toContain("Comparison inputs changed");
    expect(staleMarkup).toContain("Build comparison");
  });
});

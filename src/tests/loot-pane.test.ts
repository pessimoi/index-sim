import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadCurrentTestContext } from "./helpers/current-sim";
import { createGeneratedRuntimeContext } from "../adapters/generated";
import { LootPane, type LootPaneActions } from "../app/components/panes/loot-pane";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import { lootSettingsForMonster } from "../app/state/loot-settings";
import {
  DEFAULT_LOOT_NESTED_TABLE_SORT_STATE,
  DEFAULT_LOOT_TABLE_SORT_STATE
} from "../app/view-models/loot";
import { createSimulationViewModel } from "../app/view-models/simulation";
import { createPriceTimeContext, presentPriceDateTime } from "../app/view-models/price-time";
import type { LootAction } from "../domain/trip";

const noOp = () => undefined;

const actions: LootPaneActions = {
  setHighAlch: noOp,
  setOverheadMode: noOp,
  setOverheadSeconds: noOp,
  setTalismanSpot: noOp,
  setAction: noOp,
  resetSettings: noOp,
  resetOverrides: noOp,
  optimize: noOp,
  sortBy: noOp,
  sortNestedBy: noOp,
  reviewPriceItem: noOp
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

describe("Loot pane", () => {
  it("shows the current High alch setting while calculated results catch up", async () => {
    const { context } = await loadCurrentTestContext();
    const simulation = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const markup = renderToStaticMarkup(
      createElement(LootPane, {
        hidden: false,
        model: {
          presentation: { ...simulation.loot, highAlchEnabled: false },
          settings: {
            ...lootSettingsForMonster({}, DEFAULT_FORM_STATE.monsterId),
            highAlch: true
          },
          notice: null,
          gpPerKill: simulation.trip.gpPerKill,
          effectiveNetGpPerHour: simulation.trip.effectiveNetGpPerHour,
          sort: DEFAULT_LOOT_TABLE_SORT_STATE,
          nestedSort: DEFAULT_LOOT_NESTED_TABLE_SORT_STATE
        },
        actions
      })
    );

    expect(markup).toContain('<option value="enabled" selected="">Enabled</option>');
    expect(markup).toContain("<span>High alch</span><strong>On</strong>");
  });

  it("renders friendly semantic latest and baseline capture facts", async () => {
    const { context } = await loadCurrentTestContext();
    const simulation = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const template = simulation.loot.actionableRows[0]!;
    const timeContext = createPriceTimeContext(new Date("2026-07-20T13:00:00Z"), "UTC");
    const row = {
      ...template,
      historyContext: {
        ...template.historyContext,
        tracked: true,
        statusLabel: "Tracked",
        latestPrice: 250,
        baselinePrice: 200,
        gpDelta: 50,
        percentDelta: 25,
        latestCaptureTime: presentPriceDateTime("2026-07-20T12:00:00Z", timeContext),
        baselineCaptureTime: presentPriceDateTime("2026-07-19T12:00:00Z", timeContext)
      }
    };
    const markup = renderToStaticMarkup(
      createElement(LootPane, {
        hidden: false,
        model: {
          presentation: {
            ...simulation.loot,
            rows: [row],
            actionableRows: [row],
            conditionalRows: []
          },
          settings: lootSettingsForMonster({}, DEFAULT_FORM_STATE.monsterId),
          notice: null,
          gpPerKill: simulation.trip.gpPerKill,
          effectiveNetGpPerHour: simulation.trip.effectiveNetGpPerHour,
          sort: DEFAULT_LOOT_TABLE_SORT_STATE,
          nestedSort: DEFAULT_LOOT_NESTED_TABLE_SORT_STATE
        },
        actions
      })
    );

    expect(markup).toContain("<strong>Price history</strong>");
    expect(markup).toContain("Latest</dt><dd>250 · <time");
    expect(markup).toContain(">20 Jul 2026, 12:00 UTC</time>");
    expect(markup).toContain("Baseline</dt><dd>200 · <time");
    expect(markup).toContain(">19 Jul 2026, 12:00 UTC</time>");
    expect(markup).not.toContain(">2026-07-20T12:00:00Z<");
  });

  it("renders source names as primary copy and underscored ids only in technical details", async () => {
    const { context } = await loadCurrentTestContext();
    const simulation = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const template = simulation.loot.actionableRows.find((row) => row.expandedRows.length > 0)!;
    const nestedTemplate = template.expandedRows[0]!;
    const sourceNamedRow = {
      ...template,
      rowId: "fixture-source-names",
      name: "Uncut dragonstone",
      key: "uncut_dragonstone",
      displayLabel: {
        name: "Uncut dragonstone",
        technicalId: "uncut_dragonstone",
        source: "game-data" as const
      },
      expandedRows: [
        {
          ...nestedTemplate,
          label: "Rune spear",
          key: "rune_spear",
          tag: "rare",
          displayLabel: {
            name: "Rune spear",
            technicalId: "rune_spear",
            source: "row-source" as const
          },
          priceNotices: []
        }
      ],
      priceNotices: []
    };
    const markup = renderToStaticMarkup(
      createElement(LootPane, {
        hidden: false,
        model: {
          presentation: {
            ...simulation.loot,
            rows: [sourceNamedRow],
            actionableRows: [sourceNamedRow],
            conditionalRows: []
          },
          settings: lootSettingsForMonster({}, DEFAULT_FORM_STATE.monsterId),
          notice: null,
          gpPerKill: simulation.trip.gpPerKill,
          effectiveNetGpPerHour: simulation.trip.effectiveNetGpPerHour,
          sort: DEFAULT_LOOT_TABLE_SORT_STATE,
          nestedSort: DEFAULT_LOOT_NESTED_TABLE_SORT_STATE
        },
        actions
      })
    );

    expect(markup).toContain("<span>Uncut dragonstone</span>");
    expect(markup).toContain("<td>Rune spear</td>");
    expect(markup).toContain("<summary>Technical details</summary><dl>");
    expect(markup).toContain("<dt>Item ID</dt><dd><code>uncut_dragonstone</code></dd>");
    expect(markup).toContain("<dt>Item ID</dt><dd><code>rune_spear</code></dd>");
    expect(markup.match(/uncut_dragonstone/g)).toHaveLength(1);
    expect(markup.match(/rune_spear/g)).toHaveLength(1);
  });

  it("keeps the complete landmark, controls, composition and action table order", async () => {
    const { context } = await loadCurrentTestContext();
    const simulation = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const markup = renderToStaticMarkup(
      createElement(LootPane, {
        hidden: true,
        model: {
          presentation: simulation.loot,
          settings: lootSettingsForMonster({}, DEFAULT_FORM_STATE.monsterId),
          notice: null,
          gpPerKill: simulation.trip.gpPerKill,
          effectiveNetGpPerHour: simulation.trip.effectiveNetGpPerHour,
          sort: DEFAULT_LOOT_TABLE_SORT_STATE,
          nestedSort: DEFAULT_LOOT_NESTED_TABLE_SORT_STATE
        },
        actions
      })
    );

    expect(
      markup.startsWith('<section class="loot-strip" aria-label="Current monster loot" hidden="">')
    ).toBe(true);
    inOrder(markup, [
      '<h2 id="loot-actions-heading" tabindex="-1">Loot actions</h2>',
      "High alch",
      "Overhead",
      "Overhead (seconds)",
      "Talisman spot",
      "Reset settings",
      "Reset current",
      "Optimize net GP/hr",
      'aria-label="Loot action summary"',
      'aria-label="Loot value composition"',
      'aria-label="Current monster drops"'
    ]);
    expect(markup).toContain("Monster actions");
    expect(markup).toContain("Price history");
    expect(markup).toContain("loot-price-cell");
    expect(markup).toContain("Price data");
    expect(markup).not.toContain('aria-label="Loot price warnings"');
    expect(markup).toContain("Default net GP/hr");
    expect(markup).toContain('<th aria-sort="none"><button type="button" class="sort-button"');
    expect(markup).toContain(">Drop</span>");
    expect(markup).toContain(">EV/kill</span>");
    expect(markup.match(/>Unit price<\/span>/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(markup).toContain('aria-label="Sort by expected value per kill"');
    expect(markup).toContain('aria-label="Sort by Unit price"');
  });

  it("validates a selected action against the row before invoking the caller", async () => {
    const { context } = await loadCurrentTestContext();
    const simulation = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const row = simulation.loot.actionableRows.find(
      (candidate) => candidate.availableActions.length > 1
    );
    expect(row).toBeDefined();
    const calls: Array<{ rowId: string; action: LootAction }> = [];
    const tree = LootPane({
      hidden: false,
      model: {
        presentation: simulation.loot,
        settings: lootSettingsForMonster({}, DEFAULT_FORM_STATE.monsterId),
        notice: null,
        gpPerKill: simulation.trip.gpPerKill,
        effectiveNetGpPerHour: simulation.trip.effectiveNetGpPerHour,
        sort: DEFAULT_LOOT_TABLE_SORT_STATE,
        nestedSort: DEFAULT_LOOT_NESTED_TABLE_SORT_STATE
      },
      actions: {
        ...actions,
        setAction: (selectedRow, action) => calls.push({ rowId: selectedRow.rowId, action })
      }
    });
    const select = elements(tree).find(
      (element) =>
        element.type === "select" &&
        (element.props as { "aria-label"?: string })["aria-label"] === `Action for ${row!.name}`
    );
    const action = row!.availableActions.find((candidate) => candidate !== row!.pref)!;

    (select!.props as { onChange(event: { target: { value: string } }): void }).onChange({
      target: { value: action }
    });
    (select!.props as { onChange(event: { target: { value: string } }): void }).onChange({
      target: { value: "invalid" }
    });

    expect(calls).toEqual([{ rowId: row!.rowId, action }]);
  });

  it("routes sortable column headings through the controlled pane action", async () => {
    const { context } = await loadCurrentTestContext();
    const simulation = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const calls: string[] = [];
    const nestedCalls: string[] = [];
    const tree = LootPane({
      hidden: false,
      model: {
        presentation: simulation.loot,
        settings: lootSettingsForMonster({}, DEFAULT_FORM_STATE.monsterId),
        notice: null,
        gpPerKill: simulation.trip.gpPerKill,
        effectiveNetGpPerHour: simulation.trip.effectiveNetGpPerHour,
        sort: { key: "evPerKill", direction: "desc" },
        nestedSort: DEFAULT_LOOT_NESTED_TABLE_SORT_STATE
      },
      actions: {
        ...actions,
        sortBy: (key) => calls.push(key),
        sortNestedBy: (key) => nestedCalls.push(key)
      }
    });
    const evButton = elements(tree).find(
      (element) =>
        element.type === "button" &&
        elements(element).some(
          (child) =>
            child.type === "span" &&
            (child.props as { children?: ReactNode }).children === "EV/kill"
        )
    );

    (evButton!.props as { onClick(): void }).onClick();

    const weightButton = elements(tree).find(
      (element) =>
        element.type === "button" &&
        elements(element).some(
          (child) =>
            child.type === "span" && (child.props as { children?: ReactNode }).children === "Weight"
        )
    );
    expect(weightButton).toBeDefined();
    (weightButton!.props as { onClick(): void }).onClick();

    expect(calls).toEqual(["evPerKill"]);
    expect(nestedCalls).toEqual(["weight"]);
    const markup = renderToStaticMarkup(tree);
    expect(markup).toContain('class="numeric" aria-sort="descending"');
  });

  it("emits the exact structured item action from row and nested price notices", async () => {
    const { context } = await loadCurrentTestContext();
    const simulation = createSimulationViewModel(
      DEFAULT_FORM_STATE,
      context,
      {},
      {},
      {},
      {
        editablePriceItemIds: new Set(Object.keys(context.priceSet.itemPrices))
      }
    );
    const expected = simulation.loot.actionableRows
      .flatMap((row) => [
        ...row.priceNotices,
        ...row.expandedRows.flatMap((detail) => detail.priceNotices)
      ])
      .find((notice) => notice.action?.kind === "correct-price");
    expect(expected?.action).toBeDefined();
    const calls: unknown[] = [];
    const tree = LootPane({
      hidden: false,
      model: {
        presentation: simulation.loot,
        settings: lootSettingsForMonster({}, DEFAULT_FORM_STATE.monsterId),
        notice: null,
        gpPerKill: simulation.trip.gpPerKill,
        effectiveNetGpPerHour: simulation.trip.effectiveNetGpPerHour,
        sort: DEFAULT_LOOT_TABLE_SORT_STATE,
        nestedSort: DEFAULT_LOOT_NESTED_TABLE_SORT_STATE
      },
      actions: { ...actions, reviewPriceItem: (action) => calls.push(action) }
    });
    const button = elements(tree).find(
      (element) =>
        element.type === "button" &&
        (element.props as { "aria-label"?: string })["aria-label"] ===
          `${expected!.action!.label} for ${expected!.itemLabel}`
    );

    expect(button).toBeDefined();
    (button!.props as { onClick(): void }).onClick();
    expect(calls).toEqual([expected!.action]);
  });

  it("renders unique repeated-row action names without changing their exact keys", () => {
    const { context } = createGeneratedRuntimeContext();
    const form = { ...DEFAULT_FORM_STATE, monsterId: "hobgoblin_armed" };
    const simulation = createSimulationViewModel(form, context);
    const coins = simulation.loot.actionableRows.filter((row) => row.key === "coins");
    const tree = LootPane({
      hidden: false,
      model: {
        presentation: simulation.loot,
        settings: lootSettingsForMonster({}, form.monsterId),
        notice: null,
        gpPerKill: simulation.trip.gpPerKill,
        effectiveNetGpPerHour: simulation.trip.effectiveNetGpPerHour,
        sort: { key: "drop", direction: "desc" },
        nestedSort: DEFAULT_LOOT_NESTED_TABLE_SORT_STATE
      },
      actions
    });
    const actionNames = elements(tree)
      .filter((element) => element.type === "select")
      .map((element) => (element.props as { "aria-label"?: string })["aria-label"])
      .filter((label): label is string => label?.startsWith("Action for Coins") === true);

    expect(coins).toHaveLength(7);
    expect([...actionNames].sort()).toEqual(coins.map((row) => `Action for ${row.name}`).sort());
    expect(new Set(actionNames).size).toBe(7);
    expect(new Set(coins.map((row) => row.rowId)).size).toBe(7);
  });
});

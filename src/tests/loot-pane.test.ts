import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadBundledLegacyContext } from "../adapters/legacy-runtime";
import { LootPane, type LootPaneActions } from "../app/components/panes/loot-pane";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import { lootSettingsForMonster } from "../app/state/loot-settings";
import {
  DEFAULT_LOOT_NESTED_TABLE_SORT_STATE,
  DEFAULT_LOOT_TABLE_SORT_STATE
} from "../app/view-models/loot";
import { createSimulationViewModel } from "../app/view-models/simulation";
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
  sortNestedBy: noOp
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
  it("keeps the complete landmark, controls, composition and action table order", async () => {
    const { context } = await loadBundledLegacyContext();
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
      "<h2>Loot actions</h2>",
      "High alch",
      "Overhead",
      "Overhead sec",
      "Talisman spot",
      "Reset settings",
      "Reset current",
      "Optimize net GP/hr",
      'aria-label="Loot action summary"',
      'aria-label="Loot value composition"',
      'aria-label="Current monster drops"'
    ]);
    expect(markup).toContain("Monster actions");
    expect(markup).toContain("Local history");
    expect(markup).toContain("loot-price-cell");
    expect(markup).toContain("Price data");
    expect(markup).not.toContain('aria-label="Loot price warnings"');
    expect(markup).toContain("Default net GP/hr");
    expect(markup).toContain('<th aria-sort="none"><button type="button" class="sort-button"');
    expect(markup).toContain(">Drop</span>");
    expect(markup).toContain(">EV/kill</span>");
  });

  it("validates a selected action against the row before invoking the caller", async () => {
    const { context } = await loadBundledLegacyContext();
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
        (element.props as { "aria-label"?: string })["aria-label"] ===
          `Action for ${row!.name} ${row!.rowId}`
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
    const { context } = await loadBundledLegacyContext();
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
});

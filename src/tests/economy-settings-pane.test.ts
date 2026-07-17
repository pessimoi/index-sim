import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EconomySettingsPane,
  type EconomySettingsPaneActions,
  type EconomySettingsPaneMode,
  type EconomySettingsPaneModel
} from "../app/components/panes/economy-settings-pane";
import { importPriceSetFromInput } from "../app/components/panes/price-set-import-input";
import { DEFAULT_MANUAL_PRICE_OVERRIDES_STATE } from "../app/state/manual-price-overrides";
import { DEFAULT_PRICE_HISTORY_STATE } from "../app/state/price-history";
import {
  createEconomyHistoryPresentation,
  createManualPriceEditorPresentation,
  createPriceHistorySources,
  createPriceHistorySummaryPresentation,
  createPriceSetPresentation,
  createSelectedPriceItemPresentation,
  type PriceDataViewModel
} from "../app/view-models/price-data";
import { createSettingsPaneViewModel } from "../app/view-models/settings";
import type { PriceSet } from "../domain/shared";

const noOp = () => undefined;

const defaultActions: EconomySettingsPaneActions = {
  setPriceNotesOpen: noOp,
  prices: {
    importPriceSet: async () => undefined,
    exportActivePriceSet: noOp,
    requestReset: noOp,
    confirmReset: noOp,
    cancelReset: noOp
  },
  history: {
    saveLocalComparison: noOp,
    requestClear: noOp,
    confirmClear: noOp,
    cancelClear: noOp,
    setBaselineMode: noOp,
    setSnapshotKey: noOp,
    setItemFilter: noOp,
    setTrendItemId: noOp,
    sortBy: noOp
  },
  manual: {
    selectItem: noOp,
    setDraft: noOp,
    apply: noOp,
    resetItem: noOp,
    requestClearAll: noOp,
    confirmClearAll: noOp,
    cancelClearAll: noOp
  },
  settings: {
    setTierHidden: noOp,
    hideAllTiers: noOp,
    showAllTiers: noOp
  },
  recovery: {
    exportReport: noOp,
    beginClear: noOp,
    cancelClear: noOp,
    confirmClearItem: noOp,
    confirmClearInvalid: noOp
  }
};

function fixturePriceSet(): PriceSet {
  return {
    id: "fixture-prices",
    label: "Fixture prices",
    source: "bundled",
    createdAt: "2026-07-14T12:00:00.000Z",
    itemPrices: { lobster: 205 },
    alchValues: { lobster: 0 }
  };
}

function priceData(): PriceDataViewModel {
  const active = fixturePriceSet();
  const sources = createPriceHistorySources({
    scheduledSnapshotStatus: null,
    localPriceHistory: DEFAULT_PRICE_HISTORY_STATE
  });
  const historyAnalysis = createEconomyHistoryPresentation({
    sources,
    itemLabels: { lobster: "Lobster" },
    controls: {
      baselineMode: "previous",
      snapshotKey: "",
      itemFilter: "",
      trendItemId: "lobster",
      sort: { key: "gpDelta", direction: "desc" }
    }
  });
  return {
    ...createPriceSetPresentation({
      activePriceSet: active,
      bundledPriceSet: active,
      scheduledSnapshotStatus: null,
      activePriceSetOrigin: "bundled",
      priceLabel: active.label,
      activeManualPriceOverrideCount: 0,
      ageNow: new Date("2026-07-14T13:00:00.000Z")
    }),
    manual: createManualPriceEditorPresentation({
      activePriceSet: active,
      basePriceSet: active,
      itemLabels: { lobster: "Lobster" },
      manualPriceOverrides: DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
      selectedItemId: "lobster",
      draft: null
    }),
    history: {
      ...historyAnalysis,
      summary: createPriceHistorySummaryPresentation({
        analysisState: sources.analysisState,
        activePriceSet: active,
        evaluatedAt: new Date("2026-07-14T13:00:00.000Z")
      }),
      selectedItem: createSelectedPriceItemPresentation({
        activePriceSet: active,
        itemId: "lobster",
        freshnessNow: new Date("2026-07-14T13:00:00.000Z")
      })
    }
  };
}

function model(mode: EconomySettingsPaneMode): EconomySettingsPaneModel {
  return {
    mode,
    prices: priceData(),
    settings: createSettingsPaneViewModel({ bronze: true }),
    priceNotices: { issues: [], notes: [], all: [], byLootRowId: {} },
    priceNotesOpen: false,
    marketNotice: null,
    importNotice: null,
    priceSetResetPending: false,
    priceHistoryClearPending: false,
    manualPriceClearPending: false,
    recovery: {
      visible: false,
      report: {
        generatedAt: "2026-07-14T13:00:00.000Z",
        itemCount: 0,
        attentionCount: 0,
        hasAttention: false,
        items: []
      },
      notice: null,
      pendingClearId: null
    }
  };
}

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

describe("Economy and Settings pane", () => {
  it("keeps Economy landmark, Market, manual editor and history sections in order", () => {
    const markup = renderToStaticMarkup(
      createElement(EconomySettingsPane, { model: model("economy"), actions: defaultActions })
    );

    expect(markup.startsWith('<section class="economy-pane" aria-label="Economy">')).toBe(true);
    inOrder(markup, [
      'aria-label="Market price data"',
      'aria-label="Market active PriceSet summary"',
      'aria-label="Manual item price"',
      'aria-label="Price history summary"',
      'aria-label="Price history analysis"',
      'aria-label="Selected item price provenance"',
      'aria-label="Top movers"',
      'aria-label="Price movers"'
    ]);
    expect(markup).not.toContain('aria-label="Price data settings"');
    expect(markup).not.toContain('aria-label="Hidden gear tiers"');
  });

  it("keeps Settings Price data, Gear menu and shared Market composition in order", () => {
    const markup = renderToStaticMarkup(
      createElement(EconomySettingsPane, { model: model("settings"), actions: defaultActions })
    );

    expect(markup.startsWith('<section class="service-strip" aria-label="Live services">')).toBe(
      true
    );
    inOrder(markup, [
      'aria-label="Price data settings"',
      'aria-label="Active PriceSet summary"',
      'aria-label="Hidden gear tiers"',
      'aria-label="Gear tier visibility"',
      'aria-label="Market price data"',
      'aria-label="Price history summary"'
    ]);
    expect(markup).not.toContain('aria-label="Manual item price"');
    expect(markup).not.toContain('aria-label="Price history analysis"');
  });

  it.each(["economy", "settings"] as const)(
    "renders one collapsed, fully explained PriceSet workflow in %s mode",
    (mode) => {
      const markup = renderToStaticMarkup(
        createElement(EconomySettingsPane, { model: model(mode), actions: defaultActions })
      );

      expect(markup.match(/class="advanced-price-set-tools"/g)).toHaveLength(1);
      expect(markup.match(/type="file"/g)).toHaveLength(1);
      expect(markup).toContain(
        '<details class="advanced-price-set-tools" aria-label="Advanced PriceSet tools"><summary>Advanced PriceSet tools</summary>'
      );
      expect(markup).toContain("Importing replaces the complete local base PriceSet");
      expect(markup).toContain("Missing items are not merged from the committed snapshot");
      expect(markup).toContain("Use <strong>Manual item price</strong>");
      expect(markup).toContain("a PriceSet JSON exported by this app, up to 1 MB");
      expect(markup).toContain("High alch values always come from current game data");
      expect(markup).toContain("File format");
      expect(markup).toContain("complete replacement map, not a patch");
      expect(markup).toContain('accept="application/json,.json"');
      expect(markup).toMatch(/aria-describedby="[^"]+ [^"]+"/);
      inOrder(markup, [
        "Export active PriceSet",
        "Import full PriceSet",
        "Reset imported PriceSet"
      ]);
      expect(markup).not.toContain("Import prices");
      expect(markup).not.toContain("Import PriceSet");
      expect(markup).not.toContain("Reset local price override");
    }
  );

  it("keeps the hidden shared service strip mounted with the Market boundary", () => {
    const markup = renderToStaticMarkup(
      createElement(EconomySettingsPane, { model: model("hidden"), actions: defaultActions })
    );

    expect(
      markup.startsWith('<section class="service-strip" aria-label="Live services" hidden="">')
    ).toBe(true);
    expect(markup).toContain('aria-label="Market price data"');
    expect(markup).not.toContain('aria-label="Price data settings"');
    expect(markup).not.toContain('aria-label="Price history analysis"');
  });

  it("renders every current price note in one controlled native disclosure", () => {
    const priceNotices = [
      {
        code: "missing-price",
        itemId: "lobster",
        itemLabel: "Lobster",
        level: "issue" as const,
        consumer: "supply" as const,
        affectsCurrentResult: true,
        summary: "Missing price",
        detail: "Lobster has no usable price."
      },
      {
        code: "price-generated-fallback",
        itemId: "bones",
        itemLabel: "Bones",
        level: "note" as const,
        consumer: "loot" as const,
        affectsCurrentResult: true,
        lootRowId: "bones-row",
        summary: "Estimated price",
        detail: "Bones use a game-data estimate."
      }
    ];
    const calls: boolean[] = [];
    const paneModel: EconomySettingsPaneModel = {
      ...model("economy"),
      priceNotices: {
        issues: [priceNotices[0]!],
        notes: [priceNotices[1]!],
        all: priceNotices,
        byLootRowId: { "bones-row": [priceNotices[1]!] }
      },
      priceNotesOpen: true
    };
    const paneActions: EconomySettingsPaneActions = {
      ...defaultActions,
      setPriceNotesOpen: (open) => calls.push(open)
    };
    const tree = EconomySettingsPane({ model: paneModel, actions: paneActions });
    const details = elements(tree).find(
      (element) =>
        element.type === "details" &&
        (element.props as { "aria-label"?: string })["aria-label"] === "Economy price data notes"
    );
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("Price data notes (2)");
    expect(markup).toContain("Lobster");
    expect(markup).toContain("Bones");
    expect(markup).not.toContain("2 more");
    expect(details?.props).toMatchObject({ open: true });
    (details!.props as { onToggle(event: { currentTarget: { open: boolean } }): void }).onToggle({
      currentTarget: { open: false }
    });
    expect(calls).toEqual([false]);
  });

  it("keeps confirmations and the one PriceSet notice in the shared Market section", () => {
    const settingsModel: EconomySettingsPaneModel = {
      ...model("settings"),
      priceSetResetPending: true,
      marketNotice: { tone: "warning", message: "Market fixture warning" },
      importNotice: {
        tone: "error",
        message: "Settings import fixture failed"
      },
      recovery: {
        ...model("settings").recovery,
        visible: true,
        notice: "Recovery fixture notice"
      }
    };
    const settingsMarkup = renderToStaticMarkup(
      createElement(EconomySettingsPane, { model: settingsModel, actions: defaultActions })
    );
    inOrder(settingsMarkup, [
      'aria-label="Local state recovery"',
      "Recovery fixture notice",
      'aria-label="Price data settings"',
      'aria-label="Hidden gear tiers"',
      'aria-label="Market price data"',
      "Advanced PriceSet tools",
      "Confirm reset to bundled prices",
      "Settings import fixture failed"
    ]);
    expect(settingsMarkup).toContain("Market fixture warning");

    const economyModel: EconomySettingsPaneModel = {
      ...model("economy"),
      priceSetResetPending: true,
      priceHistoryClearPending: true,
      manualPriceClearPending: true,
      marketNotice: { tone: "success", message: "Market fixture ready" },
      importNotice: {
        tone: "success",
        message: "Market import fixture succeeded"
      }
    };
    const economyMarkup = renderToStaticMarkup(
      createElement(EconomySettingsPane, { model: economyModel, actions: defaultActions })
    );
    inOrder(economyMarkup, [
      "Confirm clear all manual prices",
      "Confirm reset to bundled prices",
      "Market import fixture succeeded",
      "Market fixture ready",
      "Confirm clear local history",
      'aria-label="Price history analysis"'
    ]);
  });

  it("routes sorting, tier toggles and file imports through typed actions", async () => {
    const calls: string[] = [];
    const actions: EconomySettingsPaneActions = {
      ...defaultActions,
      prices: {
        ...defaultActions.prices,
        importPriceSet: async (file) => {
          calls.push(`import:${file.name}`);
        }
      },
      history: {
        ...defaultActions.history,
        saveLocalComparison: () => calls.push("history:save"),
        requestClear: () => calls.push("history:clear"),
        setBaselineMode: (mode) => calls.push(`baseline:${mode}`),
        setItemFilter: (filter) => calls.push(`filter:${filter}`),
        sortBy: (key) => calls.push(`sort:${key}`)
      },
      manual: {
        ...defaultActions.manual,
        selectItem: (itemId) => calls.push(`manual:select:${itemId}`),
        setDraft: (value) => calls.push(`manual:draft:${value}`),
        apply: () => calls.push("manual:apply")
      },
      settings: {
        ...defaultActions.settings,
        setTierHidden: (tierId, hidden) => calls.push(`tier:${tierId}:${hidden}`)
      },
      recovery: {
        ...defaultActions.recovery,
        beginClear: (id) => calls.push(`recovery:${id}`)
      }
    };
    const economyTree = EconomySettingsPane({ model: model("economy"), actions });
    const economyElements = elements(economyTree);
    const sortButton = elements(economyTree).find(
      (element) =>
        element.type === "button" &&
        (element.props as { children?: ReactNode }).children === "GP delta"
    );
    (sortButton!.props as { onClick(): void }).onClick();
    const baselineField = economyElements.find(
      (element) =>
        typeof element.type === "function" &&
        (element.props as { label?: string }).label === "Baseline"
    );
    (baselineField!.props as { onChange(value: string): void }).onChange("first");
    const filterInput = economyElements.find(
      (element) =>
        element.type === "input" && (element.props as { id?: string }).id === "economy-item-filter"
    );
    (filterInput!.props as { onChange(event: { target: { value: string } }): void }).onChange({
      target: { value: "lob" }
    });
    const manualSelect = economyElements.find(
      (element) =>
        typeof element.type === "function" &&
        (element.props as { label?: string }).label === "Manual price item"
    );
    (manualSelect!.props as { onChange(value: string): void }).onChange("lobster");
    const manualInput = economyElements.find(
      (element) =>
        typeof element.type === "function" &&
        (element.props as { label?: string }).label === "Manual price"
    );
    (manualInput!.props as { onChange(value: number): void }).onChange(777);
    const button = (label: string) =>
      economyElements.find(
        (element) =>
          element.type === "button" &&
          (element.props as { children?: ReactNode }).children === label
      );
    (button("Apply price")!.props as { onClick(): void }).onClick();
    (button("Save local comparison")!.props as { onClick(): void }).onClick();
    (button("Clear local history")!.props as { onClick(): void }).onClick();

    const settingsWithRecovery = {
      ...model("settings"),
      recovery: { ...model("settings").recovery, visible: true }
    };
    const settingsTree = EconomySettingsPane({ model: settingsWithRecovery, actions });
    const settingsElements = elements(settingsTree);
    const checkbox = settingsElements.find(
      (element) =>
        element.type === "input" && (element.props as { type?: string }).type === "checkbox"
    );
    (checkbox!.props as { onChange(event: { target: { checked: boolean } }): void }).onChange({
      target: { checked: false }
    });
    const recoveryPanel = settingsElements.find(
      (element) =>
        typeof element.type === "function" &&
        (element.props as { visible?: boolean; report?: unknown }).visible === true &&
        (element.props as { report?: unknown }).report !== undefined
    );
    (recoveryPanel!.props as { onBeginClear(id: "invalid-all"): void }).onBeginClear("invalid-all");
    const target = {
      files: [new File(["{}"], "prices.json", { type: "application/json" })],
      value: "prices.json"
    };
    await importPriceSetFromInput(
      { currentTarget: target } as unknown as Parameters<typeof importPriceSetFromInput>[0],
      actions.prices.importPriceSet
    );

    expect(calls).toEqual([
      "sort:gpDelta",
      "baseline:first",
      "filter:lob",
      "manual:select:lobster",
      "manual:draft:777",
      "manual:apply",
      "history:save",
      "history:clear",
      "tier:bronze:false",
      "recovery:invalid-all",
      "import:prices.json"
    ]);
    expect(target.value).toBe("");
  });
});

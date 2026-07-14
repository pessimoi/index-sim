import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EconomySettingsPane,
  type EconomySettingsPaneActions,
  type EconomySettingsPaneMode,
  type EconomySettingsPaneModel
} from "../app/components/panes/economy-settings-pane";
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
    moneyWarnings: [],
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

  it("keeps confirmation branches, recovery and scoped notices in their current sections", () => {
    const settingsModel: EconomySettingsPaneModel = {
      ...model("settings"),
      priceSetResetPending: true,
      marketNotice: { tone: "warning", message: "Market fixture warning" },
      importNotice: {
        surface: "settings",
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
      "Confirm reset to bundled prices",
      "Settings import fixture failed",
      'aria-label="Hidden gear tiers"',
      'aria-label="Market price data"'
    ]);
    expect(settingsMarkup).toContain("Market fixture warning");

    const economyModel: EconomySettingsPaneModel = {
      ...model("economy"),
      priceSetResetPending: true,
      priceHistoryClearPending: true,
      manualPriceClearPending: true,
      marketNotice: { tone: "success", message: "Market fixture ready" },
      importNotice: {
        surface: "market",
        tone: "success",
        message: "Market import fixture succeeded"
      }
    };
    const economyMarkup = renderToStaticMarkup(
      createElement(EconomySettingsPane, { model: economyModel, actions: defaultActions })
    );
    inOrder(economyMarkup, [
      "Confirm reset to bundled prices",
      "Confirm clear local history",
      "Confirm clear all manual prices",
      "Market fixture ready",
      "Market import fixture succeeded",
      'aria-label="Price history analysis"'
    ]);
  });

  it("routes sorting, tier toggles and file imports through typed actions", async () => {
    const calls: string[] = [];
    const actions: EconomySettingsPaneActions = {
      ...defaultActions,
      prices: {
        ...defaultActions.prices,
        importPriceSet: async (file, surface) => {
          calls.push(`import:${surface}:${file.name}`);
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
    const fileInput = settingsElements.find(
      (element) => element.type === "input" && (element.props as { type?: string }).type === "file"
    );
    const target = {
      files: [new File(["{}"], "prices.json", { type: "application/json" })],
      value: "prices.json"
    };
    (fileInput!.props as { onChange(event: { target: typeof target }): void }).onChange({ target });
    await Promise.resolve();
    await Promise.resolve();

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
      "import:settings:prices.json"
    ]);
    expect(target.value).toBe("");
  });
});

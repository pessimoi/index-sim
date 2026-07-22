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
import {
  createSettingsPaneViewModel,
  type GameRevisionViewModel
} from "../app/view-models/settings";
import type { PriceSet } from "../domain/shared";
import { createPriceTimeContext, presentPriceDateTime } from "../app/view-models/price-time";

const noOp = () => undefined;

const revision: GameRevisionViewModel = {
  revisionLabel: "Revision 274",
  snapshotLabel: "LostCity fixture runtime",
  snapshotId: "lostcity-376072662e78-runtime",
  sourceLabel: "LostCityRS/Content",
  sourceCommit: "376072662e78a314bf35bb18815be39521491a6b",
  sourceCommitShort: "376072662e78",
  generatedAt: "2026-07-09T00:00:00.000Z"
};

const defaultActions: EconomySettingsPaneActions = {
  setPriceNotesOpen: noOp,
  reviewPriceItem: noOp,
  navigate: noOp,
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
    reviewRemoval: noOp,
    cancelReview: noOp,
    confirmReview: noOp,
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
  },
  monsterChanges: {
    reviewCategory: noOp,
    reviewRemoval: noOp,
    cancelRemoval: noOp,
    confirmRemoval: noOp
  },
  workspace: {
    setIncludeLastHiscoresPlayer: noOp,
    exportWorkspace: noOp,
    dismissReview: noOp,
    reviewRecovery: noOp,
    restore: async () => undefined
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
    settings: createSettingsPaneViewModel({ bronze: true }, revision),
    priceNotices: { issues: [], notes: [], all: [], byLootRowId: {}, resultAction: null },
    priceNotesOpen: false,
    marketNotice: null,
    importNotice: null,
    priceSetResetPending: false,
    priceHistoryClearPending: false,
    manualPriceClearPending: false,
    historyNotice: null,
    historyReview: null,
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
    },
    monsterChanges: {
      inventory: {
        monsterCount: 0,
        categoryCount: 0,
        countsByKind: {
          "custom-setup": 0,
          cannon: 0,
          "loot-actions": 0,
          "loot-settings": 0,
          "compare-hidden": 0
        },
        rows: []
      },
      removalCandidate: null,
      notice: null,
      sessionOnlyAvailable: false
    },
    workspace: {
      phase: "idle",
      includeLastHiscoresPlayer: false,
      notice: null,
      review: null,
      selection: null,
      restorePlan: null,
      currentRevisionLabel: revision.revisionLabel,
      currentSnapshotLabel: revision.snapshotLabel,
      currentSnapshotId: revision.snapshotId,
      canIncludeLastHiscoresPlayer: false
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
      'aria-label="Price history analysis"',
      'aria-label="Local price history lifecycle"',
      'aria-label="Price history summary"',
      'aria-label="Selected item price provenance"',
      'aria-label="Item price trend"',
      'aria-label="Top movers"',
      'aria-label="Price movers"'
    ]);
    expect(markup).not.toContain('aria-label="Price data settings"');
    expect(markup).not.toContain('aria-label="Hidden gear tiers"');
    expect(markup.match(/aria-label="Market price data"/g)).toHaveLength(1);
    expect(markup.match(/aria-label="Scheduled price snapshot summary"/g)).toHaveLength(1);
    expect(markup.match(/aria-label="Market active PriceSet summary"/g)).toHaveLength(1);
    expect(markup.match(/aria-label="Advanced PriceSet tools"/g)).toHaveLength(1);
    expect(markup).toContain("<summary>Technical details</summary>");
    expect(markup).not.toContain("Item ID:");
  });

  it("keeps Settings calculation, Workspace, short PriceSet summary and Gear menu in order", () => {
    const markup = renderToStaticMarkup(
      createElement(EconomySettingsPane, { model: model("settings"), actions: defaultActions })
    );

    expect(markup.startsWith('<section class="service-strip" aria-label="Settings">')).toBe(true);
    inOrder(markup, [
      'aria-label="Calculation context"',
      "Revision 274",
      'aria-label="Workspace tools"',
      'aria-label="Price data settings"',
      'aria-label="Active PriceSet summary"',
      'aria-label="Hidden gear tiers"',
      'aria-label="Gear tier visibility"'
    ]);
    expect(markup).toContain("Review in Economy");
    expect(markup).toContain("Active source Bundled fallback");
    expect(markup).toContain("Bundled price set created");
    expect(markup).toContain("1 hr ago");
    expect(markup).toContain('dateTime="2026-07-14T12:00:00.000Z"');
    expect(markup).not.toContain('aria-label="Scheduled price snapshot summary"');
    expect(markup).not.toContain('aria-label="Market price data"');
    expect(markup).not.toContain("Advanced PriceSet tools");
    expect(markup).not.toContain('aria-label="Manual item price"');
    expect(markup).not.toContain('aria-label="Price history analysis"');
    expect(markup.match(/aria-label="Active PriceSet summary"/g)).toHaveLength(1);
    expect(markup).toContain("LostCity fixture runtime");
    expect(markup).toContain("lostcity-376072662e78-runtime");
    expect(markup).toContain("LostCityRS/Content · 376072662e78");
    expect(markup).toContain("2026-07-09T00:00:00.000Z");
    expect(markup).toContain("Setup transfers do not include prices");
    expect(markup).not.toContain(".sources");
  });

  it("emits only the typed Review-in-Economy navigation intent from Settings", () => {
    const calls: unknown[] = [];
    const tree = EconomySettingsPane({
      model: model("settings"),
      actions: { ...defaultActions, navigate: (intent) => calls.push(intent) }
    });
    const reviewButton = elements(tree).find(
      (element) =>
        element.type === "button" &&
        (element.props as { children?: ReactNode }).children === "Review in Economy"
    );

    expect(reviewButton).toBeDefined();
    (reviewButton!.props as { onClick(): void }).onClick();
    expect(calls).toEqual([{ kind: "review-price-data-in-economy" }]);
  });

  it("renders one collapsed, fully explained PriceSet workflow only in Economy", () => {
    const mode = "economy" as const;
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
    expect(markup).toContain(
      "A PriceSet file contains its validated item prices, metadata, provenance and compatible alchValues field. Manual item prices and price history are separate browser-local state."
    );
    expect(markup).toContain("Use <strong>Manual item price</strong>");
    expect(markup).toContain("a PriceSet JSON exported by this app, up to 1 MB");
    expect(markup).toContain("High alch values always come from current game data");
    expect(markup).toContain("File format");
    expect(markup).toContain("complete replacement map, not a patch");
    expect(markup).toContain('accept="application/json,.json"');
    expect(markup.match(/aria-describedby="[^"]+ [^"]+ [^"]+"/g)).toHaveLength(2);
    inOrder(markup, ["Export active PriceSet", "Review PriceSet file", "Reset imported PriceSet"]);
    expect(markup).not.toContain("Import prices");
    expect(markup).not.toContain("Import PriceSet");
    expect(markup).not.toContain("Reset local price override");
    const settingsMarkup = renderToStaticMarkup(
      createElement(EconomySettingsPane, { model: model("settings"), actions: defaultActions })
    );
    expect(settingsMarkup).not.toContain("Advanced PriceSet tools");
    expect(settingsMarkup).not.toContain("Review PriceSet file");
  });

  it("keeps the hidden shared service strip mounted without detailed Market content", () => {
    const markup = renderToStaticMarkup(
      createElement(EconomySettingsPane, { model: model("hidden"), actions: defaultActions })
    );

    expect(
      markup.startsWith('<section class="service-strip" aria-label="Live services" hidden="">')
    ).toBe(true);
    expect(markup).not.toContain('aria-label="Market price data"');
    expect(markup).not.toContain('aria-label="Price data settings"');
    expect(markup).not.toContain('aria-label="Price history analysis"');
  });

  it("renders every current price note in one controlled native disclosure", () => {
    const priceNotices = [
      {
        noticeId: "missing-price:lobster:supply:",
        code: "missing-price",
        itemId: "lobster",
        itemLabel: "Lobster",
        itemDisplayLabel: {
          name: "Lobster",
          technicalId: "lobster",
          source: "game-data" as const
        },
        level: "issue" as const,
        consumer: "supply" as const,
        affectsCurrentResult: true,
        summary: "Missing price",
        detail: "Lobster has no usable price.",
        action: {
          kind: "correct-price" as const,
          itemId: "lobster",
          noticeId: "missing-price:lobster:supply:",
          label: "Correct price" as const
        }
      },
      {
        noticeId: "price-generated-fallback:bones:loot:bones-row",
        code: "price-generated-fallback",
        itemId: "bones",
        itemLabel: "Bones",
        itemDisplayLabel: {
          name: "Bones",
          technicalId: "bones",
          source: "game-data" as const
        },
        level: "note" as const,
        consumer: "loot" as const,
        affectsCurrentResult: true,
        lootRowId: "bones-row",
        summary: "Estimated price",
        detail: "Bones use a game-data estimate."
      }
    ];
    const calls: Array<boolean | string> = [];
    const paneModel: EconomySettingsPaneModel = {
      ...model("economy"),
      priceNotices: {
        issues: [priceNotices[0]!],
        notes: [priceNotices[1]!],
        all: priceNotices,
        byLootRowId: { "bones-row": [priceNotices[1]!] },
        resultAction: null
      },
      priceNotesOpen: true
    };
    const paneActions: EconomySettingsPaneActions = {
      ...defaultActions,
      setPriceNotesOpen: (open) => calls.push(open),
      reviewPriceItem: (action) => calls.push(`${action.kind}:${action.itemId}:${action.noticeId}`)
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
    expect(markup).toContain('aria-label="Correct price for Lobster"');
    expect(markup).toContain("<dt>Item ID</dt><dd><code>lobster</code></dd>");
    expect(markup).not.toContain("Item ID: lobster");
    expect(markup).not.toContain("2 more");
    expect(details?.props).toMatchObject({ open: true });
    (details!.props as { onToggle(event: { currentTarget: { open: boolean } }): void }).onToggle({
      currentTarget: { open: false }
    });
    const correctButton = elements(tree).find(
      (element) =>
        element.type === "button" &&
        (element.props as { "aria-label"?: string })["aria-label"] === "Correct price for Lobster"
    );
    (correctButton!.props as { onClick(): void }).onClick();
    expect(calls).toEqual([false, "correct-price:lobster:missing-price:lobster:supply:"]);
  });

  it("passes the dedicated ref only to the native Manual price field", () => {
    const inputRef = { current: null };
    const tree = EconomySettingsPane({
      model: model("economy"),
      actions: defaultActions,
      manualPriceInputRef: inputRef
    });
    const manualInput = elements(tree).find(
      (element) =>
        typeof element.type === "function" &&
        (element.props as { label?: string }).label === "Manual price"
    );

    expect((manualInput?.props as { inputRef?: unknown }).inputRef).toBe(inputRef);
  });

  it("passes the Workspace model, actions and focus refs through the lazy Settings boundary", () => {
    const paneModel = model("settings");
    const inputRef = { current: null };
    const exportRef = { current: null };
    const headingRef = { current: null };
    const tree = EconomySettingsPane({
      model: paneModel,
      actions: defaultActions,
      workspaceImportInputRef: inputRef,
      workspaceExportButtonRef: exportRef,
      workspaceReviewHeadingRef: headingRef
    });
    const workspaceElement = elements(tree).find((element) => {
      const props = element.props as { model?: unknown };
      return props.model === paneModel.workspace;
    });

    expect(workspaceElement?.props).toMatchObject({
      model: paneModel.workspace,
      actions: defaultActions.workspace,
      importInputRef: inputRef,
      exportButtonRef: exportRef,
      reviewHeadingRef: headingRef
    });
  });

  it("keeps Market confirmations and notices exclusively in Economy", () => {
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
      'aria-label="Calculation context"',
      'aria-label="Workspace tools"',
      'aria-label="Local state recovery"',
      "Recovery fixture notice",
      'aria-label="Price data settings"',
      'aria-label="Hidden gear tiers"'
    ]);
    expect(settingsMarkup).not.toContain('aria-label="Market price data"');
    expect(settingsMarkup).not.toContain("Advanced PriceSet tools");
    expect(settingsMarkup).not.toContain("Confirm reset to bundled prices");
    expect(settingsMarkup).not.toContain("Settings import fixture failed");
    expect(settingsMarkup).not.toContain("Market fixture warning");

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
      'aria-label="Price history analysis"',
      "Confirm clear local history"
    ]);
  });

  it("lists each local occurrence separately and renders exact lifecycle reviews", () => {
    const base = model("economy");
    const timeContext = createPriceTimeContext(new Date("2026-07-20T13:00:00Z"), "UTC");
    const localManagement = {
      count: 20,
      maximum: 20,
      remaining: 0,
      atCapacity: true,
      rows: [
        {
          occurrenceId: "duplicate--0",
          sourceIndex: 0,
          snapshotKey: "same-key",
          label: "Newest prices",
          capturedAt: "2026-07-20T12:00:00.000Z",
          captureTime: presentPriceDateTime("2026-07-20T12:00:00.000Z", timeContext),
          sourcePriceSetId: "prices-newest",
          itemCount: 2,
          newest: true,
          oldest: false,
          nextReplacement: false,
          selectedAsBaseline: false
        },
        {
          occurrenceId: "duplicate--1",
          sourceIndex: 19,
          snapshotKey: "same-key",
          label: "Oldest prices",
          capturedAt: "2026-07-01T12:00:00.000Z",
          captureTime: presentPriceDateTime("2026-07-01T12:00:00.000Z", timeContext),
          sourcePriceSetId: "prices-oldest",
          itemCount: 1,
          newest: false,
          oldest: true,
          nextReplacement: true,
          selectedAsBaseline: true
        }
      ]
    };
    const paneModel: EconomySettingsPaneModel = {
      ...base,
      prices: {
        ...base.prices,
        history: { ...base.prices.history, localManagement }
      },
      historyNotice: { tone: "warning", message: "Fixture lifecycle warning" },
      historyReview: {
        kind: "replacement",
        id: 7,
        activePriceSetLabel: "Active prices",
        replacedLabel: "Oldest prices",
        replacedCaptureTime: presentPriceDateTime("2026-07-01T12:00:00.000Z", timeContext),
        replacedItemCount: 1
      }
    };
    const markup = renderToStaticMarkup(
      createElement(EconomySettingsPane, { model: paneModel, actions: defaultActions })
    );

    expect(markup).toContain("Local comparisons 20/20");
    expect(markup).toContain("History full");
    expect(markup.match(/Review removal/g)).toHaveLength(4);
    expect(markup).toContain("Newest prices");
    expect(markup).toContain("Oldest prices");
    expect(markup).toContain("Next to be replaced");
    expect(markup).toContain("Selected baseline");
    expect(markup).toContain(
      '<time dateTime="2026-07-01T12:00:00.000Z" title="1 Jul 2026, 12:00:00 UTC" aria-label="1 July 2026 at 12:00 Coordinated Universal Time">1 Jul 2026, 12:00 UTC</time>'
    );
    expect(markup).toContain("Save and replace the oldest local comparison?");
    expect(markup).toContain("Replace Oldest prices");
    expect(markup).toContain("Fixture lifecycle warning");
    expect(markup).toContain("Scheduled shared history is read-only");
    expect(markup).toContain("Local history is included in Workspace backup");
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

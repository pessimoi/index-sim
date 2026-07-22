import { useId, type Ref, type RefObject } from "react";
import type {
  LocalStateHealthItemId,
  LocalStateHealthReport
} from "../../state/local-state-health";
import type { LocalStateClearPendingId } from "../../controllers/local-state-recovery";
import type { MarketNotice } from "../../controllers/price-set-transfer";
import type { PriceImportNotice } from "../../state/price-import";
import type { GearTierId } from "../../state/hidden-gear-tiers";
import type { PriceHistoryBaselineMode, PriceHistoryMoverSortKey } from "../../state/price-history";
import {
  economyAriaSort,
  economyMoverTone,
  PRICE_HISTORY_BASELINE_OPTIONS,
  type CurrentPriceNoticePresentation,
  type PriceDataViewModel,
  type PriceNoticeAction
} from "../../view-models/price-data";
import type { SettingsNavigationIntent, SettingsPaneViewModel } from "../../view-models/settings";
import { formatNumber } from "../../view-models/formatting";
import { InlineImportNotice } from "../app-presenters";
import { DecimalField, SearchableSelectField, SelectField } from "../form-fields";
import {
  itemPriceMetadataLabel,
  optionalDelta,
  optionalPercent,
  optionalPrice
} from "../presentation-formatters";
import { PriceTrendChart, PriceTrendSparkline } from "../price-history-charts";
import { PriceTime, PriceTimeFactPair } from "../price-time";
import type { PriceDateTimePresentation } from "../../view-models/price-time";
import { LocalStateRecoveryPanel } from "../settings/local-state-recovery-panel";
import {
  CrossTabConflictPanel,
  type CrossTabConflictPanelActions,
  type CrossTabConflictPanelModel
} from "../settings/cross-tab-conflict-panel";
import {
  MonsterSpecificChangesPanel,
  type MonsterSpecificChangesPanelActions,
  type MonsterSpecificChangesPanelModel
} from "../settings/monster-specific-changes-panel";
import type {
  WorkspaceBackupPanelActions,
  WorkspaceBackupPanelModel,
  WorkspaceBackupPanelProps
} from "../settings/workspace-backup-panel";
import { importPriceSetFromInput } from "./price-set-import-input";
import { NestedPaneBoundary } from "../shell/pane-boundary";
import { createTrackedLazyPane } from "../shell/tracked-lazy-pane";

const trackedWorkspaceBackupPanel = createTrackedLazyPane<WorkspaceBackupPanelProps>(
  () => import("../settings/workspace-backup-panel")
);
const WorkspaceBackupPanel = trackedWorkspaceBackupPanel.Component;

export type EconomySettingsPaneMode = "economy" | "settings" | "hidden";

export interface EconomySettingsPaneModel {
  mode: EconomySettingsPaneMode;
  prices: PriceDataViewModel;
  settings: SettingsPaneViewModel;
  priceNotices: CurrentPriceNoticePresentation;
  priceNotesOpen: boolean;
  marketNotice: MarketNotice | null;
  importNotice: PriceImportNotice | null;
  priceSetResetPending: boolean;
  priceHistoryClearPending: boolean;
  manualPriceClearPending: boolean;
  historyNotice: { tone: "neutral" | "success" | "warning" | "error"; message: string } | null;
  historyReview:
    | {
        kind: "removal";
        id: number;
        occurrenceId: string;
        label: string;
        captureTime: PriceDateTimePresentation;
        itemCount: number;
      }
    | {
        kind: "replacement";
        id: number;
        activePriceSetLabel: string;
        replacedLabel: string;
        replacedCaptureTime: PriceDateTimePresentation;
        replacedItemCount: number;
      }
    | null;
  recovery: {
    visible: boolean;
    report: LocalStateHealthReport;
    notice: string | null;
    exportNotice?: { tone: "neutral" | "error"; message: string };
    pendingClearId: LocalStateClearPendingId;
  };
  crossTab?: CrossTabConflictPanelModel;
  monsterChanges: MonsterSpecificChangesPanelModel;
  workspace: WorkspaceBackupPanelModel;
}

export interface EconomySettingsPaneActions {
  setPriceNotesOpen(open: boolean): void;
  reviewPriceItem(action: PriceNoticeAction): void;
  navigate(intent: SettingsNavigationIntent): void;
  prices: {
    importPriceSet(file: File): Promise<void>;
    exportActivePriceSet(): void;
    requestReset(): void;
    confirmReset(): void;
    cancelReset(): void;
  };
  history: {
    saveLocalComparison(): void;
    requestClear(): void;
    confirmClear(): void;
    cancelClear(): void;
    setBaselineMode(value: PriceHistoryBaselineMode): void;
    setSnapshotKey(value: string): void;
    setItemFilter(value: string): void;
    setTrendItemId(value: string): void;
    sortBy(key: PriceHistoryMoverSortKey): void;
    reviewRemoval(occurrenceId: string): void;
    cancelReview(): void;
    confirmReview(): void;
  };
  manual: {
    selectItem(itemId: string): void;
    setDraft(value: number): void;
    apply(): void;
    resetItem(): void;
    requestClearAll(): void;
    confirmClearAll(): void;
    cancelClearAll(): void;
  };
  settings: {
    setTierHidden(tierId: GearTierId, hidden: boolean): void;
    hideAllTiers(): void;
    showAllTiers(): void;
  };
  recovery: {
    exportReport(): void;
    beginClear(id: LocalStateHealthItemId | "invalid-all"): void;
    cancelClear(): void;
    confirmClearItem(id: LocalStateHealthItemId): void;
    confirmClearInvalid(): void;
  };
  crossTab?: CrossTabConflictPanelActions;
  monsterChanges: MonsterSpecificChangesPanelActions;
  workspace: WorkspaceBackupPanelActions;
}

export interface EconomySettingsPaneProps {
  model: EconomySettingsPaneModel;
  actions: EconomySettingsPaneActions;
  priceNotesSummaryRef?: Ref<HTMLElement>;
  manualPriceInputRef?: Ref<HTMLInputElement>;
  workspaceImportInputRef?: Ref<HTMLInputElement>;
  workspaceExportButtonRef?: Ref<HTMLButtonElement>;
  workspaceReviewHeadingRef?: Ref<HTMLHeadingElement>;
  setPriceNoticeActionRef?(noticeId: string, element: HTMLButtonElement | null): void;
  marketHeadingRef?: Ref<HTMLHeadingElement>;
  historyReviewReturnFocusRef?: RefObject<HTMLButtonElement | null>;
  historyReviewHeadingRef?: Ref<HTMLHeadingElement>;
  historyManagementSummaryRef?: Ref<HTMLElement>;
  selectedPriceItemRef?: Ref<HTMLDivElement>;
}

function TechnicalDetails({
  itemId,
  sourceNameUnavailable = false
}: {
  itemId: string | null;
  sourceNameUnavailable?: boolean;
}) {
  if (!itemId && !sourceNameUnavailable) return null;
  return (
    <details className="technical-details">
      <summary>Technical details</summary>
      <dl>
        {itemId ? (
          <div>
            <dt>Item ID</dt>
            <dd>
              <code>{itemId}</code>
            </dd>
          </div>
        ) : null}
        {sourceNameUnavailable ? (
          <div>
            <dt>Name source</dt>
            <dd>Source name unavailable</dd>
          </div>
        ) : null}
      </dl>
    </details>
  );
}

function ScheduledSnapshotSummary({ prices }: { prices: PriceDataViewModel }) {
  const scheduled = prices.scheduled;
  return (
    <>
      <div className="price-history-summary" aria-label="Scheduled price snapshot summary">
        <span>Status {scheduled.statusLabel}</span>
        <span>Label {scheduled.label}</span>
        <span>Source scheduled static JSON</span>
        <PriceTimeFactPair
          presentation={scheduled.time}
          exactLabel={scheduled.timeLabel}
          relativeLabel="Captured"
        />
        <span>Item prices {formatNumber(scheduled.itemCount)}</span>
        <span>Observed high {formatNumber(scheduled.metadata.observedHigh)}</span>
        <span>Observed medium {formatNumber(scheduled.metadata.observedMedium)}</span>
        <span>Observed low {formatNumber(scheduled.metadata.observedLow)}</span>
        <span>Retained {formatNumber(scheduled.metadata.retained)}</span>
        <span>Unknown provenance {formatNumber(scheduled.metadata.unknown)}</span>
        <span>Missing mapped {formatNumber(scheduled.metadata.missingMapped)}</span>
        <span>Alch values {formatNumber(scheduled.alchCount)}</span>
        <span>Fallback {scheduled.fallbackLabel}</span>
      </div>
      <p
        className={`inline-status ${scheduled.tone}`}
        role={scheduled.tone === "error" || scheduled.tone === "warning" ? "alert" : "status"}
      >
        {scheduled.message}
      </p>
    </>
  );
}

function AdvancedPriceSetTools({
  model,
  actions
}: {
  model: EconomySettingsPaneModel;
  actions: EconomySettingsPaneActions;
}) {
  const replacementHelpId = useId();
  const formatHelpId = useId();
  const scopeHelpId = useId();

  return (
    <details className="advanced-price-set-tools" aria-label="Advanced PriceSet tools">
      <summary>Advanced PriceSet tools</summary>
      <div className="advanced-price-set-tools-content">
        <p id={replacementHelpId}>
          Importing replaces the complete local base PriceSet in this browser. Missing items are not
          merged from the committed snapshot. Use <strong>Manual item price</strong> for individual
          corrections.
        </p>
        <p id={scopeHelpId}>
          A PriceSet file contains its validated item prices, metadata, provenance and compatible
          alchValues field. Manual item prices and price history are separate browser-local state.
        </p>
        <p id={formatHelpId}>
          Accepted file: a PriceSet JSON exported by this app, up to 1 MB. High alch values always
          come from current game data.
        </p>
        <details className="price-set-format-help">
          <summary>File format</summary>
          <p>
            Export the active PriceSet for the preferred backup and import template. A minimal file
            contains these required fields:
          </p>
          <pre>
            <code>{`{
  "id": "custom-prices",
  "label": "Custom prices",
  "source": "manual",
  "createdAt": "2026-07-17T08:00:00.000Z",
  "itemPrices": {
    "big_bones": 1000,
    "lobster": 50
  },
  "alchValues": {}
}`}</code>
          </pre>
          <ul>
            <li>Item ids use the app&apos;s canonical item keys.</li>
            <li>Prices must be finite non-negative numbers.</li>
            <li>
              <code>itemPrices</code> is a complete replacement map, not a patch.
            </li>
            <li>
              <code>alchValues</code> is required, but imported values are replaced by current
              generated game data.
            </li>
          </ul>
        </details>
        <div className="market-sync-bar">
          <button
            type="button"
            disabled={!model.prices.active.available}
            aria-describedby={`${scopeHelpId} ${replacementHelpId} ${formatHelpId}`}
            onClick={actions.prices.exportActivePriceSet}
          >
            Export active PriceSet
          </button>
          <label className="file-button">
            Review PriceSet file
            <input
              type="file"
              accept="application/json,.json"
              aria-describedby={`${scopeHelpId} ${replacementHelpId} ${formatHelpId}`}
              onChange={(event) =>
                void importPriceSetFromInput(event, actions.prices.importPriceSet)
              }
            />
          </label>
          {model.priceSetResetPending ? (
            <>
              <button type="button" onClick={actions.prices.confirmReset}>
                Confirm reset to {model.prices.reset.fallbackLabel}
              </button>
              <button type="button" onClick={actions.prices.cancelReset}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!model.prices.reset.canReset}
              onClick={actions.prices.requestReset}
            >
              Reset imported PriceSet
            </button>
          )}
        </div>
        {model.importNotice && (
          <InlineImportNotice
            notice={model.importNotice}
            ariaLabel="Price import notice"
            className="price-import-panel-notice"
          />
        )}
      </div>
    </details>
  );
}

export function EconomySettingsPane({
  model,
  actions,
  priceNotesSummaryRef,
  manualPriceInputRef,
  workspaceImportInputRef,
  workspaceExportButtonRef,
  workspaceReviewHeadingRef,
  setPriceNoticeActionRef,
  marketHeadingRef,
  historyReviewReturnFocusRef,
  historyReviewHeadingRef,
  historyManagementSummaryRef,
  selectedPriceItemRef
}: EconomySettingsPaneProps) {
  const economyVisible = model.mode === "economy";
  const settingsVisible = model.mode === "settings";
  const hidden = model.mode === "hidden";
  const { prices } = model;
  const { history, manual } = prices;
  const cancelHistoryReview = () => {
    const trigger = historyReviewReturnFocusRef?.current;
    actions.history.cancelReview();
    window.requestAnimationFrame(() => trigger?.focus());
  };

  return (
    <section
      className={economyVisible ? "economy-pane" : "service-strip"}
      aria-label={economyVisible ? "Economy" : settingsVisible ? "Settings" : "Live services"}
      hidden={hidden}
    >
      {settingsVisible && (
        <section
          className="service-group calculation-context-panel"
          aria-label="Calculation context"
        >
          <div className="section-title-row">
            <h2>Calculation context</h2>
            <span className="status-pill ready">{model.settings.gameRevision.revisionLabel}</span>
          </div>
          <dl className="calculation-context-grid">
            <div>
              <dt>Game revision</dt>
              <dd>{model.settings.gameRevision.revisionLabel}</dd>
            </div>
            <div>
              <dt>Snapshot</dt>
              <dd>{model.settings.gameRevision.snapshotLabel}</dd>
            </div>
            <div>
              <dt>Snapshot id</dt>
              <dd>
                <code>{model.settings.gameRevision.snapshotId}</code>
              </dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd title={model.settings.gameRevision.sourceCommit ?? undefined}>
                {model.settings.gameRevision.sourceLabel}
                {model.settings.gameRevision.sourceCommitShort
                  ? ` · ${model.settings.gameRevision.sourceCommitShort}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>
                <time dateTime={model.settings.gameRevision.generatedAt}>
                  {model.settings.gameRevision.generatedAt}
                </time>
              </dd>
            </div>
          </dl>
          <p className="inline-status neutral">Setup transfers do not include prices.</p>
        </section>
      )}
      {settingsVisible && model.crossTab && actions.crossTab && (
        <CrossTabConflictPanel model={model.crossTab} actions={actions.crossTab} />
      )}
      {settingsVisible && (
        <MonsterSpecificChangesPanel
          model={model.monsterChanges}
          actions={actions.monsterChanges}
        />
      )}
      {settingsVisible && (
        <NestedPaneBoundary
          active
          label="Workspace tools"
          moduleLoaded={trackedWorkspaceBackupPanel.isLoaded}
        >
          <WorkspaceBackupPanel
            model={model.workspace}
            actions={actions.workspace}
            importInputRef={workspaceImportInputRef}
            exportButtonRef={workspaceExportButtonRef}
            reviewHeadingRef={workspaceReviewHeadingRef}
          />
        </NestedPaneBoundary>
      )}
      <LocalStateRecoveryPanel
        visible={settingsVisible && model.recovery.visible}
        report={model.recovery.report}
        notice={model.recovery.notice}
        exportNotice={model.recovery.exportNotice}
        pendingClearId={model.recovery.pendingClearId}
        onExport={actions.recovery.exportReport}
        onBeginClear={actions.recovery.beginClear}
        onCancelClear={actions.recovery.cancelClear}
        onConfirmClearItem={actions.recovery.confirmClearItem}
        onConfirmClearInvalid={actions.recovery.confirmClearInvalid}
      />
      {settingsVisible && (
        <section className="service-group price-data-panel" aria-label="Price data settings">
          <div className="section-title-row">
            <h2>Price data</h2>
            <span className={`status-pill ${prices.active.available ? "ready" : ""}`}>
              {prices.active.available ? prices.active.sourceLabel : "empty"}
            </span>
          </div>
          <div className="price-history-summary" aria-label="Active PriceSet summary">
            <span>Label {prices.active.label}</span>
            <span>Active source {prices.active.sourceLabel}</span>
            <span>
              {prices.active.timeLabel}{" "}
              <PriceTime presentation={prices.active.time} display="relative" />
            </span>
          </div>
          <button
            type="button"
            onClick={() => actions.navigate({ kind: "review-price-data-in-economy" })}
          >
            Review in Economy
          </button>
        </section>
      )}
      {settingsVisible && (
        <section className="service-group hidden-tier-panel" aria-label="Hidden gear tiers">
          <div className="section-title-row">
            <h2>Gear menu</h2>
            <span className={`status-pill ${model.settings.hasHiddenGearTiers ? "ready" : ""}`}>
              {formatNumber(model.settings.hiddenGearTierCount)} hidden
            </span>
          </div>
          <p className="inline-status neutral">
            Hidden tiers are removed from weapon, ammo, spec and equipment pickers. Current
            selections and None stay visible.
          </p>
          <div className="gear-tier-grid" aria-label="Gear tier visibility">
            {model.settings.hiddenGearTiers.map((tier) => (
              <label className="tier-toggle" key={tier.id}>
                <span>{tier.description}</span>
                <input
                  type="checkbox"
                  checked={tier.hidden}
                  onChange={(event) =>
                    actions.settings.setTierHidden(tier.id, event.target.checked)
                  }
                />
              </label>
            ))}
          </div>
          <div className="market-sync-bar">
            <button type="button" onClick={actions.settings.hideAllTiers}>
              Hide all listed tiers
            </button>
            <button
              type="button"
              disabled={!model.settings.hasHiddenGearTiers}
              onClick={actions.settings.showAllTiers}
            >
              Show all tiers
            </button>
          </div>
        </section>
      )}
      {economyVisible && (
        <section className="service-group" aria-label="Market price data">
          <div className="section-title-row">
            <h2 ref={marketHeadingRef} tabIndex={-1}>
              Market
            </h2>
            <span className={`status-pill ${prices.scheduled.ready ? "ready" : ""}`}>
              {prices.scheduled.statusLabel}
            </span>
          </div>
          <ScheduledSnapshotSummary prices={prices} />
          <p className="inline-status neutral">
            Automatic market upstream refresh is currently disabled. The committed snapshot remains
            the base unless a local PriceSet has been selected. High alch always uses current
            generated game data.
          </p>
          <div className="price-history-summary" aria-label="Market active PriceSet summary">
            <span>Active source {prices.active.sourceLabel}</span>
            <span>Label {prices.active.label}</span>
            <span>Source {prices.active.source}</span>
            <PriceTimeFactPair
              presentation={prices.active.time}
              exactLabel={prices.active.timeLabel}
              relativeLabel="Age"
            />
            <span>Item prices {formatNumber(prices.active.itemCount)}</span>
            <span>Observed high {formatNumber(prices.active.metadata.observedHigh)}</span>
            <span>Observed medium {formatNumber(prices.active.metadata.observedMedium)}</span>
            <span>Observed low {formatNumber(prices.active.metadata.observedLow)}</span>
            <span>Retained {formatNumber(prices.active.metadata.retained)}</span>
            <span>Generated fallback {formatNumber(prices.active.metadata.generatedFallback)}</span>
            <span>Manual {formatNumber(prices.active.metadata.manual)}</span>
            <span>Unknown provenance {formatNumber(prices.active.metadata.unknown)}</span>
            <span>Missing mapped {formatNumber(prices.active.metadata.missingMapped)}</span>
            <span>Alch values {formatNumber(prices.active.alchCount)}</span>
          </div>
          <section className="manual-price-panel" aria-label="Manual item price">
            <div className="loot-section-heading">
              <div>
                <h3>Manual item price</h3>
                <small>
                  Correct one item over the active base PriceSet; high alch is unchanged. Advanced
                  PriceSet tools replace the complete base for transfer or reproduction.
                </small>
              </div>
              <span>
                {formatNumber(manual.activeCount)} active
                {manual.inactiveCount > 0
                  ? ` · ${formatNumber(manual.inactiveCount)} unavailable`
                  : ""}
              </span>
            </div>
            <div className="economy-controls manual-price-controls">
              <SearchableSelectField
                label="Manual price item"
                value={manual.itemId}
                options={manual.itemOptions}
                disabled={manual.itemOptions.length === 0}
                searchPlaceholder="Search priced items"
                onChange={actions.manual.selectItem}
              />
              <DecimalField
                label="Manual price"
                inputRef={manualPriceInputRef}
                value={manual.inputValue}
                min={0}
                max={1_000_000_000_000}
                step={1}
                disabled={!manual.itemId}
                onChange={actions.manual.setDraft}
              />
            </div>
            <div className="price-history-summary" aria-label="Manual item price summary">
              <span>Item {manual.itemLabel}</span>
              <span>Base {optionalPrice(manual.basePrice)}</span>
              <span>Active {optionalPrice(manual.activePrice)}</span>
              <span>Status {manual.selectedOverride ? "Manual" : "Base"}</span>
              <span>
                Manual price updated <PriceTime presentation={manual.updatedTime} display="full" />
              </span>
              <span>
                Stored {formatNumber(manual.storedCount)}/{formatNumber(manual.maxItems)}
              </span>
            </div>
            <div className="market-sync-bar">
              <button
                type="button"
                disabled={!manual.canApply}
                title={
                  manual.atCapacity
                    ? "Reset an existing manual item price before adding another"
                    : undefined
                }
                onClick={actions.manual.apply}
              >
                Apply price
              </button>
              <button
                type="button"
                disabled={!manual.selectedOverride}
                onClick={actions.manual.resetItem}
              >
                Reset item
              </button>
              {model.manualPriceClearPending ? (
                <>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={actions.manual.confirmClearAll}
                  >
                    Confirm clear all manual prices
                  </button>
                  <button type="button" onClick={actions.manual.cancelClearAll}>
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="danger-button"
                  disabled={manual.storedCount === 0}
                  onClick={actions.manual.requestClearAll}
                >
                  Clear all manual prices
                </button>
              )}
            </div>
          </section>
          <AdvancedPriceSetTools model={model} actions={actions} />
          {model.marketNotice && (
            <p
              className={`inline-status ${model.marketNotice.tone}`}
              role={model.marketNotice.tone === "error" ? "alert" : "status"}
              aria-label="Market action notice"
            >
              {model.marketNotice.message}
            </p>
          )}
          {model.priceNotices.all.length > 0 ? (
            <details
              className="price-data-notes"
              aria-label="Economy price data notes"
              open={model.priceNotesOpen}
              onToggle={(event) => {
                if (event.currentTarget.open !== model.priceNotesOpen) {
                  actions.setPriceNotesOpen(event.currentTarget.open);
                }
              }}
            >
              <summary ref={priceNotesSummaryRef}>
                Price data notes ({formatNumber(model.priceNotices.all.length)})
              </summary>
              <p>These values affect the current monetary result. Calculations remain available.</p>
              <ul>
                {model.priceNotices.all.map((notice) => (
                  <li
                    className={notice.level}
                    id={`price-notice-${notice.noticeId}`}
                    key={`${notice.code}:${notice.itemId ?? notice.itemLabel}:${notice.consumer}:${notice.lootRowId ?? ""}`}
                  >
                    <div>
                      <strong>{notice.itemLabel}</strong>
                      <span>{notice.summary}</span>
                    </div>
                    <p>{notice.detail}</p>
                    {notice.action ? (
                      <button
                        ref={(element) => setPriceNoticeActionRef?.(notice.noticeId, element)}
                        type="button"
                        aria-label={`${notice.action.label} for ${notice.itemLabel}`}
                        onClick={() => actions.reviewPriceItem(notice.action!)}
                      >
                        {notice.action.label}
                      </button>
                    ) : null}
                    <small>
                      {notice.consumer === "loot"
                        ? "Loot"
                        : notice.consumer === "cannon"
                          ? "Cannon"
                          : "Supply"}
                    </small>
                    <TechnicalDetails
                      itemId={notice.itemId ?? null}
                      sourceNameUnavailable={notice.itemDisplayLabel.source === "fallback"}
                    />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      )}
      {economyVisible && (
        <section
          className="service-group economy-history-panel"
          aria-label="Price history analysis"
        >
          <div className="section-title-row">
            <h2>Price history</h2>
            <span className="status-pill">{history.sourceStatus}</span>
          </div>
          <div className="price-history-lifecycle" aria-label="Local price history lifecycle">
            <div className="price-history-summary">
              <span>
                Local comparisons {formatNumber(history.localManagement.count)}/
                {formatNumber(history.localManagement.maximum)}
              </span>
              <span>
                {history.localManagement.atCapacity
                  ? "History full"
                  : `${formatNumber(history.localManagement.remaining)} spaces remaining`}
              </span>
            </div>
            {history.localManagement.atCapacity ? (
              <p className="inline-status neutral">
                History is full. Saving another local comparison requires replacing the oldest
                point.
              </p>
            ) : null}
            <button
              type="button"
              disabled={!prices.active.available}
              ref={(element) => {
                if (historyReviewReturnFocusRef && model.historyReview?.kind === "replacement") {
                  historyReviewReturnFocusRef.current = element;
                }
              }}
              onClick={(event) => {
                if (historyReviewReturnFocusRef) {
                  historyReviewReturnFocusRef.current = event.currentTarget;
                }
                actions.history.saveLocalComparison();
              }}
            >
              Save local comparison
            </button>
            <details className="local-history-management">
              <summary ref={historyManagementSummaryRef}>
                Manage local comparisons ({formatNumber(history.localManagement.count)}/
                {formatNumber(history.localManagement.maximum)})
              </summary>
              <p>Scheduled shared history is read-only and is not listed here.</p>
              <p>Local history is included in Workspace backup.</p>
              {history.localManagement.rows.length === 0 ? (
                <p className="inline-status neutral">No local comparisons saved.</p>
              ) : (
                <div className="local-history-list" aria-label="Local price comparisons">
                  {history.localManagement.rows.map((row) => (
                    <article className="local-history-row" key={row.occurrenceId}>
                      <div className="local-history-row-heading">
                        <h3>{row.label}</h3>
                        <PriceTime presentation={row.captureTime} />
                      </div>
                      <div className="local-history-markers">
                        <span>{formatNumber(row.itemCount)} tracked items</span>
                        {row.newest ? <span>Newest</span> : null}
                        {row.oldest ? <span>Oldest</span> : null}
                        {row.nextReplacement ? <span>Next to be replaced</span> : null}
                        {row.selectedAsBaseline ? <span>Selected baseline</span> : null}
                      </div>
                      <details className="technical-details">
                        <summary>Technical details</summary>
                        <dl>
                          <div>
                            <dt>PriceSet ID</dt>
                            <dd>
                              <code>{row.sourcePriceSetId}</code>
                            </dd>
                          </div>
                          <div>
                            <dt>Snapshot key</dt>
                            <dd>
                              <code>{row.snapshotKey}</code>
                            </dd>
                          </div>
                        </dl>
                      </details>
                      <button
                        type="button"
                        aria-label={`Review removal for ${row.label} captured ${row.captureTime.exactAccessible}`}
                        onClick={(event) => {
                          if (historyReviewReturnFocusRef) {
                            historyReviewReturnFocusRef.current = event.currentTarget;
                          }
                          actions.history.reviewRemoval(row.occurrenceId);
                        }}
                      >
                        Review removal
                      </button>
                      {model.historyReview?.kind === "removal" &&
                      model.historyReview.occurrenceId === row.occurrenceId ? (
                        <section
                          className="local-history-review"
                          aria-label={`Remove local comparison ${row.label}`}
                        >
                          <h4 ref={historyReviewHeadingRef} tabIndex={-1}>
                            Remove local comparison?
                          </h4>
                          <p>
                            {model.historyReview.label} ·{" "}
                            <PriceTime presentation={model.historyReview.captureTime} /> ·{" "}
                            {formatNumber(model.historyReview.itemCount)} tracked items
                          </p>
                          <p>
                            Only this browser-local point is removed. Shared scheduled history and
                            the active PriceSet stay unchanged. Economy and Loot history context may
                            select a new latest or baseline point. Undo will be available once.
                          </p>
                          <div className="market-sync-bar">
                            <button type="button" onClick={actions.history.confirmReview}>
                              Remove local comparison
                            </button>
                            <button type="button" onClick={cancelHistoryReview}>
                              Cancel
                            </button>
                          </div>
                        </section>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
              <div className="market-sync-bar">
                {model.priceHistoryClearPending ? (
                  <>
                    <button type="button" onClick={actions.history.confirmClear}>
                      Confirm clear local history
                    </button>
                    <button type="button" onClick={actions.history.cancelClear}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={history.localManagement.count === 0}
                    onClick={actions.history.requestClear}
                  >
                    Clear local history
                  </button>
                )}
              </div>
            </details>
            {model.historyReview?.kind === "replacement" ? (
              <section
                className="local-history-review"
                aria-label="Replace oldest local comparison"
              >
                <h3 ref={historyReviewHeadingRef} tabIndex={-1}>
                  Save and replace the oldest local comparison?
                </h3>
                <p>Capture active PriceSet: {model.historyReview.activePriceSetLabel}.</p>
                <p>
                  Replace {model.historyReview.replacedLabel} ·{" "}
                  <PriceTime presentation={model.historyReview.replacedCaptureTime} /> ·{" "}
                  {formatNumber(model.historyReview.replacedItemCount)} tracked items.
                </p>
                <p>Shared history and active prices do not change.</p>
                <div className="market-sync-bar">
                  <button type="button" onClick={actions.history.confirmReview}>
                    Save and replace oldest
                  </button>
                  <button type="button" onClick={cancelHistoryReview}>
                    Cancel
                  </button>
                </div>
              </section>
            ) : null}
            {model.historyNotice ? (
              <p
                className={`inline-status ${model.historyNotice.tone}`}
                role={model.historyNotice.tone === "error" ? "alert" : "status"}
              >
                {model.historyNotice.message}
              </p>
            ) : null}
          </div>
          <div className="price-history-summary" aria-label="Price history summary">
            <span>Snapshots {formatNumber(history.summary.snapshotCount)}</span>
            <span>Shared {formatNumber(history.sharedSnapshotCount)}</span>
            <span>Local {formatNumber(history.localSnapshotCount)}</span>
            <span>Items {formatNumber(history.summary.trackedItemCount)}</span>
            <span>Moved {formatNumber(history.movers.movedItemCount)}</span>
            <span>Active {history.summary.activeLabel}</span>
            <PriceTimeFactPair
              presentation={history.summary.latestTime}
              exactLabel={`Latest ${history.latestSnapshotLabel}${history.summary.activeMatchesLatest ? " active" : ""} ·`}
              relativeLabel="Latest age"
            />
            <span>
              Baseline {history.baselineSnapshotLabel} ·{" "}
              <PriceTime presentation={history.baselineCaptureTime} />
            </span>
          </div>
          <div className="economy-controls">
            <SelectField
              label="Baseline"
              value={history.controls.baselineMode}
              options={[...PRICE_HISTORY_BASELINE_OPTIONS]}
              onChange={(value) =>
                actions.history.setBaselineMode(value as PriceHistoryBaselineMode)
              }
            />
            <SearchableSelectField
              label="Snapshot"
              value={history.effectiveSnapshotKey}
              options={
                history.snapshotOptions.length
                  ? history.snapshotOptions
                  : [{ id: "", label: "No snapshots" }]
              }
              disabled={
                history.controls.baselineMode !== "snapshot" || history.snapshotOptions.length === 0
              }
              searchPlaceholder="Search snapshots"
              onChange={actions.history.setSnapshotKey}
            />
            <div className="field">
              <label htmlFor="economy-item-filter">Item filter</label>
              <input
                id="economy-item-filter"
                type="search"
                value={history.controls.itemFilter}
                placeholder="Search item"
                onChange={(event) => actions.history.setItemFilter(event.target.value)}
              />
            </div>
            <SearchableSelectField
              label="Trend item"
              value={history.effectiveTrendItemId}
              options={
                history.trendItemOptions.length
                  ? history.trendItemOptions
                  : [{ id: "", label: "No tracked items" }]
              }
              disabled={history.trendItemOptions.length === 0}
              searchPlaceholder="Search items"
              onChange={actions.history.setTrendItemId}
            />
          </div>
          <div
            className="price-history-summary"
            aria-label="Selected item price provenance"
            ref={selectedPriceItemRef}
            tabIndex={-1}
          >
            <span>Item {history.selectedItem.itemDisplayLabel.name}</span>
            <span>Price {optionalPrice(history.selectedItem.price)}</span>
            <span>Origin {itemPriceMetadataLabel(history.selectedItem.metadata?.valueOrigin)}</span>
            <span>
              Refresh {itemPriceMetadataLabel(history.selectedItem.metadata?.refreshStatus)}
            </span>
            <span>Freshness {itemPriceMetadataLabel(history.selectedItem.freshness)}</span>
            <span>Quality {itemPriceMetadataLabel(history.selectedItem.metadata?.quality)}</span>
            <span>
              Value observed{" "}
              <PriceTime presentation={history.selectedItem.observedTime} display="full" />
            </span>
            <span>
              Last evaluated{" "}
              <PriceTime presentation={history.selectedItem.evaluatedTime} display="full" />
            </span>
            <span>Reason {itemPriceMetadataLabel(history.selectedItem.metadata?.reasonCode)}</span>
            <TechnicalDetails
              itemId={history.selectedItem.itemId || null}
              sourceNameUnavailable={history.selectedItem.itemDisplayLabel.source === "fallback"}
            />
          </div>
          <PriceTrendChart trend={history.trend} />
          <div className="movers-grid" aria-label="Top movers">
            <div className="mover-list" aria-label="Top gainers">
              <h3>Top gainers</h3>
              {history.movers.topGainers.length ? (
                <ol>
                  {history.movers.topGainers.map((row) => (
                    <li key={row.itemId}>
                      <span title={row.itemLabel}>{row.itemLabel}</span>
                      <strong>{optionalDelta(row.gpDelta)}</strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No gainers</p>
              )}
            </div>
            <div className="mover-list" aria-label="Top fallers">
              <h3>Top fallers</h3>
              {history.movers.topFallers.length ? (
                <ol>
                  {history.movers.topFallers.map((row) => (
                    <li key={row.itemId}>
                      <span title={row.itemLabel}>{row.itemLabel}</span>
                      <strong>{optionalDelta(row.gpDelta)}</strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No fallers</p>
              )}
            </div>
          </div>
          <div className="dense-table-wrap economy-table-wrap">
            <table className="dense-table" aria-label="Price movers">
              <thead>
                <tr>
                  <th aria-sort={economyAriaSort(history.controls.sort, "item")}>
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => actions.history.sortBy("item")}
                    >
                      Item
                    </button>
                  </th>
                  <th
                    className="numeric"
                    aria-sort={economyAriaSort(history.controls.sort, "latestPrice")}
                  >
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => actions.history.sortBy("latestPrice")}
                    >
                      Latest price
                    </button>
                  </th>
                  <th
                    className="numeric"
                    aria-sort={economyAriaSort(history.controls.sort, "baselinePrice")}
                  >
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => actions.history.sortBy("baselinePrice")}
                    >
                      Baseline price
                    </button>
                  </th>
                  <th
                    className="numeric"
                    aria-sort={economyAriaSort(history.controls.sort, "gpDelta")}
                  >
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => actions.history.sortBy("gpDelta")}
                    >
                      GP delta
                    </button>
                  </th>
                  <th
                    className="numeric"
                    aria-sort={economyAriaSort(history.controls.sort, "percentDelta")}
                  >
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => actions.history.sortBy("percentDelta")}
                    >
                      Percent delta
                    </button>
                  </th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {history.movers.rows.length ? (
                  history.movers.rows.map((row) => (
                    <tr key={row.itemId}>
                      <td className="economy-item-cell">
                        <strong>{row.itemLabel}</strong>
                        <TechnicalDetails
                          itemId={row.itemId}
                          sourceNameUnavailable={
                            history.itemDisplayLabels[row.itemId]?.source === "fallback"
                          }
                        />
                      </td>
                      <td className="numeric">{optionalPrice(row.latestPrice)}</td>
                      <td className="numeric">{optionalPrice(row.baselinePrice)}</td>
                      <td className={`numeric ${economyMoverTone(row) ?? ""}`}>
                        {optionalDelta(row.gpDelta)}
                      </td>
                      <td className={`numeric ${economyMoverTone(row) ?? ""}`}>
                        {optionalPercent(row.percentDelta)}
                      </td>
                      <td>
                        <PriceTrendSparkline row={row} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>No matching price movement rows</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}

export default EconomySettingsPane;

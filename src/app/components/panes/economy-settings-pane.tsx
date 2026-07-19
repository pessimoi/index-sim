import { useId, type Ref } from "react";
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
  type PriceDataViewModel
} from "../../view-models/price-data";
import type { SettingsPaneViewModel } from "../../view-models/settings";
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
import { LocalStateRecoveryPanel } from "../settings/local-state-recovery-panel";
import { importPriceSetFromInput } from "./price-set-import-input";

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
  recovery: {
    visible: boolean;
    report: LocalStateHealthReport;
    notice: string | null;
    pendingClearId: LocalStateClearPendingId;
  };
}

export interface EconomySettingsPaneActions {
  setPriceNotesOpen(open: boolean): void;
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
}

export interface EconomySettingsPaneProps {
  model: EconomySettingsPaneModel;
  actions: EconomySettingsPaneActions;
  priceNotesSummaryRef?: Ref<HTMLElement>;
}

function ScheduledSnapshotSummary({ prices }: { prices: PriceDataViewModel }) {
  const scheduled = prices.scheduled;
  return (
    <>
      <div className="price-history-summary" aria-label="Scheduled price snapshot summary">
        <span>Status {scheduled.statusLabel}</span>
        <span>Label {scheduled.label}</span>
        <span>Source scheduled static JSON</span>
        <span>Created {scheduled.createdAt}</span>
        <span>Age {scheduled.ageLabel}</span>
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

  return (
    <details className="advanced-price-set-tools" aria-label="Advanced PriceSet tools">
      <summary>Advanced PriceSet tools</summary>
      <div className="advanced-price-set-tools-content">
        <p id={replacementHelpId}>
          Importing replaces the complete local base PriceSet in this browser. Missing items are not
          merged from the committed snapshot. Use <strong>Manual item price</strong> for individual
          corrections.
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
            onClick={actions.prices.exportActivePriceSet}
          >
            Export active PriceSet
          </button>
          <label className="file-button">
            Import full PriceSet
            <input
              type="file"
              accept="application/json,.json"
              aria-describedby={`${replacementHelpId} ${formatHelpId}`}
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
  priceNotesSummaryRef
}: EconomySettingsPaneProps) {
  const economyVisible = model.mode === "economy";
  const settingsVisible = model.mode === "settings";
  const hidden = model.mode === "hidden";
  const { prices } = model;
  const { history, manual } = prices;

  return (
    <section
      className={economyVisible ? "economy-pane" : "service-strip"}
      aria-label={economyVisible ? "Economy" : "Live services"}
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
          <p className="inline-status neutral">
            Uses the active PriceSet shown in Economy; setup transfers do not include prices.
          </p>
        </section>
      )}
      <LocalStateRecoveryPanel
        visible={settingsVisible && model.recovery.visible}
        report={model.recovery.report}
        notice={model.recovery.notice}
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
          <ScheduledSnapshotSummary prices={prices} />
          <div className="price-history-summary" aria-label="Active PriceSet summary">
            <span>Active source {prices.active.sourceLabel}</span>
            <span>Label {prices.active.label}</span>
            <span>Source {prices.active.source}</span>
            <span>Created {prices.active.createdAt}</span>
            <span>Age {prices.active.ageLabel}</span>
            <span>Item prices {formatNumber(prices.active.itemCount)}</span>
            <span>Alch values {formatNumber(prices.active.alchCount)}</span>
          </div>
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
      <section className="service-group" aria-label="Market price data">
        <div className="section-title-row">
          <h2>Market</h2>
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
          <span>Created {prices.active.createdAt}</span>
          <span>Age {prices.active.ageLabel}</span>
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
        {economyVisible && (
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
              <span>Updated {manual.selectedOverride?.updatedAt ?? "-"}</span>
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
        )}
        <AdvancedPriceSetTools model={model} actions={actions} />
        {model.marketNotice && (
          <p
            className={`inline-status ${model.marketNotice.tone}`}
            role={model.marketNotice.tone === "error" ? "alert" : "status"}
          >
            {model.marketNotice.message}
          </p>
        )}
        <div className="market-sync-bar">
          <button
            type="button"
            disabled={!prices.active.available}
            onClick={actions.history.saveLocalComparison}
          >
            Save local comparison
          </button>
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
              disabled={history.localSnapshotCount === 0}
              onClick={actions.history.requestClear}
            >
              Clear local history
            </button>
          )}
        </div>
        <div className="price-history-summary" aria-label="Price history summary">
          <span>Snapshots {formatNumber(history.summary.snapshotCount)}</span>
          <span>Shared {formatNumber(history.sharedSnapshotCount)}</span>
          <span>Local {formatNumber(history.localSnapshotCount)}</span>
          <span>Items {formatNumber(history.summary.trackedItemCount)}</span>
          <span>Moved {formatNumber(history.movers.movedItemCount)}</span>
          <span>Latest age {history.summary.latestAgeLabel}</span>
          <span>Active {history.summary.activeLabel}</span>
          <span>
            Latest {history.summary.latestLabel}
            {history.summary.activeMatchesLatest ? " active" : ""}
          </span>
          <span>Baseline {history.movers.baselineLabel}</span>
        </div>
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
                  key={`${notice.code}:${notice.itemId ?? notice.itemLabel}:${notice.consumer}:${notice.lootRowId ?? ""}`}
                >
                  <div>
                    <strong>{notice.itemLabel}</strong>
                    <span>{notice.summary}</span>
                  </div>
                  <p>{notice.detail}</p>
                  <small>
                    {notice.consumer === "loot"
                      ? "Loot"
                      : notice.consumer === "cannon"
                        ? "Cannon"
                        : "Supply"}
                    {notice.itemId ? ` · ${notice.itemId}` : ""}
                  </small>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
      {economyVisible && (
        <section
          className="service-group economy-history-panel"
          aria-label="Price history analysis"
        >
          <div className="section-title-row">
            <h2>Price history</h2>
            <span className="status-pill">{history.sourceStatus}</span>
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
          <div className="price-history-summary" aria-label="Selected item price provenance">
            <span>Item {history.selectedItem.itemId || "-"}</span>
            <span>Price {optionalPrice(history.selectedItem.price)}</span>
            <span>Origin {itemPriceMetadataLabel(history.selectedItem.metadata?.valueOrigin)}</span>
            <span>
              Refresh {itemPriceMetadataLabel(history.selectedItem.metadata?.refreshStatus)}
            </span>
            <span>Freshness {itemPriceMetadataLabel(history.selectedItem.freshness)}</span>
            <span>Quality {itemPriceMetadataLabel(history.selectedItem.metadata?.quality)}</span>
            <span>Observed {history.selectedItem.metadata?.valueObservedAt ?? "-"}</span>
            <span>Evaluated {history.selectedItem.metadata?.evaluatedAt ?? "-"}</span>
            <span>Reason {itemPriceMetadataLabel(history.selectedItem.metadata?.reasonCode)}</span>
          </div>
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
          <PriceTrendChart trend={history.trend} />
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
                        <small>Item ID: {row.itemId}</small>
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

import type { JewelSpot, LootAction } from "@/domain/trip";
import type { MonsterLootSettings } from "../../state/loot-settings";
import {
  lootActionLabel,
  sortLootNestedTableRows,
  sortLootTableRows,
  type LootDropRowViewModel,
  type LootNestedTableSortKey,
  type LootNestedTableSortState,
  type LootPresentationViewModel,
  type LootTableSortKey,
  type LootTableSortState
} from "../../view-models/loot";
import { formatNumber } from "../../view-models/formatting";
import { MetricList } from "../app-presenters";
import { DecimalField, SelectField } from "../form-fields";
import {
  formatDelta,
  optionalDelta,
  optionalPercent,
  optionalPrice
} from "../presentation-formatters";

const HIGH_ALCH_OPTIONS = [
  { id: "enabled", label: "Enabled" },
  { id: "disabled", label: "Disabled" }
];

const OVERHEAD_MODE_OPTIONS = [
  { id: "auto", label: "Auto" },
  { id: "manual", label: "Manual" }
];

const TALISMAN_SPOT_OPTIONS: Array<{ id: JewelSpot; label: string }> = [
  { id: "underground", label: "Underground" },
  { id: "overground", label: "Overground" }
];

const LOOT_TABLE_COLUMNS: ReadonlyArray<{
  label: string;
  sortKey: LootTableSortKey | null;
  numeric?: boolean;
}> = [
  { label: "Drop", sortKey: "drop" },
  { label: "Action", sortKey: "action" },
  { label: "Delta/hr", sortKey: "deltaPerHour", numeric: true },
  { label: "Impacts", sortKey: null },
  { label: "EV/kill", sortKey: "evPerKill", numeric: true },
  { label: "Chance", sortKey: "chance", numeric: true },
  { label: "Qty", sortKey: "quantity", numeric: true },
  { label: "Price", sortKey: "price", numeric: true },
  { label: "Details", sortKey: null }
];

const LOOT_NESTED_TABLE_COLUMNS: ReadonlyArray<{
  label: string;
  sortKey: LootNestedTableSortKey | null;
  numeric?: boolean;
}> = [
  { label: "Child", sortKey: "child" },
  { label: "Key/tag", sortKey: null },
  { label: "Weight", sortKey: "weight", numeric: true },
  { label: "Chance", sortKey: "chance", numeric: true },
  { label: "Qty", sortKey: "quantity", numeric: true },
  { label: "Price", sortKey: "price", numeric: true },
  { label: "EV share", sortKey: "evShare", numeric: true },
  { label: "Notes", sortKey: null }
];

export interface LootPaneModel {
  presentation: LootPresentationViewModel;
  settings: MonsterLootSettings;
  notice: string | null;
  gpPerKill: number;
  effectiveNetGpPerHour: number;
  sort: LootTableSortState;
  nestedSort: LootNestedTableSortState;
}

export interface LootPaneActions {
  setHighAlch(enabled: boolean): void;
  setOverheadMode(mode: "auto" | "manual"): void;
  setOverheadSeconds(value: number): void;
  setTalismanSpot(value: JewelSpot): void;
  setAction(row: LootDropRowViewModel, action: LootAction): void;
  resetSettings(): void;
  resetOverrides(): void;
  optimize(): void;
  sortBy(key: LootTableSortKey): void;
  sortNestedBy(key: LootNestedTableSortKey): void;
}

export interface LootPaneProps {
  hidden: boolean;
  model: LootPaneModel;
  actions: LootPaneActions;
}

function optionLabel(options: ReadonlyArray<{ id: string; label: string }>, value: string): string {
  return options.find((option) => option.id === value)?.label ?? value;
}

function lootAriaSort(
  sort: LootTableSortState,
  key: LootTableSortKey
): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function lootNestedAriaSort(
  sort: LootNestedTableSortState,
  key: LootNestedTableSortKey
): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

export function LootPane({ hidden, model, actions }: LootPaneProps) {
  const { presentation } = model;
  const { actionableRows, conditionalRows, summary } = presentation;
  const sortedActionableRows = sortLootTableRows(actionableRows, model.sort);

  return (
    <section className="loot-strip" aria-label="Current monster loot" hidden={hidden}>
      <div className="section-title-row">
        <h2>Loot actions</h2>
        <span className="status-pill">
          {formatNumber(actionableRows.length)} drops
          {conditionalRows.length > 0
            ? ` · ${formatNumber(conditionalRows.length)} conditional`
            : ""}
        </span>
      </div>
      <div className="loot-toolbar">
        <SelectField
          label="High alch"
          value={presentation.highAlchEnabled ? "enabled" : "disabled"}
          options={HIGH_ALCH_OPTIONS}
          onChange={(value) => actions.setHighAlch(value === "enabled")}
        />
        <SelectField
          label="Overhead"
          value={presentation.overheadMode}
          options={OVERHEAD_MODE_OPTIONS}
          onChange={(value) => actions.setOverheadMode(value === "manual" ? "manual" : "auto")}
        />
        <DecimalField
          label="Overhead sec"
          value={presentation.overheadValue}
          min={0}
          max={600}
          step={0.5}
          disabled={presentation.overheadMode === "auto"}
          onChange={actions.setOverheadSeconds}
        />
        <SelectField
          label="Talisman spot"
          value={model.settings.talismanSpot}
          options={TALISMAN_SPOT_OPTIONS}
          onChange={(value) =>
            actions.setTalismanSpot(value === "overground" ? "overground" : "underground")
          }
        />
        <button type="button" onClick={actions.resetSettings}>
          Reset settings
        </button>
        <button
          type="button"
          disabled={summary.overrideCount === 0}
          onClick={actions.resetOverrides}
        >
          Reset current
        </button>
        <button type="button" disabled={actionableRows.length === 0} onClick={actions.optimize}>
          Optimize net GP/hr
        </button>
        <span className="loot-status" aria-live="polite">
          {model.notice ?? `${formatNumber(summary.overrideCount)} overrides`}
        </span>
      </div>
      <div className="loot-output" aria-label="Loot action summary">
        <MetricList
          items={[
            {
              label: "Default net GP/hr",
              value: formatNumber(summary.defaultEffectiveNetGpPerHour)
            },
            {
              label: "Current delta",
              value: formatDelta(summary.currentDeltaNetGpPerHour),
              tone: summary.currentDeltaNetGpPerHour >= 0 ? "teal" : "gold"
            },
            { label: "Loot GP/kill", value: formatNumber(model.gpPerKill) },
            { label: "Effective net", value: formatNumber(model.effectiveNetGpPerHour) },
            { label: "High alch", value: presentation.highAlchEnabled ? "On" : "Off" },
            {
              label: "Overhead",
              value:
                presentation.overheadMode === "auto"
                  ? `Auto ${formatNumber(presentation.derivedOverheadSec, 1)}s`
                  : `${formatNumber(presentation.overheadValue, 1)}s`
            },
            {
              label: "Talisman",
              value: optionLabel(TALISMAN_SPOT_OPTIONS, model.settings.talismanSpot)
            }
          ]}
        />
      </div>
      <section className="loot-composition" aria-label="Loot value composition">
        <div className="loot-section-heading">
          <h3>Loot value composition</h3>
          <span>{formatNumber(summary.valueComposition.displayedGpPerKill, 1)} GP/kill</span>
        </div>
        <table className="loot-composition-table">
          <thead>
            <tr>
              <th>Contributor</th>
              <th>Action</th>
              <th className="numeric">GP/kill</th>
              <th className="numeric">Share</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {summary.valueComposition.rows.length === 0 ? (
              <tr>
                <td colSpan={5}>No positive loot value</td>
              </tr>
            ) : (
              summary.valueComposition.rows.map((row) => (
                <tr key={row.rowId ?? "other-drops"}>
                  <td>
                    <span>{row.name}</span>
                    {row.childCount > 0 && (
                      <small>{formatNumber(row.childCount)} nested rows</small>
                    )}
                  </td>
                  <td>{row.actionLabel}</td>
                  <td className="numeric">{formatNumber(row.gpPerKill, 1)}</td>
                  <td className="numeric">
                    {row.shareOfPositivePct === null
                      ? "-"
                      : `${formatNumber(row.shareOfPositivePct, 1)}%`}
                  </td>
                  <td>{row.stateLabel ?? (row.isOther ? "Tail" : "-")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {summary.valueComposition.note && (
          <p className="loot-composition-note">{summary.valueComposition.note}</p>
        )}
      </section>
      <div className="loot-table-wrap">
        <table className="loot-table" aria-label="Current monster drops">
          <thead>
            <tr>
              {LOOT_TABLE_COLUMNS.map((column) => (
                <th
                  key={column.label}
                  className={column.numeric ? "numeric" : undefined}
                  aria-sort={
                    column.sortKey === null ? undefined : lootAriaSort(model.sort, column.sortKey)
                  }
                >
                  {column.sortKey === null ? (
                    column.label
                  ) : (
                    <button
                      type="button"
                      className="sort-button"
                      onClick={() => actions.sortBy(column.sortKey!)}
                    >
                      <span>{column.label}</span>
                      <span aria-hidden="true">
                        {model.sort.key === column.sortKey
                          ? model.sort.direction === "asc"
                            ? "^"
                            : "v"
                          : ""}
                      </span>
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {actionableRows.length === 0 ? (
              <tr>
                <td colSpan={9}>No drops</td>
              </tr>
            ) : (
              sortedActionableRows.map((row) => (
                <tr
                  key={row.rowId}
                  className={[
                    row.isOverride ? "active" : null,
                    row.stateLabel ? "loot-row-attention" : null
                  ]
                    .filter((item): item is string => item !== null)
                    .join(" ")}
                >
                  <td className="loot-name-cell">
                    <span>{row.name}</span>
                    <small>{row.key ?? row.tag ?? row.rowId}</small>
                    {row.stateLabel && <small className="loot-state">{row.stateLabel}</small>}
                  </td>
                  <td>
                    <select
                      aria-label={`Action for ${row.name} ${row.rowId}`}
                      className="action-select"
                      value={row.pref}
                      disabled={row.availableActions.length === 1}
                      onChange={(event) => {
                        const action = row.availableActions.find(
                          (candidate) => candidate === event.target.value
                        );
                        if (action) actions.setAction(row, action);
                      }}
                    >
                      {row.availableActions.map((action) => (
                        <option key={action} value={action}>
                          {lootActionLabel(action)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="numeric">{formatDelta(row.selectedDeltaNetGpPerHour)}</td>
                  <td className="loot-impact-cell">
                    <details className="loot-row-disclosure">
                      <summary>Monster actions</summary>
                      <table
                        className="loot-impact-table"
                        aria-label={`Action impact for ${row.name}`}
                      >
                        <thead>
                          <tr>
                            <th>Action</th>
                            <th className="numeric">Net GP/hr</th>
                            <th className="numeric">Delta</th>
                            <th className="numeric">Row GP/kill</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.actionImpacts.map((impact) => (
                            <tr key={impact.action}>
                              <td>
                                <span>{impact.label}</span>
                                <small>
                                  {[
                                    impact.isSelected ? "selected" : null,
                                    impact.isDefault ? "default" : null
                                  ]
                                    .filter((item): item is string => item !== null)
                                    .join(" / ") || "-"}
                                </small>
                              </td>
                              <td className="numeric">
                                {formatNumber(impact.effectiveNetGpPerHour)}
                              </td>
                              <td className="numeric">{formatDelta(impact.deltaNetGpPerHour)}</td>
                              <td className="numeric">
                                {formatNumber(impact.gpPerKillContribution, 1)}
                              </td>
                              <td>
                                {[impact.stateLabel, ...impact.notes]
                                  .filter((item): item is string => !!item)
                                  .join("; ") || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </td>
                  <td className="numeric">{formatNumber(row.effectiveEvGp, 1)}</td>
                  <td className="numeric">{formatNumber(row.chance * 100, 2)}%</td>
                  <td className="numeric">{formatNumber(row.qtyAvg, 1)}</td>
                  <td className="numeric loot-price-cell">
                    <span>{formatNumber(row.price)}</span>
                    {row.priceNotices.length > 0 ? (
                      <small
                        className={
                          row.priceNotices.some((notice) => notice.level === "issue")
                            ? "warning"
                            : undefined
                        }
                      >
                        {row.priceNotices[0]?.summary}
                        {row.priceNotices.length > 1
                          ? ` +${formatNumber(row.priceNotices.length - 1)}`
                          : ""}
                      </small>
                    ) : null}
                  </td>
                  <td>
                    <details className="loot-row-disclosure">
                      <summary>
                        {row.expandedRows.length > 0
                          ? `${formatNumber(row.expandedRows.length)} nested rows`
                          : "Value details"}
                      </summary>
                      <div className="loot-row-detail-panel">
                        {row.priceNotices.length > 0 ? (
                          <section
                            className="loot-price-notices"
                            aria-label={`Price data notes for ${row.name}`}
                          >
                            <strong>Price data</strong>
                            <ul>
                              {row.priceNotices.map((notice) => (
                                <li key={`${notice.code}:${notice.itemId ?? notice.itemLabel}`}>
                                  <span>{notice.summary}</span>
                                  <small>
                                    {notice.detail}
                                    {!notice.affectsCurrentResult
                                      ? " This displayed alternative is not used in current GP totals."
                                      : ""}
                                  </small>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ) : null}
                        <dl className="loot-value-facts">
                          {row.valueDetails.map((detail) => (
                            <div className={detail.tone} key={`${row.rowId}-${detail.label}`}>
                              <dt>{detail.label}</dt>
                              <dd>{detail.value}</dd>
                            </div>
                          ))}
                        </dl>
                        <div
                          className={[
                            "loot-history-context",
                            row.historyContext.tracked ? null : "empty"
                          ]
                            .filter((item): item is string => item !== null)
                            .join(" ")}
                          aria-label={`Price history for ${row.name}`}
                        >
                          <div className="loot-history-heading">
                            <strong>Local history</strong>
                            <span>{row.historyContext.statusLabel}</span>
                          </div>
                          {row.historyContext.tracked ? (
                            <dl className="loot-history-facts">
                              <div>
                                <dt>Latest</dt>
                                <dd>{optionalPrice(row.historyContext.latestPrice)}</dd>
                              </div>
                              <div>
                                <dt>Baseline</dt>
                                <dd>{optionalPrice(row.historyContext.baselinePrice)}</dd>
                              </div>
                              <div>
                                <dt>Delta</dt>
                                <dd>{optionalDelta(row.historyContext.gpDelta)}</dd>
                              </div>
                              <div>
                                <dt>Percent</dt>
                                <dd>{optionalPercent(row.historyContext.percentDelta)}</dd>
                              </div>
                            </dl>
                          ) : (
                            <small>{row.historyContext.emptyMessage}</small>
                          )}
                        </div>
                        {row.expandedRows.length > 0 && (
                          <table
                            className="loot-nested-table"
                            aria-label={`Nested rows for ${row.name}`}
                          >
                            <thead>
                              <tr>
                                {LOOT_NESTED_TABLE_COLUMNS.map((column) => (
                                  <th
                                    scope="col"
                                    className={column.numeric ? "numeric" : undefined}
                                    aria-sort={
                                      column.sortKey === null
                                        ? undefined
                                        : lootNestedAriaSort(model.nestedSort, column.sortKey)
                                    }
                                    key={column.label}
                                  >
                                    {column.sortKey === null ? (
                                      column.label
                                    ) : (
                                      <button
                                        type="button"
                                        className="sort-button"
                                        onClick={() => actions.sortNestedBy(column.sortKey!)}
                                      >
                                        <span>{column.label}</span>
                                        <span aria-hidden="true">
                                          {model.nestedSort.key === column.sortKey
                                            ? model.nestedSort.direction === "asc"
                                              ? "^"
                                              : "v"
                                            : ""}
                                        </span>
                                      </button>
                                    )}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sortLootNestedTableRows(row.expandedRows, model.nestedSort).map(
                                (detail) => (
                                  <tr key={`${row.rowId}-${detail.label}`}>
                                    <td>{detail.label}</td>
                                    <td>{detail.key ?? detail.tag ?? "-"}</td>
                                    <td className="numeric">{detail.weightLabel ?? "-"}</td>
                                    <td className="numeric">
                                      {detail.chance === null
                                        ? "-"
                                        : `${formatNumber(detail.chance * 100, 2)}%`}
                                    </td>
                                    <td className="numeric">{detail.qtyLabel ?? "-"}</td>
                                    <td className="numeric">
                                      {detail.price === null ? "-" : formatNumber(detail.price)}
                                    </td>
                                    <td className="numeric">
                                      {detail.evGp === null
                                        ? "-"
                                        : `${formatNumber(detail.evGp, 1)} gp`}
                                    </td>
                                    <td>
                                      {[
                                        ...detail.notes,
                                        ...detail.priceNotices.map((notice) => notice.summary)
                                      ].join("; ") || "-"}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {conditionalRows.length > 0 && (
        <details className="conditional-loot-group">
          <summary>Conditional drops ({formatNumber(conditionalRows.length)})</summary>
          <div className="conditional-loot-content">
            <p>
              Source-backed quest and clue rows stay visible for completeness, but are locked to
              Skip and excluded from loot value, inventory and trip calculations until exact player
              eligibility is modeled.
            </p>
            <div className="loot-table-wrap">
              <table
                className="loot-table conditional-loot-table"
                aria-label="Conditional monster drops"
              >
                <thead>
                  <tr>
                    <th>Drop</th>
                    <th className="numeric">Chance</th>
                    <th>Eligibility</th>
                    <th>State</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {conditionalRows.map((row) => (
                    <tr key={row.rowId} className="loot-row-attention">
                      <td className="loot-name-cell">
                        <span>{row.name}</span>
                        <small>{row.key ?? row.tag ?? row.rowId}</small>
                      </td>
                      <td className="numeric">{formatNumber(row.chance * 100, 2)}%</td>
                      <td>{row.eligibilityDescription}</td>
                      <td>{row.stateLabel ?? "Conditional"}</td>
                      <td>Skip (locked)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}

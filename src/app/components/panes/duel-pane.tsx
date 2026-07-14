import { Fragment } from "react";
import { InlineImportNotice } from "../app-presenters";
import type { InlineNoticeViewModel } from "../../view-models/contracts";
import { formatDelta, signedPercent } from "../presentation-formatters";
import { formatNumber, signedDecimal } from "../../view-models/formatting";
import type {
  DuelComparisonRowViewModel,
  DuelComparisonViewModel,
  DuelMatrixMetricId,
  DuelMatrixRowViewModel,
  DuelMatrixViewModel,
  DuelViewMode
} from "../../view-models/duel";

const DUEL_MATRIX_METRICS: ReadonlyArray<{ id: DuelMatrixMetricId; label: string }> = [
  { id: "dps", label: "DPS" },
  { id: "effectiveXpPerHour", label: "XP/hr" },
  { id: "effectiveNetGpPerHour", label: "Net GP/hr" },
  { id: "gpPerXp", label: "GP/XP" }
];

function gpPerXpDisplay(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "-" : formatNumber(value, 2);
}

function duelDeltaDisplay(value: number | null, digits = 0): string {
  if (value === null) return "-";
  return digits === 0 ? formatDelta(value) : signedDecimal(value, digits);
}

function duelMatrixMetricLabel(metricId: DuelMatrixMetricId): string {
  return DUEL_MATRIX_METRICS.find((metric) => metric.id === metricId)?.label ?? metricId;
}

function duelMatrixMetricDisplay(metricId: DuelMatrixMetricId, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return formatNumber(value, metricId === "dps" || metricId === "gpPerXp" ? 2 : 0);
}

function duelRowClass(row: DuelComparisonRowViewModel): string | undefined {
  return row.source === "live" ? "duel-live-row" : undefined;
}

export interface DuelPaneModel {
  targetLabel: string;
  snapshotCount: number;
  duelComparison: DuelComparisonViewModel | null;
  duelViewMode: DuelViewMode;
  expandedDuelDiffId: string | null;
  duelMatrixMetric: DuelMatrixMetricId;
  duelMatrixFilter: string;
  duelMatrix: DuelMatrixViewModel | null;
  filteredDuelMatrixRows: DuelMatrixRowViewModel[];
  duelMatrixBusy: boolean;
  duelImportNotice: InlineNoticeViewModel | null;
}

export interface DuelPaneActions {
  snapshotCurrentSetup(): void;
  exportDuelSnapshots(): void;
  importDuelSnapshots(file: File): Promise<void>;
  commitDuelSnapshotName(snapshotId: string, name: string): boolean;
  loadDuelSnapshot(snapshotId: string): void;
  deleteDuelSnapshot(snapshotId: string): void;
  showCurrentDuelTarget(): void;
  showDuelMonsterMatrix(): void;
  toggleDuelDiff(snapshotId: string): void;
  setDuelMatrixFilter(value: string): void;
  setDuelMatrixMetric(metric: DuelMatrixMetricId): void;
  buildDuelMatrix(): void;
}

export interface DuelPaneProps {
  hidden: boolean;
  model: DuelPaneModel;
  actions: DuelPaneActions;
}

export function DuelPane({ hidden, model, actions }: DuelPaneProps) {
  const {
    targetLabel,
    snapshotCount,
    duelComparison,
    duelViewMode,
    expandedDuelDiffId,
    duelMatrixMetric,
    duelMatrixFilter,
    duelMatrix,
    filteredDuelMatrixRows,
    duelMatrixBusy,
    duelImportNotice
  } = model;
  const {
    snapshotCurrentSetup,
    exportDuelSnapshots,
    importDuelSnapshots,
    commitDuelSnapshotName,
    loadDuelSnapshot,
    deleteDuelSnapshot,
    showCurrentDuelTarget,
    showDuelMonsterMatrix,
    toggleDuelDiff,
    setDuelMatrixFilter,
    setDuelMatrixMetric,
    buildDuelMatrix
  } = actions;

  return (
    <section className="duel-pane" aria-label="Setup comparison" hidden={hidden}>
      <div className="table-toolbar duel-toolbar">
        <div>
          <h2>Setup comparison</h2>
          <span>
            {duelComparison?.monsterName ?? targetLabel} - {snapshotCount} /{" "}
            {duelComparison?.snapshotLimit ?? 12} saved setups
          </span>
        </div>
        <div className="duel-controls" aria-label="Saved setup controls">
          <div className="duel-control-actions">
            <button
              type="button"
              onClick={snapshotCurrentSetup}
              disabled={duelComparison != null && snapshotCount >= duelComparison.snapshotLimit}
            >
              Save current setup
            </button>
            <details className="duel-manage-setups">
              <summary>Manage saved setups</summary>
              <div className="duel-manage-setups-panel">
                <p>
                  Saved automatically in this browser. Import and export are only for backup or
                  transfer.
                </p>
                <label className="file-button">
                  Import setups
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      try {
                        await importDuelSnapshots(file);
                      } finally {
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
                <button type="button" onClick={exportDuelSnapshots} disabled={snapshotCount === 0}>
                  Export setups
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>

      <div className="segmented duel-view-toggle" aria-label="Setup comparison view">
        <button
          type="button"
          className={duelViewMode === "current-target" ? "active" : undefined}
          aria-pressed={duelViewMode === "current-target"}
          onClick={showCurrentDuelTarget}
        >
          Current monster
        </button>
        <button
          type="button"
          className={duelViewMode === "monster-matrix" ? "active" : undefined}
          aria-pressed={duelViewMode === "monster-matrix"}
          onClick={showDuelMonsterMatrix}
          disabled={snapshotCount === 0 || duelMatrixBusy}
        >
          All monsters
        </button>
      </div>

      {duelImportNotice && (
        <InlineImportNotice
          notice={duelImportNotice}
          ariaLabel="Saved setup import notice"
          className="duel-import-notice"
        />
      )}

      {duelViewMode === "current-target" ? (
        <div className="duel-table-wrap">
          <table className="duel-table" aria-label="Setup comparison table">
            <thead>
              <tr>
                <th>Setup</th>
                <th>Loadout</th>
                <th className="numeric">Max</th>
                <th className="numeric">DPS</th>
                <th className="numeric">XP/hr</th>
                <th className="numeric">Net GP/hr</th>
                <th className="numeric">GP/XP</th>
                <th className="numeric">K/hr</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {duelComparison?.rows.map((row) => {
                const diffId = `duel-diff-${row.snapshotId ?? "live"}`;
                const diffExpanded = row.snapshotId === expandedDuelDiffId;
                return (
                  <Fragment key={row.id}>
                    <tr className={duelRowClass(row)}>
                      <td className="duel-setup-cell">
                        {row.source === "live" ? (
                          <strong>Live setup</strong>
                        ) : (
                          <input
                            aria-label={`Rename saved setup ${row.name}`}
                            defaultValue={row.name}
                            maxLength={80}
                            onBlur={(event) => {
                              if (!row.snapshotId) return;
                              const accepted = commitDuelSnapshotName(
                                row.snapshotId,
                                event.currentTarget.value
                              );
                              if (!accepted) event.currentTarget.value = row.name;
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") event.currentTarget.blur();
                              if (event.key === "Escape") {
                                event.currentTarget.value = row.name;
                                event.currentTarget.blur();
                              }
                            }}
                          />
                        )}
                        <span>{row.combatStyle}</span>
                      </td>
                      <td className="duel-loadout-cell" title={row.loadoutLabel}>
                        {row.loadoutLabel}
                      </td>
                      <td className="numeric">{formatNumber(row.maxHit, 1)}</td>
                      <td className="numeric">
                        <span>{formatNumber(row.dps, 2)}</span>
                        <small>{duelDeltaDisplay(row.deltas.dps, 2)}</small>
                      </td>
                      <td className={`numeric ${row.best.effectiveXpPerHour ? "best" : ""}`}>
                        <span>{formatNumber(row.effectiveXpPerHour)}</span>
                        {row.best.effectiveXpPerHour && <em>best</em>}
                        <small>{duelDeltaDisplay(row.deltas.effectiveXpPerHour)}</small>
                      </td>
                      <td className={`numeric ${row.best.effectiveNetGpPerHour ? "best" : ""}`}>
                        <span>{formatNumber(row.effectiveNetGpPerHour)}</span>
                        {row.best.effectiveNetGpPerHour && <em>best</em>}
                        <small>{duelDeltaDisplay(row.deltas.effectiveNetGpPerHour)}</small>
                      </td>
                      <td className={`numeric ${row.best.gpPerXp ? "best" : ""}`}>
                        <span>{gpPerXpDisplay(row.gpPerXp)}</span>
                        {row.best.gpPerXp && <em>best</em>}
                        <small>{duelDeltaDisplay(row.deltas.gpPerXp, 2)}</small>
                      </td>
                      <td className="numeric">
                        <span>{formatNumber(row.killsPerHour)}</span>
                        <small>{duelDeltaDisplay(row.deltas.killsPerHour)}</small>
                      </td>
                      <td>
                        {row.snapshotId ? (
                          <div className="duel-row-actions">
                            <button
                              type="button"
                              aria-expanded={diffExpanded}
                              aria-controls={diffId}
                              onClick={() => toggleDuelDiff(row.snapshotId!)}
                            >
                              {diffExpanded ? "Hide diff" : "Review diff"}
                            </button>
                            <button type="button" onClick={() => loadDuelSnapshot(row.snapshotId!)}>
                              Load
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDuelSnapshot(row.snapshotId!)}
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="duel-live-marker">Active</span>
                        )}
                      </td>
                    </tr>
                    {row.setupDiff && diffExpanded && (
                      <tr className="duel-diff-row">
                        <td colSpan={9}>
                          <section
                            id={diffId}
                            className="duel-diff-panel"
                            aria-label={`${row.name} setup and impact diff`}
                          >
                            <div className="duel-diff-heading">
                              <div>
                                <strong>Saved setup compared with live</strong>
                                <span>
                                  {row.setupDiff.changeCount} setup field
                                  {row.setupDiff.changeCount === 1 ? "" : "s"} changed
                                </span>
                              </div>
                              <small>Impact is saved setup minus live.</small>
                            </div>
                            <dl className="duel-impact-grid" aria-label="Calculated impact">
                              <div>
                                <dt>Max hit</dt>
                                <dd>{duelDeltaDisplay(row.deltas.maxHit, 1)}</dd>
                              </div>
                              <div>
                                <dt>DPS</dt>
                                <dd>{duelDeltaDisplay(row.deltas.dps, 2)}</dd>
                              </div>
                              <div>
                                <dt>Hit chance</dt>
                                <dd>{signedPercent(row.deltas.hitChance)}</dd>
                              </div>
                              <div>
                                <dt>TTK</dt>
                                <dd>{duelDeltaDisplay(row.deltas.ttkSec, 1)}s</dd>
                              </div>
                              <div>
                                <dt>Kills/trip</dt>
                                <dd>{duelDeltaDisplay(row.deltas.killsPerTrip, 1)}</dd>
                              </div>
                              <div>
                                <dt>Kills/hr</dt>
                                <dd>{duelDeltaDisplay(row.deltas.killsPerHour, 1)}</dd>
                              </div>
                              <div>
                                <dt>XP/hr</dt>
                                <dd>{duelDeltaDisplay(row.deltas.effectiveXpPerHour)}</dd>
                              </div>
                              <div>
                                <dt>Net GP/hr</dt>
                                <dd>{duelDeltaDisplay(row.deltas.effectiveNetGpPerHour)}</dd>
                              </div>
                              <div>
                                <dt>GP/XP</dt>
                                <dd>{duelDeltaDisplay(row.deltas.gpPerXp, 2)}</dd>
                              </div>
                              <div>
                                <dt>Supply GP/hr</dt>
                                <dd>{duelDeltaDisplay(row.deltas.supplyCostPerHour)}</dd>
                              </div>
                            </dl>
                            {row.setupDiff.groups.length > 0 ? (
                              <div className="duel-field-groups">
                                {row.setupDiff.groups.map((group) => (
                                  <section key={group.id}>
                                    <h3>{group.label}</h3>
                                    <div className="duel-field-diff-header" aria-hidden="true">
                                      <span>Field</span>
                                      <span>Live</span>
                                      <span>Saved setup</span>
                                    </div>
                                    {group.items.map((item) => (
                                      <div className="duel-field-diff" key={item.id}>
                                        <strong>{item.label}</strong>
                                        <span>
                                          <small>Live</small>
                                          {item.liveValue}
                                        </span>
                                        <span>
                                          <small>Saved setup</small>
                                          {item.snapshotValue}
                                        </span>
                                      </div>
                                    ))}
                                  </section>
                                ))}
                              </div>
                            ) : (
                              <p className="duel-no-field-diff">No active setup fields differ.</p>
                            )}
                            <p className="duel-shared-context">{row.setupDiff.sharedContextNote}</p>
                          </section>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {duelComparison?.snapshotRows.length === 0 && (
                <tr className="duel-empty-row">
                  <td colSpan={9}>No saved setups</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="duel-matrix-panel" aria-label="Setup comparison across monsters">
          <div className="duel-matrix-controls">
            <label className="field">
              <span>Find monster</span>
              <input
                aria-label="Find monster in setup comparison"
                type="search"
                value={duelMatrixFilter}
                onChange={(event) => setDuelMatrixFilter(event.target.value)}
              />
            </label>
            <div className="segmented duel-matrix-metrics" aria-label="Setup comparison metric">
              {DUEL_MATRIX_METRICS.map((metric) => (
                <button
                  type="button"
                  className={duelMatrixMetric === metric.id ? "active" : undefined}
                  aria-pressed={duelMatrixMetric === metric.id}
                  onClick={() => setDuelMatrixMetric(metric.id)}
                  key={metric.id}
                >
                  {metric.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={buildDuelMatrix} disabled={duelMatrixBusy}>
              Refresh comparison
            </button>
            <span className={`status-pill ${duelMatrix ? "ready" : "pending"}`}>
              {duelMatrix
                ? `${duelMatrix.monsterCount} monsters - ${duelMatrix.setupCount} setups`
                : duelMatrixBusy
                  ? "building"
                  : "refresh required"}
            </span>
          </div>

          {duelMatrix ? (
            <div className="duel-table-wrap duel-matrix-wrap">
              <table className="duel-matrix-table" aria-label="All-monster setup comparison">
                <thead>
                  <tr>
                    <th scope="col">Monster</th>
                    {duelMatrix.setups.map((setup) => (
                      <th scope="col" title={setup.loadoutLabel} key={setup.id}>
                        <strong>{setup.name}</strong>
                        <span>{setup.combatStyle}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDuelMatrixRows.map((row) => (
                    <tr
                      className={row.isCurrentTarget ? "current-target" : undefined}
                      aria-current={row.isCurrentTarget ? "true" : undefined}
                      key={row.monsterId}
                    >
                      <th scope="row" title={row.monsterName}>
                        <strong>{row.monsterName}</strong>
                        <span>
                          {row.monsterLevel == null ? row.monsterId : `lvl ${row.monsterLevel}`}
                        </span>
                      </th>
                      {row.cells.map((cell) => {
                        const value = cell.values[duelMatrixMetric];
                        const displayValue = duelMatrixMetricDisplay(duelMatrixMetric, value);
                        const setup = duelMatrix.setups.find(
                          (candidate) => candidate.id === cell.setupId
                        );
                        const isBest = cell.best[duelMatrixMetric];
                        return (
                          <td
                            className={`numeric ${isBest ? "best" : ""}`}
                            aria-label={`${row.monsterName}, ${setup?.name ?? cell.setupId}, ${duelMatrixMetricLabel(duelMatrixMetric)}: ${displayValue}${isBest ? ", best" : ""}`}
                            key={cell.setupId}
                          >
                            <span>{displayValue}</span>
                            {isBest && <em>best</em>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {filteredDuelMatrixRows.length === 0 && (
                    <tr className="duel-empty-row">
                      <td colSpan={duelMatrix.setupCount + 1}>No matching monsters</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="duel-matrix-empty" aria-label="Setup comparison across monsters status">
              <span>{duelMatrixBusy ? "Building comparison" : "Comparison inputs changed"}</span>
              {!duelMatrixBusy && (
                <button type="button" onClick={buildDuelMatrix}>
                  Build comparison
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </section>
  );
}

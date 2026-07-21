import { Fragment, useEffect, useRef, useState } from "react";
import { InlineImportNotice } from "../app-presenters";
import type { InlineNoticeViewModel } from "../../view-models/contracts";
import type { DuelMatrixPresentation } from "../../controllers/use-duel-pane";
import { formatDelta, signedPercent } from "../presentation-formatters";
import { formatNumber, signedDecimal } from "../../view-models/formatting";
import type {
  DuelComparisonRowViewModel,
  DuelComparisonSortKey,
  DuelComparisonSortState,
  DuelComparisonViewModel,
  DuelMatrixMetricId,
  DuelMatrixRowViewModel,
  DuelMatrixSortState,
  DuelMatrixSortTarget,
  DuelViewMode,
  SavedSetupMergeReviewViewModel
} from "../../view-models/duel";
import { expandedCompactLabel } from "../../view-models/presentation-language";
import type { SetupTransferChangeReview } from "../../state/setup-transfer-changes";
import { SetupChangeReviewDetails } from "../shell/setup-import-review";

const DUEL_MATRIX_METRICS: ReadonlyArray<{ id: DuelMatrixMetricId; label: string }> = [
  { id: "dps", label: "DPS" },
  { id: "effectiveXpPerHour", label: "EFF. XP/HR" },
  { id: "effectiveNetGpPerHour", label: "EFF. NET GP/HR" },
  { id: "gpPerXp", label: "NET GP/XP" }
];

const DUEL_COMPARISON_COLUMNS: ReadonlyArray<{
  label: string;
  sortKey: DuelComparisonSortKey;
  numeric?: boolean;
}> = [
  { label: "Setup", sortKey: "setup" },
  { label: "Loadout", sortKey: "loadout" },
  { label: "Max", sortKey: "maxHit", numeric: true },
  { label: "DPS", sortKey: "dps", numeric: true },
  {
    label: "EFF. XP/HR",
    sortKey: "effectiveXpPerHour",
    numeric: true
  },
  {
    label: "EFF. NET GP/HR",
    sortKey: "effectiveNetGpPerHour",
    numeric: true
  },
  {
    label: "NET GP/XP",
    sortKey: "gpPerXp",
    numeric: true
  },
  {
    label: "EFF. K/HR",
    sortKey: "effectiveKph",
    numeric: true
  }
];

function gpPerXpDisplay(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "-" : formatNumber(value, 2);
}

function duelDeltaDisplay(value: number | null, digits = 0): string {
  if (value === null) return "-";
  return digits === 0 ? formatDelta(value) : signedDecimal(value, digits);
}

function duelMatrixMetricLabel(metricId: DuelMatrixMetricId): string {
  const label = DUEL_MATRIX_METRICS.find((metric) => metric.id === metricId)?.label;
  if (metricId === "gpPerXp") return "Effective net gold pieces per experience point";
  return (label && expandedCompactLabel(label)) ?? label ?? metricId;
}

function duelMatrixMetricDisplay(metricId: DuelMatrixMetricId, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return formatNumber(value, metricId === "dps" || metricId === "gpPerXp" ? 2 : 0);
}

function duelRowClass(row: DuelComparisonRowViewModel): string | undefined {
  return row.source === "live" ? "duel-live-row" : undefined;
}

function duelComparisonAriaSort(
  sort: DuelComparisonSortState,
  key: DuelComparisonSortKey
): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function sameDuelMatrixSortTarget(
  current: DuelMatrixSortTarget | null,
  target: DuelMatrixSortTarget
): boolean {
  if (current === null || current.kind !== target.kind) return false;
  if (current.kind === "monster") return true;
  return target.kind === "setup" && current.setupId === target.setupId;
}

function duelMatrixAriaSort(
  sort: DuelMatrixSortState,
  target: DuelMatrixSortTarget
): "ascending" | "descending" | "none" {
  if (!sameDuelMatrixSortTarget(sort.target, target)) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function sortIndicator(active: boolean, direction: "asc" | "desc"): string {
  return active ? (direction === "asc" ? "^" : "v") : "";
}

export interface DuelPaneModel {
  targetLabel: string;
  snapshotCount: number;
  duelComparison: DuelComparisonViewModel | null;
  duelComparisonRows: DuelComparisonRowViewModel[];
  duelComparisonSort: DuelComparisonSortState;
  duelViewMode: DuelViewMode;
  expandedDuelDiffId: string | null;
  duelMatrixMetric: DuelMatrixMetricId;
  duelMatrixFilter: string;
  duelMatrixPresentation: DuelMatrixPresentation;
  filteredDuelMatrixRows: DuelMatrixRowViewModel[];
  duelMatrixSort: DuelMatrixSortState;
  duelImportNotice: InlineNoticeViewModel | null;
  duelImportReview:
    | (SavedSetupMergeReviewViewModel & {
        contextTone: "ready" | "warning";
        contextMessage: string;
      })
    | null;
  duelLoadReview: {
    id: number;
    snapshotId: string;
    snapshotName: string;
    changeReview: SetupTransferChangeReview;
    stale: boolean;
    sourceMissing: boolean;
  } | null;
  duelSessionOnlyAvailable: boolean;
  duelChangeRevision: number;
}

export interface DuelPaneActions {
  snapshotCurrentSetup(): void;
  exportDuelSnapshots(): void;
  importDuelSnapshots(file: File): Promise<void>;
  mergeDuelSnapshotsImport(reviewId: number): void;
  dismissDuelSnapshotsImport(reviewId: number): void;
  setDuelSnapshotsImportDecision(
    reviewId: number,
    snapshotId: string,
    decision: "keep" | "replace" | "add" | "exclude"
  ): void;
  setDuelSnapshotsImportName(reviewId: number, snapshotId: string, name: string): void;
  refreshDuelSnapshotsImport(reviewId: number): void;
  applyDuelSessionOnlyChange(): void;
  commitDuelSnapshotName(
    snapshotId: string,
    name: string
  ):
    | "renamed"
    | "unchanged"
    | "missing"
    | "invalid"
    | "duplicate"
    | "session-only-available"
    | "failed";
  loadDuelSnapshot(snapshotId: string): void;
  refreshDuelSnapshotLoad(snapshotId: string): void;
  confirmDuelSnapshotLoad(snapshotId: string): void;
  dismissDuelSnapshotLoad(snapshotId: string): void;
  deleteDuelSnapshot(snapshotId: string): void;
  showCurrentDuelTarget(): void;
  showDuelMonsterMatrix(): void;
  toggleDuelDiff(snapshotId: string): void;
  sortDuelComparisonBy(key: DuelComparisonSortKey): void;
  setDuelMatrixFilter(value: string): void;
  setDuelMatrixMetric(metric: DuelMatrixMetricId): void;
  sortDuelMatrixBy(target: DuelMatrixSortTarget): void;
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
    duelComparisonRows,
    duelComparisonSort,
    duelViewMode,
    expandedDuelDiffId,
    duelMatrixMetric,
    duelMatrixFilter,
    duelMatrixPresentation,
    filteredDuelMatrixRows,
    duelMatrixSort,
    duelImportNotice,
    duelImportReview,
    duelLoadReview,
    duelSessionOnlyAvailable,
    duelChangeRevision
  } = model;
  const duelMatrix = duelMatrixPresentation.displayModel;
  const matrixBuilding = duelMatrixPresentation.status === "building";
  const {
    snapshotCurrentSetup,
    exportDuelSnapshots,
    importDuelSnapshots,
    mergeDuelSnapshotsImport,
    dismissDuelSnapshotsImport,
    setDuelSnapshotsImportDecision,
    setDuelSnapshotsImportName,
    refreshDuelSnapshotsImport,
    applyDuelSessionOnlyChange,
    commitDuelSnapshotName,
    loadDuelSnapshot,
    refreshDuelSnapshotLoad,
    confirmDuelSnapshotLoad,
    dismissDuelSnapshotLoad,
    deleteDuelSnapshot,
    showCurrentDuelTarget,
    showDuelMonsterMatrix,
    toggleDuelDiff,
    sortDuelComparisonBy,
    setDuelMatrixFilter,
    setDuelMatrixMetric,
    sortDuelMatrixBy,
    buildDuelMatrix
  } = actions;
  const importInputRef = useRef<HTMLInputElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const loadReviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const loadReviewTriggersRef = useRef(new Map<string, HTMLButtonElement>());
  const handledReviewIdRef = useRef(0);
  const handledLoadReviewIdRef = useRef(0);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameTriggersRef = useRef(new Map<string, HTMLButtonElement>());
  const previousChangeRevisionRef = useRef(duelChangeRevision);
  const [renameEditor, setRenameEditor] = useState<{
    snapshotId: string;
    displayName: string;
    draft: string;
    error: string | null;
    revision: number;
  } | null>(null);
  const renameEditorSnapshotId = renameEditor?.snapshotId ?? null;

  useEffect(() => {
    if (hidden || !duelImportReview || handledReviewIdRef.current === duelImportReview.id) return;
    const frameId = window.requestAnimationFrame(() => {
      reviewHeadingRef.current?.focus({ preventScroll: true });
      handledReviewIdRef.current = duelImportReview.id;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [duelImportReview, hidden]);

  useEffect(() => {
    if (hidden || !duelLoadReview || handledLoadReviewIdRef.current === duelLoadReview.id) return;
    const frameId = window.requestAnimationFrame(() => {
      loadReviewHeadingRef.current?.focus({ preventScroll: true });
      handledLoadReviewIdRef.current = duelLoadReview.id;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [duelLoadReview, hidden]);

  useEffect(() => {
    if (!renameEditorSnapshotId) return;
    renameInputRef.current?.focus({ preventScroll: true });
    renameInputRef.current?.select();
  }, [renameEditorSnapshotId]);

  useEffect(() => {
    if (previousChangeRevisionRef.current === duelChangeRevision) return;
    previousChangeRevisionRef.current = duelChangeRevision;
    if (!renameEditor) return;
    const snapshotId = renameEditor.snapshotId;
    window.queueMicrotask(() => renameTriggersRef.current.get(snapshotId)?.focus());
  }, [duelChangeRevision, renameEditor]);

  const cancelRename = (): void => {
    if (!renameEditor) return;
    const snapshotId = renameEditor.snapshotId;
    setRenameEditor(null);
    window.queueMicrotask(() => renameTriggersRef.current.get(snapshotId)?.focus());
  };

  const saveRename = (): void => {
    if (!renameEditor) return;
    const result = commitDuelSnapshotName(renameEditor.snapshotId, renameEditor.draft);
    if (result === "renamed" || result === "unchanged") {
      cancelRename();
      return;
    }
    const errors = {
      missing: "That saved setup no longer exists.",
      invalid: "Enter a name between 1 and 80 characters.",
      duplicate: "Choose a unique saved setup name.",
      "session-only-available": "Use the session-only action below to apply this rename.",
      failed: "The name could not be saved. Review the notice and try again."
    } as const;
    setRenameEditor((current) => (current ? { ...current, error: errors[result] } : current));
  };

  const restoreLoadTriggerFocus = (snapshotId: string): void => {
    window.queueMicrotask(() => loadReviewTriggersRef.current.get(snapshotId)?.focus());
  };

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
                <p id="saved-setup-collection-scope">
                  This file contains the saved comparison collection only. It does not replace the
                  active setup until you later load an individual saved row.
                </p>
                <label className="file-button">
                  Review saved setup collection
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    aria-describedby="saved-setup-collection-scope"
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
                <button
                  type="button"
                  aria-describedby="saved-setup-collection-scope"
                  onClick={exportDuelSnapshots}
                  disabled={snapshotCount === 0}
                >
                  Export saved setup collection
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
          disabled={snapshotCount === 0 || matrixBuilding}
        >
          All monsters
        </button>
      </div>

      {duelImportNotice && (
        <InlineImportNotice
          notice={duelImportNotice}
          ariaLabel="Saved setup transfer notice"
          className="duel-import-notice"
        />
      )}

      {duelSessionOnlyAvailable && (
        <div className="duel-session-only-action">
          <button type="button" onClick={applyDuelSessionOnlyChange}>
            Apply saved setup change for this session
          </button>
          <span>Saved browser data will remain unchanged.</span>
        </div>
      )}

      {duelImportReview && (
        <section className="duel-import-review" aria-label="Saved setup import review">
          <span className="visually-hidden" role="status" aria-live="polite">
            {duelImportReview.stale
              ? "Saved setup merge review is stale."
              : `${duelImportReview.selectedAddCount} additions and ${duelImportReview.selectedReplaceCount} replacements selected.`}
          </span>
          <div className="section-title-row">
            <h3 ref={reviewHeadingRef} tabIndex={-1}>
              Review saved setups
            </h3>
            <span
              className={`status-pill ${duelImportReview.stale ? "warning" : duelImportReview.canMerge ? "ready" : "neutral"}`}
            >
              {duelImportReview.stale
                ? "Refresh required"
                : duelImportReview.canMerge
                  ? "Ready to merge"
                  : "Review selections"}
            </span>
          </div>
          <dl className="duel-import-review-summary">
            <div>
              <dt>Setups in file</dt>
              <dd>{formatNumber(duelImportReview.setupCount)}</dd>
            </div>
            <div>
              <dt>Add</dt>
              <dd>{formatNumber(duelImportReview.selectedAddCount)}</dd>
            </div>
            <div>
              <dt>Replace</dt>
              <dd>{formatNumber(duelImportReview.selectedReplaceCount)}</dd>
            </div>
            <div>
              <dt>Keep</dt>
              <dd>{formatNumber(duelImportReview.keepCount)}</dd>
            </div>
            <div>
              <dt>Identical</dt>
              <dd>{formatNumber(duelImportReview.identicalCount)}</dd>
            </div>
            <div>
              <dt>Not selected</dt>
              <dd>{formatNumber(duelImportReview.notSelectedCount)}</dd>
            </div>
          </dl>
          <p className={`inline-status ${duelImportReview.contextTone}`} role="status">
            {duelImportReview.contextMessage}
          </p>
          <p>
            Matching IDs are reviewed individually and default to Keep. New setups are selected only
            while one of {formatNumber(duelImportReview.availableSlots)} available slots remains.
            Unrelated saved setups are always kept.
          </p>
          {duelImportReview.stale && (
            <div className="inline-status warning" role="alert">
              <span>
                Saved setups changed after this review was created. Refresh before merging.
              </span>
              <button type="button" onClick={() => refreshDuelSnapshotsImport(duelImportReview.id)}>
                Refresh review
              </button>
            </div>
          )}
          <div className="duel-import-review-rows">
            {duelImportReview.rows.map((row) => {
              const selected = row.decision === "add" || row.decision === "replace";
              const nameId = `duel-import-name-${duelImportReview.id}-${row.snapshotId}`;
              return (
                <article
                  className={`duel-import-review-row ${row.nameStatus === "conflict" || row.nameStatus === "invalid" ? "has-error" : ""}`}
                  key={row.snapshotId}
                  data-merge-classification={row.classification}
                >
                  <div className="duel-import-review-row-heading">
                    <div>
                      <strong>{row.sourceDisplayName}</strong>
                      <span>{row.classificationLabel}</span>
                    </div>
                    {row.currentDisplayName && (
                      <small>Current setup: {row.currentDisplayName}</small>
                    )}
                  </div>

                  {row.classification === "replacement-candidate" ? (
                    <fieldset disabled={duelImportReview.stale}>
                      <legend>Choose how to handle {row.sourceDisplayName}</legend>
                      <label>
                        <input
                          type="radio"
                          name={`duel-merge-${duelImportReview.id}-${row.snapshotId}`}
                          checked={row.decision === "keep"}
                          onChange={() =>
                            setDuelSnapshotsImportDecision(
                              duelImportReview.id,
                              row.snapshotId,
                              "keep"
                            )
                          }
                        />
                        Keep current setup
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`duel-merge-${duelImportReview.id}-${row.snapshotId}`}
                          checked={row.decision === "replace"}
                          onChange={() =>
                            setDuelSnapshotsImportDecision(
                              duelImportReview.id,
                              row.snapshotId,
                              "replace"
                            )
                          }
                        />
                        Replace with imported setup
                      </label>
                    </fieldset>
                  ) : row.classification === "addition-candidate" ||
                    row.classification === "capacity-excluded" ? (
                    <label className="duel-import-add-choice">
                      <input
                        type="checkbox"
                        checked={row.decision === "add"}
                        disabled={duelImportReview.stale}
                        onChange={(event) =>
                          setDuelSnapshotsImportDecision(
                            duelImportReview.id,
                            row.snapshotId,
                            event.currentTarget.checked ? "add" : "exclude"
                          )
                        }
                      />
                      Add this setup
                    </label>
                  ) : (
                    <p className="duel-import-identical">No changes; this setup is identical.</p>
                  )}

                  {selected && (
                    <label className="duel-import-recipient-name" htmlFor={nameId}>
                      Saved name
                      <input
                        id={nameId}
                        value={row.recipientName}
                        maxLength={80}
                        disabled={duelImportReview.stale}
                        aria-invalid={row.nameMessage ? true : undefined}
                        aria-describedby={row.nameMessage ? `${nameId}-error` : undefined}
                        onChange={(event) =>
                          setDuelSnapshotsImportName(
                            duelImportReview.id,
                            row.snapshotId,
                            event.currentTarget.value
                          )
                        }
                      />
                      {row.nameMessage && (
                        <small id={`${nameId}-error`} className="field-error">
                          {row.nameMessage}
                        </small>
                      )}
                    </label>
                  )}

                  {row.setupDiff && row.setupDiff.changeCount > 0 && (
                    <details className="duel-import-source-diff">
                      <summary>
                        Review source differences ({formatNumber(row.setupDiff.changeCount)})
                      </summary>
                      <p>These are stored setup fields only; no calculated impact is inferred.</p>
                      {row.setupDiff.groups.map((group) => (
                        <section key={group.id}>
                          <h4>{group.label}</h4>
                          <dl>
                            {group.items.map((item) => (
                              <div key={item.id}>
                                <dt>{item.label}</dt>
                                <dd>
                                  <span>Current: {item.liveValue}</span>
                                  <span>Imported: {item.snapshotValue}</span>
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </section>
                      ))}
                    </details>
                  )}
                </article>
              );
            })}
          </div>
          <div className="duel-import-review-actions">
            <button
              type="button"
              className="primary-action"
              onClick={() => mergeDuelSnapshotsImport(duelImportReview.id)}
              disabled={duelImportReview.stale || !duelImportReview.canMerge}
            >
              Merge selected setups
            </button>
            <button
              type="button"
              onClick={() => {
                dismissDuelSnapshotsImport(duelImportReview.id);
                window.queueMicrotask(() => importInputRef.current?.focus());
              }}
            >
              Dismiss
            </button>
          </div>
        </section>
      )}

      {duelViewMode === "current-target" ? (
        <div className="duel-table-wrap">
          <table className="duel-table" aria-label="Setup comparison table">
            <thead>
              <tr>
                {DUEL_COMPARISON_COLUMNS.map((column) => (
                  <th
                    scope="col"
                    className={column.numeric ? "numeric" : undefined}
                    aria-sort={duelComparisonAriaSort(duelComparisonSort, column.sortKey)}
                    key={column.sortKey}
                  >
                    <button
                      type="button"
                      className="sort-button"
                      aria-label={`Sort by ${
                        column.sortKey === "gpPerXp"
                          ? "Effective net gold pieces per experience point"
                          : (expandedCompactLabel(column.label) ?? column.label)
                      }`}
                      onClick={() => sortDuelComparisonBy(column.sortKey)}
                    >
                      <span>{column.label}</span>
                      <span aria-hidden="true">
                        {sortIndicator(
                          duelComparisonSort.key === column.sortKey,
                          duelComparisonSort.direction
                        )}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {duelComparisonRows.map((row) => {
                const diffId = `duel-diff-${row.snapshotId ?? "live"}`;
                const diffExpanded = row.snapshotId === expandedDuelDiffId;
                const loadReviewExpanded = row.snapshotId === duelLoadReview?.snapshotId;
                const loadReviewId = `duel-load-review-${row.snapshotId ?? "live"}`;
                return (
                  <Fragment key={row.id}>
                    <tr className={duelRowClass(row)}>
                      <td className="duel-setup-cell">
                        {row.source === "live" ? (
                          <strong>Live setup</strong>
                        ) : renameEditor?.snapshotId === row.snapshotId &&
                          renameEditor.revision === duelChangeRevision ? (
                          <div className="duel-rename-editor">
                            <label>
                              <span>Saved setup name</span>
                              <input
                                ref={renameInputRef}
                                aria-label={`New name for saved setup ${renameEditor.displayName}`}
                                value={renameEditor.draft}
                                maxLength={80}
                                aria-invalid={renameEditor.error ? true : undefined}
                                aria-describedby={
                                  renameEditor.error
                                    ? `duel-rename-error-${row.snapshotId}`
                                    : undefined
                                }
                                onChange={(event) => {
                                  const draft = event.currentTarget.value;
                                  setRenameEditor((current) =>
                                    current ? { ...current, draft, error: null } : current
                                  );
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    saveRename();
                                  } else if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelRename();
                                  }
                                }}
                              />
                            </label>
                            <div className="duel-rename-actions">
                              <button type="button" onClick={saveRename}>
                                Save
                              </button>
                              <button type="button" onClick={cancelRename}>
                                Cancel
                              </button>
                            </div>
                            {renameEditor.error && (
                              <small
                                id={`duel-rename-error-${row.snapshotId}`}
                                className="field-error"
                              >
                                {renameEditor.error}
                              </small>
                            )}
                          </div>
                        ) : (
                          <div className="duel-saved-name">
                            <strong>{row.displayName}</strong>
                            <button
                              ref={(element) => {
                                if (!row.snapshotId) return;
                                if (element) renameTriggersRef.current.set(row.snapshotId, element);
                                else renameTriggersRef.current.delete(row.snapshotId);
                              }}
                              type="button"
                              aria-label={`Rename saved setup ${row.displayName}`}
                              onClick={() => {
                                if (!row.snapshotId) return;
                                setRenameEditor({
                                  snapshotId: row.snapshotId,
                                  displayName: row.displayName,
                                  draft: row.name,
                                  error: null,
                                  revision: duelChangeRevision
                                });
                              }}
                            >
                              Rename
                            </button>
                          </div>
                        )}
                        {row.source === "snapshot" && row.duplicateName && (
                          <span className="duel-duplicate-name-note">Duplicate name</span>
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
                      <td className={`numeric ${row.best.effectiveKph ? "best" : ""}`}>
                        <span>{formatNumber(row.effectiveKph)}</span>
                        {row.best.effectiveKph && <em>best</em>}
                        <small>{duelDeltaDisplay(row.deltas.effectiveKph)}</small>
                      </td>
                      <td>
                        {row.snapshotId ? (
                          <div className="duel-row-actions">
                            <button
                              type="button"
                              aria-label={`${diffExpanded ? "Hide" : "Review"} differences for ${row.displayName}`}
                              aria-expanded={diffExpanded}
                              aria-controls={diffId}
                              onClick={() => toggleDuelDiff(row.snapshotId!)}
                            >
                              {diffExpanded ? "Hide diff" : "Review diff"}
                            </button>
                            <button
                              ref={(element) => {
                                if (!row.snapshotId) return;
                                if (element) {
                                  loadReviewTriggersRef.current.set(row.snapshotId, element);
                                } else {
                                  loadReviewTriggersRef.current.delete(row.snapshotId);
                                }
                              }}
                              type="button"
                              aria-label={`Load saved setup ${row.displayName}`}
                              aria-expanded={loadReviewExpanded}
                              aria-controls={loadReviewId}
                              onClick={() => loadDuelSnapshot(row.snapshotId!)}
                            >
                              {loadReviewExpanded ? "Reviewing Load" : "Load"}
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete saved setup ${row.displayName}`}
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
                    {row.snapshotId && loadReviewExpanded && duelLoadReview && (
                      <tr className="duel-load-review-row">
                        <td colSpan={9}>
                          <section
                            id={loadReviewId}
                            className="setup-import-review duel-load-review"
                            aria-label={`Review Load for ${row.displayName}`}
                          >
                            <span className="visually-hidden" role="status" aria-live="polite">
                              Saved setup ready for Load review.
                            </span>
                            <div className="setup-import-review-heading">
                              <div>
                                <span className="eyebrow">Saved setup Load</span>
                                <h3 ref={loadReviewHeadingRef} tabIndex={-1}>
                                  Review {duelLoadReview.snapshotName}
                                </h3>
                              </div>
                              <span
                                className={`status-pill ${
                                  duelLoadReview.stale
                                    ? "warning"
                                    : duelLoadReview.changeReview.changeCount > 0
                                      ? "ready"
                                      : "neutral"
                                }`}
                              >
                                {duelLoadReview.stale
                                  ? "Refresh required"
                                  : duelLoadReview.changeReview.changeCount > 0
                                    ? "Ready to load"
                                    : "No changes"}
                              </span>
                            </div>
                            <p>
                              {duelLoadReview.changeReview.changeCount} applicable setup field
                              {duelLoadReview.changeReview.changeCount === 1 ? "" : "s"} changed.
                            </p>
                            {duelLoadReview.stale && (
                              <p className="inline-status warning" role="alert">
                                {duelLoadReview.sourceMissing
                                  ? "This saved setup no longer exists. Dismiss this review."
                                  : "The active setup or this saved row changed. Refresh before loading."}
                              </p>
                            )}
                            {!duelLoadReview.stale &&
                              duelLoadReview.changeReview.changeCount === 0 && (
                                <p className="inline-status neutral">
                                  This saved setup has no applicable changes.
                                </p>
                              )}
                            <SetupChangeReviewDetails
                              groups={duelLoadReview.changeReview.groups}
                              includedScope={duelLoadReview.changeReview.includedScope}
                              excludedScope={duelLoadReview.changeReview.excludedScope}
                              includedLabel="Included in this Load"
                            />
                            <p>Calculated Duel impact remains in the separate Review diff panel.</p>
                            <div className="setup-import-review-actions">
                              {duelLoadReview.stale && !duelLoadReview.sourceMissing && (
                                <button
                                  type="button"
                                  className="primary-action"
                                  onClick={() => refreshDuelSnapshotLoad(row.snapshotId!)}
                                >
                                  Refresh comparison
                                </button>
                              )}
                              {!duelLoadReview.stale && (
                                <button
                                  type="button"
                                  className="primary-action"
                                  disabled={duelLoadReview.changeReview.changeCount === 0}
                                  onClick={() => {
                                    confirmDuelSnapshotLoad(row.snapshotId!);
                                    restoreLoadTriggerFocus(row.snapshotId!);
                                  }}
                                >
                                  Load saved setup
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  dismissDuelSnapshotLoad(row.snapshotId!);
                                  restoreLoadTriggerFocus(row.snapshotId!);
                                }}
                              >
                                Dismiss
                              </button>
                            </div>
                          </section>
                        </td>
                      </tr>
                    )}
                    {row.setupDiff && diffExpanded && (
                      <tr className="duel-diff-row">
                        <td colSpan={9}>
                          <section
                            id={diffId}
                            className="duel-diff-panel"
                            aria-label={`${row.displayName} setup and impact diff`}
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
                                <dd>{duelDeltaDisplay(row.deltas.ttkSec, 1)} s</dd>
                              </div>
                              <div>
                                <dt>Kills/trip</dt>
                                <dd>{duelDeltaDisplay(row.deltas.killsPerTrip, 1)}</dd>
                              </div>
                              <div>
                                <dt>Effective kills/hr</dt>
                                <dd>{duelDeltaDisplay(row.deltas.effectiveKph, 1)}</dd>
                              </div>
                              <div>
                                <dt>Effective XP/hr</dt>
                                <dd>{duelDeltaDisplay(row.deltas.effectiveXpPerHour)}</dd>
                              </div>
                              <div>
                                <dt>Effective net GP/hr</dt>
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
                  aria-label={duelMatrixMetricLabel(metric.id)}
                  onClick={() => setDuelMatrixMetric(metric.id)}
                  key={metric.id}
                >
                  <span aria-hidden="true">{metric.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={buildDuelMatrix}
              disabled={!duelMatrixPresentation.canBuild}
            >
              {duelMatrixPresentation.buildActionLabel}
            </button>
            <span
              className={`status-pill ${duelMatrixPresentation.status === "ready" ? "ready" : "pending"}`}
            >
              {duelMatrixPresentation.status === "ready" && duelMatrix
                ? `${duelMatrix.monsterCount} monsters - ${duelMatrix.setupCount} setups`
                : duelMatrixPresentation.status === "building"
                  ? "building"
                  : duelMatrixPresentation.status === "stale"
                    ? "previous result"
                    : duelMatrixPresentation.status === "failed"
                      ? "build failed"
                      : "not built"}
            </span>
          </div>

          {duelMatrixPresentation.status !== "ready" && (
            <p
              className={`duel-matrix-lifecycle ${duelMatrixPresentation.status}`}
              role={duelMatrixPresentation.status === "failed" ? "alert" : "status"}
            >
              {duelMatrixPresentation.message}
            </p>
          )}

          {duelMatrix ? (
            <div
              className="duel-table-wrap duel-matrix-wrap"
              aria-label={
                duelMatrixPresentation.displayIsCurrent
                  ? undefined
                  : "Previous all-monster setup comparison"
              }
            >
              <table
                className="duel-matrix-table"
                aria-label={
                  duelMatrixPresentation.displayIsCurrent
                    ? "All-monster setup comparison"
                    : "Previous all-monster setup comparison"
                }
              >
                <thead>
                  <tr>
                    <th
                      scope="col"
                      aria-sort={duelMatrixAriaSort(duelMatrixSort, { kind: "monster" })}
                    >
                      <button
                        type="button"
                        className="sort-button duel-matrix-sort-button"
                        onClick={() => sortDuelMatrixBy({ kind: "monster" })}
                      >
                        <strong>Monster</strong>
                        <i aria-hidden="true">
                          {sortIndicator(
                            duelMatrixSort.target?.kind === "monster",
                            duelMatrixSort.direction
                          )}
                        </i>
                      </button>
                    </th>
                    {duelMatrix.setups.map((setup) => {
                      const target: DuelMatrixSortTarget = {
                        kind: "setup",
                        setupId: setup.id
                      };
                      const active = sameDuelMatrixSortTarget(duelMatrixSort.target, target);
                      return (
                        <th
                          scope="col"
                          title={setup.loadoutLabel}
                          aria-sort={duelMatrixAriaSort(duelMatrixSort, target)}
                          key={setup.id}
                        >
                          <button
                            type="button"
                            className="sort-button duel-matrix-sort-button"
                            onClick={() => sortDuelMatrixBy(target)}
                          >
                            <strong>{setup.displayName}</strong>
                            <span>{setup.combatStyle}</span>
                            <i aria-hidden="true">
                              {sortIndicator(active, duelMatrixSort.direction)}
                            </i>
                          </button>
                        </th>
                      );
                    })}
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
                            aria-label={`${row.monsterName}, ${setup?.displayName ?? cell.setupId}, ${duelMatrixMetricLabel(duelMatrixMetric)}: ${displayValue}${isBest ? ", best" : ""}`}
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
          ) : null}
        </section>
      )}
    </section>
  );
}

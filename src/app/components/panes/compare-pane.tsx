import { DenseScaleCell } from "../app-presenters";
import type { EntityId } from "@/domain/shared";
import type { DenseCompareSortKey, DenseCompareUiState } from "../../state/dense-compare";
import { formatDuration, formatNumber } from "../../view-models/formatting";
import type {
  DenseCompareRowViewModel,
  DenseCompareScaleViewModel
} from "../../view-models/compare";
import type { DenseComparePresentation } from "../../controllers/use-compare-calculation";
import { expandedCompactLabel } from "../../view-models/presentation-language";

const DENSE_TABLE_COLUMNS: Array<{
  key: DenseCompareSortKey;
  label: string;
  align: "left" | "right";
  render: (row: DenseCompareRowViewModel) => string;
}> = [
  {
    key: "monsterName",
    label: "Monster",
    align: "left",
    render: (row) =>
      row.monsterLevel === null ? row.monsterName : `${row.monsterName} lvl ${row.monsterLevel}`
  },
  {
    key: "hitChance",
    label: "HIT %",
    align: "right",
    render: (row) => `${formatNumber(row.hitChance * 100, 1)}%`
  },
  { key: "maxHit", label: "MAX", align: "right", render: (row) => formatNumber(row.maxHit, 1) },
  { key: "dps", label: "DPS", align: "right", render: (row) => formatNumber(row.dps, 2) },
  { key: "ttkSec", label: "TTK", align: "right", render: (row) => formatDuration(row.ttkSec) },
  {
    key: "killsPerHour",
    label: "EFF. K/HR",
    align: "right",
    render: (row) => formatNumber(row.effectiveKph)
  },
  {
    key: "xpPerHour",
    label: "EFF. XP/HR",
    align: "right",
    render: (row) => formatNumber(row.effectiveXpPerHour)
  },
  {
    key: "gpPerKill",
    label: "GP/KL",
    align: "right",
    render: (row) => formatNumber(row.gpPerKill)
  },
  {
    key: "gpPerHour",
    label: "EFF. GP/HR",
    align: "right",
    render: (row) => formatNumber(row.effectiveGpPerHour)
  },
  {
    key: "netGpPerHour",
    label: "EFF. NET GP/HR",
    align: "right",
    render: (row) => formatNumber(row.effectiveNetGpPerHour)
  }
];

type DenseScaleColumnKey = "xpPerHour" | "netGpPerHour";

function isDenseScaleColumn(key: DenseCompareSortKey): key is DenseScaleColumnKey {
  return key === "xpPerHour" || key === "netGpPerHour";
}

function ariaSort(
  sort: DenseCompareUiState["sort"],
  key: DenseCompareSortKey
): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

export interface ComparePaneModel {
  denseCompare: DenseCompareUiState;
  denseCompareRows: DenseCompareRowViewModel[];
  denseCompareScale: DenseCompareScaleViewModel;
  denseCompareTotalRows: number;
  denseComparePresentation: DenseComparePresentation;
  selectedMonsterId: EntityId;
}

export interface ComparePaneActions {
  setDenseMonsterFilter(value: string): void;
  setDenseDropFilter(value: string): void;
  setDenseShowIrrelevant(value: boolean): void;
  resetDenseFilters(): void;
  sortBy(key: DenseCompareSortKey): void;
  selectTarget(monsterId: EntityId): void;
  toggleDenseIrrelevant(monsterId: EntityId): void;
  retryDenseCompare(): void;
}

export interface ComparePaneProps {
  hidden: boolean;
  model: ComparePaneModel;
  actions: ComparePaneActions;
}

export function ComparePane({ hidden, model, actions }: ComparePaneProps) {
  const {
    denseCompare,
    denseCompareRows,
    denseCompareScale,
    denseCompareTotalRows,
    denseComparePresentation,
    selectedMonsterId
  } = model;
  const {
    setDenseMonsterFilter,
    setDenseDropFilter,
    setDenseShowIrrelevant,
    resetDenseFilters,
    sortBy,
    selectTarget,
    toggleDenseIrrelevant,
    retryDenseCompare
  } = actions;
  const sortDescription = `${
    DENSE_TABLE_COLUMNS.find((column) => column.key === denseCompare.sort.key)?.label ??
    denseCompare.sort.key
  } ${denseCompare.sort.direction}`;

  return (
    <section className="dense-table-panel" aria-label="Monster comparison" hidden={hidden}>
      <div className="table-toolbar">
        <div>
          <div className="table-title-row">
            <h2>All monsters</h2>
            <div
              className={`status-pill ${
                denseComparePresentation.status === "building"
                  ? "pending"
                  : denseComparePresentation.status === "ready"
                    ? "ready"
                    : ""
              }`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label={denseComparePresentation.aria}
            >
              {denseComparePresentation.statusLabel}
            </div>
          </div>
          <span>
            {denseCompareRows.length} / {denseCompareTotalRows} monsters -{" "}
            {denseComparePresentation.summary} - sort {sortDescription}
          </span>
        </div>
        <div className="dense-filter-bar" aria-label="Dense compare filters">
          <div className="field">
            <label htmlFor="dense-monster-filter">Monster filter</label>
            <input
              id="dense-monster-filter"
              type="search"
              value={denseCompare.monsterFilter}
              placeholder="Monster"
              onChange={(event) => setDenseMonsterFilter(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="dense-drop-filter">Drop filter</label>
            <input
              id="dense-drop-filter"
              type="search"
              value={denseCompare.dropFilter}
              placeholder="Drop"
              onChange={(event) => setDenseDropFilter(event.target.value)}
            />
          </div>
          <label className="toggle dense-filter-toggle">
            <input
              type="checkbox"
              checked={denseCompare.showIrrelevant}
              onChange={(event) => setDenseShowIrrelevant(event.target.checked)}
            />
            <span>Show hidden / irrelevant</span>
          </label>
          <button type="button" onClick={resetDenseFilters}>
            Reset filters
          </button>
        </div>
      </div>
      {denseComparePresentation.message && (
        <div
          className={`inline-status calculation-lifecycle-message ${
            denseComparePresentation.status === "failed" ? "error" : "warning"
          }`}
          role={denseComparePresentation.status === "failed" ? "alert" : "status"}
        >
          <span>{denseComparePresentation.message}</span>
          {denseComparePresentation.canRetry && (
            <button type="button" onClick={retryDenseCompare}>
              {denseComparePresentation.retryActionLabel}
            </button>
          )}
        </div>
      )}
      <div
        className="dense-table-wrap"
        aria-label={
          denseCompareRows.length > 0 && !denseComparePresentation.displayIsCurrent
            ? "Previous Dense result"
            : undefined
        }
      >
        <table className="dense-table" aria-label="All monsters">
          <thead>
            <tr>
              {DENSE_TABLE_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={column.align === "right" ? "numeric" : undefined}
                  aria-sort={ariaSort(denseCompare.sort, column.key)}
                >
                  <button
                    type="button"
                    className="sort-button"
                    aria-label={`Sort by ${
                      expandedCompactLabel(column.label)?.toLowerCase() ?? column.label
                    }`}
                    onClick={() => sortBy(column.key)}
                  >
                    <span aria-hidden="true">{column.label}</span>
                    <span aria-hidden="true">
                      {denseCompare.sort.key === column.key
                        ? denseCompare.sort.direction === "asc"
                          ? "^"
                          : "v"
                        : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {denseCompareRows.map((row) => {
              const active = row.monsterId === selectedMonsterId;
              return (
                <tr
                  key={row.monsterId}
                  className={active ? "active" : undefined}
                  aria-selected={active}
                  aria-current={active ? "true" : undefined}
                  data-monster-id={row.monsterId}
                  tabIndex={active ? 0 : -1}
                  onClick={() => selectTarget(row.monsterId)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "ArrowDown" ||
                      event.key === "ArrowUp" ||
                      event.key === "Home" ||
                      event.key === "End"
                    ) {
                      event.preventDefault();
                      const rows = Array.from(
                        event.currentTarget.parentElement?.querySelectorAll<HTMLTableRowElement>(
                          "tr[data-monster-id]"
                        ) ?? []
                      );
                      const currentIndex = rows.indexOf(event.currentTarget);
                      const nextIndex =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? rows.length - 1
                            : event.key === "ArrowDown"
                              ? (currentIndex + 1) % rows.length
                              : (currentIndex - 1 + rows.length) % rows.length;
                      rows[nextIndex]?.focus();
                      return;
                    }
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectTarget(row.monsterId);
                    }
                  }}
                >
                  {DENSE_TABLE_COLUMNS.map((column) => {
                    const scaleRow = denseCompareScale[row.monsterId];
                    const scaleCell =
                      scaleRow && isDenseScaleColumn(column.key) ? scaleRow[column.key] : null;
                    const isBest =
                      (column.key === "killsPerHour" && scaleRow?.bestKph) ||
                      (column.key === "gpPerHour" && scaleRow?.bestGp);
                    return (
                      <td
                        key={column.key}
                        className={`${column.align === "right" ? "numeric" : "monster-cell"} ${
                          scaleCell ? "dense-scale-td" : ""
                        }`}
                      >
                        {column.key === "monsterName" && (
                          <span className="row-marker" aria-hidden="true">
                            {active ? ">" : ""}
                          </span>
                        )}
                        {scaleCell ? (
                          <DenseScaleCell value={column.render(row)} scale={scaleCell} />
                        ) : (
                          <span>{column.render(row)}</span>
                        )}
                        {isBest ? <em className="dense-best-marker">best</em> : null}
                        {column.key === "monsterName" && row.markers.length > 0 && (
                          <span className="row-state-markers">
                            {row.markers.map((marker) => {
                              const markerLabel = `${marker.ariaLabel} for ${row.monsterName}`;
                              return (
                                <span
                                  key={marker.id}
                                  className={`row-state-marker row-state-marker-${marker.id}`}
                                  aria-label={markerLabel}
                                  title={markerLabel}
                                >
                                  {marker.label}
                                </span>
                              );
                            })}
                          </span>
                        )}
                        {column.key === "monsterName" && (
                          <button
                            type="button"
                            className="row-visibility-button"
                            aria-label={
                              row.isIrrelevant
                                ? `Mark ${row.monsterName} relevant`
                                : `Mark ${row.monsterName} irrelevant`
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleDenseIrrelevant(row.monsterId);
                            }}
                          >
                            {row.isIrrelevant ? "Restore" : "Hide"}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

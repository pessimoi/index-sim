import type { CrossTabAreaConflict, CrossTabAreaId } from "../../controllers/cross-tab-conflicts";
import { formatNumber } from "../../view-models/formatting";
import { CROSS_TAB_CONFLICT_HEADING_ID } from "./settings-heading-ids";

export interface CrossTabConflictPanelModel {
  readonly conflicts: readonly CrossTabAreaConflict[];
  readonly selectedIds: readonly CrossTabAreaId[];
  readonly notice: { tone: "neutral" | "success" | "warning" | "error"; message: string } | null;
  readonly persistenceAvailable: boolean;
}

export interface CrossTabConflictPanelActions {
  toggle(id: CrossTabAreaId, selected: boolean): void;
  refresh(): void;
  useSavedData(): void;
  keepCurrent(): void;
  exportWorkspace(): void;
}

function externalStatusLabel(status: CrossTabAreaConflict["externalStatus"]): string {
  if (status === "valid") return "Changed";
  if (status === "missing") return "Cleared";
  if (status === "unsupported") return "Unsupported";
  return "Invalid";
}

export function CrossTabConflictPanel({
  model,
  actions
}: {
  model: CrossTabConflictPanelModel;
  actions: CrossTabConflictPanelActions;
}) {
  if (model.conflicts.length === 0) return null;
  const selected = new Set(model.selectedIds);
  const selectedConflicts = model.conflicts.filter((conflict) => selected.has(conflict.id));
  const selectedResolvable =
    selectedConflicts.length > 0 &&
    selectedConflicts.every(
      (conflict) => conflict.externalStatus === "valid" || conflict.externalStatus === "missing"
    );
  const canUseSavedData = selectedResolvable && selectedConflicts.length === model.conflicts.length;

  return (
    <section
      className="service-group cross-tab-conflict-panel"
      aria-labelledby={CROSS_TAB_CONFLICT_HEADING_ID}
    >
      <div className="section-title-row">
        <h2 id={CROSS_TAB_CONFLICT_HEADING_ID} tabIndex={-1}>
          Data changed in another tab
        </h2>
        <span className="status-pill warning">{formatNumber(model.conflicts.length)} affected</span>
      </div>
      <p className="inline-status warning" role="status">
        Current-tab values remain active in memory. Automatic saving is paused only for the affected
        areas until you review a resolution.
      </p>
      {model.notice ? (
        <p
          className={`inline-status ${model.notice.tone}`}
          role={model.notice.tone === "error" ? "alert" : "status"}
        >
          {model.notice.message}
        </p>
      ) : null}
      <p>
        Download a Workspace backup first if you want a copy of this tab&apos;s current live values.
        Raw saved data from the other tab is never shown or included in this review.
      </p>
      <div className="workspace-review-table-wrap">
        <table className="legacy-review-table" aria-label="Cross-tab conflicts">
          <thead>
            <tr>
              <th>Include</th>
              <th>Area</th>
              <th>Saved state</th>
              <th>This tab</th>
              <th>Saving</th>
            </tr>
          </thead>
          <tbody>
            {model.conflicts.map((conflict) => {
              const selectable =
                conflict.externalStatus === "valid" || conflict.externalStatus === "missing";
              return (
                <tr key={conflict.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Include ${conflict.label}`}
                      checked={selected.has(conflict.id)}
                      disabled={!selectable}
                      onChange={(event) => actions.toggle(conflict.id, event.target.checked)}
                    />
                  </td>
                  <td>{conflict.label}</td>
                  <td>{externalStatusLabel(conflict.externalStatus)}</td>
                  <td>Current values are still active</td>
                  <td>Paused</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {model.conflicts.some(
        (conflict) =>
          conflict.externalStatus === "invalid" || conflict.externalStatus === "unsupported"
      ) ? (
        <p className="inline-status warning">
          Invalid or unsupported saved data must be handled in Local state recovery before it can be
          replaced.
        </p>
      ) : null}
      <div className="market-sync-bar">
        <button type="button" onClick={actions.exportWorkspace}>
          Download full Workspace backup
        </button>
        <button type="button" onClick={actions.refresh}>
          Refresh review
        </button>
        <button type="button" disabled={!canUseSavedData} onClick={actions.useSavedData}>
          Use saved data
        </button>
        <button
          type="button"
          disabled={!selectedResolvable || !model.persistenceAvailable}
          onClick={actions.keepCurrent}
        >
          Keep this tab&apos;s data
        </button>
      </div>
      {selectedResolvable ? (
        <p className="inline-status neutral">
          Both resolution actions affect {formatNumber(selectedConflicts.length)} selected area
          {selectedConflicts.length === 1 ? "" : "s"}. Use saved data is available only when all
          conflicts are selected because it reloads the whole application; Keep writes this
          tab&apos;s complete selected values and provides Undo.
        </p>
      ) : null}
    </section>
  );
}

import type { ChangeEvent, Ref } from "react";
import type {
  WorkspaceFileTransferSnapshot,
  WorkspaceRestorePlanAction
} from "../../controllers/workspace-file-transfer";
import type { WorkspaceRestoreSelectionArea } from "../../controllers/workspace-file-transfer-review";
import { formatNumber } from "../../view-models/formatting";

export const WORKSPACE_REVIEW_HEADING_ID = "workspace-restore-review-heading";

export interface WorkspaceBackupPanelModel extends WorkspaceFileTransferSnapshot {
  currentRevisionLabel: string;
  currentSnapshotLabel: string;
  currentSnapshotId: string;
  canIncludeLastHiscoresPlayer: boolean;
}

export interface WorkspaceBackupPanelActions {
  setIncludeLastHiscoresPlayer(include: boolean): void;
  exportWorkspace(): void;
  dismissReview(reviewId: number): void;
  restore(
    intent:
      | { kind: "prepare"; file: File }
      | { kind: "plan"; reviewId: number; action: WorkspaceRestorePlanAction }
      | { kind: "apply"; reviewId: number }
      | { kind: "apply-session"; reviewId: number }
  ): unknown;
  reviewRecovery(): void;
}

export interface WorkspaceBackupPanelProps {
  model: WorkspaceBackupPanelModel;
  actions: WorkspaceBackupPanelActions;
  importInputRef?: Ref<HTMLInputElement>;
  exportButtonRef?: Ref<HTMLButtonElement>;
  reviewHeadingRef?: Ref<HTMLHeadingElement>;
}

function formatBytes(byteSize: number): string {
  if (byteSize < 1_000) return `${formatNumber(byteSize)} B`;
  if (byteSize < 1_000_000) return `${(byteSize / 1_000).toFixed(1)} KB`;
  return `${(byteSize / 1_000_000).toFixed(1)} MB`;
}

function compatibilityLabel(status: string): string {
  if (status === "ready") return "Ready";
  if (status === "incompatible") return "Unavailable references";
  if (status === "unsupported-version") return "Unsupported transfer version";
  return "Invalid data";
}

async function importWorkspaceFromInput(
  event: ChangeEvent<HTMLInputElement>,
  prepareImport: (file: File) => unknown
): Promise<void> {
  const input = event.currentTarget;
  const file = input.files?.[0];
  try {
    if (file) await prepareImport(file);
  } finally {
    input.value = "";
  }
}

export function WorkspaceBackupPanel({
  model,
  actions,
  importInputRef,
  exportButtonRef,
  reviewHeadingRef
}: WorkspaceBackupPanelProps) {
  const privacyHelpId = "workspace-hiscores-privacy-help";
  const scopeHelpId = "workspace-backup-transfer-scope";

  return (
    <section
      className="service-group workspace-backup-panel"
      aria-label="Workspace backup and restore"
    >
      <div className="section-title-row">
        <h2>Workspace backup and restore</h2>
        <span className="status-pill ready">Local JSON</span>
      </div>
      <p id={scopeHelpId} className="inline-status neutral">
        Download one versioned file containing the active local Workspace. Import prepares a
        read-only review and does not change this browser. It includes setup, Planner, Loot, saved
        setups, prices and local history. Calculated output, pending reviews and Undo are excluded.
      </p>
      <div className="price-history-summary" aria-label="Workspace export context">
        <span>Game revision {model.currentRevisionLabel}</span>
        <span>Snapshot {model.currentSnapshotLabel}</span>
        <span>Snapshot id {model.currentSnapshotId}</span>
        <span>Required areas 9</span>
        <span>Maximum import 10 MB</span>
      </div>
      <label className="tier-toggle workspace-hiscores-toggle">
        <span>Include last Hiscores player name</span>
        <input
          type="checkbox"
          checked={model.includeLastHiscoresPlayer}
          disabled={!model.canIncludeLastHiscoresPlayer}
          aria-describedby={privacyHelpId}
          onChange={(event) => actions.setIncludeLastHiscoresPlayer(event.target.checked)}
        />
      </label>
      <p id={privacyHelpId} className="inline-status warning">
        A player name may identify a game character to anyone receiving the file. This choice is
        session-only and is not saved.
      </p>
      <div className="market-sync-bar">
        <button
          ref={exportButtonRef}
          type="button"
          aria-describedby={`${scopeHelpId} ${privacyHelpId}`}
          onClick={actions.exportWorkspace}
        >
          Download full Workspace backup
        </button>
        <label className="file-button">
          Review Workspace backup file
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            aria-describedby={`${scopeHelpId} ${privacyHelpId}`}
            onChange={(event) =>
              void importWorkspaceFromInput(event, (file) =>
                actions.restore({ kind: "prepare", file })
              )
            }
          />
        </label>
      </div>
      {model.phase === "reading" && (
        <p className="inline-status neutral" role="status">
          Reading and validating Workspace file…
        </p>
      )}
      {model.notice && (
        <p
          id={model.notice.tone === "error" ? "workspace-restore-error-summary" : undefined}
          tabIndex={model.notice.tone === "error" ? -1 : undefined}
          className={`inline-status ${model.notice.tone}`}
          role={model.notice.tone === "error" ? "alert" : "status"}
          aria-label="Workspace transfer notice"
        >
          {model.notice.message}
        </p>
      )}
      {model.recoveryRequired && (
        <button type="button" className="link-button" onClick={actions.reviewRecovery}>
          Review Local state recovery
        </button>
      )}
      {model.review && (
        <section className="workspace-restore-review" aria-label="Workspace restore review">
          <div className="section-title-row">
            <h3 id={WORKSPACE_REVIEW_HEADING_ID} ref={reviewHeadingRef} tabIndex={-1}>
              Review before restore
            </h3>
            <span className={`status-pill ${model.review.context.tone}`}>
              {model.review.context.match === "exact-snapshot"
                ? "Exact snapshot"
                : "Review context"}
            </span>
          </div>
          <p
            className={`inline-status ${model.review.context.tone === "warning" ? "warning" : "success"}`}
            role={model.review.context.tone === "warning" ? "alert" : "status"}
          >
            {model.review.context.message}
          </p>
          <dl className="calculation-context-grid" aria-label="Workspace file summary">
            <div>
              <dt>File kind</dt>
              <dd>
                <code>{model.review.file.kind}</code> v{formatNumber(model.review.file.version)}
              </dd>
            </div>
            <div>
              <dt>Exported</dt>
              <dd>
                <time dateTime={model.review.file.exportedAt}>{model.review.file.exportedAt}</time>
              </dd>
            </div>
            <div>
              <dt>File size</dt>
              <dd>{formatBytes(model.review.file.byteSize)}</dd>
            </div>
            <div>
              <dt>Areas</dt>
              <dd>{formatNumber(model.review.file.areaCount)}</dd>
            </div>
            <div>
              <dt>Source revision</dt>
              <dd>Revision {model.review.context.source?.gameRevision ?? "unknown"}</dd>
            </div>
            <div>
              <dt>Current revision</dt>
              <dd>Revision {formatNumber(model.review.context.current.gameRevision)}</dd>
            </div>
            <div>
              <dt>Source snapshot</dt>
              <dd>
                <code>{model.review.context.source?.gameDataId ?? "unknown"}</code>
              </dd>
            </div>
            <div>
              <dt>Current snapshot</dt>
              <dd>
                <code>{model.review.context.current.gameDataId}</code>
              </dd>
            </div>
          </dl>
          <div className="workspace-review-table-wrap">
            <table className="legacy-review-table" aria-label="Workspace restore areas">
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Versions</th>
                  <th>Backup</th>
                  <th>Current</th>
                  <th>Compatibility</th>
                  <th>Include</th>
                  <th>Mode</th>
                  <th>Exact effects</th>
                </tr>
              </thead>
              <tbody>
                {model.review.areas.map((area) => {
                  const selection = model.selection?.areas.find(
                    (candidate) => candidate.id === area.id
                  );
                  const preview = model.restorePlan?.areas.find(
                    (candidate) => candidate.id === area.id
                  );
                  return (
                    <tr key={area.id}>
                      <td>{area.label}</td>
                      <td>
                        Transfer v{formatNumber(area.transferVersion)} · local v
                        {formatNumber(area.localVersion)}
                      </td>
                      <td>{area.sourceSummary}</td>
                      <td>{area.currentSummary}</td>
                      <td>
                        <strong>{compatibilityLabel(area.status)}</strong>
                        <br />
                        {area.compatibilityMessage}
                      </td>
                      <td>
                        <label className="workspace-area-choice">
                          <input
                            type="checkbox"
                            checked={selection?.selected ?? false}
                            disabled={!area.selectable}
                            onChange={(event) =>
                              void actions.restore({
                                kind: "plan",
                                reviewId: model.review!.id,
                                action: {
                                  kind: "selected",
                                  areaId: area.id,
                                  selected: event.target.checked
                                }
                              })
                            }
                          />
                          <span>{area.selectable ? `Restore ${area.label}` : "Unavailable"}</span>
                        </label>
                      </td>
                      <td>
                        <label className="workspace-area-mode">
                          <span className="visually-hidden">{area.label} restore mode</span>
                          <select
                            aria-label={`${area.label} restore mode`}
                            value={selection?.mode ?? area.defaultMode}
                            disabled={!area.selectable || !selection?.selected}
                            onChange={(event) =>
                              void actions.restore({
                                kind: "plan",
                                reviewId: model.review!.id,
                                action: {
                                  kind: "mode",
                                  areaId: area.id,
                                  mode: event.target.value as WorkspaceRestoreSelectionArea["mode"]
                                }
                              })
                            }
                          >
                            {area.availableModes.map((mode) => (
                              <option key={mode} value={mode}>
                                {mode === "replace" ? "Replace" : "Merge"}
                              </option>
                            ))}
                          </select>
                        </label>
                      </td>
                      <td>
                        {preview?.effectSummary ?? "No restore outcome available"}
                        {preview?.validationMessage && (
                          <>
                            <br />
                            <strong>{preview.validationMessage}</strong>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p
            className={`inline-status ${model.restorePlan?.status === "invalid" ? "warning" : "neutral"}`}
            role={model.restorePlan?.status === "invalid" ? "alert" : "status"}
          >
            {model.restorePlan?.validationMessage ??
              "Select compatible areas and choose an available restore mode."}
            {model.restorePlan?.status === "ready" && (
              <>
                {" "}
                {formatNumber(model.restorePlan.changedAreaCount)} areas will change and{" "}
                {formatNumber(model.restorePlan.clearedAreaCount)} storage targets will clear.
              </>
            )}
          </p>
          <div className="market-sync-bar">
            <button
              type="button"
              disabled={!model.restorePlan?.canApply || model.restoreBusy}
              aria-describedby="workspace-apply-pending-help"
              data-plan-ready={model.restorePlan?.canApply ? "true" : "false"}
              onClick={() => void actions.restore({ kind: "apply", reviewId: model.review!.id })}
            >
              {model.restoreBusy ? "Applying Workspace…" : "Apply selected areas"}
            </button>
            {model.sessionOnlyAvailable?.reviewId === model.review.id && (
              <button
                type="button"
                disabled={model.restoreBusy || !model.restorePlan?.canApply}
                onClick={() =>
                  void actions.restore({
                    kind: "apply-session",
                    reviewId: model.review!.id
                  })
                }
              >
                Apply for this session
              </button>
            )}
            <button type="button" onClick={() => actions.dismissReview(model.review!.id)}>
              Dismiss
            </button>
          </div>
          <p id="workspace-apply-pending-help" className="inline-status neutral">
            Apply writes every selected area as one rollback-protected batch before changing live
            values. Session-only Apply is offered explicitly only when durable storage is
            unavailable or was rolled back safely.
          </p>
        </section>
      )}
    </section>
  );
}

export default WorkspaceBackupPanel;

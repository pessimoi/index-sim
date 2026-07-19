import type {
  LocalStateHealthItem,
  LocalStateHealthItemId,
  LocalStateHealthReport
} from "../../state/local-state-health";
import type { LocalStateClearPendingId } from "../../controllers/local-state-recovery";
import { formatNumber } from "../../view-models/formatting";

export const LOCAL_STATE_RECOVERY_HEADING_ID = "local-state-recovery-heading";

interface LocalStateRecoveryPanelProps {
  visible: boolean;
  report: LocalStateHealthReport;
  notice: string | null;
  pendingClearId: LocalStateClearPendingId;
  onExport: () => void;
  onBeginClear: (id: LocalStateHealthItemId | "invalid-all") => void;
  onCancelClear: () => void;
  onConfirmClearItem: (id: LocalStateHealthItemId) => void;
  onConfirmClearInvalid: () => void;
}

function localStateStatusLabel(item: LocalStateHealthItem): string {
  if (item.status === "loaded") return "Loaded";
  if (item.status === "missing") return "Not saved";
  if (item.status === "version-mismatch") return "Unsupported version";
  if (item.status === "unavailable") return "Storage unavailable";
  if (item.status === "save-failed") return "Save failed";
  return "Invalid";
}

function localStateReasonLabel(item: LocalStateHealthItem): string {
  if (item.status === "missing") return "Using defaults until this state is saved.";
  if (item.status === "loaded") return "Local data is valid.";
  if (item.status === "unavailable") {
    return "Local storage could not be read. Defaults are active and changes may not persist after reload.";
  }
  if (item.status === "save-failed") {
    return item.reason === "clear_failed"
      ? "Local storage could not be cleared. Current session data remains active, but reload may restore the saved state."
      : "Local storage could not be saved. Current session data remains active, but changes may not persist after reload.";
  }
  if (item.status === "version-mismatch") {
    return `Found v${formatNumber(item.foundVersion ?? 0)}, expected v${formatNumber(
      item.expectedVersion
    )}. Defaults are active until this key is cleared or replaced.`;
  }
  if (item.reason === "body_too_large") {
    return "Saved data is too large. Defaults are active until this key is cleared or replaced.";
  }
  if (item.reason === "duplicate_keys") {
    return "Saved data contains duplicate JSON keys. Defaults are active until this key is cleared or replaced.";
  }
  if (item.reason === "invalid_json") {
    return "Saved data is not valid JSON. Defaults are active until this key is cleared or replaced.";
  }
  if (item.reason === "invalid_envelope") {
    return "Saved metadata is invalid. Defaults are active until this key is cleared or replaced.";
  }
  return "Saved data failed validation. Defaults are active until this key is cleared or replaced.";
}

function localStateRecoveryStatus(report: LocalStateHealthReport): string {
  return report.hasAttention ? `${formatNumber(report.attentionCount)} need attention` : "Healthy";
}

function canClearLocalStateRecoveryItem(item: LocalStateHealthItem): boolean {
  return (
    item.clearable && (item.needsAttention || (item.id === "manual-price-overrides" && item.loaded))
  );
}

export function LocalStateRecoveryPanel({
  visible,
  report,
  notice,
  pendingClearId,
  onExport,
  onBeginClear,
  onCancelClear,
  onConfirmClearItem,
  onConfirmClearInvalid
}: LocalStateRecoveryPanelProps) {
  if (!visible) return null;
  const attentionItems = report.items.filter((item) => item.needsAttention);

  return (
    <section className="service-group local-state-recovery-panel" aria-label="Local state recovery">
      <div className="section-title-row">
        <h2 id={LOCAL_STATE_RECOVERY_HEADING_ID} tabIndex={-1}>
          Local state recovery
        </h2>
        <span className={`status-pill ${report.hasAttention ? "warning" : "ready"}`}>
          {localStateRecoveryStatus(report)}
        </span>
      </div>
      <p
        className={`inline-status ${report.hasAttention ? "warning" : "success"}`}
        role={report.hasAttention ? "alert" : "status"}
      >
        {notice ?? "Some browser-local rewrite state fell back to defaults."}
      </p>
      <div className="price-history-summary" aria-label="Local state health summary">
        <span>Known states {formatNumber(report.itemCount)}</span>
        <span>Needs attention {formatNumber(report.attentionCount)}</span>
        <span>Report {report.generatedAt}</span>
      </div>
      <div className="market-sync-bar">
        <button type="button" onClick={onExport}>
          Export recovery report
        </button>
        {pendingClearId === "invalid-all" ? (
          <>
            <button type="button" className="danger-button" onClick={onConfirmClearInvalid}>
              Confirm clear invalid local data
            </button>
            <button type="button" onClick={onCancelClear}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="danger-button"
            disabled={!attentionItems.some((item) => item.clearable)}
            onClick={() => onBeginClear("invalid-all")}
          >
            Clear invalid local data
          </button>
        )}
      </div>
      <table className="legacy-review-table">
        <thead>
          <tr>
            <th>State</th>
            <th>Key</th>
            <th>Status</th>
            <th>Version</th>
            <th>Recovery</th>
            <th>Clear</th>
          </tr>
        </thead>
        <tbody>
          {report.items.map((item) => {
            const pending = pendingClearId === item.id;
            return (
              <tr key={item.id}>
                <td>{item.label}</td>
                <td>
                  <code>{item.storageKey}</code>
                </td>
                <td>{localStateStatusLabel(item)}</td>
                <td>
                  v{formatNumber(item.expectedVersion)}
                  {item.foundVersion != null ? ` (found v${formatNumber(item.foundVersion)})` : ""}
                </td>
                <td>{localStateReasonLabel(item)}</td>
                <td>
                  {canClearLocalStateRecoveryItem(item) ? (
                    pending ? (
                      <>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => onConfirmClearItem(item.id)}
                        >
                          Confirm clear {item.label}
                        </button>
                        <button type="button" onClick={onCancelClear}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => onBeginClear(item.id)}
                      >
                        Clear {item.label}
                      </button>
                    )
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

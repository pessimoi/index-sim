import { Component, type ReactNode } from "react";
import {
  SAFE_SESSION_NOTICE,
  openWithSavedDataIgnoredForSession,
  reloadSimulator
} from "../../application-recovery";
import { APP_STARTUP_ERROR_MESSAGE, ApplicationEntryLoadError } from "../../startup-guard-core";
import type {
  NonDurableReason,
  SessionOnlyExitProtectionSnapshot
} from "../../controllers/session-only-exit-protection";

export const APPLICATION_RENDER_ERROR_MESSAGE =
  "The simulator encountered an unexpected display error and could not continue safely.";

export interface ApplicationFailureScreenProps {
  message?: string;
  onReload?: () => void;
  onOpenWithSavedDataIgnored?: () => void;
}

function defaultReload(): void {
  reloadSimulator(window);
}

function defaultOpenWithSavedDataIgnored(): void {
  openWithSavedDataIgnoredForSession(window);
}

export function ApplicationFailureScreen({
  message = APPLICATION_RENDER_ERROR_MESSAGE,
  onReload = defaultReload,
  onOpenWithSavedDataIgnored = defaultOpenWithSavedDataIgnored
}: ApplicationFailureScreenProps) {
  return (
    <main className="app-shell" data-app-startup-state="error">
      <section className="fatal" role="alert">
        <h1>2004scape Combat Simulator</h1>
        <p>{message}</p>
        <p>Reload to try again. Your saved browser data will not be cleared automatically.</p>
        <div className="fatal-actions">
          <button type="button" onClick={onReload}>
            Reload simulator
          </button>
          <button type="button" onClick={onOpenWithSavedDataIgnored}>
            Open with saved data ignored for this session
          </button>
        </div>
      </section>
    </main>
  );
}

export interface SafeSessionNoticeProps {
  guard?: SessionOnlyExitProtectionSnapshot;
  onDownloadWorkspace?: () => void;
}

function nonDurableReasonLabel(reason: NonDurableReason): string {
  if (reason === "saved-data-ignored") return "Saved browser data is ignored in this tab.";
  if (reason === "storage-unavailable") return "Browser storage is unavailable.";
  return "A browser save could not be completed.";
}

export function SafeSessionNotice({ guard, onDownloadWorkspace }: SafeSessionNoticeProps = {}) {
  const armed = guard?.armed === true;
  const hasChanges = (guard?.sessionOnlyChangeCount ?? 0) > 0;
  const title = armed
    ? "Unsaved session-only changes"
    : hasChanges
      ? "Session-only changes backed up"
      : "Session-only safe mode";

  return (
    <section className="safe-session-notice" role="status" aria-label={title}>
      <div className="safe-session-notice-copy">
        <strong>{title}</strong>
        {armed ? (
          <>
            <span>
              Changes in this tab are not stored durably and can be lost when you reload or close
              it.
            </span>
            <span>
              {`${guard.reasons.map(nonDurableReasonLabel).join(" ")} Affected Workspace areas: ${guard.affectedAreas.length}.`}
            </span>
          </>
        ) : hasChanges ? (
          <span>
            These changes remain session-only. Keep the downloaded Workspace file before closing or
            reloading this tab.
          </span>
        ) : (
          <span>{SAFE_SESSION_NOTICE}</span>
        )}
        {guard?.backupOutcome && (
          <span className={guard.backupOutcome.status === "failed" ? "error-copy" : undefined}>
            {guard.backupOutcome.message}
          </span>
        )}
        {guard?.sensitiveAreaOmitted && (
          <span>
            The last Hiscores player was not included. Review the privacy option in Settings.
          </span>
        )}
      </div>
      {armed && onDownloadWorkspace && (
        <button type="button" onClick={onDownloadWorkspace}>
          Download full Workspace backup
        </button>
      )}
    </section>
  );
}

interface ApplicationErrorBoundaryProps {
  children: ReactNode;
  onReload?: () => void;
  onOpenWithSavedDataIgnored?: () => void;
}

interface ApplicationErrorBoundaryState {
  failed: boolean;
  message?: string;
}

export class ApplicationErrorBoundary extends Component<
  ApplicationErrorBoundaryProps,
  ApplicationErrorBoundaryState
> {
  state: ApplicationErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(error: unknown): ApplicationErrorBoundaryState {
    return {
      failed: true,
      message: error instanceof ApplicationEntryLoadError ? APP_STARTUP_ERROR_MESSAGE : undefined
    };
  }

  render() {
    if (this.state.failed) {
      return (
        <ApplicationFailureScreen
          message={this.state.message}
          onReload={this.props.onReload}
          onOpenWithSavedDataIgnored={this.props.onOpenWithSavedDataIgnored}
        />
      );
    }
    return this.props.children;
  }
}

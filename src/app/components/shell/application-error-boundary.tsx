import { Component, type ReactNode } from "react";
import {
  SAFE_SESSION_NOTICE,
  openWithSavedDataIgnoredForSession,
  reloadSimulator
} from "../../application-recovery";

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

export function SafeSessionNotice() {
  return (
    <section className="safe-session-notice" role="status" aria-label="Session-only safe mode">
      <strong>Session-only safe mode</strong>
      <span>{SAFE_SESSION_NOTICE}</span>
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
}

export class ApplicationErrorBoundary extends Component<
  ApplicationErrorBoundaryProps,
  ApplicationErrorBoundaryState
> {
  state: ApplicationErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ApplicationErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <ApplicationFailureScreen
          onReload={this.props.onReload}
          onOpenWithSavedDataIgnored={this.props.onOpenWithSavedDataIgnored}
        />
      );
    }
    return this.props.children;
  }
}

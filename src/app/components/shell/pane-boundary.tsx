import { Component, Suspense, useCallback, useEffect, type ReactNode } from "react";
import { reloadSimulator } from "../../application-recovery";
import type { PaneFamily, PaneLoadState } from "../../state/pane-delivery";

export const PANE_LOAD_FAILURE_MESSAGE =
  "This pane could not be loaded. Reload the simulator to try again.";
export const PANE_RENDER_FAILURE_MESSAGE =
  "This pane stopped unexpectedly. Try this pane again or reload the simulator.";

function PaneLoadingState({
  active,
  label,
  onLoadStateChange
}: {
  active: boolean;
  label: string;
  onLoadStateChange(state: PaneLoadState): void;
}) {
  useEffect(() => {
    onLoadStateChange("loading");
  }, [onLoadStateChange]);
  return (
    <section className="pane-delivery-state pane-loading-state" aria-label={label} hidden={!active}>
      <p
        role={active ? "status" : undefined}
        aria-label={active ? label : undefined}
        aria-live={active ? "polite" : undefined}
      >
        Loading {label}…
      </p>
    </section>
  );
}

function PaneReadyMarker({ children, onReady }: { children: ReactNode; onReady(): void }) {
  useEffect(onReady, [onReady]);
  return children;
}

interface PaneErrorBoundaryProps {
  active: boolean;
  children: ReactNode;
  focusTargetId?: string;
  label: string;
  loadingFallback?: ReactNode;
  moduleLoaded(): boolean;
  onLoadStateChange(state: PaneLoadState): void;
  onReload?(): void;
  retryEnabled?: boolean;
}

interface PaneErrorBoundaryState {
  failed: boolean;
  retryPending: boolean;
}

export class PaneErrorBoundary extends Component<PaneErrorBoundaryProps, PaneErrorBoundaryState> {
  state: PaneErrorBoundaryState = { failed: false, retryPending: false };

  static getDerivedStateFromError(): Partial<PaneErrorBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onLoadStateChange("failed");
  }

  private readonly retry = (): void => {
    this.props.onLoadStateChange("loading");
    this.setState({ failed: false, retryPending: true });
  };

  private readonly ready = (): void => {
    this.props.onLoadStateChange("ready");
    if (!this.state.retryPending) return;
    this.setState({ retryPending: false }, () => {
      if (!this.props.focusTargetId) return;
      window.requestAnimationFrame(() =>
        document.getElementById(this.props.focusTargetId!)?.focus({ preventScroll: true })
      );
    });
  };

  private readonly reload = (): void => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    reloadSimulator(window);
  };

  render() {
    if (this.state.failed) {
      const canRetry = this.props.retryEnabled !== false && this.props.moduleLoaded();
      return (
        <section
          className="pane-delivery-state pane-failure-state"
          aria-label={this.props.label}
          role={this.props.active ? "alert" : undefined}
          hidden={!this.props.active}
        >
          <h2>{this.props.label} unavailable</h2>
          <p>{canRetry ? PANE_RENDER_FAILURE_MESSAGE : PANE_LOAD_FAILURE_MESSAGE}</p>
          <div className="pane-failure-actions">
            {canRetry ? (
              <button type="button" onClick={this.retry}>
                Try pane again
              </button>
            ) : null}
            <button type="button" onClick={this.reload}>
              Reload simulator
            </button>
          </div>
        </section>
      );
    }
    const content = <PaneReadyMarker onReady={this.ready}>{this.props.children}</PaneReadyMarker>;
    return this.props.loadingFallback ? (
      <Suspense fallback={this.props.loadingFallback}>{content}</Suspense>
    ) : (
      content
    );
  }
}

interface PaneBoundaryProps extends Omit<PaneErrorBoundaryProps, "onLoadStateChange"> {
  family: PaneFamily;
  onLoadStateChange(family: PaneFamily, state: PaneLoadState): void;
}

export function PaneBoundary({
  active,
  children,
  family,
  focusTargetId = "workbench-active-panel",
  label,
  moduleLoaded,
  onLoadStateChange,
  onReload,
  retryEnabled = true
}: PaneBoundaryProps) {
  const reportLoadState = useCallback(
    (state: PaneLoadState) => onLoadStateChange(family, state),
    [family, onLoadStateChange]
  );
  return (
    <PaneErrorBoundary
      active={active}
      focusTargetId={focusTargetId}
      label={label}
      loadingFallback={
        <PaneLoadingState active={active} label={label} onLoadStateChange={reportLoadState} />
      }
      moduleLoaded={moduleLoaded}
      onLoadStateChange={reportLoadState}
      onReload={onReload}
      retryEnabled={retryEnabled}
    >
      {children}
    </PaneErrorBoundary>
  );
}

const ignorePaneLoadState = (): void => undefined;

export function NestedPaneBoundary({
  active,
  children,
  label,
  moduleLoaded,
  onReload
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  moduleLoaded(): boolean;
  onReload?(): void;
}) {
  return (
    <PaneErrorBoundary
      active={active}
      label={label}
      loadingFallback={
        <PaneLoadingState active={active} label={label} onLoadStateChange={ignorePaneLoadState} />
      }
      moduleLoaded={moduleLoaded}
      onLoadStateChange={ignorePaneLoadState}
      onReload={onReload}
      retryEnabled={false}
    >
      {children}
    </PaneErrorBoundary>
  );
}

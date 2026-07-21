import { useEffect, useRef } from "react";
import type { SharedSetupReviewViewModel } from "../../view-models/app-shell";
import { SetupChangeReviewDetails } from "./setup-import-review";

export function SharedSetupReview({
  viewModel,
  onLoad,
  onRefresh,
  onDismiss
}: {
  viewModel: SharedSetupReviewViewModel;
  onLoad(): void;
  onRefresh(): void;
  onDismiss(): void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (viewModel.status !== "ready") return;
    const frameId = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frameId);
  }, [viewModel.status]);
  return (
    <section className={`shared-setup-strip ${viewModel.tone}`} aria-label="Shared setup review">
      <div className="section-title-row">
        <h2 ref={headingRef} tabIndex={-1}>
          Shared setup
        </h2>
        <span
          className={`status-pill ${
            viewModel.status === "ready" && !viewModel.stale ? "ready" : "warning"
          }`}
        >
          {viewModel.statusLabel}
        </span>
      </div>
      {viewModel.status === "error" ? (
        <p role="alert">{viewModel.message}</p>
      ) : (
        <>
          <p>{viewModel.targetLine}</p>
          <div className="shared-setup-summary" aria-label="Shared setup summary">
            <span>Player levels included</span>
            <span>{viewModel.cannonLabel}</span>
            <span>{viewModel.lootChoiceLabel}</span>
            <span>Uses your current prices</span>
          </div>
          <p className={`inline-status ${viewModel.contextTone}`} role="status">
            {viewModel.contextMessage}
          </p>
          {viewModel.droppedLootWarning && (
            <p className="inline-status warning" role="status">
              {viewModel.droppedLootWarning}
            </p>
          )}
          {viewModel.stale && (
            <p className="inline-status warning" role="alert">
              The included setup state changed after this comparison. Refresh before loading.
            </p>
          )}
          {!viewModel.stale && viewModel.changeReview.changeCount === 0 && (
            <p className="inline-status neutral">This link has no applicable changes.</p>
          )}
          <SetupChangeReviewDetails
            groups={viewModel.changeReview.groups}
            includedScope={viewModel.changeReview.includedScope}
            excludedScope={viewModel.changeReview.excludedScope}
            includedLabel="Included in this link"
          />
        </>
      )}
      <div className="shared-setup-actions">
        {viewModel.status === "ready" && viewModel.stale && (
          <button type="button" onClick={onRefresh}>
            Refresh comparison
          </button>
        )}
        {viewModel.status === "ready" && !viewModel.stale && (
          <button type="button" onClick={onLoad} disabled={!viewModel.canLoad}>
            Load setup
          </button>
        )}
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}

import type { SharedSetupReviewViewModel } from "../../view-models/app-shell";

export function SharedSetupReview({
  viewModel,
  onLoad,
  onDismiss
}: {
  viewModel: SharedSetupReviewViewModel;
  onLoad(): void;
  onDismiss(): void;
}) {
  return (
    <section className={`shared-setup-strip ${viewModel.tone}`} aria-label="Shared setup review">
      <div className="section-title-row">
        <h2>Shared setup</h2>
        <span className={`status-pill ${viewModel.status === "ready" ? "ready" : ""}`}>
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
          {viewModel.gameDataWarning && (
            <p className="inline-status warning" role="status">
              {viewModel.gameDataWarning}
            </p>
          )}
          {viewModel.droppedLootWarning && (
            <p className="inline-status warning" role="status">
              {viewModel.droppedLootWarning}
            </p>
          )}
        </>
      )}
      <div className="shared-setup-actions">
        {viewModel.status === "ready" && (
          <button type="button" onClick={onLoad}>
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

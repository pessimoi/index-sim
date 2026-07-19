import type { SetupImportReviewViewModel } from "../../view-models/setup-import-review";

export interface SetupImportReviewProps {
  viewModel: SetupImportReviewViewModel;
  onApply(reviewId: number): void;
  onDismiss(reviewId: number): void;
}

export function SetupImportReview({ viewModel, onApply, onDismiss }: SetupImportReviewProps) {
  return (
    <section className="setup-import-review" aria-label="Setup import review">
      <span className="visually-hidden" role="status" aria-live="polite">
        Setup ready for review.
      </span>
      <div className="setup-import-review-heading">
        <div>
          <span className="eyebrow">Validated setup file</span>
          <h2>Review imported setup</h2>
        </div>
        <span className="status-pill ready">Ready to apply</span>
      </div>
      <dl className="setup-import-review-summary">
        {viewModel.rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className={`inline-status ${viewModel.contextTone}`} role="status">
        {viewModel.contextMessage}
      </p>
      <p>{viewModel.consequence}</p>
      <div className="setup-import-review-actions">
        <button type="button" className="primary-action" onClick={() => onApply(viewModel.id)}>
          Apply imported setup
        </button>
        <button type="button" onClick={() => onDismiss(viewModel.id)}>
          Dismiss
        </button>
      </div>
    </section>
  );
}

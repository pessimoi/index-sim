import type { LocalStateAttentionViewModel } from "../../view-models/local-state-attention";

export interface LocalStateAttentionBannerProps {
  viewModel: LocalStateAttentionViewModel;
  onReview: () => void;
}

export function LocalStateAttentionBanner({ viewModel, onReview }: LocalStateAttentionBannerProps) {
  if (!viewModel.visible) return null;

  const titleId = `local-state-attention-${viewModel.kind}-title`;
  return (
    <aside
      className={`local-state-attention-banner ${viewModel.kind}`}
      aria-labelledby={titleId}
      aria-live={viewModel.kind === "conflict" || viewModel.kind === "mixed" ? "polite" : undefined}
    >
      <div className="local-state-attention-copy">
        <h2 id={titleId}>{viewModel.title}</h2>
        <p>{viewModel.message}</p>
        {viewModel.affectedLabels.length > 0 && (
          <p className="local-state-attention-areas">
            Affected: {viewModel.affectedLabels.join(", ")}
          </p>
        )}
      </div>
      <button type="button" onClick={onReview}>
        {viewModel.reviewLabel ?? "Review local data"}
      </button>
    </aside>
  );
}

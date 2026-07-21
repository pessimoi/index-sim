import { useState } from "react";
import type { SetupChangeGroup } from "../../state/setup-transfer-changes";
import type { SetupImportReviewViewModel } from "../../view-models/setup-import-review";

export interface SetupImportReviewProps {
  viewModel: SetupImportReviewViewModel;
  onApply(reviewId: number): void;
  onRefresh(reviewId: number): void;
  onDismiss(reviewId: number): void;
}

function ChangeRows({ group }: { group: SetupChangeGroup }) {
  if (group.changes.length === 0) return null;
  return (
    <ul className="setup-import-change-list">
      {group.changes.map((change) => (
        <li key={change.id}>
          <strong>{change.label}</strong>
          <dl>
            <div>
              <dt>Current</dt>
              <dd aria-label={change.current.accessible}>{change.current.display}</dd>
            </div>
            <div>
              <dt>Incoming</dt>
              <dd aria-label={change.incoming.accessible}>{change.incoming.display}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function CollectionEntryDisclosure({
  group,
  open,
  onToggle
}: {
  group: SetupChangeGroup;
  open: boolean;
  onToggle(): void;
}) {
  return (
    <section className="setup-import-collection-entry">
      <button
        type="button"
        className="setup-import-collection-trigger"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{group.label}</span>
        <span className={`setup-import-change-status ${group.status ?? "unchanged"}`}>
          {group.status ?? "unchanged"} · {group.changeCount}
        </span>
      </button>
      {open && (
        <div className="setup-import-collection-content">
          <ChangeRows group={group} />
          {group.children.map((child) => (
            <ChangeGroupDisclosure key={child.id} group={child} />
          ))}
        </div>
      )}
    </section>
  );
}

function ChangeGroupDisclosure({ group }: { group: SetupChangeGroup }) {
  const changedCollectionEntries = group.children.filter(
    (child) => child.collectionEntry && child.status !== "unchanged"
  );
  const [openCollectionEntryId, setOpenCollectionEntryId] = useState<string | null>(() =>
    changedCollectionEntries.length === 1 ? changedCollectionEntries[0]!.id : null
  );
  return (
    <details className="setup-import-change-group" open={group.changeCount > 0}>
      <summary>
        <span>{group.label}</span>
        <span>{group.changeCount > 0 ? `${group.changeCount} changes` : "No changes"}</span>
      </summary>
      <div className="setup-import-change-group-content">
        <ChangeRows group={group} />
        {group.children.map((child) =>
          child.collectionEntry ? (
            <CollectionEntryDisclosure
              key={child.id}
              group={child}
              open={openCollectionEntryId === child.id}
              onToggle={() =>
                setOpenCollectionEntryId((current) => (current === child.id ? null : child.id))
              }
            />
          ) : (
            <ChangeGroupDisclosure key={child.id} group={child} />
          )
        )}
      </div>
    </details>
  );
}

export function SetupChangeReviewDetails({
  groups,
  includedScope,
  excludedScope,
  includedLabel = "Included in this transfer"
}: {
  groups: readonly SetupChangeGroup[];
  includedScope: readonly string[];
  excludedScope: readonly string[];
  includedLabel?: string;
}) {
  return (
    <>
      <div className="setup-import-scope">
        <details open>
          <summary>
            {includedLabel} ({includedScope.length})
          </summary>
          <ul>
            {includedScope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
        <details>
          <summary>Not included ({excludedScope.length})</summary>
          <ul>
            {excludedScope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </div>
      <div className="setup-import-change-groups">
        {groups.map((group) => (
          <ChangeGroupDisclosure key={group.id} group={group} />
        ))}
      </div>
    </>
  );
}

export function SetupImportReview({
  viewModel,
  onApply,
  onRefresh,
  onDismiss
}: SetupImportReviewProps) {
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
        <span className={`status-pill ${viewModel.statusTone}`}>{viewModel.statusLabel}</span>
      </div>
      <dl className="setup-import-review-summary">
        <div>
          <dt>Artifact</dt>
          <dd>{viewModel.artifactLabel}</dd>
        </div>
        <div>
          <dt>Applicable changes</dt>
          <dd>{viewModel.changeSummary}</dd>
        </div>
      </dl>
      <p className={`inline-status ${viewModel.contextTone}`} role="status">
        {viewModel.contextMessage}
      </p>
      <p>
        Combat setup files replace setup, custom-monster, cannon and Dense preferences. They are not
        full Workspace backups and do not include loot or prices.
      </p>
      {viewModel.staleMessage && (
        <p className="inline-status warning" role="status">
          {viewModel.staleMessage}
        </p>
      )}
      {viewModel.noChangesMessage && (
        <p className="inline-status neutral">{viewModel.noChangesMessage}</p>
      )}
      <SetupChangeReviewDetails
        groups={viewModel.groups}
        includedScope={viewModel.includedScope}
        excludedScope={viewModel.excludedScope}
        includedLabel="Included in this file"
      />
      <p>{viewModel.consequence}</p>
      <div className="setup-import-review-actions">
        {viewModel.stale && (
          <button type="button" className="primary-action" onClick={() => onRefresh(viewModel.id)}>
            Refresh comparison
          </button>
        )}
        {!viewModel.stale && (
          <button
            type="button"
            className="primary-action"
            disabled={!viewModel.canApply}
            onClick={() => onApply(viewModel.id)}
          >
            Apply imported setup
          </button>
        )}
        <button type="button" onClick={() => onDismiss(viewModel.id)}>
          Dismiss
        </button>
      </div>
    </section>
  );
}

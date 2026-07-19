import type { ActiveSetupResetState } from "../../state/active-setup-reset";

export interface ActiveSetupResetReviewProps {
  state: ActiveSetupResetState;
  onConfirm(candidateId: number): void;
  onCancel(candidateId: number): void;
}

export function ActiveSetupResetReview({
  state,
  onConfirm,
  onCancel
}: ActiveSetupResetReviewProps) {
  const candidate = state.candidate;
  if (!candidate && !state.notice) return null;

  if (!candidate) {
    return (
      <section className="active-setup-reset-review notice" aria-label="Reset active setup review">
        <h2>Reset active setup</h2>
        <p role="status">{state.notice}</p>
      </section>
    );
  }

  const { review } = candidate;
  return (
    <section className="active-setup-reset-review" aria-label="Reset active setup review">
      <span className="visually-hidden" role="status" aria-live="polite">
        Active setup reset is ready for review.
      </span>
      <div className="active-setup-reset-heading">
        <div>
          <span className="eyebrow">Canonical Revision 274 defaults</span>
          <h2>Review active setup reset</h2>
        </div>
        <span className="status-pill ready">{review.changeCount} changes</span>
      </div>

      <dl className="active-setup-reset-context">
        <div>
          <dt>Target kept</dt>
          <dd>{review.targetLabel}</dd>
        </div>
        <div>
          <dt>Selected style kept</dt>
          <dd>{review.combatStyleLabel} remains selected</dd>
        </div>
        <div>
          <dt>Setup owner kept</dt>
          <dd>{review.ownerLabel}</dd>
        </div>
        <div>
          <dt>Style caches reset</dt>
          <dd>Melee, Ranged and Magic</dd>
        </div>
      </dl>

      <p className="active-setup-reset-protected">
        Saved setups, unrelated custom setups, Cannon preferences, prices and histories are kept.
      </p>
      <p className="active-setup-reset-planner-note">
        Reset levels may make Planner adjust incompatible XP or unlocked targets using its existing
        visible integrity notice.
      </p>

      <div className="active-setup-reset-groups">
        {review.groups.map((group) => (
          <section key={group.id} className="active-setup-reset-group">
            <h3>
              <span>{group.label}</span>
              <span>{group.changeCount} changed</span>
            </h3>
            {group.changes.length > 0 ? (
              <ul>
                {group.changes.map((change) => (
                  <li
                    key={change.id}
                    aria-label={`${change.label}: ${change.currentValue} to ${change.defaultValue}`}
                  >
                    <span>{change.label}</span>
                    <span className="active-setup-reset-value-change">
                      <span>{change.currentValue}</span>
                      <span aria-hidden="true">→</span>
                      <span>{change.defaultValue}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {group.subgroups.map((subgroup) => (
              <section key={subgroup.id} className="active-setup-reset-subgroup">
                <h4>{subgroup.label}</h4>
                <ul>
                  {subgroup.changes.map((change) => (
                    <li
                      key={change.id}
                      aria-label={`${subgroup.label} ${change.label}: ${change.currentValue} to ${change.defaultValue}`}
                    >
                      <span>{change.label}</span>
                      <span className="active-setup-reset-value-change">
                        <span>{change.currentValue}</span>
                        <span aria-hidden="true">→</span>
                        <span>{change.defaultValue}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </section>
        ))}
      </div>

      <div className="active-setup-reset-actions">
        <button type="button" className="primary-action" onClick={() => onConfirm(candidate.id)}>
          Reset active setup
        </button>
        <button type="button" onClick={() => onCancel(candidate.id)}>
          Cancel
        </button>
      </div>
    </section>
  );
}

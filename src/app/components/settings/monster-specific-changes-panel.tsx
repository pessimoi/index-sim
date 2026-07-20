import { useId, useMemo, useRef, useState } from "react";
import type { MonsterSpecificRemovalCandidate } from "../../state/monster-specific-changes";
import {
  MONSTER_SPECIFIC_CHANGE_KINDS,
  MONSTER_SPECIFIC_CHANGE_LABELS,
  type MonsterSpecificChangeKind,
  type MonsterSpecificChangeRowViewModel,
  type MonsterSpecificChangesViewModel
} from "../../view-models/monster-specific-changes";

export interface MonsterSpecificChangesPanelModel {
  inventory: MonsterSpecificChangesViewModel;
  removalCandidate: MonsterSpecificRemovalCandidate | null;
  notice: { tone: "neutral" | "success" | "warning" | "error"; message: string } | null;
  sessionOnlyAvailable: boolean;
}

export interface MonsterSpecificChangesPanelActions {
  reviewCategory(monsterId: string, kind: MonsterSpecificChangeKind): void;
  reviewRemoval(monsterId: string, trigger: HTMLButtonElement): void;
  cancelRemoval(): void;
  confirmRemoval(mode: "durable" | "session-only"): void;
}

export interface MonsterSpecificChangesPanelProps {
  model: MonsterSpecificChangesPanelModel;
  actions: MonsterSpecificChangesPanelActions;
}

function rowMatches(
  row: MonsterSpecificChangeRowViewModel,
  search: string,
  kind: "all" | MonsterSpecificChangeKind
): boolean {
  const normalized = search.trim().toLocaleLowerCase();
  const categoryMatch = kind === "all" || row.categories.some((category) => category.kind === kind);
  const searchMatch =
    normalized.length === 0 ||
    row.monsterName.toLocaleLowerCase().includes(normalized) ||
    row.categories.some((category) =>
      `${category.label} ${category.summary}`.toLocaleLowerCase().includes(normalized)
    );
  return categoryMatch && searchMatch;
}

export function MonsterSpecificChangesPanel({ model, actions }: MonsterSpecificChangesPanelProps) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | MonsterSpecificChangeKind>("all");
  const filterId = useId();
  const categoryId = useId();
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const rows = useMemo(
    () => model.inventory.rows.filter((row) => rowMatches(row, search, kind)),
    [kind, model.inventory.rows, search]
  );

  const cancelRemoval = () => {
    const trigger = returnFocusRef.current;
    actions.cancelRemoval();
    window.requestAnimationFrame(() => trigger?.focus());
  };

  return (
    <section
      className="service-group monster-specific-changes-panel"
      aria-label="Monster-specific changes"
    >
      <div className="section-title-row">
        <h2>Monster-specific changes</h2>
        <span className={`status-pill ${model.inventory.monsterCount > 0 ? "ready" : ""}`}>
          {model.inventory.monsterCount} monsters changed
        </span>
      </div>
      <p>
        Calculations use these saved values when their monster is selected or compared. Review an
        existing owner to edit it, or remove one monster&apos;s current changes together.
      </p>
      <div className="monster-change-totals" aria-label="Monster change category totals">
        {MONSTER_SPECIFIC_CHANGE_KINDS.map((categoryKind) => (
          <span key={categoryKind}>
            {MONSTER_SPECIFIC_CHANGE_LABELS[categoryKind]}{" "}
            {model.inventory.countsByKind[categoryKind]}
          </span>
        ))}
      </div>

      {model.inventory.monsterCount === 0 ? (
        <p className="inline-status neutral">No monster-specific changes saved.</p>
      ) : (
        <>
          <div className="monster-change-filters">
            <div>
              <label htmlFor={filterId}>Filter changed monsters</label>
              <input
                id={filterId}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor={categoryId}>Change category</label>
              <select
                id={categoryId}
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as "all" | MonsterSpecificChangeKind)
                }
              >
                <option value="all">All changes</option>
                {MONSTER_SPECIFIC_CHANGE_KINDS.map((categoryKind) => (
                  <option key={categoryKind} value={categoryKind}>
                    {MONSTER_SPECIFIC_CHANGE_LABELS[categoryKind]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="inline-status neutral">No changed monsters match these filters.</p>
          ) : (
            <div className="monster-change-list" aria-label="Changed monsters">
              {rows.map((row) => (
                <article
                  className="monster-change-row"
                  key={row.monsterId}
                  aria-label={`${row.monsterName}: ${row.categories.map((item) => item.label).join(", ")}`}
                >
                  <div className="monster-change-row-heading">
                    <h3>{row.monsterName}</h3>
                    {row.monsterLevel != null ? <span>Level {row.monsterLevel}</span> : null}
                    {row.activeTarget ? (
                      <span className="status-pill ready">Current target</span>
                    ) : null}
                  </div>
                  <div className="monster-change-categories">
                    {row.categories.map((category) => (
                      <div className="monster-change-category" key={category.kind}>
                        <span>
                          <strong>{category.label}</strong> · {category.summary}
                        </span>
                        {category.reviewActionLabel ? (
                          <button
                            type="button"
                            aria-label={category.reviewActionLabel}
                            onClick={() => actions.reviewCategory(row.monsterId, category.kind)}
                          >
                            Review
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <details className="technical-details">
                    <summary>Technical details</summary>
                    <dl>
                      <div>
                        <dt>Monster ID</dt>
                        <dd>
                          <code>{row.monsterId}</code>
                        </dd>
                      </div>
                    </dl>
                  </details>
                  <button
                    type="button"
                    aria-label={`Review removal for ${row.monsterName}`}
                    onClick={(event) => {
                      returnFocusRef.current = event.currentTarget;
                      actions.reviewRemoval(row.monsterId, event.currentTarget);
                    }}
                  >
                    Review removal
                  </button>

                  {model.removalCandidate?.monsterId === row.monsterId ? (
                    <section
                      className="monster-change-removal-review"
                      aria-label={`Remove all changes for ${row.monsterName}`}
                    >
                      <h4>Remove all changes for {row.monsterName}?</h4>
                      <p>
                        This removes{" "}
                        {model.removalCandidate.kinds
                          .map((item) => MONSTER_SPECIFIC_CHANGE_LABELS[item])
                          .join(", ")}
                        .
                      </p>
                      <p>
                        Default setup, other monsters and saved comparison setups are kept. Current
                        calculations update when this is the active monster.
                      </p>
                      {model.removalCandidate.sourceProjection.activeMonsterId === row.monsterId &&
                      model.removalCandidate.sourceProjection.setupMode === "custom" ? (
                        <p>The selected target stays active and its editor switches to Default.</p>
                      ) : null}
                      <div className="market-sync-bar">
                        <button type="button" onClick={() => actions.confirmRemoval("durable")}>
                          Remove all changes
                        </button>
                        <button type="button" onClick={cancelRemoval}>
                          Cancel
                        </button>
                        {model.sessionOnlyAvailable ? (
                          <button
                            type="button"
                            onClick={() => actions.confirmRemoval("session-only")}
                          >
                            Remove for this session
                          </button>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {model.notice ? (
        <p
          className={`inline-status ${model.notice.tone}`}
          role={model.notice.tone === "error" ? "alert" : "status"}
        >
          {model.notice.message}
        </p>
      ) : null}
    </section>
  );
}

export default MonsterSpecificChangesPanel;

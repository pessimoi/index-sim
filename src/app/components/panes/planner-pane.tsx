import { useEffect, useRef, useState } from "react";
import type { PlannerGearSlot, PlannerMetric, PlannerSkill } from "@/domain/planner";
import { PLANNER_METRICS, plannerMetricLabel, type PlannerUiState } from "../../state/planner";
import {
  type PlannerGearPoolEditorViewModel,
  type PlannerNoticeAction,
  type PlannerPanelViewModel,
  type PlannerSkillInputViewModel
} from "../../view-models/planner";
import type { PlannerCalculationPresentation } from "../../controllers/use-planner-calculation";
import { formatNumber, signedDecimal } from "../../view-models/formatting";
import { MetricList } from "../app-presenters";
import { NumberField, OptionalNumberField, ReadOnlyField, SelectField } from "../form-fields";
import { formatDelta } from "../presentation-formatters";

const PLANNER_METRIC_OPTIONS: Array<{ id: PlannerMetric; label: string }> = PLANNER_METRICS.map(
  (metric) => ({
    id: metric,
    label: plannerMetricLabel(metric)
  })
);

export interface PlannerPaneModel {
  draftState: PlannerUiState;
  panel: PlannerPanelViewModel | null;
  gearPoolEditor: PlannerGearPoolEditorViewModel | null;
  draftDirty: boolean;
  presentation: PlannerCalculationPresentation;
  computedMetric: PlannerMetric;
  combatStyleLabel: string;
  targetLabel: string;
  skillInputs: readonly PlannerSkillInputViewModel[];
  adjustmentNotice: string | null;
}

export interface PlannerPaneActions {
  setMetric(metric: PlannerMetric): void;
  setCurrentXp(skill: PlannerSkill, value: number | null): void;
  setTargetLevel(skill: PlannerSkill, value: number): void;
  setSkillLock(skill: PlannerSkill, locked: boolean): void;
  setOnlyCurrentGear(value: boolean): void;
  setAverageOverSession(value: boolean): void;
  setGearPoolItem(slot: PlannerGearSlot, itemId: string, selected: boolean): void;
  resetGearPool(slot: PlannerGearSlot): void;
  recompute(): void;
  retry(): void;
  reviewNotice(action: PlannerNoticeAction): void;
}

export interface PlannerPaneProps {
  hidden: boolean;
  model: PlannerPaneModel;
  actions: PlannerPaneActions;
}

function formatPlannerMetricValue(metricKey: PlannerMetric, value: number): string {
  if (!Number.isFinite(value)) return "-";
  return metricKey === "dps" || metricKey === "balanced"
    ? formatNumber(value, 2)
    : formatNumber(value);
}

function plannerMetricDeltaValue(model: PlannerPaneModel): string {
  if (!model.panel) return "-";
  const delta = model.panel.summary.endMetric - model.panel.summary.startMetric;
  return model.computedMetric === "dps" || model.computedMetric === "balanced"
    ? signedDecimal(delta, 2)
    : formatDelta(delta);
}

export function PlannerPane({ hidden, model, actions }: PlannerPaneProps) {
  const noticeSetId = model.panel?.notices.warningSetId ?? "";
  const defaultNoticeOpen = (model.panel?.notices.issueCount ?? 0) > 0;
  const [noticeDisclosure, setNoticeDisclosure] = useState(() => ({
    warningSetId: noticeSetId,
    open: defaultNoticeOpen
  }));
  const [gearEditorOpen, setGearEditorOpen] = useState(false);
  const [noticeNavigationFeedback, setNoticeNavigationFeedback] = useState<string | null>(null);
  const [noticeAnnouncement, setNoticeAnnouncement] = useState("");
  const announcedWarningSetIdRef = useRef("");
  const noticeFocusRequestRef = useRef(0);
  const plannerControlsRef = useRef<HTMLDivElement>(null);
  const plannerTargetsRef = useRef<HTMLDivElement>(null);
  const gearEditorSummaryRef = useRef<HTMLElement>(null);
  const gearOptionRefs = useRef(new Map<string, HTMLInputElement>());
  const noticeOpen =
    noticeDisclosure.warningSetId === noticeSetId ? noticeDisclosure.open : defaultNoticeOpen;

  useEffect(() => {
    const notices = model.panel?.notices;
    if (!notices?.rows.length || announcedWarningSetIdRef.current === notices.warningSetId) return;
    announcedWarningSetIdRef.current = notices.warningSetId;
    setNoticeAnnouncement(
      `Planner found ${notices.issueCount} ${notices.issueCount === 1 ? "issue" : "issues"} and ${notices.noteCount} ${notices.noteCount === 1 ? "note" : "notes"}.`
    );
  }, [model.panel?.notices]);

  const focusNearest = (target: HTMLElement | null): void => {
    target?.focus({ preventScroll: true });
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
      target.scrollIntoView({ block: "nearest" });
    }
  };

  const reviewNotice = (action: PlannerNoticeAction): void => {
    setNoticeNavigationFeedback(null);
    noticeFocusRequestRef.current += 1;
    const requestId = noticeFocusRequestRef.current;
    if (action.kind === "review-targets") {
      focusNearest(plannerTargetsRef.current);
      return;
    }
    if (action.kind === "review-planner-inputs") {
      focusNearest(plannerControlsRef.current);
      return;
    }
    if (action.kind === "review-gear") {
      setGearEditorOpen(true);
      window.requestAnimationFrame(() => {
        if (noticeFocusRequestRef.current !== requestId) return;
        const exact = action.itemId ? gearOptionRefs.current.get(action.itemId) : null;
        if (exact) {
          focusNearest(exact);
          return;
        }
        focusNearest(gearEditorSummaryRef.current);
        setNoticeNavigationFeedback("That item is not available in the current Planner gear pool.");
      });
      return;
    }
    actions.reviewNotice(action);
  };

  return (
    <section className="planner-pane" aria-label="Planner" hidden={hidden}>
      <div className="section-title-row">
        <h2>Planner</h2>
        <span
          className={`status-pill ${
            model.presentation.status === "building"
              ? "pending"
              : model.presentation.status === "ready"
                ? "ready"
                : ""
          }`}
        >
          {model.presentation.status}
        </span>
      </div>

      {model.adjustmentNotice && (
        <p className="inline-status planner-adjustment-notice" role="status" aria-live="polite">
          {model.adjustmentNotice}
        </p>
      )}

      <div
        className="planner-controls"
        aria-label="Planner controls"
        ref={plannerControlsRef}
        tabIndex={-1}
      >
        <div className="planner-control-grid">
          <SelectField
            label="Optimize metric"
            value={model.draftState.metric}
            options={PLANNER_METRIC_OPTIONS}
            onChange={(value) => {
              if (PLANNER_METRICS.includes(value as PlannerMetric)) {
                actions.setMetric(value as PlannerMetric);
              }
            }}
          />
          <ReadOnlyField label="Combat style" value={model.combatStyleLabel} />
          <ReadOnlyField label="Target" value={model.targetLabel} />
          <button type="button" className="planner-recompute" onClick={actions.recompute}>
            Recompute plan
          </button>
        </div>

        <div className="planner-toggle-row" aria-label="Planner gear options">
          <label className="toggle planner-mode-toggle">
            <input
              type="checkbox"
              checked={model.draftState.onlyCurrentGear}
              onChange={(event) => actions.setOnlyCurrentGear(event.target.checked)}
            />
            <span>Only current gear</span>
          </label>
          <label className="toggle planner-mode-toggle">
            <input
              type="checkbox"
              checked={model.draftState.averageOverSession}
              onChange={(event) => actions.setAverageOverSession(event.target.checked)}
            />
            <span>Avg over session</span>
          </label>
        </div>

        <div
          className="planner-skill-grid"
          aria-label="Planner skill targets"
          ref={plannerTargetsRef}
          tabIndex={-1}
        >
          {model.skillInputs.map((row) => (
            <div className="planner-skill-row" key={row.skill}>
              <div className="planner-skill-name">
                <span>{row.label}</span>
                <strong>{formatNumber(row.currentLevel)}</strong>
              </div>
              <OptionalNumberField
                label={`${row.label} current XP`}
                value={row.currentXp}
                min={row.currentXpMin}
                max={row.currentXpMax}
                placeholder={`Auto: ${row.effectiveStartXp}`}
                resetLabel="Use level floor"
                description={row.xpDescription}
                onChange={(value) => actions.setCurrentXp(row.skill, value)}
              />
              <NumberField
                label={`${row.label} target`}
                value={row.effectiveTargetLevel}
                min={row.targetMin}
                max={99}
                disabled={row.targetDisabled}
                description={row.targetDescription}
                onChange={(value) => actions.setTargetLevel(row.skill, value)}
              />
              <label className="toggle planner-lock">
                <input
                  type="checkbox"
                  checked={row.locked}
                  aria-label={`Lock ${row.label}`}
                  onChange={(event) => actions.setSkillLock(row.skill, event.target.checked)}
                />
                <span>Lock {row.label}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {model.presentation.message && (
        <div
          className={`inline-status calculation-lifecycle-message ${
            model.presentation.status === "failed" ? "error" : "warning"
          }`}
          role={model.presentation.status === "failed" ? "alert" : "status"}
          aria-live={model.presentation.status === "building" ? "polite" : undefined}
        >
          <span>{model.presentation.message}</span>
          {model.presentation.canRetry && (
            <button type="button" onClick={actions.retry}>
              {model.presentation.retryActionLabel}
            </button>
          )}
        </div>
      )}

      {model.panel ? (
        <div className="planner-output" aria-label="Planner output">
          <div className="summary-strip planner-summary" aria-label="Planner summary">
            <MetricList
              items={[
                { label: "Total XP", value: formatNumber(model.panel.summary.totalXp) },
                { label: "Steps", value: formatNumber(model.panel.summary.stepCount) },
                { label: "Phases", value: formatNumber(model.panel.summary.phaseCount) },
                { label: "Unlocks", value: formatNumber(model.panel.summary.unlockCount) },
                { label: "Start DPS", value: formatNumber(model.panel.summary.startDps, 2) },
                { label: "End DPS", value: formatNumber(model.panel.summary.endDps, 2) },
                { label: "Metric gain", value: plannerMetricDeltaValue(model) },
                { label: "Truncated", value: model.panel.summary.truncated ? "Yes" : "No" }
              ]}
            />
          </div>

          <div className="planner-output-grid">
            <section className="planner-output-section">
              <div className="section-title-row">
                <h3>Training order</h3>
                <span className="status-pill">
                  {model.panel.isEmpty
                    ? "empty"
                    : `${formatNumber(model.panel.trainingOrder.length)} phases`}
                </span>
              </div>
              {model.panel.isEmpty ? (
                <p className="empty-state">No training steps for current targets.</p>
              ) : (
                <div className="planner-table-wrap">
                  <table className="planner-table" aria-label="Planner training order">
                    <thead>
                      <tr>
                        <th>Skill</th>
                        <th className="numeric">From</th>
                        <th className="numeric">To</th>
                        <th className="numeric">XP</th>
                        <th className="numeric">DPS</th>
                        <th className="numeric">Metric</th>
                        <th className="numeric">Unlocks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.panel.trainingOrder.map((row) => (
                        <tr key={row.id}>
                          <td>{row.skillLabel}</td>
                          <td className="numeric">{formatNumber(row.from)}</td>
                          <td className="numeric">{formatNumber(row.to)}</td>
                          <td className="numeric">{formatNumber(row.xp)}</td>
                          <td className="numeric">
                            {formatNumber(row.endDps, 2)}
                            <span className="planner-delta">
                              {signedDecimal(row.endDps - row.startDps, 2)}
                            </span>
                          </td>
                          <td className="numeric">
                            {formatPlannerMetricValue(model.computedMetric, row.endMetric)}
                          </td>
                          <td className="numeric">{formatNumber(row.unlockCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="planner-output-section">
              <div className="section-title-row">
                <h3>Unlock summary</h3>
                <span className="status-pill">{formatNumber(model.panel.unlocks.length)}</span>
              </div>
              {model.panel.unlocks.length === 0 ? (
                <p className="empty-state">No gear or spell unlocks in this plan.</p>
              ) : (
                <div className="planner-table-wrap compact">
                  <table className="planner-table" aria-label="Planner unlock summary">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Slot</th>
                        <th>Type</th>
                        <th className="numeric">Level</th>
                        <th className="numeric">DPS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.panel.unlocks.map((row) => (
                        <tr key={row.id}>
                          <td>{row.itemName}</td>
                          <td>{row.slotLabel}</td>
                          <td>{row.type}</td>
                          <td className="numeric">
                            {row.reqSkillLabel} {formatNumber(row.reqLevel)}
                          </td>
                          <td className="numeric">
                            {signedDecimal(row.dpsAfter - row.dpsBefore, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="planner-visual-grid">
            <section className="planner-output-section" aria-label="Planner DPS chart">
              <div className="section-title-row">
                <h3>DPS vs cumulative XP</h3>
                <span className="status-pill">
                  {formatNumber(model.panel.chart.points.length)} points
                </span>
              </div>
              {model.panel.chart.isEmpty ? (
                <p className="empty-state">No chart points for current targets.</p>
              ) : (
                <div className="planner-chart-wrap">
                  <svg
                    className="planner-chart"
                    role="img"
                    aria-label="DPS vs cumulative XP chart"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {model.panel.chart.points.slice(1).map((point, index) => {
                      const previous = model.panel!.chart.points[index];
                      return (
                        <line
                          className="planner-chart-line"
                          key={`${previous.id}:${point.id}`}
                          x1={previous.x}
                          y1={previous.y}
                          x2={point.x}
                          y2={point.y}
                        />
                      );
                    })}
                    {model.panel.chart.points.map((point) => (
                      <circle
                        className="planner-chart-point"
                        key={point.id}
                        cx={point.x}
                        cy={point.y}
                        r="1.8"
                      >
                        <title>{`${point.label}: ${formatNumber(point.dps, 2)} DPS after ${formatNumber(point.cumXp)} XP`}</title>
                      </circle>
                    ))}
                  </svg>
                  <div className="planner-chart-scale" aria-hidden="true">
                    <span>{formatNumber(model.panel.chart.minDps, 2)} DPS</span>
                    <span>{formatNumber(model.panel.chart.maxCumXp)} XP</span>
                    <span>{formatNumber(model.panel.chart.maxDps, 2)} DPS</span>
                  </div>
                </div>
              )}
            </section>

            <section className="planner-output-section" aria-label="Planner gear timeline">
              <div className="section-title-row">
                <h3>Gear timeline</h3>
                <span className="status-pill">{formatNumber(model.panel.timeline.length)}</span>
              </div>
              {model.panel.timeline.length === 0 ? (
                <p className="empty-state">No gear unlocks in this plan.</p>
              ) : (
                <ol className="planner-timeline">
                  {model.panel.timeline.map((event) => (
                    <li key={event.id}>
                      <span>{formatNumber(event.cumXp)} XP</span>
                      <strong>{event.itemName}</strong>
                      <small>
                        {event.slotLabel} - {event.skillLabel} {formatNumber(event.level)} -{" "}
                        {signedDecimal(event.dpsDelta, 2)} DPS
                      </small>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          {model.panel.notices.rows.length > 0 ? (
            <details
              className="planner-notices"
              data-warning-set-id={model.panel.notices.warningSetId}
              aria-label={
                model.presentation.displayIsCurrent ? "Plan notices" : "Previous plan notices"
              }
              open={noticeOpen}
              onToggle={(event) => {
                if (event.currentTarget.open === noticeOpen) return;
                setNoticeDisclosure({
                  warningSetId: model.panel!.notices.warningSetId,
                  open: event.currentTarget.open
                });
              }}
            >
              <summary>
                {model.presentation.displayIsCurrent ? "Plan notices" : "Previous plan notices"} ·{" "}
                {formatNumber(model.panel.notices.issueCount)}{" "}
                {model.panel.notices.issueCount === 1 ? "issue" : "issues"} ·{" "}
                {formatNumber(model.panel.notices.noteCount)}{" "}
                {model.panel.notices.noteCount === 1 ? "note" : "notes"}
              </summary>
              <ul className="planner-notice-list">
                {model.panel.notices.rows.map((notice) => {
                  const severityLabel = notice.severity === "info" ? "Note" : "Issue";
                  const actionContext = notice.itemDisplayLabel?.name ?? notice.detail;
                  return (
                    <li
                      className={`planner-notice-row ${notice.severity}`}
                      data-notice-category={notice.category}
                      data-notice-code={notice.code}
                      key={notice.id}
                    >
                      <div className="planner-notice-heading">
                        <span>{severityLabel}</span>
                        <strong>{notice.title}</strong>
                      </div>
                      <p>{notice.detail}</p>
                      {notice.itemDisplayLabel ? (
                        <div className="planner-notice-item">
                          <span>{notice.itemDisplayLabel.name}</span>
                          <details className="technical-details">
                            <summary>Technical details</summary>
                            <dl>
                              <div>
                                <dt>Item ID</dt>
                                <dd>
                                  <code>{notice.itemDisplayLabel.technicalId}</code>
                                </dd>
                              </div>
                            </dl>
                          </details>
                        </div>
                      ) : null}
                      <div className="planner-notice-occurrences">
                        {notice.occurrences.visibleLabels.map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                        {notice.occurrences.hiddenCount > 0 ? (
                          <span>
                            {formatNumber(notice.occurrences.hiddenCount)} more occurrences
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        aria-label={`${notice.action.label}: ${actionContext}`}
                        onClick={() => reviewNotice(notice.action)}
                      >
                        {notice.action.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
          <p className="visually-hidden" role="status" aria-live="polite">
            {noticeAnnouncement}
          </p>
        </div>
      ) : model.presentation.status === "idle" && !model.gearPoolEditor ? (
        <p className="empty-state">Planner is available after bundled data loads.</p>
      ) : null}

      {model.gearPoolEditor && (
        <details
          className="planner-gear-editor"
          open={gearEditorOpen}
          onToggle={(event) => {
            if (event.currentTarget.open !== gearEditorOpen) {
              setGearEditorOpen(event.currentTarget.open);
            }
          }}
        >
          <summary ref={gearEditorSummaryRef}>
            Advanced gear pool · {formatNumber(model.gearPoolEditor.totalSelectedCount)}/
            {formatNumber(model.gearPoolEditor.totalOptionCount)}
          </summary>
          <div className="planner-gear-editor-content" aria-label="Planner gear pool editor">
            <div className="planner-gear-slots">
              {model.gearPoolEditor.slots.map((slot) => (
                <section className="planner-gear-slot" key={slot.slot}>
                  <div className="planner-gear-slot-header">
                    <h4>{slot.label}</h4>
                    <span>
                      {formatNumber(slot.selectedCount)} / {formatNumber(slot.totalCount)}
                    </span>
                    <button
                      type="button"
                      disabled={slot.selectedCount === slot.totalCount}
                      onClick={() => actions.resetGearPool(slot.slot)}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="planner-gear-options">
                    {slot.options.map((option) => (
                      <label className="planner-gear-option" key={option.id}>
                        <input
                          type="checkbox"
                          ref={(element) => {
                            if (element) gearOptionRefs.current.set(option.id, element);
                            else gearOptionRefs.current.delete(option.id);
                          }}
                          checked={option.selected}
                          aria-label={`Planner pool ${option.label}`}
                          onChange={(event) =>
                            actions.setGearPoolItem(slot.slot, option.id, event.target.checked)
                          }
                        />
                        <span>{option.label}</span>
                        <small>{option.hint}</small>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </details>
      )}
      {noticeNavigationFeedback ? (
        <p className="inline-status neutral planner-notice-navigation" role="status">
          {noticeNavigationFeedback}
        </p>
      ) : null}
    </section>
  );
}

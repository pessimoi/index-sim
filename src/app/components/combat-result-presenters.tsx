import {
  formatNumber,
  type ActiveAssumptionResetTarget,
  type ActiveAssumptionReviewTarget,
  type ActiveAssumptionsSummaryViewModel,
  type CalculationWarningViewModel,
  type HitDistributionComparisonViewModel,
  type HitDistributionViewModel,
  type StatsCombatRollDetailViewModel,
  type StatsSourceDetailViewModel
} from "../view-models/simulation";
import { MetricList } from "./app-presenters";

export function CalculationWarningSummary({
  warnings,
  label,
  title = "Price warnings"
}: {
  warnings: readonly CalculationWarningViewModel[];
  label: string;
  title?: string;
}) {
  if (!warnings.length) return null;
  const visible = warnings.slice(0, 4);
  return (
    <div className="calculation-warnings" role="status" aria-label={label}>
      <strong>{title}</strong>
      {visible.map((warning) => (
        <span className={warning.severity} key={`${warning.code}:${warning.message}`}>
          {warning.message}
        </span>
      ))}
      {warnings.length > visible.length && (
        <span>{formatNumber(warnings.length - visible.length)} more</span>
      )}
    </div>
  );
}

const STATS_SOURCE_DETAIL_METRIC_IDS = {
  "special-attack": [
    "spec-weapon",
    "hits",
    "max-hit",
    "hit-chance",
    "specs-hr",
    "dps-with-spec",
    "dps-gain",
    "dps",
    "xp-hr"
  ],
  cannon: [
    "effective-targets",
    "dps",
    "balls-hr",
    "balls-kill",
    "cannon-ranged-xp-hr",
    "ball-cost-hour",
    "ball-cost-kill",
    "cannonballs-trip",
    "sparse-state",
    "xp-hr",
    "supply-cost-hour",
    "supply-cost-kill"
  ]
} as const;

function statsSourceDetailMetricLabel(
  detail: StatsSourceDetailViewModel,
  metric: StatsSourceDetailViewModel["metrics"][number]
): string {
  if (detail.id === "special-attack" && metric.id === "dps") return "DPS gain";
  if (detail.id === "cannon" && metric.id === "dps") return "Cannon DPS";
  return metric.label;
}

function orderedStatsSourceDetailMetrics(detail: StatsSourceDetailViewModel) {
  const metricById = new Map(detail.metrics.map((metric) => [metric.id, metric]));
  const ids =
    detail.id === "special-attack"
      ? STATS_SOURCE_DETAIL_METRIC_IDS["special-attack"]
      : detail.id === "cannon"
        ? STATS_SOURCE_DETAIL_METRIC_IDS.cannon
        : detail.metrics.map((metric) => metric.id);

  return ids.flatMap((id) => {
    const metric = metricById.get(id);
    return metric ? [metric] : [];
  });
}

function HitDistributionChart({
  distribution,
  ariaLabel
}: {
  distribution: HitDistributionViewModel;
  ariaLabel: string;
}) {
  const summary = [
    { label: "Hit chance", value: distribution.hitChanceLabel, tone: "teal" },
    { label: "Expected damage", value: distribution.averageHitLabel },
    { label: "Max hit", value: distribution.maxHitLabel }
  ];
  const minWidth = Math.max(320, distribution.buckets.length * 24);

  return (
    <>
      <div className="hit-distribution-summary">
        <MetricList items={summary} />
      </div>
      <div className="hit-chart-viewport">
        <div className="hit-chart-layout" style={{ minWidth }}>
          <div className="hit-chart-y-axis" aria-hidden="true">
            <span>
              {Math.max(...distribution.buckets.map((bucket) => bucket.probability * 100)).toFixed(
                1
              )}
              %
            </span>
            <span>0%</span>
          </div>
          <div className="hit-chart-plot">
            <span className="hit-chart-gridline top" aria-hidden="true" />
            <span className="hit-chart-gridline bottom" aria-hidden="true" />
            <div
              className="hit-chart-bars"
              role="list"
              aria-label={ariaLabel}
              style={{
                gridTemplateColumns: `repeat(${distribution.buckets.length}, minmax(18px, 1fr))`
              }}
            >
              {distribution.buckets.map((bucket) => (
                <div
                  tabIndex={0}
                  className={`hit-chart-bucket ${bucket.isMiss ? "miss" : ""} ${
                    bucket.isAccurateZero ? "accurate-zero" : ""
                  } ${bucket.isMaxHit ? "max-hit" : ""}`}
                  role="listitem"
                  aria-label={bucket.ariaLabel}
                  key={bucket.id}
                >
                  <span className="hit-chart-column" aria-hidden="true">
                    <span
                      className="hit-chart-bar normal"
                      style={{ height: `${bucket.heightPercent}%` }}
                    />
                  </span>
                  <span className="hit-chart-label">{bucket.label}</span>
                  <span className="hit-chart-tooltip" aria-hidden="true">
                    <strong>
                      {bucket.isMiss
                        ? "Miss"
                        : bucket.isAccurateZero
                          ? "Accurate 0 damage"
                          : `${bucket.damage} damage`}
                    </strong>
                    <span>Exact {bucket.percentLabel}</span>
                    {bucket.cumulativeAtLeastLabel ? (
                      <span>At least {bucket.cumulativeAtLeastLabel}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function HitDistributionComparisonChart({
  comparison,
  ariaLabel
}: {
  comparison: HitDistributionComparisonViewModel;
  ariaLabel: string;
}) {
  const normal = comparison.series[0]!;
  const special = comparison.series.find((series) => series.id === "special") ?? null;
  const summary: Array<{ label: string; value: string; tone?: "teal" | "gold" }> = [
    { label: "Normal hit chance", value: normal.distribution.hitChanceLabel, tone: "teal" },
    { label: "Expected / attack", value: normal.expectedDamageLabel },
    { label: "Normal max hit", value: normal.distribution.maxHitLabel }
  ];
  if (special) {
    summary.push(
      { label: "Special connects", value: special.distribution.hitChanceLabel, tone: "gold" },
      { label: "Expected / special", value: special.expectedDamageLabel, tone: "gold" },
      { label: "Special max", value: special.distribution.maxHitLabel, tone: "gold" }
    );
  }
  if (comparison.targetHp != null) {
    summary.push({ label: "Normal KO chance", value: normal.koChanceLabel });
    if (special)
      summary.push({ label: "Special KO chance", value: special.koChanceLabel, tone: "gold" });
  }
  const minWidth = Math.max(420, comparison.buckets.length * (special ? 30 : 24));

  return (
    <>
      <div className="hit-distribution-summary comparison">
        <MetricList items={summary} />
      </div>
      <div className="hit-chart-legend" aria-label="Damage distribution series">
        <span className="normal">Normal attack</span>
        {special ? <span className="special">{special.label}</span> : null}
        {comparison.targetHpLabel ? (
          <span className="target">{comparison.targetHpLabel}</span>
        ) : null}
      </div>
      <div className="hit-chart-viewport">
        <div className="hit-chart-layout comparison" style={{ minWidth }}>
          <div className="hit-chart-y-axis" aria-hidden="true">
            <span>{comparison.maxProbabilityLabel}</span>
            <span>{comparison.middleProbabilityLabel}</span>
            <span>0%</span>
          </div>
          <div className="hit-chart-plot comparison">
            <span className="hit-chart-gridline top" aria-hidden="true" />
            <span className="hit-chart-gridline middle" aria-hidden="true" />
            <span className="hit-chart-gridline bottom" aria-hidden="true" />
            {comparison.koRegionStartPercent != null ? (
              <span
                className="hit-chart-ko-region"
                style={{ left: `${comparison.koRegionStartPercent}%` }}
                aria-hidden="true"
              />
            ) : null}
            {comparison.targetMarkerPercent != null && comparison.targetHpLabel ? (
              <span
                className="hit-chart-target-marker"
                style={{ left: `${comparison.targetMarkerPercent}%` }}
                aria-hidden="true"
              >
                <em>{comparison.targetHpLabel}</em>
              </span>
            ) : null}
            {comparison.series.map((series) => (
              <span
                className={`hit-chart-expected-marker ${series.id}`}
                style={{ left: `${series.expectedMarkerPercent}%` }}
                aria-hidden="true"
                key={series.id}
              >
                <em>{series.id === "normal" ? "AVG" : "SPEC AVG"}</em>
              </span>
            ))}
            <div
              className="hit-chart-bars"
              role="list"
              aria-label={ariaLabel}
              style={{
                gridTemplateColumns: `repeat(${comparison.buckets.length}, minmax(${special ? 24 : 18}px, 1fr))`
              }}
            >
              {comparison.buckets.map((bucket) => (
                <div
                  tabIndex={0}
                  className={`hit-chart-bucket ${bucket.isMiss ? "miss" : ""} ${
                    bucket.isAccurateZero ? "accurate-zero" : ""
                  }`}
                  role="listitem"
                  aria-label={bucket.ariaLabel}
                  key={bucket.id}
                >
                  <span className="hit-chart-column comparison" aria-hidden="true">
                    <span
                      className={`hit-chart-bar normal ${bucket.normal.isMaxHit ? "max-hit" : ""}`}
                      style={{ height: `${bucket.normal.heightPercent}%` }}
                    />
                    {bucket.special ? (
                      <span
                        className={`hit-chart-bar special ${bucket.special.isMaxHit ? "max-hit" : ""}`}
                        style={{ height: `${bucket.special.heightPercent}%` }}
                      />
                    ) : null}
                  </span>
                  <span className="hit-chart-label">{bucket.label}</span>
                  <span className="hit-chart-tooltip" aria-hidden="true">
                    <strong>
                      {bucket.isMiss
                        ? "Miss"
                        : bucket.isAccurateZero
                          ? "Accurate 0 damage"
                          : `${bucket.damage} damage`}
                    </strong>
                    <span>Normal exact {bucket.normal.percentLabel}</span>
                    {bucket.normal.cumulativeAtLeastLabel && !bucket.isMiss ? (
                      <span>
                        Normal ≥ {bucket.damage}: {bucket.normal.cumulativeAtLeastLabel}
                      </span>
                    ) : null}
                    {bucket.special && special ? (
                      <>
                        <span>Special exact {bucket.special.percentLabel}</span>
                        {bucket.special.cumulativeAtLeastLabel && !bucket.isMiss ? (
                          <span>
                            Special ≥ {bucket.damage}: {bucket.special.cumulativeAtLeastLabel}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <details className="hit-chart-data-table">
        <summary>Show exact probabilities</summary>
        <div>
          <table>
            <thead>
              <tr>
                <th scope="col">Outcome</th>
                <th scope="col">Normal exact</th>
                <th scope="col">Normal at least</th>
                {special ? <th scope="col">Special exact</th> : null}
                {special ? <th scope="col">Special at least</th> : null}
              </tr>
            </thead>
            <tbody>
              {comparison.buckets.map((bucket) => (
                <tr key={bucket.id}>
                  <th scope="row">{bucket.isMiss ? "Miss" : bucket.label}</th>
                  <td>{bucket.normal.percentLabel}</td>
                  <td>{bucket.isMiss ? "-" : bucket.normal.cumulativeAtLeastLabel}</td>
                  {special ? <td>{bucket.special?.percentLabel ?? "0.0%"}</td> : null}
                  {special ? (
                    <td>
                      {bucket.isMiss ? "-" : (bucket.special?.cumulativeAtLeastLabel ?? "0.0%")}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

export function StatsSourceDetailCard({ detail }: { detail: StatsSourceDetailViewModel }) {
  const metrics = orderedStatsSourceDetailMetrics(detail);

  return (
    <article
      className={`source-detail-card ${detail.status}`}
      role="listitem"
      aria-label={`${detail.label} detail: ${detail.statusLabel}`}
    >
      <div className="source-detail-heading">
        <div>
          <h3>{detail.label} detail</h3>
          <span>{detail.statusLabel}</span>
        </div>
      </div>
      <div className="source-detail-metrics">
        {metrics.map((metric) => (
          <div key={metric.id}>
            <span>{statsSourceDetailMetricLabel(detail, metric)}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      <CalculationWarningSummary
        warnings={detail.warnings}
        label={`${detail.label} source warnings`}
        title={`${detail.label} note`}
      />
      {detail.notes.length > 0 ? (
        <ul className="source-detail-notes">
          {detail.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      {detail.histogram && detail.histogramScopeLabel ? (
        <section
          className="source-detail-distribution"
          aria-label={`${detail.label} damage distribution`}
        >
          <div className="source-detail-distribution-heading">
            <h4>Damage distribution</h4>
            <span>{detail.histogramScopeLabel}</span>
          </div>
          <HitDistributionChart
            distribution={detail.histogram}
            ariaLabel={`${detail.label} damage distribution buckets`}
          />
        </section>
      ) : null}
    </article>
  );
}

export function StatsCombatRollDetail({ detail }: { detail: StatsCombatRollDetailViewModel }) {
  return (
    <section className="stats-panel combat-roll-panel" aria-label="Combat roll details">
      <div className="section-title-row">
        <div>
          <h2>Combat roll details</h2>
          <span className="section-subtitle">Normal attack and current result metrics</span>
        </div>
        <span className={`status-pill ${detail.status === "modeled" ? "ready" : ""}`}>
          {detail.statusLabel}
        </span>
      </div>
      <div className="combat-roll-grid" role="list" aria-label="Combat roll metrics">
        {detail.metrics.map((metric) => (
          <div
            className={`combat-roll-metric ${metric.tone}`}
            role="listitem"
            aria-label={`${metric.label}: ${metric.value}; ${metric.note}`}
            key={metric.id}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </div>
        ))}
      </div>
      <ul className="combat-roll-notes">
        {detail.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

export function ActiveAssumptionsSummary({
  summary,
  onReview,
  onReset
}: {
  summary: ActiveAssumptionsSummaryViewModel;
  onReview: (tab: ActiveAssumptionReviewTarget) => void;
  onReset: (target: ActiveAssumptionResetTarget, statusLabel: string) => void;
}) {
  const renderRow = (row: ActiveAssumptionsSummaryViewModel["visibleRows"][number]) => {
    const resetAction = row.resetAction;
    return (
      <li className={`active-assumption-row ${row.tone}`} key={row.id}>
        <div className="active-assumption-copy">
          <strong>{row.label}</strong>
          <span>{row.detail}</span>
        </div>
        <em>{row.value}</em>
        <div className="active-assumption-actions">
          <button
            type="button"
            className="compact-action"
            aria-label={`Review ${row.label}`}
            onClick={() => onReview(row.reviewTab)}
          >
            Review
          </button>
          {resetAction ? (
            <button
              type="button"
              className="compact-action"
              aria-label={resetAction.ariaLabel}
              onClick={() => onReset(resetAction.target, resetAction.statusLabel)}
            >
              {resetAction.label}
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <section className="active-assumptions-summary" aria-label="Active assumptions">
      <div className="section-title-row">
        <div>
          <h2>Active assumptions</h2>
          <span className="section-subtitle">Modifiers affecting current result</span>
        </div>
        <span className={`status-pill ${summary.hasActiveRows ? "ready" : ""}`}>
          {summary.statusLabel}
        </span>
      </div>

      {summary.hasActiveRows ? (
        <>
          <ul className="active-assumption-list">{summary.visibleRows.map(renderRow)}</ul>
          {summary.hiddenRows.length > 0 ? (
            <details className="active-assumption-more">
              <summary>+{formatNumber(summary.hiddenCount)} more</summary>
              <ul className="active-assumption-list">{summary.hiddenRows.map(renderRow)}</ul>
            </details>
          ) : null}
        </>
      ) : (
        <p className="active-assumptions-empty">{summary.statusLabel}</p>
      )}
    </section>
  );
}

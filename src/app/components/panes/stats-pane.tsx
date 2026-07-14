import { formatNumber } from "../../view-models/formatting";
import type { StatsPaneViewModel } from "../../view-models/stats";
import { StatsCombatRollDetail, StatsSourceDetailCard } from "../combat-result-presenters";

export function StatsPane({
  hidden,
  viewModel
}: {
  hidden: boolean;
  viewModel: StatsPaneViewModel;
}) {
  return (
    <section className="stats-analysis-pane" aria-label="Stats analysis" hidden={hidden}>
      <section className="stats-panel source-breakdown-panel" aria-label="Source breakdown">
        <div className="section-title-row">
          <div>
            <h2>Source breakdown</h2>
            <span className="section-subtitle">DPS, XP and supply sources</span>
          </div>
          <span className="status-pill ready">
            {formatNumber(viewModel.sourceBreakdown.rows.length)} sources
          </span>
        </div>
        <div className="source-breakdown-grid" role="list" aria-label="Source breakdown rows">
          {viewModel.sourceBreakdown.rows.map((row) => (
            <article
              className={`source-breakdown-row ${row.status}`}
              role="listitem"
              aria-label={`${row.label}: ${row.statusLabel}`}
              key={row.id}
            >
              <div className="source-breakdown-heading">
                <div>
                  <strong>{row.label}</strong>
                </div>
                <em>{row.statusLabel}</em>
              </div>
              <div className="source-breakdown-metrics">
                <div>
                  <span>DPS</span>
                  <strong>{row.dpsLabel}</strong>
                  {row.dpsDetail && <small>{row.dpsDetail}</small>}
                </div>
                <div>
                  <span>XP/hr</span>
                  <strong>{row.xpPerHourLabel}</strong>
                </div>
                <div>
                  <span>Hit %</span>
                  <strong>{row.hitChanceLabel}</strong>
                </div>
                <div>
                  <span>Max</span>
                  <strong>{row.maxHitLabel}</strong>
                </div>
                <div>
                  <span>Supply/hr</span>
                  <strong>{row.supplyCostPerHourLabel}</strong>
                </div>
                <div>
                  <span>Supply/kill</span>
                  <strong>{row.supplyCostPerKillLabel}</strong>
                </div>
              </div>
              <ul>
                {row.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="source-detail-header">
          <h3>Source details</h3>
          <span>Special attack and cannon</span>
        </div>
        <div className="source-detail-grid" role="list" aria-label="Source detail panels">
          {viewModel.sourceBreakdown.details
            .filter((detail) => detail.id === "special-attack" || detail.id === "cannon")
            .map((detail) => (
              <StatsSourceDetailCard detail={detail} key={detail.id} />
            ))}
        </div>
      </section>

      <StatsCombatRollDetail detail={viewModel.combatRollDetail} />

      <div className="stats-analysis-grid">
        <section className="stats-panel" aria-label="XP routing">
          <div className="section-title-row">
            <div>
              <h2>XP routing</h2>
              <span className="section-subtitle">Effective and skill rows</span>
            </div>
            <span className="status-pill ready">
              {viewModel.xpRouting.effectiveXpPerHourLabel} XP/hr
            </span>
          </div>
          <div className="xp-routing-chip-list" role="list" aria-label="XP routing chips">
            {viewModel.xpRouting.rows.map((row) => (
              <div
                className={`xp-routing-chip ${row.status}`}
                role="listitem"
                aria-label={`${row.label}: ${row.value}; ${row.statusLabel}; ${row.note}`}
                key={row.id}
              >
                <span>{row.label}</span>
                <strong>{row.value}</strong>
                <em>{row.statusLabel}</em>
                <small>{row.note}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="stats-panel" aria-label="Trip and banking summary">
          <div className="section-title-row">
            <div>
              <h2>Trip &amp; banking</h2>
              <span className="section-subtitle">Current effective-rate inputs</span>
            </div>
            <span className="status-pill ready">{formatNumber(viewModel.effectiveKph)} K/hr</span>
          </div>
          <div className="stats-summary-table-wrap">
            <table className="stats-summary-table" aria-label="Trip and banking metrics">
              <tbody>
                {viewModel.tripBankingSummary.rows.map((row) => (
                  <tr className={row.tone} key={row.id}>
                    <th scope="row">{row.label}</th>
                    <td>{row.value}</td>
                    <td>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

import { NumberField, SearchableSelectField } from "../form-fields";
import type { RiskAnalysisResult } from "@/domain/risk";
import { formatNumber } from "../../view-models/formatting";
import {
  formatRiskProbability,
  formatRiskRange,
  type RiskControls,
  type RiskTargetDropOption
} from "../../view-models/risk";
import type { RiskAnalysisPresentation } from "../../controllers/use-risk-analysis";

export interface RiskPaneModel {
  controls: RiskControls;
  presentation: RiskAnalysisPresentation;
  targetDropOptions: RiskTargetDropOption[];
  display: { result: RiskAnalysisResult; controls: RiskControls; fresh: boolean } | null;
  expectedTtkSec: number;
  expectedKillsPerTrip: number;
}

export interface RiskPaneActions {
  setTargetKills(value: number): void;
  setHorizonMinutes(value: number): void;
  setGpTarget(value: number): void;
  setTargetDropRowId(value: string | null): void;
  run(): void;
  cancel(): void;
}

export interface RiskPaneProps {
  hidden: boolean;
  model: RiskPaneModel;
  actions: RiskPaneActions;
}

function finiteMetric(value: number, digits = 1): string {
  return Number.isFinite(value) ? formatNumber(value, digits) : "unlimited";
}

export function RiskPane({ hidden, model, actions }: RiskPaneProps) {
  const result = model.display?.result ?? null;
  const displayControls = model.display?.controls ?? model.controls;
  const fresh = model.display?.fresh ?? false;

  return (
    <section className="risk-strip" aria-label="Risk" hidden={hidden}>
      <div className="section-title-row">
        <div>
          <h2>Risk &amp; variability</h2>
          <p className="risk-intro">
            Modeled ranges complement the current averages. They are not death odds or confidence
            intervals.
          </p>
        </div>
        <span
          className={`status-pill ${
            model.presentation.status === "building" ? "pending" : fresh ? "ready" : ""
          }`}
          aria-live="polite"
        >
          {model.presentation.status[0]!.toUpperCase() + model.presentation.status.slice(1)}
        </span>
      </div>

      <div className="risk-controls" aria-label="Risk analysis controls">
        <NumberField
          label="Target kills"
          value={model.controls.targetKills}
          min={1}
          max={10_000}
          onChange={actions.setTargetKills}
        />
        <NumberField
          label="Horizon min"
          value={model.controls.horizonMinutes}
          min={1}
          max={1_440}
          onChange={actions.setHorizonMinutes}
        />
        <NumberField
          label="GP target"
          value={model.controls.gpTarget}
          min={0}
          max={1_000_000_000}
          onChange={actions.setGpTarget}
        />
        <SearchableSelectField
          label="Target drop"
          value={model.controls.targetDropRowId ?? ""}
          options={model.targetDropOptions}
          searchPlaceholder="Search drops"
          onChange={(targetDropRowId) => actions.setTargetDropRowId(targetDropRowId || null)}
        />
        <div className="risk-actions">
          <button type="button" onClick={actions.run} disabled={!model.presentation.canRun}>
            {model.presentation.runActionLabel}
          </button>
          <button
            type="button"
            onClick={actions.cancel}
            disabled={model.presentation.status !== "building"}
          >
            Cancel
          </button>
        </div>
      </div>

      {model.presentation.message && (
        <p
          className={`inline-status calculation-lifecycle-message ${
            model.presentation.status === "failed" ? "error" : "warning"
          }`}
          role={model.presentation.status === "failed" ? "alert" : "status"}
        >
          {model.presentation.message}
        </p>
      )}

      {result ? (
        <div className="risk-results" aria-label="Modeled risk results">
          <p className="risk-range-key">
            Ranges show P10 / median / P90 from {formatNumber(result.sampleCount)} deterministic
            seeded trials.
          </p>
          <div className="summary-strip risk-summary">
            <div className="metric">
              <span>Kill time</span>
              <strong className="teal">{formatRiskRange(result.killTimeSeconds, 1, " s")}</strong>
              <small>
                Modeled mean {formatNumber(result.killTimeSeconds.mean, 1)} s; expected{" "}
                {formatNumber(model.expectedTtkSec, 1)} s
              </small>
            </div>
            <div className="metric">
              <span>Food runs out</span>
              <strong>
                {formatRiskProbability(
                  result.foodRunsOutProbability,
                  result.coverage.incomingDamage === "sampled" ? result.sampleCount : undefined
                )}
              </strong>
              <small>
                Before {formatNumber(displayControls.targetKills)} kills; not death chance
              </small>
            </div>
            <div className="metric">
              <span>Kills / trip</span>
              <strong>{formatRiskRange(result.killsPerTrip, 0)}</strong>
              <small>
                Modeled mean{" "}
                {result.killsPerTrip ? formatNumber(result.killsPerTrip.mean, 1) : "unbounded"};
                expected {finiteMetric(model.expectedKillsPerTrip, 1)}
              </small>
            </div>
            <div className="metric">
              <span>Trip cycle</span>
              <strong>{formatRiskRange(result.tripCycleMinutes, 1, " min")}</strong>
              <small>
                Mean{" "}
                {result.tripCycleMinutes
                  ? formatNumber(result.tripCycleMinutes.mean, 1) + " min"
                  : "unbounded"}
                ; includes bank and altar time
              </small>
            </div>
            <div className="metric">
              <span>{formatNumber(displayControls.horizonMinutes)} min net GP</span>
              <strong className="gold">{formatRiskRange(result.timedNetGp, 0, " GP")}</strong>
              <small>Mean {formatNumber(result.timedNetGp.mean)} GP; completed kills only</small>
            </div>
            <div className="metric">
              <span>Reach GP target</span>
              <strong>
                {formatRiskProbability(result.gpTargetProbability, result.sampleCount)}
              </strong>
              <small>
                At least {formatNumber(displayControls.gpTarget)} GP in{" "}
                {formatNumber(displayControls.horizonMinutes)} min
              </small>
            </div>
            <div className="metric">
              <span>Target drop</span>
              <strong>
                {result.targetDrop
                  ? formatRiskProbability(result.targetDrop.timedProbability)
                  : "Not selected"}
              </strong>
              <small>
                {result.targetDrop
                  ? `${result.targetDrop.name}; ${formatRiskProbability(
                      result.targetDrop.fixedKillProbability
                    )} within ${formatNumber(displayControls.targetKills)} fixed kills`
                  : "Choose an active drop and run again"}
              </small>
            </div>
          </div>

          <section className="risk-coverage" aria-label="Risk model coverage">
            <h3>Model coverage</h3>
            <dl>
              <div>
                <dt>Player damage</dt>
                <dd>{result.coverage.playerDamage}</dd>
              </div>
              <div>
                <dt>Incoming damage</dt>
                <dd>{result.coverage.incomingDamage}</dd>
              </div>
              <div>
                <dt>Incoming model</dt>
                <dd>{result.coverage.incomingModel}</dd>
              </div>
              <div>
                <dt>Loot occurrence</dt>
                <dd>{formatRiskProbability(result.coverage.lootOccurrence)}</dd>
              </div>
              <div>
                <dt>Exact quantity/correlation</dt>
                <dd>{formatRiskProbability(result.coverage.lootQuantityCorrelation)}</dd>
              </div>
            </dl>
            {result.coverage.meanOnlySources.length > 0 && (
              <p>Mean-only sources: {result.coverage.meanOnlySources.join(", ")}.</p>
            )}
          </section>

          {result.warnings.length > 0 && (
            <div className="calculation-warnings" role="status" aria-label="Risk warnings">
              <strong>Modeled-result notes</strong>
              {result.warnings.map((warning) => (
                <span className={warning.severity} key={`${warning.code}-${warning.message}`}>
                  {warning.message}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="empty-state">
          Run the analysis to model kill time, food sufficiency, trip length, timed net GP and
          target probabilities.
        </p>
      )}
    </section>
  );
}

export default RiskPane;

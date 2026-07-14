import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RiskPane,
  type RiskPaneActions,
  type RiskPaneModel
} from "../app/components/panes/risk-pane";
import type { RiskAnalysisResult } from "../domain/risk";

const noOp = () => undefined;

const actions: RiskPaneActions = {
  setTargetKills: noOp,
  setHorizonMinutes: noOp,
  setGpTarget: noOp,
  setTargetDropRowId: noOp,
  run: noOp,
  cancel: noOp
};

function resultFixture(): RiskAnalysisResult {
  return {
    modelVersion: 2,
    inputFingerprint: "risk-pane-fixture",
    sampleCount: 1_000,
    killTimeSeconds: { mean: 10, p10: 5, p50: 10, p90: 15 },
    foodRunsOutProbability: 0,
    killsPerTrip: { mean: 20, p10: 10, p50: 20, p90: 30 },
    tripCycleMinutes: { mean: 4, p10: 3, p50: 4, p90: 5 },
    timedNetGp: { mean: 100_000, p10: 50_000, p50: 100_000, p90: 150_000 },
    gpTargetProbability: 0.75,
    targetDrop: {
      rowId: "fixture-drop",
      name: "Fixture drop",
      fixedKillProbability: 0.5,
      timedProbability: 0.25
    },
    coverage: {
      playerDamage: "sampled",
      incomingDamage: "sampled",
      incomingModel: "Partial model",
      lootOccurrence: 0.8,
      lootQuantityCorrelation: 0.4,
      meanOnlySources: ["Fixture source"]
    },
    warnings: [{ code: "fixture-warning", message: "Fixture warning", severity: "warning" }]
  };
}

function model(overrides: Partial<RiskPaneModel> = {}): RiskPaneModel {
  const controls = {
    targetKills: 50,
    horizonMinutes: 60,
    gpTarget: 100_000,
    targetDropRowId: null
  };
  return {
    controls,
    runStatus: "ready",
    statusLabel: "Ready",
    targetDropOptions: [
      { id: "", label: "No target drop" },
      { id: "fixture-drop", label: "Fixture drop" }
    ],
    display: { result: resultFixture(), controls, fresh: true },
    expectedTtkSec: 11,
    expectedKillsPerTrip: 21,
    ...overrides
  };
}

function inOrder(markup: string, fragments: readonly string[]): void {
  let previous = -1;
  for (const fragment of fragments) {
    const next = markup.indexOf(fragment, previous + 1);
    expect(next, `missing or out-of-order fragment: ${fragment}`).toBeGreaterThan(previous);
    previous = next;
  }
}

describe("Risk pane", () => {
  it("keeps the hidden landmark, controls and ready output order", () => {
    const markup = renderToStaticMarkup(
      createElement(RiskPane, { hidden: true, model: model(), actions })
    );

    expect(markup.startsWith('<section class="risk-strip" aria-label="Risk" hidden="">')).toBe(
      true
    );
    inOrder(markup, [
      "<h2>Risk &amp; variability</h2>",
      'aria-label="Risk analysis controls"',
      "Target kills",
      "Horizon min",
      "GP target",
      "Target drop",
      "Run analysis",
      "Cancel",
      'aria-label="Modeled risk results"',
      "Kill time",
      "Food runs out",
      "Kills / trip",
      "Trip cycle",
      "60m net GP",
      "Reach GP target",
      'aria-label="Risk model coverage"',
      "Player damage",
      "Incoming damage",
      "Incoming model",
      "Loot occurrence",
      "Exact quantity/correlation",
      'aria-label="Risk warnings"'
    ]);
    expect(markup).toContain(
      "Ranges show P10 / median / P90 from 1,000 deterministic seeded trials."
    );
    expect(markup).toContain("&lt;0.30%");
    expect(markup).toContain("Mean-only sources: Fixture source.");
    expect(markup).toContain("Fixture warning");
  });

  it("keeps running button states and the pending status contract", () => {
    const markup = renderToStaticMarkup(
      createElement(RiskPane, {
        hidden: false,
        model: model({ runStatus: "running", statusLabel: "Running", display: null }),
        actions
      })
    );

    expect(markup).toContain('<span class="status-pill pending" aria-live="polite">Running</span>');
    expect(markup).toContain('<button type="button" disabled="">Run analysis</button>');
    expect(markup).toContain('<button type="button">Cancel</button>');
    expect(markup).toContain(
      "Run the analysis to model kill time, food sufficiency, trip length, timed net GP and target probabilities."
    );
  });

  it("retains captured controls and stale results while presenting live controls", () => {
    const capturedControls = {
      targetKills: 50,
      horizonMinutes: 60,
      gpTarget: 100_000,
      targetDropRowId: "fixture-drop"
    };
    const markup = renderToStaticMarkup(
      createElement(RiskPane, {
        hidden: false,
        model: model({
          controls: { ...capturedControls, targetKills: 75, horizonMinutes: 90 },
          statusLabel: "Stale",
          display: { result: resultFixture(), controls: capturedControls, fresh: false }
        }),
        actions
      })
    );

    expect(markup).toContain(
      "Results are stale because the setup, prices, loot policy or analysis controls changed. Run again to refresh them."
    );
    expect(markup).toContain("Before 50 kills; not death chance");
    expect(markup).toContain("60m net GP");
    expect(markup).not.toContain("90m net GP");
  });

  it("keeps unbounded and unavailable result formatting", () => {
    const result = resultFixture();
    result.killsPerTrip = null;
    result.tripCycleMinutes = null;
    result.foodRunsOutProbability = Number.NaN;
    result.targetDrop = null;
    const controls = model().controls;
    const markup = renderToStaticMarkup(
      createElement(RiskPane, {
        hidden: false,
        model: model({
          display: { result, controls, fresh: true },
          expectedKillsPerTrip: Number.POSITIVE_INFINITY
        }),
        actions
      })
    );

    expect(markup.match(/Unbounded/g)?.length).toBe(2);
    expect(markup).toContain("Unavailable");
    expect(markup).toContain("expected unlimited");
    expect(markup).toContain("Not selected");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CannonPane, type CannonPaneProps } from "../app/components/panes/cannon-pane";
import type { CannonOverlayResult } from "../domain/trip";

const output: CannonOverlayResult = {
  enabled: true,
  targets: 6,
  respawnSec: 30,
  effTargets: 3.25,
  maxBall: 30,
  ballsPerSec: 0.75,
  ballsPerHour: 2700,
  ballsPerKill: 12.345,
  ballPrice: 180,
  ballCostPerKill: 2222.1,
  ballCostPerHour: 486_000,
  cannonDps: 4.567,
  cannonOnlyDps: 6.789,
  cannonDmgPerHour: 16_441.2,
  rangedXpPerHour: 32_882.4,
  playerDps: 3.2,
  activeFrac: 0.8,
  kphNoCannon: 100,
  kphWithCannon: 125.5,
  respawnBound: true,
  idle: false,
  ballsPerTrip: 432.2,
  ballCostPerTrip: 77_796
};

const noOp = () => undefined;

function props(overrides: Partial<CannonPaneProps> = {}): CannonPaneProps {
  return {
    hidden: false,
    enabled: false,
    targets: 3,
    respawnSeconds: 60,
    tripSparseLinked: false,
    hasCustomSettings: false,
    output: null,
    effectiveXpPerHour: 12_345.4,
    effectiveNetGpPerHour: -678.9,
    hitChance: 0.6543,
    tripSparseEnabled: false,
    tripSparseMaxKph: 88.2,
    cannonReserveActive: false,
    onEnabledChange: noOp,
    onTargetsChange: noOp,
    onRespawnChange: noOp,
    onTripSparseLinkedChange: noOp,
    onReset: noOp,
    ...overrides
  };
}

function labelsInOrder(markup: string, labels: readonly string[]): void {
  let previous = -1;
  for (const label of labels) {
    const next = markup.indexOf(`<span>${label}</span>`, previous + 1);
    expect(next, `missing or out-of-order metric ${label}`).toBeGreaterThan(previous);
    previous = next;
  }
}

describe("Cannon pane", () => {
  it("renders the exact disabled control and metric contract from one section root", () => {
    const markup = renderToStaticMarkup(createElement(CannonPane, props({ hidden: true })));

    expect(markup.startsWith('<section class="cannon-strip" aria-label="Cannon" hidden="">')).toBe(
      true
    );
    expect(markup).toContain('<h2 id="cannon-heading" tabindex="-1">Dwarf multicannon</h2>');
    expect(markup).toContain('class="status-pill ">off</span>');
    expect(markup).toContain("Cannon is off for this monster.");
    expect(markup).toContain('aria-label="Cannon sparse status"');
    expect(markup).toContain('aria-label="Cannon output"');
    expect(markup).toContain('value="3"');
    expect(markup).toContain('value="60"');
    expect(markup).toContain(">Respawn (seconds)</label>");
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
    expect(markup).toContain("Reset monster cannon");

    labelsInOrder(markup, [
      "Effective targets",
      "Cannon DPS",
      "Cannon only DPS",
      "Balls/hr",
      "On-site cannon Ranged XP/hr",
      "Effective XP/hr",
      "Effective net GP/hr",
      "On-site ball cost/hr",
      "Cannonballs/trip",
      "Accuracy rule",
      "XP rule",
      "Supply impact",
      "Sparse link",
      "Inventory reserve"
    ]);
    expect(markup).toContain("<strong>0.0</strong>");
    expect(markup).toContain("<strong>0.00</strong>");
    expect(markup).toContain("<strong>12,345</strong>");
    expect(markup).toContain('<strong class="gold">-679</strong>');
    expect(markup).not.toContain("Trip on-site sparse cap (kills/hr)");
  });

  it("renders respawn-bound output, precision, tones and presentation summaries", () => {
    const markup = renderToStaticMarkup(
      createElement(
        CannonPane,
        props({
          enabled: true,
          targets: 6,
          respawnSeconds: 30,
          tripSparseLinked: true,
          hasCustomSettings: true,
          output,
          tripSparseEnabled: true,
          tripSparseMaxKph: 88.2,
          cannonReserveActive: true
        })
      )
    );

    expect(markup).toContain('class="status-pill ready">respawn-bound</span>');
    expect(markup).toContain('class="cannon-notice warning"');
    expect(markup).toContain("Respawn-bound: cannon uptime is limited by target respawns.");
    expect(markup).toContain('checked=""');
    expect(markup).not.toContain('disabled=""');

    labelsInOrder(markup, [
      "Effective targets",
      "Cannon DPS",
      "Cannon only DPS",
      "Balls/hr",
      "Balls/kill",
      "On-site cannon Ranged XP/hr",
      "Effective XP/hr",
      "Effective net GP/hr",
      "On-site ball cost/hr",
      "Ball cost/kill",
      "Ball price",
      "Cannonballs/trip",
      "Ball GP/trip",
      "On-site kills/hr uplift",
      "Accuracy rule",
      "XP rule",
      "Supply impact",
      "Sparse link",
      "Inventory reserve",
      "Trip on-site sparse cap (kills/hr)"
    ]);
    for (const value of [
      "3.3",
      "4.57",
      "6.79",
      "2,700",
      "12.35",
      "32,882",
      "486,000",
      "2,222",
      "180",
      "432",
      "77,796",
      "25.5%",
      "65.4% roll",
      "2,222 GP/kill",
      "Linked",
      "5 slots",
      "88"
    ]) {
      expect(markup).toContain(value);
    }
    expect(markup).toContain('class="teal"');
    expect(markup).toContain('class="gold"');
  });

  it("keeps idle and divergent sparse presentation independent of mutation ownership", () => {
    const markup = renderToStaticMarkup(
      createElement(
        CannonPane,
        props({
          enabled: true,
          hasCustomSettings: true,
          output: { ...output, idle: true, respawnBound: false },
          tripSparseEnabled: true,
          tripSparseLinked: false
        })
      )
    );

    expect(markup).toContain('class="status-pill ">idle</span>');
    expect(markup).toContain("Idle: this spot is too sparse for the cannon to fire.");
    expect(markup).toContain("Trip differs");
    expect(markup).not.toContain('class="cannon-notice warning"');
  });
});

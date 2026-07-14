import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PlannerPane,
  type PlannerPaneActions,
  type PlannerPaneModel
} from "../app/components/panes/planner-pane";
import { createDefaultPlannerUiState } from "../app/state/planner";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import type { PlannerPanelViewModel } from "../app/view-models/planner";

const noOp = () => undefined;

const actions: PlannerPaneActions = {
  setMetric: noOp,
  setCurrentXp: noOp,
  setTargetLevel: noOp,
  setSkillLock: noOp,
  setOnlyCurrentGear: noOp,
  setAverageOverSession: noOp,
  setGearPoolItem: noOp,
  resetGearPool: noOp,
  recompute: noOp
};

function panelFixture(isEmpty = false): PlannerPanelViewModel {
  return {
    summary: {
      totalXp: 1_000,
      stepCount: 1,
      phaseCount: 1,
      unlockCount: 1,
      startDps: 2,
      endDps: 2.5,
      startMetric: 2,
      endMetric: 2.5,
      truncated: false
    },
    trainingOrder: isEmpty
      ? []
      : [
          {
            id: "attack:40:41",
            skill: "attack",
            skillLabel: "Attack",
            from: 40,
            to: 41,
            xp: 1_000,
            cumXp: 1_000,
            startDps: 2,
            endDps: 2.5,
            startMetric: 2,
            endMetric: 2.5,
            unlockCount: 1
          }
        ],
    unlocks: isEmpty
      ? []
      : [
          {
            id: "rune_scimitar",
            itemName: "Rune scimitar",
            slotLabel: "Weapon",
            type: "unlock",
            skillLabel: "Attack",
            level: 40,
            reqSkillLabel: "Attack",
            reqLevel: 40,
            cumXp: 1_000,
            dpsBefore: 2,
            dpsAfter: 2.5
          }
        ],
    timeline: isEmpty
      ? []
      : [
          {
            id: "rune_scimitar:1000",
            itemName: "Rune scimitar",
            slotLabel: "Weapon",
            type: "unlock",
            skillLabel: "Attack",
            level: 40,
            cumXp: 1_000,
            dpsDelta: 0.5
          }
        ],
    chart: {
      points: isEmpty
        ? []
        : [
            { id: "start", label: "Start", cumXp: 0, dps: 2, x: 0, y: 100 },
            { id: "end", label: "Attack 41", cumXp: 1_000, dps: 2.5, x: 100, y: 0 }
          ],
      minDps: 2,
      maxDps: 2.5,
      maxCumXp: 1_000,
      isEmpty
    },
    warnings: isEmpty ? [] : ["Fixture warning"],
    isEmpty
  };
}

function model(overrides: Partial<PlannerPaneModel> = {}): PlannerPaneModel {
  return {
    draftState: createDefaultPlannerUiState(DEFAULT_FORM_STATE),
    panel: panelFixture(),
    gearPoolEditor: {
      slots: [
        {
          slot: "weapon",
          label: "Weapon",
          selectedCount: 1,
          totalCount: 1,
          options: [
            {
              id: "rune_scimitar",
              label: "Rune scimitar",
              hint: "Attack 40",
              selected: true
            }
          ]
        }
      ],
      totalSelectedCount: 1,
      totalOptionCount: 1
    },
    error: null,
    pending: false,
    status: "ready",
    computedMetric: "balanced",
    combatStyleLabel: "melee",
    targetLabel: "Rock Crab",
    currentLevels: DEFAULT_FORM_STATE.levels,
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

describe("Planner pane", () => {
  it("keeps the hidden landmark, controls, gear editor and complete output order", () => {
    const markup = renderToStaticMarkup(
      createElement(PlannerPane, { hidden: true, model: model(), actions })
    );

    expect(markup.startsWith('<section class="planner-pane" aria-label="Planner" hidden="">')).toBe(
      true
    );
    inOrder(markup, [
      "<h2>Planner</h2>",
      'aria-label="Planner controls"',
      "Optimize metric",
      "Combat style",
      "Target",
      "Recompute plan",
      'aria-label="Planner gear options"',
      'aria-label="Planner skill targets"',
      'aria-label="Planner gear pool editor"',
      'aria-label="Planner output"',
      'aria-label="Planner summary"',
      'aria-label="Planner DPS chart"',
      'aria-label="Planner gear timeline"',
      'aria-label="Planner training order"',
      'aria-label="Planner unlock summary"',
      'aria-label="Planner warnings"'
    ]);
    expect(markup).toContain('aria-label="Planner pool Rune scimitar"');
    expect(markup).toContain("+0.50");
    expect(markup).toContain("Fixture warning");
  });

  it("keeps calculating and fixed-error presentation contracts", () => {
    const pendingMarkup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({ panel: null, pending: true, status: "running" }),
        actions
      })
    );
    const errorMarkup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({
          panel: null,
          error: "Planner could not compute the current plan",
          status: "error"
        }),
        actions
      })
    );

    expect(pendingMarkup).toContain(
      '<p class="inline-status" role="status" aria-live="polite">Calculating plan</p>'
    );
    expect(pendingMarkup).not.toContain('aria-label="Planner output"');
    expect(errorMarkup).toContain(
      '<p class="inline-status error" role="alert">Planner could not compute the current plan</p>'
    );
  });

  it("keeps unavailable and fresh-empty output states distinct", () => {
    const unavailableMarkup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({ panel: null, gearPoolEditor: null, status: "idle" }),
        actions
      })
    );
    const emptyMarkup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({ panel: panelFixture(true), status: "empty" }),
        actions
      })
    );

    expect(unavailableMarkup).toContain("Planner is available after bundled data loads.");
    expect(emptyMarkup).toContain('aria-label="Planner output"');
    expect(emptyMarkup).toContain("No chart points for current targets.");
    expect(emptyMarkup).toContain("No gear unlocks in this plan.");
    expect(emptyMarkup).toContain("No training steps for current targets.");
    expect(emptyMarkup).toContain("No gear or spell unlocks in this plan.");
  });
});

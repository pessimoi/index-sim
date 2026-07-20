import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PlannerPane,
  type PlannerPaneActions,
  type PlannerPaneModel
} from "../app/components/panes/planner-pane";
import { createDefaultPlannerUiState } from "../app/state/planner";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import {
  createPlannerSkillInputViewModels,
  type PlannerPanelViewModel
} from "../app/view-models/planner";

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
  recompute: noOp,
  retry: noOp
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
    draftDirty: false,
    presentation: {
      status: "ready",
      displayIsCurrent: true,
      message: "",
      canRetry: false,
      retryActionLabel: "Retry plan"
    },
    computedMetric: "balanced",
    combatStyleLabel: "melee",
    targetLabel: "Rock Crab",
    skillInputs: createPlannerSkillInputViewModels(
      DEFAULT_FORM_STATE,
      createDefaultPlannerUiState(DEFAULT_FORM_STATE)
    ),
    adjustmentNotice: null,
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
  it("puts primary results before the collapsed advanced gear editor", () => {
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
      'aria-label="Planner output"',
      'aria-label="Planner summary"',
      'aria-label="Planner training order"',
      'aria-label="Planner unlock summary"',
      'aria-label="Planner DPS chart"',
      'aria-label="Planner gear timeline"',
      'aria-label="Planner warnings"',
      "Advanced gear pool",
      'aria-label="Planner gear pool editor"'
    ]);
    expect(markup).toContain('<details class="planner-gear-editor">');
    expect(markup).not.toContain('<details class="planner-gear-editor" open');
    expect(markup).toContain("Advanced gear pool · ");
    expect(markup).toContain("1/1");
    expect(markup).toContain('aria-label="Planner pool Rune scimitar"');
    expect(markup).toContain("Next plan starts at");
    expect(markup).toContain("Use level floor");
    expect(markup).toContain("+0.50");
    expect(markup).toContain("Fixture warning");
  });

  it("renders Auto XP, locked effective targets, adjustment status and dirty output copy", () => {
    const state = createDefaultPlannerUiState(DEFAULT_FORM_STATE);
    state.skillLocks.attack = true;
    state.targetLevels.attack = 70;
    const markup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({
          draftState: state,
          draftDirty: true,
          presentation: {
            status: "stale",
            displayIsCurrent: false,
            message: "Planner inputs changed. This plan uses the last recomputed inputs.",
            canRetry: false,
            retryActionLabel: "Retry plan"
          },
          skillInputs: createPlannerSkillInputViewModels(DEFAULT_FORM_STATE, state),
          adjustmentNotice: "Planner inputs adjusted for current levels: Strength XP uses Auto."
        }),
        actions
      })
    );

    expect(markup).toContain('placeholder="Auto:');
    expect(markup).toContain("Locked at current level 60; saved target 70 is not used.");
    expect(markup).toContain("Planner inputs adjusted for current levels");
    expect(markup).toContain("Planner inputs changed. This plan uses the last recomputed inputs.");
    expect(markup).toContain('aria-live="polite"');
    inOrder(markup, [
      'aria-label="Planner skill targets"',
      "Planner inputs changed. This plan uses the last recomputed inputs.",
      'aria-label="Planner output"',
      "Advanced gear pool"
    ]);
  });

  it("keeps calculating and fixed-error presentation contracts", () => {
    const pendingMarkup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({
          panel: null,
          presentation: {
            status: "building",
            displayIsCurrent: false,
            message: "Calculating the plan for current inputs.",
            canRetry: false,
            retryActionLabel: "Retry plan"
          }
        }),
        actions
      })
    );
    const errorMarkup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({
          panel: null,
          presentation: {
            status: "failed",
            displayIsCurrent: false,
            message: "Planner could not compute the current plan. Your inputs are unchanged.",
            canRetry: true,
            retryActionLabel: "Retry plan"
          }
        }),
        actions
      })
    );
    const retainedErrorMarkup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({
          presentation: {
            status: "failed",
            displayIsCurrent: false,
            message: "Planner could not compute the current plan. Showing the previous result.",
            canRetry: true,
            retryActionLabel: "Retry plan"
          }
        }),
        actions
      })
    );

    expect(pendingMarkup).toContain("Calculating the plan for current inputs.");
    expect(pendingMarkup).not.toContain('aria-label="Planner output"');
    expect(errorMarkup).toContain(
      "Planner could not compute the current plan. Your inputs are unchanged."
    );
    expect(errorMarkup).toContain('role="alert"');
    expect(errorMarkup).toContain("Retry plan");
    inOrder(retainedErrorMarkup, [
      "Planner could not compute the current plan. Showing the previous result.",
      "Retry plan",
      'aria-label="Planner output"',
      "Advanced gear pool"
    ]);
  });

  it("keeps unavailable and fresh-empty output states distinct", () => {
    const unavailableMarkup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({
          panel: null,
          gearPoolEditor: null,
          presentation: {
            status: "idle",
            displayIsCurrent: false,
            message: "",
            canRetry: false,
            retryActionLabel: "Retry plan"
          }
        }),
        actions
      })
    );
    const emptyMarkup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({ panel: panelFixture(true) }),
        actions
      })
    );

    expect(unavailableMarkup).toContain("Planner is available after bundled data loads.");
    expect(unavailableMarkup).not.toContain("Advanced gear pool");
    expect(emptyMarkup).toContain('aria-label="Planner output"');
    expect(emptyMarkup).toContain("No chart points for current targets.");
    expect(emptyMarkup).toContain("No gear unlocks in this plan.");
    expect(emptyMarkup).toContain("No training steps for current targets.");
    expect(emptyMarkup).toContain("No gear or spell unlocks in this plan.");
  });

  it("does not show the unavailable copy when only the advanced editor is ready", () => {
    const markup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({
          panel: null,
          presentation: {
            status: "idle",
            displayIsCurrent: false,
            message: "",
            canRetry: false,
            retryActionLabel: "Retry plan"
          }
        }),
        actions
      })
    );

    expect(markup).not.toContain("Planner is available after bundled data loads.");
    expect(markup).toContain("Advanced gear pool");
  });
});

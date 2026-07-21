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
  retry: noOp,
  reviewNotice: noOp
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
    notices: isEmpty
      ? {
          warningSetId: "planner-warning-set-empty",
          issueCount: 0,
          noteCount: 0,
          occurrenceCount: 0,
          rows: []
        }
      : {
          warningSetId: "planner-warning-set-fixture",
          issueCount: 1,
          noteCount: 0,
          occurrenceCount: 1,
          rows: [
            {
              id: "planner-notice-fixture",
              code: "fixture-warning",
              severity: "warning",
              category: "other",
              title: "Planner notice",
              detail: "Fixture warning",
              occurrences: {
                totalCount: 1,
                visibleLabels: ["Planner setup"],
                hiddenCount: 0
              },
              action: { kind: "review-planner-inputs", label: "Review Planner inputs" },
              affectsCurrentResult: true
            }
          ]
        },
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
      'aria-label="Plan notices"',
      "Advanced gear pool",
      'aria-label="Planner gear pool editor"'
    ]);
    expect(markup).toContain('<details class="planner-gear-editor">');
    expect(markup).not.toContain('<details class="planner-gear-editor" open');
    expect(markup).toContain("Advanced gear pool · ");
    expect(markup).toContain("1/1");
    expect(markup).toContain('aria-label="Planner pool Rune scimitar"');
    expect(markup).toContain("Effective XP/hr");
    expect(markup).toContain("Effective net GP/hr");
    expect(markup).toContain("Balanced effective XP and net GP");
    expect(markup).toContain("Next plan starts at");
    expect(markup).toContain("Use level floor");
    expect(markup).toContain("+0.50");
    expect(markup).toContain("Fixture warning");
    expect(markup).toContain("Plan notices · 1 issue · 0 notes");
    expect(markup).not.toContain("more notices");
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

  it("renders every notice and distinguishes previous note-only output", () => {
    const fixture = panelFixture();
    fixture.notices = {
      warningSetId: "planner-warning-set-many-notes",
      issueCount: 0,
      noteCount: 6,
      occurrenceCount: 8,
      rows: Array.from({ length: 6 }, (_, index) => ({
        id: `note-${index}`,
        code: `note-${index}`,
        severity: "info" as const,
        category: "other" as const,
        title: `Planner note ${index + 1}`,
        detail: `Complete detail ${index + 1}`,
        occurrences: {
          totalCount: index === 0 ? 3 : 1,
          visibleLabels: index === 0 ? ["Plan start", "Attack 60–61 result"] : ["Planner setup"],
          hiddenCount: index === 0 ? 1 : 0
        },
        action: {
          kind: "review-planner-inputs" as const,
          label: "Review Planner inputs" as const
        },
        affectsCurrentResult: true
      }))
    };
    const markup = renderToStaticMarkup(
      createElement(PlannerPane, {
        hidden: false,
        model: model({
          panel: fixture,
          presentation: {
            status: "stale",
            displayIsCurrent: false,
            message: "Showing the previous plan.",
            canRetry: false,
            retryActionLabel: "Retry plan"
          }
        }),
        actions
      })
    );

    expect(markup).toContain('aria-label="Previous plan notices"');
    expect(markup).toContain("Previous plan notices · 0 issues · 6 notes");
    expect(markup).not.toContain('<details class="planner-notices" open');
    for (let index = 1; index <= 6; index += 1) {
      expect(markup).toContain(`Complete detail ${index}`);
    }
    expect(markup).toContain("1 more occurrences");
    expect(markup).not.toContain("more notices");
  });
});

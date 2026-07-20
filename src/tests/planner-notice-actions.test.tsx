// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PlannerPane,
  type PlannerPaneActions,
  type PlannerPaneModel
} from "../app/components/panes/planner-pane";
import { createDefaultPlannerUiState } from "../app/state/planner";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import type { PlannerNoticeViewModel, PlannerPanelViewModel } from "../app/view-models/planner";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function notice(
  id: string,
  severity: PlannerNoticeViewModel["severity"],
  action: PlannerNoticeViewModel["action"],
  detail = `${id} detail`
): PlannerNoticeViewModel {
  return {
    id,
    code: id,
    severity,
    category: "other",
    title: `${id} title`,
    detail,
    occurrences: { totalCount: 1, visibleLabels: ["Planner setup"], hiddenCount: 0 },
    action,
    affectsCurrentResult: true
  };
}

function panel(warningSetId: string, rows: PlannerNoticeViewModel[]): PlannerPanelViewModel {
  return {
    summary: {
      totalXp: 0,
      stepCount: 0,
      phaseCount: 0,
      unlockCount: 0,
      startDps: 1,
      endDps: 1,
      startMetric: 1,
      endMetric: 1,
      truncated: false
    },
    trainingOrder: [],
    unlocks: [],
    timeline: [],
    chart: { points: [], minDps: 1, maxDps: 1, maxCumXp: 0, isEmpty: true },
    notices: {
      warningSetId,
      issueCount: rows.filter((row) => row.severity !== "info").length,
      noteCount: rows.filter((row) => row.severity === "info").length,
      occurrenceCount: rows.length,
      rows
    },
    isEmpty: true
  };
}

function model(
  warningSetId: string,
  rows: PlannerNoticeViewModel[],
  displayIsCurrent = true
): PlannerPaneModel {
  return {
    draftState: createDefaultPlannerUiState(DEFAULT_FORM_STATE),
    panel: panel(warningSetId, rows),
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
    draftDirty: !displayIsCurrent,
    presentation: {
      status: displayIsCurrent ? "ready" : "stale",
      displayIsCurrent,
      message: "",
      canRetry: false,
      retryActionLabel: "Retry plan"
    },
    computedMetric: "balanced",
    combatStyleLabel: "melee",
    targetLabel: "Rock Crab",
    skillInputs: [],
    adjustmentNotice: null
  };
}

function actions(): PlannerPaneActions {
  return {
    setMetric: vi.fn(),
    setCurrentXp: vi.fn(),
    setTargetLevel: vi.fn(),
    setSkillLock: vi.fn(),
    setOnlyCurrentGear: vi.fn(),
    setAverageOverSession: vi.fn(),
    setGearPoolItem: vi.fn(),
    resetGearPool: vi.fn(),
    recompute: vi.fn(),
    retry: vi.fn(),
    reviewNotice: vi.fn()
  };
}

function render(modelValue: PlannerPaneModel, actionValue: PlannerPaneActions): void {
  act(() => root.render(<PlannerPane hidden={false} model={modelValue} actions={actionValue} />));
}

function clickAction(label: string): void {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label^="${label}:"]`);
  expect(button).not.toBeNull();
  act(() => button!.click());
}

describe("Planner notice actions", () => {
  it("focuses same-pane targets and inputs without mutating or recomputing", () => {
    const actionValue = actions();
    render(
      model("same-pane", [
        notice("targets", "warning", { kind: "review-targets", label: "Review targets" }),
        notice("inputs", "warning", {
          kind: "review-planner-inputs",
          label: "Review Planner inputs"
        })
      ]),
      actionValue
    );

    clickAction("Review targets");
    expect(document.activeElement).toBe(
      container.querySelector('[aria-label="Planner skill targets"]')
    );
    clickAction("Review Planner inputs");
    expect(document.activeElement).toBe(container.querySelector('[aria-label="Planner controls"]'));
    expect(actionValue.reviewNotice).not.toHaveBeenCalled();
    expect(actionValue.recompute).not.toHaveBeenCalled();
    expect(actionValue.setTargetLevel).not.toHaveBeenCalled();
  });

  it("opens the gear editor and focuses the exact option or a safe fallback", () => {
    const actionValue = actions();
    render(
      model("gear", [
        notice("exact-gear", "warning", {
          kind: "review-gear",
          label: "Review gear",
          itemId: "rune_scimitar"
        }),
        notice("missing-gear", "warning", {
          kind: "review-gear",
          label: "Review gear",
          itemId: "removed_item"
        })
      ]),
      actionValue
    );

    clickAction("Review gear");
    expect(container.querySelector(".planner-gear-editor")?.hasAttribute("open")).toBe(true);
    expect(document.activeElement).toBe(
      container.querySelector('input[aria-label="Planner pool Rune scimitar"]')
    );

    const buttons = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Review gear:"]'
    );
    act(() => buttons[1]!.click());
    expect(document.activeElement).toBe(container.querySelector(".planner-gear-editor summary"));
    expect(container.textContent).toContain(
      "That item is not available in the current Planner gear pool."
    );
    expect(actionValue.setGearPoolItem).not.toHaveBeenCalled();
    expect(actionValue.recompute).not.toHaveBeenCalled();
  });

  it("delegates cross-pane navigation without changing Planner state", () => {
    const actionValue = actions();
    const crossAction = { kind: "review-loadout", label: "Review loadout" } as const;
    render(model("cross-pane", [notice("loadout", "warning", crossAction)]), actionValue);

    clickAction("Review loadout");

    expect(actionValue.reviewNotice).toHaveBeenCalledWith(crossAction);
    expect(actionValue.recompute).not.toHaveBeenCalled();
    expect(actionValue.setGearPoolItem).not.toHaveBeenCalled();
  });

  it("preserves user disclosure state for one set and resets it for a new set", () => {
    const actionValue = actions();
    const issueRows = [
      notice("issue", "warning", { kind: "review-targets", label: "Review targets" })
    ];
    render(model("issue-set", issueRows), actionValue);
    const details = container.querySelector<HTMLDetailsElement>(".planner-notices")!;
    expect(details.open).toBe(true);
    expect(container.textContent).toContain("Planner found 1 issue and 0 notes.");

    act(() => {
      details.open = false;
      details.dispatchEvent(new Event("toggle"));
    });
    render(model("issue-set", issueRows, false), actionValue);
    expect(container.querySelector<HTMLDetailsElement>(".planner-notices")!.open).toBe(false);
    expect(container.textContent).toContain("Previous plan notices");

    const infoRows = [
      notice("note", "info", {
        kind: "review-planner-inputs",
        label: "Review Planner inputs"
      })
    ];
    render(model("note-set", infoRows), actionValue);
    expect(container.querySelector<HTMLDetailsElement>(".planner-notices")!.open).toBe(false);
    expect(container.textContent).toContain("Planner found 0 issues and 1 note.");

    render(model("new-issue-set", issueRows), actionValue);
    expect(container.querySelector<HTMLDetailsElement>(".planner-notices")!.open).toBe(true);
  });
});

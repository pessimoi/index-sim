// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, beforeAll, describe, expect, it, vi } from "vitest";

import { loadBundledLegacyContext } from "../adapters/legacy-runtime";
import {
  DuelPane,
  type DuelPaneActions,
  type DuelPaneModel
} from "../app/components/panes/duel-pane";
import { createDuelSnapshot } from "../app/state/duel-snapshots";
import { createSavedSetupMergePlan } from "../app/state/saved-setup-merge";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import {
  DEFAULT_DUEL_COMPARISON_SORT_STATE,
  DEFAULT_DUEL_MATRIX_SORT_STATE,
  createDuelComparisonViewModel,
  createSavedSetupMergeReviewViewModel
} from "../app/view-models/duel";
import type { SimulationContext } from "../domain/shared";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;
let context: SimulationContext;

beforeAll(async () => {
  context = (await loadBundledLegacyContext()).context;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function model(changeRevision = 0): DuelPaneModel {
  const saved = createDuelSnapshot("stable-id", "Duplicate", DEFAULT_FORM_STATE);
  const comparison = createDuelComparisonViewModel(
    DEFAULT_FORM_STATE,
    {
      snapshots: [
        saved,
        createDuelSnapshot("other-id", " duplicate ", {
          ...DEFAULT_FORM_STATE,
          levels: { ...DEFAULT_FORM_STATE.levels, attack: 80 }
        })
      ]
    },
    context
  );
  return {
    targetLabel: comparison.monsterName,
    snapshotCount: 2,
    duelComparison: comparison,
    duelComparisonRows: comparison.rows,
    duelComparisonSort: DEFAULT_DUEL_COMPARISON_SORT_STATE,
    duelViewMode: "current-target",
    expandedDuelDiffId: null,
    duelMatrixMetric: "dps",
    duelMatrixFilter: "",
    duelMatrixPresentation: {
      status: "idle",
      displayModel: null,
      displayIsCurrent: false,
      message: "Build comparison",
      canBuild: true,
      buildActionLabel: "Build comparison"
    },
    filteredDuelMatrixRows: [],
    duelMatrixSort: DEFAULT_DUEL_MATRIX_SORT_STATE,
    duelImportNotice: null,
    duelImportReview: null,
    duelSessionOnlyAvailable: false,
    duelChangeRevision: changeRevision
  };
}

function actions(
  commit: DuelPaneActions["commitDuelSnapshotName"] = vi.fn(() => "renamed" as const)
): DuelPaneActions {
  return {
    snapshotCurrentSetup: vi.fn(),
    exportDuelSnapshots: vi.fn(),
    importDuelSnapshots: vi.fn(async () => undefined),
    mergeDuelSnapshotsImport: vi.fn(),
    dismissDuelSnapshotsImport: vi.fn(),
    setDuelSnapshotsImportDecision: vi.fn(),
    setDuelSnapshotsImportName: vi.fn(),
    refreshDuelSnapshotsImport: vi.fn(),
    applyDuelSessionOnlyChange: vi.fn(),
    commitDuelSnapshotName: commit,
    loadDuelSnapshot: vi.fn(),
    deleteDuelSnapshot: vi.fn(),
    showCurrentDuelTarget: vi.fn(),
    showDuelMonsterMatrix: vi.fn(),
    toggleDuelDiff: vi.fn(),
    sortDuelComparisonBy: vi.fn(),
    setDuelMatrixFilter: vi.fn(),
    setDuelMatrixMetric: vi.fn(),
    sortDuelMatrixBy: vi.fn(),
    buildDuelMatrix: vi.fn()
  };
}

function render(modelValue: DuelPaneModel, actionValue: DuelPaneActions): void {
  act(() => root.render(<DuelPane hidden={false} model={modelValue} actions={actionValue} />));
}

function setInputValue(input: HTMLInputElement, value: string): void {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("Duel saved setup actions", () => {
  it("disambiguates historical duplicate names and exposes unique row actions", () => {
    render(model(), actions());
    expect(container.textContent).toContain("Duplicate (1 of 2)");
    expect(container.textContent).toContain("duplicate (2 of 2)");
    expect(
      container.querySelector('button[aria-label="Load saved setup Duplicate (1 of 2)"]')
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Delete saved setup duplicate (2 of 2)"]')
    ).not.toBeNull();
  });

  it("uses explicit Rename, ignores blur, cancels with Escape, and saves with Enter by ID", async () => {
    const commit = vi.fn<DuelPaneActions["commitDuelSnapshotName"]>(() => "renamed");
    const actionValue = actions(commit);
    render(model(), actionValue);
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Rename saved setup Duplicate (1 of 2)"]'
    )!;

    act(() => trigger.click());
    let input = container.querySelector<HTMLInputElement>(
      'input[aria-label="New name for saved setup Duplicate (1 of 2)"]'
    )!;
    setInputValue(input, "Renamed setup");
    act(() => input.blur());
    expect(commit).not.toHaveBeenCalled();
    expect(container.querySelector(".duel-rename-editor")).not.toBeNull();

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await Promise.resolve();
    });
    expect(container.querySelector(".duel-rename-editor")).toBeNull();
    expect(document.activeElement).toBe(
      container.querySelector('button[aria-label="Rename saved setup Duplicate (1 of 2)"]')
    );

    act(() =>
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Rename saved setup Duplicate (1 of 2)"]'
        )!
        .click()
    );
    input = container.querySelector<HTMLInputElement>(
      'input[aria-label="New name for saved setup Duplicate (1 of 2)"]'
    )!;
    setInputValue(input, "Renamed setup");
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();
    });
    expect(commit).toHaveBeenCalledWith("stable-id", "Renamed setup");
    expect(container.querySelector(".duel-rename-editor")).toBeNull();
    expect(document.activeElement).toBe(
      container.querySelector('button[aria-label="Rename saved setup Duplicate (1 of 2)"]')
    );
  });

  it("keeps an invalid or duplicate rename editor open with fixed guidance", () => {
    const commit = vi.fn<DuelPaneActions["commitDuelSnapshotName"]>(() => "duplicate");
    render(model(), actions(commit));
    act(() =>
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Rename saved setup Duplicate (1 of 2)"]'
        )!
        .click()
    );
    const input = container.querySelector<HTMLInputElement>(
      'input[aria-label="New name for saved setup Duplicate (1 of 2)"]'
    )!;
    setInputValue(input, "duplicate");
    act(() => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(container.querySelector(".duel-rename-editor")).not.toBeNull();
    expect(container.textContent).toContain("Choose a unique saved setup name.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("closes an open editor after an externally applied saved-setup revision", () => {
    const actionValue = actions();
    render(model(0), actionValue);
    act(() =>
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Rename saved setup Duplicate (1 of 2)"]'
        )!
        .click()
    );
    expect(container.querySelector(".duel-rename-editor")).not.toBeNull();
    render(model(1), actionValue);
    expect(container.querySelector(".duel-rename-editor")).toBeNull();
  });

  it("focuses a new merge review, emits controlled choices, and returns Dismiss focus", async () => {
    const current = {
      snapshots: [createDuelSnapshot("current", "Current", DEFAULT_FORM_STATE)]
    };
    const plan = createSavedSetupMergePlan({
      reviewId: 9,
      current,
      source: {
        snapshots: [createDuelSnapshot("imported", "Imported", DEFAULT_FORM_STATE)]
      }
    });
    const modelValue: DuelPaneModel = {
      ...model(),
      duelImportReview: {
        ...createSavedSetupMergeReviewViewModel({ plan, current, context }),
        contextTone: "ready",
        contextMessage: "Revision context matches."
      }
    };
    const actionValue = actions();
    render(modelValue, actionValue);
    const heading = container.querySelector<HTMLHeadingElement>(".duel-import-review h3")!;
    expect(document.activeElement).toBe(heading);

    const add = container.querySelector<HTMLInputElement>(
      '.duel-import-review-row input[type="checkbox"]'
    )!;
    act(() => add.click());
    expect(actionValue.setDuelSnapshotsImportDecision).toHaveBeenCalledWith(
      9,
      "imported",
      "exclude"
    );

    const name = container.querySelector<HTMLInputElement>(".duel-import-recipient-name input")!;
    setInputValue(name, "Imported renamed");
    expect(actionValue.setDuelSnapshotsImportName).toHaveBeenCalledWith(
      9,
      "imported",
      "Imported renamed"
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Dismiss")!
        .click();
      await Promise.resolve();
    });
    expect(actionValue.dismissDuelSnapshotsImport).toHaveBeenCalledWith(9);
    expect(document.activeElement).toBe(container.querySelector('input[type="file"]'));
  });
});

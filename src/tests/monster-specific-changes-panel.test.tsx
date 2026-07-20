// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MonsterSpecificChangesPanel,
  type MonsterSpecificChangesPanelActions,
  type MonsterSpecificChangesPanelModel
} from "../app/components/settings/monster-specific-changes-panel";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function model(): MonsterSpecificChangesPanelModel {
  return {
    inventory: {
      monsterCount: 2,
      categoryCount: 3,
      countsByKind: {
        "custom-setup": 1,
        cannon: 1,
        "loot-actions": 0,
        "loot-settings": 1,
        "compare-hidden": 0
      },
      rows: [
        {
          monsterId: "dagannoth",
          monsterName: "Dagannoth",
          monsterLevel: 74,
          available: true,
          activeTarget: true,
          categories: [
            {
              kind: "custom-setup",
              label: "Custom setup",
              summary: "Melee combat style",
              reviewActionLabel: "Review Custom setup for Dagannoth"
            },
            {
              kind: "cannon",
              label: "Cannon",
              summary: "Enabled, 3 targets, source respawn",
              reviewActionLabel: "Review Cannon for Dagannoth"
            }
          ]
        },
        {
          monsterId: "retained_old_id",
          monsterName: "Unavailable monster",
          monsterLevel: null,
          available: false,
          activeTarget: false,
          categories: [
            {
              kind: "loot-settings",
              label: "Loot settings",
              summary: "High alch off",
              reviewActionLabel: null
            }
          ]
        }
      ]
    },
    removalCandidate: null,
    notice: null,
    sessionOnlyAvailable: false
  };
}

function actions(): MonsterSpecificChangesPanelActions {
  return {
    reviewCategory: vi.fn(),
    reviewRemoval: vi.fn(),
    cancelRemoval: vi.fn(),
    confirmRemoval: vi.fn()
  };
}

function render(modelValue: MonsterSpecificChangesPanelModel, actionValue = actions()) {
  act(() => root.render(<MonsterSpecificChangesPanel model={modelValue} actions={actionValue} />));
  return actionValue;
}

describe("Monster-specific changes panel", () => {
  it("renders the empty state without removal controls", () => {
    const empty = model();
    empty.inventory = {
      monsterCount: 0,
      categoryCount: 0,
      countsByKind: {
        "custom-setup": 0,
        cannon: 0,
        "loot-actions": 0,
        "loot-settings": 0,
        "compare-hidden": 0
      },
      rows: []
    };
    render(empty);
    expect(container.textContent).toContain("No monster-specific changes saved.");
    expect(container.querySelector('button[aria-label^="Review removal"]')).toBeNull();
  });

  it("filters deterministically and keeps unavailable removal without category Review", () => {
    const actionValue = render(model());
    expect(container.querySelectorAll(".monster-change-row")).toHaveLength(2);
    expect(container.querySelectorAll('button[aria-label^="Review "]')).toHaveLength(4);
    expect(
      container.querySelector('button[aria-label="Review Loot settings for Unavailable monster"]')
    ).toBeNull();

    const selects = container.querySelectorAll<HTMLSelectElement>("select");
    act(() => {
      selects[0]!.value = "cannon";
      selects[0]!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelectorAll(".monster-change-row")).toHaveLength(1);
    expect(container.textContent).toContain("Dagannoth");
    expect(container.textContent).not.toContain("Unavailable monster");

    const review = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Review Cannon for Dagannoth"]'
    )!;
    act(() => review.click());
    expect(actionValue.reviewCategory).toHaveBeenCalledWith("dagannoth", "cannon");
  });

  it("shows an inline, explicit removal review without mutating on open", () => {
    const actionValue = render(model());
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Review removal for Dagannoth"]'
    )!;
    act(() => trigger.click());
    expect(actionValue.reviewRemoval).toHaveBeenCalledWith("dagannoth", trigger);
    expect(actionValue.confirmRemoval).not.toHaveBeenCalled();

    const reviewed = model();
    reviewed.removalCandidate = {
      id: 1,
      monsterId: "dagannoth",
      monsterName: "Dagannoth",
      kinds: ["custom-setup", "cannon"],
      selectedAreaIds: ["rewrite-setup"],
      sourceProjection: {
        activeMonsterId: "dagannoth",
        setupMode: "custom",
        customSetup: null,
        cannon: null,
        lootActions: null,
        lootSettings: null,
        compareHidden: false
      }
    };
    reviewed.sessionOnlyAvailable = true;
    render(reviewed, actionValue);
    expect(container.textContent).toContain("Remove all changes for Dagannoth?");
    expect(container.textContent).toContain("switches to Default");
    expect(
      Array.from(container.querySelectorAll("button")).map((button) => button.textContent)
    ).toContain("Remove for this session");
  });
});

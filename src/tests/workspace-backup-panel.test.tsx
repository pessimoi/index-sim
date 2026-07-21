import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WorkspaceBackupPanel,
  type WorkspaceBackupPanelActions,
  type WorkspaceBackupPanelModel
} from "../app/components/settings/workspace-backup-panel";
import type {
  WorkspaceAreaReview,
  WorkspaceRestoreReview
} from "../app/controllers/workspace-file-transfer";

const noOp = () => undefined;

function area(id: WorkspaceAreaReview["id"], label: string, localVersion = 1): WorkspaceAreaReview {
  return {
    id,
    label,
    transferVersion: 1,
    localVersion,
    sourceCount: 0,
    currentCount: 0,
    sourceSummary: "0 records in backup",
    currentSummary: "0 current records",
    status: "ready",
    compatibilityMessage: "Compatible with the current app data.",
    selectable: true,
    selectedByDefault: true,
    defaultMode: "replace",
    availableModes: ["replace"]
  };
}

function review(): WorkspaceRestoreReview {
  return {
    id: 7,
    file: {
      kind: "index-sim-workspace",
      version: 1,
      exportedAt: "2026-07-19T16:45:00.000Z",
      byteSize: 12_345,
      areaCount: 10
    },
    context: {
      match: "different-revision",
      tone: "warning",
      message:
        "Created for Revision 273; this app uses Revision 274. Available ids are compatible, but combat, loot and requirements may differ.",
      source: { gameDataId: "older-snapshot", gameRevision: 273 },
      current: { gameDataId: "current-snapshot", gameRevision: 274 }
    },
    areas: [
      {
        ...area("rewrite-setup", "Rewrite setup", 3),
        sourceCount: 2,
        currentCount: 1,
        sourceSummary: "2 active or monster-specific setup records",
        currentSummary: "1 active or monster-specific setup records"
      },
      {
        ...area("planner-ui", "Planner UI state"),
        transferVersion: 2,
        sourceCount: null,
        sourceSummary: "Contents unavailable",
        status: "unsupported-version",
        compatibilityMessage: "Transfer v2 is not supported; this app reads v1.",
        selectable: false,
        selectedByDefault: false
      },
      { ...area("loot-prefs", "Loot preferences"), availableModes: ["replace", "merge"] },
      area("loot-settings", "Loot settings"),
      area("hidden-gear-tiers", "Hidden gear tiers"),
      area("duel-snapshots", "Saved setups"),
      area("price-history", "Price history", 2),
      area("selected-price-set", "Selected PriceSet", 2),
      area("manual-price-overrides", "Manual item prices"),
      {
        ...area("hiscores-last-player", "Hiscores last player"),
        sourceCount: 1,
        currentCount: 0,
        sourceSummary: "Player name included; privacy confirmation required",
        currentSummary: "Not present in this session",
        compatibilityMessage: "Compatible. Re-confirm privacy before restoring this player name.",
        selectedByDefault: false
      }
    ]
  };
}

function model(overrides: Partial<WorkspaceBackupPanelModel> = {}): WorkspaceBackupPanelModel {
  return {
    phase: "idle",
    includeLastHiscoresPlayer: false,
    notice: null,
    review: null,
    selection: null,
    restorePlan: null,
    currentRevisionLabel: "Revision 274",
    currentSnapshotLabel: "LostCity fixture runtime",
    currentSnapshotId: "current-snapshot",
    canIncludeLastHiscoresPlayer: true,
    ...overrides
  };
}

function reviewModel(): Partial<WorkspaceBackupPanelModel> {
  const currentReview = review();
  const areas = currentReview.areas.map((area) => ({
    id: area.id,
    selected: area.selectedByDefault,
    mode: "replace" as const
  }));
  return {
    phase: "review",
    review: currentReview,
    selection: { reviewId: currentReview.id, areas },
    restorePlan: {
      reviewId: currentReview.id,
      status: "ready",
      canApply: true,
      validationMessage: "8 selected areas are fully validated. No changes have been applied.",
      selectedIds: areas.filter((area) => area.selected).map((area) => area.id),
      selectedAreaCount: 8,
      changedAreaCount: 3,
      clearedAreaCount: 1,
      areas: currentReview.areas.map((area) => ({
        id: area.id,
        selected: area.selectedByDefault,
        mode: "replace",
        status: area.selectable ? "ready" : "unavailable",
        effect: area.selectable
          ? {
              sourceCount: area.sourceCount ?? 0,
              currentCount: area.currentCount,
              resultCount: area.sourceCount ?? 0,
              addedCount: 1,
              updatedCount: 0,
              skippedCount: 0,
              replacedCount: 0,
              retainedCount: 0,
              droppedCount: 0,
              clearedCount: 0
            }
          : null,
        effectSummary: area.selectable
          ? "result 1 · added 1 · updated 0 · replaced 0 · retained 0 · skipped 0 · dropped 0"
          : "No restore outcome available",
        validationMessage: null
      })),
      selectedAreas: [],
      priceComposition: null
    }
  };
}

const actions: WorkspaceBackupPanelActions = {
  setIncludeLastHiscoresPlayer: noOp,
  exportWorkspace: noOp,
  dismissReview: noOp,
  reviewRecovery: noOp,
  restore: async () => undefined
};

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const children = (node.props as { children?: ReactNode }).children;
  return [node, ...elements(children)];
}

describe("Workspace backup Settings panel", () => {
  it("renders a local-file workflow with an unchecked non-persisted privacy opt-in", () => {
    const markup = renderToStaticMarkup(<WorkspaceBackupPanel model={model()} actions={actions} />);

    expect(markup).toContain('aria-label="Workspace backup and restore"');
    expect(markup).toContain("Download one versioned file containing the active local Workspace");
    expect(markup).toContain("read-only review and does not change this browser");
    expect(markup).toContain(
      "It includes setup, Planner, Loot, saved setups, prices and local history. Calculated output, pending reviews and Undo are excluded."
    );
    expect(markup).toContain("Required areas 9");
    expect(markup).toContain("Download full Workspace backup");
    expect(markup).toContain("Review Workspace backup file");
    expect(markup).toContain("Include last Hiscores player name");
    expect(markup).not.toMatch(/type="checkbox"[^>]*checked/);
    expect(markup).toContain("may identify a game character to anyone receiving the file");
    expect(markup).toContain("session-only and is not saved");
    expect(markup).toContain('accept="application/json,.json"');
    expect(markup.match(/aria-describedby="[^"]+ [^"]+"/g)).toHaveLength(2);
    expect(markup).not.toContain("Apply");
  });

  it("renders bounded Revision and area review without exposing a Hiscores name or Apply", () => {
    const markup = renderToStaticMarkup(
      <WorkspaceBackupPanel model={model(reviewModel())} actions={actions} />
    );

    expect(markup).toContain('aria-label="Workspace restore review"');
    expect(markup).toContain('aria-label="Workspace restore areas"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("Review before restore");
    expect(markup).toContain("Revision 273");
    expect(markup).toContain("Revision 274");
    expect(markup).toContain("older-snapshot");
    expect(markup).toContain("current-snapshot");
    expect(markup).toContain("index-sim-workspace");
    expect(markup).toContain("12.3 KB");
    expect(markup).toContain("Restore Rewrite setup");
    expect(markup).toContain('aria-label="Loot preferences restore mode"');
    expect(markup).toContain('value="merge"');
    expect(markup).toContain("result 1 · added 1");
    expect(markup).toContain("Unavailable");
    expect(markup).toContain("Unsupported transfer version");
    for (const label of [
      "Rewrite setup",
      "Planner UI state",
      "Loot preferences",
      "Loot settings",
      "Hidden gear tiers",
      "Saved setups",
      "Price history",
      "Selected PriceSet",
      "Manual item prices",
      "Hiscores last player"
    ]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain("privacy confirmation required");
    expect(markup).not.toContain("Private Hero");
    expect(markup).toContain(">Apply selected areas<");
    expect(markup).toContain('data-plan-ready="true"');
    expect(markup).toContain("disabled");
    expect(markup).toContain(">Dismiss<");
  });

  it("routes export, opt-in, import and exact Dismiss intents and resets the file input", async () => {
    const calls: string[] = [];
    const panelActions: WorkspaceBackupPanelActions = {
      setIncludeLastHiscoresPlayer: (include) => calls.push(`include:${include}`),
      exportWorkspace: () => calls.push("export"),
      dismissReview: (reviewId) => calls.push(`dismiss:${reviewId}`),
      reviewRecovery: () => calls.push("recovery"),
      restore: async (intent) => {
        if (intent.kind === "prepare") {
          calls.push(`review:${intent.file.name}`);
          return;
        }
        if (intent.kind !== "plan") {
          calls.push(`${intent.kind}:${intent.reviewId}`);
          return;
        }
        const { action, reviewId } = intent;
        calls.push(
          action.kind === "selected"
            ? `select:${reviewId}:${action.areaId}:${action.selected}`
            : action.kind === "mode"
              ? `mode:${reviewId}:${action.areaId}:${action.mode}`
              : `revalidate:${reviewId}`
        );
      }
    };
    const tree = WorkspaceBackupPanel({
      model: model(reviewModel()),
      actions: panelActions
    });
    const all = elements(tree);
    const checkbox = all.find(
      (element) =>
        element.type === "input" && (element.props as { type?: string }).type === "checkbox"
    )!;
    (checkbox.props as { onChange(event: { target: { checked: boolean } }): void }).onChange({
      target: { checked: true }
    });
    const restoreCheckbox = all.filter(
      (element) =>
        element.type === "input" && (element.props as { type?: string }).type === "checkbox"
    )[1]!;
    (restoreCheckbox.props as { onChange(event: { target: { checked: boolean } }): void }).onChange(
      { target: { checked: false } }
    );
    const lootMode = all.find(
      (element) =>
        element.type === "select" &&
        (element.props as { "aria-label"?: string })["aria-label"] ===
          "Loot preferences restore mode"
    )!;
    (lootMode.props as { onChange(event: { target: { value: string } }): void }).onChange({
      target: { value: "merge" }
    });
    const button = (label: string) =>
      all.find(
        (element) =>
          element.type === "button" &&
          (element.props as { children?: ReactNode }).children === label
      )!;
    (button("Download full Workspace backup").props as { onClick(): void }).onClick();
    (button("Dismiss").props as { onClick(): void }).onClick();

    const fileInput = all.find(
      (element) => element.type === "input" && (element.props as { type?: string }).type === "file"
    )!;
    const target = {
      files: [new File(["{}"], "workspace.json", { type: "application/json" })],
      value: "workspace.json"
    };
    (fileInput.props as { onChange(event: unknown): void }).onChange({ currentTarget: target });
    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toEqual([
      "include:true",
      "select:7:rewrite-setup:false",
      "mode:7:loot-prefs:merge",
      "export",
      "dismiss:7",
      "review:workspace.json"
    ]);
    expect(target.value).toBe("");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryStorage } from "../adapters/storage";
import { LocalStateAttentionBanner } from "../app/components/shell/local-state-attention-banner";
import { createLocalStateHealthReport } from "../app/state/local-state-health";
import { LOOT_PREFS_STORAGE_KEY } from "../app/state/loot-prefs";
import { LOOT_SETTINGS_STORAGE_KEY } from "../app/state/loot-settings";
import { PLANNER_UI_STORAGE_KEY } from "../app/state/planner";
import { REWRITE_SETUP_STORAGE_KEY } from "../app/state/ui-state";
import { buildLocalStateAttentionViewModel } from "../app/view-models/local-state-attention";
import { CrossTabConflictControllerCore } from "../app/controllers/cross-tab-conflicts";

const FIXED_NOW = new Date("2026-07-18T12:00:00.000Z");

function persistedEnvelope(version: number, data: unknown): string {
  return JSON.stringify({ version, savedAt: FIXED_NOW.toISOString(), data });
}

describe("local state attention view model", () => {
  it("hides healthy and merely missing optional state", () => {
    const model = buildLocalStateAttentionViewModel(
      createLocalStateHealthReport(createMemoryStorage(), FIXED_NOW)
    );

    expect(model).toEqual({ visible: false });
    expect(
      renderToStaticMarkup(<LocalStateAttentionBanner viewModel={model} onReview={() => {}} />)
    ).toBe("");
  });

  it("presents stored-data attention with bounded allowlisted labels and no storage metadata", () => {
    const storage = createMemoryStorage({
      [REWRITE_SETUP_STORAGE_KEY]: persistedEnvelope(999, { privatePayload: "do-not-render" }),
      [PLANNER_UI_STORAGE_KEY]: "{",
      [LOOT_PREFS_STORAGE_KEY]: "{"
    });
    const model = buildLocalStateAttentionViewModel(
      createLocalStateHealthReport(storage, FIXED_NOW)
    );
    const markup = renderToStaticMarkup(
      <LocalStateAttentionBanner viewModel={model} onReview={() => {}} />
    );

    expect(model).toEqual({
      visible: true,
      kind: "stored-data",
      title: "Local data needs review",
      message: "3 saved areas could not be loaded. Safe defaults are active.",
      affectedLabels: ["Rewrite setup", "Planner UI state", "Loot preferences"]
    });
    expect(markup).toContain("Review local data");
    expect(markup).not.toContain(REWRITE_SETUP_STORAGE_KEY);
    expect(markup).not.toContain("do-not-render");
    expect(markup).not.toContain("version-mismatch");
  });

  it("uses the count only when more than three areas need attention", () => {
    const model = buildLocalStateAttentionViewModel(
      createLocalStateHealthReport(
        createMemoryStorage({
          [REWRITE_SETUP_STORAGE_KEY]: "{",
          [PLANNER_UI_STORAGE_KEY]: "{",
          [LOOT_PREFS_STORAGE_KEY]: "{",
          [LOOT_SETTINGS_STORAGE_KEY]: "{"
        }),
        FIXED_NOW
      )
    );

    expect(model).toMatchObject({
      visible: true,
      kind: "stored-data",
      message: "4 saved areas could not be loaded. Safe defaults are active.",
      affectedLabels: []
    });
  });

  it("distinguishes unavailable persistence and a runtime save failure", () => {
    const unavailable = buildLocalStateAttentionViewModel(
      createLocalStateHealthReport(createMemoryStorage(), FIXED_NOW, {
        storageUnavailable: true
      })
    );
    const saveFailure = buildLocalStateAttentionViewModel(
      createLocalStateHealthReport(createMemoryStorage(), FIXED_NOW, {
        storageFailures: [{ id: "planner-ui", reason: "save_failed" }]
      })
    );

    expect(unavailable).toMatchObject({
      visible: true,
      kind: "persistence",
      title: "Changes may not persist",
      affectedLabels: []
    });
    expect(saveFailure).toEqual({
      visible: true,
      kind: "persistence",
      title: "Changes may not persist",
      message:
        "Browser storage is unavailable, so current-session changes may be lost after reload.",
      affectedLabels: ["Planner UI state"]
    });
  });

  it("combines stored-data and persistence attention into one deterministic banner", () => {
    const report = createLocalStateHealthReport(
      createMemoryStorage({ [REWRITE_SETUP_STORAGE_KEY]: "{" }),
      FIXED_NOW,
      { storageFailures: [{ id: "planner-ui", reason: "save_failed" }] }
    );
    const model = buildLocalStateAttentionViewModel(report);
    const markup = renderToStaticMarkup(
      <LocalStateAttentionBanner viewModel={model} onReview={() => {}} />
    );

    expect(model).toEqual({
      visible: true,
      kind: "mixed",
      title: "Local data and saving need review",
      message:
        "2 saved areas could not be loaded, and current changes may not persist after reload.",
      affectedLabels: ["Rewrite setup", "Planner UI state"]
    });
    expect(markup.match(/Review local data/g)).toHaveLength(1);
  });

  it("prioritizes one bounded cross-tab notice without exposing raw values", () => {
    const storage = createMemoryStorage({ [REWRITE_SETUP_STORAGE_KEY]: "private baseline" });
    const conflicts = new CrossTabConflictControllerCore(storage);
    conflicts.initialize();
    storage.setItem(REWRITE_SETUP_STORAGE_KEY, "private external payload");
    conflicts.checkFreshness("rewrite-setup");
    const model = buildLocalStateAttentionViewModel(
      createLocalStateHealthReport(createMemoryStorage(), FIXED_NOW),
      conflicts.getSnapshot()
    );
    const markup = renderToStaticMarkup(
      <LocalStateAttentionBanner viewModel={model} onReview={() => {}} />
    );

    expect(model).toMatchObject({
      visible: true,
      kind: "conflict",
      title: "Data changed in another tab",
      affectedLabels: ["Rewrite setup"],
      reviewLabel: "Review conflicts"
    });
    expect(markup).toContain("Review conflicts");
    expect(markup).not.toContain("private baseline");
    expect(markup).not.toContain("private external payload");
  });
});

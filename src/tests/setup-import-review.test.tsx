import { renderToStaticMarkup } from "react-dom/server";
import { createGeneratedRuntimeContext } from "../adapters/generated";
import { SetupImportReview } from "../app/components/shell/setup-import-review";
import { createSetupFileChangeReview } from "../app/state/setup-transfer-changes";
import { DEFAULT_FORM_STATE, savedSetupFromForm } from "../app/state/ui-state";
import { buildSetupImportReviewViewModel } from "../app/view-models/setup-import-review";

function reviewFixture(options: { stale?: boolean; noChanges?: boolean } = {}) {
  const { context } = createGeneratedRuntimeContext();
  const current = savedSetupFromForm(DEFAULT_FORM_STATE);
  const incoming = options.noChanges
    ? current
    : savedSetupFromForm(
        {
          ...DEFAULT_FORM_STATE,
          levels: { ...DEFAULT_FORM_STATE.levels, attack: 73 },
          trip: { ...DEFAULT_FORM_STATE.trip, bankSeconds: 30 },
          plannerTargets: { ...DEFAULT_FORM_STATE.plannerTargets, attack: 75 }
        },
        undefined,
        undefined,
        undefined,
        DEFAULT_FORM_STATE
      );
  return buildSetupImportReviewViewModel({
    id: 7,
    stale: options.stale ?? false,
    context: {
      match: "same-revision",
      tone: "warning",
      message:
        "Created with another Revision 274 snapshot. Available ids are compatible, but results may differ.",
      current: { gameDataId: "current", gameRevision: 274 },
      source: { gameDataId: "other", gameRevision: 274 }
    },
    changeReview: createSetupFileChangeReview({
      current,
      incoming,
      gameData: context.gameData
    })
  });
}

describe("setup import review", () => {
  it("renders complete grouped current-to-incoming disclosure without private implementation values", () => {
    const viewModel = reviewFixture();
    const markup = renderToStaticMarkup(
      <SetupImportReview
        viewModel={viewModel}
        onApply={() => {}}
        onRefresh={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(viewModel.artifactLabel).toBe("Combat setup file");
    expect(viewModel.changeSummary).toBe("3 changed fields");
    expect(viewModel.groups).toHaveLength(13);
    expect(markup).toContain('aria-label="Setup import review"');
    expect(markup).toContain("Included in this file (5)");
    expect(markup).toContain("Not included (6)");
    expect(markup).toContain("Current");
    expect(markup).toContain("Incoming");
    expect(markup).toContain("Player levels");
    expect(markup).toContain("Trip, supplies and banking");
    expect(markup).toContain("Planner targets");
    expect(markup).toContain("Apply imported setup");
    expect(markup).toContain("Dismiss");
    expect(markup).toContain("another Revision 274 snapshot");
    expect(markup).not.toContain("currentFingerprint");
    expect(markup).not.toContain("incomingFingerprint");
    expect(markup).not.toContain("savedAt");
    expect(markup).not.toContain("index-sim:rewrite-setup");
  });

  it("blocks stale and no-op review actions with truthful alternatives", () => {
    const stale = reviewFixture({ stale: true });
    const noOp = reviewFixture({ noChanges: true });
    const staleMarkup = renderToStaticMarkup(
      <SetupImportReview
        viewModel={stale}
        onApply={() => {}}
        onRefresh={() => {}}
        onDismiss={() => {}}
      />
    );
    const noOpMarkup = renderToStaticMarkup(
      <SetupImportReview
        viewModel={noOp}
        onApply={() => {}}
        onRefresh={() => {}}
        onDismiss={() => {}}
      />
    );

    expect(stale.canApply).toBe(false);
    expect(staleMarkup).toContain("Current setup changed after this review was prepared.");
    expect(staleMarkup).toContain("Refresh comparison");
    expect(staleMarkup).not.toContain("Apply imported setup");
    expect(noOp.noChanges).toBe(true);
    expect(noOpMarkup).toContain("No changes. This file matches the current setup.");
    expect(noOpMarkup).toContain('disabled=""');
    expect(noOpMarkup).not.toContain("Refresh comparison");
  });
});

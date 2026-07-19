import { renderToStaticMarkup } from "react-dom/server";
import { SetupImportReview } from "../app/components/shell/setup-import-review";
import { DEFAULT_FORM_STATE, savedSetupFromForm } from "../app/state/ui-state";
import { buildSetupImportReviewViewModel } from "../app/view-models/setup-import-review";

describe("setup import review", () => {
  it("shows only resolved metadata, bounded count changes and the complete consequence", () => {
    const current = savedSetupFromForm(DEFAULT_FORM_STATE);
    const viewModel = buildSetupImportReviewViewModel(
      {
        id: 7,
        context: {
          match: "same-revision",
          tone: "warning",
          message:
            "Created with another Revision 274 snapshot. Available ids are compatible, but results may differ.",
          current: { gameDataId: "current", gameRevision: 274 },
          source: { gameDataId: "other", gameRevision: 274 }
        },
        summary: {
          targetLabel: "Dagannoth",
          combatStyle: "ranged",
          setupMode: "custom",
          customSetupCount: 2,
          cannonMonsterCount: 1,
          denseSort: { key: "netGpPerHour", direction: "desc" },
          irrelevantMonsterCount: 3
        }
      },
      current
    );
    const markup = renderToStaticMarkup(
      <SetupImportReview viewModel={viewModel} onApply={() => {}} onDismiss={() => {}} />
    );

    expect(viewModel.rows).toEqual([
      { label: "Target", value: "Dagannoth" },
      { label: "Combat style", value: "Ranged" },
      { label: "Setup mode", value: "Custom" },
      { label: "Custom setups", value: "0 → 2" },
      { label: "Cannon settings", value: "0 → 1" },
      { label: "Dense sort", value: "Net GP/hr, descending" },
      { label: "Hidden / irrelevant", value: "0 → 3" }
    ]);
    expect(markup).toContain('aria-label="Setup import review"');
    expect(markup).toContain("Apply imported setup");
    expect(markup).toContain("Dismiss");
    expect(markup).toContain("another Revision 274 snapshot");
    expect(markup).toContain("active form, default form, setup mode, custom setups");
    expect(markup).not.toContain("rune_scimitar");
    expect(markup).not.toContain("savedAt");
    expect(markup).not.toContain("index-sim:rewrite-setup");
  });
});

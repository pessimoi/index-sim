import { renderToStaticMarkup } from "react-dom/server";
import { CrossTabConflictPanel } from "../app/components/settings/cross-tab-conflict-panel";

const actions = {
  toggle: () => undefined,
  refresh: () => undefined,
  useSavedData: () => undefined,
  keepCurrent: () => undefined,
  exportWorkspace: () => undefined
};

describe("CrossTabConflictPanel", () => {
  it("renders allowlisted metadata and disables unsafe invalid resolution", () => {
    const markup = renderToStaticMarkup(
      <CrossTabConflictPanel
        model={{
          conflicts: [
            {
              id: "rewrite-setup",
              label: "Rewrite setup",
              firstDetectedRevision: 1,
              latestDetectedRevision: 2,
              externalStatus: "valid"
            },
            {
              id: "price-history",
              label: "Price history",
              firstDetectedRevision: 3,
              latestDetectedRevision: 3,
              externalStatus: "invalid"
            }
          ],
          selectedIds: ["rewrite-setup"],
          notice: null,
          persistenceAvailable: true
        }}
        actions={actions}
      />
    );

    expect(markup).toContain("Data changed in another tab");
    expect(markup).toContain("Current values are still active");
    expect(markup).toContain("Download full Workspace backup");
    expect(markup).toContain("Invalid or unsupported saved data");
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain("savedAt");
    expect(markup).not.toContain("localStorage");
  });
});

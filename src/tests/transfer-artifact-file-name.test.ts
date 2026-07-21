import {
  TRANSFER_ARTIFACT_CONTEXT_MAX_LENGTH,
  TRANSFER_ARTIFACT_FILE_NAME_MAX_LENGTH,
  createTransferArtifactFileName
} from "../app/transfer-artifact-file-name";

const NOW = new Date("2026-07-21T14:32:05.987Z");

describe("transfer artifact filename contract", () => {
  it("builds every canonical artifact shape from one sortable UTC instant", () => {
    expect(
      createTransferArtifactFileName({
        artifact: "combat-setup",
        context: "Hill Giant",
        revision: 274,
        now: NOW
      })
    ).toBe("2004scape-combat-setup-hill-giant-rev-274-20260721T143205Z.json");
    expect(
      createTransferArtifactFileName({
        artifact: "saved-setup-collection",
        revision: 274,
        now: NOW
      })
    ).toBe("2004scape-saved-setup-collection-rev-274-20260721T143205Z.json");
    expect(
      createTransferArtifactFileName({
        artifact: "price-set",
        context: "scheduled",
        revision: 274,
        now: NOW
      })
    ).toBe("2004scape-price-set-scheduled-rev-274-20260721T143205Z.json");
    expect(
      createTransferArtifactFileName({
        artifact: "workspace-backup",
        revision: 274,
        now: NOW
      })
    ).toBe("2004scape-workspace-backup-rev-274-20260721T143205Z.json");
    expect(
      createTransferArtifactFileName({
        artifact: "local-state-recovery-report",
        now: NOW
      })
    ).toBe("2004scape-local-state-recovery-report-20260721T143205Z.json");
  });

  it.each([
    ["empty", "", "target"],
    ["whitespace", "  hill   giant  ", "hill-giant"],
    ["punctuation", "...Hill!!!Giant???", "hill-giant"],
    ["slashes", "../Hill\\Giant/private", "hill-giant-private"],
    ["control", "Hill\u0000\u001fGiant", "hill-giant"],
    ["unicode-only", "巨人ää", "target"]
  ])("sanitizes %s combat context to one bounded ASCII segment", (_case, context, expected) => {
    const fileName = createTransferArtifactFileName({
      artifact: "combat-setup",
      context,
      revision: 274,
      now: NOW
    });
    expect(fileName).toBe(`2004scape-combat-setup-${expected}-rev-274-20260721T143205Z.json`);
    expect(fileName).toMatch(/^[a-z0-9.TZ-]+$/);
    expect(fileName.startsWith(".")).toBe(false);
    expect(fileName.slice(0, -".json".length)).not.toContain("..");
  });

  it("uses the PriceSet fallback and enforces 48/160 character bounds", () => {
    expect(
      createTransferArtifactFileName({
        artifact: "price-set",
        context: " / . ",
        revision: "...",
        now: NOW
      })
    ).toBe("2004scape-price-set-active-rev-unknown-20260721T143205Z.json");

    const fileName = createTransferArtifactFileName({
      artifact: "price-set",
      context: `${"a".repeat(48)} z beyond`,
      revision: "9".repeat(200),
      now: NOW
    });
    const context = fileName.match(/^2004scape-price-set-([a-z0-9-]+)-rev-/)?.[1];
    const revision = fileName.match(/-rev-([a-z0-9-]+)-2026/)?.[1];
    expect(context).toHaveLength(TRANSFER_ARTIFACT_CONTEXT_MAX_LENGTH);
    expect(revision).toHaveLength(TRANSFER_ARTIFACT_CONTEXT_MAX_LENGTH);
    expect(fileName.length).toBeLessThanOrEqual(TRANSFER_ARTIFACT_FILE_NAME_MAX_LENGTH);
  });

  it("rejects an invalid clock value instead of emitting an ambiguous filename", () => {
    expect(() =>
      createTransferArtifactFileName({
        artifact: "local-state-recovery-report",
        now: "not-a-date"
      })
    ).toThrow("Invalid transfer artifact timestamp");
  });
});

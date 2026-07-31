import {
  getReleasePlan,
  releaseCommands,
  traceReleasePlan
} from "../../scripts/cloudflare-release-plan.mjs";

const QUALITY_IDS = [
  "typecheck",
  "architecture",
  "documentation",
  "test",
  "lint",
  "format",
  "diff"
];

describe("Cloudflare release stage plans", () => {
  it("keeps the developer quality plan provider-neutral and duplicate-free", () => {
    const ids = traceReleasePlan("quality");

    expect(ids).toEqual(QUALITY_IDS);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("build");
    expect(ids).not.toContain("artifact");
    expect(ids).not.toContain("dependency-audit");
    expect(getReleasePlan("quality").some((stage) => stage.id.startsWith("wrangler-"))).toBe(false);
    const testStage = getReleasePlan("quality").find((stage) => stage.id === "test");
    expect(testStage?.kind).toBe("node");
    if (!testStage || !("args" in testStage)) {
      throw new Error("Quality plan test stage must expose executable arguments");
    }
    expect(testStage.args).toContain("--maxWorkers=4");
  });

  it("composes handoff from quality and one build, artifact and audit stage", () => {
    const ids = traceReleasePlan("handoff");

    expect(ids.slice(0, QUALITY_IDS.length)).toEqual(QUALITY_IDS);
    expect(ids.filter((id) => id === "typecheck")).toHaveLength(1);
    expect(ids.filter((id) => id === "test")).toHaveLength(1);
    expect(ids.filter((id) => id === "build")).toHaveLength(1);
    expect(ids.filter((id) => id === "artifact")).toHaveLength(1);
    expect(ids.filter((id) => id === "dependency-audit")).toHaveLength(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds and verifies the exact artifact before every Wrangler operation", () => {
    expect(releaseCommands).toEqual(["quality", "handoff", "dry-run", "preview", "deploy"]);

    for (const command of ["dry-run", "preview", "deploy"] as const) {
      const ids = traceReleasePlan(command);
      expect(ids.slice(0, 3)).toEqual(["typecheck", "build", "artifact"]);
      expect(ids).toHaveLength(4);
      expect(ids[3]).toBe(`wrangler-${command}`);
    }
  });
});

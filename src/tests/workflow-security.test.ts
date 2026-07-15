import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const activeWorkflowDirectory = resolve(".github/workflows");
const archivedWorkflowPath = resolve(".github/disabled-workflows/update-market-prices.yml");
const workflow = readFileSync(archivedWorkflowPath, "utf8");

describe("disabled scheduled market workflow security", () => {
  it("keeps GitHub Actions disabled", () => {
    const activeWorkflows = existsSync(activeWorkflowDirectory)
      ? readdirSync(activeWorkflowDirectory).filter((file) => /\.ya?ml$/i.test(file))
      : [];

    expect(activeWorkflows).toEqual([]);
  });

  it("pins official actions to immutable commit SHAs", () => {
    const officialActionReferences = [
      ...workflow.matchAll(/uses:\s+actions\/(?:checkout|setup-node)@([^\s#]+)/g)
    ];

    expect(officialActionReferences).toHaveLength(2);
    for (const reference of officialActionReferences) {
      expect(reference[1]).toMatch(/^[a-f0-9]{40}$/);
    }
  });

  it("does not persist the write credential across dependency and validation steps", () => {
    expect(workflow).toMatch(
      /uses:\s+actions\/checkout@[a-f0-9]{40}[\s\S]*?persist-credentials:\s+false/
    );
    expect(workflow.match(/\$\{\{ github\.token \}\}/g)).toHaveLength(1);

    const commitStep = workflow.slice(workflow.indexOf("- name: Commit market snapshot diff"));
    expect(commitStep).toContain("GITHUB_TOKEN: ${{ github.token }}");
    expect(commitStep).toContain("http.https://github.com/.extraheader");
  });

  it("keeps the archived write workflow schedule-only if explicitly restored", () => {
    expect(workflow).toMatch(/^\s{2}schedule:/m);
    expect(workflow).not.toMatch(/^\s{2}(pull_request|pull_request_target|workflow_dispatch):/m);
  });
});

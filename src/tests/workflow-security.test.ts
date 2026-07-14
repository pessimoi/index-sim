import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflow = readFileSync(resolve(".github/workflows/update-market-prices.yml"), "utf8");

describe("scheduled market workflow security", () => {
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

  it("keeps the write workflow schedule-only", () => {
    expect(workflow).toMatch(/^\s{2}schedule:/m);
    expect(workflow).not.toMatch(/^\s{2}(pull_request|pull_request_target|workflow_dispatch):/m);
  });
});

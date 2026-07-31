import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import packageJson from "../../package.json";

const EXECUTABLE_LEGACY_PATTERNS = [
  /\bcreateLegacyRuntime\s*\(/,
  /\bloadBundledLegacyContext\s*\(/,
  /\brunLegacyCase\s*\(/,
  /\bcreateLegacyPlannerRuntime\s*\(/
] as const;

function testFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const filePath = join(root, entry.name);
    if (entry.isDirectory()) files.push(...testFiles(filePath));
    if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) files.push(filePath);
  }
  return files;
}

describe("archived legacy fixture boundary", () => {
  it("keeps executable archived runtime calls out of default Vitest files", () => {
    const offenders = testFiles("src/tests").flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return EXECUTABLE_LEGACY_PATTERNS.some((pattern) => pattern.test(source)) ? [filePath] : [];
    });

    expect(offenders).toEqual([]);
  });

  it("keeps manual legacy capture commands out of normal quality and handoff gates", () => {
    const normalGate = [
      packageJson.scripts.test,
      packageJson.scripts.quality,
      packageJson.scripts["verify:handoff"],
      packageJson.scripts.verify
    ].join("\n");

    expect(normalGate).not.toMatch(
      /fixtures:capture|planner:parity:capture|runtime:write-legacy-derived/
    );
  });
});

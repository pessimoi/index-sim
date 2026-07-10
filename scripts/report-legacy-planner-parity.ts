import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkPlannerParityBaseline,
  createPlannerParityBaseline,
  formatPlannerParityReport,
  runPlannerParityAudit,
  type PlannerParityBaseline
} from "../src/tests/helpers/planner-parity";

const BASELINE_FILE = "src/tests/fixtures/planner-parity-baseline.json";
const REPORT_FILE = "docs/project/planner-parity/current.md";

interface CliOptions {
  updateBaseline: boolean;
  allowNeedsReview: boolean;
}

export function parseArgs(args: readonly string[]): CliOptions {
  const known = new Set(["--update-baseline", "--allow-needs-review"]);
  const unknown = args.filter((arg) => !known.has(arg));
  if (unknown.length > 0) throw new Error("Unknown Planner parity report option.");
  return {
    updateBaseline: args.includes("--update-baseline"),
    allowNeedsReview: args.includes("--allow-needs-review")
  };
}

export function readPlannerParityBaseline(filePath: string): PlannerParityBaseline | undefined {
  if (!existsSync(filePath)) return undefined;
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as PlannerParityBaseline;
  if (parsed.version !== 1 || !Array.isArray(parsed.comparisons)) {
    throw new Error("Planner parity baseline is invalid.");
  }
  return parsed;
}

export function runPlannerParityReport(rootDir: string, options: CliOptions): number {
  const baselinePath = resolve(rootDir, BASELINE_FILE);
  const reportPath = resolve(rootDir, REPORT_FILE);
  const previous = readPlannerParityBaseline(baselinePath);
  const audit = runPlannerParityAudit();
  const baseline = options.updateBaseline ? createPlannerParityBaseline(audit, previous) : previous;

  if (!baseline) throw new Error("Planner parity baseline is missing.");
  if (options.updateBaseline) {
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  }

  const status = checkPlannerParityBaseline(audit, baseline);
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, formatPlannerParityReport(audit, baseline, status));

  process.stdout.write(
    `Planner parity: ${audit.caseCount} cases, ${audit.comparisonCount} comparisons, ` +
      `${status.needsReview.length} needs review, ${status.rewriteGaps.length} rewrite gaps.\n`
  );

  if (!status.valid) return 1;
  if (!options.allowNeedsReview && status.needsReview.length > 0) return 1;
  if (status.rewriteGaps.length > 0) return 1;
  return 0;
}

function main(): void {
  try {
    const exitCode = runPlannerParityReport(process.cwd(), parseArgs(process.argv.slice(2)));
    if (exitCode !== 0) process.exitCode = exitCode;
  } catch {
    process.stderr.write("Planner parity report failed.\n");
    process.exitCode = 1;
  }
}

function isDirectCliRun(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  const argvHasCurrentFile = process.argv.some((arg) => resolve(arg) === currentFile);
  const viteNodeScriptRun =
    process.env.VITEST !== "true" &&
    currentFile.replace(/\\/g, "/").endsWith("/scripts/report-legacy-planner-parity.ts");
  return argvHasCurrentFile || viteNodeScriptRun;
}

if (isDirectCliRun()) main();

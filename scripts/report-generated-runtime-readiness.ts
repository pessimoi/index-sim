import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createGeneratedRuntimeReadinessReport,
  type GeneratedRuntimeSource,
  type GeneratedRuntimeReadinessReport,
  type RuntimeCoverageSummary
} from "../src/adapters/generated/readiness";
import { createGeneratedRuntimePriceSet } from "../src/adapters/generated/price-fallback";
import {
  createGameDataSnapshotFromLegacy,
  createPriceSetFromLegacyGameData,
  parseJsonWithDuplicateKeyCheck,
  type LegacySnapshotInput
} from "../src/data";
import { parseGameDataSnapshot } from "../src/data/schemas/game-data";
import {
  ScheduledPriceProvenanceArtifactSchema,
  createPriceSetFromLegacyRecords,
  normalizePriceSetItemMetadata,
  PriceSetSchema
} from "../src/data/schemas/price-set";
import type { SimulationContext } from "../src/domain/shared";

export interface CliOptions {
  format: "markdown" | "json" | "coverage-plan";
  candidate: "generated" | "legacy-derived-static";
  exampleLimit: number;
  allowNotReady: boolean;
}

interface LegacySandbox extends Record<string, unknown> {
  window: LegacySandbox;
  GameData?: LegacySnapshotInput["gameData"];
  SimEngine?: LegacySnapshotInput["simEngine"];
  Equipment?: LegacySnapshotInput["equipment"];
  localStorage: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
}

export function usage(): string {
  return [
    "Usage: npm run runtime:readiness -- [--json] [--candidate generated|legacy-derived-static] [--example-limit <n>] [--allow-not-ready]",
    "",
    "Options:",
    "  --json             Print the readiness report as JSON.",
    "  --coverage-plan    Print a runtime catalog coverage plan view.",
    "  --candidate value  Candidate snapshot to compare. Defaults to generated.",
    "  --example-limit n  Limit missing/extra id examples per section.",
    "  --allow-not-ready  Exit successfully even when the generated runtime is not ready.",
    "  --help             Show this help."
  ].join("\n");
}

function readOptionValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    format: "markdown",
    candidate: "generated",
    exampleLimit: 5,
    allowNotReady: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--json") {
      options.format = "json";
      continue;
    }
    if (arg === "--coverage-plan") {
      options.format = "coverage-plan";
      continue;
    }
    if (arg === "--candidate") {
      const value = readOptionValue(argv, index, arg);
      if (value !== "generated" && value !== "legacy-derived-static") {
        throw new Error("--candidate must be generated or legacy-derived-static");
      }
      options.candidate = value;
      index += 1;
      continue;
    }
    if (arg === "--example-limit") {
      const value = Number(readOptionValue(argv, index, arg));
      if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
        throw new Error("--example-limit must be a non-negative integer");
      }
      options.exampleLimit = value;
      index += 1;
      continue;
    }
    if (arg === "--allow-not-ready") {
      options.allowNotReady = true;
      continue;
    }
    throw new Error(`Unknown argument ${arg}`);
  }

  return options;
}

function readRepoText(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

function readRepoJson(path: string): unknown {
  return parseJsonWithDuplicateKeyCheck(readRepoText(path), { source: path });
}

function executeLegacySource(sandbox: LegacySandbox, source: string, label: string): void {
  const runner = new Function(
    "window",
    "localStorage",
    "console",
    `${source}\n//# sourceURL=${label}`
  );
  runner(sandbox, sandbox.localStorage, console);
}

function createSandbox(): LegacySandbox {
  const storage = new Map<string, string>();
  const sandbox = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      }
    }
  } as LegacySandbox;
  sandbox.window = sandbox;
  return sandbox;
}

function loadLegacyReferenceContext(): SimulationContext {
  const sandbox = createSandbox();
  executeLegacySource(sandbox, readRepoText("gamedata.js"), "legacy-gamedata.js");
  executeLegacySource(sandbox, readRepoText("engine.js"), "legacy-engine.js");
  executeLegacySource(sandbox, readRepoText("equipment.js"), "legacy-equipment.js");

  if (!sandbox.GameData || !sandbox.SimEngine || !sandbox.Equipment) {
    throw new Error("Legacy bundled data did not expose GameData, SimEngine and Equipment");
  }

  return {
    gameData: createGameDataSnapshotFromLegacy({
      gameData: sandbox.GameData,
      simEngine: sandbox.SimEngine,
      equipment: sandbox.Equipment,
      id: "browser-legacy-runtime",
      label: "Browser bundled legacy runtime"
    }),
    priceSet: createPriceSetFromLegacyGameData({
      gameData: sandbox.GameData,
      id: "browser-legacy-prices",
      label: "Browser bundled legacy prices"
    })
  };
}

function loadGeneratedCandidateContext(candidate: CliOptions["candidate"]): SimulationContext {
  if (candidate === "legacy-derived-static") {
    return {
      gameData: parseGameDataSnapshot(
        readRepoJson("src/data/generated/legacy-derived-runtime-game-data.json")
      ),
      priceSet: normalizePriceSetItemMetadata(
        PriceSetSchema.parse(
          readRepoJson("src/data/generated/legacy-derived-runtime-price-set.json")
        ),
        { fallbackOrigin: "legacy-static", fallbackReasonCode: "legacy-metadata-unavailable" }
      )
    };
  }

  const gameData = parseGameDataSnapshot(readRepoJson("src/data/generated/game-data.json"));
  const priceProvenance = ScheduledPriceProvenanceArtifactSchema.parse(
    readRepoJson("price-provenance.json")
  );
  const scheduledPriceSet = createPriceSetFromLegacyRecords({
    id: "runtime-readiness-static-prices",
    label: "Runtime readiness static prices",
    source: "scraped",
    itemPrices: readRepoJson("prices.json"),
    itemPriceMetadata: priceProvenance.items,
    alchValues: {},
    provenance: {
      source: "generated",
      sourceRef: "prices.json + generated game data",
      notes:
        "Repo-local market prices plus authoritative generated high-alch values are used for runtime readiness coverage."
    }
  });
  return {
    gameData,
    priceSet: createGeneratedRuntimePriceSet(scheduledPriceSet, gameData)
  };
}

function sourceForCandidate(candidate: CliOptions["candidate"]): GeneratedRuntimeSource {
  return candidate === "legacy-derived-static"
    ? "legacy-derived-static-snapshot"
    : "generated-static-snapshot";
}

function exampleText(section: RuntimeCoverageSummary): string {
  const missing = section.missingExamples.length
    ? `missing: ${section.missingExamples.join(", ")}`
    : "";
  const extra = section.extraExamples.length ? `extra: ${section.extraExamples.join(", ")}` : "";
  return [missing, extra].filter(Boolean).join("; ") || "-";
}

export function formatGeneratedRuntimeReadinessMarkdown(
  report: GeneratedRuntimeReadinessReport
): string {
  const status = report.ready ? "ready" : "not ready";
  const lines = [
    "# Generated runtime readiness",
    "",
    `Status: ${status}`,
    `Source: ${report.source}`,
    `Reference snapshot: ${report.referenceSnapshotId}`,
    `Candidate snapshot: ${report.candidateSnapshotId}`,
    `Reference PriceSet: ${report.referencePriceSetId}`,
    `Candidate PriceSet: ${report.candidatePriceSetId}`,
    "Scope: coverage evidence only; source authority and runtime bootstrap approval are separate reviews.",
    `Price metadata: ${report.priceMetadata.metadataCount}/${report.priceMetadata.numericCount} rows; ${report.priceMetadata.generatedFallbackCount} generated fallbacks; ${report.priceMetadata.marketMappingsMissingNumeric.length} mapped prices missing.`,
    `Dynamic loot prices: ${report.dynamicLootPriceDependencies.mappedCount}/${report.dynamicLootPriceDependencies.dependencyCount} dependencies mapped; ${report.dynamicLootPriceDependencies.missingMappingCount} missing mappings; ${report.dynamicLootPriceDependencies.unrecognizedActiveTags.length} unrecognized active tags.`,
    "",
    "| Section | Blocking | Reference | Candidate | Matched | Missing | Extra | Examples |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.sections.map((section) =>
      [
        `| ${section.section}`,
        section.blocking ? "yes" : "no",
        String(section.referenceCount),
        String(section.candidateCount),
        String(section.matchedCount),
        String(section.missingCount),
        String(section.extraCount),
        `${exampleText(section)} |`
      ].join(" | ")
    ),
    "",
    "## Blockers",
    ...(report.blockers.length ? report.blockers.map((blocker) => `- ${blocker}`) : ["- none"])
  ];

  return `${lines.join("\n")}\n`;
}

function percent(value: number, total: number): string {
  if (total <= 0) return "n/a";
  return `${((value / total) * 100).toFixed(1)}%`;
}

function coveragePlanExamples(section: RuntimeCoverageSummary): string {
  if (!section.missingExamples.length) return "-";
  const suffix =
    section.missingIds.length > section.missingExamples.length
      ? `, +${section.missingIds.length - section.missingExamples.length} more`
      : "";
  return `${section.missingExamples.join(", ")}${suffix}`;
}

function coveragePlanRows(sections: RuntimeCoverageSummary[]): string[] {
  if (!sections.length) return ["| none | - | - | - | - |"];
  return sections.map((section) =>
    [
      `| ${section.section}`,
      String(section.referenceCount),
      String(section.candidateCount),
      `${section.missingCount} (${percent(section.missingCount, section.referenceCount)})`,
      `${coveragePlanExamples(section)} |`
    ].join(" | ")
  );
}

export function formatSourceSliceCoveragePlanMarkdown(
  report: GeneratedRuntimeReadinessReport
): string {
  const blocking = report.sections.filter(
    (section) => section.blocking && section.missingCount > 0
  );
  const nonBlocking = report.sections.filter(
    (section) => !section.blocking && section.missingCount > 0
  );
  const status = report.ready ? "ready" : "not ready";
  const nextWork = report.ready
    ? [
        "- Runtime coverage gaps are closed for this candidate.",
        "- Keep the committed source pin, revision-impact evidence and root bootstrap in sync for each reviewed revision bump.",
        "- Treat requirement quest state, conditional-loot activation and legacy deletion as separate decision boundaries."
      ]
    : [
        "- Expand the accepted raw parser or normalized contract fixtures until blocking sections have zero missing ids.",
        "- Do not promote an incomplete candidate into the committed root runtime until coverage and calculation-impact evidence are accepted.",
        "- Use `--json` for the complete `missingIds` and `extraIds` arrays when preparing runtime catalog expansion."
      ];
  const lines = [
    "# Source-backed runtime coverage plan",
    "",
    `Status: ${status}`,
    `Reference snapshot: ${report.referenceSnapshotId}`,
    `Candidate snapshot: ${report.candidateSnapshotId}`,
    `Reference PriceSet: ${report.referencePriceSetId}`,
    `Candidate PriceSet: ${report.candidatePriceSetId}`,
    "",
    "This report verifies the runtime ids and fields the source-backed generated snapshot must cover. It does not choose upstream fields or accept the legacy-derived comparison baseline as source truth.",
    "",
    "## Blocking Coverage Gaps",
    "",
    "| Section | Reference | Candidate | Missing | First missing ids |",
    "| --- | ---: | ---: | ---: | --- |",
    ...coveragePlanRows(blocking),
    "",
    "## Non-Blocking Coverage Gaps",
    "",
    "| Section | Reference | Candidate | Missing | First missing ids |",
    "| --- | ---: | ---: | ---: | --- |",
    ...coveragePlanRows(nonBlocking),
    "",
    "## Next Work",
    ...nextWork
  ];

  return `${lines.join("\n")}\n`;
}

export async function createReadinessReport(
  options: Pick<CliOptions, "candidate" | "exampleLimit">
): Promise<GeneratedRuntimeReadinessReport> {
  const legacy = loadLegacyReferenceContext();
  const generated = loadGeneratedCandidateContext(options.candidate);
  return createGeneratedRuntimeReadinessReport({
    reference: legacy,
    candidate: generated,
    source: sourceForCandidate(options.candidate),
    exampleLimit: options.exampleLimit
  });
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  const report = await createReadinessReport(options);

  if (options.format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else if (options.format === "coverage-plan") {
    console.log(formatSourceSliceCoveragePlanMarkdown(report));
  } else {
    console.log(formatGeneratedRuntimeReadinessMarkdown(report));
  }

  if (!report.ready && !options.allowNotReady) {
    process.exitCode = 1;
  }
}

function isDirectCliRun(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  const argvHasCurrentFile = process.argv.some((arg) => resolve(arg) === currentFile);
  const viteNodeScriptRun =
    process.env.VITEST !== "true" &&
    currentFile.replace(/\\/g, "/").endsWith("/scripts/report-generated-runtime-readiness.ts");
  return argvHasCurrentFile || viteNodeScriptRun;
}

if (isDirectCliRun()) {
  main().catch((error: unknown) => {
    console.error(
      `runtime:readiness failed: ${error instanceof Error ? error.message : "internal-error"}`
    );
    process.exitCode = 1;
  });
}

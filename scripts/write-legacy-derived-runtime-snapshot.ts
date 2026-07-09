import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLegacyRuntimeContextFromSources } from "../src/adapters/legacy-runtime/source-bootstrap";
import { GameDataSnapshotSchema, PriceSetSchema } from "../src/data/schemas";
import type { DataProvenance } from "../src/domain/shared";

const OUTPUT_PATHS = {
  gameData: "src/data/generated/legacy-derived-runtime-game-data.json",
  priceSet: "src/data/generated/legacy-derived-runtime-price-set.json"
} as const;

interface CliOptions {
  dryRun: boolean;
  check: boolean;
}

const LEGACY_DERIVED_RUNTIME_PROVENANCE = {
  source: "manual",
  sourceRef: "gamedata.js, engine.js and equipment.js via legacy runtime source bootstrap",
  verifiedAt: "2026-07-09",
  notes:
    "Legacy-derived static bridge for replacing root app runtime bootstrap execution. This is not authoritative LostCityRS/Content generated data."
} satisfies DataProvenance;

function usage(): string {
  return [
    "Usage: npm run runtime:write-legacy-derived -- [--dry-run] [--check]",
    "",
    "Options:",
    "  --dry-run  Print the output paths that would be written.",
    "  --check    Fail when committed legacy-derived runtime snapshots are stale.",
    "  --help     Show this help."
  ].join("\n");
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    check: false
  };

  for (const arg of argv) {
    if (arg === "--help") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--check") {
      options.check = true;
      continue;
    }
    throw new Error(`Unknown argument ${arg}`);
  }

  return options;
}

function readRepoText(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableSort(nested)])
  );
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`;
}

export function createLegacyDerivedRuntimeSnapshotTexts(): Record<
  keyof typeof OUTPUT_PATHS,
  string
> {
  const legacy = createLegacyRuntimeContextFromSources({
    gameDataSource: readRepoText("gamedata.js"),
    engineSource: readRepoText("engine.js"),
    equipmentSource: readRepoText("equipment.js")
  });

  const gameData = GameDataSnapshotSchema.parse({
    ...legacy.context.gameData,
    id: "legacy-derived-runtime-snapshot",
    label: "Legacy-derived static runtime snapshot",
    provenance: LEGACY_DERIVED_RUNTIME_PROVENANCE
  });
  const priceSet = PriceSetSchema.parse({
    ...legacy.context.priceSet,
    id: "legacy-derived-runtime-prices",
    label: "Legacy-derived static prices",
    provenance: LEGACY_DERIVED_RUNTIME_PROVENANCE
  });

  return {
    gameData: stableJson(gameData),
    priceSet: stableJson(priceSet)
  };
}

function checkExisting(path: string, nextText: string): void {
  const currentText = readRepoText(path);
  if (currentText !== nextText) {
    throw new Error(`${path} is stale. Run npm run runtime:write-legacy-derived.`);
  }
}

export function main(argv = process.argv.slice(2)): void {
  const options = parseArgs(argv);
  const outputs = createLegacyDerivedRuntimeSnapshotTexts();

  for (const [key, path] of Object.entries(OUTPUT_PATHS)) {
    const nextText = outputs[key as keyof typeof OUTPUT_PATHS];
    if (options.check) {
      checkExisting(path, nextText);
    } else if (!options.dryRun) {
      writeFileSync(resolve(path), nextText);
    }
    console.log(`${options.check ? "checked" : options.dryRun ? "would write" : "wrote"} ${path}`);
  }
}

function isDirectCliRun(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  const argvHasCurrentFile = process.argv.some((arg) => resolve(arg) === currentFile);
  const viteNodeScriptRun =
    process.env.VITEST !== "true" &&
    currentFile
      .replace(/\\/g, "/")
      .endsWith("/scripts/write-legacy-derived-runtime-snapshot.ts");
  return argvHasCurrentFile || viteNodeScriptRun;
}

if (isDirectCliRun()) {
  try {
    main();
  } catch (error) {
    console.error(
      `runtime:write-legacy-derived failed: ${
        error instanceof Error ? error.message : "internal-error"
      }`
    );
    process.exitCode = 1;
  }
}

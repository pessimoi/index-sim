import {
  GameDataGeneratorError,
  writeGeneratedGameDataOutputs
} from "./game-data-generator-core";

interface CliOptions {
  sourceDir?: string;
  outputRoot?: string;
  generatedAt?: string;
  dryRun: boolean;
}

function usage(): string {
  return [
    "Usage: npm run data:generate -- [--source-dir <path>] [--output-root <path>] [--dry-run]",
    "",
    "Options:",
    "  --source-dir <path>   Repository-local LostCityRS/Content checkout path.",
    "  --output-root <path>  Repository-local root for planned generated outputs.",
    "  --generated-at <iso>  Override generation timestamp for deterministic checks.",
    "  --dry-run             Validate and print the plan without writing files.",
    "  --help                Show this help."
  ].join("\n");
}

function readOptionValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new GameDataGeneratorError("invalid_argument", `Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--source-dir") {
      options.sourceDir = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--output-root") {
      options.outputRoot = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--generated-at") {
      options.generatedAt = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    throw new GameDataGeneratorError("invalid_argument", `Unknown argument ${arg}`);
  }

  return options;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const outputs = writeGeneratedGameDataOutputs({
    sourceDir: options.sourceDir,
    outputRoot: options.outputRoot,
    generatedAt: options.generatedAt,
    dryRun: options.dryRun
  });
  const mode = options.dryRun ? "Dry run" : "Foundation check";
  const changedLabel = outputs.changedFiles.length ? outputs.changedFiles.join(", ") : "no changes";
  console.log(`${mode}: ${changedLabel}.`);
  console.log(`Source: ${outputs.plan.sourceDirLabel}`);
  console.log(`Parser status: ${outputs.plan.parserStatus}.`);
  console.log(`Generated at: ${outputs.sourcePin.generatedAt}`);
  console.log(`Game data items: ${Object.keys(outputs.gameData.items).length}`);
  console.log(`Game data monsters: ${Object.keys(outputs.gameData.monsters).length}`);
  if (options.dryRun) console.log("No files were written.");
}

function reportError(error: unknown): void {
  if (error instanceof GameDataGeneratorError) {
    console.error(`data:generate failed: ${error.message}`);
  } else {
    console.error("data:generate failed: internal-error");
  }
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  reportError(error);
}

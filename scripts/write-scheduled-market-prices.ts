import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MARKET_SOURCE_MAPPINGS } from "../src/data/market-source-mapping";
import { parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import { MARKET_SOURCE_ID } from "../src/data/schemas";
import {
  ScheduledMarketWriterError,
  createScheduledMarketSnapshotOutputs,
  parseScheduledMarketUpstreamResponseJson
} from "./scheduled-market-writer-core";

const PRICE_FILE_NAMES = ["prices.json", "alch.json", "price-history.json"] as const;

interface CliOptions {
  input?: string;
  upstreamUrl?: string;
  outputDir: string;
  itemIds?: string[];
  now?: Date;
  dryRun: boolean;
}

function usage(): string {
  return [
    "Usage: npm run prices:write-scheduled -- --input <normalized-upstream.json>",
    "",
    "Options:",
    "  --input <path>          Read a repository-local normalized upstream fixture/response.",
    "  --upstream-url <url>    Fetch an explicit markets.lostcity.rs normalized response.",
    "  --output-dir <path>     Directory containing prices.json, alch.json and price-history.json.",
    "  --item-ids <ids>        Optional comma-separated allowlisted item ids for fixture/dev checks.",
    "  --now <iso>             Override capture time for repeatable local checks.",
    "  --dry-run               Validate and report changed files without writing.",
    "  --help                  Show this help."
  ].join("\n");
}

function readOptionValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new ScheduledMarketWriterError("invalid_upstream", `Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    outputDir: process.cwd(),
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--input") {
      options.input = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--upstream-url") {
      options.upstreamUrl = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--output-dir") {
      options.outputDir = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--item-ids") {
      options.itemIds = readOptionValue(argv, index, arg)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (arg === "--now") {
      const value = readOptionValue(argv, index, arg);
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        throw new ScheduledMarketWriterError("invalid_upstream", "Invalid --now timestamp");
      }
      options.now = parsed;
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    throw new ScheduledMarketWriterError("invalid_upstream", `Unknown argument ${arg}`);
  }

  if ((options.input ? 1 : 0) + (options.upstreamUrl ? 1 : 0) !== 1) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Provide exactly one of --input or --upstream-url"
    );
  }

  return options;
}

async function readUpstreamText(options: CliOptions): Promise<string> {
  if (options.input) {
    return readFileSync(resolve(options.input), "utf8");
  }

  const target = new URL(options.upstreamUrl ?? "");
  if (target.origin !== `https://${MARKET_SOURCE_ID}`) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Upstream URL must use the approved markets.lostcity.rs origin"
    );
  }

  const response = await fetch(target.href, {
    method: "GET",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Scheduled market upstream request failed"
    );
  }
  return response.text();
}

function readJsonFile(outputDir: string, fileName: (typeof PRICE_FILE_NAMES)[number]): unknown {
  return parseJsonWithDuplicateKeyCheck(readFileSync(resolve(outputDir, fileName), "utf8"), {
    source: fileName
  });
}

function selectMappings(itemIds: string[] | undefined) {
  if (!itemIds?.length) return MARKET_SOURCE_MAPPINGS;
  const requested = new Set(itemIds);
  const mappings = MARKET_SOURCE_MAPPINGS.filter((mapping) => requested.has(mapping.itemId));
  if (mappings.length !== requested.size) {
    throw new ScheduledMarketWriterError(
      "unknown_item",
      "The --item-ids option contains an item outside the approved mapping"
    );
  }
  return mappings;
}

function writeIfChanged(filePath: string, nextText: string, dryRun: boolean): boolean {
  let currentText = "";
  try {
    currentText = readFileSync(filePath, "utf8");
  } catch {
    currentText = "";
  }
  if (currentText === nextText) return false;
  if (!dryRun) writeFileSync(filePath, nextText);
  return true;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const outputDir = resolve(options.outputDir);
  const upstream = parseScheduledMarketUpstreamResponseJson(await readUpstreamText(options));
  const outputs = createScheduledMarketSnapshotOutputs({
    upstream,
    previousPrices: readJsonFile(outputDir, "prices.json"),
    previousAlchValues: readJsonFile(outputDir, "alch.json"),
    previousPriceHistory: readJsonFile(outputDir, "price-history.json"),
    mappings: selectMappings(options.itemIds),
    capturedAt: options.now
  });

  const changedFiles = [
    writeIfChanged(resolve(outputDir, "prices.json"), outputs.pricesText, options.dryRun)
      ? "prices.json"
      : null,
    writeIfChanged(resolve(outputDir, "alch.json"), outputs.alchText, options.dryRun)
      ? "alch.json"
      : null,
    writeIfChanged(
      resolve(outputDir, "price-history.json"),
      outputs.priceHistoryText,
      options.dryRun
    )
      ? "price-history.json"
      : null
  ].filter((fileName): fileName is string => fileName !== null);

  const mode = options.dryRun ? "Dry run" : "Writer";
  const changedLabel = changedFiles.length ? changedFiles.join(", ") : "no changes";
  console.log(
    `${mode}: ${changedLabel}. Updated ${outputs.report.updated}; skipped ${outputs.report.skipped}.`
  );
}

main().catch((error: unknown) => {
  if (error instanceof ScheduledMarketWriterError) {
    console.error(`Scheduled market writer failed: ${error.code}`);
  } else {
    console.error("Scheduled market writer failed: internal-error");
  }
  process.exitCode = 1;
});

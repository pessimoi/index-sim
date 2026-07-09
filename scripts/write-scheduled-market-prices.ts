import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MARKET_SOURCE_MAPPINGS } from "../src/data/market-source-mapping";
import { parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import { MARKET_SOURCE_ID } from "../src/data/schemas";
import type { MarketSourceMapping } from "../src/domain/shared";
import { parseMarketsLostcityRawResponseJson } from "./markets-lostcity-raw-adapter";
import {
  ScheduledMarketWriterError,
  createScheduledMarketSnapshotOutputs,
  parseScheduledMarketUpstreamResponseJson,
  type ScheduledMarketSnapshotOutputs,
  type ScheduledMarketWriterReport,
  type ScheduledMarketUpstreamResponse
} from "./scheduled-market-writer-core";

const PRICE_FILE_NAMES = ["prices.json", "alch.json", "price-history.json"] as const;

export interface CliOptions {
  input?: string;
  upstreamUrl?: string;
  outputDir: string;
  itemIds?: string[];
  now?: Date;
  dryRun: boolean;
}

interface FetchResponseLike {
  ok: boolean;
  text(): Promise<string>;
}

type FetchLike = (
  url: string,
  init: { method: "GET"; headers: { Accept: "application/json" } }
) => Promise<FetchResponseLike>;

export interface RunScheduledMarketWriterDependencies {
  fetchImpl?: FetchLike;
}

export interface RunScheduledMarketWriterResult {
  changedFiles: string[];
  outputs: ScheduledMarketSnapshotOutputs;
  report: ScheduledMarketWriterReport;
}

export function usage(): string {
  return [
    "Usage: npm run prices:write-scheduled -- --input <normalized-upstream.json>",
    "",
    "Options:",
    "  --input <path>          Read a repository-local normalized upstream fixture/response.",
    "  --upstream-url <url>    Fetch a raw markets.lostcity.rs response and normalize it.",
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

export function parseArgs(argv: string[]): CliOptions {
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

async function readUpstreamText(options: CliOptions, fetchImpl: FetchLike): Promise<string> {
  if (options.input) {
    return readFileSync(resolve(options.input), "utf8");
  }

  const target = parseApprovedUpstreamUrl(options.upstreamUrl);
  const response = await fetchImpl(target.href, {
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

function parseApprovedUpstreamUrl(upstreamUrl: string | undefined): URL {
  let target: URL;
  try {
    if (!upstreamUrl) throw new TypeError("missing URL");
    target = new URL(upstreamUrl);
  } catch {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Upstream URL must use the approved markets.lostcity.rs origin"
    );
  }

  if (
    target.origin !== `https://${MARKET_SOURCE_ID}` ||
    target.username !== "" ||
    target.password !== ""
  ) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Upstream URL must use the approved markets.lostcity.rs origin"
    );
  }
  return target;
}

async function readUpstream(
  options: CliOptions,
  mappings: readonly MarketSourceMapping[],
  fetchImpl: FetchLike
): Promise<ScheduledMarketUpstreamResponse> {
  const upstreamText = await readUpstreamText(options, fetchImpl);
  if (options.input) return parseScheduledMarketUpstreamResponseJson(upstreamText);
  return parseMarketsLostcityRawResponseJson(upstreamText, { mappings });
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

export async function runScheduledMarketWriter(
  argv: string[],
  dependencies: RunScheduledMarketWriterDependencies = {}
): Promise<RunScheduledMarketWriterResult> {
  const options = parseArgs(argv);
  const outputDir = resolve(options.outputDir);
  const mappings = selectMappings(options.itemIds);
  const upstream = await readUpstream(options, mappings, dependencies.fetchImpl ?? fetch);
  const outputs = createScheduledMarketSnapshotOutputs({
    upstream,
    previousPrices: readJsonFile(outputDir, "prices.json"),
    previousAlchValues: readJsonFile(outputDir, "alch.json"),
    previousPriceHistory: readJsonFile(outputDir, "price-history.json"),
    mappings,
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

  return { changedFiles, outputs, report: outputs.report };
}

export async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { changedFiles, report } = await runScheduledMarketWriter(process.argv.slice(2));

  const mode = options.dryRun ? "Dry run" : "Writer";
  const changedLabel = changedFiles.length ? changedFiles.join(", ") : "no changes";
  console.log(
    `${mode}: ${changedLabel}. Updated ${report.updated}; skipped ${report.skipped}.`
  );
}

function isDirectCliRun(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  const argvHasCurrentFile = process.argv.some((arg) => resolve(arg) === currentFile);
  const viteNodeScriptRun =
    process.env.VITEST !== "true" &&
    currentFile.replace(/\\/g, "/").endsWith("/scripts/write-scheduled-market-prices.ts");
  return argvHasCurrentFile || viteNodeScriptRun;
}

if (isDirectCliRun()) {
  main().catch((error: unknown) => {
    if (error instanceof ScheduledMarketWriterError) {
      console.error(`Scheduled market writer failed: ${error.code}`);
    } else {
      console.error("Scheduled market writer failed: internal-error");
    }
    process.exitCode = 1;
  });
}

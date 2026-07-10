import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MARKET_SOURCE_MAPPINGS } from "../src/data/market-source-mapping";
import { parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import { MARKET_SOURCE_ID, PRICE_SET_IMPORT_MAX_BYTES } from "../src/data/schemas";
import type { MarketSourceMapping } from "../src/domain/shared";
import {
  createMarketsLostcityItemPageResponse,
  parseMarketsLostcityItemPage
} from "./markets-lostcity-item-page-adapter";
import {
  ScheduledMarketWriterError,
  createScheduledMarketSnapshotOutputs,
  parseScheduledMarketUpstreamResponseJson,
  type ScheduledMarketSnapshotOutputs,
  type ScheduledMarketUpstreamItem,
  type ScheduledMarketWriterReport,
  type ScheduledMarketUpstreamResponse
} from "./scheduled-market-writer-core";

type PriceFileName = "prices.json" | "price-history.json";
export const SCHEDULED_MARKET_UPSTREAM_TIMEOUT_MS = 15_000;
export const SCHEDULED_MARKET_REQUEST_DELAY_MS = 350;

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
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}

type FetchLike = (
  url: string,
  init: {
    method: "GET";
    headers: { Accept: "application/json, text/html;q=0.9" };
    redirect: "error";
    signal: AbortSignal;
  }
) => Promise<FetchResponseLike>;

export interface RunScheduledMarketWriterDependencies {
  fetchImpl?: FetchLike;
  maxUpstreamBytes?: number;
  upstreamTimeoutMs?: number;
  requestDelayMs?: number;
  delayImpl?: (milliseconds: number) => Promise<void>;
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
    "  --upstream-url <url>    Fetch approved markets.lostcity.rs item pages from this root URL.",
    "  --output-dir <path>     Directory containing prices.json and price-history.json.",
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

function declaredContentLength(response: FetchResponseLike): number | null {
  const raw = response.headers.get("Content-Length");
  if (!raw || !/^\d+$/.test(raw)) return null;
  const bytes = Number(raw);
  return Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null;
}

async function readBoundedResponseText(
  response: FetchResponseLike,
  maxBytes: number,
  signal: AbortSignal
): Promise<string> {
  const declaredBytes = declaredContentLength(response);
  if (declaredBytes !== null && declaredBytes > maxBytes) {
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Scheduled market upstream response exceeds safe size limit"
    );
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteCount = 0;

  try {
    while (true) {
      if (signal.aborted) {
        throw new ScheduledMarketWriterError(
          "invalid_upstream",
          "Scheduled market upstream request timed out"
        );
      }
      const { done, value } = await reader.read();
      if (done) break;
      byteCount += value.byteLength;
      if (byteCount > maxBytes) {
        await reader.cancel();
        throw new ScheduledMarketWriterError(
          "invalid_upstream",
          "Scheduled market upstream response exceeds safe size limit"
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteCount);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchMarketItemPage(
  target: URL,
  fetchImpl: FetchLike,
  networkOptions: { maxBytes: number; timeoutMs: number }
): Promise<{ text: string; contentType: string }> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(
        new ScheduledMarketWriterError(
          "invalid_upstream",
          "Scheduled market upstream request timed out"
        )
      );
    }, networkOptions.timeoutMs);
  });

  const fetchAndRead = async () => {
    const response = await fetchImpl(target.href, {
      method: "GET",
      headers: { Accept: "application/json, text/html;q=0.9" },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new ScheduledMarketWriterError(
        "invalid_upstream",
        "Scheduled market upstream request failed"
      );
    }
    return {
      text: await readBoundedResponseText(response, networkOptions.maxBytes, controller.signal),
      contentType: response.headers.get("Content-Type") ?? ""
    };
  };

  try {
    return await Promise.race([fetchAndRead(), timeout]);
  } catch (error) {
    if (error instanceof ScheduledMarketWriterError) throw error;
    throw new ScheduledMarketWriterError(
      "invalid_upstream",
      "Scheduled market upstream request failed"
    );
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
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
    target.password !== "" ||
    target.hash !== "" ||
    target.search !== "" ||
    target.pathname !== "/"
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
  fetchImpl: FetchLike,
  networkOptions: {
    maxBytes: number;
    timeoutMs: number;
    requestDelayMs: number;
    delayImpl: (milliseconds: number) => Promise<void>;
  }
): Promise<ScheduledMarketUpstreamResponse> {
  if (options.input) {
    return parseScheduledMarketUpstreamResponseJson(readFileSync(resolve(options.input), "utf8"));
  }

  const root = parseApprovedUpstreamUrl(options.upstreamUrl);
  const items: ScheduledMarketUpstreamItem[] = [];
  for (const [index, mapping] of mappings.entries()) {
    if (index > 0 && networkOptions.requestDelayMs > 0) {
      await networkOptions.delayImpl(networkOptions.requestDelayMs);
    }
    const target = new URL(`/items/${encodeURIComponent(mapping.sourceSlug)}`, root);
    const response = await fetchMarketItemPage(target, fetchImpl, networkOptions);
    items.push(
      parseMarketsLostcityItemPage({
        text: response.text,
        contentType: response.contentType,
        mapping
      })
    );
  }

  return createMarketsLostcityItemPageResponse({
    items,
    fetchedAt: options.now ?? new Date()
  });
}

function readJsonFile(outputDir: string, fileName: PriceFileName): unknown {
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
  const currentText = (() => {
    try {
      return readFileSync(filePath, "utf8");
    } catch {
      return null;
    }
  })();
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
  const upstream = await readUpstream(options, mappings, dependencies.fetchImpl ?? fetch, {
    maxBytes: dependencies.maxUpstreamBytes ?? PRICE_SET_IMPORT_MAX_BYTES,
    timeoutMs: dependencies.upstreamTimeoutMs ?? SCHEDULED_MARKET_UPSTREAM_TIMEOUT_MS,
    requestDelayMs: dependencies.requestDelayMs ?? SCHEDULED_MARKET_REQUEST_DELAY_MS,
    delayImpl:
      dependencies.delayImpl ??
      ((milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds)))
  });
  const outputs = createScheduledMarketSnapshotOutputs({
    upstream,
    previousPrices: readJsonFile(outputDir, "prices.json"),
    previousPriceHistory: readJsonFile(outputDir, "price-history.json"),
    mappings,
    capturedAt: options.now
  });

  const changedFiles = [
    writeIfChanged(resolve(outputDir, "prices.json"), outputs.pricesText, options.dryRun)
      ? "prices.json"
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
  console.log(`${mode}: ${changedLabel}. Updated ${report.updated}; skipped ${report.skipped}.`);
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

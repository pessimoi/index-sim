import { spawn, spawnSync } from "node:child_process";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const projectRoot = resolve(fileURLToPath(new globalThis.URL("..", import.meta.url)));
const measurementPath = "/scripts/worker-measurement.html";
const timingKeys = [
  "workerCreateMs",
  "requestPostMs",
  "startupAndRequestDeliveryMs",
  "workerQueueMs",
  "executionMs",
  "responseDeliveryMs",
  "totalMs",
  "nonExecutionMs",
  "nonExecutionSharePct"
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseInteger(value, label, minimum, maximum) {
  if (!/^\d+$/.test(value ?? "")) fail(`${label} must be an integer`);
  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    fail(`${label} must be between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function parseArgs(argv) {
  let runs = 5;
  let port = 4179;
  let skipBuild = false;
  let summaryOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--skip-build") {
      skipBuild = true;
      continue;
    }
    if (argument === "--summary-only") {
      summaryOnly = true;
      continue;
    }
    if (argument === "--runs") {
      runs = parseInteger(argv[index + 1], "--runs", 1, 10);
      index += 1;
      continue;
    }
    if (argument === "--port") {
      port = parseInteger(argv[index + 1], "--port", 1024, 65535);
      index += 1;
      continue;
    }
    fail(`Unknown calculation worker measurement option: ${argument}`);
  }
  return { runs, port, skipBuild, summaryOnly };
}

function run(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, NODE: process.execPath }
  });
  if (result.error || result.status !== 0) {
    fail(`Calculation worker measurement prerequisite failed: ${args.join(" ")}`);
  }
}

async function waitForPreview(origin, child, previewOutput) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      fail(`Measurement preview exited before startup\n${previewOutput()}`.trim());
    }
    try {
      const response = await globalThis.fetch(`${origin}${measurementPath}`, {
        redirect: "error"
      });
      if (response.ok) return;
    } catch {
      // The bounded retry loop owns expected startup connection failures.
    }
    await new Promise((resolveDelay) => globalThis.setTimeout(resolveDelay, 100));
  }
  fail("Measurement preview did not become ready within 60 seconds");
}

function ordered(values) {
  return [...values].sort((left, right) => left - right);
}

function median(values) {
  const valuesInOrder = ordered(values);
  const middle = Math.floor(valuesInOrder.length / 2);
  return valuesInOrder.length % 2 === 1
    ? valuesInOrder[middle]
    : (valuesInOrder[middle - 1] + valuesInOrder[middle]) / 2;
}

function percentile(values, fraction) {
  const valuesInOrder = ordered(values);
  return valuesInOrder[Math.min(valuesInOrder.length - 1, Math.ceil(values.length * fraction) - 1)];
}

function rounded(value) {
  return Math.round(value * 1_000) / 1_000;
}

function withDerivedTiming(sample) {
  const nonExecutionMs = Math.max(0, sample.timing.totalMs - sample.timing.executionMs);
  return {
    ...sample,
    timing: {
      ...sample.timing,
      nonExecutionMs,
      nonExecutionSharePct:
        sample.timing.totalMs > 0 ? (nonExecutionMs / sample.timing.totalMs) * 100 : 0
    }
  };
}

function summarize(samples) {
  const summary = {};
  for (const key of timingKeys) {
    const values = samples.map((sample) => sample.timing[key]);
    summary[key] = {
      median: rounded(median(values)),
      p90: rounded(percentile(values, 0.9))
    };
  }
  summary.requestJsonBytes = Math.round(median(samples.map((sample) => sample.requestJsonBytes)));
  summary.resultJsonBytes = Math.round(median(samples.map((sample) => sample.resultJsonBytes)));
  summary.clocksAligned = samples.every((sample) => sample.timing.clockAligned);
  return summary;
}

async function openHarness(browser, origin) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}${measurementPath}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => typeof globalThis.__calculationWorkerMeasurement?.run === "function"
  );
  return { context, page };
}

async function measurePair(browser, origin, caseId) {
  const { context, page } = await openHarness(browser, origin);
  try {
    const runCase = (id) =>
      page.evaluate(
        (measurementCaseId) => globalThis.__calculationWorkerMeasurement.run(measurementCaseId),
        id
      );
    const cold = withDerivedTiming(await runCase(caseId));
    const warm = withDerivedTiming(await runCase(caseId));
    return { cold, warm };
  } finally {
    await context.close();
  }
}

const options = parseArgs(process.argv.slice(2));
if (!options.skipBuild) {
  run(process.execPath, ["node_modules/typescript/bin/tsc", "-b"]);
  run(process.execPath, [
    "node_modules/vite/bin/vite.js",
    "build",
    "--config",
    "scripts/vite-worker-measurement.config.ts"
  ]);
}

const origin = `http://127.0.0.1:${options.port}`;
const preview = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--config",
    "scripts/vite-worker-measurement.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    String(options.port),
    "--strictPort"
  ],
  { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] }
);
let previewOutput = "";
const capturePreviewOutput = (chunk) => {
  previewOutput = `${previewOutput}${chunk}`.slice(-4_000);
};
preview.stdout.on("data", capturePreviewOutput);
preview.stderr.on("data", capturePreviewOutput);

let browser;
try {
  await waitForPreview(origin, preview, () => previewOutput);
  browser = await chromium.launch();
  const probe = await openHarness(browser, origin);
  const cases = await probe.page.evaluate(() => globalThis.__calculationWorkerMeasurement.cases);
  await probe.context.close();
  const results = [];
  for (const definition of cases) {
    const pairs = [];
    for (let index = 0; index < options.runs; index += 1) {
      try {
        pairs.push(await measurePair(browser, origin, definition.id));
      } catch (error) {
        const detail = error instanceof Error ? error.message : "unknown browser failure";
        fail(
          `Calculation worker measurement failed for ${definition.id}, pair ${index + 1}/${options.runs}: ${detail}`
        );
      }
    }
    const cold = pairs.map((pair) => pair.cold);
    const warm = pairs.map((pair) => pair.warm);
    const coldResult = { summary: summarize(cold) };
    const warmResult = { summary: summarize(warm) };
    results.push({
      ...definition,
      cold: options.summaryOnly ? coldResult : { ...coldResult, samples: cold },
      warm: options.summaryOnly ? warmResult : { ...warmResult, samples: warm }
    });
  }
  console.log(
    JSON.stringify(
      {
        status: "measured",
        semantics: {
          cold: "first one-shot Worker in a new Chromium context",
          warm: "second one-shot Worker for the same case on the same page",
          payloadBytes: "UTF-8 JSON size, not an exact structured-clone allocation"
        },
        origin,
        runs: options.runs,
        summaryOnly: options.summaryOnly,
        browser: await browser.version(),
        runtime: {
          node: process.version,
          platform: process.platform,
          architecture: process.arch,
          cpu: cpus()[0]?.model ?? "unknown"
        },
        cases: results
      },
      null,
      2
    )
  );
} finally {
  await browser?.close();
  preview.kill("SIGTERM");
}

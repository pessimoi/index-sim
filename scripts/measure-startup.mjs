import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const projectRoot = resolve(fileURLToPath(new globalThis.URL("..", import.meta.url)));

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
  let port = 4178;
  let skipBuild = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--skip-build") {
      skipBuild = true;
      continue;
    }
    if (argument === "--runs") {
      runs = parseInteger(argv[index + 1], "--runs", 1, 20);
      index += 1;
      continue;
    }
    if (argument === "--port") {
      port = parseInteger(argv[index + 1], "--port", 1024, 65535);
      index += 1;
      continue;
    }
    fail(`Unknown startup measurement option: ${argument}`);
  }
  return { runs, port, skipBuild };
}

function run(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env, NODE: process.execPath }
  });
  if (result.error || result.status !== 0) {
    fail(`Startup measurement prerequisite failed: ${args.join(" ")}`);
  }
}

async function waitForPreview(origin, child, previewOutput) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      fail(`Preview server exited before startup measurement\n${previewOutput()}`.trim());
    }
    try {
      const response = await globalThis.fetch(origin, { redirect: "error" });
      if (response.ok) return;
    } catch {
      // The bounded retry loop owns expected startup connection failures.
    }
    await new Promise((resolveDelay) => globalThis.setTimeout(resolveDelay, 100));
  }
  fail("Preview server did not become ready within 60 seconds");
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function summarize(samples) {
  const numericKeys = [
    "appReadyMs",
    "shellReadyMs",
    "initialPaneReadyMs",
    "domContentLoadedMs",
    "loadMs",
    "firstContentfulPaintMs",
    "requestCount",
    "transferBytes",
    "decodedBodyBytes",
    "javascriptTransferBytes",
    "javascriptDecodedBodyBytes",
    "shellJavascriptRequestCount",
    "shellJavascriptTransferBytes",
    "shellJavascriptDecodedBodyBytes",
    "initialPaneJavascriptRequestCount",
    "initialPaneJavascriptTransferBytes",
    "initialPaneJavascriptDecodedBodyBytes"
  ];
  return Object.fromEntries(
    numericKeys.map((key) => [key, Math.round(median(samples.map((sample) => sample[key])))])
  );
}

async function readJavaScriptCheckpoint(page, prefix) {
  return page.evaluate((checkpointPrefix) => {
    const checkpointMs = Math.round(globalThis.performance.now());
    const resources = globalThis.performance
      .getEntriesByType("resource")
      .filter(
        (entry) =>
          (entry.initiatorType === "script" || entry.name.endsWith(".js")) &&
          entry.responseEnd <= checkpointMs
      );
    const sum = (key) =>
      Math.round(resources.reduce((total, entry) => total + (Number(entry[key]) || 0), 0));
    return {
      [`${checkpointPrefix}ReadyMs`]: checkpointMs,
      [`${checkpointPrefix}JavascriptRequestCount`]: resources.length,
      [`${checkpointPrefix}JavascriptTransferBytes`]: sum("transferSize"),
      [`${checkpointPrefix}JavascriptDecodedBodyBytes`]: sum("decodedBodySize"),
      [`${checkpointPrefix}JavaScriptPaths`]: resources.map(
        (entry) => new globalThis.URL(entry.name).pathname
      )
    };
  }, prefix);
}

async function readMetrics(page) {
  await page.locator('[data-app-startup-state="ready"]').waitFor({ state: "visible" });
  const shell = await readJavaScriptCheckpoint(page, "shell");
  await page
    .locator('#workbench-active-panel[data-pane-load-state="ready"]')
    .waitFor({ state: "visible" });
  const initialPane = await readJavaScriptCheckpoint(page, "initialPane");
  await page.waitForLoadState("load");
  const totals = await page.evaluate(() => {
    const navigation = globalThis.performance.getEntriesByType("navigation")[0];
    const resources = globalThis.performance.getEntriesByType("resource");
    const firstContentfulPaint = globalThis.performance
      .getEntriesByType("paint")
      .find((entry) => entry.name === "first-contentful-paint");
    const allEntries = [navigation, ...resources].filter(Boolean);
    const javaScriptResources = resources.filter(
      (entry) => entry.initiatorType === "script" || entry.name.endsWith(".js")
    );
    const sum = (entries, key) =>
      entries.reduce((total, entry) => total + (Number(entry[key]) || 0), 0);

    return {
      appReadyMs: Math.round(globalThis.performance.now()),
      domContentLoadedMs: Math.round(navigation?.domContentLoadedEventEnd ?? 0),
      loadMs: Math.round(navigation?.loadEventEnd ?? 0),
      firstContentfulPaintMs: Math.round(firstContentfulPaint?.startTime ?? 0),
      requestCount: allEntries.length,
      transferBytes: Math.round(sum(allEntries, "transferSize")),
      decodedBodyBytes: Math.round(sum(allEntries, "decodedBodySize")),
      javascriptTransferBytes: Math.round(sum(javaScriptResources, "transferSize")),
      javascriptDecodedBodyBytes: Math.round(sum(javaScriptResources, "decodedBodySize")),
      javaScriptResources: javaScriptResources.map((entry) => ({
        path: new globalThis.URL(entry.name).pathname,
        transferBytes: Math.round(entry.transferSize),
        decodedBodyBytes: Math.round(entry.decodedBodySize)
      }))
    };
  });
  return {
    ...totals,
    appReadyMs: shell.shellReadyMs,
    ...shell,
    ...initialPane
  };
}

async function measurePair(browser, origin) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  const cold = await readMetrics(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  const warm = await readMetrics(page);
  await context.close();
  return { cold, warm };
}

const options = parseArgs(process.argv.slice(2));
if (!options.skipBuild) {
  run(process.execPath, ["node_modules/typescript/bin/tsc", "-b"]);
  run(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--config", "vite.config.ts"]);
}

const origin = `http://127.0.0.1:${options.port}`;
const preview = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--config",
    "vite.config.ts",
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
  const pairs = [];
  for (let index = 0; index < options.runs; index += 1) {
    pairs.push(await measurePair(browser, origin));
  }
  const cold = pairs.map((pair) => pair.cold);
  const warm = pairs.map((pair) => pair.warm);
  console.log(
    JSON.stringify(
      {
        status: "measured",
        origin,
        runs: options.runs,
        browser: await browser.version(),
        cold: { median: summarize(cold), samples: cold },
        warm: { median: summarize(warm), samples: warm }
      },
      null,
      2
    )
  );
} finally {
  await browser?.close();
  preview.kill("SIGTERM");
}

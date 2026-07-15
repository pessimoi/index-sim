import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const projectRoot = resolve(fileURLToPath(new globalThis.URL("..", import.meta.url)));
const STARTUP_TIMEOUT_MS = 60_000;
const HTTP_TIMEOUT_MS = 30_000;
const VITE_OUTPUT_LIMIT = 8_000;
const REQUIRED_STARTUP_RESOURCE_TYPES = new Set([
  "document",
  "script",
  "stylesheet",
  "fetch",
  "xhr"
]);

function fail(message) {
  throw new Error(message);
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
  const [mode, ...argumentsAfterMode] = argv;
  if (mode !== "serve" && mode !== "check") {
    fail("Usage: node scripts/dev-startup.mjs serve|check [--port 1024-65535]");
  }

  let port = mode === "serve" ? 5173 : 4179;
  for (let index = 0; index < argumentsAfterMode.length; index += 1) {
    const argument = argumentsAfterMode[index];
    if (argument === "--port") {
      port = parseInteger(argumentsAfterMode[index + 1], "--port", 1024, 65535);
      index += 1;
      continue;
    }
    fail(`Unknown dev startup option: ${argument}`);
  }
  return { mode, port };
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => globalThis.setTimeout(resolveDelay, milliseconds));
}

function startVite(options) {
  const args = [
    "node_modules/vite/bin/vite.js",
    "--config",
    "vite.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    String(options.port),
    "--strictPort"
  ];
  if (options.mode === "check") args.push("--force");

  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    env: { ...process.env, NODE: process.execPath },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  const capture = (target, chunk) => {
    const text = String(chunk);
    output = `${output}${text}`.slice(-VITE_OUTPUT_LIMIT);
    target.write(text);
  };
  child.stdout.on("data", (chunk) => capture(process.stdout, chunk));
  child.stderr.on("data", (chunk) => capture(process.stderr, chunk));
  return { child, output: () => output };
}

async function waitForHttp(origin, vite) {
  const deadline = Date.now() + HTTP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (vite.child.exitCode !== null || vite.child.signalCode !== null) {
      fail(`Vite exited before HTTP readiness.\n${vite.output()}`.trim());
    }
    try {
      const response = await globalThis.fetch(`${origin}/`, { redirect: "error" });
      if (response.ok) return;
    } catch {
      // A bounded retry owns expected connection failures while Vite starts.
    }
    await delay(100);
  }
  fail(`Vite did not accept HTTP requests within ${HTTP_TIMEOUT_MS / 1_000} seconds.`);
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(5_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await once(child, "exit");
  }
}

async function launchChromium() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    fail("Playwright Chromium is unavailable. Install it with: npx playwright install chromium");
  }
}

async function installExternalRequestBlock(context, origin, failures) {
  await context.route("**/*", async (route) => {
    const requestUrl = new globalThis.URL(route.request().url());
    if (
      requestUrl.origin === origin ||
      requestUrl.protocol === "data:" ||
      requestUrl.protocol === "blob:"
    ) {
      await route.continue();
      return;
    }
    failures.push(`external request blocked: ${requestUrl.origin}${requestUrl.pathname}`);
    await route.abort("blockedbyclient");
  });
}

function observeStartupFailures(page, origin, failures, warnings, isReady) {
  page.on("pageerror", (error) => {
    if (!isReady()) failures.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (isReady()) return;
    if (message.type() === "error") failures.push(`console error: ${message.text()}`);
    if (message.type() === "warning") warnings.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (isReady()) return;
    const requestUrl = new globalThis.URL(request.url());
    if (
      requestUrl.origin === origin &&
      REQUIRED_STARTUP_RESOURCE_TYPES.has(request.resourceType())
    ) {
      failures.push(
        `request failed: ${request.method()} ${requestUrl.pathname} (${request.failure()?.errorText ?? "unknown"})`
      );
    }
  });
}

async function waitForStartupOutcome(page) {
  const outcome = await page.waitForFunction(
    () => {
      const markers = [...globalThis.document.querySelectorAll("[data-app-startup-state]")];
      if (markers.length > 1) return { state: "invalid", count: markers.length, text: "" };
      if (markers.length === 0) return null;
      const state = markers[0]?.getAttribute("data-app-startup-state");
      if (state !== "ready" && state !== "error") return null;
      return { state, count: 1, text: markers[0]?.textContent ?? "" };
    },
    undefined,
    { timeout: STARTUP_TIMEOUT_MS }
  );
  return outcome.jsonValue();
}

async function probeReady(browser, origin) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const failures = [];
  const warnings = [];
  let ready = false;
  try {
    await installExternalRequestBlock(context, origin, failures);
    observeStartupFailures(page, origin, failures, warnings, () => ready);
    const response = await page.goto(`${origin}/`, {
      waitUntil: "domcontentloaded",
      timeout: STARTUP_TIMEOUT_MS
    });
    if (!response?.ok()) failures.push(`document response was ${response?.status() ?? "missing"}`);

    const outcome = await waitForStartupOutcome(page);
    ready = outcome.state === "ready";
    if (!ready) failures.push(`startup state was ${outcome.state}`);
    const markerCount = await page.locator("[data-app-startup-state]").count();
    if (markerCount !== 1) failures.push(`startup marker count was ${markerCount}`);
    if (failures.length > 0) fail(failures.join("\n"));

    return { state: outcome.state, markerCount, warnings: warnings.length };
  } finally {
    await context.close();
  }
}

async function verifyPriceAssetRouting(origin) {
  const direct = await globalThis.fetch(`${origin}/prices.json`, {
    headers: { Accept: "application/json" },
    redirect: "error"
  });
  const directContentType = direct.headers.get("Content-Type") ?? "";
  if (!direct.ok || !directContentType.includes("application/json")) {
    fail(`Direct prices.json response was ${direct.status} ${directContentType}`);
  }
  JSON.parse(await direct.text());

  const head = await globalThis.fetch(`${origin}/prices.json`, {
    method: "HEAD",
    headers: { Accept: "application/json" },
    redirect: "error"
  });
  const headContentType = head.headers.get("Content-Type") ?? "";
  if (!head.ok || !headContentType.includes("application/json") || (await head.text()) !== "") {
    fail(`HEAD prices.json response was ${head.status} ${headContentType}`);
  }

  const transformed = await globalThis.fetch(`${origin}/prices.json?import&raw`, {
    headers: { Accept: "application/javascript" },
    redirect: "error"
  });
  const transformedContentType = transformed.headers.get("Content-Type") ?? "";
  const transformedBody = await transformed.text();
  if (
    !transformed.ok ||
    !transformedContentType.includes("javascript") ||
    !transformedBody.includes("export default")
  ) {
    fail(`Transformed prices.json response was ${transformed.status} ${transformedContentType}`);
  }

  return { directContentType, headContentType, transformedContentType };
}

async function probeControlledEntryFailure(browser, origin) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await context.route("**/*", async (route) => {
      const requestUrl = new globalThis.URL(route.request().url());
      if (requestUrl.origin !== origin) {
        await route.abort("blockedbyclient");
        return;
      }
      if (requestUrl.pathname === "/src/app/App.tsx") {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await page.goto(`${origin}/`, {
      waitUntil: "domcontentloaded",
      timeout: STARTUP_TIMEOUT_MS
    });
    const outcome = await waitForStartupOutcome(page);
    const markerCount = await page.locator("[data-app-startup-state]").count();
    if (outcome.state !== "error" || markerCount !== 1) {
      fail(`Controlled entry failure produced ${outcome.state} with ${markerCount} markers`);
    }
    if (!outcome.text.includes("The simulator could not start. Reload the page and try again.")) {
      fail("Controlled entry failure did not render the fixed sanitized startup error");
    }
    return { state: outcome.state, markerCount };
  } finally {
    await context.close();
  }
}

const options = parseArgs(process.argv.slice(2));
const origin = `http://127.0.0.1:${options.port}`;
const vite = startVite(options);
const forwardSignal = (signal) => {
  if (vite.child.exitCode === null && vite.child.signalCode === null) vite.child.kill(signal);
};
const forwardSigint = () => forwardSignal("SIGINT");
const forwardSigterm = () => forwardSignal("SIGTERM");
process.once("SIGINT", forwardSigint);
process.once("SIGTERM", forwardSigterm);

let browser;
let keepServer = false;
try {
  await waitForHttp(origin, vite);
  browser = await launchChromium();
  const ready = await probeReady(browser, origin);

  if (options.mode === "check") {
    const assets = await verifyPriceAssetRouting(origin);
    const controlledFailure = await probeControlledEntryFailure(browser, origin);
    console.log(
      JSON.stringify({ status: "passed", origin, ready, controlledFailure, assets }, null, 2)
    );
  } else {
    await browser.close();
    browser = undefined;
    keepServer = true;
    console.log(`APP_READY ${origin}/`);
    const [exitCode, signal] = await once(vite.child, "exit");
    if (exitCode !== 0 && signal === null) {
      fail(`Verified Vite server exited with code ${exitCode}.\n${vite.output()}`.trim());
    }
  }
} catch (error) {
  console.error(`DEV_STARTUP_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", forwardSigint);
  process.removeListener("SIGTERM", forwardSigterm);
  await browser?.close();
  if (!keepServer) await stopChild(vite.child);
}

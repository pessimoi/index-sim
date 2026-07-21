import { expect, test, type Page } from "@playwright/test";

const UNVISITED_PANE_CHUNK_STEMS = [
  "loadout-pane-",
  "duel-pane-",
  "loot-pane-",
  "trip-pane-",
  "risk-pane-",
  "cannon-pane-",
  "planner-pane-",
  "economy-settings-lazy-",
  "workspace-backup-panel-"
] as const;

function javaScriptPaths(page: Page): string[] {
  const paths: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() !== "script") return;
    paths.push(new URL(request.url()).pathname);
  });
  return paths;
}

async function savedStorageSnapshot(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify(
      Object.keys(localStorage)
        .sort()
        .map((key) => [key, localStorage.getItem(key)])
    )
  );
}

test("pane loading defers every unvisited feature chunk and names the initial pane", async ({
  page
}) => {
  const paths = javaScriptPaths(page);
  let releaseCompare: () => void = () => undefined;
  const compareGate = new Promise<void>((resolve) => {
    releaseCompare = resolve;
  });
  await page.route("**/assets/compare-pane-*.js", async (route) => {
    const response = await route.fetch();
    await compareGate;
    await route.fulfill({ response });
  });

  const navigation = page.goto("/");
  const activePanel = page.locator("#workbench-active-panel");
  await expect(activePanel).toHaveAttribute("data-pane-family", "compare");
  await expect(activePanel).toHaveAttribute("data-pane-load-state", "loading");
  await expect(activePanel).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status", { name: "Monsters" })).toHaveText("Loading Monsters…");
  releaseCompare();
  await navigation;
  await expect(activePanel).toHaveAttribute("data-pane-load-state", "ready");
  await expect(activePanel).not.toHaveAttribute("aria-busy", "true");

  expect(paths.some((path) => path.includes("compare-pane-"))).toBe(true);
  for (const stem of UNVISITED_PANE_CHUNK_STEMS) {
    expect(
      paths.some((path) => path.includes(stem)),
      `unexpected startup request: ${stem}`
    ).toBe(false);
  }
});

test("pane loading requests Risk once, preserves its mounted controls and does not steal focus", async ({
  page
}) => {
  const paths = javaScriptPaths(page);
  await page.goto("/");
  await expect(page.locator("#workbench-active-panel")).toHaveAttribute(
    "data-pane-load-state",
    "ready"
  );
  let releaseRisk: () => void = () => undefined;
  const riskGate = new Promise<void>((resolve) => {
    releaseRisk = resolve;
  });
  await page.route("**/assets/risk-pane-*.js", async (route) => {
    const response = await route.fetch();
    await riskGate;
    await route.fulfill({ response });
  });

  const riskTab = page.getByRole("tab", { name: "Risk" });
  await riskTab.click();
  await expect(riskTab).toBeFocused();
  await expect(page.getByRole("status", { name: "Risk" })).toHaveText("Loading Risk…");
  releaseRisk();
  await expect(page.locator("#workbench-active-panel")).toHaveAttribute(
    "data-pane-load-state",
    "ready"
  );
  await expect(riskTab).toBeFocused();

  const targetKills = page.getByLabel("Target kills");
  await targetKills.fill("42");
  await page.getByRole("tab", { name: "Stats" }).click();
  await page.getByRole("tab", { name: "Risk" }).click();
  await expect(targetKills).toHaveValue("42");
  expect(paths.filter((path) => path.includes("risk-pane-")).length).toBe(1);
});

test("pane loading reuses Economy for Settings and requests Workspace only for Settings", async ({
  page
}) => {
  const paths = javaScriptPaths(page);
  await page.goto("/");
  await expect(page.locator("#workbench-active-panel")).toHaveAttribute(
    "data-pane-load-state",
    "ready"
  );

  await page.getByRole("tab", { name: "Economy" }).click();
  await expect(page.locator("#workbench-active-panel")).toHaveAttribute(
    "data-pane-load-state",
    "ready"
  );
  await expect(page.getByRole("heading", { name: "Market" })).toBeVisible();
  expect(paths.filter((path) => path.includes("economy-settings-lazy-")).length).toBe(1);
  expect(paths.some((path) => path.includes("workspace-backup-panel-"))).toBe(false);

  await page.getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Workspace backup and restore" })).toBeVisible();
  expect(paths.filter((path) => path.includes("economy-settings-lazy-")).length).toBe(1);
  expect(paths.filter((path) => path.includes("workspace-backup-panel-")).length).toBe(1);
});

test("pane failure stays local, preserves saved storage and normal Reload recovers", async ({
  page
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("index-sim:pane-failure-sentinel", "keep me")
  );
  let abortTrip = true;
  await page.route("**/assets/trip-pane-*.js", async (route) => {
    if (abortTrip) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.goto("/");
  await expect(page.locator("#workbench-active-panel")).toHaveAttribute(
    "data-pane-load-state",
    "ready"
  );
  await expect
    .poll(() => page.evaluate(() => localStorage.length), { timeout: 10_000 })
    .toBeGreaterThan(1);
  await page.waitForTimeout(100);
  const before = await savedStorageSnapshot(page);

  await page.getByRole("tab", { name: "Trip" }).click();
  const failure = page.getByRole("alert", { name: "Trip" });
  await expect(failure).toContainText("This pane could not be loaded.");
  await expect(failure).not.toContainText("trip-pane-");
  await expect(failure.getByRole("button", { name: "Try pane again" })).toHaveCount(0);
  expect(await savedStorageSnapshot(page)).toBe(before);

  await page.getByRole("tab", { name: "Stats" }).click();
  await expect(page.getByLabel("Stats analysis")).toBeVisible();
  abortTrip = false;
  await page.getByRole("tab", { name: "Trip" }).click();
  await failure.getByRole("button", { name: "Reload simulator" }).click();
  await expect(page.getByRole("tab", { name: "Monsters" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(await savedStorageSnapshot(page)).toBe(before);

  await page.getByRole("tab", { name: "Trip" }).click();
  await expect(page.getByRole("heading", { name: "Trip assumptions" })).toBeVisible();
  expect(await savedStorageSnapshot(page)).toBe(before);
});

test("pane failure in Workspace leaves Settings siblings available", async ({ page }) => {
  await page.route("**/assets/workspace-backup-panel-*.js", (route) => route.abort("failed"));
  await page.goto("/");
  await page.getByRole("tab", { name: "Settings" }).click();

  await expect(page.getByRole("alert", { name: "Workspace tools" })).toContainText(
    "This pane could not be loaded."
  );
  await expect(page.getByRole("heading", { name: "Calculation context" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Price data" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Stats" })).toBeEnabled();
});

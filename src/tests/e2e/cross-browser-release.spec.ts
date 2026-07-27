import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { readDownloadText, searchableCombobox, searchableInput } from "./scaffold-fixture";

interface BrowserDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  externalRequests: string[];
}

const diagnostics = new WeakMap<BrowserContext, BrowserDiagnostics>();
const APP_ORIGIN = "http://127.0.0.1:5176";

function observePage(page: Page, current: BrowserDiagnostics): void {
  page.on("console", (message) => {
    if (message.type() === "error") current.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => current.pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== APP_ORIGIN) {
      current.externalRequests.push(url.origin);
    }
  });
}

function permittedInjectedPaneFailure(title: string, message: string): boolean {
  return (
    title.startsWith("CB-12") &&
    (message === "JSHandle@object" ||
      /Failed to load resource|dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(
        message
      ))
  );
}

test.beforeEach(async ({ context }) => {
  const current: BrowserDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    externalRequests: []
  };
  diagnostics.set(context, current);
  for (const page of context.pages()) observePage(page, current);
  context.on("page", (page) => observePage(page, current));
});

test.afterEach(async ({ context }, testInfo: TestInfo) => {
  const current = diagnostics.get(context);
  expect(current?.externalRequests ?? [], "live external requests").toEqual([]);
  expect(
    (current?.consoleErrors ?? []).filter(
      (message) => !permittedInjectedPaneFailure(testInfo.title, message)
    ),
    "unexpected browser console errors"
  ).toEqual([]);
  expect(
    (current?.pageErrors ?? []).filter(
      (message) => !permittedInjectedPaneFailure(testInfo.title, message)
    ),
    "unexpected unhandled page errors"
  ).toEqual([]);
});

async function waitForActivePane(page: Page, family: string) {
  const panel = page.locator("#workbench-active-panel");
  await expect(panel).toHaveAttribute("data-pane-family", family);
  await expect(panel).toHaveAttribute("data-pane-load-state", "ready", { timeout: 30_000 });
  return panel;
}

test("CB-01 startup and every split Workbench pane load", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("tablist", { name: "Workbench tabs" });
  const journeys = [
    ["Stats", "stats", page.getByRole("region", { name: "Stats analysis" })],
    ["Melee setup", "loadout", page.getByRole("region", { name: "Equipment loadout" })],
    ["Monsters", "compare", page.getByRole("region", { name: "Monster comparison" })],
    ["Setups", "duel", page.getByRole("region", { name: "Setup comparison", exact: true })],
    ["Loot", "loot", page.getByRole("region", { name: "Current monster loot" })],
    ["Trip", "trip", page.getByRole("region", { name: "Trip assumptions" })],
    ["Risk", "risk", page.getByRole("region", { name: "Risk", exact: true })],
    ["Cannon", "cannon", page.getByRole("region", { name: "Cannon", exact: true })],
    ["Planner", "planner", page.getByRole("region", { name: "Planner", exact: true })],
    ["Economy", "economy-settings", page.getByRole("region", { name: "Market price data" })],
    ["Settings", "economy-settings", page.getByRole("region", { name: "Calculation context" })]
  ] as const;

  for (const [tab, family, landmark] of journeys) {
    await tabs.getByRole("tab", { name: tab, exact: true }).click();
    await waitForActivePane(page, family);
    await expect(landmark).toBeVisible();
  }
  await expect(page.getByLabel("Workspace backup and restore")).toBeVisible();
});

test("CB-02 module Workers settle representative calculations", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.getByRole("status", { name: "Compare calculation status" })).toHaveText(
    "Current",
    { timeout: 30_000 }
  );
  await page.getByRole("tab", { name: "Stats" }).click();
  await expect(page.getByLabel("Stats analysis")).toBeVisible();
  if (isMobile) return;

  const tabs = page.getByRole("tablist", { name: "Workbench tabs" });
  await tabs.getByRole("tab", { name: "Planner" }).click();
  const planner = page.getByLabel("Planner", { exact: true });
  await planner.getByRole("button", { name: "Recompute plan" }).click();
  await expect(planner.getByText("ready", { exact: true })).toBeVisible({ timeout: 30_000 });

  await tabs.getByRole("tab", { name: "Risk" }).click();
  const risk = page.getByLabel("Risk", { exact: true });
  await risk.getByLabel("Target kills").fill("5");
  await risk.getByRole("button", { name: "Run analysis" }).click();
  await expect(risk.getByText("Ready", { exact: true })).toBeVisible({ timeout: 30_000 });

  await tabs.getByRole("tab", { name: "Setups" }).click();
  const duel = page.getByLabel("Setup comparison");
  await duel.getByRole("button", { name: "Save current setup" }).click();
  await duel.getByRole("button", { name: "All monsters" }).click();
  await expect(duel.getByRole("table", { name: "All-monster setup comparison" })).toBeVisible({
    timeout: 30_000
  });
});

test("CB-03 numeric, native select and searchable setup inputs work", async ({ page }) => {
  await page.goto("/");
  const player = page.getByLabel("Player setup");
  const attack = player.getByLabel("ATT", { exact: true });
  await attack.fill("12.5");
  await expect(attack).toHaveAttribute("aria-invalid", "true");
  await attack.press("Escape");
  await expect(attack).toHaveValue("60");
  await player.getByLabel("STYLE").selectOption("accurate");
  await expect(player.getByLabel("STYLE")).toHaveValue("accurate");

  const setupContext = page.getByRole("region", { name: "Setup context" });
  const target = searchableCombobox(setupContext, "Monster");
  await target.click();
  await searchableInput(setupContext, "Monster").fill("Black Dragon");
  await page
    .getByRole("listbox", { name: "Monster options" })
    .getByRole("option", { name: "Black Dragon", exact: true })
    .click();
  await expect(target).toHaveAttribute("data-selected-id", "black_dragon");
});

test("CB-04 browser-local setup, Duel, Loot, PriceSet and Planner state survive reload", async ({
  page
}) => {
  await page.goto("/");
  const tabs = page.getByRole("tablist", { name: "Workbench tabs" });
  const attack = page.getByLabel("Player setup").getByLabel("ATT", { exact: true });
  await attack.fill("70");
  await attack.press("Enter");

  await tabs.getByRole("tab", { name: "Setups" }).click();
  await page
    .getByLabel("Setup comparison")
    .getByRole("button", { name: "Save current setup" })
    .click();
  await tabs.getByRole("tab", { name: "Loot" }).click();
  await page.getByLabel("Current monster loot").getByLabel("High alch").selectOption("enabled");
  await tabs.getByRole("tab", { name: "Planner" }).click();
  await page.getByLabel("Planner controls").getByLabel("Optimize metric").selectOption("dps");

  await tabs.getByRole("tab", { name: "Economy" }).click();
  const advanced = page.getByLabel("Market price data").locator("details.advanced-price-set-tools");
  await advanced.locator(":scope > summary").click();
  const input = advanced.locator('input[type="file"]');
  await input.setInputFiles({
    name: "cross-browser-prices.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        id: "cross-browser-prices",
        label: "Cross-browser PriceSet",
        source: "imported",
        createdAt: "2026-07-21T00:00:00.000Z",
        itemPrices: { lobster: 321 },
        alchValues: {}
      })
    )
  });
  await expect(advanced.getByLabel("Price import notice")).toContainText("Cross-browser PriceSet");

  await page.reload();
  await expect(attack).toHaveValue("70");
  await tabs.getByRole("tab", { name: "Setups" }).click();
  await expect(page.getByLabel(/Rename saved setup/)).toHaveCount(1);
  await tabs.getByRole("tab", { name: "Loot" }).click();
  await expect(page.getByLabel("Current monster loot").getByLabel("High alch")).toHaveValue(
    "enabled"
  );
  await tabs.getByRole("tab", { name: "Planner" }).click();
  await expect(page.getByLabel("Planner controls").getByLabel("Optimize metric")).toHaveValue(
    "dps"
  );
  await tabs.getByRole("tab", { name: "Economy" }).click();
  await expect(page.getByLabel("Market active PriceSet summary")).toContainText(
    "Cross-browser PriceSet"
  );
});

test("CB-05 invalid local state recovery stays bounded and actionable", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("index-sim:hidden-gear-tiers", "broken"));
  await page.goto("/");
  const attention = page.getByRole("complementary", { name: "Local data needs review" });
  await expect(attention).toBeVisible();
  await attention.getByRole("button", { name: "Review local data" }).click();
  const recovery = page.getByLabel("Local state recovery");
  await expect(recovery).toContainText("Saved data is not valid JSON");
  await recovery.getByRole("button", { name: "Clear invalid local data" }).click();
  await recovery.getByRole("button", { name: "Confirm clear invalid local data" }).click();
  await expect(attention).toHaveCount(0);
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
});

test("CB-06 setup import and setup plus Workspace downloads dispatch", async ({ page }) => {
  await page.goto("/");
  const exportSetupButton = page.getByRole("button", { name: "Export combat setup" });
  await expect(exportSetupButton).toHaveAccessibleDescription(
    "Combat setup files replace setup, custom-monster, cannon and Dense preferences. They are not full Workspace backups and do not include loot or prices."
  );
  await expect(
    page.locator(".topbar").getByRole("button", { name: "Download full Workspace backup" })
  ).toHaveCount(0);
  const setupDownloadPromise = page.waitForEvent("download");
  await exportSetupButton.focus();
  await exportSetupButton.press("Enter");
  const setupDownload = await setupDownloadPromise;
  await expect(exportSetupButton).toBeFocused();
  const setupText = await readDownloadText(setupDownload);
  expect(setupDownload.suggestedFilename()).toMatch(
    /^2004scape-combat-setup-hill-giant-rev-274-\d{8}T\d{6}Z\.json$/
  );
  await page.getByLabel("Review combat setup file").setInputFiles({
    name: "index-sim-rewrite-setup.json",
    mimeType: "application/json",
    buffer: Buffer.from(setupText)
  });
  await expect(page.getByRole("region", { name: "Setup import review" })).toBeVisible();

  const settingsTab = page.getByRole("tab", { name: "Settings" });
  await settingsTab.focus();
  await settingsTab.press("Enter");
  const workspace = page.getByLabel("Workspace backup and restore");
  await expect(workspace).toContainText(
    "Download one versioned file containing the active local Workspace. Import prepares a read-only review and does not change this browser. It includes setup, Planner, Loot, saved setups, prices and local history. Calculated output, pending reviews and Undo are excluded."
  );
  const exportWorkspaceButton = workspace.getByRole("button", {
    name: "Download full Workspace backup"
  });
  const workspaceDownloadPromise = page.waitForEvent("download");
  await exportWorkspaceButton.focus();
  await exportWorkspaceButton.press("Enter");
  const workspaceDownload = await workspaceDownloadPromise;
  await expect(exportWorkspaceButton).toBeFocused();
  expect(workspaceDownload.suggestedFilename()).toMatch(
    /^2004scape-workspace-backup-rev-274-\d{8}T\d{6}Z\.json$/
  );
  expect(JSON.parse(await readDownloadText(workspaceDownload)).kind).toBe("index-sim-workspace");

  await page.evaluate(() => window.sessionStorage.setItem("index-sim:saved-data-ignored", "1"));
  await page.reload();
  await expect(page.getByRole("status", { name: "Session-only safe mode" })).toBeVisible();
  const attack = page.getByLabel("Player setup").getByLabel("ATT", { exact: true });
  await attack.fill("61");
  await attack.press("Enter");
  const sessionGuard = page.getByRole("status", { name: "Unsaved session-only changes" });
  await expect(sessionGuard).toContainText("Affected Workspace areas: 1");
  const sessionDownloadPromise = page.waitForEvent("download");
  await sessionGuard.getByRole("button", { name: "Download full Workspace backup" }).click();
  const sessionDownload = await sessionDownloadPromise;
  const sessionWorkspace = JSON.parse(await readDownloadText(sessionDownload)) as {
    areas: Array<{ id: string }>;
  };
  expect(sessionWorkspace.areas.map((area) => area.id)).toContain("rewrite-setup");
  await expect(page.getByRole("status", { name: "Session-only changes backed up" })).toContainText(
    "saving the file cannot be verified"
  );
});

test("CB-07 Share hash, dialog, clipboard fallback and focus return work", async ({
  page,
  context
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error("denied")) }
    });
  });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Share setup" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Share setup" });
  const shareUrl = await dialog.getByLabel("Setup link").inputValue();
  await dialog.getByRole("button", { name: "Copy" }).click();
  await expect(dialog).toContainText("Clipboard unavailable");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(trigger).toBeFocused();

  const recipient = await context.newPage();
  await recipient.goto(shareUrl);
  await expect(recipient.getByRole("region", { name: "Shared setup review" })).toBeVisible();
  expect(new URL(recipient.url()).hash).toBe("");
  await recipient.close();
});

test("CB-08 mocked same-origin Hiscores and committed market state remain usable", async ({
  page
}) => {
  await page.route("**/api/hiscores/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        source: { id: "cross-browser", label: "Cross-browser fixture" },
        limits: { requestsPerMinute: 30 }
      })
    })
  );
  await page.route("**/api/hiscores?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        player: "Fixture Player",
        normalizedPlayer: "Fixture Player",
        source: { id: "cross-browser", label: "Cross-browser fixture" },
        fetchedAt: "2026-07-21T00:00:00.000Z",
        skills: {
          attack: { level: 61 },
          strength: { level: 62 },
          defence: { level: 55 },
          hitpoints: { level: 60 },
          prayer: { level: 43 },
          ranged: { level: 50 },
          magic: { level: 50 }
        },
        warnings: []
      })
    })
  );
  await page.goto("/");
  const hiscores = page.getByLabel("Hiscores");
  await hiscores.getByLabel("Player", { exact: true }).fill("Fixture Player");
  await hiscores.getByRole("button", { name: "Lookup" }).click();
  await expect(page.getByRole("table", { name: "Hiscores preview" })).toBeVisible();
  await page.getByRole("tab", { name: "Economy" }).click();
  await expect(page.getByLabel("Market price data")).toContainText(
    "Automatic market upstream refresh is currently disabled."
  );
});

test("CB-09 skip link, tabs, Dense rows and popup keyboard stay operable", async ({ page }) => {
  await page.goto("/");
  const skip = page.getByRole("link", { name: "Skip to active workbench pane" });
  await skip.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tabpanel", { name: "Monsters" })).toBeFocused();
  const tabs = page.getByRole("tablist", { name: "Workbench tabs" });
  const monsters = tabs.getByRole("tab", { name: "Monsters" });
  await monsters.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "Setups" })).toBeFocused();
  await expect(page).toHaveURL(/[?&]pane=duel(?:[&#]|$)/);
  await page.goBack();
  await expect(monsters).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle("Monsters · Hill Giant · 2004scape Combat Simulator");
  await page.goForward();
  await expect(tabs.getByRole("tab", { name: "Setups" })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/[?&]pane=duel(?:[&#]|$)/);
  await page.reload();
  await expect(tabs.getByRole("tab", { name: "Setups" })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveTitle("Setups · Hill Giant · 2004scape Combat Simulator");
  await monsters.click();
  const row = page.getByRole("table", { name: "All monsters" }).locator('tbody tr[tabindex="0"]');
  await row.focus();
  await page.keyboard.press("ArrowDown");
  expect(
    await page.evaluate(() => document.activeElement?.getAttribute("data-monster-id"))
  ).toBeTruthy();
  const setupContext = page.getByRole("region", { name: "Setup context" });
  const target = searchableCombobox(setupContext, "Monster");
  await target.focus();
  await page.keyboard.press("Enter");
  await expect(searchableInput(setupContext, "Monster")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(target).toBeFocused();
});

test("CB-10 390px containment keeps tabs, popup and Dense table scroll owners bounded", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const setupContext = page.getByRole("region", { name: "Setup context" });
  await searchableCombobox(setupContext, "Monster").click();
  await expect(page.getByRole("listbox", { name: "Monster options" })).toBeVisible();
  await expect(page.getByRole("table", { name: "All monsters" })).toBeVisible({ timeout: 30_000 });
  const metrics = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    tabScroll: document.querySelector('[role="tablist"]')?.scrollWidth ?? 0,
    tabClient: document.querySelector('[role="tablist"]')?.clientWidth ?? 0,
    tableOverflow: document.querySelector<HTMLElement>(".dense-table-wrap")?.scrollWidth ?? 0,
    tableClient: document.querySelector<HTMLElement>(".dense-table-wrap")?.clientWidth ?? 0
  }));
  expect(metrics.body).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.tabScroll).toBeGreaterThan(metrics.tabClient);
  expect(metrics.tableOverflow).toBeGreaterThan(metrics.tableClient);
});

test("CB-11 cross-tab storage change is detected and can use saved data", async ({
  page,
  context
}) => {
  await page.goto("/");
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  await page.waitForFunction(() => localStorage.getItem("index-sim:rewrite-setup") !== null);
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.locator('[data-app-startup-state="ready"]')).toBeVisible();
  await second.waitForFunction(() => localStorage.getItem("index-sim:rewrite-setup") !== null);
  const firstAttack = page.getByLabel("Combat setup").getByLabel("ATT", { exact: true });
  await firstAttack.fill("70");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("index-sim:rewrite-setup") ?? "null")?.data?.form?.levels
        ?.attack === 70
  );
  const attention = second.getByRole("complementary", { name: "Data changed in another tab" });
  await expect(attention).toBeVisible();
  await attention.getByRole("button", { name: "Review conflicts" }).click();
  const review = second.getByRole("region", { name: "Data changed in another tab" });
  await review.getByRole("button", { name: "Use saved data" }).click();
  await expect(second.getByLabel("Combat setup").getByLabel("ATT", { exact: true })).toHaveValue(
    "70"
  );
  await second.close();
});

test("CB-12 a pane chunk failure is sanitized and leaves navigation usable", async ({ page }) => {
  await page.route("**/assets/trip-pane-*.js", (route) => route.abort("failed"));
  await page.goto("/");
  await page.getByRole("tab", { name: "Trip" }).click();
  const failure = page.getByRole("alert", { name: "Trip" });
  await expect(failure).toContainText("This pane could not be loaded.");
  await expect(failure).not.toContainText("trip-pane-");
  await page.getByRole("tab", { name: "Stats" }).click();
  await expect(page.getByLabel("Stats analysis")).toBeVisible();
});

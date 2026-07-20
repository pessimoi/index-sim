import {
  activeMonsterDefence,
  chooseSearchableOption,
  denseTableOverflowMetrics,
  expect,
  expectActiveDenseRow,
  expectInsideBox,
  expectPageWidthContained,
  expectPopupSearch,
  expectSearchableSelection,
  resultMetricSnapshot,
  searchableCombobox,
  selectCombatType,
  test
} from "./scaffold-fixture";

const MOBILE_RESULT_NAV_VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "wide mobile", width: 620, height: 844 },
  { name: "portrait tablet", width: 768, height: 1024 }
] as const;

test("loads the dense combat spreadsheet root", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "2004scape Combat Simulator" })).toBeVisible();
  const topbar = page.locator(".topbar");
  await expect(topbar).not.toContainText("Loaded scheduled prices");
  await expect(topbar).not.toContainText("generated item fallbacks");
  await expect(page.getByLabel("Workbench shell")).toBeVisible();
  await expect(page.getByLabel("Player sidebar")).toBeVisible();
  await expect(page.getByLabel("Workbench center")).toBeVisible();
  await expect(page.getByLabel("Monster card")).toBeVisible();
  const sidebarBox = await page.getByLabel("Player sidebar").boundingBox();
  const centerBox = await page.getByLabel("Workbench center").boundingBox();
  const cardBox = await page.getByLabel("Monster card").boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(centerBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  expect(centerBox!.x).toBeGreaterThan(sidebarBox!.x);
  expect(cardBox!.x).toBeGreaterThan(centerBox!.x);
  await expect(page.getByLabel("Workbench tabs").getByRole("tab")).toHaveText([
    "Stats",
    "Melee setup",
    "Monsters",
    "Setups",
    "Loot",
    "Trip",
    "Risk",
    "Cannon",
    "Planner",
    "Economy",
    "Settings"
  ]);
  await expect(page.getByLabel("Dense combat spreadsheet")).toBeVisible();
  await expect(page.getByLabel("Combat setup")).toBeVisible();
  await expect(page.getByLabel("Simulation results")).toBeVisible();
  await expect(page.getByLabel("Active assumptions")).toBeVisible();
  await expect(page.getByLabel("Monster stats")).toBeVisible();
  await expect(activeMonsterDefence(page.getByLabel("Monster card"))).toContainText(
    "Slash defence"
  );
  await expect(page.getByRole("table", { name: "All monsters" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All monsters", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sort by gold pieces per kill" })).toBeVisible();
  await expect(page.getByLabel(/Food per kill: /)).toBeVisible();
  await expect(page.getByText("F/KL", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Simulation results").getByText("DPS", { exact: true })
  ).toBeVisible();
  const hiscores = page.getByRole("region", { name: "Hiscores" });
  await expect(hiscores).toBeVisible();
  await expect(page.locator(".topbar").getByRole("region", { name: "Hiscores" })).toBeVisible();
  const hiscoresBox = await hiscores.boundingBox();
  expect(hiscoresBox).not.toBeNull();
  expect(hiscoresBox!.x).toBeLessThan(340);
  await expect(
    page.locator(".player-sidebar").getByRole("region", { name: "Hiscores" })
  ).toHaveCount(0);
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const market = page.locator('section[aria-label="Market price data"]');
  await expect(
    market.getByText("Automatic market upstream refresh is currently disabled.").first()
  ).toBeVisible();
  await expect(market.getByLabel("Scheduled price snapshot summary")).toContainText(
    "Status Loaded"
  );
  await expect(page.getByText("run_sim.py")).toHaveCount(0);
  await expect(page.getByText("/api/prices")).toHaveCount(0);
  await expect(page.getByText("/api/scrape")).toHaveCount(0);
});

test("supports bounded keyboard navigation for workbench tabs and Dense rows", async ({ page }) => {
  await page.goto("/");

  const skipLink = page.getByRole("link", { name: "Skip to active workbench pane" });
  await expect(skipLink).toBeAttached();
  const firstFocusableLabel = await page.evaluate(() => {
    const first = document.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    return first?.textContent?.trim() ?? null;
  });
  expect(firstFocusableLabel).toBe("Skip to active workbench pane");
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tabpanel", { name: "Monsters" })).toBeFocused();
  expect(new URL(page.url()).hash).toBe("");

  const tablist = page.getByRole("tablist", { name: "Workbench tabs" });
  const compareTab = tablist.getByRole("tab", { name: "Monsters" });
  await expect(compareTab).toHaveAttribute("aria-selected", "true");
  await expect(compareTab).toHaveAttribute("tabindex", "0");
  await expect(tablist.getByRole("tab", { name: "Stats" })).toHaveAttribute("tabindex", "-1");

  await compareTab.focus();
  await page.keyboard.press("ArrowRight");
  const setupsTab = tablist.getByRole("tab", { name: "Setups" });
  await expect(setupsTab).toBeFocused();
  await expect(setupsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Setups" })).toBeVisible();

  await page.keyboard.press("End");
  const settingsTab = tablist.getByRole("tab", { name: "Settings" });
  await expect(settingsTab).toBeFocused();
  await expect(settingsTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  const statsTab = tablist.getByRole("tab", { name: "Stats" });
  await expect(statsTab).toBeFocused();
  await expect(statsTab).toHaveAttribute("aria-selected", "true");

  await compareTab.click();
  const table = page.getByRole("table", { name: "All monsters" });
  const tabbableRows = table.locator('tbody tr[data-monster-id][tabindex="0"]');
  await expect(tabbableRows).toHaveCount(1);
  const selectedRow = tabbableRows;
  const selectedMonsterId = await selectedRow.getAttribute("data-monster-id");
  await selectedRow.focus();
  await page.keyboard.press("ArrowDown");
  const focusedMonsterId = await page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset.monsterId ?? null
  );
  expect(focusedMonsterId).not.toBe(selectedMonsterId);
  await expect(selectedRow).toHaveAttribute("aria-selected", "true");
  const focusedOutline = await page.evaluate(() => {
    const element = document.activeElement;
    return element ? getComputedStyle(element).outlineStyle : "none";
  });
  expect(focusedOutline).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(table.locator(`tbody tr[data-monster-id="${focusedMonsterId}"]`)).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(tabbableRows).toHaveCount(1);
});

test("keeps hiscores disabled fallback focused on manual Player levels", async ({ page }) => {
  let lookupRequested = false;
  await page.route("**/api/hiscores/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: false,
        source: { id: "disabled", label: "Hiscores provider disabled" },
        limits: { requestsPerMinute: 30 }
      })
    });
  });
  await page.route("**/api/hiscores?*", async (route) => {
    lookupRequested = true;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "upstream-unavailable", message: "Hiscores provider is unavailable" }
      })
    });
  });

  await page.goto("/");
  const hiscores = page.getByRole("region", { name: "Hiscores" });
  const playerLevels = page.getByLabel("Player levels");

  await expect(hiscores.getByLabel("Player", { exact: true })).toBeVisible();
  await expect(hiscores.getByLabel("Player", { exact: true })).toBeEnabled();
  await expect(hiscores.getByRole("button", { name: "Lookup" })).toBeDisabled();
  await expect(hiscores).toContainText("Live hiscores lookup is not configured in this run.");
  await expect(hiscores).toContainText(
    "Use the Player level fields above to edit levels manually."
  );

  await playerLevels.getByLabel("ATT", { exact: true }).fill("66");
  await playerLevels.getByLabel("STR", { exact: true }).fill("67");
  await expect(playerLevels.getByLabel("ATT", { exact: true })).toHaveValue("66");
  await expect(playerLevels.getByLabel("STR", { exact: true })).toHaveValue("67");
  await expect(page.getByText("run_sim.py")).toHaveCount(0);
  expect(lookupRequested).toBe(false);
});

test("renders scheduled price status and keeps local PriceSet overrides separate", async ({
  page
}) => {
  await page.route("**/price-history.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  let refreshRequested = false;
  await page.route("**/api/market/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: false,
        source: { id: "disabled", label: "Market provider disabled" },
        cache: { enabled: false },
        limits: { maxItemsPerRequest: 200, requestsPerSecond: 20 }
      })
    });
  });
  await page.route("**/api/market/sync", async (route) => {
    refreshRequested = true;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "upstream-unavailable", message: "Market provider is unavailable" }
      })
    });
  });

  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const market = page.locator('section[aria-label="Market price data"]');
  const activePriceSetSummary = market.getByLabel("Market active PriceSet summary");
  const scheduledSummary = market.getByLabel("Scheduled price snapshot summary");

  await expect(market).toContainText("Automatic market upstream refresh is currently disabled.");
  await expect(scheduledSummary).toContainText("Status Loaded");
  await expect(scheduledSummary).toContainText("Label Scheduled static prices");
  await expect(activePriceSetSummary).toContainText("Active source Scheduled snapshot");
  await expect(activePriceSetSummary).toContainText("Label Scheduled static prices");
  await expect(activePriceSetSummary).toContainText("Source scraped");
  await expect(activePriceSetSummary).toContainText(/Item prices [0-9,]+/);
  await expect(activePriceSetSummary).toContainText(/Alch values [0-9,]+/);
  await expect(market.getByRole("button", { name: /Sync/ })).toHaveCount(0);

  const importedPriceSet = {
    id: "manual-disabled-market",
    label: "Disabled market imported prices",
    source: "manual",
    createdAt: "2026-07-07T12:00:00.000Z",
    itemPrices: { big_bones: 910, lobster: 90 },
    alchValues: { big_bones: 0, lobster: 0 }
  };
  const advancedPriceSetTools = market.locator("details.advanced-price-set-tools");
  await expect(advancedPriceSetTools).not.toHaveAttribute("open", "");
  await advancedPriceSetTools.locator(":scope > summary").click();
  await expect(advancedPriceSetTools).toContainText(
    "Importing replaces the complete local base PriceSet"
  );
  await expect(advancedPriceSetTools).toContainText("Missing items are not merged");
  await advancedPriceSetTools
    .locator("label.file-button")
    .filter({ hasText: "Import full PriceSet" })
    .locator('input[type="file"]')
    .setInputFiles({
      name: "disabled-market-prices.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(importedPriceSet))
    });

  await expect(market.getByLabel("Price import notice")).toContainText("Imported market prices");
  await expect(activePriceSetSummary).toContainText("Label Disabled market imported prices");
  await expect(activePriceSetSummary).toContainText("Active source Local override");
  await expect(activePriceSetSummary).toContainText("Source manual");
  await expect(activePriceSetSummary).toContainText("Item prices 2");
  await expect(activePriceSetSummary).toContainText(/Alch values [1-9][0-9,]*/);
  await expect(page.getByLabel("Price history summary")).toContainText("Snapshots 1");
  await expect(market.getByRole("button", { name: /Sync/ })).toHaveCount(0);

  const persistedHistory = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("index-sim:price-history") ?? "null")
  );
  expect(persistedHistory).toMatchObject({
    version: 2,
    data: {
      snapshots: [
        {
          sourcePriceSetId: "manual-disabled-market",
          label: "Disabled market imported prices",
          itemPrices: { big_bones: 910, lobster: 90 }
        }
      ]
    }
  });
  const persistedSelected = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("index-sim:price-set:selected") ?? "null")
  );
  expect(persistedSelected).toMatchObject({
    version: 2,
    data: {
      selectedAt: expect.any(String),
      priceSet: {
        id: "manual-disabled-market",
        label: "Disabled market imported prices",
        source: "manual",
        itemPrices: { big_bones: 910, lobster: 90 }
      }
    }
  });
  expect(persistedSelected.data.priceSet.alchValues.lobster).not.toBe(0);
  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const reloadedMarket = page.locator('section[aria-label="Market price data"]');
  const reloadedActivePriceSetSummary = reloadedMarket.getByLabel("Market active PriceSet summary");
  await expect(reloadedActivePriceSetSummary).toContainText(
    "Label Disabled market imported prices"
  );
  await expect(reloadedActivePriceSetSummary).toContainText("Source manual");
  await expect(page.getByLabel("Price history summary")).toContainText("Snapshots 1");

  const reloadedAdvancedPriceSetTools = reloadedMarket.locator("details.advanced-price-set-tools");
  await expect(reloadedAdvancedPriceSetTools).not.toHaveAttribute("open", "");
  await reloadedAdvancedPriceSetTools.locator(":scope > summary").click();
  await reloadedAdvancedPriceSetTools
    .getByRole("button", { name: "Reset imported PriceSet" })
    .click();
  await expect(reloadedMarket).toContainText("Confirm reset to scheduled prices");
  await reloadedMarket.getByRole("button", { name: "Confirm reset to scheduled prices" }).click();
  await expect(reloadedActivePriceSetSummary).toContainText("Active source Scheduled snapshot");
  await expect(reloadedActivePriceSetSummary).toContainText("Label Scheduled static prices");
  await expect(reloadedActivePriceSetSummary).toContainText("Source scraped");
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:price-set:selected"))
  ).toBeNull();
  const historyAfterReset = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("index-sim:price-history") ?? "null")
  );
  expect(historyAfterReset.data.snapshots).toHaveLength(1);
  expect(historyAfterReset.data.snapshots[0].sourcePriceSetId).toBe("manual-disabled-market");

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  await expect(page.getByLabel("Market active PriceSet summary")).toContainText(
    "Label Scheduled static prices"
  );
  expect(refreshRequested).toBe(false);
});

test("shows Stats XP routing and trip summary plus setup damage distribution", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");

  const playerSidebar = page.getByLabel("Player sidebar");
  const activePlayerSetup = playerSidebar.getByLabel("Active player setup");
  const setupContext = page.getByLabel("Setup context");
  await expect(playerSidebar.getByLabel("Mobile result summary")).toBeHidden();
  await expect(activePlayerSetup).toContainText("Rune scimitar");
  await expect(activePlayerSetup).toContainText("Attack speed");
  await expect(activePlayerSetup).toContainText("Effective levels");
  await expect(activePlayerSetup).toContainText("Requirements met");
  await expect(activePlayerSetup.getByRole("button", { name: "Melee setup" })).toBeVisible();
  await expect(activePlayerSetup.getByRole("button", { name: "View stats" })).toBeVisible();
  await playerSidebar.getByRole("button", { name: "ranged", exact: true }).click();
  await expect(activePlayerSetup.getByRole("button", { name: "Ranged setup" })).toBeVisible();
  await playerSidebar.getByRole("button", { name: "magic", exact: true }).click();
  await expect(activePlayerSetup.getByRole("button", { name: "Magic setup" })).toBeVisible();
  await playerSidebar.getByRole("button", { name: "melee", exact: true }).click();
  await expect(activePlayerSetup.getByRole("button", { name: "Melee setup" })).toBeVisible();
  await expect(setupContext).toContainText("DPS");
  await expect(setupContext).toContainText("Effective XP/hr");
  await expect(setupContext).toContainText("Net GP/hr");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Stats" }).click();

  const analysis = page.getByLabel("Stats analysis");
  await expect(analysis).toBeVisible();
  await expect(page.getByLabel("Active assumptions")).toBeVisible();

  const sourceBreakdown = analysis.getByRole("region", {
    name: "Source breakdown",
    exact: true
  });
  await expect(sourceBreakdown).toBeVisible();
  await expect(sourceBreakdown.getByRole("list", { name: "Source breakdown rows" })).toBeVisible();
  await expect(
    sourceBreakdown.getByRole("listitem", { name: /Normal attack: modeled/i })
  ).toContainText("DPS");
  await expect(
    sourceBreakdown.getByRole("listitem", { name: /Special attack: inactive/i })
  ).toContainText("No supported melee/ranged DPS special selected");
  await expect(sourceBreakdown.getByRole("listitem", { name: /Cannon: inactive/i })).toContainText(
    "Cannon is off"
  );
  const sourceDetails = sourceBreakdown.getByRole("list", { name: "Source detail panels" });
  await expect(sourceDetails).toBeVisible();
  await expect(
    sourceDetails.getByRole("listitem", { name: /Special attack detail: inactive/i })
  ).toContainText("No supported melee/ranged DPS special selected");
  await expect(
    sourceDetails.getByRole("listitem", { name: /Cannon detail: inactive/i })
  ).toContainText("Cannon is off");

  const combatRoll = analysis.getByRole("region", {
    name: "Combat roll details",
    exact: true
  });
  await expect(combatRoll).toBeVisible();
  const combatRollMetrics = combatRoll.getByRole("list", { name: "Combat roll metrics" });
  await expect(combatRollMetrics).toContainText("Effective accuracy");
  await expect(combatRollMetrics).toContainText("Effective damage");
  await expect(combatRollMetrics).toContainText("Hit chance");
  await expect(combatRollMetrics).toContainText("Attack speed");
  await expect(combatRollMetrics).toContainText("Attack cycle");
  await expect(combatRollMetrics).toContainText("TTK");
  await expect(combatRollMetrics).toContainText("Kills/hr");
  await expect(combatRollMetrics).toContainText("GP/kill");

  const xpRouting = analysis.getByRole("region", { name: "XP routing", exact: true });
  await expect(xpRouting).toBeVisible();
  await expect(xpRouting.getByRole("list", { name: "XP routing chips" })).toContainText(
    "Player combat XP/hr"
  );
  await expect(xpRouting).toContainText("Hitpoints");
  await expect(xpRouting).toContainText("Prayer XP/hr");
  await expect(xpRouting).toContainText("Magic (alch) XP/hr");
  await expect(xpRouting).toContainText("No in-trip high-alch casts");
  await expect(xpRouting).not.toContainText("partial");
  await expect(xpRouting).not.toContainText("not modeled");
  await expect(xpRouting).not.toContainText("Cannon ranged XP/hr");

  const tripBanking = analysis.getByRole("region", {
    name: "Trip and banking summary",
    exact: true
  });
  await expect(tripBanking).toBeVisible();
  const tripTable = tripBanking.getByRole("table", { name: "Trip and banking metrics" });
  await expect(tripTable).toContainText("Kills/trip");
  await expect(tripTable).toContainText("Trip length");
  await expect(tripTable).toContainText("Bank time");
  await expect(tripTable).toContainText("Current trip bound");
  await expect(tripTable).toContainText("Safespot");
  await expect(tripTable).toContainText("Protection prayer");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Melee setup" }).click();
  const panel = page.getByRole("region", { name: "Damage distribution", exact: true });
  await expect(panel.getByRole("heading", { name: "Damage distribution" })).toBeVisible();
  await expect(panel).toContainText("Exact rolled damage per attack event");
  await expect(panel).toContainText("Normal hit chance");
  await expect(panel).toContainText("Expected / attack");
  await expect(panel).toContainText("Normal max hit");

  const histogram = panel.getByRole("list", { name: "Damage distribution buckets" });
  await expect(histogram).toBeVisible();
  await expect(histogram.getByRole("listitem", { name: /^Miss; Normal exact:/i })).toBeVisible();
  await expect(
    histogram.getByRole("listitem", { name: /^Accurate zero damage; Normal exact:/i })
  ).toBeVisible();
  await expect(histogram.getByRole("listitem", { name: /normal max hit/i })).toBeVisible();
  await expect(panel.getByText("Show exact probabilities")).toBeVisible();

  await selectCombatType(page, "ranged");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Stats" }).click();
  await expect(combatRoll).toContainText("Effective accuracy");
  await expect(combatRoll).toContainText("Attack cycle");
  await expect(combatRoll.getByRole("listitem", { name: /Hit chance:/ })).toBeVisible();

  await selectCombatType(page, "magic");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Stats" }).click();
  await expect(combatRoll).toContainText("Effective damage");
  await expect(
    sourceDetails.getByRole("listitem", { name: /Special attack detail: not modeled/i })
  ).toContainText("Magic DPS special attacks are not modeled yet");
  await expect(sourceDetails).not.toContainText("Special attack histogram");
  await expect(sourceDetails).not.toContainText("Cannon histogram");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Monsters" }).click();
  await selectCombatType(page, "ranged");
  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Cannon" }).click();
  const cannon = page.locator('section[aria-label="Cannon"]');
  await cannon.getByLabel("Set up cannon").check();
  await cannon.getByLabel("Mobs at spot").fill("6");
  await cannon.getByLabel("Respawn (seconds)").fill("30");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Stats" }).click();
  const assumptions = page.getByLabel("Active assumptions");
  await expect(assumptions).toContainText("Cannon");
  await assumptions.getByRole("button", { name: "Review Cannon" }).click();
  await expect(
    page.getByLabel("Workbench tabs").getByRole("tab", { name: "Cannon" })
  ).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Stats" }).click();
  await expect(
    analysis
      .getByRole("list", { name: "XP routing chips" })
      .getByRole("listitem", { name: /Cannon ranged XP\/hr/i })
  ).toBeVisible();
  await expect(sourceBreakdown.getByRole("listitem", { name: /Cannon: modeled/i })).toContainText(
    "Cannon overlay"
  );
  await expect(sourceBreakdown.getByRole("listitem", { name: /Cannon: modeled/i })).toContainText(
    "XP/hr"
  );
  const cannonDetail = sourceDetails.getByRole("listitem", { name: /Cannon detail: modeled/i });
  await expect(cannonDetail).toContainText("Effective targets");
  await expect(cannonDetail).toContainText("Cannon DPS");
  await expect(cannonDetail).toContainText("Balls/hr");
  await expect(cannonDetail).toContainText("Balls/kill");
  await expect(cannonDetail).toContainText("Cannon Ranged XP/hr");
  await expect(cannonDetail).toContainText("Ball cost/hr");
  await expect(cannonDetail).toContainText("Ball cost/kill");
  await expect(cannonDetail).toContainText("Cannonballs/trip");
  const resetCurrentMonsterCannon = assumptions.getByRole("button", {
    name: "Reset current monster cannon"
  });
  await resetCurrentMonsterCannon.click();
  await expect(resetCurrentMonsterCannon).toHaveCount(0);

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Cannon" }).click();
  await expect(cannon.getByLabel("Set up cannon")).not.toBeChecked();
});

test("switches the target through MonsterCard and keeps shell state in sync", async ({ page }) => {
  await page.goto("/");
  const card = page.getByLabel("Monster card");
  const table = page.getByRole("table", { name: "All monsters" });
  const beforeMetrics = await resultMetricSnapshot(page);

  await expect(card.getByRole("heading", { name: "Giant" })).toBeVisible();
  await expect(card.getByLabel(/game ticks$/)).toBeVisible();
  await expect(card.getByLabel(/seconds$/)).toBeVisible();
  await expect(card.getByLabel("Current setup state")).toContainText("Default setup");
  await chooseSearchableOption(card, "Target", "Rock Crab");

  await expect(
    page.getByLabel("Setup context").getByRole("heading", { name: "Rock Crab" })
  ).toBeVisible();
  await expect(card.getByRole("heading", { name: "Rock Crab" })).toBeVisible();
  const afterMetrics = await resultMetricSnapshot(page);
  expect(Object.keys(beforeMetrics).some((key) => beforeMetrics[key] !== afterMetrics[key])).toBe(
    true
  );

  const rockCrabRow = table.getByRole("row", { name: /Rock Crab/ });
  await expect(rockCrabRow.locator("td").first()).toContainText(">");

  await expect(card.getByLabel("Drop filter", { exact: true })).toHaveCount(0);
  await expect(
    page.getByLabel("Monster comparison").getByLabel("Drop filter", { exact: true })
  ).toBeVisible();
});

test("updates MonsterCard active defence for melee stance, ranged and magic", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  const card = page.getByLabel("Monster card");

  await expect(activeMonsterDefence(card)).toContainText("Slash defence");
  await page.getByLabel("STYLE", { exact: true }).selectOption("controlled");
  await expect(activeMonsterDefence(card)).toContainText("Stab defence");

  await selectCombatType(page, "ranged");
  await expect(activeMonsterDefence(card)).toContainText("Ranged defence");

  await selectCombatType(page, "magic");
  await expect(activeMonsterDefence(card)).toContainText("Magic defence");
});

test("places MonsterCard after the active pane on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");

  const mobileHiscores = page.locator(".topbar").getByRole("region", { name: "Hiscores" });
  await expect(mobileHiscores).toBeVisible();
  expect((await mobileHiscores.boundingBox())?.height).toBeLessThan(80);

  const shell = page.getByLabel("Workbench shell");
  await expect(shell).toBeVisible();
  const shellOrder = await shell
    .locator(":scope > *")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
  expect(shellOrder).toEqual(["Player sidebar", "Workbench center", "Monster card"]);

  const card = page.getByLabel("Monster card");
  await expect(card).toBeVisible();
  await expect(searchableCombobox(card, "Target")).toBeVisible();
  await expect(activeMonsterDefence(card)).toBeVisible();

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Planner" }).click();
  const planner = page.getByRole("region", { name: "Planner", exact: true });
  await expect(planner.getByLabel("Planner summary")).toBeVisible();
  const [plannerBox, mobileCardBox] = await Promise.all([
    planner.boundingBox(),
    card.boundingBox()
  ]);
  expect(plannerBox).not.toBeNull();
  expect(mobileCardBox).not.toBeNull();
  expect(mobileCardBox!.y).toBeGreaterThanOrEqual(plannerBox!.y + plannerBox!.height - 1);
});

for (const viewport of MOBILE_RESULT_NAV_VIEWPORTS) {
  test(`keeps the mobile result and navigation loop complete at ${viewport.name}`, async ({
    page
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/");

    const playerSidebar = page.getByLabel("Player sidebar");
    const playerSetup = page.getByRole("region", { name: "Player setup", exact: true });
    const resultSummary = page.getByLabel("Mobile result summary");
    const activeSetup = page.getByRole("region", { name: "Active player setup", exact: true });
    const setupContext = page.getByLabel("Setup context");
    const hiddenContextMetrics = setupContext.locator(".setup-context-metrics");
    await expect(resultSummary).toBeVisible();
    await expect(hiddenContextMetrics).toBeHidden();
    await expect(resultSummary.locator(".metric")).toHaveCount(3);

    const playerSectionOrder = await playerSidebar
      .locator(":scope > .sidebar-section")
      .evaluateAll((sections) => sections.map((section) => section.getAttribute("aria-label")));
    expect(playerSectionOrder).toEqual([
      "Player setup",
      "Mobile result summary",
      "Active player setup"
    ]);
    const verticalLoop = await Promise.all([
      playerSetup.boundingBox(),
      resultSummary.boundingBox(),
      activeSetup.boundingBox()
    ]);
    expect(verticalLoop.every(Boolean)).toBe(true);
    expect(
      verticalLoop[1]!.y - (verticalLoop[0]!.y + verticalLoop[0]!.height)
    ).toBeGreaterThanOrEqual(0);
    expect(verticalLoop[1]!.y - (verticalLoop[0]!.y + verticalLoop[0]!.height)).toBeLessThanOrEqual(
      16
    );
    expect(verticalLoop[2]!.y - (verticalLoop[1]!.y + verticalLoop[1]!.height)).toBeLessThanOrEqual(
      16
    );

    const mobileMetrics = await resultSummary.locator(".metric").allTextContents();
    const contextMetrics = await hiddenContextMetrics.locator(".metric").allTextContents();
    expect(mobileMetrics.map((text) => text.trim())).toEqual(
      contextMetrics.map((text) => text.trim())
    );
    expect(mobileMetrics.map((text) => text.replace(/\s+/g, " ").trim())).toEqual([
      expect.stringMatching(/^DPS/),
      expect.stringMatching(/^Effective XP\/hr/),
      expect.stringMatching(/^Net GP\/hr/)
    ]);

    const summaryBefore = await resultSummary.locator(".metric strong").allTextContents();
    const selectedBeforeUpdate = await page
      .getByRole("tablist", { name: "Workbench tabs" })
      .getByRole("tab", { selected: true })
      .textContent();
    await playerSetup.getByLabel("STR", { exact: true }).fill("99");
    await expect
      .poll(async () => resultSummary.locator(".metric strong").allTextContents())
      .not.toEqual(summaryBefore);
    await expect(
      page.getByRole("tablist", { name: "Workbench tabs" }).getByRole("tab", { selected: true })
    ).toHaveText(selectedBeforeUpdate ?? "Monsters");

    const navigation = page.locator(".workbench-tab-navigation");
    const tablist = page.getByRole("tablist", { name: "Workbench tabs" });
    const tabs = tablist.getByRole("tab");
    const scrollLeft = page.getByRole("button", { name: "Scroll workbench tabs left" });
    const scrollRight = page.getByRole("button", { name: "Scroll workbench tabs right" });
    const moreTabs = navigation.locator("details.workbench-more-tabs");
    const moreSummary = moreTabs.locator(":scope > summary");
    await expect(tabs).toHaveCount(11);
    await expect(scrollLeft).toBeVisible();
    await expect(scrollRight).toBeVisible();
    await expect(moreSummary).toHaveText("More tabs");
    await expect(scrollLeft).toBeDisabled();
    await expect(scrollRight).toBeEnabled();

    for (let index = 0; index < 11 && (await scrollLeft.isEnabled()); index += 1) {
      await scrollLeft.click();
    }
    await expect(scrollLeft).toBeDisabled();
    await expect(scrollRight).toBeEnabled();

    const firstHiddenRightIndex = await tablist.evaluate((element) => {
      const listRect = element.getBoundingClientRect();
      return Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]')).findIndex(
        (tab) => tab.getBoundingClientRect().right > listRect.right + 1
      );
    });
    expect(firstHiddenRightIndex).toBeGreaterThan(0);
    await navigation.scrollIntoViewIfNeeded();
    const scrollYBeforeArrow = await page.evaluate(() => window.scrollY);
    const selectedBeforeArrow = await tablist
      .getByRole("tab", { selected: true })
      .getAttribute("id");
    await scrollRight.click();
    await expect
      .poll(async () =>
        tablist.evaluate((element, index) => {
          const listRect = element.getBoundingClientRect();
          const tab = element.querySelectorAll<HTMLElement>('[role="tab"]')[index];
          if (!tab) return false;
          const tabRect = tab.getBoundingClientRect();
          return tabRect.left >= listRect.left - 1 && tabRect.right <= listRect.right + 1;
        }, firstHiddenRightIndex)
      )
      .toBe(true);
    await expect(tablist.getByRole("tab", { selected: true })).toHaveAttribute(
      "id",
      selectedBeforeArrow ?? "workbench-tab-monsters"
    );
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollYBeforeArrow);

    await moreSummary.click();
    await expect(moreTabs).toHaveAttribute("open", "");
    const moreItems = moreTabs.locator(".workbench-more-tabs-list > button");
    await expect(moreItems).toHaveCount(11);
    await expect(moreItems).toHaveText([
      "Stats",
      "Melee setup",
      "Monsters",
      "Setups",
      "Loot",
      "Trip",
      "Risk",
      "Cannon",
      "Planner",
      "Economy",
      "Settings"
    ]);
    await expect(moreItems.filter({ hasText: selectedBeforeUpdate ?? "Monsters" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await moreItems.filter({ hasText: "Settings" }).click();
    await expect(moreTabs).not.toHaveAttribute("open", "");
    await expect(moreSummary).toBeFocused();
    await expect(page.getByRole("tabpanel", { name: "Settings" })).toBeVisible();

    const expectSelectedTabVisible = async (name: string) => {
      const tab = tablist.getByRole("tab", { name, exact: true });
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect
        .poll(async () => {
          const [listBox, tabBox] = await Promise.all([tablist.boundingBox(), tab.boundingBox()]);
          return Boolean(
            listBox &&
            tabBox &&
            tabBox.x >= listBox.x - 1 &&
            tabBox.x + tabBox.width <= listBox.x + listBox.width + 1
          );
        })
        .toBe(true);
      return tab;
    };
    const settingsTab = await expectSelectedTabVisible("Settings");
    await settingsTab.focus();
    await page.keyboard.press("Home");
    await expectSelectedTabVisible("Stats");
    await page.keyboard.press("End");
    await expectSelectedTabVisible("Settings");
    await page.keyboard.press("ArrowLeft");
    await expectSelectedTabVisible("Economy");
    await page.keyboard.press("ArrowRight");
    await expectSelectedTabVisible("Settings");

    const setupActionBoxes = await setupContext
      .locator(".setup-context-actions button")
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        })
      );
    expect(setupActionBoxes).toHaveLength(4);
    expect(new Set(setupActionBoxes.map((box) => Math.round(box.y))).size).toBe(1);
    expect(setupActionBoxes.every((box) => box.height >= 40)).toBe(true);
    expect(setupActionBoxes[0]!.x).toBeGreaterThanOrEqual(0);
    expect(setupActionBoxes.at(-1)!.x + setupActionBoxes.at(-1)!.width).toBeLessThanOrEqual(
      viewport.width + 1
    );

    const typography = await page.getByLabel("Workbench shell").evaluate((shell) => {
      const informative = Array.from(
        shell.querySelectorAll<HTMLElement>(
          "button, input, select, textarea, output, summary, label, small, span, p, li, dt, dd, th, td, strong, em"
        )
      ).filter((element) => {
        const style = getComputedStyle(element);
        return (
          element.getClientRects().length > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          (element.textContent?.trim() || element.getAttribute("aria-label"))
        );
      });
      return {
        belowTwelve: informative
          .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 12)
          .map((element) => element.textContent?.trim() || element.getAttribute("aria-label")),
        summaryHeadlineSizes: Array.from(
          shell.querySelectorAll<HTMLElement>('[aria-label="Mobile result summary"] .metric strong')
        ).map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
      };
    });
    expect(typography.belowTwelve).toEqual([]);
    expect(typography.summaryHeadlineSizes.every((size) => size >= 14)).toBe(true);
    await expectPageWidthContained(page);
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
  });
}

test("keeps the desktop workbench inside one console viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await selectCombatType(page, "melee");

  const compactOverrides = page.locator(
    ".compact-setup-strip .optional-number-field.compact .optional-number-control"
  );
  await expect(compactOverrides).toHaveCount(3);
  const visibleOptionalControls = page.locator(".optional-number-control:visible");
  await expect(visibleOptionalControls).toHaveCount(6);
  const optionalControlMetrics = await visibleOptionalControls.evaluateAll((controls) =>
    controls.map((control) => {
      const input = control.querySelector("input");
      const button = control.querySelector("button");
      const inputRect = input?.getBoundingClientRect();
      const buttonRect = button?.getBoundingClientRect();
      return {
        inputWidth: inputRect?.width ?? 0,
        buttonWidth: buttonRect?.width ?? 0,
        separated: inputRect && buttonRect ? inputRect.right <= buttonRect.left : false
      };
    })
  );
  for (const control of optionalControlMetrics) {
    expect(control.inputWidth).toBeGreaterThanOrEqual(56);
    expect(control.buttonWidth).toBeGreaterThanOrEqual(28);
    expect(control.separated).toBe(true);
  }
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Monsters" }).click();

  const shell = page.getByLabel("Workbench shell");
  const player = page.getByLabel("Player sidebar");
  const pane = shell.locator(".active-pane");
  const monster = page.getByLabel("Monster card");
  const table = page.getByRole("table", { name: "All monsters" });

  await expect(shell).toBeVisible();
  await expect(player).toBeVisible();
  await expect(pane).toBeVisible();
  await expect(monster).toBeVisible();
  await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);

  const layout = await page.evaluate(() => {
    const metrics = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) return null;
      const style = window.getComputedStyle(element);
      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: style.overflowY
      };
    };
    return {
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      player: metrics(document.querySelector(".player-sidebar")),
      pane: metrics(document.querySelector(".active-pane")),
      monster: metrics(document.querySelector(".monster-rail"))
    };
  });

  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.bodyHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.player?.overflowY).toBe("auto");
  expect(layout.pane?.overflowY).toBe("auto");
  expect(layout.monster?.overflowY).toBe("auto");
  expect(layout.pane!.scrollHeight).toBeGreaterThan(layout.pane!.clientHeight);
  expect(layout.monster!.scrollHeight).toBeGreaterThan(layout.monster!.clientHeight);

  const paneScrollTop = await pane.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  const monsterScrollTop = await monster.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(paneScrollTop).toBeGreaterThan(0);
  expect(monsterScrollTop).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("keeps a compact landscape workbench inside one console viewport", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");

  const shell = page.getByLabel("Workbench shell");
  const player = page.getByLabel("Player sidebar");
  const pane = shell.locator(".active-pane");
  const monster = page.getByLabel("Monster card");

  await expect(shell).toBeVisible();
  await expect(player).toBeVisible();
  await expect(pane).toBeVisible();
  await expect(monster).toBeVisible();

  const layout = await page.evaluate(() => {
    const metrics = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: style.overflowY,
        x: rect.x,
        y: rect.y
      };
    };
    return {
      viewportHeight: window.innerHeight,
      documentHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      bodyOverflow: window.getComputedStyle(document.body).overflow,
      player: metrics(".player-sidebar"),
      center: metrics(".workbench-center"),
      pane: metrics(".active-pane"),
      monster: metrics(".monster-rail")
    };
  });

  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.bodyHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
  expect(layout.bodyOverflow).toBe("hidden");
  expect(layout.player?.overflowY).toBe("auto");
  expect(layout.pane?.overflowY).toBe("auto");
  expect(layout.monster?.overflowY).toBe("auto");
  expect(layout.pane!.clientHeight).toBeGreaterThan(0);
  expect(layout.pane!.scrollHeight).toBeGreaterThan(layout.pane!.clientHeight);
  expect(layout.player!.y).toBe(layout.center!.y);
  expect(layout.monster!.y).toBe(layout.center!.y);
  expect(layout.player!.x).toBeLessThan(layout.center!.x);
  expect(layout.center!.x).toBeLessThan(layout.monster!.x);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("keeps long selected monster names readable in compact setup fields", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");

  const setupContext = page.getByLabel("Setup context");
  const contextMonster = searchableCombobox(setupContext, "Monster");
  const compactTarget = page.getByLabel("Combat setup").getByLabel("TARGET", { exact: true });
  await chooseSearchableOption(setupContext, "Monster", "Water Elemental");

  await expect(contextMonster).toHaveAttribute("data-selected-id", "water_elemental");
  await expect(compactTarget).toHaveValue("water_elemental");
  await expect(contextMonster).toHaveAttribute("title", "Water Elemental");
  await expect(compactTarget).toHaveAttribute("title", "Water Elemental");

  const contextFit = await contextMonster.evaluate((element) => {
    const value = element.querySelector("span");
    return value
      ? {
          clientWidth: value.clientWidth,
          scrollWidth: value.scrollWidth,
          selectedText: value.textContent?.trim() ?? ""
        }
      : null;
  });
  expect(contextFit?.selectedText).toBe("Water Elemental");
  expect(contextFit!.scrollWidth).toBeLessThanOrEqual(contextFit!.clientWidth + 1);

  const compactFit = await compactTarget.evaluate((element) => {
    if (!(element instanceof HTMLSelectElement)) return null;
    const style = window.getComputedStyle(element);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.font = style.font;
    const selectedText = element.selectedOptions[0]?.textContent?.trim() ?? "";
    return {
      availableWidth: element.clientWidth - 36,
      selectedText,
      textWidth: context.measureText(selectedText).width
    };
  });
  expect(compactFit).not.toBeNull();
  expect(compactFit?.selectedText).toBe("Water Elemental");
  expect(compactFit!.availableWidth).toBeGreaterThanOrEqual(compactFit!.textWidth);

  const guideSummary = page.getByLabel("Setup quick navigation").locator("button strong").first();
  const guideStyle = await guideSummary.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      overflowWrap: style.overflowWrap,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace
    };
  });
  expect(guideStyle.whiteSpace).toBe("normal");
  expect(guideStyle.textOverflow).not.toBe("ellipsis");
  expect(guideStyle.overflowWrap).toBe("anywhere");
});

test("keeps compact setup actions, Risk controls and setup summaries readable", async ({
  page
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");

  const setupActions = page.getByLabel("Setup actions");
  await expect(setupActions.getByRole("button", { name: "Create custom setup" })).toHaveText("New");
  await expect(setupActions.getByRole("button", { name: "Edit default" })).toHaveText("Edit");
  await expect(setupActions.getByRole("button", { name: "Remove custom setup" })).toHaveText(
    "Remove"
  );
  const actionMetrics = await setupActions.locator("button").evaluateAll((buttons) =>
    buttons.map((button) => ({
      clientWidth: button.clientWidth,
      scrollWidth: button.scrollWidth,
      whiteSpace: window.getComputedStyle(button).whiteSpace
    }))
  );
  for (const action of actionMetrics) {
    expect(action.scrollWidth).toBeLessThanOrEqual(action.clientWidth + 1);
    expect(action.whiteSpace).toBe("nowrap");
  }

  const tabs = page.getByLabel("Workbench tabs");
  const activePane = page.locator(".active-pane");
  await tabs.getByRole("tab", { name: "Risk" }).click();
  const risk = page.getByRole("region", { name: "Risk", exact: true });
  const cancel = risk.getByRole("button", { name: "Cancel" });
  await expect(cancel).toBeVisible();
  await expectInsideBox(activePane, cancel);
  const riskOverflow = await risk.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(riskOverflow.scrollWidth).toBeLessThanOrEqual(riskOverflow.clientWidth + 1);

  await tabs.getByRole("tab", { name: "Setups" }).click();
  await page.setViewportSize({ width: 1024, height: 720 });
  const duelControls = page.getByLabel("Saved setup controls");
  await expect(duelControls.getByText("Current target", { exact: true })).toHaveCount(0);
  const duelActionBoxes = await duelControls
    .locator(".duel-control-actions > button, .duel-control-actions > details > summary")
    .evaluateAll((actions) =>
      actions.map((action) => {
        const rect = action.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      })
    );
  expect(duelActionBoxes).toHaveLength(2);
  for (let index = 0; index < duelActionBoxes.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < duelActionBoxes.length; otherIndex += 1) {
      const first = duelActionBoxes[index]!;
      const second = duelActionBoxes[otherIndex]!;
      const overlaps =
        first.left < second.right &&
        first.right > second.left &&
        first.top < second.bottom &&
        first.bottom > second.top;
      expect(overlaps).toBe(false);
    }
  }
  const loadout = page
    .getByRole("table", { name: "Setup comparison table" })
    .locator(".duel-loadout-cell");
  await expect(loadout).toBeVisible();
  const loadoutMetrics = await loadout.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace
    };
  });
  expect(loadoutMetrics.scrollWidth).toBeLessThanOrEqual(loadoutMetrics.clientWidth + 1);
  expect(loadoutMetrics.textOverflow).not.toBe("ellipsis");
  expect(loadoutMetrics.whiteSpace).toBe("normal");
});

test("keeps every workbench tab inside a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");

  const tabs = page.getByLabel("Workbench tabs");
  const main = page.locator("main");
  const setupContext = page.getByLabel("Setup context");
  const setupTargets = [
    searchableCombobox(setupContext, "Monster"),
    setupContext.getByLabel("Setup actions"),
    page.getByLabel("Mobile result summary")
  ];
  for (const tabName of [
    "Stats",
    "Melee setup",
    "Monsters",
    "Setups",
    "Loot",
    "Trip",
    "Risk",
    "Cannon",
    "Planner",
    "Economy",
    "Settings"
  ]) {
    await tabs.getByRole("tab", { name: tabName, exact: true }).click();
    await expectPageWidthContained(page);
    expect(await page.evaluate(() => window.scrollX), `${tabName} shifted the document`).toBe(0);
    for (const target of setupTargets) await expectInsideBox(main, target);
  }
});

test("keeps search inside the dropdown and supports keyboard selection", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");

  await selectCombatType(page, "magic");
  const loadout = page.getByRole("region", { name: "Equipment loadout", exact: true });
  const combobox = searchableCombobox(loadout, "Spell");

  await expect(combobox).toHaveText(/Fire Bolt/);
  await expect(loadout.getByRole("searchbox", { name: "Search Spell options" })).toHaveCount(0);
  await combobox.click();
  const search = loadout.getByRole("searchbox", { name: "Search Spell options" });
  const listbox = loadout.getByRole("listbox", { name: "Spell options" });
  await expect(search).toBeFocused();
  await expect(listbox).toBeVisible();
  await search.fill("fire wave");
  await expect(listbox.getByRole("option")).toHaveCount(1);
  await expect(listbox.getByRole("option", { name: "Fire Wave" })).toBeVisible();
  await search.press("Enter");
  await expectSearchableSelection(loadout, "Spell", "fire_wave");
  await expect(combobox).toHaveText(/Fire Wave/);
  await expect(listbox).toHaveCount(0);

  await combobox.click();
  await loadout.getByRole("searchbox", { name: "Search Spell options" }).fill("wind strike");
  await loadout
    .getByRole("listbox", { name: "Spell options" })
    .getByRole("option", { name: "Wind Strike" })
    .click();
  await expectSearchableSelection(loadout, "Spell", "wind_strike");

  await combobox.click();
  await loadout.getByRole("searchbox", { name: "Search Spell options" }).press("Escape");
  await expect(combobox).toBeFocused();
  await expect(loadout.getByRole("listbox", { name: "Spell options" })).toHaveCount(0);
});

test("uses popup search for every primary long-choice field", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");

  await expectPopupSearch(page.getByLabel("Setup context"), "Monster");
  await expectPopupSearch(page.getByLabel("Monster target controls"), "Target");

  const tabs = page.getByLabel("Workbench tabs");
  const loadout = page.getByRole("region", { name: "Equipment loadout", exact: true });
  await selectCombatType(page, "melee");
  for (const label of [
    "Weapon",
    "Helm",
    "Amulet",
    "Body",
    "Legs",
    "Shield",
    "Gloves",
    "Boots",
    "Cape",
    "Ring"
  ]) {
    await expectPopupSearch(loadout, label);
  }

  await selectCombatType(page, "ranged");
  await expectPopupSearch(loadout, "Ammo");
  await selectCombatType(page, "magic");
  await expectPopupSearch(loadout, "Spell");
  await expect(page.getByLabel("SPELL", { exact: true })).toHaveJSProperty("tagName", "SELECT");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveJSProperty("tagName", "SELECT");

  await tabs.getByRole("tab", { name: "Trip" }).click();
  await expectPopupSearch(page.getByRole("region", { name: "Trip assumptions" }), "Food");
  await tabs.getByRole("tab", { name: "Risk" }).click();
  await expectPopupSearch(page.getByRole("region", { name: "Risk", exact: true }), "Target drop");
  await tabs.getByRole("tab", { name: "Economy" }).click();
  await expectPopupSearch(page, "Trend item");
  await page.getByLabel("Baseline").selectOption("snapshot");
  await expect(searchableCombobox(page, "Snapshot")).toBeEnabled();
  await expectPopupSearch(page, "Snapshot");
});

test("keeps the Food dropdown search and results inside the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();
  const trip = page.getByRole("region", { name: "Trip assumptions" });
  const food = searchableCombobox(trip, "Food");
  await expect(food).toHaveText(/Lobster/);
  await expect(trip.getByRole("searchbox", { name: "Search Food options" })).toHaveCount(0);

  await food.click();
  const search = trip.getByRole("searchbox", { name: "Search Food options" });
  const listbox = trip.getByRole("listbox", { name: "Food options" });
  await expect(search).toBeFocused();
  await expect(listbox).toBeVisible();
  await expectInsideBox(page.locator("main"), trip.locator(".searchable-combobox-popover"));
  await expectPageWidthContained(page);
  const optionDensity = await listbox
    .getByRole("option")
    .first()
    .evaluate((option) => {
      const label = option.querySelector("span");
      return {
        fontSize: label ? Number.parseFloat(getComputedStyle(label).fontSize) : Number.NaN,
        rowHeight: option.getBoundingClientRect().height
      };
    });
  expect(optionDensity.fontSize).toBe(12);
  expect(optionDensity.rowHeight).toBeLessThanOrEqual(40);

  await search.fill("swordfish");
  await listbox.getByRole("option", { name: "Swordfish" }).click();
  await expectSearchableSelection(trip, "Food", "swordfish");
  await expect(food).toHaveText(/Swordfish/);
  await expect(listbox).toHaveCount(0);
});

test("explains setup ownership and links negative net GP to its controls", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");

  const guide = page.getByLabel("Setup quick navigation");
  const tabs = page.getByLabel("Workbench tabs");
  await expect(guide).toBeVisible();
  await expect(guide.getByText("Where to edit", { exact: true })).toHaveCount(0);
  await expect(
    guide.getByText("Current values and their owning pane", { exact: true })
  ).toHaveCount(0);
  await expect(guide.getByRole("button")).toHaveCount(3);
  await expect(guide).toContainText("ultimate + incredible");
  await expect(guide).toContainText("super att + super str");
  await expect(guide).toContainText("1 vials/type");
  await expect(guide).toContainText("Prayer potions");

  const explanation = page.getByLabel("Net GP explanation");
  await expect(explanation).toBeVisible();
  await expect(explanation).toContainText("Supplies");
  await expect(explanation).toContainText("exceed loot");
  await expect(explanation.getByRole("button", { name: "Edit prayers & boosts" })).toBeVisible();
  await expect(explanation.getByRole("button", { name: "Review potion carry" })).toBeVisible();

  await guide.getByRole("button", { name: "Edit potion carry and prayer restore" }).click();
  await expect(tabs.getByRole("tab", { name: "Trip" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Combat potion vials / type")).toBeVisible();

  await guide.getByRole("button", { name: "Edit prayers and combat boosts" }).click();
  await expect(tabs.getByRole("tab", { name: "Melee setup" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByRole("region", { name: "Equipment loadout", exact: true })).toBeVisible();
});

test("keeps Dense Compare mobile and tablet overflow contained", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());

  for (const viewport of [
    { label: "mobile", width: 390, height: 800 },
    { label: "tablet", width: 768, height: 900 }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");

    const setupStrip = page.getByLabel("Combat setup");
    const metricStrip = page.getByLabel("Simulation results");
    const comparePanel = page.getByLabel("Monster comparison");
    const tableWrap = comparePanel.locator(".dense-table-wrap");
    const table = page.getByRole("table", { name: "All monsters" });

    await expect(setupStrip, `${viewport.label} setup strip`).toBeVisible();
    await expect(metricStrip, `${viewport.label} metric strip`).toBeVisible();
    await expect(comparePanel, `${viewport.label} compare panel`).toBeVisible();
    await expect(table, `${viewport.label} dense table`).toBeVisible();
    await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);
    await expect(table.locator("tbody tr").first()).toBeVisible();
    await expect(table.locator("tbody tr").nth(1)).toBeVisible();
    await expectPageWidthContained(page);

    const initialOverflow = await denseTableOverflowMetrics(tableWrap);
    expect(initialOverflow.scrollWidth).toBeGreaterThan(initialOverflow.clientWidth);
    expect(["auto", "scroll"]).toContain(initialOverflow.overflowX);

    const scrolledLeft = await tableWrap.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      return element.scrollLeft;
    });
    expect(scrolledLeft).toBeGreaterThan(0);
    await expectInsideBox(tableWrap, table.locator("tbody tr").first().locator("td").nth(9));

    await tableWrap.evaluate((element) => {
      element.scrollLeft = 0;
      element.scrollTop = 96;
    });
    const [headerBox, firstVisibleBodyBox] = await Promise.all([
      table.locator("thead").boundingBox(),
      table.locator("tbody tr").first().boundingBox()
    ]);
    expect(headerBox).not.toBeNull();
    expect(firstVisibleBodyBox).not.toBeNull();
    expect(firstVisibleBodyBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);

    const activeRow = table.getByRole("row", { name: /Giant lvl 28/ });
    await expectActiveDenseRow(table, /Giant lvl 28/);
    await activeRow.getByRole("button", { name: /Mark .* irrelevant/ }).click();
    await expect(activeRow.getByLabel("Marked irrelevant for Hill Giant")).toBeVisible();
    await expect(activeRow.getByLabel("Current target kept visible for Hill Giant")).toBeVisible();

    await page.getByLabel("Monster filter").fill("rock crab");
    await page
      .getByLabel("Monster comparison")
      .getByLabel("Drop filter")
      .fill("very long impossible dragon bones and rune chainbody filter value");
    await expect(activeRow).toBeVisible();
    await expect(activeRow.locator("td").first()).toContainText(">");
    await expect(activeRow.getByLabel("Current target kept visible for Hill Giant")).toBeVisible();
    await expectPageWidthContained(page);
  }
});

test("keeps long table headers pinned inside their desktop scroll area", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");

  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("tab", { name: "Monsters" }).click();
  const table = page.getByRole("table", { name: "All monsters" });
  const wrap = table.locator("xpath=ancestor::div[contains(@class, 'dense-table-wrap')]");
  const header = table.locator("thead th").first();
  await expect(page.getByRole("status", { name: /Compare calculation status/i })).toHaveText(
    "Current",
    { timeout: 30_000 }
  );
  await expect(table.locator("tbody tr")).toHaveCount(63, { timeout: 30_000 });

  const before = await wrap.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop
  }));
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
  expect(before.scrollTop).toBe(0);

  await wrap.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => wrap.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const [wrapBox, headerBox] = await Promise.all([wrap.boundingBox(), header.boundingBox()]);
  expect(wrapBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(headerBox!.y).toBeGreaterThanOrEqual(wrapBox!.y - 1);
  expect(headerBox!.y + headerBox!.height).toBeLessThanOrEqual(wrapBox!.y + wrapBox!.height + 1);

  await tabs.getByRole("tab", { name: "Planner" }).click();
  const plannerHeaderPosition = await page
    .getByRole("table", { name: "Planner training order" })
    .locator("thead th")
    .first()
    .evaluate((cell) => getComputedStyle(cell).position);
  expect(plannerHeaderPosition).toBe("sticky");
});

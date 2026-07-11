import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createGeneratedRuntimePriceSet } from "../../adapters/generated/price-fallback";
import { createScheduledStaticPriceSnapshotStatus } from "../../adapters/market";
import { LOOT_PREFS_STORAGE_KEY, LOOT_PREFS_VERSION } from "../../app/state/loot-prefs";
import { LOOT_SETTINGS_STORAGE_KEY, LOOT_SETTINGS_VERSION } from "../../app/state/loot-settings";
import {
  DUEL_SNAPSHOTS_STORAGE_KEY,
  DUEL_SNAPSHOTS_VERSION,
  createDuelSnapshot
} from "../../app/state/duel-snapshots";
import {
  DEFAULT_FORM_STATE,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  savedSetupFromForm
} from "../../app/state/ui-state";
import { createSimulationViewModel, formatNumber } from "../../app/view-models/simulation";
import { parseGameDataSnapshot } from "../../data/schemas/game-data";
import { LEGACY_GOLDEN_CASES } from "../fixtures/legacy-case-definitions";
import { createRewriteFixtureCase } from "../helpers/rewrite-fixture";

const RESULT_NUMERIC_LABELS = [
  "DPS",
  "MAX HIT",
  "HIT %",
  "XP/HR",
  "GP/HR NET",
  "KILLS/HR",
  "GP/KILL",
  "SUPPLY/KILL"
] as const;

const ALL_FIXTURE_NUMERIC_LABELS = [
  "DPS",
  "MAX HIT",
  "HIT %",
  "TTK",
  "KILLS/HR",
  "XP/HR",
  "GP/HR",
  "GP/HR NET",
  "SUPPLY/KILL",
  "GP/KILL"
] as const;

const GENERATED_BROWSER_FIXTURE_GAME_DATA = parseGameDataSnapshot(
  JSON.parse(readFileSync(new URL("../../data/generated/game-data.json", import.meta.url), "utf8"))
);
const GENERATED_BROWSER_FIXTURE_PRICE_STATUS = createScheduledStaticPriceSnapshotStatus(
  {
    pricesText: readFileSync(new URL("../../../prices.json", import.meta.url), "utf8"),
    alchText: readFileSync(new URL("../../../alch.json", import.meta.url), "utf8"),
    priceHistoryText: readFileSync(new URL("../../../price-history.json", import.meta.url), "utf8")
  },
  { loadedAt: "2026-07-10T00:00:00.000Z" }
);
if (
  GENERATED_BROWSER_FIXTURE_PRICE_STATUS.status !== "loaded" ||
  GENERATED_BROWSER_FIXTURE_PRICE_STATUS.scheduledPriceSet === null
) {
  throw new Error("Scheduled browser fixture PriceSet is unavailable.");
}
const GENERATED_BROWSER_FIXTURE_CONTEXT = {
  gameData: GENERATED_BROWSER_FIXTURE_GAME_DATA,
  priceSet: createGeneratedRuntimePriceSet(
    GENERATED_BROWSER_FIXTURE_PRICE_STATUS.scheduledPriceSet,
    GENERATED_BROWSER_FIXTURE_GAME_DATA
  )
};

const CANNON_NUMERIC_LABELS = [
  "Effective targets",
  "Cannon DPS",
  "Balls/hr",
  "Balls/kill",
  "Cannon Ranged XP/hr",
  "Effective XP/hr",
  "Effective net GP/hr",
  "Ball cost/hr",
  "Ball cost/kill",
  "Ball price",
  "Cannonballs/trip",
  "Ball gp/trip",
  "K/hr uplift"
] as const;

const TRIP_NUMERIC_LABELS = [
  "Prayer/kill",
  "Prayer slots",
  "Max kills prayer",
  "Food count",
  "Food/kill",
  "Kills/trip",
  "Effective K/hr",
  "Recoil/kill",
  "Recoil gp/kill"
] as const;

async function metricSnapshot(region: Locator, labels: readonly string[]) {
  await expect(region).toBeVisible();
  const entries = await region.locator(".metric").evaluateAll((nodes) =>
    nodes.map((node) => ({
      label: node.querySelector("span")?.textContent?.trim() ?? "",
      value: node.querySelector("strong")?.textContent?.trim() ?? ""
    }))
  );

  return Object.fromEntries(
    labels.map((label) => {
      const entry = entries.find((item) => item.label === label);
      expect(entry?.value, `Missing metric ${label}`).toBeDefined();
      return [label, entry?.value ?? ""];
    })
  );
}

async function resultMetricSnapshot(page: Page) {
  return metricSnapshot(page.getByLabel("Simulation results"), RESULT_NUMERIC_LABELS);
}

function fixtureDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "unlimited";
  if (seconds < 60) return `${formatNumber(seconds, 1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function allFixtureExpectedMetrics(vm: ReturnType<typeof createSimulationViewModel>) {
  return {
    DPS: formatNumber(vm.combat.effectiveDps, 2),
    "MAX HIT": formatNumber(vm.combat.maxHit, 1),
    "HIT %": `${formatNumber(vm.combat.hitChance * 100, 1)}%`,
    TTK: fixtureDuration(vm.combat.ttkSec),
    "KILLS/HR": formatNumber(vm.trip.killsPerHour),
    "XP/HR": formatNumber(vm.effectiveXpPerHour),
    "GP/HR": formatNumber(vm.trip.gpPerHour),
    "GP/HR NET": formatNumber(vm.trip.effectiveNetGpPerHour),
    "SUPPLY/KILL": formatNumber(vm.trip.supply.supplyCostPerKill),
    "GP/KILL": formatNumber(vm.trip.gpPerKill)
  };
}

function fixtureStorageEnvelope<T>(version: number, data: T) {
  return {
    version,
    savedAt: "2026-07-10T00:00:00.000Z",
    data
  };
}

function activeMonsterDefence(card: Locator) {
  return card.getByLabel("Monster defence").locator('[aria-current="true"]');
}

async function denseNumericSnapshot(table: Locator, rowName: RegExp) {
  const comparePanel = table.locator('xpath=ancestor::section[@aria-label="Monster comparison"]');
  await expect(
    comparePanel.getByRole("status", { name: /Compare calculation status/i })
  ).toHaveText("Current", { timeout: 30_000 });
  const row = table.getByRole("row", { name: rowName });
  await expect(row).toBeVisible();
  const cells = (await row.locator("td").allTextContents()).map((text) => text.trim());
  expect(cells).toHaveLength(10);
  return {
    hit: cells[1],
    max: cells[2],
    dps: cells[3],
    ttk: cells[4],
    killsPerHour: cells[5],
    xpPerHour: cells[6],
    gpPerKill: cells[7],
    gpPerHour: cells[8],
    netGpPerHour: cells[9]
  };
}

async function expectDenseRowMax(table: Locator, rowName: RegExp, value: string) {
  const row = table.getByRole("row", { name: rowName });
  await expect(row).toBeVisible({ timeout: 30000 });
  await expect(row.locator("td").nth(2)).toHaveText(value, { timeout: 30000 });
}

async function expectActiveDenseRow(table: Locator, rowName: RegExp) {
  const row = table.getByRole("row", { name: rowName });
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("aria-selected", "true");
  await expect(row.locator("td").first()).toContainText(">");
  return row;
}

async function expectPageWidthContained(page: Page) {
  const metrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.clientWidth).toBeLessThanOrEqual(metrics.viewportWidth);
}

async function expectInsideBox(container: Locator, target: Locator) {
  const [containerBox, targetBox] = await Promise.all([
    container.boundingBox(),
    target.boundingBox()
  ]);
  expect(containerBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  expect(targetBox!.x).toBeGreaterThanOrEqual(containerBox!.x - 1);
  expect(targetBox!.x + targetBox!.width).toBeLessThanOrEqual(
    containerBox!.x + containerBox!.width + 1
  );
}

function searchableCombobox(region: Page | Locator, label: string): Locator {
  return region.getByRole("combobox", { name: label, exact: true });
}

async function selectCombatType(
  page: Page,
  combatStyle: "melee" | "ranged" | "magic"
): Promise<void> {
  const label = combatStyle.charAt(0).toUpperCase() + combatStyle.slice(1);
  const button = page
    .getByLabel("Combat type")
    .getByRole("button", { name: combatStyle, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByLabel("Workbench tabs").getByRole("tab", { name: `${label} setup` })
  ).toHaveAttribute("aria-selected", "true");
}

function accessibleNameStartingWith(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s|\\()`, "i");
}

async function chooseSearchableOption(
  region: Page | Locator,
  label: string,
  optionLabel: string
): Promise<Locator> {
  const combobox = searchableCombobox(region, label);
  await combobox.click();
  const search = region.getByRole("searchbox", { name: `Search ${label} options`, exact: true });
  await search.fill(optionLabel);
  await region
    .getByRole("listbox", { name: `${label} options`, exact: true })
    .getByRole("option", { name: accessibleNameStartingWith(optionLabel) })
    .click();
  return combobox;
}

async function expectSearchableSelection(
  region: Page | Locator,
  label: string,
  selectedId: string
): Promise<void> {
  await expect(searchableCombobox(region, label)).toHaveAttribute("data-selected-id", selectedId);
}

async function searchableOptionLabels(region: Page | Locator, label: string): Promise<string[]> {
  await searchableCombobox(region, label).click();
  const listbox = region.getByRole("listbox", { name: `${label} options`, exact: true });
  const labels = await listbox
    .getByRole("option")
    .evaluateAll((options) =>
      options.map((option) => option.getAttribute("aria-label") ?? option.textContent?.trim() ?? "")
    );
  await region.getByRole("searchbox", { name: `Search ${label} options` }).press("Escape");
  return labels;
}

async function expectPopupSearch(region: Page | Locator, label: string): Promise<void> {
  const combobox = searchableCombobox(region, label);
  await combobox.click();
  const search = region.getByRole("searchbox", { name: `Search ${label} options`, exact: true });
  const listbox = region.getByRole("listbox", { name: `${label} options`, exact: true });
  const popover = search.locator(
    "xpath=ancestor::div[contains(@class, 'searchable-combobox-popover')]"
  );
  await expect(search).toBeFocused();
  await expect(listbox).toBeVisible();
  await expect(popover.getByText("Find", { exact: true })).toHaveCount(0);
  await expect(popover.getByRole("status")).toHaveText(/\d+ of \d+ options/);
  await search.press("Escape");
  await expect(combobox).toBeFocused();
  await expect(listbox).toHaveCount(0);
}

async function denseTableOverflowMetrics(wrap: Locator) {
  return wrap.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      clientWidth: element.clientWidth,
      overflowX: style.overflowX,
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth
    };
  });
}

test("loads the dense combat spreadsheet root", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "2004scape Combat Simulator" })).toBeVisible();
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
    "Compare",
    "Loot",
    "Trip",
    "Risk",
    "Cannon",
    "Duel",
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
  await expect(page.getByText("All monsters")).toBeVisible();
  await expect(page.getByText("DPS").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Hiscores" })).toBeVisible();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const market = page.locator('section[aria-label="Market price data"]');
  await expect(
    market.getByText("Market upstream refresh is scheduled, not user-triggered.").first()
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
  await expect(page.getByRole("tabpanel", { name: "Compare" })).toBeFocused();
  expect(new URL(page.url()).hash).toBe("");

  const tablist = page.getByRole("tablist", { name: "Workbench tabs" });
  const compareTab = tablist.getByRole("tab", { name: "Compare" });
  await expect(compareTab).toHaveAttribute("aria-selected", "true");
  await expect(compareTab).toHaveAttribute("tabindex", "0");
  await expect(tablist.getByRole("tab", { name: "Stats" })).toHaveAttribute("tabindex", "-1");

  await compareTab.focus();
  await page.keyboard.press("ArrowRight");
  const lootTab = tablist.getByRole("tab", { name: "Loot" });
  await expect(lootTab).toBeFocused();
  await expect(lootTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Loot" })).toBeVisible();

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

  await expect(market).toContainText("Market upstream refresh is scheduled, not user-triggered.");
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
  await market
    .locator("label.file-button")
    .filter({ hasText: "Import PriceSet" })
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
    version: 1,
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
    version: 1,
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

  await reloadedMarket.getByRole("button", { name: "Reset local price override" }).click();
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

test("shows Stats XP routing trip summary and hit distribution", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
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

  const panel = analysis.getByRole("region", { name: "Hit distribution", exact: true });
  await expect(panel.getByRole("heading", { name: "Hit distribution" })).toBeVisible();
  await expect(panel).toContainText("Normal player attack");
  await expect(panel).toContainText("Hit chance");
  await expect(panel).toContainText("Average hit");
  await expect(panel).toContainText("Max hit");

  const histogram = panel.getByRole("list", { name: "Hit distribution buckets" });
  await expect(histogram).toBeVisible();
  await expect(histogram.getByRole("listitem", { name: /miss or zero damage/i })).toBeVisible();
  await expect(histogram.getByRole("listitem", { name: /max hit bucket/i })).toBeVisible();
  await expect(histogram).toContainText("max hit");

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

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Compare" }).click();
  await selectCombatType(page, "ranged");
  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Cannon" }).click();
  const cannon = page.locator('section[aria-label="Cannon"]');
  await cannon.getByLabel("Set up cannon").check();
  await cannon.getByLabel("Mobs at spot").fill("6");
  await cannon.getByLabel("Respawn").fill("30");
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

  await card.getByLabel("Drop filter", { exact: true }).fill("big_bones");
  await expect(page.locator("#dense-drop-filter")).toHaveValue("big_bones");
});

test("updates MonsterCard active defence for melee stance, ranged and magic", async ({ page }) => {
  await page.goto("/");
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
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Compare" }).click();

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

test("keeps compact setup actions, Risk controls and Duel summaries readable", async ({ page }) => {
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

  await tabs.getByRole("tab", { name: "Duel" }).click();
  const loadout = page
    .getByRole("table", { name: "Duel comparison" })
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
    setupContext.locator(".setup-context-metrics")
  ];
  for (const tabName of [
    "Stats",
    "Melee setup",
    "Compare",
    "Loot",
    "Trip",
    "Risk",
    "Cannon",
    "Duel",
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
  expect(optionDensity.fontSize).toBeLessThanOrEqual(12);
  expect(optionDensity.rowHeight).toBeLessThanOrEqual(35);

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
  await tabs.getByRole("tab", { name: "Compare" }).click();
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

test("recomputes the Planner tab workflow from visible planner controls", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Planner" }).click();

  const planner = page.getByRole("region", { name: "Planner", exact: true });
  await expect(planner).toBeVisible();
  await expect(planner.getByLabel("Planner controls")).toBeVisible();
  await expect(planner.getByLabel("Planner gear pool editor")).toBeVisible();
  await expect(planner.getByLabel("Planner DPS chart")).toBeVisible();
  await expect(planner.getByLabel("Planner gear timeline")).toBeVisible();
  await expect(planner.getByRole("table", { name: "Planner training order" })).toBeVisible();

  await planner.getByLabel("Avg over session").uncheck();
  await expect(planner.getByText("pending")).toBeVisible();
  await planner.getByLabel("Avg over session").check();
  await planner.getByLabel("Only current gear").check();
  await planner.getByLabel("Only current gear").uncheck();
  await planner.getByLabel("Planner pool Iron scimitar").uncheck();
  await planner.getByLabel("Optimize metric").selectOption("dps");
  await planner.getByLabel("Strength current XP").fill("274000");
  await planner.getByLabel("Strength target").fill("63");
  await planner.getByLabel("Lock Attack").check();
  await expect(planner.getByText("pending")).toBeVisible();

  await planner.getByRole("button", { name: "Recompute plan" }).click();
  await expect(planner.getByText("ready")).toBeVisible();
  await expect(planner.getByRole("table", { name: "Planner training order" })).toContainText(
    "Strength"
  );
  await expect(planner.getByLabel("Planner summary")).toContainText("Steps");
  await expect(planner.getByRole("img", { name: "DPS vs cumulative XP chart" })).toBeVisible();
  await expect(planner.getByLabel("Planner gear timeline")).toContainText(/XP|No gear unlocks/);
  await expect(planner).not.toContainText("manual requirement fallback");

  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:planner-ui") ?? "";
    return (
      saved.includes('"metric":"dps"') &&
      saved.includes('"averageOverSession":true') &&
      saved.includes('"strength":274000') &&
      saved.includes('"strength":63') &&
      saved.includes('"attack":true') &&
      saved.includes('"gearPool":{"weapon":') &&
      !saved.includes('"iron_scimitar"')
    );
  });
});

test("uses the Duel tab to snapshot import export rename load delete and persist setup comparisons", async ({
  page
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await tabs.getByRole("tab", { name: "Duel" }).click();
  const duel = page.getByRole("region", { name: "Duel", exact: true });
  await expect(duel).toBeVisible();
  await expect(duel.getByRole("heading", { name: "Setup duel" })).toBeVisible();
  await expect(duel).not.toContainText("planned");
  await expect(duel.getByRole("table", { name: "Duel comparison" })).toContainText("GP/XP");

  await duel.getByRole("button", { name: "Snapshot current setup" }).click();
  const table = duel.getByRole("table", { name: "Duel comparison" });
  await expect(table.getByRole("row", { name: /Live setup/ })).toBeVisible();
  await expect(table.getByLabel(/Rename snapshot/)).toHaveCount(1);
  await expect(table).toContainText("XP/hr");
  await expect(table).toContainText("Net GP/hr");
  await expect(table).toContainText("GP/XP");

  const rename = table.getByLabel(/Rename snapshot/).first();
  await rename.fill("Melee saved");
  await rename.press("Enter");
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:duel-snapshots");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return (
      saved.version === 1 &&
      saved.data?.snapshots?.[0]?.name === "Melee saved" &&
      saved.data.snapshots[0]?.form?.combatStyle === "melee" &&
      !raw.includes("effectiveXpPerHour")
    );
  });
  const exportedSnapshotJson = await page.evaluate(() => {
    const saved = JSON.parse(window.localStorage.getItem("index-sim:duel-snapshots") ?? "null");
    return JSON.stringify({
      version: 1,
      exportedAt: "2026-07-10T12:00:00.000Z",
      data: saved.data
    });
  });
  const downloadPromise = page.waitForEvent("download");
  await duel.getByRole("button", { name: "Export snapshots" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("index-sim-duel-snapshots.json");

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Duel" }).click();
  const reloadedDuel = page.getByRole("region", { name: "Duel", exact: true });
  await expect(reloadedDuel).toBeVisible();
  let reloadedTable = reloadedDuel.getByRole("table", { name: "Duel comparison" });
  await expect(reloadedTable.getByLabel("Rename snapshot Melee saved")).toBeVisible();

  await chooseSearchableOption(page.getByLabel("Setup context"), "Monster", "Rock Crab");
  const combatType = page.getByLabel("Combat type");
  await combatType.getByRole("button", { name: "ranged" }).click();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Duel" }).click();
  await expect(reloadedDuel).toBeVisible();
  reloadedTable = reloadedDuel.getByRole("table", { name: "Duel comparison" });
  await expect(reloadedTable).toContainText("best", { timeout: 30000 });
  const reviewDiff = reloadedTable.getByRole("button", { name: "Review diff" });
  await reviewDiff.click();
  const hideDiff = reloadedTable.getByRole("button", { name: "Hide diff" });
  await expect(hideDiff).toHaveAttribute("aria-expanded", "true");
  await expect(hideDiff).toHaveAttribute("aria-controls", /^duel-diff-/);
  const setupDiff = reloadedTable.getByRole("region", {
    name: "Melee saved setup and impact diff"
  });
  await expect(setupDiff).toContainText("Snapshot compared with live");
  await expect(setupDiff).toContainText("Combat style");
  await expect(setupDiff).toContainText("Impact is snapshot minus live");
  await expect(setupDiff).toContainText("current target, cannon, loot policy and active prices");
  await hideDiff.click();
  await expect(setupDiff).toHaveCount(0);
  await reloadedTable.getByRole("button", { name: "Load" }).click();
  await expect(combatType.getByRole("button", { name: "melee" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expectSearchableSelection(page.getByLabel("Setup context"), "Monster", "rock_crab");

  await page.evaluate(() => window.localStorage.setItem("duel_unrelated_key", "keep"));
  await reloadedTable.getByRole("button", { name: "Delete" }).click();
  await expect(reloadedTable).toContainText("No snapshots");
  const duelUndo = page.getByLabel("Local state undo");
  await expect(duelUndo).toContainText("Deleted Duel snapshot: Melee saved");
  await duelUndo.getByRole("button", { name: "Undo" }).click();
  await expect(reloadedTable.getByLabel("Rename snapshot Melee saved")).toBeVisible();
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:duel-snapshots");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return (
      saved.version === 1 &&
      saved.data?.snapshots?.[0]?.name === "Melee saved" &&
      window.localStorage.getItem("duel_unrelated_key") === "keep"
    );
  });

  await reloadedTable.getByRole("button", { name: "Delete" }).click();
  await expect(reloadedTable).toContainText("No snapshots");
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:duel-snapshots");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return (
      saved.version === 1 &&
      Array.isArray(saved.data?.snapshots) &&
      saved.data.snapshots.length === 0 &&
      window.localStorage.getItem("duel_unrelated_key") === "keep"
    );
  });

  await reloadedDuel.getByLabel("Import snapshots").setInputFiles({
    name: "duel-snapshots.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportedSnapshotJson)
  });
  await expect(reloadedDuel.getByLabel("Duel snapshot import notice")).toContainText(
    "1 added, 0 updated"
  );
  await expect(reloadedTable.getByLabel("Rename snapshot Melee saved")).toBeVisible();
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:duel-snapshots");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return (
      saved.data?.snapshots?.[0]?.name === "Melee saved" &&
      window.localStorage.getItem("duel_unrelated_key") === "keep"
    );
  });
});

test("builds and filters the all-monster Duel setup matrix on demand", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await tabs.getByRole("tab", { name: "Duel" }).click();
  const duel = page.getByRole("region", { name: "Duel", exact: true });
  await duel.getByRole("button", { name: "Snapshot current setup" }).click();
  await selectCombatType(page, "ranged");
  await tabs.getByRole("tab", { name: "Duel" }).click();

  await expect(duel.getByRole("table", { name: "All-monster setup matrix" })).toHaveCount(0);
  await duel.getByRole("button", { name: "Monster matrix" }).click();
  const matrix = duel.getByRole("table", { name: "All-monster setup matrix" });
  await expect(matrix).toBeVisible({ timeout: 30_000 });
  await expect(matrix.locator("thead th")).toHaveCount(3);
  await expect.poll(async () => matrix.locator("tbody tr").count()).toBeGreaterThan(60);
  await expect(matrix.locator('tbody tr[aria-current="true"]')).toHaveCount(1);
  await expect(matrix.locator('td[aria-label*="XP/hr"]')).not.toHaveCount(0);
  await expect(matrix.locator("td.best")).not.toHaveCount(0);

  await duel.getByLabel("Duel matrix metric").getByRole("button", { name: "DPS" }).click();
  await expect(matrix.locator('td[aria-label*="DPS"]')).not.toHaveCount(0);
  await duel.getByLabel("Find matrix monster").fill("tribesman");
  await expect(matrix.locator("tbody tr")).toHaveCount(1);
  await expect(matrix.getByRole("row", { name: /Tribesman/ })).toBeVisible();
  await expectPageWidthContained(page);
});

test("keeps Compare, Planner and Duel worker calculations off the main event loop", async ({
  page
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const state = { durations: [] as number[] };
    const observer = new PerformanceObserver((list) => {
      state.durations.push(...list.getEntries().map((entry) => entry.duration));
    });
    observer.observe({ entryTypes: ["longtask"] });
    (window as unknown as { calculationTaskProbe: typeof state }).calculationTaskProbe = state;
  });
  await expect(
    page.getByLabel("Compare calculation status: Current. Rows match the live setup.")
  ).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => {
    (
      window as unknown as { calculationTaskProbe: { durations: number[] } }
    ).calculationTaskProbe.durations = [];
  });
  await page.getByLabel("Combat setup").getByLabel("ATT", { exact: true }).fill("61");
  await expect(
    page.getByLabel("Compare calculation status: Current. Rows match the live setup.")
  ).toBeVisible({ timeout: 30_000 });
  const compareLongTask = await page.evaluate(() =>
    Math.max(
      0,
      ...(window as unknown as { calculationTaskProbe: { durations: number[] } })
        .calculationTaskProbe.durations
    )
  );
  expect(compareLongTask).toBeLessThan(200);

  await page.evaluate(() => {
    (
      window as unknown as { calculationTaskProbe: { durations: number[] } }
    ).calculationTaskProbe.durations = [];
  });
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Planner" }).click();
  await expect(page.getByLabel("Planner summary")).toBeVisible({ timeout: 30_000 });
  const plannerLongTask = await page.evaluate(() =>
    Math.max(
      0,
      ...(window as unknown as { calculationTaskProbe: { durations: number[] } })
        .calculationTaskProbe.durations
    )
  );
  expect(plannerLongTask).toBeLessThan(200);

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Duel" }).click();
  await page
    .getByRole("region", { name: "Duel", exact: true })
    .getByRole("button", {
      name: "Snapshot current setup"
    })
    .click();
  await page.evaluate(() => {
    (
      window as unknown as { calculationTaskProbe: { durations: number[] } }
    ).calculationTaskProbe.durations = [];
  });
  await page
    .getByRole("region", { name: "Duel", exact: true })
    .getByRole("button", {
      name: "Monster matrix"
    })
    .click();
  await expect(page.getByRole("table", { name: "All-monster setup matrix" })).toBeVisible({
    timeout: 30_000
  });
  const duelLongTask = await page.evaluate(() =>
    Math.max(
      0,
      ...(window as unknown as { calculationTaskProbe: { durations: number[] } })
        .calculationTaskProbe.durations
    )
  );
  expect(duelLongTask).toBeLessThan(200);
});

test("reviews and imports compatible legacy setup data", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "sim_input_v3",
      JSON.stringify({
        combatType: "ranged",
        ranged: 72,
        defence: 63,
        hp: 64,
        prayer: 43,
        _monsterId: "greater_demon",
        weapon: "magic_shortbow",
        ammo: "rune_arrow",
        style: "rapid",
        trip: { safespot: false, protect: "missiles", antifire: true },
        monsterSetups: {
          giant: { combatType: "melee", weapon: "dragon_longsword" }
        },
        cannonByMonster: {
          dagannoth: { enabled: true, targets: 6, respawnSec: 30 }
        },
        duelSetups: [
          {
            name: "Legacy ranged",
            setup: {
              combatType: "ranged",
              weapon: "magic_shortbow",
              ammo: "rune_arrow",
              style: "rapid",
              boosts: ["ranging"]
            }
          }
        ]
      })
    );
    window.localStorage.setItem(
      "sim_planner_v1",
      JSON.stringify({ note: "planner-payload-sentinel" })
    );
    window.localStorage.setItem(
      "index-sim:planner-ui",
      JSON.stringify({
        version: 1,
        savedAt: "2026-07-06T12:00:00.000Z",
        data: {
          metric: "balanced",
          targetLevels: { attack: 70, strength: 70, defence: 50, ranged: 50, magic: 50 },
          currentXp: { attack: 1000, strength: 2000, defence: 0, ranged: 0, magic: 0 },
          skillLocks: {
            attack: false,
            strength: true,
            defence: false,
            ranged: false,
            magic: false
          },
          averageOverSession: true,
          onlyCurrentGear: false,
          gearPool: {}
        }
      })
    );
    window.localStorage.setItem("sim_prices_v1", JSON.stringify({ lobster: 224, big_bones: 390 }));
    window.localStorage.setItem("sim_alch_v1", JSON.stringify({ lobster: 90, big_bones: 0 }));
    window.localStorage.setItem("sim_scraped_at_v1", "1700000000");
    window.localStorage.setItem("sim_scraped_keys_v1", JSON.stringify(["lobster", "big_bones"]));
    window.localStorage.setItem(
      "sim_loot_prefs_v1",
      JSON.stringify({ "Big bones": "bury", "Not a real drop": "skip" })
    );
    window.localStorage.setItem(
      "index-sim:loot-prefs",
      JSON.stringify({
        version: 1,
        savedAt: "2026-07-06T12:00:00.000Z",
        data: {
          giant: {
            key_iron_full_helm_1: "skip"
          }
        }
      })
    );
    window.localStorage.setItem(
      "sim_hidden_tiers_v1",
      JSON.stringify({ bronze: true, red_dhide: true, not_a_tier: true })
    );
    window.localStorage.setItem("sim_compare_sort_v1", JSON.stringify({ key: "name", dir: -1 }));
    window.localStorage.setItem(
      "sim_irrelevant_v1",
      JSON.stringify(["rock_crab", "not_a_monster"])
    );
    window.localStorage.setItem(
      "sim_price_history_v1",
      JSON.stringify([{ note: "history-payload-sentinel" }])
    );
    window.localStorage.setItem("sim_hiscore_player", "Fixture Player");
  });

  await page.goto("/");
  const migration = page.getByLabel("Legacy setup migration");

  await expect(migration).toBeVisible();
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Legacy setup ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Hiscores player ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Loot preferences ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Custom setups ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Cannon map ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Duel snapshots ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText(
    "Hidden gear tiers ready"
  );
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Compare state ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Planner review-only");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Prices ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText(
    "Price history review-only"
  );
  await expect(migration.getByLabel("Legacy data summary")).toContainText(
    "Review-only decisions shown"
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText("Import action:");
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText(
    "Custom setups: 1 importable, 0 skipped"
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText(
    "Cannon map: 1 importable, 0 skipped"
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText(
    "Duel snapshots: 1 importable, 0 skipped"
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText(
    "Rewrite Planner V1 does not import legacy Planner state; Import and Keep leave it in legacy storage."
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText(
    "Full legacy price history is review-only in V1; 1 history key detected and not migrated."
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText("Keep action:");
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText("Clear action:");
  await expect(migration).not.toContainText("planner-payload-sentinel");
  await expect(migration).not.toContainText("history-payload-sentinel");
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Compatible setup fields"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Legacy custom setups into rewrite monster-specific setups"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Legacy cannon map into rewrite per-monster cannon settings"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Legacy Duel snapshots into rewrite Duel snapshot storage"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Loot preferences into rewrite per-monster drop actions"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Hidden gear tiers into rewrite gear-menu preferences"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Compare sort into dense compare state"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Compare hidden monsters into dense compare state"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "sim_planner_v1: review only"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "legacy planner state was detected but not imported"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "sim_scraped_keys_v1: intentional reset"
  );
  const keyReview = migration.getByRole("table", { name: "Legacy storage key review" });
  await expect(keyReview.getByRole("row", { name: /sim_input_v3.*migrate/ })).toBeVisible();
  await expect(keyReview.getByRole("row", { name: /sim_loot_prefs_v1.*migrate/ })).toBeVisible();
  await expect(keyReview.getByRole("row", { name: /sim_hidden_tiers_v1.*migrate/ })).toBeVisible();
  await expect(keyReview.getByRole("row", { name: /sim_compare_sort_v1.*migrate/ })).toBeVisible();
  await expect(keyReview.getByRole("row", { name: /sim_irrelevant_v1.*migrate/ })).toBeVisible();
  await expect(keyReview.getByRole("row", { name: /sim_planner_v1.*review only/ })).toBeVisible();
  await expect(
    keyReview.getByRole("row", { name: /sim_scraped_keys_v1.*intentional reset/ })
  ).toBeVisible();
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "hiddenGearTiers.not_a_tier: unknown hidden tier id"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "lootPrefs.Not a real drop: unknown loot preference row name"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "compare.irrelevantMonsterIds.not_a_monster: unknown monster id"
  );

  await migration.getByRole("button", { name: "Import compatible data" }).click();
  await expect(migration).toHaveCount(0);
  await expect(page.locator(".topbar")).toContainText("Imported compatible legacy data");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("ranged");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("greater_demon");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    return (
      saved.includes('"combatStyle":"ranged"') &&
      saved.includes('"monsterId":"greater_demon"') &&
      saved.includes('"denseCompare"') &&
      saved.includes('"key":"monsterName"') &&
      saved.includes('"direction":"asc"') &&
      saved.includes('"irrelevantMonsterIds":["rock_crab"]') &&
      parsed.data?.customSetupsByMonster?.giant?.weaponId === "dragon_longsword" &&
      parsed.data?.customSetupsByMonster?.giant?.monsterId === "giant" &&
      parsed.data?.cannonByMonster?.dagannoth?.enabled === true &&
      parsed.data?.cannonByMonster?.dagannoth?.targets === 6 &&
      parsed.data?.cannonByMonster?.dagannoth?.respawnSec === 30 &&
      (window.localStorage.getItem("index-sim:duel-snapshots") ?? "").includes(
        '"name":"Legacy ranged"'
      ) &&
      (window.localStorage.getItem("index-sim:hidden-gear-tiers") ?? "").includes(
        '"bronze":true'
      ) &&
      (window.localStorage.getItem("index-sim:hidden-gear-tiers") ?? "").includes(
        '"red_dhide":true'
      ) &&
      (window.localStorage.getItem("index-sim:loot-prefs") ?? "").includes(
        '"key_big_bones_0":"bury"'
      ) &&
      (window.localStorage.getItem("index-sim:loot-prefs") ?? "").includes(
        '"key_iron_full_helm_1":"skip"'
      ) &&
      window.localStorage.getItem("sim_input_v3") !== null &&
      window.localStorage.getItem("sim_planner_v1") !== null &&
      window.localStorage.getItem("sim_loot_prefs_v1") !== null &&
      window.localStorage.getItem("sim_hidden_tiers_v1") !== null &&
      window.localStorage.getItem("sim_compare_sort_v1") !== null &&
      window.localStorage.getItem("sim_irrelevant_v1") !== null &&
      window.localStorage.getItem("sim_prices_v1") !== null &&
      window.localStorage.getItem("sim_alch_v1") !== null &&
      window.localStorage.getItem("sim_scraped_at_v1") !== null &&
      window.localStorage.getItem("sim_scraped_keys_v1") !== null &&
      window.localStorage.getItem("sim_price_history_v1") !== null &&
      window.localStorage.getItem("sim_hiscore_player") !== null &&
      window.localStorage.getItem("index-sim:legacy-migration-dismissed") !== null &&
      (window.localStorage.getItem("index-sim:planner-ui") ?? "").includes('"metric":"balanced"') &&
      !(window.localStorage.getItem("index-sim:planner-ui") ?? "").includes('"metric":"xph"') &&
      (window.localStorage.getItem("index-sim:hiscores:last-player") ?? "").includes(
        "Fixture Player"
      ) &&
      (window.localStorage.getItem("index-sim:price-history") ?? "").includes(
        "legacy-browser-prices"
      ) &&
      (window.localStorage.getItem("index-sim:price-set:selected") ?? "").includes(
        "legacy-browser-prices"
      )
    );
  });
  await expect(page.locator(".topbar")).toContainText("Legacy browser prices");
  const legacyImport = await resultMetricSnapshot(page);
  expect({
    legacyImport
  }).toEqual({
    legacyImport: {
      DPS: "3.06",
      "MAX HIT": "14.0",
      "HIT %": "78.7%",
      "XP/HR": "17,756",
      "GP/HR NET": "-263,827",
      "KILLS/HR": "109",
      "GP/KILL": "122",
      "SUPPLY/KILL": "5,292"
    }
  });
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Duel" }).click();
  await expect(page.getByLabel("Rename snapshot Legacy ranged")).toHaveValue("Legacy ranged");
});

test("updates manual combat overrides and resets to derived values", async ({ page }) => {
  await page.goto("/");

  const setup = page.getByLabel("Combat setup");
  await setup.getByLabel("ACC+", { exact: true }).fill("120");
  await setup.getByLabel("DMG+", { exact: true }).fill("95");
  await setup.getByLabel("SPD", { exact: true }).fill("1.2");
  const assumptions = page.getByLabel("Active assumptions");
  await expect(assumptions).toContainText("Manual combat overrides");

  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"manualOverrides"') &&
      saved.includes('"accuracyBonus":120') &&
      saved.includes('"damageBonus":95') &&
      saved.includes('"attackSpeedSec":1.2')
    );
  });

  await assumptions.getByRole("button", { name: "Reset manual combat overrides" }).click();
  await expect(assumptions).not.toContainText("Manual combat overrides");

  await selectCombatType(page, "melee");
  const overrides = page.getByLabel("Manual combat overrides");
  await expect(overrides.getByLabel("Accuracy bonus")).toHaveValue("");
  await expect(overrides.getByLabel("Damage bonus")).toHaveValue("");
  await expect(overrides.getByLabel("Attack speed sec")).toHaveValue("");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"accuracyBonus":null') &&
      saved.includes('"damageBonus":null') &&
      saved.includes('"attackSpeedSec":null')
    );
  });
});

test("surfaces setup requirement warnings and reviews the active loadout", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Combat setup").getByLabel("DEF", { exact: true }).fill("1");

  const assumptions = page.getByLabel("Active assumptions");
  await expect(assumptions).toContainText("Setup requirements");
  await expect(assumptions).toContainText("Rune full helm requires Defence 40");
  await expect(
    assumptions.getByRole("button", { name: "Review Setup requirements" })
  ).toBeVisible();

  await assumptions.getByRole("button", { name: "Review Setup requirements" }).click();
  await expect(
    page.getByLabel("Workbench tabs").getByRole("tab", { name: "Melee setup" })
  ).toHaveAttribute("aria-selected", "true");

  const equipmentPane = page.getByLabel("Equipment loadout");
  await expect(equipmentPane).toBeVisible();
  await expect(equipmentPane.getByRole("button", { name: "Best Body" })).toHaveAttribute(
    "title",
    "Best visible option: Rune platebody - requires Defence 40, current 1"
  );
  await expect(equipmentPane.getByLabel("Setup requirement warnings")).toContainText(
    "Rune platebody requires Defence 40; current Defence 1."
  );
  await expect(equipmentPane).toContainText("Generated requirement data");
  await expect(equipmentPane).not.toContainText("Manual requirement fallback");
});

test("keeps legacy data and dismisses the migration notice", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "sim_input_v3",
      JSON.stringify({
        combatType: "melee",
        monsterSetups: { giant: { weapon: "dragon_longsword" } },
        cannonByMonster: { dagannoth: { enabled: true, targets: 6, respawnSec: 30 } }
      })
    );
    window.localStorage.setItem("sim_planner_v1", "{not json");
  });

  await page.goto("/");
  const migration = page.getByLabel("Legacy setup migration");
  await expect(migration).toBeVisible();

  await migration.getByRole("button", { name: "Keep legacy data" }).click();
  await expect(migration).toHaveCount(0);
  await expect(page.locator(".topbar")).toContainText("Kept legacy data");
  await page.waitForFunction(() => {
    const legacyInput = window.localStorage.getItem("sim_input_v3") ?? "";
    return (
      legacyInput.includes("monsterSetups") &&
      legacyInput.includes("cannonByMonster") &&
      window.localStorage.getItem("sim_planner_v1") !== null &&
      window.localStorage.getItem("index-sim:legacy-migration-dismissed") !== null
    );
  });
});

test("surfaces and clears invalid rewrite local state in Settings", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("index-sim:hidden-gear-tiers", "{");
    window.localStorage.setItem("sim_input_v3", JSON.stringify({ combatType: "melee" }));
    window.localStorage.setItem("index-sim:unknown-test", "keep");
  });

  await page.goto("/");
  const migrationNotice = page.getByLabel("Legacy setup migration");
  const migrationMetrics = await migrationNotice.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: window.getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight
  }));
  expect(migrationMetrics.overflowY).toBe("auto");
  expect(migrationMetrics.scrollHeight).toBeGreaterThan(migrationMetrics.clientHeight);

  const settingsTab = page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" });
  await settingsTab.focus();
  await settingsTab.press("Enter");

  const recovery = page.getByLabel("Local state recovery");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("Hidden gear tiers");
  await expect(recovery).toContainText("Saved data is not valid JSON");
  await expect(recovery).toContainText("Needs attention 1");
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:hidden-gear-tiers"))
  ).toBe("{");

  await recovery.getByRole("button", { name: "Clear Hidden gear tiers" }).click();
  await recovery.getByRole("button", { name: "Confirm clear Hidden gear tiers" }).click();
  await expect(recovery).toContainText("Cleared Hidden gear tiers");
  await expect(recovery).toContainText("Needs attention 0");

  expect(
    await page.evaluate(
      () =>
        window.localStorage.getItem("index-sim:hidden-gear-tiers") === null &&
        window.localStorage.getItem("sim_input_v3") !== null &&
        window.localStorage.getItem("index-sim:unknown-test") === "keep"
    )
  ).toBe(true);
});

test("falls back without overwriting a setup that references unavailable game data", async ({
  page
}) => {
  const unavailableMonsterId = "removed_revision_monster";
  const incompatibleSetup = savedSetupFromForm({
    ...DEFAULT_FORM_STATE,
    monsterId: unavailableMonsterId
  });
  await page.addInitScript(
    ({ key, version, setup }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version,
          savedAt: "2026-07-11T00:00:00.000Z",
          data: setup
        })
      );
    },
    {
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      setup: incompatibleSetup
    }
  );

  await page.goto("/");
  await expect(page.getByLabel("Combat setup").getByLabel("TARGET", { exact: true })).toHaveValue(
    DEFAULT_FORM_STATE.monsterId
  );
  await expect(page.locator(".topbar")).toContainText(
    "Saved rewrite setup is incompatible; defaults are active"
  );

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const recovery = page.getByLabel("Local state recovery");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("Rewrite setup");
  await expect(recovery).toContainText("Saved data failed validation");
  await expect(recovery).toContainText("Needs attention 1");
  await expect(recovery).not.toContainText(unavailableMonsterId);

  expect(
    await page.evaluate(
      ({ key, unavailableId }) => (window.localStorage.getItem(key) ?? "").includes(unavailableId),
      { key: REWRITE_SETUP_STORAGE_KEY, unavailableId: unavailableMonsterId }
    )
  ).toBe(true);
});

test("keeps incompatible saved Duel snapshots recoverable and out of the runtime", async ({
  page
}) => {
  const unavailableMonsterId = "removed_duel_monster";
  const snapshot = createDuelSnapshot("removed-duel", "Removed Duel target", {
    ...DEFAULT_FORM_STATE,
    monsterId: unavailableMonsterId
  });
  await page.addInitScript(
    ({ key, version, savedSnapshot }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version,
          savedAt: "2026-07-11T00:00:00.000Z",
          data: { snapshots: [savedSnapshot] }
        })
      );
    },
    {
      key: DUEL_SNAPSHOTS_STORAGE_KEY,
      version: DUEL_SNAPSHOTS_VERSION,
      savedSnapshot: snapshot
    }
  );

  await page.goto("/");
  await expect(page.locator(".topbar")).toContainText(
    "Saved Duel snapshots are incompatible; an empty list is active"
  );
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Duel" }).click();
  await expect(page.getByRole("region", { name: "Duel", exact: true })).toContainText(
    "0 / 12 snapshots"
  );

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const recovery = page.getByLabel("Local state recovery");
  await expect(recovery).toContainText("Duel snapshots");
  await expect(recovery).toContainText("Needs attention 1");
  await expect(recovery).not.toContainText(unavailableMonsterId);
  expect(
    await page.evaluate(
      ({ key, unavailableId }) => (window.localStorage.getItem(key) ?? "").includes(unavailableId),
      { key: DUEL_SNAPSHOTS_STORAGE_KEY, unavailableId: unavailableMonsterId }
    )
  ).toBe(true);
});

test("surfaces rewrite local storage save failures without losing current session edits", async ({
  page
}) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key: string, value: string) {
      if (String(key).startsWith("index-sim:")) {
        throw new Error("raw localStorage failure payload");
      }
      return originalSetItem.call(this, key, value);
    };
  });

  await page.goto("/");
  const defenceInput = page.getByLabel("Combat setup").getByLabel("DEF", { exact: true });
  await defenceInput.fill("7");
  await expect(defenceInput).toHaveValue("7");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const recovery = page.getByLabel("Local state recovery");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText(
    "Local storage is unavailable. Changes may not persist after reload."
  );
  await expect(recovery).toContainText("Save failed");
  await expect(recovery).toContainText("Current session data remains active");
  await expect(recovery).not.toContainText("raw localStorage failure payload");
});

test("clears only known legacy data after confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "sim_input_v3",
      JSON.stringify({
        combatType: "melee",
        monsterSetups: { giant: { weapon: "dragon_longsword" } },
        cannonByMonster: { dagannoth: { enabled: true, targets: 6, respawnSec: 30 } }
      })
    );
    window.localStorage.setItem("sim_planner_v1", "{}");
    window.localStorage.setItem("sim_loot_prefs_v1", "{}");
    window.localStorage.setItem("sim_hidden_tiers_v1", "{}");
    window.localStorage.setItem("sim_compare_sort_v1", "{}");
    window.localStorage.setItem("sim_irrelevant_v1", "{}");
    window.localStorage.setItem("sim_loot_comp_open", "1");
    window.localStorage.setItem("sim_prices_v1", "{}");
    window.localStorage.setItem("sim_alch_v1", "{}");
    window.localStorage.setItem("sim_scraped_at_v1", "2026-07-05T12:00:00.000Z");
    window.localStorage.setItem("sim_scraped_keys_v1", "[]");
    window.localStorage.setItem("sim_price_history_v1", "[]");
    window.localStorage.setItem("sim_price_history_sanitized_v1", "[]");
    window.localStorage.setItem("sim_price_history_sanitized_v2", "[]");
    window.localStorage.setItem("sim_price_history_sanitized_v3", "[]");
    window.localStorage.setItem("sim_price_history_sanitized_v4", "[]");
    window.localStorage.setItem("sim_hiscore_player", "Fixture Player");
    window.localStorage.setItem("unrelated_key", "keep");
  });

  await page.goto("/");
  const migration = page.getByLabel("Legacy setup migration");
  await expect(migration).toBeVisible();

  await migration.getByRole("button", { name: "Clear legacy data" }).click();
  await expect(migration).toContainText("Clear will remove these known legacy keys");
  await expect(migration).toContainText("sim_loot_prefs_v1");
  await expect(migration).toContainText("sim_price_history_sanitized_v4");
  await expect(migration.getByRole("button", { name: "Confirm clear" })).toBeVisible();
  await migration.getByRole("button", { name: "Confirm clear" }).click();
  await expect(migration).toHaveCount(0);
  await expect(page.locator(".topbar")).toContainText("Cleared 17 legacy keys");
  await page.waitForFunction(() => {
    const knownKeys = [
      "sim_input_v3",
      "sim_planner_v1",
      "sim_loot_prefs_v1",
      "sim_hidden_tiers_v1",
      "sim_compare_sort_v1",
      "sim_irrelevant_v1",
      "sim_loot_comp_open",
      "sim_prices_v1",
      "sim_alch_v1",
      "sim_scraped_at_v1",
      "sim_scraped_keys_v1",
      "sim_price_history_v1",
      "sim_price_history_sanitized_v1",
      "sim_price_history_sanitized_v2",
      "sim_price_history_sanitized_v3",
      "sim_price_history_sanitized_v4",
      "sim_hiscore_player"
    ];
    return (
      knownKeys.every((key) => window.localStorage.getItem(key) === null) &&
      window.localStorage.getItem("unrelated_key") === "keep" &&
      window.localStorage.getItem("index-sim:legacy-migration-dismissed") !== null
    );
  });
});

test("does not overwrite an existing rewrite setup before import action", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"monsterId":"dagannoth"');
  });
  await page.evaluate(() => {
    window.localStorage.setItem(
      "sim_input_v3",
      JSON.stringify({
        combatType: "ranged",
        _monsterId: "greater_demon",
        weapon: "magic_shortbow",
        ammo: "rune_arrow",
        style: "rapid"
      })
    );
  });

  await page.reload();

  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("dagannoth");
  await expect(page.getByLabel("Legacy setup migration")).toBeVisible();
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"monsterId":"dagannoth"') && !saved.includes('"greater_demon"');
  });
});

test("keeps setup import failures non-fatal and retryable", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"monsterId":"dagannoth"');
  });

  const beforeMetrics = await resultMetricSnapshot(page);
  const savedBefore = await page.evaluate(() =>
    window.localStorage.getItem("index-sim:rewrite-setup")
  );
  const setupInput = page
    .locator(".topbar")
    .locator("label.file-button")
    .filter({ hasText: "Import setup" })
    .locator('input[type="file"]');

  await setupInput.setInputFiles({
    name: "broken-setup.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not-json")
  });

  await expect(page.getByLabel("Workbench shell")).toBeVisible();
  await expect(page.getByLabel("Setup import notice")).toContainText("not valid JSON");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("dagannoth");
  expect(await resultMetricSnapshot(page)).toEqual(beforeMetrics);
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:rewrite-setup"))).toBe(
    savedBefore
  );
  await expect(setupInput).toHaveValue("");

  await setupInput.setInputFiles({
    name: "wrong-version-setup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 999,
        savedAt: "2026-07-07T12:00:00.000Z",
        data: {}
      })
    )
  });

  await expect(page.getByLabel("Workbench shell")).toBeVisible();
  await expect(page.getByLabel("Setup import notice")).toContainText("version");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("dagannoth");
  expect(await resultMetricSnapshot(page)).toEqual(beforeMetrics);
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:rewrite-setup"))).toBe(
    savedBefore
  );
});

test("keeps PriceSet import failures non-fatal and recoverable", async ({ page }) => {
  await page.route("**/price-history.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const settings = page.locator('[aria-label="Price data settings"]');
  const priceSetSummary = settings.locator('[aria-label="Active PriceSet summary"]');
  const historySummary = page.locator('[aria-label="Price history summary"]');
  const summaryText = async (locator: Locator) =>
    (await locator.locator("span").allTextContents()).map((text) => text.trim()).join(" | ");

  const priceSetBefore = await summaryText(priceSetSummary);
  const historyBefore = await summaryText(historySummary);
  const storedHistoryBefore = await page.evaluate(() =>
    window.localStorage.getItem("index-sim:price-history")
  );
  const topbarPriceInput = page
    .locator(".topbar")
    .locator("label.file-button")
    .filter({ hasText: "Import prices" })
    .locator('input[type="file"]');

  await topbarPriceInput.setInputFiles({
    name: "bad-price-set.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        id: "bad-price-set",
        label: "Bad price set",
        source: "manual",
        createdAt: "2026-07-07T12:00:00.000Z",
        itemPrices: { lobster: -1, shark: "expensive" },
        alchValues: { lobster: 0 }
      })
    )
  });

  await expect(page.getByLabel("Workbench shell")).toBeVisible();
  await expect(page.locator(".topbar").getByLabel("Price import notice")).toContainText(
    "Code validation_failed"
  );
  await expect(page.locator(".topbar").getByLabel("Price import notice")).toContainText(
    "itemPrices.lobster"
  );
  await expect(page.locator(".topbar").getByLabel("Price import notice")).toContainText(
    "Import was not applied"
  );
  await expect(page.locator(".topbar").getByLabel("Price import notice")).not.toContainText(
    "SyntaxError"
  );
  await expect(page.locator(".topbar").getByLabel("Price import notice")).not.toContainText(
    "expensive"
  );
  await expect(page.locator(".topbar").getByLabel("Price import notice")).not.toContainText(
    process.cwd()
  );
  await expect(topbarPriceInput).toHaveValue("");
  expect(await summaryText(priceSetSummary)).toBe(priceSetBefore);
  expect(await summaryText(historySummary)).toBe(historyBefore);
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    storedHistoryBefore
  );

  const importedPriceSet = {
    id: "manual-after-error",
    label: "Imported after error prices",
    source: "manual",
    createdAt: "2026-07-07T12:00:00.000Z",
    itemPrices: { big_bones: 900, lobster: 80 },
    alchValues: { big_bones: 0, lobster: 0 }
  };
  await settings
    .locator("label.file-button")
    .filter({ hasText: "Import PriceSet" })
    .locator('input[type="file"]')
    .setInputFiles({
      name: "manual-after-error-prices.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(importedPriceSet))
    });

  await expect(settings.getByLabel("Price import notice")).toContainText("Imported market prices");
  await expect(priceSetSummary).toContainText("Label Imported after error prices");
  await expect(historySummary).toContainText("Snapshots 1");
});

test("updates results when the combat style changes", async ({ page }) => {
  await page.goto("/");
  await selectCombatType(page, "ranged");
  const tabs = page.getByLabel("Workbench tabs");
  const combatSetup = page.getByLabel("Combat setup");
  await expect(combatSetup.getByLabel("RNG")).toBeVisible();
  await expect(combatSetup.getByLabel("TYPE", { exact: true })).toHaveJSProperty(
    "tagName",
    "OUTPUT"
  );
  await expect(tabs.getByRole("tab", { name: / setup$/ })).toHaveCount(1);
  await expect(tabs.getByRole("tab", { name: "Ranged setup" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "Melee setup" })).toHaveCount(0);
  await expect(tabs.getByRole("tab", { name: "Magic setup" })).toHaveCount(0);
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("giant");
  await expect(page.getByText("XP/HR").first()).toBeVisible();

  await tabs.getByRole("tab", { name: "Compare" }).click();
  await tabs.getByRole("tab", { name: "Ranged setup" }).click();
  await expect(
    page.getByLabel("Combat type").getByRole("button", { name: "ranged", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
});

test("restores per-combat-style loadout edits when switching styles", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const special = page.getByRole("region", { name: "Special attack", exact: true });

  await selectCombatType(page, "melee");
  await special.getByLabel("Spec weapon").selectOption("dragon_dagger_p");
  await page.getByLabel("PRAYER", { exact: true }).selectOption("clarity");

  await selectCombatType(page, "ranged");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("ranged");
  await special.getByLabel("Spec weapon").selectOption("magic_shortbow");
  await special.getByLabel("Spec ammo").selectOption("rune_arrow");
  await page.getByLabel("BOOST", { exact: true }).selectOption("ranging");

  await selectCombatType(page, "melee");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("melee");
  await expect(special.getByLabel("Spec weapon")).toHaveValue("dragon_dagger_p");
  await expect(page.getByLabel("PRAYER", { exact: true })).toHaveValue("clarity");

  await selectCombatType(page, "ranged");
  await expect(special.getByLabel("Spec weapon")).toHaveValue("magic_shortbow");
  await expect(special.getByLabel("Spec ammo")).toHaveValue("rune_arrow");
  await expect(page.getByLabel("BOOST", { exact: true })).toHaveValue("ranging");
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return (
      saved.version === 3 &&
      saved.data?.form?.perStyleLoadouts?.melee?.specialAttack?.weaponId === "dragon_dagger_p" &&
      saved.data?.form?.perStyleLoadouts?.melee?.prayers?.[0] === "clarity" &&
      saved.data?.form?.perStyleLoadouts?.ranged?.specialAttack?.weaponId === "magic_shortbow" &&
      saved.data?.form?.perStyleLoadouts?.ranged?.specialAttack?.ammoId === "rune_arrow" &&
      saved.data?.form?.perStyleLoadouts?.ranged?.boosts?.[0] === "ranging"
    );
  });
});

test("supports multi-prayer and multi-boost workbench controls with compact primary edits", async ({
  page
}) => {
  await page.goto("/");
  await selectCombatType(page, "melee");

  const compactSetup = page.getByLabel("Combat setup");
  const equipmentPane = page.getByLabel("Equipment loadout");
  const prayerSelections = equipmentPane.getByLabel("Prayer selections");
  const boostSelections = equipmentPane.getByLabel("Boost selections");

  await expect(compactSetup.getByLabel("PRAYER", { exact: true })).toHaveValue("ultimate");
  await expect(compactSetup.getByLabel("BOOST", { exact: true })).toHaveValue("super_att");
  await expect(compactSetup).toContainText("+1");

  await prayerSelections.getByLabel(/steel skin/i).check();
  await expect(prayerSelections.getByLabel(/steel skin/i)).toBeChecked();
  await expect(compactSetup.getByLabel("PRAYER", { exact: true })).toHaveValue("ultimate");
  await expect(compactSetup).toContainText("+2");

  await compactSetup.getByLabel("PRAYER", { exact: true }).selectOption("reflexes");
  await expect(prayerSelections.getByLabel(/reflexes/i)).toBeChecked();
  await expect(prayerSelections.getByLabel(/incredible/i)).not.toBeChecked();
  await expect(prayerSelections.getByLabel(/ultimate/i)).toBeChecked();
  await expect(prayerSelections.getByLabel(/steel skin/i)).toBeChecked();
  await expect(compactSetup.getByLabel("PRAYER", { exact: true })).toHaveValue("reflexes");
  await expect(compactSetup).toContainText("+2");

  await boostSelections.getByLabel(/magic/i).check();
  await compactSetup.getByLabel("BOOST", { exact: true }).selectOption("ranging");
  await expect(boostSelections.getByLabel(/ranging/i)).toBeChecked();
  await expect(boostSelections.getByLabel(/super att/i)).toBeChecked();
  await expect(boostSelections.getByLabel(/super str/i)).toBeChecked();
  await expect(boostSelections.getByLabel(/magic/i)).toBeChecked();
  await expect(compactSetup.getByLabel("BOOST", { exact: true })).toHaveValue("ranging");
  await expect(compactSetup).toContainText("+3");

  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return (
      saved.data?.form?.prayers?.join("|") === "reflexes|ultimate|steel_skin" &&
      saved.data?.form?.boosts?.join("|") === "ranging|super_att|super_str|magic"
    );
  });
});

test("edits combat equipment panes and persists style-specific selections", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const setupContext = page.getByLabel("Setup context");
  const setupDps = setupContext.locator(".metric", { hasText: "DPS" }).locator("strong");

  await selectCombatType(page, "melee");
  const meleePane = page.getByLabel("Equipment loadout");
  const meleeDpsBefore = await setupDps.textContent();
  await chooseSearchableOption(meleePane, "Shield", "Unholy book");
  await chooseSearchableOption(meleePane, "Weapon", "Dragon halberd");
  await expect(searchableCombobox(meleePane, "Shield")).toBeDisabled();
  await expectSearchableSelection(meleePane, "Shield", "none");
  await expect.poll(async () => setupDps.textContent()).not.toBe(meleeDpsBefore);

  await selectCombatType(page, "ranged");
  const rangedPane = page.getByLabel("Equipment loadout");
  await chooseSearchableOption(rangedPane, "Weapon", "Magic shortbow");
  await chooseSearchableOption(rangedPane, "Ammo", "Adamant arrow");

  await selectCombatType(page, "magic");
  const magicPane = page.getByLabel("Equipment loadout");
  await chooseSearchableOption(magicPane, "Spell", "Fire Wave");
  await expect(page.getByLabel("Equipment bonus summary")).toContainText("Magic");

  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return (
      saved.data?.form?.perStyleLoadouts?.melee?.weaponId === "dragon_halberd" &&
      saved.data?.form?.perStyleLoadouts?.melee?.gear?.shield === "none" &&
      saved.data?.form?.perStyleLoadouts?.ranged?.weaponId === "magic_shortbow" &&
      saved.data?.form?.perStyleLoadouts?.ranged?.ammoId === "addy_arrow" &&
      saved.data?.form?.perStyleLoadouts?.magic?.spellId === "fire_wave"
    );
  });

  await page.reload();
  const reloadedTabs = page.getByLabel("Workbench tabs");
  await expect(reloadedTabs).toBeVisible();
  await selectCombatType(page, "melee");
  await expectSearchableSelection(page.getByLabel("Equipment loadout"), "Weapon", "dragon_halberd");
  await expect(searchableCombobox(page.getByLabel("Equipment loadout"), "Shield")).toBeDisabled();
  await selectCombatType(page, "ranged");
  await expectSearchableSelection(page.getByLabel("Equipment loadout"), "Ammo", "addy_arrow");
  await selectCombatType(page, "magic");
  await expectSearchableSelection(page.getByLabel("Equipment loadout"), "Spell", "fire_wave");
});

test("applies gear quick actions for the active combat style", async ({ page }) => {
  await page.goto("/");
  await selectCombatType(page, "melee");
  const meleePane = page.getByLabel("Equipment loadout");
  await meleePane.getByRole("button", { name: "Best Helm" }).click();
  await expectSearchableSelection(meleePane, "Helm", "berserker_helm");
  await meleePane.getByRole("button", { name: "Best Shield" }).click();
  await expectSearchableSelection(meleePane, "Shield", "unholy_book");
  await chooseSearchableOption(meleePane, "Weapon", "Dragon halberd");
  await expect(meleePane.getByRole("button", { name: "Best Shield" })).toBeDisabled();
  await expectSearchableSelection(meleePane, "Shield", "none");

  await selectCombatType(page, "ranged");
  const rangedPane = page.getByLabel("Equipment loadout");
  await rangedPane.getByRole("button", { name: "Best Body" }).click();
  await expectSearchableSelection(rangedPane, "Body", "black_dhide_body");

  await selectCombatType(page, "magic");
  const magicPane = page.getByLabel("Equipment loadout");
  await magicPane.getByRole("button", { name: "Best Cape" }).click();
  await expectSearchableSelection(magicPane, "Cape", "god_cape");

  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return (
      saved.data?.form?.perStyleLoadouts?.melee?.gear?.helm === "berserker_helm" &&
      saved.data?.form?.perStyleLoadouts?.melee?.gear?.shield === "none" &&
      saved.data?.form?.perStyleLoadouts?.ranged?.gear?.body === "black_dhide_body" &&
      saved.data?.form?.perStyleLoadouts?.magic?.gear?.cape === "god_cape"
    );
  });
});

test("optimizes the visible whole loadout and restores it with Undo", async ({ page }) => {
  await page.goto("/");
  await selectCombatType(page, "melee");

  const setup = page.getByLabel("Setup context");
  const monster = searchableCombobox(setup, "Monster");
  const loadout = page.getByLabel("Equipment loadout");
  const weapon = searchableCombobox(loadout, "Weapon");
  const style = loadout.getByLabel("Style", { exact: true });
  const originalMonster = await monster.getAttribute("data-selected-id");
  const originalStyle = await style.inputValue();

  await chooseSearchableOption(loadout, "Weapon", "Iron scimitar");
  await expect(weapon).toHaveAttribute("data-selected-id", "iron_scimitar");

  await loadout.getByRole("button", { name: "Optimize loadout" }).click();
  await expect(weapon).not.toHaveAttribute("data-selected-id", "iron_scimitar");
  await expect(monster).toHaveAttribute("data-selected-id", originalMonster ?? "");
  await expect(style).toHaveValue(originalStyle);

  const undo = page.getByLabel("Local state undo");
  await expect(undo).toContainText("Optimized loadout for Hill Giant");
  await expect(undo).toContainText("normal DPS");
  await undo.getByRole("button", { name: "Undo" }).click();

  await expect(weapon).toHaveAttribute("data-selected-id", "iron_scimitar");
  await expect(monster).toHaveAttribute("data-selected-id", originalMonster ?? "");
  await expect(style).toHaveValue(originalStyle);
  await expect(page.locator(".topbar")).toContainText("Restored loadout for Hill Giant");
});

test("filters hidden gear tiers while keeping current selections", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await selectCombatType(page, "melee");
  const meleePane = page.getByLabel("Equipment loadout");
  await chooseSearchableOption(meleePane, "Body", "Iron platebody");

  await tabs.getByRole("tab", { name: "Settings" }).click();
  const settings = page.locator('[aria-label="Hidden gear tiers"]');
  await expect(settings).toContainText("Gear menu");
  await settings.getByLabel("Hide iron gear").check();
  await expect(settings).toContainText("1 hidden");

  await selectCombatType(page, "melee");
  await expectSearchableSelection(meleePane, "Body", "iron_platebody");
  const helmOptions = await searchableOptionLabels(meleePane, "Helm");
  const bodyOptions = await searchableOptionLabels(meleePane, "Body");
  expect(helmOptions.join("\n")).not.toContain("Iron full helm");
  expect(bodyOptions.join("\n")).toContain("Iron platebody");
  expect(bodyOptions.join("\n")).toContain("None");

  await page.waitForFunction(() => {
    const setup = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    const hidden = window.localStorage.getItem("index-sim:hidden-gear-tiers") ?? "";
    return setup.includes('"body":"iron_platebody"') && hidden.includes('"iron":true');
  });

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  await expect(
    page.locator('[aria-label="Hidden gear tiers"]').getByLabel("Hide iron gear")
  ).toBeChecked();
  await selectCombatType(page, "melee");
  const reloadedMeleePane = page.getByLabel("Equipment loadout");
  await expectSearchableSelection(reloadedMeleePane, "Body", "iron_platebody");
  const reloadedHelmOptions = await searchableOptionLabels(reloadedMeleePane, "Helm");
  expect(reloadedHelmOptions.join("\n")).not.toContain("Iron full helm");
});

test("creates, restores and removes monster-specific custom setups", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  const setupContext = page.getByLabel("Setup context");

  await setupContext.getByRole("button", { name: "Create custom setup" }).click();
  await expect(setupContext).toContainText("Custom setup");

  await selectCombatType(page, "melee");
  const equipmentPane = page.getByLabel("Equipment loadout");
  await chooseSearchableOption(equipmentPane, "Weapon", "Dragon halberd");
  await expectSearchableSelection(equipmentPane, "Weapon", "dragon_halberd");

  await chooseSearchableOption(setupContext, "Monster", "Rock Crab");
  await expect(setupContext).toContainText("Default setup");
  await expectSearchableSelection(equipmentPane, "Weapon", "rune_scimitar");

  await chooseSearchableOption(setupContext, "Monster", "Hill Giant");
  await expect(setupContext).toContainText("Custom setup");
  await expectSearchableSelection(equipmentPane, "Weapon", "dragon_halberd");

  await tabs.getByRole("tab", { name: "Compare" }).click();
  await expect(page.locator('tr[aria-selected="true"]')).toContainText("custom");

  await setupContext.getByRole("button", { name: "Remove custom setup" }).click();
  await expect(setupContext).toContainText("Default setup");
  await selectCombatType(page, "melee");
  await expectSearchableSelection(page.getByLabel("Equipment loadout"), "Weapon", "rune_scimitar");
  const customSetupUndo = page.getByLabel("Local state undo");
  await expect(customSetupUndo).toContainText("Removed custom setup for Hill Giant");
  await customSetupUndo.getByRole("button", { name: "Undo" }).click();
  await expect(setupContext).toContainText("Custom setup");
  await expectSearchableSelection(page.getByLabel("Equipment loadout"), "Weapon", "dragon_halberd");
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return (
      saved.data?.setupMode === "custom" &&
      saved.data?.form?.monsterId === "giant" &&
      saved.data?.customSetupsByMonster?.giant?.weaponId === "dragon_halberd"
    );
  });

  await setupContext.getByRole("button", { name: "Remove custom setup" }).click();
  await expect(setupContext).toContainText("Default setup");
  await expectSearchableSelection(page.getByLabel("Equipment loadout"), "Weapon", "rune_scimitar");
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return (
      saved.data?.setupMode === "default" &&
      saved.data?.form?.monsterId === "giant" &&
      !saved.data?.customSetupsByMonster?.giant
    );
  });
});

test("selects special attacks and shows special metrics", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await selectCombatType(page, "melee");
  const special = page.getByRole("region", { name: "Special attack", exact: true });

  await expect(special).toBeVisible();
  await special.getByLabel("Spec weapon").selectOption("dragon_halberd");
  await expect(page.locator('[aria-label="Special attack metrics"]')).toContainText("Spec max hit");
  await expect(page.locator('[aria-label="Special attack metrics"]')).toContainText("x2");
  await expect(page.locator('[aria-label="Special attack metrics"]')).not.toContainText(
    "NPC size data is not modeled"
  );
  await page.getByLabel("TARGET", { exact: true }).selectOption("rock_crab");
  await expect(page.locator('[aria-label="Special attack metrics"]')).not.toContainText("x2");

  await special.getByLabel("Spec weapon").selectOption("dragon_dagger_p");

  await expect(page.locator('[aria-label="Special attack metrics"]')).toContainText("Spec max hit");
  await expect(page.locator('[aria-label="Special attack metrics"]')).toContainText("DPS gain");
  await expect(page.locator('[aria-label="Special attack metrics"]')).not.toContainText(
    "NPC size data is not modeled"
  );
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"weaponId":"dragon_dagger_p"');
  });
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Stats" }).click();
  const statsSourceDetails = page
    .getByRole("region", { name: "Source breakdown", exact: true })
    .getByRole("list", { name: "Source detail panels" });
  const specialDetail = statsSourceDetails.getByRole("listitem", {
    name: /Special attack detail: modeled/i
  });
  await expect(specialDetail).toContainText("Spec weapon");
  await expect(specialDetail).toContainText("Dragon dagger(p)");
  await expect(specialDetail).toContainText("Hits");
  await expect(specialDetail).toContainText("Max hit");
  await expect(specialDetail).toContainText("Hit chance");
  await expect(specialDetail).toContainText("Specs/hr");
  await expect(specialDetail).toContainText("DPS with spec");
  await expect(specialDetail).toContainText("DPS gain");
  await expect(specialDetail).toContainText("Special attack XP is included in player combat XP/hr");
  const specialDistribution = specialDetail.getByRole("region", {
    name: "Special attack damage distribution"
  });
  await expect(specialDistribution).toContainText("Per special hit");
  await expect(specialDistribution).toContainText("Average hit");
  await expect(
    specialDistribution.getByRole("list", { name: "Special attack damage distribution buckets" })
  ).not.toBeEmpty();
  await expect(
    page
      .getByRole("region", { name: "Source breakdown", exact: true })
      .getByRole("listitem", { name: /Special attack: modeled/i })
  ).toContainText("DPS gain");
  await selectCombatType(page, "melee");

  await selectCombatType(page, "ranged");
  await special.getByLabel("Spec weapon").selectOption("magic_shortbow");
  await expect(special.getByLabel("Spec ammo")).toBeVisible();
  await special.getByLabel("Spec ammo").selectOption("rune_arrow");
  await expect(page.locator('[aria-label="Special attack metrics"]')).toContainText("Specs/hr");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"weaponId":"magic_shortbow"') && saved.includes('"ammoId":"rune_arrow"');
  });

  await selectCombatType(page, "magic");
  await expect(special.getByLabel("Spec weapon")).toBeDisabled();
  await expect(special.getByLabel("Spec weapon")).toHaveValue("none");
  await expect(special).toContainText("unsupported");
  await expect(special).toContainText("Magic special attacks are not modeled yet.");
  await expect(page.locator('[aria-label="Special attack metrics"]')).toHaveCount(0);
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Stats" }).click();
  const magicSpecialNote = "Magic DPS special attacks are not modeled yet.";
  const magicSpecialBreakdown = page
    .getByRole("region", { name: "Source breakdown", exact: true })
    .getByRole("listitem", { name: /Special attack: not modeled/i });
  await expect(magicSpecialBreakdown).toBeVisible();
  await expect(magicSpecialBreakdown.getByText(magicSpecialNote, { exact: true })).toBeVisible();
  const magicSpecialDetail = page
    .getByRole("region", { name: "Source breakdown", exact: true })
    .getByRole("list", { name: "Source detail panels" })
    .getByRole("listitem", { name: /Special attack detail: not modeled/i });
  await expect(magicSpecialDetail).toBeVisible();
  await expect(magicSpecialDetail.getByText(magicSpecialNote, { exact: true })).toBeVisible();
  await selectCombatType(page, "melee");

  await selectCombatType(page, "melee");
  const boostSelectId = await page
    .locator('section[aria-label="Equipment loadout"] .field > label', { hasText: /^Boost$/ })
    .getAttribute("for");
  if (!boostSelectId) throw new Error("Missing visible Boost select");
  await page.locator(`[id="${boostSelectId}"]`).selectOption("dba_spec");
  await expect(special.getByLabel("Spec weapon")).toBeDisabled();
  await expect(special.getByLabel("Spec weapon")).toHaveValue("none");
  await expect(special).toContainText("DBA boost");
  await expect(special).toContainText("DBA boost uses spec energy as a boost");
  await expect(page.locator('[aria-label="Special attack metrics"]')).toHaveCount(0);
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Stats" }).click();
  await expect(
    page
      .getByRole("region", { name: "Source breakdown", exact: true })
      .getByRole("list", { name: "Source detail panels" })
      .getByRole("listitem", { name: /Special attack detail: inactive/i })
  ).toContainText("DBA special boost is modeled as a boost");
});

test("sorts the full monster table and selects a target row", async ({ page }) => {
  await page.goto("/");
  const table = page.getByRole("table", { name: "All monsters" });

  await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);
  await table.getByRole("button", { name: /Monster/ }).click();
  await expect(table.locator("tbody tr td:first-child").first()).toContainText("Al-Kharid warrior");

  const names = (await table.locator("tbody tr td:first-child").allTextContents()).map((name) =>
    name
      .replace(/^>\s*/, "")
      .replace(/\s*(custom|hidden|target)\s*/gi, " ")
      .replace(/\s*(Hide|Restore)\s*$/i, "")
      .replace(/\s+lvl\s+\d+$/, "")
      .trim()
  );
  expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));

  const rockCrabRow = table.getByRole("row", { name: /Rock Crab/ });
  await rockCrabRow.click();
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("rock_crab");
  await expect(rockCrabRow.locator("td").first()).toContainText(">");
});

test("shows dense compare calculation freshness while rows catch up", async ({ page }) => {
  await page.goto("/");
  const comparePanel = page.getByLabel("Monster comparison");
  const table = page.getByRole("table", { name: "All monsters" });
  const freshness = comparePanel.getByRole("status", {
    name: /Compare calculation status/i
  });

  await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);
  await expect(freshness).toHaveText("Current");
  await expect(comparePanel).toContainText("current loadout");

  await page.clock.install();
  await page.getByLabel("Combat setup").getByLabel("DEF", { exact: true }).fill("7");
  await expect(freshness).toHaveText("Updating");

  const rockCrabRow = table.getByRole("row", { name: /Rock Crab/ });
  await rockCrabRow.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("rock_crab");
  await expect(rockCrabRow.locator("td").first()).toContainText(">");

  await page.clock.fastForward(300);
  await expect(freshness).toHaveText("Current");
  await expect(comparePanel).toContainText("current loadout");
});

test("filters dense compare rows and persists hidden monsters", async ({ page }) => {
  await page.goto("/");
  const table = page.getByRole("table", { name: "All monsters" });

  await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);
  await expect(page.getByText(new RegExp("\\d+ / \\d+ monsters"))).toBeVisible();

  await page.getByLabel("Monster filter").fill("rock crab");
  await expect(table).toContainText("Rock Crab");
  await expect(table).toContainText("Giant");
  await expect(table.locator("tbody tr")).toHaveCount(2);

  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);

  const unfilteredCount = await table.locator("tbody tr").count();
  await page.getByLabel("Monster comparison").getByLabel("Drop filter").fill("big_bones");
  await expect(table).toContainText("Giant");
  await expect.poll(async () => table.locator("tbody tr").count()).toBeLessThan(unfilteredCount);
  await page.getByRole("button", { name: "Reset filters" }).click();

  await table.getByRole("button", { name: "Mark Rock Crab irrelevant" }).click();
  await expect(table).not.toContainText("Rock Crab");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes("rock_crab");
  });

  await page.reload();
  await expect(table).not.toContainText("Rock Crab");
  await page.getByLabel("Show hidden / irrelevant").check();
  await expect(table).toContainText("Rock Crab");
  await table.getByRole("button", { name: "Mark Rock Crab relevant" }).click();
  await expect(table.getByRole("button", { name: "Mark Rock Crab irrelevant" })).toBeVisible();
});

test("shows dense XP and net GP scale indicators for visible rows", async ({ page }) => {
  await page.goto("/");
  const table = page.getByRole("table", { name: "All monsters" });

  await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);
  const firstRow = table.locator("tbody tr").first();
  const xpCell = firstRow.locator("td").nth(6);
  const netGpCell = firstRow.locator("td").nth(9);

  await expect(xpCell.locator(".dense-scale-number")).toHaveText(/\S/);
  await expect(xpCell.locator(".dense-scale-track")).toBeVisible();
  await expect(xpCell.locator(".dense-scale-cell")).toHaveAttribute(
    "aria-label",
    /XP\/hr .*scaled to visible rows/
  );
  await expect(netGpCell.locator(".dense-scale-number")).toHaveText(/\S/);
  await expect(netGpCell.locator(".dense-scale-track")).toBeVisible();
  await expect(netGpCell.locator(".dense-scale-cell")).toHaveAttribute(
    "aria-label",
    /net GP\/hr .*scaled to visible rows/
  );
  await expect(xpCell.locator(".dense-scale-track span")).toHaveAttribute("style", /width: \d/);

  await page.getByLabel("Monster filter").fill("rock crab");
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table.locator("tbody tr td:nth-child(7) .dense-scale-cell")).toHaveCount(2);
  await expect(table.locator("tbody tr td:nth-child(10) .dense-scale-cell")).toHaveCount(2);
});

test("shows dense row markers for custom setup and per-monster loot settings", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  const setupContext = page.getByLabel("Setup context");

  await setupContext.getByRole("button", { name: "Create custom setup" }).click();
  await selectCombatType(page, "melee");
  const equipmentPane = page.getByLabel("Equipment loadout");
  await chooseSearchableOption(equipmentPane, "Weapon", "Dragon halberd");
  await chooseSearchableOption(setupContext, "Monster", "Green Dragon");
  await tabs.getByRole("tab", { name: "Loot" }).click();

  const loot = page.locator('section[aria-label="Current monster loot"]');
  await loot.getByLabel("High alch").selectOption("disabled");
  await loot.getByLabel("Overhead", { exact: true }).selectOption("manual");
  await loot.getByLabel("Overhead sec").fill("12.5");

  await tabs.getByRole("tab", { name: "Compare" }).click();
  const table = page.getByRole("table", { name: "All monsters" });
  const giantRow = table.getByRole("row", { name: /Hill Giant/ });
  const greenDragonRow = table.getByRole("row", { name: /Green Dragon/ });

  await expect(giantRow.getByLabel("Custom setup for Hill Giant")).toBeVisible();
  await expect(greenDragonRow.getByLabel("High alch override for Green Dragon")).toBeVisible();
  await expect(greenDragonRow.getByLabel("Kill overhead override for Green Dragon")).toBeVisible();
});

test("matches browser-rendered result metrics for every golden fixture setup", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.addInitScript(() => {
    const pending = window.sessionStorage.getItem("index-sim:e2e-fixture-storage");
    if (!pending) return;
    const entries = JSON.parse(pending) as Record<string, string>;
    window.localStorage.clear();
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, value);
    }
    window.sessionStorage.removeItem("index-sim:e2e-fixture-storage");
  });

  for (const definition of LEGACY_GOLDEN_CASES) {
    const fixture = createRewriteFixtureCase(definition, GENERATED_BROWSER_FIXTURE_CONTEXT);
    const expectedVm = createSimulationViewModel(
      fixture.form,
      GENERATED_BROWSER_FIXTURE_CONTEXT,
      fixture.cannonByMonster,
      fixture.lootPrefsByMonster[fixture.form.monsterId] ?? {},
      fixture.lootSettingsByMonster,
      { includeLootRows: false }
    );
    const storageState = {
      [REWRITE_SETUP_STORAGE_KEY]: JSON.stringify(
        fixtureStorageEnvelope(
          REWRITE_SETUP_VERSION,
          savedSetupFromForm(fixture.form, undefined, fixture.cannonByMonster)
        )
      ),
      [LOOT_PREFS_STORAGE_KEY]: JSON.stringify(
        fixtureStorageEnvelope(LOOT_PREFS_VERSION, fixture.lootPrefsByMonster)
      ),
      [LOOT_SETTINGS_STORAGE_KEY]: JSON.stringify(
        fixtureStorageEnvelope(LOOT_SETTINGS_VERSION, fixture.lootSettingsByMonster)
      )
    };

    await page.evaluate((entries) => {
      window.sessionStorage.setItem("index-sim:e2e-fixture-storage", JSON.stringify(entries));
    }, storageState);
    await page.reload();

    const resultStrip = page.getByLabel("Simulation results");
    await expect(resultStrip, definition.id).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("TYPE", { exact: true }), definition.id).toHaveText(
      fixture.form.combatStyle
    );
    await expect(page.getByLabel("TARGET", { exact: true }), definition.id).toHaveValue(
      fixture.form.monsterId
    );
    expect(await metricSnapshot(resultStrip, ALL_FIXTURE_NUMERIC_LABELS), definition.id).toEqual(
      allFixtureExpectedMetrics(expectedVm)
    );
  }
});

test("matches browser-rendered dense numeric snapshots", async ({ page }) => {
  await page.goto("/");
  const table = page.getByRole("table", { name: "All monsters" });
  await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);

  const defaultMelee = await denseNumericSnapshot(table, /Giant lvl 28/);
  const defaultMeleeResults = await resultMetricSnapshot(page);

  await selectCombatType(page, "ranged");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("ranged");
  await page.getByLabel("TARGET", { exact: true }).selectOption("greater_demon");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("greater_demon");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Compare" }).click();
  await expectDenseRowMax(table, /Greater Demon/, "10.0");
  const rangedSafespot = await denseNumericSnapshot(table, /Greater Demon/);
  const rangedSafespotResults = await resultMetricSnapshot(page);

  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Cannon" }).click();
  const cannon = page.locator('section[aria-label="Cannon"]');
  await cannon.getByLabel("Set up cannon").check();
  await cannon.getByLabel("Mobs at spot").fill("6");
  await cannon.getByLabel("Respawn").fill("30");
  const cannonOutput = await metricSnapshot(
    page.locator('[aria-label="Cannon output"]'),
    CANNON_NUMERIC_LABELS
  );
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Compare" }).click();
  await expect(
    table
      .getByRole("row", { name: /Dagannoth \(lvl 74\)/ })
      .locator("td")
      .nth(3)
  ).toHaveText("2.24");
  await expect(
    table
      .getByRole("row", { name: /Dagannoth \(lvl 74\)/ })
      .locator("td")
      .nth(5)
  ).toHaveText("326");
  const cannonRanged = await denseNumericSnapshot(table, /Dagannoth \(lvl 74\)/);
  const cannonRangedResults = await resultMetricSnapshot(page);

  expect({
    defaultMelee,
    defaultMeleeResults,
    rangedSafespot,
    rangedSafespotResults,
    cannonRanged,
    cannonRangedResults,
    cannonOutput
  }).toEqual({
    defaultMelee: {
      hit: "88.9%",
      max: "16.4",
      dps: "3.05",
      ttk: "12.8s",
      killsPerHour: "235",
      xpPerHour: "21,573",
      gpPerKill: "524",
      gpPerHour: "123,059",
      netGpPerHour: "-80,579"
    },
    defaultMeleeResults: {
      DPS: "3.05",
      "MAX HIT": "16.4",
      "HIT %": "88.9%",
      "XP/HR": "21,573",
      "GP/HR NET": "-80,579",
      "KILLS/HR": "235",
      "GP/KILL": "524",
      "SUPPLY/KILL": "1,047"
    },
    rangedSafespot: {
      hit: "70.6%",
      max: "10.0",
      dps: "1.96",
      ttk: "45.6s",
      killsPerHour: "73",
      xpPerHour: "14,525",
      gpPerKill: "630",
      gpPerHour: "46,191",
      netGpPerHour: "-183,475"
    },
    rangedSafespotResults: {
      DPS: "1.96",
      "MAX HIT": "10.0",
      "HIT %": "70.6%",
      "XP/HR": "14,525",
      "GP/HR NET": "-183,475",
      "KILLS/HR": "73",
      "GP/KILL": "630",
      "SUPPLY/KILL": "5,026"
    },
    cannonRanged: {
      hit: "80.7%",
      max: "10.0",
      dps: "2.24",
      ttk: "8.5s",
      killsPerHour: "326",
      xpPerHour: "37,421",
      gpPerKill: "65",
      gpPerHour: "21,266",
      netGpPerHour: "-481,907"
    },
    cannonRangedResults: {
      DPS: "2.24",
      "MAX HIT": "10.0",
      "HIT %": "80.7%",
      "XP/HR": "37,421",
      "GP/HR NET": "-481,907",
      "KILLS/HR": "326",
      "GP/KILL": "65",
      "SUPPLY/KILL": "2,828"
    },
    cannonOutput: {
      "Effective targets": "2.5",
      "Cannon DPS": "6.26",
      "Balls/hr": "1,861",
      "Balls/kill": "4.41",
      "Cannon Ranged XP/hr": "45,075",
      "Effective XP/hr": "37,421",
      "Effective net GP/hr": "-481,907",
      "Ball cost/hr": "744,459",
      "Ball cost/kill": "1,763",
      "Ball price": "400",
      "Cannonballs/trip": "69",
      "Ball gp/trip": "27,512",
      "K/hr uplift": "215.9%"
    }
  });
});

test("matches release-path dense numeric snapshots", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  const table = page.getByRole("table", { name: "All monsters" });
  await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);

  const meleeBaseline = await denseNumericSnapshot(table, /Giant lvl 28/);
  const meleeBaselineResults = await resultMetricSnapshot(page);
  await expectActiveDenseRow(table, /Giant lvl 28/);

  await page.getByLabel("TARGET", { exact: true }).selectOption("chaos_dwarf");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("chaos_dwarf");
  const meleeAlchRelevant = await denseNumericSnapshot(table, /Chaos Dwarf/);
  const meleeAlchRelevantResults = await resultMetricSnapshot(page);
  await expectActiveDenseRow(table, /Chaos Dwarf/);

  await selectCombatType(page, "ranged");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("ranged");
  await page.getByLabel("TARGET", { exact: true }).selectOption("greater_demon");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("greater_demon");
  await tabs.getByRole("tab", { name: "Compare" }).click();
  await expectDenseRowMax(table, /Greater Demon/, "10.0");
  const rangedSafespot = await denseNumericSnapshot(table, /Greater Demon/);
  const rangedSafespotResults = await resultMetricSnapshot(page);
  await expectActiveDenseRow(table, /Greater Demon/);

  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await tabs.getByRole("tab", { name: "Cannon" }).click();
  const cannon = page.locator('section[aria-label="Cannon"]');
  await cannon.getByLabel("Set up cannon").check();
  await cannon.getByLabel("Mobs at spot").fill("6");
  await cannon.getByLabel("Respawn").fill("30");
  await tabs.getByRole("tab", { name: "Compare" }).click();
  await expect(
    table
      .getByRole("row", { name: /Dagannoth \(lvl 74\)/ })
      .locator("td")
      .nth(5)
  ).toHaveText("326");
  const rangedCannon = await denseNumericSnapshot(table, /Dagannoth \(lvl 74\)/);
  const rangedCannonResults = await resultMetricSnapshot(page);
  await expectActiveDenseRow(table, /Dagannoth \(lvl 74\)/);
  expect(rangedCannon.netGpPerHour).toMatch(/^-/);

  await selectCombatType(page, "magic");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("magic");
  await selectCombatType(page, "magic");
  const magicPane = page.getByLabel("Equipment loadout");
  await chooseSearchableOption(magicPane, "Spell", "Fire Wave");
  await page.getByLabel("TARGET", { exact: true }).selectOption("blue_dragon");
  await tabs.getByRole("tab", { name: "Compare" }).click();
  await expect(
    table
      .getByRole("row", { name: /Blue Dragon/ })
      .locator("td")
      .nth(2)
  ).toHaveText("20.0");
  const magicSafespot = await denseNumericSnapshot(table, /Blue Dragon/);
  const magicSafespotResults = await resultMetricSnapshot(page);
  await expectActiveDenseRow(table, /Blue Dragon/);

  await page.getByLabel("TARGET", { exact: true }).selectOption("green_dragon");
  const setupContext = page.getByLabel("Setup context");
  await setupContext.getByRole("button", { name: "Create custom setup" }).click();
  await selectCombatType(page, "melee");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("melee");
  const meleePane = page.getByLabel("Equipment loadout");
  await chooseSearchableOption(meleePane, "Weapon", "Dragon halberd");
  await tabs.getByRole("tab", { name: "Loot" }).click();
  const loot = page.locator('section[aria-label="Current monster loot"]');
  await loot.getByLabel("High alch").selectOption("disabled");
  await loot.getByLabel("Overhead", { exact: true }).selectOption("manual");
  await loot.getByLabel("Overhead sec").fill("12.5");
  await tabs.getByRole("tab", { name: "Compare" }).click();
  const customLootRow = table.getByRole("row", { name: /Green Dragon/ });
  await expect(customLootRow.getByLabel("Custom setup for Green Dragon")).toBeVisible();
  await expect(customLootRow.getByLabel("High alch override for Green Dragon")).toBeVisible();
  await expect(customLootRow.getByLabel("Kill overhead override for Green Dragon")).toBeVisible();
  await expect(customLootRow.locator("td").nth(2)).toHaveText("22.9");
  const customLootSettings = await denseNumericSnapshot(table, /Green Dragon/);
  const customLootSettingsResults = await resultMetricSnapshot(page);
  await expectActiveDenseRow(table, /Green Dragon/);

  await table.getByRole("button", { name: "NET GP/HR" }).click();
  await page.getByLabel("Monster filter").fill("rock crab");
  const forcedTargetRow = table.getByRole("row", { name: /Green Dragon/ });
  await expect(forcedTargetRow).toBeVisible();
  await expect(
    forcedTargetRow.getByLabel("Current target kept visible for Green Dragon")
  ).toBeVisible();
  await expect(forcedTargetRow.locator("td").first()).toContainText(">");
  await expect(table.getByRole("row", { name: /Rock Crab/ })).toBeVisible();

  const releaseSnapshots = {
    meleeBaseline,
    meleeBaselineResults,
    meleeAlchRelevant,
    meleeAlchRelevantResults,
    rangedSafespot,
    rangedSafespotResults,
    rangedCannon,
    rangedCannonResults,
    magicSafespot,
    magicSafespotResults,
    customLootSettings,
    customLootSettingsResults
  };

  expect(releaseSnapshots).toEqual({
    meleeBaseline: {
      hit: "88.9%",
      max: "16.4",
      dps: "3.05",
      ttk: "12.8s",
      killsPerHour: "235",
      xpPerHour: "21,573",
      gpPerKill: "524",
      gpPerHour: "123,059",
      netGpPerHour: "-80,579"
    },
    meleeBaselineResults: {
      DPS: "3.05",
      "MAX HIT": "16.4",
      "HIT %": "88.9%",
      "XP/HR": "21,573",
      "GP/HR NET": "-80,579",
      "KILLS/HR": "235",
      "GP/KILL": "524",
      "SUPPLY/KILL": "1,047"
    },
    meleeAlchRelevant: {
      hit: "82.1%",
      max: "16.4",
      dps: "2.81",
      ttk: "23.2s",
      killsPerHour: "140",
      xpPerHour: "18,290",
      gpPerKill: "481",
      gpPerHour: "67,465",
      netGpPerHour: "-98,190"
    },
    meleeAlchRelevantResults: {
      DPS: "2.81",
      "MAX HIT": "16.4",
      "HIT %": "82.1%",
      "XP/HR": "18,290",
      "GP/HR NET": "-98,190",
      "KILLS/HR": "140",
      "GP/KILL": "481",
      "SUPPLY/KILL": "1,791"
    },
    rangedSafespot: {
      hit: "70.6%",
      max: "10.0",
      dps: "1.96",
      ttk: "45.6s",
      killsPerHour: "73",
      xpPerHour: "14,525",
      gpPerKill: "630",
      gpPerHour: "46,191",
      netGpPerHour: "-183,475"
    },
    rangedSafespotResults: {
      DPS: "1.96",
      "MAX HIT": "10.0",
      "HIT %": "70.6%",
      "XP/HR": "14,525",
      "GP/HR NET": "-183,475",
      "KILLS/HR": "73",
      "GP/KILL": "630",
      "SUPPLY/KILL": "5,026"
    },
    rangedCannon: {
      hit: "80.7%",
      max: "10.0",
      dps: "2.24",
      ttk: "8.5s",
      killsPerHour: "326",
      xpPerHour: "37,421",
      gpPerKill: "65",
      gpPerHour: "21,266",
      netGpPerHour: "-481,907"
    },
    rangedCannonResults: {
      DPS: "2.24",
      "MAX HIT": "10.0",
      "HIT %": "80.7%",
      "XP/HR": "37,421",
      "GP/HR NET": "-481,907",
      "KILLS/HR": "326",
      "GP/KILL": "65",
      "SUPPLY/KILL": "2,828"
    },
    magicSafespot: {
      hit: "35.7%",
      max: "20.0",
      dps: "1.19",
      ttk: "1:33",
      killsPerHour: "37",
      xpPerHour: "21,210",
      gpPerKill: "6,604",
      gpPerHour: "246,236",
      netGpPerHour: "-420,342"
    },
    magicSafespotResults: {
      DPS: "1.19",
      "MAX HIT": "20.0",
      "HIT %": "35.7%",
      "XP/HR": "21,210",
      "GP/HR NET": "-420,342",
      "KILLS/HR": "37",
      "GP/KILL": "6,604",
      "SUPPLY/KILL": "35,568"
    },
    customLootSettings: {
      hit: "72.4%",
      max: "22.9",
      dps: "1.97",
      ttk: "40.9s",
      killsPerHour: "67",
      xpPerHour: "8,443",
      gpPerKill: "6,094",
      gpPerHour: "410,755",
      netGpPerHour: "69,227"
    },
    customLootSettingsResults: {
      DPS: "1.97",
      "MAX HIT": "22.9",
      "HIT %": "72.4%",
      "XP/HR": "8,443",
      "GP/HR NET": "69,227",
      "KILLS/HR": "67",
      "GP/KILL": "6,094",
      "SUPPLY/KILL": "3,634"
    }
  });
});

test("enables cannon for the selected monster and shows cannon rates", async ({ page }) => {
  await page.goto("/");
  await selectCombatType(page, "ranged");
  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Cannon" }).click();

  const cannon = page.locator('section[aria-label="Cannon"]');
  await expect(cannon).toBeVisible();
  await expect(cannon.getByText("off", { exact: true })).toBeVisible();

  await cannon.getByLabel("Set up cannon").check();
  await cannon.getByLabel("Mobs at spot").fill("6");
  await cannon.getByLabel("Respawn").fill("30");
  await cannon.getByLabel("Link Trip sparse").check();

  const output = page.locator('[aria-label="Cannon output"]');
  await expect(output).toContainText("Balls/hr");
  await expect(output).toContainText("Cannon Ranged XP/hr");
  await expect(output).toContainText("Effective XP/hr");
  await expect(output).toContainText("Effective net GP/hr");
  await expect(output).toContainText("Ball cost/hr");
  await expect(output).toContainText("Accuracy rule");
  await expect(output).toContainText("XP rule");
  await expect(output).toContainText("Supply impact");
  await expect(output).toContainText("Sparse link");
  await expect(output).toContainText("Linked");
  await expect(output).toContainText("Inventory reserve");
  await expect(cannon.getByLabel("Cannon sparse status")).toContainText(/Trip sparse|Respawn/);
  await expect(cannon.getByText("active")).toBeVisible();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Compare" }).click();
  await expect(page.getByLabel("Simulation results")).toContainText("SUPPLY/KILL");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Stats" }).click();
  const cannonDetail = page
    .getByRole("list", { name: "Source detail panels" })
    .getByRole("listitem", { name: /Cannon detail: modeled/i });
  const cannonDistribution = cannonDetail.getByRole("region", {
    name: "Cannon damage distribution"
  });
  await expect(cannonDistribution).toContainText("Per fired cannonball");
  await expect(cannonDistribution).toContainText("Max hit");
  await expect(
    cannonDistribution.getByRole("list", { name: "Cannon damage distribution buckets" })
  ).not.toBeEmpty();
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"dagannoth"') &&
      saved.includes('"targets":6') &&
      saved.includes('"respawnSec":30') &&
      saved.includes('"scarceSpot":true') &&
      saved.includes('"targetsAtSpot":6') &&
      saved.includes('"respawnSeconds":30')
    );
  });

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Cannon" }).click();
  const reloadedCannon = page.locator('section[aria-label="Cannon"]');
  await expectSearchableSelection(page.getByLabel("Setup context"), "Monster", "dagannoth");
  await expect(reloadedCannon.getByLabel("Set up cannon")).toBeChecked();
  await expect(reloadedCannon.getByLabel("Mobs at spot")).toHaveValue("6");
  await expect(reloadedCannon.getByLabel("Respawn")).toHaveValue("30");
  await expect(reloadedCannon.getByLabel("Link Trip sparse")).toBeChecked();
  await expect(page.locator('[aria-label="Cannon output"]')).toContainText("Linked");
  await reloadedCannon.getByRole("button", { name: "Reset monster cannon" }).click();
  await expect(reloadedCannon.getByLabel("Set up cannon")).not.toBeChecked();
  await expect(reloadedCannon.getByLabel("Link Trip sparse")).toBeDisabled();
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return !saved.includes('"dagannoth":{"enabled":true');
  });
});

test("updates trip survival controls and keeps the trip summary visible", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const summary = page.locator('[aria-label="Trip summary"]');

  await expect(trip).toBeVisible();
  await expect(summary).toContainText("Safespot");
  await expect(summary).toContainText("HP/kill");

  await trip.getByLabel("Safespot").selectOption("off");
  await trip.getByLabel("Protect").selectOption("melee");
  await trip.getByLabel("Antifire").check();
  await trip.getByLabel("Antipoison").check();
  await trip.getByLabel("Scarce spot").check();
  await trip.getByLabel("Targets at spot").fill("2");
  await trip.getByLabel("Respawn sec").fill("90");

  await expect(summary).toContainText("Off");
  await expect(summary).toContainText("Melee");
  await expect(summary).toContainText("Protection prayer");
  await expect(summary).toContainText("Antifire");
  await expect(summary).toContainText("Antipoison");
  await expect(summary).toContainText("Scarce status");
  await expect(summary).toContainText("Reserve parts");
  await expect(summary).toContainText("Potion parts");
  await expect(summary).toContainText("Effective K/hr");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"safespot":false') &&
      saved.includes('"protect":"melee"') &&
      saved.includes('"antifire":true') &&
      saved.includes('"antipoison":true') &&
      saved.includes('"scarceSpot":true') &&
      saved.includes('"targetsAtSpot":2') &&
      saved.includes('"respawnSeconds":90')
    );
  });

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();
  const reloadedTrip = page.locator('section[aria-label="Trip assumptions"]');
  await expect(reloadedTrip.getByLabel("Safespot")).toHaveValue("off");
  await expect(reloadedTrip.getByLabel("Protect")).toHaveValue("melee");
  await expect(reloadedTrip.getByLabel("Antifire")).toBeChecked();
  await expect(reloadedTrip.getByLabel("Antipoison")).toBeChecked();
  await expect(reloadedTrip.getByLabel("Scarce spot")).toBeChecked();
  await expect(reloadedTrip.getByLabel("Targets at spot")).toHaveValue("2");
  await expect(reloadedTrip.getByLabel("Respawn sec")).toHaveValue("90");
  await expect(page.locator('[aria-label="Trip summary"]')).toBeVisible();
});

test("updates manual food controls and recoil ring count", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.localStorage.getItem("index-sim:rewrite-setup"));
  await page.evaluate(() => {
    const key = "index-sim:rewrite-setup";
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error("Missing rewrite setup");
    const setup = JSON.parse(raw);
    setup.data.form.monsterId = "firegiant";
    setup.data.form.gear.ring = "ring_of_recoil";
    setup.data.form.trip.safespot = false;
    setup.data.form.trip.protect = "none";
    setup.data.form.trip.recoilRings = 3;
    window.localStorage.setItem(key, JSON.stringify(setup));
  });
  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const summary = page.locator('[aria-label="Trip summary"]');
  await expectSearchableSelection(page.getByLabel("Setup context"), "Monster", "firegiant");
  await expect(trip.getByLabel("Recoil rings")).toBeEnabled();

  await trip.getByLabel("Food mode").selectOption("manual");
  await trip.getByLabel("Food count").fill("4");
  await trip.getByLabel("F/KL override").selectOption("on");
  await trip.getByLabel("Food/kill").fill("0.5");
  await trip.getByLabel("Recoil rings").fill("6");

  await expect(summary).toContainText("Food count");
  await expect(summary).toContainText("Manual 4");
  await expect(summary).toContainText("Auto estimate");
  await expect(summary).toContainText("Food left");
  await expect(summary).toContainText("Recoil/kill");
  await expect(summary).toContainText("Recoil gp/kill");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"foodCount":4') &&
      saved.includes('"foodPerKillOverride":0.5') &&
      saved.includes('"recoilRings":6') &&
      saved.includes('"ring":"ring_of_recoil"')
    );
  });

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();
  const reloadedTrip = page.locator('section[aria-label="Trip assumptions"]');
  await expect(reloadedTrip.getByLabel("Food mode")).toHaveValue("manual");
  await expect(reloadedTrip.getByLabel("Food count")).toHaveValue("4");
  await expect(reloadedTrip.getByLabel("F/KL override")).toHaveValue("on");
  await expect(reloadedTrip.getByLabel("Food/kill")).toHaveValue("0.5");
  await expect(reloadedTrip.getByLabel("Recoil rings")).toHaveValue("6");
});

test("updates trip food, banking and inventory reserve controls across styles", async ({
  page
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await tabs.getByRole("tab", { name: "Trip" }).click();
  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const summary = page.locator('[aria-label="Trip summary"]');

  await expectSearchableSelection(trip, "Food", "lobster");
  await expect(trip.getByLabel("Bank time")).toHaveValue("auto");
  await expect(trip.getByLabel("Bank sec")).toBeDisabled();
  await expect(trip.getByLabel("Recover ammo")).toBeDisabled();
  await expect(trip.getByLabel("DBA restore")).toBeHidden();
  await expect(trip.getByLabel("Rune slots")).toBeDisabled();
  await expect(summary).toContainText("Auto 90s");
  await expect(summary).toContainText("Food count");
  await expect(summary).toContainText(/Auto [0-9]+/);
  await expect(summary).toContainText("Loot capacity");
  await expect(summary).toContainText("Effective K/hr");

  await chooseSearchableOption(trip, "Food", "Swordfish");
  await trip.getByLabel("Bank time").selectOption("manual");
  await expect(trip.getByLabel("Bank sec")).toBeEnabled();
  await trip.getByLabel("Bank sec").fill("120");
  await trip.getByLabel("Teleport item").uncheck();

  await expect(summary).toContainText("Swordfish");
  await expect(summary).toContainText("Manual 120s");
  await expect(summary).toContainText("Teleport");
  await expect(summary).toContainText("Off");

  await selectCombatType(page, "ranged");
  await tabs.getByRole("tab", { name: "Trip" }).click();
  await expect(trip.getByLabel("Recover ammo")).toBeEnabled();
  await trip.getByLabel("Recover ammo").uncheck();
  await expect(summary).toContainText("Ammo recovery");

  await selectCombatType(page, "melee");
  await page.getByLabel("Boost", { exact: true }).selectOption("dba_spec");
  await tabs.getByRole("tab", { name: "Trip" }).click();
  await expect(trip.getByLabel("DBA restore")).toBeEnabled();
  await trip.getByLabel("DBA restore").uncheck();
  await expect(summary).toContainText("DBA restore");

  await selectCombatType(page, "magic");
  await tabs.getByRole("tab", { name: "Trip" }).click();
  await expect(trip.getByLabel("Rune slots")).toBeEnabled();
  await trip.getByLabel("Rune slots").fill("4");
  await expect(summary).toContainText("Rune slots");

  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"foodKey":"swordfish"') &&
      saved.includes('"bankSeconds":120') &&
      saved.includes('"teleport":false') &&
      saved.includes('"recoverAmmo":false') &&
      saved.includes('"dbaRestore":false') &&
      saved.includes('"runeSlots":4')
    );
  });

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();
  const reloadedTrip = page.locator('section[aria-label="Trip assumptions"]');
  await expectSearchableSelection(reloadedTrip, "Food", "swordfish");
  await expect(reloadedTrip.getByLabel("Bank time")).toHaveValue("manual");
  await expect(reloadedTrip.getByLabel("Bank sec")).toHaveValue("120");
  await expect(reloadedTrip.getByLabel("Teleport item")).not.toBeChecked();

  await selectCombatType(page, "ranged");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();
  await expect(reloadedTrip.getByLabel("Recover ammo")).toBeEnabled();
  await expect(reloadedTrip.getByLabel("Recover ammo")).not.toBeChecked();

  await selectCombatType(page, "melee");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();
  await expect(reloadedTrip.getByLabel("DBA restore")).toBeEnabled();
  await expect(reloadedTrip.getByLabel("DBA restore")).not.toBeChecked();

  await selectCombatType(page, "magic");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();
  await expect(reloadedTrip.getByLabel("Rune slots")).toBeEnabled();
  await expect(reloadedTrip.getByLabel("Rune slots")).toHaveValue("4");
});

test("updates trip potion carry controls and grouped potion summary", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  await selectCombatType(page, "melee");
  await page.getByLabel("Boost", { exact: true }).selectOption("super_att");
  await tabs.getByRole("tab", { name: "Trip" }).click();

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const summary = page.locator('[aria-label="Trip summary"]');
  const recommendation = trip.getByLabel("Potion recommendation");
  const applyRecommendation = recommendation.getByRole("button", { name: "Apply recommendation" });

  await expect(trip.getByLabel("Single-dose")).not.toBeChecked();
  await expect(trip.getByLabel("Combat potion vials / type")).toBeEnabled();
  await expect(trip.getByLabel("Combat potion doses / type")).toBeDisabled();
  await expect(recommendation).toContainText("Potion recommendation");
  await expect(recommendation).toContainText("Recommended carry");
  await expect(recommendation).toContainText("Matches recommendation");
  await expect(applyRecommendation).toBeDisabled();
  await trip.getByLabel("Combat potion vials / type").fill("0");
  await expect(recommendation).toContainText("Below recommendation");
  await expect(applyRecommendation).toBeEnabled();
  await applyRecommendation.click();
  await expect(trip.getByLabel("Combat potion vials / type")).toHaveValue("1");
  await expect(recommendation).toContainText("Matches recommendation");
  await expect(applyRecommendation).toBeDisabled();
  await trip.getByLabel("Combat potion vials / type").fill("2");
  await expect(recommendation).toContainText("Above recommendation");

  await expect(summary).toContainText("Potions");
  await expect(summary).toContainText("Potion slots");
  await expect(summary).toContainText("Potion carry");
  await expect(summary).toContainText("2 vials/type");
  await expect(summary).toContainText("Potion parts");

  await trip.getByLabel("Single-dose").check();
  await expect(trip.getByLabel("Combat potion vials / type")).toBeDisabled();
  await expect(trip.getByLabel("Combat potion doses / type")).toBeEnabled();
  await expect(recommendation).toContainText("Above recommendation");
  await expect(applyRecommendation).toBeEnabled();
  await applyRecommendation.click();
  await expect(trip.getByLabel("Combat potion doses / type")).toHaveValue("1");
  await expect(recommendation).toContainText("Matches recommendation");
  await expect(applyRecommendation).toBeDisabled();
  await trip.getByLabel("Combat potion doses / type").fill("6");
  await expect(summary).toContainText("6 doses/type");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"singleDose":true') &&
      saved.includes('"potionSets":2') &&
      saved.includes('"potionDoses":6') &&
      saved.includes('"prayerPotionSets":null') &&
      saved.includes('"prayerPotionDoses":null') &&
      saved.includes('"boosts":["super_att","super_str"]')
    );
  });

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();
  const reloadedTrip = page.locator('section[aria-label="Trip assumptions"]');
  await expect(reloadedTrip.getByLabel("Single-dose")).toBeChecked();
  await expect(reloadedTrip.getByLabel("Combat potion vials / type")).toBeDisabled();
  await expect(reloadedTrip.getByLabel("Combat potion doses / type")).toHaveValue("6");
  await expect(page.locator('[aria-label="Potions trip summary"]')).toContainText("6 doses/type");
});

test("shows inactive trip potion recommendation states", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  await selectCombatType(page, "melee");
  await page.getByLabel("Boost", { exact: true }).selectOption("none");
  await tabs.getByRole("tab", { name: "Trip" }).click();

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const recommendation = trip.getByLabel("Potion recommendation");
  const applyRecommendation = recommendation.getByRole("button", { name: "Apply recommendation" });

  await expect(recommendation).toContainText("No combat boost selected");
  await expect(recommendation).toContainText("Select a general combat boost");
  await expect(applyRecommendation).toBeDisabled();

  await selectCombatType(page, "melee");
  await page.getByLabel("Boost", { exact: true }).selectOption("super_att");
  await page.getByLabel("Sustained").uncheck();
  await tabs.getByRole("tab", { name: "Trip" }).click();

  await expect(recommendation).toContainText("Inactive");
  await expect(recommendation).toContainText("Sustained is off");
  await expect(applyRecommendation).toBeDisabled();
});

test("updates prayer restore detail controls and keeps the trip summary visible", async ({
  page
}) => {
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const summary = page.locator('[aria-label="Trip summary"]');

  await expect(trip.getByLabel("Prayer mode")).toHaveValue("potions");
  await expect(summary).toContainText("Prayer restore");
  await expect(summary).toContainText(/Auto [0-9]+ vials/);
  await expect(summary).toContainText("Prayer/kill");

  await trip.getByLabel("Prayer restore").selectOption("manual_doses");
  await expect(trip.getByLabel("Prayer doses")).toBeEnabled();
  await trip.getByLabel("Prayer doses").fill("8");
  await expect(summary).toContainText("Manual 8 doses");
  await expect(summary).toContainText("Prayer slots");
  await expect(summary).toContainText("Max kills prayer");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"prayerPotionDoses":8') && saved.includes('"prayerPotionSets":null');
  });

  await trip.getByLabel("Prayer restore").selectOption("manual_vials");
  await expect(trip.getByLabel("Prayer vials")).toBeEnabled();
  await trip.getByLabel("Prayer vials").fill("3");
  await expect(summary).toContainText("Manual 3 vials");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"prayerPotionSets":3') && saved.includes('"prayerPotionDoses":null');
  });

  await trip.getByLabel("Prayer mode").selectOption("altar");
  await expect(trip.getByLabel("Prayer restore")).toBeDisabled();
  await trip.getByLabel("Altar time").selectOption("manual");
  await trip.getByLabel("Altar sec").fill("45");
  await expect(summary).toContainText("Altar/kill");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"prayerMode":"altar"') &&
      saved.includes('"prayerPotionSets":null') &&
      saved.includes('"prayerPotionDoses":null') &&
      saved.includes('"altarSeconds":45')
    );
  });

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();
  const reloadedTrip = page.locator('section[aria-label="Trip assumptions"]');
  await expect(reloadedTrip.getByLabel("Prayer mode")).toHaveValue("altar");
  await expect(reloadedTrip.getByLabel("Prayer restore")).toBeDisabled();
  await expect(reloadedTrip.getByLabel("Altar time")).toHaveValue("manual");
  await expect(reloadedTrip.getByLabel("Altar sec")).toHaveValue("45");
  await expect(page.locator('[aria-label="Trip summary"]')).toBeVisible();
});

test("updates per-monster loot settings and keeps them after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("green_dragon");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();

  const loot = page.locator('section[aria-label="Current monster loot"]');
  const summary = loot.getByLabel("Loot action summary");
  await expect(loot).toBeVisible();
  await expect(summary).toContainText("High alch");

  await loot.getByLabel("High alch").selectOption("enabled");
  await loot.getByLabel("Overhead", { exact: true }).selectOption("manual");
  await loot.getByLabel("Overhead sec").fill("12.5");
  await loot.getByLabel("Talisman spot").selectOption("overground");

  await expect(summary).toContainText("On");
  await expect(summary).toContainText("12.5s");
  await expect(summary).toContainText("Overground");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:loot-settings") ?? "";
    return (
      saved.includes('"green_dragon"') &&
      saved.includes('"highAlch":true') &&
      saved.includes('"overheadSec":12.5') &&
      saved.includes('"talismanSpot":"overground"')
    );
  });
  await page.waitForFunction(() => {
    return !(window.localStorage.getItem("index-sim:loot-prefs") ?? "").includes("green_dragon");
  });

  await page.reload();
  await page.getByLabel("TARGET", { exact: true }).selectOption("green_dragon");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();
  const reloadedLoot = page.locator('section[aria-label="Current monster loot"]');
  await expect(reloadedLoot.getByLabel("High alch")).toHaveValue("enabled");
  await expect(reloadedLoot.getByLabel("Overhead", { exact: true })).toHaveValue("manual");
  await expect(reloadedLoot.getByLabel("Overhead sec")).toHaveValue("12.5");
  await expect(reloadedLoot.getByLabel("Talisman spot")).toHaveValue("overground");
});

test("shows source-backed conditional clue loot without allowing a value action", async ({
  page
}) => {
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("greater_demon");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();

  const table = page.getByRole("table", { name: "Current monster drops" });
  const row = table.getByRole("row", { name: /Clue scroll \(hard\)/ });
  const action = row.getByLabel(/Action for Clue scroll \(hard\)/);
  await expect(row).toBeVisible();
  await expect(row).toContainText("Clue eligibility not modeled");
  await expect(action).toHaveValue("skip");
  await expect(action).toBeDisabled();
  await expect(row).not.toContainText("trail_hardcluedrop");
});

test("resets one Active modifiers loot row while preserving neighboring loot state", async ({
  page
}) => {
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("green_dragon");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();

  const tabs = page.getByLabel("Workbench tabs");
  const loot = page.locator('section[aria-label="Current monster loot"]');
  const dragonBonesAction = page.getByLabel(/Action for Dragon bones/).first();
  await expect(loot).toBeVisible();
  await expect(dragonBonesAction).toBeVisible();

  await loot.getByLabel("High alch").selectOption("enabled");
  await loot.getByLabel("Overhead", { exact: true }).selectOption("manual");
  await loot.getByLabel("Overhead sec").fill("12.5");
  await loot.getByLabel("Talisman spot").selectOption("overground");
  await dragonBonesAction.selectOption("skip");

  await tabs.getByRole("tab", { name: "Stats" }).click();
  const assumptions = page.getByLabel("Active assumptions");
  await expect(assumptions).toContainText("Loot settings");
  await expect(assumptions).toContainText("Loot action overrides");

  await assumptions.getByRole("button", { name: "Reset current monster loot settings" }).click();
  await expect(assumptions).not.toContainText("Loot settings");
  await expect(assumptions).toContainText("Loot action overrides");
  const settingsUndo = page.getByLabel("Local state undo");
  await expect(settingsUndo).toContainText("Reset loot settings for Green Dragon");
  await settingsUndo.getByRole("button", { name: "Undo" }).click();
  await expect(assumptions).toContainText("Loot settings");
  await expect(assumptions).toContainText("Loot action overrides");

  await tabs.getByRole("tab", { name: "Loot" }).click();
  await expect(loot.getByLabel("High alch")).toHaveValue("enabled");
  await expect(loot.getByLabel("Overhead", { exact: true })).toHaveValue("manual");
  await expect(loot.getByLabel("Overhead sec")).toHaveValue("12.5");
  await expect(loot.getByLabel("Talisman spot")).toHaveValue("overground");
  await expect(dragonBonesAction).toHaveValue("skip");

  await loot.getByRole("button", { name: "Reset settings" }).click();
  await expect(loot.getByLabel("High alch")).toHaveValue("disabled");
  await expect(loot.getByLabel("Overhead", { exact: true })).toHaveValue("auto");
  await expect(loot.getByLabel("Talisman spot")).toHaveValue("underground");
  await expect(dragonBonesAction).toHaveValue("skip");
});

test("updates current monster loot actions, reset and optimize", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();

  const loot = page.locator('section[aria-label="Current monster loot"]');
  const table = page.getByRole("table", { name: "Current monster drops" });
  const bigBonesAction = page.getByLabel(/Action for Big bones/).first();

  await expect(loot).toBeVisible();
  await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);
  await expect(loot.getByLabel("Loot action summary")).toContainText("Current delta");
  await expect(bigBonesAction).toHaveValue("bury");

  await bigBonesAction.selectOption("loot");
  await expect(bigBonesAction).toHaveValue("loot");
  await expect(loot.getByText(/Big bones: Loot/)).toBeVisible();
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:loot-prefs") ?? "";
    return saved.includes('"giant"') && saved.includes('"key_big_bones_0":"loot"');
  });

  await loot.getByRole("button", { name: "Reset current" }).click();
  await expect(bigBonesAction).toHaveValue("bury");
  const resetUndo = page.getByLabel("Local state undo");
  await expect(resetUndo).toContainText("Reset loot overrides for Hill Giant");
  await resetUndo.getByRole("button", { name: "Undo" }).click();
  await expect(bigBonesAction).toHaveValue("loot");

  await loot.getByRole("button", { name: "Reset current" }).click();
  await expect(bigBonesAction).toHaveValue("bury");

  await loot.getByRole("button", { name: "Optimize net GP/hr" }).click();
  await expect(page.getByLabel("Local state undo")).toContainText(
    "Optimized loot actions for Hill Giant"
  );
  await expect(page.getByLabel("Local state undo")).not.toContainText("Reset loot overrides");
  await expect(loot.locator(".loot-status")).toContainText("Optimized loot actions");
  await expect(bigBonesAction).toHaveValue("loot");
  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await expect(bigBonesAction).toHaveValue("bury");
  await expect(loot.locator(".loot-status")).toContainText("Restored loot actions for Hill Giant");
  await expect(page.locator('[aria-label="Loot action summary"]')).toBeVisible();
});

test("shows loot value composition, nested detail and action impact detail", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("firegiant");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();

  const loot = page.locator('section[aria-label="Current monster loot"]');
  const composition = loot.getByLabel("Loot value composition");
  const table = page.getByRole("table", { name: "Current monster drops" });
  await expect(loot).toBeVisible();
  await expect(composition).toContainText("Other drops");
  await expect(composition).toContainText("GP/kill");

  const bigBonesRow = table.getByRole("row", { name: /Big bones/ }).first();
  await bigBonesRow.scrollIntoViewIfNeeded();
  await bigBonesRow.locator("details").first().locator("summary").click();
  await expect(page.getByRole("table", { name: /Action impact for Big bones/ })).toContainText(
    "selected"
  );
  await expect(page.getByRole("table", { name: /Action impact for Big bones/ })).toContainText(
    "prayer XP/kill"
  );
  await bigBonesRow.locator("details").last().locator("summary").click();
  await expect(page.getByLabel("Price history for Big bones")).toContainText("Tracked");

  await page
    .getByLabel(/Action for Big bones/)
    .first()
    .selectOption("loot");
  await expect(composition).toContainText("Big bones");
  await expect(composition).toContainText("Loot");

  const nestedRow = table.getByRole("row", { name: /Random herb/ }).first();
  await nestedRow.scrollIntoViewIfNeeded();
  await nestedRow.locator("details").last().locator("summary").click();
  await expect(page.getByRole("table", { name: /Nested rows for Random herb/ })).toContainText(
    "Ranarr"
  );
  await expect(page.getByRole("table", { name: /Nested rows for Random herb/ })).toContainText(
    "Weight"
  );
});

test("matches browser-rendered numeric snapshots for loot action and trip overrides", async ({
  page
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await tabs.getByRole("tab", { name: "Loot" }).click();
  const drops = page.getByRole("table", { name: "Current monster drops" });
  await expect.poll(async () => drops.locator("tbody tr").count()).toBeGreaterThan(8);
  await page
    .getByLabel(/Action for Big bones/)
    .first()
    .selectOption("loot");
  await tabs.getByRole("tab", { name: "Compare" }).click();
  const lootAction = await resultMetricSnapshot(page);

  await page.waitForFunction(() => window.localStorage.getItem("index-sim:rewrite-setup"));
  await page.evaluate(() => {
    const key = "index-sim:rewrite-setup";
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error("Missing rewrite setup");
    const setup = JSON.parse(raw);
    setup.data.form.monsterId = "firegiant";
    setup.data.form.gear.ring = "ring_of_recoil";
    setup.data.form.trip.safespot = false;
    setup.data.form.trip.protect = "none";
    setup.data.form.trip.recoilRings = 3;
    window.localStorage.setItem(key, JSON.stringify(setup));
  });
  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Trip" }).click();

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  await expectSearchableSelection(page.getByLabel("Setup context"), "Monster", "firegiant");
  await trip.getByLabel("Food mode").selectOption("manual");
  await trip.getByLabel("Food count").fill("4");
  await trip.getByLabel("F/KL override").selectOption("on");
  await trip.getByLabel("Food/kill").fill("0.5");
  await trip.getByLabel("Prayer restore").selectOption("manual_doses");
  await trip.getByLabel("Prayer doses").fill("8");
  await trip.getByLabel("Recoil rings").fill("6");

  const tripSummary = await metricSnapshot(
    page.locator('[aria-label="Trip summary"]'),
    TRIP_NUMERIC_LABELS
  );
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Compare" }).click();
  const tripManual = await resultMetricSnapshot(page);

  expect({
    lootAction,
    tripSummary,
    tripManual
  }).toEqual({
    lootAction: {
      DPS: "3.05",
      "MAX HIT": "16.4",
      "HIT %": "88.9%",
      "XP/HR": "21,573",
      "GP/HR NET": "-20,482",
      "KILLS/HR": "235",
      "GP/KILL": "914",
      "SUPPLY/KILL": "1,047"
    },
    tripSummary: {
      "Prayer/kill": "29.21",
      "Prayer slots": "2",
      "Max kills prayer": "6.1",
      "Food count": "Manual 4",
      "Food/kill": "0.50",
      "Kills/trip": "6.1",
      "Effective K/hr": "45",
      "Recoil/kill": "4.5 dmg",
      "Recoil gp/kill": "101"
    },
    tripManual: {
      DPS: "2.59",
      "MAX HIT": "16.4",
      "HIT %": "75.5%",
      "XP/HR": "20,093",
      "GP/HR NET": "-59,137",
      "KILLS/HR": "80",
      "GP/KILL": "1,772",
      "SUPPLY/KILL": "3,079"
    }
  });
});

test("matches browser-rendered numeric snapshots for imported price sets", async ({ page }) => {
  await page.route("**/price-history.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const settings = page.locator('[aria-label="Price data settings"]');
  const priceSetSummary = settings.locator('[aria-label="Active PriceSet summary"]');
  const scheduledSummary = settings.locator('[aria-label="Scheduled price snapshot summary"]');
  await expect(settings).toContainText("Price data");
  await expect(scheduledSummary).toContainText("Status Loaded");
  await expect(scheduledSummary).toContainText("Label Scheduled static prices");
  await expect(priceSetSummary).toContainText("Active source Scheduled snapshot");
  await expect(priceSetSummary).toContainText(/Item prices [0-9,]+/);
  await expect(priceSetSummary).toContainText(/Alch values [0-9,]+/);

  const importedPriceSet = {
    id: "manual-browser-snapshot",
    label: "Imported fixture prices",
    source: "manual",
    createdAt: "2026-07-06T12:00:00.000Z",
    itemPrices: { big_bones: 1_000, lobster: 50 },
    alchValues: { big_bones: 0, lobster: 0 }
  };

  await settings
    .locator("label.file-button")
    .filter({ hasText: "Import PriceSet" })
    .locator('input[type="file"]')
    .setInputFiles({
      name: "manual-browser-snapshot-prices.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(importedPriceSet))
    });

  await expect(priceSetSummary).toContainText("Label Imported fixture prices");
  await expect(priceSetSummary).toContainText("Source manual");
  await expect(priceSetSummary).toContainText("Item prices 2");
  await expect(priceSetSummary).toContainText(/Alch values [1-9][0-9,]*/);
  await expect(priceSetSummary).toContainText("Status Imported price set");
  await expect(settings).toContainText("Imported price set: Imported fixture prices");
  await expect(page.locator(".topbar")).toContainText("Imported fixture prices");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Compare" }).click();
  await expect(page.locator('[aria-label="Result price warnings"]')).toContainText(
    "Price warnings"
  );
  await expect(page.locator('[aria-label="Result price warnings"]')).toContainText(
    "Missing price for loot item"
  );
  const importedPrices = await resultMetricSnapshot(page);

  expect({
    importedPrices
  }).toEqual({
    importedPrices: {
      DPS: "3.05",
      "MAX HIT": "16.4",
      "HIT %": "88.9%",
      "XP/HR": "21,573",
      "GP/HR NET": "-169,821",
      "KILLS/HR": "235",
      "GP/KILL": "82",
      "SUPPLY/KILL": "1,184"
    }
  });

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const reloadedSettings = page.locator('[aria-label="Price data settings"]');
  await expect(reloadedSettings.locator('[aria-label="Active PriceSet summary"]')).toContainText(
    "Label Imported fixture prices"
  );
  await expect(page.getByLabel("Price history summary")).toContainText("Snapshots 1");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Compare" }).click();
  const reloadedImportedPrices = await resultMetricSnapshot(page);
  expect(reloadedImportedPrices).toEqual(importedPrices);

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();
  await expect(page.locator('[aria-label="Loot price warnings"]')).toContainText("Price warnings");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  await expect(page.locator('[aria-label="Economy price warnings"]')).toContainText(
    "Price warnings"
  );
});

test("looks up hiscores through the same-origin API and applies previewed levels", async ({
  page
}) => {
  await page.route("**/api/hiscores/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        source: { id: "mock-hiscores", label: "Mock hiscores" },
        limits: { requestsPerMinute: 30 }
      })
    });
  });
  await page.route("**/api/hiscores?*", async (route) => {
    const url = new URL(route.request().url());
    expect(url.pathname).toBe("/api/hiscores");
    const requestedPlayer = url.searchParams.get("player") ?? "";
    expect(["Fixture Player", "Slow Player", "Other Player"]).toContain(requestedPlayer);
    if (requestedPlayer === "Slow Player") {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const skills =
      requestedPlayer === "Other Player"
        ? {
            attack: { level: 71 },
            strength: { level: 74 },
            defence: { level: 65 },
            hitpoints: { level: 70 },
            prayer: { level: 52 },
            ranged: { level: 60 },
            magic: { level: 67 }
          }
        : {
            attack: { level: 61 },
            strength: { level: 64 },
            defence: { level: 55 },
            hitpoints: { level: 63 },
            prayer: { level: 43 },
            ranged: { level: 50 },
            magic: { level: 57 }
          };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        player: requestedPlayer,
        normalizedPlayer: requestedPlayer,
        source: { id: "mock-hiscores", label: "Mock hiscores" },
        fetchedAt: "2026-07-05T12:00:00.000Z",
        skills,
        warnings: []
      })
    });
  });

  await page.goto("/");
  const hiscores = page.getByRole("region", { name: "Hiscores" });
  await expect(page.getByRole("button", { name: "Lookup" })).toBeEnabled();
  await hiscores.getByLabel("Player", { exact: true }).fill("Fixture Player");
  await hiscores.getByRole("button", { name: "Lookup" }).click();
  await expect(page.getByRole("table", { name: "Hiscores preview" })).toContainText("hitpoints");
  await expect(hiscores).toContainText("Preview for Fixture Player");
  await expect(hiscores).toContainText("Source: Mock hiscores");
  await expect(hiscores).toContainText("Fetched: 2026-07-05T12:00:00.000Z");

  await hiscores.getByLabel("Player", { exact: true }).fill("Other Player");
  await expect(page.getByRole("table", { name: "Hiscores preview" })).toHaveCount(0);
  await expect(hiscores.getByRole("button", { name: "Apply" })).toHaveCount(0);

  await hiscores.getByLabel("Player", { exact: true }).fill("Slow Player");
  await hiscores.getByRole("button", { name: "Lookup" }).click();
  await hiscores.getByLabel("Player", { exact: true }).fill("Other Player");
  await expect(hiscores).toContainText("Player changed before lookup completed");
  await expect(page.getByRole("table", { name: "Hiscores preview" })).toHaveCount(0);

  await hiscores.getByRole("button", { name: "Lookup" }).click();
  await expect(page.getByRole("table", { name: "Hiscores preview" })).toContainText("hitpoints");
  await expect(hiscores).toContainText("Preview for Other Player");
  await hiscores.getByRole("button", { name: "Apply" }).click();

  const setup = page.getByLabel("Combat setup");
  await expect(setup.getByLabel("ATT", { exact: true })).toHaveValue("71");
  await expect(setup.getByLabel("STR", { exact: true })).toHaveValue("74");
  await expect(setup.getByLabel("DEF", { exact: true })).toHaveValue("65");
});

test("keeps market UI scheduled-only when the compatibility sync API exists", async ({ page }) => {
  let refreshRequested = false;
  await page.route("**/api/market/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        available: true,
        source: {
          id: "markets.lostcity.rs",
          label: "Mock LostCity market",
          origin: "https://markets.lostcity.rs"
        },
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
        error: { code: "upstream-unavailable", message: "Compatibility sync disabled" }
      })
    });
  });

  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const market = page.locator('section[aria-label="Market price data"]');

  await expect(market.getByLabel("Scheduled price snapshot summary")).toContainText(
    "Status Loaded"
  );
  await expect(market.getByLabel("Market active PriceSet summary")).toContainText(
    "Active source Scheduled snapshot"
  );
  await expect(market.getByRole("button", { name: /Sync|Refresh|Scrape/ })).toHaveCount(0);
  await expect(market).toContainText("Market upstream refresh is scheduled, not user-triggered.");
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("/api/prices");
  expect(bodyText).not.toContain("/api/scrape");
  expect(bodyText).not.toContain("run_sim.py");
  expect(refreshRequested).toBe(false);
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:price-set:selected"))
  ).toBeNull();
});

test("analyzes and manages browser-local price history in Economy", async ({ page }) => {
  await page.route("**/price-history.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("index-sim:unrelated-test", "keep-me");
    window.localStorage.setItem(
      "index-sim:price-history",
      JSON.stringify({
        version: 1,
        savedAt: "2026-07-06T12:30:00.000Z",
        data: {
          snapshots: [
            {
              capturedAt: "2026-07-06T12:00:00.000Z",
              sourcePriceSetId: "latest",
              label: "Latest test prices",
              itemPrices: { lobster: 250, big_bones: 350 }
            },
            {
              capturedAt: "2026-07-05T12:00:00.000Z",
              sourcePriceSetId: "previous",
              label: "Previous test prices",
              itemPrices: { lobster: 200, big_bones: 500 }
            },
            {
              capturedAt: "2026-07-04T12:00:00.000Z",
              sourcePriceSetId: "first",
              label: "First test prices",
              itemPrices: { lobster: 100, big_bones: 300 }
            }
          ]
        }
      })
    );
  });

  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();

  await expect(page.getByLabel("Price history summary")).toContainText("Snapshots 3");
  await expect(page.getByLabel("Price history summary")).toContainText("Moved 2");
  await expect(page.getByLabel("Top gainers")).toContainText("Lobster");
  await expect(page.getByLabel("Top fallers")).toContainText("Big bones");
  await expect(page.getByRole("table", { name: "Price movers" })).toContainText("Lobster");
  await expect(page.getByRole("table", { name: "Price movers" })).toContainText("Big bones");
  await expect(page.getByRole("img", { name: /Big bones price trend/ })).toBeVisible();
  await chooseSearchableOption(page, "Trend item", "Big bones");
  const itemTrend = page.getByLabel("Item price trend");
  await expect(itemTrend).toContainText("Big bones");
  await expect(itemTrend).toContainText("Latest350");
  await expect(itemTrend).toContainText("Minimum300");
  await expect(itemTrend).toContainText("Maximum500");
  await expect(itemTrend).toContainText("+50 / +16.7%");
  await expect(page.getByRole("img", { name: "Big bones price trend", exact: true })).toBeVisible();
  await expect(page.getByLabel("Price points for Big bones")).toContainText("2026-07-04");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();
  const bigBonesRow = page.getByRole("table", { name: "Current monster drops" }).getByRole("row", {
    name: /Big bones/
  });
  await bigBonesRow.locator("details").last().locator("summary").click();
  const localHistory = page.getByLabel("Price history for Big bones");
  await expect(localHistory).toContainText("Tracked");
  await expect(localHistory).toContainText("350");
  await expect(localHistory).toContainText("500");
  await expect(localHistory).toContainText("-150");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();

  await page.getByLabel("Item filter").fill("bones");
  await expect(page.getByRole("table", { name: "Price movers" })).toContainText("Big bones");
  await expect(page.getByRole("table", { name: "Price movers" })).not.toContainText("Lobster");

  await page.getByLabel("Baseline").selectOption("first");
  await expect(page.getByLabel("Price history summary")).toContainText("First test prices");

  await page.getByRole("button", { name: "Save local comparison" }).click();
  await expect(page.getByLabel("Price history summary")).toContainText("Snapshots 4");
  const afterSnapshot = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("index-sim:price-history") ?? "null")
  );
  expect(afterSnapshot.data.snapshots).toHaveLength(4);

  await page.getByRole("button", { name: "Clear local history" }).click();
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))
  ).not.toBe(null);
  await page.getByRole("button", { name: "Confirm clear local history" }).click();
  await expect(page.getByLabel("Price history summary")).toContainText("Snapshots 0");
  await expect(searchableCombobox(page, "Trend item")).toBeDisabled();
  await expect(page.getByLabel("Item price trend")).toContainText("No price points");
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    null
  );
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:unrelated-test"))).toBe(
    "keep-me"
  );
  await expect(page.locator(".topbar")).toContainText(/scheduled static prices/i);
});

test("keeps shared scheduled price history read-only beside local comparisons", async ({
  page
}) => {
  await page.route("**/price-history.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { t: 1783339200, prices: { lobster: 180, big_bones: 420 } },
        { t: 1783425600, prices: { lobster: 200, big_bones: 400 } },
        { t: 1783512000, prices: { lobster: 220, big_bones: 380 } }
      ])
    });
  });

  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const summary = page.getByLabel("Price history summary");

  await expect(summary).toContainText("Snapshots 3");
  await expect(summary).toContainText("Shared 3");
  await expect(summary).toContainText("Local 0");
  await chooseSearchableOption(page, "Trend item", "Big bones");
  await expect(page.getByRole("img", { name: "Big bones price trend", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear local history" })).toBeDisabled();
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    null
  );

  await page.getByRole("button", { name: "Save local comparison" }).click();
  await expect(summary).toContainText("Snapshots 4");
  await expect(summary).toContainText("Shared 3");
  await expect(summary).toContainText("Local 1");

  await page.getByRole("button", { name: "Clear local history" }).click();
  await page.getByRole("button", { name: "Confirm clear local history" }).click();
  await expect(summary).toContainText("Snapshots 3");
  await expect(summary).toContainText("Shared 3");
  await expect(summary).toContainText("Local 0");
  await expect(searchableCombobox(page, "Trend item")).toBeEnabled();
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    null
  );
});

test("runs, invalidates and cancels modeled Risk analysis", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Risk" }).click();

  const risk = page.locator('section[aria-label="Risk"]');
  await expect(risk).toBeVisible();
  await expect(risk).toContainText("Run the analysis");
  await risk.getByLabel("Target kills").fill("10");
  await risk.getByLabel("Horizon min").fill("10");
  await risk.getByLabel("GP target").fill("0");
  await searchableCombobox(risk, "Target drop").click();
  await risk
    .getByRole("listbox", { name: "Target drop options" })
    .getByRole("option")
    .nth(1)
    .click();
  await risk.getByRole("button", { name: "Run analysis" }).click();

  await expect(risk.getByText("Ready", { exact: true })).toBeVisible({ timeout: 30_000 });
  const results = page.getByLabel("Modeled risk results");
  await expect(results).toContainText("P10 / median / P90");
  for (const label of [
    "Kill time",
    "Food runs out",
    "Kills / trip",
    "Trip cycle",
    "10m net GP",
    "Reach GP target",
    "Target drop"
  ]) {
    await expect(results.locator(".metric").filter({ hasText: label })).toBeVisible();
  }
  await expect(results.getByLabel("Risk model coverage")).toContainText("Loot occurrence");
  await expect(results.getByLabel("Risk model coverage")).toContainText("Source-backed");
  await expect(page.locator('[aria-label="Trip summary"]')).toContainText("Source-backed");
  await expect(results.getByLabel("Risk warnings")).toContainText("Monte Carlo probabilities");

  await chooseSearchableOption(page.getByLabel("Setup context"), "Monster", "Black Dragon");
  await expect(page.locator('[aria-label="Trip summary"]')).toContainText("Partial model");
  await risk.getByRole("button", { name: "Run analysis" }).click();
  await expect(risk.getByText("Ready", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(results.getByLabel("Risk model coverage")).toContainText("Partial model");
  await expect(results.getByLabel("Risk model coverage")).toContainText("mean-only");
  await expect(results.getByLabel("Risk warnings")).toContainText(
    "Contextual or partial incoming attacks"
  );

  await risk.getByLabel("Target kills").fill("11");
  await expect(risk.getByText("Stale", { exact: true })).toBeVisible();
  await expect(results).toContainText("Results are stale");

  await risk.getByLabel("Horizon min").fill("1440");
  await risk.getByRole("button", { name: "Run analysis" }).click();
  await expect(risk.getByRole("button", { name: "Cancel" })).toBeEnabled();
  await risk.getByRole("button", { name: "Cancel" }).click();
  await expect(risk.getByText("Cancelled", { exact: true })).toBeVisible();
});

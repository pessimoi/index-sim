import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  bootVisualApp,
  captureActivePane,
  captureFullPage,
  capturePane,
  openCombatSetup,
  openWorkbenchTab
} from "./helpers/visual-state";

async function prepareDenseCompare(page: Page) {
  const comparison = page.getByRole("region", { name: "Monster comparison", exact: true });
  const table = comparison.getByRole("table", { name: "All monsters" });
  await comparison.getByLabel("Show hidden / irrelevant").check();
  const mossGiant = table.getByRole("row", { name: /Moss Giant/ }).first();
  await mossGiant.getByRole("button", { name: /Mark Moss Giant irrelevant/ }).click();
  await comparison.getByLabel("Monster filter").fill("giant");
  await expect(table.getByRole("row", { name: /Giant lvl 28/ })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(mossGiant.getByLabel("Marked irrelevant for Moss Giant")).toBeVisible();
  return comparison;
}

async function prepareTrip(page: Page) {
  await openWorkbenchTab(page, "Trip");
  const trip = page.getByRole("region", { name: "Trip assumptions", exact: true });
  await trip.getByLabel("Bank time").selectOption("manual");
  await trip.getByLabel("Bank sec").fill("75");
  await trip.getByLabel("Combat potion vials / type").fill("2");
  await trip.getByLabel("Prayer restore").selectOption("manual_doses");
  await trip.getByLabel("Prayer doses").fill("8");
  await trip.getByLabel("Food mode").selectOption("manual");
  await trip.getByLabel("Food count").fill("14");
  await expect(trip.getByLabel("Trip summary", { exact: true })).toContainText("Manual 14");
  return trip;
}

async function prepareLoot(page: Page) {
  await page.getByLabel("TARGET", { exact: true }).selectOption("firegiant");
  await openWorkbenchTab(page, "Loot");
  const loot = page.getByRole("region", { name: "Current monster loot", exact: true });
  await expect(loot.getByLabel("Loot value composition")).toContainText("Random herb");
  return loot;
}

async function captureLootDetails(loot: Locator, viewport: string) {
  const table = loot.getByRole("table", { name: "Current monster drops" });
  if (viewport === "desktop") {
    const bigBones = table.getByRole("row", { name: /Big bones/ }).first();
    const actionDisclosure = bigBones.locator("details").first();
    await actionDisclosure.locator("summary").click();
    const actionImpact = loot.getByRole("table", { name: /Action impact for Big bones/ });
    await capturePane(actionImpact, "loot-action-impact-desktop.png");
    await actionDisclosure.locator("summary").click();
  }

  const randomHerb = table.getByRole("row", { name: /Random herb/ }).first();
  await randomHerb.locator("details").last().locator("summary").click();
  const nested = loot.getByRole("table", { name: /Nested rows for Random herb/ });
  await expect(nested).toContainText("Ranarr");
  await capturePane(nested, `loot-nested-${viewport}.png`);
}

async function preparePlanner(page: Page) {
  await openWorkbenchTab(page, "Planner");
  const planner = page.getByRole("region", { name: "Planner", exact: true });
  await planner.getByRole("button", { name: "Recompute plan" }).click();
  await expect(planner.getByLabel("Planner summary")).toBeVisible();
  await expect(planner.getByRole("img", { name: "DPS vs cumulative XP chart" })).toBeVisible();
  return planner;
}

async function prepareDuelMatrix(page: Page) {
  await openWorkbenchTab(page, "Setups");
  const duel = page.getByRole("region", { name: "Setup comparison", exact: true });
  await duel.getByRole("button", { name: "All monsters" }).click();
  const matrix = duel.getByRole("table", { name: "All-monster setup comparison" });
  await expect(matrix).toBeVisible();
  await duel.getByLabel("Find monster in setup comparison").fill("giant");
  await expect(matrix.getByRole("row", { name: /Giant/ }).first()).toBeVisible();
  return duel;
}

test.describe("repository visual regression", () => {
  test("root shell desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    await captureFullPage(page, "root-shell-desktop.png");
  });

  test("root shell compact landscape", async ({ page }) => {
    await bootVisualApp(page, "compactLandscape");
    await expect(page.getByLabel("Player sidebar")).toBeVisible();
    await expect(page.getByLabel("Monster card")).toBeVisible();
    await captureFullPage(page, "root-shell-compact-landscape.png");
  });

  test("root shell mobile", async ({ page }) => {
    await bootVisualApp(page, "mobile");
    await captureFullPage(page, "root-shell-mobile.png");
  });

  test("dense Compare desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    await capturePane(await prepareDenseCompare(page), "dense-compare-desktop.png");
  });

  test("dense Compare tablet", async ({ page }) => {
    await bootVisualApp(page, "tablet");
    await capturePane(await prepareDenseCompare(page), "dense-compare-tablet.png");
  });

  test("Melee loadout desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    await openCombatSetup(page, "melee");
    const loadout = page.getByRole("region", { name: "Equipment loadout", exact: true });
    await expect(loadout.getByRole("heading", { name: "melee loadout" })).toBeVisible();
    await captureActivePane(page, "loadout-melee-desktop.png");
    const bonusSummary = loadout.getByLabel("Equipment bonus summary");
    await bonusSummary.scrollIntoViewIfNeeded();
    await expect(bonusSummary).toBeVisible();
    await captureActivePane(page, "loadout-melee-details-desktop.png");
    const damageDistribution = page.getByRole("region", {
      name: "Damage distribution",
      exact: true
    });
    await damageDistribution.scrollIntoViewIfNeeded();
    await expect(damageDistribution.getByLabel("Damage distribution buckets")).toBeVisible();
    await captureActivePane(page, "stats-hit-distribution-desktop.png");
  });

  test("Ranged loadout desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    await openCombatSetup(page, "ranged");
    const loadout = page.getByRole("region", { name: "Equipment loadout", exact: true });
    await loadout.getByLabel("Accuracy bonus").fill("44");
    await loadout.getByLabel("Damage bonus").fill("31");
    await expect(loadout.getByLabel("Ammo", { exact: true })).toBeVisible();
    await expect(loadout.getByLabel("Manual combat overrides")).toContainText("2 active");
    await captureActivePane(page, "loadout-ranged-desktop.png");
    const bonusSummary = loadout.getByLabel("Equipment bonus summary");
    await bonusSummary.scrollIntoViewIfNeeded();
    await expect(bonusSummary).toBeVisible();
    await captureActivePane(page, "loadout-ranged-details-desktop.png");
  });

  test("Magic loadout desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    await openCombatSetup(page, "magic");
    const loadout = page.getByRole("region", { name: "Equipment loadout", exact: true });
    await expect(loadout.getByLabel("Spell", { exact: true })).toBeVisible();
    await captureActivePane(page, "loadout-magic-desktop.png");
    const bonusSummary = loadout.getByLabel("Equipment bonus summary");
    await bonusSummary.scrollIntoViewIfNeeded();
    await expect(bonusSummary).toBeVisible();
    await captureActivePane(page, "loadout-magic-details-desktop.png");
  });

  test("Stats desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    await openWorkbenchTab(page, "Stats");
    const stats = page.getByRole("region", { name: "Stats analysis", exact: true });
    await expect(stats.getByRole("region", { name: "Combat roll details" })).toBeVisible();
    await expect(stats.getByLabel("XP routing chips")).toBeVisible();
    await captureActivePane(page, "stats-desktop.png");
    const combatRoll = stats.getByRole("region", { name: "Combat roll details" });
    await combatRoll.scrollIntoViewIfNeeded();
    await expect(combatRoll).toBeVisible();
    await captureActivePane(page, "stats-combat-roll-desktop.png");
  });

  test("Trip desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    await prepareTrip(page);
    await captureActivePane(page, "trip-desktop.png");
  });

  test("Trip mobile", async ({ page }) => {
    await bootVisualApp(page, "mobile");
    await capturePane(await prepareTrip(page), "trip-mobile.png");
  });

  test("Loot desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    const loot = await prepareLoot(page);
    await captureActivePane(page, "loot-desktop.png");
    await captureLootDetails(loot, "desktop");
  });

  test("Loot mobile", async ({ page }) => {
    await bootVisualApp(page, "mobile");
    const loot = await prepareLoot(page);
    await capturePane(loot, "loot-mobile.png");
    await captureLootDetails(loot, "mobile");
  });

  test("Economy desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    await openWorkbenchTab(page, "Economy");
    const economy = page.getByRole("region", { name: "Economy", exact: true });
    const trendItem = economy.getByRole("combobox", { name: "Trend item", exact: true });
    await trendItem.click();
    await economy
      .getByRole("searchbox", { name: "Search Trend item options", exact: true })
      .fill("Big bones");
    await economy
      .getByRole("listbox", { name: "Trend item options", exact: true })
      .getByRole("option", { name: /^Big bones(?:$|\s|\()/i })
      .click();
    await expect(trendItem).toHaveAttribute("data-selected-id", "big_bones");
    await expect(economy.getByLabel("Top movers")).toBeVisible();
    await expect(economy.getByRole("table", { name: "Price movers" })).toContainText("Big bones");
    await captureActivePane(page, "economy-desktop.png");
    const itemTrend = economy.getByLabel("Item price trend");
    await itemTrend.scrollIntoViewIfNeeded();
    await expect(itemTrend.getByRole("img", { name: "Big bones price trend" })).toBeVisible();
    await captureActivePane(page, "economy-trend-desktop.png");
  });

  test("Cannon desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
    await openWorkbenchTab(page, "Cannon");
    const cannon = page.getByRole("region", { name: "Cannon", exact: true });
    await cannon.getByLabel("Set up cannon").check();
    await cannon.getByLabel("Mobs at spot").fill("6");
    await cannon.getByLabel("Respawn").fill("30");
    await expect(cannon.getByLabel("Cannon output")).toContainText("Cannon DPS");
    await captureActivePane(page, "cannon-desktop.png");
  });

  test("Planner desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    await preparePlanner(page);
    await captureActivePane(page, "planner-desktop.png");
  });

  test("Planner mobile", async ({ page }) => {
    await bootVisualApp(page, "mobile");
    await capturePane(await preparePlanner(page), "planner-mobile.png");
  });

  test("Duel desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop");
    await prepareDuelMatrix(page);
    await captureActivePane(page, "duel-desktop.png");
  });

  test("Duel mobile", async ({ page }) => {
    await bootVisualApp(page, "mobile");
    await capturePane(await prepareDuelMatrix(page), "duel-mobile.png");
  });

  test("Settings desktop", async ({ page }) => {
    await bootVisualApp(page, "desktop", { settingsReview: true });
    await expect(page.getByLabel("Legacy setup migration")).toBeVisible();
    await openWorkbenchTab(page, "Settings");
    const settings = page.getByRole("region", { name: "Live services", exact: true });
    await expect(settings.getByLabel("Local state recovery")).toBeVisible();
    await expect(settings.getByLabel("Price data settings")).toBeVisible();
    await captureActivePane(page, "settings-desktop.png");
    const priceData = settings.getByLabel("Price data settings");
    await priceData.scrollIntoViewIfNeeded();
    await expect(priceData).toBeVisible();
    await captureActivePane(page, "settings-price-data-desktop.png");
    await capturePane(
      page.getByLabel("Legacy setup migration"),
      "settings-legacy-review-desktop.png"
    );
  });
});

import { expect, test, type Locator, type Page } from "@playwright/test";

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

function activeMonsterDefence(card: Locator) {
  return card.getByLabel("Monster defence").locator('[aria-current="true"]');
}

async function denseNumericSnapshot(table: Locator, rowName: RegExp) {
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
  await expect(page.getByLabel("Workbench tabs").getByRole("button")).toHaveText([
    "Stats",
    "Melee",
    "Ranged",
    "Magic",
    "Compare",
    "Loot",
    "Trip",
    "Cannon",
    "Duel",
    "Planner",
    "Economy",
    "Settings"
  ]);
  await expect(page.getByLabel("Dense combat spreadsheet")).toBeVisible();
  await expect(page.getByLabel("Combat setup")).toBeVisible();
  await expect(page.getByLabel("Simulation results")).toBeVisible();
  await expect(page.getByLabel("Monster stats")).toBeVisible();
  await expect(activeMonsterDefence(page.getByLabel("Monster card"))).toContainText(
    "Slash defence"
  );
  await expect(page.getByRole("table", { name: "All monsters" })).toBeVisible();
  await expect(page.getByText("All monsters")).toBeVisible();
  await expect(page.getByText("DPS").first()).toBeVisible();
  await expect(
    page.getByText("Hiscores disabled: runtime or upstream not configured")
  ).toBeVisible();
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Economy" }).click();
  await expect(
    page.getByText("Market sync disabled: runtime or upstream not configured")
  ).toBeVisible();
  await expect(page.getByText("run_sim.py")).toHaveCount(0);
  await expect(page.getByText("/api/prices")).toHaveCount(0);
  await expect(page.getByText("/api/scrape")).toHaveCount(0);
});

test("shows Stats XP routing trip summary and hit distribution", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Stats" }).click();

  const analysis = page.getByLabel("Stats analysis");
  await expect(analysis).toBeVisible();

  const xpRouting = analysis.getByRole("region", { name: "XP routing", exact: true });
  await expect(xpRouting).toBeVisible();
  await expect(xpRouting.getByRole("list", { name: "XP routing chips" })).toContainText(
    "Player combat XP/hr"
  );
  await expect(xpRouting).toContainText("Hitpoints");
  await expect(xpRouting).toContainText("Prayer XP/hr");
  await expect(xpRouting).toContainText("partial");
  await expect(xpRouting).toContainText("Magic (alch) XP/hr");
  await expect(xpRouting).toContainText("not modeled");
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
  await expect(tripTable).toContainText("Protection");

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

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Compare" }).click();
  await page.getByLabel("TYPE", { exact: true }).selectOption("ranged");
  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Cannon" }).click();
  const cannon = page.locator('section[aria-label="Cannon"]');
  await cannon.getByLabel("Set up cannon").check();
  await cannon.getByLabel("Mobs at spot").fill("6");
  await cannon.getByLabel("Respawn").fill("30");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Stats" }).click();
  await expect(
    analysis
      .getByRole("list", { name: "XP routing chips" })
      .getByRole("listitem", { name: /Cannon ranged XP\/hr/i })
  ).toBeVisible();
});

test("switches the target through MonsterCard and keeps shell state in sync", async ({ page }) => {
  await page.goto("/");
  const card = page.getByLabel("Monster card");
  const table = page.getByRole("table", { name: "All monsters" });
  const beforeMetrics = await resultMetricSnapshot(page);

  await expect(card.getByRole("heading", { name: "Giant" })).toBeVisible();
  await expect(card.getByLabel("Current setup state")).toContainText("Default setup");
  await card.getByLabel("Target", { exact: true }).selectOption("rock_crab");

  await expect(page.getByLabel("Setup context").getByRole("heading", { name: "Rock Crab" }))
    .toBeVisible();
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

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Ranged" }).click();
  await expect(activeMonsterDefence(card)).toContainText("Ranged defence");

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Magic" }).click();
  await expect(activeMonsterDefence(card)).toContainText("Magic defence");
});

test("places MonsterCard after the active pane on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");

  const shellOrder = await page.locator(".workbench-shell > *").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label"))
  );
  expect(shellOrder).toEqual(["Player sidebar", "Workbench center", "Monster card"]);

  const card = page.getByLabel("Monster card");
  await expect(card).toBeVisible();
  await expect(card.getByLabel("Target", { exact: true })).toBeVisible();
  await expect(activeMonsterDefence(card)).toBeVisible();
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
    expect(firstVisibleBodyBox!.y).toBeGreaterThanOrEqual(
      headerBox!.y + headerBox!.height - 1
    );

    const activeRow = table.getByRole("row", { name: /Giant lvl 28/ });
    await expectActiveDenseRow(table, /Giant lvl 28/);
    await activeRow.getByRole("button", { name: /Mark .* irrelevant/ }).click();
    await expect(activeRow.getByLabel("Marked irrelevant for Hill Giant")).toBeVisible();
    await expect(
      activeRow.getByLabel("Current target kept visible for Hill Giant")
    ).toBeVisible();

    await page.getByLabel("Monster filter").fill("rock crab");
    await page
      .getByLabel("Monster comparison")
      .getByLabel("Drop filter")
      .fill("very long impossible dragon bones and rune chainbody filter value");
    await expect(activeRow).toBeVisible();
    await expect(activeRow.locator("td").first()).toContainText(">");
    await expect(
      activeRow.getByLabel("Current target kept visible for Hill Giant")
    ).toBeVisible();
    await expectPageWidthContained(page);
  }
});

test("recomputes the Planner tab workflow from visible planner controls", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Planner" }).click();

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
  await expect(planner.getByLabel("Planner warnings")).toContainText("manual requirement policy");

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

test("uses the Duel tab to snapshot rename load delete and persist setup comparisons", async ({
  page
}) => {
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await tabs.getByRole("button", { name: "Duel" }).click();
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

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Duel" }).click();
  const reloadedDuel = page.getByRole("region", { name: "Duel", exact: true });
  const reloadedTable = reloadedDuel.getByRole("table", { name: "Duel comparison" });
  await expect(reloadedTable.getByLabel("Rename snapshot Melee saved")).toBeVisible();

  await page
    .getByLabel("Setup context")
    .getByLabel("Monster", { exact: true })
    .selectOption("rock_crab");
  const combatType = page.getByLabel("Combat type");
  await combatType.getByRole("button", { name: "ranged" }).click();
  await expect(reloadedTable).toContainText("best");
  await reloadedTable.getByRole("button", { name: "Load" }).click();
  await expect(combatType.getByRole("button", { name: "melee" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByLabel("Setup context").getByLabel("Monster", { exact: true })).toHaveValue(
    "rock_crab"
  );

  await page.evaluate(() => window.localStorage.setItem("duel_unrelated_key", "keep"));
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
        trip: { safespot: false, protect: "missiles", antifire: true }
      })
    );
    window.localStorage.setItem("sim_planner_v1", "{}");
    window.localStorage.setItem(
      "index-sim:planner-ui",
      JSON.stringify({
        version: 1,
        savedAt: "2026-07-06T12:00:00.000Z",
        data: {
          metric: "balanced",
          targetLevels: { attack: 70, strength: 70, defence: 50, ranged: 50, magic: 50 },
          currentXp: { attack: 1000, strength: 2000, defence: 0, ranged: 0, magic: 0 },
          skillLocks: { attack: false, strength: true, defence: false, ranged: false, magic: false },
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
    window.localStorage.setItem("sim_price_history_v1", "[]");
    window.localStorage.setItem("sim_hiscore_player", "Fixture Player");
  });

  await page.goto("/");
  const migration = page.getByLabel("Legacy setup migration");

  await expect(migration).toBeVisible();
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Legacy setup ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Hiscores player ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Planner data found");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Prices ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Price history found");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Review needed");
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Compatible setup fields"
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
  await expect(keyReview.getByRole("row", { name: /sim_planner_v1.*review only/ })).toBeVisible();
  await expect(
    keyReview.getByRole("row", { name: /sim_scraped_keys_v1.*intentional reset/ })
  ).toBeVisible();

  await migration.getByRole("button", { name: "Import compatible data" }).click();
  await expect(migration).toHaveCount(0);
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveValue("ranged");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("greater_demon");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"combatStyle":"ranged"') &&
      saved.includes('"monsterId":"greater_demon"') &&
      window.localStorage.getItem("sim_input_v3") !== null &&
      window.localStorage.getItem("sim_planner_v1") !== null &&
      window.localStorage.getItem("sim_prices_v1") !== null &&
      window.localStorage.getItem("sim_alch_v1") !== null &&
      window.localStorage.getItem("sim_scraped_at_v1") !== null &&
      window.localStorage.getItem("sim_scraped_keys_v1") !== null &&
      window.localStorage.getItem("sim_price_history_v1") !== null &&
      window.localStorage.getItem("sim_hiscore_player") !== null &&
      window.localStorage.getItem("index-sim:legacy-migration-dismissed") !== null &&
      (window.localStorage.getItem("index-sim:planner-ui") ?? "").includes(
        '"metric":"balanced"'
      ) &&
      !(window.localStorage.getItem("index-sim:planner-ui") ?? "").includes('"metric":"xph"') &&
      (window.localStorage.getItem("index-sim:hiscores:last-player") ?? "").includes(
        "Fixture Player"
      ) &&
      (window.localStorage.getItem("index-sim:price-history") ?? "").includes(
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
      "GP/HR NET": "-238,749",
      "KILLS/HR": "109",
      "GP/KILL": "613",
      "SUPPLY/KILL": "5,292"
    }
  });
});

test("updates manual combat overrides and resets to derived values", async ({ page }) => {
  await page.goto("/");

  const setup = page.getByLabel("Combat setup");
  await setup.getByLabel("ACC+").fill("120");
  await setup.getByLabel("DMG+").fill("95");
  await setup.getByLabel("SPD").fill("1.2");

  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"manualOverrides"') &&
      saved.includes('"accuracyBonus":120') &&
      saved.includes('"damageBonus":95') &&
      saved.includes('"attackSpeedSec":1.2')
    );
  });

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Melee" }).click();
  const overrides = page.getByLabel("Manual combat overrides");
  await expect(overrides.getByLabel("Accuracy bonus")).toHaveValue("120");
  await expect(overrides.getByLabel("Damage bonus")).toHaveValue("95");
  await expect(overrides.getByLabel("Attack speed sec")).toHaveValue("1.2");
  await overrides.getByRole("button", { name: "Reset all overrides" }).click();

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

test("keeps legacy data and dismisses the migration notice", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("sim_input_v3", JSON.stringify({ combatType: "melee" }));
    window.localStorage.setItem("sim_planner_v1", "{not json");
  });

  await page.goto("/");
  const migration = page.getByLabel("Legacy setup migration");
  await expect(migration).toBeVisible();

  await migration.getByRole("button", { name: "Keep legacy data" }).click();
  await expect(migration).toHaveCount(0);
  await page.waitForFunction(() => {
    return (
      window.localStorage.getItem("sim_input_v3") !== null &&
      window.localStorage.getItem("sim_planner_v1") !== null &&
      window.localStorage.getItem("index-sim:legacy-migration-dismissed") !== null
    );
  });
});

test("clears only known legacy data after confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("sim_input_v3", JSON.stringify({ combatType: "melee" }));
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

test("updates results when the combat style changes", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("TYPE", { exact: true }).selectOption("ranged");
  await expect(page.getByLabel("Combat setup").getByLabel("RNG")).toBeVisible();
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("giant");
  await expect(page.getByText("XP/HR").first()).toBeVisible();
});

test("restores per-combat-style loadout edits when switching styles", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  const special = page.locator('section[aria-label="Special attack"]');

  await tabs.getByRole("button", { name: "Melee" }).click();
  await special.getByLabel("Spec weapon").selectOption("dragon_dagger_p");
  await page.getByLabel("PRAY", { exact: true }).selectOption("clarity");

  await tabs.getByRole("button", { name: "Ranged" }).click();
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveValue("ranged");
  await special.getByLabel("Spec weapon").selectOption("magic_shortbow");
  await special.getByLabel("Spec ammo").selectOption("rune_arrow");
  await page.getByLabel("POT", { exact: true }).selectOption("ranging");

  await tabs.getByRole("button", { name: "Melee" }).click();
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveValue("melee");
  await expect(special.getByLabel("Spec weapon")).toHaveValue("dragon_dagger_p");
  await expect(page.getByLabel("PRAY", { exact: true })).toHaveValue("clarity");

  await tabs.getByRole("button", { name: "Ranged" }).click();
  await expect(special.getByLabel("Spec weapon")).toHaveValue("magic_shortbow");
  await expect(special.getByLabel("Spec ammo")).toHaveValue("rune_arrow");
  await expect(page.getByLabel("POT", { exact: true })).toHaveValue("ranging");
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
  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("button", { name: "Melee" }).click();

  const compactSetup = page.getByLabel("Combat setup");
  const equipmentPane = page.getByLabel("Equipment loadout");
  const prayerSelections = equipmentPane.getByLabel("Prayer selections");
  const boostSelections = equipmentPane.getByLabel("Boost selections");

  await expect(compactSetup.getByLabel("PRAY", { exact: true })).toHaveValue("ultimate");
  await expect(compactSetup.getByLabel("POT", { exact: true })).toHaveValue("super_att");
  await expect(compactSetup).toContainText("+1");

  await prayerSelections.getByLabel(/steel skin/i).check();
  await expect(prayerSelections.getByLabel(/steel skin/i)).toBeChecked();
  await expect(compactSetup.getByLabel("PRAY", { exact: true })).toHaveValue("ultimate");
  await expect(compactSetup).toContainText("+2");

  await compactSetup.getByLabel("PRAY", { exact: true }).selectOption("reflexes");
  await expect(prayerSelections.getByLabel(/reflexes/i)).toBeChecked();
  await expect(prayerSelections.getByLabel(/incredible/i)).not.toBeChecked();
  await expect(prayerSelections.getByLabel(/ultimate/i)).toBeChecked();
  await expect(prayerSelections.getByLabel(/steel skin/i)).toBeChecked();
  await expect(compactSetup.getByLabel("PRAY", { exact: true })).toHaveValue("reflexes");
  await expect(compactSetup).toContainText("+2");

  await boostSelections.getByLabel(/magic/i).check();
  await compactSetup.getByLabel("POT", { exact: true }).selectOption("ranging");
  await expect(boostSelections.getByLabel(/ranging/i)).toBeChecked();
  await expect(boostSelections.getByLabel(/super att/i)).toBeChecked();
  await expect(boostSelections.getByLabel(/super str/i)).toBeChecked();
  await expect(boostSelections.getByLabel(/magic/i)).toBeChecked();
  await expect(compactSetup.getByLabel("POT", { exact: true })).toHaveValue("ranging");
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
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  const setupContext = page.getByLabel("Setup context");
  const setupDps = setupContext.locator(".metric", { hasText: "DPS" }).locator("strong");

  await tabs.getByRole("button", { name: "Melee" }).click();
  const meleePane = page.getByLabel("Equipment loadout");
  const meleeDpsBefore = await setupDps.textContent();
  await meleePane.getByLabel("Shield", { exact: true }).selectOption("unholy_book");
  await meleePane.getByLabel("Weapon search").fill("dragon halberd");
  await meleePane.getByLabel("Weapon", { exact: true }).selectOption("dragon_halberd");
  await expect(meleePane.getByLabel("Shield", { exact: true })).toBeDisabled();
  await expect(meleePane.getByLabel("Shield", { exact: true })).toHaveValue("none");
  await expect.poll(async () => setupDps.textContent()).not.toBe(meleeDpsBefore);

  await tabs.getByRole("button", { name: "Ranged" }).click();
  const rangedPane = page.getByLabel("Equipment loadout");
  await rangedPane.getByLabel("Weapon search").fill("magic shortbow");
  await rangedPane.getByLabel("Weapon", { exact: true }).selectOption("magic_shortbow");
  await rangedPane.getByLabel("Ammo search").fill("adamant arrow");
  await rangedPane.getByLabel("Ammo", { exact: true }).selectOption("addy_arrow");

  await tabs.getByRole("button", { name: "Magic" }).click();
  const magicPane = page.getByLabel("Equipment loadout");
  await magicPane.getByLabel("Spell search").fill("fire wave");
  await magicPane.getByLabel("Spell", { exact: true }).selectOption("fire_wave");
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
  await tabs.getByRole("button", { name: "Melee" }).click();
  await expect(
    page.getByLabel("Equipment loadout").getByLabel("Weapon", { exact: true })
  ).toHaveValue("dragon_halberd");
  await expect(
    page.getByLabel("Equipment loadout").getByLabel("Shield", { exact: true })
  ).toBeDisabled();
  await tabs.getByRole("button", { name: "Ranged" }).click();
  await expect(
    page.getByLabel("Equipment loadout").getByLabel("Ammo", { exact: true })
  ).toHaveValue("addy_arrow");
  await tabs.getByRole("button", { name: "Magic" }).click();
  await expect(
    page.getByLabel("Equipment loadout").getByLabel("Spell", { exact: true })
  ).toHaveValue("fire_wave");
});

test("applies gear quick actions for the active combat style", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await tabs.getByRole("button", { name: "Melee" }).click();
  const meleePane = page.getByLabel("Equipment loadout");
  await meleePane.getByRole("button", { name: "Best Helm" }).click();
  await expect(meleePane.getByLabel("Helm", { exact: true })).toHaveValue("berserker_helm");
  await meleePane.getByRole("button", { name: "Best Shield" }).click();
  await expect(meleePane.getByLabel("Shield", { exact: true })).toHaveValue("unholy_book");
  await meleePane.getByLabel("Weapon search").fill("dragon halberd");
  await meleePane.getByLabel("Weapon", { exact: true }).selectOption("dragon_halberd");
  await expect(meleePane.getByRole("button", { name: "Best Shield" })).toBeDisabled();
  await expect(meleePane.getByLabel("Shield", { exact: true })).toHaveValue("none");

  await tabs.getByRole("button", { name: "Ranged" }).click();
  const rangedPane = page.getByLabel("Equipment loadout");
  await rangedPane.getByRole("button", { name: "Best Body" }).click();
  await expect(rangedPane.getByLabel("Body", { exact: true })).toHaveValue("black_dhide_body");

  await tabs.getByRole("button", { name: "Magic" }).click();
  const magicPane = page.getByLabel("Equipment loadout");
  await magicPane.getByRole("button", { name: "Best Cape" }).click();
  await expect(magicPane.getByLabel("Cape", { exact: true })).toHaveValue("god_cape");

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

test("filters hidden gear tiers while keeping current selections", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await tabs.getByRole("button", { name: "Melee" }).click();
  const meleePane = page.getByLabel("Equipment loadout");
  await meleePane.getByLabel("Body", { exact: true }).selectOption("iron_platebody");

  await tabs.getByRole("button", { name: "Settings" }).click();
  const settings = page.locator('[aria-label="Hidden gear tiers"]');
  await expect(settings).toContainText("Gear menu");
  await settings.getByLabel("Hide iron gear").check();
  await expect(settings).toContainText("1 hidden");

  await tabs.getByRole("button", { name: "Melee" }).click();
  await expect(meleePane.getByLabel("Body", { exact: true })).toHaveValue("iron_platebody");
  const helmOptions = await meleePane.getByLabel("Helm", { exact: true }).locator("option").allTextContents();
  const bodyOptions = await meleePane.getByLabel("Body", { exact: true }).locator("option").allTextContents();
  expect(helmOptions.join("\n")).not.toContain("Iron full helm");
  expect(bodyOptions.join("\n")).toContain("Iron platebody");
  expect(bodyOptions.join("\n")).toContain("None");

  await page.waitForFunction(() => {
    const setup = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    const hidden = window.localStorage.getItem("index-sim:hidden-gear-tiers") ?? "";
    return setup.includes('"body":"iron_platebody"') && hidden.includes('"iron":true');
  });

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Settings" }).click();
  await expect(
    page.locator('[aria-label="Hidden gear tiers"]').getByLabel("Hide iron gear")
  ).toBeChecked();
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Melee" }).click();
  const reloadedMeleePane = page.getByLabel("Equipment loadout");
  await expect(reloadedMeleePane.getByLabel("Body", { exact: true })).toHaveValue(
    "iron_platebody"
  );
  const reloadedHelmOptions = await reloadedMeleePane
    .getByLabel("Helm", { exact: true })
    .locator("option")
    .allTextContents();
  expect(reloadedHelmOptions.join("\n")).not.toContain("Iron full helm");
});

test("creates, restores and removes monster-specific custom setups", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  const setupContext = page.getByLabel("Setup context");

  await setupContext.getByRole("button", { name: "Create custom setup" }).click();
  await expect(setupContext).toContainText("Custom setup");

  await tabs.getByRole("button", { name: "Melee" }).click();
  const equipmentPane = page.getByLabel("Equipment loadout");
  await equipmentPane.getByLabel("Weapon search").fill("dragon halberd");
  await equipmentPane.getByLabel("Weapon", { exact: true }).selectOption("dragon_halberd");
  await expect(equipmentPane.getByLabel("Weapon", { exact: true })).toHaveValue("dragon_halberd");

  await setupContext.getByLabel("Monster", { exact: true }).selectOption("rock_crab");
  await expect(setupContext).toContainText("Default setup");
  await expect(equipmentPane.getByLabel("Weapon", { exact: true })).toHaveValue("rune_scimitar");

  await setupContext.getByLabel("Monster", { exact: true }).selectOption("giant");
  await expect(setupContext).toContainText("Custom setup");
  await expect(equipmentPane.getByLabel("Weapon", { exact: true })).toHaveValue("dragon_halberd");

  await tabs.getByRole("button", { name: "Compare" }).click();
  await expect(page.locator('tr[aria-selected="true"]')).toContainText("custom");

  await setupContext.getByRole("button", { name: "Remove custom setup" }).click();
  await expect(setupContext).toContainText("Default setup");
  await tabs.getByRole("button", { name: "Melee" }).click();
  await expect(
    page.getByLabel("Equipment loadout").getByLabel("Weapon", { exact: true })
  ).toHaveValue("rune_scimitar");
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
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Melee" }).click();
  const special = page.locator('section[aria-label="Special attack"]');

  await expect(special).toBeVisible();
  await special.getByLabel("Spec weapon").selectOption("dragon_dagger_p");

  await expect(page.locator('[aria-label="Special attack metrics"]')).toContainText("Spec max hit");
  await expect(page.locator('[aria-label="Special attack metrics"]')).toContainText("DPS gain");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"weaponId":"dragon_dagger_p"');
  });

  await page.getByLabel("TYPE", { exact: true }).selectOption("ranged");
  await special.getByLabel("Spec weapon").selectOption("magic_shortbow");
  await expect(special.getByLabel("Spec ammo")).toBeVisible();
  await special.getByLabel("Spec ammo").selectOption("rune_arrow");
  await expect(page.locator('[aria-label="Special attack metrics"]')).toContainText("Specs/hr");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"weaponId":"magic_shortbow"') && saved.includes('"ammoId":"rune_arrow"');
  });

  await page.getByLabel("TYPE", { exact: true }).selectOption("magic");
  await expect(special.getByLabel("Spec weapon")).toBeDisabled();
  await expect(special).toContainText("Magic DPS specs unavailable");
});

test("sorts the full monster table and selects a target row", async ({ page }) => {
  await page.goto("/");
  const table = page.getByRole("table", { name: "All monsters" });

  await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);
  await table.getByRole("button", { name: /Monster/ }).click();

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
  await tabs.getByRole("button", { name: "Melee" }).click();
  const equipmentPane = page.getByLabel("Equipment loadout");
  await equipmentPane.getByLabel("Weapon search").fill("dragon halberd");
  await equipmentPane.getByLabel("Weapon", { exact: true }).selectOption("dragon_halberd");
  await setupContext.getByLabel("Monster", { exact: true }).selectOption("green_dragon");
  await tabs.getByRole("button", { name: "Loot" }).click();

  const loot = page.locator('section[aria-label="Current monster loot"]');
  await loot.getByLabel("High alch").selectOption("disabled");
  await loot.getByLabel("Overhead", { exact: true }).selectOption("manual");
  await loot.getByLabel("Overhead sec").fill("12.5");

  await tabs.getByRole("button", { name: "Compare" }).click();
  const table = page.getByRole("table", { name: "All monsters" });
  const giantRow = table.getByRole("row", { name: /Hill Giant/ });
  const greenDragonRow = table.getByRole("row", { name: /Green Dragon/ });

  await expect(giantRow.getByLabel("Custom setup for Hill Giant")).toBeVisible();
  await expect(greenDragonRow.getByLabel("High alch override for Green Dragon")).toBeVisible();
  await expect(greenDragonRow.getByLabel("Kill overhead override for Green Dragon")).toBeVisible();
});

test("matches browser-rendered dense numeric snapshots", async ({ page }) => {
  await page.goto("/");
  const table = page.getByRole("table", { name: "All monsters" });
  await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(8);

  const defaultMelee = await denseNumericSnapshot(table, /Giant lvl 28/);
  const defaultMeleeResults = await resultMetricSnapshot(page);

  await page.getByLabel("TYPE", { exact: true }).selectOption("ranged");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveValue("ranged");
  await page.getByLabel("TARGET", { exact: true }).selectOption("greater_demon");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("greater_demon");
  await expect(table.getByRole("row", { name: /Greater Demon/ }).locator("td").nth(2)).toHaveText(
    "10.0"
  );
  const rangedSafespot = await denseNumericSnapshot(table, /Greater Demon/);
  const rangedSafespotResults = await resultMetricSnapshot(page);

  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Cannon" }).click();
  const cannon = page.locator('section[aria-label="Cannon"]');
  await cannon.getByLabel("Set up cannon").check();
  await cannon.getByLabel("Mobs at spot").fill("6");
  await cannon.getByLabel("Respawn").fill("30");
  const cannonOutput = await metricSnapshot(
    page.locator('[aria-label="Cannon output"]'),
    CANNON_NUMERIC_LABELS
  );
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Compare" }).click();
  await expect(
    table.getByRole("row", { name: /Dagannoth \(lvl 74\)/ }).locator("td").nth(3)
  ).toHaveText("2.24");
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
      gpPerKill: "479",
      gpPerHour: "112,417",
      netGpPerHour: "-109,053"
    },
    defaultMeleeResults: {
      DPS: "3.05",
      "MAX HIT": "16.4",
      "HIT %": "88.9%",
      "XP/HR": "21,573",
      "GP/HR NET": "-109,053",
      "KILLS/HR": "235",
      "GP/KILL": "479",
      "SUPPLY/KILL": "1,187"
    },
    rangedSafespot: {
      hit: "70.6%",
      max: "10.0",
      dps: "1.96",
      ttk: "45.6s",
      killsPerHour: "73",
      xpPerHour: "14,525",
      gpPerKill: "646",
      gpPerHour: "47,327",
      netGpPerHour: "-194,861"
    },
    rangedSafespotResults: {
      DPS: "1.96",
      "MAX HIT": "10.0",
      "HIT %": "70.6%",
      "XP/HR": "14,525",
      "GP/HR NET": "-194,861",
      "KILLS/HR": "73",
      "GP/KILL": "646",
      "SUPPLY/KILL": "5,315"
    },
    cannonRanged: {
      hit: "80.7%",
      max: "10.0",
      dps: "2.24",
      ttk: "32.3s",
      killsPerHour: "326",
      xpPerHour: "37,421",
      gpPerKill: "89",
      gpPerHour: "28,904",
      netGpPerHour: "-320,994"
    },
    cannonRangedResults: {
      DPS: "2.24",
      "MAX HIT": "10.0",
      "HIT %": "80.7%",
      "XP/HR": "37,421",
      "GP/HR NET": "-320,994",
      "KILLS/HR": "326",
      "GP/KILL": "89",
      "SUPPLY/KILL": "1,929"
    },
    cannonOutput: {
      "Effective targets": "2.5",
      "Cannon DPS": "6.26",
      "Balls/hr": "1,861",
      "Balls/kill": "4.41",
      "Cannon Ranged XP/hr": "45,075",
      "Effective XP/hr": "37,421",
      "Effective net GP/hr": "-320,994",
      "Ball cost/hr": "335,006",
      "Ball cost/kill": "793",
      "Ball price": "180",
      "Cannonballs/trip": "69",
      "Ball gp/trip": "12,380",
      "K/hr uplift": "215.9%"
    }
  });
});

test("matches release-path dense numeric snapshots", async ({ page }) => {
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

  await page.getByLabel("TYPE", { exact: true }).selectOption("ranged");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveValue("ranged");
  await page.getByLabel("TARGET", { exact: true }).selectOption("greater_demon");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("greater_demon");
  await expect(table.getByRole("row", { name: /Greater Demon/ }).locator("td").nth(2)).toHaveText(
    "10.0"
  );
  const rangedSafespot = await denseNumericSnapshot(table, /Greater Demon/);
  const rangedSafespotResults = await resultMetricSnapshot(page);
  await expectActiveDenseRow(table, /Greater Demon/);

  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await tabs.getByRole("button", { name: "Cannon" }).click();
  const cannon = page.locator('section[aria-label="Cannon"]');
  await cannon.getByLabel("Set up cannon").check();
  await cannon.getByLabel("Mobs at spot").fill("6");
  await cannon.getByLabel("Respawn").fill("30");
  await tabs.getByRole("button", { name: "Compare" }).click();
  const rangedCannon = await denseNumericSnapshot(table, /Dagannoth \(lvl 74\)/);
  const rangedCannonResults = await resultMetricSnapshot(page);
  await expectActiveDenseRow(table, /Dagannoth \(lvl 74\)/);
  expect(rangedCannon.netGpPerHour).toMatch(/^-/);

  await page.getByLabel("TYPE", { exact: true }).selectOption("magic");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveValue("magic");
  await tabs.getByRole("button", { name: "Magic" }).click();
  const magicPane = page.getByLabel("Equipment loadout");
  await magicPane.getByLabel("Spell search").fill("fire wave");
  await magicPane.getByLabel("Spell", { exact: true }).selectOption("fire_wave");
  await page.getByLabel("TARGET", { exact: true }).selectOption("blue_dragon");
  await tabs.getByRole("button", { name: "Compare" }).click();
  await expect(table.getByRole("row", { name: /Blue Dragon/ }).locator("td").nth(2)).toHaveText(
    "20.0"
  );
  const magicSafespot = await denseNumericSnapshot(table, /Blue Dragon/);
  const magicSafespotResults = await resultMetricSnapshot(page);
  await expectActiveDenseRow(table, /Blue Dragon/);

  await page.getByLabel("TARGET", { exact: true }).selectOption("green_dragon");
  const setupContext = page.getByLabel("Setup context");
  await setupContext.getByRole("button", { name: "Create custom setup" }).click();
  await tabs.getByRole("button", { name: "Melee" }).click();
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveValue("melee");
  const meleePane = page.getByLabel("Equipment loadout");
  await meleePane.getByLabel("Weapon search").fill("dragon halberd");
  await meleePane.getByLabel("Weapon", { exact: true }).selectOption("dragon_halberd");
  await tabs.getByRole("button", { name: "Loot" }).click();
  const loot = page.locator('section[aria-label="Current monster loot"]');
  await loot.getByLabel("High alch").selectOption("disabled");
  await loot.getByLabel("Overhead", { exact: true }).selectOption("manual");
  await loot.getByLabel("Overhead sec").fill("12.5");
  await tabs.getByRole("button", { name: "Compare" }).click();
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
      gpPerKill: "479",
      gpPerHour: "112,417",
      netGpPerHour: "-109,053"
    },
    meleeBaselineResults: {
      DPS: "3.05",
      "MAX HIT": "16.4",
      "HIT %": "88.9%",
      "XP/HR": "21,573",
      "GP/HR NET": "-109,053",
      "KILLS/HR": "235",
      "GP/KILL": "479",
      "SUPPLY/KILL": "1,187"
    },
    meleeAlchRelevant: {
      hit: "82.1%",
      max: "16.4",
      dps: "2.81",
      ttk: "23.2s",
      killsPerHour: "140",
      xpPerHour: "18,290",
      gpPerKill: "463",
      gpPerHour: "64,907",
      netGpPerHour: "-117,343"
    },
    meleeAlchRelevantResults: {
      DPS: "2.81",
      "MAX HIT": "16.4",
      "HIT %": "82.1%",
      "XP/HR": "18,290",
      "GP/HR NET": "-117,343",
      "KILLS/HR": "140",
      "GP/KILL": "463",
      "SUPPLY/KILL": "2,028"
    },
    rangedSafespot: {
      hit: "70.6%",
      max: "10.0",
      dps: "1.96",
      ttk: "45.6s",
      killsPerHour: "73",
      xpPerHour: "14,525",
      gpPerKill: "646",
      gpPerHour: "47,327",
      netGpPerHour: "-194,861"
    },
    rangedSafespotResults: {
      DPS: "1.96",
      "MAX HIT": "10.0",
      "HIT %": "70.6%",
      "XP/HR": "14,525",
      "GP/HR NET": "-194,861",
      "KILLS/HR": "73",
      "GP/KILL": "646",
      "SUPPLY/KILL": "5,315"
    },
    rangedCannon: {
      hit: "80.7%",
      max: "10.0",
      dps: "2.24",
      ttk: "32.3s",
      killsPerHour: "326",
      xpPerHour: "37,421",
      gpPerKill: "89",
      gpPerHour: "28,904",
      netGpPerHour: "-320,994"
    },
    rangedCannonResults: {
      DPS: "2.24",
      "MAX HIT": "10.0",
      "HIT %": "80.7%",
      "XP/HR": "37,421",
      "GP/HR NET": "-320,994",
      "KILLS/HR": "326",
      "GP/KILL": "89",
      "SUPPLY/KILL": "1,929"
    },
    magicSafespot: {
      hit: "35.7%",
      max: "20.0",
      dps: "1.19",
      ttk: "1:33",
      killsPerHour: "37",
      xpPerHour: "21,210",
      gpPerKill: "6,264",
      gpPerHour: "233,556",
      netGpPerHour: "-431,266"
    },
    magicSafespotResults: {
      DPS: "1.19",
      "MAX HIT": "20.0",
      "HIT %": "35.7%",
      "XP/HR": "21,210",
      "GP/HR NET": "-431,266",
      "KILLS/HR": "37",
      "GP/KILL": "6,264",
      "SUPPLY/KILL": "35,981"
    },
    customLootSettings: {
      hit: "72.4%",
      max: "22.9",
      dps: "1.97",
      ttk: "40.9s",
      killsPerHour: "67",
      xpPerHour: "8,443",
      gpPerKill: "6,004",
      gpPerHour: "404,685",
      netGpPerHour: "53,064"
    },
    customLootSettingsResults: {
      DPS: "1.97",
      "MAX HIT": "22.9",
      "HIT %": "72.4%",
      "XP/HR": "8,443",
      "GP/HR NET": "53,064",
      "KILLS/HR": "67",
      "GP/KILL": "6,004",
      "SUPPLY/KILL": "4,118"
    }
  });
});

test("enables cannon for the selected monster and shows cannon rates", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("TYPE", { exact: true }).selectOption("ranged");
  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Cannon" }).click();

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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Compare" }).click();
  await expect(page.getByLabel("Simulation results")).toContainText("SUPPLY/KILL");
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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Cannon" }).click();
  const reloadedCannon = page.locator('section[aria-label="Cannon"]');
  await expect(page.getByLabel("Monster", { exact: true })).toHaveValue("dagannoth");
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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();

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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();
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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const summary = page.locator('[aria-label="Trip summary"]');
  await expect(page.getByLabel("Monster", { exact: true })).toHaveValue("firegiant");
  await expect(trip.getByLabel("Recoil rings")).toBeEnabled();

  await trip.getByLabel("Food mode").selectOption("manual");
  await trip.getByLabel("Food count").fill("4");
  await trip.getByLabel("F/KL override").selectOption("on");
  await trip.getByLabel("Food/kill").fill("0.5");
  await trip.getByLabel("Recoil rings").fill("6");

  await expect(summary).toContainText("Food count");
  await expect(summary).toContainText("Auto food");
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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();
  const reloadedTrip = page.locator('section[aria-label="Trip assumptions"]');
  await expect(reloadedTrip.getByLabel("Food mode")).toHaveValue("manual");
  await expect(reloadedTrip.getByLabel("Food count")).toHaveValue("4");
  await expect(reloadedTrip.getByLabel("F/KL override")).toHaveValue("on");
  await expect(reloadedTrip.getByLabel("Food/kill")).toHaveValue("0.5");
  await expect(reloadedTrip.getByLabel("Recoil rings")).toHaveValue("6");
});

test("updates trip food, banking and inventory reserve controls across styles", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await tabs.getByRole("button", { name: "Trip" }).click();
  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const summary = page.locator('[aria-label="Trip summary"]');

  await expect(trip.getByLabel("Food", { exact: true })).toHaveValue("lobster");
  await expect(trip.getByLabel("Bank time")).toHaveValue("auto");
  await expect(trip.getByLabel("Bank sec")).toBeDisabled();
  await expect(trip.getByLabel("Recover ammo")).toBeDisabled();
  await expect(trip.getByLabel("DBA restore")).toBeDisabled();
  await expect(trip.getByLabel("Rune slots")).toBeDisabled();

  await trip.getByLabel("Food", { exact: true }).selectOption("swordfish");
  await trip.getByLabel("Bank time").selectOption("manual");
  await expect(trip.getByLabel("Bank sec")).toBeEnabled();
  await trip.getByLabel("Bank sec").fill("120");
  await trip.getByLabel("Teleport item").uncheck();

  await expect(summary).toContainText("Swordfish");
  await expect(summary).toContainText("Manual 120s");
  await expect(summary).toContainText("Teleport");
  await expect(summary).toContainText("Off");

  await tabs.getByRole("button", { name: "Ranged" }).click();
  await tabs.getByRole("button", { name: "Trip" }).click();
  await expect(trip.getByLabel("Recover ammo")).toBeEnabled();
  await trip.getByLabel("Recover ammo").uncheck();
  await expect(summary).toContainText("Ammo recovery");

  await tabs.getByRole("button", { name: "Melee" }).click();
  await page.getByLabel("Boost", { exact: true }).selectOption("dba_spec");
  await tabs.getByRole("button", { name: "Trip" }).click();
  await expect(trip.getByLabel("DBA restore")).toBeEnabled();
  await trip.getByLabel("DBA restore").uncheck();
  await expect(summary).toContainText("DBA restore");

  await tabs.getByRole("button", { name: "Magic" }).click();
  await tabs.getByRole("button", { name: "Trip" }).click();
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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();
  const reloadedTrip = page.locator('section[aria-label="Trip assumptions"]');
  await expect(reloadedTrip.getByLabel("Food", { exact: true })).toHaveValue("swordfish");
  await expect(reloadedTrip.getByLabel("Bank time")).toHaveValue("manual");
  await expect(reloadedTrip.getByLabel("Bank sec")).toHaveValue("120");
  await expect(reloadedTrip.getByLabel("Teleport item")).not.toBeChecked();

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Ranged" }).click();
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();
  await expect(reloadedTrip.getByLabel("Recover ammo")).toBeEnabled();
  await expect(reloadedTrip.getByLabel("Recover ammo")).not.toBeChecked();

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Melee" }).click();
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();
  await expect(reloadedTrip.getByLabel("DBA restore")).toBeEnabled();
  await expect(reloadedTrip.getByLabel("DBA restore")).not.toBeChecked();

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Magic" }).click();
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();
  await expect(reloadedTrip.getByLabel("Rune slots")).toBeEnabled();
  await expect(reloadedTrip.getByLabel("Rune slots")).toHaveValue("4");
});

test("updates trip potion carry controls and grouped potion summary", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("button", { name: "Melee" }).click();
  await page.getByLabel("Boost", { exact: true }).selectOption("super_att");
  await tabs.getByRole("button", { name: "Trip" }).click();

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const summary = page.locator('[aria-label="Trip summary"]');
  const recommendation = trip.getByLabel("Potion recommendation");

  await expect(trip.getByLabel("Single-dose")).not.toBeChecked();
  await expect(trip.getByLabel("Potion vials")).toBeEnabled();
  await expect(trip.getByLabel("Potion doses")).toBeDisabled();
  await expect(recommendation).toContainText("Potion recommendation");
  await expect(recommendation).toContainText("Recommended carry");
  await expect(recommendation).toContainText("Matches recommendation");
  await trip.getByLabel("Potion vials").fill("0");
  await expect(recommendation).toContainText("Apply recommendation");
  await recommendation.getByRole("button", { name: "Apply recommendation" }).click();
  await expect(trip.getByLabel("Potion vials")).toHaveValue("1");
  await expect(recommendation).toContainText("Matches recommendation");
  await trip.getByLabel("Potion vials").fill("2");

  await expect(summary).toContainText("Potion slots");
  await expect(summary).toContainText("Potion carry");
  await expect(summary).toContainText("2 vials/type");
  await expect(summary).toContainText("Potion parts");

  await trip.getByLabel("Single-dose").check();
  await expect(trip.getByLabel("Potion vials")).toBeDisabled();
  await expect(trip.getByLabel("Potion doses")).toBeEnabled();
  await expect(recommendation).toContainText("Apply recommendation");
  await recommendation.getByRole("button", { name: "Apply recommendation" }).click();
  await expect(trip.getByLabel("Potion doses")).toHaveValue("1");
  await expect(recommendation).toContainText("Matches recommendation");
  await trip.getByLabel("Potion doses").fill("6");
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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();
  const reloadedTrip = page.locator('section[aria-label="Trip assumptions"]');
  await expect(reloadedTrip.getByLabel("Single-dose")).toBeChecked();
  await expect(reloadedTrip.getByLabel("Potion vials")).toBeDisabled();
  await expect(reloadedTrip.getByLabel("Potion doses")).toHaveValue("6");
  await expect(page.locator('[aria-label="Potion slots trip summary"]')).toContainText(
    "6 doses/type"
  );
});

test("updates prayer restore detail controls and keeps the trip summary visible", async ({
  page
}) => {
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const summary = page.locator('[aria-label="Trip summary"]');

  await expect(trip.getByLabel("Prayer mode")).toHaveValue("potions");
  await expect(summary).toContainText("Prayer/kill");

  await trip.getByLabel("Prayer restore").selectOption("manual_doses");
  await expect(trip.getByLabel("Prayer doses")).toBeEnabled();
  await trip.getByLabel("Prayer doses").fill("8");
  await expect(summary).toContainText("Manual doses");
  await expect(summary).toContainText("Prayer slots");
  await expect(summary).toContainText("Max kills prayer");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"prayerPotionDoses":8') && saved.includes('"prayerPotionSets":null');
  });

  await trip.getByLabel("Prayer restore").selectOption("manual_vials");
  await expect(trip.getByLabel("Prayer vials")).toBeEnabled();
  await trip.getByLabel("Prayer vials").fill("3");
  await expect(summary).toContainText("Manual vials");
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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();
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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Loot" }).click();

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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Loot" }).click();
  const reloadedLoot = page.locator('section[aria-label="Current monster loot"]');
  await expect(reloadedLoot.getByLabel("High alch")).toHaveValue("enabled");
  await expect(reloadedLoot.getByLabel("Overhead", { exact: true })).toHaveValue("manual");
  await expect(reloadedLoot.getByLabel("Overhead sec")).toHaveValue("12.5");
  await expect(reloadedLoot.getByLabel("Talisman spot")).toHaveValue("overground");
});

test("updates current monster loot actions, reset and optimize", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Loot" }).click();

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

  await loot.getByRole("button", { name: "Optimize net GP/hr" }).click();
  await expect(loot.locator(".loot-status")).toContainText("Optimized");
  await expect(page.locator('[aria-label="Loot action summary"]')).toBeVisible();
});

test("shows loot value composition, nested detail and action impact detail", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("firegiant");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Loot" }).click();

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
  await expect(page.getByLabel("Local price history for Big bones")).toContainText(
    "No local history"
  );

  await page.getByLabel(/Action for Big bones/).first().selectOption("loot");
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
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await tabs.getByRole("button", { name: "Loot" }).click();
  const drops = page.getByRole("table", { name: "Current monster drops" });
  await expect.poll(async () => drops.locator("tbody tr").count()).toBeGreaterThan(8);
  await page.getByLabel(/Action for Big bones/).first().selectOption("loot");
  await tabs.getByRole("button", { name: "Compare" }).click();
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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Trip" }).click();

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  await expect(page.getByLabel("Monster", { exact: true })).toHaveValue("firegiant");
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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Compare" }).click();
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
      "GP/HR NET": "-48,956",
      "KILLS/HR": "235",
      "GP/KILL": "869",
      "SUPPLY/KILL": "1,187"
    },
    tripSummary: {
      "Prayer/kill": "29.21",
      "Prayer slots": "2",
      "Max kills prayer": "6.1",
      "Food count": "4",
      "Food/kill": "0.50",
      "Kills/trip": "6.1",
      "Effective K/hr": "45",
      "Recoil/kill": "4.5 dmg",
      "Recoil gp/kill": "168"
    },
    tripManual: {
      DPS: "2.59",
      "MAX HIT": "16.4",
      "HIT %": "75.5%",
      "XP/HR": "20,093",
      "GP/HR NET": "-88,872",
      "KILLS/HR": "80",
      "GP/KILL": "1,624",
      "SUPPLY/KILL": "3,587"
    }
  });
});

test("matches browser-rendered numeric snapshots for imported price sets", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Settings" }).click();
  const settings = page.locator('[aria-label="Price data settings"]');
  const priceSetSummary = settings.locator('[aria-label="Active PriceSet summary"]');
  await expect(settings).toContainText("Price data");
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
  await expect(priceSetSummary).toContainText("Alch values 2");
  await expect(priceSetSummary).toContainText("Status Imported price set");
  await expect(settings).toContainText("Imported price set: Imported fixture prices");
  await expect(page.locator(".topbar")).toContainText("Imported fixture prices");

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Compare" }).click();
  await expect(page.locator('[aria-label="Result price warnings"]')).toContainText(
    "Price warnings"
  );
  await expect(page.locator('[aria-label="Result price warnings"]')).toContainText(
    "using fallback"
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
      "GP/HR NET": "-121,783",
      "KILLS/HR": "235",
      "GP/KILL": "393",
      "SUPPLY/KILL": "1,184"
    }
  });

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Loot" }).click();
  await expect(page.locator('[aria-label="Loot price warnings"]')).toContainText(
    "Price warnings"
  );

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Economy" }).click();
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
    expect(url.searchParams.get("player")).toBe("Fixture Player");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        player: "Fixture Player",
        normalizedPlayer: "Fixture Player",
        source: { id: "mock-hiscores", label: "Mock hiscores" },
        fetchedAt: "2026-07-05T12:00:00.000Z",
        skills: {
          attack: { level: 61 },
          strength: { level: 64 },
          defence: { level: 55 },
          hitpoints: { level: 63 },
          prayer: { level: 43 },
          ranged: { level: 50 },
          magic: { level: 57 }
        },
        warnings: []
      })
    });
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Lookup" })).toBeEnabled();
  await page.getByLabel("Player", { exact: true }).fill("Fixture Player");
  await page.getByRole("button", { name: "Lookup" }).click();
  await expect(page.getByRole("table", { name: "Hiscores preview" })).toContainText("hitpoints");
  await page.getByRole("button", { name: "Apply" }).click();

  const setup = page.getByLabel("Combat setup");
  await expect(setup.getByLabel("ATT", { exact: true })).toHaveValue("61");
  await expect(setup.getByLabel("STR", { exact: true })).toHaveValue("64");
  await expect(setup.getByLabel("DEF", { exact: true })).toHaveValue("55");
});

test("syncs market prices through the same-origin API and shows the report", async ({ page }) => {
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
    const body = JSON.parse(route.request().postData() ?? "{}");
    expect(body).toEqual({
      scope: "monster",
      monsterId: "giant",
      includeAlch: true
    });
    expect(JSON.stringify(body)).not.toContain("http");
    expect(JSON.stringify(body)).not.toContain("sourceSlug");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        priceSet: {
          id: "mock-market-sync",
          label: "Mock market sync",
          source: "scraped",
          createdAt: "2026-07-05T12:00:05.000Z",
          itemPrices: { big_bones: 430, lobster: 210 },
          alchValues: { big_bones: 0, lobster: 0 },
          provenance: {
            source: "scraped",
            sourceRef: "markets.lostcity.rs"
          }
        },
        report: {
          requested: 2,
          updated: 1,
          skipped: 0,
          failed: 1,
          startedAt: "2026-07-05T12:00:00.000Z",
          finishedAt: "2026-07-05T12:00:05.000Z",
          source: {
            id: "markets.lostcity.rs",
            label: "Mock LostCity market",
            origin: "https://markets.lostcity.rs"
          },
          items: [
            {
              itemId: "big_bones",
              sourceSlug: "big_bones",
              status: "updated",
              price: 430,
              alchValue: 0,
              sampleSize: 3
            },
            {
              itemId: "lobster",
              sourceSlug: "lobster",
              status: "failed",
              reason: "Mock upstream timeout"
            }
          ],
          warnings: [
            {
              code: "partial-market-sync",
              severity: "warning",
              message: "One mocked item failed; successful prices remain usable",
              itemId: "lobster"
            }
          ]
        }
      })
    });
  });

  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Economy" }).click();
  await expect(page.getByRole("button", { name: "Sync monster" })).toBeEnabled();
  await page.getByRole("button", { name: "Sync monster" }).click();

  await expect(page.getByLabel("Market sync report")).toContainText("Mock LostCity market");
  await expect(page.getByLabel("Market sync report")).toContainText("Updated 1");
  await expect(page.getByLabel("Market sync report")).toContainText("Failed 1");
  await expect(page.locator(".topbar").getByText("Mock market sync")).toBeVisible();
  await expect(page.getByLabel("Price history summary")).toContainText("Snapshots 1");
  await expect(page.getByLabel("Price history summary")).toContainText("Items 2");
  await expect(page.getByLabel("Price history summary")).toContainText("Active Mock market sync");
  await expect(page.getByLabel("Price history summary")).toContainText(
    "Latest Mock market sync active"
  );

  const persistedHistory = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("index-sim:price-history") ?? "null")
  );
  expect(persistedHistory).toMatchObject({
    version: 1,
    data: {
      snapshots: [
        {
          sourcePriceSetId: "mock-market-sync",
          label: "Mock market sync",
          itemPrices: { big_bones: 430, lobster: 210 }
        }
      ]
    }
  });
  expect(JSON.stringify(persistedHistory)).not.toContain("sourceSlug");
  expect(JSON.stringify(persistedHistory)).not.toContain("https://markets.lostcity.rs");

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Compare" }).click();
  const mockedMarketSync = await resultMetricSnapshot(page);
  expect({
    mockedMarketSync
  }).toEqual({
    mockedMarketSync: {
      DPS: "3.05",
      "MAX HIT": "16.4",
      "HIT %": "88.9%",
      "XP/HR": "21,573",
      "GP/HR NET": "-122,212",
      "KILLS/HR": "235",
      "GP/KILL": "393",
      "SUPPLY/KILL": "1,186"
    }
  });
});

test("analyzes and manages browser-local price history in Economy", async ({ page }) => {
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
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Economy" }).click();

  await expect(page.getByLabel("Price history summary")).toContainText("Snapshots 3");
  await expect(page.getByLabel("Price history summary")).toContainText("Moved 2");
  await expect(page.getByLabel("Top gainers")).toContainText("Lobster");
  await expect(page.getByLabel("Top fallers")).toContainText("Big bones");
  await expect(page.getByRole("table", { name: "Price movers" })).toContainText("Lobster");
  await expect(page.getByRole("table", { name: "Price movers" })).toContainText("Big bones");

  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Loot" }).click();
  const bigBonesRow = page.getByRole("table", { name: "Current monster drops" }).getByRole("row", {
    name: /Big bones/
  });
  await bigBonesRow.locator("details").last().locator("summary").click();
  const localHistory = page.getByLabel("Local price history for Big bones");
  await expect(localHistory).toContainText("Tracked locally");
  await expect(localHistory).toContainText("350");
  await expect(localHistory).toContainText("500");
  await expect(localHistory).toContainText("-150");
  await page.getByLabel("Workbench tabs").getByRole("button", { name: "Economy" }).click();

  await page.getByLabel("Item filter").fill("bones");
  await expect(page.getByRole("table", { name: "Price movers" })).toContainText("Big bones");
  await expect(page.getByRole("table", { name: "Price movers" })).not.toContainText("Lobster");

  await page.getByLabel("Baseline").selectOption("first");
  await expect(page.getByLabel("Price history summary")).toContainText("First test prices");

  await page.getByRole("button", { name: "Snapshot now" }).click();
  await expect(page.getByLabel("Price history summary")).toContainText("Snapshots 4");
  const afterSnapshot = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("index-sim:price-history") ?? "null")
  );
  expect(afterSnapshot.data.snapshots).toHaveLength(4);

  await page.getByRole("button", { name: "Clear history" }).click();
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))
  ).not.toBe(null);
  await page.getByRole("button", { name: "Confirm clear history" }).click();
  await expect(page.getByLabel("Price history summary")).toContainText("Snapshots 0");
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    null
  );
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:unrelated-test"))).toBe(
    "keep-me"
  );
  await expect(page.locator(".topbar")).toContainText("Bundled");
});

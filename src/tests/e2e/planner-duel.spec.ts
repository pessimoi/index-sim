import {
  chooseSearchableOption,
  expect,
  expectPageWidthContained,
  expectSearchableSelection,
  selectCombatType,
  test
} from "./scaffold-fixture";

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

test("uses saved setup comparison to import export rename load delete and persist setups", async ({
  page
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await tabs.getByRole("tab", { name: "Setups" }).click();
  const duel = page.getByRole("region", { name: "Setup comparison", exact: true });
  await expect(duel).toBeVisible();
  await expect(duel.getByRole("heading", { name: "Setup comparison" })).toBeVisible();
  await expect(duel).not.toContainText("planned");
  await expect(duel.getByRole("table", { name: "Setup comparison table" })).toContainText("GP/XP");

  await duel.getByRole("button", { name: "Save current setup" }).click();
  const table = duel.getByRole("table", { name: "Setup comparison table" });
  await expect(table.getByRole("row", { name: /Live setup/ })).toBeVisible();
  await expect(table.getByLabel(/Rename saved setup/)).toHaveCount(1);
  await expect(table).toContainText("XP/hr");
  await expect(table).toContainText("Net GP/hr");
  await expect(table).toContainText("GP/XP");

  const rename = table.getByLabel(/Rename saved setup/).first();
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
  await duel.getByText("Manage saved setups", { exact: true }).click();
  await duel.getByRole("button", { name: "Export setups" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("index-sim-saved-setups.json");

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Setups" }).click();
  const reloadedDuel = page.getByRole("region", { name: "Setup comparison", exact: true });
  await expect(reloadedDuel).toBeVisible();
  let reloadedTable = reloadedDuel.getByRole("table", { name: "Setup comparison table" });
  await expect(reloadedTable.getByLabel("Rename saved setup Melee saved")).toBeVisible();

  await chooseSearchableOption(page.getByLabel("Setup context"), "Monster", "Rock Crab");
  const combatType = page.getByLabel("Combat type");
  await combatType.getByRole("button", { name: "ranged" }).click();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Setups" }).click();
  await expect(reloadedDuel).toBeVisible();
  reloadedTable = reloadedDuel.getByRole("table", { name: "Setup comparison table" });
  await expect(reloadedTable).toContainText("best", { timeout: 30000 });
  const reviewDiff = reloadedTable.getByRole("button", { name: "Review diff" });
  await reviewDiff.click();
  const hideDiff = reloadedTable.getByRole("button", { name: "Hide diff" });
  await expect(hideDiff).toHaveAttribute("aria-expanded", "true");
  await expect(hideDiff).toHaveAttribute("aria-controls", /^duel-diff-/);
  const setupDiff = reloadedTable.getByRole("region", {
    name: "Melee saved setup and impact diff"
  });
  await expect(setupDiff).toContainText("Saved setup compared with live");
  await expect(setupDiff).toContainText("Combat style");
  await expect(setupDiff).toContainText("Impact is saved setup minus live");
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
  await expect(reloadedTable).toContainText("No saved setups");
  const duelUndo = page.getByLabel("Local state undo");
  await expect(duelUndo).toContainText("Deleted saved setup: Melee saved");
  await duelUndo.getByRole("button", { name: "Undo" }).click();
  await expect(reloadedTable.getByLabel("Rename saved setup Melee saved")).toBeVisible();
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
  await expect(reloadedTable).toContainText("No saved setups");
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

  await reloadedDuel.getByText("Manage saved setups", { exact: true }).click();
  await reloadedDuel.getByLabel("Import setups").setInputFiles({
    name: "duel-snapshots.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportedSnapshotJson)
  });
  await expect(reloadedDuel.getByLabel("Saved setup import notice")).toContainText(
    "1 added, 0 updated"
  );
  await expect(reloadedTable.getByLabel("Rename saved setup Melee saved")).toBeVisible();
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

test("builds and filters the all-monster saved setup matrix on demand", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");

  await tabs.getByRole("tab", { name: "Setups" }).click();
  const duel = page.getByRole("region", { name: "Setup comparison", exact: true });
  await duel.getByRole("button", { name: "Save current setup" }).click();
  await selectCombatType(page, "ranged");
  await tabs.getByRole("tab", { name: "Setups" }).click();

  await expect(duel.getByRole("table", { name: "All-monster setup comparison" })).toHaveCount(0);
  await duel.getByRole("button", { name: "All monsters" }).click();
  const matrix = duel.getByRole("table", { name: "All-monster setup comparison" });
  await expect(matrix).toBeVisible({ timeout: 30_000 });
  await expect(matrix.locator("thead th")).toHaveCount(3);
  await expect.poll(async () => matrix.locator("tbody tr").count()).toBeGreaterThan(60);
  await expect(matrix.locator('tbody tr[aria-current="true"]')).toHaveCount(1);
  await expect(matrix.locator('td[aria-label*="XP/hr"]')).not.toHaveCount(0);
  await expect(matrix.locator("td.best")).not.toHaveCount(0);

  await duel.getByLabel("Setup comparison metric").getByRole("button", { name: "DPS" }).click();
  await expect(matrix.locator('td[aria-label*="DPS"]')).not.toHaveCount(0);
  await duel.getByLabel("Find monster in setup comparison").fill("tribesman");
  await expect(matrix.locator("tbody tr")).toHaveCount(1);
  await expect(matrix.getByRole("row", { name: /Tribesman/ })).toBeVisible();
  await expectPageWidthContained(page);
});

test("keeps Monsters, Planner and setup matrix calculations off the main event loop", async ({
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

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Setups" }).click();
  await page
    .getByRole("region", { name: "Setup comparison", exact: true })
    .getByRole("button", {
      name: "Save current setup"
    })
    .click();
  await page.evaluate(() => {
    (
      window as unknown as { calculationTaskProbe: { durations: number[] } }
    ).calculationTaskProbe.durations = [];
  });
  await page
    .getByRole("region", { name: "Setup comparison", exact: true })
    .getByRole("button", {
      name: "All monsters"
    })
    .click();
  await expect(page.getByRole("table", { name: "All-monster setup comparison" })).toBeVisible({
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

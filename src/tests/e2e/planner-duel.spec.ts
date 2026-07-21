import {
  chooseSearchableOption,
  expect,
  expectPageWidthContained,
  expectSearchableSelection,
  readDownloadText,
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
  await expect(planner.getByLabel("Planner DPS chart")).toBeVisible();
  await expect(planner.getByLabel("Planner gear timeline")).toBeVisible();
  await expect(planner.getByRole("table", { name: "Planner training order" })).toBeVisible();

  const gearPoolDisclosure = planner.locator("details.planner-gear-editor");
  const gearPoolSummary = gearPoolDisclosure.locator("summary");
  const gearPoolEditor = planner.getByLabel("Planner gear pool editor");
  await expect(gearPoolSummary).toHaveText("Advanced gear pool · 41/41");
  await expect(gearPoolEditor).toBeHidden();
  await gearPoolSummary.focus();
  await expect(gearPoolSummary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(gearPoolEditor).toBeVisible();
  await expect(gearPoolSummary).toBeFocused();
  const firstGearControl = gearPoolEditor
    .locator("button:not([disabled]), input:not([disabled])")
    .first();
  await page.keyboard.press("Tab");
  await expect(firstGearControl).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(gearPoolSummary).toBeFocused();
  await page.keyboard.press("Space");
  await expect(gearPoolEditor).toBeHidden();
  await expect(gearPoolSummary).toBeFocused();
  await gearPoolSummary.click();
  await expect(gearPoolEditor).toBeVisible();

  await planner.getByLabel("Avg over session").uncheck();
  await expect(planner.getByText("stale", { exact: true })).toBeVisible();
  await planner.getByLabel("Avg over session").check();
  await planner.getByLabel("Only current gear").check();
  await planner.getByLabel("Only current gear").uncheck();
  const ironScimitar = planner.getByLabel("Planner pool Iron scimitar");
  const weaponReset = ironScimitar
    .locator("xpath=ancestor::section[contains(@class, 'planner-gear-slot')]")
    .getByRole("button", { name: "Reset" });
  await ironScimitar.uncheck();
  await expect(gearPoolSummary).toHaveText("Advanced gear pool · 40/41");
  await expect(weaponReset).toBeEnabled();
  await weaponReset.click();
  await expect(ironScimitar).toBeChecked();
  await expect(gearPoolSummary).toHaveText("Advanced gear pool · 41/41");
  await expect(weaponReset).toBeDisabled();
  await ironScimitar.uncheck();
  await expect(gearPoolSummary).toHaveText("Advanced gear pool · 40/41");
  await planner.getByLabel("Optimize metric").selectOption("dps");
  await planner.getByLabel("Strength current XP").fill("274000");
  await planner.getByLabel("Strength target").fill("63");
  await planner.getByLabel("Lock Attack").check();
  await expect(planner.getByText("stale", { exact: true })).toBeVisible();

  await gearPoolSummary.click();
  await expect(gearPoolEditor).toBeHidden();
  const recompute = planner.getByRole("button", { name: "Recompute plan" });
  await recompute.focus();
  await recompute.press("Enter");
  await expect(recompute).toBeFocused();
  await expect(planner.getByText("ready")).toBeVisible();
  await expect(gearPoolEditor).toBeHidden();
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

  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Planner" }).click();
  await expect(gearPoolSummary).toHaveText("Advanced gear pool · 40/41");
  await expect(gearPoolEditor).toBeHidden();
  await expect(ironScimitar).not.toBeChecked();
  await gearPoolSummary.click();
  await expect(gearPoolEditor).toBeVisible();
  await expect(ironScimitar).not.toBeChecked();
  await expectPageWidthContained(page);
});

test("shows complete actionable Planner notices without mutating their owners", async ({
  page
}) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("black_dragon");

  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("tab", { name: "Planner" }).click();
  const planner = page.getByRole("region", { name: "Planner", exact: true });
  await planner.getByLabel("Only current gear").check();
  await planner.getByLabel("Attack target").fill("99");
  await planner.getByLabel("Strength target").fill("99");
  await planner.getByLabel("Defence target").fill("99");
  await planner.getByRole("button", { name: "Recompute plan" }).click();
  await expect(planner.getByText("ready", { exact: true })).toBeVisible({ timeout: 90_000 });

  const disclosure = planner.locator("details.planner-notices");
  const summary = disclosure.locator(":scope > summary");
  const rows = disclosure.locator("li.planner-notice-row");
  await expect(disclosure).toHaveAttribute("open", "");
  await expect.poll(() => rows.count()).toBeGreaterThan(5);
  const categories = await rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-notice-category"))
  );
  expect(new Set(categories)).toEqual(new Set(["plan-limit", "price-data", "trip-model"]));
  await expect(disclosure).toContainText("Plan stopped at its level limit");
  await expect(disclosure).toContainText("Incoming damage uses a compatibility model");
  await expect(disclosure).toContainText(/Estimated price|Previous price retained/);
  await expect(disclosure).toContainText("more occurrences");

  const summaryText = (await summary.textContent()) ?? "";
  const counts = summaryText.match(/(\d+) issues? · (\d+) notes?/);
  expect(counts).not.toBeNull();
  expect(Number(counts![1]) + Number(counts![2])).toBe(await rows.count());

  await summary.focus();
  await page.keyboard.press("Space");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");

  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:planner-ui") ?? "";
    return (
      raw.includes('"attack":99') &&
      raw.includes('"strength":99') &&
      raw.includes('"defence":99') &&
      raw.includes('"onlyCurrentGear":true')
    );
  });
  const storageBeforeActions = await page.evaluate(() =>
    JSON.stringify(
      Object.keys(window.localStorage)
        .sort()
        .map((key) => [key, window.localStorage.getItem(key)])
    )
  );
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);

  await disclosure.getByRole("button", { name: /^Review targets:/ }).click();
  await expect(planner.getByLabel("Planner skill targets")).toBeFocused();
  await expect(planner.getByLabel("Attack target")).toHaveValue("99");
  await expect(planner.getByText("ready", { exact: true })).toBeVisible();

  await disclosure.getByRole("button", { name: /^Review Trip assumptions:/ }).click();
  await expect(tabs.getByRole("tab", { name: "Trip" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Food per kill override")).toBeFocused();
  await tabs.getByRole("tab", { name: "Planner" }).click();

  await disclosure
    .getByRole("button", { name: /^Review price data:/ })
    .first()
    .click();
  await expect(tabs.getByRole("tab", { name: "Economy" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Selected item price provenance")).toBeFocused();
  await tabs.getByRole("tab", { name: "Planner" }).click();

  expect(
    await page.evaluate(() =>
      JSON.stringify(
        Object.keys(window.localStorage)
          .sort()
          .map((key) => [key, window.localStorage.getItem(key)])
      )
    )
  ).toBe(storageBeforeActions);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);

  const retainedSetId = await disclosure.getAttribute("data-warning-set-id");
  await summary.click();
  await expect(disclosure).not.toHaveAttribute("open", "");
  await planner.getByLabel("Attack target").fill("98");
  await expect(planner.getByLabel("Previous plan notices")).toBeVisible();
  await expect(disclosure).toHaveAttribute("data-warning-set-id", retainedSetId!);
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(planner.getByLabel("Attack target")).toHaveValue("98");

  await summary.click();
  await expect(disclosure).toHaveAttribute("open", "");
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 640, height: 360 },
    { width: 390, height: 844 },
    { width: 620, height: 844 },
    { width: 768, height: 1024 }
  ]) {
    await page.setViewportSize(viewport);
    await expectPageWidthContained(page);
  }
});

test("keeps Planner Auto XP and effective targets aligned with live levels", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("tab", { name: "Setups" }).click();
  const setups = page.getByRole("region", { name: "Setup comparison", exact: true });
  await setups.getByRole("button", { name: "Save current setup" }).click();
  await tabs.getByRole("tab", { name: "Planner" }).click();
  const planner = page.getByRole("region", { name: "Planner", exact: true });
  const player = page.getByRole("region", { name: "Player setup", exact: true });
  const attackXp = planner.getByLabel("Attack current XP");
  const attackTarget = planner.getByLabel("Attack target");

  await expect(planner.getByText("ready")).toBeVisible({ timeout: 30_000 });
  await expect(attackXp).toHaveValue("");
  await expect(attackXp).toHaveAttribute("placeholder", /^Auto: \d+$/);
  await expect(planner).toContainText("the level 60 floor");

  const attackFloor = Number((await attackXp.getAttribute("placeholder"))?.replace("Auto: ", ""));
  await attackXp.fill(String(attackFloor + 10));
  await attackTarget.fill("65");
  await expect(planner).toContainText(
    "Planner inputs changed. This plan uses the last recomputed inputs."
  );

  await player.getByLabel("ATT", { exact: true }).fill("66");
  await expect(attackXp).toHaveValue("");
  await expect(attackTarget).toHaveValue("66");
  await expect(planner).toContainText("Attack XP uses Auto");
  await expect(planner).toContainText("Attack target is now 66");
  await expect(planner).toContainText("the level 66 floor");

  await attackTarget.fill("70");
  await planner.getByLabel("Lock Attack").check();
  await player.getByLabel("ATT", { exact: true }).fill("71");
  await expect(attackTarget).toBeDisabled();
  await expect(attackTarget).toHaveValue("71");
  await expect(planner).toContainText("Locked at current level 71; saved target 70 is not used.");
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:planner-ui");
    return raw !== null && JSON.parse(raw).data.targetLevels.attack === 70;
  });

  await planner.getByLabel("Lock Attack").uncheck();
  await expect(attackTarget).toBeEnabled();
  await expect(attackTarget).toHaveValue("71");
  await expect(planner).toContainText("Attack target is now 71");

  const nextAttackFloor = Number(
    (await attackXp.getAttribute("placeholder"))?.replace("Auto: ", "")
  );
  await attackXp.fill(String(nextAttackFloor + 10));
  await attackXp.locator("xpath=following-sibling::button").click();
  await expect(attackXp).toHaveValue("");
  await planner.getByRole("button", { name: "Recompute plan" }).click();
  await expect(planner.getByText("ready")).toBeVisible({ timeout: 30_000 });
  await expect(planner).not.toContainText(
    "Planner inputs changed. This plan uses the last recomputed inputs."
  );

  await tabs.getByRole("tab", { name: "Setups" }).click();
  await setups.getByRole("button", { name: /^Load saved setup / }).click();
  await expect(player.getByLabel("ATT", { exact: true })).toHaveValue("60");
  await tabs.getByRole("tab", { name: "Planner" }).click();
  await expect(attackXp).toHaveValue("");
  await expect(attackTarget).toHaveValue("71");
  await expect(planner).toContainText("the level 60 floor");
  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await expect(player.getByLabel("ATT", { exact: true })).toHaveValue("71");
  await expect(attackXp).toHaveValue("");
  await expect(attackTarget).toHaveValue("71");
  await expect(planner).toContainText("the level 71 floor");

  await selectCombatType(page, "magic");
  await player.getByLabel("MAG", { exact: true }).fill("99");
  await tabs.getByRole("tab", { name: "Planner" }).click();
  const magicXp = planner.getByLabel("Magic current XP");
  const magicTarget = planner.getByLabel("Magic target");
  await expect(magicTarget).toBeDisabled();
  await expect(magicTarget).toHaveValue("99");
  await expect(planner).toContainText("Already at maximum target level 99.");
  await magicXp.fill("200000000");
  await expect(magicXp).toHaveValue("200000000");

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Planner" }).click();
  const reloadedPlanner = page.getByRole("region", { name: "Planner", exact: true });
  await expect(reloadedPlanner.getByLabel("Attack current XP")).toHaveValue("");
  await expect(reloadedPlanner.getByLabel("Attack target")).toHaveValue("71");
  await expect(reloadedPlanner.getByLabel("Magic current XP")).toHaveValue("200000000");
  await expect(reloadedPlanner.getByLabel("Magic target")).toBeDisabled();
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
  await expect(table).toContainText("EFF. XP/HR");
  await expect(table).toContainText("EFF. NET GP/HR");
  await expect(table).toContainText("EFF. K/HR");
  await expect(table).toContainText("GP/XP");

  const rename = table.getByLabel(/Rename saved setup/).first();
  await rename.click();
  const renameInput = table.getByLabel(/New name for saved setup/);
  await renameInput.fill("Melee saved");
  await renameInput.blur();
  await expect(table.getByLabel(/New name for saved setup/)).toHaveValue("Melee saved");
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() =>
        window.localStorage.getItem("index-sim:duel-snapshots")
      );
      return raw ? JSON.parse(raw).data?.snapshots?.[0]?.name : null;
    })
    .not.toBe("Melee saved");
  await renameInput.press("Enter");
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
  const setupHeader = table.getByRole("columnheader", { name: "Sort by Setup", exact: true });
  await setupHeader.getByRole("button", { name: "Sort by Setup", exact: true }).click();
  await expect(setupHeader).toHaveAttribute("aria-sort", "ascending");
  await setupHeader.getByRole("button", { name: "Sort by Setup", exact: true }).click();
  await expect(setupHeader).toHaveAttribute("aria-sort", "descending");
  await expect(
    table.locator("tbody > tr").first().getByLabel("Rename saved setup Melee saved")
  ).toBeVisible();
  const xpHeader = table.getByRole("columnheader", {
    name: "Sort by Effective experience points per hour",
    exact: true
  });
  await xpHeader
    .getByRole("button", { name: "Sort by Effective experience points per hour", exact: true })
    .click();
  await expect(xpHeader).toHaveAttribute("aria-sort", "descending");
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
  const exportSetupsButton = duel.getByRole("button", {
    name: "Export saved setup collection"
  });
  await exportSetupsButton.focus();
  await exportSetupsButton.press("Enter");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^2004scape-saved-setup-collection-rev-274-\d{8}T\d{6}Z\.json$/
  );
  await expect(duel.getByLabel("Saved setup transfer notice")).toHaveText(
    `Saved setup collection download started: ${download.suggestedFilename()}. Check your browser downloads.`
  );
  await expect(exportSetupsButton).toBeFocused();
  const exportedFile = JSON.parse(await readDownloadText(download));
  expect(exportedFile).toMatchObject({
    kind: "index-sim-saved-setups",
    version: 1,
    context: {
      gameDataId: "lostcity-376072662e78-runtime",
      gameRevision: 274
    }
  });

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
  const reviewDiff = reloadedTable.getByRole("button", { name: /^Review differences for / });
  await reviewDiff.click();
  const hideDiff = reloadedTable.getByRole("button", { name: /^Hide differences for / });
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
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    if (!raw) return false;
    const setup = JSON.parse(raw).data;
    return setup?.form?.monsterId === "rock_crab" && setup?.form?.combatStyle === "ranged";
  });
  const setupBeforeSavedLoad = await page.evaluate(
    () => JSON.parse(window.localStorage.getItem("index-sim:rewrite-setup") ?? "null").data
  );
  await reloadedTable.getByRole("button", { name: "Load saved setup Melee saved" }).click();
  await expect(combatType.getByRole("button", { name: "melee" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expectSearchableSelection(page.getByLabel("Setup context"), "Monster", "rock_crab");
  await expect(reloadedTable.getByLabel("Rename saved setup Melee saved")).toBeVisible();
  const loadUndo = page.getByLabel("Local state undo");
  await expect(loadUndo).toContainText("Loaded saved setup: Melee saved");
  await loadUndo.getByRole("button", { name: "Undo" }).click();
  await expect(combatType.getByRole("button", { name: "ranged" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expectSearchableSelection(page.getByLabel("Setup context"), "Monster", "rock_crab");
  await expect(page.getByLabel("Local state undo")).toHaveCount(0);
  await page.waitForFunction((expectedSetup) => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    return raw != null && JSON.stringify(JSON.parse(raw).data) === JSON.stringify(expectedSetup);
  }, setupBeforeSavedLoad);

  await page.evaluate(() => window.localStorage.setItem("duel_unrelated_key", "keep"));
  await reloadedTable.getByRole("button", { name: "Delete saved setup Melee saved" }).click();
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

  await reloadedTable.getByRole("button", { name: "Delete saved setup Melee saved" }).click();
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
  await page.setViewportSize({ width: 390, height: 844 });
  await reloadedDuel.getByLabel("Review saved setup collection").setInputFiles({
    name: "contextual-duel-snapshots.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exportedFile))
  });
  const exactImportReview = reloadedDuel.getByLabel("Saved setup import review");
  await expect(exactImportReview).toContainText(
    "Created with this exact Revision 274 data snapshot."
  );
  await expectPageWidthContained(page);
  await expect(reloadedTable).toContainText("No saved setups");
  await exactImportReview.getByRole("button", { name: "Dismiss" }).click();
  await expect(reloadedTable).toContainText("No saved setups");

  await reloadedDuel.getByLabel("Review saved setup collection").setInputFiles({
    name: "duel-snapshots.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportedSnapshotJson)
  });
  const importReview = reloadedDuel.getByLabel("Saved setup import review");
  await expect(importReview).toBeVisible();
  await expect(importReview).toContainText("Setups in file1");
  await expect(importReview).toContainText("Add1");
  await expect(importReview).toContainText("Replace0");
  await expect(importReview).toContainText("older format does not record a game revision");
  await expect(reloadedTable).toContainText("No saved setups");
  await importReview.getByRole("button", { name: "Merge selected setups" }).click();
  await expect(reloadedDuel.getByLabel("Saved setup transfer notice")).toContainText(
    "using current Revision 274 data: 1 added, 0 replaced, 0 not selected"
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

test("reviews matching-ID setup replacements, refreshes stale plans and undoes exact storage", async ({
  page
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("tab", { name: "Setups" }).click();
  const duel = page.getByRole("region", { name: "Setup comparison", exact: true });
  await duel.getByRole("button", { name: "Save current setup" }).click();
  await duel.getByText("Manage saved setups", { exact: true }).click();

  const fixture = await page.evaluate(() => {
    const raw = window.localStorage.getItem("index-sim:duel-snapshots")!;
    const data = JSON.parse(raw).data;
    const replacement = structuredClone(data.snapshots[0]);
    replacement.name = "Imported replacement";
    replacement.form.levels.attack += 1;
    const addition = structuredClone(data.snapshots[0]);
    addition.id = "duel-import-addition";
    addition.name = "Imported addition";
    return {
      raw,
      replacement: JSON.stringify({
        version: 1,
        exportedAt: "2026-07-20T16:00:00.000Z",
        data: { snapshots: [replacement] }
      }),
      addition: JSON.stringify({
        version: 1,
        exportedAt: "2026-07-20T16:01:00.000Z",
        data: { snapshots: [addition] }
      })
    };
  });

  const importInput = duel.getByLabel("Review saved setup collection");
  await importInput.setInputFiles({
    name: "replacement.json",
    mimeType: "application/json",
    buffer: Buffer.from(fixture.replacement)
  });
  let review = duel.getByLabel("Saved setup import review");
  await expect(review.getByRole("heading", { name: "Review saved setups" })).toBeFocused();
  await expect(review).toContainText("Matching ID");
  await expect(review.getByRole("radio", { name: "Keep current setup" })).toBeChecked();
  await expect(review.getByRole("button", { name: "Merge selected setups" })).toBeDisabled();
  const sourceDiff = review.getByText(/Review source differences/);
  await sourceDiff.click();
  await expect(review).toContainText("stored setup fields only; no calculated impact is inferred");
  await expect(review).toContainText("Attack");

  await review.getByRole("radio", { name: "Replace with imported setup" }).check();
  await expect(review.getByLabel("Saved name")).toHaveValue("Imported replacement");
  await expect(review.getByRole("button", { name: "Merge selected setups" })).toBeEnabled();
  await review.getByRole("button", { name: "Merge selected setups" }).click();
  await expect(duel.getByLabel("Rename saved setup Imported replacement")).toBeVisible();
  await expect(page.getByLabel("Local state undo")).toContainText("Merged saved setups");
  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await expect(duel.getByLabel(/Rename saved setup Rune scimitar/)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("index-sim:duel-snapshots")))
    .toBe(fixture.raw);

  await importInput.setInputFiles({
    name: "addition.json",
    mimeType: "application/json",
    buffer: Buffer.from(fixture.addition)
  });
  review = duel.getByLabel("Saved setup import review");
  await expect(review.getByRole("checkbox", { name: "Add this setup" })).toBeChecked();
  await duel.getByRole("button", { name: "Save current setup" }).click();
  await expect(review).toContainText("Refresh required");
  await expect(review.getByRole("button", { name: "Merge selected setups" })).toBeDisabled();
  await review.getByRole("button", { name: "Refresh review" }).click();
  await expect(review.getByRole("heading", { name: "Review saved setups" })).toBeFocused();
  await expect(review.getByRole("checkbox", { name: "Add this setup" })).toBeChecked();
  await expect(review.getByRole("button", { name: "Merge selected setups" })).toBeEnabled();

  await page.setViewportSize({ width: 390, height: 844 });
  await expectPageWidthContained(page);
  await review.getByRole("button", { name: "Dismiss" }).click();
  await expect(importInput).toBeFocused();
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
  await expect(
    matrix.locator('td[aria-label*="Effective experience points per hour"]')
  ).not.toHaveCount(0);
  await expect(matrix.locator("td.best")).not.toHaveCount(0);

  await duel
    .getByLabel("Setup comparison metric")
    .getByRole("button", { name: "Damage per second" })
    .click();
  await expect(matrix.locator('td[aria-label*="Damage per second"]')).not.toHaveCount(0);
  const liveSetupHeader = matrix.getByRole("columnheader", { name: /Live setup/ }).first();
  await liveSetupHeader.getByRole("button", { name: /Live setup/ }).click();
  await expect(liveSetupHeader).toHaveAttribute("aria-sort", "descending");
  const monsterHeader = matrix.getByRole("columnheader", { name: "Monster", exact: true });
  await monsterHeader.getByRole("button", { name: "Monster", exact: true }).click();
  await expect(monsterHeader).toHaveAttribute("aria-sort", "ascending");
  const monsterNames = await matrix.locator("tbody th strong").allTextContents();
  expect(monsterNames).toEqual(
    [...monsterNames].sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
    )
  );
  await duel.getByLabel("Find monster in setup comparison").fill("tribesman");
  await expect(matrix.locator("tbody tr")).toHaveCount(1);
  await expect(matrix.getByRole("row", { name: /Tribesman/ })).toBeVisible();
  await expectPageWidthContained(page);
});

test("keeps Duel matrix failures recoverable without exposing worker details", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const browserWindow = window as unknown as { failNextDuelMatrix: boolean };
    browserWindow.failNextDuelMatrix = true;
    const postMessage = Worker.prototype.postMessage as (this: Worker, message: unknown) => void;
    Worker.prototype.postMessage = function (message: unknown): void {
      if (
        browserWindow.failNextDuelMatrix &&
        typeof message === "object" &&
        message !== null &&
        "kind" in message &&
        message.kind === "duel-matrix"
      ) {
        browserWindow.failNextDuelMatrix = false;
        queueMicrotask(() => {
          this.onerror?.call(
            this,
            new ErrorEvent("error", { message: "private worker path /Users/example" })
          );
        });
        return;
      }
      postMessage.call(this, message);
    };
  });
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("tab", { name: "Setups" }).click();
  const duel = page.getByRole("region", { name: "Setup comparison", exact: true });
  await duel.getByRole("button", { name: "Save current setup" }).click();

  await duel.getByRole("button", { name: "All monsters" }).click();
  await expect(duel.getByRole("alert")).toHaveText(
    "Comparison could not be built. Your inputs are unchanged."
  );
  await expect(duel.getByRole("button", { name: "Retry comparison" })).toBeEnabled();
  await expect(duel.getByRole("table", { name: /all-monster setup comparison/i })).toHaveCount(0);
  await expect(duel).not.toContainText("private worker path");

  await duel.getByRole("button", { name: "Retry comparison" }).click();
  const currentMatrix = duel.getByRole("table", { name: "All-monster setup comparison" });
  await expect(currentMatrix).toBeVisible({ timeout: 30_000 });
  await expect(duel.getByText(/monsters - 2 setups/)).toBeVisible();

  await page.evaluate(() => {
    (window as unknown as { failNextDuelMatrix: boolean }).failNextDuelMatrix = true;
  });
  await duel.getByRole("button", { name: "Refresh comparison" }).click();
  await expect(duel.getByRole("alert")).toHaveText(
    "Comparison could not be built. Showing the previous result."
  );
  const previousMatrix = duel.getByRole("table", {
    name: "Previous all-monster setup comparison"
  });
  await expect(previousMatrix).toBeVisible();
  await expect(duel.getByRole("button", { name: "Retry comparison" })).toBeEnabled();
  await duel.getByLabel("Find monster in setup comparison").fill("tribesman");
  await expect(previousMatrix.locator("tbody tr")).toHaveCount(1);
  await expect(duel.getByRole("alert")).toBeVisible();
  await expect(duel).not.toContainText("private worker path");

  await page.setViewportSize({ width: 390, height: 844 });
  await expectPageWidthContained(page);
  await page
    .getByRole("region", { name: "Player setup", exact: true })
    .getByLabel("ATT")
    .fill("61");
  await expect(
    duel.getByText("Inputs changed. This table does not include the current inputs.")
  ).toBeVisible();
  await expect(duel.getByRole("alert")).toHaveCount(0);
  await duel.getByRole("button", { name: "Refresh comparison" }).click();
  await expect(duel.getByRole("table", { name: "All-monster setup comparison" })).toBeVisible({
    timeout: 30_000
  });
  await expect(duel.getByText(/monsters - 2 setups/)).toBeVisible();
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

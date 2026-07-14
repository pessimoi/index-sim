import {
  chooseSearchableOption,
  expect,
  expectAppStatus,
  expectSearchableSelection,
  searchableCombobox,
  searchableOptionLabels,
  selectCombatType,
  test
} from "./scaffold-fixture";

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

  await tabs.getByRole("tab", { name: "Monsters" }).click();
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
  const respectLevels = loadout.getByLabel("Respect current levels");
  const originalMonster = await monster.getAttribute("data-selected-id");
  const originalStyle = await style.inputValue();

  await expect(respectLevels).toBeChecked();
  await respectLevels.uncheck();
  await expect(respectLevels).not.toBeChecked();
  await respectLevels.check();

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
  await expectAppStatus(page, "Restored loadout for Hill Giant");
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

  await tabs.getByRole("tab", { name: "Monsters" }).click();
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
  await expect(specialDistribution).toContainText("Expected damage");
  await expect(
    specialDistribution.getByRole("list", { name: "Special attack damage distribution buckets" })
  ).not.toBeEmpty();
  await expect(
    page
      .getByRole("region", { name: "Source breakdown", exact: true })
      .getByRole("listitem", { name: /Special attack: modeled/i })
  ).toContainText("DPS gain");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Melee setup" }).click();
  const comparisonDistribution = page.getByRole("region", {
    name: "Damage distribution",
    exact: true
  });
  await expect(comparisonDistribution).toContainText("Special: Dragon dagger(p) (switch)");
  await expect(comparisonDistribution).toContainText("Expected / special");
  await expect(comparisonDistribution).toContainText("Special max");
  await expect(
    comparisonDistribution
      .getByRole("list", { name: "Damage distribution buckets" })
      .getByRole("listitem", { name: /^Miss; Normal exact:.*Special: Dragon dagger/i })
  ).toBeVisible();
  const comparisonOverflow = await comparisonDistribution
    .locator(".hit-chart-viewport")
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    }));
  expect(comparisonOverflow.scrollWidth).toBeGreaterThan(comparisonOverflow.clientWidth);
  const pageOverflow = await page.evaluate(() => ({
    clientWidth: document.body.clientWidth,
    scrollWidth: document.body.scrollWidth
  }));
  expect(pageOverflow.scrollWidth).toBeLessThanOrEqual(pageOverflow.clientWidth);
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

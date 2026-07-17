import {
  TRIP_NUMERIC_LABELS,
  chooseSearchableOption,
  expect,
  expectSearchableSelection,
  metricSnapshot,
  resultMetricSnapshot,
  selectCombatType,
  test
} from "./scaffold-fixture";

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
  await expect(output).toContainText("Cannon only DPS");
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
  await expect(cannon.getByText("respawn-bound", { exact: true })).toBeVisible();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Monsters" }).click();
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

test("sorts current monster drops from accessible column headings", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("firegiant");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();

  const table = page.getByRole("table", { name: "Current monster drops" });
  const rows = table.locator(":scope > tbody > tr");
  const evHeader = table.getByRole("columnheader", { name: "EV/kill" });
  await expect(evHeader).toHaveAttribute("aria-sort", "none");

  await evHeader.getByRole("button").click();
  await expect(evHeader).toHaveAttribute("aria-sort", "descending");
  const descendingEv = (await rows.locator(":scope > td:nth-child(5)").allTextContents()).map(
    (value) => Number(value.replaceAll(",", ""))
  );
  expect(descendingEv).toEqual([...descendingEv].sort((left, right) => right - left));

  await evHeader.getByRole("button").click();
  await expect(evHeader).toHaveAttribute("aria-sort", "ascending");
  const ascendingEv = (await rows.locator(":scope > td:nth-child(5)").allTextContents()).map(
    (value) => Number(value.replaceAll(",", ""))
  );
  expect(ascendingEv).toEqual([...ascendingEv].sort((left, right) => left - right));

  const dropHeader = table.getByRole("columnheader", { name: "Drop" });
  await dropHeader.getByRole("button").click();
  await expect(dropHeader).toHaveAttribute("aria-sort", "ascending");
  const dropNames = await rows.locator(":scope > td:first-child > span").allTextContents();
  expect(dropNames).toEqual(
    [...dropNames].sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })
    )
  );
});

test("shows source-backed conditional clue loot without allowing a value action", async ({
  page
}) => {
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("greater_demon");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();

  const loot = page.locator('section[aria-label="Current monster loot"]');
  const table = loot.getByRole("table", { name: "Current monster drops" });
  const disclosure = loot.locator("details.conditional-loot-group");
  await expect(table).not.toContainText("Clue scroll (hard)");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(disclosure.locator("summary")).toContainText("Conditional drops (1)");
  await disclosure.locator("summary").click();

  const conditionalTable = loot.getByRole("table", { name: "Conditional monster drops" });
  const row = conditionalTable.getByRole("row", { name: /Clue scroll \(hard\)/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Clue eligibility not modeled");
  await expect(row).toContainText("Skip (locked)");
  await expect(row).toContainText("0.78%");
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
  const nested = page.getByRole("table", { name: /Nested rows for Random herb/ });
  await expect(nested).toContainText("Ranarr");
  await expect(nested).toContainText("Weight");
  const priceHeader = nested.getByRole("columnheader", { name: "Price", exact: true });
  await priceHeader.getByRole("button", { name: "Price", exact: true }).click();
  await expect(priceHeader).toHaveAttribute("aria-sort", "descending");
  const prices = (await nested.locator("tbody tr td:nth-child(6)").allTextContents()).map((value) =>
    Number(value.replaceAll(",", ""))
  );
  expect(prices).toEqual([...prices].sort((left, right) => right - left));
});

test("shows source-backed opened-casket value composition", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("rock_crab");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();

  const drops = page.getByRole("table", { name: "Current monster drops" });
  const casketRow = drops.getByRole("row", { name: /Casket/ }).first();
  await expect(casketRow).toBeVisible();
  await casketRow.scrollIntoViewIfNeeded();
  await casketRow.locator("details").last().locator("summary").click();

  await expect(casketRow).toContainText("Opened contents EV");
  await expect(casketRow.getByLabel("Price history for Casket")).toContainText("Component-derived");
  await expect(casketRow.getByLabel("Price history for Casket")).toContainText(
    "parent casket history is not used"
  );
  const nested = page.getByRole("table", { name: "Nested rows for Casket" });
  await expect(nested.locator("tbody tr")).toHaveCount(8);
  await expect(nested).toContainText("20-640 coins (210 average)");
  await expect(nested).toContainText("tooth_half_key");
  await expect(nested).toContainText("loop_half_key");
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
  await tabs.getByRole("tab", { name: "Monsters" }).click();
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
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Monsters" }).click();
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
      "GP/HR NET": "-15,939",
      "KILLS/HR": "235",
      "GP/KILL": "944",
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
      "Recoil gp/kill": "96"
    },
    tripManual: {
      DPS: "2.59",
      "MAX HIT": "16.4",
      "HIT %": "75.5%",
      "XP/HR": "20,093",
      "GP/HR NET": "-55,804",
      "KILLS/HR": "80",
      "GP/KILL": "1,838",
      "SUPPLY/KILL": "3,071"
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
  await expect(priceSetSummary).not.toContainText("Status Imported price set");
  await expect(settings).toContainText("Imported price set: Imported fixture prices");
  await expect(page.locator(".topbar")).not.toContainText("Imported fixture prices");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Monsters" }).click();
  const priceDataIssue = page.getByLabel("Price data issue");
  await expect(priceDataIssue).toContainText("Price data incomplete");
  await expect(priceDataIssue.getByRole("button", { name: "Review price data" })).toBeVisible();
  await expect(page.locator('[aria-label="Result price warnings"]')).toHaveCount(0);
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
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Monsters" }).click();
  const reloadedImportedPrices = await resultMetricSnapshot(page);
  expect(reloadedImportedPrices).toEqual(importedPrices);

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();
  await expect(page.locator('[aria-label="Loot price warnings"]')).toHaveCount(0);
  await expect(
    page.locator(".loot-price-cell").filter({ hasText: "Missing price" }).first()
  ).toBeVisible();

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Monsters" }).click();
  await page
    .getByLabel("Price data issue")
    .getByRole("button", { name: "Review price data" })
    .click();
  const economyTab = page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" });
  const priceDataNotes = page.getByLabel("Economy price data notes");
  await expect(economyTab).toHaveAttribute("aria-selected", "true");
  await expect(priceDataNotes).toHaveAttribute("open", "");
  await expect(priceDataNotes.locator("summary")).toBeFocused();
  await expect(priceDataNotes.locator("summary")).toContainText(/Price data notes \([1-9][0-9]*\)/);
  expect(await priceDataNotes.locator("li").count()).toBeGreaterThan(4);
  await expect(priceDataNotes).not.toContainText(/\d+ more/);
  await expect(page.locator('[aria-label="Economy price warnings"]')).toHaveCount(0);
});

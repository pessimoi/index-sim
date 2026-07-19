import {
  ALL_FIXTURE_NUMERIC_LABELS,
  CANNON_NUMERIC_LABELS,
  GENERATED_BROWSER_FIXTURE_CONTEXT,
  LEGACY_GOLDEN_CASES,
  LOOT_PREFS_STORAGE_KEY,
  LOOT_PREFS_VERSION,
  LOOT_SETTINGS_STORAGE_KEY,
  LOOT_SETTINGS_VERSION,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  allFixtureExpectedMetrics,
  chooseSearchableOption,
  createRewriteFixtureCase,
  createSimulationViewModel,
  denseNumericSnapshot,
  expect,
  expectActiveDenseRow,
  expectDenseRowMax,
  fixtureStorageEnvelope,
  metricSnapshot,
  resultMetricSnapshot,
  savedSetupFromForm,
  selectCombatType,
  test
} from "./scaffold-fixture";

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
  await expect(freshness).toHaveText("Previous result");
  await expect(comparePanel).toContainText("previous inputs");

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

  await tabs.getByRole("tab", { name: "Monsters" }).click();
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
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Monsters" }).click();
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
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Monsters" }).click();
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
  ).toHaveText("325");
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
      gpPerHour: "122,913",
      netGpPerHour: "-80,658"
    },
    defaultMeleeResults: {
      DPS: "3.05",
      "MAX HIT": "16.4",
      "HIT %": "88.9%",
      "XP/HR": "21,573",
      "GP/HR NET": "-80,658",
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
      gpPerKill: "654",
      gpPerHour: "47,935",
      netGpPerHour: "-179,519"
    },
    rangedSafespotResults: {
      DPS: "1.96",
      "MAX HIT": "10.0",
      "HIT %": "70.6%",
      "XP/HR": "14,525",
      "GP/HR NET": "-179,519",
      "KILLS/HR": "73",
      "GP/KILL": "654",
      "SUPPLY/KILL": "4,955"
    },
    cannonRanged: {
      hit: "80.7%",
      max: "10.0",
      dps: "2.24",
      ttk: "8.6s",
      killsPerHour: "325",
      xpPerHour: "37,083",
      gpPerKill: "95",
      gpPerHour: "30,780",
      netGpPerHour: "-475,073"
    },
    cannonRangedResults: {
      DPS: "2.24",
      "MAX HIT": "10.0",
      "HIT %": "80.7%",
      "XP/HR": "37,083",
      "GP/HR NET": "-475,073",
      "KILLS/HR": "325",
      "GP/KILL": "95",
      "SUPPLY/KILL": "2,829"
    },
    cannonOutput: {
      "Effective targets": "2.5",
      "Cannon DPS": "6.31",
      "Cannon only DPS": "7.41",
      "Balls/hr": "1,875",
      "Balls/kill": "4.46",
      "Cannon Ranged XP/hr": "45,401",
      "Effective XP/hr": "37,083",
      "Effective net GP/hr": "-475,073",
      "Ball cost/hr": "749,830",
      "Ball cost/kill": "1,785",
      "Ball price": "400",
      "Cannonballs/trip": "69",
      "Ball gp/trip": "27,743",
      "K/hr uplift": "214.6%"
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
  await tabs.getByRole("tab", { name: "Monsters" }).click();
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
  await tabs.getByRole("tab", { name: "Monsters" }).click();
  await expect(
    table
      .getByRole("row", { name: /Dagannoth \(lvl 74\)/ })
      .locator("td")
      .nth(5)
  ).toHaveText("325");
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
  await tabs.getByRole("tab", { name: "Monsters" }).click();
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
  await tabs.getByRole("tab", { name: "Monsters" }).click();
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
      gpPerHour: "122,913",
      netGpPerHour: "-80,658"
    },
    meleeBaselineResults: {
      DPS: "3.05",
      "MAX HIT": "16.4",
      "HIT %": "88.9%",
      "XP/HR": "21,573",
      "GP/HR NET": "-80,658",
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
      gpPerKill: "497",
      gpPerHour: "69,752",
      netGpPerHour: "-96,869"
    },
    meleeAlchRelevantResults: {
      DPS: "2.81",
      "MAX HIT": "16.4",
      "HIT %": "82.1%",
      "XP/HR": "18,290",
      "GP/HR NET": "-96,869",
      "KILLS/HR": "140",
      "GP/KILL": "497",
      "SUPPLY/KILL": "1,789"
    },
    rangedSafespot: {
      hit: "70.6%",
      max: "10.0",
      dps: "1.96",
      ttk: "45.6s",
      killsPerHour: "73",
      xpPerHour: "14,525",
      gpPerKill: "654",
      gpPerHour: "47,935",
      netGpPerHour: "-179,519"
    },
    rangedSafespotResults: {
      DPS: "1.96",
      "MAX HIT": "10.0",
      "HIT %": "70.6%",
      "XP/HR": "14,525",
      "GP/HR NET": "-179,519",
      "KILLS/HR": "73",
      "GP/KILL": "654",
      "SUPPLY/KILL": "4,955"
    },
    rangedCannon: {
      hit: "80.7%",
      max: "10.0",
      dps: "2.24",
      ttk: "8.6s",
      killsPerHour: "325",
      xpPerHour: "37,083",
      gpPerKill: "95",
      gpPerHour: "30,780",
      netGpPerHour: "-475,073"
    },
    rangedCannonResults: {
      DPS: "2.24",
      "MAX HIT": "10.0",
      "HIT %": "80.7%",
      "XP/HR": "37,083",
      "GP/HR NET": "-475,073",
      "KILLS/HR": "325",
      "GP/KILL": "95",
      "SUPPLY/KILL": "2,829"
    },
    magicSafespot: {
      hit: "35.7%",
      max: "20.0",
      dps: "1.19",
      ttk: "1:33",
      killsPerHour: "37",
      xpPerHour: "21,210",
      gpPerKill: "6,597",
      gpPerHour: "245,973",
      netGpPerHour: "-442,830"
    },
    magicSafespotResults: {
      DPS: "1.19",
      "MAX HIT": "20.0",
      "HIT %": "35.7%",
      "XP/HR": "21,210",
      "GP/HR NET": "-442,830",
      "KILLS/HR": "37",
      "GP/KILL": "6,597",
      "SUPPLY/KILL": "37,111"
    },
    customLootSettings: {
      hit: "72.4%",
      max: "22.9",
      dps: "1.97",
      ttk: "40.9s",
      killsPerHour: "67",
      xpPerHour: "8,443",
      gpPerKill: "6,187",
      gpPerHour: "417,020",
      netGpPerHour: "71,843"
    },
    customLootSettingsResults: {
      DPS: "1.97",
      "MAX HIT": "22.9",
      "HIT %": "72.4%",
      "XP/HR": "8,443",
      "GP/HR NET": "71,843",
      "KILLS/HR": "67",
      "GP/KILL": "6,187",
      "SUPPLY/KILL": "3,634"
    }
  });
});

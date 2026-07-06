import { expect, test } from "@playwright/test";

test("loads the dense combat spreadsheet root", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "2004scape Combat Simulator" })).toBeVisible();
  await expect(page.getByLabel("Dense combat spreadsheet")).toBeVisible();
  await expect(page.getByLabel("Combat setup")).toBeVisible();
  await expect(page.getByLabel("Simulation results")).toBeVisible();
  await expect(page.getByRole("table", { name: "All monsters" })).toBeVisible();
  await expect(page.getByText("All monsters")).toBeVisible();
  await expect(page.getByText("DPS").first()).toBeVisible();
  await expect(
    page.getByText("Hiscores disabled: runtime or upstream not configured")
  ).toBeVisible();
  await expect(
    page.getByText("Market sync disabled: runtime or upstream not configured")
  ).toBeVisible();
  await expect(page.getByText("run_sim.py")).toHaveCount(0);
  await expect(page.getByText("/api/prices")).toHaveCount(0);
  await expect(page.getByText("/api/scrape")).toHaveCount(0);
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
  await expect(migration.getByLabel("Legacy data summary")).toContainText(
    "Hiscores player ready"
  );
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Planner data found");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Prices ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Price history found");
  await expect(migration.getByLabel("Legacy data summary")).toContainText(
    "Unsupported data found"
  );

  await migration.getByRole("button", { name: "Import compatible data" }).click();
  await expect(migration).toHaveCount(0);
  await expect(page.getByLabel("TYPE")).toHaveValue("ranged");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("greater_demon");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"combatStyle":"ranged"') &&
      saved.includes('"monsterId":"greater_demon"') &&
      window.localStorage.getItem("sim_input_v3") !== null &&
      window.localStorage.getItem("sim_prices_v1") !== null &&
      window.localStorage.getItem("sim_alch_v1") !== null &&
      window.localStorage.getItem("sim_scraped_at_v1") !== null &&
      window.localStorage.getItem("sim_scraped_keys_v1") !== null &&
      window.localStorage.getItem("sim_price_history_v1") !== null &&
      window.localStorage.getItem("sim_hiscore_player") !== null &&
      window.localStorage.getItem("index-sim:legacy-migration-dismissed") !== null &&
      (window.localStorage.getItem("index-sim:hiscores:last-player") ?? "").includes(
        "Fixture Player"
      ) &&
      (window.localStorage.getItem("index-sim:price-history") ?? "").includes(
        "legacy-browser-prices"
      )
    );
  });
  await expect(page.locator(".topbar")).toContainText("Legacy browser prices");
});

test("keeps legacy data and dismisses the migration notice", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("sim_input_v3", JSON.stringify({ combatType: "melee" }));
  });

  await page.goto("/");
  const migration = page.getByLabel("Legacy setup migration");
  await expect(migration).toBeVisible();

  await migration.getByRole("button", { name: "Keep legacy data" }).click();
  await expect(migration).toHaveCount(0);
  await page.waitForFunction(() => {
    return (
      window.localStorage.getItem("sim_input_v3") !== null &&
      window.localStorage.getItem("index-sim:legacy-migration-dismissed") !== null
    );
  });
});

test("clears only known legacy data after confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("sim_input_v3", JSON.stringify({ combatType: "melee" }));
    window.localStorage.setItem("sim_planner_v1", "{}");
    window.localStorage.setItem("sim_hidden_tiers_v1", "{}");
    window.localStorage.setItem("sim_compare_sort_v1", "{}");
    window.localStorage.setItem("sim_prices_v1", "{}");
    window.localStorage.setItem("sim_alch_v1", "{}");
    window.localStorage.setItem("sim_scraped_at_v1", "2026-07-05T12:00:00.000Z");
    window.localStorage.setItem("sim_scraped_keys_v1", "[]");
    window.localStorage.setItem("sim_price_history_v1", "[]");
    window.localStorage.setItem("sim_price_history_sanitized_v4", "[]");
    window.localStorage.setItem("sim_hiscore_player", "Fixture Player");
    window.localStorage.setItem("unrelated_key", "keep");
  });

  await page.goto("/");
  const migration = page.getByLabel("Legacy setup migration");
  await expect(migration).toBeVisible();

  await migration.getByRole("button", { name: "Clear legacy data" }).click();
  await expect(migration.getByRole("button", { name: "Confirm clear" })).toBeVisible();
  await migration.getByRole("button", { name: "Confirm clear" }).click();
  await expect(migration).toHaveCount(0);
  await page.waitForFunction(() => {
    const knownKeys = [
      "sim_input_v3",
      "sim_planner_v1",
      "sim_hidden_tiers_v1",
      "sim_compare_sort_v1",
      "sim_prices_v1",
      "sim_alch_v1",
      "sim_scraped_at_v1",
      "sim_scraped_keys_v1",
      "sim_price_history_v1",
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
  await page.getByLabel("TYPE").selectOption("ranged");
  await expect(page.getByLabel("RNG")).toBeVisible();
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("giant");
  await expect(page.getByText("XP/HR").first()).toBeVisible();
});

test("selects special attacks and shows special metrics", async ({ page }) => {
  await page.goto("/");
  const special = page.locator('section[aria-label="Special attack"]');

  await expect(special).toBeVisible();
  await special.getByLabel("Spec weapon").selectOption("dragon_dagger_p");

  await expect(page.locator('[aria-label="Special attack metrics"]')).toContainText(
    "Spec max hit"
  );
  await expect(page.locator('[aria-label="Special attack metrics"]')).toContainText("DPS gain");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"weaponId":"dragon_dagger_p"');
  });

  await page.getByLabel("TYPE").selectOption("ranged");
  await special.getByLabel("Spec weapon").selectOption("magic_shortbow");
  await expect(special.getByLabel("Spec ammo")).toBeVisible();
  await special.getByLabel("Spec ammo").selectOption("rune_arrow");
  await expect(page.locator('[aria-label="Special attack metrics"]')).toContainText("Specs/hr");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"weaponId":"magic_shortbow"') && saved.includes('"ammoId":"rune_arrow"');
  });

  await page.getByLabel("TYPE").selectOption("magic");
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
      .replace(/\s+lvl\s+\d+$/, "")
      .trim()
  );
  expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));

  const rockCrabRow = table.getByRole("row", { name: /Rock Crab/ });
  await rockCrabRow.click();
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("rock_crab");
  await expect(rockCrabRow.locator("td").first()).toContainText(">");
});

test("enables cannon for the selected monster and shows cannon rates", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("TYPE").selectOption("ranged");
  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");

  const cannon = page.locator('section[aria-label="Cannon"]');
  await expect(cannon).toBeVisible();
  await expect(cannon.getByText("off")).toBeVisible();

  await cannon.getByLabel("Set up cannon").check();
  await cannon.getByLabel("Mobs at spot").fill("6");
  await cannon.getByLabel("Respawn").fill("30");

  const output = page.locator('[aria-label="Cannon output"]');
  await expect(output).toContainText("Balls/hr");
  await expect(output).toContainText("Cannon Ranged XP/hr");
  await expect(output).toContainText("Ball cost/hr");
  await expect(cannon.getByText("active")).toBeVisible();
  await expect(page.getByLabel("Simulation results")).toContainText("SUPPLY/KILL");
  await page.waitForFunction(() =>
    window.localStorage.getItem("index-sim:rewrite-setup")?.includes('"dagannoth"')
  );

  await page.reload();
  const reloadedCannon = page.locator('section[aria-label="Cannon"]');
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("dagannoth");
  await expect(reloadedCannon.getByLabel("Set up cannon")).toBeChecked();
  await expect(reloadedCannon.getByLabel("Mobs at spot")).toHaveValue("6");
  await expect(reloadedCannon.getByLabel("Respawn")).toHaveValue("30");
});

test("updates trip survival controls and keeps the trip summary visible", async ({ page }) => {
  await page.goto("/");

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const summary = page.locator('[aria-label="Trip summary"]');

  await expect(trip).toBeVisible();
  await expect(summary).toContainText("Safespot");
  await expect(summary).toContainText("HP/kill");

  await trip.getByLabel("Safespot").selectOption("off");
  await trip.getByLabel("Protect").selectOption("melee");
  await trip.getByLabel("Antifire").check();
  await trip.getByLabel("Antipoison").check();

  await expect(summary).toContainText("Off");
  await expect(summary).toContainText("Melee");
  await expect(summary).toContainText("Antifire");
  await expect(summary).toContainText("Antipoison");
  await expect(summary).toContainText("Effective K/hr");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"safespot":false') &&
      saved.includes('"protect":"melee"') &&
      saved.includes('"antifire":true') &&
      saved.includes('"antipoison":true')
    );
  });

  await page.reload();
  const reloadedTrip = page.locator('section[aria-label="Trip assumptions"]');
  await expect(reloadedTrip.getByLabel("Safespot")).toHaveValue("off");
  await expect(reloadedTrip.getByLabel("Protect")).toHaveValue("melee");
  await expect(reloadedTrip.getByLabel("Antifire")).toBeChecked();
  await expect(reloadedTrip.getByLabel("Antipoison")).toBeChecked();
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

  const trip = page.locator('section[aria-label="Trip assumptions"]');
  const summary = page.locator('[aria-label="Trip summary"]');
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("firegiant");
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
  const reloadedTrip = page.locator('section[aria-label="Trip assumptions"]');
  await expect(reloadedTrip.getByLabel("Food mode")).toHaveValue("manual");
  await expect(reloadedTrip.getByLabel("Food count")).toHaveValue("4");
  await expect(reloadedTrip.getByLabel("F/KL override")).toHaveValue("on");
  await expect(reloadedTrip.getByLabel("Food/kill")).toHaveValue("0.5");
  await expect(reloadedTrip.getByLabel("Recoil rings")).toHaveValue("6");
});

test("updates prayer restore detail controls and keeps the trip summary visible", async ({
  page
}) => {
  await page.goto("/");

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
  const reloadedTrip = page.locator('section[aria-label="Trip assumptions"]');
  await expect(reloadedTrip.getByLabel("Prayer mode")).toHaveValue("altar");
  await expect(reloadedTrip.getByLabel("Prayer restore")).toBeDisabled();
  await expect(reloadedTrip.getByLabel("Altar time")).toHaveValue("manual");
  await expect(reloadedTrip.getByLabel("Altar sec")).toHaveValue("45");
  await expect(page.locator('[aria-label="Trip summary"]')).toBeVisible();
});

test("updates current monster loot actions, reset and optimize", async ({ page }) => {
  await page.goto("/");

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
  await expect(page.getByRole("button", { name: "Sync monster" })).toBeEnabled();
  await page.getByRole("button", { name: "Sync monster" }).click();

  await expect(page.getByLabel("Market sync report")).toContainText("Mock LostCity market");
  await expect(page.getByLabel("Market sync report")).toContainText("Updated 1");
  await expect(page.getByLabel("Market sync report")).toContainText("Failed 1");
  await expect(page.locator(".topbar").getByText("Mock market sync")).toBeVisible();
  await expect(page.getByLabel("Price history summary")).toContainText("Snapshots 1");
  await expect(page.getByLabel("Price history summary")).toContainText("Items 2");
  await expect(page.getByLabel("Price history summary")).toContainText("Active Mock market sync");
  await expect(page.getByLabel("Price history summary")).toContainText("Latest Mock market sync active");

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
});

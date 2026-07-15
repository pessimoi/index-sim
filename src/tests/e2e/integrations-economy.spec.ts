import {
  MANUAL_PRICE_OVERRIDES_MAX_ITEMS,
  MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
  chooseSearchableOption,
  expect,
  searchableCombobox,
  test
} from "./scaffold-fixture";

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
  const previewDetails = hiscores.locator("details.hiscores-preview-details");
  const previewTrigger = previewDetails.locator("summary");
  await expect(previewDetails).toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  await expect(previewDetails).not.toHaveAttribute("open", "");
  await expect(previewTrigger).toBeFocused();
  await previewTrigger.click();
  await expect(previewDetails).toHaveAttribute("open", "");
  await page.getByRole("heading", { name: "2004scape Combat Simulator" }).click();
  await expect(previewDetails).not.toHaveAttribute("open", "");
  await previewTrigger.click();
  await expect(previewDetails).toHaveAttribute("open", "");
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
  await expect(market.getByLabel("Market active PriceSet summary")).toContainText(
    "Generated fallback"
  );
  await expect(page.getByLabel("Selected item price provenance")).toContainText("Origin");
  await expect(page.getByLabel("Selected item price provenance")).toContainText("Freshness");
  await expect(market.getByRole("button", { name: /Sync|Refresh|Scrape/ })).toHaveCount(0);
  await expect(market).toContainText("Automatic market upstream refresh is currently disabled.");
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("/api/prices");
  expect(bodyText).not.toContain("/api/scrape");
  expect(bodyText).not.toContain("run_sim.py");
  expect(refreshRequested).toBe(false);
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:price-set:selected"))
  ).toBeNull();
});

test("keeps manual item drafts and unavailable overrides scoped across base changes", async ({
  page
}) => {
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();

  const panel = page.getByRole("region", { name: "Manual item price", exact: true });
  const summary = panel.getByLabel("Manual item price summary");
  const manualItem = searchableCombobox(panel, "Manual price item");
  const priceInput = panel.getByLabel("Manual price", { exact: true });
  const initialManualItemId = await manualItem.getAttribute("data-selected-id");
  await priceInput.fill("777");
  await chooseSearchableOption(
    page,
    "Trend item",
    initialManualItemId === "big_bones" ? "Lobster" : "Big bones",
    true
  );
  await expect(manualItem).toHaveAttribute("data-selected-id", initialManualItemId ?? "");
  await expect(priceInput).toHaveValue("777");

  await chooseSearchableOption(panel, "Manual price item", "Lobster", true);
  const baseLabel = await summary
    .locator("span")
    .filter({ hasText: /^Base / })
    .textContent();
  expect(baseLabel).not.toBeNull();

  await priceInput.fill("123456");
  await panel.getByRole("button", { name: "Apply price" }).click();
  await expect(summary).toContainText("Active 123,456");
  await expect(summary).toContainText("Status Manual");
  await expect(page.getByLabel("Market active PriceSet summary")).toContainText(
    "Manual item overrides (1)"
  );
  await chooseSearchableOption(page, "Trend item", "Lobster", true);
  await expect(page.getByLabel("Selected item price provenance")).toContainText("Origin manual");
  await expect(page.getByLabel("Selected item price provenance")).toContainText(
    "Reason manual value"
  );

  const persisted = await page.evaluate((key) => {
    return JSON.parse(window.localStorage.getItem(key) ?? "null");
  }, MANUAL_PRICE_OVERRIDES_STORAGE_KEY);
  expect(persisted.data.items.lobster.price).toBe(123456);

  await priceInput.fill("222222");
  const market = page.getByLabel("Market price data");
  await market
    .locator("label.file-button")
    .filter({ hasText: "Import PriceSet" })
    .locator('input[type="file"]')
    .setInputFiles({
      name: "big-bones-only.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          id: "big-bones-only",
          label: "Big bones only",
          source: "manual",
          createdAt: "2026-07-12T18:00:00.000Z",
          itemPrices: { big_bones: 555 },
          alchValues: { big_bones: 0 }
        })
      )
    });
  await expect(priceInput).toHaveValue("555");
  await expect(summary).toContainText("Base 555");
  await expect(summary).toContainText("Status Base");
  await expect(panel).toContainText("0 active · 1 unavailable");
  expect(
    await page.evaluate(
      (key) => JSON.parse(window.localStorage.getItem(key) ?? "null").data.items.lobster.price,
      MANUAL_PRICE_OVERRIDES_STORAGE_KEY
    )
  ).toBe(123456);

  await market.getByRole("button", { name: "Reset local price override" }).click();
  await market.getByRole("button", { name: "Confirm reset to scheduled prices" }).click();
  await chooseSearchableOption(panel, "Manual price item", "Lobster", true);
  await expect(summary).toContainText("Active 123,456");
  await expect(summary).toContainText("Status Manual");

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const reloadedPanel = page.getByRole("region", {
    name: "Manual item price",
    exact: true
  });
  const reloadedSummary = reloadedPanel.getByLabel("Manual item price summary");
  await chooseSearchableOption(reloadedPanel, "Manual price item", "Lobster", true);
  await expect(reloadedSummary).toContainText("Active 123,456");
  await expect(reloadedSummary).toContainText("Status Manual");

  await reloadedPanel.getByRole("button", { name: "Reset item" }).click();
  await expect(reloadedSummary).toContainText(baseLabel ?? "");
  await expect(reloadedSummary).toContainText("Status Base");
  expect(
    await page.evaluate(
      (key) => window.localStorage.getItem(key),
      MANUAL_PRICE_OVERRIDES_STORAGE_KEY
    )
  ).toBe(null);

  await page.evaluate(
    ({ key, count }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          savedAt: "2026-07-12T19:00:00.000Z",
          data: {
            items: Object.fromEntries(
              Array.from({ length: count }, (_, index) => [
                `unavailable_${index}`,
                { price: index, updatedAt: "2026-07-12T19:00:00.000Z" }
              ])
            )
          }
        })
      );
    },
    {
      key: MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
      count: MANUAL_PRICE_OVERRIDES_MAX_ITEMS
    }
  );
  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const capacityPanel = page.getByRole("region", {
    name: "Manual item price",
    exact: true
  });
  await chooseSearchableOption(capacityPanel, "Manual price item", "Lobster", true);
  await capacityPanel.getByLabel("Manual price", { exact: true }).fill("999999");
  await expect(capacityPanel.getByRole("button", { name: "Apply price" })).toBeDisabled();
  await expect(capacityPanel).toContainText("Stored 512/512");
});

test("refreshes the latest price-history age while Economy stays open", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-07-14T12:00:30.000Z") });
  await page.route("**/price-history.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "index-sim:price-history",
      JSON.stringify({
        version: 1,
        savedAt: "2026-07-14T12:00:00.000Z",
        data: {
          snapshots: [
            {
              capturedAt: "2026-07-14T12:00:00.000Z",
              sourcePriceSetId: "age-fixture",
              label: "Age fixture",
              itemPrices: { lobster: 250 }
            }
          ]
        }
      })
    );
  });

  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const summary = page.getByLabel("Price history summary");

  await expect(summary).toContainText("Latest age <1m");
  await page.clock.fastForward(60_000);
  await expect(summary).toContainText("Latest age 1m");
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
  const priceMoversTable = page.getByRole("table", { name: "Price movers" });
  await expect(priceMoversTable).toContainText("Lobster");
  await expect(priceMoversTable).toContainText("Big bones");
  const lobsterItemCell = priceMoversTable
    .getByRole("row", { name: /Lobster/ })
    .locator(".economy-item-cell");
  await expect(lobsterItemCell).toHaveCSS("display", "grid");
  await expect(lobsterItemCell.locator("strong")).toHaveText("Lobster");
  await expect(lobsterItemCell.locator("small")).toHaveText("Item ID: lobster");
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
  await expect(page.getByLabel("Market active PriceSet summary")).toContainText(
    /scheduled static prices/i
  );
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

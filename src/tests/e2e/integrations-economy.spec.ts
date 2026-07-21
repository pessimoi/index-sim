import {
  MANUAL_PRICE_OVERRIDES_MAX_ITEMS,
  MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
  chooseSearchableOption,
  expect,
  expectAppStatus,
  expectPageWidthContained,
  searchableCombobox,
  searchableInput,
  test
} from "./scaffold-fixture";
import { readFileSync } from "node:fs";

test("shows the accepted Revision 274 context in the ready shell and Settings", async ({
  page
}) => {
  await page.goto("/");
  const revisionBadge = page.getByLabel("Active game data: Revision 274");
  await expect(revisionBadge).toBeVisible();
  await expect(revisionBadge).toHaveText("Revision 274");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const calculationContext = page.getByRole("region", { name: "Calculation context" });
  await expect(calculationContext).toBeVisible();
  await expect(calculationContext).toContainText("Game revisionRevision 274");
  await expect(calculationContext).toContainText(
    "SnapshotLostCity source-backed runtime 376072662e78"
  );
  await expect(calculationContext).toContainText("Snapshot idlostcity-376072662e78-runtime");
  await expect(calculationContext.getByText("LostCityRS/Content · 376072662e78")).toHaveAttribute(
    "title",
    "376072662e78a314bf35bb18815be39521491a6b"
  );
  await expect(calculationContext).toContainText("Generated2026-07-09T00:00:00.000Z");
  await expect(calculationContext).toContainText("Setup transfers do not include prices.");
  await expect(calculationContext).not.toContainText(".sources");
  await expect(calculationContext).not.toContainText("data:generate");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(revisionBadge).toBeVisible();
  await expectPageWidthContained(page);
});

test("reviews the Settings PriceSet in Economy without changing price or disclosure state", async ({
  page
}) => {
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("tab", { name: "Economy" }).click();

  const market = page.getByLabel("Market price data");
  const activeSummary = market.getByLabel("Market active PriceSet summary");
  await expect(activeSummary.locator("span").first()).toBeVisible();
  const activeSummaryBefore = await activeSummary.locator("span").allTextContents();
  const advancedTools = market.getByLabel("Advanced PriceSet tools");
  const priceNotes = market.getByLabel("Economy price data notes");
  await expect(advancedTools).not.toHaveAttribute("open", "");
  await expect(priceNotes).not.toHaveAttribute("open", "");

  await tabs.getByRole("tab", { name: "Settings" }).click();
  const settingsPriceData = page.getByLabel("Price data settings");
  await expect(settingsPriceData.getByLabel("Active PriceSet summary")).toBeVisible();
  await expect(page.getByLabel("Market price data")).toHaveCount(0);
  await expect(page.getByLabel("Scheduled price snapshot summary")).toHaveCount(0);
  const urlBefore = page.url();
  const storageBefore = await page.evaluate(() => ({
    selected: window.localStorage.getItem("index-sim:price-set:selected"),
    manual: window.localStorage.getItem("index-sim:manual-price-overrides"),
    history: window.localStorage.getItem("index-sim:price-history")
  }));

  await settingsPriceData.getByRole("button", { name: "Review in Economy" }).click();

  await expect(tabs.getByRole("tab", { name: "Economy" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Market", level: 2 })).toBeFocused();
  expect(await activeSummary.locator("span").allTextContents()).toEqual(activeSummaryBefore);
  await expect(advancedTools).not.toHaveAttribute("open", "");
  await expect(priceNotes).not.toHaveAttribute("open", "");
  expect(page.url()).toBe(urlBefore);
  expect(
    await page.evaluate(() => ({
      selected: window.localStorage.getItem("index-sim:price-set:selected"),
      manual: window.localStorage.getItem("index-sim:manual-price-overrides"),
      history: window.localStorage.getItem("index-sim:price-history")
    }))
  ).toEqual(storageBefore);
});

test("presents price dates semantically and preserves compatible date precision", async ({
  page
}) => {
  await page.clock.install({ time: new Date("2026-07-20T12:00:00.000Z") });
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("tab", { name: "Economy" }).click();
  const market = page.getByLabel("Market price data");
  const scheduled = market.getByLabel("Scheduled price snapshot summary");
  const active = market.getByLabel("Market active PriceSet summary");

  await expect(scheduled).toContainText("Snapshot captured");
  await expect(scheduled).toContainText("Captured");
  await expect(scheduled.locator("time")).toHaveCount(1);
  await expect(scheduled.locator("time")).toHaveAttribute("dateTime", /Z$/);
  expect(await scheduled.locator("time").textContent()).not.toMatch(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
  );
  await expect(active).toContainText(/(Active snapshot captured|Bundled price set created)/);
  await expect(active.locator("time")).toHaveCount(1);

  await tabs.getByRole("tab", { name: "Settings" }).click();
  const compact = page.getByLabel("Active PriceSet summary");
  await expect(compact.locator("time")).toHaveCount(1);
  await expect(compact.locator("time")).toHaveAttribute("aria-label", /exact local time/i);

  await tabs.getByRole("tab", { name: "Economy" }).click();
  const tools = market.getByLabel("Advanced PriceSet tools");
  await tools.locator(":scope > summary").click();
  const importInput = tools
    .locator("label.file-button")
    .filter({ hasText: "Import full PriceSet" })
    .locator('input[type="file"]');
  await importInput.setInputFiles({
    name: "date-only-prices.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        id: "date-only-prices",
        label: "Date-only prices",
        source: "manual",
        createdAt: "2026-07-05",
        itemPrices: { lobster: 250 },
        alchValues: { lobster: 0 }
      })
    )
  });
  await expect(active).toContainText("Selected price set created 5 Jul 2026");
  await expect(active).toContainText("Age Exact time not recorded");
  await expect(active.locator("time")).toHaveAttribute("dateTime", "2026-07-05");
  await expect(active).not.toContainText("00:00");

  await importInput.setInputFiles({
    name: "compatible-invalid-date-prices.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        id: "compatible-invalid-date-prices",
        label: "Compatible invalid date prices",
        source: "manual",
        createdAt: "stored date is unrecognized",
        itemPrices: { lobster: 260 },
        alchValues: { lobster: 0 }
      })
    )
  });
  await expect(active).toContainText("Selected price set created Date unavailable");
  await expect(active).not.toContainText("stored date is unrecognized");

  const manual = page.getByRole("region", { name: "Manual item price", exact: true });
  await chooseSearchableOption(manual, "Manual price item", "Lobster", true);
  await expect(manual.getByLabel("Manual item price summary")).toContainText(
    "Manual price updated Not applicable"
  );
  await manual.getByLabel("Manual price", { exact: true }).fill("270");
  await manual.getByRole("button", { name: "Apply price" }).click();
  const manualTime = manual.getByLabel("Manual item price summary").locator("time");
  await expect(manualTime).toHaveAttribute("dateTime", /^2026-07-20T12:00:/);
  expect(await manualTime.textContent()).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
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
  const workbenchTabs = page.getByLabel("Workbench tabs");
  await workbenchTabs.getByRole("tab", { name: "Planner" }).click();
  const plannerBeforeLookup = page.getByRole("region", { name: "Planner", exact: true });
  const attackXpBeforeLookup = plannerBeforeLookup.getByLabel("Attack current XP");
  const attackFloor = Number(
    (await attackXpBeforeLookup.getAttribute("placeholder"))?.replace("Auto: ", "")
  );
  await attackXpBeforeLookup.fill(String(attackFloor + 10));
  await workbenchTabs.getByRole("tab", { name: "Melee setup" }).click();
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

  const undo = page.getByLabel("Local state undo");
  await expect(undo).toContainText("Applied 7 levels");
  await expect(undo).not.toContainText("Other Player");
  await expect(previewDetails).toHaveAttribute("open", "");
  const attackPreviewRow = page
    .getByRole("table", { name: "Hiscores preview" })
    .locator("tbody tr")
    .filter({ hasText: "attack" });
  await expect(attackPreviewRow.locator("td").nth(1)).toHaveText("71");

  await hiscores.getByRole("button", { name: "Apply" }).click();
  await expect(hiscores).toContainText("Current levels already match Hiscores");
  await expect(undo).toContainText("Applied 7 levels");

  const plannerTab = workbenchTabs.getByRole("tab", { name: "Planner" });
  await plannerTab.focus();
  await page.keyboard.press("Enter");
  const reconciledPlanner = page.getByRole("region", { name: "Planner", exact: true });
  await expect(reconciledPlanner.getByLabel("Attack current XP")).toHaveValue("");
  await expect(reconciledPlanner.getByLabel("Attack target")).toHaveValue("71");
  await expect(reconciledPlanner).toContainText("Attack XP uses Auto");
  await expect(reconciledPlanner).toContainText("Attack target is now 71");
  await expect(reconciledPlanner).toContainText("the level 71 floor");

  await undo.getByRole("button", { name: "Undo" }).focus();
  await page.keyboard.press("Enter");
  await expect(undo).toHaveCount(0);
  await expectAppStatus(page, "Restored levels from before Hiscores Apply");
  await expect(previewDetails).toHaveAttribute("open", "");
  await expect(attackPreviewRow.locator("td").nth(1)).toHaveText("60");
  await expect(hiscores.getByRole("button", { name: "Apply" })).toBeEnabled();

  const meleeTab = workbenchTabs.getByRole("tab", { name: "Melee setup" });
  await meleeTab.focus();
  await page.keyboard.press("Enter");
  await expect(setup.getByLabel("ATT", { exact: true })).toHaveValue("60");
  await expect(setup.getByLabel("STR", { exact: true })).toHaveValue("60");
  await expect(setup.getByLabel("DEF", { exact: true })).toHaveValue("50");

  await plannerTab.focus();
  await page.keyboard.press("Enter");
  await expect(reconciledPlanner.getByLabel("Attack current XP")).toHaveValue("");
  await expect(reconciledPlanner.getByLabel("Attack target")).toHaveValue("71");
  await expect(reconciledPlanner).toContainText("the level 60 floor");
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

  await manualItem.click();
  await searchableInput(panel, "Manual price item").fill("big_bones");
  const bigBonesOption = panel.getByRole("option", { name: "Big bones", exact: true });
  await expect(bigBonesOption).toBeVisible();
  await bigBonesOption.click();
  await expect(manualItem).toHaveAttribute("data-selected-id", "big_bones");
  await expect(manualItem).toContainText("Big bones");

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
  const advancedPriceSetTools = market.locator("details.advanced-price-set-tools");
  await advancedPriceSetTools.locator(":scope > summary").click();
  await advancedPriceSetTools
    .locator("label.file-button")
    .filter({ hasText: "Import full PriceSet" })
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

  await advancedPriceSetTools.getByRole("button", { name: "Reset imported PriceSet" }).click();
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

test("corrects a warned item price", async ({ page }) => {
  const prices = JSON.parse(
    readFileSync(new URL("../../../prices.json", import.meta.url), "utf8")
  ) as Record<string, number>;
  const provenance = JSON.parse(
    readFileSync(new URL("../../../price-provenance.json", import.meta.url), "utf8")
  ) as { items: Record<string, unknown> };
  delete prices.rune_spear;
  delete provenance.items.rune_spear;
  await page.route("**/prices.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(prices)
    });
  });
  await page.route("**/price-provenance.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(provenance)
    });
  });
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  const resultIssue = page.getByLabel("Price data issue");

  await expect(resultIssue).toContainText("Price data incomplete");
  const directIssueAction = resultIssue.getByRole("button");
  const directIssueActionName = await directIssueAction.getAttribute("aria-label");
  expect(directIssueActionName).not.toBeNull();
  await directIssueAction.click();
  const priceNotes = page.getByLabel("Economy price data notes");
  await expect(tabs.getByRole("tab", { name: "Economy" })).toHaveAttribute("aria-selected", "true");
  await expect(priceNotes.getByRole("button", { name: directIssueActionName ?? "" })).toBeFocused();

  await tabs.getByRole("tab", { name: "Loot" }).click();
  const warnedRow = page
    .locator('table[aria-label="Current monster drops"] > tbody > tr')
    .filter({ hasText: "Iron full helm" })
    .first();
  await warnedRow.getByText("Value details", { exact: true }).click();
  await warnedRow.getByRole("button", { name: "Correct price for Iron full helm" }).click();

  const economyTab = tabs.getByRole("tab", { name: "Economy" });
  const panel = page.getByRole("region", { name: "Manual item price", exact: true });
  const summary = panel.getByLabel("Manual item price summary");
  const manualItem = searchableCombobox(panel, "Manual price item");
  const priceInput = panel.getByLabel("Manual price", { exact: true });
  await expect(economyTab).toHaveAttribute("aria-selected", "true");
  await expect(manualItem).toHaveAttribute("data-selected-id", "iron_full_helm");
  await expect(priceInput).toBeFocused();

  await priceInput.fill("54321");
  await panel.getByRole("button", { name: "Apply price" }).click();
  await expect(summary).toContainText("Active 54,321");
  await expect(summary).toContainText("Status Manual");
  await expect(page.getByLabel("Market price data")).toContainText(
    "Applied 54,321 GP manual price for Iron full helm. Current results use this manual value."
  );
  await expect(
    page
      .getByLabel("Current monster loot")
      .getByRole("button", { name: "Correct price for Iron full helm" })
  ).toHaveCount(0);

  await panel.getByRole("button", { name: "Reset item" }).click();
  await expect(
    page.getByLabel("Local state undo").getByRole("button", { name: "Undo" })
  ).toBeVisible();
  await expect(summary).toContainText("Base 154");
  await expect(summary).toContainText("Active 154");
  await expect(summary).toContainText("Status Base");
  await expect(page.getByLabel("Market price data")).toContainText(
    "Reset Iron full helm to 154 GP. Current results use the base PriceSet value."
  );

  await expect(priceNotes).toHaveAttribute("open", "");
  const economyNotice = priceNotes
    .locator("li")
    .filter({ has: page.getByText("Rune javelin", { exact: true }) });
  await economyNotice.getByRole("button", { name: "Correct price for Rune javelin" }).click();
  await expect(manualItem).toHaveAttribute("data-selected-id", "rune_javelin");
  await expect(priceInput).toBeFocused();
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

  await expect(summary).toContainText("Latest age just now");
  await page.clock.fastForward(60_000);
  await expect(summary).toContainText("Latest age 1 min ago");
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
  await expect(lobsterItemCell.locator("small")).toHaveCount(0);
  const lobsterTechnicalDetails = lobsterItemCell.locator("details.technical-details");
  await expect(lobsterTechnicalDetails).not.toHaveAttribute("open", "");
  await lobsterTechnicalDetails.locator("summary").click();
  await expect(lobsterTechnicalDetails.getByText("Item ID", { exact: true })).toBeVisible();
  await expect(lobsterTechnicalDetails.locator("code")).toHaveText("lobster");
  await expect(page.getByRole("img", { name: /Big bones price trend/ })).toBeVisible();
  await chooseSearchableOption(page, "Trend item", "Big bones");
  const itemTrend = page.getByLabel("Item price trend");
  await expect(itemTrend).toContainText("Big bones");
  await expect(itemTrend).toContainText("Latest350");
  await expect(itemTrend).toContainText("Minimum300");
  await expect(itemTrend).toContainText("Maximum500");
  await expect(itemTrend).toContainText("+50 / +16.7%");
  await expect(page.getByRole("img", { name: "Big bones price trend", exact: true })).toBeVisible();
  const bigBonesPricePoints = page.getByLabel("Price points for Big bones");
  await expect(bigBonesPricePoints).toContainText("4 Jul 2026, 12:00 UTC");
  await expect(bigBonesPricePoints).not.toContainText("2026-07-04T12:00");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();
  const bigBonesRow = page.getByRole("table", { name: "Current monster drops" }).getByRole("row", {
    name: /Big bones/
  });
  await bigBonesRow.locator(":scope > td:last-child > details > summary").click();
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

  await page.locator("details.local-history-management > summary").click();
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

test("reviews one duplicate local-history occurrence and restores its exact raw order", async ({
  page
}) => {
  await page.route("**/price-history.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  const capturedAt = "2026-07-10T12:00:00.000Z";
  const rawBefore = JSON.stringify({
    version: 2,
    savedAt: "2026-07-20T10:00:00.000Z",
    data: {
      snapshots: [
        {
          capturedAt,
          sourcePriceSetId: "duplicate",
          label: "Duplicate prices",
          itemPrices: { lobster: 200 }
        },
        {
          capturedAt,
          sourcePriceSetId: "duplicate",
          label: "Duplicate prices",
          itemPrices: { lobster: 210, big_bones: 400 }
        },
        {
          capturedAt: "2026-07-09T12:00:00.000Z",
          sourcePriceSetId: "older",
          label: "Older prices",
          itemPrices: { lobster: 180 }
        }
      ]
    }
  });
  await page.addInitScript((raw) => {
    window.localStorage.setItem("index-sim:price-history", raw);
  }, rawBefore);

  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const lifecycle = page.getByLabel("Local price history lifecycle");
  await expect(lifecycle).toContainText("Local comparisons 3/20");
  await lifecycle.locator("details.local-history-management > summary").click();
  const duplicateActions = lifecycle.getByRole("button", {
    name: /Review removal for Duplicate prices captured 10 July 2026 at 12:00:00 Coordinated Universal Time, [12] of 2/
  });
  await expect(duplicateActions).toHaveCount(2);
  await expect(lifecycle).toContainText("10 Jul 2026, 12:00:00 UTC");
  expect((await lifecycle.locator("time").allTextContents()).join(" ")).not.toContain(capturedAt);
  const duplicateSnapshotKeys = lifecycle
    .locator("details.technical-details code")
    .filter({ hasText: capturedAt });
  await expect(duplicateSnapshotKeys).toHaveCount(2);
  await expect(duplicateSnapshotKeys.first()).not.toBeVisible();

  await duplicateActions.first().click();
  await expect(page.getByRole("heading", { name: "Remove local comparison?" })).toBeFocused();
  await lifecycle.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(duplicateActions.first()).toBeFocused();
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    rawBefore
  );

  await duplicateActions.nth(1).click();
  await lifecycle.getByRole("button", { name: "Remove local comparison", exact: true }).click();
  await expect(lifecycle).toContainText("Local comparisons 2/20");
  const afterRemoval = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("index-sim:price-history") ?? "null")
  );
  expect(afterRemoval.data.snapshots).toEqual([
    JSON.parse(rawBefore).data.snapshots[0],
    JSON.parse(rawBefore).data.snapshots[2]
  ]);

  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await expect(lifecycle).toContainText("Local comparisons 3/20");
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    rawBefore
  );
});

test("reviews full-history replacement and keeps a later accepted PriceSet separate", async ({
  page
}) => {
  await page.clock.install({ time: new Date("2026-07-20T15:30:00.000Z") });
  await page.route("**/price-history.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  const snapshots = Array.from({ length: 20 }, (_, index) => ({
    capturedAt: new Date(Date.UTC(2026, 6, 20 - index, 12)).toISOString(),
    sourcePriceSetId: `existing-${index}`,
    label: index === 19 ? "Exact oldest prices" : `Existing prices ${index}`,
    itemPrices: { lobster: 200 + index }
  }));
  const rawBefore = JSON.stringify({
    version: 2,
    savedAt: "2026-07-20T10:00:00.000Z",
    data: { snapshots }
  });
  await page.addInitScript((raw) => {
    window.localStorage.setItem("index-sim:price-history", raw);
  }, rawBefore);

  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const lifecycle = page.getByLabel("Local price history lifecycle");
  const save = lifecycle.getByRole("button", { name: "Save local comparison" });
  await expect(lifecycle).toContainText("Local comparisons 20/20");
  await expect(lifecycle).toContainText("History full");

  await save.click();
  const reviewHeading = page.getByRole("heading", {
    name: "Save and replace the oldest local comparison?"
  });
  await expect(reviewHeading).toBeFocused();
  await expect(lifecycle.getByLabel("Replace oldest local comparison")).toContainText(
    "Exact oldest prices"
  );
  await lifecycle.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(save).toBeFocused();
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    rawBefore
  );

  await save.click();
  await lifecycle.getByRole("button", { name: "Save and replace oldest" }).click();
  await expect(lifecycle).toContainText("Local comparisons 20/20");
  await page.waitForFunction(
    (raw) => window.localStorage.getItem("index-sim:price-history") !== raw,
    rawBefore
  );
  const afterReplacement = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("index-sim:price-history") ?? "null")
  );
  expect(afterReplacement.data.snapshots).toHaveLength(20);
  expect(afterReplacement.data.snapshots[0].capturedAt).toMatch(/^2026-07-20T15:30:\d{2}\.\d{3}Z$/);
  expect(
    afterReplacement.data.snapshots.some(
      (snapshot: { sourcePriceSetId: string }) => snapshot.sourcePriceSetId === "existing-19"
    )
  ).toBe(false);
  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await page.waitForFunction(
    (raw) => window.localStorage.getItem("index-sim:price-history") === raw,
    rawBefore
  );
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    rawBefore
  );

  const advancedPriceSetTools = page.getByLabel("Advanced PriceSet tools");
  await advancedPriceSetTools.locator(":scope > summary").click();
  await advancedPriceSetTools.locator('input[type="file"]').setInputFiles({
    name: "accepted-while-full.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        id: "accepted-while-full",
        label: "Accepted while full",
        source: "manual",
        createdAt: "2026-07-20T15:00:00.000Z",
        itemPrices: { lobster: 777 },
        alchValues: { lobster: 0 }
      })
    )
  });

  await expect(page.getByLabel("Market active PriceSet summary")).toContainText(
    "Accepted while full"
  );
  await expect(page.getByLabel("Market price data")).toContainText(
    "Local history is full, so this PriceSet was not saved as a comparison"
  );
  await expect(lifecycle).toContainText(
    "Local history is full, so this PriceSet was not saved as a comparison"
  );
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    rawBefore
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
  await page.locator("details.local-history-management > summary").click();
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

test("Economy destructive Undo restores exact durable price history raw data", async ({ page }) => {
  await page.route("**/price-history.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.addInitScript(() => window.localStorage.setItem("index-sim:unrelated-test", "keep"));
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const summary = page.getByLabel("Price history summary");

  await page.getByRole("button", { name: "Save local comparison" }).click();
  await expect(summary).toContainText("Local 1");
  const rawBefore = await page.evaluate(() =>
    window.localStorage.getItem("index-sim:price-history")
  );
  expect(rawBefore).not.toBeNull();

  await page.locator("details.local-history-management > summary").click();
  await page.getByRole("button", { name: "Clear local history" }).click();
  await page.getByRole("button", { name: "Confirm clear local history" }).click();
  await expect(summary).toContainText("Local 0");
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    null
  );

  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await expect(summary).toContainText("Local 1");
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    rawBefore
  );
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:unrelated-test"))).toBe(
    "keep"
  );
  await expect(page.getByLabel("Local price history lifecycle")).toContainText(
    "Restored local price history"
  );

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  await expect(page.getByLabel("Price history summary")).toContainText("Local 1");
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    rawBefore
  );
});

test("Economy destructive Undo restores manual price reset, base Apply and clear", async ({
  page
}) => {
  const manualRaw = JSON.stringify({
    version: 1,
    savedAt: "2026-07-20T00:00:00.000Z",
    data: {
      items: {
        lobster: { price: 123456, updatedAt: "2026-07-20T00:00:00.000Z" },
        unavailable_fixture: { price: 654, updatedAt: "2026-07-20T00:00:00.000Z" }
      }
    }
  });
  await page.addInitScript((raw) => {
    window.localStorage.setItem("index-sim:manual-price-overrides", raw);
    window.localStorage.setItem("index-sim:unrelated-test", "keep");
  }, manualRaw);
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const panel = page.getByRole("region", { name: "Manual item price", exact: true });
  const summary = panel.getByLabel("Manual item price summary");
  const input = panel.getByLabel("Manual price", { exact: true });
  await chooseSearchableOption(panel, "Manual price item", "Lobster", true);
  await expect(summary).toContainText("Active 123,456");
  await expect(panel).toContainText("1 active · 1 unavailable");
  const baseText = await summary
    .locator("span")
    .filter({ hasText: /^Base / })
    .textContent();
  const basePrice = Number((baseText ?? "").replace(/[^0-9.]/g, ""));
  expect(basePrice).toBeGreaterThanOrEqual(0);

  await panel.getByRole("button", { name: "Reset item" }).click();
  await expect(
    page.getByLabel("Local state undo").getByRole("button", { name: "Undo" })
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:manual-price-overrides"))
  ).not.toBe(manualRaw);
  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await expect(summary).toContainText("Active 123,456");
  await expect(input).toHaveValue("123456");
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:manual-price-overrides"))
  ).toBe(manualRaw);

  await input.fill(String(basePrice));
  await panel.getByRole("button", { name: "Apply price" }).click();
  await expect(summary).toContainText("Status Base");
  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await expect(summary).toContainText("Status Manual");
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:manual-price-overrides"))
  ).toBe(manualRaw);

  await panel.getByRole("button", { name: "Clear all manual prices" }).click();
  await panel.getByRole("button", { name: "Confirm clear all manual prices" }).click();
  await expect(
    page.getByLabel("Local state undo").getByRole("button", { name: "Undo" })
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:manual-price-overrides"))
  ).toBeNull();
  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await expect(summary).toContainText("Active 123,456");
  await expect(panel).toContainText("1 active · 1 unavailable");
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:manual-price-overrides"))
  ).toBe(manualRaw);
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:unrelated-test"))).toBe(
    "keep"
  );
});

test("Economy destructive Undo restores imported PriceSet reset without history drift", async ({
  page
}) => {
  await page.addInitScript(() => window.localStorage.setItem("index-sim:unrelated-test", "keep"));
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const market = page.getByLabel("Market price data");
  const tools = market.locator("details.advanced-price-set-tools");
  await tools.locator(":scope > summary").click();
  await tools
    .locator("label.file-button")
    .filter({ hasText: "Import full PriceSet" })
    .locator('input[type="file"]')
    .setInputFiles({
      name: "economy-undo-price-set.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          id: "economy-undo-price-set",
          label: "Economy Undo PriceSet",
          source: "manual",
          createdAt: "2026-07-20T00:00:00.000Z",
          itemPrices: { lobster: 987, big_bones: 654 },
          alchValues: { lobster: 1, big_bones: 2 }
        })
      )
    });
  await expect(market.getByLabel("Market active PriceSet summary")).toContainText(
    "Economy Undo PriceSet"
  );
  const manualPanel = page.getByRole("region", { name: "Manual item price", exact: true });
  await chooseSearchableOption(manualPanel, "Manual price item", "Lobster", true);
  await manualPanel.getByLabel("Manual price", { exact: true }).fill("777");
  const before = await page.evaluate(() => ({
    selected: window.localStorage.getItem("index-sim:price-set:selected"),
    history: window.localStorage.getItem("index-sim:price-history"),
    manual: window.localStorage.getItem("index-sim:manual-price-overrides")
  }));
  expect(before.selected).not.toBeNull();

  await tools.getByRole("button", { name: "Reset imported PriceSet" }).click();
  await market.getByRole("button", { name: "Confirm reset to scheduled prices" }).click();
  await expect(
    page.getByLabel("Local state undo").getByRole("button", { name: "Undo" })
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:price-set:selected"))
  ).toBe(null);
  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await expect(market.getByLabel("Market active PriceSet summary")).toContainText(
    "Economy Undo PriceSet"
  );
  await expect(manualPanel.getByLabel("Manual price", { exact: true })).toHaveValue("777");
  expect(
    await page.evaluate(() => ({
      selected: window.localStorage.getItem("index-sim:price-set:selected"),
      history: window.localStorage.getItem("index-sim:price-history"),
      manual: window.localStorage.getItem("index-sim:manual-price-overrides")
    }))
  ).toEqual(before);
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:unrelated-test"))).toBe(
    "keep"
  );

  await page.reload();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  await expect(page.getByLabel("Market active PriceSet summary")).toContainText(
    "Economy Undo PriceSet"
  );
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:price-set:selected"))
  ).toBe(before.selected);
});

test("Economy destructive Undo stays live-only in a safe session", async ({ page }) => {
  const durableRaw = JSON.stringify({
    version: 2,
    savedAt: "2026-07-20T00:00:00.000Z",
    data: { snapshots: [] }
  });
  await page.addInitScript((raw) => {
    window.localStorage.setItem("index-sim:price-history", raw);
    window.localStorage.setItem("index-sim:unrelated-test", "keep");
  }, durableRaw);
  await page.goto("/?index_sim_safe_session=1");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const summary = page.getByLabel("Price history summary");
  await page.getByRole("button", { name: "Save local comparison" }).click();
  await expect(summary).toContainText("Local 1");
  await page.locator("details.local-history-management > summary").click();
  await page.getByRole("button", { name: "Clear local history" }).click();
  await page.getByRole("button", { name: "Confirm clear local history" }).click();
  await expect(summary).toContainText("Local 0");
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    durableRaw
  );

  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await expect(summary).toContainText("Local 1");
  await expect(page.getByLabel("Local price history lifecycle")).toContainText(
    "Restored local price history for this session"
  );
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    durableRaw
  );
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:unrelated-test"))).toBe(
    "keep"
  );
});

test("Economy destructive Undo restores live state after a price-history clear failure", async ({
  page
}) => {
  await page.route("**/price-history.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const summary = page.getByLabel("Price history summary");
  await page.getByRole("button", { name: "Save local comparison" }).click();
  await expect(summary).toContainText("Local 1");
  const rawBefore = await page.evaluate(() =>
    window.localStorage.getItem("index-sim:price-history")
  );
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key: string) {
      if (key === "index-sim:price-history") {
        Storage.prototype.removeItem = original;
        throw new DOMException("forced private clear failure", "QuotaExceededError");
      }
      return original.call(this, key);
    };
  });

  await page.locator("details.local-history-management > summary").click();
  await page.getByRole("button", { name: "Clear local history" }).click();
  await page.getByRole("button", { name: "Confirm clear local history" }).click();
  await expect(summary).toContainText("Local 0");
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    rawBefore
  );
  await page.getByLabel("Local state undo").getByRole("button", { name: "Undo" }).click();
  await expect(summary).toContainText("Local 1");
  await expect(page.getByLabel("Local price history lifecycle")).toContainText(
    "Saved data was left unchanged"
  );
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    rawBefore
  );
});

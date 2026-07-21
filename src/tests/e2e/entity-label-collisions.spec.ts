import {
  LOOT_PREFS_STORAGE_KEY,
  MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
  expect,
  expectPageWidthContained,
  searchableCombobox,
  searchableInput,
  test
} from "./scaffold-fixture";
import type { Locator, Page } from "@playwright/test";

const COLLIDING_ITEMS = [
  ["loop_half_key", "Half of a key — loop half"],
  ["tooth_half_key", "Half of a key — tooth half"],
  ["dragonhide_black", "Dragonhide — black"],
  ["dragonhide_blue", "Dragonhide — blue"],
  ["dragonhide_green", "Dragonhide — green"],
  ["dragonhide_red", "Dragonhide — red"]
] as const;

async function chooseItemByKeyboard(
  panel: Locator,
  itemId: string,
  expectedLabel: string
): Promise<void> {
  const trigger = searchableCombobox(panel, "Manual price item");
  await trigger.click();
  const input = searchableInput(panel, "Manual price item");
  await input.fill(itemId);
  const options = panel.getByRole("listbox", { name: "Manual price item options" });
  await expect(options.getByRole("option", { name: expectedLabel, exact: true })).toBeVisible();
  await input.press("Enter");
  await expect(trigger).toHaveAttribute("data-selected-id", itemId);
  await expect(trigger).toContainText(expectedLabel);
  await expect(trigger).toBeFocused();
}

async function assertDragonhideOptions(panel: Locator): Promise<void> {
  const trigger = searchableCombobox(panel, "Manual price item");
  await trigger.click();
  const input = searchableInput(panel, "Manual price item");
  await input.fill("dragonhide_");
  const options = panel.getByRole("listbox", { name: "Manual price item options" });
  const names = await options
    .getByRole("option")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")));
  expect(names).toEqual(
    expect.arrayContaining([
      "Dragonhide — black",
      "Dragonhide — blue",
      "Dragonhide — green",
      "Dragonhide — red"
    ])
  );
  expect(new Set(names).size).toBe(names.length);
  await input.press("Escape");
}

async function openEconomy(page: Page): Promise<Locator> {
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Economy" }).click();
  const panel = page.getByRole("region", { name: "Manual item price", exact: true });
  await expect(panel).toBeVisible();
  return panel;
}

test("disambiguates colliding entity labels across selectors and Loot rows", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");

  const manual = await openEconomy(page);
  for (const [itemId, label] of COLLIDING_ITEMS) {
    await chooseItemByKeyboard(manual, itemId, label);
  }
  await chooseItemByKeyboard(manual, "guam_leaf", "Guam leaf — ID guam_leaf");
  await chooseItemByKeyboard(manual, "herb_guam", "Guam leaf — ID herb_guam");

  await chooseItemByKeyboard(manual, "loop_half_key", "Half of a key — loop half");
  await manual.getByLabel("Manual price", { exact: true }).fill("987654");
  await manual.getByRole("button", { name: "Apply price" }).click();
  await page.waitForFunction(
    ([storageKey, itemId]) => {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw).data?.items?.[itemId]?.price === 987654 : false;
    },
    [MANUAL_PRICE_OVERRIDES_STORAGE_KEY, "loop_half_key"]
  );
  await chooseItemByKeyboard(manual, "tooth_half_key", "Half of a key — tooth half");
  await expect(manual.getByLabel("Manual item price summary")).not.toContainText("987,654");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Melee setup" }).click();
  const monsterTrigger = page
    .getByLabel("Setup context")
    .getByRole("button", { name: "Monster", exact: true });
  await monsterTrigger.click();
  const monsterInput = page.getByLabel("Setup context").getByRole("combobox", {
    name: "Monster"
  });
  await monsterInput.fill("hobgoblin_armed");
  await monsterInput.press("Enter");
  await expect(monsterTrigger).toHaveAttribute("data-selected-id", "hobgoblin_armed");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Loot" }).click();

  const loot = page.locator('section[aria-label="Current monster loot"]');
  const table = loot.getByRole("table", { name: "Current monster drops" });
  const coinSelects = table.getByRole("combobox", { name: /^Action for Coins/ });
  const coinRows = coinSelects.locator("xpath=ancestor::tr");
  await expect(coinRows).toHaveCount(7);
  const actionNames = await coinSelects.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("aria-label"))
  );
  expect(new Set(actionNames).size).toBe(7);
  expect(actionNames).toContain("Action for Coins — qty 1.0 · chance 2.34%");
  expect(actionNames).toContain("Action for Coins — qty 1.0 · chance 0.78%");

  const firstCoinRow = coinRows.first();
  await firstCoinRow.getByText("Value details", { exact: true }).click();
  const rowId = await firstCoinRow
    .getByText("Loot row ID", { exact: true })
    .locator("xpath=following-sibling::dd/code")
    .textContent();
  expect(rowId).toBeTruthy();
  if (!rowId) throw new Error("Missing exact Loot row id");
  const gpPerKill = loot
    .getByLabel("Loot action summary")
    .locator(".metric")
    .filter({ hasText: "Loot GP/kill" })
    .locator("strong");
  const beforeGpPerKill = await gpPerKill.textContent();
  await firstCoinRow.locator("select.action-select").selectOption("skip");
  await expect(firstCoinRow.locator("select.action-select")).toHaveValue("skip");
  await expect(coinRows.nth(1).locator("select.action-select")).toHaveValue("loot");
  await expect(gpPerKill).not.toHaveText(beforeGpPerKill ?? "");
  await page.waitForFunction(
    ({ storageKey, monsterId, exactRowId }) => {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw).data?.[monsterId]?.[exactRowId] === "skip" : false;
    },
    { storageKey: LOOT_PREFS_STORAGE_KEY, monsterId: "hobgoblin_armed", exactRowId: rowId }
  );

  for (const viewport of [
    { width: 640, height: 360 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    const responsiveManual = await openEconomy(page);
    await assertDragonhideOptions(responsiveManual);
    await expectPageWidthContained(page);
  }

  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: ":root { font-size: 200% !important; }" });
  const reflowManual = await openEconomy(page);
  await assertDragonhideOptions(reflowManual);
  await expectPageWidthContained(page);
});

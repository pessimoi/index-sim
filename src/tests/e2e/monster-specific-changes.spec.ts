import { GENERATED_BROWSER_FIXTURE_CONTEXT, expect, test } from "./scaffold-fixture";
import { LOOT_PREFS_STORAGE_KEY, LOOT_PREFS_VERSION } from "../../app/state/loot-prefs";
import {
  DEFAULT_MONSTER_LOOT_SETTINGS,
  LOOT_SETTINGS_STORAGE_KEY,
  LOOT_SETTINGS_VERSION
} from "../../app/state/loot-settings";
import {
  DEFAULT_CANNON_SETTINGS,
  DEFAULT_FORM_STATE,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  normalizeFormState,
  savedSetupFromForm
} from "../../app/state/ui-state";
import { DEFAULT_DENSE_COMPARE_STATE } from "../../app/state/dense-compare";
import { lootPreferenceKeysForMonster } from "../../domain/trip";

const monsterId = "dagannoth";
const otherMonsterId = "giant";
const monster = GENERATED_BROWSER_FIXTURE_CONTEXT.gameData.monsters[monsterId]!;
const lootRowId = lootPreferenceKeysForMonster(monster)[0]!;
const customForm = normalizeFormState({
  ...DEFAULT_FORM_STATE,
  monsterId,
  levels: { ...DEFAULT_FORM_STATE.levels, attack: DEFAULT_FORM_STATE.levels.attack + 1 }
});
const setup = savedSetupFromForm(
  customForm,
  { ...DEFAULT_DENSE_COMPARE_STATE, irrelevantMonsterIds: [monsterId] },
  {
    [monsterId]: { ...DEFAULT_CANNON_SETTINGS, enabled: true },
    [otherMonsterId]: DEFAULT_CANNON_SETTINGS
  },
  { [monsterId]: customForm },
  DEFAULT_FORM_STATE,
  "custom"
);

const savedAt = "2026-07-20T12:00:00.000Z";
const fixtureStorage = {
  [REWRITE_SETUP_STORAGE_KEY]: JSON.stringify({
    version: REWRITE_SETUP_VERSION,
    savedAt,
    data: setup
  }),
  [LOOT_PREFS_STORAGE_KEY]: JSON.stringify({
    version: LOOT_PREFS_VERSION,
    savedAt,
    data: {
      [monsterId]: { [lootRowId]: "skip" },
      [otherMonsterId]: { unrelated_fixture_row: "loot" }
    }
  }),
  [LOOT_SETTINGS_STORAGE_KEY]: JSON.stringify({
    version: LOOT_SETTINGS_VERSION,
    savedAt,
    data: {
      [monsterId]: DEFAULT_MONSTER_LOOT_SETTINGS,
      [otherMonsterId]: { highAlch: true, overheadSec: 4, talismanSpot: "overground" }
    }
  })
};

async function openFixture(page: import("@playwright/test").Page) {
  await page.addInitScript((entries) => {
    window.localStorage.clear();
    for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, value);
    window.localStorage.setItem("monster-changes-unrelated-sentinel", "keep-me");
  }, fixtureStorage);
  await page.goto("/");
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  await expect(page.getByLabel("Monster-specific changes")).toBeVisible();
}

test("Monster-specific changes inventory, Review navigation, durable removal and Undo", async ({
  page
}) => {
  await openFixture(page);
  const panel = page.getByLabel("Monster-specific changes");
  await expect(panel).toContainText("2 monsters changed");
  await expect(panel).toContainText("Custom setup 1");
  await expect(panel).toContainText("Cannon 2");
  await expect(panel).toContainText("Loot actions 1");
  await expect(panel).toContainText("Loot settings 2");
  await expect(panel).toContainText("Compare hidden 1");

  await panel.getByLabel("Filter changed monsters").fill("Dagannoth");
  await expect(panel.locator(".monster-change-row")).toHaveCount(1);
  await panel.getByRole("combobox", { name: /^Change category/ }).selectOption("cannon");
  await expect(panel.locator(".monster-change-row")).toHaveCount(1);
  await panel.getByLabel("Filter changed monsters").fill("");
  await expect(panel.locator(".monster-change-row")).toHaveCount(2);
  await panel.getByRole("combobox", { name: /^Change category/ }).selectOption("all");

  const returnToSettings = async () => {
    await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
    await expect(panel).toBeVisible();
  };

  await panel.getByRole("button", { name: "Review Custom setup for Dagannoth" }).click();
  await expect(page.getByRole("heading", { name: "melee loadout" })).toBeFocused();
  await returnToSettings();

  await panel.getByRole("button", { name: "Review Cannon for Dagannoth" }).click();
  await expect(page.getByRole("heading", { name: "Dwarf multicannon" })).toBeFocused();
  await returnToSettings();

  await panel.getByRole("button", { name: "Review Loot actions for Dagannoth" }).click();
  await expect(page.getByRole("heading", { name: "Loot actions" })).toBeFocused();
  await returnToSettings();

  await panel.getByRole("button", { name: "Review Loot settings for Dagannoth" }).click();
  await expect(page.getByRole("heading", { name: "Loot settings" })).toBeFocused();
  await returnToSettings();

  await panel.getByRole("button", { name: "Review Compare hidden for Dagannoth" }).click();
  await expect(page.locator('tr[data-monster-id="dagannoth"]')).toBeFocused();
  await returnToSettings();

  const rawBeforeReview = await page.evaluate(() => ({
    setup: window.localStorage.getItem("index-sim:rewrite-setup"),
    lootPrefs: window.localStorage.getItem("index-sim:loot-prefs"),
    lootSettings: window.localStorage.getItem("index-sim:loot-settings")
  }));
  await panel.getByRole("button", { name: "Review removal for Dagannoth" }).click();
  await expect(panel.getByLabel("Remove all changes for Dagannoth")).toContainText(
    "Custom setup, Cannon, Loot actions, Loot settings, Compare hidden"
  );
  expect(
    await page.evaluate(() => ({
      setup: window.localStorage.getItem("index-sim:rewrite-setup"),
      lootPrefs: window.localStorage.getItem("index-sim:loot-prefs"),
      lootSettings: window.localStorage.getItem("index-sim:loot-settings")
    }))
  ).toEqual(rawBeforeReview);

  await panel.getByRole("button", { name: "Remove all changes", exact: true }).click();
  const undo = page.getByLabel("Local state undo");
  await expect(undo).toContainText("Removed all changes for Dagannoth");
  await expect(panel).toContainText("1 monsters changed");
  await expect(panel.getByRole("heading", { name: /Dagannoth/ })).toHaveCount(0);
  await expect(
    page.getByLabel("Setup context").getByText("Default setup", { exact: true })
  ).toBeVisible();
  await page.waitForFunction(() => {
    const setupData = JSON.parse(window.localStorage.getItem("index-sim:rewrite-setup")!).data;
    const lootPrefs = JSON.parse(window.localStorage.getItem("index-sim:loot-prefs")!).data;
    const lootSettings = JSON.parse(window.localStorage.getItem("index-sim:loot-settings")!).data;
    return (
      setupData.customSetupsByMonster.dagannoth === undefined &&
      setupData.cannonByMonster.dagannoth === undefined &&
      !setupData.denseCompare.irrelevantMonsterIds.includes("dagannoth") &&
      lootPrefs.dagannoth === undefined &&
      lootSettings.dagannoth === undefined &&
      setupData.cannonByMonster.giant !== undefined &&
      lootSettings.giant !== undefined
    );
  });
  expect(
    await page.evaluate(() => window.localStorage.getItem("monster-changes-unrelated-sentinel"))
  ).toBe("keep-me");

  await undo.getByRole("button", { name: "Undo" }).click();
  await expect(panel).toContainText("2 monsters changed");
  await expect(panel.getByRole("heading", { name: /Dagannoth/ })).toBeVisible();
  await page.waitForFunction(() => {
    const setupData = JSON.parse(window.localStorage.getItem("index-sim:rewrite-setup")!).data;
    const lootPrefs = JSON.parse(window.localStorage.getItem("index-sim:loot-prefs")!).data;
    const lootSettings = JSON.parse(window.localStorage.getItem("index-sim:loot-settings")!).data;
    return (
      setupData.customSetupsByMonster.dagannoth !== undefined &&
      setupData.cannonByMonster.dagannoth !== undefined &&
      setupData.denseCompare.irrelevantMonsterIds.includes("dagannoth") &&
      lootPrefs.dagannoth !== undefined &&
      lootSettings.dagannoth !== undefined
    );
  });
});

test("Monster-specific changes cards stay contained at required viewports", async ({ page }) => {
  await openFixture(page);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 620, height: 844 },
    { width: 768, height: 1024 },
    { width: 640, height: 360 },
    { width: 1440, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByLabel("Monster-specific changes")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);
  }
});

import {
  GENERATED_BROWSER_FIXTURE_CONTEXT,
  chooseSearchableOption,
  expect,
  expectAppStatus,
  expectSearchableSelection,
  searchableCombobox,
  searchableOptionLabels,
  selectCombatType,
  test
} from "./scaffold-fixture";
import type { Page } from "@playwright/test";
import {
  HISCORES_LAST_PLAYER_STORAGE_KEY,
  HISCORES_LAST_PLAYER_STORAGE_VERSION
} from "../../adapters/hiscores";
import { DEFAULT_DENSE_COMPARE_STATE } from "../../app/state/dense-compare";
import { DUEL_SNAPSHOTS_STORAGE_KEY, DUEL_SNAPSHOTS_VERSION } from "../../app/state/duel-snapshots";
import {
  HIDDEN_GEAR_TIERS_STORAGE_KEY,
  HIDDEN_GEAR_TIERS_VERSION
} from "../../app/state/hidden-gear-tiers";
import { LOOT_PREFS_STORAGE_KEY, LOOT_PREFS_VERSION } from "../../app/state/loot-prefs";
import { LOOT_SETTINGS_STORAGE_KEY, LOOT_SETTINGS_VERSION } from "../../app/state/loot-settings";
import {
  MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
  MANUAL_PRICE_OVERRIDES_VERSION
} from "../../app/state/manual-price-overrides";
import { PRICE_HISTORY_STORAGE_KEY, PRICE_HISTORY_VERSION } from "../../app/state/price-history";
import {
  SELECTED_PRICE_SET_STORAGE_KEY,
  SELECTED_PRICE_SET_VERSION
} from "../../app/state/selected-price-set";
import {
  DEFAULT_FORM_STATE,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  normalizeFormState,
  savedSetupFromForm,
  setCustomSetupForMonster,
  switchCombatStyleLoadout
} from "../../app/state/ui-state";

const RESET_PROTECTED_STORAGE_KEYS = [
  DUEL_SNAPSHOTS_STORAGE_KEY,
  LOOT_PREFS_STORAGE_KEY,
  LOOT_SETTINGS_STORAGE_KEY,
  HIDDEN_GEAR_TIERS_STORAGE_KEY,
  SELECTED_PRICE_SET_STORAGE_KEY,
  MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
  PRICE_HISTORY_STORAGE_KEY,
  HISCORES_LAST_PLAYER_STORAGE_KEY
] as const;

const resetFixtureRanged = switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged");
const resetFixtureForm = normalizeFormState({
  ...resetFixtureRanged,
  monsterId: "rock_crab",
  weaponId: "yew_longbow",
  ammoId: "addy_arrow",
  styleId: "longrange",
  levels: {
    attack: 74,
    strength: 75,
    defence: 76,
    hitpoints: 77,
    ranged: 78,
    magic: 79,
    prayer: 80
  },
  perStyleLoadouts: {
    ...resetFixtureRanged.perStyleLoadouts,
    melee: {
      ...resetFixtureRanged.perStyleLoadouts.melee,
      weaponId: "dragon_halberd",
      gear: {
        ...resetFixtureRanged.perStyleLoadouts.melee.gear,
        shield: "none"
      },
      prayers: ["clarity"],
      boosts: ["super_def"]
    },
    ranged: {
      ...resetFixtureRanged.perStyleLoadouts.ranged,
      weaponId: "yew_longbow",
      ammoId: "addy_arrow",
      styleId: "longrange"
    },
    magic: {
      ...resetFixtureRanged.perStyleLoadouts.magic,
      spellId: "fire_wave",
      boosts: ["magic"]
    }
  },
  ringOfWealth: true,
  trip: {
    ...resetFixtureRanged.trip,
    foodKey: "swordfish",
    teleport: false,
    bankSeconds: 45
  },
  plannerTargets: { attack: 90, strength: 91, defence: 92, ranged: 93, magic: 94 }
});
const resetFixtureUnrelatedCustom = normalizeFormState({
  ...DEFAULT_FORM_STATE,
  monsterId: "giant",
  levels: { ...DEFAULT_FORM_STATE.levels, attack: 67 }
});
const RESET_FIXTURE_SETUP = savedSetupFromForm(
  resetFixtureForm,
  {
    ...DEFAULT_DENSE_COMPARE_STATE,
    monsterFilter: "dragon",
    dropFilter: "bones"
  },
  { rock_crab: { enabled: true, targets: 3, respawnSec: 18 } },
  setCustomSetupForMonster({}, resetFixtureUnrelatedCustom),
  resetFixtureForm,
  "default"
);
const RESET_PROTECTED_STORAGE_VALUES = {
  [DUEL_SNAPSHOTS_STORAGE_KEY]: {
    version: DUEL_SNAPSHOTS_VERSION,
    savedAt: "2026-07-19T12:00:00.000Z",
    data: {
      snapshots: [
        {
          id: "reset-protected-duel",
          name: "Protected reset fixture",
          form: resetFixtureUnrelatedCustom
        }
      ]
    }
  },
  [LOOT_PREFS_STORAGE_KEY]: {
    version: LOOT_PREFS_VERSION,
    savedAt: "2026-07-19T12:00:00.000Z",
    data: { green_dragon: { key_dragon_bones_0: "skip" } }
  },
  [LOOT_SETTINGS_STORAGE_KEY]: {
    version: LOOT_SETTINGS_VERSION,
    savedAt: "2026-07-19T12:00:00.000Z",
    data: {
      rock_crab: { highAlch: true, overheadSec: 12, talismanSpot: "overground" }
    }
  },
  [HIDDEN_GEAR_TIERS_STORAGE_KEY]: {
    version: HIDDEN_GEAR_TIERS_VERSION,
    savedAt: "2026-07-19T12:00:00.000Z",
    data: { bronze: true }
  },
  [SELECTED_PRICE_SET_STORAGE_KEY]: {
    version: SELECTED_PRICE_SET_VERSION,
    savedAt: "2026-07-19T12:00:00.000Z",
    data: {
      priceSet: GENERATED_BROWSER_FIXTURE_CONTEXT.priceSet,
      selectedAt: "2026-07-19T12:00:00.000Z"
    }
  },
  [MANUAL_PRICE_OVERRIDES_STORAGE_KEY]: {
    version: MANUAL_PRICE_OVERRIDES_VERSION,
    savedAt: "2026-07-19T12:00:00.000Z",
    data: { items: { bones: { price: 123, updatedAt: "2026-07-19T12:00:00.000Z" } } }
  },
  [PRICE_HISTORY_STORAGE_KEY]: {
    version: PRICE_HISTORY_VERSION,
    savedAt: "2026-07-19T12:00:00.000Z",
    data: { snapshots: [] }
  },
  [HISCORES_LAST_PLAYER_STORAGE_KEY]: {
    version: HISCORES_LAST_PLAYER_STORAGE_VERSION,
    savedAt: "2026-07-19T12:00:00.000Z",
    data: { player: "Reset Tester" }
  }
};

async function openResetFixture(page: Page): Promise<void> {
  await page.goto("/prices.json");
  await page.evaluate(
    ({ key, version, setup, protectedValues }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({ version, savedAt: "2026-07-19T12:00:00.000Z", data: setup })
      );
      for (const [protectedKey, value] of Object.entries(protectedValues)) {
        window.localStorage.setItem(protectedKey, JSON.stringify(value));
      }
    },
    {
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      setup: RESET_FIXTURE_SETUP,
      protectedValues: RESET_PROTECTED_STORAGE_VALUES
    }
  );
  await page.goto("/");
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("rock_crab");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("ranged");
  await page.waitForFunction(() => window.localStorage.getItem("index-sim:planner-ui") !== null);
}

async function protectedStorageSnapshot(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(
    (keys) =>
      Object.fromEntries(
        keys.map((key) => {
          const raw = window.localStorage.getItem(key);
          if (!raw) return [key, null];
          const parsed = JSON.parse(raw);
          return [key, JSON.stringify(parsed.data)];
        })
      ),
    RESET_PROTECTED_STORAGE_KEYS
  );
}

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
  await expect(
    page.getByLabel("Setup context").getByText("EFF. XP/HR", { exact: true })
  ).toBeVisible();

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

test("Reset active setup reviews, cancels and durably restores canonical defaults", async ({
  page
}) => {
  test.setTimeout(90_000);
  await openResetFixture(page);
  const setupActions = page.getByLabel("Setup actions");
  const resetButton = setupActions.getByRole("button", { name: "Reset active setup" });
  const setupBefore = await page.evaluate(() =>
    window.localStorage.getItem("index-sim:rewrite-setup")
  );
  const plannerBefore = await page.evaluate(() => {
    const raw = window.localStorage.getItem("index-sim:planner-ui");
    return raw ? JSON.stringify(JSON.parse(raw).data) : null;
  });
  const protectedBefore = await protectedStorageSnapshot(page);

  await resetButton.click();
  const review = page.getByLabel("Reset active setup review");
  await expect(review).toBeVisible();
  await expect(review).toContainText("Rock Crab");
  await expect(review).toContainText("Ranged remains selected");
  await expect(review).toContainText("Default");
  await expect(review).toContainText("Melee, Ranged and Magic");
  await expect(review).toContainText("Player levels");
  await expect(review).toContainText("Loadouts and equipment");
  await expect(review).toContainText("Trip and supplies");
  await expect(review).toContainText("Planner targets");
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:rewrite-setup"))).toBe(
    setupBefore
  );

  await review.getByRole("button", { name: "Cancel" }).click();
  await expect(review).toHaveCount(0);
  await expect(resetButton).toBeFocused();
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:rewrite-setup"))).toBe(
    setupBefore
  );

  await resetButton.click();
  await page
    .getByLabel("Reset active setup review")
    .getByRole("button", { name: "Reset active setup" })
    .click();
  const undo = page.getByLabel("Local state undo");
  await expect(undo).toContainText("Reset active setup to defaults.");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("rock_crab");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("ranged");
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    if (!raw) return false;
    const setup = JSON.parse(raw).data;
    return (
      setup.form?.monsterId === "rock_crab" &&
      setup.form?.combatStyle === "ranged" &&
      setup.form?.levels?.ranged === 50 &&
      setup.form?.perStyleLoadouts?.melee?.weaponId === "rune_scimitar" &&
      setup.form?.perStyleLoadouts?.ranged?.weaponId === "magic_shortbow" &&
      setup.form?.perStyleLoadouts?.magic?.spellId === "fire_bolt" &&
      setup.form?.plannerTargets?.ranged === 50 &&
      setup.customSetupsByMonster?.giant?.levels?.attack === 67 &&
      setup.denseCompare?.monsterFilter === "dragon" &&
      setup.cannonByMonster?.rock_crab?.targets === 3
    );
  });
  expect(
    await page.evaluate(() => {
      const raw = window.localStorage.getItem("index-sim:planner-ui");
      return raw ? JSON.stringify(JSON.parse(raw).data) : null;
    })
  ).toBe(plannerBefore);
  expect(await protectedStorageSnapshot(page)).toEqual(protectedBefore);

  await page.reload();
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("rock_crab");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("ranged");
  expect(await protectedStorageSnapshot(page)).toEqual(protectedBefore);

  await page
    .getByLabel("Setup actions")
    .getByRole("button", { name: "Reset active setup" })
    .click();
  const noOp = page.getByLabel("Reset active setup review");
  await expect(noOp).toContainText("Active setup already matches the defaults.");
  await expect(noOp.getByRole("button", { name: "Reset active setup" })).toHaveCount(0);
});

test("Reset active setup Undo restores the complete prior setup and durable reload", async ({
  page
}) => {
  test.setTimeout(90_000);
  await openResetFixture(page);
  const protectedBefore = await protectedStorageSnapshot(page);
  const setupActions = page.getByLabel("Setup actions");

  await setupActions.getByRole("button", { name: "Reset active setup" }).click();
  await page
    .getByLabel("Reset active setup review")
    .getByRole("button", { name: "Reset active setup" })
    .click();
  const undo = page.getByLabel("Local state undo");
  await undo.getByRole("button", { name: "Undo" }).click();
  await expectAppStatus(page, "Restored setup from before reset.");
  await page.waitForFunction((expected) => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    return raw ? JSON.stringify(JSON.parse(raw).data) === JSON.stringify(expected) : false;
  }, RESET_FIXTURE_SETUP);
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("rock_crab");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("ranged");
  expect(await protectedStorageSnapshot(page)).toEqual(protectedBefore);

  await page.reload();
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("rock_crab");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("ranged");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Ranged setup" }).click();
  await expectSearchableSelection(page.getByLabel("Equipment loadout"), "Weapon", "yew_longbow");
  expect(await protectedStorageSnapshot(page)).toEqual(protectedBefore);
});

test("Reset active setup applies and undoes truthfully in a session-only safe tab", async ({
  page
}) => {
  test.setTimeout(90_000);
  await openResetFixture(page);
  const durableSetup = await page.evaluate(() =>
    window.localStorage.getItem("index-sim:rewrite-setup")
  );
  await page.evaluate(() => window.sessionStorage.setItem("index-sim:saved-data-ignored", "1"));
  await page.reload();
  await expect(page.getByRole("status", { name: "Session-only safe mode" })).toBeVisible();
  await expect(page.getByLabel("Setup saving status")).toContainText("Session only");

  const playerSetup = page.getByLabel("Player setup");
  await playerSetup.getByLabel("ATT", { exact: true }).fill("88");
  await playerSetup.getByLabel("ATT", { exact: true }).press("Enter");
  await expect(playerSetup.getByLabel("ATT", { exact: true })).toHaveValue("88");
  await page
    .getByLabel("Setup actions")
    .getByRole("button", { name: "Reset active setup" })
    .click();
  await page
    .getByLabel("Reset active setup review")
    .getByRole("button", { name: "Reset active setup" })
    .click();

  const undo = page.getByLabel("Local state undo");
  await expect(undo).toContainText(
    "Reset active setup for this session. Changes may not persist after reload."
  );
  await expect(playerSetup.getByLabel("ATT", { exact: true })).toHaveValue("60");
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:rewrite-setup"))).toBe(
    durableSetup
  );

  await undo.getByRole("button", { name: "Undo" }).click();
  await expectAppStatus(
    page,
    "Restored setup from before reset for this session. Changes may not persist after reload."
  );
  await expect(playerSetup.getByLabel("ATT", { exact: true })).toHaveValue("88");
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:rewrite-setup"))).toBe(
    durableSetup
  );
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
  const reloadedTabs = page.getByRole("tablist", { name: "Workbench tabs" });
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

  await tabs.getByRole("tab", { name: "Settings" }).click();
  const reloadedSettings = page.locator('[aria-label="Hidden gear tiers"]');
  await reloadedSettings.getByRole("button", { name: "Show all tiers" }).click();
  const hiddenTierUndo = page.getByLabel("Local state undo");
  await expect(hiddenTierUndo).toContainText("Hidden gear tiers shown");
  await expect(reloadedSettings.getByLabel("Hide iron gear")).not.toBeChecked();
  await hiddenTierUndo.getByRole("button", { name: "Undo" }).click();
  await expect(reloadedSettings.getByLabel("Hide iron gear")).toBeChecked();
});

test("global Undo restores the manual override targeted Reset", async ({ page }) => {
  await page.goto("/");
  await selectCombatType(page, "melee");
  const overrides = page.getByLabel("Manual combat overrides");
  const accuracy = overrides.getByLabel("Accuracy bonus");
  const reset = overrides.getByRole("button", { name: "Reset all overrides" });

  await accuracy.fill("44");
  await accuracy.press("Enter");
  await expect(accuracy).toHaveValue("44");
  await reset.click();
  await expect(accuracy).toHaveValue("");
  const undo = page.getByLabel("Local state undo");
  await expect(undo).toContainText("Manual overrides reset");
  await undo.getByRole("button", { name: "Undo" }).click();
  await expect(accuracy).toHaveValue("44");
  await expect(page.getByLabel("Local state undo")).toHaveCount(0);
  await expectAppStatus(page, "Restored manual combat overrides");
});

test("global Undo stays reachable across supported targeted Reset viewports", async ({ page }) => {
  const viewports = [
    { width: 390, height: 844 },
    { width: 620, height: 844 },
    { width: 768, height: 1024 },
    { width: 640, height: 360 },
    { width: 1440, height: 900 }
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const tabs = page.getByLabel("Workbench tabs");
    await tabs.getByRole("tab", { name: "Settings" }).click();
    const settings = page.locator('[aria-label="Hidden gear tiers"]');
    const iron = settings.getByLabel("Hide iron gear");
    await iron.check();
    const showAllTiers = settings.getByRole("button", { name: "Show all tiers" });
    await showAllTiers.focus();
    await showAllTiers.press("Enter");

    const undo = page.getByLabel("Local state undo");
    await expect(undo).toBeVisible();
    const box = await undo.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    if (viewport.width <= 620 || (viewport.width <= 980 && viewport.height > viewport.width)) {
      await expect(undo.getByRole("button", { name: "Undo" })).toHaveCSS("min-height", "40px");
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true);

    await undo.getByRole("button", { name: "Undo" }).click();
    await expect(iron).toBeChecked();
  }
});

test("creates, restores and removes monster-specific custom setups", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/");
  const tabs = page.getByLabel("Workbench tabs");
  const setupContext = page.getByLabel("Setup context");

  await expect(setupContext).toContainText("Editing default");
  await expect(setupContext.getByLabel("Setup saving status")).toContainText("Saved locally");
  await expect(setupContext.getByRole("button", { name: "Create monster setup" })).toBeVisible();
  await expect(setupContext.getByRole("button", { name: /Edit/ })).toHaveCount(0);
  await expect(setupContext.getByRole("button", { name: "Remove monster setup" })).toHaveCount(0);

  const playerSetup = page.getByLabel("Player setup");
  const attack = playerSetup.getByLabel("ATT", { exact: true });
  await attack.fill("61");
  await attack.press("Enter");
  await expect(setupContext.getByLabel("Setup saving status")).toContainText("Saved locally");
  await chooseSearchableOption(setupContext, "Monster", "Rock Crab");
  await expect(attack).toHaveValue("61");
  await chooseSearchableOption(setupContext, "Monster", "Hill Giant");
  await expect(attack).toHaveValue("61");

  await setupContext.getByRole("button", { name: "Create monster setup" }).click();
  await expect(setupContext).toContainText("Editing custom");
  await expect(setupContext.getByText("Editing custom", { exact: true })).toBeFocused();

  await selectCombatType(page, "melee");
  const equipmentPane = page.getByLabel("Equipment loadout");
  await chooseSearchableOption(equipmentPane, "Weapon", "Dragon halberd");
  await expectSearchableSelection(equipmentPane, "Weapon", "dragon_halberd");

  await setupContext.getByRole("button", { name: "Edit default setup" }).click();
  await expect(setupContext).toContainText("Editing default");
  await expect(setupContext).toContainText("Custom setup saved for Hill Giant.");
  await expect(setupContext.getByText("Editing default", { exact: true })).toBeFocused();
  await expectSearchableSelection(equipmentPane, "Weapon", "rune_scimitar");

  await setupContext.getByRole("button", { name: "Edit monster setup" }).click();
  await expect(setupContext).toContainText("Editing custom");
  await expect(setupContext.getByText("Editing custom", { exact: true })).toBeFocused();
  await expectSearchableSelection(equipmentPane, "Weapon", "dragon_halberd");

  await chooseSearchableOption(setupContext, "Monster", "Rock Crab");
  await expect(setupContext).toContainText("Editing default");
  await expectSearchableSelection(equipmentPane, "Weapon", "rune_scimitar");

  await chooseSearchableOption(setupContext, "Monster", "Hill Giant");
  await expect(setupContext).toContainText("Editing custom");
  await expectSearchableSelection(equipmentPane, "Weapon", "dragon_halberd");

  await tabs.getByRole("tab", { name: "Monsters" }).click();
  await expect(page.locator('tr[aria-selected="true"]')).toContainText("custom");

  await setupContext.getByRole("button", { name: "Remove monster setup" }).click();
  await expect(setupContext).toContainText("Editing default");
  await selectCombatType(page, "melee");
  await expectSearchableSelection(page.getByLabel("Equipment loadout"), "Weapon", "rune_scimitar");
  const customSetupUndo = page.getByLabel("Local state undo");
  await expect(customSetupUndo).toContainText("Removed custom setup for Hill Giant");
  await customSetupUndo.getByRole("button", { name: "Undo" }).click();
  await expect(setupContext).toContainText("Editing custom");
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
  const savedEnvelope = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("index-sim:rewrite-setup") ?? "null")
  );
  expect(Object.keys(savedEnvelope).sort()).toEqual(["data", "savedAt", "version"]);
  expect(savedEnvelope.version).toBe(REWRITE_SETUP_VERSION);
  expect(Date.parse(savedEnvelope.savedAt)).not.toBeNaN();
  expect(Object.keys(savedEnvelope.data).sort()).toEqual([
    "cannonByMonster",
    "customSetupsByMonster",
    "defaultForm",
    "denseCompare",
    "form",
    "setupMode"
  ]);
  expect(savedEnvelope.data.defaultForm.levels.attack).toBe(61);

  await page.reload();
  await expect(page.locator('[data-app-startup-state="ready"]')).toBeVisible();
  await expect(setupContext).toContainText("Editing custom");
  await expect(setupContext.getByLabel("Setup saving status")).toContainText("Saved locally");
  await selectCombatType(page, "melee");
  await expectSearchableSelection(page.getByLabel("Equipment loadout"), "Weapon", "dragon_halberd");

  await setupContext.getByRole("button", { name: "Remove monster setup" }).click();
  await expect(setupContext).toContainText("Editing default");
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

test("reports setup autosave failure and clears it after a successful retry", async ({ page }) => {
  await page.addInitScript(() => {
    const retryWindow = window as typeof window & { __indexSimFailSetupSave: boolean };
    retryWindow.__indexSimFailSetupSave = true;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setupSaveFailure(key: string, value: string) {
      if (key === "index-sim:rewrite-setup" && retryWindow.__indexSimFailSetupSave) {
        throw new Error("private setup save failure");
      }
      return originalSetItem.call(this, key, value);
    };
  });
  await page.goto("/");

  const setupContext = page.getByLabel("Setup context");
  const persistence = setupContext.getByLabel("Setup saving status");
  await expect(persistence).toContainText("Could not save");
  await expect(page.getByRole("complementary", { name: "Changes may not persist" })).toBeVisible();

  await page.evaluate(() => {
    (window as typeof window & { __indexSimFailSetupSave: boolean }).__indexSimFailSetupSave =
      false;
  });
  const attack = page.getByLabel("Player setup").getByLabel("ATT", { exact: true });
  await attack.fill("61");
  await attack.press("Enter");

  await expect(persistence).toContainText("Saved locally");
  await page.waitForFunction(() => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    return raw != null && JSON.parse(raw).data?.form?.levels?.attack === 61;
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

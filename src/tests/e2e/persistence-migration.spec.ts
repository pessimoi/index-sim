import {
  DEFAULT_FORM_STATE,
  DUEL_SNAPSHOTS_STORAGE_KEY,
  DUEL_SNAPSHOTS_VERSION,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  SavedSetupEnvelopeSchema,
  createDuelSnapshot,
  expect,
  expectAppStatus,
  expectSearchableSelection,
  readDownloadText,
  resultMetricSnapshot,
  savedSetupFromForm,
  selectCombatType,
  test
} from "./scaffold-fixture";
import type { Locator } from "./scaffold-fixture";

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
        trip: { safespot: false, protect: "missiles", antifire: true },
        monsterSetups: {
          giant: { combatType: "melee", weapon: "dragon_longsword" }
        },
        cannonByMonster: {
          dagannoth: { enabled: true, targets: 6, respawnSec: 30 }
        },
        duelSetups: [
          {
            name: "Legacy ranged",
            setup: {
              combatType: "ranged",
              weapon: "magic_shortbow",
              ammo: "rune_arrow",
              style: "rapid",
              boosts: ["ranging"]
            }
          }
        ]
      })
    );
    window.localStorage.setItem(
      "sim_planner_v1",
      JSON.stringify({ note: "planner-payload-sentinel" })
    );
    window.localStorage.setItem(
      "index-sim:planner-ui",
      JSON.stringify({
        version: 1,
        savedAt: "2026-07-06T12:00:00.000Z",
        data: {
          metric: "balanced",
          targetLevels: { attack: 70, strength: 70, defence: 50, ranged: 50, magic: 50 },
          currentXp: { attack: 1000, strength: 2000, defence: 0, ranged: 0, magic: 0 },
          skillLocks: {
            attack: false,
            strength: true,
            defence: false,
            ranged: false,
            magic: false
          },
          averageOverSession: true,
          onlyCurrentGear: false,
          gearPool: {}
        }
      })
    );
    window.localStorage.setItem("sim_prices_v1", JSON.stringify({ lobster: 224, big_bones: 390 }));
    window.localStorage.setItem("sim_alch_v1", JSON.stringify({ lobster: 90, big_bones: 0 }));
    window.localStorage.setItem("sim_scraped_at_v1", "1700000000");
    window.localStorage.setItem("sim_scraped_keys_v1", JSON.stringify(["lobster", "big_bones"]));
    window.localStorage.setItem(
      "sim_loot_prefs_v1",
      JSON.stringify({ "Big bones": "bury", "Not a real drop": "skip" })
    );
    window.localStorage.setItem(
      "index-sim:loot-prefs",
      JSON.stringify({
        version: 1,
        savedAt: "2026-07-06T12:00:00.000Z",
        data: {
          giant: {
            key_iron_full_helm_1: "skip"
          }
        }
      })
    );
    window.localStorage.setItem(
      "sim_hidden_tiers_v1",
      JSON.stringify({ bronze: true, red_dhide: true, not_a_tier: true })
    );
    window.localStorage.setItem("sim_compare_sort_v1", JSON.stringify({ key: "name", dir: -1 }));
    window.localStorage.setItem(
      "sim_irrelevant_v1",
      JSON.stringify(["rock_crab", "not_a_monster"])
    );
    window.localStorage.setItem(
      "sim_price_history_v1",
      JSON.stringify([{ note: "history-payload-sentinel" }])
    );
    window.localStorage.setItem("sim_hiscore_player", "Fixture Player");
  });

  await page.goto("/");
  const migration = page.getByLabel("Legacy setup migration");

  await expect(migration).toBeVisible();
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Legacy setup ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Hiscores player ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Loot preferences ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Custom setups ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Cannon map ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Saved setups ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText(
    "Hidden gear tiers ready"
  );
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Compare state ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Planner review-only");
  await expect(migration.getByLabel("Legacy data summary")).toContainText("Prices ready");
  await expect(migration.getByLabel("Legacy data summary")).toContainText(
    "Price history review-only"
  );
  await expect(migration.getByLabel("Legacy data summary")).toContainText(
    "Review-only decisions shown"
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText("Import action:");
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText(
    "Custom setups: 1 importable, 0 skipped"
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText(
    "Cannon map: 1 importable, 0 skipped"
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText(
    "Saved setups: 1 importable, 0 skipped"
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText(
    "Rewrite Planner V1 does not import legacy Planner state; Import and Keep leave it in legacy storage."
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText(
    "Full legacy price history is review-only in V1; 1 history key detected and not migrated."
  );
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText("Keep action:");
  await expect(migration.getByLabel("Legacy migration outcome")).toContainText("Clear action:");
  await expect(migration).not.toContainText("planner-payload-sentinel");
  await expect(migration).not.toContainText("history-payload-sentinel");
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Compatible setup fields"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Legacy custom setups into rewrite monster-specific setups"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Legacy cannon map into rewrite per-monster cannon settings"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Legacy setup comparisons into saved setup storage"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Loot preferences into rewrite per-monster drop actions"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Hidden gear tiers into rewrite gear-menu preferences"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Compare sort into dense compare state"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "Compare hidden monsters into dense compare state"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "sim_planner_v1: review only"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "legacy planner state was detected but not imported"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "sim_scraped_keys_v1: intentional reset"
  );
  const keyReview = migration.getByRole("table", { name: "Legacy storage key review" });
  await expect(keyReview.getByRole("row", { name: /sim_input_v3.*migrate/ })).toBeVisible();
  await expect(keyReview.getByRole("row", { name: /sim_loot_prefs_v1.*migrate/ })).toBeVisible();
  await expect(keyReview.getByRole("row", { name: /sim_hidden_tiers_v1.*migrate/ })).toBeVisible();
  await expect(keyReview.getByRole("row", { name: /sim_compare_sort_v1.*migrate/ })).toBeVisible();
  await expect(keyReview.getByRole("row", { name: /sim_irrelevant_v1.*migrate/ })).toBeVisible();
  await expect(keyReview.getByRole("row", { name: /sim_planner_v1.*review only/ })).toBeVisible();
  await expect(
    keyReview.getByRole("row", { name: /sim_scraped_keys_v1.*intentional reset/ })
  ).toBeVisible();
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "hiddenGearTiers.not_a_tier: unknown hidden tier id"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "lootPrefs.Not a real drop: unknown loot preference row name"
  );
  await expect(migration.getByLabel("Legacy import and review plan")).toContainText(
    "compare.irrelevantMonsterIds.not_a_monster: unknown monster id"
  );

  await migration.getByRole("button", { name: "Import compatible data" }).click();
  await expect(migration).toHaveCount(0);
  await expectAppStatus(page, "Imported compatible legacy data");
  await expect(page.getByLabel("TYPE", { exact: true })).toHaveText("ranged");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("greater_demon");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    return (
      saved.includes('"combatStyle":"ranged"') &&
      saved.includes('"monsterId":"greater_demon"') &&
      saved.includes('"denseCompare"') &&
      saved.includes('"key":"monsterName"') &&
      saved.includes('"direction":"asc"') &&
      saved.includes('"irrelevantMonsterIds":["rock_crab"]') &&
      parsed.data?.customSetupsByMonster?.giant?.weaponId === "dragon_longsword" &&
      parsed.data?.customSetupsByMonster?.giant?.monsterId === "giant" &&
      parsed.data?.cannonByMonster?.dagannoth?.enabled === true &&
      parsed.data?.cannonByMonster?.dagannoth?.targets === 6 &&
      parsed.data?.cannonByMonster?.dagannoth?.respawnSec === 30 &&
      (window.localStorage.getItem("index-sim:duel-snapshots") ?? "").includes(
        '"name":"Legacy ranged"'
      ) &&
      (window.localStorage.getItem("index-sim:hidden-gear-tiers") ?? "").includes(
        '"bronze":true'
      ) &&
      (window.localStorage.getItem("index-sim:hidden-gear-tiers") ?? "").includes(
        '"red_dhide":true'
      ) &&
      (window.localStorage.getItem("index-sim:loot-prefs") ?? "").includes(
        '"key_big_bones_0":"bury"'
      ) &&
      (window.localStorage.getItem("index-sim:loot-prefs") ?? "").includes(
        '"key_iron_full_helm_1":"skip"'
      ) &&
      window.localStorage.getItem("sim_input_v3") !== null &&
      window.localStorage.getItem("sim_planner_v1") !== null &&
      window.localStorage.getItem("sim_loot_prefs_v1") !== null &&
      window.localStorage.getItem("sim_hidden_tiers_v1") !== null &&
      window.localStorage.getItem("sim_compare_sort_v1") !== null &&
      window.localStorage.getItem("sim_irrelevant_v1") !== null &&
      window.localStorage.getItem("sim_prices_v1") !== null &&
      window.localStorage.getItem("sim_alch_v1") !== null &&
      window.localStorage.getItem("sim_scraped_at_v1") !== null &&
      window.localStorage.getItem("sim_scraped_keys_v1") !== null &&
      window.localStorage.getItem("sim_price_history_v1") !== null &&
      window.localStorage.getItem("sim_hiscore_player") !== null &&
      window.localStorage.getItem("index-sim:legacy-migration-dismissed") !== null &&
      (window.localStorage.getItem("index-sim:planner-ui") ?? "").includes('"metric":"balanced"') &&
      !(window.localStorage.getItem("index-sim:planner-ui") ?? "").includes('"metric":"xph"') &&
      (window.localStorage.getItem("index-sim:hiscores:last-player") ?? "").includes(
        "Fixture Player"
      ) &&
      (window.localStorage.getItem("index-sim:price-history") ?? "").includes(
        "legacy-browser-prices"
      ) &&
      (window.localStorage.getItem("index-sim:price-set:selected") ?? "").includes(
        "legacy-browser-prices"
      )
    );
  });
  await expect(page.getByLabel("Market active PriceSet summary")).toContainText(
    "Legacy browser prices"
  );
  const legacyImport = await resultMetricSnapshot(page);
  expect({
    legacyImport
  }).toEqual({
    legacyImport: {
      DPS: "3.06",
      "MAX HIT": "14.0",
      "HIT %": "78.7%",
      "XP/HR": "17,756",
      "GP/HR NET": "-263,827",
      "KILLS/HR": "109",
      "GP/KILL": "122",
      "SUPPLY/KILL": "5,292"
    }
  });
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Setups" }).click();
  await expect(page.getByLabel("Rename saved setup Legacy ranged")).toHaveValue("Legacy ranged");
});

test("updates manual combat overrides and resets to derived values", async ({ page }) => {
  await page.goto("/");

  const setup = page.getByLabel("Combat setup");
  await setup.getByLabel("ACC+", { exact: true }).fill("120");
  await setup.getByLabel("DMG+", { exact: true }).fill("95");
  await setup.getByLabel("SPD", { exact: true }).fill("1.2");
  const assumptions = page.getByLabel("Active assumptions");
  await expect(assumptions).toContainText("Manual combat overrides");

  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"manualOverrides"') &&
      saved.includes('"accuracyBonus":120') &&
      saved.includes('"damageBonus":95') &&
      saved.includes('"attackSpeedSec":1.2')
    );
  });

  await assumptions.getByRole("button", { name: "Reset manual combat overrides" }).click();
  await expect(assumptions).not.toContainText("Manual combat overrides");

  await selectCombatType(page, "melee");
  const overrides = page.getByLabel("Manual combat overrides");
  await expect(overrides.getByLabel("Accuracy bonus")).toHaveValue("");
  await expect(overrides.getByLabel("Damage bonus")).toHaveValue("");
  await expect(overrides.getByLabel("Attack speed sec")).toHaveValue("");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return (
      saved.includes('"accuracyBonus":null') &&
      saved.includes('"damageBonus":null') &&
      saved.includes('"attackSpeedSec":null')
    );
  });
});

test("surfaces setup requirement warnings and reviews the active loadout", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Combat setup").getByLabel("DEF", { exact: true }).fill("1");

  const assumptions = page.getByLabel("Active assumptions");
  await expect(assumptions).toContainText("Setup requirements");
  await expect(assumptions).toContainText("Rune full helm requires Defence 40");
  await expect(
    assumptions.getByRole("button", { name: "Review Setup requirements" })
  ).toBeVisible();

  await assumptions.getByRole("button", { name: "Review Setup requirements" }).click();
  await expect(
    page.getByLabel("Workbench tabs").getByRole("tab", { name: "Melee setup" })
  ).toHaveAttribute("aria-selected", "true");

  const equipmentPane = page.getByLabel("Equipment loadout");
  await expect(equipmentPane).toBeVisible();
  await expect(equipmentPane.getByRole("button", { name: "Best Body" })).toHaveAttribute(
    "title",
    "Best visible option: Rune platebody - requires Defence 40, current 1"
  );
  await expect(equipmentPane.getByLabel("Setup requirement warnings")).toContainText(
    "Rune platebody requires Defence 40; current Defence 1."
  );
  await expect(equipmentPane).toContainText("Generated requirement data");
  await expect(equipmentPane).not.toContainText("Manual requirement fallback");
});

test("keeps legacy data and dismisses the migration notice", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "sim_input_v3",
      JSON.stringify({
        combatType: "melee",
        monsterSetups: { giant: { weapon: "dragon_longsword" } },
        cannonByMonster: { dagannoth: { enabled: true, targets: 6, respawnSec: 30 } }
      })
    );
    window.localStorage.setItem("sim_planner_v1", "{not json");
  });

  await page.goto("/");
  const migration = page.getByLabel("Legacy setup migration");
  await expect(migration).toBeVisible();

  await migration.getByRole("button", { name: "Keep legacy data" }).click();
  await expect(migration).toHaveCount(0);
  await expectAppStatus(page, "Kept legacy data");
  await page.waitForFunction(() => {
    const legacyInput = window.localStorage.getItem("sim_input_v3") ?? "";
    return (
      legacyInput.includes("monsterSetups") &&
      legacyInput.includes("cannonByMonster") &&
      window.localStorage.getItem("sim_planner_v1") !== null &&
      window.localStorage.getItem("index-sim:legacy-migration-dismissed") !== null
    );
  });
});

test("surfaces and clears invalid rewrite local state in Settings", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("index-sim:hidden-gear-tiers", "{");
    window.localStorage.setItem("sim_input_v3", JSON.stringify({ combatType: "melee" }));
    window.localStorage.setItem("index-sim:unknown-test", "keep");
  });

  await page.goto("/");
  const migrationNotice = page.getByLabel("Legacy setup migration");
  const migrationMetrics = await migrationNotice.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: window.getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight
  }));
  expect(migrationMetrics.overflowY).toBe("auto");
  expect(migrationMetrics.scrollHeight).toBeGreaterThan(migrationMetrics.clientHeight);

  const settingsTab = page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" });
  await settingsTab.focus();
  await settingsTab.press("Enter");

  const recovery = page.getByLabel("Local state recovery");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("Hidden gear tiers");
  await expect(recovery).toContainText("Saved data is not valid JSON");
  await expect(recovery).toContainText("Needs attention 1");
  expect(
    await page.evaluate(() => window.localStorage.getItem("index-sim:hidden-gear-tiers"))
  ).toBe("{");

  await recovery.getByRole("button", { name: "Clear Hidden gear tiers" }).click();
  await recovery.getByRole("button", { name: "Confirm clear Hidden gear tiers" }).click();
  await expect(recovery).toContainText("Cleared Hidden gear tiers");
  await expect(recovery).toContainText("Needs attention 0");

  expect(
    await page.evaluate(
      () =>
        window.localStorage.getItem("index-sim:hidden-gear-tiers") === null &&
        window.localStorage.getItem("sim_input_v3") !== null &&
        window.localStorage.getItem("index-sim:unknown-test") === "keep"
    )
  ).toBe(true);
});

test("falls back without overwriting a setup that references unavailable game data", async ({
  page
}) => {
  const unavailableMonsterId = "removed_revision_monster";
  const incompatibleSetup = savedSetupFromForm({
    ...DEFAULT_FORM_STATE,
    monsterId: unavailableMonsterId
  });
  await page.addInitScript(
    ({ key, version, setup }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version,
          savedAt: "2026-07-11T00:00:00.000Z",
          data: setup
        })
      );
    },
    {
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      setup: incompatibleSetup
    }
  );

  await page.goto("/");
  await expect(page.getByLabel("Combat setup").getByLabel("TARGET", { exact: true })).toHaveValue(
    DEFAULT_FORM_STATE.monsterId
  );
  await expectAppStatus(page, "Saved rewrite setup is incompatible; defaults are active");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const recovery = page.getByLabel("Local state recovery");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("Rewrite setup");
  await expect(recovery).toContainText("Saved data failed validation");
  await expect(recovery).toContainText("Needs attention 1");
  await expect(recovery).not.toContainText(unavailableMonsterId);

  expect(
    await page.evaluate(
      ({ key, unavailableId }) => (window.localStorage.getItem(key) ?? "").includes(unavailableId),
      { key: REWRITE_SETUP_STORAGE_KEY, unavailableId: unavailableMonsterId }
    )
  ).toBe(true);
});

test("keeps incompatible saved Duel snapshots recoverable and out of the runtime", async ({
  page
}) => {
  const unavailableMonsterId = "removed_duel_monster";
  const snapshot = createDuelSnapshot("removed-duel", "Removed Duel target", {
    ...DEFAULT_FORM_STATE,
    monsterId: unavailableMonsterId
  });
  await page.addInitScript(
    ({ key, version, savedSnapshot }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          version,
          savedAt: "2026-07-11T00:00:00.000Z",
          data: { snapshots: [savedSnapshot] }
        })
      );
    },
    {
      key: DUEL_SNAPSHOTS_STORAGE_KEY,
      version: DUEL_SNAPSHOTS_VERSION,
      savedSnapshot: snapshot
    }
  );

  await page.goto("/");
  await expectAppStatus(page, "Saved setup comparisons are incompatible; an empty list is active");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Setups" }).click();
  await expect(page.getByRole("region", { name: "Setup comparison", exact: true })).toContainText(
    "0 / 12 saved setups"
  );

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const recovery = page.getByLabel("Local state recovery");
  await expect(recovery).toContainText("Saved setups");
  await expect(recovery).toContainText("Needs attention 1");
  await expect(recovery).not.toContainText(unavailableMonsterId);
  expect(
    await page.evaluate(
      ({ key, unavailableId }) => (window.localStorage.getItem(key) ?? "").includes(unavailableId),
      { key: DUEL_SNAPSHOTS_STORAGE_KEY, unavailableId: unavailableMonsterId }
    )
  ).toBe(true);
});

test("surfaces rewrite local storage save failures without losing current session edits", async ({
  page
}) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key: string, value: string) {
      if (String(key).startsWith("index-sim:")) {
        throw new Error("raw localStorage failure payload");
      }
      return originalSetItem.call(this, key, value);
    };
  });

  await page.goto("/");
  const defenceInput = page.getByLabel("Combat setup").getByLabel("DEF", { exact: true });
  await defenceInput.fill("7");
  await expect(defenceInput).toHaveValue("7");

  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const recovery = page.getByLabel("Local state recovery");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText(
    "Local storage is unavailable. Changes may not persist after reload."
  );
  await expect(recovery).toContainText("Save failed");
  await expect(recovery).toContainText("Current session data remains active");
  await expect(recovery).not.toContainText("raw localStorage failure payload");
});

test("clears only known legacy data after confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "sim_input_v3",
      JSON.stringify({
        combatType: "melee",
        monsterSetups: { giant: { weapon: "dragon_longsword" } },
        cannonByMonster: { dagannoth: { enabled: true, targets: 6, respawnSec: 30 } }
      })
    );
    window.localStorage.setItem("sim_planner_v1", "{}");
    window.localStorage.setItem("sim_loot_prefs_v1", "{}");
    window.localStorage.setItem("sim_hidden_tiers_v1", "{}");
    window.localStorage.setItem("sim_compare_sort_v1", "{}");
    window.localStorage.setItem("sim_irrelevant_v1", "{}");
    window.localStorage.setItem("sim_loot_comp_open", "1");
    window.localStorage.setItem("sim_prices_v1", "{}");
    window.localStorage.setItem("sim_alch_v1", "{}");
    window.localStorage.setItem("sim_scraped_at_v1", "2026-07-05T12:00:00.000Z");
    window.localStorage.setItem("sim_scraped_keys_v1", "[]");
    window.localStorage.setItem("sim_price_history_v1", "[]");
    window.localStorage.setItem("sim_price_history_sanitized_v1", "[]");
    window.localStorage.setItem("sim_price_history_sanitized_v2", "[]");
    window.localStorage.setItem("sim_price_history_sanitized_v3", "[]");
    window.localStorage.setItem("sim_price_history_sanitized_v4", "[]");
    window.localStorage.setItem("sim_hiscore_player", "Fixture Player");
    window.localStorage.setItem("unrelated_key", "keep");
  });

  await page.goto("/");
  const migration = page.getByLabel("Legacy setup migration");
  await expect(migration).toBeVisible();

  await migration.getByRole("button", { name: "Clear legacy data" }).click();
  await expect(migration).toContainText("Clear will remove these known legacy keys");
  await expect(migration).toContainText("sim_loot_prefs_v1");
  await expect(migration).toContainText("sim_price_history_sanitized_v4");
  await expect(migration.getByRole("button", { name: "Confirm clear" })).toBeVisible();
  await migration.getByRole("button", { name: "Confirm clear" }).click();
  await expect(migration).toHaveCount(0);
  await expectAppStatus(page, "Cleared 17 legacy keys");
  await page.waitForFunction(() => {
    const knownKeys = [
      "sim_input_v3",
      "sim_planner_v1",
      "sim_loot_prefs_v1",
      "sim_hidden_tiers_v1",
      "sim_compare_sort_v1",
      "sim_irrelevant_v1",
      "sim_loot_comp_open",
      "sim_prices_v1",
      "sim_alch_v1",
      "sim_scraped_at_v1",
      "sim_scraped_keys_v1",
      "sim_price_history_v1",
      "sim_price_history_sanitized_v1",
      "sim_price_history_sanitized_v2",
      "sim_price_history_sanitized_v3",
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

test("exports current rewrite setup and completes successful setup import", async ({ page }) => {
  await page.goto("/");
  const topbarActions = page.locator(".topbar > .actions");
  await expect(topbarActions.getByRole("button", { name: "Export setup" })).toBeVisible();
  const transferControls = topbarActions.locator("label.file-button, button");
  expect(
    (await transferControls.allTextContents()).map((text) => text.trim().replace(/\s+/g, " "))
  ).toEqual(["Import prices", "Import setup", "Export setup", "Share setup"]);

  const downloadPromise = page.waitForEvent("download");
  await topbarActions.getByRole("button", { name: "Export setup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("index-sim-rewrite-setup.json");
  const exportedText = await readDownloadText(download);
  const exported = SavedSetupEnvelopeSchema.parse(JSON.parse(exportedText));
  expect(exported.version).toBe(REWRITE_SETUP_VERSION);
  expect(Number.isNaN(Date.parse(exported.savedAt))).toBe(false);
  expect(Object.keys(exported.data).sort()).toEqual([
    "cannonByMonster",
    "customSetupsByMonster",
    "defaultForm",
    "denseCompare",
    "form",
    "setupMode"
  ]);
  expect(exported.data.form.monsterId).toBe("giant");
  expect(exportedText).not.toContain("duelSnapshots");
  expect(exportedText).not.toContain("lootPrefsByMonster");
  expect(exportedText).not.toContain("plannerState");
  expect(exportedText).not.toContain("priceHistory");

  const defaultForm = savedSetupFromForm({
    ...DEFAULT_FORM_STATE,
    monsterId: "giant",
    levels: { ...DEFAULT_FORM_STATE.levels, attack: 64, strength: 65 }
  }).form;
  const customForm = savedSetupFromForm({
    ...defaultForm,
    weaponId: "dragon_longsword",
    levels: { ...defaultForm.levels, attack: 77, strength: 78 }
  }).form;
  const importedSetup = savedSetupFromForm(
    customForm,
    {
      sort: { key: "monsterName", direction: "asc" },
      monsterFilter: "dragon",
      dropFilter: "bones",
      showIrrelevant: true,
      irrelevantMonsterIds: ["rock_crab"]
    },
    { giant: { enabled: true, targets: 4, respawnSec: 45 } },
    { giant: customForm },
    defaultForm,
    "custom"
  );
  const setupInput = topbarActions
    .locator("label.file-button")
    .filter({ hasText: "Import setup" })
    .locator('input[type="file"]');
  await setupInput.setInputFiles({
    name: "rewrite-setup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: REWRITE_SETUP_VERSION,
        savedAt: "2026-07-01T12:00:00.000Z",
        data: importedSetup
      })
    )
  });

  const setupNotice = page.getByLabel("Setup import notice");
  await expect(setupNotice).toHaveText("Imported rewrite setup.");
  await expect(setupNotice).toHaveAttribute("role", "status");
  await expect(setupNotice).toHaveClass(/topbar-import-notice setup-import-notice/);
  expect(
    await setupNotice.evaluate((element) =>
      Array.from(element.parentElement?.children ?? []).indexOf(element)
    )
  ).toBe(4);
  await expect(setupInput).toHaveValue("");
  await expect(page.locator('span.visually-hidden[role="status"]')).toHaveText(
    "Imported rewrite setup"
  );
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("giant");
  await expect(page.getByLabel("Setup context")).toContainText("Custom setup");

  const tabs = page.getByLabel("Workbench tabs");
  await tabs.getByRole("tab", { name: "Melee setup" }).click();
  const loadout = page.getByRole("region", { name: "Equipment loadout", exact: true });
  await expectSearchableSelection(loadout, "Weapon", "dragon_longsword");

  await tabs.getByRole("tab", { name: "Monsters" }).click();
  const denseFilters = page.getByLabel("Dense compare filters");
  await expect(denseFilters.getByLabel("Monster filter")).toHaveValue("dragon");
  await expect(denseFilters.getByLabel("Drop filter")).toHaveValue("bones");
  await expect(denseFilters.getByLabel("Show hidden / irrelevant")).toBeChecked();

  await tabs.getByRole("tab", { name: "Cannon" }).click();
  const cannon = page.getByLabel("Cannon", { exact: true });
  await expect(cannon.getByLabel("Set up cannon")).toBeChecked();
  await expect(cannon.getByLabel("Mobs at spot")).toHaveValue("4");
  await expect(cannon.getByRole("spinbutton", { name: "Respawn", exact: true })).toHaveValue("45");

  await page.waitForFunction((expectedSetup) => {
    const raw = window.localStorage.getItem("index-sim:rewrite-setup");
    if (!raw) return false;
    return JSON.stringify(JSON.parse(raw).data) === JSON.stringify(expectedSetup);
  }, importedSetup);
  const persisted = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("index-sim:rewrite-setup") ?? "null")
  );
  expect(persisted.savedAt).not.toBe("2026-07-01T12:00:00.000Z");
  expect(persisted.data).toEqual(importedSetup);

  await tabs.getByRole("tab", { name: "Melee setup" }).click();
  await page
    .getByLabel("Setup context")
    .getByRole("button", { name: "Remove custom setup" })
    .click();
  await expect(page.getByLabel("Setup context")).toContainText("Default setup");
  await expectSearchableSelection(loadout, "Weapon", "rune_scimitar");
});

test("keeps setup import failures non-fatal and retryable", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("TARGET", { exact: true }).selectOption("dagannoth");
  await page.waitForFunction(() => {
    const saved = window.localStorage.getItem("index-sim:rewrite-setup") ?? "";
    return saved.includes('"monsterId":"dagannoth"');
  });

  const beforeMetrics = await resultMetricSnapshot(page);
  const savedBefore = await page.evaluate(() =>
    window.localStorage.getItem("index-sim:rewrite-setup")
  );
  const setupInput = page
    .locator(".topbar")
    .locator("label.file-button")
    .filter({ hasText: "Import setup" })
    .locator('input[type="file"]');

  await setupInput.setInputFiles({
    name: "broken-setup.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not-json")
  });

  await expect(page.getByLabel("Workbench shell")).toBeVisible();
  await expect(page.getByLabel("Setup import notice")).toContainText("not valid JSON");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("dagannoth");
  expect(await resultMetricSnapshot(page)).toEqual(beforeMetrics);
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:rewrite-setup"))).toBe(
    savedBefore
  );
  await expect(setupInput).toHaveValue("");

  await setupInput.setInputFiles({
    name: "wrong-version-setup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 999,
        savedAt: "2026-07-07T12:00:00.000Z",
        data: {}
      })
    )
  });

  await expect(page.getByLabel("Workbench shell")).toBeVisible();
  await expect(page.getByLabel("Setup import notice")).toContainText("version");
  await expect(page.getByLabel("TARGET", { exact: true })).toHaveValue("dagannoth");
  expect(await resultMetricSnapshot(page)).toEqual(beforeMetrics);
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:rewrite-setup"))).toBe(
    savedBefore
  );
  await expect(setupInput).toHaveValue("");
});

test("keeps PriceSet import failures non-fatal and recoverable", async ({ page }) => {
  await page.route("**/price-history.json", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto("/");
  await page.getByLabel("Workbench tabs").getByRole("tab", { name: "Settings" }).click();
  const settings = page.locator('[aria-label="Price data settings"]');
  const priceSetSummary = settings.locator('[aria-label="Active PriceSet summary"]');
  const historySummary = page.locator('[aria-label="Price history summary"]');
  const summaryText = async (locator: Locator) =>
    (await locator.locator("span").allTextContents()).map((text) => text.trim()).join(" | ");

  const priceSetBefore = await summaryText(priceSetSummary);
  const historyBefore = await summaryText(historySummary);
  const storedHistoryBefore = await page.evaluate(() =>
    window.localStorage.getItem("index-sim:price-history")
  );
  const topbarPriceInput = page
    .locator(".topbar")
    .locator("label.file-button")
    .filter({ hasText: "Import prices" })
    .locator('input[type="file"]');

  await topbarPriceInput.setInputFiles({
    name: "bad-price-set.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        id: "bad-price-set",
        label: "Bad price set",
        source: "manual",
        createdAt: "2026-07-07T12:00:00.000Z",
        itemPrices: { lobster: -1, shark: "expensive" },
        alchValues: { lobster: 0 }
      })
    )
  });

  await expect(page.getByLabel("Workbench shell")).toBeVisible();
  await expect(page.locator(".topbar").getByLabel("Price import notice")).toContainText(
    "Code validation_failed"
  );
  await expect(page.locator(".topbar").getByLabel("Price import notice")).toContainText(
    "itemPrices.lobster"
  );
  await expect(page.locator(".topbar").getByLabel("Price import notice")).toContainText(
    "Import was not applied"
  );
  await expect(page.locator(".topbar").getByLabel("Price import notice")).not.toContainText(
    "SyntaxError"
  );
  await expect(page.locator(".topbar").getByLabel("Price import notice")).not.toContainText(
    "expensive"
  );
  await expect(page.locator(".topbar").getByLabel("Price import notice")).not.toContainText(
    process.cwd()
  );
  await expect(topbarPriceInput).toHaveValue("");
  expect(await summaryText(priceSetSummary)).toBe(priceSetBefore);
  expect(await summaryText(historySummary)).toBe(historyBefore);
  expect(await page.evaluate(() => window.localStorage.getItem("index-sim:price-history"))).toBe(
    storedHistoryBefore
  );

  const importedPriceSet = {
    id: "manual-after-error",
    label: "Imported after error prices",
    source: "manual",
    createdAt: "2026-07-07T12:00:00.000Z",
    itemPrices: { big_bones: 900, lobster: 80 },
    alchValues: { big_bones: 0, lobster: 0 }
  };
  await settings
    .locator("label.file-button")
    .filter({ hasText: "Import PriceSet" })
    .locator('input[type="file"]')
    .setInputFiles({
      name: "manual-after-error-prices.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(importedPriceSet))
    });

  await expect(settings.getByLabel("Price import notice")).toContainText("Imported market prices");
  await expect(priceSetSummary).toContainText("Label Imported after error prices");
  await expect(historySummary).toContainText("Snapshots 1");
});

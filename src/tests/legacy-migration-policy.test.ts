import { loadBundledLegacyContext } from "../adapters/legacy-runtime";
import { createMemoryStorage, type KeyValueStorage } from "../adapters/storage";
import {
  LEGACY_INPUT_STORAGE_KEY,
  LEGACY_STORAGE_KEYS,
  LEGACY_STORAGE_KEY_POLICIES,
  clearKnownLegacyStorageKeys,
  createLegacyStorageKeyReview,
  detectLegacyStorageKeys,
  inspectLegacySetupMigration
} from "../app/state/legacy-storage-migration";
import { HIDDEN_GEAR_TIERS_STORAGE_KEY } from "../app/state/hidden-gear-tiers";
import { LOOT_PREFS_STORAGE_KEY } from "../app/state/loot-prefs";
import { PLANNER_UI_STORAGE_KEY } from "../app/state/planner";
import { REWRITE_SETUP_STORAGE_KEY } from "../app/state/ui-state";
import type { GameDataSnapshot } from "../domain/shared";

describe("legacy migration policy", () => {
  let gameData: GameDataSnapshot;

  beforeAll(async () => {
    const loaded = await loadBundledLegacyContext();
    gameData = loaded.context.gameData;
  });

  it("detects known legacy storage keys without reading arbitrary keys", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: "{}",
      sim_planner_v1: "{}",
      sim_hiscore_player: "zezima",
      unrelated_key: "ignored"
    });

    expect(detectLegacyStorageKeys(storage)).toEqual([
      LEGACY_INPUT_STORAGE_KEY,
      "sim_planner_v1",
      "sim_hiscore_player"
    ]);
  });

  it("classifies every known legacy storage key for review/reset UX", () => {
    const policyKeys = LEGACY_STORAGE_KEY_POLICIES.map((policy) => policy.key);
    const review = createLegacyStorageKeyReview([
      LEGACY_INPUT_STORAGE_KEY,
      "sim_scraped_keys_v1",
      "sim_hidden_tiers_v1",
      "sim_irrelevant_v1",
      "sim_loot_comp_open"
    ]);

    expect(policyKeys).toEqual([...LEGACY_STORAGE_KEYS]);
    expect(new Set(policyKeys).size).toBe(LEGACY_STORAGE_KEYS.length);
    expect(
      LEGACY_STORAGE_KEY_POLICIES.every((policy) =>
        ["migrate", "review-only", "intentional-reset", "legacy-only"].includes(policy.disposition)
      )
    ).toBe(true);
    expect(review).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: LEGACY_INPUT_STORAGE_KEY,
          disposition: "migrate",
          found: true,
          clearDeletes: true
        }),
        expect.objectContaining({
          key: "sim_scraped_keys_v1",
          disposition: "intentional-reset",
          found: true,
          clearDeletes: true
        }),
        expect.objectContaining({
          key: "sim_loot_prefs_v1",
          disposition: "migrate",
          found: false,
          clearDeletes: false
        }),
        expect.objectContaining({
          key: "sim_loot_comp_open",
          disposition: "legacy-only",
          found: true,
          clearDeletes: true
        }),
        expect.objectContaining({
          key: "sim_planner_v1",
          disposition: "review-only",
          found: false,
          clearDeletes: false
        }),
        expect.objectContaining({
          key: "sim_hidden_tiers_v1",
          disposition: "migrate",
          found: true,
          clearDeletes: true
        }),
        expect.objectContaining({
          key: "sim_compare_sort_v1",
          disposition: "migrate",
          found: false,
          clearDeletes: false
        }),
        expect.objectContaining({
          key: "sim_irrelevant_v1",
          disposition: "migrate",
          found: true,
          clearDeletes: true
        })
      ])
    );
  });

  it("does not write to legacy or rewrite storage keys while inspecting migration state", () => {
    const values = new Map<string, string>([
      [LEGACY_INPUT_STORAGE_KEY, JSON.stringify({ combatType: "melee" })],
      ["sim_loot_prefs_v1", JSON.stringify({ "Big bones": "bury" })],
      ["sim_hidden_tiers_v1", JSON.stringify({ bronze: true })],
      ["sim_compare_sort_v1", JSON.stringify({ key: "dps", dir: -1 })],
      ["sim_irrelevant_v1", JSON.stringify(["rock_crab"])],
      ["sim_planner_v1", "{}"],
      [LOOT_PREFS_STORAGE_KEY, "existing rewrite loot prefs"],
      [HIDDEN_GEAR_TIERS_STORAGE_KEY, "existing rewrite hidden tiers"],
      [PLANNER_UI_STORAGE_KEY, "existing rewrite planner state"],
      [REWRITE_SETUP_STORAGE_KEY, "existing rewrite state"]
    ]);
    const writes: string[] = [];
    const storage: KeyValueStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        writes.push(`set:${key}:${value}`);
      },
      removeItem: (key) => {
        writes.push(`remove:${key}`);
      }
    };

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.foundKeys).toEqual([
      LEGACY_INPUT_STORAGE_KEY,
      "sim_planner_v1",
      "sim_loot_prefs_v1",
      "sim_hidden_tiers_v1",
      "sim_compare_sort_v1",
      "sim_irrelevant_v1"
    ]);
    expect(writes).toEqual([]);
    expect(values.get(LEGACY_INPUT_STORAGE_KEY)).toBe(JSON.stringify({ combatType: "melee" }));
    expect(values.get(LOOT_PREFS_STORAGE_KEY)).toBe("existing rewrite loot prefs");
    expect(values.get(HIDDEN_GEAR_TIERS_STORAGE_KEY)).toBe("existing rewrite hidden tiers");
    expect(values.get(PLANNER_UI_STORAGE_KEY)).toBe("existing rewrite planner state");
    expect(values.get(REWRITE_SETUP_STORAGE_KEY)).toBe("existing rewrite state");
  });

  it("detects legacy planner state without parsing or importing it", () => {
    const storage = createMemoryStorage({
      sim_planner_v1: "{not json"
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.foundKeys).toEqual(["sim_planner_v1"]);
    expect(report.importedFields).not.toEqual(
      expect.arrayContaining([expect.stringContaining("planner")])
    );
    expect(report.setup).toBeNull();
    expect(report.hiscoresPlayer).toBeNull();
    expect(report.priceSet).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: "planner.state",
      reason: "legacy planner state was detected but not imported"
    });
    expect(report.skippedFields).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: "invalid JSON" })])
    );
    expect(report.warnings).toContain(
      "Legacy planner state was detected but not imported; it will be kept unless you clear known legacy keys."
    );
  });

  it("keeps oversized legacy planner state on the review-only boundary", () => {
    const storage = createMemoryStorage({
      sim_planner_v1: JSON.stringify({ pad: "x".repeat(50) })
    });

    const report = inspectLegacySetupMigration({
      storage,
      gameData,
      maxPlannerBytes: 20
    });

    expect(report.foundKeys).toEqual(["sim_planner_v1"]);
    expect(report.importedFields).not.toEqual(
      expect.arrayContaining([expect.stringContaining("planner")])
    );
    expect(report.skippedFields).toContainEqual({
      field: "planner.state",
      reason:
        "legacy planner state was detected but not imported because it exceeds safe review size limit"
    });
    expect(report.warnings.join(" ")).toContain("safe review size limit");
    expect(storage.getItem("sim_planner_v1")).not.toBeNull();
  });

  it("detects legacy price history without importing it", () => {
    const storage = createMemoryStorage({
      sim_price_history_sanitized_v4: "[]"
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.priceSet).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: "prices.history",
      reason: "legacy price history migration is not supported in this flow"
    });
    expect(report.warnings).toContain("Legacy price history was detected but not imported.");
    expect(report.keyReview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "sim_price_history_sanitized_v4",
          disposition: "review-only",
          found: true
        })
      ])
    );
  });

  it("clears only known legacy keys when explicitly requested", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: "{}",
      sim_planner_v1: "{}",
      sim_hidden_tiers_v1: "{}",
      sim_compare_sort_v1: "{}",
      sim_irrelevant_v1: "[]",
      sim_prices_v1: "{}",
      sim_price_history_sanitized_v4: "[]",
      sim_hiscore_player: "Fixture Player",
      [REWRITE_SETUP_STORAGE_KEY]: "rewrite state",
      unrelated_key: "keep"
    });

    expect(clearKnownLegacyStorageKeys(storage)).toEqual([
      LEGACY_INPUT_STORAGE_KEY,
      "sim_planner_v1",
      "sim_hidden_tiers_v1",
      "sim_compare_sort_v1",
      "sim_irrelevant_v1",
      "sim_prices_v1",
      "sim_price_history_sanitized_v4",
      "sim_hiscore_player"
    ]);

    expect(storage.getItem(LEGACY_INPUT_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("sim_planner_v1")).toBeNull();
    expect(storage.getItem("sim_hidden_tiers_v1")).toBeNull();
    expect(storage.getItem("sim_compare_sort_v1")).toBeNull();
    expect(storage.getItem("sim_irrelevant_v1")).toBeNull();
    expect(storage.getItem("sim_prices_v1")).toBeNull();
    expect(storage.getItem("sim_price_history_sanitized_v4")).toBeNull();
    expect(storage.getItem("sim_hiscore_player")).toBeNull();
    expect(storage.getItem(REWRITE_SETUP_STORAGE_KEY)).toBe("rewrite state");
    expect(storage.getItem("unrelated_key")).toBe("keep");
  });
});

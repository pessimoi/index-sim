import { loadBundledLegacyContext } from "../adapters/legacy-runtime";
import { createMemoryStorage } from "../adapters/storage";
import { inspectLegacySetupMigration } from "../app/state/legacy-storage-migration";
import type { GameDataSnapshot } from "../domain/shared";

describe("legacy preference migration", () => {
  let gameData: GameDataSnapshot;

  beforeAll(async () => {
    const loaded = await loadBundledLegacyContext();
    gameData = loaded.context.gameData;
  });

  it("imports valid legacy loot preferences into unambiguous rewrite row ids", () => {
    const storage = createMemoryStorage({
      sim_loot_prefs_v1: JSON.stringify({
        "Big bones": "bury"
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.lootPrefs).not.toBeNull();
    expect(report.lootPrefs?.giant).toMatchObject({
      key_big_bones_0: "bury"
    });
    expect(report.importedFields).toContain("lootPrefs");
  });

  it("reports partial legacy loot preference imports for unknown rows and invalid actions", () => {
    const storage = createMemoryStorage({
      sim_loot_prefs_v1: JSON.stringify({
        "Big bones": "bury",
        "Not a real drop": "skip",
        Bones: "dance"
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.lootPrefs?.giant).toMatchObject({
      key_big_bones_0: "bury"
    });
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        {
          field: "lootPrefs.Not a real drop",
          reason: "unknown loot preference row name"
        },
        {
          field: "lootPrefs.Bones",
          reason: "unknown loot action"
        }
      ])
    );
  });

  it("skips ambiguous legacy loot preference names for a monster instead of guessing a row id", () => {
    const storage = createMemoryStorage({
      sim_loot_prefs_v1: JSON.stringify({
        Coins: "skip"
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "lootPrefs.giant.Coins",
          reason: "ambiguous legacy drop name for monster"
        })
      ])
    );
  });

  it("skips oversized legacy loot preference payloads before parsing", () => {
    const storage = createMemoryStorage({
      sim_loot_prefs_v1: JSON.stringify({
        "Big bones": "bury",
        pad: "x".repeat(50)
      })
    });

    const report = inspectLegacySetupMigration({
      storage,
      gameData,
      maxLootPrefsBytes: 20
    });

    expect(report.lootPrefs).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: "sim_loot_prefs_v1",
      reason: "legacy value exceeds safe size limit"
    });
  });

  it("imports valid legacy hidden gear tiers into the migration report", () => {
    const storage = createMemoryStorage({
      sim_hidden_tiers_v1: JSON.stringify({
        bronze: true,
        iron: false,
        red_dhide: true
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.hiddenGearTiers).toEqual({
      bronze: true,
      red_dhide: true
    });
    expect(report.importedFields).toContain("hiddenGearTiers");
  });

  it("skips unknown hidden tier ids while importing known tier flags", () => {
    const storage = createMemoryStorage({
      sim_hidden_tiers_v1: JSON.stringify({
        bronze: true,
        not_a_tier: true
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.hiddenGearTiers).toEqual({ bronze: true });
    expect(report.skippedFields).toContainEqual({
      field: "hiddenGearTiers.not_a_tier",
      reason: "unknown hidden tier id"
    });
  });

  it("imports valid legacy compare sort into dense compare sort state", () => {
    const storage = createMemoryStorage({
      sim_compare_sort_v1: JSON.stringify({
        key: "effectiveXpPerHour",
        dir: -1
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.denseCompareSort).toEqual({
      key: "xpPerHour",
      direction: "desc"
    });
    expect(report.importedFields).toContain("compare.sort");
  });

  it("skips invalid legacy compare sort safely", () => {
    const invalidKeyStorage = createMemoryStorage({
      sim_compare_sort_v1: JSON.stringify({
        key: "not_a_sort_key",
        dir: -1
      })
    });
    const invalidDirectionStorage = createMemoryStorage({
      sim_compare_sort_v1: JSON.stringify({
        key: "dps",
        dir: 0
      })
    });

    const invalidKeyReport = inspectLegacySetupMigration({ storage: invalidKeyStorage, gameData });
    const invalidDirectionReport = inspectLegacySetupMigration({
      storage: invalidDirectionStorage,
      gameData
    });

    expect(invalidKeyReport.denseCompareSort).toBeNull();
    expect(invalidKeyReport.skippedFields).toContainEqual({
      field: "compare.sort",
      reason: "unknown compare sort key"
    });
    expect(invalidDirectionReport.denseCompareSort).toBeNull();
    expect(invalidDirectionReport.skippedFields).toContainEqual({
      field: "compare.sort",
      reason: "unknown compare sort direction"
    });
  });

  it("imports valid legacy irrelevant monster ids into dense compare state", () => {
    const storage = createMemoryStorage({
      sim_irrelevant_v1: JSON.stringify(["rock_crab", "greater_demon", "rock_crab"])
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.irrelevantMonsterIds).toEqual(["rock_crab", "greater_demon"]);
    expect(report.importedFields).toContain("compare.irrelevantMonsterIds");
  });

  it("skips unknown legacy irrelevant monster ids while importing known ids", () => {
    const storage = createMemoryStorage({
      sim_irrelevant_v1: JSON.stringify(["not_a_monster", "rock_crab"])
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.irrelevantMonsterIds).toEqual(["rock_crab"]);
    expect(report.skippedFields).toContainEqual({
      field: "compare.irrelevantMonsterIds.not_a_monster",
      reason: "unknown monster id"
    });
  });

  it("skips oversized legacy UI state payloads before parsing", () => {
    const storage = createMemoryStorage({
      sim_hidden_tiers_v1: JSON.stringify({ bronze: true, pad: "x".repeat(50) })
    });

    const report = inspectLegacySetupMigration({
      storage,
      gameData,
      maxUiStateBytes: 20
    });

    expect(report.hiddenGearTiers).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: "sim_hidden_tiers_v1",
      reason: "legacy value exceeds safe size limit"
    });
  });

  it("imports a valid legacy hiscores player into the migration report", () => {
    const storage = createMemoryStorage({
      sim_hiscore_player: " Fixture Player "
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.hiscoresPlayer).toBe("Fixture Player");
    expect(report.importedFields).toContain("hiscores.player");
    expect(report.skippedFields).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "hiscores.player" })])
    );
  });

  it("ignores malformed legacy hiscores values with sanitized warnings", () => {
    const storage = createMemoryStorage({
      sim_hiscore_player: "<script>bad</script>"
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.hiscoresPlayer).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: "hiscores.player",
      reason: "invalid hiscores player name"
    });
    expect(report.warnings.join(" ")).not.toContain("<script>");
  });
});

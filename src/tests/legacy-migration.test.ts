import { loadBundledLegacyContext } from "../adapters/browser";
import {
  createMemoryStorage,
  type KeyValueStorage
} from "../adapters/storage";
import {
  LEGACY_INPUT_STORAGE_KEY,
  LEGACY_STORAGE_KEYS,
  LEGACY_STORAGE_KEY_POLICIES,
  clearKnownLegacyStorageKeys,
  createLegacyStorageKeyReview,
  detectLegacyStorageKeys,
  inspectLegacySetupMigration
} from "../adapters/storage/legacy-migration";
import { PLANNER_UI_STORAGE_KEY } from "../app/state/planner";
import { DEFAULT_FORM_STATE, REWRITE_SETUP_STORAGE_KEY } from "../app/state/ui-state";
import type { GameDataSnapshot, PriceSet } from "../domain/shared";

describe("legacy storage migration foundation", () => {
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
      "sim_loot_comp_open"
    ]);

    expect(policyKeys).toEqual([...LEGACY_STORAGE_KEYS]);
    expect(new Set(policyKeys).size).toBe(LEGACY_STORAGE_KEYS.length);
    expect(
      LEGACY_STORAGE_KEY_POLICIES.every((policy) =>
        ["migrate", "review-only", "intentional-reset", "legacy-only"].includes(
          policy.disposition
        )
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
        })
      ])
    );
  });

  it("maps safely validated legacy sim_input_v3 fields into rewrite form state", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({
        combatType: "ranged",
        attack: 61,
        strength: 62,
        defence: 63,
        hp: 64,
        ranged: 72,
        magic: 65,
        prayer: 43,
        _monsterId: "greater_demon",
        weapon: "magic_shortbow",
        ammo: "rune_arrow",
        spell: "fire_bolt",
        style: "rapid",
        gear: {
          helm: "none",
          amulet: "amu_power",
          body: "black_dhide_body",
          legs: "black_dhide_legs",
          shield: "none",
          gloves: "none",
          boots: "ranger_boots",
          cape: "cape_legends",
          ring: "ring_of_wealth"
        },
        trip: {
          foodKey: "shark",
          teleport: false,
          bankSeconds: 130,
          prayerMode: "altar",
          alching: true,
          recoverAmmo: false,
          antifire: true,
          antipoison: true,
          safespot: false,
          protect: "missiles",
          recoilRings: 3,
          foodCount: 5,
          foodPerKillOverride: 0.5,
          altarSeconds: 45
        }
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.setup).toMatchObject({
      combatStyle: "ranged",
      monsterId: "greater_demon",
      weaponId: "magic_shortbow",
      ammoId: "rune_arrow",
      spellId: "fire_bolt",
      styleId: "rapid",
      levels: {
        attack: 61,
        strength: 62,
        defence: 63,
        hitpoints: 64,
        ranged: 72,
        magic: 65,
        prayer: 43
      },
      gear: {
        amulet: "amu_power",
        body: "black_dhide_body",
        legs: "black_dhide_legs",
        boots: "ranger_boots",
        cape: "cape_legends",
        ring: "ring_of_wealth"
      },
      trip: {
        foodKey: "shark",
        teleport: false,
        bankSeconds: 130,
        prayerMode: "altar",
        alching: true,
        recoverAmmo: false,
        antifire: true,
        antipoison: true,
        safespot: false,
        protect: "missiles",
        recoilRings: 3,
        foodCount: 5,
        foodPerKillOverride: 0.5,
        altarSeconds: 45
      }
    });
    expect(report.importedFields).toEqual(
      expect.arrayContaining([
        "combatStyle",
        "levels.hitpoints",
        "monsterId",
        "weaponId",
        "ammoId",
        "styleId",
        "gear.body",
        "trip.foodKey",
        "trip.protect",
        "trip.altarSeconds"
      ])
    );
    expect(report.skippedFields).toEqual([]);
  });

  it("reports malformed legacy JSON without returning a setup candidate", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: "{bad json"
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.foundKeys).toEqual([LEGACY_INPUT_STORAGE_KEY]);
    expect(report.setup).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: LEGACY_INPUT_STORAGE_KEY,
      reason: "invalid JSON"
    });
    expect(report.warnings).toEqual(
      expect.arrayContaining(["Legacy setup input could not be parsed as JSON."])
    );
  });

  it("reports invalid non-object legacy setup state without returning a setup candidate", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify(["combatType", "melee"])
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.setup).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: LEGACY_INPUT_STORAGE_KEY,
      reason: "expected an object"
    });
    expect(report.warnings).toEqual(
      expect.arrayContaining(["Legacy setup input was ignored because it is not an object."])
    );
  });

  it("skips unknown entity ids instead of passing them into the rewrite form", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({
        combatType: "magic",
        _monsterId: "not_a_monster",
        weapon: "not_a_weapon",
        ammo: "not_ammo",
        spell: "not_a_spell",
        style: "not_a_style",
        gear: {
          helm: "not_a_helm",
          ring: "ring_of_wealth"
        }
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.setup).toMatchObject({
      combatStyle: "magic",
      monsterId: DEFAULT_FORM_STATE.monsterId,
      weaponId: "staff_of_fire",
      spellId: "fire_bolt",
      gear: {
        helm: DEFAULT_FORM_STATE.gear.helm,
        ring: "ring_of_wealth"
      }
    });
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        { field: "monsterId", reason: "unknown monster id" },
        { field: "weaponId", reason: "unknown weapon id or weapon does not match combat style" },
        { field: "ammoId", reason: "unknown ammo id" },
        { field: "spellId", reason: "unknown spell id" },
        { field: "styleId", reason: "unknown style id for combat style and weapon" },
        { field: "gear.helm", reason: "unknown gear id for slot" }
      ])
    );
  });

  it("keeps defaults for malformed numeric values and imports only finite in-range numbers", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({
        combatType: "melee",
        attack: 0,
        strength: 99,
        defence: 100,
        hp: Number.POSITIVE_INFINITY,
        ranged: 70,
        magic: 12.5,
        prayer: 43,
        trip: {
          bankSeconds: -1,
          recoilRings: 29,
          foodCount: 7,
          foodPerKillOverride: Number.NaN,
          prayerPotionDoses: 112,
          altarSeconds: 3601
        }
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.setup?.levels).toMatchObject({
      attack: DEFAULT_FORM_STATE.levels.attack,
      strength: 99,
      defence: DEFAULT_FORM_STATE.levels.defence,
      hitpoints: DEFAULT_FORM_STATE.levels.hitpoints,
      ranged: 70,
      magic: DEFAULT_FORM_STATE.levels.magic,
      prayer: 43
    });
    expect(report.setup?.trip).toMatchObject({
      bankSeconds: DEFAULT_FORM_STATE.trip.bankSeconds,
      recoilRings: DEFAULT_FORM_STATE.trip.recoilRings,
      foodCount: 7,
      foodPerKillOverride: DEFAULT_FORM_STATE.trip.foodPerKillOverride,
      prayerPotionDoses: 112,
      altarSeconds: DEFAULT_FORM_STATE.trip.altarSeconds
    });
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        { field: "levels.attack", reason: "expected an integer level from 1 to 99" },
        { field: "levels.defence", reason: "expected an integer level from 1 to 99" },
        { field: "levels.magic", reason: "expected an integer level from 1 to 99" },
        { field: "trip.bankSeconds", reason: "expected an integer from 0 to 3600" },
        { field: "trip.recoilRings", reason: "expected an integer from 1 to 28" },
        { field: "trip.altarSeconds", reason: "expected null or an integer from 0 to 3600" }
      ])
    );
  });

  it("does not write to legacy or rewrite storage keys while inspecting migration state", () => {
    const values = new Map<string, string>([
      [LEGACY_INPUT_STORAGE_KEY, JSON.stringify({ combatType: "melee" })],
      ["sim_planner_v1", "{}"],
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

    expect(report.foundKeys).toEqual([LEGACY_INPUT_STORAGE_KEY, "sim_planner_v1"]);
    expect(writes).toEqual([]);
    expect(values.get(LEGACY_INPUT_STORAGE_KEY)).toBe(JSON.stringify({ combatType: "melee" }));
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

  it("turns valid legacy price and alch maps into an explicit price set", () => {
    const storage = createMemoryStorage({
      sim_prices_v1: JSON.stringify({ lobster: 224, big_bones: 390 }),
      sim_alch_v1: JSON.stringify({ lobster: 90, big_bones: 0 }),
      sim_scraped_at_v1: "1700000000"
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.priceSet).toMatchObject({
      id: "legacy-browser-prices",
      label: "Legacy browser prices",
      source: "imported",
      createdAt: "2023-11-14T22:13:20.000Z",
      itemPrices: { lobster: 224, big_bones: 390 },
      alchValues: { lobster: 90, big_bones: 0 }
    });
    expect(report.importedFields).toContain("prices.priceSet");
  });

  it("skips malformed legacy price JSON safely", () => {
    const storage = createMemoryStorage({
      sim_prices_v1: "{bad json",
      sim_alch_v1: JSON.stringify({ lobster: 90 })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.priceSet).toBeNull();
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        { field: "sim_prices_v1", reason: "invalid JSON" },
        { field: "prices.priceSet", reason: "legacy price set could not be parsed safely" }
      ])
    );
  });

  it("skips invalid legacy price maps safely", () => {
    const storage = createMemoryStorage({
      sim_prices_v1: JSON.stringify({ lobster: -1 }),
      sim_alch_v1: JSON.stringify({ lobster: 90 })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.priceSet).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: "prices.priceSet",
      reason: "legacy price set failed schema validation"
    });
  });

  it("skips unknown legacy price item ids safely", () => {
    const storage = createMemoryStorage({
      sim_prices_v1: JSON.stringify({ not_a_real_item: 12 }),
      sim_alch_v1: JSON.stringify({ not_a_real_item: 0 })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.priceSet).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: "prices.priceSet",
      reason: "legacy price set includes unknown item ids"
    });
  });

  it("skips oversized legacy price payloads before parsing", () => {
    const storage = createMemoryStorage({
      sim_prices_v1: JSON.stringify({ lobster: 224, pad: "x".repeat(50) }),
      sim_alch_v1: JSON.stringify({ lobster: 90 })
    });

    const report = inspectLegacySetupMigration({
      storage,
      gameData,
      maxPriceBytes: 20
    });

    expect(report.priceSet).toBeNull();
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        { field: "sim_prices_v1", reason: "legacy value exceeds safe size limit" },
        { field: "prices.priceSet", reason: "legacy price set could not be parsed safely" }
      ])
    );
  });

  it("keeps the current price set when legacy price import fails", () => {
    const currentPriceSet: PriceSet = {
      id: "current-prices",
      label: "Current prices",
      source: "bundled",
      createdAt: "2026-07-05T12:00:00.000Z",
      itemPrices: { lobster: 203 },
      alchValues: { lobster: 90 }
    };
    const storage = createMemoryStorage({
      sim_prices_v1: JSON.stringify({ lobster: -1 }),
      sim_alch_v1: JSON.stringify({ lobster: 90 })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });
    const selectedPriceSet = report.priceSet ?? currentPriceSet;

    expect(selectedPriceSet).toBe(currentPriceSet);
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
      "sim_prices_v1",
      "sim_price_history_sanitized_v4",
      "sim_hiscore_player"
    ]);

    expect(storage.getItem(LEGACY_INPUT_STORAGE_KEY)).toBeNull();
    expect(storage.getItem("sim_planner_v1")).toBeNull();
    expect(storage.getItem("sim_hidden_tiers_v1")).toBeNull();
    expect(storage.getItem("sim_compare_sort_v1")).toBeNull();
    expect(storage.getItem("sim_prices_v1")).toBeNull();
    expect(storage.getItem("sim_price_history_sanitized_v4")).toBeNull();
    expect(storage.getItem("sim_hiscore_player")).toBeNull();
    expect(storage.getItem(REWRITE_SETUP_STORAGE_KEY)).toBe("rewrite state");
    expect(storage.getItem("unrelated_key")).toBe("keep");
  });

  it("ignores oversized legacy setup payloads before parsing", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({ combatType: "melee", pad: "x".repeat(50) })
    });

    const report = inspectLegacySetupMigration({
      storage,
      gameData,
      maxInputBytes: 20
    });

    expect(report.setup).toBeNull();
    expect(report.skippedFields).toContainEqual({
      field: LEGACY_INPUT_STORAGE_KEY,
      reason: "legacy input exceeds safe size limit"
    });
  });
});

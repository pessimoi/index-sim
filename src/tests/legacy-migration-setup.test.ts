import { loadCurrentTestContext } from "./helpers/current-sim";
import { createMemoryStorage } from "../adapters/storage";
import {
  LEGACY_INPUT_STORAGE_KEY,
  inspectLegacySetupMigration
} from "../app/state/legacy-storage-migration";
import { MAX_DUEL_SNAPSHOTS, createDuelSnapshot } from "../app/state/duel-snapshots";
import { DEFAULT_FORM_STATE, normalizeFormState } from "../app/state/ui-state";
import type { GameDataSnapshot } from "../domain/shared";

describe("legacy setup migration", () => {
  let gameData: GameDataSnapshot;

  beforeAll(async () => {
    const loaded = await loadCurrentTestContext();
    gameData = loaded.context.gameData;
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
          potionSets: 2,
          potionDoses: 6,
          singleDose: true,
          dbaRestore: false,
          prayerMode: "altar",
          alching: true,
          recoverAmmo: false,
          runeSlots: 3,
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
        potionSets: 2,
        potionDoses: 6,
        singleDose: true,
        dbaRestore: false,
        prayerMode: "altar",
        alching: true,
        recoverAmmo: false,
        runeSlots: 3,
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
        "trip.potionSets",
        "trip.potionDoses",
        "trip.singleDose",
        "trip.dbaRestore",
        "trip.runeSlots",
        "trip.protect",
        "trip.altarSeconds"
      ])
    );
    expect(report.skippedFields).toEqual([]);
  });

  it("imports valid legacy custom setup and cannon maps while skipping unknown monsters", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({
        combatType: "melee",
        monsterSetups: {
          giant: {
            combatType: "ranged",
            weapon: "magic_shortbow",
            ammo: "rune_arrow",
            style: "rapid",
            gear: {
              body: "black_dhide_body",
              legs: "black_dhide_legs"
            }
          },
          not_a_current_monster: { combatType: "magic" }
        },
        cannonByMonster: {
          dagannoth: { enabled: true, targets: 6, respawnSec: 30 },
          not_a_current_monster: { enabled: true, targets: 99 }
        }
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.setup?.combatStyle).toBe("melee");
    expect(report.customSetupsByMonster?.giant).toMatchObject({
      combatStyle: "ranged",
      monsterId: "giant",
      weaponId: "magic_shortbow",
      ammoId: "rune_arrow",
      styleId: "rapid",
      gear: {
        body: "black_dhide_body",
        legs: "black_dhide_legs"
      }
    });
    expect(report.cannonByMonster?.dagannoth).toEqual({
      enabled: true,
      targets: 6,
      respawnSec: 30
    });
    expect(report.importedFields).toEqual(
      expect.arrayContaining([
        "customSetupsByMonster",
        "customSetupsByMonster.giant",
        "sim_input_v3.monsterSetups.giant.combatStyle",
        "sim_input_v3.monsterSetups.giant.weaponId",
        "cannonByMonster",
        "cannonByMonster.dagannoth"
      ])
    );
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "sim_input_v3.monsterSetups.not_a_current_monster",
          reason: "unknown monster id"
        }),
        expect.objectContaining({
          field: "sim_input_v3.cannonByMonster.not_a_current_monster",
          reason: "unknown monster id"
        })
      ])
    );
    expect(report.warnings).not.toEqual(
      expect.arrayContaining([
        "Legacy custom setup snapshots did not contain any safely importable entries.",
        "Legacy cannon map did not contain any safely importable entries."
      ])
    );
  });

  it("imports validated legacy Duel snapshots with inherited player context", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({
        combatType: "melee",
        attack: 71,
        strength: 72,
        defence: 73,
        hp: 74,
        ranged: 75,
        magic: 76,
        prayer: 77,
        _monsterId: "greater_demon",
        duelSetups: [
          {
            name: "  Rune   arrows  ",
            setup: {
              combatType: "ranged",
              weapon: "magic_shortbow",
              ammo: "rune_arrow",
              style: "rapid",
              prayers: ["clarity"],
              boosts: ["ranging"],
              sustained: false,
              repotThreshold: null,
              ringOfWealth: true,
              specWeapon: "magic_shortbow",
              specAmmo: "rune_arrow"
            }
          },
          { name: "Missing setup" },
          {
            name: "Computed payload",
            setup: { combatType: "melee", weapon: "rune_scimitar" },
            result: { effectiveXpPerHour: 123 }
          }
        ]
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.duelSnapshots?.snapshots).toHaveLength(1);
    expect(report.duelSnapshots?.snapshots[0]).toMatchObject({
      id: "legacy-duel-1",
      name: "Rune arrows",
      form: {
        combatStyle: "ranged",
        monsterId: "greater_demon",
        weaponId: "magic_shortbow",
        ammoId: "rune_arrow",
        styleId: "rapid",
        levels: {
          attack: 71,
          strength: 72,
          defence: 73,
          hitpoints: 74,
          ranged: 75,
          magic: 76,
          prayer: 77
        },
        prayers: ["clarity"],
        boosts: ["ranging"],
        sustained: false,
        repotThreshold: null,
        ringOfWealth: true,
        specialAttack: { weaponId: "magic_shortbow", ammoId: "rune_arrow" }
      }
    });
    expect(report.importedFields).toEqual(
      expect.arrayContaining([
        "duelSnapshots",
        "duelSnapshots.legacy-duel-1",
        "sim_input_v3.duelSetups.0.prayers",
        "sim_input_v3.duelSetups.0.boosts",
        "sim_input_v3.duelSetups.0.specialAttack"
      ])
    );
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "sim_input_v3.duelSetups.1",
          reason: "expected an object with a setup snapshot"
        }),
        expect.objectContaining({
          field: "sim_input_v3.duelSetups.2",
          reason: "computed result payloads are not imported"
        })
      ])
    );
  });

  it("keeps rewrite Duel snapshots and applies the shared snapshot limit", () => {
    const currentSnapshots = {
      snapshots: [
        createDuelSnapshot("legacy-duel-1", "Rewrite owned", DEFAULT_FORM_STATE),
        ...Array.from({ length: MAX_DUEL_SNAPSHOTS - 2 }, (_, index) =>
          createDuelSnapshot(`current-${index}`, `Current ${index}`, DEFAULT_FORM_STATE)
        )
      ]
    };
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({
        duelSetups: [
          { name: "Conflict", setup: { combatType: "melee", weapon: "rune_scimitar" } },
          { name: "Fits", setup: { combatType: "melee", weapon: "dragon_longsword" } },
          { name: "Overflow", setup: { combatType: "ranged", weapon: "magic_shortbow" } }
        ]
      })
    });

    const report = inspectLegacySetupMigration({
      storage,
      gameData,
      currentDuelSnapshots: currentSnapshots
    });

    expect(report.setup).toBeNull();
    expect(report.duelSnapshots?.snapshots.map((snapshot) => snapshot.id)).toEqual([
      "legacy-duel-2"
    ]);
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "sim_input_v3.duelSetups.0",
          reason: "rewrite Duel snapshot already exists; kept rewrite-owned snapshot"
        }),
        expect.objectContaining({
          field: "sim_input_v3.duelSetups.2",
          reason: "rewrite Duel snapshot limit has no remaining room"
        })
      ])
    );
  });

  it("keeps existing rewrite custom setup entries over conflicting legacy snapshots", () => {
    const existingGiantSetup = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "giant",
      weaponId: "dragon_longsword"
    });
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({
        monsterSetups: {
          giant: { combatType: "ranged", weapon: "magic_shortbow" },
          rock_crab: { combatType: "melee", weapon: "dragon_longsword" }
        }
      })
    });

    const report = inspectLegacySetupMigration({
      storage,
      gameData,
      currentCustomSetupsByMonster: { giant: existingGiantSetup }
    });

    expect(report.customSetupsByMonster?.giant).toBeUndefined();
    expect(report.customSetupsByMonster?.rock_crab).toMatchObject({
      monsterId: "rock_crab",
      weaponId: "dragon_longsword"
    });
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "sim_input_v3.monsterSetups.giant",
          reason: "rewrite custom setup already exists; kept rewrite-owned setup"
        })
      ])
    );
  });

  it("reports invalid legacy custom setup and cannon map shapes with sanitized reasons", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({
        combatType: "melee",
        monsterSetups: ["not", "a", "map"],
        cannonByMonster: "not a map"
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.setup?.combatStyle).toBe("melee");
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "sim_input_v3.monsterSetups",
          reason:
            "legacy custom setup snapshots were skipped because the shape is not an object map"
        }),
        expect.objectContaining({
          field: "sim_input_v3.cannonByMonster",
          reason: "legacy cannon map was skipped because the shape is not an object map"
        })
      ])
    );
    expect(report.warnings.join(" ")).not.toContain("not a map");
  });

  it("skips invalid legacy cannon settings and unsafe nested map keys", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({
        cannonByMonster: {
          giant: { enabled: "yes", targets: 3 },
          rock_crab: { enabled: true, targets: 9, respawnSec: 30 },
          dagannoth: { enabled: true, targets: 6, respawnSec: null },
          constructor: { enabled: true, targets: 3 }
        }
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.cannonByMonster).toEqual({
      dagannoth: { enabled: true, targets: 6, respawnSec: null }
    });
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        {
          field: "sim_input_v3.cannonByMonster.giant.enabled",
          reason: "expected a boolean"
        },
        {
          field: "sim_input_v3.cannonByMonster.rock_crab.targets",
          reason: "expected an integer from 1 to 8"
        },
        {
          field: "sim_input_v3.cannonByMonster.constructor",
          reason: "unsafe legacy map key"
        }
      ])
    );
  });

  it.each(["{bad json", '{"combatType":"melee","combatType":"ranged"}'])(
    "reports malformed or ambiguous legacy JSON without returning a setup candidate",
    (legacyJson) => {
      const storage = createMemoryStorage({
        [LEGACY_INPUT_STORAGE_KEY]: legacyJson
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
    }
  );

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
          potionSets: -1,
          potionDoses: 113,
          singleDose: "yes",
          dbaRestore: "no",
          recoilRings: 29,
          foodCount: 7,
          foodPerKillOverride: Number.NaN,
          prayerPotionDoses: 112,
          runeSlots: 29,
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
      potionSets: DEFAULT_FORM_STATE.trip.potionSets,
      potionDoses: DEFAULT_FORM_STATE.trip.potionDoses,
      singleDose: DEFAULT_FORM_STATE.trip.singleDose,
      dbaRestore: DEFAULT_FORM_STATE.trip.dbaRestore,
      recoilRings: DEFAULT_FORM_STATE.trip.recoilRings,
      foodCount: 7,
      foodPerKillOverride: DEFAULT_FORM_STATE.trip.foodPerKillOverride,
      prayerPotionDoses: 112,
      runeSlots: DEFAULT_FORM_STATE.trip.runeSlots,
      altarSeconds: DEFAULT_FORM_STATE.trip.altarSeconds
    });
    expect(report.skippedFields).toEqual(
      expect.arrayContaining([
        { field: "levels.attack", reason: "expected an integer level from 1 to 99" },
        { field: "levels.defence", reason: "expected an integer level from 1 to 99" },
        { field: "levels.magic", reason: "expected an integer level from 1 to 99" },
        { field: "trip.bankSeconds", reason: "expected null or an integer from 0 to 3600" },
        { field: "trip.potionSets", reason: "expected an integer from 0 to 28" },
        { field: "trip.potionDoses", reason: "expected an integer from 0 to 112" },
        { field: "trip.singleDose", reason: "expected a boolean" },
        { field: "trip.dbaRestore", reason: "expected a boolean" },
        { field: "trip.recoilRings", reason: "expected an integer from 1 to 28" },
        { field: "trip.runeSlots", reason: "expected an integer from 0 to 28" },
        { field: "trip.altarSeconds", reason: "expected null or an integer from 0 to 3600" }
      ])
    );
  });

  it("imports legacy auto bank time as the rewrite trip auto state", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({
        combatType: "melee",
        trip: {
          bankSeconds: null
        }
      })
    });

    const report = inspectLegacySetupMigration({ storage, gameData });

    expect(report.setup?.trip.bankSeconds).toBeNull();
    expect(report.importedFields).toContain("trip.bankSeconds");
  });

  it("ignores oversized legacy setup payloads before parsing", () => {
    const storage = createMemoryStorage({
      [LEGACY_INPUT_STORAGE_KEY]: JSON.stringify({
        combatType: "melee",
        monsterSetups: { giant: { weapon: "dragon_longsword" } },
        cannonByMonster: { dagannoth: { enabled: true } },
        pad: "x".repeat(50)
      })
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
    expect(report.skippedFields).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "sim_input_v3.monsterSetups" }),
        expect.objectContaining({ field: "sim_input_v3.cannonByMonster" })
      ])
    );
  });
});

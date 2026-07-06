import { parsePriceSetFileText } from "../adapters/market";
import { createMemoryStorage, loadPersisted, savePersisted } from "../adapters/storage";
import {
  DEFAULT_DENSE_COMPARE_STATE,
  DEFAULT_DENSE_COMPARE_SORT_STATE,
  cleanDenseCompareStateForMonsterIds,
  resetDenseCompareFilters,
  toggleDenseCompareMonsterIrrelevant
} from "../app/state/dense-compare";
import {
  LOOT_PREFS_STORAGE_KEY,
  LOOT_PREFS_VERSION,
  LootPrefsStateSchema,
  selectLootPrefsForMonster
} from "../app/state/loot-prefs";
import {
  DEFAULT_LOOT_SETTINGS_STATE,
  LOOT_SETTINGS_STORAGE_KEY,
  LOOT_SETTINGS_VERSION,
  LootSettingsByMonsterSchema,
  lootSettingsForMonster,
  setLootSettingsForMonster
} from "../app/state/loot-settings";
import {
  BrowserPriceHistoryStateSchema,
  PRICE_HISTORY_STORAGE_KEY,
  PRICE_HISTORY_VERSION
} from "../app/state/price-history";
import { PriceSetValidationError } from "../data/schemas";
import {
  DEFAULT_CANNON_SETTINGS,
  DEFAULT_FORM_STATE,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  SavedSetupEnvelopeSchema,
  SavedSetupSchema,
  formForMonsterSetup,
  normalizeFormState,
  removeCustomSetupForMonster,
  savedSetupFromForm,
  setCustomSetupForMonster,
  switchCombatStyleLoadout
} from "../app/state/ui-state";

function withoutKeys<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[]
): Omit<T, K> {
  const next: Partial<T> = { ...value };
  for (const key of keys) delete next[key];
  return next as Omit<T, K>;
}

const legacyFormShape = withoutKeys(DEFAULT_FORM_STATE, ["specialAttack"] as const);
const legacyManualOverrideFormShape = withoutKeys(DEFAULT_FORM_STATE, ["manualOverrides"] as const);

const legacyTripShape = withoutKeys(DEFAULT_FORM_STATE.trip, [
  "altarSeconds",
  "foodCount",
  "foodPerKillOverride",
  "prayerPotionDoses",
  "prayerPotionSets",
  "protect",
  "recoilRings",
  "safespot",
  "scarceSpot",
  "targetsAtSpot",
  "respawnSeconds"
] as const);

describe("versioned rewrite persistence", () => {
  it("saves and loads a versioned setup envelope", () => {
    const storage = createMemoryStorage();
    const options = {
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const setup = savedSetupFromForm(DEFAULT_FORM_STATE, {
      ...DEFAULT_DENSE_COMPARE_STATE,
      sort: { key: "monsterName", direction: "asc" }
    });

    const envelope = savePersisted(options, setup);
    const loaded = loadPersisted(options);

    expect(envelope).toMatchObject({
      version: REWRITE_SETUP_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z"
    });
    expect(loaded.status).toBe("loaded");
    expect(loaded.value).toEqual(setup);
  });

  it("stashes and restores per-combat-style loadouts while keeping shared setup fields", () => {
    const melee = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "firegiant",
      weaponId: "dragon_dagger_p",
      prayers: ["clarity"],
      boosts: ["super_att"],
      manualOverrides: { accuracyBonus: 75, damageBonus: 60, attackSpeedSec: 2.4 },
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" },
      levels: { ...DEFAULT_FORM_STATE.levels, attack: 61, ranged: 72 },
      trip: { ...DEFAULT_FORM_STATE.trip, bankSeconds: 120 }
    });
    const ranged = switchCombatStyleLoadout(melee, "ranged");
    const editedRanged = normalizeFormState({
      ...ranged,
      weaponId: "magic_shortbow",
      ammoId: "rune_arrow",
      prayers: ["none"],
      boosts: ["ranging"],
      sustained: true,
      repotThreshold: 80,
      manualOverrides: { accuracyBonus: 90, damageBonus: 70, attackSpeedSec: 1.8 },
      specialAttack: { weaponId: "magic_shortbow", ammoId: "rune_arrow" }
    });

    const restoredMelee = switchCombatStyleLoadout(editedRanged, "melee");

    expect(restoredMelee).toMatchObject({
      combatStyle: "melee",
      monsterId: "firegiant",
      weaponId: "dragon_dagger_p",
      prayers: ["clarity"],
      boosts: ["super_att"],
      manualOverrides: { accuracyBonus: 75, damageBonus: 60, attackSpeedSec: 2.4 },
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    });
    expect(restoredMelee.levels).toMatchObject({ attack: 61, ranged: 72 });
    expect(restoredMelee.trip.bankSeconds).toBe(120);
    expect(restoredMelee.perStyleLoadouts.ranged).toMatchObject({
      weaponId: "magic_shortbow",
      ammoId: "rune_arrow",
      prayers: ["none"],
      boosts: ["ranging"],
      sustained: true,
      repotThreshold: 80,
      manualOverrides: { accuracyBonus: 90, damageBonus: 70, attackSpeedSec: 1.8 },
      specialAttack: { weaponId: "magic_shortbow", ammoId: "rune_arrow" }
    });
  });

  it("persists per-combat-style loadouts in the rewrite setup envelope", () => {
    const storage = createMemoryStorage();
    const options = {
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const melee = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      weaponId: "dragon_dagger_p",
      manualOverrides: { accuracyBonus: 80, damageBonus: 65, attackSpeedSec: 2.4 },
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    });
    const ranged = normalizeFormState({
      ...switchCombatStyleLoadout(melee, "ranged"),
      boosts: ["ranging"],
      specialAttack: { weaponId: "magic_shortbow", ammoId: "rune_arrow" }
    });
    const setup = savedSetupFromForm(ranged);

    savePersisted(options, setup);
    const loaded = loadPersisted(options);

    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.form.combatStyle).toBe("ranged");
      expect(loaded.value.form.manualOverrides).toEqual({
        accuracyBonus: null,
        damageBonus: null,
        attackSpeedSec: null
      });
      expect(loaded.value.form.perStyleLoadouts.melee.manualOverrides).toEqual({
        accuracyBonus: 80,
        damageBonus: 65,
        attackSpeedSec: 2.4
      });
      expect(loaded.value.form.perStyleLoadouts.melee.specialAttack).toEqual({
        weaponId: "dragon_dagger_p",
        ammoId: "none"
      });
      expect(loaded.value.form.perStyleLoadouts.ranged).toMatchObject({
        weaponId: "magic_shortbow",
        ammoId: "rune_arrow",
        boosts: ["ranging"],
        manualOverrides: {
          accuracyBonus: null,
          damageBonus: null,
          attackSpeedSec: null
        },
        specialAttack: { weaponId: "magic_shortbow", ammoId: "rune_arrow" }
      });
    }
  });

  it("creates, restores and removes monster-specific custom setup snapshots", () => {
    const defaultSetup = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "giant",
      weaponId: "rune_scimitar",
      levels: { ...DEFAULT_FORM_STATE.levels, attack: 61 }
    });
    const customFireGiant = normalizeFormState({
      ...defaultSetup,
      monsterId: "firegiant",
      weaponId: "dragon_dagger_p",
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" },
      levels: { ...defaultSetup.levels, attack: 72 }
    });
    const customSetups = setCustomSetupForMonster({}, customFireGiant);

    const fireGiantSetup = formForMonsterSetup(defaultSetup, customSetups, "firegiant");
    const rockCrabSetup = formForMonsterSetup(defaultSetup, customSetups, "rock_crab");
    const removedSetups = removeCustomSetupForMonster(customSetups, "firegiant");
    const fallbackFireGiant = formForMonsterSetup(defaultSetup, removedSetups, "firegiant");

    expect(fireGiantSetup.setupMode).toBe("custom");
    expect(fireGiantSetup.form).toMatchObject({
      monsterId: "firegiant",
      weaponId: "dragon_dagger_p",
      levels: { attack: 72 }
    });
    expect(rockCrabSetup.setupMode).toBe("default");
    expect(rockCrabSetup.form).toMatchObject({
      monsterId: "rock_crab",
      weaponId: "rune_scimitar",
      levels: { attack: 61 }
    });
    expect(fallbackFireGiant.setupMode).toBe("default");
    expect(fallbackFireGiant.form).toMatchObject({
      monsterId: "firegiant",
      weaponId: "rune_scimitar",
      levels: { attack: 61 }
    });
  });

  it("persists monster-specific custom setups in the rewrite setup envelope", () => {
    const storage = createMemoryStorage();
    const options = {
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const defaultSetup = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "giant",
      weaponId: "rune_scimitar"
    });
    const customSetup = normalizeFormState({
      ...defaultSetup,
      monsterId: "firegiant",
      weaponId: "dragon_dagger_p",
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    });
    const customSetups = setCustomSetupForMonster({}, customSetup);
    const setup = savedSetupFromForm(
      customSetup,
      undefined,
      {},
      customSetups,
      defaultSetup,
      "custom"
    );

    savePersisted(options, setup);
    const loaded = loadPersisted(options);

    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.setupMode).toBe("custom");
      expect(loaded.value.defaultForm.weaponId).toBe("rune_scimitar");
      expect(loaded.value.customSetupsByMonster.firegiant).toMatchObject({
        monsterId: "firegiant",
        weaponId: "dragon_dagger_p"
      });
    }
  });

  it("persists per-monster cannon settings in the rewrite setup envelope", () => {
    const storage = createMemoryStorage();
    const options = {
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const setup = savedSetupFromForm(DEFAULT_FORM_STATE, undefined, {
      dagannoth: { enabled: true, targets: 6, respawnSec: 30 }
    });

    savePersisted(options, setup);
    const loaded = loadPersisted(options);

    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.cannonByMonster.dagannoth).toEqual({
        enabled: true,
        targets: 6,
        respawnSec: 30
      });
    }
  });

  it("persists manual food, recoil and scarce trip controls in the rewrite setup envelope", () => {
    const storage = createMemoryStorage();
    const options = {
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const setup = savedSetupFromForm({
      ...DEFAULT_FORM_STATE,
      gear: {
        ...DEFAULT_FORM_STATE.gear,
        ring: "ring_of_recoil"
      },
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        foodCount: 7,
        foodPerKillOverride: 0.75,
        recoilRings: 5,
        scarceSpot: true,
        targetsAtSpot: 2,
        respawnSeconds: 45
      }
    });

    savePersisted(options, setup);
    const loaded = loadPersisted(options);

    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.form.gear.ring).toBe("ring_of_recoil");
      expect(loaded.value.form.trip).toMatchObject({
        foodCount: 7,
        foodPerKillOverride: 0.75,
        recoilRings: 5,
        scarceSpot: true,
        targetsAtSpot: 2,
        respawnSeconds: 45
      });
    }
  });

  it("persists manual prayer restore trip controls in the rewrite setup envelope", () => {
    const storage = createMemoryStorage();
    const options = {
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const setup = savedSetupFromForm({
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        prayerMode: "potions",
        prayerPotionSets: null,
        prayerPotionDoses: 10,
        altarSeconds: null
      }
    });

    savePersisted(options, setup);
    const loaded = loadPersisted(options);
    const altarSetup = SavedSetupSchema.parse({
      form: {
        ...DEFAULT_FORM_STATE,
        trip: {
          ...DEFAULT_FORM_STATE.trip,
          prayerMode: "altar",
          prayerPotionSets: null,
          prayerPotionDoses: null,
          altarSeconds: 45
        }
      },
      cannonByMonster: {}
    });

    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.form.trip).toMatchObject({
        prayerMode: "potions",
        prayerPotionSets: null,
        prayerPotionDoses: 10,
        altarSeconds: null
      });
    }
    expect(altarSetup.form.trip).toMatchObject({
      prayerMode: "altar",
      prayerPotionSets: null,
      prayerPotionDoses: null,
      altarSeconds: 45
    });
  });

  it("persists selected special attack controls in the rewrite setup envelope", () => {
    const storage = createMemoryStorage();
    const options = {
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const setup = savedSetupFromForm({
      ...DEFAULT_FORM_STATE,
      weaponId: "dragon_dagger_p",
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    });

    savePersisted(options, setup);
    const loaded = loadPersisted(options);

    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.form.specialAttack).toEqual({
        weaponId: "dragon_dagger_p",
        ammoId: "none"
      });
    }
  });

  it("persists manual combat overrides in the rewrite setup envelope", () => {
    const storage = createMemoryStorage();
    const options = {
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const setup = savedSetupFromForm({
      ...DEFAULT_FORM_STATE,
      manualOverrides: {
        accuracyBonus: 120,
        damageBonus: 95,
        attackSpeedSec: 1.8
      }
    });

    savePersisted(options, setup);
    const loaded = loadPersisted(options);

    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.form.manualOverrides).toEqual({
        accuracyBonus: 120,
        damageBonus: 95,
        attackSpeedSec: 1.8
      });
    }
  });

  it("defaults dense compare sort state for existing rewrite setup envelopes", () => {
    const storage = createMemoryStorage({
      [REWRITE_SETUP_STORAGE_KEY]: JSON.stringify({
        version: REWRITE_SETUP_VERSION,
        savedAt: "2026-07-05T12:00:00.000Z",
        data: { form: DEFAULT_FORM_STATE }
      })
    });
    const loaded = loadPersisted({
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage
    });

    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.denseCompare.sort).toEqual(DEFAULT_DENSE_COMPARE_SORT_STATE);
      expect(loaded.value.denseCompare).toMatchObject({
        monsterFilter: "",
        dropFilter: "",
        showIrrelevant: false,
        irrelevantMonsterIds: []
      });
    }
  });

  it("defaults newly modeled trip controls for existing rewrite setup envelopes", () => {
    const parsed = SavedSetupEnvelopeSchema.parse({
      version: REWRITE_SETUP_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z",
      data: {
        form: {
          ...DEFAULT_FORM_STATE,
          trip: legacyTripShape
        }
      }
    });

    expect(parsed.data.form.trip).toMatchObject({
      safespot: null,
      protect: "none",
      recoilRings: 1,
      foodCount: null,
      foodPerKillOverride: null,
      prayerPotionSets: null,
      prayerPotionDoses: null,
      altarSeconds: null,
      scarceSpot: false,
      targetsAtSpot: null,
      respawnSeconds: null
    });
  });

  it("defaults special attack controls for existing rewrite setup envelopes", () => {
    const parsed = SavedSetupEnvelopeSchema.parse({
      version: REWRITE_SETUP_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z",
      data: {
        form: legacyFormShape
      }
    });

    expect(parsed.data.form.specialAttack).toEqual({
      weaponId: "none",
      ammoId: "none"
    });
  });

  it("defaults manual combat overrides for existing rewrite setup envelopes", () => {
    const parsed = SavedSetupEnvelopeSchema.parse({
      version: REWRITE_SETUP_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z",
      data: {
        form: legacyManualOverrideFormShape
      }
    });

    expect(parsed.data.form.manualOverrides).toEqual({
      accuracyBonus: null,
      damageBonus: null,
      attackSpeedSec: null
    });
  });

  it("sanitizes unknown dense compare sort keys in persisted setup data", () => {
    const parsed = SavedSetupEnvelopeSchema.parse({
      version: REWRITE_SETUP_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z",
      data: {
        form: DEFAULT_FORM_STATE,
        denseCompare: {
          sort: {
            key: "not-a-real-column",
            direction: "desc"
          }
        }
      }
    });

    expect(parsed.data.denseCompare.sort).toEqual(DEFAULT_DENSE_COMPARE_SORT_STATE);
  });

  it("sanitizes dense compare filters and irrelevant ids in persisted setup data", () => {
    const parsed = SavedSetupEnvelopeSchema.parse({
      version: REWRITE_SETUP_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z",
      data: {
        form: DEFAULT_FORM_STATE,
        denseCompare: {
          sort: DEFAULT_DENSE_COMPARE_SORT_STATE,
          monsterFilter: `  ${"a".repeat(120)}  `,
          dropFilter: 42,
          showIrrelevant: "yes",
          irrelevantMonsterIds: ["rock_crab", "rock_crab", "", "giant"]
        }
      }
    });

    expect(parsed.data.denseCompare.monsterFilter).toHaveLength(80);
    expect(parsed.data.denseCompare.dropFilter).toBe("");
    expect(parsed.data.denseCompare.showIrrelevant).toBe(false);
    expect(parsed.data.denseCompare.irrelevantMonsterIds).toEqual(["rock_crab", "giant"]);
  });

  it("updates and cleans rewrite-owned dense compare relevance state", () => {
    const hidden = toggleDenseCompareMonsterIrrelevant(DEFAULT_DENSE_COMPARE_STATE, "rock_crab");
    const restored = toggleDenseCompareMonsterIrrelevant(hidden, "rock_crab");
    const reset = resetDenseCompareFilters({
      ...hidden,
      monsterFilter: "rock",
      dropFilter: "bones",
      showIrrelevant: true
    });
    const cleaned = cleanDenseCompareStateForMonsterIds(
      { ...hidden, irrelevantMonsterIds: ["rock_crab", "unknown"] },
      ["rock_crab"]
    );

    expect(hidden.irrelevantMonsterIds).toEqual(["rock_crab"]);
    expect(restored.irrelevantMonsterIds).toEqual([]);
    expect(reset).toMatchObject({
      monsterFilter: "",
      dropFilter: "",
      showIrrelevant: false,
      irrelevantMonsterIds: ["rock_crab"]
    });
    expect(cleaned.irrelevantMonsterIds).toEqual(["rock_crab"]);
  });

  it("sanitizes out-of-range persisted cannon settings before use", () => {
    const parsed = SavedSetupEnvelopeSchema.parse({
      version: REWRITE_SETUP_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z",
      data: {
        form: DEFAULT_FORM_STATE,
        cannonByMonster: {
          dagannoth: {
            enabled: true,
            targets: 99,
            respawnSec: -5
          }
        }
      }
    });

    expect(parsed.data.cannonByMonster.dagannoth).toEqual({
      ...DEFAULT_CANNON_SETTINGS,
      enabled: true
    });
  });

  it("sanitizes invalid persisted trip control numbers before use", () => {
    const parsed = SavedSetupEnvelopeSchema.parse({
      version: REWRITE_SETUP_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z",
      data: {
        form: {
          ...DEFAULT_FORM_STATE,
          trip: {
            ...DEFAULT_FORM_STATE.trip,
            altarSeconds: -1,
            foodCount: 99,
            foodPerKillOverride: -0.5,
            prayerPotionDoses: "many",
            prayerPotionSets: -2,
            protect: "ranged",
            recoilRings: 0,
            scarceSpot: "yes",
            targetsAtSpot: 0,
            respawnSeconds: 9999
          }
        }
      }
    });

    expect(parsed.data.form.trip).toMatchObject({
      altarSeconds: null,
      foodCount: null,
      foodPerKillOverride: null,
      prayerPotionDoses: null,
      prayerPotionSets: null,
      protect: "none",
      recoilRings: 1,
      scarceSpot: false,
      targetsAtSpot: null,
      respawnSeconds: null
    });
  });

  it("sanitizes invalid persisted special attack controls before use", () => {
    const parsed = SavedSetupEnvelopeSchema.parse({
      version: REWRITE_SETUP_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z",
      data: {
        form: {
          ...DEFAULT_FORM_STATE,
          specialAttack: {
            weaponId: "not_a_special_weapon",
            ammoId: ""
          }
        }
      }
    });

    expect(parsed.data.form.specialAttack).toEqual({
      weaponId: "none",
      ammoId: "none"
    });
  });

  it("rejects invalid persisted per-style loadout data without loading data", () => {
    const storage = createMemoryStorage({
      [REWRITE_SETUP_STORAGE_KEY]: JSON.stringify({
        version: REWRITE_SETUP_VERSION,
        savedAt: "2026-07-05T12:00:00.000Z",
        data: {
          form: {
            ...DEFAULT_FORM_STATE,
            perStyleLoadouts: {
              ...DEFAULT_FORM_STATE.perStyleLoadouts,
              ranged: {
                ...DEFAULT_FORM_STATE.perStyleLoadouts.ranged,
                prayers: [123]
              }
            }
          },
          cannonByMonster: {}
        }
      })
    });
    const loaded = loadPersisted({
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage
    });

    expect(loaded).toMatchObject({
      status: "invalid",
      reason: "invalid_data"
    });
  });

  it("does not migrate older localStorage envelopes implicitly", () => {
    const storage = createMemoryStorage({
      [REWRITE_SETUP_STORAGE_KEY]: JSON.stringify({
        version: REWRITE_SETUP_VERSION - 1,
        savedAt: "legacy",
        data: savedSetupFromForm(DEFAULT_FORM_STATE)
      })
    });
    const loaded = loadPersisted({
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage
    });

    expect(loaded).toMatchObject({
      status: "version-mismatch",
      foundVersion: REWRITE_SETUP_VERSION - 1
    });
  });

  it("rejects invalid rewrite setup envelopes without loading data", () => {
    const storage = createMemoryStorage({
      [REWRITE_SETUP_STORAGE_KEY]: JSON.stringify({
        version: REWRITE_SETUP_VERSION,
        savedAt: "2026-07-05T12:00:00.000Z"
      })
    });
    const loaded = loadPersisted({
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage
    });

    expect(loaded).toMatchObject({
      status: "invalid",
      reason: "invalid_envelope"
    });
  });

  it("rejects invalid rewrite setup data without normalizing it into a setup", () => {
    const storage = createMemoryStorage({
      [REWRITE_SETUP_STORAGE_KEY]: JSON.stringify({
        version: REWRITE_SETUP_VERSION,
        savedAt: "2026-07-05T12:00:00.000Z",
        data: {
          form: {
            ...DEFAULT_FORM_STATE,
            combatStyle: "summoning"
          },
          cannonByMonster: {}
        }
      })
    });
    const loaded = loadPersisted({
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage
    });

    expect(loaded).toMatchObject({
      status: "invalid",
      reason: "invalid_data"
    });
  });

  it("rejects imported setup envelopes with the wrong version", () => {
    const setup = savedSetupFromForm(DEFAULT_FORM_STATE);

    expect(() =>
      SavedSetupEnvelopeSchema.parse({
        version: REWRITE_SETUP_VERSION + 1,
        savedAt: "2026-07-05T12:00:00.000Z",
        data: setup
      })
    ).toThrow();
  });
});

describe("versioned loot preference persistence", () => {
  it("saves and loads rewrite-owned loot prefs", () => {
    const storage = createMemoryStorage();
    const options = {
      key: LOOT_PREFS_STORAGE_KEY,
      version: LOOT_PREFS_VERSION,
      schema: LootPrefsStateSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const prefs = LootPrefsStateSchema.parse({
      giant: {
        key_big_bones_0: "loot",
        tag_herb_random_herb_14: "value"
      }
    });

    const envelope = savePersisted(options, prefs);
    const loaded = loadPersisted(options);

    expect(envelope).toMatchObject({
      version: LOOT_PREFS_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z"
    });
    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.giant).toMatchObject(prefs.giant);
    }
  });

  it("drops invalid actions and filters unknown row keys before domain use", () => {
    const parsed = LootPrefsStateSchema.parse({
      giant: {
        key_big_bones_0: "loot",
        stale_row: "skip",
        bad_action: "sell"
      },
      missing_monster: {
        key_big_bones_0: "bury"
      }
    });

    expect(parsed.giant).not.toHaveProperty("bad_action");
    expect(selectLootPrefsForMonster(parsed, "giant", ["key_big_bones_0"])).toEqual({
      key_big_bones_0: "loot"
    });
    expect(selectLootPrefsForMonster(parsed, "giant", ["another_row"])).toEqual({});
    expect(selectLootPrefsForMonster(parsed, "unknown", ["key_big_bones_0"])).toEqual({});
  });

  it("does not load loot prefs with a mismatched version", () => {
    const storage = createMemoryStorage({
      [LOOT_PREFS_STORAGE_KEY]: JSON.stringify({
        version: LOOT_PREFS_VERSION + 1,
        savedAt: "future",
        data: { giant: { key_big_bones_0: "loot" } }
      })
    });
    const loaded = loadPersisted({
      key: LOOT_PREFS_STORAGE_KEY,
      version: LOOT_PREFS_VERSION,
      schema: LootPrefsStateSchema,
      storage
    });

    expect(loaded).toMatchObject({
      status: "version-mismatch",
      foundVersion: LOOT_PREFS_VERSION + 1
    });
  });
});

describe("versioned per-monster loot settings persistence", () => {
  it("saves and loads rewrite-owned per-monster loot settings separately from row prefs", () => {
    const storage = createMemoryStorage();
    const lootPrefsOptions = {
      key: LOOT_PREFS_STORAGE_KEY,
      version: LOOT_PREFS_VERSION,
      schema: LootPrefsStateSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const lootSettingsOptions = {
      key: LOOT_SETTINGS_STORAGE_KEY,
      version: LOOT_SETTINGS_VERSION,
      schema: LootSettingsByMonsterSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const prefs = LootPrefsStateSchema.parse({
      giant: {
        key_big_bones_0: "loot"
      }
    });
    const settings = setLootSettingsForMonster(DEFAULT_LOOT_SETTINGS_STATE, "giant", {
      highAlch: true,
      overheadSec: 4.5,
      talismanSpot: "overground"
    });

    savePersisted(lootPrefsOptions, prefs);
    savePersisted(lootSettingsOptions, settings);
    const loadedPrefs = loadPersisted(lootPrefsOptions);
    const loadedSettings = loadPersisted(lootSettingsOptions);

    expect(loadedPrefs.status).toBe("loaded");
    expect(loadedSettings.status).toBe("loaded");
    if (loadedPrefs.status === "loaded" && loadedSettings.status === "loaded") {
      expect(loadedPrefs.value.giant).toEqual({ key_big_bones_0: "loot" });
      expect(loadedSettings.value.giant).toEqual({
        highAlch: true,
        overheadSec: 4.5,
        talismanSpot: "overground"
      });
    }
  });

  it("defaults and sanitizes per-monster loot settings", () => {
    const parsed = LootSettingsByMonsterSchema.parse({
      giant: {
        highAlch: "yes",
        overheadSec: 9999,
        talismanSpot: "surface"
      },
      mossgiant: {
        highAlch: false,
        overheadSec: null,
        talismanSpot: "overground"
      }
    });

    expect(lootSettingsForMonster(parsed, "giant")).toEqual({
      overheadSec: null,
      talismanSpot: "underground"
    });
    expect(lootSettingsForMonster(parsed, "mossgiant")).toEqual({
      highAlch: false,
      overheadSec: null,
      talismanSpot: "overground"
    });
    expect(lootSettingsForMonster(parsed, "unknown")).toEqual({
      overheadSec: null,
      talismanSpot: "underground"
    });
  });
});

describe("versioned browser-local price history persistence", () => {
  it("saves and loads rewrite-owned price history", () => {
    const storage = createMemoryStorage();
    const options = {
      key: PRICE_HISTORY_STORAGE_KEY,
      version: PRICE_HISTORY_VERSION,
      schema: BrowserPriceHistoryStateSchema,
      storage,
      now: () => new Date("2026-07-05T12:00:00.000Z")
    };
    const history = BrowserPriceHistoryStateSchema.parse({
      snapshots: [
        {
          capturedAt: "2026-07-05T12:00:00.000Z",
          sourcePriceSetId: "manual",
          label: "Manual prices",
          itemPrices: { lobster: 200 }
        }
      ]
    });

    const envelope = savePersisted(options, history);
    const loaded = loadPersisted(options);

    expect(envelope).toMatchObject({
      version: PRICE_HISTORY_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z"
    });
    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.snapshots[0]).toMatchObject(history.snapshots[0]);
    }
  });

  it("rejects invalid persisted price history safely", () => {
    const storage = createMemoryStorage({
      [PRICE_HISTORY_STORAGE_KEY]: JSON.stringify({
        version: PRICE_HISTORY_VERSION,
        savedAt: "2026-07-05T12:00:00.000Z",
        data: {
          snapshots: [
            {
              capturedAt: "not-a-date",
              sourcePriceSetId: "manual",
              label: "Manual prices",
              itemPrices: { lobster: Number.NaN }
            }
          ]
        }
      })
    });
    const loaded = loadPersisted({
      key: PRICE_HISTORY_STORAGE_KEY,
      version: PRICE_HISTORY_VERSION,
      schema: BrowserPriceHistoryStateSchema,
      storage
    });

    expect(loaded).toMatchObject({
      status: "invalid",
      reason: "invalid_data"
    });
  });

  it("does not load price history with a mismatched version", () => {
    const storage = createMemoryStorage({
      [PRICE_HISTORY_STORAGE_KEY]: JSON.stringify({
        version: PRICE_HISTORY_VERSION + 1,
        savedAt: "future",
        data: { snapshots: [] }
      })
    });
    const loaded = loadPersisted({
      key: PRICE_HISTORY_STORAGE_KEY,
      version: PRICE_HISTORY_VERSION,
      schema: BrowserPriceHistoryStateSchema,
      storage
    });

    expect(loaded).toMatchObject({
      status: "version-mismatch",
      foundVersion: PRICE_HISTORY_VERSION + 1
    });
  });
});

describe("price file adapter", () => {
  it("validates imported PriceSet JSON", () => {
    const priceSet = parsePriceSetFileText(
      JSON.stringify({
        id: "manual",
        label: "Manual prices",
        source: "manual",
        createdAt: "2026-07-05",
        itemPrices: { lobster: 200 },
        alchValues: { lobster: 0 }
      })
    );

    expect(priceSet.itemPrices.lobster).toBe(200);
  });

  it("rejects malformed imported PriceSet JSON", () => {
    expect(() => parsePriceSetFileText("{bad")).toThrow(PriceSetValidationError);
  });
});

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
  DEFAULT_DUEL_SNAPSHOTS_STATE,
  DUEL_SNAPSHOTS_STORAGE_KEY,
  DUEL_SNAPSHOTS_VERSION,
  DuelSnapshotsStateSchema,
  MAX_DUEL_SNAPSHOTS,
  appendDuelSnapshot,
  createDuelSnapshot,
  removeDuelSnapshot,
  renameDuelSnapshot
} from "../app/state/duel-snapshots";
import {
  HIDDEN_GEAR_TIERS_STORAGE_KEY,
  HIDDEN_GEAR_TIERS_VERSION,
  HiddenGearTiersStateSchema,
  filterHiddenGearTierOptions,
  gearTierForItemId,
  hideAllGearTiers,
  setHiddenGearTier
} from "../app/state/hidden-gear-tiers";
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
  setPrimaryBoostSelection,
  setPrimaryPrayerSelection,
  removeCustomSetupForMonster,
  savedSetupFromForm,
  setCustomSetupForMonster,
  switchCombatStyleLoadout,
  toggleBoostSelection,
  togglePrayerSelection
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
  "bankSeconds",
  "dbaRestore",
  "foodCount",
  "foodPerKillOverride",
  "potionDoses",
  "potionSets",
  "prayerPotionDoses",
  "prayerPotionSets",
  "protect",
  "recoilRings",
  "runeSlots",
  "safespot",
  "scarceSpot",
  "singleDose",
  "targetsAtSpot",
  "respawnSeconds"
] as const);

describe("versioned rewrite persistence", () => {
  it("classifies hidden gear tiers without mixing black d-hide and black metal", () => {
    expect(gearTierForItemId("bronze_sword")).toBe("bronze");
    expect(gearTierForItemId("black_full_helm")).toBe("black");
    expect(gearTierForItemId("black_dhide_body")).toBeNull();
    expect(gearTierForItemId("green_dhide_body")).toBe("green_dhide");
    expect(gearTierForItemId("leather_body")).toBe("leather");
    expect(gearTierForItemId("wizard_robe_top")).toBe("mage_1def");
    expect(gearTierForItemId("yew_longbow")).toBe("low_bows");
    expect(gearTierForItemId("magic_shortbow")).toBeNull();
    expect(gearTierForItemId("unknown_future_item")).toBeNull();
  });

  it("filters hidden gear tiers while preserving none and the current value", () => {
    const hidden = setHiddenGearTier({}, "bronze", true);
    const options = [
      { id: "none", label: "None" },
      { id: "bronze_sword", label: "Bronze sword" },
      { id: "iron_sword", label: "Iron sword" }
    ];

    expect(filterHiddenGearTierOptions(options, hidden, "bronze_sword")).toEqual(options);
    expect(filterHiddenGearTierOptions(options, hidden, "iron_sword")).toEqual([
      { id: "none", label: "None" },
      { id: "iron_sword", label: "Iron sword" }
    ]);
  });

  it("saves and loads versioned hidden gear tier preferences", () => {
    const storage = createMemoryStorage();
    const options = {
      key: HIDDEN_GEAR_TIERS_STORAGE_KEY,
      version: HIDDEN_GEAR_TIERS_VERSION,
      schema: HiddenGearTiersStateSchema,
      storage,
      now: () => new Date("2026-07-06T12:00:00.000Z")
    };
    const hidden = setHiddenGearTier(hideAllGearTiers(), "bronze", false);

    savePersisted(options, hidden);
    const loaded = loadPersisted(options);

    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.bronze).toBeUndefined();
      expect(loaded.value.iron).toBe(true);
      expect(Object.keys(loaded.value)).not.toContain("dragon");
    }
  });

  it("rejects unknown hidden gear tier keys from persisted state", () => {
    expect(() =>
      HiddenGearTiersStateSchema.parse({
        bronze: true,
        dragon: true
      })
    ).toThrow();
  });

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

  it("saves and loads versioned duel snapshots separately from rewrite setup state", () => {
    const storage = createMemoryStorage();
    const options = {
      key: DUEL_SNAPSHOTS_STORAGE_KEY,
      version: DUEL_SNAPSHOTS_VERSION,
      schema: DuelSnapshotsStateSchema,
      storage,
      now: () => new Date("2026-07-06T12:00:00.000Z")
    };
    const rangedForm = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged"),
      ammoId: "none",
      prayers: ["none"],
      boosts: ["ranging"]
    });
    const state = appendDuelSnapshot(
      DEFAULT_DUEL_SNAPSHOTS_STATE,
      createDuelSnapshot("snap-1", "  Rune   arrows  ", rangedForm)
    );

    const envelope = savePersisted(options, state);
    const loaded = loadPersisted(options);
    const rewriteSetupResult = loadPersisted({
      key: REWRITE_SETUP_STORAGE_KEY,
      version: REWRITE_SETUP_VERSION,
      schema: SavedSetupSchema,
      storage
    });
    const serialized = JSON.stringify(envelope.data);

    expect(envelope).toMatchObject({
      version: DUEL_SNAPSHOTS_VERSION,
      savedAt: "2026-07-06T12:00:00.000Z"
    });
    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.snapshots).toHaveLength(1);
      expect(loaded.value.snapshots[0]).toMatchObject({
        id: "snap-1",
        name: "Rune arrows",
        form: {
          combatStyle: "ranged",
          ammoId: "rune_arrow",
          boosts: ["ranging"]
        }
      });
    }
    expect(rewriteSetupResult.status).toBe("missing");
    expect(serialized).not.toContain("effectiveXpPerHour");
    expect(serialized).not.toContain("SimulationResult");
  });

  it("rejects oversized or computed duel snapshot payloads from persisted state", () => {
    const baseSnapshot = createDuelSnapshot("snap-0", "Baseline", DEFAULT_FORM_STATE);
    const oversizedPayload = {
      version: DUEL_SNAPSHOTS_VERSION,
      savedAt: "2026-07-06T12:00:00.000Z",
      data: {
        snapshots: Array.from({ length: MAX_DUEL_SNAPSHOTS + 1 }, (_, index) => ({
          ...baseSnapshot,
          id: `snap-${index}`
        }))
      }
    };
    const storage = createMemoryStorage({
      [DUEL_SNAPSHOTS_STORAGE_KEY]: JSON.stringify(oversizedPayload)
    });
    const loaded = loadPersisted({
      key: DUEL_SNAPSHOTS_STORAGE_KEY,
      version: DUEL_SNAPSHOTS_VERSION,
      schema: DuelSnapshotsStateSchema,
      storage
    });

    expect(loaded.status).toBe("invalid");
    expect(() =>
      DuelSnapshotsStateSchema.parse({
        snapshots: [{ ...baseSnapshot, result: { effectiveXpPerHour: 123 } }]
      })
    ).toThrow();
  });

  it("keeps duel snapshot helpers normalized and capped for app mutations", () => {
    const state = Array.from({ length: MAX_DUEL_SNAPSHOTS + 2 }, (_, index) =>
      createDuelSnapshot(`snap-${index}`, `Setup ${index}`, DEFAULT_FORM_STATE)
    ).reduce(
      (nextState, snapshot) => appendDuelSnapshot(nextState, snapshot),
      DEFAULT_DUEL_SNAPSHOTS_STATE
    );
    const renamed = renameDuelSnapshot(state, "snap-13", "  Fire    Wave  ");
    const removed = removeDuelSnapshot(renamed, "snap-13");

    expect(state.snapshots).toHaveLength(MAX_DUEL_SNAPSHOTS);
    expect(state.snapshots[0].id).toBe("snap-2");
    expect(state.snapshots.at(-1)?.id).toBe("snap-13");
    expect(renamed.snapshots.at(-1)?.name).toBe("Fire Wave");
    expect(removed.snapshots.map((snapshot) => snapshot.id)).not.toContain("snap-13");
  });

  it("keeps derived potion recommendations out of persisted setup state", () => {
    const setup = savedSetupFromForm({
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        potionSets: 3,
        potionDoses: 7,
        singleDose: true,
        prayerPotionSets: 2,
        prayerPotionDoses: null
      }
    });
    const serialized = JSON.stringify(setup);

    expect(serialized).toContain('"potionSets":3');
    expect(serialized).toContain('"potionDoses":7');
    expect(serialized).toContain('"prayerPotionSets":2');
    expect(serialized).not.toContain("potionRecommendation");
  });

  it("normalizes multi-prayer and multi-boost selections without losing compatible categories", () => {
    const normalized = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      prayers: ["none", "clarity", "incredible", "ultimate", "future_prayer"],
      boosts: ["none", "super_att", "future_boost", "super_str", "magic", "magic"]
    });

    expect(normalized.prayers).toEqual(["incredible", "ultimate"]);
    expect(normalized.boosts).toEqual(["super_att", "super_str", "magic"]);
    expect(setPrimaryPrayerSelection(normalized.prayers, "steel_skin")).toEqual([
      "steel_skin",
      "incredible",
      "ultimate"
    ]);
    expect(setPrimaryBoostSelection(normalized.boosts, "ranging")).toEqual([
      "ranging",
      "super_att",
      "super_str",
      "magic"
    ]);
    expect(togglePrayerSelection(["clarity", "ultimate"], "reflexes", true)).toEqual([
      "reflexes",
      "ultimate"
    ]);
    expect(toggleBoostSelection(["super_att", "super_str"], "super_def", true)).toEqual([
      "super_att",
      "super_str",
      "super_def"
    ]);
    expect(toggleBoostSelection(["super_att", "super_str"], "super_att", false)).toEqual([
      "super_str"
    ]);
    expect(togglePrayerSelection(["steel_skin"], "none", true)).toEqual([]);
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
      prayers: [],
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

  it("persists potion, auto-bank and reserve trip controls in the rewrite setup envelope", () => {
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
        bankSeconds: null,
        dbaRestore: false,
        potionDoses: 6,
        potionSets: 2,
        runeSlots: 4,
        singleDose: true
      }
    });

    savePersisted(options, setup);
    const loaded = loadPersisted(options);

    expect(loaded.status).toBe("loaded");
    if (loaded.status === "loaded") {
      expect(loaded.value.form.trip).toMatchObject({
        bankSeconds: null,
        dbaRestore: false,
        potionDoses: 6,
        potionSets: 2,
        runeSlots: 4,
        singleDose: true
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
      bankSeconds: null,
      dbaRestore: true,
      safespot: null,
      protect: "none",
      recoilRings: 1,
      foodCount: null,
      foodPerKillOverride: null,
      potionDoses: 4,
      potionSets: 1,
      prayerPotionSets: null,
      prayerPotionDoses: null,
      runeSlots: 2,
      altarSeconds: null,
      scarceSpot: false,
      singleDose: false,
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
            bankSeconds: -1,
            dbaRestore: "no",
            foodCount: 99,
            foodPerKillOverride: -0.5,
            potionDoses: 999,
            potionSets: -1,
            prayerPotionDoses: "many",
            prayerPotionSets: -2,
            protect: "ranged",
            recoilRings: 0,
            runeSlots: -2,
            scarceSpot: "yes",
            singleDose: "yes",
            targetsAtSpot: 0,
            respawnSeconds: 9999
          }
        }
      }
    });

    expect(parsed.data.form.trip).toMatchObject({
      altarSeconds: null,
      bankSeconds: null,
      dbaRestore: true,
      foodCount: null,
      foodPerKillOverride: null,
      potionDoses: 4,
      potionSets: 1,
      prayerPotionDoses: null,
      prayerPotionSets: null,
      protect: "none",
      recoilRings: 1,
      runeSlots: 2,
      scarceSpot: false,
      singleDose: false,
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

  it("drops persisted special attacks that are unsupported for magic or DBA boost state", () => {
    const parsed = SavedSetupEnvelopeSchema.parse({
      version: REWRITE_SETUP_VERSION,
      savedAt: "2026-07-05T12:00:00.000Z",
      data: {
        form: {
          ...DEFAULT_FORM_STATE,
          combatStyle: "magic",
          weaponId: "staff_of_fire",
          styleId: "accurate",
          boosts: ["magic"],
          specialAttack: {
            weaponId: "dragon_dagger_p",
            ammoId: "none"
          },
          perStyleLoadouts: {
            ...DEFAULT_FORM_STATE.perStyleLoadouts,
            melee: {
              ...DEFAULT_FORM_STATE.perStyleLoadouts.melee,
              boosts: ["dba_spec", "super_att"],
              specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
            },
            magic: {
              ...DEFAULT_FORM_STATE.perStyleLoadouts.magic,
              specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
            }
          }
        },
        defaultForm: {
          ...DEFAULT_FORM_STATE,
          boosts: ["dba_spec", "super_att"],
          specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
        },
        customSetupsByMonster: {
          giant: {
            ...DEFAULT_FORM_STATE,
            monsterId: "giant",
            boosts: ["dba_spec", "super_att"],
            specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
          }
        },
        cannonByMonster: {}
      }
    });

    expect(parsed.data.form.specialAttack).toEqual({ weaponId: "none", ammoId: "none" });
    expect(parsed.data.form.perStyleLoadouts.melee.specialAttack).toEqual({
      weaponId: "none",
      ammoId: "none"
    });
    expect(parsed.data.form.perStyleLoadouts.magic.specialAttack).toEqual({
      weaponId: "none",
      ammoId: "none"
    });
    expect(parsed.data.defaultForm.specialAttack).toEqual({ weaponId: "none", ammoId: "none" });
    expect(parsed.data.customSetupsByMonster.giant?.specialAttack).toEqual({
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

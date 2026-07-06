import { parsePriceSetFileText } from "../adapters/market";
import { createMemoryStorage, loadPersisted, savePersisted } from "../adapters/storage";
import { DEFAULT_DENSE_COMPARE_SORT_STATE } from "../app/state/dense-compare";
import {
  LOOT_PREFS_STORAGE_KEY,
  LOOT_PREFS_VERSION,
  LootPrefsStateSchema,
  selectLootPrefsForMonster
} from "../app/state/loot-prefs";
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
  savedSetupFromForm
} from "../app/state/ui-state";

const {
  specialAttack: _specialAttack,
  ...legacyFormShape
} = DEFAULT_FORM_STATE;

const {
  altarSeconds: _altarSeconds,
  foodCount: _foodCount,
  foodPerKillOverride: _foodPerKillOverride,
  prayerPotionDoses: _prayerPotionDoses,
  prayerPotionSets: _prayerPotionSets,
  protect: _protect,
  recoilRings: _recoilRings,
  safespot: _safespot,
  ...legacyTripShape
} = DEFAULT_FORM_STATE.trip;

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

  it("persists manual food and recoil trip controls in the rewrite setup envelope", () => {
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
        recoilRings: 5
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
        recoilRings: 5
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
      altarSeconds: null
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
            recoilRings: 0
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
      recoilRings: 1
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

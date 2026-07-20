import { describe, expect, it, vi } from "vitest";
import { createGeneratedRuntimeContext } from "../adapters/generated";
import { createMemoryStorage, type KeyValueStorage } from "../adapters/storage";
import {
  MonsterSpecificChangesTransactionCore,
  type MonsterSpecificExecutionInput,
  type MonsterSpecificLiveOutcome,
  type MonsterSpecificRecoveryBoundary
} from "../app/controllers/monster-specific-changes-transaction";
import {
  createMonsterSpecificRemovalCandidate,
  deriveMonsterSpecificRemoval,
  type MonsterSpecificLiveState
} from "../app/state/monster-specific-changes";
import { LOOT_PREFS_STORAGE_KEY, LOOT_PREFS_VERSION } from "../app/state/loot-prefs";
import {
  DEFAULT_MONSTER_LOOT_SETTINGS,
  LOOT_SETTINGS_STORAGE_KEY,
  LOOT_SETTINGS_VERSION
} from "../app/state/loot-settings";
import {
  DEFAULT_CANNON_SETTINGS,
  DEFAULT_FORM_STATE,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  normalizeFormState,
  savedSetupFromForm
} from "../app/state/ui-state";
import {
  MONSTER_SPECIFIC_CHANGE_KINDS,
  createMonsterSpecificChangesViewModel
} from "../app/view-models/monster-specific-changes";
import { lootPreferenceKeysForMonster } from "../domain/trip";

const runtime = createGeneratedRuntimeContext().context;
const knownMonsters = Object.entries(runtime.gameData.monsters).sort(([, left], [, right]) =>
  left.name.localeCompare(right.name)
);
const [monsterId, monster] = knownMonsters.find(([, value]) => (value.loot?.length ?? 0) > 0)!;
const [otherMonsterId] = knownMonsters.find(([id]) => id !== monsterId)!;
const lootRowId = lootPreferenceKeysForMonster(monster)[0]!;
const fixedNow = new Date("2026-07-20T12:34:56.000Z");

function allChangesLive(): MonsterSpecificLiveState {
  const defaultForm = normalizeFormState({ ...DEFAULT_FORM_STATE, monsterId });
  const customForm = normalizeFormState({
    ...defaultForm,
    levels: { ...defaultForm.levels, attack: defaultForm.levels.attack + 1 }
  });
  return {
    setup: savedSetupFromForm(
      customForm,
      {
        sort: { key: "xpPerHour", direction: "desc" },
        monsterFilter: "",
        dropFilter: "",
        showIrrelevant: false,
        irrelevantMonsterIds: [monsterId]
      },
      { [monsterId]: DEFAULT_CANNON_SETTINGS },
      { [monsterId]: customForm },
      defaultForm,
      "custom"
    ),
    lootPrefs: { [monsterId]: { [lootRowId]: "loot" } },
    lootSettings: { [monsterId]: DEFAULT_MONSTER_LOOT_SETTINGS }
  };
}

function recoveryBoundary(): MonsterSpecificRecoveryBoundary {
  return {
    prepareExternalApply: vi.fn(),
    cancelExternalApply: vi.fn(),
    completeExternalApply: vi.fn(),
    completeExternalUndo: vi.fn(),
    recordExternalApplyFailure: vi.fn(),
    markPersistenceUnavailable: vi.fn()
  };
}

function execution(
  storage: KeyValueStorage,
  live: { current: MonsterSpecificLiveState },
  recovery: MonsterSpecificRecoveryBoundary,
  persistenceUnavailable = false,
  outcomes: MonsterSpecificLiveOutcome[] = []
): MonsterSpecificExecutionInput {
  return {
    storageAccess: {
      storage,
      storageUnavailable: persistenceUnavailable,
      savedDataIgnoredForSession: persistenceUnavailable
    },
    persistenceUnavailable,
    liveState: live.current,
    applyLiveState: (outcome) => {
      outcomes.push(outcome);
      live.current = outcome.liveState;
    },
    recovery,
    now: () => fixedNow
  };
}

describe("Monster-specific changes inventory and removal", () => {
  it("builds one deterministic row with all five ordered owner categories", () => {
    const live = allChangesLive();
    const model = createMonsterSpecificChangesViewModel({
      gameData: runtime.gameData,
      setup: live.setup,
      lootPrefs: live.lootPrefs,
      lootSettings: {
        ...live.lootSettings,
        unavailable_monster: { highAlch: false, overheadSec: 8, talismanSpot: "overground" }
      },
      activeMonsterId: monsterId
    });

    expect(model).toMatchObject({ monsterCount: 2, categoryCount: 6 });
    expect(model.rows[0]).toMatchObject({
      monsterId,
      monsterName: monster.name,
      monsterLevel: monster.level,
      available: true,
      activeTarget: true
    });
    expect(model.rows[0]!.categories.map((category) => category.kind)).toEqual(
      MONSTER_SPECIFIC_CHANGE_KINDS
    );
    expect(model.rows[0]!.categories.find((category) => category.kind === "cannon")?.summary).toBe(
      "Disabled, 3 targets, source respawn"
    );
    expect(
      model.rows[0]!.categories.find((category) => category.kind === "loot-settings")?.summary
    ).toBe("Saved default values");
    expect(model.rows[1]).toMatchObject({
      monsterId: "unavailable_monster",
      monsterName: "Unavailable monster",
      available: false
    });
    expect(model.rows[1]!.categories[0]!.reviewActionLabel).toBeNull();
  });

  it("does not create a row from the current target alone", () => {
    const setup = savedSetupFromForm(normalizeFormState({ ...DEFAULT_FORM_STATE, monsterId }));
    expect(
      createMonsterSpecificChangesViewModel({
        gameData: runtime.gameData,
        setup,
        lootPrefs: {},
        lootSettings: {},
        activeMonsterId: monsterId
      })
    ).toMatchObject({ monsterCount: 0, categoryCount: 0, rows: [] });
  });

  it("removes only the reviewed target from latest state and returns active Custom to Default", () => {
    const reviewed = allChangesLive();
    const candidate = createMonsterSpecificRemovalCandidate({
      id: 1,
      monsterId,
      monsterName: monster.name,
      live: reviewed
    })!;
    const latest: MonsterSpecificLiveState = {
      setup: {
        ...reviewed.setup,
        cannonByMonster: {
          ...reviewed.setup.cannonByMonster,
          [otherMonsterId]: { ...DEFAULT_CANNON_SETTINGS, enabled: true }
        }
      },
      lootPrefs: { ...reviewed.lootPrefs, [otherMonsterId]: { unrelated: "skip" } },
      lootSettings: reviewed.lootSettings
    };
    const result = deriveMonsterSpecificRemoval(candidate, latest);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.next.setup.form.monsterId).toBe(monsterId);
    expect(result.next.setup.setupMode).toBe("default");
    expect(result.next.setup.customSetupsByMonster[monsterId]).toBeUndefined();
    expect(result.next.setup.cannonByMonster[monsterId]).toBeUndefined();
    expect(result.next.setup.cannonByMonster[otherMonsterId]).toBeDefined();
    expect(result.next.setup.denseCompare.irrelevantMonsterIds).not.toContain(monsterId);
    expect(result.next.lootPrefs[monsterId]).toBeUndefined();
    expect(result.next.lootPrefs[otherMonsterId]).toEqual({ unrelated: "skip" });
    expect(result.next.lootSettings[monsterId]).toBeUndefined();
  });

  it("rejects target staleness while ignoring unrelated monster edits", () => {
    const live = allChangesLive();
    const candidate = createMonsterSpecificRemovalCandidate({
      id: 2,
      monsterId,
      monsterName: monster.name,
      live
    })!;
    expect(
      deriveMonsterSpecificRemoval(candidate, {
        ...live,
        lootSettings: {
          ...live.lootSettings,
          [otherMonsterId]: { highAlch: true, overheadSec: null, talismanSpot: "underground" }
        }
      }).status
    ).toBe("ready");
    expect(
      deriveMonsterSpecificRemoval(candidate, {
        ...live,
        lootSettings: {
          ...live.lootSettings,
          [monsterId]: { highAlch: true, overheadSec: null, talismanSpot: "underground" }
        }
      })
    ).toMatchObject({ status: "stale", message: "Monster changes changed. Review removal again." });
  });
});

describe("Monster-specific changes persistence transaction", () => {
  it("writes the exact three selected envelopes with one timestamp and undoes exact raw bytes", () => {
    const priorRaw = {
      [REWRITE_SETUP_STORAGE_KEY]: "prior setup bytes",
      [LOOT_PREFS_STORAGE_KEY]: "prior loot prefs bytes"
    };
    const storage = createMemoryStorage(priorRaw);
    const live = { current: allChangesLive() };
    const candidate = createMonsterSpecificRemovalCandidate({
      id: 3,
      monsterId,
      monsterName: monster.name,
      live: live.current
    })!;
    const recovery = recoveryBoundary();
    const core = new MonsterSpecificChangesTransactionCore();

    expect(core.applyDurable(candidate, execution(storage, live, recovery))).toMatchObject({
      status: "applied",
      mode: "durable",
      selectedIds: ["rewrite-setup", "loot-prefs", "loot-settings"]
    });
    expect(live.current.setup.customSetupsByMonster[monsterId]).toBeUndefined();
    expect(JSON.parse(storage.getItem(REWRITE_SETUP_STORAGE_KEY)!)).toMatchObject({
      version: REWRITE_SETUP_VERSION,
      savedAt: fixedNow.toISOString()
    });
    expect(JSON.parse(storage.getItem(LOOT_PREFS_STORAGE_KEY)!)).toMatchObject({
      version: LOOT_PREFS_VERSION,
      savedAt: fixedNow.toISOString()
    });
    expect(JSON.parse(storage.getItem(LOOT_SETTINGS_STORAGE_KEY)!)).toMatchObject({
      version: LOOT_SETTINGS_VERSION,
      savedAt: fixedNow.toISOString()
    });

    expect(core.undo(execution(storage, live, recovery))).toMatchObject({
      status: "undone",
      mode: "durable",
      message: `Restored changes for ${monster.name}`
    });
    expect(storage.getItem(REWRITE_SETUP_STORAGE_KEY)).toBe(priorRaw[REWRITE_SETUP_STORAGE_KEY]);
    expect(storage.getItem(LOOT_PREFS_STORAGE_KEY)).toBe(priorRaw[LOOT_PREFS_STORAGE_KEY]);
    expect(storage.getItem(LOOT_SETTINGS_STORAGE_KEY)).toBeNull();
    expect(live.current.setup.customSetupsByMonster[monsterId]).toBeDefined();
  });

  it("offers explicit session-only removal without touching protected storage", () => {
    const storage = createMemoryStorage({ sentinel: "protected" });
    const live = { current: allChangesLive() };
    const candidate = createMonsterSpecificRemovalCandidate({
      id: 4,
      monsterId,
      monsterName: monster.name,
      live: live.current
    })!;
    const recovery = recoveryBoundary();
    const core = new MonsterSpecificChangesTransactionCore();

    expect(core.applyDurable(candidate, execution(storage, live, recovery, true))).toMatchObject({
      status: "session-only-available",
      reason: "unavailable"
    });
    expect(live.current.setup.customSetupsByMonster[monsterId]).toBeDefined();
    expect(core.applyForSession(candidate, execution(storage, live, recovery, true))).toMatchObject(
      {
        status: "applied",
        mode: "session-only"
      }
    );
    expect(storage.getItem("sentinel")).toBe("protected");
    expect(storage.getItem(REWRITE_SETUP_STORAGE_KEY)).toBeNull();
    expect(core.undo(execution(storage, live, recovery, true))).toMatchObject({
      status: "undone",
      mode: "session-only"
    });
    expect(live.current.setup.customSetupsByMonster[monsterId]).toBeDefined();
  });
});

import { createMemoryStorage, loadPersisted } from "../adapters/storage";
import { loadCurrentTestContext } from "./helpers/current-sim";
import { defaultPool, plannerXpBounds, xpAt } from "../domain/planner";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import { createHiscoresLevelApplyTransaction } from "../app/state/hiscores";
import type { HiscoresResponse } from "../domain/shared";
import {
  DEFAULT_PLANNER_UI_STATE,
  PLANNER_UI_STORAGE_KEY,
  PLANNER_UI_VERSION,
  PlannerUiStateSchema,
  cleanPlannerUiStateForPool,
  createDefaultPlannerUiState,
  effectivePlannerGearPool,
  effectivePlannerStartXp,
  effectivePlannerTarget,
  loadPlannerUiState,
  reconcilePlannerProgressWithLevels,
  resetPlannerGearPoolSlot,
  savePlannerUiState,
  setPlannerGearPoolItem
} from "../app/state/planner";

describe("planner UI state", () => {
  it("creates planner defaults from the current setup targets without mutating setup state", () => {
    const state = createDefaultPlannerUiState(DEFAULT_FORM_STATE);

    expect(state).toMatchObject({
      metric: "xph",
      targetLevels: DEFAULT_FORM_STATE.plannerTargets,
      currentXp: {
        attack: 0,
        strength: 0,
        defence: 0,
        ranged: 0,
        magic: 0
      },
      skillLocks: {
        attack: false,
        strength: false,
        defence: false,
        ranged: false,
        magic: false
      },
      averageOverSession: true,
      onlyCurrentGear: false,
      gearPool: {}
    });
  });

  it("saves and loads a versioned planner UI state envelope", () => {
    const storage = createMemoryStorage();
    const state = PlannerUiStateSchema.parse({
      ...DEFAULT_PLANNER_UI_STATE,
      metric: "balanced",
      targetLevels: { ...DEFAULT_PLANNER_UI_STATE.targetLevels, attack: 70 },
      currentXp: { ...DEFAULT_PLANNER_UI_STATE.currentXp, attack: 28000 },
      skillLocks: { ...DEFAULT_PLANNER_UI_STATE.skillLocks, defence: true },
      averageOverSession: false,
      onlyCurrentGear: true,
      gearPool: { weapon: ["rune_scimitar"] }
    });

    const envelope = savePlannerUiState(storage, state, () => new Date("2026-07-06T12:00:00.000Z"));
    const loaded = loadPlannerUiState(storage);

    expect(envelope).toMatchObject({
      version: PLANNER_UI_VERSION,
      savedAt: "2026-07-06T12:00:00.000Z"
    });
    expect(loaded).toEqual(state);
  });

  it("preserves Auto and inclusive explicit XP while returning the original no-op state", () => {
    const bounds = plannerXpBounds(60);
    const levels = { attack: 60, strength: 60, defence: 50, ranged: 50, magic: 50 };
    const state = PlannerUiStateSchema.parse({
      ...createDefaultPlannerUiState(DEFAULT_FORM_STATE),
      currentXp: {
        ...DEFAULT_PLANNER_UI_STATE.currentXp,
        attack: bounds.min,
        strength: bounds.max
      }
    });
    const result = reconcilePlannerProgressWithLevels(state, levels);

    expect(result.state).toBe(state);
    expect(result.adjustments).toEqual([]);
    expect(effectivePlannerStartXp(1, 0)).toBe(0);
    expect(effectivePlannerStartXp(60, 0)).toBe(bounds.min);
    expect(effectivePlannerStartXp(60, bounds.max)).toBe(bounds.max);
  });

  it("resets incompatible XP to Auto and raises only unlocked lower targets in canonical order", () => {
    const levels = { attack: 61, strength: 65, defence: 50, ranged: 50, magic: 99 };
    const state = PlannerUiStateSchema.parse({
      ...createDefaultPlannerUiState(DEFAULT_FORM_STATE),
      currentXp: {
        ...DEFAULT_PLANNER_UI_STATE.currentXp,
        attack: xpAt(60),
        strength: xpAt(65),
        magic: 200_000_000
      },
      targetLevels: {
        ...DEFAULT_PLANNER_UI_STATE.targetLevels,
        attack: 60,
        strength: 60,
        magic: 98
      },
      skillLocks: {
        ...DEFAULT_PLANNER_UI_STATE.skillLocks,
        strength: true
      }
    });
    const result = reconcilePlannerProgressWithLevels(state, levels);

    expect(result.state.currentXp.attack).toBe(0);
    expect(result.state.currentXp.strength).toBe(xpAt(65));
    expect(result.state.currentXp.magic).toBe(200_000_000);
    expect(result.state.targetLevels.attack).toBe(61);
    expect(result.state.targetLevels.strength).toBe(60);
    expect(result.state.targetLevels.magic).toBe(99);
    expect(
      result.adjustments.map(({ skill, field, reason }) => ({ skill, field, reason }))
    ).toEqual([
      {
        skill: "attack",
        field: "currentXp",
        reason: "xp-outside-current-level"
      },
      {
        skill: "attack",
        field: "targetLevel",
        reason: "target-below-current-level"
      },
      {
        skill: "magic",
        field: "targetLevel",
        reason: "target-below-current-level"
      }
    ]);
    expect(effectivePlannerTarget(65, 60, true)).toBe(65);
    expect(effectivePlannerTarget(65, 60, false)).toBe(65);
  });

  it("reconciles an Apply and Undo level sequence without pretending Planner state is reversible", () => {
    const previousForm = {
      ...DEFAULT_FORM_STATE,
      levels: { ...DEFAULT_FORM_STATE.levels, attack: 60 }
    };
    const initialState = PlannerUiStateSchema.parse({
      ...createDefaultPlannerUiState(previousForm),
      currentXp: {
        ...DEFAULT_PLANNER_UI_STATE.currentXp,
        attack: xpAt(60) + 10
      },
      targetLevels: {
        ...DEFAULT_PLANNER_UI_STATE.targetLevels,
        attack: 62
      }
    });
    const response: HiscoresResponse = {
      player: "Fixture Player",
      normalizedPlayer: "Fixture Player",
      source: { id: "fixture", label: "Fixture" },
      fetchedAt: "2026-07-20T12:00:00.000Z",
      skills: { attack: { level: 71 } },
      warnings: []
    };
    const transaction = createHiscoresLevelApplyTransaction(previousForm, response);
    const applied = reconcilePlannerProgressWithLevels(initialState, transaction.nextForm.levels);
    const restored = reconcilePlannerProgressWithLevels(
      applied.state,
      transaction.previousForm.levels
    );

    expect(transaction.changedSkills).toEqual(["attack"]);
    expect(applied.state.currentXp.attack).toBe(0);
    expect(applied.state.targetLevels.attack).toBe(71);
    expect(restored.state.currentXp.attack).toBe(0);
    expect(restored.state.targetLevels.attack).toBe(71);
    expect(effectivePlannerStartXp(60, restored.state.currentXp.attack)).toBe(xpAt(60));
    expect(effectivePlannerTarget(60, restored.state.targetLevels.attack, false)).toBe(71);
    expect(transaction.previousForm.levels.attack).toBe(60);
  });

  it("falls back to defaults for invalid JSON and mismatched planner UI state versions", () => {
    const invalidStorage = createMemoryStorage({
      [PLANNER_UI_STORAGE_KEY]: "{"
    });
    expect(loadPlannerUiState(invalidStorage)).toEqual(DEFAULT_PLANNER_UI_STATE);

    const versionStorage = createMemoryStorage({
      [PLANNER_UI_STORAGE_KEY]: JSON.stringify({
        version: PLANNER_UI_VERSION + 1,
        savedAt: "2026-07-06T12:00:00.000Z",
        data: DEFAULT_PLANNER_UI_STATE
      })
    });
    const rawVersionResult = loadPersisted({
      key: PLANNER_UI_STORAGE_KEY,
      version: PLANNER_UI_VERSION,
      schema: PlannerUiStateSchema,
      storage: versionStorage
    });

    expect(rawVersionResult.status).toBe("version-mismatch");
    expect(loadPlannerUiState(versionStorage)).toEqual(DEFAULT_PLANNER_UI_STATE);
  });

  it("drops unknown or unavailable gear pool ids against the active planner pool", async () => {
    const { context } = await loadCurrentTestContext();
    const allowedPool = defaultPool("melee", context);
    const weaponId = allowedPool.weapon?.[0];
    const helmId = allowedPool.helm?.find((itemId) => itemId !== "none");
    expect(weaponId).toBeDefined();
    expect(helmId).toBeDefined();

    const state = PlannerUiStateSchema.parse({
      ...DEFAULT_PLANNER_UI_STATE,
      gearPool: {
        weapon: ["missing_weapon", weaponId],
        helm: ["missing_helm", helmId],
        shield: ["missing_shield"]
      }
    });
    const cleaned = cleanPlannerUiStateForPool(state, allowedPool);

    expect(cleaned.gearPool.weapon).toEqual([weaponId]);
    expect(cleaned.gearPool.helm).toEqual([helmId]);
    expect(cleaned.gearPool.shield).toBeUndefined();
  });

  it("applies gear pool slot selections without accepting unknown ids or emptying a slot", async () => {
    const { context } = await loadCurrentTestContext();
    const allowedPool = defaultPool("melee", context);
    const weaponIds = allowedPool.weapon ?? [];
    expect(weaponIds.length).toBeGreaterThan(1);

    const baseState = createDefaultPlannerUiState(DEFAULT_FORM_STATE);
    const withoutFirstWeapon = setPlannerGearPoolItem(
      baseState,
      allowedPool,
      "weapon",
      weaponIds[0],
      false
    );

    expect(withoutFirstWeapon.gearPool.weapon).toEqual(weaponIds.slice(1));
    expect(effectivePlannerGearPool(withoutFirstWeapon, allowedPool).weapon).toEqual(
      weaponIds.slice(1)
    );

    const unknownAttempt = setPlannerGearPoolItem(
      withoutFirstWeapon,
      allowedPool,
      "weapon",
      "missing_weapon",
      true
    );
    expect(unknownAttempt.gearPool.weapon).toEqual(weaponIds.slice(1));

    const oneWeaponState = PlannerUiStateSchema.parse({
      ...baseState,
      gearPool: { weapon: [weaponIds[0]] }
    });
    const stillOneWeapon = setPlannerGearPoolItem(
      oneWeaponState,
      allowedPool,
      "weapon",
      weaponIds[0],
      false
    );
    expect(stillOneWeapon.gearPool.weapon).toEqual([weaponIds[0]]);

    const resetState = resetPlannerGearPoolSlot(withoutFirstWeapon, "weapon");
    expect(resetState.gearPool.weapon).toBeUndefined();
    expect(effectivePlannerGearPool(resetState, allowedPool).weapon).toEqual(weaponIds);
  });
});

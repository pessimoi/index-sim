import { createMemoryStorage, loadPersisted } from "../adapters/storage";
import { loadBundledLegacyContext } from "../adapters/browser";
import { defaultPool } from "../domain/planner";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import {
  DEFAULT_PLANNER_UI_STATE,
  PLANNER_UI_STORAGE_KEY,
  PLANNER_UI_VERSION,
  PlannerUiStateSchema,
  cleanPlannerUiStateForPool,
  createDefaultPlannerUiState,
  effectivePlannerGearPool,
  loadPlannerUiState,
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

    const envelope = savePlannerUiState(
      storage,
      state,
      () => new Date("2026-07-06T12:00:00.000Z")
    );
    const loaded = loadPlannerUiState(storage);

    expect(envelope).toMatchObject({
      version: PLANNER_UI_VERSION,
      savedAt: "2026-07-06T12:00:00.000Z"
    });
    expect(loaded).toEqual(state);
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
    const { context } = await loadBundledLegacyContext();
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
    const { context } = await loadBundledLegacyContext();
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

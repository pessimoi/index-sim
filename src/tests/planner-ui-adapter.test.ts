import { loadBundledLegacyContext } from "../adapters/browser";
import { xpAt } from "../domain/planner";
import {
  DEFAULT_FORM_STATE,
  formToSimulationRequest,
  type CombatSetupFormState
} from "../app/state/ui-state";
import {
  DEFAULT_PLANNER_UI_STATE,
  PlannerUiStateSchema,
  createDefaultPlannerUiState
} from "../app/state/planner";
import {
  createPlannerGearPoolEditorViewModel,
  createPlannerPanelViewModel,
  createPlannerDomainAdapter,
  createPlannerViewModel,
  plannerAllowedPool
} from "../app/view-models/simulation";

describe("planner UI adapter", () => {
  it("maps planner UI state into domain planner input and options", async () => {
    const { context } = await loadBundledLegacyContext();
    const allowedPool = plannerAllowedPool(DEFAULT_FORM_STATE.combatStyle, context);
    const weaponId = allowedPool.weapon?.[0] ?? DEFAULT_FORM_STATE.weaponId;
    const plannerState = PlannerUiStateSchema.parse({
      ...createDefaultPlannerUiState(DEFAULT_FORM_STATE),
      metric: "gph",
      targetLevels: {
        ...DEFAULT_PLANNER_UI_STATE.targetLevels,
        attack: 70,
        strength: 64
      },
      currentXp: {
        ...DEFAULT_PLANNER_UI_STATE.currentXp,
        strength: xpAt(DEFAULT_FORM_STATE.levels.strength) + 50
      },
      skillLocks: {
        ...DEFAULT_PLANNER_UI_STATE.skillLocks,
        attack: true
      },
      averageOverSession: false,
      onlyCurrentGear: true,
      gearPool: {
        weapon: ["missing_weapon", weaponId]
      }
    });

    const adapter = createPlannerDomainAdapter(DEFAULT_FORM_STATE, context, {}, plannerState);

    expect(adapter.input.request).toEqual(
      formToSimulationRequest(DEFAULT_FORM_STATE, context.gameData)
    );
    expect(adapter.input.request).not.toHaveProperty("plannerTargets");
    expect(adapter.input.request).not.toHaveProperty("plannerUiState");
    expect(adapter.input.request).not.toHaveProperty("targetLevels");
    expect(adapter.options.metric).toBe("gph");
    expect(adapter.options.lockGear).toBe(true);
    expect(adapter.options.sustained).toBe(false);
    expect(adapter.options.targets).toMatchObject({
      attack: DEFAULT_FORM_STATE.levels.attack,
      strength: 64
    });
    expect(adapter.options.startXp).toMatchObject({
      strength: xpAt(DEFAULT_FORM_STATE.levels.strength) + 50
    });
    expect(adapter.state.gearPool.weapon).toEqual([weaponId]);
    expect(adapter.pool.weapon).toEqual([weaponId]);
  });

  it("maps Planner avg-over-session independently from combat setup sustained mode", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = { ...DEFAULT_FORM_STATE, sustained: false };
    const plannerState = PlannerUiStateSchema.parse({
      ...createDefaultPlannerUiState(form),
      averageOverSession: true
    });

    const adapter = createPlannerDomainAdapter(form, context, {}, plannerState);

    expect(adapter.input.request.sustained).toBe(false);
    expect(adapter.options.sustained).toBe(true);
  });

  it("builds a cleaned planner gear pool editor from the canonical allowed pool", async () => {
    const { context } = await loadBundledLegacyContext();
    const allowedPool = plannerAllowedPool(DEFAULT_FORM_STATE.combatStyle, context);
    const weaponIds = allowedPool.weapon ?? [];
    expect(weaponIds.length).toBeGreaterThan(1);

    const plannerState = PlannerUiStateSchema.parse({
      ...createDefaultPlannerUiState(DEFAULT_FORM_STATE),
      gearPool: {
        weapon: [weaponIds[0], "missing_weapon"]
      }
    });
    const editor = createPlannerGearPoolEditorViewModel(DEFAULT_FORM_STATE, context, plannerState);
    const weaponSlot = editor.slots.find((slot) => slot.slot === "weapon");

    expect(weaponSlot).toBeDefined();
    expect(weaponSlot?.selectedCount).toBe(1);
    expect(weaponSlot?.totalCount).toBe(weaponIds.length);
    expect(weaponSlot?.options.some((option) => option.id === "missing_weapon")).toBe(false);
    expect(weaponSlot?.options.find((option) => option.id === weaponIds[0])).toMatchObject({
      id: weaponIds[0],
      selected: true,
      label: expect.any(String),
      hint: expect.any(String)
    });
    expect(
      editor.slots
        .flatMap((slot) => slot.options)
        .every((option) => {
          if (option.id === "none") return true;
          return context.gameData.items[option.id]?.provenance?.source !== "hypothetical";
        })
    ).toBe(true);
  });

  it("uses locked skills to keep a planner skill out of the training order", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      levels: {
        ...DEFAULT_FORM_STATE.levels,
        attack: 60,
        strength: 60
      }
    };
    const plannerState = PlannerUiStateSchema.parse({
      ...createDefaultPlannerUiState(form),
      targetLevels: {
        ...DEFAULT_PLANNER_UI_STATE.targetLevels,
        attack: 65,
        strength: 62
      },
      skillLocks: {
        ...DEFAULT_PLANNER_UI_STATE.skillLocks,
        attack: true
      }
    });

    const plan = createPlannerViewModel(form, context, {}, plannerState);

    expect(plan.ok).toBe(true);
    expect(plan.targets.attack).toBe(form.levels.attack);
    expect(plan.skills).not.toContain("attack");
    expect(plan.skills).toContain("strength");
    expect(plan.steps.every((step) => step.skill !== "attack")).toBe(true);
  }, 15_000);

  it("builds planner panel summary, training order and empty state rows", async () => {
    const { context } = await loadBundledLegacyContext();
    const plan = createPlannerViewModel(DEFAULT_FORM_STATE, context);
    const panel = createPlannerPanelViewModel(plan);

    expect(panel.summary.stepCount).toBe(plan.steps.length);
    expect(panel.summary.phaseCount).toBe(plan.phases.length);
    expect(panel.summary.unlockCount).toBe(plan.unlocks.length);
    expect(panel.trainingOrder).toHaveLength(plan.phases.length);
    expect(panel.timeline).toHaveLength(plan.unlocks.length);
    expect(panel.chart.points).toHaveLength(plan.steps.length + 1);
    expect(panel.chart.points[0]).toMatchObject({
      id: "start",
      cumXp: 0,
      dps: plan.start.dps
    });
    expect(createPlannerPanelViewModel(plan).chart).toEqual(panel.chart);
    if (plan.unlocks.length > 0) {
      expect(panel.timeline[0]).toMatchObject({
        itemName: plan.unlocks[0].name,
        cumXp: plan.unlocks[0].cumXp,
        dpsDelta: plan.unlocks[0].dpsAfter - plan.unlocks[0].dpsBefore
      });
    }
    expect(panel.trainingOrder[0]).toMatchObject({
      skillLabel: expect.any(String),
      from: expect.any(Number),
      to: expect.any(Number),
      unlockCount: expect.any(Number)
    });
    expect(panel.isEmpty).toBe(false);

    const emptyPlan = createPlannerViewModel(
      {
        ...DEFAULT_FORM_STATE,
        plannerTargets: {
          attack: DEFAULT_FORM_STATE.levels.attack,
          strength: DEFAULT_FORM_STATE.levels.strength,
          defence: DEFAULT_FORM_STATE.levels.defence,
          ranged: DEFAULT_FORM_STATE.levels.ranged,
          magic: DEFAULT_FORM_STATE.levels.magic
        }
      },
      context
    );
    const emptyPanel = createPlannerPanelViewModel(emptyPlan);

    expect(emptyPanel.isEmpty).toBe(true);
    expect(emptyPanel.trainingOrder).toHaveLength(0);
    expect(emptyPanel.timeline).toHaveLength(0);
    expect(emptyPanel.chart.isEmpty).toBe(true);
    expect(emptyPanel.summary.stepCount).toBe(0);
  }, 15_000);
});

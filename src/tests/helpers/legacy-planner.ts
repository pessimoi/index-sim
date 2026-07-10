import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInContext } from "node:vm";
import type { PlannerMetric, PlannerOptions, PlannerSkill } from "../../domain/planner";
import {
  buildLegacyInput,
  createLegacyRuntime,
  type LegacyCaseDefinition,
  type LegacyRuntime
} from "./legacy-sim";

const LEGACY_PLANNER_FILE = "planner-core.js";
const LOAD_TIMEOUT_MS = 1_000;
const CASE_TIMEOUT_MS = 5_000;
const MAX_LEVEL_STEPS = 120;
const MAX_POOL_ITEMS_PER_SLOT = 24;
const SAFE_ID = /^[a-z0-9][a-z0-9_-]*$/;
const PLANNER_RUN_EXPRESSION =
  "window.__plannerAuditResult = window.SimPlanner.buildPlan(window.__plannerAuditBase, window.__plannerAuditOptions);";

type LegacyPlannerMetric = Exclude<PlannerMetric, "balanced"> | "bal";
type LegacyPlannerSlot = "weapon" | "helm" | "body" | "legs" | "shield";

export interface LegacyPlannerConfig {
  weapon: string;
  weaponName?: string;
  spell: string | null;
  spellName?: string;
  armour: Record<Exclude<LegacyPlannerSlot, "weapon">, string>;
  metricVal: number;
  dps: number;
}

export interface LegacyPlannerStep {
  skill: PlannerSkill;
  from: number;
  to: number;
  dxp: number;
  metricVal: number;
  dps: number;
  cumXp: number;
  combat: number;
  cfg: LegacyPlannerConfig;
  state: Record<PlannerSkill, number>;
  stance: string;
}

export interface LegacyPlannerTransition {
  slot: LegacyPlannerSlot | "spell";
  type: "unlock" | "switch";
  name: string;
  prevName: string;
  skill: PlannerSkill;
  level: number;
  reqSkill: PlannerSkill;
  reqLevel: number;
  stepIdx: number;
  cumXp: number;
  dpsBefore: number;
  dpsAfter: number;
}

export interface LegacyPlannerPhase {
  skill: PlannerSkill;
  from: number;
  to: number;
  startDps: number;
  endDps: number;
  startMetric: number;
  endMetric: number;
  xp: number;
  cumXp: number;
  combat: number;
  firstStep: number;
  lastStep: number;
  unlocks: LegacyPlannerTransition[];
}

export interface LegacyPlannerPlan {
  ok: true;
  combatType: "melee" | "ranged" | "magic";
  metric: LegacyPlannerMetric;
  start: {
    state: Record<PlannerSkill, number>;
    dps: number;
    metricVal: number;
    combat: number;
    cfg: LegacyPlannerConfig;
  };
  end: LegacyPlannerStep | null;
  steps: LegacyPlannerStep[];
  phases: LegacyPlannerPhase[];
  unlocks: LegacyPlannerTransition[];
  totalXp: number;
  truncated: boolean;
  skills: PlannerSkill[];
  targets: Partial<Record<PlannerSkill, number>>;
}

interface LegacyPlannerApi {
  HYPO_WEAPONS: Record<string, unknown>;
  buildPlan(base: Record<string, unknown>, options: Record<string, unknown>): LegacyPlannerPlan;
}

interface LegacyEquipmentRegistries {
  HELMS: Record<string, { name?: string }>;
  BODIES: Record<string, { name?: string }>;
  LEGS: Record<string, { name?: string }>;
  SHIELDS: Record<string, { name?: string }>;
}

export interface LegacyPlannerRuntime extends LegacyRuntime {
  SimPlanner: LegacyPlannerApi;
  Equipment: LegacyRuntime["Equipment"] & LegacyEquipmentRegistries;
  __plannerAuditBase?: Record<string, unknown>;
  __plannerAuditOptions?: Record<string, unknown>;
  __plannerAuditResult?: unknown;
}

export function createLegacyPlannerRuntime(): LegacyPlannerRuntime {
  const rootDir = process.cwd();
  const runtime = createLegacyRuntime(rootDir) as LegacyPlannerRuntime;
  const source = readFileSync(join(rootDir, LEGACY_PLANNER_FILE), "utf8");
  runInContext(source, runtime, {
    filename: LEGACY_PLANNER_FILE,
    timeout: LOAD_TIMEOUT_MS
  });

  if (!runtime.SimPlanner || typeof runtime.SimPlanner.buildPlan !== "function") {
    throw new Error("Legacy Planner adapter failed to initialize.");
  }
  return runtime;
}

export function runLegacyPlannerCase(
  runtime: LegacyPlannerRuntime,
  definition: LegacyCaseDefinition,
  options: PlannerOptions
): LegacyPlannerPlan {
  validateDefinition(runtime, definition);
  validateOptions(runtime, definition, options);

  const base = cloneJson(buildLegacyInput(runtime, definition)) as Record<string, unknown>;
  const legacyOptions = cloneJson({
    metric: legacyMetric(options.metric ?? "xph"),
    targets: options.targets ?? {},
    startXp: options.startXp ?? {},
    pool: options.pool ?? emptyPool(),
    lockGear: options.lockGear ?? false,
    sustained: options.sustained ?? false,
    maxLevels: options.maxLevels ?? MAX_LEVEL_STEPS,
    futureWeapons: false
  }) as Record<string, unknown>;

  runtime.__plannerAuditBase = base;
  runtime.__plannerAuditOptions = legacyOptions;
  try {
    runInContext(PLANNER_RUN_EXPRESSION, runtime, {
      filename: "legacy-planner-audit-case.vm.js",
      timeout: CASE_TIMEOUT_MS
    });
    const rawPlan = runtime.__plannerAuditResult as LegacyPlannerPlan;
    validatePlan(rawPlan);
    return cloneJson(rawPlan) as LegacyPlannerPlan;
  } catch (error) {
    throw new Error(`Legacy Planner case failed: ${safeCaseId(definition.id)}`, { cause: error });
  } finally {
    delete runtime.__plannerAuditBase;
    delete runtime.__plannerAuditOptions;
    delete runtime.__plannerAuditResult;
  }
}

export function legacyPlannerItemName(
  runtime: LegacyPlannerRuntime,
  slot: LegacyPlannerSlot | "spell",
  itemId: string | null
): string | null {
  if (!itemId || itemId === "none") return itemId;
  if (slot === "weapon") return runtime.SimEngine.WEAPONS[itemId]?.name ?? itemId;
  if (slot === "spell") return runtime.SimEngine.SPELLS[itemId]?.name ?? itemId;
  return equipmentRegistry(runtime, slot)[itemId]?.name ?? itemId;
}

function validateDefinition(runtime: LegacyPlannerRuntime, definition: LegacyCaseDefinition): void {
  if (!SAFE_ID.test(definition.id)) throw new Error("Planner case id is invalid.");
  const levels = definition.levels ?? {};
  for (const value of Object.values(levels)) validateLevel(value, "starting level");

  const weaponId = definition.weapon;
  if (weaponId && !runtime.SimEngine.WEAPONS[weaponId]) {
    throw new Error("Planner case weapon id is unknown.");
  }
  if (definition.ammo && !runtime.SimEngine.ARROWS[definition.ammo]) {
    throw new Error("Planner case ammo id is unknown.");
  }
  if (definition.spell && !runtime.SimEngine.SPELLS[definition.spell]) {
    throw new Error("Planner case spell id is unknown.");
  }
}

function validateOptions(
  runtime: LegacyPlannerRuntime,
  definition: LegacyCaseDefinition,
  options: PlannerOptions
): void {
  const maxLevels = options.maxLevels ?? MAX_LEVEL_STEPS;
  if (!Number.isInteger(maxLevels) || maxLevels < 1 || maxLevels > MAX_LEVEL_STEPS) {
    throw new Error("Planner case maxLevels is outside the audit bound.");
  }

  const allowedSkills = new Set<PlannerSkill>(skillsFor(definition.combatType));
  for (const [skill, value] of Object.entries(options.targets ?? {})) {
    if (!allowedSkills.has(skill as PlannerSkill))
      throw new Error("Planner target skill is invalid.");
    validateLevel(value, "target level");
  }
  for (const [skill, value] of Object.entries(options.startXp ?? {})) {
    if (!allowedSkills.has(skill as PlannerSkill)) throw new Error("Planner XP skill is invalid.");
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error("Planner starting XP is invalid.");
    }
  }

  const hypothetical = new Set(Object.keys(runtime.SimPlanner.HYPO_WEAPONS ?? {}));
  for (const slot of ["weapon", "helm", "body", "legs", "shield"] as const) {
    const ids = options.pool?.[slot] ?? [];
    if (ids.length > MAX_POOL_ITEMS_PER_SLOT) {
      throw new Error("Planner pool exceeds the audit item bound.");
    }
    if (new Set(ids).size !== ids.length) throw new Error("Planner pool contains duplicate ids.");
    for (const itemId of ids) {
      if (!SAFE_ID.test(itemId)) throw new Error("Planner pool item id is invalid.");
      if (hypothetical.has(itemId)) throw new Error("Hypothetical Planner gear is not allowed.");
      if (slot === "weapon") {
        if (!runtime.SimEngine.WEAPONS[itemId]) throw new Error("Planner pool weapon is unknown.");
      } else if (itemId !== "none" && !equipmentRegistry(runtime, slot)[itemId]) {
        throw new Error("Planner pool equipment is unknown.");
      }
    }
  }
}

function validatePlan(plan: LegacyPlannerPlan): void {
  if (plan?.ok !== true || !Array.isArray(plan.steps) || !Array.isArray(plan.phases)) {
    throw new Error("Legacy Planner returned an invalid result.");
  }
  if (plan.steps.length > MAX_LEVEL_STEPS) {
    throw new Error("Legacy Planner returned too many steps.");
  }
  assertFiniteValues("Legacy Planner result", [
    plan.totalXp,
    plan.start.dps,
    plan.start.metricVal,
    ...plan.steps.flatMap((step) => [
      step.from,
      step.to,
      step.dxp,
      step.metricVal,
      step.dps,
      step.cumXp,
      step.combat,
      step.cfg.metricVal,
      step.cfg.dps
    ]),
    ...plan.phases.flatMap((phase) => [
      phase.from,
      phase.to,
      phase.startDps,
      phase.endDps,
      phase.startMetric,
      phase.endMetric,
      phase.xp,
      phase.cumXp,
      phase.combat,
      phase.firstStep,
      phase.lastStep
    ]),
    ...plan.unlocks.flatMap((transition) => [
      transition.level,
      transition.reqLevel,
      transition.stepIdx,
      transition.cumXp,
      transition.dpsBefore,
      transition.dpsAfter
    ])
  ]);
}

function equipmentRegistry(
  runtime: LegacyPlannerRuntime,
  slot: Exclude<LegacyPlannerSlot, "weapon">
): Record<string, { name?: string }> {
  if (slot === "helm") return runtime.Equipment.HELMS;
  if (slot === "body") return runtime.Equipment.BODIES;
  if (slot === "legs") return runtime.Equipment.LEGS;
  return runtime.Equipment.SHIELDS;
}

function skillsFor(combatType: LegacyCaseDefinition["combatType"]): PlannerSkill[] {
  if (combatType === "ranged") return ["ranged", "defence"];
  if (combatType === "magic") return ["magic", "defence"];
  return ["attack", "strength", "defence"];
}

function legacyMetric(metric: PlannerMetric): LegacyPlannerMetric {
  return metric === "balanced" ? "bal" : metric;
}

function emptyPool(): NonNullable<PlannerOptions["pool"]> {
  return { weapon: [], helm: ["none"], body: ["none"], legs: ["none"], shield: ["none"] };
}

function validateLevel(value: unknown, label: string): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 99) {
    throw new Error(`Planner ${label} is invalid.`);
  }
}

function assertFiniteValues(label: string, values: readonly unknown[]): void {
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${label} contains an invalid number.`);
    }
  }
}

function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function safeCaseId(value: string): string {
  return SAFE_ID.test(value) ? value : "invalid-case";
}

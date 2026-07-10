import { computeCombatXpBreakdown, simulateCombat, weaponStances } from "../combat";
import {
  simulateTripLootSupply,
  type JewelSpot,
  type LootAction,
  type TripLootSupplyResult,
  type TripPolicy
} from "../trip";
import {
  EQUIPMENT_SLOTS,
  type CombatStyle,
  type CombatSimulationResult,
  type DataProvenance,
  type EntityId,
  type EquipmentSlot,
  type GearSelection,
  type GameDataSnapshot,
  type PlayerLevels,
  type SimulationContext,
  type SimulationRequest,
  type SimulationWarning
} from "../shared";

export type PlannerSkill = "attack" | "strength" | "defence" | "ranged" | "magic";
export type PlannerMetric = "xph" | "gph" | "dps" | "balanced";
export type PlannerGearSlot = "weapon" | "helm" | "body" | "legs" | "shield";
export type PlannerTransitionType = "unlock" | "switch";

export type PlannerLevels = Pick<
  PlayerLevels,
  "attack" | "strength" | "defence" | "ranged" | "magic"
>;

export interface SkillRequirements {
  attack?: number;
  defence?: number;
  ranged?: number;
  magic?: number;
}

export interface PlannerPool {
  weapon?: EntityId[];
  helm?: EntityId[];
  body?: EntityId[];
  legs?: EntityId[];
  shield?: EntityId[];
}

export interface PlannerInput {
  request: SimulationRequest;
  trip?: TripPolicy;
  lootPrefs?: Record<string, LootAction | string | undefined>;
  ringOfWealth?: boolean;
  legendsComplete?: boolean;
  jewelSpot?: JewelSpot;
  overheadSec?: number | null;
}

export interface PlannerOptions {
  metric?: PlannerMetric;
  targets?: Partial<Record<PlannerSkill, number>>;
  startXp?: Partial<Record<PlannerSkill, number>>;
  pool?: PlannerPool;
  lockGear?: boolean;
  sustained?: boolean;
  maxLevels?: number;
}

export interface PlannerEvaluation {
  request: SimulationRequest;
  combat: CombatSimulationResult;
  trip: TripLootSupplyResult;
  metricValue: number;
  dps: number;
  effectiveXpPerHour: number;
  effectiveNetGpPerHour: number;
  combatXpPerKill: number;
  weaponId: EntityId;
  weaponName: string;
  spellId: EntityId | null;
  spellName: string | null;
  armour: Record<Exclude<PlannerGearSlot, "weapon">, EntityId>;
  warnings: SimulationWarning[];
}

export interface PlannerStep {
  skill: PlannerSkill;
  from: number;
  to: number;
  dxp: number;
  cumXp: number;
  metricValue: number;
  dps: number;
  effectiveXpPerHour: number;
  effectiveNetGpPerHour: number;
  combat: number;
  cfg: PlannerEvaluation;
  trainingCfg: PlannerEvaluation;
  state: PlannerLevels;
  stanceId: EntityId;
}

export interface PlannerTransition {
  slot: PlannerGearSlot | "spell";
  type: PlannerTransitionType;
  itemId: EntityId;
  name: string;
  previousItemId: EntityId | null;
  previousName: string | null;
  skill: PlannerSkill;
  level: number;
  reqSkill: PlannerSkill;
  reqLevel: number;
  stepIndex: number;
  cumXp: number;
  dpsBefore: number;
  dpsAfter: number;
}

export interface PlannerPhase {
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
  unlocks: PlannerTransition[];
}

export interface PlannerPlan {
  ok: true;
  combatStyle: CombatStyle;
  metric: PlannerMetric;
  start: {
    state: PlannerLevels;
    dps: number;
    metricValue: number;
    combat: number;
    cfg: PlannerEvaluation;
  };
  end: PlannerStep | null;
  steps: PlannerStep[];
  phases: PlannerPhase[];
  unlocks: PlannerTransition[];
  totalXp: number;
  truncated: boolean;
  skills: PlannerSkill[];
  targets: Partial<Record<PlannerSkill, number>>;
  warnings: SimulationWarning[];
}

type ArmourSelection = Record<Exclude<PlannerGearSlot, "weapon">, EntityId>;

const PLANNER_ARMOUR_SLOTS = ["helm", "body", "legs", "shield"] as const;
const XP: number[] = [0, 0];
const REQUIREMENT_PROVENANCE = {
  source: "manual",
  sourceRef: "planner-core.js requirement table in this checkout",
  verifiedAt: "2026-07-05",
  notes:
    "Requirement levels are the manual fallback policy used only when generated item requirement data is missing."
} satisfies DataProvenance;

for (let level = 1, total = 0; level < 99; level += 1) {
  total += Math.floor(level + 300 * Math.pow(2, level / 7));
  XP[level + 1] = Math.floor(total / 4);
}

function req(attack = 0, defence = 0, ranged = 0, magic = 0): SkillRequirements {
  return {
    ...(attack > 0 ? { attack } : {}),
    ...(defence > 0 ? { defence } : {}),
    ...(ranged > 0 ? { ranged } : {}),
    ...(magic > 0 ? { magic } : {})
  };
}

export const ITEM_REQUIREMENTS: Record<EntityId, SkillRequirements> = {
  iron_scimitar: req(1),
  steel_scimitar: req(5),
  black_scimitar: req(10),
  mithril_scimitar: req(20),
  adamant_scimitar: req(30),
  rune_scimitar: req(40),
  dragon_longsword: req(60),
  dragon_mace: req(60),
  dragon_dagger: req(60),
  dragon_dagger_p: req(60),
  dragon_halberd: req(60),
  shortbow: req(0, 0, 1),
  oak_shortbow: req(0, 0, 5),
  willow_shortbow: req(0, 0, 20),
  maple_shortbow: req(0, 0, 30),
  yew_shortbow: req(0, 0, 40),
  yew_longbow: req(0, 0, 40),
  magic_shortbow: req(0, 0, 50),
  magic_longbow: req(0, 0, 50),
  bronze_knife_w: req(0, 0, 1),
  iron_knife_w: req(0, 0, 1),
  steel_knife_w: req(0, 0, 5),
  mith_knife_w: req(0, 0, 20),
  addy_knife_w: req(0, 0, 30),
  rune_knife_w: req(0, 0, 40),
  bronze_dart_w: req(0, 0, 1),
  iron_dart_w: req(0, 0, 1),
  steel_dart_w: req(0, 0, 5),
  mith_dart_w: req(0, 0, 20),
  addy_dart_w: req(0, 0, 30),
  rune_dart_w: req(0, 0, 40),
  iron_full_helm: req(0, 1),
  steel_full_helm: req(0, 5),
  black_full_helm: req(0, 10),
  mithril_full_helm: req(0, 20),
  adamant_full_helm: req(0, 30),
  rune_full_helm: req(0, 40),
  dragon_med_helm: req(0, 60),
  berserker_helm: req(0, 45),
  warrior_helm: req(0, 45),
  coif: req(0, 0, 1),
  robin_hood_hat: req(0, 0, 40),
  archer_helm: req(0, 45, 45),
  splitbark_helm: req(0, 40, 0, 40),
  farseer_helm: req(0, 45, 0, 45),
  green_hat: req(0),
  iron_platebody: req(0, 1),
  steel_platebody: req(0, 5),
  black_platebody: req(0, 10),
  mithril_platebody: req(0, 20),
  adamant_platebody: req(0, 30),
  rune_platebody: req(0, 40),
  rune_chainbody: req(0, 40),
  dragon_chainbody: req(0, 60),
  leather_body: req(0, 0, 1),
  hardleather_body: req(0, 0, 10),
  studded_body: req(0, 0, 20),
  green_dhide_body: req(0, 40, 40),
  blue_dhide_body: req(0, 40, 50),
  red_dhide_body: req(0, 40, 60),
  black_dhide_body: req(0, 40, 70),
  splitbark_body: req(0, 40, 0, 40),
  wizard_robe_top: req(0),
  monk_robe_top: req(0),
  iron_platelegs: req(0, 1),
  steel_platelegs: req(0, 5),
  black_platelegs: req(0, 10),
  mithril_platelegs: req(0, 20),
  adamant_platelegs: req(0, 30),
  rune_platelegs: req(0, 40),
  leather_chaps: req(0, 0, 1),
  studded_chaps: req(0, 0, 20),
  green_dhide_legs: req(0, 0, 40),
  blue_dhide_legs: req(0, 0, 50),
  red_dhide_legs: req(0, 0, 60),
  black_dhide_legs: req(0, 0, 70),
  splitbark_legs: req(0, 40, 0, 40),
  iron_kite: req(0, 1),
  steel_kite: req(0, 5),
  black_kite: req(0, 10),
  mithril_kite: req(0, 20),
  adamant_kite: req(0, 30),
  rune_kite: req(0, 40),
  dragon_sq: req(0, 60)
};

export const PLANNER_REQUIREMENT_PROVENANCE = REQUIREMENT_PROVENANCE;

export type PlannerRequirementSource = "generated" | "manual-fallback" | "none";

export interface PlannerRequirementLookup {
  itemId: EntityId;
  requirements: SkillRequirements;
  source: PlannerRequirementSource;
  provenance?: DataProvenance;
  warnings: SimulationWarning[];
}

export const CANDIDATE_POOLS: Record<CombatStyle, Required<PlannerPool>> = {
  melee: {
    weapon: [
      "iron_scimitar",
      "steel_scimitar",
      "black_scimitar",
      "mithril_scimitar",
      "adamant_scimitar",
      "rune_scimitar",
      "dragon_mace",
      "dragon_dagger",
      "dragon_longsword"
    ],
    helm: [
      "none",
      "iron_full_helm",
      "steel_full_helm",
      "black_full_helm",
      "mithril_full_helm",
      "adamant_full_helm",
      "rune_full_helm",
      "berserker_helm",
      "dragon_med_helm"
    ],
    body: [
      "none",
      "iron_platebody",
      "steel_platebody",
      "black_platebody",
      "mithril_platebody",
      "adamant_platebody",
      "rune_platebody",
      "dragon_chainbody"
    ],
    legs: [
      "none",
      "iron_platelegs",
      "steel_platelegs",
      "black_platelegs",
      "mithril_platelegs",
      "adamant_platelegs",
      "rune_platelegs"
    ],
    shield: [
      "none",
      "iron_kite",
      "steel_kite",
      "black_kite",
      "mithril_kite",
      "adamant_kite",
      "rune_kite",
      "dragon_sq"
    ]
  },
  ranged: {
    weapon: [
      "shortbow",
      "oak_shortbow",
      "willow_shortbow",
      "maple_shortbow",
      "yew_shortbow",
      "yew_longbow",
      "magic_shortbow",
      "magic_longbow",
      "rune_knife_w",
      "addy_knife_w"
    ],
    helm: ["none", "coif", "robin_hood_hat", "archer_helm"],
    body: [
      "none",
      "leather_body",
      "studded_body",
      "green_dhide_body",
      "blue_dhide_body",
      "red_dhide_body",
      "black_dhide_body"
    ],
    legs: [
      "none",
      "leather_chaps",
      "studded_chaps",
      "green_dhide_legs",
      "blue_dhide_legs",
      "red_dhide_legs",
      "black_dhide_legs"
    ],
    shield: ["none"]
  },
  magic: {
    weapon: [],
    helm: ["none", "green_hat", "splitbark_helm", "farseer_helm"],
    body: ["none", "wizard_robe_top", "splitbark_body"],
    legs: ["none", "zamorak_robe_bottom", "splitbark_legs"],
    shield: ["none"]
  }
};

export const SKILLS_FOR: Record<CombatStyle, PlannerSkill[]> = {
  melee: ["attack", "strength", "defence"],
  ranged: ["ranged", "defence"],
  magic: ["magic", "defence"]
};

export const SKILL_LABEL: Record<PlannerSkill, string> = {
  attack: "Attack",
  strength: "Strength",
  defence: "Defence",
  ranged: "Ranged",
  magic: "Magic"
};

export const SLOT_LABEL: Record<PlannerGearSlot | "spell", string> = {
  weapon: "weapon",
  spell: "spell",
  helm: "helm",
  body: "body",
  legs: "legs",
  shield: "shield"
};

const STAFF_ELEM: Record<EntityId, string> = {
  staff_of_fire: "fire",
  staff_of_air: "wind",
  staff_of_water: "water",
  staff_of_earth: "earth"
};

const SKILL_TO_LEVEL_KEY: Record<PlannerSkill, keyof PlannerLevels> = {
  attack: "attack",
  strength: "strength",
  defence: "defence",
  ranged: "ranged",
  magic: "magic"
};

const LEVEL_SKILLS: PlannerSkill[] = ["attack", "strength", "defence", "ranged", "magic"];

export function xpAt(level: number): number {
  return XP[Math.max(1, Math.min(99, Math.floor(level)))] ?? 0;
}

export function xpBetween(_skill: PlannerSkill, from: number, to: number): number {
  return Math.max(0, xpAt(to) - xpAt(from));
}

function fallbackRequirementWarning(itemId: EntityId): SimulationWarning {
  return {
    code: "manual-planner-requirement-fallback",
    severity: "info",
    message: `Planner used manual requirement fallback because generated requirement data is missing for ${itemId}.`
  };
}

export function requirementForItem(
  gameData: GameDataSnapshot | undefined,
  itemId: EntityId
): PlannerRequirementLookup {
  if (itemId === "none") {
    return { itemId, requirements: {}, source: "none", warnings: [] };
  }

  const generated = gameData?.requirements?.[itemId];
  if (generated) {
    return {
      itemId,
      requirements: {
        ...(generated.skills.attack !== undefined ? { attack: generated.skills.attack } : {}),
        ...(generated.skills.defence !== undefined ? { defence: generated.skills.defence } : {}),
        ...(generated.skills.ranged !== undefined ? { ranged: generated.skills.ranged } : {}),
        ...(generated.skills.magic !== undefined ? { magic: generated.skills.magic } : {})
      },
      source: "generated",
      provenance: generated.provenance,
      warnings: []
    };
  }

  const fallback = ITEM_REQUIREMENTS[itemId];
  if (fallback) {
    return {
      itemId,
      requirements: fallback,
      source: "manual-fallback",
      provenance: REQUIREMENT_PROVENANCE,
      warnings: [fallbackRequirementWarning(itemId)]
    };
  }

  return { itemId, requirements: {}, source: "none", warnings: [] };
}

export function reqOf(itemId: EntityId, gameData?: GameDataSnapshot): SkillRequirements {
  return requirementForItem(gameData, itemId).requirements;
}

export function reqLevel(
  itemId: EntityId,
  skill: PlannerSkill,
  gameData?: GameDataSnapshot
): number {
  if (skill === "strength") return 0;
  return reqOf(itemId, gameData)[skill] ?? 0;
}

export function equippable(
  itemId: EntityId,
  state: PlannerLevels,
  gameData?: GameDataSnapshot
): boolean {
  if (itemId === "none") return true;
  const requirement = reqOf(itemId, gameData);
  return (
    (requirement.attack == null || state.attack >= requirement.attack) &&
    (requirement.defence == null || state.defence >= requirement.defence) &&
    (requirement.ranged == null || state.ranged >= requirement.ranged) &&
    (requirement.magic == null || state.magic >= requirement.magic)
  );
}

export function defaultPool(combatStyle: CombatStyle, context: SimulationContext): PlannerPool {
  const source = CANDIDATE_POOLS[combatStyle] ?? CANDIDATE_POOLS.melee;
  const equipmentExists = (slot: Exclude<PlannerGearSlot, "weapon">, itemId: EntityId) =>
    itemId === "none" || !!context.gameData.equipment[slot as EquipmentSlot]?.[itemId];
  return {
    weapon: source.weapon.filter((itemId) => !!context.gameData.weapons[itemId]),
    helm: withNone(source.helm.filter((itemId) => equipmentExists("helm", itemId))),
    body: withNone(source.body.filter((itemId) => equipmentExists("body", itemId))),
    legs: withNone(source.legs.filter((itemId) => equipmentExists("legs", itemId))),
    shield: withNone(source.shield.filter((itemId) => equipmentExists("shield", itemId)))
  };
}

export function spellLadder(weaponId: EntityId, context: SimulationContext) {
  const element = STAFF_ELEM[weaponId] ?? "fire";
  return [`${element}_strike`, `${element}_bolt`, `${element}_blast`, `${element}_wave`]
    .map((spellId) => ({ id: spellId, ...context.gameData.spells[spellId] }))
    .filter((spell) => typeof spell.base === "number");
}

export function trainingStanceId(
  combatStyle: CombatStyle,
  weaponId: EntityId,
  skill: PlannerSkill,
  context: SimulationContext,
  fallbackStyleId: EntityId
): EntityId {
  if (combatStyle === "ranged") {
    return skill === "defence" ? "longrange" : fallbackStyleId || "rapid";
  }
  if (combatStyle === "magic") {
    return skill === "defence" ? "defensive" : fallbackStyleId || "accurate";
  }

  const wantedStyles =
    skill === "attack"
      ? ["accurate", "controlled"]
      : skill === "strength"
        ? ["aggressive", "controlled"]
        : ["defensive", "controlled"];
  const stances = weaponStances(weaponId, context.gameData);
  for (const style of wantedStyles) {
    const stance = stances.find((candidate) => candidate.style === style);
    if (stance) return stance.id;
  }
  return fallbackStyleId;
}

export function combatLevel(state: PlannerLevels, prayer = 1, hitpoints = 10): number {
  const base = 0.25 * (state.defence + hitpoints + Math.floor(prayer / 2));
  const melee = 0.325 * (state.attack + state.strength);
  const ranged = 0.325 * Math.floor(1.5 * state.ranged);
  const magic = 0.325 * Math.floor(1.5 * state.magic);
  return Math.floor(base + Math.max(melee, ranged, magic));
}

export function evaluatePlannerCandidate(
  input: PlannerInput,
  context: SimulationContext,
  request: SimulationRequest,
  metric: PlannerMetric,
  refs?: { xph: number; gph: number }
): PlannerEvaluation {
  const combat = simulateCombat(request, context);
  const trip = simulateTripLootSupply(
    {
      request,
      combat,
      trip: input.trip,
      lootPrefs: input.lootPrefs,
      ringOfWealth: input.ringOfWealth,
      legendsComplete: input.legendsComplete,
      jewelSpot: input.jewelSpot,
      overheadSec: input.overheadSec
    },
    context
  );
  const xp = computeCombatXpBreakdown(request, context, combat);
  const effectiveXpPerHour = xp.combatXpPerKill * trip.effectiveKph;
  const effectiveNetGpPerHour = trip.effectiveNetGpPerHour;
  const dps = combat.effectiveDps;
  const metricValue = metricFromValues(
    metric,
    { effectiveXpPerHour, effectiveNetGpPerHour, dps },
    refs
  );
  const armour = plannerArmourFromGear(request.loadout.gear);
  const weapon = context.gameData.weapons[request.loadout.weaponId];
  const spell = request.spellId ? context.gameData.spells[request.spellId] : undefined;

  return {
    request,
    combat,
    trip,
    metricValue,
    dps,
    effectiveXpPerHour,
    effectiveNetGpPerHour,
    combatXpPerKill: xp.combatXpPerKill,
    weaponId: request.loadout.weaponId,
    weaponName: weapon?.name ?? request.loadout.weaponId,
    spellId: request.spellId ?? null,
    spellName: spell?.name ?? null,
    armour,
    warnings: [...combat.warnings, ...trip.warnings]
  };
}

export function buildPlan(
  input: PlannerInput,
  context: SimulationContext,
  options: PlannerOptions = {}
): PlannerPlan {
  const metric = options.metric ?? "xph";
  const baseRequest = {
    ...input.request,
    sustained: options.sustained ?? input.request.sustained
  };
  const combatStyle = baseRequest.combatStyle;
  const allSkills = SKILLS_FOR[combatStyle] ?? SKILLS_FOR.melee;
  const pool = mergePool(defaultPool(combatStyle, context), options.pool);
  const targets = targetLevels(baseRequest.levels, allSkills, options.targets);
  const skills = allSkills.filter(
    (skill) => targets[skill] != null && targets[skill]! > baseRequest.levels[skill]
  );
  const startXp = startingXp(baseRequest.levels, allSkills, options.startXp);
  const warnings = [
    ...requirementFallbackWarningsForPlanner(baseRequest, pool, context),
    ...plannerPoolWarnings(pool, context)
  ];
  const refs =
    metric === "balanced"
      ? balancedRefs(input, context, baseRequest, metric, pool, options.lockGear)
      : undefined;

  const evaluationCache = new Map<string, PlannerEvaluation>();
  const configCache = new Map<string, PlannerEvaluation>();

  const evaluateCached = (request: SimulationRequest) => {
    const key = evaluationKey(request, metric, refs);
    const cached = evaluationCache.get(key);
    if (cached) return cached;
    const evaluated = evaluatePlannerCandidate(input, context, request, metric, refs);
    evaluationCache.set(key, evaluated);
    return evaluated;
  };

  const cfgOf = (state: PlannerLevels, trainingSkill?: PlannerSkill) => {
    const key = `${levelKey(state)}|${trainingSkill ?? "main"}`;
    const cached = configCache.get(key);
    if (cached) return cached;
    const evaluated = bestConfigForState(
      input,
      context,
      baseRequest,
      state,
      pool,
      options.lockGear ?? false,
      metric,
      refs,
      evaluateCached,
      trainingSkill
    );
    configCache.set(key, evaluated);
    return evaluated;
  };

  const state = levelsFromRequest(baseRequest.levels);
  const progressXp: Record<PlannerSkill, number> = {} as Record<PlannerSkill, number>;
  for (const skill of allSkills) {
    const level = state[skill];
    const lo = xpAt(level);
    const hi = level < 99 ? xpAt(level + 1) - 1 : xpAt(99);
    const supplied = startXp[skill];
    progressXp[skill] =
      supplied != null && Number.isFinite(supplied) ? Math.max(lo, Math.min(hi, supplied)) : lo;
  }

  const thresholds = buildThresholds(
    pool,
    context,
    combatStyle,
    baseRequest,
    allSkills,
    options.lockGear ?? false
  );
  const nextThreshold = (skill: PlannerSkill, current: number) => {
    for (const level of thresholds[skill] ?? []) {
      if (level > current) return level;
    }
    return null;
  };
  const xpToReach = (skill: PlannerSkill, level: number) =>
    Math.max(0, xpAt(level) - progressXp[skill]);

  const startCfg = cfgOf({ ...state });
  const steps: PlannerStep[] = [];
  const maxLevels = options.maxLevels ?? 600;
  let cumXp = 0;

  const remaining = () => skills.filter((skill) => state[skill] < (targets[skill] ?? state[skill]));
  let guard = 0;
  while (remaining().length && steps.length < maxLevels && guard < maxLevels + 50) {
    guard += 1;
    let best: { skill: PlannerSkill; perXp: number; gain: number } | null = null;

    for (const skill of remaining()) {
      const now = cfgOf({ ...state }, skill).metricValue;
      const current = state[skill];
      const target = targets[skill] ?? current;
      const threshold = nextThreshold(skill, current);
      const horizon = Math.min(target, threshold ?? target);
      const scanTop = Math.min(target, current + 6);
      const candidates = new Set<number>();
      for (let level = current + 1; level <= scanTop; level += 1) candidates.add(level);
      if (horizon > scanTop) candidates.add(horizon);

      for (const level of candidates) {
        const candidateState = { ...state, [skill]: level };
        const metricAfter = cfgOf(candidateState, skill).metricValue;
        const dxp = xpToReach(skill, level);
        if (dxp <= 0) continue;
        const perXp = (metricAfter - now) / dxp;
        if (!best || perXp > best.perXp + 1e-15) {
          best = { skill, perXp, gain: metricAfter - now };
        }
      }
    }

    const skill = best?.skill ?? remaining()[0];
    if (!skill) break;
    const from = state[skill];
    const dxp = xpToReach(skill, from + 1);
    state[skill] = from + 1;
    progressXp[skill] = xpAt(from + 1);
    cumXp += dxp;

    const displayCfg = cfgOf({ ...state });
    const trainingCfg = cfgOf({ ...state }, skill);
    steps.push({
      skill,
      from,
      to: from + 1,
      dxp,
      cumXp,
      metricValue: displayCfg.metricValue,
      dps: displayCfg.dps,
      effectiveXpPerHour: displayCfg.effectiveXpPerHour,
      effectiveNetGpPerHour: displayCfg.effectiveNetGpPerHour,
      combat: combatLevel(state, baseRequest.levels.prayer),
      cfg: displayCfg,
      trainingCfg,
      state: { ...state },
      stanceId: trainingCfg.request.styleId
    });
  }

  const unlocks = deriveTransitions(startCfg, steps, context);
  const phases = derivePhases(startCfg, steps, unlocks);
  const end = steps.length ? steps[steps.length - 1] : null;

  return {
    ok: true,
    combatStyle,
    metric,
    start: {
      state: levelsFromRequest(baseRequest.levels),
      dps: startCfg.dps,
      metricValue: startCfg.metricValue,
      combat: combatLevel(levelsFromRequest(baseRequest.levels), baseRequest.levels.prayer),
      cfg: startCfg
    },
    end,
    steps,
    phases,
    unlocks,
    totalXp: cumXp,
    truncated: steps.length >= maxLevels && remaining().length > 0,
    skills,
    targets,
    warnings: [...warnings, ...collectEvaluationWarnings(startCfg, steps)]
  };
}

function metricFromValues(
  metric: PlannerMetric,
  values: { effectiveXpPerHour: number; effectiveNetGpPerHour: number; dps: number },
  refs?: { xph: number; gph: number }
): number {
  if (metric === "dps") return values.dps;
  if (metric === "gph") return values.effectiveNetGpPerHour;
  if (metric === "balanced") {
    const refXph = refs?.xph ?? 1;
    const refGph = refs?.gph ?? 1;
    return (
      0.5 * (values.effectiveXpPerHour / refXph) + 0.5 * (values.effectiveNetGpPerHour / refGph)
    );
  }
  return values.effectiveXpPerHour;
}

function balancedRefs(
  input: PlannerInput,
  context: SimulationContext,
  baseRequest: SimulationRequest,
  metric: PlannerMetric,
  pool: PlannerPool,
  lockGear: boolean | undefined
): { xph: number; gph: number } {
  const state = levelsFromRequest(baseRequest.levels);
  const evaluated = bestConfigForState(
    input,
    context,
    baseRequest,
    state,
    pool,
    lockGear ?? false,
    metric,
    undefined,
    (request) => evaluatePlannerCandidate(input, context, request, "xph"),
    undefined
  );
  return {
    xph: Math.max(1, Math.abs(evaluated.effectiveXpPerHour)),
    gph: Math.max(1, Math.abs(evaluated.effectiveNetGpPerHour))
  };
}

function bestConfigForState(
  _input: PlannerInput,
  context: SimulationContext,
  baseRequest: SimulationRequest,
  state: PlannerLevels,
  pool: PlannerPool,
  lockGear: boolean,
  _metric: PlannerMetric,
  _refs: { xph: number; gph: number } | undefined,
  evaluate: (request: SimulationRequest) => PlannerEvaluation,
  trainingSkill: PlannerSkill | undefined
): PlannerEvaluation {
  const weaponCandidates = candidateWeapons(baseRequest, context, pool, state, lockGear);
  let best: PlannerEvaluation | null = null;

  for (const weaponId of weaponCandidates) {
    const weapon = context.gameData.weapons[weaponId];
    if (!weapon) continue;
    const armour = lockGear
      ? plannerArmourFromGear(baseRequest.loadout.gear)
      : pickArmourForWeapon(context, baseRequest, state, pool, weaponId, trainingSkill, evaluate);
    const styleId = trainingSkill
      ? trainingStanceId(
          baseRequest.combatStyle,
          weaponId,
          trainingSkill,
          context,
          baseRequest.styleId
        )
      : baseRequest.styleId;
    const spellIds =
      baseRequest.combatStyle === "magic"
        ? spellCandidates(baseRequest, context, state)
        : [baseRequest.spellId ?? ""];

    for (const spellId of spellIds) {
      const request = requestForState(
        baseRequest,
        state,
        weaponId,
        armour,
        styleId,
        spellId || undefined
      );
      const evaluated = evaluate(request);
      if (!best || evaluated.metricValue > best.metricValue) {
        best = evaluated;
      }
    }
  }

  if (!best) {
    const armour = plannerArmourFromGear(baseRequest.loadout.gear);
    const request = requestForState(
      baseRequest,
      state,
      baseRequest.loadout.weaponId,
      armour,
      baseRequest.styleId,
      baseRequest.spellId
    );
    return evaluate(request);
  }

  return best;
}

function pickArmourForWeapon(
  context: SimulationContext,
  baseRequest: SimulationRequest,
  state: PlannerLevels,
  pool: PlannerPool,
  weaponId: EntityId,
  trainingSkill: PlannerSkill | undefined,
  evaluate: (request: SimulationRequest) => PlannerEvaluation
): ArmourSelection {
  const weapon = context.gameData.weapons[weaponId];
  let armour = plannerArmourFromGear(baseRequest.loadout.gear);
  const styleId = trainingSkill
    ? trainingStanceId(
        baseRequest.combatStyle,
        weaponId,
        trainingSkill,
        context,
        baseRequest.styleId
      )
    : baseRequest.styleId;
  const spellId = spellCandidates(baseRequest, context, state)[0] || baseRequest.spellId;

  for (let pass = 0; pass < 2; pass += 1) {
    for (const slot of PLANNER_ARMOUR_SLOTS) {
      if (slot === "shield" && weapon?.twoHand) {
        armour = { ...armour, shield: "none" };
        continue;
      }
      let bestItem = armour[slot];
      let bestValue = -Infinity;
      for (const itemId of slotCandidates(pool, context, slot, state)) {
        const trialArmour = { ...armour, [slot]: itemId };
        const request = requestForState(
          baseRequest,
          state,
          weaponId,
          trialArmour,
          styleId,
          spellId
        );
        const evaluated = evaluate(request);
        if (evaluated.metricValue > bestValue) {
          bestValue = evaluated.metricValue;
          bestItem = itemId;
        }
      }
      armour = { ...armour, [slot]: bestItem };
    }
  }

  return armour;
}

function candidateWeapons(
  baseRequest: SimulationRequest,
  context: SimulationContext,
  pool: PlannerPool,
  state: PlannerLevels,
  lockGear: boolean
): EntityId[] {
  if (lockGear || baseRequest.combatStyle === "magic") {
    return [baseRequest.loadout.weaponId];
  }
  const candidates = (pool.weapon ?? [])
    .filter((weaponId) => !!context.gameData.weapons[weaponId])
    .filter((weaponId) => equippable(weaponId, state, context.gameData));
  if (
    !candidates.includes(baseRequest.loadout.weaponId) &&
    equippable(baseRequest.loadout.weaponId, state, context.gameData)
  ) {
    candidates.push(baseRequest.loadout.weaponId);
  }
  return candidates.length ? [...new Set(candidates)] : [baseRequest.loadout.weaponId];
}

function spellCandidates(
  baseRequest: SimulationRequest,
  context: SimulationContext,
  state: PlannerLevels
): EntityId[] {
  if (baseRequest.combatStyle !== "magic") return [baseRequest.spellId ?? ""];
  const ladder = spellLadder(baseRequest.loadout.weaponId, context)
    .filter((spell) => state.magic >= (spell.lvl ?? 1))
    .map((spell) => spell.id);
  if (baseRequest.spellId && !ladder.includes(baseRequest.spellId))
    ladder.push(baseRequest.spellId);
  return ladder.length ? ladder : [baseRequest.spellId ?? ""];
}

function slotCandidates(
  pool: PlannerPool,
  context: SimulationContext,
  slot: Exclude<PlannerGearSlot, "weapon">,
  state: PlannerLevels
): EntityId[] {
  const source = withNone(pool[slot] ?? ["none"]);
  return source
    .filter(
      (itemId) => itemId === "none" || !!context.gameData.equipment[slot as EquipmentSlot]?.[itemId]
    )
    .filter((itemId) => equippable(itemId, state, context.gameData));
}

function requestForState(
  baseRequest: SimulationRequest,
  state: PlannerLevels,
  weaponId: EntityId,
  armour: ArmourSelection,
  styleId: EntityId,
  spellId?: EntityId
): SimulationRequest {
  const weapon = baseRequest.loadout;
  const gear: GearSelection = {
    ...weapon.gear,
    ...armour
  };
  return {
    ...baseRequest,
    levels: {
      ...baseRequest.levels,
      attack: state.attack,
      strength: state.strength,
      defence: state.defence,
      ranged: state.ranged,
      magic: state.magic
    },
    loadout: {
      ...baseRequest.loadout,
      weaponId,
      gear
    },
    styleId,
    ...(spellId ? { spellId } : {})
  };
}

function plannerArmourFromGear(gear: GearSelection): ArmourSelection {
  return {
    helm: gear.helm ?? "none",
    body: gear.body ?? "none",
    legs: gear.legs ?? "none",
    shield: gear.shield ?? "none"
  };
}

function targetLevels(
  levels: PlayerLevels,
  skills: PlannerSkill[],
  targets: Partial<Record<PlannerSkill, number>> | undefined
): Partial<Record<PlannerSkill, number>> {
  const out: Partial<Record<PlannerSkill, number>> = {};
  for (const skill of skills) {
    out[skill] = Math.max(
      levels[skill],
      Math.min(99, Math.floor(targets?.[skill] ?? levels[skill]))
    );
  }
  return out;
}

function startingXp(
  levels: PlayerLevels,
  skills: PlannerSkill[],
  supplied: Partial<Record<PlannerSkill, number>> | undefined
): Partial<Record<PlannerSkill, number>> {
  const out: Partial<Record<PlannerSkill, number>> = {};
  for (const skill of skills) {
    const level = levels[skill];
    const lo = xpAt(level);
    const hi = level < 99 ? xpAt(level + 1) - 1 : xpAt(99);
    const value = supplied?.[skill];
    out[skill] = value != null && Number.isFinite(value) ? Math.max(lo, Math.min(hi, value)) : lo;
  }
  return out;
}

function buildThresholds(
  pool: PlannerPool,
  context: SimulationContext,
  combatStyle: CombatStyle,
  baseRequest: SimulationRequest,
  skills: PlannerSkill[],
  lockGear: boolean
): Record<PlannerSkill, number[]> {
  const out: Record<PlannerSkill, number[]> = {
    attack: [],
    strength: [],
    defence: [],
    ranged: [],
    magic: []
  };
  if (!lockGear) {
    const items = [
      ...(pool.weapon ?? []),
      ...(pool.helm ?? []),
      ...(pool.body ?? []),
      ...(pool.legs ?? []),
      ...(pool.shield ?? [])
    ];
    for (const skill of skills) {
      const set = new Set<number>();
      for (const itemId of items) {
        const level = reqLevel(itemId, skill, context.gameData);
        if (level > 1) set.add(level);
      }
      if (combatStyle === "magic" && skill === "magic") {
        for (const spell of spellLadder(baseRequest.loadout.weaponId, context)) {
          if ((spell.lvl ?? 1) > 1) set.add(spell.lvl ?? 1);
        }
      }
      out[skill] = [...set].sort((left, right) => left - right);
    }
  }
  return out;
}

function deriveTransitions(
  startCfg: PlannerEvaluation,
  steps: PlannerStep[],
  context: SimulationContext
): PlannerTransition[] {
  const transitions: PlannerTransition[] = [];
  const previous: Record<PlannerGearSlot | "spell", EntityId | null> = {
    weapon: startCfg.weaponId,
    spell: startCfg.spellId,
    helm: startCfg.armour.helm,
    body: startCfg.armour.body,
    legs: startCfg.armour.legs,
    shield: startCfg.armour.shield
  };

  steps.forEach((step, index) => {
    const current: Record<PlannerGearSlot | "spell", EntityId | null> = {
      weapon: step.cfg.weaponId,
      spell: step.cfg.spellId,
      helm: step.cfg.armour.helm,
      body: step.cfg.armour.body,
      legs: step.cfg.armour.legs,
      shield: step.cfg.armour.shield
    };

    for (const slot of Object.keys(current) as Array<PlannerGearSlot | "spell">) {
      const itemId = current[slot];
      if (!itemId || itemId === "none" || itemId === previous[slot]) continue;
      const binding = bindingRequirement(itemId, step.skill, slot, context) ?? {
        skill: step.skill,
        level: step.to
      };
      const wasLockedByLevel = step.from < binding.level && step.to >= binding.level;
      transitions.push({
        slot,
        type: wasLockedByLevel ? "unlock" : "switch",
        itemId,
        name: nameFor(slot, itemId, context),
        previousItemId: previous[slot],
        previousName: previous[slot] ? nameFor(slot, previous[slot]!, context) : null,
        skill: step.skill,
        level: step.to,
        reqSkill: binding.skill,
        reqLevel: binding.level,
        stepIndex: index,
        cumXp: step.cumXp,
        dpsBefore: index > 0 ? steps[index - 1]!.dps : startCfg.dps,
        dpsAfter: step.dps
      });
      previous[slot] = itemId;
    }
  });

  return transitions;
}

function derivePhases(
  startCfg: PlannerEvaluation,
  steps: PlannerStep[],
  unlocks: PlannerTransition[]
): PlannerPhase[] {
  const phases: PlannerPhase[] = [];
  for (const [index, step] of steps.entries()) {
    const previous = phases[phases.length - 1];
    if (previous && previous.skill === step.skill) {
      previous.to = step.to;
      previous.endDps = step.dps;
      previous.endMetric = step.metricValue;
      previous.cumXp = step.cumXp;
      previous.combat = step.combat;
      previous.xp += step.dxp;
      previous.lastStep = index;
    } else {
      phases.push({
        skill: step.skill,
        from: step.from,
        to: step.to,
        startDps: previous ? previous.endDps : startCfg.dps,
        endDps: step.dps,
        startMetric: previous ? previous.endMetric : startCfg.metricValue,
        endMetric: step.metricValue,
        xp: step.dxp,
        cumXp: step.cumXp,
        combat: step.combat,
        firstStep: index,
        lastStep: index,
        unlocks: []
      });
    }
  }

  for (const transition of unlocks) {
    const phase = phases.find(
      (candidate) =>
        transition.stepIndex >= candidate.firstStep && transition.stepIndex <= candidate.lastStep
    );
    if (phase) phase.unlocks.push(transition);
  }

  return phases;
}

function bindingRequirement(
  itemId: EntityId,
  preferredSkill: PlannerSkill,
  slot: PlannerGearSlot | "spell",
  context: SimulationContext
): { skill: PlannerSkill; level: number } | null {
  if (slot === "spell") {
    const spell = context.gameData.spells[itemId];
    return spell?.lvl && spell.lvl > 1 ? { skill: "magic", level: spell.lvl } : null;
  }
  if (reqLevel(itemId, preferredSkill, context.gameData) > 1) {
    return { skill: preferredSkill, level: reqLevel(itemId, preferredSkill, context.gameData) };
  }
  let best: { skill: PlannerSkill; level: number } | null = null;
  for (const skill of LEVEL_SKILLS) {
    const level = reqLevel(itemId, skill, context.gameData);
    if (level > 1 && (!best || level > best.level)) best = { skill, level };
  }
  return best;
}

function nameFor(
  slot: PlannerGearSlot | "spell",
  itemId: EntityId,
  context: SimulationContext
): string {
  if (slot === "weapon") return context.gameData.weapons[itemId]?.name ?? itemId;
  if (slot === "spell") return context.gameData.spells[itemId]?.name ?? itemId;
  return context.gameData.equipment[slot as EquipmentSlot]?.[itemId]?.name ?? itemId;
}

function mergePool(base: PlannerPool, override: PlannerPool | undefined): PlannerPool {
  if (!override) return base;
  return {
    weapon: override.weapon ?? base.weapon,
    helm: withNone(override.helm ?? base.helm ?? ["none"]),
    body: withNone(override.body ?? base.body ?? ["none"]),
    legs: withNone(override.legs ?? base.legs ?? ["none"]),
    shield: withNone(override.shield ?? base.shield ?? ["none"])
  };
}

function requirementFallbackWarningsForPlanner(
  baseRequest: SimulationRequest,
  pool: PlannerPool,
  context: SimulationContext
): SimulationWarning[] {
  const itemIds = new Set<EntityId>([
    baseRequest.loadout.weaponId,
    ...Object.values(baseRequest.loadout.gear).filter(
      (itemId): itemId is EntityId => typeof itemId === "string"
    ),
    ...(pool.weapon ?? []),
    ...(pool.helm ?? []),
    ...(pool.body ?? []),
    ...(pool.legs ?? []),
    ...(pool.shield ?? [])
  ]);
  itemIds.delete("none");

  const fallbackItemIds = [...itemIds]
    .filter((itemId) => requirementForItem(context.gameData, itemId).source === "manual-fallback")
    .sort();
  if (fallbackItemIds.length === 0) return [];

  const shownItems = fallbackItemIds.slice(0, 5).join(", ");
  const hiddenCount = fallbackItemIds.length - 5;
  const suffix = hiddenCount > 0 ? `, and ${hiddenCount} more` : "";
  return [
    {
      code: "manual-planner-requirement-fallback",
      severity: "info",
      message: `Planner used manual requirement fallback because generated requirement data is missing for ${shownItems}${suffix}.`
    }
  ];
}

function plannerPoolWarnings(pool: PlannerPool, context: SimulationContext): SimulationWarning[] {
  const warnings: SimulationWarning[] = [];
  for (const weaponId of pool.weapon ?? []) {
    if (!context.gameData.weapons[weaponId]) {
      warnings.push({
        code: "missing-planner-weapon",
        severity: "warning",
        message: `Planner weapon candidate is not present in the GameDataSnapshot: ${weaponId}`
      });
    }
  }
  for (const slot of PLANNER_ARMOUR_SLOTS) {
    for (const itemId of pool[slot] ?? []) {
      if (itemId !== "none" && !context.gameData.equipment[slot as EquipmentSlot]?.[itemId]) {
        warnings.push({
          code: "missing-planner-equipment",
          severity: "warning",
          message: `Planner ${slot} candidate is not present in the GameDataSnapshot: ${itemId}`
        });
      }
      const item = context.gameData.items[itemId];
      if (item?.provenance?.source === "hypothetical") {
        warnings.push({
          code: "hypothetical-planner-equipment",
          severity: "warning",
          message: `Planner ${slot} candidate is marked hypothetical and needs an explicit product decision: ${itemId}`
        });
      }
    }
  }
  return warnings;
}

function collectEvaluationWarnings(
  startCfg: PlannerEvaluation,
  steps: PlannerStep[]
): SimulationWarning[] {
  const seen = new Set<string>();
  const out: SimulationWarning[] = [];
  for (const warning of [startCfg, ...steps.map((step) => step.cfg)].flatMap(
    (cfg) => cfg.warnings
  )) {
    const key = `${warning.code}|${warning.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(warning);
  }
  return out;
}

function levelsFromRequest(levels: PlayerLevels): PlannerLevels {
  return {
    attack: levels.attack,
    strength: levels.strength,
    defence: levels.defence,
    ranged: levels.ranged,
    magic: levels.magic
  };
}

function levelKey(state: PlannerLevels): string {
  return LEVEL_SKILLS.map((skill) => state[SKILL_TO_LEVEL_KEY[skill]]).join("/");
}

function evaluationKey(
  request: SimulationRequest,
  metric: PlannerMetric,
  refs?: { xph: number; gph: number }
): string {
  const gear = Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot, request.loadout.gear[slot] ?? "none"])
  );
  return JSON.stringify({
    metric,
    refs,
    levels: request.levels,
    monsterId: request.monsterId,
    combatStyle: request.combatStyle,
    weaponId: request.loadout.weaponId,
    ammoId: request.loadout.ammoId ?? "none",
    gear,
    styleId: request.styleId,
    spellId: request.spellId ?? "",
    prayers: request.prayers.keys,
    boosts: request.boosts.keys,
    sustained: request.sustained,
    repotThreshold: request.repotThreshold,
    specialAttack: request.specialAttack,
    charge: request.charge
  });
}

function withNone(items: readonly EntityId[]): EntityId[] {
  return [...new Set(["none", ...items])];
}

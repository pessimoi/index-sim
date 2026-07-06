import { z } from "zod";
import {
  loadPersisted,
  savePersisted,
  type KeyValueStorage,
  type PersistedEnvelope
} from "@/adapters/storage";
import type { PlannerGearSlot, PlannerMetric, PlannerPool, PlannerSkill } from "@/domain/planner";
import type { CombatSetupFormState } from "./ui-state";

export const PLANNER_UI_STORAGE_KEY = "index-sim:planner-ui";
export const PLANNER_UI_VERSION = 1;

export const PLANNER_SKILLS = ["attack", "strength", "defence", "ranged", "magic"] as const;
export const PLANNER_METRICS = ["xph", "gph", "dps", "balanced"] as const;
export const PLANNER_GEAR_SLOTS = ["weapon", "helm", "body", "legs", "shield"] as const;

const MAX_SKILL_XP = 200_000_000;
const MAX_PLANNER_GEAR_POOL_IDS = 500;
const MAX_PLANNER_ITEM_ID_LENGTH = 120;

export const DEFAULT_PLANNER_TARGET_LEVELS = {
  attack: 62,
  strength: 62,
  defence: 50,
  ranged: 50,
  magic: 50
} satisfies Record<PlannerSkill, number>;

export const DEFAULT_PLANNER_CURRENT_XP = {
  attack: 0,
  strength: 0,
  defence: 0,
  ranged: 0,
  magic: 0
} satisfies Record<PlannerSkill, number>;

export const DEFAULT_PLANNER_SKILL_LOCKS = {
  attack: false,
  strength: false,
  defence: false,
  ranged: false,
  magic: false
} satisfies Record<PlannerSkill, boolean>;

export const PlannerMetricSchema = z.enum(PLANNER_METRICS);

const PlannerTargetLevelsSchema = z
  .object({
    attack: z.number().int().min(1).max(99).catch(DEFAULT_PLANNER_TARGET_LEVELS.attack),
    strength: z.number().int().min(1).max(99).catch(DEFAULT_PLANNER_TARGET_LEVELS.strength),
    defence: z.number().int().min(1).max(99).catch(DEFAULT_PLANNER_TARGET_LEVELS.defence),
    ranged: z.number().int().min(1).max(99).catch(DEFAULT_PLANNER_TARGET_LEVELS.ranged),
    magic: z.number().int().min(1).max(99).catch(DEFAULT_PLANNER_TARGET_LEVELS.magic)
  })
  .strict()
  .catch(DEFAULT_PLANNER_TARGET_LEVELS)
  .default(DEFAULT_PLANNER_TARGET_LEVELS);

const PlannerCurrentXpSchema = z
  .object({
    attack: z.number().int().min(0).max(MAX_SKILL_XP).catch(DEFAULT_PLANNER_CURRENT_XP.attack),
    strength: z
      .number()
      .int()
      .min(0)
      .max(MAX_SKILL_XP)
      .catch(DEFAULT_PLANNER_CURRENT_XP.strength),
    defence: z.number().int().min(0).max(MAX_SKILL_XP).catch(DEFAULT_PLANNER_CURRENT_XP.defence),
    ranged: z.number().int().min(0).max(MAX_SKILL_XP).catch(DEFAULT_PLANNER_CURRENT_XP.ranged),
    magic: z.number().int().min(0).max(MAX_SKILL_XP).catch(DEFAULT_PLANNER_CURRENT_XP.magic)
  })
  .strict()
  .catch(DEFAULT_PLANNER_CURRENT_XP)
  .default(DEFAULT_PLANNER_CURRENT_XP);

const PlannerSkillLocksSchema = z
  .object({
    attack: z.boolean().catch(DEFAULT_PLANNER_SKILL_LOCKS.attack),
    strength: z.boolean().catch(DEFAULT_PLANNER_SKILL_LOCKS.strength),
    defence: z.boolean().catch(DEFAULT_PLANNER_SKILL_LOCKS.defence),
    ranged: z.boolean().catch(DEFAULT_PLANNER_SKILL_LOCKS.ranged),
    magic: z.boolean().catch(DEFAULT_PLANNER_SKILL_LOCKS.magic)
  })
  .strict()
  .catch(DEFAULT_PLANNER_SKILL_LOCKS)
  .default(DEFAULT_PLANNER_SKILL_LOCKS);

const PlannerItemIdsSchema = z
  .array(z.string().min(1).max(MAX_PLANNER_ITEM_ID_LENGTH).catch(""))
  .max(MAX_PLANNER_GEAR_POOL_IDS)
  .catch([])
  .default([])
  .transform((ids) =>
    Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(
      0,
      MAX_PLANNER_GEAR_POOL_IDS
    )
  );

export const PlannerGearPoolSchema = z
  .object({
    weapon: PlannerItemIdsSchema.optional(),
    helm: PlannerItemIdsSchema.optional(),
    body: PlannerItemIdsSchema.optional(),
    legs: PlannerItemIdsSchema.optional(),
    shield: PlannerItemIdsSchema.optional()
  })
  .strict()
  .catch({})
  .default({})
  .transform((pool): PlannerPool => {
    const next: PlannerPool = {};
    for (const slot of PLANNER_GEAR_SLOTS) {
      const itemIds = pool[slot];
      if (itemIds?.length) next[slot] = itemIds;
    }
    return next;
  });

export const PlannerUiStateSchema = z
  .object({
    metric: PlannerMetricSchema.catch("xph").default("xph"),
    targetLevels: PlannerTargetLevelsSchema,
    currentXp: PlannerCurrentXpSchema,
    skillLocks: PlannerSkillLocksSchema,
    averageOverSession: z.boolean().catch(true).default(true),
    onlyCurrentGear: z.boolean().catch(false).default(false),
    gearPool: PlannerGearPoolSchema
  })
  .strict()
  .catch({
    metric: "xph",
    targetLevels: DEFAULT_PLANNER_TARGET_LEVELS,
    currentXp: DEFAULT_PLANNER_CURRENT_XP,
    skillLocks: DEFAULT_PLANNER_SKILL_LOCKS,
    averageOverSession: true,
    onlyCurrentGear: false,
    gearPool: {}
  })
  .default({
    metric: "xph",
    targetLevels: DEFAULT_PLANNER_TARGET_LEVELS,
    currentXp: DEFAULT_PLANNER_CURRENT_XP,
    skillLocks: DEFAULT_PLANNER_SKILL_LOCKS,
    averageOverSession: true,
    onlyCurrentGear: false,
    gearPool: {}
  });

export type PlannerUiState = z.infer<typeof PlannerUiStateSchema>;

export const DEFAULT_PLANNER_UI_STATE: PlannerUiState = PlannerUiStateSchema.parse({});

export function createDefaultPlannerUiState(
  form?: Pick<CombatSetupFormState, "levels" | "plannerTargets">
): PlannerUiState {
  const targetLevels: Record<PlannerSkill, number> = { ...DEFAULT_PLANNER_TARGET_LEVELS };
  for (const skill of PLANNER_SKILLS) {
    targetLevels[skill] =
      form?.plannerTargets?.[skill] ?? form?.levels?.[skill] ?? DEFAULT_PLANNER_TARGET_LEVELS[skill];
  }
  return PlannerUiStateSchema.parse({
    ...DEFAULT_PLANNER_UI_STATE,
    targetLevels
  });
}

export function normalizePlannerUiState(value: unknown): PlannerUiState {
  return PlannerUiStateSchema.parse(value);
}

export function cleanPlannerUiStateForPool(
  state: PlannerUiState,
  allowedPool: PlannerPool
): PlannerUiState {
  const normalized = normalizePlannerUiState(state);
  const gearPool: PlannerPool = {};
  for (const slot of PLANNER_GEAR_SLOTS) {
    const selected = normalized.gearPool[slot];
    const allowed = allowedPool[slot];
    if (!selected?.length || !allowed?.length) continue;
    const selectedIds = new Set(selected);
    const cleaned = allowed.filter((itemId) => selectedIds.has(itemId));
    if (cleaned.length) gearPool[slot] = cleaned;
  }
  return normalizePlannerUiState({
    ...normalized,
    gearPool
  });
}

export function effectivePlannerGearPool(
  state: PlannerUiState,
  allowedPool: PlannerPool
): PlannerPool {
  const cleaned = cleanPlannerUiStateForPool(state, allowedPool);
  const pool: PlannerPool = {};
  for (const slot of PLANNER_GEAR_SLOTS) {
    pool[slot] = cleaned.gearPool[slot] ?? allowedPool[slot] ?? [];
  }
  return pool;
}

export function setPlannerGearPoolItem(
  state: PlannerUiState,
  allowedPool: PlannerPool,
  slot: PlannerGearSlot,
  itemId: string,
  selected: boolean
): PlannerUiState {
  const allowed = allowedPool[slot] ?? [];
  if (!allowed.includes(itemId)) return cleanPlannerUiStateForPool(state, allowedPool);

  const cleaned = cleanPlannerUiStateForPool(state, allowedPool);
  const selectedIds = new Set(cleaned.gearPool[slot] ?? allowed);
  if (selected) {
    selectedIds.add(itemId);
  } else if (selectedIds.size > 1) {
    selectedIds.delete(itemId);
  }

  const nextSlotIds = allowed.filter((candidateId) => selectedIds.has(candidateId));
  const gearPool = { ...cleaned.gearPool };
  if (nextSlotIds.length === allowed.length) {
    delete gearPool[slot];
  } else {
    gearPool[slot] = nextSlotIds;
  }

  return normalizePlannerUiState({
    ...cleaned,
    gearPool
  });
}

export function resetPlannerGearPoolSlot(
  state: PlannerUiState,
  slot: PlannerGearSlot
): PlannerUiState {
  const cleaned = normalizePlannerUiState(state);
  const gearPool = { ...cleaned.gearPool };
  delete gearPool[slot];
  return normalizePlannerUiState({
    ...cleaned,
    gearPool
  });
}

function plannerUiStorageOptions(storage: KeyValueStorage, now?: () => Date) {
  return {
    key: PLANNER_UI_STORAGE_KEY,
    version: PLANNER_UI_VERSION,
    schema: PlannerUiStateSchema,
    storage,
    now
  };
}

export function loadPlannerUiState(storage: KeyValueStorage): PlannerUiState {
  const persisted = loadPersisted(plannerUiStorageOptions(storage));
  return persisted.status === "loaded" ? persisted.value : DEFAULT_PLANNER_UI_STATE;
}

export function savePlannerUiState(
  storage: KeyValueStorage,
  state: PlannerUiState,
  now?: () => Date
): PersistedEnvelope<PlannerUiState> {
  return savePersisted(plannerUiStorageOptions(storage, now), state);
}

export function plannerMetricLabel(metric: PlannerMetric): string {
  if (metric === "gph") return "GP/hr";
  if (metric === "dps") return "DPS";
  if (metric === "balanced") return "Balanced";
  return "XP/hr";
}

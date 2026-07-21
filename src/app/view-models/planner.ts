import {
  buildPlan,
  defaultPool,
  plannerXpBounds,
  reqOf,
  SKILL_LABEL,
  SLOT_LABEL,
  type PlannerGearSlot,
  type PlannerInput,
  type PlannerOptions,
  type PlannerPhase,
  type PlannerPlan,
  type PlannerPool,
  type PlannerSkill,
  type PlannerTransition
} from "@/domain/planner";
import type {
  CombatStyle,
  EntityId,
  EquipmentSlot,
  GameDataSnapshot,
  SimulationContext,
  SimulationWarning
} from "@/domain/shared";
import { lootSettingsForMonster, type LootSettingsByMonsterState } from "../state/loot-settings";
import {
  PLANNER_GEAR_SLOTS,
  PLANNER_SKILLS,
  cleanPlannerUiStateForPool,
  createDefaultPlannerUiState,
  effectivePlannerGearPool,
  effectivePlannerStartXp,
  effectivePlannerTarget,
  normalizePlannerUiState,
  type PlannerProgressAdjustment,
  type PlannerUiState
} from "../state/planner";
import {
  formToSimulationRequest,
  formToTripPolicy,
  type CombatSetupFormState
} from "../state/ui-state";
import { formatNumber } from "./formatting";
import {
  createEntityCollisionIndex,
  createEntityDisplayLabel,
  type EntityCollisionIndex,
  type EntityDisplayLabel
} from "./presentation-language";
import {
  friendlyPriceWarningCopy,
  isMoneyWarningCode,
  isPriceIssueWarningCode,
  normalizeWarningMessage
} from "./warning-presentation";

export interface PlannerDomainAdapterViewModel {
  input: PlannerInput;
  options: PlannerOptions;
  state: PlannerUiState;
  defaultPool: PlannerPool;
  pool: PlannerPool;
}

export interface PlannerSkillInputViewModel {
  skill: PlannerSkill;
  label: string;
  currentLevel: number;
  currentXp: number | null;
  currentXpMode: "auto" | "explicit";
  currentXpMin: number;
  currentXpMax: number;
  effectiveStartXp: number;
  storedTargetLevel: number;
  effectiveTargetLevel: number;
  targetMin: number;
  targetDisabled: boolean;
  locked: boolean;
  xpDescription: string;
  targetDescription: string;
}

export interface PlannerPanelSummaryViewModel {
  totalXp: number;
  stepCount: number;
  phaseCount: number;
  unlockCount: number;
  startDps: number;
  endDps: number;
  startMetric: number;
  endMetric: number;
  truncated: boolean;
}

export interface PlannerTrainingOrderRowViewModel {
  id: string;
  skill: PlannerSkill;
  skillLabel: string;
  from: number;
  to: number;
  xp: number;
  cumXp: number;
  startDps: number;
  endDps: number;
  startMetric: number;
  endMetric: number;
  unlockCount: number;
}

export interface PlannerUnlockRowViewModel {
  id: string;
  itemName: string;
  slotLabel: string;
  type: PlannerTransition["type"];
  skillLabel: string;
  level: number;
  reqSkillLabel: string;
  reqLevel: number;
  cumXp: number;
  dpsBefore: number;
  dpsAfter: number;
}

export interface PlannerGearPoolOptionViewModel {
  id: EntityId;
  label: string;
  accessibleLabel?: string;
  hint: string;
  selected: boolean;
}

export interface PlannerGearPoolSlotViewModel {
  slot: PlannerGearSlot;
  label: string;
  selectedCount: number;
  totalCount: number;
  options: PlannerGearPoolOptionViewModel[];
}

export interface PlannerTimelineEventViewModel {
  id: string;
  itemName: string;
  slotLabel: string;
  type: PlannerTransition["type"];
  skillLabel: string;
  level: number;
  cumXp: number;
  dpsDelta: number;
}

export interface PlannerChartPointViewModel {
  id: string;
  label: string;
  cumXp: number;
  dps: number;
  x: number;
  y: number;
}

export interface PlannerChartViewModel {
  points: PlannerChartPointViewModel[];
  minDps: number;
  maxDps: number;
  maxCumXp: number;
  isEmpty: boolean;
}

export interface PlannerPanelViewModel {
  summary: PlannerPanelSummaryViewModel;
  trainingOrder: PlannerTrainingOrderRowViewModel[];
  unlocks: PlannerUnlockRowViewModel[];
  timeline: PlannerTimelineEventViewModel[];
  chart: PlannerChartViewModel;
  notices: PlannerNoticePresentation;
  isEmpty: boolean;
}

export type PlannerNoticeCategory =
  "plan-limit" | "gear-data" | "price-data" | "combat-model" | "trip-model" | "other";

export type PlannerNoticeAction =
  | { kind: "review-targets"; label: "Review targets" }
  | { kind: "review-gear"; label: "Review gear"; itemId?: EntityId }
  | { kind: "review-loadout"; label: "Review loadout" }
  | { kind: "correct-price"; label: "Correct price"; itemId: EntityId }
  | { kind: "review-price-data"; label: "Review price data"; itemId?: EntityId }
  | { kind: "review-trip"; label: "Review Trip assumptions" }
  | { kind: "review-planner-inputs"; label: "Review Planner inputs" };

export interface PlannerNoticeOccurrenceSummary {
  totalCount: number;
  visibleLabels: string[];
  hiddenCount: number;
}

export interface PlannerNoticeViewModel {
  id: string;
  code: string;
  severity: "info" | "warning" | "error";
  category: PlannerNoticeCategory;
  title: string;
  detail: string;
  itemDisplayLabel?: EntityDisplayLabel;
  occurrences: PlannerNoticeOccurrenceSummary;
  action: PlannerNoticeAction;
  affectsCurrentResult: boolean;
}

export interface PlannerNoticePresentation {
  warningSetId: string;
  issueCount: number;
  noteCount: number;
  occurrenceCount: number;
  rows: PlannerNoticeViewModel[];
}

interface PlannerNoticeRegistryEntry {
  category: PlannerNoticeCategory;
  title: string;
  action: "review-targets" | "review-gear" | "review-loadout" | "review-price-data" | "review-trip";
}

export const PLANNER_NOTICE_CODE_REGISTRY = {
  "planner-truncated": {
    category: "plan-limit",
    title: "Plan stopped at its level limit",
    action: "review-targets"
  },
  "manual-planner-requirement-fallback": {
    category: "gear-data",
    title: "Requirement source is incomplete",
    action: "review-gear"
  },
  "missing-planner-weapon": {
    category: "gear-data",
    title: "Planner weapon is unavailable",
    action: "review-gear"
  },
  "missing-planner-equipment": {
    category: "gear-data",
    title: "Planner equipment is unavailable",
    action: "review-gear"
  },
  "hypothetical-planner-equipment": {
    category: "gear-data",
    title: "Planner equipment needs review",
    action: "review-gear"
  },
  "dragon-halberd-npc-size-fallback": {
    category: "combat-model",
    title: "Dragon halberd size behavior is approximate",
    action: "review-loadout"
  },
  "missing-price": {
    category: "price-data",
    title: "Missing price",
    action: "review-price-data"
  },
  "missing-alch-value": {
    category: "price-data",
    title: "Missing alch value",
    action: "review-price-data"
  },
  "price-fallback-used": {
    category: "price-data",
    title: "Fallback used",
    action: "review-price-data"
  },
  "price-generated-fallback": {
    category: "price-data",
    title: "Estimated price",
    action: "review-price-data"
  },
  "price-market-retained": {
    category: "price-data",
    title: "Previous price retained",
    action: "review-price-data"
  },
  "price-freshness-unknown": {
    category: "price-data",
    title: "Price date unknown",
    action: "review-price-data"
  },
  "price-alias-used": {
    category: "price-data",
    title: "Related item price",
    action: "review-price-data"
  },
  "approximate-data-source": {
    category: "price-data",
    title: "Approximate source",
    action: "review-price-data"
  },
  "unidentified-herb-price-approximation": {
    category: "price-data",
    title: "Estimated herb price",
    action: "review-price-data"
  },
  "incoming-attack-partial-model": {
    category: "trip-model",
    title: "Incoming damage uses a compatibility model",
    action: "review-trip"
  },
  "incoming-attack-compatibility-fallback": {
    category: "trip-model",
    title: "Incoming damage uses a compatibility model",
    action: "review-trip"
  }
} as const satisfies Readonly<Record<string, PlannerNoticeRegistryEntry>>;

export interface PlannerGearPoolEditorViewModel {
  slots: PlannerGearPoolSlotViewModel[];
  totalSelectedCount: number;
  totalOptionCount: number;
}

function isHypotheticalPlannerItem(gameData: GameDataSnapshot, itemId: EntityId): boolean {
  return gameData.items[itemId]?.provenance?.source === "hypothetical";
}

function itemExistsInPlannerSlot(
  gameData: GameDataSnapshot,
  slot: PlannerGearSlot,
  itemId: EntityId
): boolean {
  if (itemId === "none") return true;
  if (slot === "weapon") return !!gameData.weapons[itemId];
  return !!gameData.equipment[slot as EquipmentSlot]?.[itemId];
}

export function plannerAllowedPool(
  combatStyle: CombatStyle,
  context: SimulationContext
): PlannerPool {
  const source = defaultPool(combatStyle, context);
  const pool: PlannerPool = {};
  for (const slot of PLANNER_GEAR_SLOTS) {
    const itemIds = source[slot] ?? [];
    pool[slot] = itemIds.filter(
      (itemId) =>
        itemExistsInPlannerSlot(context.gameData, slot, itemId) &&
        !isHypotheticalPlannerItem(context.gameData, itemId)
    );
  }
  return pool;
}

function plannerPoolItemLabel(
  context: SimulationContext,
  slot: PlannerGearSlot,
  itemId: EntityId,
  collisionIndex: EntityCollisionIndex
): string {
  if (itemId === "none") return "None";
  const sourceName =
    slot === "weapon"
      ? context.gameData.weapons[itemId]?.name
      : context.gameData.equipment[slot as EquipmentSlot]?.[itemId]?.name;
  return createEntityDisplayLabel({
    technicalId: itemId,
    gameDataName: sourceName,
    collisionIndex,
    entityKind: "item"
  }).name;
}

function plannerPoolItemHint(
  context: SimulationContext,
  slot: PlannerGearSlot,
  itemId: EntityId
): string {
  const req = reqOf(itemId, context.gameData);
  const reqs = Object.entries(req)
    .map(([skill, level]) => `${SKILL_LABEL[skill as PlannerSkill]} ${level}`)
    .join(", ");
  if (slot === "weapon") {
    const weapon = context.gameData.weapons[itemId];
    return [weapon ? `speed ${weapon.speed}` : null, reqs || null].filter(Boolean).join(", ");
  }
  return reqs || "no requirement";
}

export function createPlannerGearPoolEditorViewModel(
  form: CombatSetupFormState,
  context: SimulationContext,
  plannerUiState: PlannerUiState
): PlannerGearPoolEditorViewModel {
  const allowedPool = plannerAllowedPool(form.combatStyle, context);
  const collisionIndex = createEntityCollisionIndex(context.gameData);
  const state = cleanPlannerUiStateForPool(plannerUiState, allowedPool);
  const effectivePool = effectivePlannerGearPool(state, allowedPool);
  const slots = PLANNER_GEAR_SLOTS.map((slot): PlannerGearPoolSlotViewModel => {
    const itemIds = allowedPool[slot] ?? [];
    const selected = new Set(effectivePool[slot] ?? []);
    const options = itemIds.map((itemId) => {
      const label = plannerPoolItemLabel(context, slot, itemId, collisionIndex);
      return {
        id: itemId,
        label,
        accessibleLabel: label,
        hint: plannerPoolItemHint(context, slot, itemId),
        selected: selected.has(itemId)
      };
    });
    return {
      slot,
      label: SLOT_LABEL[slot],
      selectedCount: options.filter((option) => option.selected).length,
      totalCount: options.length,
      options
    };
  }).filter((slot) => slot.totalCount > 0);

  return {
    slots,
    totalSelectedCount: slots.reduce((sum, slot) => sum + slot.selectedCount, 0),
    totalOptionCount: slots.reduce((sum, slot) => sum + slot.totalCount, 0)
  };
}

function plannerTargetsForState(
  form: CombatSetupFormState,
  plannerState: PlannerUiState
): Record<PlannerSkill, number> {
  const targets = {} as Record<PlannerSkill, number>;
  for (const skill of PLANNER_SKILLS) {
    targets[skill] = effectivePlannerTarget(
      form.levels[skill],
      plannerState.targetLevels[skill],
      plannerState.skillLocks[skill]
    );
  }
  return targets;
}

function plannerStartXpForState(
  form: CombatSetupFormState,
  plannerState: PlannerUiState
): Record<PlannerSkill, number> {
  const startXp = {} as Record<PlannerSkill, number>;
  for (const skill of PLANNER_SKILLS) {
    startXp[skill] = effectivePlannerStartXp(form.levels[skill], plannerState.currentXp[skill]);
  }
  return startXp;
}

export function createPlannerSkillInputViewModels(
  form: CombatSetupFormState,
  plannerState: PlannerUiState
): PlannerSkillInputViewModel[] {
  return PLANNER_SKILLS.map((skill) => {
    const bounds = plannerXpBounds(form.levels[skill]);
    const storedXp = plannerState.currentXp[skill];
    const explicitXp = storedXp > 0 && storedXp >= bounds.min && storedXp <= bounds.max;
    const auto = !explicitXp;
    const locked = plannerState.skillLocks[skill];
    const effectiveStartXp = effectivePlannerStartXp(bounds.level, storedXp);
    const effectiveTargetLevel = effectivePlannerTarget(
      bounds.level,
      plannerState.targetLevels[skill],
      locked
    );
    const targetDisabled = locked || bounds.level === 99;
    const targetDescription =
      bounds.level === 99
        ? "Already at maximum target level 99."
        : locked
          ? `Locked at current level ${bounds.level}; saved target ${plannerState.targetLevels[skill]} is not used.`
          : `Next plan targets level ${effectiveTargetLevel}.`;
    return {
      skill,
      label: SKILL_LABEL[skill],
      currentLevel: bounds.level,
      currentXp: explicitXp ? storedXp : null,
      currentXpMode: auto ? "auto" : "explicit",
      currentXpMin: bounds.min,
      currentXpMax: bounds.max,
      effectiveStartXp,
      storedTargetLevel: plannerState.targetLevels[skill],
      effectiveTargetLevel,
      targetMin: bounds.level,
      targetDisabled,
      locked,
      xpDescription: auto
        ? `Next plan starts at ${formatNumber(effectiveStartXp)}, the level ${bounds.level} floor.`
        : `Next plan starts at the entered XP within level ${bounds.level}.`,
      targetDescription
    };
  });
}

export function plannerProgressAdjustmentNotice(
  adjustments: readonly PlannerProgressAdjustment[]
): string | null {
  if (adjustments.length === 0) return null;
  const changes = adjustments.slice(0, 3).map((adjustment) => {
    const label = SKILL_LABEL[adjustment.skill];
    return adjustment.field === "currentXp"
      ? `${label} XP uses Auto`
      : `${label} target is now ${adjustment.next}`;
  });
  const remaining = adjustments.length - changes.length;
  return `Planner inputs adjusted for current levels: ${changes.join("; ")}${remaining > 0 ? `; ${remaining} more` : ""}.`;
}

export function createPlannerDomainAdapter(
  form: CombatSetupFormState,
  context: SimulationContext,
  lootSettingsByMonster: LootSettingsByMonsterState = {},
  plannerUiState?: PlannerUiState
): PlannerDomainAdapterViewModel {
  const request = formToSimulationRequest(form, context.gameData);
  const lootSettings = lootSettingsForMonster(lootSettingsByMonster, request.monsterId);
  const trip = formToTripPolicy(form);
  const defaultPlannerPool = plannerAllowedPool(request.combatStyle, context);
  const state = cleanPlannerUiStateForPool(
    normalizePlannerUiState(plannerUiState ?? createDefaultPlannerUiState(form)),
    defaultPlannerPool
  );
  const pool = effectivePlannerGearPool(state, defaultPlannerPool);

  return {
    input: {
      request,
      trip: { ...trip, alching: lootSettings.highAlch ?? trip.alching },
      ringOfWealth: form.ringOfWealth,
      legendsComplete: true,
      jewelSpot: lootSettings.talismanSpot,
      overheadSec: lootSettings.overheadSec
    },
    options: {
      metric: state.metric,
      targets: plannerTargetsForState(form, state),
      startXp: plannerStartXpForState(form, state),
      pool,
      lockGear: state.onlyCurrentGear,
      sustained: state.averageOverSession,
      maxLevels: 120
    },
    state,
    defaultPool: defaultPlannerPool,
    pool
  };
}

export function createPlannerViewModel(
  form: CombatSetupFormState,
  context: SimulationContext,
  lootSettingsByMonster: LootSettingsByMonsterState = {},
  plannerUiState?: PlannerUiState
): PlannerPlan {
  const adapter = createPlannerDomainAdapter(form, context, lootSettingsByMonster, plannerUiState);
  return buildPlan(adapter.input, context, adapter.options);
}

function trainingOrderRow(phase: PlannerPhase, index: number): PlannerTrainingOrderRowViewModel {
  return {
    id: `${index}:${phase.skill}:${phase.from}-${phase.to}`,
    skill: phase.skill,
    skillLabel: SKILL_LABEL[phase.skill],
    from: phase.from,
    to: phase.to,
    xp: phase.xp,
    cumXp: phase.cumXp,
    startDps: phase.startDps,
    endDps: phase.endDps,
    startMetric: phase.startMetric,
    endMetric: phase.endMetric,
    unlockCount: phase.unlocks.length
  };
}

function plannerTransitionItemName(
  unlock: PlannerTransition,
  context: Pick<SimulationContext, "gameData"> | undefined,
  collisionIndex: EntityCollisionIndex | undefined
): string {
  if (!context || !collisionIndex) return unlock.name;
  return createEntityDisplayLabel({
    technicalId: unlock.itemId,
    gameDataName: context.gameData.items[unlock.itemId]?.name,
    rowSourceName: unlock.name,
    collisionIndex,
    entityKind: "item"
  }).name;
}

function unlockRow(
  unlock: PlannerTransition,
  index: number,
  context?: Pick<SimulationContext, "gameData">,
  collisionIndex?: EntityCollisionIndex
): PlannerUnlockRowViewModel {
  return {
    id: `${index}:${unlock.slot}:${unlock.itemId}:${unlock.level}`,
    itemName: plannerTransitionItemName(unlock, context, collisionIndex),
    slotLabel: SLOT_LABEL[unlock.slot],
    type: unlock.type,
    skillLabel: SKILL_LABEL[unlock.skill],
    level: unlock.level,
    reqSkillLabel: SKILL_LABEL[unlock.reqSkill],
    reqLevel: unlock.reqLevel,
    cumXp: unlock.cumXp,
    dpsBefore: unlock.dpsBefore,
    dpsAfter: unlock.dpsAfter
  };
}

function timelineEvent(
  unlock: PlannerTransition,
  index: number,
  context?: Pick<SimulationContext, "gameData">,
  collisionIndex?: EntityCollisionIndex
): PlannerTimelineEventViewModel {
  return {
    id: `${index}:${unlock.slot}:${unlock.itemId}:${unlock.cumXp}`,
    itemName: plannerTransitionItemName(unlock, context, collisionIndex),
    slotLabel: SLOT_LABEL[unlock.slot],
    type: unlock.type,
    skillLabel: SKILL_LABEL[unlock.skill],
    level: unlock.level,
    cumXp: unlock.cumXp,
    dpsDelta: unlock.dpsAfter - unlock.dpsBefore
  };
}

function createPlannerChartViewModel(plan: PlannerPlan): PlannerChartViewModel {
  const rawPoints = [
    {
      id: "start",
      label: "Start",
      cumXp: 0,
      dps: plan.start.dps
    },
    ...plan.steps.map((step, index) => ({
      id: `step-${index + 1}`,
      label: `${SKILL_LABEL[step.skill]} ${step.to}`,
      cumXp: step.cumXp,
      dps: step.dps
    }))
  ];
  const maxCumXp = Math.max(0, ...rawPoints.map((point) => point.cumXp));
  const minDps = Math.min(...rawPoints.map((point) => point.dps));
  const maxDps = Math.max(...rawPoints.map((point) => point.dps));
  const dpsRange = Math.max(0.000001, maxDps - minDps);
  const xpRange = Math.max(1, maxCumXp);

  return {
    points: rawPoints.map((point) => ({
      ...point,
      x: (point.cumXp / xpRange) * 100,
      y: 100 - ((point.dps - minDps) / dpsRange) * 100
    })),
    minDps,
    maxDps,
    maxCumXp,
    isEmpty: rawPoints.length < 2
  };
}

function plannerWarningIdentity(warning: SimulationWarning): string {
  return [
    warning.code,
    warning.severity,
    warning.itemId
      ? `item:${warning.itemId}`
      : `message:${normalizeWarningMessage(warning.message)}`,
    warning.priceContext?.consumer ?? "",
    warning.priceContext?.lootRowId ?? ""
  ].join("|");
}

function stableNoticeHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

interface IndexedPlannerWarning {
  identity: string;
  warning: SimulationWarning;
  order: number;
  occurrences: string[];
}

function indexPlannerWarnings(plan: PlannerPlan): IndexedPlannerWarning[] {
  const indexed = new Map<string, IndexedPlannerWarning>();
  let order = 0;

  const add = (warning: SimulationWarning, occurrence?: string): void => {
    const normalized: SimulationWarning = {
      ...warning,
      message: normalizeWarningMessage(warning.message)
    };
    const identity = plannerWarningIdentity(normalized);
    const existing = indexed.get(identity);
    if (existing) {
      if (occurrence && !existing.occurrences.includes(occurrence)) {
        existing.occurrences.push(occurrence);
      }
      if (
        normalized.priceContext?.affectsCurrentResult &&
        existing.warning.priceContext &&
        !existing.warning.priceContext.affectsCurrentResult
      ) {
        existing.warning = {
          ...existing.warning,
          priceContext: {
            ...existing.warning.priceContext,
            affectsCurrentResult: true
          }
        };
      }
      return;
    }
    indexed.set(identity, {
      identity,
      warning: normalized,
      order,
      occurrences: occurrence ? [occurrence] : []
    });
    order += 1;
  };

  for (const warning of plan.warnings) add(warning);
  for (const warning of plan.start.cfg.warnings) add(warning, "Plan start");
  for (const step of plan.steps) {
    const range = `${SKILL_LABEL[step.skill]} ${step.from}–${step.to}`;
    for (const warning of step.cfg.warnings) add(warning, `${range} result`);
    for (const warning of step.trainingCfg.warnings) {
      add(warning, `${range} training stance`);
    }
  }
  for (const entry of indexed.values()) {
    if (entry.occurrences.length === 0) entry.occurrences.push("Planner setup");
  }
  return [...indexed.values()];
}

function plannerNoticeDetail(warning: SimulationWarning, itemLabel: string | null): string {
  if (warning.code === "planner-truncated") {
    return "The displayed plan reached its calculation limit before every target was completed. Reduce or lock targets, then recompute.";
  }
  if (warning.code === "manual-planner-requirement-fallback") {
    return `${itemLabel ?? "This item"} uses the maintained fallback because generated requirement data is unavailable.`;
  }
  if (warning.code === "missing-planner-weapon") {
    return `${itemLabel ?? "This weapon"} is no longer available in the current game-data snapshot.`;
  }
  if (warning.code === "missing-planner-equipment") {
    return `${itemLabel ?? "This equipment"} is no longer available in the current game-data snapshot.`;
  }
  if (warning.code === "hypothetical-planner-equipment") {
    return `${itemLabel ?? "This equipment"} is marked hypothetical and is excluded from the current Planner pool.`;
  }
  if (warning.code === "dragon-halberd-npc-size-fallback") {
    return "The selected dragon-halberd path uses approximate target-size behavior. Review the current weapon without changing it automatically.";
  }
  if (isMoneyWarningCode(warning.code)) {
    return friendlyPriceWarningCopy(warning.code, itemLabel ?? "Price data").detail;
  }
  if (
    warning.code === "incoming-attack-partial-model" ||
    warning.code === "incoming-attack-compatibility-fallback"
  ) {
    return "Incoming damage uses incomplete source coverage. A food-per-kill override is optional and does not repair the source model.";
  }
  return normalizeWarningMessage(warning.message);
}

function plannerNoticeAction(input: {
  warning: SimulationWarning;
  editablePriceItemIds: ReadonlySet<string>;
}): PlannerNoticeAction {
  const { warning } = input;
  if (warning.code === "planner-truncated") {
    return { kind: "review-targets", label: "Review targets" };
  }
  if (
    warning.code === "manual-planner-requirement-fallback" ||
    warning.code === "missing-planner-weapon" ||
    warning.code === "missing-planner-equipment" ||
    warning.code === "hypothetical-planner-equipment"
  ) {
    return {
      kind: "review-gear",
      label: "Review gear",
      ...(warning.itemId ? { itemId: warning.itemId } : {})
    };
  }
  if (warning.code === "dragon-halberd-npc-size-fallback") {
    return { kind: "review-loadout", label: "Review loadout" };
  }
  if (isMoneyWarningCode(warning.code)) {
    if (
      isPriceIssueWarningCode(warning.code) &&
      warning.itemId &&
      input.editablePriceItemIds.has(warning.itemId)
    ) {
      return { kind: "correct-price", label: "Correct price", itemId: warning.itemId };
    }
    return {
      kind: "review-price-data",
      label: "Review price data",
      ...(warning.itemId ? { itemId: warning.itemId } : {})
    };
  }
  if (
    warning.code === "incoming-attack-partial-model" ||
    warning.code === "incoming-attack-compatibility-fallback"
  ) {
    return { kind: "review-trip", label: "Review Trip assumptions" };
  }
  return { kind: "review-planner-inputs", label: "Review Planner inputs" };
}

export function createPlannerNoticePresentation(
  plan: PlannerPlan,
  context?: Pick<SimulationContext, "gameData" | "priceSet">
): PlannerNoticePresentation {
  const indexed = indexPlannerWarnings(plan);
  const collisionIndex = context ? createEntityCollisionIndex(context.gameData) : undefined;
  if (plan.truncated) {
    indexed.unshift({
      identity: "planner-truncated|warning|synthetic",
      warning: {
        code: "planner-truncated",
        severity: "warning",
        message:
          "The displayed plan reached its calculation limit before every target was completed."
      },
      order: -1,
      occurrences: ["Planner setup"]
    });
  }
  const editablePriceItemIds = new Set(Object.keys(context?.priceSet.itemPrices ?? {}));
  const severityOrder = { error: 0, warning: 1, info: 2 } as const;
  indexed.sort(
    (left, right) =>
      severityOrder[left.warning.severity] - severityOrder[right.warning.severity] ||
      left.order - right.order ||
      left.identity.localeCompare(right.identity)
  );
  const rows = indexed.map((entry): PlannerNoticeViewModel => {
    const registry =
      PLANNER_NOTICE_CODE_REGISTRY[entry.warning.code as keyof typeof PLANNER_NOTICE_CODE_REGISTRY];
    const itemDisplayLabel = entry.warning.itemId
      ? createEntityDisplayLabel({
          technicalId: entry.warning.itemId,
          gameDataName: context?.gameData.items[entry.warning.itemId]?.name,
          collisionIndex,
          entityKind: "item"
        })
      : undefined;
    const priceCopy = isMoneyWarningCode(entry.warning.code)
      ? friendlyPriceWarningCopy(entry.warning.code, itemDisplayLabel?.name ?? "Price data")
      : null;
    const visibleLabels = entry.occurrences.slice(0, 3);
    return {
      id: `planner-notice-${entry.warning.code.replace(/[^a-z0-9-]+/gi, "-")}-${stableNoticeHash(entry.identity)}`,
      code: entry.warning.code,
      severity: entry.warning.severity,
      category: registry?.category ?? "other",
      title: priceCopy?.summary ?? registry?.title ?? "Planner notice",
      detail: plannerNoticeDetail(entry.warning, itemDisplayLabel?.name ?? null),
      ...(itemDisplayLabel ? { itemDisplayLabel } : {}),
      occurrences: {
        totalCount: entry.occurrences.length,
        visibleLabels,
        hiddenCount: Math.max(0, entry.occurrences.length - visibleLabels.length)
      },
      action: plannerNoticeAction({ warning: entry.warning, editablePriceItemIds }),
      affectsCurrentResult: entry.warning.priceContext?.affectsCurrentResult ?? true
    };
  });
  const issueCount = rows.filter((row) => row.severity !== "info").length;
  const noteCount = rows.length - issueCount;
  const occurrenceCount = rows.reduce((sum, row) => sum + row.occurrences.totalCount, 0);
  const warningSetIdentity = indexed.map((entry) => entry.identity).join("\n");
  return {
    warningSetId: rows.length
      ? `planner-warning-set-${rows.length}-${stableNoticeHash(warningSetIdentity)}`
      : "planner-warning-set-empty",
    issueCount,
    noteCount,
    occurrenceCount,
    rows
  };
}

export function createPlannerPanelViewModel(
  plan: PlannerPlan,
  context?: Pick<SimulationContext, "gameData" | "priceSet">
): PlannerPanelViewModel {
  const collisionIndex = context ? createEntityCollisionIndex(context.gameData) : undefined;
  const timeline = plan.unlocks.map((unlock, index) =>
    timelineEvent(unlock, index, context, collisionIndex)
  );
  return {
    summary: {
      totalXp: plan.totalXp,
      stepCount: plan.steps.length,
      phaseCount: plan.phases.length,
      unlockCount: plan.unlocks.length,
      startDps: plan.start.dps,
      endDps: plan.end?.dps ?? plan.start.dps,
      startMetric: plan.start.metricValue,
      endMetric: plan.end?.metricValue ?? plan.start.metricValue,
      truncated: plan.truncated
    },
    trainingOrder: plan.phases.map(trainingOrderRow),
    unlocks: plan.unlocks.map((unlock, index) => unlockRow(unlock, index, context, collisionIndex)),
    timeline,
    chart: createPlannerChartViewModel(plan),
    notices: createPlannerNoticePresentation(plan, context),
    isEmpty: plan.steps.length === 0
  };
}

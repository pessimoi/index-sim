import { simulateCombat, weaponStances } from "@/domain/combat";
import {
  PLANNER_REQUIREMENT_PROVENANCE,
  SKILL_LABEL,
  requirementForItem,
  type PlannerRequirementSource,
  type PlannerSkill,
  type SkillRequirements
} from "@/domain/planner";
import { EQUIPMENT_SLOTS } from "@/domain/shared";
import type {
  AttackType,
  BonusKey,
  CombatStyle,
  DataProvenance,
  EntityId,
  EquipmentBonuses,
  EquipmentItemDefinition,
  EquipmentSlot,
  GameDataSnapshot,
  GearSelection,
  PlayerLevels,
  SpecialAttackResult,
  SimulationContext,
  SimulationRequest,
  WeaponDefinition
} from "@/domain/shared";
import {
  applyWeaponSelection,
  formToSimulationRequest,
  normalizeFormState,
  type CombatSetupFormState,
  type SetupSelectionOption
} from "../state/ui-state";
import type { CalculationWarningViewModel, SelectOptionViewModel } from "./contracts";
import { formatNumber } from "./formatting";

export type SetupRequirementSkill = Extract<keyof SkillRequirements, PlannerSkill>;

export type SetupRequirementSlot = "weapon" | EquipmentSlot;

export interface SetupRequirementWarningViewModel extends CalculationWarningViewModel {
  itemId: EntityId;
  itemName: string;
  slot: SetupRequirementSlot;
  slotLabel: string;
  skill: SetupRequirementSkill;
  skillLabel: string;
  requiredLevel: number;
  currentLevel: number;
}

export interface SetupRequirementSummaryViewModel {
  warnings: SetupRequirementWarningViewModel[];
  warningCount: number;
  hasWarnings: boolean;
  policyLabel: string;
  source: PlannerRequirementSource;
  provenance: DataProvenance;
}

const OPTION_BONUS_KEYS: BonusKey[] = [
  "stabAtt",
  "slashAtt",
  "crushAtt",
  "rngAtt",
  "magAtt",
  "str",
  "rngStr",
  "magDmg",
  "prayer"
];

export interface GearQuickActionViewModel {
  itemId: EntityId;
  itemLabel: string;
  disabled: boolean;
  reason: string;
}

export type ManualCombatOverrideField = keyof CombatSetupFormState["manualOverrides"];

export function emptyGearSelectOptions(): Record<EquipmentSlot, SelectOptionViewModel[]> {
  const options = {} as Record<EquipmentSlot, SelectOptionViewModel[]>;
  for (const slot of EQUIPMENT_SLOTS) options[slot] = [];
  return options;
}

export interface LoadoutPaneViewModel {
  combatStyle: CombatStyle;
  weaponId: EntityId;
  ammoId: EntityId;
  spellId: EntityId;
  styleId: EntityId;
  weaponName: string;
  weaponUsesOwnAmmo: boolean;
  weaponTwoHanded: boolean;
  weaponOptions: SelectOptionViewModel[];
  ammoOptions: SelectOptionViewModel[];
  spellOptions: SelectOptionViewModel[];
  styleOptions: SelectOptionViewModel[];
  primaryPrayer: EntityId;
  primaryPrayerOptions: SelectOptionViewModel[];
  primaryBoost: EntityId;
  primaryBoostOptions: SelectOptionViewModel[];
  prayerOptions: readonly SetupSelectionOption[];
  boostOptions: readonly SetupSelectionOption[];
  prayerIds: EntityId[];
  boostIds: EntityId[];
  sustained: boolean;
  repotThreshold: number;
  respectRequirements: boolean;
  manualOverrides: CombatSetupFormState["manualOverrides"];
  activeManualOverrideCount: number;
  derivedAccuracyPlaceholder: string;
  derivedDamagePlaceholder: string;
  derivedSpeedPlaceholder: string;
  gear: CombatSetupFormState["gear"];
  gearOptions: Record<EquipmentSlot, SelectOptionViewModel[]>;
  gearQuickActions: Record<EquipmentSlot, GearQuickActionViewModel>;
  setupRequirements: SetupRequirementSummaryViewModel;
  loadoutBonuses: { totals: EquipmentBonuses } | null;
  specialStatus: string;
  selectedSpecialWeapon: EntityId;
  specialAttackOptions: SelectOptionViewModel[];
  specialAttackDisabled: boolean;
  specialAttackRequiresAmmo: boolean;
  selectedSpecialAmmo: EntityId;
  specialAmmoOptions: SelectOptionViewModel[];
  dbaSpecActive: boolean;
  specialAttack: SpecialAttackResult | null;
  specialWarnings: CalculationWarningViewModel[];
}

export interface LoadoutPaneActions {
  setWeapon: (weaponId: EntityId) => void;
  setAmmo: (ammoId: EntityId) => void;
  setSpell: (spellId: EntityId) => void;
  setStyle: (styleId: EntityId) => void;
  setPrimaryPrayer: (prayerId: EntityId) => void;
  setPrimaryBoost: (boostId: EntityId) => void;
  togglePrayer: (prayerId: EntityId, selected: boolean) => void;
  toggleBoost: (boostId: EntityId, selected: boolean) => void;
  setSustained: (sustained: boolean) => void;
  setRepotThreshold: (repotThreshold: number) => void;
  setRespectRequirements: (respect: boolean) => void;
  optimize: () => void;
  setManualOverride: (field: ManualCombatOverrideField, value: number | null) => void;
  resetManualOverrides: () => void;
  setGear: (slot: EquipmentSlot, itemId: EntityId) => void;
  setSpecialWeapon: (weaponId: EntityId) => void;
  setSpecialAmmo: (ammoId: EntityId) => void;
}

type DerivedLoadoutPaneField =
  | "weaponName"
  | "weaponUsesOwnAmmo"
  | "weaponTwoHanded"
  | "activeManualOverrideCount"
  | "derivedAccuracyPlaceholder"
  | "derivedDamagePlaceholder"
  | "derivedSpeedPlaceholder"
  | "specialStatus"
  | "selectedSpecialWeapon"
  | "specialAttackDisabled"
  | "selectedSpecialAmmo";

export type CreateLoadoutPaneViewModelInput = Omit<
  LoadoutPaneViewModel,
  DerivedLoadoutPaneField
> & {
  currentWeapon: WeaponDefinition | null;
  derivedCombat: {
    accuracyBonus: number;
    damageBonus: number;
    attackSpeedSec: number;
  };
  specialAttackSelection: CombatSetupFormState["specialAttack"];
  fallbackAmmoId: EntityId;
};

export function createLoadoutPaneViewModel(
  input: CreateLoadoutPaneViewModelInput
): LoadoutPaneViewModel {
  const { currentWeapon, derivedCombat, specialAttackSelection, fallbackAmmoId, ...model } = input;
  const selectedSpecialWeapon = model.specialAttackOptions.some(
    (option) => option.id === specialAttackSelection.weaponId
  )
    ? specialAttackSelection.weaponId
    : "none";
  const selectedSpecialAmmo =
    model.specialAmmoOptions.find((option) => option.id === specialAttackSelection.ammoId)?.id ??
    model.specialAmmoOptions.find((option) => option.id === fallbackAmmoId)?.id ??
    model.specialAmmoOptions.find((option) => option.id === "rune_arrow")?.id ??
    model.specialAmmoOptions[0]?.id ??
    "none";
  const specialAttackDisabled = model.combatStyle === "magic" || model.dbaSpecActive;
  const specialStatus =
    model.combatStyle === "magic"
      ? "unsupported"
      : model.dbaSpecActive
        ? "DBA boost"
        : (model.specialAttack?.weaponName ?? "off");
  const signedInteger = (value: number) => `${value > 0 ? "+" : ""}${formatNumber(value)}`;

  return {
    ...model,
    weaponName: currentWeapon?.name ?? "",
    weaponUsesOwnAmmo: currentWeapon?.sub === "thrown",
    weaponTwoHanded: currentWeapon?.twoHand === true,
    activeManualOverrideCount: Object.values(model.manualOverrides).filter((value) => value != null)
      .length,
    derivedAccuracyPlaceholder: signedInteger(derivedCombat.accuracyBonus),
    derivedDamagePlaceholder: signedInteger(derivedCombat.damageBonus),
    derivedSpeedPlaceholder: formatNumber(derivedCombat.attackSpeedSec, 1),
    specialStatus,
    selectedSpecialWeapon,
    specialAttackDisabled,
    selectedSpecialAmmo
  };
}

export interface GearQuickActionInput {
  gameData: GameDataSnapshot;
  slot: EquipmentSlot;
  combatStyle: CombatStyle;
  weaponId: EntityId;
  styleId: EntityId;
  currentItemId: EntityId;
  levels?: PlayerLevels;
  options: readonly SelectOptionViewModel[];
  shieldLocked?: boolean;
}

export interface BoundedLoadoutOptimizerInput {
  form: CombatSetupFormState;
  context: SimulationContext;
  weaponOptions: readonly SelectOptionViewModel[];
  gearOptions: Readonly<Record<EquipmentSlot, readonly SelectOptionViewModel[]>>;
  eligibilityPolicy?: LoadoutEligibilityPolicy;
  frontierLimit?: number;
}

export type LoadoutEligibilityPolicy = "respect-current-levels" | "ignore-requirements";

export interface BoundedLoadoutOptimizerResult {
  form: CombatSetupFormState;
  eligibilityPolicy: LoadoutEligibilityPolicy;
  excludedCandidateCount: number;
  baselineDps: number;
  optimizedDps: number;
  dpsDelta: number;
  dpsDeltaPct: number;
  changedFields: string[];
  evaluatedLoadouts: number;
  frontierPeak: number;
  capped: boolean;
}

interface LoadoutFrontierState {
  gear: GearSelection;
  accuracy: number;
  damage: number;
  changedSlots: number;
  signature: string;
}

const DEFAULT_LOADOUT_FRONTIER_LIMIT = 512;
const LOADOUT_DPS_EPSILON = 1e-12;

function meleeAttackBonusKey(attackType: AttackType): "stabAtt" | "slashAtt" | "crushAtt" {
  if (attackType === "stab") return "stabAtt";
  if (attackType === "crush") return "crushAtt";
  return "slashAtt";
}

function gearQuickActionScore(
  item: EquipmentItemDefinition,
  combatStyle: CombatStyle,
  attackType: AttackType
): number {
  if (combatStyle === "melee") {
    return (item[meleeAttackBonusKey(attackType)] ?? 0) + (item.str ?? 0) * 2;
  }
  if (combatStyle === "ranged") {
    return (item.rngAtt ?? 0) + (item.rngStr ?? 0) * 2;
  }
  return (item.magAtt ?? 0) + (item.magDmg ?? 0) * 2;
}

function gearQuickActionRequirementReason(
  input: GearQuickActionInput,
  item: { id: EntityId; label: string }
): string | null {
  if (!input.levels) return null;
  const warning = createSetupRequirementWarnings(
    {
      slot: input.slot,
      itemId: item.id,
      itemName: item.label
    },
    input.gameData,
    input.levels
  )[0];
  if (!warning) return null;
  return `requires ${warning.skillLabel} ${formatNumber(warning.requiredLevel)}, current ${formatNumber(warning.currentLevel)}`;
}

export function gearQuickActionForSlot(input: GearQuickActionInput): GearQuickActionViewModel {
  if (input.shieldLocked) {
    return {
      itemId: "none",
      itemLabel: "None",
      disabled: true,
      reason: "Shield locked by two-handed weapon"
    };
  }

  const activeStance = weaponStances(input.weaponId, input.gameData).find(
    (stance) => stance.id === input.styleId
  );
  const attackType = input.combatStyle === "melee" ? (activeStance?.type ?? "slash") : "slash";
  const candidates = input.options.flatMap((option) => {
    const item =
      option.id === "none" ? { name: "None" } : input.gameData.equipment[input.slot]?.[option.id];
    if (!item) return [];
    return [
      {
        id: option.id,
        label: option.label,
        score: gearQuickActionScore(item, input.combatStyle, attackType)
      }
    ];
  });
  const current = candidates.find((candidate) => candidate.id === input.currentItemId);
  const best = candidates.reduce<(typeof candidates)[number] | null>((selected, candidate) => {
    if (!selected) return candidate;
    if (candidate.score > selected.score) return candidate;
    if (candidate.score < selected.score) return selected;
    if (candidate.id === input.currentItemId) return candidate;
    if (selected.id === input.currentItemId) return selected;
    const labelCompare = candidate.label.localeCompare(selected.label);
    if (labelCompare < 0) return candidate;
    if (labelCompare > 0) return selected;
    return candidate.id.localeCompare(selected.id) < 0 ? candidate : selected;
  }, null);

  if (!best) {
    return {
      itemId: input.currentItemId,
      itemLabel: "None",
      disabled: true,
      reason: "No visible gear options"
    };
  }

  const currentIsBest = best.id === input.currentItemId;
  const baseReason = currentIsBest
    ? `Best visible option: ${current?.label ?? best.label}`
    : `Apply ${best.label}`;
  const requirementReason = gearQuickActionRequirementReason(input, best);
  return {
    itemId: best.id,
    itemLabel: best.label,
    disabled: currentIsBest,
    reason: requirementReason ? `${baseReason} - ${requirementReason}` : baseReason
  };
}

function loadoutBonusPair(
  item: EquipmentItemDefinition,
  combatStyle: CombatStyle,
  attackType: AttackType
): { accuracy: number; damage: number } {
  if (combatStyle === "melee") {
    return {
      accuracy: item[meleeAttackBonusKey(attackType)] ?? 0,
      damage: item.str ?? 0
    };
  }
  if (combatStyle === "ranged") {
    return { accuracy: item.rngAtt ?? 0, damage: item.rngStr ?? 0 };
  }
  return { accuracy: item.magAtt ?? 0, damage: item.magDmg ?? 0 };
}

function loadoutGearSignature(gear: GearSelection): string {
  return EQUIPMENT_SLOTS.map((slot) => `${slot}:${gear[slot] ?? "none"}`).join("|");
}

function preferFrontierState(
  left: LoadoutFrontierState,
  right: LoadoutFrontierState
): LoadoutFrontierState {
  if (left.changedSlots !== right.changedSlots) {
    return left.changedSlots < right.changedSlots ? left : right;
  }
  return left.signature.localeCompare(right.signature) <= 0 ? left : right;
}

function paretoFrontier(states: LoadoutFrontierState[]): LoadoutFrontierState[] {
  const equalPairs = new Map<string, LoadoutFrontierState>();
  for (const state of states) {
    const key = `${state.accuracy}|${state.damage}`;
    const current = equalPairs.get(key);
    equalPairs.set(key, current ? preferFrontierState(current, state) : state);
  }
  const sorted = [...equalPairs.values()].sort(
    (left, right) =>
      right.accuracy - left.accuracy ||
      right.damage - left.damage ||
      left.changedSlots - right.changedSlots ||
      left.signature.localeCompare(right.signature)
  );
  const frontier: LoadoutFrontierState[] = [];
  let bestDamage = -Infinity;
  for (const state of sorted) {
    if (state.damage <= bestDamage) continue;
    frontier.push(state);
    bestDamage = state.damage;
  }
  return frontier;
}

function sampleFrontier(states: LoadoutFrontierState[], limit: number): LoadoutFrontierState[] {
  if (states.length <= limit) return states;
  if (limit <= 1) {
    return [
      [...states].sort(
        (left, right) =>
          right.accuracy + right.damage * 2 - (left.accuracy + left.damage * 2) ||
          left.changedSlots - right.changedSlots ||
          left.signature.localeCompare(right.signature)
      )[0]
    ];
  }
  const sampled = new Map<number, LoadoutFrontierState>();
  for (let index = 0; index < limit; index += 1) {
    const sourceIndex = Math.round((index * (states.length - 1)) / (limit - 1));
    sampled.set(sourceIndex, states[sourceIndex]);
  }
  return [...sampled.entries()].sort(([left], [right]) => left - right).map(([, state]) => state);
}

function visibleEquipmentCandidates(
  gameData: GameDataSnapshot,
  slot: EquipmentSlot,
  options: readonly SelectOptionViewModel[],
  forceNone: boolean
): Array<{ id: EntityId; item: EquipmentItemDefinition }> {
  if (forceNone) return [{ id: "none", item: { name: "None" } }];
  return options.flatMap((option) => {
    if (option.id === "none") return [{ id: option.id, item: { name: "None" } }];
    const item = gameData.equipment[slot]?.[option.id];
    return item ? [{ id: option.id, item }] : [];
  });
}

function buildLoadoutFrontier(input: {
  form: CombatSetupFormState;
  original: CombatSetupFormState;
  gameData: GameDataSnapshot;
  gearOptions: Readonly<Record<EquipmentSlot, readonly SelectOptionViewModel[]>>;
  frontierLimit: number;
}): { states: LoadoutFrontierState[]; peak: number; capped: boolean } {
  const weapon = input.gameData.weapons[input.form.weaponId];
  const activeStance = weaponStances(input.form.weaponId, input.gameData).find(
    (stance) => stance.id === input.form.styleId
  );
  const attackType = input.form.combatStyle === "melee" ? (activeStance?.type ?? "slash") : "slash";
  let states: LoadoutFrontierState[] = [
    { gear: {}, accuracy: 0, damage: 0, changedSlots: 0, signature: "" }
  ];
  let peak = 1;
  let capped = false;

  for (const slot of EQUIPMENT_SLOTS) {
    const candidates = visibleEquipmentCandidates(
      input.gameData,
      slot,
      input.gearOptions[slot],
      slot === "shield" && weapon?.twoHand === true
    );
    if (!candidates.length) continue;
    const expanded = states.flatMap((state) =>
      candidates.map((candidate) => {
        const gear = { ...state.gear, [slot]: candidate.id };
        const pair = loadoutBonusPair(candidate.item, input.form.combatStyle, attackType);
        return {
          gear,
          accuracy: state.accuracy + pair.accuracy,
          damage: state.damage + pair.damage,
          changedSlots:
            state.changedSlots + (candidate.id === (input.original.gear[slot] ?? "none") ? 0 : 1),
          signature: loadoutGearSignature(gear)
        };
      })
    );
    const frontier = paretoFrontier(expanded);
    peak = Math.max(peak, frontier.length);
    if (frontier.length > input.frontierLimit) capped = true;
    states = sampleFrontier(frontier, input.frontierLimit);
  }
  return { states, peak, capped };
}

function changedLoadoutFields(
  original: CombatSetupFormState,
  candidate: CombatSetupFormState
): string[] {
  const changed = [
    original.weaponId === candidate.weaponId ? null : "weapon",
    original.ammoId === candidate.ammoId ? null : "ammo",
    original.styleId === candidate.styleId ? null : "style",
    ...EQUIPMENT_SLOTS.map((slot) =>
      (original.gear[slot] ?? "none") === (candidate.gear[slot] ?? "none") ? null : slot
    )
  ];
  return changed.filter((field): field is string => field !== null);
}

function loadoutFormSignature(form: CombatSetupFormState): string {
  return [form.weaponId, form.ammoId, form.styleId, loadoutGearSignature(form.gear)].join("|");
}

function loadoutCandidateMeetsCurrentLevels(input: {
  itemId: EntityId;
  gameData: GameDataSnapshot;
  levels: PlayerLevels;
}): boolean {
  return unmetSetupRequirements(input.itemId, input.gameData, input.levels).length === 0;
}

export function optimizeVisibleLoadout(
  input: BoundedLoadoutOptimizerInput
): BoundedLoadoutOptimizerResult {
  const original = normalizeFormState(input.form);
  const eligibilityPolicy = input.eligibilityPolicy ?? "respect-current-levels";
  let excludedCandidateCount = 0;
  const filterOptions = (
    options: readonly SelectOptionViewModel[]
  ): readonly SelectOptionViewModel[] => {
    if (eligibilityPolicy === "ignore-requirements") return options;
    return options.filter((option) => {
      const eligible = loadoutCandidateMeetsCurrentLevels({
        itemId: option.id,
        gameData: input.context.gameData,
        levels: original.levels
      });
      if (!eligible) excludedCandidateCount += 1;
      return eligible;
    });
  };
  const eligibleWeaponOptions = filterOptions(input.weaponOptions);
  const eligibleGearOptions = Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot, filterOptions(input.gearOptions[slot])])
  ) as Record<EquipmentSlot, readonly SelectOptionViewModel[]>;
  const requestedFrontierLimit =
    input.frontierLimit == null || !Number.isFinite(input.frontierLimit)
      ? DEFAULT_LOADOUT_FRONTIER_LIMIT
      : input.frontierLimit;
  const frontierLimit = Math.max(
    1,
    Math.min(DEFAULT_LOADOUT_FRONTIER_LIMIT, Math.floor(requestedFrontierLimit))
  );
  const baseline = simulateCombat(
    formToSimulationRequest(original, input.context.gameData),
    input.context
  );
  let evaluatedLoadouts = 1;
  let frontierPeak = 1;
  let capped = false;
  let bestForm = original;
  let bestDps = Number.isFinite(baseline.dps) ? baseline.dps : 0;
  let bestChangedFields: string[] = [];
  let bestSignature = loadoutFormSignature(original);

  const weaponCandidates = eligibleWeaponOptions.flatMap((option) => {
    const weapon = input.context.gameData.weapons[option.id];
    return weapon?.type === original.combatStyle ? [option.id] : [];
  });
  for (const weaponId of weaponCandidates) {
    const weaponForm = applyWeaponSelection(original, weaponId, input.context.gameData);
    const frontier = buildLoadoutFrontier({
      form: weaponForm,
      original,
      gameData: input.context.gameData,
      gearOptions: eligibleGearOptions,
      frontierLimit
    });
    frontierPeak = Math.max(frontierPeak, frontier.peak);
    capped ||= frontier.capped;
    for (const state of frontier.states) {
      const candidate = normalizeFormState({ ...weaponForm, gear: state.gear });
      let dps: number;
      try {
        dps = simulateCombat(
          formToSimulationRequest(candidate, input.context.gameData),
          input.context
        ).dps;
      } catch {
        continue;
      }
      evaluatedLoadouts += 1;
      if (!Number.isFinite(dps)) continue;
      const changedFields = changedLoadoutFields(original, candidate);
      const signature = loadoutFormSignature(candidate);
      const improves = dps > bestDps + LOADOUT_DPS_EPSILON;
      const ties = Math.abs(dps - bestDps) <= LOADOUT_DPS_EPSILON;
      const winsTie =
        ties &&
        (changedFields.length < bestChangedFields.length ||
          (changedFields.length === bestChangedFields.length &&
            signature.localeCompare(bestSignature) < 0));
      if (!improves && !winsTie) continue;
      bestForm = candidate;
      bestDps = dps;
      bestChangedFields = changedFields;
      bestSignature = signature;
    }
  }

  const optimizedDps = Math.max(bestDps, Number.isFinite(baseline.dps) ? baseline.dps : 0);
  const dpsDelta = optimizedDps - (Number.isFinite(baseline.dps) ? baseline.dps : 0);
  return {
    form: dpsDelta < -LOADOUT_DPS_EPSILON ? original : bestForm,
    eligibilityPolicy,
    excludedCandidateCount,
    baselineDps: Number.isFinite(baseline.dps) ? baseline.dps : 0,
    optimizedDps,
    dpsDelta: Math.max(0, dpsDelta),
    dpsDeltaPct: baseline.dps > 0 ? (Math.max(0, dpsDelta) / baseline.dps) * 100 : 0,
    changedFields: dpsDelta < -LOADOUT_DPS_EPSILON ? [] : bestChangedFields,
    evaluatedLoadouts,
    frontierPeak,
    capped
  };
}

const SETUP_REQUIREMENT_SKILLS = [
  "attack",
  "strength",
  "defence",
  "ranged",
  "magic"
] as const satisfies readonly SetupRequirementSkill[];

export const SETUP_REQUIREMENT_SLOT_LABELS: Record<SetupRequirementSlot, string> = {
  weapon: "Weapon",
  helm: "Helm",
  amulet: "Amulet",
  body: "Body",
  legs: "Legs",
  shield: "Shield",
  gloves: "Gloves",
  boots: "Boots",
  cape: "Cape",
  ring: "Ring"
};

function setupRequirementItemName(
  context: SimulationContext,
  slot: SetupRequirementSlot,
  itemId: EntityId
): string {
  if (slot === "weapon") return context.gameData.weapons[itemId]?.name ?? itemId;
  return context.gameData.equipment[slot]?.[itemId]?.name ?? itemId;
}

interface UnmetSetupRequirement {
  skill: SetupRequirementSkill;
  skillLabel: string;
  requiredLevel: number;
  currentLevel: number;
}

function unmetSetupRequirements(
  itemId: EntityId,
  gameData: GameDataSnapshot,
  levels: PlayerLevels
): UnmetSetupRequirement[] {
  if (itemId === "none") return [];
  const requirement = requirementForItem(gameData, itemId).requirements;
  return SETUP_REQUIREMENT_SKILLS.flatMap((skill) => {
    const requiredLevel = requirement[skill] ?? 0;
    const currentLevel = levels[skill];
    if (requiredLevel <= 0 || currentLevel >= requiredLevel) return [];
    return [{ skill, skillLabel: SKILL_LABEL[skill], requiredLevel, currentLevel }];
  });
}

function createSetupRequirementWarnings(
  item: {
    slot: SetupRequirementSlot;
    itemId: EntityId;
    itemName: string;
  },
  gameData: GameDataSnapshot,
  levels: PlayerLevels
): SetupRequirementWarningViewModel[] {
  return unmetSetupRequirements(item.itemId, gameData, levels).map((requirement) => ({
    code: "setup-requirement-unmet",
    severity: "warning",
    message: `${item.itemName} requires ${requirement.skillLabel} ${formatNumber(requirement.requiredLevel)}; current ${requirement.skillLabel} ${formatNumber(requirement.currentLevel)}.`,
    itemId: item.itemId,
    itemName: item.itemName,
    slot: item.slot,
    slotLabel: SETUP_REQUIREMENT_SLOT_LABELS[item.slot],
    ...requirement
  }));
}

function requirementPolicyForLookups(
  lookups: ReturnType<typeof requirementForItem>[],
  context: SimulationContext
): { policyLabel: string; source: PlannerRequirementSource; provenance: DataProvenance } {
  if (lookups.some((lookup) => lookup.source === "manual-fallback")) {
    return {
      policyLabel: "Manual requirement fallback",
      source: "manual-fallback",
      provenance: PLANNER_REQUIREMENT_PROVENANCE
    };
  }
  const generated = lookups.find((lookup) => lookup.source === "generated");
  if (!generated) {
    return {
      policyLabel: "No item requirements",
      source: "none",
      provenance: context.gameData.provenance ?? PLANNER_REQUIREMENT_PROVENANCE
    };
  }
  return {
    policyLabel: "Generated requirement data",
    source: "generated",
    provenance:
      generated.provenance ?? context.gameData.provenance ?? PLANNER_REQUIREMENT_PROVENANCE
  };
}

export function createSetupRequirementSummaryViewModel(
  request: SimulationRequest,
  context: SimulationContext
): SetupRequirementSummaryViewModel {
  const items = [
    {
      slot: "weapon" as const,
      itemId: request.loadout.weaponId,
      itemName: setupRequirementItemName(context, "weapon", request.loadout.weaponId)
    },
    ...EQUIPMENT_SLOTS.map((slot) => {
      const itemId = request.loadout.gear[slot] ?? "none";
      return {
        slot,
        itemId,
        itemName: setupRequirementItemName(context, slot, itemId)
      };
    })
  ];
  const lookups = items
    .filter((item) => item.itemId !== "none")
    .map((item) => requirementForItem(context.gameData, item.itemId));
  const policy = requirementPolicyForLookups(lookups, context);
  const warnings = items.flatMap((item) =>
    createSetupRequirementWarnings(item, context.gameData, request.levels)
  );
  return {
    warnings,
    warningCount: warnings.length,
    hasWarnings: warnings.length > 0,
    policyLabel: policy.policyLabel,
    source: policy.source,
    provenance: policy.provenance
  };
}

export function signedBonus(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}

function equipmentHint(item: EquipmentItemDefinition): string | undefined {
  const bonuses = OPTION_BONUS_KEYS.flatMap((key) => {
    const value = item[key] ?? 0;
    return value === 0 ? [] : `${key} ${signedBonus(value)}`;
  });
  if (item.note) bonuses.push(item.note);
  return bonuses.slice(0, 4).join(", ") || undefined;
}

export function weaponOptions(
  gameData: GameDataSnapshot,
  combatStyle: CombatStyle
): SelectOptionViewModel[] {
  return Object.entries(gameData.weapons)
    .filter(([, weapon]) => weapon.type === combatStyle)
    .map(([id, weapon]) => ({
      id,
      label: weapon.name,
      hint: [
        `speed ${weapon.speed}`,
        weapon.twoHand ? "2h" : null,
        weapon.sub ?? weapon.wclass ?? null,
        combatStyle === "melee"
          ? `acc ${weapon.accBonus}, str ${weapon.dmgBonus}`
          : combatStyle === "ranged"
            ? `rng ${weapon.accBonus}`
            : `magic ${weapon.accBonus}`
      ]
        .filter(Boolean)
        .join(", ")
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function ammoOptions(
  gameData: GameDataSnapshot,
  kind?: GameDataSnapshot["ammo"][string]["kind"]
): SelectOptionViewModel[] {
  return [
    { id: "none", label: "None" },
    ...Object.entries(gameData.ammo)
      .filter(([, ammo]) => !kind || ammo.kind === kind)
      .map(([id, ammo]) => ({
        id,
        label: ammo.name,
        hint: [ammo.kind, `range ${signedBonus(ammo.rangeBonus)}`].filter(Boolean).join(", ")
      }))
      .sort((left, right) => left.label.localeCompare(right.label))
  ];
}

export function spellOptions(gameData: GameDataSnapshot): SelectOptionViewModel[] {
  return Object.entries(gameData.spells)
    .map(([id, spell]) => ({
      id,
      label: spell.name,
      hint: [
        spell.lvl == null ? null : `lvl ${spell.lvl}`,
        `base ${spell.base}`,
        spell.god ? "god" : null
      ]
        .filter(Boolean)
        .join(", ")
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function equipmentSlotOptions(
  gameData: GameDataSnapshot,
  slot: EquipmentSlot
): SelectOptionViewModel[] {
  return Object.entries(gameData.equipment[slot] ?? {})
    .map(([id, item]) => ({
      id,
      label: item.name,
      hint: equipmentHint(item)
    }))
    .sort((left, right) => {
      if (left.id === "none") return -1;
      if (right.id === "none") return 1;
      return left.label.localeCompare(right.label);
    });
}

export function styleOptions(
  gameData: GameDataSnapshot,
  combatStyle: CombatStyle,
  weaponId: EntityId
) {
  if (combatStyle === "melee") {
    return weaponStances(weaponId, gameData).map((stance) => ({
      id: stance.id,
      label: `${stance.name} (${stance.style}/${stance.type})`
    }));
  }
  if (combatStyle === "ranged") {
    return [
      { id: "accurate", label: "Accurate" },
      { id: "rapid", label: "Rapid" },
      { id: "longrange", label: "Longrange" }
    ];
  }
  return [
    { id: "accurate", label: "Standard cast" },
    { id: "defensive", label: "Defensive casting" },
    { id: "longrange", label: "Longrange" }
  ];
}

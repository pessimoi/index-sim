import {
  createHitDistribution,
  simulateCombat,
  weaponStances,
  type CombatXpKey
} from "@/domain/combat";
import {
  buildPlan,
  defaultPool,
  requirementForItem,
  SKILL_LABEL,
  SLOT_LABEL,
  PLANNER_REQUIREMENT_PROVENANCE,
  reqOf,
  type PlannerInput,
  type PlannerOptions,
  type PlannerPhase,
  type PlannerGearSlot,
  type PlannerPlan,
  type PlannerPool,
  type PlannerRequirementSource,
  type SkillRequirements,
  type PlannerSkill,
  type PlannerTransition
} from "@/domain/planner";
import type {
  AttackType,
  BonusKey,
  CombatStyle,
  DataProvenance,
  EquipmentItemDefinition,
  EquipmentSlot,
  EntityId,
  GameDataSnapshot,
  PlayerLevels,
  SimulationContext,
  SimulationRequest,
  SimulationWarning
} from "@/domain/shared";
import { EQUIPMENT_SLOTS } from "@/domain/shared";
import {
  FOOD,
  HIGH_ALCH_MAGIC_XP_PER_CAST,
  simulateTripLootSupply,
  type LootAction,
  type LootBreakdownEntry,
  type TripLootSupplyInput,
  type TripLootSupplyResult
} from "@/domain/trip";
import {
  simulateFullSimulation,
  type FullSimulationInput,
  type FullSimulationResult
} from "@/domain/simulation";
import {
  DEFAULT_DENSE_COMPARE_SORT_STATE,
  normalizeDenseCompareUiState,
  normalizeDenseCompareSortState,
  type DenseCompareSortKey,
  type DenseCompareSortState,
  type DenseCompareUiState
} from "../state/dense-compare";
import {
  MAX_DUEL_SNAPSHOTS,
  normalizeDuelSnapshotsState,
  type DuelSnapshotsState
} from "../state/duel-snapshots";
import { lootSettingsForMonster, type LootSettingsByMonsterState } from "../state/loot-settings";
import {
  PLANNER_GEAR_SLOTS,
  PLANNER_SKILLS,
  cleanPlannerUiStateForPool,
  createDefaultPlannerUiState,
  effectivePlannerGearPool,
  normalizePlannerUiState,
  type PlannerUiState
} from "../state/planner";
import {
  BOOST_SELECTION_OPTIONS,
  type CannonByMonsterState,
  DEFAULT_FORM_STATE,
  PRAYER_SELECTION_OPTIONS,
  formToSimulationRequest,
  formToTripPolicy,
  normalizeFormState,
  type CombatSetupFormState,
  type CustomSetupsByMonsterState,
  type SetupMode
} from "../state/ui-state";

export interface SimulationViewModel {
  request: SimulationRequest;
  result: FullSimulationResult;
  combat: ReturnType<typeof simulateCombat>;
  hitDistribution: HitDistributionViewModel;
  combatRollDetail: StatsCombatRollDetailViewModel;
  xpRouting: XpRoutingViewModel;
  tripBankingSummary: StatsTripBankingSummaryViewModel;
  statsSourceBreakdown: StatsSourceBreakdownViewModel;
  setupRequirements: SetupRequirementSummaryViewModel;
  activeAssumptions: ActiveAssumptionsSummaryViewModel;
  monsterCard: MonsterCardViewModel;
  trip: TripLootSupplyResult;
  playerEffectiveXpPerHour: number;
  cannonEffectiveXpPerHour: number;
  effectiveXpPerHour: number;
  totalXpPerHour: number;
  warnings: string[];
  calculationWarnings: CalculationWarningViewModel[];
  specialWarnings: CalculationWarningViewModel[];
  moneyWarnings: CalculationWarningViewModel[];
  topLoot: Array<{
    name: string;
    pref: string;
    evGp: number;
    price: number;
    prayerXp: number;
  }>;
  lootRows: LootDropRowViewModel[];
  lootSummary: {
    defaultEffectiveNetGpPerHour: number;
    currentDeltaNetGpPerHour: number;
    overrideCount: number;
    valueComposition: LootValueCompositionViewModel;
  };
}

export interface HitDistributionBucketViewModel {
  id: string;
  label: string;
  ariaLabel: string;
  probability: number;
  percentLabel: string;
  widthPercent: number;
  isMiss: boolean;
  isMaxHit: boolean;
}

export interface HitDistributionViewModel {
  hitChance: number;
  averageHit: number;
  maxHit: number;
  peakMaxHit: number;
  probabilityTotal: number;
  hitChanceLabel: string;
  averageHitLabel: string;
  maxHitLabel: string;
  buckets: HitDistributionBucketViewModel[];
}

export interface StatsCombatRollMetricViewModel {
  id: string;
  label: string;
  value: string;
  numericValue: number | null;
  note: string;
  tone: "default" | "teal" | "gold" | "muted";
}

export interface StatsCombatRollDetailViewModel {
  status: "modeled" | "partial";
  statusLabel: string;
  metrics: StatsCombatRollMetricViewModel[];
  notes: string[];
}

export type XpRoutingRowStatus = "modeled" | "partial" | "not-modeled";

export interface XpRoutingRowViewModel {
  id: string;
  label: string;
  value: string;
  xpPerHour: number | null;
  status: XpRoutingRowStatus;
  statusLabel: string;
  note: string;
}

export interface XpRoutingViewModel {
  effectiveXpPerHour: number;
  totalXpPerHour: number;
  effectiveXpPerHourLabel: string;
  totalXpPerHourLabel: string;
  rows: XpRoutingRowViewModel[];
}

export interface StatsTripBankingSummaryRowViewModel {
  id: string;
  label: string;
  value: string;
  numericValue: number | null;
  note: string;
  tone: "default" | "gold" | "teal" | "muted";
}

export interface StatsTripBankingSummaryViewModel {
  rows: StatsTripBankingSummaryRowViewModel[];
}

export type StatsSourceBreakdownStatus = "modeled" | "partial" | "not-modeled" | "inactive";

export type StatsSourceBreakdownRowId = "normal-attack" | "special-attack" | "cannon";

export interface StatsSourceBreakdownRowViewModel {
  id: StatsSourceBreakdownRowId;
  label: string;
  status: StatsSourceBreakdownStatus;
  statusLabel: string;
  dps: number | null;
  dpsLabel: string;
  dpsDetail: string | null;
  dpsGainPct: number | null;
  xpPerHour: number | null;
  xpPerHourLabel: string;
  hitChance: number | null;
  hitChanceLabel: string;
  maxHit: number | null;
  maxHitLabel: string;
  supplyCostPerHour: number | null;
  supplyCostPerHourLabel: string;
  supplyCostPerKill: number | null;
  supplyCostPerKillLabel: string;
  notes: string[];
}

export interface StatsSourceDetailMetricViewModel {
  id: string;
  label: string;
  value: string;
  numericValue: number | null;
}

export interface StatsSourceDetailViewModel {
  id: StatsSourceBreakdownRowId;
  label: string;
  status: StatsSourceBreakdownStatus;
  statusLabel: string;
  metrics: StatsSourceDetailMetricViewModel[];
  notes: string[];
  warnings: CalculationWarningViewModel[];
  histogram: HitDistributionViewModel | null;
  histogramScopeLabel: string | null;
}

export interface StatsSourceBreakdownViewModel {
  rows: StatsSourceBreakdownRowViewModel[];
  details: StatsSourceDetailViewModel[];
}

export type ActiveAssumptionCategory = "warning" | "setup" | "loot" | "trip" | "settings";

export type ActiveAssumptionReviewTarget =
  | "stats"
  | "melee"
  | "ranged"
  | "magic"
  | "compare"
  | "loot"
  | "trip"
  | "cannon"
  | "economy"
  | "settings";

export type ActiveAssumptionResetTarget =
  | "manual-combat-overrides"
  | "cannon-enabled"
  | "loot-settings"
  | "loot-action-overrides"
  | "scarce-spot"
  | "explicit-safespot"
  | "hidden-gear-tiers";

export interface ActiveAssumptionResetActionViewModel {
  target: ActiveAssumptionResetTarget;
  label: string;
  ariaLabel: string;
  statusLabel: string;
}

export interface ActiveAssumptionRowViewModel {
  id: string;
  category: ActiveAssumptionCategory;
  label: string;
  value: string;
  detail: string;
  reviewTab: ActiveAssumptionReviewTarget;
  tone: "default" | "info" | "warning";
  priority: number;
  resetAction?: ActiveAssumptionResetActionViewModel;
}

export interface ActiveAssumptionsSummaryViewModel {
  statusLabel: string;
  totalCount: number;
  hasActiveRows: boolean;
  visibleRows: ActiveAssumptionRowViewModel[];
  hiddenRows: ActiveAssumptionRowViewModel[];
  hiddenCount: number;
}

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

export type MonsterCardStatKey =
  "combat" | "hitpoints" | "attack" | "strength" | "defence" | "magic" | "attackSpeed";

export interface MonsterCardStatViewModel {
  key: MonsterCardStatKey;
  label: string;
  value: number | null;
  missing: boolean;
}

export type MonsterCardDefenceKey = "stab" | "slash" | "crush" | "range" | "magic";
export type MonsterCardDefenceField = "defStab" | "defSlash" | "defCrush" | "defRange" | "defMagic";

export interface MonsterCardDefenceRowViewModel {
  key: MonsterCardDefenceKey;
  label: string;
  field: MonsterCardDefenceField;
  value: number | null;
  active: boolean;
  missing: boolean;
}

export interface MonsterCardSetupBadgeViewModel {
  mode: SetupMode;
  label: string;
  tone: "default" | "custom";
  hasCustomSetup: boolean;
}

export interface MonsterCardNamedSelectionViewModel {
  id: EntityId;
  label: string;
}

export interface MonsterCardSetupOverviewViewModel {
  combatStyle: CombatStyle;
  styleId: EntityId;
  styleLabel: string;
  attackType: AttackType | "ranged" | "magic" | null;
  weapon: MonsterCardNamedSelectionViewModel;
  ammo: MonsterCardNamedSelectionViewModel | null;
  spell: MonsterCardNamedSelectionViewModel | null;
  accuracyBonus: number;
  damageBonus: number;
  attackSpeedSec: number;
  prayerIds: EntityId[];
  boostIds: EntityId[];
  sustained: boolean;
  ring: MonsterCardNamedSelectionViewModel | null;
  summary: string[];
}

export interface MonsterCardViewModel {
  monsterId: EntityId;
  monsterName: string;
  stats: MonsterCardStatViewModel[];
  defenceRows: MonsterCardDefenceRowViewModel[];
  activeDefenceField: MonsterCardDefenceField | null;
  activeDefenceKey: MonsterCardDefenceKey | null;
  setupBadge: MonsterCardSetupBadgeViewModel;
  setupOverview: MonsterCardSetupOverviewViewModel;
}

export interface MonsterCardViewModelOptions {
  setupMode?: SetupMode;
  hasCustomSetup?: boolean;
}

export interface SimulationViewModelOptions {
  includeLootRows?: boolean;
  monsterCard?: MonsterCardViewModelOptions;
  lootPriceHistoryByItem?: Record<string, LootPriceHistoryItemContext | undefined>;
  activeAssumptions?: {
    setupMode?: SetupMode;
    hasCustomSetup?: boolean;
    hiddenGearTierCount?: number;
  };
}

export interface CalculationWarningViewModel {
  code: string;
  severity: SimulationWarning["severity"];
  message: string;
}

export interface LootActionImpactViewModel {
  action: LootAction;
  label: string;
  effectiveNetGpPerHour: number;
  deltaNetGpPerHour: number;
  gpPerKillContribution: number;
  isSelected: boolean;
  isDefault: boolean;
  stateLabel: string | null;
  notes: string[];
}

export interface LootValueCompositionRowViewModel {
  rowId: string | null;
  name: string;
  action: LootAction | null;
  actionLabel: string;
  gpPerKill: number;
  shareOfPositivePct: number | null;
  stateLabel: string | null;
  childCount: number;
  isOther: boolean;
}

export interface LootValueCompositionViewModel {
  rows: LootValueCompositionRowViewModel[];
  positiveGpPerKill: number;
  displayedGpPerKill: number;
  residualGpPerKill: number;
  note: string | null;
}

export interface LootExpandedRowViewModel {
  label: string;
  key: string | null;
  tag: string | null;
  weight: number | null;
  weightLabel: string | null;
  chance: number | null;
  qty: number | null;
  qtyLabel: string | null;
  price: number | null;
  evGp: number | null;
  shareOfParentPct: number | null;
  notes: string[];
}

export interface LootDropValueDetailViewModel {
  label: string;
  value: string;
  tone: "default" | "warning" | "muted";
}

export interface LootPriceHistoryItemContext {
  itemId: string;
  itemLabel?: string;
  latestPrice: number | null;
  baselinePrice: number | null;
  gpDelta: number | null;
  percentDelta: number | null;
  latestLabel: string | null;
  baselineLabel: string | null;
}

export interface LootPriceHistoryContextViewModel {
  itemId: string | null;
  itemLabel: string;
  tracked: boolean;
  latestPrice: number | null;
  baselinePrice: number | null;
  gpDelta: number | null;
  percentDelta: number | null;
  latestLabel: string | null;
  baselineLabel: string | null;
  statusLabel: string;
}

export interface LootDropRowViewModel {
  rowId: string;
  name: string;
  key: string | null;
  tag: string | null;
  chance: number;
  qtyAvg: number;
  price: number;
  saleValue: number;
  evGp: number;
  effectiveEvGp: number;
  stateLabel: string | null;
  eligibilityDescription: string | null;
  pref: LootAction;
  prefLabel: string;
  defaultPref: LootAction;
  availableActions: LootAction[];
  actionImpacts: LootActionImpactViewModel[];
  selectedDeltaNetGpPerHour: number;
  isOverride: boolean;
  prayerXp: number;
  alchValue: number;
  slotFrac: number;
  expandedRows: LootExpandedRowViewModel[];
  valueDetails: LootDropValueDetailViewModel[];
  historyContext: LootPriceHistoryContextViewModel;
}

export interface LootOptimizeResult {
  prefs: Record<string, LootAction>;
  effectiveNetGpPerHour: number;
  baseEffectiveNetGpPerHour: number;
  deltaNetGpPerHour: number;
  iterations: number;
  changedRows: number;
  capped: boolean;
}

export interface CompareRowViewModel {
  monsterId: EntityId;
  monsterName: string;
  dps: number;
  effectiveXpPerHour: number;
  effectiveNetGpPerHour: number;
  bound: string;
}

export type DuelComparisonRowSource = "live" | "snapshot";

export interface DuelComparisonRowDeltasViewModel {
  maxHit: number;
  dps: number;
  hitChance: number;
  ttkSec: number;
  killsPerTrip: number;
  killsPerHour: number;
  effectiveXpPerHour: number;
  effectiveNetGpPerHour: number;
  gpPerXp: number | null;
  supplyCostPerHour: number;
}

export type DuelSetupDiffCategoryId =
  "combat" | "levels" | "loadout" | "gear" | "prayers-boosts" | "special-overrides" | "trip";

export interface DuelSetupDiffItemViewModel {
  id: string;
  label: string;
  liveValue: string;
  snapshotValue: string;
}

export interface DuelSetupDiffGroupViewModel {
  id: DuelSetupDiffCategoryId;
  label: string;
  items: DuelSetupDiffItemViewModel[];
}

export interface DuelSetupDiffViewModel {
  changeCount: number;
  groups: DuelSetupDiffGroupViewModel[];
  sharedContextNote: string;
}

export interface DuelComparisonBestMarkersViewModel {
  effectiveXpPerHour: boolean;
  effectiveNetGpPerHour: boolean;
  gpPerXp: boolean;
}

export interface DuelComparisonRowViewModel {
  id: string;
  snapshotId: EntityId | null;
  source: DuelComparisonRowSource;
  name: string;
  monsterId: EntityId;
  monsterName: string;
  combatStyle: CombatStyle;
  loadoutLabel: string;
  maxHit: number;
  dps: number;
  hitChance: number;
  ttkSec: number;
  killsPerTrip: number;
  killsPerHour: number;
  effectiveXpPerHour: number;
  effectiveNetGpPerHour: number;
  gpPerXp: number | null;
  supplyCostPerHour: number;
  bound: string;
  warnings: string[];
  setupDiff: DuelSetupDiffViewModel | null;
  deltas: DuelComparisonRowDeltasViewModel;
  best: DuelComparisonBestMarkersViewModel;
}

export interface DuelComparisonViewModel {
  monsterId: EntityId;
  monsterName: string;
  snapshotCount: number;
  snapshotLimit: number;
  liveRow: DuelComparisonRowViewModel;
  snapshotRows: DuelComparisonRowViewModel[];
  rows: DuelComparisonRowViewModel[];
}

export type DuelMatrixMetricId = "dps" | "effectiveXpPerHour" | "effectiveNetGpPerHour" | "gpPerXp";

export interface DuelMatrixMetricValuesViewModel {
  dps: number | null;
  effectiveXpPerHour: number | null;
  effectiveNetGpPerHour: number | null;
  gpPerXp: number | null;
}

export interface DuelMatrixCellViewModel {
  setupId: string;
  values: DuelMatrixMetricValuesViewModel;
  best: Record<DuelMatrixMetricId, boolean>;
}

export interface DuelMatrixSetupViewModel {
  id: string;
  snapshotId: EntityId | null;
  source: DuelComparisonRowSource;
  name: string;
  combatStyle: CombatStyle;
  loadoutLabel: string;
}

export interface DuelMatrixRowViewModel {
  monsterId: EntityId;
  monsterName: string;
  monsterLevel: number | null;
  isCurrentTarget: boolean;
  cells: DuelMatrixCellViewModel[];
}

export interface DuelMatrixViewModel {
  currentMonsterId: EntityId;
  monsterCount: number;
  setupCount: number;
  cellCount: number;
  setups: DuelMatrixSetupViewModel[];
  rows: DuelMatrixRowViewModel[];
}

export type DenseCompareRowMarkerId = "custom" | "alch" | "overhead" | "hidden" | "target";

export interface DenseCompareRowMarkerViewModel {
  id: DenseCompareRowMarkerId;
  label: string;
  ariaLabel: string;
}

export interface DenseCompareRowViewModel {
  monsterId: EntityId;
  monsterName: string;
  monsterLevel: number | null;
  isActiveTarget: boolean;
  isForcedVisible: boolean;
  isIrrelevant: boolean;
  hasCustomSetup: boolean;
  hasHighAlchOverride: boolean;
  hasOverheadOverride: boolean;
  markers: DenseCompareRowMarkerViewModel[];
  hitChance: number;
  maxHit: number;
  dps: number;
  ttkSec: number;
  killsPerHour: number;
  xpPerHour: number;
  gpPerKill: number;
  gpPerHour: number;
  netGpPerHour: number;
  bound: string;
}

export type DenseCompareScaleTone = "positive" | "negative" | "neutral";

export interface DenseCompareScaleCellViewModel {
  value: number;
  widthPercent: number;
  tone: DenseCompareScaleTone;
  ariaLabel: string;
}

export interface DenseCompareScaleRowViewModel {
  xpPerHour: DenseCompareScaleCellViewModel;
  netGpPerHour: DenseCompareScaleCellViewModel;
}

export type DenseCompareScaleViewModel = Record<EntityId, DenseCompareScaleRowViewModel>;

const denseCompareSortValue: Record<
  DenseCompareSortKey,
  (row: DenseCompareRowViewModel) => number | string
> = {
  monsterName: (row) => row.monsterName,
  hitChance: (row) => row.hitChance,
  maxHit: (row) => row.maxHit,
  dps: (row) => row.dps,
  ttkSec: (row) => row.ttkSec,
  killsPerHour: (row) => row.killsPerHour,
  xpPerHour: (row) => row.xpPerHour,
  gpPerKill: (row) => row.gpPerKill,
  gpPerHour: (row) => row.gpPerHour,
  netGpPerHour: (row) => row.netGpPerHour
};

const NATURE_RUNE_FALLBACK = 265;
const LOOT_ACTION_ORDER: LootAction[] = ["loot", "skip", "bury", "alch", "unid", "value"];
const MAX_LOOT_OPTIMIZE_ITERATIONS = 30;
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
const MONSTER_CARD_DEFENCE_ROWS = [
  { key: "stab", label: "Stab defence", field: "defStab" },
  { key: "slash", label: "Slash defence", field: "defSlash" },
  { key: "crush", label: "Crush defence", field: "defCrush" },
  { key: "range", label: "Ranged defence", field: "defRange" },
  { key: "magic", label: "Magic defence", field: "defMagic" }
] satisfies Array<{
  key: MonsterCardDefenceKey;
  label: string;
  field: MonsterCardDefenceField;
}>;

export interface SelectOptionViewModel {
  id: EntityId;
  label: string;
  hint?: string;
}

export interface GearQuickActionViewModel {
  itemId: EntityId;
  itemLabel: string;
  disabled: boolean;
  reason: string;
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

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function monsterNumber(
  monster: GameDataSnapshot["monsters"][string],
  key: keyof GameDataSnapshot["monsters"][string]
): number | null {
  return nullableNumber(monster[key]);
}

function namedSelection(
  id: EntityId | undefined,
  label: string | undefined
): MonsterCardNamedSelectionViewModel {
  return {
    id: id ?? "none",
    label: label ?? id ?? "None"
  };
}

function monsterCardSetupBadge(
  options: MonsterCardViewModelOptions = {}
): MonsterCardSetupBadgeViewModel {
  const mode = options.setupMode ?? "default";
  const hasCustomSetup = options.hasCustomSetup ?? mode === "custom";
  if (mode === "custom") {
    return { mode, label: "Custom setup", tone: "custom", hasCustomSetup };
  }
  return {
    mode,
    label: hasCustomSetup ? "Default setup (custom saved)" : "Default setup",
    tone: "default",
    hasCustomSetup
  };
}

function activeMonsterDefenceField(value: string): MonsterCardDefenceField | null {
  return MONSTER_CARD_DEFENCE_ROWS.some((row) => row.field === value)
    ? (value as MonsterCardDefenceField)
    : null;
}

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

function createMonsterCardStats(
  monster: GameDataSnapshot["monsters"][string]
): MonsterCardStatViewModel[] {
  const rows = [
    { key: "combat", label: "Combat", value: monsterNumber(monster, "level") },
    { key: "hitpoints", label: "HP", value: monsterNumber(monster, "hp") },
    { key: "attack", label: "Attack", value: monsterNumber(monster, "attack") },
    { key: "strength", label: "Strength", value: monsterNumber(monster, "strength") },
    { key: "defence", label: "Defence", value: monsterNumber(monster, "defLevel") },
    { key: "magic", label: "Magic", value: monsterNumber(monster, "magicLevel") },
    { key: "attackSpeed", label: "Attack speed", value: monsterNumber(monster, "attackSpeed") }
  ] satisfies Array<Omit<MonsterCardStatViewModel, "missing">>;

  return rows.map((row) => ({ ...row, missing: row.value == null }));
}

function createMonsterCardDefenceRows(
  monster: GameDataSnapshot["monsters"][string],
  activeField: MonsterCardDefenceField | null
): MonsterCardDefenceRowViewModel[] {
  return MONSTER_CARD_DEFENCE_ROWS.map((row) => {
    const value = monsterNumber(monster, row.field);
    return {
      ...row,
      value,
      active: row.field === activeField,
      missing: value == null
    };
  });
}

function styleLabelForRequest(request: SimulationRequest, gameData: GameDataSnapshot): string {
  return (
    styleOptions(gameData, request.combatStyle, request.loadout.weaponId).find(
      (option) => option.id === request.styleId
    )?.label ?? request.styleId
  );
}

function createMonsterCardSetupOverview(
  request: SimulationRequest,
  context: SimulationContext,
  combat: ReturnType<typeof simulateCombat>
): MonsterCardSetupOverviewViewModel {
  const gameData = context.gameData;
  const weaponId = request.loadout.weaponId;
  const weapon = gameData.weapons[weaponId];
  const ammoId = request.loadout.ammoId;
  const ammo =
    request.combatStyle === "ranged" && ammoId && ammoId !== "none"
      ? namedSelection(ammoId, gameData.ammo[ammoId]?.name)
      : null;
  const spell =
    request.combatStyle === "magic" && request.spellId
      ? namedSelection(request.spellId, gameData.spells[request.spellId]?.name)
      : null;
  const ringId = request.loadout.gear.ring;
  const ring =
    ringId && ringId !== "none"
      ? namedSelection(ringId, gameData.equipment.ring?.[ringId]?.name)
      : null;
  const attackType =
    request.combatStyle === "melee"
      ? (combat.debug.attackType ?? null)
      : request.combatStyle === "ranged"
        ? "ranged"
        : "magic";
  const styleLabel = styleLabelForRequest(request, gameData);
  const summary = [
    `Weapon: ${weapon?.name ?? weaponId}`,
    ammo ? `Ammo: ${ammo.label}` : null,
    spell ? `Spell: ${spell.label}` : null,
    `Style: ${styleLabel}`,
    `ACC ${signedBonus(combat.debug.accuracyBonus)}`,
    `DMG ${signedBonus(combat.debug.damageBonus)}`,
    `Speed ${formatNumber(combat.attackSpeedSec, 1)}s`
  ].filter((item): item is string => item != null);

  return {
    combatStyle: request.combatStyle,
    styleId: request.styleId,
    styleLabel,
    attackType,
    weapon: namedSelection(weaponId, weapon?.name),
    ammo,
    spell,
    accuracyBonus: combat.debug.accuracyBonus,
    damageBonus: combat.debug.damageBonus,
    attackSpeedSec: combat.attackSpeedSec,
    prayerIds: [...request.prayers.keys],
    boostIds: [...request.boosts.keys],
    sustained: !!request.sustained,
    ring,
    summary
  };
}

function monsterCardFromResult(
  request: SimulationRequest,
  context: SimulationContext,
  combat: ReturnType<typeof simulateCombat>,
  options: MonsterCardViewModelOptions = {}
): MonsterCardViewModel {
  const monster = context.gameData.monsters[request.monsterId];
  if (!monster) throw new Error(`Unknown monster id: ${request.monsterId}`);

  const activeField = activeMonsterDefenceField(combat.debug.defenceField);
  const defenceRows = createMonsterCardDefenceRows(monster, activeField);
  const activeDefenceKey = defenceRows.find((row) => row.active)?.key ?? null;

  return {
    monsterId: monster.id,
    monsterName: monster.name,
    stats: createMonsterCardStats(monster),
    defenceRows,
    activeDefenceField: activeField,
    activeDefenceKey,
    setupBadge: monsterCardSetupBadge(options),
    setupOverview: createMonsterCardSetupOverview(request, context, combat)
  };
}

export function createMonsterCardViewModel(
  form: CombatSetupFormState,
  context: SimulationContext,
  options: MonsterCardViewModelOptions = {}
): MonsterCardViewModel {
  const request = formToSimulationRequest(form, context.gameData);
  const combat = simulateCombat(request, context);
  return monsterCardFromResult(request, context, combat, options);
}

function uniqueLootActions(actions: LootAction[]): LootAction[] {
  return LOOT_ACTION_ORDER.filter((action) => actions.includes(action));
}

function availableLootActions(
  drop: LootBreakdownEntry,
  alching: boolean,
  natureRuneCost: number
): LootAction[] {
  if (!drop.eligibilityActive) return ["skip"];
  const actions: LootAction[] = ["loot", "skip"];
  if (drop.isBone) actions.push("bury");
  if (alching && drop.alchValue - natureRuneCost > 0) actions.push("alch");
  if (drop.isHerb) actions.push("unid", "value");
  if (drop.tag === "gem") actions.push("value");
  if (!actions.includes(drop.pref)) actions.push(drop.pref);
  return uniqueLootActions(actions);
}

function lootActionLabel(action: LootAction): string {
  return action === "unid" ? "Unid" : action.charAt(0).toUpperCase() + action.slice(1);
}

function lootRowStateLabel(
  drop: Pick<LootBreakdownEntry, "_eaten" | "_displaced" | "eligibility" | "eligibilityActive">
): string | null {
  if (!drop.eligibilityActive && drop.eligibility?.kind === "quest") {
    return "Quest state not modeled";
  }
  if (!drop.eligibilityActive && drop.eligibility?.kind === "clue") {
    return "Clue eligibility not modeled";
  }
  if (drop._eaten) return "Eaten as food";
  if (drop._displaced) return "Displaced by inventory";
  return null;
}

function effectiveDropEvGp(drop: LootBreakdownEntry): number {
  return drop._displaced ? 0 : drop.evGp;
}

function finiteNumberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function expandedRows(drop: LootBreakdownEntry): LootExpandedRowViewModel[] {
  if (!Array.isArray(drop._expand)) return [];
  const normalized = drop._expand.map((row, index) => {
    const record = row as Record<string, unknown>;
    const weight = finiteNumberField(record, "weight");
    const stringWeight = stringField(record, "weight");
    const chance = finiteNumberField(record, "chance");
    const qty = finiteNumberField(record, "qtyAvg") ?? finiteNumberField(record, "qty");
    const price = finiteNumberField(record, "price");

    return {
      label: typeof record.name === "string" ? record.name : `Row ${index + 1}`,
      key: stringField(record, "key"),
      tag: stringField(record, "tag"),
      weight,
      weightLabel:
        weight !== null ? formatNumber(weight) : stringWeight !== null ? stringWeight : null,
      chance,
      qty,
      qtyLabel: qty !== null ? formatNumber(qty, 2) : null,
      price,
      evGp: null,
      shareOfParentPct: null,
      notes: [
        record.talisman === true ? "Talisman band" : null,
        record.mega === true ? "Nested mega-rare table" : null
      ].filter((note): note is string => note !== null)
    };
  });

  const totalWeight = normalized.reduce((sum, row) => sum + (row.weight ?? 0), 0);
  const weightedValues = normalized.map((row) =>
    row.weight !== null && row.price !== null ? row.weight * row.price : 0
  );
  const totalWeightedValue = weightedValues.reduce((sum, value) => sum + value, 0);
  const canDeriveWeightedShare =
    totalWeight > 0 &&
    totalWeightedValue > 0 &&
    effectiveDropEvGp(drop) > 0 &&
    drop.pref !== "unid" &&
    drop.pref !== "alch" &&
    drop.pref !== "bury" &&
    drop.pref !== "skip";

  return normalized.map((row, index) => {
    const weightChance = row.weight !== null && totalWeight > 0 ? row.weight / totalWeight : null;
    const share =
      canDeriveWeightedShare && weightedValues[index] > 0
        ? weightedValues[index] / totalWeightedValue
        : null;

    return {
      ...row,
      chance: row.chance ?? weightChance,
      evGp: share === null ? null : effectiveDropEvGp(drop) * share,
      shareOfParentPct: share === null ? null : share * 100
    };
  });
}

function lootValueDetails(drop: LootBreakdownEntry): LootDropValueDetailViewModel[] {
  const effectiveEvGp = effectiveDropEvGp(drop);
  const rows: LootDropValueDetailViewModel[] = [
    { label: "Post-trip EV/kill", value: `${formatNumber(effectiveEvGp, 1)} gp`, tone: "default" },
    { label: "Sale value", value: `${formatNumber(drop.saleValue)} gp`, tone: "muted" },
    { label: "Alch value", value: `${formatNumber(drop.alchValue)} gp`, tone: "muted" },
    { label: "Slot fraction", value: formatNumber(drop.slotFrac, 2), tone: "muted" }
  ];

  if (!drop.eligibilityActive && drop.eligibility) {
    rows.push({
      label: "Eligibility",
      value:
        drop.eligibility.kind === "quest"
          ? drop.eligibility.description
          : "Requires a members area and no existing clue scroll.",
      tone: "warning"
    });
  }

  if (drop._displaced) {
    rows.push({
      label: "Pre-displacement EV",
      value: `${formatNumber(drop.evGp, 1)} gp`,
      tone: "warning"
    });
  }
  if (drop.prayerXp > 0) {
    rows.push({
      label: "Bury prayer XP",
      value: `${formatNumber(drop.chance * drop.qtyAvg * drop.prayerXp, 1)} xp/kill`,
      tone: "muted"
    });
  }
  const stateLabel = lootRowStateLabel(drop);
  if (stateLabel) rows.push({ label: "Trip state", value: stateLabel, tone: "warning" });

  return rows;
}

function cleanNullableNumber(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function lootPriceHistoryContext(
  drop: LootBreakdownEntry,
  historyByItem: SimulationViewModelOptions["lootPriceHistoryByItem"] = {}
): LootPriceHistoryContextViewModel {
  const itemId = drop.key ?? null;
  if (!itemId) {
    return {
      itemId: null,
      itemLabel: drop.name,
      tracked: false,
      latestPrice: null,
      baselinePrice: null,
      gpDelta: null,
      percentDelta: null,
      latestLabel: null,
      baselineLabel: null,
      statusLabel: "No item key"
    };
  }

  const history = historyByItem[itemId];
  if (!history) {
    return {
      itemId,
      itemLabel: drop.name,
      tracked: false,
      latestPrice: null,
      baselinePrice: null,
      gpDelta: null,
      percentDelta: null,
      latestLabel: null,
      baselineLabel: null,
      statusLabel: "No history"
    };
  }

  return {
    itemId,
    itemLabel: history.itemLabel ?? drop.name,
    tracked: true,
    latestPrice: cleanNullableNumber(history.latestPrice),
    baselinePrice: cleanNullableNumber(history.baselinePrice),
    gpDelta: cleanNullableNumber(history.gpDelta),
    percentDelta: cleanNullableNumber(history.percentDelta),
    latestLabel: history.latestLabel,
    baselineLabel: history.baselineLabel,
    statusLabel: "Tracked"
  };
}

function actionImpactNotes(
  action: LootAction,
  drop: LootBreakdownEntry,
  natureRuneCost: number
): string[] {
  const notes: string[] = [];
  const rollsPerKill = drop.chance * drop.qtyAvg;

  if (action === "bury" && drop.isBone && drop.prayerXp > 0) {
    notes.push(`${formatNumber(rollsPerKill * drop.prayerXp, 1)} prayer XP/kill`);
  }
  if (action === "alch") {
    notes.push(`${formatNumber(Math.max(0, drop.alchValue - natureRuneCost))} gp/item after rune`);
    notes.push(`${formatNumber(rollsPerKill, 2)} casts/kill`);
  }
  if (action === "unid" && drop.isHerb) notes.push("Uses unidentified herb value");
  if (action === "value" && drop.isHerb) notes.push("Keeps high-value herb rolls");
  if (action === "value" && drop.tag === "gem") notes.push("Keeps high-value jewel rolls");
  if (action === "skip") notes.push("Leaves the parent row out");
  return notes;
}

function createLootValueComposition(trip: TripLootSupplyResult): LootValueCompositionViewModel {
  const positiveDrops = trip.lootBreakdown
    .map((drop) => ({
      drop,
      contribution: effectiveDropEvGp(drop)
    }))
    .filter((entry) => entry.contribution > 0)
    .sort((left, right) => right.contribution - left.contribution);
  const positiveGpPerKill = positiveDrops.reduce((sum, entry) => sum + entry.contribution, 0);
  const visibleDrops = positiveDrops.slice(0, 8);
  const hiddenDrops = positiveDrops.slice(8);
  const rows: LootValueCompositionRowViewModel[] = visibleDrops.map(({ drop, contribution }) => ({
    rowId: drop.rowId,
    name: drop.name,
    action: drop.pref,
    actionLabel: lootActionLabel(drop.pref),
    gpPerKill: contribution,
    shareOfPositivePct: positiveGpPerKill > 0 ? (contribution / positiveGpPerKill) * 100 : null,
    stateLabel: lootRowStateLabel(drop),
    childCount: Array.isArray(drop._expand) ? drop._expand.length : 0,
    isOther: false
  }));
  const otherGpPerKill = hiddenDrops.reduce((sum, entry) => sum + entry.contribution, 0);

  if (otherGpPerKill > 0) {
    rows.push({
      rowId: null,
      name: "Other drops",
      action: null,
      actionLabel: "Mixed",
      gpPerKill: otherGpPerKill,
      shareOfPositivePct: positiveGpPerKill > 0 ? (otherGpPerKill / positiveGpPerKill) * 100 : null,
      stateLabel: null,
      childCount: hiddenDrops.reduce(
        (sum, entry) => sum + (Array.isArray(entry.drop._expand) ? entry.drop._expand.length : 0),
        0
      ),
      isOther: true
    });
  }

  const residualGpPerKill = trip.gpPerKill - positiveGpPerKill;
  const note =
    Math.abs(residualGpPerKill) >= 0.05
      ? `Displayed GP/kill differs by ${formatNumber(residualGpPerKill, 1)} gp because trip state or zero-value rows are applied outside the positive-contributor list.`
      : null;

  return {
    rows,
    positiveGpPerKill,
    displayedGpPerKill: trip.gpPerKill,
    residualGpPerKill,
    note
  };
}

const MONEY_WARNING_CODES = new Set([
  "missing-price",
  "missing-alch-value",
  "price-alias-used",
  "price-fallback-used",
  "approximate-data-source"
]);
const SPECIAL_WARNING_CODES = new Set(["dragon-halberd-npc-size-fallback"]);
const ACTIVE_ASSUMPTIONS_VISIBLE_LIMIT = 5;
const PROTECT_PRAYER_LABELS: Record<
  Exclude<CombatSetupFormState["trip"]["protect"], "none">,
  string
> = {
  melee: "Protect from melee",
  missiles: "Protect from missiles",
  magic: "Protect from magic"
};

function warningViewModel(warning: SimulationWarning): CalculationWarningViewModel {
  return {
    code: warning.code,
    severity: warning.severity,
    message: warning.message.replace(/\s+/g, " ").slice(0, 240)
  };
}

function calculationWarningViewModels(
  warnings: readonly SimulationWarning[]
): CalculationWarningViewModel[] {
  const seen = new Set<string>();
  const out: CalculationWarningViewModel[] = [];

  for (const warning of warnings) {
    const item = warningViewModel(warning);
    const key = `${item.code}:${item.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function activeAssumptionCountLabel(count: number, noun: string): string {
  return `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function activeAssumptionSourceLabel(source: SimulationContext["priceSet"]["source"]): string {
  if (source === "scraped") return "Synced";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function activeAssumptionSigned(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value, Number.isInteger(value) ? 0 : 1)}`;
}

function activeAssumptionManualOverrideParts(
  overrides: CombatSetupFormState["manualOverrides"]
): string[] {
  const parts: string[] = [];
  if (overrides.accuracyBonus != null) {
    parts.push(`accuracy ${activeAssumptionSigned(overrides.accuracyBonus)}`);
  }
  if (overrides.damageBonus != null) {
    parts.push(`damage ${activeAssumptionSigned(overrides.damageBonus)}`);
  }
  if (overrides.attackSpeedSec != null) {
    parts.push(`speed ${formatNumber(overrides.attackSpeedSec, 1)}s`);
  }
  return parts;
}

function activeAssumptionLootSettingParts(
  form: CombatSetupFormState,
  settings: ReturnType<typeof lootSettingsForMonster>,
  rawSettings: LootSettingsByMonsterState[string] | undefined
): string[] {
  const parts: string[] = [];
  if (rawSettings?.highAlch != null) {
    parts.push(`high alch ${rawSettings.highAlch ? "on" : "off"}`);
  } else if (form.trip.alching) {
    parts.push("high alch on");
  }
  if (rawSettings?.overheadSec != null)
    parts.push(`overhead ${formatNumber(settings.overheadSec ?? 0, 1)}s`);
  if (rawSettings?.talismanSpot === "overground") parts.push("talisman overground");
  return parts;
}

function activeAssumptionTripManualParts(form: CombatSetupFormState): string[] {
  const parts: string[] = [];
  if (form.trip.bankSeconds != null) parts.push(`bank ${formatNumber(form.trip.bankSeconds)}s`);
  if (form.trip.foodCount != null) parts.push(`food ${formatNumber(form.trip.foodCount)}`);
  if (form.trip.foodPerKillOverride != null) {
    parts.push(`food/kill ${formatNumber(form.trip.foodPerKillOverride, 2)}`);
  }
  if (form.trip.prayerMode === "potions") {
    if (form.trip.prayerPotionDoses != null) {
      parts.push(`prayer ${formatNumber(form.trip.prayerPotionDoses)} doses`);
    } else if (form.trip.prayerPotionSets != null) {
      parts.push(`prayer ${formatNumber(form.trip.prayerPotionSets)} vials`);
    }
  } else if (form.trip.prayerMode === "altar" && form.trip.altarSeconds != null) {
    parts.push(`altar ${formatNumber(form.trip.altarSeconds)}s`);
  }
  return parts;
}

function activeAssumptionSupplyParts(form: CombatSetupFormState): string[] {
  const defaults = DEFAULT_FORM_STATE.trip;
  const parts: string[] = [];
  if (form.trip.potionSets !== defaults.potionSets) {
    parts.push(`boost vials ${formatNumber(form.trip.potionSets)}`);
  }
  if (form.trip.potionDoses !== defaults.potionDoses) {
    parts.push(`boost doses ${formatNumber(form.trip.potionDoses)}`);
  }
  if (form.trip.singleDose !== defaults.singleDose) {
    parts.push(form.trip.singleDose ? "single-dose boosts" : "vial boosts");
  }
  if (form.trip.dbaRestore !== defaults.dbaRestore) {
    parts.push(form.trip.dbaRestore ? "DBA restore on" : "DBA restore off");
  }
  if (form.trip.antifire !== defaults.antifire)
    parts.push(`antifire ${form.trip.antifire ? "on" : "off"}`);
  if (form.trip.antipoison !== defaults.antipoison) {
    parts.push(`antipoison ${form.trip.antipoison ? "on" : "off"}`);
  }
  if (form.trip.recoilRings !== defaults.recoilRings) {
    parts.push(`recoil rings ${formatNumber(form.trip.recoilRings)}`);
  }
  if (form.combatStyle === "magic" && form.trip.runeSlots !== defaults.runeSlots) {
    parts.push(`rune slots ${formatNumber(form.trip.runeSlots)}`);
  }
  return parts;
}

function activeAssumptionValidLootOverrideCount(
  lootPrefs: Record<string, LootAction | string | undefined>,
  effectiveOverrideCount: number
): number {
  if (effectiveOverrideCount > 0) return effectiveOverrideCount;
  return Object.values(lootPrefs).filter((value) => LOOT_ACTION_ORDER.includes(value as LootAction))
    .length;
}

const SETUP_REQUIREMENT_SKILLS = [
  "attack",
  "strength",
  "defence",
  "ranged",
  "magic"
] as const satisfies readonly SetupRequirementSkill[];

const SETUP_REQUIREMENT_SLOT_LABELS: Record<SetupRequirementSlot, string> = {
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

function createSetupRequirementWarnings(
  item: {
    slot: SetupRequirementSlot;
    itemId: EntityId;
    itemName: string;
  },
  gameData: GameDataSnapshot,
  levels: PlayerLevels
): SetupRequirementWarningViewModel[] {
  if (item.itemId === "none") return [];
  const requirement = requirementForItem(gameData, item.itemId).requirements;
  return SETUP_REQUIREMENT_SKILLS.flatMap((skill) => {
    const requiredLevel = requirement[skill] ?? 0;
    if (requiredLevel <= 0) return [];
    const currentLevel = levels[skill];
    if (currentLevel >= requiredLevel) return [];
    const skillLabel = SKILL_LABEL[skill];
    return [
      {
        code: "setup-requirement-unmet",
        severity: "warning",
        message: `${item.itemName} requires ${skillLabel} ${formatNumber(requiredLevel)}; current ${skillLabel} ${formatNumber(currentLevel)}.`,
        itemId: item.itemId,
        itemName: item.itemName,
        slot: item.slot,
        slotLabel: SETUP_REQUIREMENT_SLOT_LABELS[item.slot],
        skill,
        skillLabel,
        requiredLevel,
        currentLevel
      }
    ];
  });
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

function createSetupRequirementSummaryViewModel(
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

function createActiveAssumptionsSummaryViewModel(input: {
  form: CombatSetupFormState;
  request: SimulationRequest;
  context: SimulationContext;
  trip: TripLootSupplyResult;
  cannonByMonster: CannonByMonsterState;
  lootPrefs: Record<string, LootAction | string | undefined>;
  lootSettingsByMonster: LootSettingsByMonsterState;
  lootOverrideCount: number;
  setupRequirements: SetupRequirementSummaryViewModel;
  specialWarnings: readonly CalculationWarningViewModel[];
  moneyWarnings: readonly CalculationWarningViewModel[];
  options?: SimulationViewModelOptions["activeAssumptions"];
}): ActiveAssumptionsSummaryViewModel {
  const rows: ActiveAssumptionRowViewModel[] = [];
  const monsterName =
    input.context.gameData.monsters[input.request.monsterId]?.name ?? input.request.monsterId;
  const combatReviewTab = input.request.combatStyle;

  if (input.moneyWarnings.length > 0) {
    rows.push({
      id: "price-warnings",
      category: "warning",
      label: "Price confidence",
      value: activeAssumptionCountLabel(input.moneyWarnings.length, "warning"),
      detail: input.moneyWarnings[0]?.message ?? "Price warnings affect this result.",
      reviewTab: "economy",
      tone: "warning",
      priority: 10
    });
  }

  if (input.specialWarnings.length > 0) {
    rows.push({
      id: "special-warnings",
      category: "warning",
      label: "Special attack assumption",
      value: activeAssumptionCountLabel(input.specialWarnings.length, "warning"),
      detail: input.specialWarnings[0]?.message ?? "Special attack assumptions affect this result.",
      reviewTab: combatReviewTab,
      tone: "warning",
      priority: 11
    });
  }

  if (input.setupRequirements.hasWarnings) {
    rows.push({
      id: "setup-requirements",
      category: "warning",
      label: "Setup requirements",
      value: activeAssumptionCountLabel(input.setupRequirements.warningCount, "warning"),
      detail:
        input.setupRequirements.warnings[0]?.message ?? "Requirement checks flag this loadout.",
      reviewTab: combatReviewTab,
      tone: "warning",
      priority: 12
    });
  }

  if (input.options?.setupMode === "custom" && input.options.hasCustomSetup === true) {
    rows.push({
      id: "custom-setup",
      category: "setup",
      label: "Custom setup",
      value: monsterName,
      detail: "Monster-specific setup snapshot is active for this result.",
      reviewTab: combatReviewTab,
      tone: "info",
      priority: 20
    });
  }

  const currentCannon = input.cannonByMonster[input.request.monsterId];
  if (currentCannon?.enabled === true) {
    const output = input.trip.cannon;
    const respawn = currentCannon.respawnSec ?? output?.respawnSec ?? null;
    rows.push({
      id: "cannon-enabled",
      category: "setup",
      label: "Cannon",
      value: output?.idle ? "Enabled, idle" : "Enabled",
      detail: [
        `targets ${formatNumber(currentCannon.targets ?? 3)}`,
        respawn != null ? `respawn ${formatNumber(respawn)}s` : null
      ]
        .filter(Boolean)
        .join(", "),
      reviewTab: "cannon",
      tone: output?.idle ? "warning" : "info",
      priority: 21,
      resetAction: {
        target: "cannon-enabled",
        label: "Reset",
        ariaLabel: "Reset current monster cannon",
        statusLabel: "Current monster cannon reset"
      }
    });
  }

  const manualOverrideParts = activeAssumptionManualOverrideParts(input.form.manualOverrides);
  if (manualOverrideParts.length > 0) {
    rows.push({
      id: "manual-combat-overrides",
      category: "setup",
      label: "Manual combat overrides",
      value: activeAssumptionCountLabel(manualOverrideParts.length, "field"),
      detail: manualOverrideParts.join(", "),
      reviewTab: combatReviewTab,
      tone: "info",
      priority: 22,
      resetAction: {
        target: "manual-combat-overrides",
        label: "Reset",
        ariaLabel: "Reset manual combat overrides",
        statusLabel: "Manual overrides reset"
      }
    });
  }

  if (input.context.priceSet.source !== "bundled") {
    rows.push({
      id: "active-price-set",
      category: "loot",
      label: "Active PriceSet",
      value: activeAssumptionSourceLabel(input.context.priceSet.source),
      detail: input.context.priceSet.label,
      reviewTab: "economy",
      tone: "info",
      priority: 40
    });
  }

  const rawLootSettings = input.lootSettingsByMonster[input.request.monsterId];
  const lootSettings = lootSettingsForMonster(input.lootSettingsByMonster, input.request.monsterId);
  const lootSettingParts = activeAssumptionLootSettingParts(
    input.form,
    lootSettings,
    rawLootSettings
  );
  if (lootSettingParts.length > 0) {
    rows.push({
      id: "loot-settings",
      category: "loot",
      label: "Loot settings",
      value: activeAssumptionCountLabel(lootSettingParts.length, "modifier"),
      detail: lootSettingParts.join(", "),
      reviewTab: "loot",
      tone: "info",
      priority: 41,
      resetAction:
        rawLootSettings == null
          ? undefined
          : {
              target: "loot-settings",
              label: "Reset",
              ariaLabel: "Reset current monster loot settings",
              statusLabel: "Current monster loot settings reset"
            }
    });
  }

  const lootOverrideCount = activeAssumptionValidLootOverrideCount(
    input.lootPrefs,
    input.lootOverrideCount
  );
  if (lootOverrideCount > 0) {
    rows.push({
      id: "loot-action-overrides",
      category: "loot",
      label: "Loot action overrides",
      value: activeAssumptionCountLabel(lootOverrideCount, "drop"),
      detail: "Current monster drop actions differ from canonical defaults.",
      reviewTab: "loot",
      tone: "info",
      priority: 42,
      resetAction: {
        target: "loot-action-overrides",
        label: "Reset",
        ariaLabel: "Reset current monster loot overrides",
        statusLabel: "Current monster loot overrides reset"
      }
    });
  }

  if (input.form.trip.scarceSpot) {
    rows.push({
      id: "scarce-spot",
      category: "trip",
      label: "Scarce spot",
      value: "On",
      detail: [
        `targets ${formatNumber(input.form.trip.targetsAtSpot ?? input.trip.trip.scarce.targetsAtSpot)}`,
        `respawn ${formatNumber(input.form.trip.respawnSeconds ?? input.trip.trip.scarce.respawnSeconds)}s`
      ].join(", "),
      reviewTab: "trip",
      tone: "info",
      priority: 60,
      resetAction: {
        target: "scarce-spot",
        label: "Reset",
        ariaLabel: "Reset scarce spot",
        statusLabel: "Scarce spot disabled; target and respawn values kept"
      }
    });
  }

  if (input.form.trip.safespot != null) {
    rows.push({
      id: "explicit-safespot",
      category: "trip",
      label: "Safespot override",
      value: input.form.trip.safespot ? "On" : "Off",
      detail: `Explicit safespot ${input.form.trip.safespot ? "on" : "off"}; auto detection is bypassed.`,
      reviewTab: "trip",
      tone: "info",
      priority: 61,
      resetAction: {
        target: "explicit-safespot",
        label: "Reset",
        ariaLabel: "Reset safespot override",
        statusLabel: "Safespot override reset to auto"
      }
    });
  }

  if (input.form.trip.protect !== "none") {
    rows.push({
      id: "protection-prayer",
      category: "trip",
      label: "Protection prayer",
      value: PROTECT_PRAYER_LABELS[input.form.trip.protect],
      detail: "Incoming damage uses the selected protection prayer.",
      reviewTab: "trip",
      tone: "info",
      priority: 62
    });
  }

  const tripManualParts = activeAssumptionTripManualParts(input.form);
  if (tripManualParts.length > 0) {
    rows.push({
      id: "manual-trip-controls",
      category: "trip",
      label: "Manual trip controls",
      value: activeAssumptionCountLabel(tripManualParts.length, "field"),
      detail: tripManualParts.join(", "),
      reviewTab: "trip",
      tone: "info",
      priority: 63
    });
  }

  const supplyParts = activeAssumptionSupplyParts(input.form);
  if (supplyParts.length > 0) {
    rows.push({
      id: "supply-settings",
      category: "settings",
      label: "Supply settings",
      value: activeAssumptionCountLabel(supplyParts.length, "modifier"),
      detail: supplyParts.join(", "),
      reviewTab: "trip",
      tone: "info",
      priority: 70
    });
  }

  const hiddenGearTierCount = input.options?.hiddenGearTierCount ?? 0;
  if (hiddenGearTierCount > 0) {
    rows.push({
      id: "hidden-gear-tiers",
      category: "settings",
      label: "Hidden gear tiers",
      value: activeAssumptionCountLabel(hiddenGearTierCount, "tier"),
      detail: "Gear candidate lists hide these tiers in setup controls.",
      reviewTab: "settings",
      tone: "info",
      priority: 80,
      resetAction: {
        target: "hidden-gear-tiers",
        label: "Reset",
        ariaLabel: "Reset hidden gear tiers",
        statusLabel: "Hidden gear tiers shown"
      }
    });
  }

  rows.sort(
    (left, right) => left.priority - right.priority || left.label.localeCompare(right.label)
  );
  const visibleRows = rows.slice(0, ACTIVE_ASSUMPTIONS_VISIBLE_LIMIT);
  const hiddenRows = rows.slice(ACTIVE_ASSUMPTIONS_VISIBLE_LIMIT);
  return {
    statusLabel:
      rows.length === 0
        ? "Default assumptions active"
        : `${activeAssumptionCountLabel(rows.length, "active modifier")}`,
    totalCount: rows.length,
    hasActiveRows: rows.length > 0,
    visibleRows,
    hiddenRows,
    hiddenCount: hiddenRows.length
  };
}

function tripInputFor(
  form: CombatSetupFormState,
  request: SimulationRequest,
  combat: ReturnType<typeof simulateCombat>,
  cannonByMonster: CannonByMonsterState,
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): TripLootSupplyInput {
  return {
    ...fullSimulationInputFor(form, request, cannonByMonster, lootSettingsByMonster),
    combat
  };
}

function fullSimulationInputFor(
  form: CombatSetupFormState,
  request: SimulationRequest,
  cannonByMonster: CannonByMonsterState,
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): FullSimulationInput {
  const lootSettings = lootSettingsForMonster(lootSettingsByMonster, request.monsterId);
  const trip = formToTripPolicy(form);
  return {
    request,
    trip: {
      ...trip,
      alching: lootSettings.highAlch ?? trip.alching
    },
    ringOfWealth: form.ringOfWealth,
    legendsComplete: true,
    jewelSpot: lootSettings.talismanSpot,
    overheadSec: lootSettings.overheadSec,
    cannon: cannonByMonster[request.monsterId]
  };
}

function simulateWithLootPrefs(
  input: TripLootSupplyInput,
  context: SimulationContext,
  lootPrefs: Record<string, LootAction | string | undefined> | undefined
): TripLootSupplyResult {
  return simulateTripLootSupply({ ...input, lootPrefs }, context);
}

function createLootRows(
  input: TripLootSupplyInput,
  context: SimulationContext,
  currentTrip: TripLootSupplyResult,
  lootPrefs: Record<string, LootAction | string | undefined>,
  lootPriceHistoryByItem: SimulationViewModelOptions["lootPriceHistoryByItem"] = {}
): {
  rows: LootDropRowViewModel[];
  defaultEffectiveNetGpPerHour: number;
  currentDeltaNetGpPerHour: number;
  overrideCount: number;
} {
  const defaultTrip = simulateWithLootPrefs(input, context, undefined);
  const defaultRows = new Map(defaultTrip.lootBreakdown.map((drop) => [drop.rowId, drop]));
  const natureRuneCost = context.priceSet.itemPrices.naturerune ?? NATURE_RUNE_FALLBACK;

  const rows = currentTrip.lootBreakdown.map((drop) => {
    const defaultDrop = defaultRows.get(drop.rowId) ?? drop;
    const availableActions = availableLootActions(
      defaultDrop,
      !!input.trip?.alching,
      natureRuneCost
    );
    const actionImpacts = availableActions.map((action) => {
      const candidatePrefs: Record<string, LootAction> =
        action === defaultDrop.pref ? {} : { [drop.rowId]: action };
      const candidate = simulateWithLootPrefs(input, context, candidatePrefs);
      const candidateDrop =
        candidate.lootBreakdown.find((entry) => entry.rowId === drop.rowId) ?? drop;
      return {
        action,
        label: lootActionLabel(action),
        effectiveNetGpPerHour: candidate.effectiveNetGpPerHour,
        deltaNetGpPerHour: candidate.effectiveNetGpPerHour - defaultTrip.effectiveNetGpPerHour,
        gpPerKillContribution: effectiveDropEvGp(candidateDrop),
        isSelected: action === drop.pref,
        isDefault: action === defaultDrop.pref,
        stateLabel: lootRowStateLabel(candidateDrop),
        notes: actionImpactNotes(action, candidateDrop, natureRuneCost)
      };
    });
    const selectedImpact = actionImpacts.find((impact) => impact.action === drop.pref);

    return {
      rowId: drop.rowId,
      name: drop.name,
      key: drop.key ?? null,
      tag: typeof drop.tag === "string" ? drop.tag : null,
      chance: drop.chance,
      qtyAvg: drop.qtyAvg,
      price: drop.price,
      saleValue: drop.saleValue,
      evGp: drop.evGp,
      effectiveEvGp: effectiveDropEvGp(drop),
      stateLabel: lootRowStateLabel(drop),
      eligibilityDescription:
        drop.eligibility?.kind === "quest"
          ? drop.eligibility.description
          : drop.eligibility?.kind === "clue"
            ? "Requires a members area and no existing clue scroll."
            : null,
      pref: drop.pref,
      prefLabel: lootActionLabel(drop.pref),
      defaultPref: defaultDrop.pref,
      availableActions,
      actionImpacts,
      selectedDeltaNetGpPerHour: selectedImpact?.deltaNetGpPerHour ?? 0,
      isOverride:
        drop.eligibilityActive &&
        lootPrefs[drop.rowId] != null &&
        lootPrefs[drop.rowId] !== defaultDrop.pref,
      prayerXp: drop.prayerXp,
      alchValue: drop.alchValue,
      slotFrac: drop.slotFrac,
      expandedRows: expandedRows(drop),
      valueDetails: lootValueDetails(drop),
      historyContext: lootPriceHistoryContext(drop, lootPriceHistoryByItem)
    };
  });

  return {
    rows,
    defaultEffectiveNetGpPerHour: defaultTrip.effectiveNetGpPerHour,
    currentDeltaNetGpPerHour: currentTrip.effectiveNetGpPerHour - defaultTrip.effectiveNetGpPerHour,
    overrideCount: rows.filter((row) => row.isOverride).length
  };
}

function compareNumbers(left: number, right: number, direction: "asc" | "desc"): number {
  const leftFinite = Number.isFinite(left);
  const rightFinite = Number.isFinite(right);
  if (leftFinite !== rightFinite) return leftFinite ? -1 : 1;
  if (!leftFinite && !rightFinite) return 0;
  return direction === "asc" ? left - right : right - left;
}

function compareDenseRows(
  left: DenseCompareRowViewModel,
  right: DenseCompareRowViewModel,
  sort: DenseCompareSortState
): number {
  const leftValue = denseCompareSortValue[sort.key](left);
  const rightValue = denseCompareSortValue[sort.key](right);
  const directionMultiplier = sort.direction === "asc" ? 1 : -1;

  if (typeof leftValue === "string" || typeof rightValue === "string") {
    const primary = String(leftValue).localeCompare(String(rightValue)) * directionMultiplier;
    if (primary !== 0) return primary;
  } else {
    const primary = compareNumbers(leftValue, rightValue, sort.direction);
    if (primary !== 0) return primary;
  }

  return left.monsterName.localeCompare(right.monsterName);
}

function normalizedFilterQuery(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function stringMatchesFilter(value: string | undefined, query: string): boolean {
  return query.length === 0 || (value ?? "").toLocaleLowerCase().includes(query);
}

function collectDropSearchTerms(input: unknown, terms: string[] = []): string[] {
  if (Array.isArray(input)) {
    for (const child of input) collectDropSearchTerms(child, terms);
    return terms;
  }
  if (!input || typeof input !== "object") return terms;
  const record = input as Record<string, unknown>;

  for (const key of ["name", "key", "tag"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) terms.push(value);
  }

  const expanded = record._expand;
  if (Array.isArray(expanded)) {
    for (const child of expanded) collectDropSearchTerms(child, terms);
  }

  return terms;
}

function monsterMatchesDropFilter(
  gameData: GameDataSnapshot,
  monsterId: EntityId,
  query: string
): boolean {
  if (query.length === 0) return true;
  const monster = gameData.monsters[monsterId];
  if (!monster?.loot) return false;
  return monster.loot.some((drop) =>
    collectDropSearchTerms(drop).some((term) => stringMatchesFilter(term, query))
  );
}

function rowMatchesDenseFilters(
  row: DenseCompareRowViewModel,
  gameData: GameDataSnapshot,
  state: DenseCompareUiState
): boolean {
  const monsterQuery = normalizedFilterQuery(state.monsterFilter);
  const dropQuery = normalizedFilterQuery(state.dropFilter);
  const monsterMatches =
    stringMatchesFilter(row.monsterName, monsterQuery) ||
    stringMatchesFilter(row.monsterId, monsterQuery);
  const dropMatches = monsterMatchesDropFilter(gameData, row.monsterId, dropQuery);
  const relevanceMatches = state.showIrrelevant || !row.isIrrelevant;

  return monsterMatches && dropMatches && relevanceMatches;
}

function createDenseCompareRowMarkers(row: {
  hasCustomSetup: boolean;
  hasHighAlchOverride: boolean;
  hasOverheadOverride: boolean;
  isIrrelevant: boolean;
  isForcedVisible: boolean;
}): DenseCompareRowMarkerViewModel[] {
  const markers: DenseCompareRowMarkerViewModel[] = [];

  if (row.hasCustomSetup) {
    markers.push({ id: "custom", label: "custom", ariaLabel: "Custom setup" });
  }
  if (row.hasHighAlchOverride) {
    markers.push({ id: "alch", label: "alch", ariaLabel: "High alch override" });
  }
  if (row.hasOverheadOverride) {
    markers.push({ id: "overhead", label: "overhead", ariaLabel: "Kill overhead override" });
  }
  if (row.isIrrelevant) {
    markers.push({ id: "hidden", label: "hidden", ariaLabel: "Marked irrelevant" });
  }
  if (row.isForcedVisible) {
    markers.push({
      id: "target",
      label: "target",
      ariaLabel: "Current target kept visible"
    });
  }

  return markers;
}

const XP_SKILL_LABELS: Record<CombatXpKey, string> = {
  att: "Attack",
  str: "Strength",
  def: "Defence",
  rng: "Ranged",
  mag: "Magic",
  hp: "Hitpoints"
};

const XP_SKILL_ORDER: CombatXpKey[] = ["att", "str", "def", "rng", "mag", "hp"];

const PROTECTION_LABELS: Record<NonNullable<CombatSetupFormState["trip"]["protect"]>, string> = {
  none: "None",
  melee: "Protect from Melee",
  missiles: "Protect from Missiles",
  magic: "Protect from Magic"
};

function xpRoutingRow(input: {
  id: string;
  label: string;
  xpPerHour: number | null;
  status: XpRoutingRowStatus;
  note: string;
}): XpRoutingRowViewModel {
  return {
    ...input,
    value: input.xpPerHour == null ? "-" : formatNumber(input.xpPerHour),
    statusLabel:
      input.status === "modeled"
        ? "modeled"
        : input.status === "partial"
          ? "partial"
          : "not modeled"
  };
}

function createXpRoutingViewModel(input: { result: FullSimulationResult }): XpRoutingViewModel {
  const xp = input.result.xp;
  const trip = input.result.trip;
  const rows: XpRoutingRowViewModel[] = [
    xpRoutingRow({
      id: "player-combat",
      label: "Player combat XP/hr",
      xpPerHour: xp.playerEffectiveXpPerHour,
      status: "modeled",
      note: "Direct player combat XP contributing to effective XP/hr."
    })
  ];

  if (xp.cannonEffectiveXpPerHour > 0) {
    rows.push(
      xpRoutingRow({
        id: "cannon-ranged",
        label: "Cannon ranged XP/hr",
        xpPerHour: xp.cannonEffectiveXpPerHour,
        status: "modeled",
        note: "Separate cannon ranged XP row after trip efficiency."
      })
    );
  }

  for (const key of XP_SKILL_ORDER) {
    const xpPerKill = xp.combat.skillXpPerKill[key] ?? 0;
    if (xpPerKill <= 0) continue;
    rows.push(
      xpRoutingRow({
        id: `skill-${key}`,
        label: XP_SKILL_LABELS[key],
        xpPerHour: xpPerKill * trip.effectiveKph,
        status: "modeled",
        note: "Skill row from the rewrite-owned combat XP breakdown."
      })
    );
  }

  rows.push(
    xpRoutingRow({
      id: "prayer",
      label: "Prayer XP/hr",
      xpPerHour: xp.prayerXpPerHour,
      status: "modeled",
      note:
        xp.prayerXpPerHour > 0
          ? "Bury XP from current loot actions after trip efficiency."
          : "No buryable bone XP in the current loot actions."
    }),
    xpRoutingRow({
      id: "alch",
      label: "Magic (alch) XP/hr",
      xpPerHour: xp.magicAlchXpPerHour,
      status: "modeled",
      note:
        trip.alchCastsPerKill > 0
          ? `${formatNumber(trip.alchCastsPerKill, 2)} alch casts/kill at ${HIGH_ALCH_MAGIC_XP_PER_CAST} Magic XP/cast after trip efficiency.`
          : "No in-trip high-alch casts in the current loot model."
    })
  );

  return {
    effectiveXpPerHour: xp.effectiveXpPerHour,
    totalXpPerHour: xp.totalXpPerHour,
    effectiveXpPerHourLabel: formatNumber(xp.effectiveXpPerHour),
    totalXpPerHourLabel: formatNumber(xp.totalXpPerHour),
    rows
  };
}

function statsSourceStatusLabel(status: StatsSourceBreakdownStatus): string {
  if (status === "modeled") return "modeled";
  if (status === "partial") return "partial";
  if (status === "not-modeled") return "not modeled";
  return "inactive";
}

function optionalStatsNumber(value: number | null, digits = 0): string {
  return value == null ? "-" : formatNumber(value, digits);
}

function optionalStatsPercent(value: number | null): string {
  return value == null ? "-" : `${formatNumber(value * 100, 1)}%`;
}

function statsSourceBreakdownRow(
  input: Omit<
    StatsSourceBreakdownRowViewModel,
    | "statusLabel"
    | "dpsLabel"
    | "xpPerHourLabel"
    | "hitChanceLabel"
    | "maxHitLabel"
    | "supplyCostPerHourLabel"
    | "supplyCostPerKillLabel"
  >
): StatsSourceBreakdownRowViewModel {
  return {
    ...input,
    statusLabel: statsSourceStatusLabel(input.status),
    dpsLabel: optionalStatsNumber(input.dps, 2),
    xpPerHourLabel: optionalStatsNumber(input.xpPerHour),
    hitChanceLabel: optionalStatsPercent(input.hitChance),
    maxHitLabel: optionalStatsNumber(input.maxHit),
    supplyCostPerHourLabel: optionalStatsNumber(input.supplyCostPerHour),
    supplyCostPerKillLabel: optionalStatsNumber(input.supplyCostPerKill)
  };
}

function statsSourceMetric(
  id: string,
  label: string,
  numericValue: number | null,
  value: string
): StatsSourceDetailMetricViewModel {
  return {
    id,
    label,
    numericValue,
    value
  };
}

function statsSourceBaseMetrics(
  row: StatsSourceBreakdownRowViewModel
): StatsSourceDetailMetricViewModel[] {
  const metrics = [
    statsSourceMetric("dps", "DPS", row.dps, row.dpsLabel),
    statsSourceMetric("xp-hr", "XP/hr", row.xpPerHour, row.xpPerHourLabel),
    statsSourceMetric("hit-chance", "Hit chance", row.hitChance, row.hitChanceLabel),
    statsSourceMetric("max-hit", "Max hit", row.maxHit, row.maxHitLabel),
    statsSourceMetric(
      "supply-cost-hour",
      "Supply cost/hr",
      row.supplyCostPerHour,
      row.supplyCostPerHourLabel
    ),
    statsSourceMetric(
      "supply-cost-kill",
      "Supply cost/kill",
      row.supplyCostPerKill,
      row.supplyCostPerKillLabel
    )
  ];

  if (row.dpsGainPct != null) {
    metrics.splice(
      1,
      0,
      statsSourceMetric(
        "dps-gain",
        "DPS gain",
        row.dpsGainPct,
        `${formatNumber(row.dpsGainPct, 1)}%`
      )
    );
  }

  return metrics;
}

function statsSourceDetail(input: {
  row: StatsSourceBreakdownRowViewModel;
  metrics?: StatsSourceDetailMetricViewModel[];
  notes?: readonly string[];
  warnings?: readonly CalculationWarningViewModel[];
  histogram?: HitDistributionViewModel | null;
  histogramScopeLabel?: string | null;
}): StatsSourceDetailViewModel {
  return {
    id: input.row.id,
    label: input.row.label,
    status: input.row.status,
    statusLabel: input.row.statusLabel,
    metrics: input.metrics ?? statsSourceBaseMetrics(input.row),
    notes: [...(input.notes ?? input.row.notes)],
    warnings: [...(input.warnings ?? [])],
    histogram: input.histogram ?? null,
    histogramScopeLabel: input.histogramScopeLabel ?? null
  };
}

function createStatsSourceBreakdownViewModel(input: {
  form: CombatSetupFormState;
  result: FullSimulationResult;
  specialWarnings: readonly CalculationWarningViewModel[];
  moneyWarnings: readonly CalculationWarningViewModel[];
  hitDistribution: HitDistributionViewModel;
}): StatsSourceBreakdownViewModel {
  const combat = input.result.combat;
  const trip = input.result.trip;
  const cannon = trip.cannon;
  const cannonSupplyCostPerKill = cannon?.ballCostPerKill ?? 0;
  const normalSupplyCostPerKill = Math.max(
    0,
    trip.supply.supplyCostPerKill - cannonSupplyCostPerKill
  );
  const normalSupplyCostPerHour = normalSupplyCostPerKill * trip.effectiveKph;
  const special = combat.specialAttack;
  const specialDps = special ? special.dpsWithSpec - special.dpsBase : null;
  const dbaBoostSpecialActive =
    input.form.combatStyle === "melee" && input.form.boosts.includes("dba_spec");
  const specialStatus: StatsSourceBreakdownStatus = special
    ? input.specialWarnings.length > 0
      ? "partial"
      : "modeled"
    : input.form.combatStyle === "magic"
      ? "not-modeled"
      : "inactive";
  const inactiveSpecialNote = dbaBoostSpecialActive
    ? "DBA special boost is modeled as a boost, not a DPS special attack."
    : input.form.combatStyle === "magic"
      ? "Magic DPS special attacks are not modeled yet."
      : "No supported melee/ranged DPS special selected.";
  const specialNotes =
    special == null
      ? [inactiveSpecialNote]
      : [
          `${formatNumber(special.specsPerHour, 1)} specs/hr from the current special attack model.`,
          "Special attack XP is included in player combat XP/hr; separate special XP is not modeled.",
          ...(input.specialWarnings.length > 0
            ? input.specialWarnings.map((warning) => warning.message)
            : ["DPS gain is shown as modeled special DPS above the normal attack baseline."])
        ];
  const cannonStatus: StatsSourceBreakdownStatus = cannon
    ? cannon.idle
      ? "inactive"
      : "modeled"
    : "inactive";
  const specialHistogram = special
    ? createHitDistributionFromValues({
        hitChance: special.hitChance,
        averageHit: special.hits > 0 ? special.expPerSpec / special.hits : Number.NaN,
        maxHit: special.maxHit,
        peakMaxHit: special.maxHit
      })
    : null;
  const cannonHistogram =
    cannon && !cannon.idle && cannon.ballsPerSec > 0
      ? createHitDistributionFromValues({
          hitChance: combat.hitChance,
          averageHit: cannon.cannonDps / cannon.ballsPerSec,
          maxHit: cannon.maxBall,
          peakMaxHit: cannon.maxBall
        })
      : null;
  const normalRow = statsSourceBreakdownRow({
    id: "normal-attack",
    label: "Normal attack",
    status: "modeled",
    dps: input.result.rates.dps,
    dpsDetail: special ? "Baseline before special attacks" : null,
    dpsGainPct: null,
    xpPerHour: input.result.xp.playerEffectiveXpPerHour,
    hitChance: combat.hitChance,
    maxHit: combat.maxHit,
    supplyCostPerHour: normalSupplyCostPerHour,
    supplyCostPerKill: normalSupplyCostPerKill,
    notes: ["Base player attack after trip efficiency and current supply model."]
  });
  const specialRow = statsSourceBreakdownRow({
    id: "special-attack",
    label: "Special attack",
    status: specialStatus,
    dps: specialDps,
    dpsDetail: special ? `DPS gain ${formatNumber(special.dpsGainPct, 1)}%` : null,
    dpsGainPct: special?.dpsGainPct ?? null,
    xpPerHour: null,
    hitChance: special?.hitChance ?? null,
    maxHit: special?.maxHit ?? null,
    supplyCostPerHour: null,
    supplyCostPerKill: null,
    notes: specialNotes
  });
  const cannonRow = statsSourceBreakdownRow({
    id: "cannon",
    label: "Cannon",
    status: cannonStatus,
    dps: cannon?.cannonDps ?? null,
    dpsDetail: cannon ? `${formatNumber(cannon.activeFrac * 100, 1)}% active` : null,
    dpsGainPct: null,
    xpPerHour: cannon ? input.result.xp.cannonEffectiveXpPerHour : null,
    hitChance: cannon ? combat.hitChance : null,
    maxHit: cannon?.maxBall ?? null,
    supplyCostPerHour: cannon ? cannonSupplyCostPerKill * trip.effectiveKph : null,
    supplyCostPerKill: cannon ? cannonSupplyCostPerKill : null,
    notes: cannon
      ? [
          cannon.idle
            ? "Idle: this spot is too sparse for the cannon to fire."
            : `Cannon overlay: ${formatNumber(cannon.effTargets, 1)} effective targets, ${formatNumber(
                cannon.ballsPerHour
              )} balls/hr before trip efficiency.`,
          cannon.respawnBound
            ? "Respawn-bound cannon overlay."
            : "Cannon overlay is not respawn-bound."
        ]
      : ["Cannon is off for the current monster."]
  });
  const specialMetrics = statsSourceBaseMetrics(specialRow);
  if (special) {
    specialMetrics.push(
      statsSourceMetric("spec-weapon", "Spec weapon", null, special.weaponName),
      statsSourceMetric(
        "dps-with-spec",
        "DPS with spec",
        special.dpsWithSpec,
        formatNumber(special.dpsWithSpec, 2)
      ),
      statsSourceMetric(
        "specs-hr",
        "Specs/hr",
        special.specsPerHour,
        formatNumber(special.specsPerHour, 1)
      ),
      statsSourceMetric("hits", "Hits", special.hits, formatNumber(special.hits))
    );
  }
  const cannonMetrics = statsSourceBaseMetrics(cannonRow);
  if (cannon) {
    const sparseState = cannon.idle ? "Idle" : cannon.respawnBound ? "Respawn-bound" : "Active";
    cannonMetrics.push(
      statsSourceMetric(
        "effective-targets",
        "Effective targets",
        cannon.effTargets,
        formatNumber(cannon.effTargets, 1)
      ),
      statsSourceMetric(
        "active-fraction",
        "Active time",
        cannon.activeFrac,
        `${formatNumber(cannon.activeFrac * 100, 1)}%`
      ),
      statsSourceMetric(
        "balls-hr",
        "Balls/hr",
        cannon.ballsPerHour,
        formatNumber(cannon.ballsPerHour)
      ),
      statsSourceMetric(
        "balls-kill",
        "Balls/kill",
        cannon.ballsPerKill,
        formatNumber(cannon.ballsPerKill, 2)
      ),
      statsSourceMetric(
        "ball-price",
        "Ball price",
        cannon.ballPrice,
        formatNumber(cannon.ballPrice)
      ),
      statsSourceMetric(
        "cannon-ranged-xp-hr",
        "Cannon Ranged XP/hr",
        cannon.rangedXpPerHour,
        formatNumber(cannon.rangedXpPerHour)
      ),
      statsSourceMetric(
        "ball-cost-hour",
        "Ball cost/hr",
        cannon.ballCostPerHour,
        formatNumber(cannon.ballCostPerHour)
      ),
      statsSourceMetric(
        "ball-cost-kill",
        "Ball cost/kill",
        cannon.ballCostPerKill,
        formatNumber(cannon.ballCostPerKill)
      ),
      statsSourceMetric(
        "cannonballs-trip",
        "Cannonballs/trip",
        cannon.ballsPerTrip ?? null,
        cannon.ballsPerTrip == null ? "-" : formatNumber(cannon.ballsPerTrip)
      ),
      statsSourceMetric("sparse-state", "Sparse state", null, sparseState),
      statsSourceMetric("idle", "Idle", null, cannon.idle ? "Yes" : "No"),
      statsSourceMetric("respawn-bound", "Respawn-bound", null, cannon.respawnBound ? "Yes" : "No")
    );
  }

  return {
    rows: [normalRow, specialRow, cannonRow],
    details: [
      statsSourceDetail({
        row: normalRow,
        warnings: input.moneyWarnings,
        histogram: input.hitDistribution,
        histogramScopeLabel: "Per normal attack"
      }),
      statsSourceDetail({
        row: specialRow,
        metrics: specialMetrics,
        warnings: input.specialWarnings,
        histogram: specialHistogram,
        histogramScopeLabel: specialHistogram ? "Per special hit" : null
      }),
      statsSourceDetail({
        row: cannonRow,
        metrics: cannonMetrics,
        warnings: cannon ? input.moneyWarnings : [],
        histogram: cannonHistogram,
        histogramScopeLabel: cannonHistogram ? "Per fired cannonball" : null
      })
    ]
  };
}

function finiteMinutesLabel(minutes: number): string {
  return Number.isFinite(minutes) ? `${formatNumber(minutes, 1)}m` : "unlimited";
}

function finiteSecondsLabel(seconds: number): string {
  return Number.isFinite(seconds) ? `${formatNumber(seconds)}s` : "unlimited";
}

function statsTripRow(input: {
  id: string;
  label: string;
  value: string;
  numericValue?: number | null;
  note?: string;
  tone?: StatsTripBankingSummaryRowViewModel["tone"];
}): StatsTripBankingSummaryRowViewModel {
  return {
    id: input.id,
    label: input.label,
    value: input.value,
    numericValue: input.numericValue ?? null,
    note: input.note ?? "",
    tone: input.tone ?? "default"
  };
}

function safespotStateLabel(form: CombatSetupFormState, trip: TripLootSupplyResult): string {
  if (trip.trip.incoming.safespot) return form.trip.safespot == null ? "Auto safespot" : "On";
  return form.trip.safespot === false ? "Off" : "No safespot";
}

function protectionStateLabel(form: CombatSetupFormState, trip: TripLootSupplyResult): string {
  const requested = PROTECTION_LABELS[form.trip.protect ?? "none"];
  if (trip.trip.incoming.protected) return `${requested} active`;
  return requested === "None" ? "None" : `${requested} not blocking`;
}

function createTripBankingSummaryViewModel(
  form: CombatSetupFormState,
  trip: TripLootSupplyResult
): StatsTripBankingSummaryViewModel {
  const currentBound = trip.trip.scarce.respawnBound ? "respawn-bound" : trip.trip.bound;

  return {
    rows: [
      statsTripRow({
        id: "kills-trip",
        label: "Kills/trip",
        value: formatNumber(trip.trip.killsPerTrip, 1),
        numericValue: trip.trip.killsPerTrip
      }),
      statsTripRow({
        id: "trip-length",
        label: "Trip length",
        value: finiteMinutesLabel(trip.trip.tripMinutes),
        numericValue: trip.trip.tripMinutes
      }),
      statsTripRow({
        id: "bank-time",
        label: "Bank time",
        value: finiteSecondsLabel(trip.trip.bankSeconds),
        numericValue: trip.trip.bankSeconds
      }),
      statsTripRow({
        id: "effective-kills-hour",
        label: "Effective kills/hr",
        value: formatNumber(trip.effectiveKph),
        numericValue: trip.effectiveKph,
        tone: "teal"
      }),
      statsTripRow({
        id: "supply-kill",
        label: "Supply/kill",
        value: formatNumber(trip.supply.supplyCostPerKill),
        numericValue: trip.supply.supplyCostPerKill,
        tone: "gold"
      }),
      statsTripRow({
        id: "net-gp-hour",
        label: "Net GP/hr",
        value: formatNumber(trip.effectiveNetGpPerHour),
        numericValue: trip.effectiveNetGpPerHour,
        note: "After trip and banking efficiency.",
        tone: "gold"
      }),
      statsTripRow({
        id: "trip-bound",
        label: "Current trip bound",
        value: currentBound,
        note: trip.trip.scarce.respawnBound
          ? "Scarce/respawn cap limits effective rate."
          : "Selected by the current Trip model."
      }),
      statsTripRow({
        id: "safespot-state",
        label: "Safespot",
        value: safespotStateLabel(form, trip),
        note: trip.trip.incoming.safespotAuto ? "Auto-derived from combat style or target." : ""
      }),
      statsTripRow({
        id: "protection-state",
        label: "Protection prayer",
        value: protectionStateLabel(form, trip),
        note: trip.trip.incoming.protected ? "Incoming damage blocked by protection prayer." : ""
      })
    ]
  };
}

function createHitDistributionFromValues(input: {
  hitChance: number;
  averageHit: number;
  maxHit: number;
  peakMaxHit: number;
}): HitDistributionViewModel | null {
  if (
    !Number.isFinite(input.hitChance) ||
    !Number.isFinite(input.averageHit) ||
    !Number.isFinite(input.maxHit) ||
    !Number.isFinite(input.peakMaxHit) ||
    input.averageHit < 0 ||
    input.maxHit < 0 ||
    input.peakMaxHit < 0
  ) {
    return null;
  }
  const distribution = createHitDistribution(input);
  const maxProbability = Math.max(...distribution.buckets.map((bucket) => bucket.probability), 0);

  return {
    hitChance: distribution.hitChance,
    averageHit: distribution.averageHit,
    maxHit: distribution.maxHit,
    peakMaxHit: distribution.peakMaxHit,
    probabilityTotal: distribution.probabilityTotal,
    hitChanceLabel: `${formatNumber(distribution.hitChance * 100, 1)}%`,
    averageHitLabel: formatNumber(distribution.averageHit, 2),
    maxHitLabel: formatNumber(distribution.maxHit, 1),
    buckets: distribution.buckets.map((bucket) => {
      const percentLabel = `${formatNumber(bucket.probability * 100, 1)}%`;
      const damageText = bucket.isMiss
        ? "miss or zero damage"
        : bucket.minDamage === bucket.maxDamage
          ? `${bucket.minDamage} damage`
          : `${bucket.minDamage} to ${bucket.maxDamage} damage`;
      return {
        id: bucket.id,
        label: bucket.label,
        ariaLabel: `${damageText}: ${percentLabel}${bucket.isMaxHit ? ", max hit bucket" : ""}`,
        probability: bucket.probability,
        percentLabel,
        widthPercent:
          maxProbability > 0 ? Math.max(3, (bucket.probability / maxProbability) * 100) : 0,
        isMiss: bucket.isMiss,
        isMaxHit: bucket.isMaxHit
      };
    })
  };
}

function createHitDistributionViewModel(
  combat: ReturnType<typeof simulateCombat>
): HitDistributionViewModel {
  const distribution = createHitDistributionFromValues({
    hitChance: combat.hitChance,
    averageHit: combat.avgHit,
    maxHit: combat.maxHit,
    peakMaxHit: combat.peakMaxHit
  });
  if (!distribution) {
    throw new Error("Current combat result has invalid hit distribution values.");
  }
  return distribution;
}

function finiteNumberOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function positiveFiniteNumberOrNull(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatOptionalNumber(value: number | null, digits = 0): string {
  return value == null ? "-" : formatNumber(value, digits);
}

function formatOptionalPercent(value: number | null): string {
  return value == null ? "-" : `${formatNumber(value * 100, 1)}%`;
}

function formatOptionalDuration(value: number | null): string {
  if (value == null) return "-";
  if (value < 60) return `${formatNumber(value, 1)}s`;
  const minutes = Math.floor(value / 60);
  const remainingSeconds = Math.round(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function statsCombatRollMetric(
  input: StatsCombatRollMetricViewModel
): StatsCombatRollMetricViewModel {
  return input;
}

export function createStatsCombatRollDetailViewModel(input: {
  combat: ReturnType<typeof simulateCombat>;
  trip: TripLootSupplyResult;
  hitDistribution: HitDistributionViewModel;
}): StatsCombatRollDetailViewModel {
  const effectiveAccuracy = finiteNumberOrNull(input.combat.debug.effectiveAccuracy);
  const effectiveDamage = finiteNumberOrNull(input.combat.debug.effectiveDamage);
  const attackRoll = finiteNumberOrNull(input.combat.attackRoll);
  const defenceRoll = finiteNumberOrNull(input.combat.defenceRoll);
  const hitChance = finiteNumberOrNull(input.combat.hitChance);
  const maxHit = finiteNumberOrNull(input.combat.maxHit);
  const averageHit = finiteNumberOrNull(input.hitDistribution.averageHit);
  const attackSpeedSec = positiveFiniteNumberOrNull(input.combat.attackSpeedSec);
  const attackTicks = positiveFiniteNumberOrNull(input.combat.attackTicks);
  const ttkSec = positiveFiniteNumberOrNull(input.combat.ttkSec);
  const killsPerHour = positiveFiniteNumberOrNull(input.trip.killsPerHour);
  const gpPerKill = finiteNumberOrNull(input.trip.gpPerKill);

  const metrics: StatsCombatRollMetricViewModel[] = [
    statsCombatRollMetric({
      id: "effective-accuracy",
      label: "Effective accuracy",
      value: formatOptionalNumber(effectiveAccuracy),
      numericValue: effectiveAccuracy,
      note: "Normal attack roll input after level, stance, prayer, boost and accuracy bonus.",
      tone: "teal"
    }),
    statsCombatRollMetric({
      id: "effective-damage",
      label: "Effective damage",
      value: formatOptionalNumber(effectiveDamage),
      numericValue: effectiveDamage,
      note: "Normal attack damage input after level, stance, prayer, boost and damage bonus.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "attack-roll",
      label: "Attack roll",
      value: formatOptionalNumber(attackRoll),
      numericValue: attackRoll,
      note: "Normal attack roll before comparing against the active monster defence roll.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "defence-roll",
      label: "Defence roll",
      value: formatOptionalNumber(defenceRoll),
      numericValue: defenceRoll,
      note: "Monster defence roll for the current active defence type.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "hit-chance",
      label: "Hit chance",
      value: formatOptionalPercent(hitChance),
      numericValue: hitChance,
      note: "Normal attack hit probability from the current combat result.",
      tone: "teal"
    }),
    statsCombatRollMetric({
      id: "max-hit",
      label: "Max hit",
      value: formatOptionalNumber(maxHit, 1),
      numericValue: maxHit,
      note: "Normal attack max hit; special and cannon max hits are shown in source details.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "average-hit",
      label: "Average hit",
      value: formatOptionalNumber(averageHit, 2),
      numericValue: averageHit,
      note: "Normal attack average hit from the current hit distribution model.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "attack-speed",
      label: "Attack speed",
      value: attackSpeedSec == null ? "-" : `${formatNumber(attackSpeedSec, 1)}s`,
      numericValue: attackSpeedSec,
      note: "Normal attack seconds per swing.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "attack-cycle",
      label: "Attack cycle",
      value: attackTicks == null ? "-" : `${formatNumber(attackTicks, 1)} ticks`,
      numericValue: attackTicks,
      note: "Normal attack cycle in game ticks.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "ttk",
      label: "TTK",
      value: formatOptionalDuration(ttkSec),
      numericValue: ttkSec,
      note: "Current combat result time to kill before Trip banking and scarce-spot efficiency.",
      tone: "gold"
    }),
    statsCombatRollMetric({
      id: "kills-per-hour",
      label: "Kills/hr",
      value: formatOptionalNumber(killsPerHour),
      numericValue: killsPerHour,
      note: "Current whole-result kill rate after Trip and banking effects.",
      tone: "gold"
    }),
    statsCombatRollMetric({
      id: "gp-per-kill",
      label: "GP/kill",
      value: formatOptionalNumber(gpPerKill),
      numericValue: gpPerKill,
      note: "Current loot/economy result per kill before hourly trip efficiency.",
      tone: "gold"
    })
  ];
  const hasFallback = metrics.some((metric) => metric.numericValue == null);

  return {
    status: hasFallback ? "partial" : "modeled",
    statusLabel: hasFallback ? "partial" : "modeled",
    metrics,
    notes: [
      "Roll and hit metrics describe the normal player attack.",
      "TTK, kills/hr and GP/kill mirror the current composed simulation result.",
      ...(hasFallback
        ? ["Some values are unavailable from the current result and are shown as fallbacks."]
        : [])
    ]
  };
}

function finitePositiveMax(values: number[]): number {
  return Math.max(0, ...values.filter((value) => Number.isFinite(value) && value > 0));
}

function scalePercent(value: number, maxValue: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(maxValue) || maxValue <= 0) return 0;
  return Math.max(0, Math.min(100, (value / maxValue) * 100));
}

export function createDenseCompareScaleModel(
  rows: DenseCompareRowViewModel[]
): DenseCompareScaleViewModel {
  const maxXp = finitePositiveMax(rows.map((row) => row.xpPerHour));
  const maxPositiveNetGp = finitePositiveMax(rows.map((row) => row.netGpPerHour));
  const maxNegativeNetGp = finitePositiveMax(
    rows.map((row) => (row.netGpPerHour < 0 ? Math.abs(row.netGpPerHour) : 0))
  );

  return Object.fromEntries(
    rows.map((row) => {
      const netTone: DenseCompareScaleTone =
        row.netGpPerHour > 0 ? "positive" : row.netGpPerHour < 0 ? "negative" : "neutral";
      const netWidth =
        row.netGpPerHour < 0
          ? scalePercent(Math.abs(row.netGpPerHour), maxNegativeNetGp)
          : scalePercent(row.netGpPerHour, maxPositiveNetGp);

      return [
        row.monsterId,
        {
          xpPerHour: {
            value: row.xpPerHour,
            widthPercent: scalePercent(row.xpPerHour, maxXp),
            tone: row.xpPerHour > 0 ? "positive" : "neutral",
            ariaLabel: `${row.monsterName} XP/hr ${formatNumber(row.xpPerHour)}, scaled to visible rows`
          },
          netGpPerHour: {
            value: row.netGpPerHour,
            widthPercent: netWidth,
            tone: netTone,
            ariaLabel: `${row.monsterName} net GP/hr ${formatNumber(row.netGpPerHour)}, ${
              netTone === "negative" ? "loss" : netTone === "positive" ? "profit" : "break-even"
            } scaled to visible rows`
          }
        }
      ];
    })
  );
}

export function createSimulationViewModel(
  form: CombatSetupFormState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefs: Record<string, LootAction | string | undefined> = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {},
  options: SimulationViewModelOptions = {}
): SimulationViewModel {
  const request = formToSimulationRequest(form, context.gameData);
  const fullInput = fullSimulationInputFor(form, request, cannonByMonster, lootSettingsByMonster);
  const fullResult = simulateFullSimulation({ ...fullInput, lootPrefs }, context);
  const combat = fullResult.combat;
  const trip = fullResult.trip;
  const tripInput: TripLootSupplyInput = { ...fullInput, combat };
  const playerEffectiveXpPerHour = fullResult.xp.playerEffectiveXpPerHour;
  const cannonEffectiveXpPerHour = fullResult.xp.cannonEffectiveXpPerHour;
  const effectiveXpPerHour = fullResult.xp.effectiveXpPerHour;
  const totalXpPerHour = fullResult.xp.totalXpPerHour;

  const lootRows =
    options.includeLootRows === false
      ? {
          rows: [],
          defaultEffectiveNetGpPerHour: fullResult.rates.effectiveNetGpPerHour,
          currentDeltaNetGpPerHour: 0,
          overrideCount: 0
        }
      : createLootRows(tripInput, context, trip, lootPrefs, options.lootPriceHistoryByItem);
  const calculationWarnings = calculationWarningViewModels(fullResult.warnings);
  const specialWarnings = calculationWarnings.filter((warning) =>
    SPECIAL_WARNING_CODES.has(warning.code)
  );
  const moneyWarnings = calculationWarnings.filter((warning) =>
    MONEY_WARNING_CODES.has(warning.code)
  );
  const hitDistribution = createHitDistributionViewModel(combat);
  const setupRequirements = createSetupRequirementSummaryViewModel(request, context);
  const activeAssumptions = createActiveAssumptionsSummaryViewModel({
    form,
    request,
    context,
    trip,
    cannonByMonster,
    lootPrefs,
    lootSettingsByMonster,
    lootOverrideCount: lootRows.overrideCount,
    setupRequirements,
    specialWarnings,
    moneyWarnings,
    options: options.activeAssumptions
  });

  return {
    request,
    result: fullResult,
    combat,
    hitDistribution,
    combatRollDetail: createStatsCombatRollDetailViewModel({
      combat,
      trip,
      hitDistribution
    }),
    xpRouting: createXpRoutingViewModel({
      result: fullResult
    }),
    tripBankingSummary: createTripBankingSummaryViewModel(form, trip),
    statsSourceBreakdown: createStatsSourceBreakdownViewModel({
      form,
      result: fullResult,
      specialWarnings,
      moneyWarnings,
      hitDistribution
    }),
    setupRequirements,
    activeAssumptions,
    monsterCard: monsterCardFromResult(request, context, combat, options.monsterCard),
    trip,
    playerEffectiveXpPerHour,
    cannonEffectiveXpPerHour,
    effectiveXpPerHour,
    totalXpPerHour,
    warnings: calculationWarnings.map((warning) => warning.message),
    calculationWarnings,
    specialWarnings,
    moneyWarnings,
    topLoot: trip.lootBreakdown
      .filter((drop) => drop.evGp > 0 || drop.prayerXp > 0)
      .sort((left, right) => right.evGp - left.evGp)
      .slice(0, 8)
      .map((drop) => ({
        name: drop.name,
        pref: drop.pref,
        evGp: drop.evGp,
        price: drop.price,
        prayerXp: drop.prayerXp
      })),
    lootRows: lootRows.rows,
    lootSummary: {
      defaultEffectiveNetGpPerHour: lootRows.defaultEffectiveNetGpPerHour,
      currentDeltaNetGpPerHour: lootRows.currentDeltaNetGpPerHour,
      overrideCount: lootRows.overrideCount,
      valueComposition: createLootValueComposition(trip)
    }
  };
}

type DuelComparisonBaseRowViewModel = Omit<
  DuelComparisonRowViewModel,
  "deltas" | "best" | "setupDiff"
>;

function gpPerXpValue(effectiveNetGpPerHour: number, effectiveXpPerHour: number): number | null {
  return effectiveXpPerHour > 0 ? effectiveNetGpPerHour / effectiveXpPerHour : null;
}

function duelLoadoutLabel(vm: SimulationViewModel): string {
  const overview = vm.monsterCard.setupOverview;
  const parts = [overview.combatStyle, overview.weapon.label];
  if (overview.ammo) parts.push(overview.ammo.label);
  if (overview.spell) parts.push(overview.spell.label);
  if (overview.prayerIds.length > 0) {
    parts.push(`${overview.prayerIds.length} prayer${overview.prayerIds.length === 1 ? "" : "s"}`);
  }
  if (overview.boostIds.length > 0) {
    parts.push(`${overview.boostIds.length} boost${overview.boostIds.length === 1 ? "" : "s"}`);
  }
  if (overview.sustained) parts.push("sustained");
  return parts.join(" · ");
}

function duelBaseRowFromSimulation(
  id: string,
  source: DuelComparisonRowSource,
  snapshotId: EntityId | null,
  name: string,
  vm: SimulationViewModel
): DuelComparisonBaseRowViewModel {
  const result = vm.result;
  return {
    id,
    snapshotId,
    source,
    name,
    monsterId: result.request.monsterId,
    monsterName: vm.monsterCard.monsterName,
    combatStyle: result.request.combatStyle,
    loadoutLabel: duelLoadoutLabel(vm),
    maxHit: result.combat.maxHit,
    dps: result.rates.effectiveDps,
    hitChance: result.combat.hitChance,
    ttkSec: result.rates.ttkSec,
    killsPerTrip: result.trip.trip.killsPerTrip,
    killsPerHour: result.rates.killsPerHour,
    effectiveXpPerHour: result.xp.effectiveXpPerHour,
    effectiveNetGpPerHour: result.rates.effectiveNetGpPerHour,
    gpPerXp: gpPerXpValue(result.rates.effectiveNetGpPerHour, result.xp.effectiveXpPerHour),
    supplyCostPerHour: result.rates.supplyCostPerKill * result.rates.effectiveKph,
    bound: result.trip.trip.bound,
    warnings: vm.warnings
  };
}

const DUEL_DIFF_CATEGORY_LABELS: Record<DuelSetupDiffCategoryId, string> = {
  combat: "Combat",
  levels: "Levels",
  loadout: "Loadout",
  gear: "Gear",
  "prayers-boosts": "Prayers and boosts",
  "special-overrides": "Special and overrides",
  trip: "Trip"
};

const DUEL_LEVEL_LABELS: Record<keyof CombatSetupFormState["levels"], string> = {
  attack: "Attack",
  strength: "Strength",
  defence: "Defence",
  hitpoints: "Hitpoints",
  ranged: "Ranged",
  magic: "Magic",
  prayer: "Prayer"
};

const DUEL_TRIP_LABELS: Record<keyof CombatSetupFormState["trip"], string> = {
  foodKey: "Food",
  teleport: "Teleport",
  bankSeconds: "Bank time",
  potionSets: "Boost vials",
  potionDoses: "Boost doses",
  singleDose: "Single-dose boosts",
  dbaRestore: "DBA restore",
  prayerMode: "Prayer restore",
  alching: "High alch",
  recoverAmmo: "Recover ammo",
  runeSlots: "Rune slots",
  antifire: "Antifire",
  antipoison: "Antipoison",
  safespot: "Safespot",
  protect: "Protection prayer",
  recoilRings: "Recoil rings",
  foodCount: "Food count",
  foodPerKillOverride: "Food per kill",
  prayerPotionSets: "Prayer potion vials",
  prayerPotionDoses: "Prayer potion doses",
  altarSeconds: "Altar time",
  scarceSpot: "Scarce spot",
  targetsAtSpot: "Targets at spot",
  respawnSeconds: "Respawn time"
};

function duelHumanizeId(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function duelBooleanLabel(value: boolean): string {
  return value ? "On" : "Off";
}

function duelOptionalValue(value: string | number | boolean | null): string {
  if (value == null) return "Auto";
  if (typeof value === "boolean") return duelBooleanLabel(value);
  return String(value);
}

function duelSelectionLabel(
  values: readonly string[],
  options: ReadonlyArray<{ id: string; label: string }>
): string {
  const labels = values
    .filter((value) => value !== "none")
    .map((value) => options.find((option) => option.id === value)?.label ?? duelHumanizeId(value));
  return labels.length > 0 ? labels.join(", ") : "None";
}

function duelItemLabel(
  context: SimulationContext,
  kind: "weapon" | "ammo" | "spell",
  itemId: EntityId
): string {
  if (itemId === "none") return "None";
  if (kind === "weapon") return context.gameData.weapons[itemId]?.name ?? duelHumanizeId(itemId);
  if (kind === "ammo") return context.gameData.ammo[itemId]?.name ?? duelHumanizeId(itemId);
  return context.gameData.spells[itemId]?.name ?? duelHumanizeId(itemId);
}

function duelGearLabel(context: SimulationContext, slot: EquipmentSlot, itemId: EntityId): string {
  if (itemId === "none") return "None";
  return context.gameData.equipment[slot]?.[itemId]?.name ?? duelHumanizeId(itemId);
}

function createDuelSetupDiffViewModel(
  liveForm: CombatSetupFormState,
  snapshotForm: CombatSetupFormState,
  context: SimulationContext
): DuelSetupDiffViewModel {
  const groups = new Map<DuelSetupDiffCategoryId, DuelSetupDiffItemViewModel[]>();
  const add = (
    category: DuelSetupDiffCategoryId,
    id: string,
    label: string,
    liveRaw: unknown,
    snapshotRaw: unknown,
    liveValue = duelOptionalValue(liveRaw as string | number | boolean | null),
    snapshotValue = duelOptionalValue(snapshotRaw as string | number | boolean | null)
  ) => {
    if (JSON.stringify(liveRaw) === JSON.stringify(snapshotRaw)) return;
    const items = groups.get(category) ?? [];
    items.push({ id, label, liveValue, snapshotValue });
    groups.set(category, items);
  };

  add(
    "combat",
    "combat-style",
    "Combat style",
    liveForm.combatStyle,
    snapshotForm.combatStyle,
    duelHumanizeId(liveForm.combatStyle),
    duelHumanizeId(snapshotForm.combatStyle)
  );
  add(
    "combat",
    "attack-style",
    "Attack style",
    liveForm.styleId,
    snapshotForm.styleId,
    duelHumanizeId(liveForm.styleId),
    duelHumanizeId(snapshotForm.styleId)
  );

  for (const skill of Object.keys(DUEL_LEVEL_LABELS) as Array<keyof typeof DUEL_LEVEL_LABELS>) {
    add(
      "levels",
      `level-${skill}`,
      DUEL_LEVEL_LABELS[skill],
      liveForm.levels[skill],
      snapshotForm.levels[skill]
    );
  }

  add(
    "loadout",
    "weapon",
    "Weapon",
    liveForm.weaponId,
    snapshotForm.weaponId,
    duelItemLabel(context, "weapon", liveForm.weaponId),
    duelItemLabel(context, "weapon", snapshotForm.weaponId)
  );
  if (liveForm.combatStyle === "ranged" || snapshotForm.combatStyle === "ranged") {
    add(
      "loadout",
      "ammo",
      "Ammo",
      liveForm.ammoId,
      snapshotForm.ammoId,
      duelItemLabel(context, "ammo", liveForm.ammoId),
      duelItemLabel(context, "ammo", snapshotForm.ammoId)
    );
  }
  if (liveForm.combatStyle === "magic" || snapshotForm.combatStyle === "magic") {
    add(
      "loadout",
      "spell",
      "Spell",
      liveForm.spellId,
      snapshotForm.spellId,
      duelItemLabel(context, "spell", liveForm.spellId),
      duelItemLabel(context, "spell", snapshotForm.spellId)
    );
  }

  for (const slot of EQUIPMENT_SLOTS) {
    const liveItem = liveForm.gear[slot] ?? "none";
    const snapshotItem = snapshotForm.gear[slot] ?? "none";
    add(
      "gear",
      `gear-${slot}`,
      SETUP_REQUIREMENT_SLOT_LABELS[slot],
      liveItem,
      snapshotItem,
      duelGearLabel(context, slot, liveItem),
      duelGearLabel(context, slot, snapshotItem)
    );
  }

  add(
    "prayers-boosts",
    "prayers",
    "Prayers",
    liveForm.prayers,
    snapshotForm.prayers,
    duelSelectionLabel(liveForm.prayers, PRAYER_SELECTION_OPTIONS),
    duelSelectionLabel(snapshotForm.prayers, PRAYER_SELECTION_OPTIONS)
  );
  add(
    "prayers-boosts",
    "boosts",
    "Boosts",
    liveForm.boosts,
    snapshotForm.boosts,
    duelSelectionLabel(liveForm.boosts, BOOST_SELECTION_OPTIONS),
    duelSelectionLabel(snapshotForm.boosts, BOOST_SELECTION_OPTIONS)
  );
  add(
    "prayers-boosts",
    "sustained",
    "Sustained boosts",
    liveForm.sustained,
    snapshotForm.sustained
  );
  add(
    "prayers-boosts",
    "repot-threshold",
    "Repot threshold",
    liveForm.repotThreshold,
    snapshotForm.repotThreshold
  );

  add(
    "special-overrides",
    "special-weapon",
    "Special weapon",
    liveForm.specialAttack.weaponId,
    snapshotForm.specialAttack.weaponId,
    duelItemLabel(context, "weapon", liveForm.specialAttack.weaponId),
    duelItemLabel(context, "weapon", snapshotForm.specialAttack.weaponId)
  );
  add(
    "special-overrides",
    "special-ammo",
    "Special ammo",
    liveForm.specialAttack.ammoId,
    snapshotForm.specialAttack.ammoId,
    duelItemLabel(context, "ammo", liveForm.specialAttack.ammoId),
    duelItemLabel(context, "ammo", snapshotForm.specialAttack.ammoId)
  );
  add(
    "special-overrides",
    "accuracy-override",
    "Accuracy override",
    liveForm.manualOverrides.accuracyBonus,
    snapshotForm.manualOverrides.accuracyBonus
  );
  add(
    "special-overrides",
    "damage-override",
    "Damage override",
    liveForm.manualOverrides.damageBonus,
    snapshotForm.manualOverrides.damageBonus
  );
  add(
    "special-overrides",
    "speed-override",
    "Attack speed override",
    liveForm.manualOverrides.attackSpeedSec,
    snapshotForm.manualOverrides.attackSpeedSec
  );
  add(
    "special-overrides",
    "ring-of-wealth",
    "Ring of wealth",
    liveForm.ringOfWealth,
    snapshotForm.ringOfWealth
  );

  for (const key of Object.keys(DUEL_TRIP_LABELS) as Array<keyof typeof DUEL_TRIP_LABELS>) {
    const liveRaw = liveForm.trip[key];
    const snapshotRaw = snapshotForm.trip[key];
    let liveValue = duelOptionalValue(liveRaw);
    let snapshotValue = duelOptionalValue(snapshotRaw);
    if (key === "foodKey") {
      liveValue = FOOD[String(liveRaw)]?.name ?? duelHumanizeId(String(liveRaw));
      snapshotValue = FOOD[String(snapshotRaw)]?.name ?? duelHumanizeId(String(snapshotRaw));
    } else if (key === "protect" || key === "prayerMode") {
      liveValue = duelHumanizeId(String(liveRaw));
      snapshotValue = duelHumanizeId(String(snapshotRaw));
    }
    add(
      "trip",
      `trip-${key}`,
      DUEL_TRIP_LABELS[key],
      liveRaw,
      snapshotRaw,
      liveValue,
      snapshotValue
    );
  }

  const orderedGroups = (Object.keys(DUEL_DIFF_CATEGORY_LABELS) as DuelSetupDiffCategoryId[])
    .map((id) => ({ id, label: DUEL_DIFF_CATEGORY_LABELS[id], items: groups.get(id) ?? [] }))
    .filter((group) => group.items.length > 0);
  return {
    changeCount: orderedGroups.reduce((total, group) => total + group.items.length, 0),
    groups: orderedGroups,
    sharedContextNote:
      "Both setups are recalculated against the current target, cannon, loot policy and active prices. These shared inputs are not snapshot differences."
  };
}

function finiteBest(values: ReadonlyArray<number | null>): number | null {
  const finiteValues = values.filter((value): value is number => value != null && isFinite(value));
  if (!finiteValues.length) return null;
  return Math.max(...finiteValues);
}

function isBestDuelValue(
  value: number | null,
  best: number | null,
  rowCount: number,
  tolerance = 0.000001
): boolean {
  return value != null && best != null && rowCount > 1 && value >= best - tolerance;
}

export function createDuelComparisonViewModel(
  form: CombatSetupFormState,
  duelSnapshots: DuelSnapshotsState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefsByMonster: Record<string, Record<string, LootAction | string | undefined>> = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): DuelComparisonViewModel {
  const currentForm = normalizeFormState(form);
  const currentMonsterId = currentForm.monsterId;
  const currentLootPrefs = lootPrefsByMonster[currentMonsterId] ?? {};
  const normalizedSnapshots = normalizeDuelSnapshotsState(duelSnapshots).snapshots;
  const liveVm = createSimulationViewModel(
    currentForm,
    context,
    cannonByMonster,
    currentLootPrefs,
    lootSettingsByMonster,
    { includeLootRows: false }
  );
  const liveBaseRow = duelBaseRowFromSimulation("duel-live", "live", null, "Live loadout", liveVm);
  const snapshotEntries = normalizedSnapshots.map((snapshot) => {
    const snapshotForm = normalizeFormState({
      ...snapshot.form,
      monsterId: currentMonsterId
    });
    const vm = createSimulationViewModel(
      snapshotForm,
      context,
      cannonByMonster,
      currentLootPrefs,
      lootSettingsByMonster,
      { includeLootRows: false }
    );
    return {
      row: duelBaseRowFromSimulation(
        `duel-snapshot:${snapshot.id}`,
        "snapshot",
        snapshot.id,
        snapshot.name,
        vm
      ),
      setupDiff: createDuelSetupDiffViewModel(currentForm, snapshotForm, context)
    };
  });
  const snapshotBaseRows = snapshotEntries.map((entry) => entry.row);
  const baseRows = [liveBaseRow, ...snapshotBaseRows];
  const bestEffectiveXpPerHour = finiteBest(baseRows.map((row) => row.effectiveXpPerHour));
  const bestEffectiveNetGpPerHour = finiteBest(baseRows.map((row) => row.effectiveNetGpPerHour));
  const bestGpPerXp = finiteBest(baseRows.map((row) => row.gpPerXp));
  const rows = baseRows.map((row, index) => ({
    ...row,
    setupDiff: index === 0 ? null : snapshotEntries[index - 1]!.setupDiff,
    deltas: {
      maxHit: row.maxHit - liveBaseRow.maxHit,
      dps: row.dps - liveBaseRow.dps,
      hitChance: row.hitChance - liveBaseRow.hitChance,
      ttkSec: row.ttkSec - liveBaseRow.ttkSec,
      killsPerTrip: row.killsPerTrip - liveBaseRow.killsPerTrip,
      killsPerHour: row.killsPerHour - liveBaseRow.killsPerHour,
      effectiveXpPerHour: row.effectiveXpPerHour - liveBaseRow.effectiveXpPerHour,
      effectiveNetGpPerHour: row.effectiveNetGpPerHour - liveBaseRow.effectiveNetGpPerHour,
      gpPerXp:
        row.gpPerXp != null && liveBaseRow.gpPerXp != null
          ? row.gpPerXp - liveBaseRow.gpPerXp
          : null,
      supplyCostPerHour: row.supplyCostPerHour - liveBaseRow.supplyCostPerHour
    },
    best: {
      effectiveXpPerHour: isBestDuelValue(
        row.effectiveXpPerHour,
        bestEffectiveXpPerHour,
        baseRows.length,
        0.5
      ),
      effectiveNetGpPerHour: isBestDuelValue(
        row.effectiveNetGpPerHour,
        bestEffectiveNetGpPerHour,
        baseRows.length,
        0.5
      ),
      gpPerXp: isBestDuelValue(row.gpPerXp, bestGpPerXp, baseRows.length)
    }
  }));
  const [liveRow, ...snapshotRows] = rows;

  return {
    monsterId: currentMonsterId,
    monsterName: liveVm.monsterCard.monsterName,
    snapshotCount: normalizedSnapshots.length,
    snapshotLimit: MAX_DUEL_SNAPSHOTS,
    liveRow,
    snapshotRows,
    rows
  };
}

export function createDuelMatrixViewModel(
  form: CombatSetupFormState,
  duelSnapshots: DuelSnapshotsState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefsByMonster: Record<string, Record<string, LootAction | string | undefined>> = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): DuelMatrixViewModel {
  const currentForm = normalizeFormState(form);
  const normalizedSnapshots = normalizeDuelSnapshotsState(duelSnapshots).snapshots;
  const setupDefinitions = [
    {
      id: "duel-live",
      snapshotId: null,
      source: "live" as const,
      name: "Live setup",
      form: currentForm
    },
    ...normalizedSnapshots.map((snapshot) => ({
      id: `duel-snapshot:${snapshot.id}`,
      snapshotId: snapshot.id,
      source: "snapshot" as const,
      name: snapshot.name,
      form: normalizeFormState(snapshot.form)
    }))
  ];
  const setupResults = setupDefinitions.map((setup) => {
    const metadataVm = createSimulationViewModel(
      { ...setup.form, monsterId: currentForm.monsterId },
      context,
      cannonByMonster,
      lootPrefsByMonster[currentForm.monsterId] ?? {},
      lootSettingsByMonster,
      { includeLootRows: false }
    );
    const rowsByMonster = new Map(
      createDenseCompareRows(
        setup.form,
        context,
        DEFAULT_DENSE_COMPARE_SORT_STATE,
        cannonByMonster,
        lootPrefsByMonster,
        {},
        lootSettingsByMonster
      ).map((row) => [row.monsterId, row])
    );

    return {
      setup: {
        id: setup.id,
        snapshotId: setup.snapshotId,
        source: setup.source,
        name: setup.name,
        combatStyle: setup.form.combatStyle,
        loadoutLabel: duelLoadoutLabel(metadataVm)
      } satisfies DuelMatrixSetupViewModel,
      rowsByMonster
    };
  });
  const setups = setupResults.map((result) => result.setup);
  const monsters = Object.values(context.gameData.monsters).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  const rows = monsters.map((monster) => {
    const values = setupResults.map((result): DuelMatrixMetricValuesViewModel => {
      const row = result.rowsByMonster.get(monster.id);
      return {
        dps: row?.dps ?? null,
        effectiveXpPerHour: row?.xpPerHour ?? null,
        effectiveNetGpPerHour: row?.netGpPerHour ?? null,
        gpPerXp: row ? gpPerXpValue(row.netGpPerHour, row.xpPerHour) : null
      };
    });
    const best = {
      dps: finiteBest(values.map((value) => value.dps)),
      effectiveXpPerHour: finiteBest(values.map((value) => value.effectiveXpPerHour)),
      effectiveNetGpPerHour: finiteBest(values.map((value) => value.effectiveNetGpPerHour)),
      gpPerXp: finiteBest(values.map((value) => value.gpPerXp))
    };
    const cells = setupResults.map((result, index): DuelMatrixCellViewModel => ({
      setupId: result.setup.id,
      values: values[index]!,
      best: {
        dps: isBestDuelValue(values[index]!.dps, best.dps, setups.length),
        effectiveXpPerHour: isBestDuelValue(
          values[index]!.effectiveXpPerHour,
          best.effectiveXpPerHour,
          setups.length,
          0.5
        ),
        effectiveNetGpPerHour: isBestDuelValue(
          values[index]!.effectiveNetGpPerHour,
          best.effectiveNetGpPerHour,
          setups.length,
          0.5
        ),
        gpPerXp: isBestDuelValue(values[index]!.gpPerXp, best.gpPerXp, setups.length)
      }
    }));

    return {
      monsterId: monster.id,
      monsterName: monster.name,
      monsterLevel: monster.level ?? null,
      isCurrentTarget: monster.id === currentForm.monsterId,
      cells
    };
  });

  return {
    currentMonsterId: currentForm.monsterId,
    monsterCount: rows.length,
    setupCount: setups.length,
    cellCount: rows.length * setups.length,
    setups,
    rows
  };
}

export function sortDenseCompareRows(
  rows: readonly DenseCompareRowViewModel[],
  sort: unknown = DEFAULT_DENSE_COMPARE_SORT_STATE
): DenseCompareRowViewModel[] {
  const normalizedSort = normalizeDenseCompareSortState(sort);
  return [...rows].sort((left, right) => compareDenseRows(left, right, normalizedSort));
}

export function createDenseCompareRows(
  form: CombatSetupFormState,
  context: SimulationContext,
  denseCompare: unknown = DEFAULT_DENSE_COMPARE_SORT_STATE,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefsByMonster: Record<string, Record<string, LootAction | string | undefined>> = {},
  customSetupsByMonster: CustomSetupsByMonsterState = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): DenseCompareRowViewModel[] {
  const denseState = normalizeDenseCompareUiState(denseCompare);
  const sort = denseState.sort;
  const irrelevantMonsterIds = new Set(denseState.irrelevantMonsterIds);
  const rows = Object.values(context.gameData.monsters).map((monster) => {
    const customSetup = customSetupsByMonster[monster.id];
    const lootSettings = lootSettingsByMonster[monster.id];
    const hasHighAlchOverride = lootSettings?.highAlch != null;
    const hasOverheadOverride = lootSettings?.overheadSec != null;
    const rowForm = customSetup ?? { ...form, monsterId: monster.id };
    const vm = createSimulationViewModel(
      rowForm,
      context,
      cannonByMonster,
      lootPrefsByMonster[monster.id] ?? {},
      lootSettingsByMonster,
      { includeLootRows: false }
    );
    return {
      monsterId: monster.id,
      monsterName: monster.name,
      monsterLevel: monster.level ?? null,
      isActiveTarget: monster.id === form.monsterId,
      isForcedVisible: false,
      isIrrelevant: irrelevantMonsterIds.has(monster.id),
      hasCustomSetup: customSetup != null,
      hasHighAlchOverride,
      hasOverheadOverride,
      markers: createDenseCompareRowMarkers({
        hasCustomSetup: customSetup != null,
        hasHighAlchOverride,
        hasOverheadOverride,
        isIrrelevant: irrelevantMonsterIds.has(monster.id),
        isForcedVisible: false
      }),
      hitChance: vm.result.combat.hitChance,
      maxHit: vm.result.combat.maxHit,
      dps: vm.result.rates.effectiveDps,
      ttkSec: vm.result.rates.ttkSec,
      killsPerHour: vm.result.rates.killsPerHour,
      xpPerHour: vm.result.xp.effectiveXpPerHour,
      gpPerKill: vm.result.rates.gpPerKill,
      gpPerHour: vm.result.rates.gpPerHour,
      netGpPerHour: vm.result.rates.effectiveNetGpPerHour,
      bound: vm.result.trip.trip.bound
    };
  });

  const filteredRows = rows
    .map((row) => {
      const isForcedVisible =
        row.isActiveTarget && !rowMatchesDenseFilters(row, context.gameData, denseState);
      return {
        ...row,
        isForcedVisible,
        markers: createDenseCompareRowMarkers({ ...row, isForcedVisible })
      };
    })
    .filter(
      (row) => row.isForcedVisible || rowMatchesDenseFilters(row, context.gameData, denseState)
    );

  return sortDenseCompareRows(filteredRows, sort);
}

export function createCompareRows(
  form: CombatSetupFormState,
  context: SimulationContext,
  limit = 8,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefsByMonster: Record<string, Record<string, LootAction | string | undefined>> = {}
): CompareRowViewModel[] {
  return createDenseCompareRows(
    form,
    context,
    DEFAULT_DENSE_COMPARE_SORT_STATE,
    cannonByMonster,
    lootPrefsByMonster
  )
    .filter((row) => Number.isFinite(row.xpPerHour))
    .slice(0, limit)
    .map((row) => ({
      monsterId: row.monsterId,
      monsterName: row.monsterName,
      dps: row.dps,
      effectiveXpPerHour: row.xpPerHour,
      effectiveNetGpPerHour: row.netGpPerHour,
      bound: row.bound
    }));
}

export interface PlannerDomainAdapterViewModel {
  input: PlannerInput;
  options: PlannerOptions;
  state: PlannerUiState;
  defaultPool: PlannerPool;
  pool: PlannerPool;
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
  warnings: string[];
  isEmpty: boolean;
}

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
  itemId: EntityId
): string {
  if (itemId === "none") return "None";
  if (slot === "weapon") return context.gameData.weapons[itemId]?.name ?? itemId;
  return context.gameData.equipment[slot as EquipmentSlot]?.[itemId]?.name ?? itemId;
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
  const state = cleanPlannerUiStateForPool(plannerUiState, allowedPool);
  const effectivePool = effectivePlannerGearPool(state, allowedPool);
  const slots = PLANNER_GEAR_SLOTS.map((slot): PlannerGearPoolSlotViewModel => {
    const itemIds = allowedPool[slot] ?? [];
    const selected = new Set(effectivePool[slot] ?? []);
    const options = itemIds.map((itemId) => ({
      id: itemId,
      label: plannerPoolItemLabel(context, slot, itemId),
      hint: plannerPoolItemHint(context, slot, itemId),
      selected: selected.has(itemId)
    }));
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
    targets[skill] = plannerState.skillLocks[skill]
      ? form.levels[skill]
      : Math.max(form.levels[skill], plannerState.targetLevels[skill]);
  }
  return targets;
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
      startXp: state.currentXp,
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

function unlockRow(unlock: PlannerTransition, index: number): PlannerUnlockRowViewModel {
  return {
    id: `${index}:${unlock.slot}:${unlock.itemId}:${unlock.level}`,
    itemName: unlock.name,
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

function timelineEvent(unlock: PlannerTransition, index: number): PlannerTimelineEventViewModel {
  return {
    id: `${index}:${unlock.slot}:${unlock.itemId}:${unlock.cumXp}`,
    itemName: unlock.name,
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

export function createPlannerPanelViewModel(plan: PlannerPlan): PlannerPanelViewModel {
  const timeline = plan.unlocks.map(timelineEvent);
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
    unlocks: plan.unlocks.map(unlockRow),
    timeline,
    chart: createPlannerChartViewModel(plan),
    warnings: plan.warnings.map((warning) => warning.message),
    isEmpty: plan.steps.length === 0
  };
}

export function optimizeLootPrefsForMonster(
  form: CombatSetupFormState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): LootOptimizeResult {
  const request = formToSimulationRequest(form, context.gameData);
  const combat = simulateCombat(request, context);
  const input = tripInputFor(form, request, combat, cannonByMonster, lootSettingsByMonster);
  const defaultTrip = simulateWithLootPrefs(input, context, undefined);
  const natureRuneCost = context.priceSet.itemPrices.naturerune ?? NATURE_RUNE_FALLBACK;
  const defaultRows = defaultTrip.lootBreakdown;
  const defaultByRowId = new Map(defaultRows.map((drop) => [drop.rowId, drop]));
  const maxIterations = Math.min(MAX_LOOT_OPTIMIZE_ITERATIONS, defaultRows.length);
  let prefs: Record<string, LootAction> = {};
  let bestScore = defaultTrip.effectiveNetGpPerHour;
  let iterations = 0;
  let capped = false;

  for (; iterations < maxIterations; iterations += 1) {
    let improvedPrefs: Record<string, LootAction> | null = null;
    let improvedScore = bestScore;

    for (const row of defaultRows) {
      const availableActions = availableLootActions(row, !!input.trip?.alching, natureRuneCost);
      for (const action of availableActions) {
        const defaultAction = defaultByRowId.get(row.rowId)?.pref ?? row.pref;
        const candidatePrefs = { ...prefs };
        if (action === defaultAction) delete candidatePrefs[row.rowId];
        else candidatePrefs[row.rowId] = action;

        const candidate = simulateWithLootPrefs(input, context, candidatePrefs);
        if (candidate.effectiveNetGpPerHour > improvedScore + 0.000001) {
          improvedScore = candidate.effectiveNetGpPerHour;
          improvedPrefs = candidatePrefs;
        }
      }
    }

    if (!improvedPrefs) break;
    prefs = improvedPrefs;
    bestScore = improvedScore;
  }

  if (iterations >= maxIterations && maxIterations > 0) capped = true;

  return {
    prefs,
    effectiveNetGpPerHour: bestScore,
    baseEffectiveNetGpPerHour: defaultTrip.effectiveNetGpPerHour,
    deltaNetGpPerHour: bestScore - defaultTrip.effectiveNetGpPerHour,
    iterations,
    changedRows: Object.keys(prefs).length,
    capped
  };
}

function signedBonus(value: number): string {
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

export function monsterOptions(gameData: GameDataSnapshot) {
  return Object.values(gameData.monsters)
    .map((monster) => ({ id: monster.id, label: monster.name }))
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

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "unlimited";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

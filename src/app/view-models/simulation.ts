import {
  computeCombatXpBreakdown,
  createHitDistribution,
  simulateCombat,
  weaponStances,
  type CombatXpBreakdown,
  type CombatXpKey
} from "@/domain/combat";
import {
  buildPlan,
  defaultPool,
  SKILL_LABEL,
  SLOT_LABEL,
  reqOf,
  type PlannerInput,
  type PlannerOptions,
  type PlannerPhase,
  type PlannerGearSlot,
  type PlannerPlan,
  type PlannerPool,
  type PlannerSkill,
  type PlannerTransition
} from "@/domain/planner";
import type {
  AttackType,
  BonusKey,
  CombatStyle,
  EquipmentItemDefinition,
  EquipmentSlot,
  EntityId,
  GameDataSnapshot,
  SimulationContext,
  SimulationRequest,
  SimulationWarning
} from "@/domain/shared";
import {
  simulateTripLootSupply,
  type LootAction,
  type LootBreakdownEntry,
  type TripLootSupplyInput,
  type TripLootSupplyResult
} from "@/domain/trip";
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
  type CannonByMonsterState,
  formToSimulationRequest,
  formToTripPolicy,
  normalizeFormState,
  type CombatSetupFormState,
  type CustomSetupsByMonsterState,
  type SetupMode
} from "../state/ui-state";

export interface SimulationViewModel {
  request: SimulationRequest;
  combat: ReturnType<typeof simulateCombat>;
  hitDistribution: HitDistributionViewModel;
  xpRouting: XpRoutingViewModel;
  tripBankingSummary: StatsTripBankingSummaryViewModel;
  monsterCard: MonsterCardViewModel;
  trip: TripLootSupplyResult;
  playerEffectiveXpPerHour: number;
  cannonEffectiveXpPerHour: number;
  effectiveXpPerHour: number;
  totalXpPerHour: number;
  warnings: string[];
  calculationWarnings: CalculationWarningViewModel[];
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

export type MonsterCardStatKey =
  | "combat"
  | "hitpoints"
  | "attack"
  | "strength"
  | "defence"
  | "magic"
  | "attackSpeed";

export interface MonsterCardStatViewModel {
  key: MonsterCardStatKey;
  label: string;
  value: number | null;
  missing: boolean;
}

export type MonsterCardDefenceKey = "stab" | "slash" | "crush" | "range" | "magic";
export type MonsterCardDefenceField =
  | "defStab"
  | "defSlash"
  | "defCrush"
  | "defRange"
  | "defMagic";

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
  dps: number;
  effectiveXpPerHour: number;
  effectiveNetGpPerHour: number;
  gpPerXp: number | null;
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
      option.id === "none"
        ? { name: "None" }
        : input.gameData.equipment[input.slot]?.[option.id];
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
  return {
    itemId: best.id,
    itemLabel: best.label,
    disabled: currentIsBest,
    reason: currentIsBest
      ? `Best visible option: ${current?.label ?? best.label}`
      : `Apply ${best.label}`
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

function lootRowStateLabel(drop: Pick<LootBreakdownEntry, "_eaten" | "_displaced">): string | null {
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
        weight !== null
          ? formatNumber(weight)
          : stringWeight !== null
            ? stringWeight
            : null,
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
      statusLabel: "No local history"
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
    statusLabel: "Tracked locally"
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
      shareOfPositivePct:
        positiveGpPerKill > 0 ? (otherGpPerKill / positiveGpPerKill) * 100 : null,
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

function tripInputFor(
  form: CombatSetupFormState,
  request: SimulationRequest,
  combat: ReturnType<typeof simulateCombat>,
  cannonByMonster: CannonByMonsterState,
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): TripLootSupplyInput {
  const lootSettings = lootSettingsForMonster(lootSettingsByMonster, request.monsterId);
  const trip = formToTripPolicy(form);
  return {
    request,
    combat,
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
      const candidateDrop = candidate.lootBreakdown.find((entry) => entry.rowId === drop.rowId) ?? drop;
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
      pref: drop.pref,
      prefLabel: lootActionLabel(drop.pref),
      defaultPref: defaultDrop.pref,
      availableActions,
      actionImpacts,
      selectedDeltaNetGpPerHour: selectedImpact?.deltaNetGpPerHour ?? 0,
      isOverride: lootPrefs[drop.rowId] != null && lootPrefs[drop.rowId] !== defaultDrop.pref,
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

function createXpRoutingViewModel(input: {
  xp: CombatXpBreakdown;
  trip: TripLootSupplyResult;
  playerEffectiveXpPerHour: number;
  cannonEffectiveXpPerHour: number;
  effectiveXpPerHour: number;
  totalXpPerHour: number;
}): XpRoutingViewModel {
  const rows: XpRoutingRowViewModel[] = [
    xpRoutingRow({
      id: "player-combat",
      label: "Player combat XP/hr",
      xpPerHour: input.playerEffectiveXpPerHour,
      status: "modeled",
      note: "Direct player combat XP contributing to effective XP/hr."
    })
  ];

  if (input.cannonEffectiveXpPerHour > 0) {
    rows.push(
      xpRoutingRow({
        id: "cannon-ranged",
        label: "Cannon ranged XP/hr",
        xpPerHour: input.cannonEffectiveXpPerHour,
        status: "modeled",
        note: "Separate cannon ranged XP row after trip efficiency."
      })
    );
  }

  for (const key of XP_SKILL_ORDER) {
    const xpPerKill = input.xp.skillXpPerKill[key] ?? 0;
    if (xpPerKill <= 0) continue;
    rows.push(
      xpRoutingRow({
        id: `skill-${key}`,
        label: XP_SKILL_LABELS[key],
        xpPerHour: xpPerKill * input.trip.effectiveKph,
        status: "modeled",
        note: "Skill row from the rewrite-owned combat XP breakdown."
      })
    );
  }

  rows.push(
    xpRoutingRow({
      id: "prayer",
      label: "Prayer XP/hr",
      xpPerHour: input.trip.prayerXpPerHour,
      status: "partial",
      note: "Trip loot prayer XP is surfaced, but full total-XP parity remains partial."
    }),
    xpRoutingRow({
      id: "alch",
      label: "Magic (alch) XP/hr",
      xpPerHour: null,
      status: "not-modeled",
      note:
        input.trip.alchCastsPerKill > 0
          ? `${formatNumber(input.trip.alchCastsPerKill, 2)} alch casts/kill tracked; XP row is not yet domain-owned.`
          : "High-alch Magic XP is not yet domain-owned in rewrite XP routing."
    })
  );

  return {
    effectiveXpPerHour: input.effectiveXpPerHour,
    totalXpPerHour: input.totalXpPerHour,
    effectiveXpPerHourLabel: formatNumber(input.effectiveXpPerHour),
    totalXpPerHourLabel: formatNumber(input.totalXpPerHour),
    rows
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
        label: "Protection",
        value: protectionStateLabel(form, trip),
        note: trip.trip.incoming.protected ? "Incoming damage blocked by protection prayer." : ""
      })
    ]
  };
}

function createHitDistributionViewModel(
  combat: ReturnType<typeof simulateCombat>
): HitDistributionViewModel {
  const distribution = createHitDistribution({
    hitChance: combat.hitChance,
    averageHit: combat.avgHit,
    maxHit: combat.maxHit,
    peakMaxHit: combat.peakMaxHit
  });
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
        ariaLabel: `${damageText}: ${percentLabel}${
          bucket.isMaxHit ? ", max hit bucket" : ""
        }`,
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
              netTone === "negative"
                ? "loss"
                : netTone === "positive"
                  ? "profit"
                  : "break-even"
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
  const combat = simulateCombat(request, context);
  const tripInput = tripInputFor(form, request, combat, cannonByMonster, lootSettingsByMonster);
  const trip = simulateWithLootPrefs(tripInput, context, lootPrefs);
  const xp = computeCombatXpBreakdown(
    request,
    context,
    combat,
    trip.cannon ? { directDamageFraction: trip.combatXpDamageFraction } : undefined
  );
  const playerEffectiveXpPerHour = xp.combatXpPerKill * trip.effectiveKph;
  const cannonEffectiveXpPerHour = (trip.cannon?.rangedXpPerHour ?? 0) * trip.trip.efficiency;
  const effectiveXpPerHour = playerEffectiveXpPerHour + cannonEffectiveXpPerHour;
  const totalXpPerHour =
    Object.values(xp.skillXpPerKill).reduce((sum, value) => sum + (value ?? 0), 0) *
      trip.effectiveKph +
    cannonEffectiveXpPerHour;

  const lootRows =
    options.includeLootRows === false
      ? {
          rows: [],
          defaultEffectiveNetGpPerHour: trip.effectiveNetGpPerHour,
          currentDeltaNetGpPerHour: 0,
          overrideCount: 0
        }
      : createLootRows(tripInput, context, trip, lootPrefs, options.lootPriceHistoryByItem);
  const calculationWarnings = calculationWarningViewModels([...combat.warnings, ...trip.warnings]);
  const moneyWarnings = calculationWarnings.filter((warning) =>
    MONEY_WARNING_CODES.has(warning.code)
  );

  return {
    request,
    combat,
    hitDistribution: createHitDistributionViewModel(combat),
    xpRouting: createXpRoutingViewModel({
      xp,
      trip,
      playerEffectiveXpPerHour,
      cannonEffectiveXpPerHour,
      effectiveXpPerHour,
      totalXpPerHour
    }),
    tripBankingSummary: createTripBankingSummaryViewModel(form, trip),
    monsterCard: monsterCardFromResult(request, context, combat, options.monsterCard),
    trip,
    playerEffectiveXpPerHour,
    cannonEffectiveXpPerHour,
    effectiveXpPerHour,
    totalXpPerHour,
    warnings: calculationWarnings.map((warning) => warning.message),
    calculationWarnings,
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

type DuelComparisonBaseRowViewModel = Omit<DuelComparisonRowViewModel, "deltas" | "best">;

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
  return {
    id,
    snapshotId,
    source,
    name,
    monsterId: vm.request.monsterId,
    monsterName: vm.monsterCard.monsterName,
    combatStyle: vm.request.combatStyle,
    loadoutLabel: duelLoadoutLabel(vm),
    maxHit: vm.combat.maxHit,
    dps: vm.combat.effectiveDps,
    hitChance: vm.combat.hitChance,
    ttkSec: vm.combat.ttkSec,
    killsPerTrip: vm.trip.trip.killsPerTrip,
    killsPerHour: vm.trip.killsPerHour,
    effectiveXpPerHour: vm.effectiveXpPerHour,
    effectiveNetGpPerHour: vm.trip.effectiveNetGpPerHour,
    gpPerXp: gpPerXpValue(vm.trip.effectiveNetGpPerHour, vm.effectiveXpPerHour),
    supplyCostPerHour: vm.trip.supply.supplyCostPerKill * vm.trip.effectiveKph,
    bound: vm.trip.trip.bound,
    warnings: vm.warnings
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
  const liveBaseRow = duelBaseRowFromSimulation(
    "duel-live",
    "live",
    null,
    "Live loadout",
    liveVm
  );
  const snapshotBaseRows = normalizedSnapshots.map((snapshot) => {
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
    return duelBaseRowFromSimulation(
      `duel-snapshot:${snapshot.id}`,
      "snapshot",
      snapshot.id,
      snapshot.name,
      vm
    );
  });
  const baseRows = [liveBaseRow, ...snapshotBaseRows];
  const bestEffectiveXpPerHour = finiteBest(baseRows.map((row) => row.effectiveXpPerHour));
  const bestEffectiveNetGpPerHour = finiteBest(baseRows.map((row) => row.effectiveNetGpPerHour));
  const bestGpPerXp = finiteBest(baseRows.map((row) => row.gpPerXp));
  const rows = baseRows.map((row) => ({
    ...row,
    deltas: {
      dps: row.dps - liveBaseRow.dps,
      effectiveXpPerHour: row.effectiveXpPerHour - liveBaseRow.effectiveXpPerHour,
      effectiveNetGpPerHour: row.effectiveNetGpPerHour - liveBaseRow.effectiveNetGpPerHour,
      gpPerXp:
        row.gpPerXp != null && liveBaseRow.gpPerXp != null
          ? row.gpPerXp - liveBaseRow.gpPerXp
          : null
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
      hitChance: vm.combat.hitChance,
      maxHit: vm.combat.maxHit,
      dps: vm.combat.effectiveDps,
      ttkSec: vm.combat.ttkSec,
      killsPerHour: vm.trip.killsPerHour,
      xpPerHour: vm.effectiveXpPerHour,
      gpPerKill: vm.trip.gpPerKill,
      gpPerHour: vm.trip.gpPerHour,
      netGpPerHour: vm.trip.effectiveNetGpPerHour,
      bound: vm.trip.trip.bound
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
  const req = reqOf(itemId);
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

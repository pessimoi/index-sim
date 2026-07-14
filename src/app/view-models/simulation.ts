import { simulateCombat } from "@/domain/combat";
import type {
  AttackType,
  CombatStyle,
  EntityId,
  GameDataSnapshot,
  SimulationContext,
  SimulationRequest
} from "@/domain/shared";
import type { LootAction, TripLootSupplyInput, TripLootSupplyResult } from "@/domain/trip";
import { simulateFullSimulation, type FullSimulationResult } from "@/domain/simulation";
import type { LootSettingsByMonsterState } from "../state/loot-settings";
import {
  type CannonByMonsterState,
  formToSimulationRequest,
  type CombatSetupFormState,
  type SetupMode
} from "../state/ui-state";
import { createFullSimulationInput } from "./simulation-input";
import {
  createLootPresentationViewModel,
  type LootDropRowViewModel,
  type LootPresentationViewModel,
  type LootSummaryViewModel
} from "./loot";
import type { ItemPriceHistoryContext } from "./price-data";
import type { CalculationWarningViewModel } from "./contracts";
import { formatNumber } from "./formatting";
import {
  calculationWarningViewModels,
  createActiveAssumptionsSummaryViewModel,
  isMoneyWarningCode,
  isSpecialWarningCode,
  type ActiveAssumptionsSummaryViewModel,
  type ActiveAssumptionsViewModelOptions
} from "./active-assumptions";
import {
  createSetupRequirementSummaryViewModel,
  signedBonus,
  styleOptions,
  type SetupRequirementSummaryViewModel
} from "./loadout";
import {
  createHitDistributionComparisonViewModel,
  createHitDistributionSummaryViewModel,
  createHitDistributionViewModel,
  createOmittedHitDistributionComparisonViewModel,
  createStatsCombatRollDetailViewModel,
  createStatsSourceBreakdownViewModel,
  createTripBankingSummaryViewModel,
  createXpRoutingViewModel,
  type HitDistributionComparisonViewModel,
  type HitDistributionViewModel,
  type StatsCombatRollDetailViewModel,
  type StatsSourceBreakdownViewModel,
  type StatsTripBankingSummaryViewModel,
  type XpRoutingViewModel
} from "./stats";

export interface SimulationViewModel {
  request: SimulationRequest;
  result: FullSimulationResult;
  combat: ReturnType<typeof simulateCombat>;
  hitDistribution: HitDistributionViewModel;
  hitDistributionComparison: HitDistributionComparisonViewModel;
  combatRollDetail: StatsCombatRollDetailViewModel;
  xpRouting: XpRoutingViewModel;
  tripBankingSummary: StatsTripBankingSummaryViewModel;
  statsSourceBreakdown: StatsSourceBreakdownViewModel;
  setupRequirements: SetupRequirementSummaryViewModel;
  activeAssumptions: ActiveAssumptionsSummaryViewModel;
  monsterCard: MonsterCardViewModel;
  trip: TripLootSupplyResult;
  loot: LootPresentationViewModel;
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
  lootSummary: LootSummaryViewModel;
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
  includeHitDistributionAnalysis?: boolean;
  monsterCard?: MonsterCardViewModelOptions;
  lootPriceHistoryByItem?: Readonly<Record<string, ItemPriceHistoryContext | undefined>>;
  activeAssumptions?: ActiveAssumptionsViewModelOptions;
}

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

export function createSimulationViewModel(
  form: CombatSetupFormState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefs: Record<string, LootAction | string | undefined> = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {},
  options: SimulationViewModelOptions = {}
): SimulationViewModel {
  const request = formToSimulationRequest(form, context.gameData);
  const fullInput = createFullSimulationInput(
    form,
    request,
    cannonByMonster,
    lootSettingsByMonster
  );
  const fullResult = simulateFullSimulation({ ...fullInput, lootPrefs }, context);
  const combat = fullResult.combat;
  const trip = fullResult.trip;
  const tripInput: TripLootSupplyInput = { ...fullInput, combat };
  const playerEffectiveXpPerHour = fullResult.xp.playerEffectiveXpPerHour;
  const cannonEffectiveXpPerHour = fullResult.xp.cannonEffectiveXpPerHour;
  const effectiveXpPerHour = fullResult.xp.effectiveXpPerHour;
  const totalXpPerHour = fullResult.xp.totalXpPerHour;

  const loot = createLootPresentationViewModel({
    form,
    context,
    tripInput,
    trip,
    lootPrefs,
    lootSettingsByMonster,
    lootPriceHistoryByItem: options.lootPriceHistoryByItem,
    includeRows: options.includeLootRows
  });
  const calculationWarnings = calculationWarningViewModels(fullResult.warnings);
  const specialWarnings = calculationWarnings.filter((warning) =>
    isSpecialWarningCode(warning.code)
  );
  const moneyWarnings = calculationWarnings.filter((warning) => isMoneyWarningCode(warning.code));
  const includeHitDistributionAnalysis = options.includeHitDistributionAnalysis !== false;
  const hitDistribution = includeHitDistributionAnalysis
    ? createHitDistributionViewModel(combat)
    : createHitDistributionSummaryViewModel(combat);
  const targetHp = context.gameData.monsters[request.monsterId]?.hp;
  const hitDistributionComparison = includeHitDistributionAnalysis
    ? createHitDistributionComparisonViewModel(combat, hitDistribution, targetHp)
    : createOmittedHitDistributionComparisonViewModel(targetHp);
  const setupRequirements = createSetupRequirementSummaryViewModel(request, context);
  const activeAssumptions = createActiveAssumptionsSummaryViewModel({
    form,
    request,
    context,
    trip,
    cannonByMonster,
    lootPrefs,
    lootSettingsByMonster,
    lootOverrideCount: loot.summary.overrideCount,
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
    hitDistributionComparison,
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
      hitDistribution,
      includeHistograms: includeHitDistributionAnalysis
    }),
    setupRequirements,
    activeAssumptions,
    monsterCard: monsterCardFromResult(request, context, combat, options.monsterCard),
    trip,
    loot,
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
    lootRows: loot.rows,
    lootSummary: loot.summary
  };
}

export function monsterOptions(gameData: GameDataSnapshot) {
  return Object.values(gameData.monsters)
    .map((monster) => ({ id: monster.id, label: monster.name }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

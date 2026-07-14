import type { CombatSimulationResult, SimulationContext, SimulationRequest } from "@/domain/shared";
import type { LootAction, TripLootSupplyInput, TripLootSupplyResult } from "@/domain/trip";
import { simulateFullSimulation, type FullSimulationResult } from "@/domain/simulation";
import type { LootSettingsByMonsterState } from "../state/loot-settings";
import {
  type CannonByMonsterState,
  formToSimulationRequest,
  type CombatSetupFormState
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
  type SetupRequirementSummaryViewModel
} from "./loadout";
import {
  createMonsterCardViewModelFromCombat,
  type MonsterCardViewModel,
  type MonsterCardViewModelOptions
} from "./monster-card";
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
  combat: CombatSimulationResult;
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

export interface SimulationViewModelOptions {
  includeLootRows?: boolean;
  includeHitDistributionAnalysis?: boolean;
  monsterCard?: MonsterCardViewModelOptions;
  lootPriceHistoryByItem?: Readonly<Record<string, ItemPriceHistoryContext | undefined>>;
  activeAssumptions?: ActiveAssumptionsViewModelOptions;
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
    monsterCard: createMonsterCardViewModelFromCombat(
      request,
      context,
      combat,
      options.monsterCard
    ),
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

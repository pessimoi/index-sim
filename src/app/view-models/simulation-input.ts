import type { SimulationContext, SimulationRequest } from "@/domain/shared";
import type { FullSimulationInput } from "@/domain/simulation";
import type { LootAction } from "@/domain/trip";
import { lootSettingsForMonster, type LootSettingsByMonsterState } from "../state/loot-settings";
import {
  formToSimulationRequest,
  formToTripPolicy,
  type CannonByMonsterState,
  type CombatSetupFormState
} from "../state/ui-state";

export function createFullSimulationInput(
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

export function createFullSimulationInputForForm(
  form: CombatSetupFormState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefs: Record<string, LootAction | string | undefined> = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): FullSimulationInput {
  const request = formToSimulationRequest(form, context.gameData);
  return {
    ...createFullSimulationInput(form, request, cannonByMonster, lootSettingsByMonster),
    lootPrefs
  };
}

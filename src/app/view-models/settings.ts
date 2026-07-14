import {
  GEAR_TIER_DEFS,
  type GearTierId,
  type HiddenGearTiersState
} from "../state/hidden-gear-tiers";

export interface HiddenGearTierPresentation {
  id: GearTierId;
  label: string;
  description: string;
  hidden: boolean;
}

export interface SettingsPaneViewModel {
  hiddenGearTiers: HiddenGearTierPresentation[];
  hiddenGearTierCount: number;
  hasHiddenGearTiers: boolean;
}

export function createSettingsPaneViewModel(
  hiddenGearTiers: HiddenGearTiersState
): SettingsPaneViewModel {
  const rows = GEAR_TIER_DEFS.map((tier) => ({
    id: tier.id,
    label: tier.label,
    description: "description" in tier ? tier.description : `Hide ${tier.label.toLowerCase()} gear`,
    hidden: !!hiddenGearTiers[tier.id]
  }));
  const hiddenGearTierCount = rows.filter((tier) => tier.hidden).length;
  return {
    hiddenGearTiers: rows,
    hiddenGearTierCount,
    hasHiddenGearTiers: hiddenGearTierCount > 0
  };
}

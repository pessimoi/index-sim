import { GEAR_TIER_DEFS, hideAllGearTiers } from "../app/state/hidden-gear-tiers";
import { createSettingsPaneViewModel } from "../app/view-models/settings";

describe("Settings view model", () => {
  it("keeps the canonical gear-tier order, labels and fallback descriptions", () => {
    const presentation = createSettingsPaneViewModel({ bronze: true, low_bows: true });

    expect(presentation.hiddenGearTiers.map((tier) => tier.id)).toEqual(
      GEAR_TIER_DEFS.map((tier) => tier.id)
    );
    expect(presentation).toMatchObject({ hiddenGearTierCount: 2, hasHiddenGearTiers: true });
    expect(presentation.hiddenGearTiers[0]).toMatchObject({
      id: "bronze",
      label: "Bronze",
      description: "Hide bronze gear",
      hidden: true
    });
    expect(presentation.hiddenGearTiers.find((tier) => tier.id === "low_bows")).toMatchObject({
      description: "Hide low-level bows below magic shortbow",
      hidden: true
    });
  });

  it("summarizes empty and all-hidden states from domain truth", () => {
    expect(createSettingsPaneViewModel({})).toMatchObject({
      hiddenGearTierCount: 0,
      hasHiddenGearTiers: false
    });
    expect(createSettingsPaneViewModel(hideAllGearTiers())).toMatchObject({
      hiddenGearTierCount: GEAR_TIER_DEFS.length,
      hasHiddenGearTiers: true
    });
  });
});

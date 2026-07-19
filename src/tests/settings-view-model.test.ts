import { GEAR_TIER_DEFS, hideAllGearTiers } from "../app/state/hidden-gear-tiers";
import {
  createGameRevisionViewModel,
  createSettingsPaneViewModel,
  type GameRevisionViewModel
} from "../app/view-models/settings";
import type { GameDataSnapshot } from "../domain/shared";

const revision: GameRevisionViewModel = {
  revisionLabel: "Revision 274",
  snapshotLabel: "Fixture snapshot",
  snapshotId: "fixture-snapshot",
  sourceLabel: "LostCityRS/Content",
  sourceCommit: "376072662e78a314bf35bb18815be39521491a6b",
  sourceCommitShort: "376072662e78",
  generatedAt: "2026-07-09T00:00:00.000Z"
};

describe("Settings view model", () => {
  it("keeps the canonical gear-tier order, labels and fallback descriptions", () => {
    const presentation = createSettingsPaneViewModel({ bronze: true, low_bows: true }, revision);

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
    expect(createSettingsPaneViewModel({}, revision)).toMatchObject({
      hiddenGearTierCount: 0,
      hasHiddenGearTiers: false
    });
    expect(createSettingsPaneViewModel(hideAllGearTiers(), revision)).toMatchObject({
      hiddenGearTierCount: GEAR_TIER_DEFS.length,
      hasHiddenGearTiers: true
    });
  });

  it("builds bounded current revision presentation without parsing provenance text", () => {
    const snapshot = {
      id: "lostcity-fixture-runtime",
      label: "LostCity fixture runtime",
      revisionContext: {
        gameRevision: 274,
        sourceName: "LostCityRS/Content",
        sourceCommit: "376072662e78a314bf35bb18815be39521491a6b",
        generatedAt: "2026-07-09T00:00:00.000Z"
      }
    } as GameDataSnapshot;

    expect(createGameRevisionViewModel(snapshot)).toEqual({
      revisionLabel: "Revision 274",
      snapshotLabel: "LostCity fixture runtime",
      snapshotId: "lostcity-fixture-runtime",
      sourceLabel: "LostCityRS/Content",
      sourceCommit: "376072662e78a314bf35bb18815be39521491a6b",
      sourceCommitShort: "376072662e78",
      generatedAt: "2026-07-09T00:00:00.000Z"
    });
  });
});

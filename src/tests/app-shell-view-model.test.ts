import type { DistributionSummary } from "../domain/risk";
import {
  DEFAULT_CANNON_SETTINGS,
  DEFAULT_FORM_STATE,
  normalizeFormState
} from "../app/state/ui-state";
import { DEFAULT_MONSTER_LOOT_SETTINGS } from "../app/state/loot-settings";
import { ShareableSetupError, buildShareableSetupEnvelope } from "../app/state/shareable-setup";
import {
  WORKBENCH_TABS,
  createAppShellSetupViewModel,
  createSharedSetupReviewViewModel,
  createWorkbenchResultViewModel,
  describeShareableSetupError,
  nextWorkbenchTabId,
  workbenchTabLabel
} from "../app/view-models/app-shell";
import { createDuelSnapshotId } from "../app/state/duel-snapshots";
import { mergeLootPrefsState } from "../app/state/loot-prefs";
import { describeDuelSnapshotsImportError } from "../app/view-models/duel";
import { DuelSnapshotsImportError } from "../app/state/duel-snapshots";

const distribution: DistributionSummary = {
  p10: 10,
  p50: 20,
  p90: 30,
  mean: 20
};

describe("app shell view model", () => {
  it("owns exact tab order, labels and bounded navigation", () => {
    expect(WORKBENCH_TABS.map((tab) => tab.id)).toEqual([
      "stats",
      "loadout",
      "compare",
      "duel",
      "loot",
      "trip",
      "risk",
      "cannon",
      "planner",
      "economy",
      "settings"
    ]);
    expect(workbenchTabLabel("loadout", "magic")).toBe("Magic setup");
    expect(workbenchTabLabel("compare", "melee")).toBe("Monsters");
    expect(nextWorkbenchTabId("stats", "ArrowLeft")).toBe("settings");
    expect(nextWorkbenchTabId("settings", "ArrowRight")).toBe("stats");
    expect(nextWorkbenchTabId("risk", "Home")).toBe("stats");
    expect(nextWorkbenchTabId("risk", "End")).toBe("settings");
    expect(nextWorkbenchTabId("risk", "Enter")).toBeNull();
  });

  it("builds setup labels, summaries, options and quick navigation without DOM state", () => {
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      combatStyle: "magic",
      prayers: ["incredible", "steel_skin"],
      boosts: ["magic"]
    });
    const viewModel = createAppShellSetupViewModel({
      form,
      hasCurrentCustomSetup: true,
      activeSetupIsCustom: false,
      derivedAccuracyBonus: 12,
      derivedDamageBonus: 0,
      derivedAttackSpeedSec: 2.4,
      potionCarrySummary: "2 sets",
      prayerRestoreSourceSummary: "Altar",
      lootPolicySummary: "3 loot"
    });

    expect(viewModel).toMatchObject({
      primarySkill: "magic",
      primaryLevelLabel: "MAG",
      primaryPrayer: "incredible",
      primaryBoost: "magic",
      extraPrayerCount: 1,
      extraBoostCount: 0,
      prayerSelectionSummary: "incredible + steel skin",
      boostSelectionSummary: "magic",
      setupStatus: "Default setup - custom saved",
      accuracyLabel: "M+%",
      damageLabel: "DMG%",
      derivedAccuracyPlaceholder: "+12",
      derivedDamagePlaceholder: "0",
      derivedSpeedPlaceholder: "2.4"
    });
    expect(viewModel.setupGuide.map((row) => row.target)).toEqual(["loadout", "trip", "loot"]);
    expect(viewModel.setupGuide[0]?.value).toBe("incredible + steel skin · magic");
  });

  it("presents ready, warning and invalid shared setup reviews", () => {
    const envelope = buildShareableSetupEnvelope({
      gameDataId: "revision-274",
      form: DEFAULT_FORM_STATE,
      cannon: { ...DEFAULT_CANNON_SETTINGS, enabled: true },
      lootPreferences: { coins: "loot", bones: "bury" },
      lootSettings: DEFAULT_MONSTER_LOOT_SETTINGS
    });
    const warning = createSharedSetupReviewViewModel({
      inspection: {
        status: "ready",
        review: { envelope, gameDataMismatch: true, droppedLootRowCount: 2 }
      },
      monsters: { [envelope.data.form.monsterId]: { name: "Fixture monster" } }
    });
    const invalid = createSharedSetupReviewViewModel({
      inspection: { status: "error", message: "Invalid fixture" },
      monsters: {}
    });

    expect(warning).toMatchObject({
      status: "ready",
      tone: "warning",
      targetLine: `Fixture monster · ${envelope.data.form.combatStyle}`,
      cannonLabel: "Cannon on",
      lootChoiceLabel: "2 loot choices"
    });
    if (warning.status === "ready") {
      expect(warning.gameDataWarning).toContain("Different game-data version");
      expect(warning.droppedLootWarning).toBe("2 stale loot choices will be skipped.");
    }
    expect(invalid).toEqual({
      status: "error",
      tone: "error",
      statusLabel: "Invalid",
      message: "Invalid fixture"
    });
    expect(describeShareableSetupError(new ShareableSetupError("duplicate_keys", "fixture"))).toBe(
      "Shared setup link contains duplicate data."
    );
  });

  it("builds exact result metrics, fresh Risk details and negative-GP guidance", () => {
    const viewModel = createWorkbenchResultViewModel({
      effectiveDps: 4.25,
      maxHit: 12,
      hitChance: 0.625,
      ttkSec: 30,
      killsPerHour: 100,
      effectiveXpPerHour: 25_000,
      playerEffectiveXpPerHour: 20_000,
      cannonEffectiveXpPerHour: 5_000,
      gpPerHour: 10_000,
      effectiveNetGpPerHour: -2_000,
      supplyCostPerKill: 120,
      gpPerKill: 100,
      supplyGapPerKill: 20,
      supplyCostsExceedLoot: true,
      risk: { horizonMinutes: 60, killTimeSeconds: distribution, timedNetGp: distribution }
    });

    expect(viewModel.metrics.map((metric) => metric.label)).toEqual([
      "DPS",
      "MAX HIT",
      "HIT %",
      "TTK",
      "KILLS/HR",
      "XP/HR",
      "GP/HR",
      "GP/HR NET",
      "SUPPLY/KILL",
      "GP/KILL"
    ]);
    expect(viewModel.metrics.find((metric) => metric.label === "TTK")).toMatchObject({
      value: "30.0s",
      detail: "P10/50/90 10.0 / 20.0 / 30.0s",
      reviewTarget: "risk"
    });
    expect(viewModel.netGpGuidance).toEqual({
      visible: true,
      message: "Supplies 120 GP/kill exceed loot 100 GP/kill by 20 GP."
    });
    expect(viewModel.sidebarMetrics.map((metric) => metric.label)).toEqual([
      "Effective XP/hr",
      "Net GP/hr",
      "Player XP/hr",
      "Cannon XP/hr"
    ]);
  });
});

describe("relocated feature helpers", () => {
  it("keeps deterministic Duel ids, import notices and Loot merge semantics", () => {
    expect(createDuelSnapshotId(1_000, 0.5)).toBe("duel-rs-i");
    expect(describeDuelSnapshotsImportError(new DuelSnapshotsImportError("duplicate_ids"))).toEqual(
      {
        tone: "error",
        message: "Saved setup import failed: the export contains duplicate setup data."
      }
    );
    expect(
      mergeLootPrefsState(
        { goblin: { coins: "loot", bones: "bury" } },
        { goblin: { coins: "skip" }, demon: { ashes: "loot" } }
      )
    ).toEqual({
      goblin: { coins: "skip", bones: "bury" },
      demon: { ashes: "loot" }
    });
  });
});

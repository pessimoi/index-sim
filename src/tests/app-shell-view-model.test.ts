import type { DistributionSummary } from "../domain/risk";
import {
  DEFAULT_CANNON_SETTINGS,
  DEFAULT_FORM_STATE,
  normalizeFormState
} from "../app/state/ui-state";
import { DEFAULT_MONSTER_LOOT_SETTINGS } from "../app/state/loot-settings";
import {
  ShareableSetupError,
  buildShareableSetupEnvelope,
  reviewShareableSetup
} from "../app/state/shareable-setup";
import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  WORKBENCH_TABS,
  createAppShellSetupViewModel,
  createSetupEditorContextViewModel,
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
      setupMode: "default",
      hasCurrentCustomSetup: true,
      currentMonsterLabel: "Hill Giant",
      setupPersistenceKind: "saved",
      weaponName: "Staff of air",
      ammoName: "None",
      spellName: "Fire strike",
      styleName: "Accurate",
      effectiveAccuracy: 88,
      effectiveDamage: 91,
      derivedAccuracyBonus: 12,
      derivedDamageBonus: 0,
      derivedAttackSpeedSec: 2.4,
      setupRequirementWarningCount: 0,
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
      editor: {
        mode: "default",
        modeLabel: "Editing default",
        savedCustomDescription: "Custom setup saved for Hill Giant.",
        persistence: {
          kind: "saved",
          label: "Saved locally",
          description: "Changes save automatically in this browser."
        }
      },
      accuracyLabel: "M+%",
      damageLabel: "DMG%",
      derivedAccuracyPlaceholder: "+12",
      derivedDamagePlaceholder: "0",
      derivedSpeedPlaceholder: "2.4"
    });
    expect(viewModel.setupGuide.map((row) => row.target)).toEqual(["loadout", "trip", "loot"]);
    expect(viewModel.setupGuide[0]?.value).toBe("incredible + steel skin · magic");
    expect(viewModel.playerProfile.rows).toEqual([
      { label: "Weapon", value: "Staff of air" },
      { label: "Spell", value: "Fire strike" },
      { label: "Attack speed", value: "2.4 s" },
      { label: "Effective levels", value: "ACC 88 · DMG 91" },
      { label: "Prayers", value: "incredible + steel skin" },
      { label: "Boosts", value: "magic" },
      { label: "Status", value: "Requirements met", tone: "ready" }
    ]);
  });

  it("builds exact setup mode actions and persistence states", () => {
    const defaultOnly = createSetupEditorContextViewModel({
      setupMode: "default",
      hasCurrentCustomSetup: false,
      currentMonsterLabel: "Hill Giant",
      persistenceKind: "saving"
    });
    const defaultWithCustom = createSetupEditorContextViewModel({
      setupMode: "default",
      hasCurrentCustomSetup: true,
      currentMonsterLabel: "Hill Giant",
      persistenceKind: "session-only"
    });
    const custom = createSetupEditorContextViewModel({
      setupMode: "custom",
      hasCurrentCustomSetup: true,
      currentMonsterLabel: "Hill Giant",
      persistenceKind: "failed"
    });
    const inconsistent = createSetupEditorContextViewModel({
      setupMode: "custom",
      hasCurrentCustomSetup: false,
      currentMonsterLabel: "Hill Giant",
      persistenceKind: "saved"
    });

    expect(defaultOnly).toMatchObject({
      mode: "default",
      modeLabel: "Editing default",
      savedCustomDescription: null,
      persistence: { kind: "saving", label: "Saving…" }
    });
    expect(defaultOnly.actions.map((action) => action.label)).toEqual([
      "Create monster setup",
      "Reset active setup"
    ]);
    expect(defaultOnly.scopeDescription).toContain(
      "Default applies to monsters without their own setup"
    );
    expect(defaultOnly.compactScopeDescription).toContain(
      "Default: monsters without their own setup"
    );

    expect(defaultWithCustom).toMatchObject({
      mode: "default",
      modeLabel: "Editing default",
      savedCustomDescription: "Custom setup saved for Hill Giant.",
      persistence: { kind: "session-only", label: "Session only" }
    });
    expect(defaultWithCustom.actions.map((action) => action.label)).toEqual([
      "Edit monster setup",
      "Remove monster setup",
      "Reset active setup"
    ]);

    expect(custom).toMatchObject({
      mode: "custom",
      modeLabel: "Editing custom",
      savedCustomDescription: null,
      persistence: { kind: "failed", label: "Could not save" }
    });
    expect(custom.actions.map((action) => action.label)).toEqual([
      "Edit default setup",
      "Remove monster setup",
      "Reset active setup"
    ]);
    expect(inconsistent.mode).toBe("default");
    expect(inconsistent.actions.map((action) => action.label)).toEqual([
      "Create monster setup",
      "Reset active setup"
    ]);
  });

  it("presents ready, warning and invalid shared setup reviews", () => {
    const { context } = createGeneratedRuntimeContext();
    const envelope = buildShareableSetupEnvelope({
      gameData: context.gameData,
      form: DEFAULT_FORM_STATE,
      cannon: { ...DEFAULT_CANNON_SETTINGS, enabled: true },
      lootPreferences: { coins: "loot", bones: "bury" },
      lootSettings: DEFAULT_MONSTER_LOOT_SETTINGS
    });
    envelope.context.gameDataId = "another-revision-274-snapshot";
    const warning = createSharedSetupReviewViewModel({
      inspection: {
        status: "ready",
        review: { ...reviewShareableSetup(envelope, context.gameData), droppedLootRowCount: 2 }
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
      lootChoiceLabel: "0 loot choices"
    });
    if (warning.status === "ready") {
      expect(warning.contextMessage).toContain("another Revision 274 snapshot");
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
      value: "30.0 s",
      detail: "P10/50/90 10.0 / 20.0 / 30.0 s",
      reviewTarget: "risk"
    });
    expect(viewModel.netGpGuidance).toEqual({
      visible: true,
      message: "Supplies 120 GP/kill exceed loot 100 GP/kill by 20 GP."
    });
    expect(viewModel.contextMetrics.map((metric) => metric.label)).toEqual([
      "DPS",
      "Effective XP/hr",
      "Net GP/hr"
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

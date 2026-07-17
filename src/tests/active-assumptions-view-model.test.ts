import {
  DEFAULT_FORM_STATE,
  activeAssumptionRow,
  activeAssumptionRows,
  createSimulationViewModel,
  loadBundledLegacyContext
} from "./ui-view-model-fixture";
import type { CombatSetupFormState } from "./ui-view-model-fixture";

describe("rewrite UI view models", () => {
  it("keeps advisory price freshness out of active assumptions", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, {
      ...context,
      priceSet: {
        ...context.priceSet,
        itemPrices: {
          ...context.priceSet.itemPrices,
          chaos_talisman: 500,
          dragon_spear: 39000,
          dragonshield_a: 50000,
          rune_spear: 30000
        }
      }
    });

    expect(result.activeAssumptions).toMatchObject({
      statusLabel: "Default assumptions active",
      totalCount: 0,
      hasActiveRows: false,
      hiddenCount: 0
    });
    expect(result.priceNotices.notes.length).toBeGreaterThan(0);
    expect(result.activeAssumptions.visibleRows).toEqual([]);
    expect(result.activeAssumptions.hiddenRows).toEqual([]);
  });

  it("keeps inherited trip loot settings review-only in active assumptions", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        trip: {
          ...DEFAULT_FORM_STATE.trip,
          alching: true
        }
      },
      context
    );

    expect(activeAssumptionRow(result, "loot-settings")).toMatchObject({
      label: "Loot settings",
      detail: "high alch on",
      reviewTab: "loot"
    });
    expect(activeAssumptionRow(result, "loot-settings")?.resetAction).toBeUndefined();
  });

  it("summarizes enabled cannon settings with a Cannon review target", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context, {
      giant: {
        enabled: true,
        targets: 6,
        respawnSec: 30
      }
    });

    expect(activeAssumptionRow(result, "cannon-enabled")).toMatchObject({
      label: "Cannon",
      value: expect.stringContaining("Enabled"),
      reviewTab: "cannon",
      detail: "targets 6, respawn 30s",
      resetAction: {
        target: "cannon-enabled",
        ariaLabel: "Reset current monster cannon",
        statusLabel: "Current monster cannon reset"
      }
    });
  });

  it("keeps structured money warnings available for UI surfacing", async () => {
    const { context } = await loadBundledLegacyContext();
    const itemPrices = { ...context.priceSet.itemPrices };
    delete itemPrices.uncut_sapphire;
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, {
      ...context,
      priceSet: {
        ...context.priceSet,
        itemPrices: { ...itemPrices, sapphire: 451 }
      }
    });

    expect(result.moneyWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "price-alias-used",
          severity: "info"
        })
      ])
    );
    expect(result.warnings.join("\n")).toContain("Using alias price");
    expect(result.priceNotices.notes).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "price-alias-used" })])
    );
    expect(activeAssumptionRow(result, "price-warnings")).toBeUndefined();
  });

  it("summarizes imported and synced PriceSet modifiers", async () => {
    const { context } = await loadBundledLegacyContext();
    const imported = createSimulationViewModel(DEFAULT_FORM_STATE, {
      ...context,
      priceSet: {
        ...context.priceSet,
        id: "imported-empty",
        label: "Imported empty",
        source: "imported",
        itemPrices: {},
        alchValues: {}
      }
    });
    const synced = createSimulationViewModel(DEFAULT_FORM_STATE, {
      ...context,
      priceSet: {
        ...context.priceSet,
        id: "synced-test",
        label: "Synced test snapshot",
        source: "scraped"
      }
    });

    expect(activeAssumptionRow(imported, "active-price-set")).toMatchObject({
      label: "Active PriceSet",
      value: "Imported",
      detail: "Imported empty",
      reviewTab: "economy"
    });
    expect(activeAssumptionRow(imported, "active-price-set")?.resetAction).toBeUndefined();
    expect(activeAssumptionRow(imported, "price-warnings")).toBeUndefined();
    expect(activeAssumptionRow(synced, "active-price-set")).toMatchObject({
      value: "Synced",
      detail: "Synced test snapshot"
    });
  });

  it("keeps active assumption priority order and five-row visibility stable", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      manualOverrides: {
        accuracyBonus: 12,
        damageBonus: 5,
        attackSpeedSec: 2.4
      },
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        bankSeconds: 120,
        foodCount: 8,
        prayerPotionDoses: 6,
        potionSets: 2,
        protect: "melee",
        safespot: false,
        scarceSpot: true,
        targetsAtSpot: 2,
        respawnSeconds: 45
      }
    };
    const result = createSimulationViewModel(
      form,
      {
        ...context,
        priceSet: {
          ...context.priceSet,
          id: "imported-empty",
          label: "Imported empty",
          source: "imported",
          itemPrices: {},
          alchValues: {}
        }
      },
      {
        giant: {
          enabled: true,
          targets: 4,
          respawnSec: 45
        }
      },
      {},
      {
        giant: {
          highAlch: true,
          overheadSec: 12.5,
          talismanSpot: "overground"
        }
      },
      {
        activeAssumptions: {
          setupMode: "custom",
          hasCustomSetup: true,
          hiddenGearTierCount: 2
        }
      }
    );

    expect(result.activeAssumptions.visibleRows).toHaveLength(5);
    expect(result.activeAssumptions.hiddenCount).toBeGreaterThan(0);
    expect(result.activeAssumptions.visibleRows.map((row) => row.id)).toEqual([
      "custom-setup",
      "cannon-enabled",
      "manual-combat-overrides",
      "active-price-set",
      "loot-settings"
    ]);
    expect(activeAssumptionRows(result).map((row) => row.id)).toEqual([
      "custom-setup",
      "cannon-enabled",
      "manual-combat-overrides",
      "active-price-set",
      "loot-settings",
      "scarce-spot",
      "explicit-safespot",
      "protection-prayer",
      "manual-trip-controls",
      "supply-settings",
      "hidden-gear-tiers"
    ]);
    expect(activeAssumptionRow(result, "hidden-gear-tiers")?.resetAction).toMatchObject({
      target: "hidden-gear-tiers",
      ariaLabel: "Reset hidden gear tiers",
      statusLabel: "Hidden gear tiers shown"
    });
  });

  it("keeps targeted active-assumption resets scoped in the view model", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      manualOverrides: {
        accuracyBonus: 12,
        damageBonus: null,
        attackSpeedSec: null
      },
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        protect: "magic",
        safespot: false,
        scarceSpot: true,
        targetsAtSpot: 6,
        respawnSeconds: 30
      }
    };
    const beforeReset = createSimulationViewModel(form, context, {
      giant: { enabled: true, targets: 6, respawnSec: 30 }
    });
    const afterManualReset = createSimulationViewModel(
      { ...form, manualOverrides: DEFAULT_FORM_STATE.manualOverrides },
      context,
      {
        giant: { enabled: true, targets: 6, respawnSec: 30 }
      }
    );
    const afterSafespotResetForm: CombatSetupFormState = {
      ...form,
      trip: {
        ...form.trip,
        safespot: null
      }
    };
    const afterSafespotReset = createSimulationViewModel(afterSafespotResetForm, context, {
      giant: { enabled: true, targets: 6, respawnSec: 30 }
    });
    const afterScarceResetForm: CombatSetupFormState = {
      ...form,
      trip: {
        ...form.trip,
        scarceSpot: false
      }
    };
    const afterScarceReset = createSimulationViewModel(afterScarceResetForm, context, {
      giant: { enabled: true, targets: 6, respawnSec: 30 }
    });
    const afterCannonReset = createSimulationViewModel(form, context, {});

    expect(activeAssumptionRow(beforeReset, "manual-combat-overrides")).toBeDefined();
    expect(activeAssumptionRow(beforeReset, "explicit-safespot")).toMatchObject({
      label: "Safespot override",
      value: "Off",
      resetAction: {
        target: "explicit-safespot",
        ariaLabel: "Reset safespot override",
        statusLabel: "Safespot override reset to auto"
      }
    });
    expect(activeAssumptionRow(beforeReset, "protection-prayer")).toMatchObject({
      label: "Protection prayer",
      value: "Protect from magic",
      reviewTab: "trip"
    });
    expect(activeAssumptionRow(beforeReset, "protection-prayer")?.resetAction).toBeUndefined();
    expect(activeAssumptionRow(beforeReset, "scarce-spot")?.resetAction).toMatchObject({
      target: "scarce-spot",
      ariaLabel: "Reset scarce spot",
      statusLabel: "Scarce spot disabled; target and respawn values kept"
    });

    expect(activeAssumptionRow(afterManualReset, "manual-combat-overrides")).toBeUndefined();
    expect(activeAssumptionRow(afterManualReset, "explicit-safespot")).toBeDefined();

    expect(activeAssumptionRow(afterSafespotReset, "explicit-safespot")).toBeUndefined();
    expect(activeAssumptionRow(afterSafespotReset, "protection-prayer")).toBeDefined();

    expect(afterScarceResetForm.trip.targetsAtSpot).toBe(6);
    expect(afterScarceResetForm.trip.respawnSeconds).toBe(30);
    expect(activeAssumptionRow(afterScarceReset, "scarce-spot")).toBeUndefined();
    expect(activeAssumptionRow(afterScarceReset, "explicit-safespot")).toBeDefined();

    expect(afterCannonReset.trip.cannon).toBeNull();
    expect(afterCannonReset.trip.trip.scarce.enabled).toBe(true);
    expect(afterCannonReset.trip.trip.scarce.targetsAtSpot).toBe(6);
    expect(afterCannonReset.trip.trip.scarce.respawnSeconds).toBe(30);
    expect(activeAssumptionRow(afterCannonReset, "cannon-enabled")).toBeUndefined();
    expect(activeAssumptionRow(afterCannonReset, "scarce-spot")).toBeDefined();
  });
});

import {
  DEFAULT_FORM_STATE,
  activeAssumptionRow,
  createGeneratedRuntimeContext,
  createSimulationViewModel,
  loadBundledLegacyContext,
  optimizeLootPrefsForMonster
} from "./ui-view-model-fixture";
import type { CombatSetupFormState, SimulationContext } from "./ui-view-model-fixture";

describe("rewrite UI view models", () => {
  it("builds full current-monster loot rows with stable duplicate-safe row ids", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      monsterId: "jogre"
    };
    const base = createSimulationViewModel(form, context);
    const bigBonesRows = base.lootRows.filter((row) => row.name.startsWith("Big bones"));
    const skipped = createSimulationViewModel(
      form,
      context,
      {},
      { [bigBonesRows[1]!.rowId]: "skip" }
    );

    expect(base.lootRows.length).toBeGreaterThan(base.topLoot.length);
    expect(bigBonesRows.length).toBeGreaterThanOrEqual(2);
    expect(new Set(bigBonesRows.map((row) => row.rowId)).size).toBe(bigBonesRows.length);
    expect(skipped.request).not.toHaveProperty("lootPrefs");
    expect(skipped.lootRows.find((row) => row.rowId === bigBonesRows[1]!.rowId)?.pref).toBe("skip");
    expect(skipped.lootRows.find((row) => row.rowId === bigBonesRows[0]!.rowId)?.pref).toBe(
      base.lootRows.find((row) => row.rowId === bigBonesRows[0]!.rowId)?.pref
    );
  });

  it("builds loot value composition with top contributors, tail grouping and full nested rows", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      monsterId: "firegiant"
    };
    const result = createSimulationViewModel(form, context);
    const composition = result.lootSummary.valueComposition;
    const positiveRows = result.lootRows
      .filter((row) => row.effectiveEvGp > 0)
      .sort((left, right) => right.effectiveEvGp - left.effectiveEvGp);
    const otherRow = composition.rows.find((row) => row.isOther);
    const nestedRow = result.lootRows.find((row) => row.expandedRows.length > 8);

    expect(positiveRows.length).toBeGreaterThan(8);
    expect(composition.rows[0]?.rowId).toBe(positiveRows[0]?.rowId);
    expect(composition.rows[0]?.shareOfPositivePct).toBeGreaterThan(0);
    expect(otherRow?.name).toBe("Other drops");
    expect(composition.rows.reduce((sum, row) => sum + row.gpPerKill, 0)).toBeCloseTo(
      composition.positiveGpPerKill,
      6
    );
    expect(composition.displayedGpPerKill).toBeCloseTo(result.trip.gpPerKill, 6);
    expect(nestedRow).toBeDefined();
    expect(nestedRow?.expandedRows.length).toBeGreaterThan(8);
    expect(nestedRow?.expandedRows.every((row) => row.weightLabel !== null)).toBe(true);
  });

  it("exposes sensible loot actions and per-action net GP/hr impacts", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        alching: true
      }
    };
    const result = createSimulationViewModel(form, context);
    const bones = result.lootRows.find((row) => row.name === "Big bones");
    const herb = result.lootRows.find((row) => row.tag === "herb");
    const gem = result.lootRows.find((row) => row.tag === "gem");
    const alchResult = createSimulationViewModel({ ...form, monsterId: "green_dragon" }, context);
    const alchable = alchResult.lootRows.find((row) => row.availableActions.includes("alch"));

    expect(bones?.availableActions).toEqual(expect.arrayContaining(["loot", "skip", "bury"]));
    expect(herb?.availableActions).toEqual(
      expect.arrayContaining(["loot", "skip", "unid", "value"])
    );
    expect(gem?.availableActions).toEqual(expect.arrayContaining(["loot", "skip", "value"]));
    expect(alchable).toBeDefined();
    expect(alchable?.availableActions).toContain("alch");
    expect(bones?.actionImpacts.length).toBe(bones?.availableActions.length);
    expect(Number.isFinite(bones?.selectedDeltaNetGpPerHour ?? NaN)).toBe(true);
    expect(bones?.prefLabel).toBe("Bury");
    expect(bones?.effectiveEvGp).toBe(0);
    expect(bones?.valueDetails.some((detail) => detail.label === "Bury prayer XP")).toBe(true);
    const buryImpact = bones?.actionImpacts.find((impact) => impact.action === "bury");
    const lootImpact = bones?.actionImpacts.find((impact) => impact.action === "loot");
    const skipImpact = bones?.actionImpacts.find((impact) => impact.action === "skip");
    expect(buryImpact?.label).toBe("Bury");
    expect(buryImpact?.isSelected).toBe(true);
    expect(buryImpact?.isDefault).toBe(true);
    expect(buryImpact?.notes.some((note) => note.includes("Prayer XP/kill"))).toBe(true);
    expect(lootImpact?.gpPerKillContribution).toBeGreaterThan(0);
    expect(skipImpact?.gpPerKillContribution).toBe(0);
  });

  it("surfaces source-weighted unid herb valuation and generic proxy use", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      monsterId: "giant"
    };
    const base = createSimulationViewModel(form, context);
    const baseHerb = base.lootRows.find((row) => row.tag === "herb");
    expect(baseHerb).toBeDefined();
    if (!baseHerb) throw new Error("Missing random herb row");

    const result = createSimulationViewModel(form, context, {}, { [baseHerb.rowId]: "unid" });
    const herb = result.lootRows.find((row) => row.rowId === baseHerb.rowId);
    const unidImpact = herb?.actionImpacts.find((impact) => impact.action === "unid");

    expect(herb?.pref).toBe("unid");
    expect(herb?.price).toBe(context.priceSet.itemPrices.unidentified_guam);
    expect(herb?.expandedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "unidentified_ranarr",
          notes: expect.arrayContaining(["Uses generic unidentified-herb price proxy"])
        })
      ])
    );
    expect(unidImpact?.notes).toContain("Uses source-weighted unidentified herb values");
    expect(result.moneyWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unidentified-herb-price-approximation" })
      ])
    );
  });

  it("presents ordinary caskets as opened component EV without parent price history", () => {
    const { context } = createGeneratedRuntimeContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      monsterId: "rock_crab"
    };
    const result = createSimulationViewModel(
      form,
      context,
      {},
      {},
      {},
      {
        lootPriceHistoryByItem: {
          casket: {
            itemId: "casket",
            itemLabel: "Casket",
            latestPrice: 50,
            baselinePrice: 40,
            gpDelta: 10,
            percentDelta: 25,
            latestLabel: "Latest",
            baselineLabel: "Baseline"
          }
        }
      }
    );
    const casket = result.lootRows.find((row) => row.tag === "casket");

    expect(casket).toBeDefined();
    expect(casket?.price).not.toBe(context.priceSet.itemPrices.casket);
    expect(casket?.valueDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Valuation", value: "Opened contents EV" })
      ])
    );
    expect(casket?.expandedRows).toHaveLength(8);
    expect(casket?.expandedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Coins",
          key: "coins",
          chance: 60 / 128,
          qty: 210,
          price: 1,
          displayLabel: {
            name: "Coins",
            technicalId: "coins",
            source: "game-data"
          },
          notes: expect.arrayContaining(["Face value; six equiprobable coin amounts"])
        }),
        expect.objectContaining({ key: "tooth_half_key", chance: 1 / 128 }),
        expect.objectContaining({ key: "loop_half_key", chance: 1 / 128 })
      ])
    );
    expect(casket?.expandedRows.reduce((sum, row) => sum + (row.evGp ?? 0), 0)).toBeCloseTo(
      casket?.effectiveEvGp ?? 0,
      10
    );
    expect(casket?.historyContext).toMatchObject({
      itemId: null,
      tracked: false,
      statusLabel: "Component-derived",
      emptyMessage: expect.stringContaining("parent casket history is not used")
    });
  });

  it("shows generated conditional loot as a locked, sanitized zero-value row", async () => {
    const { context } = await loadBundledLegacyContext();
    const conditionalContext: SimulationContext = {
      ...context,
      gameData: {
        ...context.gameData,
        monsters: {
          ...context.gameData.monsters,
          greater_demon: {
            ...context.gameData.monsters.greater_demon,
            loot: [
              ...(context.gameData.monsters.greater_demon.loot ?? []),
              {
                name: "Clue scroll (hard)",
                tag: "clue_hard",
                chance: 1 / 128,
                qtyAvg: 1,
                eligibility: {
                  kind: "clue",
                  tier: "hard",
                  membersOnly: true,
                  requiresNoClue: true
                }
              }
            ]
          }
        }
      }
    };
    const result = createSimulationViewModel(
      { ...DEFAULT_FORM_STATE, monsterId: "greater_demon" },
      conditionalContext,
      {},
      { "Clue scroll (hard)": "loot" }
    );
    const clue = result.lootRows.find((row) => row.tag === "clue_hard");

    expect(clue).toMatchObject({
      name: "Clue scroll (hard)",
      pref: "skip",
      availableActions: ["skip"],
      effectiveEvGp: 0,
      stateLabel: "Clue eligibility not modeled",
      eligibilityDescription: "Requires a members area and no existing clue scroll.",
      isOverride: false
    });
    expect(clue?.valueDetails).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Eligibility", tone: "warning" })])
    );
  });

  it("labels trip-layer eaten or displaced loot rows in the view model when present", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        monsterId: "green_dragon",
        trip: {
          ...DEFAULT_FORM_STATE.trip,
          foodKey: "none",
          foodCount: 0,
          foodPerKillOverride: 0,
          safespot: false,
          protect: "none",
          teleport: true,
          bankSeconds: 300,
          prayerMode: "none",
          antifire: true
        }
      },
      context
    );
    const stateful = result.lootRows.find((row) => row.stateLabel !== null);

    expect(stateful).toBeDefined();
    expect(stateful?.stateLabel).toBe("Displaced by inventory");
    expect(stateful?.effectiveEvGp).toBe(0);
    expect(stateful?.valueDetails.some((detail) => detail.label === "Trip state")).toBe(true);
  });

  it("adds browser-local price history context to loot rows without changing loot math", async () => {
    const { context } = await loadBundledLegacyContext();
    const base = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const withHistory = createSimulationViewModel(
      DEFAULT_FORM_STATE,
      context,
      {},
      {},
      {},
      {
        lootPriceHistoryByItem: {
          big_bones: {
            itemId: "big_bones",
            itemLabel: "Big bones",
            latestPrice: 350,
            baselinePrice: 500,
            gpDelta: -150,
            percentDelta: -30,
            latestLabel: "Latest test prices",
            baselineLabel: "Previous test prices"
          }
        }
      }
    );
    const parentOnlyModel = createSimulationViewModel(
      { ...DEFAULT_FORM_STATE, monsterId: "firegiant" },
      context,
      {},
      {},
      {},
      { lootPriceHistoryByItem: {} }
    );
    const bones = withHistory.lootRows.find((row) => row.key === "big_bones");
    const untracked = withHistory.lootRows.find((row) => row.key && row.key !== "big_bones");
    const parentOnly = parentOnlyModel.lootRows.find((row) => row.key === null);

    expect(withHistory.trip.gpPerKill).toBeCloseTo(base.trip.gpPerKill, 6);
    expect(withHistory.trip.effectiveNetGpPerHour).toBeCloseTo(base.trip.effectiveNetGpPerHour, 6);
    expect(bones?.historyContext).toMatchObject({
      itemId: "big_bones",
      itemLabel: "Big bones",
      tracked: true,
      latestPrice: 350,
      baselinePrice: 500,
      gpDelta: -150,
      percentDelta: -30,
      statusLabel: "Tracked"
    });
    expect(untracked?.historyContext.statusLabel).toBe("No history");
    expect(parentOnly?.historyContext.statusLabel).toBe("No item key");
  });

  it("normalizes malformed loot price history display numbers to a neutral missing state", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(
      DEFAULT_FORM_STATE,
      context,
      {},
      {},
      {},
      {
        lootPriceHistoryByItem: {
          big_bones: {
            itemId: "big_bones",
            latestPrice: Number.POSITIVE_INFINITY,
            baselinePrice: Number.NaN,
            gpDelta: Number.NEGATIVE_INFINITY,
            percentDelta: Number.POSITIVE_INFINITY,
            latestLabel: "Malformed latest",
            baselineLabel: "Malformed baseline"
          }
        }
      }
    );
    const bones = result.lootRows.find((row) => row.key === "big_bones");

    expect(bones?.historyContext.tracked).toBe(true);
    expect(bones?.historyContext.latestPrice).toBeNull();
    expect(bones?.historyContext.baselinePrice).toBeNull();
    expect(bones?.historyContext.gpDelta).toBeNull();
    expect(bones?.historyContext.percentDelta).toBeNull();
  });

  it("applies per-monster high-alch, overhead and talisman loot settings", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      monsterId: "green_dragon"
    };
    const alchEnabled = createSimulationViewModel(
      form,
      context,
      {},
      {},
      {
        green_dragon: {
          highAlch: true,
          overheadSec: null,
          talismanSpot: "underground"
        }
      }
    );
    const alchable = alchEnabled.lootRows.find((row) => row.availableActions.includes("alch"));
    expect(alchable).toBeDefined();
    if (!alchable) throw new Error("Expected green dragon to have an alchable drop");

    const forcedAlch = createSimulationViewModel(
      form,
      context,
      {},
      { [alchable.rowId]: "alch" },
      {
        green_dragon: {
          highAlch: true,
          overheadSec: null,
          talismanSpot: "underground"
        }
      }
    );
    const alchDisabled = createSimulationViewModel(
      form,
      context,
      {},
      { [alchable.rowId]: "alch" },
      {
        green_dragon: {
          highAlch: false,
          overheadSec: null,
          talismanSpot: "underground"
        }
      }
    );
    const slowOverhead = createSimulationViewModel(
      form,
      context,
      {},
      {},
      {
        green_dragon: {
          highAlch: false,
          overheadSec: 60,
          talismanSpot: "underground"
        }
      }
    );
    const overground = createSimulationViewModel(
      form,
      context,
      {},
      {},
      {
        green_dragon: {
          highAlch: false,
          overheadSec: null,
          talismanSpot: "overground"
        }
      }
    );

    expect(forcedAlch.lootRows.find((row) => row.rowId === alchable.rowId)?.pref).toBe("alch");
    expect(alchDisabled.lootRows.find((row) => row.rowId === alchable.rowId)?.pref).not.toBe(
      "alch"
    );
    expect(forcedAlch.trip.alchCastsPerKill).toBeGreaterThan(alchDisabled.trip.alchCastsPerKill);
    expect(slowOverhead.trip.killsPerHour).toBeLessThan(alchDisabled.trip.killsPerHour);
    expect(overground.trip.gpPerKill).not.toBe(alchDisabled.trip.gpPerKill);

    const overrideAction = alchable.availableActions.find(
      (action) => action !== alchable.defaultPref
    );
    expect(overrideAction).toBeDefined();
    if (!overrideAction) throw new Error("Expected an available loot override action");
    const summarized = createSimulationViewModel(
      form,
      context,
      {},
      { [alchable.rowId]: overrideAction },
      {
        green_dragon: {
          highAlch: true,
          overheadSec: 12.5,
          talismanSpot: "overground"
        }
      }
    );
    expect(activeAssumptionRow(summarized, "loot-settings")).toMatchObject({
      label: "Loot settings",
      reviewTab: "loot",
      detail: expect.stringContaining("high alch on"),
      resetAction: {
        target: "loot-settings",
        ariaLabel: "Reset current monster loot settings",
        statusLabel: "Current monster loot settings reset"
      }
    });
    expect(activeAssumptionRow(summarized, "loot-settings")?.detail).toContain("overhead 12.5 s");
    expect(activeAssumptionRow(summarized, "loot-settings")?.detail).toContain(
      "talisman overground"
    );
    expect(activeAssumptionRow(summarized, "loot-action-overrides")).toMatchObject({
      label: "Loot action overrides",
      value: "1 drop",
      reviewTab: "loot",
      resetAction: {
        target: "loot-action-overrides",
        ariaLabel: "Reset current monster loot overrides",
        statusLabel: "Current monster loot overrides reset"
      }
    });

    const afterLootSettingsReset = createSimulationViewModel(
      form,
      context,
      {},
      { [alchable.rowId]: overrideAction },
      {}
    );
    expect(activeAssumptionRow(afterLootSettingsReset, "loot-settings")).toBeUndefined();
    expect(activeAssumptionRow(afterLootSettingsReset, "loot-action-overrides")).toBeDefined();

    const afterLootPrefsReset = createSimulationViewModel(
      form,
      context,
      {},
      {},
      {
        green_dragon: {
          highAlch: true,
          overheadSec: 12.5,
          talismanSpot: "overground"
        }
      }
    );
    expect(activeAssumptionRow(afterLootPrefsReset, "loot-settings")).toBeDefined();
    expect(activeAssumptionRow(afterLootPrefsReset, "loot-action-overrides")).toBeUndefined();
  });

  it("optimizes loot prefs deterministically from canonical defaults", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        alching: true
      }
    };
    const base = createSimulationViewModel(form, context);
    const first = optimizeLootPrefsForMonster(form, context);
    const second = optimizeLootPrefsForMonster(form, context);
    const optimized = createSimulationViewModel(form, context, {}, first.prefs);

    expect(first).toEqual(second);
    expect(first.iterations).toBeLessThanOrEqual(30);
    expect(optimized.trip.effectiveNetGpPerHour).toBeGreaterThanOrEqual(
      base.trip.effectiveNetGpPerHour
    );
  });
});

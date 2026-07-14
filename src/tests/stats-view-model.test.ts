import {
  DEFAULT_FORM_STATE,
  HIGH_ALCH_MAGIC_XP_PER_CAST,
  activeAssumptionRow,
  combatRollMetrics,
  createSimulationViewModel,
  createStatsCombatRollDetailViewModel,
  formToSimulationRequest,
  formToTripPolicy,
  formatNumber,
  loadBundledLegacyContext,
  normalizeFormState,
  rangedDagannothForm,
  rangedRockCrabForm,
  simulateFullSimulation,
  statsSourceDetail,
  statsSourceMetrics,
  switchCombatStyleLoadout
} from "./ui-view-model-fixture";
import type { CombatSetupFormState } from "./ui-view-model-fixture";

describe("rewrite UI view models", () => {
  it("maps selected melee special attack into SimulationRequest only when valid", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      weaponId: "dragon_dagger_p",
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    };
    const invalidForm = {
      ...form,
      specialAttack: { weaponId: "magic_shortbow", ammoId: "rune_arrow" }
    };
    const dbaBoostForm: CombatSetupFormState = {
      ...form,
      boosts: ["dba_spec", "super_att"],
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    };
    const magicForm = normalizeFormState({
      ...switchCombatStyleLoadout(form, "magic"),
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    });

    expect(formToSimulationRequest(form, context.gameData).specialAttack).toEqual({
      weaponId: "dragon_dagger_p"
    });
    expect(formToSimulationRequest(invalidForm, context.gameData).specialAttack).toBeUndefined();
    expect(formToSimulationRequest(dbaBoostForm, context.gameData).specialAttack).toBeUndefined();
    expect(formToSimulationRequest(magicForm, context.gameData).specialAttack).toBeUndefined();
    expect(createSimulationViewModel(dbaBoostForm, context).combat.specialAttack).toBeNull();
    const dbaBoostResult = createSimulationViewModel(dbaBoostForm, context);
    const dbaSpecialDetail = statsSourceDetail(dbaBoostResult, "special-attack");
    const dbaSpecialMetrics = statsSourceMetrics(dbaSpecialDetail);

    expect(dbaSpecialDetail).toMatchObject({
      status: "inactive",
      statusLabel: "inactive",
      histogram: null,
      warnings: []
    });
    expect(dbaSpecialDetail?.notes.join("\n")).toContain(
      "DBA special boost is modeled as a boost, not a DPS special attack."
    );
    expect(dbaSpecialMetrics.get("dps")).toMatchObject({ value: "-", numericValue: null });
    expect(magicForm.specialAttack).toEqual({ weaponId: "none", ammoId: "none" });
  });

  it("maps ranged special attack ammo through current valid arrow fallback", async () => {
    const { context } = await loadBundledLegacyContext();
    const thrownMainForm: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      combatStyle: "ranged",
      monsterId: "greater_demon",
      weaponId: "rune_knife_w",
      ammoId: "none",
      styleId: "rapid",
      specialAttack: { weaponId: "magic_shortbow", ammoId: "none" }
    };
    const bowMainForm: CombatSetupFormState = {
      ...thrownMainForm,
      weaponId: "magic_shortbow",
      ammoId: "mith_arrow",
      specialAttack: { weaponId: "magic_shortbow", ammoId: "none" }
    };

    expect(formToSimulationRequest(thrownMainForm, context.gameData).specialAttack).toEqual({
      weaponId: "magic_shortbow",
      ammoId: "rune_arrow"
    });
    expect(formToSimulationRequest(bowMainForm, context.gameData).specialAttack).toEqual({
      weaponId: "magic_shortbow",
      ammoId: "mith_arrow"
    });
    const rangedResult = createSimulationViewModel(bowMainForm, context);
    const rangedSpecialDetail = statsSourceDetail(rangedResult, "special-attack");
    const rangedSpecialMetrics = statsSourceMetrics(rangedSpecialDetail);

    expect(rangedResult.combat.specialAttack?.key).toBe("magic_shortbow");
    expect(rangedSpecialDetail).toMatchObject({
      status: "modeled",
      statusLabel: "modeled",
      histogramScopeLabel: "Per special hit",
      warnings: []
    });
    expect(rangedSpecialDetail?.histogram).toMatchObject({
      hitChance: rangedResult.combat.specialAttack?.hitChance,
      maxHit: rangedResult.combat.specialAttack?.maxHit
    });
    expect(rangedSpecialDetail?.histogram?.probabilityTotal).toBeCloseTo(1);
    expect(rangedSpecialMetrics.get("specs-hr")?.numericValue).toBeGreaterThan(0);
    expect(rangedSpecialMetrics.get("spec-weapon")?.value).toBe("Magic shortbow");
    expect(rangedSpecialMetrics.get("dps-with-spec")?.numericValue).toBe(
      rangedResult.combat.specialAttack?.dpsWithSpec
    );
    expect(rangedSpecialMetrics.get("dps-gain")?.numericValue).toBe(
      rangedResult.combat.specialAttack?.dpsGainPct
    );
  });

  it("exposes special attack metrics in the simulation view model", async () => {
    const { context } = await loadBundledLegacyContext();
    const form: CombatSetupFormState = {
      ...DEFAULT_FORM_STATE,
      weaponId: "dragon_dagger_p",
      specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
    };
    const result = createSimulationViewModel(form, context);
    const specialDetail = statsSourceDetail(result, "special-attack");
    const specialMetrics = statsSourceMetrics(specialDetail);

    expect(result.request.specialAttack).toEqual({ weaponId: "dragon_dagger_p" });
    expect(result.combat.specialAttack).toMatchObject({
      key: "dragon_dagger_p",
      weaponName: "Dragon dagger(p)",
      hits: 2
    });
    expect(result.combat.specialAttack?.maxHit).toBeGreaterThan(0);
    expect(result.combat.specialAttack?.specsPerHour).toBeGreaterThan(0);
    expect(result.combat.effectiveDps).toBe(result.combat.specialAttack?.dpsWithSpec);
    expect(result.specialWarnings).toEqual([]);
    expect(
      result.statsSourceBreakdown.rows.find((row) => row.id === "special-attack")
    ).toMatchObject({
      label: "Special attack",
      status: "modeled",
      dpsGainPct: result.combat.specialAttack?.dpsGainPct,
      hitChance: result.combat.specialAttack?.hitChance,
      maxHit: result.combat.specialAttack?.maxHit
    });
    expect(result.statsSourceBreakdown.rows.find((row) => row.id === "special-attack")?.dps).toBe(
      (result.combat.specialAttack?.dpsWithSpec ?? 0) - (result.combat.specialAttack?.dpsBase ?? 0)
    );
    expect(specialDetail).toMatchObject({
      id: "special-attack",
      label: "Special attack",
      status: "modeled",
      statusLabel: "modeled",
      histogramScopeLabel: "Per special hit",
      warnings: []
    });
    expect(specialDetail?.histogram?.averageHit).toBeCloseTo(
      (result.combat.specialAttack?.expPerSpec ?? 0) / (result.combat.specialAttack?.hits ?? 1)
    );
    expect(specialDetail?.histogram?.probabilityTotal).toBeCloseTo(1);
    expect(specialMetrics.get("dps-gain")?.numericValue).toBe(
      result.combat.specialAttack?.dpsGainPct
    );
    expect(specialMetrics.get("spec-weapon")?.value).toBe("Dragon dagger(p)");
    expect(specialMetrics.get("dps-with-spec")?.numericValue).toBe(
      result.combat.specialAttack?.dpsWithSpec
    );
    expect(specialMetrics.get("specs-hr")?.numericValue).toBe(
      result.combat.specialAttack?.specsPerHour
    );
    expect(specialMetrics.get("hits")?.numericValue).toBe(result.combat.specialAttack?.hits);
    expect(specialDetail?.notes.join("\n")).toContain(
      "Special attack XP is included in player combat XP/hr"
    );
    const comparisonSpecial = result.hitDistributionComparison.series.find(
      (series) => series.id === "special"
    );
    expect(comparisonSpecial?.label).toBe("Special: Dragon dagger(p) (switch)");
    expect(comparisonSpecial?.scopeLabel).toBe("One complete special attack");
    expect(comparisonSpecial?.distribution.averageHit).toBeCloseTo(
      result.combat.specialAttack?.expPerSpec ?? 0
    );
    expect(comparisonSpecial?.distribution.maxHit).toBe(
      (result.combat.specialAttack?.maxHit ?? 0) * (result.combat.specialAttack?.hits ?? 0)
    );
    expect(comparisonSpecial?.distribution.probabilityTotal).toBeCloseTo(1);
    expect(result.hitDistributionComparison.targetHp).toBe(
      context.gameData.monsters[form.monsterId]?.hp
    );
    expect(result.hitDistributionComparison.targetMarkerPercent).not.toBeNull();
    expect(result.hitDistributionComparison.series[0]?.koChance).toBe(0);
    expect(comparisonSpecial?.koChance).toBeGreaterThan(0);
  });

  it("surfaces dragon halberd NPC-size fallback warning only for that special path", async () => {
    const { context } = await loadBundledLegacyContext();
    const warningText =
      "NPC size data is not modeled; dragon halberd second-hit behavior follows the current legacy fixture assumption.";
    const daggerResult = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        weaponId: "dragon_dagger_p",
        specialAttack: { weaponId: "dragon_dagger_p", ammoId: "none" }
      },
      context
    );
    const halberdResult = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        monsterId: "rock_crab",
        weaponId: "dragon_halberd",
        styleId: "aggressive",
        gear: { ...DEFAULT_FORM_STATE.gear, shield: "none" },
        boosts: ["super_att", "super_str"],
        specialAttack: { weaponId: "dragon_halberd", ammoId: "none" }
      },
      context
    );

    expect(daggerResult.specialWarnings).toEqual([]);
    expect(halberdResult.combat.specialAttack?.key).toBe("dragon_halberd");
    expect(halberdResult.specialWarnings).toEqual([
      {
        code: "dragon-halberd-npc-size-fallback",
        severity: "info",
        message: warningText
      }
    ]);
    expect(halberdResult.warnings).toContain(warningText);
    expect(activeAssumptionRow(halberdResult, "special-warnings")).toMatchObject({
      label: "Special attack assumption",
      reviewTab: "melee",
      detail: warningText
    });
    expect(
      halberdResult.statsSourceBreakdown.rows.find((row) => row.id === "special-attack")
    ).toMatchObject({
      label: "Special attack",
      status: "partial",
      statusLabel: "partial"
    });
    expect(
      halberdResult.statsSourceBreakdown.rows
        .find((row) => row.id === "special-attack")
        ?.notes.join("\n")
    ).toContain(warningText);
    expect(statsSourceDetail(halberdResult, "special-attack")).toMatchObject({
      status: "partial",
      statusLabel: "partial",
      histogramScopeLabel: "Per special hit",
      warnings: halberdResult.specialWarnings
    });
    expect(
      statsSourceDetail(halberdResult, "special-attack")?.histogram?.probabilityTotal
    ).toBeCloseTo(1);
    expect(statsSourceDetail(halberdResult, "special-attack")?.notes.join("\n")).toContain(
      warningText
    );
  });

  it("builds hit distribution histogram data from the combat result", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const distribution = result.hitDistribution;
    const probabilityTotal = distribution.buckets.reduce(
      (sum, bucket) => sum + bucket.probability,
      0
    );
    const missBucket = distribution.buckets[0]!;
    const zeroBucket = distribution.buckets[1]!;
    const maxBucket = distribution.buckets.find((bucket) => bucket.isMaxHit);

    expect(distribution.hitChance).toBeCloseTo(result.combat.hitChance);
    expect(distribution.averageHit).toBeCloseTo(result.combat.avgHit);
    expect(distribution.maxHit).toBe(result.combat.peakMaxHit);
    expect(distribution.hitChanceLabel).toBe(`${formatNumber(result.combat.hitChance * 100, 1)}%`);
    expect(distribution.averageHitLabel).toBe(formatNumber(result.combat.avgHit, 2));
    expect(distribution.maxHitLabel).toBe(formatNumber(result.combat.peakMaxHit));
    expect(probabilityTotal).toBeCloseTo(1);
    expect(distribution.probabilityTotal).toBeCloseTo(1);
    expect(missBucket).toMatchObject({
      id: "miss",
      label: "Miss",
      isMiss: true
    });
    expect(missBucket.ariaLabel).toContain("miss");
    expect(zeroBucket).toMatchObject({
      id: "damage-0",
      label: "0",
      isMiss: false,
      isAccurateZero: true
    });
    expect(zeroBucket.ariaLabel).toContain("accurate zero damage");
    expect(zeroBucket.cumulativeAtLeast).toBeCloseTo(result.combat.hitChance);
    expect(maxBucket).toBeDefined();
    expect(maxBucket?.ariaLabel).toContain("max hit bucket");
    expect(result.hitDistributionComparison.series).toHaveLength(1);
    expect(result.hitDistributionComparison.buckets[0]?.label).toBe("Miss");
    expect(result.hitDistributionComparison.targetHp).toBeGreaterThan(0);
  }, 15_000);

  it("omits transient hit-distribution presentation data from explicit rates-only paths", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(
      DEFAULT_FORM_STATE,
      context,
      {},
      {},
      {},
      {
        includeLootRows: false,
        includeHitDistributionAnalysis: false
      }
    );

    expect(result.hitDistribution.buckets).toEqual([]);
    expect(result.hitDistributionComparison.series).toEqual([]);
    expect(result.hitDistributionComparison.buckets).toEqual([]);
    expect(result.statsSourceBreakdown.details.every((detail) => detail.histogram == null)).toBe(
      true
    );
  });

  it("builds default melee Stats combat roll detail metrics from current result data", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const metrics = combatRollMetrics(result);

    expect(result.combatRollDetail).toMatchObject({
      status: "modeled",
      statusLabel: "modeled"
    });
    expect(metrics.get("effective-accuracy")).toMatchObject({
      value: formatNumber(result.combat.debug.effectiveAccuracy),
      numericValue: result.combat.debug.effectiveAccuracy
    });
    expect(metrics.get("effective-damage")).toMatchObject({
      value: formatNumber(result.combat.debug.effectiveDamage),
      numericValue: result.combat.debug.effectiveDamage
    });
    expect(metrics.get("attack-roll")).toMatchObject({
      value: formatNumber(result.combat.attackRoll),
      numericValue: result.combat.attackRoll
    });
    expect(metrics.get("defence-roll")).toMatchObject({
      value: formatNumber(result.combat.defenceRoll),
      numericValue: result.combat.defenceRoll
    });
    expect(metrics.get("hit-chance")).toMatchObject({
      value: `${formatNumber(result.combat.hitChance * 100, 1)}%`,
      numericValue: result.combat.hitChance
    });
    expect(metrics.get("max-hit")).toMatchObject({
      value: formatNumber(result.combat.maxHit, 1),
      numericValue: result.combat.maxHit
    });
    expect(metrics.get("average-hit")).toMatchObject({
      value: formatNumber(result.hitDistribution.averageHit, 2),
      numericValue: result.hitDistribution.averageHit
    });
    expect(metrics.get("attack-speed")).toMatchObject({
      value: `${formatNumber(result.combat.attackSpeedSec, 1)}s`,
      numericValue: result.combat.attackSpeedSec
    });
    expect(metrics.get("attack-cycle")).toMatchObject({
      value: `${formatNumber(result.combat.attackTicks, 1)} ticks`,
      numericValue: result.combat.attackTicks
    });
    expect(metrics.get("ttk")?.numericValue).toBe(result.combat.ttkSec);
    expect(metrics.get("kills-per-hour")?.numericValue).toBe(result.trip.killsPerHour);
    expect(metrics.get("gp-per-kill")?.numericValue).toBe(result.trip.gpPerKill);
    expect(result.combatRollDetail.notes.join("\n")).toContain(
      "Roll and hit metrics describe the normal player attack."
    );
  }, 15_000);

  it("builds ranged Stats combat roll detail without melee-only assumptions", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(rangedRockCrabForm(), context);
    const metrics = combatRollMetrics(result);
    const notes = result.combatRollDetail.metrics.map((metric) => metric.note).join("\n");

    expect(result.request.combatStyle).toBe("ranged");
    expect(result.combatRollDetail.status).toBe("modeled");
    expect(metrics.get("effective-accuracy")?.numericValue).toBe(
      result.combat.debug.effectiveAccuracy
    );
    expect(metrics.get("effective-damage")?.numericValue).toBe(result.combat.debug.effectiveDamage);
    expect(metrics.get("hit-chance")?.numericValue).toBe(result.combat.hitChance);
    expect(metrics.get("attack-cycle")?.numericValue).toBe(result.combat.attackTicks);
    expect(metrics.get("ttk")?.numericValue).toBe(result.combat.ttkSec);
    expect(notes.toLowerCase()).not.toContain("melee");
  }, 15_000);

  it("builds magic Stats combat roll detail without special or cannon histogram claims", async () => {
    const { context } = await loadBundledLegacyContext();
    const magicForm = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "magic"),
      weaponId: "staff_of_fire",
      spellId: "fire_wave",
      styleId: "accurate"
    });
    const result = createSimulationViewModel(magicForm, context);
    const metrics = combatRollMetrics(result);

    expect(result.request.combatStyle).toBe("magic");
    expect(result.combatRollDetail.status).toBe("modeled");
    expect(metrics.get("effective-accuracy")?.numericValue).toBe(
      result.combat.debug.effectiveAccuracy
    );
    expect(metrics.get("average-hit")?.numericValue).toBe(result.hitDistribution.averageHit);
    expect(statsSourceDetail(result, "special-attack")?.histogram).toBeNull();
    expect(statsSourceDetail(result, "cannon")?.histogram).toBeNull();
  }, 15_000);

  it("renders unavailable Stats combat roll values as fallbacks instead of zero", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const detail = createStatsCombatRollDetailViewModel({
      combat: {
        ...result.combat,
        attackRoll: Number.NaN,
        hitChance: Number.NaN,
        maxHit: Number.NaN,
        attackTicks: Number.NaN,
        attackSpeedSec: Number.NaN,
        ttkSec: Number.POSITIVE_INFINITY,
        debug: {
          ...result.combat.debug,
          effectiveAccuracy: Number.NaN
        }
      },
      trip: {
        ...result.trip,
        killsPerHour: Number.NaN,
        gpPerKill: Number.NaN
      },
      hitDistribution: {
        ...result.hitDistribution,
        averageHit: Number.NaN
      }
    });
    const metrics = new Map(detail.metrics.map((metric) => [metric.id, metric]));

    expect(detail.status).toBe("partial");
    expect(metrics.get("effective-accuracy")).toMatchObject({
      value: "-",
      numericValue: null
    });
    expect(metrics.get("attack-roll")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("hit-chance")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("average-hit")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("attack-speed")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("attack-cycle")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("ttk")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("kills-per-hour")).toMatchObject({ value: "-", numericValue: null });
    expect(metrics.get("gp-per-kill")).toMatchObject({ value: "-", numericValue: null });
    expect(detail.notes.join("\n")).toContain("shown as fallbacks");
  }, 15_000);

  it("builds Stats XP routing rows with player, skill and modeled loot XP rows", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const rows = new Map(result.xpRouting.rows.map((row) => [row.id, row]));
    const skillRows = result.xpRouting.rows.filter((row) => row.id.startsWith("skill-"));
    const modeledSourceTotal = result.xpRouting.rows
      .filter((row) => row.id !== "player-combat")
      .reduce((sum, row) => sum + (row.xpPerHour ?? 0), 0);

    expect(result.xpRouting.effectiveXpPerHour).toBe(result.effectiveXpPerHour);
    expect(result.xpRouting.totalXpPerHour).toBe(result.totalXpPerHour);
    expect(result.xpRouting.effectiveXpPerHourLabel).toBe(formatNumber(result.effectiveXpPerHour));
    expect(modeledSourceTotal).toBeCloseTo(result.totalXpPerHour, 6);
    expect(rows.get("player-combat")).toMatchObject({
      label: "Player combat XP/hr",
      xpPerHour: result.playerEffectiveXpPerHour,
      status: "modeled"
    });
    expect(rows.has("cannon-ranged")).toBe(false);
    expect(skillRows.length).toBeGreaterThan(0);
    expect(rows.get("skill-hp")).toMatchObject({
      label: "Hitpoints",
      status: "modeled"
    });
    expect(rows.get("prayer")).toMatchObject({
      label: "Prayer XP/hr",
      xpPerHour: result.trip.prayerXpPerKill * result.trip.effectiveKph,
      status: "modeled",
      statusLabel: "modeled"
    });
    expect(rows.get("prayer")?.note).toContain("Bury XP");
    expect(rows.get("alch")).toMatchObject({
      label: "Magic (alch) XP/hr",
      xpPerHour: 0,
      value: "0",
      status: "modeled",
      statusLabel: "modeled"
    });
  }, 15_000);

  it("adapts the composed full simulation result as the primary numeric source", async () => {
    const { context } = await loadBundledLegacyContext();
    const request = formToSimulationRequest(DEFAULT_FORM_STATE, context.gameData);
    const fullResult = simulateFullSimulation(
      {
        request,
        trip: formToTripPolicy(DEFAULT_FORM_STATE),
        ringOfWealth: DEFAULT_FORM_STATE.ringOfWealth,
        legendsComplete: true
      },
      context
    );
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const normalAttack = result.statsSourceBreakdown.rows.find((row) => row.id === "normal-attack");

    expect(result.combat).toEqual(fullResult.combat);
    expect(result.trip).toEqual(fullResult.trip);
    expect(result.result).toEqual(fullResult);
    expect(result.playerEffectiveXpPerHour).toBe(fullResult.xp.playerEffectiveXpPerHour);
    expect(result.cannonEffectiveXpPerHour).toBe(fullResult.xp.cannonEffectiveXpPerHour);
    expect(result.effectiveXpPerHour).toBe(fullResult.xp.effectiveXpPerHour);
    expect(result.totalXpPerHour).toBe(fullResult.xp.totalXpPerHour);
    expect(result.xpRouting.effectiveXpPerHour).toBe(fullResult.xp.effectiveXpPerHour);
    expect(result.xpRouting.totalXpPerHour).toBe(fullResult.xp.totalXpPerHour);
    expect(normalAttack).toMatchObject({
      dps: fullResult.rates.dps,
      xpPerHour: fullResult.xp.playerEffectiveXpPerHour
    });
    expect(result.warnings).toEqual(fullResult.warnings.map((warning) => warning.message));
  }, 15_000);

  it("builds Stats source breakdown rows from current combat and trip outputs", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const rows = new Map(result.statsSourceBreakdown.rows.map((row) => [row.id, row]));
    const normalDetail = statsSourceDetail(result, "normal-attack");
    const specialDetail = statsSourceDetail(result, "special-attack");
    const cannonDetail = statsSourceDetail(result, "cannon");
    const normalMetrics = statsSourceMetrics(normalDetail);
    const specialMetrics = statsSourceMetrics(specialDetail);

    expect(result.statsSourceBreakdown.rows).toHaveLength(3);
    expect(result.statsSourceBreakdown.details).toHaveLength(3);
    expect(rows.get("normal-attack")).toMatchObject({
      label: "Normal attack",
      status: "modeled",
      statusLabel: "modeled",
      dps: result.combat.dps,
      xpPerHour: result.playerEffectiveXpPerHour,
      hitChance: result.combat.hitChance,
      maxHit: result.combat.maxHit,
      supplyCostPerKill: result.trip.supply.supplyCostPerKill
    });
    expect(rows.get("normal-attack")?.supplyCostPerHour).toBeCloseTo(
      result.trip.supply.supplyCostPerKill * result.trip.effectiveKph
    );
    expect(normalDetail).toMatchObject({
      id: "normal-attack",
      label: "Normal attack",
      status: "modeled",
      statusLabel: "modeled",
      warnings: result.moneyWarnings
    });
    expect(normalDetail?.histogram).toBe(result.hitDistribution);
    expect(normalMetrics.get("dps")).toMatchObject({
      value: formatNumber(result.combat.dps, 2),
      numericValue: result.combat.dps
    });
    expect(normalMetrics.get("xp-hr")?.numericValue).toBe(result.playerEffectiveXpPerHour);
    expect(normalMetrics.get("hit-chance")).toMatchObject({
      value: `${formatNumber(result.combat.hitChance * 100, 1)}%`,
      numericValue: result.combat.hitChance
    });
    expect(rows.get("special-attack")).toMatchObject({
      label: "Special attack",
      status: "inactive",
      statusLabel: "inactive",
      dps: null,
      xpPerHour: null
    });
    expect(rows.get("special-attack")?.notes.join("\n")).toContain(
      "No supported melee/ranged DPS special selected."
    );
    expect(specialDetail).toMatchObject({
      status: "inactive",
      statusLabel: "inactive",
      histogram: null,
      warnings: []
    });
    expect(specialMetrics.get("dps")).toMatchObject({ value: "-", numericValue: null });
    expect(rows.get("cannon")).toMatchObject({
      label: "Cannon",
      status: "inactive",
      statusLabel: "inactive",
      dps: null,
      xpPerHour: null
    });
    expect(rows.get("cannon")?.notes.join("\n")).toContain("Cannon is off");
    expect(cannonDetail).toMatchObject({
      status: "inactive",
      statusLabel: "inactive",
      histogram: null,
      warnings: []
    });
  }, 15_000);

  it("marks magic special source breakdown as not modeled without adding formulas", async () => {
    const { context } = await loadBundledLegacyContext();
    const magicForm = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "magic"),
      weaponId: "staff_of_fire",
      spellId: "fire_wave",
      styleId: "accurate"
    });
    const result = createSimulationViewModel(magicForm, context);
    const special = result.statsSourceBreakdown.rows.find((row) => row.id === "special-attack");
    const detail = statsSourceDetail(result, "special-attack");
    const metrics = statsSourceMetrics(detail);

    expect(result.combat.specialAttack).toBeNull();
    expect(special).toMatchObject({
      label: "Special attack",
      status: "not-modeled",
      statusLabel: "not modeled",
      dps: null,
      xpPerHour: null,
      hitChance: null,
      maxHit: null
    });
    expect(special?.notes.join("\n")).toContain("Magic DPS special attacks are not modeled yet.");
    expect(detail).toMatchObject({
      status: "not-modeled",
      statusLabel: "not modeled",
      histogram: null,
      warnings: []
    });
    expect(metrics.get("dps")).toMatchObject({ value: "-", numericValue: null });
    expect(detail?.notes.join("\n")).toContain("Magic DPS special attacks are not modeled yet.");
  }, 15_000);

  it("models Magic alch XP from tracked in-trip alch casts", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "chaos_dwarf",
      levels: {
        attack: 70,
        strength: 72,
        defence: 60,
        hitpoints: DEFAULT_FORM_STATE.levels.hitpoints,
        ranged: 50,
        magic: 55,
        prayer: 43
      },
      prayers: ["ultimate", "incredible"],
      boosts: ["super_att", "super_str"],
      sustained: true,
      repotThreshold: 74,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        foodKey: "lobster",
        teleport: true,
        bankSeconds: 120,
        alching: true,
        prayerMode: "none"
      }
    });
    const result = createSimulationViewModel(form, context);
    const rows = new Map(result.xpRouting.rows.map((row) => [row.id, row]));
    const expectedAlchXp =
      result.trip.alchCastsPerKill * HIGH_ALCH_MAGIC_XP_PER_CAST * result.trip.effectiveKph;
    const modeledSourceTotal = result.xpRouting.rows
      .filter((row) => row.id !== "player-combat")
      .reduce((sum, row) => sum + (row.xpPerHour ?? 0), 0);

    expect(result.trip.alchCastsPerKill).toBeGreaterThan(0);
    expect(rows.get("alch")).toMatchObject({
      label: "Magic (alch) XP/hr",
      xpPerHour: expectedAlchXp,
      status: "modeled",
      statusLabel: "modeled"
    });
    expect(rows.get("alch")?.note).toContain(`${HIGH_ALCH_MAGIC_XP_PER_CAST} Magic XP/cast`);
    expect(modeledSourceTotal).toBeCloseTo(result.totalXpPerHour, 6);
  }, 15_000);

  it("adds the Stats cannon XP routing row only when cannon contributes", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = rangedDagannothForm();
    const withoutCannon = createSimulationViewModel(form, context);
    const withCannon = createSimulationViewModel(form, context, {
      dagannoth: { enabled: true, targets: 6, respawnSec: 30 }
    });
    const withoutRows = new Map(withoutCannon.xpRouting.rows.map((row) => [row.id, row]));
    const withRows = new Map(withCannon.xpRouting.rows.map((row) => [row.id, row]));
    const withoutCannonSource = withoutCannon.statsSourceBreakdown.rows.find(
      (row) => row.id === "cannon"
    );
    const withCannonSource = withCannon.statsSourceBreakdown.rows.find(
      (row) => row.id === "cannon"
    );
    const withCannonDetail = statsSourceDetail(withCannon, "cannon");
    const withCannonMetrics = statsSourceMetrics(withCannonDetail);

    expect(withoutRows.has("cannon-ranged")).toBe(false);
    expect(withRows.get("cannon-ranged")).toMatchObject({
      label: "Cannon ranged XP/hr",
      xpPerHour: withCannon.cannonEffectiveXpPerHour,
      status: "modeled"
    });
    expect(withCannon.cannonEffectiveXpPerHour).toBeGreaterThan(0);

    expect(withoutCannonSource).toMatchObject({
      label: "Cannon",
      status: "inactive"
    });
    expect(withCannonSource).toMatchObject({
      label: "Cannon",
      status: "modeled",
      dps: withCannon.trip.cannon?.cannonDps,
      xpPerHour: withCannon.cannonEffectiveXpPerHour,
      hitChance: withCannon.combat.hitChance,
      maxHit: withCannon.trip.cannon?.maxBall,
      supplyCostPerKill: withCannon.trip.supply.ballCostPerKill
    });
    expect(withCannonSource?.supplyCostPerHour).toBeCloseTo(
      withCannon.trip.supply.ballCostPerKill * withCannon.trip.effectiveKph
    );
    expect(withCannonDetail).toMatchObject({
      label: "Cannon",
      status: "modeled",
      statusLabel: "modeled",
      histogramScopeLabel: "Per fired cannonball"
    });
    expect(withCannonDetail?.histogram).toMatchObject({
      hitChance: withCannon.combat.hitChance,
      maxHit: withCannon.trip.cannon?.maxBall
    });
    expect(withCannonDetail?.histogram?.averageHit).toBeCloseTo(
      (withCannon.trip.cannon?.cannonDps ?? 0) / (withCannon.trip.cannon?.ballsPerSec ?? 1)
    );
    expect(withCannonDetail?.histogram?.probabilityTotal).toBeCloseTo(1);
    expect(withCannonMetrics.get("effective-targets")?.numericValue).toBe(
      withCannon.trip.cannon?.effTargets
    );
    expect(withCannonMetrics.get("balls-hr")?.numericValue).toBe(
      withCannon.trip.cannon?.ballsPerHour
    );
    expect(withCannonMetrics.get("respawn-bound")?.value).toBe(
      withCannon.trip.cannon?.respawnBound ? "Yes" : "No"
    );
    expect(withCannonMetrics.get("cannon-ranged-xp-hr")?.numericValue).toBe(
      withCannon.trip.cannon?.rangedXpPerHour
    );
    expect(withCannonMetrics.get("ball-cost-hour")?.numericValue).toBe(
      withCannon.trip.cannon?.ballCostPerHour
    );
    expect(withCannonMetrics.get("ball-cost-kill")?.numericValue).toBe(
      withCannon.trip.cannon?.ballCostPerKill
    );
    expect(withCannonMetrics.get("cannonballs-trip")?.numericValue).toBe(
      withCannon.trip.cannon?.ballsPerTrip
    );
    expect(withCannonMetrics.get("sparse-state")?.value).toBe(
      withCannon.trip.cannon?.idle
        ? "Idle"
        : withCannon.trip.cannon?.respawnBound
          ? "Respawn-bound"
          : "Active"
    );
  }, 15_000);

  it("builds cannon source details for idle cannon spots without inventing a histogram", async () => {
    const { context } = await loadBundledLegacyContext();
    const idleResult = createSimulationViewModel(rangedRockCrabForm(), context, {
      rock_crab: { enabled: true, targets: 1, respawnSec: 3600 }
    });
    const detail = statsSourceDetail(idleResult, "cannon");
    const metrics = statsSourceMetrics(detail);

    expect(idleResult.trip.cannon).toMatchObject({
      idle: true,
      respawnBound: false,
      cannonDps: 0
    });
    expect(detail).toMatchObject({
      status: "inactive",
      statusLabel: "inactive",
      histogram: null
    });
    expect(detail?.notes.join("\n")).toContain(
      "Idle: this spot is too sparse for the cannon to fire."
    );
    expect(metrics.get("dps")).toMatchObject({ value: "0.00", numericValue: 0 });
    expect(metrics.get("sparse-state")?.value).toBe("Idle");
    expect(metrics.get("idle")?.value).toBe("Yes");
    expect(metrics.get("respawn-bound")?.value).toBe("No");
  }, 15_000);
});

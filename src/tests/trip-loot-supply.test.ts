import fixtureSet from "./fixtures/legacy-golden.json";
import { LEGACY_GOLDEN_CASES } from "./fixtures/legacy-case-definitions";
import {
  buildLegacyInput,
  createLegacyRuntime,
  type LegacyCaseDefinition,
  type LegacyInput,
  type LegacyRuntime
} from "./helpers/legacy-sim";
import { simulateCombat } from "../domain/combat";
import {
  bonePrayerXp,
  defaultLootAction,
  evaluateLoot,
  createIncomingDamageDescriptor,
  isStackable,
  lootPreferenceKey,
  normalizeLootName,
  recommendPotionCarry,
  simulateTripLootSupply,
  type CannonSettings,
  type TripLootSupplyInput,
  type TripPolicy
} from "../domain/trip";
import {
  createGameDataSnapshotFromLegacy,
  createPriceSetFromLegacyGameData,
  type LegacySnapshotInput
} from "../data";
import {
  type IncomingAttackProfile,
  type MonsterDefinition,
  type PriceSet,
  type SimulationContext,
  type SimulationRequest
} from "../domain/shared";

interface GoldenFixture {
  tolerances: {
    defaultNumericAbs: number;
  };
  cases: Array<{
    id: string;
    expected: Record<string, unknown>;
  }>;
}

const fixtures = fixtureSet as GoldenFixture;
const fixturesById = new Map(fixtures.cases.map((testCase) => [testCase.id, testCase]));
const definitionsById = new Map(
  LEGACY_GOLDEN_CASES.map((definition) => [definition.id, definition])
);

function expectClose(actual: number, expected: unknown, tolerance = 0.000001): void {
  expect(typeof expected).toBe("number");
  expect(Math.abs(actual - (expected as number))).toBeLessThanOrEqual(tolerance);
}

function expectCloseLoose(actual: number, expected: unknown): void {
  expectClose(actual, expected, fixtures.tolerances.defaultNumericAbs);
}

function expectOptionalCloseLoose(actual: number, expected: unknown): void {
  if (expected == null) {
    expect(Number.isFinite(actual)).toBe(false);
    return;
  }
  expectCloseLoose(actual, expected);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : ["none"];
}

function domainContextFromLegacy(runtime: LegacyRuntime): SimulationContext {
  const gameData = createGameDataSnapshotFromLegacy({
    gameData: runtime.GameData,
    simEngine: runtime.SimEngine,
    equipment: runtime.Equipment as unknown as LegacySnapshotInput["equipment"]
  });
  const priceSet = createPriceSetFromLegacyGameData({ gameData: runtime.GameData });
  return { gameData, priceSet };
}

function domainRequestFromLegacyInput(input: LegacyInput): SimulationRequest {
  const specWeapon = optionalString(input.specWeapon);
  const specAmmo = optionalString(input.specAmmo);
  const spellId = optionalString(input.spell);
  return {
    combatStyle: input.combatType,
    monsterId: input.monster.id,
    levels: {
      attack: input.attack,
      strength: input.strength,
      defence: input.defence,
      ranged: input.ranged,
      magic: input.magic,
      prayer: input.prayer
    },
    loadout: {
      weaponId: input.weapon,
      ammoId: input.ammo,
      gear: input.gear
    },
    styleId: input.style,
    prayers: { keys: stringArray(input.prayers) },
    boosts: { keys: stringArray(input.boosts) },
    sustained: Boolean(input.sustained),
    repotThreshold: typeof input.repotThreshold === "number" ? input.repotThreshold : null,
    spellId,
    charge: typeof input.charge === "boolean" ? input.charge : undefined,
    specialAttack:
      specWeapon && specWeapon !== "none" ? { weaponId: specWeapon, ammoId: specAmmo } : undefined
  };
}

function buildTripInput(
  runtime: LegacyRuntime,
  definition: LegacyCaseDefinition,
  context: SimulationContext
): TripLootSupplyInput {
  const legacyInput = buildLegacyInput(runtime, definition);
  const request = domainRequestFromLegacyInput(legacyInput);
  const combat = simulateCombat(request, context);
  return {
    request,
    combat,
    trip: legacyInput.trip as TripPolicy,
    lootPrefs: legacyInput.lootPrefs as Record<string, string | undefined> | undefined,
    ringOfWealth: Boolean(legacyInput.ringOfWealth),
    legendsComplete: legacyInput.legends !== false,
    cannon: legacyInput.cannon as CannonSettings | undefined,
    jewelSpot:
      (
        legacyInput.jewelSpotByMonster as Record<string, "underground" | "overground"> | undefined
      )?.[legacyInput.monster.id] ?? "underground",
    overheadSec: typeof legacyInput.overheadSec === "number" ? legacyInput.overheadSec : null
  };
}

describe("trip/loot/supply unit rules", () => {
  it("normalizes source potion dose names without changing quantity semantics", () => {
    expect(normalizeLootName("Antipoison(3)")).toBe("antipoison (3)");
    expect(normalizeLootName("Antipoison (3)")).toBe("antipoison (3)");
    expect(normalizeLootName("Air rune x18")).toBe("air rune");
  });

  it("owns stackability separately from legacy TripModel", () => {
    expect(isStackable("naturerune", "Nature rune x6")).toBe(true);
    expect(isStackable("coins", "Coins")).toBe(true);
    expect(isStackable("rune_dagger", "Rune dagger")).toBe(false);
    expect(isStackable("dragon_bones", "Dragon bones")).toBe(false);
  });

  it("resolves default loot actions and bone prayer xp", () => {
    const priceSet: PriceSet = {
      id: "unit",
      label: "Unit",
      source: "manual",
      createdAt: "2026-07-05",
      itemPrices: {},
      alchValues: { rune_dagger: 4608 }
    };
    expect(defaultLootAction({ name: "Bones", chance: 1, qtyAvg: 1, price: 35 }, priceSet)).toBe(
      "bury"
    );
    expect(
      defaultLootAction({ name: "Raw chicken", chance: 1, qtyAvg: 1, price: 5 }, priceSet)
    ).toBe("skip");
    expect(
      defaultLootAction(
        { name: "Rune dagger", key: "rune_dagger", chance: 1, qtyAvg: 1, price: 4400 },
        priceSet
      )
    ).toBe("alch");
    expect(
      defaultLootAction(
        { name: "Druid's robe", key: "druidrobetop", chance: 1, qtyAvg: 1, price: 420 },
        priceSet
      )
    ).toBe("skip");
    expect(
      defaultLootAction(
        { name: "Opal bolttips", key: "opal_bolttips", chance: 1, qtyAvg: 5, price: 30 },
        priceSet
      )
    ).toBe("skip");
    expect(bonePrayerXp("Dragon bones")).toBe(72);
  });

  it("materializes tagged herb and gem details from the same priced domain tables", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const result = evaluateLoot(
      {
        ...context.gameData.monsters.chicken,
        loot: [
          { name: "Random herb", tag: "herb", chance: 0.5, qtyAvg: 1 },
          { name: "Random jewel", tag: "gem", chance: 0.5, qtyAvg: 1 }
        ]
      },
      context
    );

    expect(result.lootBreakdown[0]?._expand).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Ranarr", weight: 11 })])
    );
    expect(result.lootBreakdown[1]?._expand).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Uncut sapphire", weight: 32 })])
    );
  });

  it("keeps conditional quest and clue rows visible but outside every default calculation", () => {
    const runtime = createLegacyRuntime();
    const baseContext = domainContextFromLegacy(runtime);
    const questDrop = {
      name: "Quest reward key",
      key: "quest_reward_key",
      chance: 1,
      qtyAvg: 1,
      eligibility: {
        kind: "quest" as const,
        policyId: "quest_reward_key_missing",
        description: "Requires an exact quest stage and no existing key."
      }
    };
    const clueDrop = {
      name: "Clue scroll (hard)",
      tag: "clue_hard",
      chance: 1 / 64,
      qtyAvg: 1,
      eligibility: {
        kind: "clue" as const,
        tier: "hard" as const,
        membersOnly: true as const,
        requiresNoClue: true as const
      }
    };
    const monster = {
      ...baseContext.gameData.monsters.chicken,
      loot: [questDrop, clueDrop]
    };
    const context: SimulationContext = {
      ...baseContext,
      gameData: {
        ...baseContext.gameData,
        items: {
          ...baseContext.gameData.items,
          quest_reward_key: { id: "quest_reward_key", name: "Quest reward key", alch: 5000 }
        },
        monsters: { ...baseContext.gameData.monsters, chicken: monster }
      },
      priceSet: {
        ...baseContext.priceSet,
        itemPrices: { ...baseContext.priceSet.itemPrices, quest_reward_key: 10000 },
        alchValues: { ...baseContext.priceSet.alchValues, quest_reward_key: 5000 }
      }
    };
    const result = evaluateLoot(monster, context, {
      alching: true,
      lootPrefs: {
        [lootPreferenceKey(questDrop, 0)]: "alch",
        [lootPreferenceKey(clueDrop, 1)]: "loot"
      }
    });

    expect(result).toMatchObject({
      gpPerKill: 0,
      prayerXpPerKill: 0,
      alchCastsPerKill: 0,
      alchTimePerKill: 0,
      warnings: []
    });
    expect(result.lootBreakdown).toHaveLength(2);
    expect(result.lootBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pref: "skip",
          evGp: 0,
          slotFrac: 0,
          eligibilityActive: false
        })
      ])
    );
  });

  it("produces structured warnings for missing and approximate price data", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const monster = {
      ...context.gameData.monsters.chicken,
      loot: [{ name: "Mystery item", key: "mystery_item", chance: 1, qtyAvg: 1 }]
    };
    const warnedContext: SimulationContext = {
      gameData: {
        ...context.gameData,
        monsters: { ...context.gameData.monsters, chicken: monster },
        items: {
          ...context.gameData.items,
          mystery_item: {
            id: "mystery_item",
            name: "Mystery item",
            provenance: { source: "approximation", notes: "unit test" }
          }
        }
      },
      priceSet: context.priceSet
    };
    const result = evaluateLoot(monster, warnedContext);
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(["missing-price", "approximate-data-source"])
    );
  });

  it("surfaces structured warnings when jewel table prices use aliases or fallbacks", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const withoutCanonicalSapphire = { ...context.priceSet.itemPrices };
    delete withoutCanonicalSapphire.uncut_sapphire;
    const aliasContext: SimulationContext = {
      ...context,
      priceSet: {
        ...context.priceSet,
        itemPrices: { ...withoutCanonicalSapphire, sapphire: 451 }
      }
    };
    const aliasResult = evaluateLoot(context.gameData.monsters.giant, aliasContext);

    expect(aliasResult.warnings.map((warning) => warning.code)).toContain("price-alias-used");
    expect(aliasResult.warnings.map((warning) => warning.message).join("\n")).toContain(
      "uncut_sapphire"
    );

    const withoutSapphireAlias = { ...withoutCanonicalSapphire };
    delete withoutSapphireAlias.sapphire;
    const fallbackContext: SimulationContext = {
      ...context,
      priceSet: {
        ...context.priceSet,
        itemPrices: withoutSapphireAlias
      }
    };
    const fallbackResult = evaluateLoot(context.gameData.monsters.giant, fallbackContext);

    expect(fallbackResult.warnings.map((warning) => warning.code)).toContain("price-fallback-used");
  });

  it("values direct loot keys through canonical prices without alias warnings", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const withoutAliasSapphire = { ...context.priceSet.itemPrices };
    delete withoutAliasSapphire.sapphire;
    const aliasKeyContext: SimulationContext = {
      ...context,
      priceSet: {
        ...context.priceSet,
        itemPrices: {
          ...withoutAliasSapphire,
          uncut_sapphire: 1250
        }
      }
    };
    const result = evaluateLoot(
      {
        id: "alias_key_giant",
        name: "Alias key giant",
        hp: 1,
        loot: [{ name: "Uncut sapphire", key: "sapphire", chance: 1, qtyAvg: 1 }]
      },
      aliasKeyContext
    );

    expect(result.lootBreakdown[0]?.price).toBe(1250);
    expect(result.lootBreakdown[0]?.saleValue).toBe(1250);
    expect(result.warnings.map((warning) => warning.code)).not.toContain("price-alias-used");
    expect(result.warnings.map((warning) => warning.code)).not.toContain("missing-price");
  });

  it("keeps alias fallback warnings when direct loot canonical prices are missing", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const withoutCanonicalSapphire = { ...context.priceSet.itemPrices };
    delete withoutCanonicalSapphire.uncut_sapphire;
    const aliasFallbackContext: SimulationContext = {
      ...context,
      priceSet: {
        ...context.priceSet,
        itemPrices: {
          ...withoutCanonicalSapphire,
          sapphire: 451
        }
      }
    };
    const result = evaluateLoot(
      {
        id: "canonical_key_giant",
        name: "Canonical key giant",
        hp: 1,
        loot: [{ name: "Uncut sapphire", key: "uncut_sapphire", chance: 1, qtyAvg: 1 }]
      },
      aliasFallbackContext
    );

    expect(result.lootBreakdown[0]?.price).toBe(451);
    expect(result.lootBreakdown[0]?.saleValue).toBe(451);
    expect(result.warnings.map((warning) => warning.code)).toContain("price-alias-used");
    expect(result.warnings.map((warning) => warning.code)).not.toContain("missing-price");
    expect(result.warnings.map((warning) => warning.message).join("\n")).toContain(
      "uncut_sapphire"
    );
  });

  it("bounds cannon target and respawn settings inside the domain", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("ranged_magic_shortbow_dagannoth_cannon");
    expect(definition).toBeDefined();
    if (!definition) throw new Error("Missing cannon fixture definition");

    const input = buildTripInput(runtime, definition, context);
    const result = simulateTripLootSupply(
      {
        ...input,
        cannon: { enabled: true, targets: 99, respawnSec: -5 }
      },
      context
    );

    expect(result.cannon?.targets).toBe(8);
    expect(result.cannon?.respawnSec).toBe(1);
  });

  it("applies safespot override and protect prayer to incoming damage", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("ranged_magic_shortbow_rock_crab_safespot");
    expect(definition).toBeDefined();
    if (!definition) throw new Error("Missing safespot fixture definition");

    const input = buildTripInput(runtime, definition, context);
    const autoResult = simulateTripLootSupply(input, context);
    const forcedOffResult = simulateTripLootSupply(
      {
        ...input,
        trip: { ...input.trip, foodKey: "lobster", protect: "none", safespot: false }
      },
      context
    );
    const protectedResult = simulateTripLootSupply(
      {
        ...input,
        trip: { ...input.trip, foodKey: "lobster", protect: "melee", safespot: false }
      },
      context
    );

    expect(autoResult.trip.incoming.safespot).toBe(true);
    expect(autoResult.trip.incoming.hpPerKill).toBe(0);
    expect(forcedOffResult.trip.incoming.safespot).toBe(false);
    expect(forcedOffResult.trip.incoming.hpPerKill).toBeGreaterThan(0);
    expect(protectedResult.trip.incoming.protected).toBe(true);
    expect(protectedResult.trip.incoming.hpPerKill).toBeLessThan(
      forcedOffResult.trip.incoming.hpPerKill
    );
  });

  it("normalizes exact typed melee, ranged and magic profiles through one descriptor", () => {
    const runtime = createLegacyRuntime();
    const baseContext = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("melee_ring_recoil_fire_giant_food_trip");
    if (!definition) throw new Error("Missing incoming profile fixture");
    const input = buildTripInput(runtime, definition, baseContext);
    const context: SimulationContext = {
      ...baseContext,
      gameData: {
        ...baseContext.gameData,
        equipment: {
          ...baseContext.gameData.equipment,
          helm: {
            ...baseContext.gameData.equipment.helm,
            incoming_guard: {
              name: "Incoming guard",
              slashDef: 100,
              rngDef: 0,
              magDef: -20
            }
          }
        }
      }
    };
    const request: SimulationRequest = {
      ...input.request,
      loadout: {
        ...input.request.loadout,
        gear: { ...input.request.loadout.gear, helm: "incoming_guard" }
      }
    };
    const profile = (
      id: string,
      attackType: IncomingAttackProfile["attackType"],
      weight: number
    ): IncomingAttackProfile => ({
      id,
      attackType,
      attackSpeedTicks: 4,
      maxHit: 8,
      formulaId: "scripted-fixed-v1",
      formulaInputs: { kind: "source-value", value: 8 },
      accuracy: { kind: "standard", level: 50, bonus: 0 },
      selection: { kind: "weighted", weight },
      coverage: "exact",
      provenance: { source: "generated", sourceRef: "scripts/fixture.rs2#attack" }
    });
    const monster: MonsterDefinition = {
      ...context.gameData.monsters[request.monsterId]!,
      incomingAttackCoverage: "exact",
      incomingAttacks: [
        profile("melee", "melee", 1),
        profile("ranged", "ranged", 1),
        profile("magic", "magic", 2)
      ]
    };
    const tripContext = {
      monster,
      combatStyle: request.combatStyle,
      ttkSec: 24,
      cycleSec: 30,
      prayerDef: 1
    } as const;
    const descriptor = createIncomingDamageDescriptor(
      request,
      context,
      { safespot: false, protect: "none" },
      tripContext
    );
    const byType = new Map(descriptor.profiles.map((entry) => [entry.attackType, entry]));

    expect(descriptor.coverage).toBe("source-backed");
    expect(descriptor.sourceLabel).toBe("Source-backed");
    expect(descriptor.profiles.map((entry) => entry.selectionProbability)).toEqual([
      0.25, 0.25, 0.5
    ]);
    expect(byType.get("melee")!.hitChance).toBeLessThan(byType.get("ranged")!.hitChance);
    expect(byType.get("ranged")!.hitChance).toBeLessThan(byType.get("magic")!.hitChance);
    expect(descriptor.attackDamagePerKill).toBeCloseTo(
      descriptor.profiles.reduce((sum, entry) => sum + entry.expectedDamagePerKill, 0),
      10
    );

    const protectedDescriptor = createIncomingDamageDescriptor(
      request,
      context,
      { safespot: false, protect: "missiles" },
      tripContext
    );
    expect(
      protectedDescriptor.profiles.find((entry) => entry.attackType === "ranged")?.hitChance
    ).toBe(0);
    expect(
      protectedDescriptor.profiles.find((entry) => entry.attackType === "melee")?.hitChance
    ).toBeGreaterThan(0);
  });

  it("keeps partial and legacy incoming models on visible compatibility paths and fails bad exact data", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("melee_ring_recoil_fire_giant_food_trip");
    if (!definition) throw new Error("Missing compatibility fixture");
    const input = buildTripInput(runtime, definition, context);
    const baseMonster = context.gameData.monsters[input.request.monsterId]!;
    const partialProfile: IncomingAttackProfile = {
      id: "contextual-magic",
      attackType: "magic",
      attackSpeedTicks: 4,
      maxHit: 8,
      formulaId: "forced-max-hit-v1",
      formulaInputs: { kind: "source-value", value: 8 },
      accuracy: { kind: "standard", level: 50, bonus: 0 },
      selection: { kind: "contextual", reason: "selection-policy-required" },
      coverage: "partial",
      provenance: { source: "generated", sourceRef: "scripts/fixture.rs2#contextual" }
    };
    const common = {
      combatStyle: input.request.combatStyle,
      ttkSec: 24,
      cycleSec: 30,
      prayerDef: 1
    } as const;
    const partial = createIncomingDamageDescriptor(
      input.request,
      context,
      { safespot: false },
      {
        ...common,
        monster: {
          ...baseMonster,
          incomingAttackCoverage: "partial",
          incomingAttacks: [partialProfile]
        }
      }
    );
    const legacy = createIncomingDamageDescriptor(
      input.request,
      context,
      { safespot: false },
      { ...common, monster: baseMonster }
    );

    expect(partial).toMatchObject({
      coverage: "partial",
      sourceLabel: "Partial model",
      meanOnly: true
    });
    expect(partial.profiles[0]?.formulaId).toBe("compatibility-fallback-v1");
    expect(legacy).toMatchObject({
      coverage: "compatibility-fallback",
      sourceLabel: "Compatibility fallback",
      meanOnly: true
    });

    expect(() =>
      createIncomingDamageDescriptor(
        input.request,
        context,
        { safespot: false },
        {
          ...common,
          monster: {
            ...baseMonster,
            incomingAttackCoverage: "exact",
            incomingAttacks: [
              {
                ...partialProfile,
                coverage: "exact",
                selection: { kind: "always" },
                maxHit: 9
              }
            ]
          }
        }
      )
    ).toThrow(/does not match its source formula/);
  });

  it("applies antifire and antipoison trip controls to incoming damage", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const dragonDefinition = definitionsById.get("melee_black_dragon_food_limited_trip");
    const poisonBaseDefinition = definitionsById.get("melee_ring_recoil_fire_giant_food_trip");
    expect(dragonDefinition).toBeDefined();
    expect(poisonBaseDefinition).toBeDefined();
    if (!dragonDefinition || !poisonBaseDefinition) throw new Error("Missing survival fixture");

    const dragonInput = buildTripInput(runtime, dragonDefinition, context);
    const noAntifire = simulateTripLootSupply(
      { ...dragonInput, trip: { ...dragonInput.trip, antifire: false } },
      context
    );
    const withAntifire = simulateTripLootSupply(
      { ...dragonInput, trip: { ...dragonInput.trip, antifire: true } },
      context
    );
    const poisonBaseInput = buildTripInput(runtime, poisonBaseDefinition, context);
    const poisonRequest: SimulationRequest = {
      ...poisonBaseInput.request,
      monsterId: "poison_spider"
    };
    const poisonInput: TripLootSupplyInput = {
      ...poisonBaseInput,
      request: poisonRequest,
      combat: simulateCombat(poisonRequest, context)
    };
    const noAntipoison = simulateTripLootSupply(
      {
        ...poisonInput,
        trip: { ...poisonInput.trip, antipoison: false, foodKey: "lobster", safespot: false }
      },
      context
    );
    const withAntipoison = simulateTripLootSupply(
      {
        ...poisonInput,
        trip: { ...poisonInput.trip, antipoison: true, foodKey: "lobster", safespot: false }
      },
      context
    );

    expect(withAntifire.trip.incoming.dragonfire).toBeLessThan(noAntifire.trip.incoming.dragonfire);
    expect(noAntipoison.trip.incoming.poison ?? 0).toBeGreaterThan(0);
    expect(withAntipoison.trip.incoming.poison ?? 0).toBe(0);
  });

  it("applies recoil ring count to recoil trip capacity", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("melee_ring_recoil_fire_giant_food_trip");
    expect(definition).toBeDefined();
    if (!definition) throw new Error("Missing recoil fixture definition");

    const input = buildTripInput(runtime, definition, context);
    const oneRing = simulateTripLootSupply(
      { ...input, trip: { ...input.trip, recoilRings: 1 } },
      context
    );
    const threeRings = simulateTripLootSupply(
      { ...input, trip: { ...input.trip, recoilRings: 3 } },
      context
    );

    expect(oneRing.trip.recoilOn).toBe(true);
    expect(oneRing.trip.recoilRings).toBe(1);
    expect(oneRing.trip.recoilSpares).toBe(0);
    expect(threeRings.trip.recoilRings).toBe(3);
    expect(threeRings.trip.recoilSpares).toBe(2);
    expect(threeRings.trip.maxKillsRecoil).toBeGreaterThan(oneRing.trip.maxKillsRecoil);
  });

  it("applies prayer restore quantities and altar timing to trip capacity", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("melee_rune_scimitar_hill_giant_super_prayers");
    expect(definition).toBeDefined();
    if (!definition) throw new Error("Missing prayer fixture definition");

    const input = buildTripInput(runtime, definition, context);
    const noPrayerPotions = simulateTripLootSupply(
      {
        ...input,
        trip: {
          ...input.trip,
          prayerMode: "potions",
          prayerPotionSets: 0,
          prayerPotionDoses: undefined
        }
      },
      context
    );
    const manualDoses = simulateTripLootSupply(
      {
        ...input,
        trip: {
          ...input.trip,
          prayerMode: "potions",
          prayerPotionSets: undefined,
          prayerPotionDoses: 8
        }
      },
      context
    );
    const altar = simulateTripLootSupply(
      {
        ...input,
        trip: {
          ...input.trip,
          prayerMode: "altar",
          prayerPotionSets: undefined,
          prayerPotionDoses: undefined,
          altarSeconds: 45
        }
      },
      context
    );

    expect(noPrayerPotions.trip.prayerActive).toBe(true);
    expect(noPrayerPotions.trip.prayerSlots).toBe(0);
    expect(manualDoses.trip.prayerActive).toBe(true);
    expect(manualDoses.trip.prayerSlots).toBe(2);
    expect(manualDoses.trip.maxKillsPrayer).toBeGreaterThan(noPrayerPotions.trip.maxKillsPrayer);
    expect(altar.trip.altarOn).toBe(true);
    expect(altar.trip.altarSeconds).toBe(45);
    expect(altar.trip.altarSecPerKill).toBeGreaterThan(0);
    expect(altar.trip.prayerActive).toBe(false);
  });

  it("recommends general potion carry and reports vial match state", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("melee_rune_scimitar_hill_giant_super_prayers");
    expect(definition).toBeDefined();
    if (!definition) throw new Error("Missing potion fixture definition");

    const input = buildTripInput(runtime, definition, context);
    const tripResult = simulateTripLootSupply(input, context);
    const mismatch = recommendPotionCarry({
      request: input.request,
      trip: { ...input.trip, singleDose: false, potionSets: 0 },
      cycleSec: tripResult.cycleSec,
      killsPerTrip: tripResult.trip.killsPerTrip
    });
    const matched = recommendPotionCarry({
      request: input.request,
      trip: {
        ...input.trip,
        singleDose: false,
        potionSets: mismatch.recommendedVials
      },
      cycleSec: tripResult.cycleSec,
      killsPerTrip: tripResult.trip.killsPerTrip
    });
    const over = recommendPotionCarry({
      request: input.request,
      trip: {
        ...input.trip,
        singleDose: false,
        potionSets: mismatch.recommendedVials + 1
      },
      cycleSec: tripResult.cycleSec,
      killsPerTrip: tripResult.trip.killsPerTrip
    });

    expect(tripResult.potionRecommendation.active).toBe(true);
    expect(mismatch).toMatchObject({
      active: true,
      status: "under",
      canApply: true,
      recommendedVials: 1,
      recommendedDoses: 1,
      matched: false
    });
    expect(mismatch.tripMinutes).toBeGreaterThan(0);
    expect(mismatch.repotIntervalMinutes).toBeGreaterThan(0);
    expect(matched).toMatchObject({
      active: true,
      status: "matched",
      canApply: false,
      matched: true
    });
    expect(over).toMatchObject({
      active: true,
      status: "over",
      canApply: true,
      matched: false
    });
  });

  it("recommends single-dose carry and scales above one vial for long trips", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("melee_dba_sustained_moss_giant");
    expect(definition).toBeDefined();
    if (!definition) throw new Error("Missing long potion fixture definition");

    const input = buildTripInput(runtime, definition, context);
    const longTrip = recommendPotionCarry({
      request: input.request,
      trip: { ...input.trip, singleDose: true, potionDoses: 0 },
      cycleSec: 60,
      killsPerTrip: 121
    });
    const matched = recommendPotionCarry({
      request: input.request,
      trip: {
        ...input.trip,
        singleDose: true,
        potionDoses: longTrip.recommendedDoses
      },
      cycleSec: 60,
      killsPerTrip: 121
    });

    expect(longTrip.active).toBe(true);
    expect(longTrip.status).toBe("under");
    expect(longTrip.canApply).toBe(true);
    expect(longTrip.recommendedDoses).toBeGreaterThan(4);
    expect(longTrip.recommendedVials).toBeGreaterThan(1);
    expect(longTrip.matched).toBe(false);
    expect(matched).toMatchObject({ status: "matched", canApply: false, matched: true });
  });

  it("reports inactive recommendation states for sustained-off, no boosts and manual trips", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("ranged_magic_shortbow_rock_crab_safespot");
    expect(definition).toBeDefined();
    if (!definition) throw new Error("Missing no-boost fixture definition");

    const input = buildTripInput(runtime, definition, context);
    const sustainedOff = recommendPotionCarry({
      request: { ...input.request, boosts: { keys: ["ranging"] }, sustained: false },
      trip: input.trip ?? {},
      cycleSec: 60,
      killsPerTrip: 10
    });
    const noBoost = recommendPotionCarry({
      request: { ...input.request, sustained: true, repotThreshold: null },
      trip: input.trip ?? {},
      cycleSec: 60,
      killsPerTrip: 10
    });
    const unsafeTrip = recommendPotionCarry({
      request: {
        ...input.request,
        boosts: { keys: ["ranging"] },
        sustained: true,
        repotThreshold: null
      },
      trip: input.trip ?? {},
      cycleSec: 60,
      killsPerTrip: Infinity
    });

    expect(sustainedOff).toMatchObject({
      active: false,
      status: "inactive",
      canApply: false,
      recommendedVials: 0,
      recommendedDoses: 0,
      matched: false
    });
    expect(sustainedOff.reason).toContain("Sustained is off");
    expect(noBoost).toMatchObject({
      active: false,
      status: "no-boost",
      canApply: false,
      recommendedVials: 0,
      recommendedDoses: 0,
      matched: false
    });
    expect(noBoost.reason).toContain("general combat boost");
    expect(unsafeTrip).toMatchObject({
      active: false,
      status: "manual",
      canApply: false
    });
    expect(unsafeTrip.warnings.join(" ")).toContain("finite");
  });

  it("applies scarce spot respawn limits and exposes trip reserve details", () => {
    const runtime = createLegacyRuntime();
    const context = domainContextFromLegacy(runtime);
    const definition = definitionsById.get("ranged_magic_shortbow_rock_crab_safespot");
    expect(definition).toBeDefined();
    if (!definition) throw new Error("Missing scarce fixture definition");

    const input = buildTripInput(runtime, definition, context);
    const baseline = simulateTripLootSupply(input, context);
    const scarce = simulateTripLootSupply(
      {
        ...input,
        trip: {
          ...input.trip,
          teleport: true,
          scarceSpot: true,
          targetsAtSpot: 1,
          respawnSeconds: 60
        }
      },
      context
    );

    expect(scarce.trip.scarce.enabled).toBe(true);
    expect(scarce.trip.scarce.targetsAtSpot).toBe(1);
    expect(scarce.trip.scarce.respawnSeconds).toBe(60);
    expect(scarce.trip.scarce.respawnBound).toBe(true);
    expect(scarce.trip.effectiveKph).toBeLessThan(baseline.trip.effectiveKph);
    expect(scarce.effectiveGpPerHour).toBeLessThan(baseline.effectiveGpPerHour);
    expect(scarce.trip.slots.reserveParts).toContain("teleport");
    expect(scarce.trip.slots.lootCapacity).toBeLessThanOrEqual(scarce.trip.slots.inv);
  });
});

describe("trip/loot/supply parity with legacy golden fixtures", () => {
  const parityCaseIds = [
    "melee_rune_scimitar_hill_giant_super_prayers",
    "melee_green_dragon_antifire_ring_of_wealth",
    "melee_dragon_dagger_poison_lesser_demon_spec",
    "melee_dba_sustained_moss_giant",
    "melee_dragon_halberd_rock_crab_small_target_spec",
    "melee_ring_recoil_fire_giant_food_trip",
    "ranged_magic_shortbow_rock_crab_safespot",
    "ranged_magic_shortbow_dagannoth_cannon",
    "ranged_steel_knives_chaos_druid_inventory",
    "ranged_yew_longbow_black_demon_no_recovery",
    "ranged_magic_shortbow_greater_demon_spec",
    "magic_fire_bolt_chaos_druid_alch",
    "magic_fire_wave_blue_dragon_safespot",
    "magic_saradomin_strike_charged_greater_demon",
    "magic_water_bolt_tribesman_poison_safespot",
    "melee_chaos_dwarf_alch_rune_drop",
    "melee_black_dragon_food_limited_trip",
    "melee_low_level_chicken_low_value_loot"
  ] as const;

  for (const caseId of parityCaseIds) {
    it(`matches trip/loot/supply fields for ${caseId}`, () => {
      const runtime = createLegacyRuntime();
      const context = domainContextFromLegacy(runtime);
      const definition = definitionsById.get(caseId);
      const fixture = fixturesById.get(caseId);
      expect(definition, `Missing case definition for ${caseId}`).toBeDefined();
      expect(fixture, `Missing golden fixture for ${caseId}`).toBeDefined();
      if (!definition || !fixture) throw new Error(`Missing test data for ${caseId}`);

      const result = simulateTripLootSupply(buildTripInput(runtime, definition, context), context);
      const expected = fixture.expected;
      const expectedTrip = expected.trip as Record<string, unknown> | null;

      expectCloseLoose(result.gpPerKill, expected.gpPerKill);
      expectCloseLoose(result.gpPerHour, expected.gpPerHour);
      expectCloseLoose(result.netGpPerHour, expected.netGpPerHour);
      expectCloseLoose(result.effectiveNetGpPerHour, expected.effectiveNetGpPerHour);
      expectCloseLoose(result.supply.supplyCostPerKill, expected.supplyCostPerKill);
      expectCloseLoose(result.supply.foodCostPerKill, expected.foodCostPerKill);
      expectCloseLoose(result.supply.potionCostPerKill, expected.potionCostPerKill);
      expectCloseLoose(result.supply.ammoCostPerKill, expected.ammoCostPerKill);
      expectCloseLoose(result.supply.runeCostPerKill, expected.runeCostPerKill);
      expectCloseLoose(result.prayerPerKill, expected.prayerPerKill);
      expectCloseLoose(result.prayerXpPerKill, expected.prayerXpPerKill);

      if (expectedTrip) {
        const expectedSlots = expectedTrip.slots as Record<string, unknown>;
        const expectedIncoming = expectedTrip.incoming as Record<string, unknown>;
        expect(result.trip.bound).toBe(expectedTrip.bound);
        expectOptionalCloseLoose(result.trip.killsPerTrip, expectedTrip.killsPerTrip);
        expectCloseLoose(result.trip.foodPerKill, expectedTrip.foodPerKill);
        expectCloseLoose(result.trip.lootFraction, expectedTrip.lootFraction);
        expectCloseLoose(result.trip.efficiency, expectedTrip.efficiency);
        expectCloseLoose(result.trip.effectiveKph, expectedTrip.effectiveKph);
        expectCloseLoose(result.trip.bankSeconds, expectedTrip.bankSeconds);
        expectCloseLoose(result.trip.incoming.hpPerKill, expectedIncoming.hpPerKill);
        expectCloseLoose(result.trip.incoming.dragonfire, expectedIncoming.dragonfire);
        expectCloseLoose(result.trip.incoming.poison ?? 0, expectedIncoming.poison ?? 0);
        expect(result.trip.incoming.safespot).toBe(expectedIncoming.safespot);
        expect(result.trip.incoming.safespotAuto).toBe(expectedIncoming.safespotAuto);
        expectCloseLoose(result.trip.slots.reserve, expectedSlots.reserve);
        expectCloseLoose(result.trip.slots.stackReserve, expectedSlots.stackReserve);
        expectCloseLoose(result.trip.slots.foodCount, expectedSlots.foodCount);
        expectCloseLoose(result.trip.slots.lootCapacity, expectedSlots.lootCapacity);
        expectCloseLoose(result.trip.slots.nonStackPerKill, expectedSlots.nonStackPerKill);
      }

      const expectedCannon = expected.cannon as Record<string, unknown> | null;
      if (expectedCannon) {
        expect(result.cannon).not.toBeNull();
        expectCloseLoose(result.cannon?.ballsPerKill ?? NaN, expectedCannon.ballsPerKill);
        expectCloseLoose(result.cannon?.ballsPerHour ?? NaN, expectedCannon.ballsPerHour);
        expectCloseLoose(result.cannon?.cannonDps ?? NaN, expectedCannon.cannonDps);
        expectCloseLoose(result.cannon?.ballCostPerKill ?? NaN, expectedCannon.ballCostPerKill);
        expectCloseLoose(result.cannon?.activeFrac ?? NaN, expectedCannon.activeFrac);
        expect(result.cannon?.idle).toBe(expectedCannon.idle);
        expect(result.cannon?.respawnBound).toBe(expectedCannon.respawnBound);
      } else {
        expect(result.cannon).toBeNull();
      }

      const expectedTopLoot = expected.topLoot as Array<Record<string, unknown>>;
      const actualTopLoot = result.lootBreakdown
        .filter((drop) => drop.evGp > 0 || drop.prayerXp > 0)
        .sort((left, right) => {
          const gpDelta = right.evGp - left.evGp;
          return gpDelta !== 0 ? gpDelta : left.name.localeCompare(right.name);
        });
      for (const [index, expectedLoot] of expectedTopLoot.slice(0, 3).entries()) {
        const actualLoot = actualTopLoot[index];
        expect(actualLoot, `Missing loot row ${expectedLoot.name}`).toBeDefined();
        if (actualLoot) {
          expect(actualLoot.name).toBe(expectedLoot.name);
          expect(actualLoot.pref).toBe(expectedLoot.pref);
          expectCloseLoose(actualLoot.evGp, expectedLoot.evGp);
          expectCloseLoose(actualLoot.prayerXp, expectedLoot.prayerXp);
          expectCloseLoose(actualLoot.slotFrac, expectedLoot.slotFrac);
          expectCloseLoose(actualLoot.alchValue, expectedLoot.alchValue);
        }
      }
    });
  }
});

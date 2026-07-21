import { createGeneratedRuntimeContext } from "../adapters/generated";
import {
  createSavedRowSetupChangeReview,
  createSharedSetupChangeReview,
  createSetupFileChangeReview,
  fingerprintSetupTransferState,
  savedRowReviewMatches,
  sharedSetupReviewMatchesCurrent,
  setupFileReviewMatchesCurrent,
  setupFormPhysicalLeafPaths,
  setupFormSemanticFieldIds,
  type SetupChangeGroup
} from "../app/state/setup-transfer-changes";
import { lootPreferenceKeysForMonster } from "../domain/trip";
import { DEFAULT_MONSTER_LOOT_SETTINGS } from "../app/state/loot-settings";
import {
  CombatSetupFormSchema,
  DEFAULT_CANNON_SETTINGS,
  DEFAULT_FORM_STATE,
  normalizeFormState,
  savedSetupFromForm,
  type CombatSetupFormState,
  type CombatStyleLoadout,
  type SavedSetupState
} from "../app/state/ui-state";

function flattenLeafPaths(value: unknown, prefix = ""): string[] {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenLeafPaths(child, prefix ? `${prefix}.${key}` : key)
  );
}

function fieldIdsUnder(group: SetupChangeGroup): string[] {
  return [...group.changes.map((change) => change.id), ...group.children.flatMap(fieldIdsUnder)];
}

function changedLoadout(current: CombatStyleLoadout, styleIndex: number): CombatStyleLoadout {
  return {
    ...current,
    styleId: current.styleId === "accurate" ? "controlled" : "accurate",
    gear: Object.fromEntries(
      Object.keys(current.gear).map((slot, index) => [
        slot,
        index % 2 === 0 ? "none" : current.gear[slot as keyof typeof current.gear]
      ])
    ),
    prayers: styleIndex % 2 === 0 ? ["clarity", "burst"] : ["rock_skin"],
    boosts: styleIndex % 2 === 0 ? ["super_def"] : [],
    sustained: !current.sustained,
    repotThreshold: 40 + styleIndex,
    manualOverrides: {
      accuracyBonus: 10 + styleIndex,
      damageBonus: 20 + styleIndex,
      attackSpeedSec: 3 + styleIndex
    }
  };
}

function changedForm(base: CombatSetupFormState = DEFAULT_FORM_STATE): CombatSetupFormState {
  return normalizeFormState({
    ...base,
    combatStyle: "ranged",
    monsterId: "rock_crab",
    levels: {
      attack: 61,
      strength: 62,
      defence: 63,
      hitpoints: 64,
      ranged: 65,
      magic: 66,
      prayer: 67
    },
    perStyleLoadouts: {
      melee: changedLoadout(base.perStyleLoadouts.melee, 0),
      ranged: changedLoadout(base.perStyleLoadouts.ranged, 1),
      magic: changedLoadout(base.perStyleLoadouts.magic, 2)
    },
    ringOfWealth: true,
    trip: {
      foodKey: "swordfish",
      teleport: false,
      bankSeconds: 30,
      potionSets: 2,
      potionDoses: 7,
      singleDose: true,
      dbaRestore: false,
      prayerMode: "altar",
      alching: true,
      recoverAmmo: false,
      runeSlots: 3,
      antifire: true,
      antipoison: true,
      safespot: false,
      protect: "magic",
      recoilRings: 2,
      foodCount: 12,
      foodPerKillOverride: 1.5,
      prayerPotionSets: 2,
      prayerPotionDoses: 8,
      altarSeconds: 45,
      scarceSpot: true,
      targetsAtSpot: 2,
      respawnSeconds: 20
    },
    plannerTargets: {
      attack: 70,
      strength: 71,
      defence: 72,
      ranged: 73,
      magic: 74
    }
  });
}

function setupFixtures(): { current: SavedSetupState; incoming: SavedSetupState } {
  const currentCustom = normalizeFormState({ ...DEFAULT_FORM_STATE, monsterId: "dagannoth" });
  const changedCustom = changedForm({ ...DEFAULT_FORM_STATE, monsterId: "rock_crab" });
  const addedCustom = changedForm({ ...DEFAULT_FORM_STATE, monsterId: "hobgoblin_armed" });
  const current = savedSetupFromForm(
    DEFAULT_FORM_STATE,
    {
      sort: { key: "xpPerHour", direction: "desc" },
      monsterFilter: "",
      dropFilter: "",
      showIrrelevant: false,
      irrelevantMonsterIds: ["giant"]
    },
    {
      dagannoth: { enabled: true, targets: 3, respawnSec: null },
      giant: { enabled: false, targets: 2, respawnSec: 30 }
    },
    { dagannoth: currentCustom, rock_crab: DEFAULT_FORM_STATE },
    DEFAULT_FORM_STATE,
    "default"
  );
  const incomingForm = changedForm();
  const incoming = savedSetupFromForm(
    incomingForm,
    {
      sort: { key: "netGpPerHour", direction: "asc" },
      monsterFilter: "dragon",
      dropFilter: "bones",
      showIrrelevant: true,
      irrelevantMonsterIds: ["rock_crab"]
    },
    {
      dagannoth: { enabled: false, targets: 5, respawnSec: 45 },
      hobgoblin_armed: { enabled: true, targets: 4, respawnSec: 20 }
    },
    { rock_crab: changedCustom, hobgoblin_armed: addedCustom },
    changedForm({ ...DEFAULT_FORM_STATE, monsterId: "dagannoth" }),
    "custom"
  );
  return { current, incoming };
}

describe("setup transfer change review", () => {
  it("keeps the explicit form registry exhaustive against every parsed physical leaf", () => {
    const parsed = CombatSetupFormSchema.parse(DEFAULT_FORM_STATE);
    expect([...setupFormPhysicalLeafPaths()].sort()).toEqual(flattenLeafPaths(parsed).sort());
  });

  it("builds all 13 setup-file groups with exhaustive unique field identities", () => {
    const { context } = createGeneratedRuntimeContext();
    const { current, incoming } = setupFixtures();
    const review = createSetupFileChangeReview({ current, incoming, gameData: context.gameData });

    expect(review.groups.map((item) => item.id)).toEqual([
      "transfer-context",
      "active-setup-identity",
      "player-levels",
      "active-combat-loadout",
      "other-combat-loadouts",
      "prayers-boosts-special",
      "manual-combat-overrides",
      "trip-supplies-banking",
      "planner-targets",
      "default-setup",
      "custom-setups",
      "cannon-settings",
      "dense-compare"
    ]);
    expect(review.changeCount).toBeGreaterThan(100);

    const fieldIds: string[] = [];
    const visit = (groups: typeof review.groups): void => {
      for (const item of groups) {
        fieldIds.push(...item.changes.map((change) => change.id));
        visit(item.children);
      }
    };
    visit(review.groups);
    expect(new Set(fieldIds).size).toBe(fieldIds.length);
    expect(fieldIds).toContain("active-level-hitpoints");
    expect(fieldIds).toContain("active-magic-manual-attackSpeedSec");
    expect(fieldIds).toContain("active-trip-prayerPotionDoses");
    expect(fieldIds).toContain("active-trip-foodPerKillOverride");
    expect(fieldIds).toContain("default-planner-magic");
    expect(fieldIds).toContain("dense-irrelevant-added-rock_crab");
    expect(
      review.groups
        .flatMap((item) => item.changes)
        .find((change) => change.id === "active-trip-foodPerKillOverride")?.current.display
    ).toBe("Auto");

    const custom = review.groups.find((item) => item.id === "custom-setups")!;
    const cannon = review.groups.find((item) => item.id === "cannon-settings")!;
    expect(custom.children.map((item) => [item.id, item.status])).toEqual([
      ["custom-dagannoth", "removed"],
      ["custom-hobgoblin_armed", "added"],
      ["custom-rock_crab", "changed"]
    ]);
    expect(cannon.children.map((item) => [item.id, item.status])).toEqual([
      ["cannon-dagannoth", "changed"],
      ["cannon-giant", "removed"],
      ["cannon-hobgoblin_armed", "added"]
    ]);

    const completeAddedForm = custom.children.find((item) => item.id === "custom-hobgoblin_armed")!;
    expect(completeAddedForm.children.map((item) => item.id)).toEqual([
      "custom-hobgoblin_armed-identity",
      "custom-hobgoblin_armed-levels",
      "custom-hobgoblin_armed-active-loadout",
      "custom-hobgoblin_armed-other-loadouts",
      "custom-hobgoblin_armed-prayers-special",
      "custom-hobgoblin_armed-manual",
      "custom-hobgoblin_armed-trip",
      "custom-hobgoblin_armed-planner"
    ]);
    expect(fieldIdsUnder(completeAddedForm).sort()).toEqual(
      [...setupFormSemanticFieldIds("custom-hobgoblin_armed")].sort()
    );
  });

  it("normalizes set ordering, produces a no-op review and fingerprints only semantic state", () => {
    const { context } = createGeneratedRuntimeContext();
    const current = savedSetupFromForm(DEFAULT_FORM_STATE, {
      sort: { key: "xpPerHour", direction: "desc" },
      monsterFilter: "",
      dropFilter: "",
      showIrrelevant: false,
      irrelevantMonsterIds: ["giant", "rock_crab"]
    });
    const reordered = structuredClone(current);
    reordered.form.prayers.reverse();
    reordered.form.perStyleLoadouts.melee.prayers.reverse();
    reordered.denseCompare.irrelevantMonsterIds.reverse();

    const review = createSetupFileChangeReview({
      current,
      incoming: reordered,
      gameData: context.gameData
    });

    expect(review.changeCount).toBe(0);
    expect(fingerprintSetupTransferState(current)).toBe(fingerprintSetupTransferState(reordered));
    expect(setupFileReviewMatchesCurrent(review, reordered)).toBe(true);
  });

  it("keeps fingerprints and private implementation values out of presentable rows", () => {
    const { context } = createGeneratedRuntimeContext();
    const { current, incoming } = setupFixtures();
    const review = createSetupFileChangeReview({ current, incoming, gameData: context.gameData });
    const presentation = JSON.stringify({
      groups: review.groups,
      includedScope: review.includedScope,
      excludedScope: review.excludedScope
    });

    expect(presentation).not.toContain(review.currentFingerprint);
    expect(presentation).not.toContain(review.incomingFingerprint);
    expect(presentation).not.toContain("index-sim:rewrite-setup");
    expect(presentation).not.toContain("savedAt");
    expect(presentation).not.toContain("/Users/");
    expect(review.includedScope).toContain("Dense Compare preferences");
    expect(review.excludedScope).toContain("PriceSet, manual prices and price history");
  });

  it("reuses all eight form groups for shared links and adds exact target-owned cannon and loot scope", () => {
    const { context } = createGeneratedRuntimeContext();
    const monster = context.gameData.monsters[DEFAULT_FORM_STATE.monsterId]!;
    const lootIds = lootPreferenceKeysForMonster(monster);
    const coinIds = lootIds.filter((id) => id.startsWith("key_coins_"));
    expect(coinIds.length).toBeGreaterThan(1);
    const currentLoot = Object.fromEntries(coinIds.map((id) => [id, "loot" as const]));
    const incomingLoot = Object.fromEntries(coinIds.map((id) => [id, "skip" as const]));
    const incomingForm = normalizeFormState({
      ...changedForm(),
      monsterId: DEFAULT_FORM_STATE.monsterId
    });
    const current = {
      form: DEFAULT_FORM_STATE,
      cannon: DEFAULT_CANNON_SETTINGS,
      lootPreferences: currentLoot,
      lootSettings: DEFAULT_MONSTER_LOOT_SETTINGS
    };
    const incoming = {
      form: incomingForm,
      cannon: { enabled: true, targets: 5, respawnSec: 30 },
      lootPreferences: incomingLoot,
      lootSettings: { highAlch: true, overheadSec: 4, talismanSpot: "overground" as const }
    };
    const review = createSharedSetupChangeReview({ current, incoming, gameData: context.gameData });

    expect(review.kind).toBe("shared-link");
    expect(review.groups.map((item) => item.id)).toEqual([
      "shared-form-identity",
      "shared-form-levels",
      "shared-form-active-loadout",
      "shared-form-other-loadouts",
      "shared-form-prayers-special",
      "shared-form-manual",
      "shared-form-trip",
      "shared-form-planner",
      "shared-cannon",
      "shared-loot-actions",
      "shared-loot-settings"
    ]);
    expect(review.includedScope).toHaveLength(4);
    expect(review.excludedScope).toContain("Recipient PriceSet, manual prices and price history");
    const lootGroup = review.groups.find((group) => group.id === "shared-loot-actions")!;
    expect(lootGroup.changes.map((change) => change.id)).toEqual(
      expect.arrayContaining(coinIds.map((id) => `shared-loot-action-${id}`))
    );
    expect(new Set(lootGroup.changes.map((change) => change.label)).size).toBe(
      lootGroup.changes.length
    );
    expect(lootGroup.changes.every((change) => !change.label.includes("key_coins"))).toBe(true);
    expect(sharedSetupReviewMatchesCurrent(review, current)).toBe(true);
    expect(
      sharedSetupReviewMatchesCurrent(review, {
        ...current,
        form: normalizeFormState({
          ...current.form,
          levels: { ...current.form.levels, attack: current.form.levels.attack + 1 }
        })
      })
    ).toBe(false);
    expect(
      sharedSetupReviewMatchesCurrent(review, {
        ...current,
        priceSet: { itemPrices: { coins: 999 } }
      } as typeof current)
    ).toBe(true);
  });

  it("supports shared-link and saved-row no-op reviews without inventing an applicable change", () => {
    const { context } = createGeneratedRuntimeContext();
    const sharedState = {
      form: DEFAULT_FORM_STATE,
      cannon: DEFAULT_CANNON_SETTINGS,
      lootPreferences: {},
      lootSettings: DEFAULT_MONSTER_LOOT_SETTINGS
    };
    const sharedReview = createSharedSetupChangeReview({
      current: sharedState,
      incoming: sharedState,
      gameData: context.gameData
    });
    const savedReview = createSavedRowSetupChangeReview({
      current: DEFAULT_FORM_STATE,
      incoming: DEFAULT_FORM_STATE,
      gameData: context.gameData
    });

    expect(sharedReview.changeCount).toBe(0);
    expect(savedReview.changeCount).toBe(0);
  });

  it("keeps saved-row Load review bound to both the live form and the same row source", () => {
    const { context } = createGeneratedRuntimeContext();
    const incoming = normalizeFormState({
      ...changedForm(),
      monsterId: DEFAULT_FORM_STATE.monsterId
    });
    const review = createSavedRowSetupChangeReview({
      current: DEFAULT_FORM_STATE,
      incoming,
      gameData: context.gameData
    });

    expect(review.kind).toBe("saved-row");
    expect(review.groups.map((item) => item.id)).toEqual([
      "saved-row-form-identity",
      "saved-row-form-levels",
      "saved-row-form-active-loadout",
      "saved-row-form-other-loadouts",
      "saved-row-form-prayers-special",
      "saved-row-form-manual",
      "saved-row-form-trip",
      "saved-row-form-planner"
    ]);
    expect(review.groups[0]!.changes.map((change) => change.id)).not.toContain(
      "saved-row-form-monsterId"
    );
    expect(review.excludedScope).toContain("Calculated Duel impact");
    expect(savedRowReviewMatches(review, DEFAULT_FORM_STATE, incoming)).toBe(true);
    expect(
      savedRowReviewMatches(
        review,
        normalizeFormState({
          ...DEFAULT_FORM_STATE,
          levels: { ...DEFAULT_FORM_STATE.levels, attack: 2 }
        }),
        incoming
      )
    ).toBe(false);
    expect(
      savedRowReviewMatches(
        review,
        DEFAULT_FORM_STATE,
        normalizeFormState({
          ...incoming,
          levels: { ...incoming.levels, strength: incoming.levels.strength + 1 }
        })
      )
    ).toBe(false);
  });
});

import { z } from "zod";
import {
  isSupportedSpecialAttackWeapon,
  supportedSpecialAttacksForCombatStyle,
  weaponStances
} from "@/domain/combat";
import {
  EQUIPMENT_SLOTS,
  type CombatStyle,
  type EntityId,
  type GameDataSnapshot,
  type ManualCombatOverrides,
  type SimulationRequest,
  type SpecialAttackSelection
} from "@/domain/shared";
import type { CannonSettings, TripPolicy } from "@/domain/trip";
import {
  DEFAULT_DENSE_COMPARE_STATE,
  DenseCompareUiStateSchema,
  type DenseCompareUiState
} from "./dense-compare";

export const REWRITE_SETUP_STORAGE_KEY = "index-sim:rewrite-setup";
export const REWRITE_SETUP_VERSION = 3;

export const COMBAT_STYLES = ["melee", "ranged", "magic"] as const;
export const CombatStyleSchema = z.enum(COMBAT_STYLES);
export const SETUP_MODES = ["default", "custom"] as const;
export const SetupModeSchema = z.enum(SETUP_MODES);
const MIN_MANUAL_BONUS = -250;
const MAX_MANUAL_BONUS = 350;
const MIN_MANUAL_ATTACK_SPEED_SEC = 0.6;
const MAX_MANUAL_ATTACK_SPEED_SEC = 12;

export type SetupMode = z.infer<typeof SetupModeSchema>;

export const PlayerLevelsSchema = z
  .object({
    attack: z.number().int().min(1).max(99),
    strength: z.number().int().min(1).max(99),
    defence: z.number().int().min(1).max(99),
    hitpoints: z.number().int().min(1).max(99).default(50),
    ranged: z.number().int().min(1).max(99),
    magic: z.number().int().min(1).max(99),
    prayer: z.number().int().min(1).max(99)
  })
  .strict();

const GearSchema = z
  .object(Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, z.string().min(1)])))
  .partial()
  .strict();

export const DEFAULT_CANNON_SETTINGS = {
  enabled: false,
  targets: 3,
  respawnSec: null
} satisfies CannonSettings;

export const CannonSettingsSchema = z
  .object({
    enabled: z.boolean().catch(false).default(false),
    targets: z.number().int().min(1).max(8).catch(3).default(3),
    respawnSec: z.number().int().min(1).max(3600).nullable().catch(null).default(null)
  })
  .strict()
  .catch(DEFAULT_CANNON_SETTINGS);

export const CannonByMonsterSchema = z
  .record(z.string().min(1), CannonSettingsSchema)
  .catch({})
  .default({});

export const ProtectPrayerSchema = z.enum(["none", "melee", "missiles", "magic"]);

export const DEFAULT_SPECIAL_ATTACK_STATE = {
  weaponId: "none",
  ammoId: "none"
} satisfies Required<SpecialAttackSelection>;

export const DEFAULT_MANUAL_OVERRIDES = {
  accuracyBonus: null,
  damageBonus: null,
  attackSpeedSec: null
} satisfies Required<ManualCombatOverrides>;

export const ManualOverridesSchema = z
  .object({
    accuracyBonus: z
      .number()
      .min(MIN_MANUAL_BONUS)
      .max(MAX_MANUAL_BONUS)
      .nullable()
      .catch(null)
      .default(null),
    damageBonus: z
      .number()
      .min(MIN_MANUAL_BONUS)
      .max(MAX_MANUAL_BONUS)
      .nullable()
      .catch(null)
      .default(null),
    attackSpeedSec: z
      .number()
      .min(MIN_MANUAL_ATTACK_SPEED_SEC)
      .max(MAX_MANUAL_ATTACK_SPEED_SEC)
      .nullable()
      .catch(null)
      .default(null)
  })
  .strict()
  .catch(DEFAULT_MANUAL_OVERRIDES)
  .default(DEFAULT_MANUAL_OVERRIDES);

const SpecialAttackWeaponSchema = z
  .string()
  .min(1)
  .catch("none")
  .default("none")
  .transform((weaponId) =>
    weaponId === "none" || isSupportedSpecialAttackWeapon(weaponId) ? weaponId : "none"
  );

export const SpecialAttackFormSchema = z
  .object({
    weaponId: SpecialAttackWeaponSchema,
    ammoId: z.string().min(1).catch("none").default("none")
  })
  .strict()
  .catch(DEFAULT_SPECIAL_ATTACK_STATE)
  .default(DEFAULT_SPECIAL_ATTACK_STATE);

const DEFAULT_GEAR = {
  helm: "rune_full_helm",
  amulet: "amu_power",
  body: "rune_platebody",
  legs: "rune_platelegs",
  shield: "rune_kite",
  gloves: "none",
  boots: "climbing_boots",
  cape: "cape_legends",
  ring: "none"
} satisfies Record<(typeof EQUIPMENT_SLOTS)[number], EntityId>;

export const CombatStyleLoadoutSchema = z
  .object({
    weaponId: z.string().min(1),
    ammoId: z.string().min(1),
    spellId: z.string().min(1),
    styleId: z.string().min(1),
    gear: GearSchema,
    prayers: z.array(z.string().min(1)),
    boosts: z.array(z.string().min(1)),
    sustained: z.boolean(),
    repotThreshold: z.number().int().min(1).max(120).nullable(),
    specialAttack: SpecialAttackFormSchema,
    manualOverrides: ManualOverridesSchema
  })
  .strict();

export type CombatStyleLoadout = z.infer<typeof CombatStyleLoadoutSchema>;

export const PerStyleLoadoutsSchema = z
  .object({
    melee: CombatStyleLoadoutSchema,
    ranged: CombatStyleLoadoutSchema,
    magic: CombatStyleLoadoutSchema
  })
  .strict();

export type PerStyleLoadoutsState = z.infer<typeof PerStyleLoadoutsSchema>;

function cloneGear(gear: CombatStyleLoadout["gear"]): CombatStyleLoadout["gear"] {
  return { ...gear };
}

function cloneLoadout(loadout: CombatStyleLoadout): CombatStyleLoadout {
  return CombatStyleLoadoutSchema.parse({
    ...loadout,
    gear: cloneGear(loadout.gear),
    prayers: [...loadout.prayers],
    boosts: [...loadout.boosts],
    specialAttack: { ...loadout.specialAttack },
    manualOverrides: { ...loadout.manualOverrides }
  });
}

export function createDefaultLoadoutForStyle(
  combatStyle: CombatStyle,
  source?: CombatStyleLoadout
): CombatStyleLoadout {
  const base = source ?? {
    weaponId: "rune_scimitar",
    ammoId: "none",
    spellId: "fire_bolt",
    styleId: "aggressive",
    gear: DEFAULT_GEAR,
    prayers: ["ultimate", "incredible"],
    boosts: ["super_att", "super_str"],
    sustained: true,
    repotThreshold: 65,
    specialAttack: DEFAULT_SPECIAL_ATTACK_STATE,
    manualOverrides: DEFAULT_MANUAL_OVERRIDES
  };
  const patch: Pick<
    CombatStyleLoadout,
    "weaponId" | "ammoId" | "spellId" | "styleId" | "specialAttack"
  > =
    combatStyle === "melee"
      ? {
          weaponId: "rune_scimitar",
          ammoId: "none",
          spellId: base.spellId,
          specialAttack: DEFAULT_SPECIAL_ATTACK_STATE,
          styleId: "aggressive"
        }
      : combatStyle === "ranged"
        ? {
            weaponId: "magic_shortbow",
            ammoId: "rune_arrow",
            spellId: base.spellId,
            specialAttack: DEFAULT_SPECIAL_ATTACK_STATE,
            styleId: "rapid"
          }
        : {
            weaponId: "staff_of_fire",
            ammoId: "none",
            spellId: "fire_bolt",
            specialAttack: DEFAULT_SPECIAL_ATTACK_STATE,
            styleId: "accurate"
          };

  return CombatStyleLoadoutSchema.parse({
    ...base,
    ...patch,
    gear: {
      ...cloneGear(base.gear),
      shield: combatStyle === "ranged" ? "none" : (base.gear.shield ?? "none")
    },
    prayers: [...base.prayers],
    boosts: [...base.boosts],
    specialAttack: { ...patch.specialAttack },
    manualOverrides: { ...base.manualOverrides }
  });
}

export function createDefaultPerStyleLoadouts(): PerStyleLoadoutsState {
  const base = createDefaultLoadoutForStyle("melee");
  return PerStyleLoadoutsSchema.parse({
    melee: base,
    ranged: createDefaultLoadoutForStyle("ranged", base),
    magic: createDefaultLoadoutForStyle("magic", base)
  });
}

export const CombatSetupFormSchema = z
  .object({
    combatStyle: CombatStyleSchema,
    monsterId: z.string().min(1),
    weaponId: z.string().min(1),
    ammoId: z.string().min(1),
    spellId: z.string().min(1),
    styleId: z.string().min(1),
    levels: PlayerLevelsSchema,
    gear: GearSchema,
    prayers: z.array(z.string().min(1)),
    boosts: z.array(z.string().min(1)),
    sustained: z.boolean(),
    repotThreshold: z.number().int().min(1).max(120).nullable(),
    specialAttack: SpecialAttackFormSchema,
    manualOverrides: ManualOverridesSchema,
    perStyleLoadouts: PerStyleLoadoutsSchema.default(createDefaultPerStyleLoadouts),
    ringOfWealth: z.boolean(),
    trip: z
      .object({
        foodKey: z.string().min(1),
        teleport: z.boolean(),
        bankSeconds: z.number().int().min(0).max(3600),
        prayerMode: z.enum(["potions", "altar", "none"]),
        alching: z.boolean(),
        recoverAmmo: z.boolean(),
        antifire: z.boolean(),
        antipoison: z.boolean(),
        safespot: z.boolean().nullable().catch(null).default(null),
        protect: ProtectPrayerSchema.catch("none").default("none"),
        recoilRings: z.number().int().min(1).max(28).catch(1).default(1),
        foodCount: z.number().int().min(0).max(28).nullable().catch(null).default(null),
        foodPerKillOverride: z.number().min(0).max(999).nullable().catch(null).default(null),
        prayerPotionSets: z.number().int().min(0).max(28).nullable().catch(null).default(null),
        prayerPotionDoses: z.number().int().min(0).max(112).nullable().catch(null).default(null),
        altarSeconds: z.number().int().min(0).max(3600).nullable().catch(null).default(null),
        scarceSpot: z.boolean().catch(false).default(false),
        targetsAtSpot: z.number().int().min(1).max(64).nullable().catch(null).default(null),
        respawnSeconds: z.number().int().min(1).max(3600).nullable().catch(null).default(null)
      })
      .strict(),
    plannerTargets: z
      .object({
        attack: z.number().int().min(1).max(99),
        strength: z.number().int().min(1).max(99),
        defence: z.number().int().min(1).max(99),
        ranged: z.number().int().min(1).max(99),
        magic: z.number().int().min(1).max(99)
      })
      .partial()
      .strict()
  })
  .strict();

export const CustomSetupsByMonsterSchema = z
  .record(z.string().min(1), CombatSetupFormSchema)
  .catch({})
  .default({});

export type CustomSetupsByMonsterState = z.infer<typeof CustomSetupsByMonsterSchema>;

export const SavedSetupSchema = z
  .object({
    form: CombatSetupFormSchema,
    defaultForm: CombatSetupFormSchema.optional(),
    setupMode: SetupModeSchema.catch("default").default("default"),
    customSetupsByMonster: CustomSetupsByMonsterSchema,
    cannonByMonster: CannonByMonsterSchema,
    denseCompare: DenseCompareUiStateSchema.default(DEFAULT_DENSE_COMPARE_STATE)
  })
  .strict()
  .transform((setup) => {
    const customSetupsByMonster = normalizeCustomSetupsByMonster(setup.customSetupsByMonster);
    const setupMode: SetupMode =
      setup.setupMode === "custom" && customSetupsByMonster[setup.form.monsterId]
        ? "custom"
        : "default";
    return {
      ...setup,
      form: normalizeFormState(setup.form),
      defaultForm: normalizeFormState(setup.defaultForm ?? setup.form),
      setupMode,
      customSetupsByMonster
    };
  });

export const SavedSetupEnvelopeSchema = z
  .object({
    version: z.literal(REWRITE_SETUP_VERSION),
    savedAt: z.string().min(1),
    data: SavedSetupSchema
  })
  .strict();

export type CombatSetupFormState = z.infer<typeof CombatSetupFormSchema>;
export type CannonByMonsterState = z.infer<typeof CannonByMonsterSchema>;
export type SavedSetupState = z.infer<typeof SavedSetupSchema>;

export const DEFAULT_FORM_STATE: CombatSetupFormState = {
  combatStyle: "melee",
  monsterId: "giant",
  weaponId: "rune_scimitar",
  ammoId: "none",
  spellId: "fire_bolt",
  styleId: "aggressive",
  levels: {
    attack: 60,
    strength: 60,
    defence: 50,
    hitpoints: 50,
    ranged: 50,
    magic: 50,
    prayer: 43
  },
  gear: DEFAULT_GEAR,
  prayers: ["ultimate", "incredible"],
  boosts: ["super_att", "super_str"],
  sustained: true,
  repotThreshold: 65,
  specialAttack: DEFAULT_SPECIAL_ATTACK_STATE,
  manualOverrides: DEFAULT_MANUAL_OVERRIDES,
  perStyleLoadouts: createDefaultPerStyleLoadouts(),
  ringOfWealth: false,
  trip: {
    foodKey: "lobster",
    teleport: true,
    bankSeconds: 90,
    prayerMode: "potions",
    alching: false,
    recoverAmmo: true,
    antifire: false,
    antipoison: false,
    safespot: null,
    protect: "none",
    recoilRings: 1,
    foodCount: null,
    foodPerKillOverride: null,
    prayerPotionSets: null,
    prayerPotionDoses: null,
    altarSeconds: null,
    scarceSpot: false,
    targetsAtSpot: null,
    respawnSeconds: null
  },
  plannerTargets: {
    attack: 62,
    strength: 62,
    defence: 50,
    ranged: 50,
    magic: 50
  }
};

export function normalizeCustomSetupsByMonster(
  state: CustomSetupsByMonsterState
): CustomSetupsByMonsterState {
  const normalized: CustomSetupsByMonsterState = {};
  for (const [monsterId, setup] of Object.entries(state)) {
    normalized[monsterId] = normalizeFormState({ ...setup, monsterId });
  }
  return normalized;
}

export function setCustomSetupForMonster(
  state: CustomSetupsByMonsterState,
  form: CombatSetupFormState
): CustomSetupsByMonsterState {
  return normalizeCustomSetupsByMonster({
    ...state,
    [form.monsterId]: normalizeFormState(form)
  });
}

export function removeCustomSetupForMonster(
  state: CustomSetupsByMonsterState,
  monsterId: EntityId
): CustomSetupsByMonsterState {
  if (!state[monsterId]) return normalizeCustomSetupsByMonster(state);
  const next = { ...state };
  delete next[monsterId];
  return normalizeCustomSetupsByMonster(next);
}

export function formForMonsterSetup(
  defaultForm: CombatSetupFormState,
  customSetupsByMonster: CustomSetupsByMonsterState,
  monsterId: EntityId
): { form: CombatSetupFormState; setupMode: SetupMode } {
  const custom = customSetupsByMonster[monsterId];
  if (custom) {
    return { form: normalizeFormState({ ...custom, monsterId }), setupMode: "custom" };
  }
  return {
    form: normalizeFormState({ ...defaultForm, monsterId }),
    setupMode: "default"
  };
}

export function loadoutFromForm(form: CombatSetupFormState): CombatStyleLoadout {
  return CombatStyleLoadoutSchema.parse({
    weaponId: form.weaponId,
    ammoId: form.ammoId,
    spellId: form.spellId,
    styleId: form.styleId,
    gear: form.gear,
    prayers: form.prayers,
    boosts: form.boosts,
    sustained: form.sustained,
    repotThreshold: form.repotThreshold,
    specialAttack: form.specialAttack,
    manualOverrides: form.manualOverrides
  });
}

function validStyleIdForWeapon(
  combatStyle: CombatStyle,
  weaponId: EntityId,
  currentStyleId: EntityId,
  gameData: GameDataSnapshot
): EntityId {
  if (combatStyle === "melee") {
    const stances = weaponStances(weaponId, gameData);
    return stances.some((stance) => stance.id === currentStyleId)
      ? currentStyleId
      : (stances[0]?.id ?? currentStyleId);
  }
  const validIds =
    combatStyle === "ranged"
      ? ["accurate", "rapid", "longrange"]
      : ["accurate", "defensive", "longrange"];
  return validIds.includes(currentStyleId) ? currentStyleId : validIds[0]!;
}

function firstArrowAmmo(gameData: GameDataSnapshot): EntityId {
  return (
    Object.entries(gameData.ammo)
      .filter(([, ammo]) => ammo.kind === "arrow")
      .sort(([, left], [, right]) => left.name.localeCompare(right.name))[0]?.[0] ?? "none"
  );
}

export function applyWeaponSelection(
  form: CombatSetupFormState,
  weaponId: EntityId,
  gameData: GameDataSnapshot
): CombatSetupFormState {
  const current = normalizeFormState(form);
  const weapon = gameData.weapons[weaponId];
  if (!weapon || weapon.type !== current.combatStyle) return current;

  const ammoId =
    current.combatStyle !== "ranged"
      ? "none"
      : weapon.sub === "thrown"
        ? (weapon.ammoKey ?? "none")
        : current.ammoId !== "none" && gameData.ammo[current.ammoId]?.kind === "arrow"
          ? current.ammoId
          : gameData.ammo.rune_arrow
            ? "rune_arrow"
            : firstArrowAmmo(gameData);

  return normalizeFormState({
    ...current,
    weaponId,
    ammoId,
    styleId: validStyleIdForWeapon(current.combatStyle, weaponId, current.styleId, gameData),
    gear: {
      ...current.gear,
      shield: weapon.twoHand ? "none" : (current.gear.shield ?? "none")
    },
    specialAttack: isSupportedSpecialAttackWeapon(
      current.specialAttack.weaponId,
      current.combatStyle
    )
      ? current.specialAttack
      : DEFAULT_SPECIAL_ATTACK_STATE
  });
}

function syncActiveLoadout(form: CombatSetupFormState): CombatSetupFormState {
  const next = CombatSetupFormSchema.parse(form);
  return {
    ...next,
    perStyleLoadouts: PerStyleLoadoutsSchema.parse({
      ...next.perStyleLoadouts,
      [next.combatStyle]: loadoutFromForm(next)
    })
  };
}

export function normalizeFormState(form: CombatSetupFormState): CombatSetupFormState {
  let next = CombatSetupFormSchema.parse(form);
  const specialAttack = isSupportedSpecialAttackWeapon(
    next.specialAttack.weaponId,
    next.combatStyle
  )
    ? next.specialAttack
    : DEFAULT_SPECIAL_ATTACK_STATE;
  if (next.combatStyle === "ranged" && next.ammoId === "none") {
    next = {
      ...next,
      ammoId: "rune_arrow",
      specialAttack:
        specialAttack.weaponId !== "none"
          ? {
              ...specialAttack,
              ammoId: specialAttack.ammoId === "none" ? "rune_arrow" : specialAttack.ammoId
            }
          : specialAttack,
      styleId: next.styleId === "aggressive" ? "rapid" : next.styleId
    };
    return syncActiveLoadout(next);
  }
  if (next.combatStyle === "magic" && next.styleId === "aggressive") {
    next = { ...next, specialAttack: DEFAULT_SPECIAL_ATTACK_STATE, styleId: "accurate" };
    return syncActiveLoadout(next);
  }
  return syncActiveLoadout({ ...next, specialAttack });
}

export function formToTripPolicy(form: CombatSetupFormState): TripPolicy {
  const manualPrayerDoses =
    form.trip.prayerMode === "potions" && form.trip.prayerPotionDoses != null;
  const manualPrayerSets =
    form.trip.prayerMode === "potions" && !manualPrayerDoses && form.trip.prayerPotionSets != null;
  const manualAltarSeconds = form.trip.prayerMode === "altar" && form.trip.altarSeconds != null;

  return {
    foodKey: form.trip.foodKey,
    teleport: form.trip.teleport,
    bankSeconds: form.trip.bankSeconds,
    prayerMode: form.trip.prayerMode,
    alching: form.trip.alching,
    recoverAmmo: form.trip.recoverAmmo,
    antifire: form.trip.antifire,
    antipoison: form.trip.antipoison,
    safespot: form.trip.safespot ?? undefined,
    protect: form.trip.protect,
    recoilRings: form.trip.recoilRings,
    foodCount: form.trip.foodCount ?? undefined,
    foodPerKillOverride: form.trip.foodPerKillOverride ?? undefined,
    prayerPotionSets: manualPrayerSets ? (form.trip.prayerPotionSets ?? undefined) : undefined,
    prayerPotionDoses: manualPrayerDoses ? (form.trip.prayerPotionDoses ?? undefined) : undefined,
    altarSeconds: manualAltarSeconds ? (form.trip.altarSeconds ?? undefined) : undefined,
    scarceSpot: form.trip.scarceSpot,
    targetsAtSpot: form.trip.scarceSpot ? (form.trip.targetsAtSpot ?? undefined) : undefined,
    respawnSeconds: form.trip.scarceSpot ? (form.trip.respawnSeconds ?? undefined) : undefined
  };
}

function firstValidArrowAmmo(gameData: GameDataSnapshot): EntityId | undefined {
  return Object.entries(gameData.ammo)
    .sort(([left], [right]) => left.localeCompare(right))
    .find(([, ammo]) => ammo.kind === "arrow")?.[0];
}

function validSpecialAmmoId(
  form: CombatSetupFormState,
  gameData: GameDataSnapshot | undefined
): EntityId | undefined {
  const candidates = [form.specialAttack.ammoId, form.ammoId, "rune_arrow"].filter(
    (candidate) => candidate && candidate !== "none"
  );
  if (!gameData) return candidates[0] ?? "rune_arrow";
  return (
    candidates.find((candidate) => gameData.ammo[candidate]?.kind === "arrow") ??
    firstValidArrowAmmo(gameData)
  );
}

function specialAttackForRequest(
  form: CombatSetupFormState,
  gameData: GameDataSnapshot | undefined
): SpecialAttackSelection | undefined {
  const weaponId = form.specialAttack.weaponId;
  if (weaponId === "none" || !isSupportedSpecialAttackWeapon(weaponId, form.combatStyle)) {
    return undefined;
  }
  if (gameData && !gameData.weapons[weaponId]) return undefined;

  const supported = gameData
    ? supportedSpecialAttacksForCombatStyle(form.combatStyle, gameData)
    : undefined;
  const needsAmmo =
    supported?.find((attack) => attack.weaponId === weaponId)?.requiresAmmo ??
    form.combatStyle === "ranged";
  if (!needsAmmo) return { weaponId };

  const ammoId = validSpecialAmmoId(form, gameData);
  return ammoId ? { weaponId, ammoId } : undefined;
}

export function formToSimulationRequest(
  form: CombatSetupFormState,
  gameData?: GameDataSnapshot
): SimulationRequest {
  const normalized = normalizeFormState(form);
  return {
    combatStyle: normalized.combatStyle,
    monsterId: normalized.monsterId,
    levels: normalized.levels,
    loadout: {
      weaponId: normalized.weaponId,
      ammoId: normalized.ammoId,
      gear: normalized.gear
    },
    styleId: normalized.styleId,
    prayers: { keys: normalized.prayers.length ? normalized.prayers : ["none"] },
    boosts: { keys: normalized.boosts.length ? normalized.boosts : ["none"] },
    sustained: normalized.sustained,
    repotThreshold: normalized.repotThreshold,
    spellId: normalized.combatStyle === "magic" ? normalized.spellId : undefined,
    charge: true,
    specialAttack: specialAttackForRequest(normalized, gameData),
    manualOverrides: { ...normalized.manualOverrides }
  };
}

export function savedSetupFromForm(
  form: CombatSetupFormState,
  denseCompare: DenseCompareUiState = DEFAULT_DENSE_COMPARE_STATE,
  cannonByMonster: CannonByMonsterState = {},
  customSetupsByMonster: CustomSetupsByMonsterState = {},
  defaultForm: CombatSetupFormState = form,
  setupMode: SetupMode = "default"
): SavedSetupState {
  return SavedSetupSchema.parse({
    form: normalizeFormState(form),
    defaultForm: normalizeFormState(defaultForm),
    setupMode,
    customSetupsByMonster,
    denseCompare,
    cannonByMonster
  });
}

export function setCombatStyleDefaults(
  form: CombatSetupFormState,
  combatStyle: CombatStyle
): CombatSetupFormState {
  const current = normalizeFormState(form);
  const loadout = createDefaultLoadoutForStyle(combatStyle, loadoutFromForm(current));
  return normalizeFormState({
    ...current,
    ...loadout,
    combatStyle,
    perStyleLoadouts: {
      ...current.perStyleLoadouts,
      [combatStyle]: loadout
    }
  });
}

export function switchCombatStyleLoadout(
  form: CombatSetupFormState,
  combatStyle: CombatStyle
): CombatSetupFormState {
  const current = normalizeFormState(form);
  const stashedLoadouts = PerStyleLoadoutsSchema.parse({
    ...current.perStyleLoadouts,
    [current.combatStyle]: loadoutFromForm(current)
  });
  const restoredLoadout = cloneLoadout(stashedLoadouts[combatStyle]);

  return normalizeFormState({
    ...current,
    ...restoredLoadout,
    combatStyle,
    perStyleLoadouts: {
      ...stashedLoadouts,
      [combatStyle]: restoredLoadout
    }
  });
}

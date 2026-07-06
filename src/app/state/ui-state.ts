import { z } from "zod";
import {
  isSupportedSpecialAttackWeapon,
  supportedSpecialAttacksForCombatStyle
} from "@/domain/combat";
import {
  EQUIPMENT_SLOTS,
  type CombatStyle,
  type EntityId,
  type GameDataSnapshot,
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
export const REWRITE_SETUP_VERSION = 2;

export const CombatStyleSchema = z.enum(["melee", "ranged", "magic"]);

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
        altarSeconds: z.number().int().min(0).max(3600).nullable().catch(null).default(null)
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

export const SavedSetupSchema = z
  .object({
    form: CombatSetupFormSchema,
    cannonByMonster: CannonByMonsterSchema,
    denseCompare: DenseCompareUiStateSchema.default(DEFAULT_DENSE_COMPARE_STATE)
  })
  .strict();

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
  gear: {
    helm: "rune_full_helm",
    amulet: "amu_power",
    body: "rune_platebody",
    legs: "rune_platelegs",
    shield: "rune_kite",
    gloves: "none",
    boots: "climbing_boots",
    cape: "cape_legends",
    ring: "none"
  },
  prayers: ["ultimate", "incredible"],
  boosts: ["super_att", "super_str"],
  sustained: true,
  repotThreshold: 65,
  specialAttack: DEFAULT_SPECIAL_ATTACK_STATE,
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
    altarSeconds: null
  },
  plannerTargets: {
    attack: 62,
    strength: 62,
    defence: 50,
    ranged: 50,
    magic: 50
  }
};

export function normalizeFormState(form: CombatSetupFormState): CombatSetupFormState {
  const next = CombatSetupFormSchema.parse(form);
  const specialAttack =
    isSupportedSpecialAttackWeapon(next.specialAttack.weaponId, next.combatStyle)
      ? next.specialAttack
      : DEFAULT_SPECIAL_ATTACK_STATE;
  if (next.combatStyle === "ranged" && next.ammoId === "none") {
    return {
      ...next,
      ammoId: "rune_arrow",
      specialAttack:
        specialAttack.weaponId !== "none"
          ? { ...specialAttack, ammoId: specialAttack.ammoId === "none" ? "rune_arrow" : specialAttack.ammoId }
          : specialAttack,
      styleId: next.styleId === "aggressive" ? "rapid" : next.styleId
    };
  }
  if (next.combatStyle === "magic" && next.styleId === "aggressive") {
    return { ...next, specialAttack: DEFAULT_SPECIAL_ATTACK_STATE, styleId: "accurate" };
  }
  return { ...next, specialAttack };
}

export function formToTripPolicy(form: CombatSetupFormState): TripPolicy {
  const manualPrayerDoses =
    form.trip.prayerMode === "potions" && form.trip.prayerPotionDoses != null;
  const manualPrayerSets =
    form.trip.prayerMode === "potions" &&
    !manualPrayerDoses &&
    form.trip.prayerPotionSets != null;
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
    prayerPotionSets: manualPrayerSets ? form.trip.prayerPotionSets ?? undefined : undefined,
    prayerPotionDoses: manualPrayerDoses ? form.trip.prayerPotionDoses ?? undefined : undefined,
    altarSeconds: manualAltarSeconds ? form.trip.altarSeconds ?? undefined : undefined
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
    specialAttack: specialAttackForRequest(normalized, gameData)
  };
}

export function savedSetupFromForm(
  form: CombatSetupFormState,
  denseCompare: DenseCompareUiState = DEFAULT_DENSE_COMPARE_STATE,
  cannonByMonster: CannonByMonsterState = {}
): SavedSetupState {
  return SavedSetupSchema.parse({ form, denseCompare, cannonByMonster });
}

export function setCombatStyleDefaults(
  form: CombatSetupFormState,
  combatStyle: CombatStyle
): CombatSetupFormState {
  const patch: Partial<CombatSetupFormState> =
    combatStyle === "melee"
      ? {
          weaponId: "rune_scimitar",
          ammoId: "none",
          specialAttack: DEFAULT_SPECIAL_ATTACK_STATE,
          styleId: "aggressive"
        }
      : combatStyle === "ranged"
        ? {
            weaponId: "magic_shortbow",
            ammoId: "rune_arrow",
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
  return normalizeFormState({ ...form, ...patch, combatStyle });
}

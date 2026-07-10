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

type SelectionCategory =
  "att" | "str" | "def" | "rng" | "mag" | "gauntlets" | "restore" | "special";

export interface SetupSelectionOption {
  id: EntityId;
  label: string;
  category: SelectionCategory;
  categoryLabel: string;
}

export const PRAYER_SELECTION_OPTIONS = [
  { id: "clarity", label: "clarity", category: "att", categoryLabel: "Attack" },
  { id: "reflexes", label: "reflexes", category: "att", categoryLabel: "Attack" },
  { id: "incredible", label: "incredible", category: "att", categoryLabel: "Attack" },
  { id: "burst", label: "burst", category: "str", categoryLabel: "Strength" },
  { id: "superhuman", label: "superhuman", category: "str", categoryLabel: "Strength" },
  { id: "ultimate", label: "ultimate", category: "str", categoryLabel: "Strength" },
  { id: "thick_skin", label: "thick skin", category: "def", categoryLabel: "Defence" },
  { id: "rock_skin", label: "rock skin", category: "def", categoryLabel: "Defence" },
  { id: "steel_skin", label: "steel skin", category: "def", categoryLabel: "Defence" }
] satisfies SetupSelectionOption[];

export const BOOST_SELECTION_OPTIONS = [
  { id: "super_att", label: "super att", category: "att", categoryLabel: "Attack" },
  { id: "super_str", label: "super str", category: "str", categoryLabel: "Strength" },
  { id: "super_def", label: "super def", category: "def", categoryLabel: "Defence" },
  { id: "ranging", label: "ranging", category: "rng", categoryLabel: "Ranged" },
  { id: "magic", label: "magic", category: "mag", categoryLabel: "Magic" },
  {
    id: "chaos_gauntlets",
    label: "chaos gauntlets",
    category: "gauntlets",
    categoryLabel: "Gauntlets"
  },
  { id: "dba_spec", label: "dba spec", category: "special", categoryLabel: "Special" },
  { id: "restore", label: "restore", category: "restore", categoryLabel: "Restore" }
] satisfies SetupSelectionOption[];

const PRAYER_SELECTIONS_BY_ID = selectionOptionsById(PRAYER_SELECTION_OPTIONS);
const BOOST_SELECTIONS_BY_ID = selectionOptionsById(BOOST_SELECTION_OPTIONS);

function selectionOptionsById(
  options: readonly SetupSelectionOption[]
): Map<EntityId, SetupSelectionOption> {
  return new Map(options.map((option) => [option.id, option]));
}

function normalizeSelection(
  keys: readonly string[],
  optionsById: ReadonlyMap<EntityId, SetupSelectionOption>
): EntityId[] {
  const normalized: EntityId[] = [];
  const indexByCategory = new Map<SelectionCategory, number>();

  for (const key of keys) {
    if (key === "none") continue;
    const option = optionsById.get(key);
    if (!option) continue;
    const existingIndex = indexByCategory.get(option.category);
    if (existingIndex == null) {
      indexByCategory.set(option.category, normalized.length);
      normalized.push(option.id);
    } else {
      normalized[existingIndex] = option.id;
    }
  }

  return normalized;
}

function setPrimarySelection(
  keys: readonly string[],
  id: string,
  optionsById: ReadonlyMap<EntityId, SetupSelectionOption>
): EntityId[] {
  if (id === "none") return [];
  const option = optionsById.get(id);
  if (!option) return normalizeSelection(keys, optionsById);
  return [
    option.id,
    ...normalizeSelection(keys, optionsById).filter((key) => {
      const existing = optionsById.get(key);
      return existing && existing.category !== option.category;
    })
  ];
}

function toggleSelection(
  keys: readonly string[],
  id: string,
  selected: boolean,
  optionsById: ReadonlyMap<EntityId, SetupSelectionOption>
): EntityId[] {
  if (id === "none") return selected ? [] : normalizeSelection(keys, optionsById);
  const option = optionsById.get(id);
  if (!option) return normalizeSelection(keys, optionsById);
  const normalized = normalizeSelection(keys, optionsById);
  if (!selected) return normalized.filter((key) => key !== option.id);

  const existingIndex = normalized.findIndex(
    (key) => optionsById.get(key)?.category === option.category
  );
  if (existingIndex === -1) return [...normalized, option.id];
  return normalized.map((key, index) => (index === existingIndex ? option.id : key));
}

export function normalizePrayerSelection(keys: readonly string[]): EntityId[] {
  return normalizeSelection(keys, PRAYER_SELECTIONS_BY_ID);
}

export function normalizeBoostSelection(keys: readonly string[]): EntityId[] {
  return normalizeSelection(keys, BOOST_SELECTIONS_BY_ID);
}

export function primaryPrayerValue(prayers: readonly string[]): EntityId {
  return normalizePrayerSelection(prayers)[0] ?? "none";
}

export function primaryBoostValue(boosts: readonly string[]): EntityId {
  return normalizeBoostSelection(boosts)[0] ?? "none";
}

export function extraPrayerSelectionCount(prayers: readonly string[]): number {
  return Math.max(0, normalizePrayerSelection(prayers).length - 1);
}

export function extraBoostSelectionCount(boosts: readonly string[]): number {
  return Math.max(0, normalizeBoostSelection(boosts).length - 1);
}

export function setPrimaryPrayerSelection(prayers: readonly string[], id: string): EntityId[] {
  return setPrimarySelection(prayers, id, PRAYER_SELECTIONS_BY_ID);
}

export function setPrimaryBoostSelection(boosts: readonly string[], id: string): EntityId[] {
  return setPrimarySelection(boosts, id, BOOST_SELECTIONS_BY_ID);
}

export function togglePrayerSelection(
  prayers: readonly string[],
  id: string,
  selected: boolean
): EntityId[] {
  return toggleSelection(prayers, id, selected, PRAYER_SELECTIONS_BY_ID);
}

export function toggleBoostSelection(
  boosts: readonly string[],
  id: string,
  selected: boolean
): EntityId[] {
  return toggleSelection(boosts, id, selected, BOOST_SELECTIONS_BY_ID);
}

const PrayerSelectionSchema = z.array(z.string().min(1)).transform(normalizePrayerSelection);
const BoostSelectionSchema = z.array(z.string().min(1)).transform(normalizeBoostSelection);

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

type SpecialAttackFormState = z.infer<typeof SpecialAttackFormSchema>;

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
    prayers: PrayerSelectionSchema,
    boosts: BoostSelectionSchema,
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

function dbaSpecActive(combatStyle: CombatStyle, boosts: readonly string[]): boolean {
  return combatStyle === "melee" && boosts.includes("dba_spec");
}

function normalizeSpecialAttackForStyle(
  combatStyle: CombatStyle,
  boosts: readonly string[],
  specialAttack: SpecialAttackSelection
): SpecialAttackFormState {
  if (
    dbaSpecActive(combatStyle, boosts) ||
    !isSupportedSpecialAttackWeapon(specialAttack.weaponId, combatStyle)
  ) {
    return DEFAULT_SPECIAL_ATTACK_STATE;
  }
  return SpecialAttackFormSchema.parse(specialAttack);
}

function normalizeLoadoutForStyle(
  combatStyle: CombatStyle,
  loadout: CombatStyleLoadout
): CombatStyleLoadout {
  const parsed = cloneLoadout(loadout);
  return {
    ...parsed,
    specialAttack: normalizeSpecialAttackForStyle(combatStyle, parsed.boosts, parsed.specialAttack)
  };
}

function normalizePerStyleLoadouts(loadouts: PerStyleLoadoutsState): PerStyleLoadoutsState {
  const parsed = PerStyleLoadoutsSchema.parse(loadouts);
  return PerStyleLoadoutsSchema.parse({
    melee: normalizeLoadoutForStyle("melee", parsed.melee),
    ranged: normalizeLoadoutForStyle("ranged", parsed.ranged),
    magic: normalizeLoadoutForStyle("magic", parsed.magic)
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

  return normalizeLoadoutForStyle(combatStyle, {
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
    prayers: PrayerSelectionSchema,
    boosts: BoostSelectionSchema,
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
        bankSeconds: z.number().int().min(0).max(3600).nullable().catch(null).default(null),
        potionSets: z.number().int().min(0).max(28).catch(1).default(1),
        potionDoses: z.number().int().min(0).max(112).catch(4).default(4),
        singleDose: z.boolean().catch(false).default(false),
        dbaRestore: z.boolean().catch(true).default(true),
        prayerMode: z.enum(["potions", "altar", "none"]),
        alching: z.boolean(),
        recoverAmmo: z.boolean(),
        runeSlots: z.number().int().min(0).max(28).catch(2).default(2),
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
    bankSeconds: null,
    potionSets: 1,
    potionDoses: 4,
    singleDose: false,
    dbaRestore: true,
    prayerMode: "potions",
    alching: false,
    recoverAmmo: true,
    runeSlots: 2,
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
  return normalizeLoadoutForStyle(form.combatStyle, {
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
    specialAttack: normalizeSpecialAttackForStyle(
      current.combatStyle,
      current.boosts,
      current.specialAttack
    )
  });
}

function syncActiveLoadout(form: CombatSetupFormState): CombatSetupFormState {
  const next = CombatSetupFormSchema.parse(form);
  return {
    ...next,
    perStyleLoadouts: normalizePerStyleLoadouts({
      ...next.perStyleLoadouts,
      [next.combatStyle]: loadoutFromForm(next)
    })
  };
}

export function normalizeFormState(form: CombatSetupFormState): CombatSetupFormState {
  let next = CombatSetupFormSchema.parse(form);
  next = { ...next, perStyleLoadouts: normalizePerStyleLoadouts(next.perStyleLoadouts) };
  const specialAttack = normalizeSpecialAttackForStyle(
    next.combatStyle,
    next.boosts,
    next.specialAttack
  );
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
    potionSets: form.trip.potionSets,
    potionDoses: form.trip.potionDoses,
    singleDose: form.trip.singleDose,
    dbaRestore: form.trip.dbaRestore,
    prayerMode: form.trip.prayerMode,
    alching: form.trip.alching,
    recoverAmmo: form.trip.recoverAmmo,
    runeSlots: form.trip.runeSlots,
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
  if (
    weaponId === "none" ||
    dbaSpecActive(form.combatStyle, form.boosts) ||
    !isSupportedSpecialAttackWeapon(weaponId, form.combatStyle)
  ) {
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

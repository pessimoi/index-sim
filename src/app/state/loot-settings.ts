import { z } from "zod";
import type { JewelSpot } from "@/domain/trip";

export const LOOT_SETTINGS_STORAGE_KEY = "index-sim:loot-settings";
export const LOOT_SETTINGS_VERSION = 1;

export const TALISMAN_SPOTS = ["underground", "overground"] as const satisfies readonly JewelSpot[];

export const TalismanSpotSchema = z.enum(TALISMAN_SPOTS);

export const DEFAULT_MONSTER_LOOT_SETTINGS = {
  overheadSec: null,
  talismanSpot: "underground"
} satisfies MonsterLootSettings;

export const MonsterLootSettingsSchema = z
  .object({
    highAlch: z.boolean().optional(),
    overheadSec: z.number().min(0).max(600).nullable().catch(null).default(null),
    talismanSpot: TalismanSpotSchema.catch("underground").default("underground")
  })
  .strict()
  .catch(DEFAULT_MONSTER_LOOT_SETTINGS)
  .default(DEFAULT_MONSTER_LOOT_SETTINGS);

export const LootSettingsByMonsterSchema = z
  .record(z.string().min(1).max(120), MonsterLootSettingsSchema)
  .catch({})
  .default({});

export type MonsterLootSettings = {
  highAlch?: boolean;
  overheadSec: number | null;
  talismanSpot: JewelSpot;
};

export type LootSettingsByMonsterState = z.infer<typeof LootSettingsByMonsterSchema>;

export const DEFAULT_LOOT_SETTINGS_STATE: LootSettingsByMonsterState = {};

export function lootSettingsForMonster(
  state: LootSettingsByMonsterState,
  monsterId: string
): MonsterLootSettings {
  return MonsterLootSettingsSchema.parse({
    ...DEFAULT_MONSTER_LOOT_SETTINGS,
    ...(state[monsterId] ?? {})
  });
}

export function setLootSettingsForMonster(
  state: LootSettingsByMonsterState,
  monsterId: string,
  patch: Partial<MonsterLootSettings>
): LootSettingsByMonsterState {
  const current = lootSettingsForMonster(state, monsterId);
  const nextSettings = MonsterLootSettingsSchema.parse({ ...current, ...patch });
  return LootSettingsByMonsterSchema.parse({
    ...state,
    [monsterId]: nextSettings
  });
}

export function resetLootSettingsForMonster(
  state: LootSettingsByMonsterState,
  monsterId: string
): LootSettingsByMonsterState {
  if (!state[monsterId]) return state;
  const next = { ...state };
  delete next[monsterId];
  return next;
}

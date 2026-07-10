import { z } from "zod";
import type { LootAction } from "@/domain/trip";

export const LOOT_PREFS_STORAGE_KEY = "index-sim:loot-prefs";
export const LOOT_PREFS_VERSION = 1;

export const LOOT_ACTION_VALUES = [
  "loot",
  "skip",
  "bury",
  "alch",
  "unid",
  "value"
] as const satisfies readonly LootAction[];

export const LootActionSchema = z.enum(LOOT_ACTION_VALUES);

const RawLootPrefsStateSchema = z
  .record(z.string().min(1).max(120), z.record(z.string().min(1).max(180), z.unknown()).catch({}))
  .catch({});

export const LootPrefsStateSchema = RawLootPrefsStateSchema.transform((state) => {
  const normalized: LootPrefsState = {};
  for (const [monsterId, monsterPrefs] of Object.entries(state)) {
    const cleanPrefs: Record<string, LootAction> = {};
    for (const [rowId, action] of Object.entries(monsterPrefs)) {
      const parsed = LootActionSchema.safeParse(action);
      if (parsed.success) cleanPrefs[rowId] = parsed.data;
    }
    if (Object.keys(cleanPrefs).length > 0) normalized[monsterId] = cleanPrefs;
  }
  return normalized;
});

export type LootPrefsState = Record<string, Record<string, LootAction>>;

export const DEFAULT_LOOT_PREFS_STATE: LootPrefsState = {};

export function selectLootPrefsForMonster(
  state: LootPrefsState,
  monsterId: string,
  validRowIds: readonly string[]
): Record<string, LootAction> {
  const valid = new Set(validRowIds);
  const monsterPrefs = state[monsterId] ?? {};
  const selected: Record<string, LootAction> = {};
  for (const [rowId, action] of Object.entries(monsterPrefs)) {
    if (valid.has(rowId)) selected[rowId] = action;
  }
  return selected;
}

export function setLootPreferenceForMonster(
  state: LootPrefsState,
  monsterId: string,
  rowId: string,
  action: LootAction | null
): LootPrefsState {
  const currentPrefs = { ...(state[monsterId] ?? {}) };
  if (action) currentPrefs[rowId] = action;
  else delete currentPrefs[rowId];

  const next = { ...state };
  if (Object.keys(currentPrefs).length > 0) next[monsterId] = currentPrefs;
  else delete next[monsterId];
  return LootPrefsStateSchema.parse(next);
}

export function resetLootPrefsForMonster(state: LootPrefsState, monsterId: string): LootPrefsState {
  if (!state[monsterId]) return state;
  const next = { ...state };
  delete next[monsterId];
  return next;
}

export function replaceLootPrefsForMonster(
  state: LootPrefsState,
  monsterId: string,
  prefs: Record<string, LootAction>
): LootPrefsState {
  const next = { ...state };
  if (Object.keys(prefs).length > 0) next[monsterId] = prefs;
  else delete next[monsterId];
  return LootPrefsStateSchema.parse(next);
}

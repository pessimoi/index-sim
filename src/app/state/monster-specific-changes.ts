import type { LootAction } from "@/domain/trip";
import { DenseCompareUiStateSchema } from "./dense-compare";
import { LootPrefsStateSchema, type LootPrefsState } from "./loot-prefs";
import {
  LootSettingsByMonsterSchema,
  type LootSettingsByMonsterState,
  type MonsterLootSettings
} from "./loot-settings";
import {
  SavedSetupSchema,
  formForMonsterSetup,
  type CannonByMonsterState,
  type CombatSetupFormState,
  type SavedSetupState,
  type SetupMode
} from "./ui-state";
import type { MonsterSpecificChangeKind } from "../view-models/monster-specific-changes";

export type MonsterSpecificStorageAreaId = "rewrite-setup" | "loot-prefs" | "loot-settings";

export interface MonsterSpecificSourceProjection {
  activeMonsterId: string;
  setupMode: SetupMode;
  customSetup: CombatSetupFormState | null;
  cannon: CannonByMonsterState[string] | null;
  lootActions: Readonly<Record<string, LootAction>> | null;
  lootSettings: MonsterLootSettings | null;
  compareHidden: boolean;
}

export interface MonsterSpecificRemovalCandidate {
  id: number;
  monsterId: string;
  monsterName: string;
  kinds: readonly MonsterSpecificChangeKind[];
  sourceProjection: MonsterSpecificSourceProjection;
  selectedAreaIds: readonly MonsterSpecificStorageAreaId[];
}

export interface MonsterSpecificLiveState {
  setup: SavedSetupState;
  lootPrefs: LootPrefsState;
  lootSettings: LootSettingsByMonsterState;
}

export type MonsterSpecificRemovalOutcome =
  | {
      status: "ready";
      candidate: MonsterSpecificRemovalCandidate;
      prior: MonsterSpecificLiveState;
      next: MonsterSpecificLiveState;
    }
  | { status: "stale"; message: string }
  | { status: "no-op"; message: string };

function canonical(value: unknown): string {
  const normalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (candidate === null || typeof candidate !== "object") return candidate;
    return Object.fromEntries(
      Object.entries(candidate as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)])
    );
  };
  return JSON.stringify(normalize(value));
}

export function projectMonsterSpecificChanges(
  live: MonsterSpecificLiveState,
  monsterId: string
): MonsterSpecificSourceProjection {
  return {
    activeMonsterId: live.setup.form.monsterId,
    setupMode: live.setup.setupMode,
    customSetup: live.setup.customSetupsByMonster[monsterId] ?? null,
    cannon: live.setup.cannonByMonster[monsterId] ?? null,
    lootActions: live.lootPrefs[monsterId] ?? null,
    lootSettings: live.lootSettings[monsterId] ?? null,
    compareHidden: live.setup.denseCompare.irrelevantMonsterIds.includes(monsterId)
  };
}

function kindsForProjection(
  projection: MonsterSpecificSourceProjection
): MonsterSpecificChangeKind[] {
  const kinds: MonsterSpecificChangeKind[] = [];
  if (projection.customSetup) kinds.push("custom-setup");
  if (projection.cannon) kinds.push("cannon");
  if (projection.lootActions && Object.keys(projection.lootActions).length)
    kinds.push("loot-actions");
  if (projection.lootSettings) kinds.push("loot-settings");
  if (projection.compareHidden) kinds.push("compare-hidden");
  return kinds;
}

function selectedAreas(
  kinds: readonly MonsterSpecificChangeKind[]
): MonsterSpecificStorageAreaId[] {
  const areas: MonsterSpecificStorageAreaId[] = [];
  if (
    kinds.some((kind) => kind === "custom-setup" || kind === "cannon" || kind === "compare-hidden")
  ) {
    areas.push("rewrite-setup");
  }
  if (kinds.includes("loot-actions")) areas.push("loot-prefs");
  if (kinds.includes("loot-settings")) areas.push("loot-settings");
  return areas;
}

export function createMonsterSpecificRemovalCandidate(input: {
  id: number;
  monsterId: string;
  monsterName: string;
  live: MonsterSpecificLiveState;
}): MonsterSpecificRemovalCandidate | null {
  const sourceProjection = projectMonsterSpecificChanges(input.live, input.monsterId);
  const kinds = kindsForProjection(sourceProjection);
  if (!kinds.length) return null;
  return {
    id: input.id,
    monsterId: input.monsterId,
    monsterName: input.monsterName,
    kinds,
    sourceProjection,
    selectedAreaIds: selectedAreas(kinds)
  };
}

export function deriveMonsterSpecificRemoval(
  candidate: MonsterSpecificRemovalCandidate,
  live: MonsterSpecificLiveState
): MonsterSpecificRemovalOutcome {
  const latestProjection = projectMonsterSpecificChanges(live, candidate.monsterId);
  const latestKinds = kindsForProjection(latestProjection);
  if (!latestKinds.length) {
    return { status: "no-op", message: `No changes remain for ${candidate.monsterName}` };
  }
  if (canonical(latestProjection) !== canonical(candidate.sourceProjection)) {
    return { status: "stale", message: "Monster changes changed. Review removal again." };
  }

  const customSetupsByMonster = { ...live.setup.customSetupsByMonster };
  const cannonByMonster = { ...live.setup.cannonByMonster };
  delete customSetupsByMonster[candidate.monsterId];
  delete cannonByMonster[candidate.monsterId];
  const denseCompare = DenseCompareUiStateSchema.parse({
    ...live.setup.denseCompare,
    irrelevantMonsterIds: live.setup.denseCompare.irrelevantMonsterIds.filter(
      (id) => id !== candidate.monsterId
    )
  });
  let form = live.setup.form;
  let setupMode = live.setup.setupMode;
  if (form.monsterId === candidate.monsterId && setupMode === "custom") {
    const fallback = formForMonsterSetup(
      live.setup.defaultForm,
      customSetupsByMonster,
      candidate.monsterId
    );
    form = fallback.form;
    setupMode = fallback.setupMode;
  }
  const setup = SavedSetupSchema.parse({
    ...live.setup,
    form,
    setupMode,
    customSetupsByMonster,
    cannonByMonster,
    denseCompare
  });
  const lootPrefs = { ...live.lootPrefs };
  delete lootPrefs[candidate.monsterId];
  const lootSettings = { ...live.lootSettings };
  delete lootSettings[candidate.monsterId];
  return {
    status: "ready",
    candidate,
    prior: live,
    next: {
      setup,
      lootPrefs: LootPrefsStateSchema.parse(lootPrefs),
      lootSettings: LootSettingsByMonsterSchema.parse(lootSettings)
    }
  };
}

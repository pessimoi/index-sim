import type { GameDataSnapshot } from "@/domain/shared";
import type { LootPrefsState } from "../state/loot-prefs";
import {
  DEFAULT_MONSTER_LOOT_SETTINGS,
  type LootSettingsByMonsterState,
  type MonsterLootSettings
} from "../state/loot-settings";
import type { SavedSetupState } from "../state/ui-state";

export const MONSTER_SPECIFIC_CHANGE_KINDS = [
  "custom-setup",
  "cannon",
  "loot-actions",
  "loot-settings",
  "compare-hidden"
] as const;

export type MonsterSpecificChangeKind = (typeof MONSTER_SPECIFIC_CHANGE_KINDS)[number];

export const MONSTER_SPECIFIC_CHANGE_LABELS: Record<MonsterSpecificChangeKind, string> = {
  "custom-setup": "Custom setup",
  cannon: "Cannon",
  "loot-actions": "Loot actions",
  "loot-settings": "Loot settings",
  "compare-hidden": "Compare hidden"
};

export interface MonsterSpecificChangeCategoryViewModel {
  kind: MonsterSpecificChangeKind;
  label: string;
  summary: string;
  reviewActionLabel: string | null;
}

export interface MonsterSpecificChangeRowViewModel {
  monsterId: string;
  monsterName: string;
  monsterLevel: number | null;
  available: boolean;
  activeTarget: boolean;
  categories: readonly MonsterSpecificChangeCategoryViewModel[];
}

export interface MonsterSpecificChangesViewModel {
  monsterCount: number;
  categoryCount: number;
  countsByKind: Readonly<Record<MonsterSpecificChangeKind, number>>;
  rows: readonly MonsterSpecificChangeRowViewModel[];
}

export interface MonsterSpecificChangesInput {
  gameData: GameDataSnapshot;
  setup: SavedSetupState;
  lootPrefs: LootPrefsState;
  lootSettings: LootSettingsByMonsterState;
  activeMonsterId: string;
}

function sentenceCase(value: string): string {
  return value.length ? value[0]!.toUpperCase() + value.slice(1) : value;
}

function cannonSummary(settings: SavedSetupState["cannonByMonster"][string]): string {
  const enabled = settings.enabled ? "Enabled" : "Disabled";
  const targets = settings.targets == null ? "auto targets" : `${settings.targets} targets`;
  const respawn =
    settings.respawnSec == null ? "source respawn" : `${settings.respawnSec} s respawn`;
  return `${enabled}, ${targets}, ${respawn}`;
}

function lootSettingsSummary(settings: MonsterLootSettings): string {
  const facts: string[] = [];
  if (settings.highAlch != null) facts.push(`High alch ${settings.highAlch ? "on" : "off"}`);
  if (settings.overheadSec != null) facts.push(`${settings.overheadSec} s overhead`);
  if (settings.talismanSpot !== DEFAULT_MONSTER_LOOT_SETTINGS.talismanSpot) {
    facts.push(`${sentenceCase(settings.talismanSpot)} talisman spot`);
  }
  return facts.length ? facts.join(", ") : "Saved default values";
}

function category(
  kind: MonsterSpecificChangeKind,
  summary: string,
  available: boolean,
  monsterName: string
): MonsterSpecificChangeCategoryViewModel {
  return {
    kind,
    label: MONSTER_SPECIFIC_CHANGE_LABELS[kind],
    summary,
    reviewActionLabel: available
      ? `Review ${MONSTER_SPECIFIC_CHANGE_LABELS[kind]} for ${monsterName}`
      : null
  };
}

export function createMonsterSpecificChangesViewModel(
  input: MonsterSpecificChangesInput
): MonsterSpecificChangesViewModel {
  const ids = new Set<string>([
    ...Object.keys(input.setup.customSetupsByMonster),
    ...Object.keys(input.setup.cannonByMonster),
    ...Object.keys(input.lootPrefs),
    ...Object.keys(input.lootSettings),
    ...input.setup.denseCompare.irrelevantMonsterIds
  ]);
  const rows: MonsterSpecificChangeRowViewModel[] = [];

  for (const monsterId of ids) {
    const monster = input.gameData.monsters[monsterId];
    const available = monster != null;
    const monsterName = monster?.name ?? "Unavailable monster";
    const categories: MonsterSpecificChangeCategoryViewModel[] = [];
    const customSetup = input.setup.customSetupsByMonster[monsterId];
    const cannon = input.setup.cannonByMonster[monsterId];
    const lootActions = input.lootPrefs[monsterId];
    const lootSettings = input.lootSettings[monsterId];

    if (customSetup) {
      categories.push(
        category(
          "custom-setup",
          `${sentenceCase(customSetup.combatStyle)} combat style`,
          available,
          monsterName
        )
      );
    }
    if (cannon) categories.push(category("cannon", cannonSummary(cannon), available, monsterName));
    if (lootActions && Object.keys(lootActions).length > 0) {
      const count = Object.keys(lootActions).length;
      categories.push(
        category(
          "loot-actions",
          `${count} ${count === 1 ? "drop" : "drops"}`,
          available,
          monsterName
        )
      );
    }
    if (lootSettings) {
      categories.push(
        category("loot-settings", lootSettingsSummary(lootSettings), available, monsterName)
      );
    }
    if (input.setup.denseCompare.irrelevantMonsterIds.includes(monsterId)) {
      categories.push(category("compare-hidden", "Hidden in Compare", available, monsterName));
    }
    if (!categories.length) continue;
    categories.sort(
      (left, right) =>
        MONSTER_SPECIFIC_CHANGE_KINDS.indexOf(left.kind) -
        MONSTER_SPECIFIC_CHANGE_KINDS.indexOf(right.kind)
    );
    rows.push({
      monsterId,
      monsterName,
      monsterLevel: monster?.level ?? null,
      available,
      activeTarget: monsterId === input.activeMonsterId,
      categories
    });
  }

  rows.sort((left, right) => {
    if (left.available !== right.available) return left.available ? -1 : 1;
    if (!left.available) return left.monsterId.localeCompare(right.monsterId);
    return (
      left.monsterName.localeCompare(right.monsterName, undefined, { sensitivity: "base" }) ||
      left.monsterId.localeCompare(right.monsterId)
    );
  });
  const countsByKind = Object.fromEntries(
    MONSTER_SPECIFIC_CHANGE_KINDS.map((kind) => [
      kind,
      rows.filter((row) => row.categories.some((item) => item.kind === kind)).length
    ])
  ) as Record<MonsterSpecificChangeKind, number>;
  return {
    monsterCount: rows.length,
    categoryCount: rows.reduce((total, row) => total + row.categories.length, 0),
    countsByKind,
    rows
  };
}

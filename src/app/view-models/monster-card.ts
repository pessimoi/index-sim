import { simulateCombat } from "@/domain/combat";
import type {
  AttackType,
  CombatSimulationResult,
  CombatStyle,
  EntityId,
  GameDataSnapshot,
  SimulationContext,
  SimulationRequest
} from "@/domain/shared";
import {
  formToSimulationRequest,
  type CombatSetupFormState,
  type SetupMode
} from "../state/ui-state";
import { formatNumber } from "./formatting";
import { signedBonus, styleOptions } from "./loadout";
import {
  createEntityDisplayLabel,
  formatSemanticUnitValue,
  type EntityDisplayLabel
} from "./presentation-language";

type MonsterCardStatKey =
  "combat" | "hitpoints" | "attack" | "strength" | "defence" | "magic" | "attackSpeed";

interface MonsterCardStatViewModel {
  key: MonsterCardStatKey;
  label: string;
  value: number | null;
  displayValue: string;
  accessibleValue: string;
  missing: boolean;
}

type MonsterCardDefenceKey = "stab" | "slash" | "crush" | "range" | "magic";
type MonsterCardDefenceField = "defStab" | "defSlash" | "defCrush" | "defRange" | "defMagic";

interface MonsterCardDefenceRowViewModel {
  key: MonsterCardDefenceKey;
  label: string;
  field: MonsterCardDefenceField;
  value: number | null;
  active: boolean;
  missing: boolean;
}

interface MonsterCardSetupBadgeViewModel {
  mode: SetupMode;
  label: string;
  tone: "default" | "custom";
  hasCustomSetup: boolean;
}

interface MonsterCardNamedSelectionViewModel {
  id: EntityId;
  label: string;
  displayLabel: EntityDisplayLabel;
}

interface MonsterCardSetupOverviewViewModel {
  combatStyle: CombatStyle;
  styleId: EntityId;
  styleLabel: string;
  attackType: AttackType | "ranged" | "magic" | null;
  weapon: MonsterCardNamedSelectionViewModel;
  ammo: MonsterCardNamedSelectionViewModel | null;
  spell: MonsterCardNamedSelectionViewModel | null;
  accuracyBonus: number;
  damageBonus: number;
  attackSpeedSec: number;
  prayerIds: EntityId[];
  boostIds: EntityId[];
  sustained: boolean;
  ring: MonsterCardNamedSelectionViewModel | null;
  summary: string[];
}

export interface MonsterCardViewModel {
  monsterId: EntityId;
  monsterName: string;
  monsterDisplayLabel: EntityDisplayLabel;
  stats: MonsterCardStatViewModel[];
  defenceRows: MonsterCardDefenceRowViewModel[];
  activeDefenceField: MonsterCardDefenceField | null;
  activeDefenceKey: MonsterCardDefenceKey | null;
  setupBadge: MonsterCardSetupBadgeViewModel;
  setupOverview: MonsterCardSetupOverviewViewModel;
}

export interface MonsterCardViewModelOptions {
  setupMode?: SetupMode;
  hasCustomSetup?: boolean;
}

const MONSTER_CARD_DEFENCE_ROWS = [
  { key: "stab", label: "Stab defence", field: "defStab" },
  { key: "slash", label: "Slash defence", field: "defSlash" },
  { key: "crush", label: "Crush defence", field: "defCrush" },
  { key: "range", label: "Ranged defence", field: "defRange" },
  { key: "magic", label: "Magic defence", field: "defMagic" }
] satisfies Array<{
  key: MonsterCardDefenceKey;
  label: string;
  field: MonsterCardDefenceField;
}>;

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function monsterNumber(
  monster: GameDataSnapshot["monsters"][string],
  key: keyof GameDataSnapshot["monsters"][string]
): number | null {
  return nullableNumber(monster[key]);
}

function namedSelection(
  id: EntityId | undefined,
  label: string | undefined
): MonsterCardNamedSelectionViewModel {
  const displayLabel = createEntityDisplayLabel({
    technicalId: id ?? "none",
    gameDataName: label,
    rowSourceName: id === undefined ? "None" : null
  });
  return {
    id: id ?? "none",
    label: displayLabel.name,
    displayLabel
  };
}

function monsterCardSetupBadge(
  options: MonsterCardViewModelOptions = {}
): MonsterCardSetupBadgeViewModel {
  const mode = options.setupMode ?? "default";
  const hasCustomSetup = options.hasCustomSetup ?? mode === "custom";
  if (mode === "custom") {
    return { mode, label: "Custom setup", tone: "custom", hasCustomSetup };
  }
  return {
    mode,
    label: hasCustomSetup ? "Default setup (custom saved)" : "Default setup",
    tone: "default",
    hasCustomSetup
  };
}

function activeMonsterDefenceField(value: string): MonsterCardDefenceField | null {
  return MONSTER_CARD_DEFENCE_ROWS.some((row) => row.field === value)
    ? (value as MonsterCardDefenceField)
    : null;
}

function createMonsterCardStats(
  monster: GameDataSnapshot["monsters"][string]
): MonsterCardStatViewModel[] {
  const rows = [
    { key: "combat", label: "Combat", value: monsterNumber(monster, "level") },
    { key: "hitpoints", label: "HP", value: monsterNumber(monster, "hp") },
    { key: "attack", label: "Attack", value: monsterNumber(monster, "attack") },
    { key: "strength", label: "Strength", value: monsterNumber(monster, "strength") },
    { key: "defence", label: "Defence", value: monsterNumber(monster, "defLevel") },
    { key: "magic", label: "Magic", value: monsterNumber(monster, "magicLevel") },
    { key: "attackSpeed", label: "Attack speed", value: monsterNumber(monster, "attackSpeed") }
  ] satisfies Array<Omit<MonsterCardStatViewModel, "missing" | "displayValue" | "accessibleValue">>;

  return rows.map((row) => {
    if (row.key === "attackSpeed" && row.value !== null) {
      const speed = formatSemanticUnitValue(formatNumber(row.value), row.value, "tick");
      return {
        ...row,
        displayValue: speed.visible,
        accessibleValue: speed.accessible,
        missing: false
      };
    }
    return {
      ...row,
      displayValue: row.value === null ? "-" : formatNumber(row.value),
      accessibleValue: row.value === null ? "-" : formatNumber(row.value),
      missing: row.value == null
    };
  });
}

function createMonsterCardDefenceRows(
  monster: GameDataSnapshot["monsters"][string],
  activeField: MonsterCardDefenceField | null
): MonsterCardDefenceRowViewModel[] {
  return MONSTER_CARD_DEFENCE_ROWS.map((row) => {
    const value = monsterNumber(monster, row.field);
    return {
      ...row,
      value,
      active: row.field === activeField,
      missing: value == null
    };
  });
}

function styleLabelForRequest(request: SimulationRequest, gameData: GameDataSnapshot): string {
  return (
    styleOptions(gameData, request.combatStyle, request.loadout.weaponId).find(
      (option) => option.id === request.styleId
    )?.label ?? request.styleId
  );
}

function createMonsterCardSetupOverview(
  request: SimulationRequest,
  context: SimulationContext,
  combat: CombatSimulationResult
): MonsterCardSetupOverviewViewModel {
  const gameData = context.gameData;
  const weaponId = request.loadout.weaponId;
  const weapon = gameData.weapons[weaponId];
  const ammoId = request.loadout.ammoId;
  const ammo =
    request.combatStyle === "ranged" && ammoId && ammoId !== "none"
      ? namedSelection(ammoId, gameData.ammo[ammoId]?.name)
      : null;
  const spell =
    request.combatStyle === "magic" && request.spellId
      ? namedSelection(request.spellId, gameData.spells[request.spellId]?.name)
      : null;
  const ringId = request.loadout.gear.ring;
  const ring =
    ringId && ringId !== "none"
      ? namedSelection(ringId, gameData.equipment.ring?.[ringId]?.name)
      : null;
  const attackType =
    request.combatStyle === "melee"
      ? (combat.debug.attackType ?? null)
      : request.combatStyle === "ranged"
        ? "ranged"
        : "magic";
  const styleLabel = styleLabelForRequest(request, gameData);
  const summary = [
    `Weapon: ${weapon?.name ?? weaponId}`,
    ammo ? `Ammo: ${ammo.label}` : null,
    spell ? `Spell: ${spell.label}` : null,
    `Style: ${styleLabel}`,
    `ACC ${signedBonus(combat.debug.accuracyBonus)}`,
    `DMG ${signedBonus(combat.debug.damageBonus)}`,
    `Speed ${formatNumber(combat.attackSpeedSec, 1)} s`
  ].filter((item): item is string => item != null);

  return {
    combatStyle: request.combatStyle,
    styleId: request.styleId,
    styleLabel,
    attackType,
    weapon: namedSelection(weaponId, weapon?.name),
    ammo,
    spell,
    accuracyBonus: combat.debug.accuracyBonus,
    damageBonus: combat.debug.damageBonus,
    attackSpeedSec: combat.attackSpeedSec,
    prayerIds: [...request.prayers.keys],
    boostIds: [...request.boosts.keys],
    sustained: !!request.sustained,
    ring,
    summary
  };
}

export function createMonsterCardViewModelFromCombat(
  request: SimulationRequest,
  context: SimulationContext,
  combat: CombatSimulationResult,
  options: MonsterCardViewModelOptions = {}
): MonsterCardViewModel {
  const monster = context.gameData.monsters[request.monsterId];
  if (!monster) throw new Error(`Unknown monster id: ${request.monsterId}`);

  const activeField = activeMonsterDefenceField(combat.debug.defenceField);
  const defenceRows = createMonsterCardDefenceRows(monster, activeField);
  const activeDefenceKey = defenceRows.find((row) => row.active)?.key ?? null;

  const monsterDisplayLabel = createEntityDisplayLabel({
    technicalId: monster.id,
    gameDataName: monster.name
  });
  return {
    monsterId: monster.id,
    monsterName: monsterDisplayLabel.name,
    monsterDisplayLabel,
    stats: createMonsterCardStats(monster),
    defenceRows,
    activeDefenceField: activeField,
    activeDefenceKey,
    setupBadge: monsterCardSetupBadge(options),
    setupOverview: createMonsterCardSetupOverview(request, context, combat)
  };
}

export function createMonsterCardViewModel(
  form: CombatSetupFormState,
  context: SimulationContext,
  options: MonsterCardViewModelOptions = {}
): MonsterCardViewModel {
  const request = formToSimulationRequest(form, context.gameData);
  const combat = simulateCombat(request, context);
  return createMonsterCardViewModelFromCombat(request, context, combat, options);
}

export function monsterOptions(gameData: GameDataSnapshot) {
  return Object.values(gameData.monsters)
    .map((monster) => ({ id: monster.id, label: monster.name }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

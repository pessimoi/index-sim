import { EQUIPMENT_SLOTS } from "@/domain/shared";
import type { CombatStyle, EquipmentSlot, EntityId, SimulationContext } from "@/domain/shared";
import { FOOD, type LootAction } from "@/domain/trip";
import { DEFAULT_DENSE_COMPARE_SORT_STATE } from "../state/dense-compare";
import {
  DUEL_SNAPSHOTS_VERSION,
  DuelSnapshotsImportError,
  MAX_DUEL_SNAPSHOTS,
  duelSnapshotNameOccurrences,
  normalizeDuelSnapshotsState,
  type DuelSnapshotsState
} from "../state/duel-snapshots";
import {
  savedSetupMergePlanIsFresh,
  type SavedSetupMergeClassification,
  type SavedSetupMergeDecision,
  type SavedSetupMergeNameStatus,
  type SavedSetupMergePlan
} from "../state/saved-setup-merge";
import type { LootSettingsByMonsterState } from "../state/loot-settings";
import {
  BOOST_SELECTION_OPTIONS,
  PRAYER_SELECTION_OPTIONS,
  normalizeFormState,
  type CannonByMonsterState,
  type CombatSetupFormState
} from "../state/ui-state";
import { createDenseCompareRows } from "./compare";
import { SETUP_REQUIREMENT_SLOT_LABELS } from "./loadout";
import { createSimulationViewModel, type SimulationViewModel } from "./simulation";
import type { InlineNoticeViewModel } from "./contracts";

export type DuelComparisonRowSource = "live" | "snapshot";
export type DuelViewMode = "current-target" | "monster-matrix";

export function defaultDuelSnapshotName(
  viewModel: SimulationViewModel,
  snapshotCount: number
): string {
  const setup = viewModel.monsterCard.setupOverview;
  if (setup.combatStyle === "magic" && setup.spell) return setup.spell.label;
  if (setup.combatStyle === "ranged" && setup.ammo) return setup.ammo.label;
  return setup.weapon.label || `Setup ${snapshotCount + 1}`;
}

export function describeDuelSnapshotsImportError(error: unknown): InlineNoticeViewModel {
  const code =
    error instanceof DuelSnapshotsImportError
      ? error.code
      : error instanceof Error && /^File exceeds \d+ bytes$/.test(error.message)
        ? "body_too_large"
        : null;

  if (code === "body_too_large") {
    return {
      tone: "error",
      message: "Saved setup import failed: choose an exported setup file under 250 KB."
    };
  }
  if (code === "invalid_json") {
    return { tone: "error", message: "Saved setup import failed: the file is not valid JSON." };
  }
  if (code === "duplicate_keys" || code === "duplicate_ids") {
    return {
      tone: "error",
      message: "Saved setup import failed: the export contains duplicate setup data."
    };
  }
  if (code === "incompatible_entities") {
    return {
      tone: "error",
      message: "Saved setup import failed: a setup references unavailable game data."
    };
  }
  if (code === "unsupported_version") {
    return {
      tone: "error",
      message: `Saved setup import failed: this app only supports setup file version ${DUEL_SNAPSHOTS_VERSION}.`
    };
  }
  return {
    tone: "error",
    message: "Saved setup import failed: the file is not a valid setup export."
  };
}

export interface DuelComparisonRowDeltasViewModel {
  maxHit: number;
  dps: number;
  hitChance: number;
  ttkSec: number;
  killsPerTrip: number;
  killsPerHour: number;
  effectiveXpPerHour: number;
  effectiveNetGpPerHour: number;
  gpPerXp: number | null;
  supplyCostPerHour: number;
}

export type DuelSetupDiffCategoryId =
  "combat" | "levels" | "loadout" | "gear" | "prayers-boosts" | "special-overrides" | "trip";

export interface DuelSetupDiffItemViewModel {
  id: string;
  label: string;
  liveValue: string;
  snapshotValue: string;
}

export interface DuelSetupDiffGroupViewModel {
  id: DuelSetupDiffCategoryId;
  label: string;
  items: DuelSetupDiffItemViewModel[];
}

export interface DuelSetupDiffViewModel {
  changeCount: number;
  groups: DuelSetupDiffGroupViewModel[];
  sharedContextNote: string;
}

export interface DuelComparisonBestMarkersViewModel {
  effectiveXpPerHour: boolean;
  effectiveNetGpPerHour: boolean;
  gpPerXp: boolean;
}

export interface DuelComparisonRowViewModel {
  id: string;
  snapshotId: EntityId | null;
  source: DuelComparisonRowSource;
  name: string;
  displayName: string;
  duplicateName: boolean;
  monsterId: EntityId;
  monsterName: string;
  combatStyle: CombatStyle;
  loadoutLabel: string;
  maxHit: number;
  dps: number;
  hitChance: number;
  ttkSec: number;
  killsPerTrip: number;
  killsPerHour: number;
  effectiveXpPerHour: number;
  effectiveNetGpPerHour: number;
  gpPerXp: number | null;
  supplyCostPerHour: number;
  bound: string;
  warnings: string[];
  setupDiff: DuelSetupDiffViewModel | null;
  deltas: DuelComparisonRowDeltasViewModel;
  best: DuelComparisonBestMarkersViewModel;
}

export interface DuelComparisonViewModel {
  monsterId: EntityId;
  monsterName: string;
  snapshotCount: number;
  snapshotLimit: number;
  liveRow: DuelComparisonRowViewModel;
  snapshotRows: DuelComparisonRowViewModel[];
  rows: DuelComparisonRowViewModel[];
}

export type DuelComparisonSortKey =
  | "setup"
  | "loadout"
  | "maxHit"
  | "dps"
  | "effectiveXpPerHour"
  | "effectiveNetGpPerHour"
  | "gpPerXp"
  | "killsPerHour";

export interface DuelComparisonSortState {
  key: DuelComparisonSortKey | null;
  direction: "asc" | "desc";
}

export const DEFAULT_DUEL_COMPARISON_SORT_STATE: DuelComparisonSortState = {
  key: null,
  direction: "asc"
};

export type DuelMatrixMetricId = "dps" | "effectiveXpPerHour" | "effectiveNetGpPerHour" | "gpPerXp";

export interface DuelMatrixMetricValuesViewModel {
  dps: number | null;
  effectiveXpPerHour: number | null;
  effectiveNetGpPerHour: number | null;
  gpPerXp: number | null;
}

export interface DuelMatrixCellViewModel {
  setupId: string;
  values: DuelMatrixMetricValuesViewModel;
  best: Record<DuelMatrixMetricId, boolean>;
}

export interface DuelMatrixSetupViewModel {
  id: string;
  snapshotId: EntityId | null;
  source: DuelComparisonRowSource;
  name: string;
  displayName: string;
  combatStyle: CombatStyle;
  loadoutLabel: string;
}

export interface DuelMatrixRowViewModel {
  monsterId: EntityId;
  monsterName: string;
  monsterLevel: number | null;
  isCurrentTarget: boolean;
  cells: DuelMatrixCellViewModel[];
}

export interface DuelMatrixViewModel {
  currentMonsterId: EntityId;
  monsterCount: number;
  setupCount: number;
  cellCount: number;
  setups: DuelMatrixSetupViewModel[];
  rows: DuelMatrixRowViewModel[];
}

export type DuelMatrixSortTarget = { kind: "monster" } | { kind: "setup"; setupId: string };

export interface DuelMatrixSortState {
  target: DuelMatrixSortTarget | null;
  direction: "asc" | "desc";
}

export const DEFAULT_DUEL_MATRIX_SORT_STATE: DuelMatrixSortState = {
  target: null,
  direction: "asc"
};

export function nextDuelComparisonSortState(
  current: DuelComparisonSortState,
  key: DuelComparisonSortKey
): DuelComparisonSortState {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return {
    key,
    direction: key === "setup" || key === "loadout" ? "asc" : "desc"
  };
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: "asc" | "desc"
): number {
  const leftMissing = left === null || !Number.isFinite(left);
  const rightMissing = right === null || !Number.isFinite(right);
  if (leftMissing || rightMissing) {
    if (leftMissing && rightMissing) return 0;
    return leftMissing ? 1 : -1;
  }
  return (left - right) * (direction === "asc" ? 1 : -1);
}

function compareDuelText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function sortDuelComparisonRows(
  rows: readonly DuelComparisonRowViewModel[],
  sort: DuelComparisonSortState
): DuelComparisonRowViewModel[] {
  if (sort.key === null) return [...rows];
  const key = sort.key;
  const direction = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      let compared: number;
      if (key === "setup" || key === "loadout") {
        const leftValue =
          key === "setup"
            ? left.row.source === "live"
              ? "Live setup"
              : left.row.name
            : left.row.loadoutLabel;
        const rightValue =
          key === "setup"
            ? right.row.source === "live"
              ? "Live setup"
              : right.row.name
            : right.row.loadoutLabel;
        compared = compareDuelText(leftValue, rightValue) * direction;
      } else {
        const numericValues: Record<
          Exclude<DuelComparisonSortKey, "setup" | "loadout">,
          (row: DuelComparisonRowViewModel) => number | null
        > = {
          maxHit: (row) => row.maxHit,
          dps: (row) => row.dps,
          effectiveXpPerHour: (row) => row.effectiveXpPerHour,
          effectiveNetGpPerHour: (row) => row.effectiveNetGpPerHour,
          gpPerXp: (row) => row.gpPerXp,
          killsPerHour: (row) => row.killsPerHour
        };
        compared = compareNullableNumbers(
          numericValues[key](left.row),
          numericValues[key](right.row),
          sort.direction
        );
      }
      return compared === 0 ? left.index - right.index : compared;
    })
    .map(({ row }) => row);
}

function sameDuelMatrixTarget(
  left: DuelMatrixSortTarget | null,
  right: DuelMatrixSortTarget
): boolean {
  if (left === null || left.kind !== right.kind) return false;
  if (left.kind === "monster") return true;
  return right.kind === "setup" && left.setupId === right.setupId;
}

export function nextDuelMatrixSortState(
  current: DuelMatrixSortState,
  target: DuelMatrixSortTarget
): DuelMatrixSortState {
  if (sameDuelMatrixTarget(current.target, target)) {
    return { target, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { target, direction: target.kind === "monster" ? "asc" : "desc" };
}

export function sortDuelMatrixRows(
  rows: readonly DuelMatrixRowViewModel[],
  sort: DuelMatrixSortState,
  metric: DuelMatrixMetricId
): DuelMatrixRowViewModel[] {
  if (sort.target === null) return [...rows];
  const target = sort.target;
  const direction = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const compared =
        target.kind === "monster"
          ? compareDuelText(left.row.monsterName, right.row.monsterName) * direction
          : compareNullableNumbers(
              left.row.cells.find((cell) => cell.setupId === target.setupId)?.values[metric] ??
                null,
              right.row.cells.find((cell) => cell.setupId === target.setupId)?.values[metric] ??
                null,
              sort.direction
            );
      return compared === 0 ? left.index - right.index : compared;
    })
    .map(({ row }) => row);
}

type DuelComparisonBaseRowViewModel = Omit<
  DuelComparisonRowViewModel,
  "deltas" | "best" | "setupDiff"
>;

function gpPerXpValue(effectiveNetGpPerHour: number, effectiveXpPerHour: number): number | null {
  return effectiveXpPerHour > 0 ? effectiveNetGpPerHour / effectiveXpPerHour : null;
}

function duelLoadoutLabel(vm: SimulationViewModel): string {
  const overview = vm.monsterCard.setupOverview;
  const parts = [overview.combatStyle, overview.weapon.label];
  if (overview.ammo) parts.push(overview.ammo.label);
  if (overview.spell) parts.push(overview.spell.label);
  if (overview.prayerIds.length > 0) {
    parts.push(`${overview.prayerIds.length} prayer${overview.prayerIds.length === 1 ? "" : "s"}`);
  }
  if (overview.boostIds.length > 0) {
    parts.push(`${overview.boostIds.length} boost${overview.boostIds.length === 1 ? "" : "s"}`);
  }
  if (overview.sustained) parts.push("sustained");
  return parts.join(" · ");
}

function duelBaseRowFromSimulation(
  id: string,
  source: DuelComparisonRowSource,
  snapshotId: EntityId | null,
  name: string,
  vm: SimulationViewModel
): DuelComparisonBaseRowViewModel {
  const result = vm.result;
  return {
    id,
    snapshotId,
    source,
    name,
    displayName: name,
    duplicateName: false,
    monsterId: result.request.monsterId,
    monsterName: vm.monsterCard.monsterName,
    combatStyle: result.request.combatStyle,
    loadoutLabel: duelLoadoutLabel(vm),
    maxHit: result.combat.maxHit,
    dps: result.rates.effectiveDps,
    hitChance: result.combat.hitChance,
    ttkSec: result.rates.ttkSec,
    killsPerTrip: result.trip.trip.killsPerTrip,
    killsPerHour: result.rates.killsPerHour,
    effectiveXpPerHour: result.xp.effectiveXpPerHour,
    effectiveNetGpPerHour: result.rates.effectiveNetGpPerHour,
    gpPerXp: gpPerXpValue(result.rates.effectiveNetGpPerHour, result.xp.effectiveXpPerHour),
    supplyCostPerHour: result.rates.supplyCostPerKill * result.rates.effectiveKph,
    bound: result.trip.trip.bound,
    warnings: vm.warnings
  };
}

const DUEL_DIFF_CATEGORY_LABELS: Record<DuelSetupDiffCategoryId, string> = {
  combat: "Combat",
  levels: "Levels",
  loadout: "Loadout",
  gear: "Gear",
  "prayers-boosts": "Prayers and boosts",
  "special-overrides": "Special and overrides",
  trip: "Trip"
};

const DUEL_LEVEL_LABELS: Record<keyof CombatSetupFormState["levels"], string> = {
  attack: "Attack",
  strength: "Strength",
  defence: "Defence",
  hitpoints: "Hitpoints",
  ranged: "Ranged",
  magic: "Magic",
  prayer: "Prayer"
};

const DUEL_TRIP_LABELS: Record<keyof CombatSetupFormState["trip"], string> = {
  foodKey: "Food",
  teleport: "Teleport",
  bankSeconds: "Bank time",
  potionSets: "Boost vials",
  potionDoses: "Boost doses",
  singleDose: "Single-dose boosts",
  dbaRestore: "DBA restore",
  prayerMode: "Prayer restore",
  alching: "High alch",
  recoverAmmo: "Recover ammo",
  runeSlots: "Rune slots",
  antifire: "Antifire",
  antipoison: "Antipoison",
  safespot: "Safespot",
  protect: "Protection prayer",
  recoilRings: "Recoil rings",
  foodCount: "Food count",
  foodPerKillOverride: "Food per kill",
  prayerPotionSets: "Prayer potion vials",
  prayerPotionDoses: "Prayer potion doses",
  altarSeconds: "Altar time",
  scarceSpot: "Scarce spot",
  targetsAtSpot: "Targets at spot",
  respawnSeconds: "Respawn time"
};

function duelHumanizeId(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function duelBooleanLabel(value: boolean): string {
  return value ? "On" : "Off";
}

function duelOptionalValue(value: string | number | boolean | null): string {
  if (value == null) return "Auto";
  if (typeof value === "boolean") return duelBooleanLabel(value);
  return String(value);
}

function duelSelectionLabel(
  values: readonly string[],
  options: ReadonlyArray<{ id: string; label: string }>
): string {
  const labels = values
    .filter((value) => value !== "none")
    .map((value) => options.find((option) => option.id === value)?.label ?? duelHumanizeId(value));
  return labels.length > 0 ? labels.join(", ") : "None";
}

function duelItemLabel(
  context: SimulationContext,
  kind: "weapon" | "ammo" | "spell",
  itemId: EntityId
): string {
  if (itemId === "none") return "None";
  if (kind === "weapon") return context.gameData.weapons[itemId]?.name ?? duelHumanizeId(itemId);
  if (kind === "ammo") return context.gameData.ammo[itemId]?.name ?? duelHumanizeId(itemId);
  return context.gameData.spells[itemId]?.name ?? duelHumanizeId(itemId);
}

function duelGearLabel(context: SimulationContext, slot: EquipmentSlot, itemId: EntityId): string {
  if (itemId === "none") return "None";
  return context.gameData.equipment[slot]?.[itemId]?.name ?? duelHumanizeId(itemId);
}

export function createDuelSetupDiffViewModel(
  liveForm: CombatSetupFormState,
  snapshotForm: CombatSetupFormState,
  context: SimulationContext
): DuelSetupDiffViewModel {
  const groups = new Map<DuelSetupDiffCategoryId, DuelSetupDiffItemViewModel[]>();
  const add = (
    category: DuelSetupDiffCategoryId,
    id: string,
    label: string,
    liveRaw: unknown,
    snapshotRaw: unknown,
    liveValue = duelOptionalValue(liveRaw as string | number | boolean | null),
    snapshotValue = duelOptionalValue(snapshotRaw as string | number | boolean | null)
  ) => {
    if (JSON.stringify(liveRaw) === JSON.stringify(snapshotRaw)) return;
    const items = groups.get(category) ?? [];
    items.push({ id, label, liveValue, snapshotValue });
    groups.set(category, items);
  };

  add(
    "combat",
    "combat-style",
    "Combat style",
    liveForm.combatStyle,
    snapshotForm.combatStyle,
    duelHumanizeId(liveForm.combatStyle),
    duelHumanizeId(snapshotForm.combatStyle)
  );
  add(
    "combat",
    "attack-style",
    "Attack style",
    liveForm.styleId,
    snapshotForm.styleId,
    duelHumanizeId(liveForm.styleId),
    duelHumanizeId(snapshotForm.styleId)
  );

  for (const skill of Object.keys(DUEL_LEVEL_LABELS) as Array<keyof typeof DUEL_LEVEL_LABELS>) {
    add(
      "levels",
      `level-${skill}`,
      DUEL_LEVEL_LABELS[skill],
      liveForm.levels[skill],
      snapshotForm.levels[skill]
    );
  }

  add(
    "loadout",
    "weapon",
    "Weapon",
    liveForm.weaponId,
    snapshotForm.weaponId,
    duelItemLabel(context, "weapon", liveForm.weaponId),
    duelItemLabel(context, "weapon", snapshotForm.weaponId)
  );
  if (liveForm.combatStyle === "ranged" || snapshotForm.combatStyle === "ranged") {
    add(
      "loadout",
      "ammo",
      "Ammo",
      liveForm.ammoId,
      snapshotForm.ammoId,
      duelItemLabel(context, "ammo", liveForm.ammoId),
      duelItemLabel(context, "ammo", snapshotForm.ammoId)
    );
  }
  if (liveForm.combatStyle === "magic" || snapshotForm.combatStyle === "magic") {
    add(
      "loadout",
      "spell",
      "Spell",
      liveForm.spellId,
      snapshotForm.spellId,
      duelItemLabel(context, "spell", liveForm.spellId),
      duelItemLabel(context, "spell", snapshotForm.spellId)
    );
  }

  for (const slot of EQUIPMENT_SLOTS) {
    const liveItem = liveForm.gear[slot] ?? "none";
    const snapshotItem = snapshotForm.gear[slot] ?? "none";
    add(
      "gear",
      `gear-${slot}`,
      SETUP_REQUIREMENT_SLOT_LABELS[slot],
      liveItem,
      snapshotItem,
      duelGearLabel(context, slot, liveItem),
      duelGearLabel(context, slot, snapshotItem)
    );
  }

  add(
    "prayers-boosts",
    "prayers",
    "Prayers",
    liveForm.prayers,
    snapshotForm.prayers,
    duelSelectionLabel(liveForm.prayers, PRAYER_SELECTION_OPTIONS),
    duelSelectionLabel(snapshotForm.prayers, PRAYER_SELECTION_OPTIONS)
  );
  add(
    "prayers-boosts",
    "boosts",
    "Boosts",
    liveForm.boosts,
    snapshotForm.boosts,
    duelSelectionLabel(liveForm.boosts, BOOST_SELECTION_OPTIONS),
    duelSelectionLabel(snapshotForm.boosts, BOOST_SELECTION_OPTIONS)
  );
  add(
    "prayers-boosts",
    "sustained",
    "Sustained boosts",
    liveForm.sustained,
    snapshotForm.sustained
  );
  add(
    "prayers-boosts",
    "repot-threshold",
    "Repot threshold",
    liveForm.repotThreshold,
    snapshotForm.repotThreshold
  );

  add(
    "special-overrides",
    "special-weapon",
    "Special weapon",
    liveForm.specialAttack.weaponId,
    snapshotForm.specialAttack.weaponId,
    duelItemLabel(context, "weapon", liveForm.specialAttack.weaponId),
    duelItemLabel(context, "weapon", snapshotForm.specialAttack.weaponId)
  );
  add(
    "special-overrides",
    "special-ammo",
    "Special ammo",
    liveForm.specialAttack.ammoId,
    snapshotForm.specialAttack.ammoId,
    duelItemLabel(context, "ammo", liveForm.specialAttack.ammoId),
    duelItemLabel(context, "ammo", snapshotForm.specialAttack.ammoId)
  );
  add(
    "special-overrides",
    "accuracy-override",
    "Accuracy override",
    liveForm.manualOverrides.accuracyBonus,
    snapshotForm.manualOverrides.accuracyBonus
  );
  add(
    "special-overrides",
    "damage-override",
    "Damage override",
    liveForm.manualOverrides.damageBonus,
    snapshotForm.manualOverrides.damageBonus
  );
  add(
    "special-overrides",
    "speed-override",
    "Attack speed override",
    liveForm.manualOverrides.attackSpeedSec,
    snapshotForm.manualOverrides.attackSpeedSec
  );
  add(
    "special-overrides",
    "ring-of-wealth",
    "Ring of wealth",
    liveForm.ringOfWealth,
    snapshotForm.ringOfWealth
  );

  for (const key of Object.keys(DUEL_TRIP_LABELS) as Array<keyof typeof DUEL_TRIP_LABELS>) {
    const liveRaw = liveForm.trip[key];
    const snapshotRaw = snapshotForm.trip[key];
    let liveValue = duelOptionalValue(liveRaw);
    let snapshotValue = duelOptionalValue(snapshotRaw);
    if (key === "foodKey") {
      liveValue = FOOD[String(liveRaw)]?.name ?? duelHumanizeId(String(liveRaw));
      snapshotValue = FOOD[String(snapshotRaw)]?.name ?? duelHumanizeId(String(snapshotRaw));
    } else if (key === "protect" || key === "prayerMode") {
      liveValue = duelHumanizeId(String(liveRaw));
      snapshotValue = duelHumanizeId(String(snapshotRaw));
    }
    add(
      "trip",
      `trip-${key}`,
      DUEL_TRIP_LABELS[key],
      liveRaw,
      snapshotRaw,
      liveValue,
      snapshotValue
    );
  }

  const orderedGroups = (Object.keys(DUEL_DIFF_CATEGORY_LABELS) as DuelSetupDiffCategoryId[])
    .map((id) => ({ id, label: DUEL_DIFF_CATEGORY_LABELS[id], items: groups.get(id) ?? [] }))
    .filter((group) => group.items.length > 0);
  return {
    changeCount: orderedGroups.reduce((total, group) => total + group.items.length, 0),
    groups: orderedGroups,
    sharedContextNote:
      "Both setups are recalculated against the current target, cannon, loot policy and active prices. These shared inputs are not snapshot differences."
  };
}

export interface SavedSetupMergeReviewRowViewModel {
  snapshotId: string;
  sourceName: string;
  sourceDisplayName: string;
  currentName: string | null;
  currentDisplayName: string | null;
  classification: SavedSetupMergeClassification;
  classificationLabel: string;
  decision: SavedSetupMergeDecision;
  recipientName: string;
  nameStatus: SavedSetupMergeNameStatus;
  nameMessage: string | null;
  setupDiff: DuelSetupDiffViewModel | null;
}

export interface SavedSetupMergeReviewViewModel {
  id: number;
  stale: boolean;
  canMerge: boolean;
  setupCount: number;
  selectedAddCount: number;
  selectedReplaceCount: number;
  keepCount: number;
  identicalCount: number;
  notSelectedCount: number;
  availableSlots: number;
  rows: SavedSetupMergeReviewRowViewModel[];
}

const SAVED_SETUP_CLASSIFICATION_LABELS: Record<SavedSetupMergeClassification, string> = {
  unchanged: "Identical",
  "replacement-candidate": "Matching ID",
  "addition-candidate": "New setup",
  "capacity-excluded": "Not selected at limit"
};

function savedSetupOccurrenceDisplayName(
  name: string,
  snapshotId: string,
  occurrences: ReturnType<typeof duelSnapshotNameOccurrences>
): string {
  const occurrence = occurrences.get(snapshotId);
  return occurrence && occurrence.count > 1
    ? `${name} (${occurrence.ordinal} of ${occurrence.count})`
    : name;
}

function savedSetupNameMessage(status: SavedSetupMergeNameStatus): string | null {
  if (status === "conflict") return "Choose a unique name before merging this setup.";
  if (status === "invalid") return "Enter a name between 1 and 80 characters.";
  return null;
}

export function createSavedSetupMergeReviewViewModel(input: {
  plan: SavedSetupMergePlan;
  current: DuelSnapshotsState;
  context: SimulationContext;
}): SavedSetupMergeReviewViewModel {
  const sourceOccurrences = duelSnapshotNameOccurrences(input.plan.source);
  const currentOccurrences = duelSnapshotNameOccurrences(input.plan.current);
  return {
    id: input.plan.reviewId,
    stale: !savedSetupMergePlanIsFresh(input.plan, input.current),
    canMerge: input.plan.canMerge,
    setupCount: input.plan.counts.setupCount,
    selectedAddCount: input.plan.counts.selectedAddCount,
    selectedReplaceCount: input.plan.counts.selectedReplaceCount,
    keepCount: input.plan.counts.keepCount,
    identicalCount: input.plan.counts.identicalCount,
    notSelectedCount: input.plan.counts.notSelectedCount,
    availableSlots: input.plan.counts.availableSlots,
    rows: input.plan.rows.map((row) => ({
      snapshotId: row.source.id,
      sourceName: row.source.name,
      sourceDisplayName: savedSetupOccurrenceDisplayName(
        row.source.name,
        row.source.id,
        sourceOccurrences
      ),
      currentName: row.current?.name ?? null,
      currentDisplayName: row.current
        ? savedSetupOccurrenceDisplayName(row.current.name, row.current.id, currentOccurrences)
        : null,
      classification: row.classification,
      classificationLabel: SAVED_SETUP_CLASSIFICATION_LABELS[row.classification],
      decision: row.decision,
      recipientName: row.recipientName,
      nameStatus: row.nameStatus,
      nameMessage: savedSetupNameMessage(row.nameStatus),
      setupDiff: row.current
        ? createDuelSetupDiffViewModel(row.current.form, row.source.form, input.context)
        : null
    }))
  };
}

function finiteBest(values: ReadonlyArray<number | null>): number | null {
  const finiteValues = values.filter((value): value is number => value != null && isFinite(value));
  if (!finiteValues.length) return null;
  return Math.max(...finiteValues);
}

function isBestDuelValue(
  value: number | null,
  best: number | null,
  rowCount: number,
  tolerance = 0.000001
): boolean {
  return value != null && best != null && rowCount > 1 && value >= best - tolerance;
}

export function createDuelComparisonViewModel(
  form: CombatSetupFormState,
  duelSnapshots: DuelSnapshotsState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefsByMonster: Record<string, Record<string, LootAction | string | undefined>> = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): DuelComparisonViewModel {
  const currentForm = normalizeFormState(form);
  const currentMonsterId = currentForm.monsterId;
  const currentLootPrefs = lootPrefsByMonster[currentMonsterId] ?? {};
  const normalizedSnapshots = normalizeDuelSnapshotsState(duelSnapshots).snapshots;
  const nameOccurrences = duelSnapshotNameOccurrences({ snapshots: normalizedSnapshots });
  const liveVm = createSimulationViewModel(
    currentForm,
    context,
    cannonByMonster,
    currentLootPrefs,
    lootSettingsByMonster,
    { includeLootRows: false, includeHitDistributionAnalysis: false }
  );
  const liveBaseRow = duelBaseRowFromSimulation("duel-live", "live", null, "Live loadout", liveVm);
  const snapshotEntries = normalizedSnapshots.map((snapshot) => {
    const nameOccurrence = nameOccurrences.get(snapshot.id);
    const snapshotForm = normalizeFormState({
      ...snapshot.form,
      monsterId: currentMonsterId
    });
    const vm = createSimulationViewModel(
      snapshotForm,
      context,
      cannonByMonster,
      currentLootPrefs,
      lootSettingsByMonster,
      { includeLootRows: false, includeHitDistributionAnalysis: false }
    );
    return {
      row: {
        ...duelBaseRowFromSimulation(
          `duel-snapshot:${snapshot.id}`,
          "snapshot",
          snapshot.id,
          snapshot.name,
          vm
        ),
        displayName: savedSetupOccurrenceDisplayName(snapshot.name, snapshot.id, nameOccurrences),
        duplicateName: (nameOccurrence?.count ?? 0) > 1
      },
      setupDiff: createDuelSetupDiffViewModel(currentForm, snapshotForm, context)
    };
  });
  const snapshotBaseRows = snapshotEntries.map((entry) => entry.row);
  const baseRows = [liveBaseRow, ...snapshotBaseRows];
  const bestEffectiveXpPerHour = finiteBest(baseRows.map((row) => row.effectiveXpPerHour));
  const bestEffectiveNetGpPerHour = finiteBest(baseRows.map((row) => row.effectiveNetGpPerHour));
  const bestGpPerXp = finiteBest(baseRows.map((row) => row.gpPerXp));
  const rows = baseRows.map((row, index) => ({
    ...row,
    setupDiff: index === 0 ? null : snapshotEntries[index - 1]!.setupDiff,
    deltas: {
      maxHit: row.maxHit - liveBaseRow.maxHit,
      dps: row.dps - liveBaseRow.dps,
      hitChance: row.hitChance - liveBaseRow.hitChance,
      ttkSec: row.ttkSec - liveBaseRow.ttkSec,
      killsPerTrip: row.killsPerTrip - liveBaseRow.killsPerTrip,
      killsPerHour: row.killsPerHour - liveBaseRow.killsPerHour,
      effectiveXpPerHour: row.effectiveXpPerHour - liveBaseRow.effectiveXpPerHour,
      effectiveNetGpPerHour: row.effectiveNetGpPerHour - liveBaseRow.effectiveNetGpPerHour,
      gpPerXp:
        row.gpPerXp != null && liveBaseRow.gpPerXp != null
          ? row.gpPerXp - liveBaseRow.gpPerXp
          : null,
      supplyCostPerHour: row.supplyCostPerHour - liveBaseRow.supplyCostPerHour
    },
    best: {
      effectiveXpPerHour: isBestDuelValue(
        row.effectiveXpPerHour,
        bestEffectiveXpPerHour,
        baseRows.length,
        0.5
      ),
      effectiveNetGpPerHour: isBestDuelValue(
        row.effectiveNetGpPerHour,
        bestEffectiveNetGpPerHour,
        baseRows.length,
        0.5
      ),
      gpPerXp: isBestDuelValue(row.gpPerXp, bestGpPerXp, baseRows.length)
    }
  }));
  const [liveRow, ...snapshotRows] = rows;

  return {
    monsterId: currentMonsterId,
    monsterName: liveVm.monsterCard.monsterName,
    snapshotCount: normalizedSnapshots.length,
    snapshotLimit: MAX_DUEL_SNAPSHOTS,
    liveRow,
    snapshotRows,
    rows
  };
}

export function createDuelMatrixViewModel(
  form: CombatSetupFormState,
  duelSnapshots: DuelSnapshotsState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefsByMonster: Record<string, Record<string, LootAction | string | undefined>> = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {}
): DuelMatrixViewModel {
  const currentForm = normalizeFormState(form);
  const normalizedSnapshots = normalizeDuelSnapshotsState(duelSnapshots).snapshots;
  const nameOccurrences = duelSnapshotNameOccurrences({ snapshots: normalizedSnapshots });
  const setupDefinitions = [
    {
      id: "duel-live",
      snapshotId: null,
      source: "live" as const,
      name: "Live setup",
      displayName: "Live setup",
      form: currentForm
    },
    ...normalizedSnapshots.map((snapshot) => ({
      id: `duel-snapshot:${snapshot.id}`,
      snapshotId: snapshot.id,
      source: "snapshot" as const,
      name: snapshot.name,
      displayName: savedSetupOccurrenceDisplayName(snapshot.name, snapshot.id, nameOccurrences),
      form: normalizeFormState(snapshot.form)
    }))
  ];
  const setupResults = setupDefinitions.map((setup) => {
    const metadataVm = createSimulationViewModel(
      { ...setup.form, monsterId: currentForm.monsterId },
      context,
      cannonByMonster,
      lootPrefsByMonster[currentForm.monsterId] ?? {},
      lootSettingsByMonster,
      { includeLootRows: false, includeHitDistributionAnalysis: false }
    );
    const rowsByMonster = new Map(
      createDenseCompareRows(
        setup.form,
        context,
        DEFAULT_DENSE_COMPARE_SORT_STATE,
        cannonByMonster,
        lootPrefsByMonster,
        {},
        lootSettingsByMonster
      ).map((row) => [row.monsterId, row])
    );

    return {
      setup: {
        id: setup.id,
        snapshotId: setup.snapshotId,
        source: setup.source,
        name: setup.name,
        displayName: setup.displayName,
        combatStyle: setup.form.combatStyle,
        loadoutLabel: duelLoadoutLabel(metadataVm)
      } satisfies DuelMatrixSetupViewModel,
      rowsByMonster
    };
  });
  const setups = setupResults.map((result) => result.setup);
  const monsters = Object.values(context.gameData.monsters).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  const rows = monsters.map((monster) => {
    const values = setupResults.map((result): DuelMatrixMetricValuesViewModel => {
      const row = result.rowsByMonster.get(monster.id);
      return {
        dps: row?.dps ?? null,
        effectiveXpPerHour: row?.xpPerHour ?? null,
        effectiveNetGpPerHour: row?.netGpPerHour ?? null,
        gpPerXp: row ? gpPerXpValue(row.netGpPerHour, row.xpPerHour) : null
      };
    });
    const best = {
      dps: finiteBest(values.map((value) => value.dps)),
      effectiveXpPerHour: finiteBest(values.map((value) => value.effectiveXpPerHour)),
      effectiveNetGpPerHour: finiteBest(values.map((value) => value.effectiveNetGpPerHour)),
      gpPerXp: finiteBest(values.map((value) => value.gpPerXp))
    };
    const cells = setupResults.map((result, index): DuelMatrixCellViewModel => ({
      setupId: result.setup.id,
      values: values[index]!,
      best: {
        dps: isBestDuelValue(values[index]!.dps, best.dps, setups.length),
        effectiveXpPerHour: isBestDuelValue(
          values[index]!.effectiveXpPerHour,
          best.effectiveXpPerHour,
          setups.length,
          0.5
        ),
        effectiveNetGpPerHour: isBestDuelValue(
          values[index]!.effectiveNetGpPerHour,
          best.effectiveNetGpPerHour,
          setups.length,
          0.5
        ),
        gpPerXp: isBestDuelValue(values[index]!.gpPerXp, best.gpPerXp, setups.length)
      }
    }));

    return {
      monsterId: monster.id,
      monsterName: monster.name,
      monsterLevel: monster.level ?? null,
      isCurrentTarget: monster.id === currentForm.monsterId,
      cells
    };
  });

  return {
    currentMonsterId: currentForm.monsterId,
    monsterCount: rows.length,
    setupCount: setups.length,
    cellCount: rows.length * setups.length,
    setups,
    rows
  };
}

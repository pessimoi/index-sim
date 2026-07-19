import {
  EQUIPMENT_SLOTS,
  type CombatStyle,
  type EntityId,
  type GameDataSnapshot
} from "@/domain/shared";
import { FOOD } from "@/domain/trip";
import {
  BOOST_SELECTION_OPTIONS,
  COMBAT_STYLES,
  DEFAULT_FORM_STATE,
  PRAYER_SELECTION_OPTIONS,
  SavedSetupSchema,
  createDefaultPerStyleLoadouts,
  normalizeFormState,
  savedSetupFromForm,
  setCustomSetupForMonster,
  switchCombatStyleLoadout,
  type CombatSetupFormState,
  type CombatStyleLoadout,
  type SavedSetupState,
  type SetupMode
} from "./ui-state";

export const ACTIVE_SETUP_RESET_NOOP_NOTICE = "Active setup already matches the defaults.";
export const ACTIVE_SETUP_RESET_STALE_NOTICE = "Setup changed. Review the reset again.";

export type ActiveSetupResetOwner = "default" | "current-target-custom";
export type ActiveSetupResetGroupId =
  "levels" | "loadouts" | "prayers-boosts" | "special-overrides" | "trip" | "planner-targets";

export interface ActiveSetupResetChangeViewModel {
  id: string;
  label: string;
  currentValue: string;
  defaultValue: string;
}

export interface ActiveSetupResetSubgroupViewModel {
  id: CombatStyle;
  label: string;
  changes: ActiveSetupResetChangeViewModel[];
}

export interface ActiveSetupResetGroupViewModel {
  id: ActiveSetupResetGroupId;
  label: string;
  changeCount: number;
  changes: ActiveSetupResetChangeViewModel[];
  subgroups: ActiveSetupResetSubgroupViewModel[];
}

export interface ActiveSetupResetReviewViewModel {
  targetLabel: string;
  combatStyleLabel: string;
  ownerLabel: string;
  changeCount: number;
  groups: ActiveSetupResetGroupViewModel[];
}

export interface ActiveSetupResetCandidate {
  id: number;
  source: SavedSetupState;
  setup: SavedSetupState;
  scope: {
    targetId: EntityId;
    combatStyle: CombatStyle;
    setupMode: SetupMode;
    owner: ActiveSetupResetOwner;
    resetStyleCaches: readonly ["melee", "ranged", "magic"];
  };
  review: ActiveSetupResetReviewViewModel;
}

export interface ActiveSetupResetState {
  nextId: number;
  candidate: ActiveSetupResetCandidate | null;
  notice: string | null;
}

export const INITIAL_ACTIVE_SETUP_RESET_STATE: ActiveSetupResetState = {
  nextId: 1,
  candidate: null,
  notice: null
};

export type ActiveSetupResetConsumeOutcome =
  | { status: "accepted"; candidate: ActiveSetupResetCandidate }
  | { status: "stale" }
  | { status: "ignored" };

const LEVEL_LABELS: Record<keyof CombatSetupFormState["levels"], string> = {
  attack: "Attack",
  strength: "Strength",
  defence: "Defence",
  hitpoints: "Hitpoints",
  ranged: "Ranged",
  magic: "Magic",
  prayer: "Prayer"
};

const TRIP_LABELS: Record<keyof CombatSetupFormState["trip"], string> = {
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

const PLANNER_TARGET_LABELS: Record<keyof CombatSetupFormState["plannerTargets"], string> = {
  attack: "Attack target",
  strength: "Strength target",
  defence: "Defence target",
  ranged: "Ranged target",
  magic: "Magic target"
};

const GROUP_ORDER: ReadonlyArray<{ id: ActiveSetupResetGroupId; label: string }> = [
  { id: "levels", label: "Player levels" },
  { id: "loadouts", label: "Loadouts and equipment" },
  { id: "prayers-boosts", label: "Prayers and boosts" },
  { id: "special-overrides", label: "Special attacks and combat overrides" },
  { id: "trip", label: "Trip and supplies" },
  { id: "planner-targets", label: "Planner targets" }
];

function humanizeId(value: string): string {
  if (value === "none") return "None";
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function valueLabel(value: string | number | boolean | null): string {
  if (value == null) return "Auto";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "string") return humanizeId(value);
  return String(value);
}

function selectionLabel(
  values: readonly string[],
  options: ReadonlyArray<{ id: string; label: string }>
): string {
  const labels = values
    .filter((value) => value !== "none")
    .map((value) => humanizeId(options.find((option) => option.id === value)?.label ?? value));
  return labels.length > 0 ? labels.join(", ") : "None";
}

function itemLabel(
  gameData: GameDataSnapshot,
  kind: "weapon" | "ammo" | "spell",
  itemId: EntityId
): string {
  if (itemId === "none") return "None";
  if (kind === "weapon") return gameData.weapons[itemId]?.name ?? humanizeId(itemId);
  if (kind === "ammo") return gameData.ammo[itemId]?.name ?? humanizeId(itemId);
  return gameData.spells[itemId]?.name ?? humanizeId(itemId);
}

function gearLabel(
  gameData: GameDataSnapshot,
  slot: (typeof EQUIPMENT_SLOTS)[number],
  itemId: EntityId
): string {
  if (itemId === "none") return "None";
  return gameData.equipment[slot]?.[itemId]?.name ?? humanizeId(itemId);
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableJsonValue(child)])
    );
  }
  return value;
}

function semanticallyEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableJsonValue(left)) === JSON.stringify(stableJsonValue(right));
}

function addChange(
  changes: ActiveSetupResetChangeViewModel[],
  id: string,
  label: string,
  currentRaw: unknown,
  defaultRaw: unknown,
  currentValue = valueLabel(currentRaw as string | number | boolean | null),
  defaultValue = valueLabel(defaultRaw as string | number | boolean | null)
): void {
  if (semanticallyEqual(currentRaw, defaultRaw)) return;
  changes.push({ id, label, currentValue, defaultValue });
}

function styleLoadoutChanges(
  category: "loadouts" | "prayers-boosts" | "special-overrides",
  style: CombatStyle,
  current: CombatStyleLoadout,
  defaults: CombatStyleLoadout,
  gameData: GameDataSnapshot
): ActiveSetupResetChangeViewModel[] {
  const changes: ActiveSetupResetChangeViewModel[] = [];
  const prefix = `${category}-${style}`;

  if (category === "loadouts") {
    addChange(
      changes,
      `${prefix}-weapon`,
      "Weapon",
      current.weaponId,
      defaults.weaponId,
      itemLabel(gameData, "weapon", current.weaponId),
      itemLabel(gameData, "weapon", defaults.weaponId)
    );
    addChange(
      changes,
      `${prefix}-ammo`,
      "Ammo",
      current.ammoId,
      defaults.ammoId,
      itemLabel(gameData, "ammo", current.ammoId),
      itemLabel(gameData, "ammo", defaults.ammoId)
    );
    addChange(
      changes,
      `${prefix}-spell`,
      "Spell",
      current.spellId,
      defaults.spellId,
      itemLabel(gameData, "spell", current.spellId),
      itemLabel(gameData, "spell", defaults.spellId)
    );
    addChange(changes, `${prefix}-style`, "Attack style", current.styleId, defaults.styleId);
    for (const slot of EQUIPMENT_SLOTS) {
      const currentItem = current.gear[slot] ?? "none";
      const defaultItem = defaults.gear[slot] ?? "none";
      addChange(
        changes,
        `${prefix}-gear-${slot}`,
        humanizeId(slot),
        currentItem,
        defaultItem,
        gearLabel(gameData, slot, currentItem),
        gearLabel(gameData, slot, defaultItem)
      );
    }
  }

  if (category === "prayers-boosts") {
    addChange(
      changes,
      `${prefix}-prayers`,
      "Prayers",
      current.prayers,
      defaults.prayers,
      selectionLabel(current.prayers, PRAYER_SELECTION_OPTIONS),
      selectionLabel(defaults.prayers, PRAYER_SELECTION_OPTIONS)
    );
    addChange(
      changes,
      `${prefix}-boosts`,
      "Boosts",
      current.boosts,
      defaults.boosts,
      selectionLabel(current.boosts, BOOST_SELECTION_OPTIONS),
      selectionLabel(defaults.boosts, BOOST_SELECTION_OPTIONS)
    );
    addChange(
      changes,
      `${prefix}-sustained`,
      "Sustained boosts",
      current.sustained,
      defaults.sustained
    );
    addChange(
      changes,
      `${prefix}-repot-threshold`,
      "Repot threshold",
      current.repotThreshold,
      defaults.repotThreshold
    );
  }

  if (category === "special-overrides") {
    addChange(
      changes,
      `${prefix}-special-weapon`,
      "Special weapon",
      current.specialAttack.weaponId,
      defaults.specialAttack.weaponId,
      itemLabel(gameData, "weapon", current.specialAttack.weaponId),
      itemLabel(gameData, "weapon", defaults.specialAttack.weaponId)
    );
    addChange(
      changes,
      `${prefix}-special-ammo`,
      "Special ammo",
      current.specialAttack.ammoId,
      defaults.specialAttack.ammoId,
      itemLabel(gameData, "ammo", current.specialAttack.ammoId),
      itemLabel(gameData, "ammo", defaults.specialAttack.ammoId)
    );
    addChange(
      changes,
      `${prefix}-accuracy`,
      "Accuracy override",
      current.manualOverrides.accuracyBonus,
      defaults.manualOverrides.accuracyBonus
    );
    addChange(
      changes,
      `${prefix}-damage`,
      "Damage override",
      current.manualOverrides.damageBonus,
      defaults.manualOverrides.damageBonus
    );
    addChange(
      changes,
      `${prefix}-speed`,
      "Attack speed override",
      current.manualOverrides.attackSpeedSec,
      defaults.manualOverrides.attackSpeedSec
    );
  }

  return changes;
}

export function createCanonicalActiveForm(current: CombatSetupFormState): CombatSetupFormState {
  const styleDefaults = switchCombatStyleLoadout(DEFAULT_FORM_STATE, current.combatStyle);
  return normalizeFormState({
    ...styleDefaults,
    monsterId: current.monsterId,
    perStyleLoadouts: createDefaultPerStyleLoadouts()
  });
}

export function createActiveSetupResetReview(
  current: CombatSetupFormState,
  defaults: CombatSetupFormState,
  gameData: GameDataSnapshot,
  setupMode: SetupMode
): ActiveSetupResetReviewViewModel {
  const normalizedCurrent = normalizeFormState(current);
  const normalizedDefaults = normalizeFormState(defaults);
  const groups = new Map<ActiveSetupResetGroupId, ActiveSetupResetGroupViewModel>();

  const levels: ActiveSetupResetChangeViewModel[] = [];
  for (const skill of Object.keys(LEVEL_LABELS) as Array<keyof typeof LEVEL_LABELS>) {
    addChange(
      levels,
      `level-${skill}`,
      LEVEL_LABELS[skill],
      normalizedCurrent.levels[skill],
      normalizedDefaults.levels[skill]
    );
  }
  groups.set("levels", {
    id: "levels",
    label: "Player levels",
    changeCount: levels.length,
    changes: levels,
    subgroups: []
  });

  for (const category of ["loadouts", "prayers-boosts", "special-overrides"] as const) {
    const subgroups = COMBAT_STYLES.map((style) => ({
      id: style,
      label: humanizeId(style),
      changes: styleLoadoutChanges(
        category,
        style,
        normalizedCurrent.perStyleLoadouts[style],
        normalizedDefaults.perStyleLoadouts[style],
        gameData
      )
    })).filter((subgroup) => subgroup.changes.length > 0);
    const label = GROUP_ORDER.find((group) => group.id === category)?.label ?? humanizeId(category);
    groups.set(category, {
      id: category,
      label,
      changeCount: subgroups.reduce((total, subgroup) => total + subgroup.changes.length, 0),
      changes: [],
      subgroups
    });
  }

  const trip: ActiveSetupResetChangeViewModel[] = [];
  addChange(
    trip,
    "ring-of-wealth",
    "Ring of Wealth",
    normalizedCurrent.ringOfWealth,
    normalizedDefaults.ringOfWealth
  );
  for (const key of Object.keys(TRIP_LABELS) as Array<keyof typeof TRIP_LABELS>) {
    const currentRaw = normalizedCurrent.trip[key];
    const defaultRaw = normalizedDefaults.trip[key];
    let currentValue = valueLabel(currentRaw);
    let defaultValue = valueLabel(defaultRaw);
    if (key === "foodKey") {
      currentValue = FOOD[String(currentRaw)]?.name ?? humanizeId(String(currentRaw));
      defaultValue = FOOD[String(defaultRaw)]?.name ?? humanizeId(String(defaultRaw));
    }
    addChange(
      trip,
      `trip-${key}`,
      TRIP_LABELS[key],
      currentRaw,
      defaultRaw,
      currentValue,
      defaultValue
    );
  }
  groups.set("trip", {
    id: "trip",
    label: "Trip and supplies",
    changeCount: trip.length,
    changes: trip,
    subgroups: []
  });

  const plannerTargets: ActiveSetupResetChangeViewModel[] = [];
  for (const skill of Object.keys(PLANNER_TARGET_LABELS) as Array<
    keyof typeof PLANNER_TARGET_LABELS
  >) {
    addChange(
      plannerTargets,
      `planner-target-${skill}`,
      PLANNER_TARGET_LABELS[skill],
      normalizedCurrent.plannerTargets[skill] ?? "Auto",
      normalizedDefaults.plannerTargets[skill] ?? "Auto"
    );
  }
  groups.set("planner-targets", {
    id: "planner-targets",
    label: "Planner targets",
    changeCount: plannerTargets.length,
    changes: plannerTargets,
    subgroups: []
  });

  const orderedGroups = GROUP_ORDER.map(({ id }) => groups.get(id)!).filter(
    (group) => group.changeCount > 0
  );
  const targetId = normalizedCurrent.monsterId;
  const targetLabel = gameData.monsters[targetId]?.name ?? humanizeId(targetId);

  return {
    targetLabel,
    combatStyleLabel: humanizeId(normalizedCurrent.combatStyle),
    ownerLabel: setupMode === "custom" ? `${targetLabel} Custom` : "Default",
    changeCount: orderedGroups.reduce((total, group) => total + group.changeCount, 0),
    groups: orderedGroups
  };
}

export function createActiveSetupResetCandidate(
  id: number,
  currentSetup: SavedSetupState,
  gameData: GameDataSnapshot
): ActiveSetupResetCandidate {
  const source = SavedSetupSchema.parse(currentSetup);
  const canonicalForm = createCanonicalActiveForm(source.form);
  const setup =
    source.setupMode === "custom"
      ? savedSetupFromForm(
          canonicalForm,
          source.denseCompare,
          source.cannonByMonster,
          setCustomSetupForMonster(source.customSetupsByMonster, canonicalForm),
          source.defaultForm,
          "custom"
        )
      : savedSetupFromForm(
          canonicalForm,
          source.denseCompare,
          source.cannonByMonster,
          source.customSetupsByMonster,
          canonicalForm,
          "default"
        );

  return {
    id,
    source,
    setup,
    scope: {
      targetId: source.form.monsterId,
      combatStyle: source.form.combatStyle,
      setupMode: source.setupMode,
      owner: source.setupMode === "custom" ? "current-target-custom" : "default",
      resetStyleCaches: ["melee", "ranged", "magic"]
    },
    review: createActiveSetupResetReview(source.form, canonicalForm, gameData, source.setupMode)
  };
}

export function activeSetupResetCandidateIsCurrent(
  candidate: ActiveSetupResetCandidate,
  currentSetup: SavedSetupState
): boolean {
  return semanticallyEqual(candidate.source, SavedSetupSchema.parse(currentSetup));
}

export function openActiveSetupReset(
  state: ActiveSetupResetState,
  currentSetup: SavedSetupState,
  gameData: GameDataSnapshot
): ActiveSetupResetState {
  const candidate = createActiveSetupResetCandidate(state.nextId, currentSetup, gameData);
  if (candidate.review.changeCount === 0) {
    return {
      nextId: state.nextId + 1,
      candidate: null,
      notice: ACTIVE_SETUP_RESET_NOOP_NOTICE
    };
  }
  return {
    nextId: state.nextId + 1,
    candidate,
    notice: null
  };
}

export function cancelActiveSetupReset(
  state: ActiveSetupResetState,
  candidateId: number
): ActiveSetupResetState {
  if (state.candidate?.id !== candidateId) return state;
  return { ...state, candidate: null, notice: null };
}

export function invalidateStaleActiveSetupReset(
  state: ActiveSetupResetState,
  currentSetup: SavedSetupState
): ActiveSetupResetState {
  if (!state.candidate || activeSetupResetCandidateIsCurrent(state.candidate, currentSetup)) {
    return state;
  }
  return { ...state, candidate: null, notice: ACTIVE_SETUP_RESET_STALE_NOTICE };
}

export function consumeActiveSetupReset(
  state: ActiveSetupResetState,
  candidateId: number,
  currentSetup: SavedSetupState
): { state: ActiveSetupResetState; outcome: ActiveSetupResetConsumeOutcome } {
  const candidate = state.candidate;
  if (!candidate || candidate.id !== candidateId) {
    return { state, outcome: { status: "ignored" } };
  }
  if (!activeSetupResetCandidateIsCurrent(candidate, currentSetup)) {
    return {
      state: { ...state, candidate: null, notice: ACTIVE_SETUP_RESET_STALE_NOTICE },
      outcome: { status: "stale" }
    };
  }
  return {
    state: { ...state, candidate: null, notice: null },
    outcome: { status: "accepted", candidate }
  };
}

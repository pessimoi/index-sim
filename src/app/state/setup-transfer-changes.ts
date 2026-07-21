import {
  EQUIPMENT_SLOTS,
  type DropDefinition,
  type GameDataSnapshot,
  type MonsterDefinition
} from "@/domain/shared";
import { FOOD, lootPreferenceKey, type CannonSettings, type LootAction } from "@/domain/trip";
import type { DenseCompareSortState } from "./dense-compare";
import type { MonsterLootSettings } from "./loot-settings";
import {
  BOOST_SELECTION_OPTIONS,
  COMBAT_STYLES,
  PRAYER_SELECTION_OPTIONS,
  SavedSetupSchema,
  normalizeFormState,
  type CombatSetupFormState,
  type CombatStyleLoadout,
  type SavedSetupState
} from "./ui-state";
import {
  createEntityCollisionIndex,
  createEntityDisplayLabel,
  createRowCollisionLabels
} from "../view-models/presentation-language";

export type SetupTransferKind = "setup-file" | "shared-link" | "saved-row";
export type SetupCollectionEntryStatus = "added" | "removed" | "changed" | "unchanged";

export interface SetupChangeValue {
  readonly display: string;
  readonly accessible: string;
}

export interface SetupFieldChange {
  readonly id: string;
  readonly label: string;
  readonly current: SetupChangeValue;
  readonly incoming: SetupChangeValue;
}

export interface SetupChangeGroup {
  readonly id: string;
  readonly label: string;
  readonly changeCount: number;
  readonly changes: readonly SetupFieldChange[];
  readonly children: readonly SetupChangeGroup[];
  readonly status?: SetupCollectionEntryStatus;
  readonly collectionEntry?: boolean;
}

export interface SetupTransferChangeReview {
  readonly kind: SetupTransferKind;
  readonly currentFingerprint: string;
  readonly incomingFingerprint: string;
  readonly changeCount: number;
  readonly groups: readonly SetupChangeGroup[];
  readonly includedScope: readonly string[];
  readonly excludedScope: readonly string[];
}

type FormTopLevelKey = keyof CombatSetupFormState;
type LevelKey = keyof CombatSetupFormState["levels"];
type TripKey = keyof CombatSetupFormState["trip"];
type PlannerTargetKey = keyof CombatSetupFormState["plannerTargets"];
type LoadoutKey = keyof CombatStyleLoadout;
type SpecialAttackKey = keyof CombatStyleLoadout["specialAttack"];
type ManualOverrideKey = keyof CombatStyleLoadout["manualOverrides"];

export const SETUP_FORM_TOP_LEVEL_CLASSIFICATION = {
  combatStyle: "shown",
  monsterId: "shown",
  weaponId: "normalized-to-active-style-cache",
  ammoId: "normalized-to-active-style-cache",
  spellId: "normalized-to-active-style-cache",
  styleId: "normalized-to-active-style-cache",
  levels: "shown-by-level-registry",
  gear: "normalized-to-active-style-cache",
  prayers: "normalized-to-active-style-cache",
  boosts: "normalized-to-active-style-cache",
  sustained: "normalized-to-active-style-cache",
  repotThreshold: "normalized-to-active-style-cache",
  specialAttack: "normalized-to-active-style-cache",
  manualOverrides: "normalized-to-active-style-cache",
  perStyleLoadouts: "shown-by-style-loadout-registry",
  ringOfWealth: "shown",
  trip: "shown-by-trip-registry",
  plannerTargets: "shown-by-planner-registry"
} as const satisfies Record<FormTopLevelKey, string>;

export const SETUP_LEVEL_FIELD_LABELS = {
  attack: "Attack",
  strength: "Strength",
  defence: "Defence",
  hitpoints: "Hitpoints",
  ranged: "Ranged",
  magic: "Magic",
  prayer: "Prayer"
} as const satisfies Record<LevelKey, string>;

export const SETUP_TRIP_FIELD_LABELS = {
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
} as const satisfies Record<TripKey, string>;

export const SETUP_PLANNER_TARGET_FIELD_LABELS = {
  attack: "Attack target",
  strength: "Strength target",
  defence: "Defence target",
  ranged: "Ranged target",
  magic: "Magic target"
} as const satisfies Record<PlannerTargetKey, string>;

export const SETUP_LOADOUT_FIELD_CLASSIFICATION = {
  weaponId: "active-loadout",
  ammoId: "active-loadout",
  spellId: "active-loadout",
  styleId: "active-loadout",
  gear: "active-loadout",
  prayers: "prayers-boosts-special",
  boosts: "prayers-boosts-special",
  sustained: "prayers-boosts-special",
  repotThreshold: "prayers-boosts-special",
  specialAttack: "prayers-boosts-special",
  manualOverrides: "manual-overrides"
} as const satisfies Record<LoadoutKey, string>;

export const SETUP_SPECIAL_ATTACK_FIELD_LABELS = {
  weaponId: "Special weapon",
  ammoId: "Special ammo"
} as const satisfies Record<SpecialAttackKey, string>;

export const SETUP_MANUAL_OVERRIDE_FIELD_LABELS = {
  accuracyBonus: "Accuracy override",
  damageBonus: "Damage override",
  attackSpeedSec: "Attack speed override"
} as const satisfies Record<ManualOverrideKey, string>;

export const SETUP_FILE_INCLUDED_SCOPE = [
  "Active setup and all three combat-style loadouts",
  "Default setup and Default/Custom mode",
  "Monster-specific custom setups",
  "Monster-specific cannon settings",
  "Dense Compare preferences"
] as const;

export const SETUP_FILE_EXCLUDED_SCOPE = [
  "PriceSet, manual prices and price history",
  "Saved setup collection",
  "Loot actions and loot settings",
  "Planner UI controls outside setup targets",
  "Hiscores player",
  "Calculated results"
] as const;

export const SHARED_SETUP_INCLUDED_SCOPE = [
  "Full active setup form and all three combat-style loadouts",
  "Cannon settings for the incoming target",
  "Loot actions for the incoming target",
  "Loot settings for the incoming target"
] as const;

export const SHARED_SETUP_EXCLUDED_SCOPE = [
  "Recipient PriceSet, manual prices and price history",
  "Saved setup collection",
  "Cannon, loot actions and loot settings for other monsters",
  "Planner UI controls outside setup targets",
  "Hiscores player",
  "Calculated results"
] as const;

export const SAVED_ROW_INCLUDED_SCOPE = ["Stored active setup form"] as const;

export const SAVED_ROW_EXCLUDED_SCOPE = [
  "Current target selection",
  "Current cannon, loot actions, loot settings and prices",
  "Other saved setups",
  "Calculated Duel impact",
  "Hiscores player"
] as const;

export interface SharedSetupChangeState {
  readonly form: CombatSetupFormState;
  readonly cannon: CannonSettings;
  readonly lootPreferences: Readonly<Record<string, LootAction>>;
  readonly lootSettings: MonsterLootSettings;
}

const DENSE_SORT_LABELS: Record<DenseCompareSortState["key"], string> = {
  monsterName: "Monster",
  hitChance: "Hit chance",
  maxHit: "Max hit",
  dps: "DPS",
  ttkSec: "TTK",
  killsPerHour: "Effective kills/hr",
  xpPerHour: "Effective XP/hr",
  gpPerKill: "GP/kill",
  gpPerHour: "Effective gross GP/hr",
  netGpPerHour: "Effective net GP/hr"
};

const ABSENT = Symbol("setup-transfer-absent");
type ComparableValue = unknown | typeof ABSENT;

function humanizeId(value: string): string {
  if (value === "none") return "None";
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function semanticValue(display: string, accessible = display): SetupChangeValue {
  return { display, accessible };
}

function optionalValue(value: ComparableValue): SetupChangeValue {
  if (value === ABSENT) return semanticValue("Not present");
  if (value == null) return semanticValue("Auto");
  if (typeof value === "boolean") return semanticValue(value ? "On" : "Off");
  if (typeof value === "number") return semanticValue(String(value));
  return semanticValue(humanizeId(String(value)));
}

function unitValue(
  value: ComparableValue,
  singular: string,
  plural = `${singular}s`
): SetupChangeValue {
  if (value === ABSENT || value == null) return optionalValue(value);
  const numeric = Number(value);
  return semanticValue(`${numeric} ${numeric === 1 ? singular : plural}`);
}

function selectionValue(
  value: ComparableValue,
  options: ReadonlyArray<{ id: string; label: string }>
): SetupChangeValue {
  if (value === ABSENT) return optionalValue(value);
  const values = [...((value as readonly string[]) ?? [])].sort();
  const labels = values
    .filter((id) => id !== "none")
    .map((id) => options.find((option) => option.id === id)?.label ?? humanizeId(id));
  return semanticValue(labels.length > 0 ? labels.join(", ") : "None");
}

function entityValue(
  value: ComparableValue,
  gameData: GameDataSnapshot,
  kind: "item" | "monster"
): SetupChangeValue {
  if (value === ABSENT) return optionalValue(value);
  const id = String(value);
  if (id === "none") return semanticValue("None");
  const collisionIndex = createEntityCollisionIndex(gameData);
  const name =
    kind === "monster"
      ? gameData.monsters[id]?.name
      : (gameData.items[id]?.name ??
        gameData.weapons[id]?.name ??
        gameData.ammo[id]?.name ??
        gameData.spells[id]?.name);
  const resolved = createEntityDisplayLabel({
    technicalId: id,
    gameDataName: name,
    collisionIndex,
    entityKind: kind
  });
  return semanticValue(resolved.name);
}

function gearValue(
  value: ComparableValue,
  gameData: GameDataSnapshot,
  slot: (typeof EQUIPMENT_SLOTS)[number]
): SetupChangeValue {
  if (value === ABSENT) return optionalValue(value);
  const id = String(value ?? "none");
  if (id === "none") return semanticValue("None");
  const name = gameData.equipment[slot]?.[id]?.name ?? gameData.items[id]?.name;
  const resolved = createEntityDisplayLabel({
    technicalId: id,
    gameDataName: name,
    collisionIndex: createEntityCollisionIndex(gameData),
    entityKind: "item"
  });
  return semanticValue(resolved.name);
}

function stableValue(value: ComparableValue): unknown {
  if (value === ABSENT) return "__absent__";
  if (Array.isArray(value)) return value.map(stableValue).sort(compareCanonicalValues);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)])
    );
  }
  return value;
}

function compareCanonicalValues(left: unknown, right: unknown): number {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

function semanticallyEqual(left: ComparableValue, right: ComparableValue): boolean {
  if (left === ABSENT || right === ABSENT) return left === right;
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function addChange(
  changes: SetupFieldChange[],
  input: {
    id: string;
    label: string;
    currentRaw: ComparableValue;
    incomingRaw: ComparableValue;
    current?: SetupChangeValue;
    incoming?: SetupChangeValue;
  }
): void {
  if (semanticallyEqual(input.currentRaw, input.incomingRaw)) return;
  changes.push({
    id: input.id,
    label: input.label,
    current: input.current ?? optionalValue(input.currentRaw),
    incoming: input.incoming ?? optionalValue(input.incomingRaw)
  });
}

function group(
  id: string,
  label: string,
  changes: readonly SetupFieldChange[] = [],
  children: readonly SetupChangeGroup[] = [],
  options: Pick<SetupChangeGroup, "status" | "collectionEntry"> = {}
): SetupChangeGroup {
  return {
    id,
    label,
    changes,
    children,
    changeCount: changes.length + children.reduce((total, child) => total + child.changeCount, 0),
    ...options
  };
}

function loadoutValue(
  loadout: CombatStyleLoadout | null,
  key: keyof CombatStyleLoadout
): ComparableValue {
  return loadout ? loadout[key] : ABSENT;
}

function loadoutChanges(
  idPrefix: string,
  current: CombatStyleLoadout | null,
  incoming: CombatStyleLoadout | null,
  gameData: GameDataSnapshot,
  sections: readonly ("loadout" | "prayers-special" | "manual")[]
): SetupFieldChange[] {
  const changes: SetupFieldChange[] = [];
  const includes = (section: (typeof sections)[number]) => sections.includes(section);

  if (includes("loadout")) {
    for (const [key, label] of [
      ["weaponId", "Weapon"],
      ["ammoId", "Ammo"],
      ["spellId", "Spell"],
      ["styleId", "Attack style"]
    ] as const) {
      const currentRaw = loadoutValue(current, key);
      const incomingRaw = loadoutValue(incoming, key);
      addChange(changes, {
        id: `${idPrefix}-${key}`,
        label,
        currentRaw,
        incomingRaw,
        current:
          key === "styleId" ? optionalValue(currentRaw) : entityValue(currentRaw, gameData, "item"),
        incoming:
          key === "styleId"
            ? optionalValue(incomingRaw)
            : entityValue(incomingRaw, gameData, "item")
      });
    }
    for (const slot of EQUIPMENT_SLOTS) {
      const currentRaw = current ? (current.gear[slot] ?? "none") : ABSENT;
      const incomingRaw = incoming ? (incoming.gear[slot] ?? "none") : ABSENT;
      addChange(changes, {
        id: `${idPrefix}-gear-${slot}`,
        label: humanizeId(slot),
        currentRaw,
        incomingRaw,
        current: gearValue(currentRaw, gameData, slot),
        incoming: gearValue(incomingRaw, gameData, slot)
      });
    }
  }

  if (includes("prayers-special")) {
    for (const [key, label, options] of [
      ["prayers", "Prayers", PRAYER_SELECTION_OPTIONS],
      ["boosts", "Boosts", BOOST_SELECTION_OPTIONS]
    ] as const) {
      const currentRaw = loadoutValue(current, key);
      const incomingRaw = loadoutValue(incoming, key);
      addChange(changes, {
        id: `${idPrefix}-${key}`,
        label,
        currentRaw,
        incomingRaw,
        current: selectionValue(currentRaw, options),
        incoming: selectionValue(incomingRaw, options)
      });
    }
    for (const [key, label] of [
      ["sustained", "Sustained boosts"],
      ["repotThreshold", "Repot threshold"]
    ] as const) {
      const currentRaw = loadoutValue(current, key);
      const incomingRaw = loadoutValue(incoming, key);
      addChange(changes, {
        id: `${idPrefix}-${key}`,
        label,
        currentRaw,
        incomingRaw
      });
    }
    for (const key of Object.keys(SETUP_SPECIAL_ATTACK_FIELD_LABELS) as SpecialAttackKey[]) {
      const currentRaw = current ? current.specialAttack[key] : ABSENT;
      const incomingRaw = incoming ? incoming.specialAttack[key] : ABSENT;
      addChange(changes, {
        id: `${idPrefix}-special-${key}`,
        label: SETUP_SPECIAL_ATTACK_FIELD_LABELS[key],
        currentRaw,
        incomingRaw,
        current: entityValue(currentRaw, gameData, "item"),
        incoming: entityValue(incomingRaw, gameData, "item")
      });
    }
  }

  if (includes("manual")) {
    for (const key of Object.keys(SETUP_MANUAL_OVERRIDE_FIELD_LABELS) as ManualOverrideKey[]) {
      const currentRaw = current ? current.manualOverrides[key] : ABSENT;
      const incomingRaw = incoming ? incoming.manualOverrides[key] : ABSENT;
      const isSpeed = key === "attackSpeedSec";
      addChange(changes, {
        id: `${idPrefix}-manual-${key}`,
        label: SETUP_MANUAL_OVERRIDE_FIELD_LABELS[key],
        currentRaw,
        incomingRaw,
        current: isSpeed ? unitValue(currentRaw, "second") : optionalValue(currentRaw),
        incoming: isSpeed ? unitValue(incomingRaw, "second") : optionalValue(incomingRaw)
      });
    }
  }

  return changes;
}

function tripValue(key: TripKey, value: ComparableValue): SetupChangeValue {
  if (value === ABSENT || value == null) return optionalValue(value);
  if (key === "foodKey") {
    const id = String(value);
    return semanticValue(FOOD[id]?.name ?? humanizeId(id));
  }
  if (key === "bankSeconds" || key === "altarSeconds" || key === "respawnSeconds") {
    return unitValue(value, "second");
  }
  if (key === "foodPerKillOverride") return unitValue(value, "food/kill", "food/kill");
  if (key === "potionSets" || key === "prayerPotionSets") return unitValue(value, "vial");
  if (key === "potionDoses" || key === "prayerPotionDoses") return unitValue(value, "dose");
  if (key === "runeSlots") return unitValue(value, "slot");
  if (key === "recoilRings") return unitValue(value, "ring");
  if (key === "targetsAtSpot") return unitValue(value, "target");
  if (key === "foodCount") return unitValue(value, "food", "food");
  return optionalValue(value);
}

function formGroups(
  currentInput: CombatSetupFormState | null,
  incomingInput: CombatSetupFormState | null,
  gameData: GameDataSnapshot,
  idPrefix: string
): SetupChangeGroup[] {
  const current = currentInput ? normalizeFormState(currentInput) : null;
  const incoming = incomingInput ? normalizeFormState(incomingInput) : null;
  const activeStyle = incoming?.combatStyle ?? current?.combatStyle ?? "melee";
  const currentActive = current?.perStyleLoadouts[activeStyle] ?? null;
  const incomingActive = incoming?.perStyleLoadouts[activeStyle] ?? null;

  const identity: SetupFieldChange[] = [];
  const currentMonster = current?.monsterId ?? ABSENT;
  const incomingMonster = incoming?.monsterId ?? ABSENT;
  addChange(identity, {
    id: `${idPrefix}-monsterId`,
    label: "Target",
    currentRaw: currentMonster,
    incomingRaw: incomingMonster,
    current: entityValue(currentMonster, gameData, "monster"),
    incoming: entityValue(incomingMonster, gameData, "monster")
  });
  addChange(identity, {
    id: `${idPrefix}-combatStyle`,
    label: "Combat style",
    currentRaw: current?.combatStyle ?? ABSENT,
    incomingRaw: incoming?.combatStyle ?? ABSENT
  });

  const levels: SetupFieldChange[] = [];
  for (const key of Object.keys(SETUP_LEVEL_FIELD_LABELS) as LevelKey[]) {
    addChange(levels, {
      id: `${idPrefix}-level-${key}`,
      label: SETUP_LEVEL_FIELD_LABELS[key],
      currentRaw: current?.levels[key] ?? ABSENT,
      incomingRaw: incoming?.levels[key] ?? ABSENT
    });
  }

  const otherLoadouts = COMBAT_STYLES.filter((style) => style !== activeStyle).map((style) =>
    group(
      `${idPrefix}-other-loadout-${style}`,
      humanizeId(style),
      loadoutChanges(
        `${idPrefix}-${style}`,
        current?.perStyleLoadouts[style] ?? null,
        incoming?.perStyleLoadouts[style] ?? null,
        gameData,
        ["loadout", "prayers-special", "manual"]
      )
    )
  );

  const manual = loadoutChanges(
    `${idPrefix}-${activeStyle}`,
    currentActive,
    incomingActive,
    gameData,
    ["manual"]
  );
  addChange(manual, {
    id: `${idPrefix}-ringOfWealth`,
    label: "Ring of wealth",
    currentRaw: current?.ringOfWealth ?? ABSENT,
    incomingRaw: incoming?.ringOfWealth ?? ABSENT
  });

  const trip: SetupFieldChange[] = [];
  for (const key of Object.keys(SETUP_TRIP_FIELD_LABELS) as TripKey[]) {
    const currentRaw = current ? current.trip[key] : ABSENT;
    const incomingRaw = incoming ? incoming.trip[key] : ABSENT;
    addChange(trip, {
      id: `${idPrefix}-trip-${key}`,
      label: SETUP_TRIP_FIELD_LABELS[key],
      currentRaw,
      incomingRaw,
      current: tripValue(key, currentRaw),
      incoming: tripValue(key, incomingRaw)
    });
  }

  const planner: SetupFieldChange[] = [];
  for (const key of Object.keys(SETUP_PLANNER_TARGET_FIELD_LABELS) as PlannerTargetKey[]) {
    addChange(planner, {
      id: `${idPrefix}-planner-${key}`,
      label: SETUP_PLANNER_TARGET_FIELD_LABELS[key],
      currentRaw: current ? (current.plannerTargets[key] ?? null) : ABSENT,
      incomingRaw: incoming ? (incoming.plannerTargets[key] ?? null) : ABSENT
    });
  }

  return [
    group(`${idPrefix}-identity`, "Setup identity", identity),
    group(`${idPrefix}-levels`, "Player levels", levels),
    group(
      `${idPrefix}-active-loadout`,
      `${humanizeId(activeStyle)} active combat loadout`,
      loadoutChanges(`${idPrefix}-${activeStyle}`, currentActive, incomingActive, gameData, [
        "loadout"
      ])
    ),
    group(`${idPrefix}-other-loadouts`, "Other combat-style loadouts", [], otherLoadouts),
    group(
      `${idPrefix}-prayers-special`,
      "Prayers, boosts and special attack",
      loadoutChanges(`${idPrefix}-${activeStyle}`, currentActive, incomingActive, gameData, [
        "prayers-special"
      ])
    ),
    group(`${idPrefix}-manual`, "Manual combat overrides", manual),
    group(`${idPrefix}-trip`, "Trip, supplies and banking", trip),
    group(`${idPrefix}-planner`, "Planner targets", planner)
  ];
}

function collectionStatus(
  current: unknown | undefined,
  incoming: unknown | undefined
): SetupCollectionEntryStatus {
  if (current === undefined) return "added";
  if (incoming === undefined) return "removed";
  return semanticallyEqual(current, incoming) ? "unchanged" : "changed";
}

function customSetupGroup(
  current: SavedSetupState,
  incoming: SavedSetupState,
  gameData: GameDataSnapshot
): SetupChangeGroup {
  const ids = Array.from(
    new Set([
      ...Object.keys(current.customSetupsByMonster),
      ...Object.keys(incoming.customSetupsByMonster)
    ])
  ).sort((left, right) => {
    const leftLabel = gameData.monsters[left]?.name ?? left;
    const rightLabel = gameData.monsters[right]?.name ?? right;
    return leftLabel.localeCompare(rightLabel) || left.localeCompare(right);
  });
  const children = ids.map((id) => {
    const currentForm = current.customSetupsByMonster[id];
    const incomingForm = incoming.customSetupsByMonster[id];
    const status = collectionStatus(currentForm, incomingForm);
    return group(
      `custom-${id}`,
      entityValue(id, gameData, "monster").display,
      [],
      status === "unchanged"
        ? []
        : formGroups(currentForm ?? null, incomingForm ?? null, gameData, `custom-${id}`),
      { status, collectionEntry: true }
    );
  });
  return group("custom-setups", "Monster-specific custom setups", [], children);
}

function cannonGroup(
  current: SavedSetupState,
  incoming: SavedSetupState,
  gameData: GameDataSnapshot
): SetupChangeGroup {
  const ids = Array.from(
    new Set([...Object.keys(current.cannonByMonster), ...Object.keys(incoming.cannonByMonster)])
  ).sort((left, right) => {
    const leftLabel = gameData.monsters[left]?.name ?? left;
    const rightLabel = gameData.monsters[right]?.name ?? right;
    return leftLabel.localeCompare(rightLabel) || left.localeCompare(right);
  });
  const children = ids.map((id) => {
    const currentSettings = current.cannonByMonster[id];
    const incomingSettings = incoming.cannonByMonster[id];
    const status = collectionStatus(currentSettings, incomingSettings);
    const changes = cannonSettingsGroup(
      currentSettings ?? null,
      incomingSettings ?? null,
      `cannon-${id}`
    ).changes;
    return group(`cannon-${id}`, entityValue(id, gameData, "monster").display, changes, [], {
      status,
      collectionEntry: true
    });
  });
  return group("cannon-settings", "Monster-specific cannon settings", [], children);
}

function denseGroup(
  current: SavedSetupState,
  incoming: SavedSetupState,
  gameData: GameDataSnapshot
): SetupChangeGroup {
  const changes: SetupFieldChange[] = [];
  addChange(changes, {
    id: "dense-sort-key",
    label: "Sort field",
    currentRaw: current.denseCompare.sort.key,
    incomingRaw: incoming.denseCompare.sort.key,
    current: semanticValue(DENSE_SORT_LABELS[current.denseCompare.sort.key]),
    incoming: semanticValue(DENSE_SORT_LABELS[incoming.denseCompare.sort.key])
  });
  addChange(changes, {
    id: "dense-sort-direction",
    label: "Sort direction",
    currentRaw: current.denseCompare.sort.direction,
    incomingRaw: incoming.denseCompare.sort.direction,
    current: semanticValue(
      current.denseCompare.sort.direction === "asc" ? "Ascending" : "Descending"
    ),
    incoming: semanticValue(
      incoming.denseCompare.sort.direction === "asc" ? "Ascending" : "Descending"
    )
  });
  for (const [key, label] of [
    ["monsterFilter", "Monster filter"],
    ["dropFilter", "Drop filter"],
    ["showIrrelevant", "Show hidden / irrelevant"]
  ] as const) {
    addChange(changes, {
      id: `dense-${key}`,
      label,
      currentRaw: current.denseCompare[key],
      incomingRaw: incoming.denseCompare[key],
      current:
        typeof current.denseCompare[key] === "string" && current.denseCompare[key] === ""
          ? semanticValue("None")
          : optionalValue(current.denseCompare[key]),
      incoming:
        typeof incoming.denseCompare[key] === "string" && incoming.denseCompare[key] === ""
          ? semanticValue("None")
          : optionalValue(incoming.denseCompare[key])
    });
  }
  const currentIds = new Set(current.denseCompare.irrelevantMonsterIds);
  const incomingIds = new Set(incoming.denseCompare.irrelevantMonsterIds);
  for (const id of [...currentIds].filter((value) => !incomingIds.has(value)).sort()) {
    addChange(changes, {
      id: `dense-irrelevant-removed-${id}`,
      label: "Hidden / irrelevant monster removed",
      currentRaw: id,
      incomingRaw: ABSENT,
      current: entityValue(id, gameData, "monster"),
      incoming: optionalValue(ABSENT)
    });
  }
  for (const id of [...incomingIds].filter((value) => !currentIds.has(value)).sort()) {
    addChange(changes, {
      id: `dense-irrelevant-added-${id}`,
      label: "Hidden / irrelevant monster added",
      currentRaw: ABSENT,
      incomingRaw: id,
      current: optionalValue(ABSENT),
      incoming: entityValue(id, gameData, "monster")
    });
  }
  return group("dense-compare", "Dense Compare preferences", changes);
}

function cannonSettingsGroup(
  current: CannonSettings | null,
  incoming: CannonSettings | null,
  idPrefix: string
): SetupChangeGroup {
  const changes: SetupFieldChange[] = [];
  for (const [key, label, formatter] of [
    ["enabled", "Enabled", optionalValue],
    ["targets", "Targets", (value: ComparableValue) => unitValue(value, "target")],
    ["respawnSec", "Respawn time", (value: ComparableValue) => unitValue(value, "second")]
  ] as const) {
    const currentRaw = current ? (current[key] ?? (key === "respawnSec" ? null : ABSENT)) : ABSENT;
    const incomingRaw = incoming
      ? (incoming[key] ?? (key === "respawnSec" ? null : ABSENT))
      : ABSENT;
    addChange(changes, {
      id: `${idPrefix}-${key}`,
      label,
      currentRaw,
      incomingRaw,
      current: formatter(currentRaw),
      incoming: formatter(incomingRaw)
    });
  }
  return group(idPrefix, "Cannon settings", changes);
}

function flattenMonsterLoot(monster: MonsterDefinition | undefined): DropDefinition[] {
  return (monster?.loot ?? []).flatMap((entry) => (Array.isArray(entry) ? entry : [entry]));
}

function lootRowLabels(
  monster: MonsterDefinition | undefined,
  gameData: GameDataSnapshot
): ReadonlyMap<string, string> {
  const collisionIndex = createEntityCollisionIndex(gameData);
  const rows = flattenMonsterLoot(monster).map((drop, sourceOrder) => {
    const stableId = lootPreferenceKey(drop, sourceOrder);
    const baseLabel = createEntityDisplayLabel({
      technicalId: drop.key ?? null,
      gameDataName: drop.key ? gameData.items[drop.key]?.name : null,
      rowSourceName: drop.name,
      collisionIndex,
      entityKind: "item"
    }).name;
    return {
      stableId,
      baseLabel,
      sourceOrder,
      quantityLabel: String(drop.qtyAvg),
      chanceLabel: `${Number((drop.chance * 100).toFixed(4))}%`
    };
  });
  return createRowCollisionLabels(rows);
}

function lootActionValue(value: ComparableValue): SetupChangeValue {
  if (value === ABSENT) return semanticValue("Default");
  const action = String(value);
  return semanticValue(action === "unid" ? "Unid" : humanizeId(action));
}

function lootPreferencesGroup(input: {
  current: Readonly<Record<string, LootAction>>;
  incoming: Readonly<Record<string, LootAction>>;
  monster: MonsterDefinition | undefined;
  gameData: GameDataSnapshot;
}): SetupChangeGroup {
  const changes: SetupFieldChange[] = [];
  const labels = lootRowLabels(input.monster, input.gameData);
  const validIds = new Set(labels.keys());
  const ids = Array.from(new Set([...Object.keys(input.current), ...Object.keys(input.incoming)]))
    .filter((id) => validIds.has(id))
    .sort((left, right) => {
      const leftLabel = labels.get(left) ?? left;
      const rightLabel = labels.get(right) ?? right;
      return leftLabel.localeCompare(rightLabel) || left.localeCompare(right);
    });
  for (const id of ids) {
    const currentRaw = input.current[id] ?? ABSENT;
    const incomingRaw = input.incoming[id] ?? ABSENT;
    addChange(changes, {
      id: `shared-loot-action-${id}`,
      label: labels.get(id) ?? humanizeId(id),
      currentRaw,
      incomingRaw,
      current: lootActionValue(currentRaw),
      incoming: lootActionValue(incomingRaw)
    });
  }
  return group("shared-loot-actions", "Loot actions", changes);
}

function lootSettingsGroup(
  current: MonsterLootSettings,
  incoming: MonsterLootSettings
): SetupChangeGroup {
  const changes: SetupFieldChange[] = [];
  for (const [key, label, formatter] of [
    ["highAlch", "High alch", optionalValue],
    ["overheadSec", "Loot overhead", (value: ComparableValue) => unitValue(value, "second")],
    ["talismanSpot", "Talisman spot", optionalValue]
  ] as const) {
    const currentRaw = current[key] ?? (key === "overheadSec" ? null : ABSENT);
    const incomingRaw = incoming[key] ?? (key === "overheadSec" ? null : ABSENT);
    addChange(changes, {
      id: `shared-loot-setting-${key}`,
      label,
      currentRaw,
      incomingRaw,
      current: formatter(currentRaw),
      incoming: formatter(incomingRaw)
    });
  }
  return group("shared-loot-settings", "Loot settings", changes);
}

function fingerprintForm(input: CombatSetupFormState): string {
  return JSON.stringify(stableValue(normalizeFormState(input)));
}

function fingerprintSharedState(input: SharedSetupChangeState): string {
  return JSON.stringify(
    stableValue({
      form: normalizeFormState(input.form),
      cannon: input.cannon,
      lootPreferences: input.lootPreferences,
      lootSettings: input.lootSettings
    })
  );
}

export function createSharedSetupChangeReview(input: {
  current: SharedSetupChangeState;
  incoming: SharedSetupChangeState;
  gameData: GameDataSnapshot;
}): SetupTransferChangeReview {
  const monster = input.gameData.monsters[input.incoming.form.monsterId];
  const sharedFormGroups = formGroups(
    input.current.form,
    input.incoming.form,
    input.gameData,
    "shared-form"
  );
  const groups = [
    { ...sharedFormGroups[0]!, label: "Active setup identity" },
    sharedFormGroups[1]!,
    { ...sharedFormGroups[2]!, label: "Active combat loadout" },
    ...sharedFormGroups.slice(3),
    {
      ...cannonSettingsGroup(input.current.cannon, input.incoming.cannon, "shared-cannon"),
      label: "Current-monster cannon"
    },
    {
      ...lootPreferencesGroup({
        current: input.current.lootPreferences,
        incoming: input.incoming.lootPreferences,
        monster,
        gameData: input.gameData
      }),
      label: "Current-monster loot actions"
    },
    {
      ...lootSettingsGroup(input.current.lootSettings, input.incoming.lootSettings),
      label: "Current-monster loot settings"
    }
  ];
  return {
    kind: "shared-link",
    currentFingerprint: fingerprintSharedState(input.current),
    incomingFingerprint: fingerprintSharedState(input.incoming),
    changeCount: groups.reduce((total, item) => total + item.changeCount, 0),
    groups,
    includedScope: SHARED_SETUP_INCLUDED_SCOPE,
    excludedScope: SHARED_SETUP_EXCLUDED_SCOPE
  };
}

export function sharedSetupReviewMatchesCurrent(
  review: SetupTransferChangeReview,
  current: SharedSetupChangeState
): boolean {
  return review.currentFingerprint === fingerprintSharedState(current);
}

export function createSavedRowSetupChangeReview(input: {
  current: CombatSetupFormState;
  incoming: CombatSetupFormState;
  gameData: GameDataSnapshot;
}): SetupTransferChangeReview {
  const groups = formGroups(input.current, input.incoming, input.gameData, "saved-row-form");
  return {
    kind: "saved-row",
    currentFingerprint: fingerprintForm(input.current),
    incomingFingerprint: fingerprintForm(input.incoming),
    changeCount: groups.reduce((total, item) => total + item.changeCount, 0),
    groups,
    includedScope: SAVED_ROW_INCLUDED_SCOPE,
    excludedScope: SAVED_ROW_EXCLUDED_SCOPE
  };
}

export function savedRowReviewMatches(
  review: SetupTransferChangeReview,
  current: CombatSetupFormState,
  incoming: CombatSetupFormState
): boolean {
  return (
    review.currentFingerprint === fingerprintForm(current) &&
    review.incomingFingerprint === fingerprintForm(incoming)
  );
}

export function fingerprintSetupTransferState(input: SavedSetupState): string {
  return JSON.stringify(stableValue(SavedSetupSchema.parse(input)));
}

export function createSetupFileChangeReview(input: {
  current: SavedSetupState;
  incoming: SavedSetupState;
  gameData: GameDataSnapshot;
}): SetupTransferChangeReview {
  const current = SavedSetupSchema.parse(input.current);
  const incoming = SavedSetupSchema.parse(input.incoming);
  const activeGroups = formGroups(current.form, incoming.form, input.gameData, "active");
  const activeIdentityChanges = [...activeGroups[0]!.changes];
  addChange(activeIdentityChanges, {
    id: "active-setup-mode",
    label: "Setup mode",
    currentRaw: current.setupMode,
    incomingRaw: incoming.setupMode
  });

  const groups: SetupChangeGroup[] = [
    group("transfer-context", "Transfer context"),
    group("active-setup-identity", "Active setup identity", activeIdentityChanges),
    { ...activeGroups[1]!, id: "player-levels", label: "Player levels" },
    { ...activeGroups[2]!, id: "active-combat-loadout", label: "Active combat loadout" },
    { ...activeGroups[3]!, id: "other-combat-loadouts", label: "Other combat-style loadouts" },
    {
      ...activeGroups[4]!,
      id: "prayers-boosts-special",
      label: "Prayers, boosts and special attack"
    },
    { ...activeGroups[5]!, id: "manual-combat-overrides", label: "Manual combat overrides" },
    { ...activeGroups[6]!, id: "trip-supplies-banking", label: "Trip, supplies and banking" },
    { ...activeGroups[7]!, id: "planner-targets", label: "Planner targets" },
    group(
      "default-setup",
      "Default setup",
      [],
      formGroups(current.defaultForm, incoming.defaultForm, input.gameData, "default")
    ),
    customSetupGroup(current, incoming, input.gameData),
    cannonGroup(current, incoming, input.gameData),
    denseGroup(current, incoming, input.gameData)
  ];

  return {
    kind: "setup-file",
    currentFingerprint: fingerprintSetupTransferState(current),
    incomingFingerprint: fingerprintSetupTransferState(incoming),
    changeCount: groups.reduce((total, item) => total + item.changeCount, 0),
    groups,
    includedScope: SETUP_FILE_INCLUDED_SCOPE,
    excludedScope: SETUP_FILE_EXCLUDED_SCOPE
  };
}

export function setupFileReviewMatchesCurrent(
  review: SetupTransferChangeReview,
  current: SavedSetupState
): boolean {
  return review.currentFingerprint === fingerprintSetupTransferState(current);
}

export function setupFormPhysicalLeafPaths(): readonly string[] {
  const loadoutPaths = (prefix: string) => [
    `${prefix}.weaponId`,
    `${prefix}.ammoId`,
    `${prefix}.spellId`,
    `${prefix}.styleId`,
    ...EQUIPMENT_SLOTS.map((slot) => `${prefix}.gear.${slot}`),
    `${prefix}.prayers`,
    `${prefix}.boosts`,
    `${prefix}.sustained`,
    `${prefix}.repotThreshold`,
    ...Object.keys(SETUP_SPECIAL_ATTACK_FIELD_LABELS).map(
      (key) => `${prefix}.specialAttack.${key}`
    ),
    ...Object.keys(SETUP_MANUAL_OVERRIDE_FIELD_LABELS).map(
      (key) => `${prefix}.manualOverrides.${key}`
    )
  ];
  return [
    "combatStyle",
    "monsterId",
    ...loadoutPaths("").map((path) => path.replace(/^\./, "")),
    ...Object.keys(SETUP_LEVEL_FIELD_LABELS).map((key) => `levels.${key}`),
    ...COMBAT_STYLES.flatMap((style) => loadoutPaths(`perStyleLoadouts.${style}`)),
    "ringOfWealth",
    ...Object.keys(SETUP_TRIP_FIELD_LABELS).map((key) => `trip.${key}`),
    ...Object.keys(SETUP_PLANNER_TARGET_FIELD_LABELS).map((key) => `plannerTargets.${key}`)
  ];
}

export function setupFormSemanticFieldIds(idPrefix: string): readonly string[] {
  const loadoutIds = (style: (typeof COMBAT_STYLES)[number]) => [
    `${idPrefix}-${style}-weaponId`,
    `${idPrefix}-${style}-ammoId`,
    `${idPrefix}-${style}-spellId`,
    `${idPrefix}-${style}-styleId`,
    ...EQUIPMENT_SLOTS.map((slot) => `${idPrefix}-${style}-gear-${slot}`),
    `${idPrefix}-${style}-prayers`,
    `${idPrefix}-${style}-boosts`,
    `${idPrefix}-${style}-sustained`,
    `${idPrefix}-${style}-repotThreshold`,
    ...Object.keys(SETUP_SPECIAL_ATTACK_FIELD_LABELS).map(
      (key) => `${idPrefix}-${style}-special-${key}`
    ),
    ...Object.keys(SETUP_MANUAL_OVERRIDE_FIELD_LABELS).map(
      (key) => `${idPrefix}-${style}-manual-${key}`
    )
  ];
  return [
    `${idPrefix}-monsterId`,
    `${idPrefix}-combatStyle`,
    ...Object.keys(SETUP_LEVEL_FIELD_LABELS).map((key) => `${idPrefix}-level-${key}`),
    ...COMBAT_STYLES.flatMap(loadoutIds),
    `${idPrefix}-ringOfWealth`,
    ...Object.keys(SETUP_TRIP_FIELD_LABELS).map((key) => `${idPrefix}-trip-${key}`),
    ...Object.keys(SETUP_PLANNER_TARGET_FIELD_LABELS).map((key) => `${idPrefix}-planner-${key}`)
  ];
}

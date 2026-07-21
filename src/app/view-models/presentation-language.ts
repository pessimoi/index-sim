export type EntityDisplayLabelSource = "game-data" | "row-source" | "fallback";

export interface EntityDisplayLabel {
  name: string;
  technicalId: string | null;
  source: EntityDisplayLabelSource;
}

export type EntityCatalogKind = "item" | "monster";

type NamedEntityCatalog = Readonly<Record<string, { name: string }>>;

export interface EntityCollisionCatalog {
  items?: NamedEntityCatalog;
  monsters?: NamedEntityCatalog;
}

export interface EntityCollisionIndex {
  item: ReadonlyMap<string, readonly string[]>;
  monster: ReadonlyMap<string, readonly string[]>;
}

const REVIEWED_ENTITY_DESCRIPTORS = {
  loop_half_key: "loop half",
  tooth_half_key: "tooth half",
  dragonhide_black: "black",
  dragonhide_blue: "blue",
  dragonhide_green: "green",
  dragonhide_red: "red"
} as const satisfies Readonly<Record<string, string>>;

export type ReviewedEntityDescriptorId = keyof typeof REVIEWED_ENTITY_DESCRIPTORS;

export const ENTITY_SEMANTIC_DESCRIPTORS: Readonly<Record<ReviewedEntityDescriptorId, string>> =
  REVIEWED_ENTITY_DESCRIPTORS;

export function normalizeEntityCollisionName(name: string): string {
  return name.trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function collisionGroups(catalog: NamedEntityCatalog | undefined): ReadonlyMap<string, string[]> {
  const indexed = new Map<string, string[]>();
  for (const [id, entity] of Object.entries(catalog ?? {})) {
    const normalizedName = normalizeEntityCollisionName(entity.name);
    if (!normalizedName) continue;
    const ids = indexed.get(normalizedName);
    if (ids) ids.push(id);
    else indexed.set(normalizedName, [id]);
  }
  return indexed;
}

export function createEntityCollisionIndex(catalog: EntityCollisionCatalog): EntityCollisionIndex {
  return {
    item: collisionGroups(catalog.items),
    monster: collisionGroups(catalog.monsters)
  };
}

function disambiguateEntityName(input: {
  baseName: string;
  technicalId: string | null;
  collisionIndex?: EntityCollisionIndex;
  entityKind?: EntityCatalogKind;
}): string {
  if (!input.technicalId || !input.collisionIndex || !input.entityKind) return input.baseName;
  const collisionIds = input.collisionIndex[input.entityKind].get(
    normalizeEntityCollisionName(input.baseName)
  );
  if (!collisionIds || collisionIds.length < 2 || !collisionIds.includes(input.technicalId)) {
    return input.baseName;
  }
  const descriptor = ENTITY_SEMANTIC_DESCRIPTORS[input.technicalId as ReviewedEntityDescriptorId];
  return `${input.baseName} — ${descriptor ?? `ID ${input.technicalId}`}`;
}

export function humanizeTechnicalId(technicalId: string): string {
  const words = technicalId.replaceAll("_", " ").trim().replace(/\s+/g, " ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Unknown item";
}

export function createEntityDisplayLabel(input: {
  technicalId: string | null;
  gameDataName?: string | null;
  rowSourceName?: string | null;
  collisionIndex?: EntityCollisionIndex;
  entityKind?: EntityCatalogKind;
}): EntityDisplayLabel {
  const gameDataName = input.gameDataName?.trim();
  if (gameDataName) {
    return {
      name: disambiguateEntityName({ ...input, baseName: gameDataName }),
      technicalId: input.technicalId,
      source: "game-data"
    };
  }
  const rowSourceName = input.rowSourceName?.trim();
  if (rowSourceName) {
    return {
      name: disambiguateEntityName({ ...input, baseName: rowSourceName }),
      technicalId: input.technicalId,
      source: "row-source"
    };
  }
  return {
    name: input.technicalId ? humanizeTechnicalId(input.technicalId) : "Unknown item",
    technicalId: input.technicalId,
    source: "fallback"
  };
}

export interface RowCollisionLabelInput {
  stableId: string;
  baseLabel: string;
  sourceOrder: number;
  quantityLabel?: string | null;
  chanceLabel?: string | null;
}

export function createRowCollisionLabels(
  rows: readonly RowCollisionLabelInput[]
): ReadonlyMap<string, string> {
  const labels = new Map(rows.map((row) => [row.stableId, row.baseLabel]));
  const groups = new Map<string, RowCollisionLabelInput[]>();
  for (const row of rows) {
    const key = normalizeEntityCollisionName(row.baseLabel);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  for (const sourceGroup of groups.values()) {
    if (sourceGroup.length < 2) continue;
    const group = [...sourceGroup].sort(
      (left, right) =>
        left.sourceOrder - right.sourceOrder || left.stableId.localeCompare(right.stableId)
    );
    const candidates = group.map((row) => {
      const context = [
        row.quantityLabel ? `qty ${row.quantityLabel}` : null,
        row.chanceLabel ? `chance ${row.chanceLabel}` : null
      ].filter((value): value is string => value !== null);
      return `${row.baseLabel}${context.length ? ` — ${context.join(" · ")}` : ""}`;
    });
    const candidateCounts = new Map<string, number>();
    for (const candidate of candidates) {
      const key = normalizeEntityCollisionName(candidate);
      candidateCounts.set(key, (candidateCounts.get(key) ?? 0) + 1);
    }
    group.forEach((row, index) => {
      const candidate = candidates[index]!;
      labels.set(
        row.stableId,
        candidateCounts.get(normalizeEntityCollisionName(candidate))! > 1
          ? `${candidate} · row ${index + 1}`
          : candidate
      );
    });
  }
  return labels;
}

export const COMPACT_ACCESSIBLE_LABELS: Readonly<Record<string, string>> = {
  HP: "Hitpoints",
  ACC: "Accuracy",
  "ACC+": "Accuracy bonus",
  "M+%": "Magic accuracy percentage bonus",
  DMG: "Damage",
  "DMG+": "Damage bonus",
  "DMG%": "Magic damage percentage bonus",
  SPD: "Attack speed in seconds",
  "HIT %": "Hit chance percentage",
  MAX: "Maximum hit",
  "MAX HIT": "Maximum hit",
  DPS: "Damage per second",
  TTK: "Time to kill",
  "EFF. K/HR": "Effective kills per hour",
  "XP/hr": "Experience points per hour",
  "EFF. XP/HR": "Effective experience points per hour",
  "GP/KL": "Gold pieces per kill",
  "GP/KILL": "Gold pieces per kill",
  "GP/kill": "Gold pieces per kill",
  "EFF. GP/HR": "Effective gross gold pieces per hour",
  "EFF. NET GP/HR": "Effective net gold pieces per hour",
  "SUPPLY/KILL": "Supply cost per kill",
  "F/KL": "Food per kill",
  "EV/kill": "Expected value per kill",
  "Delta/hr": "Net gold pieces change per hour",
  Qty: "Quantity"
};

export function expandedCompactLabel(label: string): string | null {
  return COMPACT_ACCESSIBLE_LABELS[label] ?? null;
}

export type SemanticUnit = "second" | "minute" | "tick" | "hour" | "day" | "gp" | "xp";

export interface SemanticUnitValue {
  visible: string;
  accessible: string;
}

export function formatSemanticUnitValue(
  formattedValue: string,
  numericValue: number,
  unit: SemanticUnit
): SemanticUnitValue {
  const singular = numericValue === 1;
  if (unit === "second") {
    return {
      visible: `${formattedValue} s`,
      accessible: `${formattedValue} ${singular ? "second" : "seconds"}`
    };
  }
  if (unit === "minute") {
    return {
      visible: `${formattedValue} min`,
      accessible: `${formattedValue} ${singular ? "minute" : "minutes"}`
    };
  }
  if (unit === "tick") {
    return {
      visible: `${formattedValue} ${singular ? "tick" : "ticks"}`,
      accessible: `${formattedValue} ${singular ? "game tick" : "game ticks"}`
    };
  }
  if (unit === "hour") {
    return {
      visible: `${formattedValue} hr`,
      accessible: `${formattedValue} ${singular ? "hour" : "hours"}`
    };
  }
  if (unit === "day") {
    return {
      visible: `${formattedValue} ${singular ? "day" : "days"}`,
      accessible: `${formattedValue} ${singular ? "day" : "days"}`
    };
  }
  if (unit === "gp") {
    return { visible: `${formattedValue} GP`, accessible: `${formattedValue} gold pieces` };
  }
  return {
    visible: `${formattedValue} XP`,
    accessible: `${formattedValue} experience points`
  };
}

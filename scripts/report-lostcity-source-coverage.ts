import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import { parseGameDataSnapshot } from "../src/data/schemas/game-data";
import {
  EQUIPMENT_SLOTS,
  type DropEntry,
  type EntityId,
  type AmmoDefinition,
  type EquipmentItemDefinition,
  type GameDataSnapshot,
  type SpellDefinition,
  type WeaponDefinition
} from "../src/domain/shared";
import { resolveCanonicalItemId } from "../src/domain/economy/canonical-item-id";
import {
  readLostCityConfigCatalog,
  resolvedConfigParamValue,
  type LostCityConfigCatalog
} from "./lostcity-content-config";
import {
  readLostCityLootHandlerCatalog,
  resolveLostCityLootHandler
} from "./lostcity-content-loot";
import { extractLostCityMonsterLootSource } from "./lostcity-content-loot-extractor";
import {
  LOSTCITY_EQUIPMENT_COMPARISON_FIELDS,
  extractLostCityEquipmentSource
} from "./lostcity-content-equipment";
import {
  LOSTCITY_AMMO_COMPARISON_FIELDS,
  LOSTCITY_WEAPON_COMPARISON_FIELDS,
  extractLostCityAmmoSource,
  extractLostCityWeaponSource
} from "./lostcity-content-combat-catalog";
import {
  LOSTCITY_SPELL_COMPARISON_FIELDS,
  extractLostCitySpellSource
} from "./lostcity-content-spells";
import {
  LOSTCITY_EQUIPMENT_SOURCE_MAPPINGS,
  LOSTCITY_MONSTER_SOURCE_MAPPINGS,
  LOSTCITY_SYNTHETIC_RUNTIME_ITEM_IDS,
  LOSTCITY_WEAPON_SOURCE_MAPPINGS,
  lostCitySourceItemId
} from "./lostcity-content-runtime-mapping";
import {
  LOSTCITY_MONSTER_COMBAT_FIELDS,
  extractLostCityMonsterCombatSource
} from "./lostcity-content-monsters";
import { lostCityMonsterSourceId } from "./lostcity-content-runtime-mapping";

export interface LostCitySourceCoverageSection {
  section: "monsters" | "items" | "weapons" | "ammo" | "spells" | "equipment";
  referenceCount: number;
  directCount: number;
  mappedCount: number;
  mappedExamples: string[];
  syntheticCount: number;
  syntheticExamples: EntityId[];
  unresolvedCount: number;
  unresolvedIds: EntityId[];
  unresolvedExamples: EntityId[];
}

export interface LostCitySourceCoverageReport {
  sourceDir: string;
  sourceRevision: string;
  catalogs: {
    npcFiles: number;
    npcEntries: number;
    objFiles: number;
    objEntries: number;
    dbrowFiles: number;
    dbrowEntries: number;
    paramFiles: number;
    paramEntries: number;
  };
  sections: LostCitySourceCoverageSection[];
  equipmentFields: {
    referenceCount: number;
    exactCount: number;
    differingCount: number;
    differingIds: EntityId[];
    differingExamples: string[];
    differenceCounts: Record<string, number>;
  };
  weaponFields: {
    referenceCount: number;
    exactCount: number;
    differingCount: number;
    differingIds: EntityId[];
    differingExamples: string[];
    differenceCounts: Record<string, number>;
  };
  ammoFields: {
    referenceCount: number;
    exactCount: number;
    differingCount: number;
    differingIds: EntityId[];
    differingExamples: string[];
    differenceCounts: Record<string, number>;
  };
  spellFields: {
    referenceCount: number;
    exactCount: number;
    differingCount: number;
    differingIds: EntityId[];
    differingExamples: string[];
    differenceCounts: Record<string, number>;
  };
  monsterCombatFields: {
    referenceCount: number;
    exactCount: number;
    differingCount: number;
    differingIds: EntityId[];
    differingExamples: string[];
    differenceCounts: Record<string, number>;
  };
  monsterLootOwnership: {
    runeScriptFiles: number;
    handlers: number;
    runtimeMonsters: number;
    dedicatedHandlerCount: number;
    directHandlerCount: number;
    categoryHandlerCount: number;
    defaultDropCount: number;
    handlerAndDefaultDropCount: number;
    noDeclaredDropCount: number;
    noDeclaredDropIds: EntityId[];
    noDeclaredDropExamples: EntityId[];
  };
  monsterLootExtraction: {
    completeCount: number;
    partialCount: number;
    unsupportedCount: number;
    extractedDropEntryCount: number;
    issueCounts: Record<string, number>;
    issueExamples: Record<string, string[]>;
    exclusionCounts: Record<string, number>;
    exclusionExamples: Record<string, string[]>;
    partialExamples: string[];
    unsupportedExamples: string[];
  };
  monsterLootComparison: {
    exactCount: number;
    differingCount: number;
    referenceDropEntryCount: number;
    sourceDropEntryCount: number;
    differingIds: EntityId[];
    differingExamples: string[];
    displayNameExactCount: number;
    displayNameDifferingCount: number;
    displayNameDifferingExamples: string[];
  };
  monsterLootItemKeys: {
    sourceKeyCount: number;
    referenceCoveredCount: number;
    sourceOnlyDefinedCount: number;
    sourceOnlyDefinedKeys: EntityId[];
    sourceOnlyDefinedExamples: EntityId[];
    unresolvedCount: number;
    unresolvedKeys: EntityId[];
    unresolvedExamples: EntityId[];
  };
}

export interface CreateLostCitySourceCoverageReportOptions {
  sourceDir: string;
  reference: GameDataSnapshot;
  repoRoot?: string;
  sourceRevision?: string;
  exampleLimit?: number;
}

export interface LostCitySourceCoverageCliOptions {
  sourceDir: string;
  format: "markdown" | "json";
  exampleLimit: number;
}

function uniqueSorted(values: EntityId[]): EntityId[] {
  return [...new Set(values)].sort();
}

function directSection(
  section: LostCitySourceCoverageSection["section"],
  referenceIds: EntityId[],
  sourceIds: Set<EntityId>,
  exampleLimit: number,
  mappings: Readonly<Record<EntityId, { sourceId: EntityId }>> = {},
  syntheticIds: ReadonlySet<EntityId> = new Set()
): LostCitySourceCoverageSection {
  const ids = uniqueSorted(referenceIds);
  const directIds = ids.filter((id) => sourceIds.has(id) && !syntheticIds.has(id));
  const mappedIds = ids.filter(
    (id) => !sourceIds.has(id) && !!mappings[id] && sourceIds.has(mappings[id].sourceId)
  );
  const coveredSyntheticIds = ids.filter((id) => syntheticIds.has(id));
  const coveredIds = new Set([...directIds, ...mappedIds, ...coveredSyntheticIds]);
  const unresolvedIds = ids.filter((id) => !coveredIds.has(id));
  return {
    section,
    referenceCount: ids.length,
    directCount: directIds.length,
    mappedCount: mappedIds.length,
    mappedExamples: mappedIds
      .slice(0, exampleLimit)
      .map((runtimeId) => `${runtimeId}->${mappings[runtimeId].sourceId}`),
    syntheticCount: coveredSyntheticIds.length,
    syntheticExamples: coveredSyntheticIds.slice(0, exampleLimit),
    unresolvedCount: unresolvedIds.length,
    unresolvedIds,
    unresolvedExamples: unresolvedIds.slice(0, exampleLimit)
  };
}

function normalizedEntityName(name: string | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/\s*[x×]\s*\d+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueObjectNameMappings(
  runtimeIds: EntityId[],
  runtimeName: (runtimeId: EntityId) => string | undefined,
  objects: LostCityConfigCatalog
): Record<EntityId, { sourceId: EntityId }> {
  const sourceIdsByName = new Map<string, EntityId[]>();
  for (const [sourceId, entry] of objects.entries) {
    const name = normalizedEntityName(entry.properties.name?.at(-1));
    if (!name) continue;
    sourceIdsByName.set(name, [...(sourceIdsByName.get(name) ?? []), sourceId]);
  }
  return Object.fromEntries(
    runtimeIds.flatMap((runtimeId) => {
      if (objects.entries.has(runtimeId)) return [];
      const name = normalizedEntityName(runtimeName(runtimeId));
      const matches = sourceIdsByName.get(name) ?? [];
      return matches.length === 1 ? [[runtimeId, { sourceId: matches[0] }]] : [];
    })
  );
}

function equipmentIds(snapshot: GameDataSnapshot): EntityId[] {
  return Object.entries(snapshot.equipment).flatMap(([slot, entries]) =>
    Object.keys(entries).map((itemId) => `${slot}:${itemId}`)
  );
}

function equipmentSourceIds(catalog: LostCityConfigCatalog): Set<EntityId> {
  const ids = new Set<EntityId>();
  for (const id of catalog.entries.keys()) {
    for (const slot of [
      "helm",
      "amulet",
      "body",
      "legs",
      "shield",
      "gloves",
      "boots",
      "cape",
      "ring"
    ] as const) {
      ids.add(`${slot}:${id}`);
    }
  }
  return ids;
}

function comparableEquipmentField(
  definition: EquipmentItemDefinition,
  field: (typeof LOSTCITY_EQUIPMENT_COMPARISON_FIELDS)[number]
): number | boolean {
  if (field === "recoil") return definition.recoil ?? false;
  return definition[field] ?? 0;
}

function comparableWeaponField(
  definition: WeaponDefinition,
  field: (typeof LOSTCITY_WEAPON_COMPARISON_FIELDS)[number]
): string | number | boolean | null {
  if (field.startsWith("acc.")) {
    const attackType = field.slice("acc.".length) as "stab" | "slash" | "crush";
    return definition.acc?.[attackType] ?? 0;
  }
  if (field === "twoHand") return definition.twoHand ?? false;
  if (["accBonus", "dmgBonus", "speed", "poisonSeverity", "alch"].includes(field)) {
    return (definition as unknown as Record<string, number | undefined>)[field] ?? 0;
  }
  const value = (definition as unknown as Record<string, string | number | boolean | undefined>)[
    field
  ];
  return value ?? null;
}

function comparableAmmoField(
  definition: AmmoDefinition,
  field: (typeof LOSTCITY_AMMO_COMPARISON_FIELDS)[number]
): string | number | null {
  if (["rangeBonus", "tier", "alch", "price"].includes(field)) {
    return (definition[field] as number | undefined) ?? 0;
  }
  const value = definition[field];
  return value ?? null;
}

function comparableSpellField(
  definition: SpellDefinition,
  field: (typeof LOSTCITY_SPELL_COMPARISON_FIELDS)[number]
): string | number | boolean | null {
  if (field === "runes") {
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(definition.runes ?? {}).sort(([left], [right]) => left.localeCompare(right))
      )
    );
  }
  if (field === "god") return definition.god ?? false;
  const value = definition[field];
  return value ?? null;
}

export function resolveLostCitySourceRevision(sourceDir: string): string {
  try {
    return execFileSync("git", ["-C", sourceDir, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "unresolved-revision";
  }
}

type ComparableDrop =
  { key?: string; tag?: string; chance: number; qtyAvg: number } | ComparableDrop[];

function comparableDrop(entry: DropEntry): ComparableDrop {
  if (Array.isArray(entry)) {
    const nested = entry.map(comparableDrop);
    return nested.length === 1 ? nested[0] : nested;
  }
  return {
    ...(entry.key ? { key: entry.key } : {}),
    ...(entry.tag ? { tag: entry.tag } : {}),
    chance: Number(entry.chance.toFixed(5)),
    qtyAvg: entry.qtyAvg
  };
}

function firstLootMismatch(reference: ComparableDrop[], source: ComparableDrop[]): string {
  const count = Math.max(reference.length, source.length);
  for (let index = 0; index < count; index += 1) {
    if (JSON.stringify(reference[index]) === JSON.stringify(source[index])) continue;
    const referenceRow = reference[index] ? JSON.stringify(reference[index]) : "missing";
    const sourceRow = source[index] ? JSON.stringify(source[index]) : "missing";
    return `row ${index + 1}: reference=${referenceRow}, source=${sourceRow}`;
  }
  return "row content differs";
}

function comparableLoot(entries: DropEntry[]): ComparableDrop[] {
  return entries
    .map(comparableDrop)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function namedDrop(entry: DropEntry): unknown {
  if (Array.isArray(entry)) {
    const nested = entry.map(namedDrop);
    return nested.length === 1 ? nested[0] : nested;
  }
  return { ...comparableDrop(entry), name: entry.name };
}

function namedLoot(entries: DropEntry[]): unknown[] {
  return entries
    .map(namedDrop)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function dropKeys(entry: DropEntry): EntityId[] {
  return Array.isArray(entry) ? entry.flatMap(dropKeys) : entry.key ? [entry.key] : [];
}

export function createLostCitySourceCoverageReport(
  options: CreateLostCitySourceCoverageReportOptions
): LostCitySourceCoverageReport {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const exampleLimit = options.exampleLimit ?? 10;
  const npc = readLostCityConfigCatalog({
    repoRoot,
    sourceDir: options.sourceDir,
    extension: ".npc"
  });
  const obj = readLostCityConfigCatalog({
    repoRoot,
    sourceDir: options.sourceDir,
    extension: ".obj"
  });
  const dbrow = readLostCityConfigCatalog({
    repoRoot,
    sourceDir: options.sourceDir,
    extension: ".dbrow"
  });
  const params = readLostCityConfigCatalog({
    repoRoot,
    sourceDir: options.sourceDir,
    extension: ".param"
  });
  const lootHandlers = readLostCityLootHandlerCatalog({
    repoRoot,
    sourceDir: options.sourceDir
  });
  const npcIds = new Set(npc.entries.keys());
  const objIds = new Set(obj.entries.keys());
  const spellIds = new Set(
    [...dbrow.entries.keys()]
      .filter((id) => id.startsWith("magic_spell_"))
      .map((id) => id.slice("magic_spell_".length))
  );
  const itemNameMappings = uniqueObjectNameMappings(
    Object.keys(options.reference.items),
    (itemId) => options.reference.items[itemId]?.name,
    obj
  );
  const itemExplicitMappings = Object.fromEntries(
    Object.keys(options.reference.items).flatMap((runtimeId) => {
      const sourceItemId = lostCitySourceItemId(runtimeId);
      return sourceItemId === runtimeId ? [] : [[runtimeId, { sourceId: sourceItemId }]];
    })
  );
  for (const [equipmentId, mapping] of Object.entries(LOSTCITY_EQUIPMENT_SOURCE_MAPPINGS)) {
    const runtimeItemId = equipmentId.slice(equipmentId.indexOf(":") + 1);
    if (options.reference.items[runtimeItemId]) {
      itemExplicitMappings[runtimeItemId] = { sourceId: mapping.sourceItemId };
    }
  }
  const syntheticItemIds = new Set(
    [...LOSTCITY_SYNTHETIC_RUNTIME_ITEM_IDS].filter(
      (runtimeId) => !!options.reference.items[runtimeId]
    )
  );
  const weaponNameMappings = uniqueObjectNameMappings(
    Object.keys(options.reference.weapons),
    (itemId) => options.reference.weapons[itemId]?.name,
    obj
  );
  const ammoNameMappings = uniqueObjectNameMappings(
    Object.keys(options.reference.ammo),
    (itemId) => options.reference.ammo[itemId]?.name,
    obj
  );
  const equipmentNameMappings = Object.fromEntries(
    Object.entries(options.reference.equipment).flatMap(([slot, entries]) => {
      const mappings = uniqueObjectNameMappings(
        Object.keys(entries),
        (itemId) => entries[itemId]?.name,
        obj
      );
      return Object.entries(mappings).map(([runtimeId, mapping]) => [
        `${slot}:${runtimeId}`,
        { sourceId: `${slot}:${mapping.sourceId}` }
      ]);
    })
  );
  const equipmentExplicitMappings = Object.fromEntries(
    Object.entries(LOSTCITY_EQUIPMENT_SOURCE_MAPPINGS).map(([runtimeId, mapping]) => {
      const slot = runtimeId.split(":", 1)[0];
      return [runtimeId, { sourceId: `${slot}:${mapping.sourceItemId}` }];
    })
  );
  const syntheticEquipmentIds = new Set(
    Object.keys(options.reference.equipment).map((slot) => `${slot}:none`)
  );
  const equipmentDifferences = EQUIPMENT_SLOTS.flatMap((slot) =>
    Object.entries(options.reference.equipment[slot]).flatMap(([runtimeId, reference]) => {
      const source = extractLostCityEquipmentSource({
        slot,
        runtimeId,
        runtime: reference,
        objects: obj
      });
      const fields = LOSTCITY_EQUIPMENT_COMPARISON_FIELDS.filter(
        (field) =>
          comparableEquipmentField(reference, field) !==
          comparableEquipmentField(source.definition, field)
      );
      return fields.length ? [{ runtimeId: `${slot}:${runtimeId}`, fields }] : [];
    })
  );
  const weaponDifferences = Object.entries(options.reference.weapons).flatMap(
    ([runtimeId, reference]) => {
      const source = extractLostCityWeaponSource({
        runtimeId,
        runtime: reference,
        objects: obj,
        params
      });
      const fields = LOSTCITY_WEAPON_COMPARISON_FIELDS.filter(
        (field) => comparableWeaponField(reference, field) !== comparableWeaponField(source, field)
      );
      return fields.length ? [{ runtimeId, fields }] : [];
    }
  );
  const ammoDifferences = Object.entries(options.reference.ammo).flatMap(
    ([runtimeId, reference]) => {
      const source = extractLostCityAmmoSource({ runtimeId, runtime: reference, objects: obj });
      const fields = LOSTCITY_AMMO_COMPARISON_FIELDS.filter(
        (field) => comparableAmmoField(reference, field) !== comparableAmmoField(source, field)
      );
      return fields.length ? [{ runtimeId, fields }] : [];
    }
  );
  const spellDifferences = Object.entries(options.reference.spells).flatMap(
    ([runtimeId, reference]) => {
      const source = extractLostCitySpellSource({ runtimeId, runtime: reference, dbrows: dbrow });
      const fields = LOSTCITY_SPELL_COMPARISON_FIELDS.filter(
        (field) => comparableSpellField(reference, field) !== comparableSpellField(source, field)
      );
      return fields.length ? [{ runtimeId, fields }] : [];
    }
  );
  const monsterDifferences = Object.entries(options.reference.monsters).flatMap(
    ([runtimeId, referenceMonster]) => {
      const source = extractLostCityMonsterCombatSource(runtimeId, npc);
      const fields = LOSTCITY_MONSTER_COMBAT_FIELDS.filter(
        (field) => referenceMonster[field] !== source.fields[field]
      );
      return fields.length ? [{ runtimeId, fields }] : [];
    }
  );
  const monsterLootOwnership = Object.keys(options.reference.monsters).map((runtimeId) => {
    const sourceId = lostCityMonsterSourceId(runtimeId);
    const sourceEntry = npc.entries.get(sourceId);
    const handler = resolveLostCityLootHandler(sourceId, sourceEntry, lootHandlers);
    return {
      runtimeId,
      handlerKind: handler?.kind,
      hasHandler: handler !== undefined,
      hasDefaultDrop: resolvedConfigParamValue(sourceEntry, params, "death_drop") !== undefined
    };
  });
  const noDeclaredDropIds = monsterLootOwnership
    .filter((entry) => !entry.hasHandler && !entry.hasDefaultDrop)
    .map((entry) => entry.runtimeId);
  const monsterLootExtractions = Object.keys(options.reference.monsters).map((runtimeId) =>
    extractLostCityMonsterLootSource({
      runtimeId,
      npcs: npc,
      objects: obj,
      params,
      handlers: lootHandlers
    })
  );
  const issueCounts = new Map<string, number>();
  const issueExamples = new Map<string, string[]>();
  const exclusionCounts = new Map<string, number>();
  const exclusionExamples = new Map<string, string[]>();
  for (const extraction of monsterLootExtractions) {
    for (const issue of extraction.issues) {
      issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1);
      const examples = issueExamples.get(issue.code) ?? [];
      if (examples.length < exampleLimit) {
        examples.push(`${extraction.runtimeId}: ${issue.message}`);
        issueExamples.set(issue.code, examples);
      }
    }
    for (const exclusion of extraction.exclusions) {
      exclusionCounts.set(exclusion.code, (exclusionCounts.get(exclusion.code) ?? 0) + 1);
      const examples = exclusionExamples.get(exclusion.code) ?? [];
      if (examples.length < exampleLimit) {
        examples.push(`${extraction.runtimeId}: ${exclusion.message}`);
        exclusionExamples.set(exclusion.code, examples);
      }
    }
  }
  const monsterLootDifferences = monsterLootExtractions.flatMap((extraction) => {
    const referenceLoot = comparableLoot(
      options.reference.monsters[extraction.runtimeId]?.loot ?? []
    );
    const sourceLoot = comparableLoot(extraction.loot);
    return JSON.stringify(referenceLoot) === JSON.stringify(sourceLoot)
      ? []
      : [
          {
            runtimeId: extraction.runtimeId,
            referenceCount: referenceLoot.length,
            sourceCount: sourceLoot.length,
            firstMismatch: firstLootMismatch(referenceLoot, sourceLoot)
          }
        ];
  });
  const monsterLootDisplayDifferences = monsterLootExtractions.flatMap((extraction) => {
    const referenceLoot = namedLoot(options.reference.monsters[extraction.runtimeId]?.loot ?? []);
    const sourceLoot = namedLoot(extraction.loot);
    return JSON.stringify(referenceLoot) === JSON.stringify(sourceLoot)
      ? []
      : [
          {
            runtimeId: extraction.runtimeId,
            firstMismatch: firstLootMismatch(
              referenceLoot as ComparableDrop[],
              sourceLoot as ComparableDrop[]
            )
          }
        ];
  });
  const sourceLootKeys = uniqueSorted(
    monsterLootExtractions.flatMap((extraction) => extraction.loot.flatMap(dropKeys))
  );
  const referenceCoveredLootKeys = sourceLootKeys.filter(
    (itemId) => !!options.reference.items[resolveCanonicalItemId(itemId).canonicalItemId]
  );
  const sourceOnlyDefinedLootKeys = sourceLootKeys.filter(
    (itemId) =>
      !options.reference.items[resolveCanonicalItemId(itemId).canonicalItemId] &&
      obj.entries.has(lostCitySourceItemId(itemId))
  );
  const unresolvedLootKeys = sourceLootKeys.filter(
    (itemId) =>
      !options.reference.items[resolveCanonicalItemId(itemId).canonicalItemId] &&
      !obj.entries.has(lostCitySourceItemId(itemId))
  );

  return {
    sourceDir: npc.sourceDirLabel,
    sourceRevision:
      options.sourceRevision ?? resolveLostCitySourceRevision(resolve(repoRoot, options.sourceDir)),
    catalogs: {
      npcFiles: npc.fileCount,
      npcEntries: npc.entries.size,
      objFiles: obj.fileCount,
      objEntries: obj.entries.size,
      dbrowFiles: dbrow.fileCount,
      dbrowEntries: dbrow.entries.size,
      paramFiles: params.fileCount,
      paramEntries: params.entries.size
    },
    sections: [
      directSection(
        "monsters",
        Object.keys(options.reference.monsters),
        npcIds,
        exampleLimit,
        LOSTCITY_MONSTER_SOURCE_MAPPINGS
      ),
      directSection(
        "items",
        Object.keys(options.reference.items),
        objIds,
        exampleLimit,
        { ...itemNameMappings, ...itemExplicitMappings },
        syntheticItemIds
      ),
      directSection("weapons", Object.keys(options.reference.weapons), objIds, exampleLimit, {
        ...weaponNameMappings,
        ...LOSTCITY_WEAPON_SOURCE_MAPPINGS
      }),
      directSection(
        "ammo",
        Object.keys(options.reference.ammo),
        objIds,
        exampleLimit,
        ammoNameMappings
      ),
      directSection("spells", Object.keys(options.reference.spells), spellIds, exampleLimit),
      directSection(
        "equipment",
        equipmentIds(options.reference),
        equipmentSourceIds(obj),
        exampleLimit,
        { ...equipmentNameMappings, ...equipmentExplicitMappings },
        syntheticEquipmentIds
      )
    ],
    equipmentFields: {
      referenceCount: equipmentIds(options.reference).length,
      exactCount: equipmentIds(options.reference).length - equipmentDifferences.length,
      differingCount: equipmentDifferences.length,
      differingIds: equipmentDifferences.map((difference) => difference.runtimeId),
      differingExamples: equipmentDifferences
        .slice(0, exampleLimit)
        .map((difference) => `${difference.runtimeId} (${difference.fields.join(", ")})`),
      differenceCounts: Object.fromEntries(
        LOSTCITY_EQUIPMENT_COMPARISON_FIELDS.map((field) => [
          field,
          equipmentDifferences.filter((difference) => difference.fields.includes(field)).length
        ])
      )
    },
    weaponFields: {
      referenceCount: Object.keys(options.reference.weapons).length,
      exactCount: Object.keys(options.reference.weapons).length - weaponDifferences.length,
      differingCount: weaponDifferences.length,
      differingIds: weaponDifferences.map((difference) => difference.runtimeId),
      differingExamples: weaponDifferences
        .slice(0, exampleLimit)
        .map((difference) => `${difference.runtimeId} (${difference.fields.join(", ")})`),
      differenceCounts: Object.fromEntries(
        LOSTCITY_WEAPON_COMPARISON_FIELDS.map((field) => [
          field,
          weaponDifferences.filter((difference) => difference.fields.includes(field)).length
        ])
      )
    },
    ammoFields: {
      referenceCount: Object.keys(options.reference.ammo).length,
      exactCount: Object.keys(options.reference.ammo).length - ammoDifferences.length,
      differingCount: ammoDifferences.length,
      differingIds: ammoDifferences.map((difference) => difference.runtimeId),
      differingExamples: ammoDifferences
        .slice(0, exampleLimit)
        .map((difference) => `${difference.runtimeId} (${difference.fields.join(", ")})`),
      differenceCounts: Object.fromEntries(
        LOSTCITY_AMMO_COMPARISON_FIELDS.map((field) => [
          field,
          ammoDifferences.filter((difference) => difference.fields.includes(field)).length
        ])
      )
    },
    spellFields: {
      referenceCount: Object.keys(options.reference.spells).length,
      exactCount: Object.keys(options.reference.spells).length - spellDifferences.length,
      differingCount: spellDifferences.length,
      differingIds: spellDifferences.map((difference) => difference.runtimeId),
      differingExamples: spellDifferences
        .slice(0, exampleLimit)
        .map((difference) => `${difference.runtimeId} (${difference.fields.join(", ")})`),
      differenceCounts: Object.fromEntries(
        LOSTCITY_SPELL_COMPARISON_FIELDS.map((field) => [
          field,
          spellDifferences.filter((difference) => difference.fields.includes(field)).length
        ])
      )
    },
    monsterCombatFields: {
      referenceCount: Object.keys(options.reference.monsters).length,
      exactCount: Object.keys(options.reference.monsters).length - monsterDifferences.length,
      differingCount: monsterDifferences.length,
      differingIds: monsterDifferences.map((difference) => difference.runtimeId),
      differingExamples: monsterDifferences
        .slice(0, exampleLimit)
        .map((difference) => `${difference.runtimeId} (${difference.fields.join(", ")})`),
      differenceCounts: Object.fromEntries(
        LOSTCITY_MONSTER_COMBAT_FIELDS.map((field) => [
          field,
          monsterDifferences.filter((difference) => difference.fields.includes(field)).length
        ])
      )
    },
    monsterLootOwnership: {
      runeScriptFiles: lootHandlers.fileCount,
      handlers: lootHandlers.handlers.size,
      runtimeMonsters: monsterLootOwnership.length,
      dedicatedHandlerCount: monsterLootOwnership.filter((entry) => entry.hasHandler).length,
      directHandlerCount: monsterLootOwnership.filter((entry) => entry.handlerKind === "direct")
        .length,
      categoryHandlerCount: monsterLootOwnership.filter((entry) => entry.handlerKind === "category")
        .length,
      defaultDropCount: monsterLootOwnership.filter((entry) => entry.hasDefaultDrop).length,
      handlerAndDefaultDropCount: monsterLootOwnership.filter(
        (entry) => entry.hasHandler && entry.hasDefaultDrop
      ).length,
      noDeclaredDropCount: noDeclaredDropIds.length,
      noDeclaredDropIds,
      noDeclaredDropExamples: noDeclaredDropIds.slice(0, exampleLimit)
    },
    monsterLootExtraction: {
      completeCount: monsterLootExtractions.filter((entry) => entry.status === "complete").length,
      partialCount: monsterLootExtractions.filter((entry) => entry.status === "partial").length,
      unsupportedCount: monsterLootExtractions.filter((entry) => entry.status === "unsupported")
        .length,
      extractedDropEntryCount: monsterLootExtractions.reduce(
        (count, entry) => count + entry.loot.length,
        0
      ),
      issueCounts: Object.fromEntries([...issueCounts.entries()].sort()),
      issueExamples: Object.fromEntries([...issueExamples.entries()].sort()),
      exclusionCounts: Object.fromEntries([...exclusionCounts.entries()].sort()),
      exclusionExamples: Object.fromEntries([...exclusionExamples.entries()].sort()),
      partialExamples: monsterLootExtractions
        .filter((entry) => entry.status === "partial")
        .slice(0, exampleLimit)
        .map(
          (entry) => `${entry.runtimeId} (${entry.issues.map((issue) => issue.code).join(", ")})`
        ),
      unsupportedExamples: monsterLootExtractions
        .filter((entry) => entry.status === "unsupported")
        .slice(0, exampleLimit)
        .map(
          (entry) => `${entry.runtimeId} (${entry.issues.map((issue) => issue.code).join(", ")})`
        )
    },
    monsterLootComparison: {
      exactCount: monsterLootExtractions.length - monsterLootDifferences.length,
      differingCount: monsterLootDifferences.length,
      referenceDropEntryCount: Object.values(options.reference.monsters).reduce(
        (count, monster) => count + (monster.loot?.length ?? 0),
        0
      ),
      sourceDropEntryCount: monsterLootExtractions.reduce(
        (count, extraction) => count + extraction.loot.length,
        0
      ),
      differingIds: monsterLootDifferences.map((difference) => difference.runtimeId),
      differingExamples: monsterLootDifferences
        .slice(0, exampleLimit)
        .map(
          (difference) =>
            `${difference.runtimeId} (${difference.referenceCount}->${difference.sourceCount}; ${difference.firstMismatch})`
        ),
      displayNameExactCount: monsterLootExtractions.length - monsterLootDisplayDifferences.length,
      displayNameDifferingCount: monsterLootDisplayDifferences.length,
      displayNameDifferingExamples: monsterLootDisplayDifferences
        .slice(0, exampleLimit)
        .map((difference) => `${difference.runtimeId} (${difference.firstMismatch})`)
    },
    monsterLootItemKeys: {
      sourceKeyCount: sourceLootKeys.length,
      referenceCoveredCount: referenceCoveredLootKeys.length,
      sourceOnlyDefinedCount: sourceOnlyDefinedLootKeys.length,
      sourceOnlyDefinedKeys: sourceOnlyDefinedLootKeys,
      sourceOnlyDefinedExamples: sourceOnlyDefinedLootKeys.slice(0, exampleLimit),
      unresolvedCount: unresolvedLootKeys.length,
      unresolvedKeys: unresolvedLootKeys,
      unresolvedExamples: unresolvedLootKeys.slice(0, exampleLimit)
    }
  };
}

function unresolvedExamples(section: LostCitySourceCoverageSection): string {
  if (!section.unresolvedExamples.length) return "-";
  const hidden = section.unresolvedCount - section.unresolvedExamples.length;
  return `${section.unresolvedExamples.join(", ")}${hidden > 0 ? `, +${hidden} more` : ""}`;
}

export function formatLostCitySourceCoverageMarkdown(report: LostCitySourceCoverageReport): string {
  return (
    [
      "# LostCity source coverage audit",
      "",
      `Source: ${report.sourceDir}`,
      `Revision: ${report.sourceRevision}`,
      "Scope: read-only direct, reviewed and simulator-synthetic identity evidence; committed generator output and accepted decisions own runtime truth.",
      "",
      "## Parsed Catalogs",
      "",
      `- NPC: ${report.catalogs.npcEntries} entries from ${report.catalogs.npcFiles} files`,
      `- Obj: ${report.catalogs.objEntries} entries from ${report.catalogs.objFiles} files`,
      `- DB row: ${report.catalogs.dbrowEntries} entries from ${report.catalogs.dbrowFiles} files`,
      `- Param: ${report.catalogs.paramEntries} entries from ${report.catalogs.paramFiles} files`,
      "",
      "## Runtime Id Coverage",
      "",
      "| Section | Reference | Direct | Reviewed mapping | Synthetic | Unresolved | First unresolved ids |",
      "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
      ...report.sections.map(
        (section) =>
          `| ${section.section} | ${section.referenceCount} | ${section.directCount} | ${section.mappedCount} | ${section.syntheticCount} | ${section.unresolvedCount} | ${unresolvedExamples(section)} |`
      ),
      ...report.sections
        .filter((section) => section.mappedExamples.length)
        .map(
          (section) =>
            `- ${section.section} reviewed mappings: ${section.mappedExamples.join(", ")}`
        ),
      ...report.sections
        .filter((section) => section.syntheticExamples.length)
        .map(
          (section) =>
            `- ${section.section} synthetic identities: ${section.syntheticExamples.join(", ")}`
        ),
      "",
      "## Equipment Field Comparison",
      "",
      `- Reference equipment rows: ${report.equipmentFields.referenceCount}`,
      `- Exact source-field matches: ${report.equipmentFields.exactCount}`,
      `- Differing source-field rows: ${report.equipmentFields.differingCount}`,
      `- Differences by field: ${
        Object.entries(report.equipmentFields.differenceCounts)
          .filter(([, count]) => count > 0)
          .map(([field, count]) => `${field}=${count}`)
          .join(", ") || "none"
      }`,
      `- First differences: ${report.equipmentFields.differingExamples.join("; ") || "none"}`,
      "",
      "## Weapon Field Comparison",
      "",
      `- Reference weapon rows: ${report.weaponFields.referenceCount}`,
      `- Exact source-field matches: ${report.weaponFields.exactCount}`,
      `- Differing source-field rows: ${report.weaponFields.differingCount}`,
      `- Differences by field: ${
        Object.entries(report.weaponFields.differenceCounts)
          .filter(([, count]) => count > 0)
          .map(([field, count]) => `${field}=${count}`)
          .join(", ") || "none"
      }`,
      `- First differences: ${report.weaponFields.differingExamples.join("; ") || "none"}`,
      "",
      "## Ammo Field Comparison",
      "",
      `- Reference ammo rows: ${report.ammoFields.referenceCount}`,
      `- Exact source-field matches: ${report.ammoFields.exactCount}`,
      `- Differing source-field rows: ${report.ammoFields.differingCount}`,
      `- Differences by field: ${
        Object.entries(report.ammoFields.differenceCounts)
          .filter(([, count]) => count > 0)
          .map(([field, count]) => `${field}=${count}`)
          .join(", ") || "none"
      }`,
      `- First differences: ${report.ammoFields.differingExamples.join("; ") || "none"}`,
      "",
      "## Spell Field Comparison",
      "",
      `- Reference spell rows: ${report.spellFields.referenceCount}`,
      `- Exact source-field matches: ${report.spellFields.exactCount}`,
      `- Differing source-field rows: ${report.spellFields.differingCount}`,
      `- Differences by field: ${
        Object.entries(report.spellFields.differenceCounts)
          .filter(([, count]) => count > 0)
          .map(([field, count]) => `${field}=${count}`)
          .join(", ") || "none"
      }`,
      `- First differences: ${report.spellFields.differingExamples.join("; ") || "none"}`,
      "",
      "## Monster Combat Field Comparison",
      "",
      `- Reference monsters: ${report.monsterCombatFields.referenceCount}`,
      `- Exact source-field matches: ${report.monsterCombatFields.exactCount}`,
      `- Differing source-field rows: ${report.monsterCombatFields.differingCount}`,
      `- Differences by field: ${
        Object.entries(report.monsterCombatFields.differenceCounts)
          .filter(([, count]) => count > 0)
          .map(([field, count]) => `${field}=${count}`)
          .join(", ") || "none"
      }`,
      `- First differences: ${report.monsterCombatFields.differingExamples.join("; ") || "none"}`,
      "",
      "## Monster Loot Ownership",
      "",
      `- RuneScript files: ${report.monsterLootOwnership.runeScriptFiles}`,
      `- Parsed ai_queue3 handlers: ${report.monsterLootOwnership.handlers}`,
      `- Runtime monsters: ${report.monsterLootOwnership.runtimeMonsters}`,
      `- Dedicated handler: ${report.monsterLootOwnership.dedicatedHandlerCount}`,
      `- Direct NPC handler: ${report.monsterLootOwnership.directHandlerCount}`,
      `- NPC category handler: ${report.monsterLootOwnership.categoryHandlerCount}`,
      `- NPC default death_drop: ${report.monsterLootOwnership.defaultDropCount}`,
      `- Both handler and default drop: ${report.monsterLootOwnership.handlerAndDefaultDropCount}`,
      `- No declared handler/default drop: ${report.monsterLootOwnership.noDeclaredDropCount}`,
      `- First no-declaration ids: ${report.monsterLootOwnership.noDeclaredDropExamples.join(", ") || "none"}`,
      "",
      "## Monster Loot Extraction",
      "",
      `- Complete: ${report.monsterLootExtraction.completeCount}`,
      `- Partial: ${report.monsterLootExtraction.partialCount}`,
      `- Unsupported: ${report.monsterLootExtraction.unsupportedCount}`,
      `- Extracted top-level drop entries: ${report.monsterLootExtraction.extractedDropEntryCount}`,
      `- Issues: ${
        Object.entries(report.monsterLootExtraction.issueCounts)
          .map(([code, count]) => `${code}=${count}`)
          .join(", ") || "none"
      }`,
      ...Object.entries(report.monsterLootExtraction.issueExamples).map(
        ([code, examples]) => `- ${code} examples: ${examples.join("; ")}`
      ),
      `- Conditional default-valuation exclusions: ${
        Object.entries(report.monsterLootExtraction.exclusionCounts)
          .map(([code, count]) => `${code}=${count}`)
          .join(", ") || "none"
      }`,
      ...Object.entries(report.monsterLootExtraction.exclusionExamples).map(
        ([code, examples]) => `- ${code} examples: ${examples.join("; ")}`
      ),
      `- First partial ids: ${report.monsterLootExtraction.partialExamples.join("; ") || "none"}`,
      `- First unsupported ids: ${report.monsterLootExtraction.unsupportedExamples.join("; ") || "none"}`,
      "",
      "## Monster Loot Comparison",
      "",
      `- Exact reference matches: ${report.monsterLootComparison.exactCount}`,
      `- Differing monsters: ${report.monsterLootComparison.differingCount}`,
      `- Top-level entries: reference=${report.monsterLootComparison.referenceDropEntryCount}, source=${report.monsterLootComparison.sourceDropEntryCount}`,
      `- First differences: ${report.monsterLootComparison.differingExamples.join("; ") || "none"}`,
      `- Exact including display names: ${report.monsterLootComparison.displayNameExactCount}`,
      `- Display-name differences: ${report.monsterLootComparison.displayNameDifferingCount}`,
      `- First display-name differences: ${report.monsterLootComparison.displayNameDifferingExamples.join("; ") || "none"}`,
      "",
      "## Monster Loot Item Keys",
      "",
      `- Unique source keys: ${report.monsterLootItemKeys.sourceKeyCount}`,
      `- Covered by reference item identity: ${report.monsterLootItemKeys.referenceCoveredCount}`,
      `- Source-only with parsed object definition: ${report.monsterLootItemKeys.sourceOnlyDefinedCount}`,
      `- First source-only keys: ${report.monsterLootItemKeys.sourceOnlyDefinedExamples.join(", ") || "none"}`,
      `- Unresolved: ${report.monsterLootItemKeys.unresolvedCount}`,
      `- First unresolved keys: ${report.monsterLootItemKeys.unresolvedExamples.join(", ") || "none"}`,
      "",
      "## Next Work",
      "- Keep parser mappings and conditional default-valuation exclusions in sync with reviewed source revisions.",
      "- Run the generator, readiness and calculation-impact gates before accepting a revision bump.",
      "- Treat requirement quest state, conditional-loot activation and legacy deletion as separate decision boundaries."
    ].join("\n") + "\n"
  );
}

export function parseLostCitySourceCoverageArgs(argv: string[]): LostCitySourceCoverageCliOptions {
  const options: LostCitySourceCoverageCliOptions = {
    sourceDir: ".sources/lostcity-content",
    format: "markdown",
    exampleLimit: 10
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.format = "json";
      continue;
    }
    if (arg === "--source-dir" || arg === "--example-limit") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      if (arg === "--source-dir") {
        options.sourceDir = value;
      } else {
        const limit = Number(value);
        if (!Number.isInteger(limit) || limit < 0) {
          throw new Error("--example-limit must be a non-negative integer");
        }
        options.exampleLimit = limit;
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument ${arg}`);
  }
  return options;
}

export function main(argv = process.argv.slice(2)): void {
  const options = parseLostCitySourceCoverageArgs(argv);
  const reference = parseGameDataSnapshot(
    parseJsonWithDuplicateKeyCheck(
      readFileSync("src/data/generated/legacy-derived-runtime-game-data.json", "utf8"),
      { source: "legacy-derived runtime game data" }
    )
  );
  const report = createLostCitySourceCoverageReport({
    sourceDir: options.sourceDir,
    reference,
    exampleLimit: options.exampleLimit
  });
  console.log(
    options.format === "json"
      ? JSON.stringify(report, null, 2)
      : formatLostCitySourceCoverageMarkdown(report)
  );
}

function isDirectCliRun(): boolean {
  return process.env.LOSTCITY_SOURCE_AUDIT_CLI === "1";
}

if (isDirectCliRun()) {
  try {
    main();
  } catch (error) {
    console.error(
      `data:source-audit failed: ${error instanceof Error ? error.message : "internal-error"}`
    );
    process.exitCode = 1;
  }
}

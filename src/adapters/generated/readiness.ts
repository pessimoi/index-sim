import type {
  EntityId,
  EquipmentItemDefinition,
  GameDataSnapshot,
  ItemPriceQuality,
  ItemPriceRefreshStatus,
  ItemPriceValueOrigin,
  PriceSet,
  SimulationContext
} from "../../domain/shared";
import { resolveCanonicalItemId } from "../../domain/economy/canonical-item-id";
import { MARKET_SOURCE_MAPPINGS } from "../../data/market-source-mapping";
import { auditDynamicLootMarketDependencies } from "../../data/market-sync-items";

export type GeneratedRuntimeSource = "generated-static-snapshot" | "legacy-derived-static-snapshot";

export type RuntimeCoverageSection =
  | "items"
  | "items.runtimeFields"
  | "monsters"
  | "monsters.combatStats"
  | "monsters.incomingAttacks"
  | "monsters.loot"
  | "weapons"
  | "weapons.runtimeFields"
  | "ammo"
  | "ammo.runtimeFields"
  | "spells"
  | "spells.runtimeFields"
  | "equipment"
  | "equipment.runtimeFields"
  | "requirements"
  | "priceSet.itemPrices"
  | "priceSet.itemPriceMetadata"
  | "priceSet.alchValues";

export interface RuntimeCoverageSummary {
  section: RuntimeCoverageSection;
  blocking: boolean;
  referenceCount: number;
  candidateCount: number;
  matchedCount: number;
  missingCount: number;
  extraCount: number;
  missingIds: EntityId[];
  extraIds: EntityId[];
  missingExamples: EntityId[];
  extraExamples: EntityId[];
}

export interface GeneratedRuntimeReadinessReport {
  ready: boolean;
  source: GeneratedRuntimeSource;
  referenceSnapshotId: EntityId;
  candidateSnapshotId: EntityId;
  referencePriceSetId: EntityId;
  candidatePriceSetId: EntityId;
  sections: RuntimeCoverageSummary[];
  priceMetadata: {
    numericCount: number;
    metadataCount: number;
    missingMetadataCount: number;
    generatedFallbackCount: number;
    marketMappingsMissingNumeric: EntityId[];
    byValueOrigin: Record<ItemPriceValueOrigin, number>;
    byRefreshStatus: Record<ItemPriceRefreshStatus, number>;
    byQuality: Record<ItemPriceQuality, number>;
  };
  dynamicLootPriceDependencies: {
    dependencyCount: number;
    mappedCount: number;
    missingMappingCount: number;
    missingMappingItemIds: EntityId[];
    unrecognizedActiveTags: string[];
  };
  blockers: string[];
}

function priceMetadataSummary(
  priceSet: PriceSet
): GeneratedRuntimeReadinessReport["priceMetadata"] {
  const metadata = priceSet.itemPriceMetadata ?? {};
  const byValueOrigin: Record<ItemPriceValueOrigin, number> = {
    "market-observation": 0,
    "legacy-static": 0,
    "generated-object-cost": 0,
    imported: 0,
    manual: 0,
    unknown: 0
  };
  const byRefreshStatus: Record<ItemPriceRefreshStatus, number> = {
    observed: 0,
    retained: 0,
    "not-evaluated": 0,
    "not-applicable": 0
  };
  const byQuality: Record<ItemPriceQuality, number> = {
    high: 0,
    medium: 0,
    low: 0,
    fallback: 0,
    unknown: 0
  };
  for (const item of Object.values(metadata)) {
    byValueOrigin[item.valueOrigin] += 1;
    byRefreshStatus[item.refreshStatus] += 1;
    byQuality[item.quality] += 1;
  }
  const numericIds = Object.keys(priceSet.itemPrices);
  return {
    numericCount: numericIds.length,
    metadataCount: Object.keys(metadata).length,
    missingMetadataCount: numericIds.filter((itemId) => metadata[itemId] === undefined).length,
    generatedFallbackCount: byValueOrigin["generated-object-cost"],
    marketMappingsMissingNumeric: MARKET_SOURCE_MAPPINGS.filter(
      (mapping) => mapping.syncPrice && priceSet.itemPrices[mapping.itemId] === undefined
    ).map((mapping) => mapping.itemId),
    byValueOrigin,
    byRefreshStatus,
    byQuality
  };
}

interface ReadinessReportInput {
  reference: SimulationContext;
  candidate: SimulationContext;
  source?: GeneratedRuntimeSource;
  exampleLimit?: number;
}

const BLOCKING_SECTIONS = new Set<RuntimeCoverageSection>([
  "items",
  "items.runtimeFields",
  "monsters",
  "monsters.combatStats",
  "monsters.incomingAttacks",
  "monsters.loot",
  "weapons",
  "weapons.runtimeFields",
  "ammo",
  "ammo.runtimeFields",
  "spells",
  "spells.runtimeFields",
  "equipment",
  "equipment.runtimeFields",
  "priceSet.itemPrices",
  "priceSet.itemPriceMetadata",
  "priceSet.alchValues"
]);

type RuntimeFieldCoverageSection =
  | "items.runtimeFields"
  | "weapons.runtimeFields"
  | "ammo.runtimeFields"
  | "spells.runtimeFields"
  | "equipment.runtimeFields";

const ITEM_RUNTIME_FIELDS = ["name", "price", "alch"] as const satisfies ReadonlyArray<
  keyof GameDataSnapshot["items"][string]
>;

const MONSTER_COMBAT_STAT_FIELDS = [
  "level",
  "hp",
  "attack",
  "strength",
  "defLevel",
  "attackSpeed",
  "attBonus",
  "strBonus",
  "magicLevel",
  "defStab",
  "defSlash",
  "defCrush",
  "defRange",
  "defMagic"
] as const satisfies ReadonlyArray<keyof GameDataSnapshot["monsters"][string]>;

const WEAPON_RUNTIME_FIELDS = [
  "name",
  "type",
  "wclass",
  "sub",
  "ammoKey",
  "accBonus",
  "dmgBonus",
  "speed",
  "acc",
  "twoHand",
  "poisonSeverity",
  "provides",
  "alch"
] as const satisfies ReadonlyArray<keyof GameDataSnapshot["weapons"][string]>;

const AMMO_RUNTIME_FIELDS = [
  "name",
  "rangeBonus",
  "kind",
  "fam",
  "tier",
  "barKey",
  "priceKey",
  "alch",
  "price"
] as const satisfies ReadonlyArray<keyof GameDataSnapshot["ammo"][string]>;

const SPELL_RUNTIME_FIELDS = [
  "name",
  "base",
  "lvl",
  "baseXp",
  "god",
  "staff",
  "label",
  "runes"
] as const satisfies ReadonlyArray<keyof GameDataSnapshot["spells"][string]>;

const EQUIPMENT_RUNTIME_FIELDS = ["name"] as const satisfies ReadonlyArray<
  keyof EquipmentItemDefinition
>;

function sortedIds(record: Record<string, unknown> | undefined): EntityId[] {
  return Object.keys(record ?? {}).sort();
}

function equipmentIds(snapshot: GameDataSnapshot): EntityId[] {
  return Object.entries(snapshot.equipment)
    .flatMap(([slot, items]) => Object.keys(items).map((itemId) => `${slot}:${itemId}`))
    .sort();
}

function flattenedEquipment(snapshot: GameDataSnapshot): Record<EntityId, EquipmentItemDefinition> {
  return Object.fromEntries(
    Object.entries(snapshot.equipment).flatMap(([slot, items]) =>
      Object.entries(items).map(([itemId, item]) => [`${slot}:${itemId}`, item])
    )
  );
}

function priceIds(priceSet: PriceSet, section: "itemPrices" | "alchValues"): EntityId[] {
  return Object.keys(priceSet[section]).sort();
}

function canonicalItemId(itemId: EntityId): EntityId {
  return resolveCanonicalItemId(itemId).canonicalItemId;
}

function coverageForCanonicalIds(
  section: "items" | "priceSet.itemPrices" | "priceSet.itemPriceMetadata" | "priceSet.alchValues",
  referenceIds: EntityId[],
  candidateIds: EntityId[],
  exampleLimit: number
): RuntimeCoverageSummary {
  const referenceCanonicalIds = new Set(referenceIds.map(canonicalItemId));
  const candidateCanonicalIds = new Set(candidateIds.map(canonicalItemId));
  const missing = referenceIds.filter((id) => !candidateCanonicalIds.has(canonicalItemId(id)));
  const extra = candidateIds.filter((id) => !referenceCanonicalIds.has(canonicalItemId(id)));

  return {
    section,
    blocking: BLOCKING_SECTIONS.has(section),
    referenceCount: referenceIds.length,
    candidateCount: candidateIds.length,
    matchedCount: referenceIds.length - missing.length,
    missingCount: missing.length,
    extraCount: extra.length,
    missingIds: missing,
    extraIds: extra,
    missingExamples: missing.slice(0, exampleLimit),
    extraExamples: extra.slice(0, exampleLimit)
  };
}

function idsForSection(context: SimulationContext, section: RuntimeCoverageSection): EntityId[] {
  switch (section) {
    case "items":
    case "items.runtimeFields":
      return sortedIds(context.gameData.items);
    case "monsters":
      return sortedIds(context.gameData.monsters);
    case "monsters.combatStats":
    case "monsters.incomingAttacks":
    case "monsters.loot":
      return sortedIds(context.gameData.monsters);
    case "weapons":
    case "weapons.runtimeFields":
      return sortedIds(context.gameData.weapons);
    case "ammo":
    case "ammo.runtimeFields":
      return sortedIds(context.gameData.ammo);
    case "spells":
    case "spells.runtimeFields":
      return sortedIds(context.gameData.spells);
    case "equipment":
    case "equipment.runtimeFields":
      return equipmentIds(context.gameData);
    case "requirements":
      return sortedIds(context.gameData.requirements);
    case "priceSet.itemPrices":
      return priceIds(context.priceSet, "itemPrices");
    case "priceSet.itemPriceMetadata":
      return sortedIds(context.priceSet.itemPriceMetadata);
    case "priceSet.alchValues":
      return priceIds(context.priceSet, "alchValues");
  }
}

function hasCoveredFields(
  reference: object | undefined,
  candidate: object | undefined,
  fields: readonly string[]
): boolean {
  if (!reference || !candidate) return false;
  const referenceRecord = reference as Record<string, unknown>;
  const candidateRecord = candidate as Record<string, unknown>;
  return fields.every(
    (field) => referenceRecord[field] === undefined || candidateRecord[field] !== undefined
  );
}

function runtimeFieldRecords(
  context: SimulationContext,
  section: RuntimeFieldCoverageSection
): Record<EntityId, object> {
  switch (section) {
    case "items.runtimeFields":
      return context.gameData.items;
    case "weapons.runtimeFields":
      return context.gameData.weapons;
    case "ammo.runtimeFields":
      return context.gameData.ammo;
    case "spells.runtimeFields":
      return context.gameData.spells;
    case "equipment.runtimeFields":
      return flattenedEquipment(context.gameData);
  }
}

function runtimeFieldsForSection(section: RuntimeFieldCoverageSection): readonly string[] {
  switch (section) {
    case "items.runtimeFields":
      return ITEM_RUNTIME_FIELDS;
    case "weapons.runtimeFields":
      return WEAPON_RUNTIME_FIELDS;
    case "ammo.runtimeFields":
      return AMMO_RUNTIME_FIELDS;
    case "spells.runtimeFields":
      return SPELL_RUNTIME_FIELDS;
    case "equipment.runtimeFields":
      return EQUIPMENT_RUNTIME_FIELDS;
  }
}

function hasMatchingMonsterCombatStats(
  reference: SimulationContext,
  candidate: SimulationContext,
  monsterId: EntityId
): boolean {
  const referenceMonster = reference.gameData.monsters[monsterId];
  const candidateMonster = candidate.gameData.monsters[monsterId];
  return hasCoveredFields(referenceMonster, candidateMonster, MONSTER_COMBAT_STAT_FIELDS);
}

function coverageForMonsterCombatStats(
  reference: SimulationContext,
  candidate: SimulationContext,
  exampleLimit: number
): RuntimeCoverageSummary {
  const referenceIds = sortedIds(reference.gameData.monsters);
  const candidateIds = sortedIds(candidate.gameData.monsters);
  const referenceIdSet = new Set(referenceIds);
  const matchingIds = referenceIds.filter((id) =>
    hasMatchingMonsterCombatStats(reference, candidate, id)
  );
  const missingOrMismatched = referenceIds.filter((id) => !matchingIds.includes(id));
  const extra = candidateIds.filter((id) => !referenceIdSet.has(id));

  return {
    section: "monsters.combatStats",
    blocking: BLOCKING_SECTIONS.has("monsters.combatStats"),
    referenceCount: referenceIds.length,
    candidateCount: matchingIds.length,
    matchedCount: matchingIds.length,
    missingCount: missingOrMismatched.length,
    extraCount: extra.length,
    missingIds: missingOrMismatched,
    extraIds: extra,
    missingExamples: missingOrMismatched.slice(0, exampleLimit),
    extraExamples: extra.slice(0, exampleLimit)
  };
}

function coverageForMonsterLoot(
  reference: SimulationContext,
  candidate: SimulationContext,
  exampleLimit: number
): RuntimeCoverageSummary {
  const referenceIds = sortedIds(reference.gameData.monsters);
  const candidateIds = sortedIds(candidate.gameData.monsters);
  const referenceIdSet = new Set(referenceIds);
  const matchingIds = referenceIds.filter((id) => {
    const referenceMonster = reference.gameData.monsters[id];
    const candidateMonster = candidate.gameData.monsters[id];
    return (
      !!candidateMonster &&
      (!Array.isArray(referenceMonster?.loot) || Array.isArray(candidateMonster.loot))
    );
  });
  const matchingIdSet = new Set(matchingIds);
  const missingOrMismatched = referenceIds.filter((id) => !matchingIdSet.has(id));
  const extra = candidateIds.filter((id) => !referenceIdSet.has(id));

  return {
    section: "monsters.loot",
    blocking: BLOCKING_SECTIONS.has("monsters.loot"),
    referenceCount: referenceIds.length,
    candidateCount: matchingIds.length,
    matchedCount: matchingIds.length,
    missingCount: missingOrMismatched.length,
    extraCount: extra.length,
    missingIds: missingOrMismatched,
    extraIds: extra,
    missingExamples: missingOrMismatched.slice(0, exampleLimit),
    extraExamples: extra.slice(0, exampleLimit)
  };
}

function coverageForMonsterIncomingAttacks(
  reference: SimulationContext,
  candidate: SimulationContext,
  exampleLimit: number
): RuntimeCoverageSummary {
  const referenceIds = sortedIds(reference.gameData.monsters);
  const candidateIds = sortedIds(candidate.gameData.monsters);
  const referenceIdSet = new Set(referenceIds);
  const matchingIds = referenceIds.filter((id) => {
    const monster = candidate.gameData.monsters[id];
    return (
      !!monster?.incomingAttackCoverage &&
      !!monster.incomingAttacks?.length &&
      monster.incomingAttacks.every(
        (profile) => profile.coverage === monster.incomingAttackCoverage
      )
    );
  });
  const matchingIdSet = new Set(matchingIds);
  const missingOrMismatched = referenceIds.filter((id) => !matchingIdSet.has(id));
  const extra = candidateIds.filter((id) => !referenceIdSet.has(id));
  return {
    section: "monsters.incomingAttacks",
    blocking: BLOCKING_SECTIONS.has("monsters.incomingAttacks"),
    referenceCount: referenceIds.length,
    candidateCount: matchingIds.length,
    matchedCount: matchingIds.length,
    missingCount: missingOrMismatched.length,
    extraCount: extra.length,
    missingIds: missingOrMismatched,
    extraIds: extra,
    missingExamples: missingOrMismatched.slice(0, exampleLimit),
    extraExamples: extra.slice(0, exampleLimit)
  };
}

function coverageForRuntimeFields(
  reference: SimulationContext,
  candidate: SimulationContext,
  section: RuntimeFieldCoverageSection,
  exampleLimit: number
): RuntimeCoverageSummary {
  const referenceRecords = runtimeFieldRecords(reference, section);
  const candidateRecords = runtimeFieldRecords(candidate, section);
  const referenceIds = sortedIds(referenceRecords);
  const candidateIds = sortedIds(candidateRecords);
  const referenceIdSet = new Set(referenceIds);
  const fields = runtimeFieldsForSection(section);
  const matchingIds = referenceIds.filter((id) =>
    hasCoveredFields(referenceRecords[id], candidateRecords[id], fields)
  );
  const matchingIdSet = new Set(matchingIds);
  const missingOrMismatched = referenceIds.filter((id) => !matchingIdSet.has(id));
  const extra = candidateIds.filter((id) => !referenceIdSet.has(id));

  return {
    section,
    blocking: BLOCKING_SECTIONS.has(section),
    referenceCount: referenceIds.length,
    candidateCount: matchingIds.length,
    matchedCount: matchingIds.length,
    missingCount: missingOrMismatched.length,
    extraCount: extra.length,
    missingIds: missingOrMismatched,
    extraIds: extra,
    missingExamples: missingOrMismatched.slice(0, exampleLimit),
    extraExamples: extra.slice(0, exampleLimit)
  };
}

function coverageForItemRuntimeFields(
  reference: SimulationContext,
  candidate: SimulationContext,
  exampleLimit: number
): RuntimeCoverageSummary {
  const referenceIds = sortedIds(reference.gameData.items);
  const candidateIds = sortedIds(candidate.gameData.items);
  const referenceIdSet = new Set(referenceIds);
  const matchingIds = referenceIds.filter((id) => {
    const referenceItem = reference.gameData.items[id];
    const candidateItem = candidate.gameData.items[id];
    return hasCoveredFields(referenceItem, candidateItem, ITEM_RUNTIME_FIELDS);
  });
  const matchingIdSet = new Set(matchingIds);
  const missingOrMismatched = referenceIds.filter((id) => !matchingIdSet.has(id));
  const extra = candidateIds.filter((id) => !referenceIdSet.has(id));

  return {
    section: "items.runtimeFields",
    blocking: BLOCKING_SECTIONS.has("items.runtimeFields"),
    referenceCount: referenceIds.length,
    candidateCount: matchingIds.length,
    matchedCount: matchingIds.length,
    missingCount: missingOrMismatched.length,
    extraCount: extra.length,
    missingIds: missingOrMismatched,
    extraIds: extra,
    missingExamples: missingOrMismatched.slice(0, exampleLimit),
    extraExamples: extra.slice(0, exampleLimit)
  };
}

function coverageForSection(
  reference: SimulationContext,
  candidate: SimulationContext,
  section: RuntimeCoverageSection,
  exampleLimit: number
): RuntimeCoverageSummary {
  if (section === "priceSet.itemPriceMetadata") {
    return coverageForCanonicalIds(
      section,
      idsForSection(candidate, "priceSet.itemPrices"),
      idsForSection(candidate, section),
      exampleLimit
    );
  }
  if (section === "monsters.combatStats") {
    return coverageForMonsterCombatStats(reference, candidate, exampleLimit);
  }
  if (section === "monsters.loot") {
    return coverageForMonsterLoot(reference, candidate, exampleLimit);
  }
  if (section === "monsters.incomingAttacks") {
    return coverageForMonsterIncomingAttacks(reference, candidate, exampleLimit);
  }
  if (section === "items.runtimeFields") {
    return coverageForItemRuntimeFields(reference, candidate, exampleLimit);
  }
  if (section.endsWith(".runtimeFields")) {
    return coverageForRuntimeFields(
      reference,
      candidate,
      section as RuntimeFieldCoverageSection,
      exampleLimit
    );
  }

  const referenceIds = idsForSection(reference, section);
  const candidateIds = idsForSection(candidate, section);
  if (section === "priceSet.itemPrices" || section === "priceSet.alchValues") {
    return coverageForCanonicalIds(section, referenceIds, candidateIds, exampleLimit);
  }
  const candidateIdSet = new Set(candidateIds);
  const referenceIdSet = new Set(referenceIds);
  const missing = referenceIds.filter((id) => !candidateIdSet.has(id));
  const extra = candidateIds.filter((id) => !referenceIdSet.has(id));

  return {
    section,
    blocking: BLOCKING_SECTIONS.has(section),
    referenceCount: referenceIds.length,
    candidateCount: candidateIds.length,
    matchedCount: referenceIds.length - missing.length,
    missingCount: missing.length,
    extraCount: extra.length,
    missingIds: missing,
    extraIds: extra,
    missingExamples: missing.slice(0, exampleLimit),
    extraExamples: extra.slice(0, exampleLimit)
  };
}

function blockerForSection(section: RuntimeCoverageSummary): string | null {
  if (!section.blocking || section.missingCount === 0) return null;
  if (
    section.section === "monsters.combatStats" ||
    section.section === "monsters.incomingAttacks" ||
    section.section === "monsters.loot"
  ) {
    return `${section.section} is missing or incomplete for ${section.missingCount} of ${section.referenceCount} legacy-runtime monsters in the generated runtime candidate.`;
  }
  if (section.section.endsWith(".runtimeFields")) {
    return `${section.section} is missing required field coverage for ${section.missingCount} of ${section.referenceCount} legacy-runtime entities in the generated runtime candidate.`;
  }
  return `${section.section} is missing ${section.missingCount} of ${section.referenceCount} legacy-runtime ids in the generated runtime candidate.`;
}

export function createGeneratedRuntimeReadinessReport(
  input: ReadinessReportInput
): GeneratedRuntimeReadinessReport {
  const exampleLimit = input.exampleLimit ?? 5;
  const source = input.source ?? "generated-static-snapshot";
  const sections: RuntimeCoverageSection[] = [
    "items",
    "items.runtimeFields",
    "monsters",
    "monsters.combatStats",
    ...(source === "generated-static-snapshot"
      ? (["monsters.incomingAttacks"] as RuntimeCoverageSection[])
      : []),
    "monsters.loot",
    "weapons",
    "weapons.runtimeFields",
    "ammo",
    "ammo.runtimeFields",
    "spells",
    "spells.runtimeFields",
    "equipment",
    "equipment.runtimeFields",
    "requirements",
    "priceSet.itemPrices",
    "priceSet.itemPriceMetadata",
    "priceSet.alchValues"
  ];
  const coverage = sections.map((section) =>
    coverageForSection(input.reference, input.candidate, section, exampleLimit)
  );
  const blockers = coverage.flatMap((section) => {
    const blocker = blockerForSection(section);
    return blocker ? [blocker] : [];
  });
  if (source === "generated-static-snapshot" && !input.candidate.gameData.revisionContext) {
    blockers.unshift("Generated runtime candidate is missing required game revision context.");
  }
  const dynamicLootDependencies = auditDynamicLootMarketDependencies(input.candidate.gameData);

  return {
    ready: blockers.length === 0,
    source,
    referenceSnapshotId: input.reference.gameData.id,
    candidateSnapshotId: input.candidate.gameData.id,
    referencePriceSetId: input.reference.priceSet.id,
    candidatePriceSetId: input.candidate.priceSet.id,
    sections: coverage,
    priceMetadata: priceMetadataSummary(input.candidate.priceSet),
    dynamicLootPriceDependencies: {
      dependencyCount: dynamicLootDependencies.dependencyItemIds.length,
      mappedCount: dynamicLootDependencies.mappedItemIds.length,
      missingMappingCount: dynamicLootDependencies.missingMappingItemIds.length,
      missingMappingItemIds: dynamicLootDependencies.missingMappingItemIds,
      unrecognizedActiveTags: dynamicLootDependencies.unrecognizedActiveTags
    },
    blockers
  };
}

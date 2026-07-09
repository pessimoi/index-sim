import type { GameDataSnapshot, ItemDefinition } from "../src/domain/shared";
import {
  LostCityContentSourceError,
  lastConfigValue,
  type LostCityConfigCatalog
} from "./lostcity-content-config";
import {
  LOSTCITY_EQUIPMENT_SOURCE_MAPPINGS,
  LOSTCITY_SYNTHETIC_RUNTIME_ITEM_IDS,
  lostCitySourceItemId
} from "./lostcity-content-runtime-mapping";

function normalizedEntityName(name: string | undefined): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNameSourceId(
  runtimeName: string,
  objects: LostCityConfigCatalog
): string | undefined {
  const normalizedName = normalizedEntityName(runtimeName);
  const matches = [...objects.entries.entries()].flatMap(([sourceId, entry]) =>
    normalizedEntityName(lastConfigValue(entry, "name")) === normalizedName ? [sourceId] : []
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function equipmentSourceId(runtimeItemId: string): string | undefined {
  const matches = new Set(
    Object.entries(LOSTCITY_EQUIPMENT_SOURCE_MAPPINGS).flatMap(([equipmentId, mapping]) =>
      equipmentId.slice(equipmentId.indexOf(":") + 1) === runtimeItemId
        ? [mapping.sourceItemId]
        : []
    )
  );
  return matches.size === 1 ? [...matches][0] : undefined;
}

function resolvedSourceItemId(
  runtimeItemId: string,
  runtimeName: string,
  objects: LostCityConfigCatalog
): string {
  if (objects.entries.has(runtimeItemId)) return runtimeItemId;
  const explicitItemId = lostCitySourceItemId(runtimeItemId);
  if (explicitItemId !== runtimeItemId && objects.entries.has(explicitItemId)) {
    return explicitItemId;
  }
  const explicitEquipmentId = equipmentSourceId(runtimeItemId);
  if (explicitEquipmentId && objects.entries.has(explicitEquipmentId)) {
    return explicitEquipmentId;
  }
  return uniqueNameSourceId(runtimeName, objects) ?? runtimeItemId;
}

function sourceCost(itemId: string, objects: LostCityConfigCatalog): number {
  const entry = objects.entries.get(itemId);
  const value = lastConfigValue(entry, "cost") ?? "1";
  if (!/^[0-9]+$/.test(value)) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity object \`${entry?.sourceRef ?? itemId}\` has invalid cost.`
    );
  }
  return Number(value);
}

export function extractLostCityItemSource(
  sourceItemId: string,
  objects: LostCityConfigCatalog,
  sourceRevision?: string,
  runtimeItemId = sourceItemId
): ItemDefinition {
  const entry = objects.entries.get(sourceItemId);
  if (!entry) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity object mapping for \`${sourceItemId}\` is unresolved.`
    );
  }
  const cost = sourceCost(sourceItemId, objects);
  return {
    id: runtimeItemId,
    name: lastConfigValue(entry, "name") ?? sourceItemId.replaceAll("_", " "),
    price: cost,
    alch: Math.max(Math.floor((cost * 6) / 10), 1),
    ...(lastConfigValue(entry, "stackable") === "yes" ? { stackable: true } : {}),
    provenance: {
      source: "generated",
      sourceRef: entry.sourceRef,
      ...(sourceRevision ? { revision: sourceRevision } : {}),
      notes:
        "Price is the source object cost fallback and high alch is source-formula-derived; scheduled market prices take precedence."
    }
  };
}

export function createLostCityItemCandidate(
  reference: GameDataSnapshot,
  objects: LostCityConfigCatalog,
  sourceRevision?: string
): GameDataSnapshot {
  const items = Object.fromEntries(
    Object.entries(reference.items).map(([runtimeItemId, runtime]) => {
      if (LOSTCITY_SYNTHETIC_RUNTIME_ITEM_IDS.has(runtimeItemId)) {
        return [
          runtimeItemId,
          {
            ...runtime,
            provenance: {
              source: "manual" as const,
              sourceRef: "index-sim simulator-owned synthetic item identity",
              notes:
                "This runtime identity is a simulator view or aggregate and has no standalone LostCity object row."
            }
          }
        ];
      }
      const sourceItemId = resolvedSourceItemId(runtimeItemId, runtime.name, objects);
      return [
        runtimeItemId,
        extractLostCityItemSource(sourceItemId, objects, sourceRevision, runtimeItemId)
      ];
    })
  );
  return {
    ...reference,
    id: `${reference.id}-lostcity-item-candidate`,
    label: `${reference.label} with LostCity item fields`,
    items
  };
}

import type {
  DataProvenance,
  DropEntry,
  GameDataSnapshot,
  MonsterDefinition
} from "../src/domain/shared";
import { parseGameDataSnapshot } from "../src/data/schemas/game-data";
import { readLostCityConfigCatalog } from "./lostcity-content-config";
import { createLostCityEquipmentCandidate } from "./lostcity-content-equipment";
import { createLostCityCombatCatalogCandidate } from "./lostcity-content-combat-catalog";
import { createLostCityItemCandidate, extractLostCityItemSource } from "./lostcity-content-items";
import { readLostCityLootHandlerCatalog } from "./lostcity-content-loot";
import { extractLostCityMonsterLootSource } from "./lostcity-content-loot-extractor";
import { createLostCityMonsterCombatCandidate } from "./lostcity-content-monsters";
import {
  createNpcAttackSourceAudit,
  generatedIncomingAttacksFromAuditRow
} from "./lostcity-content-npc-attacks";
import { readLostCityItemRequirements } from "./lostcity-content-requirements";
import { lostCityMonsterSourceId, lostCitySourceItemId } from "./lostcity-content-runtime-mapping";

export interface LostCityRawSnapshotResult {
  snapshot: GameDataSnapshot;
  lootExclusionCount: number;
}

function generatedProvenance(
  sourceRef: string,
  sourceRevision: string,
  generatedAt?: string,
  notes?: string
): DataProvenance {
  return {
    source: "generated",
    sourceRef,
    ...(generatedAt ? { verifiedAt: generatedAt } : {}),
    ...(notes ? { notes: `${notes} Source revision: ${sourceRevision}.` } : {})
  };
}

function dropWithProvenance(
  drop: DropEntry,
  sourceRef: string,
  sourceRevision: string,
  generatedAt?: string
): DropEntry {
  if (Array.isArray(drop)) {
    return drop.map((entry) =>
      dropWithProvenance(entry, sourceRef, sourceRevision, generatedAt)
    ) as DropEntry;
  }
  return {
    ...drop,
    provenance: generatedProvenance(
      sourceRef,
      sourceRevision,
      generatedAt,
      "Parsed from the reviewed RuneScript loot path; conditional quest and clue rows are retained with typed eligibility and excluded from default valuation."
    )
  };
}

export function createLostCityRawSnapshot(input: {
  sourceDir: string;
  reference: GameDataSnapshot;
  repoRoot?: string;
  sourceRevision: string;
  generatedAt?: string;
}): LostCityRawSnapshotResult {
  const catalogOptions = { repoRoot: input.repoRoot, sourceDir: input.sourceDir };
  const npcs = readLostCityConfigCatalog({ ...catalogOptions, extension: ".npc" });
  const objects = readLostCityConfigCatalog({ ...catalogOptions, extension: ".obj" });
  const params = readLostCityConfigCatalog({ ...catalogOptions, extension: ".param" });
  const dbrows = readLostCityConfigCatalog({ ...catalogOptions, extension: ".dbrow" });
  const handlers = readLostCityLootHandlerCatalog(catalogOptions);
  const attackAudit = createNpcAttackSourceAudit({
    sourceDir: input.sourceDir,
    sourceRevision: input.sourceRevision,
    reference: input.reference,
    ...(input.repoRoot ? { repoRoot: input.repoRoot } : {})
  });
  const attackRows = new Map(attackAudit.rows.map((row) => [row.runtimeId, row]));

  let candidate = createLostCityMonsterCombatCandidate(input.reference, npcs);
  candidate = createLostCityEquipmentCandidate(candidate, objects);
  candidate = createLostCityCombatCatalogCandidate(candidate, objects, params, dbrows);
  candidate = createLostCityItemCandidate(candidate, objects, input.sourceRevision);

  let lootExclusionCount = 0;
  const sourceLootItemIds = new Set<string>();
  const monsters = Object.fromEntries(
    Object.entries(candidate.monsters).map(([runtimeId, monster]) => {
      const combatSourceId = lostCityMonsterSourceId(runtimeId);
      const combatSource = npcs.entries.get(combatSourceId);
      const extraction = extractLostCityMonsterLootSource({
        runtimeId,
        npcs,
        objects,
        params,
        handlers
      });
      if (extraction.status !== "complete") {
        throw new Error(`LostCity loot extraction is incomplete for ${runtimeId}.`);
      }
      const attackRow = attackRows.get(runtimeId);
      if (!attackRow) {
        throw new Error(`LostCity incoming attack extraction is incomplete for ${runtimeId}.`);
      }
      const incoming = generatedIncomingAttacksFromAuditRow(
        attackRow,
        input.sourceRevision,
        input.generatedAt
      );
      lootExclusionCount += extraction.exclusions.length;
      const loot = extraction.loot.map((drop) => {
        const collectItemIds = (entry: DropEntry): void => {
          if (Array.isArray(entry)) entry.forEach(collectItemIds);
          else if (entry.key) sourceLootItemIds.add(entry.key);
        };
        collectItemIds(drop);
        return dropWithProvenance(
          drop,
          extraction.sourceRef,
          input.sourceRevision,
          input.generatedAt
        );
      });
      const definition: MonsterDefinition = {
        ...monster,
        ...incoming,
        loot,
        provenance: generatedProvenance(
          [combatSource?.sourceRef, extraction.sourceRef].filter(Boolean).join(", "),
          input.sourceRevision,
          input.generatedAt,
          "Combat fields and reviewed loot, including typed conditional rows, are parsed from the pinned LostCity content revision."
        )
      };
      return [runtimeId, definition];
    })
  );

  const items = { ...candidate.items };
  for (const runtimeItemId of [...sourceLootItemIds].sort()) {
    if (items[runtimeItemId]) continue;
    const sourceItemId = lostCitySourceItemId(runtimeItemId);
    items[runtimeItemId] = extractLostCityItemSource(
      sourceItemId,
      objects,
      input.sourceRevision,
      runtimeItemId
    );
  }

  const provenance = generatedProvenance(
    `LostCityRS/Content ${input.sourceRevision}`,
    input.sourceRevision,
    input.generatedAt,
    "Raw config and RuneScript inputs are normalized into simulator-owned runtime contracts; source bodies are not embedded."
  );
  const requirements = readLostCityItemRequirements({
    ...catalogOptions,
    reference: candidate,
    objects,
    sourceRevision: input.sourceRevision,
    generatedAt: input.generatedAt
  });
  const snapshot = parseGameDataSnapshot({
    ...candidate,
    id: `lostcity-${input.sourceRevision.slice(0, 12)}-runtime`,
    label: `LostCity source-backed runtime ${input.sourceRevision.slice(0, 12)}`,
    items,
    monsters,
    provenance,
    requirements
  });
  return { snapshot, lootExclusionCount };
}

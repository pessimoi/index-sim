import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import { parseGameDataSnapshot } from "../src/data/schemas/game-data";
import { PriceSetSchema } from "../src/data/schemas/price-set";
import type { GameDataSnapshot, PriceSet } from "../src/domain/shared";
import { simulateFullSimulation, type FullSimulationInput } from "../src/domain/simulation";
import { createGeneratedRuntimePriceSet } from "../src/adapters/generated/price-fallback";
import {
  type AllMonsterScanBaseline,
  createCalculationImpactEvidence,
  DEFAULT_GAME_DATA_SOURCE_DIR,
  formatCalculationImpactEvidenceMarkdown,
  type CalculationImpactEvidence,
  type RepresentativeCalculationImpactCase
} from "./game-data-generator-core";
import { readLostCityConfigCatalog } from "./lostcity-content-config";
import { readLostCityLootHandlerCatalog } from "./lostcity-content-loot";
import { extractLostCityMonsterLootSource } from "./lostcity-content-loot-extractor";
import { extractLostCityItemSource } from "./lostcity-content-items";
import {
  LOSTCITY_EQUIPMENT_COMPARISON_FIELDS,
  createLostCityEquipmentCandidate
} from "./lostcity-content-equipment";
import {
  LOSTCITY_AMMO_COMPARISON_FIELDS,
  LOSTCITY_WEAPON_COMPARISON_FIELDS,
  createLostCityCombatCatalogCandidate
} from "./lostcity-content-combat-catalog";
import { LOSTCITY_SPELL_COMPARISON_FIELDS } from "./lostcity-content-spells";
import { lostCitySourceItemId } from "./lostcity-content-runtime-mapping";
import {
  createLostCityMonsterCombatCandidate,
  LOSTCITY_MONSTER_COMBAT_FIELDS
} from "./lostcity-content-monsters";
import { resolveLostCitySourceRevision } from "./report-lostcity-source-coverage";

export interface LostCitySourceImpactCliOptions {
  sourceDir: string;
  format: "markdown" | "json";
  impactOutlierLimit: number;
  includeLoot: boolean;
  includeCombat: boolean;
  includeEquipment: boolean;
  includeCombatCatalog: boolean;
  detailMonsterId?: string;
}

export interface LostCitySourceImpactReport {
  sourceDir: string;
  sourceRevision: string;
  referenceSnapshotId: string;
  candidateSnapshotId: string;
  monsterCount: number;
  fields: readonly string[];
  equipmentFields: readonly string[];
  weaponFields: readonly string[];
  ammoFields: readonly string[];
  spellFields: readonly string[];
  includeLoot: boolean;
  includeCombat: boolean;
  includeEquipment: boolean;
  includeCombatCatalog: boolean;
  lootExclusionCount: number;
  evidence: CalculationImpactEvidence;
  detail?: {
    monsterId: string;
    styles: Array<{
      combatStyle: FullSimulationInput["request"]["combatStyle"];
      baselineGpPerKill: number;
      candidateGpPerKill: number;
      changedRows: Array<{
        signature: string;
        baseline?: string;
        candidate?: string;
      }>;
    }>;
  };
}

const SOURCE_IMPACT_LEVELS = {
  attack: 70,
  strength: 70,
  defence: 70,
  ranged: 70,
  magic: 70,
  prayer: 43
} as const;

function sourceImpactInput(
  monsterId: string,
  combatStyle: FullSimulationInput["request"]["combatStyle"]
): FullSimulationInput {
  const loadout =
    combatStyle === "melee"
      ? { weaponId: "rune_scimitar", gear: {} }
      : combatStyle === "ranged"
        ? { weaponId: "shortbow", ammoId: "bronze_arrow", gear: {} }
        : { weaponId: "staff_of_air", gear: {} };
  return {
    request: {
      combatStyle,
      monsterId,
      levels: SOURCE_IMPACT_LEVELS,
      loadout,
      styleId:
        combatStyle === "ranged" ? "rapid" : combatStyle === "magic" ? "accurate" : "aggressive",
      prayers: { keys: ["none"] },
      boosts: { keys: ["none"] },
      ...(combatStyle === "magic" ? { spellId: "wind_strike", charge: false } : {}),
      sustained: false,
      repotThreshold: null
    },
    trip: {
      foodKey: "none",
      foodCount: 0,
      teleport: false,
      bankSeconds: 0,
      prayerMode: "none",
      prayerRestore: false,
      safespot: true,
      recoverAmmo: true
    },
    lootPrefs: {},
    ringOfWealth: false,
    legendsComplete: true,
    jewelSpot: "underground",
    overheadSec: 0,
    cannon: null
  };
}

const SOURCE_IMPACT_STYLE_CONFIG = [
  { combatStyle: "melee", requiredItems: ["rune_scimitar"] },
  { combatStyle: "ranged", requiredItems: ["shortbow", "bronze_arrow"] },
  { combatStyle: "magic", requiredItems: ["staff_of_air"] }
] as const;

export const LOSTCITY_SOURCE_IMPACT_CASES = ["giant", "black_dragon", "dark_wizard_20"].flatMap(
  (monsterId) =>
    SOURCE_IMPACT_STYLE_CONFIG.map(({ combatStyle, requiredItems }) => ({
      id: `source_${combatStyle}_${monsterId}`,
      label: `Source ${combatStyle} ${monsterId}`,
      tags: ["source-impact", combatStyle, monsterId],
      input: sourceImpactInput(monsterId, combatStyle),
      requiredItems
    }))
) satisfies readonly RepresentativeCalculationImpactCase[];

function sourceEquipmentImpactInput(
  combatStyle: FullSimulationInput["request"]["combatStyle"],
  gear: FullSimulationInput["request"]["loadout"]["gear"],
  prayerDrain = false
): FullSimulationInput {
  const input = sourceImpactInput("giant", combatStyle);
  return {
    ...input,
    request: {
      ...input.request,
      loadout: { ...input.request.loadout, gear },
      ...(prayerDrain ? { prayers: { keys: ["ultimate", "incredible"] } } : {})
    },
    trip: {
      ...input.trip,
      ...(prayerDrain ? { prayerMode: "potions" as const, prayerPotionDoses: 8 } : {})
    }
  };
}

export const LOSTCITY_EQUIPMENT_IMPACT_CASES = [
  {
    id: "source_equipment_unholy_symbol_melee",
    label: "Source equipment Unholy symbol melee",
    tags: ["source-impact", "equipment", "melee", "unholy-symbol"],
    input: sourceEquipmentImpactInput("melee", { amulet: "unholy_symbol" }),
    requiredItems: ["rune_scimitar", "unholy_symbol"]
  },
  {
    id: "source_equipment_unholy_symbol_ranged",
    label: "Source equipment Unholy symbol ranged",
    tags: ["source-impact", "equipment", "ranged", "unholy-symbol"],
    input: sourceEquipmentImpactInput("ranged", { amulet: "unholy_symbol" }),
    requiredItems: ["shortbow", "bronze_arrow", "unholy_symbol"]
  },
  {
    id: "source_equipment_unholy_symbol_magic",
    label: "Source equipment Unholy symbol magic",
    tags: ["source-impact", "equipment", "magic", "unholy-symbol"],
    input: sourceEquipmentImpactInput("magic", { amulet: "unholy_symbol" }),
    requiredItems: ["staff_of_air", "unholy_symbol"]
  },
  {
    id: "source_equipment_monk_robes_prayer",
    label: "Source equipment Monk robes prayer drain",
    tags: ["source-impact", "equipment", "melee", "prayer"],
    input: sourceEquipmentImpactInput(
      "melee",
      { body: "monk_robe_top", legs: "monk_robe_bottom" },
      true
    ),
    requiredItems: ["rune_scimitar", "monk_robe_top", "monk_robe_bottom", "prayer_potion"]
  }
] satisfies readonly RepresentativeCalculationImpactCase[];

function sourceThrownImpactInput(monsterId: string, weaponId: string): FullSimulationInput {
  const input = sourceImpactInput(monsterId, "ranged");
  return {
    ...input,
    request: {
      ...input.request,
      loadout: { weaponId, gear: {} }
    }
  };
}

export const LOSTCITY_COMBAT_CATALOG_IMPACT_CASES = [
  {
    id: "source_catalog_bronze_dart_giant",
    label: "Source catalog Bronze dart giant",
    tags: ["source-impact", "weapon", "ammo", "ranged", "thrown", "low-tier"],
    input: sourceThrownImpactInput("giant", "bronze_dart_w"),
    requiredItems: ["bronze_dart_w", "bronze_dart"]
  },
  {
    id: "source_catalog_rune_knife_black_dragon",
    label: "Source catalog Rune knife Black Dragon",
    tags: ["source-impact", "weapon", "ammo", "ranged", "thrown", "high-tier"],
    input: sourceThrownImpactInput("black_dragon", "rune_knife_w"),
    requiredItems: ["rune_knife_w", "rune_knife"]
  }
] satisfies readonly RepresentativeCalculationImpactCase[];

export const LOSTCITY_COMBAT_CATALOG_ALL_MONSTER_BASELINES = [
  {
    id: "source_thrown",
    label: "Source thrown",
    combatStyle: "ranged",
    requiredItems: ["bronze_dart_w", "bronze_dart"],
    inputForMonster: (monsterId: string) => sourceThrownImpactInput(monsterId, "bronze_dart_w")
  }
] satisfies readonly AllMonsterScanBaseline[];

export const LOSTCITY_SOURCE_ALL_MONSTER_BASELINES = SOURCE_IMPACT_STYLE_CONFIG.map(
  ({ combatStyle, requiredItems }) => ({
    id: `source_${combatStyle}`,
    label: `Source ${combatStyle}`,
    combatStyle,
    requiredItems,
    inputForMonster: (monsterId: string) => sourceImpactInput(monsterId, combatStyle)
  })
) satisfies readonly AllMonsterScanBaseline[];

export function createLostCitySourceImpactReport(input: {
  sourceDir: string;
  reference: GameDataSnapshot;
  priceSet: PriceSet;
  repoRoot?: string;
  sourceRevision?: string;
  impactOutlierLimit?: number;
  includeLoot?: boolean;
  includeCombat?: boolean;
  includeEquipment?: boolean;
  includeCombatCatalog?: boolean;
  detailMonsterId?: string;
}): LostCitySourceImpactReport {
  const repoRoot = resolve(input.repoRoot ?? process.cwd());
  const npc = readLostCityConfigCatalog({
    repoRoot,
    sourceDir: input.sourceDir,
    extension: ".npc"
  });
  const includeCombat = input.includeCombat ?? true;
  const combatCandidate = includeCombat
    ? createLostCityMonsterCombatCandidate(input.reference, npc)
    : input.reference;
  const includeEquipment = input.includeEquipment ?? false;
  const includeCombatCatalog = input.includeCombatCatalog ?? false;
  const objects =
    input.includeLoot || includeEquipment || includeCombatCatalog
      ? readLostCityConfigCatalog({
          repoRoot,
          sourceDir: input.sourceDir,
          extension: ".obj"
        })
      : undefined;
  const params =
    input.includeLoot || includeCombatCatalog
      ? readLostCityConfigCatalog({
          repoRoot,
          sourceDir: input.sourceDir,
          extension: ".param"
        })
      : undefined;
  const dbrows = includeCombatCatalog
    ? readLostCityConfigCatalog({
        repoRoot,
        sourceDir: input.sourceDir,
        extension: ".dbrow"
      })
    : undefined;
  const equipmentCandidate = includeEquipment
    ? createLostCityEquipmentCandidate(combatCandidate, objects!)
    : combatCandidate;
  const baseCandidate = includeCombatCatalog
    ? createLostCityCombatCatalogCandidate(equipmentCandidate, objects!, params!, dbrows!)
    : equipmentCandidate;
  let lootExclusionCount = 0;
  const candidate = input.includeLoot
    ? (() => {
        const handlers = readLostCityLootHandlerCatalog({
          repoRoot,
          sourceDir: input.sourceDir
        });
        const monsters = Object.fromEntries(
          Object.entries(baseCandidate.monsters).map(([runtimeId, monster]) => {
            const extraction = extractLostCityMonsterLootSource({
              runtimeId,
              npcs: npc,
              objects: objects!,
              params: params!,
              handlers
            });
            lootExclusionCount += extraction.exclusions.length;
            if (extraction.status !== "complete") {
              throw new Error(`LostCity loot extraction is incomplete for ${runtimeId}.`);
            }
            return [runtimeId, { ...monster, loot: extraction.loot }];
          })
        );
        const sourceLootKeys = new Set<string>();
        for (const monster of Object.values(monsters)) {
          for (const entry of monster.loot ?? []) {
            const collect = (drop: typeof entry): void => {
              if (Array.isArray(drop)) {
                drop.forEach(collect);
              } else if (drop.key) {
                sourceLootKeys.add(drop.key);
              }
            };
            collect(entry);
          }
        }
        const items = { ...baseCandidate.items };
        for (const itemId of [...sourceLootKeys].sort()) {
          const sourceItemId = lostCitySourceItemId(itemId);
          items[itemId] = objects!.entries.has(sourceItemId)
            ? extractLostCityItemSource(sourceItemId, objects!, undefined, itemId)
            : (items[itemId] ?? {
                id: itemId,
                name: itemId.replaceAll("_", " "),
                provenance: {
                  source: "generated",
                  sourceRef: "LostCity RuneScript loot symbol",
                  notes:
                    "The referenced loot symbol has no parsed object config; value remains intentionally unresolved."
                }
              });
        }
        return parseGameDataSnapshot({
          ...baseCandidate,
          id: `${baseCandidate.id}-source-loot-candidate`,
          label: `${baseCandidate.label} and source loot`,
          monsters,
          items
        });
      })()
    : parseGameDataSnapshot(baseCandidate);
  const priceSet = createGeneratedRuntimePriceSet(input.priceSet, candidate);
  const detail = input.detailMonsterId
    ? {
        monsterId: input.detailMonsterId,
        styles: SOURCE_IMPACT_STYLE_CONFIG.map(({ combatStyle }) => {
          const simulationInput = sourceImpactInput(input.detailMonsterId!, combatStyle);
          const baseline = simulateFullSimulation(simulationInput, {
            gameData: input.reference,
            priceSet
          });
          const candidateResult = simulateFullSimulation(simulationInput, {
            gameData: candidate,
            priceSet
          });
          const indexedRows = (
            rows: typeof baseline.trip.lootBreakdown
          ): Map<string, (typeof rows)[number]> => {
            const counts = new Map<string, number>();
            return new Map(
              rows.map((row) => {
                const base = `${row.key ?? row.tag ?? row.name}|${row.chance.toFixed(5)}|${row.qtyAvg}`;
                const occurrence = (counts.get(base) ?? 0) + 1;
                counts.set(base, occurrence);
                return [`${base}|${occurrence}`, row];
              })
            );
          };
          const baselineRows = indexedRows(baseline.trip.lootBreakdown);
          const candidateRows = indexedRows(candidateResult.trip.lootBreakdown);
          const signatures = [...new Set([...baselineRows.keys(), ...candidateRows.keys()])].sort();
          const formatRow = (row: (typeof baseline.trip.lootBreakdown)[number]): string =>
            `${row.name}; pref=${row.pref}; price=${row.price}; evGp=${row.evGp}; slot=${row.slotFrac}; prayerXp=${row.prayerXp}`;
          const changedRows = signatures.flatMap((signature) => {
            const baselineRow = baselineRows.get(signature);
            const candidateRow = candidateRows.get(signature);
            const changed =
              !baselineRow ||
              !candidateRow ||
              baselineRow.name !== candidateRow.name ||
              baselineRow.pref !== candidateRow.pref ||
              Math.abs(baselineRow.evGp - candidateRow.evGp) > 0.000001 ||
              baselineRow.slotFrac !== candidateRow.slotFrac ||
              baselineRow.prayerXp !== candidateRow.prayerXp;
            return changed
              ? [
                  {
                    signature,
                    ...(baselineRow ? { baseline: formatRow(baselineRow) } : {}),
                    ...(candidateRow ? { candidate: formatRow(candidateRow) } : {})
                  }
                ]
              : [];
          });
          return {
            combatStyle,
            baselineGpPerKill: baseline.trip.gpPerKill,
            candidateGpPerKill: candidateResult.trip.gpPerKill,
            changedRows
          };
        })
      }
    : undefined;
  return {
    sourceDir: npc.sourceDirLabel,
    sourceRevision:
      input.sourceRevision ?? resolveLostCitySourceRevision(resolve(repoRoot, input.sourceDir)),
    referenceSnapshotId: input.reference.id,
    candidateSnapshotId: candidate.id,
    monsterCount: Object.keys(candidate.monsters).length,
    fields: includeCombat ? LOSTCITY_MONSTER_COMBAT_FIELDS : [],
    equipmentFields: includeEquipment ? LOSTCITY_EQUIPMENT_COMPARISON_FIELDS : [],
    weaponFields: includeCombatCatalog ? LOSTCITY_WEAPON_COMPARISON_FIELDS : [],
    ammoFields: includeCombatCatalog ? LOSTCITY_AMMO_COMPARISON_FIELDS : [],
    spellFields: includeCombatCatalog ? LOSTCITY_SPELL_COMPARISON_FIELDS : [],
    includeLoot: input.includeLoot ?? false,
    includeCombat,
    includeEquipment,
    includeCombatCatalog,
    lootExclusionCount,
    evidence: createCalculationImpactEvidence({
      baseline: input.reference,
      candidate,
      priceSet,
      baselineLabel: input.reference.id,
      impactOutlierLimit: input.impactOutlierLimit,
      representativeCases: [
        ...LOSTCITY_SOURCE_IMPACT_CASES,
        ...(includeEquipment ? LOSTCITY_EQUIPMENT_IMPACT_CASES : []),
        ...(includeCombatCatalog ? LOSTCITY_COMBAT_CATALOG_IMPACT_CASES : [])
      ],
      allMonsterBaselines: [
        ...LOSTCITY_SOURCE_ALL_MONSTER_BASELINES,
        ...(includeCombatCatalog ? LOSTCITY_COMBAT_CATALOG_ALL_MONSTER_BASELINES : [])
      ]
    }),
    ...(detail ? { detail } : {})
  };
}

export function formatLostCitySourceImpactMarkdown(report: LostCitySourceImpactReport): string {
  return (
    [
      "# LostCity source calculation impact",
      "",
      `Source: ${report.sourceDir}`,
      `Revision: ${report.sourceRevision}`,
      `Reference snapshot: ${report.referenceSnapshotId}`,
      `Candidate snapshot: ${report.candidateSnapshotId}`,
      `Monsters: ${report.monsterCount}`,
      `Combat fields replaced: ${report.includeCombat ? report.fields.join(", ") : "no"}`,
      `Equipment fields replaced: ${report.includeEquipment ? report.equipmentFields.join(", ") : "no"}`,
      `Weapon fields replaced: ${report.includeCombatCatalog ? report.weaponFields.join(", ") : "no"}`,
      `Ammo fields replaced: ${report.includeCombatCatalog ? report.ammoFields.join(", ") : "no"}`,
      `Spell fields replaced: ${report.includeCombatCatalog ? report.spellFields.join(", ") : "no"}`,
      `Loot replaced: ${report.includeLoot ? `yes (${report.lootExclusionCount} modeled conditional rows excluded from default valuation)` : "no"}`,
      "Scope: in-memory evidence only; sections not listed as replaced remain at reference values.",
      "This read-only report neither accepts new source differences nor changes the committed runtime.",
      "",
      formatCalculationImpactEvidenceMarkdown(report.evidence),
      ...(report.detail
        ? [
            "",
            "## Monster Loot Detail",
            "",
            `Monster: ${report.detail.monsterId}`,
            ...report.detail.styles.flatMap((style) => [
              "",
              `### ${style.combatStyle}`,
              `- GP/kill: ${style.baselineGpPerKill} -> ${style.candidateGpPerKill}`,
              `- Changed rows: ${style.changedRows.length}`,
              ...style.changedRows.map(
                (row) =>
                  `- ${row.signature}: baseline=${row.baseline ?? "missing"}; candidate=${row.candidate ?? "missing"}`
              )
            ])
          ]
        : []),
      "",
      "## Decision Boundary",
      "",
      "- Revision 274 combat, core-loot, equipment and combat-catalog deltas are accepted by D-055, D-056 and D-057; future source changes require fresh review.",
      "- The committed generator report, not this read-only diagnostic, owns accepted-delta notes for the active runtime.",
      "- Quest/clue eligibility activation and requirement quest-state inference remain separate player-state decision boundaries.",
      "- Loot, equipment, weapon/ammo and monster-combat extraction remain independently selectable evidence slices."
    ].join("\n") + "\n"
  );
}

export function parseLostCitySourceImpactArgs(argv: string[]): LostCitySourceImpactCliOptions {
  const options: LostCitySourceImpactCliOptions = {
    sourceDir: DEFAULT_GAME_DATA_SOURCE_DIR,
    format: "markdown",
    impactOutlierLimit: 25,
    includeLoot: false,
    includeCombat: true,
    includeEquipment: false,
    includeCombatCatalog: false,
    detailMonsterId: undefined
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.format = "json";
      continue;
    }
    if (arg === "--include-loot") {
      options.includeLoot = true;
      continue;
    }
    if (arg === "--loot-only") {
      options.includeLoot = true;
      options.includeCombat = false;
      continue;
    }
    if (arg === "--include-equipment") {
      options.includeEquipment = true;
      continue;
    }
    if (arg === "--equipment-only") {
      options.includeEquipment = true;
      options.includeCombat = false;
      options.includeLoot = false;
      continue;
    }
    if (arg === "--include-combat-catalog") {
      options.includeCombatCatalog = true;
      continue;
    }
    if (arg === "--combat-catalog-only") {
      options.includeCombatCatalog = true;
      options.includeCombat = false;
      options.includeEquipment = false;
      options.includeLoot = false;
      continue;
    }
    if (arg === "--source-dir" || arg === "--impact-outlier-limit" || arg === "--detail-monster") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      if (arg === "--source-dir") {
        options.sourceDir = value;
      } else if (arg === "--detail-monster") {
        options.detailMonsterId = value;
      } else {
        const limit = Number(value);
        if (!Number.isInteger(limit) || limit < 0) {
          throw new Error("--impact-outlier-limit must be a non-negative integer");
        }
        options.impactOutlierLimit = limit;
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument ${arg}`);
  }
  return options;
}

function readReferenceSnapshot(): GameDataSnapshot {
  return parseGameDataSnapshot(
    parseJsonWithDuplicateKeyCheck(
      readFileSync("src/data/generated/legacy-derived-runtime-game-data.json", "utf8"),
      { source: "legacy-derived runtime game data" }
    )
  );
}

function readReferencePriceSet(): PriceSet {
  return PriceSetSchema.parse(
    parseJsonWithDuplicateKeyCheck(
      readFileSync("src/data/generated/legacy-derived-runtime-price-set.json", "utf8"),
      { source: "legacy-derived runtime price set" }
    )
  ) as PriceSet;
}

export function main(argv = process.argv.slice(2)): void {
  const options = parseLostCitySourceImpactArgs(argv);
  const report = createLostCitySourceImpactReport({
    sourceDir: options.sourceDir,
    reference: readReferenceSnapshot(),
    priceSet: readReferencePriceSet(),
    impactOutlierLimit: options.impactOutlierLimit,
    includeLoot: options.includeLoot,
    includeCombat: options.includeCombat,
    includeEquipment: options.includeEquipment,
    includeCombatCatalog: options.includeCombatCatalog,
    detailMonsterId: options.detailMonsterId
  });
  console.log(
    options.format === "json"
      ? JSON.stringify(report, null, 2)
      : formatLostCitySourceImpactMarkdown(report)
  );
}

function isDirectCliRun(): boolean {
  return process.env.LOSTCITY_SOURCE_IMPACT_CLI === "1";
}

if (isDirectCliRun()) {
  try {
    main();
  } catch (error) {
    console.error(
      `data:source-impact failed: ${error instanceof Error ? error.message : "internal-error"}`
    );
    process.exitCode = 1;
  }
}

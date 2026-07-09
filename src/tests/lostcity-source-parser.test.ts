import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  LostCityContentSourceError,
  configParamValue,
  lastConfigValue,
  readLostCityConfigCatalog
} from "../../scripts/lostcity-content-config";
import {
  readLostCityLootHandlerCatalog,
  resolveLostCityLootHandler
} from "../../scripts/lostcity-content-loot";
import { extractLostCityMonsterLootSource } from "../../scripts/lostcity-content-loot-extractor";
import {
  createLostCityItemCandidate,
  extractLostCityItemSource
} from "../../scripts/lostcity-content-items";
import {
  createLostCityEquipmentCandidate,
  extractLostCityEquipmentSource
} from "../../scripts/lostcity-content-equipment";
import {
  createLostCityCombatCatalogCandidate,
  extractLostCityAmmoSource,
  extractLostCityWeaponSource
} from "../../scripts/lostcity-content-combat-catalog";
import {
  createLostCitySpellCandidate,
  extractLostCitySpellSource
} from "../../scripts/lostcity-content-spells";
import {
  createLostCitySourceCoverageReport,
  formatLostCitySourceCoverageMarkdown,
  parseLostCitySourceCoverageArgs
} from "../../scripts/report-lostcity-source-coverage";
import {
  createLostCityMonsterCombatCandidate,
  extractLostCityMonsterCombatSource
} from "../../scripts/lostcity-content-monsters";
import {
  LOSTCITY_EQUIPMENT_SOURCE_MAPPINGS,
  LOSTCITY_SYNTHETIC_RUNTIME_ITEM_IDS,
  lostCityRuntimeItemId,
  lostCitySourceItemId,
  lostCityWeaponSourceId
} from "../../scripts/lostcity-content-runtime-mapping";
import { parseLostCitySourceImpactArgs } from "../../scripts/report-lostcity-source-impact";
import { createLostCityRawSnapshot } from "../../scripts/lostcity-content-snapshot";
import { EQUIPMENT_SLOTS, type GameDataSnapshot } from "../domain/shared";

const FIXTURE_SOURCE = "src/tests/fixtures/lostcity-source";
const TEST_ROOT = join(process.cwd(), ".vite", "lostcity-source-parser-test");

function emptyEquipment(): GameDataSnapshot["equipment"] {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, {}])) as GameDataSnapshot["equipment"];
}

function referenceSnapshot(): GameDataSnapshot {
  const equipment = emptyEquipment();
  equipment.ring.ring_of_recoil = { name: "Ring of recoil", recoil: true };
  equipment.helm.none = { name: "None" };
  return {
    id: "raw-source-audit-reference",
    label: "Raw source audit reference",
    items: {
      rune_scimitar: { id: "rune_scimitar", name: "Rune scimitar" },
      bronze_arrow: { id: "bronze_arrow", name: "Bronze arrow" },
      bronze_dart_w: { id: "bronze_dart_w", name: "Bronze darts (thrown)" },
      missing_item: { id: "missing_item", name: "Missing item" }
    },
    monsters: {
      giant: {
        id: "giant",
        name: "Giant",
        level: 28,
        hp: 35,
        attack: 18,
        strength: 22,
        defLevel: 26,
        attackSpeed: 6,
        attBonus: 18,
        strBonus: 16,
        magicLevel: 1,
        defStab: 0,
        defSlash: 0,
        defCrush: 0,
        defRange: 0,
        defMagic: 0
      },
      bear: {
        id: "bear",
        name: "Bear",
        level: 19,
        hp: 20,
        attack: 15,
        strength: 16,
        defLevel: 14,
        attackSpeed: 4,
        attBonus: 0,
        strBonus: 0,
        magicLevel: 1,
        defStab: 0,
        defSlash: 0,
        defCrush: 0,
        defRange: 0,
        defMagic: 0
      }
    },
    weapons: {
      rune_scimitar: {
        name: "Rune scimitar",
        type: "melee",
        accBonus: 45,
        dmgBonus: 44,
        speed: 4
      },
      bronze_dart_w: {
        name: "Bronze darts (thrown)",
        type: "ranged",
        accBonus: 0,
        dmgBonus: 0,
        speed: 3
      }
    },
    ammo: {
      bronze_arrow: { name: "Bronze arrow", rangeBonus: 7 }
    },
    spells: {
      wind_strike: {
        name: "Wind Strike",
        base: 2,
        lvl: 1,
        baseXp: 5.5,
        label: "Wind Strike (max 2)",
        runes: { airrune: 1, mindrune: 1 }
      },
      water_strike: {
        name: "Water Strike",
        base: 4,
        lvl: 5,
        baseXp: 7.5,
        label: "Water Strike (max 4)",
        runes: { airrune: 1, mindrune: 1, waterrune: 1 }
      }
    },
    equipment
  };
}

describe("LostCity content source parser", () => {
  beforeEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  it("parses deterministic config catalogs and preserves repeated params", () => {
    const npc = readLostCityConfigCatalog({ sourceDir: FIXTURE_SOURCE, extension: ".npc" });
    const obj = readLostCityConfigCatalog({ sourceDir: FIXTURE_SOURCE, extension: ".obj" });
    const params = readLostCityConfigCatalog({ sourceDir: FIXTURE_SOURCE, extension: ".param" });
    const dbrows = readLostCityConfigCatalog({
      sourceDir: FIXTURE_SOURCE,
      extension: ".dbrow"
    });

    expect(npc.fileCount).toBe(1);
    expect([...npc.entries.keys()]).toEqual(["giant", "lesser_demon", "darkbear"]);
    expect(lastConfigValue(npc.entries.get("giant"), "hitpoints")).toBe("35");
    expect(configParamValue(npc.entries.get("giant"), "attackrate")).toBe("6");
    expect(obj.entries.get("rune_scimitar")?.properties.param).toEqual([
      "stabattack,7",
      "slashattack,45",
      "crushattack,-2",
      "strengthbonus,44",
      "attackrate,4"
    ]);
    expect(obj.entries.get("rune_scimitar")?.sourceRef).toBe(
      "scripts/skill_combat/configs/items.obj#rune_scimitar"
    );
    expect(extractLostCityMonsterCombatSource("giant", npc)).toMatchObject({
      runtimeId: "giant",
      sourceId: "giant",
      fields: {
        level: 28,
        hp: 35,
        attackSpeed: 6,
        attBonus: 18,
        strBonus: 16,
        magicLevel: 1
      }
    });
    expect(
      extractLostCityEquipmentSource({
        slot: "ring",
        runtimeId: "ring_of_recoil",
        runtime: { name: "Ring of recoil", recoil: true },
        objects: obj
      })
    ).toMatchObject({
      sourceItemId: "ring_of_recoil",
      resolution: "direct",
      definition: { name: "Ring of recoil", alch: 540, recoil: true }
    });
    expect(createLostCityEquipmentCandidate(referenceSnapshot(), obj)).toMatchObject({
      id: expect.stringContaining("lostcity-equipment-candidate"),
      equipment: {
        helm: { none: { name: "None" } },
        ring: { ring_of_recoil: { name: "Ring of recoil", alch: 540, recoil: true } }
      }
    });
    const reference = referenceSnapshot();
    expect(
      extractLostCityWeaponSource({
        runtimeId: "bronze_dart_w",
        runtime: reference.weapons.bronze_dart_w,
        objects: obj,
        params
      })
    ).toMatchObject({
      name: "Bronze darts (thrown)",
      type: "ranged",
      accBonus: 3,
      dmgBonus: 0,
      speed: 3,
      alch: 1
    });
    expect(
      extractLostCityAmmoSource({
        runtimeId: "bronze_arrow",
        runtime: reference.ammo.bronze_arrow,
        objects: obj
      })
    ).toMatchObject({ rangeBonus: 7, price: 1, alch: 1 });
    expect(
      extractLostCitySpellSource({
        runtimeId: "wind_strike",
        runtime: reference.spells.wind_strike,
        dbrows
      })
    ).toEqual(reference.spells.wind_strike);
    expect(createLostCitySpellCandidate(reference, dbrows).spells.water_strike).toEqual(
      reference.spells.water_strike
    );
    expect(createLostCityItemCandidate(reference, obj, "fixture-274").items.rune_scimitar)
      .toMatchObject({ price: 25600, alch: 15360 });
    expect(createLostCityCombatCatalogCandidate(reference, obj, params, dbrows).weapons.bronze_dart_w)
      .toMatchObject({ accBonus: 3, speed: 3 });
  });

  it("rejects duplicate config ids with repository-relative sanitized evidence", () => {
    const sourceDir = join(TEST_ROOT, "duplicate-source");
    cpSync(FIXTURE_SOURCE, sourceDir, { recursive: true });
    const duplicateDir = join(sourceDir, "scripts", "other", "configs");
    mkdirSync(duplicateDir, { recursive: true });
    writeFileSync(join(duplicateDir, "duplicate.npc"), "[giant]\nname=Other giant\n");

    let error: unknown;
    try {
      readLostCityConfigCatalog({
        sourceDir: ".vite/lostcity-source-parser-test/duplicate-source",
        extension: ".npc"
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(LostCityContentSourceError);
    expect((error as LostCityContentSourceError).code).toBe("duplicate_config");
    expect((error as Error).message).toContain("`giant`");
    expect((error as Error).message).not.toContain(process.cwd());
  });

  it("indexes dedicated loot handlers and rejects duplicate ai_queue3 triggers", () => {
    const catalog = readLostCityLootHandlerCatalog({ sourceDir: FIXTURE_SOURCE });
    expect(catalog.handlers.get("giant")).toMatchObject({
      npcId: "giant",
      sourceRef: "scripts/drop tables/scripts/giant.rs2:1#giant"
    });
    const npc = readLostCityConfigCatalog({ sourceDir: FIXTURE_SOURCE, extension: ".npc" });
    expect(resolveLostCityLootHandler("darkbear", npc.entries.get("darkbear"), catalog)).toMatchObject({
      kind: "category",
      handler: { npcId: "_bear" }
    });

    const sourceDir = join(TEST_ROOT, "duplicate-handler-source");
    cpSync(FIXTURE_SOURCE, sourceDir, { recursive: true });
    const duplicateDir = join(sourceDir, "scripts", "other");
    mkdirSync(duplicateDir, { recursive: true });
    writeFileSync(join(duplicateDir, "duplicate.rs2"), "[ai_queue3,giant]\n");

    expect(() =>
      readLostCityLootHandlerCatalog({
        sourceDir: ".vite/lostcity-source-parser-test/duplicate-handler-source"
      })
    ).toThrowError(LostCityContentSourceError);
    try {
      readLostCityLootHandlerCatalog({
        sourceDir: ".vite/lostcity-source-parser-test/duplicate-handler-source"
      });
    } catch (error) {
      expect((error as LostCityContentSourceError).code).toBe("duplicate_script_trigger");
      expect((error as Error).message).not.toContain(process.cwd());
    }
  });

  it("extracts default and threshold-table loot without evaluating RuneScript", () => {
    const npcs = readLostCityConfigCatalog({ sourceDir: FIXTURE_SOURCE, extension: ".npc" });
    const objects = readLostCityConfigCatalog({ sourceDir: FIXTURE_SOURCE, extension: ".obj" });
    const params = readLostCityConfigCatalog({ sourceDir: FIXTURE_SOURCE, extension: ".param" });
    const handlers = readLostCityLootHandlerCatalog({ sourceDir: FIXTURE_SOURCE });

    expect(
      extractLostCityMonsterLootSource({
        runtimeId: "giant",
        npcs,
        objects,
        params,
        handlers
      })
    ).toMatchObject({
      status: "complete",
      issues: [],
      loot: [
        { key: "big_bones", chance: 1, qtyAvg: 1 },
        { key: "rune_scimitar", chance: 4 / 128, qtyAvg: 1 },
        { key: "bronze_arrow", chance: 4 / 128, qtyAvg: 10 }
      ]
    });
    expect(extractLostCityItemSource("rune_scimitar", objects, "fixture-274")).toMatchObject({
      id: "rune_scimitar",
      name: "Rune scimitar",
      price: 25600,
      alch: 15360,
      provenance: { source: "generated", revision: "fixture-274" }
    });
  });

  it("reports direct runtime ids separately from mapping-needed ids", () => {
    const report = createLostCitySourceCoverageReport({
      sourceDir: FIXTURE_SOURCE,
      reference: referenceSnapshot(),
      sourceRevision: "fixture-274",
      exampleLimit: 2
    });
    const markdown = formatLostCitySourceCoverageMarkdown(report);

    expect(report.sourceRevision).toBe("fixture-274");
    expect(report.catalogs).toMatchObject({
      npcEntries: 3,
      objEntries: 7,
      dbrowEntries: 2
    });
    expect(report.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "monsters",
          referenceCount: 2,
          directCount: 1,
          mappedCount: 1,
          syntheticCount: 0,
          unresolvedCount: 0
        }),
        expect.objectContaining({
          section: "items",
          referenceCount: 4,
          directCount: 3,
          syntheticCount: 1,
          unresolvedCount: 0
        }),
        expect.objectContaining({
          section: "weapons",
          referenceCount: 2,
          directCount: 1,
          mappedCount: 1,
          syntheticCount: 0,
          unresolvedCount: 0
        }),
        expect.objectContaining({
          section: "spells",
          referenceCount: 2,
          directCount: 2,
          unresolvedCount: 0
        }),
        expect.objectContaining({
          section: "equipment",
          referenceCount: 2,
          directCount: 1,
          mappedCount: 0,
          syntheticCount: 1,
          unresolvedCount: 0
        })
      ])
    );
    expect(report.monsterCombatFields).toMatchObject({
      referenceCount: 2,
      exactCount: 2,
      differingCount: 0,
      differingIds: []
    });
    expect(report.equipmentFields).toMatchObject({
      referenceCount: 2,
      exactCount: 1,
      differingCount: 1,
      differingIds: ["ring:ring_of_recoil"],
      differenceCounts: { alch: 1 }
    });
    expect(report.weaponFields).toMatchObject({
      referenceCount: 2,
      exactCount: 0,
      differingCount: 2,
      differingIds: ["rune_scimitar", "bronze_dart_w"]
    });
    expect(report.ammoFields).toMatchObject({
      referenceCount: 1,
      exactCount: 0,
      differingCount: 1,
      differingIds: ["bronze_arrow"]
    });
    expect(report.spellFields).toMatchObject({
      referenceCount: 2,
      exactCount: 2,
      differingCount: 0,
      differingIds: []
    });
    expect(report.monsterLootItemKeys).toMatchObject({
      sourceKeyCount: 4,
      referenceCoveredCount: 2,
      sourceOnlyDefinedCount: 2,
      unresolvedCount: 0
    });
    expect(
      Object.values(report.monsterCombatFields.differenceCounts).every((count) => count === 0)
    ).toBe(true);
    expect(report.monsterLootOwnership).toMatchObject({
      runtimeMonsters: 2,
      dedicatedHandlerCount: 2,
      directHandlerCount: 1,
      categoryHandlerCount: 1,
      defaultDropCount: 2,
      handlerAndDefaultDropCount: 2,
      noDeclaredDropCount: 0
    });
    expect(markdown).toContain(
      "Scope: read-only direct, reviewed and simulator-synthetic identity evidence; committed generator output and accepted decisions own runtime truth."
    );
    expect(markdown).toContain("| monsters | 2 | 1 | 1 | 0 | 0 | - |");
    expect(markdown).toContain("equipment synthetic identities: helm:none");
    expect(markdown).toContain("## Equipment Field Comparison");
    expect(markdown).toContain("## Weapon Field Comparison");
    expect(markdown).toContain("## Ammo Field Comparison");
    expect(markdown).toContain("## Spell Field Comparison");
    expect(markdown).toContain("Source-only with parsed object definition: 2");
    expect(markdown).not.toContain(process.cwd());
  });

  it("normalizes only reviewed LostCity source item identities", () => {
    expect(lostCityRuntimeItemId("adamnt_warhammer")).toBe("adamant_warhammer");
    expect(lostCitySourceItemId("adamant_warhammer")).toBe("adamnt_warhammer");
    expect(lostCityRuntimeItemId("wizards_robe")).toBe("wizard_robe_top");
    expect(lostCitySourceItemId("wizard_robe_top")).toBe("wizards_robe");
    expect(lostCitySourceItemId("prayer_potion")).toBe("4doseprayerrestore");
    expect(lostCitySourceItemId("tooth_half_key")).toBe("keyhalf1");
    expect(lostCityRuntimeItemId("steel_sq_shield")).toBe("steel_sq_shield");
    expect(LOSTCITY_SYNTHETIC_RUNTIME_ITEM_IDS.has("super_set")).toBe(true);
    expect(LOSTCITY_SYNTHETIC_RUNTIME_ITEM_IDS.has("cert_swordfish")).toBe(true);
    expect(lostCityWeaponSourceId("bronze_dart_w")).toBe("bronze_dart");
    expect(lostCityWeaponSourceId("rune_knife_w")).toBe("rune_knife");
    expect(lostCityWeaponSourceId("rune_scimitar")).toBe("rune_scimitar");
    expect(LOSTCITY_EQUIPMENT_SOURCE_MAPPINGS["helm:green_hat"]?.sourceItemId).toBe(
      "gnome_hat_green"
    );
    expect(LOSTCITY_EQUIPMENT_SOURCE_MAPPINGS["cape:god_cape"]?.sourceItemId).toBe(
      "guthix_cape"
    );
  });

  it("parses CLI options without selecting source fields", () => {
    expect(
      parseLostCitySourceCoverageArgs([
        "--source-dir",
        FIXTURE_SOURCE,
        "--json",
        "--example-limit",
        "3"
      ])
    ).toEqual({ sourceDir: FIXTURE_SOURCE, format: "json", exampleLimit: 3 });
  });

  it("builds a validated in-memory monster combat candidate without replacing loot", () => {
    const reference = referenceSnapshot();
    reference.monsters.giant.loot = [
      { name: "Missing item", key: "missing_item", chance: 1, qtyAvg: 1 }
    ];
    const npc = readLostCityConfigCatalog({ sourceDir: FIXTURE_SOURCE, extension: ".npc" });
    const candidate = createLostCityMonsterCombatCandidate(reference, npc);

    expect(candidate.id).toContain("lostcity-monster-combat-candidate");
    expect(candidate.monsters.giant).toMatchObject({
      hp: 35,
      attackSpeed: 6,
      attBonus: 18,
      strBonus: 16,
      loot: reference.monsters.giant.loot
    });
    expect(candidate.monsters.bear).toMatchObject({
      id: "bear",
      name: "Bear",
      hp: 20,
      attackSpeed: 4
    });
    expect(reference.id).toBe("raw-source-audit-reference");
  });

  it("builds a full raw source-backed snapshot from simulator runtime identities", () => {
    const result = createLostCityRawSnapshot({
      sourceDir: FIXTURE_SOURCE,
      reference: referenceSnapshot(),
      sourceRevision: "fixture-274",
      generatedAt: "2026-07-09T00:00:00.000Z"
    });

    expect(result.lootExclusionCount).toBe(0);
    expect(result.snapshot.id).toBe("lostcity-fixture-274-runtime");
    expect(result.snapshot.monsters.giant).toMatchObject({
      hp: 35,
      loot: expect.arrayContaining([
        expect.objectContaining({ key: "big_bones", chance: 1 })
      ]),
      provenance: { source: "generated" }
    });
    expect(result.snapshot.weapons.bronze_dart_w).toMatchObject({
      accBonus: 3,
      speed: 3
    });
    expect(result.snapshot.spells.wind_strike).toEqual(referenceSnapshot().spells.wind_strike);
    expect(result.snapshot.items.bronze_dart_w?.provenance?.source).toBe("manual");
  });

  it("parses isolated source-impact options", () => {
    expect(
      parseLostCitySourceImpactArgs([
        "--source-dir",
        FIXTURE_SOURCE,
        "--json",
        "--loot-only",
        "--detail-monster",
        "giant",
        "--impact-outlier-limit",
        "7"
      ])
    ).toEqual({
      sourceDir: FIXTURE_SOURCE,
      format: "json",
      impactOutlierLimit: 7,
      includeLoot: true,
      includeCombat: false,
      includeEquipment: false,
      includeCombatCatalog: false,
      detailMonsterId: "giant"
    });
    expect(parseLostCitySourceImpactArgs(["--equipment-only"])).toMatchObject({
      includeLoot: false,
      includeCombat: false,
      includeEquipment: true
    });
    expect(parseLostCitySourceImpactArgs(["--combat-catalog-only"])).toMatchObject({
      includeLoot: false,
      includeCombat: false,
      includeEquipment: false,
      includeCombatCatalog: true
    });
  });
});

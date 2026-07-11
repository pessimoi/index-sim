import { loadBundledLegacyContext } from "../adapters/browser";
import {
  createGeneratedRuntimeContext,
  createGeneratedRuntimeReadinessReport,
  withGeneratedAlchAuthority
} from "../adapters/generated";
import { createLegacyDerivedStaticRuntimeContext } from "../adapters/static-runtime";
import {
  formatGeneratedRuntimeReadinessMarkdown,
  formatSourceSliceCoveragePlanMarkdown,
  parseArgs
} from "../../scripts/report-generated-runtime-readiness";

describe("generated runtime adapter", () => {
  it("keeps imported market prices but replaces imported high-alch overrides", () => {
    const runtime = createGeneratedRuntimeContext();
    const imported = {
      id: "imported-prices",
      label: "Imported prices",
      source: "imported" as const,
      createdAt: "2026-07-10T00:00:00.000Z",
      itemPrices: { rune_scimitar: 99_999 },
      alchValues: { rune_scimitar: 1 }
    };

    const composed = withGeneratedAlchAuthority(imported, runtime.context.gameData);

    expect(composed.itemPrices.rune_scimitar).toBe(99_999);
    expect(composed.alchValues.rune_scimitar).toBe(
      runtime.context.gameData.items.rune_scimitar.alch
    );
    expect(composed.alchValues.rune_scimitar).not.toBe(1);
  });

  it("creates a validated SimulationContext from committed generated data and static prices", () => {
    const result = createGeneratedRuntimeContext({
      loadedAt: "2026-07-09T00:00:00.000Z"
    });

    expect(result.source).toBe("generated-static-snapshot");
    expect(result.context.gameData.id).toBe("lostcity-376072662e78-runtime");
    expect(result.context.gameData.provenance?.source).toBe("generated");
    expect(Object.keys(result.context.gameData.monsters)).toContain("giant");
    expect(Object.keys(result.context.gameData.requirements ?? {})).toHaveLength(94);
    expect(result.context.gameData.requirements?.dragon_halberd?.skills).toEqual({
      attack: 60,
      strength: 30
    });
    expect(result.context.gameData.monsters.rock_crab?.size).toBe(1);
    expect(result.context.gameData.items.sapphire).toMatchObject({
      name: "Sapphire",
      price: 250
    });
    expect(result.context.gameData.items.uncut_sapphire).toMatchObject({
      name: "Uncut sapphire",
      price: 25
    });
    expect(result.context.priceSet.label).toBe(
      "Scheduled static prices + generated item fallbacks"
    );
    expect(result.context.priceSet.source).toBe("scraped");
    expect(result.context.priceSet.itemPrices.rune_scimitar).toBe(23400);
    expect(result.context.priceSet.itemPrices["1dose2defense"]).toBe(132);
    expect(result.context.priceSet.alchValues.adamant_spear).toBe(1248);
    expect(result.context.priceSet.provenance?.notes).toContain(
      "high-alch values are authoritative generated game data"
    );
  });

  it("reports the raw generated runtime catalog ready when ids and required fields are covered", async () => {
    const legacy = await loadBundledLegacyContext();
    const generated = createGeneratedRuntimeContext({
      loadedAt: "2026-07-09T00:00:00.000Z"
    });
    const report = createGeneratedRuntimeReadinessReport({
      reference: legacy.context,
      candidate: generated.context,
      exampleLimit: 3
    });

    const monsterCoverage = report.sections.find((section) => section.section === "monsters");
    const itemCoverage = report.sections.find((section) => section.section === "items");
    const itemFieldCoverage = report.sections.find(
      (section) => section.section === "items.runtimeFields"
    );
    const monsterCombatStatCoverage = report.sections.find(
      (section) => section.section === "monsters.combatStats"
    );
    const monsterLootCoverage = report.sections.find(
      (section) => section.section === "monsters.loot"
    );
    const equipmentCoverage = report.sections.find((section) => section.section === "equipment");
    const weaponFieldCoverage = report.sections.find(
      (section) => section.section === "weapons.runtimeFields"
    );
    const ammoFieldCoverage = report.sections.find(
      (section) => section.section === "ammo.runtimeFields"
    );
    const spellFieldCoverage = report.sections.find(
      (section) => section.section === "spells.runtimeFields"
    );
    const equipmentFieldCoverage = report.sections.find(
      (section) => section.section === "equipment.runtimeFields"
    );
    const itemPriceCoverage = report.sections.find(
      (section) => section.section === "priceSet.itemPrices"
    );
    const alchCoverage = report.sections.find(
      (section) => section.section === "priceSet.alchValues"
    );

    expect(report.ready).toBe(true);
    expect(report.referenceSnapshotId).toBe("browser-legacy-runtime");
    expect(report.candidateSnapshotId).toBe("lostcity-376072662e78-runtime");
    expect(monsterCoverage).toMatchObject({
      blocking: true,
      candidateCount: 63,
      missingCount: 0,
      extraCount: 0
    });
    expect(itemCoverage).toMatchObject({
      candidateCount: 386,
      missingCount: 0,
      extraCount: 15
    });
    expect(itemFieldCoverage).toMatchObject({
      candidateCount: 371,
      missingCount: 0,
      extraCount: 15
    });
    expect(monsterCombatStatCoverage).toMatchObject({
      blocking: true,
      candidateCount: 63,
      missingCount: 0,
      extraCount: 0
    });
    expect(monsterLootCoverage).toMatchObject({
      candidateCount: 63,
      missingCount: 0,
      extraCount: 0
    });
    expect(monsterCoverage?.referenceCount).toBeGreaterThan(20);
    expect(equipmentCoverage).toMatchObject({
      candidateCount: 86,
      missingCount: 0,
      extraCount: 0
    });
    expect(weaponFieldCoverage).toMatchObject({
      candidateCount: 35,
      missingCount: 0,
      extraCount: 0
    });
    expect(ammoFieldCoverage).toMatchObject({
      candidateCount: 18,
      missingCount: 0,
      extraCount: 0
    });
    expect(spellFieldCoverage).toMatchObject({
      candidateCount: 19,
      missingCount: 0,
      extraCount: 0
    });
    expect(equipmentFieldCoverage).toMatchObject({
      candidateCount: 86,
      missingCount: 0,
      extraCount: 0
    });
    expect(itemPriceCoverage?.missingCount).toBe(0);
    expect(alchCoverage?.missingCount).toBe(0);
    expect(report.blockers).toEqual([]);
    expect(monsterCoverage?.missingExamples.length).toBeLessThanOrEqual(3);
  });

  it("formats the complete generated coverage report for review", async () => {
    expect(parseArgs(["--json", "--example-limit", "2", "--allow-not-ready"])).toEqual({
      format: "json",
      candidate: "generated",
      exampleLimit: 2,
      allowNotReady: true
    });

    const legacy = await loadBundledLegacyContext();
    const generated = createGeneratedRuntimeContext({
      loadedAt: "2026-07-09T00:00:00.000Z"
    });
    const markdown = formatGeneratedRuntimeReadinessMarkdown(
      createGeneratedRuntimeReadinessReport({
        reference: legacy.context,
        candidate: generated.context,
        exampleLimit: 2
      })
    );

    expect(markdown).toContain("# Generated runtime readiness");
    expect(markdown).toContain("Status: ready");
    expect(markdown).toContain("Scope: coverage evidence only");
    expect(markdown).toContain(
      "| Section | Blocking | Reference | Candidate | Matched | Missing | Extra | Examples |"
    );
    expect(markdown).toContain("| monsters.combatStats | yes |");
    expect(markdown).toContain("| equipment.runtimeFields | yes |");
    expect(markdown).toContain("- none");
    expect(markdown).not.toContain(process.cwd());
  });

  it("prints an empty blocking coverage plan when raw generated coverage is complete", async () => {
    expect(parseArgs(["--coverage-plan", "--example-limit", "2"])).toEqual({
      format: "coverage-plan",
      candidate: "generated",
      exampleLimit: 2,
      allowNotReady: false
    });

    const legacy = await loadBundledLegacyContext();
    const generated = createGeneratedRuntimeContext({
      loadedAt: "2026-07-09T00:00:00.000Z"
    });
    const report = createGeneratedRuntimeReadinessReport({
      reference: legacy.context,
      candidate: generated.context,
      exampleLimit: 2
    });
    const monsterCoverage = report.sections.find((section) => section.section === "monsters");
    const monsterCombatStatCoverage = report.sections.find(
      (section) => section.section === "monsters.combatStats"
    );
    const markdown = formatSourceSliceCoveragePlanMarkdown(report);

    expect(monsterCoverage?.missingIds.length).toBe(monsterCoverage?.missingCount);
    expect(monsterCoverage?.missingIds).toEqual([]);
    expect(monsterCombatStatCoverage?.missingIds).toEqual([]);
    expect(markdown).toContain("# Source-backed runtime coverage plan");
    expect(markdown).toContain("## Blocking Coverage Gaps");
    expect(markdown).not.toContain("| monsters |");
    expect(markdown).not.toContain("| monsters.combatStats |");
    expect(markdown).not.toContain("| monsters.loot |");
    expect(markdown).not.toContain("| weapons |");
    expect(markdown).not.toContain("| weapons.runtimeFields |");
    expect(markdown).not.toContain("| ammo |");
    expect(markdown).not.toContain("| spells |");
    expect(markdown).not.toContain("| equipment |");
    expect(markdown).not.toContain("| items |");
    expect(markdown).not.toContain("| items.runtimeFields |");
    expect(markdown).not.toContain("| priceSet.itemPrices |");
    expect(markdown).toContain("| none | - | - | - | - |");
    expect(markdown).toContain("Runtime coverage gaps are closed");
    expect(markdown).toContain("It does not choose upstream fields");
    expect(markdown).not.toContain(process.cwd());
  });

  it("keeps missing required runtime fields blocking while allowing accepted value deltas", async () => {
    const legacy = await loadBundledLegacyContext();
    const generated = createGeneratedRuntimeContext({
      loadedAt: "2026-07-09T00:00:00.000Z"
    });
    const candidate = structuredClone(generated.context);
    candidate.gameData.weapons.rune_scimitar.speed += 1;
    candidate.gameData.items.rune_scimitar.price = 1;

    const valueDeltaReport = createGeneratedRuntimeReadinessReport({
      reference: legacy.context,
      candidate,
      exampleLimit: 3
    });
    expect(valueDeltaReport.ready).toBe(true);

    delete (candidate.gameData.weapons.rune_scimitar as unknown as Record<string, unknown>).speed;
    delete (candidate.gameData.items.rune_scimitar as unknown as Record<string, unknown>).price;

    const report = createGeneratedRuntimeReadinessReport({
      reference: legacy.context,
      candidate,
      exampleLimit: 3
    });
    const weaponIds = report.sections.find((section) => section.section === "weapons");
    const itemIds = report.sections.find((section) => section.section === "items");
    const itemFields = report.sections.find((section) => section.section === "items.runtimeFields");
    const weaponFields = report.sections.find(
      (section) => section.section === "weapons.runtimeFields"
    );

    expect(weaponIds?.missingCount).toBe(0);
    expect(itemIds?.missingCount).toBe(0);
    expect(itemFields).toMatchObject({
      missingCount: 1,
      missingIds: ["rune_scimitar"]
    });
    expect(weaponFields).toMatchObject({
      missingCount: 1,
      missingIds: ["rune_scimitar"]
    });
    expect(report.blockers.join("\n")).toContain(
      "weapons.runtimeFields is missing required field coverage for 1"
    );
  });

  it("loads the legacy-derived static bridge as a runtime-ready replacement candidate", async () => {
    expect(parseArgs(["--candidate", "legacy-derived-static", "--example-limit", "1"])).toEqual({
      format: "markdown",
      candidate: "legacy-derived-static",
      exampleLimit: 1,
      allowNotReady: false
    });

    const legacy = await loadBundledLegacyContext();
    const bridge = createLegacyDerivedStaticRuntimeContext();
    const report = createGeneratedRuntimeReadinessReport({
      reference: legacy.context,
      candidate: bridge.context,
      source: bridge.source,
      exampleLimit: 1
    });

    expect(bridge.source).toBe("legacy-derived-static-snapshot");
    expect(bridge.context.gameData.id).toBe("legacy-derived-runtime-snapshot");
    expect(bridge.context.priceSet.id).toBe("legacy-derived-runtime-prices");
    expect(bridge.context.gameData.provenance?.notes).toContain("not authoritative");
    expect(report.ready).toBe(true);
    expect(report.source).toBe("legacy-derived-static-snapshot");
    expect(report.blockers).toEqual([]);
    expect(report.sections.filter((section) => section.blocking)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ section: "items", missingCount: 0 }),
        expect.objectContaining({ section: "items.runtimeFields", missingCount: 0 }),
        expect.objectContaining({ section: "monsters", missingCount: 0 }),
        expect.objectContaining({ section: "monsters.combatStats", missingCount: 0 }),
        expect.objectContaining({ section: "monsters.loot", missingCount: 0 }),
        expect.objectContaining({ section: "weapons", missingCount: 0 }),
        expect.objectContaining({ section: "weapons.runtimeFields", missingCount: 0 }),
        expect.objectContaining({ section: "ammo.runtimeFields", missingCount: 0 }),
        expect.objectContaining({ section: "spells.runtimeFields", missingCount: 0 }),
        expect.objectContaining({ section: "equipment", missingCount: 0 }),
        expect.objectContaining({ section: "equipment.runtimeFields", missingCount: 0 }),
        expect.objectContaining({ section: "priceSet.itemPrices", missingCount: 0 })
      ])
    );
  });
});

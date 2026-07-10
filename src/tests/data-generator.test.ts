import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_GAME_DATA_SOURCE_DIR,
  GENERATED_GAME_DATA_OUTPUT_PATHS,
  GameDataGeneratorError,
  SOURCE_BACKED_SLICE_DIR,
  assertGeneratedDataOutputHygiene,
  createGeneratedGameDataOutputs,
  createGameDataGenerationPlan,
  formatGameDataGenerationPlan,
  writeGeneratedGameDataOutputs
} from "../../scripts/game-data-generator-core";
import { GameDataSnapshotSchema } from "../data/schemas";
import type { GameDataSnapshot } from "../domain/shared";
import { parseArgs } from "../../scripts/generate-game-data";

const TEST_ROOT = join(process.cwd(), ".vite", "data-generator-test");
const FIXTURE_SOURCE = "src/tests/fixtures/data-generator/lostcity-content";
const RAW_FIXTURE_SOURCE = "src/tests/fixtures/lostcity-source";
const GENERATED_AT = "2026-07-08T00:00:00.000Z";

function resetTestRoot(): void {
  rmSync(TEST_ROOT, { recursive: true, force: true });
  mkdirSync(TEST_ROOT, { recursive: true });
}

function expectGeneratorError(
  action: () => unknown,
  code: GameDataGeneratorError["code"]
): GameDataGeneratorError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(GameDataGeneratorError);
    expect((error as GameDataGeneratorError).code).toBe(code);
    expect((error as GameDataGeneratorError).message).not.toContain(process.cwd());
    return error as GameDataGeneratorError;
  }
  throw new Error(`Expected GameDataGeneratorError with code ${code}`);
}

function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeys(entry, keys));
    return keys;
  }
  if (value === null || typeof value !== "object") return keys;
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    collectKeys(nestedValue, keys);
  }
  return keys;
}

function emptyEquipment(): GameDataSnapshot["equipment"] {
  return {
    helm: {},
    amulet: {},
    body: {},
    legs: {},
    shield: {},
    gloves: {},
    boots: {},
    cape: {},
    ring: {}
  };
}

function rawReferenceSnapshot(): GameDataSnapshot {
  const equipment = emptyEquipment();
  equipment.helm.none = { name: "None" };
  equipment.ring.ring_of_recoil = { name: "Ring of recoil", recoil: true };
  return {
    id: "raw-generator-reference",
    label: "Raw generator reference",
    items: {
      rune_scimitar: { id: "rune_scimitar", name: "Rune scimitar" },
      bronze_arrow: { id: "bronze_arrow", name: "Bronze arrow" },
      bronze_dart_w: { id: "bronze_dart_w", name: "Bronze darts (thrown)" },
      missing_item: { id: "missing_item", name: "Missing item" }
    },
    monsters: {
      giant: { id: "giant", name: "Giant", hp: 35 },
      bear: { id: "bear", name: "Bear", hp: 20 }
    },
    weapons: {
      rune_scimitar: {
        name: "Rune scimitar",
        type: "melee",
        wclass: "scimitar",
        accBonus: 45,
        dmgBonus: 44,
        speed: 4
      },
      bronze_dart_w: {
        name: "Bronze darts (thrown)",
        type: "ranged",
        sub: "thrown",
        ammoKey: "bronze_dart",
        accBonus: 0,
        dmgBonus: 0,
        speed: 3
      }
    },
    ammo: { bronze_arrow: { name: "Bronze arrow", rangeBonus: 7 } },
    spells: {
      wind_strike: {
        name: "Wind Strike",
        base: 2,
        lvl: 1,
        baseXp: 5.5,
        runes: { airrune: 1, mindrune: 1 }
      },
      water_strike: {
        name: "Water Strike",
        base: 4,
        lvl: 5,
        baseXp: 7.5,
        runes: { airrune: 1, mindrune: 1, waterrune: 1 }
      }
    },
    equipment
  };
}

function generatedGameDataPath(outputRoot: string): string {
  return join(outputRoot, GENERATED_GAME_DATA_OUTPUT_PATHS.gameData);
}

function writeBaselineGameData(outputRoot: string, gameDataText: string): void {
  const baselinePath = generatedGameDataPath(outputRoot);
  mkdirSync(join(outputRoot, "src/data/generated"), { recursive: true });
  writeFileSync(baselinePath, gameDataText);
}

function fixtureGameDataText(outputRoot: string): string {
  return createGeneratedGameDataOutputs({
    sourceDir: FIXTURE_SOURCE,
    outputRoot,
    generatedAt: GENERATED_AT,
    skipCalculationImpact: true
  }).gameDataText;
}

function copyFixtureSource(name: string): string {
  const sourceDir = join(TEST_ROOT, name);
  cpSync(join(process.cwd(), FIXTURE_SOURCE), sourceDir, { recursive: true });
  return sourceDir;
}

function sourceSlicePath(sourceDir: string, fileName: string): string {
  return join(sourceDir, SOURCE_BACKED_SLICE_DIR, fileName);
}

function readSourceSlice<T>(sourceDir: string, fileName: string): T {
  return JSON.parse(readFileSync(sourceSlicePath(sourceDir, fileName), "utf8")) as T;
}

function writeSourceSlice(sourceDir: string, fileName: string, value: unknown): void {
  writeFileSync(sourceSlicePath(sourceDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

beforeEach(() => {
  resetTestRoot();
});

afterAll(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("game data generator foundation", () => {
  it("reports a clear missing default source path without dumping absolute paths", () => {
    const repoRoot = join(TEST_ROOT, "missing-default");
    mkdirSync(repoRoot, { recursive: true });

    const error = expectGeneratorError(
      () => createGameDataGenerationPlan({ repoRoot }),
      "source_missing"
    );

    expect(error.message).toContain(DEFAULT_GAME_DATA_SOURCE_DIR);
    expect(error.message).toContain("LostCityRS/Content");
    expect(error.message).not.toContain(repoRoot);
  });

  it("validates a repository fixture source and planned output paths without network", () => {
    const fetchMock = vi.fn(() => {
      throw new Error("Network calls are not allowed in generator foundation tests");
    });
    vi.stubGlobal("fetch", fetchMock);

    const plan = createGameDataGenerationPlan({
      sourceDir: FIXTURE_SOURCE,
      outputRoot: ".vite/data-generator-output"
    });
    const formattedPlan = formatGameDataGenerationPlan(plan);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(plan.parserStatus).toBe("source-backed-slice");
    expect(plan.sourceDirLabel).toBe(FIXTURE_SOURCE);
    expect(plan.outputs.sourcePin.targetPath).toBe(GENERATED_GAME_DATA_OUTPUT_PATHS.sourcePin);
    expect(plan.outputs.gameData.targetPath).toBe(GENERATED_GAME_DATA_OUTPUT_PATHS.gameData);
    expect(plan.outputs.revisionImpact.targetPath).toBe(
      GENERATED_GAME_DATA_OUTPUT_PATHS.revisionImpact
    );
    expect(plan.outputs.gameData.pathLabel).toBe(
      ".vite/data-generator-output/src/data/generated/game-data.json"
    );
    expect(formattedPlan).toContain("Parser status: source-backed-slice");
    expect(formattedPlan).toContain("No files were written.");
  });

  it("selects the raw LostCity parser and builds normalized output from scripts", () => {
    const plan = createGameDataGenerationPlan({ sourceDir: RAW_FIXTURE_SOURCE });
    const outputs = createGeneratedGameDataOutputs({
      sourceDir: RAW_FIXTURE_SOURCE,
      outputRoot: join(TEST_ROOT, "raw-output"),
      generatedAt: GENERATED_AT,
      skipCalculationImpact: true,
      rawReference: rawReferenceSnapshot()
    });

    expect(plan.parserStatus).toBe("raw-lostcity");
    expect(outputs.sourcePin.scope).toMatchObject({
      status: "source-backed-raw",
      parser: "raw-lostcity"
    });
    expect(outputs.gameData.monsters.giant).toMatchObject({
      hp: 35,
      loot: expect.arrayContaining([expect.objectContaining({ key: "big_bones" })])
    });
    expect(outputs.gameData.weapons.bronze_dart_w.accBonus).toBe(3);
    expect(outputs.gameData.spells.water_strike.baseXp).toBe(7.5);
  });

  it("rejects a source path that exists but is not a directory", () => {
    const repoRoot = join(TEST_ROOT, "file-source");
    const sourceFile = join(repoRoot, "lostcity-content");
    mkdirSync(repoRoot, { recursive: true });
    writeFileSync(sourceFile, "not a directory\n");

    const error = expectGeneratorError(
      () => createGameDataGenerationPlan({ repoRoot, sourceDir: "lostcity-content" }),
      "source_not_directory"
    );

    expect(error.message).toContain("lostcity-content");
    expect(error.message).not.toContain(sourceFile);
  });

  it("keeps the default .sources checkout path gitignored", () => {
    const gitignoreLines = readFileSync(join(process.cwd(), ".gitignore"), "utf8").split(/\r?\n/);

    expect(gitignoreLines).toContain(".sources/");
  });

  it("writes a valid source-pin.json from the fixture source", () => {
    const outputRoot = join(TEST_ROOT, "source-pin-output");
    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const sourcePinText = readFileSync(outputs.plan.outputs.sourcePin.absolutePath, "utf8");
    const sourcePin = parseJson(sourcePinText) as {
      schemaVersion?: unknown;
      source?: Record<string, unknown>;
      generatedAt?: unknown;
      generator?: Record<string, unknown>;
      scope?: Record<string, unknown>;
    };

    expect(outputs.changedFiles).toContain(outputs.plan.outputs.sourcePin.pathLabel);
    expect(sourcePin.schemaVersion).toBe(1);
    expect(sourcePin.source).toMatchObject({
      name: "LostCityRS/Content fixture",
      path: FIXTURE_SOURCE,
      revision: "fixture-revision-274",
      commit: "0000000000000000000000000000000000000274"
    });
    expect(sourcePin.generatedAt).toBe(GENERATED_AT);
    expect(sourcePin.generator).toMatchObject({
      name: "index-sim-data-generator",
      version: "raw-lostcity-runtime-catalog-2"
    });
    expect(sourcePin.generator?.command).toContain("npm run data:generate");
    expect(sourcePin.scope).toMatchObject({
      status: "source-backed-slice",
      parser: "source-backed-slice",
      runtimeBootstrap: "source-backed-generated-snapshot"
    });
    expect(sourcePinText).toContain(SOURCE_BACKED_SLICE_DIR);
    expect(sourcePinText).not.toContain(process.cwd());
  });

  it("writes a GameDataSnapshotSchema-valid game-data.json from the fixture source", () => {
    const outputRoot = join(TEST_ROOT, "game-data-output");
    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const gameData = GameDataSnapshotSchema.parse(
      parseJson(readFileSync(outputs.plan.outputs.gameData.absolutePath, "utf8"))
    );

    expect(outputs.changedFiles).toContain(outputs.plan.outputs.gameData.pathLabel);
    expect(gameData.id).toBe("generated-foundation-fixture");
    expect(gameData.provenance?.source).toBe("generated");
    expect(gameData.monsters.training_dummy.hp).toBe(3);
    expect(gameData.monsters.source_giant).toMatchObject({
      name: "Source Giant",
      hp: 35,
      defCrush: 6
    });
    expect(gameData.items["1dose2defense"]).toMatchObject({
      name: "Defence potion (1)",
      price: 180
    });
    expect(gameData.items.rune_scimitar).toMatchObject({
      name: "Rune scimitar",
      price: 17900,
      alch: 15360
    });
    expect(gameData.weapons.bronze_sword.type).toBe("melee");
    expect(gameData.weapons.bronze_sword.accBonus).toBe(5);
    expect(gameData.weapons.training_shortbow).toMatchObject({
      type: "ranged",
      ammoKey: "bronze_arrow",
      twoHand: true
    });
    expect(gameData.ammo.bronze_arrow).toMatchObject({
      rangeBonus: 7,
      kind: "arrow",
      priceKey: "bronze_arrow"
    });
    expect(gameData.spells.wind_strike).toMatchObject({
      base: 2,
      lvl: 1,
      baseXp: 5.5,
      runes: { airrune: 1, mindrune: 1 }
    });
    expect(gameData.equipment.helm.bronze_med_helm).toMatchObject({
      name: "Bronze med helm",
      stabDef: 3,
      magDef: -6
    });
    expect(gameData.equipment.shield.bronze_sq_shield?.slashDef).toBe(8);
    expect(gameData.requirements?.training_shortbow).toMatchObject({
      itemId: "training_shortbow",
      skills: { ranged: 5 }
    });
    expect(gameData.requirements?.bronze_med_helm).toMatchObject({
      itemId: "bronze_med_helm",
      skills: { defence: 1 }
    });
    expect(Object.keys(gameData.equipment)).toEqual([
      "helm",
      "amulet",
      "body",
      "legs",
      "shield",
      "gloves",
      "boots",
      "cape",
      "ring"
    ]);
  });

  it("extracts the source-backed fixture files into simulator game-data slices", () => {
    const outputs = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot: join(TEST_ROOT, "source-backed-output"),
      generatedAt: GENERATED_AT
    });
    const snapshot = GameDataSnapshotSchema.parse(parseJson(outputs.gameDataText));

    expect(Object.keys(snapshot.items)).toEqual(
      expect.arrayContaining([
        "1dose2defense",
        "air_rune",
        "bronze_sword",
        "rune_scimitar",
        "training_shortbow"
      ])
    );
    expect(Object.keys(snapshot.items)).toHaveLength(371);
    expect(snapshot.items.training_shortbow?.notes).toContain("source-backed fixture");
    expect(snapshot.items.air_rune?.provenance?.sourceRef).toBe(
      `${SOURCE_BACKED_SLICE_DIR}/items.json#air_rune`
    );
    expect(Object.keys(snapshot.weapons)).toEqual(
      expect.arrayContaining(["bronze_sword", "rune_scimitar", "training_shortbow"])
    );
    expect(Object.keys(snapshot.weapons)).toHaveLength(37);
    expect(Object.keys(snapshot.ammo)).toHaveLength(18);
    expect(Object.keys(snapshot.spells)).toHaveLength(19);
    expect(snapshot.ammo.addy_knife).toMatchObject({
      fam: "knife",
      tier: 4,
      barKey: "adamantite_bar"
    });
    expect(snapshot.spells.wind_strike?.runes).toEqual({ airrune: 1, mindrune: 1 });
    expect(Object.keys(snapshot.requirements ?? {})).toEqual([
      "bronze_med_helm",
      "bronze_sq_shield",
      "bronze_sword",
      "training_shortbow"
    ]);
    expect(snapshot.requirements?.training_shortbow).toMatchObject({
      itemId: "training_shortbow",
      skills: { ranged: 5 },
      provenance: {
        source: "generated",
        sourceRef: `${SOURCE_BACKED_SLICE_DIR}/items.json#training_shortbow.requirements, ${SOURCE_BACKED_SLICE_DIR}/weapons.json#training_shortbow.requirements`
      },
      notes: "Fixture ranged requirement for source-backed parser tests."
    });
    expect(snapshot.requirements?.bronze_sword).toMatchObject({
      itemId: "bronze_sword",
      skills: { attack: 1 }
    });
    expect(snapshot.requirements?.bronze_sq_shield).toMatchObject({
      itemId: "bronze_sq_shield",
      skills: { defence: 1 }
    });
    expect(Object.keys(snapshot.monsters)).toEqual(
      expect.arrayContaining(["al_kharid_warrior", "giant", "source_giant", "training_dummy"])
    );
    expect(Object.keys(snapshot.monsters)).toHaveLength(65);
    expect(snapshot.monsters.source_giant?.provenance?.sourceRef).toBe(
      `${SOURCE_BACKED_SLICE_DIR}/monsters.json#source_giant`
    );
    expect(snapshot.monsters.al_kharid_warrior).toMatchObject({
      id: "al_kharid_warrior",
      name: "Al-Kharid warrior",
      hp: 19,
      attack: 7,
      strength: 5,
      defLevel: 4,
      attackSpeed: 4,
      defMagic: -1,
      provenance: {
        source: "generated",
        sourceRef: `${SOURCE_BACKED_SLICE_DIR}/monsters.json#al_kharid_warrior.combatStats`
      }
    });
    expect(snapshot.monsters.al_kharid_warrior?.provenance?.notes).toContain(
      "loot/drop rows intentionally omitted"
    );
    expect(Object.keys(snapshot.equipment.helm)).toHaveLength(17);
    expect(Object.keys(snapshot.equipment.shield)).toHaveLength(12);
    expect(snapshot.equipment.helm).toHaveProperty("bronze_med_helm");
    expect(snapshot.equipment.helm).toHaveProperty("rune_full_helm");
    expect(snapshot.equipment.shield).toHaveProperty("bronze_sq_shield");
    expect(snapshot).not.toHaveProperty("sourcePin");
  });

  it("parses monster loot rows, grouped drops and nested drop details from the source-backed fixture", () => {
    const outputs = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot: join(TEST_ROOT, "monster-drops-output"),
      generatedAt: GENERATED_AT
    });
    const snapshot = GameDataSnapshotSchema.parse(parseJson(outputs.gameDataText));
    const monster = snapshot.monsters.source_giant;
    const loot = monster?.loot ?? [];

    expect(monster).toMatchObject({
      id: "source_giant",
      hp: 35,
      attack: 20,
      strength: 20,
      defLevel: 18
    });
    expect(loot[0]).toMatchObject({
      name: "Big bones",
      key: "big_bones",
      chance: 1,
      qtyAvg: 1,
      price: 250,
      provenance: {
        source: "generated",
        sourceRef: `${SOURCE_BACKED_SLICE_DIR}/monsters.json#source_giant.loot.0`
      }
    });
    expect(loot[2]).toMatchObject({
      name: "Gem table",
      tag: "gem",
      _expand: [
        {
          name: "Uncut sapphire",
          key: "uncut_sapphire",
          weight: 32,
          qty: 1,
          price: 450
        },
        {
          name: "Nothing",
          weight: 96,
          tag: "empty"
        }
      ]
    });
    expect(Array.isArray(loot[3])).toBe(true);
    expect(loot[3]).toMatchObject([
      { name: "Air rune", key: "air_rune", chance: 0.125, qtyAvg: 6 },
      { name: "Mind rune", key: "mind_rune", chance: 0.125, qtyAvg: 3 }
    ]);
  });

  it("does not include raw source dumps, historical snapshots or market price history", () => {
    const outputs = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot: join(TEST_ROOT, "scope-output"),
      generatedAt: GENERATED_AT
    });
    const combined = `${outputs.sourcePinText}\n${outputs.gameDataText}`;
    const keys = collectKeys(parseJson(combined.split("\n\n")[0] ?? "{}"));
    collectKeys(parseJson(outputs.gameDataText), keys);
    const allOutputText = `${outputs.sourcePinText}\n${outputs.gameDataText}\n${outputs.revisionImpactText}`;

    expect([...keys]).not.toEqual(
      expect.arrayContaining([
        "raw",
        "rawSource",
        "rawUpstream",
        "upstreamDump",
        "sourceFiles",
        "historicalSnapshots",
        "priceHistory",
        "marketPriceHistory"
      ])
    );
    expect(allOutputText).not.toContain("Synthetic repository-local fixture");
    expect(allOutputText).not.toContain(process.cwd());
    expect(allOutputText).not.toMatch(/rawSource|rawUpstream|upstreamDump|sourceFiles/);
  });

  it("rejects absolute local paths in generated output hygiene checks", () => {
    const outputs = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot: join(TEST_ROOT, "absolute-path-hygiene-output"),
      generatedAt: GENERATED_AT
    });

    const error = expectGeneratorError(
      () =>
        assertGeneratedDataOutputHygiene({
          ...outputs,
          sourcePinText: '{"path":"/Users/example/.sources/lostcity-content"}\n'
        }),
      "output_validation_failed"
    );

    expect(error.message).toContain("absolute user-home path");
  });

  it("rejects forbidden generated data output shapes before writing", () => {
    const outputs = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot: join(TEST_ROOT, "hygiene-output"),
      generatedAt: GENERATED_AT
    });

    const error = expectGeneratorError(
      () =>
        assertGeneratedDataOutputHygiene({
          ...outputs,
          gameDataText: '{"rawSource":{}}\n'
        }),
      "output_validation_failed"
    );

    expect(error.message).toContain("forbidden generated-data key");
    expect(error.message).toContain("rawSource");
  });

  it("rejects malformed source-backed loot entries before writing output files", () => {
    const sourceDir = join(TEST_ROOT, "malformed-loot-source");
    const outputRoot = join(TEST_ROOT, "malformed-loot-output");
    cpSync(join(process.cwd(), FIXTURE_SOURCE), sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, SOURCE_BACKED_SLICE_DIR, "monsters.json"),
      JSON.stringify(
        {
          monsters: [
            {
              id: "bad_monster",
              name: "Bad Monster",
              hp: 1,
              loot: [{ name: "Bad drop", key: "bones", qtyAvg: 1 }]
            }
          ]
        },
        null,
        2
      )
    );

    const error = expectGeneratorError(
      () =>
        writeGeneratedGameDataOutputs({
          sourceDir: ".vite/data-generator-test/malformed-loot-source",
          outputRoot,
          generatedAt: GENERATED_AT
        }),
      "source_slice_invalid"
    );

    expect(error.message).toContain(`${SOURCE_BACKED_SLICE_DIR}/monsters.json`);
    expect(error.message).not.toContain("Bad drop");
    expect(existsSync(join(outputRoot, GENERATED_GAME_DATA_OUTPUT_PATHS.gameData))).toBe(false);
  });

  it("rejects duplicate source-backed monster ids with a sanitized error", () => {
    const sourceDir = join(TEST_ROOT, "duplicate-monster-source");
    cpSync(join(process.cwd(), FIXTURE_SOURCE), sourceDir, { recursive: true });
    writeFileSync(
      join(sourceDir, SOURCE_BACKED_SLICE_DIR, "monsters.json"),
      JSON.stringify(
        {
          monsters: [
            { id: "duplicate_monster", name: "Duplicate Monster", hp: 1 },
            { id: "duplicate_monster", name: "Duplicate Monster Again", hp: 2 }
          ]
        },
        null,
        2
      )
    );

    const error = expectGeneratorError(
      () =>
        createGeneratedGameDataOutputs({
          sourceDir: ".vite/data-generator-test/duplicate-monster-source",
          outputRoot: join(TEST_ROOT, "duplicate-monster-output"),
          generatedAt: GENERATED_AT
        }),
      "source_slice_invalid"
    );

    expect(error.message).toContain("duplicate_monster");
    expect(error.message).not.toContain(sourceDir);
  });

  it("keeps distinct source-backed cut and uncut gem item identities", () => {
    const sourceDir = copyFixtureSource("canonical-item-collision-source");
    const outputRoot = join(TEST_ROOT, "canonical-item-collision-output");
    const items = readSourceSlice<{
      items: Array<Record<string, unknown> & { id: string; name: string }>;
    }>(sourceDir, "items.json");
    items.items.push({
      id: "sapphire",
      name: "Sapphire",
      stackable: false
    });
    writeSourceSlice(sourceDir, "items.json", items);

    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: ".vite/data-generator-test/canonical-item-collision-source",
      outputRoot,
      generatedAt: GENERATED_AT,
      skipCalculationImpact: true
    });

    expect(outputs.gameData.items.sapphire).toMatchObject({ id: "sapphire", name: "Sapphire" });
    expect(outputs.gameData.items.uncut_sapphire).toMatchObject({
      id: "uncut_sapphire",
      name: "uncut_sapphire"
    });
    expect(existsSync(join(outputRoot, GENERATED_GAME_DATA_OUTPUT_PATHS.gameData))).toBe(true);
  });

  it("rejects conflicting source-backed item requirements with a sanitized error", () => {
    const sourceDir = copyFixtureSource("conflicting-requirements-source");
    const weapons = readSourceSlice<{
      weapons: Array<{ id: string; requirements?: { skills: { ranged?: number } } }>;
    }>(sourceDir, "weapons.json");
    const shortbow = weapons.weapons.find((weapon) => weapon.id === "training_shortbow");
    expect(shortbow).toBeDefined();
    if (!shortbow) throw new Error("Missing training_shortbow fixture weapon");
    shortbow.requirements = { skills: { ranged: 6 } };
    writeSourceSlice(sourceDir, "weapons.json", weapons);

    const error = expectGeneratorError(
      () =>
        createGeneratedGameDataOutputs({
          sourceDir: ".vite/data-generator-test/conflicting-requirements-source",
          outputRoot: join(TEST_ROOT, "conflicting-requirements-output"),
          generatedAt: GENERATED_AT
        }),
      "source_slice_invalid"
    );

    expect(error.message).toContain("conflicting values");
    expect(error.message).toContain("training_shortbow");
    expect(error.message).not.toContain(sourceDir);
  });

  it("rejects unsupported source-backed requirement skills before writing output files", () => {
    const sourceDir = copyFixtureSource("invalid-requirement-skill-source");
    const outputRoot = join(TEST_ROOT, "invalid-requirement-skill-output");
    const items = readSourceSlice<{
      items: Array<Record<string, unknown> & { id: string; requirements?: unknown }>;
    }>(sourceDir, "items.json");
    const shortbow = items.items.find((item) => item.id === "training_shortbow");
    expect(shortbow).toBeDefined();
    if (!shortbow) throw new Error("Missing training_shortbow fixture item");
    shortbow.requirements = { skills: { strength: 5 } };
    writeSourceSlice(sourceDir, "items.json", items);

    const error = expectGeneratorError(
      () =>
        writeGeneratedGameDataOutputs({
          sourceDir: ".vite/data-generator-test/invalid-requirement-skill-source",
          outputRoot,
          generatedAt: GENERATED_AT
        }),
      "source_slice_invalid"
    );

    expect(error.message).toContain(`${SOURCE_BACKED_SLICE_DIR}/items.json`);
    expect(error.message).not.toContain("strength");
    expect(existsSync(join(outputRoot, GENERATED_GAME_DATA_OUTPUT_PATHS.gameData))).toBe(false);
  });

  it("writes a revision-impact report with required foundation sections and no baseline", () => {
    const outputRoot = join(TEST_ROOT, "report-no-baseline-output");
    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(outputs.changedFiles).toContain(outputs.plan.outputs.revisionImpact.pathLabel);
    expect(reportText).toContain("# Current Game Revision Impact");
    expect(reportText).toContain("Source ref: LostCityRS/Content fixture");
    expect(reportText).toContain("Generator command:");
    expect(reportText).toContain(`Generated at: ${GENERATED_AT}`);
    expect(reportText).toContain("## Validation Status");
    expect(reportText).toContain("`GameDataSnapshotSchema`: pass");
    expect(reportText).toContain("`game-data.json`: generated and schema-valid");
    expect(reportText).toContain("`source-pin.json`: generated JSON");
    expect(reportText).toContain("Output hygiene: pass");
    expect(reportText).toContain("Diff baseline: not found");
    expect(reportText).toContain("Calculation-impact suite: failed");
    expect(reportText).toContain("Representative suite: failed");
    expect(reportText).toContain("Valid baseline snapshot was not found");
    expect(reportText).toContain("No previous `game-data.json` baseline was found");
    expect(reportText).toContain("## Current Scope");
    expect(reportText).toContain(
      "Generated item requirements are consumed by Planner/setup checks and gear quick action reason copy when the runtime snapshot supplies them"
    );
    expect(reportText).toContain("fixture-owned representative cases");
    expect(reportText).not.toContain("first representative fixture cases");
    expect(reportText).not.toContain("manual requirement policy");
    expect(reportText).toContain("## Open Questions");
    expect(reportText).toContain("Runtime bootstrap: source-backed generated snapshot");
    expect(reportText).not.toContain(process.cwd());
  });

  it("reports an invalid diff baseline without dumping local paths or source content", () => {
    const outputRoot = join(TEST_ROOT, "report-invalid-baseline-output");
    const baselinePath = join(outputRoot, "src/data/generated/game-data.json");
    mkdirSync(join(outputRoot, "src/data/generated"), { recursive: true });
    writeFileSync(baselinePath, '{"id":""}\n');

    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(reportText).toContain("Diff baseline: invalid");
    expect(reportText).toContain("Calculation-impact suite: failed");
    expect(reportText).toContain("Representative suite: failed");
    expect(reportText).toContain("A previous `game-data.json` file exists");
    expect(reportText).toContain("Added/removed/changed counts are skipped");
    expect(reportText).not.toContain(baselinePath);
    expect(reportText).not.toContain(process.cwd());
  });

  it("reports a lightweight schema diff when a previous baseline exists", () => {
    const outputRoot = join(TEST_ROOT, "report-baseline-output");
    const previousSnapshot = GameDataSnapshotSchema.parse({
      id: "previous-foundation-fixture",
      label: "Previous foundation fixture",
      items: {
        old_item: {
          id: "old_item",
          name: "Old item"
        }
      },
      monsters: {},
      weapons: {},
      ammo: {},
      spells: {},
      equipment: emptyEquipment(),
      provenance: {
        source: "manual",
        sourceRef: "previous fixture"
      }
    });
    const baselinePath = join(outputRoot, "src/data/generated/game-data.json");
    mkdirSync(join(outputRoot, "src/data/generated"), { recursive: true });
    writeFileSync(baselinePath, `${JSON.stringify(previousSnapshot, null, 2)}\n`);

    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(reportText).toContain("Diff baseline: valid");
    expect(reportText).toContain("| items | 371 | 1 | 0 |");
    expect(reportText).toContain("| monsters | 65 | 0 | 0 |");
    expect(reportText).toContain("| requirements | 4 | 0 | 0 |");
    expect(reportText).toContain("| drops | 6 | 0 | 0 |");
    expect(reportText).toContain(
      "items added: `1dose2defense`, `2dose1strength`, `3dose1defense`, `3doseantipoison`"
    );
    expect(reportText).toContain("items removed: `old_item`");
    expect(reportText).toContain(
      "requirements added: `bronze_med_helm`, `bronze_sq_shield`, `bronze_sword`, `training_shortbow`"
    );
    expect(reportText).toContain(
      "drops added: `source_giant.0`, `source_giant.1`, `source_giant.2`"
    );
  });

  it("runs the representative calculation-impact suite with pass status when baseline matches candidate", () => {
    const outputRoot = join(TEST_ROOT, "impact-pass-output");
    writeBaselineGameData(outputRoot, fixtureGameDataText(outputRoot));

    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(reportText).toContain(
      "Calculation-impact suite: pass (9 pass, 0 needs-review, 0 failed)"
    );
    expect(reportText).toContain("Informational all-monster scan: clean (0 outliers, 0 shown)");
    expect(reportText).toContain("Representative suite: pass");
    expect(reportText).toContain("Cases: 9 run, 9 pass, 0 needs-review, 0 failed");
    expect(reportText).toContain("### Informational All-Monster Scan");
    expect(reportText).toContain("No informational all-monster scan outliers found.");
    expect(reportText).not.toMatch(/\bNaN\b|\bInfinity\b/);
    expect(reportText).toContain("| `fixture_melee_source_giant` |");
    expect(reportText).toContain("| `fixture_ranged_source_giant` |");
    expect(reportText).toContain("| `fixture_magic_source_giant` |");
    expect(reportText).toContain(
      "| `fixture_cannon_source_giant` | `fixture`, `combat`, `ranged`, `cannon`, `supply` | pass |"
    );
    expect(reportText).toContain(
      "| `fixture_recoil_training_dummy` | `fixture`, `combat`, `melee`, `recoil`, `low-level` | pass |"
    );
    expect(reportText).toContain(
      "| `fixture_alch_policy_source_giant` | `fixture`, `economy`, `alch`, `loot` | pass |"
    );
    expect(reportText).toContain(
      "| `fixture_loot_heavy_source_giant` | `fixture`, `economy`, `loot-heavy`, `nested-loot` | pass |"
    );
    expect(reportText).toContain(
      "| `fixture_high_defence_pressure_source_giant` | `fixture`, `combat`, `melee`, `high-defence` | pass |"
    );
    expect(reportText).toContain(
      "| `fixture_low_level_training_dummy` | `fixture`, `combat`, `melee`, `low-level` | pass |"
    );
    expect(reportText).toContain(
      "| `fixture_melee_source_giant` | `fixture`, `combat`, `melee`, `gear`, `loot` | pass | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | 0 (0%) | - |"
    );
  });

  it("reports all-monster DPS/K/hr/XP/hr threshold outliers without making the scan blocking", () => {
    const sourceDir = copyFixtureSource("impact-scan-combat-source");
    const outputRoot = join(TEST_ROOT, "impact-scan-combat-output");
    writeBaselineGameData(outputRoot, fixtureGameDataText(outputRoot));
    const monsters = readSourceSlice<{
      monsters: Array<{ id: string; defLevel?: number; hp?: number }>;
    }>(sourceDir, "monsters.json");
    const sourceGiant = monsters.monsters.find((monster) => monster.id === "source_giant");
    expect(sourceGiant).toBeDefined();
    if (!sourceGiant) throw new Error("Missing source_giant fixture monster");
    sourceGiant.defLevel = 95;
    sourceGiant.hp = 80;
    writeSourceSlice(sourceDir, "monsters.json", monsters);

    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: ".vite/data-generator-test/impact-scan-combat-source",
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(reportText).toContain("Informational all-monster scan: outliers-found");
    expect(reportText).toContain(
      "This scan is informational and does not change representative merge-blocking status."
    );
    expect(reportText).toContain("threshold-outlier");
    expect(reportText).toContain("`source_giant` / Source Giant");
    expect(reportText).toMatch(/DPS changed|kills\/hr changed|XP\/hr changed/);
    expect(reportText).not.toMatch(/\bNaN\b|\bInfinity\b/);
  });

  it("reports all-monster GP/hr or GP/XP threshold outliers", () => {
    const sourceDir = copyFixtureSource("impact-scan-economy-source");
    const outputRoot = join(TEST_ROOT, "impact-scan-economy-output");
    writeBaselineGameData(outputRoot, fixtureGameDataText(outputRoot));
    const monsters = readSourceSlice<{
      monsters: Array<{
        id: string;
        loot?: Array<
          | { key?: string; price?: number; qtyAvg?: number }
          | Array<{ key?: string; price?: number }>
        >;
      }>;
    }>(sourceDir, "monsters.json");
    const sourceGiant = monsters.monsters.find((monster) => monster.id === "source_giant");
    expect(sourceGiant?.loot?.[0]).toBeDefined();
    const bigBonesDrop = sourceGiant?.loot?.[0];
    if (!bigBonesDrop || Array.isArray(bigBonesDrop)) throw new Error("Missing big bones drop");
    bigBonesDrop.qtyAvg = 100;
    writeSourceSlice(sourceDir, "monsters.json", monsters);

    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: ".vite/data-generator-test/impact-scan-economy-source",
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(reportText).toContain("Informational all-monster scan: outliers-found");
    expect(reportText).toMatch(/GP\/hr changed|GP\/XP changed/);
    expect(reportText).toContain("over 25%");
    expect(reportText).not.toMatch(/\bNaN\b|\bInfinity\b/);
  });

  it("reports warning-count increases as informational all-monster findings", () => {
    const sourceDir = copyFixtureSource("impact-scan-warning-source");
    const outputRoot = join(TEST_ROOT, "impact-scan-warning-output");
    writeBaselineGameData(outputRoot, fixtureGameDataText(outputRoot));
    const monsters = readSourceSlice<{
      monsters: Array<{
        id: string;
        loot?: Array<{ key?: string; price?: number } | Array<{ key?: string; price?: number }>>;
      }>;
    }>(sourceDir, "monsters.json");
    const sourceGiant = monsters.monsters.find((monster) => monster.id === "source_giant");
    const coinsDrop = sourceGiant?.loot?.[1];
    if (!coinsDrop || Array.isArray(coinsDrop)) throw new Error("Missing coins drop");
    delete coinsDrop.price;
    writeSourceSlice(sourceDir, "monsters.json", monsters);

    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: ".vite/data-generator-test/impact-scan-warning-source",
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(reportText).toContain("warning count increased");
    expect(reportText).toMatch(/\| [0-9]+ -> [1-9][0-9]* \|/);
  });

  it("reports monster added and removed findings in the informational all-monster scan", () => {
    const sourceDir = copyFixtureSource("impact-scan-membership-source");
    const outputRoot = join(TEST_ROOT, "impact-scan-membership-output");
    writeBaselineGameData(outputRoot, fixtureGameDataText(outputRoot));
    const monsters = readSourceSlice<{
      monsters: Array<Record<string, unknown> & { id: string; name: string }>;
    }>(sourceDir, "monsters.json");
    monsters.monsters = monsters.monsters.filter((monster) => monster.id !== "training_dummy");
    monsters.monsters.push({
      id: "new_training_target",
      name: "New training target",
      level: 2,
      hp: 5,
      attack: 1,
      strength: 1,
      defLevel: 1,
      loot: [{ name: "Bones", key: "bones", chance: 1, qtyAvg: 1 }]
    });
    writeSourceSlice(sourceDir, "monsters.json", monsters);

    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: ".vite/data-generator-test/impact-scan-membership-source",
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(reportText).toContain("monster-added");
    expect(reportText).toContain("monster entered scan in candidate");
    expect(reportText).toContain("`new_training_target` / New training target");
    expect(reportText).toContain("monster-removed");
    expect(reportText).toContain("monster left scan in candidate");
    expect(reportText).toContain("`training_dummy` / Training dummy");
  });

  it("limits informational all-monster scan outliers deterministically", () => {
    const sourceDir = copyFixtureSource("impact-scan-limit-source");
    const outputRoot = join(TEST_ROOT, "impact-scan-limit-output");
    writeBaselineGameData(outputRoot, fixtureGameDataText(outputRoot));
    const monsters = readSourceSlice<{
      monsters: Array<Record<string, unknown> & { id: string }>;
    }>(sourceDir, "monsters.json");
    monsters.monsters = monsters.monsters.filter((monster) => monster.id !== "training_dummy");
    writeSourceSlice(sourceDir, "monsters.json", monsters);

    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: ".vite/data-generator-test/impact-scan-limit-source",
      outputRoot,
      generatedAt: GENERATED_AT,
      impactOutlierLimit: 1
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(outputs.sourcePin.generator.command).toContain("--impact-outlier-limit 1");
    expect(reportText).toContain("Outliers: 3 found, 1 shown");
    expect(reportText).toContain("Hidden by limit: 2");
    expect(reportText.match(/monster-removed/g)).toHaveLength(1);
  });

  it("marks representative calculation-impact cases needs-review when candidate data changes metrics", () => {
    const sourceDir = join(TEST_ROOT, "impact-change-source");
    const outputRoot = join(TEST_ROOT, "impact-change-output");
    cpSync(join(process.cwd(), FIXTURE_SOURCE), sourceDir, { recursive: true });
    writeBaselineGameData(outputRoot, fixtureGameDataText(outputRoot));

    const weaponsPath = join(sourceDir, SOURCE_BACKED_SLICE_DIR, "weapons.json");
    const weapons = JSON.parse(readFileSync(weaponsPath, "utf8")) as {
      weapons: Array<{ id: string; dmgBonus?: number }>;
    };
    const bronzeSword = weapons.weapons.find((weapon) => weapon.id === "bronze_sword");
    expect(bronzeSword).toBeDefined();
    if (!bronzeSword) throw new Error("Missing bronze_sword fixture weapon");
    bronzeSword.dmgBonus = (bronzeSword.dmgBonus ?? 0) + 4;
    writeFileSync(weaponsPath, `${JSON.stringify(weapons, null, 2)}\n`);

    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: ".vite/data-generator-test/impact-change-source",
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(reportText).toContain("Calculation-impact suite: needs-review");
    expect(reportText).toContain(
      "| `fixture_melee_source_giant` | `fixture`, `combat`, `melee`, `gear`, `loot` | needs-review |"
    );
    expect(reportText).toMatch(/\| `fixture_melee_source_giant` \| .* \| needs-review \| \+[0-9]/);
    expect(reportText).toContain(
      "No changed calculation outputs are accepted as intentional deltas"
    );
  });

  it("marks representative calculation-impact cases failed when required entities are missing", () => {
    const sourceDir = join(TEST_ROOT, "impact-missing-entity-source");
    const outputRoot = join(TEST_ROOT, "impact-missing-entity-output");
    cpSync(join(process.cwd(), FIXTURE_SOURCE), sourceDir, { recursive: true });
    writeBaselineGameData(outputRoot, fixtureGameDataText(outputRoot));
    writeFileSync(
      join(sourceDir, SOURCE_BACKED_SLICE_DIR, "ammo.json"),
      `${JSON.stringify({ ammo: [] }, null, 2)}\n`
    );

    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: ".vite/data-generator-test/impact-missing-entity-source",
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(reportText).toContain("Calculation-impact suite: failed");
    expect(reportText).toContain(
      "| `fixture_ranged_source_giant` | `fixture`, `combat`, `ranged`, `ammo`, `supply` | failed |"
    );
    expect(reportText).toContain("candidate missing ammo `bronze_arrow`");
  });

  it("keeps representative calculation-impact report markdown deterministic", () => {
    const outputRoot = join(TEST_ROOT, "impact-deterministic-output");
    writeBaselineGameData(outputRoot, fixtureGameDataText(outputRoot));

    const first = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot,
      generatedAt: GENERATED_AT
    });
    const second = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot,
      generatedAt: GENERATED_AT
    });

    expect(second.revisionImpactText).toBe(first.revisionImpactText);
    expect(first.revisionImpactText).toContain("## Calculation Impact");
    expect(first.revisionImpactText).toContain("Representative suite: pass");
  });

  it("supports skipping representative calculation impact", () => {
    const outputRoot = join(TEST_ROOT, "impact-skip-output");
    const outputs = writeGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot,
      generatedAt: GENERATED_AT,
      skipCalculationImpact: true
    });
    const reportText = readFileSync(outputs.plan.outputs.revisionImpact.absolutePath, "utf8");

    expect(outputs.sourcePin.generator.command).toContain("--skip-calculation-impact");
    expect(reportText).toContain("Calculation-impact suite: skipped (--skip-calculation-impact)");
    expect(reportText).toContain(
      "Informational all-monster scan: skipped (--skip-calculation-impact)"
    );
    expect(reportText).toContain("Representative suite: skipped");
    expect(reportText).toContain("Skipped by: `--skip-calculation-impact`");
    expect(reportText).toContain("No representative calculation-impact cases were evaluated.");
    expect(reportText).toContain("No informational all-monster scan rows were evaluated.");
  });

  it("filters representative calculation-impact cases by id or tag", () => {
    const tagOutputRoot = join(TEST_ROOT, "impact-filter-tag-output");
    writeBaselineGameData(tagOutputRoot, fixtureGameDataText(tagOutputRoot));
    const tagOutputs = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot: tagOutputRoot,
      generatedAt: GENERATED_AT,
      impactCaseFilter: "cannon"
    });

    expect(tagOutputs.sourcePin.generator.command).toContain("--impact-case-filter cannon");
    expect(tagOutputs.revisionImpactText).toContain(
      "Cases: 1 run, 1 pass, 0 needs-review, 0 failed"
    );
    expect(tagOutputs.revisionImpactText).toContain("| `fixture_cannon_source_giant` |");
    expect(tagOutputs.revisionImpactText).not.toContain("| `fixture_melee_source_giant` |");

    const idOutputRoot = join(TEST_ROOT, "impact-filter-id-output");
    writeBaselineGameData(idOutputRoot, fixtureGameDataText(idOutputRoot));
    const idOutputs = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot: idOutputRoot,
      generatedAt: GENERATED_AT,
      impactCaseFilter: "fixture_magic_source_giant"
    });

    expect(idOutputs.revisionImpactText).toContain("Case filter: `fixture_magic_source_giant`");
    expect(idOutputs.revisionImpactText).toContain("| `fixture_magic_source_giant` |");
    expect(idOutputs.revisionImpactText).not.toContain("| `fixture_ranged_source_giant` |");
  });

  it("parses calculation-impact CLI flags", () => {
    expect(
      parseArgs([
        "--source-dir",
        FIXTURE_SOURCE,
        "--skip-calculation-impact",
        "--impact-case-filter",
        "magic",
        "--impact-outlier-limit",
        "3",
        "--dry-run"
      ])
    ).toMatchObject({
      sourceDir: FIXTURE_SOURCE,
      skipCalculationImpact: true,
      impactCaseFilter: "magic",
      impactOutlierLimit: 3,
      dryRun: true
    });
  });

  it("keeps dry-run revision-impact text deterministic without writing files", () => {
    const outputRoot = join(TEST_ROOT, "dry-run-output");
    const first = writeGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot,
      generatedAt: GENERATED_AT,
      dryRun: true
    });
    const second = writeGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot,
      generatedAt: GENERATED_AT,
      dryRun: true
    });

    expect(second.revisionImpactText).toBe(first.revisionImpactText);
    expect(second.sourcePinText).toBe(first.sourcePinText);
    expect(second.gameDataText).toBe(first.gameDataText);
    expect(first.changedFiles).toEqual([
      ".vite/data-generator-test/dry-run-output/src/data/generated/source-pin.json",
      ".vite/data-generator-test/dry-run-output/src/data/generated/game-data.json",
      ".vite/data-generator-test/dry-run-output/docs/project/revision-impact/current.md"
    ]);
    expect(existsSync(first.plan.outputs.revisionImpact.absolutePath)).toBe(false);
  });

  it("generates deterministic JSON for the same fixture source and timestamp", () => {
    const first = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot: join(TEST_ROOT, "determinism-output"),
      generatedAt: GENERATED_AT
    });
    const second = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot: join(TEST_ROOT, "determinism-output"),
      generatedAt: GENERATED_AT
    });

    expect(second.sourcePinText).toBe(first.sourcePinText);
    expect(second.gameDataText).toBe(first.gameDataText);
    expect(second.revisionImpactText).toBe(first.revisionImpactText);
  });
});

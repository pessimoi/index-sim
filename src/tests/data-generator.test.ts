import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_GAME_DATA_SOURCE_DIR,
  GENERATED_GAME_DATA_OUTPUT_PATHS,
  GameDataGeneratorError,
  assertGeneratedDataOutputHygiene,
  createGeneratedGameDataOutputs,
  createGameDataGenerationPlan,
  formatGameDataGenerationPlan,
  writeGeneratedGameDataOutputs
} from "../../scripts/game-data-generator-core";
import { GameDataSnapshotSchema } from "../data/schemas";
import type { GameDataSnapshot } from "../domain/shared";

const TEST_ROOT = join(process.cwd(), ".vite", "data-generator-test");
const FIXTURE_SOURCE = "src/tests/fixtures/data-generator/lostcity-content";
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
    expect(plan.parserStatus).toBe("foundation-manifest");
    expect(plan.sourceDirLabel).toBe(FIXTURE_SOURCE);
    expect(plan.outputs.sourcePin.targetPath).toBe(GENERATED_GAME_DATA_OUTPUT_PATHS.sourcePin);
    expect(plan.outputs.gameData.targetPath).toBe(GENERATED_GAME_DATA_OUTPUT_PATHS.gameData);
    expect(plan.outputs.revisionImpact.targetPath).toBe(
      GENERATED_GAME_DATA_OUTPUT_PATHS.revisionImpact
    );
    expect(plan.outputs.gameData.pathLabel).toBe(
      ".vite/data-generator-output/src/data/generated/game-data.json"
    );
    expect(formattedPlan).toContain("Parser status: foundation-manifest");
    expect(formattedPlan).toContain("No files were written.");
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
      version: "foundation-1"
    });
    expect(sourcePin.generator?.command).toContain("npm run data:generate");
    expect(sourcePin.scope).toMatchObject({
      status: "foundation",
      parser: "foundation-manifest",
      runtimeBootstrap: "legacy-adapter"
    });
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
    expect(gameData.provenance?.source).toBe("manual");
    expect(gameData.monsters.training_dummy.hp).toBe(3);
    expect(gameData.weapons.bronze_sword.type).toBe("melee");
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

  it("does not include raw source dumps, historical snapshots or market price history", () => {
    const outputs = createGeneratedGameDataOutputs({
      sourceDir: FIXTURE_SOURCE,
      outputRoot: join(TEST_ROOT, "scope-output"),
      generatedAt: GENERATED_AT
    });
    const combined = `${outputs.sourcePinText}\n${outputs.gameDataText}`;
    const keys = collectKeys(parseJson(combined.split("\n\n")[0] ?? "{}"));
    collectKeys(parseJson(outputs.gameDataText), keys);

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
    expect(combined).not.toContain("Synthetic repository-local fixture");
    expect(combined).not.toContain(process.cwd());
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
    expect(reportText).toContain("Diff baseline: not found");
    expect(reportText).toContain("No previous `game-data.json` baseline was found");
    expect(reportText).toContain("## Known Limitations");
    expect(reportText).toContain("## Open Questions");
    expect(reportText).toContain("Runtime bootstrap: legacy adapter");
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
    expect(reportText).toContain("| items | 2 | 1 | 0 |");
    expect(reportText).toContain("| monsters | 1 | 0 | 0 |");
    expect(reportText).toContain("items added: `bones`, `bronze_sword`");
    expect(reportText).toContain("items removed: `old_item`");
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

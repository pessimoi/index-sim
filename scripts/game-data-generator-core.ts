import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import { GameDataSnapshotSchema, parseGameDataSnapshot } from "../src/data/schemas/game-data";
import { EQUIPMENT_SLOTS, type DataProvenance, type GameDataSnapshot } from "../src/domain/shared";

export const GAME_DATA_GENERATOR_VERSION = "foundation-1";
export const DEFAULT_GAME_DATA_SOURCE_DIR = ".sources/lostcity-content";
export const FOUNDATION_SOURCE_MANIFEST_FILE = "generator-foundation.json";

export const GENERATED_GAME_DATA_OUTPUT_PATHS = {
  sourcePin: "src/data/generated/source-pin.json",
  gameData: "src/data/generated/game-data.json",
  revisionImpact: "docs/project/revision-impact/current.md"
} as const;

export type GeneratedGameDataOutputKey = keyof typeof GENERATED_GAME_DATA_OUTPUT_PATHS;

export type GameDataGeneratorErrorCode =
  | "invalid_argument"
  | "source_missing"
  | "source_not_directory"
  | "source_manifest_invalid"
  | "source_outside_repo"
  | "output_outside_repo"
  | "output_validation_failed";

export class GameDataGeneratorError extends Error {
  readonly code: GameDataGeneratorErrorCode;

  constructor(code: GameDataGeneratorErrorCode, message: string) {
    super(message);
    this.name = "GameDataGeneratorError";
    this.code = code;
  }
}

export interface GameDataGenerationPlanOptions {
  repoRoot?: string;
  sourceDir?: string;
  outputRoot?: string;
}

export interface GameDataGenerationOutputPath {
  key: GeneratedGameDataOutputKey;
  targetPath: string;
  absolutePath: string;
  pathLabel: string;
}

export interface GameDataGenerationPlan {
  generatorVersion: typeof GAME_DATA_GENERATOR_VERSION;
  parserStatus: "foundation-manifest" | "foundation-empty";
  sourceDir: string;
  sourceDirLabel: string;
  outputRoot: string;
  outputRootLabel: string;
  outputs: Record<GeneratedGameDataOutputKey, GameDataGenerationOutputPath>;
  notes: string[];
}

export interface GeneratedGameDataSourcePin {
  schemaVersion: 1;
  source: {
    name: string;
    path: string;
    revision?: string;
    commit?: string;
  };
  generatedAt: string;
  generator: {
    name: "index-sim-data-generator";
    version: typeof GAME_DATA_GENERATOR_VERSION;
    command: string;
  };
  outputs: {
    sourcePin: string;
    gameData: string;
    revisionImpact: string;
  };
  scope: {
    status: "foundation";
    parser: GameDataGenerationPlan["parserStatus"];
    runtimeBootstrap: "legacy-adapter";
    notes: string[];
  };
}

export interface GeneratedGameDataOutputs {
  plan: GameDataGenerationPlan;
  sourcePin: GeneratedGameDataSourcePin;
  gameData: GameDataSnapshot;
  sourcePinText: string;
  gameDataText: string;
  revisionImpactText: string;
  changedFiles: string[];
}

export interface GeneratedGameDataOutputTexts {
  sourcePinText: string;
  gameDataText: string;
  revisionImpactText: string;
}

export interface CreateGeneratedGameDataOutputOptions extends GameDataGenerationPlanOptions {
  generatedAt?: Date | string;
  command?: string;
}

export interface WriteGeneratedGameDataOutputOptions extends CreateGeneratedGameDataOutputOptions {
  dryRun?: boolean;
}

type SnapshotSectionKey = "items" | "monsters" | "weapons" | "ammo" | "spells";

interface SnapshotDiffSection {
  section: string;
  added: string[];
  removed: string[];
  changed: string[];
}

interface RevisionImpactBaseline {
  status: "not-found" | "valid" | "invalid";
  pathLabel: string;
}

interface RevisionImpactSummary {
  baseline: RevisionImpactBaseline;
  sections: SnapshotDiffSection[];
}

const SourceMetadataSchema = z
  .object({
    name: z.string().min(1).optional(),
    revision: z.string().min(1).optional(),
    commit: z.string().min(1).optional()
  })
  .strict();

const FoundationSourceManifestSchema = z
  .object({
    source: SourceMetadataSchema.optional(),
    snapshot: GameDataSnapshotSchema.optional()
  })
  .strict();

type FoundationSourceManifest = z.infer<typeof FoundationSourceManifestSchema>;

function toPosixPath(path: string): string {
  return path.split(sep).join("/");
}

function isInsideOrEqual(parent: string, child: string): boolean {
  const relativePath = relative(parent, child);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function labelRepoPath(repoRoot: string, absolutePath: string): string {
  if (!isInsideOrEqual(repoRoot, absolutePath)) return "<outside-repository>";
  const relativePath = relative(repoRoot, absolutePath);
  return relativePath ? toPosixPath(relativePath) : ".";
}

function assertRepoLocalPath(
  repoRoot: string,
  absolutePath: string,
  code: GameDataGeneratorErrorCode
) {
  if (isInsideOrEqual(repoRoot, absolutePath)) return;
  const noun = code === "source_outside_repo" ? "source" : "output root";
  throw new GameDataGeneratorError(
    code,
    `Game data ${noun} path must stay inside this repository. Pass a repository-relative path.`
  );
}

export function createGameDataGenerationPlan(
  options: GameDataGenerationPlanOptions = {}
): GameDataGenerationPlan {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const sourceDir = resolve(repoRoot, options.sourceDir ?? DEFAULT_GAME_DATA_SOURCE_DIR);
  const outputRoot = resolve(repoRoot, options.outputRoot ?? ".");
  const sourceDirLabel = labelRepoPath(repoRoot, sourceDir);
  const outputRootLabel = labelRepoPath(repoRoot, outputRoot);

  assertRepoLocalPath(repoRoot, sourceDir, "source_outside_repo");
  assertRepoLocalPath(repoRoot, outputRoot, "output_outside_repo");

  if (!existsSync(sourceDir)) {
    throw new GameDataGeneratorError(
      "source_missing",
      `Game data source not found at ${sourceDirLabel}. Add a local LostCityRS/Content checkout there or pass --source-dir <repo-relative path>.`
    );
  }

  if (!statSync(sourceDir).isDirectory()) {
    throw new GameDataGeneratorError(
      "source_not_directory",
      `Game data source at ${sourceDirLabel} is not a directory.`
    );
  }

  const outputs = Object.fromEntries(
    Object.entries(GENERATED_GAME_DATA_OUTPUT_PATHS).map(([key, targetPath]) => {
      const absolutePath = resolve(outputRoot, targetPath);
      return [
        key,
        {
          key,
          targetPath,
          absolutePath,
          pathLabel: labelRepoPath(repoRoot, absolutePath)
        }
      ];
    })
  ) as Record<GeneratedGameDataOutputKey, GameDataGenerationOutputPath>;

  const manifestPath = join(sourceDir, FOUNDATION_SOURCE_MANIFEST_FILE);
  const parserStatus: GameDataGenerationPlan["parserStatus"] = existsSync(manifestPath)
    ? "foundation-manifest"
    : "foundation-empty";

  return {
    generatorVersion: GAME_DATA_GENERATOR_VERSION,
    parserStatus,
    sourceDir,
    sourceDirLabel,
    outputRoot,
    outputRootLabel,
    outputs,
    notes: [
      "This foundation validates the local source checkout and writes a schema-valid normalized snapshot.",
      "It does not parse raw LostCityRS/Content or change runtime data loading."
    ]
  };
}

export function formatGameDataGenerationPlan(plan: GameDataGenerationPlan): string {
  return [
    `Game data generator ${plan.generatorVersion} ready.`,
    `Source: ${plan.sourceDirLabel}`,
    `Output root: ${plan.outputRootLabel}`,
    "Planned outputs:",
    `- source pin: ${plan.outputs.sourcePin.pathLabel}`,
    `- game data snapshot: ${plan.outputs.gameData.pathLabel}`,
    `- revision impact report: ${plan.outputs.revisionImpact.pathLabel}`,
    `Parser status: ${plan.parserStatus}.`,
    "No files were written."
  ].join("\n");
}

function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, nestedValue]) => [key, stableSort(nestedValue)])
  );
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`;
}

function inlineCode(value: string): string {
  return `\`${value.replace(/`/g, "'")}\``;
}

const FORBIDDEN_GENERATED_DATA_KEYS = new Map(
  [
    "raw",
    "rawSource",
    "rawUpstream",
    "upstreamDump",
    "sourceFiles",
    "historicalSnapshots",
    "priceHistory",
    "marketPriceHistory"
  ].map((key) => [key.toLowerCase(), key])
);

const FORBIDDEN_GENERATED_DATA_TEXT_PATTERNS = [
  {
    pattern: /(^|[\s"`'])\/Users\//,
    label: "absolute user-home path"
  },
  {
    pattern: /(^|[\s"`'])\/home\//,
    label: "absolute user-home path"
  },
  {
    pattern: /[A-Za-z]:\\Users\\/,
    label: "absolute user-home path"
  },
  {
    pattern: /src\/data\/generated\/(?:archive|history|snapshots)\//,
    label: "historical generated snapshot archive path"
  },
  {
    pattern: /docs\/project\/revision-impact\/(?:archive|history|snapshots)\//,
    label: "historical revision-impact archive path"
  }
];

function collectObjectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectObjectKeys(entry, keys));
    return keys;
  }
  if (value === null || typeof value !== "object") return keys;
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key);
    collectObjectKeys(nestedValue, keys);
  }
  return keys;
}

function parseGeneratedOutputJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GameDataGeneratorError(
      "output_validation_failed",
      `Generated output ${label} is not valid JSON.`
    );
  }
}

export function assertGeneratedDataOutputHygiene(outputs: GeneratedGameDataOutputTexts): void {
  const keys = new Set<string>();
  collectObjectKeys(parseGeneratedOutputJson(outputs.sourcePinText, "source-pin.json"), keys);
  collectObjectKeys(parseGeneratedOutputJson(outputs.gameDataText, "game-data.json"), keys);

  for (const key of keys) {
    const forbiddenKey = FORBIDDEN_GENERATED_DATA_KEYS.get(key.toLowerCase());
    if (!forbiddenKey) continue;
    throw new GameDataGeneratorError(
      "output_validation_failed",
      `Generated outputs must not contain forbidden generated-data key ${inlineCode(forbiddenKey)}.`
    );
  }

  const combinedText = [
    outputs.sourcePinText,
    outputs.gameDataText,
    outputs.revisionImpactText
  ].join("\n");
  for (const { pattern, label } of FORBIDDEN_GENERATED_DATA_TEXT_PATTERNS) {
    if (!pattern.test(combinedText)) continue;
    throw new GameDataGeneratorError(
      "output_validation_failed",
      `Generated outputs must not contain ${label}.`
    );
  }
}

function readManifest(sourceDir: string): FoundationSourceManifest {
  const manifestPath = join(sourceDir, FOUNDATION_SOURCE_MANIFEST_FILE);
  if (!existsSync(manifestPath)) return {};

  try {
    const parsed = parseJsonWithDuplicateKeyCheck(readFileSync(manifestPath, "utf8"), {
      source: FOUNDATION_SOURCE_MANIFEST_FILE
    });
    return FoundationSourceManifestSchema.parse(parsed);
  } catch {
    throw new GameDataGeneratorError(
      "source_manifest_invalid",
      `Game data foundation source manifest ${FOUNDATION_SOURCE_MANIFEST_FILE} is invalid.`
    );
  }
}

function emptyEquipment(): GameDataSnapshot["equipment"] {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, {}])) as GameDataSnapshot["equipment"];
}

function createEmptyFoundationSnapshot(provenance: DataProvenance): GameDataSnapshot {
  return parseGameDataSnapshot({
    id: "generated-foundation-empty",
    label: "Generated game data foundation empty snapshot",
    items: {},
    monsters: {},
    weapons: {},
    ammo: {},
    spells: {},
    equipment: emptyEquipment(),
    provenance
  });
}

function isoTimestamp(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw new GameDataGeneratorError("invalid_argument", "Invalid generatedAt timestamp");
  }
  return date.toISOString();
}

function readGitCommit(sourceDir: string): string | undefined {
  const gitDir = join(sourceDir, ".git");
  if (!existsSync(gitDir) || !statSync(gitDir).isDirectory()) return undefined;

  try {
    const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
    if (/^[0-9a-f]{7,40}$/i.test(head)) return head;
    const refMatch = /^ref: (.+)$/.exec(head);
    if (!refMatch) return undefined;
    const refPath = join(gitDir, refMatch[1]);
    const commit = readFileSync(refPath, "utf8").trim();
    return /^[0-9a-f]{7,40}$/i.test(commit) ? commit : undefined;
  } catch {
    return undefined;
  }
}

function commandForPlan(plan: GameDataGenerationPlan, generatedAt: string): string {
  return [
    "npm run data:generate --",
    `--source-dir ${plan.sourceDirLabel}`,
    `--output-root ${plan.outputRootLabel}`,
    `--generated-at ${generatedAt}`
  ].join(" ");
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function diffRecord(section: string, previous: unknown, next: unknown): SnapshotDiffSection {
  const previousRecord = objectRecord(previous);
  const nextRecord = objectRecord(next);
  const previousIds = new Set(Object.keys(previousRecord));
  const nextIds = new Set(Object.keys(nextRecord));
  const sharedIds = [...nextIds].filter((id) => previousIds.has(id));

  return {
    section,
    added: [...nextIds].filter((id) => !previousIds.has(id)).sort(),
    removed: [...previousIds].filter((id) => !nextIds.has(id)).sort(),
    changed: sharedIds
      .filter((id) => stableJson(previousRecord[id]) !== stableJson(nextRecord[id]))
      .sort()
  };
}

function flattenEquipment(snapshot: GameDataSnapshot): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};
  for (const slot of EQUIPMENT_SLOTS) {
    for (const [itemId, item] of Object.entries(snapshot.equipment[slot] ?? {})) {
      flattened[`${slot}.${itemId}`] = item;
    }
  }
  return flattened;
}

function readBaselineSnapshot(plan: GameDataGenerationPlan): {
  baseline: RevisionImpactBaseline;
  snapshot?: GameDataSnapshot;
} {
  const baselinePath = plan.outputs.gameData.absolutePath;
  const pathLabel = plan.outputs.gameData.pathLabel;
  if (!existsSync(baselinePath)) {
    return {
      baseline: {
        status: "not-found",
        pathLabel
      }
    };
  }

  try {
    const parsed = parseJsonWithDuplicateKeyCheck(readFileSync(baselinePath, "utf8"), {
      source: pathLabel
    });
    return {
      baseline: {
        status: "valid",
        pathLabel
      },
      snapshot: parseGameDataSnapshot(parsed)
    };
  } catch {
    return {
      baseline: {
        status: "invalid",
        pathLabel
      }
    };
  }
}

function createRevisionImpactSummary(
  plan: GameDataGenerationPlan,
  gameData: GameDataSnapshot
): RevisionImpactSummary {
  const baseline = readBaselineSnapshot(plan);
  if (!baseline.snapshot) {
    return {
      baseline: baseline.baseline,
      sections: []
    };
  }

  const sections: SnapshotDiffSection[] = [
    ...(["items", "monsters", "weapons", "ammo", "spells"] as SnapshotSectionKey[]).map((key) =>
      diffRecord(key, baseline.snapshot?.[key], gameData[key])
    ),
    diffRecord("equipment", flattenEquipment(baseline.snapshot), flattenEquipment(gameData))
  ];

  return {
    baseline: baseline.baseline,
    sections
  };
}

function formatList(values: string[], limit = 8): string {
  if (!values.length) return "none";
  const visible = values.slice(0, limit).map(inlineCode).join(", ");
  const hidden = values.length > limit ? `, +${values.length - limit} more` : "";
  return `${visible}${hidden}`;
}

function totalCount(section: SnapshotDiffSection): number {
  return section.added.length + section.removed.length + section.changed.length;
}

function validationStatusLines(summary: RevisionImpactSummary): string[] {
  const baselineStatus =
    summary.baseline.status === "not-found"
      ? `not found at ${inlineCode(summary.baseline.pathLabel)}; first-run diff baseline is unavailable`
      : summary.baseline.status === "invalid"
        ? `invalid at ${inlineCode(summary.baseline.pathLabel)}; diff skipped`
        : `valid at ${inlineCode(summary.baseline.pathLabel)}`;

  return [
    "- `GameDataSnapshotSchema`: pass",
    "- `source-pin.json`: generated",
    "- `revision-impact/current.md`: generated",
    `- Diff baseline: ${baselineStatus}`,
    "- Calculation-impact suite: not run in this foundation slice"
  ];
}

function diffSummaryLines(summary: RevisionImpactSummary): string[] {
  if (summary.baseline.status === "not-found") {
    return [
      "No previous `game-data.json` baseline was found at the configured output path.",
      "Added/removed/changed counts are intentionally not inferred for this first-run path."
    ];
  }
  if (summary.baseline.status === "invalid") {
    return [
      "A previous `game-data.json` file exists, but it did not validate with `GameDataSnapshotSchema`.",
      "Added/removed/changed counts are skipped until the baseline is valid."
    ];
  }

  const table = [
    "| Section | Added | Removed | Changed |",
    "| --- | ---: | ---: | ---: |",
    ...summary.sections.map(
      (section) =>
        `| ${section.section} | ${section.added.length} | ${section.removed.length} | ${section.changed.length} |`
    )
  ];
  const details = summary.sections
    .filter((section) => totalCount(section) > 0)
    .flatMap((section) => [
      "",
      `- ${section.section} added: ${formatList(section.added)}`,
      `- ${section.section} removed: ${formatList(section.removed)}`,
      `- ${section.section} changed: ${formatList(section.changed)}`
    ]);

  return [...table, ...(details.length ? details : ["", "No schema-level snapshot changes detected."])];
}

function createRevisionImpactReport(
  outputs: Omit<GeneratedGameDataOutputs, "revisionImpactText" | "changedFiles">
): string {
  const summary = createRevisionImpactSummary(outputs.plan, outputs.gameData);
  const sourceRef = [
    outputs.sourcePin.source.name,
    outputs.sourcePin.source.revision,
    outputs.sourcePin.source.commit
  ]
    .filter(Boolean)
    .join(" / ");

  return [
    "# Current Game Revision Impact",
    "",
    "Status: foundation report.",
    "",
    "## Source",
    "",
    `- Source ref: ${sourceRef}`,
    `- Source path: ${inlineCode(outputs.sourcePin.source.path)}`,
    `- Generated at: ${outputs.sourcePin.generatedAt}`,
    `- Generator version: ${outputs.sourcePin.generator.version}`,
    `- Generator command: ${inlineCode(outputs.sourcePin.generator.command)}`,
    "",
    "## Runtime Status",
    "",
    "- Runtime bootstrap: legacy adapter.",
    "- The Vite app still loads the validated legacy adapter snapshot until a separate goal switches runtime bootstrap to generated data.",
    "- This report does not accept generated snapshot values as runtime truth by itself.",
    "",
    "## Validation Status",
    "",
    ...validationStatusLines(summary),
    "",
    "## Snapshot Diff Summary",
    "",
    ...diffSummaryLines(summary),
    "",
    "## Calculation Impact",
    "",
    "- Full hybrid calculation-impact suite: not implemented in this foundation slice.",
    "- Representative DPS, kills/hr, XP/hr, GP/hr and GP/XP diffs are not produced yet.",
    "- No changed calculation outputs are accepted as intentional deltas by this report.",
    "",
    "## Known Limitations",
    "",
    "- Foundation input uses a normalized manifest fixture; authoritative LostCityRS/Content file parsing is not implemented yet.",
    "- Generated item requirement extraction is not implemented yet.",
    "- NPC-size, dragon halberd behavior and final special-case source truth are not decided here.",
    "- Market prices and market price history are outside this game-data snapshot workflow.",
    "- Historical generated snapshot archives are intentionally not committed.",
    "",
    "## Open Questions",
    "",
    "- What exact upstream fields should populate the final normalized simulator-consumed `GameDataSnapshot`?",
    "- What concrete case files and item/spell/equipment ids should implement the accepted hybrid calculation-impact suite?",
    "- How should generated planner/loadout requirements be represented without changing the current manual requirement policy in this slice?",
    "- Which future PR should switch the browser bootstrap from the legacy adapter to `src/data/generated/game-data.json`?",
    ""
  ].join("\n");
}

function provenanceForPlan(
  plan: GameDataGenerationPlan,
  generatedAt: string,
  manifest: FoundationSourceManifest
): DataProvenance {
  const sourceRef = [
    manifest.source?.name ?? "LostCityRS/Content",
    manifest.source?.revision ?? readGitCommit(plan.sourceDir) ?? "unresolved-revision"
  ].join(" ");

  return {
    source: "manual",
    sourceRef,
    verifiedAt: generatedAt,
    notes:
      "Foundation generated snapshot. This output is schema-valid and normalized, but LostCityRS/Content file parsing and authoritative field extraction are not implemented yet."
  };
}

export function createGeneratedGameDataOutputs(
  options: CreateGeneratedGameDataOutputOptions = {}
): GeneratedGameDataOutputs {
  const plan = createGameDataGenerationPlan(options);
  const generatedAt = isoTimestamp(options.generatedAt);
  const manifest = readManifest(plan.sourceDir);
  const provenance = provenanceForPlan(plan, generatedAt, manifest);
  const gameData = manifest.snapshot
    ? parseGameDataSnapshot({
        ...manifest.snapshot,
        provenance
      })
    : createEmptyFoundationSnapshot(provenance);

  const sourcePin: GeneratedGameDataSourcePin = {
    schemaVersion: 1,
    source: {
      name: manifest.source?.name ?? "LostCityRS/Content",
      path: plan.sourceDirLabel,
      ...(manifest.source?.revision ? { revision: manifest.source.revision } : {}),
      ...(manifest.source?.commit ?? readGitCommit(plan.sourceDir)
        ? { commit: manifest.source?.commit ?? readGitCommit(plan.sourceDir) }
        : {})
    },
    generatedAt,
    generator: {
      name: "index-sim-data-generator",
      version: GAME_DATA_GENERATOR_VERSION,
      command: options.command ?? commandForPlan(plan, generatedAt)
    },
    outputs: {
      sourcePin: plan.outputs.sourcePin.pathLabel,
      gameData: plan.outputs.gameData.pathLabel,
      revisionImpact: plan.outputs.revisionImpact.pathLabel
    },
    scope: {
      status: "foundation",
      parser: plan.parserStatus,
      runtimeBootstrap: "legacy-adapter",
      notes: [
        "Generated output is committed as a foundation artifact only.",
        "Runtime still loads the validated legacy adapter snapshot.",
        "Upstream file bodies, market price history and historical game-data snapshots are intentionally excluded."
      ]
    }
  };

  const gameDataText = stableJson(GameDataSnapshotSchema.parse(gameData));
  const sourcePinText = stableJson(sourcePin);

  try {
    parseGameDataSnapshot(JSON.parse(gameDataText) as unknown);
  } catch {
    throw new GameDataGeneratorError(
      "output_validation_failed",
      "Generated game-data.json failed GameDataSnapshotSchema validation."
    );
  }

  const baseOutputs = {
    plan,
    sourcePin,
    gameData,
    sourcePinText,
    gameDataText
  };
  const revisionImpactText = createRevisionImpactReport(baseOutputs);
  assertGeneratedDataOutputHygiene({
    sourcePinText,
    gameDataText,
    revisionImpactText
  });

  return {
    ...baseOutputs,
    revisionImpactText,
    changedFiles: []
  };
}

function writeIfChanged(filePath: string, text: string, dryRun: boolean): boolean {
  let previous = "";
  try {
    previous = readFileSync(filePath, "utf8");
  } catch {
    previous = "";
  }
  if (previous === text) return false;
  if (!dryRun) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, text);
  }
  return true;
}

export function writeGeneratedGameDataOutputs(
  options: WriteGeneratedGameDataOutputOptions = {}
): GeneratedGameDataOutputs {
  const outputs = createGeneratedGameDataOutputs(options);
  const dryRun = options.dryRun ?? false;
  const changedFiles = [
    writeIfChanged(outputs.plan.outputs.sourcePin.absolutePath, outputs.sourcePinText, dryRun)
      ? outputs.plan.outputs.sourcePin.pathLabel
      : null,
    writeIfChanged(outputs.plan.outputs.gameData.absolutePath, outputs.gameDataText, dryRun)
      ? outputs.plan.outputs.gameData.pathLabel
      : null,
    writeIfChanged(
      outputs.plan.outputs.revisionImpact.absolutePath,
      outputs.revisionImpactText,
      dryRun
    )
      ? outputs.plan.outputs.revisionImpact.pathLabel
      : null
  ].filter((fileName): fileName is string => fileName !== null);

  return {
    ...outputs,
    changedFiles
  };
}

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseJsonWithDuplicateKeyCheck } from "../src/data/reliability";
import { parseGameDataSnapshot } from "../src/data/schemas/game-data";
import {
  assertBoundedNpcAttackSource,
  createNpcAttackSourceAudit,
  type NpcAttackAuditProfile,
  type NpcAttackAuditRow,
  type NpcAttackSourceAudit
} from "./lostcity-content-npc-attacks";

const DEFAULT_SOURCE_DIR = ".sources/lostcity-content";
const SOURCE_PIN_PATH = "src/data/generated/source-pin.json";
const GAME_DATA_PATH = "src/data/generated/game-data.json";
export const NPC_ATTACK_AUDIT_REPORT_PATH = "docs/project/npc-attack-source-audit.md";
export const NPC_ATTACK_AUDIT_EXPECTED_MONSTER_COUNT = 63;
export const NPC_ATTACK_AUDIT_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

interface SourcePin {
  source: { commit: string; path: string };
}

export interface NpcAttackAuditCliOptions {
  sourceDir: string;
  format: "markdown" | "json";
  write: boolean;
  check: boolean;
}

function sourcePin(): SourcePin {
  const parsed = parseJsonWithDuplicateKeyCheck(readFileSync(SOURCE_PIN_PATH, "utf8"), {
    source: "generated source pin"
  }) as Partial<SourcePin>;
  if (!parsed.source?.commit || !parsed.source.path) {
    throw new Error("Generated source pin is missing source commit/path metadata.");
  }
  return parsed as SourcePin;
}

function checkedSourceRevision(sourceDir: string, expectedRevision: string): string {
  const revision = execFileSync("git", ["-C", resolve(sourceDir), "rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  if (!/^[0-9a-f]{40}$/.test(revision)) {
    throw new Error("LostCity source checkout returned an invalid revision.");
  }
  if (revision !== expectedRevision) {
    throw new Error(
      `LostCity source checkout revision ${revision.slice(0, 12)} does not match committed source pin ${expectedRevision.slice(0, 12)}.`
    );
  }
  return revision;
}

function profileLabel(profile: NpcAttackAuditProfile): string {
  const maxHit =
    profile.maxHitCandidates.length > 0 ? profile.maxHitCandidates.join("/") : "unresolved";
  const accuracy =
    profile.accuracy.kind === "standard"
      ? `standard(${profile.accuracy.level},${profile.accuracy.bonus})`
      : profile.accuracy.kind;
  return `${profile.attackType}:${profile.maxHitRule}:max=${maxHit}:acc=${accuracy}`;
}

function overlayLabel(row: NpcAttackAuditRow): string {
  return (
    [
      row.overlays.poisonSeverity !== undefined ? `poison=${row.overlays.poisonSeverity}` : "",
      row.overlays.dragonfire ? "dragonfire" : ""
    ]
      .filter(Boolean)
      .join(", ") || "none"
  );
}

function markdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function formatNpcAttackSourceAuditMarkdown(report: NpcAttackSourceAudit): string {
  const partialOrFallback = report.rows.filter((row) => row.coverage !== "exact");
  const contextual = report.rows.filter((row) => row.selection === "contextual");
  const sourceWeighted = report.rows.filter((row) => row.selection === "source-weighted");
  const profileRules = new Map<string, number>();
  for (const row of report.rows) {
    for (const entry of row.profiles) {
      const key = `${entry.attackType}:${entry.maxHitRule}`;
      profileRules.set(key, (profileRules.get(key) ?? 0) + 1);
    }
  }

  return (
    [
      "# Revision 274 NPC attack source audit",
      "",
      "Status: Goal 1 evidence complete; bounded calculation policy accepted by D-081 and implemented.",
      "",
      "This report is deterministic evidence from the committed runtime catalog and the pinned LostCityRS/Content checkout. `exact` means the audit resolved one complete source path. D-081 separately owns the accepted runtime policy; this report alone does not approve future formula or baseline changes.",
      "",
      "## Queue status",
      "",
      "| Phase | Status | Evidence / dependency |",
      "| --- | --- | --- |",
      "| Goal 1 — source audit and decision package | `DONE` | All active runtime monsters are classified below against the pinned source revision. |",
      "| Goal 2 — typed profiles and generated data | `DONE` | D-081 accepts the bounded contract; the Revision 274 snapshot contains 55 exact and eight partial typed rows. |",
      "| Goal 3 — one Trip incoming descriptor | `DONE` | Trip owns normalization, expected damage, overlays, compatibility coverage and fail-closed exact validation. |",
      "| Goal 4 — Risk/UI integration and impact validation | `DONE` | Risk consumes the Trip descriptor; Trip/Stats/Risk expose source-backed, partial and compatibility coverage. Validation evidence is recorded in technical testing docs. |",
      "",
      "## Source boundary",
      "",
      `- Source directory: \`${report.sourceDir}\``,
      `- Pinned revision: \`${report.sourceRevision}\``,
      `- Bounded source inputs: ${report.sourceInputFileCount} files / ${report.sourceInputBytes} bytes`,
      `- Parser limits: files<=${report.parserLimits.maxFiles}, file-bytes<=${report.parserLimits.maxFileBytes}, total-bytes<=${report.parserLimits.maxTotalBytes}, reachable-blocks<=${report.parserLimits.maxReachableBlocks}, report-bytes<=${NPC_ATTACK_AUDIT_MAX_OUTPUT_BYTES}`,
      `- Active runtime monsters: ${report.runtimeMonsterCount}`,
      "- Inputs: committed generated game-data identities, mapped NPC configs, combat params, RuneScript handlers and magic spell rows.",
      "- Excluded from output: raw source bodies, absolute paths, inferred context weights and production calculation claims.",
      "",
      "## Coverage summary",
      "",
      `- Exact source path: ${report.counts.exact}`,
      `- Partial source path: ${report.counts.partial}`,
      `- Fallback/unresolved source path: ${report.counts.fallback}`,
      `- Attack families by monster: melee=${report.attackFamilyCounts.melee}, ranged=${report.attackFamilyCounts.ranged}, magic=${report.attackFamilyCounts.magic}, unknown=${report.attackFamilyCounts.unknown}`,
      `- Source overlays: poison=${report.overlayCounts.poison}, dragonfire=${report.overlayCounts.dragonfire}`,
      `- Profile rules: ${
        [...profileRules.entries()]
          .sort()
          .map(([key, count]) => `${key}=${count}`)
          .join(", ") || "none"
      }`,
      `- Contextual/multi-path selection: ${contextual.length}`,
      `- Source-weighted selection with explicit pinned-source evidence: ${sourceWeighted.length}`,
      "",
      "## Accepted bounded policy (D-081)",
      "",
      "The accepted implementation choices are:",
      "",
      "1. **Generated contract:** typed optional `incomingAttacks` stores a versioned formula id, sanitized source inputs, resolved max hit, selection, coverage and repository-relative provenance.",
      "2. **Formula policy:** standard melee/ranged uses the pinned integer formula; spell-row, forced and fully parsed fixed damage use the exact source integer.",
      "3. **Context policy:** only explicit source weights are normalized. Contextual or unsupported handlers stay `partial` and preserve the compatibility expected value without guessed frequencies.",
      "4. **Overlay ownership:** dragonfire and poison remain separate Trip overlays in this migration and are not counted inside attack profiles.",
      "5. **Baseline policy:** generated data and runtime changes require read-only impact review; numeric, golden and visual baselines are not rewritten automatically.",
      "",
      "Implemented boundaries:",
      "",
      "- Exact generated rows fail closed if their formula, profile count, weight, tick or max-hit contract is invalid.",
      "- Partial and legacy paths are visible as mean-only coverage in Trip, Stats and Risk.",
      "- Handler-specific contextual frequencies, dynamic AI and overlay migration remain future decision boundaries.",
      "",
      `Partial/fallback rows requiring policy or parser follow-up: ${partialOrFallback.map((row) => row.runtimeId).join(", ") || "none"}.`,
      "",
      "## Per-monster evidence",
      "",
      "| Runtime | Source NPC | Handler | Speed | Profiles | Selection | Overlays | Coverage | Issues | Provenance |",
      "| --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |",
      ...report.rows.map((row) =>
        [
          row.runtimeId,
          row.sourceId,
          row.handlerResolution,
          String(row.attackSpeedTicks),
          row.profiles.map(profileLabel).join("; "),
          row.selectionEvidence ? `${row.selection} (${row.selectionEvidence})` : row.selection,
          overlayLabel(row),
          row.coverage,
          row.issues.join(", ") || "none",
          row.provenance.join("; ")
        ]
          .map(markdownCell)
          .join(" | ")
          .replace(/^/, "| ")
          .replace(/$/, " |")
      ),
      "",
      "## Interpretation boundary",
      "",
      "- Standard-melee candidates reproduce the pinned source expression as audit evidence only.",
      "- `contextual` deliberately carries no probability or weight.",
      "- `partial` and `fallback` rows may carry typed evidence but must not be normalized or presented as exact.",
      "- Source provenance is repository-relative and does not include raw script bodies.",
      "- D-081 accepts only the bounded policy above; future contextual weights, overlay migration and baseline changes remain decision-gated."
    ].join("\n") + "\n"
  );
}

export function assertBoundedNpcAttackAuditOutput(output: string): void {
  if (Buffer.byteLength(output, "utf8") > NPC_ATTACK_AUDIT_MAX_OUTPUT_BYTES) {
    throw new Error("NPC attack audit output exceeds the bounded report size.");
  }
}

export function parseNpcAttackAuditArgs(argv: string[]): NpcAttackAuditCliOptions {
  const options: NpcAttackAuditCliOptions = {
    sourceDir: DEFAULT_SOURCE_DIR,
    format: "markdown",
    write: false,
    check: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.format = "json";
      continue;
    }
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--check") {
      options.check = true;
      continue;
    }
    if (arg === "--source-dir") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --source-dir");
      options.sourceDir = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument ${arg}`);
  }
  if (options.write && options.check) throw new Error("--write and --check are mutually exclusive");
  if (options.check && options.format !== "markdown") {
    throw new Error("--check supports markdown output only");
  }
  return options;
}

export function createCurrentNpcAttackSourceAudit(
  options: Pick<NpcAttackAuditCliOptions, "sourceDir">
): NpcAttackSourceAudit {
  const pin = sourcePin();
  if (options.sourceDir === DEFAULT_SOURCE_DIR && pin.source.path !== options.sourceDir) {
    throw new Error("Default LostCity source path does not match the committed source pin.");
  }
  const sourceTree = assertBoundedNpcAttackSource({ sourceDir: options.sourceDir });
  const revision = checkedSourceRevision(sourceTree.sourceRoot, pin.source.commit);
  const reference = parseGameDataSnapshot(
    parseJsonWithDuplicateKeyCheck(readFileSync(GAME_DATA_PATH, "utf8"), {
      source: "generated game data"
    })
  );
  const report = createNpcAttackSourceAudit({
    sourceDir: sourceTree.sourceDirLabel,
    sourceRevision: revision,
    reference
  });
  if (report.runtimeMonsterCount !== NPC_ATTACK_AUDIT_EXPECTED_MONSTER_COUNT) {
    throw new Error(
      `NPC attack audit expected ${NPC_ATTACK_AUDIT_EXPECTED_MONSTER_COUNT} active monsters, received ${report.runtimeMonsterCount}.`
    );
  }
  return report;
}

export function main(argv = process.argv.slice(2)): void {
  const options = parseNpcAttackAuditArgs(argv);
  const report = createCurrentNpcAttackSourceAudit(options);
  const output =
    options.format === "json"
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatNpcAttackSourceAuditMarkdown(report);
  assertBoundedNpcAttackAuditOutput(output);
  if (options.check) {
    const committed = readFileSync(NPC_ATTACK_AUDIT_REPORT_PATH, "utf8");
    if (committed !== output) {
      throw new Error(
        `${NPC_ATTACK_AUDIT_REPORT_PATH} is stale; review the audit change and run npm run npc:attack-audit:write.`
      );
    }
    console.log(`${NPC_ATTACK_AUDIT_REPORT_PATH} is current`);
    return;
  }
  if (options.write) {
    if (options.format !== "markdown") throw new Error("--write supports markdown output only");
    writeFileSync(NPC_ATTACK_AUDIT_REPORT_PATH, output);
    console.log(`Wrote ${NPC_ATTACK_AUDIT_REPORT_PATH}`);
    return;
  }
  console.log(output.trimEnd());
}

if (process.env.NPC_ATTACK_SOURCE_AUDIT_CLI === "1") {
  try {
    main();
  } catch (error) {
    console.error(
      `npc:attack-audit failed: ${error instanceof Error ? error.message : "internal-error"}`
    );
    process.exitCode = 1;
  }
}

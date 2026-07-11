import { resolve } from "node:path";
import type {
  DataProvenance,
  EntityId,
  GameDataSnapshot,
  IncomingAttackFormulaId,
  IncomingAttackFormulaInputs,
  IncomingAttackProfile,
  IncomingAttackSelection
} from "../src/domain/shared";
import {
  LostCityContentSourceError,
  lastConfigValue,
  readLostCityConfigCatalog,
  resolvedConfigParamValue,
  type LostCityConfigCatalog,
  type LostCityConfigEntry
} from "./lostcity-content-config";
import { extractLostCityMonsterCombatSource } from "./lostcity-content-monsters";
import {
  LOSTCITY_MONSTER_SOURCE_MAPPINGS,
  lostCityMonsterSourceId
} from "./lostcity-content-runtime-mapping";
import {
  assertBoundedLostCitySourceTree,
  LOSTCITY_SOURCE_MAX_FILE_BYTES,
  LOSTCITY_SOURCE_MAX_FILES,
  LOSTCITY_SOURCE_MAX_TOTAL_BYTES,
  lostCityRuneScriptBlockKey,
  readLostCityRuneScriptCatalog,
  type LostCityRuneScriptBlock as RuneScriptBlock,
  type LostCityRuneScriptCatalog as RuneScriptCatalog
} from "./lostcity-content-runescript";

export type NpcAttackAuditCoverage = "exact" | "partial" | "fallback";
export const NPC_ATTACK_AUDIT_MAX_NUMERIC_INPUT = 1_000_000;
export const NPC_ATTACK_AUDIT_MAX_REACHABLE_BLOCKS = 96;
export type NpcAttackFamily = "melee" | "ranged" | "magic" | "unknown";
export type NpcAttackMaxHitRule =
  "standard-melee" | "standard-ranged" | "spell" | "forced" | "scripted" | "unresolved";

export interface NpcAttackAuditProfile {
  attackType: NpcAttackFamily;
  maxHitRule: NpcAttackMaxHitRule;
  maxHitCandidates: number[];
  maxHitInputs?: { kind: "standard"; level: number; bonus: number };
  accuracy:
    | { kind: "standard"; level: number; bonus: number }
    | { kind: "always" }
    | { kind: "unresolved" };
  sourceRefs: string[];
}

export interface NpcAttackAuditRow {
  runtimeId: EntityId;
  sourceId: EntityId;
  configSourceRef: string;
  handlerResolution: "direct" | "category" | "default" | "unresolved";
  handlerSourceRefs: string[];
  attackSpeedTicks: number;
  profiles: NpcAttackAuditProfile[];
  selection: "always" | "source-weighted" | "contextual" | "unresolved";
  selectionEvidence?: string;
  overlays: {
    poisonSeverity?: number;
    dragonfire: boolean;
  };
  coverage: NpcAttackAuditCoverage;
  issues: string[];
  provenance: string[];
}

export interface NpcAttackSourceAudit {
  sourceDir: string;
  sourceRevision: string;
  sourceInputFileCount: number;
  sourceInputBytes: number;
  parserLimits: {
    maxFiles: number;
    maxFileBytes: number;
    maxTotalBytes: number;
    maxReachableBlocks: number;
  };
  runtimeMonsterCount: number;
  counts: Record<NpcAttackAuditCoverage, number>;
  attackFamilyCounts: Record<NpcAttackFamily, number>;
  overlayCounts: { poison: number; dragonfire: number };
  rows: NpcAttackAuditRow[];
}

export interface GeneratedNpcIncomingAttacks {
  incomingAttacks: IncomingAttackProfile[];
  incomingAttackCoverage: NpcAttackAuditCoverage;
}

interface AttackEvidence {
  standardMelee: boolean;
  standardRanged: boolean;
  spellIds: Set<string>;
  forcedMagicMaxHits: Set<number>;
  scriptedMeleeMaxHits: Set<number>;
  scriptedRangedMaxHits: Set<number>;
  scriptedMagicMaxHits: Set<number>;
  scriptedMagic: boolean;
  standardAccuracyFamilies: Set<NpcAttackFamily>;
  scriptedUnknown: boolean;
  dragonfire: boolean;
  hasSelectionBranch: boolean;
  sourceWeightedSelection?: string;
  sourceRefs: Set<string>;
}

export function assertBoundedNpcAttackSource(input: {
  repoRoot?: string;
  sourceDir: string;
}): ReturnType<typeof assertBoundedLostCitySourceTree> {
  return assertBoundedLostCitySourceTree({
    ...input,
    extensions: new Set([".npc", ".param", ".dbrow", ".rs2"])
  });
}

function parseRuneScriptCatalog(repoRoot: string, sourceDir: string): RuneScriptCatalog {
  const catalog = readLostCityRuneScriptCatalog({ repoRoot, sourceDir });
  for (const [key, blocks] of catalog.blocksByKey) {
    if (
      blocks.length < 2 ||
      (!key.startsWith("ai_opplayer2:") && !key.startsWith("ai_applayer2:"))
    ) {
      continue;
    }
    throw new LostCityContentSourceError(
      "duplicate_script_trigger",
      `LostCity ${blocks[0].kind} trigger \`${blocks[0].id}\` is duplicated in \`${blocks[0].sourceRef}\` and \`${blocks[1].sourceRef}\`.`
    );
  }
  return catalog;
}

function integerValue(value: string | undefined): number | undefined {
  if (value === undefined || !/^-?[0-9]+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function requiredInteger(
  entry: LostCityConfigEntry,
  value: string | undefined,
  label: string,
  minimum = 0
): number {
  const parsed = integerValue(value);
  if (parsed === undefined || parsed < minimum || parsed > NPC_ATTACK_AUDIT_MAX_NUMERIC_INPUT) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity NPC \`${entry.sourceRef}\` has invalid ${label}.`
    );
  }
  return parsed;
}

function standardMaxHit(level: number, bonus: number): number {
  return Math.floor(((level + 9) * (bonus + 64) + 320) / 640);
}

function spellMaxHitMap(dbrows: LostCityConfigCatalog): Map<string, number> {
  const result = new Map<string, number>();
  for (const entry of dbrows.entries.values()) {
    const data = entry.properties.data ?? [];
    const spell = data.find((row) => row.startsWith("spell,^"))?.slice("spell,^".length);
    const maxHit = integerValue(data.find((row) => row.startsWith("maxhit,"))?.slice(7)) ?? 0;
    if (!spell) continue;
    const previous = result.get(spell);
    if (previous !== undefined && previous !== maxHit) {
      throw new LostCityContentSourceError(
        "config_invalid",
        `LostCity spell \`${spell}\` has conflicting max-hit rows.`
      );
    }
    result.set(spell, maxHit);
  }
  return result;
}

function handlerBlocks(
  sourceId: string,
  npc: LostCityConfigEntry,
  catalog: RuneScriptCatalog
): { blocks: RuneScriptBlock[]; resolution: NpcAttackAuditRow["handlerResolution"] } {
  const direct = ["ai_opplayer2", "ai_applayer2"]
    .map((kind) => catalog.blocks.get(lostCityRuneScriptBlockKey(kind, sourceId)))
    .filter((block): block is RuneScriptBlock => !!block);
  if (direct.length > 0) {
    const hasDirectOp = !!catalog.blocks.get(lostCityRuneScriptBlockKey("ai_opplayer2", sourceId));
    const fallbackOp = catalog.blocks.get(lostCityRuneScriptBlockKey("ai_opplayer2", "_"));
    return {
      blocks: !hasDirectOp && fallbackOp ? [...direct, fallbackOp] : direct,
      resolution: "direct"
    };
  }

  const category = lastConfigValue(npc, "category");
  const categoryBlocks = category
    ? ["ai_opplayer2", "ai_applayer2"]
        .map((kind) => catalog.blocks.get(lostCityRuneScriptBlockKey(kind, `_${category}`)))
        .filter((block): block is RuneScriptBlock => !!block)
    : [];
  if (categoryBlocks.length > 0) {
    const hasCategoryOp = !!catalog.blocks.get(
      lostCityRuneScriptBlockKey("ai_opplayer2", `_${category}`)
    );
    const fallbackOp = catalog.blocks.get(lostCityRuneScriptBlockKey("ai_opplayer2", "_"));
    return {
      blocks: !hasCategoryOp && fallbackOp ? [...categoryBlocks, fallbackOp] : categoryBlocks,
      resolution: "category"
    };
  }

  const fallback = catalog.blocks.get(lostCityRuneScriptBlockKey("ai_opplayer2", "_"));
  return fallback
    ? { blocks: [fallback], resolution: "default" }
    : { blocks: [], resolution: "unresolved" };
}

function calledBlockIds(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(/@([A-Za-z0-9_.]+)\b/g)) ids.add(match[1]);
  for (const match of text.matchAll(/gosub\(([A-Za-z0-9_.]+)\)/g)) ids.add(match[1]);
  for (const match of text.matchAll(/~([A-Za-z0-9_.]+)\b/g)) ids.add(match[1]);
  return [...ids];
}

function reachableBlocks(roots: RuneScriptBlock[], catalog: RuneScriptCatalog): RuneScriptBlock[] {
  const result: RuneScriptBlock[] = [];
  const queued = roots.map((block) => ({ block, depth: 0 }));
  const visited = new Set<string>();
  while (queued.length > 0) {
    const { block, depth } = queued.shift()!;
    const key = `${block.kind}:${block.id}:${block.sourceRef}`;
    if (visited.has(key)) continue;
    visited.add(key);
    result.push(block);
    if (result.length > NPC_ATTACK_AUDIT_MAX_REACHABLE_BLOCKS) {
      throw new LostCityContentSourceError(
        "config_invalid",
        `LostCity attack handler graph rooted at \`${roots[0]?.sourceRef ?? "unknown"}\` is too large.`
      );
    }
    const text = `${block.headerSuffix}\n${block.lines.join("\n")}`;
    for (const id of calledBlockIds(text)) {
      const utility =
        /^(?:npc_check_notcombat|npc_check_notcombat_self|npc_set_attack_vars|player_defence_roll_specific|check_protect_prayer|npc_poison_player|player_projectile)$/;
      const attackRelated = /(?:attack|melee|range|ranged|magic|spell|dragon|playerhit)/i;
      if (utility.test(id) || (depth > 0 && !attackRelated.test(id))) continue;
      const target =
        catalog.blocks.get(lostCityRuneScriptBlockKey("label", id)) ??
        catalog.blocks.get(lostCityRuneScriptBlockKey("proc", id));
      if (target) queued.push({ block: target, depth: depth + 1 });
    }
  }
  return result;
}

function numericCallArguments(text: string, procedure: string): number[] {
  const values = new Set<number>();
  const pattern = new RegExp(`~${procedure}\\(\\s*([0-9]+)`, "g");
  for (const match of text.matchAll(pattern)) values.add(Number(match[1]));
  return [...values].sort((a, b) => a - b);
}

function collectAttackEvidence(blocks: RuneScriptBlock[]): AttackEvidence {
  const evidence: AttackEvidence = {
    standardMelee: false,
    standardRanged: false,
    spellIds: new Set(),
    forcedMagicMaxHits: new Set(),
    scriptedMeleeMaxHits: new Set(),
    scriptedRangedMaxHits: new Set(),
    scriptedMagicMaxHits: new Set(),
    scriptedMagic: false,
    standardAccuracyFamilies: new Set(),
    scriptedUnknown: false,
    dragonfire: false,
    hasSelectionBranch: false,
    sourceRefs: new Set()
  };
  for (const block of blocks) {
    const text = `${block.headerSuffix}\n${block.lines.join("\n")}`;
    evidence.sourceRefs.add(block.sourceRef);
    if (/~npc_meleeattack\b/.test(text)) evidence.standardMelee = true;
    if (/~npc_rangeattack\b/.test(text)) evidence.standardRanged = true;
    if (/~npc_ranged_attack_roll\b/.test(text)) {
      evidence.standardAccuracyFamilies.add("ranged");
    }
    if (
      block.id !== "dragon_fire" &&
      /~npc_player_hit_roll\(\^magic_style\)|~npc_magic_attack_roll\b/.test(text)
    ) {
      evidence.standardAccuracyFamilies.add("magic");
    }
    for (const match of text.matchAll(/~npc_cast_spell\(\^([A-Za-z0-9_]+)/g)) {
      evidence.spellIds.add(match[1]);
    }
    for (const value of numericCallArguments(text, "npc_cast_spell_with_forced_max_hit")) {
      evidence.forcedMagicMaxHits.add(value);
    }
    for (const match of text.matchAll(
      /~npc_cast_spell_with_forced_max_hit\([^,]+,[^,]+,\s*([0-9]+)/g
    )) {
      evidence.forcedMagicMaxHits.add(Number(match[1]));
    }
    if (
      !/^(?:npc_cast_spell|npc_cast_spell_with_forced_max_hit|npc_spell_success)$/.test(block.id) &&
      /~npc_spell_(?:cast|success)\b/.test(text)
    ) {
      evidence.scriptedMagic = true;
      for (const match of text.matchAll(/~npc_spell_success\([^,]+,\s*(null|[0-9]+)\s*,/g)) {
        evidence.scriptedMagicMaxHits.add(match[1] === "null" ? 0 : Number(match[1]));
      }
    }
    for (const value of numericCallArguments(text, "playerhit_n_melee")) {
      evidence.scriptedMeleeMaxHits.add(value);
    }
    for (const value of numericCallArguments(text, "playerhit_n_ranged")) {
      evidence.scriptedRangedMaxHits.add(value);
    }
    for (const match of text.matchAll(/~([A-Za-z0-9_]*rangeattack)\(\s*([0-9]+)/g)) {
      if (match[1] !== "npc_rangeattack") evidence.scriptedRangedMaxHits.add(Number(match[2]));
    }
    if (/~dragon_fire\b|\[proc,dragon_fire\]/.test(text) || block.id === "dragon_fire") {
      evidence.dragonfire = true;
      evidence.scriptedMagic = true;
    }
    if (
      block.id === "dragon_ai_opplayer2" &&
      /if\s*\(random\(4\)\s*=\s*0\)/.test(text) &&
      /~dragon_fire\b/.test(text) &&
      /~dragon_melee\b/.test(text)
    ) {
      evidence.sourceWeightedSelection = "dragonfire=1/4, melee=3/4";
    }
    if (
      /queue\(combat_damage_player/.test(text) &&
      !/~playerhit_n_(?:melee|ranged)\b/.test(text) &&
      !/^(?:playerhit_n_melee|playerhit_n_ranged|npc_spell_success)$/.test(block.id) &&
      !/(?:range|ranged|melee|magic|spell|dragon)/i.test(block.id)
    ) {
      evidence.scriptedUnknown = true;
    }
    if (/\bif\s*\([^)]*\brandom(?:inc)?\(/.test(text)) {
      evidence.hasSelectionBranch = true;
    }
  }
  return evidence;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function profile(
  attackType: NpcAttackFamily,
  maxHitRule: NpcAttackMaxHitRule,
  maxHitCandidates: number[],
  accuracy: NpcAttackAuditProfile["accuracy"],
  sourceRefs: string[],
  maxHitInputs?: NpcAttackAuditProfile["maxHitInputs"]
): NpcAttackAuditProfile {
  return {
    attackType,
    maxHitRule,
    maxHitCandidates: [...new Set(maxHitCandidates)].sort((a, b) => a - b),
    ...(maxHitInputs ? { maxHitInputs } : {}),
    accuracy,
    sourceRefs: uniqueSorted(sourceRefs)
  };
}

function profilesFromEvidence(input: {
  evidence: AttackEvidence;
  npc: LostCityConfigEntry;
  params: LostCityConfigCatalog;
  dbrows: LostCityConfigCatalog;
}): { profiles: NpcAttackAuditProfile[]; issues: string[] } {
  const { evidence, npc, params, dbrows } = input;
  const issues: string[] = [];
  const profiles: NpcAttackAuditProfile[] = [];
  const sourceRefs = [...evidence.sourceRefs];
  const attack = requiredInteger(npc, lastConfigValue(npc, "attack") ?? "1", "Attack level");
  const strength = requiredInteger(npc, lastConfigValue(npc, "strength") ?? "1", "Strength level");
  const ranged = requiredInteger(npc, lastConfigValue(npc, "ranged") ?? "1", "Ranged level");
  const magic = requiredInteger(npc, lastConfigValue(npc, "magic") ?? "1", "Magic level");
  const attackBonus = requiredInteger(
    npc,
    resolvedConfigParamValue(npc, params, "attackbonus") ?? "0",
    "attack bonus",
    -64
  );
  const strengthBonus = requiredInteger(
    npc,
    resolvedConfigParamValue(npc, params, "strengthbonus") ?? "0",
    "strength bonus",
    -64
  );
  const rangeAttack = requiredInteger(
    npc,
    resolvedConfigParamValue(npc, params, "rangeattack") ?? "0",
    "range attack bonus",
    -64
  );
  const rangeBonus = requiredInteger(
    npc,
    resolvedConfigParamValue(npc, params, "rangebonus") ?? "0",
    "range strength bonus",
    -64
  );
  const magicAttack = requiredInteger(
    npc,
    resolvedConfigParamValue(npc, params, "magicattack") ?? "0",
    "magic attack bonus",
    -64
  );

  if (evidence.standardMelee) {
    profiles.push(
      profile(
        "melee",
        "standard-melee",
        [standardMaxHit(strength, strengthBonus)],
        { kind: "standard", level: attack, bonus: attackBonus },
        sourceRefs,
        { kind: "standard", level: strength, bonus: strengthBonus }
      )
    );
  }
  if (evidence.standardRanged) {
    profiles.push(
      profile(
        "ranged",
        "standard-ranged",
        [standardMaxHit(ranged, rangeBonus)],
        { kind: "standard", level: ranged, bonus: rangeAttack },
        sourceRefs,
        { kind: "standard", level: ranged, bonus: rangeBonus }
      )
    );
  }
  if (evidence.spellIds.size > 0) {
    const spellHits = spellMaxHitMap(dbrows);
    const resolved = [...evidence.spellIds].flatMap((id) => {
      const hit = spellHits.get(id);
      if (hit === undefined) {
        issues.push("spell-max-hit-unresolved");
        return [];
      }
      return [hit];
    });
    if (resolved.includes(0) && resolved.some((value) => value > 0)) {
      issues.push("non-damaging-spell-selection");
    }
    profiles.push(
      profile(
        "magic",
        "spell",
        resolved,
        { kind: "standard", level: magic, bonus: magicAttack },
        sourceRefs
      )
    );
  }
  if (evidence.forcedMagicMaxHits.size > 0) {
    profiles.push(
      profile(
        "magic",
        "forced",
        [...evidence.forcedMagicMaxHits],
        { kind: "standard", level: magic, bonus: magicAttack },
        sourceRefs
      )
    );
  }
  if (evidence.scriptedMeleeMaxHits.size > 0) {
    profiles.push(
      profile(
        "melee",
        "scripted",
        [...evidence.scriptedMeleeMaxHits],
        { kind: "unresolved" },
        sourceRefs
      )
    );
  }
  if (evidence.scriptedRangedMaxHits.size > 0) {
    profiles.push(
      profile(
        "ranged",
        "scripted",
        [...evidence.scriptedRangedMaxHits],
        evidence.standardAccuracyFamilies.has("ranged")
          ? { kind: "standard", level: ranged, bonus: rangeAttack }
          : { kind: "unresolved" },
        sourceRefs
      )
    );
  }
  if (evidence.scriptedMagic || evidence.scriptedMagicMaxHits.size > 0) {
    profiles.push(
      profile(
        "magic",
        "scripted",
        [...evidence.scriptedMagicMaxHits],
        evidence.standardAccuracyFamilies.has("magic")
          ? { kind: "standard", level: magic, bonus: magicAttack }
          : { kind: "unresolved" },
        sourceRefs
      )
    );
  }
  if (evidence.scriptedUnknown || profiles.length === 0) {
    profiles.push(profile("unknown", "unresolved", [], { kind: "unresolved" }, sourceRefs));
    issues.push(profiles.length === 1 ? "attack-handler-unresolved" : "additional-scripted-damage");
  }
  if (profiles.some((entry) => entry.accuracy.kind === "unresolved")) {
    issues.push("accuracy-policy-required");
  }
  if (profiles.some((entry) => entry.maxHitCandidates.length === 0)) {
    issues.push("max-hit-unresolved");
  }
  return { profiles, issues: uniqueSorted(issues) };
}

function selectionFromEvidence(
  profiles: NpcAttackAuditProfile[],
  evidence: AttackEvidence
): NpcAttackAuditRow["selection"] {
  if (profiles.length === 0) return "unresolved";
  if (evidence.sourceWeightedSelection && profiles.length > 1) return "source-weighted";
  if (
    profiles.length === 1 &&
    profiles[0].maxHitCandidates.length === 1 &&
    profiles[0].attackType !== "unknown"
  ) {
    return "always";
  }
  if (profiles.some((entry) => entry.maxHitCandidates.length > 1)) return "contextual";
  // Exact source weights are intentionally not inferred merely from random() syntax.
  return evidence.hasSelectionBranch || profiles.length > 1 ? "contextual" : "unresolved";
}

function coverageForRow(
  profiles: NpcAttackAuditProfile[],
  selection: NpcAttackAuditRow["selection"],
  handlerResolution: NpcAttackAuditRow["handlerResolution"],
  issues: string[]
): NpcAttackAuditCoverage {
  if (
    handlerResolution === "unresolved" ||
    profiles.every((entry) => entry.attackType === "unknown")
  ) {
    return "fallback";
  }
  const completeProfiles = profiles.every(
    (entry) =>
      entry.attackType !== "unknown" &&
      entry.maxHitRule !== "unresolved" &&
      entry.maxHitCandidates.length > 0 &&
      entry.accuracy.kind !== "unresolved"
  );
  return completeProfiles && selection === "always" && issues.length === 0 ? "exact" : "partial";
}

export function createNpcAttackSourceAudit(input: {
  sourceDir: string;
  sourceRevision: string;
  reference: GameDataSnapshot;
  repoRoot?: string;
}): NpcAttackSourceAudit {
  const repoRoot = resolve(input.repoRoot ?? process.cwd());
  const sourceTree = assertBoundedNpcAttackSource({ repoRoot, sourceDir: input.sourceDir });
  const npcs = readLostCityConfigCatalog({
    repoRoot,
    sourceDir: input.sourceDir,
    extension: ".npc"
  });
  const params = readLostCityConfigCatalog({
    repoRoot,
    sourceDir: input.sourceDir,
    extension: ".param"
  });
  const dbrows = readLostCityConfigCatalog({
    repoRoot,
    sourceDir: input.sourceDir,
    extension: ".dbrow"
  });
  const scripts = parseRuneScriptCatalog(repoRoot, input.sourceDir);

  const rows = Object.keys(input.reference.monsters)
    .sort()
    .map((runtimeId): NpcAttackAuditRow => {
      const sourceId = lostCityMonsterSourceId(runtimeId);
      const npc = npcs.entries.get(sourceId);
      if (!npc) {
        throw new LostCityContentSourceError(
          "config_invalid",
          `LostCity monster mapping for \`${runtimeId}\` does not resolve to a parsed NPC config.`
        );
      }
      const mapping = LOSTCITY_MONSTER_SOURCE_MAPPINGS[runtimeId];
      if (mapping && mapping.sourceRef !== npc.sourceRef) {
        throw new LostCityContentSourceError(
          "config_invalid",
          `LostCity monster mapping for \`${runtimeId}\` has stale source evidence.`
        );
      }
      // Reuse the existing strict combat-field extraction as a stale identity and numeric-bound gate.
      extractLostCityMonsterCombatSource(runtimeId, npcs);
      const resolved = handlerBlocks(sourceId, npc, scripts);
      const reachable = reachableBlocks(resolved.blocks, scripts);
      const evidence = collectAttackEvidence(reachable);
      const profileResult = profilesFromEvidence({ evidence, npc, params, dbrows });
      if (profileResult.profiles.some((entry) => entry.attackType === "unknown")) {
        throw new LostCityContentSourceError(
          "config_invalid",
          `LostCity attack handler for \`${runtimeId}\` has an unknown parser shape.`
        );
      }
      if (
        profileResult.profiles.length > 1 &&
        !evidence.hasSelectionBranch &&
        !evidence.sourceWeightedSelection
      ) {
        throw new LostCityContentSourceError(
          "config_invalid",
          `LostCity attack handler for \`${runtimeId}\` has conflicting profiles without a resolved selection rule.`
        );
      }
      for (const entry of profileResult.profiles) {
        if (
          entry.maxHitCandidates.some(
            (value) =>
              !Number.isSafeInteger(value) ||
              value < 0 ||
              value > NPC_ATTACK_AUDIT_MAX_NUMERIC_INPUT
          )
        ) {
          throw new LostCityContentSourceError(
            "config_invalid",
            `LostCity attack handler for \`${runtimeId}\` has an invalid max-hit bound.`
          );
        }
      }
      const selection = selectionFromEvidence(profileResult.profiles, evidence);
      const issues = [...profileResult.issues];
      if (selection === "contextual") issues.push("selection-policy-required");
      const attackSpeedTicks = requiredInteger(
        npc,
        resolvedConfigParamValue(npc, params, "attackrate") ?? "4",
        "attack rate"
      );
      if (attackSpeedTicks <= 0) {
        throw new LostCityContentSourceError(
          "config_invalid",
          `LostCity NPC \`${npc.sourceRef}\` has a non-positive attack rate.`
        );
      }
      const poisonSeverity = integerValue(resolvedConfigParamValue(npc, params, "poison_severity"));
      if (poisonSeverity !== undefined && poisonSeverity < 0) {
        throw new LostCityContentSourceError(
          "config_invalid",
          `LostCity NPC \`${npc.sourceRef}\` has invalid poison severity.`
        );
      }
      const coverage = coverageForRow(
        profileResult.profiles,
        selection,
        resolved.resolution,
        uniqueSorted(issues)
      );
      return {
        runtimeId,
        sourceId,
        configSourceRef: npc.sourceRef,
        handlerResolution: resolved.resolution,
        handlerSourceRefs: uniqueSorted(resolved.blocks.map((block) => block.sourceRef)),
        attackSpeedTicks,
        profiles: profileResult.profiles,
        selection,
        ...(evidence.sourceWeightedSelection
          ? { selectionEvidence: evidence.sourceWeightedSelection }
          : {}),
        overlays: {
          ...(poisonSeverity && poisonSeverity > 0 ? { poisonSeverity } : {}),
          dragonfire: evidence.dragonfire
        },
        coverage,
        issues: uniqueSorted(issues),
        provenance: uniqueSorted([npc.sourceRef, ...evidence.sourceRefs])
      };
    });

  const counts: Record<NpcAttackAuditCoverage, number> = { exact: 0, partial: 0, fallback: 0 };
  const attackFamilyCounts: Record<NpcAttackFamily, number> = {
    melee: 0,
    ranged: 0,
    magic: 0,
    unknown: 0
  };
  for (const row of rows) {
    counts[row.coverage] += 1;
    for (const family of new Set(row.profiles.map((entry) => entry.attackType))) {
      attackFamilyCounts[family] += 1;
    }
  }

  return {
    sourceDir: sourceTree.sourceDirLabel,
    sourceRevision: input.sourceRevision,
    sourceInputFileCount: sourceTree.files.length,
    sourceInputBytes: sourceTree.totalBytes,
    parserLimits: {
      maxFiles: LOSTCITY_SOURCE_MAX_FILES,
      maxFileBytes: LOSTCITY_SOURCE_MAX_FILE_BYTES,
      maxTotalBytes: LOSTCITY_SOURCE_MAX_TOTAL_BYTES,
      maxReachableBlocks: NPC_ATTACK_AUDIT_MAX_REACHABLE_BLOCKS
    },
    runtimeMonsterCount: rows.length,
    counts,
    attackFamilyCounts,
    overlayCounts: {
      poison: rows.filter((row) => row.overlays.poisonSeverity !== undefined).length,
      dragonfire: rows.filter((row) => row.overlays.dragonfire).length
    },
    rows
  };
}

function formulaIdFor(rule: NpcAttackMaxHitRule): IncomingAttackFormulaId | null {
  switch (rule) {
    case "standard-melee":
      return "standard-melee-v1";
    case "standard-ranged":
      return "standard-ranged-v1";
    case "spell":
      return "spell-row-v1";
    case "forced":
      return "forced-max-hit-v1";
    case "scripted":
      return "scripted-fixed-v1";
    case "unresolved":
      return null;
  }
}

function selectionFor(
  row: NpcAttackAuditRow,
  profile: NpcAttackAuditProfile
): IncomingAttackSelection {
  if (row.selection === "always") return { kind: "always" };
  if (row.selection === "source-weighted") {
    if (row.selectionEvidence !== "dragonfire=1/4, melee=3/4" || profile.attackType !== "melee") {
      throw new LostCityContentSourceError(
        "config_invalid",
        `LostCity attack handler for \`${row.runtimeId}\` has an unsupported structured weight. `
      );
    }
    return { kind: "weighted", weight: 3 };
  }
  if (row.issues.includes("non-damaging-spell-selection")) {
    return { kind: "contextual", reason: "non-damaging-spell-selection" };
  }
  return {
    kind: "contextual",
    reason:
      row.overlays.dragonfire && profile.attackType === "melee"
        ? "separate-overlay"
        : row.selection === "contextual"
          ? "selection-policy-required"
          : "unsupported-source-path"
  };
}

function formulaInputsFor(
  row: NpcAttackAuditRow,
  profile: NpcAttackAuditProfile,
  value: number
): IncomingAttackFormulaInputs {
  if (profile.maxHitRule === "standard-melee" || profile.maxHitRule === "standard-ranged") {
    if (!profile.maxHitInputs) {
      throw new LostCityContentSourceError(
        "config_invalid",
        `LostCity attack handler for \`${row.runtimeId}\` is missing standard max-hit inputs.`
      );
    }
    return profile.maxHitInputs;
  }
  return { kind: "source-value", value };
}

export function generatedIncomingAttacksFromAuditRow(
  row: NpcAttackAuditRow,
  sourceRevision: string,
  generatedAt?: string
): GeneratedNpcIncomingAttacks {
  const incomingAttacks: IncomingAttackProfile[] = [];
  for (const [profileIndex, profile] of row.profiles.entries()) {
    if (profile.attackType === "unknown") continue;
    const formulaId = formulaIdFor(profile.maxHitRule);
    if (!formulaId) continue;
    for (const [candidateIndex, maxHit] of profile.maxHitCandidates.entries()) {
      const provenance: DataProvenance = {
        source: "generated",
        sourceRef: profile.sourceRefs.join(", "),
        ...(generatedAt ? { verifiedAt: generatedAt } : {}),
        notes: `Parsed from the reviewed NPC attack handler. Source revision: ${sourceRevision}.`
      };
      incomingAttacks.push({
        id: `${profile.attackType}-${profile.maxHitRule}-${profileIndex + 1}-${candidateIndex + 1}`,
        attackType: profile.attackType,
        attackSpeedTicks: row.attackSpeedTicks,
        maxHit,
        formulaId,
        formulaInputs: formulaInputsFor(row, profile, maxHit),
        accuracy: profile.accuracy.kind === "unresolved" ? { kind: "mean-only" } : profile.accuracy,
        selection: selectionFor(row, profile),
        coverage: row.coverage,
        provenance
      });
    }
  }
  if (incomingAttacks.length === 0) {
    throw new LostCityContentSourceError(
      "config_invalid",
      `LostCity attack handler for \`${row.runtimeId}\` has no serializable incoming attack profile.`
    );
  }
  return { incomingAttacks, incomingAttackCoverage: row.coverage };
}

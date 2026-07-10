import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildPlan, type PlannerPlan } from "../../domain/planner";
import { createGeneratedRuntimePriceSet } from "../../adapters/generated/price-fallback";
import { parseGameDataSnapshot } from "../../data/schemas/game-data";
import { createPriceSetFromLegacyRecords } from "../../data/schemas/price-set";
import type { SimulationContext } from "../../domain/shared";
import {
  PLANNER_PARITY_CASES,
  type PlannerParityCaseDefinition,
  type PlannerParityMode
} from "../fixtures/planner-parity-cases";
import { domainContextFromLegacy, plannerInputFromDefinition } from "./domain-planner";
import {
  createLegacyPlannerRuntime,
  legacyPlannerItemName,
  runLegacyPlannerCase,
  type LegacyPlannerConfig,
  type LegacyPlannerPlan,
  type LegacyPlannerRuntime,
  type LegacyPlannerTransition
} from "./legacy-planner";

const MAX_AUDIT_CASES = 20;
const MAX_DIFFERENCES_PER_COMPARISON = 200;
const NUMERIC_TOLERANCE = 0.000001;
const CURRENT_RUNTIME_LOADED_AT = "2026-07-10T00:00:00.000Z";

export type PlannerParityClassification =
  | "accepted-rewrite-delta"
  | "legacy-defect"
  | "source-data-delta"
  | "rewrite-gap"
  | "not-representable"
  | "needs-review";

interface NormalizedArmour {
  helm: string;
  body: string;
  legs: string;
  shield: string;
}

interface NormalizedConfig {
  weaponId: string;
  spellId: string | null;
  armour: NormalizedArmour;
}

export interface NormalizedPlannerPlan {
  combatStyle: "melee" | "ranged" | "magic";
  metric: "xph" | "gph" | "dps" | "balanced";
  skills: string[];
  targets: Record<string, number>;
  totalXp: number;
  truncated: boolean;
  start: {
    state: Record<string, number>;
    dps: number;
    metricValue: number;
    config: NormalizedConfig;
  };
  end: {
    skill: string;
    to: number;
    dps: number;
    metricValue: number;
    config: NormalizedConfig;
  } | null;
  steps: Array<{
    skill: string;
    from: number;
    to: number;
    dxp: number;
    cumXp: number;
    dps: number;
    metricValue: number;
    config: NormalizedConfig;
  }>;
  phases: Array<{
    skill: string;
    from: number;
    to: number;
    xp: number;
    cumXp: number;
    startDps: number;
    endDps: number;
    startMetric: number;
    endMetric: number;
  }>;
  transitions: Array<{
    slot: string;
    type: string;
    itemId: string;
    previousItemId: string | null;
    skill: string;
    level: number;
    reqSkill: string;
    reqLevel: number;
    stepIndex: number;
    cumXp: number;
    dpsBefore: number;
    dpsAfter: number;
  }>;
  warningCodes: string[];
}

export interface PlannerParityDifference {
  path: string;
  kind: "missing" | "type" | "value" | "number" | "length" | "difference-limit";
  legacy: string | number | boolean | null;
  rewrite: string | number | boolean | null;
  absoluteDelta?: number;
  relativeDelta?: number;
}

export interface PlannerParityComparison {
  id: string;
  caseId: string;
  intent: string;
  mode: PlannerParityMode;
  result: "match" | "different";
  legacy: NormalizedPlannerPlan;
  rewrite: NormalizedPlannerPlan;
  differences: PlannerParityDifference[];
  legacyDigest: string;
  rewriteDigest: string;
  differenceDigest: string;
  differenceCount: number;
}

export interface PlannerParityAudit {
  version: 1;
  caseCount: number;
  comparisonCount: number;
  comparisons: PlannerParityComparison[];
}

export interface PlannerParityBaselineEntry {
  id: string;
  caseId: string;
  mode: PlannerParityMode;
  result: "match" | "different";
  classification: PlannerParityClassification | null;
  reason: string | null;
  source: string | null;
  legacyDigest: string;
  rewriteDigest: string;
  differenceDigest: string;
  differenceCount: number;
}

export interface PlannerParityBaseline {
  version: 1;
  comparisons: PlannerParityBaselineEntry[];
}

export interface PlannerParityBaselineStatus {
  valid: boolean;
  missing: string[];
  unexpected: string[];
  stale: string[];
  needsReview: string[];
  rewriteGaps: string[];
}

export function runPlannerParityAudit(
  cases: readonly PlannerParityCaseDefinition[] = PLANNER_PARITY_CASES
): PlannerParityAudit {
  validateCaseMatrix(cases);
  const legacyRuntime = createLegacyPlannerRuntime();
  const referenceContext = domainContextFromLegacy(legacyRuntime);
  const currentContext = createCurrentProductContext();
  const comparisons: PlannerParityComparison[] = [];

  for (const testCase of cases) {
    const legacyPlan = runLegacyPlannerCase(legacyRuntime, testCase.definition, testCase.options);
    const normalizedLegacy = normalizeLegacyPlan(legacyPlan, legacyRuntime);
    for (const mode of testCase.modes) {
      const context = mode === "reference-context" ? referenceContext : currentContext;
      const rewritePlan = buildPlan(
        plannerInputFromDefinition(legacyRuntime, testCase.definition),
        context,
        testCase.options
      );
      const normalizedRewrite = normalizeRewritePlan(rewritePlan);
      const differences = compareNormalizedPlans(normalizedLegacy, normalizedRewrite);
      comparisons.push({
        id: `${testCase.id}::${mode}`,
        caseId: testCase.id,
        intent: testCase.intent,
        mode,
        result: differences.length === 0 ? "match" : "different",
        legacy: normalizedLegacy,
        rewrite: normalizedRewrite,
        differences,
        legacyDigest: digest(normalizedLegacy),
        rewriteDigest: digest(normalizedRewrite),
        differenceDigest: digest(differences),
        differenceCount: differences.length
      });
    }
  }

  comparisons.sort((left, right) => left.id.localeCompare(right.id));
  return {
    version: 1,
    caseCount: cases.length,
    comparisonCount: comparisons.length,
    comparisons
  };
}

export function createPlannerParityBaseline(
  audit: PlannerParityAudit,
  previous?: PlannerParityBaseline
): PlannerParityBaseline {
  const previousById = new Map((previous?.comparisons ?? []).map((entry) => [entry.id, entry]));
  return {
    version: 1,
    comparisons: audit.comparisons.map((comparison) => {
      const old = previousById.get(comparison.id);
      const isMatch = comparison.result === "match";
      const unchanged =
        old?.result === comparison.result &&
        old.legacyDigest === comparison.legacyDigest &&
        old.rewriteDigest === comparison.rewriteDigest &&
        old.differenceDigest === comparison.differenceDigest &&
        old.differenceCount === comparison.differenceCount;
      const reviewed = !isMatch && unchanged ? old : undefined;
      return {
        id: comparison.id,
        caseId: comparison.caseId,
        mode: comparison.mode,
        result: comparison.result,
        classification: isMatch ? null : (reviewed?.classification ?? "needs-review"),
        reason: isMatch ? null : (reviewed?.reason ?? "Unreviewed discovery finding."),
        source: isMatch
          ? null
          : (reviewed?.source ??
            "docs/technical/legacy-planner-parity-spec.md#difference-classifications"),
        legacyDigest: comparison.legacyDigest,
        rewriteDigest: comparison.rewriteDigest,
        differenceDigest: comparison.differenceDigest,
        differenceCount: comparison.differenceCount
      };
    })
  };
}

export function checkPlannerParityBaseline(
  audit: PlannerParityAudit,
  baseline: PlannerParityBaseline
): PlannerParityBaselineStatus {
  const auditById = new Map(audit.comparisons.map((comparison) => [comparison.id, comparison]));
  const baselineById = new Map(baseline.comparisons.map((entry) => [entry.id, entry]));
  const missing = audit.comparisons
    .filter((comparison) => !baselineById.has(comparison.id))
    .map((comparison) => comparison.id);
  const unexpected = baseline.comparisons
    .filter((entry) => !auditById.has(entry.id))
    .map((entry) => entry.id);
  const stale: string[] = [];
  const needsReview: string[] = [];
  const rewriteGaps: string[] = [];

  for (const comparison of audit.comparisons) {
    const entry = baselineById.get(comparison.id);
    if (!entry) continue;
    if (
      entry.result !== comparison.result ||
      entry.legacyDigest !== comparison.legacyDigest ||
      entry.rewriteDigest !== comparison.rewriteDigest ||
      entry.differenceDigest !== comparison.differenceDigest ||
      entry.differenceCount !== comparison.differenceCount
    ) {
      stale.push(comparison.id);
    }
    if (comparison.result === "different" && entry.classification === "needs-review") {
      needsReview.push(comparison.id);
    }
    if (comparison.result === "different" && entry.classification === "rewrite-gap") {
      rewriteGaps.push(comparison.id);
    }
    if (comparison.result === "match" && entry.classification !== null) stale.push(comparison.id);
    if (comparison.result === "different" && !entry.classification) stale.push(comparison.id);
  }

  const uniqueStale = [...new Set(stale)].sort();
  return {
    valid: missing.length === 0 && unexpected.length === 0 && uniqueStale.length === 0,
    missing: missing.sort(),
    unexpected: unexpected.sort(),
    stale: uniqueStale,
    needsReview: needsReview.sort(),
    rewriteGaps: rewriteGaps.sort()
  };
}

export function formatPlannerParityReport(
  audit: PlannerParityAudit,
  baseline: PlannerParityBaseline,
  status: PlannerParityBaselineStatus
): string {
  const baselineById = new Map(baseline.comparisons.map((entry) => [entry.id, entry]));
  const classifications = new Map<string, number>();
  let matches = 0;
  for (const comparison of audit.comparisons) {
    if (comparison.result === "match") {
      matches += 1;
      continue;
    }
    const classification = baselineById.get(comparison.id)?.classification ?? "needs-review";
    classifications.set(classification, (classifications.get(classification) ?? 0) + 1);
  }

  const lines = [
    "# Legacy Planner parity audit",
    "",
    "- Status: " + reportStatus(status),
    "- Evidence date: 2026-07-10",
    `- Cases: ${audit.caseCount}`,
    `- Comparisons: ${audit.comparisonCount}`,
    `- Matches: ${matches}`,
    `- Differences: ${audit.comparisonCount - matches}`,
    "- Runtime policy: archived Planner is comparison evidence; the Revision 274 rewrite remains product truth",
    "",
    "## Classification summary",
    "",
    `- match: ${matches}`
  ];
  for (const classification of [
    "accepted-rewrite-delta",
    "legacy-defect",
    "source-data-delta",
    "rewrite-gap",
    "not-representable",
    "needs-review"
  ] as const) {
    lines.push(`- ${classification}: ${classifications.get(classification) ?? 0}`);
  }

  lines.push(
    "",
    "## Gate status",
    "",
    `- Baseline valid: ${status.valid ? "yes" : "no"}`,
    `- Missing baseline rows: ${formatIds(status.missing)}`,
    `- Unexpected baseline rows: ${formatIds(status.unexpected)}`,
    `- Stale baseline rows: ${formatIds(status.stale)}`,
    `- Needs review: ${formatIds(status.needsReview)}`,
    `- Approved rewrite gaps: ${formatIds(status.rewriteGaps)}`,
    "",
    "## Comparisons"
  );

  for (const comparison of audit.comparisons) {
    const entry = baselineById.get(comparison.id);
    lines.push(
      "",
      `### ${comparison.caseId} / ${comparison.mode}`,
      "",
      comparison.intent,
      "",
      `- Result: ${comparison.result}`,
      `- Classification: ${entry?.classification ?? "none"}`,
      `- Reason: ${entry?.reason ?? "None; normalized outputs match."}`,
      `- Source: ${entry?.source ?? "None"}`,
      `- Difference count: ${comparison.differenceCount}`,
      `- Legacy step order: ${formatStepOrder(comparison.legacy)}`,
      `- Rewrite step order: ${formatStepOrder(comparison.rewrite)}`,
      `- Rewrite warning codes: ${formatIds(comparison.rewrite.warningCodes)}`,
      `- Legacy digest: \`${comparison.legacyDigest}\``,
      `- Rewrite digest: \`${comparison.rewriteDigest}\``
    );
    if (comparison.differences.length > 0) {
      const rows = comparison.differences
        .slice(0, 12)
        .map((difference) => [
          `\`${escapeCell(difference.path)}\``,
          difference.kind,
          escapeCell(String(difference.legacy)),
          escapeCell(String(difference.rewrite))
        ]);
      lines.push("", ...formatMarkdownTable(["Path", "Kind", "Legacy", "Rewrite"], rows));
      if (comparison.differences.length > 12) {
        lines.push(
          "",
          `Only the first 12 of ${comparison.differences.length} bounded differences are shown.`
        );
      }
    }
  }

  lines.push(
    "",
    "## Boundaries",
    "",
    "- No legacy Planner state was read or migrated.",
    "- No future or hypothetical gear was executed.",
    "- No live provider, network, auth, account, tenant or database path was used.",
    "- No production module imports or executes `planner-core.js`.",
    "- A `rewrite-gap` requires a separate accepted implementation decision.",
    ""
  );
  return lines.join("\n");
}

export function normalizeLegacyPlan(
  plan: LegacyPlannerPlan,
  runtime: LegacyPlannerRuntime
): NormalizedPlannerPlan {
  return {
    combatStyle: plan.combatType,
    metric: plan.metric === "bal" ? "balanced" : plan.metric,
    skills: [...plan.skills],
    targets: normalizeLegacyTargets(plan),
    totalXp: stableNumber(plan.totalXp),
    truncated: plan.truncated,
    start: {
      state: sortedNumberRecord(plan.start.state),
      dps: stableNumber(plan.start.dps),
      metricValue: stableNumber(plan.start.metricVal),
      config: normalizeLegacyConfig(plan.start.cfg)
    },
    end: plan.end
      ? {
          skill: plan.end.skill,
          to: plan.end.to,
          dps: stableNumber(plan.end.dps),
          metricValue: stableNumber(plan.end.metricVal),
          config: normalizeLegacyConfig(plan.end.cfg)
        }
      : null,
    steps: plan.steps.map((step) => ({
      skill: step.skill,
      from: step.from,
      to: step.to,
      dxp: stableNumber(step.dxp),
      cumXp: stableNumber(step.cumXp),
      dps: stableNumber(step.dps),
      metricValue: stableNumber(step.metricVal),
      config: normalizeLegacyConfig(step.cfg)
    })),
    phases: plan.phases.map((phase) => ({
      skill: phase.skill,
      from: phase.from,
      to: phase.to,
      xp: stableNumber(phase.xp),
      cumXp: stableNumber(phase.cumXp),
      startDps: stableNumber(phase.startDps),
      endDps: stableNumber(phase.endDps),
      startMetric: stableNumber(phase.startMetric),
      endMetric: stableNumber(phase.endMetric)
    })),
    transitions: plan.unlocks.map((transition) =>
      normalizeLegacyTransition(transition, plan, runtime)
    ),
    warningCodes: []
  };
}

export function normalizeRewritePlan(plan: PlannerPlan): NormalizedPlannerPlan {
  return {
    combatStyle: plan.combatStyle,
    metric: plan.metric,
    skills: [...plan.skills],
    targets: sortedNumberRecord(plan.targets),
    totalXp: stableNumber(plan.totalXp),
    truncated: plan.truncated,
    start: {
      state: sortedNumberRecord(plan.start.state),
      dps: stableNumber(plan.start.dps),
      metricValue: stableNumber(plan.start.metricValue),
      config: normalizeRewriteConfig(plan.start.cfg)
    },
    end: plan.end
      ? {
          skill: plan.end.skill,
          to: plan.end.to,
          dps: stableNumber(plan.end.dps),
          metricValue: stableNumber(plan.end.metricValue),
          config: normalizeRewriteConfig(plan.end.cfg)
        }
      : null,
    steps: plan.steps.map((step) => ({
      skill: step.skill,
      from: step.from,
      to: step.to,
      dxp: stableNumber(step.dxp),
      cumXp: stableNumber(step.cumXp),
      dps: stableNumber(step.dps),
      metricValue: stableNumber(step.metricValue),
      config: normalizeRewriteConfig(step.cfg)
    })),
    phases: plan.phases.map((phase) => ({
      skill: phase.skill,
      from: phase.from,
      to: phase.to,
      xp: stableNumber(phase.xp),
      cumXp: stableNumber(phase.cumXp),
      startDps: stableNumber(phase.startDps),
      endDps: stableNumber(phase.endDps),
      startMetric: stableNumber(phase.startMetric),
      endMetric: stableNumber(phase.endMetric)
    })),
    transitions: plan.unlocks.map((transition) => ({
      slot: transition.slot,
      type: transition.type,
      itemId: transition.itemId,
      previousItemId: transition.previousItemId,
      skill: transition.skill,
      level: transition.level,
      reqSkill: transition.reqSkill,
      reqLevel: transition.reqLevel,
      stepIndex: transition.stepIndex,
      cumXp: stableNumber(transition.cumXp),
      dpsBefore: stableNumber(transition.dpsBefore),
      dpsAfter: stableNumber(transition.dpsAfter)
    })),
    warningCodes: [...new Set(plan.warnings.map((warning) => warning.code))].sort()
  };
}

export function compareNormalizedPlans(
  legacy: NormalizedPlannerPlan,
  rewrite: NormalizedPlannerPlan
): PlannerParityDifference[] {
  const differences: PlannerParityDifference[] = [];
  compareValues(legacy, rewrite, "$", differences);
  return differences;
}

function normalizeLegacyConfig(config: LegacyPlannerConfig): NormalizedConfig {
  return {
    weaponId: config.weapon,
    spellId: config.spell ?? null,
    armour: {
      helm: config.armour.helm,
      body: config.armour.body,
      legs: config.armour.legs,
      shield: config.armour.shield
    }
  };
}

function normalizeRewriteConfig(config: PlannerPlan["start"]["cfg"]): NormalizedConfig {
  return {
    weaponId: config.weaponId,
    spellId: config.spellId,
    armour: {
      helm: config.armour.helm,
      body: config.armour.body,
      legs: config.armour.legs,
      shield: config.armour.shield
    }
  };
}

function normalizeLegacyTransition(
  transition: LegacyPlannerTransition,
  plan: LegacyPlannerPlan,
  runtime: LegacyPlannerRuntime
): NormalizedPlannerPlan["transitions"][number] {
  const currentConfig = plan.steps[transition.stepIdx]?.cfg ?? plan.start.cfg;
  const currentId = configItemId(currentConfig, transition.slot) ?? transition.name;
  const previousId = findPreviousLegacyItemId(transition, plan, runtime);
  return {
    slot: transition.slot,
    type: transition.type,
    itemId: currentId,
    previousItemId: previousId,
    skill: transition.skill,
    level: transition.level,
    reqSkill: transition.reqSkill,
    reqLevel: transition.reqLevel,
    stepIndex: transition.stepIdx,
    cumXp: stableNumber(transition.cumXp),
    dpsBefore: stableNumber(transition.dpsBefore),
    dpsAfter: stableNumber(transition.dpsAfter)
  };
}

function findPreviousLegacyItemId(
  transition: LegacyPlannerTransition,
  plan: LegacyPlannerPlan,
  runtime: LegacyPlannerRuntime
): string | null {
  const configs = [
    plan.start.cfg,
    ...plan.steps.slice(0, transition.stepIdx).map((step) => step.cfg)
  ];
  for (let index = configs.length - 1; index >= 0; index -= 1) {
    const itemId = configItemId(configs[index]!, transition.slot);
    if (legacyPlannerItemName(runtime, transition.slot, itemId) === transition.prevName) {
      return itemId;
    }
  }
  return null;
}

function configItemId(
  config: LegacyPlannerConfig,
  slot: LegacyPlannerTransition["slot"]
): string | null {
  if (slot === "weapon") return config.weapon;
  if (slot === "spell") return config.spell;
  return config.armour[slot];
}

function compareValues(
  legacy: unknown,
  rewrite: unknown,
  path: string,
  differences: PlannerParityDifference[]
): void {
  if (differences.length >= MAX_DIFFERENCES_PER_COMPARISON) {
    if (differences.at(-1)?.kind !== "difference-limit") {
      differences.push({
        path: "$",
        kind: "difference-limit",
        legacy: MAX_DIFFERENCES_PER_COMPARISON,
        rewrite: "more"
      });
    }
    return;
  }
  if (typeof legacy === "number" && typeof rewrite === "number") {
    const absoluteDelta = Math.abs(legacy - rewrite);
    const relativeDelta = absoluteDelta / Math.max(Math.abs(legacy), Math.abs(rewrite), 1e-12);
    if (absoluteDelta > NUMERIC_TOLERANCE && relativeDelta > NUMERIC_TOLERANCE) {
      differences.push({
        path,
        kind: "number",
        legacy,
        rewrite,
        absoluteDelta: stableNumber(absoluteDelta),
        relativeDelta: stableNumber(relativeDelta)
      });
    }
    return;
  }
  if (Array.isArray(legacy) || Array.isArray(rewrite)) {
    if (!Array.isArray(legacy) || !Array.isArray(rewrite)) {
      differences.push({ path, kind: "type", legacy: preview(legacy), rewrite: preview(rewrite) });
      return;
    }
    if (legacy.length !== rewrite.length) {
      differences.push({ path, kind: "length", legacy: legacy.length, rewrite: rewrite.length });
    }
    for (let index = 0; index < Math.min(legacy.length, rewrite.length); index += 1) {
      compareValues(legacy[index], rewrite[index], `${path}[${index}]`, differences);
    }
    return;
  }
  if (isRecord(legacy) || isRecord(rewrite)) {
    if (!isRecord(legacy) || !isRecord(rewrite)) {
      differences.push({ path, kind: "type", legacy: preview(legacy), rewrite: preview(rewrite) });
      return;
    }
    const keys = [...new Set([...Object.keys(legacy), ...Object.keys(rewrite)])].sort();
    for (const key of keys) {
      if (!(key in legacy) || !(key in rewrite)) {
        differences.push({
          path: `${path}.${key}`,
          kind: "missing",
          legacy: key in legacy ? preview(legacy[key]) : null,
          rewrite: key in rewrite ? preview(rewrite[key]) : null
        });
      } else {
        compareValues(legacy[key], rewrite[key], `${path}.${key}`, differences);
      }
    }
    return;
  }
  if (legacy !== rewrite) {
    differences.push({ path, kind: "value", legacy: preview(legacy), rewrite: preview(rewrite) });
  }
}

function validateCaseMatrix(cases: readonly PlannerParityCaseDefinition[]): void {
  if (cases.length < 1 || cases.length > MAX_AUDIT_CASES) {
    throw new Error("Planner parity case matrix is outside the audit bound.");
  }
  const ids = new Set<string>();
  for (const testCase of cases) {
    if (ids.has(testCase.id)) throw new Error("Planner parity case ids must be unique.");
    ids.add(testCase.id);
    if (testCase.modes.length < 1 || new Set(testCase.modes).size !== testCase.modes.length) {
      throw new Error("Planner parity case modes are invalid.");
    }
  }
}

function sortedNumberRecord(value: Partial<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, number]) => [key, stableNumber(number)])
  );
}

function normalizeLegacyTargets(plan: LegacyPlannerPlan): Record<string, number> {
  const skills =
    plan.combatType === "ranged"
      ? ["ranged", "defence"]
      : plan.combatType === "magic"
        ? ["magic", "defence"]
        : ["attack", "strength", "defence"];
  return Object.fromEntries(
    skills
      .map((skill) => [
        skill,
        plan.targets[skill as keyof typeof plan.targets] ??
          plan.start.state[skill as keyof typeof plan.start.state]
      ])
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
  ) as Record<string, number>;
}

function stableNumber(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Planner parity output contains an invalid number.");
  return Number(value.toFixed(6));
}

function digest(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 16);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function preview(value: unknown): string | number | boolean | null {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (value === undefined) return "[undefined]";
  if (typeof value === "number") return Number.isFinite(value) ? value : "invalid-number";
  if (Array.isArray(value)) return `[array:${value.length}]`;
  return "[object]";
}

function createCurrentProductContext(rootDir = process.cwd()): SimulationContext {
  const gameData = parseGameDataSnapshot(
    JSON.parse(readFileSync(resolve(rootDir, "src/data/generated/game-data.json"), "utf8"))
  );
  const scheduled = createPriceSetFromLegacyRecords({
    id: "planner-parity-scheduled-static",
    label: "Planner parity scheduled static prices",
    source: "scraped",
    createdAt: CURRENT_RUNTIME_LOADED_AT,
    itemPrices: JSON.parse(readFileSync(resolve(rootDir, "prices.json"), "utf8")),
    alchValues: JSON.parse(readFileSync(resolve(rootDir, "alch.json"), "utf8")),
    provenance: {
      source: "scraped",
      sourceRef: "committed static price files"
    }
  });
  return {
    gameData,
    priceSet: createGeneratedRuntimePriceSet(scheduled, gameData)
  };
}

function reportStatus(status: PlannerParityBaselineStatus): string {
  if (!status.valid) return "baseline-stale";
  if (status.rewriteGaps.length > 0) return "approved-rewrite-gaps-open";
  if (status.needsReview.length > 0) return "needs-review";
  return "classified";
}

function formatIds(ids: readonly string[]): string {
  return ids.length === 0 ? "none" : ids.map((id) => `\`${id}\``).join(", ");
}

function formatStepOrder(plan: NormalizedPlannerPlan): string {
  return plan.steps.length === 0 ? "none" : plan.steps.map((step) => step.skill).join(" -> ");
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function formatMarkdownTable(headers: readonly string[], rows: readonly string[][]): string[] {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0), 3)
  );
  const formatRow = (cells: readonly string[]) =>
    `| ${cells.map((cell, index) => cell.padEnd(widths[index]!)).join(" | ")} |`;
  return [
    formatRow(headers),
    formatRow(widths.map((width) => "-".repeat(width))),
    ...rows.map(formatRow)
  ];
}

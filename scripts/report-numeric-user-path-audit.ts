import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { format as formatWithPrettier } from "prettier";

import { createGeneratedRuntimeContext } from "../src/adapters/generated";
import { executeCalculationTask } from "../src/app/calculation-task";
import { DEFAULT_DUEL_SNAPSHOTS_STATE } from "../src/app/state/duel-snapshots";
import {
  DEFAULT_FORM_STATE,
  SavedSetupSchema,
  savedSetupFromForm,
  switchCombatStyleLoadout,
  type CannonByMonsterState,
  type CombatSetupFormState
} from "../src/app/state/ui-state";
import type { LootPrefsState } from "../src/app/state/loot-prefs";
import type { LootSettingsByMonsterState } from "../src/app/state/loot-settings";
import {
  createDenseCompareRows,
  createDuelComparisonViewModel,
  createDuelMatrixViewModel,
  createSimulationViewModel,
  type DenseCompareRowViewModel,
  type SimulationViewModel
} from "../src/app/view-models/simulation";
import type { CombatStyle, SimulationContext } from "../src/domain/shared";
import { casketStats } from "../src/domain/trip";
import { LEGACY_GOLDEN_CASES } from "../src/tests/fixtures/legacy-case-definitions";
import legacyGolden from "../src/tests/fixtures/legacy-golden.json";
import { createRewriteFixtureCase } from "../src/tests/helpers/rewrite-fixture";

const REPORT_PATH = resolve("docs/project/numeric-user-path-audit.md");
const AUDIT_DATE = "2026-07-12";
const CROSS_PATH_ABS_TOLERANCE = 1e-9;
const CROSS_PATH_REL_TOLERANCE = 1e-9;
const COMBAT_STYLES = ["melee", "ranged", "magic"] as const satisfies readonly CombatStyle[];

type ComparableMetric =
  | "hitChance"
  | "maxHit"
  | "dps"
  | "ttkSec"
  | "killsPerHour"
  | "xpPerHour"
  | "gpPerKill"
  | "gpPerHour"
  | "netGpPerHour";

type ComparableMetrics = Record<ComparableMetric, number>;

interface CrossPathMismatch {
  caseId: string;
  metric: string;
  leftPath: string;
  rightPath: string;
  left: number;
  right: number;
  absoluteDifference: number;
  relativeDifference: number;
}

interface LegacyThreshold {
  relative: number;
  absolute: number;
}

interface LegacyFinding {
  fixtureId: string;
  metric: string;
  legacy: number;
  rewrite: number;
  absoluteDifference: number;
  relativeDifference: number;
  classification: "accepted-delta" | "price-source" | "review";
  note: string;
}

interface CasketImpactFinding {
  monsterId: string;
  monsterName: string;
  chance: number;
  previousParentValue: number;
  openedContentsValue: number;
  gpPerKillDelta: number;
  classification: "source-backed-casket";
}

interface AuditSummary {
  generatedCases: number;
  fixtureCases: number;
  crossPathComparisons: number;
  crossPathMismatches: CrossPathMismatch[];
  legacyComparisons: number;
  legacyFindings: LegacyFinding[];
  casketImpacts: CasketImpactFinding[];
}

const LEGACY_THRESHOLDS: Record<string, LegacyThreshold> = {
  maxHit: { relative: 0.05, absolute: 0.5 },
  hitChance: { relative: 0.05, absolute: 0.03 },
  dps: { relative: 0.1, absolute: 0.25 },
  ttkSec: { relative: 0.1, absolute: 2 },
  killsPerHour: { relative: 0.1, absolute: 5 },
  effectiveKph: { relative: 0.15, absolute: 5 },
  effectiveXpPerHour: { relative: 0.15, absolute: 500 },
  gpPerKill: { relative: 0.25, absolute: 100 },
  gpPerHour: { relative: 0.25, absolute: 10_000 },
  effectiveNetGpPerHour: { relative: 0.25, absolute: 10_000 },
  supplyCostPerKill: { relative: 0.25, absolute: 100 }
};

function comparableMetricsFromViewModel(vm: SimulationViewModel): ComparableMetrics {
  return {
    hitChance: vm.result.combat.hitChance,
    maxHit: vm.result.combat.maxHit,
    dps: vm.result.rates.effectiveDps,
    ttkSec: vm.result.rates.ttkSec,
    killsPerHour: vm.result.rates.killsPerHour,
    xpPerHour: vm.result.xp.effectiveXpPerHour,
    gpPerKill: vm.result.rates.gpPerKill,
    gpPerHour: vm.result.rates.gpPerHour,
    netGpPerHour: vm.result.rates.effectiveNetGpPerHour
  };
}

function comparableMetricsFromDenseRow(row: DenseCompareRowViewModel): ComparableMetrics {
  return {
    hitChance: row.hitChance,
    maxHit: row.maxHit,
    dps: row.dps,
    ttkSec: row.ttkSec,
    killsPerHour: row.killsPerHour,
    xpPerHour: row.xpPerHour,
    gpPerKill: row.gpPerKill,
    gpPerHour: row.gpPerHour,
    netGpPerHour: row.netGpPerHour
  };
}

function difference(
  left: number,
  right: number
): {
  absoluteDifference: number;
  relativeDifference: number;
} {
  const absoluteDifference = Math.abs(left - right);
  return {
    absoluteDifference,
    relativeDifference: absoluteDifference / Math.max(Math.abs(left), Math.abs(right), 1)
  };
}

function valuesMatch(left: number, right: number): boolean {
  if (Object.is(left, right)) return true;
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  const delta = difference(left, right);
  return (
    delta.absoluteDifference <= CROSS_PATH_ABS_TOLERANCE ||
    delta.relativeDifference <= CROSS_PATH_REL_TOLERANCE
  );
}

function compareMetricMaps(
  summary: AuditSummary,
  caseId: string,
  leftPath: string,
  rightPath: string,
  left: Partial<ComparableMetrics>,
  right: Partial<ComparableMetrics>
): void {
  for (const metric of Object.keys(left) as ComparableMetric[]) {
    const leftValue = left[metric];
    const rightValue = right[metric];
    if (leftValue == null || rightValue == null) continue;
    summary.crossPathComparisons += 1;
    if (valuesMatch(leftValue, rightValue)) continue;
    summary.crossPathMismatches.push({
      caseId,
      metric,
      leftPath,
      rightPath,
      left: leftValue,
      right: rightValue,
      ...difference(leftValue, rightValue)
    });
  }
}

function rowByMonster(
  rows: readonly DenseCompareRowViewModel[],
  monsterId: string,
  path: string
): DenseCompareRowViewModel {
  const row = rows.find((candidate) => candidate.monsterId === monsterId);
  if (!row) throw new Error(`${path} is missing monster ${monsterId}.`);
  return row;
}

function auditCase(
  summary: AuditSummary,
  caseId: string,
  form: CombatSetupFormState,
  context: SimulationContext,
  cannonByMonster: CannonByMonsterState = {},
  lootPrefsByMonster: LootPrefsState = {},
  lootSettingsByMonster: LootSettingsByMonsterState = {},
  precomputed?: {
    denseRows?: DenseCompareRowViewModel[];
    workerRows?: DenseCompareRowViewModel[];
    matrix?: ReturnType<typeof createDuelMatrixViewModel>;
  }
): void {
  const monsterId = form.monsterId;
  const direct = createSimulationViewModel(
    form,
    context,
    cannonByMonster,
    lootPrefsByMonster[monsterId] ?? {},
    lootSettingsByMonster,
    { includeLootRows: false }
  );
  const directMetrics = comparableMetricsFromViewModel(direct);
  const denseRows =
    precomputed?.denseRows ??
    createDenseCompareRows(
      form,
      context,
      undefined,
      cannonByMonster,
      lootPrefsByMonster,
      {},
      lootSettingsByMonster
    );
  const workerRows =
    precomputed?.workerRows ??
    executeCalculationTask({
      kind: "dense-compare",
      form,
      context,
      cannonByMonster,
      lootPrefsByMonster,
      customSetupsByMonster: {},
      lootSettingsByMonster
    });
  const denseRow = rowByMonster(denseRows, monsterId, "Dense Compare");
  const workerRow = rowByMonster(workerRows, monsterId, "calculation worker");
  const duelLive = createDuelComparisonViewModel(
    form,
    DEFAULT_DUEL_SNAPSHOTS_STATE,
    context,
    cannonByMonster,
    lootPrefsByMonster,
    lootSettingsByMonster
  ).liveRow;
  const matrix =
    precomputed?.matrix ??
    createDuelMatrixViewModel(
      form,
      DEFAULT_DUEL_SNAPSHOTS_STATE,
      context,
      cannonByMonster,
      lootPrefsByMonster,
      lootSettingsByMonster
    );
  const matrixRow = matrix.rows.find((row) => row.monsterId === monsterId);
  const matrixCell = matrixRow?.cells.find((cell) => cell.setupId === "duel-live");
  if (!matrixCell) throw new Error(`Duel matrix is missing live cell for ${monsterId}.`);

  compareMetricMaps(
    summary,
    caseId,
    "Result",
    "Dense Compare",
    directMetrics,
    comparableMetricsFromDenseRow(denseRow)
  );
  compareMetricMaps(
    summary,
    caseId,
    "Dense Compare",
    "calculation worker",
    comparableMetricsFromDenseRow(denseRow),
    comparableMetricsFromDenseRow(workerRow)
  );
  compareMetricMaps(
    summary,
    caseId,
    "Result",
    "Duel live",
    {
      hitChance: directMetrics.hitChance,
      maxHit: directMetrics.maxHit,
      dps: directMetrics.dps,
      ttkSec: directMetrics.ttkSec,
      killsPerHour: directMetrics.killsPerHour,
      xpPerHour: directMetrics.xpPerHour,
      netGpPerHour: directMetrics.netGpPerHour
    },
    {
      hitChance: duelLive.hitChance,
      maxHit: duelLive.maxHit,
      dps: duelLive.dps,
      ttkSec: duelLive.ttkSec,
      killsPerHour: duelLive.killsPerHour,
      xpPerHour: duelLive.effectiveXpPerHour,
      netGpPerHour: duelLive.effectiveNetGpPerHour
    }
  );
  compareMetricMaps(
    summary,
    caseId,
    "Result",
    "Duel matrix",
    {
      dps: directMetrics.dps,
      xpPerHour: directMetrics.xpPerHour,
      netGpPerHour: directMetrics.netGpPerHour
    },
    {
      dps: matrixCell.values.dps ?? Number.NaN,
      xpPerHour: matrixCell.values.effectiveXpPerHour ?? Number.NaN,
      netGpPerHour: matrixCell.values.effectiveNetGpPerHour ?? Number.NaN
    }
  );
}

function legacyClassification(
  fixtureId: string,
  metric: string
): Pick<LegacyFinding, "classification" | "note"> {
  if (fixtureId === "ranged_magic_shortbow_dagannoth_cannon" && metric === "effectiveXpPerHour") {
    return {
      classification: "accepted-delta",
      note: "Rewrite XP/HR composes player and cannon effective XP; legacy keeps cannon XP in a separate row."
    };
  }
  if (fixtureId === "magic_water_bolt_tribesman_poison_safespot") {
    return {
      classification: "accepted-delta",
      note: "D-055 accepts source-backed Revision 274 Tribesman combat and loot deltas."
    };
  }
  if (fixtureId === "melee_ring_recoil_fire_giant_food_trip" && metric === "effectiveXpPerHour") {
    return {
      classification: "accepted-delta",
      note: "D-031 keeps rewrite combat XP attributed to direct player damage instead of recoil damage."
    };
  }
  if (fixtureId === "melee_dragon_halberd_rock_crab_small_target_spec") {
    return {
      classification: "accepted-delta",
      note: "D-071 uses source-backed NPC size for selected-target dragon-halberd hit count."
    };
  }
  if (["gpPerKill", "gpPerHour", "effectiveNetGpPerHour", "supplyCostPerKill"].includes(metric)) {
    return {
      classification: "price-source",
      note: "Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks."
    };
  }
  return {
    classification: "review",
    note: "Large legacy-to-rewrite delta without an automatic accepted classification."
  };
}

function legacyMetrics(vm: SimulationViewModel): Record<string, number> {
  return {
    maxHit: vm.result.combat.maxHit,
    hitChance: vm.result.combat.hitChance,
    dps: vm.result.rates.effectiveDps,
    ttkSec: vm.result.rates.ttkSec,
    killsPerHour: vm.result.rates.killsPerHour,
    effectiveKph: vm.result.rates.effectiveKph,
    effectiveXpPerHour: vm.result.xp.effectiveXpPerHour,
    gpPerKill: vm.result.rates.gpPerKill,
    gpPerHour: vm.result.rates.gpPerHour,
    effectiveNetGpPerHour: vm.result.rates.effectiveNetGpPerHour,
    supplyCostPerKill: vm.result.rates.supplyCostPerKill
  };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const magnitude = Math.abs(value);
  if (magnitude >= 1000) return Math.round(value).toLocaleString("en-US");
  if (magnitude >= 10) return value.toFixed(2);
  return value.toFixed(4);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function markdownEscape(value: string): string {
  return value.replaceAll("|", "\\|");
}

function renderReport(summary: AuditSummary): string {
  const sortedFindings = [...summary.legacyFindings].sort(
    (left, right) =>
      Number(right.classification === "review") - Number(left.classification === "review") ||
      right.relativeDifference - left.relativeDifference ||
      left.fixtureId.localeCompare(right.fixtureId) ||
      left.metric.localeCompare(right.metric)
  );
  const reviewCount = sortedFindings.filter(
    (finding) => finding.classification === "review"
  ).length;
  const lines = [
    "# Numeric user-path audit",
    "",
    `- Status: ${summary.crossPathMismatches.length === 0 ? "cross-path clean" : "cross-path mismatches found"}`,
    `- Date: ${AUDIT_DATE}`,
    "- Runtime: source-backed generated Revision 274 snapshot with scheduled static prices and generated fallbacks",
    "- Scope: Result, Dense Compare, calculation worker, Duel live, Duel matrix, saved setup round-trip and archived legacy golden evidence",
    "",
    "## Cross-path consistency",
    "",
    `- Generated matrix: ${summary.generatedCases} monster/combat-style cases`,
    `- Golden setup variants: ${summary.fixtureCases} cases`,
    `- Numeric path comparisons: ${summary.crossPathComparisons}`,
    `- Mismatches above abs ${CROSS_PATH_ABS_TOLERANCE} and relative ${CROSS_PATH_REL_TOLERANCE}: ${summary.crossPathMismatches.length}`,
    ""
  ];

  if (summary.crossPathMismatches.length === 0) {
    lines.push(
      "All audited current-runtime paths produced the same numeric values within the audit tolerance.",
      ""
    );
  } else {
    lines.push(
      "| Case | Metric | Left path | Right path | Left | Right | Relative delta |",
      "| --- | --- | --- | --- | ---: | ---: | ---: |"
    );
    for (const mismatch of summary.crossPathMismatches.slice(0, 50)) {
      lines.push(
        `| ${markdownEscape(mismatch.caseId)} | ${mismatch.metric} | ${mismatch.leftPath} | ${mismatch.rightPath} | ${formatNumber(mismatch.left)} | ${formatNumber(mismatch.right)} | ${formatPercent(mismatch.relativeDifference)} |`
      );
    }
    lines.push("");
  }

  lines.push(
    "## Fixes made during this audit",
    "",
    "- `FullSimulationResult.rates.ttkSec` now uses the Trip path's cannon/poison/recoil-adjusted kill time. The prior combat-only value disagreed with the same result's kills/hr, XP/hr and economy rates when auxiliary damage was active.",
    "- Stats combat-roll detail continues to expose the normal player-combat TTK separately.",
    "- Ordinary caskets use the exact Revision 274 opened-content table; the generated parent object cost cannot override the component EV.",
    "",
    "## Source-backed casket correction",
    "",
    "The focused correction compares the prior generated parent object cost with the current component-derived opened value. It is classified separately from generic market-price differences.",
    "",
    "| Monster | Drop chance | Previous parent value | Opened contents EV | GP/kill delta | Classification |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...summary.casketImpacts.map(
      (finding) =>
        `| ${markdownEscape(`${finding.monsterName} (${finding.monsterId})`)} | ${formatPercent(finding.chance)} | ${formatNumber(finding.previousParentValue)} | ${formatNumber(finding.openedContentsValue)} | ${formatNumber(finding.gpPerKillDelta)} | ${finding.classification} |`
    ),
    "",
    "## Large legacy-to-rewrite observations",
    "",
    `- Compared metric values: ${summary.legacyComparisons}`,
    `- Large threshold findings: ${sortedFindings.length}`,
    `- Unclassified findings needing review: ${reviewCount}`,
    "",
    "Legacy comparisons are evidence, not current runtime truth. Economy deltas are expected when embedded legacy prices differ from the scheduled/generated PriceSet. A finding requires both the metric-specific absolute and relative threshold to be exceeded.",
    ""
  );

  if (sortedFindings.length === 0) {
    lines.push("No large legacy-to-rewrite findings crossed the audit thresholds.", "");
  } else {
    lines.push(
      "| Fixture | Metric | Legacy | Rewrite | Relative delta | Classification | Note |",
      "| --- | --- | ---: | ---: | ---: | --- | --- |"
    );
    for (const finding of sortedFindings) {
      lines.push(
        `| ${markdownEscape(finding.fixtureId)} | ${finding.metric} | ${formatNumber(finding.legacy)} | ${formatNumber(finding.rewrite)} | ${formatPercent(finding.relativeDifference)} | ${finding.classification} | ${markdownEscape(finding.note)} |`
      );
    }
    lines.push("");
  }

  lines.push(
    "## Interpretation boundaries",
    "",
    "- Zero cross-path mismatches means the current Result/Dense/Duel/worker presentations agree; it does not prove the underlying formula is historically correct.",
    "- Legacy price and archived trip-model differences are not silently accepted as rewrite truth.",
    "- Browser display formatting remains covered separately by the all-fixture Playwright metric-strip and release-path numeric snapshot cases.",
    "- Planner legacy parity remains the separately bounded `npm run planner:parity` audit.",
    ""
  );

  return `${lines.join("\n")}\n`;
}

function runAudit(): AuditSummary {
  const { context } = createGeneratedRuntimeContext({ loadedAt: `${AUDIT_DATE}T12:00:00.000Z` });
  const summary: AuditSummary = {
    generatedCases: 0,
    fixtureCases: 0,
    crossPathComparisons: 0,
    crossPathMismatches: [],
    legacyComparisons: 0,
    legacyFindings: [],
    casketImpacts: []
  };

  const openedContentsValue = casketStats(context.priceSet, context.gameData).ev;
  const previousParentValue =
    context.priceSet.itemPrices.casket ?? context.gameData.items.casket?.price ?? 0;
  for (const [monsterId, monster] of Object.entries(context.gameData.monsters)) {
    for (const drop of (monster.loot ?? []).flatMap((entry) =>
      Array.isArray(entry) ? entry : [entry]
    )) {
      if (drop.tag !== "casket") continue;
      summary.casketImpacts.push({
        monsterId,
        monsterName: monster.name,
        chance: drop.chance,
        previousParentValue,
        openedContentsValue,
        gpPerKillDelta: drop.chance * drop.qtyAvg * (openedContentsValue - previousParentValue),
        classification: "source-backed-casket"
      });
    }
  }
  summary.casketImpacts.sort((left, right) => left.monsterId.localeCompare(right.monsterId));

  for (const combatStyle of COMBAT_STYLES) {
    const baseForm = switchCombatStyleLoadout(DEFAULT_FORM_STATE, combatStyle);
    const denseRows = createDenseCompareRows(baseForm, context);
    const workerRows = executeCalculationTask({
      kind: "dense-compare",
      form: baseForm,
      context,
      cannonByMonster: {},
      lootPrefsByMonster: {},
      customSetupsByMonster: {},
      lootSettingsByMonster: {}
    });
    const matrix = createDuelMatrixViewModel(baseForm, DEFAULT_DUEL_SNAPSHOTS_STATE, context);
    for (const monsterId of Object.keys(context.gameData.monsters)) {
      summary.generatedCases += 1;
      auditCase(
        summary,
        `generated:${combatStyle}:${monsterId}`,
        { ...baseForm, monsterId },
        context,
        {},
        {},
        {},
        { denseRows, workerRows, matrix }
      );
    }
  }

  const goldenExpectedById = new Map(
    legacyGolden.cases.map((testCase) => [
      testCase.id,
      testCase.expected as Record<string, unknown>
    ])
  );
  for (const definition of LEGACY_GOLDEN_CASES) {
    const fixture = createRewriteFixtureCase(definition, context);
    summary.fixtureCases += 1;
    auditCase(
      summary,
      `fixture:${definition.id}`,
      fixture.form,
      context,
      fixture.cannonByMonster,
      fixture.lootPrefsByMonster,
      fixture.lootSettingsByMonster
    );

    const saved = savedSetupFromForm(fixture.form, undefined, fixture.cannonByMonster);
    const restored = SavedSetupSchema.parse(JSON.parse(JSON.stringify(saved)));
    const liveVm = createSimulationViewModel(
      fixture.form,
      context,
      fixture.cannonByMonster,
      fixture.lootPrefsByMonster[fixture.form.monsterId] ?? {},
      fixture.lootSettingsByMonster,
      { includeLootRows: false }
    );
    const restoredVm = createSimulationViewModel(
      restored.form,
      context,
      restored.cannonByMonster,
      fixture.lootPrefsByMonster[restored.form.monsterId] ?? {},
      fixture.lootSettingsByMonster,
      { includeLootRows: false }
    );
    compareMetricMaps(
      summary,
      `fixture:${definition.id}`,
      "Result",
      "saved setup round-trip",
      comparableMetricsFromViewModel(liveVm),
      comparableMetricsFromViewModel(restoredVm)
    );

    const expected = goldenExpectedById.get(definition.id);
    if (!expected) throw new Error(`Legacy golden fixture ${definition.id} is missing.`);
    const rewrite = legacyMetrics(liveVm);
    for (const [metric, threshold] of Object.entries(LEGACY_THRESHOLDS)) {
      const legacyValue = expected[metric];
      const rewriteValue = rewrite[metric];
      if (typeof legacyValue !== "number" || rewriteValue == null) continue;
      summary.legacyComparisons += 1;
      const delta = difference(legacyValue, rewriteValue);
      if (
        delta.absoluteDifference <= threshold.absolute ||
        delta.relativeDifference <= threshold.relative
      ) {
        continue;
      }
      summary.legacyFindings.push({
        fixtureId: definition.id,
        metric,
        legacy: legacyValue,
        rewrite: rewriteValue,
        ...delta,
        ...legacyClassification(definition.id, metric)
      });
    }
  }

  return summary;
}

const args = process.argv.slice(2);
const unknownArgs = args.filter((arg) => arg !== "--write");
if (unknownArgs.length > 0) throw new Error(`Unknown numeric audit option: ${unknownArgs[0]}`);

const summary = runAudit();
const report = await formatWithPrettier(renderReport(summary), { parser: "markdown" });
if (args.includes("--write")) {
  writeFileSync(REPORT_PATH, report, "utf8");
  process.stdout.write(`Wrote ${REPORT_PATH}\n`);
}
process.stdout.write(report);

if (summary.crossPathMismatches.length > 0) {
  process.exitCode = 1;
}

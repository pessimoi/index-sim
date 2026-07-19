import {
  createHitDistribution,
  createHitDistributionMixture,
  createIndependentHitDistribution,
  simulateCombat,
  type CombatXpKey,
  type HitDistribution
} from "@/domain/combat";
import type { FullSimulationResult } from "@/domain/simulation";
import { HIGH_ALCH_MAGIC_XP_PER_CAST, type TripLootSupplyResult } from "@/domain/trip";
import type { CombatSetupFormState } from "../state/ui-state";
import type { CalculationWarningViewModel } from "./contracts";
import { formatDuration, formatNumber } from "./formatting";

export interface HitDistributionBucketViewModel {
  id: string;
  label: string;
  ariaLabel: string;
  probability: number;
  percentLabel: string;
  widthPercent: number;
  heightPercent: number;
  damage: number | null;
  cumulativeAtLeast: number | null;
  cumulativeAtLeastLabel: string | null;
  isMiss: boolean;
  isAccurateZero: boolean;
  isMaxHit: boolean;
}

export interface HitDistributionViewModel {
  hitChance: number;
  averageHit: number;
  maxHit: number;
  peakMaxHit: number;
  probabilityTotal: number;
  hitChanceLabel: string;
  averageHitLabel: string;
  maxHitLabel: string;
  buckets: HitDistributionBucketViewModel[];
}

export interface HitDistributionComparisonPointViewModel {
  probability: number;
  percentLabel: string;
  cumulativeAtLeast: number | null;
  cumulativeAtLeastLabel: string | null;
  heightPercent: number;
  isMaxHit: boolean;
}

export interface HitDistributionComparisonBucketViewModel {
  id: string;
  label: string;
  damage: number | null;
  isMiss: boolean;
  isAccurateZero: boolean;
  ariaLabel: string;
  normal: HitDistributionComparisonPointViewModel;
  special: HitDistributionComparisonPointViewModel | null;
}

export interface HitDistributionComparisonSeriesViewModel {
  id: "normal" | "special";
  label: string;
  scopeLabel: string;
  distribution: HitDistributionViewModel;
  expectedMarkerPercent: number;
  expectedDamageLabel: string;
  koChance: number;
  koChanceLabel: string;
}

export interface HitDistributionComparisonViewModel {
  series: HitDistributionComparisonSeriesViewModel[];
  buckets: HitDistributionComparisonBucketViewModel[];
  axisMaxDamage: number;
  maxProbability: number;
  maxProbabilityLabel: string;
  middleProbabilityLabel: string;
  targetHp: number | null;
  targetHpLabel: string | null;
  targetMarkerPercent: number | null;
  koRegionStartPercent: number | null;
}

export interface StatsCombatRollMetricViewModel {
  id: string;
  label: string;
  value: string;
  numericValue: number | null;
  note: string;
  tone: "default" | "teal" | "gold" | "muted";
}

export interface StatsCombatRollDetailViewModel {
  status: "modeled" | "partial";
  statusLabel: string;
  metrics: StatsCombatRollMetricViewModel[];
  notes: string[];
}

export type XpRoutingRowStatus = "modeled" | "partial" | "not-modeled";

export interface XpRoutingRowViewModel {
  id: string;
  label: string;
  value: string;
  xpPerHour: number | null;
  status: XpRoutingRowStatus;
  statusLabel: string;
  note: string;
}

export interface XpRoutingViewModel {
  effectiveXpPerHour: number;
  totalXpPerHour: number;
  effectiveXpPerHourLabel: string;
  totalXpPerHourLabel: string;
  rows: XpRoutingRowViewModel[];
}

export interface StatsTripBankingSummaryRowViewModel {
  id: string;
  label: string;
  value: string;
  numericValue: number | null;
  note: string;
  tone: "default" | "gold" | "teal" | "muted";
}

export interface StatsTripBankingSummaryViewModel {
  rows: StatsTripBankingSummaryRowViewModel[];
}

export type StatsSourceBreakdownStatus = "modeled" | "partial" | "not-modeled" | "inactive";

export type StatsSourceBreakdownRowId = "normal-attack" | "special-attack" | "cannon";

export interface StatsSourceBreakdownRowViewModel {
  id: StatsSourceBreakdownRowId;
  label: string;
  status: StatsSourceBreakdownStatus;
  statusLabel: string;
  dps: number | null;
  dpsLabel: string;
  dpsDetail: string | null;
  dpsGainPct: number | null;
  xpPerHour: number | null;
  xpPerHourLabel: string;
  hitChance: number | null;
  hitChanceLabel: string;
  maxHit: number | null;
  maxHitLabel: string;
  supplyCostPerHour: number | null;
  supplyCostPerHourLabel: string;
  supplyCostPerKill: number | null;
  supplyCostPerKillLabel: string;
  notes: string[];
}

export interface StatsSourceDetailMetricViewModel {
  id: string;
  label: string;
  value: string;
  numericValue: number | null;
}

export interface StatsSourceDetailViewModel {
  id: StatsSourceBreakdownRowId;
  label: string;
  status: StatsSourceBreakdownStatus;
  statusLabel: string;
  metrics: StatsSourceDetailMetricViewModel[];
  notes: string[];
  warnings: CalculationWarningViewModel[];
  histogram: HitDistributionViewModel | null;
  histogramScopeLabel: string | null;
}

export interface StatsSourceBreakdownViewModel {
  rows: StatsSourceBreakdownRowViewModel[];
  details: StatsSourceDetailViewModel[];
}

export interface StatsPaneViewModel {
  sourceBreakdown: StatsSourceBreakdownViewModel;
  combatRollDetail: StatsCombatRollDetailViewModel;
  xpRouting: XpRoutingViewModel;
  tripBankingSummary: StatsTripBankingSummaryViewModel;
  effectiveKph: number;
}

const XP_SKILL_LABELS: Record<CombatXpKey, string> = {
  att: "Attack",
  str: "Strength",
  def: "Defence",
  rng: "Ranged",
  mag: "Magic",
  hp: "Hitpoints"
};

const XP_SKILL_ORDER: CombatXpKey[] = ["att", "str", "def", "rng", "mag", "hp"];

const PROTECTION_LABELS: Record<NonNullable<CombatSetupFormState["trip"]["protect"]>, string> = {
  none: "None",
  melee: "Protect from Melee",
  missiles: "Protect from Missiles",
  magic: "Protect from Magic"
};

function xpRoutingRow(input: {
  id: string;
  label: string;
  xpPerHour: number | null;
  status: XpRoutingRowStatus;
  note: string;
}): XpRoutingRowViewModel {
  return {
    ...input,
    value: input.xpPerHour == null ? "-" : formatNumber(input.xpPerHour),
    statusLabel:
      input.status === "modeled"
        ? "modeled"
        : input.status === "partial"
          ? "partial"
          : "not modeled"
  };
}

export function createXpRoutingViewModel(input: {
  result: FullSimulationResult;
}): XpRoutingViewModel {
  const xp = input.result.xp;
  const trip = input.result.trip;
  const rows: XpRoutingRowViewModel[] = [
    xpRoutingRow({
      id: "player-combat",
      label: "Player combat XP/hr",
      xpPerHour: xp.playerEffectiveXpPerHour,
      status: "modeled",
      note: "Direct player combat XP contributing to effective XP/hr."
    })
  ];

  if (xp.cannonEffectiveXpPerHour > 0) {
    rows.push(
      xpRoutingRow({
        id: "cannon-ranged",
        label: "Cannon ranged XP/hr",
        xpPerHour: xp.cannonEffectiveXpPerHour,
        status: "modeled",
        note: "Separate cannon ranged XP row after trip efficiency."
      })
    );
  }

  for (const key of XP_SKILL_ORDER) {
    const xpPerKill = xp.combat.skillXpPerKill[key] ?? 0;
    if (xpPerKill <= 0) continue;
    rows.push(
      xpRoutingRow({
        id: `skill-${key}`,
        label: XP_SKILL_LABELS[key],
        xpPerHour: xpPerKill * trip.effectiveKph,
        status: "modeled",
        note: "Skill row from the rewrite-owned combat XP breakdown."
      })
    );
  }

  rows.push(
    xpRoutingRow({
      id: "prayer",
      label: "Prayer XP/hr",
      xpPerHour: xp.prayerXpPerHour,
      status: "modeled",
      note:
        xp.prayerXpPerHour > 0
          ? "Bury XP from current loot actions after trip efficiency."
          : "No buryable bone XP in the current loot actions."
    }),
    xpRoutingRow({
      id: "alch",
      label: "Magic (alch) XP/hr",
      xpPerHour: xp.magicAlchXpPerHour,
      status: "modeled",
      note:
        trip.alchCastsPerKill > 0
          ? `${formatNumber(trip.alchCastsPerKill, 2)} alch casts/kill at ${HIGH_ALCH_MAGIC_XP_PER_CAST} Magic XP/cast after trip efficiency.`
          : "No in-trip high-alch casts in the current loot model."
    })
  );

  return {
    effectiveXpPerHour: xp.effectiveXpPerHour,
    totalXpPerHour: xp.totalXpPerHour,
    effectiveXpPerHourLabel: formatNumber(xp.effectiveXpPerHour),
    totalXpPerHourLabel: formatNumber(xp.totalXpPerHour),
    rows
  };
}

function statsSourceStatusLabel(status: StatsSourceBreakdownStatus): string {
  if (status === "modeled") return "modeled";
  if (status === "partial") return "partial";
  if (status === "not-modeled") return "not modeled";
  return "inactive";
}

function optionalStatsNumber(value: number | null, digits = 0): string {
  return value == null ? "-" : formatNumber(value, digits);
}

function optionalStatsPercent(value: number | null): string {
  return value == null ? "-" : `${formatNumber(value * 100, 1)}%`;
}

function statsSourceBreakdownRow(
  input: Omit<
    StatsSourceBreakdownRowViewModel,
    | "statusLabel"
    | "dpsLabel"
    | "xpPerHourLabel"
    | "hitChanceLabel"
    | "maxHitLabel"
    | "supplyCostPerHourLabel"
    | "supplyCostPerKillLabel"
  >
): StatsSourceBreakdownRowViewModel {
  return {
    ...input,
    statusLabel: statsSourceStatusLabel(input.status),
    dpsLabel: optionalStatsNumber(input.dps, 2),
    xpPerHourLabel: optionalStatsNumber(input.xpPerHour),
    hitChanceLabel: optionalStatsPercent(input.hitChance),
    maxHitLabel: optionalStatsNumber(input.maxHit),
    supplyCostPerHourLabel: optionalStatsNumber(input.supplyCostPerHour),
    supplyCostPerKillLabel: optionalStatsNumber(input.supplyCostPerKill)
  };
}

function statsSourceMetric(
  id: string,
  label: string,
  numericValue: number | null,
  value: string
): StatsSourceDetailMetricViewModel {
  return {
    id,
    label,
    numericValue,
    value
  };
}

function statsSourceBaseMetrics(
  row: StatsSourceBreakdownRowViewModel
): StatsSourceDetailMetricViewModel[] {
  const metrics = [
    statsSourceMetric("dps", "DPS", row.dps, row.dpsLabel),
    statsSourceMetric("xp-hr", "XP/hr", row.xpPerHour, row.xpPerHourLabel),
    statsSourceMetric("hit-chance", "Hit chance", row.hitChance, row.hitChanceLabel),
    statsSourceMetric("max-hit", "Max hit", row.maxHit, row.maxHitLabel),
    statsSourceMetric(
      "supply-cost-hour",
      "Supply cost/hr",
      row.supplyCostPerHour,
      row.supplyCostPerHourLabel
    ),
    statsSourceMetric(
      "supply-cost-kill",
      "Supply cost/kill",
      row.supplyCostPerKill,
      row.supplyCostPerKillLabel
    )
  ];

  if (row.dpsGainPct != null) {
    metrics.splice(
      1,
      0,
      statsSourceMetric(
        "dps-gain",
        "DPS gain",
        row.dpsGainPct,
        `${formatNumber(row.dpsGainPct, 1)}%`
      )
    );
  }

  return metrics;
}

function statsSourceDetail(input: {
  row: StatsSourceBreakdownRowViewModel;
  metrics?: StatsSourceDetailMetricViewModel[];
  notes?: readonly string[];
  warnings?: readonly CalculationWarningViewModel[];
  histogram?: HitDistributionViewModel | null;
  histogramScopeLabel?: string | null;
}): StatsSourceDetailViewModel {
  return {
    id: input.row.id,
    label: input.row.label,
    status: input.row.status,
    statusLabel: input.row.statusLabel,
    metrics: input.metrics ?? statsSourceBaseMetrics(input.row),
    notes: [...(input.notes ?? input.row.notes)],
    warnings: [...(input.warnings ?? [])],
    histogram: input.histogram ?? null,
    histogramScopeLabel: input.histogramScopeLabel ?? null
  };
}

export function createStatsSourceBreakdownViewModel(input: {
  form: CombatSetupFormState;
  result: FullSimulationResult;
  specialWarnings: readonly CalculationWarningViewModel[];
  hitDistribution: HitDistributionViewModel;
  includeHistograms?: boolean;
}): StatsSourceBreakdownViewModel {
  const combat = input.result.combat;
  const trip = input.result.trip;
  const cannon = trip.cannon;
  const cannonSupplyCostPerKill = cannon?.ballCostPerKill ?? 0;
  const normalSupplyCostPerKill = Math.max(
    0,
    trip.supply.supplyCostPerKill - cannonSupplyCostPerKill
  );
  const normalSupplyCostPerHour = normalSupplyCostPerKill * trip.effectiveKph;
  const special = combat.specialAttack;
  const specialDps = special ? special.dpsWithSpec - special.dpsBase : null;
  const dbaBoostSpecialActive =
    input.form.combatStyle === "melee" && input.form.boosts.includes("dba_spec");
  const specialStatus: StatsSourceBreakdownStatus = special
    ? input.specialWarnings.length > 0
      ? "partial"
      : "modeled"
    : input.form.combatStyle === "magic"
      ? "not-modeled"
      : "inactive";
  const inactiveSpecialNote = dbaBoostSpecialActive
    ? "DBA special boost is modeled as a boost, not a DPS special attack."
    : input.form.combatStyle === "magic"
      ? "Magic DPS special attacks are not modeled yet."
      : "No supported melee/ranged DPS special selected.";
  const specialNotes =
    special == null
      ? [inactiveSpecialNote]
      : [
          `${formatNumber(special.specsPerHour, 1)} specs/hr from the current special attack model.`,
          "Special attack XP is included in player combat XP/hr; separate special XP is not modeled.",
          ...(input.specialWarnings.length > 0
            ? input.specialWarnings.map((warning) => warning.message)
            : ["DPS gain is shown as modeled special DPS above the normal attack baseline."])
        ];
  const cannonStatus: StatsSourceBreakdownStatus = cannon
    ? cannon.idle
      ? "inactive"
      : "modeled"
    : "inactive";
  const specialHistogram =
    input.includeHistograms !== false && special
      ? createHitDistributionFromValues({
          hitChance: special.hitChance,
          averageHit: special.hits > 0 ? special.expPerSpec / special.hits : Number.NaN,
          maxHit: special.maxHit,
          peakMaxHit: special.maxHit
        })
      : null;
  const cannonHistogram =
    input.includeHistograms !== false && cannon && !cannon.idle && cannon.ballsPerSec > 0
      ? createHitDistributionFromValues({
          hitChance: combat.hitChance,
          averageHit: cannon.cannonDps / cannon.ballsPerSec,
          maxHit: cannon.maxBall,
          peakMaxHit: cannon.maxBall
        })
      : null;
  const normalRow = statsSourceBreakdownRow({
    id: "normal-attack",
    label: "Normal attack",
    status: "modeled",
    dps: input.result.rates.dps,
    dpsDetail: special ? "Baseline before special attacks" : null,
    dpsGainPct: null,
    xpPerHour: input.result.xp.playerEffectiveXpPerHour,
    hitChance: combat.hitChance,
    maxHit: combat.maxHit,
    supplyCostPerHour: normalSupplyCostPerHour,
    supplyCostPerKill: normalSupplyCostPerKill,
    notes: ["Base player attack after trip efficiency and current supply model."]
  });
  const specialRow = statsSourceBreakdownRow({
    id: "special-attack",
    label: "Special attack",
    status: specialStatus,
    dps: specialDps,
    dpsDetail: special ? `DPS gain ${formatNumber(special.dpsGainPct, 1)}%` : null,
    dpsGainPct: special?.dpsGainPct ?? null,
    xpPerHour: null,
    hitChance: special?.hitChance ?? null,
    maxHit: special?.maxHit ?? null,
    supplyCostPerHour: null,
    supplyCostPerKill: null,
    notes: specialNotes
  });
  const cannonRow = statsSourceBreakdownRow({
    id: "cannon",
    label: "Cannon",
    status: cannonStatus,
    dps: cannon?.cannonDps ?? null,
    dpsDetail: cannon ? `${formatNumber(cannon.activeFrac * 100, 1)}% active` : null,
    dpsGainPct: null,
    xpPerHour: cannon ? input.result.xp.cannonEffectiveXpPerHour : null,
    hitChance: cannon ? combat.hitChance : null,
    maxHit: cannon?.maxBall ?? null,
    supplyCostPerHour: cannon ? cannonSupplyCostPerKill * trip.effectiveKph : null,
    supplyCostPerKill: cannon ? cannonSupplyCostPerKill : null,
    notes: cannon
      ? [
          cannon.idle
            ? "Idle: this spot is too sparse for the cannon to fire."
            : `Cannon overlay: ${formatNumber(cannon.effTargets, 1)} effective targets, ${formatNumber(
                cannon.ballsPerHour
              )} balls/hr before trip efficiency.`,
          cannon.respawnBound
            ? "Respawn-bound cannon overlay."
            : "Cannon overlay is not respawn-bound."
        ]
      : ["Cannon is off for the current monster."]
  });
  const specialMetrics = statsSourceBaseMetrics(specialRow);
  if (special) {
    specialMetrics.push(
      statsSourceMetric("spec-weapon", "Spec weapon", null, special.weaponName),
      statsSourceMetric(
        "dps-with-spec",
        "DPS with spec",
        special.dpsWithSpec,
        formatNumber(special.dpsWithSpec, 2)
      ),
      statsSourceMetric(
        "specs-hr",
        "Specs/hr",
        special.specsPerHour,
        formatNumber(special.specsPerHour, 1)
      ),
      statsSourceMetric("hits", "Hits", special.hits, formatNumber(special.hits))
    );
  }
  const cannonMetrics = statsSourceBaseMetrics(cannonRow);
  if (cannon) {
    const sparseState = cannon.idle ? "Idle" : cannon.respawnBound ? "Respawn-bound" : "Active";
    cannonMetrics.push(
      statsSourceMetric(
        "effective-targets",
        "Effective targets",
        cannon.effTargets,
        formatNumber(cannon.effTargets, 1)
      ),
      statsSourceMetric(
        "active-fraction",
        "Active time",
        cannon.activeFrac,
        `${formatNumber(cannon.activeFrac * 100, 1)}%`
      ),
      statsSourceMetric(
        "balls-hr",
        "Balls/hr",
        cannon.ballsPerHour,
        formatNumber(cannon.ballsPerHour)
      ),
      statsSourceMetric(
        "balls-kill",
        "Balls/kill",
        cannon.ballsPerKill,
        formatNumber(cannon.ballsPerKill, 2)
      ),
      statsSourceMetric(
        "ball-price",
        "Ball price",
        cannon.ballPrice,
        formatNumber(cannon.ballPrice)
      ),
      statsSourceMetric(
        "cannon-ranged-xp-hr",
        "Cannon Ranged XP/hr",
        cannon.rangedXpPerHour,
        formatNumber(cannon.rangedXpPerHour)
      ),
      statsSourceMetric(
        "ball-cost-hour",
        "Ball cost/hr",
        cannon.ballCostPerHour,
        formatNumber(cannon.ballCostPerHour)
      ),
      statsSourceMetric(
        "ball-cost-kill",
        "Ball cost/kill",
        cannon.ballCostPerKill,
        formatNumber(cannon.ballCostPerKill)
      ),
      statsSourceMetric(
        "cannonballs-trip",
        "Cannonballs/trip",
        cannon.ballsPerTrip ?? null,
        cannon.ballsPerTrip == null ? "-" : formatNumber(cannon.ballsPerTrip)
      ),
      statsSourceMetric("sparse-state", "Sparse state", null, sparseState),
      statsSourceMetric("idle", "Idle", null, cannon.idle ? "Yes" : "No"),
      statsSourceMetric("respawn-bound", "Respawn-bound", null, cannon.respawnBound ? "Yes" : "No")
    );
  }

  return {
    rows: [normalRow, specialRow, cannonRow],
    details: [
      statsSourceDetail({
        row: normalRow,
        warnings: [],
        histogram: input.includeHistograms === false ? null : input.hitDistribution,
        histogramScopeLabel: input.includeHistograms === false ? null : "Per normal attack"
      }),
      statsSourceDetail({
        row: specialRow,
        metrics: specialMetrics,
        warnings: input.specialWarnings,
        histogram: specialHistogram,
        histogramScopeLabel: specialHistogram ? "Per special hit" : null
      }),
      statsSourceDetail({
        row: cannonRow,
        metrics: cannonMetrics,
        warnings: [],
        histogram: cannonHistogram,
        histogramScopeLabel: cannonHistogram ? "Per fired cannonball" : null
      })
    ]
  };
}

function finiteMinutesLabel(minutes: number): string {
  if (minutes === Number.POSITIVE_INFINITY) return "unlimited";
  return Number.isFinite(minutes) ? `${formatNumber(minutes, 1)} min` : "-";
}

function finiteSecondsLabel(seconds: number): string {
  if (seconds === Number.POSITIVE_INFINITY) return "unlimited";
  return Number.isFinite(seconds) ? `${formatNumber(seconds)} s` : "-";
}

function statsTripRow(input: {
  id: string;
  label: string;
  value: string;
  numericValue?: number | null;
  note?: string;
  tone?: StatsTripBankingSummaryRowViewModel["tone"];
}): StatsTripBankingSummaryRowViewModel {
  return {
    id: input.id,
    label: input.label,
    value: input.value,
    numericValue: input.numericValue ?? null,
    note: input.note ?? "",
    tone: input.tone ?? "default"
  };
}

function safespotStateLabel(form: CombatSetupFormState, trip: TripLootSupplyResult): string {
  if (trip.trip.incoming.safespot) return form.trip.safespot == null ? "Auto safespot" : "On";
  return form.trip.safespot === false ? "Off" : "No safespot";
}

function protectionStateLabel(form: CombatSetupFormState, trip: TripLootSupplyResult): string {
  const requested = PROTECTION_LABELS[form.trip.protect ?? "none"];
  if (trip.trip.incoming.protected) return `${requested} active`;
  return requested === "None" ? "None" : `${requested} not blocking`;
}

export function createTripBankingSummaryViewModel(
  form: CombatSetupFormState,
  trip: TripLootSupplyResult
): StatsTripBankingSummaryViewModel {
  const currentBound = trip.trip.scarce.respawnBound ? "respawn-bound" : trip.trip.bound;

  return {
    rows: [
      statsTripRow({
        id: "kills-trip",
        label: "Kills/trip",
        value: formatNumber(trip.trip.killsPerTrip, 1),
        numericValue: trip.trip.killsPerTrip
      }),
      statsTripRow({
        id: "trip-length",
        label: "Trip length",
        value: finiteMinutesLabel(trip.trip.tripMinutes),
        numericValue: trip.trip.tripMinutes
      }),
      statsTripRow({
        id: "bank-time",
        label: "Bank time",
        value: finiteSecondsLabel(trip.trip.bankSeconds),
        numericValue: trip.trip.bankSeconds
      }),
      statsTripRow({
        id: "effective-kills-hour",
        label: "Effective kills/hr",
        value: formatNumber(trip.effectiveKph),
        numericValue: trip.effectiveKph,
        tone: "teal"
      }),
      statsTripRow({
        id: "supply-kill",
        label: "Supply/kill",
        value: formatNumber(trip.supply.supplyCostPerKill),
        numericValue: trip.supply.supplyCostPerKill,
        tone: "gold"
      }),
      statsTripRow({
        id: "net-gp-hour",
        label: "Net GP/hr",
        value: formatNumber(trip.effectiveNetGpPerHour),
        numericValue: trip.effectiveNetGpPerHour,
        note: "After trip and banking efficiency.",
        tone: "gold"
      }),
      statsTripRow({
        id: "trip-bound",
        label: "Current trip bound",
        value: currentBound,
        note: trip.trip.scarce.respawnBound
          ? "Scarce/respawn cap limits effective rate."
          : "Selected by the current Trip model."
      }),
      statsTripRow({
        id: "safespot-state",
        label: "Safespot",
        value: safespotStateLabel(form, trip),
        note: trip.trip.incoming.safespotAuto ? "Auto-derived from combat style or target." : ""
      }),
      statsTripRow({
        id: "protection-state",
        label: "Protection prayer",
        value: protectionStateLabel(form, trip),
        note: trip.trip.incoming.protected ? "Incoming damage blocked by protection prayer." : ""
      }),
      statsTripRow({
        id: "incoming-model",
        label: "Incoming model",
        value: trip.trip.incoming.descriptor.sourceLabel,
        note:
          trip.trip.incoming.descriptor.coverage === "source-backed"
            ? "Revision 274 typed attack profile."
            : "Incoming variance remains mean-only for this model coverage."
      })
    ]
  };
}

function createHitDistributionFromValues(input: {
  hitChance: number;
  averageHit: number;
  maxHit: number;
  peakMaxHit: number;
}): HitDistributionViewModel | null {
  if (
    !Number.isFinite(input.hitChance) ||
    !Number.isFinite(input.averageHit) ||
    !Number.isFinite(input.maxHit) ||
    !Number.isFinite(input.peakMaxHit) ||
    input.averageHit < 0 ||
    input.maxHit < 0 ||
    input.peakMaxHit < 0
  ) {
    return null;
  }
  return createHitDistributionPresentation(createHitDistribution(input));
}

function createHitDistributionPresentation(
  distribution: HitDistribution
): HitDistributionViewModel {
  const maxProbability = Math.max(...distribution.buckets.map((bucket) => bucket.probability), 0);
  const cumulativeById = new Map<string, number>();
  let cumulative = 0;
  for (const bucket of [...distribution.buckets].reverse()) {
    if (bucket.isMiss) continue;
    cumulative += bucket.probability;
    cumulativeById.set(bucket.id, cumulative);
  }

  return {
    hitChance: distribution.hitChance,
    averageHit: distribution.averageHit,
    maxHit: distribution.maxHit,
    peakMaxHit: distribution.peakMaxHit,
    probabilityTotal: distribution.probabilityTotal,
    hitChanceLabel: `${formatNumber(distribution.hitChance * 100, 1)}%`,
    averageHitLabel: formatNumber(distribution.averageHit, 2),
    maxHitLabel: formatNumber(distribution.maxHit),
    buckets: distribution.buckets.map((bucket) => {
      const percentLabel = `${formatNumber(bucket.probability * 100, 1)}%`;
      const cumulativeAtLeast = bucket.isMiss ? null : (cumulativeById.get(bucket.id) ?? 0);
      const cumulativeAtLeastLabel =
        cumulativeAtLeast == null ? null : `${formatNumber(cumulativeAtLeast * 100, 1)}%`;
      const damageText = bucket.isMiss
        ? "miss"
        : bucket.isAccurateZero
          ? "accurate zero damage"
          : `${bucket.minDamage} damage`;
      return {
        id: bucket.id,
        label: bucket.label,
        ariaLabel: `${damageText}: ${percentLabel}${
          cumulativeAtLeastLabel ? `; at least this damage: ${cumulativeAtLeastLabel}` : ""
        }${bucket.isMaxHit ? "; max hit bucket" : ""}`,
        probability: bucket.probability,
        percentLabel,
        widthPercent:
          maxProbability > 0 ? Math.max(3, (bucket.probability / maxProbability) * 100) : 0,
        heightPercent: maxProbability > 0 ? (bucket.probability / maxProbability) * 100 : 0,
        damage: bucket.isMiss ? null : bucket.minDamage,
        cumulativeAtLeast,
        cumulativeAtLeastLabel,
        isMiss: bucket.isMiss,
        isAccurateZero: bucket.isAccurateZero,
        isMaxHit: bucket.isMaxHit
      };
    })
  };
}

export function createHitDistributionViewModel(
  combat: ReturnType<typeof simulateCombat>
): HitDistributionViewModel {
  if (!combat.debug.normalHitRolls.length) {
    throw new Error("Current combat result has invalid hit distribution values.");
  }
  return createHitDistributionPresentation(
    createHitDistributionMixture(combat.debug.normalHitRolls)
  );
}

export function createHitDistributionSummaryViewModel(
  combat: ReturnType<typeof simulateCombat>
): HitDistributionViewModel {
  const maxHit = Math.max(0, Math.round(combat.peakMaxHit));
  return {
    hitChance: combat.hitChance,
    averageHit: combat.avgHit,
    maxHit,
    peakMaxHit: maxHit,
    probabilityTotal: 0,
    hitChanceLabel: `${formatNumber(combat.hitChance * 100, 1)}%`,
    averageHitLabel: formatNumber(combat.avgHit, 2),
    maxHitLabel: formatNumber(maxHit),
    buckets: []
  };
}

export function createOmittedHitDistributionComparisonViewModel(
  targetHpInput: number | undefined
): HitDistributionComparisonViewModel {
  const targetHp =
    Number.isFinite(targetHpInput) && targetHpInput! > 0 ? Math.round(targetHpInput!) : null;
  return {
    series: [],
    buckets: [],
    axisMaxDamage: 0,
    maxProbability: 0,
    maxProbabilityLabel: "0.0%",
    middleProbabilityLabel: "0.0%",
    targetHp,
    targetHpLabel: targetHp == null ? null : `Full target HP ${targetHp}`,
    targetMarkerPercent: null,
    koRegionStartPercent: null
  };
}

function hitDistributionPoint(
  bucket: HitDistributionBucketViewModel | undefined,
  maxProbability: number
): HitDistributionComparisonPointViewModel {
  const probability = bucket?.probability ?? 0;
  return {
    probability,
    percentLabel: bucket?.percentLabel ?? "0.0%",
    cumulativeAtLeast: bucket?.cumulativeAtLeast ?? 0,
    cumulativeAtLeastLabel: bucket?.cumulativeAtLeastLabel ?? "0.0%",
    heightPercent: maxProbability > 0 ? (probability / maxProbability) * 100 : 0,
    isMaxHit: bucket?.isMaxHit ?? false
  };
}

function distributionExpectedMarkerPercent(averageHit: number, axisMaxDamage: number): number {
  const bucketCount = axisMaxDamage + 2;
  const boundedAverage = Math.max(0, Math.min(axisMaxDamage, averageHit));
  return ((boundedAverage + 1.5) / bucketCount) * 100;
}

function distributionKoChance(distribution: HitDistributionViewModel, targetHp: number): number {
  return distribution.buckets.reduce(
    (sum, bucket) =>
      bucket.damage != null && bucket.damage >= targetHp ? sum + bucket.probability : sum,
    0
  );
}

export function createHitDistributionComparisonViewModel(
  combat: ReturnType<typeof simulateCombat>,
  normal: HitDistributionViewModel,
  targetHpInput: number | undefined
): HitDistributionComparisonViewModel {
  const special = combat.specialAttack
    ? createHitDistributionPresentation(
        createIndependentHitDistribution(
          { hitChance: combat.specialAttack.hitChance, maxHit: combat.specialAttack.maxHit },
          combat.specialAttack.hits
        )
      )
    : null;
  const axisMaxDamage = Math.max(normal.maxHit, special?.maxHit ?? 0);
  const allProbabilities = [
    ...normal.buckets.map((bucket) => bucket.probability),
    ...(special?.buckets.map((bucket) => bucket.probability) ?? [])
  ];
  const maxProbability = Math.max(...allProbabilities, 0);
  const normalById = new Map(normal.buckets.map((bucket) => [bucket.id, bucket]));
  const specialById = new Map(special?.buckets.map((bucket) => [bucket.id, bucket]) ?? []);
  const targetHp =
    Number.isFinite(targetHpInput) && targetHpInput! > 0 ? Math.round(targetHpInput!) : null;
  const bucketInputs = [
    { id: "miss", label: "Miss", damage: null, isMiss: true, isAccurateZero: false },
    ...Array.from({ length: axisMaxDamage + 1 }, (_, damage) => ({
      id: `damage-${damage}`,
      label: `${damage}`,
      damage,
      isMiss: false,
      isAccurateZero: damage === 0
    }))
  ];
  const specialLabel = combat.specialAttack
    ? `Special: ${combat.specialAttack.weaponName} (switch)`
    : null;
  const buckets = bucketInputs.map((bucket) => {
    const normalPoint = hitDistributionPoint(normalById.get(bucket.id), maxProbability);
    const specialPoint = special
      ? hitDistributionPoint(specialById.get(bucket.id), maxProbability)
      : null;
    const outcomeLabel = bucket.isMiss
      ? "Miss"
      : bucket.isAccurateZero
        ? "Accurate zero damage"
        : `${bucket.damage} damage`;
    const normalCumulative = bucket.isMiss
      ? ""
      : `; Normal at least ${bucket.damage}: ${normalPoint.cumulativeAtLeastLabel}`;
    const specialText = specialPoint
      ? `; ${specialLabel} exact: ${specialPoint.percentLabel}${
          bucket.isMiss ? "" : `; at least ${bucket.damage}: ${specialPoint.cumulativeAtLeastLabel}`
        }`
      : "";
    const maxHitText = `${normalPoint.isMaxHit ? "; normal max hit" : ""}${
      specialPoint?.isMaxHit ? "; special max hit" : ""
    }`;
    return {
      ...bucket,
      ariaLabel: `${outcomeLabel}; Normal exact: ${normalPoint.percentLabel}${normalCumulative}${specialText}${maxHitText}`,
      normal: normalPoint,
      special: specialPoint
    };
  });
  const series: HitDistributionComparisonSeriesViewModel[] = [
    {
      id: "normal",
      label: "Normal attack",
      scopeLabel: "One normal attack",
      distribution: normal,
      expectedMarkerPercent: distributionExpectedMarkerPercent(normal.averageHit, axisMaxDamage),
      expectedDamageLabel: normal.averageHitLabel,
      koChance: targetHp == null ? 0 : distributionKoChance(normal, targetHp),
      koChanceLabel:
        targetHp == null ? "-" : `${formatNumber(distributionKoChance(normal, targetHp) * 100, 1)}%`
    },
    ...(special && specialLabel
      ? [
          {
            id: "special" as const,
            label: specialLabel,
            scopeLabel: "One complete special attack",
            distribution: special,
            expectedMarkerPercent: distributionExpectedMarkerPercent(
              special.averageHit,
              axisMaxDamage
            ),
            expectedDamageLabel: special.averageHitLabel,
            koChance: targetHp == null ? 0 : distributionKoChance(special, targetHp),
            koChanceLabel:
              targetHp == null
                ? "-"
                : `${formatNumber(distributionKoChance(special, targetHp) * 100, 1)}%`
          }
        ]
      : [])
  ];
  const bucketCount = axisMaxDamage + 2;
  const targetInRange = targetHp != null && targetHp <= axisMaxDamage;

  return {
    series,
    buckets,
    axisMaxDamage,
    maxProbability,
    maxProbabilityLabel: `${formatNumber(maxProbability * 100, 1)}%`,
    middleProbabilityLabel: `${formatNumber(maxProbability * 50, 1)}%`,
    targetHp,
    targetHpLabel: targetHp == null ? null : `Full target HP ${targetHp}`,
    targetMarkerPercent: targetInRange ? ((targetHp + 1) / bucketCount) * 100 : null,
    koRegionStartPercent: targetInRange ? ((targetHp + 1) / bucketCount) * 100 : null
  };
}

function finiteNumberOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function positiveFiniteNumberOrNull(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatOptionalNumber(value: number | null, digits = 0): string {
  return value == null ? "-" : formatNumber(value, digits);
}

function formatOptionalPercent(value: number | null): string {
  return value == null ? "-" : `${formatNumber(value * 100, 1)}%`;
}

function formatOptionalDuration(value: number | null): string {
  return value == null ? "-" : formatDuration(value);
}

function statsCombatRollMetric(
  input: StatsCombatRollMetricViewModel
): StatsCombatRollMetricViewModel {
  return input;
}

export function createStatsCombatRollDetailViewModel(input: {
  combat: ReturnType<typeof simulateCombat>;
  trip: TripLootSupplyResult;
  hitDistribution: HitDistributionViewModel;
}): StatsCombatRollDetailViewModel {
  const effectiveAccuracy = finiteNumberOrNull(input.combat.debug.effectiveAccuracy);
  const effectiveDamage = finiteNumberOrNull(input.combat.debug.effectiveDamage);
  const attackRoll = finiteNumberOrNull(input.combat.attackRoll);
  const defenceRoll = finiteNumberOrNull(input.combat.defenceRoll);
  const hitChance = finiteNumberOrNull(input.combat.hitChance);
  const maxHit = finiteNumberOrNull(input.combat.maxHit);
  const averageHit = finiteNumberOrNull(input.hitDistribution.averageHit);
  const attackSpeedSec = positiveFiniteNumberOrNull(input.combat.attackSpeedSec);
  const attackTicks = positiveFiniteNumberOrNull(input.combat.attackTicks);
  const ttkSec = positiveFiniteNumberOrNull(input.combat.ttkSec);
  const killsPerHour = positiveFiniteNumberOrNull(input.trip.killsPerHour);
  const gpPerKill = finiteNumberOrNull(input.trip.gpPerKill);

  const metrics: StatsCombatRollMetricViewModel[] = [
    statsCombatRollMetric({
      id: "effective-accuracy",
      label: "Effective accuracy",
      value: formatOptionalNumber(effectiveAccuracy),
      numericValue: effectiveAccuracy,
      note: "Normal attack roll input after level, stance, prayer, boost and accuracy bonus.",
      tone: "teal"
    }),
    statsCombatRollMetric({
      id: "effective-damage",
      label: "Effective damage",
      value: formatOptionalNumber(effectiveDamage),
      numericValue: effectiveDamage,
      note: "Normal attack damage input after level, stance, prayer, boost and damage bonus.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "attack-roll",
      label: "Attack roll",
      value: formatOptionalNumber(attackRoll),
      numericValue: attackRoll,
      note: "Normal attack roll before comparing against the active monster defence roll.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "defence-roll",
      label: "Defence roll",
      value: formatOptionalNumber(defenceRoll),
      numericValue: defenceRoll,
      note: "Monster defence roll for the current active defence type.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "hit-chance",
      label: "Hit chance",
      value: formatOptionalPercent(hitChance),
      numericValue: hitChance,
      note: "Normal attack hit probability from the current combat result.",
      tone: "teal"
    }),
    statsCombatRollMetric({
      id: "max-hit",
      label: "Max hit",
      value: formatOptionalNumber(maxHit, 1),
      numericValue: maxHit,
      note: "Normal attack max hit; special and cannon max hits are shown in source details.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "average-hit",
      label: "Average hit",
      value: formatOptionalNumber(averageHit, 2),
      numericValue: averageHit,
      note: "Normal attack average hit from the current hit distribution model.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "attack-speed",
      label: "Attack speed",
      value: attackSpeedSec == null ? "-" : `${formatNumber(attackSpeedSec, 1)} s`,
      numericValue: attackSpeedSec,
      note: "Normal attack seconds per swing.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "attack-cycle",
      label: "Attack cycle",
      value: attackTicks == null ? "-" : `${formatNumber(attackTicks, 1)} ticks`,
      numericValue: attackTicks,
      note: "Normal attack cycle in game ticks.",
      tone: "default"
    }),
    statsCombatRollMetric({
      id: "ttk",
      label: "TTK",
      value: formatOptionalDuration(ttkSec),
      numericValue: ttkSec,
      note: "Current combat result time to kill before Trip banking and scarce-spot efficiency.",
      tone: "gold"
    }),
    statsCombatRollMetric({
      id: "kills-per-hour",
      label: "Kills/hr",
      value: formatOptionalNumber(killsPerHour),
      numericValue: killsPerHour,
      note: "Current whole-result kill rate after Trip and banking effects.",
      tone: "gold"
    }),
    statsCombatRollMetric({
      id: "gp-per-kill",
      label: "GP/kill",
      value: formatOptionalNumber(gpPerKill),
      numericValue: gpPerKill,
      note: "Current loot/economy result per kill before hourly trip efficiency.",
      tone: "gold"
    })
  ];
  const hasFallback = metrics.some((metric) => metric.numericValue == null);

  return {
    status: hasFallback ? "partial" : "modeled",
    statusLabel: hasFallback ? "partial" : "modeled",
    metrics,
    notes: [
      "Roll and hit metrics describe the normal player attack.",
      "TTK, kills/hr and GP/kill mirror the current composed simulation result.",
      ...(hasFallback
        ? ["Some values are unavailable from the current result and are shown as fallbacks."]
        : [])
    ]
  };
}

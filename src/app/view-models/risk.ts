import type { DistributionSummary, RiskAnalysisParameters } from "@/domain/risk";
import { formatNumber } from "./formatting";

export type RiskControls = Pick<
  RiskAnalysisParameters,
  "targetKills" | "horizonMinutes" | "gpTarget" | "targetDropRowId"
>;

export const DEFAULT_RISK_CONTROLS: RiskControls = {
  targetKills: 50,
  horizonMinutes: 60,
  gpTarget: 100_000,
  targetDropRowId: null
};

export interface RiskTargetDropCandidate {
  rowId: string;
  name: string;
  pref: string | undefined;
  chance: number;
}

export interface RiskTargetDropOption {
  id: string;
  label: string;
}

export function createRiskTargetDropOptions(
  candidates: readonly RiskTargetDropCandidate[]
): RiskTargetDropOption[] {
  return [
    { id: "", label: "No target drop" },
    ...candidates
      .filter((candidate) => candidate.pref !== "skip" && candidate.chance > 0)
      .map((candidate) => ({ id: candidate.rowId, label: candidate.name }))
  ];
}

export function formatRiskRange(
  summary: DistributionSummary | null,
  digits: number,
  suffix = ""
): string {
  if (!summary) return "Unbounded";
  return `${formatNumber(summary.p10, digits)} / ${formatNumber(summary.p50, digits)} / ${formatNumber(summary.p90, digits)}${suffix}`;
}

export function formatRiskProbability(probability: number, zeroBoundSampleCount?: number): string {
  if (!Number.isFinite(probability)) return "Unavailable";
  if (probability === 0 && zeroBoundSampleCount && zeroBoundSampleCount > 0) {
    return `<${formatNumber((3 / zeroBoundSampleCount) * 100, 2)}%`;
  }
  if (probability > 0 && probability < 0.001) return "<0.1%";
  return `${formatNumber(probability * 100, 1)}%`;
}

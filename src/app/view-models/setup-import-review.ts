import type { CombatStyle } from "@/domain/shared";
import type { DenseCompareSortState } from "../state/dense-compare";
import type { SavedSetupState, SetupMode } from "../state/ui-state";
import type { SetupTransferContextReview } from "../state/setup-transfer-context";
import { formatNumber } from "./formatting";

interface SetupImportReviewCandidate {
  id: number;
  context: SetupTransferContextReview;
  summary: {
    targetLabel: string;
    combatStyle: CombatStyle;
    setupMode: SetupMode;
    customSetupCount: number;
    cannonMonsterCount: number;
    denseSort: DenseCompareSortState;
    irrelevantMonsterCount: number;
  };
}

export interface SetupImportReviewViewModel {
  id: number;
  rows: ReadonlyArray<{ label: string; value: string }>;
  contextTone: "ready" | "warning";
  contextMessage: string;
  consequence: string;
}

const DENSE_SORT_LABELS: Record<DenseCompareSortState["key"], string> = {
  monsterName: "Monster",
  hitChance: "Hit chance",
  maxHit: "Max hit",
  dps: "DPS",
  ttkSec: "TTK",
  killsPerHour: "Kills/hr",
  xpPerHour: "XP/hr",
  gpPerKill: "GP/kill",
  gpPerHour: "GP/hr",
  netGpPerHour: "Net GP/hr"
};

function titleCase(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function countChange(current: number, imported: number): string {
  return `${formatNumber(current)} → ${formatNumber(imported)}`;
}

function denseSortLabel(sort: DenseCompareSortState): string {
  return `${DENSE_SORT_LABELS[sort.key]}, ${sort.direction === "asc" ? "ascending" : "descending"}`;
}

export function buildSetupImportReviewViewModel(
  review: SetupImportReviewCandidate,
  current: SavedSetupState
): SetupImportReviewViewModel {
  return {
    id: review.id,
    contextTone: review.context.tone,
    contextMessage: review.context.message,
    rows: [
      { label: "Target", value: review.summary.targetLabel },
      { label: "Combat style", value: titleCase(review.summary.combatStyle) },
      { label: "Setup mode", value: titleCase(review.summary.setupMode) },
      {
        label: "Custom setups",
        value: countChange(
          Object.keys(current.customSetupsByMonster).length,
          review.summary.customSetupCount
        )
      },
      {
        label: "Cannon settings",
        value: countChange(
          Object.keys(current.cannonByMonster).length,
          review.summary.cannonMonsterCount
        )
      },
      { label: "Dense sort", value: denseSortLabel(review.summary.denseSort) },
      {
        label: "Hidden / irrelevant",
        value: countChange(
          current.denseCompare.irrelevantMonsterIds.length,
          review.summary.irrelevantMonsterCount
        )
      }
    ],
    consequence:
      "Applying replaces the active form, default form, setup mode, custom setups, Dense preferences and cannon settings."
  };
}

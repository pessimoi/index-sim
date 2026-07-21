import type { LocalStateHealthItem, LocalStateHealthReport } from "../state/local-state-health";
import type { CrossTabConflictSnapshot } from "../controllers/cross-tab-conflicts";
import { formatNumber } from "./formatting";

export type LocalStateAttentionViewModel =
  | { visible: false }
  | {
      visible: true;
      kind: "stored-data" | "persistence" | "conflict" | "mixed";
      title: string;
      message: string;
      affectedLabels: readonly string[];
      reviewLabel?: string;
    };

function isPersistenceAttention(item: LocalStateHealthItem): boolean {
  return (
    item.status === "unavailable" ||
    item.status === "save-failed" ||
    item.reason === "storage_unavailable" ||
    item.reason === "save_failed" ||
    item.reason === "clear_failed"
  );
}

function savedAreaCount(count: number): string {
  return `${formatNumber(count)} saved ${count === 1 ? "area" : "areas"}`;
}

export function buildLocalStateAttentionViewModel(
  report: LocalStateHealthReport,
  crossTab?: CrossTabConflictSnapshot
): LocalStateAttentionViewModel {
  const conflicts = crossTab?.conflicts ?? [];
  if (conflicts.length > 0) {
    const shown = conflicts.slice(0, 3).map((conflict) => conflict.label);
    const affectedLabels =
      conflicts.length > 3 ? [...shown, `${formatNumber(conflicts.length - 3)} more`] : shown;
    return {
      visible: true,
      kind: report.hasAttention ? "mixed" : "conflict",
      title: "Data changed in another tab",
      message: `${savedAreaCount(conflicts.length)} changed outside this tab. Current values remain active, but automatic saving is paused for the affected areas.`,
      affectedLabels,
      reviewLabel: "Review conflicts"
    };
  }
  if (!report.hasAttention) return { visible: false };

  const attentionItems = report.items.filter((item) => item.needsAttention);
  const hasPersistenceAttention = attentionItems.some(isPersistenceAttention);
  const hasStoredDataAttention = attentionItems.some((item) => !isPersistenceAttention(item));
  const affectedLabels =
    report.attentionCount <= 3 ? attentionItems.slice(0, 3).map((item) => item.label) : [];

  if (hasPersistenceAttention && hasStoredDataAttention) {
    return {
      visible: true,
      kind: "mixed",
      title: "Local data and saving need review",
      message: `${savedAreaCount(report.attentionCount)} could not be loaded, and current changes may not persist after reload.`,
      affectedLabels
    };
  }

  if (hasPersistenceAttention) {
    return {
      visible: true,
      kind: "persistence",
      title: "Changes may not persist",
      message:
        "Browser storage is unavailable, so current-session changes may be lost after reload.",
      affectedLabels
    };
  }

  return {
    visible: true,
    kind: "stored-data",
    title: "Local data needs review",
    message: `${savedAreaCount(report.attentionCount)} could not be loaded. Safe defaults are active.`,
    affectedLabels
  };
}

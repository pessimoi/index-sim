import type { CombatStyle } from "@/domain/shared";
import { WORKBENCH_TABS, workbenchTabLabel, type WorkbenchTabId } from "../view-models/app-shell";

export const DEFAULT_WORKBENCH_TAB: WorkbenchTabId = "compare";
export const WORKBENCH_PANE_QUERY_KEY = "pane";
export const WORKBENCH_DOCUMENT_TITLE_SUFFIX = "2004scape Combat Simulator";

const WORKBENCH_TAB_IDS = new Set<WorkbenchTabId>(WORKBENCH_TABS.map((tab) => tab.id));
const MAX_PANE_QUERY_VALUE_LENGTH = 64;

export type WorkbenchActivationSource =
  "initial-url" | "user" | "routed-action" | "history" | "internal-restore";

export type WorkbenchHistoryMutation = "none" | "push" | "replace";

export interface ParsedWorkbenchPane {
  pane: WorkbenchTabId;
  status: "missing" | "valid" | "invalid";
}

function copyUrl(input: string | URL): URL {
  return new URL(input.toString());
}

function isWorkbenchTabId(value: string): value is WorkbenchTabId {
  return (
    value.length <= MAX_PANE_QUERY_VALUE_LENGTH && WORKBENCH_TAB_IDS.has(value as WorkbenchTabId)
  );
}

export function parseWorkbenchPaneUrl(input: string | URL): ParsedWorkbenchPane {
  const url = copyUrl(input);
  const values = url.searchParams.getAll(WORKBENCH_PANE_QUERY_KEY);
  if (values.length === 0) {
    return { pane: DEFAULT_WORKBENCH_TAB, status: "missing" };
  }
  const candidate = values[0] ?? "";
  if (values.length !== 1 || !isWorkbenchTabId(candidate)) {
    return { pane: DEFAULT_WORKBENCH_TAB, status: "invalid" };
  }
  return { pane: candidate, status: "valid" };
}

export function createWorkbenchPaneUrl(input: string | URL, pane: WorkbenchTabId): string {
  const url = copyUrl(input);
  url.searchParams.delete(WORKBENCH_PANE_QUERY_KEY);
  url.searchParams.append(WORKBENCH_PANE_QUERY_KEY, pane);
  return url.toString();
}

export function removeInvalidWorkbenchPane(input: string | URL): string {
  const url = copyUrl(input);
  url.searchParams.delete(WORKBENCH_PANE_QUERY_KEY);
  return url.toString();
}

export function workbenchHistoryMutationForSource(
  source: WorkbenchActivationSource
): WorkbenchHistoryMutation {
  const mutations = {
    "initial-url": "none",
    user: "push",
    "routed-action": "push",
    history: "none",
    "internal-restore": "replace"
  } as const satisfies Record<WorkbenchActivationSource, WorkbenchHistoryMutation>;
  return mutations[source];
}

function safeTargetLabel(value: string | null | undefined): string {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 160) return "Unknown target";
  for (const character of normalized) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 32 || codePoint === 127) return "Unknown target";
  }
  return normalized;
}

export function formatWorkbenchDocumentTitle(input: {
  pane: WorkbenchTabId;
  combatStyle: CombatStyle;
  targetLabel?: string | null;
}): string {
  return `${workbenchTabLabel(input.pane, input.combatStyle)} · ${safeTargetLabel(input.targetLabel)} · ${WORKBENCH_DOCUMENT_TITLE_SUFFIX}`;
}

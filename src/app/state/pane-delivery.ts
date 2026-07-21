import type { WorkbenchTabId } from "../view-models/app-shell";

export const PANE_FAMILY_BY_TAB = {
  stats: "stats",
  loadout: "loadout",
  compare: "compare",
  duel: "duel",
  loot: "loot",
  trip: "trip",
  risk: "risk",
  cannon: "cannon",
  planner: "planner",
  economy: "economy-settings",
  settings: "economy-settings"
} as const satisfies Record<WorkbenchTabId, string>;

export type PaneFamily = (typeof PANE_FAMILY_BY_TAB)[WorkbenchTabId];
export type PaneLoadState = "not-requested" | "loading" | "ready" | "failed";

export const LAZY_PANE_FAMILIES = [
  "loadout",
  "compare",
  "duel",
  "loot",
  "trip",
  "risk",
  "cannon",
  "planner",
  "economy-settings"
] as const satisfies readonly PaneFamily[];

export function paneFamilyForTab(tabId: WorkbenchTabId): PaneFamily {
  return PANE_FAMILY_BY_TAB[tabId];
}

export function createInitialRequestedPaneFamilies(): ReadonlySet<PaneFamily> {
  return new Set<PaneFamily>(["compare"]);
}

export function requestPaneFamily(
  current: ReadonlySet<PaneFamily>,
  tabId: WorkbenchTabId
): ReadonlySet<PaneFamily> {
  const family = paneFamilyForTab(tabId);
  if (current.has(family)) return current;
  return new Set([...current, family]);
}

export function createInitialPaneLoadStates(): Record<PaneFamily, PaneLoadState> {
  return {
    stats: "ready",
    loadout: "not-requested",
    compare: "loading",
    duel: "not-requested",
    loot: "not-requested",
    trip: "not-requested",
    risk: "not-requested",
    cannon: "not-requested",
    planner: "not-requested",
    "economy-settings": "not-requested"
  };
}

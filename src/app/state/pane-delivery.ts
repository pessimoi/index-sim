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

export function createInitialRequestedPaneFamilies(
  initialTab: WorkbenchTabId = "compare"
): ReadonlySet<PaneFamily> {
  return new Set<PaneFamily>([paneFamilyForTab(initialTab)]);
}

export function requestPaneFamily(
  current: ReadonlySet<PaneFamily>,
  tabId: WorkbenchTabId
): ReadonlySet<PaneFamily> {
  const family = paneFamilyForTab(tabId);
  if (current.has(family)) return current;
  return new Set([...current, family]);
}

export function createInitialPaneLoadStates(
  initialTab: WorkbenchTabId = "compare"
): Record<PaneFamily, PaneLoadState> {
  const states: Record<PaneFamily, PaneLoadState> = {
    stats: "ready",
    loadout: "not-requested",
    compare: "not-requested",
    duel: "not-requested",
    loot: "not-requested",
    trip: "not-requested",
    risk: "not-requested",
    cannon: "not-requested",
    planner: "not-requested",
    "economy-settings": "not-requested"
  };
  const family = paneFamilyForTab(initialTab);
  if (family !== "stats") states[family] = "loading";
  return states;
}

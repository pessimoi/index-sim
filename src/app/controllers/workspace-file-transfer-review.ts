import type { PlannerPool } from "@/domain/planner";
import type { GameDataSnapshot, PriceSet } from "@/domain/shared";
import { lootPreferenceKeysForMonster } from "@/domain/trip";
import { PLANNER_GEAR_SLOTS } from "../state/planner";
import {
  duelSnapshotsCompatibilityIssues,
  savedSetupCompatibilityIssues
} from "../state/setup-compatibility";
import {
  WORKSPACE_AREA_REGISTRY,
  WORKSPACE_AREA_TRANSFER_VERSION,
  WORKSPACE_TRANSFER_AREA_IDS,
  type ParsedWorkspaceArea,
  type ParsedWorkspaceBackupV1,
  type WorkspaceAreaDataById,
  type WorkspaceLiveState,
  type WorkspaceRestoreMode,
  type WorkspaceTransferAreaId
} from "../state/workspace-backup";
import {
  compareSetupTransferContext,
  type SetupTransferContextReview
} from "../state/setup-transfer-context";

export type WorkspaceAreaReviewStatus =
  "ready" | "incompatible" | "unsupported-version" | "invalid-data";

export interface WorkspaceAreaReview {
  id: WorkspaceTransferAreaId;
  label: string;
  transferVersion: number;
  localVersion: number;
  sourceCount: number | null;
  currentCount: number;
  sourceSummary: string;
  currentSummary: string;
  status: WorkspaceAreaReviewStatus;
  compatibilityMessage: string;
  selectable: boolean;
  selectedByDefault: boolean;
  defaultMode: "replace";
  availableModes: readonly WorkspaceRestoreMode[];
}

export interface WorkspaceRestoreReview {
  id: number;
  file: {
    kind: string;
    version: number;
    exportedAt: string;
    byteSize: number;
    areaCount: number;
  };
  context: SetupTransferContextReview;
  areas: WorkspaceAreaReview[];
}

export interface WorkspaceRestoreSelectionArea {
  id: WorkspaceTransferAreaId;
  selected: boolean;
  mode: WorkspaceRestoreMode;
}

export interface WorkspaceRestoreSelectionDraft {
  reviewId: number;
  areas: WorkspaceRestoreSelectionArea[];
}

export interface WorkspacePrepareImportContext {
  gameData: GameDataSnapshot;
  liveState: WorkspaceLiveState;
  allowedPool: PlannerPool;
  priceFallback: readonly [PriceSet, "scheduled" | "bundled"];
}

function boundedLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

export function workspaceAreaValueCount<K extends WorkspaceTransferAreaId>(
  id: K,
  data: WorkspaceAreaDataById[K]
): number {
  if (id === "rewrite-setup") {
    const setup = data as WorkspaceAreaDataById["rewrite-setup"];
    return (
      1 +
      Object.keys(setup.customSetupsByMonster).length +
      Object.keys(setup.cannonByMonster).length
    );
  }
  if (id === "planner-ui") {
    const planner = data as WorkspaceAreaDataById["planner-ui"];
    return Object.values(planner.gearPool).reduce((count, ids) => count + (ids?.length ?? 0), 0);
  }
  if (id === "loot-prefs") {
    return Object.values(data as WorkspaceAreaDataById["loot-prefs"]).reduce(
      (count, prefs) => count + Object.keys(prefs).length,
      0
    );
  }
  if (id === "loot-settings") {
    return Object.keys(data as WorkspaceAreaDataById["loot-settings"]).length;
  }
  if (id === "hidden-gear-tiers") {
    return Object.values(data as WorkspaceAreaDataById["hidden-gear-tiers"]).filter(Boolean).length;
  }
  if (id === "duel-snapshots") {
    return (data as WorkspaceAreaDataById["duel-snapshots"]).snapshots.length;
  }
  if (id === "price-history") {
    return (data as WorkspaceAreaDataById["price-history"]).snapshots.length;
  }
  if (id === "selected-price-set") {
    const priceSet = data as WorkspaceAreaDataById["selected-price-set"];
    return priceSet ? Object.keys(priceSet.itemPrices).length : 0;
  }
  if (id === "manual-price-overrides") {
    return Object.keys((data as WorkspaceAreaDataById["manual-price-overrides"]).items).length;
  }
  return 1;
}

function areaSummary<K extends WorkspaceTransferAreaId>(
  id: K,
  data: WorkspaceAreaDataById[K]
): string {
  const count = workspaceAreaValueCount(id, data);
  if (id === "rewrite-setup") return `${count} active or monster-specific setup records`;
  if (id === "planner-ui") return `${count} selected Planner gear ids`;
  if (id === "loot-prefs") return `${count} saved loot choices`;
  if (id === "loot-settings") return `${count} monster settings`;
  if (id === "hidden-gear-tiers") return `${count} hidden gear tiers`;
  if (id === "duel-snapshots") return `${count} saved setups`;
  if (id === "price-history") return `${count} local price snapshots`;
  if (id === "selected-price-set") {
    const priceSet = data as WorkspaceAreaDataById["selected-price-set"];
    return priceSet
      ? `${count} item prices in ${boundedLabel(priceSet.label) || "a local PriceSet"} · source ${boundedLabel(priceSet.source)}`
      : "No local selected PriceSet";
  }
  if (id === "manual-price-overrides") return `${count} manual item prices`;
  return "Player name included; privacy confirmation required";
}

function plannerCompatibilityIssues(
  planner: WorkspaceAreaDataById["planner-ui"],
  allowedPool: PlannerPool
): number {
  let issueCount = 0;
  for (const slot of PLANNER_GEAR_SLOTS) {
    const allowed = new Set(allowedPool[slot] ?? []);
    for (const itemId of planner.gearPool[slot] ?? []) {
      if (!allowed.has(itemId)) issueCount += 1;
    }
  }
  return issueCount;
}

function lootPrefsCompatibilityIssues(
  prefs: WorkspaceAreaDataById["loot-prefs"],
  gameData: GameDataSnapshot
): number {
  let issueCount = 0;
  for (const [monsterId, monsterPrefs] of Object.entries(prefs)) {
    const monster = gameData.monsters[monsterId];
    if (!monster) {
      issueCount += 1;
      continue;
    }
    const validRows = new Set(lootPreferenceKeysForMonster(monster));
    issueCount += Object.keys(monsterPrefs).filter((rowId) => !validRows.has(rowId)).length;
  }
  return issueCount;
}

function compatibilityIssueCount(
  area: Extract<ParsedWorkspaceArea, { status: "ready" }>,
  input: WorkspacePrepareImportContext
): number {
  if (area.id === "rewrite-setup") {
    return savedSetupCompatibilityIssues(area.data, input.gameData).length;
  }
  if (area.id === "planner-ui") {
    return plannerCompatibilityIssues(area.data, input.allowedPool);
  }
  if (area.id === "loot-prefs") return lootPrefsCompatibilityIssues(area.data, input.gameData);
  if (area.id === "loot-settings") {
    return Object.keys(area.data).filter((monsterId) => !input.gameData.monsters[monsterId]).length;
  }
  if (area.id === "duel-snapshots") {
    return duelSnapshotsCompatibilityIssues(area.data, input.gameData).length;
  }
  return 0;
}

function createAreaReview(
  area: ParsedWorkspaceArea,
  input: WorkspacePrepareImportContext
): WorkspaceAreaReview {
  const registration = WORKSPACE_AREA_REGISTRY[area.id];
  const currentData = input.liveState[area.id];
  const currentCount =
    currentData === null ? 0 : workspaceAreaValueCount(area.id, currentData as never);
  const currentSummary =
    currentData === null
      ? "Not present in this session"
      : areaSummary(area.id, currentData as never);
  const base = {
    id: area.id,
    label: registration.label,
    transferVersion: area.version,
    localVersion: registration.localVersion,
    currentCount,
    currentSummary,
    defaultMode: "replace" as const,
    availableModes: registration.restoreModes
  };

  if (area.status === "unsupported-version") {
    return {
      ...base,
      sourceCount: null,
      sourceSummary: "Contents unavailable",
      status: "unsupported-version",
      compatibilityMessage: `Transfer v${area.version} is not supported; this app reads v${WORKSPACE_AREA_TRANSFER_VERSION}.`,
      selectable: false,
      selectedByDefault: false
    };
  }
  if (area.status === "invalid-data") {
    return {
      ...base,
      sourceCount: null,
      sourceSummary: "Contents unavailable",
      status: "invalid-data",
      compatibilityMessage: "This area failed validation and is unavailable.",
      selectable: false,
      selectedByDefault: false
    };
  }

  const issueCount = compatibilityIssueCount(area, input);
  return {
    ...base,
    sourceCount: workspaceAreaValueCount(area.id, area.data as never),
    sourceSummary: areaSummary(area.id, area.data as never),
    status: issueCount > 0 ? "incompatible" : "ready",
    compatibilityMessage:
      issueCount > 0
        ? `${issueCount} references are unavailable in the current app data.`
        : area.id === "hiscores-last-player"
          ? "Compatible. Re-confirm privacy before restoring this player name."
          : "Compatible with the current app data.",
    selectable: issueCount === 0,
    selectedByDefault: issueCount === 0 && area.id !== "hiscores-last-player"
  };
}

export function createWorkspaceRestoreReview(
  id: number,
  parsed: ParsedWorkspaceBackupV1,
  input: WorkspacePrepareImportContext
): WorkspaceRestoreReview {
  const byId = new Map(parsed.areas.map((area) => [area.id, area]));
  return {
    id,
    file: {
      kind: parsed.kind,
      version: parsed.version,
      exportedAt: parsed.exportedAt,
      byteSize: parsed.byteSize,
      areaCount: parsed.areas.length
    },
    context: compareSetupTransferContext(parsed.context, input.gameData),
    areas: WORKSPACE_TRANSFER_AREA_IDS.flatMap((areaId) => {
      const area = byId.get(areaId);
      return area ? [createAreaReview(area, input)] : [];
    })
  };
}

export function createDefaultWorkspaceRestoreSelection(
  review: WorkspaceRestoreReview
): WorkspaceRestoreSelectionDraft {
  return {
    reviewId: review.id,
    areas: review.areas.map((area) => ({
      id: area.id,
      selected: area.selectedByDefault,
      mode: "replace"
    }))
  };
}

import { withGeneratedAlchAuthority } from "@/adapters/generated/price-fallback";
import type { PriceSet } from "@/domain/shared";
import { mergeDuelSnapshots, type DuelSnapshotsState } from "../state/duel-snapshots";
import { HiddenGearTiersStateSchema } from "../state/hidden-gear-tiers";
import { mergeLootPrefsState } from "../state/loot-prefs";
import { LootSettingsByMonsterSchema } from "../state/loot-settings";
import {
  applyManualPriceOverrides,
  MANUAL_PRICE_OVERRIDES_MAX_ITEMS,
  ManualPriceOverridesStateSchema,
  type ManualPriceOverridesState
} from "../state/manual-price-overrides";
import {
  BrowserPriceHistoryStateSchema,
  PRICE_HISTORY_MAX_SNAPSHOTS,
  priceHistorySnapshotKey,
  type BrowserPriceHistorySnapshot,
  type BrowserPriceHistoryState
} from "../state/price-history";
import { reconcilePlannerProgressWithLevels } from "../state/planner";
import {
  type ParsedWorkspaceBackupV1,
  type WorkspaceAreaDataById,
  type WorkspaceRestoreMode,
  type WorkspaceTransferAreaId
} from "../state/workspace-backup";
import {
  createDefaultWorkspaceRestoreSelection,
  createWorkspaceRestoreReview,
  workspaceAreaValueCount,
  type WorkspacePrepareImportContext,
  type WorkspaceRestoreReview,
  type WorkspaceRestoreSelectionDraft
} from "./workspace-file-transfer-review";

export interface WorkspaceAreaEffectCounts {
  sourceCount: number;
  currentCount: number;
  resultCount: number;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  replacedCount: number;
  retainedCount: number;
  droppedCount: number;
  clearedCount: number;
}

export type WorkspaceRestoreAreaPlanStatus = "ready" | "unavailable" | "invalid";

export interface WorkspaceRestoreAreaPreview {
  id: WorkspaceTransferAreaId;
  selected: boolean;
  mode: WorkspaceRestoreMode;
  status: WorkspaceRestoreAreaPlanStatus;
  effect: WorkspaceAreaEffectCounts | null;
  effectSummary: string;
  validationMessage: string | null;
}

export type WorkspaceAreaPersistencePlan<K extends WorkspaceTransferAreaId> =
  { intent: "write"; value: WorkspaceAreaDataById[K] } | { intent: "clear"; value: null };

export type WorkspaceRestoreSelectedAreaPlan = {
  [K in WorkspaceTransferAreaId]: {
    id: K;
    mode: WorkspaceRestoreMode;
    nextLiveValue: WorkspaceAreaDataById[K];
    persistence: WorkspaceAreaPersistencePlan<K>;
    effect: WorkspaceAreaEffectCounts;
  };
}[WorkspaceTransferAreaId];

export interface WorkspaceRestorePriceComposition {
  selectedPriceSet: PriceSet | null;
  basePriceSet: PriceSet;
  activePriceSet: PriceSet;
  activePriceSetOrigin: "selected" | "scheduled" | "bundled";
  manualPriceOverrides: ManualPriceOverridesState;
  historyAppendCount: 0;
}

export function composeWorkspaceRestorePrices(input: {
  liveState: Pick<WorkspaceAreaDataById, "selected-price-set" | "manual-price-overrides">;
  gameData: WorkspacePrepareImportContext["gameData"];
  priceFallback: WorkspacePrepareImportContext["priceFallback"];
}): WorkspaceRestorePriceComposition {
  const selectedPriceSet = input.liveState["selected-price-set"];
  const basePriceSet = selectedPriceSet
    ? withGeneratedAlchAuthority(selectedPriceSet, input.gameData)
    : withGeneratedAlchAuthority(input.priceFallback[0], input.gameData);
  const manualPriceOverrides = input.liveState["manual-price-overrides"];
  return {
    selectedPriceSet,
    basePriceSet,
    activePriceSet: applyManualPriceOverrides(basePriceSet, manualPriceOverrides),
    activePriceSetOrigin: selectedPriceSet ? "selected" : input.priceFallback[1],
    manualPriceOverrides,
    historyAppendCount: 0
  };
}

export interface WorkspaceRestorePlan {
  reviewId: number;
  status: "ready" | "empty" | "invalid";
  canApply: boolean;
  validationMessage: string;
  selectedIds: WorkspaceTransferAreaId[];
  selectedAreaCount: number;
  changedAreaCount: number;
  clearedAreaCount: number;
  areas: WorkspaceRestoreAreaPreview[];
  selectedAreas: WorkspaceRestoreSelectedAreaPlan[];
  priceComposition: WorkspaceRestorePriceComposition | null;
}

export interface WorkspaceRestorePlanBuildInput {
  reviewId: number;
  parsed: ParsedWorkspaceBackupV1;
  selection: WorkspaceRestoreSelectionDraft;
  context: WorkspacePrepareImportContext;
}

export interface WorkspaceRestorePlanBuildResult {
  review: WorkspaceRestoreReview;
  plan: WorkspaceRestorePlan;
}

export interface WorkspaceRestorePreparedPlan extends WorkspaceRestorePlanBuildResult {
  selection: WorkspaceRestoreSelectionDraft;
}

export type WorkspaceRestorePlanAction =
  | { kind: "selected"; areaId: WorkspaceTransferAreaId; selected: boolean }
  | { kind: "mode"; areaId: WorkspaceTransferAreaId; mode: WorkspaceRestoreMode }
  | { kind: "revalidate" };

export function updateWorkspaceRestoreSelectionDraft(
  review: WorkspaceRestoreReview,
  selection: WorkspaceRestoreSelectionDraft,
  action: WorkspaceRestorePlanAction
): WorkspaceRestoreSelectionDraft | null {
  if (action.kind === "revalidate") return selection;
  const reviewArea = review.areas.find((area) => area.id === action.areaId);
  if (!reviewArea) return null;
  if (action.kind === "selected" && action.selected && !reviewArea.selectable) return null;
  if (action.kind === "mode" && !reviewArea.availableModes.includes(action.mode)) return null;
  return {
    reviewId: review.id,
    areas: selection.areas.map((area) =>
      area.id !== action.areaId
        ? area
        : action.kind === "selected"
          ? { ...area, selected: action.selected }
          : { ...area, mode: action.mode }
    )
  };
}

export function prepareWorkspaceRestorePlan(
  reviewId: number,
  parsed: ParsedWorkspaceBackupV1,
  context: WorkspacePrepareImportContext
): WorkspaceRestorePreparedPlan {
  const review = createWorkspaceRestoreReview(reviewId, parsed, context);
  const selection = createDefaultWorkspaceRestoreSelection(review);
  return {
    ...createWorkspaceRestorePlan({ reviewId, parsed, selection, context }),
    selection
  };
}

export interface WorkspaceRestorePlanUpdateInput {
  reviewId: number;
  parsed: ParsedWorkspaceBackupV1;
  review: WorkspaceRestoreReview;
  selection: WorkspaceRestoreSelectionDraft;
  action: WorkspaceRestorePlanAction;
  context: WorkspacePrepareImportContext;
}

export function updateWorkspaceRestorePlan(
  input: WorkspaceRestorePlanUpdateInput
): WorkspaceRestorePreparedPlan | null {
  try {
    const selection = updateWorkspaceRestoreSelectionDraft(
      input.review,
      input.selection,
      input.action
    );
    if (!selection) return null;
    return {
      ...createWorkspaceRestorePlan({
        reviewId: input.reviewId,
        parsed: input.parsed,
        selection,
        context: input.context
      }),
      selection
    };
  } catch {
    return null;
  }
}

export interface WorkspaceRestorePlanSession {
  initial: WorkspaceRestorePreparedPlan;
  update(
    action: WorkspaceRestorePlanAction,
    context: WorkspacePrepareImportContext
  ): WorkspaceRestorePreparedPlan | null;
}

export function createWorkspaceRestorePlanSession(
  reviewId: number,
  parsed: ParsedWorkspaceBackupV1,
  context: WorkspacePrepareImportContext
): WorkspaceRestorePlanSession {
  const initial = prepareWorkspaceRestorePlan(reviewId, parsed, context);
  let review = initial.review;
  let selection = initial.selection;
  return {
    initial,
    update: (action, nextContext) => {
      const next = updateWorkspaceRestorePlan({
        reviewId,
        parsed,
        review,
        selection,
        action,
        context: nextContext
      });
      if (next) {
        review = next.review;
        selection = next.selection;
      }
      return next;
    }
  };
}

interface CalculatedArea<K extends WorkspaceTransferAreaId = WorkspaceTransferAreaId> {
  id: K;
  nextValue: WorkspaceAreaDataById[K];
  effect: WorkspaceAreaEffectCounts;
  invalidMessage: string | null;
}

function canonicalJson(value: unknown): string {
  const normalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(normalize);
    if (candidate === null || typeof candidate !== "object") return candidate;
    return Object.fromEntries(
      Object.entries(candidate as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)])
    );
  };
  return JSON.stringify(normalize(value));
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function identityMap(
  id: WorkspaceTransferAreaId,
  value: WorkspaceAreaDataById[WorkspaceTransferAreaId]
): Map<string, unknown> {
  if (id === "rewrite-setup") {
    const setup = value as WorkspaceAreaDataById["rewrite-setup"];
    const identities = new Map<string, unknown>();
    identities.set("active", {
      form: setup.form,
      defaultForm: setup.defaultForm,
      setupMode: setup.setupMode,
      denseCompare: setup.denseCompare
    });
    for (const [monsterId, form] of Object.entries(setup.customSetupsByMonster)) {
      identities.set(`custom:${monsterId}`, form);
    }
    for (const [monsterId, cannon] of Object.entries(setup.cannonByMonster)) {
      identities.set(`cannon:${monsterId}`, cannon);
    }
    return identities;
  }
  if (id === "planner-ui") {
    const planner = value as WorkspaceAreaDataById["planner-ui"];
    const gearPool = planner.gearPool as Record<string, readonly string[] | undefined>;
    return new Map<string, unknown>(
      Object.entries(gearPool).flatMap(([slot, itemIds]) =>
        (itemIds ?? []).map((itemId: string) => [`${slot}:${itemId}`, itemId] as const)
      )
    );
  }
  if (id === "loot-prefs") {
    const prefs = value as WorkspaceAreaDataById["loot-prefs"];
    return new Map(
      Object.entries(prefs).flatMap(([monsterId, rows]) =>
        Object.entries(rows).map(([rowId, action]) => [`${monsterId}:${rowId}`, action] as const)
      )
    );
  }
  if (id === "loot-settings") {
    return new Map(Object.entries(value as WorkspaceAreaDataById["loot-settings"]));
  }
  if (id === "hidden-gear-tiers") {
    return new Map(
      Object.entries(value as WorkspaceAreaDataById["hidden-gear-tiers"])
        .filter(([, hidden]) => hidden)
        .map(([tierId]) => [tierId, true])
    );
  }
  if (id === "duel-snapshots") {
    const state = value as WorkspaceAreaDataById["duel-snapshots"];
    return new Map(state.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  }
  if (id === "price-history") {
    const state = value as WorkspaceAreaDataById["price-history"];
    return new Map(
      state.snapshots.map((snapshot) => [priceHistorySnapshotKey(snapshot), snapshot])
    );
  }
  if (id === "selected-price-set") {
    const priceSet = value as WorkspaceAreaDataById["selected-price-set"];
    return new Map(Object.entries(priceSet?.itemPrices ?? {}));
  }
  if (id === "manual-price-overrides") {
    return new Map(
      Object.entries((value as WorkspaceAreaDataById["manual-price-overrides"]).items)
    );
  }
  return value === null ? new Map() : new Map([["player", value]]);
}

function genericEffect(input: {
  id: WorkspaceTransferAreaId;
  mode: WorkspaceRestoreMode;
  source: WorkspaceAreaDataById[WorkspaceTransferAreaId];
  current: WorkspaceAreaDataById[WorkspaceTransferAreaId] | null;
  result: WorkspaceAreaDataById[WorkspaceTransferAreaId];
  persistenceClears?: boolean;
}): WorkspaceAreaEffectCounts {
  const sourceMap = identityMap(input.id, input.source);
  const currentMap =
    input.current === null ? new Map<string, unknown>() : identityMap(input.id, input.current);
  const resultMap = identityMap(input.id, input.result);
  const sourceOnly = [...sourceMap.keys()].filter((key) => !currentMap.has(key));
  const collisions = [...sourceMap.keys()].filter((key) => currentMap.has(key));
  const currentOnly = [...currentMap.keys()].filter((key) => !sourceMap.has(key));
  const wholeValueChanged = !valuesEqual(input.current, input.result);
  const plannerOrSetup = input.id === "rewrite-setup" || input.id === "planner-ui";

  return {
    sourceCount: workspaceAreaValueCount(input.id, input.source as never),
    currentCount:
      input.current === null ? 0 : workspaceAreaValueCount(input.id, input.current as never),
    resultCount: workspaceAreaValueCount(input.id, input.result as never),
    addedCount: sourceOnly.filter((key) => resultMap.has(key)).length,
    updatedCount:
      collisions.length > 0
        ? collisions.filter((key) => resultMap.has(key)).length
        : plannerOrSetup && wholeValueChanged
          ? 1
          : 0,
    skippedCount: 0,
    replacedCount: 0,
    retainedCount:
      input.mode === "merge" ? currentOnly.filter((key) => resultMap.has(key)).length : 0,
    droppedCount: [...currentMap.keys()].filter((key) => !resultMap.has(key)).length,
    clearedCount: input.persistenceClears && wholeValueChanged ? 1 : 0
  };
}

function mergePriceHistory(
  current: BrowserPriceHistoryState,
  source: BrowserPriceHistoryState
): { state: BrowserPriceHistoryState; effect: WorkspaceAreaEffectCounts } {
  const currentByKey = new Map(
    current.snapshots.map((snapshot) => [priceHistorySnapshotKey(snapshot), snapshot])
  );
  const sourceByKey = new Map(
    source.snapshots.map((snapshot) => [priceHistorySnapshotKey(snapshot), snapshot])
  );
  const combined = new Map<string, BrowserPriceHistorySnapshot>(currentByKey);
  for (const [key, snapshot] of sourceByKey) combined.set(key, snapshot);
  const snapshots = [...combined.values()]
    .sort((left, right) => {
      const byTime = Date.parse(right.capturedAt) - Date.parse(left.capturedAt);
      return byTime || priceHistorySnapshotKey(left).localeCompare(priceHistorySnapshotKey(right));
    })
    .slice(0, PRICE_HISTORY_MAX_SNAPSHOTS);
  const state = BrowserPriceHistoryStateSchema.parse({ snapshots });
  const resultKeys = new Set(state.snapshots.map(priceHistorySnapshotKey));
  const collisions = [...sourceByKey.keys()].filter((key) => currentByKey.has(key));
  const sourceOnly = [...sourceByKey.keys()].filter((key) => !currentByKey.has(key));
  const currentOnly = [...currentByKey.keys()].filter((key) => !sourceByKey.has(key));
  return {
    state,
    effect: {
      sourceCount: source.snapshots.length,
      currentCount: current.snapshots.length,
      resultCount: state.snapshots.length,
      addedCount: sourceOnly.filter((key) => resultKeys.has(key)).length,
      updatedCount: 0,
      skippedCount: 0,
      replacedCount: collisions.filter((key) => resultKeys.has(key)).length,
      retainedCount: currentOnly.filter((key) => resultKeys.has(key)).length,
      droppedCount: combined.size - state.snapshots.length,
      clearedCount: 0
    }
  };
}

function calculateArea(
  id: WorkspaceTransferAreaId,
  mode: WorkspaceRestoreMode,
  source: WorkspaceAreaDataById[WorkspaceTransferAreaId],
  current: WorkspaceAreaDataById[WorkspaceTransferAreaId] | null,
  context: WorkspacePrepareImportContext
): CalculatedArea {
  let nextValue: WorkspaceAreaDataById[WorkspaceTransferAreaId] = source;
  let effect: WorkspaceAreaEffectCounts | null = null;
  let invalidMessage: string | null = null;

  if (id === "selected-price-set") {
    nextValue =
      source === null ? null : withGeneratedAlchAuthority(source as PriceSet, context.gameData);
  } else if (mode === "merge" && id === "loot-prefs") {
    nextValue = mergeLootPrefsState(
      current as WorkspaceAreaDataById["loot-prefs"],
      source as WorkspaceAreaDataById["loot-prefs"]
    );
  } else if (mode === "merge" && id === "loot-settings") {
    nextValue = LootSettingsByMonsterSchema.parse({
      ...(current as WorkspaceAreaDataById["loot-settings"]),
      ...(source as WorkspaceAreaDataById["loot-settings"])
    });
  } else if (mode === "merge" && id === "hidden-gear-tiers") {
    nextValue = HiddenGearTiersStateSchema.parse({
      ...(current as WorkspaceAreaDataById["hidden-gear-tiers"]),
      ...(source as WorkspaceAreaDataById["hidden-gear-tiers"])
    });
  } else if (mode === "merge" && id === "duel-snapshots") {
    const merged = mergeDuelSnapshots(current as DuelSnapshotsState, source as DuelSnapshotsState);
    nextValue = merged.state;
    effect = {
      ...genericEffect({ id, mode, source, current, result: nextValue }),
      addedCount: merged.addedCount,
      updatedCount: merged.updatedCount,
      skippedCount: merged.skippedCount
    };
  } else if (mode === "merge" && id === "price-history") {
    const merged = mergePriceHistory(
      current as BrowserPriceHistoryState,
      source as BrowserPriceHistoryState
    );
    nextValue = merged.state;
    effect = merged.effect;
  } else if (mode === "merge" && id === "manual-price-overrides") {
    const items = {
      ...(current as ManualPriceOverridesState).items,
      ...(source as ManualPriceOverridesState).items
    };
    if (Object.keys(items).length > MANUAL_PRICE_OVERRIDES_MAX_ITEMS) {
      invalidMessage = `Merge would exceed the ${MANUAL_PRICE_OVERRIDES_MAX_ITEMS}-item manual-price limit. Choose Replace or deselect this area.`;
      nextValue = current as ManualPriceOverridesState;
    } else {
      nextValue = ManualPriceOverridesStateSchema.parse({ items });
    }
  }

  const persistenceClears =
    (id === "selected-price-set" && nextValue === null) ||
    (id === "manual-price-overrides" &&
      Object.keys((nextValue as ManualPriceOverridesState).items).length === 0);
  effect ??= genericEffect({ id, mode, source, current, result: nextValue, persistenceClears });
  return { id, nextValue, effect, invalidMessage } as CalculatedArea;
}

function persistencePlan<K extends WorkspaceTransferAreaId>(
  id: K,
  value: WorkspaceAreaDataById[K]
): WorkspaceAreaPersistencePlan<K> {
  if (id === "selected-price-set" && value === null) return { intent: "clear", value: null };
  if (
    id === "manual-price-overrides" &&
    Object.keys((value as WorkspaceAreaDataById["manual-price-overrides"]).items).length === 0
  ) {
    return { intent: "clear", value: null };
  }
  return { intent: "write", value };
}

export function workspaceAreaEffectSummary(effect: WorkspaceAreaEffectCounts): string {
  const parts = [
    `result ${effect.resultCount}`,
    `added ${effect.addedCount}`,
    `updated ${effect.updatedCount}`,
    `replaced ${effect.replacedCount}`,
    `retained ${effect.retainedCount}`,
    `skipped ${effect.skippedCount}`,
    `dropped ${effect.droppedCount}`
  ];
  if (effect.clearedCount > 0) parts.push("clear target 1");
  return parts.join(" · ");
}

function emptyPlan(
  reviewId: number,
  areas: WorkspaceRestoreAreaPreview[],
  status: "empty" | "invalid",
  validationMessage: string
): WorkspaceRestorePlan {
  return {
    reviewId,
    status,
    canApply: false,
    validationMessage,
    selectedIds: [],
    selectedAreaCount: 0,
    changedAreaCount: 0,
    clearedAreaCount: 0,
    areas,
    selectedAreas: [],
    priceComposition: null
  };
}

export function createWorkspaceRestorePlan(
  input: WorkspaceRestorePlanBuildInput
): WorkspaceRestorePlanBuildResult {
  const review = createWorkspaceRestoreReview(input.reviewId, input.parsed, input.context);
  const selectionById = new Map<
    WorkspaceTransferAreaId,
    { selected: boolean; mode: WorkspaceRestoreMode }
  >();
  let selectionShapeInvalid = input.selection.reviewId !== input.reviewId;
  for (const area of input.selection.areas) {
    if (selectionById.has(area.id)) selectionShapeInvalid = true;
    selectionById.set(area.id, { selected: area.selected, mode: area.mode });
  }
  if (
    selectionById.size !== review.areas.length ||
    review.areas.some((area) => !selectionById.has(area.id))
  ) {
    selectionShapeInvalid = true;
  }

  const parsedById = new Map(input.parsed.areas.map((area) => [area.id, area]));
  const calculatedById = new Map<WorkspaceTransferAreaId, CalculatedArea>();
  const previews: WorkspaceRestoreAreaPreview[] = [];
  let selectedCount = 0;
  let selectedInvalid = selectionShapeInvalid;

  for (const area of review.areas) {
    const choice = selectionById.get(area.id) ?? { selected: false, mode: "replace" as const };
    const parsedArea = parsedById.get(area.id);
    if (choice.selected) selectedCount += 1;
    const modeAvailable = area.availableModes.includes(choice.mode);
    if (!parsedArea || parsedArea.status !== "ready" || !area.selectable) {
      if (choice.selected) selectedInvalid = true;
      previews.push({
        id: area.id,
        selected: choice.selected,
        mode: choice.mode,
        status: "unavailable",
        effect: null,
        effectSummary: "No restore outcome available",
        validationMessage: area.compatibilityMessage
      });
      continue;
    }
    if (!modeAvailable) {
      if (choice.selected) selectedInvalid = true;
      previews.push({
        id: area.id,
        selected: choice.selected,
        mode: choice.mode,
        status: "invalid",
        effect: null,
        effectSummary: "Unsupported restore mode",
        validationMessage: "This area does not support the selected restore mode."
      });
      continue;
    }

    const calculated = calculateArea(
      area.id,
      choice.mode,
      parsedArea.data as WorkspaceAreaDataById[WorkspaceTransferAreaId],
      input.context.liveState[area.id] as WorkspaceAreaDataById[WorkspaceTransferAreaId] | null,
      input.context
    );
    calculatedById.set(area.id, calculated);
    if (calculated.invalidMessage && choice.selected) selectedInvalid = true;
    previews.push({
      id: area.id,
      selected: choice.selected,
      mode: choice.mode,
      status: calculated.invalidMessage ? "invalid" : "ready",
      effect: calculated.effect,
      effectSummary: workspaceAreaEffectSummary(calculated.effect),
      validationMessage: calculated.invalidMessage
    });
  }

  if (selectionShapeInvalid) {
    return {
      review,
      plan: emptyPlan(
        input.reviewId,
        previews,
        "invalid",
        "Restore selection is stale or incomplete. Review the file again."
      )
    };
  }
  if (selectedCount === 0) {
    return {
      review,
      plan: emptyPlan(
        input.reviewId,
        previews,
        "empty",
        "Select at least one compatible area to prepare a restore plan."
      )
    };
  }
  if (selectedInvalid) {
    return {
      review,
      plan: {
        ...emptyPlan(
          input.reviewId,
          previews,
          "invalid",
          "One or more selected areas cannot be restored. Change the selection or mode."
        ),
        selectedIds: previews.filter((area) => area.selected).map((area) => area.id),
        selectedAreaCount: selectedCount
      }
    };
  }

  const selectedAreas: WorkspaceRestoreSelectedAreaPlan[] = [];
  for (const preview of previews) {
    if (!preview.selected) continue;
    const calculated = calculatedById.get(preview.id);
    if (!calculated || calculated.invalidMessage) continue;
    selectedAreas.push({
      id: preview.id,
      mode: preview.mode,
      nextLiveValue: calculated.nextValue,
      persistence: persistencePlan(preview.id, calculated.nextValue),
      effect: calculated.effect
    } as WorkspaceRestoreSelectedAreaPlan);
  }

  const plannerAreaIndex = selectedAreas.findIndex((area) => area.id === "planner-ui");
  if (plannerAreaIndex >= 0) {
    const selectedSetup = selectedAreas.find((area) => area.id === "rewrite-setup");
    const resultingSetup = selectedSetup
      ? (selectedSetup.nextLiveValue as WorkspaceAreaDataById["rewrite-setup"])
      : input.context.liveState["rewrite-setup"];
    const plannerArea = selectedAreas[plannerAreaIndex] as Extract<
      WorkspaceRestoreSelectedAreaPlan,
      { id: "planner-ui" }
    >;
    const reconciledPlanner = reconcilePlannerProgressWithLevels(
      plannerArea.nextLiveValue,
      resultingSetup.form.levels
    ).state;
    if (!valuesEqual(reconciledPlanner, plannerArea.nextLiveValue)) {
      const parsedPlanner = parsedById.get("planner-ui");
      if (!parsedPlanner || parsedPlanner.status !== "ready") {
        throw new Error("validated Workspace Planner area is unavailable");
      }
      const sourcePlanner = parsedPlanner.data as WorkspaceAreaDataById["planner-ui"];
      const effect = genericEffect({
        id: "planner-ui",
        mode: plannerArea.mode,
        source: sourcePlanner,
        current: input.context.liveState["planner-ui"],
        result: reconciledPlanner
      });
      selectedAreas[plannerAreaIndex] = {
        ...plannerArea,
        nextLiveValue: reconciledPlanner,
        persistence: persistencePlan("planner-ui", reconciledPlanner),
        effect
      };
      const previewIndex = previews.findIndex((area) => area.id === "planner-ui");
      previews[previewIndex] = {
        ...previews[previewIndex]!,
        effect,
        effectSummary: workspaceAreaEffectSummary(effect)
      };
    }
  }

  const selectedById = new Map(selectedAreas.map((area) => [area.id, area]));
  const selectedPriceArea = selectedById.get("selected-price-set");
  const manualArea = selectedById.get("manual-price-overrides");
  const priceComposition = composeWorkspaceRestorePrices({
    liveState: {
      "selected-price-set": selectedPriceArea
        ? (selectedPriceArea.nextLiveValue as PriceSet | null)
        : input.context.liveState["selected-price-set"],
      "manual-price-overrides": manualArea
        ? (manualArea.nextLiveValue as ManualPriceOverridesState)
        : input.context.liveState["manual-price-overrides"]
    },
    gameData: input.context.gameData,
    priceFallback: input.context.priceFallback
  });
  const changedAreaCount = selectedAreas.filter(
    (area) => !valuesEqual(input.context.liveState[area.id], area.nextLiveValue)
  ).length;
  const clearedAreaCount = selectedAreas.filter(
    (area) => area.persistence.intent === "clear"
  ).length;

  return {
    review,
    plan: {
      reviewId: input.reviewId,
      status: "ready",
      canApply: true,
      validationMessage: `${selectedAreas.length} selected areas are fully validated. No changes have been applied.`,
      selectedIds: selectedAreas.map((area) => area.id),
      selectedAreaCount: selectedAreas.length,
      changedAreaCount,
      clearedAreaCount,
      areas: previews,
      selectedAreas,
      priceComposition
    }
  };
}

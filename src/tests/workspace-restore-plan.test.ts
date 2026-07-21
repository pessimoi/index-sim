import { generatedItemValues } from "../adapters/generated/price-fallback";
import { createGeneratedRuntimeContext } from "../adapters/generated";
import { createBrowserStorageAccess } from "../app/application-recovery";
import {
  WorkspaceFileTransferControllerCore,
  type WorkspaceFileTransferDependencies
} from "../app/controllers/workspace-file-transfer";
import {
  createDefaultWorkspaceRestoreSelection,
  createWorkspaceRestoreReview,
  type WorkspacePrepareImportContext,
  type WorkspaceRestoreSelectionDraft
} from "../app/controllers/workspace-file-transfer-review";
import { createWorkspaceRestorePlan } from "../app/controllers/workspace-restore-plan";
import { createDuelSnapshot } from "../app/state/duel-snapshots";
import { MANUAL_PRICE_OVERRIDES_MAX_ITEMS } from "../app/state/manual-price-overrides";
import { DEFAULT_PLANNER_UI_STATE } from "../app/state/planner";
import {
  BrowserPriceHistorySnapshotSchema,
  PRICE_HISTORY_MAX_SNAPSHOTS,
  createPriceHistorySnapshot,
  priceHistorySnapshotKey,
  type BrowserPriceHistorySnapshot,
  type BrowserPriceHistoryState
} from "../app/state/price-history";
import {
  DEFAULT_FORM_STATE,
  savedSetupFromForm,
  type SavedSetupState
} from "../app/state/ui-state";
import {
  WORKSPACE_REQUIRED_AREA_IDS,
  createWorkspaceBackupExport,
  parseWorkspaceBackupText,
  type ParsedWorkspaceBackupV1,
  type WorkspaceAreaDataById,
  type WorkspaceLiveState,
  type WorkspaceRestoreMode,
  type WorkspaceTransferAreaId
} from "../app/state/workspace-backup";
import { lootPreferenceKeysForMonster } from "../domain/trip";
import { plannerAllowedPool } from "../app/view-models/planner";

const runtime = createGeneratedRuntimeContext().context;
const fixedNow = new Date("2026-07-19T17:00:00.000Z");
const monsterId = DEFAULT_FORM_STATE.monsterId;
const monster = runtime.gameData.monsters[monsterId]!;
const lootRowIds = lootPreferenceKeysForMonster(monster);
const firstLootRowId = lootRowIds[0]!;
const secondLootRowId = lootRowIds[1] ?? lootRowIds[0]!;
const fallbackPriceSet = runtime.priceSet;
const manualItemId = Object.keys(fallbackPriceSet.itemPrices).find(
  (itemId) => runtime.gameData.items[itemId]?.alch !== undefined
)!;

function sourcePriceSet() {
  return {
    ...fallbackPriceSet,
    id: "workspace-source-prices",
    label: "Workspace source prices",
    source: "imported" as const,
    createdAt: "2026-07-19T16:00:00.000Z",
    itemPrices: {
      ...fallbackPriceSet.itemPrices,
      [manualItemId]: 321
    },
    alchValues: { [manualItemId]: 999_999 }
  };
}

function sourceSetup(): SavedSetupState {
  return savedSetupFromForm({
    ...DEFAULT_FORM_STATE,
    levels: { ...DEFAULT_FORM_STATE.levels, attack: 55 }
  });
}

function historySnapshot(
  index: number,
  capturedAt = new Date(Date.UTC(2026, 6, 19, 10, 0, index)).toISOString(),
  sourcePriceSetId = `history-${index}`,
  label = `History ${index}`
): BrowserPriceHistorySnapshot {
  const snapshot = createPriceHistorySnapshot(
    { ...fallbackPriceSet, id: sourcePriceSetId, label },
    new Date(capturedAt)
  );
  return BrowserPriceHistorySnapshotSchema.parse(snapshot);
}

function sourceLiveState(player = "Restore Hero"): WorkspaceLiveState {
  const pool = plannerAllowedPool(DEFAULT_FORM_STATE.combatStyle, runtime);
  const weaponId = pool.weapon?.[0];
  return {
    "rewrite-setup": sourceSetup(),
    "planner-ui": {
      ...DEFAULT_PLANNER_UI_STATE,
      metric: "gph",
      gearPool: weaponId ? { weapon: [weaponId] } : {}
    },
    "loot-prefs": { [monsterId]: { [firstLootRowId]: "skip" } },
    "loot-settings": {
      [monsterId]: { highAlch: true, overheadSec: 12, talismanSpot: "overground" }
    },
    "hidden-gear-tiers": { bronze: true },
    "duel-snapshots": {
      snapshots: [createDuelSnapshot("shared-duel", "Backup duel", DEFAULT_FORM_STATE)]
    },
    "price-history": { snapshots: [historySnapshot(1)] },
    "selected-price-set": sourcePriceSet(),
    "manual-price-overrides": {
      items: { [manualItemId]: { price: 777, updatedAt: fixedNow.toISOString() } }
    },
    "hiscores-last-player": { player }
  };
}

function currentLiveState(): WorkspaceLiveState {
  return {
    "rewrite-setup": savedSetupFromForm(DEFAULT_FORM_STATE),
    "planner-ui": DEFAULT_PLANNER_UI_STATE,
    "loot-prefs": { [monsterId]: { [firstLootRowId]: "loot", [secondLootRowId]: "bury" } },
    "loot-settings": {
      [monsterId]: { highAlch: false, overheadSec: 2, talismanSpot: "underground" }
    },
    "hidden-gear-tiers": { iron: true },
    "duel-snapshots": {
      snapshots: [createDuelSnapshot("shared-duel", "Current duel", DEFAULT_FORM_STATE)]
    },
    "price-history": { snapshots: [historySnapshot(2)] },
    "selected-price-set": null,
    "manual-price-overrides": {
      items: { current_only: { price: 42, updatedAt: fixedNow.toISOString() } }
    },
    "hiscores-last-player": null
  };
}

function prepareContext(current = currentLiveState()): WorkspacePrepareImportContext {
  return {
    gameData: runtime.gameData,
    liveState: current,
    allowedPool: plannerAllowedPool(DEFAULT_FORM_STATE.combatStyle, runtime),
    priceFallback: [fallbackPriceSet, "bundled"]
  };
}

function parsed(source = sourceLiveState(), includeHiscores = true): ParsedWorkspaceBackupV1 {
  return parseWorkspaceBackupText(
    createWorkspaceBackupExport({
      gameData: runtime.gameData,
      liveState: source,
      storageAccess: createBrowserStorageAccess(),
      includeLastHiscoresPlayer: includeHiscores,
      now: fixedNow
    }).text
  );
}

function selectionFor(
  backup: ParsedWorkspaceBackupV1,
  context: WorkspacePrepareImportContext,
  choices: Partial<
    Record<WorkspaceTransferAreaId, { selected: boolean; mode: WorkspaceRestoreMode }>
  > = {}
): WorkspaceRestoreSelectionDraft {
  const review = createWorkspaceRestoreReview(1, backup, context);
  const selection = createDefaultWorkspaceRestoreSelection(review);
  return {
    ...selection,
    areas: selection.areas.map((area) => ({ ...area, ...(choices[area.id] ?? {}) }))
  };
}

function only(
  backup: ParsedWorkspaceBackupV1,
  context: WorkspacePrepareImportContext,
  id: WorkspaceTransferAreaId,
  mode: WorkspaceRestoreMode = "replace"
): WorkspaceRestoreSelectionDraft {
  const selection = selectionFor(backup, context);
  return {
    ...selection,
    areas: selection.areas.map((area) => ({
      ...area,
      selected: area.id === id,
      mode: area.id === id ? mode : area.mode
    }))
  };
}

function build(
  backup: ParsedWorkspaceBackupV1,
  context: WorkspacePrepareImportContext,
  selection: WorkspaceRestoreSelectionDraft
) {
  return createWorkspaceRestorePlan({ reviewId: 1, parsed: backup, selection, context });
}

function plannedValue<K extends WorkspaceTransferAreaId>(
  result: ReturnType<typeof build>,
  id: K
): WorkspaceAreaDataById[K] {
  const area = result.plan.selectedAreas.find((candidate) => candidate.id === id);
  if (!area) throw new Error(`Missing selected area ${id}`);
  return area.nextLiveValue as WorkspaceAreaDataById[K];
}

describe("Workspace restore planning", () => {
  it("prevalidates every Replace area with exact next values and no mutation", () => {
    const source = sourceLiveState();
    const current = currentLiveState();
    const before = structuredClone(current);
    const backup = parsed(source, true);
    const context = prepareContext(current);
    const selection = selectionFor(backup, context, {
      "hiscores-last-player": { selected: true, mode: "replace" }
    });
    const result = build(backup, context, selection);

    expect(result.plan).toMatchObject({
      status: "ready",
      canApply: true,
      selectedAreaCount: 10
    });
    expect(result.plan.selectedIds).toEqual([
      ...WORKSPACE_REQUIRED_AREA_IDS,
      "hiscores-last-player"
    ]);
    for (const id of WORKSPACE_REQUIRED_AREA_IDS) {
      expect(plannedValue(result, id)).toBeDefined();
      if (id !== "selected-price-set") {
        expect(plannedValue(result, id)).toEqual(source[id]);
      }
    }
    expect(plannedValue(result, "hiscores-last-player")).toEqual({ player: "Restore Hero" });
    expect(plannedValue(result, "selected-price-set")?.alchValues).toEqual(
      generatedItemValues(runtime.gameData, "alch")
    );
    expect(result.plan.selectedAreas.every((area) => area.mode === "replace")).toBe(true);
    expect(current).toEqual(before);
  });

  it("reconciles the planned Planner value against the resulting setup before persistence", () => {
    const source = sourceLiveState();
    source["rewrite-setup"] = savedSetupFromForm({
      ...DEFAULT_FORM_STATE,
      levels: { ...DEFAULT_FORM_STATE.levels, attack: 66 }
    });
    source["planner-ui"] = {
      ...DEFAULT_PLANNER_UI_STATE,
      targetLevels: { ...DEFAULT_PLANNER_UI_STATE.targetLevels, attack: 62 }
    };
    const current = currentLiveState();
    const backup = parsed(source);
    const context = prepareContext(current);
    const result = build(backup, context, selectionFor(backup, context));
    const plannerArea = result.plan.selectedAreas.find((area) => area.id === "planner-ui");

    expect(plannedValue(result, "planner-ui").targetLevels.attack).toBe(66);
    expect(plannerArea?.persistence).toMatchObject({
      intent: "write",
      value: { targetLevels: { attack: 66 } }
    });
  });

  it("merges Loot preferences by monster and row with backup collision authority", () => {
    const source = sourceLiveState();
    source["loot-prefs"] = {
      [monsterId]: { [firstLootRowId]: "skip" }
    };
    const current = currentLiveState();
    const backup = parsed(source);
    const result = build(
      backup,
      prepareContext(current),
      only(backup, prepareContext(current), "loot-prefs", "merge")
    );
    const next = plannedValue(result, "loot-prefs");

    expect(next[monsterId]?.[firstLootRowId]).toBe("skip");
    expect(next[monsterId]?.[secondLootRowId]).toBe("bury");
    expect(result.plan.areas.find((area) => area.id === "loot-prefs")?.effect).toMatchObject({
      updatedCount: 1,
      retainedCount: firstLootRowId === secondLootRowId ? 0 : 1,
      skippedCount: 0
    });
  });

  it("merges complete Loot settings records and retains unrelated monsters", () => {
    const source = sourceLiveState();
    const otherMonsterId = Object.keys(runtime.gameData.monsters).find((id) => id !== monsterId)!;
    const current = currentLiveState();
    current["loot-settings"][otherMonsterId] = {
      overheadSec: 8,
      talismanSpot: "underground"
    };
    const backup = parsed(source);
    const result = build(
      backup,
      prepareContext(current),
      only(backup, prepareContext(current), "loot-settings", "merge")
    );
    const next = plannedValue(result, "loot-settings");

    expect(next[monsterId]).toEqual(source["loot-settings"][monsterId]);
    expect(next[otherMonsterId]).toEqual(current["loot-settings"][otherMonsterId]);
    expect(result.plan.areas.find((area) => area.id === "loot-settings")?.effect).toMatchObject({
      updatedCount: 1,
      retainedCount: 1
    });
  });

  it("merges hidden tiers as a union so only Replace can unhide", () => {
    const source = sourceLiveState();
    const current = currentLiveState();
    const backup = parsed(source);
    const merge = build(
      backup,
      prepareContext(current),
      only(backup, prepareContext(current), "hidden-gear-tiers", "merge")
    );
    const replace = build(
      backup,
      prepareContext(current),
      only(backup, prepareContext(current), "hidden-gear-tiers", "replace")
    );

    expect(plannedValue(merge, "hidden-gear-tiers")).toEqual({ bronze: true, iron: true });
    expect(plannedValue(replace, "hidden-gear-tiers")).toEqual({ bronze: true });
  });

  it("reuses Duel merge add/update/skip behavior at the 12-row cap", () => {
    const source = sourceLiveState();
    source["duel-snapshots"] = {
      snapshots: [
        createDuelSnapshot("shared-duel", "Backup collision", DEFAULT_FORM_STATE),
        createDuelSnapshot("new-duel-1", "New 1", DEFAULT_FORM_STATE),
        createDuelSnapshot("new-duel-2", "New 2", DEFAULT_FORM_STATE)
      ]
    };
    const current = currentLiveState();
    current["duel-snapshots"] = {
      snapshots: [
        createDuelSnapshot("shared-duel", "Current collision", DEFAULT_FORM_STATE),
        ...Array.from({ length: 10 }, (_, index) =>
          createDuelSnapshot(`current-${index}`, `Current ${index}`, DEFAULT_FORM_STATE)
        )
      ]
    };
    const backup = parsed(source);
    const result = build(
      backup,
      prepareContext(current),
      only(backup, prepareContext(current), "duel-snapshots", "merge")
    );
    const next = plannedValue(result, "duel-snapshots");

    expect(next.snapshots).toHaveLength(12);
    expect(next.snapshots.find((snapshot) => snapshot.id === "shared-duel")?.name).toBe(
      "Backup collision"
    );
    expect(result.plan.areas.find((area) => area.id === "duel-snapshots")?.effect).toMatchObject({
      addedCount: 1,
      updatedCount: 1,
      skippedCount: 1
    });
  });

  it("deduplicates history by key, lets backup win, sorts newest first and reports cap drops", () => {
    const collision = historySnapshot(
      100,
      "2026-07-19T12:00:00.000Z",
      "collision",
      "Current collision"
    );
    const current: BrowserPriceHistoryState = {
      snapshots: [
        collision,
        ...Array.from({ length: PRICE_HISTORY_MAX_SNAPSHOTS - 1 }, (_, index) =>
          historySnapshot(index, new Date(Date.UTC(2026, 6, 18, 0, 0, index)).toISOString())
        )
      ]
    };
    const source = sourceLiveState();
    source["price-history"] = {
      snapshots: [
        BrowserPriceHistorySnapshotSchema.parse({ ...collision, label: "Backup collision" }),
        historySnapshot(201, "2026-07-19T14:00:00.000Z", "newest-a"),
        historySnapshot(202, "2026-07-19T13:00:00.000Z", "newest-b")
      ]
    };
    const live = currentLiveState();
    live["price-history"] = current;
    const backup = parsed(source);
    const result = build(
      backup,
      prepareContext(live),
      only(backup, prepareContext(live), "price-history", "merge")
    );
    const next = plannedValue(result, "price-history");
    const collisionNext = next.snapshots.find(
      (snapshot) => priceHistorySnapshotKey(snapshot) === priceHistorySnapshotKey(collision)
    );

    expect(next.snapshots).toHaveLength(PRICE_HISTORY_MAX_SNAPSHOTS);
    expect(next.snapshots.slice(0, 2).map((snapshot) => snapshot.sourcePriceSetId)).toEqual([
      "newest-a",
      "newest-b"
    ]);
    expect(collisionNext?.label).toBe("Backup collision");
    expect(result.plan.areas.find((area) => area.id === "price-history")?.effect).toMatchObject({
      addedCount: 2,
      replacedCount: 1,
      retainedCount: 17,
      droppedCount: 2
    });
  });

  it("merges manual prices with backup wins and rejects an over-512 result without dropping ids", () => {
    const source = sourceLiveState();
    const current = currentLiveState();
    current["manual-price-overrides"] = {
      items: {
        [manualItemId]: { price: 1, updatedAt: fixedNow.toISOString() },
        current_only: { price: 2, updatedAt: fixedNow.toISOString() }
      }
    };
    const backup = parsed(source);
    const merged = build(
      backup,
      prepareContext(current),
      only(backup, prepareContext(current), "manual-price-overrides", "merge")
    );
    expect(plannedValue(merged, "manual-price-overrides").items).toMatchObject({
      [manualItemId]: { price: 777 },
      current_only: { price: 2 }
    });

    const manyCurrent = currentLiveState();
    manyCurrent["manual-price-overrides"] = {
      items: Object.fromEntries(
        Array.from({ length: MANUAL_PRICE_OVERRIDES_MAX_ITEMS }, (_, index) => [
          `current_${index}`,
          { price: index, updatedAt: fixedNow.toISOString() }
        ])
      )
    };
    const invalid = build(
      backup,
      prepareContext(manyCurrent),
      only(backup, prepareContext(manyCurrent), "manual-price-overrides", "merge")
    );
    expect(invalid.plan).toMatchObject({ status: "invalid", canApply: false, selectedAreas: [] });
    expect(invalid.plan.areas.find((area) => area.id === "manual-price-overrides")).toMatchObject({
      status: "invalid",
      validationMessage: expect.stringContaining("512-item")
    });
  });

  it("rejects Merge for all four Replace-only areas", () => {
    const backup = parsed(sourceLiveState(), true);
    const context = prepareContext();
    for (const id of [
      "rewrite-setup",
      "planner-ui",
      "selected-price-set",
      "hiscores-last-player"
    ] as const) {
      const result = build(backup, context, only(backup, context, id, "merge"));
      expect(result.plan).toMatchObject({ status: "invalid", canApply: false });
      expect(result.plan.areas.find((area) => area.id === id)).toMatchObject({
        status: "invalid",
        effectSummary: "Unsupported restore mode"
      });
    }
  });

  it("keeps selected PriceSet, manual overlay and history separate with null fallback and generated alch", () => {
    const source = sourceLiveState();
    source["selected-price-set"] = null;
    source["manual-price-overrides"] = {
      items: { [manualItemId]: { price: 888, updatedAt: fixedNow.toISOString() } }
    };
    const backup = parsed(source);
    const context = prepareContext();
    const selection = selectionFor(backup, context);
    const result = build(backup, context, selection);

    expect(plannedValue(result, "selected-price-set")).toBeNull();
    expect(
      result.plan.selectedAreas.find((area) => area.id === "selected-price-set")?.persistence
    ).toEqual({ intent: "clear", value: null });
    expect(result.plan.priceComposition).toMatchObject({
      selectedPriceSet: null,
      basePriceSet: { id: fallbackPriceSet.id },
      activePriceSetOrigin: "bundled",
      historyAppendCount: 0,
      manualPriceOverrides: source["manual-price-overrides"]
    });
    expect(result.plan.priceComposition?.activePriceSet.itemPrices[manualItemId]).toBe(888);
    expect(result.plan.priceComposition?.activePriceSet.alchValues).toEqual(
      generatedItemValues(runtime.gameData, "alch")
    );
    expect(plannedValue(result, "price-history")).toEqual(source["price-history"]);
  });

  it("disables authority for zero selection and keeps Hiscores as a separate privacy opt-in", () => {
    const backup = parsed(sourceLiveState(), true);
    const context = prepareContext();
    const defaults = selectionFor(backup, context);
    expect(defaults.areas.find((area) => area.id === "hiscores-last-player")?.selected).toBe(false);
    const empty = build(backup, context, {
      ...defaults,
      areas: defaults.areas.map((area) => ({ ...area, selected: false }))
    });
    expect(empty.plan).toMatchObject({
      status: "empty",
      canApply: false,
      selectedAreaCount: 0,
      selectedAreas: []
    });
    const hiscores = build(backup, context, only(backup, context, "hiscores-last-player"));
    expect(hiscores.plan).toMatchObject({
      status: "ready",
      selectedIds: ["hiscores-last-player"]
    });
    expect(JSON.stringify(hiscores.plan.areas)).not.toContain("Restore Hero");
  });

  it("revalidates exact/same/different Revision context and blocks setup, Duel, Planner and Loot incompatibility", () => {
    const source = sourceLiveState();
    const exported = createWorkspaceBackupExport({
      gameData: runtime.gameData,
      liveState: source,
      storageAccess: createBrowserStorageAccess(),
      now: fixedNow
    }).envelope;
    const sameRevision = parseWorkspaceBackupText(
      JSON.stringify({
        ...exported,
        context: { ...exported.context, gameDataId: "same-revision-other-snapshot" }
      })
    );
    const differentRevision = parseWorkspaceBackupText(
      JSON.stringify({ ...exported, context: { gameDataId: "older", gameRevision: 273 } })
    );
    const context = prepareContext();
    expect(
      build(parsed(source), context, selectionFor(parsed(source), context)).review.context.match
    ).toBe("exact-snapshot");
    expect(
      build(sameRevision, context, selectionFor(sameRevision, context)).review.context.match
    ).toBe("same-revision");
    expect(
      build(differentRevision, context, selectionFor(differentRevision, context)).review.context
        .match
    ).toBe("different-revision");

    const incompatibleFile = structuredClone(exported);
    const area = <K extends WorkspaceTransferAreaId>(id: K) =>
      incompatibleFile.areas.find((candidate) => candidate.id === id)! as {
        id: K;
        version: 1;
        data: WorkspaceAreaDataById[K];
      };
    area("rewrite-setup").data.form.monsterId = "removed_monster";
    area("duel-snapshots").data.snapshots[0]!.form.monsterId = "removed_monster";
    area("planner-ui").data.gearPool = { weapon: ["removed_weapon"] };
    area("loot-prefs").data = { [monsterId]: { removed_row: "loot" } };
    area("loot-settings").data = {
      removed_monster: { overheadSec: null, talismanSpot: "underground" }
    };
    const incompatible = parseWorkspaceBackupText(JSON.stringify(incompatibleFile));
    const review = createWorkspaceRestoreReview(1, incompatible, context);
    for (const id of [
      "rewrite-setup",
      "duel-snapshots",
      "planner-ui",
      "loot-prefs",
      "loot-settings"
    ] as const) {
      expect(review.areas.find((candidate) => candidate.id === id)).toMatchObject({
        status: "incompatible",
        selectable: false,
        selectedByDefault: false
      });
    }
  });

  it("rejects stale controller review ids and programmatic Replace-only Merge", async () => {
    interface TestFile {
      text: string;
    }
    const dependencies: WorkspaceFileTransferDependencies<TestFile> = {
      readFileText: async (file) => file.text,
      downloadJsonFile: (fileName) => ({ status: "requested", fileName, byteLength: 1 }),
      now: () => fixedNow
    };
    const controller = new WorkspaceFileTransferControllerCore(dependencies);
    const source = sourceLiveState();
    const text = createWorkspaceBackupExport({
      gameData: runtime.gameData,
      liveState: source,
      storageAccess: createBrowserStorageAccess(),
      now: fixedNow
    }).text;
    const context = prepareContext();
    await controller.prepareImport({ text }, context);

    expect(
      controller.updateRestorePlan(
        99,
        { kind: "selected", areaId: "loot-prefs", selected: false },
        context
      )
    ).toEqual({
      status: "stale"
    });
    expect(
      controller.updateRestorePlan(
        1,
        { kind: "mode", areaId: "rewrite-setup", mode: "merge" },
        context
      )
    ).toEqual({ status: "rejected" });
    expect(
      controller.getSnapshot().selection?.areas.find((area) => area.id === "rewrite-setup")
    ).toMatchObject({ selected: true, mode: "replace" });

    const revalidated = controller.updateRestorePlan(
      1,
      { kind: "revalidate" },
      { ...context, allowedPool: {} }
    );
    expect(revalidated).toMatchObject({
      status: "updated",
      plan: { status: "invalid", canApply: false, selectedAreas: [] }
    });
    expect(
      controller.getSnapshot().review?.areas.find((area) => area.id === "planner-ui")
    ).toMatchObject({ status: "incompatible", selectable: false });
  });
});

import { createGeneratedRuntimeContext } from "../adapters/generated";
import { createBrowserStorageAccess } from "../app/application-recovery";
import { createMemoryStorage } from "../adapters/storage";
import {
  WorkspaceFileTransferControllerCore,
  describeWorkspaceFileTransferError,
  type WorkspaceFileTransferDependencies
} from "../app/controllers/workspace-file-transfer";
import type {
  WorkspaceRestoreExecutionInput,
  WorkspaceRestoreLiveOutcome
} from "../app/controllers/workspace-restore-executor";
import { createDefaultWorkspaceRestoreSelection } from "../app/controllers/workspace-file-transfer-review";
import { DEFAULT_DUEL_SNAPSHOTS_STATE } from "../app/state/duel-snapshots";
import { DEFAULT_HIDDEN_GEAR_TIERS_STATE } from "../app/state/hidden-gear-tiers";
import { DEFAULT_LOOT_PREFS_STATE } from "../app/state/loot-prefs";
import { DEFAULT_LOOT_SETTINGS_STATE } from "../app/state/loot-settings";
import { DEFAULT_MANUAL_PRICE_OVERRIDES_STATE } from "../app/state/manual-price-overrides";
import { DEFAULT_PLANNER_UI_STATE } from "../app/state/planner";
import { DEFAULT_PRICE_HISTORY_STATE } from "../app/state/price-history";
import { DEFAULT_FORM_STATE, savedSetupFromForm } from "../app/state/ui-state";
import {
  WORKSPACE_BACKUP_IMPORT_MAX_BYTES,
  createWorkspaceBackupExport,
  type WorkspaceLiveState
} from "../app/state/workspace-backup";
import { plannerAllowedPool } from "../app/view-models/planner";

interface TestFile {
  id: string;
  text: string;
}

const FIXED_NOW = new Date("2026-07-19T16:45:00.000Z");
const context = createGeneratedRuntimeContext().context;

function liveState(): WorkspaceLiveState {
  return {
    "rewrite-setup": savedSetupFromForm(DEFAULT_FORM_STATE),
    "planner-ui": DEFAULT_PLANNER_UI_STATE,
    "loot-prefs": DEFAULT_LOOT_PREFS_STATE,
    "loot-settings": DEFAULT_LOOT_SETTINGS_STATE,
    "hidden-gear-tiers": DEFAULT_HIDDEN_GEAR_TIERS_STATE,
    "duel-snapshots": DEFAULT_DUEL_SNAPSHOTS_STATE,
    "price-history": DEFAULT_PRICE_HISTORY_STATE,
    "selected-price-set": null,
    "manual-price-overrides": DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
    "hiscores-last-player": { player: "Private Hero" }
  };
}

function exportText(includeLastHiscoresPlayer = false): string {
  return createWorkspaceBackupExport({
    gameData: context.gameData,
    liveState: liveState(),
    storageAccess: createBrowserStorageAccess(),
    includeLastHiscoresPlayer,
    now: FIXED_NOW
  }).text;
}

function importContext(currentLiveState = liveState()) {
  return {
    gameData: context.gameData,
    liveState: currentLiveState,
    allowedPool: plannerAllowedPool(DEFAULT_FORM_STATE.combatStyle, context),
    priceFallback: [context.priceSet, "bundled"] as const
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function controller(overrides: Partial<WorkspaceFileTransferDependencies<TestFile>> = {}) {
  const downloads: Array<{ fileName: string; value: unknown }> = [];
  const dependencies: WorkspaceFileTransferDependencies<TestFile> = {
    readFileText: vi.fn(async (file) => file.text),
    downloadJsonFile: vi.fn((fileName, value) => {
      downloads.push({ fileName, value });
      return { status: "requested" as const, fileName, byteLength: JSON.stringify(value).length };
    }),
    now: () => FIXED_NOW,
    ...overrides
  };
  return {
    core: new WorkspaceFileTransferControllerCore(dependencies),
    dependencies,
    downloads
  };
}

function restoreExecution(
  current: { live: WorkspaceLiveState },
  overrides: Partial<WorkspaceRestoreExecutionInput> = {}
): WorkspaceRestoreExecutionInput {
  return {
    storageAccess: {
      storage: createMemoryStorage(),
      storageUnavailable: false,
      savedDataIgnoredForSession: false
    },
    persistenceUnavailable: false,
    context: importContext(current.live),
    applyLiveState: (outcome: WorkspaceRestoreLiveOutcome) => {
      current.live = outcome.liveState;
    },
    recovery: {
      canStartDurableWrite: vi.fn(() => true),
      prepareExternalApply: vi.fn(),
      cancelExternalApply: vi.fn(),
      completeExternalApply: vi.fn(),
      completeExternalUndo: vi.fn(),
      recordExternalApplyFailure: vi.fn(),
      markPersistenceUnavailable: vi.fn()
    },
    now: () => FIXED_NOW,
    ...overrides
  };
}

describe("Workspace file-transfer controller", () => {
  it("exports nine canonical areas by default and adds Hiscores only after session opt-in", () => {
    const harness = controller();
    expect(harness.core.getSnapshot()).toEqual({
      phase: "idle",
      includeLastHiscoresPlayer: false,
      notice: null,
      review: null
    });

    expect(
      harness.core.exportWorkspace({
        gameData: context.gameData,
        liveState: liveState(),
        storageAccess: createBrowserStorageAccess()
      })
    ).toMatchObject({
      status: "requested",
      includedAreaIds: [
        "rewrite-setup",
        "planner-ui",
        "loot-prefs",
        "loot-settings",
        "hidden-gear-tiers",
        "duel-snapshots",
        "price-history",
        "selected-price-set",
        "manual-price-overrides"
      ]
    });
    expect(JSON.stringify(harness.downloads[0]?.value)).not.toContain("Private Hero");
    expect((harness.downloads[0]?.value as { areas: unknown[] }).areas).toHaveLength(9);

    harness.core.setIncludeLastHiscoresPlayer(true);
    const sensitiveOutcome = harness.core.exportWorkspace({
      gameData: context.gameData,
      liveState: liveState(),
      storageAccess: createBrowserStorageAccess()
    });
    expect(sensitiveOutcome).toMatchObject({
      status: "requested",
      includedAreaIds: expect.arrayContaining(["hiscores-last-player"])
    });
    expect(harness.downloads[1]?.fileName).toBe(
      "2004scape-workspace-backup-rev-274-20260719T164500Z.json"
    );
    expect((harness.downloads[1]?.value as { areas: unknown[] }).areas).toHaveLength(10);
    expect(JSON.stringify(harness.downloads[1]?.value)).toContain("Private Hero");
    expect(harness.core.getSnapshot()).toMatchObject({
      includeLastHiscoresPlayer: true,
      notice: {
        tone: "neutral",
        message:
          "Workspace backup download started: 2004scape-workspace-backup-rev-274-20260719T164500Z.json. Check your browser downloads."
      }
    });
  });

  it("reports a fixed Workspace request failure without changing export scope", () => {
    const harness = controller({
      downloadJsonFile: () => ({ status: "failed", reason: "dispatch" })
    });
    harness.core.setIncludeLastHiscoresPlayer(true);

    const outcome = harness.core.exportWorkspace({
      gameData: context.gameData,
      liveState: liveState(),
      storageAccess: createBrowserStorageAccess()
    });

    expect(outcome).toEqual({
      status: "failed",
      appStatus: "Workspace backup download could not be started. Try again.",
      notice: {
        tone: "error",
        message: "Workspace backup download could not be started. Try again."
      }
    });
    expect(harness.core.getSnapshot()).toMatchObject({
      includeLastHiscoresPlayer: true,
      phase: "idle",
      review: null,
      notice: outcome.notice
    });
  });

  it("prepares a zero-mutation nine-area review with exact context and Replace defaults", async () => {
    const current = liveState();
    const before = structuredClone(current);
    const harness = controller();
    const outcome = await harness.core.prepareImport(
      { id: "exact", text: exportText() },
      importContext(current)
    );

    expect(outcome).toEqual({ status: "review", reviewId: 1 });
    expect(current).toEqual(before);
    expect(harness.dependencies.readFileText).toHaveBeenCalledWith(
      expect.objectContaining({ id: "exact" }),
      WORKSPACE_BACKUP_IMPORT_MAX_BYTES
    );
    const review = harness.core.getSnapshot().review!;
    expect(review.file).toMatchObject({
      kind: "index-sim-workspace",
      version: 1,
      exportedAt: FIXED_NOW.toISOString(),
      areaCount: 9
    });
    expect(review.context).toMatchObject({ match: "exact-snapshot", tone: "ready" });
    expect(review.areas).toHaveLength(9);
    expect(review.areas.every((area) => area.defaultMode === "replace")).toBe(true);
    expect(review.areas.every((area) => area.selectedByDefault)).toBe(true);
    expect(createDefaultWorkspaceRestoreSelection(review)).toEqual({
      reviewId: 1,
      areas: review.areas.map((area) => ({ id: area.id, selected: true, mode: "replace" }))
    });
    expect(harness.core.getSnapshot().selection).toEqual(
      createDefaultWorkspaceRestoreSelection(review)
    );
    expect(harness.core.getSnapshot().restorePlan).toMatchObject({
      reviewId: 1,
      status: "ready",
      canApply: true,
      selectedAreaCount: 9,
      selectedIds: expect.arrayContaining(["rewrite-setup", "manual-price-overrides"])
    });
  });

  it("shows opted-in Hiscores without disclosing the name and leaves it unselected", async () => {
    const harness = controller();
    await harness.core.prepareImport({ id: "sensitive", text: exportText(true) }, importContext());

    const review = harness.core.getSnapshot().review!;
    const hiscores = review.areas.find((area) => area.id === "hiscores-last-player");
    expect(hiscores).toMatchObject({
      sourceCount: 1,
      sourceSummary: "Player name included; privacy confirmation required",
      status: "ready",
      selectable: true,
      selectedByDefault: false,
      defaultMode: "replace"
    });
    expect(JSON.stringify(review)).not.toContain("Private Hero");
    expect(createDefaultWorkspaceRestoreSelection(review).areas.at(-1)).toEqual({
      id: "hiscores-last-player",
      selected: false,
      mode: "replace"
    });
  });

  it("keeps unsupported, malformed and entity-incompatible areas unavailable and raw-free", async () => {
    const file = JSON.parse(exportText()) as {
      areas: Array<{ id: string; version: number; data: unknown }>;
    };
    const setup = file.areas.find((area) => area.id === "rewrite-setup")!;
    setup.version = 2;
    setup.data = { secret: "unsupported private payload" };
    const hidden = file.areas.find((area) => area.id === "hidden-gear-tiers")!;
    hidden.data = { bronze: "malformed private payload" };
    const lootSettings = file.areas.find((area) => area.id === "loot-settings")!;
    lootSettings.data = {
      removed_monster: { overheadSec: null, talismanSpot: "underground" }
    };

    const harness = controller();
    await harness.core.prepareImport(
      { id: "partial", text: JSON.stringify(file) },
      importContext()
    );
    const review = harness.core.getSnapshot().review!;
    expect(review.areas.find((area) => area.id === "rewrite-setup")).toMatchObject({
      status: "unsupported-version",
      selectable: false,
      selectedByDefault: false,
      sourceCount: null
    });
    expect(review.areas.find((area) => area.id === "hidden-gear-tiers")).toMatchObject({
      status: "invalid-data",
      selectable: false,
      sourceCount: null
    });
    expect(review.areas.find((area) => area.id === "loot-settings")).toMatchObject({
      status: "incompatible",
      selectable: false,
      compatibilityMessage: "1 references are unavailable in the current app data."
    });
    expect(JSON.stringify(harness.core.getSnapshot())).not.toContain("unsupported private payload");
    expect(JSON.stringify(harness.core.getSnapshot())).not.toContain("malformed private payload");
  });

  it("uses latest-request-wins and never restores an earlier review", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const harness = controller({
      readFileText: vi.fn((file: TestFile) =>
        file.id === "first" ? first.promise : second.promise
      )
    });

    const firstOutcome = harness.core.prepareImport({ id: "first", text: "" }, importContext());
    const secondOutcome = harness.core.prepareImport({ id: "second", text: "" }, importContext());
    second.resolve(exportText());
    await expect(secondOutcome).resolves.toEqual({ status: "review", reviewId: 2 });
    first.resolve("private stale invalid body");
    await expect(firstOutcome).resolves.toEqual({ status: "stale" });
    expect(harness.core.getSnapshot()).toMatchObject({ phase: "review", review: { id: 2 } });
  });

  it("dismisses only the current candidate and preserves focus-safe session preferences", async () => {
    const harness = controller();
    harness.core.setIncludeLastHiscoresPlayer(true);
    await harness.core.prepareImport({ id: "review", text: exportText() }, importContext());
    expect(harness.core.dismissReview(999)).toBe(false);
    expect(harness.core.dismissReview(1)).toBe(true);
    expect(harness.core.getSnapshot()).toEqual({
      phase: "idle",
      includeLastHiscoresPlayer: true,
      notice: null,
      review: null,
      restoreBusy: false,
      sessionOnlyAvailable: null,
      recoveryRequired: false
    });
  });

  it("maps reader and parser failures to fixed path-free notices", async () => {
    expect(
      describeWorkspaceFileTransferError(
        new Error(`File exceeds ${WORKSPACE_BACKUP_IMPORT_MAX_BYTES} bytes at /private/player.json`)
      )
    ).toEqual({
      tone: "error",
      message: "Workspace import failed. Check the file and try again."
    });
    const harness = controller({
      readFileText: vi.fn(async () => {
        throw new Error(`File exceeds ${WORKSPACE_BACKUP_IMPORT_MAX_BYTES} bytes`);
      })
    });
    await expect(
      harness.core.prepareImport({ id: "large", text: "/Users/private/file.json" }, importContext())
    ).resolves.toEqual({ status: "rejected" });
    expect(harness.core.getSnapshot().notice).toEqual({
      tone: "error",
      message:
        "Workspace import failed: the file is too large. Choose an exported Workspace JSON under 10 MB."
    });
    expect(JSON.stringify(harness.core.getSnapshot())).not.toContain("/Users/private");
  });

  it("revalidates at Apply, consumes one candidate and rejects stale or double Apply", async () => {
    const harness = controller();
    const current = { live: liveState() };
    await harness.core.prepareImport(
      { id: "apply", text: exportText() },
      importContext(current.live)
    );

    const applied = await harness.core.applyRestore(1, restoreExecution(current));

    expect(applied).toMatchObject({ status: "applied", mode: "durable" });
    expect(harness.core.getSnapshot()).toMatchObject({
      phase: "idle",
      review: null,
      restoreBusy: false,
      sessionOnlyAvailable: null
    });
    expect(await harness.core.applyRestore(1, restoreExecution(current))).toEqual({
      status: "stale"
    });

    const staleHarness = controller();
    await staleHarness.core.prepareImport(
      { id: "stale-context", text: exportText() },
      importContext(liveState())
    );
    const staleCurrent = { live: liveState() };
    const staleContext = {
      ...importContext(staleCurrent.live),
      gameData: { ...context.gameData, monsters: {} }
    };
    const stale = await staleHarness.core.applyRestore(
      1,
      restoreExecution(staleCurrent, { context: staleContext })
    );
    expect(stale).toEqual({ status: "stale" });
    expect(staleHarness.core.getSnapshot().restorePlan).toMatchObject({
      status: "invalid",
      canApply: false,
      selectedAreas: []
    });
  });
});

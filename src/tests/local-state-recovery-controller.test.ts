import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryStorage, savePersisted, type KeyValueStorage } from "../adapters/storage";
import { LocalStateRecoveryPanel } from "../app/components/settings/local-state-recovery-panel";
import {
  LocalStateRecoveryControllerCore,
  LOCAL_STATE_PERSISTENCE_NOTICE,
  type LocalStateRecoveryDependencies
} from "../app/controllers/local-state-recovery";
import {
  HIDDEN_GEAR_TIERS_STORAGE_KEY,
  HIDDEN_GEAR_TIERS_VERSION,
  HiddenGearTiersStateSchema
} from "../app/state/hidden-gear-tiers";
import {
  DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
  MANUAL_PRICE_OVERRIDES_STORAGE_KEY,
  saveManualPriceOverrides,
  setManualPriceOverride
} from "../app/state/manual-price-overrides";
import {
  PLANNER_UI_STORAGE_KEY,
  PLANNER_UI_VERSION,
  PlannerUiStateSchema
} from "../app/state/planner";
import {
  DEFAULT_FORM_STATE,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  SavedSetupSchema,
  savedSetupFromForm
} from "../app/state/ui-state";

const FIXED_NOW = new Date("2026-07-13T12:34:56.000Z");

function persistedEnvelope(version: number, data: unknown): string {
  return JSON.stringify({
    version,
    savedAt: "2026-07-13T00:00:00.000Z",
    data
  });
}

function controller(
  storage: KeyValueStorage,
  overrides: Partial<LocalStateRecoveryDependencies> = {}
): {
  controller: LocalStateRecoveryControllerCore;
  statuses: string[];
  downloads: Array<{ fileName: string; value: unknown }>;
} {
  const statuses: string[] = [];
  const downloads: Array<{ fileName: string; value: unknown }> = [];
  return {
    controller: new LocalStateRecoveryControllerCore({
      storage,
      storageUnavailable: false,
      onStatus: (message) => statuses.push(message),
      onDownload: (fileName, value) => downloads.push({ fileName, value }),
      now: () => FIXED_NOW,
      ...overrides
    }),
    statuses,
    downloads
  };
}

function reportItem(
  recovery: LocalStateRecoveryControllerCore,
  id: string
): ReturnType<LocalStateRecoveryControllerCore["getSnapshot"]>["report"]["items"][number] {
  const item = recovery.getSnapshot().report.items.find((candidate) => candidate.id === id);
  expect(item, `Missing health item ${id}`).toBeDefined();
  if (!item) throw new Error(`Missing health item ${id}`);
  return item;
}

describe("local state recovery controller", () => {
  it("blocks initial invalid and version-mismatched state", () => {
    const storage = createMemoryStorage({
      [HIDDEN_GEAR_TIERS_STORAGE_KEY]: "{",
      [REWRITE_SETUP_STORAGE_KEY]: persistedEnvelope(999, {})
    });
    const { controller: recovery } = controller(storage);

    expect(recovery.getSnapshot().blockedIds).toEqual(
      expect.arrayContaining(["hidden-gear-tiers", "rewrite-setup"])
    );
    expect(recovery.shouldSkipPersist("hidden-gear-tiers")).toBe(true);
    expect(recovery.shouldSkipPersist("rewrite-setup")).toBe(true);
  });

  it("marks runtime-incompatible setup and Duel state invalid without changing stored data", () => {
    const storage = createMemoryStorage();
    savePersisted(
      {
        key: REWRITE_SETUP_STORAGE_KEY,
        version: REWRITE_SETUP_VERSION,
        schema: SavedSetupSchema,
        storage
      },
      savedSetupFromForm(DEFAULT_FORM_STATE)
    );
    const rawBefore = storage.getItem(REWRITE_SETUP_STORAGE_KEY);
    const { controller: recovery } = controller(storage);

    recovery.blockContextInvalid(
      ["rewrite-setup", "duel-snapshots"],
      "Saved setup data is incompatible"
    );

    expect(recovery.getSnapshot().blockedIds).toEqual(
      expect.arrayContaining(["rewrite-setup", "duel-snapshots"])
    );
    expect(reportItem(recovery, "rewrite-setup")).toMatchObject({
      status: "invalid",
      reason: "invalid_data",
      clearable: true
    });
    expect(storage.getItem(REWRITE_SETUP_STORAGE_KEY)).toBe(rawBefore);
  });

  it("clear success releases the block and consumes exactly one persistence skip", () => {
    const storage = createMemoryStorage({ [HIDDEN_GEAR_TIERS_STORAGE_KEY]: "{" });
    const { controller: recovery } = controller(storage);

    const outcome = recovery.confirmClearItem("hidden-gear-tiers");

    expect(outcome.clearedIds).toEqual(["hidden-gear-tiers"]);
    expect(storage.getItem(HIDDEN_GEAR_TIERS_STORAGE_KEY)).toBeNull();
    expect(recovery.getSnapshot().blockedIds).not.toContain("hidden-gear-tiers");
    expect(recovery.shouldSkipPersist("hidden-gear-tiers")).toBe(true);
    expect(recovery.shouldSkipPersist("hidden-gear-tiers")).toBe(false);
    expect(storage.getItem(HIDDEN_GEAR_TIERS_STORAGE_KEY)).toBeNull();
  });

  it("replacement unblocks without adding a persistence skip", () => {
    const storage = createMemoryStorage({ [HIDDEN_GEAR_TIERS_STORAGE_KEY]: "{" });
    const { controller: recovery } = controller(storage);

    recovery.unblockReplaced(["hidden-gear-tiers"]);

    expect(recovery.getSnapshot().blockedIds).not.toContain("hidden-gear-tiers");
    expect(recovery.shouldSkipPersist("hidden-gear-tiers")).toBe(false);
  });

  it("clear failure keeps the block and exposes sanitized report metadata and copy", () => {
    const backing = createMemoryStorage({ [HIDDEN_GEAR_TIERS_STORAGE_KEY]: "{" });
    const storage: KeyValueStorage = {
      getItem: backing.getItem,
      setItem: backing.setItem,
      removeItem: () => {
        throw new Error("private raw clear failure");
      }
    };
    const { controller: recovery, statuses } = controller(storage);

    const outcome = recovery.confirmClearItem("hidden-gear-tiers");
    const serializedReport = JSON.stringify(recovery.getSnapshot().report);

    expect(outcome.failedIds).toEqual(["hidden-gear-tiers"]);
    expect(recovery.getSnapshot().blockedIds).toContain("hidden-gear-tiers");
    expect(reportItem(recovery, "hidden-gear-tiers")).toMatchObject({
      status: "save-failed",
      reason: "clear_failed"
    });
    expect(outcome.message).toBe(
      "Could not clear Hidden gear tiers. Local storage is unavailable."
    );
    expect(statuses.at(-1)).toBe(outcome.message);
    expect(serializedReport).not.toContain("private raw clear failure");
  });

  it("deduplicates save failures and a successful save clears only its own failure", () => {
    const backing = createMemoryStorage();
    let failHiddenSave = true;
    const storage: KeyValueStorage = {
      getItem: backing.getItem,
      removeItem: backing.removeItem,
      setItem: (key, value) => {
        if (failHiddenSave && key === HIDDEN_GEAR_TIERS_STORAGE_KEY) {
          throw new Error("private raw save failure");
        }
        backing.setItem(key, value);
      }
    };
    const { controller: recovery } = controller(storage);
    const callerValue = { bronze: true };
    const options = {
      key: HIDDEN_GEAR_TIERS_STORAGE_KEY,
      version: HIDDEN_GEAR_TIERS_VERSION,
      schema: HiddenGearTiersStateSchema,
      storage
    };

    recovery.recordStorageFailure("planner-ui", "save_failed");
    expect(recovery.persist("hidden-gear-tiers", options, callerValue)).toBe(false);
    expect(recovery.persist("hidden-gear-tiers", options, callerValue)).toBe(false);
    expect(callerValue).toEqual({ bronze: true });
    expect(reportItem(recovery, "hidden-gear-tiers")).toMatchObject({
      status: "save-failed",
      reason: "save_failed"
    });

    failHiddenSave = false;
    expect(recovery.persist("hidden-gear-tiers", options, callerValue)).toBe(true);
    expect(reportItem(recovery, "hidden-gear-tiers").status).toBe("loaded");
    expect(reportItem(recovery, "planner-ui")).toMatchObject({
      status: "save-failed",
      reason: "save_failed"
    });
    expect(recovery.getSnapshot().notice).toBe(LOCAL_STATE_PERSISTENCE_NOTICE);
  });

  it("clear-all removes only invalid allowlisted keys", () => {
    const storage = createMemoryStorage({
      [HIDDEN_GEAR_TIERS_STORAGE_KEY]: "{",
      sim_input_v3: "legacy stays",
      "index-sim:unknown-test": "unknown stays"
    });
    savePersisted(
      {
        key: PLANNER_UI_STORAGE_KEY,
        version: PLANNER_UI_VERSION,
        schema: PlannerUiStateSchema,
        storage
      },
      PlannerUiStateSchema.parse({})
    );
    saveManualPriceOverrides(
      storage,
      setManualPriceOverride(DEFAULT_MANUAL_PRICE_OVERRIDES_STATE, "private-item", 123, FIXED_NOW)
    );
    const { controller: recovery } = controller(storage);

    const outcome = recovery.confirmClearInvalid();

    expect(outcome.clearedIds).toEqual(["hidden-gear-tiers"]);
    expect(storage.getItem(HIDDEN_GEAR_TIERS_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(PLANNER_UI_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem(MANUAL_PRICE_OVERRIDES_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem("sim_input_v3")).toBe("legacy stays");
    expect(storage.getItem("index-sim:unknown-test")).toBe("unknown stays");
  });

  it("exports a fresh metadata-only report", () => {
    const storage = createMemoryStorage();
    saveManualPriceOverrides(
      storage,
      setManualPriceOverride(
        DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
        "private-secret-item",
        987_654,
        FIXED_NOW
      )
    );
    const { controller: recovery, downloads } = controller(storage);

    recovery.exportReport();

    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.fileName).toBe(
      "index-sim-local-state-health-2026-07-13T12-34-56.000Z.json"
    );
    const serialized = JSON.stringify(downloads[0]?.value);
    expect(serialized).toContain(MANUAL_PRICE_OVERRIDES_STORAGE_KEY);
    expect(serialized).not.toContain("private-secret-item");
    expect(serialized).not.toContain("987654");
  });

  it("returns the manual-price ID needed for the caller-owned reset", () => {
    const storage = createMemoryStorage();
    saveManualPriceOverrides(
      storage,
      setManualPriceOverride(DEFAULT_MANUAL_PRICE_OVERRIDES_STATE, "item", 1, FIXED_NOW)
    );
    const { controller: recovery } = controller(storage);

    expect(recovery.confirmClearItem("manual-price-overrides").clearedIds).toEqual([
      "manual-price-overrides"
    ]);
  });

  it("keeps per-item, cancel and clear-all confirmation markup", () => {
    const storage = createMemoryStorage({ [HIDDEN_GEAR_TIERS_STORAGE_KEY]: "{" });
    const { controller: recovery } = controller(storage);
    const report = recovery.getSnapshot().report;
    const props = {
      visible: true,
      report,
      notice: null,
      onExport: () => undefined,
      onBeginClear: () => undefined,
      onCancelClear: () => undefined,
      onConfirmClearItem: () => undefined,
      onConfirmClearInvalid: () => undefined
    };

    const initialMarkup = renderToStaticMarkup(
      createElement(LocalStateRecoveryPanel, { ...props, pendingClearId: null })
    );
    const itemPendingMarkup = renderToStaticMarkup(
      createElement(LocalStateRecoveryPanel, {
        ...props,
        pendingClearId: "hidden-gear-tiers"
      })
    );
    const allPendingMarkup = renderToStaticMarkup(
      createElement(LocalStateRecoveryPanel, { ...props, pendingClearId: "invalid-all" })
    );

    expect(initialMarkup).toContain("Clear Hidden gear tiers");
    expect(initialMarkup).toContain("Clear invalid local data");
    expect(initialMarkup).toContain(
      'id="local-state-recovery-heading" tabindex="-1">Local state recovery'
    );
    expect(itemPendingMarkup).toContain("Confirm clear Hidden gear tiers");
    expect(itemPendingMarkup).toContain("Cancel");
    expect(allPendingMarkup).toContain("Confirm clear invalid local data");
    expect(allPendingMarkup).toContain("Cancel");
  });
});

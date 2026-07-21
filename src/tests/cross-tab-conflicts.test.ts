import { describe, expect, it, vi } from "vitest";
import { createMemoryStorage, type KeyValueStorage } from "@/adapters/storage";
import {
  CROSS_TAB_AREA_IDS,
  CROSS_TAB_AREA_REGISTRY,
  CrossTabConflictControllerCore
} from "../app/controllers/cross-tab-conflicts";
import { LOCAL_STATE_HEALTH_DESCRIPTORS } from "../app/state/local-state-health";
import { PLANNER_UI_VERSION, PlannerUiStateSchema } from "../app/state/planner";
import {
  DEFAULT_FORM_STATE,
  REWRITE_SETUP_VERSION,
  savedSetupFromForm
} from "../app/state/ui-state";

function envelope(version: number, data: unknown, savedAt = "2026-07-21T10:00:00.000Z") {
  return JSON.stringify({ version, savedAt, data });
}

const setupA = envelope(REWRITE_SETUP_VERSION, savedSetupFromForm(DEFAULT_FORM_STATE));
const setupB = envelope(
  REWRITE_SETUP_VERSION,
  savedSetupFromForm({
    ...DEFAULT_FORM_STATE,
    levels: { ...DEFAULT_FORM_STATE.levels, attack: 80 }
  }),
  "2026-07-21T10:01:00.000Z"
);
const setupC = envelope(
  REWRITE_SETUP_VERSION,
  savedSetupFromForm({
    ...DEFAULT_FORM_STATE,
    levels: { ...DEFAULT_FORM_STATE.levels, attack: 81 }
  }),
  "2026-07-21T10:02:00.000Z"
);
const plannerA = envelope(PLANNER_UI_VERSION, PlannerUiStateSchema.parse({}));
const plannerB = envelope(
  PLANNER_UI_VERSION,
  PlannerUiStateSchema.parse({ targetLevels: { attack: 80 } }),
  "2026-07-21T10:03:00.000Z"
);

describe("cross-tab conflict controller", () => {
  it("classifies every health descriptor explicitly and excludes only migration dismissal", () => {
    expect(CROSS_TAB_AREA_IDS).toEqual(
      LOCAL_STATE_HEALTH_DESCRIPTORS.filter(
        (descriptor) => descriptor.id !== "legacy-migration-dismissed"
      ).map((descriptor) => descriptor.id)
    );
    expect(Object.keys(CROSS_TAB_AREA_REGISTRY)).toHaveLength(10);
  });

  it("coalesces external changes without exposing raw values", () => {
    const storage = createMemoryStorage({
      [CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key]: setupA
    });
    const controller = new CrossTabConflictControllerCore(storage);
    expect(controller.initialize()).toBe(true);

    controller.handleStorageChange({
      key: CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key,
      oldValue: setupA,
      newValue: setupB
    });
    controller.handleStorageChange({
      key: CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key,
      oldValue: setupB,
      newValue: setupC
    });
    controller.handleStorageChange({ key: "index-sim:unknown", oldValue: null, newValue: "raw" });

    expect(controller.getSnapshot()).toMatchObject({
      status: "conflicted",
      conflicts: [
        {
          id: "rewrite-setup",
          label: "Rewrite setup",
          externalStatus: "valid"
        }
      ],
      notice: { affectedCount: 1 }
    });
    expect(JSON.stringify(controller.getSnapshot())).not.toContain(setupA);
    expect(JSON.stringify(controller.getSnapshot())).not.toContain(setupC);
  });

  it("detects a missed event before write and suspends only that area", () => {
    const storage = createMemoryStorage({
      [CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key]: setupA,
      [CROSS_TAB_AREA_REGISTRY["planner-ui"].key]: plannerA
    });
    const controller = new CrossTabConflictControllerCore(storage);
    controller.initialize();
    storage.setItem(CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key, setupB);

    expect(controller.checkFreshness("rewrite-setup")).toEqual({
      status: "external-conflict",
      id: "rewrite-setup"
    });
    expect(controller.isSuspended("rewrite-setup")).toBe(true);
    expect(controller.checkFreshness("planner-ui")).toEqual({ status: "ready" });
    expect(controller.isSuspended("planner-ui")).toBe(false);
  });

  it("advances the exact verified baseline and ignores its duplicate event", () => {
    const storage = createMemoryStorage({
      [CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key]: setupA
    });
    const controller = new CrossTabConflictControllerCore(storage);
    controller.initialize();
    storage.setItem(CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key, setupB);
    controller.recordVerifiedRaw("rewrite-setup", setupB);

    controller.handleStorageChange({
      key: CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key,
      oldValue: setupA,
      newValue: setupB
    });

    expect(controller.getSnapshot().status).toBe("clear");
    expect(controller.checkFreshness("rewrite-setup")).toEqual({ status: "ready" });
  });

  it("keeps invalid and unsupported external values private and unselectable", () => {
    const storage = createMemoryStorage({
      [CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key]: setupA,
      [CROSS_TAB_AREA_REGISTRY["planner-ui"].key]: plannerA
    });
    const controller = new CrossTabConflictControllerCore(storage);
    controller.initialize();
    storage.setItem(CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key, "private invalid raw");
    storage.setItem(
      CROSS_TAB_AREA_REGISTRY["planner-ui"].key,
      envelope(999, PlannerUiStateSchema.parse({}))
    );

    controller.checkFreshness("rewrite-setup");
    controller.checkFreshness("planner-ui");

    expect(controller.getSnapshot().conflicts).toEqual([
      expect.objectContaining({ id: "rewrite-setup", externalStatus: "invalid" }),
      expect.objectContaining({ id: "planner-ui", externalStatus: "unsupported" })
    ]);
    expect(controller.refreshReview(["rewrite-setup", "planner-ui"])).toEqual({
      status: "invalid",
      invalidIds: ["rewrite-setup", "planner-ui"]
    });
    expect(JSON.stringify(controller.getSnapshot())).not.toContain("private invalid raw");
  });

  it("requires a fresh review, performs an exact keep batch and guards Undo", () => {
    const storage = createMemoryStorage({
      [CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key]: setupA,
      [CROSS_TAB_AREA_REGISTRY["planner-ui"].key]: plannerA
    });
    const controller = new CrossTabConflictControllerCore(storage);
    controller.initialize();
    storage.setItem(CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key, setupB);
    storage.setItem(CROSS_TAB_AREA_REGISTRY["planner-ui"].key, plannerB);
    controller.checkFreshness("rewrite-setup");
    controller.checkFreshness("planner-ui");

    const kept = controller.keepCurrent([
      {
        id: "rewrite-setup",
        key: CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key,
        intent: "write",
        targetRaw: setupA
      },
      {
        id: "planner-ui",
        key: CROSS_TAB_AREA_REGISTRY["planner-ui"].key,
        intent: "write",
        targetRaw: plannerA
      }
    ]);

    expect(kept.status).toBe("kept");
    expect(controller.getSnapshot().status).toBe("clear");
    expect(storage.getItem(CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key)).toBe(setupA);
    if (kept.status !== "kept") throw new Error("expected keep result");

    storage.setItem(CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key, setupC);
    expect(controller.undoKeep(kept.undo)).toEqual({ status: "stale" });
    expect(storage.getItem(CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key)).toBe(setupC);
  });

  it("restores exact external preimages on guarded Undo", () => {
    const storage = createMemoryStorage({
      [CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key]: setupA
    });
    const controller = new CrossTabConflictControllerCore(storage);
    controller.initialize();
    storage.setItem(CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key, setupB);
    controller.checkFreshness("rewrite-setup");
    const kept = controller.keepCurrent([
      {
        id: "rewrite-setup",
        key: CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key,
        intent: "write",
        targetRaw: setupA
      }
    ]);
    if (kept.status !== "kept") throw new Error("expected keep result");

    expect(controller.undoKeep(kept.undo)).toEqual({ status: "undone" });
    expect(storage.getItem(CROSS_TAB_AREA_REGISTRY["rewrite-setup"].key)).toBe(setupB);
  });

  it("marks storage read failure unavailable without creating a conflict", () => {
    const storage: KeyValueStorage = {
      getItem: vi.fn(() => {
        throw new Error("private read failure");
      }),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };
    const controller = new CrossTabConflictControllerCore(storage);

    expect(controller.initialize()).toBe(false);
    expect(controller.checkFreshness("rewrite-setup")).toEqual({ status: "unavailable" });
    expect(controller.getSnapshot().conflicts).toEqual([]);
  });
});

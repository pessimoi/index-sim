import { saveLastHiscoresPlayer } from "../adapters/hiscores";
import {
  createMemoryStorage,
  loadPersisted,
  savePersisted,
  trySavePersisted,
  type KeyValueStorage
} from "../adapters/storage";
import {
  clearInvalidLocalState,
  clearLocalStateItem,
  createLocalStateHealthExport,
  createLocalStateHealthReport
} from "../app/state/local-state-health";
import {
  HIDDEN_GEAR_TIERS_STORAGE_KEY,
  HIDDEN_GEAR_TIERS_VERSION,
  HiddenGearTiersStateSchema
} from "../app/state/hidden-gear-tiers";
import { PLANNER_UI_STORAGE_KEY, PlannerUiStateSchema } from "../app/state/planner";
import { REWRITE_SETUP_STORAGE_KEY } from "../app/state/ui-state";
import { saveSelectedPriceSet } from "../app/state/selected-price-set";
import type { PriceSet } from "../domain/shared";

function persistedEnvelope(version: number, data: unknown): string {
  return JSON.stringify({
    version,
    savedAt: "2026-07-08T00:00:00.000Z",
    data
  });
}

function item(report: ReturnType<typeof createLocalStateHealthReport>, id: string) {
  const found = report.items.find((candidate) => candidate.id === id);
  expect(found, `Missing health item ${id}`).toBeDefined();
  if (!found) throw new Error(`Missing health item ${id}`);
  return found;
}

function privatePriceSet(): PriceSet {
  return {
    id: "private-price-set",
    label: "Private price payload",
    source: "manual",
    createdAt: "2026-07-08T00:00:00.000Z",
    itemPrices: { private_item_id: 123 },
    alchValues: { private_item_id: 0 }
  };
}

function throwingStorage(overrides: Partial<KeyValueStorage>): KeyValueStorage {
  const backing = createMemoryStorage({ [HIDDEN_GEAR_TIERS_STORAGE_KEY]: "{" });
  return {
    getItem: overrides.getItem ?? backing.getItem,
    setItem: overrides.setItem ?? backing.setItem,
    removeItem: overrides.removeItem ?? backing.removeItem
  };
}

describe("rewrite local state health", () => {
  it("reports missing rewrite-owned state without attention", () => {
    const report = createLocalStateHealthReport(createMemoryStorage());
    const hidden = item(report, "hidden-gear-tiers");

    expect(hidden).toMatchObject({
      status: "missing",
      loaded: false,
      defaultUsed: true,
      clearable: false,
      needsAttention: false
    });
    expect(report.hasAttention).toBe(false);
  });

  it("reports loaded rewrite-owned state with expected metadata only", () => {
    const storage = createMemoryStorage();
    savePersisted(
      {
        key: HIDDEN_GEAR_TIERS_STORAGE_KEY,
        version: HIDDEN_GEAR_TIERS_VERSION,
        schema: HiddenGearTiersStateSchema,
        storage
      },
      { bronze: true }
    );

    expect(item(createLocalStateHealthReport(storage), "hidden-gear-tiers")).toMatchObject({
      label: "Hidden gear tiers",
      storageKey: HIDDEN_GEAR_TIERS_STORAGE_KEY,
      status: "loaded",
      expectedVersion: HIDDEN_GEAR_TIERS_VERSION,
      loaded: true,
      defaultUsed: false,
      clearable: true,
      needsAttention: false
    });
  });

  it("reports invalid JSON, invalid envelope, invalid data and version mismatch", () => {
    const invalidJson = createLocalStateHealthReport(
      createMemoryStorage({ [HIDDEN_GEAR_TIERS_STORAGE_KEY]: "{" })
    );
    expect(item(invalidJson, "hidden-gear-tiers")).toMatchObject({
      status: "invalid",
      reason: "invalid_json",
      needsAttention: true
    });

    const invalidEnvelope = createLocalStateHealthReport(
      createMemoryStorage({
        [HIDDEN_GEAR_TIERS_STORAGE_KEY]: JSON.stringify({
          version: HIDDEN_GEAR_TIERS_VERSION,
          data: {}
        })
      })
    );
    expect(item(invalidEnvelope, "hidden-gear-tiers")).toMatchObject({
      status: "invalid",
      reason: "invalid_envelope",
      needsAttention: true
    });

    const invalidData = createLocalStateHealthReport(
      createMemoryStorage({
        [HIDDEN_GEAR_TIERS_STORAGE_KEY]: persistedEnvelope(HIDDEN_GEAR_TIERS_VERSION, {
          bronze: "yes"
        })
      })
    );
    expect(item(invalidData, "hidden-gear-tiers")).toMatchObject({
      status: "invalid",
      reason: "invalid_data",
      needsAttention: true
    });

    const versionMismatch = createLocalStateHealthReport(
      createMemoryStorage({
        [HIDDEN_GEAR_TIERS_STORAGE_KEY]: persistedEnvelope(999, {})
      })
    );
    expect(item(versionMismatch, "hidden-gear-tiers")).toMatchObject({
      status: "version-mismatch",
      foundVersion: 999,
      expectedVersion: HIDDEN_GEAR_TIERS_VERSION,
      needsAttention: true
    });
  });

  it("reports storage unavailable when reading local state throws without leaking raw errors", () => {
    const storage = throwingStorage({
      getItem: () => {
        throw new Error("raw secret payload from localStorage");
      }
    });

    const report = createLocalStateHealthReport(storage);
    const hidden = item(report, "hidden-gear-tiers");
    const exported = JSON.stringify(createLocalStateHealthExport(report));

    expect(hidden).toMatchObject({
      status: "unavailable",
      reason: "storage_unavailable",
      loaded: false,
      defaultUsed: true,
      clearable: false,
      needsAttention: true
    });
    expect(report.hasAttention).toBe(true);
    expect(exported).toContain("storage_unavailable");
    expect(exported).not.toContain("raw secret payload");
  });

  it("returns non-fatal read and save failure results when storage methods throw", () => {
    const readFailure = loadPersisted({
      key: HIDDEN_GEAR_TIERS_STORAGE_KEY,
      version: HIDDEN_GEAR_TIERS_VERSION,
      schema: HiddenGearTiersStateSchema,
      storage: throwingStorage({
        getItem: () => {
          throw new Error("raw getItem stack");
        }
      })
    });
    expect(readFailure).toMatchObject({ status: "unavailable", reason: "read_failed" });

    const saveFailure = trySavePersisted(
      {
        key: HIDDEN_GEAR_TIERS_STORAGE_KEY,
        version: HIDDEN_GEAR_TIERS_VERSION,
        schema: HiddenGearTiersStateSchema,
        storage: throwingStorage({
          setItem: () => {
            throw new Error("raw setItem stack");
          }
        })
      },
      { bronze: true }
    );

    expect(saveFailure).toEqual({ status: "failed", reason: "save_failed" });
  });

  it("clears one allowlisted rewrite-owned key without touching other keys", () => {
    const storage = createMemoryStorage({
      [HIDDEN_GEAR_TIERS_STORAGE_KEY]: "{",
      [REWRITE_SETUP_STORAGE_KEY]: persistedEnvelope(1, {}),
      sim_input_v3: "{}",
      "index-sim:unknown-test": "keep"
    });

    const result = clearLocalStateItem(storage, "hidden-gear-tiers");

    expect(result.clearedKeys).toEqual([HIDDEN_GEAR_TIERS_STORAGE_KEY]);
    expect(storage.getItem(HIDDEN_GEAR_TIERS_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(REWRITE_SETUP_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem("sim_input_v3")).toBe("{}");
    expect(storage.getItem("index-sim:unknown-test")).toBe("keep");
  });

  it("reports clear failure without throwing or exposing the raw storage error", () => {
    const storage = throwingStorage({
      removeItem: () => {
        throw new Error("raw removeItem stack");
      }
    });

    const result = clearLocalStateItem(storage, "hidden-gear-tiers");
    const report = createLocalStateHealthReport(storage, new Date("2026-07-08T00:00:00.000Z"), {
      storageFailures: result.failedItems.map((failed) => ({
        id: failed.item.id,
        reason: failed.reason
      }))
    });
    const exported = JSON.stringify(createLocalStateHealthExport(report));

    expect(result.clearedKeys).toEqual([]);
    expect(result.failedKeys).toEqual([HIDDEN_GEAR_TIERS_STORAGE_KEY]);
    expect(item(report, "hidden-gear-tiers")).toMatchObject({
      status: "save-failed",
      reason: "clear_failed",
      needsAttention: true
    });
    expect(exported).toContain("clear_failed");
    expect(exported).not.toContain("raw removeItem stack");
  });

  it("clears invalid rewrite-owned keys without clearing loaded, missing, legacy or unknown keys", () => {
    const storage = createMemoryStorage({
      [HIDDEN_GEAR_TIERS_STORAGE_KEY]: "{",
      [REWRITE_SETUP_STORAGE_KEY]: persistedEnvelope(1, {}),
      sim_input_v3: "{}",
      "index-sim:unknown-test": "keep"
    });
    savePersisted(
      {
        key: PLANNER_UI_STORAGE_KEY,
        version: 1,
        schema: PlannerUiStateSchema,
        storage
      },
      PlannerUiStateSchema.parse({})
    );

    const result = clearInvalidLocalState(storage);

    expect(result.clearedKeys.sort()).toEqual(
      [HIDDEN_GEAR_TIERS_STORAGE_KEY, REWRITE_SETUP_STORAGE_KEY].sort()
    );
    expect(result.failedKeys).toEqual([]);
    expect(storage.getItem(HIDDEN_GEAR_TIERS_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(REWRITE_SETUP_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(PLANNER_UI_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem("sim_input_v3")).toBe("{}");
    expect(storage.getItem("index-sim:unknown-test")).toBe("keep");
  });

  it("exports only health metadata, not raw local payloads", () => {
    const storage = createMemoryStorage();
    saveSelectedPriceSet(storage, privatePriceSet());
    saveLastHiscoresPlayer(storage, "Fixture Player");

    const exported = JSON.stringify(
      createLocalStateHealthExport(createLocalStateHealthReport(storage))
    );

    expect(exported).toContain("Selected PriceSet");
    expect(exported).toContain("Hiscores last player");
    expect(exported).not.toContain("Private price payload");
    expect(exported).not.toContain("private_item_id");
    expect(exported).not.toContain("Fixture Player");
  });
});

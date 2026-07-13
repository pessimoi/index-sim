import { createGeneratedRuntimeContext } from "../adapters/generated";
import { createMemoryStorage } from "../adapters/storage";
import {
  RUNTIME_BOOTSTRAP_ERROR_MESSAGE,
  RuntimeBootstrapCancelledError,
  resolveRuntimeBootstrap,
  runRuntimeBootstrap,
  runtimeBootstrapFailureState,
  type RuntimeBootstrapDependencies,
  type RuntimeBootstrapInput
} from "../app/controllers/runtime-bootstrap";
import { DEFAULT_DUEL_SNAPSHOTS_STATE } from "../app/state/duel-snapshots";
import { DEFAULT_MANUAL_PRICE_OVERRIDES_STATE } from "../app/state/manual-price-overrides";
import type { LoadSelectedPriceSetResult } from "../app/state/selected-price-set";
import { DEFAULT_FORM_STATE, savedSetupFromForm } from "../app/state/ui-state";
import type { ScheduledStaticPriceSnapshotStatus } from "../adapters/market";
import type { PriceSet } from "../domain/shared";

const generatedRuntime = createGeneratedRuntimeContext({
  loadedAt: "2026-07-13T00:00:00.000Z"
});
const generatedAlch = generatedRuntime.context.gameData.items.rune_scimitar.alch;

function priceSet(id: string, label: string, runeScimitarPrice: number): PriceSet {
  return {
    ...generatedRuntime.context.priceSet,
    id,
    label,
    source: "imported",
    createdAt: "2026-07-13T00:00:00.000Z",
    itemPrices: {
      ...generatedRuntime.context.priceSet.itemPrices,
      rune_scimitar: runeScimitarPrice
    },
    alchValues: {
      ...generatedRuntime.context.priceSet.alchValues,
      rune_scimitar: 1
    }
  };
}

function scheduledLoaded(priceSetValue: PriceSet): ScheduledStaticPriceSnapshotStatus {
  return {
    status: "loaded",
    reason: "Scheduled prices loaded.",
    scheduledPriceSet: priceSetValue,
    fallbackPriceSet: null,
    files: {
      prices: "loaded",
      priceProvenance: "loaded",
      alch: "not-requested",
      priceHistory: "loaded"
    },
    itemCount: Object.keys(priceSetValue.itemPrices).length,
    alchCount: Object.keys(priceSetValue.alchValues).length,
    latestHistoryAt: null,
    sharedPriceHistory: null,
    warnings: []
  };
}

function scheduledFallback(priceSetValue: PriceSet): ScheduledStaticPriceSnapshotStatus {
  return {
    status: "fallback",
    reason: "Scheduled price snapshot is missing. Using the current PriceSet fallback.",
    scheduledPriceSet: null,
    fallbackPriceSet: priceSetValue,
    fallbackReason: "missing",
    files: {
      prices: "missing",
      priceProvenance: "missing",
      alch: "not-requested",
      priceHistory: "missing"
    },
    itemCount: null,
    alchCount: null,
    latestHistoryAt: null,
    sharedPriceHistory: null,
    warnings: []
  };
}

function selectedLoaded(priceSetValue: PriceSet): LoadSelectedPriceSetResult {
  const value = {
    priceSet: priceSetValue,
    selectedAt: "2026-07-13T00:01:00.000Z"
  };
  return {
    status: "loaded",
    value,
    envelope: {
      version: 2,
      savedAt: "2026-07-13T00:01:00.000Z",
      data: value
    }
  };
}

function input(overrides: Partial<RuntimeBootstrapInput> = {}): RuntimeBootstrapInput {
  return {
    storage: createMemoryStorage(),
    initialSavedSetup: {
      loaded: false,
      setup: savedSetupFromForm(DEFAULT_FORM_STATE)
    },
    initialDuelSnapshots: DEFAULT_DUEL_SNAPSHOTS_STATE,
    initialManualPriceOverrides: DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
    ...overrides
  };
}

function dependencies(
  options: {
    selectedPriceSet?: LoadSelectedPriceSetResult;
    scheduledStatus?: ScheduledStaticPriceSnapshotStatus;
  } = {}
): RuntimeBootstrapDependencies {
  return {
    loadGeneratedRuntimeContext: vi.fn().mockResolvedValue(generatedRuntime),
    loadSelectedPriceSet: vi
      .fn()
      .mockReturnValue(options.selectedPriceSet ?? { status: "missing", value: null }),
    loadScheduledStaticPriceSnapshot: vi
      .fn()
      .mockResolvedValue(
        options.scheduledStatus ??
          scheduledLoaded(priceSet("scheduled", "Scheduled fixture", 23_000))
      )
  };
}

describe("runtime bootstrap controller", () => {
  it("uses a valid scheduled snapshot ahead of bundled prices", async () => {
    const result = await resolveRuntimeBootstrap(input(), dependencies());

    expect(result.activePriceSetOrigin).toBe("scheduled");
    expect(result.basePriceSet.id).toBe("scheduled");
    expect(result.basePriceSet.label).toBe("Scheduled fixture + generated item fallbacks");
    expect(result.context.priceSet.itemPrices.rune_scimitar).toBe(23_000);
    expect(result.context.priceSet.alchValues.rune_scimitar).toBe(generatedAlch);
    expect(result.statusMessage).toBe("Loaded scheduled prices");
    expect(result.marketNotice).toEqual({
      tone: "success",
      message: "Scheduled prices loaded."
    });
  });

  it("keeps a selected PriceSet ahead of scheduled prices and restores generated alch", async () => {
    const selected = priceSet("selected", "Selected fixture", 24_000);
    const scheduled = priceSet("scheduled", "Scheduled fixture", 23_000);
    const loader = vi.fn().mockResolvedValue(scheduledLoaded(scheduled));
    const controllerDependencies: RuntimeBootstrapDependencies = {
      loadGeneratedRuntimeContext: vi.fn().mockResolvedValue(generatedRuntime),
      loadSelectedPriceSet: vi.fn().mockReturnValue(selectedLoaded(selected)),
      loadScheduledStaticPriceSnapshot: loader
    };

    const result = await resolveRuntimeBootstrap(
      input({
        initialSavedSetup: {
          loaded: true,
          setup: savedSetupFromForm(DEFAULT_FORM_STATE)
        }
      }),
      controllerDependencies
    );

    expect(result.activePriceSetOrigin).toBe("selected");
    expect(result.basePriceSet.id).toBe("selected");
    expect(result.context.priceSet.itemPrices.rune_scimitar).toBe(24_000);
    expect(result.context.priceSet.alchValues.rune_scimitar).toBe(generatedAlch);
    expect(result.statusMessage).toBe("Loaded saved rewrite setup and selected PriceSet");
    expect(result.marketNotice).toEqual({
      tone: "success",
      message: "Restored selected PriceSet: Selected fixture"
    });
    expect(loader).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackPriceSet: expect.objectContaining({ id: "selected" }),
        canonicalAlchValues: expect.objectContaining({ rune_scimitar: generatedAlch })
      })
    );
  });

  it("uses a neutral scheduled notice when a selected PriceSet is invalid", async () => {
    const result = await resolveRuntimeBootstrap(
      input(),
      dependencies({
        selectedPriceSet: { status: "invalid", value: null, reason: "invalid_data" }
      })
    );

    expect(result.activePriceSetOrigin).toBe("scheduled");
    expect(result.statusMessage).toBe("Loaded scheduled prices");
    expect(result.marketNotice).toEqual({
      tone: "neutral",
      message: "Saved active PriceSet could not be restored. Scheduled prices were loaded."
    });
  });

  it("uses bundled prices and the specific sanitized issue without scheduled prices", async () => {
    const result = await resolveRuntimeBootstrap(
      input(),
      dependencies({
        selectedPriceSet: { status: "invalid", value: null, reason: "invalid_json" },
        scheduledStatus: scheduledFallback(generatedRuntime.context.priceSet)
      })
    );

    expect(result.activePriceSetOrigin).toBe("bundled");
    expect(result.basePriceSet).toBe(generatedRuntime.context.priceSet);
    expect(result.statusMessage).toBe(
      "Saved active PriceSet is not valid JSON. Bundled prices were loaded."
    );
    expect(result.marketNotice).toEqual({
      tone: "error",
      message: "Saved active PriceSet is not valid JSON. Bundled prices were loaded."
    });
  });

  it("keeps the source-backed status when selected and scheduled prices are missing", async () => {
    const result = await resolveRuntimeBootstrap(
      input(),
      dependencies({ scheduledStatus: scheduledFallback(generatedRuntime.context.priceSet) })
    );

    expect(result.activePriceSetOrigin).toBe("bundled");
    expect(result.statusMessage).toBe("Loaded source-backed runtime data");
    expect(result.marketNotice).toBeNull();
  });

  it("applies captured manual overrides last without mutating the resolved base", async () => {
    const result = await resolveRuntimeBootstrap(
      input({
        initialManualPriceOverrides: {
          items: {
            rune_scimitar: {
              price: 99_999,
              updatedAt: "2026-07-13T00:02:00.000Z"
            }
          }
        }
      }),
      dependencies()
    );

    expect(result.basePriceSet.itemPrices.rune_scimitar).toBe(23_000);
    expect(result.context.priceSet.itemPrices.rune_scimitar).toBe(99_999);
    expect(result.context.priceSet.itemPriceMetadata?.rune_scimitar).toMatchObject({
      valueOrigin: "manual",
      reasonCode: "manual-value"
    });
    expect(result.context.priceSet.alchValues.rune_scimitar).toBe(generatedAlch);
    expect(result.priceLabel).toContain("local manual prices");
  });

  it("returns safe replacements and both recovery blocks for incompatible saved state", async () => {
    const unavailableForm = {
      ...DEFAULT_FORM_STATE,
      monsterId: "removed_runtime_monster"
    };
    const result = await resolveRuntimeBootstrap(
      input({
        initialSavedSetup: {
          loaded: true,
          setup: savedSetupFromForm(unavailableForm)
        },
        initialDuelSnapshots: {
          snapshots: [
            {
              id: "removed-runtime-duel",
              name: "Removed runtime Duel",
              form: unavailableForm
            }
          ]
        }
      }),
      dependencies()
    );

    expect(result.setupReplacement?.form.monsterId).toBe(DEFAULT_FORM_STATE.monsterId);
    expect(result.duelSnapshotsReplacement).toEqual(DEFAULT_DUEL_SNAPSHOTS_STATE);
    expect(result.contextInvalidItemIds).toEqual(["rewrite-setup", "duel-snapshots"]);
    expect(result.recoveryNotice).toBe(
      "Saved setup and setup comparisons reference unavailable game data. Defaults are active until the saved data is cleared or replaced."
    );
    expect(result.statusMessage).toBe("Saved rewrite setup is incompatible; defaults are active");
  });

  it("keeps the Duel-specific status when only saved comparisons are incompatible", async () => {
    const result = await resolveRuntimeBootstrap(
      input({
        initialDuelSnapshots: {
          snapshots: [
            {
              id: "removed-runtime-duel",
              name: "Removed runtime Duel",
              form: { ...DEFAULT_FORM_STATE, monsterId: "removed_runtime_monster" }
            }
          ]
        }
      }),
      dependencies()
    );

    expect(result.setupReplacement).toBeNull();
    expect(result.contextInvalidItemIds).toEqual(["duel-snapshots"]);
    expect(result.statusMessage).toBe(
      "Saved setup comparisons are incompatible; an empty list is active"
    );
  });

  it("stops before scheduled loading when cancellation follows generated loading", async () => {
    let cancelled = false;
    const scheduledLoader = vi.fn();
    const controllerDependencies: RuntimeBootstrapDependencies = {
      loadGeneratedRuntimeContext: vi.fn().mockImplementation(async () => {
        cancelled = true;
        return generatedRuntime;
      }),
      loadSelectedPriceSet: vi.fn(),
      loadScheduledStaticPriceSnapshot: scheduledLoader
    };

    await expect(
      resolveRuntimeBootstrap(input(), controllerDependencies, {
        isCancelled: () => cancelled
      })
    ).rejects.toBeInstanceOf(RuntimeBootstrapCancelledError);
    expect(controllerDependencies.loadSelectedPriceSet).not.toHaveBeenCalled();
    expect(scheduledLoader).not.toHaveBeenCalled();
  });

  it("maps generated loader rejection to only the fixed sanitized failure state", async () => {
    const controllerDependencies: RuntimeBootstrapDependencies = {
      loadGeneratedRuntimeContext: vi
        .fn()
        .mockRejectedValue(new Error("raw loader failure payload")),
      loadSelectedPriceSet: vi.fn(),
      loadScheduledStaticPriceSnapshot: vi.fn()
    };

    const state = await runRuntimeBootstrap(input(), controllerDependencies);

    expect(state).toEqual({ status: "error", message: RUNTIME_BOOTSTRAP_ERROR_MESSAGE });
    expect(JSON.stringify(state)).not.toContain("raw loader failure payload");
    expect(controllerDependencies.loadSelectedPriceSet).not.toHaveBeenCalled();
    expect(controllerDependencies.loadScheduledStaticPriceSnapshot).not.toHaveBeenCalled();
  });

  it("exposes the fixed failure-state helper", () => {
    const state = runtimeBootstrapFailureState();

    expect(state).toEqual({ status: "error", message: RUNTIME_BOOTSTRAP_ERROR_MESSAGE });
    expect(JSON.stringify(state)).not.toContain("raw loader failure payload");
  });
});

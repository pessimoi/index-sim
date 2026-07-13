import {
  generatedItemValues,
  withGeneratedAlchAuthority
} from "@/adapters/generated/price-fallback";
import type { GeneratedRuntimeBootstrapResult } from "@/adapters/generated";
import type {
  ScheduledStaticPriceSnapshotLoadOptions,
  ScheduledStaticPriceSnapshotStatus
} from "@/adapters/market";
import type { KeyValueStorage } from "@/adapters/storage";
import type { PriceSet, SimulationContext } from "@/domain/shared";
import { DEFAULT_DUEL_SNAPSHOTS_STATE, type DuelSnapshotsState } from "../state/duel-snapshots";
import type { LocalStateHealthItemId } from "../state/local-state-health";
import {
  applyManualPriceOverrides,
  type ManualPriceOverridesState
} from "../state/manual-price-overrides";
import {
  resolveActivePriceSetFallback,
  withGeneratedScheduledPriceFallbacks,
  type ActivePriceSetOrigin
} from "../state/market-sync";
import type { LoadSelectedPriceSetResult } from "../state/selected-price-set";
import {
  duelSnapshotsCompatibilityIssues,
  savedSetupCompatibilityIssues
} from "../state/setup-compatibility";
import { DEFAULT_FORM_STATE, savedSetupFromForm, type SavedSetupState } from "../state/ui-state";

export const RUNTIME_BOOTSTRAP_ERROR_MESSAGE =
  "Source-backed runtime data could not be loaded. Verify the deployed data artifacts and reload.";

export interface InitialSavedSetup {
  loaded: boolean;
  setup: SavedSetupState;
}

export interface RuntimeBootstrapInput {
  storage: KeyValueStorage;
  initialSavedSetup: InitialSavedSetup;
  initialDuelSnapshots: DuelSnapshotsState;
  initialManualPriceOverrides: ManualPriceOverridesState;
}

export interface RuntimeBootstrapDependencies {
  loadGeneratedRuntimeContext: () => Promise<GeneratedRuntimeBootstrapResult>;
  loadSelectedPriceSet: (storage: KeyValueStorage) => LoadSelectedPriceSetResult;
  loadScheduledStaticPriceSnapshot: (
    options: ScheduledStaticPriceSnapshotLoadOptions
  ) => Promise<ScheduledStaticPriceSnapshotStatus>;
}

export interface RuntimeBootstrapMarketNotice {
  tone: "neutral" | "success" | "warning" | "error";
  message: string;
}

export interface RuntimeBootstrapResult {
  context: SimulationContext;
  setupReplacement: SavedSetupState | null;
  duelSnapshotsReplacement: DuelSnapshotsState | null;
  contextInvalidItemIds: readonly LocalStateHealthItemId[];
  recoveryNotice: string | null;
  bundledPriceSet: PriceSet;
  basePriceSet: PriceSet;
  manualPriceOverrides: ManualPriceOverridesState;
  scheduledSnapshotStatus: ScheduledStaticPriceSnapshotStatus;
  activePriceSetOrigin: ActivePriceSetOrigin;
  priceLabel: string;
  marketNotice: RuntimeBootstrapMarketNotice | null;
  statusMessage: string;
}

export type RuntimeBootstrapState =
  | { status: "loading" }
  | { status: "ready"; result: RuntimeBootstrapResult }
  | { status: "error"; message: string };

export class RuntimeBootstrapCancelledError extends Error {
  constructor() {
    super("Runtime bootstrap was cancelled");
    this.name = "RuntimeBootstrapCancelledError";
  }
}

function describeSelectedPriceSetLoadIssue(result: LoadSelectedPriceSetResult): string | null {
  if (result.status === "missing" || result.status === "loaded") return null;
  if (result.status === "unavailable") {
    return "Local storage is unavailable. Bundled prices were loaded and changes may not persist after reload.";
  }
  if (result.status === "version-mismatch") {
    return "Saved active PriceSet uses an unsupported local version. Bundled prices were loaded.";
  }
  switch (result.reason) {
    case "body_too_large":
      return "Saved active PriceSet is too large. Bundled prices were loaded.";
    case "duplicate_keys":
      return "Saved active PriceSet contains duplicate data. Bundled prices were loaded.";
    case "invalid_json":
      return "Saved active PriceSet is not valid JSON. Bundled prices were loaded.";
    case "invalid_envelope":
      return "Saved active PriceSet metadata is invalid. Bundled prices were loaded.";
    case "invalid_data":
      return "Saved active PriceSet data is invalid. Bundled prices were loaded.";
  }
}

function recoveryNotice(
  setupCompatibilityIssues: readonly string[],
  duelCompatibilityIssues: readonly string[]
): string | null {
  if (setupCompatibilityIssues.length > 0 && duelCompatibilityIssues.length > 0) {
    return "Saved setup and setup comparisons reference unavailable game data. Defaults are active until the saved data is cleared or replaced.";
  }
  if (setupCompatibilityIssues.length > 0) {
    return "Saved rewrite setup references data unavailable in this game version. Defaults are active until the saved setup is cleared or replaced.";
  }
  if (duelCompatibilityIssues.length > 0) {
    return "Saved setup comparisons reference unavailable game data. An empty setup list is active until the saved setups are cleared or replaced.";
  }
  return null;
}

function contextInvalidItemIds(
  setupCompatibilityIssues: readonly string[],
  duelCompatibilityIssues: readonly string[]
): readonly LocalStateHealthItemId[] {
  return [
    ...(setupCompatibilityIssues.length > 0 ? (["rewrite-setup"] as const) : []),
    ...(duelCompatibilityIssues.length > 0 ? (["duel-snapshots"] as const) : [])
  ];
}

function assertNotCancelled(isCancelled: () => boolean): void {
  if (isCancelled()) throw new RuntimeBootstrapCancelledError();
}

export function runtimeBootstrapFailureState(): RuntimeBootstrapState {
  return { status: "error", message: RUNTIME_BOOTSTRAP_ERROR_MESSAGE };
}

export async function resolveRuntimeBootstrap(
  input: RuntimeBootstrapInput,
  dependencies: RuntimeBootstrapDependencies,
  options: { isCancelled?: () => boolean } = {}
): Promise<RuntimeBootstrapResult> {
  const isCancelled = options.isCancelled ?? (() => false);
  const generatedRuntime = await dependencies.loadGeneratedRuntimeContext();
  assertNotCancelled(isCancelled);

  const bundledContext = generatedRuntime.context;
  const setupCompatibilityIssues = input.initialSavedSetup.loaded
    ? savedSetupCompatibilityIssues(input.initialSavedSetup.setup, bundledContext.gameData)
    : [];
  const duelCompatibilityIssues = duelSnapshotsCompatibilityIssues(
    input.initialDuelSnapshots,
    bundledContext.gameData
  );
  const invalidItemIds = contextInvalidItemIds(setupCompatibilityIssues, duelCompatibilityIssues);

  const selectedPriceSet = dependencies.loadSelectedPriceSet(input.storage);
  const restoredPriceSet =
    selectedPriceSet.status === "loaded"
      ? withGeneratedAlchAuthority(selectedPriceSet.value.priceSet, bundledContext.gameData)
      : null;
  const scheduledStatus = await dependencies.loadScheduledStaticPriceSnapshot({
    fallbackPriceSet: restoredPriceSet ?? bundledContext.priceSet,
    canonicalAlchValues: generatedItemValues(bundledContext.gameData, "alch")
  });
  assertNotCancelled(isCancelled);

  const runtimeScheduledStatus = withGeneratedScheduledPriceFallbacks(
    scheduledStatus,
    bundledContext.gameData
  );
  const fallbackResolution = resolveActivePriceSetFallback({
    bundledPriceSet: bundledContext.priceSet,
    selectedPriceSet: restoredPriceSet,
    scheduledSnapshotStatus: runtimeScheduledStatus
  });
  const activePriceSet = applyManualPriceOverrides(
    fallbackResolution.priceSet,
    input.initialManualPriceOverrides
  );
  const scheduledLoaded = runtimeScheduledStatus.status === "loaded";
  const selectedPriceSetIssue = describeSelectedPriceSetLoadIssue(selectedPriceSet);

  let statusMessage: string;
  let marketNotice: RuntimeBootstrapMarketNotice | null = null;
  if (restoredPriceSet) {
    statusMessage = input.initialSavedSetup.loaded
      ? "Loaded saved rewrite setup and selected PriceSet"
      : "Loaded selected PriceSet";
    marketNotice = {
      tone: "success",
      message: `Restored selected PriceSet: ${restoredPriceSet.label}`
    };
  } else {
    const loadedStatus = scheduledLoaded
      ? "Loaded scheduled prices"
      : input.initialSavedSetup.loaded
        ? "Loaded saved rewrite setup"
        : "Loaded source-backed runtime data";
    statusMessage =
      selectedPriceSetIssue && !scheduledLoaded ? selectedPriceSetIssue : loadedStatus;
    if (scheduledLoaded) {
      marketNotice = {
        tone: selectedPriceSetIssue ? "neutral" : "success",
        message: selectedPriceSetIssue
          ? "Saved active PriceSet could not be restored. Scheduled prices were loaded."
          : "Scheduled prices loaded."
      };
    } else if (selectedPriceSetIssue) {
      marketNotice = { tone: "error", message: selectedPriceSetIssue };
    }
  }

  if (setupCompatibilityIssues.length > 0) {
    statusMessage = "Saved rewrite setup is incompatible; defaults are active";
  } else if (duelCompatibilityIssues.length > 0) {
    statusMessage = "Saved setup comparisons are incompatible; an empty list is active";
  }

  return {
    context: { ...bundledContext, priceSet: activePriceSet },
    setupReplacement:
      setupCompatibilityIssues.length > 0 ? savedSetupFromForm(DEFAULT_FORM_STATE) : null,
    duelSnapshotsReplacement:
      duelCompatibilityIssues.length > 0 ? DEFAULT_DUEL_SNAPSHOTS_STATE : null,
    contextInvalidItemIds: invalidItemIds,
    recoveryNotice: recoveryNotice(setupCompatibilityIssues, duelCompatibilityIssues),
    bundledPriceSet: bundledContext.priceSet,
    basePriceSet: fallbackResolution.priceSet,
    manualPriceOverrides: input.initialManualPriceOverrides,
    scheduledSnapshotStatus: runtimeScheduledStatus,
    activePriceSetOrigin: fallbackResolution.origin,
    priceLabel: activePriceSet.label,
    marketNotice,
    statusMessage
  };
}

export async function runRuntimeBootstrap(
  input: RuntimeBootstrapInput,
  dependencies: RuntimeBootstrapDependencies,
  options: { isCancelled?: () => boolean } = {}
): Promise<RuntimeBootstrapState> {
  try {
    return {
      status: "ready",
      result: await resolveRuntimeBootstrap(input, dependencies, options)
    };
  } catch (error) {
    if (error instanceof RuntimeBootstrapCancelledError) throw error;
    return runtimeBootstrapFailureState();
  }
}

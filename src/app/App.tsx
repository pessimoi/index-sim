import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PendingUndoStatus,
  ShareSetupDialog,
  type PendingUndo,
  type ShareSetupDialogState
} from "./components/app-presenters";
import type { SelectOption } from "./components/form-fields";
import { formatDelta } from "./components/presentation-formatters";
import { AppHeader } from "./components/shell/app-header";
import { SharedSetupReview } from "./components/shell/shared-setup-review";
import { LegacyMigrationPanel } from "./components/shell/legacy-migration-panel";
import { WorkbenchShell } from "./components/shell/workbench-shell";
import { CannonPane } from "./components/panes/cannon-pane";
import { ComparePane } from "./components/panes/compare-pane";
import { DuelPane } from "./components/panes/duel-pane";
import { MonsterCardPanel } from "./components/panes/monster-card-panel";
import { LoadoutPane } from "./components/panes/loadout-pane";
import { PlannerPane } from "./components/panes/planner-pane";
import { RiskPane } from "./components/panes/risk-pane";
import { StatsPane } from "./components/panes/stats-pane";
import { LootPane } from "./components/panes/loot-pane";
import { TripPane } from "./components/panes/trip-pane";
import { EconomySettingsPane } from "./components/panes/economy-settings-pane";
import {
  captureBrowserShareableSetupFragment,
  createBrowserShareableSetupUrl,
  downloadJsonFile,
  readBrowserFileText,
  writeShareableSetupToClipboard
} from "@/adapters/browser";
import type { ScheduledStaticPriceSnapshotStatus } from "@/adapters/market";
import {
  createMemoryStorage,
  loadPersisted,
  tryClearPersisted,
  type KeyValueStorage
} from "@/adapters/storage";
import {
  clearKnownLegacyStorageKeys,
  inspectLegacySetupMigration,
  type LegacySetupMigrationReport,
  type LegacyStorageKey
} from "./state/legacy-storage-migration";
import { supportedSpecialAttacksForCombatStyle } from "@/domain/combat";
import { loadoutToCombatBonuses } from "@/domain/equipment";
import type { PlannerGearSlot, PlannerMetric, PlannerSkill } from "@/domain/planner";
import { EQUIPMENT_SLOTS } from "@/domain/shared";
import type {
  CombatStyle,
  EquipmentSlot,
  EntityId,
  PriceSet,
  SimulationContext
} from "@/domain/shared";
import { lootPreferenceKeysForMonster, type LootAction } from "@/domain/trip";
import type { ActivePriceSetOrigin } from "./state/market-sync";
import {
  LEGACY_MIGRATION_DISMISSED_STORAGE_KEY,
  LEGACY_MIGRATION_DISMISSED_VERSION,
  LegacyMigrationDismissedStateSchema
} from "./state/legacy-migration";
import type { LocalStateHealthItemId } from "./state/local-state-health";
import { useHiscoresLookup } from "./controllers/use-hiscores-lookup";
import { useCompareCalculation } from "./controllers/use-compare-calculation";
import { useDuelPane } from "./controllers/use-duel-pane";
import { usePlannerCalculation } from "./controllers/use-planner-calculation";
import { useRiskAnalysis } from "./controllers/use-risk-analysis";
import { useLocalStateRecovery } from "./controllers/use-local-state-recovery";
import { useSetupFileTransfer } from "./controllers/use-setup-file-transfer";
import { usePriceSetTransfer } from "./controllers/use-price-set-transfer";
import { formatRiskRange } from "./view-models/risk";
import type {
  AcceptedPriceSetOutcome,
  PriceImportSurface,
  ResetPriceSetOutcome
} from "./controllers/price-set-transfer";
import {
  applyHiscoresLevels,
  canApplyHiscoresPreview,
  createHiscoresPreviewRows,
  isHiscoresPreviewCurrent
} from "./state/hiscores";
import {
  DEFAULT_HIDDEN_GEAR_TIERS_STATE,
  HIDDEN_GEAR_TIERS_STORAGE_KEY,
  HIDDEN_GEAR_TIERS_VERSION,
  HiddenGearTiersStateSchema,
  filterHiddenGearTierOptions,
  hideAllGearTiers,
  setHiddenGearTier,
  type HiddenGearTiersState
} from "./state/hidden-gear-tiers";
import {
  DEFAULT_DUEL_SNAPSHOTS_STATE,
  DUEL_SNAPSHOTS_IMPORT_MAX_BYTES,
  DUEL_SNAPSHOTS_STORAGE_KEY,
  DUEL_SNAPSHOTS_VERSION,
  DuelSnapshotsStateSchema,
  appendDuelSnapshot,
  createDuelSnapshotId,
  createDuelSnapshot,
  createDuelSnapshotsExport,
  mergeDuelSnapshots,
  parseDuelSnapshotsExportText,
  removeDuelSnapshot,
  renameDuelSnapshot,
  type DuelSnapshotsState
} from "./state/duel-snapshots";
import {
  DEFAULT_LOOT_PREFS_STATE,
  LOOT_PREFS_STORAGE_KEY,
  LOOT_PREFS_VERSION,
  LootPrefsStateSchema,
  mergeLootPrefsState,
  replaceLootPrefsForMonster,
  resetLootPrefsForMonster,
  selectLootPrefsForMonster,
  setLootPreferenceForMonster,
  type LootPrefsState
} from "./state/loot-prefs";
import {
  DEFAULT_LOOT_SETTINGS_STATE,
  LOOT_SETTINGS_STORAGE_KEY,
  LOOT_SETTINGS_VERSION,
  LootSettingsByMonsterSchema,
  lootSettingsForMonster,
  setLootSettingsForMonster,
  resetLootSettingsForMonster,
  type LootSettingsByMonsterState,
  type MonsterLootSettings
} from "./state/loot-settings";
import {
  appendAcceptedPriceSetToHistory,
  BrowserPriceHistoryStateSchema,
  loadBrowserPriceHistory,
  DEFAULT_PRICE_HISTORY_STATE,
  PRICE_HISTORY_STORAGE_KEY,
  PRICE_HISTORY_VERSION,
  type BrowserPriceHistoryState,
  type PriceHistoryBaselineMode,
  type PriceHistoryMoverSortKey,
  type PriceHistoryMoverSortState
} from "./state/price-history";
import {
  DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
  applyManualPriceOverrides,
  canSetManualPriceOverride,
  loadManualPriceOverrides,
  removeManualPriceOverride,
  saveManualPriceOverrides,
  setManualPriceOverride,
  type ManualPriceOverridesState
} from "./state/manual-price-overrides";
import {
  applyShareableSetup,
  buildShareableSetupEnvelope,
  decodeShareableSetupEnvelope,
  encodeShareableSetupEnvelope,
  reviewShareableSetup
} from "./state/shareable-setup";
import { useRuntimeBootstrap } from "./controllers/use-runtime-bootstrap";
import type { RuntimeBootstrapResult } from "./controllers/runtime-bootstrap";
import {
  PLANNER_UI_STORAGE_KEY,
  PLANNER_UI_VERSION,
  PlannerUiStateSchema,
  loadPlannerUiState,
  normalizePlannerUiState,
  resetPlannerGearPoolSlot,
  setPlannerGearPoolItem,
  type PlannerUiState
} from "./state/planner";
import {
  CannonSettingsSchema,
  BOOST_SELECTION_OPTIONS,
  DEFAULT_CANNON_SETTINGS,
  DEFAULT_FORM_STATE,
  DEFAULT_MANUAL_OVERRIDES,
  DEFAULT_SPECIAL_ATTACK_STATE,
  PRAYER_SELECTION_OPTIONS,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  SavedSetupSchema,
  applyWeaponSelection,
  formForMonsterSetup,
  normalizeFormState,
  removeCustomSetupForMonster,
  savedSetupFromForm,
  setPrimaryBoostSelection,
  setPrimaryPrayerSelection,
  setCustomSetupForMonster,
  switchCombatStyleLoadout,
  toggleBoostSelection,
  togglePrayerSelection,
  type CannonByMonsterState,
  type CombatSetupFormState,
  type CustomSetupsByMonsterState,
  type SavedSetupState,
  type SetupMode
} from "./state/ui-state";
import {
  cleanDenseCompareStateForMonsterIds,
  nextDenseCompareSortState,
  resetDenseCompareFilters,
  toggleDenseCompareMonsterIrrelevant,
  type DenseCompareUiState
} from "./state/dense-compare";
import { plannerAllowedPool } from "./view-models/planner";
import { createSimulationViewModel, monsterOptions } from "./view-models/simulation";
import {
  lootActionLabel,
  optimizeLootPrefsForMonster,
  type LootDropRowViewModel
} from "./view-models/loot";
import {
  createEconomyHistoryPresentation,
  createManualPriceEditorPresentation,
  createPriceHistorySources,
  createPriceHistorySummaryPresentation,
  createPriceItemLabels,
  createPriceSetPresentation,
  createSelectedPriceItemPresentation,
  type ItemPriceHistoryContext
} from "./view-models/price-data";
import { createSettingsPaneViewModel } from "./view-models/settings";
import { createTripPaneViewModel } from "./view-models/trip";
import type {
  ActiveAssumptionResetTarget,
  ActiveAssumptionReviewTarget
} from "./view-models/active-assumptions";
import { formatNumber } from "./view-models/formatting";
import {
  ammoOptions,
  createLoadoutPaneViewModel,
  emptyGearSelectOptions,
  equipmentSlotOptions,
  gearQuickActionForSlot,
  optimizeVisibleLoadout,
  spellOptions,
  styleOptions,
  weaponOptions
} from "./view-models/loadout";
import {
  PRIMARY_BOOST_OPTIONS,
  PRIMARY_PRAYER_OPTIONS,
  createAppShellSetupViewModel,
  createSharedSetupReviewViewModel,
  createWorkbenchResultViewModel,
  describeShareableSetupError,
  type ShareableSetupInspection,
  type WorkbenchTabId
} from "./view-models/app-shell";
import { createLegacyMigrationViewModel } from "./view-models/legacy-migration";
import { defaultDuelSnapshotName, describeDuelSnapshotsImportError } from "./view-models/duel";
import type { InlineNoticeViewModel } from "./view-models/contracts";

function createBrowserStorageAccess(): { storage: KeyValueStorage; unavailable: boolean } {
  if (typeof window === "undefined") {
    return { storage: createMemoryStorage(), unavailable: false };
  }
  try {
    return { storage: window.localStorage, unavailable: false };
  } catch {
    return { storage: createMemoryStorage(), unavailable: true };
  }
}

const browserStorageAccess = createBrowserStorageAccess();
const storage = browserStorageAccess.storage;
const localStorageAccessUnavailable = browserStorageAccess.unavailable;

const setupStorageOptions = {
  key: REWRITE_SETUP_STORAGE_KEY,
  version: REWRITE_SETUP_VERSION,
  schema: SavedSetupSchema,
  storage
};

const lootPrefsStorageOptions = {
  key: LOOT_PREFS_STORAGE_KEY,
  version: LOOT_PREFS_VERSION,
  schema: LootPrefsStateSchema,
  storage
};

const lootSettingsStorageOptions = {
  key: LOOT_SETTINGS_STORAGE_KEY,
  version: LOOT_SETTINGS_VERSION,
  schema: LootSettingsByMonsterSchema,
  storage
};

const hiddenGearTiersStorageOptions = {
  key: HIDDEN_GEAR_TIERS_STORAGE_KEY,
  version: HIDDEN_GEAR_TIERS_VERSION,
  schema: HiddenGearTiersStateSchema,
  storage
};

const duelSnapshotsStorageOptions = {
  key: DUEL_SNAPSHOTS_STORAGE_KEY,
  version: DUEL_SNAPSHOTS_VERSION,
  schema: DuelSnapshotsStateSchema,
  storage
};

const priceHistoryStorageOptions = {
  key: PRICE_HISTORY_STORAGE_KEY,
  version: PRICE_HISTORY_VERSION,
  schema: BrowserPriceHistoryStateSchema,
  storage
};

const legacyMigrationDismissedStorageOptions = {
  key: LEGACY_MIGRATION_DISMISSED_STORAGE_KEY,
  version: LEGACY_MIGRATION_DISMISSED_VERSION,
  schema: LegacyMigrationDismissedStateSchema,
  storage
};

const plannerUiStorageOptions = {
  key: PLANNER_UI_STORAGE_KEY,
  version: PLANNER_UI_VERSION,
  schema: PlannerUiStateSchema,
  storage
};

function loadInitialSavedSetup(): {
  loaded: boolean;
  setup: ReturnType<typeof savedSetupFromForm>;
} {
  const persisted = loadPersisted(setupStorageOptions);
  return {
    loaded: persisted.status === "loaded",
    setup: persisted.status === "loaded" ? persisted.value : savedSetupFromForm(DEFAULT_FORM_STATE)
  };
}

function loadInitialLootPrefs(): LootPrefsState {
  const persisted = loadPersisted(lootPrefsStorageOptions);
  return persisted.status === "loaded" ? persisted.value : DEFAULT_LOOT_PREFS_STATE;
}

function loadInitialLootSettings(): LootSettingsByMonsterState {
  const persisted = loadPersisted(lootSettingsStorageOptions);
  return persisted.status === "loaded" ? persisted.value : DEFAULT_LOOT_SETTINGS_STATE;
}

function loadInitialHiddenGearTiers(): HiddenGearTiersState {
  const persisted = loadPersisted(hiddenGearTiersStorageOptions);
  return persisted.status === "loaded" ? persisted.value : DEFAULT_HIDDEN_GEAR_TIERS_STATE;
}

function loadInitialDuelSnapshots(): DuelSnapshotsState {
  const persisted = loadPersisted(duelSnapshotsStorageOptions);
  return persisted.status === "loaded" ? persisted.value : DEFAULT_DUEL_SNAPSHOTS_STATE;
}

function loadInitialPriceHistory(): BrowserPriceHistoryState {
  const persisted = loadBrowserPriceHistory(storage);
  return persisted.status === "loaded" ? persisted.value : DEFAULT_PRICE_HISTORY_STATE;
}

function loadInitialManualPriceOverrides(): ManualPriceOverridesState {
  const persisted = loadManualPriceOverrides(storage);
  return persisted.status === "loaded" ? persisted.value : DEFAULT_MANUAL_PRICE_OVERRIDES_STATE;
}

function loadInitialPlannerUiState(): PlannerUiState {
  return loadPlannerUiState(storage);
}

function loadInitialLegacyMigrationDismissed(): boolean {
  return loadPersisted(legacyMigrationDismissedStorageOptions).status === "loaded";
}

function updateForm(
  form: CombatSetupFormState,
  patch: Partial<CombatSetupFormState>
): CombatSetupFormState {
  return normalizeFormState({ ...form, ...patch });
}

function localUndoId(): string {
  return `undo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function App() {
  const [context, setContext] = useState<SimulationContext | null>(null);
  const [initialSavedSetup] = useState(loadInitialSavedSetup);
  const [initialDuelSnapshots] = useState(loadInitialDuelSnapshots);
  const [form, setForm] = useState<CombatSetupFormState>(() =>
    normalizeFormState(initialSavedSetup.setup.form)
  );
  const [defaultForm, setDefaultForm] = useState<CombatSetupFormState>(() =>
    normalizeFormState(initialSavedSetup.setup.defaultForm)
  );
  const [setupMode, setSetupMode] = useState<SetupMode>(() => initialSavedSetup.setup.setupMode);
  const [customSetupsByMonster, setCustomSetupsByMonster] = useState<CustomSetupsByMonsterState>(
    () => initialSavedSetup.setup.customSetupsByMonster
  );
  const [cannonByMonster, setCannonByMonster] = useState<CannonByMonsterState>(
    () => initialSavedSetup.setup.cannonByMonster
  );
  const [denseCompare, setDenseCompare] = useState<DenseCompareUiState>(
    () => initialSavedSetup.setup.denseCompare
  );
  const [lootPrefsByMonster, setLootPrefsByMonster] =
    useState<LootPrefsState>(loadInitialLootPrefs);
  const [lootSettingsByMonster, setLootSettingsByMonster] =
    useState<LootSettingsByMonsterState>(loadInitialLootSettings);
  const [hiddenGearTiers, setHiddenGearTiers] = useState<HiddenGearTiersState>(
    loadInitialHiddenGearTiers
  );
  const [duelSnapshots, setDuelSnapshots] = useState<DuelSnapshotsState>(initialDuelSnapshots);
  const [priceHistory, setPriceHistory] =
    useState<BrowserPriceHistoryState>(loadInitialPriceHistory);
  const [bundledPriceSet, setBundledPriceSet] = useState<PriceSet | null>(null);
  const [basePriceSet, setBasePriceSet] = useState<PriceSet | null>(null);
  const [manualPriceOverrides, setManualPriceOverrides] = useState<ManualPriceOverridesState>(
    loadInitialManualPriceOverrides
  );
  const [manualPriceItemId, setManualPriceItemId] = useState("");
  const [manualPriceDraft, setManualPriceDraft] = useState<number | null>(null);
  const [manualPriceClearPending, setManualPriceClearPending] = useState(false);
  const [scheduledSnapshotStatus, setScheduledSnapshotStatus] =
    useState<ScheduledStaticPriceSnapshotStatus | null>(null);
  const [activePriceSetOrigin, setActivePriceSetOrigin] = useState<ActivePriceSetOrigin>("bundled");
  const [plannerState, setPlannerState] = useState<PlannerUiState>(loadInitialPlannerUiState);
  const [legacyMigrationDismissed, setLegacyMigrationDismissed] = useState(
    loadInitialLegacyMigrationDismissed
  );
  const [legacyClearPending, setLegacyClearPending] = useState(false);
  const [priceAgeNowMs, setPriceAgeNowMs] = useState(() => Date.now());
  const [readyToPersist, setReadyToPersist] = useState(false);
  const [status, setStatus] = useState("Loading source-backed runtime data");
  const localStateRecovery = useLocalStateRecovery({
    storage,
    storageUnavailable: localStorageAccessUnavailable,
    onStatus: setStatus,
    onDownload: downloadJsonFile
  });
  const persistLocalState = localStateRecovery.persist;
  const persistImportedSetup = useCallback(
    (setup: SavedSetupState) => persistLocalState("rewrite-setup", setupStorageOptions, setup),
    [persistLocalState]
  );
  const setupFileTransfer = useSetupFileTransfer({
    persistSetup: persistImportedSetup,
    unblockReplaced: localStateRecovery.unblockReplaced,
    refreshLocalStateHealth: localStateRecovery.refresh
  });
  const priceSetTransfer = usePriceSetTransfer({
    storage,
    storageUnavailable: localStorageAccessUnavailable,
    clearStorageFailures: localStateRecovery.clearStorageFailures,
    recordStorageFailure: localStateRecovery.recordStorageFailure,
    markPersistenceUnavailable: localStateRecovery.markPersistenceUnavailable,
    unblockReplaced: localStateRecovery.unblockReplaced,
    refreshLocalStateHealth: localStateRecovery.refresh
  });
  const hiscores = useHiscoresLookup({
    storage,
    clearStorageFailures: localStateRecovery.clearStorageFailures,
    recordStorageFailure: localStateRecovery.recordStorageFailure,
    unblockReplaced: localStateRecovery.unblockReplaced,
    refreshLocalStateHealth: localStateRecovery.refresh
  });
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [receivedShareableSetupPayload] = useState(captureBrowserShareableSetupFragment);
  const [shareReviewDismissed, setShareReviewDismissed] = useState(false);
  const [shareDialog, setShareDialog] = useState<ShareSetupDialogState | null>(null);
  const [shareCreateNotice, setShareCreateNotice] = useState<string | null>(null);
  const [duelImportNotice, setDuelImportNotice] = useState<InlineNoticeViewModel | null>(null);
  const [priceLabel, setPriceLabel] = useState(
    "Scheduled static prices + generated item fallbacks"
  );
  const [marketNotice, setMarketNotice] = useState<{
    tone: "neutral" | "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [economyBaselineMode, setEconomyBaselineMode] =
    useState<PriceHistoryBaselineMode>("previous");
  const [economySnapshotKey, setEconomySnapshotKey] = useState("");
  const [economyItemFilter, setEconomyItemFilter] = useState("");
  const [economyTrendItemId, setEconomyTrendItemId] = useState("");
  const [economySort, setEconomySort] = useState<PriceHistoryMoverSortState>({
    key: "gpDelta",
    direction: "desc"
  });
  const [priceHistoryClearPending, setPriceHistoryClearPending] = useState(false);
  const [lootNotice, setLootNotice] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [respectLoadoutRequirements, setRespectLoadoutRequirements] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkbenchTabId>("compare");
  const shareSetupButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timerId = window.setInterval(() => setPriceAgeNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timerId);
  }, []);

  const runtimeBootstrap = useRuntimeBootstrap({
    storage,
    initialSavedSetup,
    initialDuelSnapshots,
    initialManualPriceOverrides: manualPriceOverrides
  });
  const blockContextInvalidLocalState = localStateRecovery.blockContextInvalid;
  const appliedRuntimeBootstrapResultRef = useRef<RuntimeBootstrapResult | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- One resolved startup transaction is applied idempotently before versioned persistence is enabled. */
  useEffect(() => {
    if (runtimeBootstrap.status === "loading") return;
    if (runtimeBootstrap.status === "error") {
      setFatalError(runtimeBootstrap.message);
      return;
    }

    const result = runtimeBootstrap.result;
    if (appliedRuntimeBootstrapResultRef.current === result) return;
    appliedRuntimeBootstrapResultRef.current = result;

    if (result.setupReplacement) {
      setForm(result.setupReplacement.form);
      setDefaultForm(result.setupReplacement.defaultForm);
      setSetupMode(result.setupReplacement.setupMode);
      setCustomSetupsByMonster(result.setupReplacement.customSetupsByMonster);
      setCannonByMonster(result.setupReplacement.cannonByMonster);
      setDenseCompare(result.setupReplacement.denseCompare);
    }
    if (result.duelSnapshotsReplacement) {
      setDuelSnapshots(result.duelSnapshotsReplacement);
    }
    if (result.contextInvalidItemIds.length > 0) {
      blockContextInvalidLocalState(result.contextInvalidItemIds, result.recoveryNotice);
    }
    setBundledPriceSet(result.bundledPriceSet);
    setBasePriceSet(result.basePriceSet);
    setManualPriceOverrides(result.manualPriceOverrides);
    setScheduledSnapshotStatus(result.scheduledSnapshotStatus);
    setActivePriceSetOrigin(result.activePriceSetOrigin);
    setStatus(result.statusMessage);
    setContext(result.context);
    setPriceLabel(result.priceLabel);
    if (result.marketNotice) setMarketNotice(result.marketNotice);
    setReadyToPersist(true);
  }, [blockContextInvalidLocalState, runtimeBootstrap]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const legacyMigrationReport = useMemo<LegacySetupMigrationReport | null>(() => {
    if (!context || legacyMigrationDismissed) return null;
    try {
      const report = inspectLegacySetupMigration({
        storage,
        gameData: context.gameData,
        currentCustomSetupsByMonster: customSetupsByMonster,
        currentCannonByMonster: cannonByMonster,
        currentDuelSnapshots: duelSnapshots
      });
      return report.foundKeys.length > 0 ? report : null;
    } catch {
      return null;
    }
  }, [cannonByMonster, context, customSetupsByMonster, duelSnapshots, legacyMigrationDismissed]);
  const denseCompareForGameData = useMemo(
    () =>
      context
        ? cleanDenseCompareStateForMonsterIds(denseCompare, Object.keys(context.gameData.monsters))
        : denseCompare,
    [context, denseCompare]
  );
  const lootPrefsForGameData = useMemo(() => {
    if (!context) return lootPrefsByMonster;
    const next: LootPrefsState = {};
    for (const [monsterId, monsterPrefs] of Object.entries(lootPrefsByMonster)) {
      const monster = context.gameData.monsters[monsterId];
      if (!monster) continue;
      const selected = selectLootPrefsForMonster(
        { [monsterId]: monsterPrefs },
        monsterId,
        lootPreferenceKeysForMonster(monster)
      );
      if (Object.keys(selected).length > 0) next[monsterId] = selected;
    }
    return next;
  }, [context, lootPrefsByMonster]);

  /* eslint-disable react-hooks/exhaustive-deps -- These effects synchronize versioned app state to browser storage and surface sanitized storage failures. */
  useEffect(() => {
    if (!readyToPersist || localStateRecovery.shouldSkipPersist("rewrite-setup")) return;
    localStateRecovery.persist(
      "rewrite-setup",
      setupStorageOptions,
      savedSetupFromForm(
        form,
        denseCompareForGameData,
        cannonByMonster,
        customSetupsByMonster,
        defaultForm,
        setupMode
      )
    );
  }, [
    cannonByMonster,
    customSetupsByMonster,
    defaultForm,
    denseCompareForGameData,
    form,
    localStateRecovery.blockedIds,
    readyToPersist,
    setupMode
  ]);

  useEffect(() => {
    if (!readyToPersist || localStateRecovery.shouldSkipPersist("loot-prefs")) return;
    localStateRecovery.persist("loot-prefs", lootPrefsStorageOptions, lootPrefsForGameData);
  }, [localStateRecovery.blockedIds, lootPrefsForGameData, readyToPersist]);

  useEffect(() => {
    if (!readyToPersist || localStateRecovery.shouldSkipPersist("loot-settings")) return;
    localStateRecovery.persist("loot-settings", lootSettingsStorageOptions, lootSettingsByMonster);
  }, [localStateRecovery.blockedIds, lootSettingsByMonster, readyToPersist]);

  useEffect(() => {
    if (!readyToPersist || localStateRecovery.shouldSkipPersist("hidden-gear-tiers")) return;
    localStateRecovery.persist("hidden-gear-tiers", hiddenGearTiersStorageOptions, hiddenGearTiers);
  }, [hiddenGearTiers, localStateRecovery.blockedIds, readyToPersist]);

  useEffect(() => {
    if (!readyToPersist || localStateRecovery.shouldSkipPersist("duel-snapshots")) return;
    localStateRecovery.persist("duel-snapshots", duelSnapshotsStorageOptions, duelSnapshots);
  }, [duelSnapshots, localStateRecovery.blockedIds, readyToPersist]);

  useEffect(() => {
    if (
      !readyToPersist ||
      priceHistory.snapshots.length === 0 ||
      localStateRecovery.shouldSkipPersist("price-history")
    ) {
      return;
    }
    localStateRecovery.persist("price-history", priceHistoryStorageOptions, priceHistory);
  }, [localStateRecovery.blockedIds, priceHistory, readyToPersist]);

  useEffect(() => {
    if (!readyToPersist || localStateRecovery.shouldSkipPersist("planner-ui")) return;
    localStateRecovery.persist("planner-ui", plannerUiStorageOptions, plannerState);
  }, [localStateRecovery.blockedIds, plannerState, readyToPersist]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const currentLootRowIds = useMemo(() => {
    if (!context) return [];
    const monster = context.gameData.monsters[form.monsterId];
    return monster ? lootPreferenceKeysForMonster(monster) : [];
  }, [context, form.monsterId]);
  const currentLootPrefs = useMemo(
    () => selectLootPrefsForMonster(lootPrefsForGameData, form.monsterId, currentLootRowIds),
    [currentLootRowIds, form.monsterId, lootPrefsForGameData]
  );
  const currentLootSettings = useMemo(
    () => lootSettingsForMonster(lootSettingsByMonster, form.monsterId),
    [form.monsterId, lootSettingsByMonster]
  );
  const receivedShareableSetupInspection = useMemo<ShareableSetupInspection | null>(() => {
    if (!context || !receivedShareableSetupPayload) return null;
    try {
      const envelope = decodeShareableSetupEnvelope(receivedShareableSetupPayload);
      return { status: "ready", review: reviewShareableSetup(envelope, context.gameData) };
    } catch (error) {
      return { status: "error", message: describeShareableSetupError(error) };
    }
  }, [context, receivedShareableSetupPayload]);
  const priceHistoryItemLabels = useMemo(
    () => createPriceItemLabels(context?.gameData ?? null),
    [context]
  );
  const priceHistorySources = useMemo(
    () => createPriceHistorySources({ scheduledSnapshotStatus, localPriceHistory: priceHistory }),
    [priceHistory, scheduledSnapshotStatus]
  );
  const economyHistory = useMemo(
    () =>
      createEconomyHistoryPresentation({
        sources: priceHistorySources,
        itemLabels: priceHistoryItemLabels,
        controls: {
          baselineMode: economyBaselineMode,
          snapshotKey: economySnapshotKey,
          itemFilter: economyItemFilter,
          trendItemId: economyTrendItemId,
          sort: economySort
        }
      }),
    [
      economyBaselineMode,
      economyItemFilter,
      economySnapshotKey,
      economySort,
      economyTrendItemId,
      priceHistoryItemLabels,
      priceHistorySources
    ]
  );
  const priceHistorySummary = useMemo(
    () =>
      createPriceHistorySummaryPresentation({
        analysisState: priceHistorySources.analysisState,
        activePriceSet: context?.priceSet ?? null,
        evaluatedAt: new Date()
      }),
    [context?.priceSet, priceHistorySources.analysisState]
  );
  const lootPriceHistoryByItem: Readonly<Record<string, ItemPriceHistoryContext>> =
    economyHistory.lootHistoryByItem;

  const viewModel = useMemo(
    () =>
      context
        ? createSimulationViewModel(
            form,
            context,
            cannonByMonster,
            currentLootPrefs,
            lootSettingsByMonster,
            {
              lootPriceHistoryByItem,
              activeAssumptions: {
                setupMode,
                hasCustomSetup: customSetupsByMonster[form.monsterId] != null,
                hiddenGearTierCount: Object.values(hiddenGearTiers).filter(Boolean).length
              },
              monsterCard: {
                setupMode,
                hasCustomSetup: customSetupsByMonster[form.monsterId] != null
              }
            }
          )
        : null,
    [
      cannonByMonster,
      context,
      currentLootPrefs,
      customSetupsByMonster,
      form,
      hiddenGearTiers,
      lootPriceHistoryByItem,
      lootSettingsByMonster,
      setupMode
    ]
  );
  const derivedViewModel = useMemo(
    () =>
      context
        ? createSimulationViewModel(
            { ...form, manualOverrides: DEFAULT_MANUAL_OVERRIDES },
            context,
            cannonByMonster,
            currentLootPrefs,
            lootSettingsByMonster
          )
        : null,
    [cannonByMonster, context, currentLootPrefs, form, lootSettingsByMonster]
  );
  const compareCalculation = useCompareCalculation({
    active: activeTab === "compare",
    form,
    context,
    cannonByMonster,
    lootPrefsByMonster: lootPrefsForGameData,
    customSetupsByMonster,
    lootSettingsByMonster,
    denseCompare: denseCompareForGameData
  });
  const duelPane = useDuelPane({
    active: activeTab === "duel",
    form,
    snapshots: duelSnapshots,
    context,
    cannonByMonster,
    lootPrefsByMonster: lootPrefsForGameData,
    lootSettingsByMonster,
    onStatus: setStatus
  });
  const plannerCalculation = usePlannerCalculation({
    active: activeTab === "planner",
    draftState: plannerState,
    form,
    context,
    lootSettingsByMonster
  });
  const riskAnalysis = useRiskAnalysis({
    form,
    context,
    cannonByMonster,
    lootPrefs: currentLootPrefs,
    lootSettingsByMonster,
    targetDropCandidates: viewModel?.lootRows ?? [],
    onStatus: setStatus
  });
  const freshRisk = riskAnalysis.fresh;
  const {
    rows: denseCompareRows,
    scale: denseCompareScale,
    totalRows: denseCompareTotalRows,
    pending: denseComparePending,
    freshnessLabel: denseCompareFreshnessLabel,
    freshnessSummary: denseCompareFreshnessSummary,
    freshnessAria: denseCompareFreshnessAria
  } = compareCalculation;
  const {
    comparison: duelComparison,
    viewMode: duelViewMode,
    expandedDiffId: expandedDuelDiffId,
    matrixMetric: duelMatrixMetric,
    matrixFilter: duelMatrixFilter,
    matrix: duelMatrix,
    filteredMatrixRows: filteredDuelMatrixRows,
    matrixBusy: duelMatrixBusy,
    showCurrentTarget: showCurrentDuelTarget,
    showMonsterMatrix: showDuelMonsterMatrix,
    toggleDiff: toggleDuelDiff,
    setMatrixMetric: setDuelMatrixMetric,
    setMatrixFilter: setDuelMatrixFilter,
    buildMatrix: buildDuelMatrix
  } = duelPane;
  const {
    panel: plannerPanel,
    gearPoolEditor: plannerGearPoolEditor,
    error: plannerError,
    pending: plannerPending,
    status: plannerStatus,
    computedMetric: plannerComputedMetric,
    recompute: recomputePlanner
  } = plannerCalculation;
  const hiscoresPreviewRows = useMemo(
    () =>
      isHiscoresPreviewCurrent(hiscores.player, hiscores.response)
        ? createHiscoresPreviewRows(form, hiscores.response)
        : [],
    [form, hiscores.player, hiscores.response]
  );
  const canApplyHiscores = canApplyHiscoresPreview(hiscores.player, hiscores.response);

  const monsters = useMemo(() => (context ? monsterOptions(context.gameData) : []), [context]);
  const styles = useMemo(
    () => (context ? styleOptions(context.gameData, form.combatStyle, form.weaponId) : []),
    [context, form.combatStyle, form.weaponId]
  );
  const weaponSelectOptions = useMemo<SelectOption[]>(
    () =>
      context
        ? filterHiddenGearTierOptions(
            weaponOptions(context.gameData, form.combatStyle),
            hiddenGearTiers,
            form.weaponId
          )
        : [],
    [context, form.combatStyle, form.weaponId, hiddenGearTiers]
  );
  const ammoSelectOptions = useMemo<SelectOption[]>(() => {
    if (!context) return [];
    const weapon = context.gameData.weapons[form.weaponId];
    return filterHiddenGearTierOptions(
      ammoOptions(context.gameData, weapon?.sub === "thrown" ? "thrown" : "arrow"),
      hiddenGearTiers,
      form.ammoId
    );
  }, [context, form.ammoId, form.weaponId, hiddenGearTiers]);
  const spellSelectOptions = useMemo<SelectOption[]>(
    () => (context ? spellOptions(context.gameData) : []),
    [context]
  );
  const gearSelectOptions = useMemo(
    () =>
      context
        ? (Object.fromEntries(
            EQUIPMENT_SLOTS.map((slot) => [
              slot,
              filterHiddenGearTierOptions(
                equipmentSlotOptions(context.gameData, slot),
                hiddenGearTiers,
                form.gear[slot] ?? "none"
              )
            ])
          ) as Record<EquipmentSlot, SelectOption[]>)
        : emptyGearSelectOptions(),
    [context, form.gear, hiddenGearTiers]
  );
  const currentWeapon = context?.gameData.weapons[form.weaponId] ?? null;
  const currentWeaponTwoHanded = currentWeapon?.twoHand === true;
  const gearQuickActions = useMemo(
    () =>
      Object.fromEntries(
        EQUIPMENT_SLOTS.map((slot) => [
          slot,
          context
            ? gearQuickActionForSlot({
                gameData: context.gameData,
                slot,
                combatStyle: form.combatStyle,
                weaponId: form.weaponId,
                styleId: form.styleId,
                currentItemId: form.gear[slot] ?? "none",
                levels: form.levels,
                options: gearSelectOptions[slot],
                shieldLocked: slot === "shield" && currentWeaponTwoHanded
              })
            : {
                itemId: "none",
                itemLabel: "None",
                disabled: true,
                reason: "Game data loading"
              }
        ])
      ) as Record<EquipmentSlot, ReturnType<typeof gearQuickActionForSlot>>,
    [
      context,
      currentWeaponTwoHanded,
      form.combatStyle,
      form.gear,
      form.levels,
      form.styleId,
      form.weaponId,
      gearSelectOptions
    ]
  );
  const loadoutBonuses = useMemo(
    () =>
      context
        ? loadoutToCombatBonuses(
            { weaponId: form.weaponId, ammoId: form.ammoId, gear: form.gear },
            form.combatStyle,
            context.gameData
          )
        : null,
    [context, form.ammoId, form.combatStyle, form.gear, form.weaponId]
  );
  const specialAttackOptions = useMemo<SelectOption[]>(
    () =>
      filterHiddenGearTierOptions(
        [
          { id: "none", label: "None" },
          ...(context
            ? supportedSpecialAttacksForCombatStyle(form.combatStyle, context.gameData).map(
                (attack) => ({
                  id: attack.weaponId,
                  label: context.gameData.weapons[attack.weaponId]?.name ?? attack.weaponId
                })
              )
            : [])
        ],
        hiddenGearTiers,
        form.specialAttack.weaponId
      ),
    [context, form.combatStyle, form.specialAttack.weaponId, hiddenGearTiers]
  );
  const specialAttackMeta = useMemo(
    () =>
      context
        ? (supportedSpecialAttacksForCombatStyle(form.combatStyle, context.gameData).find(
            (attack) => attack.weaponId === form.specialAttack.weaponId
          ) ?? null)
        : null,
    [context, form.combatStyle, form.specialAttack.weaponId]
  );
  const arrowAmmoOptions = useMemo<SelectOption[]>(
    () =>
      context
        ? filterHiddenGearTierOptions(
            Object.entries(context.gameData.ammo)
              .filter(([, ammo]) => ammo.kind === "arrow")
              .map(([id, ammo]) => ({ id, label: ammo.name }))
              .sort((left, right) => left.label.localeCompare(right.label)),
            hiddenGearTiers,
            form.specialAttack.ammoId !== "none" ? form.specialAttack.ammoId : form.ammoId
          )
        : [],
    [context, form.ammoId, form.specialAttack.ammoId, hiddenGearTiers]
  );
  const commitFormState = (nextForm: CombatSetupFormState, mode: SetupMode = setupMode) => {
    const normalized = normalizeFormState(nextForm);
    setForm(normalized);
    if (mode === "custom") {
      setCustomSetupsByMonster((current) => setCustomSetupForMonster(current, normalized));
    } else {
      setDefaultForm(normalized);
    }
  };

  const setFormSafe = (updater: (current: CombatSetupFormState) => CombatSetupFormState) => {
    commitFormState(updater(form));
  };

  const setSpecialAttackWeapon = (weaponId: string) => {
    setFormSafe((current) => {
      if (weaponId === "none") {
        return updateForm(current, { specialAttack: DEFAULT_SPECIAL_ATTACK_STATE });
      }
      const needsAmmo = current.combatStyle === "ranged";
      const ammoId =
        needsAmmo && current.specialAttack.ammoId !== "none"
          ? current.specialAttack.ammoId
          : needsAmmo && current.ammoId !== "none"
            ? current.ammoId
            : needsAmmo
              ? "rune_arrow"
              : "none";
      return updateForm(current, { specialAttack: { weaponId, ammoId } });
    });
  };

  const setWeaponSelection = (weaponId: string) => {
    if (!context) return;
    setFormSafe((current) => applyWeaponSelection(current, weaponId, context.gameData));
  };

  const setAmmoSelection = (ammoId: string) => {
    if (!context) return;
    setFormSafe((current) => {
      const weapon = context.gameData.weapons[current.weaponId];
      const ammo = context.gameData.ammo[ammoId];
      if (current.combatStyle !== "ranged" || weapon?.sub === "thrown") return current;
      if (ammoId !== "none" && (!ammo || ammo.kind !== "arrow")) return current;
      return updateForm(current, { ammoId });
    });
  };

  const setSpellSelection = (spellId: string) => {
    if (!context?.gameData.spells[spellId]) return;
    setFormSafe((current) => updateForm(current, { spellId }));
  };

  const setGearSelection = (slot: EquipmentSlot, itemId: string) => {
    if (!context) return;
    if (itemId !== "none" && !context.gameData.equipment[slot]?.[itemId]) return;
    setFormSafe((current) => {
      const weapon = context.gameData.weapons[current.weaponId];
      if (slot === "shield" && weapon?.twoHand) {
        return updateForm(current, { gear: { ...current.gear, shield: "none" } });
      }
      return updateForm(current, { gear: { ...current.gear, [slot]: itemId } });
    });
  };

  const setUndoableStatus = (label: string, restoreLabel: string, restore: () => void) => {
    setPendingUndo({
      id: localUndoId(),
      label,
      restoreLabel,
      createdAt: Date.now(),
      restore
    });
    setStatus(label);
  };

  const optimizeCurrentLoadout = () => {
    if (!context) return;
    const previousForm = form;
    const result = optimizeVisibleLoadout({
      form,
      context,
      weaponOptions: weaponSelectOptions,
      gearOptions: gearSelectOptions,
      eligibilityPolicy: respectLoadoutRequirements
        ? "respect-current-levels"
        : "ignore-requirements"
    });
    const monsterName = context.gameData.monsters[form.monsterId]?.name ?? form.monsterId;
    if (!result.changedFields.length) {
      setStatus(
        `Current loadout is already best ${respectLoadoutRequirements ? "eligible " : ""}visible for ${monsterName}`
      );
      return;
    }
    commitFormState(result.form);
    const capLabel = result.capped ? ", bounded search" : "";
    const detail = `Optimized loadout for ${monsterName}: +${formatNumber(
      result.dpsDeltaPct,
      2
    )}% normal DPS, ${formatNumber(result.changedFields.length)} fields${capLabel}${
      result.excludedCandidateCount > 0
        ? `, ${formatNumber(result.excludedCandidateCount)} ineligible choices skipped`
        : ""
    }`;
    setUndoableStatus(detail, `Restored loadout for ${monsterName}`, () => {
      commitFormState(previousForm);
    });
  };

  const undoPendingAction = () => {
    if (!pendingUndo) return;
    pendingUndo.restore();
    setStatus(pendingUndo.restoreLabel);
    setPendingUndo(null);
  };

  const applyAcceptedPriceSet = (outcome: AcceptedPriceSetOutcome) => {
    setBasePriceSet(outcome.basePriceSet);
    setManualPriceDraft(null);
    setManualPriceClearPending(false);
    setContext((current) => (current ? { ...current, priceSet: outcome.activePriceSet } : current));
    setPriceHistory(outcome.priceHistoryUpdate);
    setPriceLabel(outcome.activePriceSet.label);
    setActivePriceSetOrigin(outcome.activePriceSetOrigin);
    setStatus(outcome.appStatus);
    setMarketNotice(outcome.marketNotice);
    setFatalError(null);
  };

  const acceptPriceSet = (priceSet: PriceSet, acceptedAt: Date, nextStatus: string) => {
    if (!context) return;
    applyAcceptedPriceSet(
      priceSetTransfer.acceptPriceSet({
        priceSet,
        acceptedAt,
        nextStatus,
        gameData: context.gameData,
        manualPriceOverrides
      })
    );
  };

  const importPriceFile = async (file: File, surface: PriceImportSurface): Promise<void> => {
    if (!context) return;
    const outcome = await priceSetTransfer.importFile(file, {
      surface,
      gameData: context.gameData,
      manualPriceOverrides
    });
    if (outcome.status === "ready") applyAcceptedPriceSet(outcome);
  };

  const importSetupFile = async (file: File): Promise<void> => {
    if (!context) return;
    const outcome = await setupFileTransfer.importFile(file, context.gameData);
    if (outcome.status !== "ready") return;
    setForm(normalizeFormState(outcome.setup.form));
    setDefaultForm(normalizeFormState(outcome.setup.defaultForm));
    setSetupMode(outcome.setup.setupMode);
    setCustomSetupsByMonster(outcome.setup.customSetupsByMonster);
    setDenseCompare(outcome.setup.denseCompare);
    setCannonByMonster(outcome.setup.cannonByMonster);
    setStatus(outcome.appStatus);
    setFatalError(null);
  };

  const exportCurrentSetup = (): void => {
    setupFileTransfer.exportSetup(
      savedSetupFromForm(
        form,
        denseCompare,
        cannonByMonster,
        customSetupsByMonster,
        defaultForm,
        setupMode
      )
    );
  };

  const dismissLegacyMigration = (report: LegacySetupMigrationReport, message: string): void => {
    localStateRecovery.persist(
      "legacy-migration-dismissed",
      legacyMigrationDismissedStorageOptions,
      {
        dismissedAt: new Date().toISOString(),
        foundKeys: report.foundKeys
      }
    );
    setLegacyMigrationDismissed(true);
    setLegacyClearPending(false);
    setStatus(message);
  };

  const importLegacySetup = () => {
    if (
      !legacyMigrationReport?.setup &&
      legacyMigrationReport?.customSetupsByMonster == null &&
      legacyMigrationReport?.cannonByMonster == null &&
      legacyMigrationReport?.duelSnapshots == null &&
      legacyMigrationReport?.lootPrefs == null &&
      !legacyMigrationReport?.hiddenGearTiers &&
      !legacyMigrationReport?.denseCompareSort &&
      !legacyMigrationReport?.irrelevantMonsterIds &&
      !legacyMigrationReport?.hiscoresPlayer &&
      !legacyMigrationReport?.priceSet
    ) {
      return;
    }
    const hasDenseCompareImport =
      legacyMigrationReport.denseCompareSort != null ||
      legacyMigrationReport.irrelevantMonsterIds != null;
    let nextDenseCompare = denseCompare;
    if (hasDenseCompareImport) {
      nextDenseCompare = {
        ...denseCompare,
        ...(legacyMigrationReport.denseCompareSort
          ? { sort: legacyMigrationReport.denseCompareSort }
          : {}),
        ...(legacyMigrationReport.irrelevantMonsterIds != null
          ? { irrelevantMonsterIds: legacyMigrationReport.irrelevantMonsterIds }
          : {})
      };
      if (context) {
        nextDenseCompare = cleanDenseCompareStateForMonsterIds(
          nextDenseCompare,
          Object.keys(context.gameData.monsters)
        );
      }
    }
    const hasRewriteSetupImport =
      legacyMigrationReport.setup != null ||
      hasDenseCompareImport ||
      legacyMigrationReport.customSetupsByMonster != null ||
      legacyMigrationReport.cannonByMonster != null;
    if (hasRewriteSetupImport) {
      const nextCustomSetupsByMonster =
        legacyMigrationReport.customSetupsByMonster != null
          ? {
              ...legacyMigrationReport.customSetupsByMonster,
              ...customSetupsByMonster
            }
          : customSetupsByMonster;
      const nextCannonByMonster =
        legacyMigrationReport.cannonByMonster != null
          ? {
              ...legacyMigrationReport.cannonByMonster,
              ...cannonByMonster
            }
          : cannonByMonster;
      const setup = legacyMigrationReport.setup
        ? savedSetupFromForm(
            legacyMigrationReport.setup,
            nextDenseCompare,
            nextCannonByMonster,
            nextCustomSetupsByMonster
          )
        : savedSetupFromForm(
            form,
            nextDenseCompare,
            nextCannonByMonster,
            nextCustomSetupsByMonster,
            defaultForm,
            setupMode
          );
      localStateRecovery.persist("rewrite-setup", setupStorageOptions, setup);
      setForm(normalizeFormState(setup.form));
      setDefaultForm(normalizeFormState(setup.defaultForm));
      setSetupMode(setup.setupMode);
      setCustomSetupsByMonster(setup.customSetupsByMonster);
      setDenseCompare(setup.denseCompare);
      setCannonByMonster(setup.cannonByMonster);
      localStateRecovery.unblockReplaced(["rewrite-setup"]);
    }
    if (legacyMigrationReport.lootPrefs != null) {
      const nextLootPrefs = mergeLootPrefsState(
        lootPrefsForGameData,
        legacyMigrationReport.lootPrefs
      );
      localStateRecovery.persist("loot-prefs", lootPrefsStorageOptions, nextLootPrefs);
      setLootPrefsByMonster(nextLootPrefs);
      localStateRecovery.unblockReplaced(["loot-prefs"]);
    }
    if (legacyMigrationReport.duelSnapshots != null) {
      const merged = mergeDuelSnapshots(duelSnapshots, legacyMigrationReport.duelSnapshots);
      localStateRecovery.persist("duel-snapshots", duelSnapshotsStorageOptions, merged.state);
      setDuelSnapshots(merged.state);
      localStateRecovery.unblockReplaced(["duel-snapshots"]);
    }
    if (legacyMigrationReport.hiddenGearTiers != null) {
      localStateRecovery.persist(
        "hidden-gear-tiers",
        hiddenGearTiersStorageOptions,
        legacyMigrationReport.hiddenGearTiers
      );
      setHiddenGearTiers(legacyMigrationReport.hiddenGearTiers);
      localStateRecovery.unblockReplaced(["hidden-gear-tiers"]);
    }
    if (legacyMigrationReport.hiscoresPlayer) {
      hiscores.replacePersistedPlayer(legacyMigrationReport.hiscoresPlayer);
    }
    if (legacyMigrationReport.priceSet) {
      const priceSet = legacyMigrationReport.priceSet;
      const acceptedAt = new Date();
      acceptPriceSet(priceSet, acceptedAt, "Imported compatible legacy PriceSet");
    }
    setFatalError(null);
    localStateRecovery.refresh();
    dismissLegacyMigration(legacyMigrationReport, "Imported compatible legacy data");
  };

  const keepLegacyData = () => {
    if (!legacyMigrationReport) return;
    dismissLegacyMigration(legacyMigrationReport, "Kept legacy data");
  };

  const confirmClearLegacyData = () => {
    if (!legacyMigrationReport) return;
    let clearedKeys: LegacyStorageKey[];
    try {
      clearedKeys = clearKnownLegacyStorageKeys(storage);
    } catch {
      localStateRecovery.recordStorageFailure("legacy-migration-dismissed", "clear_failed");
      setStatus("Could not clear legacy data. Local storage is unavailable.");
      return;
    }
    dismissLegacyMigration(
      { ...legacyMigrationReport, foundKeys: clearedKeys },
      `Cleared ${clearedKeys.length} legacy keys`
    );
  };

  const confirmClearLocalStateItem = (itemId: LocalStateHealthItemId) => {
    const outcome = localStateRecovery.confirmClearItem(itemId);
    if (outcome.clearedIds.includes("manual-price-overrides")) {
      setManualPriceOverrides(DEFAULT_MANUAL_PRICE_OVERRIDES_STATE);
      setManualPriceDraft(null);
      setManualPriceClearPending(false);
      if (basePriceSet) {
        const restoredPriceSet = applyManualPriceOverrides(
          basePriceSet,
          DEFAULT_MANUAL_PRICE_OVERRIDES_STATE
        );
        setContext((current) => (current ? { ...current, priceSet: restoredPriceSet } : current));
        setPriceLabel(restoredPriceSet.label);
      }
    }
  };

  const confirmClearInvalidLocalState = () => {
    localStateRecovery.confirmClearInvalid();
  };

  const applyHiscoresPreview = () => {
    const outcome = hiscores.prepareApply();
    if (outcome.status === "stale") return;
    setFormSafe((current) => applyHiscoresLevels(current, outcome.response));
    hiscores.recordApplied(outcome.applicableSkillCount);
  };

  const saveLocalPriceComparison = () => {
    if (!context) return;
    const capturedAt = new Date();
    setPriceHistory((current) =>
      appendAcceptedPriceSetToHistory(current, context.priceSet, capturedAt)
    );
    setPriceHistoryClearPending(false);
    setStatus("Saved local price comparison");
    setMarketNotice({ tone: "success", message: "Saved active prices as a local comparison" });
  };

  const requestClearPriceHistory = () => {
    setPriceHistoryClearPending(true);
    setMarketNotice({ tone: "neutral", message: "Confirm clearing local comparison history" });
  };

  const confirmClearPriceHistory = () => {
    const cleared = tryClearPersisted(priceHistoryStorageOptions);
    const persistedClear = cleared.status === "cleared" && !localStorageAccessUnavailable;
    if (cleared.status === "failed") {
      localStateRecovery.recordStorageFailure("price-history", cleared.reason);
    } else if (persistedClear) {
      localStateRecovery.clearStorageFailures(["price-history"]);
    } else {
      localStateRecovery.markPersistenceUnavailable();
    }
    setPriceHistory(DEFAULT_PRICE_HISTORY_STATE);
    setPriceHistoryClearPending(false);
    setStatus(!persistedClear ? "Cleared price history for this session" : "Cleared price history");
    setMarketNotice({
      tone: !persistedClear ? "neutral" : "success",
      message: !persistedClear
        ? "Cleared price history for this session. Local storage is unavailable, so reload may restore it."
        : "Cleared local comparison history"
    });
  };

  const updateEconomySort = (key: PriceHistoryMoverSortKey) => {
    setEconomySort((current) =>
      current.key === key
        ? { ...current, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "item" ? "asc" : "desc" }
    );
  };

  if (fatalError) {
    return (
      <main className="app-shell">
        <section className="fatal" role="alert">
          <h1>2004scape Combat Simulator</h1>
          <p>{fatalError}</p>
        </section>
      </main>
    );
  }

  if (!context || !viewModel || !derivedViewModel) {
    return (
      <main className="app-shell">
        <section className="loading" aria-live="polite">
          {status}
        </section>
      </main>
    );
  }

  const setCombatStyle = (combatStyle: CombatStyle) =>
    setFormSafe((current) => switchCombatStyleLoadout(current, combatStyle));
  const selectCombatStyle = (combatStyle: CombatStyle) => {
    setActiveTab("loadout");
    setCombatStyle(combatStyle);
  };
  const activateWorkbenchTab = (tabId: WorkbenchTabId) => setActiveTab(tabId);

  const reviewActiveAssumption = (tab: ActiveAssumptionReviewTarget) => {
    if (tab === "melee" || tab === "ranged" || tab === "magic") {
      setCombatStyle(tab);
      setActiveTab("loadout");
      return;
    }
    setActiveTab(tab);
  };

  const updateLevel = (skill: keyof CombatSetupFormState["levels"], value: number) =>
    setFormSafe((current) =>
      updateForm(current, {
        levels: { ...current.levels, [skill]: value }
      })
    );

  const updatePlannerMetric = (metric: PlannerMetric) =>
    setPlannerState((current) => normalizePlannerUiState({ ...current, metric }));

  const updatePlannerTargetLevel = (skill: PlannerSkill, value: number) =>
    setPlannerState((current) =>
      normalizePlannerUiState({
        ...current,
        targetLevels: { ...current.targetLevels, [skill]: value }
      })
    );

  const updatePlannerCurrentXp = (skill: PlannerSkill, value: number) =>
    setPlannerState((current) =>
      normalizePlannerUiState({
        ...current,
        currentXp: { ...current.currentXp, [skill]: value }
      })
    );

  const updatePlannerSkillLock = (skill: PlannerSkill, locked: boolean) =>
    setPlannerState((current) =>
      normalizePlannerUiState({
        ...current,
        skillLocks: { ...current.skillLocks, [skill]: locked }
      })
    );

  const updatePlannerOnlyCurrentGear = (onlyCurrentGear: boolean) =>
    setPlannerState((current) => normalizePlannerUiState({ ...current, onlyCurrentGear }));

  const updatePlannerAverageOverSession = (averageOverSession: boolean) =>
    setPlannerState((current) => normalizePlannerUiState({ ...current, averageOverSession }));

  const updatePlannerGearPoolItem = (slot: PlannerGearSlot, itemId: string, selected: boolean) => {
    if (!context) return;
    const allowedPool = plannerAllowedPool(form.combatStyle, context);
    setPlannerState((current) =>
      setPlannerGearPoolItem(current, allowedPool, slot, itemId, selected)
    );
  };

  const resetPlannerGearPool = (slot: PlannerGearSlot) =>
    setPlannerState((current) => resetPlannerGearPoolSlot(current, slot));

  const setManualOverride = (
    key: keyof CombatSetupFormState["manualOverrides"],
    value: number | null
  ) =>
    setFormSafe((current) =>
      updateForm(current, {
        manualOverrides: { ...current.manualOverrides, [key]: value }
      })
    );

  const resetManualOverrides = () =>
    setFormSafe((current) => updateForm(current, { manualOverrides: DEFAULT_MANUAL_OVERRIDES }));

  const selectTarget = (monsterId: EntityId) => {
    const target = formForMonsterSetup(defaultForm, customSetupsByMonster, monsterId);
    setSetupMode(target.setupMode);
    setForm(target.form);
  };

  const setDenseMonsterFilter = (value: string) =>
    setDenseCompare((current) => ({ ...current, monsterFilter: value }));

  const setDenseDropFilter = (value: string) =>
    setDenseCompare((current) => ({ ...current, dropFilter: value }));

  const setDenseShowIrrelevant = (value: boolean) =>
    setDenseCompare((current) => ({ ...current, showIrrelevant: value }));

  const resetDenseFilters = () => setDenseCompare((current) => resetDenseCompareFilters(current));

  const toggleDenseIrrelevant = (monsterId: EntityId) =>
    setDenseCompare((current) => toggleDenseCompareMonsterIrrelevant(current, monsterId));

  const dbaSpecActive = form.combatStyle === "melee" && form.boosts.includes("dba_spec");
  const currentMonster = context.gameData.monsters[form.monsterId];
  const currentCustomSetup = customSetupsByMonster[form.monsterId] ?? null;
  const hasCurrentCustomSetup = currentCustomSetup != null;
  const activeSetupIsCustom = setupMode === "custom" && hasCurrentCustomSetup;
  const snapshotCurrentSetup = () => {
    const snapshot = createDuelSnapshot(
      createDuelSnapshotId(),
      defaultDuelSnapshotName(viewModel, duelSnapshots.snapshots.length),
      form
    );
    setDuelSnapshots((current) => appendDuelSnapshot(current, snapshot));
    setDuelImportNotice(null);
    setStatus(`Saved setup: ${snapshot.name}`);
  };
  const exportDuelSnapshots = () => {
    downloadJsonFile(
      "index-sim-saved-setups.json",
      createDuelSnapshotsExport(duelSnapshots, new Date())
    );
    setDuelImportNotice({
      tone: "success",
      message: `Exported ${duelSnapshots.snapshots.length} saved setups.`
    });
    setStatus("Exported saved setups");
  };
  const importDuelSnapshots = async (file: File): Promise<void> => {
    try {
      setDuelImportNotice(null);
      const imported = parseDuelSnapshotsExportText(
        await readBrowserFileText(file, DUEL_SNAPSHOTS_IMPORT_MAX_BYTES),
        DUEL_SNAPSHOTS_IMPORT_MAX_BYTES,
        context.gameData
      );
      const merged = mergeDuelSnapshots(duelSnapshots, imported.data);
      setDuelSnapshots(merged.state);
      localStateRecovery.unblockReplaced(["duel-snapshots"]);
      const skipped =
        merged.skippedCount > 0 ? ` ${merged.skippedCount} skipped at the limit.` : "";
      const message = `Imported saved setups: ${merged.addedCount} added, ${merged.updatedCount} updated.${skipped}`;
      setDuelImportNotice({ tone: "success", message });
      setStatus(message);
    } catch (caught) {
      setDuelImportNotice(describeDuelSnapshotsImportError(caught));
      setStatus("Saved setup import failed");
    }
  };
  const commitDuelSnapshotName = (snapshotId: string, name: string): boolean => {
    try {
      setDuelSnapshots((current) => renameDuelSnapshot(current, snapshotId, name));
      setStatus("Renamed saved setup");
      return true;
    } catch {
      setStatus("Saved setup name must not be empty");
      return false;
    }
  };
  const loadDuelSnapshot = (snapshotId: string) => {
    const snapshot = duelSnapshots.snapshots.find((candidate) => candidate.id === snapshotId);
    if (!snapshot) return;
    const nextForm = normalizeFormState({ ...snapshot.form, monsterId: form.monsterId });
    commitFormState(nextForm);
    setStatus(`Loaded saved setup: ${snapshot.name}`);
  };
  const deleteDuelSnapshot = (snapshotId: string) => {
    const snapshot = duelSnapshots.snapshots.find((candidate) => candidate.id === snapshotId);
    const previousDuelSnapshots = duelSnapshots;
    setDuelSnapshots((current) => removeDuelSnapshot(current, snapshotId));
    const label = snapshot ? `Deleted saved setup: ${snapshot.name}` : "Deleted saved setup";
    const restoreLabel = snapshot
      ? `Restored saved setup: ${snapshot.name}`
      : "Restored saved setup";
    setUndoableStatus(label, restoreLabel, () => {
      setDuelSnapshots(previousDuelSnapshots);
    });
  };
  const createCustomSetup = () => {
    const customForm = normalizeFormState(form);
    setCustomSetupsByMonster((current) => setCustomSetupForMonster(current, customForm));
    setSetupMode("custom");
    setForm(customForm);
    setStatus(`Created custom setup for ${currentMonster?.name ?? form.monsterId}`);
  };
  const editDefaultSetup = () => {
    const target = normalizeFormState({ ...defaultForm, monsterId: form.monsterId });
    setSetupMode("default");
    setForm(target);
    setStatus(`Editing default setup for ${currentMonster?.name ?? form.monsterId}`);
  };
  const editCustomSetup = () => {
    if (!currentCustomSetup) return;
    const target = normalizeFormState(currentCustomSetup);
    setSetupMode("custom");
    setForm(target);
    setStatus(`Editing custom setup for ${currentMonster?.name ?? form.monsterId}`);
  };
  const removeCurrentCustomSetup = () => {
    const monsterName = currentMonster?.name ?? form.monsterId;
    const previousCustomSetupsByMonster = customSetupsByMonster;
    const previousSetupMode = setupMode;
    const previousForm = form;
    const previousDefaultForm = defaultForm;
    setCustomSetupsByMonster((current) => removeCustomSetupForMonster(current, form.monsterId));
    const target = normalizeFormState({ ...defaultForm, monsterId: form.monsterId });
    setSetupMode("default");
    setForm(target);
    setUndoableStatus(
      `Removed custom setup for ${monsterName}`,
      `Restored custom setup for ${monsterName}`,
      () => {
        setCustomSetupsByMonster(previousCustomSetupsByMonster);
        setSetupMode(previousSetupMode);
        setDefaultForm(previousDefaultForm);
        setForm(previousForm);
      }
    );
  };
  const currentCannon = cannonByMonster[form.monsterId] ?? DEFAULT_CANNON_SETTINGS;
  const closeShareSetupDialog = () => {
    setShareDialog(null);
    window.queueMicrotask(() => shareSetupButtonRef.current?.focus());
  };
  const openShareSetupDialog = () => {
    try {
      const envelope = buildShareableSetupEnvelope({
        gameDataId: context.gameData.id,
        form,
        cannon: currentCannon,
        lootPreferences: currentLootPrefs,
        lootSettings: currentLootSettings
      });
      const url = createBrowserShareableSetupUrl(encodeShareableSetupEnvelope(envelope));
      setShareCreateNotice(null);
      setShareDialog({
        url,
        targetLabel: currentMonster?.name ?? form.monsterId,
        combatStyle: form.combatStyle,
        cannonEnabled: currentCannon.enabled === true,
        lootPreferenceCount: Object.keys(currentLootPrefs).length,
        copyStatus: "idle"
      });
    } catch (error) {
      setShareCreateNotice(describeShareableSetupError(error));
    }
  };
  const copyShareSetupUrl = async () => {
    if (!shareDialog) return;
    const copied = await writeShareableSetupToClipboard(shareDialog.url);
    setShareDialog((current) =>
      current ? { ...current, copyStatus: copied ? "copied" : "failed" } : null
    );
  };
  const loadReceivedShareableSetup = () => {
    if (receivedShareableSetupInspection?.status !== "ready") return;
    const previousDefaultForm = defaultForm;
    const previousSetupMode = setupMode;
    const previousActiveTab = activeTab;
    const applied = applyShareableSetup(
      {
        form,
        cannonByMonster,
        lootPrefsByMonster,
        lootSettingsByMonster
      },
      receivedShareableSetupInspection.review
    );
    setForm(applied.state.form);
    setDefaultForm(applied.state.form);
    setSetupMode("default");
    setCannonByMonster(applied.state.cannonByMonster);
    setLootPrefsByMonster(applied.state.lootPrefsByMonster);
    setLootSettingsByMonster(applied.state.lootSettingsByMonster);
    setActiveTab("loadout");
    setShareReviewDismissed(true);
    localStateRecovery.unblockReplaced(["rewrite-setup", "loot-prefs", "loot-settings"]);
    const monsterName =
      context.gameData.monsters[applied.state.form.monsterId]?.name ?? applied.state.form.monsterId;
    setUndoableStatus(`Loaded shared setup for ${monsterName}`, "Restored pre-share setup", () => {
      setForm(applied.undo.form);
      setDefaultForm(previousDefaultForm);
      setSetupMode(previousSetupMode);
      setCannonByMonster(applied.undo.cannonByMonster);
      setLootPrefsByMonster(applied.undo.lootPrefsByMonster);
      setLootSettingsByMonster(applied.undo.lootSettingsByMonster);
      setActiveTab(previousActiveTab);
    });
  };
  const currentCannonOutput = viewModel.trip.cannon;
  const cannonEnabled = currentCannon.enabled === true;
  const cannonTargets = currentCannon.targets ?? DEFAULT_CANNON_SETTINGS.targets ?? 3;
  const cannonRespawn =
    currentCannon.respawnSec ?? (currentMonster as unknown as { respawn?: number }).respawn ?? 60;
  const cannonTripSparseLinked =
    cannonEnabled &&
    form.trip.scarceSpot &&
    form.trip.targetsAtSpot === cannonTargets &&
    form.trip.respawnSeconds === cannonRespawn;
  const cannonHasCustomSettings = cannonByMonster[form.monsterId] != null;
  const tripPanePresentation = createTripPaneViewModel({ form, result: viewModel.trip });
  const potionCarrySummary = tripPanePresentation.potionCarrySummary;
  const prayerRestoreSourceSummary = tripPanePresentation.prayerRestoreSourceSummary;
  const lootPolicySummary = viewModel.loot.policySummary;
  const supplyGapPerKill = tripPanePresentation.supplyGapPerKill;
  const supplyCostsExceedLoot = tripPanePresentation.supplyCostsExceedLoot;
  const updateTrip = (patch: Partial<CombatSetupFormState["trip"]>) =>
    setFormSafe((current) =>
      updateForm(current, {
        trip: { ...current.trip, ...patch }
      })
    );
  const setCannonForCurrentMonster = (patch: Partial<CannonByMonsterState[string]>) => {
    setCannonByMonster((current) => {
      const previous = current[form.monsterId] ?? DEFAULT_CANNON_SETTINGS;
      return {
        ...current,
        [form.monsterId]: CannonSettingsSchema.parse({ ...previous, ...patch })
      };
    });
  };
  const resetCannonForCurrentMonster = () => {
    setCannonByMonster((current) => {
      if (!current[form.monsterId]) return current;
      const next = { ...current };
      delete next[form.monsterId];
      return next;
    });
  };
  const setTripSparseFromCannon = (linked: boolean) =>
    setFormSafe((current) =>
      updateForm(current, {
        trip: {
          ...current.trip,
          scarceSpot: linked,
          targetsAtSpot: linked ? cannonTargets : current.trip.targetsAtSpot,
          respawnSeconds: linked ? cannonRespawn : current.trip.respawnSeconds
        }
      })
    );
  const setCannonTargetsForCurrentMonster = (targets: number) => {
    const syncTrip = cannonTripSparseLinked;
    setCannonForCurrentMonster({ targets });
    if (syncTrip) {
      setFormSafe((current) =>
        updateForm(current, {
          trip: { ...current.trip, targetsAtSpot: targets }
        })
      );
    }
  };
  const setCannonRespawnForCurrentMonster = (respawnSec: number) => {
    const syncTrip = cannonTripSparseLinked;
    setCannonForCurrentMonster({ respawnSec });
    if (syncTrip) {
      setFormSafe((current) =>
        updateForm(current, {
          trip: { ...current.trip, respawnSeconds: respawnSec }
        })
      );
    }
  };
  const setLootSettingsForCurrentMonster = (patch: Partial<MonsterLootSettings>) => {
    setLootSettingsByMonster((current) =>
      setLootSettingsForMonster(current, form.monsterId, patch)
    );
  };
  const setLootActionForCurrentMonster = (row: LootDropRowViewModel, action: LootAction) => {
    if (!row.availableActions.includes(action)) return;
    setLootPrefsByMonster((current) =>
      setLootPreferenceForMonster(
        current,
        form.monsterId,
        row.rowId,
        action === row.defaultPref ? null : action
      )
    );
    setLootNotice(`${row.name}: ${lootActionLabel(action)}`);
  };
  const resetCurrentLootOverrides = () => {
    const monsterName = currentMonster?.name ?? form.monsterId;
    const previousLootPrefsByMonster = lootPrefsByMonster;
    setLootPrefsByMonster((current) => resetLootPrefsForMonster(current, form.monsterId));
    const label = `Reset loot overrides for ${monsterName}`;
    const restoreLabel = `Restored loot overrides for ${monsterName}`;
    setLootNotice(label);
    setUndoableStatus(label, restoreLabel, () => {
      setLootPrefsByMonster(previousLootPrefsByMonster);
      setLootNotice(restoreLabel);
    });
  };
  const resetCurrentLootSettings = () => {
    const monsterName = currentMonster?.name ?? form.monsterId;
    const previousLootSettingsByMonster = lootSettingsByMonster;
    setLootSettingsByMonster((current) => resetLootSettingsForMonster(current, form.monsterId));
    const label = `Reset loot settings for ${monsterName}`;
    const restoreLabel = `Restored loot settings for ${monsterName}`;
    setLootNotice(label);
    setUndoableStatus(label, restoreLabel, () => {
      setLootSettingsByMonster(previousLootSettingsByMonster);
      setLootNotice(restoreLabel);
    });
  };
  const resetTripSafespotOverride = () =>
    setFormSafe((current) =>
      updateForm(current, {
        trip: {
          ...current.trip,
          safespot: null
        }
      })
    );
  const resetTripScarceSpot = () =>
    setFormSafe((current) =>
      updateForm(current, {
        trip: {
          ...current.trip,
          scarceSpot: false
        }
      })
    );
  const resetActiveAssumption = (target: ActiveAssumptionResetTarget, statusLabel: string) => {
    if (target === "manual-combat-overrides") {
      resetManualOverrides();
    } else if (target === "cannon-enabled") {
      resetCannonForCurrentMonster();
    } else if (target === "loot-settings") {
      resetCurrentLootSettings();
    } else if (target === "loot-action-overrides") {
      resetCurrentLootOverrides();
    } else if (target === "scarce-spot") {
      resetTripScarceSpot();
    } else if (target === "explicit-safespot") {
      resetTripSafespotOverride();
    } else if (target === "hidden-gear-tiers") {
      setHiddenGearTiers(DEFAULT_HIDDEN_GEAR_TIERS_STATE);
    }
    setStatus(statusLabel);
  };
  const optimizeCurrentLoot = () => {
    const monsterName = currentMonster?.name ?? form.monsterId;
    const previousLootPrefsByMonster = lootPrefsByMonster;
    const result = optimizeLootPrefsForMonster(
      form,
      context,
      cannonByMonster,
      lootSettingsByMonster
    );
    setLootPrefsByMonster((current) =>
      replaceLootPrefsForMonster(current, form.monsterId, result.prefs)
    );
    const label = `Optimized loot actions for ${monsterName}`;
    const detail = `${label}: ${formatNumber(result.changedRows)} rows (${formatDelta(
      result.deltaNetGpPerHour
    )} net GP/hr)`;
    const restoreLabel = `Restored loot actions for ${monsterName}`;
    setLootNotice(detail);
    setUndoableStatus(detail, restoreLabel, () => {
      setLootPrefsByMonster(previousLootPrefsByMonster);
      setLootNotice(restoreLabel);
    });
  };
  const appShellSetup = createAppShellSetupViewModel({
    form,
    hasCurrentCustomSetup,
    activeSetupIsCustom,
    derivedAccuracyBonus: derivedViewModel.combat.debug.accuracyBonus,
    derivedDamageBonus: derivedViewModel.combat.debug.damageBonus,
    derivedAttackSpeedSec: derivedViewModel.combat.attackSpeedSec,
    potionCarrySummary,
    prayerRestoreSourceSummary,
    lootPolicySummary
  });
  const loadoutPaneViewModel = createLoadoutPaneViewModel({
    combatStyle: form.combatStyle,
    weaponId: form.weaponId,
    ammoId: form.ammoId,
    spellId: form.spellId,
    styleId: form.styleId,
    currentWeapon,
    weaponOptions: weaponSelectOptions,
    ammoOptions: ammoSelectOptions,
    spellOptions: spellSelectOptions,
    styleOptions: styles,
    primaryPrayer: appShellSetup.primaryPrayer,
    primaryPrayerOptions: PRIMARY_PRAYER_OPTIONS,
    primaryBoost: appShellSetup.primaryBoost,
    primaryBoostOptions: PRIMARY_BOOST_OPTIONS,
    prayerOptions: PRAYER_SELECTION_OPTIONS,
    boostOptions: BOOST_SELECTION_OPTIONS,
    prayerIds: form.prayers,
    boostIds: form.boosts,
    sustained: form.sustained,
    repotThreshold: form.repotThreshold ?? 65,
    respectRequirements: respectLoadoutRequirements,
    manualOverrides: form.manualOverrides,
    derivedCombat: {
      accuracyBonus: derivedViewModel.combat.debug.accuracyBonus,
      damageBonus: derivedViewModel.combat.debug.damageBonus,
      attackSpeedSec: derivedViewModel.combat.attackSpeedSec
    },
    gear: form.gear,
    gearOptions: gearSelectOptions,
    gearQuickActions,
    setupRequirements: viewModel.setupRequirements,
    loadoutBonuses,
    specialAttackSelection: form.specialAttack,
    fallbackAmmoId: form.ammoId,
    specialAttackOptions,
    specialAttackRequiresAmmo: specialAttackMeta?.requiresAmmo === true,
    specialAmmoOptions: arrowAmmoOptions,
    dbaSpecActive,
    specialAttack: viewModel.combat.specialAttack,
    specialWarnings: viewModel.specialWarnings
  });
  const legacyMigrationViewModel = legacyMigrationReport
    ? createLegacyMigrationViewModel({
        report: legacyMigrationReport,
        hasRewriteSetup: initialSavedSetup.loaded
      })
    : null;
  const activePriceSet = context?.priceSet ?? null;
  const manualPricePresentation = createManualPriceEditorPresentation({
    activePriceSet,
    basePriceSet,
    itemLabels: priceHistoryItemLabels,
    manualPriceOverrides,
    selectedItemId: manualPriceItemId,
    draft: manualPriceDraft
  });
  const priceSetPresentation = createPriceSetPresentation({
    activePriceSet,
    bundledPriceSet,
    scheduledSnapshotStatus,
    activePriceSetOrigin,
    priceLabel,
    activeManualPriceOverrideCount: manualPricePresentation.activeCount,
    ageNow: new Date(priceAgeNowMs)
  });
  const selectedEconomyItem = createSelectedPriceItemPresentation({
    activePriceSet,
    itemId: economyHistory.effectiveTrendItemId,
    freshnessNow: new Date(priceAgeNowMs)
  });
  const settingsPaneViewModel = createSettingsPaneViewModel(hiddenGearTiers);
  const priceDataViewModel = {
    ...priceSetPresentation,
    manual: manualPricePresentation,
    history: {
      ...economyHistory,
      summary: priceHistorySummary,
      selectedItem: selectedEconomyItem
    }
  };
  const effectiveManualPriceItemId = manualPricePresentation.itemId;
  const selectedManualBasePrice = manualPricePresentation.basePrice;
  const selectedManualOverride = manualPricePresentation.selectedOverride;
  const manualPriceInputValue = manualPricePresentation.inputValue;
  const resetFallbackPriceSet = priceSetPresentation.reset.fallbackPriceSet;
  const resetFallbackOrigin = priceSetPresentation.reset.fallbackOrigin;
  const resetFallbackLabel = priceSetPresentation.reset.fallbackLabel;
  const commitManualPriceOverrides = (
    next: ManualPriceOverridesState,
    successMessage: string
  ): void => {
    let persisted = true;
    try {
      saveManualPriceOverrides(storage, next);
      if (localStorageAccessUnavailable) {
        persisted = false;
        localStateRecovery.markPersistenceUnavailable();
      } else {
        localStateRecovery.clearStorageFailures(["manual-price-overrides"]);
      }
    } catch {
      persisted = false;
      localStateRecovery.recordStorageFailure("manual-price-overrides", "save_failed");
    }
    localStateRecovery.unblockReplaced(["manual-price-overrides"]);
    setManualPriceOverrides(next);
    if (basePriceSet) {
      const nextActivePriceSet = applyManualPriceOverrides(basePriceSet, next);
      setContext((current) => (current ? { ...current, priceSet: nextActivePriceSet } : current));
      setPriceLabel(nextActivePriceSet.label);
    }
    setManualPriceClearPending(false);
    localStateRecovery.refresh();
    setStatus(persisted ? successMessage : `${successMessage} for this session`);
    setMarketNotice({
      tone: persisted ? "success" : "neutral",
      message: persisted
        ? successMessage
        : `${successMessage} for this session. Local storage is unavailable, so reload may restore the previous value.`
    });
  };
  const applyManualItemPrice = () => {
    if (!effectiveManualPriceItemId || selectedManualBasePrice === null) return;
    if (manualPriceInputValue === selectedManualBasePrice) {
      const next = removeManualPriceOverride(manualPriceOverrides, effectiveManualPriceItemId);
      commitManualPriceOverrides(
        next,
        `Restored ${priceHistoryItemLabels[effectiveManualPriceItemId] ?? effectiveManualPriceItemId} to base price`
      );
      return;
    }
    if (!canSetManualPriceOverride(manualPriceOverrides, effectiveManualPriceItemId)) {
      const message = "Manual item price limit reached; reset an existing item before adding one.";
      setStatus(message);
      setMarketNotice({ tone: "error", message });
      return;
    }
    const next = setManualPriceOverride(
      manualPriceOverrides,
      effectiveManualPriceItemId,
      manualPriceInputValue,
      new Date()
    );
    commitManualPriceOverrides(
      next,
      `Applied manual price for ${priceHistoryItemLabels[effectiveManualPriceItemId] ?? effectiveManualPriceItemId}`
    );
  };
  const resetManualItemPrice = () => {
    if (!effectiveManualPriceItemId || !selectedManualOverride) return;
    const next = removeManualPriceOverride(manualPriceOverrides, effectiveManualPriceItemId);
    commitManualPriceOverrides(
      next,
      `Reset manual price for ${priceHistoryItemLabels[effectiveManualPriceItemId] ?? effectiveManualPriceItemId}`
    );
    setManualPriceDraft(selectedManualBasePrice);
  };
  const confirmClearAllManualPrices = () => {
    commitManualPriceOverrides(
      DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
      "Cleared all manual item prices"
    );
    setManualPriceDraft(selectedManualBasePrice);
  };
  const exportActivePriceSet = () => {
    if (!activePriceSet) return;
    const outcome = priceSetTransfer.exportPriceSet(activePriceSet);
    setStatus(outcome.appStatus);
    setMarketNotice(outcome.marketNotice);
  };
  const requestResetActivePriceSet = () => {
    if (!priceSetPresentation.reset.canReset) return;
    setMarketNotice(priceSetTransfer.requestReset(resetFallbackLabel));
  };
  const applyResetPriceSet = (outcome: ResetPriceSetOutcome) => {
    setBasePriceSet(outcome.basePriceSet);
    setManualPriceDraft(null);
    setManualPriceClearPending(false);
    setContext((current) => (current ? { ...current, priceSet: outcome.activePriceSet } : current));
    setPriceLabel(outcome.activePriceSet.label);
    setActivePriceSetOrigin(outcome.activePriceSetOrigin);
    setStatus(outcome.appStatus);
    setMarketNotice(outcome.marketNotice);
    setFatalError(null);
  };
  const resetActivePriceSetToFallback = () => {
    if (!resetFallbackPriceSet) return;
    applyResetPriceSet(
      priceSetTransfer.resetToFallback({
        fallbackPriceSet: resetFallbackPriceSet,
        fallbackOrigin: resetFallbackOrigin,
        fallbackLabel: resetFallbackLabel,
        manualPriceOverrides
      })
    );
  };
  const visibleShareableSetupInspection = shareReviewDismissed
    ? null
    : receivedShareableSetupInspection;
  const sharedSetupReviewViewModel = visibleShareableSetupInspection
    ? createSharedSetupReviewViewModel({
        inspection: visibleShareableSetupInspection,
        monsters: context.gameData.monsters
      })
    : null;
  const workbenchResultViewModel = createWorkbenchResultViewModel({
    effectiveDps: viewModel.combat.effectiveDps,
    maxHit: viewModel.combat.maxHit,
    hitChance: viewModel.combat.hitChance,
    ttkSec: viewModel.combat.ttkSec,
    killsPerHour: viewModel.trip.killsPerHour,
    effectiveXpPerHour: viewModel.effectiveXpPerHour,
    playerEffectiveXpPerHour: viewModel.playerEffectiveXpPerHour,
    cannonEffectiveXpPerHour: viewModel.cannonEffectiveXpPerHour,
    gpPerHour: viewModel.trip.gpPerHour,
    effectiveNetGpPerHour: viewModel.trip.effectiveNetGpPerHour,
    supplyCostPerKill: viewModel.trip.supply.supplyCostPerKill,
    gpPerKill: viewModel.trip.gpPerKill,
    supplyGapPerKill,
    supplyCostsExceedLoot,
    risk: freshRisk
      ? {
          horizonMinutes: freshRisk.controls.horizonMinutes,
          killTimeSeconds: freshRisk.result.killTimeSeconds,
          timedNetGp: freshRisk.result.timedNetGp
        }
      : null
  });

  return (
    <main className="app-shell">
      <AppHeader
        hiscores={{
          statusLabel: hiscores.statusLabel,
          available: hiscores.available,
          player: hiscores.player,
          response: hiscores.response,
          busy: hiscores.busy,
          previewOpen: hiscores.previewOpen,
          notice: hiscores.notice,
          previewRows: hiscoresPreviewRows,
          canApply: canApplyHiscores,
          onPlayerChange: hiscores.changePlayer,
          onLookup: hiscores.lookup,
          onPreviewOpenChange: hiscores.setPreviewOpen,
          onApply: applyHiscoresPreview
        }}
        priceImportNotice={priceSetTransfer.importNotice}
        setupImportNotice={setupFileTransfer.notice}
        shareCreateNotice={shareCreateNotice}
        shareButtonRef={shareSetupButtonRef}
        onImportPrices={(file) => importPriceFile(file, "topbar")}
        onImportSetup={importSetupFile}
        onExportSetup={exportCurrentSetup}
        onShareSetup={openShareSetupDialog}
      />
      <span className="visually-hidden" role="status" aria-live="polite">
        {status}
      </span>

      {shareDialog && (
        <ShareSetupDialog
          state={shareDialog}
          onCopy={() => void copyShareSetupUrl()}
          onClose={closeShareSetupDialog}
        />
      )}

      {sharedSetupReviewViewModel && (
        <SharedSetupReview
          viewModel={sharedSetupReviewViewModel}
          onLoad={loadReceivedShareableSetup}
          onDismiss={() => setShareReviewDismissed(true)}
        />
      )}

      <PendingUndoStatus pendingUndo={pendingUndo} onUndo={undoPendingAction} />

      {legacyMigrationViewModel && (
        <LegacyMigrationPanel
          viewModel={legacyMigrationViewModel}
          clearPending={legacyClearPending}
          onImport={importLegacySetup}
          onKeep={keepLegacyData}
          onRequestClear={() => setLegacyClearPending(true)}
          onConfirmClear={confirmClearLegacyData}
          onCancelClear={() => setLegacyClearPending(false)}
        />
      )}

      <WorkbenchShell
        activeTab={activeTab}
        form={form}
        shellSetup={appShellSetup}
        result={workbenchResultViewModel}
        currentMonsterLabel={currentMonster?.name ?? form.monsterId}
        hasCurrentCustomSetup={hasCurrentCustomSetup}
        activeSetupIsCustom={activeSetupIsCustom}
        monsterOptions={monsters}
        styleOptions={styles}
        spellOptions={spellSelectOptions}
        foodPerKill={viewModel.trip.trip.foodPerKill}
        moneyWarnings={viewModel.moneyWarnings}
        activeAssumptions={viewModel.activeAssumptions}
        actions={{
          activateTab: activateWorkbenchTab,
          selectCombatStyle,
          updateLevel,
          setStyle: (styleId) => setFormSafe((current) => updateForm(current, { styleId })),
          selectTarget,
          createCustomSetup,
          editDefaultSetup,
          editCustomSetup,
          removeCurrentCustomSetup,
          setSpell: setSpellSelection,
          setPrimaryPrayer: (prayer) =>
            setFormSafe((current) =>
              updateForm(current, {
                prayers: setPrimaryPrayerSelection(current.prayers, prayer)
              })
            ),
          setPrimaryBoost: (boost) =>
            setFormSafe((current) =>
              updateForm(current, {
                boosts: setPrimaryBoostSelection(current.boosts, boost)
              })
            ),
          setManualOverride,
          reviewActiveAssumption,
          resetActiveAssumption
        }}
        rail={
          <MonsterCardPanel
            card={viewModel.monsterCard}
            monsterOptions={monsters}
            selectedMonsterId={form.monsterId}
            onTargetChange={selectTarget}
          />
        }
      >
        <StatsPane
          hidden={activeTab !== "stats"}
          viewModel={{
            sourceBreakdown: viewModel.statsSourceBreakdown,
            combatRollDetail: viewModel.combatRollDetail,
            xpRouting: viewModel.xpRouting,
            tripBankingSummary: viewModel.tripBankingSummary,
            effectiveKph: viewModel.trip.effectiveKph
          }}
        />

        <LoadoutPane
          hidden={activeTab !== "loadout"}
          viewModel={{
            ...loadoutPaneViewModel,
            hitDistributionHitChanceLabel: viewModel.hitDistribution.hitChanceLabel,
            hitDistributionComparison: viewModel.hitDistributionComparison
          }}
          actions={{
            setWeapon: setWeaponSelection,
            setAmmo: setAmmoSelection,
            setSpell: setSpellSelection,
            setStyle: (styleId) => setFormSafe((current) => updateForm(current, { styleId })),
            setPrimaryPrayer: (prayer) =>
              setFormSafe((current) =>
                updateForm(current, {
                  prayers: setPrimaryPrayerSelection(current.prayers, prayer)
                })
              ),
            setPrimaryBoost: (boost) =>
              setFormSafe((current) =>
                updateForm(current, {
                  boosts: setPrimaryBoostSelection(current.boosts, boost)
                })
              ),
            togglePrayer: (prayer, selected) =>
              setFormSafe((current) =>
                updateForm(current, {
                  prayers: togglePrayerSelection(current.prayers, prayer, selected)
                })
              ),
            toggleBoost: (boost, selected) =>
              setFormSafe((current) =>
                updateForm(current, {
                  boosts: toggleBoostSelection(current.boosts, boost, selected)
                })
              ),
            setSustained: (sustained) =>
              setFormSafe((current) =>
                updateForm(current, {
                  sustained,
                  repotThreshold: sustained ? (current.repotThreshold ?? 65) : null
                })
              ),
            setRepotThreshold: (repotThreshold) =>
              setFormSafe((current) => updateForm(current, { repotThreshold })),
            setRespectRequirements: setRespectLoadoutRequirements,
            optimize: optimizeCurrentLoadout,
            setManualOverride,
            resetManualOverrides,
            setGear: setGearSelection,
            setSpecialWeapon: setSpecialAttackWeapon,
            setSpecialAmmo: (ammoId) =>
              setFormSafe((current) =>
                updateForm(current, {
                  specialAttack: { ...current.specialAttack, ammoId }
                })
              )
          }}
        />

        <LootPane
          hidden={activeTab !== "loot"}
          model={{
            presentation: viewModel.loot,
            settings: currentLootSettings,
            notice: lootNotice,
            gpPerKill: viewModel.trip.gpPerKill,
            effectiveNetGpPerHour: viewModel.trip.effectiveNetGpPerHour,
            moneyWarnings: viewModel.moneyWarnings
          }}
          actions={{
            setHighAlch: (highAlch) => setLootSettingsForCurrentMonster({ highAlch }),
            setOverheadMode: (mode) =>
              setLootSettingsForCurrentMonster({
                overheadSec: mode === "manual" ? viewModel.loot.overheadValue : null
              }),
            setOverheadSeconds: (overheadSec) => setLootSettingsForCurrentMonster({ overheadSec }),
            setTalismanSpot: (talismanSpot) => setLootSettingsForCurrentMonster({ talismanSpot }),
            setAction: setLootActionForCurrentMonster,
            resetSettings: resetCurrentLootSettings,
            resetOverrides: resetCurrentLootOverrides,
            optimize: optimizeCurrentLoot
          }}
        />

        <TripPane
          hidden={activeTab !== "trip"}
          model={{
            presentation: tripPanePresentation,
            modeledKillsPerTripRange: freshRisk
              ? formatRiskRange(freshRisk.result.killsPerTrip, 0)
              : null
          }}
          actions={{
            updateTrip,
            openRisk: () => activateWorkbenchTab("risk")
          }}
        />

        <RiskPane
          hidden={activeTab !== "risk"}
          model={{
            controls: riskAnalysis.controls,
            runStatus: riskAnalysis.runStatus,
            statusLabel: riskAnalysis.statusLabel,
            targetDropOptions: riskAnalysis.targetDropOptions,
            display: riskAnalysis.display,
            expectedTtkSec: viewModel.result.rates.ttkSec,
            expectedKillsPerTrip: viewModel.trip.trip.killsPerTrip
          }}
          actions={{
            setTargetKills: riskAnalysis.setTargetKills,
            setHorizonMinutes: riskAnalysis.setHorizonMinutes,
            setGpTarget: riskAnalysis.setGpTarget,
            setTargetDropRowId: riskAnalysis.setTargetDropRowId,
            run: riskAnalysis.run,
            cancel: riskAnalysis.cancel
          }}
        />
        <CannonPane
          hidden={activeTab !== "cannon"}
          enabled={cannonEnabled}
          targets={cannonTargets}
          respawnSeconds={cannonRespawn}
          tripSparseLinked={cannonTripSparseLinked}
          hasCustomSettings={cannonHasCustomSettings}
          output={currentCannonOutput}
          effectiveXpPerHour={viewModel.effectiveXpPerHour}
          effectiveNetGpPerHour={viewModel.trip.effectiveNetGpPerHour}
          hitChance={viewModel.combat.hitChance}
          tripSparseEnabled={form.trip.scarceSpot}
          tripSparseMaxKph={viewModel.trip.trip.scarce.maxKph}
          cannonReserveActive={viewModel.trip.trip.slots.reserveParts.includes("cannon (4 parts)")}
          onEnabledChange={(enabled) => setCannonForCurrentMonster({ enabled })}
          onTargetsChange={setCannonTargetsForCurrentMonster}
          onRespawnChange={setCannonRespawnForCurrentMonster}
          onTripSparseLinkedChange={setTripSparseFromCannon}
          onReset={resetCannonForCurrentMonster}
        />

        <DuelPane
          hidden={activeTab !== "duel"}
          model={{
            targetLabel: currentMonster?.name ?? form.monsterId,
            snapshotCount: duelSnapshots.snapshots.length,
            duelComparison,
            duelViewMode,
            expandedDuelDiffId,
            duelMatrixMetric,
            duelMatrixFilter,
            duelMatrix,
            filteredDuelMatrixRows,
            duelMatrixBusy,
            duelImportNotice
          }}
          actions={{
            snapshotCurrentSetup,
            exportDuelSnapshots,
            importDuelSnapshots,
            commitDuelSnapshotName,
            loadDuelSnapshot,
            deleteDuelSnapshot,
            showCurrentDuelTarget,
            showDuelMonsterMatrix,
            toggleDuelDiff,
            setDuelMatrixFilter,
            setDuelMatrixMetric,
            buildDuelMatrix
          }}
        />

        <PlannerPane
          hidden={activeTab !== "planner"}
          model={{
            draftState: plannerState,
            panel: plannerPanel,
            gearPoolEditor: plannerGearPoolEditor,
            error: plannerError,
            pending: plannerPending,
            status: plannerStatus,
            computedMetric: plannerComputedMetric,
            combatStyleLabel: form.combatStyle,
            targetLabel: currentMonster?.name ?? form.monsterId,
            currentLevels: form.levels
          }}
          actions={{
            setMetric: updatePlannerMetric,
            setCurrentXp: updatePlannerCurrentXp,
            setTargetLevel: updatePlannerTargetLevel,
            setSkillLock: updatePlannerSkillLock,
            setOnlyCurrentGear: updatePlannerOnlyCurrentGear,
            setAverageOverSession: updatePlannerAverageOverSession,
            setGearPoolItem: updatePlannerGearPoolItem,
            resetGearPool: resetPlannerGearPool,
            recompute: recomputePlanner
          }}
        />
        <EconomySettingsPane
          model={{
            mode:
              activeTab === "economy"
                ? "economy"
                : activeTab === "settings"
                  ? "settings"
                  : "hidden",
            prices: priceDataViewModel,
            settings: settingsPaneViewModel,
            moneyWarnings: viewModel.moneyWarnings,
            marketNotice,
            importNotice: priceSetTransfer.importNotice,
            priceSetResetPending: priceSetTransfer.resetPending,
            priceHistoryClearPending,
            manualPriceClearPending,
            recovery: {
              visible: localStateRecovery.visible,
              report: localStateRecovery.report,
              notice: localStateRecovery.notice,
              pendingClearId: localStateRecovery.pendingClearId
            }
          }}
          actions={{
            prices: {
              importPriceSet: importPriceFile,
              exportActivePriceSet,
              requestReset: requestResetActivePriceSet,
              confirmReset: resetActivePriceSetToFallback,
              cancelReset: priceSetTransfer.cancelReset
            },
            history: {
              saveLocalComparison: saveLocalPriceComparison,
              requestClear: requestClearPriceHistory,
              confirmClear: confirmClearPriceHistory,
              cancelClear: () => setPriceHistoryClearPending(false),
              setBaselineMode: setEconomyBaselineMode,
              setSnapshotKey: setEconomySnapshotKey,
              setItemFilter: setEconomyItemFilter,
              setTrendItemId: setEconomyTrendItemId,
              sortBy: updateEconomySort
            },
            manual: {
              selectItem: (itemId) => {
                setManualPriceItemId(itemId);
                setManualPriceDraft(
                  activePriceSet?.itemPrices[itemId] ?? basePriceSet?.itemPrices[itemId] ?? 0
                );
              },
              setDraft: (value) => {
                setManualPriceItemId(effectiveManualPriceItemId);
                setManualPriceDraft(value);
              },
              apply: applyManualItemPrice,
              resetItem: resetManualItemPrice,
              requestClearAll: () => setManualPriceClearPending(true),
              confirmClearAll: confirmClearAllManualPrices,
              cancelClearAll: () => setManualPriceClearPending(false)
            },
            settings: {
              setTierHidden: (tierId, hiddenTier) =>
                setHiddenGearTiers((current) => setHiddenGearTier(current, tierId, hiddenTier)),
              hideAllTiers: () => setHiddenGearTiers(hideAllGearTiers()),
              showAllTiers: () => setHiddenGearTiers(DEFAULT_HIDDEN_GEAR_TIERS_STATE)
            },
            recovery: {
              exportReport: localStateRecovery.exportReport,
              beginClear: localStateRecovery.beginClear,
              cancelClear: localStateRecovery.cancelClear,
              confirmClearItem: confirmClearLocalStateItem,
              confirmClearInvalid: confirmClearInvalidLocalState
            }
          }}
        />

        <ComparePane
          hidden={activeTab !== "compare"}
          model={{
            denseCompare,
            denseCompareRows,
            denseCompareScale,
            denseCompareTotalRows,
            denseComparePending,
            denseCompareFreshnessLabel,
            denseCompareFreshnessSummary,
            denseCompareFreshnessAria,
            selectedMonsterId: form.monsterId
          }}
          actions={{
            setDenseMonsterFilter,
            setDenseDropFilter,
            setDenseShowIrrelevant,
            resetDenseFilters,
            sortBy: (key) =>
              setDenseCompare((current) => ({
                ...current,
                sort: nextDenseCompareSortState(current.sort, key)
              })),
            selectTarget,
            toggleDenseIrrelevant
          }}
        />
      </WorkbenchShell>
    </main>
  );
}

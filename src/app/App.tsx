import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import { ActionStatus, PendingUndoStatus, type PendingUndo } from "./components/app-presenters";
import type { ShareSetupDialogState } from "./components/share-setup-dialog";
import { globalStatusAnnouncement } from "./view-models/global-status";
import type { SelectOption } from "./components/form-fields";
import { formatDelta } from "./components/presentation-formatters";
import { AppHeader } from "./components/shell/app-header";
import {
  ApplicationFailureScreen,
  SafeSessionNotice
} from "./components/shell/application-error-boundary";
import { WorkbenchShell } from "./components/shell/workbench-shell";
import { PaneBoundary } from "./components/shell/pane-boundary";
import { createTrackedLazyPane } from "./components/shell/tracked-lazy-pane";
import { MonsterCardPanel } from "./components/panes/monster-card-panel";
import { StatsPane } from "./components/panes/stats-pane";
import {
  CROSS_TAB_CONFLICT_HEADING_ID,
  LOCAL_STATE_RECOVERY_HEADING_ID
} from "./components/settings/settings-heading-ids";
import {
  captureBrowserShareableSetupFragment,
  createBrowserShareableSetupUrl,
  downloadJsonFile,
  readBrowserFileText,
  writeShareableSetupToClipboard
} from "@/adapters/browser";
import type { ScheduledStaticPriceSnapshotStatus } from "@/adapters/market";
import { LastHiscoresPlayerStateSchema } from "@/adapters/hiscores";
import { loadPersisted } from "@/adapters/storage";
import {
  SAFE_SESSION_NOTICE,
  createBrowserStorageAccess,
  reloadSimulator
} from "./application-recovery";
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
import { scheduledPriceSetFromStatus, type ActivePriceSetOrigin } from "./state/market-sync";
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
import { useCrossTabConflicts } from "./controllers/use-cross-tab-conflicts";
import type { CrossTabAreaId } from "./controllers/cross-tab-conflicts";
import { createCrossTabKeepOperation } from "./controllers/cross-tab-persistence";
import { useSetupFileTransfer } from "./controllers/use-setup-file-transfer";
import { usePriceSetTransfer } from "./controllers/use-price-set-transfer";
import { useWorkspaceFileTransfer } from "./controllers/use-workspace-file-transfer";
import {
  SessionOnlyExitProtectionCore,
  type NonDurableReason
} from "./controllers/session-only-exit-protection";
import { useSessionOnlyBeforeUnload } from "./controllers/use-session-only-before-unload";
import type { EconomyDataUndoRecord, EconomyDataUndoScope } from "./controllers/economy-data-undo";
import {
  MonsterSpecificChangesTransactionCore,
  type MonsterSpecificApplyOutcome,
  type MonsterSpecificExecutionInput,
  type MonsterSpecificLiveOutcome
} from "./controllers/monster-specific-changes-transaction";
import {
  SavedSetupChangesTransactionCore,
  type SavedSetupChangeApplyOutcome,
  type SavedSetupChangeRequest,
  type SavedSetupChangesExecutionInput
} from "./controllers/saved-setup-changes";
import type {
  WorkspaceRestoreApplyOutcome,
  WorkspaceRestoreExecutionInput,
  WorkspaceRestoreLiveOutcome
} from "./controllers/workspace-file-transfer";
import { formatRiskRange } from "./view-models/risk";
import { buildLocalStateAttentionViewModel } from "./view-models/local-state-attention";
import { buildSetupImportReviewViewModel } from "./view-models/setup-import-review";
import type {
  AcceptedPriceSetOutcome,
  ResetPriceSetOutcome
} from "./controllers/price-set-transfer";
import {
  canApplyHiscoresPreview,
  createHiscoresLevelApplyTransaction,
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
  mergeDuelSnapshots,
  parseDuelSnapshotsExportText,
  removeDuelSnapshot,
  renameDuelSnapshotSafely,
  uniqueDuelSnapshotName,
  type DuelSnapshotsState
} from "./state/duel-snapshots";
import { exportDuelSnapshotsFile } from "./controllers/duel-file-transfer";
import {
  buildSavedSetupMergeCandidate,
  createSavedSetupMergePlan,
  setSavedSetupMergeDecision,
  setSavedSetupMergeRecipientName,
  type SavedSetupMergePlan
} from "./state/saved-setup-merge";
import {
  compareSetupTransferContext,
  type SetupTransferContextReview
} from "./state/setup-transfer-context";
import {
  createSavedRowSetupChangeReview,
  createSharedSetupChangeReview,
  savedRowReviewMatches,
  sharedSetupReviewMatchesCurrent,
  type SetupTransferChangeReview
} from "./state/setup-transfer-changes";
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
  createFullHistoryReplacementCandidate,
  createLocalPriceHistoryRemovalCandidate,
  deriveFullHistoryReplacement,
  deriveLocalPriceHistoryRemoval,
  type FullHistoryReplacementCandidate,
  type LocalPriceHistoryRemovalCandidate
} from "./state/local-price-history-lifecycle";
import {
  DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
  applyManualPriceOverrides,
  canSetManualPriceOverride,
  loadManualPriceOverrides,
  removeManualPriceOverride,
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
import {
  RUNTIME_BOOTSTRAP_ERROR_MESSAGE,
  type RuntimeBootstrapResult
} from "./controllers/runtime-bootstrap";
import {
  PLANNER_UI_STORAGE_KEY,
  PLANNER_UI_VERSION,
  PlannerUiStateSchema,
  loadPlannerUiState,
  normalizePlannerUiState,
  reconcilePlannerProgressWithLevels,
  resetPlannerGearPoolSlot,
  setPlannerGearPoolItem,
  type PlannerProgressAdjustment,
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
  ACTIVE_SETUP_RESET_STALE_NOTICE,
  INITIAL_ACTIVE_SETUP_RESET_STATE,
  cancelActiveSetupReset,
  consumeActiveSetupReset,
  invalidateStaleActiveSetupReset,
  openActiveSetupReset
} from "./state/active-setup-reset";
import {
  cleanDenseCompareStateForMonsterIds,
  nextDenseCompareSortState,
  resetDenseCompareFilters,
  toggleDenseCompareMonsterIrrelevant,
  type DenseCompareUiState
} from "./state/dense-compare";
import {
  createPlannerSkillInputViewModels,
  plannerAllowedPool,
  plannerProgressAdjustmentNotice,
  type PlannerNoticeAction
} from "./view-models/planner";
import { monsterOptions } from "./view-models/monster-card";
import { createSimulationViewModel } from "./view-models/simulation";
import {
  DEFAULT_LOOT_NESTED_TABLE_SORT_STATE,
  DEFAULT_LOOT_TABLE_SORT_STATE,
  lootActionLabel,
  nextLootNestedTableSortState,
  nextLootTableSortState,
  optimizeLootPrefsForMonster,
  type LootDropRowViewModel,
  type LootNestedTableSortState,
  type LootTableSortState
} from "./view-models/loot";
import {
  createEconomyHistoryPresentation,
  createManualPriceEditorPresentation,
  createPriceHistorySources,
  createPriceHistorySummaryPresentation,
  createPriceItemLabels,
  createPriceSetPresentation,
  createSelectedPriceItemPresentation,
  type ItemPriceHistoryContext,
  type PriceNoticeAction
} from "./view-models/price-data";
import {
  createPriceTimeContext,
  presentPriceDateTime,
  resolveBrowserPriceTimeZone
} from "./view-models/price-time";
import {
  createGameRevisionViewModel,
  createSettingsPaneViewModel,
  type SettingsNavigationIntent
} from "./view-models/settings";
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
  type SetupPersistenceKind,
  type ShareableSetupInspection,
  type WorkbenchTabId,
  workbenchTabLabel
} from "./view-models/app-shell";
import {
  createInitialPaneLoadStates,
  createInitialRequestedPaneFamilies,
  paneFamilyForTab,
  requestPaneFamily,
  type PaneFamily,
  type PaneLoadState
} from "./state/pane-delivery";
import {
  createWorkbenchPaneUrl,
  formatWorkbenchDocumentTitle,
  parseWorkbenchPaneUrl,
  removeInvalidWorkbenchPane,
  workbenchHistoryMutationForSource,
  type WorkbenchActivationSource
} from "./state/workbench-browser-context";
import {
  createSavedSetupMergeReviewViewModel,
  defaultDuelSnapshotName,
  describeDuelSnapshotsImportError
} from "./view-models/duel";
import type { InlineNoticeViewModel } from "./view-models/contracts";
import type { WorkspaceLiveState } from "./state/workspace-backup";
import {
  createMonsterSpecificRemovalCandidate,
  type MonsterSpecificLiveState,
  type MonsterSpecificRemovalCandidate
} from "./state/monster-specific-changes";
import {
  createMonsterSpecificChangesViewModel,
  type MonsterSpecificChangeKind
} from "./view-models/monster-specific-changes";

const loadEconomySettingsPane = () => import("./components/panes/economy-settings-lazy");
const trackedEconomySettingsPane =
  createTrackedLazyPane<
    import("./components/panes/economy-settings-pane").EconomySettingsPaneProps
  >(loadEconomySettingsPane);
const EconomySettingsPane = trackedEconomySettingsPane.Component;
const loadSetupReviews = () => import("./components/shell/setup-reviews-lazy");
const ActiveSetupResetReview = lazy(() =>
  loadSetupReviews().then((module) => ({ default: module.ActiveSetupResetReview }))
);
const SetupImportReview = lazy(() =>
  loadSetupReviews().then((module) => ({ default: module.SetupImportReview }))
);
const SharedSetupReview = lazy(() =>
  loadSetupReviews().then((module) => ({ default: module.SharedSetupReview }))
);
const LegacyMigrationPanel = lazy(() =>
  import("./components/shell/legacy-migration-panel").then((module) => ({
    default: module.LegacyMigrationReview
  }))
);
const LocalStateAttentionBanner = lazy(() =>
  import("./components/shell/local-state-attention-banner").then((module) => ({
    default: module.LocalStateAttentionBanner
  }))
);
const ShareSetupDialog = lazy(() =>
  import("./components/share-setup-dialog").then((module) => ({
    default: module.ShareSetupDialog
  }))
);
const trackedRiskPane = createTrackedLazyPane<import("./components/panes/risk-pane").RiskPaneProps>(
  () => import("./components/panes/risk-pane")
);
const RiskPane = trackedRiskPane.Component;
const trackedDuelPane = createTrackedLazyPane<import("./components/panes/duel-pane").DuelPaneProps>(
  () => import("./components/panes/duel-pane").then((module) => ({ default: module.DuelPane }))
);
const DuelPane = trackedDuelPane.Component;
const trackedPlannerPane = createTrackedLazyPane<
  import("./components/panes/planner-pane").PlannerPaneProps
>(() =>
  import("./components/panes/planner-pane").then((module) => ({ default: module.PlannerPane }))
);
const PlannerPane = trackedPlannerPane.Component;
const trackedLootPane = createTrackedLazyPane<import("./components/panes/loot-pane").LootPaneProps>(
  () => import("./components/panes/loot-pane").then((module) => ({ default: module.LootPane }))
);
const LootPane = trackedLootPane.Component;
const trackedTripPane = createTrackedLazyPane<import("./components/panes/trip-pane").TripPaneProps>(
  () => import("./components/panes/trip-pane").then((module) => ({ default: module.TripPane }))
);
const TripPane = trackedTripPane.Component;
const trackedLoadoutPane = createTrackedLazyPane<
  import("./components/panes/loadout-pane").LoadoutPaneProps
>(() =>
  import("./components/panes/loadout-pane").then((module) => ({ default: module.LoadoutPane }))
);
const LoadoutPane = trackedLoadoutPane.Component;
const trackedCannonPane = createTrackedLazyPane<
  import("./components/panes/cannon-pane").CannonPaneProps
>(() =>
  import("./components/panes/cannon-pane").then((module) => ({ default: module.CannonPane }))
);
const CannonPane = trackedCannonPane.Component;
const trackedComparePane = createTrackedLazyPane<
  import("./components/panes/compare-pane").ComparePaneProps
>(() =>
  import("./components/panes/compare-pane").then((module) => ({ default: module.ComparePane }))
);
const ComparePane = trackedComparePane.Component;

const ECONOMY_UNDO_SCOPE_IDS: ReadonlySet<string> = new Set<EconomyDataUndoScope>([
  "price-history",
  "manual-price-overrides",
  "selected-price-set"
]);

const browserStorageAccess = createBrowserStorageAccess(
  typeof window === "undefined" ? undefined : window
);
const storage = browserStorageAccess.storage;
const localStorageAccessUnavailable = browserStorageAccess.storageUnavailable;
const savedDataIgnoredForSession = browserStorageAccess.savedDataIgnoredForSession;
const localPersistenceUnavailable = localStorageAccessUnavailable || savedDataIgnoredForSession;

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

interface PriceItemReviewRequest {
  id: number;
  action: PriceNoticeAction;
}

interface MonsterSpecificReviewRequest {
  id: number;
  monsterId: string;
  kind: MonsterSpecificChangeKind;
}

type SettledSetupPersistenceKind = Exclude<SetupPersistenceKind, "saving">;

interface SetupPersistenceOutcome {
  identity: string;
  kind: SettledSetupPersistenceKind;
}

function setupPersistenceIdentity(setup: SavedSetupState): string {
  return JSON.stringify(setup);
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
  const [setupPersistenceOutcome, setSetupPersistenceOutcome] =
    useState<SetupPersistenceOutcome | null>(null);
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
  const [plannerAdjustmentNotice, setPlannerAdjustmentNotice] = useState<string | null>(null);
  const [legacyMigrationDismissed, setLegacyMigrationDismissed] = useState(
    loadInitialLegacyMigrationDismissed
  );
  const [legacyClearPending, setLegacyClearPending] = useState(false);
  const [priceAgeNowMs, setPriceAgeNowMs] = useState(() => Date.now());
  const [priceTimeZone] = useState(resolveBrowserPriceTimeZone);
  const [readyToPersist, setReadyToPersist] = useState(false);
  const [status, setStatus] = useState("Loading source-backed runtime data");
  const [sessionOnlyExitProtection] = useState(() => new SessionOnlyExitProtectionCore());
  const sessionOnlyExitProtectionSnapshot = useSyncExternalStore(
    sessionOnlyExitProtection.subscribe,
    sessionOnlyExitProtection.getSnapshot,
    sessionOnlyExitProtection.getSnapshot
  );
  const crossTabConflicts = useCrossTabConflicts({
    storage,
    enabled: readyToPersist && !localPersistenceUnavailable
  });
  const localStateRecovery = useLocalStateRecovery({
    storage,
    storageUnavailable: localStorageAccessUnavailable,
    persistenceUnavailable: localPersistenceUnavailable,
    persistenceNotice: savedDataIgnoredForSession ? SAFE_SESSION_NOTICE : undefined,
    onStatus: setStatus,
    onDownload: downloadJsonFile,
    crossTab: crossTabConflicts,
    durability: {
      defaultNonDurableReason: savedDataIgnoredForSession
        ? "saved-data-ignored"
        : localStorageAccessUnavailable
          ? "storage-unavailable"
          : undefined,
      recordDurable: sessionOnlyExitProtection.recordDurable,
      recordDurableIds: sessionOnlyExitProtection.recordDurableIds,
      recordNonDurable: sessionOnlyExitProtection.recordNonDurable,
      recordNonDurableIds: sessionOnlyExitProtection.recordNonDurableIds
    }
  });
  const persistLocalState = localStateRecovery.persist;
  const refreshLocalStateRecovery = localStateRecovery.refresh;
  const shouldSkipPersistLocalState = localStateRecovery.shouldSkipPersist;
  const prepareExternalLocalStateApply = localStateRecovery.prepareExternalApply;
  const blockedLocalStateIds = [
    ...new Set([
      ...localStateRecovery.blockedIds,
      ...crossTabConflicts.conflicts.map((conflict) => conflict.id)
    ])
  ];
  const rewriteSetupBlocked = blockedLocalStateIds.includes("rewrite-setup");
  const lootPrefsBlocked = blockedLocalStateIds.includes("loot-prefs");
  const lootSettingsBlocked = blockedLocalStateIds.includes("loot-settings");
  const hiddenGearTiersBlocked = blockedLocalStateIds.includes("hidden-gear-tiers");
  const duelSnapshotsBlocked = blockedLocalStateIds.includes("duel-snapshots");
  const priceHistoryBlocked = blockedLocalStateIds.includes("price-history");
  const plannerUiBlocked = blockedLocalStateIds.includes("planner-ui");
  const setupFileTransfer = useSetupFileTransfer();
  const workspaceFileTransfer = useWorkspaceFileTransfer();
  const workspaceIncludesLastHiscoresPlayer = workspaceFileTransfer.includeLastHiscoresPlayer;
  const setWorkspaceHiscoresOptIn = workspaceFileTransfer.setIncludeLastHiscoresPlayer;
  const priceSetTransfer = usePriceSetTransfer({
    storage,
    storageUnavailable: localPersistenceUnavailable,
    clearStorageFailures: localStateRecovery.clearStorageFailures,
    recordStorageFailure: localStateRecovery.recordStorageFailure,
    markPersistenceUnavailable: localStateRecovery.markPersistenceUnavailable,
    canStartDurableWrite: localStateRecovery.canStartDurableWrite,
    recordCurrentBaselines: localStateRecovery.recordCurrentBaselines,
    unblockReplaced: localStateRecovery.unblockReplaced,
    refreshLocalStateHealth: localStateRecovery.refresh
  });
  const hiscores = useHiscoresLookup({
    storage,
    clearStorageFailures: localStateRecovery.clearStorageFailures,
    recordStorageFailure: localStateRecovery.recordStorageFailure,
    canStartDurableWrite: localStateRecovery.canStartDurableWrite,
    recordCurrentBaselines: localStateRecovery.recordCurrentBaselines,
    unblockReplaced: localStateRecovery.unblockReplaced,
    refreshLocalStateHealth: localStateRecovery.refresh
  });
  const lastHiscoresPlayerState = useMemo(() => {
    const parsed = LastHiscoresPlayerStateSchema.safeParse({ player: hiscores.player });
    return parsed.success ? parsed.data : null;
  }, [hiscores.player]);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [receivedShareableSetupPayload, setReceivedShareableSetupPayload] = useState(
    captureBrowserShareableSetupFragment
  );
  const [shareReviewDismissed, setShareReviewDismissed] = useState(false);
  const [shareComparisonBaseline, setShareComparisonBaseline] = useState(() => ({
    form,
    cannonByMonster,
    lootPrefsByMonster,
    lootSettingsByMonster
  }));
  const [shareDialog, setShareDialog] = useState<ShareSetupDialogState | null>(null);
  const [shareCreateNotice, setShareCreateNotice] = useState<string | null>(null);
  const [setupImportNotice, setSetupImportNotice] = useState<InlineNoticeViewModel | null>(null);
  const [duelImportNotice, setDuelImportNotice] = useState<InlineNoticeViewModel | null>(null);
  const [duelImportReview, setDuelImportReview] = useState<{
    id: number;
    plan: SavedSetupMergePlan;
    context: SetupTransferContextReview;
  } | null>(null);
  const duelLoadReviewIdRef = useRef(0);
  const [duelLoadReview, setDuelLoadReview] = useState<{
    id: number;
    snapshotId: string;
    snapshotName: string;
    changeReview: SetupTransferChangeReview;
  } | null>(null);
  const [duelSessionOnlyRequest, setDuelSessionOnlyRequest] = useState<{
    request: SavedSetupChangeRequest;
    kind: "merge" | "rename";
    reviewId: number | null;
  } | null>(null);
  const [duelChangeRevision, setDuelChangeRevision] = useState(0);
  const [priceLabel, setPriceLabel] = useState(
    "Scheduled static prices + generated item fallbacks"
  );
  const [marketNotice, setMarketNotice] = useState<{
    tone: "neutral" | "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [economyBaselineMode, setEconomyBaselineMode] =
    useState<PriceHistoryBaselineMode>("previous");
  const handlePlannerDraftReconciled = useCallback(
    (nextState: PlannerUiState, adjustments: readonly PlannerProgressAdjustment[]) => {
      setPlannerState(nextState);
      setPlannerAdjustmentNotice(plannerProgressAdjustmentNotice(adjustments));
    },
    []
  );
  const [economySnapshotKey, setEconomySnapshotKey] = useState("");
  const [economyItemFilter, setEconomyItemFilter] = useState("");
  const [economyTrendItemId, setEconomyTrendItemId] = useState("");
  const [economySort, setEconomySort] = useState<PriceHistoryMoverSortState>({
    key: "gpDelta",
    direction: "desc"
  });
  const [priceHistoryClearPending, setPriceHistoryClearPending] = useState(false);
  const [priceHistoryReview, setPriceHistoryReview] = useState<
    | { kind: "removal"; candidate: LocalPriceHistoryRemovalCandidate }
    | { kind: "replacement"; candidate: FullHistoryReplacementCandidate }
    | null
  >(null);
  const [priceHistoryNotice, setPriceHistoryNotice] = useState<{
    tone: "neutral" | "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [monsterRemovalCandidate, setMonsterRemovalCandidate] =
    useState<MonsterSpecificRemovalCandidate | null>(null);
  const [monsterChangesNotice, setMonsterChangesNotice] = useState<{
    tone: "neutral" | "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [monsterChangesSessionOnlyAvailable, setMonsterChangesSessionOnlyAvailable] =
    useState(false);
  const [monsterSpecificReviewRequest, setMonsterSpecificReviewRequest] =
    useState<MonsterSpecificReviewRequest | null>(null);
  const [lootUiState, setLootUiState] = useState<{
    notice: string | null;
    sort: LootTableSortState;
    nestedSort: LootNestedTableSortState;
  }>({
    notice: null,
    sort: DEFAULT_LOOT_TABLE_SORT_STATE,
    nestedSort: DEFAULT_LOOT_NESTED_TABLE_SORT_STATE
  });
  const setLootNotice = (notice: string | null) =>
    setLootUiState((current) => ({ ...current, notice }));
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [activeSetupReset, setActiveSetupReset] = useState(INITIAL_ACTIVE_SETUP_RESET_STATE);
  const [respectLoadoutRequirements, setRespectLoadoutRequirements] = useState(true);
  const [initialWorkbenchPane] = useState(() =>
    parseWorkbenchPaneUrl(
      typeof window === "undefined" ? "https://workbench.invalid/" : window.location.href
    )
  );
  const [activeTab, setActiveTab] = useState<WorkbenchTabId>(initialWorkbenchPane.pane);
  const activeTabRef = useRef<WorkbenchTabId>(initialWorkbenchPane.pane);
  const [requestedPaneFamilies, setRequestedPaneFamilies] = useState<ReadonlySet<PaneFamily>>(() =>
    createInitialRequestedPaneFamilies(initialWorkbenchPane.pane)
  );
  const [paneLoadStates, setPaneLoadStates] = useState<Record<PaneFamily, PaneLoadState>>(() =>
    createInitialPaneLoadStates(initialWorkbenchPane.pane)
  );
  const historyFocusTabRef = useRef<WorkbenchTabId | null>(null);
  const lastFocusedInsidePaneTabRef = useRef<WorkbenchTabId | null>(null);
  const activateWorkbenchTab = useCallback(
    (tabId: WorkbenchTabId, source: WorkbenchActivationSource): void => {
      const family = paneFamilyForTab(tabId);
      setRequestedPaneFamilies((current) => requestPaneFamily(current, tabId));
      setPaneLoadStates((current) =>
        current[family] === "not-requested" ? { ...current, [family]: "loading" } : current
      );
      if (activeTabRef.current === tabId) return;

      const mutation = workbenchHistoryMutationForSource(source);
      if (typeof window !== "undefined" && mutation !== "none") {
        const url = createWorkbenchPaneUrl(window.location.href, tabId);
        const state = { kind: "workbench-pane", version: 1, pane: tabId } as const;
        if (mutation === "push") window.history.pushState(state, "", url);
        if (mutation === "replace") window.history.replaceState(state, "", url);
      }
      activeTabRef.current = tabId;
      setActiveTab(tabId);
    },
    []
  );
  const updatePaneLoadState = useCallback((family: PaneFamily, state: PaneLoadState): void => {
    setPaneLoadStates((current) =>
      current[family] === state ? current : { ...current, [family]: state }
    );
  }, []);
  const [localStateReviewRequest, setLocalStateReviewRequest] = useState(0);
  const [workspaceBackupFocusRequest, setWorkspaceBackupFocusRequest] = useState(0);
  const [crossTabSelectedIds, setCrossTabSelectedIds] = useState<CrossTabAreaId[]>([]);
  const [crossTabNotice, setCrossTabNotice] = useState<{
    tone: "neutral" | "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [economyReviewRequest, setEconomyReviewRequest] = useState(0);
  const [priceNotesOpen, setPriceNotesOpen] = useState(false);
  const [priceItemReviewRequest, setPriceItemReviewRequest] =
    useState<PriceItemReviewRequest | null>(null);
  const shareSetupButtonRef = useRef<HTMLButtonElement>(null);
  const setupImportInputRef = useRef<HTMLInputElement>(null);
  const workspaceImportInputRef = useRef<HTMLInputElement>(null);
  const workspaceExportButtonRef = useRef<HTMLButtonElement>(null);
  const workspaceReviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const handledWorkspaceBackupFocusRequestRef = useRef(0);
  const monsterRemovalIdRef = useRef(0);
  const priceHistoryReviewIdRef = useRef(0);
  const handledPriceHistoryReviewIdRef = useRef(0);
  const monsterReviewIdRef = useRef(0);
  const handledMonsterRemovalIdRef = useRef(0);
  const handledMonsterSpecificReviewRef = useRef(0);
  const monsterChangesExecutionRef = useRef<MonsterSpecificExecutionInput | null>(null);
  const monsterChangesTransactionRef = useRef<MonsterSpecificChangesTransactionCore | null>(null);
  if (monsterChangesTransactionRef.current === null) {
    monsterChangesTransactionRef.current = new MonsterSpecificChangesTransactionCore();
  }
  const savedSetupChangesExecutionRef = useRef<SavedSetupChangesExecutionInput | null>(null);
  const savedSetupChangesTransactionRef = useRef<SavedSetupChangesTransactionCore | null>(null);
  if (savedSetupChangesTransactionRef.current === null) {
    savedSetupChangesTransactionRef.current = new SavedSetupChangesTransactionCore();
  }
  const resetSetupButtonRef = useRef<HTMLButtonElement>(null);
  const setupModeHeadingRef = useRef<HTMLElement>(null);
  const playerLevelGroupRef = useRef<HTMLDivElement>(null);
  const duelImportAttemptRef = useRef(0);
  const priceNotesSummaryRef = useRef<HTMLElement>(null);
  const marketHeadingRef = useRef<HTMLHeadingElement>(null);
  const selectedPriceItemRef = useRef<HTMLDivElement>(null);
  const loadoutWeaponTriggerRef = useRef<HTMLButtonElement>(null);
  const tripFoodPerKillOverrideRef = useRef<HTMLSelectElement>(null);
  const priceHistoryReviewReturnFocusRef = useRef<HTMLButtonElement>(null);
  const priceHistoryReviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const priceHistoryManagementSummaryRef = useRef<HTMLElement>(null);
  const focusedPriceHistoryReviewIdRef = useRef(0);
  const manualPriceInputRef = useRef<HTMLInputElement>(null);
  const priceNoticeActionRefs = useRef(new Map<string, HTMLButtonElement>());
  const nextPriceItemReviewRequestRef = useRef(0);
  const handledPriceItemReviewRequestRef = useRef(0);
  const handledLocalStateReviewRequestRef = useRef(0);
  const handledEconomyReviewRequestRef = useRef(0);
  const handledWorkspaceReviewIdRef = useRef(0);
  const workspaceExecutionRef = useRef<WorkspaceRestoreExecutionInput | null>(null);
  const pendingPaneFocusRef = useRef<{
    id: number;
    tabId: WorkbenchTabId;
    target(): HTMLElement | null;
  } | null>(null);
  const nextPaneFocusIdRef = useRef(0);
  const [paneFocusRevision, setPaneFocusRevision] = useState(0);

  const focusPaneTarget = useCallback(
    (tabId: WorkbenchTabId, target: () => HTMLElement | null): void => {
      nextPaneFocusIdRef.current += 1;
      pendingPaneFocusRef.current = { id: nextPaneFocusIdRef.current, tabId, target };
      setPaneFocusRevision(nextPaneFocusIdRef.current);
      activateWorkbenchTab(tabId, "routed-action");
    },
    [activateWorkbenchTab]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initialWorkbenchPane.status === "invalid") {
      const current = parseWorkbenchPaneUrl(window.location.href);
      if (current.status === "invalid") {
        window.history.replaceState(
          { kind: "workbench-pane", version: 1, pane: current.pane },
          "",
          removeInvalidWorkbenchPane(window.location.href)
        );
      }
    }

    const handleFocusIn = (event: FocusEvent): void => {
      const panel = document.getElementById("workbench-active-panel");
      if (event.target instanceof Node && panel?.contains(event.target)) {
        lastFocusedInsidePaneTabRef.current = activeTabRef.current;
        return;
      }
      if (event.target === document.body || event.target === document.documentElement) return;
      lastFocusedInsidePaneTabRef.current = null;
    };
    const handlePopState = (): void => {
      const parsed = parseWorkbenchPaneUrl(window.location.href);
      if (parsed.pane !== activeTabRef.current) {
        const activeElement = document.activeElement;
        const panel = document.getElementById("workbench-active-panel");
        const focusWasInsidePane =
          (activeElement instanceof HTMLElement && panel?.contains(activeElement)) ||
          lastFocusedInsidePaneTabRef.current === activeTabRef.current;
        historyFocusTabRef.current = focusWasInsidePane ? parsed.pane : null;
        lastFocusedInsidePaneTabRef.current = null;
      }
      activateWorkbenchTab(parsed.pane, "history");
    };
    document.addEventListener("focusin", handleFocusIn);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [activateWorkbenchTab, initialWorkbenchPane.status]);

  useEffect(() => {
    if (historyFocusTabRef.current !== activeTab) return;
    let focusFrame = 0;
    const renderFrame = window.requestAnimationFrame(() => {
      focusFrame = window.requestAnimationFrame(() => {
        if (historyFocusTabRef.current !== activeTab) return;
        document.getElementById(`workbench-tab-${activeTab}`)?.focus({ preventScroll: true });
        historyFocusTabRef.current = null;
      });
    });
    return () => {
      window.cancelAnimationFrame(renderFrame);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [activeTab]);

  useEffect(() => {
    const request = pendingPaneFocusRef.current;
    if (!request || request.id !== paneFocusRevision) return;
    if (activeTab !== request.tabId) {
      pendingPaneFocusRef.current = null;
      return;
    }
    if (paneLoadStates[paneFamilyForTab(request.tabId)] !== "ready") return;

    let frameId = 0;
    let timeoutId = 0;
    const attemptFocus = (): boolean => {
      if (pendingPaneFocusRef.current?.id !== request.id) return true;
      const target = request.target();
      if (!target) return false;
      target.focus({ preventScroll: true });
      const bounds = target.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
        target.scrollIntoView({ block: "nearest" });
      }
      pendingPaneFocusRef.current = null;
      return true;
    };
    const observer = new MutationObserver(() => {
      if (!attemptFocus()) return;
      observer.disconnect();
      window.clearTimeout(timeoutId);
    });
    frameId = window.requestAnimationFrame(() => {
      if (attemptFocus()) return;
      const panel = document.getElementById("workbench-active-panel");
      if (panel) observer.observe(panel, { childList: true, subtree: true });
      timeoutId = window.setTimeout(() => observer.disconnect(), 5_000);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [activeTab, paneFocusRevision, paneLoadStates]);

  const setPriceNoticeActionRef = useCallback(
    (noticeId: string, element: HTMLButtonElement | null) => {
      if (element) {
        priceNoticeActionRefs.current.set(noticeId, element);
      } else {
        priceNoticeActionRefs.current.delete(noticeId);
      }
    },
    []
  );

  useEffect(() => {
    const request = priceItemReviewRequest;
    if (
      !request ||
      request.id === handledPriceItemReviewRequestRef.current ||
      activeTab !== "economy" ||
      paneLoadStates["economy-settings"] !== "ready" ||
      (request.action.kind === "correct-price" && manualPriceItemId !== request.action.itemId) ||
      (request.action.kind === "inspect-item" && !priceNotesOpen)
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const target =
        request.action.kind === "correct-price"
          ? manualPriceInputRef.current
          : priceNoticeActionRefs.current.get(request.action.noticeId);
      const focusTarget = target ?? priceNotesSummaryRef.current;
      focusTarget?.focus({ preventScroll: true });
      if (focusTarget) {
        const bounds = focusTarget.getBoundingClientRect();
        if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
          focusTarget.scrollIntoView({ block: "nearest" });
        }
      }
      if (request.action.kind === "inspect-item" && !target) {
        setMarketNotice({
          tone: "neutral",
          message: "That price note changed before review. Showing the current price data notes."
        });
      }
      handledPriceItemReviewRequestRef.current = request.id;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, manualPriceItemId, paneLoadStates, priceItemReviewRequest, priceNotesOpen]);

  /* eslint-disable react-hooks/set-state-in-effect -- External storage revisions reset the bounded conflict review selection. */
  useEffect(() => {
    const eligible = crossTabConflicts.conflicts
      .filter(
        (conflict) => conflict.externalStatus === "valid" || conflict.externalStatus === "missing"
      )
      .map((conflict) => conflict.id);
    setCrossTabSelectedIds(eligible);
    if (
      crossTabConflicts.conflicts.some(
        (conflict) =>
          conflict.externalStatus === "invalid" || conflict.externalStatus === "unsupported"
      )
    ) {
      refreshLocalStateRecovery();
    }
    if (eligible.length === 0 && crossTabConflicts.conflicts.length === 0) {
      setCrossTabNotice(null);
    }
  }, [crossTabConflicts.conflicts, crossTabConflicts.notice?.revision, refreshLocalStateRecovery]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (
      localStateReviewRequest === 0 ||
      localStateReviewRequest === handledLocalStateReviewRequestRef.current
    ) {
      return;
    }
    if (activeTab !== "settings" || paneLoadStates["economy-settings"] !== "ready") return;
    if (!localStateRecovery.report.hasAttention && crossTabConflicts.conflicts.length === 0) {
      handledLocalStateReviewRequestRef.current = localStateReviewRequest;
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const heading = document.getElementById(
        crossTabConflicts.conflicts.length > 0
          ? CROSS_TAB_CONFLICT_HEADING_ID
          : LOCAL_STATE_RECOVERY_HEADING_ID
      );
      if (heading instanceof HTMLElement) {
        heading.focus({ preventScroll: true });
        const bounds = heading.getBoundingClientRect();
        if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
          heading.scrollIntoView({ block: "nearest" });
        }
      }
      handledLocalStateReviewRequestRef.current = localStateReviewRequest;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeTab,
    crossTabConflicts.conflicts.length,
    localStateRecovery.report.hasAttention,
    localStateReviewRequest,
    paneLoadStates
  ]);

  useEffect(() => {
    if (
      activeTab !== "economy" ||
      paneLoadStates["economy-settings"] !== "ready" ||
      economyReviewRequest === 0 ||
      economyReviewRequest === handledEconomyReviewRequestRef.current
    ) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const heading = marketHeadingRef.current;
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: "nearest" });
      if (heading) handledEconomyReviewRequestRef.current = economyReviewRequest;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, economyReviewRequest, paneLoadStates]);

  useEffect(() => {
    if (
      activeTab !== "settings" ||
      paneLoadStates["economy-settings"] !== "ready" ||
      workspaceBackupFocusRequest === 0 ||
      workspaceBackupFocusRequest === handledWorkspaceBackupFocusRequestRef.current
    ) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const button = workspaceExportButtonRef.current;
      button?.focus({ preventScroll: true });
      button?.scrollIntoView({ block: "nearest" });
      if (button) handledWorkspaceBackupFocusRequestRef.current = workspaceBackupFocusRequest;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, paneLoadStates, workspaceBackupFocusRequest]);

  useEffect(() => {
    const reviewId = priceHistoryReview?.candidate.id;
    if (
      activeTab !== "economy" ||
      paneLoadStates["economy-settings"] !== "ready" ||
      !reviewId ||
      focusedPriceHistoryReviewIdRef.current === reviewId
    ) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const heading = priceHistoryReviewHeadingRef.current;
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: "nearest" });
      if (heading) focusedPriceHistoryReviewIdRef.current = reviewId;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, paneLoadStates, priceHistoryReview]);

  useEffect(() => {
    if (!lastHiscoresPlayerState && workspaceIncludesLastHiscoresPlayer) {
      setWorkspaceHiscoresOptIn(false);
    }
  }, [lastHiscoresPlayerState, setWorkspaceHiscoresOptIn, workspaceIncludesLastHiscoresPlayer]);

  useEffect(() => {
    const reviewId = workspaceFileTransfer.review?.id;
    if (
      !reviewId ||
      reviewId === handledWorkspaceReviewIdRef.current ||
      activeTab !== "settings" ||
      paneLoadStates["economy-settings"] !== "ready"
    ) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const heading = workspaceReviewHeadingRef.current;
      if (heading instanceof HTMLElement) {
        heading.focus({ preventScroll: true });
        const bounds = heading.getBoundingClientRect();
        if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
          heading.scrollIntoView({ block: "nearest" });
        }
      }
      if (heading) handledWorkspaceReviewIdRef.current = reviewId;
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, paneLoadStates, workspaceFileTransfer.review?.id]);

  useEffect(() => {
    if (activeTab !== "settings" || workspaceFileTransfer.notice?.tone !== "error") return;
    const frameId = window.requestAnimationFrame(() => {
      document.getElementById("workspace-restore-error-summary")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab, workspaceFileTransfer.notice]);

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
    if (priceHistory.snapshots.length > 0) {
      prepareExternalLocalStateApply(["price-history"]);
    }
    setReadyToPersist(true);
  }, [
    blockContextInvalidLocalState,
    prepareExternalLocalStateApply,
    priceHistory.snapshots.length,
    runtimeBootstrap
  ]);
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
  const rewriteSetupForPersistence = useMemo(
    () =>
      savedSetupFromForm(
        form,
        denseCompareForGameData,
        cannonByMonster,
        customSetupsByMonster,
        defaultForm,
        setupMode
      ),
    [cannonByMonster, customSetupsByMonster, defaultForm, denseCompareForGameData, form, setupMode]
  );
  const rewriteSetupPersistenceIdentity = useMemo(
    () => setupPersistenceIdentity(rewriteSetupForPersistence),
    [rewriteSetupForPersistence]
  );
  const recordSetupPersistenceOutcome = useCallback(
    (setup: SavedSetupState, kind: SettledSetupPersistenceKind): void => {
      setSetupPersistenceOutcome({ identity: setupPersistenceIdentity(setup), kind });
    },
    []
  );
  const persistRewriteSetupValue = useCallback(
    (setup: SavedSetupState): boolean => {
      const persisted = persistLocalState("rewrite-setup", setupStorageOptions, setup);
      recordSetupPersistenceOutcome(
        setup,
        persisted ? "saved" : localPersistenceUnavailable ? "session-only" : "failed"
      );
      return persisted;
    },
    [persistLocalState, recordSetupPersistenceOutcome]
  );
  const setupPersistenceKind: SetupPersistenceKind = !readyToPersist
    ? "saving"
    : rewriteSetupBlocked || localPersistenceUnavailable
      ? "session-only"
      : setupPersistenceOutcome?.identity === rewriteSetupPersistenceIdentity
        ? setupPersistenceOutcome.kind
        : "saving";
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

  /* eslint-disable react-hooks/set-state-in-effect -- This synchronous persistence effect publishes the outcome for the exact setup value it just attempted. */
  useEffect(() => {
    if (!readyToPersist || rewriteSetupBlocked) {
      return;
    }
    if (shouldSkipPersistLocalState("rewrite-setup")) {
      setSetupPersistenceOutcome((current) =>
        current?.identity === rewriteSetupPersistenceIdentity
          ? current
          : {
              identity: rewriteSetupPersistenceIdentity,
              kind: localPersistenceUnavailable ? "session-only" : "saved"
            }
      );
      return;
    }
    persistRewriteSetupValue(rewriteSetupForPersistence);
  }, [
    persistRewriteSetupValue,
    rewriteSetupBlocked,
    readyToPersist,
    rewriteSetupForPersistence,
    rewriteSetupPersistenceIdentity,
    shouldSkipPersistLocalState
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!readyToPersist || lootPrefsBlocked || shouldSkipPersistLocalState("loot-prefs")) {
      return;
    }
    persistLocalState("loot-prefs", lootPrefsStorageOptions, lootPrefsForGameData);
  }, [
    lootPrefsBlocked,
    lootPrefsForGameData,
    persistLocalState,
    readyToPersist,
    shouldSkipPersistLocalState
  ]);

  useEffect(() => {
    if (!readyToPersist || lootSettingsBlocked || shouldSkipPersistLocalState("loot-settings")) {
      return;
    }
    persistLocalState("loot-settings", lootSettingsStorageOptions, lootSettingsByMonster);
  }, [
    lootSettingsBlocked,
    lootSettingsByMonster,
    persistLocalState,
    readyToPersist,
    shouldSkipPersistLocalState
  ]);

  useEffect(() => {
    if (
      !readyToPersist ||
      hiddenGearTiersBlocked ||
      shouldSkipPersistLocalState("hidden-gear-tiers")
    ) {
      return;
    }
    persistLocalState("hidden-gear-tiers", hiddenGearTiersStorageOptions, hiddenGearTiers);
  }, [
    hiddenGearTiersBlocked,
    hiddenGearTiers,
    persistLocalState,
    readyToPersist,
    shouldSkipPersistLocalState
  ]);

  useEffect(() => {
    if (!readyToPersist || duelSnapshotsBlocked || shouldSkipPersistLocalState("duel-snapshots")) {
      return;
    }
    persistLocalState("duel-snapshots", duelSnapshotsStorageOptions, duelSnapshots);
  }, [
    duelSnapshotsBlocked,
    duelSnapshots,
    persistLocalState,
    readyToPersist,
    shouldSkipPersistLocalState
  ]);

  useEffect(() => {
    if (
      !readyToPersist ||
      priceHistoryBlocked ||
      priceHistory.snapshots.length === 0 ||
      shouldSkipPersistLocalState("price-history")
    ) {
      return;
    }
    persistLocalState("price-history", priceHistoryStorageOptions, priceHistory);
  }, [
    priceHistoryBlocked,
    persistLocalState,
    priceHistory,
    readyToPersist,
    shouldSkipPersistLocalState
  ]);

  useEffect(() => {
    if (!readyToPersist || plannerUiBlocked || shouldSkipPersistLocalState("planner-ui")) {
      return;
    }
    persistLocalState("planner-ui", plannerUiStorageOptions, plannerState);
  }, [
    plannerUiBlocked,
    persistLocalState,
    plannerState,
    readyToPersist,
    shouldSkipPersistLocalState
  ]);

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
  const sharedSetupChangeStates = useMemo(() => {
    if (!context || receivedShareableSetupInspection?.status !== "ready") return null;
    const incoming = receivedShareableSetupInspection.review.envelope.data;
    const monster = context.gameData.monsters[incoming.form.monsterId];
    const validLootRowIds = monster ? lootPreferenceKeysForMonster(monster) : [];
    return {
      current: {
        form,
        cannon: cannonByMonster[incoming.form.monsterId] ?? DEFAULT_CANNON_SETTINGS,
        lootPreferences: selectLootPrefsForMonster(
          lootPrefsForGameData,
          incoming.form.monsterId,
          validLootRowIds
        ),
        lootSettings: lootSettingsForMonster(lootSettingsByMonster, incoming.form.monsterId)
      },
      incoming: {
        form: incoming.form,
        cannon: incoming.cannon,
        lootPreferences: incoming.lootPreferences,
        lootSettings: incoming.lootSettings
      }
    };
  }, [
    cannonByMonster,
    context,
    form,
    lootPrefsForGameData,
    lootSettingsByMonster,
    receivedShareableSetupInspection
  ]);

  const sharedSetupBaselineState = useMemo(() => {
    if (!context || !sharedSetupChangeStates) return null;
    const monsterId = sharedSetupChangeStates.incoming.form.monsterId;
    const monster = context.gameData.monsters[monsterId];
    return {
      form: shareComparisonBaseline.form,
      cannon: shareComparisonBaseline.cannonByMonster[monsterId] ?? DEFAULT_CANNON_SETTINGS,
      lootPreferences: selectLootPrefsForMonster(
        shareComparisonBaseline.lootPrefsByMonster,
        monsterId,
        monster ? lootPreferenceKeysForMonster(monster) : []
      ),
      lootSettings: lootSettingsForMonster(shareComparisonBaseline.lootSettingsByMonster, monsterId)
    };
  }, [context, shareComparisonBaseline, sharedSetupChangeStates]);
  const shareChangeReview = useMemo(
    () =>
      context && sharedSetupChangeStates && sharedSetupBaselineState
        ? createSharedSetupChangeReview({
            current: sharedSetupBaselineState,
            incoming: sharedSetupChangeStates.incoming,
            gameData: context.gameData
          })
        : null,
    [context, sharedSetupBaselineState, sharedSetupChangeStates]
  );

  const sharedSetupChangeReviewStale =
    shareChangeReview !== null &&
    sharedSetupChangeStates !== null &&
    !sharedSetupReviewMatchesCurrent(shareChangeReview, sharedSetupChangeStates.current);
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
        },
        timeZone: priceTimeZone
      }),
    [
      economyBaselineMode,
      economyItemFilter,
      economySnapshotKey,
      economySort,
      economyTrendItemId,
      priceHistoryItemLabels,
      priceHistorySources,
      priceTimeZone
    ]
  );
  const priceHistorySummary = useMemo(
    () =>
      createPriceHistorySummaryPresentation({
        analysisState: priceHistorySources.analysisState,
        activePriceSet: context?.priceSet ?? null,
        evaluatedAt: new Date(priceAgeNowMs),
        timeZone: priceTimeZone,
        latestExactTime: economyHistory.latestCaptureTime
      }),
    [
      context?.priceSet,
      economyHistory.latestCaptureTime,
      priceAgeNowMs,
      priceHistorySources.analysisState,
      priceTimeZone
    ]
  );
  const lootPriceHistoryByItem: Readonly<Record<string, ItemPriceHistoryContext>> =
    economyHistory.lootHistoryByItem;
  const editablePriceItemIds = useMemo(
    () => new Set(Object.keys(basePriceSet?.itemPrices ?? {})),
    [basePriceSet]
  );

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
              },
              editablePriceItemIds
            }
          )
        : null,
    [
      cannonByMonster,
      context,
      currentLootPrefs,
      customSetupsByMonster,
      editablePriceItemIds,
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
            {},
            DEFAULT_LOOT_SETTINGS_STATE
          )
        : null,
    [cannonByMonster, context, form]
  );
  const appReadyForDocumentTitle = Boolean(context && viewModel && derivedViewModel);
  const documentTitleTarget = context?.gameData.monsters[form.monsterId]?.name ?? null;
  useEffect(() => {
    if (!appReadyForDocumentTitle || typeof document === "undefined") return;
    const previousTitle = document.title;
    document.title = formatWorkbenchDocumentTitle({
      pane: activeTab,
      combatStyle: form.combatStyle,
      targetLabel: documentTitleTarget
    });
    return () => {
      document.title = previousTitle;
    };
  }, [activeTab, appReadyForDocumentTitle, documentTitleTarget, form.combatStyle]);
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
    lootSettingsByMonster,
    onDraftReconciled: handlePlannerDraftReconciled
  });
  const plannerSkillInputs = useMemo(
    () => createPlannerSkillInputViewModels(form, plannerState),
    [form, plannerState]
  );
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
    presentation: denseComparePresentation,
    retry: retryDenseCompare
  } = compareCalculation;
  const {
    comparison: duelComparison,
    comparisonRows: duelComparisonRows,
    comparisonSort: duelComparisonSort,
    viewMode: duelViewMode,
    expandedDiffId: expandedDuelDiffId,
    matrixMetric: duelMatrixMetric,
    matrixFilter: duelMatrixFilter,
    matrixPresentation: duelMatrixPresentation,
    filteredMatrixRows: filteredDuelMatrixRows,
    matrixSort: duelMatrixSort,
    showCurrentTarget: showCurrentDuelTarget,
    showMonsterMatrix: showDuelMonsterMatrix,
    toggleDiff: toggleDuelDiff,
    sortComparisonBy: sortDuelComparisonBy,
    setMatrixMetric: setDuelMatrixMetric,
    setMatrixFilter: setDuelMatrixFilter,
    sortMatrixBy: sortDuelMatrixBy,
    buildMatrix: buildDuelMatrix
  } = duelPane;
  const {
    panel: plannerPanel,
    gearPoolEditor: plannerGearPoolEditor,
    draftDirty: plannerDraftDirty,
    presentation: plannerPresentation,
    computedMetric: plannerComputedMetric,
    recompute: recomputePlanner,
    retry: retryPlanner
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

  const currentRewriteSetup = useMemo(
    () =>
      savedSetupFromForm(
        form,
        denseCompare,
        cannonByMonster,
        customSetupsByMonster,
        defaultForm,
        setupMode
      ),
    [cannonByMonster, customSetupsByMonster, defaultForm, denseCompare, form, setupMode]
  );
  const captureCurrentRewriteSetup = (): SavedSetupState => currentRewriteSetup;
  const activeSetupImportReview = setupFileTransfer.review;
  const checkSetupImportReviewFreshness = setupFileTransfer.checkReviewFreshness;

  useEffect(() => {
    const review = activeSetupImportReview;
    if (!review || review.stale) return;
    checkSetupImportReviewFreshness(review.id, currentRewriteSetup);
  }, [activeSetupImportReview, checkSetupImportReviewFreshness, currentRewriteSetup]);

  const currentMonsterSpecificLiveState = useMemo<MonsterSpecificLiveState>(
    () => ({
      setup: currentRewriteSetup,
      lootPrefs: lootPrefsForGameData,
      lootSettings: lootSettingsByMonster
    }),
    [currentRewriteSetup, lootPrefsForGameData, lootSettingsByMonster]
  );
  const monsterSpecificChanges = useMemo(
    () =>
      context
        ? createMonsterSpecificChangesViewModel({
            gameData: context.gameData,
            setup: currentRewriteSetup,
            lootPrefs: lootPrefsForGameData,
            lootSettings: lootSettingsByMonster,
            activeMonsterId: form.monsterId
          })
        : {
            monsterCount: 0,
            categoryCount: 0,
            countsByKind: {
              "custom-setup": 0,
              cannon: 0,
              "loot-actions": 0,
              "loot-settings": 0,
              "compare-hidden": 0
            },
            rows: []
          },
    [context, currentRewriteSetup, form.monsterId, lootPrefsForGameData, lootSettingsByMonster]
  );

  const currentWorkspaceLiveState = useMemo<WorkspaceLiveState>(
    () => ({
      "rewrite-setup": currentRewriteSetup,
      "planner-ui": plannerState,
      "loot-prefs": lootPrefsForGameData,
      "loot-settings": lootSettingsByMonster,
      "hidden-gear-tiers": hiddenGearTiers,
      "duel-snapshots": duelSnapshots,
      "price-history": priceHistory,
      "selected-price-set": activePriceSetOrigin === "selected" ? basePriceSet : null,
      "manual-price-overrides": manualPriceOverrides,
      "hiscores-last-player": lastHiscoresPlayerState
    }),
    [
      activePriceSetOrigin,
      basePriceSet,
      currentRewriteSetup,
      duelSnapshots,
      hiddenGearTiers,
      lastHiscoresPlayerState,
      lootPrefsForGameData,
      lootSettingsByMonster,
      manualPriceOverrides,
      plannerState,
      priceHistory
    ]
  );
  const captureCurrentWorkspaceLiveState = (): WorkspaceLiveState => currentWorkspaceLiveState;
  const globalNonDurableReason: NonDurableReason | null = savedDataIgnoredForSession
    ? "saved-data-ignored"
    : localStorageAccessUnavailable
      ? "storage-unavailable"
      : null;

  useLayoutEffect(() => {
    if (!readyToPersist) return;
    sessionOnlyExitProtection.initialize(currentWorkspaceLiveState, globalNonDurableReason);
  }, [
    currentWorkspaceLiveState,
    globalNonDurableReason,
    readyToPersist,
    sessionOnlyExitProtection
  ]);

  useEffect(() => {
    if (!readyToPersist || !sessionOnlyExitProtection.getSnapshot().initialized) return;
    sessionOnlyExitProtection.reconcileCurrent(currentWorkspaceLiveState, globalNonDurableReason);
  }, [
    currentWorkspaceLiveState,
    globalNonDurableReason,
    readyToPersist,
    sessionOnlyExitProtection,
    sessionOnlyExitProtectionSnapshot.revision
  ]);
  useSessionOnlyBeforeUnload(sessionOnlyExitProtectionSnapshot.armed);

  const applyRewriteSetupState = (setup: SavedSetupState): void => {
    setForm(normalizeFormState(setup.form));
    setDefaultForm(normalizeFormState(setup.defaultForm));
    setSetupMode(setup.setupMode);
    setCustomSetupsByMonster(setup.customSetupsByMonster);
    setDenseCompare(setup.denseCompare);
    setCannonByMonster(setup.cannonByMonster);
  };

  const applyMonsterSpecificLiveState = (outcome: MonsterSpecificLiveOutcome): void => {
    const selected = new Set(outcome.selectedIds);
    if (selected.has("rewrite-setup")) applyRewriteSetupState(outcome.liveState.setup);
    if (selected.has("loot-prefs")) setLootPrefsByMonster(outcome.liveState.lootPrefs);
    if (selected.has("loot-settings")) setLootSettingsByMonster(outcome.liveState.lootSettings);
    setFatalError(null);
  };

  useEffect(() => {
    monsterChangesExecutionRef.current = {
      storageAccess: browserStorageAccess,
      persistenceUnavailable: localPersistenceUnavailable,
      liveState: currentMonsterSpecificLiveState,
      applyLiveState: applyMonsterSpecificLiveState,
      recovery: {
        canStartDurableWrite: localStateRecovery.canStartDurableWrite,
        prepareExternalApply: localStateRecovery.prepareExternalApply,
        cancelExternalApply: localStateRecovery.cancelExternalApply,
        completeExternalApply: localStateRecovery.completeExternalApply,
        completeExternalUndo: localStateRecovery.completeExternalUndo,
        recordExternalApplyFailure: localStateRecovery.recordExternalApplyFailure,
        markPersistenceUnavailable: localStateRecovery.markPersistenceUnavailable
      },
      now: () => new Date()
    };

    savedSetupChangesExecutionRef.current = {
      storageAccess: browserStorageAccess,
      persistenceUnavailable: localPersistenceUnavailable,
      persistenceBlocked: duelSnapshotsBlocked,
      liveState: duelSnapshots,
      applyLiveState: (next) => {
        setDuelSnapshots(next);
        setFatalError(null);
      },
      recovery: {
        canStartDurableWrite: localStateRecovery.canStartDurableWrite,
        prepareExternalApply: localStateRecovery.prepareExternalApply,
        cancelExternalApply: localStateRecovery.cancelExternalApply,
        completeExternalApply: localStateRecovery.completeExternalApply,
        completeExternalUndo: localStateRecovery.completeExternalUndo,
        recordExternalApplyFailure: localStateRecovery.recordExternalApplyFailure,
        markPersistenceUnavailable: localStateRecovery.markPersistenceUnavailable,
        unblockReplaced: localStateRecovery.unblockReplaced
      },
      now: () => new Date()
    };
  });

  useEffect(() => {
    const request = monsterSpecificReviewRequest;
    if (!request || request.id === handledMonsterSpecificReviewRef.current) return;
    const destination: WorkbenchTabId =
      request.kind === "custom-setup"
        ? "loadout"
        : request.kind === "cannon"
          ? "cannon"
          : request.kind === "loot-actions" || request.kind === "loot-settings"
            ? "loot"
            : "compare";
    if (activeTab !== destination) return;
    if (paneLoadStates[paneFamilyForTab(destination)] !== "ready") return;
    const stillPresent = monsterSpecificChanges.rows
      .find((row) => row.monsterId === request.monsterId)
      ?.categories.some((category) => category.kind === request.kind);
    if (!stillPresent) {
      handledMonsterSpecificReviewRef.current = request.id;
      return;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const target =
          request.kind === "custom-setup"
            ? document.getElementById("loadout-heading")
            : request.kind === "cannon"
              ? document.getElementById("cannon-heading")
              : request.kind === "loot-actions"
                ? document.getElementById("loot-actions-heading")
                : request.kind === "loot-settings"
                  ? document.getElementById("loot-settings-heading")
                  : (Array.from(
                      document.querySelectorAll<HTMLTableRowElement>("tr[data-monster-id]")
                    ).find((element) => element.dataset.monsterId === request.monsterId) ?? null);
        if (!target) return;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest" });
        handledMonsterSpecificReviewRef.current = request.id;
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [
    activeTab,
    denseCompareRows,
    monsterSpecificChanges.rows,
    monsterSpecificReviewRequest,
    paneLoadStates
  ]);

  const applyWorkspaceLiveState = (outcome: WorkspaceRestoreLiveOutcome): void => {
    const selected = new Set(outcome.selectedIds);
    if (selected.has("rewrite-setup")) {
      applyRewriteSetupState(outcome.liveState["rewrite-setup"]);
    }
    if (selected.has("planner-ui")) setPlannerState(outcome.liveState["planner-ui"]);
    if (selected.has("loot-prefs")) setLootPrefsByMonster(outcome.liveState["loot-prefs"]);
    if (selected.has("loot-settings")) {
      setLootSettingsByMonster(outcome.liveState["loot-settings"]);
    }
    if (selected.has("hidden-gear-tiers")) {
      setHiddenGearTiers(outcome.liveState["hidden-gear-tiers"]);
    }
    if (selected.has("duel-snapshots")) {
      savedSetupChangesTransactionRef.current?.invalidateUndo();
      setPendingUndo((current) => (current?.scope === "saved-setups" ? null : current));
      setDuelSessionOnlyRequest(null);
      setDuelSnapshots(outcome.liveState["duel-snapshots"]);
    }
    if (selected.has("price-history")) setPriceHistory(outcome.liveState["price-history"]);

    if (selected.has("selected-price-set") || selected.has("manual-price-overrides")) {
      setBasePriceSet(outcome.priceComposition.basePriceSet);
      setManualPriceOverrides(outcome.priceComposition.manualPriceOverrides);
      setActivePriceSetOrigin(outcome.priceComposition.activePriceSetOrigin);
      setPriceLabel(outcome.priceComposition.activePriceSet.label);
      setContext((current) =>
        current ? { ...current, priceSet: outcome.priceComposition.activePriceSet } : current
      );
      setManualPriceDraft(null);
      setManualPriceClearPending(false);
      setPriceAgeNowMs(Date.now());
    }
    if (selected.has("hiscores-last-player")) {
      hiscores.changePlayer(outcome.liveState["hiscores-last-player"]?.player ?? "");
    }

    for (const id of [
      "selected-price-set",
      "manual-price-overrides",
      "hiscores-last-player"
    ] as const) {
      if (selected.has(id)) shouldSkipPersistLocalState(id);
    }
    if (
      selected.has("price-history") &&
      outcome.liveState["price-history"].snapshots.length === 0
    ) {
      shouldSkipPersistLocalState("price-history");
    }
    setFatalError(null);
  };

  useEffect(() => {
    const fallback = scheduledPriceSetFromStatus(scheduledSnapshotStatus) ?? bundledPriceSet;
    if (!context || !fallback) {
      workspaceExecutionRef.current = null;
      return;
    }
    workspaceExecutionRef.current = {
      storageAccess: browserStorageAccess,
      persistenceUnavailable: localPersistenceUnavailable,
      context: {
        gameData: context.gameData,
        liveState: captureCurrentWorkspaceLiveState(),
        allowedPool: plannerAllowedPool(form.combatStyle, context),
        priceFallback: [
          fallback,
          scheduledPriceSetFromStatus(scheduledSnapshotStatus) ? "scheduled" : "bundled"
        ]
      },
      applyLiveState: applyWorkspaceLiveState,
      recovery: {
        canStartDurableWrite: localStateRecovery.canStartDurableWrite,
        prepareExternalApply: localStateRecovery.prepareExternalApply,
        cancelExternalApply: localStateRecovery.cancelExternalApply,
        completeExternalApply: localStateRecovery.completeExternalApply,
        completeExternalUndo: localStateRecovery.completeExternalUndo,
        recordExternalApplyFailure: localStateRecovery.recordExternalApplyFailure,
        markPersistenceUnavailable: localStateRecovery.markPersistenceUnavailable
      },
      now: () => new Date()
    };
  });

  const persistAndApplyRewriteSetup = (setup: SavedSetupState): boolean => {
    const persisted = persistRewriteSetupValue(setup);
    applyRewriteSetupState(setup);
    localStateRecovery.unblockReplaced(["rewrite-setup"]);
    localStateRecovery.refresh();
    return persisted;
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

  const setUndoableStatus = (
    label: string,
    restoreLabel: string,
    restore: () => string | void,
    scope?: PendingUndo["scope"]
  ) => {
    setPendingUndo({
      id: localUndoId(),
      label,
      restoreLabel,
      createdAt: Date.now(),
      scope,
      restore
    });
    setStatus(label);
  };

  const invalidatePendingEconomyUndo = (): void => {
    setPendingUndo((current) => (current?.scope === "economy-data" ? null : current));
  };

  const invalidateSavedSetupUndo = (): void => {
    savedSetupChangesTransactionRef.current?.invalidateUndo();
    setPendingUndo((current) => (current?.scope === "saved-setups" ? null : current));
    setDuelSessionOnlyRequest(null);
  };

  const registerSavedSetupUndo = (
    outcome: Extract<SavedSetupChangeApplyOutcome, { status: "applied" }>
  ): void => {
    setUndoableStatus(
      outcome.message,
      outcome.undoMessage,
      () => {
        const execution = savedSetupChangesExecutionRef.current;
        const transaction = savedSetupChangesTransactionRef.current;
        if (!execution || !transaction) return "Saved setup Undo is no longer available.";
        const undo = transaction.undo(execution);
        if (undo.status === "session-only-available") {
          setPendingUndo({
            id: localUndoId(),
            label: undo.message,
            restoreLabel: `${outcome.undoMessage} for this session`,
            createdAt: Date.now(),
            scope: "saved-setups",
            restore: () => {
              const currentExecution = savedSetupChangesExecutionRef.current;
              const currentTransaction = savedSetupChangesTransactionRef.current;
              if (!currentExecution || !currentTransaction) {
                return "Session-only saved setup Undo is no longer available.";
              }
              const sessionUndo = currentTransaction.undoForSession(currentExecution);
              setDuelImportNotice({
                tone: sessionUndo.status === "undone" ? "success" : "warning",
                message: sessionUndo.message
              });
              if (sessionUndo.status === "undone") {
                setDuelChangeRevision((value) => value + 1);
              }
              return sessionUndo.message;
            }
          });
        }
        setDuelImportNotice({
          tone:
            undo.status === "undone" ? "success" : undo.status === "failed" ? "error" : "warning",
          message: undo.message
        });
        if (undo.status === "undone") setDuelChangeRevision((value) => value + 1);
        return undo.message;
      },
      "saved-setups"
    );
  };

  const applySavedSetupChange = (
    request: SavedSetupChangeRequest,
    kind: "merge" | "rename",
    reviewId: number | null,
    mode: "durable" | "session-only"
  ): SavedSetupChangeApplyOutcome => {
    const execution = savedSetupChangesExecutionRef.current;
    const transaction = savedSetupChangesTransactionRef.current;
    if (!execution || !transaction) {
      return {
        status: "failed",
        recoveryRequired: false,
        message: "Saved setup change context is no longer available. Review the action again."
      };
    }
    const outcome =
      mode === "durable"
        ? transaction.applyDurable(request, execution)
        : transaction.applyForSession(request, execution);
    if (outcome.status === "session-only-available") {
      setDuelSessionOnlyRequest({ request, kind, reviewId });
      setDuelImportNotice({ tone: "warning", message: outcome.message });
      setStatus(outcome.message);
      return outcome;
    }
    if (outcome.status === "applied") {
      setDuelSessionOnlyRequest(null);
      setDuelImportNotice({
        tone: outcome.mode === "durable" ? "success" : "warning",
        message: outcome.message
      });
      if (kind === "merge") setDuelImportReview(null);
      setDuelChangeRevision((value) => value + 1);
      registerSavedSetupUndo(outcome);
      return outcome;
    }
    setDuelImportNotice({
      tone: outcome.status === "failed" ? "error" : "neutral",
      message: outcome.message
    });
    setStatus(outcome.message);
    return outcome;
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
    const undo = pendingUndo;
    setPendingUndo(null);
    const restoreStatus = undo.restore();
    setStatus(restoreStatus ?? undo.restoreLabel);
  };

  const reconcilePriceHistorySelection = (next: BrowserPriceHistoryState): void => {
    const nextSources = createPriceHistorySources({
      scheduledSnapshotStatus,
      localPriceHistory: next
    });
    setEconomySnapshotKey((current) =>
      nextSources.analysisState.snapshots.some(
        (snapshot) => `${snapshot.capturedAt}::${snapshot.sourcePriceSetId}` === current
      )
        ? current
        : ""
    );
  };

  const registerPriceHistoryUndo = (
    record: EconomyDataUndoRecord<BrowserPriceHistoryState>,
    actionStatus: string
  ): void => {
    setUndoableStatus(
      actionStatus,
      "Restored local price history",
      () =>
        record.restore({
          applyLiveState: (previousHistory) => {
            setPriceHistory(previousHistory);
            reconcilePriceHistorySelection(previousHistory);
            setPriceHistoryClearPending(false);
            setPriceHistoryReview(null);
          },
          recovery: localStateRecovery,
          onNotice: setPriceHistoryNotice,
          restoredMessage: "Restored local price history"
        }).message,
      "economy-data"
    );
  };

  const commitLocalPriceHistory = async (input: {
    current: BrowserPriceHistoryState;
    next: BrowserPriceHistoryState;
    destructive: boolean;
    durableMessage: string;
    sessionMessage: string;
    actionAt: Date;
    publishStatus?: boolean;
    invalidateUndo?: boolean;
  }) => {
    const { commitEconomyPriceHistory } = await loadEconomySettingsPane();
    if (input.invalidateUndo !== false) invalidatePendingEconomyUndo();
    const outcome = commitEconomyPriceHistory({
      storage,
      persistenceUnavailable: localPersistenceUnavailable,
      persistenceBlocked: priceHistoryBlocked,
      current: input.current,
      next: input.next,
      destructive: input.destructive,
      durableMessage: input.durableMessage,
      sessionMessage: input.sessionMessage,
      recovery: localStateRecovery,
      applyLiveState: (next) => {
        setPriceHistory(next);
        reconcilePriceHistorySelection(next);
        if (priceHistoryBlocked || localPersistenceUnavailable || next.snapshots.length === 0) {
          shouldSkipPersistLocalState("price-history");
        }
      },
      now: () => input.actionAt
    });
    if (outcome.status === "invalid") {
      setPriceHistoryNotice({ tone: "error", message: outcome.message });
      if (input.publishStatus !== false) setStatus(outcome.message);
      return outcome;
    }
    if (outcome.durability === "session-only") {
      shouldSkipPersistLocalState("price-history");
    }
    setPriceHistoryNotice(outcome.notice);
    if (input.publishStatus !== false) setStatus(outcome.actionStatus);
    if (outcome.record) registerPriceHistoryUndo(outcome.record, outcome.actionStatus);
    return outcome;
  };

  const applyAcceptedPriceSet = (outcome: AcceptedPriceSetOutcome) => {
    const priorHistory = priceHistory;
    const historyCapture = outcome.priceHistoryCapture(priorHistory);
    const nextHistory = historyCapture.history;
    setBasePriceSet(outcome.basePriceSet);
    setManualPriceDraft(null);
    setManualPriceClearPending(false);
    setContext((current) => (current ? { ...current, priceSet: outcome.activePriceSet } : current));
    setPriceLabel(outcome.activePriceSet.label);
    setActivePriceSetOrigin(outcome.activePriceSetOrigin);
    setStatus(outcome.appStatus);
    if (historyCapture.status === "full-skipped") {
      setMarketNotice({
        tone: outcome.marketNotice.tone,
        message: `${outcome.marketNotice.message} ${historyCapture.guidance}`
      });
      setPriceHistoryNotice({
        tone: "warning",
        message: historyCapture.guidance
      });
    } else {
      setMarketNotice(outcome.marketNotice);
      void commitLocalPriceHistory({
        current: priorHistory,
        next: nextHistory,
        destructive: false,
        durableMessage: "Saved imported PriceSet as a local comparison",
        sessionMessage:
          "Saved imported PriceSet comparison for this session. Saved history was not changed.",
        actionAt: new Date(),
        publishStatus: false,
        invalidateUndo: false
      });
    }
    setFatalError(null);
  };

  const acceptPriceSet = (priceSet: PriceSet, acceptedAt: Date, nextStatus: string) => {
    if (!context) return;
    invalidatePendingEconomyUndo();
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

  const importPriceFile = async (file: File): Promise<void> => {
    if (!context) return;
    const outcome = await priceSetTransfer.importFile(file, {
      gameData: context.gameData,
      manualPriceOverrides,
      beforeAccept: invalidatePendingEconomyUndo
    });
    if (outcome.status === "ready") applyAcceptedPriceSet(outcome);
  };

  const importSetupFile = async (file: File): Promise<void> => {
    if (!context) return;
    setSetupImportNotice(null);
    setStatus("Reviewing setup file");
    const outcome = await setupFileTransfer.prepareImport(
      file,
      context.gameData,
      captureCurrentRewriteSetup()
    );
    if (outcome.status === "review") setStatus("Setup ready for review");
    if (outcome.status === "rejected") setStatus("Setup import failed");
  };

  const dismissSetupImportReview = (reviewId: number): void => {
    if (!setupFileTransfer.dismissReview(reviewId)) return;
    setStatus("Dismissed imported setup review");
    window.queueMicrotask(() => setupImportInputRef.current?.focus());
  };

  const refreshSetupImportReview = (reviewId: number): void => {
    if (!context) return;
    if (
      !setupFileTransfer.refreshReview(reviewId, captureCurrentRewriteSetup(), context.gameData)
    ) {
      return;
    }
    setStatus("Refreshed imported setup comparison");
  };

  const applySetupImportReview = (reviewId: number): void => {
    const outcome = setupFileTransfer.consumeReview(reviewId, captureCurrentRewriteSetup());
    if (outcome.status === "stale") {
      setStatus("Setup review needs refresh");
      return;
    }
    if (outcome.status === "no-changes") {
      setStatus("Imported setup has no changes");
      return;
    }
    if (outcome.status === "ignored") return;
    const candidate = outcome.candidate;
    const previousSetup = captureCurrentRewriteSetup();
    const persisted = persistAndApplyRewriteSetup(candidate.setup);
    const contextSuffix =
      candidate.context.match === "exact-snapshot"
        ? ""
        : ` using current Revision ${candidate.context.current.gameRevision} data`;
    const appliedLabel = persisted
      ? `Imported rewrite setup${contextSuffix}.`
      : `Imported rewrite setup${contextSuffix} for this session. Changes may not persist after reload.`;
    const restoreLabel = "Restored setup from before import.";
    setSetupImportNotice({ tone: "success", message: appliedLabel });
    setFatalError(null);
    setUndoableStatus(appliedLabel, restoreLabel, () => {
      const restored = persistAndApplyRewriteSetup(previousSetup);
      const message = restored
        ? restoreLabel
        : "Restored setup from before import for this session. Changes may not persist after reload.";
      setSetupImportNotice({ tone: "success", message });
      return message;
    });
  };

  const exportCurrentSetup = (): void => {
    if (!context) return;
    const outcome = setupFileTransfer.exportSetup(
      savedSetupFromForm(
        form,
        denseCompare,
        cannonByMonster,
        customSetupsByMonster,
        defaultForm,
        setupMode
      ),
      context.gameData
    );
    setStatus(outcome.appStatus);
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
      invalidateSavedSetupUndo();
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
      invalidatePendingEconomyUndo();
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
    const transaction = createHiscoresLevelApplyTransaction(form, outcome.response);
    if (transaction.changedSkills.length === 0) {
      hiscores.recordNoChanges();
      return;
    }
    commitFormState(transaction.nextForm);
    setUndoableStatus(
      `Applied ${transaction.changedSkills.length} levels`,
      "Restored levels from before Hiscores Apply",
      () => {
        commitFormState(transaction.previousForm);
      }
    );
  };

  const saveLocalPriceComparison = async (): Promise<void> => {
    if (!context) return;
    const capturedAt = new Date();
    const next = appendAcceptedPriceSetToHistory(priceHistory, context.priceSet, capturedAt);
    if (next === priceHistory) {
      priceHistoryReviewIdRef.current += 1;
      const candidate = createFullHistoryReplacementCandidate({
        id: priceHistoryReviewIdRef.current,
        history: priceHistory,
        activePriceSet: context.priceSet,
        capturedAt
      });
      if (!candidate) return;
      setPriceHistoryReview({ kind: "replacement", candidate });
      setPriceHistoryNotice(null);
      return;
    }
    await commitLocalPriceHistory({
      current: priceHistory,
      next,
      destructive: false,
      durableMessage: "Saved local price comparison",
      sessionMessage:
        "Saved local price comparison for this session. Saved history was not changed.",
      actionAt: capturedAt
    });
    setPriceHistoryClearPending(false);
  };

  const reviewLocalPriceHistoryRemoval = (occurrenceId: string): void => {
    priceHistoryReviewIdRef.current += 1;
    const candidate = createLocalPriceHistoryRemovalCandidate({
      id: priceHistoryReviewIdRef.current,
      history: priceHistory,
      occurrenceId
    });
    if (!candidate) return;
    setPriceHistoryReview({ kind: "removal", candidate });
    setPriceHistoryNotice(null);
  };

  const confirmLocalPriceHistoryReview = async (): Promise<void> => {
    if (!priceHistoryReview || !context) return;
    const candidateId = priceHistoryReview.candidate.id;
    if (handledPriceHistoryReviewIdRef.current === candidateId) {
      setPriceHistoryNotice({
        tone: "neutral",
        message: "This price-history review was already handled."
      });
      return;
    }
    const result =
      priceHistoryReview.kind === "removal"
        ? deriveLocalPriceHistoryRemoval(priceHistoryReview.candidate, priceHistory)
        : deriveFullHistoryReplacement(
            priceHistoryReview.candidate,
            priceHistory,
            context.priceSet
          );
    if (result.status !== "ready") {
      setPriceHistoryReview(null);
      setPriceHistoryNotice({ tone: "neutral", message: result.message });
      setStatus(result.message);
      window.requestAnimationFrame(() => {
        priceHistoryManagementSummaryRef.current?.focus({ preventScroll: true });
      });
      return;
    }
    handledPriceHistoryReviewIdRef.current = candidateId;
    const isRemoval = priceHistoryReview.kind === "removal";
    const label = isRemoval
      ? priceHistoryReview.candidate.target.snapshot.label
      : priceHistoryReview.candidate.replacedOccurrence.snapshot.label;
    const outcome = await commitLocalPriceHistory({
      current: result.prior,
      next: result.next,
      destructive: true,
      durableMessage: isRemoval
        ? `Removed local comparison: ${label}`
        : `Saved local comparison and replaced the oldest point: ${label}`,
      sessionMessage: isRemoval
        ? `Removed local comparison for this session: ${label}. Saved history was not changed.`
        : "Updated local history for this session. Saved history was not changed.",
      actionAt: new Date()
    });
    if (outcome.status === "applied") setPriceHistoryReview(null);
  };

  const requestClearPriceHistory = () => {
    setPriceHistoryClearPending(true);
    setPriceHistoryNotice({
      tone: "neutral",
      message: "Confirm clearing local comparison history"
    });
  };

  const confirmClearPriceHistory = async (): Promise<void> => {
    if (priceHistory.snapshots.length === 0) return;
    const outcome = await commitLocalPriceHistory({
      current: priceHistory,
      next: DEFAULT_PRICE_HISTORY_STATE,
      destructive: true,
      durableMessage: "Cleared local comparison history",
      sessionMessage:
        "Cleared local comparison history for this session. Saved history was not changed.",
      actionAt: new Date()
    });
    if (outcome.status === "applied") setPriceHistoryClearPending(false);
  };

  const updateEconomySort = (key: PriceHistoryMoverSortKey) => {
    setEconomySort((current) =>
      current.key === key
        ? { ...current, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "item" ? "asc" : "desc" }
    );
  };

  if (fatalError) {
    return <ApplicationFailureScreen message={RUNTIME_BOOTSTRAP_ERROR_MESSAGE} />;
  }

  if (!context || !viewModel || !derivedViewModel) {
    return (
      <main className="app-shell" data-app-startup-state="starting">
        <section className="loading" role="status" aria-live="polite">
          {status}
        </section>
      </main>
    );
  }

  const setCombatStyle = (combatStyle: CombatStyle) =>
    setFormSafe((current) => switchCombatStyleLoadout(current, combatStyle));
  const selectCombatStyle = (combatStyle: CombatStyle) => {
    activateWorkbenchTab("loadout", "routed-action");
    setCombatStyle(combatStyle);
  };
  const reviewLocalState = () => {
    activateWorkbenchTab("settings", "routed-action");
    setLocalStateReviewRequest((request) => request + 1);
  };
  const selectedCrossTabConflictIds = (): CrossTabAreaId[] => {
    const current = new Set(crossTabConflicts.conflicts.map((conflict) => conflict.id));
    return crossTabSelectedIds.filter((id) => current.has(id));
  };
  const refreshCrossTabReview = () => {
    const ids = selectedCrossTabConflictIds();
    const result = crossTabConflicts.refreshReview(ids);
    if (result.status === "ready") {
      setCrossTabNotice({ tone: "neutral", message: "Conflict review is up to date." });
    } else if (result.status === "stale") {
      setCrossTabNotice({
        tone: "warning",
        message: "Saved data changed again. The review was refreshed; check the selected areas."
      });
    } else if (result.status === "invalid") {
      setCrossTabNotice({
        tone: "warning",
        message: "Some saved data is invalid or unsupported. Handle it in Local state recovery."
      });
    } else {
      setCrossTabNotice({
        tone: "error",
        message: "Saved data could not be read. No conflict was resolved."
      });
    }
  };
  const useSavedCrossTabData = () => {
    const ids = selectedCrossTabConflictIds();
    const result = crossTabConflicts.useSavedData(ids);
    if (result.status === "ready") {
      setStatus(
        `Using saved data for ${ids.length} ${ids.length === 1 ? "area" : "areas"}. Reloading…`
      );
      reloadSimulator(window);
      return;
    }
    if (result.status === "stale") {
      setCrossTabNotice({
        tone: "warning",
        message: "Saved data changed again. Review the refreshed values before reloading."
      });
      return;
    }
    setCrossTabNotice({
      tone: result.status === "unavailable" ? "error" : "warning",
      message:
        result.status === "unavailable"
          ? "Saved data could not be read. No values were changed."
          : "Invalid or unsupported saved data must be handled in Local state recovery."
    });
  };
  const keepCurrentCrossTabData = () => {
    const ids = selectedCrossTabConflictIds();
    let operations: ReturnType<typeof createCrossTabKeepOperation>[];
    try {
      const liveState = captureCurrentWorkspaceLiveState();
      const now = new Date();
      operations = ids.map((id) => createCrossTabKeepOperation(id, liveState, now));
    } catch {
      setCrossTabNotice({
        tone: "error",
        message: "Current values could not be validated. No saved data was changed."
      });
      return;
    }
    const result = crossTabConflicts.keepCurrent(operations);
    if (result.status === "kept") {
      localStateRecovery.completeExternalApply(ids);
      const keptMessage = `Kept this tab's data for ${ids.length} ${ids.length === 1 ? "area" : "areas"}`;
      setCrossTabNotice({ tone: "success", message: `${keptMessage}. Undo is available.` });
      setUndoableStatus(keptMessage, "Restored the prior saved data", () => {
        const undo = crossTabConflicts.undoKeep(result.undo);
        if (undo.status === "undone") {
          reloadSimulator(window);
          return "Restored the prior saved data. Reloading…";
        }
        if (undo.status === "stale") {
          return "Saved data changed after Keep. Undo left the newer values unchanged.";
        }
        return "Undo could not restore saved data. Review Local state recovery.";
      });
      return;
    }
    if (result.status === "stale") {
      setCrossTabNotice({
        tone: "warning",
        message: "Saved data changed again. Review the refreshed values before keeping this tab."
      });
      return;
    }
    if (result.status === "invalid") {
      setCrossTabNotice({
        tone: "warning",
        message: "Invalid or unsupported saved data must be handled in Local state recovery."
      });
      return;
    }
    setCrossTabNotice({
      tone: "error",
      message:
        result.status === "unavailable"
          ? "Saved data is unavailable. No values were changed."
          : result.rollbackFailed
            ? "The update failed and rollback could not be verified. Review Local state recovery."
            : "The update failed. Saved data was rolled back and current values remain active."
    });
  };
  const navigateFromSettings = (intent: SettingsNavigationIntent) => {
    if (intent.kind !== "review-price-data-in-economy") return;
    activateWorkbenchTab("economy", "routed-action");
    setEconomyReviewRequest((request) => request + 1);
  };
  const reviewPriceData = () => {
    setPriceNotesOpen(true);
    focusPaneTarget("economy", () => priceNotesSummaryRef.current);
  };

  const exportWorkspace = () => {
    const liveState = captureCurrentWorkspaceLiveState();
    const outcome = workspaceFileTransfer.exportWorkspace({
      gameData: context.gameData,
      liveState,
      storageAccess: browserStorageAccess
    });
    if (outcome.status === "requested") {
      sessionOnlyExitProtection.acknowledgeBackup(outcome.includedAreaIds, liveState);
    } else {
      sessionOnlyExitProtection.recordBackupFailure();
    }
  };

  const openWorkspaceBackupFromHeader = () => {
    activateWorkbenchTab("settings", "routed-action");
    setWorkspaceBackupFocusRequest((request) => request + 1);
  };

  const dismissWorkspaceReview = (reviewId: number): void => {
    if (!workspaceFileTransfer.dismissReview(reviewId)) return;
    window.requestAnimationFrame(() => workspaceImportInputRef.current?.focus());
  };

  const registerWorkspaceUndo = (
    outcome: Extract<WorkspaceRestoreApplyOutcome, { status: "applied" }>
  ) => {
    const includesEconomyData = outcome.selectedIds.some((id) => ECONOMY_UNDO_SCOPE_IDS.has(id));
    setUndoableStatus(
      outcome.message,
      "Restored pre-Workspace state",
      () => {
        const execution = workspaceExecutionRef.current;
        if (!execution) return "Workspace Undo is no longer available.";
        const undo = workspaceFileTransfer.undoRestore(execution);
        if (undo.status === "session-only-available") {
          setPendingUndo({
            id: localUndoId(),
            label: undo.message,
            restoreLabel: "Restored prior Workspace values for this session",
            createdAt: Date.now(),
            scope: includesEconomyData ? "economy-data" : undefined,
            restore: () => {
              const currentExecution = workspaceExecutionRef.current;
              if (!currentExecution) return "Session-only Workspace Undo is no longer available.";
              return workspaceFileTransfer.undoRestoreForSession(currentExecution).message;
            }
          });
        }
        return undo.message;
      },
      includesEconomyData ? "economy-data" : undefined
    );
  };

  const applyWorkspaceRestore = async (
    reviewId: number,
    mode: "durable" | "session-only"
  ): Promise<void> => {
    const execution = workspaceExecutionRef.current;
    if (!execution) {
      setStatus("Workspace restore context is no longer available. Review the file again.");
      return;
    }
    const outcome = await (mode === "durable"
      ? workspaceFileTransfer.applyRestore(reviewId, execution)
      : workspaceFileTransfer.applyRestoreForSession(reviewId, execution));
    if (outcome.status === "stale") {
      setStatus("Workspace restore review is stale. Review the file again.");
      return;
    }
    setStatus(outcome.message);
    if (outcome.status === "applied") registerWorkspaceUndo(outcome);
  };

  const requestPriceItemReview = (requestedAction: PriceNoticeAction) => {
    const editable = manualPricePresentation.itemOptions.some(
      (option) => option.id === requestedAction.itemId
    );
    const exactNotice = viewModel.priceNotices.all.find(
      (notice) => notice.noticeId === requestedAction.noticeId
    );
    const action: PriceNoticeAction =
      requestedAction.kind === "correct-price" && !editable
        ? {
            ...requestedAction,
            kind: "inspect-item",
            label: "Inspect item"
          }
        : requestedAction;

    if (action.kind === "correct-price") {
      setManualPriceItemId(action.itemId);
      setManualPriceDraft(
        activePriceSet?.itemPrices[action.itemId] ?? basePriceSet?.itemPrices[action.itemId] ?? 0
      );
      setManualPriceClearPending(false);
    } else {
      setPriceNotesOpen(true);
      if (!exactNotice) {
        setMarketNotice({
          tone: "neutral",
          message: "That price note changed before review. Showing the current price data notes."
        });
      }
    }
    activateWorkbenchTab("economy", "routed-action");
    const id = nextPriceItemReviewRequestRef.current + 1;
    nextPriceItemReviewRequestRef.current = id;
    setPriceItemReviewRequest({ id, action });
  };

  const reviewPlannerNotice = (action: PlannerNoticeAction): void => {
    if (action.kind === "review-loadout") {
      setPriceItemReviewRequest(null);
      focusPaneTarget("loadout", () => loadoutWeaponTriggerRef.current);
      return;
    }
    if (action.kind === "review-trip") {
      setPriceItemReviewRequest(null);
      focusPaneTarget("trip", () => tripFoodPerKillOverrideRef.current);
      return;
    }
    if (action.kind === "correct-price") {
      const editable = manualPricePresentation.itemOptions.some(
        (option) => option.id === action.itemId
      );
      if (editable) {
        requestPriceItemReview({
          kind: "correct-price",
          itemId: action.itemId,
          noticeId: `planner:${action.itemId}`,
          label: "Correct price"
        });
        return;
      }
      setMarketNotice({
        tone: "neutral",
        message: "That Planner price item is no longer editable. Showing the current price data."
      });
    }
    if (action.kind === "review-price-data" || action.kind === "correct-price") {
      setPriceItemReviewRequest(null);
      const itemId = action.itemId;
      const itemAvailable = Boolean(
        itemId && economyHistory.trendItemOptions.some((option) => option.id === itemId)
      );
      if (itemAvailable && itemId) {
        setEconomyTrendItemId(itemId);
      } else if (action.kind === "review-price-data") {
        setMarketNotice({
          tone: "neutral",
          message: "That Planner price item is no longer available. Showing the current price data."
        });
      }
      focusPaneTarget("economy", () =>
        itemAvailable ? selectedPriceItemRef.current : marketHeadingRef.current
      );
    }
  };

  const reviewActiveAssumption = (tab: ActiveAssumptionReviewTarget) => {
    if (tab === "melee" || tab === "ranged" || tab === "magic") {
      setCombatStyle(tab);
      activateWorkbenchTab("loadout", "routed-action");
      return;
    }
    activateWorkbenchTab(tab, "routed-action");
  };

  const updateLevel = (skill: keyof CombatSetupFormState["levels"], value: number) =>
    setFormSafe((current) =>
      updateForm(current, {
        levels: { ...current.levels, [skill]: value }
      })
    );

  const focusManualPlayerLevels = () => {
    const focusTarget = playerLevelGroupRef.current;
    if (!focusTarget) return;
    focusTarget.scrollIntoView({ block: "center", inline: "nearest" });
    focusTarget.focus({ preventScroll: true });
  };

  const updatePlannerMetric = (metric: PlannerMetric) =>
    setPlannerState((current) => normalizePlannerUiState({ ...current, metric }));

  const updatePlannerTargetLevel = (skill: PlannerSkill, value: number) => {
    setPlannerAdjustmentNotice(null);
    setPlannerState((current) =>
      normalizePlannerUiState({
        ...current,
        targetLevels: { ...current.targetLevels, [skill]: value }
      })
    );
  };

  const updatePlannerCurrentXp = (skill: PlannerSkill, value: number | null) => {
    setPlannerAdjustmentNotice(null);
    setPlannerState((current) =>
      normalizePlannerUiState({
        ...current,
        currentXp: { ...current.currentXp, [skill]: value ?? 0 }
      })
    );
  };

  const updatePlannerSkillLock = (skill: PlannerSkill, locked: boolean) => {
    const next = normalizePlannerUiState({
      ...plannerState,
      skillLocks: { ...plannerState.skillLocks, [skill]: locked }
    });
    const reconciliation = locked
      ? { state: next, adjustments: [] }
      : reconcilePlannerProgressWithLevels(next, form.levels);
    setPlannerState(reconciliation.state);
    setPlannerAdjustmentNotice(plannerProgressAdjustmentNotice(reconciliation.adjustments));
  };

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

  const recomputePlannerPlan = () => {
    setPlannerAdjustmentNotice(null);
    recomputePlanner();
  };

  const setManualOverride = (
    key: keyof CombatSetupFormState["manualOverrides"],
    value: number | null
  ) =>
    setFormSafe((current) =>
      updateForm(current, {
        manualOverrides: { ...current.manualOverrides, [key]: value }
      })
    );

  const resetManualOverrides = () => {
    const previousManualOverrides = form.manualOverrides;
    const changed = Object.keys(DEFAULT_MANUAL_OVERRIDES).some(
      (key) =>
        previousManualOverrides[key as keyof typeof DEFAULT_MANUAL_OVERRIDES] !==
        DEFAULT_MANUAL_OVERRIDES[key as keyof typeof DEFAULT_MANUAL_OVERRIDES]
    );
    if (!changed) {
      setStatus("Manual overrides already use defaults");
      return;
    }
    setFormSafe((current) => updateForm(current, { manualOverrides: DEFAULT_MANUAL_OVERRIDES }));
    setUndoableStatus("Manual overrides reset", "Restored manual combat overrides", () => {
      setFormSafe((current) => updateForm(current, { manualOverrides: previousManualOverrides }));
    });
  };

  const selectTarget = (monsterId: EntityId) => {
    const target = formForMonsterSetup(defaultForm, customSetupsByMonster, monsterId);
    setSetupMode(target.setupMode);
    setForm(target.form);
  };

  const reviewMonsterSpecificCategory = (
    monsterId: string,
    kind: MonsterSpecificChangeKind
  ): void => {
    const row = monsterSpecificChanges.rows.find((candidate) => candidate.monsterId === monsterId);
    if (!row?.available || !row.categories.some((category) => category.kind === kind)) return;
    selectTarget(monsterId);
    if (kind === "compare-hidden") {
      setDenseCompare((current) => ({
        ...resetDenseCompareFilters(current),
        showIrrelevant: true
      }));
    }
    const destination: WorkbenchTabId =
      kind === "custom-setup"
        ? "loadout"
        : kind === "cannon"
          ? "cannon"
          : kind === "loot-actions" || kind === "loot-settings"
            ? "loot"
            : "compare";
    monsterReviewIdRef.current += 1;
    setMonsterSpecificReviewRequest({ id: monsterReviewIdRef.current, monsterId, kind });
    activateWorkbenchTab(destination, "routed-action");
  };

  const reviewMonsterSpecificRemoval = (monsterId: string): void => {
    const row = monsterSpecificChanges.rows.find((candidate) => candidate.monsterId === monsterId);
    if (!row) return;
    monsterRemovalIdRef.current += 1;
    const candidate = createMonsterSpecificRemovalCandidate({
      id: monsterRemovalIdRef.current,
      monsterId,
      monsterName: row.monsterName,
      live: currentMonsterSpecificLiveState
    });
    if (!candidate) {
      setMonsterChangesNotice({
        tone: "neutral",
        message: `No changes remain for ${row.monsterName}`
      });
      return;
    }
    setMonsterRemovalCandidate(candidate);
    setMonsterChangesSessionOnlyAvailable(false);
    setMonsterChangesNotice(null);
  };

  const registerMonsterSpecificUndo = (
    outcome: Extract<MonsterSpecificApplyOutcome, { status: "applied" }>,
    candidate: MonsterSpecificRemovalCandidate
  ): void => {
    setUndoableStatus(outcome.message, `Restored changes for ${candidate.monsterName}`, () => {
      const execution = monsterChangesExecutionRef.current;
      const transaction = monsterChangesTransactionRef.current;
      if (!execution || !transaction) return "Monster changes Undo is no longer available.";
      const undo = transaction.undo(execution);
      if (undo.status === "session-only-available") {
        setPendingUndo({
          id: localUndoId(),
          label: undo.message,
          restoreLabel: `Restored changes for ${candidate.monsterName} for this session`,
          createdAt: Date.now(),
          restore: () => {
            const currentExecution = monsterChangesExecutionRef.current;
            const currentTransaction = monsterChangesTransactionRef.current;
            if (!currentExecution || !currentTransaction) {
              return "Session-only monster changes Undo is no longer available.";
            }
            return currentTransaction.undoForSession(currentExecution).message;
          }
        });
      }
      setMonsterChangesNotice({
        tone: undo.status === "undone" ? "success" : undo.status === "failed" ? "error" : "warning",
        message: undo.message
      });
      return undo.message;
    });
  };

  const confirmMonsterSpecificRemoval = (mode: "durable" | "session-only"): void => {
    const candidate = monsterRemovalCandidate;
    const execution = monsterChangesExecutionRef.current;
    const transaction = monsterChangesTransactionRef.current;
    if (!candidate || !execution || !transaction) return;
    if (candidate.id === handledMonsterRemovalIdRef.current) {
      setMonsterChangesNotice({ tone: "neutral", message: "This removal was already handled." });
      return;
    }
    if (mode === "session-only" && !monsterChangesSessionOnlyAvailable) return;
    const outcome =
      mode === "durable"
        ? transaction.applyDurable(candidate, execution)
        : transaction.applyForSession(candidate, execution);
    if (outcome.status === "session-only-available") {
      setMonsterChangesSessionOnlyAvailable(true);
      setMonsterChangesNotice({ tone: "warning", message: outcome.message });
      setStatus(outcome.message);
      return;
    }
    handledMonsterRemovalIdRef.current = candidate.id;
    if (outcome.status === "applied") {
      setMonsterRemovalCandidate(null);
      setMonsterChangesSessionOnlyAvailable(false);
      setMonsterChangesNotice({ tone: "success", message: outcome.message });
      registerMonsterSpecificUndo(outcome, candidate);
      return;
    }
    setMonsterChangesNotice({
      tone: outcome.status === "failed" ? "error" : "neutral",
      message: outcome.message
    });
    setStatus(outcome.message);
    if (outcome.status === "stale" || outcome.status === "no-op") {
      setMonsterRemovalCandidate(null);
      setMonsterChangesSessionOnlyAvailable(false);
    }
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
  const snapshotCurrentSetup = () => {
    invalidateSavedSetupUndo();
    const baseName = defaultDuelSnapshotName(viewModel, duelSnapshots.snapshots.length);
    const uniqueName = uniqueDuelSnapshotName(baseName, duelSnapshots);
    const snapshot = createDuelSnapshot(createDuelSnapshotId(), uniqueName, form);
    setDuelSnapshots((current) => appendDuelSnapshot(current, snapshot));
    setDuelImportNotice(null);
    setStatus(`Saved setup: ${snapshot.name}`);
  };
  const exportDuelSnapshots = () => {
    const outcome = exportDuelSnapshotsFile({
      snapshots: duelSnapshots,
      gameData: context.gameData,
      now: new Date(),
      downloadJsonFile
    });
    setDuelImportNotice(outcome.notice);
    setStatus(outcome.appStatus);
  };
  const importDuelSnapshots = async (file: File): Promise<void> => {
    const attemptId = ++duelImportAttemptRef.current;
    try {
      setDuelImportNotice(null);
      setDuelImportReview(null);
      const imported = parseDuelSnapshotsExportText(
        await readBrowserFileText(file, DUEL_SNAPSHOTS_IMPORT_MAX_BYTES),
        DUEL_SNAPSHOTS_IMPORT_MAX_BYTES,
        context.gameData
      );
      if (attemptId !== duelImportAttemptRef.current) return;
      const plan = createSavedSetupMergePlan({
        reviewId: attemptId,
        source: imported.data,
        current: duelSnapshots
      });
      setDuelImportReview({
        id: attemptId,
        plan,
        context: compareSetupTransferContext(imported.context, context.gameData)
      });
      setDuelSessionOnlyRequest(null);
      setStatus("Saved setups ready for review");
    } catch (caught) {
      if (attemptId !== duelImportAttemptRef.current) return;
      setDuelImportNotice(describeDuelSnapshotsImportError(caught));
      setStatus("Saved setup import failed");
    }
  };
  const dismissDuelSnapshotsImport = (reviewId: number): void => {
    if (duelImportReview?.id !== reviewId) return;
    setDuelImportReview(null);
    setDuelSessionOnlyRequest((current) =>
      current?.kind === "merge" && current.reviewId === reviewId ? null : current
    );
    setStatus("Dismissed saved setup import review");
  };
  const setDuelSnapshotsImportDecision = (
    reviewId: number,
    snapshotId: string,
    decision: "keep" | "replace" | "add" | "exclude"
  ): void => {
    setDuelImportReview((review) => {
      if (!review || review.id !== reviewId) return review;
      return {
        ...review,
        plan: setSavedSetupMergeDecision({
          plan: review.plan,
          current: duelSnapshots,
          snapshotId,
          decision
        })
      };
    });
    setDuelSessionOnlyRequest((current) => (current?.kind === "merge" ? null : current));
  };
  const setDuelSnapshotsImportName = (reviewId: number, snapshotId: string, name: string): void => {
    setDuelImportReview((review) => {
      if (!review || review.id !== reviewId) return review;
      return {
        ...review,
        plan: setSavedSetupMergeRecipientName({
          plan: review.plan,
          current: duelSnapshots,
          snapshotId,
          name
        })
      };
    });
    setDuelSessionOnlyRequest((current) => (current?.kind === "merge" ? null : current));
  };
  const refreshDuelSnapshotsImport = (reviewId: number): void => {
    if (!duelImportReview || duelImportReview.id !== reviewId) return;
    const nextId = ++duelImportAttemptRef.current;
    setDuelImportReview({
      ...duelImportReview,
      id: nextId,
      plan: createSavedSetupMergePlan({
        reviewId: nextId,
        source: duelImportReview.plan.source,
        current: duelSnapshots
      })
    });
    setDuelSessionOnlyRequest((current) => (current?.kind === "merge" ? null : current));
    setStatus("Refreshed saved setup merge review");
  };
  const mergeDuelSnapshotsImport = (reviewId: number): void => {
    if (duelImportReview?.id !== reviewId) return;
    const candidate = buildSavedSetupMergeCandidate(duelImportReview.plan, duelSnapshots);
    if (candidate.status !== "ready") {
      const message =
        candidate.status === "stale"
          ? "Saved setups changed. Refresh the merge review before applying it."
          : candidate.status === "no-op"
            ? "Select at least one setup to add or replace."
            : "Resolve the highlighted setup names before merging.";
      setDuelImportNotice({ tone: candidate.status === "stale" ? "warning" : "neutral", message });
      setStatus(message);
      return;
    }
    const contextSuffix =
      duelImportReview.context.match === "exact-snapshot"
        ? ""
        : ` using current Revision ${duelImportReview.context.current.gameRevision} data`;
    const message = `Merged saved setups${contextSuffix}: ${candidate.counts.selectedAddCount} added, ${candidate.counts.selectedReplaceCount} replaced, ${candidate.counts.notSelectedCount} not selected.`;
    applySavedSetupChange(
      {
        current: duelSnapshots,
        next: candidate.state,
        actionMessage: message,
        sessionActionMessage: `${message} Applied for this session only; changes may return after reload.`,
        undoMessage: "Restored saved setups from before merge"
      },
      "merge",
      reviewId,
      "durable"
    );
  };
  const applyDuelSessionOnlyChange = (): void => {
    const pending = duelSessionOnlyRequest;
    if (!pending) return;
    if (pending.kind === "merge" && pending.reviewId !== duelImportReview?.id) {
      setDuelSessionOnlyRequest(null);
      setStatus("Saved setup merge review changed. Review it again.");
      return;
    }
    applySavedSetupChange(pending.request, pending.kind, pending.reviewId, "session-only");
  };
  const commitDuelSnapshotName = (
    snapshotId: string,
    name: string
  ):
    | "renamed"
    | "unchanged"
    | "missing"
    | "invalid"
    | "duplicate"
    | "session-only-available"
    | "failed" => {
    const renamed = renameDuelSnapshotSafely(duelSnapshots, snapshotId, name);
    if (renamed.status !== "renamed") {
      const messages = {
        unchanged: "Saved setup name is unchanged.",
        missing: "That saved setup is no longer available.",
        invalid: "Enter a saved setup name between 1 and 80 characters.",
        duplicate: "Choose a unique saved setup name."
      } as const;
      setDuelImportNotice({
        tone: renamed.status === "unchanged" ? "neutral" : "warning",
        message: messages[renamed.status]
      });
      setStatus(messages[renamed.status]);
      return renamed.status;
    }
    const outcome = applySavedSetupChange(
      {
        current: duelSnapshots,
        next: renamed.state,
        actionMessage: `Renamed saved setup from ${renamed.oldName} to ${renamed.newName}`,
        sessionActionMessage: `Renamed saved setup to ${renamed.newName} for this session. The prior name may return after reload.`,
        undoMessage: `Restored saved setup name ${renamed.oldName}`
      },
      "rename",
      null,
      "durable"
    );
    return outcome.status === "applied"
      ? "renamed"
      : outcome.status === "session-only-available"
        ? "session-only-available"
        : "failed";
  };
  const applyDuelSnapshotLoad = (snapshotId: string): boolean => {
    const snapshot = duelSnapshots.snapshots.find((candidate) => candidate.id === snapshotId);
    if (!snapshot) return false;
    const previousSetup = captureCurrentRewriteSetup();
    const nextForm = normalizeFormState({ ...snapshot.form, monsterId: form.monsterId });
    commitFormState(nextForm);
    const loadedLabel = `Loaded saved setup: ${snapshot.name}`;
    const restoreLabel = `Restored setup from before loading ${snapshot.name}`;
    setUndoableStatus(loadedLabel, restoreLabel, () => {
      const restored = persistAndApplyRewriteSetup(previousSetup);
      return restored
        ? restoreLabel
        : `${restoreLabel} for this session. Changes may not persist after reload.`;
    });
    return true;
  };
  const loadDuelSnapshot = (snapshotId: string) => {
    if (!context) return;
    const snapshot = duelSnapshots.snapshots.find((candidate) => candidate.id === snapshotId);
    if (!snapshot) return;
    const incoming = normalizeFormState({ ...snapshot.form, monsterId: form.monsterId });
    duelLoadReviewIdRef.current += 1;
    setDuelLoadReview({
      id: duelLoadReviewIdRef.current,
      snapshotId,
      snapshotName: snapshot.name,
      changeReview: createSavedRowSetupChangeReview({
        current: form,
        incoming,
        gameData: context.gameData
      })
    });
  };
  const refreshDuelSnapshotLoad = (snapshotId: string) => {
    if (!context) return;
    const snapshot = duelSnapshots.snapshots.find((candidate) => candidate.id === snapshotId);
    if (!snapshot) {
      setDuelLoadReview(null);
      setStatus("That saved setup is no longer available.");
      return;
    }
    const incoming = normalizeFormState({ ...snapshot.form, monsterId: form.monsterId });
    duelLoadReviewIdRef.current += 1;
    setDuelLoadReview({
      id: duelLoadReviewIdRef.current,
      snapshotId,
      snapshotName: snapshot.name,
      changeReview: createSavedRowSetupChangeReview({
        current: form,
        incoming,
        gameData: context.gameData
      })
    });
    setStatus(`Refreshed Load comparison for ${snapshot.name}.`);
  };
  const confirmDuelSnapshotLoad = (snapshotId: string) => {
    const candidate = duelLoadReview;
    if (!candidate || candidate.snapshotId !== snapshotId) return;
    const snapshot = duelSnapshots.snapshots.find((item) => item.id === snapshotId);
    if (!snapshot) {
      setDuelLoadReview(null);
      setStatus("That saved setup is no longer available.");
      return;
    }
    const incoming = normalizeFormState({ ...snapshot.form, monsterId: form.monsterId });
    if (!savedRowReviewMatches(candidate.changeReview, form, incoming)) {
      setStatus("Saved setup Load comparison is stale. Refresh it before loading.");
      return;
    }
    if (candidate.changeReview.changeCount === 0) {
      setStatus("Saved setup has no applicable changes.");
      return;
    }
    if (applyDuelSnapshotLoad(snapshotId)) setDuelLoadReview(null);
  };
  const deleteDuelSnapshot = (snapshotId: string) => {
    invalidateSavedSetupUndo();
    const snapshot = duelSnapshots.snapshots.find((candidate) => candidate.id === snapshotId);
    const previousDuelSnapshots = duelSnapshots;
    setDuelSnapshots((current) => removeDuelSnapshot(current, snapshotId));
    setDuelLoadReview((current) => (current?.snapshotId === snapshotId ? null : current));
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
    window.queueMicrotask(() => setupModeHeadingRef.current?.focus());
  };
  const editDefaultSetup = () => {
    const target = normalizeFormState({ ...defaultForm, monsterId: form.monsterId });
    setSetupMode("default");
    setForm(target);
    setStatus(`Editing default setup for ${currentMonster?.name ?? form.monsterId}`);
    window.queueMicrotask(() => setupModeHeadingRef.current?.focus());
  };
  const editCustomSetup = () => {
    if (!currentCustomSetup) return;
    const target = normalizeFormState(currentCustomSetup);
    setSetupMode("custom");
    setForm(target);
    setStatus(`Editing custom setup for ${currentMonster?.name ?? form.monsterId}`);
    window.queueMicrotask(() => setupModeHeadingRef.current?.focus());
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
  const openActiveSetupResetReview = () => {
    if (!context) return;
    const next = openActiveSetupReset(
      activeSetupReset,
      captureCurrentRewriteSetup(),
      context.gameData
    );
    setActiveSetupReset(next);
    setStatus(next.notice ?? "Active setup reset ready for review.");
  };
  const cancelActiveSetupResetReview = (candidateId: number) => {
    const next = cancelActiveSetupReset(activeSetupReset, candidateId);
    if (next === activeSetupReset) return;
    setActiveSetupReset(next);
    setStatus("Cancelled active setup reset.");
    window.queueMicrotask(() => resetSetupButtonRef.current?.focus());
  };
  const confirmActiveSetupReset = (candidateId: number) => {
    const consumed = consumeActiveSetupReset(
      activeSetupReset,
      candidateId,
      captureCurrentRewriteSetup()
    );
    setActiveSetupReset(consumed.state);
    if (consumed.outcome.status === "ignored") return;
    if (consumed.outcome.status === "stale") {
      setStatus(ACTIVE_SETUP_RESET_STALE_NOTICE);
      window.queueMicrotask(() => resetSetupButtonRef.current?.focus());
      return;
    }

    const previousSetup = consumed.outcome.candidate.source;
    const persisted = persistAndApplyRewriteSetup(consumed.outcome.candidate.setup);
    const appliedLabel = persisted
      ? "Reset active setup to defaults."
      : "Reset active setup for this session. Changes may not persist after reload.";
    const restoreLabel = "Restored setup from before reset.";
    setUndoableStatus(appliedLabel, restoreLabel, () => {
      const restored = persistAndApplyRewriteSetup(previousSetup);
      return restored
        ? restoreLabel
        : "Restored setup from before reset for this session. Changes may not persist after reload.";
    });
  };
  const currentCannon = cannonByMonster[form.monsterId] ?? DEFAULT_CANNON_SETTINGS;
  const closeShareSetupDialog = () => {
    setShareDialog(null);
    window.queueMicrotask(() => shareSetupButtonRef.current?.focus());
  };
  const openShareSetupDialog = () => {
    try {
      const envelope = buildShareableSetupEnvelope({
        gameData: context.gameData,
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
        revisionLabel: gameRevisionViewModel.revisionLabel,
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
    if (
      receivedShareableSetupInspection?.status !== "ready" ||
      !shareChangeReview ||
      !sharedSetupChangeStates
    ) {
      return;
    }
    if (!sharedSetupReviewMatchesCurrent(shareChangeReview, sharedSetupChangeStates.current)) {
      setStatus("Shared setup comparison is stale. Refresh it before loading.");
      return;
    }
    if (shareChangeReview.changeCount === 0) {
      setStatus("Shared setup has no applicable changes.");
      return;
    }
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
    activateWorkbenchTab("loadout", "routed-action");
    setShareReviewDismissed(true);
    setReceivedShareableSetupPayload(null);
    localStateRecovery.unblockReplaced(["rewrite-setup", "loot-prefs", "loot-settings"]);
    const monsterName =
      context.gameData.monsters[applied.state.form.monsterId]?.name ?? applied.state.form.monsterId;
    const contextSuffix =
      receivedShareableSetupInspection.review.context.match === "exact-snapshot"
        ? ""
        : ` using current Revision ${receivedShareableSetupInspection.review.context.current.gameRevision} data`;
    setUndoableStatus(
      `Loaded shared setup for ${monsterName}${contextSuffix}`,
      "Restored pre-share setup",
      () => {
        setForm(applied.undo.form);
        setDefaultForm(previousDefaultForm);
        setSetupMode(previousSetupMode);
        setCannonByMonster(applied.undo.cannonByMonster);
        setLootPrefsByMonster(applied.undo.lootPrefsByMonster);
        setLootSettingsByMonster(applied.undo.lootSettingsByMonster);
        activateWorkbenchTab(previousActiveTab, "internal-restore");
      }
    );
  };
  const refreshReceivedShareableSetupReview = () => {
    if (!context || !sharedSetupChangeStates) return;
    setShareComparisonBaseline({
      form,
      cannonByMonster,
      lootPrefsByMonster,
      lootSettingsByMonster
    });
    setStatus("Refreshed shared setup comparison.");
  };
  const dismissReceivedShareableSetupReview = () => {
    setShareReviewDismissed(true);
    setReceivedShareableSetupPayload(null);
    window.queueMicrotask(() => shareSetupButtonRef.current?.focus());
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
  const applyTripRecommendation = (patch: Partial<CombatSetupFormState["trip"]>) => {
    const previousTrip = form.trip;
    const changedKeys = Object.keys(patch).filter((key) => {
      const field = key as keyof CombatSetupFormState["trip"];
      return previousTrip[field] !== patch[field];
    });
    if (!changedKeys.length) {
      setStatus("Trip recommendation already matches current assumptions");
      return;
    }
    updateTrip(patch);
    const label = `Applied Trip recommendation: ${formatNumber(changedKeys.length)} fields`;
    setUndoableStatus(label, "Restored Trip recommendation", () => {
      setFormSafe((current) => updateForm(current, { trip: previousTrip }));
    });
  };
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
    const monsterId = form.monsterId;
    const previousCannonByMonster = cannonByMonster;
    if (!previousCannonByMonster[monsterId]) {
      setStatus("Current monster cannon already uses defaults");
      return;
    }
    const monsterName = currentMonster?.name ?? monsterId;
    setCannonByMonster((current) => {
      if (!current[monsterId]) return current;
      const next = { ...current };
      delete next[monsterId];
      return next;
    });
    setUndoableStatus(
      "Current monster cannon reset",
      `Restored cannon settings for ${monsterName}`,
      () => {
        setCannonByMonster(previousCannonByMonster);
      }
    );
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
    const monsterId = form.monsterId;
    const monsterName = currentMonster?.name ?? form.monsterId;
    const previousLootPrefsByMonster = lootPrefsByMonster;
    if (!previousLootPrefsByMonster[monsterId]) {
      setStatus(`Loot overrides already use defaults for ${monsterName}`);
      return;
    }
    setLootPrefsByMonster((current) => resetLootPrefsForMonster(current, monsterId));
    const label = `Reset loot overrides for ${monsterName}`;
    const restoreLabel = `Restored loot overrides for ${monsterName}`;
    setLootNotice(label);
    setUndoableStatus(label, restoreLabel, () => {
      setLootPrefsByMonster(previousLootPrefsByMonster);
      setLootNotice(restoreLabel);
    });
  };
  const resetCurrentLootSettings = () => {
    const monsterId = form.monsterId;
    const monsterName = currentMonster?.name ?? form.monsterId;
    const previousLootSettingsByMonster = lootSettingsByMonster;
    if (!previousLootSettingsByMonster[monsterId]) {
      setStatus(`Loot settings already use defaults for ${monsterName}`);
      return;
    }
    setLootSettingsByMonster((current) => resetLootSettingsForMonster(current, monsterId));
    const label = `Reset loot settings for ${monsterName}`;
    const restoreLabel = `Restored loot settings for ${monsterName}`;
    setLootNotice(label);
    setUndoableStatus(label, restoreLabel, () => {
      setLootSettingsByMonster(previousLootSettingsByMonster);
      setLootNotice(restoreLabel);
    });
  };
  const resetTripSafespotOverride = (): boolean => {
    const previousSafespot = form.trip.safespot;
    if (previousSafespot == null) return false;
    setFormSafe((current) =>
      updateForm(current, {
        trip: {
          ...current.trip,
          safespot: null
        }
      })
    );
    setUndoableStatus("Safespot override reset to auto", "Restored safespot override", () => {
      setFormSafe((current) =>
        updateForm(current, { trip: { ...current.trip, safespot: previousSafespot } })
      );
    });
    return true;
  };
  const resetTripScarceSpot = (): boolean => {
    const previousScarceSpot = form.trip.scarceSpot;
    if (!previousScarceSpot) return false;
    setFormSafe((current) =>
      updateForm(current, {
        trip: {
          ...current.trip,
          scarceSpot: false
        }
      })
    );
    setUndoableStatus(
      "Scarce spot disabled; target and respawn values kept",
      "Restored scarce spot setting",
      () => {
        setFormSafe((current) =>
          updateForm(current, { trip: { ...current.trip, scarceSpot: previousScarceSpot } })
        );
      }
    );
    return true;
  };
  const showAllHiddenGearTiers = (): boolean => {
    const previousHiddenGearTiers = hiddenGearTiers;
    if (!Object.values(previousHiddenGearTiers).some(Boolean)) {
      setStatus("All gear tiers are already shown");
      return false;
    }
    setHiddenGearTiers(DEFAULT_HIDDEN_GEAR_TIERS_STATE);
    setUndoableStatus("Hidden gear tiers shown", "Restored hidden gear tiers", () => {
      setHiddenGearTiers(previousHiddenGearTiers);
    });
    return true;
  };
  const resetActiveAssumption = (target: ActiveAssumptionResetTarget) => {
    if (target === "manual-combat-overrides") {
      resetManualOverrides();
    } else if (target === "cannon-enabled") {
      resetCannonForCurrentMonster();
    } else if (target === "loot-settings") {
      resetCurrentLootSettings();
    } else if (target === "loot-action-overrides") {
      resetCurrentLootOverrides();
    } else if (target === "scarce-spot") {
      if (!resetTripScarceSpot()) setStatus("Scarce spot is already disabled");
    } else if (target === "explicit-safespot") {
      if (!resetTripSafespotOverride()) setStatus("Safespot already uses auto detection");
    } else if (target === "hidden-gear-tiers") {
      showAllHiddenGearTiers();
    }
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
    if (result.changedRows <= 0) {
      const message = `Loot actions already match optimized choices for ${monsterName}`;
      setLootNotice(message);
      setStatus(message);
      return;
    }
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
    setupMode,
    hasCurrentCustomSetup,
    currentMonsterLabel: currentMonster?.name ?? form.monsterId,
    setupPersistenceKind,
    weaponName: currentWeapon?.name ?? form.weaponId,
    ammoName: context.gameData.ammo[form.ammoId]?.name ?? form.ammoId,
    spellName: context.gameData.spells[form.spellId]?.name ?? form.spellId,
    styleName: styles.find((option) => option.id === form.styleId)?.label ?? form.styleId,
    effectiveAccuracy: derivedViewModel.combat.debug.effectiveAccuracy,
    effectiveDamage: derivedViewModel.combat.debug.effectiveDamage,
    derivedAccuracyBonus: derivedViewModel.combat.debug.accuracyBonus,
    derivedDamageBonus: derivedViewModel.combat.debug.damageBonus,
    derivedAttackSpeedSec: derivedViewModel.combat.attackSpeedSec,
    setupRequirementWarningCount: viewModel.setupRequirements.warningCount,
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
  const activePriceSet = context?.priceSet ?? null;
  const priceTimeContext = createPriceTimeContext(new Date(priceAgeNowMs), priceTimeZone);
  const manualPricePresentation = createManualPriceEditorPresentation({
    activePriceSet,
    basePriceSet,
    itemLabels: priceHistoryItemLabels,
    manualPriceOverrides,
    selectedItemId: manualPriceItemId,
    draft: manualPriceDraft,
    timeContext: priceTimeContext
  });
  const priceSetPresentation = createPriceSetPresentation({
    activePriceSet,
    bundledPriceSet,
    scheduledSnapshotStatus,
    activePriceSetOrigin,
    priceLabel,
    activeManualPriceOverrideCount: manualPricePresentation.activeCount,
    timeContext: priceTimeContext
  });
  const selectedEconomyItem = createSelectedPriceItemPresentation({
    activePriceSet,
    itemId: economyHistory.effectiveTrendItemId,
    itemLabels: priceHistoryItemLabels,
    freshnessNow: new Date(priceAgeNowMs),
    timeContext: priceTimeContext
  });
  const gameRevisionViewModel = createGameRevisionViewModel(context.gameData);
  const settingsPaneViewModel = createSettingsPaneViewModel(hiddenGearTiers, gameRevisionViewModel);
  const priceDataViewModel = {
    ...priceSetPresentation,
    manual: manualPricePresentation,
    history: {
      ...economyHistory,
      summary: priceHistorySummary,
      selectedItem: selectedEconomyItem
    }
  };
  const reviewedHistoryOccurrenceId =
    priceHistoryReview?.kind === "removal"
      ? priceHistoryReview.candidate.target.occurrenceId
      : priceHistoryReview?.kind === "replacement"
        ? priceHistoryReview.candidate.replacedOccurrence.occurrenceId
        : null;
  const reviewedHistoryCaptureTime =
    economyHistory.localManagement.rows.find(
      (row) => row.occurrenceId === reviewedHistoryOccurrenceId
    )?.captureTime ?? presentPriceDateTime(null, priceTimeContext);
  const effectiveManualPriceItemId = manualPricePresentation.itemId;
  const selectedManualBasePrice = manualPricePresentation.basePrice;
  const selectedManualOverride = manualPricePresentation.selectedOverride;
  const manualPriceInputValue = manualPricePresentation.inputValue;
  const resetFallbackPriceSet = priceSetPresentation.reset.fallbackPriceSet;
  const resetFallbackOrigin = priceSetPresentation.reset.fallbackOrigin;
  const resetFallbackLabel = priceSetPresentation.reset.fallbackLabel;
  const workspaceRestoreContext = resetFallbackPriceSet
    ? {
        gameData: context.gameData,
        liveState: captureCurrentWorkspaceLiveState(),
        allowedPool: plannerAllowedPool(form.combatStyle, context),
        priceFallback: [resetFallbackPriceSet, resetFallbackOrigin] as const
      }
    : null;
  const commitManualPriceOverrides = async (
    next: ManualPriceOverridesState,
    successMessage: string,
    undo?: { restoredMessage: string }
  ): Promise<void> => {
    if (next === manualPriceOverrides) {
      setStatus(successMessage);
      setMarketNotice({ tone: "neutral", message: successMessage });
      return;
    }
    const { saveEconomyManualPriceOverrides } = await loadEconomySettingsPane();
    invalidatePendingEconomyUndo();
    const outcome = saveEconomyManualPriceOverrides({
      storage,
      persistenceUnavailable: localPersistenceUnavailable,
      liveState: {
        manualPriceOverrides,
        activePriceSet: context.priceSet,
        priceLabel,
        manualPriceDraft
      },
      next,
      successMessage,
      undo: Boolean(undo),
      recovery: localStateRecovery
    });
    setManualPriceOverrides(next);
    if (basePriceSet) {
      const nextActivePriceSet = applyManualPriceOverrides(basePriceSet, next);
      setContext((current) => (current ? { ...current, priceSet: nextActivePriceSet } : current));
      setPriceLabel(nextActivePriceSet.label);
    }
    setManualPriceClearPending(false);
    setStatus(outcome.actionStatus);
    setMarketNotice(outcome.marketNotice);
    const undoRecord = outcome.record;
    if (undoRecord && undo) {
      setUndoableStatus(
        outcome.actionStatus,
        undo.restoredMessage,
        () =>
          undoRecord.restore({
            applyLiveState: (previous) => {
              setManualPriceOverrides(previous.manualPriceOverrides);
              setContext((current) =>
                current ? { ...current, priceSet: previous.activePriceSet } : current
              );
              setPriceLabel(previous.priceLabel);
              setManualPriceDraft(previous.manualPriceDraft);
              setManualPriceClearPending(false);
              setFatalError(null);
              setPriceAgeNowMs(Date.now());
            },
            recovery: localStateRecovery,
            onNotice: setMarketNotice,
            restoredMessage: undo.restoredMessage
          }).message,
        "economy-data"
      );
    }
  };
  const applyManualItemPrice = async (): Promise<void> => {
    if (!effectiveManualPriceItemId || selectedManualBasePrice === null) return;
    if (manualPriceInputValue === selectedManualBasePrice) {
      const next = removeManualPriceOverride(manualPriceOverrides, effectiveManualPriceItemId);
      await commitManualPriceOverrides(
        next,
        `Restored ${priceHistoryItemLabels[effectiveManualPriceItemId] ?? effectiveManualPriceItemId} to ${formatNumber(selectedManualBasePrice)} GP. Current results use the base PriceSet value.`,
        {
          restoredMessage: `Restored manual item price for ${priceHistoryItemLabels[effectiveManualPriceItemId] ?? effectiveManualPriceItemId}`
        }
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
    await commitManualPriceOverrides(
      next,
      `Applied ${formatNumber(manualPriceInputValue)} GP manual price for ${priceHistoryItemLabels[effectiveManualPriceItemId] ?? effectiveManualPriceItemId}. Current results use this manual value.`
    );
  };
  const resetManualItemPrice = async (): Promise<void> => {
    if (
      !effectiveManualPriceItemId ||
      !selectedManualOverride ||
      selectedManualBasePrice === null
    ) {
      return;
    }
    const next = removeManualPriceOverride(manualPriceOverrides, effectiveManualPriceItemId);
    await commitManualPriceOverrides(
      next,
      `Reset ${priceHistoryItemLabels[effectiveManualPriceItemId] ?? effectiveManualPriceItemId} to ${formatNumber(selectedManualBasePrice)} GP. Current results use the base PriceSet value.`,
      {
        restoredMessage: `Restored manual item price for ${priceHistoryItemLabels[effectiveManualPriceItemId] ?? effectiveManualPriceItemId}`
      }
    );
    setManualPriceDraft(selectedManualBasePrice);
  };
  const confirmClearAllManualPrices = async (): Promise<void> => {
    await commitManualPriceOverrides(
      DEFAULT_MANUAL_PRICE_OVERRIDES_STATE,
      "Cleared all manual item prices",
      { restoredMessage: "Restored all manual item prices" }
    );
    setManualPriceDraft(selectedManualBasePrice);
  };
  const exportActivePriceSet = () => {
    if (!activePriceSet) return;
    const outcome = priceSetTransfer.exportPriceSet(activePriceSet, context.gameData);
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
  const resetActivePriceSetToFallback = async (): Promise<void> => {
    if (!resetFallbackPriceSet || !basePriceSet) return;
    const { prepareEconomyDataUndo } = await loadEconomySettingsPane();
    const undoPreparation = prepareEconomyDataUndo({
      scope: "selected-price-set",
      storage,
      persistenceUnavailable: localPersistenceUnavailable,
      liveState: {
        basePriceSet,
        activePriceSet: context.priceSet,
        activePriceSetOrigin,
        priceLabel,
        manualPriceDraft
      }
    });
    invalidatePendingEconomyUndo();
    const outcome = priceSetTransfer.resetToFallback({
      fallbackPriceSet: resetFallbackPriceSet,
      fallbackOrigin: resetFallbackOrigin,
      fallbackLabel: resetFallbackLabel,
      manualPriceOverrides
    });
    applyResetPriceSet(outcome);
    const undoRecord = undoPreparation.finish(outcome.persistedReset);
    setUndoableStatus(
      outcome.appStatus,
      "Restored imported PriceSet",
      () =>
        undoRecord.restore({
          applyLiveState: (previous) => {
            setBasePriceSet(previous.basePriceSet);
            setContext((current) =>
              current ? { ...current, priceSet: previous.activePriceSet } : current
            );
            setActivePriceSetOrigin(previous.activePriceSetOrigin);
            setPriceLabel(previous.priceLabel);
            setManualPriceDraft(previous.manualPriceDraft);
            setManualPriceClearPending(false);
            setFatalError(null);
            setPriceAgeNowMs(Date.now());
          },
          recovery: localStateRecovery,
          onNotice: setMarketNotice,
          restoredMessage: "Restored imported PriceSet"
        }).message,
      "economy-data"
    );
  };
  const visibleShareableSetupInspection = shareReviewDismissed
    ? null
    : receivedShareableSetupInspection;
  const sharedSetupReviewViewModel = visibleShareableSetupInspection
    ? createSharedSetupReviewViewModel({
        inspection: visibleShareableSetupInspection,
        monsters: context.gameData.monsters,
        changeReview: shareChangeReview,
        stale: sharedSetupChangeReviewStale
      })
    : null;
  const workbenchResultViewModel = createWorkbenchResultViewModel({
    effectiveDps: viewModel.combat.effectiveDps,
    maxHit: viewModel.combat.maxHit,
    hitChance: viewModel.combat.hitChance,
    ttkSec: viewModel.combat.ttkSec,
    effectiveKph: viewModel.trip.effectiveKph,
    effectiveXpPerHour: viewModel.effectiveXpPerHour,
    effectiveGpPerHour: viewModel.trip.effectiveGpPerHour,
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
  const localStateAttentionViewModel = buildLocalStateAttentionViewModel(
    localStateRecovery.report,
    crossTabConflicts
  );
  const setupImportReviewViewModel = setupFileTransfer.review
    ? buildSetupImportReviewViewModel(setupFileTransfer.review)
    : null;
  const activeSetupResetViewState = activeSetupReset.candidate
    ? invalidateStaleActiveSetupReset(activeSetupReset, captureCurrentRewriteSetup())
    : activeSetupReset;
  const duelImportReviewViewModel = duelImportReview
    ? {
        ...createSavedSetupMergeReviewViewModel({
          plan: duelImportReview.plan,
          current: duelSnapshots,
          context
        }),
        contextTone: duelImportReview.context.tone,
        contextMessage: duelImportReview.context.message
      }
    : null;
  const duelLoadReviewSnapshot = duelLoadReview
    ? duelSnapshots.snapshots.find((snapshot) => snapshot.id === duelLoadReview.snapshotId)
    : null;
  const duelLoadReviewIncoming = duelLoadReviewSnapshot
    ? normalizeFormState({ ...duelLoadReviewSnapshot.form, monsterId: form.monsterId })
    : null;
  const duelLoadReviewViewModel = duelLoadReview
    ? {
        ...duelLoadReview,
        snapshotName: duelLoadReviewSnapshot?.name ?? duelLoadReview.snapshotName,
        stale:
          !duelLoadReviewIncoming ||
          !savedRowReviewMatches(duelLoadReview.changeReview, form, duelLoadReviewIncoming),
        sourceMissing: duelLoadReviewSnapshot === undefined
      }
    : null;
  const visibleLiveMessages = [
    setupFileTransfer.phase === "reading" ? "Reviewing setup file" : null,
    setupFileTransfer.notice?.message,
    setupImportNotice?.message,
    duelImportNotice?.message,
    marketNotice?.message,
    workspaceFileTransfer.notice?.message,
    localStateRecovery.notice
  ];
  const visibleActionSuppressedMessages = [
    ...visibleLiveMessages,
    "Loaded scheduled prices",
    "Loaded source-backed runtime data",
    "Loaded saved rewrite setup",
    "Loaded saved rewrite setup and selected PriceSet",
    "Loaded selected PriceSet"
  ];
  const actionStatusMessage = globalStatusAnnouncement(
    status,
    pendingUndo,
    visibleActionSuppressedMessages
  );

  return (
    <main className="app-shell" data-app-startup-state="ready">
      <AppHeader
        activeGameRevisionLabel={gameRevisionViewModel.revisionLabel}
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
          onApply: applyHiscoresPreview,
          onEditManually: focusManualPlayerLevels
        }}
        setupImportPhase={setupFileTransfer.phase}
        setupImportNotice={setupFileTransfer.notice ?? setupImportNotice}
        setupImportInputRef={setupImportInputRef}
        shareCreateNotice={shareCreateNotice}
        shareButtonRef={shareSetupButtonRef}
        onImportSetup={importSetupFile}
        onExportSetup={exportCurrentSetup}
        onShareSetup={openShareSetupDialog}
        onOpenWorkspaceBackup={openWorkspaceBackupFromHeader}
      />
      {(savedDataIgnoredForSession ||
        sessionOnlyExitProtectionSnapshot.sessionOnlyChangeCount > 0) && (
        <SafeSessionNotice
          guard={sessionOnlyExitProtectionSnapshot}
          onDownloadWorkspace={exportWorkspace}
        />
      )}
      {setupImportReviewViewModel && (
        <Suspense fallback={<p role="status">Loading setup review…</p>}>
          <SetupImportReview
            viewModel={setupImportReviewViewModel}
            onApply={applySetupImportReview}
            onRefresh={refreshSetupImportReview}
            onDismiss={dismissSetupImportReview}
          />
        </Suspense>
      )}
      {localStateAttentionViewModel.visible &&
        !(
          sessionOnlyExitProtectionSnapshot.sessionOnlyChangeCount > 0 &&
          localStateAttentionViewModel.kind === "persistence"
        ) && (
          <Suspense fallback={<p role="status">Loading local data notice…</p>}>
            <LocalStateAttentionBanner
              viewModel={localStateAttentionViewModel}
              onReview={reviewLocalState}
            />
          </Suspense>
        )}
      <ActionStatus message={actionStatusMessage} />

      {shareDialog && (
        <Suspense fallback={<p role="status">Loading share setup dialog…</p>}>
          <ShareSetupDialog
            state={shareDialog}
            onCopy={() => void copyShareSetupUrl()}
            onClose={closeShareSetupDialog}
          />
        </Suspense>
      )}

      {sharedSetupReviewViewModel && (
        <Suspense fallback={<p role="status">Loading shared setup review…</p>}>
          <SharedSetupReview
            viewModel={sharedSetupReviewViewModel}
            onLoad={loadReceivedShareableSetup}
            onRefresh={refreshReceivedShareableSetupReview}
            onDismiss={dismissReceivedShareableSetupReview}
          />
        </Suspense>
      )}

      <PendingUndoStatus pendingUndo={pendingUndo} onUndo={undoPendingAction} />

      {legacyMigrationReport && (
        <Suspense fallback={<p role="status">Loading legacy data review…</p>}>
          <LegacyMigrationPanel
            report={legacyMigrationReport}
            hasRewriteSetup={initialSavedSetup.loaded}
            clearPending={legacyClearPending}
            onImport={importLegacySetup}
            onKeep={keepLegacyData}
            onRequestClear={() => setLegacyClearPending(true)}
            onConfirmClear={confirmClearLegacyData}
            onCancelClear={() => setLegacyClearPending(false)}
          />
        </Suspense>
      )}

      <WorkbenchShell
        activeTab={activeTab}
        activePaneFamily={paneFamilyForTab(activeTab)}
        activePaneLoadState={paneLoadStates[paneFamilyForTab(activeTab)]}
        form={form}
        shellSetup={appShellSetup}
        result={workbenchResultViewModel}
        currentMonsterLabel={currentMonster?.name ?? form.monsterId}
        setupModeHeadingRef={setupModeHeadingRef}
        resetSetupButtonRef={resetSetupButtonRef}
        playerLevelGroupRef={playerLevelGroupRef}
        monsterOptions={monsters}
        styleOptions={styles}
        spellOptions={spellSelectOptions}
        foodPerKill={viewModel.trip.trip.foodPerKill}
        priceNotices={viewModel.priceNotices}
        activeAssumptions={viewModel.activeAssumptions}
        setupReview={
          activeSetupResetViewState.candidate || activeSetupResetViewState.notice ? (
            <Suspense fallback={<p role="status">Loading active setup review…</p>}>
              <ActiveSetupResetReview
                state={activeSetupResetViewState}
                onConfirm={confirmActiveSetupReset}
                onCancel={cancelActiveSetupResetReview}
              />
            </Suspense>
          ) : null
        }
        actions={{
          activateTab: (tabId) => activateWorkbenchTab(tabId, "user"),
          routeToTab: (tabId) => activateWorkbenchTab(tabId, "routed-action"),
          selectCombatStyle,
          updateLevel,
          setStyle: (styleId) => setFormSafe((current) => updateForm(current, { styleId })),
          selectTarget,
          createCustomSetup,
          editDefaultSetup,
          editCustomSetup,
          removeCurrentCustomSetup,
          resetActiveSetup: openActiveSetupResetReview,
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
          reviewPriceData,
          reviewPriceItem: requestPriceItemReview,
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
        <PaneBoundary
          active={activeTab === "stats"}
          family="stats"
          label="Stats"
          moduleLoaded={() => true}
          onLoadStateChange={updatePaneLoadState}
        >
          <StatsPane
            hidden={activeTab !== "stats"}
            viewModel={{
              sourceBreakdown: viewModel.statsSourceBreakdown,
              combatRollDetail: viewModel.combatRollDetail,
              xpRouting: viewModel.xpRouting,
              tripBankingSummary: viewModel.tripBankingSummary
            }}
          />
        </PaneBoundary>

        {requestedPaneFamilies.has("loadout") ? (
          <PaneBoundary
            active={activeTab === "loadout"}
            family="loadout"
            label={workbenchTabLabel("loadout", form.combatStyle)}
            moduleLoaded={trackedLoadoutPane.isLoaded}
            onLoadStateChange={updatePaneLoadState}
          >
            <LoadoutPane
              hidden={activeTab !== "loadout"}
              weaponTriggerRef={loadoutWeaponTriggerRef}
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
          </PaneBoundary>
        ) : null}

        {requestedPaneFamilies.has("loot") ? (
          <PaneBoundary
            active={activeTab === "loot"}
            family="loot"
            label="Loot"
            moduleLoaded={trackedLootPane.isLoaded}
            onLoadStateChange={updatePaneLoadState}
          >
            <LootPane
              hidden={activeTab !== "loot"}
              model={{
                presentation: viewModel.loot,
                settings: currentLootSettings,
                notice: lootUiState.notice,
                gpPerKill: viewModel.trip.gpPerKill,
                effectiveNetGpPerHour: viewModel.trip.effectiveNetGpPerHour,
                sort: lootUiState.sort,
                nestedSort: lootUiState.nestedSort
              }}
              actions={{
                setHighAlch: (highAlch) => setLootSettingsForCurrentMonster({ highAlch }),
                setOverheadMode: (mode) =>
                  setLootSettingsForCurrentMonster({
                    overheadSec: mode === "manual" ? viewModel.loot.overheadValue : null
                  }),
                setOverheadSeconds: (overheadSec) =>
                  setLootSettingsForCurrentMonster({ overheadSec }),
                setTalismanSpot: (talismanSpot) =>
                  setLootSettingsForCurrentMonster({ talismanSpot }),
                setAction: setLootActionForCurrentMonster,
                resetSettings: resetCurrentLootSettings,
                resetOverrides: resetCurrentLootOverrides,
                optimize: optimizeCurrentLoot,
                sortBy: (key) =>
                  setLootUiState((current) => ({
                    ...current,
                    sort: nextLootTableSortState(current.sort, key)
                  })),
                sortNestedBy: (key) =>
                  setLootUiState((current) => ({
                    ...current,
                    nestedSort: nextLootNestedTableSortState(current.nestedSort, key)
                  })),
                reviewPriceItem: requestPriceItemReview
              }}
            />
          </PaneBoundary>
        ) : null}

        {requestedPaneFamilies.has("trip") ? (
          <PaneBoundary
            active={activeTab === "trip"}
            family="trip"
            label="Trip"
            moduleLoaded={trackedTripPane.isLoaded}
            onLoadStateChange={updatePaneLoadState}
          >
            <TripPane
              hidden={activeTab !== "trip"}
              foodPerKillOverrideRef={tripFoodPerKillOverrideRef}
              model={{
                presentation: tripPanePresentation,
                modeledKillsPerTripRange: freshRisk
                  ? formatRiskRange(freshRisk.result.killsPerTrip, 0)
                  : null
              }}
              actions={{
                updateTrip,
                applyRecommendation: applyTripRecommendation,
                openRisk: () => activateWorkbenchTab("risk", "routed-action")
              }}
            />
          </PaneBoundary>
        ) : null}

        {requestedPaneFamilies.has("risk") ? (
          <PaneBoundary
            active={activeTab === "risk"}
            family="risk"
            label="Risk"
            moduleLoaded={trackedRiskPane.isLoaded}
            onLoadStateChange={updatePaneLoadState}
          >
            <RiskPane
              hidden={activeTab !== "risk"}
              model={{
                controls: riskAnalysis.controls,
                presentation: riskAnalysis.presentation,
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
          </PaneBoundary>
        ) : null}
        {requestedPaneFamilies.has("cannon") ? (
          <PaneBoundary
            active={activeTab === "cannon"}
            family="cannon"
            label="Cannon"
            moduleLoaded={trackedCannonPane.isLoaded}
            onLoadStateChange={updatePaneLoadState}
          >
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
              cannonReserveActive={viewModel.trip.trip.slots.reserveParts.includes(
                "cannon (4 parts)"
              )}
              onEnabledChange={(enabled) => setCannonForCurrentMonster({ enabled })}
              onTargetsChange={setCannonTargetsForCurrentMonster}
              onRespawnChange={setCannonRespawnForCurrentMonster}
              onTripSparseLinkedChange={setTripSparseFromCannon}
              onReset={resetCannonForCurrentMonster}
            />
          </PaneBoundary>
        ) : null}

        {requestedPaneFamilies.has("duel") ? (
          <PaneBoundary
            active={activeTab === "duel"}
            family="duel"
            label="Setups"
            moduleLoaded={trackedDuelPane.isLoaded}
            onLoadStateChange={updatePaneLoadState}
          >
            <DuelPane
              hidden={activeTab !== "duel"}
              model={{
                targetLabel: currentMonster?.name ?? form.monsterId,
                snapshotCount: duelSnapshots.snapshots.length,
                duelComparison,
                duelComparisonRows,
                duelComparisonSort,
                duelViewMode,
                expandedDuelDiffId,
                duelMatrixMetric,
                duelMatrixFilter,
                duelMatrixPresentation,
                filteredDuelMatrixRows,
                duelMatrixSort,
                duelImportNotice,
                duelImportReview: duelImportReviewViewModel,
                duelLoadReview: duelLoadReviewViewModel,
                duelSessionOnlyAvailable: duelSessionOnlyRequest !== null,
                duelChangeRevision
              }}
              actions={{
                snapshotCurrentSetup,
                exportDuelSnapshots,
                importDuelSnapshots,
                mergeDuelSnapshotsImport,
                dismissDuelSnapshotsImport,
                setDuelSnapshotsImportDecision,
                setDuelSnapshotsImportName,
                refreshDuelSnapshotsImport,
                applyDuelSessionOnlyChange,
                commitDuelSnapshotName,
                loadDuelSnapshot,
                refreshDuelSnapshotLoad,
                confirmDuelSnapshotLoad,
                dismissDuelSnapshotLoad: (snapshotId) =>
                  setDuelLoadReview((current) =>
                    current?.snapshotId === snapshotId ? null : current
                  ),
                deleteDuelSnapshot,
                showCurrentDuelTarget,
                showDuelMonsterMatrix,
                toggleDuelDiff,
                sortDuelComparisonBy,
                setDuelMatrixFilter,
                setDuelMatrixMetric,
                sortDuelMatrixBy,
                buildDuelMatrix
              }}
            />
          </PaneBoundary>
        ) : null}

        {requestedPaneFamilies.has("planner") ? (
          <PaneBoundary
            active={activeTab === "planner"}
            family="planner"
            label="Planner"
            moduleLoaded={trackedPlannerPane.isLoaded}
            onLoadStateChange={updatePaneLoadState}
          >
            <PlannerPane
              hidden={activeTab !== "planner"}
              model={{
                draftState: plannerState,
                panel: plannerPanel,
                gearPoolEditor: plannerGearPoolEditor,
                draftDirty: plannerDraftDirty,
                presentation: plannerPresentation,
                computedMetric: plannerComputedMetric,
                combatStyleLabel: form.combatStyle,
                targetLabel: currentMonster?.name ?? form.monsterId,
                skillInputs: plannerSkillInputs,
                adjustmentNotice: plannerAdjustmentNotice
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
                recompute: recomputePlannerPlan,
                retry: retryPlanner,
                reviewNotice: reviewPlannerNotice
              }}
            />
          </PaneBoundary>
        ) : null}
        {requestedPaneFamilies.has("economy-settings") ? (
          <PaneBoundary
            active={activeTab === "economy" || activeTab === "settings"}
            family="economy-settings"
            label={activeTab === "settings" ? "Settings" : "Economy"}
            moduleLoaded={trackedEconomySettingsPane.isLoaded}
            onLoadStateChange={updatePaneLoadState}
          >
            <EconomySettingsPane
              priceNotesSummaryRef={priceNotesSummaryRef}
              manualPriceInputRef={manualPriceInputRef}
              workspaceImportInputRef={workspaceImportInputRef}
              workspaceExportButtonRef={workspaceExportButtonRef}
              workspaceReviewHeadingRef={workspaceReviewHeadingRef}
              setPriceNoticeActionRef={setPriceNoticeActionRef}
              marketHeadingRef={marketHeadingRef}
              historyReviewReturnFocusRef={priceHistoryReviewReturnFocusRef}
              historyReviewHeadingRef={priceHistoryReviewHeadingRef}
              historyManagementSummaryRef={priceHistoryManagementSummaryRef}
              selectedPriceItemRef={selectedPriceItemRef}
              model={{
                mode:
                  activeTab === "economy"
                    ? "economy"
                    : activeTab === "settings"
                      ? "settings"
                      : "hidden",
                prices: priceDataViewModel,
                settings: settingsPaneViewModel,
                priceNotices: viewModel.priceNotices,
                priceNotesOpen,
                marketNotice,
                importNotice: priceSetTransfer.importNotice,
                priceSetResetPending: priceSetTransfer.resetPending,
                priceHistoryClearPending,
                manualPriceClearPending,
                historyNotice: priceHistoryNotice,
                historyReview:
                  priceHistoryReview?.kind === "removal"
                    ? {
                        kind: "removal",
                        id: priceHistoryReview.candidate.id,
                        occurrenceId: priceHistoryReview.candidate.target.occurrenceId,
                        label: priceHistoryReview.candidate.target.snapshot.label,
                        captureTime: reviewedHistoryCaptureTime,
                        itemCount: Object.keys(
                          priceHistoryReview.candidate.target.snapshot.itemPrices
                        ).length
                      }
                    : priceHistoryReview?.kind === "replacement"
                      ? {
                          kind: "replacement",
                          id: priceHistoryReview.candidate.id,
                          activePriceSetLabel:
                            priceHistoryReview.candidate.sourceActivePriceSet.label,
                          replacedLabel:
                            priceHistoryReview.candidate.replacedOccurrence.snapshot.label,
                          replacedCaptureTime: reviewedHistoryCaptureTime,
                          replacedItemCount: Object.keys(
                            priceHistoryReview.candidate.replacedOccurrence.snapshot.itemPrices
                          ).length
                        }
                      : null,
                recovery: {
                  visible: localStateRecovery.visible,
                  report: localStateRecovery.report,
                  notice: localStateRecovery.notice,
                  pendingClearId: localStateRecovery.pendingClearId
                },
                crossTab: {
                  conflicts: crossTabConflicts.conflicts,
                  selectedIds: crossTabSelectedIds,
                  notice: crossTabNotice,
                  persistenceAvailable:
                    crossTabConflicts.persistenceAvailable && !localPersistenceUnavailable
                },
                monsterChanges: {
                  inventory: monsterSpecificChanges,
                  removalCandidate: monsterRemovalCandidate,
                  notice: monsterChangesNotice,
                  sessionOnlyAvailable: monsterChangesSessionOnlyAvailable
                },
                workspace: {
                  phase: workspaceFileTransfer.phase,
                  includeLastHiscoresPlayer: workspaceFileTransfer.includeLastHiscoresPlayer,
                  notice: workspaceFileTransfer.notice,
                  review: workspaceFileTransfer.review,
                  selection: workspaceFileTransfer.selection,
                  restorePlan: workspaceFileTransfer.restorePlan,
                  restoreBusy: workspaceFileTransfer.restoreBusy,
                  sessionOnlyAvailable: workspaceFileTransfer.sessionOnlyAvailable,
                  recoveryRequired: workspaceFileTransfer.recoveryRequired,
                  currentRevisionLabel: gameRevisionViewModel.revisionLabel,
                  currentSnapshotLabel: gameRevisionViewModel.snapshotLabel,
                  currentSnapshotId: gameRevisionViewModel.snapshotId,
                  canIncludeLastHiscoresPlayer: lastHiscoresPlayerState !== null
                }
              }}
              actions={{
                setPriceNotesOpen,
                reviewPriceItem: requestPriceItemReview,
                navigate: navigateFromSettings,
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
                  reviewRemoval: reviewLocalPriceHistoryRemoval,
                  cancelReview: () => setPriceHistoryReview(null),
                  confirmReview: confirmLocalPriceHistoryReview,
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
                  showAllTiers: showAllHiddenGearTiers
                },
                recovery: {
                  exportReport: localStateRecovery.exportReport,
                  beginClear: localStateRecovery.beginClear,
                  cancelClear: localStateRecovery.cancelClear,
                  confirmClearItem: confirmClearLocalStateItem,
                  confirmClearInvalid: confirmClearInvalidLocalState
                },
                crossTab: {
                  toggle: (id, selected) =>
                    setCrossTabSelectedIds((current) =>
                      selected
                        ? current.includes(id)
                          ? current
                          : [...current, id]
                        : current.filter((candidate) => candidate !== id)
                    ),
                  refresh: refreshCrossTabReview,
                  useSavedData: useSavedCrossTabData,
                  keepCurrent: keepCurrentCrossTabData,
                  exportWorkspace
                },
                monsterChanges: {
                  reviewCategory: reviewMonsterSpecificCategory,
                  reviewRemoval: reviewMonsterSpecificRemoval,
                  cancelRemoval: () => {
                    setMonsterRemovalCandidate(null);
                    setMonsterChangesSessionOnlyAvailable(false);
                    setMonsterChangesNotice(null);
                  },
                  confirmRemoval: confirmMonsterSpecificRemoval
                },
                workspace: {
                  setIncludeLastHiscoresPlayer: workspaceFileTransfer.setIncludeLastHiscoresPlayer,
                  exportWorkspace,
                  dismissReview: dismissWorkspaceReview,
                  reviewRecovery: reviewLocalState,
                  restore: (intent) => {
                    if (!workspaceRestoreContext) return;
                    return intent.kind === "prepare"
                      ? workspaceFileTransfer.prepareImport(intent.file, workspaceRestoreContext)
                      : intent.kind === "plan"
                        ? workspaceFileTransfer.updateRestorePlan(
                            intent.reviewId,
                            intent.action,
                            workspaceRestoreContext
                          )
                        : applyWorkspaceRestore(
                            intent.reviewId,
                            intent.kind === "apply" ? "durable" : "session-only"
                          );
                  }
                }
              }}
            />
          </PaneBoundary>
        ) : null}

        {requestedPaneFamilies.has("compare") ? (
          <PaneBoundary
            active={activeTab === "compare"}
            family="compare"
            label="Monsters"
            moduleLoaded={trackedComparePane.isLoaded}
            onLoadStateChange={updatePaneLoadState}
          >
            <ComparePane
              hidden={activeTab !== "compare"}
              model={{
                denseCompare,
                denseCompareRows,
                denseCompareScale,
                denseCompareTotalRows,
                denseComparePresentation,
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
                toggleDenseIrrelevant,
                retryDenseCompare
              }}
            />
          </PaneBoundary>
        ) : null}
      </WorkbenchShell>
    </main>
  );
}

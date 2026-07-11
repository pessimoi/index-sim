import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { ZodError } from "zod";
import {
  captureBrowserShareableSetupFragment,
  createBrowserShareableSetupUrl,
  downloadJsonFile,
  readBrowserFileText,
  writeShareableSetupToClipboard
} from "@/adapters/browser";
import {
  HiscoresAdapterError,
  fetchHiscoresStatus,
  loadLastHiscoresPlayer,
  lookupHiscores,
  saveLastHiscoresPlayer
} from "@/adapters/hiscores";
import {
  MarketAdapterError,
  fetchMarketStatus,
  loadScheduledStaticPriceSnapshot,
  parsePriceSetFileText,
  type ScheduledStaticPriceSnapshotStatus
} from "@/adapters/market";
import { PRICE_SET_IMPORT_MAX_BYTES } from "@/data/schemas";
import {
  createMemoryStorage,
  loadPersisted,
  tryClearPersisted,
  trySavePersisted,
  type KeyValueStorage,
  type VersionedStorageOptions
} from "@/adapters/storage";
import {
  LEGACY_INPUT_STORAGE_KEY,
  clearKnownLegacyStorageKeys,
  inspectLegacySetupMigration,
  type LegacyStorageKeyMigrationDisposition,
  type LegacySetupMigrationReport,
  type LegacyStorageKey
} from "@/adapters/storage/legacy-migration";
import {
  generatedItemValues,
  loadGeneratedRuntimeContext,
  withGeneratedAlchAuthority
} from "@/adapters/generated";
import { supportedSpecialAttacksForCombatStyle } from "@/domain/combat";
import { loadoutToCombatBonuses } from "@/domain/equipment";
import {
  SKILL_LABEL,
  type PlannerGearSlot,
  type PlannerMetric,
  type PlannerSkill
} from "@/domain/planner";
import { EQUIPMENT_SLOTS } from "@/domain/shared";
import type {
  CombatStyle,
  EquipmentBonuses,
  EquipmentSlot,
  EntityId,
  HiscoresResponse,
  HiscoresStatusResponse,
  MarketStatusResponse,
  PriceSet,
  SimulationContext
} from "@/domain/shared";
import {
  FOOD,
  defaultOverhead,
  lootPreferenceKeysForMonster,
  type LootAction
} from "@/domain/trip";
import {
  activePriceSetOriginLabel,
  createScheduledPriceSnapshotViewModel,
  resolveActivePriceSetFallback,
  scheduledPriceSetFromStatus,
  withGeneratedScheduledPriceFallbacks,
  type ActivePriceSetOrigin
} from "./state/market-sync";
import {
  LEGACY_MIGRATION_DISMISSED_STORAGE_KEY,
  LEGACY_MIGRATION_DISMISSED_VERSION,
  LegacyMigrationDismissedStateSchema
} from "./state/legacy-migration";
import {
  clearInvalidLocalState,
  clearLocalStateItem,
  createLocalStateHealthExport,
  createLocalStateHealthReport,
  localStateHealthNeedsAttention,
  type LocalStateHealthItem,
  type LocalStateHealthItemId,
  type LocalStateHealthReport,
  type LocalStateStorageFailure
} from "./state/local-state-health";
import {
  applyHiscoresLevels,
  canApplyHiscoresPreview,
  countApplicableHiscoresSkills,
  createHiscoresPreviewRows,
  isHiscoresPreviewCurrent,
  normalizeHiscoresPlayerInput
} from "./state/hiscores";
import {
  DEFAULT_HIDDEN_GEAR_TIERS_STATE,
  GEAR_TIER_DEFS,
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
  DuelSnapshotsImportError,
  DuelSnapshotsStateSchema,
  appendDuelSnapshot,
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
  analyzePriceHistoryMovers,
  analyzePriceHistoryTrend,
  appendAcceptedPriceSetToHistory,
  BrowserPriceHistoryStateSchema,
  createSharedPriceHistoryAnalysis,
  DEFAULT_PRICE_HISTORY_STATE,
  mergePriceHistoryForAnalysis,
  PRICE_HISTORY_STORAGE_KEY,
  PRICE_HISTORY_VERSION,
  priceHistorySnapshotKey,
  summarizePriceHistory,
  type BrowserPriceHistoryState,
  type PriceHistoryBaselineMode,
  type PriceHistoryMoverRow,
  type PriceHistoryMoverSortKey,
  type PriceHistoryMoverSortState,
  type PriceHistoryTrendAnalysis
} from "./state/price-history";
import {
  createPriceImportSuccessNotice,
  describePriceImportError,
  type PriceImportNotice
} from "./state/price-import";
import {
  clearSelectedPriceSet,
  loadSelectedPriceSet,
  saveSelectedPriceSet,
  type LoadSelectedPriceSetResult
} from "./state/selected-price-set";
import {
  ShareableSetupError,
  applyShareableSetup,
  buildShareableSetupEnvelope,
  decodeShareableSetupEnvelope,
  encodeShareableSetupEnvelope,
  reviewShareableSetup,
  type ShareableSetupReview
} from "./state/shareable-setup";
import {
  PLANNER_METRICS,
  PLANNER_SKILLS,
  PLANNER_UI_STORAGE_KEY,
  PLANNER_UI_VERSION,
  PlannerUiStateSchema,
  loadPlannerUiState,
  normalizePlannerUiState,
  plannerMetricLabel,
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
  SavedSetupEnvelopeSchema,
  SavedSetupSchema,
  applyWeaponSelection,
  extraBoostSelectionCount,
  extraPrayerSelectionCount,
  formForMonsterSetup,
  normalizeFormState,
  primaryBoostValue,
  primaryPrayerValue,
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
  type SetupSelectionOption,
  type SetupMode
} from "./state/ui-state";
import {
  cleanDenseCompareStateForMonsterIds,
  nextDenseCompareSortState,
  resetDenseCompareFilters,
  toggleDenseCompareMonsterIrrelevant,
  type DenseCompareSortKey,
  type DenseCompareSortState,
  type DenseCompareUiState
} from "./state/dense-compare";
import {
  ammoOptions,
  createDenseCompareScaleModel,
  createDenseCompareRows,
  createDuelComparisonViewModel,
  createDuelMatrixViewModel,
  gearQuickActionForSlot,
  createPlannerGearPoolEditorViewModel,
  createPlannerPanelViewModel,
  createPlannerViewModel,
  createSimulationViewModel,
  equipmentSlotOptions,
  optimizeLootPrefsForMonster,
  plannerAllowedPool,
  type ActiveAssumptionResetTarget,
  type ActiveAssumptionReviewTarget,
  type ActiveAssumptionsSummaryViewModel,
  type DenseCompareScaleCellViewModel,
  type DenseCompareRowViewModel,
  type DuelComparisonRowViewModel,
  type DuelMatrixMetricId,
  type DuelMatrixViewModel,
  type CalculationWarningViewModel,
  type HitDistributionViewModel,
  type MonsterCardViewModel,
  type PlannerGearPoolEditorViewModel,
  type PlannerPanelViewModel,
  type LootDropRowViewModel,
  type LootPriceHistoryItemContext,
  type StatsCombatRollDetailViewModel,
  type StatsSourceDetailViewModel,
  formatNumber,
  monsterOptions,
  spellOptions,
  styleOptions,
  weaponOptions
} from "./view-models/simulation";

const LOCAL_STATE_PERSISTENCE_NOTICE =
  "Local storage is unavailable. Changes may not persist after reload.";

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

const initialLocalStateHealthReport = createLocalStateHealthReport(storage, new Date(), {
  storageUnavailable: localStorageAccessUnavailable
});
const initialLocalStateRecoveryBlockedIds = initialLocalStateHealthReport.items
  .filter(localStateHealthNeedsAttention)
  .map((item) => item.id);

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
  const persisted = loadPersisted(priceHistoryStorageOptions);
  return persisted.status === "loaded" ? persisted.value : DEFAULT_PRICE_HISTORY_STATE;
}

function loadInitialPlannerUiState(): PlannerUiState {
  return loadPlannerUiState(storage);
}

function loadInitialLegacyMigrationDismissed(): boolean {
  return loadPersisted(legacyMigrationDismissedStorageOptions).status === "loaded";
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
    case "invalid_json":
      return "Saved active PriceSet is not valid JSON. Bundled prices were loaded.";
    case "invalid_envelope":
      return "Saved active PriceSet metadata is invalid. Bundled prices were loaded.";
    case "invalid_data":
      return "Saved active PriceSet data is invalid. Bundled prices were loaded.";
  }
}

function priceSetExportFileName(priceSet: PriceSet): string {
  const safeId = priceSet.id.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return `index-sim-price-set-${safeId || "active"}.json`;
}

type SelectOption = { id: string; label: string; hint?: string };

type DisplayMetric = {
  label: string;
  value: string;
  tone?: string;
};

interface SetupImportNotice {
  tone: "success" | "error";
  message: string;
  details?: string[];
}

type ShareableSetupInspection =
  { status: "ready"; review: ShareableSetupReview } | { status: "error"; message: string };

interface ShareSetupDialogState {
  url: string;
  targetLabel: string;
  combatStyle: CombatStyle;
  cannonEnabled: boolean;
  lootPreferenceCount: number;
  copyStatus: "idle" | "copied" | "failed";
}

interface PendingUndo {
  id: string;
  label: string;
  restoreLabel: string;
  createdAt: number;
  restore: () => void;
}

type PriceImportSurface = "topbar" | "settings" | "market";
type ScopedPriceImportNotice = PriceImportNotice & { surface: PriceImportSurface };

const SETUP_IMPORT_MAX_BYTES = 250_000;

const COMBAT_STYLE_OPTIONS: SelectOption[] = [
  { id: "melee", label: "melee" },
  { id: "ranged", label: "ranged" },
  { id: "magic", label: "magic" }
];

const HIGH_ALCH_OPTIONS: SelectOption[] = [
  { id: "enabled", label: "Enabled" },
  { id: "disabled", label: "Disabled" }
];

const OVERHEAD_MODE_OPTIONS: SelectOption[] = [
  { id: "auto", label: "Auto" },
  { id: "manual", label: "Manual" }
];

const TALISMAN_SPOT_OPTIONS: SelectOption[] = [
  { id: "underground", label: "Underground" },
  { id: "overground", label: "Overground" }
];

const PRICE_HISTORY_BASELINE_OPTIONS: Array<{ id: PriceHistoryBaselineMode; label: string }> = [
  { id: "previous", label: "Previous" },
  { id: "first", label: "First" },
  { id: "snapshot", label: "Snapshot" }
];

const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  helm: "Helm",
  amulet: "Amulet",
  body: "Body",
  legs: "Legs",
  shield: "Shield",
  gloves: "Gloves",
  boots: "Boots",
  cape: "Cape",
  ring: "Ring"
};

const OFFENSIVE_BONUS_LABELS: Array<[keyof EquipmentBonuses, string]> = [
  ["stabAtt", "Stab"],
  ["slashAtt", "Slash"],
  ["crushAtt", "Crush"],
  ["rngAtt", "Ranged"],
  ["magAtt", "Magic"],
  ["str", "Strength"],
  ["rngStr", "Rng str"],
  ["magDmg", "Magic dmg"]
];

const DEFENSIVE_BONUS_LABELS: Array<[keyof EquipmentBonuses, string]> = [
  ["stabDef", "Stab def"],
  ["slashDef", "Slash def"],
  ["crushDef", "Crush def"],
  ["rngDef", "Ranged def"],
  ["magDef", "Magic def"],
  ["prayer", "Prayer"]
];

const PRAYER_OPTIONS: SelectOption[] = [
  { id: "none", label: "None" },
  ...PRAYER_SELECTION_OPTIONS.map(({ id, label }) => ({ id, label }))
];

const BOOST_OPTIONS: SelectOption[] = [
  { id: "none", label: "None" },
  ...BOOST_SELECTION_OPTIONS.map(({ id, label }) => ({ id, label }))
];

const SAFESPOT_OPTIONS: SelectOption[] = [
  { id: "auto", label: "Auto" },
  { id: "on", label: "On" },
  { id: "off", label: "Off" }
];

const PROTECT_OPTIONS: SelectOption[] = [
  { id: "none", label: "None" },
  { id: "melee", label: "Melee" },
  { id: "missiles", label: "Missiles" },
  { id: "magic", label: "Magic" }
];

const PRAYER_MODE_OPTIONS: SelectOption[] = [
  { id: "potions", label: "Potions" },
  { id: "altar", label: "Altar" },
  { id: "none", label: "None" }
];

const PRAYER_RESTORE_MODE_OPTIONS: SelectOption[] = [
  { id: "auto", label: "Auto" },
  { id: "manual_vials", label: "Manual vials" },
  { id: "manual_doses", label: "Manual doses" }
];

const ALTAR_TIME_MODE_OPTIONS: SelectOption[] = [
  { id: "auto", label: "Auto" },
  { id: "manual", label: "Manual" }
];

const FOOD_COUNT_MODE_OPTIONS: SelectOption[] = [
  { id: "auto", label: "Auto" },
  { id: "manual", label: "Manual" }
];

const FOOD_PER_KILL_OVERRIDE_OPTIONS: SelectOption[] = [
  { id: "off", label: "Off" },
  { id: "on", label: "On" }
];

const BANK_TIME_MODE_OPTIONS: SelectOption[] = [
  { id: "auto", label: "Auto" },
  { id: "manual", label: "Manual" }
];

const FOOD_OPTIONS: SelectOption[] = Object.entries(FOOD).map(([id, food]) => ({
  id,
  label: food.name,
  hint: food.heal > 0 ? `heals ${food.heal}` : "no carried food"
}));

const PLANNER_METRIC_OPTIONS: Array<{ id: PlannerMetric; label: string }> = PLANNER_METRICS.map(
  (metric) => ({
    id: metric,
    label: plannerMetricLabel(metric)
  })
);

const LEGACY_PRICE_STORAGE_KEYS = new Set<LegacyStorageKey>([
  "sim_prices_v1",
  "sim_alch_v1",
  "sim_scraped_at_v1",
  "sim_scraped_keys_v1",
  "sim_price_history_v1",
  "sim_price_history_sanitized_v1",
  "sim_price_history_sanitized_v2",
  "sim_price_history_sanitized_v3",
  "sim_price_history_sanitized_v4"
]);

const DENSE_TABLE_COLUMNS: Array<{
  key: DenseCompareSortKey;
  label: string;
  align: "left" | "right";
  render: (row: DenseCompareRowViewModel) => string;
}> = [
  {
    key: "monsterName",
    label: "Monster",
    align: "left",
    render: (row) =>
      row.monsterLevel === null ? row.monsterName : `${row.monsterName} lvl ${row.monsterLevel}`
  },
  {
    key: "hitChance",
    label: "HIT %",
    align: "right",
    render: (row) => `${formatNumber(row.hitChance * 100, 1)}%`
  },
  { key: "maxHit", label: "MAX", align: "right", render: (row) => formatNumber(row.maxHit, 1) },
  { key: "dps", label: "DPS", align: "right", render: (row) => formatNumber(row.dps, 2) },
  { key: "ttkSec", label: "TTK", align: "right", render: (row) => formatDuration(row.ttkSec) },
  {
    key: "killsPerHour",
    label: "K/HR",
    align: "right",
    render: (row) => formatNumber(row.killsPerHour)
  },
  {
    key: "xpPerHour",
    label: "XP/HR",
    align: "right",
    render: (row) => formatNumber(row.xpPerHour)
  },
  {
    key: "gpPerKill",
    label: "GP/KL",
    align: "right",
    render: (row) => formatNumber(row.gpPerKill)
  },
  {
    key: "gpPerHour",
    label: "GP/HR",
    align: "right",
    render: (row) => formatNumber(row.gpPerHour)
  },
  {
    key: "netGpPerHour",
    label: "NET GP/HR",
    align: "right",
    render: (row) => formatNumber(row.netGpPerHour)
  }
];

type DenseScaleColumnKey = "xpPerHour" | "netGpPerHour";

function isDenseScaleColumn(key: DenseCompareSortKey): key is DenseScaleColumnKey {
  return key === "xpPerHour" || key === "netGpPerHour";
}

function DenseScaleCell({
  value,
  scale
}: {
  value: string;
  scale: DenseCompareScaleCellViewModel;
}) {
  return (
    <span className={`dense-scale-cell dense-scale-${scale.tone}`} aria-label={scale.ariaLabel}>
      <span className="dense-scale-track" aria-hidden="true">
        <span style={{ width: `${scale.widthPercent}%` }} />
      </span>
      <span className="dense-scale-number">{value}</span>
    </span>
  );
}

function InlineImportNotice({
  notice,
  ariaLabel,
  className = ""
}: {
  notice: SetupImportNotice | PriceImportNotice;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={`${className} inline-status ${notice.tone}`.trim()}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-label={ariaLabel}
    >
      <span>{notice.message}</span>
      {"code" in notice && notice.code ? (
        <span className="import-error-code">Code {notice.code}</span>
      ) : null}
      {notice.details?.length ? (
        <ul>
          {notice.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ShareSetupDialog({
  state,
  onCopy,
  onClose
}: {
  state: ShareSetupDialogState;
  onCopy: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const urlFieldRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const urlId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    urlFieldRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="share-setup-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="share-setup-dialog-header">
        <div>
          <span className="eyebrow">Portable setup</span>
          <h2 id={titleId}>Share setup</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close share setup dialog">
          Close
        </button>
      </div>
      <p>
        {state.targetLabel} · {state.combatStyle} · Player levels included
      </p>
      <div className="share-setup-summary" aria-label="Shared setup contents">
        <span>Cannon {state.cannonEnabled ? "included" : "off"}</span>
        <span>{formatNumber(state.lootPreferenceCount)} loot choices</span>
        <span>Uses recipient prices</span>
      </div>
      <div className="field share-setup-url-field">
        <label htmlFor={urlId}>Setup link</label>
        <input
          ref={urlFieldRef}
          id={urlId}
          type="text"
          readOnly
          value={state.url}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
      <p className="share-setup-privacy-note">
        Anyone with this link can read the included levels and setup choices. The link is encoded,
        not encrypted.
      </p>
      <div className="share-setup-dialog-actions">
        <button type="button" onClick={onCopy}>
          Copy
        </button>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </div>
      {state.copyStatus !== "idle" ? (
        <p
          className={`inline-status ${state.copyStatus === "copied" ? "success" : "error"}`}
          role="status"
        >
          {state.copyStatus === "copied"
            ? "Link copied"
            : "Clipboard unavailable. Select the link and copy it manually."}
        </p>
      ) : null}
    </dialog>
  );
}

const WORKBENCH_TABS = [
  { id: "stats", label: "Stats" },
  { id: "melee", label: "Melee", combatStyle: "melee" },
  { id: "ranged", label: "Ranged", combatStyle: "ranged" },
  { id: "magic", label: "Magic", combatStyle: "magic" },
  { id: "compare", label: "Compare" },
  { id: "loot", label: "Loot" },
  { id: "trip", label: "Trip" },
  { id: "cannon", label: "Cannon" },
  { id: "duel", label: "Duel" },
  { id: "planner", label: "Planner" },
  { id: "economy", label: "Economy" },
  { id: "settings", label: "Settings" }
] as const;

type WorkbenchTabId = (typeof WORKBENCH_TABS)[number]["id"];

const COMBAT_STYLE_TAB_IDS = new Set<WorkbenchTabId>(["melee", "ranged", "magic"]);

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

function updateForm(
  form: CombatSetupFormState,
  patch: Partial<CombatSetupFormState>
): CombatSetupFormState {
  return normalizeFormState({ ...form, ...patch });
}

function emptyGearSelectOptions(): Record<EquipmentSlot, SelectOption[]> {
  const options = {} as Record<EquipmentSlot, SelectOption[]>;
  for (const slot of EQUIPMENT_SLOTS) options[slot] = [];
  return options;
}

function numberValue(value: string, fallback: number, min = 1, max = 99): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function decimalValue(value: string, fallback: number, min = 0, max = 999): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function stepDecimalValue(
  value: string,
  fallback: number,
  min: number,
  max: number,
  step: number
): number {
  const clamped = decimalValue(value, fallback, min, max);
  if (!(step > 0)) return clamped;
  return Number((Math.round(clamped / step) * step).toFixed(6));
}

function primaryLevelKey(combatStyle: CombatStyle): keyof CombatSetupFormState["levels"] {
  if (combatStyle === "ranged") return "ranged";
  if (combatStyle === "magic") return "magic";
  return "attack";
}

function primaryLevelLabel(combatStyle: CombatStyle): string {
  if (combatStyle === "ranged") return "RNG";
  if (combatStyle === "magic") return "MAG";
  return "ATT";
}

function safespotControlValue(value: boolean | null): string {
  if (value === true) return "on";
  if (value === false) return "off";
  return "auto";
}

function safespotFromControl(value: string): boolean | null {
  if (value === "on") return true;
  if (value === "off") return false;
  return null;
}

function optionLabel(options: readonly SelectOption[], value: string): string {
  return options.find((option) => option.id === value)?.label ?? value;
}

function actionLabel(action: LootAction): string {
  return action === "unid" ? "Unid" : action.charAt(0).toUpperCase() + action.slice(1);
}

function formatDelta(value: number): string {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) < 0.5) return "0";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function yesNo(value: boolean): string {
  return value ? "On" : "Off";
}

function signedInteger(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function signedPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${formatNumber(value, 1)}%`;
}

function finiteMetric(value: number, digits = 1): string {
  return Number.isFinite(value) ? formatNumber(value, digits) : "-";
}

function formatPlannerMetricValue(metricKey: PlannerMetric, value: number): string {
  if (!Number.isFinite(value)) return "-";
  return metricKey === "dps" || metricKey === "balanced"
    ? formatNumber(value, 2)
    : formatNumber(value);
}

function signedDecimal(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "unlimited";
  if (seconds < 60) return `${formatNumber(seconds, 1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function formatAge(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 60) return "<1m";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function ariaSort(
  sort: DenseCompareSortState,
  key: DenseCompareSortKey
): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function economyAriaSort(
  sort: PriceHistoryMoverSortState,
  key: PriceHistoryMoverSortKey
): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function optionalPrice(value: number | null): string {
  return value === null ? "-" : formatNumber(value);
}

function optionalDelta(value: number | null): string {
  return value === null ? "-" : formatDelta(value);
}

function optionalPercent(value: number | null): string {
  return value === null ? "-" : signedPercent(value);
}

function optionalNumber(value: number | null, digits = 0): string {
  return value === null ? "-" : formatNumber(value, digits);
}

function gpPerXpDisplay(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "-" : formatNumber(value, 2);
}

function duelDeltaDisplay(value: number | null, digits = 0): string {
  if (value === null) return "-";
  return digits === 0 ? formatDelta(value) : signedDecimal(value, digits);
}

const DUEL_MATRIX_METRICS: ReadonlyArray<{ id: DuelMatrixMetricId; label: string }> = [
  { id: "dps", label: "DPS" },
  { id: "effectiveXpPerHour", label: "XP/hr" },
  { id: "effectiveNetGpPerHour", label: "Net GP/hr" },
  { id: "gpPerXp", label: "GP/XP" }
];

function duelMatrixMetricLabel(metricId: DuelMatrixMetricId): string {
  return DUEL_MATRIX_METRICS.find((metric) => metric.id === metricId)?.label ?? metricId;
}

function duelMatrixMetricDisplay(metricId: DuelMatrixMetricId, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return formatNumber(value, metricId === "dps" || metricId === "gpPerXp" ? 2 : 0);
}

type DuelViewMode = "current-target" | "monster-matrix";

interface BuiltDuelMatrixState {
  model: DuelMatrixViewModel;
  source: {
    form: CombatSetupFormState;
    snapshots: DuelSnapshotsState;
    context: SimulationContext;
    cannonByMonster: CannonByMonsterState;
    lootPrefsByMonster: LootPrefsState;
    lootSettingsByMonster: LootSettingsByMonsterState;
  };
}

function duelSnapshotId(): string {
  return `duel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function localUndoId(): string {
  return `undo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultDuelSnapshotName(
  vm: ReturnType<typeof createSimulationViewModel>,
  snapshotCount: number
): string {
  const setup = vm.monsterCard.setupOverview;
  if (setup.combatStyle === "magic" && setup.spell) return setup.spell.label;
  if (setup.combatStyle === "ranged" && setup.ammo) return setup.ammo.label;
  return setup.weapon.label || `Setup ${snapshotCount + 1}`;
}

function duelRowClass(row: DuelComparisonRowViewModel): string | undefined {
  return row.source === "live" ? "duel-live-row" : undefined;
}

function selectedOptionLabel(options: readonly SelectOption[], ids: readonly string[]): string {
  const value = ids.find((id) => id !== "none") ?? "none";
  return optionLabel(options, value);
}

function moverTone(row: PriceHistoryMoverRow): string | undefined {
  if (row.gpDelta === null || row.gpDelta === 0) return undefined;
  return row.gpDelta > 0 ? "gain" : "loss";
}

function PriceTrendChart({ trend }: { trend: PriceHistoryTrendAnalysis }) {
  if (trend.points.length === 0) {
    return (
      <div className="economy-trend empty" aria-label="Item price trend">
        <div className="section-title-row">
          <h3>Item trend</h3>
          <span className="status-pill">empty</span>
        </div>
        <p>No price points</p>
      </div>
    );
  }

  const width = 720;
  const height = 176;
  const paddingX = 26;
  const paddingTop = 18;
  const paddingBottom = 24;
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;
  const minimum = trend.minimumPrice ?? 0;
  const maximum = trend.maximumPrice ?? minimum;
  const range = Math.max(1, maximum - minimum);
  const denominator = Math.max(1, trend.points.length - 1);
  const points = trend.points.map((point, index) => ({
    ...point,
    x: paddingX + (index / denominator) * plotWidth,
    y: paddingTop + ((maximum - point.price) / range) * plotHeight
  }));
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="economy-trend" aria-label="Item price trend">
      <div className="section-title-row">
        <h3>{trend.itemLabel}</h3>
        <span className="status-pill">{formatNumber(trend.points.length)} points</span>
      </div>
      <dl className="economy-trend-summary">
        <div>
          <dt>Latest</dt>
          <dd>{optionalPrice(trend.latestPrice)}</dd>
        </div>
        <div>
          <dt>Minimum</dt>
          <dd>{optionalPrice(trend.minimumPrice)}</dd>
        </div>
        <div>
          <dt>Maximum</dt>
          <dd>{optionalPrice(trend.maximumPrice)}</dd>
        </div>
        <div>
          <dt>Net change</dt>
          <dd
            className={
              trend.netGpDelta === null || trend.netGpDelta === 0
                ? undefined
                : trend.netGpDelta > 0
                  ? "gain"
                  : "loss"
            }
          >
            {optionalDelta(trend.netGpDelta)} / {optionalPercent(trend.netPercentDelta)}
          </dd>
        </div>
      </dl>
      <svg
        className="economy-trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${trend.itemLabel} price trend`}
      >
        <title>{`${trend.itemLabel} price trend from ${optionalPrice(
          trend.firstPrice
        )} to ${optionalPrice(trend.latestPrice)}`}</title>
        <line
          className="economy-trend-axis"
          x1={paddingX}
          x2={width - paddingX}
          y1={height - paddingBottom}
          y2={height - paddingBottom}
        />
        <polyline className="economy-trend-line" points={linePoints} />
        {points.map((point, index) => (
          <circle
            className="economy-trend-point"
            key={`${point.snapshotKey}-${index}`}
            cx={point.x}
            cy={point.y}
            r="4"
          >
            <title>{`${point.capturedAt}: ${formatNumber(point.price)}`}</title>
          </circle>
        ))}
      </svg>
      <ol className="economy-trend-points" aria-label={`Price points for ${trend.itemLabel}`}>
        {trend.points.map((point, index) => (
          <li key={`${point.snapshotKey}-${index}`}>
            <time dateTime={point.capturedAt}>{point.capturedAt.slice(0, 10)}</time>
            <strong>{formatNumber(point.price)}</strong>
            <span>{optionalDelta(point.gpDeltaFromPrevious)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PriceTrendSparkline({ row }: { row: PriceHistoryMoverRow }) {
  const width = 96;
  const height = 28;
  const padding = 3;
  const minimum = row.trendPrices.length ? Math.min(...row.trendPrices) : 0;
  const maximum = row.trendPrices.length ? Math.max(...row.trendPrices) : minimum;
  const range = Math.max(1, maximum - minimum);
  const denominator = Math.max(1, row.trendPrices.length - 1);
  const points = row.trendPrices.map((price, index) => ({
    price,
    x: padding + (index / denominator) * (width - padding * 2),
    y: padding + ((maximum - price) / range) * (height - padding * 2)
  }));

  if (points.length === 0) return <span>-</span>;

  return (
    <svg
      className="economy-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${row.itemLabel} price trend, ${row.trendPrices.map(formatNumber).join(" to ")}`}
    >
      <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />
      {points.map((point, index) => (
        <circle key={`${point.price}-${index}`} cx={point.x} cy={point.y} r="2" />
      ))}
    </svg>
  );
}

function metric(label: string, value: string, tone?: string) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function metricList(items: DisplayMetric[]) {
  return items.map((item) => (
    <div className="metric" key={item.label}>
      <span>{item.label}</span>
      <strong className={item.tone}>{item.value}</strong>
    </div>
  ));
}

function tripMetricGroup(title: string, items: DisplayMetric[]) {
  return (
    <section className="trip-output-group" aria-label={`${title} trip summary`} key={title}>
      <h3>{title}</h3>
      {metricList(items)}
    </section>
  );
}

function CalculationWarningSummary({
  warnings,
  label,
  title = "Price warnings"
}: {
  warnings: readonly CalculationWarningViewModel[];
  label: string;
  title?: string;
}) {
  if (!warnings.length) return null;
  const visible = warnings.slice(0, 4);
  return (
    <div className="calculation-warnings" role="status" aria-label={label}>
      <strong>{title}</strong>
      {visible.map((warning) => (
        <span className={warning.severity} key={`${warning.code}:${warning.message}`}>
          {warning.message}
        </span>
      ))}
      {warnings.length > visible.length && (
        <span>{formatNumber(warnings.length - visible.length)} more</span>
      )}
    </div>
  );
}

const STATS_SOURCE_DETAIL_METRIC_IDS = {
  "special-attack": [
    "spec-weapon",
    "hits",
    "max-hit",
    "hit-chance",
    "specs-hr",
    "dps-with-spec",
    "dps-gain",
    "dps",
    "xp-hr"
  ],
  cannon: [
    "effective-targets",
    "dps",
    "balls-hr",
    "balls-kill",
    "cannon-ranged-xp-hr",
    "ball-cost-hour",
    "ball-cost-kill",
    "cannonballs-trip",
    "sparse-state",
    "xp-hr",
    "supply-cost-hour",
    "supply-cost-kill"
  ]
} as const;

function statsSourceDetailMetricLabel(
  detail: StatsSourceDetailViewModel,
  metric: StatsSourceDetailViewModel["metrics"][number]
): string {
  if (detail.id === "special-attack" && metric.id === "dps") return "DPS gain";
  if (detail.id === "cannon" && metric.id === "dps") return "Cannon DPS";
  return metric.label;
}

function orderedStatsSourceDetailMetrics(detail: StatsSourceDetailViewModel) {
  const metricById = new Map(detail.metrics.map((metric) => [metric.id, metric]));
  const ids =
    detail.id === "special-attack"
      ? STATS_SOURCE_DETAIL_METRIC_IDS["special-attack"]
      : detail.id === "cannon"
        ? STATS_SOURCE_DETAIL_METRIC_IDS.cannon
        : detail.metrics.map((metric) => metric.id);

  return ids.flatMap((id) => {
    const metric = metricById.get(id);
    return metric ? [metric] : [];
  });
}

function HitDistributionChart({
  distribution,
  ariaLabel,
  showPeakBucket = false
}: {
  distribution: HitDistributionViewModel;
  ariaLabel: string;
  showPeakBucket?: boolean;
}) {
  const summary = [
    { label: "Hit chance", value: distribution.hitChanceLabel, tone: "teal" },
    { label: "Average hit", value: distribution.averageHitLabel },
    { label: "Max hit", value: distribution.maxHitLabel }
  ];
  if (showPeakBucket) {
    summary.push({ label: "Peak bucket", value: formatNumber(distribution.peakMaxHit) });
  }

  return (
    <>
      <div className="hit-distribution-summary">{metricList(summary)}</div>
      <div className="hit-histogram" role="list" aria-label={ariaLabel}>
        {distribution.buckets.map((bucket) => (
          <div
            className={`hit-bucket ${bucket.isMiss ? "miss" : ""} ${
              bucket.isMaxHit ? "max-hit" : ""
            }`}
            role="listitem"
            aria-label={bucket.ariaLabel}
            key={bucket.id}
          >
            <span className="hit-bucket-label">{bucket.label}</span>
            <span className="hit-bucket-bar" aria-hidden="true">
              <span style={{ width: `${bucket.widthPercent}%` }} />
            </span>
            <strong>{bucket.percentLabel}</strong>
            {bucket.isMaxHit && <em>max hit</em>}
          </div>
        ))}
      </div>
    </>
  );
}

function StatsSourceDetailCard({ detail }: { detail: StatsSourceDetailViewModel }) {
  const metrics = orderedStatsSourceDetailMetrics(detail);

  return (
    <article
      className={`source-detail-card ${detail.status}`}
      role="listitem"
      aria-label={`${detail.label} detail: ${detail.statusLabel}`}
    >
      <div className="source-detail-heading">
        <div>
          <h3>{detail.label} detail</h3>
          <span>{detail.statusLabel}</span>
        </div>
      </div>
      <div className="source-detail-metrics">
        {metrics.map((metric) => (
          <div key={metric.id}>
            <span>{statsSourceDetailMetricLabel(detail, metric)}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
      <CalculationWarningSummary
        warnings={detail.warnings}
        label={`${detail.label} source warnings`}
        title={`${detail.label} note`}
      />
      {detail.notes.length > 0 ? (
        <ul className="source-detail-notes">
          {detail.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
      {detail.histogram && detail.histogramScopeLabel ? (
        <section
          className="source-detail-distribution"
          aria-label={`${detail.label} damage distribution`}
        >
          <div className="source-detail-distribution-heading">
            <h4>Damage distribution</h4>
            <span>{detail.histogramScopeLabel}</span>
          </div>
          <HitDistributionChart
            distribution={detail.histogram}
            ariaLabel={`${detail.label} damage distribution buckets`}
          />
        </section>
      ) : null}
    </article>
  );
}

function StatsCombatRollDetail({ detail }: { detail: StatsCombatRollDetailViewModel }) {
  return (
    <section className="stats-panel combat-roll-panel" aria-label="Combat roll details">
      <div className="section-title-row">
        <div>
          <h2>Combat roll details</h2>
          <span className="section-subtitle">Normal attack and current result metrics</span>
        </div>
        <span className={`status-pill ${detail.status === "modeled" ? "ready" : ""}`}>
          {detail.statusLabel}
        </span>
      </div>
      <div className="combat-roll-grid" role="list" aria-label="Combat roll metrics">
        {detail.metrics.map((metric) => (
          <div
            className={`combat-roll-metric ${metric.tone}`}
            role="listitem"
            aria-label={`${metric.label}: ${metric.value}; ${metric.note}`}
            key={metric.id}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </div>
        ))}
      </div>
      <ul className="combat-roll-notes">
        {detail.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

function ActiveAssumptionsSummary({
  summary,
  onReview,
  onReset
}: {
  summary: ActiveAssumptionsSummaryViewModel;
  onReview: (tab: ActiveAssumptionReviewTarget) => void;
  onReset: (target: ActiveAssumptionResetTarget, statusLabel: string) => void;
}) {
  const renderRow = (row: ActiveAssumptionsSummaryViewModel["visibleRows"][number]) => {
    const resetAction = row.resetAction;
    return (
      <li className={`active-assumption-row ${row.tone}`} key={row.id}>
        <div className="active-assumption-copy">
          <strong>{row.label}</strong>
          <span>{row.detail}</span>
        </div>
        <em>{row.value}</em>
        <div className="active-assumption-actions">
          <button
            type="button"
            className="compact-action"
            aria-label={`Review ${row.label}`}
            onClick={() => onReview(row.reviewTab)}
          >
            Review
          </button>
          {resetAction ? (
            <button
              type="button"
              className="compact-action"
              aria-label={resetAction.ariaLabel}
              onClick={() => onReset(resetAction.target, resetAction.statusLabel)}
            >
              {resetAction.label}
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <section className="active-assumptions-summary" aria-label="Active assumptions">
      <div className="section-title-row">
        <div>
          <h2>Active assumptions</h2>
          <span className="section-subtitle">Modifiers affecting current result</span>
        </div>
        <span className={`status-pill ${summary.hasActiveRows ? "ready" : ""}`}>
          {summary.statusLabel}
        </span>
      </div>

      {summary.hasActiveRows ? (
        <>
          <ul className="active-assumption-list">{summary.visibleRows.map(renderRow)}</ul>
          {summary.hiddenRows.length > 0 ? (
            <details className="active-assumption-more">
              <summary>+{formatNumber(summary.hiddenCount)} more</summary>
              <ul className="active-assumption-list">{summary.hiddenRows.map(renderRow)}</ul>
            </details>
          ) : null}
        </>
      ) : (
        <p className="active-assumptions-empty">{summary.statusLabel}</p>
      )}
    </section>
  );
}

function PendingUndoStatus({
  pendingUndo,
  onUndo
}: {
  pendingUndo: PendingUndo | null;
  onUndo: () => void;
}) {
  if (!pendingUndo) return null;
  return (
    <section
      className="pending-undo-strip"
      role="status"
      aria-live="polite"
      aria-label="Local state undo"
    >
      <span>{pendingUndo.label}</span>
      <button type="button" onClick={onUndo}>
        Undo
      </button>
    </section>
  );
}

function MonsterCardPanel({
  card,
  monsterOptions,
  selectedMonsterId,
  dropFilter,
  onTargetChange,
  onDropFilterChange
}: {
  card: MonsterCardViewModel;
  monsterOptions: SelectOption[];
  selectedMonsterId: string;
  dropFilter: string;
  onTargetChange: (monsterId: string) => void;
  onDropFilterChange: (value: string) => void;
}) {
  const dropFilterId = useId();
  const setup = card.setupOverview;
  const setupRows: DisplayMetric[] = [
    { label: "Weapon", value: setup.weapon.label },
    setup.ammo ? { label: "Ammo", value: setup.ammo.label } : null,
    setup.spell ? { label: "Spell", value: setup.spell.label } : null,
    { label: "Style", value: setup.styleLabel },
    {
      label: "Attack type",
      value: setup.attackType ? setup.attackType.toString() : "-"
    },
    { label: "Prayer", value: selectedOptionLabel(PRAYER_OPTIONS, setup.prayerIds) },
    { label: "Boost", value: selectedOptionLabel(BOOST_OPTIONS, setup.boostIds) },
    { label: "Speed", value: `${formatNumber(setup.attackSpeedSec, 1)}s` },
    { label: "Accuracy", value: signedInteger(setup.accuracyBonus) },
    { label: "Damage", value: signedInteger(setup.damageBonus) },
    { label: "Sustained", value: yesNo(setup.sustained) },
    { label: "Ring", value: setup.ring?.label ?? "-" }
  ].filter((row): row is DisplayMetric => row !== null);

  return (
    <aside className="monster-rail" aria-label="Monster card">
      <section className="monster-card-panel">
        <div className="section-title-row">
          <div>
            <h2>{card.monsterName}</h2>
            <span className="monster-card-subtitle">{card.monsterId}</span>
          </div>
          <span
            className={`status-pill ${card.setupBadge.tone === "custom" ? "ready" : ""}`}
            aria-label="Current setup state"
          >
            {card.setupBadge.label}
          </span>
        </div>

        <div className="monster-card-controls" aria-label="Monster target controls">
          <SearchableSelectField
            label="Target"
            value={selectedMonsterId}
            options={monsterOptions}
            onChange={onTargetChange}
            searchPlaceholder="Search monsters"
          />
          <div className="field">
            <label htmlFor={dropFilterId}>Drop filter</label>
            <input
              id={dropFilterId}
              type="search"
              value={dropFilter}
              placeholder="Drop"
              onChange={(event) => onDropFilterChange(event.target.value)}
            />
          </div>
        </div>

        <section className="monster-card-section" aria-label="Monster stats">
          <h3>Stats</h3>
          <dl className="monster-stat-grid">
            {card.stats.map((stat) => (
              <div key={stat.key} className={stat.missing ? "missing" : undefined}>
                <dt>{stat.label}</dt>
                <dd>{optionalNumber(stat.value)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="monster-card-section" aria-label="Monster defence">
          <h3>Defence</h3>
          <ul className="monster-defence-list">
            {card.defenceRows.map((row) => (
              <li
                key={row.key}
                className={row.active ? "active" : undefined}
                aria-current={row.active ? "true" : undefined}
                data-defence-key={row.key}
              >
                <span>{row.label}</span>
                <strong>{optionalNumber(row.value)}</strong>
                {row.active && <em>Active</em>}
              </li>
            ))}
          </ul>
        </section>

        <section className="monster-card-section" aria-label="Monster setup overview">
          <h3>Setup overview</h3>
          <dl className="monster-setup-grid">
            {setupRows.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </section>
    </aside>
  );
}

function legacyMigrationSummaryItems(report: LegacySetupMigrationReport): string[] {
  const foundKeys = new Set(report.foundKeys);
  const pricesFound = report.foundKeys.some((key) => LEGACY_PRICE_STORAGE_KEYS.has(key));
  const compareFound = foundKeys.has("sim_compare_sort_v1") || foundKeys.has("sim_irrelevant_v1");
  const historyFound = report.keyReview.some(
    (item) => item.found && item.key.startsWith("sim_price_history")
  );
  const customSetupsFound =
    report.customSetupsByMonster != null ||
    report.skippedFields.some((field) => field.field.startsWith("sim_input_v3.monsterSetups"));
  const cannonMapFound =
    report.cannonByMonster != null ||
    report.skippedFields.some((field) => field.field.startsWith("sim_input_v3.cannonByMonster"));
  const duelSnapshotsFound =
    report.duelSnapshots != null ||
    report.skippedFields.some((field) => field.field.startsWith("sim_input_v3.duelSetups"));
  const reviewNeeded = report.keyReview.some(
    (item) => item.found && item.disposition !== "migrate"
  );
  return [
    report.setup
      ? "Legacy setup ready"
      : foundKeys.has(LEGACY_INPUT_STORAGE_KEY)
        ? "Legacy setup skipped"
        : "No legacy setup",
    report.hiscoresPlayer
      ? "Hiscores player ready"
      : foundKeys.has("sim_hiscore_player")
        ? "Hiscores player skipped"
        : "No hiscores player",
    report.lootPrefs != null
      ? "Loot preferences ready"
      : foundKeys.has("sim_loot_prefs_v1")
        ? "Loot preferences skipped"
        : "No loot preferences",
    report.customSetupsByMonster != null
      ? "Custom setups ready"
      : customSetupsFound
        ? "Custom setups skipped"
        : "No custom setups",
    report.cannonByMonster != null
      ? "Cannon map ready"
      : cannonMapFound
        ? "Cannon map skipped"
        : "No cannon map",
    report.duelSnapshots != null
      ? "Duel snapshots ready"
      : duelSnapshotsFound
        ? "Duel snapshots skipped"
        : "No Duel snapshots",
    report.hiddenGearTiers != null
      ? "Hidden gear tiers ready"
      : foundKeys.has("sim_hidden_tiers_v1")
        ? "Hidden gear tiers skipped"
        : "No hidden gear tiers",
    report.denseCompareSort != null || report.irrelevantMonsterIds != null
      ? "Compare state ready"
      : compareFound
        ? "Compare state skipped"
        : "No compare state",
    report.priceSet ? "Prices ready" : pricesFound ? "Prices skipped" : "No prices",
    historyFound ? "Price history review-only" : "No price history",
    foundKeys.has("sim_planner_v1") ? "Planner review-only" : "No planner data",
    reviewNeeded || report.skippedFields.length > 0
      ? "Review-only decisions shown"
      : "No review-only data"
  ];
}

function legacyDispositionLabel(disposition: LegacyStorageKeyMigrationDisposition): string {
  if (disposition === "migrate") return "migrate";
  if (disposition === "review-only") return "review only";
  if (disposition === "intentional-reset") return "intentional reset";
  return "legacy-only";
}

function legacyMigrationImportPlan(report: LegacySetupMigrationReport): string[] {
  const items: string[] = [];
  if (report.setup) items.push("Compatible setup fields into rewrite setup");
  if (report.customSetupsByMonster != null) {
    items.push("Legacy custom setups into rewrite monster-specific setups");
  }
  if (report.cannonByMonster != null) {
    items.push("Legacy cannon map into rewrite per-monster cannon settings");
  }
  if (report.duelSnapshots != null) {
    items.push("Legacy Duel snapshots into rewrite Duel snapshot storage");
  }
  if (report.lootPrefs != null) {
    items.push("Loot preferences into rewrite per-monster drop actions");
  }
  if (report.hiddenGearTiers != null) {
    items.push("Hidden gear tiers into rewrite gear-menu preferences");
  }
  if (report.denseCompareSort != null) items.push("Compare sort into dense compare state");
  if (report.irrelevantMonsterIds != null) {
    items.push("Compare hidden monsters into dense compare state");
  }
  if (report.hiscoresPlayer) items.push("Validated hiscores player into last-player storage");
  if (report.priceSet) items.push("Validated current price/alch maps as a PriceSet snapshot");
  return items;
}

function legacyMigrationReviewPlan(report: LegacySetupMigrationReport): string[] {
  const reviewItems = report.keyReview
    .filter((item) => item.found && item.disposition !== "migrate")
    .map((item) => `${item.key}: ${legacyDispositionLabel(item.disposition)} - ${item.reason}`);
  const skippedItems = report.skippedFields.map((field) => {
    const disposition = field.disposition ? `${legacyDispositionLabel(field.disposition)} - ` : "";
    const handling = field.handling ? `${field.handling} ` : "";
    return `${field.field}: ${disposition}${handling}${field.reason}`;
  });
  return [...reviewItems, ...skippedItems];
}

function countSkippedLegacyFields(report: LegacySetupMigrationReport, prefix: string): number {
  return report.skippedFields.filter((field) => field.field.startsWith(prefix)).length;
}

function countFoundLegacyKeys(
  report: LegacySetupMigrationReport,
  predicate: (key: LegacyStorageKey) => boolean
): number {
  return report.foundKeys.filter(predicate).length;
}

function legacyMigrationOutcomeItems(report: LegacySetupMigrationReport): string[] {
  const importPlan = legacyMigrationImportPlan(report);
  const customSetupImportCount = Object.keys(report.customSetupsByMonster ?? {}).length;
  const customSetupSkipCount = countSkippedLegacyFields(report, "sim_input_v3.monsterSetups");
  const cannonImportCount = Object.keys(report.cannonByMonster ?? {}).length;
  const cannonSkipCount = countSkippedLegacyFields(report, "sim_input_v3.cannonByMonster");
  const duelSnapshotImportCount = report.duelSnapshots?.snapshots.length ?? 0;
  const duelSnapshotSkipCount = countSkippedLegacyFields(report, "sim_input_v3.duelSetups");
  const reviewOnlyKeyCount = report.keyReview.filter(
    (item) => item.found && item.disposition === "review-only"
  ).length;
  const clearKeyCount = report.keyReview.filter((item) => item.clearDeletes).length;
  const priceHistoryKeyCount = countFoundLegacyKeys(report, (key) =>
    key.startsWith("sim_price_history")
  );
  const skippedCount = report.skippedFields.length;
  const items: string[] = [];

  items.push(
    `Import action: ${formatNumber(importPlan.length)} compatible area${
      importPlan.length === 1 ? "" : "s"
    } ready; legacy keys stay in storage.`
  );
  items.push(
    `Skipped status: ${formatNumber(skippedCount)} sanitized skip reason${
      skippedCount === 1 ? "" : "s"
    } shown below.`
  );
  items.push(
    `Review-only status: ${formatNumber(reviewOnlyKeyCount)} found key${
      reviewOnlyKeyCount === 1 ? "" : "s"
    } kept unless Clear is confirmed.`
  );
  if (customSetupImportCount > 0 || customSetupSkipCount > 0) {
    items.push(
      `Custom setups: ${formatNumber(customSetupImportCount)} importable, ${formatNumber(
        customSetupSkipCount
      )} skipped.`
    );
  }
  if (cannonImportCount > 0 || cannonSkipCount > 0) {
    items.push(
      `Cannon map: ${formatNumber(cannonImportCount)} importable, ${formatNumber(
        cannonSkipCount
      )} skipped.`
    );
  }
  if (duelSnapshotImportCount > 0 || duelSnapshotSkipCount > 0) {
    items.push(
      `Duel snapshots: ${formatNumber(duelSnapshotImportCount)} importable, ${formatNumber(
        duelSnapshotSkipCount
      )} skipped.`
    );
  }
  if (report.foundKeys.includes("sim_planner_v1")) {
    items.push(
      "Rewrite Planner V1 does not import legacy Planner state; Import and Keep leave it in legacy storage."
    );
  }
  if (priceHistoryKeyCount > 0) {
    items.push(
      `Full legacy price history is review-only in V1; ${formatNumber(
        priceHistoryKeyCount
      )} history key${priceHistoryKeyCount === 1 ? "" : "s"} detected and not migrated.`
    );
  }
  items.push(
    `Keep action: dismisses this review and keeps ${formatNumber(report.foundKeys.length)} found legacy key${
      report.foundKeys.length === 1 ? "" : "s"
    } untouched.`
  );
  items.push(
    `Clear action: deletes ${formatNumber(clearKeyCount)} known legacy key${
      clearKeyCount === 1 ? "" : "s"
    } only after confirmation; unknown keys are not touched.`
  );
  return items;
}

function mergeLootPrefsState(current: LootPrefsState, imported: LootPrefsState): LootPrefsState {
  const next: LootPrefsState = { ...current };
  for (const [monsterId, prefs] of Object.entries(imported)) {
    next[monsterId] = {
      ...(next[monsterId] ?? {}),
      ...prefs
    };
  }
  return LootPrefsStateSchema.parse(next);
}

function legacyClearKeyList(report: LegacySetupMigrationReport): string {
  return report.keyReview
    .filter((item) => item.clearDeletes)
    .map((item) => item.key)
    .join(", ");
}

function legacyMigrationTone(report: LegacySetupMigrationReport, hasRewriteSetup: boolean): string {
  if (!hasRewriteSetup && report.foundKeys.includes(LEGACY_INPUT_STORAGE_KEY)) return "ready";
  return "";
}

function describeHiscoresError(error: unknown): string {
  if (error instanceof HiscoresAdapterError) {
    if (error.code === "bad-request") return "Check the player name";
    if (error.code === "not-found") return "Player not found";
    if (error.code === "rate-limited") {
      return error.retryAfterSeconds
        ? `Rate limited. Try again in ${error.retryAfterSeconds}s`
        : "Rate limited";
    }
    if (error.code === "upstream-unavailable") return hiscoresUnavailableMessage(null);
    if (error.code === "upstream-invalid") return "Hiscores response invalid";
  }
  return "Hiscores lookup failed. Player level fields still work for manual edits.";
}

function describeMarketError(error: unknown): string {
  if (error instanceof MarketAdapterError) {
    if (error.code === "bad-request") return "Check the market price request";
    if (error.code === "not-found") return "Market price data not found";
    if (error.code === "rate-limited") {
      return error.retryAfterSeconds
        ? `Rate limited. Try again in ${error.retryAfterSeconds}s`
        : "Rate limited";
    }
    if (error.code === "upstream-unavailable") return marketUnavailableMessage(null);
    if (error.code === "upstream-invalid") return "Market price response invalid";
  }
  return "Market price data check failed. Bundled, scheduled and imported PriceSets still work.";
}

function sanitizeImportDetail(value: string): string {
  return value
    .replace(/(?:[A-Za-z]:)?[\\/][^\s"']+/g, "[path]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function formatZodIssuePath(path: PropertyKey[]): string {
  return path.length > 0 ? path.map(String).join(".") : "setup";
}

function zodIssueSummaries(error: ZodError): string[] {
  return error.issues.slice(0, 3).map((issue) => {
    const path = formatZodIssuePath(issue.path);
    const message = sanitizeImportDetail(issue.message);
    return `${path}: ${message}`;
  });
}

function describeSetupImportError(error: unknown): SetupImportNotice {
  if (error instanceof SyntaxError) {
    return { tone: "error", message: "Setup import failed: the file is not valid JSON." };
  }

  if (error instanceof Error && /^File exceeds \d+ bytes$/.test(error.message)) {
    return {
      tone: "error",
      message:
        "Setup import failed: the file is too large. Choose an exported setup JSON under 250 KB."
    };
  }

  if (error instanceof ZodError) {
    const details = zodIssueSummaries(error);
    const hasVersionIssue = error.issues.some((issue) => issue.path[0] === "version");
    if (hasVersionIssue) {
      return {
        tone: "error",
        message: `Setup import failed: this app only supports rewrite setup version ${REWRITE_SETUP_VERSION}. Export a fresh setup and try again.`,
        details
      };
    }
    return {
      tone: "error",
      message: "Setup import failed: the file is not a valid rewrite setup export.",
      details
    };
  }

  return { tone: "error", message: "Setup import failed. Check the file and try again." };
}

function describeShareableSetupError(error: unknown): string {
  if (error instanceof ShareableSetupError) {
    if (error.code === "body_too_large") return "Shared setup link is too large.";
    if (error.code === "duplicate_keys") return "Shared setup link contains duplicate data.";
    if (error.code === "unsupported_version") {
      return "Shared setup link uses an unsupported version.";
    }
    if (error.code === "incompatible_entities") {
      return "Shared setup references data unavailable in this game version.";
    }
  }
  return "Shared setup link is invalid and was not loaded.";
}

function describeDuelSnapshotsImportError(error: unknown): SetupImportNotice {
  const code =
    error instanceof DuelSnapshotsImportError
      ? error.code
      : error instanceof Error && /^File exceeds \d+ bytes$/.test(error.message)
        ? "body_too_large"
        : null;

  if (code === "body_too_large") {
    return {
      tone: "error",
      message: "Duel import failed: choose a Duel snapshot export under 250 KB."
    };
  }
  if (code === "invalid_json") {
    return { tone: "error", message: "Duel import failed: the file is not valid JSON." };
  }
  if (code === "unsupported_version") {
    return {
      tone: "error",
      message: `Duel import failed: this app only supports Duel snapshot version ${DUEL_SNAPSHOTS_VERSION}.`
    };
  }
  return {
    tone: "error",
    message: "Duel import failed: the file is not a valid Duel snapshot export."
  };
}

function statusText(
  status: HiscoresStatusResponse | MarketStatusResponse | null,
  available: boolean
): string {
  if (status === null) return "checking";
  if (available) return "available";
  return status.source.id === "disabled" ? "disabled" : "unavailable";
}

function hiscoresUnavailableMessage(status: HiscoresStatusResponse | null): string {
  return status?.source.id === "disabled"
    ? "Live hiscores lookup is not configured in this run. Use the Player level fields above to edit levels manually."
    : "Hiscores lookup is unavailable right now. Use the Player level fields above to edit levels manually.";
}

function marketUnavailableMessage(status: MarketStatusResponse | null): string {
  return status?.source.id === "disabled"
    ? "Market upstream refresh is scheduled, not user-triggered. Import a PriceSet file to override prices locally."
    : "Market price service is unavailable right now. Scheduled, bundled and imported PriceSets still work.";
}

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CompactSelectionSelectField({
  label,
  value,
  options,
  extraCount,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  extraCount: number;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="field compact-selection-field">
      <label htmlFor={id}>{label}</label>
      <div className="compact-selection-control">
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {extraCount > 0 && (
          <span className="selection-extra-badge" aria-label={`${extraCount} additional active`}>
            +{formatNumber(extraCount)}
          </span>
        )}
      </div>
    </div>
  );
}

function MultiSelectionField({
  label,
  options,
  selectedIds,
  onToggle
}: {
  label: string;
  options: readonly SetupSelectionOption[];
  selectedIds: readonly string[];
  onToggle: (id: string, selected: boolean) => void;
}) {
  const selectedCount = selectedIds.length;
  return (
    <div className="selection-toggle-group">
      <div className="selection-toggle-header">
        <span>{label}</span>
        <span className={`status-pill ${selectedCount ? "ready" : ""}`}>
          {selectedCount ? `${formatNumber(selectedCount)} active` : "None"}
        </span>
      </div>
      <div className="multi-selection-grid" aria-label={`${label} selections`}>
        <label className="toggle">
          <input
            type="checkbox"
            checked={selectedCount === 0}
            onChange={(event) => onToggle("none", event.target.checked)}
          />
          <span>None</span>
        </label>
        {options.map((option) => (
          <label className="toggle selection-toggle" key={option.id}>
            <input
              type="checkbox"
              checked={selectedIds.includes(option.id)}
              onChange={(event) => onToggle(option.id, event.target.checked)}
            />
            <span>{option.label}</span>
            <small>{option.categoryLabel}</small>
          </label>
        ))}
      </div>
    </div>
  );
}

function SearchableSelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  searchPlaceholder = "Search"
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  searchPlaceholder?: string;
}) {
  const id = useId();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const selectedOption = options.find((option) => option.id === value);
  const filteredOptions =
    normalizedQuery.length === 0
      ? options
      : options.filter((option) =>
          [option.label, option.id, option.hint ?? ""]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery)
        );
  const visibleOptions =
    selectedOption && !filteredOptions.some((option) => option.id === selectedOption.id)
      ? [selectedOption, ...filteredOptions]
      : filteredOptions;

  return (
    <div className="field searchable-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={searchId}
        type="search"
        value={query}
        placeholder={searchPlaceholder}
        disabled={disabled}
        aria-label={`${label} search`}
        onChange={(event) => setQuery(event.target.value)}
      />
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {visibleOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.hint ? `${option.label} - ${option.hint}` : option.label}
          </option>
        ))}
      </select>
      <span className="field-hint">
        {formatNumber(visibleOptions.length)} / {formatNumber(options.length)}
      </span>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(numberValue(event.target.value, value, min, max))}
      />
    </div>
  );
}

function DecimalField({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  step = 0.05,
  disabled = false
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(stepDecimalValue(event.target.value, value, min, max, step))}
      />
    </div>
  );
}

function OptionalNumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  resetLabel = "Reset"
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
  resetLabel?: string;
}) {
  const id = useId();
  return (
    <div className="field optional-number-field">
      <label htmlFor={id}>{label}</label>
      <div className="optional-number-control">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(event) => {
            const rawValue = event.target.value;
            if (rawValue.trim() === "") {
              onChange(null);
              return;
            }
            const parsed =
              step === 1 ? numberValue(rawValue, 0, min, max) : decimalValue(rawValue, 0, min, max);
            onChange(parsed);
          }}
        />
        <button type="button" disabled={value == null} onClick={() => onChange(null)}>
          {resetLabel}
        </button>
      </div>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  disabled = false
}: {
  label: string;
  value: string;
  disabled?: boolean;
}) {
  return (
    <div className={`field readonly-field ${disabled ? "disabled" : ""}`}>
      <span>{label}</span>
      <output>{value}</output>
    </div>
  );
}

function localStateStatusLabel(item: LocalStateHealthItem): string {
  if (item.status === "loaded") return "Loaded";
  if (item.status === "missing") return "Not saved";
  if (item.status === "version-mismatch") return "Unsupported version";
  if (item.status === "unavailable") return "Storage unavailable";
  if (item.status === "save-failed") return "Save failed";
  return "Invalid";
}

function localStateReasonLabel(item: LocalStateHealthItem): string {
  if (item.status === "missing") return "Using defaults until this state is saved.";
  if (item.status === "loaded") return "Local data is valid.";
  if (item.status === "unavailable") {
    return "Local storage could not be read. Defaults are active and changes may not persist after reload.";
  }
  if (item.status === "save-failed") {
    return item.reason === "clear_failed"
      ? "Local storage could not be cleared. Current session data remains active, but reload may restore the saved state."
      : "Local storage could not be saved. Current session data remains active, but changes may not persist after reload.";
  }
  if (item.status === "version-mismatch") {
    return `Found v${formatNumber(item.foundVersion ?? 0)}, expected v${formatNumber(
      item.expectedVersion
    )}. Defaults are active until this key is cleared or replaced.`;
  }
  if (item.reason === "body_too_large") {
    return "Saved data is too large. Defaults are active until this key is cleared or replaced.";
  }
  if (item.reason === "invalid_json") {
    return "Saved data is not valid JSON. Defaults are active until this key is cleared or replaced.";
  }
  if (item.reason === "invalid_envelope") {
    return "Saved metadata is invalid. Defaults are active until this key is cleared or replaced.";
  }
  return "Saved data failed validation. Defaults are active until this key is cleared or replaced.";
}

function localStateHealthExportFileName(report: LocalStateHealthReport): string {
  const safeTimestamp = report.generatedAt.replace(/[^0-9A-Za-z._-]+/g, "-");
  return `index-sim-local-state-health-${safeTimestamp}.json`;
}

function localStateRecoveryStatus(report: LocalStateHealthReport): string {
  return report.hasAttention ? `${formatNumber(report.attentionCount)} need attention` : "Healthy";
}

export function App() {
  const [context, setContext] = useState<SimulationContext | null>(null);
  const [initialSavedSetup] = useState(loadInitialSavedSetup);
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
  const [duelSnapshots, setDuelSnapshots] = useState<DuelSnapshotsState>(loadInitialDuelSnapshots);
  const [duelViewMode, setDuelViewMode] = useState<DuelViewMode>("current-target");
  const [expandedDuelDiffId, setExpandedDuelDiffId] = useState<string | null>(null);
  const [duelMatrixMetric, setDuelMatrixMetric] =
    useState<DuelMatrixMetricId>("effectiveXpPerHour");
  const [duelMatrixFilter, setDuelMatrixFilter] = useState("");
  const [duelMatrixBuild, setDuelMatrixBuild] = useState<BuiltDuelMatrixState | null>(null);
  const [duelMatrixBusy, setDuelMatrixBusy] = useState(false);
  const [priceHistory, setPriceHistory] =
    useState<BrowserPriceHistoryState>(loadInitialPriceHistory);
  const [bundledPriceSet, setBundledPriceSet] = useState<PriceSet | null>(null);
  const [scheduledSnapshotStatus, setScheduledSnapshotStatus] =
    useState<ScheduledStaticPriceSnapshotStatus | null>(null);
  const [activePriceSetOrigin, setActivePriceSetOrigin] = useState<ActivePriceSetOrigin>("bundled");
  const [plannerState, setPlannerState] = useState<PlannerUiState>(loadInitialPlannerUiState);
  const [plannerComputedState, setPlannerComputedState] =
    useState<PlannerUiState>(loadInitialPlannerUiState);
  const [legacyMigrationDismissed, setLegacyMigrationDismissed] = useState(
    loadInitialLegacyMigrationDismissed
  );
  const [legacyClearPending, setLegacyClearPending] = useState(false);
  const [localStateHealthReport, setLocalStateHealthReport] = useState<LocalStateHealthReport>(
    () => initialLocalStateHealthReport
  );
  const [localStateRecoveryBlockedIds, setLocalStateRecoveryBlockedIds] = useState<
    LocalStateHealthItemId[]
  >(() => initialLocalStateRecoveryBlockedIds);
  const [localStateClearPendingId, setLocalStateClearPendingId] = useState<
    LocalStateHealthItemId | "invalid-all" | null
  >(null);
  const [localStateStorageFailures, setLocalStateStorageFailures] = useState<
    LocalStateStorageFailure[]
  >([]);
  const [priceAgeNowMs, setPriceAgeNowMs] = useState(() => Date.now());
  const [localStateRecoveryNotice, setLocalStateRecoveryNotice] = useState<string | null>(() =>
    localStorageAccessUnavailable ? LOCAL_STATE_PERSISTENCE_NOTICE : null
  );
  const skipNextLocalStatePersistRef = useRef<Set<LocalStateHealthItemId>>(new Set());
  const [readyToPersist, setReadyToPersist] = useState(false);
  const [status, setStatus] = useState("Loading source-backed runtime data");
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [setupImportNotice, setSetupImportNotice] = useState<SetupImportNotice | null>(null);
  const [receivedShareableSetupPayload] = useState(captureBrowserShareableSetupFragment);
  const [shareReviewDismissed, setShareReviewDismissed] = useState(false);
  const [shareDialog, setShareDialog] = useState<ShareSetupDialogState | null>(null);
  const [shareCreateNotice, setShareCreateNotice] = useState<string | null>(null);
  const [duelImportNotice, setDuelImportNotice] = useState<SetupImportNotice | null>(null);
  const [priceImportNotice, setPriceImportNotice] = useState<ScopedPriceImportNotice | null>(null);
  const [priceLabel, setPriceLabel] = useState(
    "Scheduled static prices + generated item fallbacks"
  );
  const [hiscoresStatus, setHiscoresStatus] = useState<HiscoresStatusResponse | null>(null);
  const [hiscoresPlayer, setHiscoresPlayer] = useState(() => loadLastHiscoresPlayer(storage));
  const [hiscoresResponse, setHiscoresResponse] = useState<HiscoresResponse | null>(null);
  const [hiscoresBusy, setHiscoresBusy] = useState(false);
  const [hiscoresNotice, setHiscoresNotice] = useState<{
    tone: "neutral" | "success" | "error";
    message: string;
  } | null>(null);
  const hiscoresPlayerRef = useRef(hiscoresPlayer);
  const hiscoresLookupSequenceRef = useRef(0);
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
  const [priceSetResetPending, setPriceSetResetPending] = useState(false);
  const [lootNotice, setLootNotice] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [activeTab, setActiveTab] = useState<WorkbenchTabId>("compare");
  const shareSetupButtonRef = useRef<HTMLButtonElement>(null);
  const heavyForm = useDebouncedValue(form, 250);
  const localStateRecoveryBlocked = (itemId: LocalStateHealthItemId): boolean =>
    localStateRecoveryBlockedIds.includes(itemId);
  const shouldSkipLocalStatePersist = (itemId: LocalStateHealthItemId): boolean => {
    if (skipNextLocalStatePersistRef.current.has(itemId)) {
      skipNextLocalStatePersistRef.current.delete(itemId);
      return true;
    }
    return localStateRecoveryBlocked(itemId);
  };
  const refreshLocalStateHealthReport = (
    storageFailures: readonly LocalStateStorageFailure[] = localStateStorageFailures
  ): LocalStateHealthReport => {
    const report = createLocalStateHealthReport(storage, new Date(), {
      storageUnavailable: localStorageAccessUnavailable,
      storageFailures
    });
    setLocalStateHealthReport(report);
    return report;
  };
  const recordLocalStateStorageFailure = (
    itemId: LocalStateHealthItemId,
    reason: LocalStateStorageFailure["reason"]
  ): void => {
    setLocalStateStorageFailures((current) => {
      return [...current.filter((failure) => failure.id !== itemId), { id: itemId, reason }];
    });
    setLocalStateRecoveryNotice(LOCAL_STATE_PERSISTENCE_NOTICE);
    setStatus(LOCAL_STATE_PERSISTENCE_NOTICE);
  };
  const clearLocalStateStorageFailures = (itemIds: readonly LocalStateHealthItemId[]): void => {
    if (!itemIds.length) return;
    setLocalStateStorageFailures((current) => {
      const next = current.filter((failure) => !itemIds.includes(failure.id));
      return next;
    });
  };
  const persistLocalState = <T,>(
    itemId: LocalStateHealthItemId,
    options: VersionedStorageOptions<T>,
    value: T
  ): boolean => {
    const result = trySavePersisted(options, value);
    if (result.status === "saved") {
      if (localStorageAccessUnavailable) {
        setLocalStateRecoveryNotice(LOCAL_STATE_PERSISTENCE_NOTICE);
        setStatus(LOCAL_STATE_PERSISTENCE_NOTICE);
        return false;
      }
      clearLocalStateStorageFailures([itemId]);
      return true;
    }
    recordLocalStateStorageFailure(itemId, result.reason);
    return false;
  };
  const releaseLocalStateRecoveryBlocks = (itemIds: readonly LocalStateHealthItemId[]): void => {
    if (!itemIds.length) return;
    for (const itemId of itemIds) skipNextLocalStatePersistRef.current.add(itemId);
    setLocalStateRecoveryBlockedIds((current) =>
      current.filter((itemId) => !itemIds.includes(itemId))
    );
  };
  const unblockReplacedLocalState = (itemIds: readonly LocalStateHealthItemId[]): void => {
    if (!itemIds.length) return;
    setLocalStateRecoveryBlockedIds((current) =>
      current.filter((itemId) => !itemIds.includes(itemId))
    );
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- Storage failures are external-system state and this effect refreshes their sanitized UI report. */
  useEffect(() => {
    refreshLocalStateHealthReport(localStateStorageFailures);
  }, [localStateStorageFailures]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  useEffect(() => {
    const timerId = window.setInterval(() => setPriceAgeNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    hiscoresPlayerRef.current = hiscoresPlayer;
  }, [hiscoresPlayer]);

  useEffect(() => {
    let cancelled = false;
    fetchHiscoresStatus()
      .then((result) => {
        if (cancelled) return;
        setHiscoresStatus(result);
        setHiscoresNotice(
          result.available ? null : { tone: "neutral", message: hiscoresUnavailableMessage(result) }
        );
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setHiscoresStatus(null);
        setHiscoresNotice({ tone: "error", message: describeHiscoresError(caught) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMarketStatus()
      .then((result) => {
        if (cancelled) return;
        setMarketNotice(
          result.available ? null : { tone: "neutral", message: marketUnavailableMessage(result) }
        );
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setMarketNotice({ tone: "error", message: describeMarketError(caught) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadGeneratedRuntimeContext()
      .then(async (result) => {
        if (cancelled) return;
        const bundledContext = result.context;
        const selectedPriceSet = loadSelectedPriceSet(storage);
        const restoredPriceSet =
          selectedPriceSet.status === "loaded"
            ? withGeneratedAlchAuthority(selectedPriceSet.value.priceSet, bundledContext.gameData)
            : null;
        const scheduledStatus = await loadScheduledStaticPriceSnapshot({
          fallbackPriceSet: restoredPriceSet ?? bundledContext.priceSet,
          canonicalAlchValues: generatedItemValues(bundledContext.gameData, "alch")
        });
        if (cancelled) return;
        const runtimeScheduledStatus = withGeneratedScheduledPriceFallbacks(
          scheduledStatus,
          bundledContext.gameData
        );
        const fallbackResolution = resolveActivePriceSetFallback({
          bundledPriceSet: bundledContext.priceSet,
          selectedPriceSet: restoredPriceSet,
          scheduledSnapshotStatus: runtimeScheduledStatus
        });
        const scheduledLoaded = runtimeScheduledStatus.status === "loaded";
        setBundledPriceSet(bundledContext.priceSet);
        setScheduledSnapshotStatus(runtimeScheduledStatus);
        setActivePriceSetOrigin(fallbackResolution.origin);
        if (restoredPriceSet) {
          setStatus(
            initialSavedSetup.loaded
              ? "Loaded saved rewrite setup and selected PriceSet"
              : "Loaded selected PriceSet"
          );
          setContext({ ...bundledContext, priceSet: fallbackResolution.priceSet });
          setPriceLabel(fallbackResolution.priceSet.label);
          setMarketNotice({
            tone: "success",
            message: `Restored selected PriceSet: ${restoredPriceSet.label}`
          });
        } else {
          const selectedPriceSetIssue = describeSelectedPriceSetLoadIssue(selectedPriceSet);
          const loadedStatus = scheduledLoaded
            ? "Loaded scheduled prices"
            : initialSavedSetup.loaded
              ? "Loaded saved rewrite setup"
              : "Loaded source-backed runtime data";
          setStatus(
            selectedPriceSetIssue && !scheduledLoaded ? selectedPriceSetIssue : loadedStatus
          );
          setContext({ ...bundledContext, priceSet: fallbackResolution.priceSet });
          setPriceLabel(fallbackResolution.priceSet.label);
          if (scheduledLoaded) {
            setMarketNotice({
              tone: selectedPriceSetIssue ? "neutral" : "success",
              message: selectedPriceSetIssue
                ? "Saved active PriceSet could not be restored. Scheduled prices were loaded."
                : "Scheduled prices loaded."
            });
          } else if (selectedPriceSetIssue) {
            setMarketNotice({ tone: "error", message: selectedPriceSetIssue });
          }
        }
        setReadyToPersist(true);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setFatalError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [initialSavedSetup.loaded]);

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

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- These effects synchronize versioned app state to browser storage and surface sanitized storage failures. */
  useEffect(() => {
    if (!readyToPersist || shouldSkipLocalStatePersist("rewrite-setup")) return;
    persistLocalState(
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
    localStateRecoveryBlockedIds,
    readyToPersist,
    setupMode
  ]);

  useEffect(() => {
    if (!readyToPersist || shouldSkipLocalStatePersist("loot-prefs")) return;
    persistLocalState("loot-prefs", lootPrefsStorageOptions, lootPrefsForGameData);
  }, [localStateRecoveryBlockedIds, lootPrefsForGameData, readyToPersist]);

  useEffect(() => {
    if (!readyToPersist || shouldSkipLocalStatePersist("loot-settings")) return;
    persistLocalState("loot-settings", lootSettingsStorageOptions, lootSettingsByMonster);
  }, [localStateRecoveryBlockedIds, lootSettingsByMonster, readyToPersist]);

  useEffect(() => {
    if (!readyToPersist || shouldSkipLocalStatePersist("hidden-gear-tiers")) return;
    persistLocalState("hidden-gear-tiers", hiddenGearTiersStorageOptions, hiddenGearTiers);
  }, [hiddenGearTiers, localStateRecoveryBlockedIds, readyToPersist]);

  useEffect(() => {
    if (!readyToPersist || shouldSkipLocalStatePersist("duel-snapshots")) return;
    persistLocalState("duel-snapshots", duelSnapshotsStorageOptions, duelSnapshots);
  }, [duelSnapshots, localStateRecoveryBlockedIds, readyToPersist]);

  useEffect(() => {
    if (
      !readyToPersist ||
      priceHistory.snapshots.length === 0 ||
      shouldSkipLocalStatePersist("price-history")
    ) {
      return;
    }
    persistLocalState("price-history", priceHistoryStorageOptions, priceHistory);
  }, [localStateRecoveryBlockedIds, priceHistory, readyToPersist]);

  useEffect(() => {
    if (!readyToPersist || shouldSkipLocalStatePersist("planner-ui")) return;
    persistLocalState("planner-ui", plannerUiStorageOptions, plannerState);
  }, [localStateRecoveryBlockedIds, plannerState, readyToPersist]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

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
  const sharedPriceHistory = useMemo(
    () => createSharedPriceHistoryAnalysis(scheduledSnapshotStatus?.sharedPriceHistory ?? []),
    [scheduledSnapshotStatus?.sharedPriceHistory]
  );
  const analysisPriceHistory = useMemo(
    () => mergePriceHistoryForAnalysis({ shared: sharedPriceHistory, local: priceHistory }),
    [priceHistory, sharedPriceHistory]
  );
  const priceHistorySummary = useMemo(
    () => summarizePriceHistory(analysisPriceHistory, context?.priceSet ?? null),
    [analysisPriceHistory, context?.priceSet]
  );
  const priceHistorySnapshotOptions = useMemo<SelectOption[]>(
    () =>
      analysisPriceHistory.snapshots.map((snapshot) => ({
        id: priceHistorySnapshotKey(snapshot),
        label: `${snapshot.label} - ${snapshot.capturedAt}`
      })),
    [analysisPriceHistory]
  );
  const priceHistoryItemLabels = useMemo<Record<string, string>>(() => {
    if (!context) return {};
    return Object.fromEntries(
      Object.entries(context.gameData.items).map(([itemId, item]) => [itemId, item.name])
    );
  }, [context]);
  const effectiveEconomySnapshotKey = priceHistorySnapshotOptions.some(
    (option) => option.id === economySnapshotKey
  )
    ? economySnapshotKey
    : (priceHistorySnapshotOptions[0]?.id ?? "");
  const priceHistoryMovers = useMemo(
    () =>
      analyzePriceHistoryMovers(analysisPriceHistory, {
        baselineMode: economyBaselineMode,
        baselineSnapshotKey: effectiveEconomySnapshotKey,
        itemFilter: economyItemFilter,
        itemLabels: priceHistoryItemLabels,
        sort: economySort
      }),
    [
      economyBaselineMode,
      economyItemFilter,
      effectiveEconomySnapshotKey,
      economySort,
      analysisPriceHistory,
      priceHistoryItemLabels
    ]
  );
  const priceHistoryTrendItemOptions = useMemo<SelectOption[]>(() => {
    const itemIds = new Set(
      analysisPriceHistory.snapshots.flatMap((snapshot) => Object.keys(snapshot.itemPrices))
    );
    return [...itemIds]
      .map((itemId) => ({ id: itemId, label: priceHistoryItemLabels[itemId] ?? itemId }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [analysisPriceHistory, priceHistoryItemLabels]);
  const effectiveEconomyTrendItemId = priceHistoryTrendItemOptions.some(
    (option) => option.id === economyTrendItemId
  )
    ? economyTrendItemId
    : (priceHistoryMovers.rows[0]?.itemId ?? priceHistoryTrendItemOptions[0]?.id ?? "");
  const priceHistoryTrend = useMemo(
    () =>
      analyzePriceHistoryTrend(
        analysisPriceHistory,
        effectiveEconomyTrendItemId,
        priceHistoryItemLabels
      ),
    [analysisPriceHistory, effectiveEconomyTrendItemId, priceHistoryItemLabels]
  );
  const lootPriceHistoryMovers = useMemo(
    () =>
      analyzePriceHistoryMovers(analysisPriceHistory, {
        baselineMode: economyBaselineMode,
        baselineSnapshotKey: effectiveEconomySnapshotKey,
        itemLabels: priceHistoryItemLabels,
        sort: { key: "item", direction: "asc" }
      }),
    [analysisPriceHistory, economyBaselineMode, effectiveEconomySnapshotKey, priceHistoryItemLabels]
  );
  const lootPriceHistoryByItem = useMemo<Record<string, LootPriceHistoryItemContext>>(() => {
    const latestLabel = lootPriceHistoryMovers.latest?.label ?? null;
    const baselineLabel = lootPriceHistoryMovers.baseline?.label ?? null;
    return Object.fromEntries(
      lootPriceHistoryMovers.rows.map((row) => [
        row.itemId,
        {
          itemId: row.itemId,
          itemLabel: row.itemLabel,
          latestPrice: row.latestPrice,
          baselinePrice: row.baselinePrice,
          gpDelta: row.gpDelta,
          percentDelta: row.percentDelta,
          latestLabel,
          baselineLabel
        }
      ])
    );
  }, [lootPriceHistoryMovers]);

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
  const duelComparison = useMemo(
    () =>
      activeTab === "duel" && context
        ? createDuelComparisonViewModel(
            form,
            duelSnapshots,
            context,
            cannonByMonster,
            lootPrefsForGameData,
            lootSettingsByMonster
          )
        : null,
    [
      activeTab,
      cannonByMonster,
      context,
      duelSnapshots,
      form,
      lootPrefsForGameData,
      lootSettingsByMonster
    ]
  );
  const duelMatrixFresh =
    duelMatrixBuild != null &&
    duelMatrixBuild.source.form === form &&
    duelMatrixBuild.source.snapshots === duelSnapshots &&
    duelMatrixBuild.source.context === context &&
    duelMatrixBuild.source.cannonByMonster === cannonByMonster &&
    duelMatrixBuild.source.lootPrefsByMonster === lootPrefsForGameData &&
    duelMatrixBuild.source.lootSettingsByMonster === lootSettingsByMonster;
  const duelMatrix = duelMatrixFresh ? duelMatrixBuild.model : null;
  const filteredDuelMatrixRows = useMemo(() => {
    if (!duelMatrix) return [];
    const query = duelMatrixFilter.trim().toLocaleLowerCase();
    if (!query) return duelMatrix.rows;
    return duelMatrix.rows.filter(
      (row) =>
        row.monsterName.toLocaleLowerCase().includes(query) ||
        row.monsterId.toLocaleLowerCase().includes(query)
    );
  }, [duelMatrix, duelMatrixFilter]);
  const denseCompareRows = useMemo(
    () =>
      context
        ? createDenseCompareRows(
            heavyForm,
            context,
            denseCompareForGameData,
            cannonByMonster,
            lootPrefsForGameData,
            customSetupsByMonster,
            lootSettingsByMonster
          )
        : [],
    [
      cannonByMonster,
      context,
      customSetupsByMonster,
      denseCompareForGameData,
      heavyForm,
      lootSettingsByMonster,
      lootPrefsForGameData
    ]
  );
  const denseComparePending = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(heavyForm),
    [form, heavyForm]
  );
  const denseCompareFreshnessLabel = denseComparePending ? "Updating" : "Current";
  const denseCompareFreshnessSummary = denseComparePending
    ? "rows may reflect previous loadout"
    : "current loadout";
  const denseCompareFreshnessAria = denseComparePending
    ? "Compare calculation status: Updating. Rows may reflect the previous loadout."
    : "Compare calculation status: Current. Rows match the live setup.";
  const denseCompareScale = useMemo(
    () => createDenseCompareScaleModel(denseCompareRows),
    [denseCompareRows]
  );
  const denseCompareTotalRows = context ? Object.keys(context.gameData.monsters).length : 0;
  const hiscoresPreviewRows = useMemo(
    () =>
      isHiscoresPreviewCurrent(hiscoresPlayer, hiscoresResponse)
        ? createHiscoresPreviewRows(form, hiscoresResponse)
        : [],
    [form, hiscoresPlayer, hiscoresResponse]
  );
  const hiscoresAvailable = hiscoresStatus?.available === true;
  const hiscoresStatusText = statusText(hiscoresStatus, hiscoresAvailable);
  const canApplyHiscores = canApplyHiscoresPreview(hiscoresPlayer, hiscoresResponse);

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
  const plannerStateForCompute = useMemo(
    () => normalizePlannerUiState(plannerState),
    [plannerState]
  );
  const plannerStateDirty = useMemo(
    () => JSON.stringify(plannerStateForCompute) !== JSON.stringify(plannerComputedState),
    [plannerComputedState, plannerStateForCompute]
  );
  const plannerResult = useMemo<{
    panel: PlannerPanelViewModel | null;
    error: string | null;
  } | null>(() => {
    if (!context || activeTab !== "planner") return null;
    try {
      const plan = createPlannerViewModel(
        form,
        context,
        lootSettingsByMonster,
        plannerComputedState
      );
      return {
        panel: createPlannerPanelViewModel(plan),
        error: null
      };
    } catch {
      return {
        panel: null,
        error: "Planner could not compute the current plan"
      };
    }
  }, [activeTab, context, form, lootSettingsByMonster, plannerComputedState]);
  const plannerGearPoolEditor = useMemo<PlannerGearPoolEditorViewModel | null>(
    () => (context ? createPlannerGearPoolEditorViewModel(form, context, plannerState) : null),
    [context, form, plannerState]
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

  const undoPendingAction = () => {
    if (!pendingUndo) return;
    pendingUndo.restore();
    setStatus(pendingUndo.restoreLabel);
    setPendingUndo(null);
  };

  const persistSelectedActivePriceSet = (priceSet: PriceSet, selectedAt: Date): boolean => {
    try {
      saveSelectedPriceSet(storage, priceSet, { now: () => selectedAt });
      if (localStorageAccessUnavailable) {
        setLocalStateRecoveryNotice(LOCAL_STATE_PERSISTENCE_NOTICE);
        refreshLocalStateHealthReport();
        return false;
      }
      clearLocalStateStorageFailures(["selected-price-set"]);
      refreshLocalStateHealthReport();
      setPriceSetResetPending(false);
      return true;
    } catch {
      recordLocalStateStorageFailure("selected-price-set", "save_failed");
      return false;
    }
  };

  const acceptPriceSet = (priceSet: PriceSet, acceptedAt: Date, nextStatus: string) => {
    if (!context) return;
    const canonicalPriceSet = withGeneratedAlchAuthority(priceSet, context.gameData);
    const selectedPersisted = persistSelectedActivePriceSet(canonicalPriceSet, acceptedAt);
    unblockReplacedLocalState(["price-history", "selected-price-set"]);
    setContext((current) => (current ? { ...current, priceSet: canonicalPriceSet } : current));
    setPriceHistory((current) =>
      appendAcceptedPriceSetToHistory(current, canonicalPriceSet, acceptedAt)
    );
    setPriceLabel(canonicalPriceSet.label);
    setActivePriceSetOrigin("selected");
    setStatus(nextStatus);
    setMarketNotice({
      tone: selectedPersisted ? "success" : "neutral",
      message: selectedPersisted
        ? `${nextStatus}: ${canonicalPriceSet.label}. High alch uses current generated game data.`
        : `${nextStatus}: ${canonicalPriceSet.label}. High alch uses current generated game data. Local restore was not saved.`
    });
    setFatalError(null);
  };

  const importPrices = async (
    event: ChangeEvent<HTMLInputElement>,
    surface: PriceImportSurface
  ) => {
    const file = event.target.files?.[0];
    if (!file || !context) return;
    try {
      setPriceImportNotice(null);
      const priceSet = parsePriceSetFileText(
        await readBrowserFileText(file, PRICE_SET_IMPORT_MAX_BYTES),
        { maxBytes: PRICE_SET_IMPORT_MAX_BYTES }
      );
      acceptPriceSet(priceSet, new Date(), "Imported price set");
      setPriceImportNotice({
        ...createPriceImportSuccessNotice(priceSet.label),
        surface
      });
    } catch (caught) {
      setPriceImportNotice({ ...describePriceImportError(caught), surface });
    } finally {
      event.target.value = "";
    }
  };

  const importSetup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setSetupImportNotice(null);
      const parsed = SavedSetupEnvelopeSchema.parse(
        JSON.parse(await readBrowserFileText(file, SETUP_IMPORT_MAX_BYTES))
      );
      const setup = parsed.data;
      const persisted = persistLocalState("rewrite-setup", setupStorageOptions, setup);
      setForm(normalizeFormState(setup.form));
      setDefaultForm(normalizeFormState(setup.defaultForm));
      setSetupMode(setup.setupMode);
      setCustomSetupsByMonster(setup.customSetupsByMonster);
      setDenseCompare(setup.denseCompare);
      setCannonByMonster(setup.cannonByMonster);
      unblockReplacedLocalState(["rewrite-setup"]);
      refreshLocalStateHealthReport();
      setStatus(persisted ? "Imported rewrite setup" : "Imported rewrite setup for this session");
      setSetupImportNotice({
        tone: "success",
        message: persisted
          ? "Imported rewrite setup."
          : "Imported rewrite setup for this session. Local storage is unavailable, so changes may not persist after reload."
      });
      setFatalError(null);
    } catch (caught) {
      setSetupImportNotice(describeSetupImportError(caught));
    } finally {
      event.target.value = "";
    }
  };

  const dismissLegacyMigration = (report: LegacySetupMigrationReport, message: string): void => {
    persistLocalState("legacy-migration-dismissed", legacyMigrationDismissedStorageOptions, {
      dismissedAt: new Date().toISOString(),
      foundKeys: report.foundKeys
    });
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
      persistLocalState("rewrite-setup", setupStorageOptions, setup);
      setForm(normalizeFormState(setup.form));
      setDefaultForm(normalizeFormState(setup.defaultForm));
      setSetupMode(setup.setupMode);
      setCustomSetupsByMonster(setup.customSetupsByMonster);
      setDenseCompare(setup.denseCompare);
      setCannonByMonster(setup.cannonByMonster);
      unblockReplacedLocalState(["rewrite-setup"]);
    }
    if (legacyMigrationReport.lootPrefs != null) {
      const nextLootPrefs = mergeLootPrefsState(
        lootPrefsForGameData,
        legacyMigrationReport.lootPrefs
      );
      persistLocalState("loot-prefs", lootPrefsStorageOptions, nextLootPrefs);
      setLootPrefsByMonster(nextLootPrefs);
      unblockReplacedLocalState(["loot-prefs"]);
    }
    if (legacyMigrationReport.duelSnapshots != null) {
      const merged = mergeDuelSnapshots(duelSnapshots, legacyMigrationReport.duelSnapshots);
      persistLocalState("duel-snapshots", duelSnapshotsStorageOptions, merged.state);
      setDuelSnapshots(merged.state);
      unblockReplacedLocalState(["duel-snapshots"]);
    }
    if (legacyMigrationReport.hiddenGearTiers != null) {
      persistLocalState(
        "hidden-gear-tiers",
        hiddenGearTiersStorageOptions,
        legacyMigrationReport.hiddenGearTiers
      );
      setHiddenGearTiers(legacyMigrationReport.hiddenGearTiers);
      unblockReplacedLocalState(["hidden-gear-tiers"]);
    }
    if (legacyMigrationReport.hiscoresPlayer) {
      try {
        saveLastHiscoresPlayer(storage, legacyMigrationReport.hiscoresPlayer);
        clearLocalStateStorageFailures(["hiscores-last-player"]);
      } catch {
        recordLocalStateStorageFailure("hiscores-last-player", "save_failed");
      }
      setHiscoresPlayer(legacyMigrationReport.hiscoresPlayer);
      unblockReplacedLocalState(["hiscores-last-player"]);
    }
    if (legacyMigrationReport.priceSet) {
      const priceSet = legacyMigrationReport.priceSet;
      const acceptedAt = new Date();
      acceptPriceSet(priceSet, acceptedAt, "Imported compatible legacy PriceSet");
    }
    setFatalError(null);
    refreshLocalStateHealthReport();
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
      recordLocalStateStorageFailure("legacy-migration-dismissed", "clear_failed");
      setLocalStateRecoveryNotice(LOCAL_STATE_PERSISTENCE_NOTICE);
      setStatus("Could not clear legacy data. Local storage is unavailable.");
      return;
    }
    dismissLegacyMigration(
      { ...legacyMigrationReport, foundKeys: clearedKeys },
      `Cleared ${clearedKeys.length} legacy keys`
    );
  };

  const exportLocalStateRecoveryReport = () => {
    const report = refreshLocalStateHealthReport();
    downloadJsonFile(localStateHealthExportFileName(report), createLocalStateHealthExport(report));
    setLocalStateClearPendingId(null);
    setLocalStateRecoveryNotice("Exported local state recovery report");
    setStatus("Exported local state recovery report");
  };

  const confirmClearLocalStateItem = (item: LocalStateHealthItem) => {
    const result = clearLocalStateItem(storage, item.id);
    clearLocalStateStorageFailures(result.clearedItems.map((clearedItem) => clearedItem.id));
    for (const failed of result.failedItems) {
      recordLocalStateStorageFailure(failed.item.id, failed.reason);
    }
    releaseLocalStateRecoveryBlocks(result.clearedItems.map((clearedItem) => clearedItem.id));
    refreshLocalStateHealthReport();
    setLocalStateClearPendingId(null);
    const message =
      result.failedItems.length > 0
        ? `Could not clear ${item.label}. Local storage is unavailable.`
        : result.clearedItems.length > 0
          ? `Cleared ${item.label}`
          : `${item.label} had no local data to clear`;
    setLocalStateRecoveryNotice(message);
    setStatus(message);
  };

  const confirmClearInvalidLocalState = () => {
    const result = clearInvalidLocalState(storage, localStateHealthReport);
    clearLocalStateStorageFailures(result.clearedItems.map((item) => item.id));
    for (const failed of result.failedItems) {
      recordLocalStateStorageFailure(failed.item.id, failed.reason);
    }
    releaseLocalStateRecoveryBlocks(result.clearedItems.map((item) => item.id));
    refreshLocalStateHealthReport();
    setLocalStateClearPendingId(null);
    const message =
      result.failedItems.length > 0
        ? `Could not clear ${formatNumber(result.failedItems.length)} local state keys. Local storage is unavailable.`
        : result.clearedItems.length > 0
          ? `Cleared ${formatNumber(result.clearedItems.length)} invalid local state keys`
          : "No invalid local state keys to clear";
    setLocalStateRecoveryNotice(message);
    setStatus(message);
  };

  const handleHiscoresPlayerChange = (value: string) => {
    hiscoresPlayerRef.current = value;
    setHiscoresPlayer(value);
    if (hiscoresResponse && !isHiscoresPreviewCurrent(value, hiscoresResponse)) {
      setHiscoresResponse(null);
      setHiscoresNotice((notice) => (notice?.tone === "success" ? null : notice));
    }
  };

  const handleHiscoresLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lookupPlayer = hiscoresPlayer;
    const lookupPlayerKey = normalizeHiscoresPlayerInput(lookupPlayer);
    if (!lookupPlayerKey) {
      setHiscoresNotice({ tone: "error", message: "Enter a player name" });
      return;
    }
    if (!hiscoresAvailable) {
      setHiscoresNotice({ tone: "error", message: hiscoresUnavailableMessage(hiscoresStatus) });
      return;
    }

    const requestSequence = (hiscoresLookupSequenceRef.current += 1);
    setHiscoresBusy(true);
    setHiscoresNotice({ tone: "neutral", message: "Looking up hiscores" });
    try {
      const response = await lookupHiscores(lookupPlayer);
      const latestRequest = requestSequence === hiscoresLookupSequenceRef.current;
      if (!latestRequest || !isHiscoresPreviewCurrent(hiscoresPlayerRef.current, response)) {
        if (latestRequest) {
          setHiscoresResponse(null);
          setHiscoresNotice({
            tone: "neutral",
            message: "Player changed before lookup completed. Run Lookup again."
          });
        }
        return;
      }
      setHiscoresResponse(response);
      try {
        saveLastHiscoresPlayer(storage, response.player);
        clearLocalStateStorageFailures(["hiscores-last-player"]);
      } catch {
        recordLocalStateStorageFailure("hiscores-last-player", "save_failed");
      }
      unblockReplacedLocalState(["hiscores-last-player"]);
      refreshLocalStateHealthReport();
      setHiscoresNotice({
        tone: "success",
        message: createHiscoresPreviewRows(form, response).length
          ? "Hiscores preview ready"
          : "No supported skills returned"
      });
    } catch (caught: unknown) {
      const latestRequest = requestSequence === hiscoresLookupSequenceRef.current;
      if (
        !latestRequest ||
        normalizeHiscoresPlayerInput(hiscoresPlayerRef.current) !== lookupPlayerKey
      ) {
        return;
      }
      setHiscoresResponse(null);
      setHiscoresNotice({ tone: "error", message: describeHiscoresError(caught) });
    } finally {
      if (requestSequence === hiscoresLookupSequenceRef.current) {
        setHiscoresBusy(false);
      }
    }
  };

  const applyHiscoresPreview = () => {
    if (!isHiscoresPreviewCurrent(hiscoresPlayer, hiscoresResponse)) {
      setHiscoresResponse(null);
      setHiscoresNotice({
        tone: "neutral",
        message: "Hiscores preview no longer matches Player. Run Lookup again."
      });
      return;
    }
    const applied = countApplicableHiscoresSkills(hiscoresResponse);
    setFormSafe((current) => applyHiscoresLevels(current, hiscoresResponse));
    setHiscoresNotice({
      tone: applied ? "success" : "neutral",
      message: applied ? `Applied ${applied} skills` : "No current setup skills to apply"
    });
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
      recordLocalStateStorageFailure("price-history", cleared.reason);
    } else if (persistedClear) {
      clearLocalStateStorageFailures(["price-history"]);
    } else {
      setLocalStateRecoveryNotice(LOCAL_STATE_PERSISTENCE_NOTICE);
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
    setActiveTab(combatStyle);
    setCombatStyle(combatStyle);
  };
  const activateWorkbenchTab = (tabId: WorkbenchTabId) => {
    const tab = WORKBENCH_TABS.find((candidate) => candidate.id === tabId);
    if (!tab) return;
    setActiveTab(tab.id);
    if ("combatStyle" in tab) setCombatStyle(tab.combatStyle);
  };
  const handleWorkbenchTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % WORKBENCH_TABS.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + WORKBENCH_TABS.length) % WORKBENCH_TABS.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = WORKBENCH_TABS.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    const nextTab = WORKBENCH_TABS[nextIndex]!;
    activateWorkbenchTab(nextTab.id);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#workbench-tab-${nextTab.id}`)
      ?.focus();
  };

  const reviewActiveAssumption = (tab: ActiveAssumptionReviewTarget) => {
    setActiveTab(tab);
    if (tab === "melee" || tab === "ranged" || tab === "magic") setCombatStyle(tab);
  };

  const updateLevel = (skill: keyof CombatSetupFormState["levels"], value: number) =>
    setFormSafe((current) =>
      updateForm(current, {
        levels: { ...current.levels, [skill]: value }
      })
    );

  const updatePlannerMetric = (value: string) => {
    if (!PLANNER_METRICS.includes(value as PlannerMetric)) return;
    setPlannerState((current) => normalizePlannerUiState({ ...current, metric: value }));
  };

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

  const recomputePlanner = () => setPlannerComputedState(plannerStateForCompute);

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

  const primarySkill = primaryLevelKey(form.combatStyle);
  const selectedPrayer = primaryPrayerValue(form.prayers);
  const selectedBoost = primaryBoostValue(form.boosts);
  const extraPrayerCount = extraPrayerSelectionCount(form.prayers);
  const extraBoostCount = extraBoostSelectionCount(form.boosts);
  const selectedSpecialWeapon = specialAttackOptions.some(
    (option) => option.id === form.specialAttack.weaponId
  )
    ? form.specialAttack.weaponId
    : "none";
  const selectedSpecialAmmo =
    arrowAmmoOptions.find((option) => option.id === form.specialAttack.ammoId)?.id ??
    arrowAmmoOptions.find((option) => option.id === form.ammoId)?.id ??
    arrowAmmoOptions.find((option) => option.id === "rune_arrow")?.id ??
    arrowAmmoOptions[0]?.id ??
    "none";
  const dbaSpecActive = form.combatStyle === "melee" && form.boosts.includes("dba_spec");
  const specialAttackDisabled = form.combatStyle === "magic" || dbaSpecActive;
  const specialStatus =
    form.combatStyle === "magic"
      ? "unsupported"
      : dbaSpecActive
        ? "DBA boost"
        : (viewModel.combat.specialAttack?.weaponName ?? "off");
  const currentMonster = context.gameData.monsters[form.monsterId];
  const highAlchEnabled = currentLootSettings.highAlch ?? form.trip.alching;
  const derivedOverheadSec = currentMonster ? defaultOverhead(currentMonster) : 2;
  const lootOverheadMode = currentLootSettings.overheadSec == null ? "auto" : "manual";
  const lootOverheadValue = currentLootSettings.overheadSec ?? derivedOverheadSec;
  const currentCustomSetup = customSetupsByMonster[form.monsterId] ?? null;
  const hasCurrentCustomSetup = currentCustomSetup != null;
  const activeSetupIsCustom = setupMode === "custom" && hasCurrentCustomSetup;
  const setupStatus = activeSetupIsCustom
    ? "Custom setup"
    : hasCurrentCustomSetup
      ? "Default setup - custom saved"
      : "Default setup";
  const buildDuelMatrix = () => {
    if (duelMatrixBusy || duelSnapshots.snapshots.length === 0) return;
    const source = {
      form,
      snapshots: duelSnapshots,
      context,
      cannonByMonster,
      lootPrefsByMonster: lootPrefsForGameData,
      lootSettingsByMonster
    };
    setDuelViewMode("monster-matrix");
    setDuelMatrixBusy(true);
    setStatus("Building Duel monster matrix");
    window.setTimeout(() => {
      try {
        const model = createDuelMatrixViewModel(
          source.form,
          source.snapshots,
          source.context,
          source.cannonByMonster,
          source.lootPrefsByMonster,
          source.lootSettingsByMonster
        );
        setDuelMatrixBuild({ model, source });
        setStatus(`Duel matrix ready: ${model.monsterCount} monsters, ${model.setupCount} setups`);
      } catch {
        setDuelMatrixBuild(null);
        setStatus("Duel matrix could not be built");
      } finally {
        setDuelMatrixBusy(false);
      }
    }, 0);
  };
  const snapshotCurrentSetup = () => {
    const snapshot = createDuelSnapshot(
      duelSnapshotId(),
      defaultDuelSnapshotName(viewModel, duelSnapshots.snapshots.length),
      form
    );
    setDuelSnapshots((current) => appendDuelSnapshot(current, snapshot));
    setDuelImportNotice(null);
    setStatus(`Snapshot saved: ${snapshot.name}`);
  };
  const exportDuelSnapshots = () => {
    downloadJsonFile(
      "index-sim-duel-snapshots.json",
      createDuelSnapshotsExport(duelSnapshots, new Date())
    );
    setDuelImportNotice({
      tone: "success",
      message: `Exported ${duelSnapshots.snapshots.length} Duel snapshots.`
    });
    setStatus("Exported Duel snapshots");
  };
  const importDuelSnapshots = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setDuelImportNotice(null);
      const imported = parseDuelSnapshotsExportText(
        await readBrowserFileText(file, DUEL_SNAPSHOTS_IMPORT_MAX_BYTES)
      );
      const merged = mergeDuelSnapshots(duelSnapshots, imported.data);
      setDuelSnapshots(merged.state);
      unblockReplacedLocalState(["duel-snapshots"]);
      const skipped =
        merged.skippedCount > 0 ? ` ${merged.skippedCount} skipped at the limit.` : "";
      const message = `Imported Duel snapshots: ${merged.addedCount} added, ${merged.updatedCount} updated.${skipped}`;
      setDuelImportNotice({ tone: "success", message });
      setStatus(message);
    } catch (caught) {
      setDuelImportNotice(describeDuelSnapshotsImportError(caught));
      setStatus("Duel snapshot import failed");
    } finally {
      event.target.value = "";
    }
  };
  const commitDuelSnapshotName = (snapshotId: string, name: string): boolean => {
    try {
      setDuelSnapshots((current) => renameDuelSnapshot(current, snapshotId, name));
      setStatus("Renamed Duel snapshot");
      return true;
    } catch {
      setStatus("Snapshot name must not be empty");
      return false;
    }
  };
  const loadDuelSnapshot = (snapshotId: string) => {
    const snapshot = duelSnapshots.snapshots.find((candidate) => candidate.id === snapshotId);
    if (!snapshot) return;
    const nextForm = normalizeFormState({ ...snapshot.form, monsterId: form.monsterId });
    commitFormState(nextForm);
    setStatus(`Loaded Duel snapshot: ${snapshot.name}`);
  };
  const deleteDuelSnapshot = (snapshotId: string) => {
    const snapshot = duelSnapshots.snapshots.find((candidate) => candidate.id === snapshotId);
    const previousDuelSnapshots = duelSnapshots;
    setDuelSnapshots((current) => removeDuelSnapshot(current, snapshotId));
    const label = snapshot ? `Deleted Duel snapshot: ${snapshot.name}` : "Deleted Duel snapshot";
    const restoreLabel = snapshot
      ? `Restored Duel snapshot: ${snapshot.name}`
      : "Restored Duel snapshot";
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
    setActiveTab(applied.state.form.combatStyle);
    setShareReviewDismissed(true);
    unblockReplacedLocalState(["rewrite-setup", "loot-prefs", "loot-settings"]);
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
  const cannonStatus = !cannonEnabled
    ? "off"
    : currentCannonOutput?.idle
      ? "idle"
      : currentCannonOutput?.respawnBound
        ? "respawn-bound"
        : "active";
  const incoming = viewModel.trip.trip.incoming;
  const foodSummary = optionLabel(FOOD_OPTIONS, form.trip.foodKey);
  const bankTimeMode = form.trip.bankSeconds == null ? "auto" : "manual";
  const bankSecondsValue =
    form.trip.bankSeconds ?? Math.max(0, Math.round(viewModel.trip.trip.bankSeconds));
  const bankTimeSummary =
    form.trip.bankSeconds == null
      ? `Auto ${formatNumber(viewModel.trip.trip.bankSeconds)}s`
      : `Manual ${formatNumber(form.trip.bankSeconds)}s`;
  const recoverAmmoApplies = form.combatStyle === "ranged";
  const recoverAmmoSummary = recoverAmmoApplies ? yesNo(form.trip.recoverAmmo) : "Ranged only";
  const dbaRestoreSummary = dbaSpecActive ? yesNo(form.trip.dbaRestore) : "-";
  const runeSlotsApplies = form.combatStyle === "magic";
  const runeSlotsSummary = runeSlotsApplies ? formatNumber(form.trip.runeSlots) : "Magic only";
  const foodCountMode = form.trip.foodCount == null ? "auto" : "manual";
  const foodCountValue =
    form.trip.foodCount ?? Math.max(0, Math.round(viewModel.trip.trip.slots.autoFoodCount));
  const foodCountSummary =
    form.trip.foodCount == null
      ? `Auto ${formatNumber(viewModel.trip.trip.slots.autoFoodCount)}`
      : `Manual ${formatNumber(form.trip.foodCount)}`;
  const foodPerKillOverrideMode = form.trip.foodPerKillOverride == null ? "off" : "on";
  const foodPerKillOverrideValue =
    form.trip.foodPerKillOverride ?? Number(viewModel.trip.trip.foodPerKill.toFixed(2));
  const prayerRestoreMode =
    form.trip.prayerPotionDoses != null
      ? "manual_doses"
      : form.trip.prayerPotionSets != null
        ? "manual_vials"
        : "auto";
  const prayerVialsValue =
    form.trip.prayerPotionSets ??
    Math.max(0, Math.min(28, Math.round(viewModel.trip.trip.prayerSlots || 1)));
  const prayerDosesValue =
    form.trip.prayerPotionDoses ??
    Math.max(
      0,
      Math.min(
        112,
        Math.round(viewModel.trip.trip.prayerSlots > 0 ? viewModel.trip.trip.prayerSlots * 4 : 4)
      )
    );
  const prayerRestoreValue =
    prayerRestoreMode === "manual_doses" ? prayerDosesValue : prayerVialsValue;
  const altarTimeMode = form.trip.altarSeconds == null ? "auto" : "manual";
  const altarSecondsValue =
    form.trip.altarSeconds ?? Math.max(0, Math.round(viewModel.trip.trip.altarSeconds));
  const scarceTargetsValue =
    form.trip.targetsAtSpot ?? Math.max(1, viewModel.trip.trip.scarce.targetsAtSpot);
  const scarceRespawnValue =
    form.trip.respawnSeconds ?? Math.max(1, viewModel.trip.trip.scarce.respawnSeconds);
  const recoilRingEquipped = form.gear.ring === "ring_of_recoil";
  const safespotSummary =
    form.trip.safespot == null
      ? incoming.safespot
        ? "Auto on"
        : "Auto off"
      : incoming.safespot
        ? "On"
        : "Off";
  const prayerRestoreSummary =
    form.trip.prayerMode === "potions"
      ? form.trip.prayerPotionDoses != null
        ? `Manual ${formatNumber(form.trip.prayerPotionDoses)} doses`
        : form.trip.prayerPotionSets != null
          ? `Manual ${formatNumber(form.trip.prayerPotionSets)} vials`
          : `Auto ${formatNumber(viewModel.trip.trip.prayerSlots)} vials`
      : form.trip.prayerMode === "altar"
        ? `${optionLabel(ALTAR_TIME_MODE_OPTIONS, altarTimeMode)} altar`
        : "No restore";
  const prayerCarriedSummary =
    form.trip.prayerMode !== "potions" || !viewModel.trip.trip.prayerActive
      ? "-"
      : form.trip.prayerPotionDoses != null
        ? `${formatNumber(form.trip.prayerPotionDoses)} doses`
        : form.trip.prayerPotionSets != null
          ? `${formatNumber(form.trip.prayerPotionSets)} vials`
          : `Auto ${formatNumber(viewModel.trip.trip.prayerSlots)} vials`;
  const scarceStatus = !form.trip.scarceSpot
    ? "Off"
    : viewModel.trip.trip.scarce.respawnBound
      ? "Respawn-bound"
      : "Not bound";
  const cannonSparseSummary = !cannonEnabled
    ? "Off"
    : cannonTripSparseLinked
      ? "Linked"
      : form.trip.scarceSpot
        ? "Trip differs"
        : "Cannon only";
  const cannonReserveSummary =
    cannonEnabled && viewModel.trip.trip.slots.reserveParts.includes("cannon (4 parts)")
      ? "5 slots"
      : "-";
  const cannonNotice = !cannonEnabled
    ? "Cannon is off for this monster."
    : currentCannonOutput?.idle
      ? "Idle: this spot is too sparse for the cannon to fire."
      : currentCannonOutput?.respawnBound
        ? "Respawn-bound: cannon uptime is limited by target respawns."
        : cannonTripSparseLinked
          ? "Trip sparse assumptions use the same target count and respawn as Cannon."
          : form.trip.scarceSpot
            ? "Trip sparse assumptions differ from this Cannon spot."
            : "Cannon affects ranged XP, supply cost and inventory reserve slots.";
  const tripStatus = viewModel.trip.trip.scarce.respawnBound
    ? "respawn-bound"
    : viewModel.trip.trip.bound;
  const reservePartsSummary = viewModel.trip.trip.slots.reserveParts.length
    ? viewModel.trip.trip.slots.reserveParts.join(", ")
    : "-";
  const potionPartsSummary = viewModel.trip.trip.slots.potionParts.length
    ? viewModel.trip.trip.slots.potionParts.join(", ")
    : "-";
  const potionCarrySummary = form.trip.singleDose
    ? `${formatNumber(form.trip.potionDoses)} doses/type`
    : `${formatNumber(form.trip.potionSets)} vials/type`;
  const potionRecommendation = viewModel.trip.potionRecommendation;
  const potionRecommendationStatus =
    potionRecommendation.status === "matched"
      ? "Matches recommendation"
      : potionRecommendation.status === "under"
        ? "Below recommendation"
        : potionRecommendation.status === "over"
          ? "Above recommendation"
          : potionRecommendation.status === "no-boost"
            ? "No combat boost selected"
            : potionRecommendation.status === "manual"
              ? "Manual carry"
              : "Inactive";
  const potionRecommendationClass = potionRecommendation.canApply
    ? "needs-apply"
    : potionRecommendation.matched
      ? "matched"
      : "inactive";
  const potionRecommendationCarry = !potionRecommendation.active
    ? "-"
    : form.trip.singleDose
      ? `${formatNumber(potionRecommendation.recommendedDoses)} doses/type`
      : `${formatNumber(potionRecommendation.recommendedVials)} vials/type`;
  const potionRecommendationTrip =
    potionRecommendation.tripMinutes == null
      ? "-"
      : `${formatNumber(potionRecommendation.tripMinutes, 1)}m`;
  const potionRecommendationInterval =
    potionRecommendation.repotIntervalMinutes == null
      ? "-"
      : `${formatNumber(potionRecommendation.repotIntervalMinutes, 1)}m`;
  const applyPotionRecommendation = () => {
    if (!potionRecommendation.canApply) return;
    setFormSafe((current) =>
      updateForm(current, {
        trip: {
          ...current.trip,
          ...(current.trip.singleDose
            ? { potionDoses: potionRecommendation.recommendedDoses }
            : { potionSets: potionRecommendation.recommendedVials })
        }
      })
    );
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
  const setLootActionForCurrentMonster = (row: LootDropRowViewModel, value: string) => {
    const action = row.availableActions.find((candidate) => candidate === value);
    if (!action) return;
    setLootPrefsByMonster((current) =>
      setLootPreferenceForMonster(
        current,
        form.monsterId,
        row.rowId,
        action === row.defaultPref ? null : action
      )
    );
    setLootNotice(`${row.name}: ${actionLabel(action)}`);
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
  const accuracyLabel = form.combatStyle === "magic" ? "M+%" : "ACC+";
  const damageLabel = form.combatStyle === "magic" ? "DMG%" : "DMG+";
  const derivedAccuracyPlaceholder = signedInteger(derivedViewModel.combat.debug.accuracyBonus);
  const derivedDamagePlaceholder = signedInteger(derivedViewModel.combat.debug.damageBonus);
  const derivedSpeedPlaceholder = formatNumber(derivedViewModel.combat.attackSpeedSec, 1);
  const activeManualOverrideCount = Object.values(form.manualOverrides).filter(
    (value) => value != null
  ).length;
  const sortDescription = `${DENSE_TABLE_COLUMNS.find((column) => column.key === denseCompare.sort.key)?.label ?? denseCompare.sort.key} ${denseCompare.sort.direction}`;
  const legacyMigrationSummary = legacyMigrationReport
    ? legacyMigrationSummaryItems(legacyMigrationReport)
    : [];
  const legacyImportPlan = legacyMigrationReport
    ? legacyMigrationImportPlan(legacyMigrationReport)
    : [];
  const legacyReviewPlan = legacyMigrationReport
    ? legacyMigrationReviewPlan(legacyMigrationReport)
    : [];
  const legacyOutcomeItems = legacyMigrationReport
    ? legacyMigrationOutcomeItems(legacyMigrationReport)
    : [];
  const legacyClearKeys = legacyMigrationReport ? legacyClearKeyList(legacyMigrationReport) : "";
  const legacyImportReady =
    legacyMigrationReport?.setup != null ||
    legacyMigrationReport?.customSetupsByMonster != null ||
    legacyMigrationReport?.cannonByMonster != null ||
    legacyMigrationReport?.lootPrefs != null ||
    legacyMigrationReport?.hiddenGearTiers != null ||
    legacyMigrationReport?.denseCompareSort != null ||
    legacyMigrationReport?.irrelevantMonsterIds != null ||
    legacyMigrationReport?.hiscoresPlayer != null ||
    legacyMigrationReport?.priceSet != null;
  const legacyMigrationStatus = legacyMigrationReport
    ? legacyImportReady
      ? `${legacyMigrationReport.importedFields.length} compatible fields`
      : "review only"
    : "";
  const localStateRecoveryVisible =
    activeTab === "settings" &&
    (localStateHealthReport.hasAttention || localStateRecoveryNotice != null);
  const localStateAttentionItems = localStateHealthReport.items.filter(
    (item) => item.needsAttention
  );
  const plannerPanel = plannerResult?.panel ?? null;
  const plannerStatus = plannerResult?.error
    ? "error"
    : plannerStateDirty
      ? "pending"
      : plannerPanel?.isEmpty
        ? "empty"
        : plannerPanel
          ? "ready"
          : "idle";
  const plannerMetricDelta =
    plannerPanel != null ? plannerPanel.summary.endMetric - plannerPanel.summary.startMetric : 0;
  const plannerMetricDeltaValue =
    plannerPanel == null
      ? "-"
      : plannerComputedState.metric === "dps" || plannerComputedState.metric === "balanced"
        ? signedDecimal(plannerMetricDelta, 2)
        : formatDelta(plannerMetricDelta);
  const activePriceSet = context?.priceSet ?? null;
  const activePriceSetCreatedAtMs = activePriceSet ? Date.parse(activePriceSet.createdAt) : NaN;
  const activePriceSetAgeSeconds =
    activePriceSet && Number.isFinite(activePriceSetCreatedAtMs)
      ? Math.max(0, Math.floor((priceAgeNowMs - activePriceSetCreatedAtMs) / 1000))
      : null;
  const activePriceSetItemCount = activePriceSet
    ? Object.keys(activePriceSet.itemPrices).length
    : 0;
  const activePriceSetAlchCount = activePriceSet
    ? Object.keys(activePriceSet.alchValues).length
    : 0;
  const scheduledPriceSet = scheduledPriceSetFromStatus(scheduledSnapshotStatus);
  const scheduledPriceSetCreatedAtMs = scheduledPriceSet
    ? Date.parse(scheduledPriceSet.createdAt)
    : NaN;
  const scheduledPriceSetAgeSeconds =
    scheduledPriceSet && Number.isFinite(scheduledPriceSetCreatedAtMs)
      ? Math.max(0, Math.floor((priceAgeNowMs - scheduledPriceSetCreatedAtMs) / 1000))
      : null;
  const scheduledPriceSetItemCount = scheduledPriceSet
    ? Object.keys(scheduledPriceSet.itemPrices).length
    : 0;
  const scheduledPriceSetAlchCount = scheduledPriceSet
    ? Object.keys(scheduledPriceSet.alchValues).length
    : 0;
  const scheduledSnapshotViewModel = createScheduledPriceSnapshotViewModel(
    scheduledSnapshotStatus,
    activePriceSetOrigin
  );
  const resetFallbackPriceSet = scheduledPriceSet ?? bundledPriceSet;
  const resetFallbackOrigin: ActivePriceSetOrigin = scheduledPriceSet ? "scheduled" : "bundled";
  const resetFallbackLabel =
    resetFallbackOrigin === "scheduled" ? "scheduled prices" : "bundled prices";
  const canResetActivePriceSet = Boolean(
    activePriceSet && resetFallbackPriceSet && activePriceSetOrigin === "selected"
  );
  const exportActivePriceSet = () => {
    if (!activePriceSet) return;
    downloadJsonFile(priceSetExportFileName(activePriceSet), activePriceSet);
    setPriceSetResetPending(false);
    setStatus("Exported active PriceSet");
    setMarketNotice({
      tone: "success",
      message: `Exported active PriceSet: ${activePriceSet.label}`
    });
  };
  const requestResetActivePriceSet = () => {
    if (!canResetActivePriceSet) return;
    setPriceSetResetPending(true);
    setMarketNotice({
      tone: "neutral",
      message: `Confirm reset local price override to ${resetFallbackLabel}. Local price history will be kept.`
    });
  };
  const resetActivePriceSetToFallback = () => {
    if (!resetFallbackPriceSet) return;
    let persistedReset = true;
    try {
      clearSelectedPriceSet(storage);
      if (localStorageAccessUnavailable) {
        persistedReset = false;
        setLocalStateRecoveryNotice(LOCAL_STATE_PERSISTENCE_NOTICE);
      } else {
        clearLocalStateStorageFailures(["selected-price-set"]);
      }
    } catch {
      persistedReset = false;
      recordLocalStateStorageFailure("selected-price-set", "clear_failed");
    }
    refreshLocalStateHealthReport();
    setContext((current) => (current ? { ...current, priceSet: resetFallbackPriceSet } : current));
    setPriceLabel(resetFallbackPriceSet.label);
    setActivePriceSetOrigin(resetFallbackOrigin);
    setPriceSetResetPending(false);
    setStatus(
      persistedReset
        ? `Reset to ${resetFallbackLabel}`
        : `Reset to ${resetFallbackLabel} for this session`
    );
    setMarketNotice({
      tone: persistedReset ? "success" : "neutral",
      message: persistedReset
        ? `Reset to ${resetFallbackLabel}. Local price history was kept.`
        : `Reset to ${resetFallbackLabel} for this session. Local storage is unavailable, so reload may restore the previous PriceSet.`
    });
    setFatalError(null);
  };
  const renderPriceSetControls = () => (
    <>
      <button type="button" disabled={!activePriceSet} onClick={exportActivePriceSet}>
        Export active PriceSet
      </button>
      {priceSetResetPending ? (
        <>
          <button type="button" onClick={resetActivePriceSetToFallback}>
            Confirm reset to {resetFallbackLabel}
          </button>
          <button type="button" onClick={() => setPriceSetResetPending(false)}>
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={!canResetActivePriceSet}
          onClick={requestResetActivePriceSet}
        >
          Reset local price override
        </button>
      )}
    </>
  );
  const renderScheduledSnapshotSummary = () => {
    const scheduledMessage = scheduledSnapshotStatus?.warnings.length
      ? `${scheduledSnapshotViewModel.message} ${scheduledSnapshotStatus.warnings[0]}`
      : scheduledSnapshotViewModel.message;
    return (
      <>
        <div className="price-history-summary" aria-label="Scheduled price snapshot summary">
          <span>Status {scheduledSnapshotViewModel.statusLabel}</span>
          <span>Label {scheduledPriceSet?.label ?? "-"}</span>
          <span>Source scheduled static JSON</span>
          <span>Created {scheduledPriceSet?.createdAt ?? "-"}</span>
          <span>Age {formatAge(scheduledPriceSetAgeSeconds)}</span>
          <span>Item prices {formatNumber(scheduledPriceSetItemCount)}</span>
          <span>Alch values {formatNumber(scheduledPriceSetAlchCount)}</span>
          <span>Fallback {scheduledSnapshotViewModel.fallbackLabel}</span>
        </div>
        <p
          className={`inline-status ${scheduledSnapshotViewModel.tone}`}
          role={
            scheduledSnapshotViewModel.tone === "error" ||
            scheduledSnapshotViewModel.tone === "warning"
              ? "alert"
              : "status"
          }
        >
          {scheduledMessage}
        </p>
      </>
    );
  };
  const priceDataStatusMessage = marketNotice?.message ?? status;
  const visibleShareableSetupInspection = shareReviewDismissed
    ? null
    : receivedShareableSetupInspection;

  return (
    <main className="app-shell">
      <a
        className="skip-link"
        href="#workbench-active-panel"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("workbench-active-panel")?.focus();
        }}
      >
        Skip to active workbench pane
      </a>
      <header className="topbar">
        <div>
          <h1>2004scape Combat Simulator</h1>
          <span>
            {status} · {priceLabel}
          </span>
        </div>
        <div className="actions">
          <label className="file-button">
            Import prices
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void importPrices(event, "topbar")}
            />
          </label>
          <label className="file-button">
            Import setup
            <input type="file" accept="application/json,.json" onChange={importSetup} />
          </label>
          <button
            type="button"
            onClick={() =>
              downloadJsonFile("index-sim-rewrite-setup.json", {
                version: REWRITE_SETUP_VERSION,
                savedAt: new Date().toISOString(),
                data: savedSetupFromForm(
                  form,
                  denseCompare,
                  cannonByMonster,
                  customSetupsByMonster,
                  defaultForm,
                  setupMode
                )
              })
            }
          >
            Export setup
          </button>
          <button ref={shareSetupButtonRef} type="button" onClick={openShareSetupDialog}>
            Share setup
          </button>
          {priceImportNotice?.surface === "topbar" && (
            <InlineImportNotice
              notice={priceImportNotice}
              ariaLabel="Price import notice"
              className="topbar-import-notice price-import-notice"
            />
          )}
          {setupImportNotice && (
            <InlineImportNotice
              notice={setupImportNotice}
              ariaLabel="Setup import notice"
              className="topbar-import-notice setup-import-notice"
            />
          )}
          {shareCreateNotice && (
            <div
              className="topbar-import-notice inline-status error"
              role="alert"
              aria-label="Share setup notice"
            >
              {shareCreateNotice}
            </div>
          )}
        </div>
      </header>

      {shareDialog && (
        <ShareSetupDialog
          state={shareDialog}
          onCopy={() => void copyShareSetupUrl()}
          onClose={closeShareSetupDialog}
        />
      )}

      {visibleShareableSetupInspection && (
        <section
          className={`shared-setup-strip ${
            visibleShareableSetupInspection.status === "error"
              ? "error"
              : visibleShareableSetupInspection.review.gameDataMismatch ||
                  visibleShareableSetupInspection.review.droppedLootRowCount > 0
                ? "warning"
                : "ready"
          }`}
          aria-label="Shared setup review"
        >
          <div className="section-title-row">
            <h2>Shared setup</h2>
            <span
              className={`status-pill ${
                visibleShareableSetupInspection.status === "error" ? "" : "ready"
              }`}
            >
              {visibleShareableSetupInspection.status === "error" ? "Invalid" : "Ready to load"}
            </span>
          </div>
          {visibleShareableSetupInspection.status === "error" ? (
            <p role="alert">{visibleShareableSetupInspection.message}</p>
          ) : (
            <>
              <p>
                {context.gameData.monsters[
                  visibleShareableSetupInspection.review.envelope.data.form.monsterId
                ]?.name ?? visibleShareableSetupInspection.review.envelope.data.form.monsterId}
                {" · "}
                {visibleShareableSetupInspection.review.envelope.data.form.combatStyle}
              </p>
              <div className="shared-setup-summary" aria-label="Shared setup summary">
                <span>Player levels included</span>
                <span>
                  Cannon{" "}
                  {visibleShareableSetupInspection.review.envelope.data.cannon.enabled
                    ? "on"
                    : "off"}
                </span>
                <span>
                  {formatNumber(
                    Object.keys(
                      visibleShareableSetupInspection.review.envelope.data.lootPreferences
                    ).length
                  )}{" "}
                  loot choices
                </span>
                <span>Uses your current prices</span>
              </div>
              {visibleShareableSetupInspection.review.gameDataMismatch && (
                <p className="inline-status warning" role="status">
                  Different game-data version. Available ids were validated before loading.
                </p>
              )}
              {visibleShareableSetupInspection.review.droppedLootRowCount > 0 && (
                <p className="inline-status warning" role="status">
                  {formatNumber(visibleShareableSetupInspection.review.droppedLootRowCount)} stale
                  loot choices will be skipped.
                </p>
              )}
            </>
          )}
          <div className="shared-setup-actions">
            {visibleShareableSetupInspection.status === "ready" && (
              <button type="button" onClick={loadReceivedShareableSetup}>
                Load setup
              </button>
            )}
            <button type="button" onClick={() => setShareReviewDismissed(true)}>
              Dismiss
            </button>
          </div>
        </section>
      )}

      <PendingUndoStatus pendingUndo={pendingUndo} onUndo={undoPendingAction} />

      {legacyMigrationReport && (
        <section
          className={`legacy-migration-strip ${legacyMigrationTone(
            legacyMigrationReport,
            initialSavedSetup.loaded
          )}`}
          aria-label="Legacy setup migration"
        >
          <div className="section-title-row">
            <h2>Legacy data</h2>
            <span className={`status-pill ${legacyImportReady ? "ready" : ""}`}>
              {legacyMigrationStatus}
            </span>
          </div>
          <p className="legacy-migration-copy">
            This browser has data from the old app. Import compatible data, keep it for later, or
            clear known old keys.
          </p>
          <div className="legacy-migration-summary" aria-label="Legacy data summary">
            {legacyMigrationSummary.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="legacy-migration-outcomes" aria-label="Legacy migration outcome">
            {legacyOutcomeItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="legacy-migration-plan" aria-label="Legacy import and review plan">
            <div>
              <h3>Will import</h3>
              {legacyImportPlan.length > 0 ? (
                <ul>
                  {legacyImportPlan.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>No compatible legacy data can be imported by this flow.</p>
              )}
            </div>
            <div>
              <h3>Needs review or reset</h3>
              {legacyReviewPlan.length > 0 ? (
                <ul>
                  {legacyReviewPlan.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>No detected legacy data needs manual review.</p>
              )}
            </div>
          </div>
          <div className="legacy-key-table-wrap">
            <table className="legacy-key-table" aria-label="Legacy storage key review">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Found</th>
                  <th>Policy</th>
                  <th>Handling</th>
                  <th>Clear</th>
                </tr>
              </thead>
              <tbody>
                {legacyMigrationReport.keyReview.map((item) => (
                  <tr key={item.key} className={item.found ? "found" : undefined}>
                    <td>
                      <code>{item.key}</code>
                      <span>{item.label}</span>
                    </td>
                    <td>{item.found ? "found" : "not found"}</td>
                    <td>{legacyDispositionLabel(item.disposition)}</td>
                    <td>
                      {item.handling} {item.reason}
                    </td>
                    <td>{item.clearDeletes ? "delete on clear" : "not present"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {initialSavedSetup.loaded && (
            <p className="inline-status neutral">
              Your rewrite setup is already loaded; import replaces it only if you choose it.
            </p>
          )}
          {legacyMigrationReport.warnings.length > 0 && (
            <p className="inline-status neutral">
              Some legacy data cannot be imported into this rewrite setup.
            </p>
          )}
          <div className="legacy-migration-actions">
            <button type="button" disabled={!legacyImportReady} onClick={importLegacySetup}>
              Import compatible data
            </button>
            <button type="button" onClick={keepLegacyData}>
              Keep legacy data
            </button>
            {!legacyClearPending ? (
              <button
                type="button"
                className="danger-button"
                onClick={() => setLegacyClearPending(true)}
              >
                Clear legacy data
              </button>
            ) : (
              <>
                <p className="inline-status error">
                  Clear will remove these known legacy keys: {legacyClearKeys || "none"}.
                </p>
                <button type="button" className="danger-button" onClick={confirmClearLegacyData}>
                  Confirm clear
                </button>
                <button type="button" onClick={() => setLegacyClearPending(false)}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </section>
      )}

      <section className="workbench-shell" aria-label="Workbench shell">
        <aside className="player-sidebar" aria-label="Player sidebar">
          <section className="sidebar-section" aria-label="Player setup">
            <div className="section-title-row">
              <h2>Player</h2>
              <span className="status-pill ready">{form.combatStyle}</span>
            </div>
            <div className="segmented combat-type-buttons" aria-label="Combat type">
              {COMBAT_STYLE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={form.combatStyle === option.id ? "active" : undefined}
                  aria-pressed={form.combatStyle === option.id}
                  onClick={() => selectCombatStyle(option.id as CombatStyle)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="level-grid sidebar-levels" aria-label="Player levels">
              {form.combatStyle === "melee" && (
                <>
                  <NumberField
                    label="ATT"
                    value={form.levels.attack}
                    onChange={(value) => updateLevel("attack", value)}
                  />
                  <NumberField
                    label="STR"
                    value={form.levels.strength}
                    onChange={(value) => updateLevel("strength", value)}
                  />
                </>
              )}
              {form.combatStyle === "ranged" && (
                <NumberField
                  label="RNG"
                  value={form.levels.ranged}
                  onChange={(value) => updateLevel("ranged", value)}
                />
              )}
              {form.combatStyle === "magic" && (
                <NumberField
                  label="MAG"
                  value={form.levels.magic}
                  onChange={(value) => updateLevel("magic", value)}
                />
              )}
              <NumberField
                label="DEF"
                value={form.levels.defence}
                onChange={(value) => updateLevel("defence", value)}
              />
              <NumberField
                label="HP"
                value={form.levels.hitpoints}
                onChange={(value) => updateLevel("hitpoints", value)}
              />
              <NumberField
                label="Prayer lvl"
                value={form.levels.prayer}
                onChange={(value) => updateLevel("prayer", value)}
              />
            </div>
            <SelectField
              label="STYLE"
              value={form.styleId}
              options={styles}
              onChange={(styleId) => setFormSafe((current) => updateForm(current, { styleId }))}
            />
            <div className="sidebar-metrics" aria-label="Effective trip rates">
              {metricList([
                {
                  label: "Effective XP/hr",
                  value: formatNumber(viewModel.effectiveXpPerHour),
                  tone: "teal"
                },
                {
                  label: "Net GP/hr",
                  value: formatNumber(viewModel.trip.effectiveNetGpPerHour),
                  tone: "gold"
                },
                { label: "Player XP/hr", value: formatNumber(viewModel.playerEffectiveXpPerHour) },
                { label: "Cannon XP/hr", value: formatNumber(viewModel.cannonEffectiveXpPerHour) }
              ])}
            </div>
          </section>

          <section className="sidebar-section" aria-label="Hiscores">
            <div className="section-title-row">
              <h2>Hiscores</h2>
              <span className={`status-pill ${hiscoresAvailable ? "ready" : ""}`}>
                {hiscoresStatusText}
              </span>
            </div>
            <form className="hiscores-form" onSubmit={handleHiscoresLookup}>
              <div className="field">
                <label htmlFor="hiscores-player">Player</label>
                <input
                  id="hiscores-player"
                  type="text"
                  autoComplete="off"
                  value={hiscoresPlayer}
                  onChange={(event) => handleHiscoresPlayerChange(event.target.value)}
                />
              </div>
              <button type="submit" disabled={!hiscoresAvailable || hiscoresBusy}>
                {hiscoresBusy ? "Looking up" : "Lookup"}
              </button>
            </form>
            {hiscoresNotice && (
              <p
                className={`inline-status ${hiscoresNotice.tone}`}
                role={hiscoresNotice.tone === "error" ? "alert" : "status"}
              >
                {hiscoresNotice.message}
              </p>
            )}
            {hiscoresPreviewRows.length > 0 && (
              <div className="hiscores-preview">
                {hiscoresResponse && (
                  <p className="hiscores-preview-meta">
                    <span>
                      Preview for{" "}
                      <strong>
                        {hiscoresResponse.normalizedPlayer || hiscoresResponse.player}
                      </strong>
                    </span>
                    <span>Source: {hiscoresResponse.source.label}</span>
                    <span>Fetched: {hiscoresResponse.fetchedAt}</span>
                  </p>
                )}
                <table aria-label="Hiscores preview">
                  <thead>
                    <tr>
                      <th>Skill</th>
                      <th>Current</th>
                      <th>Hiscores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hiscoresPreviewRows.map((row) => (
                      <tr key={row.skill}>
                        <td>{row.skill}</td>
                        <td>{row.currentLevel ?? "-"}</td>
                        <td>{row.fetchedLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" disabled={!canApplyHiscores} onClick={applyHiscoresPreview}>
                  Apply
                </button>
              </div>
            )}
          </section>
        </aside>

        <section className="workbench-center" aria-label="Workbench center">
          <section className="setup-context-bar" aria-label="Setup context">
            <div className="setup-context-title">
              <h2>{currentMonster?.name ?? form.monsterId}</h2>
              <span>{setupStatus}</span>
            </div>
            <SelectField
              label="Monster"
              value={form.monsterId}
              options={monsters}
              onChange={selectTarget}
            />
            <div className="setup-context-actions" aria-label="Setup actions">
              <button type="button" disabled={activeSetupIsCustom} onClick={createCustomSetup}>
                Create custom setup
              </button>
              {hasCurrentCustomSetup ? (
                <button
                  type="button"
                  onClick={activeSetupIsCustom ? editDefaultSetup : editCustomSetup}
                >
                  {activeSetupIsCustom ? "Edit default" : "Edit custom"}
                </button>
              ) : (
                <button type="button" disabled>
                  Edit default
                </button>
              )}
              <button
                type="button"
                className="danger-button"
                disabled={!hasCurrentCustomSetup}
                onClick={removeCurrentCustomSetup}
              >
                Remove custom setup
              </button>
            </div>
            <div className="setup-context-metrics">
              {metricList([
                {
                  label: "DPS",
                  value: formatNumber(viewModel.combat.effectiveDps, 2),
                  tone: "teal"
                },
                { label: "XP/hr", value: formatNumber(viewModel.effectiveXpPerHour), tone: "teal" },
                {
                  label: "Net GP/hr",
                  value: formatNumber(viewModel.trip.effectiveNetGpPerHour),
                  tone: "gold"
                }
              ])}
            </div>
          </section>

          <nav className="tab-bar" aria-label="Workbench tabs" role="tablist">
            {WORKBENCH_TABS.map((tab, index) => (
              <button
                key={tab.id}
                id={`workbench-tab-${tab.id}`}
                type="button"
                role="tab"
                className={activeTab === tab.id ? "active" : undefined}
                aria-selected={activeTab === tab.id}
                aria-controls="workbench-active-panel"
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => activateWorkbenchTab(tab.id)}
                onKeyDown={(event) => handleWorkbenchTabKeyDown(event, index)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <section
            id="workbench-active-panel"
            className="active-pane"
            role="tabpanel"
            aria-label="Active workbench pane"
            aria-labelledby={`workbench-tab-${activeTab}`}
            tabIndex={-1}
          >
            <section className="dense-workbench" aria-label="Dense combat spreadsheet">
              <section
                className="compact-setup-strip"
                aria-label="Combat setup"
                hidden={activeTab !== "compare" && !COMBAT_STYLE_TAB_IDS.has(activeTab)}
              >
                <SelectField
                  label="TYPE"
                  value={form.combatStyle}
                  options={COMBAT_STYLE_OPTIONS}
                  onChange={(combatStyle) => selectCombatStyle(combatStyle as CombatStyle)}
                />
                <NumberField
                  label={primaryLevelLabel(form.combatStyle)}
                  value={form.levels[primarySkill]}
                  onChange={(value) => updateLevel(primarySkill, value)}
                />
                {form.combatStyle === "magic" ? (
                  <SelectField
                    label="SPELL"
                    value={form.spellId}
                    options={spellSelectOptions}
                    onChange={setSpellSelection}
                  />
                ) : form.combatStyle === "ranged" ? (
                  <ReadOnlyField label="-" value="-" disabled />
                ) : (
                  <NumberField
                    label="STR"
                    value={form.levels.strength}
                    onChange={(value) => updateLevel("strength", value)}
                  />
                )}
                <NumberField
                  label="DEF"
                  value={form.levels.defence}
                  onChange={(value) => updateLevel("defence", value)}
                />
                <SelectField
                  label="STANCE"
                  value={form.styleId}
                  options={styles}
                  onChange={(styleId) => setFormSafe((current) => updateForm(current, { styleId }))}
                />
                <CompactSelectionSelectField
                  label="PRAY"
                  value={selectedPrayer}
                  options={PRAYER_OPTIONS}
                  extraCount={extraPrayerCount}
                  onChange={(prayer) =>
                    setFormSafe((current) =>
                      updateForm(current, {
                        prayers: setPrimaryPrayerSelection(current.prayers, prayer)
                      })
                    )
                  }
                />
                <CompactSelectionSelectField
                  label="POT"
                  value={selectedBoost}
                  options={BOOST_OPTIONS}
                  extraCount={extraBoostCount}
                  onChange={(boost) =>
                    setFormSafe((current) =>
                      updateForm(current, {
                        boosts: setPrimaryBoostSelection(current.boosts, boost)
                      })
                    )
                  }
                />
                <OptionalNumberField
                  label={accuracyLabel}
                  value={form.manualOverrides.accuracyBonus}
                  min={-250}
                  max={350}
                  placeholder={derivedAccuracyPlaceholder}
                  onChange={(value) => setManualOverride("accuracyBonus", value)}
                />
                <OptionalNumberField
                  label={damageLabel}
                  value={form.manualOverrides.damageBonus}
                  min={-250}
                  max={350}
                  placeholder={derivedDamagePlaceholder}
                  onChange={(value) => setManualOverride("damageBonus", value)}
                />
                <OptionalNumberField
                  label="SPD"
                  value={form.manualOverrides.attackSpeedSec}
                  min={0.6}
                  max={12}
                  step={0.1}
                  placeholder={derivedSpeedPlaceholder}
                  onChange={(value) => setManualOverride("attackSpeedSec", value)}
                />
                <ReadOnlyField
                  label="F/KL"
                  value={formatNumber(viewModel.trip.trip.foodPerKill, 2)}
                />
                <SelectField
                  label="TARGET"
                  value={form.monsterId}
                  options={monsters}
                  onChange={selectTarget}
                />
              </section>

              <section
                className="dense-metric-strip"
                aria-label="Simulation results"
                hidden={activeTab !== "stats" && activeTab !== "compare"}
              >
                {metric("DPS", formatNumber(viewModel.combat.effectiveDps, 2), "teal")}
                {metric("MAX HIT", formatNumber(viewModel.combat.maxHit, 1))}
                {metric("HIT %", `${formatNumber(viewModel.combat.hitChance * 100, 1)}%`)}
                {metric("TTK", formatDuration(viewModel.combat.ttkSec))}
                {metric("KILLS/HR", formatNumber(viewModel.trip.killsPerHour))}
                {metric("XP/HR", formatNumber(viewModel.effectiveXpPerHour), "teal")}
                {metric("GP/HR", formatNumber(viewModel.trip.gpPerHour))}
                {metric("GP/HR NET", formatNumber(viewModel.trip.effectiveNetGpPerHour), "gold")}
                {metric("SUPPLY/KILL", formatNumber(viewModel.trip.supply.supplyCostPerKill))}
                {metric("GP/KILL", formatNumber(viewModel.trip.gpPerKill))}
              </section>
              <div
                className="calculation-warning-slot"
                hidden={activeTab !== "stats" && activeTab !== "compare"}
              >
                <CalculationWarningSummary
                  warnings={viewModel.moneyWarnings}
                  label="Result price warnings"
                />
                <ActiveAssumptionsSummary
                  summary={viewModel.activeAssumptions}
                  onReview={reviewActiveAssumption}
                  onReset={resetActiveAssumption}
                />
              </div>

              <section
                className="stats-analysis-pane"
                aria-label="Stats analysis"
                hidden={activeTab !== "stats"}
              >
                <section
                  className="stats-panel source-breakdown-panel"
                  aria-label="Source breakdown"
                >
                  <div className="section-title-row">
                    <div>
                      <h2>Source breakdown</h2>
                      <span className="section-subtitle">DPS, XP and supply sources</span>
                    </div>
                    <span className="status-pill ready">
                      {formatNumber(viewModel.statsSourceBreakdown.rows.length)} sources
                    </span>
                  </div>
                  <div
                    className="source-breakdown-grid"
                    role="list"
                    aria-label="Source breakdown rows"
                  >
                    {viewModel.statsSourceBreakdown.rows.map((row) => (
                      <article
                        className={`source-breakdown-row ${row.status}`}
                        role="listitem"
                        aria-label={`${row.label}: ${row.statusLabel}`}
                        key={row.id}
                      >
                        <div className="source-breakdown-heading">
                          <div>
                            <strong>{row.label}</strong>
                          </div>
                          <em>{row.statusLabel}</em>
                        </div>
                        <div className="source-breakdown-metrics">
                          <div>
                            <span>DPS</span>
                            <strong>{row.dpsLabel}</strong>
                            {row.dpsDetail && <small>{row.dpsDetail}</small>}
                          </div>
                          <div>
                            <span>XP/hr</span>
                            <strong>{row.xpPerHourLabel}</strong>
                          </div>
                          <div>
                            <span>Hit %</span>
                            <strong>{row.hitChanceLabel}</strong>
                          </div>
                          <div>
                            <span>Max</span>
                            <strong>{row.maxHitLabel}</strong>
                          </div>
                          <div>
                            <span>Supply/hr</span>
                            <strong>{row.supplyCostPerHourLabel}</strong>
                          </div>
                          <div>
                            <span>Supply/kill</span>
                            <strong>{row.supplyCostPerKillLabel}</strong>
                          </div>
                        </div>
                        <ul>
                          {row.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                  <div className="source-detail-header">
                    <h3>Source details</h3>
                    <span>Special attack and cannon</span>
                  </div>
                  <div className="source-detail-grid" role="list" aria-label="Source detail panels">
                    {viewModel.statsSourceBreakdown.details
                      .filter((detail) => detail.id === "special-attack" || detail.id === "cannon")
                      .map((detail) => (
                        <StatsSourceDetailCard detail={detail} key={detail.id} />
                      ))}
                  </div>
                </section>

                <StatsCombatRollDetail detail={viewModel.combatRollDetail} />

                <div className="stats-analysis-grid">
                  <section className="stats-panel" aria-label="XP routing">
                    <div className="section-title-row">
                      <div>
                        <h2>XP routing</h2>
                        <span className="section-subtitle">Effective and skill rows</span>
                      </div>
                      <span className="status-pill ready">
                        {viewModel.xpRouting.effectiveXpPerHourLabel} XP/hr
                      </span>
                    </div>
                    <div className="xp-routing-chip-list" role="list" aria-label="XP routing chips">
                      {viewModel.xpRouting.rows.map((row) => (
                        <div
                          className={`xp-routing-chip ${row.status}`}
                          role="listitem"
                          aria-label={`${row.label}: ${row.value}; ${row.statusLabel}; ${row.note}`}
                          key={row.id}
                        >
                          <span>{row.label}</span>
                          <strong>{row.value}</strong>
                          <em>{row.statusLabel}</em>
                          <small>{row.note}</small>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="stats-panel" aria-label="Trip and banking summary">
                    <div className="section-title-row">
                      <div>
                        <h2>Trip &amp; banking</h2>
                        <span className="section-subtitle">Current effective-rate inputs</span>
                      </div>
                      <span className="status-pill ready">
                        {formatNumber(viewModel.trip.effectiveKph)} K/hr
                      </span>
                    </div>
                    <div className="stats-summary-table-wrap">
                      <table className="stats-summary-table" aria-label="Trip and banking metrics">
                        <tbody>
                          {viewModel.tripBankingSummary.rows.map((row) => (
                            <tr className={row.tone} key={row.id}>
                              <th scope="row">{row.label}</th>
                              <td>{row.value}</td>
                              <td>{row.note}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>

                <section className="hit-distribution-panel" aria-label="Hit distribution">
                  <div className="section-title-row">
                    <div>
                      <h2>Hit distribution</h2>
                      <span className="section-subtitle">Normal player attack</span>
                    </div>
                    <span className="status-pill ready">
                      {viewModel.hitDistribution.hitChanceLabel} hit
                    </span>
                  </div>
                  <HitDistributionChart
                    distribution={viewModel.hitDistribution}
                    ariaLabel="Hit distribution buckets"
                    showPeakBucket
                  />
                </section>
              </section>

              <section
                className="equipment-pane"
                aria-label="Equipment loadout"
                hidden={!COMBAT_STYLE_TAB_IDS.has(activeTab)}
              >
                <div className="section-title-row">
                  <h2>{form.combatStyle} loadout</h2>
                  <span className={`status-pill ${currentWeapon ? "ready" : ""}`}>
                    {currentWeapon?.name ?? form.weaponId}
                  </span>
                </div>
                <div className="loadout-grid" aria-label="Style loadout controls">
                  <SearchableSelectField
                    label="Weapon"
                    value={form.weaponId}
                    options={weaponSelectOptions}
                    onChange={setWeaponSelection}
                    searchPlaceholder="Search weapons"
                  />
                  {form.combatStyle === "ranged" && (
                    <SearchableSelectField
                      label="Ammo"
                      value={form.ammoId}
                      options={ammoSelectOptions}
                      disabled={currentWeapon?.sub === "thrown"}
                      onChange={setAmmoSelection}
                      searchPlaceholder="Search ammo"
                    />
                  )}
                  {form.combatStyle === "magic" && (
                    <SearchableSelectField
                      label="Spell"
                      value={form.spellId}
                      options={spellSelectOptions}
                      onChange={setSpellSelection}
                      searchPlaceholder="Search spells"
                    />
                  )}
                  <SelectField
                    label="Style"
                    value={form.styleId}
                    options={styles}
                    onChange={(styleId) =>
                      setFormSafe((current) => updateForm(current, { styleId }))
                    }
                  />
                  <SelectField
                    label="Prayer"
                    value={selectedPrayer}
                    options={PRAYER_OPTIONS}
                    onChange={(prayer) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          prayers: setPrimaryPrayerSelection(current.prayers, prayer)
                        })
                      )
                    }
                  />
                  <SelectField
                    label="Boost"
                    value={selectedBoost}
                    options={BOOST_OPTIONS}
                    onChange={(boost) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          boosts: setPrimaryBoostSelection(current.boosts, boost)
                        })
                      )
                    }
                  />
                  <MultiSelectionField
                    label="Prayer"
                    options={PRAYER_SELECTION_OPTIONS}
                    selectedIds={form.prayers}
                    onToggle={(prayer, selected) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          prayers: togglePrayerSelection(current.prayers, prayer, selected)
                        })
                      )
                    }
                  />
                  <MultiSelectionField
                    label="Boost"
                    options={BOOST_SELECTION_OPTIONS}
                    selectedIds={form.boosts}
                    onToggle={(boost, selected) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          boosts: toggleBoostSelection(current.boosts, boost, selected)
                        })
                      )
                    }
                  />
                  <label className="toggle sustained-toggle">
                    <input
                      type="checkbox"
                      checked={form.sustained}
                      onChange={(event) =>
                        setFormSafe((current) =>
                          updateForm(current, {
                            sustained: event.target.checked,
                            repotThreshold: event.target.checked
                              ? (current.repotThreshold ?? 65)
                              : null
                          })
                        )
                      }
                    />
                    <span>Sustained</span>
                  </label>
                  <NumberField
                    label="Repot"
                    value={form.repotThreshold ?? 65}
                    min={1}
                    max={120}
                    disabled={!form.sustained}
                    onChange={(repotThreshold) =>
                      setFormSafe((current) => updateForm(current, { repotThreshold }))
                    }
                  />
                </div>
                <div className="manual-overrides-panel" aria-label="Manual combat overrides">
                  <div className="section-title-row">
                    <h3>Manual overrides</h3>
                    <span className={`status-pill ${activeManualOverrideCount ? "ready" : ""}`}>
                      {activeManualOverrideCount
                        ? `${activeManualOverrideCount} active`
                        : "derived"}
                    </span>
                  </div>
                  <div className="manual-overrides-grid">
                    <OptionalNumberField
                      label="Accuracy bonus"
                      value={form.manualOverrides.accuracyBonus}
                      min={-250}
                      max={350}
                      placeholder={derivedAccuracyPlaceholder}
                      onChange={(value) => setManualOverride("accuracyBonus", value)}
                    />
                    <OptionalNumberField
                      label="Damage bonus"
                      value={form.manualOverrides.damageBonus}
                      min={-250}
                      max={350}
                      placeholder={derivedDamagePlaceholder}
                      onChange={(value) => setManualOverride("damageBonus", value)}
                    />
                    <OptionalNumberField
                      label="Attack speed sec"
                      value={form.manualOverrides.attackSpeedSec}
                      min={0.6}
                      max={12}
                      step={0.1}
                      placeholder={derivedSpeedPlaceholder}
                      onChange={(value) => setManualOverride("attackSpeedSec", value)}
                    />
                    <button
                      type="button"
                      className="reset-overrides-button"
                      disabled={activeManualOverrideCount === 0}
                      onClick={resetManualOverrides}
                    >
                      Reset all overrides
                    </button>
                  </div>
                </div>
                <div className="equipment-slot-grid" aria-label="Equipment slots">
                  {EQUIPMENT_SLOTS.map((slot) => {
                    const quickAction = gearQuickActions[slot];
                    return (
                      <div className="gear-quick-field" key={slot}>
                        <SearchableSelectField
                          label={EQUIPMENT_SLOT_LABELS[slot]}
                          value={
                            slot === "shield" && currentWeaponTwoHanded
                              ? "none"
                              : (form.gear[slot] ?? "none")
                          }
                          options={gearSelectOptions[slot]}
                          disabled={slot === "shield" && currentWeaponTwoHanded}
                          onChange={(itemId) => setGearSelection(slot, itemId)}
                          searchPlaceholder={`Search ${EQUIPMENT_SLOT_LABELS[slot].toLowerCase()}`}
                        />
                        <button
                          type="button"
                          className="gear-quick-action"
                          disabled={quickAction.disabled}
                          title={quickAction.reason}
                          aria-label={`Best ${EQUIPMENT_SLOT_LABELS[slot]}`}
                          onClick={() => setGearSelection(slot, quickAction.itemId)}
                        >
                          {quickAction.reason === "Shield locked by two-handed weapon"
                            ? "Locked"
                            : "Best"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {currentWeaponTwoHanded && (
                  <p className="inline-status neutral">Shield locked by two-handed weapon</p>
                )}
                {viewModel.setupRequirements.hasWarnings && (
                  <div className="calculation-warning-slot">
                    <CalculationWarningSummary
                      warnings={viewModel.setupRequirements.warnings}
                      label="Setup requirement warnings"
                      title="Requirement warnings"
                    />
                    <p className="inline-status neutral">
                      {viewModel.setupRequirements.policyLabel}
                    </p>
                  </div>
                )}
                {loadoutBonuses && (
                  <div className="bonus-summary" aria-label="Equipment bonus summary">
                    <div>
                      <h3>Offensive bonuses</h3>
                      <div className="bonus-grid">
                        {OFFENSIVE_BONUS_LABELS.map(([key, label]) => (
                          <div className="bonus-cell" key={key}>
                            <span>{label}</span>
                            <strong>{signedInteger(loadoutBonuses.totals[key])}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3>Defensive bonuses</h3>
                      <div className="bonus-grid">
                        {DEFENSIVE_BONUS_LABELS.map(([key, label]) => (
                          <div className="bonus-cell" key={key}>
                            <span>{label}</span>
                            <strong>{signedInteger(loadoutBonuses.totals[key])}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section
                className="special-strip"
                aria-label="Special attack"
                hidden={!COMBAT_STYLE_TAB_IDS.has(activeTab)}
              >
                <div className="section-title-row">
                  <h2>Special attack</h2>
                  <span className={`status-pill ${viewModel.combat.specialAttack ? "ready" : ""}`}>
                    {specialStatus}
                  </span>
                </div>
                <div className="special-body">
                  <SelectField
                    label="Spec weapon"
                    value={selectedSpecialWeapon}
                    options={specialAttackOptions}
                    disabled={specialAttackDisabled}
                    onChange={setSpecialAttackWeapon}
                  />
                  {specialAttackMeta?.requiresAmmo && (
                    <SelectField
                      label="Spec ammo"
                      value={selectedSpecialAmmo}
                      options={arrowAmmoOptions}
                      disabled={specialAttackDisabled || arrowAmmoOptions.length === 0}
                      onChange={(ammoId) =>
                        setFormSafe((current) =>
                          updateForm(current, {
                            specialAttack: { ...current.specialAttack, ammoId }
                          })
                        )
                      }
                    />
                  )}
                  {form.combatStyle === "magic" && (
                    <p className="inline-status neutral">
                      Magic special attacks are not modeled yet.
                    </p>
                  )}
                  {dbaSpecActive && (
                    <p className="inline-status neutral">
                      DBA boost uses spec energy as a boost; DPS-special selection is paused.
                    </p>
                  )}
                  {viewModel.combat.specialAttack && (
                    <div className="special-output" aria-label="Special attack metrics">
                      {metricList([
                        {
                          label: "Spec max hit",
                          value:
                            viewModel.combat.specialAttack.hits > 1
                              ? `${formatNumber(viewModel.combat.specialAttack.maxHit)} x${viewModel.combat.specialAttack.hits}`
                              : formatNumber(viewModel.combat.specialAttack.maxHit)
                        },
                        {
                          label: "Spec hit %",
                          value: `${formatNumber(viewModel.combat.specialAttack.hitChance * 100, 1)}%`
                        },
                        {
                          label: "Specs/hr",
                          value: formatNumber(viewModel.combat.specialAttack.specsPerHour, 1)
                        },
                        {
                          label: "DPS with spec",
                          value: formatNumber(viewModel.combat.specialAttack.dpsWithSpec, 2),
                          tone: "teal"
                        },
                        {
                          label: "DPS gain",
                          value: signedPercent(viewModel.combat.specialAttack.dpsGainPct),
                          tone: viewModel.combat.specialAttack.dpsGainPct >= 0 ? "teal" : "gold"
                        }
                      ])}
                      {viewModel.specialWarnings.length > 0 && (
                        <div className="calculation-warning-slot">
                          <CalculationWarningSummary
                            warnings={viewModel.specialWarnings}
                            label="Special attack warnings"
                            title="Special note"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section
                className="loot-strip"
                aria-label="Current monster loot"
                hidden={activeTab !== "loot"}
              >
                <div className="section-title-row">
                  <h2>Loot actions</h2>
                  <span className="status-pill">
                    {formatNumber(viewModel.lootRows.length)} drops
                  </span>
                </div>
                <div className="loot-toolbar">
                  <SelectField
                    label="High alch"
                    value={highAlchEnabled ? "enabled" : "disabled"}
                    options={HIGH_ALCH_OPTIONS}
                    onChange={(value) =>
                      setLootSettingsForCurrentMonster({ highAlch: value === "enabled" })
                    }
                  />
                  <SelectField
                    label="Overhead"
                    value={lootOverheadMode}
                    options={OVERHEAD_MODE_OPTIONS}
                    onChange={(value) =>
                      setLootSettingsForCurrentMonster({
                        overheadSec: value === "manual" ? lootOverheadValue : null
                      })
                    }
                  />
                  <DecimalField
                    label="Overhead sec"
                    value={lootOverheadValue}
                    min={0}
                    max={600}
                    step={0.5}
                    disabled={lootOverheadMode === "auto"}
                    onChange={(value) => setLootSettingsForCurrentMonster({ overheadSec: value })}
                  />
                  <SelectField
                    label="Talisman spot"
                    value={currentLootSettings.talismanSpot}
                    options={TALISMAN_SPOT_OPTIONS}
                    onChange={(value) =>
                      setLootSettingsForCurrentMonster({
                        talismanSpot: value === "overground" ? "overground" : "underground"
                      })
                    }
                  />
                  <button type="button" onClick={resetCurrentLootSettings}>
                    Reset settings
                  </button>
                  <button
                    type="button"
                    disabled={viewModel.lootSummary.overrideCount === 0}
                    onClick={resetCurrentLootOverrides}
                  >
                    Reset current
                  </button>
                  <button
                    type="button"
                    disabled={viewModel.lootRows.length === 0}
                    onClick={optimizeCurrentLoot}
                  >
                    Optimize net GP/hr
                  </button>
                  <span className="loot-status" aria-live="polite">
                    {lootNotice ?? `${formatNumber(viewModel.lootSummary.overrideCount)} overrides`}
                  </span>
                </div>
                <div className="loot-output" aria-label="Loot action summary">
                  {metricList([
                    {
                      label: "Default net GP/hr",
                      value: formatNumber(viewModel.lootSummary.defaultEffectiveNetGpPerHour)
                    },
                    {
                      label: "Current delta",
                      value: formatDelta(viewModel.lootSummary.currentDeltaNetGpPerHour),
                      tone: viewModel.lootSummary.currentDeltaNetGpPerHour >= 0 ? "teal" : "gold"
                    },
                    { label: "Loot GP/kill", value: formatNumber(viewModel.trip.gpPerKill) },
                    {
                      label: "Effective net",
                      value: formatNumber(viewModel.trip.effectiveNetGpPerHour)
                    },
                    { label: "High alch", value: highAlchEnabled ? "On" : "Off" },
                    {
                      label: "Overhead",
                      value:
                        lootOverheadMode === "auto"
                          ? `Auto ${formatNumber(derivedOverheadSec, 1)}s`
                          : `${formatNumber(lootOverheadValue, 1)}s`
                    },
                    {
                      label: "Talisman",
                      value: optionLabel(TALISMAN_SPOT_OPTIONS, currentLootSettings.talismanSpot)
                    }
                  ])}
                </div>
                <CalculationWarningSummary
                  warnings={viewModel.moneyWarnings}
                  label="Loot price warnings"
                />
                <section className="loot-composition" aria-label="Loot value composition">
                  <div className="loot-section-heading">
                    <h3>Loot value composition</h3>
                    <span>
                      {formatNumber(viewModel.lootSummary.valueComposition.displayedGpPerKill, 1)}{" "}
                      GP/kill
                    </span>
                  </div>
                  <table className="loot-composition-table">
                    <thead>
                      <tr>
                        <th>Contributor</th>
                        <th>Action</th>
                        <th className="numeric">GP/kill</th>
                        <th className="numeric">Share</th>
                        <th>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewModel.lootSummary.valueComposition.rows.length === 0 ? (
                        <tr>
                          <td colSpan={5}>No positive loot value</td>
                        </tr>
                      ) : (
                        viewModel.lootSummary.valueComposition.rows.map((row) => (
                          <tr key={row.rowId ?? "other-drops"}>
                            <td>
                              <span>{row.name}</span>
                              {row.childCount > 0 && (
                                <small>{formatNumber(row.childCount)} nested rows</small>
                              )}
                            </td>
                            <td>{row.actionLabel}</td>
                            <td className="numeric">{formatNumber(row.gpPerKill, 1)}</td>
                            <td className="numeric">
                              {row.shareOfPositivePct === null
                                ? "-"
                                : `${formatNumber(row.shareOfPositivePct, 1)}%`}
                            </td>
                            <td>{row.stateLabel ?? (row.isOther ? "Tail" : "-")}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {viewModel.lootSummary.valueComposition.note && (
                    <p className="loot-composition-note">
                      {viewModel.lootSummary.valueComposition.note}
                    </p>
                  )}
                </section>
                <div className="loot-table-wrap">
                  <table className="loot-table" aria-label="Current monster drops">
                    <thead>
                      <tr>
                        <th>Drop</th>
                        <th>Action</th>
                        <th className="numeric">Delta/hr</th>
                        <th>Impacts</th>
                        <th className="numeric">EV/kill</th>
                        <th className="numeric">Chance</th>
                        <th className="numeric">Qty</th>
                        <th className="numeric">Price</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewModel.lootRows.length === 0 ? (
                        <tr>
                          <td colSpan={9}>No drops</td>
                        </tr>
                      ) : (
                        viewModel.lootRows.map((row) => (
                          <tr
                            key={row.rowId}
                            className={[
                              row.isOverride ? "active" : null,
                              row.stateLabel ? "loot-row-attention" : null
                            ]
                              .filter((item): item is string => item !== null)
                              .join(" ")}
                          >
                            <td className="loot-name-cell">
                              <span>{row.name}</span>
                              <small>{row.key ?? row.tag ?? row.rowId}</small>
                              {row.stateLabel && (
                                <small className="loot-state">{row.stateLabel}</small>
                              )}
                            </td>
                            <td>
                              <select
                                aria-label={`Action for ${row.name} ${row.rowId}`}
                                className="action-select"
                                value={row.pref}
                                disabled={row.availableActions.length === 1}
                                onChange={(event) =>
                                  setLootActionForCurrentMonster(row, event.target.value)
                                }
                              >
                                {row.availableActions.map((action) => (
                                  <option key={action} value={action}>
                                    {actionLabel(action)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="numeric">
                              {formatDelta(row.selectedDeltaNetGpPerHour)}
                            </td>
                            <td className="loot-impact-cell">
                              <details className="loot-row-disclosure">
                                <summary>Compare actions</summary>
                                <table
                                  className="loot-impact-table"
                                  aria-label={`Action impact for ${row.name}`}
                                >
                                  <thead>
                                    <tr>
                                      <th>Action</th>
                                      <th className="numeric">Net GP/hr</th>
                                      <th className="numeric">Delta</th>
                                      <th className="numeric">Row GP/kill</th>
                                      <th>Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {row.actionImpacts.map((impact) => (
                                      <tr key={impact.action}>
                                        <td>
                                          <span>{impact.label}</span>
                                          <small>
                                            {[
                                              impact.isSelected ? "selected" : null,
                                              impact.isDefault ? "default" : null
                                            ]
                                              .filter((item): item is string => item !== null)
                                              .join(" / ") || "-"}
                                          </small>
                                        </td>
                                        <td className="numeric">
                                          {formatNumber(impact.effectiveNetGpPerHour)}
                                        </td>
                                        <td className="numeric">
                                          {formatDelta(impact.deltaNetGpPerHour)}
                                        </td>
                                        <td className="numeric">
                                          {formatNumber(impact.gpPerKillContribution, 1)}
                                        </td>
                                        <td>
                                          {[impact.stateLabel, ...impact.notes]
                                            .filter((item): item is string => !!item)
                                            .join("; ") || "-"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </details>
                            </td>
                            <td className="numeric">{formatNumber(row.effectiveEvGp, 1)}</td>
                            <td className="numeric">{formatNumber(row.chance * 100, 2)}%</td>
                            <td className="numeric">{formatNumber(row.qtyAvg, 1)}</td>
                            <td className="numeric">{formatNumber(row.price)}</td>
                            <td>
                              <details className="loot-row-disclosure">
                                <summary>
                                  {row.expandedRows.length > 0
                                    ? `${formatNumber(row.expandedRows.length)} nested rows`
                                    : "Value details"}
                                </summary>
                                <div className="loot-row-detail-panel">
                                  <dl className="loot-value-facts">
                                    {row.valueDetails.map((detail) => (
                                      <div
                                        className={detail.tone}
                                        key={`${row.rowId}-${detail.label}`}
                                      >
                                        <dt>{detail.label}</dt>
                                        <dd>{detail.value}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                  <div
                                    className={[
                                      "loot-history-context",
                                      row.historyContext.tracked ? null : "empty"
                                    ]
                                      .filter((item): item is string => item !== null)
                                      .join(" ")}
                                    aria-label={`Price history for ${row.name}`}
                                  >
                                    <div className="loot-history-heading">
                                      <strong>Local history</strong>
                                      <span>{row.historyContext.statusLabel}</span>
                                    </div>
                                    {row.historyContext.tracked ? (
                                      <dl className="loot-history-facts">
                                        <div>
                                          <dt>Latest</dt>
                                          <dd>{optionalPrice(row.historyContext.latestPrice)}</dd>
                                        </div>
                                        <div>
                                          <dt>Baseline</dt>
                                          <dd>{optionalPrice(row.historyContext.baselinePrice)}</dd>
                                        </div>
                                        <div>
                                          <dt>Delta</dt>
                                          <dd>{optionalDelta(row.historyContext.gpDelta)}</dd>
                                        </div>
                                        <div>
                                          <dt>Percent</dt>
                                          <dd>
                                            {optionalPercent(row.historyContext.percentDelta)}
                                          </dd>
                                        </div>
                                      </dl>
                                    ) : (
                                      <small>
                                        {row.historyContext.itemId
                                          ? `Item ${row.historyContext.itemId} is not in local history`
                                          : "This parent row has no item key"}
                                      </small>
                                    )}
                                  </div>
                                  {row.expandedRows.length > 0 && (
                                    <table
                                      className="loot-nested-table"
                                      aria-label={`Nested rows for ${row.name}`}
                                    >
                                      <thead>
                                        <tr>
                                          <th>Child</th>
                                          <th>Key/tag</th>
                                          <th className="numeric">Weight</th>
                                          <th className="numeric">Chance</th>
                                          <th className="numeric">Qty</th>
                                          <th className="numeric">Price</th>
                                          <th className="numeric">EV share</th>
                                          <th>Notes</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {row.expandedRows.map((detail) => (
                                          <tr key={`${row.rowId}-${detail.label}`}>
                                            <td>{detail.label}</td>
                                            <td>{detail.key ?? detail.tag ?? "-"}</td>
                                            <td className="numeric">{detail.weightLabel ?? "-"}</td>
                                            <td className="numeric">
                                              {detail.chance === null
                                                ? "-"
                                                : `${formatNumber(detail.chance * 100, 2)}%`}
                                            </td>
                                            <td className="numeric">{detail.qtyLabel ?? "-"}</td>
                                            <td className="numeric">
                                              {detail.price === null
                                                ? "-"
                                                : formatNumber(detail.price)}
                                            </td>
                                            <td className="numeric">
                                              {detail.evGp === null
                                                ? "-"
                                                : `${formatNumber(detail.evGp, 1)} gp`}
                                            </td>
                                            <td>{detail.notes.join("; ") || "-"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </details>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section
                className="trip-strip"
                aria-label="Trip assumptions"
                hidden={activeTab !== "trip"}
              >
                <div className="section-title-row">
                  <h2>Trip assumptions</h2>
                  <span className="status-pill">{tripStatus}</span>
                </div>
                <div className="trip-body">
                  <SearchableSelectField
                    label="Food"
                    value={form.trip.foodKey}
                    options={FOOD_OPTIONS}
                    searchPlaceholder="Search food"
                    onChange={(foodKey) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, foodKey }
                        })
                      )
                    }
                  />
                  <SelectField
                    label="Bank time"
                    value={bankTimeMode}
                    options={BANK_TIME_MODE_OPTIONS}
                    onChange={(mode) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: {
                            ...current.trip,
                            bankSeconds:
                              mode === "manual"
                                ? Math.max(0, Math.min(3600, bankSecondsValue))
                                : null
                          }
                        })
                      )
                    }
                  />
                  <NumberField
                    label="Bank sec"
                    value={bankSecondsValue}
                    min={0}
                    max={3600}
                    disabled={bankTimeMode === "auto"}
                    onChange={(bankSeconds) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, bankSeconds }
                        })
                      )
                    }
                  />
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={form.trip.singleDose}
                      onChange={(event) =>
                        setFormSafe((current) =>
                          updateForm(current, {
                            trip: { ...current.trip, singleDose: event.target.checked }
                          })
                        )
                      }
                    />
                    <span>Single-dose</span>
                  </label>
                  <NumberField
                    label="Potion vials"
                    value={form.trip.potionSets}
                    min={0}
                    max={28}
                    disabled={form.trip.singleDose}
                    onChange={(potionSets) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, potionSets }
                        })
                      )
                    }
                  />
                  <NumberField
                    label="Potion doses"
                    value={form.trip.potionDoses}
                    min={0}
                    max={112}
                    disabled={!form.trip.singleDose}
                    onChange={(potionDoses) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, potionDoses }
                        })
                      )
                    }
                  />
                  <div
                    className={`potion-recommendation ${potionRecommendationClass}`}
                    aria-label="Potion recommendation"
                    aria-live="polite"
                  >
                    <div className="potion-recommendation-header">
                      <span>Potion recommendation</span>
                      <strong>{potionRecommendationStatus}</strong>
                    </div>
                    <dl className="potion-recommendation-metrics">
                      <div>
                        <dt>Recommended carry</dt>
                        <dd>{potionRecommendationCarry}</dd>
                      </div>
                      <div>
                        <dt>Repot interval</dt>
                        <dd>{potionRecommendationInterval}</dd>
                      </div>
                      <div>
                        <dt>Trip estimate</dt>
                        <dd>{potionRecommendationTrip}</dd>
                      </div>
                    </dl>
                    <p>{potionRecommendation.reason}</p>
                    {potionRecommendation.warnings.map((warning) => (
                      <p className="potion-recommendation-warning" key={warning}>
                        {warning}
                      </p>
                    ))}
                    <button
                      type="button"
                      className="potion-recommendation-apply"
                      disabled={!potionRecommendation.canApply}
                      onClick={applyPotionRecommendation}
                    >
                      Apply recommendation
                    </button>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={form.trip.teleport}
                      onChange={(event) =>
                        setFormSafe((current) =>
                          updateForm(current, {
                            trip: { ...current.trip, teleport: event.target.checked }
                          })
                        )
                      }
                    />
                    <span>Teleport item</span>
                  </label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={recoverAmmoApplies && form.trip.recoverAmmo}
                      disabled={!recoverAmmoApplies}
                      onChange={(event) =>
                        setFormSafe((current) =>
                          updateForm(current, {
                            trip: { ...current.trip, recoverAmmo: event.target.checked }
                          })
                        )
                      }
                    />
                    <span>Recover ammo</span>
                  </label>
                  {dbaSpecActive && (
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={form.trip.dbaRestore}
                        onChange={(event) =>
                          setFormSafe((current) =>
                            updateForm(current, {
                              trip: { ...current.trip, dbaRestore: event.target.checked }
                            })
                          )
                        }
                      />
                      <span>DBA restore</span>
                    </label>
                  )}
                  <NumberField
                    label="Rune slots"
                    value={form.trip.runeSlots}
                    min={0}
                    max={28}
                    disabled={!runeSlotsApplies}
                    onChange={(runeSlots) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, runeSlots }
                        })
                      )
                    }
                  />
                  <SelectField
                    label="Safespot"
                    value={safespotControlValue(form.trip.safespot)}
                    options={SAFESPOT_OPTIONS}
                    onChange={(safespot) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, safespot: safespotFromControl(safespot) }
                        })
                      )
                    }
                  />
                  <SelectField
                    label="Protect"
                    value={form.trip.protect}
                    options={PROTECT_OPTIONS}
                    onChange={(protect) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: {
                            ...current.trip,
                            protect: protect as CombatSetupFormState["trip"]["protect"]
                          }
                        })
                      )
                    }
                  />
                  <SelectField
                    label="Prayer mode"
                    value={form.trip.prayerMode}
                    options={PRAYER_MODE_OPTIONS}
                    onChange={(prayerMode) =>
                      setFormSafe((current) => {
                        const nextMode = prayerMode as CombatSetupFormState["trip"]["prayerMode"];
                        return updateForm(current, {
                          trip: {
                            ...current.trip,
                            prayerMode: nextMode,
                            prayerPotionSets:
                              nextMode === "potions" ? current.trip.prayerPotionSets : null,
                            prayerPotionDoses:
                              nextMode === "potions" ? current.trip.prayerPotionDoses : null,
                            altarSeconds: nextMode === "altar" ? current.trip.altarSeconds : null
                          }
                        });
                      })
                    }
                  />
                  <SelectField
                    label="Prayer restore"
                    value={prayerRestoreMode}
                    options={PRAYER_RESTORE_MODE_OPTIONS}
                    disabled={form.trip.prayerMode !== "potions"}
                    onChange={(mode) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: {
                            ...current.trip,
                            prayerPotionSets:
                              mode === "manual_vials"
                                ? Math.max(0, Math.min(28, prayerVialsValue))
                                : null,
                            prayerPotionDoses:
                              mode === "manual_doses"
                                ? Math.max(0, Math.min(112, prayerDosesValue))
                                : null
                          }
                        })
                      )
                    }
                  />
                  <NumberField
                    label={prayerRestoreMode === "manual_doses" ? "Prayer doses" : "Prayer vials"}
                    value={prayerRestoreValue}
                    min={0}
                    max={prayerRestoreMode === "manual_doses" ? 112 : 28}
                    disabled={form.trip.prayerMode !== "potions" || prayerRestoreMode === "auto"}
                    onChange={(value) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: {
                            ...current.trip,
                            prayerPotionSets: prayerRestoreMode === "manual_vials" ? value : null,
                            prayerPotionDoses: prayerRestoreMode === "manual_doses" ? value : null
                          }
                        })
                      )
                    }
                  />
                  <SelectField
                    label="Altar time"
                    value={altarTimeMode}
                    options={ALTAR_TIME_MODE_OPTIONS}
                    disabled={form.trip.prayerMode !== "altar"}
                    onChange={(mode) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: {
                            ...current.trip,
                            altarSeconds:
                              mode === "manual"
                                ? Math.max(0, Math.min(3600, altarSecondsValue))
                                : null
                          }
                        })
                      )
                    }
                  />
                  <NumberField
                    label="Altar sec"
                    value={altarSecondsValue}
                    min={0}
                    max={3600}
                    disabled={form.trip.prayerMode !== "altar" || altarTimeMode === "auto"}
                    onChange={(altarSeconds) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, altarSeconds }
                        })
                      )
                    }
                  />
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={form.trip.scarceSpot}
                      onChange={(event) =>
                        setFormSafe((current) =>
                          updateForm(current, {
                            trip: { ...current.trip, scarceSpot: event.target.checked }
                          })
                        )
                      }
                    />
                    <span>Scarce spot</span>
                  </label>
                  <NumberField
                    label="Targets at spot"
                    value={scarceTargetsValue}
                    min={1}
                    max={64}
                    disabled={!form.trip.scarceSpot}
                    onChange={(targetsAtSpot) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, targetsAtSpot }
                        })
                      )
                    }
                  />
                  <NumberField
                    label="Respawn sec"
                    value={scarceRespawnValue}
                    min={1}
                    max={3600}
                    disabled={!form.trip.scarceSpot}
                    onChange={(respawnSeconds) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, respawnSeconds }
                        })
                      )
                    }
                  />
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={form.trip.antifire}
                      onChange={(event) =>
                        setFormSafe((current) =>
                          updateForm(current, {
                            trip: { ...current.trip, antifire: event.target.checked }
                          })
                        )
                      }
                    />
                    <span>Antifire</span>
                  </label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={form.trip.antipoison}
                      onChange={(event) =>
                        setFormSafe((current) =>
                          updateForm(current, {
                            trip: { ...current.trip, antipoison: event.target.checked }
                          })
                        )
                      }
                    />
                    <span>Antipoison</span>
                  </label>
                  <SelectField
                    label="Food mode"
                    value={foodCountMode}
                    options={FOOD_COUNT_MODE_OPTIONS}
                    onChange={(mode) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: {
                            ...current.trip,
                            foodCount:
                              mode === "manual" ? Math.max(0, Math.min(28, foodCountValue)) : null
                          }
                        })
                      )
                    }
                  />
                  <NumberField
                    label="Food count"
                    value={foodCountValue}
                    min={0}
                    max={28}
                    disabled={foodCountMode === "auto"}
                    onChange={(foodCount) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, foodCount }
                        })
                      )
                    }
                  />
                  <SelectField
                    label="F/KL override"
                    value={foodPerKillOverrideMode}
                    options={FOOD_PER_KILL_OVERRIDE_OPTIONS}
                    onChange={(mode) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: {
                            ...current.trip,
                            foodPerKillOverride:
                              mode === "on" ? Number(foodPerKillOverrideValue.toFixed(2)) : null
                          }
                        })
                      )
                    }
                  />
                  <DecimalField
                    label="Food/kill"
                    value={foodPerKillOverrideValue}
                    min={0}
                    max={999}
                    step={0.05}
                    disabled={foodPerKillOverrideMode === "off"}
                    onChange={(foodPerKillOverride) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, foodPerKillOverride }
                        })
                      )
                    }
                  />
                  <NumberField
                    label="Recoil rings"
                    value={form.trip.recoilRings}
                    min={1}
                    max={28}
                    disabled={!recoilRingEquipped}
                    onChange={(recoilRings) =>
                      setFormSafe((current) =>
                        updateForm(current, {
                          trip: { ...current.trip, recoilRings }
                        })
                      )
                    }
                  />
                  <div className="trip-output grouped" aria-label="Trip summary">
                    {[
                      tripMetricGroup("Survival", [
                        { label: "Safespot", value: safespotSummary },
                        {
                          label: "Protection prayer",
                          value: optionLabel(PROTECT_OPTIONS, form.trip.protect)
                        },
                        { label: "Prayer block", value: yesNo(incoming.protected) },
                        { label: "HP/kill", value: formatNumber(incoming.hpPerKill, 2) },
                        { label: "Dragonfire", value: formatNumber(incoming.dragonfire, 2) },
                        { label: "Poison", value: formatNumber(incoming.poison ?? 0, 2) },
                        { label: "Antifire", value: yesNo(form.trip.antifire) },
                        { label: "Antipoison", value: yesNo(form.trip.antipoison) }
                      ]),
                      tripMetricGroup("Prayer", [
                        {
                          label: "Prayer mode",
                          value: optionLabel(PRAYER_MODE_OPTIONS, form.trip.prayerMode)
                        },
                        { label: "Prayer restore", value: prayerRestoreSummary },
                        { label: "Prayer carried", value: prayerCarriedSummary },
                        {
                          label: "Prayer/kill",
                          value: formatNumber(viewModel.trip.trip.prayerPerKill, 2)
                        },
                        {
                          label: "Prayer slots",
                          value: formatNumber(viewModel.trip.trip.prayerSlots)
                        },
                        {
                          label: "Max kills prayer",
                          value: finiteMetric(viewModel.trip.trip.maxKillsPrayer, 1)
                        },
                        {
                          label: "Prayer dose",
                          value: viewModel.trip.trip.prayerPointsPerDose
                            ? formatNumber(viewModel.trip.trip.prayerPointsPerDose)
                            : "-"
                        },
                        {
                          label: "Altar sec",
                          value: viewModel.trip.trip.altarOn
                            ? formatNumber(viewModel.trip.trip.altarSeconds)
                            : "-"
                        },
                        {
                          label: "Altar/kill",
                          value: viewModel.trip.trip.altarOn
                            ? `${formatNumber(viewModel.trip.trip.altarSecPerKill, 2)}s`
                            : "-"
                        }
                      ]),
                      tripMetricGroup("Food", [
                        { label: "Food", value: foodSummary },
                        {
                          label: "Food count",
                          value: foodCountSummary
                        },
                        {
                          label: "Auto estimate",
                          value: formatNumber(viewModel.trip.trip.slots.autoFoodCount)
                        },
                        {
                          label: "Food left",
                          value: formatNumber(viewModel.trip.trip.slots.foodLeftAtEnd, 1)
                        },
                        {
                          label: "Food/kill",
                          value: formatNumber(viewModel.trip.trip.foodPerKill, 2)
                        }
                      ]),
                      tripMetricGroup("Inventory reserve", [
                        { label: "Teleport", value: form.trip.teleport ? "1 slot" : "Off" },
                        { label: "Ammo recovery", value: recoverAmmoSummary },
                        ...(dbaSpecActive
                          ? [{ label: "DBA restore", value: dbaRestoreSummary }]
                          : []),
                        { label: "Rune slots", value: runeSlotsSummary },
                        {
                          label: "Reserve slots",
                          value: formatNumber(viewModel.trip.trip.slots.reserve)
                        },
                        {
                          label: "Reserve parts",
                          value: reservePartsSummary
                        },
                        {
                          label: "Loot capacity",
                          value: formatNumber(viewModel.trip.trip.slots.lootCapacity)
                        },
                        {
                          label: "Free at start",
                          value: formatNumber(viewModel.trip.trip.slots.freeAtStart)
                        }
                      ]),
                      tripMetricGroup("Potions", [
                        { label: "Potion carry", value: potionCarrySummary },
                        {
                          label: "Potion slots",
                          value: formatNumber(viewModel.trip.trip.slots.potionSlots)
                        },
                        {
                          label: "Potion parts",
                          value: potionPartsSummary
                        },
                        {
                          label: "Potion gp/trip",
                          value: formatNumber(viewModel.trip.trip.potionCostPerTrip),
                          tone: "gold"
                        },
                        {
                          label: "Potion gp/kill",
                          value: formatNumber(viewModel.trip.trip.potionCostPerKill),
                          tone: "gold"
                        }
                      ]),
                      tripMetricGroup("Scarce cap", [
                        { label: "Scarce spot", value: yesNo(form.trip.scarceSpot) },
                        { label: "Scarce status", value: scarceStatus },
                        {
                          label: "Spot max K/hr",
                          value: form.trip.scarceSpot
                            ? formatNumber(viewModel.trip.trip.scarce.maxKph)
                            : "-"
                        }
                      ]),
                      tripMetricGroup("Recoil", [
                        {
                          label: "Recoil rings",
                          value: recoilRingEquipped
                            ? formatNumber(form.trip.recoilRings)
                            : "No ring"
                        },
                        {
                          label: "Recoil spares",
                          value: viewModel.trip.trip.recoilOn
                            ? formatNumber(viewModel.trip.trip.recoilSpares)
                            : "-"
                        },
                        {
                          label: "Recoil/kill",
                          value: viewModel.trip.trip.recoilOn
                            ? `${formatNumber(viewModel.trip.trip.recoilDmgPerKill, 1)} dmg`
                            : "-"
                        },
                        {
                          label: "Recoil gp/kill",
                          value: viewModel.trip.trip.recoilOn
                            ? formatNumber(viewModel.trip.trip.recoilCostPerKill)
                            : "-",
                          tone: "gold"
                        }
                      ]),
                      tripMetricGroup("Outcome", [
                        { label: "Bank time", value: bankTimeSummary },
                        {
                          label: "Kills/trip",
                          value: formatNumber(viewModel.trip.trip.killsPerTrip, 1)
                        },
                        {
                          label: "Trip length",
                          value: Number.isFinite(viewModel.trip.trip.tripMinutes)
                            ? `${formatNumber(viewModel.trip.trip.tripMinutes, 1)}m`
                            : "-"
                        },
                        {
                          label: "Effective K/hr",
                          value: formatNumber(viewModel.trip.effectiveKph)
                        },
                        {
                          label: "Supply/kill",
                          value: formatNumber(viewModel.trip.supply.supplyCostPerKill),
                          tone: "gold"
                        },
                        {
                          label: "Ammo/kill",
                          value:
                            viewModel.trip.supply.ammoPerKill > 0
                              ? formatNumber(viewModel.trip.supply.ammoPerKill, 2)
                              : "-"
                        },
                        {
                          label: "Effective net GP/hr",
                          value: formatNumber(viewModel.trip.effectiveNetGpPerHour),
                          tone: "gold"
                        }
                      ])
                    ]}
                  </div>
                </div>
              </section>

              <section className="cannon-strip" aria-label="Cannon" hidden={activeTab !== "cannon"}>
                <div className="section-title-row">
                  <h2>Dwarf multicannon</h2>
                  <span
                    className={`status-pill ${cannonEnabled && !currentCannonOutput?.idle ? "ready" : ""}`}
                  >
                    {cannonStatus}
                  </span>
                </div>
                <div className="cannon-body">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={cannonEnabled}
                      onChange={(event) =>
                        setCannonForCurrentMonster({ enabled: event.target.checked })
                      }
                    />
                    <span>Set up cannon</span>
                  </label>
                  <NumberField
                    label="Mobs at spot"
                    value={cannonTargets}
                    min={1}
                    max={8}
                    onChange={setCannonTargetsForCurrentMonster}
                  />
                  <NumberField
                    label="Respawn"
                    value={cannonRespawn}
                    min={1}
                    max={3600}
                    onChange={setCannonRespawnForCurrentMonster}
                  />
                  <label className="toggle cannon-sparse-toggle">
                    <input
                      type="checkbox"
                      checked={cannonTripSparseLinked}
                      disabled={!cannonEnabled}
                      onChange={(event) => setTripSparseFromCannon(event.target.checked)}
                    />
                    <span>Link Trip sparse</span>
                  </label>
                  <div className="cannon-actions">
                    <button
                      type="button"
                      disabled={!cannonHasCustomSettings}
                      onClick={resetCannonForCurrentMonster}
                    >
                      Reset monster cannon
                    </button>
                  </div>
                  <div
                    className={`cannon-notice ${cannonEnabled && currentCannonOutput?.respawnBound ? "warning" : ""}`}
                    role="status"
                    aria-label="Cannon sparse status"
                  >
                    {cannonNotice}
                  </div>
                  <div className="cannon-output" aria-label="Cannon output">
                    {cannonEnabled && currentCannonOutput ? (
                      <div className="cannon-output-grid">
                        {metricList([
                          {
                            label: "Effective targets",
                            value: formatNumber(currentCannonOutput.effTargets, 1)
                          },
                          {
                            label: "Cannon DPS",
                            value: formatNumber(currentCannonOutput.cannonDps, 2),
                            tone: "teal"
                          },
                          {
                            label: "Balls/hr",
                            value: formatNumber(currentCannonOutput.ballsPerHour)
                          },
                          {
                            label: "Balls/kill",
                            value: formatNumber(currentCannonOutput.ballsPerKill, 2)
                          },
                          {
                            label: "Cannon Ranged XP/hr",
                            value: formatNumber(currentCannonOutput.rangedXpPerHour),
                            tone: "teal"
                          },
                          {
                            label: "Effective XP/hr",
                            value: formatNumber(viewModel.effectiveXpPerHour),
                            tone: "teal"
                          },
                          {
                            label: "Effective net GP/hr",
                            value: formatNumber(viewModel.trip.effectiveNetGpPerHour),
                            tone: "gold"
                          },
                          {
                            label: "Ball cost/hr",
                            value: formatNumber(currentCannonOutput.ballCostPerHour),
                            tone: "gold"
                          },
                          {
                            label: "Ball cost/kill",
                            value: formatNumber(currentCannonOutput.ballCostPerKill),
                            tone: "gold"
                          },
                          {
                            label: "Ball price",
                            value: formatNumber(currentCannonOutput.ballPrice)
                          },
                          {
                            label: "Cannonballs/trip",
                            value:
                              currentCannonOutput.ballsPerTrip == null
                                ? "-"
                                : formatNumber(currentCannonOutput.ballsPerTrip)
                          },
                          {
                            label: "Ball gp/trip",
                            value:
                              currentCannonOutput.ballCostPerTrip == null
                                ? "-"
                                : formatNumber(currentCannonOutput.ballCostPerTrip),
                            tone: "gold"
                          },
                          {
                            label: "K/hr uplift",
                            value:
                              currentCannonOutput.kphNoCannon > 0
                                ? `${formatNumber(
                                    (currentCannonOutput.kphWithCannon /
                                      currentCannonOutput.kphNoCannon -
                                      1) *
                                      100,
                                    1
                                  )}%`
                                : "-"
                          }
                        ])}
                        {metricList([
                          {
                            label: "Accuracy rule",
                            value: `${formatNumber(viewModel.combat.hitChance * 100, 1)}% roll`
                          },
                          { label: "XP rule", value: "Ranged XP" },
                          {
                            label: "Supply impact",
                            value: `${formatNumber(currentCannonOutput.ballCostPerKill)} gp/kill`,
                            tone: "gold"
                          },
                          { label: "Sparse link", value: cannonSparseSummary },
                          { label: "Inventory reserve", value: cannonReserveSummary },
                          {
                            label: "Trip sparse K/hr",
                            value: form.trip.scarceSpot
                              ? formatNumber(viewModel.trip.trip.scarce.maxKph)
                              : "-"
                          }
                        ])}
                      </div>
                    ) : (
                      <div className="cannon-output-grid">
                        {metricList([
                          { label: "Effective targets", value: "0.0" },
                          { label: "Cannon DPS", value: "0.00" },
                          { label: "Balls/hr", value: "0" },
                          { label: "Cannon Ranged XP/hr", value: "0" },
                          {
                            label: "Effective XP/hr",
                            value: formatNumber(viewModel.effectiveXpPerHour)
                          },
                          {
                            label: "Effective net GP/hr",
                            value: formatNumber(viewModel.trip.effectiveNetGpPerHour),
                            tone: "gold"
                          },
                          { label: "Ball cost/hr", value: "0" },
                          { label: "Cannonballs/trip", value: "-" },
                          { label: "Accuracy rule", value: "-" },
                          { label: "XP rule", value: "-" },
                          { label: "Supply impact", value: "-" },
                          { label: "Sparse link", value: cannonSparseSummary },
                          { label: "Inventory reserve", value: "-" }
                        ])}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="duel-pane" aria-label="Duel" hidden={activeTab !== "duel"}>
                <div className="table-toolbar duel-toolbar">
                  <div>
                    <h2>Setup duel</h2>
                    <span>
                      {duelComparison?.monsterName ?? currentMonster?.name ?? form.monsterId} -{" "}
                      {duelSnapshots.snapshots.length} / {duelComparison?.snapshotLimit ?? 12}{" "}
                      snapshots
                    </span>
                  </div>
                  <div className="duel-controls" aria-label="Duel snapshot controls">
                    <ReadOnlyField
                      label="Current target"
                      value={duelComparison?.monsterName ?? currentMonster?.name ?? form.monsterId}
                    />
                    <div className="duel-control-actions">
                      <button
                        type="button"
                        onClick={snapshotCurrentSetup}
                        disabled={
                          duelComparison != null &&
                          duelSnapshots.snapshots.length >= duelComparison.snapshotLimit
                        }
                      >
                        Snapshot current setup
                      </button>
                      <label className="file-button">
                        Import snapshots
                        <input
                          type="file"
                          accept="application/json,.json"
                          onChange={importDuelSnapshots}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={exportDuelSnapshots}
                        disabled={duelSnapshots.snapshots.length === 0}
                      >
                        Export snapshots
                      </button>
                    </div>
                  </div>
                </div>

                <div className="segmented duel-view-toggle" aria-label="Duel view">
                  <button
                    type="button"
                    className={duelViewMode === "current-target" ? "active" : undefined}
                    aria-pressed={duelViewMode === "current-target"}
                    onClick={() => setDuelViewMode("current-target")}
                  >
                    Current target
                  </button>
                  <button
                    type="button"
                    className={duelViewMode === "monster-matrix" ? "active" : undefined}
                    aria-pressed={duelViewMode === "monster-matrix"}
                    onClick={() => {
                      if (duelMatrix) setDuelViewMode("monster-matrix");
                      else buildDuelMatrix();
                    }}
                    disabled={duelSnapshots.snapshots.length === 0 || duelMatrixBusy}
                  >
                    Monster matrix
                  </button>
                </div>

                {duelImportNotice && (
                  <InlineImportNotice
                    notice={duelImportNotice}
                    ariaLabel="Duel snapshot import notice"
                    className="duel-import-notice"
                  />
                )}

                {duelViewMode === "current-target" ? (
                  <div className="duel-table-wrap">
                    <table className="duel-table" aria-label="Duel comparison">
                      <thead>
                        <tr>
                          <th>Setup</th>
                          <th>Loadout</th>
                          <th className="numeric">Max</th>
                          <th className="numeric">DPS</th>
                          <th className="numeric">XP/hr</th>
                          <th className="numeric">Net GP/hr</th>
                          <th className="numeric">GP/XP</th>
                          <th className="numeric">K/hr</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duelComparison?.rows.map((row) => {
                          const diffId = `duel-diff-${row.snapshotId ?? "live"}`;
                          const diffExpanded = row.snapshotId === expandedDuelDiffId;
                          return (
                            <Fragment key={row.id}>
                              <tr className={duelRowClass(row)}>
                                <td className="duel-setup-cell">
                                  {row.source === "live" ? (
                                    <strong>Live setup</strong>
                                  ) : (
                                    <input
                                      aria-label={`Rename snapshot ${row.name}`}
                                      defaultValue={row.name}
                                      maxLength={80}
                                      onBlur={(event) => {
                                        if (!row.snapshotId) return;
                                        const accepted = commitDuelSnapshotName(
                                          row.snapshotId,
                                          event.currentTarget.value
                                        );
                                        if (!accepted) event.currentTarget.value = row.name;
                                      }}
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") event.currentTarget.blur();
                                        if (event.key === "Escape") {
                                          event.currentTarget.value = row.name;
                                          event.currentTarget.blur();
                                        }
                                      }}
                                    />
                                  )}
                                  <span>{row.combatStyle}</span>
                                </td>
                                <td className="duel-loadout-cell" title={row.loadoutLabel}>
                                  {row.loadoutLabel}
                                </td>
                                <td className="numeric">{formatNumber(row.maxHit, 1)}</td>
                                <td className="numeric">
                                  <span>{formatNumber(row.dps, 2)}</span>
                                  <small>{duelDeltaDisplay(row.deltas.dps, 2)}</small>
                                </td>
                                <td
                                  className={`numeric ${row.best.effectiveXpPerHour ? "best" : ""}`}
                                >
                                  <span>{formatNumber(row.effectiveXpPerHour)}</span>
                                  {row.best.effectiveXpPerHour && <em>best</em>}
                                  <small>{duelDeltaDisplay(row.deltas.effectiveXpPerHour)}</small>
                                </td>
                                <td
                                  className={`numeric ${row.best.effectiveNetGpPerHour ? "best" : ""}`}
                                >
                                  <span>{formatNumber(row.effectiveNetGpPerHour)}</span>
                                  {row.best.effectiveNetGpPerHour && <em>best</em>}
                                  <small>
                                    {duelDeltaDisplay(row.deltas.effectiveNetGpPerHour)}
                                  </small>
                                </td>
                                <td className={`numeric ${row.best.gpPerXp ? "best" : ""}`}>
                                  <span>{gpPerXpDisplay(row.gpPerXp)}</span>
                                  {row.best.gpPerXp && <em>best</em>}
                                  <small>{duelDeltaDisplay(row.deltas.gpPerXp, 2)}</small>
                                </td>
                                <td className="numeric">
                                  <span>{formatNumber(row.killsPerHour)}</span>
                                  <small>{duelDeltaDisplay(row.deltas.killsPerHour)}</small>
                                </td>
                                <td>
                                  {row.snapshotId ? (
                                    <div className="duel-row-actions">
                                      <button
                                        type="button"
                                        aria-expanded={diffExpanded}
                                        aria-controls={diffId}
                                        onClick={() =>
                                          setExpandedDuelDiffId(
                                            diffExpanded ? null : row.snapshotId
                                          )
                                        }
                                      >
                                        {diffExpanded ? "Hide diff" : "Review diff"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => loadDuelSnapshot(row.snapshotId!)}
                                      >
                                        Load
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteDuelSnapshot(row.snapshotId!)}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="duel-live-marker">Active</span>
                                  )}
                                </td>
                              </tr>
                              {row.setupDiff && diffExpanded && (
                                <tr className="duel-diff-row">
                                  <td colSpan={9}>
                                    <section
                                      id={diffId}
                                      className="duel-diff-panel"
                                      aria-label={`${row.name} setup and impact diff`}
                                    >
                                      <div className="duel-diff-heading">
                                        <div>
                                          <strong>Snapshot compared with live</strong>
                                          <span>
                                            {row.setupDiff.changeCount} setup field
                                            {row.setupDiff.changeCount === 1 ? "" : "s"} changed
                                          </span>
                                        </div>
                                        <small>Impact is snapshot minus live.</small>
                                      </div>
                                      <dl
                                        className="duel-impact-grid"
                                        aria-label="Calculated impact"
                                      >
                                        <div>
                                          <dt>Max hit</dt>
                                          <dd>{duelDeltaDisplay(row.deltas.maxHit, 1)}</dd>
                                        </div>
                                        <div>
                                          <dt>DPS</dt>
                                          <dd>{duelDeltaDisplay(row.deltas.dps, 2)}</dd>
                                        </div>
                                        <div>
                                          <dt>Hit chance</dt>
                                          <dd>{signedPercent(row.deltas.hitChance)}</dd>
                                        </div>
                                        <div>
                                          <dt>TTK</dt>
                                          <dd>{duelDeltaDisplay(row.deltas.ttkSec, 1)}s</dd>
                                        </div>
                                        <div>
                                          <dt>Kills/trip</dt>
                                          <dd>{duelDeltaDisplay(row.deltas.killsPerTrip, 1)}</dd>
                                        </div>
                                        <div>
                                          <dt>Kills/hr</dt>
                                          <dd>{duelDeltaDisplay(row.deltas.killsPerHour, 1)}</dd>
                                        </div>
                                        <div>
                                          <dt>XP/hr</dt>
                                          <dd>{duelDeltaDisplay(row.deltas.effectiveXpPerHour)}</dd>
                                        </div>
                                        <div>
                                          <dt>Net GP/hr</dt>
                                          <dd>
                                            {duelDeltaDisplay(row.deltas.effectiveNetGpPerHour)}
                                          </dd>
                                        </div>
                                        <div>
                                          <dt>GP/XP</dt>
                                          <dd>{duelDeltaDisplay(row.deltas.gpPerXp, 2)}</dd>
                                        </div>
                                        <div>
                                          <dt>Supply GP/hr</dt>
                                          <dd>{duelDeltaDisplay(row.deltas.supplyCostPerHour)}</dd>
                                        </div>
                                      </dl>
                                      {row.setupDiff.groups.length > 0 ? (
                                        <div className="duel-field-groups">
                                          {row.setupDiff.groups.map((group) => (
                                            <section key={group.id}>
                                              <h3>{group.label}</h3>
                                              <div
                                                className="duel-field-diff-header"
                                                aria-hidden="true"
                                              >
                                                <span>Field</span>
                                                <span>Live</span>
                                                <span>Snapshot</span>
                                              </div>
                                              {group.items.map((item) => (
                                                <div className="duel-field-diff" key={item.id}>
                                                  <strong>{item.label}</strong>
                                                  <span>
                                                    <small>Live</small>
                                                    {item.liveValue}
                                                  </span>
                                                  <span>
                                                    <small>Snapshot</small>
                                                    {item.snapshotValue}
                                                  </span>
                                                </div>
                                              ))}
                                            </section>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="duel-no-field-diff">
                                          No active setup fields differ.
                                        </p>
                                      )}
                                      <p className="duel-shared-context">
                                        {row.setupDiff.sharedContextNote}
                                      </p>
                                    </section>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                        {duelComparison?.snapshotRows.length === 0 && (
                          <tr className="duel-empty-row">
                            <td colSpan={9}>No snapshots</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <section className="duel-matrix-panel" aria-label="Duel monster matrix">
                    <div className="duel-matrix-controls">
                      <label className="field">
                        <span>Find monster</span>
                        <input
                          aria-label="Find matrix monster"
                          type="search"
                          value={duelMatrixFilter}
                          onChange={(event) => setDuelMatrixFilter(event.target.value)}
                        />
                      </label>
                      <div
                        className="segmented duel-matrix-metrics"
                        aria-label="Duel matrix metric"
                      >
                        {DUEL_MATRIX_METRICS.map((metric) => (
                          <button
                            type="button"
                            className={duelMatrixMetric === metric.id ? "active" : undefined}
                            aria-pressed={duelMatrixMetric === metric.id}
                            onClick={() => setDuelMatrixMetric(metric.id)}
                            key={metric.id}
                          >
                            {metric.label}
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={buildDuelMatrix} disabled={duelMatrixBusy}>
                        Refresh matrix
                      </button>
                      <span className={`status-pill ${duelMatrix ? "ready" : "pending"}`}>
                        {duelMatrix
                          ? `${duelMatrix.monsterCount} monsters - ${duelMatrix.setupCount} setups`
                          : duelMatrixBusy
                            ? "building"
                            : "refresh required"}
                      </span>
                    </div>

                    {duelMatrix ? (
                      <div className="duel-table-wrap duel-matrix-wrap">
                        <table className="duel-matrix-table" aria-label="All-monster setup matrix">
                          <thead>
                            <tr>
                              <th scope="col">Monster</th>
                              {duelMatrix.setups.map((setup) => (
                                <th scope="col" title={setup.loadoutLabel} key={setup.id}>
                                  <strong>{setup.name}</strong>
                                  <span>{setup.combatStyle}</span>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDuelMatrixRows.map((row) => (
                              <tr
                                className={row.isCurrentTarget ? "current-target" : undefined}
                                aria-current={row.isCurrentTarget ? "true" : undefined}
                                key={row.monsterId}
                              >
                                <th scope="row">
                                  <strong>{row.monsterName}</strong>
                                  <span>
                                    {row.monsterLevel == null
                                      ? row.monsterId
                                      : `lvl ${row.monsterLevel}`}
                                  </span>
                                </th>
                                {row.cells.map((cell) => {
                                  const value = cell.values[duelMatrixMetric];
                                  const displayValue = duelMatrixMetricDisplay(
                                    duelMatrixMetric,
                                    value
                                  );
                                  const setup = duelMatrix.setups.find(
                                    (candidate) => candidate.id === cell.setupId
                                  );
                                  const isBest = cell.best[duelMatrixMetric];
                                  return (
                                    <td
                                      className={`numeric ${isBest ? "best" : ""}`}
                                      aria-label={`${row.monsterName}, ${setup?.name ?? cell.setupId}, ${duelMatrixMetricLabel(duelMatrixMetric)}: ${displayValue}${isBest ? ", best" : ""}`}
                                      key={cell.setupId}
                                    >
                                      <span>{displayValue}</span>
                                      {isBest && <em>best</em>}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                            {filteredDuelMatrixRows.length === 0 && (
                              <tr className="duel-empty-row">
                                <td colSpan={duelMatrix.setupCount + 1}>No matching monsters</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="duel-matrix-empty" aria-label="Duel monster matrix status">
                        <span>{duelMatrixBusy ? "Building matrix" : "Matrix inputs changed"}</span>
                        {!duelMatrixBusy && (
                          <button type="button" onClick={buildDuelMatrix}>
                            Build matrix
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </section>

              <section
                className="planner-pane"
                aria-label="Planner"
                hidden={activeTab !== "planner"}
              >
                <div className="section-title-row">
                  <h2>Planner</h2>
                  <span className={`status-pill ${plannerStatus === "ready" ? "ready" : ""}`}>
                    {plannerStatus}
                  </span>
                </div>

                <div className="planner-controls" aria-label="Planner controls">
                  <div className="planner-control-grid">
                    <SelectField
                      label="Optimize metric"
                      value={plannerState.metric}
                      options={PLANNER_METRIC_OPTIONS}
                      onChange={updatePlannerMetric}
                    />
                    <ReadOnlyField label="Combat style" value={form.combatStyle} />
                    <ReadOnlyField label="Target" value={currentMonster?.name ?? form.monsterId} />
                    <button type="button" className="planner-recompute" onClick={recomputePlanner}>
                      Recompute plan
                    </button>
                  </div>

                  <div className="planner-toggle-row" aria-label="Planner gear options">
                    <label className="toggle planner-mode-toggle">
                      <input
                        type="checkbox"
                        checked={plannerState.onlyCurrentGear}
                        onChange={(event) => updatePlannerOnlyCurrentGear(event.target.checked)}
                      />
                      <span>Only current gear</span>
                    </label>
                    <label className="toggle planner-mode-toggle">
                      <input
                        type="checkbox"
                        checked={plannerState.averageOverSession}
                        onChange={(event) => updatePlannerAverageOverSession(event.target.checked)}
                      />
                      <span>Avg over session</span>
                    </label>
                  </div>

                  <div className="planner-skill-grid" aria-label="Planner skill targets">
                    {PLANNER_SKILLS.map((skill) => (
                      <div className="planner-skill-row" key={skill}>
                        <div className="planner-skill-name">
                          <span>{SKILL_LABEL[skill]}</span>
                          <strong>{formatNumber(form.levels[skill])}</strong>
                        </div>
                        <NumberField
                          label={`${SKILL_LABEL[skill]} current XP`}
                          value={plannerState.currentXp[skill]}
                          min={0}
                          max={200_000_000}
                          onChange={(value) => updatePlannerCurrentXp(skill, value)}
                        />
                        <NumberField
                          label={`${SKILL_LABEL[skill]} target`}
                          value={plannerState.targetLevels[skill]}
                          min={1}
                          max={99}
                          onChange={(value) => updatePlannerTargetLevel(skill, value)}
                        />
                        <label className="toggle planner-lock">
                          <input
                            type="checkbox"
                            checked={plannerState.skillLocks[skill]}
                            aria-label={`Lock ${SKILL_LABEL[skill]}`}
                            onChange={(event) =>
                              updatePlannerSkillLock(skill, event.target.checked)
                            }
                          />
                          <span>Lock {SKILL_LABEL[skill]}</span>
                        </label>
                      </div>
                    ))}
                  </div>

                  {plannerGearPoolEditor && (
                    <div className="planner-gear-editor" aria-label="Planner gear pool editor">
                      <div className="section-title-row">
                        <h3>Gear pool</h3>
                        <span className="status-pill">
                          {formatNumber(plannerGearPoolEditor.totalSelectedCount)} /{" "}
                          {formatNumber(plannerGearPoolEditor.totalOptionCount)}
                        </span>
                      </div>
                      <div className="planner-gear-slots">
                        {plannerGearPoolEditor.slots.map((slot) => (
                          <section className="planner-gear-slot" key={slot.slot}>
                            <div className="planner-gear-slot-header">
                              <h4>{slot.label}</h4>
                              <span>
                                {formatNumber(slot.selectedCount)} / {formatNumber(slot.totalCount)}
                              </span>
                              <button
                                type="button"
                                disabled={slot.selectedCount === slot.totalCount}
                                onClick={() => resetPlannerGearPool(slot.slot)}
                              >
                                Reset
                              </button>
                            </div>
                            <div className="planner-gear-options">
                              {slot.options.map((option) => (
                                <label className="planner-gear-option" key={option.id}>
                                  <input
                                    type="checkbox"
                                    checked={option.selected}
                                    aria-label={`Planner pool ${option.label}`}
                                    onChange={(event) =>
                                      updatePlannerGearPoolItem(
                                        slot.slot,
                                        option.id,
                                        event.target.checked
                                      )
                                    }
                                  />
                                  <span>{option.label}</span>
                                  <small>{option.hint}</small>
                                </label>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {plannerResult?.error ? (
                  <p className="inline-status error" role="alert">
                    {plannerResult.error}
                  </p>
                ) : plannerPanel ? (
                  <div className="planner-output" aria-label="Planner output">
                    <div className="summary-strip planner-summary" aria-label="Planner summary">
                      {metricList([
                        { label: "Total XP", value: formatNumber(plannerPanel.summary.totalXp) },
                        { label: "Steps", value: formatNumber(plannerPanel.summary.stepCount) },
                        { label: "Phases", value: formatNumber(plannerPanel.summary.phaseCount) },
                        { label: "Unlocks", value: formatNumber(plannerPanel.summary.unlockCount) },
                        {
                          label: "Start DPS",
                          value: formatNumber(plannerPanel.summary.startDps, 2)
                        },
                        { label: "End DPS", value: formatNumber(plannerPanel.summary.endDps, 2) },
                        { label: "Metric gain", value: plannerMetricDeltaValue },
                        {
                          label: "Truncated",
                          value: plannerPanel.summary.truncated ? "Yes" : "No"
                        }
                      ])}
                    </div>

                    <div className="planner-visual-grid">
                      <section className="planner-output-section" aria-label="Planner DPS chart">
                        <div className="section-title-row">
                          <h3>DPS vs cumulative XP</h3>
                          <span className="status-pill">
                            {formatNumber(plannerPanel.chart.points.length)} points
                          </span>
                        </div>
                        {plannerPanel.chart.isEmpty ? (
                          <p className="empty-state">No chart points for current targets.</p>
                        ) : (
                          <div className="planner-chart-wrap">
                            <svg
                              className="planner-chart"
                              role="img"
                              aria-label="DPS vs cumulative XP chart"
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                            >
                              {plannerPanel.chart.points.slice(1).map((point, index) => {
                                const previous = plannerPanel.chart.points[index];
                                return (
                                  <line
                                    className="planner-chart-line"
                                    key={`${previous.id}:${point.id}`}
                                    x1={previous.x}
                                    y1={previous.y}
                                    x2={point.x}
                                    y2={point.y}
                                  />
                                );
                              })}
                              {plannerPanel.chart.points.map((point) => (
                                <circle
                                  className="planner-chart-point"
                                  key={point.id}
                                  cx={point.x}
                                  cy={point.y}
                                  r="1.8"
                                >
                                  <title>
                                    {point.label}: {formatNumber(point.dps, 2)} DPS after{" "}
                                    {formatNumber(point.cumXp)} XP
                                  </title>
                                </circle>
                              ))}
                            </svg>
                            <div className="planner-chart-scale" aria-hidden="true">
                              <span>{formatNumber(plannerPanel.chart.minDps, 2)} DPS</span>
                              <span>{formatNumber(plannerPanel.chart.maxCumXp)} XP</span>
                              <span>{formatNumber(plannerPanel.chart.maxDps, 2)} DPS</span>
                            </div>
                          </div>
                        )}
                      </section>

                      <section
                        className="planner-output-section"
                        aria-label="Planner gear timeline"
                      >
                        <div className="section-title-row">
                          <h3>Gear timeline</h3>
                          <span className="status-pill">
                            {formatNumber(plannerPanel.timeline.length)}
                          </span>
                        </div>
                        {plannerPanel.timeline.length === 0 ? (
                          <p className="empty-state">No gear unlocks in this plan.</p>
                        ) : (
                          <ol className="planner-timeline">
                            {plannerPanel.timeline.map((event) => (
                              <li key={event.id}>
                                <span>{formatNumber(event.cumXp)} XP</span>
                                <strong>{event.itemName}</strong>
                                <small>
                                  {event.slotLabel} - {event.skillLabel} {formatNumber(event.level)}{" "}
                                  - {signedDecimal(event.dpsDelta, 2)} DPS
                                </small>
                              </li>
                            ))}
                          </ol>
                        )}
                      </section>
                    </div>

                    <div className="planner-output-grid">
                      <section className="planner-output-section">
                        <div className="section-title-row">
                          <h3>Training order</h3>
                          <span className="status-pill">
                            {plannerPanel.isEmpty
                              ? "empty"
                              : `${formatNumber(plannerPanel.trainingOrder.length)} phases`}
                          </span>
                        </div>
                        {plannerPanel.isEmpty ? (
                          <p className="empty-state">No training steps for current targets.</p>
                        ) : (
                          <div className="planner-table-wrap">
                            <table className="planner-table" aria-label="Planner training order">
                              <thead>
                                <tr>
                                  <th>Skill</th>
                                  <th className="numeric">From</th>
                                  <th className="numeric">To</th>
                                  <th className="numeric">XP</th>
                                  <th className="numeric">DPS</th>
                                  <th className="numeric">Metric</th>
                                  <th className="numeric">Unlocks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {plannerPanel.trainingOrder.map((row) => (
                                  <tr key={row.id}>
                                    <td>{row.skillLabel}</td>
                                    <td className="numeric">{formatNumber(row.from)}</td>
                                    <td className="numeric">{formatNumber(row.to)}</td>
                                    <td className="numeric">{formatNumber(row.xp)}</td>
                                    <td className="numeric">
                                      {formatNumber(row.endDps, 2)}
                                      <span className="planner-delta">
                                        {signedDecimal(row.endDps - row.startDps, 2)}
                                      </span>
                                    </td>
                                    <td className="numeric">
                                      {formatPlannerMetricValue(
                                        plannerComputedState.metric,
                                        row.endMetric
                                      )}
                                    </td>
                                    <td className="numeric">{formatNumber(row.unlockCount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>

                      <section className="planner-output-section">
                        <div className="section-title-row">
                          <h3>Unlock summary</h3>
                          <span className="status-pill">
                            {formatNumber(plannerPanel.unlocks.length)}
                          </span>
                        </div>
                        {plannerPanel.unlocks.length === 0 ? (
                          <p className="empty-state">No gear or spell unlocks in this plan.</p>
                        ) : (
                          <div className="planner-table-wrap compact">
                            <table className="planner-table" aria-label="Planner unlock summary">
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  <th>Slot</th>
                                  <th>Type</th>
                                  <th className="numeric">Level</th>
                                  <th className="numeric">DPS</th>
                                </tr>
                              </thead>
                              <tbody>
                                {plannerPanel.unlocks.map((row) => (
                                  <tr key={row.id}>
                                    <td>{row.itemName}</td>
                                    <td>{row.slotLabel}</td>
                                    <td>{row.type}</td>
                                    <td className="numeric">
                                      {row.reqSkillLabel} {formatNumber(row.reqLevel)}
                                    </td>
                                    <td className="numeric">
                                      {signedDecimal(row.dpsAfter - row.dpsBefore, 2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    </div>

                    {plannerPanel.warnings.length > 0 ? (
                      <div className="planner-warnings" role="status" aria-label="Planner warnings">
                        {plannerPanel.warnings.slice(0, 4).map((warning) => (
                          <span key={warning}>{warning}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="empty-state">Planner is available after bundled data loads.</p>
                )}
              </section>

              <section
                className={activeTab === "economy" ? "economy-pane" : "service-strip"}
                aria-label={activeTab === "economy" ? "Economy" : "Live services"}
                hidden={activeTab !== "economy" && activeTab !== "settings"}
              >
                {localStateRecoveryVisible && (
                  <section
                    className="service-group local-state-recovery-panel"
                    aria-label="Local state recovery"
                  >
                    <div className="section-title-row">
                      <h2>Local state recovery</h2>
                      <span
                        className={`status-pill ${
                          localStateHealthReport.hasAttention ? "warning" : "ready"
                        }`}
                      >
                        {localStateRecoveryStatus(localStateHealthReport)}
                      </span>
                    </div>
                    <p
                      className={`inline-status ${
                        localStateHealthReport.hasAttention ? "warning" : "success"
                      }`}
                      role={localStateHealthReport.hasAttention ? "alert" : "status"}
                    >
                      {localStateRecoveryNotice ??
                        "Some browser-local rewrite state fell back to defaults."}
                    </p>
                    <div className="price-history-summary" aria-label="Local state health summary">
                      <span>Known states {formatNumber(localStateHealthReport.itemCount)}</span>
                      <span>
                        Needs attention {formatNumber(localStateHealthReport.attentionCount)}
                      </span>
                      <span>Report {localStateHealthReport.generatedAt}</span>
                    </div>
                    <div className="market-sync-bar">
                      <button type="button" onClick={exportLocalStateRecoveryReport}>
                        Export recovery report
                      </button>
                      {localStateClearPendingId === "invalid-all" ? (
                        <>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={confirmClearInvalidLocalState}
                          >
                            Confirm clear invalid local data
                          </button>
                          <button type="button" onClick={() => setLocalStateClearPendingId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="danger-button"
                          disabled={!localStateAttentionItems.some((item) => item.clearable)}
                          onClick={() => setLocalStateClearPendingId("invalid-all")}
                        >
                          Clear invalid local data
                        </button>
                      )}
                    </div>
                    <table className="legacy-review-table">
                      <thead>
                        <tr>
                          <th>State</th>
                          <th>Key</th>
                          <th>Status</th>
                          <th>Version</th>
                          <th>Recovery</th>
                          <th>Clear</th>
                        </tr>
                      </thead>
                      <tbody>
                        {localStateHealthReport.items.map((item) => {
                          const pending = localStateClearPendingId === item.id;
                          return (
                            <tr key={item.id}>
                              <td>{item.label}</td>
                              <td>
                                <code>{item.storageKey}</code>
                              </td>
                              <td>{localStateStatusLabel(item)}</td>
                              <td>
                                v{formatNumber(item.expectedVersion)}
                                {item.foundVersion != null
                                  ? ` (found v${formatNumber(item.foundVersion)})`
                                  : ""}
                              </td>
                              <td>{localStateReasonLabel(item)}</td>
                              <td>
                                {item.needsAttention && item.clearable ? (
                                  pending ? (
                                    <>
                                      <button
                                        type="button"
                                        className="danger-button"
                                        onClick={() => confirmClearLocalStateItem(item)}
                                      >
                                        Confirm clear {item.label}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setLocalStateClearPendingId(null)}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      className="danger-button"
                                      onClick={() => setLocalStateClearPendingId(item.id)}
                                    >
                                      Clear {item.label}
                                    </button>
                                  )
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>
                )}
                {activeTab === "settings" && (
                  <section
                    className="service-group price-data-panel"
                    aria-label="Price data settings"
                  >
                    <div className="section-title-row">
                      <h2>Price data</h2>
                      <span className={`status-pill ${activePriceSet ? "ready" : ""}`}>
                        {activePriceSet ? activePriceSetOriginLabel(activePriceSetOrigin) : "empty"}
                      </span>
                    </div>
                    {renderScheduledSnapshotSummary()}
                    <div className="price-history-summary" aria-label="Active PriceSet summary">
                      <span>Active source {activePriceSetOriginLabel(activePriceSetOrigin)}</span>
                      <span>Label {activePriceSet?.label ?? priceLabel}</span>
                      <span>Source {activePriceSet?.source ?? "-"}</span>
                      <span>Created {activePriceSet?.createdAt ?? "-"}</span>
                      <span>Age {formatAge(activePriceSetAgeSeconds)}</span>
                      <span>Item prices {formatNumber(activePriceSetItemCount)}</span>
                      <span>Alch values {formatNumber(activePriceSetAlchCount)}</span>
                      <span>Status {status}</span>
                    </div>
                    <div className="market-sync-bar">
                      <label className="file-button">
                        Import PriceSet
                        <input
                          type="file"
                          accept="application/json,.json"
                          onChange={(event) => void importPrices(event, "settings")}
                        />
                      </label>
                      {renderPriceSetControls()}
                    </div>
                    <p
                      className={`inline-status ${marketNotice?.tone ?? "neutral"}`}
                      role={marketNotice?.tone === "error" ? "alert" : "status"}
                    >
                      {priceDataStatusMessage}
                    </p>
                    {priceImportNotice?.surface === "settings" && (
                      <InlineImportNotice
                        notice={priceImportNotice}
                        ariaLabel="Price import notice"
                        className="price-import-panel-notice"
                      />
                    )}
                  </section>
                )}
                {activeTab === "settings" && (
                  <section
                    className="service-group hidden-tier-panel"
                    aria-label="Hidden gear tiers"
                  >
                    <div className="section-title-row">
                      <h2>Gear menu</h2>
                      <span
                        className={`status-pill ${
                          Object.values(hiddenGearTiers).some(Boolean) ? "ready" : ""
                        }`}
                      >
                        {formatNumber(Object.values(hiddenGearTiers).filter(Boolean).length)} hidden
                      </span>
                    </div>
                    <p className="inline-status neutral">
                      Hidden tiers are removed from weapon, ammo, spec and equipment pickers.
                      Current selections and None stay visible.
                    </p>
                    <div className="gear-tier-grid" aria-label="Gear tier visibility">
                      {GEAR_TIER_DEFS.map((tier) => (
                        <label className="tier-toggle" key={tier.id}>
                          <span>
                            {"description" in tier
                              ? tier.description
                              : `Hide ${tier.label.toLowerCase()} gear`}
                          </span>
                          <input
                            type="checkbox"
                            checked={!!hiddenGearTiers[tier.id]}
                            onChange={(event) =>
                              setHiddenGearTiers((current) =>
                                setHiddenGearTier(current, tier.id, event.target.checked)
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="market-sync-bar">
                      <button type="button" onClick={() => setHiddenGearTiers(hideAllGearTiers())}>
                        Hide all listed tiers
                      </button>
                      <button
                        type="button"
                        disabled={!Object.values(hiddenGearTiers).some(Boolean)}
                        onClick={() => setHiddenGearTiers(DEFAULT_HIDDEN_GEAR_TIERS_STATE)}
                      >
                        Show all tiers
                      </button>
                    </div>
                  </section>
                )}
                <section className="service-group" aria-label="Market price data">
                  <div className="section-title-row">
                    <h2>Market</h2>
                    <span
                      className={`status-pill ${
                        scheduledSnapshotStatus?.status === "loaded" ? "ready" : ""
                      }`}
                    >
                      {scheduledSnapshotViewModel.statusLabel}
                    </span>
                  </div>
                  {renderScheduledSnapshotSummary()}
                  <p className="inline-status neutral">
                    Market upstream refresh is scheduled, not user-triggered. Import a PriceSet file
                    to override market prices locally. High alch always uses current generated game
                    data.
                  </p>
                  <div className="market-sync-bar">
                    <label className="file-button">
                      Import PriceSet
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(event) => void importPrices(event, "market")}
                      />
                    </label>
                    {activeTab === "economy" && renderPriceSetControls()}
                    <button type="button" disabled={!context} onClick={saveLocalPriceComparison}>
                      Save local comparison
                    </button>
                    {priceHistoryClearPending ? (
                      <>
                        <button type="button" onClick={confirmClearPriceHistory}>
                          Confirm clear local history
                        </button>
                        <button type="button" onClick={() => setPriceHistoryClearPending(false)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={priceHistory.snapshots.length === 0}
                        onClick={requestClearPriceHistory}
                      >
                        Clear local history
                      </button>
                    )}
                  </div>
                  <div
                    className="price-history-summary"
                    aria-label="Market active PriceSet summary"
                  >
                    <span>Active source {activePriceSetOriginLabel(activePriceSetOrigin)}</span>
                    <span>Label {activePriceSet?.label ?? priceLabel}</span>
                    <span>Source {activePriceSet?.source ?? "-"}</span>
                    <span>Created {activePriceSet?.createdAt ?? "-"}</span>
                    <span>Age {formatAge(activePriceSetAgeSeconds)}</span>
                    <span>Item prices {formatNumber(activePriceSetItemCount)}</span>
                    <span>Alch values {formatNumber(activePriceSetAlchCount)}</span>
                    <span>Status {status}</span>
                  </div>
                  <div className="price-history-summary" aria-label="Price history summary">
                    <span>Snapshots {formatNumber(priceHistorySummary.snapshotCount)}</span>
                    <span>Shared {formatNumber(sharedPriceHistory.snapshots.length)}</span>
                    <span>Local {formatNumber(priceHistory.snapshots.length)}</span>
                    <span>Items {formatNumber(priceHistorySummary.trackedItemCount)}</span>
                    <span>Moved {formatNumber(priceHistoryMovers.movedItemCount)}</span>
                    <span>Latest age {formatAge(priceHistorySummary.latestAgeSeconds)}</span>
                    <span>Active {priceHistorySummary.activeLabel}</span>
                    <span>
                      Latest {priceHistorySummary.latestLabel}
                      {priceHistorySummary.activeMatchesLatest ? " active" : ""}
                    </span>
                    <span>Baseline {priceHistoryMovers.baselineLabel}</span>
                  </div>
                  <CalculationWarningSummary
                    warnings={viewModel.moneyWarnings}
                    label="Economy price warnings"
                  />
                  {marketNotice && (
                    <p
                      className={`inline-status ${marketNotice.tone}`}
                      role={marketNotice.tone === "error" ? "alert" : "status"}
                    >
                      {marketNotice.message}
                    </p>
                  )}
                  {priceImportNotice?.surface === "market" && (
                    <InlineImportNotice
                      notice={priceImportNotice}
                      ariaLabel="Price import notice"
                      className="price-import-panel-notice"
                    />
                  )}
                </section>
                {activeTab === "economy" && (
                  <section
                    className="service-group economy-history-panel"
                    aria-label="Price history analysis"
                  >
                    <div className="section-title-row">
                      <h2>Price history</h2>
                      <span className="status-pill">
                        {sharedPriceHistory.snapshots.length
                          ? priceHistory.snapshots.length
                            ? "shared + local"
                            : "shared"
                          : priceHistory.snapshots.length
                            ? "local"
                            : "empty"}
                      </span>
                    </div>
                    <div className="economy-controls">
                      <SelectField
                        label="Baseline"
                        value={economyBaselineMode}
                        options={PRICE_HISTORY_BASELINE_OPTIONS}
                        onChange={(value) =>
                          setEconomyBaselineMode(value as PriceHistoryBaselineMode)
                        }
                      />
                      <SelectField
                        label="Snapshot"
                        value={effectiveEconomySnapshotKey}
                        options={
                          priceHistorySnapshotOptions.length
                            ? priceHistorySnapshotOptions
                            : [{ id: "", label: "No snapshots" }]
                        }
                        disabled={
                          economyBaselineMode !== "snapshot" ||
                          priceHistorySnapshotOptions.length === 0
                        }
                        onChange={setEconomySnapshotKey}
                      />
                      <div className="field">
                        <label htmlFor="economy-item-filter">Item filter</label>
                        <input
                          id="economy-item-filter"
                          type="search"
                          value={economyItemFilter}
                          placeholder="Search item"
                          onChange={(event) => setEconomyItemFilter(event.target.value)}
                        />
                      </div>
                      <SelectField
                        label="Trend item"
                        value={effectiveEconomyTrendItemId}
                        options={
                          priceHistoryTrendItemOptions.length
                            ? priceHistoryTrendItemOptions
                            : [{ id: "", label: "No tracked items" }]
                        }
                        disabled={priceHistoryTrendItemOptions.length === 0}
                        onChange={setEconomyTrendItemId}
                      />
                    </div>
                    <div className="movers-grid" aria-label="Top movers">
                      <div className="mover-list" aria-label="Top gainers">
                        <h3>Top gainers</h3>
                        {priceHistoryMovers.topGainers.length ? (
                          <ol>
                            {priceHistoryMovers.topGainers.map((row) => (
                              <li key={row.itemId}>
                                <span>{row.itemLabel}</span>
                                <strong>{optionalDelta(row.gpDelta)}</strong>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p>No gainers</p>
                        )}
                      </div>
                      <div className="mover-list" aria-label="Top fallers">
                        <h3>Top fallers</h3>
                        {priceHistoryMovers.topFallers.length ? (
                          <ol>
                            {priceHistoryMovers.topFallers.map((row) => (
                              <li key={row.itemId}>
                                <span>{row.itemLabel}</span>
                                <strong>{optionalDelta(row.gpDelta)}</strong>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p>No fallers</p>
                        )}
                      </div>
                    </div>
                    <PriceTrendChart trend={priceHistoryTrend} />
                    <div className="dense-table-wrap economy-table-wrap">
                      <table className="dense-table" aria-label="Price movers">
                        <thead>
                          <tr>
                            <th aria-sort={economyAriaSort(economySort, "item")}>
                              <button
                                type="button"
                                className="sort-button"
                                onClick={() => updateEconomySort("item")}
                              >
                                Item
                              </button>
                            </th>
                            <th
                              className="numeric"
                              aria-sort={economyAriaSort(economySort, "latestPrice")}
                            >
                              <button
                                type="button"
                                className="sort-button"
                                onClick={() => updateEconomySort("latestPrice")}
                              >
                                Latest price
                              </button>
                            </th>
                            <th
                              className="numeric"
                              aria-sort={economyAriaSort(economySort, "baselinePrice")}
                            >
                              <button
                                type="button"
                                className="sort-button"
                                onClick={() => updateEconomySort("baselinePrice")}
                              >
                                Baseline price
                              </button>
                            </th>
                            <th
                              className="numeric"
                              aria-sort={economyAriaSort(economySort, "gpDelta")}
                            >
                              <button
                                type="button"
                                className="sort-button"
                                onClick={() => updateEconomySort("gpDelta")}
                              >
                                GP delta
                              </button>
                            </th>
                            <th
                              className="numeric"
                              aria-sort={economyAriaSort(economySort, "percentDelta")}
                            >
                              <button
                                type="button"
                                className="sort-button"
                                onClick={() => updateEconomySort("percentDelta")}
                              >
                                Percent delta
                              </button>
                            </th>
                            <th>Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {priceHistoryMovers.rows.length ? (
                            priceHistoryMovers.rows.map((row) => (
                              <tr key={row.itemId}>
                                <td>
                                  <strong>{row.itemLabel}</strong>
                                  <span>{row.itemId}</span>
                                </td>
                                <td className="numeric">{optionalPrice(row.latestPrice)}</td>
                                <td className="numeric">{optionalPrice(row.baselinePrice)}</td>
                                <td className={`numeric ${moverTone(row) ?? ""}`}>
                                  {optionalDelta(row.gpDelta)}
                                </td>
                                <td className={`numeric ${moverTone(row) ?? ""}`}>
                                  {optionalPercent(row.percentDelta)}
                                </td>
                                <td>
                                  <PriceTrendSparkline row={row} />
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6}>No matching price movement rows</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </section>

              <section
                className="dense-table-panel"
                aria-label="Monster comparison"
                hidden={activeTab !== "compare"}
              >
                <div className="table-toolbar">
                  <div>
                    <div className="table-title-row">
                      <h2>All monsters</h2>
                      <div
                        className={`status-pill ${denseComparePending ? "pending" : "ready"}`}
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        aria-label={denseCompareFreshnessAria}
                      >
                        {denseCompareFreshnessLabel}
                      </div>
                    </div>
                    <span>
                      {denseCompareRows.length} / {denseCompareTotalRows} monsters -{" "}
                      {denseCompareFreshnessSummary} - sort {sortDescription}
                    </span>
                  </div>
                  <div className="dense-filter-bar" aria-label="Dense compare filters">
                    <div className="field">
                      <label htmlFor="dense-monster-filter">Monster filter</label>
                      <input
                        id="dense-monster-filter"
                        type="search"
                        value={denseCompare.monsterFilter}
                        placeholder="Monster"
                        onChange={(event) => setDenseMonsterFilter(event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="dense-drop-filter">Drop filter</label>
                      <input
                        id="dense-drop-filter"
                        type="search"
                        value={denseCompare.dropFilter}
                        placeholder="Drop"
                        onChange={(event) => setDenseDropFilter(event.target.value)}
                      />
                    </div>
                    <label className="toggle dense-filter-toggle">
                      <input
                        type="checkbox"
                        checked={denseCompare.showIrrelevant}
                        onChange={(event) => setDenseShowIrrelevant(event.target.checked)}
                      />
                      <span>Show hidden / irrelevant</span>
                    </label>
                    <button type="button" onClick={resetDenseFilters}>
                      Reset filters
                    </button>
                  </div>
                </div>
                <div className="dense-table-wrap">
                  <table className="dense-table" aria-label="All monsters">
                    <thead>
                      <tr>
                        {DENSE_TABLE_COLUMNS.map((column) => (
                          <th
                            key={column.key}
                            className={column.align === "right" ? "numeric" : undefined}
                            aria-sort={ariaSort(denseCompare.sort, column.key)}
                          >
                            <button
                              type="button"
                              className="sort-button"
                              onClick={() =>
                                setDenseCompare((current) => ({
                                  ...current,
                                  sort: nextDenseCompareSortState(current.sort, column.key)
                                }))
                              }
                            >
                              <span>{column.label}</span>
                              <span aria-hidden="true">
                                {denseCompare.sort.key === column.key
                                  ? denseCompare.sort.direction === "asc"
                                    ? "^"
                                    : "v"
                                  : ""}
                              </span>
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {denseCompareRows.map((row) => {
                        const active = row.monsterId === form.monsterId;
                        return (
                          <tr
                            key={row.monsterId}
                            className={active ? "active" : undefined}
                            aria-selected={active}
                            aria-current={active ? "true" : undefined}
                            data-monster-id={row.monsterId}
                            tabIndex={active ? 0 : -1}
                            onClick={() => selectTarget(row.monsterId)}
                            onKeyDown={(event) => {
                              if (
                                event.key === "ArrowDown" ||
                                event.key === "ArrowUp" ||
                                event.key === "Home" ||
                                event.key === "End"
                              ) {
                                event.preventDefault();
                                const rows = Array.from(
                                  event.currentTarget.parentElement?.querySelectorAll<HTMLTableRowElement>(
                                    "tr[data-monster-id]"
                                  ) ?? []
                                );
                                const currentIndex = rows.indexOf(event.currentTarget);
                                const nextIndex =
                                  event.key === "Home"
                                    ? 0
                                    : event.key === "End"
                                      ? rows.length - 1
                                      : event.key === "ArrowDown"
                                        ? (currentIndex + 1) % rows.length
                                        : (currentIndex - 1 + rows.length) % rows.length;
                                rows[nextIndex]?.focus();
                                return;
                              }
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                selectTarget(row.monsterId);
                              }
                            }}
                          >
                            {DENSE_TABLE_COLUMNS.map((column) => {
                              const scaleRow = denseCompareScale[row.monsterId];
                              const scaleCell =
                                scaleRow && isDenseScaleColumn(column.key)
                                  ? scaleRow[column.key]
                                  : null;
                              return (
                                <td
                                  key={column.key}
                                  className={`${column.align === "right" ? "numeric" : "monster-cell"} ${
                                    scaleCell ? "dense-scale-td" : ""
                                  }`}
                                >
                                  {column.key === "monsterName" && (
                                    <span className="row-marker" aria-hidden="true">
                                      {active ? ">" : ""}
                                    </span>
                                  )}
                                  {scaleCell ? (
                                    <DenseScaleCell value={column.render(row)} scale={scaleCell} />
                                  ) : (
                                    <span>{column.render(row)}</span>
                                  )}
                                  {column.key === "monsterName" && row.markers.length > 0 && (
                                    <span className="row-state-markers">
                                      {row.markers.map((marker) => {
                                        const markerLabel = `${marker.ariaLabel} for ${row.monsterName}`;
                                        return (
                                          <span
                                            key={marker.id}
                                            className={`row-state-marker row-state-marker-${marker.id}`}
                                            aria-label={markerLabel}
                                            title={markerLabel}
                                          >
                                            {marker.label}
                                          </span>
                                        );
                                      })}
                                    </span>
                                  )}
                                  {column.key === "monsterName" && (
                                    <button
                                      type="button"
                                      className="row-visibility-button"
                                      aria-label={
                                        row.isIrrelevant
                                          ? `Mark ${row.monsterName} relevant`
                                          : `Mark ${row.monsterName} irrelevant`
                                      }
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleDenseIrrelevant(row.monsterId);
                                      }}
                                    >
                                      {row.isIrrelevant ? "Restore" : "Hide"}
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          </section>
        </section>
        <MonsterCardPanel
          card={viewModel.monsterCard}
          monsterOptions={monsters}
          selectedMonsterId={form.monsterId}
          dropFilter={denseCompare.dropFilter}
          onTargetChange={selectTarget}
          onDropFilterChange={setDenseDropFilter}
        />
      </section>
    </main>
  );
}

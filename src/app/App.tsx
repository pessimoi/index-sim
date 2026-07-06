import { useEffect, useId, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  downloadJsonFile,
  loadBundledLegacyContext,
  readBrowserFileText
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
  parsePriceSetFileText,
  syncMarketPrices
} from "@/adapters/market";
import { createMemoryStorage, loadPersisted, savePersisted } from "@/adapters/storage";
import {
  LEGACY_INPUT_STORAGE_KEY,
  clearKnownLegacyStorageKeys,
  inspectLegacySetupMigration,
  type LegacySetupMigrationReport,
  type LegacyStorageKey
} from "@/adapters/storage/legacy-migration";
import { supportedSpecialAttacksForCombatStyle } from "@/domain/combat";
import type {
  CombatStyle,
  EntityId,
  HiscoresResponse,
  HiscoresStatusResponse,
  MarketStatusResponse,
  MarketSyncReport,
  MarketSyncScope,
  SimulationContext
} from "@/domain/shared";
import { lootPreferenceKeysForMonster, type LootAction } from "@/domain/trip";
import { applyMarketSyncResponse, summarizeMarketSyncReport } from "./state/market-sync";
import {
  LEGACY_MIGRATION_DISMISSED_STORAGE_KEY,
  LEGACY_MIGRATION_DISMISSED_VERSION,
  LegacyMigrationDismissedStateSchema
} from "./state/legacy-migration";
import {
  applyHiscoresLevels,
  countApplicableHiscoresSkills,
  createHiscoresPreviewRows
} from "./state/hiscores";
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
  appendAcceptedPriceSetToHistory,
  BrowserPriceHistoryStateSchema,
  DEFAULT_PRICE_HISTORY_STATE,
  PRICE_HISTORY_STORAGE_KEY,
  PRICE_HISTORY_VERSION,
  summarizePriceHistory,
  type BrowserPriceHistoryState
} from "./state/price-history";
import {
  CannonSettingsSchema,
  CombatSetupFormSchema,
  DEFAULT_CANNON_SETTINGS,
  DEFAULT_FORM_STATE,
  DEFAULT_SPECIAL_ATTACK_STATE,
  REWRITE_SETUP_STORAGE_KEY,
  REWRITE_SETUP_VERSION,
  SavedSetupEnvelopeSchema,
  SavedSetupSchema,
  savedSetupFromForm,
  setCombatStyleDefaults,
  type CannonByMonsterState,
  type CombatSetupFormState
} from "./state/ui-state";
import {
  nextDenseCompareSortState,
  type DenseCompareSortKey,
  type DenseCompareSortState,
  type DenseCompareUiState
} from "./state/dense-compare";
import {
  createDenseCompareRows,
  createSimulationViewModel,
  optimizeLootPrefsForMonster,
  type DenseCompareRowViewModel,
  type LootDropRowViewModel,
  formatNumber,
  monsterOptions,
  styleOptions
} from "./view-models/simulation";

const storage = typeof window !== "undefined" ? window.localStorage : createMemoryStorage();

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

function loadInitialPriceHistory(): BrowserPriceHistoryState {
  const persisted = loadPersisted(priceHistoryStorageOptions);
  return persisted.status === "loaded" ? persisted.value : DEFAULT_PRICE_HISTORY_STATE;
}

function loadInitialLegacyMigrationDismissed(): boolean {
  return loadPersisted(legacyMigrationDismissedStorageOptions).status === "loaded";
}

type SelectOption = { id: string; label: string };

type DisplayMetric = {
  label: string;
  value: string;
  tone?: string;
};

const COMBAT_STYLE_OPTIONS: SelectOption[] = [
  { id: "melee", label: "melee" },
  { id: "ranged", label: "ranged" },
  { id: "magic", label: "magic" }
];

const PRAYER_OPTIONS: SelectOption[] = [
  "none",
  "clarity",
  "reflexes",
  "incredible",
  "burst",
  "superhuman",
  "ultimate",
  "thick_skin",
  "rock_skin",
  "steel_skin"
].map((id) => ({ id, label: id.replaceAll("_", " ") }));

const BOOST_OPTIONS: SelectOption[] = [
  "none",
  "super_att",
  "super_str",
  "super_def",
  "ranging",
  "magic",
  "chaos_gauntlets",
  "dba_spec",
  "restore"
].map((id) => ({ id, label: id.replaceAll("_", " ") }));

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
  return CombatSetupFormSchema.parse({ ...form, ...patch });
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

function primaryPrayerValue(prayers: readonly string[]): string {
  return prayers.find((prayer) => prayer !== "none") ?? "none";
}

function primaryBoostValue(boosts: readonly string[]): string {
  return boosts.find((boost) => boost !== "none") ?? "none";
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

function signedPercent(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${formatNumber(value, 1)}%`;
}

function finiteMetric(value: number, digits = 1): string {
  return Number.isFinite(value) ? formatNumber(value, digits) : "-";
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

function legacyMigrationSummaryItems(report: LegacySetupMigrationReport): string[] {
  const foundKeys = new Set(report.foundKeys);
  const pricesFound = report.foundKeys.some((key) => LEGACY_PRICE_STORAGE_KEYS.has(key));
  const historyFound = foundKeys.has("sim_price_history_v1");
  const unsupportedDataFound =
    report.warnings.length > 0 ||
    report.skippedFields.length > 0 ||
    report.foundKeys.some(
      (key) =>
        ![
          LEGACY_INPUT_STORAGE_KEY,
          "sim_hiscore_player",
          "sim_prices_v1",
          "sim_alch_v1",
          "sim_scraped_at_v1",
          "sim_price_history_v1"
        ].includes(key)
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
    report.priceSet ? "Prices ready" : pricesFound ? "Prices skipped" : "No prices",
    historyFound ? "Price history found" : "No price history",
    foundKeys.has("sim_planner_v1") ? "Planner data found" : "No planner data",
    unsupportedDataFound ? "Unsupported data found" : "No unsupported data"
  ];
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
    if (error.code === "upstream-unavailable") return "Hiscores unavailable";
    if (error.code === "upstream-invalid") return "Hiscores response invalid";
  }
  return "Hiscores lookup failed";
}

function describeMarketError(error: unknown): string {
  if (error instanceof MarketAdapterError) {
    if (error.code === "bad-request") return "Check the market sync request";
    if (error.code === "not-found") return "Market sync target not found";
    if (error.code === "rate-limited") {
      return error.retryAfterSeconds
        ? `Rate limited. Try again in ${error.retryAfterSeconds}s`
        : "Rate limited";
    }
    if (error.code === "upstream-unavailable") return "Market sync unavailable";
    if (error.code === "upstream-invalid") return "Market sync response invalid";
  }
  return "Market sync failed";
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
    ? "Hiscores disabled: runtime or upstream not configured"
    : "Hiscores unavailable";
}

function marketUnavailableMessage(status: MarketStatusResponse | null): string {
  return status?.source.id === "disabled"
    ? "Market sync disabled: runtime or upstream not configured"
    : "Market sync unavailable";
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

export function App() {
  const [context, setContext] = useState<SimulationContext | null>(null);
  const [initialSavedSetup] = useState(loadInitialSavedSetup);
  const [form, setForm] = useState<CombatSetupFormState>(() => initialSavedSetup.setup.form);
  const [cannonByMonster, setCannonByMonster] = useState<CannonByMonsterState>(
    () => initialSavedSetup.setup.cannonByMonster
  );
  const [denseCompare, setDenseCompare] = useState<DenseCompareUiState>(
    () => initialSavedSetup.setup.denseCompare
  );
  const [lootPrefsByMonster, setLootPrefsByMonster] = useState<LootPrefsState>(
    loadInitialLootPrefs
  );
  const [priceHistory, setPriceHistory] = useState<BrowserPriceHistoryState>(
    loadInitialPriceHistory
  );
  const [legacyMigrationDismissed, setLegacyMigrationDismissed] = useState(
    loadInitialLegacyMigrationDismissed
  );
  const [legacyMigrationReport, setLegacyMigrationReport] =
    useState<LegacySetupMigrationReport | null>(null);
  const [legacyClearPending, setLegacyClearPending] = useState(false);
  const [readyToPersist, setReadyToPersist] = useState(false);
  const [status, setStatus] = useState("Loading bundled data");
  const [error, setError] = useState<string | null>(null);
  const [priceLabel, setPriceLabel] = useState("Bundled legacy prices");
  const [hiscoresStatus, setHiscoresStatus] = useState<HiscoresStatusResponse | null>(null);
  const [hiscoresPlayer, setHiscoresPlayer] = useState(() => loadLastHiscoresPlayer(storage));
  const [hiscoresResponse, setHiscoresResponse] = useState<HiscoresResponse | null>(null);
  const [hiscoresBusy, setHiscoresBusy] = useState(false);
  const [hiscoresNotice, setHiscoresNotice] = useState<{
    tone: "neutral" | "success" | "error";
    message: string;
  } | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatusResponse | null>(null);
  const [marketBusy, setMarketBusy] = useState<MarketSyncScope | null>(null);
  const [marketReport, setMarketReport] = useState<MarketSyncReport | null>(null);
  const [marketNotice, setMarketNotice] = useState<{
    tone: "neutral" | "success" | "error";
    message: string;
  } | null>(null);
  const [lootNotice, setLootNotice] = useState<string | null>(null);
  const heavyForm = useDebouncedValue(form, 250);

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
        setMarketStatus(result);
        setMarketNotice(
          result.available ? null : { tone: "neutral", message: marketUnavailableMessage(result) }
        );
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setMarketStatus(null);
        setMarketNotice({ tone: "error", message: describeMarketError(caught) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadBundledLegacyContext()
      .then((result) => {
        if (cancelled) return;
        setStatus(initialSavedSetup.loaded ? "Loaded saved rewrite setup" : "Loaded bundled data");
        setContext(result.context);
        setReadyToPersist(true);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [initialSavedSetup.loaded]);

  useEffect(() => {
    if (!context || legacyMigrationDismissed) {
      setLegacyMigrationReport(null);
      return;
    }
    const report = inspectLegacySetupMigration({ storage, gameData: context.gameData });
    setLegacyMigrationReport(report.foundKeys.length > 0 ? report : null);
    setLegacyClearPending(false);
  }, [context, legacyMigrationDismissed]);

  useEffect(() => {
    if (!readyToPersist) return;
    savePersisted(setupStorageOptions, savedSetupFromForm(form, denseCompare, cannonByMonster));
  }, [cannonByMonster, denseCompare, form, readyToPersist]);

  useEffect(() => {
    if (!context) return;
    setLootPrefsByMonster((current) => {
      const next: LootPrefsState = {};
      for (const [monsterId, monsterPrefs] of Object.entries(current)) {
        const monster = context.gameData.monsters[monsterId];
        if (!monster) continue;
        const selected = selectLootPrefsForMonster(
          { [monsterId]: monsterPrefs },
          monsterId,
          lootPreferenceKeysForMonster(monster)
        );
        if (Object.keys(selected).length > 0) next[monsterId] = selected;
      }
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [context]);

  useEffect(() => {
    if (!readyToPersist) return;
    savePersisted(lootPrefsStorageOptions, lootPrefsByMonster);
  }, [lootPrefsByMonster, readyToPersist]);

  useEffect(() => {
    if (!readyToPersist || priceHistory.snapshots.length === 0) return;
    savePersisted(priceHistoryStorageOptions, priceHistory);
  }, [priceHistory, readyToPersist]);

  const currentLootRowIds = useMemo(() => {
    if (!context) return [];
    const monster = context.gameData.monsters[form.monsterId];
    return monster ? lootPreferenceKeysForMonster(monster) : [];
  }, [context, form.monsterId]);
  const currentLootPrefs = useMemo(
    () => selectLootPrefsForMonster(lootPrefsByMonster, form.monsterId, currentLootRowIds),
    [currentLootRowIds, form.monsterId, lootPrefsByMonster]
  );

  const viewModel = useMemo(
    () =>
      context ? createSimulationViewModel(form, context, cannonByMonster, currentLootPrefs) : null,
    [cannonByMonster, context, currentLootPrefs, form]
  );
  const denseCompareRows = useMemo(
    () =>
      context
        ? createDenseCompareRows(
            heavyForm,
            context,
            denseCompare.sort,
            cannonByMonster,
            lootPrefsByMonster
          )
        : [],
    [cannonByMonster, context, denseCompare.sort, heavyForm, lootPrefsByMonster]
  );
  const hiscoresPreviewRows = useMemo(
    () => (hiscoresResponse ? createHiscoresPreviewRows(form, hiscoresResponse) : []),
    [form, hiscoresResponse]
  );
  const hiscoresAvailable = hiscoresStatus?.available === true;
  const hiscoresStatusText = statusText(hiscoresStatus, hiscoresAvailable);
  const canApplyHiscores = hiscoresPreviewRows.some((row) => row.canApply);
  const marketAvailable = marketStatus?.available === true;
  const marketStatusText = statusText(marketStatus, marketAvailable);
  const priceHistorySummary = useMemo(
    () => summarizePriceHistory(priceHistory, context?.priceSet ?? null),
    [context?.priceSet, priceHistory]
  );

  const monsters = useMemo(() => (context ? monsterOptions(context.gameData) : []), [context]);
  const styles = useMemo(
    () => (context ? styleOptions(context.gameData, form.combatStyle, form.weaponId) : []),
    [context, form.combatStyle, form.weaponId]
  );
  const spellOptions = useMemo<SelectOption[]>(
    () =>
      context
        ? Object.entries(context.gameData.spells).map(([id, spell]) => ({
            id,
            label: spell.name
          }))
        : [],
    [context]
  );
  const specialAttackOptions = useMemo<SelectOption[]>(
    () => [
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
    [context, form.combatStyle]
  );
  const specialAttackMeta = useMemo(
    () =>
      context
        ? supportedSpecialAttacksForCombatStyle(form.combatStyle, context.gameData).find(
            (attack) => attack.weaponId === form.specialAttack.weaponId
          ) ?? null
        : null,
    [context, form.combatStyle, form.specialAttack.weaponId]
  );
  const arrowAmmoOptions = useMemo<SelectOption[]>(
    () =>
      context
        ? Object.entries(context.gameData.ammo)
            .filter(([, ammo]) => ammo.kind === "arrow")
            .map(([id, ammo]) => ({ id, label: ammo.name }))
            .sort((left, right) => left.label.localeCompare(right.label))
        : [],
    [context]
  );

  const setFormSafe = (updater: (current: CombatSetupFormState) => CombatSetupFormState) => {
    setForm((current) => updater(current));
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

  const importPrices = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !context) return;
    try {
      const priceSet = parsePriceSetFileText(await readBrowserFileText(file, 1_000_000));
      const acceptedAt = new Date();
      setContext({ ...context, priceSet });
      setPriceHistory((current) => appendAcceptedPriceSetToHistory(current, priceSet, acceptedAt));
      setPriceLabel(priceSet.label);
      setStatus("Imported price set");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      event.target.value = "";
    }
  };

  const importSetup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = SavedSetupEnvelopeSchema.parse(
        JSON.parse(await readBrowserFileText(file, 250_000))
      );
      const setup = parsed.data;
      setForm(setup.form);
      setDenseCompare(setup.denseCompare);
      setCannonByMonster(setup.cannonByMonster);
      setStatus("Imported rewrite setup");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      event.target.value = "";
    }
  };

  const dismissLegacyMigration = (
    report: LegacySetupMigrationReport,
    message: string
  ): void => {
    savePersisted(legacyMigrationDismissedStorageOptions, {
      dismissedAt: new Date().toISOString(),
      foundKeys: report.foundKeys
    });
    setLegacyMigrationDismissed(true);
    setLegacyMigrationReport(null);
    setLegacyClearPending(false);
    setStatus(message);
  };

  const importLegacySetup = () => {
    if (
      !legacyMigrationReport?.setup &&
      !legacyMigrationReport?.hiscoresPlayer &&
      !legacyMigrationReport?.priceSet
    ) {
      return;
    }
    if (legacyMigrationReport.setup) {
      const setup = savedSetupFromForm(legacyMigrationReport.setup, denseCompare, cannonByMonster);
      savePersisted(setupStorageOptions, setup);
      setForm(setup.form);
      setDenseCompare(setup.denseCompare);
      setCannonByMonster(setup.cannonByMonster);
    }
    if (legacyMigrationReport.hiscoresPlayer) {
      saveLastHiscoresPlayer(storage, legacyMigrationReport.hiscoresPlayer);
      setHiscoresPlayer(legacyMigrationReport.hiscoresPlayer);
    }
    if (legacyMigrationReport.priceSet) {
      const priceSet = legacyMigrationReport.priceSet;
      const acceptedAt = new Date();
      setContext((current) => (current ? { ...current, priceSet } : current));
      setPriceHistory((current) => appendAcceptedPriceSetToHistory(current, priceSet, acceptedAt));
      setPriceLabel(priceSet.label);
    }
    setError(null);
    dismissLegacyMigration(legacyMigrationReport, "Imported compatible legacy data");
  };

  const keepLegacyData = () => {
    if (!legacyMigrationReport) return;
    dismissLegacyMigration(legacyMigrationReport, "Kept legacy data");
  };

  const confirmClearLegacyData = () => {
    if (!legacyMigrationReport) return;
    const clearedKeys = clearKnownLegacyStorageKeys(storage);
    dismissLegacyMigration(
      { ...legacyMigrationReport, foundKeys: clearedKeys },
      `Cleared ${clearedKeys.length} legacy keys`
    );
  };

  const handleHiscoresLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hiscoresPlayer.trim()) {
      setHiscoresNotice({ tone: "error", message: "Enter a player name" });
      return;
    }
    if (!hiscoresAvailable) {
      setHiscoresNotice({ tone: "error", message: hiscoresUnavailableMessage(hiscoresStatus) });
      return;
    }

    setHiscoresBusy(true);
    setHiscoresNotice({ tone: "neutral", message: "Looking up hiscores" });
    try {
      const response = await lookupHiscores(hiscoresPlayer);
      setHiscoresResponse(response);
      saveLastHiscoresPlayer(storage, response.player);
      setHiscoresNotice({
        tone: "success",
        message: createHiscoresPreviewRows(form, response).length
          ? "Hiscores preview ready"
          : "No supported skills returned"
      });
    } catch (caught: unknown) {
      setHiscoresResponse(null);
      setHiscoresNotice({ tone: "error", message: describeHiscoresError(caught) });
    } finally {
      setHiscoresBusy(false);
    }
  };

  const applyHiscoresPreview = () => {
    if (!hiscoresResponse) return;
    const applied = countApplicableHiscoresSkills(hiscoresResponse);
    setFormSafe((current) => applyHiscoresLevels(current, hiscoresResponse));
    setHiscoresNotice({
      tone: applied ? "success" : "neutral",
      message: applied ? `Applied ${applied} skills` : "No current setup skills to apply"
    });
  };

  const handleMarketSync = async (scope: Exclude<MarketSyncScope, "items">) => {
    if (!context) return;
    if (!marketAvailable) {
      setMarketNotice({ tone: "error", message: marketUnavailableMessage(marketStatus) });
      return;
    }

    setMarketBusy(scope);
    setMarketNotice({ tone: "neutral", message: "Syncing market prices" });
    try {
      const response = await syncMarketPrices({
        scope,
        monsterId: scope === "monster" ? form.monsterId : undefined,
        includeAlch: true
      });
      const acceptedAt = new Date();
      setContext((current) =>
        current
          ? applyMarketSyncResponse(current, response)
          : applyMarketSyncResponse(context, response)
      );
      setPriceHistory((current) =>
        appendAcceptedPriceSetToHistory(current, response.priceSet, acceptedAt)
      );
      setPriceLabel(response.priceSet.label);
      setStatus("Synced market prices");
      setMarketReport(response.report);
      setMarketNotice({
        tone: response.report.failed ? "neutral" : "success",
        message: summarizeMarketSyncReport(response.report)
      });
    } catch (caught: unknown) {
      setMarketNotice({ tone: "error", message: describeMarketError(caught) });
    } finally {
      setMarketBusy(null);
    }
  };

  if (error) {
    return (
      <main className="app-shell">
        <section className="fatal" role="alert">
          <h1>2004scape Combat Simulator</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!context || !viewModel) {
    return (
      <main className="app-shell">
        <section className="loading" aria-live="polite">
          {status}
        </section>
      </main>
    );
  }

  const setCombatStyle = (combatStyle: CombatStyle) =>
    setFormSafe((current) => setCombatStyleDefaults(current, combatStyle));

  const updateLevel = (skill: keyof CombatSetupFormState["levels"], value: number) =>
    setFormSafe((current) =>
      updateForm(current, {
        levels: { ...current.levels, [skill]: value }
      })
    );

  const selectTarget = (monsterId: EntityId) =>
    setFormSafe((current) => updateForm(current, { monsterId }));

  const primarySkill = primaryLevelKey(form.combatStyle);
  const selectedPrayer = primaryPrayerValue(form.prayers);
  const selectedBoost = primaryBoostValue(form.boosts);
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
      ? "magic off"
      : dbaSpecActive
        ? "DBA"
        : viewModel.combat.specialAttack?.weaponName ?? "off";
  const currentMonster = context.gameData.monsters[form.monsterId];
  const currentCannon = cannonByMonster[form.monsterId] ?? DEFAULT_CANNON_SETTINGS;
  const currentCannonOutput = viewModel.trip.cannon;
  const cannonEnabled = currentCannon.enabled === true;
  const cannonTargets = currentCannon.targets ?? DEFAULT_CANNON_SETTINGS.targets ?? 3;
  const cannonRespawn =
    currentCannon.respawnSec ?? (currentMonster as unknown as { respawn?: number }).respawn ?? 60;
  const cannonStatus = !cannonEnabled
    ? "off"
    : currentCannonOutput?.idle
      ? "idle"
      : currentCannonOutput?.respawnBound
        ? "respawn-bound"
        : "active";
  const incoming = viewModel.trip.trip.incoming;
  const foodCountMode = form.trip.foodCount == null ? "auto" : "manual";
  const foodCountValue =
    form.trip.foodCount ?? Math.max(0, Math.round(viewModel.trip.trip.slots.autoFoodCount));
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
        Math.round(
          viewModel.trip.trip.prayerSlots > 0 ? viewModel.trip.trip.prayerSlots * 4 : 4
        )
      )
    );
  const prayerRestoreValue =
    prayerRestoreMode === "manual_doses" ? prayerDosesValue : prayerVialsValue;
  const altarTimeMode = form.trip.altarSeconds == null ? "auto" : "manual";
  const altarSecondsValue =
    form.trip.altarSeconds ?? Math.max(0, Math.round(viewModel.trip.trip.altarSeconds));
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
      ? optionLabel(PRAYER_RESTORE_MODE_OPTIONS, prayerRestoreMode)
      : form.trip.prayerMode === "altar"
        ? optionLabel(ALTAR_TIME_MODE_OPTIONS, altarTimeMode)
        : "No restore";
  const setCannonForCurrentMonster = (patch: Partial<CannonByMonsterState[string]>) => {
    setCannonByMonster((current) => {
      const previous = current[form.monsterId] ?? DEFAULT_CANNON_SETTINGS;
      return {
        ...current,
        [form.monsterId]: CannonSettingsSchema.parse({ ...previous, ...patch })
      };
    });
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
    setLootPrefsByMonster((current) => resetLootPrefsForMonster(current, form.monsterId));
    setLootNotice("Reset current monster loot overrides");
  };
  const optimizeCurrentLoot = () => {
    const result = optimizeLootPrefsForMonster(form, context, cannonByMonster);
    setLootPrefsByMonster((current) =>
      replaceLootPrefsForMonster(current, form.monsterId, result.prefs)
    );
    setLootNotice(
      `Optimized ${formatNumber(result.changedRows)} rows (${formatDelta(result.deltaNetGpPerHour)} net GP/hr)`
    );
  };
  const accuracyLabel = form.combatStyle === "magic" ? "M+%" : "ACC+";
  const damageLabel = form.combatStyle === "magic" ? "DMG%" : "DMG+";
  const sortDescription = `${DENSE_TABLE_COLUMNS.find((column) => column.key === denseCompare.sort.key)?.label ?? denseCompare.sort.key} ${denseCompare.sort.direction}`;
  const legacyMigrationSummary = legacyMigrationReport
    ? legacyMigrationSummaryItems(legacyMigrationReport)
    : [];
  const legacyImportReady =
    legacyMigrationReport?.setup != null ||
    legacyMigrationReport?.hiscoresPlayer != null ||
    legacyMigrationReport?.priceSet != null;
  const legacyMigrationStatus = legacyMigrationReport
    ? legacyImportReady
      ? `${legacyMigrationReport.importedFields.length} compatible fields`
      : "review only"
    : "";

  return (
    <main className="app-shell">
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
            <input type="file" accept="application/json,.json" onChange={importPrices} />
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
                data: savedSetupFromForm(form, denseCompare, cannonByMonster)
              })
            }
          >
            Export setup
          </button>
        </div>
      </header>

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

      <section className="dense-workbench" aria-label="Dense combat spreadsheet">
        <section className="compact-setup-strip" aria-label="Combat setup">
          <SelectField
            label="TYPE"
            value={form.combatStyle}
            options={COMBAT_STYLE_OPTIONS}
            onChange={(combatStyle) => setCombatStyle(combatStyle as CombatStyle)}
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
              options={spellOptions}
              onChange={(spellId) => setFormSafe((current) => updateForm(current, { spellId }))}
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
          <SelectField
            label="PRAY"
            value={selectedPrayer}
            options={PRAYER_OPTIONS}
            onChange={(prayer) =>
              setFormSafe((current) =>
                updateForm(current, { prayers: prayer === "none" ? [] : [prayer] })
              )
            }
          />
          <SelectField
            label="POT"
            value={selectedBoost}
            options={BOOST_OPTIONS}
            onChange={(boost) =>
              setFormSafe((current) =>
                updateForm(current, { boosts: boost === "none" ? [] : [boost] })
              )
            }
          />
          <ReadOnlyField label={accuracyLabel} value="-" disabled />
          <ReadOnlyField label={damageLabel} value="-" disabled />
          <ReadOnlyField
            label="SPD"
            value={`${formatNumber(viewModel.combat.attackSpeedSec, 1)}s`}
          />
          <ReadOnlyField label="F/KL" value={formatNumber(viewModel.trip.trip.foodPerKill, 2)} />
          <SelectField
            label="TARGET"
            value={form.monsterId}
            options={monsters}
            onChange={selectTarget}
          />
        </section>

        <section className="dense-metric-strip" aria-label="Simulation results">
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

        <section className="special-strip" aria-label="Special attack">
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
              <p className="inline-status neutral">Magic DPS specs unavailable</p>
            )}
            {dbaSpecActive && <p className="inline-status neutral">DBA uses spec energy</p>}
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
              </div>
            )}
          </div>
        </section>

        <section className="loot-strip" aria-label="Current monster loot">
          <div className="section-title-row">
            <h2>Loot actions</h2>
            <span className="status-pill">{formatNumber(viewModel.lootRows.length)} drops</span>
          </div>
          <div className="loot-toolbar">
            <label className="toggle">
              <input
                type="checkbox"
                checked={form.trip.alching}
                onChange={(event) =>
                  setFormSafe((current) =>
                    updateForm(current, {
                      trip: { ...current.trip, alching: event.target.checked }
                    })
                  )
                }
              />
              <span>Alching</span>
            </label>
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
              { label: "Effective net", value: formatNumber(viewModel.trip.effectiveNetGpPerHour) }
            ])}
          </div>
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
                    <tr key={row.rowId} className={row.isOverride ? "active" : undefined}>
                      <td className="loot-name-cell">
                        <span>{row.name}</span>
                        <small>{row.key ?? row.tag ?? row.rowId}</small>
                      </td>
                      <td>
                        <select
                          aria-label={`Action for ${row.name} ${row.rowId}`}
                          className="action-select"
                          value={row.pref}
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
                      <td className="numeric">{formatDelta(row.selectedDeltaNetGpPerHour)}</td>
                      <td className="loot-impact-list">
                        {row.actionImpacts.map((impact) => (
                          <span key={impact.action}>
                            {actionLabel(impact.action)} {formatDelta(impact.deltaNetGpPerHour)}
                          </span>
                        ))}
                      </td>
                      <td className="numeric">{formatNumber(row.evGp, 1)}</td>
                      <td className="numeric">{formatNumber(row.chance * 100, 2)}%</td>
                      <td className="numeric">{formatNumber(row.qtyAvg, 1)}</td>
                      <td className="numeric">{formatNumber(row.price)}</td>
                      <td>
                        {row.expandedRows.length > 0 ? (
                          <details>
                            <summary>{formatNumber(row.expandedRows.length)} rows</summary>
                            <div className="loot-detail-grid">
                              {row.expandedRows.slice(0, 8).map((detail) => (
                                <span key={`${row.rowId}-${detail.label}`}>
                                  {detail.label}
                                  {detail.price == null ? "" : ` ${formatNumber(detail.price)}`}
                                </span>
                              ))}
                            </div>
                          </details>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="trip-strip" aria-label="Trip assumptions">
          <div className="section-title-row">
            <h2>Trip assumptions</h2>
            <span className="status-pill">{viewModel.trip.trip.bound}</span>
          </div>
          <div className="trip-body">
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
                        mode === "manual" ? Math.max(0, Math.min(3600, altarSecondsValue)) : null
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
            <div className="trip-output" aria-label="Trip summary">
              {metricList([
                { label: "Safespot", value: safespotSummary },
                { label: "Protect", value: optionLabel(PROTECT_OPTIONS, form.trip.protect) },
                { label: "Prayer block", value: yesNo(incoming.protected) },
                { label: "Prayer mode", value: optionLabel(PRAYER_MODE_OPTIONS, form.trip.prayerMode) },
                { label: "Restore", value: prayerRestoreSummary },
                { label: "Prayer/kill", value: formatNumber(viewModel.trip.trip.prayerPerKill, 2) },
                { label: "Prayer slots", value: formatNumber(viewModel.trip.trip.prayerSlots) },
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
                },
                { label: "Antifire", value: yesNo(form.trip.antifire) },
                { label: "Antipoison", value: yesNo(form.trip.antipoison) },
                { label: "Food count", value: formatNumber(viewModel.trip.trip.slots.foodCount) },
                {
                  label: "Auto food",
                  value: formatNumber(viewModel.trip.trip.slots.autoFoodCount)
                },
                {
                  label: "Food left",
                  value: formatNumber(viewModel.trip.trip.slots.foodLeftAtEnd, 1)
                },
                { label: "HP/kill", value: formatNumber(incoming.hpPerKill, 2) },
                { label: "Dragonfire", value: formatNumber(incoming.dragonfire, 2) },
                { label: "Poison", value: formatNumber(incoming.poison ?? 0, 2) },
                { label: "Food/kill", value: formatNumber(viewModel.trip.trip.foodPerKill, 2) },
                { label: "Kills/trip", value: formatNumber(viewModel.trip.trip.killsPerTrip, 1) },
                { label: "Effective K/hr", value: formatNumber(viewModel.trip.effectiveKph) },
                {
                  label: "Recoil rings",
                  value: recoilRingEquipped ? formatNumber(form.trip.recoilRings) : "No ring"
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
                    : "-"
                }
              ])}
            </div>
          </div>
        </section>

        <section className="cannon-strip" aria-label="Cannon">
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
                onChange={(event) => setCannonForCurrentMonster({ enabled: event.target.checked })}
              />
              <span>Set up cannon</span>
            </label>
            <NumberField
              label="Mobs at spot"
              value={cannonTargets}
              min={1}
              max={8}
              onChange={(value) => setCannonForCurrentMonster({ targets: value })}
            />
            <NumberField
              label="Respawn"
              value={cannonRespawn}
              min={1}
              max={3600}
              onChange={(value) => setCannonForCurrentMonster({ respawnSec: value })}
            />
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
                    { label: "Balls/hr", value: formatNumber(currentCannonOutput.ballsPerHour) },
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
                      label: "Ball cost/hr",
                      value: formatNumber(currentCannonOutput.ballCostPerHour),
                      tone: "gold"
                    },
                    {
                      label: "Ball cost/kill",
                      value: formatNumber(currentCannonOutput.ballCostPerKill),
                      tone: "gold"
                    },
                    { label: "Ball price", value: formatNumber(currentCannonOutput.ballPrice) },
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
                              (currentCannonOutput.kphWithCannon / currentCannonOutput.kphNoCannon -
                                1) *
                                100,
                              1
                            )}%`
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
                    { label: "Ball cost/hr", value: "0" },
                    { label: "Cannonballs/trip", value: "-" }
                  ])}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="service-strip" aria-label="Live services">
          <section className="service-group" aria-label="Hiscores">
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
                  onChange={(event) => setHiscoresPlayer(event.target.value)}
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

          <section className="service-group" aria-label="Market sync">
            <div className="section-title-row">
              <h2>Market</h2>
              <span className={`status-pill ${marketAvailable ? "ready" : ""}`}>
                {marketStatusText}
              </span>
            </div>
            <div className="market-sync-bar">
              <button
                type="button"
                disabled={!marketAvailable || marketBusy !== null}
                onClick={() => void handleMarketSync("monster")}
              >
                {marketBusy === "monster" ? "Syncing" : "Sync monster"}
              </button>
              <button
                type="button"
                disabled={!marketAvailable || marketBusy !== null}
                onClick={() => void handleMarketSync("all-supported")}
              >
                {marketBusy === "all-supported" ? "Syncing" : "Sync all"}
              </button>
            </div>
            <div className="price-history-summary" aria-label="Price history summary">
              <span>Snapshots {formatNumber(priceHistorySummary.snapshotCount)}</span>
              <span>Items {formatNumber(priceHistorySummary.trackedItemCount)}</span>
              <span>Latest age {formatAge(priceHistorySummary.latestAgeSeconds)}</span>
              <span>Active {priceHistorySummary.activeLabel}</span>
              <span>
                Latest {priceHistorySummary.latestLabel}
                {priceHistorySummary.activeMatchesLatest ? " active" : ""}
              </span>
            </div>
            {marketNotice && (
              <p
                className={`inline-status ${marketNotice.tone}`}
                role={marketNotice.tone === "error" ? "alert" : "status"}
              >
                {marketNotice.message}
              </p>
            )}
            {marketReport && (
              <div className="market-report" aria-label="Market sync report">
                <span>Source {marketReport.source.label}</span>
                <span>Fetched {marketReport.finishedAt}</span>
                <span>Updated {marketReport.updated}</span>
                <span>Skipped {marketReport.skipped}</span>
                <span>Failed {marketReport.failed}</span>
              </div>
            )}
          </section>
        </section>

        <section className="dense-table-panel" aria-label="Monster comparison">
          <div className="table-toolbar">
            <div>
              <h2>All monsters</h2>
              <span>
                {denseCompareRows.length} rows - current loadout - sort {sortDescription}
              </span>
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
                      tabIndex={0}
                      onClick={() => selectTarget(row.monsterId)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        selectTarget(row.monsterId);
                      }}
                    >
                      {DENSE_TABLE_COLUMNS.map((column) => (
                        <td
                          key={column.key}
                          className={column.align === "right" ? "numeric" : "monster-cell"}
                        >
                          {column.key === "monsterName" && (
                            <span className="row-marker" aria-hidden="true">
                              {active ? ">" : ""}
                            </span>
                          )}
                          <span>{column.render(row)}</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

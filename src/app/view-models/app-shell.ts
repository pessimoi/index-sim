import type { DistributionSummary } from "@/domain/risk";
import type { CombatStyle, EntityId } from "@/domain/shared";
import {
  BOOST_SELECTION_OPTIONS,
  PRAYER_SELECTION_OPTIONS,
  extraBoostSelectionCount,
  extraPrayerSelectionCount,
  primaryBoostValue,
  primaryPrayerValue,
  type CombatSetupFormState,
  type SetupSelectionOption
} from "../state/ui-state";
import { ShareableSetupError, type ShareableSetupReview } from "../state/shareable-setup";
import type { SelectOptionViewModel } from "./contracts";
import { formatDuration, formatNumber } from "./formatting";
import { formatRiskRange } from "./risk";

export const WORKBENCH_TABS = [
  { id: "stats", label: "Stats" },
  { id: "loadout", label: "Loadout" },
  { id: "compare", label: "Monsters" },
  { id: "duel", label: "Setups" },
  { id: "loot", label: "Loot" },
  { id: "trip", label: "Trip" },
  { id: "risk", label: "Risk" },
  { id: "cannon", label: "Cannon" },
  { id: "planner", label: "Planner" },
  { id: "economy", label: "Economy" },
  { id: "settings", label: "Settings" }
] as const;

export type WorkbenchTabId = (typeof WORKBENCH_TABS)[number]["id"];
export type WorkbenchNavigationKey = "ArrowLeft" | "ArrowRight" | "Home" | "End";

export const COMBAT_STYLE_OPTIONS: SelectOptionViewModel[] = [
  { id: "melee", label: "melee" },
  { id: "ranged", label: "ranged" },
  { id: "magic", label: "magic" }
];

export const PRIMARY_PRAYER_OPTIONS: SelectOptionViewModel[] = [
  { id: "none", label: "None" },
  ...PRAYER_SELECTION_OPTIONS.map(({ id, label }) => ({ id, label }))
];

export const PRIMARY_BOOST_OPTIONS: SelectOptionViewModel[] = [
  { id: "none", label: "None" },
  ...BOOST_SELECTION_OPTIONS.map(({ id, label }) => ({ id, label }))
];

export interface AppShellSetupViewModel {
  primarySkill: keyof CombatSetupFormState["levels"];
  primaryLevelLabel: "ATT" | "RNG" | "MAG";
  primaryPrayer: EntityId;
  primaryBoost: EntityId;
  extraPrayerCount: number;
  extraBoostCount: number;
  prayerSelectionSummary: string;
  boostSelectionSummary: string;
  setupStatus: "Custom setup" | "Default setup - custom saved" | "Default setup";
  accuracyLabel: "M+%" | "ACC+";
  damageLabel: "DMG%" | "DMG+";
  derivedAccuracyPlaceholder: string;
  derivedDamagePlaceholder: string;
  derivedSpeedPlaceholder: string;
  setupGuide: readonly [SetupGuideRowViewModel, SetupGuideRowViewModel, SetupGuideRowViewModel];
}

export interface SetupGuideRowViewModel {
  target: WorkbenchTabId;
  ariaLabel: string;
  label: string;
  value: string;
  context: string;
}

export type ShareableSetupInspection =
  { status: "ready"; review: ShareableSetupReview } | { status: "error"; message: string };

export type SharedSetupReviewViewModel =
  | {
      status: "error";
      tone: "error";
      statusLabel: "Invalid";
      message: string;
    }
  | {
      status: "ready";
      tone: "ready" | "warning";
      statusLabel: "Ready to load";
      targetLine: string;
      cannonLabel: "Cannon on" | "Cannon off";
      lootChoiceLabel: string;
      gameDataWarning: string | null;
      droppedLootWarning: string | null;
    };

export interface WorkbenchMetricViewModel {
  label: string;
  value: string;
  tone?: string;
  detail?: string;
  reviewTarget?: WorkbenchTabId;
}

export interface NetGpGuidanceViewModel {
  visible: boolean;
  message: string;
}

export interface WorkbenchResultViewModel {
  sidebarMetrics: ShellDisplayMetricViewModel[];
  contextMetrics: ShellDisplayMetricViewModel[];
  metrics: WorkbenchMetricViewModel[];
  netGpGuidance: NetGpGuidanceViewModel;
}

export interface ShellDisplayMetricViewModel {
  label: string;
  value: string;
  tone?: string;
}

function setupSelectionSummary(
  selectedIds: readonly string[],
  options: readonly SetupSelectionOption[]
): string {
  if (selectedIds.length === 0) return "None";
  return selectedIds
    .map((id) => options.find((option) => option.id === id)?.label ?? id)
    .join(" + ");
}

export function primaryLevelKey(combatStyle: CombatStyle): keyof CombatSetupFormState["levels"] {
  if (combatStyle === "ranged") return "ranged";
  if (combatStyle === "magic") return "magic";
  return "attack";
}

export function primaryLevelShortLabel(combatStyle: CombatStyle): "ATT" | "RNG" | "MAG" {
  if (combatStyle === "ranged") return "RNG";
  if (combatStyle === "magic") return "MAG";
  return "ATT";
}

export function workbenchTabLabel(tabId: WorkbenchTabId, combatStyle: CombatStyle): string {
  if (tabId === "loadout") {
    return `${combatStyle.charAt(0).toUpperCase()}${combatStyle.slice(1)} setup`;
  }
  return WORKBENCH_TABS.find((tab) => tab.id === tabId)?.label ?? tabId;
}

export function nextWorkbenchTabId(
  currentTabId: WorkbenchTabId,
  key: string
): WorkbenchTabId | null {
  if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Home" && key !== "End") {
    return null;
  }
  const currentIndex = WORKBENCH_TABS.findIndex((tab) => tab.id === currentTabId);
  if (currentIndex < 0) return null;
  let nextIndex = currentIndex;
  if (key === "ArrowRight") nextIndex = (currentIndex + 1) % WORKBENCH_TABS.length;
  if (key === "ArrowLeft") {
    nextIndex = (currentIndex - 1 + WORKBENCH_TABS.length) % WORKBENCH_TABS.length;
  }
  if (key === "Home") nextIndex = 0;
  if (key === "End") nextIndex = WORKBENCH_TABS.length - 1;
  return WORKBENCH_TABS[nextIndex]!.id;
}

export function createAppShellSetupViewModel(input: {
  form: CombatSetupFormState;
  hasCurrentCustomSetup: boolean;
  activeSetupIsCustom: boolean;
  derivedAccuracyBonus: number;
  derivedDamageBonus: number;
  derivedAttackSpeedSec: number;
  potionCarrySummary: string;
  prayerRestoreSourceSummary: string;
  lootPolicySummary: string;
}): AppShellSetupViewModel {
  const { form } = input;
  const setupStatus = input.activeSetupIsCustom
    ? "Custom setup"
    : input.hasCurrentCustomSetup
      ? "Default setup - custom saved"
      : "Default setup";
  const prayerSelection = setupSelectionSummary(form.prayers, PRAYER_SELECTION_OPTIONS);
  const boostSelection = setupSelectionSummary(form.boosts, BOOST_SELECTION_OPTIONS);

  return {
    primarySkill: primaryLevelKey(form.combatStyle),
    primaryLevelLabel: primaryLevelShortLabel(form.combatStyle),
    primaryPrayer: primaryPrayerValue(form.prayers),
    primaryBoost: primaryBoostValue(form.boosts),
    extraPrayerCount: extraPrayerSelectionCount(form.prayers),
    extraBoostCount: extraBoostSelectionCount(form.boosts),
    prayerSelectionSummary: prayerSelection,
    boostSelectionSummary: boostSelection,
    setupStatus,
    accuracyLabel: form.combatStyle === "magic" ? "M+%" : "ACC+",
    damageLabel: form.combatStyle === "magic" ? "DMG%" : "DMG+",
    derivedAccuracyPlaceholder: formatSignedInteger(input.derivedAccuracyBonus),
    derivedDamagePlaceholder: formatSignedInteger(input.derivedDamageBonus),
    derivedSpeedPlaceholder: formatNumber(input.derivedAttackSpeedSec, 1),
    setupGuide: [
      {
        target: "loadout",
        ariaLabel: "Edit prayers and combat boosts",
        label: "Prayers & combat boosts",
        value: `${prayerSelection} · ${boostSelection}`,
        context: `${form.combatStyle} setup`
      },
      {
        target: "trip",
        ariaLabel: "Edit potion carry and prayer restore",
        label: "Potion carry & prayer restore",
        value: `${input.potionCarrySummary} · ${input.prayerRestoreSourceSummary}`,
        context: "Trip"
      },
      {
        target: "loot",
        ariaLabel: "Edit loot rules",
        label: "Loot rules",
        value: input.lootPolicySummary,
        context: "Loot"
      }
    ]
  };
}

function formatSignedInteger(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value, 0)}`;
}

export function describeShareableSetupError(error: unknown): string {
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

export function createSharedSetupReviewViewModel(input: {
  inspection: ShareableSetupInspection;
  monsters: Readonly<Record<string, { name: string } | undefined>>;
}): SharedSetupReviewViewModel {
  if (input.inspection.status === "error") {
    return {
      status: "error",
      tone: "error",
      statusLabel: "Invalid",
      message: input.inspection.message
    };
  }

  const { review } = input.inspection;
  const { data } = review.envelope;
  const droppedLootCount = review.droppedLootRowCount;
  return {
    status: "ready",
    tone: review.gameDataMismatch || droppedLootCount > 0 ? "warning" : "ready",
    statusLabel: "Ready to load",
    targetLine: `${input.monsters[data.form.monsterId]?.name ?? data.form.monsterId} · ${data.form.combatStyle}`,
    cannonLabel: data.cannon.enabled ? "Cannon on" : "Cannon off",
    lootChoiceLabel: `${formatNumber(Object.keys(data.lootPreferences).length)} loot choices`,
    gameDataWarning: review.gameDataMismatch
      ? "Different game-data version. Available ids were validated before loading."
      : null,
    droppedLootWarning:
      droppedLootCount > 0
        ? `${formatNumber(droppedLootCount)} stale loot choices will be skipped.`
        : null
  };
}

export function createWorkbenchResultViewModel(input: {
  effectiveDps: number;
  maxHit: number;
  hitChance: number;
  ttkSec: number;
  killsPerHour: number;
  effectiveXpPerHour: number;
  playerEffectiveXpPerHour: number;
  cannonEffectiveXpPerHour: number;
  gpPerHour: number;
  effectiveNetGpPerHour: number;
  supplyCostPerKill: number;
  gpPerKill: number;
  supplyGapPerKill: number;
  supplyCostsExceedLoot: boolean;
  risk: {
    horizonMinutes: number;
    killTimeSeconds: DistributionSummary | null;
    timedNetGp: DistributionSummary | null;
  } | null;
}): WorkbenchResultViewModel {
  const risk = input.risk;
  return {
    sidebarMetrics: [
      {
        label: "Effective XP/hr",
        value: formatNumber(input.effectiveXpPerHour),
        tone: "teal"
      },
      {
        label: "Net GP/hr",
        value: formatNumber(input.effectiveNetGpPerHour),
        tone: "gold"
      },
      { label: "Player XP/hr", value: formatNumber(input.playerEffectiveXpPerHour) },
      { label: "Cannon XP/hr", value: formatNumber(input.cannonEffectiveXpPerHour) }
    ],
    contextMetrics: [
      { label: "DPS", value: formatNumber(input.effectiveDps, 2), tone: "teal" },
      { label: "XP/hr", value: formatNumber(input.effectiveXpPerHour), tone: "teal" },
      { label: "Net GP/hr", value: formatNumber(input.effectiveNetGpPerHour), tone: "gold" }
    ],
    metrics: [
      { label: "DPS", value: formatNumber(input.effectiveDps, 2), tone: "teal" },
      { label: "MAX HIT", value: formatNumber(input.maxHit, 1) },
      { label: "HIT %", value: `${formatNumber(input.hitChance * 100, 1)}%` },
      {
        label: "TTK",
        value: formatDuration(input.ttkSec),
        detail: risk ? `P10/50/90 ${formatRiskRange(risk.killTimeSeconds, 1, "s")}` : undefined,
        reviewTarget: risk ? "risk" : undefined
      },
      { label: "KILLS/HR", value: formatNumber(input.killsPerHour) },
      { label: "XP/HR", value: formatNumber(input.effectiveXpPerHour), tone: "teal" },
      { label: "GP/HR", value: formatNumber(input.gpPerHour) },
      {
        label: "GP/HR NET",
        value: formatNumber(input.effectiveNetGpPerHour),
        tone: "gold",
        detail: risk
          ? `${formatNumber(risk.horizonMinutes)}m P10/50/90 ${formatRiskRange(
              risk.timedNetGp,
              0,
              " gp"
            )}`
          : undefined,
        reviewTarget: risk ? "risk" : undefined
      },
      { label: "SUPPLY/KILL", value: formatNumber(input.supplyCostPerKill) },
      { label: "GP/KILL", value: formatNumber(input.gpPerKill) }
    ],
    netGpGuidance: {
      visible: input.supplyCostsExceedLoot,
      message: `Supplies ${formatNumber(input.supplyCostPerKill)} GP/kill exceed loot ${formatNumber(
        input.gpPerKill
      )} GP/kill by ${formatNumber(input.supplyGapPerKill)} GP.`
    }
  };
}

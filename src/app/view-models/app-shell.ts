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
  type SetupMode,
  type SetupSelectionOption
} from "../state/ui-state";
import { ShareableSetupError, type ShareableSetupReview } from "../state/shareable-setup";
import type { SetupTransferChangeReview } from "../state/setup-transfer-changes";
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
  editor: SetupEditorContextViewModel;
  accuracyLabel: "M+%" | "ACC+";
  damageLabel: "DMG%" | "DMG+";
  derivedAccuracyPlaceholder: string;
  derivedDamagePlaceholder: string;
  derivedSpeedPlaceholder: string;
  playerProfile: PlayerProfileViewModel;
  setupGuide: readonly [SetupGuideRowViewModel, SetupGuideRowViewModel, SetupGuideRowViewModel];
}

export type SetupPersistenceKind = "saving" | "saved" | "session-only" | "failed";

export interface SetupPersistencePresentation {
  kind: SetupPersistenceKind;
  label: "Saving…" | "Saved locally" | "Session only" | "Could not save";
  description: string;
}

export type SetupEditorActionId =
  "create-monster" | "edit-monster" | "edit-default" | "remove-monster" | "reset-active";

export interface SetupEditorActionViewModel {
  id: SetupEditorActionId;
  label:
    | "Create monster setup"
    | "Edit monster setup"
    | "Edit default setup"
    | "Remove monster setup"
    | "Reset active setup";
  tone?: "danger";
}

export interface SetupEditorContextViewModel {
  mode: SetupMode;
  modeLabel: "Editing default" | "Editing custom";
  scopeDescription: string;
  compactScopeDescription: string;
  savedCustomDescription: string | null;
  actions: readonly SetupEditorActionViewModel[];
  persistence: SetupPersistencePresentation;
}

export interface PlayerProfileRowViewModel {
  label: string;
  value: string;
  tone?: "ready" | "warning" | "info";
}

export interface PlayerProfileViewModel {
  rows: PlayerProfileRowViewModel[];
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
      statusLabel: "Ready to load" | "Refresh required" | "No changes";
      targetLine: string;
      cannonLabel: "Cannon on" | "Cannon off";
      lootChoiceLabel: string;
      contextMessage: string;
      contextTone: "ready" | "warning";
      droppedLootWarning: string | null;
      stale: boolean;
      canLoad: boolean;
      changeReview: SetupTransferChangeReview;
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
  setupMode: SetupMode;
  hasCurrentCustomSetup: boolean;
  currentMonsterLabel: string;
  setupPersistenceKind: SetupPersistenceKind;
  weaponName: string;
  ammoName: string;
  spellName: string;
  styleName: string;
  effectiveAccuracy: number;
  effectiveDamage: number;
  derivedAccuracyBonus: number;
  derivedDamageBonus: number;
  derivedAttackSpeedSec: number;
  setupRequirementWarningCount: number;
  potionCarrySummary: string;
  prayerRestoreSourceSummary: string;
  lootPolicySummary: string;
}): AppShellSetupViewModel {
  const { form } = input;
  const editor = createSetupEditorContextViewModel({
    setupMode: input.setupMode,
    hasCurrentCustomSetup: input.hasCurrentCustomSetup,
    currentMonsterLabel: input.currentMonsterLabel,
    persistenceKind: input.setupPersistenceKind
  });
  const prayerSelection = setupSelectionSummary(form.prayers, PRAYER_SELECTION_OPTIONS);
  const boostSelection = setupSelectionSummary(form.boosts, BOOST_SELECTION_OPTIONS);
  const manualOverrideCount = Object.values(form.manualOverrides).filter(
    (value) => value !== null
  ).length;
  const secondaryLoadoutRow =
    form.combatStyle === "ranged"
      ? { label: "Ammo", value: input.ammoName }
      : form.combatStyle === "magic"
        ? { label: "Spell", value: input.spellName }
        : { label: "Stance", value: input.styleName.replace(/\s+\([^)]*\)$/, "") };
  const statusParts = [
    input.setupRequirementWarningCount > 0
      ? `${formatNumber(input.setupRequirementWarningCount)} requirement ${input.setupRequirementWarningCount === 1 ? "warning" : "warnings"}`
      : null,
    manualOverrideCount > 0
      ? `${formatNumber(manualOverrideCount)} manual ${manualOverrideCount === 1 ? "override" : "overrides"}`
      : null
  ].filter((part): part is string => part !== null);

  return {
    primarySkill: primaryLevelKey(form.combatStyle),
    primaryLevelLabel: primaryLevelShortLabel(form.combatStyle),
    primaryPrayer: primaryPrayerValue(form.prayers),
    primaryBoost: primaryBoostValue(form.boosts),
    extraPrayerCount: extraPrayerSelectionCount(form.prayers),
    extraBoostCount: extraBoostSelectionCount(form.boosts),
    prayerSelectionSummary: prayerSelection,
    boostSelectionSummary: boostSelection,
    editor,
    accuracyLabel: form.combatStyle === "magic" ? "M+%" : "ACC+",
    damageLabel: form.combatStyle === "magic" ? "DMG%" : "DMG+",
    derivedAccuracyPlaceholder: formatSignedInteger(input.derivedAccuracyBonus),
    derivedDamagePlaceholder: formatSignedInteger(input.derivedDamageBonus),
    derivedSpeedPlaceholder: formatNumber(input.derivedAttackSpeedSec, 1),
    playerProfile: {
      rows: [
        { label: "Weapon", value: input.weaponName },
        secondaryLoadoutRow,
        {
          label: "Attack speed",
          value: `${formatNumber(input.derivedAttackSpeedSec, 1)} s`
        },
        {
          label: "Effective levels",
          value: `ACC ${formatNumber(input.effectiveAccuracy)} · DMG ${formatNumber(input.effectiveDamage)}`
        },
        { label: "Prayers", value: prayerSelection },
        { label: "Boosts", value: boostSelection },
        {
          label: "Status",
          value: statusParts.length > 0 ? statusParts.join(" · ") : "Requirements met",
          tone:
            input.setupRequirementWarningCount > 0
              ? "warning"
              : manualOverrideCount > 0
                ? "info"
                : "ready"
        }
      ]
    },
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

export function createSetupEditorContextViewModel(input: {
  setupMode: SetupMode;
  hasCurrentCustomSetup: boolean;
  currentMonsterLabel: string;
  persistenceKind: SetupPersistenceKind;
}): SetupEditorContextViewModel {
  const mode: SetupMode =
    input.setupMode === "custom" && input.hasCurrentCustomSetup ? "custom" : "default";
  const actions: SetupEditorActionViewModel[] =
    mode === "custom"
      ? [
          { id: "edit-default", label: "Edit default setup" },
          { id: "remove-monster", label: "Remove monster setup", tone: "danger" },
          { id: "reset-active", label: "Reset active setup" }
        ]
      : input.hasCurrentCustomSetup
        ? [
            { id: "edit-monster", label: "Edit monster setup" },
            { id: "remove-monster", label: "Remove monster setup", tone: "danger" },
            { id: "reset-active", label: "Reset active setup" }
          ]
        : [
            { id: "create-monster", label: "Create monster setup" },
            { id: "reset-active", label: "Reset active setup" }
          ];

  return {
    mode,
    modeLabel: mode === "custom" ? "Editing custom" : "Editing default",
    scopeDescription:
      "Default applies to monsters without their own setup. A custom setup applies only to the current monster.",
    compactScopeDescription:
      "Default: monsters without their own setup. Custom: current monster only.",
    savedCustomDescription:
      mode === "default" && input.hasCurrentCustomSetup
        ? `Custom setup saved for ${input.currentMonsterLabel}.`
        : null,
    actions,
    persistence: setupPersistencePresentation(input.persistenceKind)
  };
}

function setupPersistencePresentation(kind: SetupPersistenceKind): SetupPersistencePresentation {
  if (kind === "saved") {
    return {
      kind,
      label: "Saved locally",
      description: "Changes save automatically in this browser."
    };
  }
  if (kind === "session-only") {
    return {
      kind,
      label: "Session only",
      description: "Changes are kept for this session and may be lost after reload."
    };
  }
  if (kind === "failed") {
    return {
      kind,
      label: "Could not save",
      description: "The latest setup change could not be written to browser storage."
    };
  }
  return {
    kind,
    label: "Saving…",
    description: "The latest setup change is being saved in this browser."
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
  changeReview: SetupTransferChangeReview | null;
  stale: boolean;
}): SharedSetupReviewViewModel {
  if (input.inspection.status === "error") {
    return {
      status: "error",
      tone: "error",
      statusLabel: "Invalid",
      message: input.inspection.message
    };
  }

  if (!input.changeReview) {
    return {
      status: "error",
      tone: "error",
      statusLabel: "Invalid",
      message: "Shared setup comparison could not be prepared."
    };
  }

  const { review } = input.inspection;
  const { data } = review.envelope;
  const droppedLootCount = review.droppedLootRowCount;
  return {
    status: "ready",
    tone: review.context.tone === "warning" || droppedLootCount > 0 ? "warning" : "ready",
    statusLabel: input.stale
      ? "Refresh required"
      : input.changeReview.changeCount === 0
        ? "No changes"
        : "Ready to load",
    targetLine: `${input.monsters[data.form.monsterId]?.name ?? data.form.monsterId} · ${data.form.combatStyle}`,
    cannonLabel: data.cannon.enabled ? "Cannon on" : "Cannon off",
    lootChoiceLabel: `${formatNumber(Object.keys(data.lootPreferences).length)} loot choices`,
    contextMessage: review.context.message,
    contextTone: review.context.tone,
    droppedLootWarning:
      droppedLootCount > 0
        ? `${formatNumber(droppedLootCount)} stale loot choices will be skipped.`
        : null,
    stale: input.stale,
    canLoad: !input.stale && input.changeReview.changeCount > 0,
    changeReview: input.changeReview
  };
}

export function createWorkbenchResultViewModel(input: {
  effectiveDps: number;
  maxHit: number;
  hitChance: number;
  ttkSec: number;
  effectiveKph: number;
  effectiveXpPerHour: number;
  effectiveGpPerHour: number;
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
    contextMetrics: [
      { label: "DPS", value: formatNumber(input.effectiveDps, 2), tone: "teal" },
      {
        label: "EFF. XP/HR",
        value: formatNumber(input.effectiveXpPerHour),
        tone: "teal"
      },
      {
        label: "EFF. NET GP/HR",
        value: formatNumber(input.effectiveNetGpPerHour),
        tone: "gold"
      }
    ],
    metrics: [
      { label: "DPS", value: formatNumber(input.effectiveDps, 2), tone: "teal" },
      { label: "MAX HIT", value: formatNumber(input.maxHit, 1) },
      { label: "HIT %", value: `${formatNumber(input.hitChance * 100, 1)}%` },
      {
        label: "TTK",
        value: formatDuration(input.ttkSec),
        detail: risk ? `P10/50/90 ${formatRiskRange(risk.killTimeSeconds, 1, " s")}` : undefined,
        reviewTarget: risk ? "risk" : undefined
      },
      {
        label: "EFF. K/HR",
        value: formatNumber(input.effectiveKph)
      },
      {
        label: "EFF. XP/HR",
        value: formatNumber(input.effectiveXpPerHour),
        tone: "teal"
      },
      {
        label: "EFF. GP/HR",
        value: formatNumber(input.effectiveGpPerHour)
      },
      {
        label: "EFF. NET GP/HR",
        value: formatNumber(input.effectiveNetGpPerHour),
        tone: "gold",
        detail: risk
          ? `${formatNumber(risk.horizonMinutes)} min P10/50/90 ${formatRiskRange(
              risk.timedNetGp,
              0,
              " GP"
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

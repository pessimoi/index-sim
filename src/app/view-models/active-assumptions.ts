import type { SimulationContext, SimulationRequest, SimulationWarning } from "@/domain/shared";
import type { LootAction, TripLootSupplyResult } from "@/domain/trip";
import { lootSettingsForMonster, type LootSettingsByMonsterState } from "../state/loot-settings";
import {
  DEFAULT_FORM_STATE,
  type CannonByMonsterState,
  type CombatSetupFormState,
  type SetupMode
} from "../state/ui-state";
import type { CalculationWarningViewModel } from "./contracts";
import { formatNumber } from "./formatting";

const LOOT_ACTION_ORDER: LootAction[] = ["loot", "skip", "bury", "alch", "unid", "value"];

export type ActiveAssumptionCategory = "warning" | "setup" | "loot" | "trip" | "settings";

export type ActiveAssumptionReviewTarget =
  | "stats"
  | "melee"
  | "ranged"
  | "magic"
  | "compare"
  | "loot"
  | "trip"
  | "cannon"
  | "economy"
  | "settings";

export type ActiveAssumptionResetTarget =
  | "manual-combat-overrides"
  | "cannon-enabled"
  | "loot-settings"
  | "loot-action-overrides"
  | "scarce-spot"
  | "explicit-safespot"
  | "hidden-gear-tiers";

export interface ActiveAssumptionResetActionViewModel {
  target: ActiveAssumptionResetTarget;
  label: string;
  ariaLabel: string;
  statusLabel: string;
}

export interface ActiveAssumptionRowViewModel {
  id: string;
  category: ActiveAssumptionCategory;
  label: string;
  value: string;
  detail: string;
  reviewTab: ActiveAssumptionReviewTarget;
  tone: "default" | "info" | "warning";
  priority: number;
  resetAction?: ActiveAssumptionResetActionViewModel;
}

export interface ActiveAssumptionsSummaryViewModel {
  statusLabel: string;
  totalCount: number;
  hasActiveRows: boolean;
  visibleRows: ActiveAssumptionRowViewModel[];
  hiddenRows: ActiveAssumptionRowViewModel[];
  hiddenCount: number;
}

export interface ActiveAssumptionsViewModelOptions {
  setupMode?: SetupMode;
  hasCustomSetup?: boolean;
  hiddenGearTierCount?: number;
}

interface ActiveAssumptionSetupRequirementSummary {
  hasWarnings: boolean;
  warningCount: number;
  warnings: readonly { message: string }[];
}

const MONEY_WARNING_CODES = new Set([
  "missing-price",
  "missing-alch-value",
  "price-alias-used",
  "price-fallback-used",
  "price-generated-fallback",
  "price-market-retained",
  "price-freshness-unknown",
  "approximate-data-source",
  "unidentified-herb-price-approximation"
]);
const SPECIAL_WARNING_CODES = new Set(["dragon-halberd-npc-size-fallback"]);

export function isMoneyWarningCode(code: string): boolean {
  return MONEY_WARNING_CODES.has(code);
}

export function isSpecialWarningCode(code: string): boolean {
  return SPECIAL_WARNING_CODES.has(code);
}
const ACTIVE_ASSUMPTIONS_VISIBLE_LIMIT = 5;
const PROTECT_PRAYER_LABELS: Record<
  Exclude<CombatSetupFormState["trip"]["protect"], "none">,
  string
> = {
  melee: "Protect from melee",
  missiles: "Protect from missiles",
  magic: "Protect from magic"
};

function warningViewModel(warning: SimulationWarning): CalculationWarningViewModel {
  return {
    code: warning.code,
    severity: warning.severity,
    message: warning.message.replace(/\s+/g, " ").slice(0, 240)
  };
}

export function calculationWarningViewModels(
  warnings: readonly SimulationWarning[]
): CalculationWarningViewModel[] {
  const seen = new Set<string>();
  const out: CalculationWarningViewModel[] = [];

  for (const warning of warnings) {
    const item = warningViewModel(warning);
    const key = `${item.code}:${item.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function activeAssumptionCountLabel(count: number, noun: string): string {
  return `${formatNumber(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function activeAssumptionSourceLabel(source: SimulationContext["priceSet"]["source"]): string {
  if (source === "scraped") return "Synced";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function activeAssumptionSigned(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value, Number.isInteger(value) ? 0 : 1)}`;
}

function activeAssumptionManualOverrideParts(
  overrides: CombatSetupFormState["manualOverrides"]
): string[] {
  const parts: string[] = [];
  if (overrides.accuracyBonus != null) {
    parts.push(`accuracy ${activeAssumptionSigned(overrides.accuracyBonus)}`);
  }
  if (overrides.damageBonus != null) {
    parts.push(`damage ${activeAssumptionSigned(overrides.damageBonus)}`);
  }
  if (overrides.attackSpeedSec != null) {
    parts.push(`speed ${formatNumber(overrides.attackSpeedSec, 1)}s`);
  }
  return parts;
}

function activeAssumptionLootSettingParts(
  form: CombatSetupFormState,
  settings: ReturnType<typeof lootSettingsForMonster>,
  rawSettings: LootSettingsByMonsterState[string] | undefined
): string[] {
  const parts: string[] = [];
  if (rawSettings?.highAlch != null) {
    parts.push(`high alch ${rawSettings.highAlch ? "on" : "off"}`);
  } else if (form.trip.alching) {
    parts.push("high alch on");
  }
  if (rawSettings?.overheadSec != null)
    parts.push(`overhead ${formatNumber(settings.overheadSec ?? 0, 1)}s`);
  if (rawSettings?.talismanSpot === "overground") parts.push("talisman overground");
  return parts;
}

function activeAssumptionTripManualParts(form: CombatSetupFormState): string[] {
  const parts: string[] = [];
  if (form.trip.bankSeconds != null) parts.push(`bank ${formatNumber(form.trip.bankSeconds)}s`);
  if (form.trip.foodCount != null) parts.push(`food ${formatNumber(form.trip.foodCount)}`);
  if (form.trip.foodPerKillOverride != null) {
    parts.push(`food/kill ${formatNumber(form.trip.foodPerKillOverride, 2)}`);
  }
  if (form.trip.prayerMode === "potions") {
    if (form.trip.prayerPotionDoses != null) {
      parts.push(`prayer ${formatNumber(form.trip.prayerPotionDoses)} doses`);
    } else if (form.trip.prayerPotionSets != null) {
      parts.push(`prayer ${formatNumber(form.trip.prayerPotionSets)} vials`);
    }
  } else if (form.trip.prayerMode === "altar" && form.trip.altarSeconds != null) {
    parts.push(`altar ${formatNumber(form.trip.altarSeconds)}s`);
  }
  return parts;
}

function activeAssumptionSupplyParts(form: CombatSetupFormState): string[] {
  const defaults = DEFAULT_FORM_STATE.trip;
  const parts: string[] = [];
  if (form.trip.potionSets !== defaults.potionSets) {
    parts.push(`boost vials ${formatNumber(form.trip.potionSets)}`);
  }
  if (form.trip.potionDoses !== defaults.potionDoses) {
    parts.push(`boost doses ${formatNumber(form.trip.potionDoses)}`);
  }
  if (form.trip.singleDose !== defaults.singleDose) {
    parts.push(form.trip.singleDose ? "single-dose boosts" : "vial boosts");
  }
  if (form.trip.dbaRestore !== defaults.dbaRestore) {
    parts.push(form.trip.dbaRestore ? "DBA restore on" : "DBA restore off");
  }
  if (form.trip.antifire !== defaults.antifire)
    parts.push(`antifire ${form.trip.antifire ? "on" : "off"}`);
  if (form.trip.antipoison !== defaults.antipoison) {
    parts.push(`antipoison ${form.trip.antipoison ? "on" : "off"}`);
  }
  if (form.trip.recoilRings !== defaults.recoilRings) {
    parts.push(`recoil rings ${formatNumber(form.trip.recoilRings)}`);
  }
  if (form.combatStyle === "magic" && form.trip.runeSlots !== defaults.runeSlots) {
    parts.push(`rune slots ${formatNumber(form.trip.runeSlots)}`);
  }
  return parts;
}

function activeAssumptionValidLootOverrideCount(
  lootPrefs: Record<string, LootAction | string | undefined>,
  effectiveOverrideCount: number
): number {
  if (effectiveOverrideCount > 0) return effectiveOverrideCount;
  return Object.values(lootPrefs).filter((value) => LOOT_ACTION_ORDER.includes(value as LootAction))
    .length;
}

export function createActiveAssumptionsSummaryViewModel(input: {
  form: CombatSetupFormState;
  request: SimulationRequest;
  context: SimulationContext;
  trip: TripLootSupplyResult;
  cannonByMonster: CannonByMonsterState;
  lootPrefs: Record<string, LootAction | string | undefined>;
  lootSettingsByMonster: LootSettingsByMonsterState;
  lootOverrideCount: number;
  setupRequirements: ActiveAssumptionSetupRequirementSummary;
  specialWarnings: readonly CalculationWarningViewModel[];
  moneyWarnings: readonly CalculationWarningViewModel[];
  options?: ActiveAssumptionsViewModelOptions;
}): ActiveAssumptionsSummaryViewModel {
  const rows: ActiveAssumptionRowViewModel[] = [];
  const monsterName =
    input.context.gameData.monsters[input.request.monsterId]?.name ?? input.request.monsterId;
  const combatReviewTab = input.request.combatStyle;

  if (input.moneyWarnings.length > 0) {
    rows.push({
      id: "price-warnings",
      category: "warning",
      label: "Price confidence",
      value: activeAssumptionCountLabel(input.moneyWarnings.length, "warning"),
      detail: input.moneyWarnings[0]?.message ?? "Price warnings affect this result.",
      reviewTab: "economy",
      tone: "warning",
      priority: 10
    });
  }

  if (input.specialWarnings.length > 0) {
    rows.push({
      id: "special-warnings",
      category: "warning",
      label: "Special attack assumption",
      value: activeAssumptionCountLabel(input.specialWarnings.length, "warning"),
      detail: input.specialWarnings[0]?.message ?? "Special attack assumptions affect this result.",
      reviewTab: combatReviewTab,
      tone: "warning",
      priority: 11
    });
  }

  if (input.setupRequirements.hasWarnings) {
    rows.push({
      id: "setup-requirements",
      category: "warning",
      label: "Setup requirements",
      value: activeAssumptionCountLabel(input.setupRequirements.warningCount, "warning"),
      detail:
        input.setupRequirements.warnings[0]?.message ?? "Requirement checks flag this loadout.",
      reviewTab: combatReviewTab,
      tone: "warning",
      priority: 12
    });
  }

  if (input.options?.setupMode === "custom" && input.options.hasCustomSetup === true) {
    rows.push({
      id: "custom-setup",
      category: "setup",
      label: "Custom setup",
      value: monsterName,
      detail: "Monster-specific setup snapshot is active for this result.",
      reviewTab: combatReviewTab,
      tone: "info",
      priority: 20
    });
  }

  const currentCannon = input.cannonByMonster[input.request.monsterId];
  if (currentCannon?.enabled === true) {
    const output = input.trip.cannon;
    const respawn = currentCannon.respawnSec ?? output?.respawnSec ?? null;
    rows.push({
      id: "cannon-enabled",
      category: "setup",
      label: "Cannon",
      value: output?.idle ? "Enabled, idle" : "Enabled",
      detail: [
        `targets ${formatNumber(currentCannon.targets ?? 3)}`,
        respawn != null ? `respawn ${formatNumber(respawn)}s` : null
      ]
        .filter(Boolean)
        .join(", "),
      reviewTab: "cannon",
      tone: output?.idle ? "warning" : "info",
      priority: 21,
      resetAction: {
        target: "cannon-enabled",
        label: "Reset",
        ariaLabel: "Reset current monster cannon",
        statusLabel: "Current monster cannon reset"
      }
    });
  }

  const manualOverrideParts = activeAssumptionManualOverrideParts(input.form.manualOverrides);
  if (manualOverrideParts.length > 0) {
    rows.push({
      id: "manual-combat-overrides",
      category: "setup",
      label: "Manual combat overrides",
      value: activeAssumptionCountLabel(manualOverrideParts.length, "field"),
      detail: manualOverrideParts.join(", "),
      reviewTab: combatReviewTab,
      tone: "info",
      priority: 22,
      resetAction: {
        target: "manual-combat-overrides",
        label: "Reset",
        ariaLabel: "Reset manual combat overrides",
        statusLabel: "Manual overrides reset"
      }
    });
  }

  if (input.context.priceSet.source !== "bundled") {
    rows.push({
      id: "active-price-set",
      category: "loot",
      label: "Active PriceSet",
      value: activeAssumptionSourceLabel(input.context.priceSet.source),
      detail: input.context.priceSet.label,
      reviewTab: "economy",
      tone: "info",
      priority: 40
    });
  }

  const rawLootSettings = input.lootSettingsByMonster[input.request.monsterId];
  const lootSettings = lootSettingsForMonster(input.lootSettingsByMonster, input.request.monsterId);
  const lootSettingParts = activeAssumptionLootSettingParts(
    input.form,
    lootSettings,
    rawLootSettings
  );
  if (lootSettingParts.length > 0) {
    rows.push({
      id: "loot-settings",
      category: "loot",
      label: "Loot settings",
      value: activeAssumptionCountLabel(lootSettingParts.length, "modifier"),
      detail: lootSettingParts.join(", "),
      reviewTab: "loot",
      tone: "info",
      priority: 41,
      resetAction:
        rawLootSettings == null
          ? undefined
          : {
              target: "loot-settings",
              label: "Reset",
              ariaLabel: "Reset current monster loot settings",
              statusLabel: "Current monster loot settings reset"
            }
    });
  }

  const lootOverrideCount = activeAssumptionValidLootOverrideCount(
    input.lootPrefs,
    input.lootOverrideCount
  );
  if (lootOverrideCount > 0) {
    rows.push({
      id: "loot-action-overrides",
      category: "loot",
      label: "Loot action overrides",
      value: activeAssumptionCountLabel(lootOverrideCount, "drop"),
      detail: "Current monster drop actions differ from canonical defaults.",
      reviewTab: "loot",
      tone: "info",
      priority: 42,
      resetAction: {
        target: "loot-action-overrides",
        label: "Reset",
        ariaLabel: "Reset current monster loot overrides",
        statusLabel: "Current monster loot overrides reset"
      }
    });
  }

  if (input.form.trip.scarceSpot) {
    rows.push({
      id: "scarce-spot",
      category: "trip",
      label: "Scarce spot",
      value: "On",
      detail: [
        `targets ${formatNumber(input.form.trip.targetsAtSpot ?? input.trip.trip.scarce.targetsAtSpot)}`,
        `respawn ${formatNumber(input.form.trip.respawnSeconds ?? input.trip.trip.scarce.respawnSeconds)}s`
      ].join(", "),
      reviewTab: "trip",
      tone: "info",
      priority: 60,
      resetAction: {
        target: "scarce-spot",
        label: "Reset",
        ariaLabel: "Reset scarce spot",
        statusLabel: "Scarce spot disabled; target and respawn values kept"
      }
    });
  }

  if (input.form.trip.safespot != null) {
    rows.push({
      id: "explicit-safespot",
      category: "trip",
      label: "Safespot override",
      value: input.form.trip.safespot ? "On" : "Off",
      detail: `Explicit safespot ${input.form.trip.safespot ? "on" : "off"}; auto detection is bypassed.`,
      reviewTab: "trip",
      tone: "info",
      priority: 61,
      resetAction: {
        target: "explicit-safespot",
        label: "Reset",
        ariaLabel: "Reset safespot override",
        statusLabel: "Safespot override reset to auto"
      }
    });
  }

  if (input.form.trip.protect !== "none") {
    rows.push({
      id: "protection-prayer",
      category: "trip",
      label: "Protection prayer",
      value: PROTECT_PRAYER_LABELS[input.form.trip.protect],
      detail: "Incoming damage uses the selected protection prayer.",
      reviewTab: "trip",
      tone: "info",
      priority: 62
    });
  }

  const tripManualParts = activeAssumptionTripManualParts(input.form);
  if (tripManualParts.length > 0) {
    rows.push({
      id: "manual-trip-controls",
      category: "trip",
      label: "Manual trip controls",
      value: activeAssumptionCountLabel(tripManualParts.length, "field"),
      detail: tripManualParts.join(", "),
      reviewTab: "trip",
      tone: "info",
      priority: 63
    });
  }

  const supplyParts = activeAssumptionSupplyParts(input.form);
  if (supplyParts.length > 0) {
    rows.push({
      id: "supply-settings",
      category: "settings",
      label: "Supply settings",
      value: activeAssumptionCountLabel(supplyParts.length, "modifier"),
      detail: supplyParts.join(", "),
      reviewTab: "trip",
      tone: "info",
      priority: 70
    });
  }

  const hiddenGearTierCount = input.options?.hiddenGearTierCount ?? 0;
  if (hiddenGearTierCount > 0) {
    rows.push({
      id: "hidden-gear-tiers",
      category: "settings",
      label: "Hidden gear tiers",
      value: activeAssumptionCountLabel(hiddenGearTierCount, "tier"),
      detail: "Gear candidate lists hide these tiers in setup controls.",
      reviewTab: "settings",
      tone: "info",
      priority: 80,
      resetAction: {
        target: "hidden-gear-tiers",
        label: "Reset",
        ariaLabel: "Reset hidden gear tiers",
        statusLabel: "Hidden gear tiers shown"
      }
    });
  }

  rows.sort(
    (left, right) => left.priority - right.priority || left.label.localeCompare(right.label)
  );
  const visibleRows = rows.slice(0, ACTIVE_ASSUMPTIONS_VISIBLE_LIMIT);
  const hiddenRows = rows.slice(ACTIVE_ASSUMPTIONS_VISIBLE_LIMIT);
  return {
    statusLabel:
      rows.length === 0
        ? "Default assumptions active"
        : `${activeAssumptionCountLabel(rows.length, "active modifier")}`,
    totalCount: rows.length,
    hasActiveRows: rows.length > 0,
    visibleRows,
    hiddenRows,
    hiddenCount: hiddenRows.length
  };
}

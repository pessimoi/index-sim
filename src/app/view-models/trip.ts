import { FOOD, type TripLootSupplyResult } from "@/domain/trip";
import type { CombatSetupFormState } from "../state/ui-state";
import { formatNumber } from "./formatting";

export interface TripSelectOption {
  id: string;
  label: string;
  hint?: string;
}

export interface TripDisplayMetric {
  label: string;
  value: string;
  tone?: string;
}

export interface TripControlPresentation {
  trip: CombatSetupFormState["trip"];
  bankTimeMode: "auto" | "manual";
  bankSecondsValue: number;
  foodCountMode: "auto" | "manual";
  foodCountValue: number;
  foodPerKillOverrideMode: "off" | "on";
  foodPerKillOverrideValue: number;
  prayerRestoreMode: "auto" | "manual_vials" | "manual_doses";
  prayerVialsValue: number;
  prayerDosesValue: number;
  prayerRestoreValue: number;
  altarTimeMode: "auto" | "manual";
  altarSecondsValue: number;
  scarceTargetsValue: number;
  scarceRespawnValue: number;
  recoverAmmoApplies: boolean;
  dbaSpecActive: boolean;
  runeSlotsApplies: boolean;
  recoilRingEquipped: boolean;
}

export interface TripRecommendationPresentation {
  statusLabel: string;
  className: "needs-apply" | "matched" | "inactive";
  carryLabel: string;
  intervalLabel: string;
  tripLabel: string;
  reason: string;
  warnings: string[];
  canApply: boolean;
  patch: Partial<CombatSetupFormState["trip"]>;
}

export interface TripPaneViewModel {
  controls: TripControlPresentation;
  recommendation: TripRecommendationPresentation;
  groups: Array<{ title: string; items: TripDisplayMetric[] }>;
  status: string;
  potionCarrySummary: string;
  prayerRestoreSourceSummary: string;
  supplyGapPerKill: number;
  supplyCostsExceedLoot: boolean;
}

export const TRIP_FOOD_OPTIONS: TripSelectOption[] = Object.entries(FOOD).map(([id, food]) => ({
  id,
  label: food.name,
  hint: food.heal > 0 ? `heals ${food.heal}` : "no carried food"
}));

export const TRIP_BANK_TIME_MODE_OPTIONS: TripSelectOption[] = [
  { id: "auto", label: "Auto" },
  { id: "manual", label: "Manual" }
];

export const TRIP_SAFESPOT_OPTIONS: TripSelectOption[] = [
  { id: "auto", label: "Auto" },
  { id: "on", label: "On" },
  { id: "off", label: "Off" }
];

export const TRIP_PROTECT_OPTIONS: TripSelectOption[] = [
  { id: "none", label: "None" },
  { id: "melee", label: "Melee" },
  { id: "missiles", label: "Missiles" },
  { id: "magic", label: "Magic" }
];

export const TRIP_PRAYER_MODE_OPTIONS: TripSelectOption[] = [
  { id: "potions", label: "Potions" },
  { id: "altar", label: "Altar" },
  { id: "none", label: "None" }
];

export const TRIP_PRAYER_RESTORE_MODE_OPTIONS: TripSelectOption[] = [
  { id: "auto", label: "Auto" },
  { id: "manual_vials", label: "Manual vials" },
  { id: "manual_doses", label: "Manual doses" }
];

export const TRIP_ALTAR_TIME_MODE_OPTIONS: TripSelectOption[] = [
  { id: "auto", label: "Auto" },
  { id: "manual", label: "Manual" }
];

export const TRIP_FOOD_COUNT_MODE_OPTIONS: TripSelectOption[] = [
  { id: "auto", label: "Auto" },
  { id: "manual", label: "Manual" }
];

export const TRIP_FOOD_PER_KILL_OVERRIDE_OPTIONS: TripSelectOption[] = [
  { id: "off", label: "Off" },
  { id: "on", label: "On" }
];

function optionLabel(options: readonly TripSelectOption[], value: string): string {
  return options.find((option) => option.id === value)?.label ?? value;
}

function finiteMetric(value: number, digits = 1): string {
  return Number.isFinite(value) ? formatNumber(value, digits) : "-";
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function tripSafespotControlValue(value: boolean | null): "auto" | "on" | "off" {
  if (value === true) return "on";
  if (value === false) return "off";
  return "auto";
}

export function tripSafespotFromControl(value: string): boolean | null {
  if (value === "on") return true;
  if (value === "off") return false;
  return null;
}

export function createTripPaneViewModel(input: {
  form: Pick<CombatSetupFormState, "combatStyle" | "gear" | "prayers" | "boosts" | "trip">;
  result: TripLootSupplyResult;
}): TripPaneViewModel {
  const { form, result } = input;
  const trip = result.trip;
  const policy = form.trip;
  const incoming = trip.incoming;
  const foodSummary = optionLabel(TRIP_FOOD_OPTIONS, policy.foodKey);
  const bankTimeMode = policy.bankSeconds == null ? "auto" : "manual";
  const bankSecondsValue = policy.bankSeconds ?? Math.max(0, Math.round(trip.bankSeconds));
  const bankTimeSummary =
    policy.bankSeconds == null
      ? `Auto ${formatNumber(trip.bankSeconds)} s`
      : `Manual ${formatNumber(policy.bankSeconds)} s`;
  const recoverAmmoApplies = form.combatStyle === "ranged";
  const recoverAmmoSummary = recoverAmmoApplies ? yesNo(policy.recoverAmmo) : "Ranged only";
  const dbaSpecActive = form.combatStyle === "melee" && form.boosts.includes("dba_spec");
  const dbaRestoreSummary = dbaSpecActive ? yesNo(policy.dbaRestore) : "-";
  const runeSlotsApplies = form.combatStyle === "magic";
  const runeSlotsSummary = runeSlotsApplies ? formatNumber(policy.runeSlots) : "Magic only";
  const foodCountMode = policy.foodCount == null ? "auto" : "manual";
  const foodCountValue = policy.foodCount ?? Math.max(0, Math.round(trip.slots.autoFoodCount));
  const foodCountSummary =
    policy.foodCount == null
      ? `Auto ${formatNumber(trip.slots.autoFoodCount)}`
      : `Manual ${formatNumber(policy.foodCount)}`;
  const foodPerKillOverrideMode = policy.foodPerKillOverride == null ? "off" : "on";
  const foodPerKillOverrideValue =
    policy.foodPerKillOverride ?? Number(trip.foodPerKill.toFixed(2));
  const prayerRestoreMode =
    policy.prayerPotionDoses != null
      ? "manual_doses"
      : policy.prayerPotionSets != null
        ? "manual_vials"
        : "auto";
  const prayerVialsValue =
    policy.prayerPotionSets ?? Math.max(0, Math.min(28, Math.round(trip.prayerSlots || 1)));
  const prayerDosesValue =
    policy.prayerPotionDoses ??
    Math.max(0, Math.min(112, Math.round(trip.prayerSlots > 0 ? trip.prayerSlots * 4 : 4)));
  const prayerRestoreValue =
    prayerRestoreMode === "manual_doses" ? prayerDosesValue : prayerVialsValue;
  const altarTimeMode = policy.altarSeconds == null ? "auto" : "manual";
  const altarSecondsValue = policy.altarSeconds ?? Math.max(0, Math.round(trip.altarSeconds));
  const scarceTargetsValue = policy.targetsAtSpot ?? Math.max(1, trip.scarce.targetsAtSpot);
  const scarceRespawnValue = policy.respawnSeconds ?? Math.max(1, trip.scarce.respawnSeconds);
  const recoilRingEquipped = form.gear.ring === "ring_of_recoil";
  const safespotSummary =
    policy.safespot == null
      ? incoming.safespot
        ? "Auto on"
        : "Auto off"
      : incoming.safespot
        ? "On"
        : "Off";
  const prayerRestoreSummary =
    policy.prayerMode === "potions"
      ? policy.prayerPotionDoses != null
        ? `Manual ${formatNumber(policy.prayerPotionDoses)} doses`
        : policy.prayerPotionSets != null
          ? `Manual ${formatNumber(policy.prayerPotionSets)} vials`
          : `Auto ${formatNumber(trip.prayerSlots)} vials`
      : policy.prayerMode === "altar"
        ? `${optionLabel(TRIP_ALTAR_TIME_MODE_OPTIONS, altarTimeMode)} altar`
        : "No restore";
  const prayerCarriedSummary =
    policy.prayerMode !== "potions" || !trip.prayerActive
      ? "-"
      : policy.prayerPotionDoses != null
        ? `${formatNumber(policy.prayerPotionDoses)} doses`
        : policy.prayerPotionSets != null
          ? `${formatNumber(policy.prayerPotionSets)} vials`
          : `Auto ${formatNumber(trip.prayerSlots)} vials`;
  const scarceStatus = !policy.scarceSpot
    ? "Off"
    : trip.scarce.respawnBound
      ? "Respawn-bound"
      : "Not bound";
  const status = trip.scarce.respawnBound ? "respawn-bound" : trip.bound;
  const reservePartsSummary = trip.slots.reserveParts.length
    ? trip.slots.reserveParts.join(", ")
    : "-";
  const potionPartsSummary = trip.slots.potionParts.length
    ? trip.slots.potionParts.join(", ")
    : "-";
  const potionCarrySummary = policy.singleDose
    ? `${formatNumber(policy.potionDoses)} doses/type`
    : `${formatNumber(policy.potionSets)} vials/type`;
  const prayerRestoreSourceSummary =
    form.prayers.length === 0
      ? "No active prayer"
      : policy.prayerMode === "potions"
        ? "Prayer potions"
        : policy.prayerMode === "altar"
          ? "Altar"
          : "No restore";
  const supplyGapPerKill = result.supply.supplyCostPerKill - result.gpPerKill;
  const supplyCostsExceedLoot = result.effectiveNetGpPerHour < 0 && supplyGapPerKill > 0;
  const recommendation = result.potionRecommendation;
  const recommendationStatus =
    recommendation.status === "matched"
      ? "Matches recommendation"
      : recommendation.status === "under"
        ? "Below recommendation"
        : recommendation.status === "over"
          ? "Above recommendation"
          : recommendation.status === "no-boost"
            ? "No combat boost selected"
            : recommendation.status === "manual"
              ? "Manual carry"
              : "Inactive";
  const recommendationClass = recommendation.canApply
    ? "needs-apply"
    : recommendation.matched
      ? "matched"
      : "inactive";
  const recommendationCarry = !recommendation.active
    ? "-"
    : policy.singleDose
      ? `${formatNumber(recommendation.recommendedDoses)} doses/type`
      : `${formatNumber(recommendation.recommendedVials)} vials/type`;
  const recommendationTrip =
    recommendation.tripMinutes == null ? "-" : `${formatNumber(recommendation.tripMinutes, 1)} min`;
  const recommendationInterval =
    recommendation.repotIntervalMinutes == null
      ? "-"
      : `${formatNumber(recommendation.repotIntervalMinutes, 1)} min`;

  return {
    controls: {
      trip: policy,
      bankTimeMode,
      bankSecondsValue,
      foodCountMode,
      foodCountValue,
      foodPerKillOverrideMode,
      foodPerKillOverrideValue,
      prayerRestoreMode,
      prayerVialsValue,
      prayerDosesValue,
      prayerRestoreValue,
      altarTimeMode,
      altarSecondsValue,
      scarceTargetsValue,
      scarceRespawnValue,
      recoverAmmoApplies,
      dbaSpecActive,
      runeSlotsApplies,
      recoilRingEquipped
    },
    recommendation: {
      statusLabel: recommendationStatus,
      className: recommendationClass,
      carryLabel: recommendationCarry,
      intervalLabel: recommendationInterval,
      tripLabel: recommendationTrip,
      reason: recommendation.reason,
      warnings: recommendation.warnings,
      canApply: recommendation.canApply,
      patch: policy.singleDose
        ? { potionDoses: recommendation.recommendedDoses }
        : { potionSets: recommendation.recommendedVials }
    },
    groups: [
      {
        title: "Survival",
        items: [
          { label: "Incoming model", value: incoming.descriptor.sourceLabel },
          { label: "Safespot", value: safespotSummary },
          { label: "Protection prayer", value: optionLabel(TRIP_PROTECT_OPTIONS, policy.protect) },
          { label: "Prayer block", value: yesNo(incoming.protected) },
          { label: "HP/kill", value: formatNumber(incoming.hpPerKill, 2) },
          { label: "Dragonfire", value: formatNumber(incoming.dragonfire, 2) },
          { label: "Poison", value: formatNumber(incoming.poison ?? 0, 2) },
          { label: "Antifire", value: yesNo(policy.antifire) },
          { label: "Antipoison", value: yesNo(policy.antipoison) }
        ]
      },
      {
        title: "Prayer",
        items: [
          { label: "Prayer mode", value: optionLabel(TRIP_PRAYER_MODE_OPTIONS, policy.prayerMode) },
          { label: "Prayer restore", value: prayerRestoreSummary },
          { label: "Prayer carried", value: prayerCarriedSummary },
          { label: "Prayer/kill", value: formatNumber(trip.prayerPerKill, 2) },
          { label: "Prayer slots", value: formatNumber(trip.prayerSlots) },
          { label: "Max kills prayer", value: finiteMetric(trip.maxKillsPrayer, 1) },
          {
            label: "Prayer dose",
            value: trip.prayerPointsPerDose ? formatNumber(trip.prayerPointsPerDose) : "-"
          },
          { label: "Altar sec", value: trip.altarOn ? formatNumber(trip.altarSeconds) : "-" },
          {
            label: "Altar/kill",
            value: trip.altarOn ? `${formatNumber(trip.altarSecPerKill, 2)} s` : "-"
          }
        ]
      },
      {
        title: "Food",
        items: [
          { label: "Food", value: foodSummary },
          { label: "Food count", value: foodCountSummary },
          { label: "Auto estimate", value: formatNumber(trip.slots.autoFoodCount) },
          { label: "Food left", value: formatNumber(trip.slots.foodLeftAtEnd, 1) },
          { label: "Food/kill", value: formatNumber(trip.foodPerKill, 2) }
        ]
      },
      {
        title: "Inventory reserve",
        items: [
          { label: "Teleport", value: policy.teleport ? "1 slot" : "Off" },
          { label: "Ammo recovery", value: recoverAmmoSummary },
          ...(dbaSpecActive ? [{ label: "DBA restore", value: dbaRestoreSummary }] : []),
          { label: "Rune slots", value: runeSlotsSummary },
          { label: "Reserve slots", value: formatNumber(trip.slots.reserve) },
          { label: "Reserve parts", value: reservePartsSummary },
          { label: "Loot capacity", value: formatNumber(trip.slots.lootCapacity) },
          { label: "Free at start", value: formatNumber(trip.slots.freeAtStart) }
        ]
      },
      {
        title: "Potions",
        items: [
          { label: "Potion carry", value: potionCarrySummary },
          { label: "Potion slots", value: formatNumber(trip.slots.potionSlots) },
          { label: "Potion parts", value: potionPartsSummary },
          { label: "Potion GP/trip", value: formatNumber(trip.potionCostPerTrip), tone: "gold" },
          { label: "Potion GP/kill", value: formatNumber(trip.potionCostPerKill), tone: "gold" }
        ]
      },
      {
        title: "Scarce cap",
        items: [
          { label: "Scarce spot", value: yesNo(policy.scarceSpot) },
          { label: "Scarce status", value: scarceStatus },
          {
            label: "Spot max kills/hr",
            value: policy.scarceSpot ? formatNumber(trip.scarce.maxKph) : "-"
          }
        ]
      },
      {
        title: "Recoil",
        items: [
          {
            label: "Recoil rings",
            value: recoilRingEquipped ? formatNumber(policy.recoilRings) : "No ring"
          },
          {
            label: "Recoil spares",
            value: trip.recoilOn ? formatNumber(trip.recoilSpares) : "-"
          },
          {
            label: "Recoil/kill",
            value: trip.recoilOn ? `${formatNumber(trip.recoilDmgPerKill, 1)} dmg` : "-"
          },
          {
            label: "Recoil GP/kill",
            value: trip.recoilOn ? formatNumber(trip.recoilCostPerKill) : "-",
            tone: "gold"
          }
        ]
      },
      {
        title: "Outcome",
        items: [
          { label: "Bank time", value: bankTimeSummary },
          { label: "Kills/trip", value: formatNumber(trip.killsPerTrip, 1) },
          {
            label: "Trip length",
            value: Number.isFinite(trip.tripMinutes)
              ? `${formatNumber(trip.tripMinutes, 1)} min`
              : "-"
          },
          { label: "Effective kills/hr", value: formatNumber(result.effectiveKph) },
          {
            label: "Supply/kill",
            value: formatNumber(result.supply.supplyCostPerKill),
            tone: "gold"
          },
          {
            label: "Ammo/kill",
            value: result.supply.ammoPerKill > 0 ? formatNumber(result.supply.ammoPerKill, 2) : "-"
          },
          {
            label: "Effective net GP/hr",
            value: formatNumber(result.effectiveNetGpPerHour),
            tone: "gold"
          }
        ]
      }
    ],
    status,
    potionCarrySummary,
    prayerRestoreSourceSummary,
    supplyGapPerKill,
    supplyCostsExceedLoot
  };
}

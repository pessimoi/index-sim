import type { Ref } from "react";
import type { CombatSetupFormState } from "../../state/ui-state";
import {
  TRIP_ALTAR_TIME_MODE_OPTIONS,
  TRIP_BANK_TIME_MODE_OPTIONS,
  TRIP_FOOD_COUNT_MODE_OPTIONS,
  TRIP_FOOD_OPTIONS,
  TRIP_FOOD_PER_KILL_OVERRIDE_OPTIONS,
  TRIP_PRAYER_MODE_OPTIONS,
  TRIP_PRAYER_RESTORE_MODE_OPTIONS,
  TRIP_PROTECT_OPTIONS,
  TRIP_SAFESPOT_OPTIONS,
  tripSafespotControlValue,
  tripSafespotFromControl,
  type TripPaneViewModel
} from "../../view-models/trip";
import { MetricList } from "../app-presenters";
import { DecimalField, NumberField, SearchableSelectField, SelectField } from "../form-fields";

export interface TripPaneModel {
  presentation: TripPaneViewModel;
  modeledKillsPerTripRange: string | null;
}

export interface TripPaneActions {
  updateTrip(patch: Partial<CombatSetupFormState["trip"]>): void;
  openRisk(): void;
}

export interface TripPaneProps {
  hidden: boolean;
  model: TripPaneModel;
  actions: TripPaneActions;
  foodPerKillOverrideRef?: Ref<HTMLSelectElement>;
}

function bounded(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function TripPane({ hidden, model, actions, foodPerKillOverrideRef }: TripPaneProps) {
  const { presentation, modeledKillsPerTripRange } = model;
  const { controls, recommendation } = presentation;
  const trip = controls.trip;

  return (
    <section className="trip-strip" aria-label="Trip assumptions" hidden={hidden}>
      <div className="section-title-row">
        <h2>Trip assumptions</h2>
        <div className="section-title-actions">
          {modeledKillsPerTripRange ? (
            <button type="button" onClick={actions.openRisk}>
              Risk ranges
            </button>
          ) : null}
          <span className="status-pill">{presentation.status}</span>
        </div>
      </div>
      <div className="trip-body">
        <SearchableSelectField
          label="Food"
          value={trip.foodKey}
          options={TRIP_FOOD_OPTIONS}
          searchPlaceholder="Search food"
          onChange={(foodKey) => actions.updateTrip({ foodKey })}
        />
        <SelectField
          label="Bank time"
          value={controls.bankTimeMode}
          options={TRIP_BANK_TIME_MODE_OPTIONS}
          onChange={(mode) =>
            actions.updateTrip({
              bankSeconds: mode === "manual" ? bounded(controls.bankSecondsValue, 0, 3600) : null
            })
          }
        />
        <NumberField
          label="Bank sec"
          value={controls.bankSecondsValue}
          min={0}
          max={3600}
          disabled={controls.bankTimeMode === "auto"}
          onChange={(bankSeconds) => actions.updateTrip({ bankSeconds })}
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={trip.singleDose}
            onChange={(event) => actions.updateTrip({ singleDose: event.target.checked })}
          />
          <span>Single-dose</span>
        </label>
        <NumberField
          label="Combat potion vials / type"
          value={trip.potionSets}
          min={0}
          max={28}
          disabled={trip.singleDose}
          onChange={(potionSets) => actions.updateTrip({ potionSets })}
        />
        <NumberField
          label="Combat potion doses / type"
          value={trip.potionDoses}
          min={0}
          max={112}
          disabled={!trip.singleDose}
          onChange={(potionDoses) => actions.updateTrip({ potionDoses })}
        />
        <div
          className={`potion-recommendation ${recommendation.className}`}
          aria-label="Potion recommendation"
          aria-live="polite"
        >
          <div className="potion-recommendation-header">
            <span>Potion recommendation</span>
            <strong>{recommendation.statusLabel}</strong>
          </div>
          <dl className="potion-recommendation-metrics">
            <div>
              <dt>Recommended carry</dt>
              <dd>{recommendation.carryLabel}</dd>
            </div>
            <div>
              <dt>Repot interval</dt>
              <dd>{recommendation.intervalLabel}</dd>
            </div>
            <div>
              <dt>Trip estimate</dt>
              <dd>{recommendation.tripLabel}</dd>
            </div>
          </dl>
          <p>{recommendation.reason}</p>
          {recommendation.warnings.map((warning) => (
            <p className="potion-recommendation-warning" key={warning}>
              {warning}
            </p>
          ))}
          <button
            type="button"
            className="potion-recommendation-apply"
            disabled={!recommendation.canApply}
            onClick={() => {
              if (recommendation.canApply) actions.updateTrip(recommendation.patch);
            }}
          >
            Apply recommendation
          </button>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={trip.teleport}
            onChange={(event) => actions.updateTrip({ teleport: event.target.checked })}
          />
          <span>Teleport item</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={controls.recoverAmmoApplies && trip.recoverAmmo}
            disabled={!controls.recoverAmmoApplies}
            onChange={(event) => actions.updateTrip({ recoverAmmo: event.target.checked })}
          />
          <span>Recover ammo</span>
        </label>
        {controls.dbaSpecActive && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={trip.dbaRestore}
              onChange={(event) => actions.updateTrip({ dbaRestore: event.target.checked })}
            />
            <span>DBA restore</span>
          </label>
        )}
        <NumberField
          label="Rune slots"
          value={trip.runeSlots}
          min={0}
          max={28}
          disabled={!controls.runeSlotsApplies}
          onChange={(runeSlots) => actions.updateTrip({ runeSlots })}
        />
        <SelectField
          label="Safespot"
          value={tripSafespotControlValue(trip.safespot)}
          options={TRIP_SAFESPOT_OPTIONS}
          onChange={(safespot) =>
            actions.updateTrip({ safespot: tripSafespotFromControl(safespot) })
          }
        />
        <SelectField
          label="Protect"
          value={trip.protect}
          options={TRIP_PROTECT_OPTIONS}
          onChange={(protect) =>
            actions.updateTrip({ protect: protect as CombatSetupFormState["trip"]["protect"] })
          }
        />
        <SelectField
          label="Prayer mode"
          value={trip.prayerMode}
          options={TRIP_PRAYER_MODE_OPTIONS}
          onChange={(prayerMode) => {
            const nextMode = prayerMode as CombatSetupFormState["trip"]["prayerMode"];
            actions.updateTrip({
              prayerMode: nextMode,
              prayerPotionSets: nextMode === "potions" ? trip.prayerPotionSets : null,
              prayerPotionDoses: nextMode === "potions" ? trip.prayerPotionDoses : null,
              altarSeconds: nextMode === "altar" ? trip.altarSeconds : null
            });
          }}
        />
        <SelectField
          label="Prayer restore"
          value={controls.prayerRestoreMode}
          options={TRIP_PRAYER_RESTORE_MODE_OPTIONS}
          disabled={trip.prayerMode !== "potions"}
          onChange={(mode) =>
            actions.updateTrip({
              prayerPotionSets:
                mode === "manual_vials" ? bounded(controls.prayerVialsValue, 0, 28) : null,
              prayerPotionDoses:
                mode === "manual_doses" ? bounded(controls.prayerDosesValue, 0, 112) : null
            })
          }
        />
        <NumberField
          label={controls.prayerRestoreMode === "manual_doses" ? "Prayer doses" : "Prayer vials"}
          value={controls.prayerRestoreValue}
          min={0}
          max={controls.prayerRestoreMode === "manual_doses" ? 112 : 28}
          disabled={trip.prayerMode !== "potions" || controls.prayerRestoreMode === "auto"}
          onChange={(value) =>
            actions.updateTrip({
              prayerPotionSets: controls.prayerRestoreMode === "manual_vials" ? value : null,
              prayerPotionDoses: controls.prayerRestoreMode === "manual_doses" ? value : null
            })
          }
        />
        <SelectField
          label="Altar time"
          value={controls.altarTimeMode}
          options={TRIP_ALTAR_TIME_MODE_OPTIONS}
          disabled={trip.prayerMode !== "altar"}
          onChange={(mode) =>
            actions.updateTrip({
              altarSeconds: mode === "manual" ? bounded(controls.altarSecondsValue, 0, 3600) : null
            })
          }
        />
        <NumberField
          label="Altar sec"
          value={controls.altarSecondsValue}
          min={0}
          max={3600}
          disabled={trip.prayerMode !== "altar" || controls.altarTimeMode === "auto"}
          onChange={(altarSeconds) => actions.updateTrip({ altarSeconds })}
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={trip.scarceSpot}
            onChange={(event) => actions.updateTrip({ scarceSpot: event.target.checked })}
          />
          <span>Scarce spot</span>
        </label>
        <NumberField
          label="Targets at spot"
          value={controls.scarceTargetsValue}
          min={1}
          max={64}
          disabled={!trip.scarceSpot}
          onChange={(targetsAtSpot) => actions.updateTrip({ targetsAtSpot })}
        />
        <NumberField
          label="Respawn (seconds)"
          value={controls.scarceRespawnValue}
          min={1}
          max={3600}
          disabled={!trip.scarceSpot}
          onChange={(respawnSeconds) => actions.updateTrip({ respawnSeconds })}
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={trip.antifire}
            onChange={(event) => actions.updateTrip({ antifire: event.target.checked })}
          />
          <span>Antifire</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={trip.antipoison}
            onChange={(event) => actions.updateTrip({ antipoison: event.target.checked })}
          />
          <span>Antipoison</span>
        </label>
        <SelectField
          label="Food mode"
          value={controls.foodCountMode}
          options={TRIP_FOOD_COUNT_MODE_OPTIONS}
          onChange={(mode) =>
            actions.updateTrip({
              foodCount: mode === "manual" ? bounded(controls.foodCountValue, 0, 28) : null
            })
          }
        />
        <NumberField
          label="Food count"
          value={controls.foodCountValue}
          min={0}
          max={28}
          disabled={controls.foodCountMode === "auto"}
          onChange={(foodCount) => actions.updateTrip({ foodCount })}
        />
        <SelectField
          label="F/KL override"
          accessibleLabel="Food per kill override"
          selectRef={foodPerKillOverrideRef}
          value={controls.foodPerKillOverrideMode}
          options={TRIP_FOOD_PER_KILL_OVERRIDE_OPTIONS}
          onChange={(mode) =>
            actions.updateTrip({
              foodPerKillOverride:
                mode === "on" ? Number(controls.foodPerKillOverrideValue.toFixed(2)) : null
            })
          }
        />
        <DecimalField
          label="Food/kill"
          value={controls.foodPerKillOverrideValue}
          min={0}
          max={999}
          step={0.05}
          disabled={controls.foodPerKillOverrideMode === "off"}
          onChange={(foodPerKillOverride) => actions.updateTrip({ foodPerKillOverride })}
        />
        <NumberField
          label="Recoil rings"
          value={trip.recoilRings}
          min={1}
          max={28}
          disabled={!controls.recoilRingEquipped}
          onChange={(recoilRings) => actions.updateTrip({ recoilRings })}
        />
        <div className="trip-output grouped" aria-label="Trip summary">
          {presentation.groups.map((group) => {
            const items =
              group.title === "Outcome" && modeledKillsPerTripRange
                ? [
                    ...group.items.slice(0, 2),
                    { label: "Modeled P10/50/90", value: modeledKillsPerTripRange },
                    ...group.items.slice(2)
                  ]
                : group.items;
            return (
              <section
                className="trip-output-group"
                aria-label={`${group.title} trip summary`}
                key={group.title}
              >
                <h3>{group.title}</h3>
                <MetricList items={items} />
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}

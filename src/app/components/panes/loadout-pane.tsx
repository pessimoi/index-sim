import { EQUIPMENT_SLOTS, type EquipmentBonuses, type EquipmentSlot } from "@/domain/shared";
import type { LoadoutPaneActions, LoadoutPaneViewModel } from "../../view-models/loadout";
import { formatNumber } from "../../view-models/formatting";
import type { HitDistributionComparisonViewModel } from "../../view-models/stats";
import { MetricList } from "../app-presenters";
import {
  CalculationWarningSummary,
  HitDistributionComparisonChart
} from "../combat-result-presenters";
import {
  MultiSelectionField,
  NumberField,
  OptionalNumberField,
  SearchableSelectField,
  SelectField
} from "../form-fields";
import { signedInteger, signedPercent } from "../presentation-formatters";

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

export interface LoadoutPanePresentationModel extends LoadoutPaneViewModel {
  hitDistributionHitChanceLabel: string;
  hitDistributionComparison: HitDistributionComparisonViewModel;
}

export function LoadoutPane({
  hidden,
  viewModel,
  actions
}: {
  hidden: boolean;
  viewModel: LoadoutPanePresentationModel;
  actions: LoadoutPaneActions;
}) {
  return (
    <>
      <section className="equipment-pane" aria-label="Equipment loadout" hidden={hidden}>
        <div className="section-title-row">
          <h2>{viewModel.combatStyle} loadout</h2>
          <span className={`status-pill ${viewModel.weaponName ? "ready" : ""}`}>
            {viewModel.weaponName || viewModel.weaponId}
          </span>
        </div>
        <div className="loadout-grid" aria-label="Style loadout controls">
          <SearchableSelectField
            label="Weapon"
            value={viewModel.weaponId}
            options={viewModel.weaponOptions}
            onChange={actions.setWeapon}
            searchPlaceholder="Search weapons"
          />
          {viewModel.combatStyle === "ranged" && (
            <SearchableSelectField
              label="Ammo"
              value={viewModel.ammoId}
              options={viewModel.ammoOptions}
              disabled={viewModel.weaponUsesOwnAmmo}
              onChange={actions.setAmmo}
              searchPlaceholder="Search ammo"
            />
          )}
          {viewModel.combatStyle === "magic" && (
            <SearchableSelectField
              label="Spell"
              value={viewModel.spellId}
              options={viewModel.spellOptions}
              onChange={actions.setSpell}
              searchPlaceholder="Search spells"
            />
          )}
          <SelectField
            label="Style"
            value={viewModel.styleId}
            options={viewModel.styleOptions}
            onChange={actions.setStyle}
          />
          <SelectField
            label="Prayer"
            value={viewModel.primaryPrayer}
            options={viewModel.primaryPrayerOptions}
            onChange={actions.setPrimaryPrayer}
          />
          <SelectField
            label="Boost"
            value={viewModel.primaryBoost}
            options={viewModel.primaryBoostOptions}
            onChange={actions.setPrimaryBoost}
          />
          <MultiSelectionField
            label="Prayer"
            options={viewModel.prayerOptions}
            selectedIds={viewModel.prayerIds}
            onToggle={actions.togglePrayer}
          />
          <MultiSelectionField
            label="Boost"
            options={viewModel.boostOptions}
            selectedIds={viewModel.boostIds}
            onToggle={actions.toggleBoost}
          />
          <label className="toggle sustained-toggle">
            <input
              type="checkbox"
              checked={viewModel.sustained}
              onChange={(event) => actions.setSustained(event.target.checked)}
            />
            <span>Sustained</span>
          </label>
          <NumberField
            label="Repot"
            value={viewModel.repotThreshold}
            min={1}
            max={120}
            disabled={!viewModel.sustained}
            onChange={actions.setRepotThreshold}
          />
        </div>
        <div className="loadout-actions">
          <label className="toggle loadout-eligibility-toggle">
            <input
              type="checkbox"
              checked={viewModel.respectRequirements}
              onChange={(event) => actions.setRespectRequirements(event.target.checked)}
            />
            <span>Respect current levels</span>
          </label>
          <button
            type="button"
            onClick={actions.optimize}
            title={
              viewModel.respectRequirements
                ? "Maximize current-target normal DPS using level-eligible visible weapon and equipment choices"
                : "Maximize current-target normal DPS using all visible weapon and equipment choices"
            }
          >
            Optimize loadout
          </button>
        </div>
        <div className="manual-overrides-panel" aria-label="Manual combat overrides">
          <div className="section-title-row">
            <h3>Manual overrides</h3>
            <span className={`status-pill ${viewModel.activeManualOverrideCount ? "ready" : ""}`}>
              {viewModel.activeManualOverrideCount
                ? `${viewModel.activeManualOverrideCount} active`
                : "derived"}
            </span>
          </div>
          <div className="manual-overrides-grid">
            <OptionalNumberField
              label="Accuracy bonus"
              value={viewModel.manualOverrides.accuracyBonus}
              min={-250}
              max={350}
              placeholder={viewModel.derivedAccuracyPlaceholder}
              onChange={(value) => actions.setManualOverride("accuracyBonus", value)}
            />
            <OptionalNumberField
              label="Damage bonus"
              value={viewModel.manualOverrides.damageBonus}
              min={-250}
              max={350}
              placeholder={viewModel.derivedDamagePlaceholder}
              onChange={(value) => actions.setManualOverride("damageBonus", value)}
            />
            <OptionalNumberField
              label="Attack speed sec"
              value={viewModel.manualOverrides.attackSpeedSec}
              min={0.6}
              max={12}
              step={0.1}
              placeholder={viewModel.derivedSpeedPlaceholder}
              onChange={(value) => actions.setManualOverride("attackSpeedSec", value)}
            />
            <button
              type="button"
              className="reset-overrides-button"
              disabled={viewModel.activeManualOverrideCount === 0}
              onClick={actions.resetManualOverrides}
            >
              Reset all overrides
            </button>
          </div>
        </div>
        <div className="equipment-slot-grid" aria-label="Equipment slots">
          {EQUIPMENT_SLOTS.map((slot) => {
            const quickAction = viewModel.gearQuickActions[slot];
            return (
              <div className="gear-quick-field" key={slot}>
                <SearchableSelectField
                  label={EQUIPMENT_SLOT_LABELS[slot]}
                  value={
                    slot === "shield" && viewModel.weaponTwoHanded
                      ? "none"
                      : (viewModel.gear[slot] ?? "none")
                  }
                  options={viewModel.gearOptions[slot]}
                  disabled={slot === "shield" && viewModel.weaponTwoHanded}
                  onChange={(itemId) => actions.setGear(slot, itemId)}
                  searchPlaceholder={`Search ${EQUIPMENT_SLOT_LABELS[slot].toLowerCase()}`}
                />
                <button
                  type="button"
                  className="gear-quick-action"
                  disabled={quickAction.disabled}
                  title={quickAction.reason}
                  aria-label={`Best ${EQUIPMENT_SLOT_LABELS[slot]}`}
                  onClick={() => actions.setGear(slot, quickAction.itemId)}
                >
                  {quickAction.reason === "Shield locked by two-handed weapon" ? "Locked" : "Best"}
                </button>
              </div>
            );
          })}
        </div>
        {viewModel.weaponTwoHanded && (
          <p className="inline-status neutral">Shield locked by two-handed weapon</p>
        )}
        {viewModel.setupRequirements.hasWarnings && (
          <div className="calculation-warning-slot">
            <CalculationWarningSummary
              warnings={viewModel.setupRequirements.warnings}
              label="Setup requirement warnings"
              title="Requirement warnings"
            />
            <p className="inline-status neutral">{viewModel.setupRequirements.policyLabel}</p>
          </div>
        )}
        {viewModel.loadoutBonuses && (
          <div className="bonus-summary" aria-label="Equipment bonus summary">
            <div>
              <h3>Offensive bonuses</h3>
              <div className="bonus-grid">
                {OFFENSIVE_BONUS_LABELS.map(([key, label]) => (
                  <div className="bonus-cell" key={key}>
                    <span>{label}</span>
                    <strong>{signedInteger(viewModel.loadoutBonuses?.totals[key] ?? 0)}</strong>
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
                    <strong>{signedInteger(viewModel.loadoutBonuses?.totals[key] ?? 0)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="special-strip" aria-label="Special attack" hidden={hidden}>
        <div className="section-title-row">
          <h2>Special attack</h2>
          <span className={`status-pill ${viewModel.specialAttack ? "ready" : ""}`}>
            {viewModel.specialStatus}
          </span>
        </div>
        <div className="special-body">
          <SelectField
            label="Spec weapon"
            value={viewModel.selectedSpecialWeapon}
            options={viewModel.specialAttackOptions}
            disabled={viewModel.specialAttackDisabled}
            onChange={actions.setSpecialWeapon}
          />
          {viewModel.specialAttackRequiresAmmo && (
            <SelectField
              label="Spec ammo"
              value={viewModel.selectedSpecialAmmo}
              options={viewModel.specialAmmoOptions}
              disabled={
                viewModel.specialAttackDisabled || viewModel.specialAmmoOptions.length === 0
              }
              onChange={actions.setSpecialAmmo}
            />
          )}
          {viewModel.combatStyle === "magic" && (
            <p className="inline-status neutral">Magic special attacks are not modeled yet.</p>
          )}
          {viewModel.dbaSpecActive && (
            <p className="inline-status neutral">
              DBA boost uses spec energy as a boost; DPS-special selection is paused.
            </p>
          )}
          {viewModel.specialAttack && (
            <div className="special-output" aria-label="Special attack metrics">
              <MetricList
                items={[
                  {
                    label: "Spec max hit",
                    value:
                      viewModel.specialAttack.hits > 1
                        ? `${formatNumber(viewModel.specialAttack.maxHit)} x${viewModel.specialAttack.hits}`
                        : formatNumber(viewModel.specialAttack.maxHit)
                  },
                  {
                    label: "Spec hit %",
                    value: `${formatNumber(viewModel.specialAttack.hitChance * 100, 1)}%`
                  },
                  {
                    label: "Specs/hr",
                    value: formatNumber(viewModel.specialAttack.specsPerHour, 1)
                  },
                  {
                    label: "DPS with spec",
                    value: formatNumber(viewModel.specialAttack.dpsWithSpec, 2),
                    tone: "teal"
                  },
                  {
                    label: "DPS gain",
                    value: signedPercent(viewModel.specialAttack.dpsGainPct),
                    tone: viewModel.specialAttack.dpsGainPct >= 0 ? "teal" : "gold"
                  }
                ]}
              />
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

      <section className="hit-distribution-panel" aria-label="Damage distribution" hidden={hidden}>
        <div className="section-title-row">
          <div>
            <h2>Damage distribution</h2>
            <span className="section-subtitle">Exact rolled damage per attack event</span>
          </div>
          <span className="status-pill ready">{viewModel.hitDistributionHitChanceLabel} hit</span>
        </div>
        <HitDistributionComparisonChart
          comparison={viewModel.hitDistributionComparison}
          ariaLabel="Damage distribution buckets"
        />
      </section>
    </>
  );
}

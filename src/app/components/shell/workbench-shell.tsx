import type { KeyboardEvent, ReactNode } from "react";
import type { CombatStyle, EntityId } from "@/domain/shared";
import type { ActiveAssumptionsSummaryViewModel } from "../../view-models/active-assumptions";
import type {
  ActiveAssumptionResetTarget,
  ActiveAssumptionReviewTarget
} from "../../view-models/active-assumptions";
import {
  COMBAT_STYLE_OPTIONS,
  PRIMARY_BOOST_OPTIONS,
  PRIMARY_PRAYER_OPTIONS,
  WORKBENCH_TABS,
  nextWorkbenchTabId,
  workbenchTabLabel,
  type AppShellSetupViewModel,
  type WorkbenchResultViewModel,
  type WorkbenchTabId
} from "../../view-models/app-shell";
import type { CalculationWarningViewModel } from "../../view-models/contracts";
import type { ManualCombatOverrideField } from "../../view-models/loadout";
import { formatNumber } from "../../view-models/formatting";
import type { CombatSetupFormState } from "../../state/ui-state";
import { ActiveAssumptionsSummary, CalculationWarningSummary } from "../combat-result-presenters";
import {
  CompactSelectionSelectField,
  NumberField,
  OptionalNumberField,
  ReadOnlyField,
  SearchableSelectField,
  SelectField,
  type SelectOption
} from "../form-fields";
import { MetricList } from "../app-presenters";

export interface WorkbenchShellActions {
  activateTab(tabId: WorkbenchTabId): void;
  selectCombatStyle(combatStyle: CombatStyle): void;
  updateLevel(skill: keyof CombatSetupFormState["levels"], value: number): void;
  setStyle(styleId: EntityId): void;
  selectTarget(monsterId: EntityId): void;
  createCustomSetup(): void;
  editDefaultSetup(): void;
  editCustomSetup(): void;
  removeCurrentCustomSetup(): void;
  setSpell(spellId: EntityId): void;
  setPrimaryPrayer(prayerId: EntityId): void;
  setPrimaryBoost(boostId: EntityId): void;
  setManualOverride(field: ManualCombatOverrideField, value: number | null): void;
  reviewActiveAssumption(target: ActiveAssumptionReviewTarget): void;
  resetActiveAssumption(target: ActiveAssumptionResetTarget, statusLabel: string): void;
}

export interface WorkbenchShellProps {
  activeTab: WorkbenchTabId;
  form: CombatSetupFormState;
  shellSetup: AppShellSetupViewModel;
  result: WorkbenchResultViewModel;
  currentMonsterLabel: string;
  hasCurrentCustomSetup: boolean;
  activeSetupIsCustom: boolean;
  monsterOptions: SelectOption[];
  styleOptions: SelectOption[];
  spellOptions: SelectOption[];
  foodPerKill: number;
  moneyWarnings: readonly CalculationWarningViewModel[];
  activeAssumptions: ActiveAssumptionsSummaryViewModel;
  actions: WorkbenchShellActions;
  children: ReactNode;
  rail: ReactNode;
}

function WorkbenchMetric({
  metric,
  onActivateTab
}: {
  metric: WorkbenchResultViewModel["metrics"][number];
  onActivateTab(tabId: WorkbenchTabId): void;
}) {
  return (
    <div className="metric">
      <span>{metric.label}</span>
      <strong className={metric.tone}>{metric.value}</strong>
      {metric.detail ? (
        <small>
          {metric.detail}
          {metric.reviewTarget ? (
            <button
              type="button"
              className="metric-detail-link"
              onClick={() => onActivateTab(metric.reviewTarget!)}
            >
              Risk
            </button>
          ) : null}
        </small>
      ) : null}
    </div>
  );
}

export function WorkbenchShell({
  activeTab,
  form,
  shellSetup,
  result,
  currentMonsterLabel,
  hasCurrentCustomSetup,
  activeSetupIsCustom,
  monsterOptions,
  styleOptions,
  spellOptions,
  foodPerKill,
  moneyWarnings,
  activeAssumptions,
  actions,
  children,
  rail
}: WorkbenchShellProps) {
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const nextTabId = nextWorkbenchTabId(activeTab, event.key);
    if (!nextTabId) return;
    event.preventDefault();
    actions.activateTab(nextTabId);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#workbench-tab-${nextTabId}`)
      ?.focus();
  };

  return (
    <>
      <nav className="setup-guide-bar" aria-label="Setup quick navigation">
        {shellSetup.setupGuide.map((row) => (
          <button
            key={row.target}
            type="button"
            aria-label={row.ariaLabel}
            onClick={() => actions.activateTab(row.target)}
          >
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            <small>{row.context}</small>
          </button>
        ))}
      </nav>

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
                  onClick={() => actions.selectCombatStyle(option.id as CombatStyle)}
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
                    onChange={(value) => actions.updateLevel("attack", value)}
                  />
                  <NumberField
                    label="STR"
                    value={form.levels.strength}
                    onChange={(value) => actions.updateLevel("strength", value)}
                  />
                </>
              )}
              {form.combatStyle === "ranged" && (
                <NumberField
                  label="RNG"
                  value={form.levels.ranged}
                  onChange={(value) => actions.updateLevel("ranged", value)}
                />
              )}
              {form.combatStyle === "magic" && (
                <NumberField
                  label="MAG"
                  value={form.levels.magic}
                  onChange={(value) => actions.updateLevel("magic", value)}
                />
              )}
              <NumberField
                label="DEF"
                value={form.levels.defence}
                onChange={(value) => actions.updateLevel("defence", value)}
              />
              <NumberField
                label="HP"
                value={form.levels.hitpoints}
                onChange={(value) => actions.updateLevel("hitpoints", value)}
              />
              <NumberField
                label="Prayer lvl"
                value={form.levels.prayer}
                onChange={(value) => actions.updateLevel("prayer", value)}
              />
            </div>
            <SelectField
              label="STYLE"
              value={form.styleId}
              options={styleOptions}
              onChange={actions.setStyle}
            />
            <div className="sidebar-metrics" aria-label="Effective trip rates">
              <MetricList items={result.sidebarMetrics} />
            </div>
          </section>
        </aside>

        <section className="workbench-center" aria-label="Workbench center">
          <section className="setup-context-bar" aria-label="Setup context">
            <div className="setup-context-title">
              <h2>{currentMonsterLabel}</h2>
              <span>{shellSetup.setupStatus}</span>
            </div>
            <SearchableSelectField
              label="Monster"
              value={form.monsterId}
              options={monsterOptions}
              className="setup-context-monster-field"
              searchPlaceholder="Search monsters"
              onChange={actions.selectTarget}
            />
            <div className="setup-context-actions" aria-label="Setup actions">
              <button
                type="button"
                aria-label="Create custom setup"
                title="Create custom setup"
                disabled={activeSetupIsCustom}
                onClick={actions.createCustomSetup}
              >
                New
              </button>
              {hasCurrentCustomSetup ? (
                <button
                  type="button"
                  aria-label={activeSetupIsCustom ? "Edit default" : "Edit custom"}
                  title={activeSetupIsCustom ? "Edit default setup" : "Edit custom setup"}
                  onClick={activeSetupIsCustom ? actions.editDefaultSetup : actions.editCustomSetup}
                >
                  Edit
                </button>
              ) : (
                <button type="button" aria-label="Edit default" title="Edit default setup" disabled>
                  Edit
                </button>
              )}
              <button
                type="button"
                className="danger-button"
                aria-label="Remove custom setup"
                title="Remove custom setup"
                disabled={!hasCurrentCustomSetup}
                onClick={actions.removeCurrentCustomSetup}
              >
                Remove
              </button>
            </div>
            <div className="setup-context-metrics">
              <MetricList items={result.contextMetrics} />
            </div>
          </section>

          <nav className="tab-bar" aria-label="Workbench tabs" role="tablist">
            {WORKBENCH_TABS.map((tab) => (
              <button
                key={tab.id}
                id={`workbench-tab-${tab.id}`}
                type="button"
                role="tab"
                className={activeTab === tab.id ? "active" : undefined}
                aria-selected={activeTab === tab.id}
                aria-controls="workbench-active-panel"
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => actions.activateTab(tab.id)}
                onKeyDown={handleTabKeyDown}
              >
                {workbenchTabLabel(tab.id, form.combatStyle)}
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
                hidden={activeTab !== "compare" && activeTab !== "loadout"}
              >
                <ReadOnlyField label="TYPE" value={form.combatStyle} />
                <NumberField
                  label={shellSetup.primaryLevelLabel}
                  value={form.levels[shellSetup.primarySkill]}
                  onChange={(value) => actions.updateLevel(shellSetup.primarySkill, value)}
                />
                {form.combatStyle === "magic" ? (
                  <SelectField
                    label="SPELL"
                    value={form.spellId}
                    options={spellOptions}
                    className="compact-spell-field"
                    onChange={actions.setSpell}
                  />
                ) : form.combatStyle === "ranged" ? (
                  <ReadOnlyField label="-" value="-" disabled />
                ) : (
                  <NumberField
                    label="STR"
                    value={form.levels.strength}
                    onChange={(value) => actions.updateLevel("strength", value)}
                  />
                )}
                <NumberField
                  label="DEF"
                  value={form.levels.defence}
                  onChange={(value) => actions.updateLevel("defence", value)}
                />
                <SelectField
                  label="STANCE"
                  value={form.styleId}
                  options={styleOptions}
                  className="compact-stance-field"
                  onChange={actions.setStyle}
                />
                <CompactSelectionSelectField
                  label="PRAYER"
                  value={shellSetup.primaryPrayer}
                  options={PRIMARY_PRAYER_OPTIONS}
                  extraCount={shellSetup.extraPrayerCount}
                  onChange={actions.setPrimaryPrayer}
                />
                <CompactSelectionSelectField
                  label="BOOST"
                  value={shellSetup.primaryBoost}
                  options={PRIMARY_BOOST_OPTIONS}
                  extraCount={shellSetup.extraBoostCount}
                  onChange={actions.setPrimaryBoost}
                />
                <OptionalNumberField
                  label={shellSetup.accuracyLabel}
                  value={form.manualOverrides.accuracyBonus}
                  min={-250}
                  max={350}
                  placeholder={shellSetup.derivedAccuracyPlaceholder}
                  compactReset
                  onChange={(value) => actions.setManualOverride("accuracyBonus", value)}
                />
                <OptionalNumberField
                  label={shellSetup.damageLabel}
                  value={form.manualOverrides.damageBonus}
                  min={-250}
                  max={350}
                  placeholder={shellSetup.derivedDamagePlaceholder}
                  compactReset
                  onChange={(value) => actions.setManualOverride("damageBonus", value)}
                />
                <OptionalNumberField
                  label="SPD"
                  value={form.manualOverrides.attackSpeedSec}
                  min={0.6}
                  max={12}
                  step={0.1}
                  placeholder={shellSetup.derivedSpeedPlaceholder}
                  compactReset
                  onChange={(value) => actions.setManualOverride("attackSpeedSec", value)}
                />
                <ReadOnlyField label="F/KL" value={formatNumber(foodPerKill, 2)} />
                <SelectField
                  label="TARGET"
                  value={form.monsterId}
                  options={monsterOptions}
                  className="compact-target-field"
                  onChange={actions.selectTarget}
                />
              </section>

              <section
                className="dense-metric-strip"
                aria-label="Simulation results"
                hidden={activeTab !== "stats" && activeTab !== "compare"}
              >
                {result.metrics.map((metric) => (
                  <WorkbenchMetric
                    key={metric.label}
                    metric={metric}
                    onActivateTab={actions.activateTab}
                  />
                ))}
              </section>
              <div
                className="calculation-warning-slot"
                hidden={activeTab !== "stats" && activeTab !== "compare"}
              >
                {result.netGpGuidance.visible ? (
                  <section className="net-gp-guidance" aria-label="Net GP explanation">
                    <div>
                      <strong>Why net GP is negative</strong>
                      <span>{result.netGpGuidance.message}</span>
                    </div>
                    <div className="net-gp-guidance-actions">
                      <button type="button" onClick={() => actions.activateTab("loadout")}>
                        Edit prayers &amp; boosts
                      </button>
                      <button type="button" onClick={() => actions.activateTab("trip")}>
                        Review potion carry
                      </button>
                    </div>
                  </section>
                ) : null}
                <CalculationWarningSummary warnings={moneyWarnings} label="Result price warnings" />
                <ActiveAssumptionsSummary
                  summary={activeAssumptions}
                  onReview={actions.reviewActiveAssumption}
                  onReset={actions.resetActiveAssumption}
                />
              </div>

              {children}
            </section>
          </section>
        </section>
        {rail}
      </section>
    </>
  );
}

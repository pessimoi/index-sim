import type { ReactNode, RefObject } from "react";
import type { CombatStyle, EntityId } from "@/domain/shared";
import type { PaneFamily, PaneLoadState } from "../../state/pane-delivery";
import type { ActiveAssumptionsSummaryViewModel } from "../../view-models/active-assumptions";
import type {
  ActiveAssumptionResetTarget,
  ActiveAssumptionReviewTarget
} from "../../view-models/active-assumptions";
import {
  COMBAT_STYLE_OPTIONS,
  PRIMARY_BOOST_OPTIONS,
  PRIMARY_PRAYER_OPTIONS,
  workbenchTabLabel,
  type AppShellSetupViewModel,
  type SetupEditorActionId,
  type WorkbenchResultViewModel,
  type WorkbenchTabId
} from "../../view-models/app-shell";
import type {
  CurrentPriceNoticePresentation,
  PriceNoticeAction
} from "../../view-models/price-data";
import type { ManualCombatOverrideField } from "../../view-models/loadout";
import { formatNumber } from "../../view-models/formatting";
import { expandedCompactLabel } from "../../view-models/presentation-language";
import type { CombatSetupFormState } from "../../state/ui-state";
import { ActiveAssumptionsSummary } from "../combat-result-presenters";
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
import { WorkbenchTabNavigation } from "./workbench-tab-navigation";

export interface WorkbenchShellActions {
  activateTab(tabId: WorkbenchTabId): void;
  routeToTab(tabId: WorkbenchTabId): void;
  selectCombatStyle(combatStyle: CombatStyle): void;
  updateLevel(skill: keyof CombatSetupFormState["levels"], value: number): void;
  setStyle(styleId: EntityId): void;
  selectTarget(monsterId: EntityId): void;
  createCustomSetup(): void;
  editDefaultSetup(): void;
  editCustomSetup(): void;
  removeCurrentCustomSetup(): void;
  resetActiveSetup(): void;
  setSpell(spellId: EntityId): void;
  setPrimaryPrayer(prayerId: EntityId): void;
  setPrimaryBoost(boostId: EntityId): void;
  setManualOverride(field: ManualCombatOverrideField, value: number | null): void;
  reviewPriceData(): void;
  reviewPriceItem(action: PriceNoticeAction): void;
  reviewActiveAssumption(target: ActiveAssumptionReviewTarget): void;
  resetActiveAssumption(target: ActiveAssumptionResetTarget, statusLabel: string): void;
}

export interface WorkbenchShellProps {
  activeTab: WorkbenchTabId;
  activePaneFamily: PaneFamily;
  activePaneLoadState: PaneLoadState;
  form: CombatSetupFormState;
  shellSetup: AppShellSetupViewModel;
  result: WorkbenchResultViewModel;
  currentMonsterLabel: string;
  setupModeHeadingRef: RefObject<HTMLElement | null>;
  resetSetupButtonRef: RefObject<HTMLButtonElement | null>;
  playerLevelGroupRef: RefObject<HTMLDivElement | null>;
  monsterOptions: SelectOption[];
  styleOptions: SelectOption[];
  spellOptions: SelectOption[];
  foodPerKill: number;
  priceNotices: CurrentPriceNoticePresentation;
  activeAssumptions: ActiveAssumptionsSummaryViewModel;
  setupReview: ReactNode;
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
  const accessibleLabel = expandedCompactLabel(metric.label);
  return (
    <div className="metric">
      {accessibleLabel ? (
        <span className="visually-hidden">{`${accessibleLabel}: ${metric.value}`}</span>
      ) : null}
      <span aria-hidden={accessibleLabel ? true : undefined}>{metric.label}</span>
      <strong aria-hidden={accessibleLabel ? true : undefined} className={metric.tone}>
        {metric.value}
      </strong>
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
  activePaneFamily,
  activePaneLoadState,
  form,
  shellSetup,
  result,
  currentMonsterLabel,
  setupModeHeadingRef,
  resetSetupButtonRef,
  playerLevelGroupRef,
  monsterOptions,
  styleOptions,
  spellOptions,
  foodPerKill,
  priceNotices,
  activeAssumptions,
  setupReview,
  actions,
  children,
  rail
}: WorkbenchShellProps) {
  const setupTabLabel = workbenchTabLabel("loadout", form.combatStyle);
  const invokeSetupAction = (actionId: SetupEditorActionId): void => {
    if (actionId === "create-monster") actions.createCustomSetup();
    if (actionId === "edit-monster") actions.editCustomSetup();
    if (actionId === "edit-default") actions.editDefaultSetup();
    if (actionId === "remove-monster") actions.removeCurrentCustomSetup();
    if (actionId === "reset-active") actions.resetActiveSetup();
  };
  return (
    <>
      <nav className="setup-guide-bar" aria-label="Setup quick navigation">
        {shellSetup.setupGuide.map((row) => (
          <button
            key={row.target}
            type="button"
            aria-label={row.ariaLabel}
            onClick={() => actions.routeToTab(row.target)}
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
            <div
              id="player-level-fields"
              className="level-grid sidebar-levels"
              aria-label="Player levels"
              ref={playerLevelGroupRef}
              tabIndex={-1}
            >
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
          </section>
          <section
            className="sidebar-section mobile-result-summary"
            aria-label="Mobile result summary"
          >
            <MetricList items={result.contextMetrics} />
          </section>
          <section className="sidebar-section player-profile" aria-label="Active player setup">
            <div className="section-title-row">
              <h3>Active setup</h3>
            </div>
            <dl className="player-profile-list">
              {shellSetup.playerProfile.rows.map((row) => (
                <div className="player-profile-row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className={row.tone}>{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="player-profile-actions">
              <button
                type="button"
                aria-label={setupTabLabel}
                onClick={() => actions.routeToTab("loadout")}
              >
                {setupTabLabel}
              </button>
              <button
                type="button"
                aria-label="View stats"
                onClick={() => actions.routeToTab("stats")}
              >
                Stats
              </button>
            </div>
          </section>
        </aside>

        <section className="workbench-center" aria-label="Workbench center">
          <section className="setup-context-bar" aria-label="Setup context">
            <div className="setup-context-title">
              <h2>{currentMonsterLabel}</h2>
              <strong ref={setupModeHeadingRef} tabIndex={-1}>
                {shellSetup.editor.modeLabel}
              </strong>
              {shellSetup.editor.savedCustomDescription ? (
                <span>{shellSetup.editor.savedCustomDescription}</span>
              ) : null}
            </div>
            <SearchableSelectField
              label="Monster"
              value={form.monsterId}
              options={monsterOptions}
              className="setup-context-monster-field"
              searchPlaceholder="Search monsters"
              onChange={actions.selectTarget}
            />
            <div className="setup-context-editor-details">
              <p>
                <span className="setup-context-scope-wide">
                  {shellSetup.editor.scopeDescription}
                </span>
                <span className="setup-context-scope-compact">
                  {shellSetup.editor.compactScopeDescription}
                </span>
              </p>
              <div
                className={`setup-persistence-status ${shellSetup.editor.persistence.kind}`}
                aria-label="Setup saving status"
                aria-describedby="setup-persistence-description"
              >
                <strong>{shellSetup.editor.persistence.label}</strong>
                <span id="setup-persistence-description">
                  {shellSetup.editor.persistence.description}
                </span>
              </div>
            </div>
            <div className="setup-context-actions" aria-label="Setup actions">
              {shellSetup.editor.actions.map((action) => (
                <button
                  key={action.id}
                  ref={action.id === "reset-active" ? resetSetupButtonRef : undefined}
                  type="button"
                  className={action.tone === "danger" ? "danger-button" : undefined}
                  aria-label={action.label}
                  title={action.label}
                  onClick={() => invokeSetupAction(action.id)}
                >
                  {action.label}
                </button>
              ))}
            </div>
            <div className="setup-context-metrics">
              <MetricList items={result.contextMetrics} />
            </div>
          </section>

          <div className="setup-review-slot">{setupReview}</div>

          <WorkbenchTabNavigation
            activeTab={activeTab}
            combatStyle={form.combatStyle}
            onActivateTab={actions.activateTab}
          />

          <section
            id="workbench-active-panel"
            className="active-pane"
            role="tabpanel"
            aria-label="Active workbench pane"
            aria-labelledby={`workbench-tab-${activeTab}`}
            aria-busy={activePaneLoadState === "loading" ? true : undefined}
            data-pane-family={activePaneFamily}
            data-pane-load-state={activePaneLoadState}
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
                  accessibleLabel="Attack speed in seconds"
                  value={form.manualOverrides.attackSpeedSec}
                  min={0.6}
                  max={12}
                  step={0.1}
                  placeholder={shellSetup.derivedSpeedPlaceholder}
                  compactReset
                  onChange={(value) => actions.setManualOverride("attackSpeedSec", value)}
                />
                <ReadOnlyField
                  label="F/KL"
                  accessibleLabel="Food per kill"
                  value={formatNumber(foodPerKill, 2)}
                />
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
                tabIndex={0}
                hidden={activeTab !== "stats" && activeTab !== "compare"}
              >
                {result.metrics.map((metric) => (
                  <WorkbenchMetric
                    key={metric.label}
                    metric={metric}
                    onActivateTab={actions.routeToTab}
                  />
                ))}
              </section>
              {activeTab === "compare" ? (
                <a className="mobile-monster-jump" href="#monster-card-panel">
                  Monster details
                </a>
              ) : null}
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
                      <button type="button" onClick={() => actions.routeToTab("loadout")}>
                        Edit prayers &amp; boosts
                      </button>
                      <button type="button" onClick={() => actions.routeToTab("trip")}>
                        Review potion carry
                      </button>
                    </div>
                  </section>
                ) : null}
                {priceNotices.issues.length > 0 ? (
                  <section className="price-data-issue" aria-label="Price data issue">
                    <div>
                      <strong>Price data incomplete</strong>
                      <span>
                        {formatNumber(priceNotices.issues.length)} active{" "}
                        {priceNotices.issues.length === 1 ? "value uses" : "values use"} missing or
                        fallback prices.
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={
                        priceNotices.resultAction
                          ? `${priceNotices.resultAction.label} for ${priceNotices.issues[0]?.itemLabel ?? priceNotices.resultAction.itemId}`
                          : undefined
                      }
                      onClick={() =>
                        priceNotices.resultAction
                          ? actions.reviewPriceItem(priceNotices.resultAction)
                          : actions.reviewPriceData()
                      }
                    >
                      {priceNotices.resultAction?.label ?? "Review price data"}
                    </button>
                  </section>
                ) : null}
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

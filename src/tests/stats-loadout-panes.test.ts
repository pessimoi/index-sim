import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadBundledLegacyContext } from "../adapters/legacy-runtime";
import {
  LoadoutPane,
  type LoadoutPanePresentationModel
} from "../app/components/panes/loadout-pane";
import { StatsPane } from "../app/components/panes/stats-pane";
import {
  BOOST_SELECTION_OPTIONS,
  DEFAULT_FORM_STATE,
  PRAYER_SELECTION_OPTIONS
} from "../app/state/ui-state";
import {
  createLoadoutPaneViewModel,
  type LoadoutPaneActions,
  type LoadoutPaneViewModel
} from "../app/view-models/loadout";
import { createSimulationViewModel } from "../app/view-models/simulation";
import { EQUIPMENT_SLOTS, type EquipmentSlot } from "../domain/shared";

const noOp = () => undefined;

const actions: LoadoutPaneActions = {
  setWeapon: noOp,
  setAmmo: noOp,
  setSpell: noOp,
  setStyle: noOp,
  setPrimaryPrayer: noOp,
  setPrimaryBoost: noOp,
  togglePrayer: noOp,
  toggleBoost: noOp,
  setSustained: noOp,
  setRepotThreshold: noOp,
  setRespectRequirements: noOp,
  optimize: noOp,
  setManualOverride: noOp,
  resetManualOverrides: noOp,
  setGear: noOp,
  setSpecialWeapon: noOp,
  setSpecialAmmo: noOp
};

function inOrder(markup: string, fragments: readonly string[]): void {
  let previous = -1;
  for (const fragment of fragments) {
    const next = markup.indexOf(fragment, previous + 1);
    expect(next, `missing or out-of-order fragment: ${fragment}`).toBeGreaterThan(previous);
    previous = next;
  }
}

describe("Stats and Loadout panes", () => {
  it("keeps the extracted Stats analysis sections, roles and summaries in order", async () => {
    const { context } = await loadBundledLegacyContext();
    const simulation = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const markup = renderToStaticMarkup(
      createElement(StatsPane, {
        hidden: true,
        viewModel: {
          sourceBreakdown: simulation.statsSourceBreakdown,
          combatRollDetail: simulation.combatRollDetail,
          xpRouting: simulation.xpRouting,
          tripBankingSummary: simulation.tripBankingSummary
        }
      })
    );

    expect(
      markup.startsWith(
        '<section class="stats-analysis-pane" aria-label="Stats analysis" hidden="">'
      )
    ).toBe(true);
    inOrder(markup, [
      'aria-label="Source breakdown"',
      'aria-label="Source breakdown rows"',
      'aria-label="Source detail panels"',
      'aria-label="Combat roll details"',
      'aria-label="XP routing"',
      'aria-label="Trip and banking summary"'
    ]);
    expect(markup).toContain(`${simulation.statsSourceBreakdown.rows.length} sources`);
    expect(markup).toContain(`${simulation.xpRouting.effectiveXpPerHourLabel} XP/hr`);
    expect(markup).toContain('aria-label="Trip and banking metrics"');
  });

  it("keeps Loadout, special attack and damage distribution under one pane contract", async () => {
    const { context } = await loadBundledLegacyContext();
    const simulation = createSimulationViewModel(DEFAULT_FORM_STATE, context);
    const gearOptions = Object.fromEntries(
      EQUIPMENT_SLOTS.map((slot) => [slot, [{ id: "none", label: "None" }]])
    ) as Record<EquipmentSlot, Array<{ id: string; label: string }>>;
    const gearQuickActions = Object.fromEntries(
      EQUIPMENT_SLOTS.map((slot) => [
        slot,
        { itemId: "none", itemLabel: "None", disabled: false, reason: "No upgrade" }
      ])
    ) as LoadoutPaneViewModel["gearQuickActions"];
    const viewModel: LoadoutPanePresentationModel = {
      ...createLoadoutPaneViewModel({
        combatStyle: DEFAULT_FORM_STATE.combatStyle,
        weaponId: DEFAULT_FORM_STATE.weaponId,
        ammoId: DEFAULT_FORM_STATE.ammoId,
        spellId: DEFAULT_FORM_STATE.spellId,
        styleId: DEFAULT_FORM_STATE.styleId,
        currentWeapon: context.gameData.weapons[DEFAULT_FORM_STATE.weaponId] ?? null,
        weaponOptions: [
          {
            id: DEFAULT_FORM_STATE.weaponId,
            label:
              context.gameData.weapons[DEFAULT_FORM_STATE.weaponId]?.name ??
              DEFAULT_FORM_STATE.weaponId
          }
        ],
        ammoOptions: [{ id: DEFAULT_FORM_STATE.ammoId, label: DEFAULT_FORM_STATE.ammoId }],
        spellOptions: [{ id: DEFAULT_FORM_STATE.spellId, label: DEFAULT_FORM_STATE.spellId }],
        styleOptions: [{ id: DEFAULT_FORM_STATE.styleId, label: DEFAULT_FORM_STATE.styleId }],
        primaryPrayer: "none",
        primaryPrayerOptions: [{ id: "none", label: "None" }],
        primaryBoost: "none",
        primaryBoostOptions: [{ id: "none", label: "None" }],
        prayerOptions: PRAYER_SELECTION_OPTIONS,
        boostOptions: BOOST_SELECTION_OPTIONS,
        prayerIds: DEFAULT_FORM_STATE.prayers,
        boostIds: DEFAULT_FORM_STATE.boosts,
        sustained: DEFAULT_FORM_STATE.sustained,
        repotThreshold: DEFAULT_FORM_STATE.repotThreshold ?? 65,
        respectRequirements: true,
        manualOverrides: DEFAULT_FORM_STATE.manualOverrides,
        derivedCombat: { accuracyBonus: 42, damageBonus: 7, attackSpeedSec: 2.4 },
        gear: DEFAULT_FORM_STATE.gear,
        gearOptions,
        gearQuickActions,
        setupRequirements: simulation.setupRequirements,
        loadoutBonuses: null,
        specialAttackSelection: { weaponId: "fixture_special", ammoId: "none" },
        fallbackAmmoId: DEFAULT_FORM_STATE.ammoId,
        specialAttackOptions: [{ id: "fixture_special", label: "Fixture special" }],
        specialAttackRequiresAmmo: false,
        specialAmmoOptions: [],
        dbaSpecActive: false,
        specialAttack: {
          key: "fixture_special",
          weaponName: "Fixture special",
          specsPerHour: 12.3,
          expPerSpec: 0,
          maxHit: 42,
          hits: 2,
          hitChance: 0.654,
          dpsBase: 3,
          dpsWithSpec: 3.45,
          dpsGainPct: 15
        },
        specialWarnings: []
      }),
      hitDistributionHitChanceLabel: simulation.hitDistribution.hitChanceLabel,
      hitDistributionComparison: simulation.hitDistributionComparison
    };
    const markup = renderToStaticMarkup(
      createElement(LoadoutPane, { hidden: true, viewModel, actions })
    );

    inOrder(markup, [
      'aria-label="Equipment loadout" hidden=""',
      'aria-label="Style loadout controls"',
      'aria-label="Prayer options" open=""',
      'aria-label="Prayer selections"',
      'aria-label="Boost options" open=""',
      'aria-label="Boost selections"',
      'aria-label="Manual combat overrides"',
      'aria-label="Equipment slots"',
      'aria-label="Special attack" hidden=""',
      'aria-label="Special attack metrics"',
      'aria-label="Damage distribution" hidden=""',
      'aria-label="Damage distribution buckets"'
    ]);
    expect(markup).toContain("Respect current levels");
    expect(markup.match(/class="collapsible-control-group"/g)).toHaveLength(2);
    expect(markup).toContain('aria-hidden="true">▸</span>Prayer');
    expect(markup).toContain('aria-hidden="true">▸</span>Boost');
    expect(markup).toContain("Optimize loadout");
    expect(markup).toContain("Reset all overrides");
    expect(markup).toContain("42 x2");
    expect(markup).toContain("65.4%");
    expect(markup).toContain(`${simulation.hitDistribution.hitChanceLabel} hit`);
  });
});

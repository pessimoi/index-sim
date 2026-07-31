import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadCurrentTestContext } from "./helpers/current-sim";
import { TripPane } from "../app/components/panes/trip-pane";
import { SelectField } from "../app/components/form-fields";
import {
  DEFAULT_FORM_STATE,
  normalizeFormState,
  type CombatSetupFormState
} from "../app/state/ui-state";
import { createSimulationViewModel } from "../app/view-models/simulation";
import { createTripPaneViewModel } from "../app/view-models/trip";

function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const children = (node.props as { children?: ReactNode }).children;
  return [node, ...elements(children)];
}

function selectChange(tree: ReactNode, label: string, value: string): void {
  const field = elements(tree).find(
    (element) =>
      element.type === SelectField && (element.props as { label?: string }).label === label
  );
  expect(field, `missing SelectField ${label}`).toBeDefined();
  (field!.props as { onChange(value: string): void }).onChange(value);
}

async function fixture(form: CombatSetupFormState = DEFAULT_FORM_STATE) {
  const { context } = await loadCurrentTestContext();
  const simulation = createSimulationViewModel(form, context);
  return createTripPaneViewModel({ form, result: simulation.trip });
}

describe("Trip pane", () => {
  it("keeps the landmark, recommendation, controls and eight output groups in order", async () => {
    const presentation = await fixture();
    const markup = renderToStaticMarkup(
      createElement(TripPane, {
        hidden: true,
        model: { presentation, modeledKillsPerTripRange: "10 / 20 / 30" },
        actions: {
          updateTrip: () => undefined,
          applyRecommendation: () => undefined,
          openRisk: () => undefined
        }
      })
    );

    expect(
      markup.startsWith('<section class="trip-strip" aria-label="Trip assumptions" hidden="">')
    ).toBe(true);
    expect(markup).toContain("Risk ranges");
    expect(markup).toContain("Apply recommendation");
    expect(markup).toContain("Modeled P10/50/90");
    expect(markup).toContain(">Respawn (seconds)</label>");
    expect(markup).toContain('aria-label="Food per kill override"');
    let previous = -1;
    for (const title of [
      "Survival",
      "Prayer",
      "Food",
      "Inventory reserve",
      "Potions",
      "Scarce cap",
      "Recoil",
      "Outcome"
    ]) {
      const next = markup.indexOf(`<h3>${title}</h3>`, previous + 1);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
  });

  it("maps exclusive mode controls to the exact Trip patches", async () => {
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      trip: {
        ...DEFAULT_FORM_STATE.trip,
        bankSeconds: 45,
        prayerMode: "potions",
        prayerPotionSets: 4,
        prayerPotionDoses: null,
        altarSeconds: 30,
        foodCount: 12,
        foodPerKillOverride: 1.234
      }
    });
    const presentation = await fixture(form);
    const patches: Array<Partial<CombatSetupFormState["trip"]>> = [];
    const tree = TripPane({
      hidden: false,
      model: { presentation, modeledKillsPerTripRange: null },
      actions: {
        updateTrip: (patch) => patches.push(patch),
        applyRecommendation: () => undefined,
        openRisk: () => undefined
      }
    });

    selectChange(tree, "Bank time", "auto");
    selectChange(tree, "Prayer mode", "none");
    selectChange(tree, "Prayer restore", "manual_doses");
    selectChange(tree, "Altar time", "auto");
    selectChange(tree, "Food mode", "auto");
    selectChange(tree, "F/KL override", "off");
    selectChange(tree, "Safespot", "on");

    expect(patches).toEqual([
      { bankSeconds: null },
      {
        prayerMode: "none",
        prayerPotionSets: null,
        prayerPotionDoses: null,
        altarSeconds: null
      },
      { prayerPotionSets: null, prayerPotionDoses: presentation.controls.prayerDosesValue },
      { altarSeconds: null },
      { foodCount: null },
      { foodPerKillOverride: null },
      { safespot: true }
    ]);
  });

  it("applies only an active recommendation patch and keeps the disabled path inert", async () => {
    const base = await fixture();
    const recommendationPatches: Array<Partial<CombatSetupFormState["trip"]>> = [];
    const active = TripPane({
      hidden: false,
      model: {
        presentation: {
          ...base,
          recommendation: { ...base.recommendation, canApply: true, patch: { potionSets: 7 } }
        },
        modeledKillsPerTripRange: null
      },
      actions: {
        updateTrip: () => undefined,
        applyRecommendation: (patch) => recommendationPatches.push(patch),
        openRisk: () => undefined
      }
    });
    const activeButton = elements(active).find(
      (element) =>
        element.type === "button" &&
        (element.props as { children?: ReactNode }).children === "Apply recommendation"
    );
    (activeButton!.props as { onClick(): void }).onClick();

    const inactive = TripPane({
      hidden: false,
      model: {
        presentation: {
          ...base,
          recommendation: { ...base.recommendation, canApply: false, patch: { potionSets: 99 } }
        },
        modeledKillsPerTripRange: null
      },
      actions: {
        updateTrip: () => undefined,
        applyRecommendation: (patch) => recommendationPatches.push(patch),
        openRisk: () => undefined
      }
    });
    const inactiveButton = elements(inactive).find(
      (element) =>
        element.type === "button" &&
        (element.props as { children?: ReactNode }).children === "Apply recommendation"
    );
    (inactiveButton!.props as { onClick(): void }).onClick();

    expect(recommendationPatches).toEqual([{ potionSets: 7 }]);
  });
});

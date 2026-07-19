import { renderToStaticMarkup } from "react-dom/server";
import { createGeneratedRuntimeContext } from "../adapters/generated";
import { ActiveSetupResetReview } from "../app/components/shell/active-setup-reset-review";
import {
  ACTIVE_SETUP_RESET_NOOP_NOTICE,
  INITIAL_ACTIVE_SETUP_RESET_STATE,
  openActiveSetupReset
} from "../app/state/active-setup-reset";
import {
  DEFAULT_FORM_STATE,
  normalizeFormState,
  savedSetupFromForm,
  switchCombatStyleLoadout
} from "../app/state/ui-state";

const { context } = createGeneratedRuntimeContext();

function reviewState() {
  const ranged = switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged");
  const form = normalizeFormState({
    ...ranged,
    monsterId: "rock_crab",
    levels: { ...ranged.levels, ranged: 87 },
    weaponId: "yew_longbow",
    ammoId: "addy_arrow",
    perStyleLoadouts: {
      ...ranged.perStyleLoadouts,
      ranged: {
        ...ranged.perStyleLoadouts.ranged,
        weaponId: "yew_longbow",
        ammoId: "addy_arrow"
      }
    },
    trip: { ...ranged.trip, foodKey: "swordfish" },
    plannerTargets: { ...ranged.plannerTargets, ranged: 92 }
  });
  return openActiveSetupReset(
    INITIAL_ACTIVE_SETUP_RESET_STATE,
    savedSetupFromForm(form),
    context.gameData
  );
}

describe("active setup reset review", () => {
  it("renders an accessible ordered current-to-default review with fixed protected-state copy", () => {
    const markup = renderToStaticMarkup(
      <ActiveSetupResetReview state={reviewState()} onConfirm={() => {}} onCancel={() => {}} />
    );

    expect(markup).toContain('aria-label="Reset active setup review"');
    expect(markup).toContain('role="status" aria-live="polite"');
    expect(markup).not.toContain('role="alert"');
    expect(markup).toContain("Rock Crab");
    expect(markup).toContain("Ranged remains selected");
    expect(markup).toContain("Melee, Ranged and Magic");
    expect(markup).toContain("Saved setups, unrelated custom setups, Cannon preferences");
    expect(markup).toContain("Planner adjust incompatible XP or unlocked targets");
    expect(markup).toContain("Reset active setup</button>");
    expect(markup).toContain("Cancel</button>");

    const orderedGroups = [
      "Player levels",
      "Loadouts and equipment",
      "Trip and supplies",
      "Planner targets"
    ];
    let previousIndex = -1;
    for (const label of orderedGroups) {
      const index = markup.indexOf(label);
      expect(index, `missing or out-of-order group ${label}`).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
    expect(markup).toContain("Yew longbow");
    expect(markup).toContain("Magic shortbow");
    expect(markup).not.toContain("yew_longbow");
    expect(markup).not.toContain("index-sim:rewrite-setup");
    expect(markup).not.toContain("perStyleLoadouts");
  });

  it("renders no Confirm action for the fixed no-op state", () => {
    const markup = renderToStaticMarkup(
      <ActiveSetupResetReview
        state={{ ...INITIAL_ACTIVE_SETUP_RESET_STATE, notice: ACTIVE_SETUP_RESET_NOOP_NOTICE }}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    expect(markup).toContain(ACTIVE_SETUP_RESET_NOOP_NOTICE);
    expect(markup).toContain('aria-label="Reset active setup review"');
    expect(markup).not.toContain("Reset active setup</button>");
    expect(markup).not.toContain("Cancel</button>");
  });
});

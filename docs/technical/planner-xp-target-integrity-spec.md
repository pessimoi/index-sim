# Planner XP and target integrity specification

Status: implemented on 2026-07-19.

## Purpose

Make every Planner skill-row value mean what the next calculation will use.
`Current XP` must expose its level-dependent valid interval and an explicit
automatic mode instead of displaying `0` while the domain silently substitutes
the current level's XP floor. Targets below the live level and locked targets
must likewise show their effective planning meaning.

## Prior behavior and problem

- `src/app/state/planner.ts` persists version-1 Planner UI state and defaults
  every `currentXp` entry to `0`.
- `src/app/components/panes/planner-pane.tsx` renders that stored `0` directly
  in each `<Skill> current XP` field, with generic bounds `0` to 200,000,000.
- `src/app/view-models/planner.ts` forwards the raw current-XP map as
  `PlannerOptions.startXp`.
- `src/domain/planner/index.ts` clamps each supplied start XP to the XP interval
  implied by the live player level. At Attack 60, visible `0` therefore becomes
  `xpAt(60)` inside the calculation without a user-facing explanation.
- The view model also raises every unlocked target with
  `max(liveLevel, storedTarget)`, while the target input continues to display
  the lower stored number.
- Locked skills correctly use the live level as their effective target, but the
  target field does not state that its stored value is currently inactive.
- Planner already has an explicit draft-versus-computed `Recompute plan`
  boundary. This goal preserves that lifecycle and makes the draft's next-
  calculation semantics visible.

## Implemented contract

- `plannerXpBounds()` is the canonical level-normalized inclusive XP interval
  owner. Level 99 now retains explicit XP through 200,000,000 in both Planner
  domain start-XP paths.
- Planner UI state remains version 1: stored `0` is Auto, explicit XP outside
  the current live-level interval resets to Auto, unlocked lower targets rise
  to the live level and locked saved targets remain unchanged.
- One pure reconciliation result returns deterministic adjustments in canonical
  skill order and preserves object identity for a no-op. App persistence keeps
  using the existing recovery-aware `planner-ui` effect.
- The adapter always passes concrete effective start XP and targets. Structured
  skill rows render Auto as an optional field, expose level-dependent bounds
  and descriptions, show locked saved targets as inactive and disable level-99
  targets at effective 99.
- The Planner controller reconciles both draft and last-computed snapshots
  before creating a new Worker source. Explicit Recompute remains the only
  draft commit, dirty output is labelled as last-recomputed and stale
  pre-reconciliation results cannot become fresh.
- Focused Planner suites pass 43/43, parity remains green, all 19 goldens pass
  and production-preview browser coverage exercises manual levels, level 99,
  saved setup Load/Undo, Hiscores Apply, setup Import/Undo and shared
  Load/Undo.

## Feature-inventory and persistence boundary

Planner remains an existing `Valmis` workflow. This goal is a semantic-
integrity correction within its current state, adapter and calculation
boundaries.

Keep `PLANNER_UI_VERSION = 1`. Stored `currentXp = 0` already behaves as the
current-level floor in the domain, so defining zero as the explicit `Auto`
sentinel preserves the effective meaning of every existing v1 record. No
rewrite of legacy `sim_planner_v1` is added; D-048 remains authoritative.

## Goals

- Define `0` as a documented persisted Auto sentinel and never present it as
  literal zero XP above level 1.
- Resolve the valid Current XP interval from the live level using the domain's
  canonical XP table.
- Show both the next-Recompute effective start XP and the effective target for
  every skill.
- Reconcile explicit XP that becomes incompatible after a level/setup/Hiscores
  change without silently clamping it.
- Reconcile unlocked targets below the live level to that live level.
- Explain locked targets as inactive while preserving the user's stored target
  for a later unlock.
- Preserve explicit Recompute, Planner worker execution, search/scoring,
  training formulas and v1 storage shape.

## Non-goals

- Do not change the XP table, target cap 99, Planner metric, gear pool,
  requirement, unlock, Trip-policy, scoring or search algorithm.
- Do not calculate the plan on every draft edit. `Recompute plan` remains the
  only Planner-draft commit action.
- Do not import or migrate archived legacy Planner state.
- Do not infer current XP from a Hiscores level-only response. The current
  Hiscores contract supplies levels, not XP totals.
- Do not add skill levels above 99 or a historical XP tracker.
- Do not apply Planner targets, levels or XP back to the live combat setup.
- Do not store formatted strings, `null`, validation messages or effective
  derived values in Planner persistence.
- Do not duplicate the XP curve in app state or presentation modules.

## Canonical XP bounds

Keep `xpAt(level)` in `src/domain/planner` as the single XP-table owner and add
or export a bounded helper equivalent to:

```ts
export interface PlannerXpBounds {
  level: number;
  min: number;
  max: number;
}

export function plannerXpBounds(level: number): PlannerXpBounds {
  const normalizedLevel = Math.max(1, Math.min(99, Math.floor(level)));
  return {
    level: normalizedLevel,
    min: xpAt(normalizedLevel),
    max: normalizedLevel < 99 ? xpAt(normalizedLevel + 1) - 1 : 200_000_000
  };
}
```

Level 99 accepts the game's retained 200,000,000 XP cap. It has no further
training target, but accepting and displaying real level-99 XP avoids another
visible-versus-effective mismatch. Replace the domain's existing level-99
upper-bound clamp with this helper in both internal starting-XP paths.

The helper is pure and does not import app state. App/view-model code imports
it from the domain; no copied XP constants or lookup tables are allowed.

## Persisted state semantics

`PlannerUiState.currentXp[skill]` keeps its current integer schema from 0 to
200,000,000:

- `0` means `Auto: use xpAt(current live level)`;
- a positive value means explicit XP and is valid only when it lies within
  `plannerXpBounds(current live level)`; and
- a positive value outside that live interval is schema-valid but context-
  incompatible and must be reconciled to Auto before it becomes the next
  computed Planner snapshot.

This sentinel is intentionally app-state-specific. Public `PlannerOptions`
does not acquire an Auto sentinel; the adapter resolves Auto to a concrete XP
number before calling the domain.

`targetLevels[skill]` remains an integer from 1 to 99. An unlocked target must
be at least the current live level. A locked skill's stored target remains
unchanged because it is a reusable preference; its effective target is the
current live level.

## Context reconciliation contract

Add one pure state helper, for example:

```ts
interface PlannerProgressAdjustment {
  skill: PlannerSkill;
  field: "currentXp" | "targetLevel";
  previous: number;
  next: number;
  reason: "xp-outside-current-level" | "target-below-current-level";
}

function reconcilePlannerProgressWithLevels(
  state: PlannerUiState,
  levels: Readonly<Record<PlannerSkill, number>>
): { state: PlannerUiState; adjustments: readonly PlannerProgressAdjustment[] };
```

For each skill in canonical `PLANNER_SKILLS` order:

- keep `currentXp = 0` as Auto;
- keep an explicit Current XP inside the current level's inclusive bounds;
- replace an explicit Current XP outside those bounds with `0` (Auto);
- keep a target for a locked skill even when it is below the current level;
- raise an unlocked target below the current level to the current level; and
- return the original state reference when nothing changes.

Resetting incompatible XP to Auto is preferable to clamping to the nearest
boundary because it does not pretend the user entered an exact XP total they
did not provide. The adjustment is visible and deterministic.

Run reconciliation:

1. after the current setup and persisted Planner state are both available;
2. whenever live Attack/Strength/Defence/Ranged/Magic levels change through
   manual input, setup replacement, saved setup Load, shared setup Load,
   Hiscores Apply or Undo; and
3. before `recompute()` captures a Planner computed snapshot as a final guard.

The first two paths update and persist the Planner draft through its existing
versioned effect. They must not write while local-state recovery blocks
`planner-ui`. The final Recompute guard uses the reconciled value and updates
the draft if needed before starting work.

When adjustments occur, publish one bounded Planner-local notice such as:

`Planner inputs adjusted for current levels: Attack XP uses Auto; Strength target is now 65.`

List at most three changes and then `N more`. This notice is presentation state,
not persisted. It clears after the user edits an affected field or completes a
Recompute. It must not use raw state paths.

## Effective-value adapter contract

Add pure helpers to resolve a reconciled state:

```ts
function effectivePlannerStartXp(level: number, storedXp: number): number;
function effectivePlannerTarget(level: number, storedTarget: number, locked: boolean): number;
```

`effectivePlannerStartXp` returns the level floor for Auto and the explicit
value only when it is in bounds. Its defensive out-of-bounds path also returns
the floor; it does not silently make the UI valid, so reconciliation tests are
still required.

`createPlannerDomainAdapter()` must build `options.startXp` and
`options.targets` from these helpers. The adapter's returned presentation state
remains the normalized Planner draft; it does not overwrite persistence.

The domain continues to validate/clamp programmatic `PlannerOptions` because it
is a public calculation boundary. App-owned calls must already pass concrete,
valid values, and focused tests assert equality rather than relying on that
defensive clamp.

## Planner skill-row view model

Replace the pane's parallel `currentLevels` plus raw-map interpretation with a
structured row model built in `src/app/view-models/planner.ts`:

```ts
interface PlannerSkillInputViewModel {
  skill: PlannerSkill;
  label: string;
  currentLevel: number;
  currentXp: number | null;
  currentXpMode: "auto" | "explicit";
  currentXpMin: number;
  currentXpMax: number;
  effectiveStartXp: number;
  storedTargetLevel: number;
  effectiveTargetLevel: number;
  targetMin: number;
  locked: boolean;
  xpDescription: string;
  targetDescription: string;
}
```

Map persisted `0` to `currentXp: null` for rendering only. Required copy:

- Auto XP: `Next plan starts at <XP>, the level <L> floor.`
- Explicit XP: `Next plan starts at the entered XP within level <L>.`
- Unlocked target: `Next plan targets level <T>.`
- Locked target: `Locked at current level <L>; saved target <T> is not used.`

The wording says `Next plan` because draft edits do not affect the currently
displayed plan until Recompute. If the pane also shows the last computed plan,
retain its current `pending` status and add a compact `Current output uses the
last recomputed inputs` note while dirty. Do not label a draft value as current
output.

## Pane interaction contract

For each skill row:

- render `Current XP` with `OptionalNumberField`;
- pass level-dependent `min`/`max`, the explicit value or `null`, a placeholder
  such as `Auto: 273742`, and reset label `Use level floor`;
- map `null` from blur/Enter/Reset back to persisted sentinel `0`;
- render the `xpDescription` through the numeric field's accessible
  description contract;
- render Target with `NumberField`, `min=currentLevel`, `max=99`;
- disable Target while the skill is locked, preserving the stored target;
- render `targetDescription` even when disabled; and
- keep the current level visibly adjacent to both inputs.

When the user unlocks a skill whose preserved target is below the live level,
reconcile the target to the live level immediately and include it in the local
adjustment notice. When locking, preserve the current stored target.

At level 99, Target is 99 and disabled because no higher target exists,
independent of the user's lock toggle. The lock preference itself may remain
editable/persisted, but copy must state that the skill is already at the
maximum target.

The [shared numeric-draft specification](numeric-input-draft-validation-spec.md)
is a prerequisite for polished editing and error presentation. If
implementation order requires this Planner goal to land first, use the same
no-silent-clamp semantics locally and remove the temporary duplication when the
shared field goal lands.

## Calculation lifecycle contract

- Editing Current XP, target or lock updates the persisted draft and changes
  Planner status to `pending` exactly as current Planner edits do.
- No worker starts until `Recompute plan`.
- Recompute captures one reconciled normalized state and passes concrete
  effective start XP/targets to the existing one-shot Worker request.
- A live form level change automatically rebuilds using the last computed
  Planner snapshot under the existing controller behavior. Before that build,
  reconcile the computed snapshot too: incompatible explicit XP becomes Auto
  and an unlocked lower target becomes current level. The draft receives the
  same reconciled state so UI and output cannot diverge.
- Do not allow an old worker result built from pre-reconciliation levels/state
  to become fresh. Existing source-reference freshness remains authoritative.

This live-level behavior is the one bounded controller change: keeping an old
computed `currentXp` after its level changes would recreate the mismatch even
if the draft UI were correct.

## Accessibility and responsive behavior

- Current XP and Target keep unique programmatic labels including skill name.
- Descriptions are associated through `aria-describedby`; Auto is not conveyed
  by placeholder alone.
- Adjustment notices use a polite status and do not announce again on every
  Planner render.
- Locked/level-99 disabled targets retain readable explanation and do not rely
  on opacity alone.
- Large ungrouped XP input text must fit or scroll inside its input without
  widening the skill grid. Descriptions wrap below controls on narrow screens.
- Keyboard users can Reset XP to Auto, unlock a skill and edit its target in
  logical DOM order.

## Implementation sequence

1. Add domain tests for XP bounds, including levels 1, 98 and 99.
2. Add state tests for Auto preservation, explicit-XP invalidation, target
   raising, lock preservation, deterministic adjustments and no-op identity.
3. Update the domain adapter to pass concrete effective values and prove they
   equal the visible view model.
4. Add structured skill-row view models and pane presentation.
5. Add draft/computed reconciliation to the Planner controller/composition
   boundary without changing explicit Recompute.
6. Add browser coverage for manual level changes, Hiscores Apply, setup load,
   Auto reset, lock/unlock and reload persistence.

Likely implementation files:

- `src/domain/planner/index.ts`;
- `src/app/state/planner.ts`;
- `src/app/view-models/planner.ts`;
- `src/app/controllers/use-planner-calculation.ts`;
- `src/app/components/panes/planner-pane.tsx`;
- `src/app/App.tsx` for the persisted draft/reconciliation bridge;
- `src/app/styles.css`; and
- focused Planner state, adapter, controller and Playwright tests.

## Required tests and validation

Tests must prove:

- v1 stored zero renders as Auto and passes the exact live-level XP floor;
- level 1 Auto resolves to zero without ambiguity;
- explicit XP at both inclusive boundaries is retained;
- explicit XP outside the interval resets to Auto with a bounded adjustment
  notice and is never merely clamped;
- level 99 accepts explicit XP through 200,000,000 and targets only 99;
- an unlocked target below current is raised visibly and persisted;
- a locked target is preserved but its effective target/output is current
  level; unlocking reconciles it before Recompute;
- manual level edit, Hiscores Apply, setup import/load/share and their Undo
  paths cannot leave visible draft and effective adapter values divergent;
- dirty/current-output copy preserves the explicit Recompute contract;
- stale worker output from pre-reconciliation inputs is rejected; and
- v1 storage round trips remain compatible without migration or a version
  bump.

Run at minimum:

```sh
npm run test -- src/tests/planner.test.ts src/tests/planner-ui-state.test.ts src/tests/planner-ui-adapter.test.ts src/tests/planner-calculation-controller.test.ts
npm run typecheck
npm run architecture:check
npm run test:golden
npm run test:e2e -- --workers=1 --grep "Planner|Hiscores|setup"
npm run build
git diff --check
```

Run the full functional browser suite because live level and setup actions feed
Planner reconciliation. Existing golden results for semantically equivalent
valid inputs must remain unchanged; add an explicit level-99 fixture if current
goldens do not cover it.

## Acceptance criteria

- No Planner row displays `0` while the next calculation silently uses a
  non-zero level floor.
- Every skill row states its next effective start XP and target.
- Explicit XP is accepted only inside the live level interval; incompatible XP
  becomes visible Auto with an adjustment notice.
- Unlocked targets cannot remain visibly below current level; locked targets
  remain stored but clearly inactive.
- Draft and last-computed behavior remains explicit, race-safe and Worker-
  backed.
- Planner persistence stays version 1 and existing zero values retain their
  prior effective meaning.
- No XP curve, search, scoring, gear, Trip or output formula changes beyond the
  corrected level-99 XP upper bound.
- Focused, architecture, type, golden, build, full browser and diff gates pass.

## Open questions

None block implementation. If a future Hiscores provider supplies exact XP,
populating explicit Current XP requires a separate API/schema/privacy decision;
this goal must not infer it from levels alone.

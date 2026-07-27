# Cannon pane extraction specification

- Status: implemented
- Date: 2026-07-13
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

The Cannon pane is the first low-coupling Phase 3 feature boundary in the
`App.tsx` composition-root refactor. Its output already comes from the typed
simulation view model, and its mutations are limited to current-monster cannon
settings plus an explicit Trip sparse link.

This goal moves presentation derivation and the complete Cannon section into a
pure component. `App` keeps persisted setup state, schema validation, current
monster selection and form updates.

## Verified pre-refactor ownership

- `src/domain/trip` owns `CannonSettings`, `CannonOverlayResult`, Cannon supply,
  trip and XP calculations.
- `src/app/view-models/simulation.ts` supplies the complete calculated
  `SimulationViewModel`, including combat accuracy, effective rates, trip
  sparse output and optional Cannon output.
- `src/app/state/ui-state.ts` owns the per-monster Cannon schema, defaults and
  persistence inside the rewrite setup.
- `App` owns the selected monster, live form, per-monster map and the mutation
  bridges that preserve linked Trip sparse values.
- Shared `NumberField` and `MetricList` components own numeric normalization and
  metric DOM rendering.

## Current behavior to preserve

### Component boundary

Create `src/app/components/panes/cannon-pane.tsx`. It may import React types,
the shared fields/presenters, `formatNumber`, `CannonOverlayResult` and a small
explicit presentation input. It must not import adapters, storage, app state
schemas, calculation functions, `App` or browser globals.

`App` passes:

- `hidden`, current enabled/targets/respawn values and whether a custom row
  exists;
- whether Cannon and Trip sparse assumptions are linked;
- optional calculated Cannon output plus the already calculated effective
  XP/hr, effective net GP/hr, normal hit chance and Trip sparse max K/hr;
- Trip sparse enabled and inventory Cannon-reserve facts;
- five actions: toggle enabled, change targets, change respawn, toggle sparse
  link and reset current-monster Cannon.

The component owns only UI-specific status, notice, sparse summary, reserve
summary, K/hr uplift and formatted metric-row derivation. It receives no full
`SimulationContext`, form, monster map or React setter.

### DOM and presentation compatibility

The extraction preserves exactly:

- the `section.cannon-strip`, `aria-label="Cannon"` and `hidden` behavior;
- heading, status-pill values/classes and all visible copy;
- checkbox labels, disabled behavior and callback timing;
- `NumberField` labels, min/max values and normalization;
- reset button label and custom-row disabled state;
- Cannon sparse status role/label/warning class;
- the enabled and disabled metric sets, their order, labels, values, precision,
  tones and CSS wrappers.

The pane must not change a calculation request, Cannon defaults, Trip sparse
link rules, storage timing, selector or screenshot baseline.

### Caller-owned mutations

`App` retains:

- `CannonSettingsSchema.parse()` while patching the current monster;
- deletion of the current-monster custom Cannon row on reset;
- the rule that changing targets/respawn also updates Trip only when the old
  Cannon/Trip sparse assumptions were linked;
- linking Trip sparse with the current Cannon targets and respawn;
- all setup persistence, sharing, migration and active-assumption reset logic.

The pane callbacks use primitive values. It cannot patch the per-monster map or
construct `CombatSetupFormState` fragments.

## Required contract

Exact names may vary, but the prop boundary must remain equivalently narrow:

```ts
interface CannonPaneProps {
  hidden: boolean;
  enabled: boolean;
  targets: number;
  respawnSeconds: number;
  tripSparseLinked: boolean;
  hasCustomSettings: boolean;
  output: CannonOverlayResult | null;
  effectiveXpPerHour: number;
  effectiveNetGpPerHour: number;
  hitChance: number;
  tripSparseEnabled: boolean;
  tripSparseMaxKph: number;
  cannonReserveActive: boolean;
  onEnabledChange(enabled: boolean): void;
  onTargetsChange(targets: number): void;
  onRespawnChange(respawnSeconds: number): void;
  onTripSparseLinkedChange(linked: boolean): void;
  onReset(): void;
}
```

Do not pass a generic `actions` bag or the complete simulation view model. The
explicit contract makes accidental ownership growth visible in review.

## Tests and acceptance

A focused static-render contract test must cover disabled and enabled output,
copy, metric precision/order, warning/status classes, control values and the
absence of extra wrappers. Existing Playwright Cannon coverage remains the
interaction and persistence authority.

Required validation:

```sh
npm run test -- src/tests/cannon-pane.test.ts src/tests/*-view-model.test.ts src/tests/trip-loot-supply.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "cannon"
npm run verify
git diff --check
```

## Open questions

None for the Cannon boundary. A later Trip pane extraction may colocate a
shared sparse-assumption presentation model, but Cannon-to-Trip mutations must
remain explicit actions rather than shared hidden state.

## Implementation evidence

- `components/panes/cannon-pane.tsx` owns the complete unchanged Cannon section,
  its presentation-only status/notice/summary derivation and enabled/disabled
  metric rows behind explicit primitive and calculated props.
- `App` retains schema-validated per-monster patch/delete behavior, Trip sparse
  synchronization and setup persistence; the pane imports no app state,
  adapter, storage, calculation or browser owner.
- Three static-render contract tests cover section/control DOM, disabled,
  active, respawn-bound, idle and divergent-sparse states plus exact metric
  order/precision/tones. The required focused pane/domain suites pass 138/138.
- The targeted production-preview Cannon path passes inside the combined 4/4
  gate, and the complete Chromium suite passes 77/77 including reload and reset.
- Together with Goal 9, architecture passes at 81 source modules / 68
  client-reachable modules without cycles or exceptions, and `App.tsx` is 7,842
  lines.
- Full `npm run verify` passes 694 unit tests, 19 explicit goldens and all
  non-network release gates. No CSS, persisted schema, domain formula,
  generated data or golden fixture changed in this extraction.

## Subsequent behavior change

D-100 later replaces the preserved legacy sparse hard-idle formula with finite
independent-spawn occupancy, adds comparison-only `Cannon only DPS` and aligns
the mixed checkbox/number/button control row. This extraction document remains
the historical component-ownership record; the current calculation, cost,
status and presentation truth belongs in
[cannon-finite-occupancy-spec.md](cannon-finite-occupancy-spec.md), with D-100 as
the accepted decision and `ui-parity-spec.md` as the broader workflow owner.

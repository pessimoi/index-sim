# Loot and Trip pane and view-model refactor specification

- Status: implemented
- Date: 2026-07-14
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

Extract the complete Loot and Trip presentation families from
`src/app/App.tsx`, move their feature-only presentation derivations to direct
view-model owners, and split the shared simulation-input adapter needed by the
Loot optimizer out of the cross-feature simulation module without changing
behavior.

This is an ownership refactor. It preserves the accepted Trip/loot/supply
domain, versioned setup and per-monster loot state, current form mutation,
share/import/recovery behavior, deterministic optimizer, price-history context,
conditional-drop policy, Active assumptions Reset/Undo flows, Cannon sparse
linking, Risk invalidation and fresh-result bridges, DOM, copy, styling,
accessibility and browser contracts. The phased parent remains
[app-composition-root-refactor-spec.md](app-composition-root-refactor-spec.md),
and D-093 remains the accepted composition-root decision.

## Why Loot and Trip form one Phase 3F

Loot and Trip are separate visible panes, but their current presentation inputs
are one tightly coupled result family:

- `src/domain/trip` owns one `TripLootSupplyResult` containing loot value,
  inventory, food, prayer, potion, incoming-damage, Cannon, supply and banking
  outcomes;
- loot action changes immediately alter trip capacity, prayer XP, alch casts,
  supply economics, effective kills per hour and net GP;
- Trip controls live inside the versioned `CombatSetupFormState`, while loot
  preferences and settings are versioned per-monster state consumed by the same
  simulation path;
- the always-visible ownership summaries and negative-net-GP guidance bridge
  both panes; and
- Stats, Compare, Duel, Planner, Risk, setup sharing and Active assumptions
  already consume the same source objects or derived result.

Extracting only one pane would leave its main display derivations and imports in
App for the other. Phase 3F therefore moves two pure pane surfaces and two
direct view-model families in one bounded goal. It does **not** move the
persisted state cells, setup form or storage/recovery orchestration into a new
feature store. Those sources remain composition-root inputs because several
independent consumers need them.

Economy and Settings were intentionally left to a separate later choice because
they combine PriceSet transfer, manual-price overlays, shared/local history,
legacy review and recovery state rather than Trip-domain presentation. That
choice is now specified independently as
[Phase 3G](economy-settings-pane-refactor-spec.md).

## Current evidence

At specification time, after implemented Risk Phase 3E:

- `src/app/App.tsx` is 5,608 lines and owns 46 React state cells;
- the complete Loot landmark occupies 429 lines, currently App lines
  3,817-4,245;
- the complete Trip landmark occupies 668 lines, currently App lines
  4,246-4,913;
- roughly 160 lines of Trip/Loot presentation derivation live around App lines
  2,410-2,550, while mutation, reset, optimizer and recommendation handlers
  occupy the surrounding composition region;
- App owns `lootPrefsByMonster`, `lootSettingsByMonster` and the transient
  `lootNotice`, plus two versioned persistence effects and current-monster
  selection/cleanup;
- setup/share/import/recovery and global Undo can replace or restore both loot
  states, so they are not pane-local state;
- every Trip field is part of `CombatSetupFormState.trip`, which is normalized
  by `CombatSetupFormSchema`, stored in the versioned rewrite setup and included
  in custom setups, Duel snapshots and shareable setup payloads;
- `src/app/view-models/simulation.ts` is 1,113 lines. It still owns the Loot row,
  action-impact, nested-row, value-composition, price-history and optimizer
  contracts/builders in addition to the cross-feature simulation composition;
- `createFullSimulationInputForForm()` remains in `simulation.ts` and is also
  imported by the calculation-task Risk dispatch, making a direct Loot owner
  require a small cycle-free input-adapter leaf;
- App derives actionable versus conditional rows, high-alch/overhead policy,
  quick-navigation summaries, every Trip control mode/value, recommendation
  labels and all grouped Trip metrics;
- the Loot pane contains current policy controls, Reset/Optimize, summary
  metrics, money warnings, value composition, action-impact tables, local price
  history, nested rows and the collapsed conditional-drop group;
- the Trip pane contains food/banking/potion/prayer/safespot/protection/scarce
  spot/antifire/antipoison/recoil/inventory controls, recommendation Apply and
  eight grouped output sections;
- the full repository gate passes 54 files / 719 unit tests and 19 goldens;
- the functional Chromium suite passes 77/77, including twelve focused
  Trip/Loot mutation and presentation workflows plus a numeric snapshot case;
  and
- the read-only Darwin visual suite passes 20/20 against 31 reviewed PNGs,
  including desktop/mobile Trip and Loot states.

The domain and persistence boundaries are sound. This phase must not combine
their structural extraction with product, formula, state-schema or styling
changes.

## Goals

- Make Loot and Trip independently reviewable pure pane owners.
- Give Loot row/action/value/optimizer presentation a direct feature view-model
  owner instead of leaving it in `simulation.ts`.
- Give Trip control modes, display summaries, recommendation presentation and
  grouped output a direct DOM-free view-model owner instead of App-local
  derivation.
- Extract the current simulation-input mapping into one small leaf so the
  simulation composer, Loot optimizer and Risk calculation task can use direct
  imports without a cycle or compatibility barrel.
- Reduce App to live source ownership, normalized state mutation, persistence,
  recovery/share integration, cross-pane navigation and global Undo/status
  composition.
- Preserve every numeric, state, DOM, copy, callback and visual contract.
- Add focused pane and view-model tests before or with the mechanical move.
- Leave Economy and Settings boundaries unchanged for a later goal.

## Non-goals

- No change to `src/domain/trip`, `TripPolicy`, `TripLootSupplyInput`,
  `TripLootSupplyResult`, incoming-damage descriptors, loot valuation,
  inventory, food, prayer, potion, Cannon, scarce-spot, banking, XP or economy
  formulas.
- No change to `CombatSetupFormSchema`, its Trip fields/defaults/bounds,
  `formToTripPolicy()`, normalization, per-style loadouts or saved/custom setup
  envelopes.
- No change to `index-sim:loot-prefs` version 1,
  `index-sim:loot-settings` version 1, schemas, cleanup, storage keys,
  persistence timing or local-state recovery.
- No change to shareable setup, setup import/export, legacy migration, Duel
  snapshot/diff or current-monster ownership.
- No new feature store, context provider, reducer, state library or controller
  that becomes a second owner of form or persisted loot state.
- No automatic reset of per-monster choices when switching tabs or targets.
- No change to the deterministic Loot optimizer, its canonical-default start,
  available-action search, 30-iteration cap, tie behavior, messages or Undo.
- No change to D-072/D-089 conditional rows: they remain source-visible,
  collapsed by default, locked to `Skip` and excluded from value, inventory,
  alch and prayer calculations.
- No change to D-084 ordinary-casket opened-content valuation, nested rows or
  the absence of a `Sell unopened` action.
- No change to local/shared price history, item provenance or market
  dependency policy. Loot history remains display-only context.
- No change to Active assumptions categorization, Review targets, safely
  resettable targets, global one-step Undo or status copy.
- No change to Cannon-to-Trip sparse linking or Cannon pane ownership.
- No change to Risk analysis inputs, source-reference invalidation, stale
  retention or fresh-result rules.
- No new Worker, async calculation, persistence, provider, network, backend,
  auth, account, database, deployment or generated-data behavior.
- No copy, precision, order, semantic role, accessible name, focus, disclosure,
  class, stylesheet or visual-baseline change.

If extraction exposes an existing behavioral defect, record it as a follow-up.
Do not silently repair it in this ownership phase.

## Preserved sources of truth

| Concern                                                          | Owner after this phase                             |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| Trip/loot/supply formulas and domain results                     | `src/domain/trip`                                  |
| Composed expected-value result                                   | `src/domain/simulation`                            |
| Form Trip schema, normalization and request mapping              | `src/app/state/ui-state.ts`                        |
| Per-monster loot preference schema/state helpers                 | `src/app/state/loot-prefs.ts`                      |
| Per-monster loot settings schema/state helpers                   | `src/app/state/loot-settings.ts`                   |
| Shared form-to-domain simulation input mapping                   | New `src/app/view-models/simulation-input.ts`      |
| Loot row/action/value/optimizer view models                      | New `src/app/view-models/loot.ts`                  |
| Trip control and presentation view model                         | New `src/app/view-models/trip.ts`                  |
| Loot landmark and tables                                         | New `src/app/components/panes/loot-pane.tsx`       |
| Trip landmark, controls and grouped output                       | New `src/app/components/panes/trip-pane.tsx`       |
| Persisted loot state, setup form and recovery/share replacement  | `src/app/App.tsx` plus current state/controllers   |
| Global status/Undo, Active assumptions and cross-pane navigation | `src/app/App.tsx`                                  |
| Stats/Compare/Duel/Planner/Risk consumption                      | Existing direct feature owners and App composition |

`SimulationViewModel` remains the current composed UI-facing result. This phase
changes where Loot fields are built and typed, not their shape or numeric
authority.

## Target module map

### Shared simulation-input leaf

Create `src/app/view-models/simulation-input.ts` as a DOM-free adapter leaf. Move
the current form/context-to-domain-input mapping from `simulation.ts` without
changing it:

- `fullSimulationInputFor()` or an equivalently narrow internal helper;
- the public `createFullSimulationInputForForm()` contract used by the Risk
  calculation task; and
- the smallest prepared `TripLootSupplyInput` builder required by the Loot
  optimizer.

The leaf preserves exactly:

- `formToSimulationRequest()` and `formToTripPolicy()` output;
- per-monster high-alch override precedence over inherited Trip `alching`;
- talisman spot and manual/automatic overhead mapping;
- ring-of-wealth and the current `legendsComplete: true` product assumption;
- per-monster Cannon selection; and
- caller-supplied current-monster loot preferences.

It may import domain types/functions and app state schemas/helpers. It must not
import React, DOM, storage, adapters, components, `App`, the broad simulation
view model or the new Loot/Trip pane modules.

`src/app/calculation-task.ts` changes only its mechanical direct import. The
`risk-analysis` request/result/Worker behavior is unchanged.

### Loot view model

Create `src/app/view-models/loot.ts`. Move the current Loot-specific contracts
and pure builders out of `simulation.ts`:

- `LootActionImpactViewModel`;
- `LootValueCompositionRowViewModel` and
  `LootValueCompositionViewModel`;
- `LootExpandedRowViewModel`;
- `LootDropValueDetailViewModel`;
- `LootPriceHistoryItemContext` and
  `LootPriceHistoryContextViewModel`;
- `LootDropRowViewModel`;
- `LootOptimizeResult`;
- available-action ordering/labeling;
- row state, effective EV, nested rows, value details and price-history context;
- action-impact construction;
- value-composition construction;
- deterministic optimization; and
- the narrow pane presentation builder described below.

Expose one composed contract instead of making App reconstruct the family:

```ts
export interface LootPresentationViewModel {
  rows: LootDropRowViewModel[];
  actionableRows: LootDropRowViewModel[];
  conditionalRows: LootDropRowViewModel[];
  summary: {
    defaultEffectiveNetGpPerHour: number;
    currentDeltaNetGpPerHour: number;
    overrideCount: number;
    valueComposition: LootValueCompositionViewModel;
  };
  highAlchEnabled: boolean;
  overheadMode: "auto" | "manual";
  overheadValue: number;
  derivedOverheadSec: number;
  policySummary: string;
}
```

The exact name may vary, but the direct owner must expose actionable and
conditional row partitions, policy presentation and summary as one result.
App must not keep duplicate filters or formatter logic.

Move the fixed Loot presentation options and labels here or to a narrow direct
leaf if needed:

- High alch enabled/disabled;
- overhead auto/manual;
- talisman underground/overground; and
- the exact `Loot`, `Skip`, `Bury`, `Alch`, `Unid` and `Value` labels.

`createSimulationViewModel()` imports the direct builder and preserves its
existing `topLoot`, `lootRows` and `lootSummary` fields. Existing consumers do
not receive a compatibility re-export from `simulation.ts`; update them to
direct type/function imports where applicable.

The module may run the same synchronous domain evaluations currently required
for per-action impacts and optimization. It must not read browser state, start
a Worker, mutate inputs or format DOM.

### Trip view model

Create `src/app/view-models/trip.ts` as the direct owner of Trip presentation.
It accepts only the current form fields it needs plus the existing
`TripLootSupplyResult`. It must not rebuild or recalculate the domain result.

Move the current App-local Trip presentation contracts and derivations:

- food, bank-time, food-count, food-per-kill, prayer-restore and altar-time
  mode/value contracts;
- safespot control conversion and current safespot summary;
- ranged-only ammo-recovery, magic-only rune slots, DBA-restore and recoil-ring
  applicability/labels;
- prayer restore/carried/source summaries;
- scarce-spot values, status and pane status;
- reserve and potion part summaries;
- potion carry summary;
- recommendation status, tone, carry, interval and trip labels;
- supply-gap/negative-net-GP guidance predicate;
- the eight exact grouped output sections and their metric order; and
- option arrays used only by Trip controls.

A target contract is:

```ts
export interface TripPaneViewModel {
  trip: CombatSetupFormState["trip"];
  controls: TripControlPresentation;
  recommendation: TripRecommendationPresentation;
  groups: Array<{ title: string; items: DisplayMetric[] }>;
  status: string;
  potionCarrySummary: string;
  prayerRestoreSourceSummary: string;
  supplyGapPerKill: number;
  supplyCostsExceedLoot: boolean;
}

export function createTripPaneViewModel(input: {
  form: Pick<CombatSetupFormState, "combatStyle" | "gear" | "prayers" | "boosts" | "trip">;
  result: TripLootSupplyResult;
}): TripPaneViewModel;
```

The exact nested typing may be refined during implementation. It must remain
DOM-free and must preserve the current values, labels, precision, finite-value
fallbacks and group order.

The view model is Risk-neutral. App supplies the optional fresh modeled
kills/trip range separately to the Trip pane. The Trip module must not import
the Risk controller or reconstruct Risk freshness.

### Simulation composition adapter

After the move, `src/app/view-models/simulation.ts` continues to own:

- `SimulationViewModel` composition;
- one invocation of the accepted full simulation path;
- composition of combat, Stats, Loadout, MonsterCard, active-assumption and
  Loot feature outputs; and
- the existing public `createSimulationViewModel()` shape.

It imports the input and Loot owners directly. It must no longer define Loot
presentation types, action/value builders, price-history presentation or the
optimizer. No compatibility aliases or pass-through re-exports are added.

### Loot pane

Create `src/app/components/panes/loot-pane.tsx`. It receives typed values and
actions only.

Target contracts:

```ts
export interface LootPaneModel {
  presentation: LootPresentationViewModel;
  settings: MonsterLootSettings;
  notice: string | null;
  gpPerKill: number;
  effectiveNetGpPerHour: number;
  moneyWarnings: readonly CalculationWarningViewModel[];
}

export interface LootPaneActions {
  setHighAlch(enabled: boolean): void;
  setOverheadMode(mode: "auto" | "manual"): void;
  setOverheadSeconds(value: number): void;
  setTalismanSpot(value: JewelSpot): void;
  setAction(rowId: string, action: LootAction): void;
  resetSettings(): void;
  resetOverrides(): void;
  optimize(): void;
}
```

The pane owns the exact current landmark, toolbar, summary metrics, money
warning presenter, value-composition table, ordinary action table, action
impact/detail disclosures, local-history facts, nested table and conditional
drop disclosure.

Preserve:

- `className="loot-strip"`, `aria-label="Current monster loot"` and hidden
  behavior;
- `Loot actions` heading and ordinary/conditional count status;
- control labels, option order, min/max/step and disabled states;
- Reset/Optimize labels and button enabling;
- `aria-live` notice/override status;
- summary metric order and tones;
- all table headers, numeric precision, row classes and accessible names; the
  per-item market-value column is labelled `Unit price` in both ordinary and
  nested tables so stack quantity is not mistaken for total row value;
- native `<details>` closed-by-default behavior;
- action-select validation and callback timing;
- price-history empty/tracked states; and
- the exact conditional-drop explanation and locked action.

The pane imports shared form fields/presenters and direct view-model/domain
types only. It must not import storage, adapters, simulation builders, App or
mutation helpers.

### Trip pane

Create `src/app/components/panes/trip-pane.tsx`. It receives the direct Trip
view model, an optional App-owned fresh Risk range and a narrow mutation bridge.

Target contracts:

```ts
export interface TripPaneModel {
  presentation: TripPaneViewModel;
  modeledKillsPerTripRange: string | null;
}

export interface TripPaneActions {
  updateTrip(patch: Partial<CombatSetupFormState["trip"]>): void;
  openRisk(): void;
}
```

`updateTrip()` is a caller-owned normalized merge into the existing form. It is
not a second state owner. The pane converts its exact UI intents to patches,
including current clamping and incompatible-field clearing:

- bank auto sets `bankSeconds: null`; manual uses the bounded current value;
- prayer mode clears prayer-potion fields outside `potions` and altar seconds
  outside `altar`;
- prayer restore chooses auto, bounded vials or bounded doses exclusively;
- altar auto sets `altarSeconds: null`;
- food auto sets `foodCount: null`; manual uses the bounded current value;
- food/kill off sets the override to `null`; on uses the current rounded value;
- safespot preserves auto as `null` and explicit on/off as booleans;
- recommendation Apply changes only the active vial-or-dose field and remains
  disabled when `canApply` is false; and
- all other toggles/numbers update only their current Trip field.

Focused pane interaction tests must lock these patches before deleting the
inline App handlers.

The pane owns the exact current `Trip assumptions` landmark, controls,
recommendation block and grouped output. Preserve:

- `className="trip-strip"`, `aria-label="Trip assumptions"` and hidden behavior;
- heading, status and optional `Risk ranges` button order;
- all labels, bounds, steps, disabled states, popup food search and toggles;
- recommendation live region, status/tone, warnings and Apply contract;
- conditional DBA control;
- eight output groups in order: `Survival`, `Prayer`, `Food`,
  `Inventory reserve`, `Potions`, `Scarce cap`, `Recoil` and `Outcome`;
- every metric label, value, tone and finite fallback; and
- the optional `Modeled P10/50/90` Outcome row only when App supplies a fresh
  Risk range.

## `App.tsx` ownership after the phase

App retains:

- `form`, `defaultForm`, setup mode/custom setup ownership and normalized
  `setFormSafe()` composition;
- `lootPrefsByMonster`, `lootSettingsByMonster` and `lootNotice`;
- versioned persistence, local-state recovery, legacy migration and
  share/import/Undo replacement of those states;
- current-monster row-id cleanup and current preference/settings selection;
- live `SimulationContext`, Cannon state and price-history analysis context;
- one call to `createSimulationViewModel()` and direct feature view-model
  composition;
- Loot mutations, reset/optimizer Undo and global status routing;
- one narrow `updateTrip(patch)` form adapter;
- Active assumptions Review/Reset routing;
- Cannon sparse synchronization;
- always-visible quick navigation and negative-net-GP action composition;
- optional fresh Risk range construction and Risk navigation; and
- passing direct models/actions to the two panes.

App removes:

- Loot and Trip option arrays that have no other composition consumer;
- Loot action-label and Trip formatting/control-mode helpers;
- actionable/conditional row filtering;
- high-alch/overhead/policy presentation derivation;
- Trip modes, values, summaries, recommendation labels and metric-group
  construction;
- inline Trip control transition bodies; and
- both complete pane JSX regions.

The quick-navigation bar may read `policySummary`, `potionCarrySummary` and
`prayerRestoreSourceSummary` from the direct view models. The shared
negative-net-GP guidance may read its predicate/value from the Trip view model.
Those are intentional cross-surface consumers, not duplicate derivations.

Moving `lootNotice` or the two persisted states to a controller is explicitly
deferred. Their mutation participates in global recovery/share/Undo composition
and does not block pane/view-model extraction.

Current implementation note: the separate manual-override-derived combat model
uses empty Loot preferences and default Loot settings because its consumers
read combat values only. High alch, overhead, talisman and row-action changes
therefore rebuild the primary current-result model once instead of also
triggering a second full calculation whose Loot and Trip output was discarded.
High alch additionally keeps a local selected value and schedules the App-owned
mutation after the next browser paint, so the native selector visibly settles
before that remaining synchronous result rebuild starts. The App-owned value
remains the persistence and calculation source of truth.

## Cross-surface contracts

Phase 3F must preserve these direct consumers:

1. The always-visible ownership bar uses the Trip potion carry and prayer
   restore source summaries and the Loot policy summary.
2. Negative net GP guidance compares current supply and loot GP/kill and links
   to Loadout and Trip controls.
3. Active assumptions Review links to Loot or Trip; its safe Reset targets use
   current App-owned reset/Undo handlers.
4. Stats reads the current Trip/banking result and XP/source detail from the
   composed result.
5. Compare and Duel receive all per-monster loot preferences/settings and the
   current form.
6. Planner receives loot settings but not current loot actions, as today.
7. Risk receives the exact current form, Cannon, current-monster loot
   preferences/settings and target-drop candidates. Any source reference change
   cancels a running analysis and makes the retained result stale.
8. Trip shows the `Risk ranges` button and modeled kills/trip row only from the
   controller's App-supplied fresh snapshot.
9. Share/import/recovery and custom/default setup ownership retain current
   write/restore ordering.
10. Cannon target/respawn changes continue to synchronize Trip scarce values
    only when the existing link predicate is true.

No new import from the Loot or Trip panes into these consumers is allowed.

## Dependency direction

Required production direction:

```text
src/domain/trip + src/domain/simulation
        ^
src/app/state/ui-state + loot-prefs + loot-settings
        ^
src/app/view-models/simulation-input
        ^                         ^
src/app/view-models/loot      src/app/view-models/trip
        ^                         ^
src/app/view-models/simulation   pane components
        ^                         ^
        +------ src/app/App.tsx --+
```

Additional rules:

- domain modules do not import app modules;
- state schemas do not import components or view models;
- `simulation-input.ts` does not import `simulation.ts`;
- Loot and Trip view models do not import each other unless a later measured
  contract proves a tiny shared leaf is required;
- panes do not import App, storage, adapters, calculation tasks or simulation
  builders;
- `simulation.ts` imports Loot types/builders directly and does not re-export
  them;
- calculation-task imports the input helper directly; and
- no barrel or compatibility shim is added.

`npm run architecture:check` must remain cycle-free and exception-free. Any
required policy change stops implementation until this specification and the
architecture document are updated.

## Implementation phases

### Phase 1 - freeze focused contracts

Before broad movement:

- add server-render semantic tests for both pane landmarks and complete output
  order;
- add Trip interaction tests for mode patches, clearing, recommendation Apply
  and disabled paths;
- add focused Loot view-model tests for row partitions, actions, nested/value
  details, history context, composition and optimizer determinism;
- add focused Trip view-model tests for modes, summaries, recommendation,
  group order, style-conditional controls and finite fallbacks; and
- record current App/simulation line counts, state count, graph counts and
  browser/visual baseline counts.

Do not alter product copy or numerical baselines while freezing contracts.

### Phase 2 - extract the simulation-input leaf

- move the existing input mapping mechanically;
- update simulation and calculation-task direct imports;
- add or move focused input-mapping tests if current coverage cannot identify a
  regression;
- run Risk calculation-task, UI adapter and golden tests; and
- verify no dependency cycle or request-shape change.

### Phase 3 - split direct view-model ownership

- move Loot contracts/builders/optimizer to `loot.ts`;
- add `trip.ts` presentation contracts/builders;
- keep `SimulationViewModel` fields unchanged through direct composition;
- update every type/function consumer to its real owner;
- remove moved definitions from `simulation.ts`; and
- run focused Loot/Trip/UI/numeric tests before touching pane JSX.

### Phase 4 - extract Loot pane

- move the complete Loot landmark to `LootPane`;
- pass the direct model and explicit actions from App;
- preserve all tables/disclosures/labels/classes and callback timing; and
- remove the old JSX immediately after the focused pane and browser cases pass.

### Phase 5 - extract Trip pane

- move the complete Trip landmark to `TripPane`;
- route all field intents through the narrow normalized patch adapter;
- pass the optional fresh Risk range without importing Risk;
- preserve all controls/recommendation/groups and Cannon-linked behavior; and
- remove the old JSX immediately after focused interaction and browser cases
  pass.

### Phase 6 - composition cleanup

- remove obsolete App constants, helpers, derivations, inline handlers and
  imports;
- verify App does not reconstruct either direct view model;
- verify both panes are side-effect free outside caller callbacks;
- verify every moved symbol has one production owner and no compatibility
  re-export;
- run orphan-module and architecture checks;
- update owning docs with actual final counts and artifact evidence; and
- leave unrelated dirty-worktree changes untouched.

Line count is evidence, not an acceptance target.

## Compatibility invariants

The complete phase preserves:

- all Trip and Loot numeric outputs and their expected-value authority;
- every current form field, default, bound, nullable auto state and
  normalization rule;
- per-style Trip state behavior when combat style changes;
- setup/custom/Duel/share/import/export and recovery envelopes;
- per-monster loot preference/settings keys, versions, validation and cleanup;
- persistence readiness/blocking and local-state failure behavior;
- exact target-switch behavior and no tab-triggered mutation;
- all control labels, options, precision, order and disabled states;
- recommendation status/reason/warnings and Apply semantics;
- current high-alch override precedence, overhead auto value and talisman spot;
- current action availability, default override removal and status messages;
- optimizer result, cap, tie/order behavior and global one-step Undo;
- conditional-drop locked/collapsed policy;
- value composition, action impacts, nested rows and price-history context;
- all eight Trip metric groups and optional fresh Risk row;
- quick-navigation summaries, negative-net-GP guidance and Active assumptions;
- Cannon sparse linking and current cross-pane consumers;
- Risk source invalidation/stale/fresh behavior;
- DOM landmarks, roles, native disclosure behavior, accessible names and focus;
- CSS selectors, responsive overflow and screenshot geometry; and
- D-094 entry budgets.

No visual baseline update is expected. A screenshot mismatch is a regression to
investigate, not evidence that a mechanical extraction should accept new
images.

## Tests and validation

Add focused tests:

- `src/tests/loot-view-model.test.ts`;
- `src/tests/trip-view-model.test.ts`;
- `src/tests/loot-pane.test.ts`; and
- `src/tests/trip-pane.test.ts`.

The pane tests cover static semantic output plus Trip callback patches. Existing
domain, state, adapter and browser tests remain authoritative for their current
owners; do not duplicate the entire mixed suites.

Minimum focused gate:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/trip-loot-supply.test.ts src/tests/*-view-model.test.ts src/tests/ui-adapters.test.ts src/tests/data-economy.test.ts src/tests/risk-controller.test.ts src/tests/risk-pane.test.ts src/tests/cannon-pane.test.ts src/tests/stats-loadout-panes.test.ts src/tests/loot-view-model.test.ts src/tests/trip-view-model.test.ts src/tests/loot-pane.test.ts src/tests/trip-pane.test.ts
npm run numeric:audit
npm run test:golden
npm run test:e2e -- --workers=1 -g "updates trip survival controls and keeps the trip summary visible|updates manual food controls and recoil ring count|updates trip food, banking and inventory reserve controls across styles|updates trip potion carry controls and grouped potion summary|shows inactive trip potion recommendation states|updates prayer restore detail controls and keeps the trip summary visible|updates per-monster loot settings and keeps them after reload|shows source-backed conditional clue loot without allowing a value action|resets one Active modifiers loot row while preserving neighboring loot state|updates current monster loot actions, reset and optimize|shows loot value composition, nested detail and action impact detail|shows source-backed opened-casket value composition|matches browser-rendered numeric snapshots for loot action and trip overrides"
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

Also keep the existing popup-food, compact ownership-summary,
negative-net-GP-guidance, Stats Trip summary, multi-prayer/boost, Dense marker,
Risk and Cannon browser paths in the complete 77-case gate.

The implementation report records:

- final source/client-reachable module counts and cycle/exception status;
- `App.tsx` line/state counts;
- `simulation.ts`, input leaf, Loot/Trip view-model and pane sizes;
- focused and full test counts;
- numeric and golden results;
- focused/full functional browser results;
- 20-scenario/31-PNG read-only visual result;
- artifact entry raw/gzip bytes, total bytes and SHA-256; and
- any skipped network-only audit with the documented policy reason.

Counts are evidence, not success criteria.

## Allowed implementation scope

Expected source changes are limited to:

- `src/app/App.tsx`;
- `src/app/view-models/simulation.ts`;
- the new simulation-input, Loot and Trip view-model modules;
- the new Loot and Trip pane components;
- `src/app/calculation-task.ts` for a mechanical direct input-helper import;
- focused tests and mechanical direct import updates; and
- owning architecture, testing, backlog and documentation indexes.

No domain, app-state schema, persisted payload, adapter, server, Worker
implementation, generated-data, market artifact, archived legacy runtime,
stylesheet, Playwright config or visual baseline change is expected. If one
becomes necessary, stop and update this specification before broadening scope.

## Documentation updates on implementation

- Mark this specification implemented and append exact evidence.
- Update the parent composition-root specification Phase 3F status.
- Update `docs/technical/architecture.md` with actual owners and counts.
- Update `docs/technical/testing.md` with focused and full gates.
- Move the Loot/Trip ownership backlog row to `Done`. Phase 3G's separately
  specified Economy/Settings extraction is now implemented; the final
  composition review follows.
- Update product/feature docs only if an owner statement still names App or
  `simulation.ts`; do not change accepted workflows.
- Do not add a new decision unless implementation changes a boundary beyond
  D-093.

## Done criteria

- Loot renders through its own pure pane component.
- Trip renders through its own pure pane component.
- Loot presentation contracts/builders/optimizer have a direct owner outside
  `simulation.ts` and App.
- Trip modes/summaries/recommendation/groups have a direct DOM-free owner.
- Shared simulation-input mapping has one cycle-free leaf owner.
- `SimulationViewModel` and every numeric result remain compatible.
- App no longer owns Loot/Trip pane markup or feature-only presentation
  derivation, while it retains form/persisted-state/recovery/share/Undo and
  cross-pane composition.
- No compatibility barrel, re-export, duplicate builder or orphan module is
  introduced.
- Domain, schema, persistence, request, Worker, DOM, copy, CSS and visual
  contracts remain unchanged.
- Focused, numeric, golden, browser, visual and full repository gates pass.
- Owning documentation reports actual implementation evidence.

## Implementation evidence

- `src/app/view-models/simulation-input.ts` is the 46-line cycle-free owner of
  full simulation input mapping. `simulation.ts`, `calculation-task.ts` and Risk
  tests import it directly; no pass-through export remains.
- `src/app/view-models/loot.ts` is the 681-line direct owner of Loot row/action,
  composition, nested/value/history, policy and optimizer presentation.
  `src/app/view-models/trip.ts` is the 435-line DOM-free owner of Trip modes,
  summaries, recommendation and eight output groups.
- `src/app/components/panes/loot-pane.tsx` (460 lines) and
  `trip-pane.tsx` (369 lines) own the complete unchanged landmarks. App passes
  typed values and explicit actions; Trip mutation crosses one normalized
  `updateTrip(patch)` bridge and optional fresh Risk presentation remains
  caller-owned.
- `App.tsx` decreased from 5,608 to 4,297 lines while retaining the same 46
  React state cells. `simulation.ts` decreased from 1,113 to 476 lines and
  preserves the existing raw Loot compatibility fields plus the direct nested
  Loot presentation.
- Architecture passes at 105 source modules / 93 client-reachable modules /
  seven external entrypoints with no cycle, exception or orphan. The focused
  twelve-file gate passes 238/238 tests; the new direct-owner/pane subset passes
  11/11, and the Risk input-mapping subset brings that focused leaf check to
  24/24.
- The numeric audit passes 5,958/5,958 comparisons with zero mismatch and all 19
  goldens remain unchanged. Focused Chromium passes 13/13, complete Chromium
  77/77 and the read-only Darwin suite 20/20 against the same 31 reviewed PNGs;
  no baseline changed.
- Full `npm run verify` passes 58 files / 730 tests plus 19 explicit goldens,
  typecheck, architecture, build/artifact, lint, Prettier and diff gates. The
  10-file/two-asset artifact totals 1,966,525 bytes with SHA-256
  `3c247248df68cf2dd14d33e1f256b464f06a9cf975cb8af4f7790e2057fa5e6c`;
  entry JavaScript remains inside D-094 at 709,990 raw / 206,326 gzip bytes.
  Dependency audit was skipped under the documented network-disabled policy.
- No domain formula, state schema, persisted envelope, request/result contract,
  Worker message, adapter, server, generated data, stylesheet, Playwright
  configuration or visual baseline changed.

## Follow-up questions and sequencing

- Resolved after Phase 3F: the independently specified
  [Economy/Settings Phase 3G](economy-settings-pane-refactor-spec.md) is now
  implemented, so the bounded final composition review is next.
- Should per-monster loot persistence/recovery later gain its own controller?
  Current cross-surface replacement and global Undo make that a separate
  lifecycle specification, not part of this pane move.
- Should `SimulationViewModel` eventually stop carrying raw `trip` and Loot
  compatibility fields in favor of nested direct feature models? This phase
  preserves the public shape; a later contract cleanup needs its own consumer
  map.
- Should exact player quest/clue eligibility or `Sell unopened` casket behavior
  be added? D-072/D-089 and D-084 keep both outside this structural phase.

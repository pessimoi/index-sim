# Planner pane, view-model and calculation-controller refactor specification

Status: implemented on 2026-07-13 as D-093 composition-root Phase 3D.

## Purpose

Extract the Planner presentation family from `src/app/App.tsx`, move its
feature-specific builders and contracts out of
`src/app/view-models/simulation.ts`, and give the existing explicit-Recompute
worker lifecycle a focused controller owner without changing behavior.

This is an ownership refactor. It preserves the current Planner calculation,
request, worker, draft/committed-state, persistence, DOM, copy, styling,
accessibility and browser-action contracts. The phased parent contract remains
[app-composition-root-refactor-spec.md](app-composition-root-refactor-spec.md),
and D-093 remains the accepted architecture decision.

## Why Planner is Phase 3D

Planner is the next lowest-risk cohesive feature family after Compare/Duel:

- `src/domain/planner` already owns the pure planning algorithm;
- `src/app/state/planner.ts` already owns the versioned browser state and its
  bounded mutations;
- `src/app/calculation-task.ts` already exposes a typed cancellable `planner`
  request through the one-shot Worker boundary;
- Planner has focused domain, state, adapter, parity, golden, performance and
  browser evidence; and
- its pane does not mutate the live combat setup or share a result renderer
  with another workbench tab.

Loot/Trip/Risk remains more tightly coupled to the live composed result,
per-monster preferences and cross-tab form mutation. Planner therefore comes
first even though raw line count is not an acceptance criterion.

## Current evidence

At specification time, after the implemented Compare/Duel phase:

- `src/app/App.tsx` is 6,387 lines and owns 51 React state cells;
- `src/app/view-models/simulation.ts` is 1,502 lines, of which the contiguous
  Planner contracts/builders occupy lines 1,077-1,440;
- the complete Planner pane occupies `App.tsx` lines 5,432-5,793;
- `App` owns three Planner-local state cells: persisted draft state,
  last-computed state and the latest worker build;
- `App` owns Planner draft mutation callbacks, one persistence effect, the
  explicit Recompute bridge, worker effect, source freshness, status
  derivation, metric formatting and all Planner markup;
- `src/app/state/planner.ts` owns the version-1 `index-sim:planner-ui`
  envelope, defaults, normalization, skill targets/current XP/locks,
  average-over-session, current-gear mode and bounded gear-pool selection;
- draft edits are persisted immediately but do not become calculation input
  until `Recompute plan` captures a normalized computed snapshot;
- form, context or per-monster loot-setting changes automatically rebuild the
  plan using the last computed Planner snapshot;
- the worker build is fresh only when the form, context,
  `lootSettingsByMonster` and computed Planner state references all match; and
- the architecture gate passes with 94 source modules, 82 client-reachable
  modules, seven explicit external entrypoints, no cycles and no exceptions.

The current calculation boundary is sound. This phase must not turn the
structural extraction into an algorithm, persistence, auto-Recompute or
persistent-worker change.

## Goals

- Make Planner an independently reviewable feature-pane owner.
- Move Planner domain-adapter, gear-pool editor, panel, chart, timeline and row
  contracts/builders to a direct feature view-model module.
- Move the existing computed-snapshot, Worker, cancellation, freshness and
  status lifecycle behind one focused React hook.
- Preserve `App` as the versioned Planner draft-state owner, persistence
  coordinator and workbench composition root.
- Preserve every numeric, golden, worker, pending/Recompute, persistence,
  DOM, responsive and accessibility contract.
- Narrow `simulation.ts` and its imports/exports without compatibility barrels
  or dependency cycles.
- Leave the next Loot/Trip/Risk phase with a smaller composition root and no
  Planner coupling.

## Non-goals

- No Planner search, scoring, target, XP, unlock, eligibility, stance,
  requirements, gear-pool or truncation algorithm change.
- No `PlannerInput`, `PlannerOptions`, `PlannerPlan`, `SimulationRequest`,
  `SimulationContext`, `PlannerCalculationRequest`, Worker response, timeout or
  cancellation-policy change.
- No automatic calculation on every Planner draft edit. The explicit
  `Recompute plan` boundary remains exact.
- No `index-sim:planner-ui` key, envelope, version, schema, default, storage
  timing, recovery or validation change.
- No migration of legacy `sim_planner_v1`; D-048 keeps it review-only and not
  imported.
- No future or hypothetical equipment admission, D-051 fallback removal,
  quest requirement, ownership state or D-047 product-scope change.
- No persistent initialized Worker, worker pool, shared context cache, lazy
  loading or bundle split. Worker startup/structured-clone measurement remains
  a separate backlog item.
- No action that applies a Planner phase, level, loadout or unlock to the live
  combat setup. The current pane is analysis-only.
- No copy, precision, order, semantic role, label, focus behavior, CSS class,
  SVG geometry or stylesheet change.
- No new state library, context provider, reducer, router or feature service.
- No Loot, Trip, Risk, Economy, Settings, archived legacy runtime, domain or
  generated-data refactor.
- No broad decomposition of existing mixed test files beyond focused new pane
  and controller coverage plus mechanical direct-import moves.

If extraction exposes an existing behavioral defect, record it as a follow-up.
Do not repair it in this phase unless it prevents the structural move and this
specification is updated first.

## Preserved sources of truth

| Concern                                              | Owner after this phase                          |
| ---------------------------------------------------- | ----------------------------------------------- |
| Planner algorithm, scoring, search and plan contract | `src/domain/planner`                            |
| Planner persisted schema and bounded state mutations | `src/app/state/planner.ts`                      |
| Form/request and Trip-policy adaptation              | `src/app/state/ui-state.ts`                     |
| Planner domain adapter and presentation builders     | New `src/app/view-models/planner.ts`            |
| Explicit-Recompute and Worker lifecycle              | New Planner calculation controller hook         |
| Versioned draft state and persistence/recovery       | `src/app/App.tsx`                               |
| Planner markup and presentation-only formatting      | New `src/app/components/panes/planner-pane.tsx` |
| Worker request/result dispatch                       | `src/app/calculation-task.ts`                   |

No new plan/result object may become a parallel replacement for
`PlannerPlan` or the existing `PlannerPanelViewModel`.

## Target module map

### Planner view model

Create `src/app/view-models/planner.ts`. Move the complete current Planner
family from `simulation.ts`:

- `PlannerDomainAdapterViewModel`;
- panel summary, training-order, unlock, timeline and chart contracts;
- gear-pool option, slot and editor contracts;
- `plannerAllowedPool()`;
- `createPlannerGearPoolEditorViewModel()`;
- `createPlannerDomainAdapter()`;
- `createPlannerViewModel()`;
- `createPlannerPanelViewModel()`; and
- their private item filtering/label/hint, target, row, timeline and chart
  helpers.

The module imports only the existing direct owners it needs:

- Planner algorithm/types/constants from `@/domain/planner`;
- shared game-data/request types from `@/domain/shared`;
- Planner schema/pool helpers from `src/app/state/planner.ts`;
- `formToSimulationRequest()`, `formToTripPolicy()` and form types from
  `src/app/state/ui-state.ts`; and
- the current per-monster loot-setting resolver from
  `src/app/state/loot-settings.ts`.

It must not import `simulation.ts`, React, components, controllers, storage,
browser APIs or the calculation Worker. `simulation.ts` must not import or
re-export the new Planner module after the move.

Preserve these detailed contracts:

- hypothetical items remain excluded from the allowed pool;
- `none` remains valid where the current default pool allows it;
- every pool id is checked against the active game-data slot;
- selected pool ids are cleaned in canonical allowed-pool order;
- an omitted slot means the complete allowed slot, while at least one item per
  edited slot remains selected;
- generated numeric requirements remain primary and the current D-051 manual
  fallback remains warning-only;
- skill locks keep that skill at the live form level;
- unlocked targets use `max(live level, draft target)`;
- current XP, avg-over-session, only-current-gear and per-monster high-alch,
  talisman-spot and overhead inputs retain their existing mapping;
- `legendsComplete` retains its current fixed Planner behavior;
- `maxLevels` remains 120;
- chart points, coordinates, empty detection, timeline order, row ids, labels,
  warnings and summary values remain deterministic and unchanged; and
- the view model remains DOM-free and side-effect-free.

Add the Planner status union used by both controller and pane to this direct
feature module:

```ts
export type PlannerStatus = "error" | "pending" | "running" | "empty" | "ready" | "idle";
```

This is a presentation contract, not persisted state.

### Planner calculation controller

Create `src/app/controllers/use-planner-calculation.ts`. It owns only
Planner-local session calculation state and derivation currently embedded in
`App`:

- the last computed normalized `PlannerUiState` snapshot;
- draft-versus-computed dirty detection;
- explicit `recompute()` snapshot capture;
- starting `planner` only while the Planner tab is active and context exists;
- cancellation on source change, tab deactivation and unmount;
- exact source-reference freshness matching;
- ready, pending and failed build state;
- Planner gear-pool editor derivation from the live draft state; and
- the existing fixed status precedence.

Its input is:

```ts
export interface UsePlannerCalculationInput {
  active: boolean;
  draftState: PlannerUiState;
  form: CombatSetupFormState;
  context: SimulationContext | null;
  lootSettingsByMonster: LootSettingsByMonsterState;
}
```

Its pane-ready return contract includes:

```ts
export interface PlannerCalculationController {
  panel: PlannerPanelViewModel | null;
  gearPoolEditor: PlannerGearPoolEditorViewModel | null;
  error: string | null;
  pending: boolean;
  draftDirty: boolean;
  status: PlannerStatus;
  computedMetric: PlannerMetric;
  recompute(): void;
}
```

The implementation may accept an optional injected task starter for focused
tests. Production must use `startCalculationTask()` and the existing
`PlannerCalculationRequest`; it must not call `buildPlan()` or other domain
functions directly.

The controller initializes its computed snapshot once from the normalized
initial `draftState`. Later draft changes do not synchronize automatically.
Only `recompute()` captures the current normalized draft. This preserves the
current explicit commit boundary and prevents a refactor from silently turning
Planner into a calculate-on-type feature.

The build source contains the exact current references:

```ts
{
  form,
  context,
  lootSettingsByMonster,
  plannerState: computedState
}
```

A build is fresh only when all four references match. Draft state is
deliberately not a freshness key until Recompute captures it. Therefore:

- a draft edit changes the status to `pending` but keeps the last fresh panel
  visible;
- Recompute invalidates the previous result and displays `Calculating plan`
  while the new Worker task is pending;
- form, context and loot-setting changes automatically rebuild with the last
  computed snapshot;
- stale or cancelled task output is never presented as fresh; and
- a failed fresh build exposes exactly
  `Planner could not compute the current plan`.

Status precedence remains exact:

1. fresh error -> `error`;
2. dirty draft -> `pending`;
3. active calculation without a fresh build -> `running`;
4. fresh empty panel -> `empty`;
5. fresh non-empty panel -> `ready`;
6. otherwise -> `idle`.

The hook does not own persisted draft state, storage, recovery, form mutation,
global status, workbench tabs or pane markup. It exposes no React setter and no
raw Worker.

### Calculation task boundary

`src/app/calculation-task.ts` keeps the exact four request kinds and result
mapping. Only Planner imports change:

- `createPlannerViewModel()`, `createPlannerPanelViewModel()` and
  `PlannerPanelViewModel` come directly from `view-models/planner.ts`;
- the `planner` request payload and result shape remain exactly
  structured-clone compatible; and
- Dense Compare, Duel, Risk and main simulation imports remain with their
  current direct owners.

Do not add Planner re-exports to `simulation.ts` to avoid updating callers.
App, calculation task, adapter tests, view-model tests and performance tests
must import moved symbols from their direct owner.

### Planner pane

Create `src/app/components/panes/planner-pane.tsx`. It owns the complete current
`Planner` region only:

- title and status pill;
- metric, live combat-style and target controls;
- explicit Recompute button;
- only-current-gear and avg-over-session toggles;
- current-XP, target-level and skill-lock grid;
- gear-pool editor, counts, Reset actions and item hints;
- calculating, error, unavailable and empty states;
- summary metrics;
- DPS-versus-cumulative-XP SVG and scale;
- gear timeline;
- training-order table;
- unlock-summary table; and
- bounded Planner warnings.

The pane owns presentation-only constants/helpers now in `App`, including:

- metric select options;
- metric-value and metric-delta formatting; and
- any Planner-only labels or class-name selection.

It may import shared form fields, `MetricList`, shared pure formatters,
Planner-state constants and direct Planner view-model types. It must not import
the controller, calculation client, storage, adapters or domain execution
functions.

The pane receives one readonly model and one action object:

```ts
export interface PlannerPaneModel {
  draftState: PlannerUiState;
  panel: PlannerPanelViewModel | null;
  gearPoolEditor: PlannerGearPoolEditorViewModel | null;
  error: string | null;
  pending: boolean;
  status: PlannerStatus;
  computedMetric: PlannerMetric;
  combatStyleLabel: string;
  targetLabel: string;
  currentLevels: Readonly<Record<PlannerSkill, number>>;
}

export interface PlannerPaneActions {
  setMetric(metric: PlannerMetric): void;
  setCurrentXp(skill: PlannerSkill, value: number): void;
  setTargetLevel(skill: PlannerSkill, value: number): void;
  setSkillLock(skill: PlannerSkill, locked: boolean): void;
  setOnlyCurrentGear(value: boolean): void;
  setAverageOverSession(value: boolean): void;
  setGearPoolItem(slot: PlannerGearSlot, itemId: string, selected: boolean): void;
  resetGearPool(slot: PlannerGearSlot): void;
  recompute(): void;
}

export interface PlannerPaneProps {
  hidden: boolean;
  model: PlannerPaneModel;
  actions: PlannerPaneActions;
}
```

Action names express user intent. The pane must not receive `setPlannerState`,
construct a `PlannerUiState`, normalize persisted state, start a Worker or
mutate the live form.

## `App.tsx` ownership after the phase

`App` continues to own:

- the versioned Planner draft `PlannerUiState` value;
- initial storage load, recovery blocking and persistence effect;
- typed draft mutation bridges using existing state helpers/normalization;
- live form, current monster/context and per-monster loot settings;
- workbench tab activation and cross-feature composition; and
- mapping controller output plus mutation intents into `PlannerPane` props.

`App` must no longer own:

- Planner feature markup or SVG/table presentation;
- `plannerComputedState` or `plannerBuild` state cells;
- Planner Worker effect, cancellation or source-freshness logic;
- Planner pending/error/status/metric-delta derivation;
- Planner gear-pool editor derivation; or
- Planner-only metric options, formatting helpers, types or CSS-class helpers.

The persisted draft state intentionally remains in `App` in this phase. Moving
it behind a feature store or controller would combine ownership extraction with
a persistence architecture change.

## Dependency direction

The intended direction is:

```text
domain/planner + app/state
             |
             v
planner view model
             |
             v
calculation task -> calculation Worker

app/state + planner view model + calculation client
             |
             v
planner controller hook
             |
             v
App composition -> pure Planner pane
```

Pane components may import direct feature view-model/state types and shared
pure presenters, but never controllers. `simulation.ts` must not import Planner
after the move. The architecture gate must report no cycle or new layer
exception.

## Implementation phases

### Phase 1 - freeze focused contracts

Before moving broad JSX or lifecycle code:

- add server-render semantic tests for ready, pending/error and empty Planner
  states;
- record exact region, headings, control/table/chart labels, button text,
  status roles, disabled states, row order and important accessibility labels;
- add controller tests for inactive/active execution, draft dirtiness,
  explicit Recompute, cancellation, source freshness, failure and unmount;
- retain existing Planner domain, UI-state, adapter, parity, golden,
  calculation-task, performance and browser evidence; and
- identify the existing sticky-header, visible workflow, persistence,
  long-task and visual scenarios that own the moved contracts.

Tests assert durable semantic contracts rather than complete raw-markup
snapshots.

### Phase 2 - split view-model ownership

Move the complete Planner family to `view-models/planner.ts`. Update App,
calculation task and tests to import direct symbols. Delete the old declarations
immediately; do not add a compatibility re-export.

Run typecheck, architecture, Planner adapter/domain, calculation-task,
performance, parity and golden checks before moving lifecycle or JSX.

### Phase 3 - extract the calculation controller

Move the computed snapshot, Worker effect/build, freshness, dirty/pending/error
and gear-editor derivation behind `usePlannerCalculation()`. Keep the existing
App markup during this phase so orchestration regressions are isolated from DOM
movement.

Preserve the explicit Recompute boundary, source identity, task cancellation,
last-panel visibility during draft edits, status precedence and fixed error
copy. Do not generalize Planner into the Compare or Duel hooks; their debounce,
activation and recompute semantics differ.

### Phase 4 - extract pane presentation

Move the exact Planner region to `PlannerPane`. App supplies controller results,
live labels and current mutation bridges through the typed model/actions.

Preserve DOM order, classes, copy, roles, labels, hidden behavior, SVG geometry,
table structure, input normalization and callback timing. Do not reorganize the
layout or adjust responsive CSS.

### Phase 5 - composition cleanup

After behavior gates pass:

- remove obsolete `BuiltPlannerState`, state cells, helpers and imports from
  App;
- remove Planner declarations/imports from `simulation.ts`;
- narrow Planner feature exports to actual consumers;
- verify direct imports and absence of compatibility barrels;
- verify no duplicate Planner formatter, status or panel contract remains; and
- update current architecture/testing evidence with measured final counts.

Line count is evidence, not an acceptance target.

## Compatibility invariants

The complete phase preserves:

- every visible string, numeric precision, row/column order and status label;
- the `Planner`, `Planner controls`, `Planner gear pool editor`,
  `Planner output`, summary, chart, timeline, training-order and unlock-summary
  landmarks;
- metric/current-XP/target/skill-lock input bounds and normalization;
- avg-over-session and only-current-gear behavior;
- gear-pool default/edited selection, one-item minimum and Reset behavior;
- immediate versioned draft persistence;
- the dirty `pending` status without automatic calculation;
- explicit Recompute, `running`, `ready`, `empty`, `error` and `idle` status
  precedence;
- old-panel visibility while only the draft is dirty;
- automatic rebuild after form/context/loot changes using the last computed
  state;
- `planner` Worker request/result structure and cancellation;
- Planner panel summary, chart, timeline, training order, unlocks and warnings;
- D-047, D-048 and D-051 boundaries;
- four Planner golden plan fixtures, the repository's 19-test explicit golden
  gate and legacy Planner parity classifications;
- D-094 entry budgets and generated-runtime deferred chunk; and
- existing responsive, sticky-header, long-task and visual output.

No visual baseline update is expected. A screenshot difference is a regression
to investigate, not permission to accept new baselines.

## Tests and validation

Add focused tests:

- `src/tests/planner-pane.test.ts` for server-render semantic contracts of
  ready, pending/error and empty/unavailable states; and
- `src/tests/planner-controller.test.ts` for activation, initial computed
  snapshot, dirty draft without auto-run, Recompute, cancellation, source
  freshness, failure and unmount.

Existing Planner builder cases remained in `planner-ui-adapter.test.ts` and the
combined UI view-model suite during the mechanical move. The later
ARCH-2026-05 maintenance split moved the combined integration assertion
unchanged into `simulation-view-model.test.ts`.

Minimum focused gate:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/planner-domain.test.ts src/tests/planner-ui-state.test.ts src/tests/planner-ui-adapter.test.ts src/tests/*-view-model.test.ts src/tests/calculation-task.test.ts src/tests/ui-performance.test.ts src/tests/planner-pane.test.ts src/tests/planner-controller.test.ts
npm run planner:parity
npm run test:golden
npm run test:e2e -- --workers=1 -g "recomputes the Planner tab workflow|keeps Monsters, Planner and setup matrix calculations off the main event loop|keeps desktop table headers usable"
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

The implementation report records final source-module counts, `App.tsx`,
`simulation.ts`, Planner view-model/controller/pane sizes, focused/full test
counts, parity/golden results, functional and visual results, artifact entry
bytes and SHA-256. Counts are evidence, not success criteria.

## Allowed implementation scope

Expected source changes are limited to:

- `src/app/App.tsx`;
- `src/app/calculation-task.ts`;
- the new Planner view-model module;
- the new Planner calculation controller hook;
- the new Planner pane component;
- direct component/view-model import consumers;
- focused tests and mechanical test imports; and
- owning architecture, testing, backlog and documentation indexes.

No domain, generated-data, persisted-state schema, adapter, server, Worker
implementation, deployment or CSS file should change. If one becomes
necessary, stop and update this specification before broadening implementation.

## Documentation updates on implementation

- Mark this specification implemented and append exact evidence.
- Update the parent composition-root specification Phase 3D status.
- Update `docs/technical/architecture.md` with actual owners, dependency
  direction and measured module/line counts.
- Update `docs/technical/testing.md` with final focused and full gates.
- Move the Planner backlog row to `Done` while leaving Loot/Trip/Risk,
  Economy/Settings and remaining main/MonsterCard view-model work open.
- Do not add a new decision unless implementation changes a boundary beyond
  D-093.

## Done criteria

- Planner renders through its own pane component.
- Planner computed-snapshot and Worker orchestration have a focused controller
  owner outside App.
- Planner builders/types have a direct feature owner outside `simulation.ts`.
- `simulation.ts` neither imports nor re-exports Planner.
- App retains versioned draft state and persistence but no longer owns Planner
  markup, presentation helpers or calculation lifecycle state.
- Domain, request, worker, persistence, migration, copy, DOM, CSS, numeric and
  visual contracts are unchanged.
- Focused, parity, golden, browser and full repository gates pass; any
  environment-only visual-server limitation is recorded without changing
  baselines.
- Owning documentation reports actual implementation evidence.

## Open questions

- After Planner, should Loot/Trip/Risk or Economy/Settings be the next D-093
  feature family? Choose from the remaining dependency map and focused browser
  coverage rather than line count.
- Should a later product goal replace explicit Recompute with automatic or
  debounced Planner calculation? This phase preserves the current explicit
  boundary and provides no evidence for changing it.
- Should Planner draft persistence eventually move behind a dedicated feature
  store/controller? This phase deliberately keeps it in App to avoid a storage
  architecture change.

## Implementation evidence

- `src/app/view-models/planner.ts` is the direct 403-line owner of Planner
  adapters, panel/chart/timeline/row contracts and the bounded gear-pool editor.
  `simulation.ts` neither imports nor re-exports Planner.
- `src/app/controllers/use-planner-calculation.ts` is the 159-line owner of the
  normalized computed snapshot, explicit Recompute boundary, one-shot Worker,
  cancellation, source freshness, fixed error and status precedence.
- `src/app/components/panes/planner-pane.tsx` is the 412-line pure presentation
  owner. The extraction also expresses the existing SVG `title` copy as one
  string, removing a React development warning without changing rendered text,
  geometry or accessibility output.
- `App.tsx` retains the versioned Planner draft, persistence/recovery and typed
  mutations but no Planner markup, computed/build state or Worker lifecycle. It
  decreased from 6,387 to 5,965 lines and from 51 to 49 React state cells;
  `simulation.ts` decreased from 1,502 to 1,113 lines.
- The focused eight-file gate passes 129/129. Planner parity passes 16 cases / 32
  comparisons with zero review or rewrite-gap rows, and all 19 explicit golden
  tests pass unchanged.
- The focused moved workflow passes 3/3 in Chromium, the complete functional
  suite passes 77/77 and the read-only Darwin visual suite passes 20/20 against
  the same 31 reviewed baselines. No baseline was written.
- Full `npm run verify` passes 52 files / 710 tests, 19 goldens, typecheck, the
  97-source-module / 85-client-reachable / seven-entrypoint zero-cycle
  architecture gate, build budgets, lint, formatting and diff checks. The
  10-file/two-asset artifact is 1,962,374 bytes with SHA-256
  `42a68f4e48d4999548010cbad8c291efe8786d4b9d08407193376b9bf5e4d2cc`;
  entry JavaScript is 706,650 raw / 205,198 gzip bytes and remains inside D-094.

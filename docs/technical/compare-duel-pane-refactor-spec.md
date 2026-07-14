# Compare/Duel pane, view-model and calculation-controller refactor specification

Status: implemented on 2026-07-13 as D-093 composition-root Phase 3C.

## Purpose

Extract the Compare and Duel presentation families from `src/app/App.tsx`, move
their feature-specific builders and contracts out of
`src/app/view-models/simulation.ts`, and give their existing worker lifecycles
cohesive feature-controller owners without changing behavior.

This is an ownership refactor. It must preserve the current calculation,
request, worker, persistence, DOM, copy, styling, accessibility and
browser-action contracts. The phased parent contract remains
[app-composition-root-refactor-spec.md](app-composition-root-refactor-spec.md),
and D-093 remains the accepted architecture decision.

## Current evidence

At specification time, after the implemented Stats/Loadout phase:

- `src/app/App.tsx` is 7,273 lines and owns 58 React state cells;
- `src/app/view-models/simulation.ts` is 2,583 lines and still combines the main
  result adapter with Compare, Dense Compare, Duel, Planner, Loot and
  MonsterCard presentation families;
- `App` owns the complete `Monster comparison` and `Setup comparison` markup,
  Compare filtering and keyboard action bridges, Duel session view state,
  automatic Dense calculation lifecycle and on-demand Duel-matrix lifecycle;
- Dense Compare uses a 250 ms debounced form, a typed cancellable
  `dense-compare` worker request, reference-matched freshness and a
  presentation-only filter/sort/scale pass;
- the Duel current-target model is synchronous and rates-only, while the
  all-monster matrix is an explicit `duel-matrix` worker request whose result is
  invalidated when any source reference changes;
- `src/app/state/dense-compare.ts` owns the versioned rewrite-setup sort, filter
  and irrelevant-monster state, while `src/app/state/duel-snapshots.ts` owns the
  separate strict version 1 snapshot envelope and list mutations; and
- both features already read combat, trip, XP and economy values through
  `createSimulationViewModel()` and `FullSimulationResult`. The problem is
  concentrated UI and orchestration ownership, not duplicate numeric truth.

The existing calculation boundary is sound. This goal must not turn the
structural extraction into a persistent-worker experiment or a product change.

## Goals

- Make Compare and Duel independently reviewable feature-pane owners.
- Move Compare/Dense and Duel types and pure builders to direct feature
  view-model modules.
- Move the current automatic Dense and on-demand Duel-matrix worker lifecycles
  behind focused React hooks.
- Keep `App` as the application composition root, live form owner, persistence
  coordinator and cross-feature action owner.
- Preserve all existing numeric, DOM, keyboard, responsive, import/export and
  visual evidence.
- Narrow `simulation.ts` and its public export surface without compatibility
  barrels or dependency cycles.
- Leave a repeatable seam for the later Loot/Trip/Risk, Planner and
  Economy/Settings phases.

## Non-goals

- No combat, trip, XP, loot, economy, setup-diff or best-marker formula change.
- No `SimulationRequest`, `SimulationContext`, `FullSimulationResult`, worker
  request/result kind, structured-clone payload, timeout or cancellation-policy
  change.
- No persistent initialized Worker, worker pool, context cache, lazy loading or
  bundle split. The repeated startup/transfer question remains a separately
  measured backlog item.
- No Dense sort/filter/relevance schema, rewrite-setup version, localStorage key
  or migration change.
- No Duel snapshot schema, limit, storage key, import/export envelope,
  compatibility rule or merge-policy change.
- No snapshot-transfer controller. File validation and browser-local state
  application remain caller-owned in this phase.
- No copy, precision, row/column order, semantic role, label, focus behavior,
  CSS class or stylesheet change.
- No new state library, context provider, reducer, router or feature service.
- No archived legacy runtime, domain module, Planner, Loot, Trip, Risk, Economy
  or Settings refactor.
- No broad decomposition of existing test files beyond focused new pane or
  controller coverage and mechanical import moves.

If the extraction exposes an existing behavioral defect, record it as a
follow-up. Do not repair it in this goal unless it prevents the structural move
and the specification is updated first.

## Preserved sources of truth

| Concern                                            | Owner after this goal                                |
| -------------------------------------------------- | ---------------------------------------------------- |
| Combat, trip, XP and economy calculations          | `src/domain/*` and `FullSimulationResult`            |
| Main result composition                            | `src/app/view-models/simulation.ts`                  |
| Dense sort/filter/relevance schema and mutations   | `src/app/state/dense-compare.ts`                     |
| Duel snapshot schema, envelope and list mutations  | `src/app/state/duel-snapshots.ts`                    |
| Compare row generation, presentation and scaling   | New `src/app/view-models/compare.ts`                 |
| Duel rows, setup diffs, best markers and matrix    | New `src/app/view-models/duel.ts`                    |
| Dense calculation lifecycle and freshness          | New Compare feature controller hook                  |
| Duel session view state and matrix lifecycle       | New Duel feature controller hook                     |
| Live setup, target, persistence, recovery and Undo | `src/app/App.tsx`                                    |
| Compare and Duel markup                            | New pane components under `src/app/components/panes` |

No new result object may become a parallel replacement for
`FullSimulationResult`.

## Target module map

### Compare view model

Create `src/app/view-models/compare.ts`. Move the current Compare and Dense
contracts, helpers and public builders there:

- `CompareRowViewModel`;
- Dense row, marker and scale contracts;
- `createCompareRows()` and `createDenseCompareRows()`;
- `sortDenseCompareRows()` and `presentDenseCompareRows()`;
- `createDenseCompareScaleModel()`; and
- the private row comparison, filtering, marker and scale helpers used only by
  that family.

The module imports `createSimulationViewModel()` from `simulation.ts` for the
existing rates-only per-monster calculation. `simulation.ts` must not import
`compare.ts`; this keeps the dependency acyclic and leaves the main composed
simulation path as the numeric source of truth.

The following boundaries remain exact:

- custom per-monster setups replace the default form only for their monster;
- per-monster high-alch and overhead overrides retain their markers;
- the current target is forced visible when filters would otherwise hide it;
- persisted irrelevant rows remain hidden unless explicitly shown;
- drop filtering traverses the same generated loot names, keys and nested rows;
- default and invalid sort behavior, deterministic tie breaking and row order
  remain unchanged;
- XP/hr scaling remains relative to the visible rows; and
- positive and negative net-GP/hr scales remain separate.

`createCompareRows()` is retained as an explicit lightweight consumer for the
existing performance and view-model evidence. It is not dead code and must not
be deleted merely because the current pane renders Dense rows.

### Duel view model

Create `src/app/view-models/duel.ts`. Move the current Duel contracts, constants,
private helpers and public builders there:

- current-target comparison row, delta, best-marker and setup-diff contracts;
- matrix setup, row, cell, metric and result contracts;
- `createDuelComparisonViewModel()`; and
- `createDuelMatrixViewModel()`.

The Duel module may import:

- `createSimulationViewModel()` and its type from `simulation.ts` for live and
  snapshot metadata/results; and
- `createDenseCompareRows()` plus its row contract from `compare.ts` for the
  existing all-monster matrix.

It must not import React, pane components, controllers, adapters, storage or
browser APIs. `simulation.ts` and `compare.ts` must not import `duel.ts`.

Preserve the detailed behavior owned by
[duel-setup-diff-spec.md](duel-setup-diff-spec.md), including current-target
recalculation, shared-context exclusions, grouped setup differences, calculated
impact deltas, tolerance-based best markers and the statement that comparison
does not imply causal attribution.

The matrix continues to:

- include the live setup followed by normalized saved snapshots;
- evaluate every setup against every generated monster through the same
  composed result path;
- sort monsters by the current locale comparison behavior;
- return only structured-clone-safe data without source references; and
- remain calculated, ephemeral and outside all persistence envelopes.

### Compare calculation controller

Create `src/app/controllers/use-compare-calculation.ts`. This hook owns the
existing feature-specific calculation lifecycle now embedded in `App`:

- the exact 250 ms form debounce;
- starting `dense-compare` only while Compare is active and context exists;
- cancellation on source change, tab deactivation and unmount;
- source-reference freshness matching;
- failed, pending and ready state derivation;
- the pure filter/sort presentation pass against current Dense UI state; and
- visible-row scale, total-row and fixed freshness label derivation.

Its input consists only of the active flag and the current form, context,
cannon, loot preferences, custom setups, loot settings and Dense UI state. Its
return value is immutable pane-ready data; it exposes no React setter and no raw
Worker.

The hook must use `startCalculationTask()` and the existing
`DenseCompareCalculationRequest`. It must not call the domain directly, write
storage, mutate Dense UI state or retain stale results as fresh.

### Duel pane controller

Create `src/app/controllers/use-duel-pane.ts`. This hook owns only Duel-local
session presentation and calculation orchestration:

- current-monster versus all-monster view mode;
- expanded setup-diff row id;
- selected matrix metric and matrix filter;
- active-tab-only current-target comparison derivation;
- on-demand `duel-matrix` start, cancellation and busy state;
- exact source-reference freshness matching and stale-result invalidation;
- filtered matrix rows; and
- existing fixed global status messages through an explicit `onStatus`
  callback.

The first All monsters activation builds the matrix; later activation reuses a
fresh matrix. A stale matrix is not recomputed silently. Rebuild remains an
explicit user action. The busy guard prevents a second request while one is
running, and component unmount cancels the task. If source references change
during a run, its completion may be stored but fails the freshness check and is
never displayed, exactly as today. Late results from a no-longer-current task
are ignored by task identity.

The hook does not own snapshots, file transfer, persistence, recovery, live
form application or Undo. Those cross-feature mutations remain in `App` and
arrive at the pane as typed intent callbacks.

### Calculation task boundary

`src/app/calculation-task.ts` keeps the exact four request kinds and result
mapping. Only its imports change:

- Dense request execution and row types come directly from `compare.ts`;
- Duel matrix execution and result types come directly from `duel.ts`; and
- main simulation and Planner symbols remain direct imports from their current
  owner until their own phases.

Do not add re-exports to `simulation.ts` to avoid updating callers. App, tests,
performance smoke and the calculation task import each moved symbol from its
direct owner.

### Compare pane

Create `src/app/components/panes/compare-pane.tsx`. It owns the existing
`Monster comparison` section only:

- title and calculation-freshness pill;
- visible/total count and sort summary;
- monster and drop filters;
- show-hidden toggle and filter reset;
- sortable table headings;
- selected-row marker and persisted state markers;
- row relevance Hide/Restore action;
- scale-cell presentation; and
- bounded row keyboard navigation and target activation.

The shared `Combat setup` strip remains outside because Loadout also renders it.
The shared `Simulation results`, negative-net-GP guidance, warning and active
assumption region remains outside because Stats also renders it.

The pane receives one readonly model plus typed intent callbacks. It may own
private column metadata and presentation formatting, but it must not debounce,
start a calculation, read storage, construct a simulation request or mutate
state.

### Duel pane

Create `src/app/components/panes/duel-pane.tsx`. It owns the complete current
`Setup comparison` section:

- saved-count heading and Save/Manage controls;
- bounded import and export controls plus notice;
- current-monster/all-monsters view toggle;
- current-target table, rename, diff disclosure, load and delete actions;
- grouped setup differences and calculated impact table;
- matrix filter, metric selector, rebuild status and matrix table; and
- empty, busy, stale and ready states.

The pane receives one readonly model and one action object. Action names express
user intent rather than exposing React setters. The action surface covers:

- save, export and import snapshot file;
- select current-target or all-monster view;
- rename, load and delete snapshot;
- expand/collapse a setup diff;
- change matrix filter and metric;
- and rebuild the matrix.

For import, the pane extracts the selected `File`, awaits the caller action and
clears the native input in `finally`. The caller retains bounded file reading,
validation, merge, recovery unblocking, notice and status ownership. This
removes the React `ChangeEvent` dependency from the application action without
changing retry behavior.

The pane must not read storage, call an adapter, create or merge snapshots,
start a Worker, mutate the live form or implement Undo.

## Component contracts

Use model and action objects instead of broad prop lists:

```ts
export interface ComparePaneProps {
  hidden: boolean;
  model: ComparePaneModel;
  actions: ComparePaneActions;
}

export interface DuelPaneProps {
  hidden: boolean;
  model: DuelPaneModel;
  actions: DuelPaneActions;
}
```

Models contain only render-ready state and existing feature view-model values.
They do not contain `SimulationContext`, source-reference bundles, Worker
handles, React setters or storage objects. Callbacks retain current timing and
normalization; do not replace them with a generic `dispatch(type, payload)`.

## `App.tsx` ownership after the goal

`App` continues to own:

- the live and default `CombatSetupFormState`, setup mode and per-monster custom
  setups;
- persisted Dense UI state and its schema-owned mutations;
- Duel snapshot state, persistence effect, import/export validation and merge;
- target selection, loading snapshots into the live form and snapshot
  create/rename/delete transactions;
- local-state recovery unblocking, global status and one-step delete Undo;
- the roving workbench tablist and shared setup/result/warning strips;
- runtime, adapter and cross-feature composition; and
- mapping controller output and mutation bridges into pane model/action props.

`App` must no longer own:

- Compare or Duel feature markup;
- Dense worker/debounce/build/freshness state;
- Duel matrix task/build/busy/freshness state;
- Duel view mode, expanded-diff, matrix metric or matrix filter state; or
- Compare/Duel-only table column, formatting, CSS-class or accessibility-label
  helpers.

## Dependency direction

The intended direction is:

```text
domain + app state
        |
        v
simulation composition
        |
        v
compare view model
        |
        v
duel view model

state + compare/duel + calculation-task
        |
        v
feature controller hooks
        |
        v
App composition -> pure pane components
```

The arrows describe allowed imports, not runtime calls. Pane components may
import feature view-model types and shared pure presenters/formatters, but never
controllers. `simulation.ts` must not import Compare or Duel after the move.
The architecture gate must report no cycle or new layer exception.

## Implementation phases

### Phase 1 - freeze focused contracts

Before moving broad JSX or lifecycle code:

- add server-render semantic tests for Compare and both Duel branches;
- record exact landmarks, headings, table labels, button/field labels, disabled
  and status states, row order and important accessibility labels;
- retain existing direct Dense/Duel builder, adapter, calculation-task,
  performance and numeric evidence; and
- identify the existing browser scenarios that own keyboard, persistence,
  import/export, freshness, matrix, marker, scaling and event-loop behavior.

Tests assert durable semantic contracts, not entire raw markup snapshots.

### Phase 2 - split view-model ownership

Move Compare first and Duel second. Update App, calculation task, unit tests and
performance smoke to import the moved symbols directly. Delete old declarations
immediately; do not add a compatibility re-export.

After each move, run typecheck, architecture and the focused view-model and
calculation-task suites. Verify that Dense and Duel still call the rates-only
main simulation path with hit-distribution analysis omitted.

### Phase 3 - extract calculation controllers

Move the Dense debounce/task/freshness lifecycle, then the Duel view/matrix
lifecycle. Keep the existing App markup during this phase so orchestration
regressions are isolated from DOM movement.

Preserve source identity, task cancellation, explicit rebuild, status copy and
stale-result behavior. Do not generalize the two hooks into a generic
calculation controller: their activation and freshness rules are different.

### Phase 4 - extract pane presentation

Move the exact `Monster comparison` section, then the complete
`Setup comparison` section. App supplies controller results and current mutation
bridges through the typed contracts.

Preserve DOM order, classes, copy, roles, labels, hidden behavior, keyboard
navigation, file-input reset and callback timing. Do not reorganize the tables
or adjust responsive layout.

### Phase 5 - composition cleanup

After behavior gates pass:

- remove obsolete App-only types, refs, helpers and imports;
- narrow feature-module exports to actual consumers;
- remove forwarding objects that only rename one field;
- verify that no duplicate Compare/Duel formatter or row contract remains;
- verify direct imports and absence of compatibility barrels; and
- update current architecture/testing evidence with measured final counts.

Line count is evidence, not an acceptance target.

## Compatibility invariants

The complete goal preserves:

- every visible string, numeric precision, row/column order and status label;
- the `Monster comparison`, `All monsters` and `Setup comparison` landmarks;
- the `Saved setup controls` and `Setup comparison view` accessibility labels
  plus the existing table labels;
- Compare selected-row focus, arrow/Home/End navigation and Enter/Space target
  activation;
- Dense filter normalization, target forced visibility, persisted relevance,
  marker and scale behavior;
- the 250 ms debounce, pending/ready/unavailable labels and source-freshness
  rules;
- Duel snapshot limit, naming, Save/Rename/Load/Delete/Undo behavior and current
  target preservation on load;
- Duel import/export filename, accepted file types, strict envelope validation,
  safe merge, fixed notices and retryable input reset;
- current-target setup differences, calculated deltas and best markers;
- on-demand matrix activation, filter, metric, current-target marker, stale
  state and explicit rebuild;
- `dense-compare` and `duel-matrix` worker request/result structures;
- rates-only omission of hit-distribution construction;
- rewrite-setup, Duel, recovery and migration persistence behavior;
- D-094 entry budgets and generated-runtime deferred chunk; and
- existing responsive and visual output.

No visual baseline update is expected. A screenshot difference is a regression
to investigate, not permission to accept new baselines.

## Tests and validation

Add focused tests:

- `src/tests/compare-duel-panes.test.ts` for server-render semantic contracts of
  Compare, Duel current-target and Duel matrix states; and
- focused controller tests for activation, debounce, cancellation, source
  freshness, stale matrix and explicit rebuild. These may use a small existing
  Worker test double; do not duplicate browser calculation code.

Existing Dense/Duel cases remained in the combined UI view-model suite during
the mechanical move. The later ARCH-2026-05 maintenance split moved them
unchanged into `compare-view-model.test.ts` and `duel-view-model.test.ts`.

Minimum focused gate:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/*-view-model.test.ts src/tests/ui-adapters.test.ts src/tests/calculation-task.test.ts src/tests/ui-performance.test.ts src/tests/compare-duel-panes.test.ts src/tests/compare-duel-controllers.test.ts
npm run numeric:audit
npm run test:e2e -- --workers=1 -g "dense combat spreadsheet root|bounded keyboard navigation|saved setup comparison|all-monster saved setup matrix|main event loop|dense compare calculation freshness|filters dense compare rows|dense XP and net GP scale|dense row markers"
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

The implementation report records final source-module counts, `App.tsx`,
`simulation.ts`, Compare/Duel module and controller sizes, focused/full test
counts, functional and visual results, artifact entry bytes and SHA-256. Counts
are evidence, not success criteria.

## Allowed implementation scope

Expected source changes are limited to:

- `src/app/App.tsx`;
- `src/app/calculation-task.ts`;
- the new Compare/Duel view-model modules;
- the new Compare/Duel controller hooks;
- the new Compare/Duel pane components;
- direct component/view-model import consumers;
- focused tests and mechanical test imports; and
- owning architecture, testing, backlog and documentation indexes.

No domain, generated-data, state schema, adapter, server, Worker implementation,
deployment or CSS file should change. If one becomes necessary, stop and update
the specification before broadening implementation.

## Documentation updates on implementation

- Mark this specification implemented and append exact evidence.
- Update the parent composition-root specification Phase 3C status.
- Update `docs/technical/architecture.md` with actual owners, dependency
  direction and measured module/line counts.
- Update `docs/technical/testing.md` with final focused and full gates.
- Move the Compare/Duel backlog row to `Done` while leaving later pane and
  simulation-view-model families open.
- Do not add a new decision unless implementation changes a boundary beyond
  D-093.

## Implementation evidence

- `compare.ts` now owns Compare/Dense row generation, filtering, sorting,
  markers and scales. `duel.ts` owns current-target rows, setup diffs and the
  all-monster matrix. They import the existing rates-only simulation path in
  the specified acyclic direction; `simulation.ts` has no Compare/Duel
  declarations or compatibility re-exports.
- `use-compare-calculation.ts` owns the unchanged 250 ms debounce, cancellable
  `dense-compare` task and source freshness. `use-duel-pane.ts` owns Duel-local
  view state plus the explicit cancellable `duel-matrix` lifecycle. Pure pane
  components own the exact Compare and Duel markup; `App` keeps form/snapshot
  mutation, persistence, recovery, status and Undo.
- `App.tsx` decreased from 7,273 to 6,387 lines and from 58 to 51 React state
  cells. `simulation.ts` decreased from 2,583 to 1,502 lines. The new Compare
  and Duel view models are 375 and 725 lines; their controllers are 183 and 216
  lines, and their panes are 320 and 500 lines.
- The architecture gate passes with 94 source modules, 82 client-reachable
  modules, seven explicit external entrypoints, no cycles and no exceptions.
  No domain, state schema, adapter, server, Worker entry, generated-data, CSS or
  deployment contract changed.
- The six focused suites pass 158/158, the numeric audit passes all 5,958
  cross-path comparisons, the focused production-preview gate passes 9/9 and
  the complete Chromium gate passes 77/77. Full `npm run verify` passes 50 test
  files / 704 tests, 19 explicit goldens and the architecture, typecheck,
  build/artifact, lint, format and diff gates.
- The 10-file/two-asset artifact entry is 705,080 raw / 204,250 gzip bytes,
  within D-094 limits; total bytes are 1,960,804 and SHA-256 is
  `8c7eceed5b825635db942e08e971c44663e9c4769d758c1d357acba4025fac9c`.
  The canonical fresh visual command and an equivalent port-5173 runner were
  both blocked before browser execution by managed-sandbox `listen EPERM`.
  No screenshot baseline or permanent runner configuration changed; the most
  recent successful read-only visual comparison remains the preceding
  Stats/Loadout 20/20 run against the same 31 Darwin PNGs.

## Done criteria

- Compare and Duel render through their own pane components.
- Dense automatic calculation and Duel session/matrix orchestration have
  focused controller-hook owners outside `App`.
- Compare/Dense and Duel builders/types have direct feature owners outside
  `simulation.ts`.
- `simulation.ts` remains the main composed-result adapter and does not import
  or re-export Compare/Duel.
- App retains cross-feature state mutation and persistence but no longer owns
  feature markup, table helpers or calculation lifecycle state.
- Domain, request, worker, persistence, import/export, copy, DOM, CSS, numeric
  and visual contracts are unchanged.
- Focused, numeric, browser and full repository gates pass; any
  environment-only visual-server startup limitation is recorded without
  changing baselines.
- Owning documentation reports actual implementation evidence.

## Open questions

- After this phase, should Loot/Trip/Risk or Planner be the next D-093 family?
  Decide from the remaining dependency map and focused browser evidence.
- Should Duel snapshot file transfer later receive its own controller, matching
  rewrite setup and PriceSet transfer? This phase deliberately leaves it in
  `App`; reassess only after the pane/controller extraction shows the remaining
  transaction boundary.

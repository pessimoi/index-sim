# Stats/Loadout pane and view-model refactor specification

- Status: implemented
- Date: 2026-07-13
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

Extract the Stats and active-setup/Loadout presentation families from
`src/app/App.tsx` and split their presentation logic out of
`src/app/view-models/simulation.ts` without changing behavior.

This is an ownership refactor. It must preserve the current calculation,
request, persistence, DOM, copy, styling, accessibility and browser-action
contracts. The phased parent contract remains
[app-composition-root-refactor-spec.md](app-composition-root-refactor-spec.md),
and D-093 remains the accepted architecture decision.

## Current evidence

At specification time, including the pending architecture-audit cleanup:

- `src/app/App.tsx` is 7,725 lines and owns 58 React state cells;
- `src/app/view-models/simulation.ts` is 4,978 lines;
- `App` still renders the complete Stats analysis and active Loadout family;
- the Loadout family includes equipment controls, requirement warnings, quick
  actions, bounded optimization, manual combat overrides, special-attack setup
  and the normal-versus-special damage distribution;
- the simulation view-model owns Stats, hit-distribution, setup-requirement,
  loadout optimizer, active-assumption, loot, compare/duel, Planner,
  MonsterCard, option-builder and formatting concerns in one module; and
- the current domain, `FullSimulationResult`, worker, persistence and adapter
  boundaries are sound. The problem is change concentration, not duplicate
  numeric truth.

The current audit and repository gates show no calculation blocker. This goal
must therefore avoid mixing product fixes into the structural move.

## Goals

- Make Stats and Loadout independently reviewable feature-pane owners.
- Keep `App` as the application composition root and live form-state owner.
- Keep `simulation.ts` as the main simulation composition adapter while moving
  feature-specific presentation builders behind direct imports.
- Narrow the public export surface as types and builders move to their actual
  owner.
- Preserve all existing numeric, DOM, keyboard, responsive and visual evidence.
- Leave a repeatable seam for the later Compare/Duel, Loot/Trip/Risk, Planner
  and Economy/Settings phases.

## Non-goals

- No combat, trip, XP, risk, loot, economy or optimizer formula change.
- No `SimulationRequest`, `SimulationContext`, `FullSimulationResult`, worker
  request/result or timeout/cancellation change.
- No form-state, localStorage key, envelope, migration, import/export, share or
  Duel snapshot change.
- No copy, precision, DOM order, semantic role, label, focus behavior, CSS class
  or stylesheet change.
- No new state library, context provider, reducer, router or feature service.
- No lazy loading, bundle split or persistent-worker work.
- No quest-, ownership-, price-, ammo- or spell-aware optimizer extension.
- No test-suite decomposition beyond adding focused ownership tests required by
  this extraction.
- No archived legacy runtime or domain-module refactor.

If the extraction exposes an existing behavioral defect, record it as a
follow-up. Do not repair it in this goal unless it prevents the structural move
and is separately documented.

## Preserved sources of truth

| Concern                                   | Owner after this goal                                   |
| ----------------------------------------- | ------------------------------------------------------- |
| Combat, special and probability mechanics | `src/domain/combat`                                     |
| Equipment bonus summing                   | `src/domain/equipment`                                  |
| Trip, incoming damage, supplies and loot  | `src/domain/trip`                                       |
| Composed combat/trip/XP/economy result    | `src/domain/simulation`                                 |
| Setup form and per-style loadouts         | `src/app/state/ui-state.ts` plus `App` live state       |
| Hidden-tier and visible-option policy     | Existing app state and option inputs                    |
| Bounded optimizer calculation             | New Loadout view-model owner, behavior copied unchanged |
| Stats and hit-distribution presentation   | New Stats view-model owner                              |
| Active-assumption summary                 | New cross-feature summary view-model owner              |
| Browser orchestration, Apply and Undo     | `src/app/App.tsx`                                       |
| Pure Stats/Loadout markup                 | New pane components under `src/app/components/panes`    |

No new result object may become a parallel replacement for
`FullSimulationResult`.

## Target module map

### View-model leaf contracts

Create `src/app/view-models/contracts.ts` as a deliberately small leaf module.
It owns only cross-feature presentation contracts currently trapped in
`simulation.ts`, initially:

- `SelectOptionViewModel`; and
- `CalculationWarningViewModel`.

Create `src/app/view-models/formatting.ts` for the exact current
`formatNumber()` implementation. All callers migrate to the direct owner. Do
not retain a compatibility re-export from `simulation.ts`.

These modules must not import a feature view-model module, React, app state,
adapters or browser APIs. They are not general dumping grounds; adding another
contract requires at least two real feature consumers.

### Stats view model

Create `src/app/view-models/stats.ts`. It owns the current types and pure
builders for:

- normal and whole-special hit-distribution presentation;
- source-detail hit distributions for special attacks and cannon;
- Stats combat-roll metrics;
- XP routing;
- Trip and banking summary rows; and
- Stats source breakdown rows and detail cards.

The initial public surface is limited to the types consumed by components and
the builders consumed by `createSimulationViewModel()`. Tests import focused
builders directly from this module. Nested helpers remain private.

The following behavioral boundaries remain exact:

- miss and accurate zero stay distinct;
- multi-hit specials retain the D-083 whole-event convolution;
- cannon remains a separately scoped per-fired-ball source detail;
- target-HP KO context and cumulative probabilities use the existing data;
- rates-only Dense/Duel paths with `includeHitDistributionAnalysis: false`
  still omit transient distribution construction; and
- invalid/non-finite distribution inputs continue to fail closed.

### Loadout view model

Create `src/app/view-models/loadout.ts`. It owns:

- setup-requirement contracts and generated-first/D-051 fallback summaries;
- gear quick-action contracts, scoring and requirement reason copy;
- bounded loadout optimizer inputs, result types and implementation;
- weapon, ammo, spell, equipment-slot and style option builders used by the
  active Loadout family; and
- pure Loadout pane presentation derivation introduced by this goal.

`monsterOptions()` is not Loadout-owned and remains outside this module.

The optimizer is moved byte-for-byte or mechanically, then covered by the same
tests. Its preserved contract includes:

- current form as the no-regression baseline;
- checked-by-default `respect-current-levels` policy in the UI;
- explicit `ignore-requirements` mode;
- visible-option and hidden-tier boundaries;
- two-handed shield normalization;
- deterministic Pareto frontier, 512-state cap and tie breaking;
- no independent ammo or spell search; and
- one caller-owned Apply/Undo transaction.

The module may call pure domain functions as the current optimizer does. It may
not read React state, storage, adapters, the DOM or the network.

### Active assumptions view model

Create `src/app/view-models/active-assumptions.ts`. It owns the current
active-assumption category, review/reset target, row and summary contracts plus
their pure builder.

This owner receives explicit structural inputs. It must not import the broad
`SimulationViewModel` or `LootDropRowViewModel` from `simulation.ts`; define the
smallest input contract it actually reads. This prevents a reverse dependency
back into the composition adapter.

The existing presenter remains in
`src/app/components/combat-result-presenters.tsx`. The shared result warning
slot remains in `App` because it is displayed for both Stats and Compare.

### Simulation composition adapter

`src/app/view-models/simulation.ts` remains the owner of:

- `SimulationViewModel` and `createSimulationViewModel()` composition;
- loot presentation and optimization;
- MonsterCard view-model composition;
- Compare/Dense and Duel view models;
- Planner adapters and presentation; and
- any still-shared main-result orchestration not moved above.

It imports the new Stats, Loadout, active-assumption, contract and formatting
owners. It must not re-export their symbols as a compatibility barrel.

The existing `SimulationViewModel` object shape stays compatible during this
goal. Its Stats, requirement and assumption fields may use types imported from
their new modules, but field names and runtime values remain unchanged.

### Pane components

Create these pure presentation owners:

- `src/app/components/panes/stats-pane.tsx`
- `src/app/components/panes/loadout-pane.tsx`

The Stats pane owns the current `Stats analysis` section:

- source breakdown and detail panels;
- combat-roll detail;
- XP routing; and
- Trip and banking summary.

The shared result metric strip, negative-net-GP guidance, price warnings and
active-assumption summary remain outside StatsPane because they are currently
shared by Stats and Compare.

The Loadout pane owns the contiguous active-setup family:

- `Equipment loadout` controls and equipment bonuses;
- requirement warnings and per-slot quick actions;
- session-local optimizer controls;
- manual combat overrides;
- special-attack controls and result metrics; and
- the `Damage distribution` section.

LoadoutPane may use private child components in the same file. Split a child
into a second file only when it has a coherent typed contract of its own; do not
create one file per small JSX block.

Both pane components receive readonly values plus callback props. They must not
read context, call `setFormSafe`, invoke the optimizer, construct a simulation
request, start a worker, read storage or call an adapter.

## Component contracts

Use one value object and one action object rather than dozens of unrelated
top-level props:

```ts
export interface StatsPaneProps {
  hidden: boolean;
  model: StatsPaneViewModel;
}

export interface LoadoutPaneProps {
  hidden: boolean;
  model: LoadoutPaneViewModel;
  actions: LoadoutPaneActions;
}
```

`StatsPaneViewModel` is a transport view over existing Stats fields. It does not
rerun simulation. `LoadoutPaneViewModel` contains only the existing selected
values, option lists, locked/disabled/status state, quick actions, requirement
summary, calculated bonuses, special presentation and distribution view model.

`LoadoutPaneActions` names user intent rather than exposing React setters. It
must cover the current operations explicitly:

- weapon, ammo, spell and style selection;
- primary and multi prayer/boost selection;
- sustained and repot changes;
- optimizer eligibility toggle and optimize request;
- manual override change and reset;
- equipment selection and per-slot quick action;
- hidden-tier disclosure/toggle operations already rendered in this family;
- special weapon/ammo/energy/override changes and reset; and
- any existing setup-tab review action rendered inside the moved markup.

Callbacks keep their current timing and normalization. Do not replace typed
intent callbacks with a generic `dispatch(type, payload)` API.

## `App.tsx` ownership after the goal

`App` continues to own:

- `activeTab` and the roving tablist/tabpanel relationship;
- the live `CombatSetupFormState` and `respectLoadoutRequirements` session state;
- `setFormSafe`, per-style default/custom setup mutation and persistence effects;
- optimizer invocation, success/no-change status and one-step Undo application;
- review/reset routing for active assumptions;
- shared Stats/Compare result strip and warning slot;
- runtime, worker, adapter and controller orchestration; and
- composition of pane models and action bridges.

`App` must no longer own the Stats analysis or Loadout-family JSX. Tiny callback
bridges are expected; feature presentation derivation is not.

## Dependency direction

The intended direction is:

```text
domain + app state
        ↓
view-model contracts / formatting
        ↓
stats | loadout | active-assumptions
        ↓
simulation composition
        ↓
App composition + pure pane components
```

Stats, Loadout and active assumptions must not import one another. Shared data
belongs in the small leaf contracts or is passed explicitly. The architecture
gate must report no cycle or new layer exception.

## Implementation phases

### Phase 1 - freeze focused contracts

Before moving broad JSX or builders:

- add server-render contract tests for the Stats and Loadout pane roots;
- record exact region names, heading order, important status/disabled states,
  field labels and damage-distribution accessibility labels;
- retain existing focused optimizer and Stats view-model coverage; and
- identify the existing browser scenarios that own action wiring.

The tests should assert durable semantic/DOM contracts, not entire raw markup
snapshots.

### Phase 2 - split view-model ownership

Move the leaf contracts/formatter, then Loadout, Stats and active-assumption
types/builders. Keep `App` markup unchanged during this phase.

After each move:

- update consumers to direct imports;
- remove the old declaration immediately;
- do not add re-export shims;
- run typecheck and the focused view-model suites; and
- verify that rates-only callers still avoid hit-distribution work.

### Phase 3 - extract pane presentation

Move the exact Stats analysis JSX first, then the Loadout family. `App` builds
the value/action props from its current state and handlers.

Preserve section order, `hidden` behavior, classes, labels, roles and callback
semantics. Do not opportunistically rename controls, reorganize groups or
adjust responsive layout.

### Phase 4 - composition cleanup

After behavior gates pass:

- remove obsolete App-only presentation helpers and imports;
- narrow new feature-module exports to actual consumers;
- remove forwarding objects that only rename one field;
- verify there are no duplicate formatters, option builders or requirement
  helpers; and
- update current architecture/testing evidence with measured final counts.

Line count is evidence, not an acceptance target. Do not contort component APIs
to reach a specific number.

## Compatibility invariants

The complete goal preserves:

- every visible string, value precision, row order and status label;
- `Stats analysis`, `Equipment loadout`, special and `Damage distribution`
  landmarks and their current hidden behavior;
- roving workbench tab focus and setup-tab naming;
- selector search, disabled and two-handed shield behavior;
- prayer/boost primary and multi-selection normalization;
- session-local optimizer policy, deterministic result and Undo copy/timing;
- manual override placeholders, limits, reset and request mapping;
- source details, probability buckets, exact table and keyboard interaction;
- `SimulationViewModel` runtime shape and `FullSimulationResult` ownership;
- rates-only omission of hit-distribution analysis;
- persisted setup/share/import/Duel schemas and storage writes; and
- D-094 entry budgets and deferred generated-runtime chunk.

No visual baseline update is expected. A screenshot difference is a regression
to investigate, not permission to accept new baselines.

## Tests and validation

Add focused tests:

- `src/tests/stats-loadout-panes.test.ts` for server-render semantic contracts;
- direct Stats builder tests in the existing view-model suite or a focused
  `stats-view-model.test.ts` if moving the existing cases materially reduces
  ownership ambiguity; and
- direct Loadout optimizer/requirement/quick-action tests in the existing suite
  or a focused `loadout-view-model.test.ts` under the same rule.

Do not rewrite unrelated tests merely to shorten large files. Existing case
names and assertions remain the regression baseline.

Minimum focused gate:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/*-view-model.test.ts src/tests/ui-adapters.test.ts src/tests/stats-loadout-panes.test.ts src/tests/cannon-pane.test.ts src/tests/monster-card-panel.test.ts
npm run numeric:audit
npm run test:e2e -- --workers=1 -g "Stats|damage distribution|loadout|optimizes the visible whole loadout"
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

The implementation report records final source-module counts, `App.tsx` and
`simulation.ts` line counts, focused/full test counts, functional and visual
results, artifact entry bytes and SHA-256. Counts are evidence, not success
criteria.

## Allowed implementation scope

Expected source changes are limited to:

- `src/app/App.tsx`;
- `src/app/view-models/*`;
- `src/app/components/panes/*`;
- direct component/view-model import consumers;
- focused tests and existing browser assertions when import-only movement is
  required; and
- owning architecture, testing, backlog and documentation indexes.

No domain, generated data, schema, adapter, server, Worker, deployment or CSS
file should change. If one becomes necessary, stop and update the specification
before broadening implementation.

## Documentation updates on implementation

- Mark this specification implemented and append exact evidence.
- Update the parent composition-root specification Phase 3 status.
- Update `docs/technical/architecture.md` with the actual new owners and current
  module/line counts.
- Update `docs/technical/testing.md` with the final focused and full gates.
- Move the Stats/Loadout backlog row to `Done` while leaving later pane and
  simulation-view-model families open.
- Do not add a new decision unless implementation changes a boundary beyond
  D-093.

## Done criteria

- Stats analysis and the active Loadout family render through pure pane
  components.
- `App` retains composition and state mutation but no longer owns their feature
  markup or presentation derivation.
- Stats, Loadout and active-assumption builders/types have direct feature
  owners outside `simulation.ts`.
- `simulation.ts` composes those builders without compatibility re-exports or
  cycles.
- Domain, request, result, worker, persistence, copy, DOM, CSS and visual
  contracts are unchanged.
- Focused, numeric, browser, visual and full repository gates pass.
- Owning documentation reports actual implementation evidence.

## Implementation evidence

- `StatsPane` now owns the exact `Stats analysis` landmark, while `LoadoutPane`
  owns `Equipment loadout`, special attack and `Damage distribution` without a
  wrapper or CSS change. `App` retains live form state, safe mutations,
  optimizer Apply/Undo and workbench-tab orchestration.
- `contracts.ts` and `formatting.ts` are dependency leaves. `stats.ts`,
  `loadout.ts` and `active-assumptions.ts` own their focused contracts and pure
  builders; they do not import one another. `simulation.ts` composes them by
  direct import and provides no compatibility re-exports.
- Final measured sizes are 7,273 lines for `App.tsx`, 2,583 for
  `simulation.ts`, 1,190 for `stats.ts`, 881 for `loadout.ts`, 538 for
  `active-assumptions.ts`, 141 for `stats-pane.tsx` and 380 for
  `loadout-pane.tsx`. These are evidence only, not budgets.
- The focused type/view-model/pane gate passes 150/150. The architecture gate
  passes with 88 source modules, 76 client-reachable modules, seven documented
  external entrypoints, no cycles and no exceptions. The numeric user-path
  audit passes 5,958 comparisons with zero mismatches, and the focused
  production-preview Chromium gate passes 4/4 for Stats, damage distribution,
  requirements, style-loadout restoration and optimizer Apply/Undo. The full
  production-preview gate passes 77/77.
- Full `npm run verify` passes 48 test files / 697 tests, 19 explicit goldens,
  build/artifact, lint, formatting and diff gates. The ten-file artifact has two
  assets, a 701,528-byte raw / 202,769-byte gzip direct entry, 1,957,246 total
  bytes and SHA-256
  `e038cc6f5934be86635fb1b5ef59024aca4814fb9574541dc11b85a41d1dd13b`.
  Dependency audit was skipped only by the network-disabled gate policy; the
  immediately preceding architecture-audit run reported zero vulnerabilities.
- The canonical visual config's dedicated preview port was denied by the
  managed sandbox. An equivalent read-only run used the standard E2E web-server
  path with the same visual spec, tolerances and exact Darwin snapshot paths;
  all 20 scenarios passed against 31 reviewed PNGs. No baseline was written and
  both Playwright configs were restored unchanged.

## Open questions

- Resolved on 2026-07-13: Compare/Duel is the next D-093 pane family. Its
  implementation boundary is owned by
  [compare-duel-pane-refactor-spec.md](compare-duel-pane-refactor-spec.md).
- Should the large existing view-model test file be split during a later
  feature change? This goal permits only focused new files and mechanical import
  moves, not a broad test rewrite.

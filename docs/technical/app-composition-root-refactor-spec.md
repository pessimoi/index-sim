# App composition-root refactor specification

Status: shared presenters, ten focused controller slices, Cannon,
Stats/Loadout, Compare/Duel, Planner, Risk, Loot/Trip, Economy/Settings, the pure
MonsterCard rail and the bounded
[Phase 4 composition review](app-composition-root-phase4-spec.md) are
implemented, 2026-07-14. The phased D-093 composition-root refactor is closed.

## Problem

`src/app/App.tsx` has grown past 10,000 lines. It is still the rewrite
composition root, but it also contains reusable form controls, dialogs, status
presenters, SVG charts, result-detail presenters, feature-pane markup and most
browser-state orchestration. The typed domain, state and view-model boundaries
remain sound; the concentration is a maintainability and reviewability problem,
not evidence that those boundaries should be replaced.

Large all-at-once extraction would mix unrelated user paths and make regression
evidence hard to interpret. The refactor therefore proceeds through independent,
behavior-preserving phases.

## Goals

- Keep `App` as the single application composition root.
- Move reusable, cohesive UI responsibilities into `src/app/components`.
- Make later feature-pane and controller extraction small enough to specify,
  implement and validate independently.
- Preserve the existing domain, view-model, adapter and persisted-state
  boundaries.
- Reduce review risk by prohibiting product, calculation and copy changes inside
  structural extraction phases.

## Non-goals

- No calculation, formula, fixture or generated-data change.
- No persisted schema, storage key, migration or setup/share contract change.
- No UI copy, layout, CSS selector or accessibility-contract change.
- No new state library, router, backend, provider or deployment shape.
- No code splitting solely because `App.tsx` is large; bundle decisions require
  the separate measured bundle goal.
- No archived legacy runtime refactor.

## Target boundaries

### Composition root

`src/app/App.tsx` owns top-level state composition, effect wiring, async task
coordination, adapter calls and routing data/actions to feature panes. It may
assemble view-models and pass typed props, but reusable controls and pure
presenters do not belong there.

### Shared app components

`src/app/components` may depend on React, app view-model types, app-state types
used only as presentation contracts and domain value types. Components in this
folder must not read storage, call adapters, start calculations or mutate
module-level state.

Phase 1 establishes these cohesive owners:

- `form-fields.tsx`: select/search/numeric/read-only form controls and their
  input normalization.
- `app-presenters.tsx`: generic import notice, share dialog, undo strip, Dense
  scale cell and MetricList.
- `combat-result-presenters.tsx`: warning rendering, hit-distribution charts and
  Stats/assumption detail presenters.
- `price-history-charts.tsx`: Economy trend and sparkline SVG rendering.
- `presentation-formatters.ts`: shared pure price/delta presentation helpers.

## Phased implementation plan

### Phase 1 - shared controls and pure presenters (implemented)

Move the components above without changing JSX, strings, callbacks, DOM roles,
CSS class names or numeric normalization. Keep their props explicit. `App`
imports and composes them.

Acceptance boundary: no source module below `src/app/components` performs a
storage, network, worker or calculation side effect.

### Presenter API hygiene - independent small goal (implemented)

[The implemented MetricList presenter hygiene specification](metric-list-presenter-hygiene-spec.md)
converts the exported direct-call render helper into a normal props-based
component and moves it to the generic presenter owner without changing DOM,
values or layout.

### Phase 2A - runtime bootstrap controller (implemented)

[The implemented runtime bootstrap controller specification](runtime-bootstrap-controller-spec.md)
moves generated-runtime lifecycle, current-game-data compatibility and
selected/scheduled/bundled/manual startup price resolution behind one typed
result. D-094's dynamic chunk boundary, sanitized failures and the
pre-persistence ready gate remain regression boundaries.

### Phase 2B - local-state recovery controller and panel (implemented)

[The implemented local-state recovery controller specification](local-state-recovery-controller-spec.md)
centralizes report/failure/block/skip/persist/clear/export mechanics and moves
the pure Settings recovery section while feature values and persistence effects
retain their current owners. Clear and compatible replacement keep distinct
one-shot-persistence semantics.

### Phase 2C - Hiscores lookup controller and topbar panel (implemented)

[The implemented Hiscores lookup controller specification](hiscores-lookup-controller-spec.md)
owns same-origin status/lookup lifecycle,
request-sequence freshness, preview state, sanitized notices and last-player
recovery integration while `App` retains the combat form and applies only a
fresh typed response. The topbar component owns the existing markup and bounded
details/Escape/outside-focus interaction without a network or storage
dependency.

### Phase 2D - rewrite setup file-transfer controller (implemented)

[The implemented setup file-transfer controller specification](setup-file-transfer-controller-spec.md)
centralizes bounded file reading, parser invocation, fixed notices,
recovery-aware persistence and export-envelope
construction behind a typed ready/rejected outcome. `App` keeps the six live
setup state owners, applies only a ready outcome and retains the tiny file-input
reset and topbar DOM bridges.

### Phase 2E - PriceSet transfer and acceptance controller (implemented)

[The implemented PriceSet controller specification](price-set-transfer-controller-spec.md)
centralizes bounded import, generated-alch/manual-overlay composition, selected
persistence, recovery, latest-state history update, export and reset behind
typed outcomes. `App` retains fallback selection and runtime state application.

### Later controller slices - future goals

Specify any remaining legacy migration orchestration independently. Do not fold
it into the implemented Phase 2 controllers.

### Phase 3A - Cannon pane (implemented)

[The implemented Cannon pane specification](cannon-pane-extraction-spec.md)
moves one low-coupling pane and all of its presentation-only derivation behind
explicit calculated values and primitive action props. Schema-validated
per-monster mutation and Trip synchronization remain in `App`.

### Phase 3B - Stats/Loadout pane and view-model owners (implemented)

[The implemented Stats/Loadout specification](stats-loadout-pane-refactor-spec.md)
defines this D-093 phase. It moves the pure Stats analysis and active
Loadout presentation behind typed value/action props and splits their Stats,
Loadout and active-assumption view-model families out of the cross-feature
simulation module. `App` retains live form state, mutation, optimizer Apply/Undo
and tab orchestration; domain, result, worker, persistence, DOM and CSS
contracts remain unchanged.

### Phase 3C - Compare/Duel panes, view models and calculation controllers (implemented)

[The implemented Compare/Duel specification](compare-duel-pane-refactor-spec.md)
defines this D-093 phase. It moves the pure Compare and Duel markup, splits
their feature contracts/builders out of `simulation.ts`, and gives the current
Dense and Duel-matrix worker lifecycles focused hook owners. `App` retains live
form and snapshot mutation, persistence, recovery and Undo. Domain/result truth,
worker messages, schemas, DOM, copy and CSS remain unchanged.

### Phase 3D - Planner pane, view model and calculation controller (implemented)

[The implemented Planner specification](planner-pane-refactor-spec.md) defines
this D-093 phase. It moves the complete Planner markup and direct
feature builders out of App/simulation, and gives the current
explicit-Recompute Worker lifecycle a focused hook owner. `App` retains the
versioned Planner draft state, persistence/recovery, typed draft mutations and
tab composition. Planner algorithms, worker messages, schemas, DOM, copy and
CSS remain unchanged.

### Phase 3E - Risk pane, view model and analysis controller (implemented)

[The implemented Risk specification](risk-pane-refactor-spec.md) defines this
D-093 phase. It moves the complete Risk landmark and its
feature-only contracts/formatters out of App, and gives the current transient
controls plus explicit Run/Cancel Worker lifecycle a focused hook owner. `App`
retains live form/context/cannon/loot sources, global status composition and the
four fresh-only TTK/net-GP/Trip presentation bridges. Risk formulas, request
messages, transient-state behavior, stale results, DOM, copy and CSS remain
unchanged.

### Phase 3F - Loot and Trip panes and view models (implemented)

[The implemented Loot/Trip specification](loot-trip-pane-refactor-spec.md)
defines this D-093 phase. It moves both complete landmarks and their
feature-only presentation derivations out of App, gives Loot and Trip direct
view-model owners, and splits the shared simulation-input mapping into a small
cycle-free leaf. App retains the versioned setup form and per-monster loot
states, persistence/recovery/share replacement, normalized mutation, global
Undo/status, Active assumptions and cross-pane composition. Trip/loot/supply
formulas, schemas, request/result shapes, DOM, copy and CSS remain unchanged.

### Phase 3G - Economy/Settings pane family and price-data view models (implemented)

[The Economy/Settings specification](economy-settings-pane-refactor-spec.md)
defines the final currently identified Phase 3 pane family. It moves the exact
shared Economy/Settings wrapper and child DOM to a pure component, gives price
and hidden-tier presentation direct DOM-free owners and makes the Loot history
bridge neutral. App retains PriceSet/recovery controllers, browser state,
persistence transactions, manual/history mutation, tab composition and
cross-pane routing. Price formulas, schemas, DOM, copy and CSS remain
unchanged.

### Phase 4 - composition review (implemented)

[The Phase 4 final shell and ownership review specification](app-composition-root-phase4-spec.md)
moves the remaining pure header/review/workbench shell and legacy-report
presentation to direct owners, relocates a bounded set of feature helpers and
removes obsolete forwarding code. App intentionally retains browser bootstrap,
46 state cells, seven persistence effects, controller outcomes, multi-feature
transactions and direct pane composition. There is no target line count:
responsibility and dependency direction are the acceptance criteria.

## Compatibility contract

Every structural phase must preserve:

- rendered copy, semantic roles, labels, focus behavior and CSS class names
- component callback timing and value normalization
- calculation requests, view-model inputs and displayed numeric precision
- localStorage keys, envelopes, versions and recovery behavior
- setup/share/import/export payloads
- existing Playwright selectors and golden fixtures

If extraction exposes a behavioral defect, document it as a follow-up rather
than silently fixing it in the same structural change.

## Acceptance checks

Phase 1 requires:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/ui-adapters.test.ts src/tests/ui-view-model.test.ts
npm run test:e2e -- --workers=1
npm run verify
git diff --check
```

Later controller or pane phases must add focused tests for the behavior being
moved before or with the extraction. Golden fixtures need rerunning whenever a
phase could affect request composition, even if no intended numeric change
exists.

## Sequencing decision

- Phase 3G moved the measured post-Phase-3F Economy/Settings pane family and
  cohesive price presentation derivation to direct pure owners without moving
  browser transactions or cross-pane source state.
- Phase 4 moved the measured post-Phase-3G pure shell, legacy presentation and
  direct feature helpers without hiding App's browser state, persistence or
  atomic cross-feature transactions in another monolith. The phased D-093 card
  is complete; any further state/controller or large-module split requires
  separate defect or measurement evidence.

## Phase 1 implementation evidence

- Five side-effect-free component/support modules now own the extracted controls,
  presenters, charts and formatters under `src/app/components`.
- `src/app/App.tsx` decreased from 10,178 to 8,856 lines; no CSS, domain, state,
  adapter, persisted schema or generated-data file changed in this phase.
- `npm run architecture:check` passes with 68 source modules, no cycles, 55
  client-reachable modules and zero documented exceptions.
- The focused UI adapter and view-model suites pass 144/144 tests.
- The full production-preview Chromium gate passes 76/76, including searchable
  fields, share/import/Undo flows, combat distributions, Dense scale cells and
  Economy trend/sparkline paths.
- `npm run verify` passes 623 unit tests, 19 explicit legacy goldens,
  typecheck, architecture, build/artifact, lint, format and diff gates. The
  behavior-preserving module move produces a 9-file artifact with SHA-256
  `9fdbd3b5484a815fd5075a6787d4d8b4c794ab72fad5abb5696849956294240d`.

## Presenter hygiene implementation evidence

- `DisplayMetric` and `MetricList` now belong to the generic
  `app-presenters.tsx` module, and the combat presenter imports that component.
- All eleven consumers use the readonly props-object JSX contract; no direct
  presenter invocation remains and the fragment adds no DOM wrapper.
- Typecheck, the 68-module zero-cycle/zero-exception architecture check, ESLint
  and repository-wide formatting pass.
- The complete production-preview Chromium gate passes 76/76 across the shared
  metric consumers.
- Full `npm run verify` passes 624 unit tests, 19 explicit goldens, build and
  artifact entry budgets, lint, format and diff checks; dependency audit is the
  only skipped step under the documented network-disabled policy.

## Runtime bootstrap controller implementation evidence

- The DOM-free resolver and lifecycle hook under `src/app/controllers` reduce
  `App.tsx` to one idempotent ready-result application effect.
- Eleven focused controller tests cover selected/scheduled/bundled/manual price
  order, generated alch/fallback authority, setup/Duel recovery, cancellation
  and fixed sanitized failure state; the combined focused suites pass 106/106.
- The targeted production-preview startup/recovery gate passes 3/3.
- Architecture passes at 70 source modules / 57 client-reachable modules with
  no cycle or exception.
- The 880,362-byte generated snapshot remains deferred; the direct entry passes
  at 685,731 raw / 197,749 gzip bytes against unchanged budgets.
- Full `npm run verify` passes 635 unit tests, 19 explicit goldens and every
  non-network repository gate; dependency audit is skipped under the documented
  network-disabled policy.

## Local-state recovery implementation evidence

- A DOM-free controller core owns recovery transitions and storage policy
  orchestration, and a thin `useSyncExternalStore` hook exposes its typed
  snapshot and actions to `App`.
- The pure Settings panel preserves the existing section landmark, status and
  alert roles, table semantics, class names, copy and per-item/clear-all
  confirmation order.
- Ten new tests cover the block, context-invalid, one-shot clear, replacement,
  failure, allowlist, export, manual-price outcome and panel contracts. The
  combined focused suites pass 109/109, targeted browser coverage passes 4/4
  and the complete Chromium gate passes 76/76.
- Architecture passes at 73 source modules / 60 client-reachable modules with
  no cycle or exception. `App.tsx` is 8,441 lines and no longer owns generic
  local-state recovery state or mechanics.
- Full `npm run verify` passes 645 unit tests, 19 explicit goldens and all
  non-network gates. The direct entry remains inside D-094 budgets at 690,492
  raw / 198,906 gzip bytes, while the generated snapshot remains deferred.

## Hiscores controller implementation evidence

- A DOM-free core plus thin external-store hook now own service status, player
  input, latest-request freshness, preview/notices and last-player
  persistence/recovery. Compatible legacy player import uses the same explicit
  replacement operation.
- The topbar panel owns the unchanged landmark, form, notice and preview DOM
  plus disclosure-scoped outside-pointer/Escape/focus behavior. `App` retains
  only form-derived rows and the typed safe Apply bridge.
- Nineteen focused tests cover status, request races, player freshness,
  sanitized failures, save outcomes, legacy replacement, Apply outcomes and
  static panel contracts. The required combined command passes 55/55, targeted
  browser coverage 2/2 and the complete Chromium gate 76/76.
- Architecture passes at 76 source modules / 63 client-reachable modules with
  no cycle or exception. `App.tsx` is 8,190 lines and no longer owns generic
  Hiscores lifecycle, persistence or panel markup.
- Full `npm run verify` passes 664 unit tests, 19 explicit goldens and all
  non-network gates. The direct entry is 693,270 raw / 199,784 gzip bytes and
  the generated runtime snapshot remains deferred.

## Rewrite setup file-transfer implementation evidence

- A generic DOM-free controller plus thin external-store hook now own bounded
  browser-file reading, existing setup parser invocation, fixed sanitized
  notices, recovery-aware persistence and deterministic version-3 export
  envelopes.
- `App` applies one typed ready outcome to its six existing setup state owners,
  retains the input reset and unchanged topbar JSX, and no longer owns setup
  transfer notice/error state. The unreachable Zod-only error branch and import
  were removed.
- Twelve focused controller tests cover success/session-only persistence,
  recovery ordering, every parser category, sanitized unexpected failures,
  export and concurrent settlement. The required combined unit gate passes
  78/78, targeted browser coverage 2/2 and the complete Chromium gate 77/77.
- Architecture passes at 78 source modules / 65 client-reachable modules with
  no cycle or exception. `App.tsx` is 8,092 lines.
- Full `npm run verify` passes 676 unit tests, 19 explicit goldens and all
  non-network gates. The direct entry is 694,107 raw / 200,282 gzip bytes and
  the generated runtime snapshot remains deferred.

## PriceSet controller and Cannon pane implementation evidence

- A DOM-free PriceSet controller plus thin hook own bounded file transfer,
  acceptance authority, selected persistence/recovery, latest-state history,
  export and reset. A pure Cannon pane owns the complete presentation section
  and formatted calculated output behind explicit values/actions.
- `App` retains live `SimulationContext`, fallback selection, caller-owned typed
  outcome application, current-monster schema mutation and Trip sparse
  synchronization. Obsolete PriceSet helpers/state and Cannon presentation
  derivations were removed; no compatibility shim remains.
- Fifteen PriceSet controller tests and three Cannon pane tests were added. The
  PriceSet combined unit gate passes 57/57, Cannon focused suites pass 138/138,
  targeted production-preview coverage passes 4/4 and full Chromium passes
  77/77.
- Architecture passes at 81 source modules / 68 client-reachable modules with
  no cycle or exception. `App.tsx` is 7,842 lines.
- Full `npm run verify` passes 694 unit tests, 19 explicit goldens, typecheck,
  architecture, build/artifact, lint, formatting and diff gates. The direct
  entry is 698,137 raw / 201,103 gzip bytes, the deferred generated snapshot is
  880,362 bytes and the 10-file/two-asset artifact is 1,953,715 bytes with
  SHA-256 `00193bd3b92bf8f1faf6c25eca880ff74f5106f483e3dd3998bf8966e33b62bf`.

## Stats/Loadout implementation evidence

- Pure pane components now own the Stats analysis and the contiguous active
  Loadout/special/distribution family. `App` keeps live state, mutations,
  optimizer Apply/Undo and tab orchestration, and no CSS, domain, request,
  worker or persistence contract changed.
- Focused leaf modules own shared contracts/number formatting, and direct
  Stats, Loadout and active-assumption feature modules own their builders and
  types without mutual imports or compatibility barrels.
- `App.tsx` is 7,273 lines and `simulation.ts` is 2,583 lines. Architecture
  passes at 88 source modules / 76 client-reachable modules / seven external
  entrypoints with no cycle or exception.
- Server-render pane and focused view-model coverage passes 150/150; the numeric
  audit passes 5,958/5,958 comparisons, focused Chromium passes 4/4 and the full
  production-preview gate passes 77/77. Full `npm run verify` passes 697 tests,
  19 goldens and every non-network repository gate; the direct entry remains
  inside D-094 at 701,528 raw / 202,769 gzip bytes. The canonical dedicated
  visual port was sandbox-blocked, but the equivalent read-only run through the
  standard E2E server passed 20/20 against the same 31 Darwin PNGs; no baseline
  changed.

## Compare/Duel implementation evidence

- Direct Compare and Duel view-model modules now own their pure contracts and
  builders, focused controller hooks own the existing Dense and Duel-matrix
  lifecycles, and pure panes own both feature landmarks. `App` retains live
  form/snapshot mutation, persistence, recovery, global status and Undo.
- `App.tsx` is 6,387 lines with 51 React state cells; `simulation.ts` is 1,502
  lines. Architecture passes at 94 source modules / 82 client-reachable modules
  / seven external entrypoints with no cycle or exception.
- Six focused suites pass 158/158, numeric paths pass 5,958/5,958, focused
  Chromium passes 9/9 and complete Chromium passes 77/77. Full `npm run verify`
  passes 704 tests and 19 goldens. The entry remains inside D-094 at 705,080 raw
  / 204,250 gzip bytes. A fresh visual run was sandbox-blocked before browser
  execution on both attempted local ports; no baseline or permanent config
  changed, and the preceding read-only 20/20 Darwin comparison remains the
  latest successful visual evidence.

## Planner implementation evidence

- Direct Planner view-model, calculation-controller and pane modules now own
  feature adaptation/presentation contracts, the explicit-Recompute Worker
  lifecycle and the complete pure landmark respectively. `App` retains the
  versioned draft, persistence/recovery, bounded mutations and tab composition.
- `App.tsx` is 5,965 lines with 49 React state cells; `simulation.ts` is 1,113
  lines. Architecture passes at 97 source modules / 85 client-reachable modules
  / seven external entrypoints with no cycle or exception.
- The focused gate passes 129/129, Planner parity passes 16 cases / 32
  comparisons with zero open rows, and all 19 goldens remain unchanged.
  Focused Chromium passes 3/3, complete Chromium 77/77 and read-only Darwin
  visual comparison 20/20 against the existing 31 PNGs.
- Full `npm run verify` passes 52 files / 710 tests and 19 goldens. The
  10-file/two-asset artifact totals 1,962,374 bytes with SHA-256
  `42a68f4e48d4999548010cbad8c291efe8786d4b9d08407193376b9bf5e4d2cc`;
  entry JavaScript remains inside D-094 at 706,650 raw / 205,198 gzip bytes.

## Risk implementation evidence

- A direct Risk view-model owns feature-only controls, defaults, status,
  options and formatting; a focused controller owns transient state, exact
  freshness and explicit Run/Cancel Worker orchestration; and a pure pane owns
  the complete Risk landmark.
- `App.tsx` is 5,608 lines with 46 React state cells. It retains live source and
  global-status composition plus the four fresh-only TTK/net-GP/Trip bridges,
  but no Risk state, task ref, lifecycle effect, helper, Run/Cancel handler or
  pane markup.
- Architecture passes at 100 source modules / 88 client-reachable modules /
  seven external entrypoints with no cycle or exception. Focused tests pass
  161/161, numeric paths 5,958/5,958, goldens 19/19 and complete Chromium
  77/77. No domain, request, Worker, persistence, schema, CSS or visual baseline
  changed.
- Full `npm run verify` passes 54 files / 719 tests. The read-only Darwin visual
  comparison passes 20/20 against 31 unchanged PNGs, and the 1,964,103-byte
  artifact has SHA-256
  `922eb19e75689664c2d4e6da9e34d4641b575ce09bbaf2edfb195eb8a77a21c2`;
  entry JavaScript remains inside D-094 at 708,379 raw / 205,746 gzip bytes.

## Loot/Trip implementation evidence

- Direct Loot and Trip view-model modules own row/action/composition/history,
  optimizer, policy, controls, recommendation, summaries and eight output
  groups. Pure pane components own both complete landmarks, while the 46-line
  simulation-input leaf serves simulation and calculation tasks without a
  cycle or compatibility re-export.
- `App.tsx` is 4,297 lines with the same 46 React state cells. It retains the
  versioned setup and per-monster loot state, persistence/recovery/share/Undo,
  normalized mutation, Active assumptions and cross-pane bridges, but no
  Loot/Trip pane markup or feature-only presentation derivation.
- `simulation.ts` is 476 lines. Architecture passes at 105 source modules / 93
  client-reachable modules / seven external entrypoints with no cycle,
  exception or orphan. Focused tests pass 238/238, numeric paths 5,958/5,958,
  goldens 19/19, focused Chromium 13/13 and complete Chromium 77/77.
- Full `npm run verify` passes 58 files / 730 tests. The read-only Darwin visual
  comparison passes 20/20 against 31 unchanged PNGs, and the 1,966,525-byte
  artifact has SHA-256
  `3c247248df68cf2dd14d33e1f256b464f06a9cf975cb8af4f7790e2057fa5e6c`;
  entry JavaScript remains inside D-094 at 709,990 raw / 206,326 gzip bytes.

## Economy/Settings implementation evidence

- The pure `EconomySettingsPane` owns the exact shared wrapper and all current
  recovery, Settings Price data/Gear menu, Market, manual-price and Economy
  history markup. Direct price-data and Settings view models own the moved
  presentation derivation, and Loot consumes the neutral item-history contract
  without a compatibility barrel or cycle.
- `App.tsx` is 3,587 lines with the same 46 React state cells. It retains
  browser state, persistence/controller transactions, mutation, topbar bridges,
  cross-pane routing and tab composition, but no Economy/Settings child DOM or
  price/tier presentation derivation.
- Architecture passes at 108 source modules / 96 client-reachable modules /
  seven external entrypoints with no cycle, exception or orphan. The new suites
  pass 16/16 and the required combined focused gate passes 132/132.
- Numeric paths pass 5,958/5,958, goldens 19/19, focused Chromium 8/8, complete
  Chromium 77/77 and read-only Darwin visual comparison 20/20 against the same
  31 PNGs. No baseline changed.
- Full `npm run verify` passes 61 files / 746 tests. The 1,972,778-byte artifact
  has SHA-256
  `1d0bb317b35fec093c7128559fbd0f39de17623d9799dbfe8a4bed65425118c0`;
  entry JavaScript remains inside D-094 at 716,243 raw / 208,034 gzip bytes.

## Phase 4 implementation evidence

- Direct DOM-free app-shell and legacy-migration view models own root
  presentation; four pure shell components own the exact header, shared review,
  legacy review and workbench DOM. Feature panes and the MonsterCard rail remain
  visibly composed by App.
- `App.tsx` is 2,534 lines with the same 46 React state cells. It retains
  browser bootstrap, seven direct persistence effects, controller outcomes,
  atomic setup/share/legacy/Undo transactions and pane model/action assembly.
- Architecture passes at 114 source modules / 102 client-reachable modules /
  seven external entrypoints with no cycle, exception or orphan. New tests pass
  12/12 and the combined focused gate passes 278/278.
- Numeric paths pass 5,958/5,958, goldens 19/19, focused Chromium 19/19,
  complete Chromium 77/77 and read-only Darwin visual comparison 20/20 against
  the unchanged 31 PNGs.
- The 1,977,328-byte artifact has SHA-256
  `bea79ca8f4dd82815ea01397b54ae7987d130bdaa6acbf5c316ecbf7b2188379`;
  entry JavaScript remains inside D-094 at 720,793 raw / 208,801 gzip bytes.

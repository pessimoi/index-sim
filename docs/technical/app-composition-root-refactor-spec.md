# App composition-root refactor specification

Status: phase 1, presenter API hygiene, runtime bootstrap, local-state recovery,
Hiscores, rewrite setup and PriceSet controllers plus the first Cannon pane
implemented through Goal 10, 2026-07-13. Later controller and pane phases remain
separate goals.

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

### Later Phase 3 feature panes - future goals, one pane family at a time

Extract pane components through typed view data and action props. Progress
through Stats/Loadout, Compare/Duel, Loot/Trip/Risk, Planner and
Economy/Settings as independent goals. A pane must not reconstruct simulation
requests or bypass existing view-models.

### Phase 4 - composition review (future goal)

After the controllers and panes are separated, review remaining `App` helpers,
co-locate feature-only types and remove obsolete forwarding code. Do not set a
target line count: responsibility and dependency direction are the acceptance
criteria.

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

## Open questions

- Which feature pane provides the best first Phase 3 boundary after controller
  extraction? Decide from dependency mapping and focused browser coverage, not
  raw line count.

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

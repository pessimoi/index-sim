# App composition-root Phase 4 final shell and ownership review specification

Status: implemented on 2026-07-14 as D-093 composition-root Phase 4.

## Purpose

Complete the bounded ownership review of `src/app/App.tsx` after the Phase 1-3G
controller, presenter and pane extractions. Phase 4 moves the remaining pure
shell and legacy-review presentation to direct owners, relocates a few clearly
misplaced feature helpers and removes forwarding code made obsolete by the
move.

This is the final phase of
[the phased composition-root refactor](app-composition-root-refactor-spec.md).
It is an ownership refactor, not a line-count exercise. `App` remains the
application composition root and continues to own browser bootstrap,
cross-feature state, persistence effects, controller outcomes and atomic
transactions that update more than one feature family.

## Review conclusion

The post-Phase-3G remainder is not one undifferentiated defect. It has three
different responsibility classes:

1. **Legitimate composition-root work:** 46 React state cells, seven direct
   persistence effects, browser/runtime setup, controller result application,
   global status/Undo and multi-feature setup/share/legacy transactions.
2. **Pure application-shell presentation:** topbar actions, shared-setup review,
   setup guide, player sidebar, setup context, tab strip, compact controls,
   result metrics, guidance and warning slots.
3. **Misplaced presentation and feature helpers:** legacy-migration summaries
   and plans, tab/setup labels, share/Duel error copy and small state helpers
   whose direct owners already exist.

Phase 4 extracts classes 2 and 3. Class 1 stays visible in `App`. Moving all
state and effects into one new hook, reducer, context or controller would only
rename the current concentration and make transaction ownership less clear.
That is explicitly outside this specification.

## Current evidence

At specification time, after implemented Economy/Settings Phase 3G:

- `src/app/App.tsx` is 3,587 lines and contains 46 `useState` calls;
- runtime bootstrap, recovery setup and seven direct persistence effects occupy
  the first post-state section;
- the remaining module-local legacy-migration presentation family spans roughly
  200 lines and converts `LegacySetupMigrationReport` to summary, outcome,
  import, review, key-table, status, tone and clear-confirmation values;
- the root JSX still owns the topbar, shared-setup review, legacy-migration
  review, setup guide, player sidebar, setup context, workbench tabs, compact
  setup strip, result metric strip, negative-net-GP guidance, warning slot and
  Active assumptions slot;
- all ten workbench pane component families, covering the eleven tabs, and the
  MonsterCard rail already have direct pure owners, and all feature panes
  receive explicit models and actions;
- the legacy Import transaction updates setup, per-monster custom setup,
  Cannon, Dense Compare, Loot, hidden tiers, Duel snapshots, Hiscores and price
  state according to the existing report and precedence rules;
- shared-setup Load/Undo replaces several state families atomically while
  preserving recipient prices and the existing focus-return behavior;
- `mergeLootPrefsState`, Duel snapshot id/name construction and import-error
  presentation still live in App although direct Loot/Duel owners exist;
- `metric()` is JSX-producing shell code, while tab definitions, setup labels
  and selection summaries are DOM-free shell presentation;
- `npm run architecture:check` passes with 108 source modules, 96
  client-reachable modules, seven documented external entrypoints, no cycles
  and no exceptions; and
- the current full evidence is 61 unit-test files / 746 tests, 19 explicit
  goldens, 5,958 numeric comparisons without mismatches, functional Chromium
  77/77 and read-only visual Chromium 20/20.

The evidence supports a final pure-presentation move. It does not demonstrate
that the state count, persistence count or multi-feature transactions are
incorrect.

## Goals

- Give legacy-migration report presentation one DOM-free view-model owner.
- Give root-shell labels, summaries, metric rows and review states one DOM-free
  view-model owner.
- Give the remaining topbar/review/workbench shell DOM cohesive pure component
  owners.
- Keep the feature panes visibly composed by App through an explicit shell
  children boundary.
- Relocate clearly feature-owned helpers to the existing Loot, Duel and Loadout
  modules without adding compatibility barrels or pass-through aliases.
- Remove App-local presentation derivation and forwarding code that becomes
  obsolete.
- Record the remaining App state, effects and transactions as intentional
  composition-root ownership.
- Preserve every calculation, persistence, DOM, copy, callback, focus,
  accessibility and visual contract.
- Close D-093 only after the implementation review finds no additional pure
  shell or feature-helper responsibility in App.

## Non-goals

- No target line count, state count, hook count, prop count or file count.
- No all-state reducer, application context, feature store, state library or
  generic `useAppController`/`useLegacyController` wrapper.
- No move of the seven persistence effects solely to hide them from App.
- No move of browser storage creation, persisted-state loading, runtime
  bootstrap, recovery blocking or controller outcome application unless a
  smaller existing owner already has that exact responsibility.
- No split of an atomic setup/share/legacy/Undo transaction across independent
  components or hooks.
- No new legacy migration behavior, schema, key, allowlist, precedence rule,
  clear policy or Planner/price-history support.
- No change to setup, share, Duel or PriceSet envelopes, limits, error meaning,
  input reset or download behavior.
- No calculation, request, Worker, generated-data, PriceSet, market, Hiscores,
  domain, adapter, API, provider, backend, database, auth or deployment change.
- No redesign of the topbar, workbench, responsive layout, copy, precision,
  order, semantic role, accessible name, focus behavior, class name,
  stylesheet or visual baseline.
- No archived legacy-runtime refactor.
- No decomposition of `view-models/simulation.ts`, `domain/trip`, the generator
  core or the large test files. Those remain independent backlog items.

If the structural move reveals a behavioral defect, record it as a separate
follow-up instead of silently changing behavior in Phase 4.

## Preserved sources of truth

| Concern                                                  | Owner after Phase 4                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| Runtime loading and startup PriceSet resolution          | Existing runtime bootstrap controller plus App result application |
| Browser storage construction and initial persisted reads | `src/app/App.tsx` plus existing state/storage helpers             |
| Feature state and seven persistence effects              | `src/app/App.tsx` plus existing state schemas                     |
| Setup, share, legacy and Undo multi-feature transactions | `src/app/App.tsx`                                                 |
| Legacy inspection, mapping, key policy and clearing      | `src/app/state/legacy-storage-migration.ts`                       |
| Legacy report presentation                               | New `src/app/view-models/legacy-migration.ts`                     |
| Root-shell and shared-review presentation                | New `src/app/view-models/app-shell.ts`                            |
| Header, shared review and legacy review DOM              | New components under `src/app/components/shell`                   |
| Workbench shell, navigation and result-strip DOM         | New `src/app/components/shell/workbench-shell.tsx`                |
| Feature-pane presentation and callbacks                  | Existing `src/app/components/panes/*` owners                      |
| Feature view-model and numeric truth                     | Existing view-model, state and domain owners                      |
| High-level application and pane composition              | `src/app/App.tsx`                                                 |

## Target module map

### Legacy-migration view model

Create `src/app/view-models/legacy-migration.ts` as a DOM-free presentation
adapter. It receives the existing metadata-only `LegacySetupMigrationReport`
and whether a rewrite setup was already loaded. It must not read or clear
storage, inspect raw legacy payloads, mutate state, call adapters or import
React/components.

Move the following App-local presentation responsibilities to this owner:

- the fixed set used to recognize legacy price keys for summary purposes;
- migration disposition labels;
- summary items for setup, player, Loot, custom setups, Cannon, Duel, hidden
  tiers, Compare, prices, history, Planner and review-only data;
- compatible import-plan rows;
- review/reset rows and sanitized skipped-field rows;
- outcome sentences and their counts;
- key-review table row labels and state;
- known clear-key display text;
- import-ready, status-pill and panel-tone derivation; and
- the flags that show existing-rewrite-state and warning notices.

A target contract is:

```ts
export interface LegacyMigrationViewModel {
  tone: "" | "ready";
  statusLabel: string;
  importReady: boolean;
  summaryItems: string[];
  outcomeItems: string[];
  importPlan: string[];
  reviewPlan: string[];
  keyRows: LegacyMigrationKeyRowViewModel[];
  clearKeyList: string;
  showExistingRewriteSetupNotice: boolean;
  showUnsupportedDataNotice: boolean;
}

export function createLegacyMigrationViewModel(input: {
  report: LegacySetupMigrationReport;
  hasRewriteSetup: boolean;
}): LegacyMigrationViewModel;
```

Exact nested names may be refined, but the component must not receive the raw
report merely to repeat these derivations. The view model may consume only the
metadata already exposed by the report; it must never expose raw stored values.

### App-shell view model

Create `src/app/view-models/app-shell.ts` for DOM-free root-shell
presentation. It may consume domain values and already-built feature view
models, but it must not import React, components, browser adapters, storage or
controllers.

It owns:

- the exact ordered workbench tab id/label definitions and `WorkbenchTabId`;
- a pure next-tab resolver for ArrowLeft, ArrowRight, Home and End, while the
  component retains the actual DOM focus step;
- combat-style, primary-prayer and primary-boost compact option rows;
- primary level key and short label;
- selected-prayer/boost summaries and extra-selection counts;
- default/custom setup status and compact setup-context labels;
- manual combat override labels and derived placeholders;
- setup-guide summary rows sourced from existing Loadout, Trip and Loot values;
- shared-setup inspection error copy and review presentation, including target,
  combat style, Cannon, loot-choice count, recipient-price text, warning tone
  and status;
- result metric row labels, formatted values, tones and optional Risk detail;
  and
- negative-net-GP guidance visibility and displayed values.

Metric rows carry data and a typed review target such as `"risk"`; they do not
carry closures. The shell component converts review targets to the single
`onActivateTab(tabId)` intent supplied by App. Time, prices and numeric
calculation remain outside this module.

The local `ShareableSetupInspection` union moves here as a view-model contract
so App can store the typed inspection result without owning its presentation.
`describeShareableSetupError()` becomes part of the shared-review builder or a
named exported formatter in the same module.

### Shared presentation contract cleanup

Move the structurally generic success/error notice contract out of
`components/app-presenters.tsx` to `view-models/contracts.ts` and name it by
presentation role, for example `InlineNoticeViewModel`. `InlineImportNotice`
and the Duel pane consume that contract directly. Do not leave a compatibility
re-export or keep a setup-specific type in a component module.

Move Duel snapshot import-error mapping to `view-models/duel.ts`. It returns the
generic inline-notice contract and preserves every existing message, including
the 250 KB and supported-version copy. The Duel component must not interpret
errors.

This cleanup removes the current view-model-to-component type dependency
without introducing a generic error framework.

### Feature-helper relocation

Relocate only helpers with an existing unambiguous owner:

- `mergeLootPrefsState()` moves to `state/loot-prefs.ts` beside normalization
  and per-monster update helpers;
- Duel snapshot id construction moves to `state/duel-snapshots.ts` as a named
  helper with injectable/default time and random inputs so its format can be
  tested deterministically;
- default Duel snapshot name construction moves to `view-models/duel.ts`;
- empty equipment-slot option construction moves to `view-models/loadout.ts` if
  it remains necessary after the shell extraction; and
- the JSX-producing `metric()` helper is replaced by the workbench-shell metric
  component consuming App-shell metric rows.

The generic normalized form patch helper and local Undo id helper may remain in
App: they support composition-root mutations rather than one feature's
presentation. Do not move a helper merely to make the file shorter.

### Shell components

Create a cohesive `src/app/components/shell` group. Components may import React,
form controls, existing presenters and view-model types. They must not read
storage, call adapters/controllers, start calculations, mutate module state or
know persistence schemas.

#### App header

Create `components/shell/app-header.tsx` for the current `topbar` landmark. It
owns the exact brand, Hiscores panel position, import/export/share action order
and topbar notices.

File inputs extract at most one selected `File`, call a typed caller intent and
reset their own element after the promise/intent settles. The component does
not parse a file or call a transfer controller. Preserve the current price
surface id, accepted MIME/extensions, notice classes, action labels and
share-button ref/focus-return contract.

#### Shared-setup review

Create `components/shell/shared-setup-review.tsx`. It receives the App-shell
review presentation plus `onLoad` and `onDismiss`. It owns the exact ready,
warning and invalid branches, summary order, status pill, roles and actions.

Dismiss remains a session-local App mutation. Load remains the App-owned atomic
transaction. The component performs neither operation itself.

#### Legacy-migration panel

Create `components/shell/legacy-migration-panel.tsx`. It receives
`LegacyMigrationViewModel`, the existing `clearPending` state and four intents:
Import, Keep, request/cancel Clear and confirm Clear. It owns the exact section,
summaries, plans, key table, notices and confirmation branch.

Inspection, import mapping, storage clearing, dismissal persistence and state
application remain outside the component. The component must not receive
storage or controller functions disguised as a service object.

#### Workbench shell

Create `components/shell/workbench-shell.tsx` for the current setup guide,
player sidebar, setup context, tab navigation, compact setup strip, result
metric strip, net-GP guidance, calculation warnings and Active assumptions
slot.

It receives explicit presentation and typed action groups plus `children` for
the existing pane components. App continues to render the panes in their
current order as those children. The shell owns the DOM around them, not their
feature models or mutations.

The workbench component owns the DOM-local roving-tab keyboard behavior because
it owns the tab buttons and focus query. App owns `activeTab` and supplies one
`onActivateTab` callback. Preserve:

- tab order, ids, labels and one selected roving `tabIndex`;
- ArrowLeft/ArrowRight wrapping and Home/End behavior;
- activation before focus of the matching tab button;
- `tablist`, dynamically labelled `tabpanel` and hidden-pane behavior;
- skip-link target and focus behavior;
- setup-guide, sidebar, setup-context and compact-control order;
- Stats/Compare-only result-strip and warning-slot visibility; and
- Risk, Loadout, Trip and Loot navigation intents from shell guidance.

Small internal components may remain in the same file when they improve local
readability. Do not create one file per short section or a broad shell barrel.

### App after Phase 4

`App.tsx` remains responsible for:

- browser storage construction and initial persisted-state loading;
- the current 46 state cells unless an exact feature-helper move makes one
  provably obsolete;
- runtime/bootstrap/recovery/controller hooks and their result application;
- the seven persistence effects and their ready/block timing;
- calculation/view-model assembly and global status composition;
- normalized form, setup, Cannon, Loot, Duel, Planner, price and recovery
  mutations;
- setup, PriceSet, Duel, share and legacy import/export transactions;
- global Undo and complete restore closures;
- cross-feature legacy Import/Keep/Clear and shared-setup Load/Undo;
- pane model/action assembly and direct pane composition; and
- the high-level order of header, dialogs/reviews, workbench shell and
  MonsterCard rail.

The target shape is conceptually:

```tsx
<AppHeader ... />
<ShareSetupDialog ... />
<SharedSetupReview ... />
<PendingUndoStatus ... />
<LegacyMigrationPanel ... />
<WorkbenchShell ...>
  <StatsPane ... />
  <LoadoutPane ... />
  {/* existing pane order continues unchanged */}
</WorkbenchShell>
<MonsterCardPanel ... />
```

This sketch is not permission to reorder DOM or hide feature composition in a
configuration array. Acceptance is based on ownership and dependency
direction, not on matching a target number of lines.

## Transaction and behavior invariants

### Legacy migration

- Inspection remains bounded, metadata-only and storage-owned by the existing
  legacy state module/App bridge.
- Import applies the same compatible setup, custom setup, Cannon, Duel, Dense,
  Loot, hidden-tier, Hiscores and PriceSet data in the same order.
- The current Import-button readiness predicate remains exact: setup, custom
  setup, Cannon, Loot, hidden tiers, Dense sort/hidden monsters, Hiscores or a
  PriceSet makes the action ready. Duel snapshots alone do not currently make
  the button ready even though the transaction can apply them; Phase 4 records
  that discrepancy as a follow-up question instead of changing it.
- Existing rewrite state precedence, per-monster merge behavior, caps,
  compatibility checks and recovery unblocking remain unchanged.
- Planner and full legacy price history remain review-only; Import and Keep do
  not remove them.
- Keep dismisses the review and leaves found legacy keys untouched.
- Clear requires the same confirmation and deletes only the known allowlisted
  keys marked clearable. Unknown keys are never touched.
- Dismissal and clear-pending timing, notices and sanitized reasons remain
  unchanged.

### Shared setup

- URL-fragment capture/removal, bounded decoding and compatibility review stay
  in the existing adapter/state path.
- Invalid, warning and ready states render before any load mutation.
- Dismiss performs no setup write.
- Load replaces the same complete state family, preserves recipient prices,
  selects the same tab and installs the same one-level Undo.
- Undo restores the complete previous state and tab.
- Share-dialog close returns focus to the current Share setup button.

### File transfer and topbar

- Setup and PriceSet file size, parsing, duplicate/version/entity checks,
  surface-scoped notices and accepted-state transactions remain in their
  existing controllers/App bridges.
- Price import remains tagged to the topbar surface.
- File inputs reset on success and failure so the same file can be selected
  again.
- Export and share callbacks keep the same user-gesture timing.

### Workbench shell

- Player/sidebar/context/compact edits route through the current normalized App
  mutations; the shell does not write form state directly.
- All control bounds, steps, placeholders, option ordering and current values
  remain exact.
- Result metrics keep their existing numeric sources and precision.
- Risk P10/P50/P90 detail appears only for a fresh matching Risk result and its
  link activates the same Risk tab.
- Negative-net-GP guidance uses the same supply/loot comparison and values.
- Money warnings and Active assumptions keep the same order, review/reset
  targets and hidden behavior.
- Existing panes stay mounted/hidden exactly as before and retain their own
  landmarks, models, actions and test selectors.

### DOM and visual contract

- Header, review strips, pending Undo, setup guide, workbench, panes and
  MonsterCard keep their relative DOM order.
- All current strings, classes, ids, labels, roles, live regions, native table
  structure and responsive behavior remain exact.
- Phase 4 writes no CSS and updates no visual baseline.

## Implementation plan

### Phase 4.1 - characterization coverage

Add focused tests for legacy report presentation, shell presentation and shell
component branches before moving JSX. Capture tab order/keyboard behavior,
shared review states, legacy confirmation states, metric rows and file-input
reset behavior.

### Phase 4.2 - DOM-free owners and helper relocation

Create the two view-model modules, move the generic notice contract and
relocate only the enumerated feature helpers. Update direct consumers without
compatibility re-exports. Run typecheck and architecture checks before the JSX
move so dependency errors stay attributable.

### Phase 4.3 - mechanical shell extraction

Move header, review and workbench shell JSX into the four component owners.
Preserve the exact markup and callback timing. Route feature panes through the
workbench `children` boundary while leaving their model/action construction in
App.

### Phase 4.4 - composition-root cleanup and closure review

Delete obsolete App helpers, types, derivations, imports and forwarding
aliases. Review every remaining App-local declaration and classify it as
bootstrap, state/effect, transaction, calculation/view-model composition,
global action or pane composition. Record intentional remainder and measured
evidence in living docs. Do not invent another extraction solely because App
remains large.

## Required focused tests

### New unit/component coverage

Add:

- `src/tests/legacy-migration-view-model.test.ts` for every report bucket,
  disposition, import/review/outcome count, import-ready state, clear-key list,
  existing-rewrite notice and sanitized metadata-only output;
- `src/tests/app-shell-view-model.test.ts` for exact tab/option order, primary
  level labels, prayer/boost summaries, setup status, shared-review
  ready/warning/error states, metric rows, Risk detail and missing-label
  fallbacks; and
- `src/tests/app-shell-components.test.tsx` for header/review/shell landmarks,
  DOM order, roles, classes, hidden states, legacy confirm branches, typed
  action availability and roving `tabIndex` markup.

Tests may be split once by cohesive shell versus review components if one file
becomes difficult to review. Preserve direct filenames in the test command and
do not add shallow snapshots that obscure the exact assertions.

### Existing focused regressions

Run at least the current suites covering:

- legacy migration and local state;
- shareable setup;
- setup and PriceSet transfer controllers;
- Hiscores lookup;
- UI adapters and view models;
- Duel snapshots and import;
- Loot preferences; and
- every existing pure pane component/view-model touched through shell props.

### Browser scenarios

The focused functional pass must include the current scenarios for:

- root workbench load and bounded keyboard navigation;
- desktop, compact landscape and mobile tab access;
- Hiscores unavailable/lookup paths used by the header;
- setup import/export and failure;
- PriceSet import, selected override and failure;
- all shared-setup review/load/dismiss/Undo paths;
- legacy Import, Keep and confirmed Clear;
- negative net-GP explanation and Active assumption navigation; and
- fresh Risk detail navigation from the result strip.

Then run the complete 77-case functional suite. Scenario names and selectors
remain unchanged.

### Visual regression

Run the complete read-only 20-scenario visual suite, with particular attention
to desktop root, compact landscape, mobile, Stats, Compare, Economy and
Settings shell geometry. Compare against the existing platform baseline; do
not use baseline-writing mode.

## Required validation

Implementation is not complete until these gates pass:

```sh
npm run typecheck
npm run architecture:check
npm run test -- \
  src/tests/legacy-migration-view-model.test.ts \
  src/tests/app-shell-view-model.test.ts \
  src/tests/app-shell-components.test.tsx \
  src/tests/legacy-migration-*.test.ts \
  src/tests/shareable-setup.test.ts \
  src/tests/ui-adapters.test.ts \
  src/tests/*-view-model.test.ts
npm run numeric:audit
npm run test:golden
npm run test:e2e -- --workers=1 --grep "loads the dense combat spreadsheet root|supports bounded keyboard navigation|keeps hiscores disabled|looks up hiscores|renders scheduled price status|keeps the desktop workbench|keeps a compact landscape workbench|keeps every workbench tab|explains setup ownership|reviews and imports compatible legacy|keeps legacy data|clears only known legacy|exports current rewrite setup|keeps setup import failures|keeps PriceSet import failures|creates a selectable setup link|reviews a shared setup|dismisses or rejects shared setup links|runs, invalidates and cancels modeled Risk"
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

Adjust only a mistyped existing test filename after inspecting `package.json`
and the current suite. Do not weaken a gate. Numeric and golden gates are
required even though no numeric change is intended because the result strip and
cross-feature action routing move.

## Done criteria

- App contains no legacy-report presentation builders or legacy-review child
  markup.
- App contains no root header, shared-review, setup-guide, sidebar, setup
  context, tab-strip, compact-strip, metric-strip or guidance child markup
  beyond composition elements and explicit props.
- App still visibly owns browser/bootstrap wiring, state, persistence effects,
  cross-feature transactions, global Undo and pane composition.
- The seven persistence effects and multi-feature transaction order have not
  been hidden inside a new broad hook/controller.
- Feature helpers listed in this specification have direct owners or are
  documented as intentionally App-owned after implementation review.
- No pass-through barrel, compatibility re-export, duplicate derivation,
  component-to-storage dependency, new cycle, orphan module or architecture
  exception exists.
- DOM, copy, roles, labels, focus, callback timing, selectors, CSS and visual
  baselines are unchanged.
- Required focused, numeric, golden, functional, visual and full repository
  gates pass or an external environment blocker is recorded precisely.
- Architecture, testing, backlog and this specification contain measured
  implementation evidence.
- The parent D-093 composition-root card closes only after the remainder review
  identifies no additional pure ownership extraction.

## Documentation updates during implementation

- Mark this specification implemented and add measured module/test/e2e/visual
  evidence.
- Mark Phase 4 implemented in
  [app-composition-root-refactor-spec.md](app-composition-root-refactor-spec.md)
  and close its sequencing note.
- Update [architecture.md](architecture.md) with the measured App size and
  intentional remaining responsibilities.
- Update [testing.md](testing.md) with the new focused suites and current gate
  totals.
- Move the Phase 4 backlog item from `Specced` to `Done` and close the phased
  App split card only if all done criteria hold.

## Implementation evidence

- DOM-free `app-shell.ts` and `legacy-migration.ts` owners now contain the
  ordered tab/keyboard model, setup/shared/result presentation and complete
  metadata-only legacy review presentation. The generic inline notice contract
  belongs to `view-models/contracts.ts` rather than a component module.
- Pure `AppHeader`, `SharedSetupReview`, `LegacyMigrationPanel` and
  `WorkbenchShell` components own the exact remaining root shell DOM. App still
  composes every pane and the MonsterCard rail explicitly through the shell
  boundary.
- Loot preference merge, Duel id/name/import-notice and Loadout empty-option
  helpers have direct state/view-model owners. No compatibility barrel,
  pass-through alias, broad controller, reducer or context was added.
- `App.tsx` is 2,534 lines with the same 46 React state cells. Browser
  bootstrap, seven direct persistence effects, controller outcomes,
  cross-feature mutations, atomic setup/share/legacy/Undo transactions and
  pane model/action composition remain visible there.
- Architecture passes at 114 source modules / 102 client-reachable modules /
  seven external entrypoints with no cycle, exception or orphan. The three new
  suites pass 12/12 and the required combined focused regression gate passes
  278/278.
- Numeric paths pass 5,958/5,958, goldens 19/19, focused Chromium 19/19,
  complete Chromium 77/77 and read-only Darwin visual comparison 20/20 against
  the same 31 PNGs. No CSS or baseline changed.
- The 10-file/two-asset artifact totals 1,977,328 bytes with SHA-256
  `bea79ca8f4dd82815ea01397b54ae7987d130bdaa6acbf5c316ecbf7b2188379`;
  entry JavaScript remains inside D-094 at 720,793 raw / 208,801 gzip bytes.
- The current Duel-only legacy readiness discrepancy remains characterized:
  Duel snapshots appear in the import plan and transaction, but do not alone
  enable Import. Phase 4 does not change that behavior.

## Open questions after Phase 4

- Should a later defect-driven goal consolidate any state cells that repeatedly
  require atomic updates? State count alone is not sufficient evidence.
- Should share, legacy or Duel import acquire additional controllers only if
  repeated lifecycle or stale-result defects are demonstrated?
- Should a later behavior goal make a valid Duel-only legacy report enable
  Import? The current readiness predicate does not, and Phase 4 deliberately
  preserves that verified behavior.
- Should the one-shot calculation Workers become persistent? That remains a
  measurement task independent of shell ownership.
- How should the large simulation adapter, Trip domain, generator core and test
  owners be decomposed? Their existing backlog cards remain separate.

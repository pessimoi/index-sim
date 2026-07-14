# Economy and Settings pane and price-data view-model refactor specification

Status: implemented on 2026-07-14 as D-093 composition-root Phase 3G.

## Purpose

Extract the complete shared Economy/Settings pane family from
`src/app/App.tsx`, move price-data and gear-tier presentation derivation to
direct DOM-free owners, and preserve the existing PriceSet, price-history,
manual-price, recovery and persistence transactions without changing behavior.

This is an ownership refactor. It does not redesign pricing, storage or
Settings. The phased parent remains
[app-composition-root-refactor-spec.md](app-composition-root-refactor-spec.md),
and D-093 remains the accepted composition-root decision.

## Why Economy and Settings form one Phase 3G

Economy and Settings are separate tabs, but their current DOM is one shared
App-owned family:

- one wrapper changes between the `Economy` and `Live services` landmarks and
  stays mounted but hidden on all other workbench tabs;
- the Market section is rendered for both Economy and Settings and remains in
  the hidden wrapper on other tabs;
- Settings adds local-state recovery, active PriceSet controls and hidden gear
  tiers around that shared Market section;
- Economy adds the manual-price editor, shared/local price-history analysis,
  provenance, movers, trends and sortable table around the same active and
  scheduled PriceSet summaries;
- the same `usePriceSetTransfer` controller drives imports, export and reset on
  the topbar, Settings and Economy surfaces; and
- the Economy baseline and snapshot selection also provide read-only local
  history context to Loot.

Extracting only one tab would either duplicate the active/scheduled price
presentation or leave the shared wrapper and most of its branches in App.
Phase 3G therefore moves one pure pane family plus narrow price-data and
Settings presentation owners in one bounded goal.

The phase does **not** create an Economy store, move browser persistence into a
component or extend the PriceSet/recovery controllers. The underlying state has
real cross-feature consumers and transactional reset requirements, so App
continues to own it.

## Current evidence

At specification time, after implemented Loot/Trip Phase 3F:

- `src/app/App.tsx` is 4,297 lines and owns 46 React state cells;
- the shared Economy/Settings wrapper and its child sections occupy App lines
  3,703-4,266, with the enclosing workbench composition ending at line 4,297;
- App-local price presentation helpers own age formatting, item-metadata
  counts, Economy `aria-sort` mapping, mover tone, PriceSet controls and the
  scheduled-snapshot summary;
- roughly 180 lines of shared/local history, active/scheduled PriceSet,
  provenance and manual-editor derivation remain in App;
- App owns the local history, base/bundled/active PriceSet composition inputs,
  manual overrides and drafts, scheduled snapshot status, active origin,
  Economy filters/selections/sort, clear confirmations, market notice and the
  minute-based price-age clock;
- `src/app/state/price-history.ts` is 550 lines and already owns capped local
  persistence data plus pure shared/local analysis, mover and trend algorithms;
- `src/app/state/manual-price-overrides.ts` is 168 lines and already owns the
  bounded overlay schema, base matching and immutable composition helpers;
- `src/app/state/market-sync.ts` is 233 lines and already owns scheduled-price
  resolution and status helpers;
- the implemented PriceSet transfer core/hook are 256/78 lines and own bounded
  file import, selected-PriceSet persistence, acceptance, export and reset
  confirmation;
- the implemented local-state recovery core/hook are 350/54 lines, and the
  existing pure Settings recovery panel is 189 lines;
- `price-history-charts.tsx` already owns the pure Economy trend and sparkline
  SVGs;
- the Economy-selected baseline feeds Loot item history, hidden gear tiers feed
  Loadout/Stats option filtering, and recovery clears can require a caller-owned
  manual-price runtime reset;
- the functional browser suite already covers scheduled versus selected prices,
  recovery, hidden gear tiers, scheduled-only market UI, manual draft/base
  changes, local history and shared read-only history;
- the visual suite has reviewed `Economy desktop` and `Settings desktop`
  scenarios; and
- `npm run architecture:check` passes with 105 source modules, 93
  client-reachable modules, seven documented external entrypoints, no cycles
  and no exceptions.

The current domain, state and controller boundaries are valid. The remaining
problem is presentation ownership and composition-root concentration.

## Goals

- Give the complete current Economy/Settings wrapper and all of its child DOM a
  pure component owner.
- Give active/scheduled PriceSet summaries, manual-editor presentation,
  price-history controls/results and per-item provenance a direct price-data
  view-model owner.
- Give hidden-gear-tier rows and status a direct Settings view-model owner.
- Put the cross-pane item-history context in a neutral price-data contract that
  Loot consumes directly instead of leaving the bridge type in the Loot owner.
- Reduce App to source ownership, transactional mutation/persistence, controller
  wiring, topbar bridges, cross-pane routing and tab composition.
- Preserve every numeric, storage, DOM, copy, callback, accessibility and
  visual contract.
- Add focused pure-view-model and pane tests before or with the mechanical move.
- Leave legacy migration and the final composition-root review to later,
  independently scoped work.

## Non-goals

- No change to price lookup, alias fallback, high-alch authority, scheduled
  writer, provenance, freshness or warning policy.
- No change to `PriceSet`, item metadata, shared-history or local-history
  schemas, caps, keys, versions or migrations.
- No change to `index-sim:price-set:selected`,
  `index-sim:manual-price-overrides`, `index-sim:price-history` or
  `index-sim:hidden-gear-tiers` persistence timing or recovery behavior.
- No change to PriceSet import/export envelopes, size bounds, generated-alch
  replacement, manual-overlay composition, accepted-history capture or
  scheduled/bundled reset fallback order.
- No change to manual-price capacity, draft selection, active/inactive override
  treatment, one-item reset, confirmed clear-all or session-only failure copy.
- No change to shared read-only history, local comparison capture/clear,
  baseline modes, sort behavior, missing/zero price handling, mover/trend math
  or Loot history context.
- No change to local-state recovery allowlists, metadata-only reports,
  clearability, one-shot persistence blocks, report export or caller-owned
  feature resets.
- No change to hidden-tier schema, current-selection visibility, picker
  filtering, Hide all or Show all behavior.
- No new reducer, context provider, feature store, state library, controller,
  Worker, async calculation, storage key, API, provider, database, auth,
  backend or deployment behavior.
- No change to the topbar PriceSet import or setup import/export surfaces.
- No legacy migration orchestration move. The global Import/Keep/Clear review
  remains outside this pane and requires its own later specification if moved.
- No copy, precision, order, semantic role, accessible name, focus, file-input
  reset, class, stylesheet, responsive layout or visual-baseline change.

If extraction exposes a behavioral defect, record it as a follow-up. Do not
silently fix it in this structural phase.

## Preserved sources of truth

| Concern                                                        | Owner after Phase 3G                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| Numeric price/alch lookup and warnings                         | `src/domain/economy` and composed simulation result                 |
| Scheduled PriceSet/runtime fallback                            | Existing generated/market adapters and runtime bootstrap controller |
| PriceSet import, acceptance, export and reset transaction      | Existing PriceSet transfer controller plus App outcome application  |
| Manual overlay schema and composition                          | `src/app/state/manual-price-overrides.ts`                           |
| Shared/local history schema and analysis algorithms            | `src/app/state/price-history.ts`                                    |
| Scheduled status and active-origin helpers                     | `src/app/state/market-sync.ts`                                      |
| Recovery health/persist/clear/export lifecycle                 | Existing local-state recovery controller                            |
| Local-state recovery DOM                                       | Existing `components/settings/local-state-recovery-panel.tsx`       |
| Hidden-tier schema and filtering                               | `src/app/state/hidden-gear-tiers.ts`                                |
| Price-data presentation and neutral item-history context       | New `src/app/view-models/price-data.ts`                             |
| Hidden-tier Settings presentation                              | New `src/app/view-models/settings.ts`                               |
| Complete shared Economy/Settings wrapper and sections          | New `src/app/components/panes/economy-settings-pane.tsx`            |
| Browser state, persistence transactions and cross-pane routing | `src/app/App.tsx` plus existing controllers                         |

## Target module map

### Price-data view model

Create `src/app/view-models/price-data.ts` as a DOM-free presentation adapter.
It may import domain value types and pure helpers from app state, but it must not
import React, components, browser adapters, storage, controllers or App.

Move these App-local derivations into the new owner:

- active PriceSet age, counts, label and source presentation;
- active item-metadata origin/refresh/quality summary counts;
- scheduled PriceSet status, age, counts, provenance summary, fallback label,
  tone and message;
- selected reset fallback label and reset availability;
- item label and manual-price option construction;
- active versus inactive manual override counts;
- effective manual item selection, base/active value, override row, input value,
  capacity state and Apply eligibility;
- shared/local history merge and summary;
- snapshot options and effective snapshot selection;
- mover rows, gainers, fallers, baseline label and sort state;
- trend item options, effective trend selection and trend points;
- selected item price/provenance/freshness presentation; and
- the item-indexed history context currently assembled in App for Loot.

Move `formatAge`, the item-metadata summarizer, Economy `aria-sort` mapping and
mover tone here when they are presentation values. Do not move shared generic
number/price formatting out of the existing formatter modules.

A target contract is a small set of cohesive builders in the same direct owner:

```ts
export interface PriceDataViewModel {
  active: ActivePriceSetPresentation;
  scheduled: ScheduledPriceSetPresentation;
  reset: PriceSetResetPresentation;
  manual: ManualPriceEditorPresentation;
  history: EconomyHistoryPresentation;
  lootHistoryByItem: Readonly<Record<string, ItemPriceHistoryContext>>;
}

export interface PriceSetPresentationInput {
  activePriceSet: PriceSet | null;
  basePriceSet: PriceSet | null;
  bundledPriceSet: PriceSet | null;
  scheduledSnapshotStatus: ScheduledStaticPriceSnapshotStatus | null;
  activePriceSetOrigin: ActivePriceSetOrigin;
  priceLabel: string;
  ageNow: Date;
}

export interface ManualPriceEditorInput {
  activePriceSet: PriceSet | null;
  basePriceSet: PriceSet | null;
  itemLabels: Readonly<Record<string, string>>;
  manualPriceOverrides: ManualPriceOverridesState;
  manualSelection: { itemId: string; draft: number | null };
}

export interface EconomyHistoryInput {
  scheduledSnapshotStatus: ScheduledStaticPriceSnapshotStatus | null;
  itemLabels: Readonly<Record<string, string>>;
  localPriceHistory: BrowserPriceHistoryState;
  economyControls: EconomyPriceHistoryControls;
}

export function createPriceSetPresentation(
  input: PriceSetPresentationInput
): Pick<PriceDataViewModel, "active" | "scheduled" | "reset">;

export function createManualPriceEditorPresentation(
  input: ManualPriceEditorInput
): ManualPriceEditorPresentation;

export function createEconomyHistoryPresentation(
  input: EconomyHistoryInput
): EconomyHistoryAnalysisPresentation & {
  analysisState: PriceHistoryAnalysisState;
  lootHistoryByItem: Readonly<Record<string, ItemPriceHistoryContext>>;
};

export function createPriceHistorySummaryPresentation(input: {
  analysisState: PriceHistoryAnalysisState;
  activePriceSet: PriceSet | null;
  evaluatedAt: Date;
}): PriceHistorySummaryPresentation;

export function createSelectedPriceItemPresentation(input: {
  activePriceSet: PriceSet | null;
  selectedItemId: string;
  freshnessNow: Date;
}): SelectedPriceItemPresentation;
```

Exact nested names and builder grouping may be refined during implementation.
The important contract is one direct module owner, explicit time inputs where
age/freshness is evaluated, no hidden browser reads and no duplicate analysis
in App. App may compose the pure outputs into `PriceDataViewModel`; that object
assembly is composition, not presentation derivation. Separate summary and
selected-item builders allow App to preserve the current memo/evaluation
cadence instead of coupling every price-history value to the minute clock.

The view model must reuse existing `state/price-history.ts`,
`state/manual-price-overrides.ts` and `state/market-sync.ts` functions. It must
not reimplement their schema, caps, metadata completion, baseline selection or
numeric analysis.

### Neutral item-history contract

Move the structural history context currently named
`LootPriceHistoryItemContext` from `view-models/loot.ts` to
`view-models/price-data.ts` and rename it neutrally, for example
`ItemPriceHistoryContext`.

`view-models/loot.ts` imports that type directly and continues to consume the
same fields. Do not add a compatibility re-export from Loot or simulation. The
dependency direction must be:

```text
price-data view model -> app price-history state/domain values
loot view model       -> price-data item-history type
App                   -> both view models and routes the produced record
```

The price-data module must not import Loot. This keeps the graph cycle-free and
makes the existing cross-pane bridge explicit.

### Settings view model

Create `src/app/view-models/settings.ts` as a small DOM-free owner for hidden
gear-tier presentation only. It receives `HiddenGearTiersState` and returns the
fixed ordered rows, checked state, hidden count, status and whether Show all is
enabled.

It must reuse `GEAR_TIER_DEFS` and preserve the current description fallback:
an explicit definition description wins; otherwise the row says
`Hide {lower-case label} gear`.

It must not filter equipment itself, read or persist storage, import the local
recovery controller or own mutation.

### Economy/Settings pane family

Create `src/app/components/panes/economy-settings-pane.tsx`. It owns the exact
current wrapper and all current child markup:

- conditional local-state recovery panel;
- Settings Price data section;
- Settings Gear menu section;
- shared Market section;
- Economy manual-price section;
- price-history summary and money warnings;
- market and import notices;
- Economy Price history analysis section;
- movers, provenance, trend chart and sortable table; and
- all PriceSet/file, history, manual-price, tier and recovery controls within
  those sections.

The existing `LocalStateRecoveryPanel`, form fields, import notice, warning
summary, charts and formatters remain reusable children. Do not duplicate them.

The pane receives readonly models and intent callbacks. Group the callbacks by
concern so the component API remains reviewable:

```ts
export interface EconomySettingsPaneProps {
  mode: "economy" | "settings" | "hidden";
  model: {
    prices: PriceDataViewModel;
    settings: SettingsPaneViewModel;
    moneyWarnings: readonly CalculationWarning[];
    marketNotice: MarketNotice | null;
    importNotice: ScopedPriceImportNotice | null;
    recovery: LocalStateRecoveryPaneModel;
    localHistoryClearPending: boolean;
    manualClearPending: boolean;
    priceSetResetPending: boolean;
  };
  actions: {
    prices: PriceSetPaneActions;
    history: PriceHistoryPaneActions;
    manual: ManualPricePaneActions;
    settings: HiddenGearTierPaneActions;
    recovery: LocalStateRecoveryPaneActions;
  };
}
```

The exact supporting interface names may change. Callbacks must express user
intent, not expose raw React setters or storage/controller objects.

The component may own the mechanical file-input extraction and `finally`
reset, following the existing Duel pane pattern. It calls a typed
`importPriceSet(file, surface)` action. It must not parse, persist or accept the
file itself.

### Exact wrapper contract

The current unusual but tested mounted/hidden behavior is part of this
structural phase's compatibility boundary:

| Mode       | Wrapper class   | Wrapper label   | Hidden | Conditional children                                           |
| ---------- | --------------- | --------------- | ------ | -------------------------------------------------------------- |
| `economy`  | `economy-pane`  | `Economy`       | no     | Economy sections plus shared Market                            |
| `settings` | `service-strip` | `Live services` | no     | Recovery when visible, Price data, Gear menu and shared Market |
| `hidden`   | `service-strip` | `Live services` | yes    | Shared Market remains mounted; tab-only sections stay absent   |

Do not replace this with two simultaneously mounted pane trees, because that
would change hidden DOM, labels and selector behavior. A later product/DOM
cleanup requires separate evidence.

### App composition root after Phase 3G

App continues to own:

- all current relevant state cells and the minute price-age clock;
- `context`, base/bundled/active PriceSet application and active-origin state;
- versioned local price history, manual overrides and hidden-tier state;
- manual item/draft and all confirmation state;
- Economy baseline/snapshot/filter/trend/sort state because baseline selection
  is also routed to Loot and the other cells participate in explicit reset
  semantics;
- local-state and PriceSet controller construction;
- accepted/imported/reset PriceSet outcome application;
- manual-price save/failure/recovery composition;
- history capture and confirmed local clear;
- hidden-tier schema mutation;
- recovery clear outcomes that reset caller-owned feature values;
- global status, market notice and fatal-state composition;
- topbar PriceSet import and setup import/export bridges;
- routing the price-data view model's item-history record into Loot; and
- choosing `economy`, `settings` or `hidden` from the active workbench tab.

App must no longer render the Economy/Settings DOM, calculate price summaries,
build options/movers/trends/provenance presentation or reconstruct Settings tier
rows.

## Transaction and state invariants

### PriceSet acceptance and reset

- `usePriceSetTransfer` remains the only PriceSet transfer lifecycle owner.
- App applies only typed ready outcomes and retains the exact set order for
  base PriceSet, manual draft/confirmation reset, active context, local history,
  label, origin, status, market notice and fatal error.
- Import notices remain scoped to `topbar`, `settings` or `market`.
- Reset uses scheduled prices when available and bundled prices otherwise.
- Reset clears only the selected PriceSet; manual overlays and local history are
  retained exactly as today.

### Manual prices

- The base PriceSet stays immutable and manual prices remain a separate capped
  overlay.
- The effective selection falls back to the first sorted base-price option when
  the stored item is unavailable.
- Drafts remain item-scoped and are cleared on accepted/reset base changes.
- Applying the base value removes the row; one-item Reset and confirmed Clear
  all retain their current status and failure behavior.
- Temporarily unavailable stored overrides remain inactive, not deleted.
- Generated high alch is never changed by manual item prices.

### Price history

- Shared history remains read-only and local history remains independently
  persisted and capped.
- Accepting an imported/legacy PriceSet appends the canonical base snapshot at
  the acceptance time through the controller's latest-state updater.
- `Save local comparison` captures the active PriceSet explicitly.
- `Clear local history` clears only the rewrite local-history key after the
  current confirmation flow.
- Missing prices and zero baselines remain null-safe and finite.
- The same effective Economy baseline/snapshot continues to drive Loot item
  history context.
- Existing evaluation cadence is preserved: active/scheduled age and selected
  item freshness follow the minute clock, while the Price history `Latest age`
  summary reevaluates with its current history/active-PriceSet dependencies.
  Making that summary independently live is a behavioral cleanup, not part of
  this structural phase.

### Settings and recovery

- Hidden-tier changes continue through schema helpers and the existing App
  persistence effect.
- Current selections and `None` remain visible despite hidden tiers.
- Recovery stays metadata-only and allows clearing only known rewrite-owned
  keys.
- Clearing manual-price recovery state also resets the caller-owned overlay,
  draft, confirmation and active composed PriceSet exactly once.
- Replacing compatible state continues to unblock one-shot persistence without
  broadening clear permissions.

## Implementation sequence

Implement Phase 3G as one goal with four reviewable subphases.

### Phase 3G.1 - characterization tests

Add focused tests before moving markup:

- one pure price-data suite for active/scheduled summaries, manual selection,
  reset availability, shared/local source status, baseline modes, sorting,
  trend/provenance and Loot item-history context;
- one Settings view-model suite for order, descriptions, counts and Show all;
- one pane suite that statically renders `economy`, `settings` and `hidden`
  modes and asserts exact landmarks, order, labels, roles, hidden behavior,
  confirmations and notice placement; and
- callback tests for sort, manual, tier, history, recovery and file-import
  intent forwarding without storage or domain work in the component.

Do not snapshot the full HTML string. Assert stable landmarks and behavior so
tests remain useful without freezing incidental React serialization.

### Phase 3G.2 - direct view-model owners

- add `view-models/price-data.ts` and `view-models/settings.ts`;
- move derivation mechanically and compare focused outputs against the current
  App path;
- move the neutral item-history type and update Loot's direct import; and
- delete moved App helpers/imports immediately. Do not leave aliases or
  compatibility re-exports.

### Phase 3G.3 - pure pane extraction

- add `components/panes/economy-settings-pane.tsx`;
- move JSX without changing text, order, roles, classes or callbacks;
- reuse the existing recovery panel and charts;
- preserve file-input reset and the exact three-mode wrapper behavior; and
- replace the App block with one typed component composition.

### Phase 3G.4 - composition cleanup and evidence

- remove orphaned App imports, helpers, types and duplicate derivation;
- run the architecture graph and confirm no cycle/orphan/exception;
- inspect the remaining App responsibilities rather than optimizing for a line
  count;
- update architecture, testing, parent specification and backlog evidence; and
- keep any newly identified legacy-migration/controller cleanup as a Phase 4
  follow-up rather than expanding this goal.

## Focused test matrix

### New unit coverage

`src/tests/price-data-view-model.test.ts` should cover at minimum:

- empty, bundled, scheduled and selected active-price presentation;
- scheduled warning/fallback message and one captured `now` value;
- metadata counts including observed quality, retained, generated, manual,
  unknown and missing mapped items;
- reset availability and fallback choice;
- manual option ordering, effective selection, base/active values, active versus
  inactive counts, cap and Apply states;
- shared-only, local-only, shared+local and empty history status;
- previous, first and explicit-snapshot baselines;
- item filtering and all five sort keys/directions;
- missing and zero price deltas;
- trend selection/provenance/freshness; and
- exact Loot item-history record parity.

`src/tests/economy-settings-pane.test.ts` should cover at minimum:

- exact wrapper class/label/hidden behavior for all three modes;
- Settings recovery, Price data, Gear menu and Market order;
- Economy Market, manual price, summary/warnings and history order;
- shared Market presence in hidden mode;
- PriceSet reset, local-history clear and manual clear confirmation branches;
- scoped import and market notice rendering;
- sorter `aria-sort` and callback intent;
- hidden-tier checked state/action forwarding; and
- file input passes one `File`, preserves the surface and resets the control.

`src/tests/settings-view-model.test.ts` should cover definition order,
description fallback, hidden count and all-visible/all-hidden states.

### Existing focused regressions

At minimum run:

```sh
npm run test -- \
  src/tests/price-data-view-model.test.ts \
  src/tests/settings-view-model.test.ts \
  src/tests/economy-settings-pane.test.ts \
  src/tests/market-ui-state.test.ts \
  src/tests/price-set-transfer-controller.test.ts \
  src/tests/local-state-recovery-controller.test.ts \
  src/tests/ui-adapters.test.ts \
  src/tests/loot-view-model.test.ts
```

The implementation may add a narrower existing test file if an affected
contract is owned elsewhere. It must not weaken or rename existing tests merely
to make extraction pass.

### Browser characterization

Run the existing production-preview cases matching these workflows:

- scheduled price status and selected override separation;
- invalid local state recovery in Settings;
- hidden gear tiers with current selections retained;
- setup/PriceSet import success and retryable failure surfaces;
- scheduled-only market UI;
- manual item drafts and unavailable overrides across base changes;
- browser-local price history analysis/management; and
- shared scheduled history beside local comparisons.

Then run the complete Chromium suite. Existing scenario names and selectors are
compatibility evidence and must not be rewritten around new implementation
details.

### Numeric, visual and repository gates

Required final validation:

```sh
npm run typecheck
npm run architecture:check
npm run test:golden
npm run numeric:audit
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

The visual run is read-only. `Economy desktop` and `Settings desktop` must match
the reviewed baselines; do not update PNGs for a structural refactor.

Because active prices feed all economy and Trip outputs, the numeric audit and
goldens are required even though no formula change is intended. The production
artifact must also remain inside the D-094 entry budgets enforced by `verify`.

## Documentation updates during implementation

- Mark this specification implemented and add measured evidence.
- Update [architecture.md](architecture.md) with the new pane/view-model owners
  and the measured remaining App composition responsibilities.
- Update [testing.md](testing.md) with focused/full counts and visual evidence.
- Update the Phase 3G and Phase 4 status in
  [app-composition-root-refactor-spec.md](app-composition-root-refactor-spec.md).
- Update [../project/backlog.md](../project/backlog.md) from `Specced` to `Done`
  only after source extraction and all required evidence pass.
- Update product or decision docs only if implementation requires a separately
  accepted behavioral change; this specification authorizes none.

## Done criteria

Phase 3G is complete only when:

- App renders no Economy/Settings child markup;
- App contains no price-summary, scheduled-summary, manual-editor,
  history-mover/trend/provenance or tier-row presentation derivation;
- the complete wrapper/section DOM belongs to the pure pane family;
- the neutral item-history contract is produced by price-data and consumed
  directly by Loot without a cycle or compatibility barrel;
- state, persistence, controller and cross-pane ownership remain explicit in
  App;
- no product, calculation, schema, copy, CSS, browser, provider or deployment
  contract changes;
- focused tests, numeric audit, goldens, full Chromium, read-only visual and
  full repository verification pass; and
- living architecture/testing docs and the parent/backlog status are current.

## Implementation evidence

- `src/app/components/panes/economy-settings-pane.tsx` (683 lines) owns the
  complete existing three-mode wrapper, Settings recovery/Price data/Gear menu,
  shared Market section and Economy manual/history analysis DOM. It receives
  one typed model plus explicit intent callbacks and performs no storage,
  adapter, calculation or persistence work. File selection forwards one `File`
  and resets the input in `finally` exactly as before.
- `src/app/view-models/price-data.ts` (481 lines) owns active/scheduled/reset
  summaries, metadata counts, manual-price presentation, shared/local history
  composition, mover/trend/provenance presentation and the neutral
  `ItemPriceHistoryContext`. `loot.ts` and `simulation.ts` import that neutral
  contract directly; price-data does not import Loot and no compatibility
  re-export remains. All age/freshness evaluations receive explicit `Date`
  inputs.
- `src/app/view-models/settings.ts` (35 lines) owns the fixed ordered hidden-tier
  rows, description fallback, count and Show-all predicate. Schema, filtering,
  persistence and mutation remain in their previous state/App owners.
- `App.tsx` decreased from 4,297 to 3,587 lines while retaining the same 46
  React state cells. It now composes the pane/view models and retains browser
  state, persistence transactions, controller outcome application, topbar
  bridges, cross-pane Loot/Loadout routing, normalized mutations and tab
  composition; it renders no Economy/Settings child markup and contains none
  of the moved summary/mover/trend/provenance/tier-row derivation.
- The three new focused suites pass 16/16. The required combined price,
  transfer, recovery, adapter and Loot regression command passes 132/132.
  Architecture passes at 108 source modules / 96 client-reachable modules /
  seven external entrypoints with no cycle, exception or orphan.
- The read-only numeric audit passes 5,958/5,958 comparisons with zero mismatch
  and all 19 goldens remain unchanged. The eight specified production-preview
  Economy/Settings workflows pass 8/8; the complete Chromium suite passes
  77/77.
- Full `npm run verify` passes 61 files / 746 tests plus 19 explicit goldens,
  typecheck, architecture, build/artifact, lint, Prettier and diff gates. The
  10-file/two-asset artifact totals 1,972,778 bytes with SHA-256
  `1d0bb317b35fec093c7128559fbd0f39de17623d9799dbfe8a4bed65425118c0`;
  entry JavaScript remains inside D-094 at 716,243 raw / 208,034 gzip bytes.
- The first dedicated visual preview start was sandbox-blocked on port 5174.
  The approved localhost-only read-only rerun passed 20/20 against the same 31
  reviewed Darwin PNGs, including Economy desktop and Settings desktop. No
  baseline, Playwright configuration, CSS, schema, copy, formula, provider or
  persistence contract changed.

## Deferred Phase 4 review questions

These do not block Phase 3G and must not expand it:

- Should any Economy transient state move into a focused hook after its
  cross-pane and base-reset semantics are re-measured?
- Should manual-price persistence or local-history clear orchestration receive
  a separate controller, or are their remaining App transactions already the
  clearest owner?
- Should global legacy migration orchestration receive its own controller and
  presenter extraction?
- After all pane families are extracted, which App helpers are genuinely
  feature-only forwarding code and which are legitimate composition-root
  transactions?

Answer these from the measured post-Phase-3G graph and responsibilities, not a
target App line count.

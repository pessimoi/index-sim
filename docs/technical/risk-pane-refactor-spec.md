# Risk pane, view-model and analysis-controller refactor specification

Status: implemented on 2026-07-13 as D-093 composition-root Phase 3E.

## Purpose

Extract the Risk presentation family from `src/app/App.tsx`, move its small
feature-specific contracts and formatting helpers to a direct Risk view-model
owner, and place the existing user-triggered Worker lifecycle behind a focused
controller without changing behavior.

This is an ownership refactor. It preserves the implemented stochastic model,
request/result contract, transient control state, explicit Run/Cancel workflow,
source-reference freshness, stale-result retention, global status messages,
cross-pane compact ranges, DOM, copy, styling, accessibility and browser
contracts. The phased parent remains
[app-composition-root-refactor-spec.md](app-composition-root-refactor-spec.md),
the product/model contract remains
[risk-variability-spec.md](risk-variability-spec.md), and D-093 remains the
accepted composition-root decision.

## Why Risk is Phase 3E

Risk is the smallest remaining cohesive calculation-and-pane family:

- `src/domain/risk` already owns the pure seeded stochastic algorithm, model
  version, validation, distributions, probabilities and coverage warnings;
- `src/app/calculation-task.ts` already exposes a typed cancellable
  `risk-analysis` request through the existing one-shot Worker boundary;
- all Risk UI controls and results are transient and intentionally absent from
  persistence, imports, exports, Duel snapshots and permalinks;
- the pane has one explicit Run/Cancel intent boundary instead of calculate-on-
  edit behavior;
- source freshness is already reference-based and isolated from deterministic
  `FullSimulationResult` ownership; and
- focused domain, structured-clone, production-preview, responsive and full
  repository evidence already exists.

Loot and Trip remain broad live-form mutation surfaces with many controls and
shared view-model rows. Economy and Settings interleave PriceSet transfer,
manual overrides, local/shared history and recovery state. Risk therefore has a
smaller independent move surface than either remaining family.

## Current evidence

At specification time, after implemented Planner Phase 3D:

- `src/app/App.tsx` is 5,965 lines and owns 49 React state cells;
- the Risk-only contracts/defaults/formatters occupy `App.tsx` lines 632-670;
- three Risk state cells and one task ref occupy lines 1,064-1,067;
- target-drop options, freshness, status and source-change/unmount cancellation
  occupy lines 1,671-1,724;
- Run/Cancel orchestration occupies lines 2,306-2,347;
- the complete Risk pane occupies lines 5,049-5,288;
- App owns the transient controls, latest build, run status, active task,
  reference freshness, stale display snapshot and global status messages;
- the Worker source contains exact `form`, `context`, `cannonByMonster`, current
  monster loot preferences, `lootSettingsByMonster` and the current analysis
  controls;
- editing any source or control does not run analysis automatically; it retains
  the last result, makes it stale and cancels only a currently running task;
- changing the workbench tab does not cancel the analysis;
- only a fresh result contributes compact Risk information to the shared TTK
  and net-GP metrics, the Trip `Risk ranges` link and the Trip kills/trip
  P10/50/90 row;
- `src/domain/risk/index.ts` owns `RiskAnalysisParameters`,
  `RiskAnalysisResult`, distribution and coverage contracts;
- `src/app/calculation-task.ts` owns the unchanged `risk-analysis` request and
  structured-clone result dispatch;
- `src/tests/risk-analysis.test.ts` has 13 deterministic model cases, the shared
  calculation-task suite has four request-boundary cases, and the focused Risk
  browser workflow covers Run, ready/stale/cancelled states, all result cards,
  coverage and warnings; and
- the architecture gate passes with 97 source modules, 85 client-reachable
  modules, seven explicit external entrypoints, no cycles and no exceptions.

The Risk calculation boundary is sound. This phase must not combine its
structural extraction with model, product or persistence changes.

## Goals

- Make Risk an independently reviewable feature-pane owner.
- Give Risk controls, build state, active task, freshness and Run/Cancel
  lifecycle one focused React controller.
- Move Risk-only contracts, option derivation and presentation formatting out
  of App without creating a compatibility barrel.
- Preserve transient session ownership and every current source/freshness
  rule.
- Preserve the fresh-result bridges into shared Stats/Compare and Trip
  presentation.
- Keep App as the owner of live simulation inputs, global workbench composition
  and global status presentation.
- Remove obsolete Risk state, task refs, helpers, lifecycle effects and markup
  from App after focused tests lock the behavior.
- Leave Loot, Trip, Economy and Settings boundaries unchanged for later goals.

## Non-goals

- No stochastic formula, PRNG, seed, fingerprint, quantile, sampling,
  probability, coverage, warning, incoming-damage, loot, trip or supply change.
- No `RISK_MODEL_VERSION`, default/allowed sample-count or production 10,000-
  trial change.
- No `RiskAnalysisParameters`, `RiskAnalysisResult`,
  `RiskAnalysisCalculationRequest`, Worker response, timeout or calculation
  dispatch change.
- No automatic or debounced Risk analysis after control, form, context,
  cannon, price or loot-policy changes.
- No cancellation merely because the Risk tab becomes hidden. An explicitly
  started analysis continues across workbench tab changes exactly as today.
- No control or result persistence, setup/share/import/export field, browser
  storage key, migration, schema or recovery change.
- No `SimulationRequest` or `FullSimulationResult` change. Deterministic
  expected values remain separate truth.
- No change to stale-result retention, status precedence or global status copy.
- No progress UI, partial result, persistent Worker, Worker pool, shared context
  cache or scheduling redesign.
- No new Risk chart, new visual baseline, copy, precision, order, semantic role,
  class, focus behavior or stylesheet change.
- No extraction of the shared metric strip, Trip pane, Loot pane, active
  assumptions or warning presenters in this phase.
- No provider, network, server, auth, account, database, deployment or generated-
  data change.
- No broad split of the mixed browser or view-model suites beyond focused new
  Risk pane/controller coverage.

If extraction exposes an existing behavioral defect, record it as a follow-up.
Do not repair it in this ownership phase unless it blocks the move and this
specification is updated first.

## Preserved sources of truth

| Concern                                                 | Owner after this phase                            |
| ------------------------------------------------------- | ------------------------------------------------- |
| Stochastic model, validation and result contracts       | `src/domain/risk`                                 |
| Deterministic combat/trip/economy input                 | `src/domain/simulation` and existing form adapter |
| Worker request/result execution                         | `src/app/calculation-task.ts`                     |
| Risk UI contracts, options and formatting               | New `src/app/view-models/risk.ts`                 |
| Transient controls, task, freshness and Run/Cancel      | New Risk analysis controller hook                 |
| Risk landmark and result presentation                   | New `src/app/components/panes/risk-pane.tsx`      |
| Live form/context/cannon/loot state and global status   | `src/app/App.tsx`                                 |
| Shared fresh-result composition into Stats/Compare/Trip | `src/app/App.tsx` until those owners move         |

No new stochastic result object may replace `RiskAnalysisResult`, and no Risk
value may enter `FullSimulationResult` or a persisted state contract.

## Target module map

### Risk view model

Create `src/app/view-models/risk.ts`. Move the current Risk-specific contracts,
defaults and pure presentation helpers from App:

- `RiskControls`, the four-field production `Pick<RiskAnalysisParameters, ...>`;
- `DEFAULT_RISK_CONTROLS` with `50`, `60`, `100_000` and no target drop;
- `RiskRunStatus` and the visible Risk status-label contract;
- a narrow `RiskTargetDropCandidate` input and target-drop option contract;
- `createRiskTargetDropOptions()`;
- `formatRiskRange()`; and
- `formatRiskProbability()`.

The shared visible status type is exact:

```ts
export type RiskStatusLabel = "Idle" | "Running" | "Ready" | "Stale" | "Cancelled" | "Unavailable";
```

The target-drop helper accepts only the fields it needs: row id, name,
preference and chance. It preserves the fixed first option `No target drop`,
then includes current rows whose preference is not `skip` and whose chance is
positive, in the existing row order. It does not import the broad
`SimulationViewModel` or the future Loot pane.

Formatting remains exact:

- null distributions render `Unbounded`;
- ranges render `P10 / P50 / P90` with the caller-supplied digits and suffix;
- non-finite probabilities render `Unavailable`;
- an observed zero with a positive sample count renders the current rule-of-
  three upper bound;
- a positive probability below `0.001` renders `<0.1%`; and
- other probabilities render one decimal percent.

The module may import Risk domain types and shared pure number formatting. It
must not import React, components, controllers, calculation clients, storage,
browser APIs, adapters or `simulation.ts`.

### Risk analysis controller

Create `src/app/controllers/use-risk-analysis.ts`. It owns:

- the three current session-local state cells: controls, latest build and run
  status;
- the active `RunningCalculationTask` ref;
- exact source capture when the user invokes Run;
- latest-task settlement guards;
- source-reference freshness;
- cancellation on source/control change only while a task is running;
- unmount cancellation;
- explicit Cancel behavior;
- fixed global status messages;
- current visible status precedence;
- target-drop option derivation; and
- both stale-display and fresh-cross-surface snapshots.

Its source contract remains:

```ts
export interface RiskAnalysisSource {
  form: CombatSetupFormState;
  context: SimulationContext;
  cannonByMonster: CannonByMonsterState;
  lootPrefs: Record<string, string | undefined>;
  lootSettingsByMonster: LootSettingsByMonsterState;
  analysis: RiskControls;
}
```

The hook input is intentionally not keyed by active tab:

```ts
export interface UseRiskAnalysisInput {
  form: CombatSetupFormState;
  context: SimulationContext | null;
  cannonByMonster: CannonByMonsterState;
  lootPrefs: Record<string, string | undefined>;
  lootSettingsByMonster: LootSettingsByMonsterState;
  targetDropCandidates: readonly RiskTargetDropCandidate[];
  onStatus(message: string): void;
}
```

Omitting `active` preserves the current rule that a user-started analysis keeps
running after another workbench tab is selected. The hook never starts a task
from an effect. A missing context makes Run unavailable/no-op at the composition
boundary; the pane is not rendered before runtime readiness today.

The pane-ready/cross-surface return contract is:

```ts
export interface RiskResultSnapshot {
  result: RiskAnalysisResult;
  controls: RiskControls;
}

export interface RiskDisplaySnapshot extends RiskResultSnapshot {
  fresh: boolean;
}

export interface RiskAnalysisController {
  controls: RiskControls;
  runStatus: RiskRunStatus;
  statusLabel: "Idle" | "Running" | "Ready" | "Stale" | "Cancelled" | "Unavailable";
  targetDropOptions: readonly RiskTargetDropOption[];
  display: RiskDisplaySnapshot | null;
  fresh: RiskResultSnapshot | null;
  setTargetKills(value: number): void;
  setHorizonMinutes(value: number): void;
  setGpTarget(value: number): void;
  setTargetDropRowId(value: string | null): void;
  run(): void;
  cancel(): void;
}
```

The implementation may inject a task starter for focused tests. Production
uses `startCalculationTask()` with the existing `RiskAnalysisCalculationRequest`
and must not call `analyzeRisk()` directly.

### Exact lifecycle contract

Run captures the current six source references, cancels any previous task,
starts one `risk-analysis` task, sets `running` and announces exactly
`Running modeled risk analysis` through `onStatus`.

Successful latest-task settlement stores the result and captured source, sets
`ready`, clears the active ref and announces exactly
`Risk analysis ready: N trials` using current number formatting.

Latest-task cancellation rejection sets `cancelled` and announces exactly
`Risk analysis cancelled`. A non-cancellation failure sets `unavailable` and
announces exactly `Risk analysis unavailable`. Raw errors, stacks and Worker
payloads never escape.

Explicit Cancel cancels and clears the active ref, sets `cancelled` and emits
the same cancelled message. Source/control-change cancellation cancels and
clears the task and sets `cancelled`, but preserves the current behavior of not
adding a new global status message. Unmount cancels silently.

A build is fresh only when all six captured references match the current
source references. The analysis-controls object is one of those exact
references. Deep equality, fingerprints and domain result ids do not replace
this UI freshness rule.

The last completed build is retained when it becomes stale. `display` therefore
continues to expose its result and captured controls with `fresh: false`, while
`fresh` becomes null. This ensures the Risk pane can explain stale output but
shared Stats/Compare/Trip surfaces never show it.

Status precedence remains exact:

1. `running` -> `Running`;
2. `unavailable` -> `Unavailable`;
3. `cancelled` -> `Cancelled`;
4. retained build without source freshness -> `Stale`;
5. fresh retained build -> `Ready`;
6. otherwise -> `Idle`.

A failed rerun currently does not delete a previous completed build. If its
source references still match, that result stays visible while the status says
`Unavailable`. This phase records and preserves that behavior; changing whether
such a result should also be called stale is a later product/behavior decision.

### Calculation-task boundary

`src/app/calculation-task.ts` keeps the exact four request kinds and current
Risk dispatch:

- `risk-analysis` receives form, context, cannon, current-monster loot
  preferences, all per-monster loot settings and analysis parameters;
- it creates the existing `FullSimulationInput` through
  `createFullSimulationInputForForm()`;
- it calls domain `analyzeRisk()` inside the Worker task boundary; and
- it returns the unchanged structured-clone-compatible `RiskAnalysisResult`.

No production change is expected in this file beyond a mechanical type import
only if required by the controller. Do not add controller, pane or view-model
dependencies to calculation execution.

### Risk pane

Create `src/app/components/panes/risk-pane.tsx`. It owns the complete current
Risk region only:

- `Risk` landmark and hidden behavior;
- `Risk & variability` title, intro and live status pill;
- Target kills, Horizon min, GP target and searchable Target drop controls;
- Run and Cancel button states;
- initial empty instructions;
- stale-result warning;
- deterministic-trial range key;
- Kill time, Food runs out, Kills/trip, Trip cycle, timed net GP, GP target and
  Target drop cards;
- current deterministic TTK and kills/trip comparisons;
- model coverage definition list and mean-only sources; and
- bounded structured Risk warnings.

The pane receives one readonly model and one intent action object:

```ts
export interface RiskPaneModel {
  controls: RiskControls;
  runStatus: RiskRunStatus;
  statusLabel: RiskStatusLabel;
  targetDropOptions: readonly RiskTargetDropOption[];
  display: RiskDisplaySnapshot | null;
  expectedTtkSec: number;
  expectedKillsPerTrip: number;
}

export interface RiskPaneActions {
  setTargetKills(value: number): void;
  setHorizonMinutes(value: number): void;
  setGpTarget(value: number): void;
  setTargetDropRowId(value: string | null): void;
  run(): void;
  cancel(): void;
}

export interface RiskPaneProps {
  hidden: boolean;
  model: RiskPaneModel;
  actions: RiskPaneActions;
}
```

The pane imports the shared status type from the Risk view-model module, not the
controller. Components do not depend on hooks.

The pane may import shared form fields, direct Risk domain/view-model types and
pure formatting. It must not import App, the controller, calculation client,
storage, adapters or domain execution functions.

### Cross-surface fresh-result bridges

Four existing presentation bridges remain in App until their owning panes move:

1. TTK secondary copy in the shared Stats/Compare metric strip;
2. timed net-GP secondary copy in that metric strip;
3. the Trip-pane `Risk ranges` navigation button; and
4. the Trip Outcome group `Modeled P10/50/90` kills/trip row.

All four consume only `controller.fresh`. They disappear immediately when the
source becomes stale, unavailable without a fresh build, or absent. Their text,
precision, tone and navigation behavior remain unchanged. App may import the
pure Risk formatting helper during this phase; it must not reconstruct
freshness or read controller-internal build state.

The Risk pane receives `controller.display`, so it alone may show a retained
stale result and the existing stale warning. It uses the captured controls from
that display snapshot, ensuring old results retain their original target-kill,
horizon and GP-target labels.

## `App.tsx` ownership after the phase

App continues to own:

- live form, context, cannon and loot state;
- current-monster loot preference selection;
- `FullSimulationResult` and `SimulationViewModel` composition;
- global status state and accessible announcement rendering;
- active workbench tab and navigation to Risk;
- expected TTK and kills/trip values supplied to the pane;
- mapping controller values/actions into `RiskPane`; and
- the four temporary fresh-result bridges listed above.

App no longer owns:

- Risk controls, build or run-status state cells;
- the Risk task ref;
- task start/settlement/cancellation logic;
- source-change or unmount cancellation effects;
- freshness/status derivation;
- target-drop option derivation;
- Risk-only types, defaults or formatting functions; or
- Risk pane markup.

No Risk state moves into a provider, reducer, global store or persisted state.

## Dependency direction

The intended direction is:

```text
domain/risk + domain/simulation + app calculation task
                         |
                         v
                  one-shot Worker

domain Risk types + narrow loot-row candidates
                         |
                         v
                  Risk view model
                         |
                         v
                  Risk controller
                         |
                         v
App composition ----> pure Risk pane
       |
       +------------> fresh-only shared metric/Trip bridges
```

The pane may import Risk view-model contracts but never the controller. The
view model is DOM-free, the controller does not render, and no domain module
imports app code. The architecture gate must report no cycle or exception.

## Implementation phases

### Phase 1 - freeze pane and lifecycle contracts

Before moving lifecycle or broad JSX:

- add server-render semantic tests for idle, running, ready, stale and
  unavailable/cancelled Risk states;
- record the landmark, heading, intro, status, control bounds, searchable drop
  option order, button disabled states, result-card order, coverage labels,
  warning role and empty/stale copy;
- add controller tests for initial idle state, explicit Run, replacement,
  source/control cancellation, latest-task guards, success, sanitized failure,
  explicit Cancel, stale retention, freshness, unmount and global messages;
- retain existing domain, calculation-task, responsive, popup-search and full
  Risk browser evidence; and
- assert that tab activation is absent from the controller input and therefore
  cannot become an accidental cancellation key.

Tests assert durable semantic contracts rather than complete raw markup.

### Phase 2 - extract Risk view-model leaves

Move Risk controls/defaults/status types, target-drop option derivation and
formatters to `view-models/risk.ts`. Update App and tests to use direct imports.
Delete the old declarations immediately; do not add a compatibility re-export
through `simulation.ts` or a generic barrel.

Run typecheck, architecture, Risk domain, calculation-task and focused UI tests
before moving state or effects.

### Phase 3 - extract the analysis controller

Move all three state cells, task ref, effects, freshness/status derivation and
Run/Cancel functions behind `useRiskAnalysis()`. Keep existing pane markup in
App during this phase so lifecycle behavior can be isolated.

Preserve manual execution, task replacement, source-change cancellation,
stale-result retention, latest-task guards, global status copy and the absence
of tab-based cancellation.

### Phase 4 - extract pane presentation

Move the exact Risk region to `RiskPane`. App supplies the controller model,
expected deterministic values and intent actions.

Preserve DOM order, classes, copy, roles, labels, hidden behavior, control
bounds, searchable field behavior, warning severity classes and callback
timing. Do not reorganize layout or change responsive CSS.

### Phase 5 - composition cleanup

After focused behavior gates pass:

- remove obsolete Risk state, ref, helpers, effects, functions and imports from
  App;
- verify App sees only the controller public contract;
- verify the pane does not import the controller;
- verify no duplicate Risk formatter, status or source contract remains;
- verify the four cross-surface consumers use only the fresh snapshot;
- run orphan-module and dead-import checks; and
- update architecture/testing evidence with measured final counts.

Line count is evidence, not an acceptance target.

## Compatibility invariants

The complete phase preserves:

- every visible Risk string, numeric precision, result-card order and warning;
- transient defaults and numeric bounds;
- target-drop eligibility and option order;
- explicit Run and Cancel with no auto-run;
- continued work across tab changes;
- task replacement and cancellation on live source/control changes;
- exact source-reference freshness;
- stale result visibility only inside Risk;
- fresh-only TTK, net-GP and Trip bridges;
- captured-control labels for stale output;
- `Idle`, `Running`, `Ready`, `Stale`, `Cancelled` and `Unavailable` precedence;
- fixed global status messages and sanitized failure behavior;
- domain model version, sample count, seed/fingerprint and deterministic output;
- Worker request/result structured-clone shape;
- deterministic `FullSimulationResult` ownership;
- no persistence/import/export/share/migration footprint;
- current responsive, popup-search, keyboard and long-task behavior; and
- D-094 entry budgets.

No visual baseline update is expected. The current 20-scenario Darwin suite has
no Risk-specific screenshot at specification time; it remains a shell-level
regression gate, while semantic pane tests and the focused functional Risk
workflow own the moved pane directly. Adding a Risk baseline is a separate
visual-scope decision.

## Tests and validation

Add focused tests:

- `src/tests/risk-pane.test.ts` for server-render semantic contracts; and
- `src/tests/risk-controller.test.ts` for transient controls, task lifecycle,
  freshness, stale retention, cancellation, settlement guards and messages.

Existing model cases remain in `risk-analysis.test.ts`, structured-clone
coverage remains in `calculation-task.test.ts`, and current cross-pane/browser
cases remain in their existing files during the mechanical move.

Minimum focused gate:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/risk-analysis.test.ts src/tests/calculation-task.test.ts src/tests/trip-loot-supply.test.ts src/tests/ui-view-model.test.ts src/tests/risk-pane.test.ts src/tests/risk-controller.test.ts
npm run numeric:audit
npm run test:golden
npm run test:e2e -- --workers=1 -g "runs, invalidates and cancels modeled Risk analysis|keeps compact setup actions, Risk controls and setup summaries readable|uses popup search for every primary long-choice field"
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

The implementation report records final source-module counts, `App.tsx` state
and line counts, Risk view-model/controller/pane sizes, focused/full test
counts, numeric/golden results, focused/full functional browser results,
shell-level visual result, artifact entry bytes and SHA-256. Counts are evidence,
not success criteria.

## Allowed implementation scope

Expected source changes are limited to:

- `src/app/App.tsx`;
- the new Risk view-model module;
- the new Risk analysis controller hook;
- the new Risk pane component;
- focused tests and mechanical direct imports; and
- owning architecture, testing, backlog and documentation indexes.

No Risk domain, calculation-task execution, generated-data, persisted-state,
adapter, server, Worker implementation, deployment or CSS change is expected.
If one becomes necessary, stop and update this specification before broadening
implementation.

## Documentation updates on implementation

- Mark this specification implemented and append exact evidence.
- Update the parent composition-root specification Phase 3E status.
- Update `docs/technical/architecture.md` with actual owners and counts.
- Update `docs/technical/testing.md` with focused and full gates.
- Move the Risk ownership backlog row to `Done` while leaving Loot/Trip and
  Economy/Settings open.
- Update `risk-variability-spec.md` only where its implementation-owner evidence
  still names App after the move.
- Do not add a new decision unless implementation changes a boundary beyond
  D-093.

## Done criteria

- Risk renders through its own pane component.
- Risk transient controls and Worker orchestration have a focused controller
  owner outside App.
- Risk contracts/options/formatters have a direct DOM-free owner.
- App no longer owns Risk state cells, task refs, lifecycle effects, helpers or
  pane markup.
- App retains live source/global-status composition and only fresh-result
  cross-surface bridges.
- Domain, request, Worker, persistence, copy, DOM, CSS, numeric and transient-
  state contracts remain unchanged.
- Focused, numeric, golden, browser, shell visual and full repository gates pass.
- Owning documentation reports actual implementation evidence.

## Implementation evidence

- `src/app/view-models/risk.ts` now owns the transient control/default/status
  contracts, target-drop option derivation and exact range/probability
  formatting without React, DOM, Worker, persistence or broad simulation
  imports.
- `src/app/controllers/use-risk-analysis.ts` owns the three Risk state cells,
  active-task ref, exact source-reference freshness, explicit Run/Cancel,
  source-change and unmount cancellation, latest-task settlement guard, stale
  result retention and fixed global status messages. It deliberately has no
  active-tab input, so a user-started run continues across tab changes.
- `src/app/components/panes/risk-pane.tsx` owns the complete 239-line landmark,
  controls, result cards, coverage and warning presentation behind explicit
  model/action props. It does not import the controller or start calculations.
- `App.tsx` is 5,608 lines with 46 React state cells. It supplies live
  form/context/cannon/loot sources and global status, and its four existing
  cross-surface consumers now read only the controller's fresh snapshot.
- The architecture gate passes at 100 source modules / 88 client-reachable
  modules / seven external entrypoints, with no cycle or exception. The focused
  Risk/domain/request/Trip/UI gate passes 161/161, numeric audit 5,958/5,958
  comparisons, goldens 19/19 and the complete production-preview Chromium gate
  77/77, including the existing focused Risk workflow.
- Full `npm run verify` passes 54 files / 719 tests and all repository gates.
  The 10-file/two-asset artifact totals 1,964,103 bytes with SHA-256
  `922eb19e75689664c2d4e6da9e34d4641b575ce09bbaf2edfb195eb8a77a21c2`;
  entry JavaScript remains inside D-094 at 708,379 raw / 205,746 gzip bytes.
  The read-only Darwin visual comparison passes 20/20 against the unchanged 31
  PNGs after the sandbox-blocked port 5174 start was rerun with approved
  localhost permission.
- No domain, calculation-task, Worker implementation, persistence, schema,
  adapter, server, generated-data, stylesheet, copy or visual-baseline file
  changed in this phase.

## Open questions

- After Risk, should D-093 continue with Loot/Trip ownership or
  Economy/Settings? Decide from dependency mapping and focused browser coverage.
- Should a failed rerun make a previous source-matching result visibly stale?
  Current behavior keeps it visible with `Unavailable`; this phase does not
  change that product contract.
- Should Risk gain a dedicated desktop/mobile visual baseline? The current
  functional and semantic coverage is authoritative until a separate visual-
  scope decision accepts new baseline ownership.
- Should repeated Risk runs later share an initialized Worker/context cache?
  Measure startup and structured-clone cost before specifying that change.

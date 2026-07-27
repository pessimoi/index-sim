# Duel matrix failure-state specification

- Status: implemented
- Date: 2026-07-19
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

Give the all-monster setup comparison an explicit visible lifecycle so a failed
calculation cannot masquerade as ordinary stale inputs. Preserve the latest
successful matrix as clearly labelled previous output while current inputs are
stale, rebuilding or failed, and give the user a direct retry action.

## Verified prior behavior and problem

- `src/app/controllers/use-duel-pane.ts` keeps a successful matrix together
  with its exact source references and exposes it only while those references
  remain fresh.
- When form, saved setups, context, cannon, loot preferences or loot settings
  change, the pane receives `matrix = null` and correctly requires an explicit
  rebuild.
- A non-cancellation worker rejection also sets `matrixBuild` to `null`. The
  only error evidence is the app's general status callback with
  `Setup comparison across monsters could not be built`.
- `src/app/App.tsx` renders that general status only in a visually hidden live
  region.
- `src/app/components/panes/duel-pane.tsx` renders every non-busy null matrix as
  `Comparison inputs changed`, whether the user has never built it, sources are
  stale or the latest build actually failed.
- A failed refresh also discards a previously successful matrix from the pane,
  even though that result could still be useful if labelled as previous.

## Feature-inventory boundary

Setup comparison remains an existing `Valmis` workflow. This goal changes only
its session calculation lifecycle and presentation. Saved setup persistence,
file transfer, comparison formulas, best markers and explicit all-monster build
remain unchanged.

## Goals

- Represent never-built, building, current, stale and failed states
  independently.
- Show a sanitized visible error and Retry after a current-source failure.
- Retain the latest successful matrix as previous output whenever it is safe to
  display with an explicit stale/rebuilding/failed label.
- Never present a previous matrix as matching current inputs.
- Ignore cancellations and superseded tasks without a failure notice.
- Keep task identity and source-reference freshness race-safe.

## Non-goals

- Do not change any combat, Trip, XP, GP, GP/XP, best-marker, row, filter or
  sorting calculation.
- Do not change the `duel-matrix` Worker request/result shape or introduce a
  persistent Worker.
- Do not auto-retry, add exponential backoff or send failure telemetry.
- Do not persist matrix output, lifecycle, errors, filters or timestamps.
- Do not expose raw worker errors, stack traces, source payloads or field ids.
- Do not make the current-target saved setup comparison depend on the matrix.
- Do not change saved setup import/export, limit, compatibility or recovery.
- Do not add a general app-wide error framework.

## Lifecycle model

Add one explicit controller-owned union:

```ts
export type DuelMatrixStatus = "idle" | "building" | "ready" | "stale" | "failed";

export interface DuelMatrixPresentation {
  status: DuelMatrixStatus;
  displayModel: DuelMatrixViewModel | null;
  displayIsCurrent: boolean;
  message: string;
  canBuild: boolean;
  buildActionLabel: "Build comparison" | "Refresh comparison" | "Retry comparison" | "Building…";
}
```

The exact names may vary. The pane receives one lifecycle model instead of
inferring status from `duelMatrix` plus `duelMatrixBusy`.

The controller retains three distinct session concepts:

```ts
interface DuelMatrixBuild {
  model: DuelMatrixViewModel;
  source: DuelMatrixSource;
}

interface DuelMatrixFailure {
  source: DuelMatrixSource;
  message: "Comparison could not be built. Your inputs are unchanged.";
}

interface DuelMatrixPending {
  task: RunningCalculationTask<DuelMatrixCalculationRequest>;
  source: DuelMatrixSource;
}
```

`lastSuccessfulBuild` is not cleared by starting a refresh or by a failed
refresh. Failure stores only fixed sanitized copy and the attempted source.
The raw caught value is used solely to identify
`CalculationTaskCancelledError` and is never retained or rendered.

## Status derivation

Derive status from structured state in this exact precedence:

1. `building`: a pending task targets the current source;
2. `failed`: the latest non-cancelled failure targets the current source;
3. `ready`: the last successful build matches the current source;
4. `stale`: a successful build exists but does not match the current source;
5. `idle`: no successful build, current failure or current task exists.

Reference equality across all existing source members remains the freshness
contract:

- live `form`;
- `snapshots`;
- `context`;
- `cannonByMonster`;
- `lootPrefsByMonster`; and
- `lootSettingsByMonster`.

Do not replace this with JSON serialization, deep equality or a partial
fingerprint. Existing immutable update paths make the reference bundle the
cheap and complete source token.

The display model is:

| Status     | Display model                                        | Meaning                                                        |
| ---------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `idle`     | `null`                                               | No comparison has completed in this session.                   |
| `building` | last successful model when present, otherwise `null` | Previous output may remain visible while a current build runs. |
| `ready`    | matching successful model                            | Table matches all current source references.                   |
| `stale`    | last successful model                                | Table is previous output and must not be described as current. |
| `failed`   | last successful model when present, otherwise `null` | Current build failed; any table is previous output.            |

Filtering, sorting and metric selection may continue to operate on a previous
display model because they are presentation-only. They must not change
`displayIsCurrent` or clear the failure/stale label.

## State transitions

### First build

- Selecting `All monsters` with saved setups and no prior build starts one
  build and enters `building`.
- A second Build/Refresh action is disabled while a current-source task runs.
- Success stores the model/source, clears a current failure and enters `ready`.
- A non-cancelled failure stores fixed failure/source and enters `failed` with
  no table.

### Source change

- A source change never mutates the last successful model.
- A ready model becomes `stale` immediately and stays visible with previous-
  output copy.
- A failure for an old source no longer has `failed` precedence. With a prior
  model the new state is `stale`; without one it is `idle`.
- If a task is still running for an old source, cancel it and clear the pending
  reference. Cancellation is silent. This prevents an obsolete expensive task
  from blocking a build for the current source.
- Do not automatically start another task merely because an input changed.

### Refresh and retry

- `Refresh comparison` and `Retry comparison` always capture the latest source
  as one immutable request bundle.
- Starting clears only a failure for that same source and enters `building`.
- If a previous model exists, keep it visible with rebuilding copy.
- Task success is accepted only if the task identity is still current. Store
  its own captured source even if a source changed just before promise
  settlement; normal freshness derivation will then classify it as stale.
- A late success/failure from a replaced or cancelled task is ignored.
- Non-cancelled failure never clears the previous successful build.

### No saved setups and teardown

- When the saved snapshot count becomes zero, force `current-target` view,
  cancel a pending matrix task and clear matrix success/failure session state.
  A live-only all-monster matrix is outside the existing user workflow.
- Unmount cancels the pending task and retains nothing.
- Merely switching to another workbench pane may let a current-source task
  finish under existing behavior; it must still observe task identity on
  return. If implementation evidence favors cancelling inactive work, record
  and test that as a separate bounded optimization rather than changing it
  incidentally.

## Visible presentation contract

Replace the status pill's inferred `ready/pending` copy with the lifecycle:

| Status                     | Pill                        | Main message                                                      | Action               |
| -------------------------- | --------------------------- | ----------------------------------------------------------------- | -------------------- |
| `idle`                     | `not built`                 | `Build the all-monster comparison for the current inputs.`        | `Build comparison`   |
| `building`, no prior model | `building`                  | `Building comparison for current inputs.`                         | disabled `Building…` |
| `building`, prior model    | `building`                  | `Building current comparison. Showing the previous result.`       | disabled `Building…` |
| `ready`                    | `<M> monsters · <S> setups` | no extra state block                                              | `Refresh comparison` |
| `stale`                    | `previous result`           | `Inputs changed. This table does not include the current inputs.` | `Refresh comparison` |
| `failed`, no prior model   | `build failed`              | `Comparison could not be built. Your inputs are unchanged.`       | `Retry comparison`   |
| `failed`, prior model      | `build failed`              | `Comparison could not be built. Showing the previous result.`     | `Retry comparison`   |

Use a middle dot or existing punctuation consistently; do not encode status
only through pill color.

When a previous table is visible:

- wrap it in a container labelled `Previous all-monster setup comparison` or
  associate the lifecycle message with the table using `aria-describedby`;
- keep its setup names, values and source-era current-target marker exactly as
  calculated;
- do not relabel an old row as the new current target; and
- do not show current best markers outside the stored matrix.

The failure block is visible in the matrix panel and uses `role="alert"` only
when a current-source task transitions to failed. Rerendering from filter,
metric or sort changes must not recreate/re-announce it. Stale and building
messages use `role="status"` or ordinary text with polite transition handling.

The global `onStatus` callback remains supplementary:

- build: `Building setup comparison across monsters`;
- success: the existing ready count;
- failure: `Setup comparison across monsters could not be built`.

Visible pane state is authoritative; assistive users must not have to depend on
the app's visually hidden global status.

## Controller and pane contracts

`DuelPaneController` replaces `matrix`, `matrixBusy` and separately inferred
empty state with:

```ts
matrixPresentation: DuelMatrixPresentation;
filteredMatrixRows: DuelMatrixRowViewModel[];
```

`filteredMatrixRows` is derived from `displayModel`. Existing matrix metric,
filter and sort state remains session-only and unchanged.

`DuelPaneModel` receives the same presentation object. The pure pane does not
inspect tasks, source bundles or raw errors and does not recreate lifecycle
precedence.

Add a pure `deriveDuelMatrixPresentation()` helper for exhaustive unit tests.
Keep freshness comparison separately testable with
`isDuelMatrixBuildFresh()` or a generalized same-source helper.

## Failure and privacy contract

- Only `CalculationTaskCancelledError` is cancellation. It creates no error,
  alert or failure status.
- Every other rejection maps to the fixed message in this specification.
- Do not render or log `error.message`, worker event text, stack traces,
  request content, setup values, monster ids or local paths.
- Failure does not mutate form, snapshots, prices, cannon, loot state or
  persistence.
- Retry uses the same worker boundary and current validated app state; it does
  not repair or simplify inputs silently.

## Accessibility and responsive behavior

- Lifecycle message and action are inside the labelled matrix panel.
- The current failure transition is announced once and remains visible until
  Retry, source change, success or leaving the matrix session.
- A Retry button is a native button and receives focus normally; failure does
  not steal focus.
- Disabled building copy remains readable and does not rely on a spinner.
- Previous-result messaging precedes the horizontally scrollable table in DOM
  and reading order.
- Narrow screens wrap lifecycle copy/actions without widening the document;
  existing matrix-table horizontal overflow remains contained.

## Implementation sequence

1. Add pure lifecycle-derivation tests for every status and display-model
   combination.
2. Refactor the controller to retain last success, source-scoped failure and a
   source-scoped pending task.
3. Cancel obsolete-source tasks without surfacing cancellation as failure.
4. Replace the pane's null/busy inference with the presentation union and
   render visible stale/failure/retry states.
5. Add browser failure injection and previous-result evidence.
6. Run complete Duel/worker regression before removing the old generic empty
   copy.

Likely implementation files:

- `src/app/controllers/use-duel-pane.ts`;
- `src/app/components/panes/duel-pane.tsx`;
- `src/app/App.tsx` only for model prop mapping;
- `src/app/styles.css`;
- `src/tests/compare-duel-controllers.test.ts`;
- `src/tests/compare-duel-panes.test.ts`; and
- `src/tests/e2e/planner-duel.spec.ts` or a focused Duel lifecycle spec.

## Required tests and validation

Tests must prove:

- initial All monsters action enters building and blocks duplicate requests;
- current-source success enters ready and uses the existing matrix unchanged;
- source change enters stale without automatic rebuild and keeps the previous
  table visibly labelled;
- non-cancelled first-build failure shows the fixed visible error and Retry;
- failed refresh retains and labels the previous table;
- Retry captures current sources and success replaces the previous model;
- cancellation, unmount and superseded task settlement never show failure;
- a source change cancels obsolete work and allows a current build;
- filter/metric/sort changes do not clear or re-announce lifecycle state;
- zero saved setups cancels and clears matrix session state; and
- raw thrown error text never reaches markup, status copy or stored state.

Run at minimum:

```sh
npm run test -- src/tests/compare-duel-controllers.test.ts src/tests/compare-duel-panes.test.ts src/tests/calculation-task.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "setup comparison|All monsters|matrix failure"
npm run test:golden
npm run build
git diff --check
```

Run the full functional browser suite because this changes a shared Worker
lifecycle and saved setup actions can invalidate its source. Numeric goldens
must remain unchanged; visual comparison is required only if a captured Duel
matrix state includes the changed lifecycle strip.

## Acceptance criteria

- A current-source calculation failure is always visibly distinguishable from
  stale inputs and a never-built matrix.
- Failure provides Retry and never exposes raw technical detail.
- The latest successful matrix survives stale, rebuilding and failed refresh
  states and is always labelled as previous when not fresh.
- Only a source-matching successful build is labelled current.
- Cancellation and late superseded settlements are silent and race-safe.
- No matrix state enters persistence or changes comparison calculations.
- Focused, architecture, type, golden, build, full browser and diff gates pass.

## Implementation evidence

- `src/app/controllers/use-duel-pane.ts` now retains the last successful build,
  a source-scoped sanitized failure and the current task separately. Its pure
  presentation derivation applies the specified precedence across all six
  strict source references; source changes cancel obsolete work, clear an old
  failure and never start a replacement automatically.
- `src/app/components/panes/duel-pane.tsx` consumes that single presentation
  object. It renders visible idle/building/stale/failure copy, a native
  Build/Refresh/Retry action and a `Previous all-monster setup comparison`
  label whenever the retained table is not current.
- First-build and refresh failures retain no raw error. Cancellation, stale task
  settlement, unmount and removal of the final saved setup remain silent and
  task-identity guarded.
- Focused controller, pane and calculation-task coverage passes 17/17. The two
  production-preview Chromium paths cover the existing ready/filter/sort flow
  plus injected first-build and refresh failures, Retry, retained previous
  output, raw-detail exclusion and 390 px containment. Full release-gate
  evidence is intentionally consolidated in the queue's final validation goal.

## Open questions

None block implementation. Cancellation on ordinary workbench-tab deactivation
remains an optional measured optimization; this goal requires cancellation only
for unmount, zero snapshots and obsolete source work.

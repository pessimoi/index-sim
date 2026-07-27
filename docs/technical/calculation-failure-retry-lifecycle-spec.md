# Calculation failure and Retry lifecycle specification

- Status: implemented
- Date: 2026-07-19
- Owner: technical documentation
- Evidence: verified
- Contract: living

## Purpose

Give Dense Compare, Planner and Risk the same explicit visible calculation
lifecycle as the implemented Duel matrix. A Worker failure must not discard the
latest successful result, appear as ordinary stale input or leave the user
without a direct recovery action.

## Feature-inventory boundary

Dense spreadsheet, Planner and Risk remain `Valmis`. This contract hardens their
session-only calculation state. It does not add a feature, change a formula or
reopen the Duel matrix work.

## Verified prior gaps

- Dense Compare stored a failed build as an empty row list and exposed only
  `Unavailable`; it had no visible fixed error or Retry action.
- Planner exposed only a build whose source exactly matched the current
  computed source, so a failed automatic refresh removed the previous plan.
- Risk retained a previous build, but a same-source failed refresh still left
  that build eligible as fresh output for the compact Trip/Result bridges.
- Dense and Planner effect cleanup cancelled old work, but their settlement
  handlers did not independently prove that the settling task still owned the
  active task slot.

## Shared lifecycle vocabulary

The three controllers use the shared type in
`src/app/controllers/calculation-lifecycle.ts`:

```ts
type CalculationLifecycleStatus = "idle" | "building" | "ready" | "stale" | "failed";
```

Every controller retains distinct session concepts for the latest successful
build, a source-scoped fixed failure and the current pending task/source. Status
precedence is:

1. `building` when a task for the current source is active;
2. `failed` when the latest non-cancelled failure targets the current source;
3. `ready` when the latest successful build matches the current source;
4. `stale` when a successful build exists but does not match current inputs;
5. `idle` when no applicable task, failure or successful build exists.

Planner draft edits that have not crossed explicit `Recompute` also make its
last plan `stale`. Dense's 250 ms form debounce may briefly expose `stale`
before its replacement Worker starts and changes the state to `building`.

## Retention and presentation

- Starting a refresh never clears the latest successful result.
- A failed refresh never clears it and never presents it as current.
- Building, stale and failed panes use fixed visible copy that says when a
  previous result is shown.
- First-run failure shows the same sanitized category without an empty result
  being mistaken for a valid calculation.
- Dense exposes `Retry comparison`, Planner exposes `Retry plan` and Risk
  exposes `Retry analysis` only after a current-source failure.
- Raw caught errors, stacks, paths, request data and source identifiers are not
  stored or rendered.
- Only a `ready` Risk build reaches the fresh-result bridges consumed outside
  the Risk pane.

The retained result keeps its captured presentation context. In particular,
Planner uses the retained plan's metric while a different recomputation is
building or failed, and Risk uses the retained controls beside retained values.

## Feature-specific trigger rules

The status vocabulary is shared; task triggering is not generalized:

- Dense remains active-tab-only and automatic after its 250 ms form debounce.
- Planner remains active-tab-only, keeps draft edits explicit behind
  `Recompute`, and automatically refreshes accepted computed state after live
  form/context/loot-source changes.
- Risk remains explicitly user-triggered through Run/Retry and continues across
  tab changes.

Explicit Risk cancellation returns to the lifecycle implied by retained state:
`ready`, `stale` or `idle`. Cancellation is not a calculation failure and does
not create a sixth visible lifecycle state.

## Race and cancellation contract

- Each pending slot stores both task object identity and the exact captured
  source-reference bundle.
- Source replacement cancels obsolete Dense, Planner and Risk work.
- Before passive task effects can settle, the controllers update the current
  source (and Dense/Planner active-tab eligibility) in the layout phase.
- Only a task that still owns the pending slot and whose captured source still
  matches that current bundle may store success, failure or clear the slot.
- Late success, failure or `finally` settlement from a cancelled or replaced
  task is ignored.
- `CalculationTaskCancelledError` is silent and never becomes `failed`.
- Unmount and the existing tab-deactivation rules still terminate work through
  the one-shot Worker's current `cancel()` boundary.

Source freshness continues to use the existing exact reference members. No
serialization, deep equality, fingerprint, Worker protocol id or persistent
Worker is introduced.

## Non-goals

- No combat, Trip, XP, GP, Planner, risk, filtering or sorting formula change.
- No calculation request/result or one-shot Worker protocol change.
- No automatic retry, backoff, telemetry, progress or partial results.
- No lifecycle, result, failure or Retry persistence.
- No general app-wide error framework or new server/runtime state.
- No setup, Planner, Duel, PriceSet, share or migration schema change.

## Tests and acceptance evidence

Focused controller tests prove all five states, exact source identity, first and
refresh failures, previous-result retention, fixed-copy privacy, Retry,
superseded-task cancellation and separate late-success plus late-failure/
`finally` rejection. Pane tests prove visible alerts, explicit Retry actions and
labelled previous output.

`src/tests/e2e/calculation-lifecycle.spec.ts` injects sanitized Worker failures
for all three task kinds and covers both first calculation and refresh failure
in one production-preview Chromium workflow. It verifies recovery to `ready`,
retained previous Dense rows, Planner output and Risk results, and absence of
raw Worker details.

Run the focused gate with:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/compare-duel-controllers.test.ts src/tests/compare-duel-panes.test.ts src/tests/planner-controller.test.ts src/tests/planner-pane.test.ts src/tests/risk-controller.test.ts src/tests/risk-pane.test.ts src/tests/calculation-task.test.ts
npm run test:e2e -- --workers=1 src/tests/e2e/calculation-lifecycle.spec.ts
npm run test:golden
npm run build
git diff --check
```

# Calculation Worker retention and persistent-trigger specification

- Status: implemented
- Date: 2026-07-14
- Owner: technical documentation
- Evidence: verified
- Contract: living

## Purpose

This specification turns D-095 and the completed Worker measurement into an
implementation-grade maintenance contract for the production calculation
boundary. The accepted implementation is to retain the current cancellable
one-shot module Worker for Dense Compare, Planner, Duel matrix and Risk.

The measurements and harness remain owned by
[calculation-worker-measurement-spec.md](calculation-worker-measurement-spec.md).
This document owns the production protocol and lifecycle invariants, the
evidence required to reopen persistence, and the minimum safe target shape if a
later trigger is met. It does not authorize a persistent Worker from payload
size or workstation timing alone.

The later [calculation failure and Retry lifecycle](calculation-failure-retry-lifecycle-spec.md)
owns current Dense/Planner/Risk presentation, previous-result retention and
task-identity settlement behavior. The one-shot protocol and feature-specific
trigger rules retained here are unchanged.

## Verified source inventory

Source and reference inspection on 2026-07-14 records:

- `calculation-task.ts` is a 187-line typed request/result dispatcher;
- `calculation-worker-client.ts` is a 229-line one-shot and measurement client;
- `calculation-worker.ts` is a 17-line production module-Worker entry;
- the four focused controller owners total 761 lines;
- production controllers import only `startCalculationTask()` and never invoke
  `startMeasuredCalculationTask()`; and
- the five direct task/controller/performance suites pass 22/22.

The Worker source has not changed since the D-095 measurement implementation.
No defect, stale-result leak, cycle, architecture exception or controller
isolation failure was found in this retention review.

## Current production protocol

`CalculationRequest` is a discriminated union with four raw request kinds:

| Kind            | Calculation owner                          | Result contract          |
| --------------- | ------------------------------------------ | ------------------------ |
| `dense-compare` | `createDenseCompareRows()`                 | Dense row view models    |
| `planner`       | Planner view-model and panel builders      | Planner panel view model |
| `duel-matrix`   | `createDuelMatrixViewModel()`              | Duel matrix view model   |
| `risk-analysis` | `analyzeRisk()` over the full input mapper | `RiskAnalysisResult`     |

Every raw request includes its complete `SimulationContext`. The Worker runs
the matching pure calculation and returns exactly one of:

```ts
{ ok: true, kind, result }
{ ok: false, kind, error: "calculation_failed" }
```

The client accepts only a successful response whose `kind` matches the request.
Worker construction, posting, execution and protocol failures are exposed only
as the fixed `CalculationTaskError`; private error text and stacks do not cross
the boundary.

The raw protocol intentionally has no request id or context id. That is safe
only because one Worker receives one request and is terminated at the first
settlement. `kind` matching is not sufficient for a multi-request Worker and
must not be reused as the sole freshness guard in a persistent design.

The explicit measurement envelope is a harness-only extension over the same
executor. It does not replace or wrap production controller requests.

## One-shot client lifecycle

`startCalculationTask()` owns one Worker and one promise:

```text
construct -> post one full request -> receive one result -> terminate
     |              |                     |
     |              +-> clone error ------+
     +-> error / timeout / cancel --------+
```

The accepted lifecycle invariants are:

- the default Worker is a module Worker created from
  `./calculation-worker.ts`;
- timeout starts in the client lifecycle and remains 30 seconds by default;
- an invalid custom timeout falls back to that same default;
- success, invalid/mismatched response, Worker error, post/clone failure,
  timeout and explicit cancel all terminate the Worker once;
- cancel rejects with `CalculationTaskCancelledError`; other failure paths use
  the sanitized `CalculationTaskError`; and
- settlement is idempotent, so later events cannot replace the first result.

Termination is also the current hard-cancellation mechanism. The calculation
functions are synchronous. A `cancel` message sent to a busy persistent Worker
would wait behind that calculation in the Worker's event loop and therefore
would not preserve current cancellation semantics.

## Controller freshness and cancellation

The client owns task settlement. Each feature controller separately owns when
to start work and whether a completed build still matches live source
references.

### Dense Compare

- Work starts only while the Compare tab is active and context exists.
- Form changes are debounced for 250 ms; other source-reference changes are
  immediate.
- Effect cleanup cancels the old task on source replacement, tab deactivation
  and unmount.
- A build is current only when form, context, cannon, loot preferences, custom
  setups and loot settings are the exact captured references.
- The latest successful rows remain displayable as labelled previous output
  while stale, rebuilding or failed. Non-cancelled failure is fixed-copy
  `failed` with explicit Retry.
- Task identity rejects late settlement after exact-source cancellation,
  deactivation or replacement.

### Planner

- Work starts only while the Planner tab is active and context exists.
- Draft edits do not calculate until explicit `Recompute`; after that snapshot
  is accepted, form/context/loot-source changes refresh automatically.
- Effect cleanup cancels the old task on computed-source replacement, tab
  deactivation and unmount.
- A matching panel is `ready`; draft-dirty or source-mismatched retained output
  is `stale`. Building and failed refreshes retain that previous panel.
- Fixed failure copy and Retry remain controller-owned, and task identity
  rejects late settlement after exact-source cancellation or replacement.

### Duel matrix

- Matrix work starts only from explicit intent, never merely from render or tab
  activation.
- A busy guard prevents parallel matrix starts. A fresh matrix is reused.
- Source changes retain the matrix as labelled previous output and require
  another explicit build; they do not silently recompute it.
- An in-flight task for an obsolete source is cancelled. Unmount hard-cancels
  the task.
- Task-object identity prevents an obsolete settlement from mutating the active
  task slot; failure copy remains sanitized.

### Risk

- Work starts only from explicit `Run`; controls are transient.
- A replacement Run first cancels the active task. Exact source-reference
  change also cancels it without a duplicate global status announcement.
- Explicit Cancel and unmount hard-cancel active work. Cancel returns visible
  state to the retained build's `ready`/`stale` status or to `idle`.
- Task-object identity makes latest settlement win. A previous build may remain
  visible as stale, but only an exact current-source build is exposed through
  the `fresh` bridge to other panes.
- Failure retains any previous build as labelled previous output, removes it
  from the `fresh` bridge and exposes only fixed `failed` copy plus Retry.

These four policies are intentionally not normalized into one generic
controller. Dense, Planner and Risk share only the five-state vocabulary; their
automatic, explicit, stale-display and tab-lifecycle rules differ.

## Accepted measurement evidence

The D-095 harness ran five cold/warm pairs for typical and heavy profiles of all
four task kinds through the actual production Worker entry. Warm medians were:

| Case            | Total ms | Execution ms | Non-execution ms | Non-execution share |
| --------------- | -------: | -----------: | ---------------: | ------------------: |
| Dense typical   |    140.8 |        103.8 |             37.0 |               25.2% |
| Dense heavy     |    137.7 |        102.8 |             34.4 |               25.2% |
| Planner typical |    961.2 |        923.5 |             35.0 |                3.8% |
| Planner heavy   | 13,065.2 |     13,016.5 |             57.1 |                0.4% |
| Duel typical    |    244.0 |        209.4 |             35.1 |               14.9% |
| Duel heavy      |  1,394.5 |      1,351.1 |             48.3 |                3.4% |
| Risk typical    |  1,564.1 |      1,517.7 |             58.7 |                3.7% |
| Risk heavy      |  6,641.0 |      6,581.4 |             53.9 |                0.8% |

The JSON-shaped requests were 0.90-1.09 MB. Warm synchronous Worker creation
was 0.1-0.2 ms, full-request posting 1.6-2.3 ms, startup/request delivery
31.8-56.7 ms and response delivery 0.1-0.9 ms. These are local comparison
measurements, not a universal latency SLA.

The data supports retention: execution dominates Planner, Risk and heavy Duel;
Dense's larger relative overhead still leaves a 137.7-140.8 ms median total and
does not establish a user-visible regression. Payload size alone is not an
activation signal.

## Persistent-Worker reopen triggers

A future persistent candidate may be specified only from a recorded evidence
package. Any one of the following can reopen design work; none authorizes a
production implementation without the comparison and safety gates below.

1. **Accepted-budget breach on a supported device.** A user-visible
   task-to-current-result budget is declared before measurement, and at least
   five paired warm samples show one-shot p90 above that budget while avoidable
   startup/transfer is both at least 50 ms and at least 20% of p90 total. A
   persistent prototype must bring p90 inside the declared budget.
2. **Repeated same-context demand.** A production trace or deterministic
   accepted workflow demonstrates at least three eligible tasks within ten
   seconds before `SimulationContext` replacement, with at least 100 ms of
   cumulative one-shot startup/transfer and a visible pending-state or
   interaction regression. The trace must identify the feature and source
   replacement pattern rather than extrapolate from request size.
3. **Main-thread clone regression.** Browser tracing on a supported device
   attributes a repeatable at-least-50 ms main-thread task to full-request
   `postMessage` cloning, and a context-initialized prototype removes it without
   moving equivalent blocking work to context hashing or serialization.
4. **Production resource evidence.** A reproducible browser or production
   profile attributes an accepted memory/GC, Worker-start failure or energy
   budget breach to repeated full-context workers, and a bounded persistent
   topology measurably closes that breach.

The 50 ms/20% and repeated-task thresholds are screening triggers for a new
specification, not new product SLAs. A complaint, a single sample, generated
snapshot growth, bundle advisory, line count or speculative future workload is
insufficient.

## Minimum safe target if reopened

The first acceptable candidate retains the public
`RunningCalculationTask<T>` promise/cancel contract and keeps feature
controllers as freshness owners. Its wire protocol must be versioned and have
three explicit concepts:

```text
initialize { protocolVersion, contextId, context }
run        { protocolVersion, contextId, requestId, kind, taskWithoutContext }
result     { protocolVersion, contextId, requestId, kind, ok, result | error }
```

Required behavior:

- `contextId` is an opaque client-owned epoch for an exact immutable context
  reference. Do not synchronously stringify/hash the roughly 1 MB context on
  every task.
- No task is posted before the matching initialization acknowledgement.
- Every response must match protocol version, Worker generation, context id,
  request id and kind before its result is accepted.
- One feature-local runner has at most one active request. A global singleton
  is not the default because today's four mounted controllers may have
  overlapping work and independent cancellation.
- Context replacement creates a new epoch and initializes a new Worker
  generation before new work. Old-generation events are ignored.
- Active cancellation, timeout, Worker error, protocol mismatch and context
  replacement that must cancel current work terminate the Worker. A fresh
  generation is initialized lazily for the next task. A queued `cancel` message
  alone cannot claim hard cancellation.
- The 30-second task timeout and sanitized error classes remain externally
  unchanged unless a separate product decision changes them.
- Controller source-reference checks remain in addition to protocol ids. Wire
  identity does not decide whether a build is current for UI purposes.
- Idle lifetime, number of feature-local workers and memory ceiling must be
  selected from the activating evidence. Keeping four full contexts alive is
  not accepted without measurement.

A cooperative algorithm rewrite, shared scheduler, multi-worker pool,
`SharedWorker`, `SharedArrayBuffer` or shared mutable context is outside this
target. Any of those requires its own calculation/concurrency specification.

## Persistent candidate comparison gate

Before replacing one-shot production behavior, the triggered implementation
must provide:

- the existing one-shot baseline and candidate measurements on the same browser,
  device class, cases and explicit run count;
- first-initialization, same-context repeat, context-replacement, cancellation
  recovery and idle-memory measurements;
- typical/heavy Dense, Planner, Duel and Risk results identical to the current
  executor outputs;
- protocol tests for initialization ordering, ids, wrong-generation rejection,
  replacement, clone failure, Worker failure, timeout and hard cancel;
- unchanged controller tests for Dense debounce/cancellation, Planner
  Recompute, Duel explicit stale rebuild and Risk latest/fresh behavior;
- an overlap test proving one feature's work or cancel cannot settle, starve or
  terminate another feature's task; and
- production artifact and architecture evidence showing that measurement-only
  code is not activated by controllers.

If the candidate does not meet the activating budget or materially increases
idle memory, cancellation recovery, request scheduling or failure complexity,
retain one-shot workers and record the failed comparison.

## Non-goals of this implementation

- No persistent Worker, context cache, request-id protocol or pool.
- No change to calculation formulas, request/result shapes or
  `SimulationContext`.
- No controller lifecycle normalization or UI copy/status change.
- No production telemetry or universal wall-clock SLA.
- No rerun of the expensive workstation measurement while its source and
  accepted environment remain unchanged.
- No browser or visual run for this documentation-only retention closure.

## Guard policy

Current executable guards are sufficient for the retained boundary:

- `calculation-task.test.ts` owns all four structured results plus raw,
  measurement, success, mismatch, clone-failure, cancel and timeout behavior;
- `compare-duel-controllers.test.ts`, `planner-controller.test.ts` and
  `risk-controller.test.ts` own the four feature lifecycles;
- `ui-performance.test.ts` keeps the deferred-work and maximum Duel smoke
  boundaries visible;
- `architecture:check` owns the module Worker entrypoint, reachability, layers
  and cycles;
- numeric audit and goldens own cross-path calculation behavior; and
- full verification owns typecheck, build/artifact, lint, format and diff
  checks.

A source-text assertion for line counts or a fake request id on the one-shot
protocol would freeze implementation detail without improving correctness and
is not added.

## Implementation

The accepted D-095 implementation is explicit retention:

- production Worker, task client, request/result and controller source remain
  unchanged;
- this contract is linked from architecture, testing, backlog, audit and the
  measurement specification; and
- a future persistence proposal must cite one numbered trigger, attach the
  comparison package and preserve the minimum safe target above.

## Acceptance checks

```sh
npm run test -- src/tests/calculation-task.test.ts src/tests/compare-duel-controllers.test.ts src/tests/planner-controller.test.ts src/tests/risk-controller.test.ts src/tests/ui-performance.test.ts
npm run architecture:check
npm run typecheck
npm run numeric:audit
npm run test:golden
npm run verify
git diff --check
```

`npm run worker:measure -- --runs 5` is required only when Worker/client
production behavior, the harness, accepted profiles, target environment or a
reopen trigger changes. Repeating the unchanged expensive local capture would
not add independent evidence to this retention goal.

## Implementation evidence

- Source inspection confirms the raw four-kind protocol, one-request Worker,
  30-second default timeout, termination on every settlement and sanitized
  cancel/failure types.
- Controller inspection confirms Dense debounce and source cleanup, Planner
  explicit-Recompute plus automatic current-source refresh, Duel intent/busy/
  stale-rebuild behavior and Risk explicit latest/fresh/cancel behavior.
- Production controller imports contain no measurement starter or measurement
  envelope use.
- The direct task/controller/performance gate passes 5 files / 22 tests, and
  architecture passes at 121 source / 109 client-reachable modules with seven
  external entrypoints, no cycles and no exceptions.
- The D-095 five-pair timings remain the applicable Worker-overhead evidence;
  no new workstation timing is claimed.
- Typecheck, numeric audit 5,958/5,958 and all 19 goldens pass.
- Full `npm run verify` passes 71 test files / 770 tests plus 19 explicit
  goldens, architecture 121/109, typecheck, build/artifact, lint, formatting and
  diff gates.
- The unchanged production artifact has 10 files / two assets / 1,977,466
  bytes; entry JavaScript remains inside D-094 at 720,528 raw / 208,747 gzip
  bytes and SHA-256 is
  `057c148f8b029a61bb0ef967418ca11c2403529765ccb93463a8f39745fc8720`.
- No browser or visual run is claimed because production source, Worker
  behavior, markup, copy and styling are unchanged.

## Open questions

- None for one-shot retention. Worker topology, idle lifetime and memory ceiling
  intentionally remain trigger-specific because selecting them now would be
  speculative architecture.

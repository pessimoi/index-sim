# Calculation worker startup and transfer measurement specification

Status: implemented on 2026-07-14 under D-095.

## Objective

Measure the current one-shot calculation worker before deciding whether a
persistent initialized worker is justified. The repository-owned measurement
must use the production `src/app/calculation-worker.ts` entry and the same
Dense Compare, Planner, Duel matrix and Risk request/result implementations as
the app.

This goal produces workstation evidence and a follow-up decision boundary. It
does not introduce a persistent worker, worker pool, shared mutable context,
production telemetry or a wall-clock merge budget.

## Current boundary

- Each heavy calculation creates a module Worker, posts one complete
  `CalculationRequest`, receives one structured result and terminates.
- Every request includes the complete `SimulationContext`; the generated game
  data source is about 1.07 MB before the surrounding request is serialized.
- The existing production path is bounded by a 30-second timeout and explicit
  cancellation. Controllers own freshness and latest-result behavior.
- Existing CPU smoke tests measure selected pure calculation work. The startup
  command measures application navigation and bundle loading. Neither separates
  worker construction, request posting, worker startup, execution and response
  delivery.

## Timing contract

The measurement-only request envelope records absolute monotonic timestamps
using `performance.timeOrigin + performance.now()` on the window and Worker.
The normal raw request and response shapes remain unchanged.

For each sample report:

| Field                         | Meaning                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `workerCreateMs`              | synchronous `new Worker(...)` constructor time                                                                    |
| `requestPostMs`               | synchronous sender-side `postMessage` clone/enqueue time                                                          |
| `startupAndRequestDeliveryMs` | end of sender posting to the Worker's message receipt; includes module startup, remaining transfer and scheduling |
| `workerQueueMs`               | Worker receipt to calculation start                                                                               |
| `executionMs`                 | production `executeCalculationTask` duration inside the Worker                                                    |
| `responseDeliveryMs`          | calculation finish to main-thread message receipt; includes response cloning, delivery and scheduling             |
| `totalMs`                     | worker construction start to main-thread result receipt                                                           |

The command must also report JSON UTF-8 request and result sizes. These are
portable payload-size evidence, not an exact browser structured-clone byte
count. Phase names must not claim more precision than the timestamps support.

## Profiles

Measure all eight cases:

| Task          | Typical profile                           | Heavy accepted profile                                                                                          |
| ------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Dense Compare | default form and no per-monster overrides | one normalized custom setup for every generated monster                                                         |
| Planner       | default Planner state                     | a bounded 50-level multi-skill target (70 Attack/Strength and 60 Defence/Ranged/Magic) using the generated pool |
| Duel matrix   | one saved setup                           | the accepted maximum of 12 saved setups                                                                         |
| Risk          | default 10,000 deterministic samples      | accepted maximum 50,000 deterministic samples                                                                   |

For each case, one pair consists of:

1. `cold`: the first task in a new Chromium browser context; and
2. `warm`: a second one-shot Worker for the same case on the same page.

The default command records five pairs, raw samples, medians and p90 values.
The browser process may stay alive across pairs, matching the existing startup
measurement policy. Results are local comparison evidence rather than a
universal latency SLA.

`--summary-only` repeats the same bounded cases but omits raw samples from
stdout. It exists for concise evidence capture; the default remains the raw
auditable output.

## Implementation shape

- `calculation-task.ts` owns the typed measurement envelope and a pure worker
  input executor while retaining raw request/response compatibility.
- `calculation-worker.ts` remains a thin production entry and delegates both
  raw and measurement inputs to that executor.
- `calculation-worker-client.ts` adds an explicit measurement starter. Existing
  controllers continue importing only `startCalculationTask`.
- `scripts/worker-measurement-browser.ts` builds the eight source-backed cases
  and exposes a bounded browser harness.
- `scripts/vite-worker-measurement.config.ts` builds an isolated measurement
  artifact outside `dist`; it does not alter the production entry or artifact
  file-count contract.
- `scripts/measure-calculation-worker.mjs` owns build, local preview, paired
  Chromium execution, aggregation and sanitized JSON output.
- The measurement harness uses a separate 120-second ceiling so it can report
  an accepted heavy input that would exceed the unchanged production timeout.
- The temporary `.worker-measurement-dist` directory is repository-local and
  ignored.

## Characterization and safety

Tests must prove:

- raw requests still return the existing raw worker response;
- measurement requests wrap the same calculation result and record ordered
  Worker timestamps;
- the client posts only the explicit measurement envelope, derives all phases
  from deterministic clocks and terminates after success;
- invalid, mismatched, failed, timed-out and cancelled measurement work remains
  sanitized and bounded; and
- no production controller imports or activates measurement code.

No calculation formula, simulation context, persistence schema, UI copy,
controller lifecycle, cancellation behavior, CSS, visual baseline or normal
production artifact route may change.

The initial all-skills-at-99 Planner stress candidate did not finish inside the
measurement-only 120-second ceiling. It is retained as evidence that a maximum
Planner target is an algorithmic stress case, not a useful worker-overhead
profile. The repeatable heavy profile therefore uses the bounded 50-level
multi-skill target above; this scope correction does not change Planner input
validation or production timeout behavior.

## Required validation

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/calculation-task.test.ts src/tests/ui-performance.test.ts
npm run worker:measure -- --runs 5
npm run numeric:audit
npm run test:golden
npm run build
npm run deploy:verify-artifact
npm run verify
git diff --check
```

The measurement command requires a local Chromium/Playwright environment and a
localhost preview bind. If the managed sandbox blocks either, rerun only that
command with the standard approved localhost permission and record the exact
environment boundary.

## Decision rule

Do not specify a persistent worker merely because the request is large.

- Keep the current one-shot design if heavy-task execution dominates total time
  and warm startup/transfer overhead is small in both absolute and relative
  terms.
- Specify a persistent initialized worker only if repeated warm samples show a
  material avoidable startup/transfer share on an interactive path. That later
  specification must preserve immutable-context identity, explicit request ids,
  latest-result freshness, timeout/cancel semantics and context replacement.
- If evidence is mixed, retain one-shot workers and record which user-device or
  production tracing evidence would be needed to reopen the decision.

## Done criteria

- The command is deterministic in case selection, bounded in options and leaves
  no unignored helper artifact.
- All eight cases complete through the actual production Worker entry.
- Raw samples, medians, p90s, request/result sizes, browser version and runtime
  environment are reported without user paths or secrets.
- Architecture, testing, backlog and decisions separate measured facts from the
  workstation-specific inference.
- The repository gates pass and the persistent-worker question is either closed
  for now or promoted to a separate implementation specification.

## Implementation evidence

The repository command completed five raw paired runs and a second five-pair
summary capture on Node 22.19.0, Playwright Chromium 149.0.7827.55 and an Apple
M2 Darwin arm64 workstation. All 80 tasks per capture completed through the
production `calculation-worker.ts` entry and all main/Worker clocks aligned.
The localhost-only rerun was required because the managed sandbox rejected the
first preview bind with `listen EPERM`.

The summary capture produced these medians (milliseconds):

| Case            | Request/result bytes | Cold total | Warm total | Warm p90 total | Warm execution | Warm non-execution | Warm share |
| --------------- | -------------------: | ---------: | ---------: | -------------: | -------------: | -----------------: | ---------: |
| Dense typical   |     903,399 / 32,411 |      170.5 |      140.8 |          152.1 |          103.8 |               37.0 |      25.2% |
| Dense heavy     |   1,085,849 / 35,832 |      168.9 |      137.7 |          150.3 |          102.8 |               34.4 |      25.2% |
| Planner typical |      903,659 / 4,227 |    1,015.5 |      961.2 |        1,000.8 |          923.5 |               35.0 |       3.8% |
| Planner heavy   |      903,664 / 8,347 |   13,013.5 |   13,065.2 |       13,951.1 |       13,016.5 |               57.1 |       0.4% |
| Duel typical    |     906,338 / 41,576 |      305.2 |      244.0 |          339.3 |          209.4 |               35.1 |      14.9% |
| Duel heavy      |    938,684 / 243,106 |    1,294.2 |    1,394.5 |        1,411.6 |        1,351.1 |               48.3 |       3.4% |
| Risk typical    |      903,484 / 1,032 |    1,542.5 |    1,564.1 |        1,613.9 |        1,517.7 |               58.7 |       3.7% |
| Risk heavy      |      903,484 / 1,032 |    6,589.9 |    6,641.0 |        7,415.0 |        6,581.4 |               53.9 |       0.8% |

Across warm medians, synchronous Worker construction is 0.1-0.2 ms, full
request posting is 1.6-2.3 ms, startup/request delivery is 31.8-56.7 ms and
response delivery is 0.1-0.9 ms. The large context is therefore not producing
a material sender-side clone cost on this workstation. Avoidable one-shot
startup is visible in Dense and typical Duel, but its absolute 34-37 ms median
does not establish a user regression or justify persistent context identity,
replacement and request-lifecycle complexity.

D-095 retains the current one-shot Worker. Reopen only with low-end-device or
production evidence of a task-start responsiveness breach, repeated
back-to-back task demand or another measured requirement that makes roughly
35-58 ms material. The all-skills-at-99 Planner stress candidate remains a
separate algorithmic finding: it exceeded the measurement-only 120-second
ceiling and is not evidence for or against Worker persistence.

The implemented
[calculation Worker retention and persistent-trigger specification](calculation-worker-retention-spec.md)
now owns the exact raw protocol, Dense/Planner/Duel/Risk freshness and
cancellation invariants, quantitative reopen screening and the minimum
hard-cancellation-safe persistent target. This document remains the timing and
harness owner.

Final validation passed 10/10 focused calculation/performance tests, 64/64
Vitest files with 761/761 tests, 19/19 goldens, 5,958/5,958 numeric comparisons,
the 114-source-module zero-cycle architecture gate, typecheck, lint, formatting,
diff check and the production build/artifact gate. The production artifact has
10 files/two assets, totals 1,977,623 bytes and has SHA-256
`8c18ea8b096e82b7d45a31f29d32d361def834dc91774c7a795eecb6c5668017`.

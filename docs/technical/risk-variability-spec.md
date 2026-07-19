# Risk and variability specification

Current lifecycle note: the implemented
[calculation failure and Retry contract](calculation-failure-retry-lifecycle-spec.md)
replaces the original visible `Running`/`Cancelled`/`Unavailable` states with
`building`/derived post-cancel state/`failed`, retains failed-refresh output as
labelled previous data and exposes Retry. The stochastic model and explicit
Run/Cancel boundary specified here are unchanged.

- Status: implemented and browser-verified on 2026-07-11
- Date: 2026-07-11
- Owner: technical docs
- Product surface: new `Risk` workbench tab with compact ranges beside existing averages
- Related decisions: D-024, D-025, D-026, D-027, D-069, D-074 and D-081

## Purpose

Add a stochastic analysis beside the simulator's current expected values. The
feature answers five user questions without replacing the accepted deterministic
`FullSimulationResult`:

1. What are the median and 10th-90th percentile kill times?
2. How likely is the selected food supply to run out before a target kill count?
3. How much do kills per trip and trip duration vary?
4. What is the 10th-90th percentile net-GP range over a fixed time horizon?
5. How likely is a selected drop or GP target within that horizon?

The result is a modeled outcome distribution, not a promise about live gameplay
and not a statistical confidence interval around the existing average.

## Existing truth and boundaries

- `src/domain/combat` owns hit chance, damage, attack timing, specials and
  poison.
- `src/domain/trip` owns expected incoming damage, food, inventory, banking,
  loot actions, supply costs, cannon and trip bounds.
- `src/domain/simulation.FullSimulationResult` remains the authoritative
  expected-value result used by Result, Compare, Duel and Planner.
- D-069's existing Stats histograms describe one normal hit, one special hit or
  one cannonball. They must not be reused as if they already described a kill,
  trip or hour.
- The current normalized loot contract has source chance and average quantity,
  but not a complete source-backed quantity PMF or every roll-group correlation.
  V1 therefore exposes stochastic coverage and treats unsupported quantity or
  correlation detail as a visible approximation instead of inventing precision.

## User workflow

The `Risk` tab uses the active setup, target, PriceSet, Trip, Cannon and loot
policy. It exposes only transient analysis controls:

- target kills, default `50`, integer range `1..10,000`;
- time horizon, default `60` minutes, range `1..1,440`;
- non-negative GP target, default `100,000`, maximum `1,000,000,000`;
- optional target drop selected from currently active, non-skipped loot rows;
- `Run analysis` and `Cancel` actions.

Changing any source input marks the current result stale. It does not silently
recompute a heavy analysis. Running again replaces only a source-matching
result. Analysis controls and results are not persisted, imported, exported or
included in setup permalinks.

## Output contract

Every continuous/count distribution reports:

- arithmetic mean for comparison with the deterministic result;
- P10, median/P50 and P90 using sorted linear-interpolation quantiles;
- finite sample count;
- model version, deterministic input fingerprint and stochastic coverage;
- structured warnings for approximated or unsupported sources.

The visible cards are:

### Kill time

- Scope: one fresh selected monster from the first player attack until its HP
  reaches zero.
- Show P10, median and P90 seconds beside the existing expected TTK.
- Respawn, banking and user-configured kill overhead are excluded from kill time
  and remain part of the trip/hour timeline.

### Food sufficiency

- Report the probability that modeled cumulative food demand exceeds the
  selected carried-food healing before the requested kill is completed.
- Label this `Food runs out`, not `Death chance`: V1 does not model starting HP,
  eating latency, combo damage or player reactions closely enough to claim a
  death probability.
- No food with zero modeled incoming damage is `0%`; no food with positive
  modeled incoming damage is `100%`.

### Trip variability

- Report P10/P50/P90 for completed kills per trip and active trip-cycle minutes.
- A trip cycle starts at the first attack and ends when the next equivalent trip
  could start. It therefore includes configured banking and altar time, matching
  the current efficiency denominator.
- Food and sampled non-stackable loot can end a trial early. Prayer, recoil,
  scarce/respawn and other currently deterministic caps retain their accepted
  trip-domain bounds in V1.

### Timed net GP

- Report P10/P50/P90 net GP earned in the selected wall-clock horizon.
- Count only completed kills before the horizon. Include banking/altar time,
  active loot actions and current prices.
- Sample loot receipts; charge sampled food use plus the accepted deterministic
  non-food supply cost per completed kill.
- Also report `P(net GP >= target)` for the requested GP target.

### Target drop

- Report the probability of at least one selected active drop within the time
  horizon and the exact fixed-kill probability within the requested kill count.
- For a per-kill chance `p` and sampled completed-kill count `K`, use the
  conditional probability `1 - (1 - p)^K` and average it across trials. Do not
  estimate rare-drop probability only from observed Monte Carlo successes.
- Conditional rows locked inactive by D-072 and skipped rows cannot be targets.

## Risk-domain contract

Create a pure `src/domain/risk` owner. Its public boundary is separate from
`SimulationRequest` and `FullSimulationResult`:

```ts
interface RiskAnalysisRequest {
  targetKills: number;
  horizonMinutes: number;
  gpTarget: number;
  targetDropRowId: string | null;
  sampleCount?: number;
  seed?: number;
}

interface DistributionSummary {
  mean: number;
  p10: number;
  p50: number;
  p90: number;
}

interface RiskAnalysisResult {
  modelVersion: 2;
  inputFingerprint: string;
  sampleCount: number;
  killTimeSeconds: DistributionSummary;
  foodRunsOutProbability: number;
  killsPerTrip: DistributionSummary | null;
  tripCycleMinutes: DistributionSummary | null;
  timedNetGp: DistributionSummary;
  gpTargetProbability: number;
  targetDrop: null | {
    rowId: string;
    name: string;
    fixedKillProbability: number;
    timedProbability: number;
  };
  coverage: RiskModelCoverage;
  warnings: SimulationWarning[];
}
```

The trip summaries are `null` only when the active assumptions create no finite
food, loot, prayer, recoil or other trip end. The UI labels that state
`Unbounded` instead of fabricating a percentile.

The concrete function receives the normalized full-simulation input and current
`SimulationContext`; it may compose the deterministic result once but must not
read React state, browser globals, storage or network data.

## Stochastic model

### Reproducibility and sampling

- Production uses `10,000` trials. Tests may pass a smaller bounded sample
  count; accepted range is `100..50,000`.
- Use a versioned deterministic non-cryptographic PRNG with committed test
  vectors. The default seed derives from a stable canonical fingerprint of all
  calculation inputs plus model version; an explicit seed exists for tests.
- Identical normalized inputs, model version, sample count and seed must produce
  byte-for-byte equal numeric output.
- Each trial has an independent PRNG stream. Result ordering, React render count
  and worker scheduling must not affect numbers.
- A displayed Monte Carlo probability includes its approximate sampling error
  in detail copy. Zero observed threshold events render using a bounded `<`
  statement rather than claiming impossible `0.000%`; analytic target-drop
  probabilities are exempt.

### Player damage and kill time

- Sample the unbucketed per-attack damage PMF owned by the combat domain. A miss
  and a successful zero remain distinct internal outcomes even when the Stats
  presentation combines them.
- Preserve current attack tick timing and stop on the first attack/event that
  reduces remaining HP to zero.
- Build stochastic descriptors in the owning combat domain; do not reconstruct
  formulas from formatted view-model values.
- Effects without a complete discrete schedule in V1, including averaged
  special cadence, poison and cannon overlay damage, contribute their accepted
  mean damage continuously between sampled normal attacks. Coverage and warning
  copy must name that their variance is not sampled.
- Manual accuracy, damage and speed overrides flow through the same accepted
  combat result and remain bounded/fail-closed.

### Incoming damage and food

- Consume Trip's normalized descriptor; Risk must not read monster attack type,
  max-hit inputs or selection rules directly from `MonsterDefinition`.
- For `Source-backed` coverage, sample attack opportunities over sampled kill
  time, select exact weighted profiles with the descriptor probabilities, roll
  the descriptor hit chance and sample inclusive integer damage `0..maxHit`.
- Apply the descriptor's accepted net-damage scaling so defence, protection,
  safespot, regeneration and separate dragonfire/poison overlay means do not
  fork into a second expected-value formula.
- Treat `Partial model` and `Compatibility fallback` incoming damage as
  deterministic mean-only food demand and emit structured coverage/warnings.
- Food demand accumulates as healing units. V1 does not model the exact eat tick,
  overheal, starting HP or death; the output remains food-sufficiency risk.
- A manual `foodPerKillOverride` replaces stochastic incoming-food demand with
  that deterministic per-kill value and emits an info warning.

### Loot, inventory and supplies

- For each active loot row, sample its source chance once per completed kill.
  A success contributes `qtyAvg * saleValue`, prayer/alch actions as already
  represented by the trip owner and the row's modeled slot use.
- Rows in a known mutually exclusive `DropEntry[]` group must share one roll;
  they must not be sampled as independent successes.
- Until a source-backed quantity PMF exists, fixed `qtyAvg` preserves the row's
  expected GP but understates quantity variance. The coverage result reports the
  share of active GP/kill whose occurrence is sampled and the share whose exact
  quantity/correlation variance is known.
- Unknown group semantics or malformed probabilities fail that row to its
  deterministic expected contribution with a structured warning. They never
  disappear from the mean silently.
- Current stackability, loot actions, alch values, prices and inventory reserve
  rules remain owned by trip/economy data. Conditional inactive loot remains
  excluded exactly as in the deterministic path.

### Trip and timed horizon

- A trial tracks completed kills, elapsed kill/cycle time, food healing used,
  sampled loot slots, deterministic prayer/recoil/scarce caps and net GP.
- When a trip bound is reached, add current bank/altar time and reset trip-local
  inventory/supply state. Continue until the time horizon; do not count a kill
  that finishes after the horizon.
- Guard every loop with finite upper bounds derived from the validated request,
  horizon and sample-count caps. Invalid/non-progressing timelines fail closed
  with a sanitized unavailable result rather than hanging a worker.

## Coverage and honesty contract

`RiskModelCoverage` reports at least:

- player-damage variance: `sampled` or `mean-only` sources;
- incoming-damage variance status;
- active loot GP occurrence coverage in `[0, 1]`;
- exact loot quantity/correlation coverage in `[0, 1]`;
- a list of sanitized mean-only source labels.

The UI uses `Modeled` wording everywhere. It must not use `confidence interval`,
`guaranteed`, `safe` or `death chance`. If any economically material source is
mean-only, timed GP still renders but carries a visible approximation marker.
Non-finite output is unavailable, never formatted as zero.

## Worker and cancellation boundary

- Add risk analysis to the existing typed `src/app/calculation-task.ts` worker
  boundary as an on-demand task.
- The UI keeps only the latest source-fingerprint-matching result, cancels a
  superseded run and exposes `Idle`, `Running`, `Ready`, `Stale`, `Cancelled`
  and sanitized `Unavailable` states.
- Progress may be reported in coarse batches, but partial samples are never
  presented as final results.
- No individual worker task may block the browser main thread over D-027's
  approximate 200 ms budget.

## UI and accessibility

- Add a `Risk` workbench tab after `Trip`; keep existing Result averages intact.
- Add compact `P10 / median / P90` secondary copy to expected TTK, kills/trip
  and net-GP cards only after a fresh analysis exists, with a link to `Risk`.
- Risk controls have explicit labels, bounded validation and one primary Run
  action. Probability cards expose both percentage and plain-language scope.
- Percentile charts, if used, remain supplementary; the same values must exist
  as text and accessible table/list content.
- Keyboard tablist behavior, focus visibility, mobile containment and reduced
  motion follow the existing workbench contract.

## State, compatibility and security

- No `SimulationRequest`, setup persistence, Duel snapshot, PriceSet, history,
  import/export, permalink or legacy migration schema change.
- No auth, account, tenant, database, provider, deployment or live-network work.
- The seed is simulation metadata, not cryptographic randomness or a security
  boundary.
- Worker errors expose sanitized categories only; no raw payload, provenance
  path, stack trace or browser state is rendered.

## Tests

At minimum:

- PRNG test vectors and identical-input reproducibility;
- quantile/property tests: ordered P10 <= P50 <= P90, finite output and
  probabilities in `[0, 1]`;
- analytic fixtures where deterministic damage, zero incoming damage, certain
  drops or zero-value loot make the expected result exact;
- convergence/tolerance tests against simple closed-form kill-time, food and
  Bernoulli-drop cases without snapshotting random incidental values;
- target-drop fixed-kill formula and time-horizon conditioning;
- loot group exclusivity, skipped/conditional rows and mean-only coverage;
- manual food override, no-food cases and deterministic non-food trip caps;
- worker structured-clone, cancellation, stale-result and non-progress guards;
- view-model and Playwright coverage for validation, Run/Cancel, fresh/stale
  output, all five requested metrics and approximation warnings;
- performance evidence for the 10,000-trial representative workload;
- `npm run typecheck`, focused tests, `npm run test`, `npm run test:golden`,
  `npm run build`, `npm run test:e2e` and `git diff --check` before delivery.

Existing deterministic golden fixtures must not change merely because this
optional analysis is added. New deterministic stochastic fixtures belong to the
risk domain and use explicit seeds.

## Done criteria

- All five user questions have visible source-matching results in the Risk tab.
- Existing expected values and composed simulation ownership remain unchanged.
- Identical inputs reproduce identical results and heavy work is cancellable.
- Approximation/coverage boundaries are visible and no output overclaims death
  probability, confidence or unsupported loot precision.
- Focused, full, browser and performance gates pass, and owning documentation is
  current.

## Implementation evidence

- `src/domain/risk/index.ts` owns the deterministic seeded model, P10/P50/P90,
  food sufficiency, trip/hour simulation, target probabilities and coverage.
- `src/app/calculation-task.ts` runs `risk-analysis` through the existing
  one-shot cancellable worker boundary.
- `src/app/view-models/risk.ts`, `src/app/controllers/use-risk-analysis.ts` and
  `src/app/components/panes/risk-pane.tsx` own the Risk UI contracts,
  Run/Cancel/freshness lifecycle and all five requested outputs with
  coverage/warnings. `src/app/App.tsx` composes their fresh compact ranges
  beside current TTK, net-GP and Trip averages.
- `src/tests/risk-analysis.test.ts` has twelve deterministic domain cases;
  calculation-task coverage proves structured-clone and worker dispatch.
- The repository verification gate passed 38 files/586 tests, 19/19 golden
  tests, typecheck, production build/artifact validation, lint, format and diff
  checks. The representative 10,000-trial one-hour and 24-hour-block workloads
  completed in about 2.1 s and 1.8 s respectively in the local process.
- The focused Playwright Risk case in `src/tests/e2e/*.spec.ts` passes
  1/1 in Chromium against the production preview. It covers Run, all five
  outputs, coverage and warning copy, source-change staleness and cancellation.
  The runtime pass exposed and closed a status-priority race where stale prior
  results could hide the latest `Cancelled` state.

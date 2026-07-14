# Domain and integration testing

This guide owns detailed commands for goldens, performance, combat/XP/Trip/Risk/Planner domains, schemas and same-origin integration boundaries. The authoritative gate summary and change-type matrix remain in
[the main testing guide](../testing.md).

## Golden legacy fixtures

Current-behavior golden fixtures live in `src/tests/fixtures/legacy-golden.json`.

They are captured from `SimEngine.simulate()` through a Node VM harness in `src/tests/helpers/legacy-sim.ts`. The harness loads only:

- `gamedata.js`
- `engine.js`
- `trip.js`
- `equipment.js`

It intentionally does not load `market.js`, planner files, UI files, live network sources or browser `localStorage`.

Run the golden baseline test:

```sh
npm run test:golden
```

Regenerate the fixture after an accepted baseline change:

```sh
npm run fixtures:capture
```

Tolerance policy: summary numbers are rounded to 6 decimals and compared with `0.000001` absolute tolerance. Any intentional behavior delta must be documented in [../project/bug-triage.md](../../project/bug-triage.md) or [../project/decisions.md](../../project/decisions.md).

## Performance budgets

V1 rewrite performance is part of acceptance, not a later polish pass.

Accepted budgets:

- normal single-input updates should complete in about 100 ms in representative local runs
- heavy compare/planner work must not block the UI in chunks longer than about 200 ms
- if compare/planner misses the budget, move that workload behind the calculation runner boundary into a Web Worker

Representative direct Dense Compare/Planner and maximum Duel matrix calculations exceeded this budget, so all three heavy paths now use `src/app/calculation-task.ts` through a cancellable one-shot Web Worker. Pure dispatch, structured-clone safety, success/failure and cancellation are covered by:

```sh
npm run test -- src/tests/calculation-task.test.ts src/tests/ui-performance.test.ts
```

The production-preview smoke installs a Chromium Long Task observer, triggers Compare, Planner and Duel through visible controls and rejects tasks over 200 ms:

```sh
npm run test:e2e -- --grep "keeps Compare, Planner and Duel worker calculations off the main event loop"
```

Tests should continue to cover level-input updates because that path has already shown visible jank. Do not move formulas or calculated output into worker-owned persistence; requests/results stay structured-cloneable and superseded work must remain cancellable.

Measure the real production Worker phases locally with:

```sh
npm run worker:measure -- --runs 5
```

The command builds an isolated `.worker-measurement-dist` harness, starts a
localhost preview and uses Playwright Chromium for five cold/warm pairs of the
typical and heavy Dense, Planner, Duel and Risk profiles. Default output includes
raw samples; add `--summary-only` for a concise repeat. It reports Worker
construction, sender-side request posting, startup/request delivery, execution,
response delivery, total time and UTF-8 JSON payload sizes. These are local
workstation comparisons, not merge-blocking wall-clock budgets.

The D-095 Apple M2 / Node 22.19.0 / Chromium 149 evidence measured warm median
request posting at 1.6-2.3 ms for 0.90-1.09 MB requests and startup/delivery at
31.8-56.7 ms. Dense typical/heavy totals were 140.8/137.7 ms with roughly 25%
non-execution share; typical Duel was 244.0 ms/14.9%. Planner, Risk and heavy
Duel spent 96-99% in execution. All 160 tasks across the raw and concise
five-pair captures completed with aligned clocks. The initial all-skills-at-99
Planner stress candidate exceeded the measurement-only 120-second ceiling and
is an algorithmic stress finding, not a persistent-worker result. D-095 retains
the one-shot lifecycle until low-end-device, production or repeated-task
evidence establishes a material task-start regression.

## Domain core tests

The current domain-core tests live in `src/tests/domain-core.test.ts` and run as part of:

```sh
npm run test
```

They cover:

- pure combat formula unit tests
- hit distribution bucket normalization and probability-total invariants
- melee stance fallback and attack-type selection
- equipment bonus summing, two-handed shield exclusion and thrown ammo handling
- browser-global boundary checks for `src/domain/**`
- golden parity for the ported combat/equipment fields across all 18 legacy fixture cases

The parity test intentionally compares only the fields currently owned by the new domain slice. It does not claim parity for trip/economy/UI composition or persistence behavior; cannon occupancy parity is covered by the trip/loot/supply tests.

## XP parity tests

The current XP parity tests live in `src/tests/xp-parity.test.ts` and run as part of:

```sh
npm run test
```

For a focused run:

```sh
npm run test -- src/tests/xp-parity.test.ts
```

They cover:

- direct `xpPerHour` and `effectiveXpPerHour` parity for 17 legacy fixtures
- rewrite-owned `skillXpBreakdown` rows for the covered fixtures, including Prayer XP from bury loot rows and Magic alch XP from tracked in-trip alch casts
- explicit accepted intentional delta for the ring-of-recoil XP/hr attribution case
- cannon ranged XP as a separate effective XP row for the cannon fixture
- full `totalXpPerHour` parity for every non-recoil fixture once combat, cannon, Prayer and alch XP source rows are composed
- diagnostic coverage showing that the accepted ring-of-recoil XP/hr delta is caused by XP direct-damage attribution, not by trip/KPH/recoil damage parity

The ring-of-recoil delta is accepted in [D-031](../../project/decisions.md): legacy remains comparison evidence, but rewrite combat XP is not reduced by trip-layer recoil damage. `totalXpPerHour` is compared for every non-recoil fixture by summing the rewrite-owned XP source rows. Prayer XP is derived from current trip/loot bury data, Magic alch XP is derived from tracked in-trip alch casts at 65 XP per cast, and cannon ranged XP remains a separate effective XP row.

## Data and economy schema tests

The current data/economy tests live in `src/tests/data-economy.test.ts` and run as part of:

```sh
npm run test
```

For a focused run:

```sh
npm run test -- src/tests/data-economy.test.ts
```

They cover:

- adapting the legacy runtime data into a validated `GameDataSnapshot`
- validating committed `prices.json`, `price-provenance.json`, `alch.json` and `price-history.json`
- duplicate raw JSON key detection before `JSON.parse` can drop earlier values
- duplicate legacy monster id detection before object conversion
- malformed loot entry rejection for missing/invalid names, chances, quantities and nested `_expand` rows
- rejecting malformed imported `PriceSet` JSON
- canonical item/price alias resolver coverage for known legacy gem aliases, canonical-first economy lookup, duplicate alias collisions and missing-price preservation without mutating `PriceSet`
- returning missing-price warnings without mutating the `PriceSet`

## Live integration schema tests

The current live integration foundation tests live in `src/tests/live-integrations.test.ts` and run as part of:

```sh
npm run test
```

For a focused run:

```sh
npm run test -- src/tests/live-integrations.test.ts
```

They cover:

- hiscores request/response validation with mocked fixtures
- hiscores status and error response validation helpers
- market status, sync response and error response validation helpers
- invalid JSON-like payloads, oversized payloads and invalid skill levels
- market sync request validation, item count limits and market item allowlist checks
- partial market sync response validation
- mocked market upstream fixture parsing into a `PriceSet`
- fixture hygiene checks for local paths and known real player names

They intentionally do not call live hiscores or market upstream services.
Market freshness is scheduled-only. The item-page adapter, robust estimator, workflow shape and committed-snapshot commands are covered by fixtures, mocked fetch and static review; automated tests never call the live market. The workflow uses targeted writer, JSON and data/economy validation rather than browser smoke.

## Hiscores API, adapter and UI state tests

The hiscores same-origin implementation tests live in:

- `src/tests/hiscores-server.test.ts`
- `src/tests/lostcity-hiscores-provider.test.ts`
- `src/tests/hiscores-adapter.test.ts`
- `src/tests/hiscores-ui-state.test.ts`
- `src/tests/hiscores-lookup-controller.test.ts`
- `src/tests/e2e/*.spec.ts`

Run focused coverage with:

```sh
npm run test -- src/tests/hiscores-lookup-controller.test.ts src/tests/hiscores-ui-state.test.ts src/tests/hiscores-adapter.test.ts src/tests/local-state-recovery-controller.test.ts src/tests/live-integrations.test.ts
```

They cover:

- disabled-provider status and lookup behavior at the runtime-neutral handler boundary
- first-party JSON type 1-7 mapping, stored-XP normalization and partial-skill warnings
- fixed HTTPS origin, redirect refusal, abort propagation and sanitized fetch/stream failures
- content-type, duplicate-row, level-range, declared-size and streamed-size rejection
- validated same-origin lookup success
- bad player input, not-found, rate-limited, upstream-unavailable and upstream-invalid failures
- per-process rate-limit and provider-timeout guards
- browser adapter cross-origin refusal and invalid-payload handling
- versioned last-player persistence with no legacy key migration
- preview/apply behavior for Attack, Strength, Defence, Hitpoints, Prayer, Ranged and Magic, including normalized player-name freshness checks that disable stale Apply paths
- one-shot status outcomes, empty/unavailable lookup guards, monotonically sequenced latest-request-wins behavior and changed-input late-response rejection
- fixed sanitized notices for every adapter error category without raw message leakage
- successful and failed last-player save integration with the local-state recovery replacement path, plus compatible legacy player replacement without a lookup
- typed fresh/stale Apply outcomes and static topbar landmark/form/notice/preview/table/button DOM contracts

The Playwright scaffold includes a mocked `/api/hiscores/status` and `/api/hiscores` smoke path. It also checks the default disabled-provider copy, disabled Lookup behavior, editable manual Player level fields, stale-preview clearing after Player input changes, late-response rejection and absence of stale production `run_sim.py` instructions. It must stay mocked; automated tests must not call a live hiscores upstream.

## Legacy storage migration tests

The rewrite-specific migration owner is
`src/app/state/legacy-storage-migration.ts`; `src/adapters/storage` provides only
the generic `KeyValueStorage` and versioned persistence mechanics. The
ownership-only adapter move is specified in
[legacy-migration-layer-refactor-spec.md](../legacy-migration-layer-refactor-spec.md),
and the implemented internal responsibility/test split is specified in
[legacy-migration-internal-split-spec.md](../legacy-migration-internal-split-spec.md).

The legacy storage migration policy, setup, preferences, prices and presentation
tests live in:

```sh
npm run test -- src/tests/legacy-migration-*.test.ts src/tests/ui-adapters.test.ts
```

The four state suites own 41 cases and the view-model suite owns three, retaining
the 44/44 characterized public boundary after the internal split. Production
internals are exercised only through the stable
`src/app/state/legacy-storage-migration.ts` facade. The 2026-07-10 Duel
migration extension's browser assertion remains part of `reviews and imports
compatible legacy setup data`.

They cover known legacy key detection, the policy table that classifies every known legacy key as `migrate`, `review-only`, `intentional-reset` or `legacy-only`, defensive `sim_input_v3` JSON parsing, invalid non-object legacy setup state, safe mapping into the current rewrite form schema, unknown entity-id skips, numeric range/default handling, oversized payload rejection, nested `sim_input_v3.monsterSetups` import into rewrite-owned monster-specific custom setup state, nested `sim_input_v3.cannonByMonster` import into rewrite-owned per-monster cannon state and bounded nested `sim_input_v3.duelSetups` import into rewrite-owned Duel snapshot state. Duel migration inherits the legacy player context, maps only validated setup fields, keeps existing rewrite snapshots, rejects computed rows, applies the shared 12-entry cap and reports malformed/conflicting/overflow rows with sanitized reasons. The suite also covers compatible `sim_hiscore_player`, price/alch, loot preference, hidden-tier and dense-compare imports; invalid, ambiguous, unsafe and oversized paths; no inspection-time storage writes; exact known-key clearing; and the review-only `sim_planner_v1` boundary.

The Playwright scaffold covers the user-facing notice/review flow: legacy keys show a migration notice, the review UX lists the metadata-only outcome summary, import plan, review/reset plan, per-key policy and exact clear list, and compatible nested custom setup, cannon and Duel rows appear in the plan. Import writes those areas into their rewrite-owned stores while keeping legacy keys, and the Duel tab renders the migrated row. Planner and full legacy price history remain explicit review-only/not-migrated boundaries; raw payload sentinels are not shown, Import/Keep/Clear status copy remains separate, Keep dismisses without deletion and Clear removes only known keys after confirmation.

Release evidence for legacy migration/reset should include the focused unit command above, `npm run test:e2e` for the user-facing notice/review flow, the release-copy audit `rg -n "run_sim.py|/api/prices|/api/scrape|/api/hiscores" index.html legacy/index.html src views.jsx planner.jsx market.js docs`, the static security searches from this document and a feature-inventory check confirming `Legacy saved setup migration` is `Valmis` for the accepted V1 boundary. D-048 `sim_planner_v1` and D-049 full legacy price-history payloads remain review-only/not migrated for V1.

## Market API, adapter and UI state tests

The market same-origin implementation tests live in:

- `src/tests/market-sync-items.test.ts`
- `src/tests/market-server.test.ts`
- `src/tests/market-adapter.test.ts`
- `src/tests/market-ui-state.test.ts`
- `src/tests/price-import-notice.test.ts`
- `src/tests/e2e/*.spec.ts`

Run focused coverage with:

```sh
npm run test -- src/tests/market-sync-items.test.ts src/tests/market-server.test.ts src/tests/market-adapter.test.ts src/tests/market-ui-state.test.ts src/tests/price-import-notice.test.ts
```

They cover:

- current-monster, all-supported and explicit item expansion through the approved mapping
- nested loot rows, tagged gem/herb/casket dependencies and support items such as ring of recoil
- disabled-provider status and sync behavior
- body size, item count, item allowlist and malformed JSON rejection
- validated same-origin sync success with explicit `PriceSet` output
- partial failure reports that keep successful validated prices
- service-unavailable, rate-limited, timeout and upstream-invalid failures
- browser adapter cross-origin refusal and invalid-payload handling
- UI state helpers and import notices that swap `PriceSet` only on success, keep the current one on failure, format item-level market report diagnostics with failed/skipped rows first and report imported `PriceSet` invalid JSON, duplicate keys, invalid schema data and oversized files with visible validation codes, bounded issue paths and no raw dumps
- browser-local selected active `PriceSet` persistence for accepted imported and compatible legacy values, with invalid/oversized/version-mismatched restore falling back through scheduled static prices before bundled prices
- browser-local comparison snapshots only for accepted imports, compatible legacy prices or explicit `Save local comparison`; shared restore and failed imports leave the local key unchanged
- browser-local Economy movers analysis for latest-vs-previous, latest-vs-first and explicit snapshot baselines, chronological per-row trend prices and item-selectable detailed trend metrics/points, including filter/sort behavior and missing or zero baseline prices without `NaN`/`Infinity`

Playwright covers scheduled status, generated alch counts, validated PriceSet import/persistence/export/reset, non-fatal failure recovery, shared/local history counts, read-only shared trend analysis, local save/clear isolation, movers/sparklines/trends, result price warnings and absence of user-triggered upstream controls or stale backend instructions. Compatibility sync tests remain mocked.

The same scaffold also covers Settings Gear menu tier filtering for rewrite-owned
hidden gear preferences: hiding a tier removes matching unselected options from
gear pickers, keeps `None` and the current selection visible, and persists the
versioned `index-sim:hidden-gear-tiers` state. Focused UI adapter tests cover the
tier classifier, option filtering, storage schema and legacy
`sim_hidden_tiers_v1` import boundary.

## Trip, loot and supply tests

The current trip/loot/supply tests live in `src/tests/trip-loot-supply.test.ts` and run as part of:

```sh
npm run test
```

For a focused run:

```sh
npm run test -- src/tests/trip-loot-supply.test.ts
```

They cover:

- stackability, default loot actions and bone prayer XP rules
- structured missing-price, approximate-data, canonical-resolver-backed direct loot, gem price alias and fallback warnings
- combat-integrated parity for all 18 fixtures covering prayer, food, recoil, dragonfire, alch, ranged ammo, magic runes, low-value loot, cannon occupancy and cannonball supply
- scarce/AFK spot target and respawn caps, visible inventory reserve details and prayer restore capacity fields
- domain-owned general potion carry recommendation, including sustained-off inactive state, no-general-boost inactive fallback, non-finite manual-carry fallback, vial and single-dose under/over/matched state, `canApply` gating and long-trip carry scaling

## Risk and variability tests

The implemented contract is
[risk-variability-spec.md](../risk-variability-spec.md). The focused domain suite
is `src/tests/risk-analysis.test.ts`; it covers deterministic PRNG vectors,
identical-input reproducibility, ordered finite quantiles, probability bounds,
analytic drop fixtures, food-sufficiency edge cases, invalid targets,
stochastic coverage, exact source-backed incoming sampling, partial and
compatibility mean-only coverage and bounded full-day hour-block composition.

Run at minimum:

```sh
npm run test -- src/tests/risk-analysis.test.ts src/tests/calculation-task.test.ts src/tests/*-view-model.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 --grep "Risk"
git diff --check
```

The complete delivery gate also requires `npm run test`, `npm run test:golden`,
`npm run build` and the full browser suite. Existing deterministic golden values
must remain unchanged; risk fixtures use explicit seeds and tolerance/property
assertions instead of accepting incidental random snapshots.

The 2026-07-11 implementation pass completed the repository gate with 38 files
and 586 unit tests, 19/19 legacy goldens, typecheck, production build/artifact
validation, lint, format and diff checks. The generated artifact had 8 files, 2
assets, 1,712,492 bytes and SHA-256
`2bffcddb2651d3283a51f8324ba4485a28ee3fe35ca7602fd312201ce9f1cc65`.
Focused 10,000-trial one-hour and 24-hour-block measurements completed in about
2.1 s and 1.8 s respectively outside the UI main thread.

The focused Playwright case `runs, invalidates and cancels modeled Risk
analysis` passes 1/1 in Chromium against the production preview. It verifies
Run, all five outputs, coverage and warning copy, source-change staleness and
cancellation. The first runtime attempt exposed a status-priority race: a stale
prior result hid the latest `Cancelled` state even though cancellation itself
had succeeded. Prioritizing the latest cancellation state closed the defect,
and the focused rerun plus typecheck passed.
The focused runtime browser gate later passed in an allowed preview environment
and is included in the current 77/77 functional gate. Historical managed-sandbox
bind failures remain environment evidence, not product regressions.

## Planner domain tests

The current planner-domain tests live in `src/tests/planner-domain.test.ts` and run as part of:

```sh
npm run test
```

For a focused run:

```sh
npm run test -- src/tests/planner-domain.test.ts
```

Planner UI state and adapter foundation tests live in `src/tests/planner-ui-state.test.ts` and `src/tests/planner-ui-adapter.test.ts`. They cover the versioned `index-sim:planner-ui` envelope, invalid/version fallback, gear-pool cleanup against the active allowed pool, editor option shaping, adapter mapping into `src/domain/planner`, avg-over-session mapping into the domain Planner `sustained` option, timeline data and deterministic DPS-vs-cumulative-XP chart data. For a focused run:

```sh
npm run test -- src/tests/planner-ui-state.test.ts src/tests/planner-ui-adapter.test.ts
```

The visible Planner tab workflow is covered by the Playwright scaffold, including metric/current-XP/target/skill-lock edits, avg-over-session pending/Recompute behavior, gear-pool selection, the D-051 manual fallback requirement warning, persisted Planner UI state and the timeline/chart areas. For a focused browser smoke:

```sh
npm run test:e2e -- --grep "Planner"
```

Planner golden fixtures live in `src/tests/fixtures/planner-golden.json`; their case definitions live in `src/tests/fixtures/planner-case-definitions.ts`.

They cover:

- explicit gear eligibility policy and default pool filtering
- candidate-weapon stance selection, including the legacy `accByType`/stance regression risk
- missing future/unknown weapon warnings without adding canonical data
- deterministic V1 rewrite acceptance golden plans for melee weapon unlock, ranged bow
  unlock, magic spell unlock and boosted sustained melee training

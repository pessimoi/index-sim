# Testing

## Current state

The root app path uses the Vite/React rewrite and has npm scripts for TypeScript, Vite, Vitest, Playwright, ESLint and Prettier. The archived legacy app in `legacy/index.html` still transforms JSX in the browser by Babel Standalone and has no local JSX typecheck/build step.

Use [rewrite-parity-report.md](rewrite-parity-report.md) to interpret which user-visible calculation areas are currently legacy-parity certified, partially covered or not ported.

Accepted parity policy: legacy results are regression evidence, not the final truth source. Keep golden tests to catch accidental changes, but allow documented intentional deltas when LostCityRS/Content Revision 274 or another accepted source shows the legacy app should be replaced.

## Rewrite scaffold commands

Run these for the new `src/` scaffold:

```sh
npm run typecheck
npm run test
npm run build
npm run lint
npm run format:check
```

Acceptance/security passes should also run:

```sh
npm run test:golden
npm audit
git diff --check
rg -n "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document.write|eval\\(|new Function" src index.html legacy/index.html views.jsx planner.jsx market.js
rg -n "api[_-]?key|secret|token|password|authorization|bearer|private key" .
rg -n "https?://|unpkg|text/babel|script src|/api/prices|/api/scrape|/api/hiscores" index.html legacy/index.html src views.jsx planner.jsx market.js docs SECURITY_AUDIT.md
```

For live integration release-copy audits, also run the narrower command below and classify every hit as production code, typed same-origin contract/test, archived legacy evidence or documentation:

```sh
rg -n "run_sim.py|/api/prices|/api/scrape|/api/hiscores" index.html legacy/index.html src views.jsx planner.jsx market.js docs
```

The npm scripts use npm's `$NODE` value for Node-based tool commands. This keeps commands on the active NVM Node version even if a parent `node_modules/.bin/node` appears earlier in `PATH`.

Use repository-local caches and helper files for tests. For example, this project uses `.npm-cache` for npm commands. Do not place project scripts in `/tmp` or another external scratch directory unless a human explicitly approves.

Playwright smoke tests are configured, but browser binaries may need to be installed separately before running:

```sh
npm exec -- playwright install chromium
npm run test:e2e
```

In the managed Codex sandbox, Node-based localhost connections can fail with `EPERM`.
When that happens, run `npm run test:e2e` with explicit sandbox escalation instead of
moving helper scripts outside the repository.

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

Tolerance policy: summary numbers are rounded to 6 decimals and compared with `0.000001` absolute tolerance. Any intentional behavior delta must be documented in [../project/bug-triage.md](../project/bug-triage.md) or [../project/decisions.md](../project/decisions.md).

## Performance budgets

V1 rewrite performance is part of acceptance, not a later polish pass.

Accepted budgets:

- normal single-input updates should complete in about 100 ms in representative local runs
- heavy compare/planner work must not block the UI in chunks longer than about 200 ms
- if compare/planner misses the budget, move that workload behind the calculation runner boundary into a Web Worker

Tests should specifically cover level-input updates because that path has already shown visible jank in the rewrite UI. Keep the first implementation main-thread friendly with memoization and debouncing, but preserve worker-compatible request/result/cancel/progress boundaries.

## Domain core tests

The current domain-core tests live in `src/tests/domain-core.test.ts` and run as part of:

```sh
npm run test
```

They cover:

- pure combat formula unit tests
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
- rewrite-owned `skillXpBreakdown` rows for the covered fixtures
- explicit accepted intentional delta for the ring-of-recoil XP/hr attribution case
- cannon ranged XP as a separate effective XP row for the cannon fixture
- diagnostic coverage showing that the accepted ring-of-recoil XP/hr delta is caused by XP direct-damage attribution, not by trip/KPH/recoil damage parity

The ring-of-recoil delta is accepted in [D-031](../project/decisions.md): legacy remains comparison evidence, but rewrite combat XP is not reduced by trip-layer recoil damage. `totalXpPerHour` is compared only when every legacy skill row is owned by the rewrite XP model. Prayer and alch XP rows remain partial until those row owners are modeled explicitly; the cannon fixture now has a focused total-XP assertion that includes the separate cannon ranged XP row.

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
- validating committed `prices.json`, `alch.json` and `price-history.json`
- duplicate raw JSON key detection before `JSON.parse` can drop earlier values
- duplicate legacy monster id detection before object conversion
- malformed loot entry rejection for missing/invalid names, chances, quantities and nested `_expand` rows
- rejecting malformed imported `PriceSet` JSON
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

## Hiscores API, adapter and UI state tests

The hiscores same-origin implementation tests live in:

- `src/tests/hiscores-server.test.ts`
- `src/tests/hiscores-adapter.test.ts`
- `src/tests/hiscores-ui-state.test.ts`
- `src/tests/e2e/scaffold.spec.ts`

Run focused coverage with:

```sh
npm run test -- src/tests/hiscores-server.test.ts src/tests/hiscores-adapter.test.ts src/tests/hiscores-ui-state.test.ts
```

They cover:

- disabled-provider status and lookup behavior
- validated same-origin lookup success
- bad player input, not-found, rate-limited, upstream-unavailable and upstream-invalid failures
- per-process rate-limit and provider-timeout guards
- browser adapter cross-origin refusal and invalid-payload handling
- versioned last-player persistence with no legacy key migration
- preview/apply behavior for Attack, Strength, Defence, Hitpoints, Prayer, Ranged and Magic

The Playwright scaffold includes a mocked `/api/hiscores/status` and `/api/hiscores` smoke path. It also checks the default disabled-provider copy and absence of stale production `run_sim.py` instructions. It must stay mocked; automated tests must not call a live hiscores upstream.

## Legacy storage migration tests

The legacy storage migration unit tests live in:

```sh
npm run test -- src/tests/legacy-migration.test.ts src/tests/ui-adapters.test.ts
```

They cover known legacy key detection, the policy table that classifies every known legacy key as `migrate`, `review-only`, `intentional-reset` or `legacy-only`, defensive `sim_input_v3` JSON parsing, invalid non-object legacy setup state, safe mapping into the current rewrite form schema, unknown entity-id skips, numeric range/default handling, oversized payload rejection, compatible `sim_hiscore_player` import, malformed hiscores skips with sanitized warnings, compatible legacy price/alch map conversion into an explicit `PriceSet`, malformed/oversized/unknown price skips, failed price import preserving the current `PriceSet`, legacy price-history detection without unsafe mutation across known history keys, invalid rewrite setup envelopes/data, rewrite setup version mismatch, the guarantee that inspection does not write or delete legacy or rewrite storage keys, explicit known-key clearing behavior and the review-only boundaries for `sim_planner_v1` and `sim_hidden_tiers_v1`: detected, not parsed/imported into rewrite-owned state, safe for invalid/oversized payloads and kept unless the user confirms Clear.

The Playwright scaffold covers the user-facing notice/review flow: legacy keys show a migration notice, the review UX lists the import plan, review/reset plan, per-key policy and exact clear list, Import writes compatible setup, hiscores last-player and accepted-price-history state while keeping legacy keys, `sim_planner_v1` stays review-only and does not overwrite existing `index-sim:planner-ui`, Keep dismisses without deletion, Clear removes only known legacy keys after confirmation and an existing rewrite setup is not overwritten until the user chooses Import.

Release evidence for legacy migration/reset should include the focused unit command above, `npm run test:e2e` for the user-facing notice/review flow, the release-copy audit `rg -n "run_sim.py|/api/prices|/api/scrape|/api/hiscores" index.html legacy/index.html src views.jsx planner.jsx market.js docs`, the static security searches from this document and a feature-inventory check confirming the feature remains `Osittainen` until planner/custom setup/loot prefs/compare/cannon/hidden tiers and full price-history migration have an accepted policy.

## Market API, adapter and UI state tests

The market same-origin implementation tests live in:

- `src/tests/market-sync-items.test.ts`
- `src/tests/market-server.test.ts`
- `src/tests/market-adapter.test.ts`
- `src/tests/market-ui-state.test.ts`
- `src/tests/e2e/scaffold.spec.ts`

Run focused coverage with:

```sh
npm run test -- src/tests/market-sync-items.test.ts src/tests/market-server.test.ts src/tests/market-adapter.test.ts src/tests/market-ui-state.test.ts
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
- UI state helpers that swap `PriceSet` only on success and keep the current one on failure
- browser-local price history snapshots only for accepted imported or synced `PriceSet` values, with failed import/sync paths leaving history unchanged
- browser-local Economy movers analysis for latest-vs-previous, latest-vs-first and explicit snapshot baselines, including filter/sort behavior and missing or zero baseline prices without `NaN`/`Infinity`

The Playwright scaffold includes a mocked `/api/market/status` and `/api/market/sync` smoke path. It also checks Settings Price data counts and validated `PriceSet` import, the browser-local price history summary, Economy movers analysis, Snapshot now, confirmed Clear history, browser-rendered metric-strip numbers after a mocked market `PriceSet` is accepted, Result/Loot/Economy price-warning surfacing for imported price sets, the default disabled-provider copy and absence of stale production `/api/prices` or `/api/scrape` instructions. It must stay mocked; automated tests must not call a live market upstream.

The same scaffold also covers Settings Gear menu tier filtering for rewrite-owned
hidden gear preferences: hiding a tier removes matching unselected options from
gear pickers, keeps `None` and the current selection visible, and persists the
versioned `index-sim:hidden-gear-tiers` state. Focused UI adapter tests cover the
tier classifier, option filtering, storage schema and legacy
`sim_hidden_tiers_v1` review-only boundary.

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
- structured missing-price, approximate-data, gem price alias and fallback warnings
- combat-integrated parity for all 18 fixtures covering prayer, food, recoil, dragonfire, alch, ranged ammo, magic runes, low-value loot, cannon occupancy and cannonball supply
- scarce/AFK spot target and respawn caps, visible inventory reserve details and prayer restore capacity fields

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

The visible Planner tab workflow is covered by the Playwright scaffold, including metric/current-XP/target/skill-lock edits, avg-over-session pending/Recompute behavior, gear-pool selection, the manual requirement-policy warning, persisted Planner UI state and the timeline/chart areas. For a focused browser smoke:

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

## UI, adapters and persistence tests

The current rewrite UI tests live in:

- `src/tests/ui-view-model.test.ts`
- `src/tests/ui-performance.test.ts`
- `src/tests/ui-adapters.test.ts`
- `src/tests/e2e/scaffold.spec.ts`

Run unit/integration coverage with:

```sh
npm run test
```

Run browser smoke tests with:

```sh
npm run test:e2e
```

They cover:

- UI form state to `SimulationRequest` separation
- searchable weapon, ammo, spell and equipment-slot option view models
- supported special attack state to `SimulationRequest.specialAttack` mapping, including ranged spec-arrow fallback
- manual accuracy/damage/speed override state to `SimulationRequest.manualOverrides` mapping and visible combat metric changes
- MonsterCard view-model contract for nullable monster stats, active defence rows and compact setup summaries
- extended trip-control state to `TripPolicy` mapping without leaking trip fields into `SimulationRequest`
- scarce/AFK Trip controls, inventory reserve details and prayer restore capacity in the UI view model
- domain-backed result, compare and planner view models
- structured money warning view models for price alias and fallback surfacing
- dense compare monster/drop filters, irrelevant monster state, active-target forced visibility and derived row state markers
- special attack result metrics in the UI view model
- numeric summary parity for the default melee fixture and a ranged safespot fixture
- cannon-enabled view-model coverage for visible XP/hr, GP/hr, net GP/hr and supply changes
- linked cannon/sparse assumptions, cannon reserve impact and cannonball supply costs in the UI view model
- a performance smoke test that keeps the immediate level-input calculation path smaller than compare/planner full-panel work
- versioned rewrite setup persistence through `PersistedEnvelope<T>`
- dense compare filter defaults, persisted irrelevant monster state and cleanup of unknown monster ids
- per-combat-type loadout stash/restore, persisted schema validation and active loadout mapping into `SimulationRequest`
- manual combat override persistence/defaulting and bounded domain behavior
- active weapon, gear, ammo and spell selection mapping into `SimulationRequest`, including two-handed weapon shield lock/clear behavior
- rewrite-owned monster-specific custom setup create/restore/remove helpers, persisted schema validation and dense row marker/calculation mapping
- per-monster loot settings for high-alch enablement, kill overhead and talisman spot, with separate persistence from `index-sim:loot-prefs`
- defaulting and sanitization for newly modeled trip-control fields in persisted rewrite setups
- defaulting and sanitization for special attack controls in persisted rewrite setups
- versioned per-monster cannon settings persistence in the rewrite setup envelope
- versioned last-player hiscores and browser-local price history persistence through `PersistedEnvelope<T>`
- browser-local Economy movers analysis, Snapshot now and confirmed Clear history that removes only `index-sim:price-history`
- refusal to implicitly migrate mismatched persisted versions
- validated `PriceSet` import errors
- Playwright smoke for the workbench shell, PlayerSidebar, legacy-order TabBar, right-side MonsterCard rail, mobile MonsterCard ordering, MonsterCard target switch/drop-filter sharing/active defence highlights, dense spreadsheet Compare pane, metric strip, combat-style switching, per-combat-type loadout restore, manual combat override persistence/reset, SetupBar custom setup create/restore/remove, Melee/Ranged/Magic equipment pane edits with searchable selectors and persisted selections, tab-routed special attack controls/metrics, trip survival/food/recoil controls, dense row markers, browser-rendered dense numeric snapshots, browser-rendered metric-strip acceptance snapshots for default melee, ranged safespot, cannon-enabled ranged, loot action override, manual food/prayer trip, imported PriceSet, mocked market sync and compatible legacy import paths, final Cannon tab controls with sparse-link/reset behavior and expanded output snapshots for effective targets, cannon DPS, balls/hr, balls/kill, cannon ranged XP/hr, effective XP/hr, effective net GP/hr, ball costs, cannonballs/trip and K/hr uplift, Planner tab open/metric/current-XP/target/skill-lock/gear-pool/Recompute/training-order/timeline/chart persistence flow, per-monster loot settings persistence, full monster table row count, table sorting, dense compare filters/relevance persistence, row target selection, per-monster cannon controls, Economy price-history controls, mocked hiscores lookup/apply flow and mocked market sync/report/history flow

## Current lightweight checks

Run these for documentation-only or low-risk source edits:

```sh
git diff --check
```

Run these after changing plain `.js` files:

```sh
node --check engine.js
node --check equipment.js
node --check gamedata.js
node --check trip.js
node --check market.js
node --check planner-core.js
```

Run this after changing JSON data files:

```sh
node -e "for (const f of ['prices.json','alch.json','price-history.json']) JSON.parse(require('fs').readFileSync(f,'utf8'))"
```

## What to test by change type

- Documentation-only: `git diff --check`.
- UI-only: syntax checks for affected JS dependencies, manual browser smoke if possible.
- Combat math: `npm run test` and `npm run test:golden`.
- Combat/equipment domain changes: `npm run test`, including `src/tests/domain-core.test.ts`, and `npm run test:golden`. Run `src/tests/trip-loot-supply.test.ts` and `src/tests/xp-parity.test.ts` too when timing, DPS, prayer, recoil or incoming-damage outputs can affect trip or XP results.
- XP calculation or XP row changes: `npm run test -- src/tests/xp-parity.test.ts`, `npm run test`, and `npm run test:golden` when current-behavior parity can change.
- Trip/loot/supply domain changes: `npm run test -- src/tests/trip-loot-supply.test.ts`, `npm run test`, and `npm run test:golden` when current-behavior parity can change. Include `src/tests/xp-parity.test.ts` when `effectiveKph`, recoil, poison or cannon behavior can affect XP/hr.
- Data or prices: JSON parse, `npm run test -- src/tests/data-economy.test.ts`, and representative simulation fixtures when simulation behavior can change.
- Planner: `npm run test -- src/tests/planner-domain.test.ts` for gear eligibility, scoring, stance selection and golden plan fixtures. Run full `npm run test` if planner changes interact with combat, trip, data or economy contracts.
- UI/view-model changes: `npm run test -- src/tests/ui-view-model.test.ts`, `npm run test`, `npm run build` and `npm run test:e2e` when browser behavior changes.
- Performance-sensitive UI/view-model changes: include `src/tests/ui-performance.test.ts` and browser smoke where possible; compare the level-input path and representative compare/planner workloads against the accepted performance budget.
- Market/import logic: unit tests with mocked price sources and malformed data; include `src/tests/ui-adapters.test.ts` for rewrite price imports.
- Live integrations: `npm run test -- src/tests/live-integrations.test.ts src/tests/hiscores-server.test.ts src/tests/hiscores-adapter.test.ts src/tests/hiscores-ui-state.test.ts src/tests/market-sync-items.test.ts src/tests/market-server.test.ts src/tests/market-adapter.test.ts src/tests/market-ui-state.test.ts` plus `npm run test` when shared schemas or API adapters are touched. Use mocked hiscores and market service tests only; do not call live upstream services in automated tests. Cover request validation, allowlisted market item mapping, upstream-invalid responses, partial market failures and UI apply/failure behavior.
- Persistence changes: migration/version tests for `localStorage` keys; include `src/tests/ui-adapters.test.ts` and `src/tests/legacy-migration.test.ts` when legacy key detection or setup/hiscores/price compatibility mapping changes.
- Release/deploy changes: build and smoke test commands once a build system exists.
- Acceptance/security hardening: `npm run typecheck`, `npm run test`, `npm run test:golden`, `npm run build`, `npm run test:e2e`, performance-budget checks, `npm audit`, static risk searches and `git diff --check`.

## Rewrite test strategy

1. Golden fixtures for current behavior.
2. Unit tests for combat formulas, trip model, price-set selection and planner rules.
3. Schema tests for generated data and persisted state.
4. Property tests for bounded math invariants where useful.
5. Playwright smoke tests for the main user workflows.

## Update rule

When `package.json`, CI, build tooling or test files are added, update this document in the same change and make the new commands authoritative.

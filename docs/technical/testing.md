# Testing

## Current state

The latest complete production-preview Chromium gate passed 78/78 on
2026-07-15 after the local startup reliability implementation. Full
`npm run verify` passes 80 test files / 787 unit tests, 19 explicit goldens,
typecheck, the
124-source-module/109-client-reachable-module/eight-external-entrypoint
zero-cycle architecture check, build/artifact budgets, lint, formatting and
diff checks. The 10-file artifact entry is 721,534 raw / 209,167 gzip bytes and
remains inside D-094 budgets; total bytes are 1,976,282 and SHA-256 is
`fa514545d3cfdaf3ddfbe1e4e2b17d0737b57c3dd8e793afa0c7af2056b227e6`.
Earlier functional counts are superseded snapshots recorded in the linked
evidence log. The latest read-only Darwin visual comparison passed 20/20 after
the repository-wide dead-selector cleanup against the same 31 reviewed
fixture-only snapshots. The dedicated visual suite's first sandboxed preview
start returned `listen EPERM` on port 5174; the approved localhost-only
read-only rerun passed without a baseline or configuration write. Baseline
writes remain explicit and require image-diff and privacy review. The
verification gate skipped dependency audit under its network-disabled policy;
the separate current `npm audit --json` run covered 353 dependencies and
reported zero known vulnerabilities.

Detailed dated implementation, release and superseded failure snapshots live in [the testing evidence log](../project/testing-evidence.md); they are evidence, not current command truth.

The functional Playwright, composed view-model and testing-document ownership
split is specified in
[feature-test-suite-split-spec.md](feature-test-suite-split-spec.md). New tests
and guidance go directly to the nearest feature/topic owner; do not recreate the
former catch-all files.

The root app path uses the Vite/React rewrite and has npm scripts for TypeScript, Vite, Vitest, Playwright, ESLint and Prettier. The archived legacy app in `legacy/index.html` still transforms JSX in the browser by Babel Standalone and has no local JSX typecheck/build step.

For interactive local Vitest iteration only, use:

```sh
npm run test:watch
```

Watch mode is a development convenience, not a release or handoff gate.

The D-083 Hit distribution comparison adds focused domain/view-model coverage
for separate miss and accurate-zero outcomes, sustained-roll mixtures,
independent whole-special convolution, probability totals, expected values,
shared normal/special axes, cumulative thresholds and full-target-HP KO
context. Browser coverage owns the vertical bars, normal-only and selected-spec
states, accessible bucket names/exact table and chart-local responsive overflow.
Rates-only Dense/Duel view-model paths explicitly omit chart presentation data.
The calculation-task structured-clone integration case combines Dense, Planner,
Duel and Risk in one test and therefore uses a 15-second runner timeout; this is
test scheduling headroom, not a product performance budget. The separate
`ui-performance.test.ts` suite continues to own the accepted performance
boundaries.

Browser startup and artifact entry size are separate from those CPU tests. Run
the local paired measurement with:

```sh
npm run startup:measure
```

It reports raw samples and medians for cold fresh-context navigation and warm
same-context reload. Timing values are workstation evidence, not merge budgets;
the deterministic raw/gzip entry limits are enforced by artifact validation.

For the development-server startup boundary, run:

```sh
npm run test:startup:dev
```

This check starts a fresh strict-port Vite process, forces bounded dependency
re-optimization, attaches browser diagnostics before first navigation, waits
for the canonical `ready` marker, exercises a controlled pre-React failure and
proves direct JSON/HEAD versus transformed raw-module scheduled-price routing.
It closes its server and browser and calls no live provider. Installed
Playwright Chromium and localhost binding are environment prerequisites, so the
command remains separate from browser-independent `npm run verify`.

Use [rewrite-parity-report.md](rewrite-parity-report.md) to interpret which user-visible calculation areas are currently legacy-parity certified, partially covered or not ported.

Accepted parity policy: legacy results are regression evidence, not the final truth source. Keep golden tests to catch accidental changes, but allow documented intentional deltas when the current accepted LostCityRS/Content revision or another accepted source shows the legacy app should be replaced.

Game revision bumps are development changes, not scheduled data refreshes. The current generator exposes `npm run data:generate` for repository-local source/output-path validation, raw LostCity config/RuneScript parsing, schema-valid output writing and a committed revision-impact report. It writes one current source-backed snapshot at `src/data/generated/game-data.json`; git history and PR diffs provide the review baseline. D-059 makes that committed Revision 274 snapshot the root runtime through `src/adapters/generated`, with scheduled static prices first and generated item fallbacks second. The legacy-derived snapshots remain regression/reference inputs and are not the root bootstrap. Runtime readiness blocks missing expected identities, required simulator fields, monster combat/loot rows and PriceSet coverage; accepted source value changes belong to revision-impact evidence. The current snapshot is ready with zero blockers, the representative suite passes 11/11 cases under D-055/D-057/D-071/D-072, and the 189-evaluation informational scan records 22 advisory outliers. Snapshot validation rejects raw upstream dump shapes, historical snapshot archives and unused source-only content. The raw parser emits NPC size for 63/63 monsters, numeric Attack/Strength/Defence/Ranged/Magic requirements for 94 runtime items and 25 typed conditional loot rows. Planner/setup/quick-action consumers use generated requirements first and D-051 fallback only for legacy/missing rows. Conditional quest/clue rows stay visible but contribute no value, inventory, alch or prayer effect until a separately accepted exact player-state contract can activate them. Do not hand-edit generated source truth, infer quest completion state, activate conditional loot, remove the requirement fallback or refresh accepted calculation baselines without the corresponding evidence and decision.

## Rewrite scaffold commands

The authoritative repository handoff and pre-release gate is:

```sh
npm run verify
```

It reuses the same implementation as `npm run deploy:cloudflare:build` without
requiring a Cloudflare account. It runs the checks below, production artifact
validation, dependency audit when network access is available and
`git diff --check`:

```sh
npm run typecheck
npm run architecture:check
npm run test
npm run build
npm run lint
npm run format:check
```

Playwright and visual suites remain separate environment-dependent gates.

For an account-free Cloudflare bundle check after deployment-shape changes, run:

```sh
npm run deploy:cloudflare:dry-run
```

This reruns typecheck/build/artifact validation and then uses the lockfile-pinned
Wrangler through Node 22 to validate Worker exports, assets, environment values,
the Durable Object binding and its migration without uploading a version.

Node 22 and npm 10 are the repository runtime contract. `.nvmrc`, the root
`package.json` engines and the scheduled workflow use the same major versions.

`npm run architecture:check` scans non-test TypeScript source imports. It
rejects cycles, forbidden layer directions, stale exception entries and any
archived legacy/static runtime path reachable from `src/app/main.tsx`. The
authoritative `npm run verify` gate runs it after typecheck and before tests.
The exact layer policy and current graph facts are owned
by [architecture.md](architecture.md#enforced-dependency-boundaries).

## Detailed test guides

- [Runtime, data and deployment](testing/runtime-data-deployment.md): source audits, generated data, local-state health, market artifacts and deployment validation.
- [Domain and integrations](testing/domain-and-integrations.md): goldens, performance, combat/XP/Trip/Risk/Planner, schemas and same-origin integrations.
- [UI, state and browser](testing/ui-state-and-browser.md): feature view models, persistence, controllers, panes and functional browser coverage.

These linked guides are part of this document's testing ownership. Keep current
commands there, dated run snapshots in the project evidence log and the
cross-cutting minimums below.

## Current lightweight checks

Run these for documentation-only or low-risk source edits:

```sh
git diff --check
```

Run these after changing module boundaries, entrypoints, adapters or barrel
exports:

```sh
npm run typecheck
npm run architecture:check
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
node -e "for (const f of ['prices.json','price-provenance.json','alch.json','price-history.json']) JSON.parse(require('fs').readFileSync(f,'utf8'))"
```

## What to test by change type

- Documentation-only: `git diff --check`.
- Architecture/module boundaries: `npm run typecheck`, `npm run architecture:check`, focused tests for moved imports, `npm run build` and `git diff --check`.
- UI-only: `npm run typecheck`, focused UI/view-model tests, browser smoke when visible behavior changes and `git diff --check`.
- Startup shell, entrypoint, Vite middleware or local-start orchestration: `npm run typecheck`, `npm run architecture:check`, `npm run test -- src/tests/startup-guard.test.ts src/tests/vite-config.test.ts src/tests/deployment-readiness.test.ts`, `npm run test:startup:dev`, `npm run build`, `npm run startup:measure -- --runs 5`, `npm run test:e2e -- --workers=1` and `git diff --check`.
- Combat math: `npm run test` and `npm run test:golden`.
- Combat/equipment domain changes: `npm run test`, including `src/tests/domain-core.test.ts`, and `npm run test:golden`. Run `src/tests/trip-loot-supply.test.ts` and `src/tests/xp-parity.test.ts` too when timing, DPS, prayer, recoil or incoming-damage outputs can affect trip or XP results.
- Composed simulation result contract or main view-model result-source changes: run `npm run typecheck` and `npm run test -- src/tests/full-simulation-result.test.ts src/tests/domain-core.test.ts src/tests/trip-loot-supply.test.ts src/tests/xp-parity.test.ts src/tests/*-view-model.test.ts src/tests/data-economy.test.ts`. This validates the `CombatSimulationResult`/`FullSimulationResult` boundary against current combat, trip, XP, economy and UI view-model evidence without requiring Playwright unless visible UI behavior changes.
- XP calculation or XP row changes: `npm run test -- src/tests/xp-parity.test.ts`, `npm run test`, and `npm run test:golden` when current-behavior parity can change.
- Trip/loot/supply domain changes: `npm run test -- src/tests/trip-loot-supply.test.ts`, `npm run test`, and `npm run test:golden` when current-behavior parity can change. Include `src/tests/xp-parity.test.ts` when `effectiveKph`, recoil, poison or cannon behavior can affect XP/hr.
- Risk/variability changes: `npm run test -- src/tests/risk-analysis.test.ts src/tests/calculation-task.test.ts src/tests/*-view-model.test.ts`, `npm run typecheck`, representative performance coverage and the focused `Risk` Playwright workflow. Run the full unit, golden, build and browser gates before delivery; stochastic tests use fixed seeds and analytic/property tolerances.
- Data or prices: JSON parse, `npm run test -- src/tests/data-economy.test.ts`, and representative simulation fixtures when simulation behavior can change.
- Generated runtime readiness: `npm run test -- src/tests/generated-runtime-adapter.test.ts`, `npm run runtime:readiness -- --example-limit 5`, `npm run runtime:coverage-plan -- --example-limit 5`, `npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts src/tests/trip-loot-supply.test.ts`, `npm run test:golden`, `npm run typecheck` and `git diff --check`. The default readiness command is blocking and must stay green for the active snapshot. Use `--allow-not-ready` only for deliberate incomplete local candidates. Rerun full domain/golden/browser evidence for generated snapshot value or bootstrap changes.
- Planner: `npm run test -- src/tests/planner-domain.test.ts` for gear eligibility, scoring, stance selection and golden plan fixtures. Run full `npm run test` if planner changes interact with combat, trip, data or economy contracts.
- UI/view-model changes: `npm run test -- src/tests/*-view-model.test.ts`, `npm run test`, `npm run build` and `npm run test:e2e` when browser behavior changes.
- Performance-sensitive UI/view-model changes: include `src/tests/ui-performance.test.ts` and browser smoke where possible; compare the level-input path and representative compare/planner workloads against the accepted performance budget.
- Market/import logic: unit tests with mocked price sources and malformed data; include `src/tests/ui-adapters.test.ts` for rewrite price imports and `src/tests/market-ui-state.test.ts` for selected active `PriceSet` persistence, restore and failure behavior.
- Manual item-price overlay: include `src/tests/market-ui-state.test.ts`, `src/tests/local-state-health.test.ts` and the focused Economy Playwright draft/base-change/reload/reset/capacity workflow. Confirm the base PriceSet and high-alch values are unchanged, item metadata becomes manual, unavailable stored ids stay inactive without deletion, a draft cannot move with the separate Trend item selector, the 512-row guard is non-throwing, the local key clears after the final reset and calculated consumers receive a new composed PriceSet identity.
- Conditional loot presentation: include `src/tests/*-view-model.test.ts` plus the focused Loot Playwright disclosure workflow. Confirm conditional rows remain locked/zero in the view model, are absent from the ordinary action table, and expose source chance plus sanitized eligibility only after the collapsed disclosure is opened.
- Live integrations: `npm run test -- src/tests/live-integrations.test.ts src/tests/hiscores-server.test.ts src/tests/hiscores-adapter.test.ts src/tests/hiscores-ui-state.test.ts src/tests/hiscores-lookup-controller.test.ts src/tests/market-sync-items.test.ts src/tests/market-server.test.ts src/tests/market-adapter.test.ts src/tests/market-ui-state.test.ts` plus `npm run test` when shared schemas or API adapters are touched. Use mocked hiscores and market service tests only; do not call live upstream services in automated tests. Cover request validation, allowlisted market item mapping, upstream-invalid responses, request races, partial market failures and UI apply/failure behavior.
- Persistence changes: migration/version tests for `localStorage` keys; include `src/tests/ui-adapters.test.ts` and `src/tests/market-ui-state.test.ts` for price selection/history keys, and include `src/tests/legacy-migration-*.test.ts` when legacy key detection or setup/hiscores/price compatibility mapping changes.
- Release/deploy changes: `npm run typecheck`, focused Worker/deployment tests, `npm run build`, `npm run deploy:verify-artifact` and `npm run deploy:smoke` against an approved preview origin when deployed evidence is in scope.
- Acceptance/security hardening: `npm run typecheck`, `npm run test`, `npm run test:golden`, `npm run build`, `npm run test:e2e`, performance-budget checks, `npm audit`, static risk searches and `git diff --check`.

## Rewrite test strategy

1. Golden fixtures for current behavior.
2. Unit tests for combat formulas, trip model, price-set selection and planner rules.
3. Schema tests for generated data and persisted state.
4. Property tests for bounded math invariants where useful.
5. Playwright smoke tests for the main user workflows.

## Update rule

When `package.json`, CI, build tooling or test files are added, update this document in the same change and make the new commands authoritative.

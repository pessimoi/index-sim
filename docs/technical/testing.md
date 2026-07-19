# Testing

## Current state

The current 2026-07-19 integration gate passes `npm run verify`: 94 Vitest files
/ 935 tests, 19 explicit goldens, typecheck, the 145-source-module/
130-client-reachable-module/eight-external-entrypoint zero-cycle architecture
check, build/artifact budgets, lint, formatting and diff checks are green. The
14-file/two-asset artifact has seven JavaScript chunks, totals 2,215,181 bytes
and has SHA-256
`b15dd9b9400b28401768b77d1513216fdb61d45597f71d09f8c0928df677f26f`;
its direct entry is 788,136 raw / 228,803 gzip bytes and remains inside the
D-098-rebased D-094 budgets. The complete production-preview Chromium gate
passes 98/98 with one worker.

The explicitly reviewed Darwin baseline passes 20/20 against 31 fixture-only
snapshots. The language/unit/hierarchy pass updated 15 inspected images for
root/MonsterCard, Dense Compare, Loot, Economy, Planner mobile, Duel mobile and
Settings; the integrated Settings image also contains the previously reviewed
Workspace section. A full read-only run after the explicit update passes 20/20
without clipping, widening, lost controls, numeric drift or private fixture
content. The verification gate skipped dependency audit under its
network-disabled policy; the dated separate audit evidence remains in the
linked log.

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

Game revision bumps are development changes, not scheduled data refreshes. The current generator exposes `npm run data:generate` for repository-local source/output-path validation, raw LostCity config/RuneScript parsing, schema-valid output writing and a committed revision-impact report. Raw production generation requires explicit bounded `--game-revision`; the current reviewed value is `274`. It writes one matching revision/source/commit/generated-at context to `src/data/generated/game-data.json` and `source-pin.json`, validates their agreement and records the input in the impact report command. Git history and PR diffs provide the review baseline. D-059 makes that committed Revision 274 snapshot the root runtime through `src/adapters/generated`, with scheduled static prices first and generated item fallbacks second. The legacy-derived snapshots remain regression/reference inputs and may omit context; they are not the root bootstrap. Runtime readiness blocks missing/invalid revision context, missing expected identities, required simulator fields, monster combat/loot rows and PriceSet coverage; the report script also blocks committed snapshot/source-pin disagreement. Accepted source value changes belong to revision-impact evidence. The current snapshot is ready with zero blockers, the representative suite passes 11/11 cases under D-055/D-057/D-071/D-072, and the refreshed 189-evaluation informational scan finds 38 advisory outliers with the configured first 25 shown. Snapshot validation rejects raw upstream dump shapes, historical snapshot archives and unused source-only content. The raw parser emits NPC size for 63/63 monsters, numeric Attack/Strength/Defence/Ranged/Magic requirements for 94 runtime items and 25 typed conditional loot rows. Planner/setup/quick-action consumers use generated requirements first and D-051 fallback only for legacy/missing rows. Conditional quest/clue rows stay visible but contribute no value, inventory, alch or prayer effect until a separately accepted exact player-state contract can activate them. Do not hand-edit generated source truth, infer quest completion state, activate conditional loot, remove the requirement fallback or refresh accepted calculation baselines without the corresponding evidence and decision.

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
- Local-state attention surface: include `src/tests/local-state-attention.test.tsx`, `src/tests/local-state-recovery-controller.test.ts` and `src/tests/local-state-health.test.ts`, plus focused persistence/migration Playwright coverage. Prove healthy absence, structured stored-data/persistence/mixed copy, bounded labels, metadata privacy, Settings heading focus, clear resolution, runtime save failure and unsupported-envelope preservation.
- Setup replacement review and Undo: include `src/tests/setup-file-transfer-controller.test.ts`, `src/tests/setup-import-review.test.tsx`, share/setup-state coverage and focused import plus saved-setup Playwright transactions. Prove preparation has no mutation authority, latest request wins, review output is resolved and bounded, Dismiss/stale consume are no-ops, Apply covers all six setup families, durable/session-only Undo restores the complete prior setup and saved-row Load preserves the saved collection and current target.
- Active setup reset: follow [the implemented reset contract](active-setup-reset-spec.md) with `active-setup-reset.test.ts`, `active-setup-reset-review.test.tsx`, `ui-adapters.test.ts`, `planner-ui-state.test.ts` and the `Reset active setup` Playwright transactions in `e2e/loadout.spec.ts`. Prove target/style/mode preservation, reset of all three style caches, correct Default/current-target Custom ownership, no mutation before Confirm, stale/no-op safety, one complete durable/session-only Apply/Undo and non-interference with Duel/custom collections, Dense, Cannon, loot, PriceSet, manual prices, histories and Hiscores.
- Shared numeric inputs: include `src/tests/numeric-field-core.test.ts`, `src/tests/numeric-field-components.test.tsx` and the focused `numeric input` Playwright workflow. Prove literal required/decimal drafts, no integer truncation or decimal rounding, inclusive bounds and step checks, optional commit/Reset semantics, Enter/Escape/invalid blur, accessible feedback, external focused-draft cancellation and narrow viewport containment. Run `npm run numeric:audit` and `npm run test:golden` because every main workflow consumes the shared fields.
- Startup shell, application error boundary, entrypoint, Vite middleware or local-start orchestration: `npm run typecheck`, `npm run architecture:check`, `npm run test -- src/tests/application-error-boundary.test.tsx src/tests/startup-guard.test.ts src/tests/local-state-recovery-controller.test.ts src/tests/vite-config.test.ts src/tests/deployment-readiness.test.ts`, `npm run test:startup:dev`, `npm run build`, `npm run startup:measure -- --runs 5`, `npm run test:e2e -- --workers=1` and `git diff --check`. For error-boundary changes, keep bootstrap failure, post-ready render and lifecycle failures, raw error/stack exclusion, tab-scoped memory isolation and preservation of the original local data as separate assertions.
- Combat math: `npm run test` and `npm run test:golden`.
- Combat/equipment domain changes: `npm run test`, including `src/tests/domain-core.test.ts`, and `npm run test:golden`. Run `src/tests/trip-loot-supply.test.ts` and `src/tests/xp-parity.test.ts` too when timing, DPS, prayer, recoil or incoming-damage outputs can affect trip or XP results.
- Composed simulation result contract or main view-model result-source changes: run `npm run typecheck` and `npm run test -- src/tests/full-simulation-result.test.ts src/tests/domain-core.test.ts src/tests/trip-loot-supply.test.ts src/tests/xp-parity.test.ts src/tests/*-view-model.test.ts src/tests/data-economy.test.ts`. This validates the `CombatSimulationResult`/`FullSimulationResult` boundary against current combat, trip, XP, economy and UI view-model evidence without requiring Playwright unless visible UI behavior changes.
- XP calculation or XP row changes: `npm run test -- src/tests/xp-parity.test.ts`, `npm run test`, and `npm run test:golden` when current-behavior parity can change.
- Trip/loot/supply domain changes: `npm run test -- src/tests/trip-loot-supply.test.ts`, `npm run test`, and `npm run test:golden` when current-behavior parity can change. Include `src/tests/xp-parity.test.ts` when `effectiveKph`, recoil, poison or cannon behavior can affect XP/hr.
- Risk/variability changes: `npm run test -- src/tests/risk-analysis.test.ts src/tests/calculation-task.test.ts src/tests/*-view-model.test.ts`, `npm run typecheck`, representative performance coverage and the focused `Risk` Playwright workflow. Run the full unit, golden, build and browser gates before delivery; stochastic tests use fixed seeds and analytic/property tolerances.
- Data or prices: JSON parse, `npm run test -- src/tests/data-economy.test.ts`, and representative simulation fixtures when simulation behavior can change.
- Generated runtime readiness: `npm run test -- src/tests/generated-runtime-adapter.test.ts`, `npm run runtime:readiness -- --example-limit 5`, `npm run runtime:coverage-plan -- --example-limit 5`, `npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts src/tests/trip-loot-supply.test.ts`, `npm run test:golden`, `npm run typecheck` and `git diff --check`. Prove explicit generator revision input, no-write failure when it is absent, snapshot/source-pin agreement, generic legacy omission support and root/readiness rejection of missing context. The default readiness command is blocking and must stay green for the active snapshot. Use `--allow-not-ready` only for deliberate incomplete local candidates. Rerun full domain/golden/browser evidence for generated snapshot value or bootstrap changes.
- Game revision presentation: include `src/tests/settings-view-model.test.ts`, `src/tests/app-shell-components.test.tsx`, `src/tests/economy-settings-pane.test.ts` and the focused `Revision 274 context` production-preview path. Prove exact badge/accessibility text, full wrapping snapshot id, short-plus-full source commit, generated timestamp, active-PriceSet semantics, no source path/command leakage and narrow viewport containment.
- Contextual setup transfers: include `src/tests/setup-transfer-context.test.ts`, `src/tests/setup-import.test.ts`, `src/tests/setup-file-transfer-controller.test.ts`, `src/tests/setup-import-review.test.tsx`, `src/tests/shareable-setup.test.ts`, `src/tests/ui-adapters.test.ts`, app-shell/Duel presentation suites and focused setup/saved-setup/share Playwright transactions. Prove exact/same-revision/different-revision/id-conflict/unknown comparison, strict bounded context, new setup-v1/saved-setup-v1/share-v2 output, setup-v3/saved-setup-v1/share-v1 reads, no mutation before Apply/Merge/Load, Dismiss and Undo behavior, current-recipient PriceSet/runtime ownership, active entity rejection for every class and exclusion of prices/player/computed/raw provenance. Browser persistence versions must remain setup v3 and Duel v1.
- Workspace bounded envelope and registry: include `src/tests/workspace-backup.test.ts` and `src/tests/local-state-health.test.ts`. Prove exhaustive policy for all eleven health descriptors, nine required transfer records, default Hiscores exclusion and explicit normalized opt-in, permanent migration-dismissal exclusion, canonical `PriceSet | null`, one Revision/snapshot context, strict outer and area objects, closed id/version dispatch, duplicate-key/area and unsafe-key rejection, fixed raw-free unsupported/malformed area results, UTF-8 byte enforcement and a sanitized filename. This slice provides synthetic state-layer evidence only; review, compatibility, Replace/Merge, browser file handling, atomic persistence, session-only Apply and Undo require their later controller/browser gates.
- Workspace safe export and Review-before-restore: add `src/tests/workspace-backup-controller.test.ts`, `src/tests/workspace-backup-panel.test.tsx`, `src/tests/economy-settings-pane.test.ts` and the focused `Workspace backup` Chromium path. Prove coherent validated live-state export through the selected `BrowserStorageAccess`, default Hiscores exclusion plus non-persisted opt-in, 10 MB browser/parser bounds, latest-request-wins, fixed raw/path-free errors, all area/version/context summaries, current entity compatibility, Hiscores restore default-off, exact candidate Dismiss, same-file input reset and focus return. The browser case must compare sorted localStorage bytes and a visible live value before review and after Dismiss. This preparation boundary has no Apply authority.
- Workspace area restore planning: add `src/tests/workspace-restore-plan.test.ts` to the Workspace controller/panel suites and run the focused `Workspace backup|workspace restore` Chromium paths. Prove all ten Replace outcomes, the six registry-authorized Merge policies, four Replace-only mode rejections, exact add/update/skip/replace/retain/drop counts, Duel/history caps, manual-price overflow rejection, duplicate identities, generated high-alch authority, null selected-PriceSet fallback, manual overlay without history append, exact/same/different Revision, setup/Duel/Planner/Loot incompatibility, stale review ids, zero selection, Hiscores recipient opt-in and unselected-area retention. Browser evidence must cover mixed Merge with unrelated current rows, native keyboard selection/mode controls and disabled incompatible rows. Plan construction remains mutation-free; its accepted values and intents feed only the executor described next.
- Workspace atomic Apply/Undo: include `src/tests/workspace-restore-executor.test.ts`, `src/tests/local-state-recovery-controller.test.ts`, all Workspace state/controller/panel/plan suites and relevant setup, Duel, Planner, Loot, PriceSet, price-history, manual-price, Hiscores and application-recovery owners. Prove exhaustive registry order independent of file order, complete preflight before writes, nth-write/nth-clear exact reverse rollback, affected-id attention on rollback failure, no live mutation before durable success, selected-only unblock/failure clearing, single health refresh, one-shot persistence suppression, explicit storage-unavailable/safe-rollback session Apply, selected-memory-storage isolation, exact raw durable Undo, live-only session Undo, failed-Undo rollback, stale/double Apply, composed PriceSet/manual state with no history append, selected-only Hiscores and untouched migration dismissal. The production-preview command `npm run test:e2e -- --workers=1 --grep "Workspace backup|workspace restore|workspace multi-area|workspace storage failure"` must pass all five cases; compare sorted durable bytes around review, Apply failure, session-only Apply and Undo. Run the read-only `Settings desktop` visual comparison when the layout changes, then `npm run verify` and `git diff --check`. This evidence proves handled-operation logical rollback only, not crash atomicity.
- Planner: `npm run test -- src/tests/planner-domain.test.ts` for gear eligibility, scoring, stance selection and golden plan fixtures. Run full `npm run test` if planner changes interact with combat, trip, data or economy contracts.
- Planner XP/target integrity: include `src/tests/planner-ui-state.test.ts`, `src/tests/planner-ui-adapter.test.ts`, `src/tests/planner-controller.test.ts` and `src/tests/planner-pane.test.ts`. Prove XP bounds at levels 1/98/99, Auto and explicit boundary semantics, deterministic reconciliation/no-op identity, locked-target preservation, effective adapter/row equality, last-computed reconciliation and stale-result rejection. Production-preview coverage must include manual and Hiscores level changes plus saved/imported/shared setup Load/Undo paths without weakening explicit Recompute.
- Duel matrix lifecycle: include `src/tests/compare-duel-controllers.test.ts`, `src/tests/compare-duel-panes.test.ts` and `src/tests/calculation-task.test.ts`, plus the focused `Duel matrix failures` production-preview path. Prove exact idle/building/ready/stale/failed precedence over all six source references, duplicate-build blocking, previous-output retention and labelling, fixed failure privacy, Retry, obsolete-task cancellation, late-settlement rejection, zero-snapshot reset and unchanged filter/metric/sort behavior. Run goldens because the retained table still carries calculated combat, XP and economy output even though this contract changes no formula.
- Dense/Planner/Risk calculation lifecycle: include `src/tests/compare-duel-controllers.test.ts`, `src/tests/compare-duel-panes.test.ts`, `src/tests/planner-controller.test.ts`, `src/tests/planner-pane.test.ts`, `src/tests/risk-controller.test.ts`, `src/tests/risk-pane.test.ts` and `src/tests/calculation-task.test.ts`, plus `src/tests/e2e/calculation-lifecycle.spec.ts`. Prove exact idle/building/ready/stale/failed precedence, first and refresh failures, labelled previous output, fixed-copy privacy, explicit Retry, exact source freshness, obsolete-task cancellation, late-settlement rejection and the fresh-only Risk bridge. Run goldens because retained Dense rows and Planner/Risk output still carry calculated values even though this contract changes no formula.
- UI/view-model changes: `npm run test -- src/tests/*-view-model.test.ts`, `npm run test`, `npm run build` and `npm run test:e2e` when browser behavior changes.
- Performance-sensitive UI/view-model changes: include `src/tests/ui-performance.test.ts` and browser smoke where possible; compare the level-input path and representative compare/planner workloads against the accepted performance budget.
- Market/import logic: unit tests with mocked price sources and malformed data; include `src/tests/ui-adapters.test.ts` for rewrite price imports and `src/tests/market-ui-state.test.ts` for selected active `PriceSet` persistence, restore and failure behavior.
- Full PriceSet transfer presentation: include the focused transfer-controller, Economy/Settings pane and app-header component tests plus Playwright coverage for the one collapsed Market disclosure, global/Settings duplicate removal, export-to-import round trip, non-merge guidance, recoverable invalid files and compact/mobile containment.
- Manual item-price overlay: include `src/tests/market-ui-state.test.ts`, `src/tests/local-state-health.test.ts` and the focused Economy Playwright draft/base-change/reload/reset/capacity workflow. Confirm the base PriceSet and high-alch values are unchanged, item metadata becomes manual, unavailable stored ids stay inactive without deletion, a draft cannot move with the separate Trend item selector, the 512-row guard is non-throwing, the local key clears after the final reset and calculated consumers receive a new composed PriceSet identity.
- Contextual item-price correction: include `src/tests/price-data-view-model.test.ts`, `src/tests/loot-view-model.test.ts`, `src/tests/app-shell-components.test.tsx`, `src/tests/economy-settings-pane.test.ts` and the focused Result-to-Economy-to-Apply Playwright transaction. Prove exact structured item-id routing from Result, Loot and Economy, one-shot focus on `Manual price`, direct Result correction only for one unambiguous target, aggregate disclosure review for multiple targets, immediate manual-value use plus Reset feedback and unchanged D-090/D-102 persistence and advanced-tool boundaries.
- User-facing language, units and Settings/Economy hierarchy: include `src/tests/presentation-language.test.ts`, the Price/Loot/MonsterCard/Settings view-model and pane suites, shared shell/component tests and the Economy/Loot/Cannon/Trip/Dense functional paths. Prove source/snapshot/row/fallback name precedence, separately labelled exact technical ids, singular/plural time units, game-tick versus derived-second ownership, uppercase GP/XP, full accessible compact labels and one state-neutral focus-correct `Review in Economy` intent. Run the complete functional Chromium and read-only visual matrices because shared presenters and unit spacing affect multiple panes; baseline writes require the explicit review policy in `visual-regression-spec.md`. This is semantic browser evidence, not screen-reader certification or a WCAG-conformance claim.
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

# Testing

## Current state

The current 2026-07-21 combined gate evidence covers 118 Vitest files / 1,136
tests, 19 explicit goldens, typecheck, lint, formatting, the 178-source-module/
164-client-reachable-module/eight-external-entrypoint zero-cycle architecture
check and build/artifact budgets. The clean cumulative `npm run verify` rerun is
green. The current 29-file artifact has 22 JavaScript chunks, 2,442,848 total
bytes and SHA-256
`bfd472aaa26e64a913d3839ac6576ada69d3b303712b2171bf3a893c89fa93d3`;
its direct entry is 277,198 raw / 83,815 gzip bytes and remains inside the D-098
budgets. PF-06's named Workbench history transaction passes 1/1 in Chromium,
its focused CB-09 extension passes 3/3 and the complete release manifest passes
36/36 across Playwright Firefox, desktop WebKit and iPhone 13-emulated WebKit.

The explicitly reviewed Darwin baseline now contains 26 scenarios and 37
fixture-only snapshots. The six-goal release-readiness review changed exactly
10 Loot, Economy, Planner-mobile and Settings-owned PNGs after inspecting every
candidate and later capture. It also narrowed the Loot sticky-header selector
after the first review exposed a nested-row occlusion. Two complete read-only
runs after the scoped update pass 26/26 and 26/26 without clipping, widening,
lost controls, unexplained numeric drift or private fixture content.
The verification subprocess skips dependency audit under its network-disabled
policy; the immediately following escalated `npm audit` reports zero
vulnerabilities.

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

Install the lockfile-matched browser engines and run the browser release gates
with:

```sh
npx playwright install chromium firefox webkit
npm run test:e2e
npm run test:e2e:cross-browser
npm run test:e2e:release
npm run test:e2e:visual
```

`test:e2e` remains the complete Chromium functional owner.
`test:e2e:cross-browser` serves one production preview on port 5176 and runs
only CB-01 through CB-12 serially in Firefox, desktop WebKit and iPhone 13
WebKit emulation. `test:e2e:release` composes the two functional commands; the
read-only Darwin visual suite remains a separate gate. Missing browser binaries
must fail with Playwright's install instruction rather than skip. Playwright
WebKit and device emulation are not branded Safari or physical-iOS evidence.

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
- Cross-tab local-state conflict safety: include `src/tests/cross-tab-conflicts.test.ts`, `src/tests/cross-tab-conflict-panel.test.tsx`, `src/tests/local-state-attention.test.tsx`, `src/tests/local-state-recovery-controller.test.ts`, transaction-owner regressions and `src/tests/e2e/cross-tab-conflict.spec.ts`. Run `npm run test:e2e -- --workers=1 --grep "another tab|cross-tab conflict"` with a real two-page browser context. Prove the exhaustive ten-area registry, exact baseline advancement, ignored/duplicate/coalesced events, missed-event write guards, per-area suspension, raw-private invalid/unsupported state, fresh reload-based Use, verified Keep rollback and postimage-guarded Undo. Browser evidence must show one tab retaining the newer durable setup while the stale tab can keep editing in memory, Settings focus and Workspace rescue remain available, and neither event URLs nor raw payloads enter presentation. This is local-browser evidence, not atomic locking or multi-device synchronization.
- Browser JSON export outcomes: include `src/tests/browser-download.test.ts`, `src/tests/duel-file-transfer.test.ts` and the setup, PriceSet, Workspace and recovery controller suites. Prove one pretty serialization, exact MIME/name/byte count, a connected non-focusable anchor, synchronous click, immediate DOM removal, delayed one-shot URL revoke, closed serialization/browser-API/dispatch failure and raw-error non-disclosure. Production-preview coverage must observe real download events and exact started copy for setup, saved setups, PriceSet, Workspace and recovery files, inspect their existing privacy/schema boundaries and inject one synchronous browser-API failure. The browser evidence proves request dispatch only, not final filesystem persistence.
- Duel-only legacy import readiness: include `src/tests/legacy-migration-view-model.test.ts`, `src/tests/legacy-migration-setup.test.ts`, `src/tests/ui-adapters.test.ts` and the Duel-only transaction in `src/tests/e2e/persistence-migration.spec.ts`. Prove non-empty plan-derived readiness, singular/plural area count independent of field audit count, defensive empty Duel non-actionability, inspector cap/collision/skips and the existing merge transaction. Browser evidence must seed no top-level active setup field, preserve the current rewrite setup and legacy key, persist/display the saved setup, dismiss the review and retain the result across reload.
- Assistive-technology accessibility: `src/tests/e2e/accessibility-manifest.ts` owns the exact AT-01 through AT-12 fixtures, entry points, outcomes, announcements, automated checkpoints and manual steps. Run `npm run test -- src/tests/accessibility-manifest.test.ts src/tests/searchable-select-field.test.tsx src/tests/numeric-field-components.test.tsx src/tests/app-shell-components.test.tsx`, `npm run test:a11y`, the complete functional Chromium suite and the read-only visual suite. The dedicated accessibility config builds and serves a deterministic production preview on port 5174; axe runs WCAG 2 A/AA, 2.1 A/AA and 2.2 AA tags and fails every undispositioned impact without broad exclusions. The separate 320 CSS-pixel / 200% text case owns automated reflow, while [the manual runbook](testing/accessibility-manual.md) owns required VoiceOver/Safari plus NVDA/browser evidence. A passing npm command is not screen-reader evidence or certification.
- Cross-browser release support: `src/tests/e2e/cross-browser-release.spec.ts` owns CB-01 through CB-12 and `playwright.cross-browser.config.ts` owns only the `firefox`, `webkit` and `webkit-mobile` projects. Prove all pane chunks, representative module-Worker calculations, numeric/native/searchable inputs, setup/Duel/Loot/PriceSet/Planner reload state, invalid-state recovery, keyboard-triggered setup/Workspace downloads with focus retention, Share hash/dialog/fallback, mocked same-origin integrations, keyboard navigation, 390 px containment, two-page storage resolution and sanitized pane failure. Every HTTP(S) origin outside the preview and every unexpected console/page error fails the manifest. Use one worker for the durable gate; a one-time full Firefox/WebKit discovery audit may be broader but its failures and dispositions belong in testing evidence. Do not infer branded Safari, physical iOS, Edge, ESR or historical-version support from Playwright projects.
- Lazy pane loading and failure isolation: include `src/tests/pane-delivery.test.tsx`, `src/tests/application-error-boundary.test.tsx`, `src/tests/app-shell-components.test.tsx`, `src/tests/economy-settings-pane.test.ts` and `src/tests/e2e/pane-delivery.spec.ts`. Prove the exhaustive family map, Compare-only initial lazy request, monotonic/shared family activation, named active and silent hidden loading, sanitized loader failure with Reload only, post-load subtree Retry/focus return, mounted control state, one feature request per family, exact saved-storage preservation and nested Workspace sibling survival. Run `npm run startup:measure -- --runs 5` to capture separate shell/initial-pane JavaScript checkpoints, then run typecheck, architecture, build, artifact verification, complete functional Chromium and read-only visual gates. Do not treat workstation startup samples as universal latency SLAs or claim fewer total artifact bytes.
- Setup replacement review and Undo: include `src/tests/setup-file-transfer-controller.test.ts`, `src/tests/setup-import-review.test.tsx`, share/setup-state coverage and focused import plus saved-setup Playwright transactions. Prove preparation has no mutation authority, latest request wins, review output is resolved and bounded, Dismiss/stale consume are no-ops, Apply covers all six setup families, durable/session-only Undo restores the complete prior setup and saved-row Load preserves the saved collection and current target.
- Setup transfer complete change review: include `src/tests/setup-transfer-changes.test.ts` with the setup import, share, saved-change, Duel and app-shell suites, then run the named `reviews every setup transfer change` Chromium transaction. Prove every parsed form leaf is explicitly classified once, all 13 setup-file groups remain complete, shared links reuse the eight form groups plus exact incoming-target cannon/loot groups and saved-row Load reuses the form registry while keeping calculated Duel impact separate. Exercise per-flow included/excluded disclosure, stable disambiguated Loot row ids, applicable stale plus synchronous Apply/Load blocking, same-candidate/id Refresh, PriceSet-excluded non-staleness for file/share, no-op without Undo, unchanged complete Apply/Load/Undo transactions, Dismiss focus, keyboard actions, 390 px and compact-landscape containment.
- Active setup reset: follow [the implemented reset contract](active-setup-reset-spec.md) with `active-setup-reset.test.ts`, `active-setup-reset-review.test.tsx`, `ui-adapters.test.ts`, `planner-ui-state.test.ts` and the `Reset active setup` Playwright transactions in `e2e/loadout.spec.ts`. Prove target/style/mode preservation, reset of all three style caches, correct Default/current-target Custom ownership, no mutation before Confirm, stale/no-op safety, one complete durable/session-only Apply/Undo and non-interference with Duel/custom collections, Dense, Cannon, loot, PriceSet, manual prices, histories and Hiscores.
- Global Undo visibility and targeted Reset recovery: follow [the implemented contract](global-undo-visibility-targeted-reset-spec.md) with `src/tests/app-shell-components.test.tsx`, active-assumption/simulation/Loot/UI-state coverage and focused production-preview transactions. Prove one interactive pending surface, duplicate-live-announcement suppression, latest-action replacement, no-op preservation and exact restore for all seven Reset classes through both Active assumptions and mirrored pane entry points. Exercise 390 x 844, 620 x 844, 768 x 1024, 640 x 360 and desktop viewports; prove sticky normal-flow reachability, compact scroll-owner retention, local-state-attention coexistence, persistence/recovery truth and bounded visual changes before running the complete functional suite.
- Monster-specific changes management: follow [the implemented Settings contract](monster-specific-changes-management-spec.md) with focused inventory/candidate/panel coverage, `src/tests/settings-view-model.test.ts`, `src/tests/economy-settings-pane.test.ts` and the shared Workspace batch/executor suite. Prove the exhaustive five-kind per-monster union, source-backed summaries, category Review target/focus routing, target-scoped stale/no-op review and active-Custom fallback behavior. Durable one-monster cleanup must preflight and batch only changed rewrite-setup/Loot areas, reverse-roll back exact raw/missing preimages on every injected failure and expose explicit session-only Apply/Undo only after safe rollback; retain Workspace behavior. Exercise populated/empty/unavailable rows and desktop, 640 x 360, 390/620/768 containment, review only owning Settings visual diffs, then run the complete functional suite.
- Local price-history lifecycle management: follow [the implemented Economy contract](local-price-history-lifecycle-management-spec.md) with `src/tests/market-ui-state.test.ts`, focused occurrence/candidate/view-model/pane tests, `src/tests/economy-data-undo.test.ts`, PriceSet transfer, local recovery and Workspace executor coverage. Prove local-only rows, duplicate-key occurrence targeting, chronological oldest selection, visible `N/20` capacity, direct under-cap Save, non-silent full automatic capture and stale-safe removal/replacement reviews. Direct commits must preserve exact raw/null Undo, clear the final row, suppress the next persistence effect and distinguish durable from session-only failure without touching blocked raw data; shared history and combined Economy/Loot analysis remain intact. Exercise desktop, 640 x 360 and 390/620/768 containment, review only owning Economy visual diffs, then run the complete functional suite.
- Planner warning completeness and actions: follow [the implemented Planner contract](planner-warning-completeness-actions-spec.md) with `src/tests/planner-domain.test.ts`, `src/tests/planner-notices.test.ts`, `src/tests/calculation-task.test.ts`, `src/tests/planner-controller.test.ts`, `src/tests/planner-pane.test.ts`, `src/tests/planner-notice-actions.test.tsx`, `src/tests/price-data-view-model.test.ts` and cross-tab browser coverage. Prove item metadata, start/display/training occurrence collection, structured deduplication, exhaustive current-code registration, unknown-code fallback, truncation presentation, deterministic counts/ids and more than four fully rendered rows. Exercise native issue/note disclosure state, current versus retained previous scope, bounded one-time announcements and exact Planner/gear/Loadout/manual-price/Market/Trip focus routes including stale targets; navigation alone must not mutate, persist, recompute or replace Undo. Use deterministic local fixtures, run focused production-preview lifecycle/action transactions without live providers, exercise desktop, 640 x 360 and 390/620/768 containment, review only owning visual diffs, then run architecture, golden and complete functional gates.
- Saved setup Merge and rename safety: follow [the implemented Setups contract](saved-setup-merge-rename-safety-spec.md) with `src/tests/saved-setup-merge.test.ts`, `src/tests/saved-setup-changes.test.ts`, `src/tests/duel-pane-actions.test.tsx`, `src/tests/ui-adapters.test.ts`, `src/tests/duel-view-model.test.ts`, `src/tests/compare-duel-panes.test.ts`, Local state recovery and Workspace/legacy/context regressions. Prove stable ID identity, operation-level unique names with existing-duplicate compatibility, deterministic unchanged/replacement/add/capacity planning, default Keep plus explicit Replace/diff, selectable capacity, recipient-name validation, zero-mutation Dismiss and non-rebased stale Refresh. Direct rename is controlled Save/Cancel with no blur commit; durable/session Merge and rename write/verify/rollback the one Duel v1 key, suppress one persistence effect, expose exact-raw/live guarded Undo and preserve newer values on mismatch. The deterministic Chromium transactions cover focus, source diff, exact raw Undo, stale Refresh, reload and 390 x 844 containment; retain desktop, 640 x 360 and 620/768 coverage in the complete browser/visual release run. Run Workspace/legacy/context, architecture, golden and complete functional gates without live providers.
- User-friendly price dates and times: follow [the implemented presentation contract](price-date-time-presentation-spec.md) with `src/tests/price-time.test.ts`, `src/tests/price-time-component.test.tsx`, `src/tests/price-history-charts.test.tsx`, `src/tests/price-data-view-model.test.ts`, `src/tests/economy-settings-pane.test.ts` and focused Loot/lifecycle/data regressions. Prove exact `en-GB` output in explicit IANA zones, UTC fallback, instant versus date-only precision, signed past/future age boundaries, invalid/missing fallback, semantic capture/creation/observation/evaluation/manual labels and canonical `<time dateTime>` markup with no ordinary raw ISO output. Functional and visual Playwright projects set `timezoneId: "UTC"`; pure tests own Europe/Helsinki winter/summer DST, and the fixed clock proves the minute tick updates the lightweight summary rather than the memoized mover/trend analysis. Exercise Market, compact Settings, manual price, selected provenance, snapshot selectors/summaries, trend point/SVG/sparkline accessibility, local lifecycle rows and Loot history at desktop, 640 x 360 and 390/620/768 viewports; review only owned visual diffs, then run architecture, golden, build, complete functional and diff gates without live providers.
- Default/custom setup mode and autosave clarity: follow [the implemented contract](setup-mode-autosave-clarity-spec.md) with direct app-shell view-model/component coverage, local-state recovery controller cases and focused `e2e/loadout.spec.ts` transactions. Prove the three action-availability states, no generic disabled `Edit`, exact Default/current-monster Custom write-through and isolation, explicit owner switching, target-selection preference, removal/reset/replacement Undo non-regression, durable reload, safe-session `Session only`, injected `Could not save` plus successful retry and an exact-current-value `Saved locally` claim. When changing conditional component ownership, include reset, setup import, share, legacy-migration, invalid-local-state and cross-tab paths so an on-demand boundary cannot hide a transaction or heading regression. Run the read-only visual suite because longer setup actions and persistent mode/save copy change the shared workbench shell.
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
- Session-only exit protection: include `src/tests/session-only-exit-protection.test.tsx` with application recovery, local-state recovery, Workspace state/controller/panel, cross-tab and shell suites. Prove mode-without-edit, canonical edit/revert, durable and session-only outcomes, exact included acknowledgement, sensitive omission, failed request, post-backup re-arm and stable listener add/remove plus `preventDefault`/`returnValue`. Run `npm run test:e2e -- --workers=1 --grep "protects session-only changes before leaving"` through the real safe-recovery path and retain the controlled runtime persistence-failure case. The browser evidence must cancel a native dialog, inspect the Workspace download, exercise Hiscores opt-out/opt-in, compare original localStorage bytes and check 390x844 plus 844x390 containment. Extend CB-06 without changing its id and run `npm run test:e2e:cross-browser`; Playwright Firefox/WebKit/mobile-WebKit evidence is not branded Safari or physical iOS evidence.
- Transfer artifact clarity: include `src/tests/transfer-artifact-file-name.test.ts` plus the five workflow controller/component owners. Freeze one instant and prove every canonical slug/shape, sanitizer fallback, 48/160 bounds and fixed failure outcome without changing review/reset state. Run `npm run test:e2e -- --workers=1 --grep "names and explains transfer artifacts"` to dispatch all five downloads, inspect exact names and accessible scope descriptions, import the former fixed setup/collection names by content and check long-notice containment at desktop, 844x390 and 390x844. CB-06 retains its id and covers the renamed setup/Workspace actions and generated filenames in Firefox, WebKit and mobile WebKit; this remains Playwright engine evidence rather than branded Safari or physical-iOS evidence.
- Planner: `npm run test -- src/tests/planner-domain.test.ts` for gear eligibility, scoring, stance selection and golden plan fixtures. Run full `npm run test` if planner changes interact with combat, trip, data or economy contracts.
- Planner XP/target integrity: include `src/tests/planner-ui-state.test.ts`, `src/tests/planner-ui-adapter.test.ts`, `src/tests/planner-controller.test.ts` and `src/tests/planner-pane.test.ts`. Prove XP bounds at levels 1/98/99, Auto and explicit boundary semantics, deterministic reconciliation/no-op identity, locked-target preservation, effective adapter/row equality, last-computed reconciliation and stale-result rejection. Production-preview coverage must include manual and Hiscores level changes plus saved/imported/shared setup Load/Undo paths without weakening explicit Recompute.
- Planner results-first hierarchy: include `src/tests/planner-pane.test.ts`, the focused `recomputes the Planner` and calculation-lifecycle Chromium paths and both existing Planner visual scenarios. Prove summary/training/unlock DOM order, lifecycle adjacency, transient collapsed `Advanced gear pool · N/M`, native Enter/Space/Tab focus behavior, selection/count/Reset persistence, reload collapse and 390 px containment. Review actual/diff images before updating only the Planner-owned baselines.
- Mobile result/navigation loop: include `src/tests/app-shell-components.test.ts`, the app-shell view-model regression and the parametrized `mobile result and navigation loop` Chromium path at 390 × 844, 620 × 844 and 768 × 1024. Prove one Player-adjacent `result.contextMetrics` summary, no visible setup-context duplicate, initial left-boundary disabled/right enabled state, full adjacent-tab arrow reveal without active/vertical-scroll mutation, all eleven dynamic More entries, Settings activation/focus, Home/End/arrow active-tab reveal, one 40-pixel-high four-action row, 12/14-pixel typography and horizontal containment. Keep desktop/640 × 360 regressions and review the six bounded mobile-loop images plus any genuinely typography-owned mobile diffs before explicit baseline writes; run the complete read-only visual suite twice after the final update.
- Workbench browser context: include `src/tests/workbench-browser-context.test.ts`, app-shell/pane-delivery/share adapter suites and the named `restores workbench pane through browser history` production-preview transaction. Prove every exact allowlisted id, missing/invalid/duplicate/control/path/oversized handling, root/sub-path plus safe-query/setup-fragment preservation, source-backed fixed/dynamic titles, URL-selected lazy-family seeding, changed user/routed push, same-pane no-op, non-recursive popstate, internal replace and cleanup-safe focus/title behavior. The browser flow must cover Planner deep link/reload, two Back/Forward round trips, retained pane state, hidden-pane focus transfer, roving keyboard, 390 px More, invalid canonicalization and combined pane/safe/share URL state. Extend CB-09 without changing the CB-01 through CB-12 manifest and run Firefox plus desktop/mobile WebKit; do not claim branded Safari, physical iOS or screen-reader evidence from Playwright.
- Hiscores Apply Undo: follow [the implemented transaction contract](hiscores-apply-undo-spec.md) with `src/tests/hiscores-ui-state.test.ts`, `src/tests/hiscores-lookup-controller.test.ts`, `src/tests/planner-ui-state.test.ts`, `src/tests/planner-controller.test.ts` and the mocked Hiscores path in `src/tests/e2e/integrations-economy.spec.ts`. Prove freshness before snapshot/mutation, changed-field counting, no-op/stale preservation of the preceding global Undo, exact pre-Apply form restore, single-Undo replacement semantics, open-preview derivation after Apply/Undo and Planner draft/effective/late-result reconciliation in both directions. Automated tests must not call a live upstream.
- Duel matrix lifecycle: include `src/tests/compare-duel-controllers.test.ts`, `src/tests/compare-duel-panes.test.ts` and `src/tests/calculation-task.test.ts`, plus the focused `Duel matrix failures` production-preview path. Prove exact idle/building/ready/stale/failed precedence over all six source references, duplicate-build blocking, previous-output retention and labelling, fixed failure privacy, Retry, obsolete-task cancellation, late-settlement rejection, zero-snapshot reset and unchanged filter/metric/sort behavior. Run goldens because the retained table still carries calculated combat, XP and economy output even though this contract changes no formula.
- Dense/Planner/Risk calculation lifecycle: include `src/tests/compare-duel-controllers.test.ts`, `src/tests/compare-duel-panes.test.ts`, `src/tests/planner-controller.test.ts`, `src/tests/planner-pane.test.ts`, `src/tests/risk-controller.test.ts`, `src/tests/risk-pane.test.ts` and `src/tests/calculation-task.test.ts`, plus `src/tests/e2e/calculation-lifecycle.spec.ts`. Prove exact idle/building/ready/stale/failed precedence, first and refresh failures, labelled previous output, fixed-copy privacy, explicit Retry, exact source freshness, obsolete-task cancellation, late-settlement rejection and the fresh-only Risk bridge. Run goldens because retained Dense rows and Planner/Risk output still carry calculated values even though this contract changes no formula.
- UI/view-model changes: `npm run test -- src/tests/*-view-model.test.ts`, `npm run test`, `npm run build` and `npm run test:e2e` when browser behavior changes.
- Performance-sensitive UI/view-model changes: include `src/tests/ui-performance.test.ts` and browser smoke where possible; compare the level-input path and representative compare/planner workloads against the accepted performance budget.
- Market/import logic: unit tests with mocked price sources and malformed data; include `src/tests/ui-adapters.test.ts` for rewrite price imports and `src/tests/market-ui-state.test.ts` for selected active `PriceSet` persistence, restore and failure behavior.
- Full PriceSet transfer presentation: include the focused transfer-controller, Economy/Settings pane and app-header component tests plus Playwright coverage for the one collapsed Market disclosure, global/Settings duplicate removal, export-to-import round trip, non-merge guidance, recoverable invalid files and compact/mobile containment.
- Manual item-price overlay: include `src/tests/market-ui-state.test.ts`, `src/tests/local-state-health.test.ts` and the focused Economy Playwright draft/base-change/reload/reset/capacity workflow. Confirm the base PriceSet and high-alch values are unchanged, item metadata becomes manual, unavailable stored ids stay inactive without deletion, a draft cannot move with the separate Trend item selector, the 512-row guard is non-throwing, the local key clears after the final reset and calculated consumers receive a new composed PriceSet identity.
- Economy destructive-action Undo: include `src/tests/economy-data-undo.test.ts`, `src/tests/market-ui-state.test.ts`, `src/tests/price-set-transfer-controller.test.ts`, `src/tests/local-state-recovery-controller.test.ts` and `src/tests/economy-settings-pane.test.ts`, plus `npm run test:e2e -- --workers=1 --grep "Economy destructive Undo|price history Undo|manual price Undo|PriceSet reset Undo"`. Prove the closed three-key allowlist, exact raw/null restoration, cross-tab mismatch protection, read/write/remove failure fallback, one-shot consumption, raw non-disclosure, history savedAt preservation across reload, full manual state including unavailable rows, base-equivalent Apply, selected PriceSet/alch/history isolation, safe-session isolation and a forced persistence failure. Compare raw strings rather than parsed envelopes and keep an unrelated key fixed.
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

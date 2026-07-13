# Testing

## Current state

The latest complete production-preview Chromium gate passed 77/77 on
2026-07-13 after the Goal 9 PriceSet controller and Goal 10 Cannon pane
extractions. Their combined targeted PriceSet/legacy/Cannon gate passes 4/4.
Full `npm run verify` passes 694 unit tests, 19 explicit goldens, typecheck, the
81-source-module/68-client-reachable-module zero-cycle architecture check,
build/artifact budgets, lint, formatting and diff checks. Earlier 57/57, 58/58,
63/63, 73/73, 74/74 or 76/76 counts in the historical evidence log below are
superseded run snapshots. The separate Darwin visual comparison passes 20/20
against 31 reviewed fixture-only snapshots, including the 640x360 compact
landscape contract. Baseline writes remain explicit and require image-diff and
privacy review.

Visual delivery note, 2026-07-13: accumulated topbar ownership, workbench,
conditional-loot, manual-price and scheduled-snapshot changes intentionally
changed 28/31 Darwin PNGs. Direct candidate review found and fixed a mobile-only
topbar `flex-basis` gap before accepting the images. The explicit update then
passed 20/20; the normal read-only comparison remains the final visual gate.

Worktree validation note, 2026-07-13: the Goal 1 ownership refactor moves
legacy-to-rewrite mapping into `src/app/state/legacy-storage-migration.ts`.
`npm run architecture:check` passes with 63 source modules, no cycles, 50
client-reachable modules and zero exceptions. The focused migration/UI-adapter
suites pass 92/92 and the production-preview Import/Keep/Clear gate passes 3/3.
Full `npm run verify` passes 623 unit tests, 19 explicit goldens, typecheck,
build/artifact, lint, format and diff checks; `npm audit` reports zero
vulnerabilities. The unchanged 9-file artifact SHA-256 is
`e4483f07ff847bab7209380bf6aed7926fe33826c51f51bf05bba4c85ff7b763`.

Goal 2 phase 1 then extracts shared controls and pure presenters from
`src/app/App.tsx` according to
[app-composition-root-refactor-spec.md](app-composition-root-refactor-spec.md).
The focused UI adapter/view-model gate passes 144/144 and the complete
production-preview Chromium gate passes 76/76. Final `npm run verify` passes 623
unit tests, 19 explicit goldens, architecture/type/build/artifact/lint/format and
diff checks. The architecture graph contains 68 source modules, no cycles, 55
client-reachable modules and zero exceptions. The structural move produces a
9-file artifact SHA-256 of
`9fdbd3b5484a815fd5075a6787d4d8b4c794ab72fad5abb5696849956294240d`;
the changed hash reflects module/build output identity, while the file count and
visible/numeric browser contracts remain covered by the passing gates.

Goal 3 adds the implemented
[startup and bundle performance contract](startup-bundle-performance-spec.md).
Five paired Chromium samples on the same workstation measured the pre-split
cold medians at 240 ms app-ready / 112 ms FCP and the post-split medians at 241
ms app-ready / 80 ms FCP. Warm app-ready was 167 ms before and 168 ms after.
The direct entry changed from 1,562,480 raw / 245,210 gzip bytes to 683,659 raw
/ 197,123 gzip bytes; the 880,362-byte generated-runtime chunk is deferred, so
total cold JavaScript transfer remains effectively unchanged. The artifact gate
now enforces 725,000 raw / 210,000 gzip entry limits and reports three JavaScript
chunks. Focused generated-runtime/deployment/performance tests pass 23/23 and
the complete production-preview Chromium gate passes 76/76. Final
`npm run verify` passes 624 unit tests, 19 explicit goldens, architecture,
typecheck, build/artifact entry budgets, lint, format and diff checks.

Goal 4 implements
[the MetricList presenter hygiene contract](metric-list-presenter-hygiene-spec.md).
The generic presenter/type now live in `app-presenters.tsx`, all eleven
consumers use the readonly props-object JSX API and the fragment preserves the
existing no-wrapper DOM. Typecheck, the 68-module architecture graph, ESLint and
repository-wide Prettier checks pass with zero cycles and zero exceptions. The
complete production-preview Chromium gate passes 76/76 across the shared metric
consumers. Final `npm run verify` passes 624 unit tests, 19 explicit goldens,
architecture/type/build/artifact entry budgets, lint, format and diff checks.
The 10-file/two-asset artifact is 1,939,428 bytes with SHA-256
`fb376bc3a342857ed4b7d1f507b543330b85cb308e12bc5ab9f23e2bd1a77c4f`;
dependency audit is the only skipped step under the documented network-disabled
policy.

Goal 5 implements
[the runtime bootstrap controller contract](runtime-bootstrap-controller-spec.md).
The dependency-injected resolver and lifecycle hook own generated-runtime
loading, setup/Duel compatibility and selected/scheduled/bundled/manual startup
price resolution; `App.tsx` applies one idempotent typed result before enabling
persistence. The focused resolver suite passes 11/11 and the combined controller,
market UI, UI adapter and generated-runtime suites pass 106/106. The targeted
production-preview startup/recovery gate passes 3/3. Architecture passes with 70
source modules, no cycles, 57 client-reachable modules and zero exceptions. The
10-file/two-asset artifact keeps the generated snapshot in an 880,362-byte
deferred chunk and reports a 685,731 raw / 197,749 gzip entry plus SHA-256
`7aa9d4e6eae551a86992c72abf14e8af09fab4beb61491caf3c42a66abb4b51f`.
Final `npm run verify` passes 635 unit tests, 19 explicit goldens,
architecture/type/build/artifact entry budgets, lint, format and diff checks.
Dependency audit is the only skipped step under the documented network-disabled
policy.

Goal 6 implements
[the local-state recovery controller contract](local-state-recovery-controller-spec.md).
The DOM-free core and thin React hook own health/report/failure/block/skip,
versioned persistence, allowlisted clear/export and explicit outcomes. The pure
Settings component owns the unchanged recovery markup and copy; `App.tsx`
retains feature values/effects and the manual-price reset reaction. Ten focused
tests bring the combined recovery/health/UI-adapter/market gate to 109/109. The
targeted production-preview gate passes 4/4 and the complete Chromium gate
passes 76/76. Architecture passes with 73 source modules, no cycles, 60
client-reachable modules and zero exceptions. Final `npm run verify` passes 645
unit tests, 19 explicit goldens, architecture/type/build/artifact entry budgets,
lint, format and diff checks. The direct entry is 690,492 raw / 198,906 gzip
bytes and the 10-file/two-asset artifact SHA-256 is
`42ec8a2e9ad83a80e6c0d6861cdf39ddf47690631716301c38912c2e9075a4f1`;
dependency audit is the only skipped step under the documented network-disabled
policy.

Goal 7 implements
[the Hiscores lookup controller contract](hiscores-lookup-controller-spec.md).
The DOM-free core and thin external-store hook own status, player input,
latest-request freshness, preview/notices and last-player recovery. The topbar
panel owns the unchanged DOM and disclosure-scoped focus interaction, while
`App.tsx` retains current-form row derivation and the typed Apply mutation
bridge. Nineteen focused tests bring the required combined Hiscores/recovery
gate to 55/55. The targeted mocked Chromium gate passes 2/2 and the complete
Chromium gate passes 76/76. Architecture passes with 76 source modules, no
cycles, 63 client-reachable modules and zero exceptions. Final
`npm run verify` passes 664 unit tests, 19 explicit goldens,
architecture/type/build/artifact entry budgets, lint, format and diff checks.
The direct entry is 693,270 raw / 199,784 gzip bytes and the 10-file/two-asset
artifact SHA-256 is
`9fee2ce16c8a5d0a39d853d8d9c0991f1eb99343bea795c2f7b291738638765d`;
dependency audit is the only skipped step under the documented network-disabled
policy.

Goal 8 implements
[the rewrite setup file-transfer controller contract](setup-file-transfer-controller-spec.md).
The generic DOM-free core and thin external-store hook own bounded file reading,
existing parser invocation, fixed sanitized notices, recovery-aware persistence
and deterministic export envelopes. `App.tsx` retains the six live setup state
owners, typed ready-outcome Apply, input reset and unchanged topbar JSX. Twelve
focused tests bring the required controller/parser/UI-adapter/recovery gate to
78/78. The targeted Chromium gate passes 2/2 and the complete Chromium gate
passes 77/77. Architecture passes with 78 source modules, no cycles, 65
client-reachable modules and zero exceptions. Final `npm run verify` passes 676
unit tests, 19 explicit goldens, architecture/type/build/artifact entry budgets,
lint, format and diff checks. The direct entry is 694,107 raw / 200,282 gzip
bytes and the 10-file/two-asset artifact SHA-256 is
`be5fffa96594804531c3dedb7e16b0accd0751977fcb338b1b779cc0094f7b0f`;
dependency audit is the only skipped step under the documented network-disabled
policy.

Goals 9 and 10 implement
[the PriceSet transfer controller](price-set-transfer-controller-spec.md) and
[the Cannon pane extraction](cannon-pane-extraction-spec.md). The DOM-free
PriceSet controller owns bounded import, generated-alch/manual-overlay
acceptance, selected persistence/recovery, latest-state history update, export
and reset. The pure Cannon pane owns its unchanged presentation derivation and
markup behind explicit values/actions, while `App.tsx` retains live runtime
state application, current-monster schema mutation and Trip synchronization.
The PriceSet combined unit gate passes 57/57, Cannon focused suites pass
138/138, the targeted production-preview gate passes 4/4 and complete Chromium
passes 77/77. Architecture passes with 81 source modules, no cycles, 68
client-reachable modules and zero exceptions. Final `npm run verify` passes 694
unit tests, 19 explicit goldens and all non-network gates. The direct entry is
698,137 raw / 201,103 gzip bytes and the 10-file/two-asset artifact SHA-256 is
`00193bd3b92bf8f1faf6c25eca880ff74f5106f483e3dd3998bf8966e33b62bf`.

The root app path uses the Vite/React rewrite and has npm scripts for TypeScript, Vite, Vitest, Playwright, ESLint and Prettier. The archived legacy app in `legacy/index.html` still transforms JSX in the browser by Babel Standalone and has no local JSX typecheck/build step.

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

Node 22 and npm 10 are the repository runtime contract. `.nvmrc`, the root
`package.json` engines and the scheduled workflow use the same major versions.

`npm run architecture:check` scans non-test TypeScript source imports. It
rejects cycles, forbidden layer directions, stale exception entries and any
archived legacy/static runtime path reachable from `src/app/main.tsx`. The
authoritative `npm run verify` gate runs it after typecheck and before tests.
The exact layer policy and current graph facts are owned
by [architecture.md](architecture.md#enforced-dependency-boundaries).

## Revision 274 NPC attack source audit

Run the read-only pinned-source audit with:

```sh
npm run npc:attack-audit
```

After reviewing an intentional audit-tool or pinned-source change, regenerate
the committed decision evidence with:

```sh
npm run npc:attack-audit:write
```

The command verifies the local LostCity checkout against the committed source
pin, requires exactly 63 active NPC rows and checks that the committed report is
current. The shared bounded RuneScript reader rejects source/scripts symlinks,
oversized files/trees, excessive block graphs, stale mappings, duplicate or
conflicting triggers/profiles, unknown parser shapes and invalid numeric bounds.
Report output is capped at 2 MiB and contains no raw source bodies, absolute
paths or inferred contextual weights.

Focused coverage is:

```sh
npm run test -- src/tests/npc-attack-source-audit.test.ts src/tests/lostcity-source-parser.test.ts
```

It covers standard melee/ranged, spell-backed and forced magic, scripted fixed
damage, explicit source-weighted selection, contextual effect selection,
duplicate/conflicting/unknown/invalid/deep shapes and symlink/source/report
limits. The current report has 55 exact source paths and eight partial paths;
four dragon rows carry explicit pinned-source weights while four
contextual/effect rows remain unweighted. This is Goal 1 evidence only: it does
not by itself authorize future formula or baseline changes; D-081 separately
accepts the implemented bounded profile/descriptor policy.

The generator now emits typed profiles for all 63 rows and the focused
generator/Trip/Risk/view-model suites verify formula-input retention, runtime
formula revalidation, typed defence/protection selection, exact weighted
normalization, partial/legacy compatibility coverage, overlay separation and
Risk model-version 2 sampling. Run:

```sh
npm run test -- src/tests/data-generator.test.ts src/tests/npc-attack-source-audit.test.ts src/tests/trip-loot-supply.test.ts src/tests/risk-analysis.test.ts src/tests/ui-view-model.test.ts src/tests/calculation-task.test.ts src/tests/full-simulation-result.test.ts
npm run numeric:audit
npm run runtime:readiness -- --example-limit 5
```

`numeric:audit` is read-only here. Do not use `numeric:audit:write`, visual
update or golden refresh as failure recovery.

The 2026-07-11 Goal 1 completion gate passed the 25/25 focused audit/parser
tests and `npm run verify`: 592/592 unit tests, 19/19 golden tests, typecheck,
production build/artifact validation, ESLint, Prettier and `git diff --check`.
The artifact contained 8 files / 2 assets, 1,724,342 bytes and SHA-256
`a223e3040a46854245378a84af4d58a9850c9ec32950af589c3d9546f1540db9`.
The gate skipped npm audit under its documented network-disabled policy; no
browser, baseline-write, snapshot-refresh or deployment command is part of this
audit-only goal.

The D-081/D-082 follow-up, rebased onto scheduled-price commit `af0d2a4`,
passes 595/595 unit tests and 19/19 unchanged legacy goldens plus typecheck,
production build/artifact validation, ESLint, Prettier and `git diff --check`.
The artifact contains 8 files / 2 assets, 1,807,135 bytes and SHA-256
`08465aa5092b10b79f42e6a4110a002a8e582e1ca27f23ab85dcd164aad235d1`.
Runtime readiness is green with blocking `monsters.incomingAttacks` coverage at
63/63, and the read-only numeric audit reports 5,958 cross-path comparisons
with zero mismatches and no unclassified legacy findings. Sandbox-external
localhost execution passed the complete Chromium gate 74/74 and the reviewed
Darwin visual gate 20/20. The visual update was limited to the documented
D-075–D-082 and scheduled-price integration reviews and followed by a clean
read-only comparison run.

## Cloudflare deployment validation

Focused D-066 tests cover Worker routing, same-origin Hiscores responses,
ephemeral client-address rate-limit keys, sanitized API fallback, static binding
failure, Wrangler routing/log settings and the `_headers` contract:

```sh
npm run test -- src/tests/cloudflare-worker.test.ts src/tests/deployment-readiness.test.ts src/tests/hiscores-server.test.ts src/tests/lostcity-hiscores-provider.test.ts
npm run typecheck
npm run build
npm run deploy:verify-artifact
```

The artifact command requires root `index.html`, Cloudflare `_headers`, hashed
Vite JavaScript/CSS references, `prices.json`, `price-provenance.json`, `alch.json` and
`price-history.json`; validates the static security/cache policy, market schemas
and `_scraped_at`; rejects unexpected files, source maps, symlinks, local paths
and common secret material; enforces and reports direct entry-JavaScript raw/gzip
budgets plus the total JavaScript chunk count; and prints only bounded metadata
plus SHA-256.

After a provider preview exists, run the bounded no-write HTTPS smoke against
the exact origin root:

```sh
npm run deploy:smoke -- --origin "https://<preview-origin>" --hiscores-mode enabled
```

The smoke checks status only and intentionally never sends a player name; a live
lookup remains gated by verification that Cloudflare Workers Logs, Logpush, Tail
Workers and external drains are disabled under D-065/D-066. The
smoke rejects credentials, paths, query strings, fragments and non-HTTPS
origins; redirects, timeouts, oversized bodies and raw network errors stay
bounded/sanitized. It verifies security headers and cache classes on root,
hashed assets, stable market JSON and Hiscores status, and rejects an unknown
`/api/*` probe that is masked by a successful SPA fallback.

The focused tests use synthetic artifacts and mocked responses. They make no
live upstream or deployment request. Cloudflare Builds uses
`npm run deploy:cloudflare:build`, then exact Wrangler 4.109.0 through
`npm run deploy:cloudflare`; `deploy:cloudflare:preview` uploads a version preview.
The managed local environment cannot resolve the npm registry, so the real
Wrangler bundle/upload and provider preview remain external evidence.

Acceptance/security passes should also run:

```sh
npm run test:golden
npm audit
git diff --check
rg -n "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document.write|eval\\(|new Function" src index.html legacy/index.html views.jsx planner.jsx market.js
rg -n "api[_-]?key|secret|token|password|authorization|bearer|private key" .
rg -n "https?://|unpkg|text/babel|script src|/api/prices|/api/scrape|/api/hiscores" index.html legacy/index.html src views.jsx planner.jsx market.js docs SECURITY_AUDIT.md
```

For the bounded legacy Planner behavior audit, run:

```sh
npm run planner:parity
```

The command runs `src/tests/planner-parity.test.ts` and
`src/tests/planner-domain.test.ts`, then regenerates and checks
`docs/project/planner-parity/current.md` against the reviewed baseline. The
current matrix has 16 cases and 32 reference-context/current-product
comparisons, classified as 29 accepted rewrite deltas and three Revision 274
source-data deltas, with no open review row or rewrite gap.

Baseline changes are never automatic failure recovery. During an explicit audit
review, regenerate a candidate with:

```sh
npm run planner:parity:report -- --update-baseline --allow-needs-review
```

Review every changed field and replace every `needs-review` classification with
evidence or leave the local gate failing. The audit never calls live upstreams,
reads real browser state or imports `planner-core.js` into production modules.

For the broad numeric user-path audit, run:

```sh
npm run numeric:audit
```

The command evaluates the default setup for all 189 generated
monster/combat-style combinations and 18 legacy golden setup variants. It
compares Result, Dense Compare, calculation worker, Duel live, Duel matrix and
saved-setup round-trip values at absolute and relative tolerance `1e-9`. The
2026-07-12 baseline contains 5,958 current-path comparisons and zero
mismatches. It also reports legacy-to-rewrite changes only when both the
metric-specific absolute and relative thresholds are exceeded; those findings
must be classified rather than silently treated as rewrite truth. Its focused
casket section reports Dagannoth 74, Dagannoth 92 and Rock Crab separately as
`source-backed-casket`, comparing the prior generated parent cost with the
opened-content EV and GP/kill correction.

Regenerate the committed evidence after an intentional reviewed change with:

```sh
npm run numeric:audit:write
```

The report is [../project/numeric-user-path-audit.md](../project/numeric-user-path-audit.md).
The audit is local and deterministic: it does not call live upstreams or read
real browser storage. Browser formatting remains covered by the Playwright
all-fixture and release-path numeric snapshot cases.

For ordinary-casket valuation or source-contract changes, run:

```sh
npm run test -- src/tests/lostcity-source-parser.test.ts src/tests/data-generator.test.ts src/tests/trip-loot-supply.test.ts src/tests/ui-view-model.test.ts
npm run data:generate -- --source-dir .sources/lostcity-content --dry-run --skip-calculation-impact
npm run numeric:audit
npm run test:e2e -- --workers=1 --grep "source-backed opened-casket value composition"
```

The parser test locks the focused source contract to the domain table and
includes an intentional threshold-drift failure. The data-generator dry run is
optional when the repository-local raw checkout is absent; committed fixtures
keep the normal clean-checkout gate independent of `.sources`.

For live integration release-copy audits, also run the narrower command below and classify every hit as production code, typed same-origin contract/test, archived legacy evidence or documentation:

```sh
rg -n "run_sim.py|/api/prices|/api/scrape|/api/hiscores" index.html legacy/index.html src views.jsx planner.jsx market.js docs
```

The npm scripts use npm's `$NODE` value for Node-based tool commands. This keeps commands on the active NVM Node version even if a parent `node_modules/.bin/node` appears earlier in `PATH`. `npm run verify` is implemented by the shared gate mode in `scripts/run-cloudflare-release.mjs`; update that one command sequence instead of maintaining separate handoff and deploy checklists in code.

Use repository-local caches and helper files for tests. For example, this project uses `.npm-cache` for npm commands. Do not place project scripts in `/tmp` or another external scratch directory unless a human explicitly approves.

Playwright smoke tests are configured, but browser binaries may need to be installed separately before running:

```sh
npm exec -- playwright install chromium
npm run test:e2e
```

The Playwright web server builds the production bundle and serves it through
`vite preview` on `127.0.0.1:5173`. It does not reuse an arbitrary existing dev
server, so browser evidence covers the same built artifact used by the static
release path.

The repository-local visual project is isolated from the functional suite:

```sh
npm run test:e2e:visual
npm run test:e2e:visual:update
```

`playwright.config.ts` ignores `*.visual.spec.ts`, while
`playwright.visual.config.ts` matches only those files and serves a fresh
production build on `127.0.0.1:5174`. The normal command compares against the
matching `process.platform` baseline and never writes images. Only the explicit
update command may create or replace reviewed candidates under
`src/tests/e2e/__screenshots__/<platform>/`.

The current Darwin set contains 31 fixture-only PNGs from 20 scenarios. It
covers desktop/compact-landscape/mobile root, desktop/tablet Compare, all three
loadouts and their detail states, Stats and hit-distribution detail,
desktop/mobile Trip and Loot with nested/action detail, fixed local Economy
history, enabled Dagannoth Cannon, desktop/mobile Planner and Duel matrix, and
Settings recovery/price/legacy review. Browser time is fixed at
`2026-07-10T12:00:00.000Z`, live integration
calls are disabled, fonts are awaited, and the screenshot policy uses disabled
animations, hidden carets, CSS scale, threshold `0.2` and maximum diff ratio
`0.001`. A baseline update must name the product change that caused it. The
suite is repository-local evidence, not an accepted remote merge check.

For shareable setup permalink changes, run the focused contract and
production-preview workflows:

```sh
npm run test -- src/tests/shareable-setup.test.ts src/tests/ui-adapters.test.ts
npm run test:e2e -- src/tests/e2e/shareable-setup.spec.ts
```

These cover strict bounded external parsing, duplicate-key rejection,
compatibility review, root/sub-path URL construction, fragment removal,
clipboard fallback, review-before-write, Load/Dismiss, complete one-step Undo
and preservation of recipient PriceSet/history and unrelated storage. They do
not call live upstreams.

For the on-demand Duel monster matrix, use the focused checks below:

```sh
npm run test -- src/tests/ui-view-model.test.ts
npm run test:e2e -- --workers=1 --grep "builds and filters the all-monster Duel setup matrix"
```

The unit path verifies every generated monster row, live/snapshot metric
composition, best markers and snapshot immutability. The browser path verifies
that the matrix is absent before the user requests it, builds from live plus a
saved setup, exposes all generated monster rows, switches metrics, filters rows
and keeps horizontal overflow inside the workbench. These tests do not add a
worker, persist matrix output or call live upstreams.

For the optional all-fixture browser-display expansion, use:

```sh
npm run test -- src/tests/rewrite-fixture.test.ts
npm run test:e2e -- --workers=1 --grep "matches browser-rendered result metrics for every golden fixture setup"
```

`src/tests/helpers/rewrite-fixture.ts` maps all 18 current golden case
definitions directly into validated rewrite form, cannon, loot-preference and
loot-setting state without starting the archived browser runtime. The unit test
validates every mapped setup and finite generated-runtime metric. The Playwright
case reloads each setup through the versioned rewrite browser-storage envelopes
and compares all ten visible metric-strip values with the same source-backed
view-model result. The focused production-preview browser case passes 1/1, and
the expanded default Playwright gate passes 63/63. The first focused run found
that the browser's dynamically loaded scheduled snapshot had dropped generated
item/alch fallbacks; `src/app/state/market-sync.ts` now composes those fallbacks
without overriding scheduled values, with focused unit coverage.

In the managed Codex sandbox, Node-based localhost connections can fail with `EPERM`.
When that happens, run `npm run test:e2e` with explicit sandbox escalation instead of
moving helper scripts outside the repository.

## Rewrite local state health tests

The rewrite-local state health and controller tests live in:

```sh
npm run test -- src/tests/local-state-recovery-controller.test.ts src/tests/local-state-health.test.ts
```

They cover metadata-only health reporting for known rewrite-owned storage keys,
including missing, loaded, invalid JSON, invalid envelope, invalid data and
version-mismatch states, plus non-fatal `getItem`, `setItem` and `removeItem`
failure handling. They also cover per-key clearing and clear-invalid behavior,
with assertions that loaded, missing, legacy and unknown keys are not removed and
that raw storage error text is not exported.

The controller suite adds initial and runtime compatibility blocks, the
clear-versus-replacement one-shot distinction, deduplicated save/clear failure
metadata, successful-save recovery, metadata-only export, manual-price clear
outcomes and static panel confirmation markup. It uses memory/failing storage
doubles and the existing server renderer; no browser or new React test
dependency is required.

The Playwright scaffold covers the Settings recovery view by pre-seeding an
invalid rewrite-owned key, confirming the recovery notice, and clearing only the
allowlisted invalid key while preserving legacy and unknown browser-local keys.
It also smokes a rewrite-owned save failure path where current session edits stay
visible while Settings shows a safe local-storage persistence notice.

## Scheduled static market snapshot tests

The read-only scheduled static `PriceSet` loader/status contract and visible UI fallback path are covered by:

```sh
npm run test -- src/tests/market-writer.test.ts
npm run test -- src/tests/data-economy.test.ts src/tests/market-adapter.test.ts src/tests/market-ui-state.test.ts src/tests/ui-adapters.test.ts
npm run test:e2e -- src/tests/e2e/scaffold.spec.ts
```

Focused writer tests validate the normalized fixture contract and first-page Inertia item adapter used by `--upstream-url`: exact root/origin checks, sequential request delay, redirect/timeout/size/content failures, allowlisted item-id diagnostics, mapping-specific 404 retention, all-retained freshness rejection, username removal, coin-only observations, MAD/median filtering, sparse/stale retention, preserved value origin/observation time/quality, legacy-static initialization without invented observation timestamps, version-2 history migration/compaction, three-file idempotence and unchanged `alch.json`. A local dry-run fixture check needs no network:

```sh
npm run prices:write-scheduled -- --input src/tests/fixtures/market-writer/upstream-valid.json --item-ids lobster,rune_scimitar,dragon_bones --now 2026-07-08T00:15:00.000Z --dry-run
```

D-086 dynamic dependency checks live in `src/tests/market-sync-items.test.ts`,
`src/tests/trip-loot-supply.test.ts` and generated readiness. They assert the
active Revision 274 tag counts, exact Trip-derived dependency union, zero
unrecognized active tags and explicit mapped/missing separation. Missing
allowlist rows are advisory. D-087 locks the twelve source-reviewed identified
additions, the `rune_2h → rune_2h_sword` exception and the exact remaining ten
unsupported unidentified-herb ids. Its 2026-07-12 no-write live parser check
reported eight updated plus four retained/skipped rows without committing the
candidate values.

The scheduled workflow runs only at 00:15 and 12:15 UTC, has no `workflow_dispatch`, requires `MARKET_PRICES_UPSTREAM_URL` to be the exact reviewed root, validates focused tests/JSON/diffs, rejects changes outside `prices.json`, `price-provenance.json` and `price-history.json`, and commits only real three-file diffs. The opt-in 2026-07-10 live dry-run passed for the original 80 mappings with 69 updated plus 11 retained/skipped rows and no writes. The D-087 twelve-row expansion separately passed its parser dry-run on 2026-07-12; a complete 92-row configured cron is still adopter evidence. The exact repository variable was configured and read back on 2026-07-10. Under D-067, a future operator collects first-successful-run evidence before using scheduled-current copy; it is not a repository test gap.

Freshness and release-evidence checks for the scheduled market path:

```sh
node -e "const fs=require('fs'); const prices=JSON.parse(fs.readFileSync('prices.json','utf8')); const provenance=JSON.parse(fs.readFileSync('price-provenance.json','utf8')); const history=JSON.parse(fs.readFileSync('price-history.json','utf8')); const last=history.snapshots.at(-1); console.log({pricesCapturedAt:new Date(prices._scraped_at*1000).toISOString(),provenanceCapturedAt:provenance.capturedAt,lastHistoryAt:last?new Date(last.t*1000).toISOString():null,historySnapshots:history.snapshots.length});"
git log -1 --format="%h %cI %s" -- prices.json price-provenance.json price-history.json
git diff --check
```

For release-copy evidence, also run the live integration release-copy audit below and classify every hit. D-053 keeps live scheduled-market workflow evidence out of the V1/trusted-tester gate when the release is described as static/bundled/imported price limited. Scheduled-current market-price copy requires the latest successful `Update market prices` GitHub Actions run on the release branch after `MARKET_PRICES_UPSTREAM_URL` is configured. A failed run leaves the previous committed snapshot active; a no-op successful run is freshness evidence but does not change `_scraped_at` or create a commit.

Other focused tests validate committed market/provenance/history files, capture/key parity, generated fallback metadata, selected/local v1 migrations, alias metadata, same-origin logical-set loading and the rule that shared loading writes neither selected state nor local history. Playwright checks shared history without localStorage writes, local capture/clear isolation, scheduled status, provenance detail, import/reset and stale backend-copy absence.

## Generated game data tests

The generated game data workflow has a command and testable core. It validates that the default source path is the gitignored `.sources/lostcity-content/` checkout, that missing or non-directory sources fail with sanitized errors, that fixture source/output-root paths can be exercised without network access or raw upstream content, that the source-backed fixture extracts monster/drop/item/equipment/weapons/ammo/spells data and a top-level item requirement map into `GameDataSnapshot`, that generated `game-data.json` validates with `GameDataSnapshotSchema`, that requirement input accepts only strict Attack/Strength/Defence/Ranged/Magic integer levels from 1 to 99, that identical normalized-slice item requirements merge deterministically and conflicts fail with sanitized errors, and that the raw parser covers every accepted `levelrequire` family, single-line and quest-wrapper multi-line triggers, fixed Iban requirements, unknown calls and conflicting rows. Raw monster tests cover explicit size and the source default of 1. The workflow also covers duplicate canonical item ids, revision-impact baselines, representative and informational impact reports, output hygiene and deterministic output.

```sh
npm run test -- src/tests/data-generator.test.ts
npm run data:generate -- --source-dir src/tests/fixtures/data-generator/lostcity-content --output-root .vite/data-generator-output --generated-at 2026-07-08T00:00:00.000Z --dry-run --skip-calculation-impact
```

The committed generated outputs are validated by:

```sh
npm run test -- src/tests/data-economy.test.ts
```

The active generated runtime adapter is covered by:

```sh
npm run test -- src/tests/generated-runtime-adapter.test.ts
npm run runtime:readiness -- --example-limit 5
npm run runtime:coverage-plan -- --example-limit 25
npm run runtime:readiness -- --candidate legacy-derived-static --example-limit 5
npm run runtime:write-legacy-derived -- --check
```

The focused test validates that committed generated data plus scheduled static prices and generated item fallbacks form a schema-valid `SimulationContext`, and that readiness becomes green only when all expected ids, required simulator fields, monster combat/loot rows and PriceSet coverage pass. It also covers scheduled-first price precedence, exact-first canonical item lookup, machine-readable missing/extra arrays and legacy-derived reference snapshot freshness. The default readiness command is a blocking gate and currently passes. `--allow-not-ready` remains available only for deliberate work on incomplete local candidates. `runtime:coverage-plan` prints a reviewer-friendly coverage view, `--json` exposes complete arrays, and the legacy-derived commands verify reference/regression artifacts rather than the production bootstrap.

Current generated runtime coverage is ready: the raw Revision 274 generator resolves all expected runtime monster, item, weapon, ammo, spell and equipment identities and 63/63 loot tables, including 25 D-072 conditional rows. Runtime item price/alch fallbacks fill only scheduled-static gaps, and scheduled values retain precedence. D-058 keeps cut and uncut gem identities distinct; exact keys win and aliases are fallback-only. D-059 records the completed root bootstrap switch.

The direct Revision 274 raw-source parser and calculation-impact evidence are covered by:

```sh
npm run test -- src/tests/lostcity-source-parser.test.ts
npm run data:source-audit -- --example-limit 10
npm run data:source-impact -- --impact-outlier-limit 25
npm run data:source-impact -- --loot-only --impact-outlier-limit 25
npm run data:source-impact -- --equipment-only --impact-outlier-limit 25
npm run data:source-impact -- --combat-catalog-only --impact-outlier-limit 25
npm run data:source-impact -- --detail-monster tribesman
```

The audit reads the gitignored `.sources/lostcity-content/` checkout recursively, follows config/category/delegated-handler behavior, fails duplicate config or `ai_queue3` definitions and emits repository-relative sanitized diagnostics. Current Revision 274 evidence maps all 63 runtime monsters, extracts 63/63 loot tables with 1,126 top-level rows, emits size for 63/63 monsters, resolves all expected runtime catalog identities and maps 94 runtime item requirements. The generated snapshot contains 390 validated item identities, including 19 source-only loot identities. Four quest-gated rows and 21 clue-scroll tertiary rows are modeled in the snapshot with typed eligibility and remain explicit default-valuation exclusions. D-055, D-056, D-057, D-071 and D-072 own the accepted source/formula/policy deltas; D-059 owns runtime consumption.

After generator source or schema/test changes, also run:

```sh
npm run typecheck
git diff --check
```

The source-backed generator command writes only `src/data/generated/source-pin.json`, `src/data/generated/game-data.json` and `docs/project/revision-impact/current.md`. The legacy-derived reference writer writes only `src/data/generated/legacy-derived-runtime-game-data.json` and `src/data/generated/legacy-derived-runtime-price-set.json`. Do not commit `.sources/lostcity-content/`, raw upstream checkouts, historical generated snapshot directories or live upstream responses. The raw parser is shared by the generator and the read-only audit/impact CLIs. `src/tests/lostcity-source-parser.test.ts` covers raw requirement and NPC-size extraction; `src/tests/domain-core.test.ts` covers size-1, larger and missing-size dragon halberd behavior; Planner/setup/quick-action generated Strength consumption is covered by `src/tests/planner-domain.test.ts` and `src/tests/ui-view-model.test.ts`.

For a real revision bump PR, use [../operations/README.md](../operations/README.md#game-revision-bump-pr-runbook) as the review checklist. The minimum local evidence is the generator command against `.sources/lostcity-content`, `npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts`, `npm run typecheck` and `git diff --check`; run `npm run test:golden` and relevant domain/UI tests when the revision-impact report shows changed calculation output or changed generated requirements.

For a focused generated-requirements review pass covering the parser/schema contract, committed generated snapshot shape, Planner requirement lookup and loadout/gear-quick-action warning consumers:

```sh
npm run test -- src/tests/lostcity-source-parser.test.ts src/tests/data-generator.test.ts src/tests/data-economy.test.ts src/tests/domain-core.test.ts src/tests/planner-domain.test.ts src/tests/ui-view-model.test.ts
```

For D-073/D-088 bounded whole-loadout optimizer changes, run the focused
view-model contract and production-preview eligibility/apply/Undo smoke:

```sh
npm run typecheck
npm run test -- src/tests/ui-view-model.test.ts
npm run test:e2e -- src/tests/e2e/scaffold.spec.ts --grep "optimizes the visible whole loadout"
```

The view-model coverage owns deterministic improvement, current-form tie and
no-regression behavior, visible-option and two-handed allowlists, default
current-level eligibility, explicit warning-only fallback, excluded-choice
counting, unmet-current-baseline retention, frontier cap reporting,
invalid-limit sanitization and the synchronous interaction budget. The browser
case owns the checked default, complete apply/Undo plus unchanged target and
active style. Price, quest, ownership, future-gear and Planner behavior are
deliberately outside this command.

## V1 release evidence snapshot

The latest functional and repository-local visual release-evidence checks were refreshed through 2026-07-12 for the source-backed Revision 274 root runtime. D-066 chooses Cloudflare hosting/CSP/runtime; Cloudflare deployed evidence and a canonical remote visual runner remain outside the current local evidence. The accepted V1 legacy migration boundary is implemented; only explicitly deferred Planner/full-history or broader migration decisions remain outside it.

| Check                                                       | Latest result                                                             | Notes and follow-up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-11 rewrite reliability audit                        | `pass`                                                                    | Final source passed 37 Vitest files/574 tests, 19/19 legacy golden tests, typecheck, ESLint, Prettier, `git diff --check`, generated runtime readiness with no blockers, Planner parity with 16 cases/32 comparisons and zero review/rewrite-gap rows, and `npm audit` with 0 vulnerabilities. The single-worker production-preview gate passed 63/63, including all 18 browser fixtures, strict setup/Duel recovery and the Compare/Planner/Duel Chromium Long Task budget. Production build and artifact validation passed with 8 files/2 assets, 1,692,036 bytes, 13 history snapshots and SHA-256 `f4eab3d3f19248eb6f9880485feecd295ee3b0ab4cd379c721a6d9c0ac3f7bb7`; the known main-chunk size advisory remains non-blocking. Static DOM/code-execution, secret, path, release-copy and raw-diagnostic searches found only the trusted legacy-reference sandbox, tests, dependencies and documented archived boundaries.                                                                                                                             |
| `npm ci && npm run verify` in detached fresh checkout       | `pass`                                                                    | Commit `43f8b5f` was tested without `.sources`, prior `node_modules`, `dist`, `.vite` or test output under Node 22.19.0/npm 10.9.3. Lockfile install added 237 packages; verify passed 523 unit tests, 19 explicit golden tests, typecheck, build/artifact, lint, format and diff checks. Build produced the expected artifact checksum from committed generated data, and a separate network-enabled `npm audit` reported 0 vulnerabilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run typecheck`                                         | `pass`                                                                    | 2026-07-11 D-073 refresh passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm run test`                                              | `pass`                                                                    | The D-073 full Vitest gate passed 34 files and 543 tests, including the existing source/runtime/domain/Planner evidence plus bounded loadout optimizer determinism, candidate limits, cap handling, no-regression and performance coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run test:golden`                                       | `pass`                                                                    | 2026-07-11 golden fixture run passed 19 tests. Fixture changes still require an accepted baseline decision before updating snapshots.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run build`                                             | `pass`                                                                    | The D-073 Vite build passed with only the known chunk-size warning. Artifact validation passed 7 files/2 assets, 1,502,549 bytes, 13 history snapshots and SHA-256 `b50e40eb6edc76f34922ed3c84783db7dffe6f91daf42c714bb7cc9805d67522`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Cloudflare focused checks                                   | `repository pass; adopter upload gated`                                   | `npm run test -- src/tests/cloudflare-worker.test.ts src/tests/deployment-readiness.test.ts src/tests/hiscores-server.test.ts src/tests/lostcity-hiscores-provider.test.ts` passed 32/32. Evidence covers API-first routing, same-origin status/lookup, ephemeral client key, sanitized 404/500, security/no-store headers, static delegation, disabled observability/Logpush and exact Wrangler/static routing. D-067 leaves first bundle/version upload and deployed smoke to a future operator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Generated/runtime evidence                                  | `pass`                                                                    | Deterministic raw Revision 274 generation produced 390 items, 63 monsters with size, 94 numeric requirement rows and 25 typed conditional loot rows. Generated and legacy-reference readiness are `ready`, coverage has no blockers, source audit has zero unresolved identities, and focused parser/domain/Planner/UI checks pass. The committed report owns D-055/D-057/D-071/D-072 deltas and passes 11/11 representative cases with 22 advisory outliers across 189 evaluations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Source-backed ordinary-casket focused checks                | `pass`                                                                    | The focused parser/generator/Trip/UI suite passes 189/189, the full Vitest suite passes 606/606, legacy golden stays unchanged at 19/19, the current raw Revision 274 data-generator dry run passes without writes and the focused production-preview casket workflow passes 1/1. Domain coverage proves the exact 128-weight/210-coin formula, exact-before-alias-before-generated fallback, parent-price override, one parent slot, all three active monster rows and exact market dependency set. The numeric audit stays cross-path clean at 5,958 comparisons and classifies all three production changes as `source-backed-casket` (+25.87 GP/kill at the audited prices). Typecheck, build, lint, Prettier and diff checks pass.                                                                                                                                                                                                                                                                                                                   |
| Per-item price provenance/freshness focused checks          | `pass; unrelated full-browser failures remain`                            | D-085 passes 613/613 Vitest tests, 19/19 golden tests, typecheck, runtime readiness with 381/381 active metadata rows and no blocker, build, artifact validation, lint, format and diff checks. The artifact contains the required price sidecar and validates at 9 files/2 assets, 10 history snapshots and SHA-256 `0fddf34dfe36a7d824adf2332c7c53af3ca3bb3a32844e378bff224b53de06dc`. Focused scheduled/import/local-history and accepted D-084 numeric browser paths pass 5/5. The complete Playwright attempt passed 66/75 before the two now-verified D-084 expectations were updated; the remaining seven failures are existing topbar-status locator and permalink strict-locator mismatches outside this pricing change.                                                                                                                                                                                                                                                                                                                         |
| Dynamic loot market dependency focused checks               | `pass`                                                                    | D-086 focused market-sync/server/Trip/readiness tests pass 62/62. The generated audit covers 41 herb, 38 gem, three casket and three ultra-rare active rows with zero unrecognized tags, derives 49 unique calculation dependencies, reports 27 approved mappings and 22 missing mappings, and leaves numeric/golden behavior unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| High-impact dynamic-loot allowlist focused checks           | `pass`                                                                    | D-087 expands the allowlist from 80 to 92 source-reviewed rows. The twelve-row no-write live parser run reported eight updated plus four retained/skipped. After rebasing the latest scheduled snapshot, the full suite passes 614/614, legacy golden passes 19/19, and readiness is 39/49 mapped with exactly ten unsupported unidentified-herb gaps and no blocker. Six committed legacy-static price rows name their approved source slug without observation timestamps; typecheck, build, lint, format, diff and the nine-file/two-asset artifact check pass with 11 history snapshots at SHA-256 `b4f1813512d9f43e43a82e15eeffb9b31c42abbc149ff11119b8569cb728e83b`.                                                                                                                                                                                                                                                                                                                                                                                |
| Source-backed requirements/NPC size focused checks          | `pass`                                                                    | Focused parser/generator/runtime/domain/Planner/UI tests passed 190/190; refreshed Planner parity passed 13/13 with 16 cases/32 comparisons, zero review rows and zero rewrite gaps. Legacy golden stayed 19/19. Focused production-preview Planner/setup copy passed 2/2 and dragon-halberd size behavior 1/1. Full `npm run verify` passed 528 unit tests and artifact SHA-256 `acb785ea914a29cacbe33a8514d8a5e7be9b69c412aebbb64db75942610c2f8c`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Bounded whole-loadout optimizer focused checks              | `pass`                                                                    | `src/tests/ui-view-model.test.ts` passed 87/87 with deterministic improvement/no-regression, candidate-policy, cap, requirement and performance coverage. The focused production-preview apply/Undo smoke passed 1/1 after sandbox-external localhost execution and retained the active monster/style. Full `npm run verify` passed 543 unit tests, 19 golden tests, typecheck, build/artifact, lint, format and diff checks; the artifact SHA-256 is `b50e40eb6edc76f34922ed3c84783db7dffe6f91daf42c714bb7cc9805d67522`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Requirement-aware loadout optimizer focused checks          | `pass`                                                                    | D-088 focused view-model coverage passes 93/93 with checked-by-default generated numeric eligibility, explicit warning-only fallback, deterministic excluded-choice counting, unmet-current-baseline retention and existing cap/no-regression behavior. The production-preview eligibility/apply/Undo case passes 1/1 with unchanged target/style. Full `npm run verify` passes 616 unit tests, 19 goldens, typecheck, build/artifact, lint, format and diff checks; npm audit is skipped under the documented network-disabled policy. The artifact contains 9 files/2 assets, 1,930,006 bytes and SHA-256 `94cab4408737ec0f797e8051cf69f5bffe68f746bb97a83334b9b91bcb35fe6e`.                                                                                                                                                                                                                                                                                                                                                                           |
| Conditional-loot and manual-price focused checks            | `pass`                                                                    | D-089 Chromium coverage confirms the ordinary action table excludes an inactive clue row, the `Conditional drops` disclosure is collapsed by default and opening it shows the source chance, sanitized eligibility and locked Skip. D-090 state/local-health coverage passes 48/48; its Chromium workflow keeps a draft item-scoped, applies one Lobster price, exposes manual provenance, preserves it as inactive across a narrow base PriceSet, restores it on base reset, reloads persistence, resets it to the unchanged base and blocks a 513th row without throwing. Full `npm run verify` passes 621 unit tests, 19 goldens, typecheck, build/artifact, lint, format and diff checks. The artifact contains 9 files/2 assets, 1,937,694 bytes and SHA-256 `d40dc6bee4791be7bee37ac8536ca71f76a8c34d2be6e8bff112214d90490a01`; npm audit is skipped under the documented network-disabled policy. The read-only numeric audit passes 5,958 cross-path comparisons with zero mismatches and supports the current scheduled-price browser snapshots. |
| `npm run test:e2e -- --workers=1`                           | `pass`                                                                    | The complete 2026-07-12 D-088-D-090 cleanup gate passed 76/76 in Chromium. It includes the 640x360 compact-landscape no-document-scroll contract, the 1280x720 desktop console, all 11 workbench tabs at 390x844, exact/prefix searchable-option disambiguation and all simulation, storage, import, Planner, Duel, Loot, Trip, Economy, Risk and permalink workflows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run test:e2e:visual`                                   | `pass on Darwin`                                                          | The isolated comparison passed 20/20 scenarios against 31 reviewed fixture-only Darwin PNGs without writing baselines. It covers root at desktop/compact-landscape/mobile, Compare, loadouts, Stats, Trip, Loot details, Economy, Cannon, Planner, Duel and Settings. `npm run test:e2e:visual:update` remains the only baseline-write command. No CI runner or remote merge requirement is accepted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Shareable setup focused checks                              | `unit and browser pass`                                                   | `npm run test -- src/tests/shareable-setup.test.ts src/tests/ui-adapters.test.ts` passed 59/59, and the three permalink production-preview tests are included in the full 57/57 gate. Evidence covers strict bounded parsing, duplicate keys, game-data mismatch/unknown ids/stale loot, root/sub-path URL handling, clipboard failure, review-before-write, Load/Dismiss, complete Undo and preservation of unrelated/local price state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Duel monster matrix focused checks                          | `pass`                                                                    | `npm run test -- src/tests/ui-view-model.test.ts` passed 80/80, isolated `src/tests/ui-performance.test.ts` passed 3/3 with the 12-snapshot/819-cell matrix completing in about 2.5 seconds wall time, and the focused production-preview Playwright smoke passed 1/1. The full parallel Vitest gate also passed the CPU-time bound.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Duel setup diff focused checks                              | `pass`                                                                    | `src/tests/ui-view-model.test.ts` passed 81/81, the focused production-preview Playwright workflow passed 1/1 after sandbox-external localhost execution, and `npm run verify` passed 524 unit tests, 19 golden tests plus the build/artifact gate. The artifact had 7 files, 2 assets and SHA-256 `19fc741807f55418f295a2412a14ce2200bdb7d3faa32d7a2a11425cf97d16f9`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Stats source-distribution focused checks                    | `pass`                                                                    | `src/tests/ui-view-model.test.ts` passed 81/81, focused special/cannon production-preview Playwright passed 2/2, and `npm run verify` passed 524 unit tests, 19 golden tests plus build/artifact, lint, format and diff checks. The artifact had 7 files, 2 assets and SHA-256 `27420966c85266d02317b045e1cbd79d49dc0029831d297297ac66cbf0fa9878`. The gate explicitly skipped npm audit in the network-disabled sandbox.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Accessibility/keyboard focused checks                       | `pass`                                                                    | The focused root/keyboard Playwright run passed 2/2 and the complete production-preview suite passed 58/58 in Chromium. Evidence covers first-focus DOM order, skip-link transfer, tab roles/selection/roving tabindex, arrow/Home/End activation, dynamic panel labelling, one Dense row Tab stop, focus-only row movement, computed outline visibility and Enter selection. Existing click/touch workflows all remain green. `npm run verify` also passed 524 unit and 19 golden tests plus lint/format/build/artifact/diff checks; artifact SHA-256 is `413c89e71d5faaa753ac503118744c447a61717a0c84d01164e161b0eaa39fb2`.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run lint`                                              | `pass`                                                                    | The 2026-07-10 dedicated hygiene cleanup removes the reported code errors and warnings while keeping browser-storage synchronization suppressions local and documented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npm run format:check`                                      | `pass`                                                                    | The 2026-07-10 dedicated hygiene cleanup formats tracked source/docs and excludes generator-owned current snapshot JSON plus revision-impact output from Prettier ownership.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Goal 1/2 focused Playwright reruns                          | `pass, superseded by full baseline`                                       | Focused escalated localhost runs were used to isolate Combat/Stats/Special, Duel, Planner, Dense/Compare, Cannon, Trip, Loot and numeric-snapshot smoke paths during stabilization. The expanded full `npm run test:e2e` 57/57 pass now supersedes those focused runs and includes both the Duel matrix and all-fixture browser-display extensions. The older failure matrix below is retained only as historical triage evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Loot/Economy focused checks                                 | `pass with sandbox-limited browser smoke`                                 | On 2026-07-08, the Loot/Economy pass ran `npm run typecheck` and `npm run test -- src/tests/trip-loot-supply.test.ts src/tests/data-economy.test.ts src/tests/market-adapter.test.ts src/tests/market-ui-state.test.ts src/tests/ui-adapters.test.ts src/tests/price-import-notice.test.ts src/tests/market-server.test.ts src/tests/market-sync-items.test.ts src/tests/market-writer.test.ts src/tests/legacy-migration.test.ts src/tests/ui-view-model.test.ts`, passing 267 focused tests. The focused Loot/Economy Playwright smoke failed before browser execution with `listen EPERM: operation not permitted 127.0.0.1:5173`, matching the managed-sandbox localhost limitation and not superseding the earlier escalated 51/51 browser gate. No source formulas, fixture outputs or Playwright numeric expectations changed, so `npm run test:golden` was not rerun for that documentation/status closure.                                                                                                                                       |
| Goal 3 numeric snapshot audit                               | `pass with sandbox-limited browser rerun`                                 | On 2026-07-08, focused numeric domain/view-model evidence passed: `npm run test -- src/tests/domain-core.test.ts src/tests/trip-loot-supply.test.ts src/tests/xp-parity.test.ts src/tests/ui-view-model.test.ts src/tests/data-economy.test.ts` passed 173 tests, and `npm run test:golden` passed 19 tests. Focused numeric Playwright and full `npm run test:e2e` rerun attempts in the current managed sandbox both failed before browser execution with `listen EPERM 127.0.0.1:5173`; this is environment-only and does not supersede the earlier escalated 51/51 browser gate. No Playwright numeric expectations, source formulas or golden fixtures were changed.                                                                                                                                                                                                                                                                                                                                                                                 |
| Goal 4 release-gate refresh                                 | `pass with environment-only browser rerun limitation`                     | Goal 4 reran `npm run typecheck`, the focused Trip set `npm run test -- src/tests/trip-loot-supply.test.ts src/tests/ui-adapters.test.ts src/tests/ui-view-model.test.ts src/tests/scaffold.test.ts src/tests/xp-parity.test.ts` with 178 passing tests, full `npm run test`, `npm run test:golden`, `npm run build`, `npm audit`, the static DOM/code-execution search, the static secrets search, the broader URL/API-copy search and the live-integration release-copy audit. All non-browser gates passed or had documented residual classifications. The only non-pass command was the focused Trip/Cannon Playwright smoke, which failed before browser execution with the managed-sandbox localhost `EPERM` limitation above. No source formulas, fixture outputs or Playwright numeric expectations changed.                                                                                                                                                                                                                                      |
| Goal 5 Planner focused checks                               | `pass with environment-only browser rerun limitation`                     | Goal 5 reran `npm run typecheck`, `npm run test -- src/tests/planner-domain.test.ts src/tests/planner-ui-state.test.ts src/tests/planner-ui-adapter.test.ts src/tests/ui-view-model.test.ts src/tests/legacy-migration.test.ts` with 131 passing tests, `npm run test:golden` with 19 passing tests, `npm audit`, the static DOM/code-execution search, the static secrets search and a Planner/localStorage migration boundary search. Non-browser checks passed or had documented residual classifications. The focused Planner Playwright smoke `npm run test:e2e -- --workers=1 --grep "Planner"` failed before browser execution with `listen EPERM: operation not permitted 127.0.0.1:5173`, matching the managed-sandbox localhost limitation and not superseding the earlier escalated 51/51 browser gate. No Planner source formulas, fixtures, persisted schema versions or Playwright numeric expectations changed.                                                                                                                            |
| Goal 6 legacy migration focused checks                      | `pass with environment-only browser rerun limitation`                     | Goal 6 reran `npm run typecheck` and `npm run test -- src/tests/legacy-migration.test.ts src/tests/local-state-health.test.ts src/tests/ui-adapters.test.ts src/tests/market-ui-state.test.ts src/tests/price-import-notice.test.ts src/tests/planner-ui-state.test.ts` with 126 passing tests. The focused Import/Keep/Clear/local-state Playwright smoke `npm run test:e2e -- --workers=1 -g "legacy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | local state"`failed before browser execution with`listen EPERM: operation not permitted 127.0.0.1:5173`, matching the managed-sandbox localhost limitation and not superseding the earlier escalated 51/51 browser gate. Goal 6 changed documentation/status only: no source formulas, fixture outputs, persisted schema versions, localStorage key lists or Playwright numeric expectations changed, so `npm run test:golden` was not rerun. |
| D-042 Legacy Migration V1 custom/cannon import              | `unit/typecheck/focused browser pass`                                     | D-042 compatible nested `sim_input_v3.monsterSetups` and `sim_input_v3.cannonByMonster` import is implemented. `npm run test -- src/tests/legacy-migration.test.ts src/tests/ui-adapters.test.ts` passed 85 tests in the implementation pass; the current verification reran `npm run test -- src/tests/legacy-migration.test.ts` with 37 passing tests and `npm run typecheck` passed. The focused Playwright command suggested by the spec, `npm run test:e2e -- --grep "legacy migration"`, now starts under localhost escalation but selects no tests because current test titles do not contain that phrase. The equivalent current-title focused smoke `npm run test:e2e -- --grep "reviews and imports compatible legacy setup data                                                                                                                                                                                                                                                                                                                | keeps legacy data and dismisses the migration notice                                                                                                                                                                                                                                                                                                                                                                                          | clears only known legacy data after confirmation"` passed 3/3 tests in Chromium and covers compatible nested custom setup/cannon import plus Import/Keep/Clear boundaries. |
| Legacy Migration V1 UX/status closure                       | `unit/typecheck/focused browser pass`                                     | Goal 3 closed the user-facing review copy for the accepted V1 boundary. The Settings notice now shows a metadata-only outcome summary for importable, skipped and review-only areas, makes D-048 `sim_planner_v1` and D-049 full legacy price history explicit review-only/not-migrated decisions, and keeps Import/Keep/Clear status copy separate. `npm run test -- src/tests/legacy-migration.test.ts` passed 37 tests and `npm run typecheck` passed. The Playwright scaffold source checks the outcome copy, Import/Keep/Clear status messages and absence of raw planner/history payload sentinels. The spec-suggested grep selected no tests under localhost escalation, so the current-title focused smoke `npm run test:e2e -- --grep "reviews and imports compatible legacy setup data                                                                                                                                                                                                                                                          | keeps legacy data and dismisses the migration notice                                                                                                                                                                                                                                                                                                                                                                                          | clears only known legacy data after confirmation"` was run instead and passed 3/3 tests in Chromium.                                                                       |
| Goal 7 release-gate and status check                        | `historical core pass; browser refresh pending`                           | Goal 7 reran the then-current core release commands plus `npm audit`, static DOM/code-execution search, static secrets search, broader URL/API-copy search and live-integration release-copy audit. Non-browser checks passed or had documented residual classifications. The 2026-07-09 core refresh supersedes this row for non-browser gates; a localhost-capable browser smoke refresh is still needed for fresh browser evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-07-09 generated-data/backlog maintenance focused check | `focused pass, superseded by same-day core refresh for non-browser gates` | The generated-data/backlog pass changed generator report copy, generated-data review docs, backlog status, idea-inbox maintenance and the fixture-owned representative calculation-impact suite, expanding it from the original melee/ranged/magic fixture cases to 9 fixture-owned cases covering cannon, recoil, alch-policy, loot-heavy/nested-loot, high-defence-pressure and low-level paths too. `npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts` passed 57 tests, `npm run typecheck` passed and `git diff --check` passed. The later 2026-07-09 core refresh reran full unit, typecheck, golden, build, dependency audit and static release/security searches, but still does not claim fresh browser evidence.                                                                                                                                                                                                                                                                                                  |
| Legacy-derived static runtime bridge focused check          | `historical pass; superseded by D-059`                                    | This pass established the static snapshot and freshness gate while D-054 still kept it as root runtime truth. D-059 later superseded that bootstrap boundary after raw source coverage and impact evidence closed. The artifacts remain useful regression/reference evidence under `npm run runtime:write-legacy-derived -- --check`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Source-backed runtime coverage-plan focused check           | `historical focused pass; superseded by completed coverage`               | This pass added complete `missingIds`/`extraIds` arrays and `npm run runtime:coverage-plan` while source coverage was incomplete. The same command now reports zero blocking gaps for the active generated runtime.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Runtime monster combat-stat source-slice batch              | `historical focused pass; superseded by raw generator`                    | This normalized fixture batch introduced the combat-stat gate before raw loot integration. The active raw generator now supplies combat and 63/63 loot tables, including typed conditional rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Runtime combat catalog source-slice batch                   | `historical focused pass; superseded by raw generator`                    | This normalized fixture batch introduced weapon, ammo, spell and equipment field gates. The active raw generator now supplies all expected combat-catalog identities and accepted D-056/D-057 source deltas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Runtime item and PriceSet coverage batch                    | `historical focused pass; superseded by D-058/D-059/D-071`                | This normalized fixture batch introduced item and PriceSet gates. The active raw snapshot now uses distinct cut/uncut identities, 63 NPC sizes and 94 requirement rows, passes 11/11 representative cases, records 22 outliers in 189 evaluations and is root runtime under D-059.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npm audit`                                                 | `pass`                                                                    | 2026-07-10 reported 0 vulnerabilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `git diff --check`                                          | `pass`                                                                    | Passed after this documentation refresh.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Static DOM/code execution search                            | `pass with classified residual`                                           | Found trusted bundled legacy source execution `new Function` use in `src/adapters/legacy-runtime/source-bootstrap.ts` and `scripts/report-generated-runtime-readiness.ts`; both execute repository-owned legacy source files for reference/readiness/regeneration, not user input. The root app bootstrap uses `src/adapters/generated` and committed validated JSON instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Static secrets search                                       | `pass with false positives`                                               | Found item/package/doc/test text such as `token`, `js-tokens`, `css-tokenizer`, local-state-health fixture text and a URL password-rejection guard, with no real API key, secret, bearer token, password or private key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Release-copy audit                                          | `pass with classified residuals`                                          | Legacy `run_sim.py`, `/api/prices`, `/api/scrape` and legacy `/api/hiscores` hits remain archived evidence or documentation/history. Production rewrite paths use typed same-origin status/sync/lookup contracts and service-aware copy. The broader URL/API-copy audit also classifies CDN/Babel, `markets.lostcity.rs`, localhost and test URLs as archived legacy evidence, adapter/test contracts or documentation/history rather than production rewrite UI copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Repository-local visual regression                          | `pass on Darwin`                                                          | The current 77/77 functional gate remains the workflow/numeric owner. The separate [visual regression suite](visual-regression-spec.md) passed 20/20 against 31 reviewed Darwin baselines with deterministic state and explicit update policy. Remote merge-blocking status and a canonical CI platform baseline still need a separate CI decision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Live upstream integration calls                             | `opt-in pass; default tests mocked`                                       | Default tests stay mocked. Separate sanitized 2026-07-10 checks mapped seven combat skills from the accepted Hiscores provider with zero warnings and completed the 80-mapping market dry-run with 69 updated plus 11 retained/skipped rows and no writes. No raw provider/market payload or username was committed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Goal 3 numeric snapshot audit

Status date: 2026-07-10. This audit separates browser-rendered numeric snapshot
evidence from the historical UI-flow failure matrix. No active Playwright
numeric failure remains: the current production-preview `npm run test:e2e` gate
passes 57/57 against the source-backed runtime. Older localhost `EPERM`, timeout
and stale-locator rows below remain historical triage evidence only.

Current numeric failure classification summary:

| Class              |              Current count | Notes                                                                                                                                                                |
| ------------------ | -------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `regression`       |                          0 | No current numeric mismatch or calculation regression is evidenced.                                                                                                  |
| `stale-test`       |                          0 | No numeric expectation was found to be stale in the current passing gate.                                                                                            |
| `timing/flaky`     |    0 active / 2 historical | The superseded dense release-path and loot/trip numeric rows timed out before numeric assertions and are historical only after the later passing full browser gates. |
| `environment-only` | 1 current rerun limitation | Focused numeric Playwright and full e2e rerun attempts failed to start Vite with `listen EPERM 127.0.0.1:5173` in the managed sandbox.                               |
| `out-of-scope`     |                          0 | No numeric failure is removed from the gate as out of scope.                                                                                                         |

Numeric-path matrix:

| Test or path                                                                                                      | Feature area                                               | Current symptom                                                                                                                                              | Evidence                                                                                                      | Class                                              | Recommended decision                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `matches browser-rendered dense numeric snapshots`                                                                | Dense / metric strip / Cannon output                       | No current failure in the latest successful gate.                                                                                                            | Covered by the expanded 57/57 Playwright pass and all-fixture source-backed metric comparison.                | none active                                        | Keep expectation changes tied to source-backed view-model or parity evidence. |
| `matches release-path dense numeric snapshots`                                                                    | Dense release path / metric strip                          | No current failure in the latest successful gate. Historical failure was a timeout before numeric assertions while setting up the large multi-scenario path. | Expanded 57/57 Playwright pass plus Goal 3 focused domain/view-model and golden pass.                         | historical `timing/flaky`                          | Do not treat the historical timeout as a numeric delta.                       |
| `matches browser-rendered numeric snapshots for loot action and trip overrides`                                   | Loot action override / Trip manual controls / metric strip | No current failure in the latest successful gate. Historical failure timed out while editing `Recoil rings`; no numeric mismatch was reported.               | Expanded 57/57 Playwright pass plus Goal 3 focused trip/loot, XP, UI view-model and golden pass.              | historical `timing/flaky`                          | Keep expectation changes tied to source-backed view-model or parity evidence. |
| `matches browser-rendered numeric snapshots for imported price sets`                                              | PriceSet import / money metrics                            | No current failure in the latest successful gate.                                                                                                            | Covered by the expanded 57/57 Playwright pass and `src/tests/data-economy.test.ts` in the Goal 3 focused run. | none active                                        | Live market upstream parity remains outside automated browser tests.          |
| `enables cannon for the selected monster and shows cannon rates` and Cannon numeric output inside dense snapshots | Cannon / Trip sparse link / metric strip                   | No current failure in the latest successful gate. Historical Cannon row was a tab actionability timeout after reload, not a numeric mismatch.                | Expanded 57/57 Playwright pass plus Goal 3 focused trip/loot, XP and UI view-model pass.                      | none active; related historical row `timing/flaky` | Keep current Cannon output expectations.                                      |

Expectation and baseline policy for this audit:

- No Playwright numeric expectation was updated.
- No source calculation formula was changed.
- No legacy golden fixture was regenerated or edited.
- The accepted ring-of-recoil XP attribution delta remains the existing D-031
  line; Goal 3 did not add a new intentional numeric delta.
- The accepted Dense/Compare browser numeric scope remains D-032. Full
  all-fixture browser-display parity and full visual regression are not release
  requirements without a future decision.

## Superseded Playwright smoke failure matrix

Status date: 2026-07-08. This matrix records the pre-stabilization default
`npm run test:e2e` failure triage for the Vite/React rewrite. It is retained as
release-evidence history only. The latest browser-executed default gate is the
later full `npm run test:e2e` pass above: 51 passed out of 51 tests after
localhost sandbox escalation. The later managed-sandbox browser refresh attempt
could not refresh that browser gate, and the 2026-07-09 core refresh did not
rerun browser smoke.

Classification meanings:

- `regression`: the failing assertion points at a user-visible workflow or
  persisted-state contract that appears wrong or incomplete.
- `stale-test`: the tested behavior appears present, but the assertion is
  targeting it in a way that no longer matches the current DOM/accessibility
  shape.
- `timing/flaky`: the failure is dominated by actionability, locator stability,
  clock/debounce timing or a mismatch between the assertion log and the final
  error-context DOM.
- `environment-only`: caused by the managed sandbox or local browser/runtime
  environment rather than the app. The pre-escalation `listen EPERM` failure is
  environment-only; none of the 19 escalated browser failures are classified
  this way.
- `out-of-scope`: the test asserts behavior outside the accepted current
  release gate. No current failure is classified this way without a future
  explicit decision.

The recommendations in the rows below are the original triage decisions from
the superseded failing run. They are not the current release-gate state after
the later 51/51 default Playwright pass.

| Test                                                                             | Feature area                         | Symptom                                                                                                                                                        | Likely cause                                                                                                                                                                            | Class                                                 | Recommended release-gate decision                                                                                                                       |
| -------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loads the dense combat spreadsheet root`                                        | Economy / market copy                | Strict-mode failure: the scheduled market refresh copy resolves to two elements inside `Market price data`.                                                    | The production copy is present twice, once as neutral paragraph copy and once as a status message. The locator is too broad for current UI.                                             | `stale-test`                                          | Do not treat as a product blocker after narrowing the assertion; keep the overall e2e gate failed until the test is updated or explicitly reclassified. |
| `places MonsterCard after the active pane on mobile`                             | Mobile shell / MonsterCard           | `.workbench-shell > *` returned an empty array even though the error context shows `Workbench shell`, `Player sidebar`, `Workbench center` and `Monster card`. | The test evaluates a CSS selector immediately after navigation without first waiting for the shell, while the accessible layout is present in the failure context.                      | `timing/flaky`                                        | Keep as a browser-smoke blocker until a focused rerun or test hardening proves mobile ordering reliably passes.                                         |
| `recomputes the Planner tab workflow from visible planner controls`              | Planner                              | Timeout while checking `Lock Attack`; the checkbox resolves but the action never completes.                                                                    | Planner UI is present, but the control is not actionably stable during the test window, likely due render/workload timing or locator actionability.                                     | `timing/flaky`                                        | Keep as a release gate failure for the visible Planner workflow until focused Planner smoke is stable.                                                  |
| `uses the Duel tab to snapshot rename load delete and persist setup comparisons` | Duel snapshots                       | After Undo, the undo status says the snapshot was restored, but the rename control for `Melee saved` is not visible.                                           | Likely Duel undo/table refresh regression, or a stale table reference after restore. The current context shows only the live setup row.                                                 | `regression`                                          | Release-blocking for the Duel workflow unless a focused rerun proves it is flaky and not a state bug.                                                   |
| `restores per-combat-style loadout edits when switching styles`                  | Basic combat setup / per-style state | Ranged `BOOST` is expected to restore to `ranging`, but the compact selector was empty in the historical full default run.                                     | Likely per-style boost restore or compact boost synchronization regression in that run; the focused Goal 1 rerun passed after the combat-style tab routing fix.                         | `regression` in historical run; focused rerun `pass`  | Remove from the remaining likely-regression list after the next full default gate confirms the focused result.                                          |
| `edits combat equipment panes and persists style-specific selections`            | Equipment loadout persistence        | Timeout clicking the `Melee` tab after reload; the tab resolves but does not become actionably stable.                                                         | Reload/tab actionability timing issue is more evident than a numeric or persisted-value mismatch.                                                                                       | `timing/flaky`                                        | Keep as a smoke-gate failure; confirm with focused rerun before classifying as product regression.                                                      |
| `creates, restores and removes monster-specific custom setups`                   | Custom setup snapshots               | After Undo for removed custom setup, `Setup context` does not contain `Custom setup`.                                                                          | Likely custom setup undo or setup-context refresh regression.                                                                                                                           | `regression`                                          | Release-blocking for monster-specific setup workflow until fixed or reclassified with evidence.                                                         |
| `selects special attacks and shows special metrics`                              | Special attacks                      | Assertion times out on DBA boost explanatory copy, while the error context shows the same copy inside `Special attack` in the last full default run.           | The expected UI exists in the final context; the focused Goal 1 rerun passed after tab-route and locator hardening, so this is not treated as missing visible special-attack behavior.  | `timing/flaky` in last full run; focused rerun `pass` | Keep the full smoke gate failed until rerun, but do not treat this row as a remaining Special attacks product blocker.                                  |
| `shows dense compare calculation freshness while rows catch up`                  | Dense compare freshness              | Status changes to `Updating`, but the panel text still reads `current loadout` and not `rows may reflect previous loadout` in the last full default run.       | The focused Goal 2 rerun passed after narrowing the smoke expectation to the status pill and live-row interaction, so this is not treated as a remaining Dense Compare product blocker. | `regression` in last full run; focused rerun `pass`   | Remove from the remaining likely-regression list after the next full default gate confirms the focused result.                                          |
| `matches release-path dense numeric snapshots`                                   | Dense numeric release path           | Test hits its 60s timeout and the page closes while selecting Loot high-alch settings; no numeric mismatch is reported.                                        | Large multi-scenario test is timing out before the assertion payload, likely due actionability/performance rather than a proven numeric delta.                                          | `timing/flaky`                                        | Keep the smoke gate failed, but do not update numeric snapshots from this result. Split or harden before treating it as a calculation regression.       |
| `enables cannon for the selected monster and shows cannon rates`                 | Cannon                               | After reload, clicking the `Cannon` tab times out while waiting for the tab to be stable.                                                                      | The Cannon state appears active in the error context, but the tab click after reload is not actionably stable.                                                                          | `timing/flaky`                                        | Keep as a smoke-gate failure; focused Cannon smoke should determine whether there is a reload/state regression.                                         |
| `updates trip survival controls and keeps the trip summary visible`              | Trip survival summary                | Assertion times out looking for `Antifire`, while the error context shows `Antifire` and `Antipoison` in the Trip summary.                                     | Locator/timing mismatch; the expected summary state is present in the final browser context.                                                                                            | `timing/flaky`                                        | Keep as a smoke-gate failure until the Trip summary locator or timing is hardened.                                                                      |
| `updates manual food controls and recoil ring count`                             | Trip food / recoil persistence       | After reload, `Food mode` is expected as `manual`; the error context shows Manual food and `Recoil rings` value `6`.                                           | Final DOM contains the expected controls and values, pointing to locator/timing mismatch rather than proven app failure.                                                                | `timing/flaky`                                        | Keep as a smoke-gate failure; focused rerun should decide if the persistence path is actually stable.                                                   |
| `updates trip food, banking and inventory reserve controls across styles`        | Trip controls across styles          | Test hits its 60s timeout and page closes while switching back to Trip after Magic.                                                                            | Long cross-style scenario exceeded the test window; no specific value mismatch was captured.                                                                                            | `timing/flaky`                                        | Keep as a smoke-gate failure; split or focus before treating as product regression.                                                                     |
| `updates trip potion carry controls and grouped potion summary`                  | Trip potion carry                    | Visible summary reaches `6 doses/type`, but `waitForFunction` never observes the expected persisted setup substrings.                                          | Likely persistence regression or stale persistence-shape expectation for single-dose potion state.                                                                                      | `regression`                                          | Release-blocking until the persisted contract is verified and either code or test expectation is corrected with evidence.                               |
| `updates prayer restore detail controls and keeps the trip summary visible`      | Trip prayer restore                  | After reload, clicking `Trip` times out while the tab resolves but does not stabilize.                                                                         | Reload/tab actionability timing dominates; no persisted-value mismatch is reached.                                                                                                      | `timing/flaky`                                        | Keep as a smoke-gate failure; focused Trip prayer smoke should decide whether persistence is actually broken.                                           |
| `updates per-monster loot settings and keeps them after reload`                  | Loot/economy settings persistence    | After reload and target selection, clicking `Loot` times out; context shows Green Dragon markers in Compare.                                                   | The test does not reach value assertions; tab actionability after reload is the immediate failure.                                                                                      | `timing/flaky`                                        | Keep as a smoke-gate failure; focused Loot settings smoke should confirm whether state reload works.                                                    |
| `resets one Active modifiers loot row while preserving neighboring loot state`   | Active assumptions / Loot reset      | After resetting loot settings, assertion says `Active assumptions` is empty, but the error context shows `Loot action overrides` and no `Loot settings`.       | Final UI matches the intended post-reset state, so the failure looks like locator/timing mismatch.                                                                                      | `timing/flaky`                                        | Recommended reclassification to test-hardening work after focused confirmation; keep the full e2e gate failed meanwhile.                                |
| `matches browser-rendered numeric snapshots for loot action and trip overrides`  | Loot / Trip numeric snapshots        | Timeout filling `Recoil rings`, while the error context shows the input at value `6`.                                                                          | Actionability/timing issue before numeric assertions; no snapshot value mismatch is reported.                                                                                           | `timing/flaky`                                        | Keep as a smoke-gate failure; do not update snapshots from this result.                                                                                 |

Summary for the superseded full default run: 5 likely `regression` failures, 1 `stale-test`, 13
`timing/flaky`, 0 escalated-browser `environment-only` failures and 0
`out-of-scope` failures. The pre-escalation `listen EPERM` failure remains an
environment-only managed-sandbox limitation and is not counted in the 19 browser
failures. These rows have been superseded by the later 51/51 default Playwright
pass and are no longer active release blockers.

Focused Goal 1 and Goal 2 follow-ups on 2026-07-08 isolated the failing browser
paths before the final full-suite pass. The final default `npm run test:e2e`
rerun replaces the matrix as current release evidence.

Security and privacy notes for this run: tests used localhost Vite plus mocked
or same-origin API paths. The market source URL appears only as test fixture
metadata. No live hiscores lookup, live market upstream call, raw browser
storage payload, user player name, secret, token or machine-specific path is
recorded in this matrix. Tenant risk is not applicable because this checkout has
no tenant model.

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

Representative direct Dense Compare/Planner and maximum Duel matrix calculations exceeded this budget, so all three heavy paths now use `src/app/calculation-task.ts` through a cancellable one-shot Web Worker. Pure dispatch, structured-clone safety, success/failure and cancellation are covered by:

```sh
npm run test -- src/tests/calculation-task.test.ts src/tests/ui-performance.test.ts
```

The production-preview smoke installs a Chromium Long Task observer, triggers Compare, Planner and Duel through visible controls and rejects tasks over 200 ms:

```sh
npm run test:e2e -- --grep "keeps Compare, Planner and Duel worker calculations off the main event loop"
```

Tests should continue to cover level-input updates because that path has already shown visible jank. Do not move formulas or calculated output into worker-owned persistence; requests/results stay structured-cloneable and superseded work must remain cancellable.

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

The ring-of-recoil delta is accepted in [D-031](../project/decisions.md): legacy remains comparison evidence, but rewrite combat XP is not reduced by trip-layer recoil damage. `totalXpPerHour` is compared for every non-recoil fixture by summing the rewrite-owned XP source rows. Prayer XP is derived from current trip/loot bury data, Magic alch XP is derived from tracked in-trip alch casts at 65 XP per cast, and cannon ranged XP remains a separate effective XP row.

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
- `src/tests/e2e/scaffold.spec.ts`

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
ownership-only refactor is specified in
[legacy-migration-layer-refactor-spec.md](legacy-migration-layer-refactor-spec.md).

The legacy storage migration unit tests live in:

```sh
npm run test -- src/tests/legacy-migration.test.ts src/tests/ui-adapters.test.ts
```

The 2026-07-10 Duel migration extension passed this focused command with 89/89
tests plus `npm run typecheck`. Its browser assertion is part of `reviews and
imports compatible legacy setup data`, and the current full production-preview
gate passes 57/57.

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
- `src/tests/e2e/scaffold.spec.ts`

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
[risk-variability-spec.md](risk-variability-spec.md). The focused domain suite
is `src/tests/risk-analysis.test.ts`; it covers deterministic PRNG vectors,
identical-input reproducibility, ordered finite quantiles, probability bounds,
analytic drop fixtures, food-sufficiency edge cases, invalid targets,
stochastic coverage, exact source-backed incoming sampling, partial and
compatibility mean-only coverage and bounded full-day hour-block composition.

Run at minimum:

```sh
npm run test -- src/tests/risk-analysis.test.ts src/tests/calculation-task.test.ts src/tests/ui-view-model.test.ts
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
- supported special attack state to `SimulationRequest.specialAttack` mapping, including ranged spec-arrow fallback, DBA boost suppression and magic unsupported fallback
- source-backed size-1/large dragon halberd selected-target behavior plus warning surfacing only for the missing-size legacy fallback
- manual accuracy/damage/speed override state to `SimulationRequest.manualOverrides` mapping and visible combat metric changes
- MonsterCard view-model contract for nullable monster stats, active defence rows and compact setup summaries
- extended trip-control state to `TripPolicy` mapping without leaking trip fields into `SimulationRequest`
- scarce/AFK Trip controls, inventory reserve details, prayer restore capacity, Trip summary Auto/Manual wording and derived general potion recommendation status/`canApply` state in the UI view model
- domain-backed result, compare and planner view models
- Stats combat roll detail metrics for melee/ranged/magic paths and fallback rendering for unavailable roll values; active setup `Damage distribution` view-model labels, bucket accessibility text and probability-total invariants; and TTK/kills/hr/GP/kill mapping
- Stats source breakdown view-model rows and source-detail records for normal attack, special attack and cannon statuses, including normal and event-scoped source histograms, melee/ranged modeled special detail, magic/DBA fallback detail, dragon-halberd partial warning detail, cannon-enabled metrics and idle cannon detail; plus XP routing rows, cannon-only XP row visibility, modeled Prayer/Magic-alch total-XP rows and Trip/banking summary mapping
- Stats event-scoped special-hit and fired-cannonball histograms, probability totals, partial-special support and inactive/idle null states
- active assumptions/modifiers summary view-model rows for empty/default state, manual combat overrides, enabled cannon settings, loot settings, loot action overrides, imported/synced PriceSet modifiers, money warnings, dragon-halberd special warning, explicit safespot and protection-prayer split rows, targeted reset metadata, review-only boundaries, reset scoping and stable priority order/five-row overflow
- Duel comparison view-model rows for live setup and saved snapshots against the current monster, including deltas and best-marker fields
- Duel structured setup diffs, shared-context exclusions and expanded combat/trip/XP/economy impact deltas
- structured money warning view models for price alias and fallback surfacing
- random-herb `Unid` valuation through all eleven source item ids, exact-price
  precedence, weighted EV, selected-row/nested-row presentation and the visible
  generic `unidentified_guam` proxy warning when species prices are absent
- dense compare monster/drop filters, irrelevant monster state, active-target forced visibility and derived row state markers
- dense compare XP/hr and net GP/hr visible-row scale affordance model, including separate positive and negative net GP/hr scaling
- special attack result metrics in the UI view model
- numeric summary parity for the default melee fixture and a ranged safespot fixture
- cannon-enabled view-model coverage for visible XP/hr, GP/hr, net GP/hr and supply changes
- linked cannon/sparse assumptions, cannon reserve impact and cannonball supply costs in the UI view model
- a performance smoke test that keeps the immediate level-input calculation path smaller than compare/planner full-panel work
- versioned rewrite setup persistence through `PersistedEnvelope<T>`
- separate versioned Duel snapshot persistence under `index-sim:duel-snapshots`, including snapshot name/form normalization, max-list limits, strict export/import envelope validation, safe merge behavior and rejection of computed-result payloads
- dense compare filter defaults, persisted irrelevant monster state and cleanup of unknown monster ids
- per-combat-type loadout stash/restore, persisted schema validation and active loadout mapping into `SimulationRequest`
- multi-prayer and multi-boost normalization, canonical `None` handling, unknown id dropping and same-category replacement before `SimulationRequest`
- manual combat override persistence/defaulting and bounded domain behavior
- active weapon, gear, ammo and spell selection mapping into `SimulationRequest`, including two-handed weapon shield lock/clear behavior
- deterministic visible-candidate gear quick actions for the active combat style, including current-selection ties, shield-lock disabled state and generated-or-fallback requirement reason copy
- rewrite-owned monster-specific custom setup create/restore/remove helpers, persisted schema validation and dense row marker/calculation mapping
- per-monster loot settings for high-alch enablement, kill overhead and talisman spot, with separate persistence and reset helpers from `index-sim:loot-prefs`
- defaulting and sanitization for newly modeled trip-control fields in persisted rewrite setups
- defaulting and sanitization for special attack controls in persisted rewrite setups, including unknown, combat-style-incompatible and DBA-conflicting active/per-style/custom setup state
- versioned per-monster cannon settings persistence in the rewrite setup envelope
- derived general potion recommendations staying out of persisted rewrite setup state
- versioned last-player hiscores and browser-local price history persistence through `PersistedEnvelope<T>`
- shared plus browser-local Economy movers/trends, `Save local comparison` and confirmed `Clear local history` that removes only `index-sim:price-history`
- refusal to implicitly migrate mismatched persisted versions
- validated `PriceSet` import errors with non-fatal UI notices and retry recovery
- non-fatal rewrite setup import failures for invalid JSON, unsupported setup versions, invalid schema data and oversized files, preserving the visible and persisted setup while leaving file input retryable
- Playwright smoke covers the workbench shell and complete accepted workflow inventory, including generated requirement copy and the remaining missing-size legacy dragon-halberd warning path; detailed cases live in `src/tests/e2e/scaffold.spec.ts` and the visual matrix.

Run the focused browser smoke for the visible Stats workflow with:

```sh
npm run test:e2e -- --grep "Stats"
```

Run the focused browser smoke for the accepted Goal 1 Combat/Stats/Special slice
with:

```sh
npm run test:e2e -- --workers=1 -g "restores per-combat-style"
npm run test:e2e -- --workers=1 -g "shows Stats XP routing"
npm run test:e2e -- --workers=1 -g "selects special attacks"
npm run test:e2e -- --workers=1 -g "explains setup ownership"
```

The setup-ownership case verifies current prayer/boost, potion-carry/prayer
restore and loot-policy summaries, the negative net-GP supply gap, direct Trip
and active-style navigation and the explicit combat-potion labels. The
2026-07-11 focused Chromium run passed this case together with desktop console,
mobile order, multi-prayer/multi-boost and potion-carry coverage (5/5).

Run the focused browser smoke for the Dense Compare scale indicators with:

```sh
npm run test:e2e -- --grep "dense XP"
```

Run the focused browser smoke for Dense Compare calculation freshness with:

```sh
npm run test:e2e -- --grep "calculation freshness"
```

Run the focused browser smoke for Dense Compare release-path numeric snapshots with:

```sh
npm run test:e2e -- --grep "release-path dense"
```

Run the focused browser smoke for the accepted Goal 2 Dense/Compare slice with:

```sh
npm run test:e2e -- --workers=1 -g "keeps the desktop workbench inside one console viewport"
npm run test:e2e -- --workers=1 -g "keeps long selected monster names readable"
npm run test:e2e -- --workers=1 -g "keeps compact setup actions, Risk controls and Duel summaries readable"
npm run test:e2e -- --workers=1 -g "keeps every workbench tab inside a narrow mobile viewport"
npm run test:e2e -- --workers=1 -g "keeps search inside the dropdown and supports keyboard selection"
npm run test:e2e -- --workers=1 -g "uses popup search for every primary long-choice field"
npm run test:e2e -- --workers=1 -g "keeps the Food dropdown search and results inside the mobile viewport"
npm run test:e2e -- --workers=1 -g "keeps Dense Compare mobile and tablet overflow contained"
npm run test:e2e -- --workers=1 -g "shows dense compare calculation freshness"
npm run test:e2e -- --workers=1 -g "filters dense compare rows and persists hidden monsters"
npm run test:e2e -- --workers=1 -g "shows dense row markers"
npm run test:e2e -- --workers=1 -g "matches browser-rendered dense numeric snapshots"
npm run test:e2e -- --workers=1 -g "sorts the full monster table and selects a target row"
```

The desktop console case fixes the viewport at 1280×720, waits for the dense
rows, asserts that document/body height stays inside the viewport, verifies
`auto` vertical overflow ownership for PlayerSidebar, the active pane and
MonsterCard, scrolls the two overflowing regions and confirms `window.scrollY`
remains zero. The mobile/tablet case continues to own normal document flow,
pane order and horizontal table containment. The 2026-07-11 focused Chromium
run passed all three desktop-console, mobile-order and mobile/tablet-overflow
cases (3/3).

The long-value case selects Water Elemental through the setup context, verifies
that both synchronized monster selects expose the complete label, measures the
rendered label against usable select width at 1280x720 and confirms that setup
guide summaries use wrapping rather than ellipsis.

The whole-UI audit regressions cover the compact setup action row, Risk action
containment, Duel summary wrapping, the shared popup-combobox presentation and
document-width/setup-context containment for every workbench tab at 390x844.
The keyboard case filters and selects Magic `Fire Wave`; the inventory case
opens the setup/MonsterCard targets, weapon, every gear slot, ammo, spell, Trip
food, Risk target drop and Economy snapshot/trend-item popups and confirms the
search stays inside each. The mobile case checks the Food popup and selected
Swordfish state at 390x844. The Settings recovery case verifies that a large
legacy-migration notice owns a bounded desktop scroll area instead of covering
workbench controls. The final full gate passed 73/73 browser cases; `npm run verify` passed 586 unit tests,
19/19 legacy goldens, build/artifact, lint, format and diff checks with artifact
SHA-256 `66f25a71cabfd55811a51f78303b34bfb7f49b6d026f188ba2c97c7ddebd431c`.

Run the focused browser smoke for the accepted Loot/Economy slice with:

```sh
npm run test:e2e -- --workers=1 -g "updates per-monster loot settings"
npm run test:e2e -- --workers=1 -g "updates current monster loot actions"
npm run test:e2e -- --workers=1 -g "shows loot value composition"
npm run test:e2e -- --workers=1 -g "renders scheduled price status"
npm run test:e2e -- --workers=1 -g "keeps market UI scheduled-only"
npm run test:e2e -- --workers=1 -g "analyzes and manages browser-local price history"
npm run test:e2e -- --workers=1 -g "keeps shared scheduled price history"
```

Run the focused browser smoke for the accepted Trip slice with:

```sh
npm run test:e2e -- --workers=1 -g "updates trip survival controls"
npm run test:e2e -- --workers=1 -g "updates manual food controls"
npm run test:e2e -- --workers=1 -g "updates trip food, banking"
npm run test:e2e -- --workers=1 -g "updates trip potion carry"
npm run test:e2e -- --workers=1 -g "shows inactive trip potion recommendation"
npm run test:e2e -- --workers=1 -g "updates prayer restore detail"
npm run test:e2e -- --workers=1 -g "enables cannon"
```

Run the focused browser smoke for local destructive-action Undo coverage with:

```sh
npm run test:e2e -- --grep "Duel tab|custom setups|loot actions|Active modifiers loot"
```

Dense/Compare release classification: D-032 accepts the release-path browser
numeric snapshots as sufficient for the current Dense/Compare release slice.
The optional all-fixture browser-display expansion and repository-local visual
suite are now implemented evidence; only pane-level detail beyond the covered
states and promotion to a canonical remote merge gate remain later decisions.

Run the focused browser smoke for Dense Compare mobile/tablet overflow containment with:

```sh
npm run test:e2e -- --grep "Dense Compare mobile"
```

Run the focused browser smoke for the visible Duel workflow with:

```sh
npm run test:e2e -- --grep "Duel"
```

For the bounded setup-diff extension, the minimum focused validation is:

```sh
npm run test -- src/tests/ui-view-model.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 --grep "uses the Duel tab"
git diff --check
```

The view-model case verifies user-facing item labels, all exposed impact deltas,
the null live-row diff and exclusion of the shared target, Planner targets and
inactive per-style caches. The browser case verifies the visible DPS delta and
the `aria-expanded`/`aria-controls` review flow. It does not require a snapshot
schema migration or live upstream test.

For Stats source distributions, use:

```sh
npm run test -- src/tests/ui-view-model.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 --grep "selects special attacks|enables cannon"
git diff --check
```

The unit cases verify per-special-hit and per-fired-cannonball inputs against the
existing domain results, probability totals close to one, partial dragon-halberd
status and null inactive/idle histograms. The focused browser cases verify scope
copy and accessible bucket lists. No live upstream or visual baseline update is
required; the existing Stats visual fixture has inactive special/cannon sources
and the normal histogram presentation remains shared and unchanged.

For the bounded workbench keyboard pass, run:

```sh
npm run typecheck
npm run test:e2e -- --workers=1 --grep "loads the dense combat spreadsheet root|supports bounded keyboard navigation"
npm run test:e2e -- --workers=1
git diff --check
```

The focused case owns skip-link, tablist/tabpanel, roving focus and computed
focus-outline assertions. Because the semantic role change updates Workbench
locators throughout the browser suite, the complete Playwright run is required
for this goal. No live upstream service is involved.

## Rewrite setup file-transfer controller validation

The current parser truth remains in `src/tests/setup-import.test.ts`, with
persistence and recovery coverage in `ui-adapters.test.ts` and
`local-state-recovery-controller.test.ts`. The implemented
[setup file-transfer controller specification](setup-file-transfer-controller-spec.md)
adds the DOM-free controller suite plus successful import/export browser
coverage. `App.tsx` now owns only the typed Apply and input-reset bridges.

Run at minimum after changes to this boundary:

```sh
npm run test -- src/tests/setup-file-transfer-controller.test.ts src/tests/setup-import.test.ts src/tests/ui-adapters.test.ts src/tests/local-state-recovery-controller.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "setup import|Export setup"
npm run test:e2e -- --workers=1
npm run verify
git diff --check
```

The controller suite passes 12/12, the combined command 78/78, targeted browser
coverage 2/2 and the complete Chromium gate 77/77. The existing failure/retry
case and new successful transfer/export case jointly own the browser regression
boundary.

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
- Combat math: `npm run test` and `npm run test:golden`.
- Combat/equipment domain changes: `npm run test`, including `src/tests/domain-core.test.ts`, and `npm run test:golden`. Run `src/tests/trip-loot-supply.test.ts` and `src/tests/xp-parity.test.ts` too when timing, DPS, prayer, recoil or incoming-damage outputs can affect trip or XP results.
- Composed simulation result contract or main view-model result-source changes: run `npm run typecheck` and `npm run test -- src/tests/full-simulation-result.test.ts src/tests/domain-core.test.ts src/tests/trip-loot-supply.test.ts src/tests/xp-parity.test.ts src/tests/ui-view-model.test.ts src/tests/data-economy.test.ts`. This validates the `CombatSimulationResult`/`FullSimulationResult` boundary against current combat, trip, XP, economy and UI view-model evidence without requiring Playwright unless visible UI behavior changes.
- XP calculation or XP row changes: `npm run test -- src/tests/xp-parity.test.ts`, `npm run test`, and `npm run test:golden` when current-behavior parity can change.
- Trip/loot/supply domain changes: `npm run test -- src/tests/trip-loot-supply.test.ts`, `npm run test`, and `npm run test:golden` when current-behavior parity can change. Include `src/tests/xp-parity.test.ts` when `effectiveKph`, recoil, poison or cannon behavior can affect XP/hr.
- Risk/variability changes: `npm run test -- src/tests/risk-analysis.test.ts src/tests/calculation-task.test.ts src/tests/ui-view-model.test.ts`, `npm run typecheck`, representative performance coverage and the focused `Risk` Playwright workflow. Run the full unit, golden, build and browser gates before delivery; stochastic tests use fixed seeds and analytic/property tolerances.
- Data or prices: JSON parse, `npm run test -- src/tests/data-economy.test.ts`, and representative simulation fixtures when simulation behavior can change.
- Generated runtime readiness: `npm run test -- src/tests/generated-runtime-adapter.test.ts`, `npm run runtime:readiness -- --example-limit 5`, `npm run runtime:coverage-plan -- --example-limit 5`, `npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts src/tests/trip-loot-supply.test.ts`, `npm run test:golden`, `npm run typecheck` and `git diff --check`. The default readiness command is blocking and must stay green for the active snapshot. Use `--allow-not-ready` only for deliberate incomplete local candidates. Rerun full domain/golden/browser evidence for generated snapshot value or bootstrap changes.
- Planner: `npm run test -- src/tests/planner-domain.test.ts` for gear eligibility, scoring, stance selection and golden plan fixtures. Run full `npm run test` if planner changes interact with combat, trip, data or economy contracts.
- UI/view-model changes: `npm run test -- src/tests/ui-view-model.test.ts`, `npm run test`, `npm run build` and `npm run test:e2e` when browser behavior changes.
- Performance-sensitive UI/view-model changes: include `src/tests/ui-performance.test.ts` and browser smoke where possible; compare the level-input path and representative compare/planner workloads against the accepted performance budget.
- Market/import logic: unit tests with mocked price sources and malformed data; include `src/tests/ui-adapters.test.ts` for rewrite price imports and `src/tests/market-ui-state.test.ts` for selected active `PriceSet` persistence, restore and failure behavior.
- Manual item-price overlay: include `src/tests/market-ui-state.test.ts`, `src/tests/local-state-health.test.ts` and the focused Economy Playwright draft/base-change/reload/reset/capacity workflow. Confirm the base PriceSet and high-alch values are unchanged, item metadata becomes manual, unavailable stored ids stay inactive without deletion, a draft cannot move with the separate Trend item selector, the 512-row guard is non-throwing, the local key clears after the final reset and calculated consumers receive a new composed PriceSet identity.
- Conditional loot presentation: include `src/tests/ui-view-model.test.ts` plus the focused Loot Playwright disclosure workflow. Confirm conditional rows remain locked/zero in the view model, are absent from the ordinary action table, and expose source chance plus sanitized eligibility only after the collapsed disclosure is opened.
- Live integrations: `npm run test -- src/tests/live-integrations.test.ts src/tests/hiscores-server.test.ts src/tests/hiscores-adapter.test.ts src/tests/hiscores-ui-state.test.ts src/tests/hiscores-lookup-controller.test.ts src/tests/market-sync-items.test.ts src/tests/market-server.test.ts src/tests/market-adapter.test.ts src/tests/market-ui-state.test.ts` plus `npm run test` when shared schemas or API adapters are touched. Use mocked hiscores and market service tests only; do not call live upstream services in automated tests. Cover request validation, allowlisted market item mapping, upstream-invalid responses, request races, partial market failures and UI apply/failure behavior.
- Persistence changes: migration/version tests for `localStorage` keys; include `src/tests/ui-adapters.test.ts` and `src/tests/market-ui-state.test.ts` for price selection/history keys, and include `src/tests/legacy-migration.test.ts` when legacy key detection or setup/hiscores/price compatibility mapping changes.
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

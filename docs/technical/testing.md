# Testing

## Current state

The root app path uses the Vite/React rewrite and has npm scripts for TypeScript, Vite, Vitest, Playwright, ESLint and Prettier. The archived legacy app in `legacy/index.html` still transforms JSX in the browser by Babel Standalone and has no local JSX typecheck/build step.

Use [rewrite-parity-report.md](rewrite-parity-report.md) to interpret which user-visible calculation areas are currently legacy-parity certified, partially covered or not ported.

Accepted parity policy: legacy results are regression evidence, not the final truth source. Keep golden tests to catch accidental changes, but allow documented intentional deltas when the current accepted LostCityRS/Content revision or another accepted source shows the legacy app should be replaced.

Game revision bumps are development changes, not scheduled data refreshes. The current generator exposes `npm run data:generate` for repository-local source/output-path validation, raw LostCity config/RuneScript parsing, schema-valid output writing and a committed revision-impact report. It writes one current source-backed snapshot at `src/data/generated/game-data.json`; git history and PR diffs provide the review baseline. D-059 makes that committed Revision 274 snapshot the root runtime through `src/adapters/generated`, with scheduled static prices first and generated item fallbacks second. The legacy-derived snapshots remain regression/reference inputs and are not the root bootstrap. Runtime readiness blocks missing expected identities, required simulator fields, monster combat/loot rows and PriceSet coverage; accepted source value changes belong to revision-impact evidence. The current snapshot is ready with zero blockers, the representative suite passes 10/10 cases under D-055/D-057, and the 189-evaluation informational scan records 22 advisory outliers. Snapshot validation rejects raw upstream dump shapes, historical snapshot archives and unused source-only content. Planner/setup/quick-action requirement consumers use generated requirements when present and the D-051 manual fallback when the active raw snapshot lacks an authoritative requirement skill map. Do not hand-edit generated source truth, include quest/clue exclusions, remove the requirement fallback or refresh accepted calculation baselines without the corresponding evidence and decision.

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
npm run test
npm run build
npm run lint
npm run format:check
```

Playwright and visual suites remain separate environment-dependent gates.

Node 22 and npm 10 are the repository runtime contract. `.nvmrc`, the root
`package.json` engines and the scheduled workflow use the same major versions.

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
Vite JavaScript/CSS references, `prices.json`, `alch.json` and
`price-history.json`; validates the static security/cache policy, market schemas
and `_scraped_at`; rejects unexpected files, source maps, symlinks, local paths
and common secret material; and prints only bounded metadata plus SHA-256.

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

The current Darwin set contains 23 fixture-only PNGs from 19 scenarios. It
covers desktop/mobile root, desktop/tablet Compare, all three loadouts, Stats,
desktop/mobile Trip and Loot, fixed local Economy history, enabled Dagannoth
Cannon, desktop/mobile Planner and Duel matrix, and Settings recovery/legacy
review. Browser time is fixed at `2026-07-10T12:00:00.000Z`, live integration
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
the expanded default Playwright gate passes 57/57. The first focused run found
that the browser's dynamically loaded scheduled snapshot had dropped generated
item/alch fallbacks; `src/app/state/market-sync.ts` now composes those fallbacks
without overriding scheduled values, with focused unit coverage.

In the managed Codex sandbox, Node-based localhost connections can fail with `EPERM`.
When that happens, run `npm run test:e2e` with explicit sandbox escalation instead of
moving helper scripts outside the repository.

## Rewrite local state health tests

The rewrite-local state health tests live in:

```sh
npm run test -- src/tests/local-state-health.test.ts
```

They cover metadata-only health reporting for known rewrite-owned storage keys,
including missing, loaded, invalid JSON, invalid envelope, invalid data and
version-mismatch states, plus non-fatal `getItem`, `setItem` and `removeItem`
failure handling. They also cover per-key clearing and clear-invalid behavior,
with assertions that loaded, missing, legacy and unknown keys are not removed and
that raw storage error text is not exported.

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

Focused writer tests validate the normalized fixture contract and first-page Inertia item adapter used by `--upstream-url`: exact root/origin checks, sequential request delay, redirect/timeout/size/content failures, allowlisted item-id diagnostics, mapping-specific 404 retention, all-retained freshness rejection, username removal, explicit/coin-only unit prices, item/mixed/ambiguous-offer skipping, buy/sell inclusion, unweighted quantity, MAD and median-ratio outlier filtering, sparse/stale prior-price retention, missing/unknown/duplicate mapping gates, catalog-audited source slugs, 90-day 12-hour plus older daily history retention, two-file idempotence and unchanged `alch.json`. A local dry-run fixture check needs no network:

```sh
npm run prices:write-scheduled -- --input src/tests/fixtures/market-writer/upstream-valid.json --item-ids lobster,rune_scimitar,dragon_bones --now 2026-07-08T00:15:00.000Z --dry-run
```

The scheduled workflow runs only at 00:15 and 12:15 UTC, has no `workflow_dispatch`, requires `MARKET_PRICES_UPSTREAM_URL` to be the exact reviewed root, validates focused tests/JSON/diffs, rejects changes outside `prices.json` and `price-history.json`, and commits only real two-file diffs. The opt-in 2026-07-10 live dry-run passed for all 80 mappings with 69 updated plus 11 retained/skipped rows and no writes. The exact repository variable was configured and read back on 2026-07-10. Under D-067, a future operator collects first-successful-run evidence before using scheduled-current copy; it is not a repository test gap.

Freshness and release-evidence checks for the scheduled market path:

```sh
node -e "const fs=require('fs'); const prices=JSON.parse(fs.readFileSync('prices.json','utf8')); const history=JSON.parse(fs.readFileSync('price-history.json','utf8')); const last=history.at(-1); console.log({pricesScrapedAt: new Date(prices._scraped_at*1000).toISOString(), lastHistoryAt: last ? new Date(last.t*1000).toISOString() : null, historySnapshots: history.length});"
git log -1 --format="%h %cI %s" -- prices.json price-history.json
git diff --check
```

For release-copy evidence, also run the live integration release-copy audit below and classify every hit. D-053 keeps live scheduled-market workflow evidence out of the V1/trusted-tester gate when the release is described as static/bundled/imported price limited. Scheduled-current market-price copy requires the latest successful `Update market prices` GitHub Actions run on the release branch after `MARKET_PRICES_UPSTREAM_URL` is configured. A failed run leaves the previous committed snapshot active; a no-op successful run is freshness evidence but does not change `_scraped_at` or create a commit.

Other focused tests validate committed market files, generated alch composition, same-origin price/history loading, fallback order, import/legacy alch replacement and the rule that shared loading writes neither selected state nor local history. Playwright checks shared history without localStorage writes, local capture/clear isolation, scheduled status, import/reset and stale backend-copy absence.

## Generated game data tests

The generated game data workflow has a command and testable core. It validates that the default source path is the gitignored `.sources/lostcity-content/` checkout, that missing or non-directory sources fail with sanitized errors, that fixture source/output-root paths can be exercised without network access or raw upstream content, that the source-backed fixture extracts monster/drop/item/equipment/weapons/ammo/spells data and a top-level item requirement map into `GameDataSnapshot`, that generated `game-data.json` validates with `GameDataSnapshotSchema`, that requirement input accepts only strict v1 `attack`/`defence`/`ranged`/`magic` integer levels from 1 to 99, that identical item requirements from `items.json`, `weapons.json` and `equipment.json` merge deterministically, that conflicting requirement values fail with sanitized `source_slice_invalid`, that duplicate canonical item ids created by known alias mappings fail before output write, that revision-impact diff reporting covers valid, missing and invalid baselines, that representative calculation-impact reporting covers no-diff `pass`, changed `needs-review`, missing required entity `failed`, deterministic markdown, `--skip-calculation-impact` and `--impact-case-filter <tag-or-id>`, and that informational all-monster scan reporting covers a clean scan, DPS/kills/hr/XP/hr threshold outliers, GP/hr or GP/XP threshold outliers, warning-count increases, monsters entering/leaving the scan, deterministic `--impact-outlier-limit <number>` truncation and no `NaN`/`Infinity` report output. It also validates that a repo-local output hygiene assertion rejects raw upstream dump keys, historical generated snapshot archive paths, market price history fields and absolute user-home paths before files are written.

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

Current generated runtime coverage is ready: the raw Revision 274 generator resolves all expected runtime monster, item, weapon, ammo, spell and equipment identities and 63/63 core-loot tables. Runtime item price/alch fallbacks fill only scheduled-static gaps, and scheduled values retain precedence. D-058 keeps cut and uncut gem identities distinct; exact keys win and aliases are fallback-only. D-059 records the completed root bootstrap switch.

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

The audit reads the gitignored `.sources/lostcity-content/` checkout recursively, follows config/category/delegated-handler behavior, fails duplicate config or `ai_queue3` definitions and emits repository-relative sanitized diagnostics. Current Revision 274 evidence maps all 63 runtime monsters, extracts 63/63 core-loot tables and resolves all expected runtime catalog identities; the generated item catalog contains 371 expected identities plus 15 source-only loot identities. Four quest-gated rows and 21 clue-scroll tertiary rows are explicit scoped exclusions. D-055, D-056 and D-057 own the accepted combat, loot, equipment and combat-catalog source deltas; D-059 owns runtime consumption.

After generator source or schema/test changes, also run:

```sh
npm run typecheck
git diff --check
```

The source-backed generator command writes only `src/data/generated/source-pin.json`, `src/data/generated/game-data.json` and `docs/project/revision-impact/current.md`. The legacy-derived reference writer writes only `src/data/generated/legacy-derived-runtime-game-data.json` and `src/data/generated/legacy-derived-runtime-price-set.json`. Do not commit `.sources/lostcity-content/`, raw upstream checkouts, historical generated snapshot directories or live upstream responses. The raw parser is shared by the generator and the read-only audit/impact CLIs. Planner/setup/quick-action generated requirement consumption is covered by `src/tests/planner-domain.test.ts` and `src/tests/ui-view-model.test.ts` when a snapshot supplies requirements; the active raw snapshot currently exercises the D-051 fallback path.

For a real revision bump PR, use [../operations/README.md](../operations/README.md#game-revision-bump-pr-runbook) as the review checklist. The minimum local evidence is the generator command against `.sources/lostcity-content`, `npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts`, `npm run typecheck` and `git diff --check`; run `npm run test:golden` and relevant domain/UI tests when the revision-impact report shows changed calculation output or changed generated requirements.

For a focused generated-requirements review pass covering the parser/schema contract, committed generated snapshot shape, Planner requirement lookup and loadout/gear-quick-action warning consumers:

```sh
npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts src/tests/planner-domain.test.ts src/tests/ui-view-model.test.ts
```

## V1 release evidence snapshot

The latest functional and repository-local visual release-evidence checks were refreshed through 2026-07-11 for the source-backed Revision 274 root runtime. D-066 now chooses Cloudflare hosting/CSP/runtime; Cloudflare deployed evidence, a canonical remote visual runner and deeper legacy migration remain outside the current local evidence.

| Check                                                       | Latest result                                                             | Notes and follow-up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci && npm run verify` in detached fresh checkout       | `pass`                                                                    | Commit `43f8b5f` was tested without `.sources`, prior `node_modules`, `dist`, `.vite` or test output under Node 22.19.0/npm 10.9.3. Lockfile install added 237 packages; verify passed 523 unit tests, 19 explicit golden tests, typecheck, build/artifact, lint, format and diff checks. Build produced the expected artifact checksum from committed generated data, and a separate network-enabled `npm audit` reported 0 vulnerabilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run typecheck`                                         | `pass`                                                                    | 2026-07-11 D-066 refresh passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run test`                                              | `pass`                                                                    | 2026-07-11 full Vitest run passed across 34 files and 523 tests, including five Cloudflare Worker tests and the expanded artifact `_headers` contract test alongside the prior generated runtime, domain, UI, migration, market and Hiscores coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run test:golden`                                       | `pass`                                                                    | 2026-07-11 golden fixture run passed 19 tests. Fixture changes still require an accepted baseline decision before updating snapshots.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm run build`                                             | `pass`                                                                    | 2026-07-11 Vite build passed with only the known chunk-size warning. The D-066 artifact gate passed 7 files/2 hashed assets, 1,384,153 bytes, 13 history snapshots and SHA-256 `a8bd9ee19cfa6c17ff659006cbde54e50ab846e2c93e276098fa2af35bf4d2ce`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Cloudflare focused checks                                   | `repository pass; adopter upload gated`                                   | `npm run test -- src/tests/cloudflare-worker.test.ts src/tests/deployment-readiness.test.ts src/tests/hiscores-server.test.ts src/tests/lostcity-hiscores-provider.test.ts` passed 32/32. Evidence covers API-first routing, same-origin status/lookup, ephemeral client key, sanitized 404/500, security/no-store headers, static delegation, disabled observability/Logpush and exact Wrangler/static routing. D-067 leaves first bundle/version upload and deployed smoke to a future operator.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Generated/runtime evidence                                  | `pass`                                                                    | Deterministic raw Revision 274 generation produced 386 items and 63 monsters. Generated and legacy-reference readiness are `ready`, coverage has no blockers, legacy-derived reference snapshots are current, source audit has zero unresolved runtime identities, and combat, loot, equipment and combat-catalog impact commands completed without execution errors. The committed report owns accepted D-055/D-057 deltas and passes 10/10 representative cases with 22 advisory outliers across 189 evaluations.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `npm run test:e2e`                                          | `pass baseline; 2026-07-11 rerun environment-blocked`                     | The latest full 2026-07-10 production-preview gate passed 57/57 in Chromium. The D-066 rerun built successfully but the managed sandbox rejected the preview bind with `listen EPERM 127.0.0.1:5173` before browser execution, so it does not supersede 57/57. Worker behavior is covered by the focused non-browser suite; no UI/CSS behavior changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npm run test:e2e:visual`                                   | `pass on Darwin`                                                          | The isolated comparison passed 19/19 scenarios against 23 reviewed fixture-only Darwin PNGs without writing baselines. It covers root, Compare, loadouts, Stats, Trip, Loot details, Economy, Cannon, Planner, Duel and Settings at the specified desktop/tablet/mobile viewports. `npm run test:e2e:visual:update` remains the only baseline-write command. No CI runner or remote merge requirement is accepted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Shareable setup focused checks                              | `unit and browser pass`                                                   | `npm run test -- src/tests/shareable-setup.test.ts src/tests/ui-adapters.test.ts` passed 59/59, and the three permalink production-preview tests are included in the full 57/57 gate. Evidence covers strict bounded parsing, duplicate keys, game-data mismatch/unknown ids/stale loot, root/sub-path URL handling, clipboard failure, review-before-write, Load/Dismiss, complete Undo and preservation of unrelated/local price state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Duel monster matrix focused checks                          | `pass`                                                                    | `npm run test -- src/tests/ui-view-model.test.ts` passed 80/80, isolated `src/tests/ui-performance.test.ts` passed 3/3 with the 12-snapshot/819-cell matrix completing in about 2.5 seconds wall time, and the focused production-preview Playwright smoke passed 1/1. The full parallel Vitest gate also passed the CPU-time bound.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run lint`                                              | `pass`                                                                    | The 2026-07-10 dedicated hygiene cleanup removes the reported code errors and warnings while keeping browser-storage synchronization suppressions local and documented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npm run format:check`                                      | `pass`                                                                    | The 2026-07-10 dedicated hygiene cleanup formats tracked source/docs and excludes generator-owned current snapshot JSON plus revision-impact output from Prettier ownership.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Goal 1/2 focused Playwright reruns                          | `pass, superseded by full baseline`                                       | Focused escalated localhost runs were used to isolate Combat/Stats/Special, Duel, Planner, Dense/Compare, Cannon, Trip, Loot and numeric-snapshot smoke paths during stabilization. The expanded full `npm run test:e2e` 57/57 pass now supersedes those focused runs and includes both the Duel matrix and all-fixture browser-display extensions. The older failure matrix below is retained only as historical triage evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Loot/Economy focused checks                                 | `pass with sandbox-limited browser smoke`                                 | On 2026-07-08, the Loot/Economy pass ran `npm run typecheck` and `npm run test -- src/tests/trip-loot-supply.test.ts src/tests/data-economy.test.ts src/tests/market-adapter.test.ts src/tests/market-ui-state.test.ts src/tests/ui-adapters.test.ts src/tests/price-import-notice.test.ts src/tests/market-server.test.ts src/tests/market-sync-items.test.ts src/tests/market-writer.test.ts src/tests/legacy-migration.test.ts src/tests/ui-view-model.test.ts`, passing 267 focused tests. The focused Loot/Economy Playwright smoke failed before browser execution with `listen EPERM: operation not permitted 127.0.0.1:5173`, matching the managed-sandbox localhost limitation and not superseding the earlier escalated 51/51 browser gate. No source formulas, fixture outputs or Playwright numeric expectations changed, so `npm run test:golden` was not rerun for that documentation/status closure.            |
| Goal 3 numeric snapshot audit                               | `pass with sandbox-limited browser rerun`                                 | On 2026-07-08, focused numeric domain/view-model evidence passed: `npm run test -- src/tests/domain-core.test.ts src/tests/trip-loot-supply.test.ts src/tests/xp-parity.test.ts src/tests/ui-view-model.test.ts src/tests/data-economy.test.ts` passed 173 tests, and `npm run test:golden` passed 19 tests. Focused numeric Playwright and full `npm run test:e2e` rerun attempts in the current managed sandbox both failed before browser execution with `listen EPERM 127.0.0.1:5173`; this is environment-only and does not supersede the earlier escalated 51/51 browser gate. No Playwright numeric expectations, source formulas or golden fixtures were changed.                                                                                                                                                                                                                                                      |
| Goal 4 release-gate refresh                                 | `pass with environment-only browser rerun limitation`                     | Goal 4 reran `npm run typecheck`, the focused Trip set `npm run test -- src/tests/trip-loot-supply.test.ts src/tests/ui-adapters.test.ts src/tests/ui-view-model.test.ts src/tests/scaffold.test.ts src/tests/xp-parity.test.ts` with 178 passing tests, full `npm run test`, `npm run test:golden`, `npm run build`, `npm audit`, the static DOM/code-execution search, the static secrets search, the broader URL/API-copy search and the live-integration release-copy audit. All non-browser gates passed or had documented residual classifications. The only non-pass command was the focused Trip/Cannon Playwright smoke, which failed before browser execution with the managed-sandbox localhost `EPERM` limitation above. No source formulas, fixture outputs or Playwright numeric expectations changed.                                                                                                           |
| Goal 5 Planner focused checks                               | `pass with environment-only browser rerun limitation`                     | Goal 5 reran `npm run typecheck`, `npm run test -- src/tests/planner-domain.test.ts src/tests/planner-ui-state.test.ts src/tests/planner-ui-adapter.test.ts src/tests/ui-view-model.test.ts src/tests/legacy-migration.test.ts` with 131 passing tests, `npm run test:golden` with 19 passing tests, `npm audit`, the static DOM/code-execution search, the static secrets search and a Planner/localStorage migration boundary search. Non-browser checks passed or had documented residual classifications. The focused Planner Playwright smoke `npm run test:e2e -- --workers=1 --grep "Planner"` failed before browser execution with `listen EPERM: operation not permitted 127.0.0.1:5173`, matching the managed-sandbox localhost limitation and not superseding the earlier escalated 51/51 browser gate. No Planner source formulas, fixtures, persisted schema versions or Playwright numeric expectations changed. |
| Goal 6 legacy migration focused checks                      | `pass with environment-only browser rerun limitation`                     | Goal 6 reran `npm run typecheck` and `npm run test -- src/tests/legacy-migration.test.ts src/tests/local-state-health.test.ts src/tests/ui-adapters.test.ts src/tests/market-ui-state.test.ts src/tests/price-import-notice.test.ts src/tests/planner-ui-state.test.ts` with 126 passing tests. The focused Import/Keep/Clear/local-state Playwright smoke `npm run test:e2e -- --workers=1 -g "legacy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | local state"`failed before browser execution with`listen EPERM: operation not permitted 127.0.0.1:5173`, matching the managed-sandbox localhost limitation and not superseding the earlier escalated 51/51 browser gate. Goal 6 changed documentation/status only: no source formulas, fixture outputs, persisted schema versions, localStorage key lists or Playwright numeric expectations changed, so `npm run test:golden` was not rerun. |
| D-042 Legacy Migration V1 custom/cannon import              | `unit/typecheck/focused browser pass`                                     | D-042 compatible nested `sim_input_v3.monsterSetups` and `sim_input_v3.cannonByMonster` import is implemented. `npm run test -- src/tests/legacy-migration.test.ts src/tests/ui-adapters.test.ts` passed 85 tests in the implementation pass; the current verification reran `npm run test -- src/tests/legacy-migration.test.ts` with 37 passing tests and `npm run typecheck` passed. The focused Playwright command suggested by the spec, `npm run test:e2e -- --grep "legacy migration"`, now starts under localhost escalation but selects no tests because current test titles do not contain that phrase. The equivalent current-title focused smoke `npm run test:e2e -- --grep "reviews and imports compatible legacy setup data                                                                                                                                                                                     | keeps legacy data and dismisses the migration notice                                                                                                                                                                                                                                                                                                                                                                                          | clears only known legacy data after confirmation"` passed 3/3 tests in Chromium and covers compatible nested custom setup/cannon import plus Import/Keep/Clear boundaries. |
| Legacy Migration V1 UX/status closure                       | `unit/typecheck/focused browser pass`                                     | Goal 3 closed the user-facing review copy for the accepted V1 boundary. The Settings notice now shows a metadata-only outcome summary for importable, skipped and review-only areas, makes D-048 `sim_planner_v1` and D-049 full legacy price history explicit review-only/not-migrated decisions, and keeps Import/Keep/Clear status copy separate. `npm run test -- src/tests/legacy-migration.test.ts` passed 37 tests and `npm run typecheck` passed. The Playwright scaffold source checks the outcome copy, Import/Keep/Clear status messages and absence of raw planner/history payload sentinels. The spec-suggested grep selected no tests under localhost escalation, so the current-title focused smoke `npm run test:e2e -- --grep "reviews and imports compatible legacy setup data                                                                                                                               | keeps legacy data and dismisses the migration notice                                                                                                                                                                                                                                                                                                                                                                                          | clears only known legacy data after confirmation"` was run instead and passed 3/3 tests in Chromium.                                                                       |
| Goal 7 release-gate and status check                        | `historical core pass; browser refresh pending`                           | Goal 7 reran the then-current core release commands plus `npm audit`, static DOM/code-execution search, static secrets search, broader URL/API-copy search and live-integration release-copy audit. Non-browser checks passed or had documented residual classifications. The 2026-07-09 core refresh supersedes this row for non-browser gates; a localhost-capable browser smoke refresh is still needed for fresh browser evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-07-09 generated-data/backlog maintenance focused check | `focused pass, superseded by same-day core refresh for non-browser gates` | The generated-data/backlog pass changed generator report copy, generated-data review docs, backlog status, idea-inbox maintenance and the fixture-owned representative calculation-impact suite, expanding it from the original melee/ranged/magic fixture cases to 9 fixture-owned cases covering cannon, recoil, alch-policy, loot-heavy/nested-loot, high-defence-pressure and low-level paths too. `npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts` passed 57 tests, `npm run typecheck` passed and `git diff --check` passed. The later 2026-07-09 core refresh reran full unit, typecheck, golden, build, dependency audit and static release/security searches, but still does not claim fresh browser evidence.                                                                                                                                                                       |
| Legacy-derived static runtime bridge focused check          | `historical pass; superseded by D-059`                                    | This pass established the static snapshot and freshness gate while D-054 still kept it as root runtime truth. D-059 later superseded that bootstrap boundary after raw source coverage and impact evidence closed. The artifacts remain useful regression/reference evidence under `npm run runtime:write-legacy-derived -- --check`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Source-backed runtime coverage-plan focused check           | `historical focused pass; superseded by completed coverage`               | This pass added complete `missingIds`/`extraIds` arrays and `npm run runtime:coverage-plan` while source coverage was incomplete. The same command now reports zero blocking gaps for the active generated runtime.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Runtime monster combat-stat source-slice batch              | `historical focused pass; superseded by raw generator`                    | This normalized fixture batch introduced the combat-stat gate before raw loot integration. The active raw generator now supplies combat and 63/63 core-loot rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Runtime combat catalog source-slice batch                   | `historical focused pass; superseded by raw generator`                    | This normalized fixture batch introduced weapon, ammo, spell and equipment field gates. The active raw generator now supplies all expected combat-catalog identities and accepted D-056/D-057 source deltas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Runtime item and PriceSet coverage batch                    | `historical focused pass; superseded by D-058/D-059`                      | This normalized fixture batch introduced item and PriceSet gates and the earlier 9-case/195-evaluation evidence. The active raw snapshot now uses distinct cut/uncut identities under D-058, passes 10/10 representative cases, records 22 outliers in 189 evaluations and is the root runtime under D-059.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm audit`                                                 | `pass`                                                                    | 2026-07-10 reported 0 vulnerabilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `git diff --check`                                          | `pass`                                                                    | Passed after this documentation refresh.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Static DOM/code execution search                            | `pass with classified residual`                                           | Found trusted bundled legacy source execution `new Function` use in `src/adapters/legacy-runtime/source-bootstrap.ts` and `scripts/report-generated-runtime-readiness.ts`; both execute repository-owned legacy source files for reference/readiness/regeneration, not user input. The root app bootstrap uses `src/adapters/generated` and committed validated JSON instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Static secrets search                                       | `pass with false positives`                                               | Found item/package/doc/test text such as `token`, `js-tokens`, `css-tokenizer`, local-state-health fixture text and a URL password-rejection guard, with no real API key, secret, bearer token, password or private key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Release-copy audit                                          | `pass with classified residuals`                                          | Legacy `run_sim.py`, `/api/prices`, `/api/scrape` and legacy `/api/hiscores` hits remain archived evidence or documentation/history. Production rewrite paths use typed same-origin status/sync/lookup contracts and service-aware copy. The broader URL/API-copy audit also classifies CDN/Babel, `markets.lostcity.rs`, localhost and test URLs as archived legacy evidence, adapter/test contracts or documentation/history rather than production rewrite UI copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Repository-local visual regression                          | `pass on Darwin`                                                          | The current 57/57 functional smoke remains the workflow/numeric owner. The separate [visual regression suite](visual-regression-spec.md) passed 19/19 against 23 reviewed Darwin baselines with deterministic state and explicit update policy. Remote merge-blocking status and a canonical CI platform baseline still need a separate CI decision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Live upstream integration calls                             | `opt-in pass; default tests mocked`                                       | Default tests stay mocked. Separate sanitized 2026-07-10 checks mapped seven combat skills from the accepted Hiscores provider with zero warnings and completed the 80-mapping market dry-run with 69 updated plus 11 retained/skipped rows and no writes. No raw provider/market payload or username was committed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

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
| `restores per-combat-style loadout edits when switching styles`                  | Basic combat setup / per-style state | Ranged `POT` is expected to restore to `ranging`, but the compact selector is empty in the last full default run.                                              | Likely per-style boost restore or compact boost synchronization regression in that run; the focused Goal 1 rerun passed after the combat-style tab routing fix.                         | `regression` in last full run; focused rerun `pass`   | Remove from the remaining likely-regression list after the next full default gate confirms the focused result.                                          |
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

Tests should specifically cover level-input updates because that path has already shown visible jank in the rewrite UI. Keep the first implementation main-thread friendly with memoization and debouncing, but preserve worker-compatible request/result/cancel/progress boundaries.

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
- validating committed `prices.json`, `alch.json` and `price-history.json`
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
- `src/tests/e2e/scaffold.spec.ts`

Run focused coverage with:

```sh
npm run test -- src/tests/lostcity-hiscores-provider.test.ts src/tests/hiscores-server.test.ts src/tests/hiscores-adapter.test.ts src/tests/hiscores-ui-state.test.ts
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

The Playwright scaffold includes a mocked `/api/hiscores/status` and `/api/hiscores` smoke path. It also checks the default disabled-provider copy, disabled Lookup behavior, editable manual Player level fields, stale-preview clearing after Player input changes, late-response rejection and absence of stale production `run_sim.py` instructions. It must stay mocked; automated tests must not call a live hiscores upstream.

## Legacy storage migration tests

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
- dragon halberd special warning surfacing for the current legacy NPC-size fallback assumption without changing fixture math
- manual accuracy/damage/speed override state to `SimulationRequest.manualOverrides` mapping and visible combat metric changes
- MonsterCard view-model contract for nullable monster stats, active defence rows and compact setup summaries
- extended trip-control state to `TripPolicy` mapping without leaking trip fields into `SimulationRequest`
- scarce/AFK Trip controls, inventory reserve details, prayer restore capacity, Trip summary Auto/Manual wording and derived general potion recommendation status/`canApply` state in the UI view model
- domain-backed result, compare and planner view models
- Stats combat roll detail metrics for melee/ranged/magic paths, fallback rendering for unavailable roll values, TTK/kills/hr/GP/kill mapping and hit distribution view-model labels, bucket accessibility text and probability-total invariants
- Stats source breakdown view-model rows and source-detail records for normal attack, special attack and cannon statuses, including normal-only histogram exposure, melee/ranged modeled special detail, magic/DBA fallback detail, dragon-halberd partial warning detail, cannon-enabled metrics and idle cannon detail; plus XP routing rows, cannon-only XP row visibility, modeled Prayer/Magic-alch total-XP rows and Trip/banking summary mapping
- active assumptions/modifiers summary view-model rows for empty/default state, manual combat overrides, enabled cannon settings, loot settings, loot action overrides, imported/synced PriceSet modifiers, money warnings, dragon-halberd special warning, explicit safespot and protection-prayer split rows, targeted reset metadata, review-only boundaries, reset scoping and stable priority order/five-row overflow
- Duel comparison view-model rows for live setup and saved snapshots against the current monster, including deltas and best-marker fields
- structured money warning view models for price alias and fallback surfacing
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
- Playwright smoke for the workbench shell, PlayerSidebar, legacy-order TabBar, right-side MonsterCard rail, mobile MonsterCard ordering, MonsterCard target switch/drop-filter sharing/active defence highlights, dense spreadsheet Compare pane, Dense Compare mobile/tablet page-width containment and internal horizontal table scroll, dense XP/net-GP scale indicators, Compare calculation freshness status, metric strip, active assumptions/modifiers summary in Compare and Stats with Review-to-Cannon tab switching plus targeted Reset actions for manual combat overrides, current-monster loot settings and current-monster cannon settings, Stats source breakdown, visible Stats special/cannon source details for default inactive, active special, magic/DBA fallback and active cannon paths, Stats combat roll detail for default/ranged/magic paths, Stats XP routing, Trip & banking summary and hit distribution histogram, combat-style switching, per-combat-type loadout restore, multi-prayer/multi-boost workbench controls with compact-strip primary edits and `+N` markers, active-style gear quick actions with two-handed shield lock, manual combat override persistence/reset, SetupBar custom setup create/restore/remove plus one-step Undo for remove, rewrite setup import failure retry/notice behavior, PriceSet import failure retry/notice behavior, Melee/Ranged/Magic equipment pane edits with searchable selectors and persisted selections, tab-routed special attack controls/metrics, dragon halberd NPC-size fallback warning, DBA boost special suppression, magic special unsupported state, trip survival/food/recoil controls, Trip summary Auto/Manual labels for bank time, food count and prayer restore, trip potion recommendation apply/disabled/inactive states, dense row markers, browser-rendered dense numeric release-path snapshots for default melee, melee alch-relevant, ranged safespot, ranged cannon, magic safespot and custom loot-settings marker rows, browser-rendered metric-strip acceptance snapshots for those target selections plus default melee, ranged safespot, cannon-enabled ranged, loot action override, manual food/prayer trip, imported PriceSet, scheduled price fallback, and compatible legacy import paths, final Cannon tab controls with sparse-link/reset behavior and expanded output snapshots for effective targets, cannon DPS, balls/hr, balls/kill, cannon ranged XP/hr, effective XP/hr, effective net GP/hr, ball costs, cannonballs/trip and K/hr uplift, Duel tab snapshot/export/import/rename/load/delete/undo/persistence flow, Planner tab open/metric/current-XP/target/skill-lock/gear-pool/Recompute/training-order/timeline/chart persistence flow, per-monster loot settings persistence plus loot reset/optimize Undo, full monster table row count, table sorting, dense compare filters/relevance persistence, row and keyboard target selection, per-monster cannon controls, Economy price-history controls with mover sparklines and item trend selection/chart/points, mocked hiscores lookup/apply flow and scheduled-only market price UI flow

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
```

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
npm run test:e2e -- --workers=1 -g "keeps Dense Compare mobile and tablet overflow contained"
npm run test:e2e -- --workers=1 -g "shows dense compare calculation freshness"
npm run test:e2e -- --workers=1 -g "filters dense compare rows and persists hidden monsters"
npm run test:e2e -- --workers=1 -g "shows dense row markers"
npm run test:e2e -- --workers=1 -g "matches browser-rendered dense numeric snapshots"
npm run test:e2e -- --workers=1 -g "sorts the full monster table and selects a target row"
```

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

Dense/Compare release classification: D-032 accepts the current release-path
browser numeric snapshots as sufficient for the current Dense/Compare release
slice. All-fixture browser-display expansion and full visual regression remain
later or decision-needed evidence, not required checks for this slice unless a
future release decision changes that boundary.

Run the focused browser smoke for Dense Compare mobile/tablet overflow containment with:

```sh
npm run test:e2e -- --grep "Dense Compare mobile"
```

Run the focused browser smoke for the visible Duel workflow with:

```sh
npm run test:e2e -- --grep "Duel"
```

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
- Composed simulation result contract or main view-model result-source changes: run `npm run typecheck` and `npm run test -- src/tests/full-simulation-result.test.ts src/tests/domain-core.test.ts src/tests/trip-loot-supply.test.ts src/tests/xp-parity.test.ts src/tests/ui-view-model.test.ts src/tests/data-economy.test.ts`. This validates the `CombatSimulationResult`/`FullSimulationResult` boundary against current combat, trip, XP, economy and UI view-model evidence without requiring Playwright unless visible UI behavior changes.
- XP calculation or XP row changes: `npm run test -- src/tests/xp-parity.test.ts`, `npm run test`, and `npm run test:golden` when current-behavior parity can change.
- Trip/loot/supply domain changes: `npm run test -- src/tests/trip-loot-supply.test.ts`, `npm run test`, and `npm run test:golden` when current-behavior parity can change. Include `src/tests/xp-parity.test.ts` when `effectiveKph`, recoil, poison or cannon behavior can affect XP/hr.
- Data or prices: JSON parse, `npm run test -- src/tests/data-economy.test.ts`, and representative simulation fixtures when simulation behavior can change.
- Generated runtime readiness: `npm run test -- src/tests/generated-runtime-adapter.test.ts`, `npm run runtime:readiness -- --example-limit 5`, `npm run runtime:coverage-plan -- --example-limit 5`, `npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts src/tests/trip-loot-supply.test.ts`, `npm run test:golden`, `npm run typecheck` and `git diff --check`. The default readiness command is blocking and must stay green for the active snapshot. Use `--allow-not-ready` only for deliberate incomplete local candidates. Rerun full domain/golden/browser evidence for generated snapshot value or bootstrap changes.
- Planner: `npm run test -- src/tests/planner-domain.test.ts` for gear eligibility, scoring, stance selection and golden plan fixtures. Run full `npm run test` if planner changes interact with combat, trip, data or economy contracts.
- UI/view-model changes: `npm run test -- src/tests/ui-view-model.test.ts`, `npm run test`, `npm run build` and `npm run test:e2e` when browser behavior changes.
- Performance-sensitive UI/view-model changes: include `src/tests/ui-performance.test.ts` and browser smoke where possible; compare the level-input path and representative compare/planner workloads against the accepted performance budget.
- Market/import logic: unit tests with mocked price sources and malformed data; include `src/tests/ui-adapters.test.ts` for rewrite price imports and `src/tests/market-ui-state.test.ts` for selected active `PriceSet` persistence, restore and failure behavior.
- Live integrations: `npm run test -- src/tests/live-integrations.test.ts src/tests/hiscores-server.test.ts src/tests/hiscores-adapter.test.ts src/tests/hiscores-ui-state.test.ts src/tests/market-sync-items.test.ts src/tests/market-server.test.ts src/tests/market-adapter.test.ts src/tests/market-ui-state.test.ts` plus `npm run test` when shared schemas or API adapters are touched. Use mocked hiscores and market service tests only; do not call live upstream services in automated tests. Cover request validation, allowlisted market item mapping, upstream-invalid responses, partial market failures and UI apply/failure behavior.
- Persistence changes: migration/version tests for `localStorage` keys; include `src/tests/ui-adapters.test.ts` and `src/tests/market-ui-state.test.ts` for price selection/history keys, and include `src/tests/legacy-migration.test.ts` when legacy key detection or setup/hiscores/price compatibility mapping changes.
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

# Runtime, data and deployment testing

This guide owns detailed commands for source audits, generated data, local-state health, scheduled market artifacts and Cloudflare deployment validation. The authoritative gate summary and change-type matrix remain in
[the main testing guide](../testing.md).

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
npm run test -- src/tests/data-generator.test.ts src/tests/npc-attack-source-audit.test.ts src/tests/trip-loot-supply.test.ts src/tests/risk-analysis.test.ts src/tests/*-view-model.test.ts src/tests/calculation-task.test.ts src/tests/full-simulation-result.test.ts
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
npm run test -- src/tests/cloudflare-worker.test.ts src/tests/deployment-readiness.test.ts src/tests/hiscores-server.test.ts src/tests/lostcity-hiscores-provider.test.ts src/tests/workflow-security.test.ts
npm run typecheck
npm run build
npm run deploy:verify-artifact
```

`workflow-security.test.ts` statically requires immutable commit-SHA pins for
the official checkout/setup actions, non-persistent checkout credentials, one
final-step-only repository token reference and schedule-only triggers. It does
not execute or authenticate the remote workflow; the first configured scheduled
run remains external operations evidence.

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

The report is [../project/numeric-user-path-audit.md](../../project/numeric-user-path-audit.md).
The audit is local and deterministic: it does not call live upstreams or read
real browser storage. Browser formatting remains covered by the Playwright
all-fixture and release-path numeric snapshot cases.

For ordinary-casket valuation or source-contract changes, run:

```sh
npm run test -- src/tests/lostcity-source-parser.test.ts src/tests/data-generator.test.ts src/tests/trip-loot-supply.test.ts src/tests/*-view-model.test.ts
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
npm run test -- src/tests/*-view-model.test.ts
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
npm run test:e2e -- src/tests/e2e/*.spec.ts
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

The source-backed generator command writes only `src/data/generated/source-pin.json`, `src/data/generated/game-data.json` and `docs/project/revision-impact/current.md`. The legacy-derived reference writer writes only `src/data/generated/legacy-derived-runtime-game-data.json` and `src/data/generated/legacy-derived-runtime-price-set.json`. Do not commit `.sources/lostcity-content/`, raw upstream checkouts, historical generated snapshot directories or live upstream responses. The raw parser is shared by the generator and the read-only audit/impact CLIs. `src/tests/lostcity-source-parser.test.ts` covers raw requirement and NPC-size extraction; `src/tests/domain-core.test.ts` covers size-1, larger and missing-size dragon halberd behavior; Planner/setup/quick-action generated Strength consumption is covered by `src/tests/planner-domain.test.ts` and `src/tests/*-view-model.test.ts`.

For a real revision bump PR, use [../operations/README.md](../../operations/README.md#game-revision-bump-pr-runbook) as the review checklist. The minimum local evidence is the generator command against `.sources/lostcity-content`, `npm run test -- src/tests/data-generator.test.ts src/tests/data-economy.test.ts`, `npm run typecheck` and `git diff --check`; run `npm run test:golden` and relevant domain/UI tests when the revision-impact report shows changed calculation output or changed generated requirements.

For a focused generated-requirements review pass covering the parser/schema contract, committed generated snapshot shape, Planner requirement lookup and loadout/gear-quick-action warning consumers:

```sh
npm run test -- src/tests/lostcity-source-parser.test.ts src/tests/data-generator.test.ts src/tests/data-economy.test.ts src/tests/domain-core.test.ts src/tests/planner-domain.test.ts src/tests/*-view-model.test.ts
```

For D-073/D-088 bounded whole-loadout optimizer changes, run the focused
view-model contract and production-preview eligibility/apply/Undo smoke:

```sh
npm run typecheck
npm run test -- src/tests/*-view-model.test.ts
npm run test:e2e -- src/tests/e2e/*.spec.ts --grep "optimizes the visible whole loadout"
```

The view-model coverage owns deterministic improvement, current-form tie and
no-regression behavior, visible-option and two-handed allowlists, default
current-level eligibility, explicit warning-only fallback, excluded-choice
counting, unmet-current-baseline retention, frontier cap reporting,
invalid-limit sanitization and the synchronous interaction budget. The browser
case owns the checked default, complete apply/Undo plus unchanged target and
active style. Price, quest, ownership, future-gear and Planner behavior are
deliberately outside this command.

For the implemented D-093 Stats/Loadout ownership boundary, run:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/*-view-model.test.ts src/tests/ui-adapters.test.ts src/tests/stats-loadout-panes.test.ts src/tests/cannon-pane.test.ts src/tests/monster-card-panel.test.ts
npm run numeric:audit
npm run test:e2e -- --workers=1 -g "Stats|damage distribution|loadout|optimizes the visible whole loadout"
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

The focused unit gate currently passes 150/150, the numeric audit passes all
5,958 cross-path comparisons and the focused production-preview Chromium gate
passes 4/4. `src/tests/stats-loadout-panes.test.ts` owns semantic roots, heading
order, region labels, important controls/statuses and damage-distribution
accessibility without snapshotting complete markup. The canonical visual
config's dedicated preview port returned `EPERM` in the managed sandbox. The
same visual spec, screenshot tolerances and exact Darwin snapshot paths were
therefore run through the standard E2E web-server contract and passed 20/20
against 31 PNGs. No baseline was written, and the temporary runner
configuration was restored exactly.

For the implemented D-093 Compare/Duel ownership boundary, run:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/*-view-model.test.ts src/tests/ui-adapters.test.ts src/tests/calculation-task.test.ts src/tests/ui-performance.test.ts src/tests/compare-duel-panes.test.ts src/tests/compare-duel-controllers.test.ts
npm run numeric:audit
npm run test:e2e -- --workers=1 -g "dense combat spreadsheet root|bounded keyboard navigation|saved setup comparison|all-monster saved setup matrix|main event loop|dense compare calculation freshness|filters dense compare rows|dense XP and net GP scale|dense row markers"
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

The focused unit gate passes 158/158 across six files. Pane tests own Compare,
Duel current-target/diff and Duel matrix semantic contracts; controller tests
own Dense activation/debounce/cancellation/freshness and Duel on-demand,
busy/stale/filter/unmount behavior. The numeric audit passes 5,958/5,958, the
focused production-preview gate passes 9/9 and the complete Chromium gate
passes 77/77. Full verify passes 50 files / 704 tests and 19 goldens. The fresh
visual command and the same read-only contract on port 5173 were both blocked
before browser execution by the managed sandbox's localhost `EPERM`; no
baseline or permanent runner configuration changed.

For the implemented D-093 Planner ownership boundary, run:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/planner-domain.test.ts src/tests/planner-ui-state.test.ts src/tests/planner-ui-adapter.test.ts src/tests/*-view-model.test.ts src/tests/calculation-task.test.ts src/tests/ui-performance.test.ts src/tests/planner-pane.test.ts src/tests/planner-controller.test.ts
npm run planner:parity
npm run test:golden
npm run test:e2e -- --workers=1 -g "recomputes the Planner tab workflow|keeps Monsters, Planner and setup matrix calculations off the main event loop|keeps long table headers pinned inside their desktop scroll area"
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

The focused eight-file unit gate passes 129/129. Pane tests own ready,
pending/error and fresh-empty/unavailable semantic contracts; controller tests
own activation, draft-without-auto-run, explicit Recompute, source freshness,
cancellation, fixed failure copy and status precedence. Planner parity passes
16 cases / 32 comparisons with zero review or rewrite-gap rows, and all 19
goldens remain unchanged. The three moved workflow/long-task/sticky-table cases
pass 3/3 in Chromium, the complete suite passes 77/77 and the read-only Darwin
comparison passes 20/20 against the same 31 baseline PNGs. Full verify passes 52
files / 710 tests and the 97-module architecture gate. The 10-file/two-asset
artifact totals 1,962,374 bytes with SHA-256
`42a68f4e48d4999548010cbad8c291efe8786d4b9d08407193376b9bf5e4d2cc`;
entry JavaScript is 706,650 raw / 205,198 gzip bytes and remains inside D-094.

For the implemented D-093 Loot/Trip ownership boundary, run:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/trip-loot-supply.test.ts src/tests/*-view-model.test.ts src/tests/ui-adapters.test.ts src/tests/data-economy.test.ts src/tests/risk-controller.test.ts src/tests/risk-pane.test.ts src/tests/cannon-pane.test.ts src/tests/stats-loadout-panes.test.ts src/tests/loot-view-model.test.ts src/tests/trip-view-model.test.ts src/tests/loot-pane.test.ts src/tests/trip-pane.test.ts
npm run numeric:audit
npm run test:golden
npm run test:e2e -- --workers=1 -g "updates trip survival controls and keeps the trip summary visible|updates manual food controls and recoil ring count|updates trip food, banking and inventory reserve controls across styles|updates trip potion carry controls and grouped potion summary|shows inactive trip potion recommendation states|updates prayer restore detail controls and keeps the trip summary visible|updates per-monster loot settings and keeps them after reload|shows source-backed conditional clue loot without allowing a value action|resets one Active modifiers loot row while preserving neighboring loot state|updates current monster loot actions, reset and optimize|shows loot value composition, nested detail and action impact detail|shows source-backed opened-casket value composition|matches browser-rendered numeric snapshots for loot action and trip overrides"
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

The focused twelve-file unit gate passes 238/238. The four new direct-owner and
pane suites add 11 cases for Loot partitions/policy/history/optimizer, Trip
modes/summaries/recommendation/finite fallbacks, both semantic landmarks and
exact callback patches; the simulation-input Risk subset also passes, bringing
the focused leaf check to 24/24. The numeric audit passes all 5,958 comparisons
and all 19 goldens remain unchanged. Focused Chromium passes 13/13, complete
Chromium 77/77 and the read-only Darwin suite 20/20 against the same 31 PNGs.
Full verify passes 58 files / 730 tests, and architecture passes at 105 source /
93 client-reachable modules with seven external entrypoints and no cycle,
exception or orphan. The 10-file/two-asset artifact totals 1,966,525 bytes with
SHA-256
`3c247248df68cf2dd14d33e1f256b464f06a9cf975cb8af4f7790e2057fa5e6c`;
entry JavaScript remains inside D-094 at 709,990 raw / 206,326 gzip bytes. No
visual baseline, CSS, formula, schema, request, Worker or persistence contract
changed, and dependency audit was skipped under the network-disabled policy.

For the implemented D-093 Economy/Settings ownership boundary, run:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/price-data-view-model.test.ts src/tests/settings-view-model.test.ts src/tests/economy-settings-pane.test.ts src/tests/market-ui-state.test.ts src/tests/price-set-transfer-controller.test.ts src/tests/local-state-recovery-controller.test.ts src/tests/ui-adapters.test.ts src/tests/loot-view-model.test.ts
npm run numeric:audit
npm run test:golden
npm run test:e2e -- --workers=1 --grep "renders scheduled price status and keeps local PriceSet overrides separate|surfaces and clears invalid rewrite local state in Settings|keeps PriceSet import failures non-fatal and recoverable|filters hidden gear tiers while keeping current selections|keeps market UI scheduled-only when the compatibility sync API exists|keeps manual item drafts and unavailable overrides scoped across base changes|analyzes and manages browser-local price history in Economy|keeps shared scheduled price history read-only beside local comparisons"
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

The three new suites pass 16/16 and the required eight-file combined focused
gate passes 132/132. They cover active/scheduled/reset and metadata
presentation, manual selection/capacity, every history source/baseline/sort
shape, missing/zero deltas, provenance/freshness, neutral Loot context, tier
rows, all three wrapper modes, confirmation/notice placement and typed callback
forwarding including file-input reset. The numeric audit passes all 5,958
comparisons with zero mismatch and all 19 goldens remain unchanged. The eight
specified production-preview workflows pass 8/8, complete Chromium 77/77 and
the read-only Darwin suite 20/20 against the same 31 PNGs. The first visual
preview start was sandbox-blocked on port 5174; the approved localhost-only
rerun passed without a baseline or configuration write. Full verify passes 61
files / 746 tests, and architecture passes at 108 source / 96 client-reachable
modules with seven external entrypoints and no cycle, exception or orphan. The
10-file/two-asset artifact totals 1,972,778 bytes with SHA-256
`1d0bb317b35fec093c7128559fbd0f39de17623d9799dbfe8a4bed65425118c0`;
entry JavaScript remains inside D-094 at 716,243 raw / 208,034 gzip bytes.

For the implemented D-093 App composition-root Phase 4 boundary, run:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/legacy-migration-view-model.test.ts src/tests/app-shell-view-model.test.ts src/tests/app-shell-components.test.tsx src/tests/legacy-migration-*.test.ts src/tests/shareable-setup.test.ts src/tests/ui-adapters.test.ts src/tests/*-view-model.test.ts
npm run numeric:audit
npm run test:golden
npm run test:e2e -- --workers=1 --grep "loads the dense combat spreadsheet root|supports bounded keyboard navigation|keeps hiscores disabled|looks up hiscores|renders scheduled price status|keeps the desktop workbench|keeps a compact landscape workbench|keeps every workbench tab|explains setup ownership|reviews and imports compatible legacy|keeps legacy data|clears only known legacy|exports current rewrite setup|keeps setup import failures|keeps PriceSet import failures|creates a selectable setup link|reviews a shared setup|dismisses or rejects shared setup links|runs, invalidates and cancels modeled Risk"
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

The three new suites pass 12/12 and the expanded direct-owner regression gate
passes 278/278. They cover ordered tabs and keyboard resolution, setup/shared
review and result presentation, every legacy report bucket and disposition,
the characterized Duel-only readiness state, exact shell landmarks, DOM order,
roles, hidden/confirmation branches and typed actions. Numeric audit passes all
5,958 comparisons, goldens 19/19, focused Chromium 19/19, complete Chromium
77/77 and read-only Darwin visual comparison 20/20 without a CSS or baseline
change. Full verify passes 64 files / 758 tests, and architecture passes at 114
source / 102 client-reachable modules with seven external entrypoints and no
cycle, exception or orphan. The 10-file/two-asset artifact totals 1,977,328
bytes with SHA-256
`bea79ca8f4dd82815ea01397b54ae7987d130bdaa6acbf5c316ecbf7b2188379`;
entry JavaScript remains inside D-094 at 720,793 raw / 208,801 gzip bytes.

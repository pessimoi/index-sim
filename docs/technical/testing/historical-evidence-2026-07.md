# Historical topic-guide testing evidence — 2026-07

- Status: historical
- Date: 2026-07-27
- Owner: technical testing evidence
- Evidence: verified
- Contract: closed

This page preserves the complete former topic-guide bodies as dated evidence.
They were removed from living command owners during DOCS-01. Their commands,
counts and measurements describe their original context and are not current
repository claims.

## Former domain and integration guide

This guide owns detailed commands for goldens, performance, combat/XP/Trip/Risk/Planner domains, schemas and same-origin integration boundaries. The authoritative gate summary and change-type matrix remain in
[the main testing guide](../testing.md).

## Golden legacy fixtures

Archived-behavior golden fixtures live in
`src/tests/fixtures/legacy-golden.json`. They preserve the retained
`SimEngine.simulate()` comparison baseline, not current product truth.

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
- heavy calculation work must not block the UI in chunks longer than about 200 ms
- workloads that miss that budget belong behind the typed calculation runner and Web Worker boundary

Representative direct Dense Compare/Planner and maximum Duel matrix calculations exceeded this budget. Dense, Planner, Duel matrix and Risk now use `src/app/calculation-task.ts` through the cancellable one-shot Web Worker boundary. Pure dispatch, structured-clone safety, success/failure and cancellation are covered by:

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

The dated D-095 workstation measurements and stress finding belong in the
[Worker measurement specification](../calculation-worker-measurement-spec.md)
and [testing evidence](../../project/testing-evidence.md). D-095 retains the
one-shot lifecycle until low-end-device, production or repeated-task evidence
establishes a material task-start regression.

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
- `src/tests/hiscores-global-rate-limit.test.ts`
- `src/tests/cloudflare-worker.test.ts`
- `src/tests/lostcity-hiscores-provider.test.ts`
- `src/tests/hiscores-adapter.test.ts`
- `src/tests/hiscores-ui-state.test.ts`
- `src/tests/hiscores-lookup-controller.test.ts`
- `src/tests/e2e/*.spec.ts`

Run focused coverage with:

```sh
npm run test -- src/tests/hiscores-server.test.ts src/tests/hiscores-global-rate-limit.test.ts src/tests/cloudflare-worker.test.ts src/tests/hiscores-adapter.test.ts src/tests/hiscores-lookup-controller.test.ts src/tests/hiscores-ui-state.test.ts src/tests/local-state-recovery-controller.test.ts src/tests/live-integrations.test.ts
```

They cover:

- D-097 gate ordering after input/local limiting and before provider lookup, plus
  sanitized `429`, one-second timeout and fail-closed `503` behavior
- atomic concurrent fixed-window grants, rollover, persistent aggregate-only
  state, corrupt-state/clock rejection and coordinator request/response bounds
- Cloudflare `off`/`enforce` configuration, deterministic object identity,
  missing-binding failure, SQLite binding/migration and the pinned Node 22
  Wrangler dry-run contract
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

Four state suites plus the presentation suite exercise production internals
only through the stable `src/app/state/legacy-storage-migration.ts` facade.
The browser migration workflow retains the compatible Duel import assertion;
dated case totals belong in [testing evidence](../../project/testing-evidence.md).

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

The focused browser workflow verifies Run, all modeled outputs, coverage and
warning copy, source-change staleness, cancellation and the current explicit
failure/Retry lifecycle. Dated implementation counts, artifact hashes,
performance samples and the superseded status-priority failure belong in
[testing evidence](../../project/testing-evidence.md).

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

## Former runtime, data and deployment guide

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

Dated Goal 1 and D-081/D-082 gate counts, artifact hashes and browser/visual
results belong in [testing evidence](../../project/testing-evidence.md). The
current command contract above remains the owner here; the generated NPC report
and runtime-readiness command own current source coverage.

## Cloudflare deployment validation

Focused D-066/D-097 tests cover Worker routing, same-origin Hiscores responses,
ephemeral client-address rate-limit keys, aggregate budget ordering/state/failure,
sanitized API fallback, static/Durable Object bindings, migration, pinned release
runner, Wrangler routing/log settings and the `_headers` contract:

```sh
npm run test -- src/tests/cloudflare-worker.test.ts src/tests/hiscores-global-rate-limit.test.ts src/tests/deployment-readiness.test.ts src/tests/hiscores-server.test.ts src/tests/lostcity-hiscores-provider.test.ts src/tests/workflow-security.test.ts
npm run typecheck
npm run build
npm run deploy:verify-artifact
npm run deploy:cloudflare:dry-run
```

`workflow-security.test.ts` statically requires immutable commit-SHA pins for
the official checkout/setup actions, non-persistent checkout credentials, one
final-step-only repository token reference and schedule-only triggers in the
retained disabled template. It does not restore, execute or authenticate that
template; any first configured scheduled run after an explicit D-099 reversal
remains external operations evidence.

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
`npm run deploy:cloudflare:build`, then lockfile-pinned Wrangler 4.109.0 through
`npm run deploy:cloudflare`; `deploy:cloudflare:preview` uploads a version preview.
`npm run deploy:cloudflare:dry-run` validates the real Worker/assets bundle,
D-097 Durable Object export/binding/migration and committed `off` mode without an
account or upload. Provider preview and deployed privacy/routing remain external
evidence.

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
`docs/project/planner-parity/current.md` against the reviewed baseline. That
generated report owns the current matrix counts and classifications.

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

The command evaluates the generated monster/combat-style matrix and retained
legacy golden setup variants. It compares Result, Dense Compare, calculation
worker, Duel live, Duel matrix and saved-setup round-trip values at absolute
and relative tolerance `1e-9`. The generated
[numeric audit report](../../project/numeric-user-path-audit.md) owns current
case/comparison counts and mismatch status. The audit also reports
legacy-to-rewrite changes only when both the
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

The npm scripts use npm's `$NODE` value for Node-based tool commands. This keeps commands on the active NVM Node version even if a parent `node_modules/.bin/node` appears earlier in `PATH`. The Cloudflare release runner invokes the pinned Wrangler JavaScript entry through that same Node binary and keeps npm/Wrangler cache, config and logs inside ignored `.npm-cache` and `.wrangler` directories with Wrangler telemetry disabled. `npm run verify` is implemented by the shared gate mode in `scripts/run-cloudflare-release.mjs`; update that one command sequence instead of maintaining separate handoff and deploy checklists in code.

Use repository-local caches and helper files for tests. This project uses `.npm-cache` for npm commands and `.wrangler` for Wrangler config/cache/logs. Do not place project scripts in `/tmp` or another external scratch directory unless a human explicitly approves.

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
and keeps horizontal overflow inside the workbench. The matrix uses the
accepted typed one-shot calculation Worker; these tests do not persist matrix
output or call live upstreams.

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
view-model result. The case remains part of the default Playwright gate;
[technical testing](../testing.md) owns the current command and latest summary,
while [testing evidence](../../project/testing-evidence.md) owns dated results.
The first focused run found that the browser's dynamically loaded scheduled
snapshot had dropped generated item/alch fallbacks;
`src/app/state/market-sync.ts` now composes those fallbacks without overriding
scheduled values, with focused unit coverage.

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

D-099 keeps no YAML workflow under `.github/workflows`. The archived template at `.github/disabled-workflows/update-market-prices.yml` retains only the 00:15 and 12:15 UTC schedule, has no `workflow_dispatch`, requires `MARKET_PRICES_UPSTREAM_URL` to be the exact reviewed root, validates focused tests/JSON/diffs, rejects changes outside `prices.json`, `price-provenance.json` and `price-history.json`, and commits only real three-file diffs if explicitly restored. The opt-in 2026-07-10 live dry-run passed for the original 80 mappings with 69 updated plus 11 retained/skipped rows and no writes. D-087's twelve-row expansion passed its parser dry-run on 2026-07-12. A future operator must accept Actions capacity, recheck upstream policy, restore the template and collect first-successful-run evidence before using scheduled-current copy.

Freshness and release-evidence checks for the scheduled market path:

```sh
node -e "const fs=require('fs'); const prices=JSON.parse(fs.readFileSync('prices.json','utf8')); const provenance=JSON.parse(fs.readFileSync('price-provenance.json','utf8')); const history=JSON.parse(fs.readFileSync('price-history.json','utf8')); const last=history.snapshots.at(-1); console.log({pricesCapturedAt:new Date(prices._scraped_at*1000).toISOString(),provenanceCapturedAt:provenance.capturedAt,lastHistoryAt:last?new Date(last.t*1000).toISOString():null,historySnapshots:history.snapshots.length});"
git log -1 --format="%h %cI %s" -- prices.json price-provenance.json price-history.json
git diff --check
```

For release-copy evidence, also run the live integration release-copy audit below and classify every hit. Under D-099, current copy must say automatic refresh is disabled and describe the committed/imported/manual price paths. Scheduled-current copy requires a later explicit workflow restore and successful run after current upstream review.

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

## Former UI, state and browser guide

This guide owns the feature view-model, persistence, controller, pane and functional browser inventory. The authoritative gate summary and change-type matrix remain in
[the main testing guide](../testing.md).

The feature-file map, shared-fixture boundary and title-preservation contract
are owned by
[the implemented feature test-suite split](../feature-test-suite-split-spec.md).

## UI, adapters and persistence tests

The current rewrite UI tests live in:

- `src/tests/*-view-model.test.ts`
- `src/tests/ui-performance.test.ts`
- `src/tests/ui-adapters.test.ts`
- `src/tests/e2e/*.spec.ts`

Run unit/integration coverage with:

```sh
npm run test
```

Run browser smoke tests with:

```sh
npm run test:e2e
```

Run the focused normal-flow mobile result/navigation contract with:

```sh
npm run test:e2e -- --grep "mobile result and navigation loop"
```

The three parametrized cases use 390 × 844, 620 × 844 and 768 × 1024. They
measure the Player-to-result gap, shared headline values and live updates,
single tablist/tabpanel semantics, true-overflow boundary controls, More-list
activation/focus, active-tab horizontal reveal, setup-action geometry,
12/14-pixel typography and document containment. The test uses the visible
controls rather than Playwright's implicit scroll of a hidden tab.

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
- implemented active setup reset candidate/review coverage for current target/style/mode preservation, all-three-style-cache canonical defaults, Default/current-target Custom ownership, stale/no-op safety, complete durable/session-only Undo and protected Duel/custom/Dense/Cannon/loot/price/history/Hiscores boundaries
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
- root application recovery for a fixed sanitized bootstrap failure and a distinct post-ready pane render failure, including normal reload, tab-scoped saved-data-ignore startup, visible session-only status and byte-for-byte preservation of the original local setup
- Playwright smoke covers the workbench shell and complete accepted workflow inventory, including generated requirement copy and the remaining missing-size legacy dragon-halberd warning path; detailed cases live in `src/tests/e2e/*.spec.ts` and the visual matrix.

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

Run the combined Dense/Planner/Risk first-build and refresh-failure lifecycle
workflow with:

```sh
npm run test:e2e -- --workers=1 src/tests/e2e/calculation-lifecycle.spec.ts
```

This path injects one sanitized Worker failure per task kind at a time, proves
visible fixed-copy Retry, retains and labels the previous successful output,
recovers to `ready` and checks that raw Worker details never render.

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

Run the exact-raw one-step Economy Undo paths with:

```sh
npm run test:e2e -- --workers=1 --grep "Economy destructive Undo|price history Undo|manual price Undo|PriceSet reset Undo"
```

The named paths compare raw localStorage strings before a destructive action
and after Undo, reload the durable history and selected-PriceSet restores,
retain unavailable manual rows and generated alch inside the exact selected
envelope, keep history/manual/unrelated keys isolated and separately prove
safe-session plus forced-clear-failure live-only restoration. This is local
Chromium evidence, not a cross-browser storage guarantee.

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
npm run test -- src/tests/*-view-model.test.ts
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
npm run test -- src/tests/*-view-model.test.ts
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
[setup file-transfer controller specification](../setup-file-transfer-controller-spec.md)
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

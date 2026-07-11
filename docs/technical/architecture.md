# Architecture

This document separates current architecture from the proposed rewrite architecture.

## Current state, verified from repo

- Product: 2004scape Combat Simulator, currently documented at Revision 274.
- Rewrite direction: new implementation that preserves end-user workflows without preserving legacy architecture or legacy calculation decisions by default.
- Production entrypoint: `index.html`, a Vite module entry that mounts `src/app/main.tsx`.
- Runtime: static browser app built with Vite.
- UI: React from npm dependencies bundled by Vite; no production CDN React or runtime Babel path is required.
- Archived legacy runtime: `legacy/index.html` still loads the old script-order app for reference only.
- Legacy source: plain JavaScript files attached to `window.*`; retained under D-060 for golden fixtures, archive comparison, legacy-derived static runtime snapshot generation and readiness comparison. The root app no longer executes those source files during normal bootstrap, and the archive is not a supported runtime or product truth source.
- Styling: `styles.css` plus substantial inline styles in `views.jsx`.
- Data files: `prices.json`, `alch.json`, `price-history.json`.
- Rewrite implementation: `package.json`, TypeScript/Vite/Vitest/Playwright config and `src/` directories now own the root app path.
- Missing from this checkout: general CI config, backend source, database schema and `run_sim.py`. A narrow scheduled market price workflow exists at `.github/workflows/update-market-prices.yml`.

## Archived legacy script order

`legacy/index.html` loads the archived app in this order:

1. `gamedata.js` creates `window.GameData`.
2. `engine.js` creates `window.SimEngine`.
3. `trip.js` creates `window.TripModel`.
4. `equipment.js` creates `window.Equipment`.
5. `market.js` patches prices and exposes market helpers.
6. `planner-core.js` creates `window.SimPlanner`.
7. `planner.jsx` creates `window.PlannerPane`.
8. `views.jsx` defines the main React UI.
9. Inline JSX renders `<CombatWorkbench />`.

The load order remains relevant for legacy parity and fixture work, but it is not the production app path.

## Current source areas

- `engine.js`: combat math, specials, prayers, cannon, loot valuation, supply costs and trip integration.
- `gamedata.js`: monster data, drop tables, item prices, alch values, loot rules and GameData mutators.
- `equipment.js`: gear registry and bonus summing.
- `trip.js`: food, potions, inventory, stackability, banking and incoming damage estimates.
- `market.js`: market price sync, `prices.json`/`alch.json` loading and price history persistence.
- `planner-core.js`: training-order planner domain logic.
- `planner.jsx`: planner UI.
- `views.jsx`: archived legacy main workbench, compare, loot, economy, settings, spreadsheet and docs-link architecture panel.
- `src/app`: Vite/React rewrite UI for the selected parity slice. It owns form state, per-combat-type setup loadout state, rewrite-owned monster-specific custom setup state, view models and presentation, adapts into domain requests and uses the composed `FullSimulationResult` as the primary source for the main simulation view model's numeric result and warning fields. Dense Compare/Compare, current-target Duel rows and the on-demand Duel monster matrix read their rate, XP and economy numbers from that same composed result path instead of maintaining a separate combat+trip+XP truth source.
- `src/app/state/loot-settings.ts`: rewrite-owned browser-local per-monster loot settings for high-alch enablement, kill overhead seconds and talisman spot. It is versioned separately from row-level `index-sim:loot-prefs` so existing drop action preferences keep their v1 shape.
- `src/app/state/selected-price-set.ts`: rewrite-owned browser-local selected active `PriceSet` state in `index-sim:price-set:selected`. It restores a valid selected `PriceSet` over the scheduled static snapshot or bundled fallback on load, validates with `PriceSetSchema`, rejects oversized/invalid/version-mismatched envelopes and clears only this key on local-override reset.
- `src/app/state/price-history.ts`: keeps capped rewrite-owned browser-local comparison snapshots in `index-sim:price-history`, converts validated committed `price-history.json` rows into read-only analysis snapshots and merges the two sources only in memory for Economy/Loot analysis. Clearing local history never changes the shared static artifact.
- `src/app/state/local-state-health.ts`: rewrite-owned browser-local state health reporting for allowlisted `index-sim:*` keys. It reuses the current versioned storage loaders, exposes only metadata/status/version/sanitized reason fields, reports invalid, unsupported, storage-unavailable and save-failed states, supports per-key and invalid-key clearing for known rewrite-owned keys only and powers the Settings recovery view. It does not read, export or log raw persisted payloads and does not migrate old rewrite versions automatically.
- `src/domain/shared`: typed rewrite contracts for requests, context and shared data (`SimulationRequest`, `SimulationContext`, `GameDataSnapshot`, `PriceSet`, manual combat overrides and related types). The combat-only result is explicitly named `CombatSimulationResult`; composed whole-result output belongs to `src/domain/simulation`.
- `src/domain/equipment`: pure equipment bonus summing and loadout-to-combat bonus mapping. It receives a `GameDataSnapshot` and does not read browser globals.
- `src/domain/combat`: pure combat/equipment slice for max hit, hit chance, stance selection, prayers, boosts, attack speed, poison trickle and special-attack DPS. It does not own loot, trip, economy or planner behavior.
- `src/domain/trip`: pure trip/loot/supply slice for inventory, banking, incoming damage, stackability, loot actions, alch handling, general potion carry recommendation, cannon occupancy/overlay, supply costs and structured gem/item price alias/fallback warnings. D-058 keeps source-backed cut/uncut gem identities distinct: exact price keys win and reviewed D-052 aliases are fallback-only. It receives `SimulationRequest`, combat results, `GameDataSnapshot` and `PriceSet`; it does not read browser globals.
- `src/domain/economy`: pure exact-first `PriceSet` lookup helpers, a limited legacy-derived price fallback alias map, alias-map collision validation and structured missing-price/missing-alch warnings. Source item identity is not collapsed through price aliases. It does not read browser state or mutate price data.
- `src/domain/simulation`: pure composed-result foundation. It defines `FullSimulationResult`, scopes combat/trip warnings and composes current combat, trip/loot/supply and XP rate slices without React state, display strings, persistence envelopes, browser APIs or live network calls. The main `createSimulationViewModel()` path consumes this contract while still building UI-only labels, reset/review actions, loot row details and Stats presentation models in `src/app`.
- `src/domain/planner`: pure training-plan search for the rewrite. It consumes `simulateCombat`, combat XP breakdowns, trip/loot/supply results, `GameDataSnapshot` and `PriceSet`; it does not own combat math or equipment bonus truth.
- `src/data`: Zod schemas for `GameDataSnapshot`, items, monsters, drops, equipment, `PriceSet`, price history and live integration API contracts, raw data reliability helpers for duplicate JSON keys and duplicate id detection, committed generated-data outputs, plus the legacy data adapter that validates the current bundled data shape before static bridge snapshots are generated.
- `src/data/market-source-mapping.ts`: bounded market item allowlist and item-id-to-source-slug mapping audited against the current `markets.lostcity.rs/api/items` catalog, with ambiguous dragonhide and half-key identities resolved from canonical item ids/source identities.
- `src/adapters/static-runtime`: legacy-derived static bridge retained for regression/reference, bridge freshness and rollback evidence. It is no longer the root app bootstrap.
- `src/adapters/legacy-runtime`: DOM-free trusted bundled legacy bootstrap helper. It builds the reference `GameDataSnapshot` by executing bundled `gamedata.js`, `engine.js` and `equipment.js` sources inside an adapter-owned sandbox, then validates the result through `src/data/legacy-adapter.ts`. It is retained for tests, golden/reference comparison and regenerating the legacy-derived static bridge, not as the root app bootstrap.
- `src/adapters/browser`: browser-only file export/import helpers, the shareable-setup current-base URL/fragment/clipboard boundary in `shareable-url.ts`, plus compatibility re-export for legacy reference helpers used by tests and migration/evidence work.
- `src/app/state/shareable-setup.ts`: strict external permalink contract, bounded UTF-8 base64url codec, duplicate-key-safe parsing, generated-game-data entity compatibility review and pure current-monster form/Cannon/loot apply/undo state. It does not own browser APIs, prices, collections, computed output or persistence.
- `src/adapters/generated`: root source-backed runtime adapter. It builds a schema-valid `SimulationContext` from committed `src/data/generated/game-data.json` and scheduled market prices. Generated item prices fill missing market ids, and generated item alch values are authoritative for every composed, restored or imported PriceSet. Its DOM-free readiness core checks exact runtime ID coverage, required field presence, monster combat/loot completeness and PriceSet coverage; intentional value deltas are owned by revision-impact evidence, not readiness equality checks.
- `src/adapters/storage`: versioned `PersistedEnvelope<T>` helpers for new rewrite-local state plus known legacy-key detection, per-key legacy migration policy classification, safe setup/hiscores/price compatibility reports and explicit legacy-key clearing helpers. Rewrite UI paths use non-fatal read/save/clear result metadata for browser storage access failures without changing the persisted envelope format.
- `src/adapters/market`: validated `PriceSet` file import, read-only scheduled static price snapshot loader/status contract, same-origin market status/sync compatibility adapter and explicit `PriceSet` response validation.
- `src/adapters/hiscores`: same-origin browser adapter for hiscores status and lookup responses, plus versioned storage for the last searched player.
- `src/data/market-sync-items.ts`: market sync item expansion for current-monster, all-supported and explicit item scopes. It expands nested loot rows, tagged drop dependencies and support items through the catalog-audited bounded allowlist instead of UI special cases.
- `src/server/hiscores-core.ts`: framework-neutral hiscores status/lookup handler with request validation, timeout/rate-limit guard and sanitized errors. The default provider is disabled until an authoritative upstream is accepted.
- `src/server/vite-hiscores-middleware.ts`: Vite dev/preview middleware that exposes the hiscores API boundary for local same-origin runs without choosing a production backend framework.
- `src/server/cloudflare-worker.ts`: D-066 production fetch adapter. It injects the same fixed-origin provider, maps trusted Cloudflare client metadata only into the ephemeral rate-limit key, routes API before SPA fallback and adds sanitized API security responses.
- `wrangler.jsonc` and `public/_headers`: one Cloudflare Worker + Static Assets root deployment, Worker-first `/api/*`, SPA fallback, static/API cache classes, CSP/security headers, preview URLs and disabled Workers Logs/Logpush.
- `src/server/market-core.ts`: framework-neutral market status/sync handler with request validation, item allowlist expansion, timeout/rate-limit guard, partial failure reporting and sanitized errors. The default provider is disabled until an authoritative upstream is accepted.
- `src/server/vite-market-middleware.ts`: Vite dev/preview middleware that exposes the market API boundary for local same-origin runs without choosing a production backend framework.
- `scripts/generate-game-data.ts` and `scripts/game-data-generator-core.ts`: repo-owned Revision 274 generator. The raw path recursively parses pinned `.npc`, `.obj`, `.dbrow`, `.param` and `.rs2` sources, resolves reviewed runtime mappings, writes only `source-pin.json`, `game-data.json` and the current revision-impact report, and rejects unsafe paths/output shapes. The committed report compares against the legacy-derived active-reference snapshot, uses scheduled prices plus generated fallbacks, runs 10 runtime representative cases and a 189-evaluation all-monster scan, and records accepted D-055/D-057 deltas. Normalized `index-sim-source-slice` files remain isolated contract-test fixtures, including the strict generated requirement schema. The active raw snapshot currently has no authoritative requirement skill map, so Planner/loadout consumers use the D-051 manual fallback.
- `scripts/lostcity-content-*`: direct LostCityRS/Content Revision 274 parser and snapshot assembler. It rejects duplicate config/handler definitions, emits repository-relative sanitized diagnostics, resolves all expected monster/item/weapon/ammo/spell/equipment identities and extracts 63/63 core-loot tables with 1,101 top-level entries. Four quest-gated rows and 21 clue-scroll tertiary rows remain explicit exclusions. D-055 through D-058 own reviewed source deltas and identity semantics.
- Current generated runtime evidence: `npm run runtime:readiness` is `ready` with zero blockers across IDs, required runtime fields, 63 monster combat/loot rows and PriceSet coverage. `docs/project/revision-impact/current.md` passes 10/10 representative cases with accepted source deltas and reports 22 informational all-monster outliers. D-059 makes this generated snapshot root runtime truth; the legacy-derived bridge remains reference evidence.
- `scripts/write-scheduled-market-prices.ts`, `scripts/scheduled-market-writer-core.ts` and `scripts/markets-lostcity-item-page-adapter.ts`: repo-owned scheduled market writer, robust estimator and first-page Inertia adapter. `--input` keeps a normalized fixture/dev contract; `--upstream-url` must be the exact approved origin root and derives one `/items/{slug}` request per catalog-audited mapping. Requests run sequentially with a 350 ms delay, bounded body/timeout/redirect checks and immediate removal of player identity fields. Completed coin-only buy and sell rows are unweighted observations; item/mixed/ambiguous offers are skipped. Adaptive MAD/median filtering, 90/30-day freshness gates and prior-value retention produce `prices.json`. History keeps 12-hour points for 90 days and one latest point per older UTC day. Public crawler policy, a full 80-mapping live dry-run and exact root Actions variable are evidenced. The workflow commits only `prices.json` and `price-history.json`; the first successful configured run remains required before scheduled-current claims.
- `scripts/deployment-readiness-core.ts` and `scripts/verify-public-deployment.ts`: public-release validation. The artifact gate checks the D-066 root-path Vite output, Cloudflare `_headers` contract, hashed asset references, source-map/secret/path hygiene, validated market files and a deterministic artifact SHA-256. The HTTPS smoke checks root/assets/market routes, response content types, cache classes, CSP/security headers, API-vs-SPA routing and enabled Hiscores status without issuing a player lookup. A future operator runs the HTTPS smoke against its preview/production instance before a live claim.
- `src/tests`: scaffold tests, golden legacy tests and domain parity/unit tests.

## Current risk boundaries

- Archived legacy domain code reads from `window.*` and is not isolated from browser state.
- Archived `SimEngine.simulate()` is still the current-behavior golden fixture baseline, but it also reads and mutates `GameData`.
- Legacy price data can come from embedded defaults, JSON files, live market fetches, imports and `localStorage`; the rewrite path receives explicit `PriceSet` values.
- Legacy UI state, saved setup state and simulation request state are tightly coupled; the rewrite UI separates these contracts.
- `views.jsx` no longer presents the stale Next.js/FastAPI/SQLite board; it links to docs instead.

Use [../../ARCHITECTURE_AUDIT.md](../../ARCHITECTURE_AUDIT.md) for the full audit details and [rewrite-spec.md](rewrite-spec.md) for the implementation-grade rewrite target.

## Target rewrite architecture

Recommended shape:

```text
src/domain/combat/
  pure combat formulas, damage, XP, prayers, potions, specials

src/domain/equipment/
  pure loadout and equipment bonus summing

src/domain/trip/
  inventory, banking, food, potions, stackability, loot policy, alch and supply costs

src/domain/simulation/
  composed FullSimulationResult contract and pure result assembly

src/data/
  generated snapshots, schemas, provenance metadata

src/domain/economy/
  pure PriceSet lookup, alch values and structured warnings

src/domain/planner/
  training plan search using domain modules

src/app/
  React UI, routes/tabs, view models, persisted UI state

src/adapters/browser/
  localStorage, fetch, file imports and bootstrap wiring

src/adapters/market/
  browser price import and same-origin market status/sync glue

src/adapters/hiscores/
  browser same-origin hiscores status/lookup glue and local last-player persistence

src/server/
  framework-neutral API cores plus dev/preview middleware for accepted live integrations
```

Recommended technology stack:

- TypeScript strict mode
- React
- Vite
- Vitest
- Playwright for e2e smoke/regression tests
- Zod for data and persisted-state schemas
- fast-check only where property tests add clear value

The detailed rewrite contract is owned by [rewrite-spec.md](rewrite-spec.md).

## Target boundaries

- Domain modules must not import React or read DOM, `window`, `localStorage` or `fetch`.
- `SimulationRequest` must be separate from UI form state and saved setup state.
- `GameDataSnapshot` must be explicit and validated.
- `PriceSet` must be explicit and passed into simulation or adapter boundaries.
- Planner must consume domain APIs, not duplicate combat or equipment rules.
- Browser persistence belongs in adapters and must be versioned.
- Compare/planner execution should go through a worker-compatible calculation runner boundary, even if the first implementation runs on the main thread.
- Results should carry structured warnings/provenance so the UI can show lightweight uncertainty markers near affected numbers. The rewrite view model keeps `warnings: string[]` compatibility while also exposing structured calculation/money warning view models for Result, Loot and Economy surfaces and structured setup requirement warnings for the active loadout.

## Current rewrite extraction status

- Implemented: typed contracts, equipment bonus summing and combat core through base DPS, special-attack DPS and bounded manual accuracy/damage/speed overrides.
- Implemented: pure trip/loot/supply domain for stackability, default loot actions, alch handling, incoming damage, food/potion/prayer/recoil/cannon inventory, domain-owned general potion carry recommendation, scarce/respawn-bound trip rate caps, banking efficiency, cannon occupancy/overlay and supply cost calculations.
- Implemented: pure planner domain for gear eligibility, training stance selection, domain-backed candidate scoring, phase grouping and deterministic golden plan summaries.
- Implemented: React/Vite rewrite UI using view models for combat setup, active-style gear quick actions, non-blocking generated requirement warnings for the selected weapon/equipped gear with D-051 manual fallback when generated data is missing, result summary, special attack controls/metrics, loot/economy, visible money warning surfacing, trip, final per-monster Cannon workbench tab, Duel snapshots/current-target comparison/on-demand monster matrix, monster compare and planner in a selected parity slice. The primary `createSimulationViewModel()` adapter exposes and reads combat, trip, XP/rate and structured warning sources from `FullSimulationResult`; Dense Compare/Compare, Duel rows and the Duel matrix reuse that same composed result path for numeric fields. Planner remains a combat-focused domain consumer with explicit `CombatSimulationResult` typing instead of using the composed UI-facing result.
- Implemented: rewrite-owned Planner UI state foundation in `src/app/state/planner.ts` with the versioned `index-sim:planner-ui` persistence contract for metric, target levels, current XP, skill locks, avg-over-session, only-current-gear and gear-pool restrictions. `src/app/view-models/simulation.ts` adapts that state into `src/domain/planner` input/options while keeping Planner UI state out of `SimulationRequest`, constrains gear-pool ids to the active non-hypothetical default planner pool and builds Planner panel data for summary, training order, unlock summary, gear timeline, DPS-vs-cumulative-XP chart output and warnings. The workbench Planner tab exposes the metric/current-XP/target/skill-lock/avg-over-session/gear-pool/Recompute workflow, with only-current-gear mapped to the domain `lockGear` option and avg-over-session mapped to the domain Planner `sustained` option independently of combat setup sustained mode. Planner output uses generated item requirements from `GameDataSnapshot.requirements` when present and surfaces an info warning only when it falls back to the D-051 manual requirement fallback for missing generated data.
- Implemented: rewrite-owned Duel snapshot workflow in `src/app/state/duel-snapshots.ts` with the separate versioned `index-sim:duel-snapshots` persistence contract for validated `CombatSetupFormState` snapshots capped at 12 entries. `src/app/view-models/simulation.ts` builds current-target Duel comparison rows, structured active-setup field diffs and the user-triggered all-monster matrix by reusing the current simulation view-model path for the live setup and each saved snapshot, keeping Duel UI state and calculated comparison output out of `SimulationRequest`. The visible Duel tab can snapshot the current setup, rename/load/delete snapshots, preserve the current target when loading, show DPS/XP/economy deltas and best markers, and review grouped live-versus-snapshot fields together with broader calculated impact. The diff intentionally excludes the shared target, prices, cannon, loot policy, Planner targets and inactive per-style caches, and it reports comparison rather than causal attribution under D-068. The matrix remains on demand, is not persisted and is invalidated rather than silently recomputed when its source references change. Export/import uses the unchanged strict version 1 snapshot envelope; import is bounded, rejects malformed or computed-result payloads and safely merges matching ids without clearing current state. Compatible legacy `sim_input_v3.duelSetups` rows migrate through bounded field mapping into the same rewrite-owned Duel storage; existing rewrite snapshots win, the 12-entry cap applies and invalid or computed rows are reported with sanitized reasons. [The setup diff specification](duel-setup-diff-spec.md) owns the detailed comparison contract.
- Implemented UI/state foundation: versioned rewrite setup and custom/cannon/Duel state, dense compare preferences, loot settings, hidden gear tiers, local-state recovery, bounded legacy migration, setup and PriceSet import/export, selected PriceSet persistence and scheduled-or-bundled fallback. Market prices from scheduled/imported/legacy PriceSets remain explicit, while generated Revision 274 high-alch values always win. Economy/Loot analyze read-only shared static history together with separate capped local comparisons; `Save local comparison` and `Clear local history` change only the local key. Other setup, trip, planner and migration details remain owned by their feature modules and inventory rows.
- Implemented: static shareable setup permalinks through `src/app/state/shareable-setup.ts`, `src/adapters/browser/shareable-url.ts` and `src/app/App.tsx`. The external version 1 fragment is captured once, removed from the address bar, size/schema/duplicate-key/entity validated and held in memory until explicit Load. The shared active form plus current-monster Cannon/loot state uses existing persistence paths after Load; Dismiss writes nothing and one in-memory Undo restores the complete pre-load owned state. PriceSet/history, player identity, custom/Duel collections, computed output and raw provenance stay outside the contract.
- Implemented: root production entrypoint uses the Vite rewrite; legacy CDN/Babel HTML is archived at `legacy/index.html`.
- Implemented: rewrite setup import validates the full persisted envelope version before applying imported state. Older rewrite setup versions are still rejected through the version-mismatch path instead of being implicitly migrated.
- Implemented: validated data/economy contracts for `GameDataSnapshot`, item definitions, item requirement definitions, monster/drop data, equipment data, `PriceSet`, imported price JSON, committed price history and committed generated-data outputs. Economy, loot, tagged-table and supply paths look up an exact source item/price key first and use the limited legacy-derived gem alias map only as a missing-key fallback. D-058 keeps cut and uncut Revision 274 gem identities distinct while preserving the D-052 fallback compatibility boundary; duplicate alias collisions remain validated.
- Implemented: shared live integration contracts, Zod validation, mocked fixture basis, the D-061 first-party 2004Scape Hiscores JSON provider behind the same-origin status/lookup boundary, a market source allowlist, same-origin market compatibility scaffolding, the visible scheduled static price/history path, D-062's item-page writer and the scheduled GitHub Actions commit-if-diff workflow. Vite dev/preview and the D-066 Cloudflare Worker inject the fixed-origin Hiscores provider with redirect, timeout, response-size, schema, rate-limit and sanitized-error boundaries. Cloudflare serves the Vite artifact and API as one root-path unit with observability/Logpush disabled; this adds no database, server-managed state or default-test live upstream call.
- Implemented: legacy runtime adapter that turns current `gamedata.js`, `engine.js` and `equipment.js` objects into a validated reference snapshot inside a trusted sandbox without reading real browser globals, plus a committed legacy-derived static bridge retained under D-060 for reference, regression, freshness and rollback evidence. The root app no longer consumes that bridge, and no legacy deletion program is active.
- Covered by tests: formulas, stance fallback, two-handed shield exclusion, thrown ammo handling, bounded manual combat override behavior, golden parity for ported combat fields across the 18 `SimEngine.simulate()` fixtures, trip/loot/supply parity across all 18 fixtures including cannon occupancy and cannonball supply plus focused scarce/respawn, inventory reserve detail and general potion carry recommendation coverage, planner unit tests plus 4 V1 acceptance golden plan fixtures, Planner UI state/schema and adapter tests including avg-over-session mapping, gear-pool cleanup, editor options, timeline data and deterministic chart data, UI view-model tests including active per-style loadout request mapping, multi-prayer/multi-boost request normalization, active-style gear quick action scoring, setup requirement warning surfacing for selected weapon/equipped gear, manual override request mapping, Trip scarce/reserve mapping, derived potion recommendation, linked cannon/sparse assumptions, per-monster loot settings, money warning surfacing, dense compare filters/relevance state and custom setup dense row mapping, versioned persistence tests including per-style loadout, multi-prayer/multi-boost normalization, manual override, dense compare state, Trip scarce controls, derived recommendation non-persistence, per-monster cannon settings, per-monster loot settings, hidden gear tier state/filtering and custom setup validation, rewrite local state health tests for missing/loaded/invalid/version-mismatch metadata and allowlisted clearing, legacy migration/reset tests including nested `sim_input_v3.monsterSetups` custom setup import, nested `sim_input_v3.cannonByMonster` cannon import, nested `sim_input_v3.duelSetups` Duel snapshot import, conflict/invalid/unsafe skip paths, `sim_planner_v1` review-only/non-import behavior and compatible `sim_hidden_tiers_v1`, `sim_compare_sort_v1`, `sim_irrelevant_v1` and `sim_loot_prefs_v1` imports with invalid/unknown/ambiguous/oversized skips, local Economy movers and chronological item-trend analysis tests, Playwright smoke tests including per-style loadout restore, multi-prayer/multi-boost controls with compact primary edits, active-style gear quick actions, loadout requirement warning review to the active combat tab, manual combat override reset, hidden gear tier filtering with current selection preserved, Settings local state recovery/clear, dense compare filter/relevance persistence, Trip scarce/prayer/food/banking/potion-carry/recommendation-apply/inventory-reserve controls and grouped summary details, Result/Loot/Economy price warning surfacing, final Cannon tab link/reset/output metrics, Planner tab metric/current-XP/target/skill-lock/avg-over-session/gear-pool/Recompute/training-order/timeline/chart/warning flow, legacy Planner state import/keep/clear boundary, per-monster loot settings persistence, Economy history, item-trend/sparkline controls and SetupBar custom setup create/restore/remove, schema validation for the legacy snapshot, committed price files and legacy-derived static runtime bridge, raw JSON duplicate-key detection, duplicate legacy monster id rejection, malformed loot entry rejection, malformed imported price rejection, missing-price and price alias/fallback warnings, mocked live integration contract validation, mocked hiscores API/adapter/UI apply behavior and mocked market API/adapter/UI sync behavior.
- Later product/data decisions remain for authoritative raw-source item requirement fallback removal, quest-gated/clue tertiary loot policy and source-backed NPC-size behavior. D-067 closes repository implementation for Cloudflare/Hiscores and scheduled market automation; account connection, deployed D-065 verification and an observed configured cron are adopter operations. Public live and scheduled-current claims remain gated on that concrete environment evidence.
- The root runtime adapter consumes the schema-validated committed Revision 274 snapshot at `src/data/generated/game-data.json`. It composes scheduled market prices over generated price fallbacks and then replaces the complete high-alch map with generated Revision 274 values. D-059 records the switch and D-063 records alch ownership; the legacy-derived bridge and `alch.json` are reference/regression evidence only.
- The accepted generated data source is one normalized current `GameDataSnapshot` generated from the pinned LostCityRS/Content revision. `npm run data:generate` parses the raw checkout, resolves every expected runtime monster/item/weapon/ammo/spell/equipment identity, extracts all 63 core-loot tables, writes the current snapshot/source pin/report, and produces representative plus all-monster impact evidence. `npm run runtime:readiness` reports zero blockers for the active generated snapshot. The active raw snapshot has no authoritative `requirements` map, so Planner/setup paths continue to use the visible, non-blocking D-051 manual fallback until requirement skill inference is accepted.
- Target market price source is `markets.lostcity.rs`; scheduled-only GitHub Actions refresh into `prices.json` and `price-history.json` is accepted. D-062's item-page adapter/estimator, catalog audit and full live dry-run plus D-064's read-only shared history path are implemented/evidenced. D-053 keeps the exact root `MARKET_PRICES_UPSTREAM_URL` value and latest successful scheduled-run evidence out of the V1/trusted-tester gate, but they remain required before scheduled-current market price claims.
- Runtime Babel, CDN React and real `window.*` script-order loading are no longer required for the root production app path.
- Raw legacy source execution still exists inside an adapter-owned sandbox for tests, reference comparison and regenerating the committed legacy-derived static bridge. This is trusted bundled code, not user input, and it is no longer the normal root app bootstrap path. Runtime readiness treats missing generated identities, required fields, monster combat/loot rows and PriceSet coverage as blockers; accepted value differences belong to revision-impact evidence instead of being misclassified as coverage failures.

## Open questions

- A future adopter may choose a custom domain after its preview/production evidence passes; no domain decision is required by this repository.
- Which authoritative upstream fields should map item requirements to app skill ids, and what evidence is sufficient to remove the D-051 fallback?
- Should the four quest-gated drops and 21 clue-scroll tertiary rows enter the snapshot, and under which explicit policy?
- If the accepted `markets.lostcity.rs/items/{slug}` Inertia contract changes, what reviewed replacement contract should supersede D-062?
- Should future Legacy Migration work broaden beyond the D-042-compatible `sim_input_v3.monsterSetups` and `sim_input_v3.cannonByMonster` import, for example to older shapes or additional legacy-only UI state?
- Whether the eventual public UI-facing contract should be renamed back to `SimulationResult` remains open. Current code uses `CombatSimulationResult` for the combat-only slice and `FullSimulationResult` for the composed foundation.
- D-048 keeps old planner state such as `sim_planner_v1` review-only/not migrated for V1. D-049 keeps full legacy price-history payloads review-only/not migrated for V1; any later full history import, shared/server-managed history or reset-only policy requires a separate product/storage decision.
- Which authoritative upstream fields should feed generated item requirement data before the manual planner fallback can be removed or demoted?
- D-047 keeps future/hypothetical weapons out of the V1 rewrite Planner. Exposing them later requires a separate product/data provenance decision.
- Should the app ever support user-selectable historical revisions, or keep only one current accepted revision?

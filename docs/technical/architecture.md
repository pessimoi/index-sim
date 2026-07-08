# Architecture

This document separates current architecture from the proposed rewrite architecture.

## Current state, verified from repo

- Product: 2004scape Combat Simulator, currently documented at Revision 274.
- Rewrite direction: new implementation that preserves end-user workflows without preserving legacy architecture or legacy calculation decisions by default.
- Production entrypoint: `index.html`, a Vite module entry that mounts `src/app/main.tsx`.
- Runtime: static browser app built with Vite.
- UI: React from npm dependencies bundled by Vite; no production CDN React or runtime Babel path is required.
- Archived legacy runtime: `legacy/index.html` still loads the old script-order app for reference only.
- Legacy source: plain JavaScript files attached to `window.*`; retained for golden fixtures, archive comparison and current data bootstrap.
- Styling: `styles.css` plus substantial inline styles in `views.jsx`.
- Data files: `prices.json`, `alch.json`, `price-history.json`.
- Rewrite implementation: `package.json`, TypeScript/Vite/Vitest/Playwright config and `src/` directories now own the root app path.
- Missing from this checkout: CI config, backend source, database schema and `run_sim.py`.

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
- `src/app`: Vite/React rewrite UI for the selected parity slice. It owns form state, per-combat-type setup loadout state, rewrite-owned monster-specific custom setup state, view models and presentation, and adapts into domain requests instead of reading `window.*`.
- `src/app/state/loot-settings.ts`: rewrite-owned browser-local per-monster loot settings for high-alch enablement, kill overhead seconds and talisman spot. It is versioned separately from row-level `index-sim:loot-prefs` so existing drop action preferences keep their v1 shape.
- `src/app/state/selected-price-set.ts`: rewrite-owned browser-local selected active `PriceSet` state in `index-sim:price-set:selected`. It restores a valid selected `PriceSet` over the scheduled static snapshot or bundled fallback on load, validates with `PriceSetSchema`, rejects oversized/invalid/version-mismatched envelopes and clears only this key on local-override reset.
- `src/app/state/price-history.ts`: rewrite-owned browser-local price history state for accepted imported, synced or manually captured active `PriceSet` snapshots plus pure local movers analysis helpers. It uses the shared versioned storage envelope; legacy price keys are read only by the explicit legacy import/report flow before a compatible current price/alch map is accepted as a `PriceSet`.
- `src/app/state/local-state-health.ts`: rewrite-owned browser-local state health reporting for allowlisted `index-sim:*` keys. It reuses the current versioned storage loaders, exposes only metadata/status/version/sanitized reason fields, reports invalid, unsupported, storage-unavailable and save-failed states, supports per-key and invalid-key clearing for known rewrite-owned keys only and powers the Settings recovery view. It does not read, export or log raw persisted payloads and does not migrate old rewrite versions automatically.
- `src/domain/shared`: typed rewrite contracts for the current combat/equipment slice (`SimulationRequest`, `SimulationContext`, `SimulationResult`, `GameDataSnapshot`, `PriceSet`, manual combat overrides and related types).
- `src/domain/equipment`: pure equipment bonus summing and loadout-to-combat bonus mapping. It receives a `GameDataSnapshot` and does not read browser globals.
- `src/domain/combat`: pure combat/equipment slice for max hit, hit chance, stance selection, prayers, boosts, attack speed, poison trickle and special-attack DPS. It does not own loot, trip, economy or planner behavior.
- `src/domain/trip`: pure trip/loot/supply slice for inventory, banking, incoming damage, stackability, loot actions, alch handling, general potion carry recommendation, cannon occupancy/overlay, supply costs and structured gem/item price alias/fallback warnings for tagged table calculations. It receives `SimulationRequest`, combat results, `GameDataSnapshot` and `PriceSet`; it does not read browser globals.
- `src/domain/economy`: pure `PriceSet` lookup helpers and structured missing-price/missing-alch warnings. It does not read browser state or mutate price data.
- `src/domain/planner`: pure training-plan search for the rewrite. It consumes `simulateCombat`, combat XP breakdowns, trip/loot/supply results, `GameDataSnapshot` and `PriceSet`; it does not own combat math or equipment bonus truth.
- `src/data`: Zod schemas for `GameDataSnapshot`, items, monsters, drops, equipment, `PriceSet`, price history and live integration API contracts, raw data reliability helpers for duplicate JSON keys and duplicate id detection, committed generated-data foundation outputs, plus a legacy runtime adapter that validates the current bundled data shape.
- `src/data/market-source-mapping.ts`: legacy-derived, non-canonical market item allowlist and item-id-to-source-slug mapping for future scheduled market price validation.
- `src/adapters/browser`: browser-only bootstrap and file export helpers. It builds the current `GameDataSnapshot` by executing bundled legacy data sources inside an adapter-owned sandbox.
- `src/adapters/storage`: versioned `PersistedEnvelope<T>` helpers for new rewrite-local state plus known legacy-key detection, per-key legacy migration policy classification, safe setup/hiscores/price compatibility reports and explicit legacy-key clearing helpers. Rewrite UI paths use non-fatal read/save/clear result metadata for browser storage access failures without changing the persisted envelope format.
- `src/adapters/market`: validated `PriceSet` file import, read-only scheduled static price snapshot loader/status contract, same-origin market status/sync compatibility adapter and explicit `PriceSet` response validation.
- `src/adapters/hiscores`: same-origin browser adapter for hiscores status and lookup responses, plus versioned storage for the last searched player.
- `src/data/market-sync-items.ts`: market sync item expansion for current-monster, all-supported and explicit item scopes. It expands nested loot rows, tagged drop dependencies and support items through the legacy-derived allowlist instead of UI special cases.
- `src/server/hiscores-core.ts`: framework-neutral hiscores status/lookup handler with request validation, timeout/rate-limit guard and sanitized errors. The default provider is disabled until an authoritative upstream is accepted.
- `src/server/vite-hiscores-middleware.ts`: Vite dev/preview middleware that exposes the hiscores API boundary for local same-origin runs without choosing a production backend framework.
- `src/server/market-core.ts`: framework-neutral market status/sync handler with request validation, item allowlist expansion, timeout/rate-limit guard, partial failure reporting and sanitized errors. The default provider is disabled until an authoritative upstream is accepted.
- `src/server/vite-market-middleware.ts`: Vite dev/preview middleware that exposes the market API boundary for local same-origin runs without choosing a production backend framework.
- `scripts/generate-game-data.ts` and `scripts/game-data-generator-core.ts`: repo-owned generated-game-data foundation entrypoint and testable core. They validate the repository-local `.sources/lostcity-content/` source checkout path and can write the current normalized foundation outputs at `src/data/generated/source-pin.json`, `src/data/generated/game-data.json` and `docs/project/revision-impact/current.md`. The core validates generated output hygiene before writing so raw upstream dump keys, historical generated snapshot archive paths, market price history fields and absolute user-home paths cannot enter the generated artifacts through this foundation path. The committed foundation snapshot/report are schema-valid or markdown-deterministic for the fixture source and marked as manual/foundation provenance. LostCityRS/Content file parsing, full hybrid calculation-impact generation and runtime bootstrap replacement are not present yet.
- `scripts/write-scheduled-market-prices.ts` and `scripts/scheduled-market-writer-core.ts`: repo-owned scheduled market writer entrypoint and fixture-validated core. They consume a normalized `markets.lostcity.rs` input contract, update only allowlisted mapped items, validate `prices.json`, `alch.json` and `price-history.json` candidates before writing, keep deterministic ordering and retain one shared price-history snapshot per 12-hour bucket. GitHub Actions cron wiring and the raw live upstream response adapter are not present yet.
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
- Implemented: React/Vite rewrite UI using view models for combat setup, active-style gear quick actions, non-blocking manual requirement-policy warnings for the selected weapon/equipped gear, result summary, special attack controls/metrics, loot/economy, visible money warning surfacing, trip, final per-monster Cannon workbench tab, Duel snapshots/comparison, monster compare and planner in a selected parity slice.
- Implemented: rewrite-owned Planner UI state foundation in `src/app/state/planner.ts` with the versioned `index-sim:planner-ui` persistence contract for metric, target levels, current XP, skill locks, avg-over-session, only-current-gear and gear-pool restrictions. `src/app/view-models/simulation.ts` adapts that state into `src/domain/planner` input/options while keeping Planner UI state out of `SimulationRequest`, constrains gear-pool ids to the active non-hypothetical default planner pool and builds Planner panel data for summary, training order, unlock summary, gear timeline, DPS-vs-cumulative-XP chart output and warnings. The workbench Planner tab exposes the metric/current-XP/target/skill-lock/avg-over-session/gear-pool/Recompute workflow, with only-current-gear mapped to the domain `lockGear` option and avg-over-session mapped to the domain Planner `sustained` option independently of combat setup sustained mode. Planner output surfaces an info warning that item requirements use the current manual policy until generated requirements are accepted.
- Implemented: rewrite-owned Duel snapshot workflow in `src/app/state/duel-snapshots.ts` with the separate versioned `index-sim:duel-snapshots` persistence contract for validated `CombatSetupFormState` snapshots capped at 12 entries. `src/app/view-models/simulation.ts` builds Duel comparison rows by reusing the current simulation view-model path for the live setup and each saved snapshot against the active monster, keeping Duel UI state and calculated comparison output out of `SimulationRequest`. The visible Duel tab can snapshot the current setup, rename/load/delete snapshots, preserve the current target when loading, and show XP/hr, effective net GP/hr, GP/XP and best markers. Legacy `duelSetups` migration is still open work.
- Implemented: browser adapters for sandboxed legacy data bootstrap, version 3 rewrite setup persistence with per-combat-type melee/ranged/magic loadout stash/restore, normalized multi-prayer/multi-boost arrays with canonical `None`, unknown-id dropping and same-category replacement, defaulted manual accuracy/damage/speed override state, Trip nullable auto-bank state, potion/vial/single-dose, DBA restore and rune-slot defaults, Trip scarce/AFK target and respawn controls, rewrite-owned monster-specific custom setup snapshots, dense compare sort/filter/irrelevant-state persistence, setup export/import, versioned per-monster loot settings, rewrite-owned hidden gear tier preferences in `src/app/state/hidden-gear-tiers.ts` using `index-sim:hidden-gear-tiers` for UI-only picker filtering, rewrite-owned local state health reporting/recovery in Settings for invalid, unsupported, storage-unavailable or save-failed known rewrite storage states, legacy storage detection with safe `sim_input_v3` setup, `sim_hiscore_player` last-player, compatible legacy price/alch import reports, compatible `sim_hidden_tiers_v1` hidden-tier import, compatible `sim_compare_sort_v1`/`sim_irrelevant_v1` dense compare import and compatible `sim_loot_prefs_v1` import for unambiguous current monster loot row ids, per-key legacy migration policy classification, `sim_planner_v1` detect/review-only handling that never imports into `index-sim:planner-ui`, user-facing import/keep/clear UX with visible review/reset details, validated price-set import/export, browser-local selected active `PriceSet` persistence, read-only scheduled static PriceSet fallback ahead of bundled prices, local override reset back to scheduled-or-bundled fallback, browser-local accepted-price history persistence and local Economy movers analysis/Snapshot now/Clear history behavior.
- Implemented: root production entrypoint uses the Vite rewrite; legacy CDN/Babel HTML is archived at `legacy/index.html`.
- Implemented: rewrite setup import validates the full persisted envelope version before applying imported state. Older rewrite setup versions are still rejected through the version-mismatch path instead of being implicitly migrated.
- Implemented: validated data/economy contracts for `GameDataSnapshot`, item definitions, monster/drop data, equipment data, `PriceSet`, imported price JSON, committed price history and committed generated-data foundation outputs.
- Implemented: shared live integration contracts, Zod validation, mocked fixture basis, a legacy-derived market source allowlist, the hiscores same-origin status/lookup boundary, the market same-origin status/sync compatibility boundary, the visible scheduled static price snapshot UI/fallback path and the local scheduled market writer foundation. Hiscores and market providers are disabled by default until authoritative upstreams are accepted; this does not choose production hosting, add GitHub Actions cron wiring, add databases, add server-managed shared price history or add live upstream tests.
- Implemented: legacy runtime adapter that turns current `gamedata.js`, `engine.js` and `equipment.js` objects into a validated snapshot without reading browser globals inside the adapter.
- Covered by tests: formulas, stance fallback, two-handed shield exclusion, thrown ammo handling, bounded manual combat override behavior, golden parity for ported combat fields across the 18 `SimEngine.simulate()` fixtures, trip/loot/supply parity across all 18 fixtures including cannon occupancy and cannonball supply plus focused scarce/respawn, inventory reserve detail and general potion carry recommendation coverage, planner unit tests plus 4 V1 acceptance golden plan fixtures, Planner UI state/schema and adapter tests including avg-over-session mapping, gear-pool cleanup, editor options, timeline data and deterministic chart data, UI view-model tests including active per-style loadout request mapping, multi-prayer/multi-boost request normalization, active-style gear quick action scoring, setup requirement warning surfacing for selected weapon/equipped gear, manual override request mapping, Trip scarce/reserve mapping, derived potion recommendation, linked cannon/sparse assumptions, per-monster loot settings, money warning surfacing, dense compare filters/relevance state and custom setup dense row mapping, versioned persistence tests including per-style loadout, multi-prayer/multi-boost normalization, manual override, dense compare state, Trip scarce controls, derived recommendation non-persistence, per-monster cannon settings, per-monster loot settings, hidden gear tier state/filtering and custom setup validation, rewrite local state health tests for missing/loaded/invalid/version-mismatch metadata and allowlisted clearing, legacy migration/reset tests including `sim_planner_v1` review-only/non-import behavior and compatible `sim_hidden_tiers_v1`, `sim_compare_sort_v1`, `sim_irrelevant_v1` and `sim_loot_prefs_v1` imports with invalid/unknown/ambiguous/oversized skips, local Economy movers analysis tests, Playwright smoke tests including per-style loadout restore, multi-prayer/multi-boost controls with compact primary edits, active-style gear quick actions, loadout requirement warning review to the active combat tab, manual combat override reset, hidden gear tier filtering with current selection preserved, Settings local state recovery/clear, dense compare filter/relevance persistence, Trip scarce/prayer/food/banking/potion-carry/recommendation-apply/inventory-reserve controls and grouped summary details, Result/Loot/Economy price warning surfacing, final Cannon tab link/reset/output metrics, Planner tab metric/current-XP/target/skill-lock/avg-over-session/gear-pool/Recompute/training-order/timeline/chart/warning flow, legacy Planner state import/keep/clear boundary, per-monster loot settings persistence, Economy history controls and SetupBar custom setup create/restore/remove, schema validation for the legacy snapshot and committed price files, raw JSON duplicate-key detection, duplicate legacy monster id rejection, malformed loot entry rejection, malformed imported price rejection, missing-price and price alias/fallback warnings, mocked live integration contract validation, mocked hiscores API/adapter/UI apply behavior and mocked market API/adapter/UI sync behavior.
- Not ported yet: full legacy UI parity, authoritative hiscores upstream provider, GitHub Actions scheduled market workflow/raw upstream adapter, legacy planner/custom setup/cannon and full price-history migration, and authoritative generated data workflow.
- The validated legacy snapshot is still an adapter over the current runtime files, not an authoritative generated data workflow.
- Target generated data source is a single normalized current `GameDataSnapshot` generated from the current accepted LostCityRS/Content game revision in staged v1 scope. The accepted scope is only simulator-consumed domain data: monsters, items, equipment/weapons/ammo/spells, drop rows, planner/loadout requirements and provenance/warnings. Revision bumps are accepted only as reviewed development changes through the manual `npm run data:generate` PR workflow. The command foundation and first schema-valid committed output/report files exist, but authoritative LostCityRS/Content parsing, full hybrid calculation-impact generation and runtime consumption are not present yet.
- Target market price source is `markets.lostcity.rs`; scheduled-only GitHub Actions refresh into `prices.json`, `alch.json` and `price-history.json` is accepted. The local writer and normalized fixture contract are present, but the GitHub Actions workflow and exact raw live upstream adapter are not present.
- Runtime Babel, CDN React and real `window.*` script-order loading are no longer required for the root production app path.
- Raw legacy source execution still exists inside an adapter-owned sandbox to build the current validated data snapshot. This is trusted bundled code, not user input.

## Open questions

- Which package manager should the rewrite use?
- Which backend/runtime should host the accepted hiscores integration boundary if direct browser APIs are not viable?
- What is the authoritative hiscores API/source? A visible HTML endpoint exists, but the final API answer is pending.
- What exact field schema and upstream mappings should implement the accepted normalized `src/data/generated/game-data.json` scope?
- What exact case file format and concrete item/spell/equipment ids should implement the accepted fixed melee/ranged/magic all-monster scan baselines?
- What exact raw live upstream response adapter should feed the accepted GitHub Actions `markets.lostcity.rs` price snapshot writer's normalized input contract?
- What is the deployment target? The architecture is static-first and provider-agnostic until live integration constraints are known.
- Should the visible legacy import/keep/clear workflow grow beyond compatible `sim_input_v3` setup fields, hiscores last-player, current price/alch maps, hidden tiers, dense compare state and unambiguous loot prefs into planner, custom setup, cannon maps or full price-history data?
- What should be the final public API shape of the full UI-facing `SimulationResult` after combat, trip, loot, supply and economy slices are composed?
- Should old keys such as `sim_planner_v1`, planner/custom setup state and full legacy price history be migrated into the rewrite UI, or intentionally left/reset? The current clear action can remove known legacy keys only after explicit user confirmation.
- Where should authoritative item requirement data come from, replacing the planner's manual requirement policy?
- Should future/hypothetical weapons be exposed in the rewrite planner, and how should that be surfaced to users?
- Should the app ever support user-selectable historical revisions, or keep only one current accepted revision?
- When is the rewrite accepted as a full replacement for every legacy workflow, allowing the archived legacy files to be deleted instead of retained for parity?

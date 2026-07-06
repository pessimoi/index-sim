# Architecture

This document separates current architecture from the proposed rewrite architecture.

## Current state, verified from repo

- Product: 2004scape Combat Simulator, Revision 274.
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
- `src/app`: Vite/React rewrite UI for the selected parity slice. It owns form state, view models and presentation, and adapts into domain requests instead of reading `window.*`.
- `src/app/state/price-history.ts`: rewrite-owned browser-local price history state for accepted imported or synced `PriceSet` snapshots. It uses the shared versioned storage envelope; legacy price keys are read only by the explicit legacy import/report flow before a compatible current price/alch map is accepted as a `PriceSet`.
- `src/domain/shared`: typed rewrite contracts for the current combat/equipment slice (`SimulationRequest`, `SimulationContext`, `SimulationResult`, `GameDataSnapshot`, `PriceSet` and related types).
- `src/domain/equipment`: pure equipment bonus summing and loadout-to-combat bonus mapping. It receives a `GameDataSnapshot` and does not read browser globals.
- `src/domain/combat`: pure combat/equipment slice for max hit, hit chance, stance selection, prayers, boosts, attack speed, poison trickle and special-attack DPS. It does not own loot, trip, economy or planner behavior.
- `src/domain/trip`: pure trip/loot/supply slice for inventory, banking, incoming damage, stackability, loot actions, alch handling, cannon occupancy/overlay and supply costs. It receives `SimulationRequest`, combat results, `GameDataSnapshot` and `PriceSet`; it does not read browser globals.
- `src/domain/economy`: pure `PriceSet` lookup helpers and structured missing-price/missing-alch warnings. It does not read browser state or mutate price data.
- `src/domain/planner`: pure training-plan search for the rewrite. It consumes `simulateCombat`, combat XP breakdowns, trip/loot/supply results, `GameDataSnapshot` and `PriceSet`; it does not own combat math or equipment bonus truth.
- `src/data`: Zod schemas for `GameDataSnapshot`, items, monsters, drops, equipment, `PriceSet`, price history and live integration API contracts, plus a legacy runtime adapter that validates the current bundled data shape.
- `src/data/market-source-mapping.ts`: legacy-derived, non-canonical market item allowlist and item-id-to-source-slug mapping for future live market sync validation.
- `src/adapters/browser`: browser-only bootstrap and file export helpers. It builds the current `GameDataSnapshot` by executing bundled legacy data sources inside an adapter-owned sandbox.
- `src/adapters/storage`: versioned `PersistedEnvelope<T>` helpers for new rewrite-local state plus known legacy-key detection, safe setup/hiscores/price compatibility reports and explicit legacy-key clearing helpers.
- `src/adapters/market`: validated `PriceSet` file import, same-origin market status/sync adapter and explicit `PriceSet` response validation.
- `src/adapters/hiscores`: same-origin browser adapter for hiscores status and lookup responses, plus versioned storage for the last searched player.
- `src/data/market-sync-items.ts`: market sync item expansion for current-monster, all-supported and explicit item scopes. It expands nested loot rows, tagged drop dependencies and support items through the legacy-derived allowlist instead of UI special cases.
- `src/server/hiscores-core.ts`: framework-neutral hiscores status/lookup handler with request validation, timeout/rate-limit guard and sanitized errors. The default provider is disabled until an authoritative upstream is accepted.
- `src/server/vite-hiscores-middleware.ts`: Vite dev/preview middleware that exposes the hiscores API boundary for local same-origin runs without choosing a production backend framework.
- `src/server/market-core.ts`: framework-neutral market status/sync handler with request validation, item allowlist expansion, timeout/rate-limit guard, partial failure reporting and sanitized errors. The default provider is disabled until an authoritative upstream is accepted.
- `src/server/vite-market-middleware.ts`: Vite dev/preview middleware that exposes the market API boundary for local same-origin runs without choosing a production backend framework.
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
- Results should carry structured warnings/provenance so the UI can show lightweight uncertainty markers near affected numbers.

## Current rewrite extraction status

- Implemented: typed contracts, equipment bonus summing and combat core through base DPS and special-attack DPS.
- Implemented: pure trip/loot/supply domain for stackability, default loot actions, alch handling, incoming damage, food/potion/prayer/recoil/cannon inventory, banking efficiency, cannon occupancy/overlay and supply cost calculations.
- Implemented: pure planner domain for gear eligibility, training stance selection, domain-backed candidate scoring, phase grouping and deterministic golden plan summaries.
- Implemented: React/Vite rewrite UI using view models for combat setup, result summary, special attack controls/metrics, loot/economy, trip, per-monster cannon settings, monster compare and planner in a selected parity slice.
- Implemented: browser adapters for sandboxed legacy data bootstrap, versioned rewrite setup persistence, setup export/import, legacy storage detection with safe `sim_input_v3` setup, `sim_hiscore_player` last-player and compatible legacy price/alch import reports, user-facing import/keep/clear UX, validated price-set import and browser-local accepted-price history persistence.
- Implemented: root production entrypoint uses the Vite rewrite; legacy CDN/Babel HTML is archived at `legacy/index.html`.
- Implemented: rewrite setup import validates the full persisted envelope version before applying imported state.
- Implemented: validated data/economy contracts for `GameDataSnapshot`, item definitions, monster/drop data, equipment data, `PriceSet`, imported price JSON and committed price history.
- Implemented: shared live integration contracts, Zod validation, mocked fixture basis, a legacy-derived market source allowlist, the hiscores same-origin status/lookup boundary and the market same-origin status/sync boundary. Hiscores and market providers are disabled by default until authoritative upstreams are accepted; this does not choose production hosting, add scheduled jobs, databases, server-managed shared price history or live upstream tests.
- Implemented: legacy runtime adapter that turns current `gamedata.js`, `engine.js` and `equipment.js` objects into a validated snapshot without reading browser globals inside the adapter.
- Covered by tests: formulas, stance fallback, two-handed shield exclusion, thrown ammo handling, golden parity for ported combat fields across the 18 `SimEngine.simulate()` fixtures, trip/loot/supply parity across all 18 fixtures including cannon occupancy and cannonball supply, planner unit tests plus 3 golden plan fixtures, UI view-model tests, versioned persistence tests, legacy migration/reset tests, Playwright smoke tests, schema validation for the legacy snapshot and committed price files, malformed imported price rejection, missing-price warnings, mocked live integration contract validation, mocked hiscores API/adapter/UI apply behavior and mocked market API/adapter/UI sync behavior.
- Not ported yet: final legacy-style cannon tab/workbench placement, full legacy UI parity, authoritative hiscores upstream provider, authoritative market upstream provider, legacy planner/custom setup/loot prefs/compare/cannon/hidden tiers and full price-history migration, and authoritative generated data workflow.
- The validated legacy snapshot is still an adapter over the current runtime files, not an authoritative generated data workflow.
- Target generated data source is LostCityRS/Content Revision 274 in staged v1 scope, but the generator/update workflow is not implemented yet.
- Target market price source is `markets.lostcity.rs`; retained 12-hour price history snapshots are accepted as a target but the refresh implementation is not present.
- Runtime Babel, CDN React and real `window.*` script-order loading are no longer required for the root production app path.
- Raw legacy source execution still exists inside an adapter-owned sandbox to build the current validated data snapshot. This is trusted bundled code, not user input.

## Open questions

- Which package manager should the rewrite use?
- Which backend/runtime should host the accepted market/hiscores integration boundary if direct browser APIs are not viable?
- What is the authoritative hiscores API/source? A visible HTML endpoint exists, but the final API answer is pending.
- Where should the LostCityRS/Content Revision 274 source live locally, and what generator command produces `GameDataSnapshot`?
- What is the manual or automated review process for updating generated game data?
- What exact workflow writes latest and historical `markets.lostcity.rs` price snapshots?
- What is the deployment target? The architecture is static-first and provider-agnostic until live integration constraints are known.
- Should the visible legacy import/keep/clear workflow grow beyond compatible `sim_input_v3` setup fields, hiscores last-player and current price/alch maps into planner, custom setup, loot prefs, compare state, cannon maps, hidden tiers or full price-history data?
- What should be the final public API shape of the full UI-facing `SimulationResult` after combat, trip, loot, supply and economy slices are composed?
- Should old keys such as `sim_planner_v1`, planner/custom setup state and full legacy price history be migrated into the rewrite UI, or intentionally left/reset? The current clear action can remove known legacy keys only after explicit user confirmation.
- Where should authoritative item requirement data come from, replacing the planner's manual requirement policy?
- Should future/hypothetical weapons be exposed in the rewrite planner, and how should that be surfaced to users?
- When is the rewrite accepted as a full replacement for every legacy workflow, allowing the archived legacy files to be deleted instead of retained for parity?

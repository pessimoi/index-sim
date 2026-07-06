# Decisions

Use this log for choices that future agents must not re-litigate accidentally.

## Accepted

| ID    | Date       | Decision                                                                                        | Reason                                                                                                                                                               |
| ----- | ---------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 | 2026-07-05 | Use `AGENTS.md` plus `docs/` as the AI-agent memory layer.                                      | The repo needed a stable map for future bounded work and rewrite planning.                                                                                           |
| D-002 | 2026-07-05 | This documentation pass does not rewrite application code.                                      | The requested deliverable is documentation that enables a safer rewrite.                                                                                             |
| D-003 | 2026-07-05 | `docs/technical/rewrite-spec.md` owns the implementation-grade rewrite specification.           | Future rewrite work needs one target contract instead of scattered recommendations.                                                                                  |
| D-004 | 2026-07-05 | Use npm for the initial rewrite scaffold.                                                       | The rewrite spec allowed npm as the lowest-assumption default when no human package-manager preference was given.                                                    |
| D-005 | 2026-07-05 | Golden fixtures preserve current `SimEngine.simulate()` behavior without pre-fixing known bugs. | The rewrite needs a reproducible current baseline before intentional deltas are accepted.                                                                            |
| D-006 | 2026-07-05 | Node-based npm tool scripts call npm's `$NODE` explicitly.                                      | The local PATH can expose an older parent `node` binary before NVM, while Vite 7 and ESLint 10 require a newer Node runtime.                                         |
| D-007 | 2026-07-05 | The first domain extraction slice covers combat/equipment only.                                 | Keeping trip, loot, economy, planner and persistence out of this slice keeps parity testable and avoids hidden behavior rewrites.                                    |
| D-008 | 2026-07-05 | The first data/economy slice validates legacy data and prices without adding live sync.         | Static-first `PriceSet` and snapshot validation remove global mutation risk while keeping backend and refresh workflow decisions open.                               |
| D-009 | 2026-07-05 | Trip, loot and supply rewrite rules are owned by pure `src/domain/trip`.                        | This unifies previous `trip.js`, `engine.js` and `gamedata.js` rule paths behind explicit `GameDataSnapshot` and `PriceSet` inputs.                                  |
| D-010 | 2026-07-05 | Planner rewrite search is owned by pure `src/domain/planner` and consumes domain APIs.          | The planner must not duplicate hit chance, max hit, equipment bonus or stance truth; future gear remains outside canonical data.                                     |
| D-011 | 2026-07-05 | The first rewrite UI stores only `index-sim:rewrite-setup` version 1 state.                     | No human decision exists to migrate or reset legacy `sim_input_v3`, `sim_planner_v1` or legacy price keys, so this slice leaves them untouched.                      |
| D-012 | 2026-07-05 | Root `index.html` is the Vite rewrite entrypoint; legacy CDN/Babel HTML is archived.            | This removes CDN React, runtime Babel and real script-order `window.*` loading from the production app path while preserving legacy parity evidence.                 |
| D-013 | 2026-07-05 | CSP and static security headers are documented as deploy requirements, not hard-coded yet.      | No deploy target exists, and dev-time Vite/Playwright flows should not be constrained by an untested host-specific CSP.                                              |
| D-014 | 2026-07-05 | The next UI parity target is the legacy-style dense combat spreadsheet view.                    | Existing users need the compact all-monster table workflow before the rewrite can replace the legacy UI ergonomically.                                               |
| D-015 | 2026-07-05 | Hiscores lookup and live market sync are product features with a repo-owned integration spec.   | The original app exposed these workflows, and the accepted direction is to implement them properly instead of keeping them static-only, local-only or removing them. |
| D-016 | 2026-07-06 | Rewrite setup version 2 stores per-monster cannon settings and does not implicitly migrate v1.  | Cannon settings add a new persisted rewrite-owned state branch; silent migration is avoided until a broader setup migration/reset policy is accepted.                |
| D-017 | 2026-07-06 | Treat the rewrite as a new implementation that preserves end-user workflows, not legacy internals. | The current product is not production-bound, and old architecture or logic should not be kept when better LostCityRS-backed behavior is available.                   |
| D-018 | 2026-07-06 | Use LostCityRS/Content Revision 274 as the primary game-content source when it can be verified. | The rewrite needs a stronger content source than the legacy bundled data, while still allowing documented gaps when the upstream repo is incomplete.                 |
| D-019 | 2026-07-06 | Generate a validated `GameDataSnapshot` as the app-owned content contract.                     | Domain modules need one explicit, typed snapshot instead of reading content directly from legacy globals or raw upstream files.                                      |
| D-020 | 2026-07-06 | Keep the target architecture static-first without locking the hosting provider yet.            | GitHub Pages, Netlify or another static-capable host should remain possible until hiscores API/hosting constraints are known.                                        |
| D-021 | 2026-07-06 | Use `markets.lostcity.rs` as the target market price source and keep 12-hour price history snapshots. | The accepted price direction is small enough for retained history, but the exact automation and deploy workflow remain separate implementation details.              |
| D-022 | 2026-07-06 | Hiscores is a v1 product requirement, but the authoritative API and hosting model remain open. | The visible hiscores HTML endpoint exists, but a possible API answer is pending and the final direct-fetch vs proxy decision should not be guessed.                  |
| D-023 | 2026-07-06 | Build the v1 `GameDataSnapshot` in staged scope: required calculation data first, extensible format. | This keeps the rewrite moving without forcing every LostCityRS content area into the first data-generation pass.                                                     |
| D-024 | 2026-07-06 | Surface uncertain, missing or approximated values as lightweight UI info/warning markers.      | Users should see calculation confidence without the normal UI becoming dominated by warning copy.                                                                    |
| D-025 | 2026-07-06 | V1 replacement scope is combat, result summary, monster compare, loot/economy, trip and planner. | These are the current end-user workflows the rewrite must preserve before it can replace the existing app.                                                           |
| D-026 | 2026-07-06 | Start with main-thread calculation plus memoization/debounce behind a worker-compatible runner. | This is simpler for v1 while preserving a clean upgrade path to Web Workers for compare/planner workloads.                                                          |
| D-027 | 2026-07-06 | Use a measurable v1 performance budget: normal input updates around 100 ms and no long UI blocks over about 200 ms. | The rewrite must catch the level-input jank already observed in the new UI path.                                                                                     |
| D-028 | 2026-07-06 | Use legacy golden parity as regression evidence, but allow documented LostCityRS-backed intentional deltas. | The old app can help find accidental changes, but it is not the final truth source for a full rewrite.                                                               |
| D-029 | 2026-07-06 | The rewrite can replace the current app only after v1 features, parity/golden tests, performance budget and security checks pass. | Replacement needs a balanced acceptance gate without turning the rewrite into an endless full-edge-case proof project.                                               |
| D-030 | 2026-07-06 | Legacy storage migration starts as non-writing detection plus a safe setup report, not silent auto-migration. | The rewrite can explain old local state later without deleting legacy keys or importing unvalidated planner, price, custom setup, compare, cannon or hidden-tier data. |
| D-031 | 2026-07-06 | Ring-of-recoil XP attribution is an accepted rewrite intentional delta from legacy. | Legacy remains useful as a comparison value, but the rewrite may calculate this path anew: recoil is modeled in the trip layer for kill speed, capacity and supply cost, while combat XP stays attributed to direct player combat damage instead of being reduced by trip-layer recoil damage. |

## Recommended, not final implementation decisions

| ID    | Recommendation                                                                                                                  | Status                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| R-001 | Use TypeScript strict mode, React, Vite, Vitest, Playwright and Zod for the rewrite.                                            | Recommended until a human confirms or changes the target stack. |
| R-002 | Keep simulation/domain work static-first and avoid choosing Next.js/FastAPI before live integration runtime/hosting is decided. | Recommended.                                                    |
| R-003 | Make domain modules free of React, DOM, `window`, `fetch` and `localStorage`.                                                   | Recommended architectural boundary.                             |

## Open decision boundaries

- Package manager: npm is used for the initial scaffold; changing package manager remains a future explicit decision.
- Backend/runtime: hiscores and live market sync are accepted product features, but the concrete backend framework, runtime, hosting model and cache/database policy remain undecided.
- Database: no decision to add one.
- Deployment: the target architecture is static-first and provider-agnostic for now; no final release or hosting path is accepted.
- Static-host security headers are recommended in operations docs, but no deploy target has accepted them yet.
- Source data workflow: LostCityRS/Content Revision 274 is the primary target source, but source access, generator implementation and update procedure are not present in this repo.
- Game data refresh workflow: manual, scheduled or manually-triggered diff/test update process is intentionally deferred.
- Price update workflow: `markets.lostcity.rs`, 12-hour snapshots and retained history are accepted targets, but the authoritative refresh implementation is not present.
- Live integrations: [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md) owns the target contract for hiscores and market sync; exact upstream sources remain open questions.
- Hiscores upstream: the visible `https://2004.lostcity.rs/hiscores/player/index` HTML page is candidate evidence, but a possible API answer is pending and final direct-fetch/proxy hosting remains open.
- UI language policy: existing UI strings are English; documentation is now mostly Finnish.
- Rewrite setup persistence is versioned; a focused `sim_input_v3` setup-migration foundation is captured, while legacy planner UI state, market sync and full legacy `localStorage` migration fixtures remain open.
- Cannon occupancy/overlay, cannonball cost and cannon ranged XP are ported into pure `src/domain/trip`; the dense rewrite dashboard exposes per-monster cannon controls, while final full-workbench placement remains open.
- Legacy source files are retained for fixtures/data bootstrap; deleting them requires a separate full-replacement decision.
- Final full-domain `SimulationResult` shape remains open until combat/equipment, trip/loot/supply and economy slices are composed for the UI.
- Dense spreadsheet can become the default root view during parity work; its final coexistence with the full tabbed workbench remains open.
- Planner item requirements are still a manual policy copied from the existing planner notes; authoritative generated requirements are not present.
- Future weapons are not added to canonical planner pools until a human accepts a product/data provenance decision.

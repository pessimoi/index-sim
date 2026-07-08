# Backlog

Bounded work that can be picked up without inventing a new architecture.

Status date: 2026-07-08.

## Status meanings

- `Done`: implemented and evidenced in the current root Vite rewrite or current docs.
- `Partial`: a useful slice is implemented, but the card still has an explicit remaining gap.
- `Open`: not implemented or not decided yet.
- `Blocked`: waiting for an accepted decision, upstream answer, hosting choice or generator/writer foundation.
- `Conditional`: no active work unless a later release or human decision explicitly requires it.
- `Ongoing`: recurring maintenance; never permanently complete.

## Current-app stabilization

- `Blocked` - Choose production runtime, hosting and authoritative upstream for hiscores after the pending hiscores API answer is known. Market price refresh now has an accepted GitHub Actions scheduled static JSON model and a local writer/fixture-contract foundation, but the workflow wiring and exact raw upstream adapter remain missing.
- `Open` - Decide whether archived legacy `run_sim.py`, `/api/prices`, `/api/scrape` and `/api/hiscores` copy needs compatibility shims or can stay archive-only until legacy deletion.
- `Done` - Add a small static-run section to operations once the preferred local run command is confirmed. [../operations/README.md](../operations/README.md) now documents `npm run dev`, `npm run build`, `npm run preview` and the archived legacy reference path.
- `Done` - Fix the legacy browser planner `accByType`/stance issues described in `PROJECT_REVIEW_NOTES.md`, or replace the UI path with `src/domain/planner`. The root Planner path now uses `src/domain/planner`; the old planner remains archived reference only.
- `Partial` - Fix legacy current-monster price sync for nested loot entries, or retire that archived path after rewrite parity is accepted. The rewrite market sync path expands nested/tagged items through `src/data/market-sync-items.ts`, but the archived legacy path has not been retired yet.
- `Blocked` - Extend the data reliability gate after a canonical data decision. Raw JSON duplicate keys, duplicate legacy monster ids and malformed loot entries are tested, but archived `gamedata.js` duplicate object keys still need a canonical value decision before that file can be hard-gated.
- `Blocked` - Finish canonical gem/item price alias normalization after the data-source workflow is accepted. Known gem/item alias and fallback price paths surface structured warnings near Result, Loot and Economy money values, but canonical key normalization remains open.
- `Open` - Decide whether ranged/magic/halberd auto-safespot remains default UX.
- `Partial` - Add NPC size data or document an intentional dragon-halberd special delta. The rewrite surfaces a dragon halberd NPC-size fallback info warning, but final NPC-size data/formula behavior is still undecided.

## Rewrite preparation

- `Partial` - Implement the accepted v1 replacement scope: combat, result summary, monster compare, loot/economy, trip and planner. Result summary and Planner are marked `Valmis` in [../product/feature-inventory.md](../product/feature-inventory.md), while compare, loot/economy and trip still carry scoped parity gaps.
- `Ongoing` - Keep V1 release evidence current after each release-impacting change. The 2026-07-06 consolidated pass records core typecheck/unit/golden/build evidence, Playwright smoke evidence, dependency audit, static security searches and release-copy classification for the current rewrite path. Planner V1 acceptance has rewrite-domain golden evidence for melee unlock, ranged unlock, magic spell unlock and boosted sustained training; legacy planner numeric parity remains a separate decision if a legacy-clone line is requested.
- `Partial` - Prioritize the missing legacy UI workflows listed in [../product/feature-inventory.md](../product/feature-inventory.md) into parity-required, later enhancement or legacy-only buckets. Dense/Compare has an explicit D-032 classification, but not every partial feature has the same bucketed closure.
- `Done` - Ring-of-recoil XP attribution decision is closed by D-031: legacy remains comparison evidence, while rewrite combat XP is not reduced by trip-layer recoil damage. The accepted delta is explicit in XP tests and release evidence.
- `Partial` - Finish remaining Loot/economy parity after the current-monster action workflow, per-monster loot settings, browser-local Economy tab, Loot value composition, full nested drop detail, readable action-impact detail and browser-local Economy-history context in Loot rows. Accepted legacy/full-history migration and live/shared history remain open; browser-local price history summary, movers analysis, Snapshot now and confirmed Clear history exist for accepted imported/synced/manual active price sets.
- `Conditional` - Resolve only explicitly accepted exact-legacy Trip parity questions after the food/banking, scarce/AFK target/respawn, reserve summary, prayer restore capacity, general potion carry controls, domain-owned potion recommendation/apply flow, grouped Trip summary and Cannon sparse-linking paths. Prayer potion modeling, live data, canonical data, provider decisions and exact archived legacy `potRec` numerical parity remain outside this backlog item unless separately accepted.
- `Conditional` - Resolve only explicitly accepted remaining Special attacks parity questions after the supported melee/ranged DPS-special UI, ranged spec-arrow selection, DBA boost/Trip restore path, magic unsupported state, safe request mapping, persisted-state cleanup and dragon halberd NPC-size fallback warning. New special formulas, magic DPS specials and final dragon-halberd/NPC-size behavior remain outside this backlog item unless separately accepted with source data.
- `Done` - Cannon final workbench placement is implemented. Further Cannon browser-rendered numeric parity is only conditional on a later release requiring all-fixture browser-display coverage beyond the current Dagannoth dense row, root metric strip and expanded Cannon output snapshots.
- `Done` - Dense/Compare release classification is documented in D-032 and the current release-path browser numeric coverage is accepted for the current release slice. Broader dense compare parity is conditional on a future full browser-display parity or full visual regression requirement.
- `Conditional` - Add legacy planner UI-state fixtures only if legacy planner numeric parity or legacy planner state migration is explicitly accepted.
- `Ongoing` - Extend mocked live integration fixtures as upstream contracts become authoritative. Initial hiscores and market sync mocked coverage exists for schema/API/adapter/UI paths, but live upstream contracts are not final.
- `Open` - Decide whether review-only legacy live-integration `localStorage` areas should get deeper migration, especially full price history. Compatible hiscores last-player and current price/alch import are covered by the legacy import flow; legacy scrape-key metadata is classified as intentional reset on confirmed clear.
- `Blocked` - Replace the legacy runtime snapshot adapter with a staged authoritative normalized current `GameDataSnapshot` from the current accepted LostCityRS/Content revision once the `npm run data:generate` workflow is implemented.
- `Partial` - Implement the accepted game revision bump workflow: `npm run data:generate` now has a repository-local source/output-path validation foundation, fixture coverage for the gitignored `.sources/lostcity-content/` source path, a repo-local generated-output hygiene assertion and first committed schema-valid `src/data/generated/source-pin.json`, `src/data/generated/game-data.json` and `docs/project/revision-impact/current.md` foundation outputs. Still open: authoritative parser, branch/PR revision bump process, simulator-consumed normalized domain data extraction from accepted upstream files, generated snapshot diff review, validation, merge-blocking hybrid representative suite, informational all-monster scan with fixed baseline/threshold policy and explicit accepted calculation deltas.
- `Partial` - Implement the accepted GitHub Actions scheduled `markets.lostcity.rs` price writer: the repo now has `npm run prices:write-scheduled`, normalized upstream fixture tests, deterministic output generation, 12-hour shared history bucket retention and no-op write behavior. Still open: GitHub Actions cron at 00:15 and 12:15 UTC, same-repo commit wiring with `GITHUB_TOKEN`, and the exact raw live upstream response adapter.
- `Blocked` - Replace the browser raw-legacy-data bootstrap with a generated static snapshot to reduce Vite bundle size.
- `Partial` - Fold combat/equipment, trip/loot/supply and economy slices into the final UI-facing `SimulationResult` contract. The current view model composes these slices for the UI, but the final public/full-domain `SimulationResult` shape remains open.
- `Open` - Extend the rewrite UI to full legacy parity after the selected parity slice is accepted.
- `Partial` - Extend legacy migration beyond the current visible import/keep/clear UX if accepted. The rewrite detects and classifies every known legacy key in the review UI, imports compatible `sim_input_v3` setup fields, compatible `sim_hiscore_player` last-player state, compatible legacy price/alch maps as an explicit `PriceSet`, compatible `sim_hidden_tiers_v1` flags, compatible `sim_compare_sort_v1`/`sim_irrelevant_v1` dense compare state and compatible `sim_loot_prefs_v1` drop-name preferences that resolve to unambiguous current monster row ids. Import keeps legacy data, records dismissed state and clears only known legacy keys after confirmation with the exact clear list shown. `sim_planner_v1` is hardened as detect/review-only: it is reported, not parsed or imported into `index-sim:planner-ui`, kept on Import/Keep and removed only by confirmed Clear. Legacy custom setup snapshots (`monsterSetups`) and cannon maps (`cannonByMonster`) are detected as nested `sim_input_v3` review-only areas with bounded metadata and visible review-plan copy, but they are not parsed into rewrite-owned custom setup/cannon state; confirmed Clear removes them only when `sim_input_v3` is in the known-key clear list. Full planner/custom setup/cannon import and full legacy price-history migration remain review-only/open.
- `Blocked` - Replace manual planner item requirements with generated requirement data once the source workflow is accepted.
- `Open` - Decide whether future/hypothetical planner gear belongs in the product, and if so model it with explicit provenance.
- `Blocked` - Finish market price product acceptance after the raw `markets.lostcity.rs` response adapter and GitHub Actions scheduled workflow are implemented. The rewrite has a disabled-provider same-origin API, validated adapter, scheduled-only UI path, browser-local accepted-price history, read-only scheduled static snapshot loader and local scheduled writer with fixture validation, but production must not enable user-triggered upstream refresh and the cron/commit path is still missing.
- `Open` - Decide planner `localStorage` migration scope and whether old planner state should be imported, reset or intentionally left behind. Until that decision exists, `sim_planner_v1` stays detect/review-only and is not imported into rewrite Planner state.
- `Blocked` - Add deploy-target-specific CSP/security headers once hosting is chosen.
- `Blocked` - Delete archived legacy runtime files only after full parity, data-generation and replacement decisions are accepted.

## Documentation maintenance

- `Ongoing` - Update this backlog when an item moves into active work or becomes obsolete.
- `Ongoing` - Move larger speculative ideas to [idea-inbox.md](idea-inbox.md).

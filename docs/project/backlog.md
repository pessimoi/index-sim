# Backlog

Bounded work that can be picked up without inventing a new architecture.

## Current-app stabilization

- Choose production runtime, hosting and authoritative upstream for hiscores after the pending hiscores API answer is known. Market price refresh now has an accepted GitHub Actions scheduled static JSON model; its writer implementation remains open.
- Decide whether archived legacy `run_sim.py`, `/api/prices`, `/api/scrape` and `/api/hiscores` copy needs compatibility shims or can stay archive-only until legacy deletion.
- Add a small static-run section to operations once the preferred local run command is confirmed.
- Fix the legacy browser planner `accByType`/stance issues described in `PROJECT_REVIEW_NOTES.md`, or replace the UI path with `src/domain/planner`.
- Fix legacy current-monster price sync for nested loot entries, or retire that archived path after rewrite parity is accepted. The rewrite market sync path now expands nested/tagged items through `src/data/market-sync-items.ts`.
- Extend the data reliability gate after a canonical data decision: raw JSON duplicate keys, duplicate legacy monster ids and malformed loot entries are now tested, but the archived `gamedata.js` source still contains duplicate object keys that require a canonical value decision before hard-gating that file.
- Finish canonical gem/item price alias normalization after the data-source workflow is accepted. Known gem/item alias and fallback price paths now surface structured warnings near Result, Loot and Economy money values, but canonical key normalization remains open.
- Decide whether ranged/magic/halberd auto-safespot remains default UX.
- Add NPC size data or document an intentional dragon-halberd special delta. The current rewrite already surfaces a dragon halberd NPC-size fallback info warning; final data/formula behavior remains undecided.

## Rewrite preparation

- Implement the accepted v1 replacement scope: combat, result summary, monster compare, loot/economy, trip and planner.
- Keep V1 release evidence current after each release-impacting change. The 2026-07-06 consolidated pass now records core typecheck/unit/golden/build evidence, Playwright smoke evidence, dependency audit, static security searches and release-copy classification for the current rewrite path. Planner V1 acceptance has rewrite-domain golden evidence for melee unlock, ranged unlock, magic spell unlock and boosted sustained training; legacy planner numeric parity remains a separate decision if a legacy-clone line is requested.
- Prioritize the missing legacy UI workflows listed in [../product/feature-inventory.md](../product/feature-inventory.md) into parity-required, later enhancement or legacy-only buckets.
- Ring-of-recoil XP attribution decision is closed by D-031: legacy remains comparison evidence, while rewrite combat XP is not reduced by trip-layer recoil damage; keep the accepted delta explicit in XP tests and release evidence.
- Finish remaining Loot/economy parity after the current-monster action workflow, per-monster loot settings, browser-local Economy tab, Loot value composition, full nested drop detail, readable action-impact detail and browser-local Economy-history context in Loot rows: accepted legacy/full-history migration and live/shared history remain open. Browser-local price history summary, movers analysis, Snapshot now and confirmed Clear history now exist for accepted imported/synced/manual active price sets.
- Resolve only explicitly accepted exact-legacy Trip parity questions after the food/banking, scarce/AFK target/respawn, reserve summary, prayer restore capacity, general potion carry controls, domain-owned potion recommendation/apply flow, grouped Trip summary and Cannon sparse-linking paths. The general potion recommendation/apply rewrite behavior now covers inactive, no-boost, manual-carry, below, above and matched states, Apply is limited to general potion carry fields, and the grouped Trip summary uses release-ready Auto/Manual labels for bank time, food count, prayer restore, protection prayer, potion carry/slots, loot capacity and Effective K/hr. Prayer potion modeling, live data, canonical data, provider decisions and exact archived legacy `potRec` numerical parity remain outside this backlog item unless separately accepted.
- Resolve only explicitly accepted remaining Special attacks parity questions after the supported melee/ranged DPS-special UI, ranged spec-arrow selection, DBA boost/Trip restore path, magic unsupported state, safe request mapping, persisted-state cleanup and dragon halberd NPC-size fallback warning. New special formulas, magic DPS specials and final dragon-halberd/NPC-size behavior remain outside this backlog item unless separately accepted with source data.
- Cannon final workbench placement is implemented. Extend Cannon browser-rendered numeric parity only if release later requires all-fixture browser-display coverage beyond the current Dagannoth dense row, root metric strip and expanded Cannon output snapshots.
- Dense/Compare release classification is documented in D-032 and the current release-path browser numeric coverage is accepted for the current release slice. Extend dense compare parity beyond the current monster/drop filters, irrelevant state, per-monster alch/overhead markers, visible-row XP/net-GP scale indicators and browser-rendered release-path numeric snapshots only if broader full browser-display parity or full visual regression is later required.
- Add legacy planner UI-state fixtures only if legacy planner numeric parity or legacy planner state migration is explicitly accepted.
- Extend mocked live integration fixtures as upstream contracts become authoritative. Initial hiscores and market sync mocked coverage exists for schema/API/adapter/UI paths.
- Decide whether review-only legacy live-integration `localStorage` areas should get deeper migration, especially full price history. Compatible hiscores last-player and current price/alch import are already covered by the legacy import flow; legacy scrape-key metadata is classified as intentional reset on confirmed clear.
- Replace the legacy runtime snapshot adapter with a staged authoritative normalized current `GameDataSnapshot` from the current accepted LostCityRS/Content revision once the `npm run data:generate` workflow is implemented.
- Implement the accepted game revision bump workflow: manual `npm run data:generate`, gitignored `.sources/lostcity-content/` checkout, branch/PR only, overwrite current source pin/snapshot/impact report, generate only simulator-consumed normalized domain data, generated snapshot diff, validation, merge-blocking hybrid representative suite, informational all-monster scan with fixed baseline/threshold policy and explicit accepted calculation deltas.
- Implement the accepted GitHub Actions scheduled `markets.lostcity.rs` price writer: run at 00:15 and 12:15 UTC, generate `prices.json`, `alch.json` and retained 12-hour `price-history.json`, validate them and commit only real diffs with `GITHUB_TOKEN`.
- Replace the browser raw-legacy-data bootstrap with a generated static snapshot to reduce Vite bundle size.
- Fold combat/equipment, trip/loot/supply and economy slices into the final UI-facing `SimulationResult` contract.
- Extend the rewrite UI to full legacy parity after the selected parity slice is accepted.
- Extend legacy migration beyond the current visible import/keep/clear UX if accepted. The rewrite now detects and classifies every known legacy key in the review UI, imports compatible `sim_input_v3` setup fields, compatible `sim_hiscore_player` last-player state, compatible legacy price/alch maps as an explicit `PriceSet`, compatible `sim_hidden_tiers_v1` flags, compatible `sim_compare_sort_v1`/`sim_irrelevant_v1` dense compare state and compatible `sim_loot_prefs_v1` drop-name preferences that resolve to unambiguous current monster row ids. Import keeps legacy data, records dismissed state and clears only known legacy keys after confirmation with the exact clear list shown. `sim_planner_v1` is hardened as detect/review-only: it is reported, not parsed or imported into `index-sim:planner-ui`, kept on Import/Keep and removed only by confirmed Clear. Full planner/custom setup/cannon and full legacy price-history migration remain review-only/open.
- Replace manual planner item requirements with generated requirement data once the source workflow is accepted.
- Decide whether future/hypothetical planner gear belongs in the product, and if so model it with explicit provenance.
- Finish market price product acceptance after the authoritative `markets.lostcity.rs` response contract and GitHub Actions scheduled writer are implemented. The rewrite now has a disabled-provider same-origin API, validated adapter, current-monster/all-supported UI flow and browser-local accepted-price history, but production must not enable user-triggered upstream refresh.
- Decide planner `localStorage` migration scope and whether old planner state should be imported, reset or intentionally left behind. Until that decision exists, `sim_planner_v1` stays detect/review-only and is not imported into rewrite Planner state.
- Add deploy-target-specific CSP/security headers once hosting is chosen.
- Delete archived legacy runtime files only after full parity, data-generation and replacement decisions are accepted.

## Documentation maintenance

- Update this backlog when an item moves into active work or becomes obsolete.
- Move larger speculative ideas to [idea-inbox.md](idea-inbox.md).

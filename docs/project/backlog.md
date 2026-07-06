# Backlog

Bounded work that can be picked up without inventing a new architecture.

## Current-app stabilization

- Choose production runtime, hosting and authoritative upstreams for the same-origin hiscores/live market integrations after the pending hiscores API answer is known. The rewrite contracts, disabled provider boundary, adapters and UI states exist; live providers remain open.
- Decide whether archived legacy `run_sim.py`, `/api/prices`, `/api/scrape` and `/api/hiscores` copy needs compatibility shims or can stay archive-only until legacy deletion.
- Add a small static-run section to operations once the preferred local run command is confirmed.
- Fix the legacy browser planner `accByType`/stance issues described in `PROJECT_REVIEW_NOTES.md`, or replace the UI path with `src/domain/planner`.
- Fix legacy current-monster price sync for nested loot entries, or retire that archived path after rewrite parity is accepted. The rewrite market sync path now expands nested/tagged items through `src/data/market-sync-items.ts`.
- Add data validation for duplicate item keys and malformed loot entries.
- Normalize gem/item price aliases before moving economy logic into the rewrite.
- Decide whether ranged/magic/halberd auto-safespot remains default UX.
- Add NPC size data or document an intentional dragon-halberd special delta.

## Rewrite preparation

- Implement the accepted v1 replacement scope: combat, result summary, monster compare, loot/economy, trip and planner.
- Add acceptance evidence for v1 replacement: golden/parity pass, documented intentional deltas, performance-budget pass and security checks.
- Prioritize the missing legacy UI workflows listed in [../product/feature-inventory.md](../product/feature-inventory.md) into parity-required, later enhancement or legacy-only buckets.
- Decide ring-of-recoil XP attribution: either preserve legacy behavior by letting XP calculation account for trip-layer recoil non-XP damage, or document an accepted intentional delta and keep the fixture excluded.
- Finish remaining Loot/economy parity after the current-monster action workflow: full economy tab, per-monster overhead/high-alch placement, talisman spot controls and fuller nested-table workflows remain open. Browser-local price history summary now exists for accepted imported/synced price sets.
- Finish remaining Trip parity: scarce/AFK controls, cannon-at-spot sparse-mode placement, inventory reserve details and broader potion recommendation controls remain open.
- Decide final Cannon-tab/workbench placement and browser-rendered numeric parity for cannon; the dense rewrite dashboard now exposes per-monster cannon settings and metrics on top of fixture-parity domain logic.
- Extend UI-level numeric snapshot checks beyond the default melee and ranged safespot view-model summaries if full browser-display parity is required.
- Model full `totalXpPerHour` parity for prayer and alch XP rows once those row owners are explicit.
- Add legacy planner UI-state fixtures if that behavior needs parity.
- Extend mocked live integration fixtures as upstream contracts become authoritative. Initial hiscores and market sync mocked coverage exists for schema/API/adapter/UI paths.
- Decide migration or intentional reset for remaining legacy live-integration `localStorage` keys, especially full price history and unsupported price metadata keys. Compatible hiscores last-player and current price/alch import are already covered by the legacy import flow.
- Replace the legacy runtime snapshot adapter with a staged authoritative generated `GameDataSnapshot` from LostCityRS/Content Revision 274 once the source workflow is accepted.
- Design the deferred GameDataSnapshot update workflow: manual, scheduled or manually triggered diff/test process.
- Implement the accepted `markets.lostcity.rs` latest price set plus retained 12-hour history snapshot workflow once the refresh writer is designed.
- Replace the browser raw-legacy-data bootstrap with a generated static snapshot to reduce Vite bundle size.
- Fold combat/equipment, trip/loot/supply and economy slices into the final UI-facing `SimulationResult` contract.
- Extend the rewrite UI to full legacy parity after the selected parity slice is accepted.
- Extend legacy migration beyond the current visible import/keep/clear UX if accepted. The rewrite now detects known legacy keys, imports compatible `sim_input_v3` setup fields, compatible `sim_hiscore_player` last-player state and compatible legacy price/alch maps as an explicit `PriceSet`, keeps legacy data on import, records dismissed state and clears only known legacy keys after confirmation. Planner/custom setup/loot prefs/compare/cannon/hidden tiers and full legacy price-history migration remain open.
- Replace manual planner item requirements with generated requirement data once the source workflow is accepted.
- Decide whether future/hypothetical planner gear belongs in the product, and if so model it with explicit provenance.
- Finish market sync product acceptance after authoritative upstream and production runtime decisions. The rewrite now has a disabled-provider same-origin API, validated adapter, current-monster/all-supported UI flow and browser-local accepted-price history.
- Decide planner `localStorage` migration scope and whether old planner state should be imported, reset or intentionally left behind.
- Add deploy-target-specific CSP/security headers once hosting is chosen.
- Delete archived legacy runtime files only after full parity, data-generation and replacement decisions are accepted.

## Documentation maintenance

- Update this backlog when an item moves into active work or becomes obsolete.
- Move larger speculative ideas to [idea-inbox.md](idea-inbox.md).

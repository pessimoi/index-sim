# Roadmap

## Current direction

The current app is a valuable static prototype of a 2004scape combat simulator. The rewrite direction is to preserve current end-user workflows, use legacy behavior as regression evidence and rebuild around explicit boundaries:

- typed domain core
- validated game-data snapshots
- explicit price sets
- isolated React UI
- repeatable tests
- documented intentional deltas when LostCityRS/Content or accepted decisions supersede legacy behavior

Implementation requirements for the rewrite live in [../technical/rewrite-spec.md](../technical/rewrite-spec.md).

## Rewrite phases

1. Preserve behavior.
   - Golden `SimEngine.simulate()` fixtures exist; extend them only when a new parity surface is accepted.
   - Known gaps are triaged in [bug-triage.md](bug-triage.md); future changes must decide preserved vs fixed behavior explicitly.

2. Add a modern toolchain.
   - Initial direction exists: TypeScript, React, Vite, Vitest, Playwright and Zod.
   - Keep simulation/domain work static-first; hiscores and live market sync now have an accepted live integration spec.

3. Extract domain modules.
   - Move combat, trip, economy, data and planner logic behind explicit interfaces.
   - Remove `window.*` and `localStorage` dependencies from domain code.

4. Rebuild the UI on top of the extracted model.
   - Keep workflows familiar.
   - Treat saved setups and simulation requests as separate schemas.
   - V1 replacement scope is combat, result summary, monster compare, loot/economy, trip and planner.
   - Use lightweight warning/info markers for uncertain or approximated results.

5. Add accepted live integrations.
   - Hiscores lookup and live market sync should follow [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md).
   - Hiscores is required for v1, but the authoritative API/hosting answer is pending.
   - Market prices target `markets.lostcity.rs`; retained 12-hour history snapshots are accepted once a refresh workflow exists.
   - Shared setups, accounts and database storage remain open decisions.

## Not in scope yet

- Auth or accounts.
- Database-backed persistence.
- Public API contract.
- Server-side market jobs.
- Full deployment pipeline.

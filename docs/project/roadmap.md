# Roadmap

## Current direction

The current root app is the source-backed Vite/React rewrite of the 2004scape combat simulator. The rewrite preserves current end-user workflows, uses the archived implementation as regression/reference evidence and owns explicit boundaries for:

- typed domain core
- validated game-data snapshots
- explicit price sets
- isolated React UI
- repeatable tests
- documented intentional deltas when LostCityRS/Content or accepted decisions supersede legacy behavior
- reviewed game revision bumps through a manual `npm run data:generate` workflow that update only the current accepted normalized snapshot after validation and calculation-impact evidence, without committing raw upstream dumps or historical snapshot archives

Immediate delivery target: trusted-tester handoff to one known friend for functional feedback. This is not a public release track and does not require full CI/CD, final hosting or a complete deploy pipeline yet.

Implementation requirements for the rewrite live in [../technical/rewrite-spec.md](../technical/rewrite-spec.md).

## Rewrite phases

1. Preserve behavior.
   - Golden `SimEngine.simulate()` fixtures exist; extend them only when a new parity surface is accepted.
   - Known gaps are triaged in [bug-triage.md](bug-triage.md); future changes must decide preserved vs fixed behavior explicitly.

2. Add a modern toolchain.
   - Initial direction exists: TypeScript, React, Vite, Vitest, Playwright and Zod.
   - Keep simulation/domain work static-first; hiscores and market price refresh now have an accepted integration spec.

3. Extract domain modules.
   - Move combat, trip, economy, data and planner logic behind explicit interfaces.
   - Remove `window.*` and `localStorage` dependencies from domain code.
   - Keep game revision changes on a reviewed development path, not on an automatic refresh path.

4. Rebuild the UI on top of the extracted model.
   - Keep workflows familiar.
   - Treat saved setups and simulation requests as separate schemas.
   - V1 replacement scope is combat, result summary, monster compare, loot/economy, trip and planner.
   - Use lightweight warning/info markers for uncertain or approximated results.

5. Add accepted live integrations.
   - Hiscores lookup and market price refresh should follow [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md).
   - Hiscores has a safe manual-level fallback plus the D-061 first-party JSON provider wired for Vite dev/preview. D-065 fixes the player-query log policy; public live availability still needs a production same-origin runtime and deployed policy verification.
   - Market prices target catalog-audited `markets.lostcity.rs/items/{slug}` pages; scheduled-only GitHub Actions writes `prices.json` and compacted shared `price-history.json`. Generated Revision 274 data owns high alch. Public crawler policy and a full live dry-run are evidenced; exact root variable setup and the first successful scheduled run remain boundaries before scheduled-current claims.
   - Shared setups, accounts and database storage remain open decisions.

## Not in scope yet

- Auth or accounts.
- Database-backed persistence.
- Public API contract.
- Request-triggered or server-managed market jobs beyond the accepted repository scheduler.
- Full CI/CD or public deployment pipeline.

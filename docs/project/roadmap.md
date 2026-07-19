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

The repository delivery target is complete, adopter-ready rewrite handoff. Running a public instance, owning a Cloudflare account and collecting environment-specific live evidence are optional adopter operations under D-067, not repository implementation phases.

Implementation requirements for the rewrite live in [../technical/rewrite-spec.md](../technical/rewrite-spec.md).

## Rewrite phases

1. Preserve behavior — completed for the accepted regression baseline.
   - Golden `SimEngine.simulate()` fixtures exist; extend them only when a new parity surface is accepted.
   - Known gaps are triaged in [bug-triage.md](bug-triage.md); future changes must decide preserved vs fixed behavior explicitly.

2. Add a modern toolchain — completed for the current stack.
   - The current stack is TypeScript, React, Vite, Vitest, Playwright and Zod.
   - Keep simulation/domain work static-first; hiscores and market price refresh now have an accepted integration spec.

3. Extract domain modules — completed for the accepted rewrite boundary.
   - Combat, trip, economy, data and planner logic live behind explicit interfaces.
   - Domain code has no `window.*` or `localStorage` dependency.
   - Keep game revision changes on a reviewed development path, not on an automatic refresh path.

4. Rebuild the UI on top of the extracted model — completed for the accepted V1 slice.
   - Keep workflows familiar.
   - Treat saved setups and simulation requests as separate schemas.
   - V1 replacement scope is combat, result summary, monster compare, loot/economy, trip and planner.
   - Use lightweight warning/info markers for uncertain or approximated results.

5. Add accepted live integrations. Repository implementation complete.
   - Hiscores lookup and market price refresh should follow [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md).
   - Hiscores has a safe manual-level fallback, the D-061 first-party JSON provider and the D-066 Cloudflare same-origin production Worker. D-065/D-066 disable request collection. A future adopter verifies deployed routing/privacy/live behavior before claiming public availability.
   - Market prices retain the catalog-audited `markets.lostcity.rs/items/{slug}` writer, committed `prices.json`, item-level `price-provenance.json` and compacted shared `price-history.json`; generated Revision 274 data owns high alch. D-099 disables the GitHub Actions cron because the current maintainer has no Actions capacity. A future adopter must explicitly re-enable the archived hardened template and verify its first successful cron before claiming scheduled-current prices.
   - Account-backed or server-shared setup storage, accounts and database storage remain open decisions.

## Not in scope yet

- Auth or accounts.
- Database-backed persistence.
- Public API contract.
- Request-triggered or server-managed market jobs beyond the retained disabled repository scheduler template.
- A general merge-blocking CI system or automatically operated public deployment. The repository-owned Cloudflare build/deploy package exists, while D-099 leaves no active GitHub Actions workflows; account connection, live operation, market-cron re-enablement and any remote merge gate remain adopter decisions.

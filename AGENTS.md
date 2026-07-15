# AI-agent work guide

This file is the first stop for AI agents working in this repository. Keep it short, practical and current.

## Working language

- Project documentation may be written in Finnish.
- Code identifiers, filenames and UI strings currently use English. Preserve that unless a task explicitly changes product language.
- When documenting uncertain behavior, write it as an open question instead of a fact.

## Start every task

1. Run or inspect `git status --short` and protect unrelated user changes.
2. Read `README.md`, this file and [docs/README.md](docs/README.md).
3. For technical work, read [docs/technical/architecture.md](docs/technical/architecture.md) and [docs/technical/testing.md](docs/technical/testing.md).
4. Search the code with `rg` before editing. The production rewrite is module-based, but the archived legacy runtime is script-order and `window.*` driven; changes to shared data, adapters or legacy-reference files can still have global effects.
5. If a claim is not verifiable from code or docs, mark it in the relevant document as an open question.
6. Run temporary scripts, caches and generated helper files from inside this repository, not from `/tmp` or other external scratch paths, unless a human explicitly approves. This avoids endpoint-security noise on the user's work machine.

## Localhost startup

- When a human asks an agent to start localhost, use `npm run dev:checked`, not raw `npm run dev`.
- Vite's listening or `ready` output is not application-readiness evidence. Report the exact URL only after the checked command emits `APP_READY`.
- On failure, use the captured browser/server diagnostics and confirm the managed child has exited; do not leave a failed Vite process running.
- If Playwright Chromium is missing, report the prerequisite and the command's `npx playwright install chromium` instruction. Do not claim a raw, unverified start succeeded.
- If the requested port is already occupied, inspect that process separately. Never kill or reuse an unknown listener automatically.

## Truth order

1. Runtime behavior in code and data files is the source of truth for the current app.
2. [docs/technical/architecture.md](docs/technical/architecture.md) owns current architecture, target rewrite boundaries and source map.
3. [docs/technical/testing.md](docs/technical/testing.md) owns validation commands and test strategy.
4. [docs/product/README.md](docs/product/README.md) owns product/domain concepts and user workflows.
5. [docs/operations/README.md](docs/operations/README.md) owns run, build, deploy and maintenance notes.
6. [docs/project/decisions.md](docs/project/decisions.md) owns accepted decisions and open decision boundaries.
7. Audit snapshots such as `ARCHITECTURE_AUDIT.md`, `PROJECT_REVIEW_NOTES.md` and `SECURITY_AUDIT.md` are evidence, not living truth. Promote durable findings into `docs/`.

The legacy `views.jsx` `ArchitectureBoard` is only a docs-link panel. Treat the markdown docs as the architecture source of truth.

## Source map

- Production app entrypoint: `index.html` for the Vite/React rewrite.
- Rewrite UI shell: `src/app`
- Archived legacy runtime entrypoint: `legacy/index.html`
- Legacy UI shell and panes: `views.jsx`
- Planner UI: `planner.jsx`
- Combat engine: `engine.js`
- Game data, drops and price fallbacks: `gamedata.js`
- Equipment registry and bonus summing: `equipment.js`
- Trip, inventory and banking model: `trip.js`
- Market price sync and local price persistence: `market.js`
- Legacy planner domain logic: `planner-core.js`
- Rewrite planner domain logic: `src/domain/planner`
- Price snapshots and provenance: `prices.json`, `price-provenance.json`, `alch.json`, `price-history.json`
- Generated game-data workflow: `scripts/generate-game-data.ts`, `scripts/game-data-generator-core.ts`, `src/data/generated/`, `docs/project/revision-impact/current.md`
- Raw LostCity source audit and candidate impact workflow: `scripts/lostcity-content-*.ts`, `scripts/report-lostcity-source-coverage.ts`, `scripts/report-lostcity-source-impact.ts`, `npm run data:source-audit`, `npm run data:source-impact`
- Root runtime bootstrap: `src/adapters/generated`, using `src/data/generated/game-data.json` plus scheduled static prices and generated item fallbacks
- Legacy runtime reference/bootstrap generator: `src/adapters/legacy-runtime`
- Generated runtime replacement readiness adapter: `src/adapters/generated`
- Generated runtime commands: `scripts/report-generated-runtime-readiness.ts`, `scripts/write-legacy-derived-runtime-snapshot.ts`, `npm run runtime:readiness`, `npm run runtime:coverage-plan`, `npm run runtime:write-legacy-derived`
- Disabled scheduled market workflow template: `.github/disabled-workflows/update-market-prices.yml`
- Provider-neutral deployment validation: `scripts/deployment-readiness-core.ts`, `scripts/verify-public-deployment.ts`, `npm run deploy:verify-artifact`, `npm run deploy:smoke`
- Production deployment target: Cloudflare Worker + Static Assets through `src/server/cloudflare-worker.ts`, `wrangler.jsonc`, `public/_headers`, `npm run deploy:cloudflare:build`, `npm run deploy:cloudflare:dry-run`, `npm run deploy:cloudflare:preview`, `npm run deploy:cloudflare`
- Rewrite styling: `src/app/styles.css`
- Archived legacy styling: `styles.css` plus inline styles in `views.jsx`
- Same-origin service boundaries: `src/server`, `src/adapters/hiscores`, `src/adapters/market`
- Strict aggregate Hiscores provider budget: `src/server/hiscores-global-rate-limit.ts`, `src/server/hiscores-core.ts`, `src/server/cloudflare-worker.ts`, `wrangler.jsonc`
- Rewrite implementation: `src/app`, `src/domain`, `src/data`, `src/adapters`, `src/tests`
- Local startup reliability: `index.html`, `src/app/startup-guard.ts`, `src/app/startup-guard-core.ts`, `scripts/dev-startup.mjs`, `npm run dev:checked`, `npm run test:startup:dev`
- Calculation Worker measurement: `scripts/measure-calculation-worker.mjs`, `scripts/worker-measurement-browser.ts`, `npm run worker:measure`
- Documentation map: `docs/README.md`

The root app path is now the Vite rewrite and boots from the validated source-backed generated Revision 274 snapshot. The legacy-derived static bridge and legacy browser runtime files remain regression/reference, fixture and rollback evidence, not the production entrypoint.

No active GitHub Actions workflow, general application database schema or stateful simulation backend exists in this checkout. D-099 moves the retained scheduled market writer template outside `.github/workflows` because the current maintainer has no Actions capacity; re-enabling it requires an explicit capacity and freshness-policy decision. D-097 adds one dedicated SQLite Durable Object for aggregate Hiscores provider-budget state, committed with enforcement `off`. D-066 selects Cloudflare Workers Builds as the optional production build/deploy integration; D-067 leaves account connection and live-operation evidence to a future adopter.

## Change recipes

### Documentation-only

- Read first: [docs/README.md](docs/README.md) and the owning document.
- Check: links, stale current-state claims and duplicated truth.
- Validate: `git diff --check`.
- Update docs only; do not change code to match docs unless explicitly asked.

### UI change

- Read first: [docs/product/README.md](docs/product/README.md), [docs/technical/architecture.md](docs/technical/architecture.md).
- Check code: `src/app`, `src/app/state`, `src/app/view-models`, `src/adapters` and affected domain modules. Touch `views.jsx` or `planner.jsx` only for archived legacy work.
- Risks: persisted schema drift, UI state leaking into `SimulationRequest`, hidden coupling to legacy data bootstrap, text overflow.
- Validate: `npm run typecheck`, relevant unit tests, browser smoke if possible, `git diff --check`.
- Update docs if user workflows, persisted state or run assumptions change.

### API or backend change

- Current state: repo-owned framework-neutral Hiscores and market handlers, Vite middleware and a Cloudflare Worker adapter exist under `src/server`. D-097's disabled aggregate Hiscores provider-budget Durable Object is the only server-managed state; no stateful simulation backend, general database, auth service or `run_sim.py` exists. `/api/prices` and `/api/scrape` are archived legacy references; the rewrite uses `/api/hiscores` and compatibility `/api/market/*` boundaries while the committed static price snapshot owns current production market values. Automatic market refresh is disabled under D-099.
- Ask a human before adding another backend framework, server-managed state, auth or a changed deployment shape.
- Read first: [docs/operations/README.md](docs/operations/README.md), [docs/project/decisions.md](docs/project/decisions.md).
- Update docs: operations, architecture, testing and decisions.

### Data or config change

- Read first: [docs/product/README.md](docs/product/README.md), [docs/technical/architecture.md](docs/technical/architecture.md).
- Check code/data: `gamedata.js`, `prices.json`, `price-provenance.json`, `alch.json`, `price-history.json`, `market.js`, `engine.js`, `scripts/generate-game-data.ts`, `scripts/game-data-generator-core.ts`, `src/data/generated/`.
- Risks: source provenance, placeholder prices, localStorage price overrides, duplicate item keys, loot table shape, raw upstream dumps, historical generated snapshot archives.
- Validate: JSON parse for data files, `node --check` for affected `.js`, `npm run test -- src/tests/data-generator.test.ts` for generated-data workflow changes, and `npm run test:golden` for simulation-impacting changes.
- Update docs when source tags, price workflow or data ownership changes.

### Auth or permission change

- Current state: no auth or user accounts exist.
- Ask a human before implementing. Record the decision in [docs/project/decisions.md](docs/project/decisions.md).
- Update security, architecture, operations and testing docs if this area is added.

### Database change

- Current state: no general application database exists. D-097's dedicated SQLite Durable Object stores only aggregate Hiscores provider-budget window/config state and is not player, simulation or market storage.
- Ask a human before adding another database or expanding that state. Do not infer SQLite/Postgres from stale UI architecture text.
- Update architecture, operations, testing and decisions if a database is introduced.

### Testing or CI change

- Read first: [docs/technical/testing.md](docs/technical/testing.md).
- Prefer adding tests around current behavior before refactoring.
- Update this guide and testing docs when new commands become authoritative.

### Release or deploy change

- Read first: [docs/operations/README.md](docs/operations/README.md).
- Current state: D-066 selects a root-path Cloudflare Worker + Static Assets deployment. Repository-owned Worker/config/header/build/deploy commands are handoff-ready. Under D-067, external account connection, preview/production smoke and any custom domain are adopter operations rather than repository backlog.
- Ask a human before changing hosting, public URLs or release process.
- Update operations and decisions.

## Documentation update triggers

Update docs in the same change when you alter:

- architecture boundaries or module ownership
- run, build, deploy or validation commands
- data source, generation, price import or source tag policy
- user-visible workflows or product scope
- accepted technical decisions or unresolved decision boundaries
- test strategy or required checks

## Testing line

Use [docs/technical/testing.md](docs/technical/testing.md) as the owner. The current minimum for documentation-only changes is `git diff --check`. For source changes, run syntax checks for affected `.js` files and parse affected JSON files. Run `npm run architecture:check` when changing module boundaries, entrypoints, adapters or barrel exports. Add stronger tests before risky refactors.

Keep test helpers, npm caches and generated scratch files inside the repo and ignore them when appropriate. Do not use `/tmp`-style script locations unless the user explicitly asks for that.

## Git practice

- Do not commit unless the user explicitly asks.
- Do not revert unrelated changes.
- Keep changes scoped to the task.
- Mention untracked files you did not create when they affect the work.

## Done criteria

- The owning docs are updated.
- Current state, target plan, accepted decisions and open questions are separated.
- Validation commands were run or the reason for skipping them is documented.
- Final response lists changed files, evidence used, open questions and checks.

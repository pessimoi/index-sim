# Operations

## Current run state

The repo now uses the Vite/React rewrite as the root app path. The old CDN/Babel browser runtime is archived for reference.

Current verified facts:

- `README.md` states Revision 274 and "Prices updated 3 July 2026".
- `index.html` mounts `src/app/main.tsx` through Vite.
- `legacy/index.html` can load the old local scripts in script-tag order for reference and parity work.
- Archived legacy UI text mentions `python run_sim.py`, `/api/prices`, `/api/scrape` and `/api/hiscores`.
- The production rewrite UI uses service availability states for live integrations and must not instruct users to run `python run_sim.py`.
- `run_sim.py` is not present in this checkout.
- `.gitignore` excludes `deploy`, `simulator.zip`, `scrape_prices.py` and `backup`.

## Local running

Rewrite scaffold commands:

```sh
npm run dev
npm run build
npm run preview
```

The Vite dev server serves the rewrite UI from the root `index.html`. Use `legacy/index.html` only for archived legacy reference work.

Run temporary scripts, local caches and generated helper files from inside this repository. Avoid `/tmp` or other external scratch paths for project work unless a human explicitly approves, because endpoint security on the user's work machine may flag those runs.

Decision: hiscores lookup and market price refresh should be implemented as product features, not removed or kept local-dev-only. The implementation target is [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md). Hiscores production runtime and hosting remain open. Market price refresh is scheduled repo automation that writes static JSON files and uses no database.

Current hiscores run behavior:

- Vite dev and preview expose same-origin `GET /api/hiscores/status` and `GET /api/hiscores?player=...` through repo-owned middleware.
- The default hiscores provider is disabled, so local runs show the disabled service state unless a test or future runtime injects an approved provider.
- In the disabled service state, the rewrite keeps the player-name input visible, disables Lookup and directs users to the Player level fields for manual level editing.
- No live hiscores upstream, secret, account model, database or scheduled job is configured in this repo.

Current market run behavior:

- Vite dev and preview expose same-origin `GET /api/market/status` and `POST /api/market/sync` through repo-owned middleware.
- The default market provider is disabled, so local runs show the disabled service state unless a test injects a provider.
- The rewrite UI keeps JSON price import available as the offline fallback.
- The rewrite UI stores the selected active imported, synced or compatible legacy `PriceSet` in browser-local `index-sim:price-set:selected` using a versioned envelope. Reload restores a valid selected `PriceSet` over the bundled context without adding a price-history snapshot. Reset to bundled prices clears only this selected key and keeps local price history.
- The rewrite UI stores accepted imported, synced, compatible legacy or manually captured active price snapshots in browser-local `index-sim:price-history` using a versioned envelope. The Economy tab can analyze this local history with baseline movers, create Snapshot now entries and clear only this local history key after confirmation. Clearing site data removes both browser-local price keys; no server cleanup or migration is involved.
- The rewrite UI can export the currently active `PriceSet` as JSON that the same `PriceSet` import parser accepts.
- The Settings tab can show a rewrite-local state recovery view when a known rewrite-owned browser key is invalid or uses an unsupported version. The report exports metadata only: state labels, storage keys, status, expected/found versions and sanitized reasons. Per-key Clear and Clear invalid local data operate only on allowlisted rewrite-owned keys and do not remove legacy or unknown localStorage keys.
- The rewrite UI can detect known legacy browser storage keys and show an import/keep/clear choice. Import writes only rewrite-owned setup, hiscores last-player, selected active price set, accepted price-history and dismissed keys and keeps legacy keys. Clear removes only known legacy keys after explicit user confirmation; no server cleanup, account context or tenant cleanup is involved.
- No live market upstream provider, secret, account model, database, server-managed shared price history or scheduled writer is configured in this repo.

Accepted market price writer target:

- A scheduled repo automation fetches the approved `markets.lostcity.rs` data.
- It runs as GitHub Actions cron at 00:15 and 12:15 UTC.
- It writes latest item prices to `prices.json`.
- It writes latest high-alch values to `alch.json`.
- It appends/retains 12-hour shared history snapshots in `price-history.json`.
- It validates the generated JSON and commits only when the files differ.
- It uses the repository `GITHUB_TOKEN` with `contents: write`, with no separate app token unless the default token is insufficient.
- It has no `workflow_dispatch` manual trigger.
- It avoids artifact upload and large caches by default.
- No browser, user action or production runtime request triggers upstream market fetches.

## Live integration release copy audit

Before a release, audit stale backend copy with:

```sh
rg -n "run_sim.py|/api/prices|/api/scrape|/api/hiscores" index.html legacy/index.html src views.jsx planner.jsx market.js docs
```

Expected classification:

- `index.html` and `src/app` should not contain user-facing `run_sim.py`, `/api/prices` or `/api/scrape` instructions.
- `src` may contain typed same-origin `/api/hiscores` contract, adapter, server and test paths. It may also contain negative smoke assertions that stale `/api/prices` or `/api/scrape` copy is absent from the rendered UI.
- `legacy/index.html`, `views.jsx` and `market.js` may contain archived legacy evidence until the broader legacy-removal or shim decision is accepted.
- Docs may mention the legacy paths only as history, audit evidence, open decisions or explicit non-production behavior.

## Build and deploy

Current state:

- Rewrite build: `npm run build`.
- Rewrite preview: `npm run preview`.
- No deploy script.
- No CI.

Rewrite recommendation:

- Keep `package.json` run/build/test scripts in sync with [../technical/testing.md](../technical/testing.md).
- Keep simulation/domain deployment static-first. Add hiscores production provider wiring only through [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md) after runtime, hosting and upstream sources are chosen.
- Add market price freshness through scheduled repo automation and static JSON artifacts, not through user-triggered production sync.
- Do not describe hiscores as live-available in release notes unless the production runtime and approved upstream provider are configured. Do not describe market prices as scheduled-current unless the writer is configured and its latest run is validated.
- Do not lock the project to GitHub Pages, Netlify or another host until the accepted live integration requirements can be satisfied there.

## Static hosting hardening

No deploy target is accepted yet, so CSP is documented as a deployment requirement instead of being hard-coded into the dev HTML.

Recommended starting headers for a static host:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

The current rewrite browser talks to same-origin live integration endpoints only, so static deployments should keep `connect-src 'self'` unless a separately accepted runtime requires more. If a future implementation adds browser-side upstream probes, tighten `connect-src` to the exact approved origins and document the source in [../project/decisions.md](../project/decisions.md). Do not add a database, user-triggered scraper or shared cloud state as part of deploy hardening.

## Data and price maintenance

Known files:

- `prices.json`
- `alch.json`
- `price-history.json`
- embedded price fallbacks in `gamedata.js`

Current validation:

```sh
npm run test -- src/tests/data-economy.test.ts
node -e "for (const f of ['prices.json','alch.json','price-history.json']) JSON.parse(require('fs').readFileSync(f,'utf8'))"
```

The rewrite data layer can adapt current legacy runtime data into a validated `GameDataSnapshot`, including the browser sandbox bootstrap used by the Vite UI. It can validate `PriceSet` imports. In local runs where the market provider is disabled, the Market sync UI keeps sync actions disabled but still shows the active bundled/imported `PriceSet` summary, the same validated `PriceSet` import path, active `PriceSet` export and reset-to-bundled controls. This is not yet an authoritative generation workflow.

Accepted workflow target: the authoritative shared refresh is scheduled-only repo automation from `markets.lostcity.rs`. Latest prices stay in `prices.json`, latest high-alch values stay in `alch.json`, and retained 12-hour shared snapshots stay in `price-history.json`. The writer must validate these files and commit only real diffs. No database, backend-managed shared history or user-triggered upstream refresh is accepted for market prices.

Open question: the exact upstream response contract and writer implementation are not present in the repo.

Game revision updates are different from price refreshes. A new game revision must be handled as a reviewed development change through the accepted manual `npm run data:generate` target workflow: update or pin the gitignored `.sources/lostcity-content/` checkout, overwrite the normalized current `src/data/generated/game-data.json` snapshot and `src/data/generated/source-pin.json`, update `docs/project/revision-impact/current.md`, run validation and parity/golden checks, review changed calculation outputs and merge only after the revision bump is accepted. The generated snapshot should contain only simulator-consumed domain data, not raw upstream files or unused source-only content. The revision-impact report must list old/new source refs, generator metadata, generated-data changes, merge-blocking hybrid-suite DPS/kills/hr/XP/hr/GP/hr/GP/XP diffs, informational all-monster scan outliers from fixed simple melee/ranged/magic baselines, accepted intentional deltas and validation results; changed representative-suite outputs block merge until accepted or fixed. Informational outliers are DPS, kills/hr or XP/hr changes over 10%, GP/hr or GP/XP changes over 25%, missing required combat/drop/economy data, warning-count increases and monsters entering or leaving the scan. Do not add scheduled or automatic main-branch game-data updates, and do not retain old generated snapshots outside git history.

## Current release evidence snapshot

The latest V1 release-evidence pass was consolidated on 2026-07-06 for the current Vite/React rewrite path.

| Area | Status | Evidence | Operational follow-up |
| --- | --- | --- | --- |
| Core commands | `pass` | `npm run typecheck`, `npm run test`, `npm run test:golden`, `npm run build` and `git diff --check` passed. | Re-run before release and after any source changes. |
| Browser smoke | `pass after sandbox escalation` | `npm run test:e2e` passed 41 Playwright tests in about 1.3 minutes after the documented Codex localhost `EPERM` sandbox limitation required explicit escalation. | Keep the smoke mocked/same-origin; do not treat it as live provider evidence. |
| Dependency audit | `pass` | `npm audit` reported 0 vulnerabilities. | Re-run after dependency changes. |
| Security/static copy audit | `pass with classified residuals` | Static searches found only the trusted bundled legacy-data sandbox bootstrap, false-positive secret strings, typed same-origin contract/test paths, archived legacy evidence and documentation/history. | Continue classifying hits before release. Do not remove legacy evidence or add legacy `/api/*` shims without a separate decision. |
| Production live integrations | `partial decision` | Hiscores and market sync have same-origin dev/preview boundaries and mocked tests. Market price refresh now has an accepted scheduled static JSON model, but no writer is implemented. Hiscores still lacks production runtime/provider wiring. | Do not describe live hiscores or scheduled-current market prices as production-available until the relevant provider/writer is configured and validated. |
| Deploy/security headers | `not selected yet` | Static-host headers are recommended below, but no deploy target is accepted. | Confirm the target host can set the required headers before a real deployment. |
| Generated data workflow | `partly accepted` | Current UI still bootstraps from trusted bundled legacy data through a sandbox adapter. Revision bumps are accepted only as reviewed development PRs through the future `npm run data:generate` workflow, and the output policy is a single normalized current snapshot plus source pin and current impact report. The generator script and committed generated files are not implemented. | Replace with an authoritative generated `GameDataSnapshot` after the source/generator workflow is implemented. |

## Release checklist, current app

Until a real release process exists:

1. Confirm intended price snapshot date.
2. Run checks from [../technical/testing.md](../technical/testing.md).
3. Smoke test the main UI in a browser if possible.
4. Confirm no stale generated or local-only files are included accidentally.
5. Run the live integration release copy audit and classify any remaining `run_sim.py` or legacy `/api/*` hits.
6. Verify legacy migration/reset evidence: focused `src/tests/legacy-migration.test.ts` + `src/tests/ui-adapters.test.ts`, Playwright import/keep/clear smoke, and a feature-inventory check that the migration feature is not marked complete while planner/custom setup/loot prefs/compare/cannon/hidden tiers or full price-history migration remain open.
7. Confirm static-host security headers or document why the target cannot set them.
8. Update documentation if run, data or deployment steps changed.

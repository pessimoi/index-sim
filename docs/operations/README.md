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
- `.github/workflows/update-market-prices.yml` is the only GitHub Actions workflow in this checkout. It is limited to scheduled market price updates and is not a general CI/CD pipeline.

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
- The rewrite UI stores the selected active imported, synced or compatible legacy `PriceSet` in browser-local `index-sim:price-set:selected` using a versioned envelope. Reload restores a valid selected `PriceSet` over the scheduled static snapshot or bundled fallback without adding a price-history snapshot. Reset local override clears only this selected key, keeps local price history and returns to scheduled prices when available, otherwise bundled prices.
- The rewrite UI stores accepted imported, synced, compatible legacy or manually captured active price snapshots in browser-local `index-sim:price-history` using a versioned envelope. The Economy tab can analyze this local history with baseline movers, create Snapshot now entries and clear only this local history key after confirmation. Clearing site data removes both browser-local price keys; no server cleanup or migration is involved.
- The rewrite UI can export the currently active `PriceSet` as JSON that the same `PriceSet` import parser accepts.
- The Settings tab can show a rewrite-local state recovery view when a known rewrite-owned browser key is invalid or uses an unsupported version. The report exports metadata only: state labels, storage keys, status, expected/found versions and sanitized reasons. Per-key Clear and Clear invalid local data operate only on allowlisted rewrite-owned keys and do not remove legacy or unknown localStorage keys.
- The rewrite UI can detect known legacy browser storage keys and show an import/keep/clear choice. Import writes only rewrite-owned setup, hiscores last-player, selected active price set, accepted browser-local price-history snapshots and dismissed keys and keeps legacy keys. D-049 keeps full legacy price-history payloads review-only/not migrated for V1. Clear removes only known legacy keys after explicit user confirmation; no server cleanup, account context or tenant cleanup is involved.
- No live market upstream provider, secret, account model, database or server-managed shared price history is configured in this repo. A scheduled GitHub Actions workflow exists for market prices, but it requires a repository variable `MARKET_PRICES_UPSTREAM_URL` pointing to the verified `https://markets.lostcity.rs` raw endpoint before it can complete a live run.

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
- Local writer: `npm run prices:write-scheduled -- --input <normalized-upstream.json>` validates the normalized fixture/dev contract, while `--upstream-url <url>` fetches an approved-origin raw `markets.lostcity.rs` response and normalizes it before the same writer core. The writer updates `prices.json`, `alch.json` and `price-history.json` candidates only after all outputs validate, keeps one shared price-history snapshot per 12-hour UTC bucket and skips unchanged file writes. Use `--dry-run` for local verification. The fixture/dev `--item-ids` option can narrow the allowlist for small local fixtures; production cron wiring omits it.
- Workflow: `.github/workflows/update-market-prices.yml` runs at 00:15 and 12:15 UTC, installs with `npm ci`, requires the repo variable `MARKET_PRICES_UPSTREAM_URL`, runs the scheduled writer with `--upstream-url`, validates JSON plus focused writer/data-economy tests and `git diff --check`, verifies that only `prices.json`, `alch.json` and `price-history.json` changed, and commits `Update scheduled market prices` only when those files have a real diff. It has `permissions: contents: write`, no `workflow_dispatch`, no artifact upload and no broad token or secret requirement.

## Live integration release copy audit

Before a release, audit stale backend copy with:

```sh
rg -n "run_sim.py|/api/prices|/api/scrape|/api/hiscores" index.html legacy/index.html src views.jsx planner.jsx market.js docs
```

Expected classification:

- `index.html` and `src/app` should not contain user-facing `run_sim.py`, `/api/prices` or `/api/scrape` instructions.
- `src` may contain typed same-origin `/api/hiscores` contract, adapter, server and test paths. It may also contain negative smoke assertions that stale `/api/prices` or `/api/scrape` copy is absent from the rendered UI.
- `legacy/index.html`, `views.jsx` and `market.js` may contain archived legacy evidence. D-044 keeps legacy `/api/*` and `run_sim.py` shims archive-only for the current rewrite path unless a future explicit legacy-runtime re-promotion decision changes the boundary.
- Docs may mention the legacy paths only as history, audit evidence, open decisions or explicit non-production behavior.

## Build and deploy

Current state:

- Rewrite build: `npm run build`.
- Rewrite preview: `npm run preview`.
- No deploy script.
- No general CI/CD pipeline. The repo has a narrow scheduled market price update workflow only.
- Current external sharing target: trusted-tester handoff to one known friend, not a public release.

Rewrite recommendation:

- Keep `package.json` run/build/test scripts in sync with [../technical/testing.md](../technical/testing.md).
- For the trusted-tester handoff, prioritize functional readiness, local build/preview sanity, a clear known-limitations note and fast feedback from the tester over formal release automation.
- Keep simulation/domain deployment static-first. Add hiscores production provider wiring only through [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md) after runtime, hosting and upstream sources are chosen.
- Add market price freshness through scheduled repo automation and static JSON artifacts, not through user-triggered production sync.
- Do not describe hiscores as live-available in release notes unless the production runtime and approved upstream provider are configured. Do not describe market prices as scheduled-current unless the writer is configured and its latest run is validated.
- Do not build a full CI/CD pipeline or lock the project to GitHub Pages, Netlify or another host just for the trusted-tester handoff. Choose hosting later when public-release and live-integration requirements are accepted.

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
npm run test -- src/tests/market-writer.test.ts
npm run test -- src/tests/data-economy.test.ts
npm run prices:write-scheduled -- --input src/tests/fixtures/market-writer/upstream-valid.json --item-ids lobster,rune_scimitar,dragon_bones --now 2026-07-08T00:15:00.000Z --dry-run
node -e "for (const f of ['prices.json','alch.json','price-history.json']) JSON.parse(require('fs').readFileSync(f,'utf8'))"
```

The rewrite data layer can adapt current legacy runtime data into a validated `GameDataSnapshot`, including the browser sandbox bootstrap used by the Vite UI. It can validate `PriceSet` imports. In local runs where the market provider is disabled, the visible Market UI stays scheduled-only: no user-triggered refresh controls are shown, and the active scheduled/imported/bundled `PriceSet` summary, validated `PriceSet` import path, active `PriceSet` export and local-override reset controls remain available. This is not yet an authoritative game-data generation workflow.

Accepted workflow target: the authoritative shared refresh is scheduled-only repo automation from `markets.lostcity.rs`. Latest prices stay in `prices.json`, latest high-alch values stay in `alch.json`, and retained 12-hour shared snapshots stay in `price-history.json`. The local writer validates these files and skips unchanged writes; `--input` reads the normalized fixture/dev contract and `--upstream-url` fetches an approved-origin raw `markets.lostcity.rs` response before normalizing it through the raw adapter. The GitHub Actions workflow commits only real diffs to the three market snapshot files and exits successfully without a commit on no-diff runs. No database, backend-managed shared history or user-triggered upstream refresh is accepted for market prices.

Open question: the exact live `markets.lostcity.rs` API/scrape response contract still needs verification before setting `MARKET_PRICES_UPSTREAM_URL` and trusting scheduled-current price claims. The raw adapter is fixture-evidenced and no raw upstream dump is committed.

### Scheduled market freshness evidence

The accepted shared market snapshot is the latest committed, schema-valid state of `prices.json`, `alch.json` and `price-history.json`. For a generated snapshot, `prices.json` `_scraped_at` is the capture timestamp that the UI turns into the scheduled `PriceSet.createdAt`, and the latest `price-history.json` entry records the retained shared history snapshot for the matching 12-hour bucket.

Use this local check to inspect the committed snapshot freshness without contacting the upstream:

```sh
node -e "const fs=require('fs'); const prices=JSON.parse(fs.readFileSync('prices.json','utf8')); const history=JSON.parse(fs.readFileSync('price-history.json','utf8')); const last=history.at(-1); console.log({pricesScrapedAt: new Date(prices._scraped_at*1000).toISOString(), lastHistoryAt: last ? new Date(last.t*1000).toISOString() : null, historySnapshots: history.length});"
git log -1 --format="%h %cI %s" -- prices.json alch.json price-history.json
```

For release notes or handoff notes, distinguish three facts:

- **Snapshot timestamp**: the `_scraped_at` timestamp in the committed `prices.json`.
- **Latest accepted file change**: the latest commit touching `prices.json`, `alch.json` or `price-history.json`.
- **Latest scheduled validation**: the latest successful GitHub Actions run of `Update market prices` on the release branch after `MARKET_PRICES_UPSTREAM_URL` is configured.

A failed scheduled run leaves the previous committed snapshot in place because the writer builds and validates candidates before writing, and the workflow commits only after JSON validation, focused tests, `git diff --check` and the approved-file allowlist pass. A no-op run exits successfully without a commit when the generated market snapshot text matches the committed files; in that case the previous snapshot timestamp remains the active snapshot, while the successful workflow run is evidence that the scheduled check completed.

Do not claim "scheduled-current" market prices in public release copy unless the release branch has a latest successful `Update market prices` workflow run against the verified upstream URL. Trusted-tester notes may instead say that the app uses the committed static price snapshot, local imports and bundled fallback, and that scheduled freshness is pending live-run evidence.

Game revision updates are different from price refreshes. A new game revision must be handled as a reviewed development change through the accepted manual `npm run data:generate` workflow. The command validates repository-local source and output paths, parses the pinned raw LostCity config and RuneScript sources, writes schema-valid `src/data/generated/source-pin.json`, `src/data/generated/game-data.json` and `docs/project/revision-impact/current.md` outputs, runs the merge-blocking representative calculation-impact suite through `simulateFullSimulation` using scheduled static prices plus generated item fallbacks, and runs an informational all-monster scan with fixed simple melee/ranged/magic baselines. The active Revision 274 snapshot covers all expected runtime monster, item, weapon, ammo, spell and equipment identities plus 63/63 reviewed core-loot tables. Exact item/price keys win; D-058 keeps cut and uncut gem identities distinct and limits aliases to fallback lookup. D-059 makes the committed source-backed generated snapshot the root runtime. `npm run runtime:write-legacy-derived` remains a reference/regression snapshot writer, not the production bootstrap.

Run the direct raw-source audit and impact checks against the gitignored local checkout with:

```sh
npm run data:source-audit -- --source-dir .sources/lostcity-content --example-limit 10
npm run data:source-impact -- --source-dir .sources/lostcity-content --impact-outlier-limit 25
npm run data:source-impact -- --source-dir .sources/lostcity-content --loot-only --impact-outlier-limit 25
npm run data:source-impact -- --source-dir .sources/lostcity-content --equipment-only --impact-outlier-limit 25
npm run data:source-impact -- --source-dir .sources/lostcity-content --combat-catalog-only --impact-outlier-limit 25
```

These commands are read-only evidence paths for reviewing the same raw parser used by the generator. They must not write raw upstream payloads, absolute source paths or local checkout content into committed files. The current parser reports four quest-gated drops and 21 clue-scroll tertiary rows as explicit exclusions; do not silently include them until the corresponding domain policy is accepted.

### Game revision bump PR runbook

Use this checklist for a revision bump branch or PR:

1. Update or pin the gitignored `.sources/lostcity-content/` checkout to the intended LostCityRS/Content revision.
2. Run `npm run data:generate -- --source-dir .sources/lostcity-content --output-root .`.
3. Review that only the current normalized outputs changed: `src/data/generated/source-pin.json`, `src/data/generated/game-data.json` and `docs/project/revision-impact/current.md`, unless the same PR intentionally changes generator code, tests or docs.
4. Check that `source-pin.json`, `game-data.json` and `revision-impact/current.md` refer to the same source revision and generation command.
5. Review the snapshot diff summary for added, removed and changed simulator-consumed data only. The generated snapshot must not contain raw upstream file bodies, historical snapshot archives, absolute local paths, market price history or unused source-only content.
6. Review representative calculation-impact rows first. Changed DPS, kills/hr, XP/hr, GP/hr or GP/XP rows block merge until they are fixed or accepted as intentional in the PR evidence.
7. Review the informational all-monster scan second. It is advisory by default, but a reviewer may promote a finding to a required fix or explicit decision.
8. Run the focused validation commands from [../technical/testing.md](../technical/testing.md#generated-game-data-tests), plus broader golden/parity checks when generated data or formulas change calculation outputs.
9. Keep any accepted calculation deltas in the revision-impact report or decision log. Do not silently refresh baselines.

Diff-review rules for generated data:

- Treat `docs/project/revision-impact/current.md` as the human review entrypoint; use the raw JSON diffs only to inspect specific rows called out by the report.
- `--skip-calculation-impact` is acceptable for local baseline-less dry runs only. Normal revision PR output should include the representative suite and informational scan.
- `--impact-case-filter <tag-or-id>` may be used during investigation, but committed PR evidence should identify the filter when used and should not hide unrelated changed calculation output.
- `--impact-outlier-limit <number>` may limit printed informational scan rows without changing how many outliers were found.
- Do not add scheduled or automatic main-branch game-data updates, and do not retain old generated snapshots outside git history.

Run the current generator command against the local gitignored checkout with:

```sh
npm run data:generate -- --source-dir .sources/lostcity-content --output-root .
```

For deterministic local verification without live upstream data, use the committed fixture and dry-run output root:

```sh
npm run data:generate -- --source-dir src/tests/fixtures/data-generator/lostcity-content --output-root .vite/data-generator-output --generated-at 2026-07-08T00:00:00.000Z --dry-run --skip-calculation-impact
```

The generator includes a repo-local output hygiene assertion before writing. It must keep output to the current source pin, current normalized game-data snapshot and current revision-impact report, and must not commit raw upstream checkouts, historical generated snapshot archives, absolute local paths or market price history into generated game data.

## Current release evidence snapshot

The latest functional release-evidence check was refreshed on 2026-07-10 for the source-backed Revision 274 Vite/React runtime. Typecheck, unit, golden, build, dependency, generator, readiness and source-audit gates pass. All four raw source-impact diagnostics completed; their unaccepted candidate rows remain `needs-review`, while the committed generator report applies D-055/D-056/D-057 and passes 10/10 representative cases. The latest browser-executed default smoke remains the earlier localhost-capable 51/51 pass; the 2026-07-10 managed-sandbox rerun stopped before browser execution because localhost binding is not permitted.

| Area | Status | Evidence | Operational follow-up |
| --- | --- | --- | --- |
| Core commands | `pass` | The 2026-07-10 refresh reran `npm run typecheck`, `npm run test` (28 files, 468 tests), `npm run test:golden` (19 tests), `npm run build` and the focused generated/runtime checks; all passed. The build emitted only the known Vite chunk-size warning. | Re-run before release and after source changes. |
| Browser smoke | `environment-limited before execution` | The 2026-07-10 full `npm run test:e2e` attempt stopped before browser execution because Vite could not bind `127.0.0.1:5173` with `listen EPERM: operation not permitted`. No Playwright assertion ran. The latest browser-executed default gate remains the earlier localhost-capable 51/51 run. | Rerun in a localhost-capable environment after the D-059 bootstrap change; keep the smoke mocked/same-origin. |
| Tooling hygiene | `known gap` | ESLint now ignores gitignored `.sources` and `.vite` trees, then reports 19 code errors and 8 warnings in the current checkout. Repo-wide Prettier check reports 62 files, including unchanged baseline files. These do not invalidate the passing functional/type/build gates, but the repo-wide lint/format scripts are not green. | Treat as a separate maintenance cleanup; do not describe lint/format as passing. |
| Dependency audit | `pass` | The 2026-07-10 `npm audit` reported 0 vulnerabilities. | Re-run after dependency changes. |
| Security/static copy audit | `pass with classified residuals` | Static searches found trusted bundled legacy-data sandbox execution only in reference/regeneration paths, false-positive secret strings, a URL password-rejection guard, typed same-origin contract/test paths, archived legacy evidence and documentation/history. The root app bootstrap uses committed validated JSON through `src/adapters/generated`; `src/adapters/static-runtime` remains reference/rollback evidence. | Continue classifying hits before release. Do not remove legacy evidence or add legacy `/api/*` shims without a future explicit legacy-runtime re-promotion decision. |
| Production live integrations | `partial decision` | Hiscores and market sync have same-origin dev/preview boundaries and mocked tests. Market price refresh now has an accepted scheduled static JSON model, local writer, fixture-evidenced raw adapter and scheduled commit-if-diff workflow, but live response contract verification, `MARKET_PRICES_UPSTREAM_URL` configuration and a verified successful scheduled run are not present. D-053 keeps that market evidence out of the V1/trusted-tester gate while leaving it required before scheduled-current market price claims. Hiscores still lacks production runtime/provider wiring. The live-integration bucket matrix in [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md#live-integration-gap-buckets) owns the current release-required, blocked and decision-needed split. | Do not describe live hiscores or scheduled-current market prices as production-available until the relevant provider/writer is configured and validated. Keep user-triggered upstream market refresh out of production copy. |
| Deploy/security headers | `trusted-tester only` | Static-host headers are recommended below, but no deploy target is accepted. The current handoff is not a public deployment. | Confirm the target host can set the required headers before a real deployment. Do not block the trusted-tester handoff on final hosting or full CI/CD. |
| Generated data workflow | `accepted active runtime` | The UI bootstraps through `src/adapters/generated` from the committed Revision 274 source-backed snapshot, scheduled static prices and generated item fallbacks. The raw generator covers all expected runtime identities and 63/63 core-loot tables; runtime readiness has zero blocking coverage gaps. The committed impact report passes 10/10 representative cases with accepted D-055/D-057 source deltas and records 22 informational all-monster outliers. The legacy-derived snapshots remain regression/reference evidence. The active raw snapshot intentionally has no authoritative requirement skill map, so Planner/loadout requirement consumers use the D-051 manual fallback. | Keep revision bumps manual and reviewed. Re-run generator, readiness, impact, golden/domain and browser checks when source data or visible behavior changes; do not add quest/clue rows or remove the requirements fallback without their separate decisions. |

## Trusted-tester handoff checklist, current app

For the current trusted-tester model, the app is shared only with a known friend for functional feedback. This checklist is intentionally lighter than a public release or full CI/CD pipeline:

1. Confirm intended price snapshot date.
2. Run checks from [../technical/testing.md](../technical/testing.md).
3. Smoke test the main UI in a browser if possible.
4. Confirm no stale generated or local-only files are included accidentally.
5. Run the live integration release copy audit and classify any remaining `run_sim.py` or legacy `/api/*` hits.
6. Verify legacy migration/reset evidence: focused `src/tests/legacy-migration.test.ts` + `src/tests/ui-adapters.test.ts`, Playwright import/keep/clear smoke, and a feature-inventory check that the accepted V1 migration boundary is clear: compatible setup/cannon import can be complete while D-048 `sim_planner_v1` and D-049 full legacy price-history payloads remain review-only.
7. Write down known limitations for the tester, especially live hiscores/provider status, scheduled-price freshness and any browser-smoke evidence that could not be refreshed locally.
8. Update documentation if run, data or deployment steps changed.

A later public release can add final hosting, deploy-target CSP/security headers, CI/CD automation and stricter release notes as separate accepted work.

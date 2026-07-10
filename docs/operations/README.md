# Operations

## Related execution specifications

- [market-live-evidence-spec.md](market-live-evidence-spec.md): exact live response verification, fetch hardening, repository variable setup and first successful scheduled-run evidence.
- [public-deployment-spec.md](public-deployment-spec.md): provider-neutral hosting, CSP, release, market propagation and rollback plan for a later public deployment.
- [../technical/hiscores-live-implementation-spec.md](../technical/hiscores-live-implementation-spec.md): remaining authoritative provider and production same-origin Hiscores runtime work.
- [../project/worktree-delivery-spec.md](../project/worktree-delivery-spec.md): safe review, commit grouping and push sequence for the current worktree.

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
- Vite dev and preview inject the D-061 first-party 2004Scape JSON provider. The provider calls a fixed HTTPS origin server-side, rejects redirects, bounds the response, maps only skill types 1-7 and sanitizes provider failures.
- When the upstream is unavailable, the rewrite keeps the player-name input and manual Player level fields usable and shows the existing non-blocking service failure state.
- A static `dist` build does not include a production API runtime. No secret, account model, database or scheduled Hiscores job is configured in this repo.

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
- Local writer: `npm run prices:write-scheduled -- --input <normalized-upstream.json>` validates the normalized fixture/dev contract, while `--upstream-url <url>` fetches an approved-origin raw `markets.lostcity.rs` response and normalizes it before the same writer core. The network path rejects redirects, credentials and fragments, requires JSON, applies one 15-second timeout across fetch and body reads, and rejects declared or streamed responses above one megabyte before parsing. Errors stay sanitized. The writer updates `prices.json`, `alch.json` and `price-history.json` candidates only after all outputs validate, keeps one shared price-history snapshot per 12-hour UTC bucket and skips unchanged file writes. Use `--dry-run` for local verification. The fixture/dev `--item-ids` option can narrow the allowlist for small local fixtures; production cron wiring omits it.
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
- Provider-neutral artifact validation: `npm run deploy:verify-artifact` after a build.
- Provider-neutral deployed HTTPS smoke: `npm run deploy:smoke -- --origin <https-origin> --hiscores-mode absent|disabled|enabled` after a preview exists.
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

No deploy target is accepted yet, so CSP is documented as a deployment requirement instead of being hard-coded into the dev HTML. `npm run deploy:smoke` now verifies the contract against an eventual provider preview; it does not configure headers itself.

Recommended starting headers for a static host:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

The current rewrite browser talks to same-origin live integration endpoints only, so static deployments should keep `connect-src 'self'` unless a separately accepted runtime requires more. If a future implementation adds browser-side upstream probes, tighten `connect-src` to the exact approved origins and document the source in [../project/decisions.md](../project/decisions.md). Do not add a database, user-triggered scraper or shared cloud state as part of deploy hardening.

The current provider-neutral build profile is root-path only. `npm run deploy:verify-artifact` rejects inline scripts, external index assets, source maps, unexpected root files, non-hashed assets, symlinks, local absolute paths and common secret material; validates all three market files; and emits a deterministic artifact checksum without writing release state. `npm run deploy:smoke` requires a credential-free HTTPS origin root and validates route ordering, content types, cache classes, the headers above, market JSON and the selected Hiscores status mode. It never sends a player lookup. Host configuration, a real domain, deployment automation and player-query log policy remain unchosen.

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

The latest non-browser release-evidence check was refreshed on 2026-07-10 for the source-backed Revision 274 Vite/React runtime. Typecheck, 520 unit tests, 19 golden tests, build, artifact validation, dependency audit and tooling-hygiene gates pass. The most recent successful production-preview Playwright gate remains 53/53 against the current source-backed runtime; the deployment-readiness change did not alter UI/runtime behavior, and the managed sandbox still cannot bind the local preview port for a fresh browser run. All four raw source-impact diagnostics completed; their unaccepted candidate rows remain `needs-review`, while the committed generator report applies D-055/D-056/D-057 and passes 10/10 representative cases.

| Area                         | Status                                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Operational follow-up                                                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core commands                | `pass`                                    | The 2026-07-10 refresh reran `npm run typecheck`, `npm run test` (33 files, 520 tests), `npm run test:golden` (19 tests), `npm run build`, `npm run deploy:verify-artifact`, `npm run lint`, `npm run format:check`, `npm audit` and `git diff --check`; all passed. The artifact report covered 6 files/2 hashed assets, validated 13 market-history snapshots and emitted SHA-256 `5962dca2ecc0b20465cf58faab0e67cc5f212749e5ebf7669ef4b311fd116a9c`. The build emitted only the known Vite chunk-size warning.                                                                                                                                                                                                                                                                                                                                                                     | Re-run before release and after source changes.                                                                                                                                                                                                               |
| Browser smoke                | `pass; current rerun environment-limited` | The latest successful production-preview `npm run test:e2e` gate remains 53/53 in Chromium against the source-backed runtime. The provider-neutral deployment-readiness change adds scripts/tests/docs only and does not change browser behavior. A fresh local browser run was not attempted because no provider preview exists and the managed sandbox's documented localhost bind returns `EPERM`; this does not replace the last successful gate.                                                                                                                                                                                                                                                                                                                                                                                                                                 | Run functional and visual Playwright against the selected provider preview before production promotion.                                                                                                                                                       |
| Tooling hygiene              | `pass`                                    | `npm run lint` and `npm run format:check` pass after the dedicated cleanup. Generator-owned current snapshot JSON and revision-impact output remain excluded from Prettier so their deterministic generators, rather than a second formatter, own their serialized shape.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Keep both commands in release checks and keep generated-output formatting owned by the generators.                                                                                                                                                            |
| Dependency audit             | `pass`                                    | The 2026-07-10 `npm audit` reported 0 vulnerabilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Re-run after dependency changes.                                                                                                                                                                                                                              |
| Security/static copy audit   | `pass with classified residuals`          | Static searches found trusted bundled legacy-data sandbox execution only in reference/regeneration paths, false-positive secret strings, a URL password-rejection guard, typed same-origin contract/test paths, archived legacy evidence and documentation/history. The root app bootstrap uses committed validated JSON through `src/adapters/generated`; `src/adapters/static-runtime` remains reference/rollback evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Continue classifying hits before release. Do not remove legacy evidence or add legacy `/api/*` shims without a future explicit legacy-runtime re-promotion decision.                                                                                          |
| Production live integrations | `partial decision`                        | Hiscores and market sync have same-origin dev/preview boundaries and mocked tests. Market price refresh now has an accepted scheduled static JSON model, local writer, fixture-evidenced raw adapter and scheduled commit-if-diff workflow, but live response contract verification, `MARKET_PRICES_UPSTREAM_URL` configuration and a verified successful scheduled run are not present. D-053 keeps that market evidence out of the V1/trusted-tester gate while leaving it required before scheduled-current market price claims. Hiscores has the D-061 provider wired for Vite dev/preview but still lacks an accepted production runtime/hosting path. The live-integration bucket matrix in [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md#live-integration-gap-buckets) owns the current release-required, blocked and decision-needed split. | Do not describe live hiscores or scheduled-current market prices as production-available until the relevant provider/writer is configured and validated. Keep user-triggered upstream market refresh out of production copy.                                  |
| Deploy/security headers      | `provider-neutral gate ready`             | Node 22/npm 10 are aligned across `.nvmrc`, package engines and the scheduled workflow. The built root-path artifact passes `npm run deploy:verify-artifact`, which checks hashed assets, market schemas, source-map/secret/path hygiene and emits a deterministic checksum. A mocked focused suite covers the HTTPS route/header/cache/API/Hiscores-status smoke contract. No deploy target or public release is accepted.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Choose host/runtime, URL shape, Hiscores release mode, deploy trigger and player-query log policy; encode provider routing/headers and run `npm run deploy:smoke` against preview and production before release.                                              |
| Generated data workflow      | `accepted active runtime`                 | The UI bootstraps through `src/adapters/generated` from the committed Revision 274 source-backed snapshot, scheduled static prices and generated item fallbacks. The raw generator covers all expected runtime identities and 63/63 core-loot tables; runtime readiness has zero blocking coverage gaps. The committed impact report passes 10/10 representative cases with accepted D-055/D-057 source deltas and records 22 informational all-monster outliers. The legacy-derived snapshots remain regression/reference evidence. The active raw snapshot intentionally has no authoritative requirement skill map, so Planner/loadout requirement consumers use the D-051 manual fallback.                                                                                                                                                                                        | Keep revision bumps manual and reviewed. Re-run generator, readiness, impact, golden/domain and browser checks when source data or visible behavior changes; do not add quest/clue rows or remove the requirements fallback without their separate decisions. |

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

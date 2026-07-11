# Operations

## Related execution specifications

- [market-live-evidence-spec.md](market-live-evidence-spec.md): exact live response verification, fetch hardening, repository variable setup and first successful scheduled-run evidence.
- [public-deployment-spec.md](public-deployment-spec.md): D-066 Cloudflare Worker configuration, CSP, release, market propagation, evidence and rollback plan.
- [../technical/hiscores-live-implementation-spec.md](../technical/hiscores-live-implementation-spec.md): accepted provider/privacy/runtime boundary plus remaining deployed Hiscores evidence.
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
- `.github/workflows/update-market-prices.yml` is the only GitHub Actions workflow in this checkout. D-066 uses Cloudflare Workers Builds, not another GitHub workflow, for optional production build/deploy when a future adopter connects an account.

## Local running

Rewrite scaffold commands:

```sh
npm run dev
npm run build
npm run preview
```

The Vite dev server serves the rewrite UI from the root `index.html`. Use `legacy/index.html` only for archived legacy reference work.

Run temporary scripts, local caches and generated helper files from inside this repository. Avoid `/tmp` or other external scratch paths for project work unless a human explicitly approves, because endpoint security on the user's work machine may flag those runs.

Decision: hiscores lookup and market price refresh are product features, not local-dev-only behavior. D-066 selects one Cloudflare Worker + Static Assets root deployment with automatic validated `master` releases. D-067 accepts repository handoff readiness without requiring the current maintainer to operate Cloudflare. Market price refresh is scheduled repo automation that writes static JSON files and uses no database.

Current hiscores run behavior:

- Vite dev and preview expose same-origin `GET /api/hiscores/status` and `GET /api/hiscores?player=...` through repo-owned middleware.
- Vite dev and preview inject the D-061 first-party 2004Scape JSON provider. The provider calls a fixed HTTPS origin server-side, rejects redirects, bounds the response, maps only skill types 1-7 and sanitizes provider failures.
- `src/server/cloudflare-worker.ts` injects the same provider for production, routes `/api/*` before SPA fallback, returns unknown API paths as sanitized JSON and adds no-store/security headers.
- `wrangler.jsonc` serves `dist` through Static Assets, enables provider preview URLs and disables Workers Logs observability plus Logpush under D-065.
- When the upstream is unavailable, the rewrite keeps the player-name input and manual Player level fields usable and shows the existing non-blocking service failure state.
- No runtime secret, account model, database or scheduled Hiscores job is configured. The bounded Cloudflare client address is used only as an ephemeral in-isolate rate-limit key.

Current market run behavior:

- Vite dev and preview expose same-origin `GET /api/market/status` and `POST /api/market/sync` through repo-owned middleware.
- The default market provider is disabled, so local runs show the disabled service state unless a test injects a provider.
- The rewrite UI keeps JSON price import available as the offline fallback.
- The rewrite UI stores selected imported or compatible legacy market prices in `index-sim:price-set:selected`. Generated Revision 274 alch values replace imported alch maps before use/persistence and again on restore. Reset clears only this selected key and returns to scheduled or bundled market prices.
- Economy loads committed `price-history.json` as read-only shared history and merges it in memory with capped local comparisons from `index-sim:price-history`. `Save local comparison` and `Clear local history` change only the local key; clearing it leaves shared history visible.
- The rewrite UI can export the currently active `PriceSet` as JSON that the same `PriceSet` import parser accepts.
- The Settings tab can show a rewrite-local state recovery view when a known rewrite-owned browser key is invalid or uses an unsupported version. The report exports metadata only: state labels, storage keys, status, expected/found versions and sanitized reasons. Per-key Clear and Clear invalid local data operate only on allowlisted rewrite-owned keys and do not remove legacy or unknown localStorage keys.
- The rewrite UI can detect known legacy browser storage keys and show an import/keep/clear choice. Import writes only rewrite-owned setup, hiscores last-player, selected active price set, accepted browser-local price-history snapshots and dismissed keys and keeps legacy keys. D-049 keeps full legacy price-history payloads review-only/not migrated for V1. Clear removes only known legacy keys after explicit user confirmation; no server cleanup, account context or tenant cleanup is involved.
- No secret, account model, database or server-managed mutable market history is configured. Public crawler policy and the full live dry-run are reviewed, and the Actions variable is configured as the exact approved `MARKET_PRICES_UPSTREAM_URL=https://markets.lostcity.rs/` root. A future operator verifies its first successful configured run before using scheduled-current release copy.

Accepted market price writer target:

- A scheduled repo automation fetches the approved `markets.lostcity.rs` data.
- It runs as GitHub Actions cron at 00:15 and 12:15 UTC.
- It writes latest item prices to `prices.json`.
- Generated game data owns high alch; the writer does not change `alch.json`.
- It retains 12-hour history for 90 days and one latest point per older UTC day in `price-history.json`.
- It validates the generated JSON and commits only when the files differ.
- It uses the repository `GITHUB_TOKEN` with `contents: write`, with no separate app token unless the default token is insufficient.
- It has no `workflow_dispatch` manual trigger.
- It avoids artifact upload and large caches by default.
- No browser, user action or production runtime request triggers upstream market fetches.
- Local writer: `--input` validates normalized fixture data; `--upstream-url https://markets.lostcity.rs/` derives one `/items/{slug}` request per approved mapping. Requests are sequential with 350 ms spacing and per-page redirect/timeout/size/content checks. The adapter accepts only the first ten completed buy/sell rows with one unambiguous coin-denominated unit price, skips item/mixed/multiple offers and drops usernames. A mapping-specific 404 is reported as skipped and retains its prior price; other HTTP/network/contract failures stop the run. MAD/median filtering, unweighted observations and freshness gates update prices or retain prior values. A mapping with neither usable trades nor an existing market price stays absent so the app's generated item-price fallback remains active. An all-retained run fails before write so stale values cannot receive a fresh capture timestamp. Candidates are validated before deterministic writes to only `prices.json` and `price-history.json`.
- Workflow: `.github/workflows/update-market-prices.yml` runs at 00:15 and 12:15 UTC, validates the two JSON outputs plus focused tests and `git diff --check`, rejects every other changed file and commits only real diffs. It has `contents: write`, no `workflow_dispatch`, no artifact upload and no broad secret requirement.

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
- Repository handoff/release gate: `npm run verify`.
- D-066 Cloudflare release gate: `npm run deploy:cloudflare:build`.
- Exact Wrangler preview upload: `npm run deploy:cloudflare:preview`.
- Exact Wrangler production deploy: `npm run deploy:cloudflare`.
- Both deploy commands rebuild/revalidate `dist` and pin Wrangler `4.109.0`; they cannot upload an unchecked artifact or float the CLI version.
- Artifact validation: `npm run deploy:verify-artifact` after a build.
- Deployed HTTPS smoke: `npm run deploy:smoke -- --origin <https-origin> --hiscores-mode enabled` after a Cloudflare preview exists.
- Cloudflare account/Git connection and deployed evidence are adopter operations under D-067; no custom domain is required for preview.

Accepted deployment handling:

- Keep `package.json` run/build/test scripts in sync with [../technical/testing.md](../technical/testing.md).
- Keep simulation/domain deployment static-first inside the one Cloudflare Worker + Static Assets release unit.
- Run the full repository gate before every production upload and use a Cloudflare version preview before the first public promotion.
- Add market price freshness through scheduled repo automation and static JSON artifacts, not through user-triggered production sync.
- Do not describe Hiscores as live-available until the Cloudflare runtime is deployed and evidenced. Do not describe market prices as scheduled-current unless the writer's latest configured run is validated.
- Cloudflare Workers Builds watches `master`; market bot commits follow the same validation/deploy path. Do not add a second deploy provider or GitHub deploy workflow without a new decision.

## Cloudflare hosting hardening

D-066 accepts the Cloudflare target. `public/_headers` configures static responses,
and the Worker applies the same security policy to API responses. The artifact gate
validates the file before upload; deployed smoke verifies effective responses.

Implemented headers:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

The current rewrite browser talks to same-origin live integration endpoints only, so static deployments should keep `connect-src 'self'` unless a separately accepted runtime requires more. If a future implementation adds browser-side upstream probes, tighten `connect-src` to the exact approved origins and document the source in [../project/decisions.md](../project/decisions.md). Do not add a database, user-triggered scraper or shared cloud state as part of deploy hardening.

The D-066 build profile is root-path only. `npm run deploy:verify-artifact` rejects inline scripts, external index assets, source maps, unexpected root files, non-hashed assets, symlinks, local absolute paths and common secret material; validates `_headers` plus all three market files; and emits a deterministic artifact checksum without writing release state. The current artifact has 7 files/2 hashed assets, 1,384,153 bytes and SHA-256 `a8bd9ee19cfa6c17ff659006cbde54e50ab846e2c93e276098fa2af35bf4d2ce`. `npm run deploy:smoke` validates route ordering, content types, cache classes, the headers above, market JSON and enabled Hiscores status without sending a player lookup. Cloudflare account connection, provider-side no-log verification, preview/production smoke and any custom domain are intentionally left to the operator of a concrete instance.

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
node -e "for (const f of ['prices.json','price-history.json']) JSON.parse(require('fs').readFileSync(f,'utf8'))"
```

The rewrite data layer can adapt current legacy runtime data into a validated `GameDataSnapshot`, including the browser sandbox bootstrap used by the Vite UI. It can validate `PriceSet` imports. In local runs where the market provider is disabled, the visible Market UI stays scheduled-only: no user-triggered refresh controls are shown, and the active scheduled/imported/bundled `PriceSet` summary, validated `PriceSet` import path, active `PriceSet` export and local-override reset controls remain available. This is not yet an authoritative game-data generation workflow.

Accepted workflow target: scheduled repo automation reads approved `markets.lostcity.rs/items/{slug}` pages and writes market prices plus static shared history. High alch comes from generated game data. The local writer validates both output files and skips unchanged writes; GitHub Actions commits only real diffs to `prices.json` and `price-history.json`. No database, backend-managed mutable history or user-triggered upstream refresh is accepted.

Current repository evidence: public crawler policy permits the accepted sequential reads, the bounded allowlist is catalog-audited and the full 2026-07-10 read-only dry-run passed with 69 updated plus 11 retained/skipped mappings. The exact root repository variable was configured and read back on 2026-07-10. The two earlier scheduled runs failed at the empty-variable guard before any upstream read. No successful configured run was observed at handoff, so a future operator must validate one before enabling scheduled-current claims. No raw page or username is committed.

### Scheduled market freshness evidence

The accepted shared market snapshot is the latest committed, schema-valid state of `prices.json` and `price-history.json`. Generated game data independently owns high alch. `_scraped_at` is capture time and the latest history entry is the matching retained shared point.

Use this local check to inspect the committed snapshot freshness without contacting the upstream:

```sh
node -e "const fs=require('fs'); const prices=JSON.parse(fs.readFileSync('prices.json','utf8')); const history=JSON.parse(fs.readFileSync('price-history.json','utf8')); const last=history.at(-1); console.log({pricesScrapedAt: new Date(prices._scraped_at*1000).toISOString(), lastHistoryAt: last ? new Date(last.t*1000).toISOString() : null, historySnapshots: history.length});"
git log -1 --format="%h %cI %s" -- prices.json price-history.json
```

For release notes or handoff notes, distinguish three facts:

- **Snapshot timestamp**: the `_scraped_at` timestamp in the committed `prices.json`.
- **Latest accepted file change**: the latest commit touching `prices.json` or `price-history.json`.
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

Ordinary install, verification, build and runtime use the committed generated
snapshot and do not need the raw source checkout. Only create the gitignored
checkout when reviewing a new game revision:

```sh
git clone --filter=blob:none https://github.com/LostCityRS/Content.git .sources/lostcity-content
SOURCE_COMMIT="$(node -p "JSON.parse(require('fs').readFileSync('src/data/generated/source-pin.json', 'utf8')).source.commit")"
git -C .sources/lostcity-content checkout --detach "$SOURCE_COMMIT"
git -C .sources/lostcity-content rev-parse HEAD
```

The final `rev-parse` value must equal `source.commit` in
`src/data/generated/source-pin.json` before reproducing the current snapshot.
For later revisions, fetch and review the intended upstream commit before
running the generator; the generator writes a new pin as part of the reviewed
change.

[LostCityRS/Content](https://github.com/LostCityRS/Content#license) states that
its source code uses the MIT License but its included assets are Jagex Ltd.
intellectual property and are not covered by that software license. Keep the
checkout gitignored, do not copy raw source bodies or assets into this
repository, and commit only the normalized outputs allowed below. This does not
license the retained `index-rs/index-sim` code or this repository as a whole;
public distribution still requires the separate rights decision recorded in
[the handoff specification](../project/handoff-hardening-spec.md#licensing-and-distribution-boundary).

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

The latest release-evidence check was refreshed through 2026-07-11 for the source-backed Revision 274 Vite/React runtime. Typecheck, 528 unit tests, 19 golden tests, build, D-066 artifact validation and tooling-hygiene gates pass. The complete production-preview Playwright gate is 58/58, and the D-071 generated-requirement/NPC-size focused paths pass 3/3 after sandbox-external localhost execution. Runtime readiness has zero blockers and the committed generator report passes 11/11 representative cases.

| Area                         | Status                            | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Operational follow-up                                                                                                                                                                                                                      |
| ---------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core commands                | `pass`                            | The D-071 refresh ran typecheck, full unit (34 files/528 tests), golden (19), build, artifact validation, lint, format and diff checks; all passed. The artifact covered 7 files/2 assets, 13 history snapshots, 1,435,627 bytes and SHA-256 `acb785ea914a29cacbe33a8514d8a5e7be9b69c412aebbb64db75942610c2f8c`. The build emitted only the known chunk-size warning.                                                                                                                                                                                                  | Re-run in Cloudflare Builds and before release.                                                                                                                                                                                            |
| Browser smoke                | `pass`                            | The complete production-preview gate passed 58/58. Focused D-071 checks passed Planner/setup generated requirement copy 2/2 and dragon-halberd size behavior 1/1; sandbox-external localhost permission was required.                                                                                                                                                                                                                                                                                                                                                  | Run functional and visual Playwright against the selected provider preview before production promotion.                                                                                                                                    |
| Tooling hygiene              | `pass`                            | `npm run lint` and `npm run format:check` pass after the dedicated cleanup. Generator-owned current snapshot JSON and revision-impact output remain excluded from Prettier so their deterministic generators, rather than a second formatter, own their serialized shape.                                                                                                                                                                                                                                                                                              | Keep both commands in release checks and keep generated-output formatting owned by the generators.                                                                                                                                         |
| Dependency audit             | `pass`                            | The 2026-07-10 `npm audit` reported 0 vulnerabilities.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Re-run after dependency changes.                                                                                                                                                                                                           |
| Security/static copy audit   | `pass with classified residuals`  | Static searches found trusted bundled legacy-data sandbox execution only in reference/regeneration paths, false-positive secret strings, a URL password-rejection guard, typed same-origin contract/test paths, archived legacy evidence and documentation/history. The root app bootstrap uses committed validated JSON through `src/adapters/generated`; `src/adapters/static-runtime` remains reference/rollback evidence.                                                                                                                                          | Continue classifying hits before release. Do not remove legacy evidence or add legacy `/api/*` shims without a future explicit legacy-runtime re-promotion decision.                                                                       |
| Production live integrations | `repository handoff ready`        | Market has its D-062-D-064 workflow, live dry-run, exact repository variable and adopter evidence checklist. Hiscores has the D-061 provider in Vite and the D-066 Cloudflare production Worker with D-065 configuration and deployment/smoke commands. D-067 leaves account ownership and environment evidence to the adopter.                                                                                                                                                                                                                                        | Do not describe live Hiscores or scheduled-current market prices as production-available until the concrete instance's deployed/writer evidence passes. Keep user-triggered upstream market refresh out of production copy.                |
| Deploy/security headers      | `Cloudflare implementation ready` | Node 22/npm 10, Worker-first API routing, Static Assets fallback, headers, disabled observability/Logpush and artifact validation are implemented. The current artifact passes with 7 files, 2 assets and checksum `acb785e…f8c`.                                                                                                                                                                                                                                                                                                                                      | Connect Cloudflare Builds to `master`, verify account log settings and run deployed smoke before promotion.                                                                                                                                |
| Generated data workflow      | `accepted active runtime`         | The UI bootstraps through `src/adapters/generated` from the committed Revision 274 snapshot, scheduled static prices and generated item fallbacks. The raw generator covers all expected identities, 63/63 core-loot tables, 63/63 NPC sizes and 94 numeric item requirements; readiness has zero blockers. The impact report passes 11/11 representative cases with accepted D-055/D-057/D-071 deltas and records 22 informational outliers. Legacy-derived snapshots remain regression/reference evidence; D-051 applies only to legacy or missing requirement rows. | Keep revision bumps manual and reviewed. Re-run generator, readiness, impact, golden/domain and browser checks when source data or visible behavior changes; do not add quest/clue rows or remove the fallback without separate decisions. |

## Trusted-tester handoff checklist, current app

For repository handoff or a trusted-tester build, use this checklist. It is intentionally lighter than operating a public instance or full CI/CD pipeline:

1. Confirm intended price snapshot date.
2. Run `npm ci` from a fresh checkout and then the authoritative `npm run verify` gate from [../technical/testing.md](../technical/testing.md).
3. Smoke test the main UI in a browser if possible.
4. Confirm no stale generated or local-only files are included accidentally.
5. Run the live integration release copy audit and classify any remaining `run_sim.py` or legacy `/api/*` hits.
6. Verify legacy migration/reset evidence: focused `src/tests/legacy-migration.test.ts` + `src/tests/ui-adapters.test.ts`, Playwright import/keep/clear smoke, and a feature-inventory check that the accepted V1 migration boundary is clear: compatible setup/cannon import can be complete while D-048 `sim_planner_v1` and D-049 full legacy price-history payloads remain review-only.
7. Write down known limitations for the tester, especially live hiscores/provider status, scheduled-price freshness and any browser-smoke evidence that could not be refreshed locally.
8. Update documentation if run, data or deployment steps changed.

A later adopter-operated public release still requires Cloudflare account connection, deployed
smoke evidence and release notes. A custom domain remains optional later work.

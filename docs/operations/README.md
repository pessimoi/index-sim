# Operations

## Related execution specifications

- [market-live-evidence-spec.md](market-live-evidence-spec.md): exact live response verification, fetch hardening, repository variable setup and first successful scheduled-run evidence.
- [public-deployment-spec.md](public-deployment-spec.md): D-066 Cloudflare Worker configuration, CSP, release, market propagation, evidence and rollback plan.
- [../technical/hiscores-live-implementation-spec.md](../technical/hiscores-live-implementation-spec.md): accepted provider/privacy/runtime boundary plus remaining deployed Hiscores evidence.
- [../project/worktree-delivery-spec.md](../project/worktree-delivery-spec.md): historical 2026-07-10/13 review, commit-grouping, validation and push evidence; it is not a plan for the current worktree.

## Current run state

The repo now uses the Vite/React rewrite as the root app path. The old CDN/Babel browser runtime is archived for reference.

Current verified facts:

- `README.md` states Revision 274 and identifies the committed price snapshot as captured on 16 July 2026. The machine-readable source of truth is `prices.json._scraped_at`, which matches `price-provenance.json.capturedAt`.
- `index.html` renders a non-empty `starting` shell, installs the DOM-only startup guard and then mounts `src/app/main.tsx` through Vite. The existing React branches replace that shell with canonical `starting`, `ready` or `error` state.
- `legacy/index.html` can load the old local scripts in script-tag order for reference and parity work.
- Archived legacy UI text mentions `python run_sim.py`, `/api/prices`, `/api/scrape` and `/api/hiscores`.
- The production rewrite UI uses service availability states for live integrations and must not instruct users to run `python run_sim.py`.
- `run_sim.py` is not present in this checkout.
- `.gitignore` excludes `deploy`, `simulator.zip`, `scrape_prices.py` and `backup`.
- No active GitHub Actions workflow exists. D-099 retains the hardened market writer template at `.github/disabled-workflows/update-market-prices.yml` because the current maintainer has no Actions capacity. D-066 uses Cloudflare Workers Builds, not a repository Actions workflow, for optional production build/deploy when a future adopter connects an account.

## Local running

Rewrite scaffold commands:

```sh
npm run dev
npm run dev:checked
npm run test:startup:dev
npm run build
npm run preview
```

The Vite dev server serves the rewrite UI from the root `index.html`. Raw
`npm run dev` is browser-independent and unverified: Vite's listening output
does not prove that React, the generated runtime and the initial workbench
rendered. `npm run dev:checked` owns agent handoff. It starts a strict-port Vite
child on `127.0.0.1:5173` by default, verifies a fresh Chromium navigation and
prints the user-facing URL only in its final `APP_READY` line. An explicit
bounded port override can be passed after `--`.

`npm run test:startup:dev` uses a separate strict test port, forces bounded Vite
dependency re-optimization, checks the normal `ready` path and a controlled
pre-React `error` path, verifies direct JSON/HEAD and transformed raw-module
price routes, then closes its browser and server. Both checked commands require
installed Playwright Chromium; when it is absent, use
`npx playwright install chromium` and rerun. They use committed data and do not
call a live Hiscores or market provider.

If the requested port is occupied, inspect the listener separately or choose an
explicit free port. The checked command never kills or silently reuses an
unknown process. On readiness failure it exits non-zero, prints bounded browser
and Vite diagnostics and reaps its managed child. A static `starting` shell
remains visible if the application entry cannot load; detectable entry or
bootstrap failures render fixed sanitized `error` copy instead of an empty
root.

Use `legacy/index.html` only for archived legacy reference work. The dev
configuration serves `planner.jsx` and `views.jsx` unchanged so the archive's
browser-side Babel path is not rewritten by Vite before it runs.

Run temporary scripts, local caches and generated helper files from inside this repository. Avoid `/tmp` or other external scratch paths for project work unless a human explicitly approves, because endpoint security on the user's work machine may flag those runs.

Decision: hiscores lookup and committed/imported market prices are product features, not local-dev-only behavior. D-066 selects one Cloudflare Worker + Static Assets root deployment with automatic validated `master` releases. D-067 accepts repository handoff readiness without requiring the current maintainer to operate Cloudflare. D-099 disables automatic market-price GitHub Actions execution for capacity while retaining the no-database writer and static JSON contract.

Current hiscores run behavior:

- Vite dev and preview expose same-origin `GET /api/hiscores/status` and `GET /api/hiscores?player=...` through repo-owned middleware.
- Vite dev and preview inject the D-061 first-party 2004Scape JSON provider. The provider calls a fixed HTTPS origin server-side, rejects redirects, bounds the response, maps only skill types 1-7 and sanitizes provider failures.
- `src/server/cloudflare-worker.ts` injects the same provider for production, routes `/api/*` before SPA fallback, returns unknown API paths as sanitized JSON and adds no-store/security headers.
- `wrangler.jsonc` serves `dist` through Static Assets, enables provider preview URLs, disables Workers Logs observability plus Logpush under D-065 and creates D-097's SQLite Durable Object binding/migration with global enforcement explicitly `off`.
- When the upstream is unavailable, the rewrite keeps the player-name input and manual Player level fields usable and shows the existing non-blocking service failure state.
- No runtime secret, account model, general database or scheduled Hiscores job is configured. The bounded Cloudflare client address is used only as an ephemeral in-isolate rate-limit key; D-097's disabled coordinator stores only aggregate provider-window state.
- Any future Cloudflare WAF abuse rule or activation of the implemented strict provider-wide budget follows the conditional [Hiscores distributed/global rate-limit specification](../technical/hiscores-global-rate-limit-spec.md).

Current market run behavior:

- Vite dev and preview expose same-origin `GET /api/market/status` and `POST /api/market/sync` through repo-owned middleware.
- The default market provider is disabled, so local runs show the disabled service state unless a test injects a provider.
- Automatic market upstream refresh is disabled under D-099, and the UI says so explicitly.
- The rewrite UI keeps JSON price import available as the offline fallback.
- The rewrite UI stores selected imported or compatible legacy market prices in `index-sim:price-set:selected`. Generated Revision 274 alch values replace imported alch maps before use/persistence and again on restore. Reset clears only this selected key and returns to scheduled or bundled market prices. A separate capped `index-sim:manual-price-overrides` overlay can replace individual active item prices without mutating the selected/scheduled/bundled base or generated alch values.
- Economy loads committed version-2 `price-history.json` as read-only shared history and merges it in memory with version-2 capped local comparisons from `index-sim:price-history`. Valid v1 local snapshots migrate with unknown per-item freshness. `Save local comparison` and `Clear local history` change only the local key.
- The rewrite UI can export the currently active `PriceSet` as JSON that the same `PriceSet` import parser accepts.
- The Settings tab can show a rewrite-local state recovery view when a known rewrite-owned browser key is invalid or uses an unsupported version. The report exports metadata only: state labels, storage keys, status, expected/found versions and sanitized reasons. Per-key Clear and Clear invalid local data operate only on allowlisted rewrite-owned keys and do not remove legacy or unknown localStorage keys.
- The rewrite UI can detect known legacy browser storage keys and show an import/keep/clear choice. Import writes only rewrite-owned setup, hiscores last-player, selected active price set, accepted browser-local price-history snapshots and dismissed keys and keeps legacy keys. D-049 keeps full legacy price-history payloads review-only/not migrated for V1. Clear removes only known legacy keys after explicit user confirmation; no server cleanup, account context or tenant cleanup is involved.
- No secret, account model, database or server-managed mutable market history is configured. Public crawler policy and the full live dry-run are reviewed. The previously configured `MARKET_PRICES_UPSTREAM_URL=https://markets.lostcity.rs/` variable does not trigger work while no active workflow exists. A future operator must explicitly restore the template and verify its first successful configured run before using scheduled-current release copy.

Retained market price writer target, currently disabled for automatic execution:

- The local writer can fetch the approved `markets.lostcity.rs` data only through an explicit operator command.
- The archived template would run as GitHub Actions cron at 00:15 and 12:15 UTC only after an explicit D-099 re-enable decision.
- It writes latest item prices to `prices.json`.
- It writes one validated item-level origin/freshness row per committed numeric price to `price-provenance.json`.
- Generated game data owns high alch; the writer does not change `alch.json`.
- It retains versioned 12-hour history for 90 days and one latest point per older UTC day in `price-history.json`, preserving sparse observed/retained evaluations.
- It validates the generated JSON and commits only when the files differ.
- It uses the repository `GITHUB_TOKEN` with `contents: write`, with no separate app token unless the default token is insufficient. Official checkout/setup actions are pinned to full commit SHAs, checkout does not persist credentials and the token is exposed only to the final commit/push step.
- It has no `workflow_dispatch` manual trigger.
- It avoids artifact upload and large caches by default.
- No browser, user action or production runtime request triggers upstream market fetches.
- Local writer: `--input` validates normalized fixture data; `--upstream-url https://markets.lostcity.rs/` derives one `/items/{slug}` request per approved mapping. Requests are sequential with 350 ms spacing and per-page redirect/timeout/size/content checks. The adapter accepts bounded completed coin-only trades and drops usernames. A mapping-specific 404 retains its prior value and value-establishing provenance while recording a bounded evaluation reason. A mapping with neither usable trades nor an existing price stays absent so runtime generated fallback remains explicit. An all-retained run fails before write. Prices, provenance and history candidates are all validated before deterministic three-file writes.
- Archived template: `.github/disabled-workflows/update-market-prices.yml` retains the reviewed 00:15/12:15 UTC schedule, validates `prices.json`, `price-provenance.json` and `price-history.json` plus focused tests and `git diff --check`, rejects every other changed file and commits only real three-file diffs. It has `contents: write`, no `workflow_dispatch`, no artifact upload and no broad secret requirement. `src/tests/workflow-security.test.ts` guards both the absence of active workflow YAML and the archived template's immutable pins, schedule-only trigger and delayed-write credential contract.

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
- Account-free Wrangler bundle/binding/migration check: `npm run deploy:cloudflare:dry-run`.
- Exact Wrangler preview upload: `npm run deploy:cloudflare:preview`.
- Exact Wrangler production deploy: `npm run deploy:cloudflare`.
- Dry-run, preview and production release commands rebuild/revalidate `dist` and use lockfile-pinned Wrangler `4.109.0` through Node 22; upload commands cannot publish an unchecked artifact or float the CLI version.
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

The current rewrite browser talks to same-origin live integration endpoints only, so static deployments should keep `connect-src 'self'` unless a separately accepted runtime requires more. If a future implementation adds browser-side upstream probes, tighten `connect-src` to the exact approved origins and document the source in [../project/decisions.md](../project/decisions.md). Do not add a general database, user-triggered scraper or shared cloud state as part of deploy hardening; D-097's aggregate provider-budget object is the only accepted narrow exception.

The [current security audit](../project/security-audit.md) found no critical or
high-severity issue. D-097 now provides a disabled strict aggregate Hiscores
provider budget; its open runtime risk is activation without an accepted quota,
D-065 account evidence or singleton load proof. The local limiter and any WAF
rule remain separate abuse controls. HSTS, CSP frame policy and concrete Cloudflare log/header evidence
remain adopter decisions and checks owned by
[public-deployment-spec.md](public-deployment-spec.md); do not silently promote
them into verified production facts.

The D-066 build profile is root-path only. `npm run deploy:verify-artifact` rejects inline scripts, external index assets, source maps, unexpected root files, non-hashed assets, symlinks, local absolute paths and common secret material; validates `_headers` plus all four market data files; verifies price/provenance capture time and key parity; enforces the D-098-rebased direct entry-JavaScript limits of 800,000 raw and 230,000 gzip bytes while retaining D-094's deferred-runtime boundary; and emits bounded entry/chunk metadata plus a deterministic artifact checksum without writing release state. `npm run deploy:smoke` applies the same logical-set checks over HTTPS. Total artifact byte count and checksum are build outputs, not durable documentation constants.

## Data and price maintenance

Known files:

- `prices.json`
- `price-provenance.json`
- `alch.json`
- `price-history.json`
- embedded price fallbacks in `gamedata.js`

Current validation:

```sh
npm run test -- src/tests/market-writer.test.ts
npm run test -- src/tests/data-economy.test.ts
npm run prices:write-scheduled -- --input src/tests/fixtures/market-writer/upstream-valid.json --item-ids lobster,rune_scimitar,dragon_bones --now 2026-07-08T00:15:00.000Z --dry-run
node -e "for (const f of ['prices.json','price-provenance.json','price-history.json']) JSON.parse(require('fs').readFileSync(f,'utf8'))"
```

The production Vite UI loads the committed source-backed `GameDataSnapshot` through a dynamic `src/adapters/generated` bootstrap import after rendering the existing loading state. The snapshot remains validated, required runtime truth; splitting stages parse/paint work and does not turn it into an optional or upstream-fetched asset. Run `npm run startup:measure` for paired local cold/warm app-startup evidence. It reports shell-ready and initial-active-pane-ready timing separately, with JavaScript request/transfer/decoded totals and requested paths at both checkpoints; Compare is the only initial pane family. Run `npm run worker:measure -- --runs 5` for the separate production calculation-worker startup/transfer/execution measurement; it builds and serves only the ignored `.worker-measurement-dist` harness and does not change `dist`. Both commands require local Chromium and localhost binding, and both produce workstation comparison evidence rather than universal latency SLAs. The legacy sandbox adapter remains reference/regression evidence and is not the root bootstrap. The data layer also validates `PriceSet` imports. In local runs where the market provider and automatic writer are disabled, the visible Market UI states that automatic refresh is disabled: no user-triggered refresh controls are shown, and the active committed/imported/bundled `PriceSet` summary, validated import/export paths, selected-PriceSet reset and per-item manual override/reset controls remain available. The authoritative revision-update workflow is the reviewed `npm run data:generate` path described below.

Retained writer target: the local command can read approved `markets.lostcity.rs/items/{slug}` pages and write numeric prices, item-level provenance and versioned shared history. High alch comes from generated game data. The writer validates all three outputs and skips unchanged writes. D-099 disables GitHub Actions execution; no database, backend-managed mutable history or user-triggered upstream refresh is accepted.

Current repository evidence: public crawler policy permits the accepted sequential reads. The original 80-row catalog-audited allowlist passed the full 2026-07-10 read-only dry-run with 69 updated plus 11 retained/skipped mappings. D-087's twelve identified additions passed a separate no-write parser dry-run on 2026-07-12 with eight updated plus four retained/skipped mappings; the ten unsupported species-specific unidentified herbs remain excluded. The exact root repository variable was configured and read back on 2026-07-10. No complete successful configured run for the current 92-row allowlist was observed at handoff, so a future operator must validate one before enabling scheduled-current claims. No raw page or username is committed.

### Scheduled market freshness evidence

The accepted shared market snapshot is the latest committed, schema-valid logical set of `prices.json`, `price-provenance.json` and version-2 `price-history.json`. Generated game data independently owns high alch. `_scraped_at` and `price-provenance.json.capturedAt` are matching artifact capture times, never blanket item observation times.

Use this local check to inspect the committed snapshot freshness without contacting the upstream:

```sh
node -e "const fs=require('fs'); const prices=JSON.parse(fs.readFileSync('prices.json','utf8')); const provenance=JSON.parse(fs.readFileSync('price-provenance.json','utf8')); const history=JSON.parse(fs.readFileSync('price-history.json','utf8')); const last=history.snapshots.at(-1); console.log({pricesCapturedAt:new Date(prices._scraped_at*1000).toISOString(),provenanceCapturedAt:provenance.capturedAt,lastHistoryAt:last?new Date(last.t*1000).toISOString():null,historySnapshots:history.snapshots.length});"
git log -1 --format="%h %cI %s" -- prices.json price-provenance.json price-history.json
```

For release notes or handoff notes, distinguish three facts:

- **Snapshot timestamp**: the `_scraped_at` timestamp in the committed `prices.json`.
- **Latest accepted file change**: the latest commit touching the three-file scheduled logical set.
- **Latest scheduled validation**: none while D-099 keeps the workflow disabled; after an explicit restore, this is the latest successful `Update market prices` run on the release branch.

The committed snapshot remains in place while automatic execution is disabled. If the archived workflow is explicitly restored, a failed run still leaves the previous committed snapshot in place because the writer builds and validates candidates before writing, and a no-op run exits successfully without a commit when generated text is unchanged.

Do not claim "scheduled-current" market prices while D-099 disables the workflow. Trusted-tester and release notes must say that the app uses the committed static price snapshot, local imports and bundled fallback. A later scheduled-current claim requires explicit workflow restoration and a successful run against the re-reviewed upstream URL.

Game revision updates are different from price refreshes. A new game revision must be handled as a reviewed development change through the accepted manual `npm run data:generate` workflow. The command validates repository-local source and output paths, parses the pinned raw LostCity config and RuneScript sources, writes schema-valid `src/data/generated/source-pin.json`, `src/data/generated/game-data.json` and `docs/project/revision-impact/current.md` outputs, runs the merge-blocking representative calculation-impact suite through `simulateFullSimulation` using scheduled static prices plus generated item fallbacks, and runs an informational all-monster scan with fixed simple melee/ranged/magic baselines. The active Revision 274 snapshot covers all expected runtime monster, item, weapon, ammo, spell and equipment identities plus 63/63 reviewed core-loot tables. Exact item/price keys win; D-058 keeps cut and uncut gem identities distinct and limits aliases to fallback lookup. D-059 makes the committed source-backed generated snapshot the root runtime. `npm run runtime:write-legacy-derived` remains a reference/regression snapshot writer, not the production bootstrap.

Run the direct raw-source audit and impact checks against the gitignored local checkout with:

```sh
npm run data:source-audit -- --source-dir .sources/lostcity-content --example-limit 10
npm run data:source-impact -- --source-dir .sources/lostcity-content --impact-outlier-limit 25
npm run data:source-impact -- --source-dir .sources/lostcity-content --loot-only --impact-outlier-limit 25
npm run data:source-impact -- --source-dir .sources/lostcity-content --equipment-only --impact-outlier-limit 25
npm run data:source-impact -- --source-dir .sources/lostcity-content --combat-catalog-only --impact-outlier-limit 25
```

These commands are read-only evidence paths for reviewing the same raw parser used by the generator. They must not write raw upstream payloads, absolute source paths or local checkout content into committed files. Under D-072, the current parser retains four quest-gated drops and 21 clue-scroll tertiary rows with typed eligibility while runtime valuation excludes them by default. Do not activate them without an exact reviewed player-state contract.

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
8. Run the focused validation commands from [the generated game data testing guide](../technical/testing/runtime-data-deployment.md#generated-game-data-tests), plus broader golden/parity checks when generated data or formulas change calculation outputs.
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

## Release validation ownership and public claim gates

[Technical testing](../technical/testing.md) owns the current required commands
and latest repository gate summary. Dated run counts, artifact hashes,
platform-specific browser/visual results and superseded failures belong in
[testing evidence](../project/testing-evidence.md). This operations guide does
not duplicate those mutable snapshots.

The repository is handoff-ready for its accepted Vite rewrite, generated
Revision 274 runtime, disabled-but-retained market writer, same-origin Hiscores provider
and Cloudflare Worker + Static Assets deployment shape. That repository state
does not prove a concrete public instance or scheduled-current market data.

| Area                        | Repository-owned state                                                                                                                                              | Adopter or release follow-up                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core release gate           | `npm run verify` and the D-066 artifact contract are implemented.                                                                                                   | Run the authoritative gate in Cloudflare Builds and before promotion; rerun dependency review after lockfile changes.                                                         |
| Browser and visual behavior | Functional and repository-local visual suites are implemented with mocked/same-origin fixtures.                                                                     | Run the functional suite and the applicable read-only visual comparison against the selected preview before production promotion.                                             |
| Security and headers        | Worker-first API routing, static fallback, security headers, immutable workflow action pins and bounded provider behavior are repository-owned.                     | Verify effective preview/production headers, account log/drain settings, abuse-control assumptions and rollback behavior before public claims.                                |
| Hiscores                    | D-061/D-065/D-066 implement the fixed provider, privacy boundary and production adapter; D-097 enforcement remains disabled.                                        | Connect the account, run deployed status/lookup smoke without retaining player queries and activate provider-wide limits only with accepted quota/load evidence.              |
| Market prices               | The D-062-D-064/D-085 writer, validated artifacts, offline/import fallback and hardened disabled template are implemented; D-099 leaves no active Actions workflow. | Restore the template only after accepting Actions capacity and current upstream policy, then validate the first configured run before describing prices as scheduled-current. |
| Generated game data         | The root consumes the committed source-backed snapshot; revision bumps have a manual generator, readiness and impact-review workflow.                               | Keep bumps reviewed and do not activate conditional loot, remove the requirement fallback or refresh accepted baselines without their separate decisions.                     |

Cloudflare connection, preview/production smoke, effective account settings,
rollback rehearsal and any future cron re-enablement/observation are claim gates
owned by an adopter. They are not missing repository implementation under D-067/D-099.

## Trusted-tester handoff checklist, current app

For repository handoff or a trusted-tester build, use this checklist. It is intentionally lighter than operating a public instance or full CI/CD pipeline:

1. Confirm intended price snapshot date.
2. Run `npm ci` from a fresh checkout and then the authoritative `npm run verify` gate from [../technical/testing.md](../technical/testing.md).
3. Smoke test the main UI in a browser if possible.
4. Confirm no stale generated or local-only files are included accidentally.
5. Run the live integration release copy audit and classify any remaining `run_sim.py` or legacy `/api/*` hits.
6. Verify legacy migration/reset evidence: focused `src/tests/legacy-migration-*.test.ts` + `src/tests/ui-adapters.test.ts`, Playwright import/keep/clear smoke, and a feature-inventory check that the accepted V1 migration boundary is clear: compatible setup/cannon import can be complete while D-048 `sim_planner_v1` and D-049 full legacy price-history payloads remain review-only.
7. Write down known limitations for the tester, especially live hiscores/provider status, scheduled-price freshness and any browser-smoke evidence that could not be refreshed locally.
8. Update documentation if run, data or deployment steps changed.

A later adopter-operated public release still requires Cloudflare account connection, deployed
smoke evidence and release notes. A custom domain remains optional later work.

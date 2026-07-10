# Scheduled market live-evidence specification

- Status: implementation-ready conditional operations work
- Date: 2026-07-10
- Owner: operations docs
- Source: conditional backlog work and accepted decisions D-021, D-033, D-034 and D-053
- Contract owner: [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md)
- Workflow: [../../.github/workflows/update-market-prices.yml](../../.github/workflows/update-market-prices.yml)

## Purpose

Verify the real `markets.lostcity.rs` response contract, safely configure the scheduled writer and collect evidence from its first successful GitHub Actions cron run. This work is required before the product or release notes claim that shared market prices are scheduled-current.

This specification does not change the accepted architecture: twice-daily GitHub Actions writes validated static JSON to the same repository, and browser users never trigger the upstream fetch.

## Feature-inventory check

`Market price sync` is `Valmis` in [feature-inventory.md](../product/feature-inventory.md) for the accepted visible workflow: scheduled-static status, imported-price fallback, explicit selected `PriceSet`, local history and sanitized failure behavior.

The remaining work is release/operations evidence, not a duplicate feature implementation. The feature status stays `Valmis`; only the allowed freshness claim changes after this specification passes.

## Existing implementation

The repository already has:

- `scripts/markets-lostcity-raw-adapter.ts` for fixture-evidenced raw response normalization
- `scripts/write-scheduled-market-prices.ts` for `--input`, `--upstream-url` and `--dry-run`
- validated candidate generation for `prices.json`, `alch.json` and `price-history.json`
- duplicate, unknown-item, canonical mapping and output validation gates
- one shared history entry per 12-hour UTC bucket
- no-op behavior when generated files are unchanged
- `.github/workflows/update-market-prices.yml` at 00:15 and 12:15 UTC
- same-repo commit-if-diff with `GITHUB_TOKEN` and `contents: write`
- a repository variable boundary named `MARKET_PRICES_UPSTREAM_URL`
- workflow guards that allow only the three approved market files to change

The repo does not yet have verified evidence for the exact live endpoint/shape, configured repository variable or first successful scheduled run.

## Preconditions

Before any live fetch:

1. verify the exact HTTPS endpoint path owned by `markets.lostcity.rs`
2. confirm the endpoint may be used by the twice-daily repository automation
3. confirm the response contains no credentials, player information or other data that must not enter the workflow
4. implement the fetch hardening requirements below
5. ensure the repository and target branch permit the workflow's same-repo commit with `GITHUB_TOKEN`

The endpoint variable is configuration, not a secret, but it must contain no username, password, token or signed query value.

## Required fetch hardening

These are newly observed code-level gaps, not changes to the accepted market architecture. Complete them before the first trusted live request or cron claim.

### Redirect boundary

The writer currently validates the initial URL origin, while platform `fetch` may follow redirects. Prevent a validated `markets.lostcity.rs` URL from redirecting the workflow to another origin.

Acceptable implementation:

- set `redirect: "error"`; or
- validate every redirect/final response URL against the exact approved HTTPS origin

Add focused tests for same-origin behavior, cross-origin redirect rejection and sanitized errors. Never log a redirect target containing credentials or query secrets.

### Timeout and pre-read size boundary

The adapter enforces the import byte policy after text is available, but the current network path can wait indefinitely or read the entire response first.

Add:

- an explicit bounded fetch timeout using `AbortSignal`
- early `Content-Length` rejection when the declared size exceeds the accepted one-megabyte import policy
- a bounded streaming read that aborts once the actual body crosses the same limit, including when `Content-Length` is absent or false
- sanitized timeout and oversized-response errors

The raw live body must remain memory-only and must never be written as an artifact, cache, log attachment or committed fixture by the workflow.

## Evidence phases

### Phase 1: Verify the live contract safely

Use an approved local or review environment after fetch hardening. Make one bounded request to the exact endpoint and record only:

- endpoint origin and reviewed path, with credentials/query secrets absent
- UTC timestamp
- HTTP status
- content type
- bounded byte count
- SHA-256 of the response body
- top-level shape category, such as object or array
- source row count
- mapped item, price, alch and history counts
- unknown, duplicate, missing and rejected counts
- parser/contract version or commit SHA

Do not commit or paste the raw response. Do not record local absolute paths. If a minimal fixture must change, create a hand-minimized or sanitized fixture and document why it represents the verified shape.

### Phase 2: Run a no-write live candidate check

With the exact reviewed endpoint:

```sh
npm run prices:write-scheduled -- --upstream-url "<verified markets.lostcity.rs endpoint>" --dry-run
```

The check must:

- produce no file write
- parse through the same raw adapter used by cron
- report sanitized candidate counts and warnings
- pass canonical item mapping and duplicate gates
- produce valid candidates for all three market files
- stay within the accepted response and timeout limits

Review differences against the committed market snapshots without accepting unexplained mass deletion, timestamp regression, implausible price distributions or unknown canonical identities.

### Phase 3: Configure repository automation

Set `MARKET_PRICES_UPSTREAM_URL` as a repository Actions variable only after the path is verified.

Configuration checks:

- value starts with the exact approved `https://markets.lostcity.rs` origin
- value has no credentials, fragment or secret query value
- workflow permissions remain only `contents: write`
- no `workflow_dispatch` trigger is added
- no broad secret, artifact upload or persistent cache is introduced
- branch protection and workflow-token policy permit the intended same-repo commit

Do not duplicate the URL in browser code or public runtime configuration.

### Phase 4: Observe the first scheduled run

Wait for the existing cron rather than adding a manual upstream-refresh trigger. For the first successful run, verify:

- the writer fetched the reviewed endpoint
- validation and focused tests passed
- only `prices.json`, `alch.json` and `price-history.json` changed, or the run correctly reported no diff
- any commit author/message matches the workflow contract
- `_scraped_at` and the history bucket reflect the accepted source time policy
- a changed run produced exactly one intended commit
- an unchanged run produced no empty commit
- logs contain no raw response, credentials, local paths or source-internal stack trace

If the first run fails, preserve the failure category and sanitized diagnostics. Do not weaken validation or bypass the same-repo file allowlist merely to obtain a green run.

### Phase 5: Promote the freshness claim

Update release evidence only after a successful scheduled run and market-file review. Record:

- workflow run URL/id and UTC completion time
- resulting market commit SHA, or explicit verified no-op result
- latest `_scraped_at` value
- generated file counts and retained history range
- focused checks run by the workflow
- known source limitations
- date by which freshness must be rechecked

Only then may product/operations copy say that prices are scheduled-current. If later runs fail or become stale, copy and status surfaces must fall back to dated/stale wording rather than retaining an unsupported current claim.

## Failure behavior

- Network, timeout, redirect, size, parser, mapping or validation failures produce no market-file write and no commit.
- Partial upstream data must not overwrite a previously valid complete snapshot unless an explicit reviewed policy permits that shape.
- Unknown item identities remain visible as bounded evidence; they are not silently assigned to a nearby item.
- Duplicate canonical identities remain a hard failure according to the existing generated-data policy.
- A no-diff run is successful evidence of freshness only when the live response and candidate validations completed.
- A workflow scheduling delay is distinct from source staleness and should be reported separately.
- Repeated failure must not trigger a browser, manual or production-server fallback fetch.

## Security and repository hygiene

- No auth, account, tenant, database, payment or admin behavior is added.
- The raw source body is never committed, uploaded or retained in workflow artifacts.
- The endpoint variable contains no secret; if the source later requires a credential, stop and reopen the security/operations decision boundary.
- Network requests are fixed to the approved HTTPS origin and protected against redirect-based SSRF.
- Response time and size are bounded before full parsing.
- Workflow permissions stay repository-content-only and file changes stay limited to the three market JSON files.
- Error output is sanitized and contains no raw body, token, absolute path or parser-internal dump.
- Generated-data workflow remains repository-local with deterministic source/output hygiene.

## Validation commands

Before configuring the variable:

```sh
npm run test -- src/tests/market-writer.test.ts src/tests/data-economy.test.ts src/tests/market-adapter.test.ts
npm run typecheck
git diff --check
```

After a candidate write in a controlled review branch, if one is intentionally performed:

```sh
node -e "JSON.parse(require('fs').readFileSync('prices.json','utf8')); JSON.parse(require('fs').readFileSync('alch.json','utf8')); JSON.parse(require('fs').readFileSync('price-history.json','utf8'))"
npm run test -- src/tests/market-writer.test.ts src/tests/data-economy.test.ts
git diff --check
```

Live checks are opt-in and must not run in the default unit suite. The GitHub cron remains the authority for the first scheduled-run evidence.

## Explicitly out of scope

- user-triggered, browser-triggered or `workflow_dispatch` refresh
- changing the accepted twice-daily schedule
- a database or shared server-managed price history
- provider-specific artifact storage
- user accounts, API keys or paid market access
- adding unknown/future items to make live parsing pass
- changing canonical item identities without source-backed review
- making live market evidence a retrospective blocker for the completed trusted-tester handoff
- choosing the later public deployment platform

## Acceptance checklist

- [ ] Exact endpoint and acceptable automated use verified
- [ ] Redirect, timeout and pre-read size hardening implemented and tested
- [ ] Sanitized live-contract evidence recorded without raw payload
- [ ] `--dry-run` succeeds against the verified endpoint with no writes
- [ ] Candidate counts and value changes reviewed
- [ ] Repository variable contains the exact safe endpoint and no secret
- [ ] First cron completes validation and changes only approved files, or produces a verified no-op
- [ ] Workflow logs and commit contain no sensitive/raw source material
- [ ] Freshness evidence records run, commit/no-op, `_scraped_at` and checks
- [ ] Scheduled-current copy is promoted only after the evidence passes
- [ ] Feature inventory remains `Valmis` because this closes operations evidence, not a missing visible workflow

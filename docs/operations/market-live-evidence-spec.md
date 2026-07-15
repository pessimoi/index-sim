# Scheduled market live-evidence specification

- Status: writer retained; automatic GitHub Actions execution disabled under D-099
- Date: 2026-07-10
- Owner: operations docs
- Source: conditional backlog work and accepted decisions D-021, D-033, D-034 and D-053
- Contract owner: [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md)
- Disabled workflow template: [../../.github/disabled-workflows/update-market-prices.yml](../../.github/disabled-workflows/update-market-prices.yml)

## Purpose

Verify the real `markets.lostcity.rs` response contract, preserve the hardened writer and define the evidence required if an adopter later restores GitHub Actions cron. The runtime and writer remain complete under D-067, while D-099 disables automatic execution because the current maintainer has no Actions capacity.

The retained architecture still permits twice-daily GitHub Actions to write validated static JSON to the same repository, but only after an explicit D-099 re-enable decision. Browser users never trigger the upstream fetch.

## Feature-inventory check

`Market price sync` is `Valmis` in [feature-inventory.md](../product/feature-inventory.md) for the accepted visible workflow: scheduled-static status, imported-price fallback, explicit selected `PriceSet`, local history and sanitized failure behavior.

The remaining checklist is adopter release/operations evidence, not a duplicate feature implementation or repository backlog. The feature status stays `Valmis`; only the allowed freshness claim changes after a specific deployment collects it.

## Existing implementation

The repository already has:

- `scripts/markets-lostcity-item-page-adapter.ts` for first-page Inertia `soldListings` parsing
- `scripts/write-scheduled-market-prices.ts` for `--input`, `--upstream-url` and `--dry-run`
- adaptive MAD/median filtering, 90/30-day freshness gates and prior-price retention
- validated candidate generation for `prices.json` and `price-history.json`; generated game data owns high alch
- duplicate, unknown-item, canonical mapping and output validation gates
- 12-hour shared history for 90 days plus one latest point per older UTC day
- no-op behavior when generated files are unchanged
- disabled `.github/disabled-workflows/update-market-prices.yml` template with retained 00:15 and 12:15 UTC cron
- same-repo commit-if-diff with `GITHUB_TOKEN` and `contents: write`
- a repository variable boundary named `MARKET_PRICES_UPSTREAM_URL`
- workflow guards that allow only the two approved market files to change
- fixed-origin fetch hardening with redirect rejection, one 15-second fetch/body timeout,
  HTML/JSON contract enforcement and a one-megabyte pre-parse response limit per item page

Bounded 2026-07-10 inspection established the item route pattern `/items/{slug}`, Inertia
component `items/show/page`, a ten-row first `soldListings` page and completed-row fields
`price`, `quantity`, `type`, `soldAt` and `offers`. Current rows use `price: null`; a single
offer containing one `coins` item carries the per-item GP amount. The adapter skips item
swaps, mixed offers and ambiguous multiple offers. Both buy and sell rows are realized
trades, and usernames are discarded at the adapter boundary. Public `robots.txt` currently
allows `/` for the general `User-agent: *` group and sets no crawl delay; this supports the
accepted sequential twice-daily read policy. Repository configuration and scheduled-run
evidence are tracked separately below.

Sanitized live evidence from 2026-07-10:

- the public item catalog resolved the bounded 80-item allowlist; 30 stale legacy slugs were corrected and ambiguous dragonhide/half-key identities were resolved from canonical source identities
- current completed rows use one coin-only offer for their per-item GP amount; item, mixed and ambiguous multiple offers are skipped
- the full `--dry-run` completed without writes and reported 69 updated plus 11 retained/skipped mappings
- candidate review found 9 new market prices and 52 changed existing prices; the largest relative delta was 33.6%, with no order-of-magnitude mapping/unit outlier
- the candidate diff remained limited to `prices.json` and `price-history.json`
- no raw page, username, session cookie or local absolute path was stored or committed

Bounded D-087 expansion evidence from 2026-07-12:

- twelve identified gem/mega and ultra-rare dependencies returned supported
  item pages; `rune_2h` resolves to `rune_2h_sword`
- all twelve passed the existing page-internal slug/parser contract in one
  no-write dry-run, which reported eight updated plus four retained/skipped
- the ten non-guam species-specific `unidentified_*` paths returned 404 and
  remain outside the allowlist instead of receiving guessed mappings
- the current allowlist therefore contains 92 rows, but a complete successful
  configured cron for all 92 remains future adopter evidence
- no response body, listing or username was stored or committed

Repository configuration evidence from 2026-07-10:

- at 20:36 UTC, the Actions variable readback returned exactly `MARKET_PRICES_UPSTREAM_URL=https://markets.lostcity.rs/`
- the value is a non-secret fixed root with no path suffix, credentials, query or fragment
- scheduled runs `29068486016` and `29101381705` occurred before configuration and failed at the explicit empty-variable guard before any upstream read or file write
- the newer failed run checked out `95aa0df`, which predates the final item-page/catalog/history hardening, so it must not be rerun or promoted as current evidence
- no successful configured cron had been observed at repository handoff; no manual dispatch or user-triggered refresh was added, and a future adopter verifies its own run before a scheduled-current claim

D-099 update from 2026-07-15: the current maintainer has no remaining GitHub
Actions capacity, so the hardened template moved to
`.github/disabled-workflows/update-market-prices.yml`. No active workflow or
cron exists. The historical configuration evidence above remains useful only
for a future explicit re-enable review.

## Preconditions

Before any live fetch:

1. accept sufficient GitHub Actions capacity and explicitly reopen D-099
2. keep the configured base exactly `https://markets.lostcity.rs/`; item paths are derived from the allowlist
3. recheck that public crawler policy still permits the sequential twice-daily item-page reads
4. confirm the response contains no credentials, player information or other data that must not enter the workflow
5. retain the completed fetch hardening requirements below
6. ensure the repository and target branch permit the workflow's same-repo commit with `GITHUB_TOKEN`

The endpoint variable is configuration, not a secret, but it must contain no username, password, token or signed query value.

## Required fetch hardening

These are code-level safety requirements, not changes to the accepted market architecture.
They are implemented in `scripts/write-scheduled-market-prices.ts` and covered by focused
mocked tests. Keep them in place for the first trusted live request and later cron runs.

### Redirect boundary

The writer validates the initial URL origin and sets `redirect: "error"`, so a validated
`markets.lostcity.rs` URL cannot silently redirect the workflow to another origin.

Focused tests cover approved-origin success, redirect/fetch rejection, fragment and
credential rejection, and sanitized errors. A redirect target containing credentials or
query secrets is never included in the surfaced error.

### Timeout and pre-read size boundary

The network path now enforces:

- one 15-second `AbortSignal` timeout spanning fetch and response-body consumption
- early `Content-Length` rejection when the declared size exceeds the accepted one-megabyte import policy
- a bounded streaming read that aborts once the actual body crosses the same limit, including when `Content-Length` is absent or false
- HTML/JSON content-type validation before Inertia parsing
- mapping-specific 404 retention with allowlisted item-id diagnostics
- an all-retained hard gate that prevents stale values from receiving a fresh capture timestamp
- sanitized timeout, stream, non-404 HTTP, unsupported-contract and oversized-response errors

The raw live body must remain memory-only and must never be written as an artifact, cache, log attachment or committed fixture by the workflow.

## Evidence phases

### Phase 1: Verify the live contract safely

Use an approved local or review environment after fetch hardening. Review bounded item-page requests and record only:

- fixed origin and reviewed `/items/{slug}` path pattern, with credentials/query secrets absent
- UTC timestamp
- HTTP status
- content type
- bounded byte count
- SHA-256 of the response body
- top-level shape category, such as object or array
- completed row count and buy/sell counts
- mapped item, accepted/rejected observation and retained-price counts
- unknown, duplicate, missing and rejected counts
- parser/contract version or commit SHA

Do not commit or paste the raw response. Do not record local absolute paths. If a minimal fixture must change, create a hand-minimized or sanitized fixture and document why it represents the verified shape.

### Phase 2: Run a no-write live candidate check

With the exact reviewed root:

```sh
npm run prices:write-scheduled -- --upstream-url "https://markets.lostcity.rs/" --dry-run
```

The check must:

- produce no file write
- parse every allowlisted first-page response through the same item-page adapter used by cron
- report sanitized candidate counts and warnings
- pass canonical item mapping and duplicate gates
- produce valid candidates for both market files without changing `alch.json`
- stay within the accepted response and timeout limits

Review differences against the committed market snapshots without accepting unexplained mass deletion, timestamp regression, implausible price distributions or unknown canonical identities.

### Phase 3: Explicitly restore repository automation

Move the retained template back under `.github/workflows` only after D-099 is
explicitly reopened. Set or reconfirm `MARKET_PRICES_UPSTREAM_URL` as a
repository Actions variable only after the path is verified.

Configuration checks:

- value is exactly `https://markets.lostcity.rs/`
- value has no path suffix, credentials, query or fragment
- workflow permissions remain only `contents: write`
- no `workflow_dispatch` trigger is added
- no broad secret, artifact upload or persistent cache is introduced
- branch protection and workflow-token policy permit the intended same-repo commit

Do not duplicate the URL in browser code or public runtime configuration.

Historical 2026-07-10 evidence: repository-variable readback matched the exact
approved root. The retained template still has only scheduled triggers and
`contents: write` permission. D-085 later expanded its changed-file allowlist
to the validated `prices.json`, `price-provenance.json` and
`price-history.json` logical set. D-099 supersedes its active configuration;
future restoration must revalidate these facts.

### Phase 4: Adopter observes the first scheduled run

After explicitly restoring the template, wait for its cron rather than adding
a manual upstream-refresh trigger. For the first successful run, verify:

- the writer fetched one first page per approved mapping sequentially
- validation and focused tests passed
- only `prices.json` and `price-history.json` changed, or the run correctly reported no diff
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

Only then may product/operations copy say that prices are scheduled-current.
While D-099 remains active, copy must say automatic refresh is disabled. If a
restored schedule later fails or becomes stale, copy and status surfaces must
fall back to dated/stale wording rather than retaining an unsupported current
claim.

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
- Workflow permissions stay repository-content-only and file changes stay limited to the two market JSON files.
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
node -e "JSON.parse(require('fs').readFileSync('prices.json','utf8')); JSON.parse(require('fs').readFileSync('price-history.json','utf8'))"
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

- [x] Item-page path and Inertia response shape verified with bounded metadata-only evidence
- [x] Public crawler policy reviewed for the accepted sequential automated use
- [x] Redirect, timeout, content-type and pre-read size hardening implemented and tested
- [x] Sanitized live-contract evidence recorded without raw payload
- [x] `--dry-run` succeeds against the verified endpoint with no writes
- [x] Candidate counts and value changes reviewed
- [x] Repository variable contains the exact safe endpoint and no secret
- [ ] First cron completes validation and changes only approved files, or produces a verified no-op
- [ ] Workflow logs and commit contain no sensitive/raw source material
- [ ] Freshness evidence records run, commit/no-op, `_scraped_at` and checks
- [ ] Scheduled-current copy is promoted only after the evidence passes
- [x] Feature inventory remains `Valmis` because this closes operations evidence, not a missing visible workflow

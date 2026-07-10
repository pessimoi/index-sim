# Public deployment specification

- Status: repository handoff ready; adopter deployment checklist not executed
- Date: 2026-07-11
- Owner: operations docs
- Source: conditional public-release and deploy-hardening backlog work
- Related documents: [README.md](README.md), [../technical/architecture.md](../technical/architecture.md), [../technical/testing.md](../technical/testing.md), [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md), [../technical/hiscores-live-implementation-spec.md](../technical/hiscores-live-implementation-spec.md)

## Purpose

Define the D-066 Cloudflare runbook a future adopter can use to deploy the Vite rewrite publicly with reproducible build, security headers, same-origin Hiscores routing, release evidence and rollback. A provider-assigned version/production URL is sufficient; a real domain remains optional.

This is an adopter operations/release runbook. D-067 does not require the current maintainer to create an account or operate an instance, and unchecked environment evidence below is not repository backlog.

## Current boundary

The repository currently has:

- a root Vite/React application built with `npm run build`
- static runtime data emitted to `dist`, including the three market JSON files
- local `npm run dev` and `npm run preview` commands
- same-origin Hiscores middleware with the D-061 provider in local dev/preview plus the D-066 Cloudflare Worker production entrypoint
- a narrow scheduled market-price workflow, not a general CI/CD pipeline
- Node 22/npm 10 alignment through `.nvmrc`, package engines and the current workflow
- `npm run deploy:verify-artifact` for deterministic root-path artifact, market-contract and hygiene checks
- `npm run deploy:smoke` for bounded provider-preview HTTPS route/header/cache/status checks
- exact Cloudflare Worker build/preview/deploy commands, `wrangler.jsonc` and static `_headers`; account ownership and any custom domain belong to the adopter
- no database, auth, account, tenant, payment or admin service

`npm run preview` is a local build-verification server and must not be used as the public production server.

## Accepted deployment decisions

D-066 accepts one Cloudflare Worker + Static Assets release unit, root-path URLs,
provider preview URLs before a custom domain and automatic deployment of validated
`master` commits. The Git commit SHA remains the minimum release identifier.

### Hosting and runtime

The selected Cloudflare target provides:

- immutable static asset hosting for the Vite build
- root document and SPA fallback control
- same-origin function, edge or server routing for live Hiscores
- server-only environment/configuration values
- response headers per route class
- deployment from an immutable commit/artifact
- access-log query redaction or an accepted retention policy
- immediate rollback to a known-good release

The repository entrypoint is `src/server/cloudflare-worker.ts`. `wrangler.jsonc`
routes `/api/*` Worker-first and serves `dist` through the `ASSETS` binding with
SPA fallback. Unknown API paths return sanitized JSON 404 responses before asset
fallback.

### Public URL shape

D-066 accepts the root path. Current Vite asset URLs, static price paths,
same-origin API paths and permalink tests align with it. A later sub-path change
requires a new decision, Vite `base`, route-prefix/shareable-link changes and
browser coverage.

The real domain may be selected later. A provider-assigned preview domain is sufficient for pre-production validation if it has the same HTTPS, routing and header behavior.

### Hiscores release state

D-066 targets enabled production Hiscores under
[hiscores-live-implementation-spec.md](../technical/hiscores-live-implementation-spec.md).
Manual level fallback remains available for upstream/runtime failures.

Do not describe Hiscores as live when only Vite middleware or a disabled provider exists.

### Deployment trigger policy

D-066 accepts automatic Workers Builds deployment for every validated `master`
commit, including market bot commits. This preserves the repository-static price
model. Cloudflare account setup must use the repository-owned build/deploy commands
below; it must not bypass the validation gate.

### Logs and player names

`wrangler.jsonc` explicitly disables Workers Logs observability and Logpush. The
Worker contains no `console` telemetry and persists no request data. The bounded
`CF-Connecting-IP` value is used only as an ephemeral in-isolate rate-limit key.
Before public traffic, verify the deployed settings still show observability off
and no Tail Worker, Logpush job or external log drain captures request URLs. See
[hiscores-live-implementation-spec.md](../technical/hiscores-live-implementation-spec.md).

### Release identifier and ownership

Decide who may promote and roll back public releases and whether a stable production environment requires approval.

Recommendation: use the Git commit SHA as the minimum immutable release identifier. Do not invent semantic-version or tag policy solely for the first deployment.

## Target request topology

```text
Public HTTPS origin
  /                         -> current index document
  /assets/<hash>.*          -> immutable Vite assets
  /prices.json              -> scheduled static market data
  /alch.json                -> compatibility/regression alch artifact (not runtime authority)
  /price-history.json       -> scheduled static shared history
  /api/hiscores/status      -> same-origin runtime, if enabled
  /api/hiscores             -> same-origin runtime, if enabled
  other application routes  -> SPA fallback after API/static routing
```

API routes must be resolved before SPA fallback so an unavailable endpoint cannot return `index.html` with a misleading 200 response.

## Build artifact contract

The deployment artifact is the output of a clean checkout at one commit:

```sh
npm ci
npm run build
npm run deploy:verify-artifact
```

Requirements:

- Node/npm versions are pinned or documented consistently with the repository lockfile and workflow runtime.
- Build uses no client-exposed secret.
- The deployed artifact contains `index.html`, hashed application assets and the expected static market files.
- Generated source snapshots and fallback data match the committed revision.
- No raw upstream dump, local absolute path, `.env`, token, test artifact or development-only cache enters `dist`.
- Source maps remain disabled unless a later explicit observability/privacy decision enables protected maps.
- The release records commit SHA, build command, environment and artifact checksum or provider deployment id.

The implemented artifact verifier reports the artifact SHA-256, file/asset
counts, total bytes, market timestamp and retained history count. It rejects
unexpected root files, non-hashed assets, source maps, symlinks, local absolute
paths and common secret material without printing file contents. It currently
enforces the repository's root-path build shape; choosing a sub-path still
requires the decision and implementation described above.

If a provider builds remotely, its build must be reproducible from the same commit and lockfile. Provider-generated changes must not be written back to the source branch.

## Route, cache and header contract

### Cache policy

| Route class                   | Required starting policy                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `index.html` and SPA fallback | no-cache or short revalidation so rollback/release changes become visible          |
| hashed `/assets/*`            | long-lived immutable cache                                                         |
| market JSON files             | revalidate/no-cache; never immutable because filenames are stable                  |
| Hiscores status and lookup    | `Cache-Control: no-store` unless a later status-only policy is explicitly accepted |
| error responses               | no-store where they may contain request-specific state                             |

Do not let a CDN cache player-specific Hiscores results.

### Security headers

Use the provider-specific syntax to implement and verify at least:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

Adjust only with evidence from the built application. Do not add broad wildcard origins, `unsafe-eval` or third-party script hosts merely to make deployment pass.

Add HSTS only after HTTPS/domain behavior, include-subdomain scope and rollback implications are accepted. Frame policy may use CSP `frame-ancestors` after the product embedding requirement is explicitly decided.

## Release pipeline requirements

The selected implementation may use the hosting provider's native build integration or a repo-owned deploy workflow. In either case, it must expose these stages:

1. checkout an immutable commit
2. install from the lockfile
3. run the release validation gate
4. build the artifact
5. deploy to a non-production/preview environment
6. run deployment smoke checks
7. promote the exact tested artifact or commit
8. run production smoke and record evidence

Do not rebuild different source during promotion if the provider can promote an already-tested artifact.

Minimum pre-deploy gate:

```sh
npm run typecheck
npm run test
npm run test:golden
npm run build
npm run deploy:verify-artifact
npm run lint
npm run format:check
npm audit
git diff --check
```

Run functional and visual Playwright gates in a compatible environment before production promotion:

```sh
npm run test:e2e
npm run test:e2e:visual
```

If visual baselines are platform-specific, use the reviewed baseline platform or explicitly record why a different environment cannot act as the visual authority.

## Cloudflare Builds configuration

Connect the Cloudflare Worker project with these exact settings:

| Setting                       | Value                               |
| ----------------------------- | ----------------------------------- |
| Worker name                   | `index-sim`                         |
| Git repository                | `pessimoi/index-sim`                |
| Production branch             | `master`                            |
| Root directory                | repository root                     |
| Build command                 | `npm run deploy:cloudflare:build`   |
| Deploy command                | `npm run deploy:cloudflare`         |
| Non-production deploy command | `npm run deploy:cloudflare:preview` |
| Runtime variables/secrets     | none                                |

The deploy commands rebuild and revalidate `dist`, then fetch exact Wrangler
`4.109.0`; they do not float to the latest release. `wrangler.jsonc` owns the Worker name, current compatibility
date, static binding, Worker-first API routes, SPA fallback, preview URLs and
disabled observability/Logpush. Cloudflare's account connection and generated
build token remain provider-managed and must not enter this repository.

## Deployment smoke checks

The HTTP smoke is implemented and can be run after a Cloudflare preview
origin exists:

```sh
npm run deploy:smoke -- --origin "https://<preview-origin>" --hiscores-mode absent
```

The origin must be a credential-free HTTPS origin root. `absent` requires the
Hiscores status route to be non-successful, `disabled` requires a validated
`available: false` response and `enabled` requires `available: true`. Enabled
mode validates status only: the command never sends a player name, because the
lookup smoke remains gated by the production access-log policy.

Against preview and production, verify:

- `/` returns the intended release and application shell
- all referenced hashed assets load with correct content types
- `prices.json` and `price-history.json` parse as active market artifacts; compatibility `alch.json` also parses but does not override generated runtime alch
- hard refresh and a representative SPA/fallback path do not 404
- shareable setup fragments open to review without a server round trip or fragment leakage
- required CSP and security headers are present on representative routes
- stable JSON/static files have the intended cache headers
- unknown `/api/*` routes do not return the SPA document as success
- `/api/hiscores/status` truthfully reports enabled, disabled or unavailable according to the selected release state
- a sanitized Hiscores lookup smoke passes only if live Hiscores was accepted and configured
- browser console and network logs contain no unexpected mixed-content, CSP or asset-path failures
- desktop and mobile primary workflows remain usable

Use a provider preview URL for the first full pass. Production validation should be read-only except for the same browser-local state the app normally owns.

## Market freshness in deployment

Public freshness is the intersection of two facts:

1. the scheduled market writer has current successful evidence
2. the public deployment contains the corresponding commit or equivalent accepted artifact

Record both the market commit and deployed release SHA. A successful market cron alone does not prove the public site serves that snapshot.

If deployment intentionally lags market commits, UI/release wording must use the timestamp actually deployed. Do not infer public freshness from repository state alone.

## Rollout plan

### Stage 1: Provider preview

- connect the repository and upload the selected commit to a Cloudflare version preview URL
- verify artifact, paths, headers, caches and browser tests
- verify Workers Logs observability and Logpush remain disabled, then validate enabled Hiscores status and one bounded browser lookup without retaining request data

### Stage 2: Limited public release

- promote the exact tested artifact/commit
- announce only capabilities supported by the selected Hiscores and market evidence state
- monitor availability, asset/API errors and CSP violations without collecting player names or local setup data

### Stage 3: Stable operations

- confirm market bot commits follow the accepted deploy trigger policy
- rehearse rollback to the prior known-good release
- define review cadence for dependency audit, market freshness and provider/runtime health
- update operations docs with provider-specific commands and ownership

## Rollback

Rollback target: the immediately preceding known-good Cloudflare Worker version,
which includes Worker code, static assets, bindings and compatibility settings.

Requirements:

- provider supports promoting/redeploying that exact target without source-history rewrite
- no database migration or server state is required to restore the application
- rollback restores matching static assets and market JSON from one coherent release
- Hiscores can be disabled independently when its provider fails, while manual levels remain usable
- after rollback, repeat root/assets/market/header/Hiscores-status smoke checks
- record incident time, failed release SHA, rollback release SHA and sanitized reason

Do not use force push as deployment rollback. A source correction after a bad release should be a reviewed revert or fix-forward commit.

## Security, privacy and tenant review

- No authentication, account, tenant, database, payment or admin system is introduced.
- No tenant data exists and there is no tenant-isolation change.
- Browser-local setups, collections, history and player name remain local; deployment must not add telemetry for their contents.
- Server-side configuration stays outside the client bundle and repository.
- Hiscores upstream requests remain allowlisted and same-origin to the browser.
- Workers Logs observability, invocation logs, Logpush, Tail Workers and external drains remain disabled for the Hiscores Worker unless a later policy-compliant telemetry decision replaces D-066's no-collection configuration.
- CSP and static response headers are verified on the deployed host, not merely documented.
- Build/deploy credentials use least privilege and are never available to pull-request browser code.
- Public release does not expose raw generated sources, local paths, workflow tokens or provider errors.

## Delivery goals

### Goal 1: Accept deployment decisions

- D-066 accepts Cloudflare Workers + Static Assets, root-path URLs, enabled Hiscores and automatic validated `master` deployment
- D-066 records the decision in `docs/project/decisions.md`
- Git SHA plus Cloudflare version id identify a release; the repository owner controls promotion and rollback until a later ownership decision

### Goal 2: Add provider configuration

- implemented exact build/deploy commands, artifact directory, API-first routing, SPA fallback, cache and headers
- implemented the server-only LostCity provider without runtime secrets
- preview URLs and production branch deploy the same root-path contract; custom domain remains later
- provider-specific files are limited to the Worker entrypoint, Wrangler config and static header file

### Goal 3: Implement release validation (complete)

- implemented Cloudflare-aware artifact validation and focused tests
- implemented bounded post-deploy HTTP smoke for routes, caches, headers, market files, API fallback and Hiscores status mode
- full quality gate is encoded in `npm run deploy:cloudflare:build`; immutable preview execution is an adopter environment check

### Goal 4: Adopter production activation

- promote and verify the tested release
- confirm market commit propagation under the accepted trigger policy
- run and record rollback rehearsal
- update operations, testing, architecture, backlog and release evidence

## Explicitly out of scope

- selecting a custom domain or changing the accepted Cloudflare provider
- adding auth, accounts, database, payments, admin or tenant infrastructure
- analytics, advertising, public setup discovery or user tracking
- user-triggered market refresh
- adding Cloudflare KV, D1, Durable Objects, Queues, R2 or other stateful provider services
- adding a backend for simulation calculations
- deleting the archived legacy implementation
- claiming full legacy parity or legacy deletion readiness
- adding HSTS before domain/HTTPS policy is accepted

## Acceptance checklist

Repository-owned items are checked. Remaining items are intentionally performed by
the operator of a concrete public instance and do not represent unfinished project
implementation under D-067.

- [x] Host/runtime, URL shape, Hiscores release state and deploy trigger are accepted under D-066
- [x] Current root-path build passes the reproducible artifact hygiene/schema/checksum gate
- [x] Route order prevents SPA fallback from masking API failures in config and focused Worker tests
- [x] Cache policy distinguishes index, hashed assets, market JSON and player API responses in `_headers`/Worker tests
- [ ] CSP and security headers are verified on preview and production
- [ ] Release gate and browser smokes pass for the exact promoted artifact
- [ ] Hiscores status and copy match the actual configured production state
- [ ] Deployed market snapshot is tied to both market and release commits
- [ ] Access logs do not violate the accepted player-name policy
- [ ] Rollback to a known-good release is rehearsed without history rewrite
- [ ] Operations and release evidence identify owner, release SHA and remaining limitations

# Public deployment specification

- Status: provider-neutral validation implemented; deployment blocked on host/runtime decisions
- Date: 2026-07-10
- Owner: operations docs
- Source: conditional public-release and deploy-hardening backlog work
- Related documents: [README.md](README.md), [../technical/architecture.md](../technical/architecture.md), [../technical/testing.md](../technical/testing.md), [../technical/live-integrations-spec.md](../technical/live-integrations-spec.md), [../technical/hiscores-live-implementation-spec.md](../technical/hiscores-live-implementation-spec.md)

## Purpose

Define the provider-neutral work needed to deploy the Vite rewrite publicly with reproducible build, security headers, same-origin live-integration routing, release evidence and rollback. The specification is intentionally ready before a real domain exists, but deployment cannot begin until the decision packet below is accepted.

This is operations/release work. It does not add a user-facing feature or change feature-inventory statuses by itself.

## Current boundary

The repository currently has:

- a root Vite/React application built with `npm run build`
- static runtime data emitted to `dist`, including the three market JSON files
- local `npm run dev` and `npm run preview` commands
- same-origin Hiscores middleware with the D-061 provider in local dev/preview, but no production runtime
- a narrow scheduled market-price workflow, not a general CI/CD pipeline
- Node 22/npm 10 alignment through `.nvmrc`, package engines and the current workflow
- `npm run deploy:verify-artifact` for deterministic root-path artifact, market-contract and hygiene checks
- `npm run deploy:smoke` for bounded provider-preview HTTPS route/header/cache/status checks
- no deploy script, public hosting configuration or accepted public domain
- no database, auth, account, tenant, payment or admin service

`npm run preview` is a local build-verification server and must not be used as the public production server.

## Decision packet

The following choices require explicit acceptance. This specification does not record any of them as accepted decisions.

### Hosting and runtime

Choose a platform that can provide:

- immutable static asset hosting for the Vite build
- root document and SPA fallback control
- same-origin function, edge or server routing for live Hiscores
- server-only environment/configuration values
- response headers per route class
- deployment from an immutable commit/artifact
- access-log query redaction or an accepted retention policy
- immediate rollback to a known-good release

Recommendation: prefer one host that serves both static files and the same-origin Hiscores function. This minimizes CORS, cookie, routing and operational boundaries. The recommendation does not select a vendor.

### Public URL shape

Decide whether the application is deployed at an origin root or under a sub-path.

Recommendation: use a root-path V1 deployment. Current Vite asset URLs, static price paths, same-origin API paths and permalink tests are naturally aligned with it. A sub-path deployment requires an accepted Vite `base`, route-prefix and shareable-link contract plus browser coverage before release.

The real domain may be selected later. A provider-assigned preview domain is sufficient for pre-production validation if it has the same HTTPS, routing and header behavior.

### Hiscores release state

Choose one of these explicit release claims:

1. public core application with Hiscores disabled and manual level fallback
2. public core application with production Hiscores completed under [hiscores-live-implementation-spec.md](../technical/hiscores-live-implementation-spec.md)

Do not describe Hiscores as live when only Vite middleware or a disabled provider exists.

### Deployment trigger policy

Decide how commits made by the scheduled market workflow reach the public site:

1. automatically deploy every accepted `master` commit, including market bot commits
2. use a provider-specific market artifact/update path
3. deploy only curated releases

Recommendation: after the market workflow has passed [market-live-evidence-spec.md](market-live-evidence-spec.md), automatically deploy validated `master` commits. It preserves the accepted repository-static price model with the least extra coupling.

Curated-release-only deployment is valid, but it cannot support a twice-daily scheduled-current public claim unless releases occur with equivalent freshness. A provider-specific artifact path is new architecture and requires separate review.

### Logs and player names

If live Hiscores is enabled, enforce D-065 before public traffic: strip query strings or redact `player`, do not persist player names/raw URLs/bodies/headers/IPs/upstream payloads in application telemetry, and keep unavoidable provider metadata for at most seven days with operator-only access. See [hiscores-live-implementation-spec.md](../technical/hiscores-live-implementation-spec.md). Static-only deployment with Hiscores disabled does not remove the need to avoid logging secrets or unsafe query data elsewhere.

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

## Deployment smoke checks

The provider-neutral HTTP smoke is implemented and can be run after a preview
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

- deploy the selected commit to a non-public or hard-to-discover preview URL
- verify artifact, paths, headers, caches and browser tests
- keep Hiscores disabled unless its production runtime is ready in the preview environment

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

Rollback target: the immediately preceding known-good immutable commit/artifact.

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
- Access logs redact player query values or follow an explicitly accepted retention policy.
- CSP and static response headers are verified on the deployed host, not merely documented.
- Build/deploy credentials use least privilege and are never available to pull-request browser code.
- Public release does not expose raw generated sources, local paths, workflow tokens or provider errors.

## Delivery goals

### Goal 1: Accept deployment decisions

- choose host/runtime, root or sub-path, public Hiscores state and deploy trigger; verify the host can enforce D-065
- record only accepted decisions in `docs/project/decisions.md`
- define release and rollback ownership

### Goal 2: Add provider configuration

- encode build command, artifact directory, routing, cache and headers
- add server-only runtime configuration for Hiscores only if enabled
- document preview and production environment differences
- keep provider-specific files narrowly scoped

### Goal 3: Implement release validation

- implemented provider-neutral artifact validation and focused tests
- implemented bounded post-deploy HTTP smoke for routes, caches, headers, market files, API fallback and Hiscores status mode
- still requires the selected provider path to connect the full quality gate, deploy an immutable preview and prevent failed promotion

### Goal 4: Validate and hand over production

- promote and verify the tested release
- confirm market commit propagation under the accepted trigger policy
- run and record rollback rehearsal
- update operations, testing, architecture, backlog and release evidence

## Explicitly out of scope

- selecting a host, domain or provider in this document
- adding auth, accounts, database, payments, admin or tenant infrastructure
- analytics, advertising, public setup discovery or user tracking
- user-triggered market refresh
- provider-specific artifact architecture unless separately accepted
- adding a backend for simulation calculations
- deleting the archived legacy implementation
- claiming full legacy parity or legacy deletion readiness
- adding HSTS before domain/HTTPS policy is accepted

## Acceptance checklist

- [ ] Host/runtime, URL shape, Hiscores release state and deploy trigger are accepted
- [x] Current root-path build passes the reproducible artifact hygiene/schema/checksum gate
- [ ] Route order prevents SPA fallback from masking API failures
- [ ] Cache policy distinguishes index, hashed assets, market JSON and player API responses
- [ ] CSP and security headers are verified on preview and production
- [ ] Release gate and browser smokes pass for the exact promoted artifact
- [ ] Hiscores status and copy match the actual configured production state
- [ ] Deployed market snapshot is tied to both market and release commits
- [ ] Access logs do not violate the accepted player-name policy
- [ ] Rollback to a known-good release is rehearsed without history rewrite
- [ ] Operations and release evidence identify owner, release SHA and remaining limitations

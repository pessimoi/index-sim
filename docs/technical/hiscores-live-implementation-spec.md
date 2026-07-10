# Hiscores live implementation specification

- Status: provider implemented; production runtime and live evidence blocked on hosting/log decisions
- Date: 2026-07-10
- Owner: technical docs
- Source: conditional backlog work and the remaining `Hiscores` feature-inventory gap
- Contract owner: [live-integrations-spec.md](live-integrations-spec.md)
- Related decisions: [D-015, D-022, D-044 and D-061](../project/decisions.md)

## Purpose

Finish the existing rewrite Hiscores workflow by connecting the repo-owned same-origin API to an approved authoritative upstream and a production-capable runtime. This specification is an execution plan for the existing contract; it does not replace or redefine [live-integrations-spec.md](live-integrations-spec.md).

## Feature-inventory check

`Hiscores` is `Osittainen` in [feature-inventory.md](../product/feature-inventory.md). The UI, browser adapter, same-origin API contract, status/lookup states, preview/apply flow, stale-response protection, local last-player handling and manual level fallback already exist.

This work covers only the missing final slice:

- select and document the authoritative source contract (completed by D-061)
- implement the server-side provider adapter (completed)
- inject it into a production-capable same-origin runtime
- validate privacy, failure and live-operation behavior

The row must remain `Osittainen` until that production path is configured and evidenced. It may move to `Valmis` only when the done criteria in this document pass.

## Current implementation boundary

The existing code owns these stable contracts:

- `src/adapters/hiscores` owns browser-side status and lookup parsing.
- `src/server/hiscores-core.ts` owns `GET /api/hiscores/status`, `GET /api/hiscores?player=...`, input/output validation, sanitized errors, request timeout and memory rate limiting.
- `src/server/lostcity-hiscores-provider.ts` owns the fixed-origin D-061 upstream request, allowlisted JSON mapping, XP normalization, redirect refusal, response bounds and sanitized provider failures. The upstream announcement documents `date`, but the observed player endpoint may omit it; the parser accepts both forms and does not expose or depend on that field.
- `src/server/vite-hiscores-middleware.ts` adapts that core handler to local Vite dev and preview.
- `vite.config.ts` injects the source-backed provider for local dev and preview; a static `dist` build does not itself provide the same-origin API.
- the UI applies only the seven returned combat skills after user review and retains manual level editing as the fallback.

The live implementation must conform to those contracts. It must not make the browser call or parse the upstream directly.

## Resolved source decision

D-061 accepts the first-party 2004Scape [Hiscores API](https://2004.lostcity.rs/news/199):

- endpoint: `GET https://2004.lostcity.rs/api/hiscores/player/:username`
- response: JSON rows with category `type`, `level`, stored XP `value`, `rank` and an optional update `date`; the announcement documents `date`, while the observed player response may omit it
- accepted mapping: type 1 Attack, 2 Defence, 3 Strength, 4 Hitpoints, 5 Ranged, 6 Prayer and 7 Magic
- stored XP is divided by 10 and truncated according to the source documentation
- partial skill rows remain usable with sanitized warnings; no supported rows map to hiscores not-found
- upstream rate limits are respected through the existing same-origin 30/minute guard and provider rate-limit mapping

HTML parsing and a parser-dependency decision are no longer needed.

## Remaining decisions before production

### 1. Production runtime and host

Choose a host/runtime that can expose the existing same-origin API contract with:

- server-side outbound HTTPS
- server-only configuration
- request timeout and cancellation
- rate limiting suitable for more than one process or instance, if the selected runtime needs it
- response headers and routing before SPA fallback
- privacy-compatible request logs

Static-only hosting is insufficient for a live Hiscores claim unless it also provides an accepted same-origin function, edge runtime or reverse proxy. `vite preview` is not a production server.

### 2. Player-name logging and retention

The current lookup uses a GET query parameter. Player names can therefore appear in host, proxy or observability access logs even though the application does not persist them server-side.

Decide:

- whether query strings are stripped or player parameters are redacted
- retention duration and access boundary for unavoidable operational logs
- whether the selected provider has additional logging or privacy constraints

No persistent player-name log may be introduced until this decision is accepted.

## Target architecture

```text
Browser UI
  -> src/adapters/hiscores
  -> same-origin /api/hiscores/status or /api/hiscores
  -> existing repo-owned handler
  -> injected approved HiscoresProvider
  -> authoritative HTTPS upstream
```

The provider adapter is the only new upstream-aware boundary. It must return the existing sanitized provider result model, not raw HTML, raw JSON or upstream-specific errors.

## Implementation requirements

### Provider adapter

Implement a server-only provider module that:

- accepts only the normalized player request supplied by the existing handler
- constructs the upstream request without accepting a user-controlled host, protocol, path or headers
- uses HTTPS and a fixed allowlisted origin
- inherits or enforces a bounded timeout and abort signal
- validates content type and caps the response before full parsing
- maps only Attack, Strength, Defence, Hitpoints, Prayer, Ranged and Magic
- validates integer level ranges through the existing API schema
- maps source-specific not-found, rate-limit and availability states to the existing sanitized result categories
- never returns raw upstream bodies, parser stack traces, internal URLs or credentials

If HTML is used, parse the document structurally. Do not use broad regular-expression extraction from the full page.

### Runtime injection

Keep `src/server/hiscores-core.ts` runtime-neutral. Add the provider through the selected production adapter's dependency-injection boundary rather than importing provider configuration into UI or domain code.

Production configuration must:

- fail closed to the disabled/unavailable state when required server configuration is absent
- expose no upstream secret or internal endpoint to Vite client environment variables
- route `/api/hiscores/status` and `/api/hiscores` before static-file and SPA fallback handling
- retain `Cache-Control: no-store` for player-specific lookup responses
- return JSON error envelopes with no stack or raw provider detail

### Rate limiting and caching

- Preserve the existing application-level limit as a minimum behavioral contract.
- Re-evaluate the implementation if the selected host uses multiple instances, because the current in-memory limiter is process-local.
- Do not add a database solely for rate limiting or cache in this slice.
- Do not share cached player lookups between users unless an explicit privacy and freshness policy is accepted.
- A short provider-safe status cache may be added only when it cannot disclose player data and is covered by tests.

### UI behavior

No new Hiscores workflow is required. Preserve:

- visible player input
- disabled/unavailable/manual fallback states
- explicit preview before Apply
- apply-only-returned-skills behavior
- stale response rejection when the current player input changes
- non-blocking manual level editing

Provider branding or attribution may be added only when required by the accepted source terms. Do not expose raw source URLs or operational details in failure copy.

## Security and privacy requirements

- No authentication, account, tenant, payment, database or admin model is introduced.
- Player names are untrusted input and remain bounded by the existing validation contract.
- Upstream URL and request headers are server-controlled; the provider must not create an SSRF primitive.
- Redirects must be rejected or their final origin revalidated against the allowlist.
- Response size must be bounded before parsing.
- Logs and metrics must use status/category/latency data, not player names or raw payloads.
- UI and API errors remain sanitized and must not include source paths, parser failures, stack traces or provider credentials.
- Rate limiting is abuse protection, not an auth or permission system.

## Delivery goals

### Goal 1: Accept and fixture the source contract (completed)

- record the accepted source and terms in `docs/project/decisions.md`
- capture minimal, sanitized fixtures for success, missing skill, not found, rate limited and malformed response cases
- document fixture provenance and capture date without committing a real player's unnecessary data
- define the source-version/change detection boundary

Done when the parser can be implemented without guessing the upstream shape.

### Goal 2: Implement the provider adapter (completed)

- add the server-only adapter and structural parser if required
- map upstream outcomes to the existing `HiscoresProvider` contract
- add redirect, timeout, size, schema and sanitization tests
- keep the disabled provider as the default when live configuration is absent

Done when fixture-backed provider tests pass without changing browser/domain contracts.

### Goal 3: Wire the production runtime (blocked on host/log decisions)

- inject the provider into the selected host's same-origin function/server adapter
- configure server-only source settings
- apply route ordering, no-store, rate-limit and query-log redaction policy
- document local emulation and production configuration without committing secrets

Done when the deployed status endpoint reports the intended configured state and the browser still uses only same-origin calls.

### Goal 4: Collect live evidence and close documentation (blocked on deployment)

- run an opt-in, sanitized live smoke against the deployed same-origin endpoint
- verify success plus not-found/unavailable behavior without committing raw responses
- verify host logs do not retain player query values contrary to policy
- update architecture, operations, testing, backlog and feature inventory
- retain the manual fallback and known failure copy

Done when production evidence supports moving `Hiscores` from `Osittainen` to `Valmis`.

## Validation plan

At minimum, keep the existing API, adapter, UI and browser coverage passing. Add focused provider tests for:

- valid seven-skill mapping
- partial/missing-skill mapping
- player not found
- upstream rate limit
- timeout and cancellation
- redirect outside the allowlist
- oversized response
- unexpected content type
- malformed or changed source shape
- sanitized API and UI error output
- concurrent or repeated request rate limiting

Representative commands after implementation:

```sh
npm run test -- src/tests/lostcity-hiscores-provider.test.ts src/tests/hiscores-server.test.ts src/tests/hiscores-adapter.test.ts src/tests/hiscores-ui-state.test.ts src/tests/ui-view-model.test.ts
npm run typecheck
npm run test:e2e
npm run build
git diff --check
```

Use the actual focused test filenames introduced or retained by the implementation. Live upstream checks must be opt-in, excluded from the default unit/CI path and safe to skip when credentials or approved network access are absent.

## Operations evidence

Record only sanitized evidence:

- deployed release commit
- status endpoint category
- response status and latency class
- source fixture version or parser contract version
- successful mapping count for the seven required skills
- rate-limit and timeout behavior
- confirmation that player query values are redacted or retained according to the accepted policy

Do not record raw upstream payloads, real player profiles, credentials, local absolute paths or provider-internal errors.

## Explicitly out of scope

- direct browser calls to the upstream
- legacy `/api/hiscores` or `run_sim.py` compatibility shims
- player accounts, saved profiles or automatic periodic player refresh
- a database or shared player cache
- public player search/discovery
- non-combat skills beyond the accepted seven-skill response
- changing simulation formulas or Planner behavior
- choosing the provider, host, domain or logging policy inside this specification

## Final acceptance criteria

- [x] Authoritative source and source terms are accepted and documented
- [ ] Production runtime/hosting and log policy are accepted and documented
- [x] Provider adapter is server-only, allowlisted, bounded and fixture-tested
- [x] Existing same-origin API and browser contracts remain stable
- [x] Missing configuration fails to a sanitized manual-fallback state
- [ ] Production routing, no-store and rate limiting are verified
- [ ] No player name, raw payload or credential leaks through logs, API errors or UI copy
- [x] Opt-in live smoke evidence is recorded without raw personal data
- [ ] Operations, testing, backlog and feature inventory reflect the deployed state
- [ ] `Hiscores` moves to `Valmis` only after all preceding criteria pass

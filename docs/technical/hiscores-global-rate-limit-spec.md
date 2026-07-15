# Hiscores distributed and global rate-limit specification

- Status: repository implementation complete; enforcement and edge rule disabled/evidence gated
- Date: 2026-07-14
- Owner: server integration and deployment operations
- Source: `SEC-2026-01` and the conditional stabilization backlog item
- Related documents: [hiscores-live-implementation-spec.md](hiscores-live-implementation-spec.md), [live-integrations-spec.md](live-integrations-spec.md), [../operations/public-deployment-spec.md](../operations/public-deployment-spec.md), [../project/security-audit.md](../project/security-audit.md), [../project/decisions.md](../project/decisions.md)

## Purpose

Define the implemented repository boundary and conditional rollout contract for
additional Hiscores request limiting if deployed evidence shows that the
current per-Worker-isolate guard is insufficient.

This specification distinguishes two different controls that must not be called
equivalent:

1. **Distributed edge abuse control** reduces repeated traffic before it reaches
   the Worker or upstream, but uses location-scoped counters.
2. **Strict global provider budget** caps the aggregate number of upstream
   lookup attempts across all clients, Worker isolates and Cloudflare locations.

The first control is the preferred initial response to abuse. The second is a
new stateful architecture and deployment decision, not an automatic extension
of the current Cloudflare configuration.

## Current verified boundary

The current implementation has these properties:

- `GET /api/hiscores/status` returns static provider capability and does not call
  the upstream provider.
- A lookup is schema-validated before it reaches the in-memory limiter.
- `src/server/hiscores-core.ts` allows 30 valid lookup requests per 60-second
  fixed window for each limiter key.
- The Cloudflare adapter uses a trimmed, at-most-64-character
  `CF-Connecting-IP` value as the key. Missing or invalid values fall back to one
  shared `same-origin-client` key.
- The limiter retains at most 10,000 ephemeral client entries in one runtime
  instance and returns the existing sanitized JSON `429` response with a
  `Retry-After` header when that local window is exhausted.
- The provider adapter maps upstream `429` responses to the same
  `rate-limited` error category and preserves a bounded numeric `Retry-After`
  value when the provider supplies one.
- The timeout, fixed upstream origin, redirect rejection, 128 KB response cap,
  schema validation and manual-level fallback remain independent protections.

The current limiter does **not** cap aggregate requests across Worker isolates,
Cloudflare locations or different client addresses. Its 30/minute value is a
per-client application contract; it is not evidence of an accepted global
provider quota.

D-097 adds a separate strict aggregate provider-budget implementation without
activating it:

- `src/server/hiscores-core.ts` injects an asynchronous provider-budget gate
  after validation and the local limiter but before each upstream attempt.
- `src/server/hiscores-global-rate-limit.ts` owns the fixed 60-second persistent
  counter, Cloudflare gate and `HiscoresGlobalRateLimit` Durable Object.
- `src/server/cloudflare-worker.ts` injects the environment-backed gate while
  preserving one in-isolate client limiter across requests.
- `wrangler.jsonc` creates the SQLite-backed Durable Object binding/migration and
  commits `HISCORES_GLOBAL_RATE_LIMIT_MODE` as `off`.
- No quota value, WAF rule or production activation is accepted yet.

## Platform constraint: Cloudflare counters are not global

Cloudflare's current product boundaries are explicit:

- WAF rate-limiting rules include the data-center identifier as a mandatory
  characteristic, and counters are not shared across the entire network.
- Workers Rate Limiting bindings are local to the Cloudflare location, are
  permissive/eventually consistent and are not an exact accounting system.
- WAF rule updates can lag by a few seconds, so some excess requests may reach
  the origin before mitigation starts.
- A WAF Block action can return a custom `application/json` body and a 4xx
  status, including the default `429`.
- Workers KV is eventually consistent and does not provide the atomic
  read-modify-write semantics required for an exact global counter.
- Durable Objects provide globally unique, strongly consistent coordination,
  but Cloudflare explicitly warns against routing all traffic through one global
  singleton for rate limiting because it becomes a bottleneck.

Therefore neither a WAF rule nor a Workers Rate Limiting binding closes a strict
global provider-budget requirement by itself. A strict global claim requires a
separately accepted coordinator or a provider/gateway feature with equivalent
guarantees.

Official platform references, verified 2026-07-14:

- [Cloudflare WAF request-rate calculation](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/)
- [Cloudflare Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare WAF rate-limiting parameters](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/)
- [Cloudflare Durable Objects rules and global-singleton warning](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Cloudflare Workers KV consistency model](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

## Activation criteria

Keep enforcement conditional. Change the committed mode from `off` only when at
least one of these conditions has concrete evidence:

- the provider publishes or communicates an aggregate quota that this deployment
  must enforce before sending requests;
- deployed traffic produces repeated upstream `429` responses or availability
  failures attributable to aggregate request volume;
- an incident shows that requests distributed across isolates, locations or
  source addresses bypass the current protection materially;
- the accepted public-service threat model requires a quantified provider-wide
  ceiling even without a prior incident.

Do not activate a global coordinator merely because one might be useful. Do not
load-test the live upstream to discover its limit.

Before activation or adding a WAF rule, record an accepted decision containing:

- whether the objective is edge abuse reduction, a strict aggregate upstream
  budget, or both;
- the provider evidence that determines the request allowance, period, burst
  policy and whether the provider uses a fixed, rolling or token-bucket model;
- the Cloudflare plan and features actually available to the adopter;
- the privacy review described below;
- configuration ownership, cost ownership, fail policy and rollback owner;
- whether the observed traffic, latency and cost remain inside D-097's accepted
  singleton-coordinator boundary or require a different gateway.

If no provider quota is known, the exact global allowance remains an open
question. The existing 30/minute client limit must not be reused as a global
allowance without a human accepting that product and availability change.

## Layered target

| Layer                   | Status                  | Scope                                            | Required behavior                                                                             |
| ----------------------- | ----------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Input validation        | Implemented             | One request                                      | Reject malformed player input before application or strict-global budget consumption.         |
| Existing memory limiter | Implemented and active  | Client key in one runtime instance               | Preserve the current 30 valid lookups/minute contract, bounded state and JSON `429` behavior. |
| Optional edge rule      | Not configured          | Client characteristic in one Cloudflare location | Reduce obvious repeated abuse; do not claim a network-global or exact origin cap.             |
| Strict-global gate      | Implemented, mode `off` | All upstream lookup attempts for this deployment | Serialize and account for an accepted provider budget before starting the upstream fetch.     |
| Provider handling       | Implemented and active  | One upstream response                            | Preserve upstream `429`, timeout, invalid-response and unavailable mappings.                  |

The status route stays outside all request-budget counters. Invalid lookup input
stays outside the application and strict-global counters. A coarse WAF rule may
count malformed requests because it runs before application validation; this is
acceptable for abuse control but is one reason it cannot be the provider-budget
source of truth.

## Phase A: preferred distributed edge abuse control

When the activation evidence calls only for abuse reduction, use an
operator-owned Cloudflare WAF rate-limiting rule before adding repository-owned
state.

### Desired rule contract

- Match exact path `/api/hiscores`.
- Match `GET` when the adopter's Cloudflare plan exposes Method in the rule
  expression. Path-only matching is the documented fallback on plans that do
  not expose Method.
- Exclude `/api/hiscores/status`, static assets and all other API routes.
- Count by an operator-accepted client characteristic. The baseline WAF option
  is source IP plus Cloudflare's mandatory location characteristic.
- Never use `player`, the query string, full URI or username as a counting
  characteristic.
- Use Block, not a browser challenge, because this is a JSON API.
- Return status `429` and, when the selected plan supports the configured custom
  response, this sanitized body:

  ```json
  { "error": { "code": "rate-limited", "message": "Hiscores lookup rate limit reached" } }
  ```

- Do not assume that WAF supplies `Retry-After`. The existing browser adapter
  already maps any same-origin `429` to `rate-limited` even when the body is not
  valid JSON. Preview verification must prove the actual response shape.
- Keep the existing Worker limiter enabled as the deterministic local/API
  contract and local-development implementation.

The WAF threshold and mitigation period are activation-time values, not values
defined by this repository. A threshold lower than the advertised 30 valid
lookups/minute changes the public client contract and requires coordinated
status, product and test updates. A threshold at or above that value still needs
normal-traffic and shared-NAT false-positive review.

WAF rule counters are location-scoped and can update with delay. This phase may
close an abuse-reduction finding, but it must not close a requirement for a hard
aggregate provider quota.

### Configuration ownership

The current repository has no Cloudflare account identifier, zone identifier or
infrastructure-as-code owner. Until that changes, the WAF rule remains
operator-owned account configuration. The release record must retain:

- rule identifier and redacted configuration export or screenshot;
- route expression, characteristics, threshold, period, mitigation period and
  action;
- Cloudflare plan/environment, release commit and activation time;
- privacy verification and rollback owner.

Adding Terraform, API tokens or another account configuration workflow requires
its own scoped deployment/security decision. Do not commit account credentials.

## Phase B: strict global provider budget

Repository support for this phase is implemented under D-097. Enable it only
when the activation decision explicitly supplies a hard aggregate cap.

### Implemented server seam

Add an asynchronous provider-budget gate to the runtime-neutral Hiscores handler
instead of replacing the current synchronous client limiter:

```ts
interface HiscoresProviderBudgetGate {
  check(): Promise<{
    allowed: boolean;
    retryAfterSeconds?: number;
  }>;
}
```

The default implementation is an explicit no-op for local development and
deployments whose accepted mode is `off`. The production adapter injects the
environment-backed gate for every request while preserving one shared local
limiter. The handler bounds the gate wait to one second.

The production configuration contract is:

- `HISCORES_GLOBAL_RATE_LIMIT_MODE=off`: allow without contacting the Durable
  Object; this is the committed default.
- `HISCORES_GLOBAL_RATE_LIMIT_MODE=enforce`: require the
  `HISCORES_GLOBAL_RATE_LIMITER` binding and a positive integer
  `HISCORES_GLOBAL_RATE_LIMIT_REQUESTS_PER_MINUTE`.
- unknown modes, invalid/missing quota in `enforce`, missing binding, timeout,
  corrupt state or invalid coordinator response: sanitized fail-closed `503`
  without an upstream call.

Activation is one reviewed `wrangler.jsonc` release change: switch the mode to
`enforce` and add the accepted positive
`HISCORES_GLOBAL_RATE_LIMIT_REQUESTS_PER_MINUTE` value together. The quota is
configuration, not a secret, but it must not exist only as undocumented
dashboard drift. Keep the binding, migration and deterministic object name
stable when enabling or disabling enforcement. The committed `off` state omits
the quota deliberately, so an incomplete activation fails closed.

Lookup order is fixed:

1. verify route and method;
2. validate the player input;
3. check the existing per-client memory limiter;
4. await the strict-global provider-budget gate;
5. consume the granted allowance before starting the upstream fetch;
6. call the provider and preserve the current response mapping.

Do not refund allowance after an upstream attempt starts. Timeouts, cancellations
and provider failures still consumed provider capacity.

When enforcement is configured but the coordinator is unavailable, fail closed:
return sanitized `503 upstream-unavailable`, do not call the upstream, and leave
manual level entry available. A missing required production binding is a
deployment/configuration failure, not an implicit switch to unlimited mode.

### Coordinator requirements

The coordinator must:

- share one budget across all production Worker isolates and Cloudflare
  locations for the same upstream provider;
- include every environment that consumes the same provider quota, or keep
  preview/staging on a mock or disabled provider;
- perform atomic allowance checks and consumption;
- use coordinator-controlled time;
- persist enough aggregate state to survive eviction, restart and deployment;
- preserve the same namespace/identity across ordinary releases so a deploy
  cannot reset the active budget;
- store only aggregate window/token state and configuration version—never player
  names, query strings, raw IP addresses or per-player results;
- return a bounded positive retry delay when the selected quota model can
  calculate one;
- expose no client-controlled key capable of creating unbounded state.

D-097 implements a fixed 60-second window and atomically persists its start,
usage and configured allowance. Activate it only if the accepted provider policy
is compatible with that model. A rolling or burst-aware provider policy requires
a separately reviewed token-bucket/GCRA implementation before activation. The
activation decision must define allowance and boundary semantics without
guessing from the existing client limit.

Workers KV and the Workers Rate Limiting binding are rejected for this phase
because they do not provide the required exact global semantics. D-097 selects
one provider-budget Durable Object for serialized aggregate coordination while
acknowledging Cloudflare's documented global-singleton bottleneck warning. The
committed mode remains `off`; activation still requires measured expected/attack
traffic, the Phase A edge shield where needed, cost/latency evidence and a
load/rollback plan. Replace it with an external gateway or provider-owned global
quota if that evidence exceeds the accepted singleton boundary.

Do not add a database solely to satisfy this phase.

### Strict-global response contract

When the coordinator denies allowance, return:

- HTTP `429`;
- `Cache-Control: no-store`;
- `Content-Type: application/json; charset=utf-8`;
- the existing `rate-limited` JSON error envelope;
- `Retry-After` and matching `error.retryAfterSeconds` when a reliable bounded
  delay is available.

Do not expose current aggregate usage, remaining tokens, provider quotas,
coordinator identity or internal failure detail through the public status or
lookup response.

## Privacy and observability gate

D-065 prohibits player-name/query logging and allows at most seven days of
unavoidable non-player metadata. Disabling Workers Logs and Logpush does not by
itself prove that WAF Security Events or Security Analytics omit the lookup query
string.

Before enabling either phase, the adopter must verify and record:

- whether the selected Cloudflare security product stores full URI, query,
  source IP or sampled request data for matched/blocked requests;
- that player query values are omitted or redacted at collection time, not only
  hidden in a dashboard view;
- that retention and access comply with D-065;
- that no Tail Worker, Logpush job or external drain receives request URLs;
- that rule diagnostics and support exports do not introduce a longer copy.

Cloudflare documents plan-dependent Security Events retention from 24 hours to
30 days and Security Analytics retention from 7 to 90 days. The current official
documentation consulted for this specification does not prove player-query
redaction. Activation is blocked until the adopter verifies the effective
account behavior or accepts a new privacy/API decision. Do not collect live
player queries merely to tune a threshold.

Permitted repository-owned evidence is aggregate and query-free, for example
counts of allowed, edge-rejected, strict-global-rejected and provider-`429`
outcomes per coarse time bucket. Adding even aggregate telemetry still requires
an explicit owner, retention and access policy; it is not part of this
specification's implementation by default.

References:

- [Cloudflare Security Analytics data and retention](https://developers.cloudflare.com/waf/analytics/security-analytics/)
- [Cloudflare guidance for selecting a rate](https://developers.cloudflare.com/waf/rate-limiting-rules/find-rate-limit/)

## Validation plan

### Repository tests for Phase A compatibility

- Preserve existing core tests for the 30/minute fixed window, bounded client
  state, JSON `429` and `Retry-After`.
- Preserve Worker tests for trusted/bounded `CF-Connecting-IP` handling and
  no-store/security headers.
- Add browser-adapter tests showing that both custom-JSON and non-JSON same-origin
  `429` responses map to `rate-limited` without exposing the response body.
- If repository-owned WAF configuration is later accepted, validate exact path
  scope, status-route exclusion, Block/429 behavior and absence of query-based
  characteristics in a deterministic configuration test.

### Repository tests for Phase B

- gate allow and deny paths, including exact call order;
- invalid input, status requests and locally rate-limited requests never consume
  global budget;
- one allowance is consumed before each upstream attempt and is not refunded on
  timeout, cancellation, `404`, `429`, invalid response or `5xx`;
- coordinator denial returns the existing sanitized `429` contract;
- coordinator failure fails closed with sanitized `503` and performs no upstream
  fetch;
- concurrent checks cannot grant more than the configured quota;
- window/token rollover, retry delay, restart persistence and deployment-stable
  namespace behavior;
- no player, query or client-address value enters coordinator storage, telemetry
  or errors;
- missing production binding/configuration fails deployment validation.

At minimum run:

```sh
npm run test -- src/tests/hiscores-server.test.ts src/tests/hiscores-global-rate-limit.test.ts src/tests/cloudflare-worker.test.ts src/tests/hiscores-adapter.test.ts src/tests/lostcity-hiscores-provider.test.ts
npm run typecheck
npm run architecture:check
npm run build
npm run deploy:verify-artifact
npm run deploy:cloudflare:dry-run
git diff --check
```

Run the full `npm run verify` gate before merge.

### Deployed verification

- Verify preview routing and privacy settings before sending a lookup.
- Use a synthetic, non-player-identifying valid fixture account only when the
  provider permits it; otherwise do not automate a live lookup.
- Never raise traffic against the real provider to force its quota.
- For an edge rule, temporarily use an operator-approved preview threshold and
  bounded requests that do not reach the upstream where possible; record the
  actual 429 body/status and restore the accepted threshold immediately.
- For a strict-global gate, use a mock/staging provider or deterministic
  coordinator test environment to prove concurrency and exhaustion.
- Confirm `/api/hiscores/status`, static routes and manual level editing remain
  usable while lookups are limited.

## Rollout and rollback

1. Accept and record the activation decision and privacy evidence.
2. Deploy code/config with enforcement off and validate bindings without
   collecting player queries.
3. Enable the Phase A edge rule in preview, then production, when edge abuse
   control is required.
4. Enable Phase B only after coordinator correctness, fail-closed behavior,
   latency, cost and attack-load behavior pass.
5. Record rule/coordinator identifiers, thresholds, release SHA, activation time
   and owner without request data.

Rollback order:

1. disable the newly activated edge rule or strict-global mode through the
   accepted operator rollback path;
2. retain the existing in-memory limiter, provider bounds and manual fallback;
3. roll back the Worker release if the binding/code path caused the incident;
4. preserve aggregate incident evidence under the accepted retention policy;
5. do not delete or replace a strict-global namespace until its active budget
   window has expired and rollback cannot restore code that depends on it.

Disabling a malfunctioning coordinator is an operator action, not an automatic
runtime fallback. Automatic fail-open would defeat the strict-global contract.

## Acceptance criteria

The specification is complete when:

- [x] current per-isolate behavior and its limits are separated from global
      semantics;
- [x] Cloudflare WAF and Workers Rate Limiting locality are documented from
      official sources;
- [x] edge abuse control has a route, key, action, response, privacy and ownership
      contract;
- [x] strict-global coordination has an injection seam, ordering, persistence,
      failure and response contract;
- [x] activation, test, rollout and rollback evidence are defined;
- [x] D-097 accepts the disabled-by-default SQLite Durable Object coordinator;
- [x] handler, coordinator, Worker/configuration and Wrangler dry-run validation
      pass;
- [ ] an adopter has supplied the activation evidence and accepted quota values;
- [ ] Cloudflare plan/account privacy behavior has been verified;
- [ ] a WAF edge rule has been configured, if activation evidence requires it;
- [ ] deployed enforcement and rollback verification have passed.

## Open questions

- Does the upstream publish or agree to an aggregate quota, and what exact window
  and burst semantics does it use?
- Is the real objective per-client abuse reduction or a hard deployment-wide
  provider cap?
- Which Cloudflare plan and WAF fields/custom responses are available to the
  adopting account?
- Do Security Events or Security Analytics retain the `player` query in the
  effective account configuration, and can it be redacted at collection?
- Who owns WAF configuration and any future infrastructure-as-code workflow?
- Does activation-time traffic remain inside D-097's singleton latency/load
  envelope, or must the operator replace it with another gateway/coordinator?

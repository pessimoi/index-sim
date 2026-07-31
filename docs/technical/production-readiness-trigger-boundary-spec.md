# Production-readiness trigger and dormant Cloudflare infrastructure specification

- Status: active
- Date: 2026-07-31
- Owner: deployment architecture and server integration
- Evidence: partial
- Contract: living

## Purpose

Keep the repository deployable while making production-only infrastructure and
operational gates dormant until a concrete operator, public instance or
provider requirement activates them.

This specification does not assume that the existing Cloudflare configuration
can be deleted. It first proves whether any deployed namespace, public user or
operator-owned state exists, then separates current application truth from
future production provisioning.

## Verified starting state

- D-043 accepted a trusted-tester handoff to one known friend before a public
  release pipeline.
- D-066 selected Cloudflare Worker plus Static Assets as the optional production
  target.
- D-067 states that the current maintainer has no required Cloudflare account,
  public deployment or observed production cron; a future adopter owns those
  operations.
- `wrangler.jsonc` nevertheless provisions a named SQLite Durable Object class
  migration and binding while committing global Hiscores enforcement `off`.
- No positive provider quota, public traffic evidence, account-level privacy
  evidence or singleton load envelope has been accepted.
- The Durable Object stores only aggregate rate-window/config state. The
  canonical state shape, validation, atomic transaction and fail policy live in
  `src/server/hiscores-global-rate-limit.ts` and its tests; the Wrangler
  migration only provisions the class.
- Static security headers, Worker-first API routing, artifact hygiene and
  account-free dry-run are implemented independently of a live public instance.

## Mandatory activation audit

Before changing `wrangler.jsonc`, the Worker export or any migration:

1. Ask the repository owner whether any Cloudflare account has deployed this
   Worker or created the Durable Object namespace.
2. Inspect available local and operator-provided deployment records, version
   ids and namespace/migration state.
3. Confirm whether a public or trusted external URL exists and whether anyone
   depends on it.
4. Confirm whether any provider quota or abuse incident requires a strict
   aggregate counter.
5. Record the result as one of:
   - `never-provisioned`;
   - `provisioned-no-public-traffic`;
   - `active-or-unknown`.

If the result is `active-or-unknown`, do not remove, rename, recreate or squash
the binding, class, object name or migration. Limit implementation to command
and documentation gating until an operator supplies safe migration/rollback
evidence.

## Current application truth versus provisioning history

The following must remain canonical regardless of deployment state:

- Hiscores input validation, fixed upstream origin, timeout, response bound and
  sanitized errors;
- the per-client in-isolate rate limiter;
- D-065 no-player-query logging and privacy rules;
- the aggregate budget state schema and transaction tests while that optional
  feature remains supported;
- Worker static/API routing behavior;
- CSP, security headers and artifact hygiene; and
- committed static game/price data contracts.

The following are provisioning or release history, not current product truth:

- the `v1` Wrangler `new_sqlite_classes` migration;
- the disabled binding in an account that has never been connected;
- preview/production promotion and rollback checklists;
- concrete provider quota values;
- Cloudflare account identifiers and version ids; and
- deployed smoke or public-freshness claims.

Do not delete the only canonical schema or invariant merely to remove migration
history. In the current implementation, those invariants are code/test-owned,
but this must be reverified immediately before any removal.

## Dormant repository target

### Always-active repository capabilities

Keep these available in an ordinary checkout:

- local Vite development;
- current static/generated runtime;
- framework-neutral Hiscores handler and manual level fallback;
- production build;
- artifact validation;
- Worker/config tests;
- account-free Cloudflare dry-run command; and
- documented operator activation steps.

They must not run in the normal developer quality gate unless the change
affects their surface.

### Production-only activation

The following remain conditional:

- preview or production upload;
- Cloudflare account/Git connection;
- a stable public origin or custom domain;
- production smoke and promotion approval;
- observability/log-drain changes;
- scheduled market automation;
- aggregate Hiscores enforcement;
- WAF rules; and
- rollback rehearsal against deployed versions.

Owning documents must label them `conditional` or `adopter operation`, not
unfinished normal development.

## Never-provisioned cleanup path

Only when the activation audit proves `never-provisioned` may implementation:

1. remove the dormant Durable Object binding, `off` variable and `v1`
   provisioning migration from the default Wrangler config;
2. keep the aggregate coordinator source and tests as an optional capability
   only if a named future trigger still justifies their maintenance;
3. move exact first-provisioning instructions into the existing Hiscores
   global-rate-limit runbook;
4. make activation reintroduce a fresh, reviewed first migration appropriate
   to the then-current Cloudflare account and Wrangler version; and
5. update artifact/dry-run expectations so the default deployable static/API
   Worker has no unused state binding.

Do not keep a second full copied Wrangler config merely as a template. The
runbook should specify the minimal reviewed activation diff and require
current platform validation.

If maintaining dormant coordinator code has a material ongoing cost, its later
deletion requires proof that the per-client limiter/manual fallback remain the
accepted product boundary and that no public quota requirement exists.

## Provisioned cleanup path

If the namespace exists:

- preserve migration tags and exported class identity;
- disable enforcement through configuration rather than deleting state;
- do not reuse `v1` for a different class or storage model;
- do not delete/recreate the namespace as cleanup;
- require operator-owned preview, rollback and state-compatibility evidence for
  any migration; and
- treat state removal as a separate destructive deployment decision.

Repository command gating and documentation terminology may still be cleaned
up without touching deployed state.

## Production triggers

Production preparation becomes active only with at least one concrete trigger:

- a named operator accepts a Cloudflare account and cost/credential ownership;
- a public instance or agreed release date exists;
- external users need a stable origin;
- a provider publishes or communicates a strict aggregate quota;
- deployed traffic or an incident demonstrates the local limiter is
  insufficient;
- scheduled-current market claims are accepted and Actions capacity exists;
- observability, custom domain or promotion approval becomes required; or
- a deployment-affecting change needs preview evidence.

Each activation must identify owner, environment, scope, evidence, rollback and
claim wording.

## Safeguards

- No auth, account system, general database or server-side simulation state.
- No player/query identity in aggregate rate-limit state.
- No weakening of privacy, validation, timeout or local rate limiting.
- No upload from an unchecked artifact.
- No public/live claim from account-free dry-run evidence.
- No destructive Cloudflare state operation based only on repository docs.
- No provider load test against the live upstream to discover its quota.

## Non-goals

- No hosting-provider change.
- No live deployment or account configuration.
- No custom domain, telemetry or general IaC system.
- No deletion of security headers or artifact checks.
- No change to product formulas, browser persistence or generated data.
- No automatic market workflow activation.

## Implementation sequence

1. Complete and record the mandatory activation audit.
2. Add tests/runner plans that separate ordinary quality, account-free
   deployability and actual upload.
3. Apply only the matching never-provisioned or provisioned path.
4. Keep current Hiscores safety contracts and update focused tests.
5. Update architecture, operations, testing, decisions and backlog language.
6. Run account-free build/artifact/dry-run evidence.
7. Require operator preview/rollback evidence only if a real environment was
   placed in scope.

## Acceptance checks

```sh
npm run test -- src/tests/hiscores-global-rate-limit.test.ts src/tests/hiscores-server.test.ts src/tests/cloudflare-worker.test.ts src/tests/deployment-readiness.test.ts
npm run architecture:check
npm run typecheck
npm run build
npm run deploy:verify-artifact
npm run deploy:cloudflare:dry-run
npm run docs:check
npm run format:check
git diff --check
```

Do not run preview/deploy without an explicitly approved Cloudflare target.

## Done when

- deployment state is classified from evidence rather than inferred;
- no existing Durable Object namespace or user traffic can be orphaned;
- default development no longer treats dormant production preparation as a
  normal gate;
- never-provisioned configuration contains no unused state binding, if that
  cleanup path was proven safe;
- operator activation has explicit triggers and a minimal current runbook; and
- security/privacy/product invariants remain executable.

## Implementation checkpoint

The repository-side activation audit found the committed binding/migration and
their git history but no workspace-local deployment record. D-067 does not
prove that no external account, preview or namespace exists. External state is
therefore classified `active-or-unknown`.

The binding, class identity, `off` mode and `v1` migration remain unchanged.
Normal quality, repository handoff and account-free deployability now have
separate runner plans, and operations records the conditional activation
boundary. Config cleanup remains `WAITING_EXTERNAL` until an owner/operator
supplies account, Worker-version, origin and namespace evidence.

## Open questions

- Does any Cloudflare account or public/trusted preview currently contain the
  Worker or its Durable Object namespace?
- Does the external trusted tester use a hosted origin or only a local/static
  handoff?
- After default provisioning is removed, is the dormant aggregate coordinator
  valuable enough to retain in source until a quota trigger exists?

# Domain and integration testing

- Status: implemented
- Date: 2026-07-27
- Owner: technical testing
- Evidence: verified
- Contract: living

This guide routes current domain, schema, persistence and same-origin
integration checks. Dated outcomes belong in
[testing evidence](../../project/testing-evidence.md).

## Simulation and golden fixtures

- Run `npm run test -- src/tests/domain-core.test.ts` for combat primitives.
- Run `npm run test -- src/tests/full-simulation-result.test.ts src/tests/trip-loot-supply.test.ts src/tests/xp-parity.test.ts` when combat, Trip, XP or economy composition can change.
- Run `npm run test:golden` for changes that can alter archived calculation parity.
- Run `npm run numeric:audit` when a composed numeric path or presentation basis changes.

Golden fixtures freeze intended legacy-reference behavior. They do not make the
archived runtime product truth and must not be rewritten without classifying the
delta.

## Planner and variability

- Planner domain: `npm run test -- src/tests/planner-domain.test.ts src/tests/planner-parity.test.ts`.
- Planner parity report: `npm run planner:parity` when the classified report is intentionally refreshed.
- Risk and calculation tasks: `npm run test -- src/tests/risk-analysis.test.ts src/tests/calculation-task.test.ts`.

Use fixed seeds and accepted analytic tolerances for stochastic work. A new
formula or source-policy delta needs specification and golden-impact review.

## Data, prices and schemas

- Economy and PriceSet schemas: `npm run test -- src/tests/data-economy.test.ts`.
- Scheduled writer: `npm run test -- src/tests/market-writer.test.ts`.
- Generated data workflow: `npm run test -- src/tests/data-generator.test.ts`.
- Storage and migration owners: run the affected `src/tests/*storage*`,
  `*migration*`, `*workspace*` and transfer-controller suites.

Every persistence change must cover invalid input, version compatibility,
write failure, rollback or session-only behavior as applicable. Browser-local
schemas must not drift through presentation-only work.

## Same-origin integrations

- Hiscores provider/server/adapter/UI: run the focused `hiscores-*` and
  `live-integrations.test.ts` suites.
- Market handler/adapter/UI: run the focused market server, adapter and writer
  suites.
- Cloudflare routing: `npm run test -- src/tests/cloudflare-worker.test.ts src/tests/deployment-readiness.test.ts`.

All automated provider tests use fixtures or injected fetch behavior. Live
upstreams, deployed origins and account configuration require explicit operator
authorization and separate dated evidence.

## Performance

Performance-sensitive changes use the focused performance owners plus the
repository measurement commands described in
[runtime, data and deployment](runtime-data-deployment.md). Durable budgets live
in their accepted specifications and artifact validators; workstation timings
live only in dated evidence.

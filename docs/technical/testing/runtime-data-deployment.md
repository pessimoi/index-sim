# Runtime, data and deployment testing

- Status: implemented
- Date: 2026-07-27
- Owner: technical testing
- Evidence: verified
- Contract: living

This guide owns current commands for runtime bootstrap, generated data, market
artifacts and deployment validation. Results and hashes belong in
[testing evidence](../../project/testing-evidence.md).

## Generated runtime and source data

- Adapter readiness: `npm run runtime:readiness`.
- Incomplete-candidate planning: `npm run runtime:coverage-plan`.
- Generator tests: `npm run test -- src/tests/data-generator.test.ts src/tests/generated-runtime-adapter.test.ts`.
- Raw source coverage: `npm run data:source-audit -- --source-dir .sources/lostcity-content`.
- Candidate source impact: `npm run data:source-impact -- --source-dir .sources/lostcity-content`.
- NPC attack report check: `npm run npc:attack-audit`.

The raw checkout is optional, gitignored and required only for source review or
generation. Ordinary install, verification, build and runtime use committed
generated files. Do not regenerate the snapshot or a report during an unrelated
documentation or runtime change.

## Game revision generation

`npm run data:generate` is a reviewed write workflow. It requires an explicit
game revision, an agreeing pinned source checkout and an intentional output
diff. Validate snapshot/source-pin agreement, JSON schemas, path hygiene,
representative impact and goldens before accepting generated changes. The
generated revision-impact report is evidence, not a living command owner.

## Market artifacts

- Writer unit coverage: `npm run test -- src/tests/market-writer.test.ts`.
- Economy/schema coverage: `npm run test -- src/tests/data-economy.test.ts`.
- An explicit local candidate run uses `npm run prices:write-scheduled` with
  approved inputs and review parameters.

Automatic execution is disabled under D-099. Do not call the upstream or write
market files in ordinary tests. The committed JSON logical set and provenance
must validate together; a failed candidate must leave the previous files
untouched.

## Startup and calculation Worker

- Checked development startup: `npm run test:startup:dev`.
- Paired production startup measurement: `npm run startup:measure`.
- Calculation Worker measurement: `npm run worker:measure`.

Measurement commands require local Chromium and localhost binding. They produce
workstation evidence without rewriting documentation or accepted budgets.

## Cloudflare and public artifact

- Build and artifact gate: `npm run deploy:cloudflare:build`.
- Account-free Wrangler validation: `npm run deploy:cloudflare:dry-run`.
- Artifact-only validation after build: `npm run deploy:verify-artifact`.
- Approved deployed-origin smoke: `npm run deploy:smoke -- --origin <https-origin> --hiscores-mode enabled`.

Preview upload, production deploy and deployed smoke are external operations.
Repository-local success does not prove account connection, public headers,
provider availability or a production rollback path.

## Local-state health

Runtime bootstrap, recovery, Workspace, cross-tab and persistence changes need
their focused state/controller suites plus the relevant browser transaction.
Prove that invalid or unavailable storage is bounded, the original data remains
protected, and session-only writes do not become durable claims.

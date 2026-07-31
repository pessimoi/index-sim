# Archived legacy consumer inventory

- Status: active
- Date: 2026-07-31
- Owner: calculation regression fixtures and generated-data tooling
- Evidence: verified
- Contract: living

This inventory separates current product truth, immutable historical evidence
and the still-retained archived manual runtime. The source-backed generated
Revision 274 snapshot remains the only current runtime truth.

| Consumer class            | Exact consumer                                                                          | Values or contract needed                                                                           | Replacement owner / execution policy                                         |
| ------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Historical calculation    | `legacy-golden.json`, `legacy-golden-manifest.ts`, XP and focused simulation/trip tests | normalized inputs, summarized outputs, tolerances, accepted deltas, final capture commit/hash       | committed immutable fixtures; default tests do not execute archived JS       |
| Planner comparison        | `planner-parity-baseline.json`, `planner-parity.test.ts`                                | 16 case intents, 32 reviewed digests/classifications, current rewrite digests                       | committed baseline plus current planner domain; archived recapture is manual |
| Fixture convenience       | `current-sim.ts` and `createLegacyFixtureRuntime()`                                     | current source-backed context or historical static context, setup defaults and test-local overrides | test-only builders over validated JSON; no root-script execution             |
| Migration input           | focused migration, setup, preference and price tests                                    | old storage/file shapes and canonical aliases                                                       | small test-local inputs; no calculation runtime required                     |
| Generated-data comparison | readiness, source coverage, source impact and generator-core reports                    | historical entity catalog/field comparison and legacy-derived PriceSet                              | retained static comparison snapshots; they are not current source truth      |
| Archived manual runtime   | `legacy/index.html`, root JS/JSX, Vite legacy MIME support                              | manual historical UI/reference behavior                                                             | retained pending the compatibility/external-consumer decision                |
| Manual recapture          | `fixtures:capture`, `planner:parity:capture`, `runtime:write-legacy-derived`            | explicit baseline refresh from archived sources                                                     | never called by `test`, `quality`, `verify:handoff` or deploy plans          |
| Rollback/reference prose  | architecture, testing, operations and dated audits                                      | provenance and past decisions                                                                       | documentation only; no executable dependency                                 |

## Implemented Stage 1 boundary

- Non-legacy UI, migration and domain tests use the current generated runtime
  helper.
- Historical domain tests use a static compatibility facade backed by the
  committed legacy-derived JSON snapshot.
- Golden tests validate immutable input/output integrity, capture provenance
  and one reviewed classification per case.
- Planner parity validates the committed reviewed baseline and current rewrite
  digests. Re-executing `planner-core.js` moved to the explicit
  `planner:parity:capture` command.
- Generated runtime readiness now reads the committed historical comparison
  snapshot instead of evaluating root JavaScript.
- `legacy-fixture-boundary.test.ts` guards the default test and handoff gates
  against executable legacy capture calls.

## Retained boundaries

The broad legacy-derived snapshots remain because source coverage, source
impact and generator classification still consume their entity fields. They
are the only canonical comparison input for those reports, so replacing them
with a smaller manifest must preserve every named field before
`runtime:write-legacy-derived` or the snapshots can be retired.

Deletion of the archived UI/runtime also remains conditional on the
[compatibility support matrix](legacy-compatibility-support-matrix.md) external
tester-data checkpoint. Git history alone is not a substitute for deciding
whether the manual diagnostic runtime still has a real consumer.

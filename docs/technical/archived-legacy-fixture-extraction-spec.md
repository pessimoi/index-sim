# Archived legacy runtime fixture-extraction and retirement specification

- Status: active
- Date: 2026-07-31
- Owner: calculation regression fixtures and generated-data tooling
- Evidence: partial
- Contract: living

## Purpose

Remove normal test/tool dependence on executable archived browser sources only
after their remaining regression values, input definitions and generated-data
comparisons have app-owned canonical replacements.

This is not a mechanical deletion specification. Root legacy JavaScript still
executes inside Node VM helpers and feeds multiple tests and reports. The
source-backed generated snapshot owns current product truth, but archived code
still owns reproducible historical-baseline production. Those responsibilities
must be separated before any file removal.

## Verified starting state

- The production client entrypoint cannot reach `src/adapters/legacy-runtime`
  or `src/adapters/static-runtime`; architecture checking enforces that.
- `legacy-golden.test.ts` reads committed expected values but recalculates
  actual values by executing `gamedata.js`, `engine.js`, `trip.js` and
  `equipment.js` in a Node VM.
- Planner parity executes `planner-core.js` in the same legacy context.
- Multiple current domain, UI, migration and data tests call
  `loadBundledLegacyContext()` or legacy VM helpers for convenient fixtures.
- The legacy-derived static game-data/PriceSet snapshots can still be
  regenerated from archived sources.
- Source coverage, impact and runtime-readiness reports still use
  legacy-derived snapshots as comparison inputs.
- The root app consumes the source-backed Revision 274 generated snapshot, not
  the legacy-derived bridge.

## 2026-07-31 implementation checkpoint

Stage 1 is implemented. The complete current consumer classification is owned
by the [archived legacy consumer inventory](archived-legacy-consumer-inventory.md).
Default tests now use current generated data or committed static historical
fixtures, golden and Planner baselines no longer execute archived JavaScript,
and runtime readiness reads the committed historical comparison snapshot.

Stage 2 remains active because source coverage, source impact and generator
classification still need fields from the broad legacy-derived comparison
snapshot. That snapshot and its manual writer are retained until a smaller
manifest proves equivalent field coverage. Stage 3 remains conditional on the
external-consumer and tester-data checkpoint in the
[legacy compatibility support matrix](legacy-compatibility-support-matrix.md).

## Required dependency inventory

Create a machine-readable or documented inventory of every consumer in these
classes:

1. **Historical behavior producer**
   - legacy golden capture and replay;
   - XP or planner parity execution.
2. **Fixture convenience**
   - tests using bundled legacy game data, prices, setup definitions or display
     names without comparing legacy behavior.
3. **Generated-data comparison**
   - source coverage, source impact, readiness and generator reports.
4. **Migration input**
   - tests needing an authentic old localStorage shape or entity catalog.
5. **Archived manual runtime**
   - `legacy/index.html`, Vite MIME support and old UI/reference files.
6. **Rollback/reference prose**
   - documentation that cites archived execution without an executable
     consumer.

For each consumer record the exact values/contracts it needs, replacement
owner, required provenance and whether runtime execution is necessary.

## Canonical truth separation

Before extraction:

- current game entities, requirements, prices and formulas remain owned by
  source-backed generated data and rewrite domain code;
- historical legacy output remains immutable dated evidence;
- migration fixtures own old input shapes, not archived calculation truth;
- app tests should use current generated fixtures unless their assertion is
  explicitly about a legacy delta; and
- comparison reports must state whether their baseline is current source,
  accepted historical output or a migration fixture.

No legacy-derived snapshot may silently become current game-data truth during
the extraction.

## App-owned fixture target

### Historical calculation fixtures

For every accepted legacy golden/parity case, commit:

- stable case id and description;
- complete normalized logical input needed by the rewrite calculation;
- expected summarized output;
- tolerance and intentional-delta metadata;
- source commit/hash for the final archived execution capture;
- capture script version/hash; and
- classification: `must-preserve`, `accepted-delta` or `historical-only`.

Normal tests compare rewrite/current behavior to these immutable values without
executing archived JavaScript.

The capture script may remain temporarily as a manual evidence tool, but it is
not part of the default/full Vitest gate after fixture extraction. Regenerating
historical expected values requires an explicit baseline decision.

### Current fixture context

Replace `loadBundledLegacyContext()` in non-legacy assertions with a small
app-owned fixture builder over:

- `src/data/generated/game-data.json`;
- current generated PriceSet composition;
- explicit current setup defaults; and
- test-local overrides.

Do not create a new broad compatibility adapter. The fixture builder is
test-only and imports current public schemas/adapters.

### Migration fixtures

Keep small sanitized JSON objects representing old storage/file shapes. They
must not need archived engine execution or the full old item catalog unless a
specific migration mapping requires it.

### Generated-data comparison baseline

Replace the legacy-derived runtime identity reference with an app-owned
manifest containing only the entity ids/fields still needed for source
coverage or impact classification. If a report still needs historical numeric
output, read the immutable historical fixture rather than booting legacy code.

The manifest must not duplicate source-backed current values without a named
comparison reason.

## Retirement stages

### Stage 1: stop normal execution

- Default/full Vitest no longer reads or executes root legacy JS.
- Planner parity uses committed historical baselines.
- Non-legacy tests use current fixture builders.
- Architecture no longer needs legacy adapters as documented executable
  external entrypoints solely for tests.

### Stage 2: stop regeneration dependencies

- Source coverage/readiness/impact reports use current source plus the minimal
  comparison manifest.
- `runtime:write-legacy-derived` and legacy-derived bridge readiness modes are
  removed or moved to historical tooling.
- Generated current data no longer references legacy-derived bridge identity.

### Stage 3: archived manual runtime decision

Only after Stages 1–2 and the compatibility sunset inventory:

- decide whether `legacy/index.html`, root JS/JSX and legacy Vite MIME support
  still provide real diagnostic value;
- preserve provenance through git history and audit evidence;
- remove archived files only through an explicit decision listing the exact
  removed paths; and
- verify root/current runtime, docs links and packaged artifacts do not depend
  on them.

The known tester's browser data migration may require old input knowledge but
does not require keeping the archived UI executable indefinitely.

## Safeguards

- No expected numeric value changes during fixture extraction.
- No automatic baseline rewrite.
- No formula, schema, PriceSet or generated snapshot change.
- No loss of case ids, tolerances or intentional-delta explanations.
- No deletion until every code/script consumer has a replacement or explicit
  historical-only classification.
- Keep source provenance and final capture hash with each immutable fixture.
- Run duplicate-key/data hygiene before trusting final archived captures.

## Non-goals

- No legacy behavior bug fixes.
- No full rewrite-versus-legacy parity expansion.
- No migration reader removal; that lifecycle has its own specification.
- No current generated-data revision bump.
- No UI redesign or product release.
- No root archived file deletion in Stage 1.

## Implementation sequence

1. Produce the full consumer inventory with `rg` and import-graph evidence.
2. Classify each legacy case and capture one final immutable baseline.
3. Add current app-owned fixture builders and migrate convenience consumers.
4. Convert golden, XP and Planner parity to fixture comparison.
5. Replace generated-data comparison consumers with a minimal manifest.
6. Remove default-gate VM execution and duplicate legacy-golden execution.
7. Remove bridge regeneration/readiness modes after no consumer remains.
8. Run a separate archived manual-runtime retention/deletion decision.
9. Update architecture, testing, data workflow, decisions and audit evidence.

## Acceptance checks

Stage 1 minimum:

```sh
rg -n "createLegacyRuntime|loadBundledLegacyContext|legacy-sim|legacy-planner" src scripts
npm run test:golden
npm run planner:parity
npm run numeric:audit
npm run test
npm run architecture:check
npm run typecheck
git diff --check
```

Stage 2 additionally runs generated-data parser/readiness/impact suites. Stage
3 additionally runs build, artifact, startup and the affected browser path.

Acceptance requires a static check proving the normal test command does not
open or execute the archived root JS files.

## Done when

- normal tests and current generators have app-owned fixture/data inputs;
- historical expected values retain final source/capture provenance;
- archived code no longer executes in the normal quality gate;
- source-backed generated data remains the only current runtime truth;
- bridge scripts/adapters have no unexplained consumer; and
- any final file deletion is separately approved after tester-data review.

## Open questions

- Which historical golden/parity cases still block a real regression rather
  than document superseded behavior?
- Does any maintainer still use `legacy/index.html` for diagnosis?
- Which generated reports need a historical identity manifest after the
  source-backed runtime switch?

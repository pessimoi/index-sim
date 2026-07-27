# Game-data generator core retention and split-trigger specification

- Status: implemented
- Date: 2026-07-14
- Owner: technical documentation
- Evidence: verified
- Contract: living

## Purpose

This specification turns the generator half of D-096's combined structural
assessment into an implementation-grade maintenance contract for
`scripts/game-data-generator-core.ts`. The accepted implementation is to retain
the current core until a concrete maintenance trigger appears. A line-count-only
or move-only split is not authorized.

The original evidence remains in
[large-module-structural-split-assessment.md](large-module-structural-split-assessment.md).
This document owns generator-specific invariants, the future dependency
direction, activation criteria and validation recipe.

## Verified current inventory

Source, reference and history inspection on 2026-07-14 records:

- 3,170 lines and 42 exported declarations
- 14 exported names referenced outside the file and 28 currently used only
  inside the file
- three consumer families: the generation CLI, source-impact reporter and
  focused generator tests
- seven file-history commits; almost all current size came from one source-backed
  runtime foundation change, followed by only 12 net lines across five changes
- no revert, conflict, repair loop, TODO/FIXME or type/lint suppression
- 35 focused generator tests
- no production application import of the script core

The internal-only exports are future surface-hygiene evidence, not permission to
remove a possibly consumed script API. Export pruning requires a separate
compatibility review.

## Parser dependency direction

Raw LostCity reading is already split into focused `lostcity-content-*` modules.
The core imports:

- `createLostCityRawSnapshot` from `lostcity-content-snapshot.ts`
- `LostCityContentSourceError` from `lostcity-content-config.ts`

The snapshot owner composes the focused config, item, equipment, combat,
monster, NPC-attack, loot, casket, requirements and runtime-mapping parsers.
None of those parser modules imports `game-data-generator-core.ts`. The accepted
direction is therefore:

```text
lostcity-content-* parser leaves
  -> lostcity-content-snapshot
  -> game-data-generator-core
  -> generation CLI / impact reporter
```

A future split must not recreate raw parsing inside the generator core or add a
back-edge from parser leaves to generator planning, evidence or writing.

## Current responsibility seams

The core's concerns are large but identifiable:

1. Generator versions, path constants, errors and public plan/output contracts.
2. Repository-local source/output planning and path containment.
3. Normalized source-slice fixture contracts.
4. Representative and all-monster calculation-impact case definitions.
5. Candidate snapshot normalization, schema validation and source pin creation.
6. Deterministic impact evidence and Markdown formatting.
7. Generated game-data, source-pin and revision-impact output assembly.
8. Output-hygiene validation and final file writing.

The impact definitions and output assembly legitimately change together during a
revision feature because the report is review evidence for the artifact. File
distance alone does not prove incorrect ownership.

## Accepted contracts

Retention must preserve:

- the current `game-data-generator-core.ts` import path for all consumers
- repository-contained source and output paths, including symlink-aware checks
- the exact generated output set and normalized relative paths
- no raw upstream dump, historical snapshot archive or external scratch output
- duplicate-key-safe and schema-valid normalized JSON
- deterministic source pin, game-data snapshot and revision-impact text for
  identical explicit inputs and generation time
- the committed source revision/provenance and generator version semantics
- representative impact status, all-monster advisory scan and bounded finding
  limits
- output hygiene before any write and no partial accepted output set
- raw parser ownership in the existing `lostcity-content-*` leaves
- the current CLI error classes/codes and actionable sanitized messages

Production runtime code consumes only committed generated artifacts through
`src/adapters/generated`. It must not import generator scripts.

## Non-goals

- No file split solely to reduce 3,170 lines or 42 exports.
- No broad `helpers.ts`, `utils.ts` or catch-all evidence module.
- No public export removal, rename or compatibility re-export churn.
- No new raw LostCity parser or second source normalization truth.
- No generated value, source pin, accepted impact baseline, report copy or
  artifact byte change.
- No output outside the repository.
- No simultaneous Trip refactor; its calculation contracts and activation
  evidence are separately owned.

## Reopen triggers

A generator split becomes active only with at least one demonstrated condition:

- repeated revision features scatter across the same distant plan, evidence and
  output seams and materially impair review or ownership
- a defect, revert, partial-write incident or recurring merge conflict is caused
  by co-located responsibilities
- a new independent consumer needs planning, source-slice, impact or output
  logic but the current core exposes unrelated filesystem or parsing
  dependencies
- a focused concern cannot be tested without constructing unrelated generator
  state, and extraction would remove the isolation barrier
- a parser/core back-edge, cycle or duplicated raw parsing truth appears
- output hygiene or determinism requires an independently reusable boundary
- continuing change history shows renewed sustained growth rather than the
  current one-foundation-commit pattern

Line count, navigation cost, 28 internal-only exports or a single revision
feature touching evidence plus output does not activate a split by itself.

## Target shape if activated

Keep `scripts/game-data-generator-core.ts` as the compatibility facade during
the first structural pass. The intended acyclic direction is:

```text
generator-contracts
  -> generation-plan-and-paths
  -> source-slice-normalization
  -> impact-evidence
  -> output-assembly-and-hygiene
  -> output-writer
```

Raw `lostcity-content-*` parser leaves remain below source snapshot composition
and outside these generator-internal owners. The CLI and impact reporter import
only the stable facade until the new public boundary is explicitly accepted.

The first pass must be behavior-preserving:

1. Characterize the activated seam with direct tests.
2. Move contracts and pure formatting/normalization before filesystem writing.
3. Preserve the exact public facade and error behavior.
4. Keep one output-hygiene gate immediately before writes.
5. Prove identical JSON/Markdown bytes for a fixed fixture, source revision and
   generation timestamp.
6. Run the focused generator/parser suites and full repository gate before
   claiming completion.

## Guard policy

The current executable guards are sufficient:

- `data-generator.test.ts` owns path containment, source/output planning,
  normalized fixtures, deterministic generation, output hygiene, impact
  evidence and report formatting
- `lostcity-source-parser.test.ts` owns raw parser contracts without importing
  the generator core
- a repository-local fixture dry run exercises the real CLI path without
  writing accepted outputs
- `npm run typecheck` owns script/type integration
- `npm run verify` owns unit, golden, architecture, production build/artifact,
  lint, format and diff gates

The production architecture graph intentionally excludes `scripts/**`, so
`architecture:check` is not claimed as a script-cycle proof. Direct import
search owns the no-back-edge evidence. A source-text line/export-count test
would freeze observations rather than behavior and is not added.

## Implementation

The accepted implementation is retention with explicit generator-only
monitoring:

- generator production source, public exports and generated artifacts remain
  unchanged
- this specification is linked from architecture, testing, backlog and the
  D-096 assessment
- the combined assessment remains historical evidence
- future generator split proposals must cite a reopen trigger and identify the
  exact plan, normalization, impact, output or writer seam they address

## Acceptance checks

```sh
npm run typecheck
npm run test -- src/tests/data-generator.test.ts src/tests/lostcity-source-parser.test.ts
npm run data:generate -- --source-dir src/tests/fixtures/data-generator/lostcity-content --output-root .vite/data-generator-output --generated-at 2026-07-08T00:00:00.000Z --dry-run --skip-calculation-impact
npm run verify
git diff --check
```

Do not run a real revision generation or rewrite committed artifacts for this
documentation-only retention closure. Raw-source audit/impact commands are
required when source parsing or accepted revision data changes, not when the
core source is unchanged.

## Implementation evidence

- Source/reference inspection confirms 3,170 lines, 42 exports, 14
  repository-external references and 28 internal-only exports.
- Consumers are limited to the generation CLI, impact reporter and focused
  tests. No `lostcity-content-*` parser imports the generator core back.
- No TODO/FIXME, type/lint suppression, revert/conflict or post-foundation
  growth/repair loop was found.
- The focused generator/parser suites pass 56/56.
- The fixture-owned real CLI dry run resolves 371 items and 65 monsters,
  reports the exact source-pin/game-data/revision-impact output set under
  `.vite/data-generator-output` and writes no files.
- Full `npm run verify` passes 71 test files / 770 tests plus 19 explicit
  goldens, architecture 121/109, typecheck, build/artifact, lint, format and
  diff gates.
- The artifact remains 10 files / two assets / 1,977,466 bytes with entry
  JavaScript 720,528 raw / 208,747 gzip and SHA-256
  `057c148f8b029a61bb0ef967418ca11c2403529765ccb93463a8f39745fc8720`.
- Generator source, public exports and committed generated artifacts are
  unchanged.

## Open questions

- None for retention. The exact internal file layout remains conditional on the
  concrete trigger so this document does not invent speculative architecture.

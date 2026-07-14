# Trip and game-data generator structural split assessment

Status: completed on 2026-07-14 under D-096. This is an assessment, not an
implementation specification.

Follow-up: the Trip half now has an implemented, independently actionable
[retention and split-trigger specification](trip-domain-retention-spec.md).
The generator half likewise has an implemented
[retention and split-trigger specification](game-data-generator-core-retention-spec.md).
This combined document remains the evidence snapshot; the two direct contracts
own future activation and validation independently.

## Question

Should `src/domain/trip/index.ts` and `scripts/game-data-generator-core.ts` be
split now, or only after a concrete maintenance problem is demonstrated?

Large line counts and broad export lists are risk signals, but they do not by
themselves prove that a structural rewrite will reduce defects or delivery
cost. This assessment therefore looks for observed change scatter, dependency
pressure, test-isolation failures, conflicts/reverts and consumers forced
through unrelated responsibilities.

## Decision criteria

A split is active work only when at least one of these conditions is evidenced:

- a defect, revert or merge conflict is attributable to unrelated
  responsibilities sharing the file;
- repeated changes for one concern must edit multiple distant seams and make
  review or ownership materially harder;
- a cycle, architecture exception or environment-specific dependency is needed
  to reuse one concern independently;
- focused tests cannot exercise one concern without constructing unrelated
  state or duplicating broad fixtures; or
- another consumer needs an internal concern and the current barrel/core would
  expose unrelated runtime or I/O dependencies.

Line count, navigation inconvenience and unused `export` modifiers remain
supporting signals. They are not sufficient activation criteria on their own.

## `src/domain/trip/index.ts`

### Current evidence

- The module is 3,097 lines and contains 55 exported declarations. Repository
  reference search finds external references for 29; 26 are used only inside
  the file. The internal-only exports are a future surface-hygiene opportunity,
  not evidence that current consumers are coupled to them.
- The current public consumers import the `src/domain/trip` barrel. They do not
  reach into internal paths, and the source architecture graph reports no cycle
  or exception.
- Responsibilities have recognizable contiguous seams: shared contracts and
  policy tables, potion recommendations, loot valuation, cannon/scarce-spot
  calculation, incoming damage, trip capacity, supply cost and final
  orchestration.
- The file has 11 commits in the available history. It started as a 2,097-line
  rewrite foundation; later work added roughly 1,264 lines and removed 264 while
  implementing real product/data behavior. The history contains no merge,
  conflict-marker, revert or fix-labelled evidence tied to the file.
- Recent changes are explainable by their domain seams. `e350e23` added the
  source-backed incoming-damage descriptor and the adjacent Trip/orchestration
  integration. `19c9557` changed casket/dynamic-price valuation and the same
  price lookup metadata used by supply costs. Moving those regions to separate
  files would improve navigation, but it would not remove their legitimate
  orchestration or price-policy coordination.
- The focused Trip suite passes 42/42 and covers loot, exact/fallback pricing,
  incoming damage, cannon, potion/prayer/recoil/food capacity and legacy golden
  parity. Full repository evidence additionally owns 19 goldens and the numeric
  cross-path audit.
- No TODO/FIXME, type-suppression or demonstrated test-isolation blocker was
  found in the implementation.

### Assessment

No concrete maintenance defect currently justifies a standalone Trip split.
The module is large, but its dependencies are explicit, the calculation flow is
pure, consumers use one stable boundary and the tests exercise the recognized
seams. Splitting now would create a broad file-move review and new internal
imports without resolving an observed bug, cycle or delivery bottleneck.

The safe future shape remains a stable `src/domain/trip` facade over separate
contract/configuration, loot valuation, incoming-damage, trip-capacity/cannon
and supply/orchestration owners. That shape should be specified only after an
activation criterion is met; the first structural pass must not change formulas,
prices, persistence policy or result shapes.

## `scripts/game-data-generator-core.ts`

### Current evidence

- The core is 3,170 lines and contains 42 exported declarations. Only 14 have
  references outside the file; 28 are currently internal-only exports.
- External use is narrow: the data-generation CLI, the direct source-impact
  reporter and the generator test suite. No production application module
  imports the script core.
- Raw LostCity parsing is already delegated to focused `lostcity-content-*`
  modules. The remaining core owns repository-local planning/path checks, the
  normalized source-slice fixture contract, calculation-impact fixtures and
  evidence, report assembly, output hygiene and writing.
- The file has seven commits in the available history. It began at 787 lines;
  the source-backed runtime foundation commit `10ed39d` added 2,502 lines and
  removed 131, producing almost the entire current structure in one feature
  build. Across the following five commits the net size changed by only 12
  lines (100 additions and 88 removals). There is no continuing growth trend,
  revert, conflict or repair loop proving current ownership is failing.
- `d34e7ab` touched representative cases, accepted-change/report copy and output
  assembly for one source-requirement/NPC-size feature. Those edits are distant,
  but they are also the expected evidence and artifact surfaces of the same
  revision change. A split would distribute that review across files rather
  than eliminate it.
- Reference search finds no import back-edge from the LostCity parser modules
  into the generator core. Typecheck passes. The source architecture gate does
  not cover `scripts/**`, so it is not used as evidence for script-cycle safety.
- The focused generator suite passes 35/35 across path bounds, source parsing,
  schema/output hygiene, deterministic generation, diff/report formatting,
  representative impact and all-monster evidence.
- No implementation TODO/FIXME, type suppression or demonstrated inability to
  test a concern independently was found.

### Assessment

No standalone generator split is necessary now. The module has clearer future
extraction seams than Trip, especially the large static impact-case/evidence
section, but the history shows one foundation expansion followed by stability
rather than accumulating maintenance churn. Its narrow consumer set and strong
deterministic tests reduce the immediate value of a move-only refactor.

If activated later, preserve a small compatibility facade while separating:

1. plan, path and output-hygiene contracts;
2. normalized source-slice fixture parsing;
3. representative/all-monster impact evidence and Markdown formatting; and
4. snapshot/report assembly plus output writing.

The raw production LostCity parsers must remain in their existing focused
modules; a future split must not recreate a second raw parsing truth.

## Decision and reopen boundary

D-096 changes both backlog entries from `Open` to `Conditional`. No source file
is split in this assessment.

Reopen the relevant split when code/history demonstrates one of the decision
criteria above. A later implementation goal must first characterize the current
exports and deterministic outputs, define an acyclic internal dependency
direction, keep the existing facade during migration and prove unchanged
golden/numeric or generated-artifact evidence as applicable.

There is no unresolved architectural question at this time. The evidence needed
to change the decision is operational change history, not another size audit.

## Validation evidence

The assessment used repository source/import searches, exported-symbol
reference counts and file-specific Git history. Current gates passed:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/trip-loot-supply.test.ts src/tests/data-generator.test.ts
```

The focused run passed 77/77 tests. No calculation, generator, persisted data,
artifact, UI or public export behavior changed, so golden, numeric, build and
browser gates were not rerun for this documentation-only decision.

# Legacy Planner parity and gap-audit specification

- Status: implemented repository-locally; classified baseline current
- Date: 2026-07-10
- Owner: technical testing and Planner domain
- Source: `docs/project/backlog.md` conditional legacy Planner parity work
- Related evidence: `planner-core.js`, `src/domain/planner/index.ts`,
  `src/tests/planner-parity.test.ts`,
  `docs/project/planner-parity/current.md`

## Feature-inventory check

Planner is `Valmis` in `docs/product/feature-inventory.md` for the accepted V1
rewrite replacement workflow. This specification does not reopen that feature,
change its status or claim that a user-visible Planner capability is missing.
It defines optional comparison evidence for the archived Planner algorithm.

The work is not a duplicate of active Planner implementation. Current tests own
deterministic rewrite-domain behavior, while this audit identifies and
classifies differences against `planner-core.js`. Any future product change
found by the audit requires a separate accepted decision and a scoped
implementation card.

## Implementation evidence

- `src/tests/helpers/legacy-planner.ts` loads only the fixed repository
  `planner-core.js` file in the existing in-memory Node VM runtime.
- `src/tests/helpers/planner-parity.ts` owns normalization, bounded field-level
  comparison, digests, baseline checks and deterministic Markdown output.
- `src/tests/fixtures/planner-parity-cases.ts` contains 16 representative cases
  and 32 reference-context/current-product comparisons.
- `src/tests/fixtures/planner-parity-baseline.json` records 29
  `accepted-rewrite-delta` and three `source-data-delta` classifications, with
  zero `rewrite-gap`, `needs-review` or `not-representable` rows.
- D-071 refreshed 13 current-product digests after generated requirement rows
  removed only the D-051 manual-fallback warning; reviewed training, numeric,
  configuration and transition deltas stayed unchanged.
- D-081's source-backed incoming-damage migration later added the expected
  `incoming-attack-compatibility-fallback` warning to all 16 legacy-derived
  reference-context rows and `incoming-attack-partial-model` to two
  current-product magic rows. The 2026-07-17 review confirmed that training
  order and the existing bounded numeric, configuration and transition
  differences were unchanged, then refreshed the classified digests and
  generated report.
- `docs/project/planner-parity/current.md` is the generated current report.
- `npm run planner:parity` runs the focused Planner tests and checks/writes the
  classified report without updating the reviewed baseline.

The implementation changes no production module or Planner behavior.

## Goal

Create a deterministic, repository-local audit that compares representative
archived legacy Planner behavior with `src/domain/planner` and produces a
reviewable gap report. The audit must distinguish algorithm differences from
game-data revision differences and intentional rewrite decisions.

The archived implementation is comparison evidence, not product truth. A
difference must never update rewrite code, current golden fixtures or accepted
documentation automatically.

## Current baseline

The accepted rewrite Planner already provides:

- a pure domain implementation behind explicit `PlannerInput`,
  `PlannerOptions` and `SimulationContext` contracts;
- current-XP handling, target levels, skill locks, metric selection,
  sustained evaluation, current-gear locking and bounded gear pools;
- greedy level ordering, unlock thresholds, spell progression, phases and gear
  transitions;
- generated item requirements with the D-051 manual fallback;
- four deterministic rewrite-owned golden cases and visible Planner browser
  coverage.

The implemented audit adds 16 bounded behavior cases. Skill order and bounded
control behavior match in every comparison. Remaining differences are accepted
rewrite-owned warning/scoring/transition deltas or, in three magic
current-product comparisons, Revision 274 source-data deltas.

The archived `planner-core.js` provides a pure `window.SimPlanner` calculation
surface, but depends on archived `SimEngine`, `Equipment` and `GameData`
globals. It also contains future/hypothetical weapons, manual requirement data
and behaviors that are not accepted rewrite requirements.

Known structural differences that the first audit must expose rather than
silently reconcile include:

- legacy metric id `bal` versus rewrite metric id `balanced`;
- legacy future-weapon candidates, which D-047 excludes from V1;
- legacy armour selection heuristics versus rewrite domain-evaluated candidates;
- legacy three-level transition-run smoothing versus current rewrite transition
  derivation;
- source-backed Revision 274 data and generated requirements versus archived
  legacy data/manual requirements;
- rewrite fixes where candidate weapon stance selection or other accepted domain
  behavior intentionally differs from a legacy defect.

This list is an audit seed, not a pre-classification. The report must support
additional findings without treating them as accepted gaps.

## Non-goals

- Importing, parsing or migrating legacy `sim_planner_v1` browser state.
- Loading `planner.jsx`, reproducing legacy Planner UI state or matching legacy
  layout and copy.
- Restoring future or hypothetical gear.
- Copying known legacy bugs or making archived calculations authoritative.
- Removing or demoting the D-051 manual requirement fallback.
- Deciding authoritative requirement fields, quest requirements, game revision
  policy or hidden gear tiers.
- Changing current Planner algorithms, golden fixtures or user-visible output as
  part of the audit implementation.
- Adding a provider, live upstream call, backend, database, account, auth,
  tenant, payment or admin surface.
- Running all monsters or an unbounded level/pool scan.
- Adding legacy execution to the production root bundle.

## Truth and decision policy

Use this order when a mismatch is found:

1. Current rewrite contracts and accepted decisions define supported product
   behavior.
2. Current source-backed `GameDataSnapshot` defines production game data.
3. Archived legacy output is regression and gap-discovery evidence.
4. A classified, human-accepted gap may become a later rewrite work item.

The audit may prove that two implementations differ. It may not decide that the
rewrite is wrong merely because the legacy output is different.

## Comparison modes

### Reference-context mode

Run `planner-core.js` with its archived dependencies and run the rewrite Planner
through the existing legacy-derived test context. This mode reduces current game
revision and price-source noise, so structural plan differences are easier to
attribute to Planner behavior.

Reference-context mode is the primary algorithm audit. Even here, intentional
rewrite fixes and domain-contract changes remain valid classifications.

### Current-product mode

Run the rewrite Planner with the committed source-backed Revision 274 runtime
and compare its normalized result with the archived reference result for the
same representable request.

This mode is informational. A difference may be caused by weapons, equipment,
prices, monsters, requirements or formulas that supersede archived data. It must
not be labeled a Planner gap until the same difference is isolated in
reference-context mode or supported by separate evidence.

Every report row must record its comparison mode.

## Test-only legacy adapter

Add `src/tests/helpers/legacy-planner.ts` as the only new legacy Planner loader.
It must:

- start from `createLegacyRuntime()` in
  `src/tests/helpers/legacy-sim.ts`;
- evaluate only the fixed repository file `planner-core.js` in that existing
  Node `vm` context;
- expose a narrow typed adapter for `defaultPool()` and `buildPlan()`;
- deep-clone inputs and normalized outputs across the VM boundary;
- reject unsupported metric ids, unknown skills, non-finite numbers and
  oversized targets/pools before execution;
- never accept a caller-supplied source path or JavaScript source string;
- never load `planner.jsx`, browser profiles or real `localStorage` data.

Do not add `planner-core.js` to production adapters or the normal root runtime.
The existing in-memory storage shim remains empty for this audit.

## Shared case contract

Add `src/tests/fixtures/planner-parity-cases.ts`. A case definition must contain
only the inputs that can be represented safely in both planners:

- stable case id and short intent;
- comparison modes to run;
- combat style and monster id;
- starting levels and optional bounded current XP;
- target levels and skill locks encoded as target equals current level;
- normalized metric id;
- weapon, ammo, spell, gear and finite candidate pools;
- sustained and current-gear lock flags;
- bounded `maxLevels`;
- expected classification for known, reviewed deltas only.

The adapter maps rewrite `balanced` to legacy `bal`. A case must not contain
future gear, hypothetical gear, player names, persisted UI state, raw source
objects or arbitrary executable values.

## Normalized result contract

Both adapters must emit the same JSON-safe audit shape. Keep only fields needed
to explain Planner behavior:

- case id, comparison mode, combat style and normalized metric;
- selected skills, starting levels, targets, total XP and truncation state;
- start and end DPS/metric plus selected weapon, spell and armour ids;
- ordered steps with skill, from/to, delta XP, cumulative XP, DPS, metric and
  selected configuration ids;
- coalesced phases with skill, from/to, XP, cumulative XP, start/end DPS and
  start/end metric;
- transitions with slot, type, current/previous item id, binding skill/level,
  step index, cumulative XP and DPS before/after;
- sanitized rewrite warning codes, without raw provenance or parser messages.

Do not compare display names as identity. Names may be included in a report only
as sanitized supplemental labels after ids have matched or differed.

Round serialized floating-point values to six decimal places. Preserve integer
XP, levels, indexes, ids, booleans and ordering exactly.

## Representative case matrix

The first audit must remain bounded and include at least these cases:

1. Existing melee rune-scimitar Attack unlock case.
2. Existing ranged yew-shortbow unlock case.
3. Existing magic spell unlock case.
4. Existing boosted sustained Strength path.
5. Melee Attack-versus-Strength greedy ordering across a max-hit boundary.
6. Defence training with an armour unlock in the active pool.
7. Ranged longrange Defence training and stance selection.
8. Magic Defence training with a spell ladder.
9. Partial current XP within the starting level.
10. One locked skill encoded by a current-level target.
11. Current-gear lock with no candidate replacement.
12. `gph` and `balanced` evaluation, including a negative-economy setup.
13. No-work target where every target equals the starting level.
14. Deliberate `maxLevels` truncation.
15. A transition sequence that exercises the legacy three-level run smoothing.

A two-handed weapon/shield case may be added only when both adapters can express
the same current-revision item set without hypothetical gear. Unsupported cases
must be reported as `not-representable`, not weakened until they happen to pass.

Do not expand this matrix into every monster or every equipment combination.

## Difference classifications

Every non-match must use exactly one classification:

- `accepted-rewrite-delta`: an existing accepted decision or documented rewrite
  contract explains the difference.
- `legacy-defect`: evidence shows the archived result is caused by a known bug
  that must not be copied.
- `source-data-delta`: different accepted data revisions, prices, requirements or
  provenance explain the difference.
- `rewrite-gap`: the rewrite omits behavior that has been explicitly accepted as
  required.
- `not-representable`: the safe shared case contract cannot model the legacy
  input on the accepted rewrite boundary.
- `needs-review`: available evidence cannot yet classify the difference.

`match` is a result state, not a difference classification. A new finding starts
as `needs-review`; neither the report writer nor a snapshot update may promote it
to `rewrite-gap` automatically.

Each reviewed classification must include a short reason and a source reference
to code, tests, feature inventory or an accepted decision. Do not add a new
accepted decision to `docs/project/decisions.md` without explicit user approval.

## Numeric and structural comparison

In reference-context mode:

- compare XP, levels, ids, ordering, truncation and target/skill sets exactly;
- compare normalized numeric values using absolute and relative deltas after
  six-decimal serialization;
- record a numeric mismatch when `absDelta > 0.000001` and
  `relativeDelta > 0.000001`;
- report step, phase and transition shape differences separately from numeric
  differences.

In current-product mode, calculate the same deltas but treat them as
informational until their cause is classified. Never loosen structural checks to
hide a data-source difference.

## Report and baseline ownership

The implementation owns these files:

- `src/tests/planner-parity.test.ts`: adapter validation, determinism, required
  case coverage and normalized contract tests;
- `src/tests/fixtures/planner-parity-baseline.json`: reviewed classifications and
  bounded normalized expectations;
- `scripts/report-legacy-planner-parity.ts`: deterministic report writer;
- `docs/project/planner-parity/current.md`: generated current audit summary;
- `npm run planner:parity`: run focused tests and write/check the report through
  the repository's existing TypeScript script runtime.

The report must include case counts by mode and classification, then concise
field-level differences. It must not embed raw VM objects, complete source data,
absolute paths, stack traces or raw parser diagnostics.

Baseline updates must be explicit and reviewed. The normal command must fail on
an unrecorded structural difference or missing required case; it must never
rewrite the baseline as failure recovery.

## Gate policy

Use two stages so discovery does not create a false merge promise:

1. Discovery stage: adapter/schema/determinism failures are blocking;
   `needs-review` differences are written to the report and make the audit status
   incomplete.
2. Classified stage: after every finding has a reviewed classification, the
   command is eligible for a local merge-blocking test role. Accepted deltas and
   source-data deltas pass only while their reviewed baseline remains unchanged.

This specification does not accept the classified stage as a remote CI check or
choose a CI provider. It defines repository-local behavior only.

The current baseline is in the classified stage with zero open review rows and
zero approved rewrite gaps. It is a local gate only.

## Performance and failure handling

- Cap every level target to `1..99`, every case to at most 120 generated steps
  and the initial suite to at most 20 cases.
- Cap each pool per slot and reject duplicate or unknown ids before execution.
- Use a focused per-case timeout and print only the case id on timeout.
- Sort cases and object keys before serialization.
- Run the same case twice in tests to prove deterministic normalized output.
- Convert invalid legacy output into a sanitized adapter error; do not continue
  with partial objects.
- A timeout, invalid number, missing required field or nondeterministic result is
  a blocking test failure, not a Planner mismatch classification.

## Security and privacy

- Execute only fixed, committed legacy source files in a Node `vm` test context.
- Do not expose a generic code-execution helper or accept paths from fixtures.
- Do not use network access, live hiscores, live prices or browser profile data.
- Use repository fixtures and in-memory state only.
- Keep raw provenance payloads, source text, local absolute paths and internal
  parser issue text out of generated reports.
- Bound all case inputs before the expensive Planner loop.

There is no auth, account, tenant, payment, database, permission or admin impact.
The audit creates no tenant model or tenant data.

## Implementation goals

### Goal 1: Test-only legacy Planner adapter and normalized contract (`Done`)

Implement the fixed-source VM adapter, shared safe case schema, metric mapping
and normalized result serializer. Add tests for invalid input, unknown ids,
non-finite output, deterministic execution and absence of production imports.

Done when the legacy Planner can execute one bounded current-revision-compatible
case in tests and both planners produce the documented JSON-safe shape. Do not
add parity assertions, UI-state parsing or production wiring in this goal.

### Goal 2: Representative parity matrix and gap report (`Done`)

Implement the required case matrix, both comparison modes, field-level diffing,
classification schema, deterministic report writer and reviewed initial
baseline. Reuse the four existing Planner golden intents without replacing
their rewrite-owned expected results.

Done when every required case is matched, classified or explicitly
`needs-review`, repeated runs are byte-stable and the report separates
algorithm/reference findings from current-product data findings.

### Goal 3: Approved rewrite-gap closure (`Not needed`)

This goal starts only if Goal 2 contains a human-approved `rewrite-gap`. Create
one scoped backlog card per accepted gap, add focused rewrite-domain tests first
and implement only that behavior. Preserve D-047, D-048 and D-051.

Stop for a decision when a finding is `needs-review`, conflicts with an accepted
decision, requires a provider/source policy or would copy a legacy defect. An
audit with zero accepted rewrite gaps completes without production code changes.

The initial classified audit found no `rewrite-gap` or `needs-review` row, so no
production change or new decision was opened.

### Goal 4: Evidence and documentation closure (`Done`)

Update `docs/technical/testing.md`, `docs/technical/rewrite-parity-report.md`,
`docs/project/backlog.md` and the generated current audit report with the commands,
classifications and remaining decision boundaries. Update feature inventory only
if a separately accepted user-visible Planner change actually alters its note;
the audit alone leaves Planner `Valmis`.

## Validation commands

Run at least:

```sh
npm run test -- src/tests/planner-parity.test.ts src/tests/planner-domain.test.ts
npm run planner:parity
npm run typecheck
git diff --check
```

Do not run live upstream tests. Browser tests are unnecessary for Goals 1 and 2
because they add test-only domain evidence and no visible workflow. Run focused
Playwright only if a separately accepted Goal 3 changes visible Planner output.

## Done criteria for this specification

- The comparison authority and two modes are explicit.
- Test adapter, case, normalizer, classification, report and baseline ownership
  are implementation-ready.
- The representative matrix covers the accepted Planner workflow without future
  gear or persisted legacy UI state.
- Security, resource bounds and sanitized failure behavior are specified.
- Production changes require a separate accepted `rewrite-gap` decision.
- Planner remains `Valmis`; the audit backlog card is complete.

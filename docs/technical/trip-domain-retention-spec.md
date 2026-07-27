# Trip domain retention and split-trigger specification

- Status: implemented
- Date: 2026-07-14
- Owner: technical documentation
- Evidence: verified
- Contract: living

## Purpose

This specification turns the Trip half of D-096's combined structural
assessment into an implementation-grade maintenance contract for
`src/domain/trip/index.ts`. The accepted implementation is to retain the current
single public module until a concrete maintenance trigger appears. It does not
authorize a size-driven move-only split.

The original evidence remains in
[large-module-structural-split-assessment.md](large-module-structural-split-assessment.md).
This document owns the Trip-specific invariants, future dependency direction,
activation criteria and validation recipe.

## Verified current inventory

Source and reference inspection on 2026-07-14 records:

- 3,097 lines and 55 exported declarations
- 29 exported names referenced outside the file and 26 currently used only
  inside the file
- one stable `src/domain/trip` import boundary; consumers do not reach through
  internal paths
- 11 file-history commits, with no merge, revert, conflict-marker or fix-labelled
  maintenance loop attributable to co-located responsibilities
- no TODO/FIXME, TypeScript suppression or lint suppression
- 42 focused Trip/loot/supply cases plus golden and numeric cross-path evidence
- no source-graph cycle, layer exception or environment-specific dependency

The internal-only exports are surface-hygiene evidence, not authorization to
remove a potentially consumed TypeScript API. Export pruning requires a
separate compatibility review.

## Current responsibility seams

The module's concerns are large but recognizable and locally ordered:

1. Public input/result contracts and static Trip policy tables.
2. Potion carry recommendation and boost-duration policy.
3. Loot identities, default actions, dynamic dependency inventory, casket and
   other composite valuation.
4. Cannon overlay and scarce-spot limits.
5. Prayer cycle and source-backed/partial incoming-damage descriptors.
6. Inventory, food, prayer, recoil and banking trip-capacity calculation.
7. Ammo, rune, potion, food, recoil and cannon supply pricing.
8. Final `simulateTripLootSupply()` orchestration and warning assembly.

These seams legitimately meet in the final calculation. Price lookup metadata
and warnings are shared policy, not accidental coupling between unrelated
features.

## Accepted contract

Retention must preserve:

- the existing `src/domain/trip` public import path and exported runtime/type
  surface
- pure calculation behavior with no React, DOM, storage, fetch or file I/O
- `TripLootSupplyInput` and `TripLootSupplyResult` shapes
- exact-first PriceSet lookup, alias/fallback warnings and generated high-alch
  ownership
- loot row identity, action, conditional-eligibility and dynamic-price
  dependency behavior
- incoming-damage coverage/source labels and compatibility fallback semantics
- cannon/scarce, Trip capacity, supply cost and final orchestration formulas
- warning codes, severity and deterministic ordering where tests expose them
- all golden/numeric calculation evidence

No persistence policy belongs in this module. App/state/view-model consumers may
adapt the result but may not create a second Trip calculation truth.

## Non-goals

- No file split solely to reduce 3,097 lines or 55 exports.
- No broad `internal.ts` or catch-all utilities module.
- No public export removal, rename or compatibility re-export churn.
- No formula, PriceSet, source-provenance, warning, fixture or result-shape
  change.
- No simultaneous cleanup of Trip and the game-data generator; their triggers,
  consumers and output contracts differ.
- No change to archived `trip.js`, which remains reference/golden evidence.

## Reopen triggers

A Trip split becomes active only with at least one demonstrated condition:

- a defect, regression, revert or recurring merge conflict is caused by
  unrelated Trip concerns sharing the file
- two or more feature changes repeatedly scatter across the same distant seams
  and make one responsibility materially hard to review
- an independent consumer needs loot, incoming-damage, capacity or supply logic
  but the current module forces an invalid dependency or cycle
- a focused concern cannot be tested without unrelated broad fixtures, and an
  extraction would remove that isolation barrier
- a layer exception, environment dependency or duplicate policy truth appears
- a public contract needs a versioned replacement and a compatibility facade is
  required
- performance profiling attributes a material accepted-budget breach to a
  separable Trip phase

Navigation cost, line growth, export count or a single cross-seam feature change
does not activate the split by itself.

## Target shape if activated

Keep `src/domain/trip/index.ts` as the stable facade. The first structural pass
may introduce direct internal owners in this dependency direction:

```text
contracts-and-policy
  -> loot-valuation
  -> incoming-damage
  -> capacity-and-cannon
  -> supply-costs
  -> orchestration
```

A more precise implementation may let orchestration depend on the four
calculation leaves in parallel, but leaves must not import orchestration or App
state. Shared PriceSet lookup/warning policy must have one owner rather than be
copied into loot and supply modules.

The first pass is behavior-preserving:

1. Characterize the activated seam with focused tests.
2. Move contracts or pure leaves before orchestration.
3. Keep public imports at `src/domain/trip`.
4. Avoid compatibility re-exports between internal leaves.
5. Prove no cycle or new client/archive reachability.
6. Require focused Trip tests, numeric audit, all goldens and full repository
   verification before claiming completion.

## Guard policy

The current executable guards are sufficient:

- `npm run architecture:check` owns layer direction, cycles and reachability
- `trip-loot-supply.test.ts` owns the direct 42-case domain boundary
- `numeric:audit` owns 5,958 cross-path comparisons
- `test:golden` owns the 19 explicit legacy fixtures
- market/data/schema suites own PriceSet and dynamic dependency inputs
- `npm run verify` owns type, build/artifact, lint, format and diff gates

A source-text line/export-count assertion would freeze observations rather than
behavior. This goal therefore adds no brittle count guard.

## Implementation

The accepted implementation is retention with explicit Trip-only monitoring:

- production source and public exports remain unchanged
- this Trip-specific contract is linked from architecture, testing, backlog and
  the D-096 assessment
- the combined D-096 assessment remains historical evidence; the generator gets
  its own separately implemented specification
- future Trip split proposals must cite a reopen trigger and identify the exact
  calculation seam they address

## Acceptance checks

```sh
npm run architecture:check
npm run typecheck
npm run test -- src/tests/trip-loot-supply.test.ts
npm run numeric:audit
npm run test:golden
npm run verify
git diff --check
```

No browser or visual run is required for a documentation-only retention closure.
Any later source change follows the calculation-impact rules in
`docs/technical/testing.md`.

## Implementation evidence

- Source/reference inspection confirms 3,097 lines, 55 exports, 29
  repository-external references and 26 internal-only exports.
- Consumers use the stable `src/domain/trip` boundary; architecture passes at
  121/109 with no cycle, exception or orphan.
- No TODO/FIXME, type/lint suppression, revert/conflict loop or focused
  test-isolation failure was found.
- The focused Trip suite passes 42/42, numeric audit passes 5,958/5,958 with
  zero mismatches and all 19 goldens pass.
- Full `npm run verify` passes 71 test files / 770 tests plus 19 explicit
  goldens, typecheck, architecture, build/artifact, lint, format and diff gates.
- The artifact remains 10 files / two assets / 1,977,466 bytes with entry
  JavaScript 720,528 raw / 208,747 gzip and SHA-256
  `057c148f8b029a61bb0ef967418ca11c2403529765ccb93463a8f39745fc8720`.
- Production Trip source and public exports are unchanged. No browser or visual
  run is claimed for this documentation-only retention implementation.

## Open questions

- None for retention. The future internal file layout remains conditional on the
  concrete trigger, because choosing it now would turn an evidence boundary into
  speculative architecture.

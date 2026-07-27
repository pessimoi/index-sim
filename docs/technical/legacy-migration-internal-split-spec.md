# Legacy migration internal split specification

- Status: implemented
- Date: 2026-07-14
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Activation-time trigger and problem

The 2026-07-14 architecture audit classified the then-monolithic
`src/app/state/legacy-storage-migration.ts` as a conditional maintenance risk. The
file was 1,799 lines and owned six independently reviewable concerns:

- the exact legacy-key allowlist and review policy
- metadata-only inspection orchestration
- setup, custom setup, cannon and Duel mapping
- Hiscores, loot and dense-compare preference mapping
- current-price import plus Planner and full-history review-only boundaries
- shared bounded parsing, sanitization and report bookkeeping

The pre-split implementation was behaviorally strong: 41 focused migration
tests and three migration view-model tests passed. The user then explicitly
activated the conditional split as a bounded maintenance goal. That was a
sufficient trigger for the implemented internal responsibility split, but it
did not authorize a broader migration product scope.

## Goals

- Keep `src/app/state/legacy-storage-migration.ts` as the only public migration
  owner and stable import path.
- Make each internal module correspond to one reviewable migration concern.
- Preserve one ordered metadata-only inspection pipeline and one report shape.
- Preserve exact-key detection and clearing, rewrite-owned-state precedence and
  the caller-owned atomic Apply transaction.
- Split the 1,256-line focused test owner along the same feature seams while
  preserving every existing scenario name and assertion.
- Leave the architecture graph cycle-free and free of new boundary exceptions.

## Non-goals

- No new legacy key, import target, schema, persisted version or UI copy.
- No change to D-042 compatible setup/custom/cannon import behavior.
- No import of D-048 Planner state or D-049 full price-history payloads.
- No move of caller-owned Apply/Keep/Clear transactions out of `App.tsx` and its
  existing legacy-migration presentation/controller boundary.
- No compatibility barrel exposed to production consumers and no direct imports
  from internal migration modules outside the public owner.
- No changes to calculations, generated data, providers, APIs or deployment.

## Compatibility contract

The implementation must keep all of these observables unchanged:

1. The public module exports the same constants, types and four functions:
   `LEGACY_INPUT_STORAGE_KEY`, `LEGACY_STORAGE_KEYS`,
   `LEGACY_STORAGE_KEY_POLICIES`, `detectLegacyStorageKeys`,
   `clearKnownLegacyStorageKeys`, `createLegacyStorageKeyReview` and
   `inspectLegacySetupMigration`, plus the current public report/policy types.
2. `LEGACY_STORAGE_KEYS` keeps its exact order and values. Detection reads only
   this allowlist. Clear removes only found keys from this allowlist and returns
   them in allowlist order.
3. Inspection performs no writes and does not clear, normalize or rewrite any
   stored value.
4. Existing rewrite-owned custom setups and Duel snapshots win conflicts. The
   existing cannon merge, snapshot limit and sanitized skip reasons remain
   unchanged.
5. The report remains metadata-only: raw Planner/history payloads and unsafe
   source values are never copied into warnings or presentation state.
6. D-048 `sim_planner_v1` and D-049 full price history remain review-only. Import
   and Keep preserve their keys; confirmed Clear may remove the exact known keys.
7. `inspectLegacySetupMigration()` still returns candidates only. The existing
   App-level Apply path remains the single atomic mutation boundary for setup,
   custom setup, cannon, Duel, preferences, Hiscores and selected PriceSet state.

## Target module ownership

All internal files live under `src/app/state/legacy-migration/`. They are
implementation details of the public sibling module.

### `contracts.ts`

Owns the exact key list, policy table, public report/options contracts and the
three exact-key policy operations. It may depend on type-only app/domain/storage
contracts, but not on any inspector or mapper.

### `report.ts`

Owns report creation, bounded duplicate-key-aware JSON parsing, sanitized
import/skip/warning bookkeeping and small shared structural helpers. It depends
only on `contracts.ts` and lower-layer parsing/storage-neutral contracts.

### `setup-mapper.ts`

Owns conversion of one validated legacy setup record into normalized rewrite
form state, including levels, combat style, equipment, selections, special
attack and Trip fields. It does not read storage and does not decide collision
precedence.

### `setup-inspector.ts`

Owns bounded `sim_input_v3` inspection plus custom setup, cannon and Duel
candidate handling. It owns collision precedence against the current rewrite
state and delegates one-record mapping to `setup-mapper.ts`.

### `preference-inspectors.ts`

Owns bounded Hiscores, loot preference, hidden-tier, compare-sort and irrelevant
monster inspection. It must return findings through the shared report and may
not write rewrite state.

### `price-review-inspectors.ts`

Owns compatible current PriceSet construction and the D-048 Planner/D-049 full
history review-only checks. It must not parse Planner or full-history payloads
beyond the existing bounded metadata needed for review messages.

### `legacy-storage-migration.ts`

Remains the public owner. It re-exports only the existing stable contract from
`contracts.ts` and composes the inspectors in the current order. No production
consumer imports `legacy-migration/*` directly.

The dependency direction is:

```text
legacy-storage-migration.ts
  -> setup-inspector.ts -> setup-mapper.ts
  -> preference-inspectors.ts
  -> price-review-inspectors.ts
  -> report.ts -> contracts.ts
```

No internal module may import the public facade, which prevents a facade cycle.

## Test ownership split

The current 41 migration scenarios are moved without semantic edits into:

- `legacy-migration-policy.test.ts`: exact detection/review/clear, metadata-only
  no-write behavior and review-only Planner/history boundaries
- `legacy-migration-setup.test.ts`: `sim_input_v3`, custom setup, cannon and Duel
  mapping, limits, precedence, sanitization and size bounds
- `legacy-migration-preferences.test.ts`: Hiscores, loot, hidden tiers, dense
  compare sort and relevance state
- `legacy-migration-prices.test.ts`: compatible PriceSet construction and every
  malformed, duplicate, unknown, invalid and oversized price path

`legacy-migration-view-model.test.ts` remains the presentation-contract owner.
A small test helper may own the shared bundled `GameDataSnapshot` load, but
production internals are tested only through the stable public facade.

## Implementation sequence

1. Record the 44/44 focused characterization baseline.
2. Add the contracts/report leaves and keep the public export surface exact.
3. Move pure one-record setup mapping, then setup-family inspection.
4. Move preference and price/review inspectors.
5. Reduce the public owner to ordered composition and existing re-exports.
6. Split the focused tests, preserving scenario names and total scenario count.
7. Update architecture, testing, backlog and audit follow-up evidence.

Each extraction must typecheck before the next responsibility is moved. Logic,
copy, fixture and baseline changes are not valid ways to make a moved test pass.

## Acceptance checks

Focused gates:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/legacy-migration-policy.test.ts src/tests/legacy-migration-setup.test.ts src/tests/legacy-migration-preferences.test.ts src/tests/legacy-migration-prices.test.ts src/tests/legacy-migration-view-model.test.ts
git diff --check
```

Completion gates:

```sh
npm run verify
npm run test:golden
npm run test:e2e -- --workers=1 --grep "reviews and imports compatible legacy setup data|keeps legacy data and dismisses the migration notice|clears only known legacy data after confirmation"
npm run test:e2e -- --workers=1
```

Run the full functional Chromium suite because this refactor touches every
migration candidate family used by the App-level atomic Apply transaction. Run
read-only visual comparison only if markup, copy or styling changes unexpectedly;
no visual baseline update is permitted for this refactor.

## Done criteria

- The public API and all 44 focused outcomes are unchanged.
- No production file imports an internal migration module except the public
  owner and its sibling internal modules.
- The former 1,799-line concentration is replaced by coherent modules with no
  new broad catch-all owner.
- Architecture, type, unit, golden, build/artifact, lint, format, diff and
  functional browser gates pass.
- The owning docs distinguish this completed internal split from the earlier
  adapter-to-app ownership move.

## Open questions

- None for this behavior-preserving split. Any new imported legacy area or
  different Planner/history policy requires a separate product/storage decision.

## Implementation evidence

- `legacy-storage-migration.ts` is a 92-line public facade. Six internal owners
  range from 127 to 510 lines and follow the specified dependency direction.
- The facade exports the same constants, types and four behavior functions as
  the pre-split owner. No other production module imports an internal migration
  path.
- Policy 7, setup 14, preferences 13, prices 7 and presentation 3 tests pass
  44/44 through the facade. The scenario names and assertions were retained.
- `npm run architecture:check` passes at 121 source / 109 client-reachable
  modules with seven external entrypoints and no cycle, exception or orphan.
- Full `npm run verify` passes 71 test files / 770 tests plus 19 explicit
  goldens, typecheck, build/artifact budgets, lint, format and diff checks.
- Focused Import/Keep/Clear Chromium passes 3/3 and the complete functional
  Chromium suite passes 78/78.
- The 10-file/two-asset artifact totals 1,977,466 bytes with SHA-256
  `057c148f8b029a61bb0ef967418ca11c2403529765ccb93463a8f39745fc8720`;
  entry JavaScript remains inside D-094 at 720,528 raw / 208,747 gzip bytes.
- No markup, copy or styling changed, so the specification did not require a
  new visual run or permit a baseline update. The latest prior read-only visual
  comparison remains 20/20.

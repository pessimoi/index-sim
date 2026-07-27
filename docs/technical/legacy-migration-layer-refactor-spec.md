# Legacy migration layer refactor specification

- Status: implemented
- Date: 2026-07-13
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Problem

`src/adapters/storage/legacy-migration.ts` is named and located as a generic
storage adapter, but its implementation maps archived browser payloads directly
into rewrite-owned form, Duel, Dense Compare, hidden-tier and loot-preference
schemas. The 2026-07-13 architecture audit therefore had to allow five exact
adapter-to-app dependency exceptions.

The mapping behavior is accepted product behavior under D-042, D-048 and D-049.
The problem is module ownership, not the migration contract or its calculations.

## Goals

- Make the rewrite app layer own the legacy-to-rewrite mapping policy and
  orchestration.
- Keep `src/adapters/storage` limited to generic key/value and versioned
  persistence helpers.
- Remove every adapter-to-app exception from `npm run architecture:check`.
- Preserve the complete exported migration API and all current browser behavior.
- Preserve exact storage keys, size limits, validation, sanitization, conflict
  handling and Import/Keep/Clear semantics.

## Non-goals

- No persisted-state version or schema change.
- No new legacy key, imported field or migration policy.
- No change to D-048 Planner review-only behavior or D-049 full price-history
  review-only behavior.
- No UI copy, layout, calculation, provider, backend or deployment change.
- No deletion of archived legacy runtime/reference files.

## Target ownership

### `src/app/state/legacy-storage-migration.ts`

Owns:

- `LEGACY_STORAGE_KEYS` and their policy table
- metadata-only legacy inspection and compatibility reporting
- legacy-to-rewrite form/state mapping
- exact known-key clearing
- migration report and policy types

It may depend on rewrite app-state schemas, domain contracts, data validators and
the generic `KeyValueStorage` interface.

### `src/adapters/storage/index.ts`

Continues to own only generic storage mechanics:

- `KeyValueStorage`
- memory storage
- versioned envelope loading, saving and clearing
- bounded parsing and non-fatal storage failure metadata

It must not import `src/app`.

### Consumers

- `src/app/App.tsx` imports migration orchestration from the app-state owner.
- `src/app/state/legacy-migration.ts` imports the legacy key enum from its sibling
  app-state module.
- the `src/tests/legacy-migration-*.test.ts` suites test the app-state migration
  owner through its stable public facade.

## Compatibility contract

The refactor must keep these observables unchanged:

- all exported constant, type and function names
- the exact ordered `LEGACY_STORAGE_KEYS` list
- the exact `LegacySetupMigrationReport` shape
- import collision precedence: existing rewrite-owned state wins
- inspection performs no writes
- Import keeps legacy keys
- Keep dismisses without deleting legacy keys
- confirmed Clear removes only detected allowlisted legacy keys
- size, duplicate-key, unsafe-key, unknown-id and schema failures remain bounded
  and sanitized
- D-048 `sim_planner_v1` and D-049 full legacy price history remain review-only

Because this is an ownership-only move, current focused tests are the behavioral
baseline; no fixture or screenshot update is permitted as failure recovery.

## Architecture gate

After the move:

- `documentedBoundaryExceptions` in `scripts/check-architecture.ts` is empty.
- `npm run architecture:check` reports zero documented exceptions.
- `rg` finds no import of `src/app` from `src/adapters`.
- no import cycle is introduced.

The checker retains its stale-exception failure behavior so a removed edge cannot
leave an obsolete allowance behind.

## Implementation sequence

1. Move the migration implementation into
   `src/app/state/legacy-storage-migration.ts` without logic edits.
2. Replace app-state alias imports with sibling-relative imports and import
   `KeyValueStorage` from `@/adapters/storage`.
3. Update `App.tsx`, the dismissed-state schema and focused tests to the new
   owner.
4. Remove the five architecture-check exceptions.
5. Update architecture, testing, backlog and D-091 documentation.

## Acceptance checks

Required focused checks:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/legacy-migration-*.test.ts src/tests/ui-adapters.test.ts
git diff --check
```

Required completion gates:

```sh
npm run verify
npm run test:e2e -- --workers=1 --grep "legacy setup data|legacy data|known legacy data"
```

The full functional browser suite is required only if the focused selectors or
the surrounding current worktree make the focused result ambiguous.

## Open questions

- None for this ownership-only refactor. Any broader legacy import scope still
  requires a separate product/storage decision.

## Implementation evidence

- The implementation now lives at
  `src/app/state/legacy-storage-migration.ts`.
- `src/adapters/storage` has no app-layer import or migration policy owner.
- `npm run architecture:check` reports 63 source modules, no cycles, 50
  client-reachable modules and zero documented exceptions.
- The focused migration and UI-adapter suites pass 92/92 tests.
- `npm run verify` passes 623 unit tests, 19 explicit legacy goldens,
  architecture/type/build/artifact/lint/format/diff gates and produces the
  unchanged 9-file artifact SHA-256
  `e4483f07ff847bab7209380bf6aed7926fe33826c51f51bf05bba4c85ff7b763`.
- The focused production-preview Import/Keep/Clear gate passes 3/3 Chromium
  tests and `npm audit` reports zero vulnerabilities.
- No persisted schema, storage key, import policy or browser copy changed.

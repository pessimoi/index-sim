# Duel-only legacy import readiness specification

- Status: implemented 2026-07-21; plan-derived readiness and Duel-only browser flow covered
- Date: 2026-07-21
- Priority: high
- Estimated effort: S
- Owner: legacy-migration view model, with existing App import transaction
- Feature-inventory parent: Legacy saved setup migration (`Valmis`)
- Depends on: the current sanitized legacy inspector and saved-Duel-setup merge policy

## Purpose

Allow a user whose only safely importable legacy data is `sim_input_v3.duelSetups`
to run the existing **Import compatible data** action.

The legacy inspector already validates those entries and creates rewrite Duel
snapshots. The import plan already lists the saved-setup area, and the App
transaction already merges and persists it. The current view-model readiness
predicate is the only missing link: it omits `report.duelSnapshots`, so the
button remains disabled even while the review says that saved setups are ready.

This goal removes that contradiction without broadening the legacy-data
allowlist, changing merge precedence or adding a new migration path.

## Verified current behavior and problem

- `inspectLegacyDuelSetups()` reads only the nested `duelSetups` array from the
  known `sim_input_v3` legacy object.
- Each candidate must have a non-empty name and an object setup. Computed result
  payloads are rejected, setup fields are mapped through the existing sanitizer
  and the resulting rewrite snapshot is schema validated.
- The inspector respects `MAX_DUEL_SNAPSHOTS`, skips rewrite-owned ids and sets
  `report.duelSnapshots` only when at least one entry is safely importable.
- `createImportPlan()` adds `Legacy setup comparisons into saved setup storage`
  whenever `report.duelSnapshots` is present.
- `createSummaryItems()` simultaneously reports `Saved setups ready`.
- `isImportReady()` checks every other supported report area but deliberately
  omits `report.duelSnapshots`.
- The panel disables **Import compatible data** from that boolean. A Duel-only
  report therefore exposes a non-empty plan behind a disabled action and labels
  the state `review only`.
- `App.tsx::importLegacySetup()` already treats Duel snapshots as actionable,
  merges them with rewrite state, persists `duel-snapshots`, unblocks replaced
  local state and dismisses the migration review.

The defect is a presentation/readiness split, not a missing persistence
transaction.

## Feature-inventory check

Legacy saved setup migration remains implemented. This specification fixes one
unreachable supported case inside the existing import workflow. It does not add
a new legacy key, new data type or broader migration promise.

The parent status remains `Valmis`. The backlog card is a release-readiness
finishing pass over the existing feature.

## User promise

If the review contains at least one compatible import area, including saved
Duel setups alone, **Import compatible data** is enabled and its status reports
the same compatible-area count shown by the import plan.

If no compatible area remains after validation, the action stays disabled and
the review remains review-only.

## Goals

- Make the visible import plan the single source of truth for readiness.
- Enable import when validated Duel snapshots are the only compatible area.
- Describe readiness in compatible areas rather than raw imported-field count.
- Reuse the existing App transaction, merge rules, storage schema and dismissal
  behavior unchanged.
- Preserve sanitized skip reasons and review-only disclosures.
- Add view-model, inspector and real-browser regression evidence for the
  Duel-only case.

## Non-goals

- Do not add another legacy key or accept a top-level Duel export envelope as
  legacy input.
- Do not import computed Duel results, invalid snapshots or unsupported setup
  fields.
- Do not increase the saved-setup cap or change generated ids and names.
- Do not replace a rewrite-owned snapshot when an imported generated id
  conflicts.
- Do not change the existing merge direction, migration dismissal, Clear/Keep
  actions, known-key deletion policy or legacy-key retention after Import.
- Do not add a per-snapshot preview, checkbox list, overwrite prompt or merge
  dialog.
- Do not add a separate Undo design for migration.
- Do not change active setup, custom setup, Cannon, Loot, Dense Compare,
  Hiscores, PriceSet, Planner or price-history migration semantics.
- Do not change any transfer schema, Worker, market, backend or deployment
  boundary.

## Required readiness contract

`createLegacyMigrationViewModel()` must derive readiness from the import plan it
already creates:

```ts
const importPlan = createImportPlan(report);
const importReady = importPlan.length > 0;
```

The exact implementation may use a named helper, but it must not maintain a
second hand-written list of report fields. This prevents the action gate and
the user-visible plan from drifting again when another compatible area is
added.

The current inspector contract ensures a saved-setup plan item is emitted only
when `report.duelSnapshots.snapshots` contains at least one validated entry. A
defensive empty state constructed outside the inspector must not become
actionable: either the report schema/refinement, `createImportPlan()` or both
must require a non-empty snapshot list.

### Status label

Replace raw `report.importedFields.length` readiness copy with the same unit as
the plan and outcome copy:

- `review only` when `importPlan.length === 0`;
- `1 compatible area` when the plan has one item; and
- `<n> compatible areas` otherwise, using the existing number formatter.

`importedFields` remains audit detail. It is unsuitable for this label because
one compatible area may record several field-level findings and because Duel
inspection records both snapshot and area markers.

Summary rows, outcome rows and plan order remain unchanged. In the Duel-only
case they must agree on all three facts:

- `Saved setups ready`;
- `Import action: 1 compatible area ready; legacy keys stay in storage.`; and
- enabled **Import compatible data** with status `1 compatible area`.

## Import transaction and precedence

The existing App transaction remains authoritative:

1. Re-inspection has already produced the validated candidate state.
2. Import invalidates the current saved-setup Undo entry through the existing
   Duel helper.
3. `mergeDuelSnapshots(current, imported)` applies the existing cap and
   collision policy.
4. The resulting state is persisted through the existing recovery-aware
   `duel-snapshots` owner and applied to React state.
5. Replaced recovery state is unblocked.
6. The migration review is dismissed with the existing imported-data status.

Current rewrite state wins on generated-id collisions. Valid imported entries
fill only remaining slots up to the existing cap. The Import action must never
silently replace, rename or reorder a rewrite-owned snapshot beyond the
behavior already centralized in `mergeDuelSnapshots()`.

The known `sim_input_v3` key stays in browser storage after Import, exactly as
the review promises. Only the separately confirmed Clear action deletes known
legacy keys.

## User-flow acceptance criteria

### Valid Duel-only legacy state

Given:

- no other compatible legacy area;
- `sim_input_v3` contains at least one valid `duelSetups` entry; and
- the rewrite has room for it;

then:

1. the migration panel appears;
2. the summary says `Saved setups ready`;
3. the import plan contains the saved-setup destination;
4. the status says `1 compatible area`;
5. **Import compatible data** is enabled;
6. activating it persists and displays the imported saved setup;
7. the active rewrite setup is not replaced merely because a Duel snapshot was
   imported;
8. `sim_input_v3` remains present;
9. the migration review is dismissed; and
10. reloading preserves the imported saved setup without showing the dismissed
    review again.

### Mixed valid and skipped Duel entries

If at least one Duel entry is valid, Import remains enabled. The outcome area
shows importable and skipped counts, and the review lists sanitized reasons for
the skipped entries. Only validated snapshots enter rewrite storage.

### No actionable Duel entry

If the Duel array is invalid, empty, over the safe review limit, entirely
rejected, entirely colliding with rewrite-owned ids or has no remaining slot:

- `report.duelSnapshots` is absent or non-actionable;
- `Saved setups skipped` or the existing no-data summary is shown as
  appropriate;
- the skip/review evidence remains visible;
- no saved-setup plan item is emitted; and
- Import stays disabled when no other compatible area exists.

### Existing rewrite collision and cap

An existing snapshot with the generated legacy id remains unchanged. A full
rewrite snapshot list remains unchanged. Neither condition may make the button
ready unless at least one other compatible area exists.

## Focus, accessibility and feedback

- Enabling the existing button must not change its label, DOM order or
  accessible name.
- The migration section keeps its existing accessible label and live status
  behavior.
- Keyboard and pointer activation use the same transaction.
- No hidden or focusable per-snapshot controls are added.
- After successful Import, focus behavior follows the current panel-dismissal
  contract; this goal does not introduce a replacement focus target.
- Visible errors and skip reasons remain sanitized; raw JSON and exception text
  are never rendered.

## Privacy and security

- All inspection and persistence remain local to the browser.
- Do not send setup values, player identifiers or legacy JSON to a server,
  telemetry endpoint or log.
- Preserve the duplicate-key check, byte and entry caps, safe-key checks,
  schema validation and computed-result rejection.
- Do not render raw rejected values in the DOM or include them in error copy.

## Implementation outline

1. Make non-empty `createImportPlan(report)` the readiness source in
   `src/app/view-models/legacy-migration.ts`.
2. Derive `statusLabel` from the same plan length and remove the duplicated
   report-field predicate.
3. Defensively prevent an empty Duel snapshot state from creating a plan item.
4. Replace the test that preserves the discrepancy with positive and
   non-actionable readiness cases.
5. Add a Duel-only inspector/merge regression around cap and collision
   behavior if the existing suites do not already cover every branch.
6. Add one focused Playwright flow using only nested legacy Duel data.
7. Update the owned docs and backlog status only after implementation evidence
   passes.

No App transaction change is expected. If implementation discovers that a
Duel-only report cannot complete through the existing transaction, stop and
update this specification with evidence before adding a parallel path.

## Required tests

### View-model unit tests

Update `src/tests/legacy-migration-view-model.test.ts` to prove:

- Duel-only validated snapshots yield one plan item, `importReady: true`,
  `1 compatible area` and `Saved setups ready`;
- an empty defensive Duel state yields no plan item and remains review-only;
- a mixed report count equals the plan length rather than imported-field count;
- every plan item makes readiness true; and
- a report with only review/skipped data remains disabled.

The old test named `preserves the current Duel-only readiness discrepancy`
must be replaced, not retained as accepted behavior.

### Inspector and merge tests

Use the existing legacy migration and Duel state suites to prove:

- one valid nested legacy entry produces one schema-valid rewrite snapshot;
- invalid shape, missing name, computed result and zero safe setup fields are
  skipped;
- cap exhaustion and generated-id collision produce no actionable candidate;
- mixed candidates retain safe entries and sanitized skip evidence; and
- current rewrite snapshots win when merge is applied.

Do not test by weakening schemas or directly inserting invalid persisted
rewrite state.

### Browser test

Add a focused case to `src/tests/e2e/persistence-migration.spec.ts` that seeds
only `sim_input_v3.duelSetups` as compatible legacy data. Assert the enabled
action and aligned copy, import, saved-setup persistence, unchanged active
rewrite setup, retained legacy key, dismissed review and post-reload state.

The fixture must not include a top-level combat setup field that accidentally
makes the old predicate true.

## Validation commands

Implementation is complete only after the repository testing owner confirms
the current authoritative commands. At minimum run:

```bash
npm run typecheck
npm run test -- src/tests/legacy-migration-view-model.test.ts
npm run test -- src/tests/legacy-migration-setup.test.ts
npm run test -- src/tests/ui-adapters.test.ts
npm run test:e2e -- src/tests/e2e/persistence-migration.spec.ts
npm run architecture:check
git diff --check
```

If the E2E script does not accept a file argument, use the focused Playwright
command documented in `docs/technical/testing.md` and then the authoritative
functional suite required for release evidence.

## Completion criteria

- Readiness is derived from the non-empty import plan.
- A valid Duel-only report enables Import and uses area-count copy.
- An empty or entirely rejected Duel candidate does not enable Import.
- The existing transaction imports, persists and reloads the saved setup while
  leaving active rewrite setup and legacy storage semantics intact.
- Inspector, merge and browser regressions cover the positive and blocked
  cases.
- No schema, allowlist, precedence, privacy or backend boundary changes.
- Owned documentation reflects implementation evidence without changing the
  parent feature's `Valmis` status.

## Open questions

None for specification. The existing inspector, import plan, merge helper and
App transaction define the required behavior.

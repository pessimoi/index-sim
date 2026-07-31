# Legacy compatibility support inventory and sunset specification

- Status: active
- Date: 2026-07-31
- Owner: browser persistence and transfer compatibility
- Evidence: partial
- Contract: living

## Purpose

Replace indefinite legacy compatibility with an explicit, evidence-gated
support lifecycle while preserving any real external tester data, current
browser-state invariants and safe import/export behavior.

This work does not authorize immediate removal. The repo has documented
trusted-tester use and may have browser-local data outside the checkout.
Compatibility may be retired only per surface after inventory, backup and
acknowledgement evidence.

## Verified starting state

The current application owns several distinct compatibility classes:

1. **Archived-browser localStorage import**
   - 17 known legacy keys are detected;
   - setup, per-monster custom setup, cannon, Duel, loot preferences, hidden
     tiers, compare state, prices and Hiscores player have bounded import paths;
   - Planner and full legacy price history are review-only;
   - inspection is read-only, Import preserves legacy keys and confirmed Clear
     deletes only known keys.
2. **Rewrite persistence upgrades**
   - selected PriceSet version 1 can upgrade to version 2 metadata;
   - browser-local price history version 1 can upgrade to version 2 metadata;
   - unsupported current-key versions surface attention rather than being
     silently reset.
3. **Transfer compatibility**
   - contextual current setup/Workspace formats coexist with older rewrite
     setup, saved-setup, Duel or share-link envelopes;
   - entity/revision compatibility is reviewed before mutation.
4. **Calculation/data aliases**
   - exact current item ids win;
   - selected legacy price aliases remain fallback-only where explicitly
     documented.

These classes have different data-loss risks and must not be removed in one
blanket “legacy cleanup”.

## Support matrix owner

The living
[legacy compatibility support matrix](legacy-compatibility-support-matrix.md)
owns this inventory. Every compatibility surface must have:

- identifier: storage key, envelope version, URL version, file version or alias;
- current reader and writer owner;
- `read`, `write`, `migrate`, `review-only` and `clear` behavior;
- maximum accepted size and validation schema;
- known external consumer or `unknown`;
- current test owner;
- disposition:
  - `retain-current`;
  - `migrate-once`;
  - `fixture-only`;
  - `sunset-ready`; or
  - `removed`;
- required evidence before the next disposition; and
- a last-reviewed date.

No new compatibility path may be added without updating the matrix and naming
a real source version/consumer plus a sunset rule.

## External-data checkpoint

Before any reader or migration removal:

1. Ask the known tester whether they still have:
   - legacy browser state;
   - rewrite v1/v2 state;
   - old setup/Duel files;
   - old share links;
   - imported PriceSets or price history; or
   - a hosted origin whose localStorage must remain readable.
2. Provide the current Workspace/area exports needed to make a backup.
3. Verify an import/export round trip for every format the tester reports.
4. Record acknowledgement that the retained backup opens in the current
   format.
5. Avoid product telemetry or collection of the tester's actual setup, player
   name or price contents.

If the tester cannot be reached or usage remains unknown, do not delete the
reader. The implementation may still freeze expansion, isolate the code and
remove duplicate tests.

## Compatibility freeze

Effective when this specification is implemented:

- no new archived-runtime keys are imported by default;
- no hypothetical legacy envelope version is accepted;
- no current schema is widened solely to read malformed historical data;
- no fallback alias is added without an exact collision/source review;
- legacy input is never written back in its old format;
- current exports use only current contextual formats; and
- compatibility code must not leak into domain formulas or server state.

Bug fixes to a retained safe reader are allowed. New migration scope needs an
explicit consumer and decision.

## Surface-by-surface sunset

### Archived localStorage keys

A key becomes `sunset-ready` only when:

- the tester reports no remaining state, or completes a current-format backup;
- Import/Keep/Clear browser evidence passes immediately before notice;
- the current app has had one explicit handoff cycle in which the migration
  surface remains available; and
- no repository-owned fixture needs the production UI migration path.

Removal must not proactively delete the old key. Stop detecting/parsing it and
leave unknown browser bytes untouched unless the user explicitly clears site
data. Remove UI copy and tests only for the retired key.

### Rewrite persistence upgrades

Version 1-to-2 upgrades preserve already-created rewrite state rather than
archived implementation state. Retire them only after:

- the external checkpoint confirms no old origin/profile remains;
- current Workspace export covers the value;
- a direct current-schema fixture replaces any remaining need; and
- version-mismatch attention remains safe for unsupported envelopes.

Do not collapse current schema validation or silently reset unknown versions.

### Files and share links

Retire a reader only after:

- known files/links are inventoried;
- the current app can export a replacement;
- fixtures prove the last supported old input can be converted without loss of
  supported fields;
- user-facing unsupported-version copy is accurate; and
- no public documentation or trusted handoff still distributes the old form.

Do not change existing URL semantics in place. Unsupported links fail closed
with sanitized review copy.

### Price aliases

Alias retirement is a data-source decision, not a UI migration decision.
Remove an alias only when the exact current id exists in every accepted
snapshot/PriceSet path and focused economy/loot calculations prove unchanged
values or an explicitly accepted delta.

## Safeguards

- Preserve Zod validation, duplicate-key rejection, size limits and safe map
  keys.
- Preserve no-write inspection and exact allowlisted Clear behavior while the
  migration UI exists.
- Preserve current Workspace backup/restore, transactional rollback, Undo and
  cross-tab freshness.
- Preserve current high-alch ownership and PriceSet provenance.
- Preserve current-state attention for invalid or unsupported versions.
- Never infer “no data” from an empty repository, incognito browser or clean
  local profile.

## Test strategy

During the freeze/inventory phase, retain current tests. During each removal:

- keep a fixture proving the last old input's expected current logical value;
- remove only tests that execute the retired production reader;
- retain current-schema validation, invalid-input and no-partial-write tests;
- rerun the affected browser import/backup path;
- run economy/goldens if prices or aliases are involved; and
- run Workspace transaction tests when an area/storage owner changes.

The support matrix, not test-file naming, owns whether a compatibility promise
still exists.

## Non-goals

- No immediate localStorage clearing.
- No all-at-once version squash.
- No migration of review-only Planner or full legacy price history merely to
  make deletion easier.
- No telemetry, accounts or server-side backup database.
- No deletion of archived runtime source; fixture extraction has its own
  specification.
- No change to combat, loot, trip, economy or planner formulas.

## Implementation sequence

1. Build the complete compatibility matrix from code and tests.
2. Complete the external-data checkpoint with the known tester.
3. Freeze new compatibility expansion in owning docs and review rules.
4. Mark each surface with its evidence-backed disposition.
5. Migrate/export real retained data without collecting its contents.
6. Retire one reader class at a time, starting with unused presentation-only
   keys and ending with rewrite persistence upgrades.
7. Update product, architecture, testing, decisions and backlog after each
   accepted support-boundary change.
8. Record removed versions in historical evidence, not as living support.

## Acceptance checks

Inventory/freeze phase:

```sh
npm run test -- src/tests/legacy-migration-policy.test.ts src/tests/legacy-migration-setup.test.ts src/tests/legacy-migration-preferences.test.ts src/tests/legacy-migration-prices.test.ts src/tests/setup-import.test.ts src/tests/shareable-setup.test.ts
npm run docs:check
git diff --check
```

Each removal additionally follows the persistence/transfer minimums in
`docs/technical/testing.md`, including the affected Playwright path.

## Done when

- every supported old key/version/alias has a named owner and disposition;
- the known tester's retained data has a current-format backup or explicit
  no-data acknowledgement;
- compatibility expansion is frozen by default;
- retired readers leave unknown browser bytes untouched;
- current schemas, rollback and invalid-state recovery remain intact; and
- no production compatibility promise survives only because a historical test
  still executes it.

## Implementation checkpoint

The living
[support matrix](legacy-compatibility-support-matrix.md) now inventories all 17
archived-browser keys, both rewrite persistence upgrades, retained transfer
formats and four price aliases. Code ownership comments and AGENTS guidance
freeze unnamed compatibility growth. The focused migration/setup/share line
passes 58 tests.

External tester origins, files, links and browser data remain unknown. No
reader or alias is `sunset-ready`, and no removal or storage clearing was
performed. The sunset phase remains `WAITING_EXTERNAL` for the tester's
current-format backup or explicit no-data acknowledgement.

## Open questions

- Which legacy keys, files, share links and origins does the known tester still
  have?
- What single handoff date or version should be the final migration window?
- Are any old share links distributed beyond the known tester?

# Monster-specific changes management specification

- Status: proposed on 2026-07-20
- Priority: high
- Estimated effort: L
- Owner: Settings, app-shell navigation and existing monster-specific state
  owners
- Feature-inventory parents: `Basic combat setup`, `Dense spreadsheet view`,
  `Monster comparison`, `Loot/economy summary` and `Cannon` (`Valmis`)
- Depends on: generated monster labels, the current Default/Custom state
  machine, the implemented Workspace storage batch/rollback foundation and the
  global one-step Undo contract

## Purpose

Give users one trustworthy place to find and remove every accepted
monster-specific browser-local change without visiting all monsters and panes
one by one.

The current product already supports these changes and uses them in results.
This goal completes their management path; it does not add a new simulation
capability or another setup collection.

## Feature-inventory boundary

The affected feature rows remain `Valmis`:

- `Basic combat setup` owns Default plus current-monster Custom setup editing;
- `Cannon` owns current-monster Cannon settings;
- `Loot/economy summary` owns current-monster Loot settings and Loot action
  overrides;
- `Dense spreadsheet view` and `Monster comparison` own the per-monster
  relevant/irrelevant preference and several row markers; and
- Settings Local state recovery and Workspace backup already operate at whole
  storage-area or file level.

This specification is not a duplicate of those workflows. None of them shows
the complete cross-monster union, and none lets a user review and remove all
accepted changes for one non-current monster as a single recoverable action.

The separate Default/Custom mode and autosave-clarity specification remains
the owner of the active editor's mode and durability language. This goal owns
cross-target inventory and management only.

## Verified current behavior and user gap

### Existing state owners

The rewrite already persists five kinds of monster-specific state:

| Change kind           | Current live owner                  | Persisted owner              | Existing editing/removal path                           |
| --------------------- | ----------------------------------- | ---------------------------- | ------------------------------------------------------- |
| Custom setup          | `customSetupsByMonster`             | `index-sim:rewrite-setup` v3 | Current target Setup actions; Remove has one-step Undo. |
| Cannon settings       | `cannonByMonster`                   | `index-sim:rewrite-setup` v3 | Current target Cannon pane and Reset.                   |
| Loot action overrides | `lootPrefsByMonster`                | `index-sim:loot-prefs` v1    | Current target Loot table and Reset/optimize.           |
| Loot settings         | `lootSettingsByMonster`             | `index-sim:loot-settings` v1 | Current target Loot settings and Reset.                 |
| Compare relevance     | `denseCompare.irrelevantMonsterIds` | `index-sim:rewrite-setup` v3 | Dense row `Hide`/`Restore`.                             |

`customSetupsByMonster`, `cannonByMonster` and Dense relevance share the
validated `SavedSetupState`. Loot actions and Loot settings intentionally keep
their separate version-1 envelopes.

### Existing discovery surfaces

- Active assumptions shows only the selected target and limits the primary
  visible list to five rows before overflow.
- Setup, Cannon and Loot edit only the current target.
- Dense Compare marks custom setup, high-alch, overhead and irrelevant state,
  but it does not mark Cannon, Loot action overrides, talisman spot or a
  saved-default Loot settings row. Irrelevant rows are hidden by default.
- The Dense row action can restore relevance, but the user must find the row
  and then visit other panes for every other category.
- Settings Local state recovery shows sanitized area health, not individual
  monster values.
- Workspace backup review counts areas/records and safely transfers them, but
  it is not an ordinary editor and does not expose a per-monster management
  list.

A user who has experimented with several monsters cannot currently answer
"which monsters still differ?" from one view. Old changes can therefore keep
affecting comparison, Cannon, loot value or active setup selection without a
clear cleanup route.

## Goals

- Add one Settings-owned `Monster-specific changes` section.
- Build its rows from the complete union of the five existing live state
  classes without scanning or parsing storage in a presenter.
- Show one deterministic row per monster, with source-backed name and explicit
  category summaries.
- Make a changed monster searchable and filterable by category.
- Let each category route to its existing owning pane and focus the relevant
  editor or row.
- Let the user review and remove all current changes for one monster in one
  logical, persistence-aware transaction.
- Keep unrelated monsters, the Default setup, saved Duel setups, prices,
  histories, player/Hiscores state and global preferences unchanged.
- Offer one complete durable or session-only Undo after a successful removal.
- Use the existing Local state recovery truth for unavailable persistence and
  failed rollback.

## Non-goals

- Do not add inline level, loadout, Cannon, Loot or Dense editing to Settings.
  Existing feature panes remain the only value editors.
- Do not add a new setup type, rename Custom setups or alter the Default/Custom
  state machine.
- Do not include saved Duel snapshots. They are a named comparison collection,
  not monster-specific active overrides.
- Do not include the current target by itself, Planner state, Risk controls,
  hidden gear tiers, manual item prices, PriceSets, price history, Hiscores or
  open-pane/filter state in the change inventory.
- Do not add `Remove all monsters`, category checkboxes in the all-changes
  transaction or an irreversible bulk wipe. Workspace export remains the
  broad backup path.
- Do not create a second reset implementation inside the list. Category-level
  changes remain editable/removable through their current owner after Review.
- Do not inspect blocked raw localStorage, display serialized values, storage
  keys, schema paths or parser diagnostics.
- Do not change state keys, versions, envelopes, schemas, limits, migration,
  transfer formats or generated-game-data compatibility policy.
- Do not change calculation formulas, `SimulationRequest`, result contracts,
  Worker protocols, providers, deployment, auth or database scope.
- Do not claim crash-atomic browser storage. The accepted guarantee is exact
  rollback for handled storage operations, as in Workspace restore.

## Inventory model

### Closed change-kind union

Use this closed presentation union:

```ts
type MonsterSpecificChangeKind =
  "custom-setup" | "cannon" | "loot-actions" | "loot-settings" | "compare-hidden";
```

Adding a sixth kind requires updating the builder's exhaustive switch, UI
labels, navigation, removal policy and tests. A future state map must not
silently remain absent from the management surface.

### Inclusion rules

Build rows from current schema-validated live values and current generated game
data:

| Kind             | A row has the kind when                                                                                                  | Summary requirements                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `custom-setup`   | `customSetupsByMonster[monsterId]` exists. Presence is authoritative even if the saved form currently matches Default.   | `Custom setup` plus its selected combat style. Do not calculate or imply a causal DPS difference.                                  |
| `cannon`         | `cannonByMonster[monsterId]` exists. An explicit default-valued row still counts because Reset removes stored ownership. | Enabled/disabled, targets and Auto/source respawn or explicit seconds.                                                             |
| `loot-actions`   | The game-data-filtered current row contains one or more valid Loot actions.                                              | Exact valid override count using `drop`/`drops` language. Never show raw row ids as ordinary copy.                                 |
| `loot-settings`  | `lootSettingsByMonster[monsterId]` exists. An explicit canonical-default row still counts.                               | Show only meaningful high-alch On/Off, overhead seconds and non-default talisman spot facts; otherwise say `Saved default values`. |
| `compare-hidden` | The normalized Dense state contains `monsterId` in `irrelevantMonsterIds`.                                               | `Hidden in Compare`.                                                                                                               |

Use `lootPrefsForGameData` or the equivalent validated projection so stale Loot
row ids do not become ordinary management facts. Current effects already remove
invalid Loot rows from the persisted effective state.

Do not infer a change by diffing a generated monster, calculated result or
current target against a default. The five existing owner records are the
source of truth.

### Known and unavailable monsters

For a current generated monster, use its source-backed `name` and optional
level. The exact id may appear only in a labelled `Technical details`
disclosure.

An accepted live map can contain a schema-valid monster id that is unavailable
in the current snapshot, most notably a retained Loot settings row. Do not hide
an otherwise unmanageable row. Present it as `Unavailable monster`, expose the
exact id only in Technical details, disable category Review and keep reviewed
removal available.

Do not read an incompatible blocked rewrite-setup envelope to recover such a
row for this panel. Local state recovery remains the only owner of blocked raw
data.

### Deterministic view model

An equivalent pure contract is:

```ts
interface MonsterSpecificChangeCategoryViewModel {
  kind: MonsterSpecificChangeKind;
  label: string;
  summary: string;
  reviewActionLabel: string | null;
}

interface MonsterSpecificChangeRowViewModel {
  monsterId: string;
  monsterName: string;
  monsterLevel: number | null;
  available: boolean;
  activeTarget: boolean;
  categories: readonly MonsterSpecificChangeCategoryViewModel[];
}

interface MonsterSpecificChangesViewModel {
  monsterCount: number;
  categoryCount: number;
  countsByKind: Readonly<Record<MonsterSpecificChangeKind, number>>;
  rows: readonly MonsterSpecificChangeRowViewModel[];
}
```

The builder receives `GameDataSnapshot`, normalized `SavedSetupState`,
effective `LootPrefsState` and `LootSettingsByMonsterState`. It has no React,
storage, browser, network or calculation dependency.

Sort available rows by source name and then exact id; place unavailable rows
last and sort them by id. Categories use the closed union order shown above.
The active-target flag is presentation context only and does not create a row.

## Settings presentation contract

Place one `Monster-specific changes` section after `Calculation context` and
before Workspace/recovery tools. This is ordinary state management, not a
recovery error.

The section contains:

- a visible heading;
- a status pill `<N> monsters changed`;
- a short explanation that calculations use these values when their monster is
  selected or compared;
- deterministic category totals;
- a search input labelled `Filter changed monsters`;
- a category filter with `All changes` plus the five category labels; and
- the matching changed-monster rows.

Do not persist search, category filter, expanded rows or removal-review state.
They are transient Settings presentation state. An empty inventory shows:

`No monster-specific changes saved.`

Do not render an empty table or an enabled removal action.

### Changed-monster row

Each row exposes:

- source-backed monster name and level when available;
- `Current target` when applicable;
- one text badge/summary per present category;
- a category-specific native `Review` action when the target is available;
- one `Review removal` action for all current categories; and
- a collapsed labelled Technical details disclosure for the exact monster id.

Badges cannot rely on color. The accessible row name includes the monster and
category labels, but does not concatenate every detailed value into one
unbounded announcement.

At desktop, a compact table/list is acceptable. At 620 px and portrait-tablet
normal flow, rows become cards or a single-column grid; category text and
actions wrap without horizontal document overflow. At 640 x 360 compact
landscape, Settings remains the current center-pane scroll owner.

## Category Review navigation

Review does not mutate a category. It performs one latest-request-wins shell
navigation:

| Kind             | Destination and focus                                                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `custom-setup`   | Select the monster through the existing target path, activate its dynamic Loadout tab and focus the setup/loadout heading. The existing target selection loads that Custom setup. |
| `cannon`         | Select the monster, activate Cannon and focus the Cannon heading.                                                                                                                 |
| `loot-actions`   | Select the monster, activate Loot and focus the current-monster action table heading.                                                                                             |
| `loot-settings`  | Select the monster, activate Loot and focus the Loot settings heading.                                                                                                            |
| `compare-hidden` | Select the monster, activate Compare and focus its forced-visible active row. The existing row `Restore` action remains the category owner.                                       |

Use existing target selection, tab state and post-render refs/requests. Do not
encode internal navigation in a URL, persist the active tab or build another
form-loading path.

The action label names both destination and monster, for example
`Review Cannon for Dagannoth`. If a category disappears before the effect runs,
cancel focus rather than focusing unrelated content. Unavailable monsters have
no Review action.

## Review-gated removal

### Candidate

`Review removal` builds one in-memory candidate without state or persistence
mutation. An equivalent target-scoped candidate is:

```ts
interface MonsterSpecificRemovalCandidate {
  id: number;
  monsterId: string;
  sourceProjection: {
    activeMonsterId: string;
    setupMode: SetupMode;
    customSetup: CombatSetupFormState | null;
    cannon: CannonSettings | null;
    lootActions: Readonly<Record<string, LootAction>> | null;
    lootSettings: MonsterLootSettings | null;
    compareHidden: boolean;
  };
  selectedAreaIds: readonly ("rewrite-setup" | "loot-prefs" | "loot-settings")[];
  review: MonsterSpecificRemovalReviewViewModel;
}
```

The source projection is validated and session-only. It excludes raw storage,
prices, calculated output and unrelated monster rows.

The review lists exactly the categories that will be removed. It also states:

- Default setup, other monsters and saved comparison setups are kept;
- current calculations update when the active monster is affected; and
- removing the active Custom setup switches the editor to Default for the same
  target.

Actions are exactly `Remove all changes` and `Cancel`. Do not use
`window.confirm()`, preselect partial categories or mutate before Confirm.
Cancel returns focus to the originating row action.

### Stale and no-op rules

At Confirm, compare the candidate's target projection with the latest target
projection.

- A change to any captured category, active target or active setup mode makes
  the review stale and produces `Monster changes changed. Review removal
again.`
- An unrelated monster edit, price update, Planner change or pane navigation
  does not make it stale.
- If every captured category has already disappeared, consume the review as a
  no-op, preserve the preceding global Undo and show `No changes remain for
<Monster>`.
- Duplicate Confirm is rejected.

After a non-stale check, derive complete next values from the latest live
owners so unrelated monster rows changed after review are preserved.

## Removal state semantics

For the candidate monster, Confirm:

1. removes its Custom setup row when present;
2. removes its Cannon row when present;
3. removes its id from Dense irrelevant ids when present;
4. removes its Loot action map when present; and
5. removes its Loot settings row when present.

All next values pass their current schemas.

When the removed monster is the current target and the current editor is using
its Custom setup, derive the live form through the existing
`formForMonsterSetup(defaultForm, nextCustomSetups, monsterId)` path. The target
stays selected and the mode becomes Default. If the user is already editing
Default, removing a retained Custom row does not replace the current form.

Removing Cannon, Loot or relevance state for the current target updates the
current result through existing derivation only. It must not modify Trip scarce
fields, current selected loot table sort, PriceSet, Planner draft or a saved
Duel snapshot.

No form, map or storage owner may be partially applied to React state.

## Persistence transaction and recovery

### Selected-area set

The transaction selects only areas that actually change:

- `rewrite-setup` for Custom, Cannon or Compare relevance;
- `loot-prefs` for Loot actions; and
- `loot-settings` for Loot settings.

Use that exact order, matching the Workspace registry. Do not rewrite an
unselected envelope or refresh its `savedAt`.

### Durable Apply

Reuse the Workspace executor's accepted handled-operation guarantees through a
shared allowlisted batch primitive. Extracting its current private
serialization/preimage/write/rollback mechanics into a direct shared owner is
preferred. Do not construct a synthetic Workspace import file or copy a second
raw batch implementation.

Durable Confirm performs:

1. preflight and schema-validate every selected complete next value;
2. serialize all selected envelopes with one transaction timestamp and their
   existing versions;
3. capture the exact raw-or-missing preimage for each selected allowlisted key;
4. execute the deterministic write batch;
5. reverse-roll back every affected key to its exact preimage if any write
   fails;
6. call recovery `prepareExternalApply(selectedIds)` after durable success so
   normal effects cannot immediately rewrite the batch;
7. apply one complete typed live outcome; and
8. complete recovery, refresh health once, close review and register one global
   Undo.

If live application throws, roll durable state back to exact preimages, restore
the captured live values best-effort and report fixed sanitized failure. No
successful partial outcome is allowed.

This shared primitive may expose values and fixed status to App/controllers,
but raw strings stay inside closures. They never enter presentation, logs,
exports, telemetry or tests that snapshot DOM text.

### Session-only path

If selected browser storage is unavailable before writes, or a failed batch
rolls back exactly, make no live change and retain the reviewed candidate with
an explicit `Remove for this session` action.

Session-only Apply:

- applies all selected next live values together;
- writes only to the already selected isolated memory storage when the app is
  in safe-session mode;
- does not unblock protected browser data;
- keeps the local-state attention surface authoritative; and
- registers one complete session-only Undo.

If exact rollback fails, persistence is uncertain. Offer no session-only
success, mark every affected selected id for Local state recovery and keep the
fixed error free of raw values.

### Success copy

- durable: `Removed all changes for <Monster>`;
- session-only: `Removed all changes for <Monster> for this session. Changes
may return after reload.`; and
- restore: `Restored changes for <Monster>`.

The global pending surface is the only interactive Undo owner. The proposed
global Undo visibility specification ensures it remains viewport-reachable; no
Undo is duplicated in the Settings list.

## Undo contract

Capture the complete selected live owner values and exact durable raw preimages
before Confirm.

- Durable Undo uses the same deterministic batch and rollback rules to restore
  the exact raw-or-missing preimages, then restores the complete selected live
  values with one recovery-suppressed application.
- Session-only Undo restores only the selected prior live values and isolated
  memory state; it does not touch protected browser storage.
- When the active target's Custom setup was removed, Undo restores the exact
  prior form, mode, Default form and Custom map so the editor returns to the
  same owner.
- Undo restores the target's prior Cannon, Loot action, Loot settings and
  relevance state together while preserving areas not selected by the
  original removal.
- A failed durable Undo whose attempted writes roll back exactly retains the
  post-removal durable/live state and offers the existing explicit session-only
  restore outcome. A rollback failure marks selected areas for recovery and
  never reports success.
- Reload, tab close or a later successful undoable action retains the current
  one-step semantics; the Undo record is not persisted.

## Ownership and likely implementation files

- `src/app/view-models/monster-specific-changes.ts`: closed-kind union,
  deterministic inventory, friendly summaries, counts and target projection.
- `src/app/state/monster-specific-changes.ts`: optional DOM-free candidate,
  stale/no-op and next-state derivation. It must reuse the existing state
  schemas/default/custom helpers rather than copy them.
- `src/app/controllers/local-state-batch.ts` or an equivalent extracted owner:
  allowlisted serialization, raw preimages, deterministic writes and reverse
  rollback shared with Workspace restore.
- `src/app/controllers/workspace-restore-executor.ts`: consume the shared batch
  primitive without changing Workspace behavior or evidence.
- `src/app/components/settings/monster-specific-changes-panel.tsx`: pure
  Settings list, transient filtering and inline removal review.
- `src/app/components/panes/economy-settings-pane.tsx`: compose the section in
  Settings mode only.
- `src/app/App.tsx`: current live-state capture, category Review navigation,
  post-render focus, complete live application and global Undo registration.
- `src/app/styles.css`: desktop list plus compact-landscape and normal-flow
  mobile containment.
- Focused state, controller, component and browser tests.

Do not move storage, form state, calculations or feature editing into the pure
panel. If extraction changes the Workspace controller boundary or source-module
graph, update living architecture in the implementation change and run the
architecture gate.

## Accessibility contract

- Use a labelled section with visible `Monster-specific changes` heading.
- Search has a persistent label; the category filter is a native labelled
  select or equivalent native control.
- Changed category names and summaries are text, not color-only chips.
- Every Review action names its area and monster.
- `Review removal` names the monster and opens a visible labelled review.
- The review uses ordinary status semantics, not `role="alert"` for valid
  state. Fixed storage errors use the existing error/alert convention.
- Cancel returns focus to the row trigger. Confirm leaves focus on the global
  pending Undo only through normal keyboard navigation; it does not steal
  focus automatically.
- Category Review focuses the destination heading or Compare row after it
  renders, with a visible focus indicator.
- Long names and summaries wrap at 390 px. The exact technical id stays in a
  labelled disclosure and never becomes the sole accessible name.

This is a bounded keyboard/focus contract, not a WCAG conformance claim.

## Required tests

### Pure inventory and candidate tests

Prove:

- each of the five owner types independently creates the correct category;
- one monster present in all maps creates one row with five ordered categories;
- explicit canonical Cannon/Loot settings rows remain visible as saved owner
  records;
- valid Loot action counts exclude unavailable row ids;
- current target alone creates no row;
- source names/levels win, unavailable ids sort last and raw ids appear only in
  Technical details;
- row/category totals, source-name sorting and filters are deterministic;
- unrelated global and per-monster state is excluded;
- the target projection detects relevant staleness but ignores unrelated
  monster, price and Planner changes;
- removal derives from latest state, deletes exactly the target's five
  categories and validates all three selected owners;
- active Custom removal switches to same-target Default while active Default
  and non-current removal preserve the current form/mode; and
- no-op and duplicate candidate consumption are rejected.

### Batch, recovery and Undo tests

Reuse and extend Workspace batch evidence. Prove:

- selected ids are exhaustive and registry ordered;
- one, two and three-key durable success write only selected keys;
- the batch captures exact raw/missing preimages and one common target
  timestamp;
- failure on every nth read/write/clear produces no reported partial success;
- exact reverse rollback leaves live state unchanged and offers session-only
  Apply;
- rollback failure marks every affected selected id and offers no session-only
  success;
- live-apply failure rolls durable values back and restores prior live values;
- normal effects consume one recovery skip rather than rewriting exact batch
  results;
- session-only Apply and Undo leave protected browser storage untouched;
- durable and session-only Undo restore all originally selected categories;
- failed durable Undo cannot lose the post-removal state; and
- raw strings and storage keys never enter public outcomes or DOM models.

Workspace restore's complete existing suite must remain green after any batch
primitive extraction.

### Component and navigation tests

Prove:

- the empty state, counts, search, category filter and one-row-per-monster DOM;
- unavailable targets have removal but no category Review;
- category Review uses the existing target-selection path, activates the exact
  owner and focuses its heading/row;
- opening/Canceling removal changes no owner, persistence, recovery or pending
  Undo;
- stale/no-op review produces fixed copy and preserves the preceding Undo;
- durable/session-only success copy and one global Undo registration;
- current-target and non-current removal/Undo behavior; and
- desktop, 640 x 360, 390 x 844, 620 x 844 and 768 x 1024 containment.

### Production-preview workflow

Seed at least two monsters so the union includes all five kinds, including a
hidden non-current row. Then prove:

1. Settings shows the correct monster and category totals;
2. search and category filtering retain deterministic rows;
3. each category Review selects the intended monster and reaches/focuses its
   existing owner;
4. returning to Settings rebuilds the inventory from current live state;
5. removal review lists every current category and mutates nothing before
   Confirm;
6. Confirm removes the selected monster from all three owner envelopes while
   retaining the other monster and an unrelated local-state sentinel;
7. active Custom removal keeps the target and switches to Default;
8. one global Undo restores every category and prior editor owner;
9. reload after durable removal keeps the cleaned state and reload after a
   durable Undo keeps the restored state; and
10. forced storage failure makes no partial durable/live change before explicit
    session-only removal, whose Undo remains session-only.

Add bounded visual evidence for the populated Settings section at desktop and
390 px mobile. Review actual/diff images before updating only the owning
Settings baselines.

## Validation

Run at minimum during implementation:

```sh
npm run test -- src/tests/monster-specific-changes.test.ts src/tests/monster-specific-changes-panel.test.tsx src/tests/settings-view-model.test.ts src/tests/economy-settings-pane.test.ts src/tests/workspace-restore-executor.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "Monster-specific changes"
npm run test:e2e:visual
npm run test:golden
npm run build
git diff --check
```

Run the complete functional browser suite before delivery because target
selection, Settings, the three persistence owners and global Undo are shared
workflows. Run `npm run verify` after the focused/visual evidence is accepted.
No live provider, generated-data refresh, database or deployed environment is
required.

## Acceptance criteria

- Settings lists every current accepted monster-specific Custom, Cannon, Loot
  action, Loot settings and Compare-hidden owner in one deterministic union.
- A user can search/filter the list and route each category to its current
  owner with correct target selection and focus.
- Unavailable accepted live rows remain safely removable without presenting a
  raw id as the ordinary monster name.
- `Remove all changes` is review-gated, target-scoped and stale/no-op safe.
- Durable removal writes only the affected rewrite-setup/Loot areas as one
  handled-operation batch; a tested failure never reports partial success.
- Session-only removal is explicit and leaves protected browser storage
  untouched.
- One complete Undo restores all selected categories and the prior active
  Custom/Default editor owner.
- Default setup, other monsters, saved Duel setups, prices, histories, Planner,
  Hiscores and global preferences remain unchanged.
- No state, transfer, request, result, formula, provider or deployment schema
  changes.
- The affected feature-inventory rows remain `Valmis`; this is management
  completion for existing state, not a new product feature family.
- Focused state/controller/component, type, architecture, browser, visual,
  golden, build, complete functional and diff gates pass.

## Implementation sequence

1. Add exhaustive pure inventory and target-projection tests.
2. Extract/reuse the Workspace allowlisted batch primitive with zero Workspace
   behavior delta.
3. Implement target-scoped review, removal, recovery and Undo state/controller
   evidence.
4. Add the Settings panel and category Review focus transactions.
5. Add responsive functional and visual evidence plus forced storage failures.
6. Run the complete release gates and promote only implemented facts to living
   architecture/evidence docs.

## Open questions

None block implementation. A cross-monster bulk wipe, inline Settings editors,
category-selective batch removal or a persisted multi-step Undo would require a
separate product/state decision and remain outside this goal.

# Setup replacement review and Undo specification

Status: implemented on 2026-07-18.

## Purpose

Protect the two remaining setup-replacement paths that can change the live
editor without a complete recovery step:

1. a rewrite setup JSON file currently persists and applies immediately after
   file selection; and
2. loading an in-app saved Duel setup changes the live form immediately and
   has no Undo.

External files must be reviewed before any write or live mutation. Both
successful replacement paths must offer one complete in-memory Undo that also
restores browser persistence when available.

## Verified current behavior and problem

- `src/app/controllers/setup-file-transfer.ts` reads, validates, persists,
  unblocks and reports a setup within `importFile()` before the caller can
  decide whether to apply it.
- `src/app/App.tsx` applies a ready file outcome to six rewrite-setup state
  families: `form`, `defaultForm`, `setupMode`, `customSetupsByMonster`,
  `denseCompare` and `cannonByMonster`.
- Selecting a valid file is therefore both the review decision and the Apply
  action. There is no summary of what will be replaced and no Undo.
- `loadDuelSnapshot()` preserves the current target monster, normalizes the
  saved form and commits it immediately. The existing saved-setup row can show
  a detailed review, but the Load action has no recovery step.
- Delete saved setup, loadout optimization, custom-setup removal and shared
  setup loading already use the app's one-step `PendingUndoStatus` pattern.
- Shared setup links already validate in memory, show review, apply only on
  `Load setup` and restore all affected state on Undo. This specification
  aligns the two gaps with that proven interaction without merging their
  schemas.

## Feature-inventory boundary

Basic setup import/export, setup comparison and setup sharing remain existing
`Valmis` workflows. This goal hardens their replacement semantics; it does not
add another setup store, transfer format or comparison feature.

The completed setup file-transfer controller specification explicitly excluded
confirmation, Undo, busy state and request sequencing because it was an
ownership-only extraction. Those non-goals do not prohibit this separately
specified behavior change.

## Goals

- Split external setup file preparation from persistence and application.
- Show a bounded, plain-language summary of a validated candidate before Apply.
- Ensure Dismiss and all rejected imports leave live and persisted setup state
  unchanged.
- Apply each accepted replacement as one complete rewrite-setup transaction.
- Offer one complete Undo after external setup Apply and saved setup Load.
- Make Undo restore the prior persisted setup when browser storage is
  available, not only the current React values.
- Preserve current strict validation, size, compatibility, sanitization and
  local-state recovery behavior.

## Non-goals

- Do not change `SavedSetupSchema`, `REWRITE_SETUP_VERSION`, the storage key,
  file size limit, compatibility rules or normalization.
- Do not add partial import, merge selection, field-by-field cherry-picking or
  migration from unsupported rewrite setup versions.
- Do not change the dedicated shareable-link, legacy-migration, PriceSet or
  Duel collection transfer contracts.
- Do not add Undo to legacy migration in this goal. That workflow already has
  an explicit multi-area review and separate Keep/Clear decisions and requires
  its own atomicity assessment.
- Do not include Duel snapshot collections, loot preferences, Planner UI,
  PriceSets, price history, manual prices, Hiscores or calculated output in a
  rewrite setup transaction.
- Do not retain more than the app's existing single pending Undo action or
  persist an Undo history.
- Do not add accounts, cloud saves, server uploads, drag-and-drop or telemetry.

## External file workflow

### Select and prepare

1. Selecting the first file starts a bounded read through the existing browser
   adapter and clears the preceding setup-import notice.
2. `parseSavedSetupExportText()` remains the only strict parser and current-
   game-data compatibility owner.
3. A successful parse creates an in-memory candidate. It performs no
   persistence, replacement-unblock or live-state setter call.
4. Reset the file input after the attempt so the same file can be selected
   again.
5. Show a review surface with `Apply imported setup` and `Dismiss`.
6. A rejected read/parse shows the existing sanitized error and creates no
   candidate.

While reading, show a bounded `Reviewing setup file…` status and disable only
the setup file input. Export and unrelated app workflows remain available.

Use latest-request-wins sequencing. Starting a second file read invalidates an
older in-flight result. A late older success or failure must not replace the
new candidate/notice, persist state or alter the global status. There is no
need for an `AbortController` because browser `File.text()` is not reliably
cancellable; an internal monotonically increasing attempt id is sufficient.

### Review presentation

The review surface is an inline shell-level section near the setup transfer
controls, not a native browser confirmation. It stays visible across pane
navigation until Apply, Dismiss or a newer import attempt.

Show only validated, current-game-data-resolved metadata:

- target monster display name;
- combat style;
- setup mode (`Default` or `Custom`);
- count of monster-specific custom setups;
- count of monsters with stored cannon settings;
- Dense Compare preference summary: sort field and hidden/irrelevant monster
  count; and
- the explicit consequence: active form, default form, setup mode, custom
  setups, Dense preferences and cannon settings will be replaced.

When useful, compare each count with the current value as `current → imported`.
Do not print gear ids, raw JSON, raw schema paths, browser keys or the imported
`savedAt` value. The later
[game revision and transfer-context contract](game-revision-transfer-context-spec.md)
adds source revision metadata; this goal consumes it only after that separate
contract is implemented.

`Dismiss` clears the candidate and review surface, returns focus to the import
control and changes neither current nor persisted setup. It does not delete the
selected source file from the user's device.

### Apply transaction

On `Apply imported setup`:

1. capture the complete current rewrite setup with `savedSetupFromForm()`;
2. persist the validated candidate through
   `localStateRecovery.persist("rewrite-setup", ...)`;
3. apply all six candidate state families through one shared caller-owned
   helper in their existing normalized order;
4. call `unblockReplaced(["rewrite-setup"])` only for the accepted candidate;
5. refresh local-state health;
6. clear the candidate/review and fatal error;
7. publish persisted or session-only success copy; and
8. register one Undo whose restore value is the complete captured setup.

The app may still apply the candidate for the current session when persistence
returns false. Its success copy must say that changes may not survive reload,
as it does today. Applying to React state after a non-durable save is not a
partial import: all six in-memory families still change together.

No untrusted file operation may call the apply helper directly. Its input is a
strictly validated `SavedSetupState`.

## Shared setup application helper

Extract or define one caller-owned operation for a complete rewrite setup:

```ts
interface RewriteSetupLiveState {
  form: CombatSetupFormState;
  defaultForm: CombatSetupFormState;
  setupMode: SetupMode;
  customSetupsByMonster: CustomSetupsByMonsterState;
  denseCompare: DenseCompareUiState;
  cannonByMonster: CannonByMonsterState;
}

function applyRewriteSetupState(setup: SavedSetupState): void;
```

The helper may remain inside `App.tsx` if extracting it would require passing
React setters across a new module. It must normalize both forms and then set
all six state families. It must not own validation, parsing, storage, notices,
local-state recovery or unrelated state.

Use the same helper for external Apply and its Undo. This prevents the restore
path from drifting when `SavedSetupState` later changes under an explicit
version decision.

## Undo contract

After external Apply, render the existing single `PendingUndoStatus` with:

- applied label: `Imported rewrite setup.` or the session-only equivalent; and
- restore label: `Restored setup from before import.`

Undo performs this order:

1. persist the captured prior `SavedSetupState` through the recovery
   controller;
2. apply it to all six live state families;
3. unblock and refresh `rewrite-setup` because the restore value is validated;
4. clear the pending Undo; and
5. announce a durable or session-only restore result truthfully.

If persistence fails, the prior state is still restored for the session and
the global local-state attention surface specified separately remains the
owner of the unresolved durability warning.

Only one pending Undo exists. A later undoable app action replaces the earlier
one under the current `setUndoableStatus` contract. Reload, tab close and a new
application session discard Undo history.

## Saved in-app setup Load contract

The saved setup collection is already validated rewrite-owned state and each
row already has a keyboard-operable review panel. Loading does not need a
second modal confirmation. It does need complete recovery:

1. find the saved row by id; an absent id is a no-op;
2. capture the complete current rewrite setup;
3. create the next normalized form from the snapshot while preserving the
   current `monsterId` exactly as today;
4. apply it through `commitFormState(nextForm)`, preserving the current
   `setupMode` and its default/custom write-through semantics;
5. publish `Loaded saved setup: <name>`; and
6. register one Undo with `Restored setup from before loading <name>`.

Undo restores the captured complete rewrite setup through the shared helper
and persists it. It therefore restores any default/custom record changed by
`commitFormState`, not just the visible `form` reference.

The saved snapshot collection itself is not changed by Load or Undo. Current
target, current price context, Cannon, loot policies and calculated results
remain shared context as documented in the setup comparison contract.

## Controller contract

Refine `SetupFileTransferControllerCore` so preparation and acceptance are
distinct. Equivalent types are:

```ts
interface SetupImportReview {
  id: number;
  setup: SavedSetupState;
  summary: {
    targetLabel: string;
    combatStyle: CombatStyle;
    setupMode: SetupMode;
    customSetupCount: number;
    cannonMonsterCount: number;
    denseSort: string;
    irrelevantMonsterCount: number;
  };
}

interface SetupFileTransferSnapshot {
  phase: "idle" | "reading" | "review";
  notice: SetupFileTransferNotice | null;
  review: SetupImportReview | null;
}
```

Required public operations are `prepareImport(file, gameData)`,
`dismissReview(reviewId)`, `consumeReview(reviewId)` and the existing export.
`consumeReview` returns the typed candidate once and clears it; it does not
persist or mutate app state. Stale or already-consumed ids return no candidate.

Remove `persistSetup`, `unblockReplaced` and `refreshLocalStateHealth` from the
file controller dependencies. Those operations belong to the explicit caller-
owned Apply/Undo transaction. The controller remains the owner of read/parse,
request sequencing, sanitized transfer notices and export mechanics.

## Accessibility and responsive behavior

- The review section has a visible heading and `aria-label="Setup import
review"`.
- A newly prepared review receives a polite status announcement but does not
  steal focus from the file control.
- Apply and Dismiss are native buttons. Apply is the visually primary action;
  Dismiss is not styled as destructive because it changes nothing.
- After Apply, focus may remain in the shell and the existing Undo status must
  be keyboard reachable in DOM order.
- After Dismiss, focus returns to the import control.
- Long target names and count comparisons wrap on narrow screens without
  horizontal page overflow.
- Do not use `role="alert"` for a valid review. Rejected imports retain the
  current error-alert semantics.

## Implementation sequence

1. Characterize the current strict parser/error mapping and export behavior.
2. Refactor the controller to prepare/sequence/consume a typed in-memory
   candidate without persistence.
3. Add the bounded review view model and pure review component.
4. Add the shared complete-setup apply/capture helper in the composition root.
5. Implement external Apply/Dismiss and complete persisted Undo.
6. Add saved setup Load Undo using the same captured setup boundary.
7. Add browser coverage before removing the old immediate-apply path.

Likely implementation files:

- `src/app/controllers/setup-file-transfer.ts`;
- `src/app/controllers/use-setup-file-transfer.ts`;
- `src/app/App.tsx`;
- `src/app/components/shell/app-header.tsx` and/or a new pure review component;
- `src/app/components/app-presenters.tsx` only if persisted/session-only Undo
  copy needs a typed extension;
- `src/app/styles.css`;
- `src/tests/setup-file-transfer-controller.test.ts`; and
- setup import and Planner/Duel Playwright specifications.

## Required tests and validation

Focused tests must prove:

- successful file preparation performs no persistence, unblock or live-state
  mutation;
- invalid/oversized/incompatible input retains current sanitized errors and no
  review candidate;
- a second attempt wins and late results from an earlier attempt are ignored;
- review summaries use display names and bounded counts only;
- Dismiss and stale/duplicate consume are no-ops;
- Apply changes all six state families exactly once and persists the validated
  candidate;
- session-only Apply still changes all six families and reports non-durability;
- external Undo restores and persists the complete prior setup;
- saved setup Load preserves current monster and collection, updates the
  current default/custom owner and offers complete Undo; and
- rejected/dismissed files never unblock an invalid stored setup.

Run at minimum:

```sh
npm run test -- src/tests/setup-file-transfer-controller.test.ts src/tests/shareable-setup.test.ts src/tests/duel-snapshots.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "Import setup|saved setup|Undo"
npm run build
git diff --check
```

Run the full functional browser suite because the topbar transfer flow and
shared single-Undo presenter change. Run visual comparison when the new review
surface changes captured shell states.

## Acceptance criteria

- Selecting a valid setup file never changes live or persisted state before
  explicit Apply.
- The user can identify the candidate target/style and all six replaced setup
  areas from the review.
- Dismiss, invalid input and stale async results leave state unchanged.
- Apply and Undo each operate on one complete validated rewrite setup.
- Undo restores browser persistence when available and says when restoration
  is session-only.
- Loading an in-app saved setup keeps its current target behavior and adds one
  complete Undo without modifying the saved collection.
- The app retains one pending Undo, strict input limits, sanitized errors,
  local-state recovery safety and current schemas.
- Focused, architecture, build, browser and diff gates pass.

## Implementation evidence

- `SetupFileTransferControllerCore` now owns only bounded read/parse,
  latest-attempt sequencing, sanitized errors, one in-memory review candidate,
  one-shot consume/Dismiss and export. It has no persistence, recovery-unblock
  or live-state dependency.
- The pure setup-import review model and shell component expose only resolved
  target/style/mode metadata, bounded count comparisons, the Dense sort and
  the six-area replacement consequence. Reading disables only the file input,
  and Dismiss returns focus to it.
- `App.tsx` captures and applies one complete `SavedSetupState`, persists
  before each imported Apply or Undo, refreshes recovery after accepted
  replacement and reports session-only durability truthfully. Saved-row Load
  captures the same complete boundary and restores it through the same helper
  without mutating the saved collection.
- Focused controller/component tests cover strict failures, metadata privacy,
  latest-request wins and stale/duplicate consume behavior. Chromium coverage
  proves pre-Apply immutability, Dismiss, all-six-area Apply, durable Undo,
  session-only Apply/Undo, preserved recovery blocking and saved-row
  Load/Undo.
- No setup export, browser persistence, Duel collection or share-link schema
  changed.

## Open questions

None block implementation. A future goal may assess atomic Undo for the wider
legacy migration transaction, but it must not be pulled into this bounded setup
replacement change.

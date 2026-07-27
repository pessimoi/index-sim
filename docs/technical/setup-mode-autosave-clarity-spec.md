# Default/custom setup mode and autosave clarity specification

- Status: implemented
- Date: 2026-07-21
- Owner: setup shell, rewrite setup persistence and local-state feedback
- Evidence: verified
- Contract: living

- Priority: high
- Estimated effort: M
- Feature-inventory parent: `Basic combat setup` (`Valmis`)
- Depends on: the current `setupMode`, local-state recovery controller and
  application-level status/attention surfaces
- Related boundary: [cross-tab local-state conflict safety](cross-tab-local-state-conflict-spec.md)
  owns detection and resolution when another open tab changes the same saved
  browser data; it is not required to implement this clarity card

## Purpose

Make the existing Default and monster-specific Custom setup state machine
explicit at the point where users edit combat inputs, and show whether the
latest rewrite setup is saved in browser-local storage or exists only in the
current session.

This goal does not add a setup type or a manual Save workflow. It clarifies the
scope and durability of the setup that already owns every editable combat,
loadout, Trip and Planner-target input.

## Verified current behavior and problem

- `src/app/state/ui-state.ts` defines exactly two setup modes: `default` and
  `custom`.
- The Default form supplies every monster that has no entry in
  `customSetupsByMonster`. A Custom form is keyed by one monster id and is used
  only for that monster.
- `src/app/App.tsx` writes ordinary field edits through `commitFormState()` to
  either `defaultForm` or the current monster's custom entry according to
  `setupMode`.
- Target selection automatically opens the target's Custom form when one
  exists and otherwise opens the Default form with the selected target id.
- `src/app/components/shell/workbench-shell.tsx` currently shows compact
  `New`, generic `Edit`, `Remove` and `Reset` actions. With no current custom
  setup, `Edit` and `Remove` are disabled even though all visible fields remain
  editable as Default values.
- `src/app/view-models/app-shell.ts` presents `Default setup`, `Custom setup` or
  `Default setup - custom saved`, but it does not state which setup the visible
  fields are currently changing.
- The rewrite setup persistence effect in `src/app/App.tsx` automatically
  saves the six-family `SavedSetupState` under `index-sim:rewrite-setup` after
  ready-state changes. The result is not shown beside the editor.
- Save failures and unavailable persistence already feed the structured
  local-state recovery controller and global attention surface. The visually
  hidden global status channel also announces individual actions, but neither
  surface gives persistent, setup-specific positive feedback after an
  ordinary successful autosave.

The editor therefore leaves three important questions implicit: whether the
user is changing the shared Default or one monster's Custom setup, whether a
field change saves automatically, and whether the saved value will survive a
reload in this browser.

## Browser storage and autosave contract

The current browser-local persistence mechanism remains the implementation
boundary. This goal must not introduce a second setup store or a new write
path.

### Storage location and ownership

- The durable store is the selected browser profile's `window.localStorage`.
- The exact key remains `index-sim:rewrite-setup`, exported as
  `REWRITE_SETUP_STORAGE_KEY`.
- The exact envelope version remains `3`, exported as
  `REWRITE_SETUP_VERSION`.
- The serialized value remains the validated versioned envelope
  `{ version, savedAt, data }`, where `data` is the complete
  `SavedSetupState`.
- Browser-local storage is scoped to the page origin: scheme, host and port.
  Different origins, browser profiles, devices and private-browsing lifetimes
  do not share this value.
- Clearing site data may remove the value. This is not account, cloud,
  repository, Cloudflare, server or cross-device storage.
- [Workspace backup and restore](workspace-backup-restore-spec.md) remains the
  explicit file-based portability and recovery path. Autosave does not replace
  it.

The ready UI must not expose the raw storage key, serialized envelope or
browser exception text. User-facing copy describes the location as saved in
this browser.

### Autosave trigger and timing

Autosave observes the complete canonical rewrite setup after application
readiness. A save is eligible whenever any of these existing owners changes:

- the active `form`;
- the shared `defaultForm`;
- `setupMode`;
- `customSetupsByMonster`;
- `denseCompare`; or
- `cannonByMonster`.

Only an accepted canonical value triggers this persistence contract. A numeric
or other field may retain a literal draft for validation; an invalid or
uncommitted draft is not serialized as setup truth. Once the field owner emits
an accepted value, the existing state normalization runs and the next ready
effect attempts the complete save. Selectors and other immediately committed
controls become eligible on their normal state update.

The save is automatic and requires no Save action, navigation or page unload.
The implementation may coalesce React updates naturally, but it must not rely
on a delayed timer or unload-only write for durability. Each attempt validates
the complete `SavedSetupState`, creates a new `savedAt` instant and writes one
complete envelope through the existing local-state recovery controller.

### Reload and invalid-data behavior

Runtime bootstrap reads the same key once, checks the envelope version and
validates `data` through `SavedSetupSchema` before applying it. A valid value
restores the active form, Default form, mode, Custom map, Dense state and Cannon
state together.

Missing data falls back to the canonical initial setup. Unsupported, malformed
or context-invalid stored data must continue through the existing local-state
health and recovery policy. Ordinary autosave must not silently overwrite a
blocked value before the user clears or explicitly replaces it through an
accepted recovery transaction.

### Persistence outcomes

- A successful `localStorage.setItem()` attempt for the exact current complete
  value authorizes `Saved locally`.
- Safe-session memory storage, unavailable browser storage or a protective
  recovery block authorizes `Session only`; existing durable browser data must
  remain untouched.
- An attempted durable `localStorage.setItem()` failure authorizes
  `Could not save` and keeps the live in-memory value usable.
- A newer canonical setup invalidates the previous positive claim until its
  own attempt settles. The UI may show `Saving…` during this gap.
- A later successful write clears the setup-specific failed outcome.

These outcomes describe the current tab's selected storage boundary. This card
does not claim multi-tab synchronization or conflict protection. If the related
cross-tab safety specification is implemented, a suspended rewrite-setup write
must not render `Saved locally`; the conflict owner supplies the more specific
review state and remains authoritative until resolution.

## Feature-inventory check

`Basic combat setup` remains `Valmis`. Per-style loadouts, Default and Custom
forms, target selection, setup import/export, reset, recovery and Undo already
exist in the root rewrite. This specification is a high-priority clarity and
trust pass over that completed workflow, not a missing setup capability.

The status remains `Valmis` before and after implementation. The implementation
must not introduce a third setup mode, a new persisted area or a separate
manual-save feature.

## Implemented result

The ready Setup context now derives one typed editor presentation from the
active two-mode state machine. It names the current owner, exposes only the
valid destination-aware actions, explains Default/Custom scope and reports the
durability of the exact current six-family setup as `Saving…`, `Saved locally`,
`Session only` or `Could not save`.

`src/app/App.tsx` owns one runtime-only complete-value identity and routes both
ordinary autosave and the existing reset/replacement persistence transaction
through the same outcome owner. The persisted key, version-3 envelope, schemas,
field ownership, Review/Undo behavior and recovery policy are unchanged.

The shared shell layout was reviewed at desktop, 640 x 360, mobile and portrait
tablet sizes. Long action names remain complete, the compact landscape uses no
setup-context horizontal scrolling and the reset Review slot retains its own
bounded desktop scroll owner.

## Validation status

Focused app-shell, recovery, adapter and conditional-owner coverage passes
eight files / 105 tests. Nine targeted production-preview Chromium
transactions cover Default/Custom ownership, reset, setup import, sharing,
legacy migration, invalid local state and cross-tab behavior. The complete
read-only Darwin suite passes 26/26 against the reviewed baselines.

The shared repository gate passes architecture (173 source modules, 158
client-reachable modules, eight external entrypoints and no cycles), 1,085
unit tests, 19 goldens, typecheck, production build, lint and format. The
artifact has 20 JavaScript chunks and a 779,983-byte raw / 229,673-byte gzip
direct entry, below D-098's unchanged 230,000-byte gzip limit. The reduction
comes from real conditional loading of setup import/reset/share reviews, the
share dialog, legacy migration presentation and view-model, and local-state
attention banner; no budget, storage key, version-3 envelope, schema or
transaction semantics changed.

## User promise

At all times in the ready workbench, the setup context answers:

1. `Editing default` or `Editing custom`;
2. which monsters receive those edits;
3. that changes save automatically; and
4. whether the latest complete rewrite setup is `Saved locally`, `Session only`
   or `Could not save`.

`Saved locally` means durable browser-local storage for the current browser
profile. It does not imply an account, cloud sync, cross-device availability or
permanent retention after browser data is cleared.

## Goals

- Replace ambiguous setup-mode and generic `Edit` presentation with an
  explicit editor-state label.
- Rename `New` to the self-describing `Create monster setup` action.
- Preserve access to both the current Default and an existing current-monster
  Custom setup through explicitly named switch actions.
- Explain once in the setup context that Default applies to monsters without
  their own setup and Custom applies only to the current monster.
- Show setup-specific autosave capability and the latest save outcome without
  making users open Settings.
- Keep existing setup reset, review, replacement and one-step Undo
  transactions unchanged.
- Add browser evidence for Default/Custom isolation, switching, autosave,
  reload and session-only behavior.

## Non-goals

- Do not add another setup mode, setup inheritance level, profile, character,
  slot, draft or explicit Save button.
- Do not change `SavedSetupSchema`, `REWRITE_SETUP_VERSION`,
  `REWRITE_SETUP_STORAGE_KEY`, setup transfer envelopes or share-link formats.
- Do not change which fields belong to `CombatSetupFormState`, `defaultForm` or
  `customSetupsByMonster`.
- Do not change the target-selection rule that prefers an existing Custom setup
  and otherwise uses Default.
- Do not auto-create, auto-remove or merge Custom setups.
- Do not change the semantics of reset Review/Confirm, setup replacement
  Review/Apply, saved-row Load, removal Undo or any other pending Undo.
- Do not add persisted dismissal state for the explanatory copy.
- Do not duplicate the full local-state recovery report, storage diagnostics or
  destructive Clear controls in the setup context.
- Do not change simulation requests, formulas, generated data, prices,
  histories, Duel collections, loot state or calculated output.
- Do not add telemetry, accounts, cloud persistence, a database or a backend.

## Terminology and scope copy

Use `Default` for the shared fallback setup and `monster setup` in action copy
for a monster-specific Custom setup. `Custom` remains the compact mode name
because it is the persisted `setupMode` vocabulary and already appears across
the product.

The visible mode label is exactly one of:

- `Editing default`; or
- `Editing custom`.

Place one short explanation in the setup context, not in a dismissible coach
mark:

> Default applies to monsters without their own setup. A custom setup applies
> only to the current monster.

Equivalent copy may include the current monster's resolved display name, but
it must preserve the qualifier `without their own setup`. Saying only that
Default applies to “all monsters” would be inaccurate when a Custom entry
overrides it.

“Explain once” means one shared explanation in this layout, not a once-per-
browser tutorial. It requires no new persistence or dismissal state.

When Default is active and the current monster also has a saved Custom setup,
add the concise contextual fact `Custom setup saved for <monster>.` The generic
current label `Default setup - custom saved` is replaced by the structured mode
label plus this separate fact.

## Setup action contract

Remove the generic visible `Edit` label. The alternate-setup action, when one
exists, must name its destination.

| Current state                          | Visible mode      | Available setup actions                                            |
| -------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| Default; no Custom for current monster | `Editing default` | `Create monster setup`, `Reset active setup`                       |
| Default; current Custom exists         | `Editing default` | `Edit monster setup`, `Remove monster setup`, `Reset active setup` |
| Current Custom is active               | `Editing custom`  | `Edit default setup`, `Remove monster setup`, `Reset active setup` |

Unavailable alternate and removal actions are omitted instead of rendered as
disabled generic controls. This avoids implying that the visible Default fields
are read-only. If compact layout constraints require a disabled destination
action, its full visible label and reason must remain available; a disabled
button labelled only `Edit` is not acceptable.

Action semantics remain:

- `Create monster setup` clones the normalized currently visible Default form
  into `customSetupsByMonster[currentMonster]`, activates `custom` mode and
  makes no unrelated state change.
- `Edit monster setup` loads the existing normalized Custom form for the
  current monster and activates `custom` mode.
- `Edit default setup` loads the normalized Default form with the current
  monster id and activates `default` mode. The existing Custom entry remains
  saved and unchanged.
- `Remove monster setup` removes only the current monster's Custom entry,
  activates Default and preserves the current removal Undo transaction.
- `Reset active setup` retains the current review-gated, active-owner-aware and
  persistence-aware contract in `active-setup-reset-spec.md`.

The visible action text and accessible name use the same full phrase. Native
`title` text may repeat the action but must not carry meaning absent from the
visible label or accessible name.

## Default/custom transition contract

The implementation must preserve these invariants:

- While `setupMode === "default"`, every normalized field mutation updates
  `form` and `defaultForm`; it does not mutate any Custom entry.
- While `setupMode === "custom"`, every normalized field mutation updates
  `form` and only `customSetupsByMonster[form.monsterId]`; it does not mutate
  `defaultForm` or another monster's Custom entry.
- Creating a monster setup starts from the full currently visible form,
  including all three per-style loadout caches, Trip inputs, manual overrides
  and Planner targets already owned by that form.
- Selecting a target with a Custom entry activates that Custom setup.
  Selecting a target without one activates Default with the selected target id.
- Explicitly switching to Default for a monster that has a Custom entry is an
  editing choice for the current view. It does not delete the Custom entry or
  change the automatic target-selection rule.
- Switching back to the current monster's Custom setup restores its latest
  normalized values.
- Reload restores `setupMode`, active form, Default and all Custom entries from
  the existing validated version 3 envelope.

These are characterization requirements for current behavior. If code and this
section disagree during implementation, treat the discrepancy as a defect or
an open product question; do not silently redefine setup ownership to make the
presentation easier.

## Autosave presentation contract

Render one compact setup-specific status adjacent to the mode/scope
presentation. The steady states are:

| Kind           | Visible label    | Meaning                                                                                                 |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `saved`        | `Saved locally`  | The exact latest complete rewrite setup was written to durable browser-local storage.                   |
| `session-only` | `Session only`   | The live setup is usable, but the app intentionally cannot write this setup to durable browser storage. |
| `failed`       | `Could not save` | A durable write of the latest complete rewrite setup was attempted and failed.                          |

A short transient `Saving…` state is allowed and preferred when the current
six-family setup value is newer than the latest attempted save. It prevents a
previous `Saved locally` label from falsely describing an edit whose effect has
not run yet. The ready UI must not stay in `Saving…` after the synchronous
browser-storage attempt settles.

The labels have these fixed consequences:

- `Saved locally`: `Changes save automatically in this browser.`
- `Session only`: `Changes are kept for this session and may be lost after reload.`
- `Could not save`: `The latest setup change could not be written to browser storage.`

The consequence may be visible compact copy, an accessible description or a
native disclosure, but the state label itself must always be visible. Color or
an icon alone is insufficient.

### State classification

Classification uses structured state, never parsed English status messages:

1. Before the first ready-state persistence outcome for the current setup,
   present `Saving…`.
2. If `rewrite-setup` persistence is intentionally skipped because the area is
   recovery-blocked, saved data is ignored for this tab or persistence is known
   to be unavailable, present `Session only`.
3. If a durable attempt returns the controller's `save_failed` outcome for
   `rewrite-setup`, present `Could not save`.
4. If the exact current `SavedSetupState` is saved durably, present
   `Saved locally` and clear an earlier setup-specific failure.

`Could not save` is for an attempted write failure. `Session only` is for a
known non-durable mode or a protective recovery block where no overwrite may be
attempted. Both continue to feed the existing global local-state attention
surface; the setup status does not replace it.

### Complete-value and freshness rule

The status describes the complete `SavedSetupState`, not only the currently
visible field. Its identity therefore covers the existing six families:

- `form`;
- `defaultForm`;
- `setupMode`;
- `customSetupsByMonster`;
- `denseCompare`; and
- `cannonByMonster`.

Track the exact setup value or an ephemeral revision/signature for which the
last attempt completed. Do not show `Saved locally` for a newer state merely
because an older state saved successfully. The token is runtime-only and must
not be added to persisted or transferred setup data.

Direct setup transactions that call `persistAndApplyRewriteSetup()`—including
reset Apply/Undo and setup replacement Apply/Undo—must report their result to
the same setup-specific status owner. The existing detailed transaction copy
and pending Undo remain authoritative for the action; the compact status only
reports durability.

Ordinary successful autosave must not overwrite the global action status or
re-announce a live region after every keystroke. Save failure continues through
the recovery controller's existing announcement and persistent global
attention behavior.

## Presentation and responsive layout

Keep the information in the existing `Setup context` landmark near the monster
selector and setup actions. A suitable compact order is:

1. current monster;
2. visible mode label and optional saved-Custom fact;
3. one scope/autosave explanation;
4. setup actions; and
5. `Saved locally`, `Session only`, `Could not save` or transient `Saving…`.

The exact visual arrangement may share rows, but mode and persistence must not
be encoded in one ambiguous sentence. The current result metrics remain
separate.

At desktop widths, the longer action labels may wrap as an action group but
individual labels remain intact. At the current 640x360 compact landscape,
portrait tablet and 390 px mobile contracts:

- no action text clips or ends in ellipsis;
- the page gains no horizontal document overflow;
- mode, persistence and scope copy remain readable;
- action order follows the state table; and
- the existing Setup Review slot and active-pane scrolling ownership remain
  unchanged.

## Accessibility contract

- The mode label is visible text associated with the `Setup context` landmark.
- The persistence label is visible text with an accessible description of its
  consequence. Do not rely on tone alone.
- Do not give ordinary `Saved locally` rerenders an assertive or polite live
  region; field-level autosave would create repetitive announcements.
- Existing mode-change action statuses and recovery failure announcements may
  continue through the global status surface.
- Every action is a native button with the full accessible names defined in the
  action table.
- Omitted actions are absent from keyboard navigation. There is no disabled
  generic `Edit` stop.
- Focus remains on the activating switch action after a Default/Custom switch
  unless the control is replaced; in that case, move focus to the corresponding
  newly available reverse action or the visible mode heading. Removal and reset
  keep their current Undo/review focus contracts.

## View-model and ownership contract

Extend the pure app-shell presentation boundary instead of encoding setup-mode
copy and action availability independently in the component. An equivalent
contract is:

```ts
type SetupPersistencePresentation =
  | { kind: "saving"; label: "Saving…"; description: string }
  | { kind: "saved"; label: "Saved locally"; description: string }
  | { kind: "session-only"; label: "Session only"; description: string }
  | { kind: "failed"; label: "Could not save"; description: string };

interface SetupEditorContextViewModel {
  mode: "default" | "custom";
  modeLabel: "Editing default" | "Editing custom";
  scopeDescription: string;
  savedCustomDescription: string | null;
  showCreateMonsterSetup: boolean;
  alternateAction: "edit-default" | "edit-monster" | null;
  showRemoveMonsterSetup: boolean;
  persistence: SetupPersistencePresentation;
}
```

Exact names may vary. Required ownership is:

- `src/app/view-models/app-shell.ts` or one direct setup-shell view-model owner
  builds deterministic labels and action availability from typed inputs.
- `src/app/components/shell/workbench-shell.tsx` renders the model and invokes
  callbacks. It does not inspect storage, persisted schemas or recovery reason
  strings.
- `src/app/App.tsx` remains the owner of live setup state, Default/Custom
  transitions, the autosave effect, direct setup transactions, global status
  and recovery composition.
- The local-state recovery controller remains the owner of persistence attempts,
  structured failures, blocks, unblocks and the aggregate attention surface.
  The implementation may add a typed setup-attempt result at the caller
  boundary, but it must not duplicate recovery policy in the component.

Do not parse `setStatus()` copy, controller notice strings or rendered banner
text to infer mode or durability.

## Interaction with existing Review and Undo transactions

- Setup file preparation remains mutation-free until explicit Apply.
- Setup replacement Apply/Undo still captures and restores all six setup
  families through the current validated transaction.
- `Reset active setup` still reviews the active Default or current-target Custom
  owner, preserves mode and provides one durable/session-only Undo.
- `Remove monster setup` keeps its current single pending Undo and restores the
  prior Custom map, mode, Default and form.
- Loading a saved Duel setup keeps its current complete prior-setup Undo.
- A new ordinary field edit or successful autosave does not create, replace or
  clear pending Undo.
- The compact persistence label must update after Apply and Undo without
  replacing their more specific visible success copy.

## Implementation sequence

1. Add pure view-model cases for all three Default/Custom action states and all
   four persistence presentation states.
2. Introduce one App-owned ephemeral latest-setup persistence outcome tied to
   the exact complete setup value.
3. Route the ordinary rewrite-setup effect and direct setup persistence
   transactions through that outcome without changing controller recovery
   policy.
4. Replace generic setup copy/actions in the shell and add responsive styles.
5. Add focused component and production-preview browser coverage, then run the
   full repository and read-only visual gates.

## Required tests

### Unit and component coverage

Extend the direct app-shell suites to prove:

- Default without a Custom shows `Editing default`, `Create monster setup` and
  no generic or disabled `Edit`/removal action;
- Default with a saved Custom shows `Edit monster setup`, removal and the
  saved-Custom fact;
- active Custom shows `Editing custom`, `Edit default setup` and removal;
- resolved monster names appear only in bounded scope copy;
- `saving`, `saved`, `session-only` and `failed` map to fixed visible labels and
  consequences;
- action visibility is derived from `setupMode` plus current Custom existence,
  including impossible/inconsistent input normalization; and
- the component emits the expected accessible names without reading storage.

Keep focused local-state recovery coverage for save-failure recording,
successful retry clearing, protective blocking and safe-session persistence.
The persistence and adapter suites must additionally prove:

- the exact `index-sim:rewrite-setup` key receives a version-3
  `{ version, savedAt, data }` envelope containing all six setup families;
- an uncommitted or invalid field draft does not replace the last accepted
  canonical envelope;
- a valid envelope restores the six families together after reload; and
- unsupported, malformed or context-invalid raw data remains untouched while
  ordinary rewrite-setup persistence is blocked.

### Browser transitions

Add focused Chromium transactions that prove:

1. editing Default changes the value seen by another monster without a Custom,
   reaches `Saved locally` and survives reload;
2. `Create monster setup` clones the visible Default, later Custom edits remain
   isolated to the current monster, target navigation restores the correct
   owner and reload preserves both values;
3. explicit `Edit default setup` and `Edit monster setup` switching does not
   delete or overwrite the inactive owner;
4. removal still activates Default and its existing Undo restores the Custom
   setup and durable reload state;
5. a tab with ignored/unavailable storage shows `Session only` while edits
   remain usable and original browser data is unchanged; and
6. an injected rewrite-setup save failure shows `Could not save`, the existing
   global recovery attention remains available and a later successful save
   returns the setup label to `Saved locally`.

Reuse the existing setup/recovery fixtures. Do not inspect private raw values in
rendered copy; direct localStorage assertions may compare the known validated
test envelope.

### Validation commands

```sh
npm run typecheck
npm run test -- src/tests/app-shell-view-model.test.ts src/tests/app-shell-components.test.tsx src/tests/local-state-recovery-controller.test.ts src/tests/ui-adapters.test.ts
npm run test:e2e -- --workers=1 --grep "setup mode|setup autosave|monster-specific custom setups"
npm run test:e2e:visual
npm run verify
git diff --check
```

The visual command is read-only. Update baselines only after explicit review if
the accepted setup-context layout intentionally changes them.

## Acceptance criteria

- The ready setup context always says `Editing default` or `Editing custom`.
- The UI explains that Default is the fallback for monsters without their own
  setup and Custom is current-monster-only.
- There is no visible or accessible generic `Edit` setup action.
- `Create monster setup`, `Edit monster setup`, `Edit default setup`,
  `Remove monster setup` and `Reset active setup` appear only in the states
  defined by the action table.
- Default edits continue to affect only the Default owner; Custom edits continue
  to affect only the current monster's Custom owner.
- Target selection, explicit switching, removal, reset, replacement and reload
  preserve the existing state-machine semantics.
- The latest complete rewrite setup shows truthful `Saved locally`, `Session
only` or `Could not save` feedback, with no stale saved claim for a newer
  unattempted state.
- Durable setup data remains origin- and browser-profile-local under the exact
  version-3 `index-sim:rewrite-setup` envelope; no server, account or
  cross-device storage path is introduced.
- Only accepted canonical state is serialized. Invalid or uncommitted input
  drafts cannot replace the last accepted setup.
- Successful retry clears a prior setup save failure; protective recovery blocks
  never overwrite the blocked stored setup.
- Autosave success does not spam the global status/live region or create Undo.
- Existing Review and Undo transactions retain their current scope and copy.
- No persistence key, schema/version, transfer, domain, calculation, price or
  backend contract changes.
- Focused unit, browser, full repository and read-only visual validation pass.

## Open questions

None. The product terminology, action states, persistence labels and ownership
boundaries required for implementation are resolved by this specification.

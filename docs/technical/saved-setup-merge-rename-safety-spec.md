# Saved setup Merge and rename safety specification

- Status: implemented
- Date: 2026-07-20
- Owner: technical documentation
- Evidence: verified
- Contract: closed

Implementation evidence:

- `src/app/state/duel-snapshots.ts` owns comparison-only NFKC/lower-case
  name keys, operation-level name validation, deterministic Save suffixes,
  duplicate-name occurrence metadata and ID-only safe rename derivation. The
  version-1 schema remains permissive for readable historical duplicates.
- `src/app/state/saved-setup-merge.ts` owns the immutable source/current
  fingerprint, deterministic row classifications, default-Keep replacement
  decisions, selected-capacity counts, recipient-name status, stale detection,
  Refresh defaults and exact candidate construction.
- `src/app/controllers/saved-setup-changes.ts` owns the one-key direct
  Merge/rename transaction. It captures the exact raw preimage, writes and
  verifies the version-1 envelope before live publication, rolls back exactly
  on handled failure, exposes only explicit session-only alternatives and
  guards durable/session Undo with both live and raw postimages.
- `DuelPane` now renders complete row decisions and source-field diffs, focuses
  a new review, returns Dismiss focus to Import, exposes stale Refresh and uses
  one controlled explicit Rename editor. Historical duplicate names receive
  visible and accessible ordinal disambiguation in comparison and matrix
  presentation.
- Focused state/controller/component coverage passes 30/30 and the two
  deterministic Chromium saved-setup transactions pass. They cover default
  Keep/explicit Replace, source-only diff, capacity and name conflicts, exact
  raw Undo, stale Refresh, blur/Escape/Enter rename semantics, duplicate-name
  actions, mobile containment and unchanged unrelated storage.
- The broader owning regression set passes 142/142, the full functional suite
  passes 1,014/1,014, goldens pass 19/19, architecture passes with 158 source
  modules / 143 client-reachable modules and no cycles, and the production
  build passes with only the known chunk-size advisory. `git diff --check` and
  focused ESLint pass. The final combined release run passes 115/115 functional
  Chromium cases and two complete 26/26 read-only Darwin visual runs; both Duel
  baselines remain accepted without an owned update.

Priority: medium.

Estimated effort: M.

## Purpose

Finish the existing browser-local saved-setup workflow so importing a
collection cannot overwrite a matching setup without row-level consent and
renaming cannot commit accidentally on blur or report a non-durable change as
saved.

This is a safety and trust pass over the implemented Setups tab. It keeps saved
setups, comparison calculations, file transfer and browser persistence in their
current owners. It does not add accounts, cloud collections or a new setup
type.

## Feature-inventory check

- `Setup comparison` is `Valmis` in
  [the feature inventory](../product/feature-inventory.md). Save, rename, load,
  delete with Undo, current-monster comparison, diff review, all-monster matrix,
  persistence and file import/export are implemented.
- the implemented
  [game-revision and setup-transfer context contract](game-revision-transfer-context-spec.md)
  already provides strict contextual/legacy parsing, compatibility checks,
  review-before-Merge and context copy. This specification retains those
  boundaries and refines the merge decision inside that review.
- the implemented
  [Workspace contract](workspace-backup-restore-spec.md) already owns complete
  multi-area backup, typed Duel Merge, atomic Apply/rollback and Undo. This
  specification does not replace or reinterpret Workspace Merge.
- the implemented
  [Duel setup diff](duel-setup-diff-spec.md) already provides source-backed
  active-field comparison. Its pure field-label/diff vocabulary can be reused
  for an ID-conflict preview without adding calculated output to saved state.
- account-backed saved setups remain an unpromoted idea. No server, account,
  sharing or infrastructure decision is opened here.
- Setup comparison remains `Valmis` during and after this work. The follow-up
  closes a distinct accidental-overwrite, accidental-rename and durability-
  feedback gap.

## Verified current behavior and gap

The following is verified against the production rewrite on 2026-07-20:

- `index-sim:duel-snapshots` version 1 stores at most 12 strict normalized
  `{ id, name, form }` rows. It excludes calculated results and is separate from
  the active rewrite setup.
- external collection files use the contextual saved-setup transfer envelope;
  the strict prior version-1 envelope remains readable as unknown context.
- parsing rejects oversized, malformed, duplicate-key, duplicate-ID,
  unsupported-version, computed and current-revision-incompatible input before
  a review is created.
- `mergeDuelSnapshots(current, imported)` replaces the complete current row
  whenever an imported row has the same ID. New IDs are appended until the
  12-row cap; remaining additions are skipped.
- the visible import review reports only file, add, update and limit-skip
  counts. It does not show which current rows will be replaced, how their names
  or forms differ or let the user keep an individual current row.
- `Merge setups` mutates the collection after the review, but it has no
  collection Undo. Success copy is published before durability has been
  distinguished from a persistence failure by the ordinary effect path.
- the review preview is recomputed implicitly against the latest collection at
  render time. Once per-row decisions exist, silently rebasing those decisions
  would be unsafe.
- a saved name is currently an uncontrolled input. Enter causes blur, blur
  commits immediately, Escape restores the initial value and also blurs.
- rename validation rejects an empty or overlong name through the schema, but
  the UI reports every other accepted call as `Renamed saved setup`, including
  an unchanged name or a missing/stale snapshot ID.
- duplicate normalized display names are valid today and can be created by
  repeated Save, rename or import. IDs remain the true identity, but ordinary
  row actions do not disambiguate duplicate names for the user.
- rename and import Merge update React state and rely on the general persistence
  effect. A failed write leaves the session value changed while the action copy
  can still sound durably successful.
- Load has a complete active-setup Undo and Delete has a one-step collection
  Undo. Rename and imported Merge do not have equivalent recovery.

The user-visible gap is bounded: the collection exists and works, but the two
operations most likely to overwrite identity or meaning do not require a
specific reviewed decision and do not prove what was saved.

## Goals

- Treat saved-setup ID and display name as separate concepts in both copy and
  merge policy.
- Classify every imported row against the exact current collection before
  mutation.
- Make matching-ID replacement opt-in per row; default to keeping the current
  row.
- Let the user choose which new rows consume limited capacity and resolve a
  conflicting recipient name before Apply.
- Show a bounded source-backed active-field diff for every selected replacement.
- Detect a changed current collection and require an explicit review refresh;
  never silently rebase prior decisions.
- Replace blur-to-commit rename with explicit Save/Cancel, inline validation,
  stable focus and stale/no-op handling.
- Prevent new operations from creating ambiguous normalized names while keeping
  existing valid version-1 collections readable.
- Persist successful Merge and rename through one single-key transaction before
  claiming durable success.
- Give a changed Merge or rename one complete global Undo that restores the
  exact prior collection and, when safe, the exact prior stored bytes.
- Keep unavailable-storage/session-only behavior explicit and preserve later
  values on stale Undo.
- Preserve current comparison formulas, current-target Load semantics, file
  validation, context review, Workspace policy and version-1 schemas.

## Non-goals

- No account-backed, server-managed, shared, publishable or cross-device saved
  setup collection.
- No database, auth, API, provider, deployment or production-domain change.
- No new saved-setup fields, folders, tags, notes, timestamps, favorites,
  search, bulk delete or arbitrary reordering.
- No persisted rename draft, merge review, row selection or conflict decision.
- No change to `DUEL_SNAPSHOTS_VERSION = 1`, transfer kind/version, exported
  JSON shape, import byte limit or 12-row cap.
- No change to `CombatSetupFormState`, active setup, SimulationRequest, Duel
  comparison, matrix, diff calculations or shared current monster/price/loot
  context.
- No automatic replacement based on equal names and no use of names as
  persistent identity.
- No automatic ID regeneration for matching-ID conflicts and no `Import as
copy` branch in this slice.
- No repair or mutation of an imported source file.
- No implicit deletion of current rows to create capacity.
- No change to Workspace Duel Merge, legacy-migration precedence, setup-file
  replacement, share links, Delete or Load transaction semantics.
- No global history stack. The existing single pending Undo remains
  authoritative.

## Identity and name policy

### Stable identity

`DuelSnapshotState.id` remains the only merge identity.

- equal IDs mean that the imported row is a candidate replacement for that
  exact current row;
- different IDs never replace one another, even when their names and forms are
  identical;
- renaming never changes an ID;
- editing an imported recipient name during review never changes its ID; and
- technical IDs are shown only inside a labelled technical disclosure or
  accessible disambiguation when needed. They are not the primary setup name.

### Stored name

The stored name continues to use the existing normalization and 80-character
limit. Empty names remain invalid.

Add one comparison-only name key:

```text
normalizeDuelSnapshotName(name)
-> Unicode NFKC normalization
-> locale-stable lower-case comparison
```

The key is never persisted. It detects names that differ only by whitespace,
case or compatibility-equivalent Unicode for recipient-side ambiguity.

New or changed recipient names must be unique by that key across the resulting
collection, excluding the row being renamed or replaced. This operation-level
guard does not tighten `DuelSnapshotsStateSchema`: an existing or imported
version-1 collection with duplicate names still parses and remains recoverable.

Pre-existing duplicate groups that are untouched do not block another
operation. A matching-ID form replacement may retain that row's exact current
name even when older data already contains the same key elsewhere. A new row or
an actually renamed replacement may not join or create such a group.

### Existing duplicate names

Existing duplicate-name rows remain visible and calculable. The view model
adds:

- a visible `Duplicate name` note beside each affected name;
- an accessible ordinal such as `Melee setup, 1 of 2 saved setups with this
name`; and
- unique accessible names for Review diff, Rename, Load and Delete actions.

The same ordinal disambiguation is used in all-monster matrix headers and other
saved-row selectors. It is presentation only and never changes the stored name.

No row is auto-renamed on load. The next explicit rename can resolve it.

### New Save name

`Save current setup` continues to derive its base name from the current weapon,
ammo, spell or fallback. Before creating the row, use one shared unique-name
helper:

```text
Base name
Base name (2)
Base name (3)
...
```

Choose the lowest available positive suffix and trim the base before appending
the suffix so the final stored name satisfies the existing 80-character
schema. This is the only Save-current change in scope. Capacity, ID generation,
form capture, status and persistence owner remain otherwise unchanged.

## Import merge planning

Introduce a pure saved-setup-file merge plan. Do not change the semantics of
the low-level `mergeDuelSnapshots` helper used by Workspace or legacy flows.

The plan input is:

```ts
interface SavedSetupMergePlanInput {
  reviewId: number;
  source: DuelSnapshotsState;
  current: DuelSnapshotsState;
  contextReview: SetupTransferContextReview;
  gameData: GameDataSnapshot;
}
```

The plan captures a deterministic fingerprint of the ordered normalized current
collection. The fingerprint covers every row's `id`, normalized `name` and
normalized `form`. It is in-memory freshness evidence, not a persisted content
hash or security boundary.

Every imported row receives exactly one primary classification:

| Classification          | Condition                                          | Initial decision                              |
| ----------------------- | -------------------------------------------------- | --------------------------------------------- |
| `unchanged`             | same ID, name and normalized form                  | fixed `No change`                             |
| `replacement-candidate` | same ID but name or normalized form differs        | `Keep current`                                |
| `addition-candidate`    | new ID                                             | selected `Add` while initial capacity remains |
| `capacity-excluded`     | new ID after initial available slots are allocated | `Do not add`                                  |

Name validity is an orthogonal row status:

- `available`: proposed recipient name is valid and unique in the planned
  result;
- `conflict`: another resulting row owns the same comparison key;
- `invalid`: empty or over the existing length bound; or
- `not-applicable`: unchanged or current-kept row.

The parser's duplicate-ID rejection remains earlier than planning. Duplicate
names inside the source are not a parse error; selected recipient rows must be
renamed or deselected before Apply.

## Row decisions

### Unchanged row

Show source name, `Already identical` and no interactive decision. It does not
count as Added, Replaced or Excluded and cannot create an Undo.

### Matching-ID replacement

Show:

- imported name;
- current name;
- a `Matching saved-setup ID` label;
- total active-field change count;
- a native disclosure containing name change plus grouped current-to-imported
  active-field values; and
- a `Keep current` / `Replace current` native radio group.

`Keep current` is always the initial value. Selecting `Replace current` includes
the imported normalized form and proposed recipient name in the candidate. If
that name conflicts with another resulting row, show an editable `Recipient
name` field and block Apply until it is unique or the decision returns to Keep.

The diff reuses or extracts the existing Duel setup field-label and source-name
helpers. It does not calculate DPS, XP, GP, trip or matrix output and does not
claim causal impact.

### New-ID addition

Show source name, compact combat style/loadout identity and an `Add this setup`
checkbox.

- the earliest additions in file order are initially selected up to available
  capacity;
- later additions start unselected as `No room selected`;
- deselecting one addition releases a slot immediately;
- the user may then select another addition;
- selecting more additions than available slots is impossible or produces an
  inline capacity error and disables Apply; and
- a selected name conflict exposes `Recipient name` and blocks Apply until it
  is unique. An unselected row does not block Apply.

The plan never deletes a current row to make room. Guidance for a collection
with no available slot is: `Keep this review open or dismiss it, delete a saved
setup you no longer need, then refresh or import again.`

### Recipient name edit

A recipient name edit changes only the in-memory plan row.

- it uses the same normalization, validation and uniqueness helper as direct
  rename;
- it never mutates the parsed source object;
- it never changes source or recipient ID;
- Escape restores that row's last planned valid/source name;
- Enter validates but does not Apply the complete merge; and
- review Dismiss discards every edited recipient name.

## Dynamic review summary

The review summary is derived from current row decisions and exposes:

- setups in file;
- selected Add;
- selected Replace;
- Keep current;
- Already identical;
- Not selected; and
- capacity `selected additions / available slots`.

Do not retain the ambiguous `Update` count. A matching ID is not an update until
the user selects Replace.

The primary button reads `Merge selected setups`. It is enabled only when:

- at least one selected Add or Replace changes the current collection;
- every selected recipient name is valid and unique;
- selected additions fit available capacity;
- the review is fresh; and
- no direct rename edit is awaiting Save or Cancel.

When there is no selected change, show `Nothing selected to merge` and preserve
Dismiss. Do not create a no-op state write, success claim or Undo.

## Review freshness

Once the review is visible, its source candidate and current-collection
fingerprint are fixed. Do not silently regenerate row decisions because the
live collection changed.

Before every decision mutation and Apply, compare the captured fingerprint with
the current collection.

- equal: continue;
- unequal: mark the review `Out of date`, disable all row decisions and Merge,
  and keep the parsed source candidate in memory;
- `Refresh review`: build a new plan against the latest current collection,
  reset all decisions to their safe defaults and focus the new review heading;
  and
- `Dismiss`: discard the candidate and focus the existing Import control.

Refresh intentionally does not guess how prior Keep/Replace/name decisions map
to changed current data. A newer imported file remains latest-request-wins and
replaces the older review entirely.

Changes that invalidate the fingerprint include Save current, rename, Delete,
import Merge, Workspace restore, legacy import, local recovery replacement and
any other live Duel collection replacement. Loading a saved setup into the
active editor does not change the collection and therefore does not invalidate
the review.

## Direct rename interaction

Replace the always-editable uncontrolled name input with display text and a
`Rename` action.

Only one direct rename editor may be active. It contains:

- a controlled `Saved setup name` text field initialized from the exact current
  row;
- `Save name` and `Cancel` buttons;
- inline description/error text associated through `aria-describedby`; and
- the target snapshot ID plus collection fingerprint held outside the DOM.

Interaction contract:

- activating Rename focuses and selects the current name;
- Enter attempts `Save name`;
- Escape cancels, restores display state and returns focus to Rename;
- blur never commits, cancels or changes state;
- clicking outside may leave the editor open; it never silently loses a draft;
- activating another Rename while one is open focuses the existing editor and
  announces `Save or cancel the current name first.`; and
- after successful Save, no-op or Cancel, focus returns to the same row's
  stable Rename action.

Validation outcomes:

| Outcome                                            | Behavior                                                        |
| -------------------------------------------------- | --------------------------------------------------------------- |
| empty or over 80 characters                        | keep editor open; inline error; no mutation                     |
| comparison-key duplicate                           | keep editor open; `Another saved setup already uses this name.` |
| exact normalized name unchanged                    | close as `Name unchanged`; no write and no Undo replacement     |
| snapshot missing or collection fingerprint changed | mark editor stale; no mutation; offer `Refresh name` or Cancel  |
| valid changed name                                 | create one persistence-aware rename transaction                 |

`Refresh name` reloads the target row's current name and a new collection
fingerprint. If the ID no longer exists, cancel the editor, focus the Setup
comparison heading and show `That saved setup is no longer available.`

## Single-key mutation transaction

Imported Merge and direct rename use one shared transaction boundary for
`duel-snapshots`. Save current and Delete may retain their current owner in this
slice, but every collection mutation must invalidate a pending Merge/rename
Undo when it does not replace it with a newer Undo.

### Preparation

For a ready changed candidate:

1. revalidate the plan/editor freshness;
2. validate the complete candidate with `DuelSnapshotsStateSchema`;
3. capture the exact current live collection;
4. read the exact raw/null value of `index-sim:duel-snapshots` into a private
   controller closure;
5. serialize the candidate through the existing version-1 persistence helper
   with an injected current time; and
6. do not expose raw values in React state, view models, logs or copy.

### Durable Apply

The durable transaction order is:

1. announce no success and make no live mutation yet;
2. write the version-1 postimage to the single saved-setup key;
3. read back or otherwise verify the exact expected postimage;
4. on failure, restore the exact raw/null preimage before returning;
5. if rollback succeeds, leave live state unchanged and offer explicit
   session-only Apply;
6. if rollback cannot be proven, leave live state unchanged, mark
   `duel-snapshots` for Local state recovery and do not offer session-only Apply
   until recovery establishes a safe boundary;
7. on success, use `prepareExternalApply(["duel-snapshots"])`, publish the live
   candidate once and complete Local state recovery so the ordinary effect does
   not write a second envelope; and
8. only then publish durable success and one pending Undo.

An explicit Merge may replace a currently blocked invalid Duel key because its
strict candidate has been reviewed. Successful durable Apply unblocks only
`duel-snapshots`. Undo of that replacement may restore the invalid raw preimage;
the recovery refresh must then truthfully restore attention while the prior
safe live fallback becomes active.

### Session-only Apply

When saved data is ignored for the tab, storage is unavailable, the raw
preimage cannot be read before any write or a write fails with proven safe
rollback, do not silently change the collection.

Expose one explicit action:

- `Merge for this session`; or
- `Rename for this session`.

It applies the already-reviewed strict candidate only in memory, suppresses the
next persistence effect, states that reload may restore the prior saved
collection and registers a session-only Undo. It never writes the original
browser key.

The session action is not offered after a stale plan, invalid name, capacity
error, unproven rollback or zero-change candidate.

## Undo contract

A successful changed durable or explicit session-only Merge/rename replaces the
existing single pending global Undo. Dismiss, Cancel, validation failure,
stale attempt, no-op or failed Apply leaves the prior pending Undo unchanged.

Required labels:

- Merge action: `Merged saved setups: A added, R replaced` plus bounded kept/not
  selected detail in the inline result;
- Merge restore: `Restored saved setups from before merge`;
- rename action: `Renamed saved setup: Old name to New name`;
- rename restore: `Restored saved setup name: Old name`.

The Undo record privately captures:

- exact pre-action and post-action live collections;
- exact raw/null preimage and verified raw postimage for durable mode;
- the operation kind and bounded labels; and
- a consumed flag.

### Durable Undo

Before restoring:

1. require the current live collection fingerprint to equal the operation's
   postimage fingerprint;
2. require the current raw stored value to equal the verified raw postimage;
3. if either differs, consume the stale Undo without changing live or saved
   state and report `Saved setups changed after this action, so Undo did not overwrite the newer value.`;
4. otherwise restore the exact raw/null preimage;
5. verify or safely roll back the storage write;
6. publish the exact prior live collection with one-shot persistence
   suppression; and
7. refresh/complete Local state recovery for only `duel-snapshots`.

If durable Undo cannot write but safely retains the postimage, leave live state
unchanged and offer explicit `Undo for this session`. That action restores only
the prior live collection, suppresses persistence and truthfully states that
reload may return the saved post-action value.

If rollback or current stored state is unknown, do not overwrite either side.
Consume the unsafe Undo, surface Local state recovery and use fixed sanitized
copy.

### Session-only Undo

Require the current live fingerprint to match the postimage. Then restore the
prior live collection once without storage access. A mismatch preserves the
newer live value and consumes the stale Undo.

### Later collection changes

Any successful later Duel collection change must either:

- register its own newer pending Undo through the global latest-action rule; or
- explicitly clear a pending saved-setup Merge/rename Undo.

This includes Save current, Delete, Workspace/legacy replacement and recovery
Apply. It prevents an older collection Undo from clobbering a later no-Undo Save.

## Import result and retained context

After success, the existing import notice reports:

```text
Merged saved setups: A added, R replaced, K kept, N not selected.
```

Append the existing current-revision suffix for non-exact source context. Do
not call kept matching-ID rows `updated`, and do not say every setup was
imported when some were not selected.

The review's exact/same/different/unknown revision context copy remains visible
and authoritative before Apply. Current recipient game data and active prices
remain calculation owners after Merge. Export metadata timestamps remain file
metadata only.

## Focus, keyboard and accessibility

### Merge review

- After a file is parsed, focus the `Review saved setups` heading once.
- Context copy precedes row decisions in semantic order.
- Each row is a labelled fieldset or article; do not rely on color or table
  position for classification.
- Keep/Replace uses native radios; Add uses a native checkbox; recipient-name
  validation is programmatically associated with its input.
- Replacement change detail uses native `details`/`summary` and has a bounded
  change count in its accessible name.
- Repeated setup names receive ordinal accessible disambiguation.
- Changing selection updates one polite compact count; it does not announce the
  entire review list.
- After Refresh, focus the new review heading. After Dismiss, focus `Import
setups`. After successful Merge, focus the `Manage saved setups` summary or
  stable import result notice rather than the removed Apply button.
- Escape does not dismiss the complete review; Dismiss remains explicit.

### Rename

- Rename is a native button and edit controls follow it in DOM order.
- The controlled text input has a stable visible label.
- Enter, Escape, Save, Cancel and blur follow the direct-rename contract above.
- Invalid/stale feedback uses a polite associated status and does not move
  focus away from the field.
- Focus returns to a stable row action after success/no-op/Cancel without
  scrolling the document unnecessarily.
- Delete and Load retain their existing names/behavior; duplicate-name ordinals
  make them distinguishable to assistive technology.

No action relies on hover-only content. Focus-visible styles must remain visible
without layout shift, and forced-colors mode must preserve selected/invalid/
stale distinctions.

## Responsive and visual contract

At 1440 x 1000 desktop:

- the Setups pane remains its current independent scroll owner;
- at most 12 review rows fit the existing bounded content flow;
- field diffs and decisions do not overlap the MonsterCard rail; and
- current comparison/table horizontal overflow behavior is unchanged.

At 640 x 360 compact landscape and 390 x 844, 620 x 844 and 768 x 1024
normal-flow layouts:

- review rows stack as cards or use one explicitly bounded internal overflow
  owner; the document must not gain horizontal overflow;
- source/current names, counts, radios, checkboxes, name input and action
  buttons wrap without clipping;
- a long 80-character name does not push actions off-screen;
- open diff disclosures extend the Setups pane's vertical content without
  trapping focus; and
- Save/Cancel and Merge/Dismiss remain reachable through normal tab and scroll
  order.

Only Setups-owned baselines may change by default. Shared global Undo visuals
belong to the global Undo contract and must not be rewritten here unless its
actual shared layout changes.

## Persistence, compatibility and privacy

- browser persistence remains `index-sim:duel-snapshots` version 1;
- external contextual and prior legacy saved-setup file shapes remain exactly
  as implemented;
- current strict parse, byte, duplicate-key/ID, form, cap and entity-
  compatibility gates remain earlier than review;
- candidate decisions, edited recipient names, collection fingerprints and raw
  Undo bytes never enter persistence or export;
- exact raw bytes remain private to transaction closures and never appear in UI,
  status, logs, errors, telemetry or test snapshots;
- success/failure copy contains only bounded setup names and counts;
- calculated comparison output, current prices, player name, Workspace areas
  and active setup remain excluded from saved rows; and
- safe-session mode never reads or changes the ignored original localStorage
  value.

## Relationship to existing merge owners

This follow-up deliberately narrows its amendment:

- the visible saved-setup file import no longer uses automatic incoming-ID-wins
  behavior at its Apply boundary;
- `mergeDuelSnapshots` may remain as a low-level normalized helper or be renamed
  for clarity, but Workspace and legacy behavior cannot silently inherit the
  new row-decision defaults;
- Workspace continues to apply the reviewed area-level Merge plan and its
  complete multi-area transaction/Undo;
- legacy migration continues to keep rewrite-owned conflicts according to its
  accepted precedence;
- contextual transfer continues to own source revision copy and compatibility;
  and
- this specification owns only saved-setup file row decisions, direct rename
  and their single-key transaction/Undo.

The implemented game-revision transfer specification's statement that saved-
setup import uses unchanged ID-wins merge becomes historical current-state
evidence. When this follow-up is implemented, amend that section to point here
for the new explicit Keep/Replace policy; do not rewrite context behavior.

## Architecture and ownership

- `src/app/state/duel-snapshots.ts` owns schemas, normalization, identity,
  comparison-name keys, unique-name suggestion, collection fingerprint and pure
  resulting-candidate construction.
- a focused controller under `src/app/controllers` owns imported candidate,
  review ID/freshness, row decisions, single-key durable/session Apply and Undo
  closures. It stores no raw value in React state.
- `src/app/view-models/duel.ts` owns source-backed row summaries, duplicate-name
  presentation, field-diff reuse/extraction and bounded user copy.
- `src/app/components/panes/duel-pane.tsx` owns review/rename markup, controlled
  drafts and same-pane focus refs.
- `src/app/App.tsx` remains the composition boundary for browser storage access,
  Local state recovery, current collection publication and the single global
  pending Undo.
- `src/app/controllers/use-duel-pane.ts` retains calculated matrix lifecycle;
  file/rename transactions do not enter the calculation Worker.
- `src/app/styles.css` owns contained Setups presentation.
- Workspace, legacy migration, setup transfer context and runtime-bootstrap
  compatibility remain separate existing owners.

No domain module may import app state, browser storage or React. No new
architecture exception is allowed.

## Implementation slices

### Slice 1: identity, names and pure merge plan

1. add comparison-name and unique-name helpers;
2. make Save current choose the next available display name;
3. add duplicate-name view-model disambiguation without schema rejection;
4. implement current-collection fingerprint;
5. classify every imported row and construct safe default decisions; and
6. extract/reuse source-backed active-field diff helpers.

### Slice 2: review controller and presentation

1. move ad hoc import review state out of App into a focused controller;
2. retain strict parse/context/compatibility and latest-request-wins behavior;
3. render row-level Add/Keep/Replace/name decisions and dynamic counts;
4. implement capacity selection and no-op/invalid gating;
5. implement explicit stale state and Refresh; and
6. add bounded focus/announcement behavior.

### Slice 3: explicit rename

1. replace uncontrolled blur commit with one controlled editor;
2. implement Save/Cancel/Enter/Escape and stable focus;
3. add empty/length/duplicate/no-op/stale outcomes;
4. prevent a pending rename draft from being silently discarded; and
5. route valid changes into the shared collection transaction.

### Slice 4: durable/session transaction and Undo

1. capture private raw/null preimage and strict live candidate;
2. write/verify/rollback one version-1 key before live Apply;
3. integrate one-shot persistence suppression and Local state recovery;
4. expose explicit session-only Merge/rename only after a safe boundary;
5. register one latest global Undo for successful changed operations;
6. enforce live/raw postimage stale guards and exact durable restore; and
7. invalidate old collection Undo on every later collection mutation.

### Slice 5: complete evidence and living-doc closure

1. add pure/controller/component/failure tests;
2. extend the current saved-setup production-preview transaction;
3. prove Workspace, legacy and transfer-context non-regression;
4. inspect desktop/compact/mobile Setups images;
5. run complete functional, golden, architecture, build and diff gates; and
6. promote implementation status/evidence without changing the feature's
   `Valmis` status.

## Expected implementation files

Likely source owners:

- `src/app/state/duel-snapshots.ts`
- one focused saved-setup import/change controller under `src/app/controllers`
- `src/app/view-models/duel.ts`
- `src/app/components/panes/duel-pane.tsx`
- `src/app/App.tsx`
- `src/app/styles.css`

Potentially touched only for stable integration, not changed semantics:

- `src/app/controllers/local-state-recovery.ts`
- `src/app/controllers/workspace-restore-plan.ts`
- `src/app/state/setup-transfer-context.ts`
- legacy-migration saved-setup helpers

Likely evidence owners:

- `src/tests/ui-adapters.test.ts`
- a new focused saved-setup change/controller test
- `src/tests/duel-view-model.test.ts`
- `src/tests/compare-duel-panes.test.ts`
- `src/tests/local-state-recovery-controller.test.ts`
- `src/tests/workspace-restore-plan.test.ts`
- `src/tests/workspace-restore-executor.test.ts`
- `src/tests/legacy-migration-setup.test.ts`
- `src/tests/setup-transfer-context.test.ts`
- `src/tests/e2e/planner-duel.spec.ts`
- Setups visual scenarios

## Required automated evidence

### Name and state tests

Prove at minimum:

- whitespace/case/NFKC comparison conflicts while stored normalization remains
  version-1 compatible;
- empty and overlong names fail without mutation;
- a case-only valid rename of the same row remains possible when it does not
  collide;
- exact normalized no-op returns no changed candidate;
- suffix selection chooses the lowest available number and stays within 80
  characters;
- repeated Save current produces distinct readable names;
- existing duplicate names still parse and expose visible/accessible
  disambiguation;
- direct rename never changes ID or form; and
- missing/stale target IDs do not report success.

### Merge-plan tests

Prove at minimum:

- same ID/name/form is unchanged;
- same ID with name-only, form-only and both changes starts at Keep current;
- selecting Replace changes only that ID and exposes the exact bounded field
  diff;
- different IDs with identical forms never replace one another;
- new unique IDs add in source order within capacity;
- additions beyond capacity start unselected and can trade selection with an
  earlier addition;
- selected additions can never exceed available slots;
- current/source/result duplicate-name conflicts block only selected affected
  rows until renamed or deselected;
- a recipient-name edit leaves source data and ID unchanged;
- unchanged/kept/unselected rows are reflected exactly in dynamic counts;
- zero selected changes disables Apply and preserves prior Undo;
- current collection change marks the plan stale without rebasing decisions;
- Refresh rebuilds safe defaults against the latest collection; and
- all 0/1/11/12-row boundary combinations remain deterministic.

### Transaction and failure tests

Use an injectable single-key storage double and deterministic time. Prove:

- review and direct rename draft perform zero writes before Apply/Save;
- Dismiss, Cancel, invalid, no-op and stale attempts leave live/raw state and
  prior pending Undo unchanged;
- durable Merge and rename write a valid version-1 envelope before one live
  publication;
- ordinary persistence is suppressed exactly once after direct Apply and Undo;
- exact raw/null preimage is restored by durable Undo;
- a blocked invalid raw preimage can be explicitly replaced, then restored by
  Undo with Local state attention returning;
- get/set/remove/readback failures before and after mutation trigger exact safe
  rollback where possible;
- rollback failure leaves live unchanged and blocks only `duel-snapshots`;
- safe rollback exposes explicit session-only Apply and does not perform it
  automatically;
- safe-session Apply and Undo never touch original browser storage;
- raw or live postimage mismatch makes Undo stale and preserves the newer value;
- Undo write failure safely retains the postimage and exposes explicit
  session-only Undo;
- one Undo is consumed once;
- a later Save/Delete/rename/Merge/Workspace/legacy/recovery collection change
  invalidates or replaces an older Merge/rename Undo; and
- unrelated localStorage keys remain byte-identical.

### Component and browser tests

Prove at minimum:

- import focus reaches review heading and Dismiss returns to Import;
- every source row has classification, current match, decision and name status;
- matching-ID replacement is initially Keep and requires an explicit Replace;
- the active-field disclosure is keyboard-operable and source-name-first;
- capacity selection/counts and recipient-name validation update accessibly;
- stale review disables decisions/Apply and Refresh resets/focuses correctly;
- `Merge selected setups` unmounts review without losing focus;
- Rename opens one controlled editor, blur does not commit, Enter saves and
  Escape/Cancel restore without mutation;
- duplicate/stale errors are associated with the name input;
- an existing duplicate-name collection has unique accessible row actions;
- durable and explicit session-only success/Undo copy is truthful;
- non-exact context suffix remains present;
- current target, active form, prices and comparison math remain unchanged by
  collection Merge/rename; and
- reload proves durable state and Undo in the saved-setup key only.

The production-preview transaction should include:

1. two current rows, one of which shares an imported ID;
2. an imported unchanged row, matching-ID changed row, unique addition and
   duplicate-name addition;
3. default Keep, viewed diff, explicit Replace and recipient rename;
4. capacity selection at or near 12;
5. Dismiss with byte-identical state;
6. successful durable Merge, exact visible result and Undo/reload;
7. explicit direct rename Save/Undo with blur/Escape checks;
8. a stale review caused by a later collection change; and
9. injected persistence failure followed by explicit session-only behavior.

Use local deterministic files only. Do not call any live provider.

## Validation commands

Implementation validation must include, adjusting a new focused controller
filename to its actual owner:

```bash
npm run typecheck
npm run architecture:check
npm run test -- src/tests/ui-adapters.test.ts src/tests/duel-view-model.test.ts src/tests/compare-duel-panes.test.ts src/tests/local-state-recovery-controller.test.ts src/tests/workspace-restore-plan.test.ts src/tests/workspace-restore-executor.test.ts src/tests/legacy-migration-setup.test.ts src/tests/setup-transfer-context.test.ts
npm run test:e2e -- --workers=1 --grep "saved setup|saved setups|Workspace backup|Legacy setup comparisons"
npm run test:golden
npm run test
npm run build
npm run test:e2e -- --workers=1
git diff --check
```

Run the repository's read-only visual comparison and inspect Setups desktop,
compact-landscape and mobile diffs before any explicit baseline update. Use the
current authoritative visual commands from [testing.md](testing.md).

Goldens remain required because collection changes select which existing forms
are recalculated in Duel comparison, even though this specification changes no
formula.

## Acceptance criteria

This specification is implemented only when all of the following are true:

- saved setup ID remains the sole merge identity and name remains a display
  label;
- every imported row receives a visible deterministic classification;
- matching-ID differences default to Keep and require explicit row-level
  Replace;
- every selected replacement has a bounded source-backed active-field diff;
- additions consume only explicitly selected available capacity;
- no new/changed operation creates a normalized duplicate recipient name;
- existing duplicate-name version-1 collections remain readable and
  disambiguated;
- a changed current collection makes the review stale instead of silently
  rebasing decisions;
- rename commits only through explicit Save, never blur, and has complete
  invalid/no-op/stale/Cancel behavior;
- durable Apply is proven before live state and success copy; unsafe failure
  cannot leave an unreported partial collection;
- session-only Merge/rename and Undo occur only after an explicit user action;
- successful changed Merge/rename exposes one complete latest global Undo;
- stale Undo preserves later live and saved values;
- exact raw/null preimage is restored when durable Undo is safe;
- browser/transfer schemas, caps, parse/context/compatibility gates, Workspace
  and legacy merge semantics remain unchanged;
- active setup, target, prices and all calculation formulas remain unchanged;
- keyboard/focus/live-region/mobile contracts pass; and
- focused, failure-injection, Workspace/legacy/context regression, full
  functional, golden, architecture, build, browser, visual-review and diff
  gates pass.

## Documentation closure after implementation

- change this status to `implemented` and record measured focused/full evidence;
- keep `Setup comparison` as `Valmis` in the feature inventory and amend its row
  with explicit Keep/Replace, safe rename and persistence-aware Undo behavior;
- move the backlog card from `Specced` to `Done`;
- amend only the saved-setup merge-policy paragraph in
  [game-revision-transfer-context-spec.md](game-revision-transfer-context-spec.md)
  so context stays owned there and row decisions point here;
- retain Workspace and legacy merge truth in their current living owners;
- update [testing.md](testing.md) if exact authoritative test or visual-owner
  commands change; and
- update architecture docs only if the implementation chooses a materially
  different owner boundary from the one specified here.

## Open questions

None. Helper/controller filenames and local CSS class names remain
implementation choices. Stable ID identity, recipient-name uniqueness for new
operations, default Keep on ID conflict, capacity selection, stale review,
explicit rename, durable/session transaction, Undo freshness and compatibility
boundaries are decided here.

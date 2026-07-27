# Local price-history lifecycle management specification

- Status: implemented
- Date: 2026-07-20
- Owner: Economy price-history state, presentation and persistence lifecycle
- Evidence: verified
- Contract: closed

- Priority: high
- Estimated effort: M
- Feature-inventory parents: `Loot/economy summary` and `Market price sync`
  (`Valmis`)
- Depends on: browser-local price-history v2, read-only shared history,
  implemented Economy exact-raw Undo, Local state recovery and Workspace
  backup/restore

## Purpose

Make the existing browser-local comparison history understandable and safely
manageable throughout its bounded lifetime.

Users can already capture local comparisons, analyze them together with shared
history and clear every local point. They cannot see which local snapshots they
own, remove one unwanted point or know that the twenty-first capture silently
discards a prior point. This specification closes that lifecycle gap without
adding market data, another history store or a new analysis feature.

## Feature-inventory boundary

The affected feature rows remain `Valmis`:

- `Loot/economy summary` already owns shared/local movers, trends, baselines and
  Loot history context;
- `Market price sync` already owns the selected/scheduled/bundled PriceSet and
  automatic local capture after an accepted imported PriceSet;
- browser-local history v2 already owns provenance-preserving snapshots; and
- Workspace backup/restore already transfers the complete local-history area.

This specification is a separate management and failure-feedback follow-up.
The existing UI exposes only aggregate Shared/Local counts plus `Save local
comparison` and confirmed `Clear local history`. It has no local-snapshot
inventory, individual removal or visible retention boundary.

The implemented Economy destructive-action Undo remains the recovery owner for
exact raw preimages. This goal extends that proven boundary to individual
removal and full-capacity replacement; it does not create a second Undo model.

The implemented
[user-friendly price date and time presentation specification](price-date-time-presentation-spec.md)
owns localized visible date and time wording. This goal passes semantic
timestamps through the management model, and the shared formatter now renders
them without changing canonical lifecycle identities.

## Implemented outcome

Economy Price history now owns one local-only lifecycle surface with `N/20`
capacity, duplicate-safe occurrence rows, chronological markers and semantic
timestamps. Under-cap Save commits directly; a full manual Save reviews the
exact oldest occurrence before replacement. Individual removal uses the same
complete-state stale check and both destructive paths register the existing
one-step exact-raw Economy Undo. The final row removes the local key.

The direct controller validates the complete state before storage, writes one
v2 envelope or clears the key, protects blocked raw data and reports durable
versus session-only truth without allowing the generic persistence effect to
retry a failed action. PriceSet acceptance now exposes `added` versus
`full-skipped`; at capacity the PriceSet remains active/persisted, history keeps
exact identity and fixed guidance points the user to this normal review flow.
Shared history, combined analysis, Workspace, schemas and formulas are
unchanged.

## Baseline before implementation

### Baseline data and analysis contract

`src/app/state/price-history.ts` already defined:

- `index-sim:price-history` version 2;
- at most 20 browser-local snapshots;
- at most 2,000 numeric item prices per snapshot;
- a snapshot with `capturedAt`, source PriceSet id and label, item prices,
  matching item metadata and point statuses;
- explicit v1-to-v2 migration without invented observation times;
- newest-first append through `appendAcceptedPriceSetToHistory()`; and
- a separate analysis merge over read-only shared and browser-local snapshots.

The local state schema does not require snapshot keys to be unique or the
stored array to be chronological. `priceHistorySnapshotKey()` combines
`capturedAt` and `sourcePriceSetId`; analysis sorts by capture time, while the
append helper previously prepended and truncated the array to 20.

Shared `price-history.json` is loaded through the scheduled snapshot adapter and
never written by browser-local actions. Clearing local history removes only the
local key. Baseline, trend and Loot context consume the combined analysis
projection rather than either source independently.

### Baseline capture and persistence paths

- `Save local comparison` captures the active composed PriceSet at click time.
- Accepting an imported or compatible legacy PriceSet appends its canonical
  base PriceSet at acceptance time.
- The append helper prepended the new row and retained the first 20 array entries.
  In the ordinary newest-first state, at capacity it silently dropped the array
  tail; the schema itself does not prove that the tail is chronologically
  oldest.
- App applied appended state first and its normal persistence effect later
  wrote the v2 envelope. The action-specific success copy therefore could not
  prove whether that capture became durable.
- A failed import keeps history unchanged, and resetting the selected PriceSet
  preserves history.

### Baseline management and recovery paths

Economy shows combined snapshot totals and exposes confirmed all-local clear.
It does not list the local records behind that total. A user cannot identify a
mistaken duplicate, remove one obsolete experiment or see which point will be
lost next.

Confirmed full clear already:

- clears only `index-sim:price-history`;
- registers one global session-local Undo;
- restores the exact raw-or-missing preimage only after a postimage byte check;
- falls back to live-only restoration on unavailable storage, failure or
  cross-tab drift; and
- leaves shared history, PriceSets, manual prices and analysis controls intact.

Workspace backup includes local history and supports reviewed Replace/Merge.
It is the broad transfer/recovery workflow, not an ordinary per-point editor.

## Goals

- Put one visible local-history lifecycle summary under Economy `Price history`.
- Show every accepted browser-local snapshot as one bounded, deterministic
  management row, separate from shared history.
- Make the 20-point retention cap and remaining capacity visible before loss.
- Prevent any ordinary capture path from silently evicting a local snapshot.
- Let a user review and remove one exact local snapshot.
- Let a full-history manual capture review the exact oldest snapshot it will
  replace before mutation.
- Persist Save, individual removal and reviewed replacement through one
  action-owned transaction with truthful durable or session-only feedback.
- Reuse the existing global one-step Economy Undo for destructive history
  changes.
- Recompute combined Economy and Loot history projections immediately from the
  accepted next local state.
- Preserve shared history, active PriceSet, manual prices, generated high alch,
  setup state and every unrelated browser-local key.

## Non-goals

- Do not make shared history editable, removable, exportable as local data or
  subject to the browser-local 20-point cap.
- Do not add a database, account, backend history API, cloud sync or live market
  request.
- Do not import the D-049 legacy full-history payloads.
- Do not add retention settings, pinning, manual ordering, snapshot rename,
  item-level deletion or history compaction controls.
- Do not add a dedicated history file format. Workspace backup remains the
  supported complete browser-local transfer path.
- Do not change item prices, point metadata, observation/evaluation semantics,
  mover/trend formulas, baseline modes or Loot calculations.
- Do not change `BrowserPriceHistorySnapshot`, storage key, version, envelope,
  item cap or 20-snapshot maximum.
- Do not make PriceSet acceptance and history persistence a cross-key atomic
  transaction. Their existing separate ownership remains explicit.
- Do not add a second toast, Undo button, persisted Undo stack or multi-step
  history of management actions.
- Do not solve localized date/time display here. The
  [price date and time presentation specification](price-date-time-presentation-spec.md)
  owns visible formatting and timezone policy.

## Local management projection

### Snapshot occurrences, not assumed unique keys

Management actions must target one occurrence in the validated local state.
Do not assume `priceHistorySnapshotKey()` is unique: the current schema allows
two rows with the same capture timestamp and source PriceSet id.

An equivalent pure presentation contract is:

```ts
interface LocalPriceHistoryRowViewModel {
  occurrenceId: string;
  sourceIndex: number;
  snapshotKey: string;
  label: string;
  capturedAt: string;
  sourcePriceSetId: string;
  itemCount: number;
  newest: boolean;
  oldest: boolean;
  nextReplacement: boolean;
  selectedAsBaseline: boolean;
}

interface LocalPriceHistoryManagementViewModel {
  count: number;
  maximum: number;
  remaining: number;
  atCapacity: boolean;
  rows: readonly LocalPriceHistoryRowViewModel[];
}
```

`occurrenceId` is transient presentation identity. Derive it from the snapshot
key plus its deterministic occurrence ordinal, then encode it before use in a
DOM id. Never persist it or use it in a transfer format. `sourceIndex` is valid
only against the exact source state used to create the projection.

### Ordering and oldest selection

Display local rows newest-first by parsed `capturedAt`. Break equal timestamps
by their current source-array order. Derive `newest` and `oldest` from that
order, not from label or PriceSet id.

The replacement candidate targets the chronologically oldest occurrence. When
several rows share the oldest timestamp, target the one latest in current
source-array order. Removing or replacing it preserves the relative stored
order of all retained rows; a new capture is prepended.

Do not rewrite local storage merely to reorder a valid loaded state. Analysis
already owns its chronological merge. A successful lifecycle mutation may
produce the canonical new-plus-retained ordering defined above.

### Row content

Each row shows:

- the validated snapshot label;
- capture time as a semantic `<time dateTime={capturedAt}>` value;
- tracked item count;
- text labels for `Newest`, `Oldest` and `Next to be replaced` where relevant;
- `Selected baseline` when the current explicit baseline resolves to that exact
  occurrence; and
- one `Review removal` action.

When duplicate snapshot keys exist, mark only the occurrence actually chosen
by the current combined-history baseline resolver. Matching the key alone must
not mark every colliding local row.

Put `sourcePriceSetId` and the exact combined snapshot key only in a labelled
`Technical details` disclosure. Do not list item maps, metadata maps, raw JSON,
storage keys or raw envelope values.

Rows are management facts only. They must not claim the capture time is an item
observation time, a point is market-observed because of its label or the active
PriceSet still matches that row.

## Economy presentation contract

Move the existing local-history controls into the Economy `Price history`
section so their owner is visually unambiguous. Do not leave duplicate Save or
Clear actions in the Market block.

Directly below the `Price history` heading, show:

- the existing shared/local source status;
- `Local comparisons <N>/20`;
- `<R> spaces remaining` or `History full`;
- the current `Save local comparison` action;
- one native disclosure labelled `Manage local comparisons (<N>/20)`; and
- the existing combined analysis summary and controls after the lifecycle
  surface.

When full, show persistent non-alert copy:

`History is full. Saving another local comparison requires replacing the oldest point.`

The management disclosure is transient and is not persisted. Inside it:

- render the local rows only;
- state that scheduled shared history is read-only and is not listed;
- retain the existing confirmed `Clear local history` action;
- show `No local comparisons saved.` when empty; and
- mention that local history is included in the existing Workspace backup,
  without adding a second export control.

The combined `Snapshots`, `Shared`, `Local`, item, mover, latest and baseline
summary remains authoritative for analysis. The management count must equal
the combined summary's Local count.

Render local-history action feedback once adjacent to this lifecycle surface.
PriceSet/import notices retain their Market ownership; do not duplicate either
notice in both sections.

At desktop the local rows may use a compact table or list. At 620 px and
portrait-tablet normal flow they become cards or a single-column grid. At
390 px, long labels, timestamps and actions wrap without horizontal document
overflow. At 640 x 360 compact landscape, the current center pane remains the
only vertical scroll owner.

## Capture and capacity policy

### Capacity below 20

When local count is below 20, `Save local comparison`:

1. captures the exact active composed PriceSet and one action timestamp;
2. validates a new v2 snapshot through the existing snapshot builder;
3. prepends it without changing prior rows;
4. commits the complete next local state through the persistence transaction;
5. updates combined analysis; and
6. reports durable or session-only success.

This additive save has no confirmation and does not register Undo. As today, a
successful new save invalidates an older Economy-scoped pending Undo. It does
not invalidate an unrelated global Undo unless the existing global
latest-successful-action policy explicitly treats this mutation as replacing
it; implementation must keep the current scoped invalidation contract.

Do not deduplicate equal numeric maps. Two captures at different times can be
intentional comparison points. Preserve their original metadata and separate
capture times.

### Manual capture at capacity

At 20 local snapshots, activating `Save local comparison` prepares a
replacement review instead of mutating state. The candidate captures:

```ts
interface FullHistoryReplacementCandidate {
  id: number;
  sourceHistory: BrowserPriceHistoryState;
  sourceActivePriceSet: PriceSet;
  newSnapshot: BrowserPriceHistorySnapshot;
  replacedOccurrence: {
    sourceIndex: number;
    snapshot: BrowserPriceHistorySnapshot;
  };
}
```

The review names the active PriceSet being captured and shows the exact oldest
local label, capture time and item count that will be removed. It states that
shared history and active prices do not change. Actions are exactly `Save and
replace oldest` and `Cancel`.

At Confirm, compare the candidate's complete validated source history and
source active PriceSet with latest live values. A history capture/removal,
PriceSet change, Workspace restore or another-tab live application makes it
stale and produces:

`Price history changed. Review the replacement again.`

Changing baseline, trend item, filters, sort, pane or disclosure state does not
make it stale. Stale, Cancel and duplicate Confirm make no mutation and preserve
the preceding pending Undo.

A successful replacement prepends the reviewed new snapshot and removes only
the reviewed oldest occurrence. It registers one global Economy Undo restoring
the complete pre-replacement local history.

### Accepted PriceSet capture at capacity

Accepted imported/legacy PriceSets remain primary PriceSet transactions. When
local history has capacity, their canonical base snapshot is appended through
the same direct history persistence path.

When local history is already full:

- PriceSet validation, acceptance and selected-PriceSet persistence proceed;
- local history remains byte-for-byte and live-state unchanged;
- no point is silently removed and no secondary review opens over the file
  transaction;
- the accepted PriceSet becomes active as today; and
- the visible success result adds:
  `Local history is full, so this PriceSet was not saved as a comparison. Review local history, then save it explicitly.`

The user may then use the normal full-history replacement review against the
now-active PriceSet. This bounded overflow exception replaces the current
silent truncation behavior; below capacity, accepted PriceSets continue to add
their local point.

PriceSet success and history durability remain separately reportable. A
durable selected PriceSet plus a session-only history append is a valid partial
cross-key outcome and must be described truthfully; do not roll back the
accepted PriceSet because optional comparison persistence failed.

### Workspace restore

Workspace Price history Replace/Merge keeps its existing reviewed cap,
collision, dropped-count, atomic batch and complete Workspace Undo contract.
It does not route through the ordinary Save/replacement review. After a
Workspace apply, this lifecycle projection rebuilds from the accepted live
state and any previous local-history review becomes stale.

## Individual removal review

`Review removal` creates one immutable in-memory candidate containing the
complete validated source history, source index and exact target snapshot. It
does not mutate React state, persistence, recovery or pending Undo.

The review shows label, capture time and item count and states:

- only this browser-local point will be removed;
- shared scheduled history and the active PriceSet stay unchanged;
- Economy movers/trends and Loot history context may select a new latest or
  baseline point; and
- Undo will be available once after successful removal.

Actions are exactly `Remove local comparison` and `Cancel`. Do not use
`window.confirm()`.

At Confirm, require the latest complete local state to equal the reviewed
source state. This intentionally makes any concurrent local-history mutation
stale, including a change that leaves an equal snapshot elsewhere. It prevents
an occurrence ordinal or source index from drifting onto another row.

- Stale copy: `Price history changed. Review removal again.`
- Duplicate Confirm is rejected.
- Cancel and stale outcomes preserve the preceding pending Undo.
- Successful Confirm removes exactly the reviewed source occurrence.
- Removing the final row clears the local key rather than persisting an empty
  v2 envelope.

After removal, reconcile the transient explicit snapshot selection to the
current effective combined-history option when its selected occurrence no
longer exists. Baseline mode, filter, sort and trend selection otherwise stay
unchanged; existing effective-value fallbacks handle items or points that no
longer exist.

## Persistence, recovery and Undo

### One direct mutation owner

Extend the DOM-free Economy history transaction owner instead of relying on a
later generic React persistence effect for action success. An equivalent
controller boundary accepts only `price-history`, a schema-validated complete
next state and the existing recovery port.

For Save, removal and replacement:

1. derive and schema-validate the complete next state before storage access;
2. reject stale/no-op outcomes before invalidating any Undo;
3. capture the exact raw-or-missing preimage in the existing private Undo
   closure when the action is destructive;
4. write one version-2 envelope with one action timestamp, or remove the key
   when next state is empty;
5. read the exact postimage for destructive Undo protection;
6. call `prepareExternalApply(["price-history"])` before applying live state so
   the normal effect consumes one skip;
7. update recovery state and refresh health once; and
8. apply one complete live state and publish fixed success copy.

Raw strings remain closure-private and never enter outcomes, UI, logs,
telemetry, export diagnostics or DOM snapshots. A write/remove failure applies
the complete next live state only for the session, records the sanitized
recovery failure and prevents the normal effect from retrying it implicitly.

If `price-history` is blocked because saved data could not be validated,
ordinary lifecycle actions must not overwrite or unblock that protected raw
value. They may change the validated in-memory history explicitly for this
session, with persistent Local state attention and truthful session-only copy.
The existing recovery or Workspace replacement flow remains the only route to
replace blocked saved data.

The handled-operation guarantee is exact read/write/remove behavior with
best-effort rollback as already specified for Economy Undo. Do not claim crash
atomicity or cross-tab locking.

### Success and failure copy

Use fixed, value-bounded messages:

- durable Save: `Saved local price comparison`;
- session-only Save: `Saved local price comparison for this session. Saved history was not changed.`;
- durable removal: `Removed local comparison: <Label>`;
- session-only removal: `Removed local comparison for this session: <Label>. Saved history was not changed.`;
- durable replacement: `Saved local comparison and replaced the oldest point: <Label>`;
- session-only replacement: `Updated local history for this session. Saved history was not changed.`; and
- Undo: `Restored local price history` with the existing session-only suffix
  rules when durable raw restoration is unsafe.

Bound `<Label>` to the existing validated 160-character maximum and render it
as text. Storage failures use the existing recovery notice; do not include
exceptions, raw values, storage keys or file paths.

### Destructive-action Undo

Individual removal and full-capacity replacement capture the complete prior
`BrowserPriceHistoryState`, not only one row. Their record reuses the current
`EconomyDataUndoRecord` exact preimage/postimage checks.

- Durable Undo restores the exact prior raw string or missing key, then the
  complete prior live state with one persistence skip.
- Session-only Undo restores only prior live state and isolated memory state;
  protected browser storage stays untouched.
- A raw mismatch leaves the newer saved value unchanged and restores live state
  only with truthful copy.
- The record is consumed once even on failure.
- Any later successful history mutation invalidates the older Economy history
  Undo under the current scoped rule.
- Navigation and analysis-control changes do not invalidate it.
- Reload and tab close discard it.

The global pending surface remains the only interactive Undo owner. Do not add
row-level Undo buttons or duplicate live announcements.

## Ownership and likely implementation files

- `src/app/state/price-history.ts`: occurrence projection helpers, oldest-point
  selection and exhaustive append/overflow planning while retaining v2 schema
  ownership.
- `src/app/state/local-price-history-lifecycle.ts` or equivalent: pure removal
  and full-capacity review candidates, stale checks and complete next-state
  derivation.
- `src/app/controllers/economy-data-undo.ts`: reuse exact raw private records;
  extract or extend a price-history commit path for direct save/remove/clear.
- `src/app/controllers/price-set-transfer.ts`: expose added/full-skipped/history
  persistence outcome without changing canonical PriceSet acceptance.
- `src/app/view-models/price-data.ts`: local lifecycle count, occurrence rows,
  capacity and baseline markers separate from combined analysis.
- `src/app/components/panes/economy-settings-pane.tsx`: lifecycle bar,
  management disclosure and inline reviews inside Economy Price history.
- `src/app/App.tsx`: candidate state, latest live capture, action application,
  selection reconciliation, recovery coordination and one global Undo.
- `src/app/styles.css`: desktop rows and compact/mobile wrapping.
- Focused state/controller/view-model/pane and production-preview tests.

Keep schemas and pure planning out of the pane. Keep DOM/focus state out of the
state and controller modules. If a new source module changes the production
dependency graph, run and update only the living architecture evidence required
by the normal architecture gate.

## Accessibility contract

- `Price history` remains a labelled section and the management disclosure has
  a visible count-bearing summary.
- Capacity status and row markers use text, not color alone.
- Every timestamp uses the implemented
  [shared visible price date and time presentation](price-date-time-presentation-spec.md):
  friendly exact local copy, canonical `<time dateTime>`, UTC title and stable
  seconds/ordinal disambiguation for colliding captures.
- Every removal action names the snapshot label and capture time in its
  accessible name.
- Review headings are focusable programmatically after opening.
- Cancel returns focus to the originating Save or row action.
- Stale review returns focus to the management disclosure summary and announces
  one polite status.
- Successful mutation does not steal focus to the global Undo; normal keyboard
  order reaches its single viewport-accessible owner.
- Valid capacity and review information does not use `role="alert"`. Fixed
  storage failures retain the existing alert convention.
- Long labels, friendly zoned timestamps and fixed status copy wrap at 390 px, and
  Technical details never becomes the row's sole accessible name.

This is a bounded keyboard/focus contract, not a WCAG conformance claim.

## Required tests

### Pure state and candidate tests

Prove:

- zero, partial and full management counts and remaining capacity;
- newest/oldest selection by timestamp rather than array position;
- deterministic equal-timestamp tie handling;
- duplicate snapshot keys receive distinct occurrence identities;
- local rows expose counts/labels without item maps or raw envelopes;
- under-cap Save prepends without changing prior rows;
- full automatic PriceSet capture returns `full-skipped` with exact state
  identity and does not drop a point;
- full manual replacement targets only the reviewed chronological oldest
  occurrence;
- removal targets one reviewed occurrence even when snapshot keys collide;
- removal of the final row derives the empty state;
- history or active-PriceSet changes stale replacement while analysis-control
  changes do not;
- any history change stales removal; and
- Cancel, stale, duplicate Confirm and no-op outcomes preserve prior state.

Retain existing mover/trend, missing/zero, v1 migration, metadata, 2,000-item
and shared/local merge tests.

### Persistence, recovery and Undo tests

Extend the Economy exact-raw suite. Prove:

- direct non-empty Save writes one valid v2 envelope and one action `savedAt`;
- final-row removal clears rather than writes an empty envelope;
- Save/remove/replacement schema failure performs no read, write or live apply;
- read, set and remove failures produce truthful session-only outcomes;
- blocked raw state is never overwritten or unblocked by ordinary lifecycle
  actions;
- one recovery skip prevents the normal effect from rewriting durable or
  session-only outcomes;
- each destructive action captures exact raw/null before and exact raw after;
- durable Undo restores byte-identical raw state and complete prior live order;
- cross-tab mismatch never overwrites the newer raw value;
- failed Undo rollback and recovery flags retain current sanitized behavior;
- successful later history mutation invalidates the prior Economy history Undo;
- analysis-only actions do not invalidate it; and
- raw strings, storage keys and exception text never enter public outcomes.

Retain the complete implemented Economy destructive Undo suite and Workspace
restore executor suite.

### PriceSet controller tests

Prove separately:

- accepted imported/legacy PriceSet below capacity keeps canonical-base capture;
- accepted PriceSet at capacity still becomes active/persisted while history is
  unchanged and the fixed capacity guidance is returned;
- selected-PriceSet persistence success plus history save failure is described
  as separate durability, without rolling back selected state;
- import failure changes neither owner;
- reset keeps local history; and
- accepted history capture keeps generated high alch out of item history and
  preserves item metadata exactly as today.

### View-model and component tests

Prove:

- one visible `Local comparisons N/20` lifecycle owner under Price history and
  no duplicate controls in Market;
- empty, partial and full status/copy;
- local-only rows even when shared history is present;
- deterministic row markers, Technical details and accessible action names;
- Save direct versus replacement-review branches;
- individual review content, Cancel focus and exact intent forwarding;
- Clear all retains its existing confirmation branch;
- management Local count equals combined summary Local count;
- deleted explicit baseline and unavailable trend item resolve through current
  effective fallbacks; and
- desktop, 640 x 360, 390 x 844, 620 x 844 and 768 x 1024 containment.

### Production-preview workflow

Seed shared history and three local points, including two identical snapshot
keys. Then prove:

1. combined analysis counts all points while management lists only local rows;
2. both colliding local occurrences are independently identifiable;
3. removal review mutates nothing before Confirm;
4. Confirm removes only the chosen occurrence, keeps an unrelated localStorage
   sentinel and updates Economy plus Loot history context;
5. one global Undo restores exact raw bytes, both occurrences and prior
   analysis after reload;
6. filling to 20 marks the chronological oldest as next replacement;
7. a PriceSet import at capacity keeps all 20 local rows and shows fixed
   full-history guidance while the PriceSet becomes active;
8. manual Save then reviews and replaces exactly that oldest row;
9. Cancel/stale replacement preserves state and the previous Undo;
10. successful replacement Undo restores the exact prior 20 rows;
11. deleting the only local row clears the key while shared analysis remains;
12. forced storage failure changes only session live state and survives neither
    reload nor protected-storage comparison; and
13. 390 px mobile and compact landscape have no horizontal document overflow
    or competing vertical scroll owner.

Add bounded visual evidence for populated/full lifecycle management at Economy
desktop and 390 px mobile. Review actual/diff images before updating only the
owning Economy baselines.

## Validation

Implementation evidence on 2026-07-20: the focused lifecycle, PriceSet,
recovery, Workspace and pane command passes 122/122 tests. Six targeted
production-preview Chromium workflows pass for age refresh, duplicate-key
individual removal and exact Undo, full-history replacement plus accepted
PriceSet separation, shared-history isolation and durable/session-only recovery.
Typecheck, the 155-source-module zero-cycle architecture check, 19/19 goldens,
production build and `git diff --check` pass. Complete cross-feature and visual
release verification remains part of the final combined goal step.

Run at minimum during implementation:

```sh
npm run test -- src/tests/market-ui-state.test.ts src/tests/local-price-history-lifecycle.test.ts src/tests/price-data-view-model.test.ts src/tests/economy-data-undo.test.ts src/tests/price-set-transfer-controller.test.ts src/tests/economy-settings-pane.test.ts src/tests/local-state-recovery-controller.test.ts src/tests/workspace-restore-executor.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "local price history lifecycle|price history Undo|browser-local price history|shared scheduled price history"
npm run test:e2e:visual
npm run test:golden
npm run build
git diff --check
```

Run the complete functional browser suite because PriceSet import, Economy,
Loot context, global Undo, recovery and Workspace share the touched state. Run
`npm run verify` after focused and visual evidence is accepted. No live market
provider, workflow re-enable, database or deployed environment is required.

## Acceptance criteria

- Economy shows every accepted local snapshot and the exact `N/20` lifecycle
  status separately from shared history.
- The twenty-first ordinary capture cannot silently discard an existing local
  point.
- Under-cap Save remains direct; full manual Save is review-gated and replaces
  only the reviewed chronological oldest occurrence.
- Accepted PriceSet at capacity remains accepted while local history stays
  unchanged with actionable fixed guidance.
- A user can review and remove one exact local occurrence, including when
  snapshot keys collide.
- Final-row removal clears the local key; shared history remains read-only and
  visible.
- Save, removal and replacement report durable versus session-only truth from
  their action-owned persistence result.
- Individual removal, full replacement and existing full clear use one complete
  global Economy Undo with exact raw/missing restoration safeguards.
- Economy analysis and Loot history context recompute from the accepted next
  local state without changing formulas or shared data.
- Active/base PriceSets, manual prices, generated high alch, setups, Planner,
  Hiscores, shared history and unrelated local state remain unchanged.
- No storage/file/request/result/provider schema, backend, account or database
  is added.
- The feature-inventory rows remain `Valmis`; this is lifecycle completion for
  existing local history.
- Focused state/controller/view-model/component, recovery, Workspace, type,
  architecture, browser, visual, golden, build, complete functional and diff
  gates pass.

## Implementation sequence

1. Add pure occurrence/capacity/removal/replacement planning tests.
2. Extend the Economy price-history persistence owner for direct durable or
   session-only complete-state commits and exact Undo reuse.
3. Add PriceSet acceptance overflow outcomes without changing its primary
   success semantics.
4. Add the management view model, lifecycle surface and review focus flow.
5. Reconcile combined Economy/Loot selections and add failure/collision browser
   evidence.
6. Add bounded responsive visuals, run complete release gates and promote only
   implemented facts into living architecture/evidence docs.

## Open questions

None block implementation. Configurable retention, pinning, rename/reorder,
item-level deletion, legacy full-history migration, a standalone history file
or server/account history would require separate product and storage decisions
and remain outside this goal.

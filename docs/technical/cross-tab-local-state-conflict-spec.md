# Cross-tab local-state conflict safety specification

- Status: implemented 2026-07-21; focused controller and two-page Chromium evidence recorded
- Date: 2026-07-21
- Priority: critical
- Estimated effort: L
- Owner: browser persistence boundary, local-state recovery and ready-shell feedback
- Feature-inventory parents: all browser-local `Valmis` workflows
- Depends on: `BrowserStorageAccess`, the local-state health registry, the
  local-state batch transaction and the current global attention/Undo surfaces

## Purpose

Prevent one open simulator tab from silently overwriting newer browser-local
state written by another tab.

The product intentionally has no account, database or server-managed workspace.
Browser-local state is therefore the durable owner for setups, Planner inputs,
Loot choices, saved comparisons and local price data. The current application
protects some explicit Undo transactions from a changed postimage, but ordinary
autosave effects do not observe external tab writes before saving their complete
envelopes.

This specification adds conflict detection, write suspension and explicit
review. It does not add real-time synchronization, automatic merge, a storage
lock or cross-device behavior.

## Verified current behavior and problem

- `src/app/App.tsx` loads the rewrite-owned browser-local values once during
  application construction and then keeps canonical live owners in React state.
- Ready-state effects persist rewrite setup, Loot preferences, Loot settings,
  hidden gear tiers, saved Duel setups, local price history and Planner UI
  state independently.
- Selected PriceSet, manual price, Workspace, saved-setup and destructive
  Economy operations use focused transaction/controller paths instead of the
  ordinary effects.
- `src/app/state/local-state-health.ts` has the exhaustive allowlist, labels,
  versions and validated loaders for every known rewrite-owned storage area.
- `src/app/controllers/local-state-batch.ts` can write exact target values and
  reverse-roll back handled multi-key operations.
- Saved-setup and Economy Undo paths already preserve a newer raw postimage
  instead of overwriting it. Those guards run only when the user invokes those
  specific transactions.
- The production app has no `storage` event listener, `BroadcastChannel` or
  equivalent cross-tab freshness owner.

Consequently, two tabs may hold different canonical values for the same area.
The next ordinary effect in an older tab can serialize its complete stale value
over the newer persisted envelope without a visible warning. A later reload may
then restore whichever tab wrote last rather than the value the user expected.

## Feature-inventory check

Basic combat setup, Planner, Loot/economy summary, Setup comparison, Market
price sync, Hiscores and Workspace backup/restore remain `Valmis`. This goal
does not add a missing product capability or reopen their schemas. It adds a
quality and data-loss guard around the persistence those workflows already use.

The feature statuses remain `Valmis` before and after implementation. This
specification must be listed as a specced finishing pass so later audits do not
mistake it for an unplanned sync feature.

## User promise

When saved browser data changes outside the current tab:

1. the current tab does not silently overwrite that change;
2. automatic saving pauses only for the affected areas;
3. one visible notice identifies the affected user-facing areas;
4. the user can review the conflict before choosing either saved data or the
   current tab's value; and
5. no resolution destroys either side before the user has an opportunity to
   download the current Workspace backup.

The product must not describe this as sync. The fixed consequence copy is:

> Saved data changed in another tab. Automatic saving is paused for the
> affected areas until you review the conflict.

## Goals

- Detect external writes and clears for every in-scope rewrite-owned key.
- Recheck the exact expected raw value immediately before an ordinary save so
  a missed or delayed browser event cannot authorize a known-stale write.
- Suspend only the affected persistence areas while leaving calculations and
  unrelated areas usable.
- Show one non-dismissible ready-shell notice with a bounded affected-area
  summary and a `Review conflicts` action.
- Provide a zero-mutation review with safe `Use saved data` and `Keep this
tab's data` resolutions.
- Reuse Workspace export as the pre-resolution rescue path.
- Preserve exact external raw values for rollback when `Keep this tab's data`
  is applied durably.
- Make safe-session and unavailable-storage behavior explicit and isolated.
- Add deterministic two-page Chromium coverage and focused pure/controller
  tests.

## Non-goals

- Do not add accounts, cloud storage, database state, server coordination,
  background sync or cross-device availability.
- Do not add `BroadcastChannel` as a second source of truth. A later
  implementation may use it only as an optional wake-up hint; `localStorage`
  bytes and validated state remain authoritative.
- Do not continuously mirror live edits between tabs.
- Do not automatically merge setup fields, collections, histories or prices.
- Do not claim atomic compare-and-swap or cross-tab locking; browser storage
  exposes neither contract.
- Do not overwrite an unsupported, invalid or unreadable external value.
- Do not change any storage key, envelope version, transfer schema, calculation,
  generated data, PriceSet authority or Workspace file format.
- Do not persist conflict notices, tab identifiers, resolution history or Undo
  records.
- Do not include the legacy-migration dismissed key in conflict resolution.
- Do not expose raw payloads, storage keys, URLs from another tab or browser
  exception text in the UI.

## In-scope area registry

Build this goal from one explicit registry keyed by the existing
`LocalStateHealthItemId` vocabulary. The registry extends or composes the
health/Workspace metadata; it must not scan arbitrary `index-sim:*` keys.

| Area                       | External change monitored | Ordinary save suspended | Resolution behavior                                     |
| -------------------------- | ------------------------- | ----------------------- | ------------------------------------------------------- |
| Rewrite setup              | yes                       | yes                     | replace complete six-family setup after review          |
| Planner UI                 | yes                       | yes                     | replace complete Planner draft state after review       |
| Loot preferences           | yes                       | yes                     | replace complete preference map after review            |
| Loot settings              | yes                       | yes                     | replace complete settings map after review              |
| Hidden gear tiers          | yes                       | yes                     | replace complete tier state after review                |
| Saved Duel setups          | yes                       | yes                     | replace complete collection; do not invoke Merge        |
| Local price history        | yes                       | yes                     | replace complete local history                          |
| Selected PriceSet          | yes                       | transaction-scoped      | replace selected override or absence                    |
| Manual price overrides     | yes                       | transaction-scoped      | replace complete manual overlay                         |
| Last Hiscores player       | yes                       | transaction-scoped      | replace normalized convenience value                    |
| Legacy migration dismissed | no                        | no                      | retain current browser workflow state outside this goal |

`transaction-scoped` means the current focused owner already performs direct
storage work. It must consult the conflict owner before a write, but it does not
gain a new React autosave effect.

The registry must have an exhaustive test against the current health descriptor
set. A future area cannot silently default to monitored, ignored or mergeable.

## Baseline and event contract

### Per-area baseline

After runtime bootstrap and compatibility blocking, capture for every in-scope
area:

- the exact raw string or `null` that the selected `BrowserStorageAccess`
  observed;
- a monotonically increasing tab-local baseline revision; and
- whether the area is healthy, blocked, unavailable or intentionally
  session-only.

Raw baselines stay in controller memory. They must never enter React
presentation models, logs, diagnostics, Workspace exports or persisted state.

A successful verified local write advances the area's expected raw baseline to
the exact postimage. A handled clear advances it to `null`. A failed or
unverified write does not advance the baseline.

### Browser `storage` event

Install one browser adapter listener only when the selected storage is the real
browser `localStorage` and persistence is available. Ignore events when:

- `event.storageArea` is not the selected browser storage;
- the key is outside the explicit registry;
- the key is the excluded legacy dismissal key; or
- the app is running in tab-scoped safe-session memory storage.

For an in-scope event, compare `event.oldValue` and `event.newValue` with the
controller's exact expected raw baseline:

- if `newValue` equals the expected baseline, no conflict exists;
- if the event represents the controller's already-verified local postimage,
  treat it as a no-op defensive duplicate;
- otherwise capture only the external raw preimage/postimage in controller
  memory, mark the area conflicted and suspend its writes.

The event may be coalesced with a later event for the same area. Review always
uses the latest observed external postimage and retains the first conflicting
baseline for explanation/rollback. Presentation exposes neither raw value.

### Pre-write freshness check

Every ordinary or focused durable write in scope must perform a synchronous
read immediately before mutation:

1. read the current raw value;
2. compare it with the area's expected raw baseline;
3. if equal, proceed with the existing write/verify behavior;
4. if different, do not write, capture a conflict and return a typed
   `external-conflict` outcome; and
5. route storage read failure through the existing persistence-unavailable and
   recovery policy rather than classifying it as a conflict.

This check is protection against a missed event, not a claim of atomic locking.
If another tab writes after the check, its subsequent event still suspends later
writes and exposes the conflict.

## Conflict state model

An equivalent DOM-free controller contract is:

```ts
type CrossTabConflictStatus = "clear" | "conflicted" | "resolving";

interface CrossTabAreaConflict {
  id: LocalStateHealthItemId;
  label: string;
  firstDetectedRevision: number;
  latestDetectedRevision: number;
  externalStatus: "valid" | "missing" | "unsupported" | "invalid";
}

interface CrossTabConflictSnapshot {
  status: CrossTabConflictStatus;
  conflicts: readonly CrossTabAreaConflict[];
  notice: CrossTabConflictNotice | null;
}
```

Exact names may vary. Required invariants are:

- conflicts are keyed and ordered by the existing registry order;
- repeated events for one area update one row rather than append notices;
- an unrelated successful save cannot clear a conflict;
- the controller never parses arbitrary storage keys;
- only validated canonical external values may become `Use saved data`
  candidates;
- unsupported, invalid or unreadable external values are visible as
  unavailable and cannot be adopted or overwritten; and
- all raw strings remain private controller data.

## Autosave suspension contract

- Suspension is per area, never a global stop for all browser state.
- A conflicted rewrite setup does not stop Loot, price or Hiscores persistence.
- A conflicted selected PriceSet does not stop setup edits or calculations.
- Live calculation continues from the current tab's canonical state.
- The compact setup autosave status specified in
  `setup-mode-autosave-clarity-spec.md` must present `Session only` or a more
  specific structured `Conflict` state while rewrite-setup saving is suspended;
  it must not show `Saved locally` for an unsaved newer setup.
- The existing local-state attention banner remains the single always-visible
  shell owner. It gains a conflict classification/action or composes one
  adjacent conflict notice; two visually competing persistence banners are not
  acceptable.
- A pending global Undo is not replaced merely because a conflict was detected.

## Review and resolution workflow

### Review presentation

`Review conflicts` activates Settings and focuses a `Data changed in another
tab` heading. The review lists for each conflict:

- allowlisted area label;
- `Changed`, `Cleared`, `Unsupported` or `Invalid` external state;
- whether current-tab changes are still active in memory;
- that automatic saving is paused; and
- available resolution actions.

The review never renders field-level diffs or raw JSON. It links to the existing
`Download Workspace backup` action with copy explaining that the backup captures
the current tab's live values before resolution.

### Use saved data

`Use saved data` is available only when every selected external value is valid
or intentionally missing under its existing state owner.

The safest V1 action is whole-application reload after an explicit review:

- re-read the current storage postimages immediately before reload;
- if any selected postimage changed again, keep the review open and require
  Refresh;
- do not mutate storage;
- clear no pending data before navigation; and
- use fixed copy stating that current unsaved session values will be replaced
  after reload.

Area-selective live adoption is outside V1 unless it can reuse the complete
typed Workspace live-Apply boundary for every selected area without inventing
a second application-state mutation path.

### Keep this tab's data

`Keep this tab's data` is review-gated and available only for valid/missing
external values whose current-tab owner can serialize one complete canonical
replacement.

1. Refresh the exact external postimages and make the review stale if they
   changed.
2. Build closed-registry raw operations from the current tab's complete live
   values.
3. Write and verify all selected areas through `local-state-batch`.
4. Reverse-roll back to the exact refreshed external preimages if any selected
   write fails.
5. Publish live success only after the durable batch verifies.
6. Register one global Undo whose preimage is the external raw batch and whose
   postimage is the kept current-tab batch.
7. Undo restores external raw values only when the current raw postimages still
   match; newer values are preserved with truthful copy.
8. Advance baselines, clear only resolved conflicts and resume their saves.

If persistence is unavailable or rollback cannot be verified, do not offer a
session-only `Keep` action: the current tab already holds its session values and
cannot truthfully resolve durable browser storage.

### Unsupported or invalid external data

When the latest external value fails the existing validated loader:

- preserve it untouched;
- keep the area persistence-blocked;
- route detailed metadata-only recovery through Local state recovery;
- offer Workspace export for the current live session; and
- do not offer `Keep this tab's data` until the user explicitly clears or
  otherwise resolves the invalid saved value through the existing recovery
  workflow.

## Presentation and accessibility

- Use one visible, non-dismissible `warning`-tone shell notice while conflicts
  exist.
- Show at most three allowlisted labels plus `N more`; the complete list belongs
  in Settings.
- Do not use `role="alert"` for every external write. Announce only the first
  transition from clear to conflicted and material changes in affected count.
- `Review conflicts` is a native button and moves focus to the Settings review
  heading after the pane renders.
- The review heading is programmatically focusable with a visible focus style.
- Resolution confirmation names the selected area count and consequence.
- Desktop, compact landscape, tablet and mobile layouts must remain horizontally
  contained; the review table/list may own bounded internal overflow.
- Color, icons and status pills are supplementary; visible text carries the
  state and consequence.

## Ownership contract

- Add a DOM-free cross-tab controller under `src/app/controllers` for raw
  baselines, event classification, suspension, stale review and resolution
  records.
- Add a thin browser adapter/hook for the `storage` listener. The controller
  remains testable without `window`.
- The local-state/Workspace registry remains the closed source for ids, labels,
  codecs and current live-value serialization.
- `App.tsx` remains the owner of canonical live feature state, existing
  persistence effects, global status/Undo and application reload.
- `LocalStateRecoveryController` remains the owner of invalid, unsupported,
  blocked and persistence-failure health truth.
- `local-state-batch.ts` remains the exact multi-key write/rollback primitive.
- Pure shell and Settings components receive typed presentation/actions and do
  not read storage or parse raw values.

Do not infer conflict state by parsing rendered messages or comparing
`savedAt` timestamps. Exact raw values and typed controller state own freshness.

## Security and privacy constraints

- Never render, log, announce or attach raw preimages/postimages to DOM data
  attributes, errors or telemetry.
- Do not expose `StorageEvent.url`; it can contain a share fragment or other
  private navigation context.
- Do not disclose the Hiscores player value in the shell conflict summary.
- Keep unsupported raw payloads out of Workspace export and review models.
- Bound conflict records to the fixed registry size; repeated external writes
  cannot grow an unbounded queue.
- Remove the listener on unmount and do not install it for safe-session memory
  storage.

## Implementation sequence

1. Characterize current stale overwrite behavior with a two-storage-client
   controller test and an initially failing two-page browser case.
2. Add the exhaustive area registry extension and DOM-free baseline/conflict
   controller.
3. Add pre-write freshness outcomes to ordinary persistence and focused
   transaction call sites without changing schemas.
4. Suspend affected effects and compose conflict truth into setup/local-state
   presentation.
5. Add Settings review, Workspace rescue navigation and reload-based `Use saved
data`.
6. Add review-gated durable `Keep this tab's data`, exact rollback and guarded
   global Undo.
7. Complete responsive, accessibility, full browser and visual verification.

## Required tests

### Unit and controller coverage

Prove:

- external event classification for changed, cleared, duplicate and ignored
  keys;
- exact expected-baseline advancement after verified write/clear;
- missed-event detection in the pre-write freshness check;
- per-area suspension and unrelated-area independence;
- repeated events coalesce deterministically;
- unsupported/invalid external values remain raw-private and unselectable;
- safe-session and storage-unavailable modes install no browser listener;
- stale review refresh after a second external change;
- durable Keep success, every injected batch failure, reverse rollback and
  postimage-guarded Undo; and
- exhaustive registry classification.

### Component and browser coverage

Use two Playwright pages in one browser context to prove:

1. both tabs load the same setup baseline;
2. tab A saves a changed setup;
3. tab B receives one visible conflict notice and does not overwrite A when B
   edits another setup field;
4. unrelated Loot or Planner persistence can continue when only rewrite setup
   conflicts;
5. Review focuses the Settings heading and exposes no raw data;
6. Workspace export remains available before resolution;
7. `Use saved data` reloads to A's saved value after a fresh postimage check;
8. `Keep this tab's data` durably replaces A only after explicit confirmation
   and Undo can restore A's exact raw value;
9. a third write makes a prepared review stale; and
10. invalid external state routes to recovery without being overwritten.

Repeat focused coverage for at least one collection area and one Economy area,
not only rewrite setup. Exercise 1280x720, 640x360 and 390x844 containment for
the notice/review.

### Validation commands

Run at minimum:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/local-state-health.test.ts src/tests/local-state-recovery-controller.test.ts src/tests/workspace-restore-executor.test.ts
npm run test:e2e -- --workers=1 --grep "another tab|cross-tab conflict"
npm run build
npm run test:e2e:visual
git diff --check
```

Run the complete functional Chromium suite because persistence and the ready
shell cross every visible workflow. Visual baseline writes require the existing
explicit human review policy.

## Acceptance criteria

- A known-stale tab never performs an ordinary durable overwrite for a
  conflicted area.
- External changes are detected through both browser events and pre-write raw
  comparison.
- Only affected persistence areas pause; live calculation and unrelated saves
  continue.
- One visible notice and one Settings review explain the conflict without raw
  data disclosure.
- `Use saved data` mutates no storage and requires a fresh external postimage.
- `Keep this tab's data` is review-gated, batched, verified, rollback-safe and
  exposes one guarded Undo.
- Unsupported/invalid external values remain untouched and use existing Local
  state recovery.
- Safe-session isolation, storage schemas, Workspace files, calculations,
  feature status and backend scope remain unchanged.
- Focused, architecture, build, complete functional and reviewed visual checks
  pass.

## Documentation updates during implementation

- Mark the backlog card `Done` only after source and browser evidence land.
- Add the implemented ownership to `architecture.md` and the focused commands
  to `testing.md`/the UI-state browser topic guide.
- Add an implementation note to feature inventory without changing the parent
  feature statuses.
- Put dated counts and artifacts in project testing evidence, not this living
  specification.

## Open questions

None block implementation. V1 intentionally uses full reload for `Use saved
data`; area-selective live adoption and any true merge remain later explicit
product decisions.

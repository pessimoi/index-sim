# Workspace backup and restore specification

Status: implemented 2026-07-19. The bounded envelope/registry, safe
export/Review-before-restore, typed area planning and logical atomic
Apply/Undo/recovery slices are complete.

Priority: high.

Estimated effort: L.

## Purpose

The product intentionally keeps user-owned state in the browser and has no
account or general application database. That makes a user-controlled file the
appropriate durability and browser-transfer boundary.

Before this feature, the app could export a rewrite setup, a saved-setup
collection and a PriceSet only as separate files. Local-state health and
recovery covered all eleven known rewrite-owned browser states, but the health
export contained metadata only. Those workflows did not form one complete,
reviewable and restorable local workspace.

The implemented workflow adds one bounded, versioned Workspace backup file for
the user-owned local state. Import remains review-only until the user selects
areas, chooses the supported Replace or Merge behavior and explicitly applies
one atomic restore plan.

This is not account storage, database storage or a server synchronization
feature.

## Verified current state

`src/app/state/local-state-health.ts` has eleven allowlisted descriptors:

1. rewrite setup;
2. Planner UI state;
3. Loot preferences;
4. Loot settings;
5. hidden gear tiers;
6. saved Duel setups;
7. local price history;
8. selected PriceSet;
9. manual item-price overrides;
10. last Hiscores player; and
11. legacy-migration dismissed state.

The first nine are workspace data. The last Hiscores player is a potentially
identifying convenience value. Legacy-migration dismissal is browser-instance
workflow state rather than user-created simulator content.

The existing recovery export deliberately exposes only status, versions,
sanitized reasons and storage-key metadata. It does not export values and must
remain a distinct diagnostic file.

The application-level error recovery path may select a tab-scoped in-memory
`BrowserStorageAccess` before `App` starts. In that safe session, original
browser data is intentionally ignored and persistence is explicitly
non-durable. Workspace export/import must consume that selected storage and
`persistenceUnavailable` truth; it must never bypass the boundary to reach
`window.localStorage`.

The existing transfer safety boundaries already provide reusable behavior:

- rewrite setup files use bounded duplicate-key-safe parsing, Revision context,
  entity compatibility review, explicit Apply and complete Undo;
- saved Duel setup files use a strict cap, Revision context, add/update/skip
  preview and explicit Merge; and
- PriceSet import uses bounded validation, generated high-alch authority,
  selected-state persistence, manual overlay composition and sanitized errors.

The Workspace workflow composes those rules. It must not weaken or fork them.

## Feature-inventory classification

`Workspace backup and restore` is a `Valmis` product workflow. The existing
setup, saved-setup, PriceSet, local-state attention and local-state recovery
workflows remain separate `Valmis` owners and their individual transfer files
and metadata-only diagnostics remain available.

## Goals

- Export every non-sensitive user-owned local-state area in one validated file.
- Make the file independent of raw browser keys and persisted-envelope details.
- Record both a file format version and a version for every area.
- Carry the accepted game Revision and exact generated snapshot id.
- Show area content, source/target versions, Revision context, compatibility,
  effects and limits before any mutation.
- Let the user include or exclude individual restorable areas.
- Make Replace the explicit whole-workspace default and expose Merge only where
  a deterministic area-specific merge exists.
- Apply all selected areas as one logical transaction, rolling storage back to
  its exact prior bytes if any selected write fails.
- Offer one complete in-memory Undo after a successful durable or session-only
  restore.
- Offer an explicit session-only Apply when durable storage is unavailable or a
  failed storage transaction was rolled back successfully.
- Integrate successful replacement, failed persistence and health refresh with
  the existing local-state recovery controller.
- Keep the last Hiscores player out by default and include it only after one
  visible privacy choice.
- Make descriptor coverage testable so a future local-state area cannot be
  silently omitted from backup policy.

## Non-goals

- Do not add accounts, authentication, cloud saves, server uploads, sync,
  conflict resolution between devices or a general database.
- Do not create a second application safe-mode or bypass the existing
  `BrowserStorageAccess` boundary.
- Do not export simulation results, Worker tasks, Risk output, Duel matrix
  results, Planner results, notices, pending Undo, open panes, input drafts,
  selected DOM state or share-link fragments.
- Do not export legacy browser keys or archived legacy payloads.
- Do not include legacy-migration dismissal in any Workspace file.
- Do not include the Hiscores player without an explicit checked option for the
  current export.
- Do not copy raw `localStorage` strings, storage keys, `savedAt` wrappers or
  invalid/unsupported payloads into the backup.
- Do not silently migrate unsupported Workspace or area versions.
- Do not make Merge a field picker or introduce arbitrary JSON patch behavior.
- Do not append a PriceSet restore to local price history; price history is its
  own selected area.
- Do not change `SimulationRequest`, domain formulas, generated game data,
  PriceSet high-alch authority or existing individual transfer formats.

## Workspace area registry

Add one typed registry that classifies every
`LocalStateHealthItemId`. The registry may reuse exported schema/storage-option
factories or move descriptor metadata into a shared state-registry module, but
state modules remain the owners of their schemas, defaults, caps and
serialization rules.

The registry must not use a broad loop over arbitrary `index-sim:*` keys. Its
coverage is exhaustive and checked against `LOCAL_STATE_HEALTH_DESCRIPTORS`.

| Health id                    | Workspace policy | Required in file | Local version at specification time | Restore modes  | Revision/entity handling                                                                                  |
| ---------------------------- | ---------------- | ---------------: | ----------------------------------: | -------------- | --------------------------------------------------------------------------------------------------------- |
| `rewrite-setup`              | included         |              yes |                                   3 | Replace        | Existing complete setup compatibility check; incompatible area is not selectable.                         |
| `planner-ui`                 | included         |              yes |                                   1 | Replace        | Validate the complete Planner state and current allowed gear pool; do not silently clean imported ids.    |
| `loot-prefs`                 | included         |              yes |                                   1 | Replace, Merge | Validate current monster and loot-row ids before selection.                                               |
| `loot-settings`              | included         |              yes |                                   1 | Replace, Merge | Validate current monster ids before selection.                                                            |
| `hidden-gear-tiers`          | included         |              yes |                                   1 | Replace, Merge | Fixed typed tier ids; no generated-entity lookup.                                                         |
| `duel-snapshots`             | included         |              yes |                                   1 | Replace, Merge | Reuse saved-setup compatibility, id uniqueness and the 12-row cap preview.                                |
| `price-history`              | included         |              yes |                                   2 | Replace, Merge | Historical item ids remain historical data; preserve the existing validated cap.                          |
| `selected-price-set`         | included         |              yes |                                   2 | Replace        | `null` means no selected override; otherwise reuse PriceSet validation and generated high-alch authority. |
| `manual-price-overrides`     | included         |              yes |                                   1 | Replace, Merge | Preserve unavailable item ids as inactive, as the current state owner does.                               |
| `hiscores-last-player`       | sensitive opt-in |               no |                                   1 | Replace        | Include only after the visible export checkbox; validate and normalize the player name.                   |
| `legacy-migration-dismissed` | excluded         |               no |                                   1 | none           | Always retain the recipient browser's current dismissal state.                                            |

The local version is review metadata, not the Workspace area's transfer
version. A local schema version change does not automatically authorize an old
or new Workspace area version.

## File envelope

Use a dedicated strict envelope, independent of every current individual file
format:

```ts
const WORKSPACE_BACKUP_KIND = "index-sim-workspace";
const WORKSPACE_BACKUP_VERSION = 1;
const WORKSPACE_BACKUP_IMPORT_MAX_BYTES = 10_000_000;

interface WorkspaceBackupEnvelopeV1 {
  kind: typeof WORKSPACE_BACKUP_KIND;
  version: typeof WORKSPACE_BACKUP_VERSION;
  exportedAt: string;
  context: SetupTransferContextV1;
  areas: WorkspaceAreaRecord[];
}

interface WorkspaceAreaRecord {
  id: WorkspaceTransferAreaId;
  version: number;
  data: unknown;
}
```

Each current area starts with transfer version 1. The parser first validates the
bounded outer structure and unique area ids, then delegates `data` to the exact
id/version codec. It never chooses a schema from untrusted input other than
through that closed registry.

Envelope V1 requires exactly one record for each of the nine included
workspace areas and allows at most one `hiscores-last-player` record. Missing,
duplicate or unknown ids reject the file. An unsupported version for a known
area remains visible as an unselectable review row only if the outer V1
structure is otherwise valid; its raw content is never rendered. A malformed
current area version rejects that area and makes it unselectable. No rejected
area can enter a restore plan.

`selected-price-set` uses `data: null` when the exported workspace has no local
selected PriceSet override. The other required areas carry their validated
canonical value, including an empty collection where that is the current
logical state. An export captures validated live state, so a usable session-only
value can still be rescued even when its preceding browser save failed.

The envelope and every area object are strict. Parsing must use the existing
duplicate-key-safe JSON boundary and count UTF-8 bytes before `JSON.parse`-like
materialization. Export must validate the final object and its serialized byte
size before download.

Use the filename:

```text
index-sim-workspace-<Revision>-<UTC timestamp>.json
```

Sanitize the Revision/timestamp segment through the existing browser-download
filename conventions.

## Export workflow

Place `Workspace backup` in Settings beside, but visibly separate from, `Local
state recovery`. The diagnostic health export keeps its current name and
metadata-only explanation.

The export surface shows:

- that the file contains setup, Planner, Loot, saved setups and local price
  state;
- the current Revision and snapshot id;
- the number of included areas;
- `Include last Hiscores player name`, unchecked by default; and
- privacy copy stating that a checked player name may identify the user's game
  character to anyone who receives the file.

One `Download Workspace backup` action captures one coherent live-state
snapshot, constructs all area records at the same `exportedAt`, validates and
downloads it. It does not read arbitrary raw keys. A validation or size failure
creates sanitized visible copy and no partial download.

The Hiscores choice is not persisted. Every new page session and every new
export surface starts unchecked.

## Import and review-before-restore

Import uses one file input with `accept="application/json,.json"`. Reading uses
the existing bounded browser file adapter and latest-request-wins sequencing.
A later file selection invalidates any earlier in-flight read. Reset the input
after every attempt so the same file can be selected again.

A successful parse creates one in-memory review candidate. It performs no
storage write, clear, recovery unblock, React setter, PriceSet acceptance or
Hiscores mutation.

The review shows, before Apply:

- file export time, format version and byte size;
- source Revision/snapshot and current Revision/snapshot;
- the existing exact-snapshot, same-revision or different-revision explanation;
- one row per area with human label, transfer version, target local version,
  item/record count, current count, compatibility and selected mode;
- selected PriceSet source/label/item count without dumping raw price maps;
- exact add/update/skip or replace counts where they can be calculated;
- excluded/unsupported/incompatible rows and their sanitized reason; and
- the number of selected areas that Apply will change or clear.

The source Hiscores player row appears only when the file contains it. It starts
unselected even though the exporter opted to include it; restore requires a
second visible privacy choice on the recipient.

All compatible non-sensitive areas start selected with Replace. This makes the
default an exact restore of the chosen Workspace file. The user may deselect
any area and may opt into Merge only for rows whose registry policy supports
it. `Apply selected areas` is disabled when no valid area is selected or any
selected plan is invalid.

`Dismiss` clears the candidate and returns focus to the import control. It does
not modify current or persisted state.

## Revision and compatibility policy

The top-level context reuses `SetupTransferContextV1` and
`compareSetupTransferContext()`. Revision mismatch is a warning, not blanket
permission to accept incompatible ids.

Before a row can be selected:

- rewrite setup and Duel snapshots reuse their current complete entity checks;
- Planner validates every imported pool id against the current allowed pool;
- Loot preferences validate monster ids and current loot-row ids;
- Loot settings validate monster ids;
- hidden tiers use their fixed schema;
- selected PriceSet uses the current PriceSet import normalization, including
  generated high-alch authority;
- price history retains its validated historical identities; and
- manual prices retain valid but currently unavailable ids as inactive values.

Do not silently drop an incompatible setup, Planner or Loot entry. Mark its
whole area unselectable and show at most five sanitized issue labels plus a
remaining count. The user can still restore unrelated compatible areas.

The recipient's current generated game data and scheduled/bundled fallback
remain runtime truth. A backup never installs a game-data snapshot.

## Replace and Merge semantics

Replace means the selected area's target value becomes exactly the validated
backup value after current-runtime normalization. If that value is empty or
`null`, use the area's normal clear/default behavior rather than preserving old
recipient rows.

Merge is opt-in and area-specific:

- Loot preferences merge by monster id and loot-row id; backup values win the
  same row and unrelated current rows remain.
- Loot settings merge by monster id; the complete backup settings record wins
  the same monster and unrelated current monsters remain.
- Hidden gear tiers merge as a union of hidden tiers. Merge never unhides a
  currently hidden tier; Replace is required to reproduce unhidden state.
- Duel snapshots reuse `mergeDuelSnapshots()`: matching ids update, new ids add
  in file order until 12 and overflow rows are skipped. Review shows all three
  counts before Apply.
- Price history deduplicates by `priceHistorySnapshotKey()`, the backup snapshot
  wins the same key, rows sort newest first and the current local cap is
  applied. Review shows retained, replaced and cap-dropped counts.
- Manual prices merge by item id; the backup value wins the same item. If the
  combined result would exceed the current 512-item cap, Merge is invalid and
  review directs the user to Replace or deselect the area. Do not silently drop
  manual prices.

Rewrite setup, Planner, selected PriceSet and Hiscores player do not expose
Merge. There is no generic fallback merge.

## Restore planning and atomic Apply

The browser `localStorage` API has no multi-key transaction. Provide logical
atomicity with a preflighted write batch and exact rollback:

1. Revalidate the candidate id, selected rows, modes and current game context.
2. Capture the complete current live values for every selected area.
3. Read and capture the exact prior raw string or missing state for every
   selected target key.
4. Calculate all Replace/Merge results without mutation.
5. Validate every calculated result and serialize every next persisted value in
   memory, including native clear behavior for empty values.
6. Calculate the next base PriceSet and manual overlay together. Restoring a
   selected PriceSet never records a new history snapshot.
7. Write/remove the selected keys in one deterministic batch.
8. If any write/remove fails, restore every touched key to its exact captured
   raw state in reverse order. Do not apply live state.
9. After every durable write succeeds, suppress the selected areas' next normal
   persistence effect and apply one prevalidated live-state outcome in a React
   batch.
10. Unblock valid replaced areas, clear their recorded persistence failures,
    refresh health once and register one complete Undo.

The deterministic write order is an implementation detail owned by the
workspace controller and covered by tests. It must not depend on file area
order.

Unexpected live-application failure after a durable write triggers the same
storage rollback and restores the captured live snapshot. It produces a fixed
fatal/recovery message without raw exception or file content.

This contract protects normal write/clear failures inside one active browser
execution. It does not claim crash-atomic durability across browser or device
termination because `localStorage` provides no such primitive. Adding a
journal, IndexedDB or another storage backend is outside V1 and requires a
separate decision.

## Storage failure and session-only Apply

If storage is unavailable before Apply, or a failed batch rolls back all
touched keys successfully, retain the reviewed candidate and offer a separate
`Apply for this session` action. Do not fall through to it automatically.

When the app already runs with saved data ignored for the tab, durable Apply is
unavailable from the start. Export still captures the validated in-memory
workspace, import/review still works and session-only Apply may write only to
the selected memory storage. It must not inspect or restore the ignored
`window.localStorage` values.

Session-only Apply:

- revalidates and calculates the same selected plan;
- changes all selected live areas together;
- suppresses the resulting normal persistence effects once;
- leaves browser storage unchanged;
- marks the result clearly as lost on reload; and
- registers one session-only Undo over the complete prior live state.

If exact rollback itself fails, persistent state is uncertain. Do not offer
session-only Apply from that attempt. Mark every affected id for local-state
attention, refresh the recovery report and instruct the user to review recovery
before retrying. Never report a partial restore as success.

## Undo

Use the existing single `PendingUndoStatus` model. A later undoable action may
replace the Workspace Undo, and reload/tab close discards it.

For a durable restore, Undo uses the same atomic batch mechanism to restore the
exact captured raw values, then restores the captured live snapshot and
recomputes active prices. If Undo persistence fails and its rollback succeeds,
the post-restore durable state remains intact and a separate session-only Undo
may restore only the live snapshot with truthful copy.

For a session-only restore, Undo restores the prior live snapshot and does not
touch storage.

Undo covers every area selected in the original Apply, including a selected
Hiscores player. It does not modify unselected areas or the legacy-migration
dismissal state.

## Recovery integration

Extend the local-state recovery controller with bounded batch transitions
rather than having the Workspace controller mutate its internal arrays.
Equivalent operations may be:

```ts
prepareExternalApply(ids: readonly LocalStateHealthItemId[]): void;
completeExternalApply(ids: readonly LocalStateHealthItemId[]): void;
recordExternalApplyFailure(
  ids: readonly LocalStateHealthItemId[],
  reason: "save_failed" | "clear_failed"
): void;
```

The integration must preserve these rules:

- valid durable replacement unblocks only selected ids;
- unselected invalid/version-mismatched areas remain blocked;
- one-shot persistence suppression prevents React effects from rewriting the
  just-restored batch or turning a session-only restore into partial storage;
- failures remain visible through the global local-state attention surface;
- health refresh occurs once after the completed transition, not after every
  area write; and
- the metadata-only recovery export stays unchanged and never gains Workspace
  values.

## Controller and ownership boundary

Add a DOM-free Workspace controller core and a thin React hook. Exact names may
vary, but the boundary must separate preparation from acceptance:

```ts
interface WorkspaceRestoreReview {
  id: number;
  file: WorkspaceBackupSummary;
  context: SetupTransferContextReview;
  areas: readonly WorkspaceAreaReview[];
}

interface WorkspaceRestoreSelection {
  reviewId: number;
  areas: ReadonlyArray<{
    id: WorkspaceRestorableAreaId;
    mode: "replace" | "merge";
  }>;
}

type WorkspaceDurableApplyOutcome =
  | { status: "applied"; liveState: WorkspaceLiveState; undo: WorkspaceUndo }
  | { status: "session-only-available"; reason: "unavailable" | "write-failed" }
  | { status: "failed"; reason: "rollback-failed" | "stale-review" };
```

The file-transfer core owns bounded parsing, area codecs, review state,
latest-request sequencing and plan construction. The lazily loaded executor
owns preflight serialization, deterministic storage batching, rollback and its
single complete Undo record. They receive file reading, time, download, the
selected `KeyValueStorage`, `persistenceUnavailable` and typed React
application through injected dependencies so Node tests require no DOM.

`App` owns one coherent current live-state capture and applies only a typed
prevalidated outcome. Existing setup, Planner, Loot, Duel, PriceSet, price
history, manual-price and Hiscores state modules remain canonical. The
Workspace controller calls or extracts their pure normalization/merge helpers;
it does not duplicate their schemas.

## Presentation and accessibility

- Keep export/import under one `Workspace backup and restore` Settings section.
- Use an inline review region or dialog with an accessible name, not native
  `confirm()`.
- Give every area checkbox an associated label and every supported mode a
  keyboard-operable control.
- Move focus to the review heading after a successful parse.
- On Dismiss, return focus to the file input.
- On Apply failure, focus the fixed error summary; link recovery failures to the
  existing Local state recovery heading.
- Announce successful durable restore, session-only restore and Undo through the
  existing status/live-region pattern.
- Never render raw JSON, storage keys, schema paths, player name in generic
  status copy or unsanitized exception details.

## Tests and acceptance

Focused unit coverage must prove:

- exhaustive classification of all eleven health descriptors into required,
  sensitive-opt-in or excluded policy;
- default export contains exactly nine areas, optional export contains the
  normalized Hiscores player and neither contains migration dismissal;
- the export captures one timestamp/context and validates its serialized size;
- strict envelope, duplicate-key, duplicate-area, missing-area, unknown-id,
  malformed-area, unsupported-version and oversized-file behavior;
- no mutation authority during read, parse, review, selection or Dismiss;
- exact/same/different Revision review and area-specific entity compatibility;
- every Replace and Merge rule, including Duel/history counts and manual-price
  cap rejection;
- selected PriceSet generated-alch authority and no implicit history append;
- nth-write and nth-clear failures restore exact prior raw bytes and do not
  mutate live state;
- rollback failure marks all affected areas and never reports success;
- durable Apply suppresses one normal persist cycle, unblocks only selected
  valid ids and refreshes health once;
- explicit session-only Apply changes all selected live areas and no storage;
- durable and session-only Undo restore their complete respective boundaries;
- stale review ids and late file reads cannot apply; and
- sanitized fixed copy never exposes raw payloads or errors.

Production-preview Chromium coverage must prove at least:

1. default export omits the player name and re-import shows all nine area rows;
2. a multi-area Replace changes setup, Planner, Loot, saved setups and local
   prices together, then one Undo restores all of them;
3. a mixed Merge preview shows Duel/history counts and preserves unrelated
   current rows;
4. different-Revision/incompatible rows are warned and cannot be selected; and
5. forced storage failure changes nothing until explicit session-only Apply,
   whose result and Undo do not alter persisted values.

Required implementation validation:

```sh
npm run test -- src/tests/workspace-backup.test.ts src/tests/workspace-backup-controller.test.ts src/tests/local-state-health.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "Workspace backup|workspace restore"
npm run verify
git diff --check
```

## Implementation slices

1. **Implemented 2026-07-19 — Bounded envelope and registry**: exhaustive
   policy, area codecs, Revision stamp and export builder/parser.
2. **Implemented 2026-07-19 — Safe export and Review-before-restore**:
   DOM-free controller plus browser hook, coherent live-state capture, Settings
   surface, session-only Hiscores privacy choice, bounded latest-request import,
   raw-free area compatibility summaries, zero-mutation review, input reset and
   focus-correct Dismiss.
3. **Implemented 2026-07-19 — Area restore planning**: mutable accessible area
   selection and mode controls, all ten Replace outcomes, the six closed Merge
   policies, fresh Revision/entity validation, exact effect/cap previews and one
   typed selected-area plus PriceSet-composition outcome. Plan construction has
   no storage, recovery or live-state mutation authority.
4. **Implemented 2026-07-19 — Atomic Apply/Undo and recovery**: exhaustive
   registry-order preflight and serialization, exact raw/missing preimages,
   deterministic write/remove plus reverse rollback, one typed live outcome,
   bounded recovery transitions, explicit session-only Apply and complete
   durable/session-only Undo.

The implemented controller revalidates the exact candidate and current context
immediately before Apply and consumes a successful candidate, so stale and
double Apply have no authority. `WorkspaceRestoreExecutorCore` serializes every
selected value before the first write, uses the closed target registry rather
than file order and applies live state only after durable success. App composes
the selected PriceSet and manual overlay together, does not append history,
restores Hiscores only after recipient selection and suppresses each selected
normal persistence effect once. Recovery completion is selected-only; safe
exact rollback exposes the explicit session action without blocking unrelated
persistence, while rollback failure blocks every affected id and offers no
session-only success.

Implementation evidence is owned by `src/app/state/workspace-backup.ts`,
`src/app/controllers/workspace-file-transfer*.ts`,
`src/app/controllers/workspace-restore-plan.ts`,
`src/app/controllers/workspace-restore-executor.ts`,
`src/app/controllers/local-state-recovery.ts`, `src/app/App.tsx` and the pure
Settings presenters. Dated unit, Chromium, visual and release-gate evidence is
recorded in [the testing evidence log](../project/testing-evidence.md). The
evidence ceiling is local runtime/synthetic tests: V1 provides logical
rollback atomicity for handled browser operations, not crash-atomic storage,
account backup, deployment proof or cross-device synchronization.

## Done criteria

- A current app export can recreate all nine user-owned local-state areas in a
  clean browser without using the individual setup, Duel or PriceSet files.
- Nothing changes before explicit Apply.
- Every selected area has visible content/version/context/effect review.
- Replace and Merge outcomes exactly match the area table and previews.
- No tested storage failure leaves a reported partial restore.
- Hiscores remains excluded by default and migration dismissal is never
  transferred.
- Existing individual exports and metadata-only health recovery remain intact.
- Focused, browser and full repository gates pass and dated evidence is added to
  `docs/project/testing-evidence.md` during implementation.

## Open questions

None for V1. The specification decides the identity/dismissal boundary:
Hiscores is a two-sided explicit opt-in and legacy-migration dismissal is always
recipient-local. Crash-atomic persistence, account sync and a different storage
backend require separate future decisions.

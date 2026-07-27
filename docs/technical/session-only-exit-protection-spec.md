# Session-only exit protection and direct backup specification

- Status: implemented
- Date: 2026-07-21
- Owner: ready-shell durability guard and existing Workspace export controller
- Evidence: verified
- Contract: living

- Priority: high
- Estimated effort: M
- Feature-inventory parents: Application failure recovery, Local state
  recovery and Workspace backup/restore (`Valmis`)
- Depends on: safe-session storage isolation, local-state durability outcomes,
  Workspace live-state registry and truthful browser export outcomes
- Executable goal:
  [PF-04 · Protect session-only work before exit](../project/goals/pf-04-session-only-exit-protection.md)

## Purpose

Protect meaningful work that exists only in the current tab. When persistence
is unavailable, saved data is intentionally ignored or an accepted mutation
has only a session-local outcome, the app must warn before a dirty tab closes or
reloads and provide a direct path to the existing Workspace backup.

The original saved browser data remains untouched in safe mode. This work does
not attempt to repair persistence or silently copy session state into it.

## Verified current behavior and problem

The implemented application recovery flow can reload into a tab-scoped safe
session backed by fresh memory storage. It correctly:

- ignores saved browser data before any persisted loader runs;
- directs later writes and clears to memory;
- leaves original local storage unchanged; and
- shows a `Session-only safe mode` notice.

The local-state and transaction owners also expose session-only outcomes when a
safe durable write cannot be completed.

The ready shell now has one production `beforeunload` owner. Meaningful
session-only Workspace-area changes compose the safe/persistence notice into an
`Unsaved session-only changes` surface with a direct Workspace backup action.
Mode alone remains informational and does not arm the listener.

Application recovery, Workspace backup, cross-tab conflict resolution and file
export outcomes are otherwise implemented. The gap is the dirty-session bridge
between them.

## Feature-inventory boundary

All parent rows remain `Valmis`. This is a resilience and recovery finishing
pass, not a new persistence system.

The specification does not supersede:

- safe-session isolation or fatal-error behavior in
  `application-error-boundary-spec.md`;
- local-state health/repair policy;
- cross-tab conflict detection and stale-write protection;
- Workspace envelope, area policies, privacy opt-in, import or Undo; or
- truthful `download started`/failed semantics.

## User promise

If the current tab contains user-owned changes that are not durably saved:

- one persistent ready-shell notice says the work is session-only;
- the notice explains that closing or reloading can lose it;
- `Download Workspace backup` invokes the current live Workspace export;
- a browser-native leave warning is armed while unacknowledged changes remain;
  and
- a successful backup request acknowledges exactly the state included in that
  request. Any later change re-arms protection.

No warning appears merely because safe mode or storage fallback is active. The
user must have changed applicable state after the relevant durability baseline.

## Durability and dirty-state contract

### Reasons

Use a closed internal reason set equivalent to:

```ts
type NonDurableReason = "saved-data-ignored" | "storage-unavailable" | "session-only-write";
```

Do not treat these as session-only exit-protection reasons:

- a healthy durable save in progress;
- an invalid stored key that has not caused a live edit;
- an external-tab conflict, which retains its dedicated blocking/review owner;
- a failed calculation with no state mutation;
- pane selection, disclosure state or other deliberately transient UI state;
  or
- a normal tab with no changed user-owned values.

### Included state

Dirty detection uses the same closed user-owned area registry as Workspace:

- active/default/custom combat setup;
- Planner UI state;
- Loot preferences;
- Loot settings;
- saved Duel setup collection;
- selected PriceSet;
- manual item prices;
- local price history;
- hidden gear-tier preferences; and
- last Hiscores player where current Workspace policy classifies it as the
  sensitive opt-in area.

Use the actual current registry ids rather than maintaining a second handwritten
list. The existing registry's exhaustive policy test must fail when a new area
is added without a guard classification.

Ephemeral result output, pending calculation state, global Undo closures,
active pane, open disclosures and imported review candidates are excluded.

### Baselines

Maintain only in-memory canonical comparisons:

- **durable baseline**: the last known durable semantic value for each included
  area;
- **current value**: the current normalized live value; and
- **backup acknowledgement**: the exact current area values covered by the most
  recent successfully dispatched Workspace backup request.

For a global safe-session or storage-unavailable startup, establish the durable
baseline after runtime defaults and all loaders have settled. The mode alone is
not dirty.

For an ordinary durable session whose mutation returns a session-only outcome,
retain the pre-mutation durable baseline and publish the new current value as
non-durable. Later session-only changes advance current state only.

A verified durable save updates that area's durable baseline and clears its
non-durable reason. A no-op does not change any baseline or dirty status.

Canonical comparison excludes export timestamps, object insertion order and
derived presentation. It uses the Workspace area's validated semantic value.
Raw persisted preimages and exact user values never appear in the guard's DOM,
logs or telemetry.

### Derived guard state

An area is `dirty-session-only` when:

1. it has an active non-durable reason; and
2. its current canonical value differs from its durable baseline; and
3. the exact current value has not been acknowledged by an included successful
   Workspace backup request.

The global guard is armed when one or more areas are dirty-session-only.

If the user returns an area exactly to its durable baseline, that area clears.
If all areas clear, remove the warning and listener.

## Ready-shell notice

When armed, show one non-dismissible normal-flow/sticky ready-shell status near
the existing local-state/safe-session attention surfaces:

```text
Unsaved session-only changes
Changes in this tab are not stored durably and can be lost when you reload or
close it.
[Download Workspace backup]
```

Also show:

- a fixed reason summary, such as `Saved browser data is ignored in this tab`
  or `Browser storage is unavailable`;
- the count of affected Workspace areas, not their raw values; and
- the latest backup outcome from the existing typed export contract.

Do not show a separate competing `Session-only safe mode` live region. Extend
or compose the existing safe-session notice so one visible owner explains both
the mode and dirty status. Before the first edit it may retain the current
informational safe-mode copy without a leave warning.

The backup button calls the existing Workspace export with one coherent live
capture and the current session-only Hiscores privacy toggle. It must not write
browser storage or navigate away.

## Backup acknowledgement

The browser export owner can prove only that a download request was dispatched.
Copy must therefore say:

`Workspace backup download started for the current changes. Check your browser downloads; saving the file cannot be verified.`

On a successful dispatch:

- receive the exact included Workspace area ids from the export result;
- acknowledge only dirty areas present in that envelope;
- suppress the leave warning if every dirty area was included; and
- keep the non-durable mode notice visible because the tab is still
  session-only.

If the sensitive Hiscores player area is dirty but its opt-in is off, the
backup does not acknowledge that area. Keep protection armed and state:
`The last Hiscores player was not included. Review the privacy option in Settings.`

A failed export acknowledges nothing and keeps protection armed. A later live
change to any acknowledged area invalidates its acknowledgement and immediately
re-arms the warning.

No acknowledgement is persisted. Reloading starts a new baseline from whatever
state that storage mode can load.

## Browser leave-warning contract

Install `beforeunload` only while the global guard is armed:

```ts
event.preventDefault();
event.returnValue = "";
```

Modern browsers choose the visible confirmation text. Do not claim that custom
copy will appear.

Requirements:

- add one stable listener and remove that exact listener when disarmed or
  unmounted;
- do not register before runtime readiness;
- do not warn for internal workbench pane navigation, disclosure changes or
  focus moves;
- do not use `unload` to persist, export or clear data;
- do not auto-download from `pagehide` or `visibilitychange`;
- keep the guard synchronous and free of React state writes during the event;
  and
- recheck the latest derived armed state through a ref so the listener cannot
  use stale render data.

Browser Back/Forward or a same-tab URL navigation that unloads the document may
trigger the native warning as expected. In-app history changes that do not
unload must not trigger it.

## Architecture and ownership

- Add a DOM-free session-durability guard core that accepts explicit area
  fingerprints/outcomes and derives armed state.
- Reuse Workspace's closed area registry and live capture; do not make the
  guard an alternate backup builder.
- Existing persistence/controller transactions report durable, session-only
  or no-op outcomes at their current call sites.
- One thin ready-shell hook owns `beforeunload` registration.
- The shell notice receives a prepared model and intents. It does not inspect
  storage or build exports.
- The Workspace controller retains privacy, envelope, filename and typed
  download outcome ownership; extend its success result with included area ids
  if they are not already available to the caller.
- `App` composes current live state, durability outcomes, export intent and the
  existing attention surfaces.

No domain, generated-data, storage-envelope, backend or deployment change.

## Accessibility and responsive behavior

- The mode notice is not re-announced as a live update on every keystroke.
- Transition into dirty state and backup success/failure use one concise polite
  announcement each.
- The visible heading, explanation and backup button remain keyboard reachable
  in desktop, compact landscape and normal-flow mobile layouts.
- The backup action's accessible name is exactly `Download Workspace backup`.
- Do not rely on the native leave warning as the only warning; browsers can
  suppress it in some circumstances.
- Do not trap focus or open a custom modal merely because the tab is dirty.

## Privacy and security constraints

- Never render or log current values, raw persisted values, fingerprints,
  exported JSON, browser errors or local paths from the guard.
- Do not include the last Hiscores player without the existing explicit
  session-only opt-in.
- Safe mode must never read, overwrite or clear original saved browser data.
- Do not add a localStorage/sessionStorage key for dirty state or backup
  acknowledgement.
- Do not attempt a background upload, beacon, service worker sync or server
  recovery.

## Required tests

### Pure guard tests

- Safe-session/storage-unavailable mode with no edit is not armed.
- A changed included area arms; returning exactly to baseline clears.
- Transient result, pane and disclosure changes do not arm.
- A session-only mutation in an otherwise durable session retains the prior
  durable baseline and arms.
- A verified durable save clears only its area.
- Successful backup acknowledges exactly included dirty areas.
- Omitted dirty Hiscores state keeps the guard armed; opted-in inclusion clears
  it.
- Failed export acknowledges nothing.
- Any post-backup change re-arms.
- A future Workspace area without guard classification fails an exhaustive
  test.

### Hook and component tests

- `beforeunload` is absent before dirty state, present once while armed and
  removed after clear/acknowledgement/unmount.
- The handler calls `preventDefault` and sets `returnValue` without mutating
  application state.
- Safe-mode information and dirty warning use one composed visible owner.
- Backup started/failed copy retains the truthful file-export wording.
- No raw values or fingerprints appear in rendered output.

### Browser tests

1. Enter safe mode from the implemented application recovery path.
2. Confirm no leave handler before editing.
3. Change a setup value and observe `Unsaved session-only changes`.
4. Trigger reload/navigation and prove the native dialog event occurs.
5. Cancel leaving, dispatch a Workspace backup and prove the download event,
   truthful copy and exact acknowledgement.
6. Change another value and prove protection re-arms.
7. Repeat with storage unavailable or a controlled session-only persistence
   outcome.
8. Prove local browser data remains byte-for-byte unchanged.

Also cover a dirty sensitive last-player area with opt-in off/on, keyboard
access, 390 px mobile and compact landscape containment.

### Validation

Run at minimum:

```sh
npm run typecheck
npm run test -- <focused application-recovery/session-guard/workspace/export suites>
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "protects session-only changes before leaving"
git diff --check
```

Run Firefox and WebKit coverage for `beforeunload` registration and the direct
backup download. Branded Safari/physical iOS claims remain governed by the
existing cross-browser exception policy.

## Acceptance criteria

- Session-only mode alone does not create a dirty warning.
- A meaningful non-durable change produces one persistent visible warning and
  arms the browser-native leave guard.
- The direct backup action exports one coherent current Workspace through the
  existing privacy and truthful-outcome contracts.
- Backup acknowledgement applies only to exact included state; failure,
  exclusion or any later edit keeps/re-arms protection.
- Original saved data remains untouched and no new persistence key or schema is
  added.
- Listeners are bounded, cleaned up and absent for durable or no-op state.
- Focused unit, hook, browser, cross-browser, architecture and diff checks pass.

## Implementation evidence

`src/app/controllers/session-only-exit-protection.ts` owns the DOM-free
per-area baseline/current/acknowledgement state and derives presentation without
exposing its fingerprints. It consumes `WORKSPACE_TRANSFER_AREA_IDS`,
`WORKSPACE_AREA_REGISTRY` and each registry codec through
`createWorkspaceAreaFingerprint()`, so the nine required areas, sensitive
Hiscores opt-in and excluded migration-dismissal policy cannot drift into a
second list. `LocalStateRecoveryControllerCore` reports verified durable and
session-only outcomes; `App` settles one coherent current Workspace state after
runtime readiness and composes export acknowledgement.

`use-session-only-before-unload.ts` owns only the stable listener and synchronous
event contract. The existing safe-session presenter owns the combined visible
mode/dirty/backup state. `WorkspaceFileTransferControllerCore` still owns the
unchanged envelope/privacy/download request and now returns the actual included
area ids only on its typed requested outcome.

The focused 2026-07-21 run passes 8 files / 71 tests, including pure no-edit,
edit, exact revert, durable/session-only, included/omitted/failed backup,
post-backup edit and listener lifecycle cases. The named Chromium recovery path
passes 1/1 and proves real recovery entry, cancelable native dialog, download,
exact acknowledgement, privacy opt-out/opt-in, responsive containment,
re-arming and byte-identical original localStorage. A second Chromium path
covers a controlled runtime setup-persistence failure and exact Undo. The full
cross-browser release gate passes 36/36 across Playwright Firefox,
desktop-WebKit and iPhone-emulated mobile WebKit. These are engine/emulation
claims, not branded Safari or physical iOS evidence.

## Open questions

None. Browser-native dialog wording and final filesystem persistence are not
controllable, so the specified contract intentionally covers listener state and
truthful download dispatch only.

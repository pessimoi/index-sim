# Global Undo visibility and targeted Reset recovery specification

- Status: implemented
- Date: 2026-07-20
- Owner: ready app shell, global status/Undo and existing state owners
- Evidence: verified
- Contract: closed

- Priority: high
- Estimated effort: M
- Feature-inventory parents: `Basic combat setup`, `Result summary`, `Cannon`
  and `Loot/economy summary` (`Valmis`)
- Depends on: the existing single `PendingUndo` slot, normal Default/Custom form
  write-through, local-state recovery and the implemented Economy/Hiscores/setup
  Undo contracts

Implementation evidence: one `PendingUndoStatus` remains the only interactive
and polite owner, matching hidden general-status copy is suppressed, all seven
targeted Reset classes use changed/no-op/restore handling and mobile/portrait
sticky behavior no longer inherits an accidental shell scroll container.
Focused component/state coverage passes 87/87, the full unit suite passes
952/952, four targeted production-preview transactions plus three existing
Loot/hidden-tier regressions pass, the 390/620/768/640/desktop reachability
matrix passes, architecture has 149 modules with no cycles, all 19 goldens pass
and the production build plus diff check pass. The final combined release run
passes the complete 115/115 Chromium gate and two 26/26 read-only Darwin visual
runs after the explicitly reviewed, feature-owned baseline update.

## Purpose

Make the existing one-step Undo reliably visible from every supported workbench
layout and give every current targeted Active assumptions Reset the same
recoverable transaction boundary.

This is release hardening for existing `Valmis` workflows. It does not create a
second notification system, a multi-step history or a new resettable assumption.

## Feature-inventory boundary

The affected feature rows remain `Valmis`. The current UI already exposes one
global Undo for setup replacement, loadout optimization, saved-setup operations,
Loot optimization/reset, Workspace restore, Economy destructive actions and
Hiscores Apply. Active assumptions already exposes the seven accepted targeted
Reset actions.

The remaining gap is consistency and reachability:

- a pending action is rendered once near the top of the ready app shell, but
  normal-flow mobile and portrait layouts may be scrolled far below that DOM
  position when an action creates the Undo;
- the strip has no sticky or viewport-placement contract;
- Loot settings and Loot action override Reset already create Undo, while the
  other five targeted Reset paths do not; and
- panel-level Manual overrides, Cannon and hidden-tier actions reuse or mirror
  those same non-undoable mutations.

The feature status must stay `Valmis` while this specification is pending. The
inventory and backlog must link here without claiming that this contract is
implemented.

## Verified current behavior

- `App.tsx` owns one `PendingUndo | null`, `setUndoableStatus()` and
  `undoPendingAction()`. A later successful undoable action replaces the prior
  one. Reload and tab close discard it.
- `PendingUndoStatus` is one pure presenter with a visible label and native
  `Undo` button. It is rendered after the ready-shell notices and before
  `WorkbenchShell`.
- `.pending-undo-strip` is currently an ordinary flex row. It wraps long text
  but has no sticky, fixed or scroll-owner behavior.
- Desktop and compact-landscape CSS pin the document to the viewport and make
  the workbench columns their own scroll owners. The current strip is outside
  those inner scroll owners and therefore consumes normal shell height.
- Widths through 620 px and 621-980 px portrait use normal document flow. The
  user can trigger a Reset from content below the strip's normal DOM position.
  The current CSS therefore provides no guarantee that the newly created Undo
  is inside the visible viewport. This is a code-level reachability gap; the
  implementation must prove the actual behavior in Chromium rather than rely
  on an assumed browser scroll-anchor response.
- `resetActiveAssumption()` dispatches these seven targets:
  `manual-combat-overrides`, `cannon-enabled`, `loot-settings`,
  `loot-action-overrides`, `scarce-spot`, `explicit-safespot` and
  `hidden-gear-tiers`.
- `resetCurrentLootSettings()` and `resetCurrentLootOverrides()` already
  capture their prior in-memory maps and register global Undo.
- Manual overrides, current-monster Cannon, scarce spot, explicit safespot and
  hidden gear tiers currently mutate their owner and publish only general
  status. They do not register a pending Undo.
- The Loadout `Reset overrides`, Cannon-pane Reset and Settings `Show all`
  actions reach the same owner mutations outside Active assumptions. A shared
  mutation must not be undoable from one entry point and irreversible from
  another.
- Form and Cannon state persist through `index-sim:rewrite-setup`; Loot actions,
  Loot settings and hidden gear tiers retain their separate existing keys.
  Normal local-state effects and recovery blocks own those writes.
- `setUndoableStatus()` also updates the visually hidden general live status
  while `PendingUndoStatus` is itself a polite live region. The implementation
  must prevent one successful action from being announced twice without
  weakening non-Undo status announcements.

## Goals

- Keep exactly one interactive global pending-Undo surface.
- Keep that surface fully visible while a pending action exists at desktop,
  compact landscape, mobile and portrait tablet layouts.
- Preserve the user's active pane, focused control and vertical scroll
  position when a pending Undo appears.
- Make the surface wrap safely, respect device safe areas and avoid covering
  modal review UI or widening the document.
- Register one exact one-step Undo for all seven targeted Reset classes and all
  existing entry points that invoke the same mutation.
- Keep no-op Reset attempts from replacing a still-useful prior Undo.
- Restore each state through its existing owner and persistence/recovery path.
- Keep the existing latest-successful-undoable-action-wins rule.
- Announce one polite success message per changed action and one restore result
  after Undo.

## Non-goals

- Do not add a multi-step stack, redo, persisted Undo history, timeout,
  auto-dismiss, toast dependency or account/cloud storage.
- Do not add Reset to review-only Active assumptions rows or broaden the seven
  accepted reset targets.
- Do not change which values each Reset clears. In particular, scarce-spot
  Reset still keeps target and respawn values, Cannon Reset does not reset Trip
  scarce controls and safespot Reset still returns to auto detection.
- Do not change `PendingUndo` into a domain or persisted-state contract.
- Do not change a storage key, envelope, version, schema, recovery block,
  migration policy or local-state size limit.
- Do not reuse the Economy exact-raw controller for ordinary setup, Cannon,
  Loot or preference state. Its closed three-key contract remains unchanged.
- Do not add confirmation dialogs to these already accepted narrow Reset
  actions.
- Do not change combat, Trip, XP, Planner, Risk, loot or economy formulas,
  generated data, `SimulationRequest` or result schemas.
- Do not pre-empt the separate Default/Custom mode and autosave-clarity
  specification. This goal uses the current persistence truth and attention
  surface.
- Do not promise that an old pending Reset can merge safely with arbitrary
  later edits. The existing global one-slot contract is intended for immediate
  one-step recovery; a later successful undoable action replaces it.

## One global surface decision

`PendingUndoStatus` remains the only interactive owner. Do not clone an Undo
button into Active assumptions, individual panes, the topbar or Settings.
Every pending action, including existing setup, Workspace, Economy and
Hiscores actions, receives the same visibility behavior.

The ready app shell keeps this order:

1. primary header and persistent data-attention surfaces;
2. the one pending-Undo surface when present; and
3. the workbench.

Modal dialogs and review surfaces remain above it in the interaction layer.
The Undo surface must not be portalled into a second live-region owner or
duplicated for different breakpoints.

## Responsive viewport contract

### Desktop and compact landscape

At the current viewport-bound breakpoints, keep the pending Undo in the shell's
normal flex flow outside the three workbench scroll owners.

- It must be completely inside the viewport.
- It may reduce workbench height, but must not create document scroll, collapse
  the workbench to zero height or change the three-column ownership contract.
- Player, active-pane and MonsterCard scrolling remain independent.
- The 640 x 360 compact-landscape contract must remain usable when local-state
  attention and pending Undo are both present.

### Mobile and portrait tablet

At the existing normal-flow boundary
`max-width: 620px, 621-980px portrait`, make the single existing surface sticky
near the top of the scrolling viewport while it is pending.

The preferred implementation is `position: sticky` on the existing element,
with a top inset that includes the app spacing and `env(safe-area-inset-top)`.
An equivalent shell-owned implementation is acceptable only if the browser
matrix proves the same outcomes. A fixed bottom toast that covers workbench
controls is not acceptable.

The sticky surface must:

- become fully visible after an action is activated from below its normal DOM
  position;
- remain inside the viewport until Undo is consumed or replaced;
- use an opaque background and a bounded layer above scrolling workbench
  content but below modal dialogs;
- wrap a long action label without pushing the button outside the viewport;
- keep the native `Undo` button at least 40 CSS pixels high in the accepted
  mobile matrix;
- account for the safe-area inset without hard-coded device dimensions;
- avoid horizontal document overflow at 390, 620 and 768 CSS pixels; and
- avoid programmatic `scrollIntoView()`, scroll-to-top or focus movement when
  it appears.

CSS scroll anchoring may adjust the numeric `window.scrollY` by the inserted
row's flow height. The acceptance requirement is that the action context does
not jump to the document start and the user can continue from the same pane,
not byte-exact preservation of one browser-specific scroll number.

### Coexisting surfaces

Local-state attention and pending Undo have different jobs and may be visible
together. Attention remains persistent until health is resolved; Undo remains
until consumed, replaced or the session ends. Neither may cover the other's
copy or action, and no combined state may widen the document.

## Accessibility and announcement contract

- Keep one labelled section with `aria-label="Local state undo"` and one native
  `Undo` button.
- Keep the pending action as a polite status, not an alert.
- Do not move focus into the surface when it appears. The action that triggered
  the mutation retains focus when it remains mounted.
- The Undo button must have the repository's visible `:focus-visible` style and
  remain fully visible while focused.
- Do not rely on position, color or an icon to communicate the action; the
  visible label is required.
- Do not announce the same successful action through both the visible pending
  status and the visually hidden general status. While the general status text
  exactly matches the current pending label, only the pending surface owns the
  polite announcement.
- Non-Undo statuses that occur while an older pending action remains must still
  be announced through the general status channel without clearing that Undo.
- After Undo consumes and removes the surface, the existing general status
  channel announces the restore label once. Reset-specific pane notices may
  update as they already do, but must not add a second global live region.
- Replacing a pending action updates the same DOM owner and politely announces
  only the new label.
- Reduced-motion users must not receive a required slide/fade animation. The
  implementation may use no motion at all.

This remains a bounded keyboard and live-region contract, not a WCAG or
assistive-technology certification claim.

## Targeted Reset transaction contract

### Common order

Every covered entry point performs this order synchronously from the current
live state:

1. identify the exact existing state owner and current target, if any;
2. capture the complete immutable pre-Reset value needed by that owner;
3. derive the current canonical Reset value with existing helpers/constants;
4. stop when the relevant raw/semantic owner is already at that Reset value;
5. apply the Reset through the current normalized setter/write-through path;
6. update the existing pane-specific notice when that workflow has one; and
7. register one pending Undo only after the complete live mutation.

Candidate creation, a no-op and a rejected action must leave the preceding
pending Undo unchanged. Do not clear first and reconstruct it later.

Undo performs this order:

1. consume the current pending record once under the existing global handler;
2. restore the captured owner value through its normal setter/write-through;
3. let the existing persistence effect and recovery controller handle the
   resulting state; and
4. publish the specified restore status once.

The captured values stay in the session-only closure. They are not serialized,
logged, exported or added to transfer files.

### Reset coverage table

| Target / entry points                                                                   | Changed owner and no-op rule                                                                                                                          | Reset behavior retained                                                                                   | Required pending / restore label                                                        |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Manual combat overrides: Active assumptions and Loadout `Reset overrides`               | Capture the current normalized form or an equivalent immutable form-owned preimage. No-op when all manual overrides equal `DEFAULT_MANUAL_OVERRIDES`. | Reset only accuracy, damage and attack-speed overrides through normal Default/Custom form write-through.  | `Manual overrides reset` / `Restored manual combat overrides`                           |
| Current-monster Cannon: Active assumptions and Cannon-pane Reset                        | Capture `cannonByMonster` before removing the current target's own row. No-op when that row is absent.                                                | Remove only the current-monster Cannon row. Trip scarce state and every other monster row stay unchanged. | `Current monster cannon reset` / `Restored cannon settings for <Monster>`               |
| Current-monster Loot settings: Active assumptions and Loot-pane settings Reset          | Retain the existing exact pre-Reset `lootSettingsByMonster` capture. No-op when the current target has no own settings row.                           | Remove only that monster's explicit settings row. Inherited defaults and other monsters remain.           | Keep `Reset loot settings for <Monster>` / `Restored loot settings for <Monster>`       |
| Current-monster Loot action overrides: Active assumptions and Loot-pane overrides Reset | Retain the existing exact pre-Reset `lootPrefsByMonster` capture. No-op when the current target has no valid override rows.                           | Remove only current-monster action overrides.                                                             | Keep `Reset loot overrides for <Monster>` / `Restored loot overrides for <Monster>`     |
| Trip scarce spot: Active assumptions                                                    | Capture the current normalized form. No-op when `trip.scarceSpot` is already false.                                                                   | Set only `scarceSpot` false; preserve `targetsAtSpot` and `respawnSeconds`.                               | `Scarce spot disabled; target and respawn values kept` / `Restored scarce spot setting` |
| Explicit safespot: Active assumptions                                                   | Capture the current normalized form. No-op when `trip.safespot` is already `null`.                                                                    | Set only `safespot` to `null`, returning to auto detection.                                               | `Safespot override reset to auto` / `Restored safespot override`                        |
| Hidden gear tiers: Active assumptions and Settings `Show all`                           | Capture the complete `HiddenGearTiersState`. No-op when it already equals the canonical all-visible state.                                            | Apply `DEFAULT_HIDDEN_GEAR_TIERS_STATE`; do not alter current equipment selections.                       | `Hidden gear tiers shown` / `Restored hidden gear tiers`                                |

`<Monster>` comes from the current validated display label, with the existing
sanitized id fallback only when no label exists. Raw storage keys, JSON,
schema paths and parser diagnostics never enter these labels.

The App-level Active assumptions dispatcher must not publish a second generic
status after a reset helper has already registered its pending label. One
helper owns one changed/no-op outcome regardless of which UI entry point called
it.

### Existing one-slot replacement rule

- A changed Reset replaces the preceding pending action.
- A second changed Reset replaces the first.
- A no-op Reset preserves the preceding pending action and may publish bounded
  neutral feedback through the general status channel.
- A successful existing undoable setup, Workspace, Economy, Hiscores, loadout
  or Loot action replaces a Reset Undo exactly as it does today.
- A normal pane navigation, disclosure, filter, sort or uncommitted draft does
  not clear the pending action.
- Reload and tab close discard the pending action without changing the already
  applied live/persisted Reset result.

## Persistence and recovery contract

These targeted Resets continue to use their existing normal state effects:

- Manual overrides, Cannon, scarce spot and explicit safespot use the current
  rewrite-setup owner and Default/Custom write-through.
- Loot settings and Loot actions use their current per-monster versioned
  owners.
- Hidden gear tiers use their current versioned preference owner.

Do not write or restore exact raw storage strings for these ordinary state
changes. Do not call `unblockReplaced()` merely because a user selected Reset.
An invalid, unsupported or incompatible stored value remains protected for
explicit recovery, and the local-state attention surface remains responsible
for explaining that the live Reset may be session-only.

A storage write failure must not prevent the complete live Reset or its live
Undo. The recovery controller records the failure through its existing path;
the pending label does not claim `Saved locally`. When persistence is healthy,
the normal effect makes Reset and Undo durable after it settles. No storage
version or migration is introduced.

## Ownership and likely implementation files

- `src/app/App.tsx`: shared changed/no-op Reset handlers, exact preimage
  capture, normal owner restoration, pending-label registration and duplicate
  global-announcement suppression.
- `src/app/components/app-presenters.tsx`: the one pure pending-Undo surface and
  its accessible contract.
- `src/app/styles.css`: desktop/landscape flow plus normal-flow sticky,
  safe-area, wrapping and layer behavior.
- Existing state owners under `src/app/state`: canonical defaults, parsing and
  persistence schemas remain unchanged. A small DOM-free Reset transaction
  helper is acceptable if it removes App branch duplication; it must not own
  React, storage or global Undo.
- `src/tests/app-shell-components.test.tsx`: pure presenter and announcement
  contract.
- Existing active-assumption, simulation, Loot and UI-state tests: exact target
  behavior and no-op coverage.
- Focused Playwright owners under `src/tests/e2e`: visible transaction,
  persistence and responsive viewport evidence.

Do not create a general notification controller or move feature state out of
its current owner for this M-sized goal.

## Required tests

### Unit and component evidence

Prove that:

- no pending action renders no surface;
- one pending action renders one labelled polite status and one native Undo;
- a long label wraps without dropping the action;
- the same successful action is not emitted from two global live regions;
- an unrelated non-Undo status is still announceable while a pending action
  remains;
- replacing an action reuses one surface and exposes only the new label;
- all seven changed Reset classes produce the specified label and restore
  value;
- every no-op keeps the preceding pending action;
- Cannon and both Loot resets affect only the current monster;
- scarce Reset preserves target/respawn, Cannon Reset preserves Trip scarce
  state, safespot Reset restores auto and hidden-tier Reset preserves selected
  equipment;
- direct pane and Active assumptions entry points reach the same transaction;
  and
- Undo uses normal Default/Custom or feature-state ownership without changing
  unrelated PriceSet, Planner, Duel, Hiscores, history or calculated state.

### Functional browser evidence

Use production-preview Chromium and prove this sequence for every reset class,
with related targets combined into bounded scenarios where practical:

1. establish a non-default value and an unrelated sentinel value;
2. activate Reset from its pane or Active assumptions entry point;
3. verify the exact changed state and the one visible pending label;
4. activate Undo;
5. verify the exact prior value, preserved sentinel and removed pending action;
6. repeat one path with a preceding different Undo and a no-op attempt; and
7. prove the second successful changed Reset replaces the first.

At minimum, reload evidence must cover one rewrite-setup Reset and hidden gear
tiers after the Reset state has persisted, and again after Undo has restored and
persisted the original state. Pending Undo itself must be absent after reload.

Inject one blocked or failed persistence case and prove that the live Reset and
Undo remain complete, the protected stored value is not silently overwritten
and local-state attention remains the durability truth owner.

### Responsive browser matrix

Trigger an Undo from content below its initial document position at:

| Profile           |   Viewport | Required evidence                                                                                         |
| ----------------- | ---------: | --------------------------------------------------------------------------------------------------------- |
| mobile            |  390 x 844 | Surface fully visible and sticky, 40 px Undo, no horizontal overflow, action context not scrolled to top. |
| wide mobile       |  620 x 844 | Same normal-flow contract at the exact mobile upper bound.                                                |
| portrait tablet   | 768 x 1024 | Same contract in the portrait-tablet branch.                                                              |
| compact landscape |  640 x 360 | Surface remains outside pane scroll owners; document scroll stays zero and workbench remains usable.      |
| desktop           | 1440 x 900 | Surface remains in shell flow and all three workbench scroll owners remain intact.                        |

Run one compact-landscape case with local-state attention present and one
mobile case with a long pending label. The modal/review layer must remain above
the pending surface.

Add bounded visual evidence for at least the 390 x 844 sticky state and the
640 x 360 coexistence state. Baseline changes require the existing explicit
visual-review workflow; do not update unrelated screenshots.

## Validation

Run at minimum during implementation:

```sh
npm run test -- src/tests/app-shell-components.test.tsx src/tests/active-assumptions-view-model.test.ts src/tests/simulation-view-model.test.ts src/tests/loot-simulation-view-model.test.ts src/tests/ui-adapters.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "global Undo|targeted Reset"
npm run test:e2e:visual
npm run test:golden
npm run build
git diff --check
```

Run the complete functional browser suite before delivery because the one
global presenter is shared by setup, loadout, Duel, Loot, Workspace, Economy
and Hiscores transactions. Review all changed images before any explicit
baseline update. No live provider, generated-data refresh, database or deployed
environment is required.

## Acceptance criteria

- Exactly one interactive global Undo is rendered for the current pending
  action.
- That surface is fully visible across the 390/620/768 normal-flow matrix and
  the 640 x 360/desktop viewport-bound layouts without a forced scroll jump or
  document-width overflow.
- Local-state attention and pending Undo coexist without covering each other or
  starving the compact workbench.
- Every accepted targeted Active assumptions Reset is undoable, and Manual,
  Cannon, Loot and hidden-tier panel entry points use the same transaction.
- No-op Reset attempts preserve a useful prior Undo; changed actions retain the
  existing one-slot replacement rule.
- Undo restores the exact captured owner value through normal write-through,
  while unrelated state remains unchanged.
- One changed action produces one polite global announcement; restore produces
  one follow-up announcement.
- Storage and recovery behavior remains truthful without key, version, schema,
  migration or exact-raw-controller changes.
- All affected feature rows remain `Valmis`; no formula, provider, backend,
  account, database or generated-data scope changes.
- Focused, type, architecture, mocked/local browser, visual, golden, build and
  diff checks pass.

## Implementation sequence

1. Characterize the existing pending surface, live-region duplication and all
   reset entry points with focused tests.
2. Centralize changed/no-op outcomes for the seven target classes without
   changing their reset semantics.
3. Register the missing Undo records and route the mirrored panel actions
   through the same handlers.
4. Add the single-surface responsive and announcement behavior.
5. Prove persistence/recovery, replacement and the five-viewport matrix.
6. Review bounded visual changes, run the complete functional suite and update
   living implementation evidence only after the contract is complete.

## Open questions

None block implementation. Multi-step history, edit-aware merging of an older
Undo with later ordinary changes and persisted cross-session Undo require a
separate product/state decision and remain outside this goal.

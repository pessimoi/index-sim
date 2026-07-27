# Hiscores Apply Undo specification

- Status: implemented
- Date: 2026-07-20
- Owner: technical documentation
- Evidence: verified
- Contract: closed

Priority: medium.

Estimated effort: S.

## Purpose

Complete the existing Hiscores batch Apply safety contract with the app's
single global Undo action. Lookup, validated preview, normalized-player
freshness and level application are already implemented. This goal adds a
recoverable boundary around the one step that changes all returned combat
levels together.

## Feature-inventory check

Hiscores remains `Valmis` in the feature inventory. The current rewrite already
supports service status, lookup, preview metadata, freshness checks and Apply
for Attack, Strength, Defence, Hitpoints, Prayer, Ranged and Magic. Undo is
release hardening for that accepted workflow, not a new provider, integration
or product capability.

The status must stay `Valmis` while this specification is pending. The
inventory should state the current gap truthfully and link here without
claiming that Undo is implemented.

## Verified prior behavior and resolved gap

- `src/app/controllers/hiscores-lookup.ts` owns lookup status, latest-request
  sequencing, normalized-player freshness, the retained response, preview
  disclosure state and sanitized notices.
- `prepareApply()` synchronously rechecks that the retained response still
  matches the normalized current Player input. A stale attempt returns no
  mutation authority.
- `src/app/state/hiscores.ts` owns the pure supported-skill mapping and
  `applyHiscoresLevels()`. Missing returned skills keep their current values.
- Before this implementation, `src/app/App.tsx` called `prepareApply()` and
  immediately committed the returned levels through the safe form mutation
  path without capturing the preceding form or registering `pendingUndo`.
- `src/app/components/topbar/hiscores-panel.tsx` renders the current/fetched
  preview and one Apply button. Apply intentionally leaves the native preview
  disclosure open.
- `App` already owns one global `PendingUndo` value and
  `PendingUndoStatus`. A later successful undoable action replaces the earlier
  one, and the history is not persisted.
- Live level changes already flow through Planner's implemented
  `reconcilePlannerProgressWithLevels()` path. Hiscores provides levels only;
  it does not provide exact XP totals.

The implemented transaction closes that recovery gap. Repeating Apply after
levels already match is now a bounded no-op and cannot replace a still-useful
earlier Undo.

## Goals

- Capture the exact current form before a fresh Hiscores Apply mutates it.
- Count the supported level fields whose fetched value differs from the live
  form at Apply time.
- Publish `Applied N levels` through the existing global Undo strip.
- Restore the exact pre-Apply form through the existing normalized form commit
  path when Undo is selected.
- Preserve the current response, preview disclosure and freshness contract
  across Apply and Undo.
- Let the implemented Planner reconciliation react to both the applied and
  restored live levels without adding a second Planner mutation path.
- Keep stale and no-change attempts from mutating form state or replacing the
  current global Undo.

## Non-goals

- Do not change the Hiscores provider, same-origin routes, response schema,
  player validation, request limits, privacy policy or deployment boundary.
- Do not persist a Hiscores response, fetched levels, preview or Undo history.
- Do not add confirmation, a second preview step, multi-level selection,
  per-skill Undo or a multi-step history.
- Do not add exact XP to the Hiscores contract or infer XP totals from levels.
- Do not snapshot or restore Planner UI state. Planner XP and targets continue
  to follow their existing reconciliation rules.
- Do not change combat, Trip, Planner, Risk, comparison or XP formulas.
- Do not close or relocate the current preview after Apply or Undo.
- Do not redesign the topbar or create a Hiscores-specific Undo presenter.

## Apply transaction

`App` remains the mutation owner. On Apply it must perform this order in the
same synchronous event:

1. call `hiscores.prepareApply()`;
2. stop without form or Undo mutation when the outcome is stale;
3. capture the current normalized `CombatSetupFormState` before applying any
   fetched value;
4. derive the next form through `applyHiscoresLevels(previousForm, response)`;
5. compare the seven supported level keys in canonical Hiscores order and
   count only values that actually differ;
6. when the count is zero, keep the current form and existing pending Undo
   unchanged and report bounded no-change feedback;
7. otherwise commit the next form through the existing form write-through
   path; and
8. register one global pending Undo with the captured form as its restore
   value.

The visible pending action label is exactly:

`Applied N levels`

`N` is the changed supported-field count, not the number of response rows and
not the numeric sum of level differences. A partial response therefore reports
only returned supported fields that changed. Missing skills remain untouched.

The restore label is:

`Restored levels from before Hiscores Apply`

The label intentionally excludes the player name. The global strip is the
single authoritative Apply success announcement and renders the existing
native `Undo` button. The controller must not publish a second competing live
success announcement for the same Apply. This follow-up therefore supersedes
the narrow `recordApplied()` success-copy responsibility in the implemented
Hiscores controller specification; lookup, stale and error notices remain
controller-owned.

No-change feedback is:

`Current levels already match Hiscores`

It must not clear or replace a pending Undo from an earlier successful action.

## Snapshot and restore boundary

The Undo value is the exact normalized `CombatSetupFormState` captured at the
successful Apply boundary. React form state is treated immutably, and
`applyHiscoresLevels()` creates a new levels object, so the captured value must
not be mutated in place.

Undo restores the captured form through `commitFormState()` or an equivalent
existing caller-owned operation. It must not call `setForm()` directly because
Default/Custom write-through and normal setup persistence must remain aligned
with every other form mutation.

Hiscores Apply itself changes only supported level fields. The complete form
snapshot is retained because it is the established one-step recovery boundary
for form-wide app actions and guarantees that the original level set is
restored as one coherent value. Undo does not restore the Player input,
Hiscores response, preview-open state, PriceSet, loot preferences, Planner UI,
saved Duel collection or calculated output.

Undo performs this order:

1. read the current pending action through the existing global Undo handler;
2. clear that pending action under the current one-shot contract;
3. commit the captured pre-Apply form through the normal form path; and
4. publish `Restored levels from before Hiscores Apply` through the existing
   global status path.

A later successful undoable action replaces this pending action exactly as it
does today. Reload, tab close and a new session discard it. This goal does not
add durable Undo storage; normal rewrite-setup persistence remains responsible
for saving the resulting live form.

## Preview and freshness contract

- Apply still calls `prepareApply()` before the snapshot or mutation. A stale
  outcome creates no snapshot, changes no level and leaves the existing
  pending Undo unchanged.
- A successful Apply does not call `closePreview()` or change the Player input,
  response or `previewOpen` state.
- Because preview rows are derived from the live form plus the retained
  response, their Current column updates to the applied values without a new
  lookup.
- After Apply, another click with no changed supported value is a no-op and
  cannot replace the useful pre-Apply Undo. The UI may disable Apply while no
  returned supported value differs, but the handler-level no-op guard remains
  required.
- Undo does not mutate Hiscores controller state. If the response is still
  current and the disclosure is open, the Current column returns to the
  restored values and Apply becomes useful again.
- If the Player input changed after Apply, the existing freshness contract may
  close and clear the preview. The global Undo remains valid because its form
  snapshot is independent of the retained lookup response.

## Planner reconciliation contract

Apply and Undo must not call Planner setters directly. Both update live form
levels through the existing form path, after which the implemented Planner
controller reconciles its draft and last-computed state against those levels.

The reconciliation test must cover both directions:

1. applying higher or lower Hiscores levels invalidates incompatible explicit
   Current XP to Auto and raises unlocked targets when required;
2. undo restores the exact prior form levels;
3. Planner re-resolves Auto XP from the restored level floor and keeps every
   visible/effective target valid; and
4. stale calculation output from the applied-level source cannot become
   current after Undo.

Planner reconciliation is intentionally not a reversible snapshot. For
example, an explicit XP value reset to Auto by Apply stays Auto after Undo, and
an unlocked target raised by Apply may remain at the higher still-valid value.
The requirement is that visible draft and effective calculation inputs agree
with the restored levels, not that Planner UI state returns byte-for-byte to
its pre-Apply value.

## Ownership and likely implementation files

- `src/app/App.tsx`: fresh Apply transaction, pre-Apply capture, global
  `setUndoableStatus()` registration and restore closure.
- `src/app/state/hiscores.ts`: pure changed-level comparison/transaction helper
  if extracting it keeps the handler directly testable.
- `src/app/controllers/hiscores-lookup.ts` and
  `src/app/controllers/use-hiscores-lookup.ts`: remove or narrow the obsolete
  controller-owned Apply success recording while preserving freshness and
  preview ownership.
- `src/app/components/topbar/hiscores-panel.tsx`: only if Apply disabled state
  needs to reflect zero changed rows; no markup or layout redesign is needed.
- `src/tests/hiscores-ui-state.test.ts`: pure apply/change-count/snapshot cases.
- `src/tests/hiscores-lookup-controller.test.ts`: unchanged freshness authority
  and any refined controller Apply outcome contract.
- `src/tests/planner-ui-state.test.ts` and
  `src/tests/planner-controller.test.ts`: Apply/Undo level-sequence
  reconciliation and stale-result rejection.
- `src/tests/e2e/integrations-economy.spec.ts`: the existing mocked Hiscores
  Apply path extended through global Undo.

Do not introduce a new controller solely for this S-sized synchronous
transaction. `App` intentionally owns the form and global Undo bridge.

## Required tests

Focused tests must prove:

- a fresh partial response changes only returned supported levels;
- the changed count excludes unchanged returned values and missing skills;
- the captured form remains unchanged after deriving the applied form;
- stale Apply has no form or pending-Undo authority;
- a zero-change Apply leaves the previous pending Undo intact;
- successful Apply registers exactly one global action with
  `Applied N levels` and the existing `Undo` button;
- a second successful changed Apply replaces the first under the existing
  single-Undo rule;
- Undo restores all exact pre-Apply levels through normal form write-through;
- Apply and Undo leave the response and open preview available when the Player
  identity stays current;
- changing Player after Apply may invalidate the preview but cannot invalidate
  the global form Undo;
- Apply reconciliation keeps Planner draft/effective values aligned; and
- Undo reconciliation uses restored level floors, retains still-valid
  reconciled targets and rejects late applied-source Planner output.

The focused Playwright path must use mocked same-origin Hiscores responses and
prove this user-visible sequence:

1. establish a Planner XP/target value that the fetched levels will reconcile;
2. look up a player and keep the preview open;
3. Apply and verify the changed combat levels;
4. verify the global `Applied N levels · Undo` surface;
5. verify the preview remains open and reflects the applied Current values;
6. open Planner and verify reconciled XP/target presentation;
7. activate global Undo;
8. verify the exact original combat levels, restored status and removed pending
   action;
9. verify the still-current preview remains usable and reflects the restored
   Current values; and
10. verify Planner's visible/effective values reconcile to the restored level
    floors without promising byte-exact Planner draft rollback.

The automated path must not call a live upstream service.

## Validation

Run at minimum:

```sh
npm run test -- src/tests/hiscores-ui-state.test.ts src/tests/hiscores-lookup-controller.test.ts src/tests/planner-ui-state.test.ts src/tests/planner-controller.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "hiscores"
npm run test:golden
npm run build
git diff --check
```

Run the complete functional browser suite before delivery because the global
single-Undo presenter is shared by setup, loadout, Duel, Loot and Workspace
actions. No provider fixture, persistence schema, generated data, API, CSS or
visual-baseline change is expected.

## Acceptance criteria

- Every fresh Hiscores Apply that changes at least one supported level exposes
  one keyboard-reachable global Undo labelled `Applied N levels`.
- Stale and zero-change attempts mutate nothing and do not replace a useful
  pending Undo.
- Undo restores the exact pre-Apply form levels through the normal
  Default/Custom write-through path.
- Apply and Undo keep the current preview open and derived from the live form
  when Player freshness remains valid.
- Planner draft, effective inputs and calculation freshness reconcile after
  both transitions without restoring inferred or previously adjusted XP.
- Only one session-local pending Undo exists; no storage key or schema changes.
- Hiscores remains `Valmis`, and provider, API, privacy, deployment and formula
  contracts remain unchanged.
- Focused, type, architecture, golden, build, mocked browser and diff checks
  pass.

## Dependencies

- the existing `pendingUndo`, `setUndoableStatus()` and
  `PendingUndoStatus` contract;
- the synchronous `prepareApply()` normalized-player freshness check;
- immutable `CombatSetupFormState`, `applyHiscoresLevels()` and the normal form
  commit/write-through path; and
- the implemented Planner XP/target reconciliation contract.

## Implementation evidence

- `src/app/state/hiscores.ts` now returns one immutable transaction value with
  the exact parsed pre-Apply form, the `applyHiscoresLevels()` result and the
  genuinely changed supported skills in canonical order.
- `App.tsx` performs the fresh Apply transaction synchronously, commits both
  Apply and Undo through `commitFormState()` and registers only the global
  `Applied N levels` action. Zero-change Apply leaves form and pending Undo
  intact and asks the Hiscores controller to show the fixed neutral feedback.
- The lookup controller no longer publishes changed-Apply success copy. It
  retains normalized-player freshness, stale, no-change, lookup and error
  notice ownership without closing or clearing a current preview.
- Focused state/controller/Planner coverage passes 4 files / 39 tests. The
  mocked Hiscores Chromium selection passes 2/2 and proves the exact changed
  count, no-change Undo preservation, open preview derivation, exact form Undo
  and Planner semantics in both directions.
- The complete functional Chromium suite passes 106/106 with one worker. The
  repository verification gate passes 95 Vitest files / 950 tests, 19/19
  goldens, typecheck, architecture 149/134, production build/artifact, lint and
  formatting. The 15-file artifact remains within the unchanged release budget
  at 787,630 raw / 229,007 gzip entry bytes.
- Evidence is local runtime and synthetic mocked-provider evidence. No live
  provider or production-deployment claim is made, and no markup, CSS, visual
  baseline, API, storage, rate-limit, privacy or formula contract changed.

## Open questions

None block implementation. Exact-XP Hiscores data, persisted/multi-step Undo
and per-skill selection require separate product and schema decisions and stay
outside this goal.

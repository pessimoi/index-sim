# Visible action feedback specification

- Status: implemented 2026-07-22
- Date: 2026-07-22
- Priority: high
- Estimated effort: M
- Owner: ready app shell, global status/Undo and workflow-local notice owners
- Feature-inventory parents: Basic combat setup, Result summary, Trip controls,
  Loot/Economy summary and Hiscores (`Valmis`)
- Depends on: the implemented global Undo visibility contract and existing
  workflow-local notices

## Purpose

Give visible, non-duplicated feedback for actions that currently update only the
global visually hidden status.

The app has good recovery surfaces for many large transactions, and the global
Undo strip is visible when an undoable action is pending. The remaining gap is
smaller actions whose result is announced to assistive technology but not
visibly confirmed in the workbench. A sighted user can press an action such as
an already-optimal optimizer and receive no visible reason that nothing changed.

## Verified current behavior

- `src/app/App.tsx` owns a global `status` message rendered as a visually hidden
  polite live region.
- Several workflows also own local visible notices, such as Workspace,
  PriceSet, setup review and pending Undo.
- Some no-op or informational outcomes only call the global hidden status path.
  The loadout optimizer already-optimal path is one observed example.
- Duplicating every global status into a second toast would conflict with the
  existing single Undo/status model.

## User promise

After a user activates a command, the current visible UI gives enough feedback
to understand whether the action changed state, found no useful change, failed
safely or needs review. The same message is not repeated in multiple visible
places.

## Goals

- Inventory every caller of the global status setter and classify it as:
  already-visible, pending-Undo visible, needs local visible feedback or
  intentionally assistive-only.
- Add a compact visible status owner for the `needs local visible feedback`
  cases, preferring the nearest existing pane/surface.
- Keep no-op outcomes from replacing a useful pending Undo unless the workflow
  already owns that replacement.
- Preserve the existing polite live-region behavior for assistive feedback.
- Keep messages fixed-copy and raw-error-free.
- Prove long-copy wrapping and focus retention at 390 px.

## Non-goals

- Do not add a general toast stack, timeout, persisted notification center or
  multi-step action history.
- Do not make every status message visible when a workflow already has an
  appropriate visible notice.
- Do not change calculations, optimizer search scope, setup persistence,
  Workspace transactions, Hiscores freshness or PriceSet state.
- Do not expose raw Worker, browser, storage or provider errors.

## Acceptance

- Every user-triggered action status has one documented visible or deliberately
  assistive-only owner.
- Already-optimal and no-op optimizer paths show a visible result without
  creating Undo or clearing an unrelated pending Undo.
- Existing Undo, Workspace, setup, PriceSet and recovery notices are not
  duplicated.
- Keyboard focus remains on the invoking control when it is still mounted.

## Implementation evidence

- Added one visible polite `ActionStatus` strip for global action outcomes that
  do not already have a visible workflow notice or pending Undo.
- Kept existing local notices and pending Undo deduplicated through the shared
  global status announcement helper.
- Focused checks passed:
  `npm run test -- src/tests/app-shell-components.test.tsx src/tests/loadout-view-model.test.ts src/tests/loot-view-model.test.ts src/tests/trip-pane.test.ts`.
- `npm run typecheck` passed after implementation.

## Required checks

```sh
npm run test -- src/tests/app-shell-components.test.tsx src/tests/loadout-pane.test.ts src/tests/loot-view-model.test.ts src/tests/trip-pane.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 --grep "status|optimizer|Undo"
git diff --check
```

Run broader functional or visual gates when the chosen visible status owner
changes shared shell layout.

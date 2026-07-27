# Recommendation and optimizer Undo contract specification

- Status: implemented
- Date: 2026-07-22
- Owner: Trip recommendation, Loot optimizer, Loadout optimizer and global Undo
- Evidence: verified
- Contract: closed

- Priority: high
- Estimated effort: M
- Feature-inventory parents: Trip controls, Loot/Economy summary and Basic
  combat setup (`Valmis`)
- Depends on: existing one-slot global Undo, Trip patch intents and Loot/Loadout
  optimizer owners

## Purpose

Give recommendation-style actions one consistent changed/no-op/Undo rule.

The app already has several recoverable transactions, but recommendation and
optimizer paths do not all follow the same contract. A recommendation that
patches user state should be undoable when it changes anything. A no-op should
not replace a still-useful pending Undo or pretend that state changed.

## Verified current behavior

- `src/app/components/panes/trip-pane.tsx` can apply a Trip recommendation by
  calling the supplied patch callback directly.
- Loot optimization paths use App-owned state mutation and Undo registration,
  but the current contract can still register a replacement Undo even when no
  rows changed.
- Loadout optimizer already supports a complete Undo for changed optimization
  and has an already-optimal status path.
- Global Undo is intentionally one-slot and session-local.

## User promise

Recommendation and optimizer actions behave alike: changed actions produce one
visible, exact one-step Undo; no-op actions say what happened and preserve any
existing useful Undo.

## Goals

- Define one shared changed/no-op outcome vocabulary for Trip recommendation,
  Loot optimizer and Loadout optimizer Apply paths.
- Make Trip recommendation capture and restore the exact prior affected Trip
  fields when it changes state.
- Prevent Loot optimizer no-op from mutating state identity or replacing a
  previous pending Undo.
- Keep Loadout optimizer's existing changed Undo and no-regression baseline
  intact while aligning copy and visible feedback with the shared contract.
- Keep Undo restoration through each feature's existing state/persistence owner.
- Add regression coverage for changed, no-op, stale and replaced-Undo cases.

## Non-goals

- Do not add multi-step history, redo, persisted Undo or mergeable Undo.
- Do not change optimizer scoring, search scope, requirement policy, loot
  valuation, Trip formulas, inventory model, PriceSet use or generated data.
- Do not make recommendations auto-apply.
- Do not widen Trip recommendation scope beyond fields it already recommends.
- Do not reuse the Economy exact-raw Undo controller for Trip, Loot or Loadout.

## Acceptance

- Trip recommendation changed Apply creates one global Undo and exact restore.
- Trip recommendation no-op gives visible feedback and keeps an existing pending
  Undo unchanged.
- Loot optimizer no-op preserves object identity where practical and does not
  register a new Undo.
- Loadout, Loot and Trip copy use the same changed/no-op language pattern.
- Undo restore messages are visible and raw-error-free.

## Implementation evidence

- Trip recommendations now route through an App-owned changed/no-op owner and
  register one exact preimage Undo only when fields change.
- Loot optimizer no-op returns visible feedback without replacing an existing
  useful pending Undo; Loadout optimizer retains the same no-regression
  mutation boundary.
- Focused checks passed:
  `npm run test -- src/tests/trip-pane.test.ts src/tests/trip-view-model.test.ts src/tests/loot-view-model.test.ts src/tests/loadout-view-model.test.ts src/tests/app-shell-components.test.tsx`.
- `npm run typecheck` passed after implementation.

## Required checks

```sh
npm run test -- src/tests/trip-pane.test.ts src/tests/trip-view-model.test.ts src/tests/loot-view-model.test.ts src/tests/loadout-view-model.test.ts src/tests/app-shell-components.test.tsx
npm run typecheck
npm run test:e2e -- --workers=1 --grep "Trip|Loot optimizer|Loadout optimizer|Undo"
git diff --check
```

Run goldens only if implementation touches calculation inputs or formula
composition. This specification should not require golden updates.

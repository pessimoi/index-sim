# Hiscores fallback readability specification

- Status: implemented 2026-07-22
- Date: 2026-07-22
- Priority: medium
- Estimated effort: S
- Owner: Hiscores topbar panel and Player level focus routing
- Feature-inventory parents: Hiscores and Basic combat setup (`Valmis`)
- Depends on: implemented Hiscores lookup controller and Hiscores Apply Undo

## Purpose

Make the Hiscores unavailable/error fallback readable and directly actionable.

Hiscores is implemented with safe same-origin status, lookup, preview and Apply
behavior. The remaining release-polish gap is the fallback state: long service
status can be clipped, and fallback copy can describe Player fields by relative
position instead of giving a concrete route.

## Verified current behavior

- `src/app/components/topbar/hiscores-panel.tsx` renders service status and
  manual fallback copy inside the topbar panel.
- The CSS status presentation can clip long status text with ellipsis.
- Manual level editing remains available in PlayerSidebar, and Hiscores must
  never block manual setup.
- Existing Hiscores Apply Undo and lookup freshness contracts are complete.

## User promise

When Hiscores cannot be used, the user can read the reason and activate a direct
path to manual Player level fields.

## Goals

- Let Hiscores status and fallback messages wrap safely instead of clipping
  meaningful text.
- Replace relative-position fallback copy with a concrete `Edit Player levels
  manually` action or equivalent focus-safe route.
- Focus the Player level group or first relevant level input without changing
  levels or active setup.
- Preserve disabled/unavailable service state, lookup freshness, preview Apply
  and global Undo contracts.
- Prove compact and mobile containment for long provider-disabled/error copy.

## Non-goals

- Do not call live upstream services in automated tests.
- Do not change Hiscores provider routing, privacy policy, validation, Apply
  snapshot, player persistence or Planner reconciliation.
- Do not add account auth, server-managed player storage or a new fallback
  provider.
- Do not claim manual screen-reader evidence unless the manual runbook is
  actually completed.

## Acceptance

- Long Hiscores disabled/error text is fully readable without horizontal
  overflow.
- The fallback action moves focus to manual Player levels and keeps the
  Hiscores panel state predictable.
- Manual edits remain the working fallback even when lookup is disabled or
  unavailable.
- Existing mocked Hiscores tests still prove no live upstream calls.

## Implementation evidence

- Hiscores disabled/error status copy now wraps instead of clipping with
  ellipsis.
- The topbar fallback exposes `Edit Player levels manually`, which focuses the
  existing Player level group without changing setup state.
- Focused checks passed:
  `npm run test -- src/tests/hiscores-lookup-controller.test.ts src/tests/hiscores-ui-state.test.ts src/tests/app-shell-components.test.tsx`.
- `npm run typecheck` and
  `npm run test:e2e -- --workers=1 --grep "hiscores"` passed after
  implementation.

## Required checks

```sh
npm run test -- src/tests/hiscores-lookup-controller.test.ts src/tests/hiscores-ui-state.test.ts src/tests/app-shell-components.test.tsx
npm run typecheck
npm run test:e2e -- --workers=1 --grep "hiscores"
git diff --check
```

Run the automated accessibility gate if the focus route changes ARIA ownership
or dialog/topbar semantics.

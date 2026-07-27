# Mobile MonsterCard navigation loop specification

- Status: implemented
- Date: 2026-07-22
- Owner: workbench shell, mobile navigation model and MonsterCard presenter
- Evidence: verified
- Contract: closed

- Priority: high
- Estimated effort: M
- Feature-inventory parents: Desktop workbench layout, mobile result/navigation
  loop, Result summary and Monster Compare (`Valmis`)
- Depends on: implemented mobile result/navigation loop and workbench browser
  context

## Purpose

Make Monster details reachable and reversible on long mobile Compare journeys.

The accepted mobile order keeps the active pane before the MonsterCard. That
order is correct for task flow, but the current 390 px Compare page can become a
very long document before the MonsterCard appears. Users who change filters,
select a target or reach zero results need an explicit path to details and back
to the working context.

## Verified current behavior

- `src/app/components/shell/workbench-shell.tsx` renders the always-visible
  MonsterCard after the active pane in mobile normal flow.
- Current 390 px visual evidence shows the root workbench can extend thousands
  of pixels before Monster details.
- Workbench browser context already owns allowlisted pane routing and active
  title/focus behavior.
- The existing mobile result/navigation loop keeps the accepted tab order and
  should not be reopened.

## User promise

On mobile, a user can jump from Compare results to Monster details and return to
the same result/filter context without losing selection, scroll intent or active
pane state.

## Goals

- Add a mobile-only or mobile-prominent `Monster details` jump near Compare
  result context and target selection.
- Add a clear return action from MonsterCard back to the active pane's working
  point.
- Preserve accepted DOM order and desktop/compact-landscape three-zone shell.
- Ensure zero-result Compare states offer recovery and a route back to filters,
  not a dead end above a distant MonsterCard.
- Keep the current target, filters, sort, pane state and browser history policy
  unchanged unless the user explicitly changes pane.
- Prove containment and no overlap at 390, 620 and 768 CSS pixels.

## Non-goals

- Do not move MonsterCard before the active pane on mobile.
- Do not create a new pane id, persisted mobile mode, drawer, modal details
  clone or duplicate MonsterCard owner.
- Do not change Dense calculations, filters, saved setup comparison, target
  selection, pricing or result formulas.
- Do not claim assistive-technology evidence beyond the automated/browser
  checks actually run.

## Acceptance

- A mobile user can activate `Monster details`, reach the existing MonsterCard
  and return to Compare without losing Compare state.
- The return target is deterministic after filtering, sorting and selecting a
  new monster.
- Zero-result state exposes a visible filter recovery path and does not strand
  the user in a long page.
- Desktop and compact landscape layout remain visually equivalent except for
  any intentionally hidden mobile-only affordance.

## Implementation evidence

- Added a Compare-only mobile `Monster details` jump and a MonsterCard
  `Back to Compare` return anchor while preserving the accepted mobile order.
- Added a visible zero-result Compare recovery message adjacent to table/filter
  context.
- Focused checks passed:
  `npm run test -- src/tests/app-shell-components.test.tsx src/tests/compare-duel-panes.test.ts src/tests/monster-card-panel.test.ts src/tests/monster-card-view-model.test.ts`.
- `npm run typecheck` passed after implementation.
- The combined functional Chromium grep
  `npm run test:e2e -- --workers=1 --grep "Workspace backup|setup transfer|status|optimizer|Undo|mobile result and navigation loop|Compare|Trip|Loot optimizer|Loadout optimizer|Dense|Loot|hiscores"`
  passed 59/59 after implementation fixes.
- An allowed read-only `npm run test:e2e:visual` reached all 26 scenarios and
  exposed the stale pre-PF/pre-RP Darwin set. Its 26 first-mismatch pairs were
  reviewed before the initial candidate write; the update then exposed all 37
  tracked current-vs-HEAD pairs for review before final acceptance. The six
  `mobile-result-loop-*` and `mobile-navigation-loop-*` images plus the full
  mobile shell showed the intended jump/return route, unchanged pane order and
  horizontal containment at 390, 620 and 768 CSS pixels.
- `npm run test:e2e:visual:update` wrote the reviewed 37-image Darwin set. The
  update also incorporates the already accepted PF-01 through PF-06
  presentation changes that landed after the previous baseline commit, so it
  is not attributed only to RP-03/RP-05.
- After the final reviewed RP-05 correction, two independent complete
  read-only runs passed 26/26 and 26/26. No RP-03 clipping, overlap, lost
  control, document overflow or unintended desktop/compact-landscape
  affordance was found.

## Required checks

```sh
npm run test -- src/tests/app-shell-components.test.tsx src/tests/compare-duel-panes.test.ts src/tests/monster-card-view-model.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 --grep "mobile result and navigation loop|Compare"
npm run test:e2e:visual
git diff --check
```

The mobile screenshots were reviewed before the baseline update. Playwright
mobile WebKit remains engine evidence, not branded Safari or physical-device
evidence.

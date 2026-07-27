# Wide table discoverability specification

- Status: implemented
- Date: 2026-07-22
- Owner: shared table presenters and feature pane CSS
- Evidence: verified
- Contract: closed

- Priority: high
- Estimated effort: M
- Feature-inventory parents: Dense spreadsheet view, Loot/Economy summary,
  Setup comparison and Workspace backup/restore (`Valmis`)
- Depends on: implemented compact text readability, mobile result/navigation
  loop and visual regression suite

## Purpose

Make horizontally scrollable tables self-evident and keep identity/actions
usable on narrow screens.

Several existing tables are intentionally wider than mobile viewports. They
currently rely mostly on `overflow-x: auto` and minimum widths. That can be
technically responsive while still hiding the fact that more columns and row
actions exist off-screen.

## Verified current behavior

- Loot, Duel/setup review and dense comparison table wrappers use horizontal
  overflow with large minimum table widths.
- Existing visual baselines prove containment, but containment alone does not
  prove users can discover off-screen columns or keep row identity while
  scrolling.
- Sticky shell and pane behavior already have accepted viewport contracts; this
  polish must preserve them.

## User promise

When a table can scroll sideways, the UI makes that affordance visible and keeps
the row identity plus primary action understandable while the user reviews the
far columns.

## Goals

- Inventory horizontally scrollable table owners and classify which need cues,
  sticky identity columns, sticky action columns or only existing overflow.
- Add subtle overflow cues that appear only when more content exists in that
  direction.
- Keep the first identity column visible for Dense, Loot and setup/Workspace
  review tables where row context would otherwise be lost.
- Keep primary row actions reachable without forcing the user to memorize which
  row they are on.
- Preserve keyboard access, focus outlines, sort controls and existing table
  semantics.
- Prove no horizontal document overflow at 390, 620, 768, 844x390 and desktop
  widths.

## Non-goals

- Do not replace tables with card lists or remove columns.
- Do not change calculations, sorting semantics, row grouping, import review,
  persistence, PriceSet state or loot formulas.
- Do not add drag-only scrolling, custom scrollbars as the only cue or hidden
  controls that require hover.
- Do not change the accepted compact landscape scroll-owner contract.

## Acceptance

- Users can tell when a table has hidden left/right content.
- Row identity remains visible or otherwise continuously available when
  reviewing far-right values.
- Primary row actions remain discoverable and keyboard reachable.
- Existing visual baselines only change where the table cue/sticky behavior
  intentionally affects the owning screenshots.

## Implementation evidence

- Added horizontal overflow cues and sticky first-column identity behavior for
  Dense, Loot, setup/Duel review and Workspace review table wrappers.
- Kept table content, calculations, sort, import review and persistence
  behavior unchanged.
- Focused checks passed:
  `npm run test -- src/tests/compare-duel-panes.test.ts src/tests/loot-pane.test.ts src/tests/setup-import-review.test.tsx src/tests/workspace-backup-panel.test.tsx`.
- `npm run typecheck` passed after implementation.
- The combined functional Chromium grep
  `npm run test:e2e -- --workers=1 --grep "Workspace backup|setup transfer|status|optimizer|Undo|mobile result and navigation loop|Compare|Trip|Loot optimizer|Loadout optimizer|Dense|Loot|hiscores"`
  passed 59/59 after implementation fixes.
- An allowed read-only `npm run test:e2e:visual` reached all 26 scenarios and
  exposed the stale pre-PF/pre-RP Darwin set. Its 26 first-mismatch pairs were
  reviewed before the initial candidate write; the update then exposed all 37
  tracked current-vs-HEAD pairs for review before final acceptance. Dense desktop
  and tablet, Loot desktop/mobile/nested, Duel desktop/mobile and the mobile
  shell retained contained horizontal scrolling with visible identity and
  bounded edge cues.
- Review found one real RP-05 regression before final acceptance:
  `loot-nested-mobile.png` showed the outer sticky `Random herb` cell over the
  nested child identities. The open Loot detail now owns a higher, opaque
  stacking layer, restoring `CHILD` labels from Guam through Dwarf weed. A
  focused read-only Loot-mobile rerun verified the corrected candidate before
  the scoped Loot baseline write.
- `npm run test:e2e:visual:update` wrote the reviewed 37-image Darwin set. The
  update also incorporates the already accepted PF-01 through PF-06
  presentation changes that landed after the previous baseline commit, so it
  is not attributed only to RP-03/RP-05.
- Two independent complete read-only runs after the final correction passed
  26/26 and 26/26. No remaining table identity occlusion, document overflow,
  missing control or unintended calculation/content change was found.

## Required checks

```sh
npm run test -- src/tests/compare-duel-panes.test.ts src/tests/loot-pane.test.ts src/tests/setup-import-review.test.tsx src/tests/workspace-backup-panel.test.tsx
npm run typecheck
npm run test:e2e -- --workers=1 --grep "Dense|Loot|setup transfer|Workspace backup"
npm run test:e2e:visual
git diff --check
```

The visual diffs were inspected before the baseline write. The change preserves
the existing table markup and accessibility semantics; no separate semantic
exception was introduced.

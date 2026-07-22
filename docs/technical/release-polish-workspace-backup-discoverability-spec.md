# Workspace backup discoverability specification

- Status: implemented 2026-07-22
- Date: 2026-07-22
- Priority: critical
- Estimated effort: M
- Owner: ready app shell, Settings Workspace panel and file-transfer copy
- Feature-inventory parents: Workspace backup/restore, Basic combat setup,
  Setup comparison, Market price sync, Planner and Loot/Economy summary
  (`Valmis`)
- Depends on: the implemented Workspace backup/restore contract, truthful file
  export outcomes and transfer artifact clarity

## Purpose

Make the complete Workspace backup impossible to miss when a user is about to
export only a narrow setup artifact.

The app already has a full Workspace backup in Settings. The gap is that the
top-level setup transfer area can truthfully say setup exports are not full
Workspace backups while still leaving the full backup action several navigation
steps away. That creates a false-safety risk: a user can download a combat setup
and believe Planner state, saved Duel setups, Loot settings, prices, histories
or recovery-relevant local state are protected.

## Verified current behavior

- `src/app/components/shell/app-header.tsx` shows setup transfer scope copy and
  warns that setup files are not full Workspace backups.
- `src/app/components/settings/workspace-backup-panel.tsx` owns the existing
  full Workspace backup and restore actions.
- Workspace export already has a bounded envelope, privacy opt-in for last
  Hiscores player, review-before-restore and persistence-aware Undo.
- The header warning is informational only; it does not provide a direct action
  or focus route to the full Workspace backup owner.

## User promise

When a user sees setup export/import controls, the UI also gives a direct,
focus-safe route to the existing full Workspace backup action. The route makes
the distinction clear without adding another backup format or moving Workspace
ownership out of Settings.

## Goals

- Add a direct `Download full Workspace backup` route or action adjacent to the
  setup-file scope warning.
- If the action navigates to Settings, focus the Workspace backup heading or
  export action with the existing one-shot focus pattern.
- Preserve Workspace's existing Hiscores privacy opt-in copy and required area
  count.
- Keep setup export, saved setup export and Workspace backup labels distinct.
- Ensure the path works from desktop, compact landscape, portrait tablet and
  mobile layouts without hidden controls or horizontal overflow.
- Add focused component/view-model tests and one production-preview workflow
  that starts from the header setup transfer surface and reaches the Workspace
  backup owner.

## Non-goals

- Do not create a second Workspace backup button that bypasses the Workspace
  controller, registry, privacy option or filename/outcome contract.
- Do not include last Hiscores player by default.
- Do not merge setup files and Workspace files or change either envelope.
- Do not alter import parsing, restore planning, Apply, rollback or Undo.
- Do not add cloud sync, account storage, a database, provider integration or a
  new deployment shape.

## Acceptance

- The setup transfer surface has visible copy and an actionable route for users
  who want a full backup.
- Activating the route lands in Settings with the Workspace backup section
  visible and focus placed on the intended heading/control.
- The existing Workspace export action still owns its schema, privacy opt-in,
  filename and truthful download outcome.
- Automated coverage proves the route and focus behavior; browser evidence
  covers a narrow viewport.

## Implementation evidence

- Added a topbar `Download full Workspace backup` route that switches to
  Settings and focuses the existing Workspace export control.
- Updated `AppHeader`, Settings/Economy pane and Workspace backup panel
  component contracts without changing setup or Workspace file envelopes.
- Focused checks passed:
  `npm run test -- src/tests/app-shell-components.test.tsx src/tests/economy-settings-pane.test.ts src/tests/workspace-backup-panel.test.tsx src/tests/workspace-backup-controller.test.ts`.
- `npm run typecheck` passed after implementation.

## Required checks

```sh
npm run test -- src/tests/app-shell-components.test.tsx src/tests/economy-settings-pane.test.ts src/tests/workspace-backup-panel.test.tsx src/tests/workspace-backup-controller.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 --grep "Workspace backup|setup transfer"
git diff --check
```

Run the Settings desktop and mobile visual scenarios if layout changes affect
the header, Settings pane or Workspace panel.

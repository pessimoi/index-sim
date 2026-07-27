# Local-state attention surface specification

- Status: implemented
- Date: 2026-07-18
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

Make browser-local persistence and recovery problems visible from every main
workflow without weakening the existing recovery, privacy or migration policy.
The Settings recovery panel remains the only place that can inspect metadata,
export a report or clear affected keys. This goal adds a compact application-
level attention surface and a reliable route to that panel.

## Verified current behavior and problem

- `src/app/state/local-state-health.ts` produces a sanitized, allowlisted
  `LocalStateHealthReport` with `attentionCount`, per-item labels, statuses,
  expected/found versions and reasons. It never exposes raw persisted values.
- `src/app/controllers/local-state-recovery.ts` blocks persistence for invalid,
  unsupported or current-game-data-incompatible entries so safe in-memory
  defaults do not overwrite recoverable browser data.
- `src/app/components/settings/local-state-recovery-panel.tsx` renders the
  complete recovery UI only when Settings is active.
- `src/app/App.tsx` renders its general status string in a visually hidden live
  region. That region is useful to assistive technology after individual
  actions, but it is not persistent visual evidence of an unresolved local-
  state problem.
- A user can therefore continue in Stats, Loot, Planner or another pane using
  defaults while a stored setup or other state is blocked, without seeing why
  the earlier value did not load or why later edits may not survive reload.
- The existing controller specification intentionally scoped presentation to
  Settings. This is a new finishing goal, not a correction to that completed
  ownership refactor.

## Feature-inventory and decision boundary

This goal does not add a new product workflow. It improves the existing
`Valmis` local-state recovery and affected setup/Planner/loot/Duel/price
workflows. Their feature-inventory status remains `Valmis` until and after this
bounded quality change.

D-016 and D-030 remain authoritative: unsupported rewrite versions and legacy
state are not silently migrated. The attention surface must explain that safe
defaults are active and offer review; it must not imply that the app repaired,
converted or deleted the stored value.

## Goals

- Render one compact, persistent visual notice whenever the local-state health
  report needs attention.
- Distinguish an unusable stored value from unavailable browser persistence in
  plain language.
- Let the user open Settings and move keyboard focus directly to Local state
  recovery with one action.
- Keep the notice synchronized with clear, compatible replacement and later
  save outcomes through the existing controller snapshot.
- Preserve the metadata-only privacy boundary and the existing per-item and
  clear-all confirmations.

## Non-goals

- Do not migrate, repair, merge or reinterpret an older setup or any other
  stored payload.
- Do not change a storage key, envelope version, schema, size limit,
  compatibility rule, block/skip rule or clear policy.
- Do not auto-clear invalid, unsupported, legacy or unknown browser keys.
- Do not expose raw payloads, field values, raw errors, stack traces or absolute
  paths in the notice, DOM, export or test artifacts.
- Do not add a dismiss action while attention remains unresolved. Dismissing a
  data-integrity warning would recreate the current discoverability gap.
- Do not make simulation unavailable. Safe current-session defaults and edits
  continue to work under the existing recovery contract.
- Do not add telemetry, an account, cloud persistence or a server-side store.
- Do not redesign the full topbar, Settings pane or general notification
  system.

## Attention classification

Presentation must derive from structured report fields and controller state,
not from parsing existing English notices.

| Condition                                                                                                  | Attention kind | Primary copy                        | Required consequence                                                                     |
| ---------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| One or more items have invalid data, invalid JSON, duplicate keys, an oversized body or a version mismatch | `stored-data`  | `Local data needs review`           | `<N> saved areas could not be loaded. Safe defaults are active.`                         |
| Storage was unavailable at startup or a save failed                                                        | `persistence`  | `Changes may not persist`           | `Browser storage is unavailable, so current-session changes may be lost after reload.`   |
| Both conditions exist                                                                                      | `mixed`        | `Local data and saving need review` | `<N> saved areas could not be loaded, and current changes may not persist after reload.` |

`N` is `report.attentionCount`; it counts report items, not storage keys found
by scanning the browser. The view model may use each attention item's sanitized
`label` to produce a short secondary list when there are at most three items.
With more than three, show the count only. Never render `storageKey` or reason
codes in the global notice.

An ordinary missing optional state is healthy and creates no attention notice.
A recovery `notice` left by a successful clear/export is not by itself a reason
to keep the global attention surface visible after `report.hasAttention`
becomes false. Those action results stay in Settings and the existing global
status channel.

## Presentation contract

Create one pure application-level component, for example
`LocalStateAttentionBanner`, owned beside the existing app shell components.
It receives a presentation model and one `Review local data` callback. It does
not import storage, controller, schemas, tab state or browser adapters.

Render it inside the ready application shell after the primary header/topbar
and before pane navigation or pane content. It must remain visible regardless
of the active pane and must not be repeated inside every pane.

The compact surface contains:

- the bounded heading from the classification table;
- one consequence sentence;
- optional affected-area labels under the bounded rule above; and
- one `Review local data` button.

Do not add Clear, Replace, Export or migration actions to the banner. Destructive
or data-replacing actions remain in the detailed Settings panel with their
current confirmation and validation boundaries.

The banner has no close button and no persisted expanded/collapsed state. It
disappears only when a refreshed report no longer has attention.

## Navigation and focus contract

`Review local data` performs one composed UI transaction:

1. activate the existing Settings pane;
2. ensure the Local state recovery panel is rendered;
3. after that render, focus its `h2` or a dedicated heading target; and
4. scroll the target into view only when normal browser focus does not already
   reveal it.

The panel heading receives `tabIndex={-1}` and a stable app-internal ref or id.
Do not encode the action as a URL fragment, add history entries or persist the
active pane. The transaction must also work when Settings is already active.

If the report becomes healthy before the focus effect runs, cancel the pending
focus rather than focusing an absent element. Repeated clicks must remain safe.

## View-model and ownership contract

Add a pure builder near other app-shell presentation models, for example:

```ts
type LocalStateAttentionViewModel =
  | { visible: false }
  | {
      visible: true;
      kind: "stored-data" | "persistence" | "mixed";
      title: string;
      message: string;
      affectedLabels: readonly string[];
    };

function buildLocalStateAttentionViewModel(
  report: LocalStateHealthReport
): LocalStateAttentionViewModel;
```

The exact names may vary. Required invariants are:

- `visible` is equivalent to `report.hasAttention`, and a healthy model carries
  no invented attention kind or copy;
- the kind and consequence are derived from structured statuses/reasons;
- labels come only from allowlisted descriptors already present in the report;
- ordering follows the descriptor/report order and is deterministic; and
- no function in the presenter reads localStorage or parses persisted data.

`useLocalStateRecovery` remains the sole React-facing recovery controller.
`App.tsx` composes its current snapshot into the pure model and owns the
active-pane/focus transaction because those concerns already cross shell and
Settings boundaries. Do not move pane state into the recovery controller.

The existing `LocalStateRecoveryPanel` remains the detailed owner. Extend its
props only with the heading ref/focus target needed by the shell action. Its
table, export, clear and confirmation contracts stay unchanged.

## Refresh and lifecycle contract

- The initial ready render uses the controller's startup report. There must be
  no one-frame healthy state after the app has already identified attention.
- Runtime game-data compatibility blocks refresh the report through the
  current controller path and make the banner visible before normal
  persistence can overwrite those keys.
- Failed saves and clears update the same report and banner without a separate
  duplicate global-warning state.
- Confirmed clear and compatible replacement refresh the report. The banner
  updates or disappears from that new report.
- A successful session-only save while the startup storage boundary is
  unavailable remains a persistence warning; in-memory fallback success is not
  durable browser persistence.
- Ordinary simulation calculation, pane navigation and form edits do not
  refresh or re-announce the banner unless health state changes.

## Accessibility contract

- Use a labelled section or `aside` with visible text. Do not rely on color,
  an icon or the visually hidden global status alone.
- The first transition from no attention to attention may use a polite live
  announcement. Do not use `role="alert"` on a banner that persists and
  rerenders during normal app updates.
- The action is a native button with the accessible name
  `Review local data`.
- Focus must land on the detailed panel heading, not the first destructive
  button.
- The heading focus style must be visible and meet the existing app contrast
  conventions.
- Mobile layout must wrap copy and action without horizontal document
  overflow. The detail table may retain its existing bounded overflow behavior.

## Implementation sequence

1. Add pure view-model tests for stored-data, persistence, mixed, healthy and
   deterministic affected-label cases.
2. Add the pure banner component and responsive styles without changing the
   Settings panel behavior.
3. Compose the banner from the existing controller report in `App.tsx` or the
   app-shell boundary.
4. Add the Settings activation and post-render focus transaction.
5. Extend focused browser coverage for initial version mismatch, save failure,
   review navigation and resolution after clear/replacement.
6. Update feature documentation with implementation evidence only after the
   source change lands.

Likely implementation files:

- `src/app/App.tsx`;
- `src/app/components/app-shell.tsx` or a new shell-local banner component;
- `src/app/components/settings/local-state-recovery-panel.tsx`;
- a pure view-model module under `src/app/view-models`;
- `src/app/styles.css`;
- focused controller/view-model/component tests under `src/tests`; and
- the existing local-state Playwright coverage.

## Required tests and validation

Focused tests must prove:

- a version-mismatched `rewrite-setup` produces a visible stored-data banner
  while defaults remain active and the original key is not overwritten;
- unavailable storage and a runtime save failure produce persistence copy;
- mixed attention produces one banner rather than two competing notices;
- healthy and merely missing optional state produce no banner;
- affected labels are allowlisted, bounded and deterministic;
- `Review local data` activates Settings and focuses the recovery heading;
- clearing the last attention item removes the banner, while a failed clear
  keeps it visible;
- compatible setup/Duel replacement removes only the resolved item from the
  count; and
- the banner does not expose raw payload text, browser keys or raw errors.

Run at minimum:

```sh
npm run test -- src/tests/local-state-recovery-controller.test.ts src/tests/local-state-health.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "local state|unavailable game data|storage"
npm run build
git diff --check
```

Run the full production-preview browser suite and visual comparison because
this goal changes the always-visible application shell. Update visual baselines
only after human review confirms that the new attention state is intentional.

## Acceptance criteria

- Every ready app pane shows one persistent visual notice while
  `report.hasAttention` is true.
- The notice truthfully distinguishes unusable stored data from non-durable
  saving and states the user consequence.
- One keyboard-operable action opens Settings and focuses Local state recovery.
- No banner action can clear, overwrite, migrate or export user data.
- Invalid or incompatible data remains blocked and recoverable under the
  existing controller contract.
- The notice disappears only from a refreshed healthy report and never from a
  user dismissal.
- Healthy users see no new persistent UI.
- Metadata privacy, storage schemas, calculations, feature-inventory status and
  D-016/D-030 migration policy remain unchanged.
- Focused, architecture, build, browser, visual and diff checks pass.

## Implementation evidence

- `src/app/view-models/local-state-attention.ts` derives the stored-data,
  persistence and mixed variants only from the sanitized health report and
  bounds affected labels to three.
- `src/app/components/shell/local-state-attention-banner.tsx` renders the one
  non-dismissible ready-shell notice. `App.tsx` owns its Settings activation
  and post-render focus transaction, while the detailed recovery heading is a
  stable programmatic focus target.
- `src/tests/local-state-attention.test.tsx` covers healthy, stored-data,
  persistence, mixed, bounded-label and metadata-privacy branches. The focused
  persistence Playwright cases cover initial visibility, Settings focus,
  resolution after clear, runtime save failure and preservation of an
  unsupported setup envelope.
- The implementation changes no storage key, persistence version, schema,
  migration or recovery-controller ownership boundary.

## Open questions

None block implementation. Exact shell component and CSS class names may follow
the current app-shell structure as long as the ownership, placement, focus and
privacy contracts above are preserved.

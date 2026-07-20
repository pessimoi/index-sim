# Planner results-first and advanced gear-pool specification

Status: implemented on 2026-07-20.

Priority: high.

Estimated effort: M.

Implementation evidence: the pane now uses the specified semantic order and
one uncontrolled native disclosure. Focused pane/controller coverage passes
10/10, the functional Planner keyboard/persistence/mobile path and retained-
failure lifecycle path pass 2/2, the reviewed desktop/mobile visual comparisons
pass 2/2 and the complete repository gate passes 936/936 plus 19/19 goldens.

## Purpose

Make the existing Planner useful at first scan by placing its calculated
training result before the advanced gear-pool editor. The user should see the
plan summary, training order and unlocks after the target controls and explicit
`Recompute plan` action without first scrolling past every current gear-pool
choice.

This is a bounded information-architecture change to an existing workflow. It
does not add a Planner capability or change a calculation.

## Feature-inventory check

- Planner is `Valmis` in
  [the feature inventory](../product/feature-inventory.md). Its calculation,
  targets, explicit-Recompute boundary, lifecycle, Retry behavior and result
  surfaces are implemented.
- This goal does not reopen Planner parity or reimplement its workflow. It
  changes only the order and default visibility of existing presentation.
- Planner must remain `Valmis` during and after this work.
- D-047 future-gear scope, D-048 legacy Planner migration and D-051 requirement
  fallback policy remain unchanged.

## Verified current behavior and problem

`src/app/components/panes/planner-pane.tsx` currently renders one `Planner
controls` block in this order:

1. optimize metric, combat style, target and `Recompute plan`;
2. gear-mode toggles;
3. current-XP, target and lock controls; and
4. the complete `Planner gear pool editor`.

Only after that block does the pane render the calculation lifecycle message
and `Planner output`. The current Revision 274 default exposes all 41 gear-pool
choices before the first result summary. The editor is always expanded when it
exists.

The result itself is complete: summary, chart, gear timeline, training order,
unlock summary and warnings are present. The problem is their position. On a
narrow viewport in particular, the user's primary outcome—what to train and
what it unlocks—is buried below an advanced input surface.

The current pane also places stale, building and failed/Retry feedback between
the expanded editor and the output. Moving only the output without its
lifecycle message would separate the state explanation from the result it
qualifies.

## Goals

- Put the calculated Planner result before the advanced gear-pool editor.
- Make summary, training order and unlocks the result's first information
  group.
- Keep stale, building, failed and Retry feedback immediately adjacent to the
  result area.
- Put the gear pool in one collapsed-by-default native disclosure with a live
  selected/available count.
- Preserve every gear selection, per-slot Reset action and existing persisted
  state mutation.
- Keep the complete flow predictable with keyboard, focus navigation and
  screen-reader reading order.
- Preserve desktop viewport ownership and mobile width containment, with
  reviewed visual evidence at both sizes.

## Non-goals

- No Planner search, scoring, target, XP, unlock, eligibility, stance,
  requirement, truncation, chart, timeline or warning calculation change.
- No change to `PlannerUiState`, `PLANNER_UI_VERSION = 1`, storage keys,
  normalization, reconciliation, recovery or persistence timing.
- No change to the explicit `Recompute plan` commit boundary, automatic trigger
  policy, calculation Worker protocol, cancellation, source freshness, Retry or
  late-result rejection.
- No gear-pool option, allowed-pool, default-pool, current-revision or
  hypothetical-item policy change.
- No new App-owned open/closed state, persisted disclosure preference or view-
  model contract.
- No new result action that applies a training phase, level, loadout or unlock
  to the live setup.
- No general Planner redesign, new tab, modal, drawer or non-native custom
  disclosure component.
- No changes to archived `planner.jsx`, legacy runtime files, generated data,
  APIs, backend, auth or deployment.

## Required information order

The Planner pane must render its major regions in this semantic DOM order:

1. `Planner` heading and existing calculation status pill;
2. the existing level-reconciliation adjustment notice, when present;
3. `Planner controls`, including metric/style/target, gear-mode toggles, skill
   XP/targets/locks and the single existing `Recompute plan` action;
4. the result lifecycle message, when present;
5. `Planner output`, when a panel exists;
6. `Advanced gear pool · N/M`, when a gear-pool editor exists; and
7. the existing unavailable state when no result/editor can yet be built.

Within `Planner output`, use this primary-to-secondary order:

1. `Planner summary`;
2. `Planner training order`;
3. `Planner unlock summary`;
4. `Planner DPS chart` and `Planner gear timeline`; and
5. `Planner warnings`, when present.

The existing responsive two-column groupings may remain where space permits,
but CSS must not change the semantic reading order above. In particular, the
chart or gear editor must not occur between summary and training order in the
DOM.

The `Recompute plan` button remains the only calculation commit action. This
specification does not require duplicating or renaming it. Reordering markup
inside `Planner controls` is allowed only where needed to keep its visual and
keyboard sequence aligned with the result-first hierarchy.

## Result lifecycle adjacency

Keep `PlannerCalculationPresentation` and its existing fixed copy, roles,
politeness and Retry label unchanged. Presentation placement must satisfy these
states:

- `ready`: current output starts with the summary; no lifecycle message is
  inserted between result sections;
- `stale`: the last recomputed output remains visible and its stale message is
  immediately before that output;
- `building` with retained output: the building/previous-result message is
  immediately before the retained output;
- `failed` with retained output: the fixed failure message and `Retry plan`
  action are immediately before the previous output;
- first `building` or `failed` without output: the lifecycle surface occupies
  the result position after controls, and no empty `Planner output` wrapper is
  invented; and
- `idle`: the existing bundled-data unavailable copy remains truthful.

No advanced disclosure, chart, unrelated notice or empty spacer may occur
between a lifecycle message and the output it describes. The Planner heading's
status pill remains where it is; it does not replace the detailed lifecycle
message.

The existing input-reconciliation notice remains associated with controls near
the top of the pane. It must not be moved into the result lifecycle surface.

## Advanced gear-pool disclosure

When `model.gearPoolEditor` exists, render one native `details`/`summary`
disclosure after the complete result area.

The visible summary text is:

```text
Advanced gear pool · N/M
```

`N` is `totalSelectedCount` and `M` is `totalOptionCount`, formatted without
spaces around `/`. The current all-selected Revision 274 default therefore
reads `Advanced gear pool · 41/41`. The count is derived from the existing view
model and updates immediately after a checkbox or Reset action; `41` must not
be hard-coded.

The disclosure contract is:

- collapsed on its initial render and after a page reload;
- transient and uncontrolled unless a focused implementation need proves a
  local component state necessary;
- never written to browser storage and never added to `PlannerPaneModel`;
- not auto-opened by stale, building, failed, Retry, Recompute or result
  settlement transitions;
- absent when `model.gearPoolEditor` is `null`;
- opened and closed through native pointer, Enter and Space behavior; and
- labelled by visible summary content that exposes both purpose and count to
  assistive technology. Decorative punctuation may be hidden from speech, but
  the words and both counts must remain in the accessible name.

The summary replaces the current always-visible `Gear pool` title/count row.
Do not create a second competing disclosure title. Inside the open disclosure,
retain:

- the existing `Planner gear pool editor` accessible label for the option
  region;
- the existing canonical slot order and slot labels;
- each slot's selected/total count;
- every existing checkbox label and requirement hint;
- the rule that at least one option remains selected per edited slot;
- each slot's current Reset enabled/disabled behavior; and
- the current selected-value mutation and persistence path.

Closing the disclosure hides controls only. It does not reset, normalize,
recompute or otherwise change a gear selection. A gear-pool edit continues to
make the result stale through the existing draft-versus-computed lifecycle;
the disclosure does not trigger Recompute automatically.

## Keyboard, focus and accessibility contract

- The semantic reading order follows controls, lifecycle/result and then the
  advanced disclosure.
- The closed disclosure contributes exactly one sequential focus stop: its
  summary. Hidden gear checkboxes and Reset buttons are not tabbable.
- Enter and Space on the focused summary use native disclosure behavior.
- Opening keeps focus on the summary. The next forward Tab reaches the first
  existing gear-pool control in DOM order.
- Closing from the summary removes all descendants from sequential focus
  without moving focus elsewhere.
- Shift+Tab, checkbox activation and Reset retain normal native behavior.
- `Recompute plan`, result settlement, stale transitions and Retry must not
  steal focus or force-scroll the pane. Existing live-region feedback informs
  the user while focus stays on the initiating control.
- The changing `N/M` summary count does not require a new assertive live
  region. Checkbox checked state and the visible count provide the bounded
  feedback without announcing all Planner recalculations twice.
- Existing global `:focus-visible` treatment must remain visible on the
  disclosure summary, checkboxes and Reset buttons without layout shift.
- Heading levels, table names, chart image label and result-region labels
  remain valid after the move. Visual CSS ordering must not contradict DOM
  order.
- Escape is not introduced as a custom close shortcut for native `details`.

## Responsive and visual contract

At the existing 1440×1000 desktop visual viewport:

- the center pane remains the independent vertical scroll owner;
- result summary and the start of the primary training result are reachable
  before the closed advanced disclosure;
- opening the disclosure may extend the pane's internal scroll content but
  must not create document scrolling or overlap the MonsterCard rail; and
- existing tables keep their bounded horizontal overflow behavior.

At the existing 390×844 mobile visual viewport:

- controls, summary, training order, unlocks and the closed disclosure remain
  within the viewport width;
- the native summary and its count wrap or size without clipping or widening
  the document;
- opening the disclosure uses normal document flow and does not overlay
  results; and
- gear option labels, hints and Reset actions remain usable without horizontal
  page overflow.

The accepted implementation intentionally changes the Planner desktop and
mobile screenshots. Review the generated actual/diff images before updating
only the Planner-owned baselines. No unrelated visual baseline is authorized by
this specification.

## Ownership and implementation boundary

The expected source change is bounded to:

- `src/app/components/panes/planner-pane.tsx` for semantic ordering and the
  native disclosure;
- `src/app/styles.css` for result-first grouping and disclosure presentation;
- `src/tests/planner-pane.test.ts` for static DOM, state and ordering coverage;
- `src/tests/e2e/planner-duel.spec.ts` and the existing lifecycle browser suite
  for functional/keyboard behavior; and
- the two existing Planner visual scenarios and their reviewed platform
  baselines.

The existing `PlannerGearPoolEditorViewModel` already exposes all required
counts, slots, options and selection state. Do not change
`src/app/view-models/planner.ts`, `src/app/controllers/use-planner-calculation.ts`,
`src/app/state/planner.ts` or `src/app/App.tsx` unless implementation evidence
shows an otherwise-unsatisfied requirement. If that happens, update this
specification before broadening the change.

No result data may be duplicated into a new presentation object. No disclosure
state may become a new App/controller responsibility.

## Acceptance scenarios

### Default ready Planner

Given the generated runtime and current plan are ready, when the user opens
Planner, then:

- `Planner summary`, training order and unlock summary occur before `Advanced
gear pool · 41/41` in DOM and visual order;
- the result is visible;
- the disclosure is closed; and
- an option such as `Planner pool Iron scimitar` exists in the DOM only as
  hidden disclosure content and is not visible or tabbable.

### Advanced edit and persistence

Given the ready default Planner, when the user opens the disclosure and
unchecks one allowed item, then:

- the existing item mutation succeeds;
- the summary count changes from `41/41` to `40/41` for the current fixture;
- the Planner result becomes stale through the existing lifecycle;
- the last plan and stale message remain above the disclosure;
- closing and reopening keeps the selection; and
- reloading restores the existing persisted selection while the disclosure
  starts closed.

Per-slot Reset must restore that slot through the current action, update both
slot and disclosure counts and preserve its existing disabled state when the
slot is already complete.

### Recompute and failure

Given a stale plan, when the user activates `Recompute plan`, the focus remains
on that button while the adjacent result lifecycle moves through building to
ready. The disclosure does not open.

When a refresh fails after a prior success, the fixed failure copy and `Retry
plan` are directly above the labelled previous output. When the first build
fails, the same result position contains the failure/Retry surface without an
empty output. Retry preserves the existing task and freshness contract.

### Keyboard path

Given the disclosure is closed and its summary is focused, Enter or Space opens
it and the next Tab reaches the first gear control. Returning focus to the
summary and closing it removes all gear descendants from the next Tab sequence.
Focus is visibly styled throughout and no result update relocates it.

### Empty and unavailable states

A valid empty plan still renders summary plus the existing empty training,
unlock, chart and timeline copy before the advanced disclosure. When Planner is
unavailable and no gear editor exists, the existing unavailable copy renders
without an empty disclosure.

## Test and validation plan

Update the focused pane test to assert:

- the required major-region and internal result order;
- a native collapsed `details` element with dynamic `N/M` summary content;
- no `open` attribute by default;
- unchanged option labels, Reset actions, lifecycle roles/copy, warnings and
  empty/unavailable states; and
- omission when the editor model is null.

Update functional Chromium coverage to assert:

- results are visible while gear controls are initially hidden;
- pointer and keyboard opening expose the editor;
- selection, count, stale state, Recompute and per-slot Reset remain intact;
- reload keeps persisted gear state but collapses the disclosure;
- no hidden gear control participates in the closed Tab path;
- retained stale/building/failed output and Retry remain adjacent; and
- 390 px mobile content does not widen the page.

Use the existing deterministic `Planner desktop` and `Planner mobile` visual
scenarios. Run a read-only comparison first, review both Planner actual/diff
artifacts, explicitly update only the approved Planner baselines and rerun the
read-only suite.

Minimum implementation validation:

```sh
npm run test -- src/tests/planner-pane.test.ts src/tests/planner-controller.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 -g "recomputes the Planner|keeps Dense, Planner and Risk failures"
npm run test:e2e:visual -- --grep "Planner"
npm run verify
git diff --check
```

If approved screenshots need regeneration, use the explicit visual update
command only after reviewing the read-only diff. Verify the final git diff does
not contain unrelated baseline changes.

## Dependencies and risks

Dependencies:

- the current pure `PlannerPane` and its existing model/actions;
- `PlannerGearPoolEditorViewModel` counts and slot rows;
- the implemented Dense/Planner/Risk lifecycle; and
- the repository-local functional and visual Playwright infrastructure.

Primary implementation risks:

- accidentally separating stale/failed copy from retained output;
- using CSS `order` instead of semantic DOM order;
- turning disclosure state into persisted or App-owned state;
- losing existing gear option or Reset accessibility names;
- changing the current explicit-Recompute behavior while moving markup; and
- accepting unrelated visual baseline changes.

## Done criteria

- Planner status remains `Valmis` and all existing calculations/state schemas
  are unchanged.
- Summary, training order and unlocks precede the advanced gear editor in DOM,
  reading and visual order.
- `Advanced gear pool · N/M` is accurate, collapsed by default, keyboard-
  operable and transient.
- Gear selections, per-slot Reset, persistence, stale detection, Recompute and
  Retry behave exactly as before.
- Lifecycle feedback is immediately adjacent to the result it qualifies in
  every first-build and retained-result state.
- Desktop and mobile layouts are contained, and both Planner visual diffs have
  been explicitly reviewed.
- Focused tests, browser checks, full verification and `git diff --check` pass,
  or any environment limitation is recorded without claiming the missing
  evidence.
- Feature inventory remains `Valmis`; backlog status moves from `Specced` to
  `Done` only after implementation and evidence are complete.

## Open questions

None for the specified scope. Any request to remember disclosure state, move
gear choices into a modal/drawer or change Planner calculations requires a
separate product and persistence decision.

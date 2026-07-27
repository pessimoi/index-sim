# Accessibility and keyboard navigation specification

- Status: implemented
- Date: 2026-07-11
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

Remove the concrete keyboard barriers found in the current rewrite shell while
keeping the pass bounded and reviewable. This is an extension of existing
`Valmis` workbench and Compare workflows, not a claim of WCAG certification or
a redesign of every control.

## Feature-inventory check

- Basic combat setup and Dense spreadsheet view are `Valmis`.
- This goal does not reimplement either feature. It fixes navigation semantics
  and focus behavior around their existing controls.
- The gap was confirmed in code: Workbench “tabs” are plain pressed buttons,
  every Dense monster row is a Tab stop, the row focus style removes the
  outline, and no skip link targets the active workbench pane.

## Workbench tab contract

- The Workbench navigation uses `role="tablist"` and each existing tab button
  uses `role="tab"` with `aria-selected`, stable id and
  `aria-controls="workbench-active-panel"`.
- Only the selected tab is in the sequential Tab order.
- Left/Right arrows move with wraparound and activate the adjacent tab.
- Home/End activate the first/last tab.
- Mouse and touch behavior remain unchanged.
- The existing active-pane container is one dynamic `role="tabpanel"` labelled
  by the selected tab. Individual feature regions keep their existing labels.

## Skip link and focus visibility

- A first-focus `Skip to active workbench pane` link targets the dynamic panel.
- Activating it focuses the panel without changing the URL fragment reserved for
  shareable setup payloads.
- The link is visually hidden until keyboard focus.
- Buttons, links, inputs, selects, summaries and programmatically focusable
  controls get a consistent high-contrast `:focus-visible` outline.
- File-button labels reflect focus when their nested file input is focused.
- Focus styling must not change layout dimensions.

## Dense monster row contract

- The selected monster row is the only row in the normal Tab order.
- Up/Down arrows move focus between visible rows with wraparound without
  changing the selected target.
- Home/End move focus to the first/last visible row.
- Enter and Space retain the existing target-selection behavior.
- Mouse selection remains unchanged.
- Focused rows keep an obvious outline and do not depend only on background
  color.

## Scope exclusions

- No automated WCAG conformance claim, screen-reader certification or external
  audit.
- No keyboard shortcut registry, command palette or global hotkeys.
- No focus-trap rewrite for the native Share dialog; its existing modal,
  Escape-close, initial focus and focus-return behavior stay intact.
- No visual redesign, persisted-state change, domain calculation change,
  provider, auth, database or tenant work.

## Tests

- Playwright covers skip-link focus, tablist roles/roving tabindex, arrow and
  Home/End activation, active-panel labelling, Dense row roving focus and
  Enter selection.
- Existing mouse/touch workflow tests remain the regression baseline.
- Typecheck, full verification and `git diff --check` remain required.
- The browser test checks the computed outline on a keyboard-focused Dense row
  so a future style edit cannot silently remove it.

## Current browser-context extension

PF-06 keeps the same roving tab and skip-link contract while making activation
browser-history aware. Click, Arrow/Home/End and mobile More choices use the
typed user source and push one entry only when the pane changes. Popstate does
not generally move focus; if focus belonged to the pane being hidden, the new
active tab receives focus after rendering. Ready titles provide pane/target
context without a new live region. The three-engine CB-09 extension covers
keyboard activation, Back/Forward and reload; this remains automated behavior
evidence, not a screen-reader certification claim.

## Documentation

- Add this specification to the documentation map.
- Update architecture, UI parity, testing, feature-inventory notes and backlog
  evidence without changing existing feature statuses.
- Record the accepted keyboard interaction boundary as D-070.

## Done criteria

- Workbench tabs and Dense rows are efficient and predictable from a keyboard.
- Focus is visible throughout the bounded workflow.
- The active pane can be skipped to directly.
- Existing click behavior, formulas, state schemas and security boundaries are
  unchanged.
- Validation passes, then this goal is committed and pushed before Goal 4.

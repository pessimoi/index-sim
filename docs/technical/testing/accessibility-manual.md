# Manual assistive-technology runbook

This runbook owns the repeatable human evidence procedure for the bounded
AT-01 through AT-12 release matrix in
`src/tests/e2e/accessibility-manifest.ts`. Automated axe, component, keyboard
and reflow checks are prerequisites; they are not screen-reader evidence or a
conformance certificate.

## Required environments

Run both environments against the same reviewed production artifact:

1. stable Safari on macOS with VoiceOver; and
2. NVDA on Windows with a supported browser, preferring stable Firefox.

Record the date and exact OS, browser, engine and screen-reader versions. Use
only the repository's public deterministic fixtures. Do not record a real
player name, private setup values, raw imported JSON or browser-profile data.

## Prerequisites

```bash
npm ci
npm run typecheck
npm run test -- src/tests/accessibility-manifest.test.ts src/tests/searchable-select-field.test.tsx src/tests/numeric-field-components.test.tsx src/tests/app-shell-components.test.tsx
npm run test:a11y
npm run build
```

Run the artifact through the supported local preview or the exact candidate
deployment. Do not use live Hiscores or market providers. The automated
manifest must have no undispositioned finding before manual evidence begins.

## Procedure

For every manifest row, follow its `entry`, `expectedOutcomes`,
`announcements` and `manualSteps` in order. Start a row from its named clean
fixture and viewport. Complete the workflow without sight or pointer, then
record concise semantic observations for:

- landmarks, headings and navigation order;
- control role, name, value and state;
- instructions and errors;
- dynamic outcome announcements and duplicate speech;
- table and chart comprehension;
- popup or dialog focus lifecycle; and
- successful completion of the user outcome.

Do not require exact synthesized speech. Pass when the role, name, value,
state, relationship and outcome are understandable. Mark a row `fail` when a
user cannot discover, operate or understand an in-scope outcome. Mark it `not
run` when the named environment was unavailable; never substitute a DOM or
Chromium inspection.

For the shared searchable selector, explicitly verify that the closed control
is announced as a button with its selected value, opening focuses an editable
combobox, arrow keys change the active option without moving DOM focus, the
settled count and zero-result state are understood, Enter commits, Tab exits
without trapping and Escape returns to the trigger.

For reflow, repeat AT-01, AT-02, AT-10 and AT-12 at 200% browser zoom and at a
320 CSS-pixel equivalent. Data tables may scroll in their labelled container;
ordinary controls, instructions, focus indicators and action outcomes must
remain available without document-level horizontal scrolling.

## Evidence record

Append the completed table and observations to
`docs/project/testing-evidence.md`:

| Row   | VoiceOver / Safari          | NVDA / browser              | Observation or defect    |
| ----- | --------------------------- | --------------------------- | ------------------------ |
| AT-01 | `pass`, `fail` or `not run` | `pass`, `fail` or `not run` | Concise semantic outcome |
| AT-02 |                             |                             |                          |
| AT-03 |                             |                             |                          |
| AT-04 |                             |                             |                          |
| AT-05 |                             |                             |                          |
| AT-06 |                             |                             |                          |
| AT-07 |                             |                             |                          |
| AT-08 |                             |                             |                          |
| AT-09 |                             |                             |                          |
| AT-10 |                             |                             |                          |
| AT-11 |                             |                             |                          |
| AT-12 |                             |                             |                          |

List every defect with an owner and follow-up reference. A supported-release
statement remains blocked until all 24 cells pass or an explicit dated release
exception is accepted. Do not use “WCAG certified”, “fully accessible” or an
unbounded product-wide conformance claim.

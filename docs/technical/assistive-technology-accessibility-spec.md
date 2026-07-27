# Assistive-technology accessibility evidence specification

- Status: implemented
- Date: 2026-07-21
- Owner: shared UI primitives, feature presenters and browser test owners
- Evidence: manual-gate-open
- Contract: living

- Priority: high
- Estimated effort: L
- Feature-inventory parents: all current rewrite workflows (`Valmis`)
- Depends on: implemented keyboard/focus contract and current production-preview
  browser fixture

## Purpose

Turn the existing keyboard-focused accessibility work into a repeatable
assistive-technology evidence gate for the release-critical rewrite journeys.

The app already had a skip link, roving Workbench tabs, visible focus,
accessible numeric validation, labelled regions, tables, charts and bounded
live regions. The implementation now adds a deterministic automated
accessibility layer and repairs the shared defects it found. Documentation
still stops short of a screen-reader review or WCAG claim because the required
VoiceOver and NVDA runs have not been performed.

This goal audits and repairs the current user journeys against a bounded WCAG
2.2 Level AA target, records real screen-reader results and makes regressions
detectable. It does not present an automated scan as certification.

## Standards boundary

Use the current [W3C WCAG 2 overview](https://www.w3.org/WAI/standards-guidelines/wcag/)
and the dated WCAG 2.2 Recommendation linked from it as the normative success-
criterion source. W3C encourages use of the latest WCAG 2 version; WCAG 2.2 is
the selected project baseline at specification time.

Use the [WAI-ARIA Authoring Practices combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
and the corresponding tabs, dialog, listbox and grid/table guidance as design
guidance for custom widgets. APG examples are implementation guidance, not a
replacement for testing the app with actual user agents and assistive
technologies.

The release statement may say:

> The listed release-critical journeys were reviewed against WCAG 2.2 Level AA
> and passed the recorded automated, keyboard and screen-reader checks.

It must not say “WCAG certified”, “fully accessible” or claim product-wide
conformance unless a separately scoped conformance audit covers every page,
state, supported user agent, third-party surface and documented exception.

## Verified current behavior and gaps

- `docs/technical/accessibility-keyboard-spec.md` owns implemented skip-link,
  roving-tab, Dense-row and focus-visible behavior, but explicitly excludes
  screen-reader certification and WCAG conformance.
- `src/tests/e2e/shell-accessibility.spec.ts` verifies semantic roles, names,
  keyboard paths and focus styling in Chromium without an accessibility audit
  engine.
- `@axe-core/playwright` is lockfile-pinned and `npm run test:a11y` owns a
  deterministic production-preview gate over the typed AT-01 through AT-12
  manifest.
- Shared numeric fields already connect invalid state and feedback through
  `aria-invalid` and `aria-describedby`.
- Several workflows expose `role="status"`, `aria-live` and `role="alert"`, but
  there is no journey-level proof that announcements are timely, non-duplicated
  and meaningful when using a screen reader.
- The shared searchable selector now uses a native closed button and gives the
  focused search input the combobox label, expanded/autocomplete/listbox and
  active-descendant relationships. Options have stable ids, remain outside the
  tab order and return focus to the trigger after commit or Escape.
- Automated checkpoints and existing functional tests cover the named table,
  chart, modal, review and error surfaces in the manifest. Manual table/chart
  comprehension remains unverified until both screen-reader runs complete.
- Charts use accessible image labels in several areas, but equivalent numeric
  content and announcement behavior are not covered as one cross-feature
  contract.
- The native Share dialog and multiple inline review states have focused tests
  and zero-finding axe checkpoints, but no real assistive-technology navigation
  record.

## Feature-inventory check

No missing product feature is introduced. This is a cross-cutting quality pass
over workflows already marked `Valmis`.

All parent feature statuses remain `Valmis`. A future implementation may close
individual accessibility defects without treating a parent workflow as
unimplemented. Any journey that cannot meet the target must be recorded as an
explicit release exception or blocker rather than hidden by changing its
feature status.

## Goals

- Define an exact release-critical journey and state matrix.
- Meet the applicable WCAG 2.2 Level A and AA criteria in that matrix.
- Repair the shared searchable selector to expose one coherent focused
  combobox contract while preserving its visible workflow.
- Give every control, region, dialog, data table, chart and error in scope a
  meaningful programmatic relationship.
- Make dynamic results and action outcomes understandable without creating
  announcement noise.
- Add automated accessibility scans as a deterministic regression layer.
- Record manual keyboard, VoiceOver and a second screen-reader/browser review
  with versioned evidence.
- Preserve calculation, state, storage, privacy and deployment behavior.

## Non-goals

- Do not claim legal compliance, external certification or exhaustive product-
  wide conformance.
- Do not redesign the visual identity, information architecture or domain
  workflows solely to match an APG example.
- Do not add speech synthesis, a custom screen-reader mode, accessibility
  preferences, keyboard shortcut registry or hidden duplicate application.
- Do not replace native buttons, inputs, selects, headings, tables or dialog
  semantics with ARIA when native HTML already supplies the contract.
- Do not require exact screen-reader speech strings; wording varies by platform
  and version. Evidence records the understood role, name, value, state and
  outcome.
- Do not make every calculation update an assertive live announcement.
- Do not expose raw imported JSON, player data, setup values or exception text
  in accessibility-only nodes.
- Do not change simulation formulas, Worker messages, persistence schemas,
  backend boundaries or supported product scope.

## Release-critical journey matrix

The audit manifest must cover each row in its named default, success, empty and
error/review states where applicable.

| ID    | Journey                      | Required states and interactions                                       |
| ----- | ---------------------------- | ---------------------------------------------------------------------- |
| AT-01 | Startup and shell            | startup status, skip link, landmarks, headings, Workbench tab changes  |
| AT-02 | Player and combat setup      | numeric edit/error, native selects, searchable item/monster selection  |
| AT-03 | Stats and active assumptions | result change, warnings, Reset review and Undo                         |
| AT-04 | Monsters / Dense table       | table navigation, sorting, row selection, empty filtering              |
| AT-05 | Saved setups and comparison  | save, rename error, diff, import review, Merge/Apply outcome           |
| AT-06 | Loot and Trip                | drop actions, nested tables/disclosures, no-data and warning states    |
| AT-07 | Risk and Cannon              | calculation/building, unavailable/error and reset feedback             |
| AT-08 | Planner                      | target edit, building/result, chart/table, issue disclosure/action     |
| AT-09 | Economy                      | snapshot/provenance, manual price error, PriceSet import/export review |
| AT-10 | Settings                     | backup/restore review, local-state recovery, destructive confirmation  |
| AT-11 | Hiscores                     | unavailable, validation error, lookup failure and successful preview   |
| AT-12 | Share and fatal recovery     | native modal open/close/focus return, invalid share and safe session   |

Tests use deterministic local fixtures. They must not depend on a live Hiscores
or market provider, external network, Cloudflare account or private browser
profile.

Maintain the matrix as a typed or JSON test manifest owned by the functional
browser suite. A row may link several existing focused tests, but every row
must identify:

- the fixture and viewport;
- the initial focus/navigation entry;
- expected role/name/value/state outcomes;
- required announcements;
- automated scan checkpoints;
- manual screen-reader steps; and
- any accepted exception with owner and review date.

## Semantic contracts

### Page structure and navigation

- The page has one clear level-one heading and a logical heading hierarchy.
- Banner, navigation, main, complementary and labelled feature regions remain
  discoverable without duplicating landmark names.
- The first sequential focus target remains **Skip to active workbench pane**.
- Workbench tabs keep the implemented tablist/tab/tabpanel relationship,
  roving focus and selected-state announcements.
- Changing tabs must not move focus unexpectedly or expose hidden pane controls
  in the accessibility tree.
- Focus must remain visible and not be fully obscured by sticky or compact
  surfaces at all release viewports.
- Pointer targets satisfy WCAG 2.2 AA target-size requirements or a documented
  criterion exception.

### Searchable selector

Keep the visible closed trigger and searchable popover, but give the focused
elements coherent roles:

1. The closed trigger is a native button, not a `combobox`. It exposes the
   field's name, selected value in its accessible name or description,
   `aria-expanded` and `aria-controls`.
2. Opening the popup moves focus to the search input as today.
3. The search input owns `role="combobox"`, the field label,
   `aria-expanded="true"`, `aria-controls`, `aria-autocomplete="list"` and
   `aria-activedescendant` only while a real option is active.
4. The popup owns `role="listbox"`; each candidate owns `role="option"`, a
   stable id and selected state. DOM focus stays on the combobox input while
   arrow keys move the active descendant.
5. Arrow keys, Home/End, Enter and Escape preserve current behavior. Escape and
   committed selection return focus to the trigger. Tab follows the documented
   close-and-continue behavior without trapping focus.
6. Filtering announces one bounded result-count change after input settles;
   it does not announce every option's hidden technical id.
7. The zero-result state is programmatically related to the combobox and Enter
   performs no action.

If browser/assistive-technology evidence shows this split trigger/input design
is not reliably understood, the implementation may use one always-present
editable combobox input. That is a visual-scope change and requires updating
this specification and reviewing affected baselines before implementation.

### Forms, errors and destructive reviews

- Every input has a visible label or an equivalent programmatic name that does
  not conflict with its visible text.
- Help, units, bounds and error messages are connected with stable ids through
  `aria-describedby` where understanding depends on them.
- Invalid fields use `aria-invalid`; errors identify the field and correction
  without exposing schema paths or exception text.
- Submission/action failures use `role="alert"` only when immediate
  interruption is warranted. Routine state and success use a polite status.
- A confirmation/review identifies the affected object, consequences and
  primary/destructive action before mutation.
- Focus moves to the first invalid field or review heading only where the
  existing workflow explicitly changes context; otherwise it remains on the
  initiating control.

### Dynamic results and live regions

- One user action produces at most one primary outcome announcement. Mirrored
  status text must not create duplicate live-region speech.
- Continuous calculation changes are not announced for every keystroke. Announce
  a short settled result/status only after valid committed input or an explicit
  action, using the existing bounded calculation status owner.
- Loading/building, success, warning and failure states remain distinguishable
  by text and semantics, not color alone.
- Repeated identical statuses are not forced to re-announce.
- Hidden panes, stale requests and dismissed reviews cannot announce.
- The Global Undo announcement identifies the action that can be undone and
  expires with the visible Undo surface.

### Tables, charts and technical data

- Every in-scope data table has a unique accessible name using a caption or
  `aria-labelledby` to its visible heading. `aria-label` is acceptable only
  when it does not duplicate or contradict visible text.
- Column and row headers use native `th` with correct `scope` or explicit
  associations when nested structure makes scope insufficient.
- Sort buttons expose column name and current direction. Row selection and
  expansion expose state without relying on CSS.
- Nested Loot tables have distinct names and do not repeat an indistinguishable
  generic table announcement.
- Chart SVGs expose a concise name and description; decorative marks are hidden
  from the accessibility tree.
- Every decision-relevant chart value remains available in the adjacent table,
  list or textual summary. A screen-reader user need not infer values from an
  SVG path.
- Raw ids and source metadata remain in labelled technical disclosures rather
  than being injected into ordinary accessible names.

### Dialog and focus lifecycle

- The Share surface remains a native modal dialog with a programmatic name and
  description.
- Opening establishes an intentional initial focus; sequential focus stays in
  the modal; Escape and Close dismiss it; focus returns to the invoking control.
- Background content is not interactive or exposed as modal content while the
  dialog is open.
- Import/replacement reviews that are inline rather than modal remain labelled
  regions and must not claim dialog semantics.

## Visual and cognitive checks in scope

For the journey matrix, verify:

- text and non-text contrast at the WCAG 2.2 AA thresholds;
- content at 200% text zoom and browser zoom without loss of controls;
- reflow at 320 CSS px equivalent where the existing responsive contract
  permits horizontal data-table scrolling;
- focus visibility and non-obscuring behavior;
- operation without color-only, hover-only or pointer-gesture-only meaning;
- no unexpected context change on focus or field edit;
- reduced-motion preference for any non-essential animation; and
- status and instruction copy that names the action and consequence plainly.

The existing 390, 620 and 768 px viewports remain required product evidence.
Add the WCAG reflow setup separately if device scale/zoom is needed to reach a
320 CSS px equivalent without distorting the established visual baselines.

## Automated accessibility gate

Add the maintained Playwright integration for axe-core (or an equivalently
reviewed engine) as a development dependency. Pin it through the lockfile and
run its WCAG 2 A/AA tags against stable checkpoints for every AT matrix row.

Rules:

- Scan the production-preview DOM after loading/building states settle.
- Scan modal/review/open-popover states separately because hidden default DOM
  cannot prove them.
- Disable a rule only with a narrow selector, documented false-positive reason,
  owner and revisit date. No suite-wide silent exclusions.
- Treat `serious` and `critical` violations as release blockers. Review and
  either fix or explicitly disposition every lower-impact result.
- Store a concise text/JSON summary as test evidence, not screenshots or HTML
  dumps containing setup/player values.
- Do not snapshot the whole accessibility tree; assert stable semantic
  relationships and user outcomes.

Automated scans do not replace keyboard, visual, unit or manual screen-reader
tests. They also cannot prove announcement timing or usable reading order.

## Manual assistive-technology evidence

Run the matrix with both:

1. macOS VoiceOver in the stable Safari version corresponding to the supported
   WebKit release; and
2. NVDA on Windows with one supported browser, preferring Firefox to diversify
   engine and accessibility-API coverage.

Record operating system, browser, browser engine, screen reader and versions at
run time. If the second environment is temporarily unavailable, the release
record must say `not run` and the owning backlog/release gate remains open; a
Chromium-only DOM inspection is not equivalent evidence.

For each matrix row, record pass/fail and concise observations for:

- landmarks/headings and navigation order;
- control role, name, value and state;
- instructions and errors;
- dynamic outcome announcement;
- table/chart comprehension;
- popup/dialog focus lifecycle; and
- completion of the user outcome without sight or pointer.

Do not record personal data or exact private setup values. Use only committed
public fixtures. Do not make exact synthesized wording a pass condition when
the semantic outcome is correct.

## Testing ownership

- Shared primitive semantics: component tests beside `form-fields.tsx` and
  shared presenters.
- Feature-specific names, descriptions and live regions: the nearest pane,
  view-model or controller suite.
- Cross-feature keyboard and automated scan journeys:
  `src/tests/e2e/shell-accessibility.spec.ts` plus focused owner files where a
  state is expensive to construct.
- Manual run sheet and dated outcomes: `docs/project/testing-evidence.md`, with
  stable procedure and matrix ownership in `docs/technical/testing.md` or its
  UI/browser child guide.
- Visual contrast/reflow evidence: current read-only visual project; baseline
  updates follow the existing explicit review policy.

## Required tests

At minimum prove:

- the searchable trigger/input/listbox relationships and full keyboard
  lifecycle in component and Playwright tests;
- unique names and header relationships for every table in the matrix;
- chart name/description plus equivalent accessible values;
- numeric and file/import errors are related to their controls and announced
  once;
- Workbench tab changes exclude hidden pane controls and stale announcements;
- Share dialog initial focus, modal containment, Escape, Close and return focus;
- Reset/Import/Merge/Restore destructive reviews expose consequences before
  action;
- axe scans have zero undispositioned serious/critical violations at all
  manifest checkpoints;
- 200% zoom, 320 CSS px reflow and existing product viewports retain all
  controls and focus visibility; and
- VoiceOver/Safari and NVDA/supported-browser manual rows are recorded.

## Validation commands

The automated implementation uses these exact scripts:

```bash
npm run typecheck
npm run test -- src/tests/accessibility-manifest.test.ts src/tests/searchable-select-field.test.tsx src/tests/numeric-field-components.test.tsx src/tests/app-shell-components.test.tsx
npm run test:a11y
npm run test:e2e
npm run test:e2e:visual
npm run architecture:check
npm run build
git diff --check
```

Add a named accessibility script such as `npm run test:a11y` for the manifest
scan instead of hiding it inside an unrelated test command. It must run locally
and against the deterministic production preview without live providers.

The manual assistive-technology record is an additional release check and
cannot be represented by a passing npm command.

## Implementation record

Implemented on 2026-07-21:

- exact typed AT-01 through AT-12 manifest plus completeness tests;
- dedicated production-preview axe configuration and `npm run test:a11y`;
- native trigger / focused input / listbox searchable-selector semantics with
  settled count and zero-result relationships;
- screen-reader-readable metric text without prohibited ARIA naming;
- keyboard-focusable Stats/result and Economy trend scroll regions;
- corrected saved-setup and Loot supporting-text contrast;
- deterministic 320 CSS-pixel / 200% text reflow coverage; and
- a versioned VoiceOver/Safari and NVDA/browser manual runbook.

The automated matrix passes without rule exclusions or lower-impact
dispositions. An additional in-app browser inspection confirmed the Weapon
popover's focused combobox, expanded trigger, visible bounds and Escape focus
return without changing its selection. This is not screen-reader evidence.

Manual status on 2026-07-21 is `not run` for all AT-01 through AT-12 rows in
both required environments. The completion criteria and bounded release
statement therefore remain open. Follow
[the manual runbook](testing/accessibility-manual.md) before changing this
status.

## Completion criteria

- The exact AT-01 through AT-12 manifest is checked in and owned.
- Applicable WCAG 2.2 A/AA defects found in those states are fixed or recorded
  as explicit release blockers/exceptions.
- The searchable selector exposes a coherent focused combobox pattern verified
  with both target screen readers.
- Automated scans pass without broad rule suppression.
- Keyboard, zoom/reflow, contrast, table/chart and modal contracts pass.
- VoiceOver/Safari and NVDA/browser evidence is dated and reproducible.
- Release wording remains bounded to reviewed journeys and does not claim
  certification.
- Calculation, persistence, privacy, provider and deployment behavior remain
  unchanged.

## Open questions

None for specification. The exact OS, browser and assistive-technology version
numbers are evidence-time facts and must be recorded by the implementer rather
than frozen here.

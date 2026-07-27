# UI, state and browser testing

- Status: implemented
- Date: 2026-07-27
- Owner: technical testing
- Evidence: verified
- Contract: living

This guide owns current UI, controller and browser validation routing. Dated
results, screenshots and platform limitations belong in
[testing evidence](../../project/testing-evidence.md).

## Unit and component owners

- Pure state/controller changes: run their focused core, hook and view-model
  suites.
- Pane or shell changes: include the pane presenter, app-shell component and
  directly composed view-model suites.
- Persistence or transfer changes: include parser, review, transaction,
  rollback, attention and Undo owners for the affected area.
- Shared numeric inputs: include numeric field core/components, numeric audit
  and goldens when effective values can change.

Use `npm run test -- <focused files>`, then run `npm run test` before
delivery. Component tests prove semantics and intent wiring; they do not replace
browser evidence for focus, history, downloads, storage events or layout.

## Functional browser coverage

- Chromium functional suite: `npm run test:e2e`.
- Release engine matrix: `npm run test:e2e:cross-browser`.
- Combined browser release line: `npm run test:e2e:release`.

Use a focused Playwright grep while iterating, then run the owning complete line
for a delivered workflow. Browser tests mock same-origin integrations and must
reject unexpected live external requests.

Firefox and Playwright WebKit evidence is engine-level coverage. It does not
prove branded Safari, a physical iOS device or assistive-technology behavior.

## Accessibility

- Automated browser accessibility: `npm run test:a11y`.
- Manual VoiceOver/Safari and NVDA/browser: follow
  [the assistive-technology runbook](accessibility-manual.md).

Automated scans, keyboard tests and semantic component assertions are necessary
but do not close the manual screen-reader gate. Record the environment, result
and unresolved findings in a dated evidence page.

## Visual regression

- Read-only comparison: `npm run test:e2e:visual`.
- Intentional baseline update: `npm run test:e2e:visual:update`.

Never update baselines merely to make a failure disappear. Inspect actual,
expected and diff images, limit writes to the changed visual owner and rerun the
read-only suite. Local Darwin baselines are not a remote merge gate.

## Workflow routing

- Navigation, focus or browser history: run the shell/context unit owners and
  the matching functional browser transaction.
- Download or import: prove actual browser dispatch, accepted legacy filename
  behavior, review-before-apply and truthful success/failure feedback.
- Cross-tab or storage recovery: use a real multi-page or failure-injection
  browser path in addition to controller tests.
- Lazy pane or failure isolation: cover initial request, first activation,
  retained revisits, sanitized failure and retry/reload behavior.
- Responsive or wide-table CSS: cover the affected compact/portrait/landscape
  viewports and the read-only visual owner.

If visible behavior, persisted state or a required run assumption changes,
update product/architecture/operations documentation with the same change.

# MetricList presenter hygiene specification

Status: implemented in Goal 4, 2026-07-13. The two controller specifications
remain separate later goals.

## Purpose

`MetricList` is exported with a React-component name but is currently a plain
function taking an array and is invoked directly from JSX. It is also housed in
`combat-result-presenters.tsx` even though `App.tsx` uses it for metric groups
across several workbench features.

This is not a known user-visible defect. It is a small API and ownership smell:
the name says component, the call contract says render helper and the current
file says combat-specific even though the presenter is generic. The goal makes
those three signals agree without changing rendered DOM.

## Current behavior to preserve

- `DisplayMetric` contains `label`, `value` and an optional `tone` class.
- Every item renders one sibling `<div className="metric">` keyed by label.
- Each row contains the label in `<span>` and value in
  `<strong className={tone}>`.
- `MetricList` adds no DOM wrapper.
- Callers control their surrounding summary/grid class and item order.
- There are currently two direct calls in
  `combat-result-presenters.tsx` and nine in `App.tsx`.
- Existing strings, formatted values, tones, order, class names and responsive
  layout are compatibility contracts.

## Goal

- Make `MetricList` a normal React component with an explicit props object.
- Move the generic presenter and `DisplayMetric` type to
  `src/app/components/app-presenters.tsx`.
- Convert every direct function call to JSX component composition.
- Preserve the exact emitted DOM and all caller-owned metric construction.

## Non-goals

- Do not create a metric view model, configuration registry or design system.
- Do not rename CSS classes or change metric copy, precision, tone or order.
- Do not add a wrapper element, memoization, animation or conditional hiding.
- Do not move calculation or formatting logic into the component.
- Do not combine this change with result-pane extraction, CSS cleanup or either
  controller goal.

## Target contract

`src/app/components/app-presenters.tsx` owns:

```tsx
export interface DisplayMetric {
  label: string;
  value: string;
  tone?: string;
}

export function MetricList({ items }: { items: readonly DisplayMetric[] }) {
  return (
    <>
      {items.map((item) => (
        <div className="metric" key={item.label}>
          <span>{item.label}</span>
          <strong className={item.tone}>{item.value}</strong>
        </div>
      ))}
    </>
  );
}
```

The implementation may introduce a named `MetricListProps` interface, but the
public input remains a readonly `items` array. The fragment is required to keep
the current no-wrapper DOM contract.

`combat-result-presenters.tsx` imports the generic component from
`app-presenters.tsx`. `App.tsx` imports it from the same owner. Calls become:

```tsx
<MetricList items={summary} />
<MetricList items={[/* existing inline rows unchanged */]} />
```

No call site may invoke the exported component as `MetricList(...)`.

## Implementation sequence

1. Move `DisplayMetric` and `MetricList` to `app-presenters.tsx` with the props
   contract above.
2. Convert the two combat presenter calls and nine `App` calls to JSX.
3. Remove the old export and update imports.
4. Format and validate the unchanged presenter output across the complete
   browser suite because the shared helper appears in several tabs.

## Required validation

No new test framework or snapshot is needed for this mechanical change. Run:

```sh
npm run typecheck
npm run architecture:check
npm run lint
npm run format:check
npm run test:e2e -- --workers=1
npm run verify
git diff --check
```

Existing functional Playwright assertions provide broad metric-rendering
coverage. No golden or visual baseline update is expected; a DOM, layout,
numeric, screenshot or copy delta is a regression signal.

## Acceptance criteria for the implementation goal

- `MetricList` has a props-object component API and a readonly item contract.
- The generic presenter/type live in `app-presenters.tsx`; the combat presenter
  module is only a consumer.
- All eleven current call sites use JSX and preserve their arrays unchanged.
- The rendered DOM has the same sibling metric rows and no new wrapper.
- No copy, formatting, tone, order, CSS, state, adapter or calculation changes.
- Typecheck, architecture, lint, formatting, full browser and repository gates
  pass.
- Composition-root documentation records the completed hygiene goal and its
  actual evidence.

## Implementation evidence

- `DisplayMetric` and the props-based `MetricList` now live in
  `src/app/components/app-presenters.tsx`.
- `src/app/components/combat-result-presenters.tsx` is a consumer rather than
  the generic presenter's owner.
- All eleven consumers use `<MetricList items={...} />`; no direct
  `MetricList(...)` invocation remains.
- The component returns a fragment and retains the exact sibling `.metric`,
  `span` and `strong` DOM contract.
- Typecheck, the 68-module architecture graph, ESLint and repository-wide
  Prettier checks pass with zero cycles and zero architecture exceptions.
- The complete production-preview Chromium gate passes 76/76, including shared
  metric rendering across setup, Stats, Special, Cannon, Trip, Planner and
  fixture-backed numeric paths.
- `npm run verify` passes 624 unit tests, 19 explicit legacy goldens,
  architecture, typecheck, production build/artifact budgets, lint, format and
  diff checks. The 10-file/two-asset artifact is 1,939,428 bytes with SHA-256
  `fb376bc3a342857ed4b7d1f507b543330b85cb308e12bc5ab9f23e2bd1a77c4f`;
  dependency audit was skipped under the documented network-disabled policy.

## Open questions

None. This goal intentionally chooses a real component API rather than renaming
the function to a lowercase render helper because it is exported and composed
as shared React presentation.

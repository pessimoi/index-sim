# Numeric input draft and validation specification

- Status: implemented
- Date: 2026-07-18
- Owner: technical documentation
- Evidence: verified
- Contract: living

## Purpose

Let users edit numeric values as text without the app rewriting the field after
every keystroke. A numeric field must distinguish the user's temporary draft
from the last accepted calculation value, explain invalid input inline and
apply normalization only under an explicit, consistent contract.

## Prior behavior and problem

- `src/app/components/form-fields.tsx` owns `NumberField`, `DecimalField` and
  `OptionalNumberField`.
- `NumberField` calls `parseInt`, clamps to `min`/`max` and falls back to the
  current value on every input event.
- `DecimalField` parses, clamps and rounds to `step` on every input event.
- `OptionalNumberField` immediately maps an empty string to `null`; otherwise
  it parses and clamps on every input event.
- Required fields therefore cannot remain temporarily empty while a value is
  replaced. Out-of-range text silently becomes a boundary value, malformed
  text silently becomes the old value and decimal input can be rounded before
  the user finishes typing.
- None of the shared fields renders `aria-invalid`, an inline constraint
  message or a clear distinction between the displayed draft and the value
  currently used by calculations.
- These components are reused across Player levels, loadout, Trip, Cannon,
  Risk, Loot, Planner, manual prices and manual combat overrides. Fixing an
  individual pane would leave inconsistent behavior elsewhere.

## Implemented contract

- `numeric-field-core.ts` is the pure ASCII syntax, finite-range and
  step-alignment authority. It rejects malformed, overlong and off-step drafts
  without clamping, rounding or falling back.
- `use-numeric-draft-field.ts` owns the shared draft/accepted-value lifecycle
  for required integer, required decimal and optional fields. Literal text is
  retained during focus; Enter/blur canonicalizes, Escape restores and a
  different external prop cancels a stale focused draft with a polite status.
- The three shared fields use text inputs with `numeric` or `decimal`
  `inputMode`, because Chromium number inputs cannot retain required drafts such
  as `1.`. Existing bounds, steps, labels and caller state remain unchanged.
- Invalid visible text is explicitly marked as not applied with
  `aria-invalid`, an inline message and an `aria-describedby` relationship.
  Optional empty text reaches caller state only on commit; Reset remains
  immediate.
- Focused core/component coverage passes 20/20. The production-preview numeric
  workflow covers required, decimal and optional inputs, external reset,
  keyboard behavior, persistence and 390 px containment. Numeric audit passes
  5,958 comparisons with zero mismatches, architecture is cycle-free at 131
  modules and all 19 goldens pass.

## Feature-inventory boundary

This goal is a shared input-quality change across existing `Valmis` workflows.
It does not change any domain formula, schema, default, allowed numeric range or
feature status. Pane-specific semantic changes, including
[Planner Current XP](planner-xp-target-integrity-spec.md), are specified
separately and consume this shared field contract.

## Goals

- Preserve the literal draft string while a user is editing.
- Allow normal transitional states such as empty text, a sign and a trailing
  decimal separator without replacing them immediately.
- Emit only finite values that satisfy the field's integer/decimal, range and
  step contract.
- Never clamp, round or fall back silently.
- Show concise inline feedback whenever the visible draft is not applied.
- Support keyboard commit/revert and synchronize safely with setup loads,
  resets and other external prop changes.
- Keep a pure parser/validator directly testable without a new React testing
  dependency.

## Non-goals

- Do not change any current `min`, `max`, `step`, default or persisted numeric
  value as part of the shared component refactor.
- Do not accept locale-specific commas or grouped numbers in this phase. The
  canonical edit syntax remains ASCII digits, optional `-` where permitted and
  `.` for decimals.
- Do not accept exponent notation, `Infinity`, `NaN`, hexadecimal or trailing
  units.
- Do not add formatted thousands separators inside editable inputs.
- Do not debounce or otherwise change non-numeric controls.
- Do not add a form library, global validation store or whole-page submit step.
- Do not move calculation validation out of domain schemas; UI validation is
  an earlier usability boundary, not a replacement for trusted domain checks.
- Do not automatically focus an invalid field during ordinary simulation or
  pane navigation.

## Numeric syntax contract

Define the accepted lexical forms before numeric conversion.

### Integer fields

A complete integer is:

```text
-?[0-9]+
```

The leading minus is allowed only when `min < 0`. A leading plus, decimal
separator, exponent and whitespace are rejected. Leading zeros are accepted
during editing and canonicalized on Enter/blur. `0` remains valid when the
configured range includes it.

### Decimal fields

A complete decimal is:

```text
-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)
```

`.5` is accepted and canonicalized to `0.5` on Enter/blur. A trailing dot such
as `1.` is an allowed transitional draft but is not complete until a following
digit is entered. Leading zeros are likewise accepted and canonicalized. Limit
the draft to 64 characters before parsing so extremely long pasted text cannot
create unnecessary work.

### Transitional drafts

The following may remain visible while focused even though they are not
applied:

- an empty string;
- `-` when negative values are allowed;
- a complete integer plus trailing `.` for a decimal field; and
- any bounded prefix that may still become a valid canonical number.

Other malformed text may also remain long enough to show an error, but it is
never emitted to the caller. A browser may prevent some invalid characters in
`type="number"`; the validator must still be authoritative for paste,
programmatic tests and browser differences.

## Validation result contract

Create a pure helper with an equivalent result type:

```ts
interface NumericFieldConstraints {
  kind: "integer" | "decimal";
  min: number;
  max: number;
  step?: number;
  optional: boolean;
}

type NumericDraftResult =
  | { status: "transitional" }
  | { status: "accepted"; value: number | null; canonical: string }
  | {
      status: "invalid";
      reason: "syntax" | "too-long" | "below-min" | "above-max" | "step";
      message: string;
    };
```

Required validation order:

1. enforce the 64-character bound;
2. classify optional empty or a transitional prefix;
3. validate canonical integer/decimal syntax;
4. convert with `Number()` and require a finite result;
5. compare with inclusive `min` and `max`; and
6. validate step alignment when `step > 0`.

Step alignment is relative to `min`, matching the HTML input model:

```text
(value - min) / step
```

Treat the quotient as aligned when it is within `1e-9` of an integer. Do not
round an off-step value. Return `Use increments of <step>.` and keep the last
accepted calculation value.

Invalid constraints (`min > max`, non-finite bounds or non-positive explicit
step) are programmer errors. Fail in development/tests and do not attempt to
repair them from user input.

## Edit-session contract

Each shared field owns two separate values:

- `draft: string`: what the input displays; and
- `acceptedValue: number | null`: the latest prop value known to be in the
  application's state.

### Focus and typing

- On focus, start an edit session from the canonical current prop value.
- Every input event updates `draft` exactly; do not immediately replace it
  with a parsed number.
- If the draft is complete, finite, in range and step-aligned, call `onChange`
  when its numeric value differs from the last emitted value. Keep the literal
  draft so typing `0.50` does not instantly collapse to `0.5`.
- Transitional or invalid drafts call no change callback. Show
  `Not applied — <reason>` once the draft is known invalid. A merely empty or
  prefix draft may remain neutral while the user is still typing.
- For an optional field, empty text becomes an accepted `null` only on Enter or
  blur. This prevents a select-all-and-replace gesture from transiently
  clearing the domain state.

### Enter, blur and Escape

- Enter validates the current draft. A valid value is emitted if necessary and
  canonicalized for display. Optional empty emits `null` and shows the
  placeholder. Invalid/transitional required input remains visible and shows
  `Not applied — enter a value from <min> to <max>.`
- Blur performs the same validation, but does not steal focus back. Invalid
  text remains visible with the explicit `Not applied` message so the input
  cannot pretend that the displayed value drives calculations.
- Escape restores the last accepted prop value, clears the inline message and
  calls no change callback. Stop propagation only when needed to prevent an
  enclosing dialog from also treating the same Escape as dismissal.

A valid value may already have been emitted during typing. Enter/blur must not
emit a duplicate callback.

### External prop changes

Setups, imports, resets and domain actions can change `value` while a field is
mounted.

- When the field is not focused, synchronize `draft` to every new prop value.
- While focused, retain lexical formatting when the new prop equals the value
  last emitted by this field.
- If a different external value arrives while focused, cancel the stale draft,
  synchronize to the new prop and expose a polite `Value updated by another
action.` status. The user's later blur must not overwrite that newer value.
- When a field becomes disabled, cancel its draft, synchronize to the prop and
  clear validation feedback.
- Changing constraints revalidates the draft. The field never mutates the
  caller merely to fit a new range; the pane/domain owner must explicitly
  normalize any now-invalid accepted state.

## Field-specific behavior

### `NumberField`

- Uses `kind: "integer"` and `optional: false`.
- Adds `step={1}` explicitly.
- Empty and sign-only drafts are transitional; blur/Enter makes them invalid.
- Decimal syntax is rejected, never truncated with `parseInt`.

### `DecimalField`

- Uses `kind: "decimal"` and `optional: false`.
- Honors its existing step without rounding.
- Preserves trailing zeros during focus and canonicalizes on Enter/blur.

### `OptionalNumberField`

- Selects integer or decimal validation from `step === 1` only for backward
  compatibility with current call sites. Prefer an explicit future `kind` prop
  if a step-1 field needs non-integer values.
- The Reset button immediately emits `null`, cancels the draft and remains the
  clearest explicit way to return to a derived value.
- Empty input emits `null` on Enter/blur as described above.
- Add an optional `disabled` prop for parity if implementation evidence shows a
  caller needs it; do not invent a disabled state in existing panes.

## Presentation and accessibility contract

All three components keep a native input, associated `<label>`, current
`min`/`max`/`step` attributes and existing field layout classes. Add a stable
description/error id per field.

- Invalid or unapplied input sets `aria-invalid="true"` and
  `aria-describedby` to the inline message.
- Constraint/helper text may be supplied by a pane through a new optional
  `description` prop and shares `aria-describedby` without duplicating ids.
- Error copy is visible and does not rely on red color alone.
- Use a polite status only when an external action replaces an active draft.
  Do not place every keystroke in a live region.
- Mobile numeric keyboards should remain available through `type="number"`
  and appropriate `inputMode`. If cross-browser testing proves `type="number"`
  prevents required draft syntax, use `type="text"` plus `inputMode="numeric"`
  or `"decimal"`; the pure validator remains authoritative.
- Preserve browser spinner/arrow behavior when `type="number"` is retained.
  Spinner changes update the draft and follow the same acceptance rules.

Bounded copy:

| Reason                                | Message                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| required empty/transitional on commit | `Not applied — enter a value from <min> to <max>.`                                             |
| malformed syntax                      | `Not applied — enter a whole number.` or `Not applied — enter a number using a decimal point.` |
| below minimum                         | `Not applied — minimum is <min>.`                                                              |
| above maximum                         | `Not applied — maximum is <max>.`                                                              |
| step mismatch                         | `Not applied — use increments of <step>.`                                                      |
| too long                              | `Not applied — value is too long.`                                                             |

Use existing number formatting for bounds only when it does not introduce
locale separators that the input syntax itself rejects.

## Persistence and calculation contract

- Persistence effects and calculation requests continue to consume caller
  state only. Draft strings never enter `CombatSetupFormState`, Planner state,
  PriceSet state, `SimulationRequest` or a storage envelope.
- A valid emitted value follows the current state-update and recalculation path.
- An invalid draft leaves the last accepted caller value active. The visible
  `Not applied` message is required evidence of that distinction.
- Reload shows only the last accepted persisted value; drafts and validation
  messages are session presentation state and are not persisted or shared.
- Domain schemas remain the final guard for imported/programmatic values.

## Implementation sequence

1. Add pure lexical/range/step validator tests, including floating-point edge
   cases.
2. Introduce one internal `useNumericDraftField` hook shared by all three
   components; do not copy lifecycle logic three times.
3. Convert `NumberField`, then `DecimalField`, then `OptionalNumberField`,
   running focused browser cases after each conversion.
4. Add inline error/helper styles and responsive checks.
5. Characterize every current call site and confirm that its existing bounds,
   steps and null semantics remain unchanged.
6. Remove `numberValue`, `decimalValue` and `stepDecimalValue` only after no
   caller depends on their silent coercion.

Likely implementation files:

- `src/app/components/form-fields.tsx`;
- an optional pure `src/app/components/numeric-field-core.ts`;
- `src/app/styles.css`;
- a new focused numeric-field core test;
- component/server-render tests where useful; and
- focused Playwright coverage across Player, Trip, Planner and manual price.

## Required tests and validation

Pure and browser tests must prove:

- required fields can be cleared and replaced without snapping back;
- `-` and `1.` remain transitional only where allowed;
- integer fields reject rather than truncate decimals;
- bounds are inclusive and out-of-range drafts are visible but not applied;
- step-aligned decimals such as `0.50` emit `0.5` while preserving the draft
  during focus;
- off-step decimals are not silently rounded;
- optional select-all-and-replace does not transiently emit `null`, while blur
  on empty and Reset do;
- Enter canonicalizes, Escape restores and invalid blur remains visibly marked
  as not applied;
- external setup/load/reset changes cancel a stale focused draft safely;
- no `NaN`, infinity, exponent or draft string reaches state/domain callbacks;
- existing valid Player, Trip, Cannon, Risk, Loot, Planner and manual-price
  edits still update calculations and persistence; and
- keyboard, screen-reader relationships and narrow viewport wrapping work.

Run at minimum:

```sh
npm run test -- src/tests/numeric-field-core.test.ts src/tests/numeric-field-components.test.tsx src/tests/planner-ui-state.test.ts src/tests/planner-ui-adapter.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "numeric input|Food/kill|Manual price|Current XP"
npm run test:golden
npm run build
git diff --check
```

The implementation may use the actual new focused test filename. Run the full
functional browser suite because the shared components appear in every main
workflow. Golden numeric outputs must remain unchanged for the same accepted
input values; no visual baseline update is expected unless inline-error states
are added to captured screenshots.

## Acceptance criteria

- Users can type, clear and replace numeric text without per-keystroke clamping,
  fallback or decimal rounding.
- Only complete finite in-range step-aligned values reach caller state.
- Every visible invalid value explicitly says it is not applied and exposes an
  accessible error relationship.
- Enter, blur, Escape, Reset and external value changes follow one documented
  contract across all numeric fields.
- Drafts never enter persistence, shares, domain requests or computed output.
- All existing bounds, schemas, defaults, calculations and accepted-value
  outputs remain unchanged.
- Focused, architecture, type, golden, build, full browser and diff checks pass.

## Open questions

None block implementation. Locale-aware numeric editing can be considered only
as a separate product decision because display locale and accepted edit syntax
must change together.

# Price warning relevance and presentation specification

- Status: implemented
- Date: 2026-07-17
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

Keep the D-085 price-provenance reliability signal without presenting normal
price uncertainty as a prominent repeated failure. A price notice must answer
two separate questions truthfully:

1. Does this price affect the current monetary result?
2. If it does, is the condition an active calculation issue or only a data
   confidence note?

The result area should interrupt the primary workflow only for active missing
or explicit fallback values. Ordinary provenance and freshness notes belong in
one complete, collapsed Economy disclosure and, where useful, beside the
affected Loot row.

## Verified current behavior and problem

- `src/domain/trip/index.ts` emits structured money warnings for missing,
  aliased, generated, retained and unknown-freshness prices.
- Price metadata does not change numeric formulas. Generated, retained,
  legacy-static and unknown prices remain usable under D-085.
- `CalculationWarningSummary` shows four messages followed by plain `N more`
  text. The overflow text is not interactive, so the complete list cannot be
  opened.
- The same `moneyWarnings` collection is rendered in the shared Result area,
  Loot and Economy. It also creates a `Price confidence` row in Active
  assumptions.
- Loot price metadata warnings are currently collected before the selected
  row action is resolved. A market-price warning can therefore enter the
  aggregate result list even when the row is ultimately `Bury`, `Skip` or
  `Alch` and that market price does not contribute to the displayed GP totals.
- Runtime-generated `coins = 1` metadata currently produces a generated
  object-cost warning even though one coin is exact face value rather than a
  market-priced item.
- User-facing messages expose internal ids such as `bronze_longsword` and
  technical source terminology before they explain the consequence for the
  current result.

The current list is therefore technically informative but over-prominent,
duplicated and not consistently scoped to values that affect the result.

## Goals

- Preserve structured price provenance and missing-value diagnostics.
- Emit aggregate current-result notices only for prices consumed by the active
  monetary calculation.
- Separate calculation issues from non-blocking confidence notes.
- Remove the full price-warning list from the shared Result area and Loot pane.
- Keep the complete relevant list available in one collapsed Economy
  disclosure.
- Make every overflow item reachable without a non-interactive `N more`
  truncation.
- Use item display names and plain consequence-first copy.
- Keep all numeric results, price selection, persistence and provider policy
  unchanged.

## Non-goals

- Do not change any item price, alch value, drop rate, loot action, supply
  quantity, GP formula or optimizer decision.
- Do not make uncertain prices unavailable or block simulation.
- Do not add a live market request, provider, database, account history or
  scheduled workflow.
- Do not expand the market allowlist or invent observation timestamps.
- Do not add a calculated GP-confidence score or estimate exact GP uncertainty
  in this phase.
- Do not redesign non-price combat, setup-requirement or special-attack
  warnings.

## Terminology and classification

`Affects the current result` means that the numeric lookup is an input to at
least one active current-result monetary value: GP/kill, gross or net GP/hr,
effective GP/hr, supply cost/kill or a displayed active Loot action value. A
price used only to display an alternative action or an inactive row does not
meet this definition.

Presentation classification is independent of the existing domain severity:

| Warning code or condition                 | Presentation class | Shared Result        | Economy disclosure | Affected Loot row         |
| ----------------------------------------- | ------------------ | -------------------- | ------------------ | ------------------------- |
| `missing-price` for an active value       | Calculation issue  | Compact count/action | Full detail        | `Missing price`           |
| `missing-alch-value` for active alching   | Calculation issue  | Compact count/action | Full detail        | `Missing alch value`      |
| `price-fallback-used` for an active value | Calculation issue  | Compact count/action | Full detail        | `Fallback used`           |
| `price-generated-fallback`                | Confidence note    | Hidden               | Full detail        | `Estimated price`         |
| `price-market-retained`                   | Confidence note    | Hidden               | Full detail        | `Previous price retained` |
| `price-freshness-unknown`                 | Confidence note    | Hidden               | Full detail        | `Price date unknown`      |
| `price-alias-used`                        | Confidence note    | Hidden               | Full detail        | `Related item price`      |
| `approximate-data-source`                 | Confidence note    | Hidden               | Full detail        | `Approximate source`      |
| `unidentified-herb-price-approximation`   | Confidence note    | Hidden               | Full detail        | `Estimated herb price`    |

Only rows with `affectsCurrentResult = true` enter the Result or Economy
aggregate collections. Row-local notes may still explain a displayed price for
an inactive alternative, but they must not claim that it affects the current
totals.

## Used-value relevance contract

The Trip calculation must distinguish an active monetary input from a lookup
performed for row presentation or an alternative action. Relevance must be
recorded at the calculation/lookup call site; the UI must not infer it by
parsing English warning messages.

At minimum, a structured price notice must retain:

- warning code and domain severity;
- supplying `itemId` when the notice is item-scoped;
- consumer scope: Loot, supply or cannon;
- whether it affects the current monetary result; and
- `lootRowId` when the notice belongs to a current-monster drop row.

Exact type placement may follow existing domain boundaries, but these fields
must survive composition into the app view model. `CalculationWarningViewModel`
must not discard the item identity needed to resolve a display name.

### Loot actions

- `Loot`, `Value` and `Unid` collect notices only for the exact prices used by
  their selected valuation path, including contributing nested table rows.
- `Alch` collects the selected alch value and nature-rune price notices. The
  item's unused market sale price is not an aggregate current-result notice.
- `Bury` and `Skip` do not collect the item's market price into aggregate
  current-result notices.
- A missing price remains a calculation issue even when the fallback makes the
  resulting value zero; the missing lookup itself changed the active valuation
  path.
- Price metadata used only to choose or display another available action may
  appear as a row-local note, clearly scoped as an alternative, but not in the
  current-result aggregate.

### Supplies and cannon

- Food, potion, ammo, rune, recoil and cannonball notices enter the aggregate
  only when the configured item and a non-zero active consumption/cost path
  contribute to the current result.
- High alch being enabled is not enough to activate a nature-rune notice when
  there are no alch casts.
- Cannonball notices are inactive when cannon is disabled or the current
  cannon calculation consumes no balls.
- A configured but zero-use food or supply row may retain local detail in its
  owning pane, but it is not a current-result price notice.

### Coins

When the supplying `coins` value is exactly `1`, suppress generated,
freshness, retained and alias market-provenance notices. One coin is face value,
not a market observation. Missing or otherwise unusable coin data must still
use the existing missing/fallback path. This exception changes warning
presentation only; it must not normalize a non-1 PriceSet value or change any
numeric formula. Face-value validation beyond this bounded exception is a
separate decision.

## Presentation view-model contract

Price-specific presentation should have one direct owner, preferably the
existing `src/app/view-models/price-data.ts`, while
`src/app/view-models/simulation.ts` only composes its result. The model should
separate aggregate issues, aggregate notes and row-local notes, for example:

```ts
interface PriceDataNotice {
  code: string;
  itemId?: EntityId;
  itemLabel: string;
  level: "issue" | "note";
  consumer: "loot" | "supply" | "cannon";
  affectsCurrentResult: boolean;
  lootRowId?: string;
  summary: string;
  detail: string;
}

interface CurrentPriceNoticePresentation {
  issues: readonly PriceDataNotice[];
  notes: readonly PriceDataNotice[];
  all: readonly PriceDataNotice[];
  byLootRowId: Readonly<Record<string, readonly PriceDataNotice[]>>;
}
```

The exact exported names may be refined. The required boundary is structured
data rather than string parsing or DOM inspection.

Resolve primary labels in this order:

1. current drop/nested-row display name;
2. `GameDataSnapshot.items[itemId].name`;
3. another validated game-data label; and
4. a humanized id only as a final fallback.

Primary copy must use `Bronze longsword`, not `bronze_longsword`. The technical
id may appear as secondary diagnostic text inside the expanded Economy detail,
but never as the only user-facing label.

Deduplicate by warning code plus supplying item id and consumer/row context.
Sort deterministically: calculation issues first, then generated, retained,
unknown-freshness, alias and approximation notes; sort equal-priority rows by
display label. Do not sort by an invented monetary impact.

## Shared Result contract

- Remove the full `CalculationWarningSummary` money-warning list from the
  shared Stats/Compare result area.
- Do not add advisory price notes to Active assumptions. Remove the current
  always-present `Price confidence` row rather than duplicating the Economy
  disclosure.
- When there are no active calculation issues, render no price notice in the
  shared Result area.
- When one or more active calculation issues exist, render one compact neutral
  section such as:

  `Price data incomplete — 2 active values use missing or fallback prices.`

- Include one `Review price data` button. It activates Economy, opens the
  current price-data disclosure and moves focus to its summary.
- Do not render item-by-item messages, advisory counts or `N more` in the
  shared Result area.
- The compact issue is not a blocking alert. It must not use `role="alert"` or
  re-announce on every ordinary simulation recalculation.

Special-attack, setup-requirement and negative-net-GP guidance remain under
their existing contracts.

## Loot contract

- Remove the aggregate `Loot price warnings` block.
- Attach a short note to the affected row's existing Price/Details area; do not
  add another table column.
- Use the bounded labels in the classification table. The row detail explains
  the consequence in one sentence and can expose source/freshness detail on
  demand.
- Nested/composite price notes stay with the nested contributor that supplied
  the value rather than being presented as an unrelated parent-item warning.
- Rows with `Bury` or `Skip` may describe their displayed alternative price,
  but the wording must not say it affects current GP.
- Supply-only and cannon-only notices do not appear in the Loot table.

## Economy contract

- Economy is the single aggregate owner for current calculation price detail.
- Render one native `details` element labelled `Price data notes (N)`, collapsed
  by default during ordinary navigation.
- `N` counts all deduplicated current-result calculation issues and confidence
  notes. If `N` is zero, omit the disclosure; the existing PriceSet/provenance
  summaries remain sufficient positive-state evidence.
- Expanding the disclosure shows every item. Do not slice to four rows or end
  with passive `N more` text.
- Each row shows the display name, bounded label and a consequence-first
  explanation. Technical origin, observation/evaluation time and item id may
  be secondary detail.
- The explicit Result `Review price data` action opens this disclosure even
  though ordinary Economy navigation keeps it collapsed.
- Native disclosure state is session presentation state only. Do not persist
  it, add it to setup/share schemas or migrate it from legacy storage.

The disclosure must not use `role="status"`; changing combat inputs should not
cause the full note list to be repeatedly announced. Native summary keyboard
behavior, visible focus, focus transfer from `Review price data` and complete
screen-reader names are required.

## State, calculation and ownership boundaries

- `src/domain/trip` owns whether a lookup contributes to the active monetary
  calculation and retains structured consumer/row context.
- `src/domain/economy` remains the exact-first PriceSet lookup and metadata
  owner.
- `src/app/view-models/price-data.ts` owns classification, item labels, bounded
  copy, ordering and Result/Economy/row groupings.
- `src/app/view-models/simulation.ts` composes the price-notice presentation
  without repeating its rules.
- Pure Result, Loot and Economy components render the model and emit intent
  callbacks only.
- `App.tsx` may coordinate the one-shot `Review price data` tab/open/focus
  action. It must not classify warnings or inspect their message strings.
- No PriceSet, manual-price, history, setup, loot-preference or request schema
  changes are permitted.

## Implementation sequence

1. Add focused domain tests that expose inactive-row and face-value noise.
2. Move warning emission to active valuation/consumption points while keeping
   row-local metadata available separately.
3. Preserve structured item, consumer, impact and row context through the full
   simulation result.
4. Build one price-notice presentation model with user-facing labels and
   classification.
5. Replace the Result and Loot aggregate lists with the compact issue and
   row-local contracts.
6. Add the complete collapsed Economy disclosure and explicit Review focus
   path.
7. Update owning product, parity, architecture, decision and testing docs with
   actual implementation evidence.

## Required tests

### Domain and view-model

- Default-buried bones do not create an aggregate market-price notice.
- Skipped loot does not create an aggregate market-price notice.
- Alched loot reports only active alch/nature-rune inputs, not an unused sale
  price.
- An active generated price remains a confidence note.
- An active missing price or explicit fallback becomes a calculation issue.
- Exact `coins = 1` does not create a market-provenance note.
- Active supply and cannon prices are included; configured zero-use paths are
  excluded.
- Nested/component notices retain the correct item and Loot row context.
- Item ids resolve to display labels without message parsing.
- Ordering and deduplication are deterministic.

### Component and browser

- Result shows no advisory list and no price Active-assumptions row.
- Result shows one compact issue only for active missing/fallback conditions.
- `Review price data` activates Economy, opens the disclosure and focuses its
  summary.
- Loot has no aggregate warning block and exposes row-local notes in the
  existing Price/Details area.
- Economy starts collapsed, expands with keyboard input and reveals every
  deduplicated note.
- No passive `N more` text remains on a price notice surface.
- Raw ids are absent from primary visible copy when a display label exists.
- Existing imported-PriceSet browser coverage is updated from three duplicate
  warning assertions to the new Result/Loot/Economy ownership contract.
- Accessibility coverage verifies native disclosure semantics, focus transfer
  and the absence of repeated live-region announcements.

### Numeric regression

Warning-only changes must leave combat, trip, loot, supply, Planner, Risk and
golden numeric outputs unchanged. Any numeric snapshot delta is a regression
and must not be accepted under this specification.

## Validation for implementation

Run at minimum:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/trip-loot-supply.test.ts src/tests/loot-view-model.test.ts src/tests/app-shell-components.test.tsx
npm run test:e2e -- src/tests/e2e/cannon-trip-loot.spec.ts src/tests/e2e/shell-accessibility.spec.ts --workers=1
npm run test:golden
npm run lint
npm run format:check
git diff --check
```

Run `npm run verify` before handoff. No golden or visual baseline update is
expected from the warning-only behavior; a numeric or unrelated layout delta
is a regression signal.

## Acceptance criteria

- Primary result metrics are no longer followed by a multi-line advisory price
  list.
- Only active missing/fallback conditions create the compact Result issue.
- Bury, Skip, unused Alch sale prices and zero-use supplies do not inflate the
  aggregate count.
- Exact one-GP coins do not produce a market warning.
- Loot shows contextual row notes without an aggregate duplicate.
- Economy exposes every relevant current-result note in one accessible,
  collapsed-by-default disclosure.
- The full list is reachable; no passive `N more` truncation remains.
- Primary UI uses item display names and consequence-first language.
- No price data, formula, persistence, provider or numeric output changes.
- Focused unit/browser, accessibility, golden and repository gates pass.

## Implemented result

- `SimulationWarning.priceContext` now carries the `loot`, `supply` or
  `cannon` consumer, current-result relevance and optional Loot row id without
  parsing warning text.
- Loot valuation separates active calculation warnings from displayed
  alternative-price notes. Bury, Skip and unused Alch sale prices stay outside
  the aggregate current-result collection, while exact `coins = 1` suppresses
  market-provenance noise.
- Food, potion, prayer, recoil, ammo, rune and cannonball warnings enter the
  aggregate only when their active consumption path is non-zero.
- `src/app/view-models/price-data.ts` owns issue/note classification, display
  labels, consequence-first copy, deterministic ordering and Loot-row groups.
- Result renders only a compact active missing/fallback issue with a
  `Review price data` action. Active assumptions and Stats source detail no
  longer duplicate price notes.
- Loot renders notices beside the supplying row or nested contributor. Economy
  owns the complete native `Price data notes (N)` disclosure; it is collapsed
  during ordinary navigation and opened/focused by the Result action.
- Price values, formulas, PriceSet selection, persistence, provider policy and
  request schemas are unchanged.
- Focused unit, Chromium, type, lint, architecture, golden, build and artifact
  checks pass. [The dated testing evidence](../project/testing-evidence/2026-07-19-20.md#2026-07-17-price-warning-relevance-and-presentation)
  records the unrelated Planner-baseline and untracked-document blockers in
  the repository-wide wrapper.

## Documentation updates when implemented

- Update [per-item price provenance and freshness](per-item-price-provenance-freshness-spec.md)
  to distinguish used-value emission from row-local metadata.
- Update [UI parity](ui-parity-spec.md) and
  [product feature inventory](../product/feature-inventory.md) to replace the
  existing repeated structured-warning claim.
- Update [architecture](architecture.md) with the final structured context and
  presentation owner.
- Record the accepted implementation boundary in
  [project decisions](../project/decisions.md).
- Add dated validation results to
  [testing evidence](../project/testing-evidence.md).

## Open questions

None for this phase. Quantifying the GP share affected by uncertain prices is a
separate future analysis feature and is not required to remove the current
noise truthfully.

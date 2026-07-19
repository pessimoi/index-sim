# Contextual item-price correction specification

Status: specified on 2026-07-19; implementation pending.

Priority: high. Estimated implementation size: S.

## Purpose

Finish the item-price warning workflow by connecting an item-scoped Result,
Loot or Economy notice directly to the existing `Manual item price` editor.
The user must not have to remember the item, reopen the selector and search for
it a second time before correcting a value that the application already
identified.

This is a navigation, focus and feedback extension over D-101 and D-090. It
does not introduce another price source or change any calculation.

## Verified current state and feature-inventory check

The three affected inventory rows remain `Valmis`:

- `Result summary` owns D-101's compact current-result issue. Its existing
  `Review price data` action activates Economy, opens `Price data notes` and
  focuses the disclosure summary.
- `Loot/economy summary` owns row-local used-price notes and Economy's complete
  current-result disclosure. The rendered notice rows have no item action.
- `Market price sync` owns D-090's local per-item overlay and D-102's separate
  `Advanced PriceSet tools`. `Manual item price` can select, apply and reset one
  active base-PriceSet item, but no warning surface can preselect it.

The current source already provides most of the required contract:

- `PriceDataNotice.itemId` retains an item identity without parsing user-facing
  copy;
- the Loot view model carries the same notice into row and nested-row detail;
- `App.tsx` owns the Economy tab/open/focus coordination used by
  `Review price data`;
- `createManualPriceEditorPresentation()` owns the active item option set,
  selected item, base value, active value and manual status; and
- applying or resetting D-090 state already recomposes the active PriceSet and
  updates every current calculated consumer.

The remaining gap is one missing intent path between these implemented
surfaces. For example, a notice that says an item uses a fallback value explains
the risk but still requires the user to search for that item again in the
manual editor.

This follow-up does not downgrade any inventory row to `Osittain`: the accepted
workflows are implemented. The backlog tracks this as a high-priority usability
hardening card until the direct path is delivered.

## Goals

- Carry the exact notice `itemId` into an explicit item action.
- Use one shared transition from Result, Loot and Economy.
- Activate Economy, select the matching manual-price item and move focus to the
  price input when the item is editable under D-090.
- Keep Result compact when several item issues are active.
- Give visible and screen-reader feedback after Apply and Reset that identifies
  the item, value source and effect on the current result.
- Preserve the full-PriceSet workflow as a separate collapsed advanced path.

## Non-goals

- No item price, high-alch value, warning classification, loot action, GP
  formula or optimizer change.
- No new PriceSet, manual-overlay, setup, share, history or persistence schema.
- No expansion of D-090's active base-item allowlist or 512-row capacity.
- No automatic market lookup, upstream submission, scheduled refresh, account,
  database or backend state.
- No bulk editing and no attempt to merge individual corrections into an
  imported PriceSet.
- No direct item correction for a missing high-alch value. D-090 edits market
  item prices only.

## Actionability contract

Actionability must be derived from structured data, never from `summary`,
`detail`, rendered text or DOM inspection.

A notice is `correctable` when all of the following are true:

1. it has an `itemId`;
2. the notice concerns the market item price rather than
   `missing-alch-value`; and
3. that id exists in the current `ManualPriceEditorPresentation.itemOptions`
   set derived from the active base PriceSet.

Add deterministic action metadata to the price-notice presentation boundary,
for example:

```ts
interface PriceNoticeAction {
  kind: "correct-price" | "inspect-item";
  itemId: string;
  label: "Correct price" | "Inspect item";
}

interface PriceDataNotice {
  // Existing fields remain unchanged.
  noticeId: string;
  action?: PriceNoticeAction;
}
```

The exact names may be refined. The required properties are a stable notice
identity, the exact item id and an explicit action kind.

- A correctable notice receives `Correct price`.
- An item-scoped current-result notice that cannot be edited through D-090 may
  receive `Inspect item`; this opens and focuses that notice in Economy without
  pretending the manual field can fix it.
- A notice without a reliable item id receives no item action.
- If the active base PriceSet changes and the item is no longer editable, the
  action must be re-derived as inspect-only or absent before activation. Never
  select the manual editor's first fallback option for a missing target.
- Deduplication and deterministic ordering remain owned by the existing
  price-notice view model. `noticeId` must use the same structured code, item,
  consumer and Loot-row context rather than an array index.

The pure price-data presentation builder should receive the current set of
D-090-editable item ids after the base PriceSet has been resolved. This is UI
presentation context; it must not enter `SimulationRequest`, Trip warning
production or the domain PriceSet type.

## Shared transition contract

One App-level intent coordinates every source, for example:

```ts
requestPriceItemReview(action: PriceNoticeAction): void
```

For `correct-price`, the intent must perform one logical transition:

1. validate the target against the latest manual editor option set;
2. select the exact `itemId` in `Manual item price`;
3. initialize the draft from that item's current active value, using the same
   D-090 selection rule as a manual selector change;
4. clear a pending manual-price clear confirmation so unrelated destructive UI
   is not carried into the correction path;
5. activate Economy; and
6. after the selected editor has rendered, focus the `Manual price` input and
   scroll it into the nearest visible position only when needed.

For `inspect-item`, the intent activates Economy, opens `Price data notes` and
focuses the matching notice row or its action. If the notice disappeared after
a concurrent recalculation, focus the disclosure summary and leave a bounded
neutral message instead of selecting another item.

The coordinator must be latest-request-wins and one-shot. A tab change or
ordinary recalculation must not repeat focus. Use an explicit request identity
or handled-request ref rather than relying on timing alone. The existing
`priceNotesSummaryRef` remains the aggregate review target; add a dedicated
manual-price input ref and bounded notice refs as needed. If the shared
`DecimalField` needs an optional input-ref prop, add it without changing its
numeric draft, validation, Enter, Escape or blur contract.

## Source-specific presentation

### Result

- Preserve D-101's compact `Price data incomplete` section and do not restore
  item-by-item Result messages.
- If there is exactly one distinct actionable current-result issue, the
  section may expose its direct `Correct price` or `Inspect item` action.
- If there are several issues, no target may be chosen implicitly. Keep
  `Review price data`; it opens the complete Economy disclosure, where every
  item row exposes its own action.
- Confidence notes remain absent from Result.

### Loot

- Add the action beside each item-scoped notice in the existing row or nested
  value-detail disclosure. Do not add another table column.
- Pass the notice action through `LootPaneActions`; the pane emits the exact
  structured action and does not activate tabs or mutate manual state itself.
- Inactive alternative-price notes may still be corrected when their item is
  D-090-editable, but the surrounding copy must continue to say that the
  alternative is not used in current GP totals.
- Nested contributor actions target the contributor `itemId`, never the parent
  drop row by label.

### Economy

- Add the same action to each item-scoped row in `Price data notes`.
- A correctable action goes directly to the manual editor; it must not require
  closing the disclosure or reopening the item selector.
- Keep the disclosure complete, collapsed during ordinary navigation and
  automatically open only for explicit review/inspect navigation.
- `Manual item price` remains outside `Advanced PriceSet tools`. D-102's
  complete-replacement import/export/reset guidance and controls remain
  unchanged.

## Apply, success and reset feedback

The correction path reuses D-090's existing state and persistence transaction.
It must not create a second apply implementation.

After a successful Apply:

- the active PriceSet is recomposed immediately;
- the original missing/fallback notice disappears if the manual value resolves
  its condition;
- the manual editor shows the same selected item, active value and `Manual`
  status; and
- the existing Market/app status surface announces bounded copy such as
  `Applied 12,345 gp manual price for Rune spear. Current results use this manual value.`

If local storage is unavailable, retain D-090's session-only qualification in
the same message. Manual entry time remains an edit time, not a market
observation time.

After `Reset item`, show the restored base value and say that current results
use the base PriceSet value. `Clear all manual prices` keeps its existing
confirmation and aggregate feedback; this feature does not add a shortcut to
that destructive action.

Do not make the whole price-notice list live. Reuse the bounded existing status
surface for Apply/Reset feedback so normal recalculation does not repeatedly
announce notes.

## State and ownership boundaries

- `src/domain/trip` continues to own warning relevance, consumer and Loot-row
  context. It receives no navigation state.
- `src/app/view-models/price-data.ts` owns stable notice identity,
  correctable/inspect action derivation and Result direct-action eligibility.
- `src/app/view-models/loot.ts` continues to attach structured notices to the
  exact row or nested contributor without inventing targets.
- `WorkbenchShell`, `LootPane` and `EconomySettingsPane` render action metadata
  and emit typed intents only.
- `App.tsx` owns the cross-pane selection, draft initialization, tab activation,
  one-shot focus request and reuse of the existing D-090 Apply/Reset
  transaction.
- Manual overlay persistence, local-state health, history and PriceSet transfer
  keep their existing owners and schemas.

No component may search the manual selector by display label, inspect warning
English or query arbitrary DOM text to recover an item identity.

## Required tests

### Pure/view-model coverage

- Preserve `itemId` and generate a stable action for correctable fallback,
  generated, retained, freshness, alias and approximation notices.
- Keep `missing-alch-value` inspect-only and itemless notices actionless.
- Re-derive actionability when the base PriceSet option set changes.
- Expose a direct Result action for one distinct actionable issue and retain
  aggregate review for zero or multiple targets.
- Preserve notice order, deduplication, active-result filtering and exact Loot
  row/nested contributor mapping.

### Component coverage

- Result, Loot row, nested Loot detail and Economy disclosure render the
  expected accessible button label and emit the exact action/item id.
- `EconomySettingsPane` attaches the provided ref to the native manual-price
  input without changing numeric behavior.
- Inspect-only focus remains inside the Economy disclosure.
- Advanced PriceSet tools remain collapsed and separate from the correction
  action.

### Browser coverage

Add one focused production-preview transaction that proves:

1. a current-result fallback issue appears in Result;
2. the direct action activates Economy;
3. the matching item is selected without selector interaction;
4. keyboard focus lands in `Manual price`;
5. entering a valid price and choosing `Apply price` updates the active value,
   shows `Manual`, removes the resolved fallback issue and reports that current
   results use the manual value; and
6. `Reset item` restores the base value and feedback.

The same scenario must also invoke the shared transition from a Loot notice and
an Economy notice, or use focused component integration evidence to prove those
two sources call the identical App intent. Include a multiple-issue Result case
that keeps `Review price data` instead of selecting an arbitrary item.

Use the current focused owners:

```sh
npm run typecheck
npm run test -- src/tests/price-data-view-model.test.ts src/tests/loot-view-model.test.ts src/tests/app-shell-components.test.tsx src/tests/economy-settings-pane.test.ts
npm run test:e2e -- --workers=1 -g "corrects a warned item price"
npm run build
git diff --check
```

Run the complete `npm run verify` and functional Chromium suite before delivery
because the shared Result, Loot, Economy and manual-price state paths are
release-visible.

## Implementation sequence

1. Add stable notice action metadata from exact item ids and the latest D-090
   editable option set.
2. Add one typed App-level review/correction intent and one-shot focus request.
3. Wire Result, Loot and Economy buttons to that intent.
4. Reuse D-090 Apply/Reset and strengthen its bounded success/reset copy.
5. Add focused view-model, component and browser coverage.
6. Mark the backlog card `Done`, add implementation evidence here and update
   the feature-inventory completion note without changing the three `Valmis`
   row statuses.

## Done criteria

- A user can move from a correctable item notice to the matching focused price
  field with one action and without searching for the item again.
- Result never selects an arbitrary target when several issues exist.
- Result, Loot and Economy use the same typed item transition.
- Apply and Reset truthfully state whether current results use the manual or
  base value.
- Manual price storage, base PriceSet, generated high alch, histories and
  advanced full-PriceSet tools retain their current contracts.
- Focused tests, production-preview browser coverage, full functional Chromium
  and repository gates pass.

## Open questions

None. This specification accepts the direct contextual correction path while
preserving D-090, D-101 and D-102 ownership and schema boundaries.

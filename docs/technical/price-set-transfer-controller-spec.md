# PriceSet transfer and acceptance controller specification

- Status: implemented
- Date: 2026-07-13
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

Before this extraction, `src/app/App.tsx` coordinated one PriceSet transaction
across browser file reading, validation, generated high-alch authority, manual
item-price overlays, selected-snapshot persistence, local history, recovery
state and, at that time, three import surfaces. Those operations form one
browser-state responsibility; the live `SimulationContext` and React state
setters do not.

This goal moves the transaction behind a DOM-free controller core and a thin
React hook. `App` keeps the active runtime context and applies only typed
accepted/reset outcomes. D-102 subsequently consolidates presentation into one
Market-owned workflow without changing this transaction boundary.

## Verified pre-refactor ownership

- `src/adapters/market` owns bounded, duplicate-key-safe PriceSet text parsing.
- `src/adapters/browser` owns concrete browser file reading and JSON download.
- `src/adapters/generated/price-fallback.ts` owns generated high-alch authority.
- `src/app/state/manual-price-overrides.ts` owns the browser-local item-price
  overlay and its generated metadata.
- `src/app/state/selected-price-set.ts` owns the versioned selected PriceSet
  envelope and storage key.
- `src/app/state/price-history.ts` owns capped accepted-snapshot history.
- `src/app/controllers/local-state-recovery.ts` owns storage failure reporting,
  replacement unblocking and health refresh.
- `App` owns `SimulationContext`, base/bundled/scheduled PriceSets, manual-price
  state, history state, active origin, visible status and notices.

The controller composes these existing owners. It must not duplicate their
schemas, price formulas, metadata rules or storage envelopes.

## Current transaction behavior

### Import surface and bounded validation

- One Market-owned input remains `type="file"` with
  `accept="application/json,.json"` inside the collapsed
  `Advanced PriceSet tools` disclosure. It calls one unscoped import operation.
- The first selected file is used. No file or unavailable runtime context is a
  no-op.
- `readBrowserFileText(file, PRICE_SET_IMPORT_MAX_BYTES)` runs before
  `parsePriceSetFileText(text, { maxBytes: PRICE_SET_IMPORT_MAX_BYTES })`.
- Browser size failure, UTF-8 size failure, duplicate keys, malformed JSON and
  schema failures retain the exact messages produced by
  `describePriceImportError()`.
- A rejected import does not change runtime prices, base prices, active origin,
  history, selected persistence or the previous Market notice. Its import
  notice explains that the current PriceSet and history were retained.
- Starting an attempt clears the previous import notice. The input value is
  reset after success or failure so the same file can be selected again. The
  controller does not retain or mutate an input element.
- No busy state, cancellation or latest-request guard is added. Concurrent
  imports retain promise-settlement ordering.

### Acceptance transaction

For a validated file import or compatible legacy PriceSet, acceptance keeps
this order and authority:

1. replace incoming high-alch values with current generated game-data truth via
   `withGeneratedAlchAuthority()`;
2. derive the active runtime PriceSet by applying current manual item-price
   overrides to that canonical base;
3. try to persist the canonical base as the selected PriceSet at the supplied
   acceptance time;
4. unblock compatible replacement for `price-history` and
   `selected-price-set`;
5. create a typed history updater that appends the canonical base, not the
   manual overlay, to the latest capped browser history;
6. return one immutable accepted outcome for `App` to apply.

The outcome contains canonical base, active runtime PriceSet, a pure
`priceHistoryUpdate(current)` function, origin `selected`, persistence result,
app status and Market notice. The updater intentionally receives the latest
React state at application time so a slow file read cannot overwrite a local
history capture made while it was pending. `App` applies the outcome to its
existing owners, clears the manual draft/clear confirmation and fatal error,
and does not pass individual React setters to the controller.

Selected persistence success clears its recovery failure and refreshes health.
An unavailable storage bridge marks persistence unavailable; a thrown write
records `save_failed`. Both remain successful in-memory acceptance and use the
existing neutral “Local restore was not saved” copy.

A file import additionally publishes the existing success notice beside the
canonical Market workflow. Compatible legacy import uses the same acceptance
transaction but does not create a file-import notice.

### Export and reset

- Export downloads the active PriceSet unchanged as
  `index-sim-price-set-<sanitized-id>.json`, falls back to `active` for an empty
  sanitized id, clears pending reset confirmation and returns the existing
  success status/Market notice for `App` to display.
- Requesting reset only opens controller-owned confirmation state and returns
  the existing neutral confirmation notice. Cancel only closes it.
- Confirmed reset chooses the caller-provided scheduled fallback before bundled
  fallback, applies current manual prices to it for runtime use, and clears only
  the persisted selected PriceSet. Local price history is retained.
- Successful clear removes the selected-price-set recovery failure. Unavailable
  storage marks persistence unavailable; a thrown clear records `clear_failed`.
  Every reset refreshes local-state health.
- Reset returns the fallback base, manual-overlay runtime PriceSet, supplied
  fallback origin, exact status/notice copy and closes confirmation. `App`
  applies the outcome and clears its manual draft/clear confirmation and fatal
  error.

### Ownership exclusions

The controller does not own:

- React state setters, `SimulationContext` mutation or runtime bootstrap;
- manual-price editing/persistence;
- Economy history capture/clear/trend analysis;
- scheduled snapshot selection or fallback priority;
- legacy migration inspection/dismissal;
- file-input DOM reset or import-control markup;
- user-visible copy outside the existing PriceSet transfer notices.

## Required contract

Exact names may vary, but the implementation must expose an equivalent typed
boundary:

```ts
interface PriceSetTransferSnapshot {
  importNotice: PriceImportNotice | null;
  resetPending: boolean;
}

interface AcceptPriceSetInput {
  priceSet: PriceSet;
  acceptedAt: Date;
  nextStatus: string;
  gameData: GameDataSnapshot;
  manualPriceOverrides: ManualPriceOverridesState;
}

interface AcceptedPriceSetOutcome {
  status: "ready";
  basePriceSet: PriceSet;
  activePriceSet: PriceSet;
  priceHistoryUpdate(current: BrowserPriceHistoryState): BrowserPriceHistoryState;
  activePriceSetOrigin: "selected";
  selectedPersisted: boolean;
  appStatus: string;
  marketNotice: MarketNotice;
}

type PriceSetFileImportOutcome = AcceptedPriceSetOutcome | { status: "rejected" };

interface ResetPriceSetInput {
  fallbackPriceSet: PriceSet;
  fallbackOrigin: "scheduled" | "bundled";
  fallbackLabel: string;
  manualPriceOverrides: ManualPriceOverridesState;
}
```

The generic core receives injected file text, time, download, selected-storage
and recovery callbacks so Node tests need no DOM or browser globals. The
production hook supplies browser/storage adapters.

## Tests and acceptance

Focused controller tests must cover:

- valid import sequencing and exact canonical/active/history output;
- session-only save and thrown save recovery paths;
- every existing parser error category with no mutation authority;
- the unscoped canonical notice and concurrent settlement behavior;
- compatible direct acceptance without a file notice;
- deterministic export filename/value;
- reset request/cancel, persisted reset, unavailable reset and failed clear;
- listener notifications without duplicate snapshots.

Required validation:

```sh
npm run test -- src/tests/price-set-transfer-controller.test.ts src/tests/price-import-notice.test.ts src/tests/market-ui-state.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "price|PriceSet|legacy"
npm run verify
git diff --check
```

## Open questions

None. D-102 has consolidated presentation into one Economy/Market workflow,
which consumes this controller contract without reintroducing file/storage
orchestration.

## Implementation evidence

- `price-set-transfer.ts` and its thin hook now own bounded import, one
  canonical notice, generated-alch/manual-overlay composition, selected persistence,
  recovery integration, pure latest-state history updates, export and reset
  confirmation. `App` applies typed accepted/reset outcomes and retains only
  runtime state mutation plus file-input reset.
- Fifteen focused controller tests cover canonical/active authority, current
  history application, successful/session-only/failed storage, all parser
  categories, direct legacy acceptance, concurrent settlement, export and
  reset transitions. The required combined unit gate passes 57/57.
- The combined PriceSet/legacy/Cannon production-preview gate passes 4/4, and
  the complete Chromium suite passes 77/77.
- Architecture passes at 81 source modules / 68 client-reachable modules with
  no cycle or exception.
- Full `npm run verify` passes 694 unit tests, 19 explicit goldens and all
  non-network release gates. The direct entry is 698,137 raw / 201,103 gzip
  bytes, and the generated runtime snapshot remains deferred.

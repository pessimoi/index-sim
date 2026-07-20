# Economy destructive actions Undo specification

Status: implemented and repository-verified on 2026-07-20.

## Purpose

The browser-local Economy workflow already owned confirmed history clearing,
manual-price reset/clear and imported PriceSet reset. Those operations now use
the application's existing single global Undo slot so an accidental destructive
action can be reversed once without adding persisted Undo history or changing a
storage schema.

`Market price sync`, `Manual item prices`, `Loot/economy summary`, local price
history and Workspace backup/restore remain existing `Valmis` workflows. This
is a recoverability layer over their current transactions, not a new feature
family.

## Implemented boundary

`src/app/controllers/economy-data-undo.ts` is a DOM-free exact-raw controller.
Its public input accepts only this closed scope union:

| Scope                    | Existing storage key               |
| ------------------------ | ---------------------------------- |
| `price-history`          | `index-sim:price-history`          |
| `manual-price-overrides` | `index-sim:manual-price-overrides` |
| `selected-price-set`     | `index-sim:price-set:selected`     |

The controller does not accept an arbitrary key. It captures the exact
`string | null` immediately before an accepted destructive persistence
operation and captures the exact raw postimage immediately after it. Both raw
values stay private to one in-memory closure. They are never parsed,
normalized, rendered, logged, exported, persisted under another key, sent to
telemetry or returned in a public result.

`App.tsx` remains the owner of the corresponding live React preimage, status,
Market notice and global Undo registration. The pure Economy pane still
receives values and actions only. Existing state modules retain key, schema,
envelope, cap and PriceSet-composition ownership; the PriceSet transfer
controller still performs the confirmed fallback reset.

## Transaction contract

For every covered destructive action, App:

1. rejects a no-op without replacing the current pending Undo;
2. captures the complete live state and exact raw preimage immediately before
   the current save/clear/reset owner runs;
3. invalidates an older Economy-scoped Undo while retaining an unrelated
   pending Undo;
4. performs the existing persistence operation and applies the live result;
5. captures the raw postimage; and
6. registers one Economy-scoped `PendingUndo` only after the live mutation.

The optional `PendingUndo.scope = "economy-data"` is backward-compatible. A
normal comparison save, manual Apply/reset/clear, PriceSet accept/import/reset
or Workspace restore that selected an Economy area invalidates an older
Economy/Workspace Undo. Navigation, sorting, filtering, disclosures and an
uncommitted manual-price draft do not. A later undoable action retains the
existing global one-slot replacement rule.

## Durable and session-only Undo

Before durable restoration, the controller rereads the allowlisted key and
compares it byte-for-byte with the captured destructive postimage. Only an
exact match permits `setItem` of the original raw string or `removeItem` for an
original `null`. No new envelope or `savedAt` is created.

Raw mismatch, unavailable persistence, an original save/clear failure or an
Undo read/write/remove failure switches to live-only restoration. A mismatch
never overwrites the newer saved value. Failed raw restoration makes a bounded
best-effort rollback to the postimage and reports only `save_failed` or
`clear_failed` through local-state recovery. User copy distinguishes an
unchanged pre-action value, retained post-action value, retained newer value
and an unverifiable saved value without exposing raw data.

The record is consumed before the first restore attempt, so it is one-shot even
on a storage failure. Reload and tab close discard the in-memory record.

## Area-specific live restoration

### Local price history

- Confirmed clear captures and restores the entire
  `BrowserPriceHistoryState` in its original order.
- Committed/shared history, baseline, item, sort and filter choices do not
  change.
- Undo never calls `appendAcceptedPriceSetToHistory()`.
- Durable and live-only Undo call
  `prepareExternalApply(["price-history"])` before restoring React state, so
  the next persistence effect consumes one skip instead of rewriting the exact
  restored envelope or making a session-only restore durable.
- Startup applies the same one-shot skip to a non-empty loaded local history,
  preserving an exact restored envelope across reload.

### Manual item prices

- `Reset item`, a base-price-equivalent `Apply price` and confirmed
  `Clear all manual prices` capture the complete
  `ManualPriceOverridesState`, including currently unavailable rows.
- They also capture the exact active composed PriceSet, `priceLabel` and
  `manualPriceDraft`. Undo restores those caller-owned values directly and
  keeps confirmation closed.
- Base PriceSet, active origin, local/shared history and high-alch authority do
  not change. A normal added/updated override receives no Undo but invalidates
  an older Economy Undo.

### Imported PriceSet reset

- Confirmed reset still runs through `resetToFallback()` and captures the
  prior base PriceSet, active composed PriceSet, origin, label and draft.
- Undo restores the exact selected-key raw value and those exact live objects;
  it does not call accept/reset/history/alch-generation paths.
- Manual overrides, both histories and scheduled/bundled fallbacks remain
  unchanged. The captured active/base PriceSets retain their exact generated
  high-alch maps.

## Security and non-goals

- No storage key, version, schema, envelope, size limit or accepted data shape
  changed.
- No raw payload enters UI copy, exports, logs, network traffic or telemetry.
- No multi-step/persisted Undo history, ordinary manual-Apply Undo, PriceSet
  import Undo, high-alch editor, backend, account, database or cloud state was
  added.
- The evidence ceiling is local runtime and synthetic tests; it does not prove
  every browser's storage implementation or a deployed production instance.

## Evidence

- `src/tests/economy-data-undo.test.ts` covers the closed scope, exact raw and
  null restoration, live-only mode, current-read/set/remove failures,
  best-effort postimage rollback, cross-tab mismatch, one-shot consumption,
  Economy-only invalidation and raw non-disclosure.
- Five named production-preview Chromium paths cover durable history plus
  reload, manual Reset/base-Apply/clear with an unavailable row, imported
  PriceSet reset, safe-session isolation and a forced clear failure. They
  compare exact raw strings and retain an unrelated key.
- The focused state/controller/pane command passes 86/86 tests, and the five
  focused Chromium paths pass 5/5.
- `npm run verify` passes 95 Vitest files / 947 tests, 19 explicit goldens,
  typecheck, the 149-source-module/134-client-reachable-module zero-cycle
  architecture check, build, artifact budgets, lint and formatting. The full
  production-preview Chromium gate passes 106/106 with one worker.
- The rare destructive-action controller shares the existing lazy
  Economy/Settings boundary, and Risk uses a separate lazy pane boundary. The
  verified 15-file/eight-JavaScript-chunk artifact keeps the direct entry at
  787,409 raw / 228,941 gzip bytes without raising D-098's budget.

## Open questions

None for this bounded implementation.

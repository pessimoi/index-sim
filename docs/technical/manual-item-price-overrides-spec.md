# Manual item price overrides specification

- Status: implemented
- Date: 2026-07-12
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

Let a user correct one active item price locally without hand-editing and
importing a complete PriceSet JSON file. Preserve the scheduled/imported/bundled
PriceSet as the removable base and keep item-level provenance truthful.

## Existing behavior

- Active PriceSets already carry one numeric value and one metadata row per
  item.
- `manual` value origin and `manual-value` reason are already schema-valid.
- Users can import/export/reset a complete selected PriceSet, but cannot edit
  one item in the UI.
- Generated high-alch values remain authoritative and separate from item-price
  origin.

## Accepted architecture

Add a separate rewrite-owned browser state:

```ts
interface ManualPriceOverridesState {
  items: Record<
    ItemId,
    {
      price: number;
      updatedAt: string;
    }
  >;
}
```

- Storage key: `index-sim:manual-price-overrides`, version 1.
- Cap the state at 512 current item ids and the persisted envelope at the
  repository's bounded local-state size policy.
- Values must be finite non-negative numbers; timestamps must be valid ISO
  timestamps.
- Apply the overlay after resolving the selected, scheduled or bundled base
  PriceSet and after generated runtime price fallbacks are present.
- Keep override rows whose ids are absent from the current base PriceSet in
  local storage, but exclude them from active composition and provenance. This
  prevents a temporary narrow imported PriceSet from silently deleting an
  item-level correction. The UI can create new overrides only from the active
  base item allowlist.
- Overlay composition returns a validated PriceSet with the base alch values,
  overridden numeric prices and metadata:
  `valueOrigin = manual`, `refreshStatus = not-evaluated`,
  `quality = unknown`, `reasonCode = manual-value`.
- The base PriceSet object remains unchanged and owns reset values.

## UI behavior

- Add `Manual item price` controls to Economy.
- The item selector contains only active base PriceSet item ids with game-data
  labels where available.
- Show base price, active price, override status, active/unavailable counts and
  the 512-row storage capacity.
- `Apply price` validates and persists one override, immediately recomposes all
  current calculation paths and marks calculated on-demand results stale through
  their existing PriceSet identity dependency.
- `Reset item` removes only the selected override and restores its current base
  price.
- `Clear all manual prices` requires confirmation and leaves the base PriceSet
  plus local/shared price history unchanged.
- Base PriceSet import/reset and scheduled loading reapply valid manual
  overrides, reset an item draft derived from the previous base and keep
  currently unavailable rows inactive instead of silently deleting them.
- The manual item selector owns its draft independently of the Economy trend
  selector, so changing the analyzed trend cannot retarget an uncommitted
  manual value.
- At the 512-row limit, existing rows can still be updated or reset. A new row
  is disabled and guarded before schema parsing instead of throwing through a
  UI event handler.
- Manual overrides do not enter shared setup links, setup exports, legacy
  migration or committed price artifacts.

## Persistence and recovery

- Use the existing persisted-envelope helpers and local-state health surface.
- Storage read/save/clear failures remain non-fatal and produce sanitized
  session-only notices.
- Clearing the manual-price state from Settings restores the base PriceSet on
  the next state refresh/reload; no other local key is removed.
- A manual item price becomes local price-history evidence only when the user
  explicitly chooses the existing `Save local comparison` action.

## Non-goals

- Editing high-alch values.
- Bulk spreadsheet editing or upstream submission.
- Changing scheduled writer mappings, freshness thresholds or provider policy.
- Accounts, database, backend sync or sharing manual prices in permalinks.
- Treating manual entry time as a market observation time.

## Tests

- Pure state tests cover schema bounds, capacity checks, set/remove/clear, base
  immutability, truthful metadata, unavailable-id exclusion without deletion
  and persistence failure handling.
- Local-state health covers loaded/invalid/clear behavior for the new key.
- Browser coverage applies an item override, observes recalculated active price
  and manual provenance, keeps a draft attached to its item, changes to a base
  where the row is unavailable, restores it on base reset, reloads persistence,
  resets one item and verifies non-throwing capacity behavior.
- PriceSet import/reset coverage confirms the overlay remains independent.

## Documentation and decision

- Record the overlay boundary as D-090.
- Keep Market price sync and Loot/economy summary `Valmis`; this is a local
  correction workflow over the accepted PriceSet contract.
- Scheduled coverage gaps and upstream mappings remain separate work.

## Done criteria

- One current item price can be corrected and reset without editing a full
  PriceSet.
- Every active overridden value has truthful manual metadata.
- The base PriceSet, high alch, histories and unrelated local state are
  preserved.
- Focused state/UI/browser and repository gates pass.

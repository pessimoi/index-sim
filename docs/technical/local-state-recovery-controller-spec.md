# Local-state recovery controller and Settings panel specification

Status: implemented as independent Goal 6, 2026-07-13. The controller, hook,
pure Settings panel and focused regression suite described here are current.

## Purpose

`src/app/state/local-state-health.ts` owns the pure allowlisted health, export
and clear policy for rewrite browser state. The implemented controller now owns
the React-facing state machine around that policy: storage failures,
compatibility blocks, skip-once persistence, report refresh, clear
confirmation, notices and recovery actions. The Settings table is a pure
component.

This goal extracted that cohesive orchestration into an app controller and
moved only the Local state recovery section into a pure Settings component. It
did not extract the full Settings or Economy pane.

## Current behavior to preserve

### Health and privacy

- The app creates one browser storage boundary. If `window.localStorage` cannot
  be accessed, it uses in-memory storage for the session and marks browser
  persistence unavailable.
- Health inspection is limited to the descriptors in
  `LOCAL_STATE_HEALTH_DESCRIPTORS`. Unknown browser keys and archived legacy
  keys are not included or cleared.
- The report contains key names, versions and sanitized status metadata only.
  Raw persisted payloads, raw errors, stack traces and absolute paths are never
  rendered, exported or logged.
- Invalid JSON, invalid envelopes/data, duplicate keys, oversized bodies,
  version mismatches, unavailable storage and save/clear failures keep their
  existing sanitized status and reason text.
- A persisted setup or Duel collection that is schema-valid but incompatible
  with current generated game data is represented as `invalid_data` through
  `contextInvalidItemIds`. Its original persisted value remains recoverable.

The allowlist currently contains exactly these IDs:

```text
rewrite-setup
planner-ui
loot-prefs
loot-settings
hidden-gear-tiers
duel-snapshots
price-history
selected-price-set
manual-price-overrides
hiscores-last-player
legacy-migration-dismissed
```

Changing this list, a storage key or a version is outside this structural goal.

### Persistence blocking

- Items needing attention in the initial health report begin blocked. Their
  in-memory defaults must not overwrite the invalid or unsupported stored value.
- Runtime compatibility can add `rewrite-setup` and/or `duel-snapshots` to the
  blocked and context-invalid sets before normal persistence starts.
- `shouldSkipLocalStatePersist(id)` first consumes a one-shot skip marker and
  otherwise returns whether the ID is blocked.
- Confirmed clear releases the recovery block and adds that one-shot marker.
  The next persistence effect is skipped so the just-cleared key is not
  immediately recreated from current in-memory state.
- A compatible imported or migrated replacement uses the separate
  `unblockReplacedLocalState` path. It removes the block without a skip marker so
  the replacement may be persisted.
- A failed or cancelled clear does not release a block.

This clear-versus-replace distinction is a required data-safety contract.

### Save and clear failures

- A successful versioned save clears an earlier failure for that item.
- A failed save records only `save_failed`, shows
  `Local storage is unavailable. Changes may not persist after reload.`, and
  leaves current session state active.
- When the browser storage boundary was unavailable from startup, a successful
  write to the in-memory fallback is still reported as non-persistent.
- A clear failure records only `clear_failed`, keeps current session state and
  does not claim that the browser key was removed.
- Storage failure entries are deduplicated by item ID and the current report is
  refreshed after failure, clear or replacement transitions.

### Recovery actions and presentation

- The recovery section is visible only on the Settings tab and only when the
  report needs attention or a recovery notice exists.
- Export creates a fresh health report and downloads a metadata-only JSON file
  named `index-sim-local-state-health-<sanitized timestamp>.json`.
- Per-item and clear-all-invalid actions require a second confirmation. Cancel
  removes only the pending confirmation state.
- Clear-all touches only report items that both need attention and are
  clearable. It never scans or clears unknown keys.
- A valid loaded `manual-price-overrides` item may be cleared individually even
  when it does not need attention. On successful clear, the caller resets the
  in-memory manual overlay/draft/confirmation and recomposes the active PriceSet
  from the unchanged base.
- Clearing other invalid items does not reset unrelated current-session feature
  state. Their safe defaults are already active.
- The existing heading, labels, status pill, roles, table columns, copy, CSS
  class names and button names are compatibility contracts.

## Goal

- Make one app hook/controller own local-state recovery orchestration.
- Keep the existing `src/app/state/local-state-health.ts` functions as the pure
  storage policy and metadata truth.
- Move the recovery section to a side-effect-free Settings component.
- Keep feature-owned persisted values and their persistence effects with their
  current owners while routing all save/block/failure mechanics through the
  controller.
- Expose explicit clear and replacement outcomes so `App` can perform the one
  manual-price feature reset without moving pricing ownership into recovery.

## Non-goals

- Do not change storage keys, versions, schemas, envelopes, size limits or
  migration policy.
- Do not add automatic data repair or automatic rewrite-version migration.
- Do not clear unknown `index-sim:*` keys or archived legacy keys.
- Do not export raw local data or add telemetry.
- Do not move setup, Duel, Planner, loot, price or Hiscores state into a shared
  recovery store.
- Do not extract the full Settings/Economy service strip, Price data settings,
  imports, legacy migration or Hiscores UI.
- Do not add a React/state library or a new test-rendering dependency solely for
  this refactor.
- Do not change visible copy, confirmation behavior or CSS.

## Target ownership

Create these modules:

- `src/app/controllers/use-local-state-recovery.ts`: React orchestration for the
  health report, blocked/context-invalid IDs, storage failures, skip-once set,
  notices, pending confirmation and storage actions.
- `src/app/components/settings/local-state-recovery-panel.tsx`: pure rendering
  and presentation labels for the existing Settings section.

Small pure transition/message helpers may live beside the hook or in
`src/app/controllers/local-state-recovery.ts` when that makes them directly
testable in the Node Vitest environment. Do not duplicate the descriptor,
health-classification or allowlisted-clear policy from
`src/app/state/local-state-health.ts`.

`App.tsx` continues to own:

- feature values and existing persistence effects;
- the global status string, passed to the controller as an explicit callback;
- the runtime-bootstrap handoff of context-invalid IDs and notice;
- manual-price state reset/recomposition after a successful clear outcome;
- legacy/setup/import workflows, which call the controller's public failure and
  replacement methods.

The panel receives values and callbacks only. It must not import storage,
browser download helpers, adapters or `App` state setters.

## Required controller contract

The exact names may vary, but the hook must expose equivalent typed operations:

```ts
interface LocalStateRecoveryController {
  report: LocalStateHealthReport;
  notice: string | null;
  pendingClearId: LocalStateHealthItemId | "invalid-all" | null;
  visible: boolean;

  shouldSkipPersist(id: LocalStateHealthItemId): boolean;
  persist<T>(id: LocalStateHealthItemId, options: VersionedStorageOptions<T>, value: T): boolean;

  recordStorageFailure(id: LocalStateHealthItemId, reason: "save_failed" | "clear_failed"): void;
  clearStorageFailures(ids: readonly LocalStateHealthItemId[]): void;
  blockContextInvalid(ids: readonly LocalStateHealthItemId[], notice: string | null): void;
  unblockReplaced(ids: readonly LocalStateHealthItemId[]): void;

  beginClear(id: LocalStateHealthItemId | "invalid-all"): void;
  cancelClear(): void;
  confirmClearItem(id: LocalStateHealthItemId): LocalStateRecoveryOutcome;
  confirmClearInvalid(): LocalStateRecoveryOutcome;
  exportReport(): void;
  refresh(): LocalStateHealthReport;
}

interface LocalStateRecoveryOutcome {
  clearedIds: readonly LocalStateHealthItemId[];
  failedIds: readonly LocalStateHealthItemId[];
  message: string;
}
```

The hook input includes `storage`, the startup `storageUnavailable` flag and an
`onStatus(message)` callback. The callback prevents the controller from owning
the rest of `App`'s status policy. Browser download may be an injected callback
or the existing browser adapter called by the hook; it must not move into the
pure panel or state policy module.

`blockContextInvalid` must be called while applying the runtime-bootstrap ready
result and before `readyToPersist` is enabled. React may batch those updates,
but the following persistence render must observe both the blocks and the ready
gate.

## Panel contract

The panel should receive the report, notice, pending ID and controller-backed
callbacks. It owns only derived presentation such as:

- status and reason labels;
- `Healthy` versus `<n> need attention`;
- the attention-item clear-button enablement;
- whether a row is in confirmation mode;
- the valid-manual-overlay exception to per-row clearing.

The parent retains the existing visibility and active-tab condition, or passes
an explicit `visible` boolean. The component must render no wrapper when hidden.
When visible, it must preserve the current `section` landmark, `aria-label`,
status/alert roles, table semantics, class names and DOM order. No additional
wrapper may disturb existing layout selectors.

## Implementation sequence

1. Add focused tests for the controller's pure transition/message helpers and
   retain the current `local-state-health` policy tests.
2. Extract report/failure/block/skip/persist mechanics into the hook without
   changing call sites.
3. Route all current save, clear, legacy migration, import replacement and
   runtime compatibility paths through the hook's public methods.
4. Extract the recovery markup and label helpers into the pure Settings panel.
5. Keep the manual-price clear reaction as an explicit caller-owned outcome
   handler.
6. Remove the superseded `App` state, helpers and lint suppressions only after
   every call site uses the controller.

Do not use line-count reduction as the acceptance criterion. Ownership,
data-safety semantics and dependency direction are the criteria.

## Required tests and validation

Add `src/tests/local-state-recovery-controller.test.ts` if pure controller
transitions are split from the hook. Use `createMemoryStorage` plus failing
storage doubles; do not require a browser or a new React testing package for
policy coverage.

The focused test set must prove:

- initial invalid/version-mismatched IDs stay blocked;
- a context-invalid setup/Duel key is preserved and blocked;
- clear success adds exactly one skip and does not recreate the key;
- replacement unblocks without consuming a skip;
- clear failure keeps the block and emits sanitized metadata/copy;
- save failure preserves the in-memory caller value and is deduplicated;
- successful save clears only that item's previous failure;
- clear-all ignores valid, non-clearable, unknown and legacy keys;
- export contains metadata only;
- manual-price clear returns the ID needed for caller-owned reset;
- the panel retains per-item, cancel and clear-all confirmation behavior.

Run at minimum:

```sh
npm run test -- src/tests/local-state-recovery-controller.test.ts src/tests/local-state-health.test.ts src/tests/ui-adapters.test.ts src/tests/market-ui-state.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "invalid rewrite local state|unavailable game data|incompatible saved Duel|local storage save failures"
npm run verify
git diff --check
```

Run the complete production-preview Chromium suite if any shared Settings DOM,
button naming or service-strip structure changes during extraction. No golden,
visual or generated-data update is expected.

## Acceptance criteria for the implementation goal

- `App.tsx` no longer declares local-state report, blocked-ID,
  context-invalid-ID, storage-failure, skip-once, pending-clear or recovery-notice
  state separately.
- `App.tsx` no longer implements generic persist, report refresh, failure
  recording, clear/release or replacement-unblock mechanics.
- All versioned persistence effects use the controller's block/skip/persist
  contract and retain their current feature values and dependencies.
- The Local state recovery markup and label formatting live in the pure Settings
  panel, with no storage or adapter dependency.
- Context-incompatible persisted setup/Duel data is never overwritten before
  explicit clear or compatible replacement.
- Clear and replace keep their distinct one-shot persistence semantics.
- Only known allowlisted keys can be inspected, exported as metadata or cleared;
  unknown and legacy keys remain untouched.
- Save/clear errors remain sanitized and current session edits remain active.
- Manual-price clear still resets only its current-session overlay and restores
  the unchanged base PriceSet.
- Existing copy, roles, labels, class names, storage contracts and calculations
  are unchanged, with focused and repository gates passing.
- Architecture, testing and composition-root docs are updated with actual
  implementation evidence.

## Open questions

None block this extraction. A later goal may extract the complete Settings pane
or individual setup/PriceSet import controllers, but those broader boundaries
must not be pulled into this implementation goal.

## Implementation evidence

- `src/app/controllers/local-state-recovery.ts` owns the DOM-free transition,
  report, failure, persistence, clear, export and outcome mechanics;
  `use-local-state-recovery.ts` is the thin React external-store adapter.
- `src/app/components/settings/local-state-recovery-panel.tsx` owns the exact
  recovery landmark, labels, roles, table order and two-step confirmation
  rendering without importing storage or browser adapters.
- `App.tsx` retains feature values and persistence effects, passes runtime
  compatibility blocks through the controller before `readyToPersist`, and
  reacts only to the successful `manual-price-overrides` clear outcome.
- Ten focused controller/panel tests plus the retained health, UI-adapter and
  market suites pass 109/109. The four targeted production-preview recovery
  paths pass 4/4, and the complete Chromium suite passes 76/76.
- `npm run architecture:check` passes with 73 source modules, no cycles, 60
  client-reachable modules and zero exceptions. `App.tsx` is 8,441 lines after
  the ownership extraction; line count was not an acceptance boundary.
- Full `npm run verify` passes 645 unit tests, 19 explicit goldens and every
  non-network repository gate. The 10-file/two-asset artifact is 1,946,070
  bytes with SHA-256
  `42ec8a2e9ad83a80e6c0d6861cdf39ddf47690631716301c38912c2e9075a4f1`;
  dependency audit is skipped under the documented network-disabled policy.

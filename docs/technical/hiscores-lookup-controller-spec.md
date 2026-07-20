# Hiscores lookup controller and topbar panel specification

Status: implemented as Goal 7, 2026-07-13. The controller, React hook and
topbar panel preserve the specified behavior and ownership boundaries.

## Purpose

The Hiscores product, API, provider, validation and persistence contracts are
already implemented. `src/app/App.tsx` still owns their browser orchestration:
six React state values, two mutable request/input refs, two disclosure refs,
three effects, lookup/apply handlers, error/status copy and the complete
topbar Hiscores section.

This goal extracts that cohesive UI orchestration into a DOM-free controller
plus a thin React hook and moves the existing topbar section into one typed
presentation/interaction component. It is an ownership-only refactor. It does
not change the Hiscores product contract, provider, API, player-level form or
deployment model.

## Current behavior to preserve

### Service status and manual fallback

- On mount, the app calls the same-origin `fetchHiscoresStatus()` adapter once.
  Unmount prevents the settled promise from updating React state; the current
  request is not required to become abortable in this structural goal.
- Before a status response, the visible status label is `checking` and Lookup
  is disabled.
- An available response shows `available`, enables Lookup while no lookup is
  busy and clears an earlier startup notice.
- A response whose source id is `disabled` shows `disabled` and the neutral
  message `Live hiscores lookup is not configured in this run.` followed by
  `Use the Player level fields above to edit levels manually.`
- Other unavailable status responses show `unavailable` and the neutral message
  `Hiscores lookup is unavailable right now.` followed by the same manual-level
  fallback sentence.
- A rejected status request keeps the status value absent, shows the existing
  sanitized error message and leaves manual Player level fields usable.
- This extraction must not call the upstream provider directly, add retry
  polling or imply that a concrete deployment is publicly live. The browser
  continues to use only the repo-owned same-origin adapter.

### Player input and preview freshness

- The input initially comes from the version-1
  `index-sim:hiscores:last-player` envelope through
  `loadLastHiscoresPlayer(storage)`. Invalid, unavailable or missing state
  yields an empty input through the existing adapter contract.
- Freshness uses `normalizeHiscoresPlayerInput`: trim, collapse whitespace and
  locale-lowercase. Case or whitespace-only changes that normalize to the same
  player do not invalidate a preview.
- Changing to a different normalized player immediately makes an existing
  response unavailable for rendering or Apply, closes the preview disclosure
  and clears only a success notice. Neutral and error notices remain until a
  later transition replaces them.
- A preview is current only when the current normalized input matches the
  validated response's `normalizedPlayer || player` identity.
- Preview rows remain derived from the current combat form plus the response by
  `createHiscoresPreviewRows()`. The controller must not own or import
  `CombatSetupFormState`.

### Lookup request race and failure behavior

- Submitting prevents the browser form default.
- Empty normalized input does not call the adapter. It shows
  `Enter a player name` as an error.
- Unavailable service does not call the adapter and shows the applicable
  disabled/unavailable manual-fallback message as an error.
- A valid lookup snapshots the current player and normalized identity,
  increments a monotonically increasing request sequence, marks the controller
  busy and shows neutral `Looking up hiscores`.
- Only the latest request may update response, preview, notice, persistence or
  busy state. A response or error from an older sequence is ignored.
- If the latest successful response no longer matches the current input, the
  response is discarded, the preview stays closed and the neutral notice is
  `Player changed before lookup completed. Run Lookup again.`
- If the latest error belongs to an input that is no longer current, it is
  ignored. A current latest error clears the response, closes the preview and
  uses the existing sanitized mapping:
  - `bad-request` -> `Check the player name`
  - `not-found` -> `Player not found`
  - `rate-limited` -> `Rate limited` or
    `Rate limited. Try again in <n>s`
  - `upstream-unavailable` -> the unavailable manual-fallback message
  - `upstream-invalid` -> `Hiscores response invalid`
  - every other/raw error -> `Hiscores lookup failed.` followed by
    `Player level fields still work for manual edits.`
- Raw adapter messages, upstream response bodies, player-bearing request URLs,
  stack traces and local paths are never copied into the notice.
- The latest request clears busy state in `finally`; an older request must not
  clear the busy state of a newer request.

### Fresh-response persistence and recovery

- Only a successful response that is still the latest request and still
  matches the current normalized Player input writes the last-player envelope.
- The saved value remains adapter-validated and contains only `{ player }` in
  the existing version-1 envelope. No response, skill, source, warning or
  timestamp data is persisted.
- Successful save clears only the `hiscores-last-player` recovery failure. A
  thrown save records only sanitized `save_failed`; current response/preview
  state remains active.
- After either save outcome, the compatible replacement path unblocks
  `hiscores-last-player` without the clear-path one-shot skip and refreshes the
  local-state health report. The new controller must use the public
  local-state recovery operations rather than duplicating failure/block logic.
- Compatible legacy migration still writes the validated last player, updates
  the visible input and uses the same replacement-unblock/failure path. It must
  not start a lookup or mutate player levels.
- The startup `storageUnavailable` and memory-fallback policy stays owned by
  local-state recovery. This goal does not change storage availability
  semantics, the key, version, schema or legacy mapping.

### Preview and Apply

- A fresh successful response is retained, the preview is marked open and the
  notice is `Hiscores preview ready` when at least one supported skill exists,
  otherwise `No supported skills returned`.
- The visible rows remain ordered Attack, Strength, Defence, Hitpoints, Prayer,
  Ranged and Magic and show current and fetched levels.
- Apply is available only for a current response containing at least one
  applicable supported skill.
- Apply rechecks freshness synchronously. A stale attempt performs no form
  mutation, drops the response and shows
  `Hiscores preview no longer matches Player. Run Lookup again.`
- A valid Apply returns the validated `HiscoresResponse` to the caller. `App`
  remains responsible for calling `applyHiscoresLevels()` through its safe
  form commit path. The implemented
  [Hiscores Apply Undo follow-up](hiscores-apply-undo-spec.md) makes App own the
  changed-field count and sole changed-Apply success announcement; the
  controller owns only the fixed no-change notice.
- Missing returned skills leave current form levels unchanged. No setup schema,
  persistence, simulation request or calculation behavior changes.
- Apply does not implicitly close the current preview.

### Topbar DOM and keyboard interaction

- The Hiscores section remains between the brand and topbar action group with
  no additional wrapper. Preserve the `section.topbar-hiscores` landmark and
  `aria-label="Hiscores"`.
- Preserve the heading, status-pill class/tone, `hiscores-player` input id,
  visually hidden `Player` label, placeholder, autocomplete, Lookup button
  name/busy copy and disabled behavior.
- Notices preserve `inline-status`, their tone class and `alert` only for error;
  neutral/success use `status`.
- The preview remains native `details.hiscores-preview-details`, with
  `Review <n> levels` summary, response identity/source/fetched metadata,
  `Hiscores preview` table and Apply button in the same DOM order.
- Opening/closing the native disclosure updates controller state. While open,
  pointerdown outside the details closes it without moving focus.
- Escape while open prevents the default, closes the disclosure and restores
  focus to its summary on the next animation frame.
- The extracted panel may own these bounded DOM/focus effects and refs. It must
  not read storage, call a service adapter, mutate the combat form or own
  document-wide behavior while the disclosure is closed.
- Existing CSS selectors and responsive topbar layout remain unchanged. No CSS
  edit is expected.

## Goal

- Make one app controller own Hiscores service/input/request/preview/notice and
  last-player persistence orchestration.
- Keep `src/app/state/hiscores.ts` as the pure freshness, row and level-apply
  policy.
- Keep `src/adapters/hiscores` as the only browser network and last-player
  storage adapter.
- Move the complete topbar Hiscores markup and its bounded disclosure focus
  interaction into one component.
- Leave combat form ownership and the actual Apply mutation in `App` behind an
  explicit typed controller outcome.
- Route compatible legacy player replacement through one controller operation.

## Non-goals

- Do not change the accepted first-party upstream, same-origin routes, provider,
  Cloudflare Worker, rate limits, timeouts, response bounds or schemas.
- Do not call a live upstream from automated tests or from the browser directly.
- Do not add retries, polling, caching, request history, telemetry, logging,
  accounts, authentication or a database.
- Do not persist lookup responses, skill levels, source metadata, request URLs
  or additional player-name history.
- Do not change D-065 query/log privacy or D-067 adopter-evidence boundaries.
- Do not change player-name validation, supported skills, form normalization,
  setup persistence or `SimulationRequest`.
- Do not merge setup/PriceSet import-export, legacy migration orchestration or
  other topbar actions into this goal.
- Do not redesign, relocate or restyle the header.
- Do not add a new React/state or test-rendering dependency.

## Target ownership

Create these modules:

- `src/app/controllers/hiscores-lookup.ts`: DOM-free state transitions,
  request-sequence/staleness decisions, sanitized status/error copy, persistence
  outcome orchestration and typed Apply outcome.
- `src/app/controllers/use-hiscores-lookup.ts`: React lifecycle wrapper that
  constructs the controller, starts the one status request and exposes a stable
  snapshot/actions contract.
- `src/app/components/topbar/hiscores-panel.tsx`: current topbar rendering plus
  native-details toggle, outside-pointer dismissal and Escape/focus behavior.

Small transition/message helpers should remain in the DOM-free controller file
when that makes them directly testable in Node Vitest. Do not duplicate request
validation, response validation or form-level application logic from the
adapter/state modules.

`App.tsx` continues to own:

- the current `CombatSetupFormState` and its safe setter;
- deriving preview rows from current form plus controller response;
- applying a fresh typed response through `applyHiscoresLevels()`;
- legacy migration orchestration, which calls the controller's explicit
  compatible-player replacement method;
- placement of the extracted panel in the topbar.

The controller receives the minimal local-state recovery callbacks required for
`hiscores-last-player`; it must not inspect recovery internals or own other
local-state IDs.

## Required controller contract

Exact names may vary, but the implementation must expose an equivalent typed
contract:

```ts
interface HiscoresLookupSnapshot {
  status: HiscoresStatusResponse | null;
  statusLabel: "checking" | "available" | "disabled" | "unavailable";
  available: boolean;
  player: string;
  response: HiscoresResponse | null;
  busy: boolean;
  previewOpen: boolean;
  notice: {
    tone: "neutral" | "success" | "error";
    message: string;
  } | null;
}

type HiscoresApplyOutcome =
  | {
      status: "ready";
      response: HiscoresResponse;
    }
  | { status: "stale" };

interface HiscoresLookupController extends HiscoresLookupSnapshot {
  changePlayer(value: string): void;
  lookup(): Promise<void>;
  setPreviewOpen(open: boolean): void;
  closePreview(): void;
  prepareApply(): HiscoresApplyOutcome;
  recordNoChanges(): void;
  replacePersistedPlayer(player: string): boolean;
}
```

The controller/hook dependencies are injected or defaulted behind typed
interfaces:

```ts
interface HiscoresLookupDependencies {
  storage: KeyValueStorage;
  fetchStatus: () => Promise<HiscoresStatusResponse>;
  lookupPlayer: (player: string) => Promise<HiscoresResponse>;
  clearStorageFailures(ids: readonly LocalStateHealthItemId[]): void;
  recordStorageFailure(id: LocalStateHealthItemId, reason: "save_failed"): void;
  unblockReplaced(ids: readonly LocalStateHealthItemId[]): void;
  refreshLocalStateHealth(): void;
}
```

Production defaults use the current adapter functions. Tests inject deferred
promises and memory/failing storage. Passing a minimal callback bridge is
preferred over importing the complete local-state recovery hook contract.

The controller snapshot/action references used by effects should be stable.
The implementation may follow the existing external-store controller pattern
or use an equivalently testable reducer/core; do not make React rendering the
only way to test request-race behavior.

## Panel contract

The panel receives the controller snapshot/actions, current preview rows,
`canApply` and one caller-owned `onApply` callback. It may derive presentation
that depends only on those props, including the row count and response metadata.

It must not import:

- `src/adapters/hiscores` or any other network adapter;
- storage/local-state recovery modules;
- `CombatSetupFormState` or form mutation helpers;
- server/provider modules.

It may import value-only domain/UI row types. Its only browser side effects are
the current open-disclosure outside-pointer/Escape listeners and focus return.
Those listeners must be installed only while open and removed on close/unmount.

## `App.tsx` end state

After the extraction, `App.tsx` should no longer declare or implement:

- `hiscoresStatus`, `hiscoresPlayer`, `hiscoresResponse`,
  `hiscoresPreviewOpen`, `hiscoresBusy` or `hiscoresNotice` state;
- player/request sequence refs or preview DOM refs;
- status-fetch, input-ref synchronization or disclosure dismissal effects;
- status/error message mapping;
- lookup, player-change or preview-toggle orchestration;
- direct `loadLastHiscoresPlayer`, `saveLastHiscoresPlayer`,
  `fetchHiscoresStatus` or `lookupHiscores` calls;
- the topbar Hiscores JSX.

It may retain a small preview-row derivation and Apply wrapper because they
bridge controller response data to caller-owned form state. Compatible legacy
migration calls `replacePersistedPlayer()` instead of using adapter/setter calls
directly.

## Implementation sequence

1. Add focused DOM-free controller tests for status, request races, freshness,
   failures, persistence and Apply outcomes.
2. Extract pure message/status/transition logic and the async request sequence
   into the controller core using injected dependencies.
3. Add the hook, route startup status and normal lookup through it, and preserve
   all existing visible states.
4. Route fresh-response persistence and legacy compatible-player replacement
   through the controller's local-state recovery bridge.
5. Move the topbar section and bounded disclosure focus behavior to the panel.
6. Leave only preview-row derivation and the caller-owned level mutation in
   `App`, then remove superseded imports/state/effects/helpers.
7. Update architecture, testing, composition-root and backlog documentation with
   actual implementation evidence.

Do not mix a behavioral cleanup into this ownership change. If extraction
reveals a current UX defect, document it separately instead of silently changing
the contract.

## Required tests and validation

Add `src/tests/hiscores-lookup-controller.test.ts`. Use injected deferred
promises, `createMemoryStorage` and throwing storage doubles. The controller
suite must prove:

- initial stored-player loading without response or level mutation;
- checking, available, disabled, unavailable and rejected-status outcomes;
- empty input and unavailable service never call lookup;
- one matching latest response opens a current preview and persists only its
  validated player;
- a changed input rejects the latest late response with the existing neutral
  copy;
- a superseded response and error cannot change newer request or busy state;
- player changes clear only stale response/success notice and preserve
  normalized-same-player freshness;
- all adapter error categories map to fixed sanitized messages without raw
  error leakage;
- save failure keeps response/session state and records only
  `hiscores-last-player/save_failed`;
- successful save clears only that failure and uses replacement-unblock without
  a clear-path skip;
- compatible legacy replacement persists/updates input without starting a
  lookup;
- fresh Apply returns the response/count and stale Apply returns no response or
  mutation authority;
- the panel keeps the landmark, names, roles, metadata, table and button DOM for
  idle, notice, preview and busy states.

Retain the existing E2E case as the browser truth for native-details open,
Escape focus return, outside-pointer close, input-change invalidation,
late-response rejection and Apply. The default disabled/manual fallback case
must also remain green. Automated tests stay fully mocked.

Run at minimum:

```sh
npm run test -- src/tests/hiscores-lookup-controller.test.ts src/tests/hiscores-ui-state.test.ts src/tests/hiscores-adapter.test.ts src/tests/local-state-recovery-controller.test.ts src/tests/live-integrations.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "hiscores"
npm run test:e2e -- --workers=1
npm run verify
git diff --check
```

No golden, generated-data, server fixture, persistence schema, CSS or visual
baseline update is expected. If the extracted panel changes layout pixels
despite the no-CSS/no-DOM-change contract, run the visual suite and treat the
diff as a regression unless separately reviewed.

## Acceptance criteria

- `App.tsx` no longer owns generic Hiscores lifecycle, request, persistence or
  panel state/markup beyond the typed form Apply bridge.
- Status, input, response, busy, preview and notice transitions have one
  testable controller owner.
- Only the latest response matching the normalized current input may render,
  persist or become eligible for Apply.
- Player input remains usable and manual levels remain editable in every
  disabled/unavailable/error state.
- Last-player storage, local-state recovery and compatible legacy replacement
  preserve their existing key/schema and failure/block behavior.
- The controller has no combat-form, calculation, server or DOM dependency.
- The panel has no network, storage, recovery or form-mutation dependency.
- Existing topbar copy, roles, labels, class names, DOM order, focus behavior,
  responsive selectors and button names are unchanged.
- D-061 source, D-065 privacy, D-066 deployment and D-067 adopter-evidence
  boundaries remain unchanged.
- Focused tests, complete Chromium coverage and the repository verification gate
  pass, with architecture/testing/composition docs updated in the same change.

## Implementation evidence

- `src/app/controllers/hiscores-lookup.ts` owns the DOM-free status, input,
  latest-request, preview, notice, persistence/recovery and typed Apply
  transitions. `use-hiscores-lookup.ts` starts the one lifecycle status request
  and exposes stable external-store actions.
- `src/app/components/topbar/hiscores-panel.tsx` owns the unchanged topbar
  landmark/form/notice/preview DOM and only the disclosure-scoped outside
  pointer, Escape and focus-return effects. It has no adapter, storage,
  recovery or combat-form dependency.
- `App.tsx` retains only current-form preview-row derivation, the safe
  `applyHiscoresLevels()` mutation/Undo bridge, legacy import orchestration
  through `replacePersistedPlayer()` and panel placement. Direct Hiscores
  adapter calls, local state, request/input/DOM refs, effects, messages,
  handlers and inline panel JSX are gone.
- The new focused suite passes 19/19; the combined required Hiscores/recovery
  command passes 55/55. Mocked targeted Chromium coverage passes 2/2 and the
  complete production-preview Chromium gate passes 76/76.
- Architecture passes at 76 source modules / 63 client-reachable modules with
  no cycle or exception. Full `npm run verify` passes 664 unit tests, 19
  explicit goldens and all non-network gates. The direct entry remains inside
  D-094 budgets at 693,270 raw / 199,784 gzip bytes; the 880,362-byte generated
  snapshot remains deferred. The 10-file/two-asset artifact SHA-256 is
  `9fee2ce16c8a5d0a39d853d8d9c0991f1eb99343bea795c2f7b291738638765d`.
- No provider, API, privacy, schema, storage-key, CSS or calculation contract
  changed in this extraction. Dependency audit was skipped under the
  documented network-disabled policy.

The 2026-07-20 Apply/Undo follow-up supersedes only the former controller-owned
`recordApplied()` success copy. `prepareApply()` remains the synchronous
freshness authority; `recordNoChanges()` now publishes
`Current levels already match Hiscores` without closing the preview. App owns
the immutable form transaction and global `Applied N levels` Undo strip.

## Open questions

None block this extraction. Setup/PriceSet file-transfer controllers, remaining
legacy orchestration and the first complete feature-pane extraction remain
separate future goals.

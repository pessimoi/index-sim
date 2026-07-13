# Rewrite setup file-transfer controller specification

Status: implemented as composition-root Goal 8, 2026-07-13.

## Purpose

The rewrite setup schema, compatibility validation, versioned persistence and
browser JSON helpers already existed. The implementation moves their file
transfer orchestration from `src/app/App.tsx` into a directly tested controller
and hook while leaving the live setup mutation in `App`.

The completed goal extracts that cohesive orchestration into a DOM-free controller plus
a thin React hook. `App` continues to own the live setup values and applies only
a typed successful import outcome. The current topbar DOM remains in place so
the structural refactor cannot reorder the adjacent PriceSet, Share or notice
elements.

## Verified pre-refactor ownership

- `src/app/state/setup-import.ts` owns the 250,000-byte text limit,
  duplicate-key-safe JSON parsing, version/schema validation and current
  `GameDataSnapshot` compatibility check.
- `src/app/state/ui-state.ts` owns `SavedSetupSchema`, the version-3 persisted
  contract, normalization and `savedSetupFromForm()`.
- `src/adapters/browser/index.ts` owns bounded browser file reading and JSON
  download mechanics.
- `src/app/controllers/local-state-recovery.ts` owns versioned persistence
  failure, block, replacement-unblock and report behavior.
- Before extraction, `App.tsx` owned the live form, default form, setup mode, custom setups, Dense
  preferences and per-monster cannon state. Those values are also consumed by
  normal persistence, simulation and feature workflows outside file transfer.

The implementation reuses these boundaries instead of duplicating schemas,
compatibility checks, storage envelopes or browser download code.

## Current behavior to preserve

### Topbar and file selection

- `Import setup` remains a `label.file-button` in the topbar actions, after
  `Import prices` and before `Export setup`.
- Its input remains `type="file"` with
  `accept="application/json,.json"`. The browser MIME value and filename are
  not separately trusted or rejected; content validation remains authoritative.
- The first selected file is used. No file means no import attempt.
- The main shell and this input render only after `SimulationContext` exists,
  so the current `GameDataSnapshot` is available for compatibility validation.
- After every attempted import, success or failure, the input value returns to
  an empty string. This permits selecting the same file again. Reset stays in a
  tiny DOM/event bridge in `App`; the controller must not retain an input
  element or mutate the DOM.
- There is currently no busy state, spinner, request cancellation, sequence
  guard or disabled import/export state. Do not add one in this ownership-only
  goal. Concurrent attempts retain their existing promise-settlement behavior.

### Bounded read and validation

- Browser reading uses `readBrowserFileText(file, SETUP_IMPORT_MAX_BYTES)`.
  `file.size` above 250,000 bytes rejects before `file.text()`.
- `parseSavedSetupExportText()` independently measures UTF-8 text bytes against
  the same limit. Both oversized paths produce the same visible message.
- Parsing rejects duplicate JSON keys, malformed JSON, any version other than
  `REWRITE_SETUP_VERSION` 3, invalid strict envelope/data shapes and entities or
  active loadout combinations unavailable in the current generated game data.
- The validated import result is `parsed.data: SavedSetupState`. Imported
  `savedAt` is validation metadata only; it is not reused as the local
  persistence timestamp.
- The parser remains the only file-contract owner. The controller must not call
  `JSON.parse`, Zod schemas or `savedSetupCompatibilityIssues()` directly.

### Persistence and local-state recovery

- A validated setup is passed once by the controller to an injected
  `persistSetup(setup)` bridge. Production connects that bridge to
  `localStateRecovery.persist("rewrite-setup", setupStorageOptions, setup)`.
- Persistence therefore keeps key `index-sim:rewrite-setup`, version 3,
  `SavedSetupSchema` and a fresh local envelope timestamp. The imported
  envelope is never copied wholesale into storage.
- A `true` persistence result means the controller reports `Imported rewrite
setup`; `false` means `Imported rewrite setup for this session`.
- Either persistence outcome is still a successful in-memory import. The
  controller then calls replacement-unblock for only `rewrite-setup` and
  refreshes the local-state health report. It must not add a clear-path
  one-shot persistence skip.
- The existing normal setup persistence effect stays in `App`. Applying the
  imported values may cause that effect to write the same current setup again,
  as it can today; this goal does not introduce a suppression or change the
  ready-to-persist policy.
- A parse/read failure performs no direct persistence, unblock or recovery
  refresh. It must not change or clear the previously stored setup.

### Caller-owned application

On a typed ready outcome, `App` applies the complete validated state in the
current order and with the current normalization boundaries:

1. `form` through `normalizeFormState()`;
2. `defaultForm` through `normalizeFormState()`;
3. `setupMode`;
4. `customSetupsByMonster`;
5. `denseCompare`;
6. `cannonByMonster`.

It then sets the controller-provided status message and clears `fatalError`.
The controller must not receive React setters, `CombatSetupFormState` fragments
or individual feature values. It returns one already validated
`SavedSetupState`, so a rejected import has no mutation authority and partial
application is impossible.

A successful import does not directly change Duel snapshots, loot preferences,
loot settings, hidden tiers, Planner UI state, PriceSet/history/manual prices,
Hiscores player, legacy-migration dismissal, active tab, calculated output or
share state. Downstream calculations react to the applied live form through the
existing app flow.

### Import notices and status

- Starting an import clears the earlier setup import notice while reading and
  validating.
- Persisted success shows a success notice with exact message
  `Imported rewrite setup.`
- Session-only success shows a success notice with exact message
  `Imported rewrite setup for this session. Local storage is unavailable, so changes may not persist after reload.`
- Success sets the global status to the matching message without the final
  period: `Imported rewrite setup` or
  `Imported rewrite setup for this session`.
- Failure leaves the global status, fatal error, visible setup and persisted
  setup unchanged. It replaces only the setup import notice.
- The notice continues through `InlineImportNotice` with
  `aria-label="Setup import notice"` and classes
  `topbar-import-notice setup-import-notice`. Error notices retain `alert` and
  success retains `status` through that existing presenter.

The fixed failure mapping is:

| Failure                           | Visible result                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| browser or parser size limit      | `Setup import failed: the file is too large. Choose an exported setup JSON under 250 KB.`                     |
| duplicate keys                    | `Setup import failed: the JSON contains duplicate keys.`                                                      |
| malformed JSON                    | `Setup import failed: the file is not valid JSON.`                                                            |
| unsupported version               | `Setup import failed: this app only supports rewrite setup version 3. Export a fresh setup and try again.`    |
| current-game-data incompatibility | `Setup import failed: the setup references data unavailable in this game version.` plus sanitized issue paths |
| other invalid setup data          | `Setup import failed: the file is not a valid rewrite setup export.` plus sanitized issue paths               |
| any other error                   | `Setup import failed. Check the file and try again.`                                                          |

Issue detail remains bounded to the parser-provided list, replaces local paths,
collapses whitespace, trims, and caps each displayed detail at 180 characters.
Raw JSON, field values, stack traces, local paths and unexpected error messages
must not enter UI notices, logs or test artifacts.

The current `ZodError` branch, `formatZodIssuePath()` and
`zodIssueSummaries()` in `App.tsx` are unreachable from this production import
path: `parseSavedSetupExportText()` converts schema failures to
`SetupImportError`. The implementation may remove those dead declarations and
the now-unused `ZodError` import after the focused error-mapping tests cover the
observable paths. Keep the `SetupImportError` issue sanitizer.

### Export

- `Export setup` remains the same enabled `button type="button"` in the topbar,
  immediately after the import label and before `Share setup`.
- `App` creates the current `SavedSetupState` with `savedSetupFromForm(form,
denseCompare, cannonByMonster, customSetupsByMonster, defaultForm,
setupMode)` and passes that complete value to the controller. The controller
  must not reconstruct it from separate state fragments.
- The controller downloads `index-sim-rewrite-setup.json` through the existing
  `downloadJsonFile()` adapter with exact envelope shape:

  ```ts
  {
    version: REWRITE_SETUP_VERSION,
    savedAt: now().toISOString(),
    data: setup
  }
  ```

- Export keeps the adapter's current pretty two-space JSON serialization,
  `application/json` Blob, object URL, noopener anchor click and immediate URL
  revocation.
- Export does not read or write localStorage, change the global status, create
  or clear an import notice, clear a fatal error, start a calculation or include
  unrelated browser state.
- The export includes only the version-3 rewrite setup contract. Duel snapshots,
  loot preferences/settings, hidden tiers, Planner state, PriceSets, price
  history, manual price overrides, Hiscores identity, legacy state, share state
  and computed results remain excluded.

## Goal

- Give setup import notice, read/parse, persistence/recovery and export envelope
  orchestration one directly testable owner.
- Keep setup values and the actual six-state Apply mutation in `App` behind one
  explicit typed successful outcome.
- Preserve the existing state/schema, browser adapter, local-state recovery and
  topbar DOM boundaries.
- Remove the setup-specific error helpers and inline export orchestration from
  `App`, including the proven unreachable Zod-only branch.

## Non-goals

- Do not change `SavedSetupSchema`, envelope version, storage key, import size
  limit, compatibility policy, normalization or setup persistence effect.
- Do not merge rewrite setup transfer with Duel saved-setup transfer,
  shareable permalinks, PriceSet transfer or legacy migration.
- Do not add migration for older rewrite setup versions or partial/merge import.
- Do not add drag-and-drop, multi-file import, MIME/filename allowlists,
  progress, cancellation, latest-request-wins behavior, Undo, confirmation or
  export notices.
- Do not add a server upload, cloud save, account, database, telemetry or log.
- Do not change calculations, generated data, `SimulationRequest`, CSS, copy,
  topbar layout, DOM order, roles, labels or file-button behavior.
- Do not add a React/state or test-rendering dependency.

## Implemented ownership

Created:

- `src/app/controllers/setup-file-transfer.ts`: external-store snapshot,
  sanitized import messages, async import orchestration, recovery bridge,
  typed outcome and deterministic export-envelope construction/download call.
- `src/app/controllers/use-setup-file-transfer.ts`: React wrapper that binds the
  browser `File` reader and download adapter to a stable controller instance.
- `src/tests/setup-file-transfer-controller.test.ts`: focused controller and
  contract coverage using injected files, time, download and persistence
  callbacks.

Do not extract a topbar component in this goal. Keeping the existing setup
controls and notice at their current sibling positions avoids moving the Price
import notice, Share button or Share notice. A later complete topbar-actions
component may reconsider the group as its own independently specified goal.

`src/app/state/setup-import.ts` stays the parser/compatibility owner,
`src/app/state/ui-state.ts` stays the schema/normalization owner and
`src/adapters/browser` stays the concrete File/download owner.

## Required controller contract

Exact names may vary, but the implementation must expose an equivalent typed
contract:

```ts
interface SetupFileTransferNotice {
  tone: "success" | "error";
  message: string;
  details?: string[];
}

interface SetupFileTransferSnapshot {
  notice: SetupFileTransferNotice | null;
}

type SetupImportOutcome =
  | {
      status: "ready";
      setup: SavedSetupState;
      persisted: boolean;
      appStatus: "Imported rewrite setup" | "Imported rewrite setup for this session";
    }
  | { status: "rejected" };

interface SetupFileTransferDependencies<TFile> {
  readFileText(file: TFile, maxBytes: number): Promise<string>;
  persistSetup(setup: SavedSetupState): boolean;
  unblockReplaced(ids: readonly LocalStateHealthItemId[]): void;
  refreshLocalStateHealth(): void;
  downloadJsonFile(fileName: string, value: unknown): void;
  now(): Date;
}

interface SetupFileTransferController<TFile> extends SetupFileTransferSnapshot {
  importFile(file: TFile, gameData: GameDataSnapshot): Promise<SetupImportOutcome>;
  exportSetup(setup: SavedSetupState): void;
}
```

The generic file parameter keeps the core free of DOM and browser-global types.
The production hook instantiates it for `File` using
`readBrowserFileText(file, SETUP_IMPORT_MAX_BYTES)`. Node tests use a small fake
file type or deferred reader without jsdom. The core calls the existing parser
with the same maximum after reading.

The hook input receives a stable `persistSetup` callback and the public
replacement-unblock/refresh recovery actions. It must not inspect recovery
snapshot internals or operate on any local-state id other than
`rewrite-setup`. Snapshot and action references exposed to React must remain
stable.

## `App.tsx` end state

`App` retains:

- the six live setup state owners and `savedSetupFromForm()` composition;
- a small file-input event bridge that selects the first file, awaits
  `importFile()`, applies only a ready outcome and resets the input in `finally`;
- an `exportCurrentSetup()` bridge that passes one complete
  `SavedSetupState` to `exportSetup()`;
- global status and fatal-error setters applied only after a ready outcome;
- the existing topbar JSX and `InlineImportNotice`, now reading the controller
  notice.

`App` no longer owns:

- `setupImportNotice` state;
- `describeSetupImportError()`, its setup-only sanitizers or the unreachable
  Zod issue branch;
- direct `parseSavedSetupExportText()` or `SETUP_IMPORT_MAX_BYTES` usage;
- setup-specific persistence/recovery sequencing;
- export filename, version/timestamp envelope or direct setup download call.

The shared `readBrowserFileText` and `downloadJsonFile` imports may remain in
`App` for PriceSet, Duel, recovery or other file workflows until their own
controllers are extracted. Do not remove a shared adapter import merely because
setup transfer no longer uses it directly.

## Implementation sequence

1. Add the focused controller suite around current error copy, persistence
   outcomes, recovery order and export envelope.
2. Implement the generic DOM-free controller with injected file, persistence,
   download and time dependencies while reusing the existing setup parser.
3. Add the React hook with the current browser adapter defaults and stable
   external-store actions.
4. Route import through the typed outcome; keep all six state mutations in one
   caller block and keep input reset in `finally`.
5. Route export through one complete `SavedSetupState` value.
6. Remove superseded setup-specific App state/helpers/imports and verify that
   the topbar markup and sibling order did not change.
7. Add browser coverage for successful import/export and rerun the existing
   failure/retry case plus complete Chromium and release gates.
8. Update this spec, architecture, testing, composition and backlog documents
   with actual module counts, test counts and artifact evidence.

## Required tests and validation

Add `src/tests/setup-file-transfer-controller.test.ts`. It must prove:

- initial notice is absent and export does not create one;
- a valid current setup produces one ready outcome containing the exact
  validated `SavedSetupState`;
- persisted success and session-only success produce their exact notice and
  global-status variants;
- successful import calls the injected persist bridge once, then unblocks only
  `rewrite-setup` and refreshes recovery;
- a `false` persist result remains ready and does not drop the session state;
- reader-size and UTF-8 parser-size failures share the fixed large-file copy;
- duplicate, malformed, unsupported, invalid-data and incompatible-entity
  categories map to the fixed sanitized notices;
- arbitrary read/persist errors never leak their raw messages and return no
  mutation authority;
- rejected imports never persist, unblock, refresh or return setup data;
- issue details are bounded, whitespace-normalized and path-sanitized;
- export calls the download dependency exactly once with the exact filename,
  version, fixed ISO timestamp and supplied setup, without persistence or
  notice changes;
- deferred reads preserve the current settlement behavior without adding a
  hidden sequence or cancellation policy.

Retain `src/tests/setup-import.test.ts` as parser truth and the applicable setup
persistence/recovery cases in `ui-adapters.test.ts` and
`local-state-recovery-controller.test.ts`.

Extend the mocked production-preview browser coverage to prove:

- export suggests `index-sim-rewrite-setup.json` and contains the current strict
  version-3 envelope without unrelated state;
- a successful import restores the exported active/default/custom/Dense/cannon
  setup values, updates the rewrite setup storage and shows the persisted or
  session-only success copy;
- the existing invalid JSON and unsupported-version attempt keeps visible and
  persisted state unchanged and leaves the same input empty/retryable;
- the topbar control and notice DOM order, names, roles and classes remain
  unchanged.

Run at minimum:

```sh
npm run test -- src/tests/setup-file-transfer-controller.test.ts src/tests/setup-import.test.ts src/tests/ui-adapters.test.ts src/tests/local-state-recovery-controller.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "setup import|Export setup"
npm run test:e2e -- --workers=1
npm run verify
git diff --check
```

No golden, generated-data, API, CSS or visual-baseline update is expected. If
the production artifact changes layout pixels despite the no-DOM/no-CSS
contract, treat that as a regression and run the visual suite before accepting
it. If request composition or normalized setup values change unexpectedly, stop
the structural goal and rerun numeric/golden evidence rather than updating
fixtures inside the extraction.

## Acceptance criteria

- One DOM-free controller owns setup import notice, read/parse,
  persistence/recovery and export-envelope orchestration.
- Only a typed ready outcome can authorize the caller to replace the six live
  setup areas; rejected imports cannot partially mutate session or storage.
- The setup parser, schema, compatibility, storage and browser adapter owners
  remain unchanged and unduplicated.
- The 250,000-byte limits, version 3 envelope, fresh local persistence
  timestamp, exact filename, exact copy and retryable input behavior remain
  unchanged.
- `App` retains live feature state and tiny DOM/apply bridges but no generic
  setup file-transfer state machine or error mapping.
- Export includes the current rewrite setup only and has no notice, status,
  persistence or calculation side effect.
- Existing topbar DOM order, roles, labels, class names and CSS selectors remain
  unchanged.
- PriceSet, Duel, shareable setup and legacy transfer workflows remain separate.
- Focused tests, complete Chromium coverage and the repository verification gate
  pass, and owning documentation records actual implementation evidence.

## Implementation evidence

- `src/app/controllers/setup-file-transfer.ts` implements the generic DOM-free
  state machine; `use-setup-file-transfer.ts` binds the existing browser
  adapters through stable external-store actions.
- `App.tsx` applies only a typed ready outcome to form, default form, setup mode,
  custom setups, Dense state and Cannon state. It retains the input reset and
  exact topbar sibling order, and is now 8,092 lines.
- The setup-specific notice state, inline import/export orchestration and the
  unreachable Zod-only error branch/import were removed from `App`.
- The new controller suite passes 12/12; the required combined controller,
  parser, adapter and recovery command passes 78/78. Targeted production-preview
  coverage passes 2/2 and the complete Chromium gate passes 77/77.
- `npm run architecture:check` passes at 78 source modules / 65 client-reachable
  modules with no cycles or exceptions. Full `npm run verify` passes 676 unit
  tests, 19 explicit goldens and all non-network gates.
- The 10-file/two-asset artifact is 1,949,685 bytes with SHA-256
  `be5fffa96594804531c3dedb7e16b0accd0751977fcb338b1b779cc0094f7b0f`.
  Direct entry JavaScript is 694,107 raw / 200,282 gzip bytes; the 880,362-byte
  generated runtime chunk remains deferred. The network-disabled gate skips
  only dependency audit under the documented policy.

## Open questions

None block this extraction. The PriceSet import/acceptance controller is the
recommended next controller because it has a separate generated-alch,
manual-overlay, selected-persistence and price-history contract. Remaining
legacy orchestration and the first complete feature-pane extraction stay
separate future goals.

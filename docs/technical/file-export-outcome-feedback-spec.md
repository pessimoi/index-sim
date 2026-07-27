# Browser file-export outcome and feedback specification

- Status: implemented
- Date: 2026-07-21
- Owner: browser download adapter and existing file-transfer controllers
- Evidence: verified
- Contract: closed

- Priority: high
- Estimated effort: M
- Feature-inventory parents: Basic combat setup, Setup comparison, Market price
  sync and Workspace backup/restore (`Valmis`)
- Depends on: current validated export builders and existing workflow-local
  notice surfaces

## Purpose

Make every existing JSON export request use one typed browser outcome and give
truthful, visible feedback when the request starts or fails.

The current browser adapter serializes a value, creates a Blob URL, clicks a
detached anchor and revokes the URL immediately. Callers generally receive no
outcome. Setup export has no export notice, saved Duel setup and PriceSet export
announce success unconditionally, Workspace catches synchronous exceptions but
says the backup was “downloaded”, and the local-state recovery report also
announces an unconditional export.

A web page cannot verify that the browser or operating system ultimately saved
the file. This goal therefore distinguishes a successfully dispatched download
request from a completed download and normalizes synchronous failures without
leaking browser errors.

## Verified current behavior and problem

- `src/adapters/browser/index.ts::downloadJsonFile()` returns `void`.
- It calls `JSON.stringify(value, null, 2)`, constructs an
  `application/json` Blob, creates an object URL, calls `anchor.click()` and
  revokes the URL in the same stack.
- The anchor is not appended to the document. This works in current Chromium
  evidence but is not covered by a Firefox or WebKit contract.
- `SetupFileTransferControllerCore.exportSetup()` delegates to the adapter and
  publishes no export outcome or notice.
- `App.tsx::exportDuelSnapshots()` calls the adapter directly and then publishes
  `Exported ... saved setups` regardless of adapter behavior.
- `PriceSetTransferControllerCore.exportPriceSet()` calls the adapter directly,
  then returns `Exported active PriceSet` and a success Market notice.
- `WorkspaceFileTransferControllerCore.exportWorkspace()` catches synchronous
  exceptions but reports `Workspace backup downloaded.` after a void adapter
  call.
- `LocalStateRecoveryController.exportReport()` calls the adapter and then
  reports `Exported local state recovery report` without a failure outcome.
- Export builders and parsers already validate their workflow-specific
  envelopes, caps, generated-data context and privacy boundaries. Those
  contracts are not the problem.

Users can therefore receive no feedback or an affirmative completed-download
message even when serialization, Blob/Object URL construction or click
dispatch fails. An immediate object-URL revoke also lacks a deliberate
cross-browser lifetime contract.

## Feature-inventory check

Setup import/export, Setup comparison, advanced PriceSet tools, Workspace
backup/restore and Local state recovery remain implemented. This specification
does not add a new transfer format or an additional export surface. It hardens
the outcome and feedback for the existing actions.

All parent statuses remain `Valmis`. The backlog card is a finishing pass over
those workflows and must not be described as a new backup or sharing feature.

## User promise

After every export action, the user receives exactly one truthful outcome:

- `<Artifact> download started: <filename>. Check your browser downloads.`; or
- `<Artifact> download could not be started. Try again.`

`Download started` means serialization, browser object-URL creation and
user-gesture click dispatch completed without a synchronous error. It does not
mean the user accepted a browser prompt, the browser retained the file or the
operating system wrote it to disk.

## Goals

- Replace the void browser adapter contract with a closed typed result.
- Keep JSON serialization, MIME type, filename and pretty formatting unchanged.
- Make the concrete browser mechanics resilient across supported browsers by
  using a connected temporary anchor and delayed object-URL revocation.
- Catch and normalize serialization, browser-API and dispatch failures.
- Route one request/failure result into every existing workflow-local notice
  and the global action status where that workflow already uses it.
- Keep the original export action available as the Retry path.
- Add direct adapter tests, controller tests and real Playwright download-event
  evidence.
- Preserve all current privacy and transfer-scope exclusions.

## Non-goals

- Do not claim or attempt to detect completed filesystem persistence.
- Do not add the File System Access API, server uploads, cloud storage, email,
  native share sheets or a download history.
- Do not add a new JSON preview or copy-to-clipboard fallback for Workspace or
  recovery data.
- Do not hold exported Workspace, setup, player or price payloads in a new
  long-lived React state after dispatch.
- Do not change export envelope kinds, versions, contents, timestamps,
  filenames, byte limits or generated high-alch authority.
- Do not change import parsing, review, Apply, Merge, persistence or Undo.
- Do not persist export notices or file metadata.
- Do not expose serialized JSON, browser exception strings, Blob URLs, local
  paths or stack traces in visible notices, logs or DOM attributes.
- Do not add a new global toast system.

## In-scope export inventory

| Export action               | Existing builder/owner                    | Required notice owner                       |
| --------------------------- | ----------------------------------------- | ------------------------------------------- |
| Rewrite setup               | setup file-transfer controller            | setup transfer notice plus global status    |
| Saved Duel setups           | Duel state builder and current App bridge | existing Duel transfer notice/global status |
| Active PriceSet             | PriceSet transfer controller              | existing Market notice/global status        |
| Workspace backup            | Workspace file-transfer controller        | existing Workspace notice                   |
| Local-state recovery report | local-state recovery controller           | existing recovery notice/global status      |

No other browser download becomes in scope implicitly. A future export must
adopt the same typed adapter contract and be added to an exhaustive call-site
test or inventory.

## Browser adapter contract

Use a closed synchronous result equivalent to:

```ts
export type JsonDownloadRequestResult =
  | {
      status: "requested";
      fileName: string;
      byteLength: number;
    }
  | {
      status: "failed";
      reason: "serialization" | "browser-api" | "dispatch";
    };

export function requestJsonDownload(fileName: string, value: unknown): JsonDownloadRequestResult;
```

Exact names may vary. The result is synchronous so the anchor click stays in
the original user activation. Controllers must also normalize an unexpected
throw from an injected test/custom dependency into the same failed UI outcome.

The `reason` is test/controller routing metadata. User-visible copy never
includes it.

### Serialization

1. Run the existing `JSON.stringify(value, null, 2)` exactly once.
2. Treat a thrown error or non-string result as `serialization` failure.
3. Measure UTF-8 bytes from the serialized string for result metadata only.
4. Do not revalidate or rewrite workflow-specific data in the browser adapter.
5. Construct one Blob with MIME `application/json` from that exact string.

Workflow builders remain responsible for schema validation and size limits.
The adapter must not invent a generic maximum that could disagree with those
contracts.

### Object URL and anchor lifetime

1. Treat unavailable `Blob`, `URL.createObjectURL`, `document` or append/click
   mechanics as `browser-api` or `dispatch` failure.
2. Create one temporary `a` with the exact supplied filename, object URL and
   `rel="noopener"`.
3. Hide the anchor without making it keyboard-focusable and append it to
   `document.body` before click dispatch.
4. Call `click()` synchronously.
5. Remove the anchor in `finally` after dispatch attempt.
6. Revoke a created object URL exactly once after the current task yields, not
   in the same stack as `click()`.
7. Bound pending revoke callbacks to one per invocation; no URL may remain
   retained after its callback runs.

A zero-delay timer is acceptable. Microtask revocation is not sufficient unless
direct Firefox and WebKit evidence proves the URL remains usable through their
download capture boundary.

### Failure behavior

- If serialization fails, create no Blob, URL or anchor.
- If URL construction fails, create no anchor and schedule no invalid revoke.
- If append or click fails after URL creation, remove the anchor, revoke the URL
  through the same bounded cleanup path and return `failed`.
- Cleanup failures must not replace the primary typed outcome or escape to the
  UI. Direct adapter tests may assert them through injected fakes, but no raw
  error is retained.
- A `requested` result is immutable and contains no serialized value or URL.

## Controller and workflow outcomes

Define one small pure mapper for artifact labels and fixed copy, or keep
workflow-local mappers with an exhaustive shared result union. Do not parse
adapter errors or messages.

| Workflow     | Requested copy                                                                 | Failed copy                                                  |
| ------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Setup        | `Setup download started: <filename>. Check your browser downloads.`            | `Setup download could not be started. Try again.`            |
| Saved setups | `Saved setup download started: <filename>. Check your browser downloads.`      | `Saved setup download could not be started. Try again.`      |
| PriceSet     | `PriceSet download started: <filename>. Check your browser downloads.`         | `PriceSet download could not be started. Try again.`         |
| Workspace    | `Workspace backup download started: <filename>. Check your browser downloads.` | `Workspace backup download could not be started. Try again.` |
| Recovery     | `Recovery report download started: <filename>. Check your browser downloads.`  | `Recovery report download could not be started. Try again.`  |

The implementation may omit the filename from compact visible copy only when
the exact filename remains accessible in an adjacent description. The product
must not use `downloaded`, `saved`, `exported successfully` or equivalent
completed-persistence wording.

An equivalent workflow outcome is:

```ts
type FileExportOutcome =
  | { status: "requested"; fileName: string; appStatus: string }
  | { status: "failed"; appStatus: string };
```

Required behavior:

- requested outcomes use neutral or informational presentation, not an
  assertion that durable save succeeded;
- failed outcomes use the existing error tone and status/live-region path;
- one click produces one workflow notice and at most one global announcement;
- export failure performs no storage, live-state, import-review, reset,
  calculation or Undo mutation;
- export request success clears only earlier export failure for the same
  workflow; and
- import notices and prepared import reviews remain unchanged.

## Workflow-specific contracts

### Rewrite setup

- Preserve the current contextual setup envelope and
  `index-sim-rewrite-setup.json` filename.
- Add export request/failure state to the existing setup transfer controller
  rather than a second topbar state cell.
- Export must not dismiss a prepared setup import review.
- The topbar notice needs a transfer-oriented accessible label if it can now
  represent both import and export.

### Saved Duel setups

- Preserve the contextual saved-setup envelope, collection cap and
  `index-sim-saved-setups.json` filename.
- Move direct adapter outcome mapping out of the large App bridge into the
  current Duel file-transfer/notice boundary or a focused controller helper.
- Export must not invalidate a pending import review, rename edit, calculated
  matrix or saved-setup Undo.

### PriceSet

- Preserve sanitized `index-sim-price-set-<id>.json` naming and export the
  active PriceSet exactly as currently accepted.
- Return the typed outcome from `exportPriceSet()` and publish its Market
  notice.
- A failed request must not close pending PriceSet reset confirmation; a
  requested export may retain the current behavior only if the reason for
  closing reset remains documented and tested. Prefer keeping the independent
  reset review unchanged.

### Workspace backup

- Build and validate the complete export before calling the adapter.
- Distinguish builder/validation failure from request failure internally while
  keeping sanitized fixed user copy.
- Change `Workspace backup downloaded.` to the required request wording.
- Preserve the Hiscores opt-in, current live-state capture and all privacy
  exclusions.
- Do not retain the prepared envelope for Retry; the original button rebuilds a
  fresh coherent backup on each click.

### Local-state recovery report

- Preserve the metadata-only report and filename.
- Route the typed result into the current recovery snapshot and global status.
- Report generation/request failure must not mutate the health report, clear
  state or pending recovery actions.

## Retry and lifecycle contract

- The original export button is always the Retry action unless its existing
  workflow state independently disables it.
- Failure copy may say `Try again`; do not add a duplicate adjacent Retry button
  when the original named export action remains visible.
- A second click builds a fresh envelope and replaces the prior outcome for that
  workflow.
- No export action enters a long-running busy state because the request boundary
  is synchronous.
- A rapid double click creates two explicit browser requests; do not silently
  debounce user activation. Tests should avoid relying on browser filename
  collision renaming.
- Navigation or calculations do not clear a workflow's failure. A later import
  or transfer action may replace the shared workflow notice according to its
  existing ownership.

## Presentation and accessibility

- Every export button remains a native button with its existing visible name.
- Result copy is visible near the action's existing transfer surface.
- Failure uses `role="alert"` only through the existing bounded error presenter;
  requested copy uses a polite status at most once per click.
- Do not announce both workflow notice and identical hidden global status.
  Reuse the global duplicate-suppression rule or mark one owner non-live.
- The exact filename must wrap without document overflow at 390 px and compact
  landscape widths.
- Focus remains on the export button after a synchronous outcome.
- No automatic focus movement or modal is introduced.

## Ownership contract

- `src/adapters/browser` owns JSON serialization and concrete browser download
  request mechanics only.
- Workflow state/builders own envelope contents, versions, filenames and size
  validation.
- Setup, PriceSet, Workspace and recovery controllers own their typed request
  outcome and notices.
- The existing Duel file-transfer boundary or one new small controller owns its
  export outcome; `App.tsx` retains only current collection composition and
  global application wiring.
- Components render typed notices and never call Blob/Object URL APIs.
- No domain, data-schema, persistence or Worker layer imports the browser
  adapter.

## Security and privacy constraints

- Preserve all current content exclusions for setup, saved setup, PriceSet,
  Workspace and metadata-only recovery files.
- Never place serialized export content in React state, notices, error details,
  DOM attributes or logs.
- Do not expose Blob URLs or browser exception messages.
- Remove temporary anchors synchronously and revoke every created URL on the
  bounded cleanup path.
- Keep `rel="noopener"` and exact sanitized filenames.
- The recovery report remains metadata-only and Workspace's Hiscores value
  remains explicit opt-in.

## Implementation sequence

1. Add direct adapter characterization for successful serialization/click,
   immediate current cleanup and delayed URL revocation.
2. Introduce the typed adapter result and failure categories without changing
   export builders.
3. Route setup, PriceSet, Workspace and recovery controllers through the result
   and fixed request wording.
4. Move saved-setup export outcome mapping into its focused transfer boundary.
5. Update visible/accessibility copy and duplicate live-announcement handling.
6. Add production-preview download-event coverage, then include Firefox/WebKit
   cases when the cross-browser release specification is implemented.

## Required tests

### Adapter tests

Use injected browser primitives or a focused jsdom harness to prove:

- exact pretty JSON bytes, MIME type, filename and `rel` value;
- a connected temporary anchor is clicked synchronously;
- the anchor is removed after attempted dispatch;
- URL revocation happens once after the current stack, including click failure;
- serialization, unavailable API, URL creation, append and click failures map
  to the closed result without raw error leakage;
- no Blob/URL exists after serialization failure; and
- the result contains no serialized value or Blob URL.

### Controller and component tests

For all five workflows, prove:

- exact filename/value passed to the adapter;
- exact requested and failed copy;
- no false `downloaded`/`saved` wording;
- failure changes no storage, live data, review, confirmation or Undo state;
- requested outcomes clear only prior same-workflow export failure;
- the original export button remains the focused Retry path; and
- raw injected error text never reaches notices.

### Browser coverage

Playwright must wait for and inspect the browser download event for setup,
saved setup, PriceSet, Workspace and recovery report actions. For each:

- suggested filename matches the current contract;
- parsed JSON matches the existing strict envelope/content boundary;
- requested copy appears only after the action;
- no unrelated private state enters the file; and
- a deterministic injected adapter failure shows fixed error copy and keeps the
  page usable.

The browser cannot prove final filesystem persistence. Tests must not turn the
request outcome into a stronger product claim.

### Validation commands

Run at minimum:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/setup-file-transfer-controller.test.ts src/tests/price-set-transfer-controller.test.ts src/tests/workspace-backup-controller.test.ts src/tests/local-state-recovery-controller.test.ts
npm run test:e2e -- --workers=1 --grep "download|Export setup|Export active PriceSet|Workspace backup|recovery report"
npm run build
git diff --check
```

Run the complete functional Chromium suite because the shared browser adapter
serves every transfer workflow. Run read-only visual comparison if visible
notice copy changes a captured state; baseline writes require explicit review.

## Acceptance criteria

- Every existing JSON export consumes one typed browser request result.
- No workflow claims a file was downloaded or saved when only dispatch is
  observable.
- Serialization, browser-API and click-dispatch failures produce fixed visible
  error copy and no raw error disclosure.
- Temporary anchors and object URLs have deterministic bounded cleanup.
- Setup, saved setup, PriceSet, Workspace and recovery export contents,
  filenames and privacy boundaries remain unchanged.
- Export outcomes mutate no unrelated live state, storage, review, calculation
  or Undo.
- Focus, mobile containment and live announcements remain usable.
- Focused, architecture, build and complete functional checks pass.

## Documentation updates during implementation

- Mark the backlog card `Done` only after all five export workflows have source
  and browser evidence.
- Update `architecture.md` with the typed adapter/controller ownership and
  `testing.md` with the browser download-event contract.
- Update feature inventory without changing parent feature statuses.
- Record dated browser/project counts only in testing evidence.

## Open questions

None block implementation. A future explicit product goal may add a manual text
fallback for small non-sensitive exports, but Workspace and recovery payloads
remain outside that scope.

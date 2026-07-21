# Cross-browser release support specification

- Status: automated release gate implemented; branded Safari smoke not run
- Date: 2026-07-21
- Priority: high
- Estimated effort: L
- Owner: Playwright configuration, browser adapters and release testing
- Feature-inventory parents: all current rewrite workflows (`Valmis`)
- Depends on: deterministic production preview and the file-export outcome
  contract for truthful download evidence

## Purpose

Add Firefox and WebKit evidence to the Chromium-only functional release gate,
then state browser support no more broadly than the evidence allows.

The current 138-case production-preview suite and all visual baselines run only
with Playwright Chromium. That gives strong product coverage in one engine but
does not exercise browser-sensitive behavior such as module Workers,
`localStorage`, file input/download, object-URL lifetime, clipboard fallback,
native dialog focus, URL hash handling or responsive layout in Firefox and
WebKit.

This goal creates a bounded multi-engine release matrix, keeps the complete
Chromium suite intact and adds a focused cross-browser journey manifest for
every product area and browser API boundary.

## Tooling boundary

Playwright's official [browser documentation](https://playwright.dev/docs/browsers)
states that each Playwright release expects specific browser binaries and can
install Chromium, Firefox and WebKit. Its
[projects documentation](https://playwright.dev/docs/test-projects) supports
running different test selections and configurations as named projects.

The lockfile-pinned `@playwright/test` version and its installed binaries are
therefore the reproducible automated baseline. Version numbers are recorded at
evidence time with the test report; they are not copied into this living
specification.

Playwright Firefox uses a patched recent Firefox build, and Playwright WebKit is
not the branded Safari application. Automated engine evidence alone must not be
described as a real-Safari or real-device certification.

## Implemented state

- `playwright.config.ts` retains one complete `chromium` project using
  `Desktop Chrome` and excludes only visual cases plus the separately owned
  cross-browser manifest.
- `playwright.visual.config.ts` explicitly sets `browserName: "chromium"` and
  stores one platform-named snapshot family.
- `npm run test:e2e` runs the complete functional production-preview suite only
  in Chromium.
- `playwright.cross-browser.config.ts` runs only CB-01 through CB-12 in
  lockfile-pinned Firefox, desktop WebKit and iPhone 13 WebKit emulation on one
  production preview with one worker, retry traces and failure screenshots.
- `npm run test:e2e:cross-browser` owns the bounded multi-engine manifest;
  `npm run test:e2e:release` runs the complete Chromium suite followed by that
  manifest.
- The testing and operations guides own the browser installation command,
  reproducible command matrix and evidence boundaries.
- No active GitHub Actions capacity exists in this checkout. Browser evidence
  is currently a repository/local handoff gate, not an active hosted CI matrix.
- Browser code uses module Workers, browser storage, session storage, File and
  Blob/Object URL APIs, programmatic downloads, clipboard, native dialog,
  `history.replaceState`, URL fragments, animation frames and same-origin
  fetches.
- No browser-name skip, user-agent product branch, live provider request or
  broad console-error exception was added. CB-12 permits only the exact
  engine messages caused by its deliberately aborted pane module.

## Feature-inventory check

This specification adds no user workflow. It strengthens release evidence for
the already implemented rewrite and browser-local data features.

All parent statuses remain `Valmis`. A browser-specific failure is a release
quality defect or a deliberately documented support limitation, not a reason
to duplicate a feature-inventory row.

## Support statement after completion

Repository-owned automated support:

- the complete functional suite in the lockfile-pinned Playwright Chromium;
- the cross-browser release manifest in lockfile-pinned Playwright Firefox;
- the same manifest in desktop Playwright WebKit; and
- the mobile subset in Playwright's Mobile Safari device emulation.

User-facing support may state **latest stable Chrome and Firefox** after those
engine results pass. It may state **latest stable Safari on a supported macOS**
only after the additional real-Safari smoke in this specification passes for
that release.

Do not claim:

- historical browser versions;
- branded Edge compatibility from Chromium evidence alone;
- real iOS Safari or physical touch-device support from emulation alone;
- Firefox ESR unless separately run and recorded; or
- embedded webviews and privacy/add-on configurations not represented by the
  test environments.

Users outside the stated matrix remain best-effort. The product must still
fail safely and visibly where an optional browser capability is unavailable.

## Goals

- Keep all current Chromium functional and visual evidence.
- Define a compact cross-browser manifest covering every Workbench area and
  browser-sensitive boundary.
- Run the manifest in Firefox, desktop WebKit and mobile WebKit emulation.
- Make console errors, unhandled page errors, failed chunk loads and Worker
  failures visible test failures.
- Exercise file selection, download dispatch, storage/reload, clipboard
  fallback, dialog, URL and same-origin API behavior in each desktop engine.
- Add real stable-Safari smoke before making a Safari support claim.
- Give maintainers clear install, focused-run and release-run commands.
- Keep fixtures deterministic and offline from live providers.

## Non-goals

- Do not run every visual pixel snapshot in every engine. Cross-engine text
  rasterization is not a useful shared pixel baseline.
- Do not silently reduce or replace the complete Chromium suite.
- Do not add a second test framework, remote browser vendor or hosted grid.
- Do not enable GitHub Actions or change the accepted deployment shape; future
  hosted execution requires its own capacity decision.
- Do not add user-agent sniffing or engine-specific calculation behavior.
- Do not polyfill standard browser APIs without first proving a supported
  engine needs it and documenting the fallback.
- Do not make network access or live Hiscores/market providers a test
  prerequisite.
- Do not claim actual mobile-device, assistive-technology or performance parity
  from this functional matrix.
- Do not refresh Chromium visual baselines merely because another engine lays
  out antialiased text differently.

## Test architecture

### Existing Chromium owner

`playwright.config.ts` and `npm run test:e2e` remain the owner of the full
functional Chromium suite. Existing focused commands and title filters must
continue to behave as documented.

The new cross-browser work must not add Firefox/WebKit projects to this config
in a way that makes every existing focused Chromium command unexpectedly run
three engines.

### Cross-browser config

Add a dedicated `playwright.cross-browser.config.ts` with:

- the same production-preview build/server command, base URL, UTC timezone,
  deterministic fixtures and first-retry trace policy as the functional config;
- test selection limited to the owned cross-browser manifest;
- named `firefox`, `webkit` and `webkit-mobile` projects;
- desktop presets for Firefox and WebKit;
- a maintained Playwright Mobile Safari preset for the mobile project;
- one worker per project initially, until evidence shows greater concurrency is
  stable on the supported release machine;
- screenshots only on failure, not baseline comparisons; and
- no reuse of an unknown existing preview server.

Keep outputs in a separate repository-ignored result directory so one run does
not overwrite functional Chromium or visual traces.

### Commands

Add scripts equivalent to:

```text
test:e2e                 complete Chromium functional suite
test:e2e:cross-browser   Firefox + desktop WebKit + mobile WebKit manifest
test:e2e:release         both commands in release order
```

The release command must stop on the first failed gate and return a non-zero
status. Do not hide a failed engine behind a combined summary exit code of zero.

Document the matching Playwright browser installation command. Browser
binaries are installed for the lockfile version; after a Playwright update,
reinstall them before interpreting a missing-executable failure as a product
defect.

## Cross-browser manifest

Implement the manifest as a focused E2E owner, preferably
`src/tests/e2e/cross-browser-release.spec.ts`. Shared helpers come from the
existing scaffold fixture; do not copy app bootstrap or private data into a
second fixture system.

| ID    | Boundary                        | Required outcome                                                   |
| ----- | ------------------------------- | ------------------------------------------------------------------ |
| CB-01 | Startup and split chunks        | ready shell, generated data and all Workbench panes load           |
| CB-02 | Module calculation Worker       | Stats, Dense, Duel, Risk and Planner settle with expected fixture  |
| CB-03 | Setup inputs and custom widgets | numeric draft/error, native select and searchable selector work    |
| CB-04 | Storage and reload              | setup, Duel, Loot, PriceSet and Planner state survive reload       |
| CB-05 | Recovery and transactions       | invalid storage, safe session, review, Apply and Undo stay bounded |
| CB-06 | File import and download        | file input parses; setup and Workspace download events dispatch    |
| CB-07 | Share URL and dialog            | hash parse/clear, modal focus, copy success or fixed fallback      |
| CB-08 | Same-origin integrations        | mocked Hiscores/market success, unavailable and failure states     |
| CB-09 | Keyboard and accessibility      | skip link, tabs, Dense rows, popup keyboard and live outcome       |
| CB-10 | Responsive containment          | 390 px primary path, popup, tab overflow and data-table scroll     |
| CB-11 | Cross-tab browser state         | external storage change detection/resolution after its spec lands  |
| CB-12 | Fatal and pane failure recovery | sanitized recoverable states and unaffected navigation             |

CB-01 must activate every Workbench tab and wait for its primary labelled
region or expected empty state. Merely finding tab buttons is insufficient:
dynamic imports can fail only when their pane chunk is requested.

CB-02 may use one compact deterministic request per calculation family; it need
not repeat the complete numerical corpus. Domain and golden truth remain in
Vitest and the full Chromium suite.

CB-11 is implemented together with the cross-tab conflict specification. Until
then it is an explicit manifest dependency, not a passing placeholder.

CB-12 adopts the pane-level lazy-loading isolation contract once implemented.
The current root recovery test remains in Chromium; the release matrix must
eventually prove the engine-independent user outcome.

## Browser-API acceptance contracts

### Module Worker and structured data

- A production-built module Worker starts in every desktop engine.
- Request/result data crosses the Worker boundary without engine-specific
  mutation or serialization fallback.
- Dense, Planner, Duel and Risk success plus one injected failure/retry remain
  sanitized and usable.
- Mobile WebKit runs at least one representative Worker calculation.

Do not replace the Worker with main-thread calculation only in one engine. If a
supported engine cannot start it, expose a documented visible failure and treat
the support claim as blocked until an accepted architecture decision defines a
fallback.

### Browser storage

- `localStorage` envelope read/write/remove and reload work in normal contexts.
- Session-only recovery works when storage is deliberately made unavailable.
- Exact raw rollback tests remain byte-for-byte; engine differences do not
  authorize lossy reserialization.
- Cross-tab `storage` behavior is tested with two pages in one context after
  the conflict controller exists.
- Private browsing retention is not promised; visible copy continues to say
  “this browser”.

### Files, Blob and downloads

- File chooser tests upload committed JSON fixtures through the real input
  element in each desktop engine.
- Download tests wait for Playwright's download event and verify the proposed
  filename and parsed payload.
- The connected temporary anchor and delayed object-URL revocation from the
  file-export outcome specification must pass Firefox and WebKit.
- User copy says `download started`, never claims a completed filesystem save.
- Mobile WebKit emulation verifies the action remains contained and produces a
  supported visible outcome; it is not treated as proof of iOS filesystem UI.

### Clipboard and Share dialog

- Test permitted clipboard writing where Playwright can grant the capability.
- Separately deny/unavailable the API and prove the fixed, useful fallback with
  the share URL still available to the user.
- Do not skip the entire Share journey because an engine handles permissions
  differently.
- Native dialog open, initial focus, Escape/Close and focus return pass in all
  desktop engines.

### URL, fetch and security behavior

- Share fragments parse and clear without losing path/query state.
- Direct root refresh and all production chunks/assets return successfully.
- Mocked same-origin API calls preserve status/error behavior; no test contacts
  a live provider.
- Browser console CSP, mixed-content, module-load and unhandled-rejection errors
  fail the test unless an exact known benign message has a narrowly documented
  allowlist entry.

### CSS and responsive behavior

- Desktop Firefox/WebKit retain the three-column shell, intentional scroll
  owners, readable selected values and reachable controls.
- Mobile WebKit emulation covers normal-flow pane/result order, tab overflow,
  popup containment, table horizontal scrolling, sticky controls and modal
  containment at 390 x 844 or the selected device's equivalent viewport.
- Functional geometry assertions use tolerances appropriate to font metrics
  and subpixels. They still block clipping, overlap, off-canvas controls and
  document-width leakage.

## Failure and exception policy

- A repeatable manifest failure in Firefox or WebKit blocks the corresponding
  support statement and release gate.
- Fix standards-compliant shared code first. A browser-specific code branch is
  acceptable only for a demonstrated capability difference, must use feature
  detection and requires a focused regression.
- No `test.skip(browserName === ...)` may land solely to make the matrix green.
- A temporary engine-specific skip requires a linked backlog item, exact reason,
  user impact, owner and review date. The user-facing support statement must
  exclude the affected journey/browser if it is release-critical.
- Flakes are investigated with trace, screenshot, console and server evidence.
  Repeating a failed run until green is not acceptance evidence.
- Missing browser binaries are an environment prerequisite failure, not a
  passing or skipped product result.

## Real Safari smoke

Before publishing a Safari support claim, run the production preview in the
current stable branded Safari on a supported macOS machine. Use the same public
fixture and manually prove:

- startup and every Workbench pane chunk;
- one Worker-backed calculation and retry;
- searchable selector keyboard/pointer behavior;
- setup persistence and reload;
- one file import and one download request;
- Share dialog, URL copy/fallback and focus return; and
- 390 px responsive mode using Safari responsive design mode, explicitly
  labelled as emulation.

Record Safari/macOS versions, date, pass/fail and deviations in testing
evidence. Real iPhone/iPad support remains unclaimed without physical-device or
approved device-lab evidence.

## Visual-regression boundary

The existing read-only Chromium/Darwin visual suite remains the pixel-baseline
owner. The cross-browser manifest uses semantic assertions, geometry,
containment and failure screenshots.

If a Firefox/WebKit fix intentionally changes shared visuals, review the
existing Chromium candidates under the normal baseline policy. Do not create
or approve a large cross-engine snapshot family as part of this goal.

## Implementation outline

1. Add the dedicated config, output path and scripts without changing current
   focused Chromium command behavior.
2. Install the lockfile-matched Firefox and WebKit binaries and record versions.
3. Add the manifest skeleton and CB-01 pane activation/console gate.
4. Implement Worker, storage, file, URL/dialog, integration, accessibility and
   responsive rows using existing fixtures.
5. Run the complete current Chromium suite unchanged.
6. Run the full existing suite once in Firefox and WebKit as a discovery audit;
   use failures to harden shared helpers and select additional permanent
   manifest cases. This discovery run is evidence, not the future bounded gate.
7. Make all permanent manifest rows pass without unjustified engine skips.
8. Complete real Safari smoke if the release will claim Safari support.
9. Update testing, operations/browser-support wording and dated evidence.

## Required tests

In addition to CB-01 through CB-12, prove configuration behavior:

- `npm run test:e2e` selects only the complete Chromium functional project;
- `npm run test:e2e:cross-browser` selects Firefox, WebKit and mobile WebKit and
  only the owned manifest/subset;
- missing Firefox/WebKit binaries produce actionable prerequisite output and a
  failing exit code;
- production preview starts once per config and is shut down after success or
  failure;
- no manifest request reaches a live external origin;
- each desktop engine emits an attached trace on first retry and useful failure
  diagnostics; and
- engine and version metadata appear in the release evidence.

## Validation commands

Implementation is complete only after the testing owner confirms exact script
names. Expected minimum:

```bash
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run test:e2e:cross-browser
npm run test:e2e:visual
npm run architecture:check
git diff --check
```

Run the full existing suite once per new desktop engine during implementation,
even though the durable release matrix remains bounded. Record failures and
their dispositions rather than deleting tests that expose real incompatibility.

## Completion criteria

- Current Chromium functional and visual gates remain green.
- Firefox, desktop WebKit and mobile WebKit projects are reproducible from the
  lockfile and documented browser installation command.
- Every CB manifest row has permanent automated evidence or a clearly named
  dependency that blocks closing this goal.
- Browser API, console/page-error and responsive contracts pass without broad
  engine skips or user-agent sniffing.
- Real stable-Safari evidence exists before Safari is named as supported.
- Public wording distinguishes Playwright engine/emulation evidence from
  branded and physical-device evidence.
- Testing and operations docs own commands, prerequisites, support matrix and
  dated evidence.
- No provider, deployment, calculation, storage-schema or visual-baseline scope
  changed unintentionally.

## Open questions

None for specification. Branded Safari and OS version numbers are release-time
facts. If maintainers later want Firefox ESR, Edge or physical iOS coverage,
that support expansion requires its own evidence row and accepted maintenance
budget.

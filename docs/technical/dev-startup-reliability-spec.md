# Local development startup reliability specification

Status: implemented on 2026-07-15.

## Problem

Before this implementation, the repository proved two different production
concerns but did not prove the first rendered navigation of a newly started
Vite development server:

- `npm run dev` started Vite directly and treated Vite's listening state as the
  command's readiness boundary.
- the functional Playwright suite built and served the production preview
  instead of exercising Vite's development transform and middleware pipeline;
- `npm run startup:measure` also used a production build and preview server;
- `index.html` left `#root` empty until the React module graph evaluated and
  `main.tsx` rendered; and
- the runtime bootstrap loading and fatal-error states began only after that
  module graph has loaded far enough to mount React.

Consequently, a development-only transform, middleware or module-load failure
could leave the browser with an empty root even though Vite had printed a local
URL. The URL proved that the HTTP listener was available, not that the
simulator was ready.

The current scheduled-price routing regression test protects one known failure
class: query-free `/prices.json`-style requests belong to the repository
middleware, while Vite module requests such as `/prices.json?import&raw` must
fall through to Vite's transform pipeline. That focused unit boundary is
necessary but does not replace an actual dev-server navigation.

This specification treats a white or indefinitely empty page as an outcome
class rather than as one bug. It adds a visible pre-React boundary, a stable
application-readiness signal and a checked local-start handoff.

## Pre-implementation verified boundary

The following facts describe the boundary that motivated this implementation:

- `package.json` maps `npm run dev` directly to the Vite CLI.
- Vite may select another port when the preferred port is occupied because the
  current dev command does not request `--strictPort`.
- the functional `playwright.config.ts` web server runs `npm run build` followed
  by `npm run preview`.
- `scripts/measure-startup.mjs` waits for the visible `Monster card` landmark on
  the production preview.
- `index.html` contains an empty `<div id="root"></div>`.
- `src/app/main.tsx` statically imports React, `App` and the main stylesheet
  before its render statement can run.
- `App` and the runtime-bootstrap controller already own visible loading and
  sanitized fatal-error behavior after React mounts.
- `vite.config.ts` currently restricts scheduled-price interception to
  query-free direct asset requests, and `src/tests/vite-config.test.ts` protects
  that classifier.

Before this implementation, the repository had no command that started a fresh
Vite dev process, opened the app in a fresh browser context, waited for runtime
readiness and kept that verified server alive for the user.

## Implemented boundary

- `index.html` contains readable `starting` and `<noscript>` content before
  JavaScript runs, followed by the external same-origin startup guard and the
  existing application entry.
- `src/app/startup-guard-core.ts` owns the DOM-only sanitized transition from a
  pending shell to `error`; `src/app/startup-guard.ts` installs it before the
  application entry evaluates.
- the existing `App` loading, workbench and fatal branches own the canonical
  `starting`, `ready` and `error` markers. No parallel application startup state
  or domain/persistence field was added.
- `scripts/dev-startup.mjs` owns both checked serve mode and bounded check-only
  mode. The former emits `APP_READY` after a fresh Chromium probe and keeps its
  verified child alive; the latter proves normal, controlled-failure and live
  scheduled-price routing before reaping browser and server.
- raw `npm run dev` remains browser-independent. `npm run dev:checked` and
  `npm run test:startup:dev` require installed Playwright Chromium and never
  downgrade to an HTTP-only success.
- scheduled-price interception now accepts only exact query-free allowlisted
  `GET`/`HEAD` requests. `HEAD` returns JSON headers without a body, and Vite
  transform queries fall through unchanged.
- production startup measurement waits for the canonical `ready` marker rather
  than a feature-specific landmark.

## Goals

- Never present an empty root while the application entry graph is loading or
  has failed.
- Define one explicit DOM startup contract shared by development startup,
  production startup measurement and browser tests.
- Distinguish server listening, React mounting and simulator readiness.
- Provide a repository-owned checked start that an AI agent must use before
  reporting localhost as ready.
- Exercise the real Vite dev transform and custom middleware path on a newly
  started process and a first browser navigation.
- Fail with bounded, actionable diagnostics when the first render does not
  complete.
- Keep the existing production-preview, generated-runtime, persistence,
  calculation and deployment contracts intact.
- Retain a browser-independent raw Vite command for developers who have not
  installed Playwright Chromium.

## Non-goals

- No combat, Trip, Planner, price, generated-data or persistence behavior
  change.
- No new backend, database, service worker, CDN, provider call or deployment
  target.
- No automatic browser window opening.
- No automatic killing or reuse of an unknown process occupying the requested
  port.
- No claim that one successful startup proves hot-module replacement behavior
  for the rest of a development session.
- No wall-clock performance SLA. The timeout is a bounded failure detector, not
  an accepted startup-performance budget.
- No requirement to place the Chromium-dependent dev startup smoke inside
  `npm run verify`; the existing handoff gate remains browser-independent.
- No raw exception, stack trace, filesystem path, provider payload or stored
  user value in the visible startup error.
- No retry button in the first implementation. Browser reload and a new checked
  start remain the recovery paths.

## Terms

- **Server listening**: Vite accepts an HTTP connection at the selected origin.
- **Entry loaded**: the browser has evaluated enough of the application entry
  graph to mount React.
- **App ready**: generated runtime context, startup prices and compatibility
  recovery have completed and the initial simulator workbench is rendered.
- **Checked start**: a newly managed dev-server process plus a fresh-browser
  readiness probe; it is not an HTTP-only health check.
- **First navigation**: the first navigation in a new browser context against a
  newly started Vite process. It does not imply a deleted dependency cache.

## Startup-state contract

The application must expose exactly one of these states through a stable DOM
attribute:

| State      | Meaning                                                                |
| ---------- | ---------------------------------------------------------------------- |
| `starting` | Static entry shell or mounted React loading state; app is not usable.  |
| `ready`    | Runtime startup transaction is complete and the workbench is rendered. |
| `error`    | Entry loading or runtime bootstrap failed and a safe error is visible. |

The canonical attribute selector is:

```text
[data-app-startup-state]
```

Its only allowed values are `starting`, `ready` and `error`; consumers select a
specific state with selectors such as `[data-app-startup-state="ready"]`.

Requirements:

1. `index.html` must contain non-empty, readable `starting` content inside
   `#root` before any JavaScript executes.
2. The static content must remain understandable without the application
   stylesheet. Inline script and inline style are forbidden by the production
   CSP and must not be introduced.
3. The static shell must include a `<noscript>` message.
4. React loading presentation must retain the `starting` marker when it replaces
   the static shell.
5. `ready` must not be emitted merely because React mounted. It is emitted only
   on the same branch that renders the initial workbench after the existing
   runtime-bootstrap transaction has been applied.
6. Both a pre-React entry failure and the existing runtime fatal-error branch
   must expose `error` with `role="alert"` and fixed sanitized copy.
7. Exactly one startup-state marker may exist at a time.
8. The marker is a DOM readiness/test contract only. It must not enter
   `SimulationRequest`, persistence, share links, setup imports or domain types.

Initial English copy:

- starting: `Starting 2004scape Combat Simulator...`
- entry or bootstrap failure: `The simulator could not start. Reload the page and try again.`
- no JavaScript: `JavaScript is required to run the simulator.`

The implementation may preserve more specific existing sanitized runtime
failure copy below the fixed error heading. It must not surface the underlying
exception text in the DOM.

## Pre-React failure boundary

The static shell alone prevents a blank page, but an implementation must also
turn detectable entry-graph failure into the explicit `error` state.

The preferred first implementation is a small, same-origin Vite-built startup
guard loaded before `src/app/main.tsx`:

- it imports no React, domain, adapter, generated-data or application-state
  module;
- it installs the entry script's error handling before the application entry
  evaluates;
- while the state is `starting`, an entry script error or unhandled startup
  rejection replaces the shell with the fixed `error` presentation;
- once the app reaches `ready`, later application errors are not reclassified as
  startup failures; and
- if the guard itself cannot load, the static `starting` shell remains visible
  instead of an empty root.

The guard must be an external same-origin asset so the existing
`script-src 'self'` CSP and deployment artifact rule against inline scripts stay
unchanged. A dynamic-import rewrite of the whole React/App entry is not the
default implementation because it would change the meaning of D-094's direct
entry bundle measurement. Any alternative that changes the initial chunk graph
requires an explicit D-094 artifact/measurement review.

## Command contract

The implementation adds these public commands:

```sh
npm run dev
npm run dev:checked
npm run test:startup:dev
```

### `npm run dev`

- remains the browser-independent raw Vite development command;
- is useful for ordinary manual development;
- does not by itself authorize an agent to tell a user that the app is ready;
  and
- must be documented as an unverified server start.

### `npm run dev:checked`

- starts a repository-owned Vite child process on `127.0.0.1:5173` by default;
- uses a strict port and fails if that port is occupied;
- accepts a bounded explicit `--port` override and probes the same selected
  origin;
- waits first for HTTP availability and then launches installed Playwright
  Chromium in a fresh context;
- installs error listeners before the first navigation;
- waits for `[data-app-startup-state="ready"]`;
- fails immediately if `[data-app-startup-state="error"]` appears;
- closes the probe browser after success but keeps the verified Vite child alive;
- forwards termination signals to the child and reaps it on failure;
- prints the user-facing URL only in a distinct final `APP_READY` line after the
  rendered check succeeds; and
- exits non-zero if Chromium is unavailable, with the exact repository-approved
  browser-install instruction. It must not silently downgrade to an HTTP-only
  check.

The command must retain a bounded tail of Vite output for failure diagnostics
while still streaming normal server output. It must use direct argument arrays,
not `shell: true`, and it must not write a trace, screenshot or log file by
default.

### `npm run test:startup:dev`

- starts its own strict-port Vite dev process on a dedicated configurable test
  port;
- requests Vite dependency re-optimization for this bounded test run without
  manually deleting repository caches;
- runs the normal first-navigation readiness case;
- runs the controlled pre-React failure case;
- verifies the direct-versus-transformed scheduled-price request contract
  through the live server;
- closes browser and server on success or failure; and
- exits zero only when every startup assertion passes.

The smoke uses the committed repository data and mocked/disabled same-origin
service boundaries. It must not make a live Hiscores or market-provider request.

## Checked-browser assertions

Listeners must be attached before `page.goto()`.

The normal checked navigation fails on:

- a Playwright `pageerror` before readiness;
- a console message at error severity before readiness;
- a failed same-origin document, script, stylesheet, fetch or XHR request needed
  during startup;
- a visible `error` startup state;
- more than one startup-state marker;
- readiness timeout; or
- early exit of the managed Vite process.

Warnings are captured in failure diagnostics but do not independently fail the
first implementation. Expected browser cancellation of an already superseded
request must be classified explicitly rather than ignored through a broad
request-failure exception.

The readiness timeout is 60 seconds. This is operational headroom for a managed
development environment, not a latency target. HTTP-listener waiting may use a
shorter bounded phase, but the total command must still fail deterministically.

## Live dev middleware contract

Repository Vite middleware that serves a file also imported through Vite must
obey these rules:

1. Only the exact allowlisted, normalized direct asset path may be intercepted.
2. The request must be `GET` or `HEAD`.
3. A request with any query string must fall through to Vite. The implementation
   must not maintain an incomplete list of current Vite transform query names.
4. `HEAD` returns the same status and content type as `GET` without a body.
5. Non-matching methods and paths call `next()` without writing headers or body.
6. The same classifier is used by dev and preview middleware where both are
   supported.

The live startup smoke must prove both sides:

- `/prices.json` returns JSON through the repository middleware; and
- `/prices.json?import&raw` returns a JavaScript module through Vite rather than
  raw `application/json`.

The focused classifier unit test remains in the browser-independent `npm run
verify` gate. The live check is additive.

## Target implementation map

The exact filenames may change during implementation if ownership remains
equivalent:

| Owner                                   | Responsibility                                                        |
| --------------------------------------- | --------------------------------------------------------------------- |
| `index.html`                            | Non-empty starting shell, startup marker and noscript fallback.       |
| `src/app/startup-guard-core.ts`         | DOM-only pre-React entry failure classification and safe error shell. |
| `src/app/startup-guard.ts`              | Small external installer loaded before the application entry.         |
| `src/app/main.tsx`                      | Existing React mount; no domain or readiness polling.                 |
| `src/app/App.tsx` or direct shell owner | Starting/ready/runtime-error markers at existing render branches.     |
| `scripts/dev-startup.mjs`               | Strict-port child lifecycle, browser probe and checked/check modes.   |
| `vite.config.ts`                        | Exact direct-asset routing and shared dev/preview middleware wiring.  |
| `src/tests/startup-guard.test.ts`       | Static/entry failure and sanitization contract.                       |
| `src/tests/vite-config.test.ts`         | Pure request classification including method/query behavior.          |
| `scripts/dev-startup.mjs` check mode    | Real Vite first navigation, injected failure and transformed asset.   |

The dev-startup browser owner may live under `scripts/` instead of the normal
production-preview Playwright test directory if that avoids coupling it to
`playwright.config.ts`'s build-and-preview web server. It must still use the
same lockfile-pinned Playwright dependency.

## Agent handoff contract

When implementation is complete, `AGENTS.md` must state:

1. A request to start localhost uses `npm run dev:checked`, not raw `npm run dev`.
2. Vite's `ready` or listening output is not app-readiness evidence.
3. The agent reports the exact URL only after the command emits `APP_READY`.
4. On failure, the agent diagnoses the captured browser/server error and does
   not leave a failed managed child process running.
5. If Playwright Chromium is unavailable, the agent reports the missing
   prerequisite; it must not claim an unverified raw start as successful.
6. A pre-existing process on the requested port is inspected separately and is
   never killed or reused automatically.

This is the operational requirement that addresses repeated user-requested
localhost handoffs. The repository smoke and startup shell remain necessary so
the rule is executable and not prose-only.

## Test requirements

### Browser-independent tests

- the static root contains readable `starting` and `noscript` content;
- the startup guard renders fixed sanitized `error` content for an entry failure;
- the guard ignores later events after `ready`;
- only one startup-state marker exists after each transition;
- direct price assets match only allowed path/method/query combinations;
- deployment artifact validation continues to reject inline/external scripts
  and accepts the new same-origin hashed guard; and
- the production entry and generated-runtime chunk budgets stay valid.

### Live Vite dev tests

- a newly started strict-port Vite process reaches `ready` on its first fresh
  browser navigation;
- the page has no startup `pageerror`, error console output or required
  same-origin request failure;
- an intentionally aborted app-entry dependency produces visible `error` copy
  instead of an empty root;
- direct scheduled-price JSON is served as JSON;
- Vite raw-module scheduled-price import is served as JavaScript; and
- the managed server and browser are reaped after the check-only command.

### Production regression tests

- the existing build-and-preview functional Playwright gate remains green;
- `npm run startup:measure` waits for the canonical `ready` marker instead of a
  feature-specific `Monster card` selector;
- the production artifact satisfies CSP, hashed-asset, entry-byte and generated
  runtime split checks; and
- loading, runtime failure and ready workbench behavior remain accessible.

## Implementation sequence

1. Add static startup markup and browser-independent assertions without changing
   the React entry graph.
2. Add the DOM-only startup guard and its controlled failure tests.
3. Add canonical startup markers to the existing App loading, ready and fatal
   branches.
4. Strengthen request classification for method, query and `HEAD` behavior.
5. Add the shared checked-start/check-only script and package commands.
6. Add live Vite normal, failure-injection and transformed-asset smoke coverage.
7. Move production startup measurement from `Monster card` to the canonical
   `ready` marker.
8. Update `AGENTS.md`, `README.md`, architecture, testing and operations command
   ownership.
9. Run focused checks, production preview, startup measurement and the complete
   handoff gate.

Do not combine this work with a React composition-root refactor, middleware
framework change or production deployment change.

## Acceptance checks

Implementation is complete only when these pass:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/startup-guard.test.ts src/tests/vite-config.test.ts src/tests/deployment-readiness.test.ts
npm run test:startup:dev
npm run build
npm run startup:measure -- --runs 5
npm run test:e2e -- --workers=1
npm run verify
git diff --check
```

The implementation evidence must record:

- the exact checked-start command and emitted verified URL;
- normal first-navigation result;
- controlled entry-failure result;
- direct JSON and transformed raw-module response content types;
- whether localhost binding required the standard managed-environment approval;
- production entry raw/gzip bytes and JavaScript chunk count;
- production-preview browser result; and
- any command not run, with the blocking reason rather than a pass claim.

## Implementation evidence

The fresh strict-port check-only command used its default
`http://127.0.0.1:4179/` origin. Its first managed-sandbox attempt failed at the
environment boundary with `listen EPERM`; the approved localhost rerun passed:

| Assertion                      | Result                              |
| ------------------------------ | ----------------------------------- |
| Normal first navigation        | `ready`, one marker, zero warnings  |
| Controlled application abort   | sanitized `error`, one marker       |
| Direct `/prices.json`          | `application/json; charset=utf-8`   |
| `HEAD /prices.json`            | JSON content type and an empty body |
| `?import&raw` transform        | `text/javascript` JavaScript module |
| Managed browser/server cleanup | passed after the check-only command |

The final user handoff ran `npm run dev:checked` on the default strict port. It
verified a fresh browser context and emitted
`APP_READY http://127.0.0.1:5173/` before the managed Vite child was left
running.

The focused startup-guard, Vite classifier and deployment-readiness suites pass
20/20. The complete production-preview Chromium gate passes 78/78. Full
`npm run verify` passes 80 files / 787 unit tests, all 19 explicit goldens,
typecheck, the cycle-free 124/109/eight-entrypoint architecture check,
build/artifact budgets, lint, formatting and diff checks.

The production build has ten files, two direct index assets and three JavaScript
chunks. Vite coalesces the two HTML source module entries into the same hashed
production entry while preserving guard installation before application code;
the non-empty static shell remains in `dist/index.html`. The direct entry is
721,534 raw / 209,167 gzip bytes, the deferred generated-runtime chunk remains
880,362 raw / 47,939 gzip bytes and the total artifact is 1,976,282 bytes with
SHA-256
`fa514545d3cfdaf3ddfbe1e4e2b17d0737b57c3dd8e793afa0c7af2056b227e6`.
This stays within D-094's 725,000 raw / 210,000 gzip limits without changing its
direct-entry definition.

Five paired canonical-marker measurements on Playwright Chromium
149.0.7827.55 produced 304 ms cold and 203 ms warm app-ready medians, plus
32 ms cold and 16 ms warm first-contentful-paint medians. These are current
workstation samples, not a universal SLA or a replacement for D-094's accepted
before/after evidence.

## Documentation ownership

- `AGENTS.md`: authoritative agent localhost handoff procedure.
- `README.md`: distinguishes raw and checked local starts and the Chromium
  prerequisite.
- `docs/technical/architecture.md`: owns startup guard, readiness marker and dev
  orchestrator ownership.
- `docs/technical/testing.md`: owns the current dev-startup command and
  change-type gate.
- `docs/operations/README.md`: owns local run, port conflict and failure
  recovery.
- `docs/project/testing-evidence.md`: records dated implementation results only.
- this specification owns the contract, status and implementation evidence.

No new accepted decision was needed by this implementation. If a later change
makes Chromium mandatory for the default `npm run dev` command or changes the
D-094 initial bundle definition, record that as a separate accepted decision.

## Open questions

- Whether the checked command should replace raw `npm run dev` remains open.
  The first implementation keeps `dev:checked` separate so ordinary static-app
  development does not acquire a mandatory browser installation.
- Whether the visible startup error should later offer an in-page Reload button
  remains open; the first implementation uses fixed copy and normal browser
  reload.
- Whether the dev browser smoke should become part of a future general CI gate
  remains open because this checkout has no general CI workflow and current
  browser suites are environment-dependent.

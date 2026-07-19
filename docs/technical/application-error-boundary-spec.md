# Application error boundary and session-only recovery specification

Status: implemented, 2026-07-19.

## Purpose

The pre-React startup guard and runtime-bootstrap controller already provide
sanitized failure states before the workbench is ready. This specification
closes the remaining application-level gap: a React render or lifecycle error
after a successful startup must not leave a blank or partially broken
workbench.

The root render now has one React Error Boundary. Both its unexpected-render
fallback and the existing bootstrap-failure branch use the same stable recovery
surface, while retaining separate fixed messages and separate regression tests.

## Required user-visible behavior

- A descendant render or lifecycle error replaces the workbench with one
  `data-app-startup-state="error"` surface and one alert landmark.
- The surface contains only fixed, sanitized copy. It never renders the thrown
  value, stack, component stack, source path, persisted payload or response
  body.
- `Reload simulator` performs a normal reload and does not modify browser
  storage.
- `Open with saved data ignored for this session` marks the current tab, reloads
  and starts from in-memory defaults.
- The recovery surface explicitly says that local data is not cleared
  automatically.
- A successful safe-session startup shows a visible `Session-only safe mode`
  notice explaining that saved data is ignored, changes are non-durable and
  existing saved data is unchanged.

The pre-React guard remains active only while the canonical marker is
`starting`. Once React owns the root, the Error Boundary owns descendant render
and lifecycle failures. Errors from event handlers, arbitrary rejected promises
after readiness and domain validation remain with their existing feature or
controller owners; React Error Boundaries do not catch those categories.

## Safe-session storage contract

The safe action uses a fixed `sessionStorage` flag. Browser session storage is
tab-scoped and survives reloads, so the same tab remains isolated for its
remaining session. If session storage cannot be written, a fixed query
parameter provides a reload-scoped fallback.

On a flagged startup:

1. the application chooses a fresh `KeyValueStorage` memory instance before
   any persisted-state loader runs;
2. all initial setup, Planner, Loot, Duel, price, Hiscores and migration reads
   therefore see defaults or missing optional state;
3. all later saves and clears target only that memory instance;
4. the original `window.localStorage` is not read, overwritten or cleared;
5. persistence-aware controllers report session-only behavior rather than a
   durable save.

This adds no key to local storage, changes no persisted envelope or schema and
does not authorize automatic repair or deletion. Opening a new tab starts a
normal session unless that tab independently carries the fallback query
parameter.

## Ownership

- `src/app/main.tsx` installs the root `ApplicationErrorBoundary` around `App`.
- `src/app/components/shell/application-error-boundary.tsx` owns the boundary,
  sanitized failure screen, recovery controls and active safe-session notice.
- `src/app/application-recovery.ts` owns the tab flag, query fallback, reload
  actions and browser-storage selection.
- `src/app/App.tsx` consumes the selected storage boundary and keeps all
  existing feature state, runtime bootstrap and persistence effects.
- `src/app/startup-guard-core.ts` remains the DOM-only pre-React boundary.
- `src/app/controllers/local-state-recovery.ts` distinguishes storage-read
  availability from non-durable session-only persistence.

No domain module, generated data, persisted schema, backend, provider or
deployment boundary changes.

## Privacy and security constraints

- Do not interpolate `Error`, `error.message`, `error.stack`, React component
  stacks or arbitrary thrown values into the DOM.
- Do not export or log persisted payloads from this boundary.
- Do not clear any storage as a side effect of catching an error or selecting
  either recovery action.
- Keep the safe-session URL fallback to one fixed boolean parameter; do not
  encode error or saved-state content in it.

## Required tests

Focused jsdom/Vitest coverage must prove separately:

- the bootstrap failure renders its fixed bootstrap message and both recovery
  actions;
- a pane that first renders under the ready marker and fails on a later render
  is replaced by the fixed application failure surface;
- a descendant lifecycle failure is replaced by the same fixed application
  failure surface;
- raw error text, stacks and source paths do not appear;
- both action callbacks remain usable;
- the tab flag selects isolated memory and local data remains byte-for-byte
  unchanged after memory writes and clears;
- the query fallback preserves the current path, existing query and fragment;
- session-only persistence does not misclassify memory-backed default reads as
  unavailable saved data.

The focused Playwright path must provoke a post-ready render failure, exercise
the safe-session action, verify a ready default workbench and safe-mode notice
after reload, and prove that subsequent session-only edits leave the original
rewrite setup untouched.

Run at minimum:

```sh
npm run test -- src/tests/application-error-boundary.test.tsx src/tests/startup-guard.test.ts src/tests/local-state-recovery-controller.test.ts
npm run typecheck
npm run architecture:check
npm run build
npm run test:e2e -- --workers=1 --grep "recovers a ready-pane render failure"
git diff --check
```

## 2026-07-19 implementation evidence

The focused Vitest command passes 3 files / 23 tests, including separate
bootstrap, later-render and lifecycle failure cases plus session-flag and query
fallback storage isolation. Typecheck, the 135-source-module cycle-free
architecture check, production build, focused ESLint/Prettier and
`git diff --check` pass. The named production-preview Chromium transaction
passes 1/1 with the complete sorted localStorage key/value byte snapshot
unchanged before recovery, after safe reload and after a safe-session edit. The
approved managed-localhost startup check proves one ready marker plus one
controlled error marker. This is `LOCAL_RUNTIME` / `SYNTHETIC_TEST` evidence
only.

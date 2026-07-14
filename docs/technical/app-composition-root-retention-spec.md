# App composition-root retention specification

Status: implemented, 2026-07-14.

## Purpose

This specification closes ARCH-2026-03 as an accepted monitored boundary after
the completed D-093 Phase 1-4 refactor. It is not a new extraction phase and
does not supersede
[app-composition-root-phase4-spec.md](app-composition-root-phase4-spec.md).
Instead, it records what the remaining `src/app/App.tsx` composition root owns,
why that ownership is cohesive at application scope and what concrete evidence
must exist before another App split is proposed.

## Verified current inventory

Source inspection on 2026-07-14 records:

- 2,573 lines and exactly 46 React `useState` calls
- nine direct `useEffect` calls: seven versioned persistence effects, one
  resolved runtime-bootstrap Apply and one minute-aligned presentation clock
- one global status string and one `PendingUndo` owner
- typed controller outcomes for runtime bootstrap, local-state recovery, setup
  transfer, PriceSet transfer, Hiscores, Dense/Duel/Planner and Risk work
- caller-owned atomic transactions for setup import, compatible legacy import,
  share Load/Undo and cross-feature reset/replacement paths
- direct composition of the shell, panes and always-visible MonsterCard rail

The current architecture graph has no cycle, layer exception or orphan.
Components remain prop/callback consumers and do not read storage, call
adapters, start calculations or own cross-feature rollback.

## Accepted ownership

`App.tsx` remains responsible for these application-scope concerns:

1. Constructing and reconciling browser-local feature state.
2. Applying one resolved runtime bootstrap result before persistence is enabled.
3. Persisting the seven independently versioned feature-state owners through the
   shared recovery boundary.
4. Applying typed controller outcomes to live React state.
5. Coordinating actions that intentionally change more than one feature owner:
   setup import, legacy import, shared setup Load/Undo, selected PriceSet
   replacement and local-state recovery.
6. Owning the global status/Undo channel and high-level pane composition.

Feature modules continue to own schemas, pure state transitions, domain
calculation, view models, controllers and presentation. App may call those
owners; it must not duplicate their formulas, parsing rules or persistence
schemas.

## Non-goals

- No broad reducer, application context, catch-all hook or service container.
- No move of state merely to reduce line or hook counts.
- No new global store, event bus or server-managed state.
- No change to storage keys, schemas, transaction order, UI copy, DOM, CSS,
  calculations, APIs or deployment.
- No extraction that hides a multi-feature Apply behind a feature-local name
  while App still supplies all of its state and callbacks.
- No line-count or exact-hook-count merge gate. Counts are audit evidence, not a
  product invariant.

## Reopen triggers

A new App extraction specification is justified only when at least one of these
is demonstrated with code, tests or change history:

- two or more feature changes repeatedly require edits across the same cohesive
  App state/effect/action cluster
- a real transaction or rollback defect is caused by the current co-location
- a feature cannot be tested in isolation without mounting App, and a pure
  typed core would remove that test barrier
- a new dependency edge creates a cycle, architecture exception or component
  adapter/storage access
- a feature lifecycle gains independent cancellation, freshness or recovery
  semantics that cannot be represented by an existing focused controller
- merge conflicts, reverts or review errors repeatedly concentrate in one
  identifiable App responsibility family
- startup, responsiveness or bundle evidence shows an accepted budget breach
  attributable to the current composition boundary

Line growth, state count or aesthetic preference alone is insufficient. An
added persistence key or UI control triggers inventory review, not automatic
extraction.

## Extraction recipe if reopened

1. Identify one cohesive responsibility and its exact state/effect/action
   boundary.
2. Characterize success, failure, stale and rollback behavior before moving it.
3. Extract a DOM-free pure core or a narrow lifecycle controller with typed
   inputs/outcomes.
4. Keep caller-owned live-state Apply in App unless the extracted owner genuinely
   owns the complete transaction and recovery contract.
5. Move presentation only to a pure component with values and intent callbacks.
6. Preserve storage schemas, action order, status/Undo semantics, DOM/copy/CSS
   and calculation inputs.
7. Run the focused transaction/browser cases, architecture check and full
   repository gate. Run visual comparison when markup or styling changes.

A proposed broad reducer/context/hook must separately prove that it reduces
dependency or transaction complexity rather than only relocating it.

## Guard and evidence policy

Existing executable guards are the correct boundary:

- `npm run architecture:check` rejects cycles, forbidden layer edges,
  client/archive reachability regressions and stale exceptions
- controller/state unit suites own pure lifecycle and schema behavior
- `app-shell`, pane and view-model suites own direct presentation contracts
- Playwright owns setup/share/legacy/recovery/Undo and feature workflows
- `npm run verify` owns type, unit, golden, architecture, build/artifact, lint,
  format and diff gates

An exact 46-state or 2,573-line assertion would turn a current observation into
a brittle architecture rule and would discourage small legitimate cleanup.
Therefore this goal adds no source-text count test.

## Implementation

The accepted implementation is retention with explicit monitoring:

- the current App source remains unchanged
- the stale audit-row line count is corrected from the audit-time 2,534 lines to
  the current 2,573 lines
- architecture, backlog and technical navigation link this retention contract
- ARCH-2026-03 remains accepted rather than being mislabeled as unfinished
  refactoring work
- future App proposals must cite one of the reopen triggers above

## Acceptance checks

```sh
npm run architecture:check
npm run typecheck
npm run test -- src/tests/app-shell-view-model.test.ts src/tests/app-shell-components.test.tsx src/tests/local-state-recovery-controller.test.ts src/tests/runtime-bootstrap-controller.test.ts src/tests/setup-file-transfer-controller.test.ts src/tests/price-set-transfer-controller.test.ts
npm run verify
git diff --check
```

Use the most recent complete Chromium and visual evidence when only documentation
changes. Any future source/markup extraction must rerun the relevant focused
Chromium cases and the complete functional suite; markup or CSS changes also
require read-only visual comparison.

## Implementation evidence

- TypeScript AST inspection confirms 46 `useState`, nine `useEffect`, one
  `useCallback`, two `useRef` and 25 `useMemo` calls in the 2,573-line App.
- The nine effects classify as seven direct versioned-persistence effects, one
  idempotent runtime-bootstrap Apply and one minute presentation clock.
- Source review confirms App still owns global status/Undo and the setup,
  legacy and shared-setup multi-feature transactions. No component-side
  storage/adapter ownership, source-graph cycle, exception or orphan was found.
- The six focused shell/bootstrap/recovery/transfer suites pass 57/57.
- `npm run verify` passes 71 test files / 770 tests plus 19 goldens,
  architecture 121/109, typecheck, build/artifact, lint, format and diff gates.
- The 10-file/two-asset artifact remains 1,977,466 bytes with entry JavaScript
  720,528 raw / 208,747 gzip and SHA-256
  `057c148f8b029a61bb0ef967418ca11c2403529765ccb93463a8f39745fc8720`.
- App source, markup and styling are unchanged. The immediately preceding exact
  source tree passed functional Chromium 78/78 and the latest applicable
  read-only visual comparison remains 20/20; this documentation-only closure
  does not claim a new browser or visual run.

## Open questions

- None for retaining the current boundary. A future trigger opens a new,
  feature-specific specification rather than extending this document in place.

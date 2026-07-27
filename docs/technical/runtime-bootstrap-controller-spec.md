# Runtime bootstrap controller specification

- Status: implemented
- Date: 2026-07-13
- Owner: technical documentation
- Evidence: verified
- Contract: closed

remains a separate next goal.

## Purpose

The generated runtime bootstrap is a cohesive application-controller
responsibility, but its asynchronous orchestration currently lives directly in
`src/app/App.tsx`. The effect dynamically loads the generated runtime, validates
persisted setup and Duel state against it, resolves the startup PriceSet stack,
sets several UI states and finally enables browser-state persistence.

This goal extracts that orchestration without changing startup behavior. It is
an ownership refactor under D-093, not a new loading, pricing or persistence
design.

## Current behavior to preserve

The implementation must begin from these code-owned facts:

1. `App` first initializes browser-local state through the existing bounded,
   versioned loaders. Invalid envelopes use safe defaults but remain available
   to local-state recovery.
2. The generated runtime is loaded with a dynamic
   `import("@/adapters/generated")`. D-094 requires the generated snapshot to
   remain outside the direct entry chunk.
3. A valid persisted rewrite setup is checked against the loaded
   `GameDataSnapshot`. If it references unavailable data, every setup-owned
   field is replaced in memory with `savedSetupFromForm(DEFAULT_FORM_STATE)`,
   the persisted key is not overwritten and `rewrite-setup` is marked as
   context-invalid and persistence-blocked.
4. Persisted Duel snapshots are checked against the same snapshot. An
   incompatible collection is replaced in memory by
   `DEFAULT_DUEL_SNAPSHOTS_STATE`, the persisted key is not overwritten and
   `duel-snapshots` is marked as context-invalid and persistence-blocked.
5. The startup price order is:

   - load a valid selected browser-local PriceSet if one exists;
   - restore generated high-alch authority to the selected PriceSet;
   - load the scheduled static snapshot with the selected PriceSet or bundled
     generated PriceSet as its fallback and generated alch as canonical;
   - add generated item-price fallbacks to the scheduled result;
   - resolve selected over scheduled over bundled prices;
   - apply the initial manual browser-local item-price overlay last;
   - keep generated high-alch values authoritative throughout.

6. A valid selected PriceSet remains active ahead of a valid scheduled
   snapshot. Manual overrides change only the active composed PriceSet; the
   resolved base and bundled PriceSets remain separately available.
7. Selected-PriceSet errors are sanitized. With a valid scheduled snapshot, the
   current neutral notice says that the saved selection could not be restored
   and scheduled prices were loaded. Without scheduled prices, the specific
   sanitized selected-load issue remains visible.
8. Setup or Duel incompatibility status has final priority over the normal
   runtime/price loaded status. The current visible status, market notice and
   fatal-error strings are compatibility contracts for this structural goal.
9. `readyToPersist` becomes true only after the compatible runtime context,
   fallback state, price state and recovery blocks have been applied. Before
   that, the versioned persistence effects do not write startup defaults.
10. Effect cleanup ignores stale generated-runtime or scheduled-price
    completions. A bootstrap failure shows only the existing sanitized fatal
    message; raw thrown values are not rendered or logged.

## Goal

- Move async runtime loading and startup resolution out of `App.tsx`.
- Give the startup state a typed `loading | ready | error` contract.
- Keep the price and compatibility policy testable without rendering the whole
  app.
- Leave `App` responsible for composing feature-owned React state from one
  resolved bootstrap result.
- Preserve the D-094 chunk boundary and artifact budgets.

## Non-goals

- Do not change generated data, runtime schemas, market files or price
  provenance.
- Do not change storage keys, versions, initial loaders or persisted envelopes.
- Do not add Suspense, a state library, a router, a backend or a second runtime
  request.
- Do not fetch the generated snapshot as standalone JSON or make scheduled
  prices mandatory.
- Do not move feature persistence effects into this controller.
- Do not combine this extraction with local-state recovery, Settings markup,
  setup import/export or pricing UI refactors.
- Do not change loading, success, warning or error copy.

## Target ownership

Create these app-owned modules:

- `src/app/controllers/runtime-bootstrap.ts`: DOM-free bootstrap resolution,
  compatibility and status/notice policy. It may consume app-state and adapter
  contracts, but it must receive effectful loaders as dependencies.
- `src/app/controllers/use-runtime-bootstrap.ts`: the React lifecycle wrapper.
  It owns the dynamic import, cancellation/stale-completion guard and the
  `loading | ready | error` state transition.

`src/app/App.tsx` consumes the hook and applies one ready result to its existing
feature-owned states. It may retain one small, explicitly idempotent application
effect; the async loader chain and pricing/compatibility branches must no longer
be in `App`.

The controller remains in `src/app`, not `src/domain`: it coordinates browser
storage, generated and market adapters, app-state compatibility and UI status.
The existing pure price, storage and compatibility functions remain in their
current owners.

## Required contracts

The exact type names may vary, but the boundary must represent this information
explicitly:

```ts
type RuntimeBootstrapState =
  | { status: "loading" }
  | { status: "ready"; result: RuntimeBootstrapResult }
  | { status: "error"; message: string };

interface RuntimeBootstrapResult {
  context: SimulationContext;
  setupReplacement: SavedSetup | null;
  duelSnapshotsReplacement: DuelSnapshotsState | null;
  contextInvalidItemIds: readonly LocalStateHealthItemId[];
  recoveryNotice: string | null;
  bundledPriceSet: PriceSet;
  basePriceSet: PriceSet;
  manualPriceOverrides: ManualPriceOverridesState;
  scheduledSnapshotStatus: ScheduledStaticPriceSnapshotStatus;
  activePriceSetOrigin: ActivePriceSetOrigin;
  priceLabel: string;
  marketNotice: MarketNotice | null;
  statusMessage: string;
}
```

The resolved `context.priceSet` is the active composed PriceSet. A setup or Duel
replacement is `null` when the initially loaded value is compatible; the
controller must not manufacture an unnecessary reset. The result contains no
setter functions and does not expose raw adapter errors.

The resolver input must include the initially loaded setup, Duel snapshots and
the captured initial manual-price overlay. It must not reread those values after
an asynchronous wait. The hook must receive stable initial inputs or capture
them once, matching the current first-render semantics.

## Dynamic-import and lifecycle constraints

- The generated adapter entry may be referenced as a runtime value only through
  the existing dynamic import. Type-only imports are allowed.
- Moving the code must not pull `src/data/generated/game-data.json` back into the
  direct entry chunk.
- The hook starts one logical bootstrap for its captured initial inputs.
- Cleanup marks that run stale. Neither the generated-runtime completion nor
  the later scheduled-price completion may publish a result after cleanup.
- The ready result is applied at most once. This must remain true under React
  development Strict Mode and after unrelated `App` renders.
- `readyToPersist` is not part of the resolver result. `App` enables it only
  after applying the complete ready result and all context-invalid recovery
  blocks.
- An error result uses the current fixed fatal message. It must never contain
  `String(error)`, stack data, paths, response bodies or persisted content.

## Compatibility and status matrix

Focused tests must cover at least these outcomes:

| Initial condition                       | Active base                          | Notice/status requirement                                                         |
| --------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| Selected valid, scheduled valid         | Selected                             | Restored-selected success notice; selected remains ahead of scheduled             |
| Selected missing, scheduled valid       | Scheduled                            | Scheduled success notice and loaded-scheduled status                              |
| Selected invalid, scheduled valid       | Scheduled                            | Neutral notice says the selection failed and scheduled prices loaded              |
| Selected invalid, scheduled unavailable | Bundled                              | Sanitized selected-load issue is visible                                          |
| Selected missing, scheduled unavailable | Bundled                              | Source-backed runtime or saved-setup loaded status is preserved                   |
| Manual overrides present                | Same selected/scheduled/bundled base | Overlay is active last; base remains unchanged                                    |
| Rewrite setup incompatible              | Otherwise unchanged                  | Safe setup replacement, blocked preserved key and setup-incompatible final status |
| Duel snapshots incompatible             | Otherwise unchanged                  | Empty in-memory list, blocked preserved key and Duel-incompatible final status    |
| Both persisted states incompatible      | Otherwise unchanged                  | Both IDs blocked and the combined recovery notice is used                         |
| Generated runtime rejects               | No ready state                       | Existing sanitized fatal message only                                             |

Every price outcome must also assert generated high-alch authority and generated
scheduled item fallbacks. Existing functions should be called rather than
duplicating that policy inside the controller.

## Implementation sequence

1. Add unit tests for a dependency-injected bootstrap resolver and the matrix
   above before moving the effect.
2. Extract selected-PriceSet issue description and the current status/notice
   decision tree with no copy changes.
3. Add the hook around the resolver and keep the generated adapter dynamically
   imported.
4. Replace the long `App` effect with hook consumption and one idempotent result
   application boundary.
5. Re-run local-state browser cases to prove that incompatible persisted values
   are still preserved and blocked before persistence starts.
6. Build and inspect the artifact budgets to prove the entry chunk did not
   regress.

## Required tests and validation

Add a focused Node/Vitest suite, preferably
`src/tests/runtime-bootstrap-controller.test.ts`, using injected generated and
scheduled loaders. Extend existing tests only where they already own the pure
price or compatibility behavior.

Run at minimum:

```sh
npm run test -- src/tests/runtime-bootstrap-controller.test.ts src/tests/market-ui-state.test.ts src/tests/ui-adapters.test.ts src/tests/generated-runtime-adapter.test.ts
npm run typecheck
npm run architecture:check
npm run build
npm run deploy:verify-artifact
npm run test:e2e -- --workers=1 --grep "scheduled price status|unavailable game data|incompatible saved Duel"
npm run verify
git diff --check
```

If the focused Playwright grep names change, run the equivalent three existing
startup/recovery cases and record the exact command. No golden or visual
baseline update is expected. A changed golden, numeric result, screenshot or UI
copy is a regression signal, not an automatic baseline-refresh reason.

## Acceptance criteria for the implementation goal

- `App.tsx` no longer contains the generated-runtime async chain, scheduled
  startup resolution or selected/scheduled/bundled decision tree.
- The controller boundary exposes one typed ready result and one sanitized error
  state; `App` does not receive raw loader errors.
- All current compatibility, recovery-block, status and notice semantics pass
  focused tests and browser coverage.
- No startup default is persisted before the ready result is fully applied.
- The generated snapshot remains deferred, and the existing direct-entry raw
  and gzip budgets pass.
- Architecture checks report no new exception or forbidden dependency.
- Storage, schemas, price files, calculation output, DOM, CSS and user-visible
  copy are unchanged.
- Owning architecture, testing and composition-root documentation is updated
  from proposed to implemented with the actual validation evidence.

## Implementation evidence

- `src/app/controllers/runtime-bootstrap.ts` owns dependency-injected bootstrap
  resolution, current-game-data compatibility, startup price precedence and
  sanitized status/notice policy.
- `src/app/controllers/use-runtime-bootstrap.ts` owns the lifecycle,
  stale-completion guard and the only runtime-value
  `import("@/adapters/generated")` in `src/app`.
- `App.tsx` no longer imports or branches on the generated loader, scheduled
  loader, selected loader, compatibility inspectors or startup fallback
  resolver. It applies one ready result idempotently before enabling
  persistence.
- The focused controller matrix passes 11/11 tests. The combined controller,
  market UI, UI adapter and generated-runtime suites pass 106/106.
- The three production-preview startup/recovery cases pass 3/3 for scheduled
  price status, incompatible rewrite setup preservation and incompatible Duel
  snapshot preservation.
- The architecture graph passes with 70 source modules, no cycles, 57
  client-reachable modules and zero exceptions.
- The build keeps the generated runtime in a separate 880,362-byte chunk. The
  direct entry is 685,731 raw / 197,749 gzip bytes, below the unchanged 725,000
  raw / 210,000 gzip budgets. Artifact validation reports 10 files, two assets,
  three JavaScript chunks and SHA-256
  `7aa9d4e6eae551a86992c72abf14e8af09fab4beb61491caf3c42a66abb4b51f`.
- Full `npm run verify` passes 635 unit tests, 19 explicit goldens, typecheck,
  architecture, build/artifact budgets, lint, format and diff checks. Dependency
  audit is the only skipped step under the documented network-disabled policy.

## Open questions

None.

# Lazy pane loading and failure-isolation specification

- Status: implemented; focused production-preview and component evidence pass
- Date: 2026-07-21
- Priority: medium
- Estimated effort: L
- Owner: App composition root, Workbench shell and pane-loading boundary
- Feature-inventory parents: Workbench and all current feature panes (`Valmis`)
- Depends on: current dynamic pane chunks, root application recovery and
  production artifact/startup measurement owners

## Implementation result

`src/app/state/pane-delivery.ts` now owns the exhaustive Workbench-tab to
pane-family registry, Compare-only initial request set and monotonic session
request transition. `App` routes every tab activation through that owner,
renders an unvisited lazy family only after its first activation and retains a
visited family mounted behind its existing `hidden`/mode contract. Stats stays
synchronous but uses the same local error boundary.

`PaneBoundary` places a class Error Boundary outside Suspense, publishes the
active family's `not-requested`/`loading`/`ready`/`failed` state to the one
tabpanel and renders fixed named loading/failure copy. A rejected lazy loader
offers normal Reload only. A module that resolved before its render/lifecycle
failure also offers **Try pane again**, remounts only that subtree and returns
focus to the active tabpanel after success. The nested Workspace presenter has
its own non-retry boundary, so its failure leaves other Settings regions
available. No raw error, stack or chunk path enters the DOM.

The production-preview request suite proves Compare-only initial pane delivery,
single-request mounted Risk revisits, the shared Economy/Settings family,
Settings-only Workspace delivery, sanitized loader failure, normal Reload and
unchanged saved storage. `startup:measure` now records separate shell and
initial-pane ready times plus JavaScript request/transfer/decoded totals and
paths at both checkpoints. A one-pair workstation sample is recorded in the
testing evidence log; it is a command-contract check, not a latency baseline or
SLA.

PF-06 extends only initial-family selection: the exact allowlisted browser
`pane` query now seeds the requested family, so a Planner/Settings/etc. deep
link starts that family immediately. A missing or invalid query retains the
Compare default. History activation reuses the same monotonic request owner;
visited panes remain mounted and failures stay inside the same pane boundary.

## Purpose

Make the existing pane chunks genuinely on-demand, replace blank Suspense
fallbacks with truthful active-pane feedback and contain a pane load/render
failure without taking down the whole simulator.

The production build already emits separate chunks for Compare, Loadout, Loot,
Trip, Risk, Cannon, Duel, Planner and Economy/Settings. `App` nevertheless
renders every lazy component at ready-shell mount and merely passes a `hidden`
prop. React therefore starts every import immediately. Each top-level Suspense
uses `fallback={null}`, and a rejected import or render error reaches the root
application Error Boundary, replacing every tab and shared control.

This goal preserves the valuable “once visited, stay mounted” state contract
while delaying the first request until a pane is activated and isolating
failure to the affected pane.

## React boundary

React's official [`lazy` documentation](https://react.dev/reference/react/lazy)
defines that the loader Promise and its resolved value are cached. The official
[`Suspense` documentation](https://react.dev/reference/react/Suspense) defines
the loading fallback and routes a client error to the closest Error Boundary.

The implementation must therefore place a pane Error Boundary outside the
pane's Suspense boundary. Resetting an Error Boundary alone is not a guaranteed
network retry for a rejected cached lazy import. A failed chunk offers normal
page reload as the reliable recovery; pane-only Retry is reserved for an
already loaded component render/lifecycle failure.

## Verified current behavior and problem

- A queryless app start uses `activeTab: "compare"`; an exact allowlisted pane
  deep link now supplies the initial tab.
- Stats is synchronously imported; nine pane components are declared through
  `React.lazy()`.
- All nine lazy components appear unconditionally in the Workbench children on
  every ready render. Their own `hidden`/mode prop controls visibility only
  after the component module resolves.
- The ready render therefore invokes every lazy loader, not only Compare.
- All nine top-level boundaries use `fallback={null}`. A slow active chunk
  leaves the central pane blank with no name, status or explanation.
- The combined Economy/Settings chunk also exports three economy transaction
  helpers used by action paths after that feature is active.
- Workspace tools form a nested lazy chunk under Settings. It has a visible
  loading fallback but no nested Error Boundary, so its failure can replace the
  whole Economy/Settings pane or escape to the root.
- `ApplicationErrorBoundary` wraps all of App. Its fixed full-app recovery is
  correct for shell/bootstrap-wide failure but too broad for one optional pane.
- The architecture promises that each pane remains mounted through its hidden
  contract after its chunk resolves. User-entered session-only presentation
  state can therefore survive tab changes today.
- Startup measurement waits only for the root ready marker and does not report
  whether the initial active pane has resolved.
- The latest documented artifact has 16 JavaScript chunks, with named bounded
  feature chunks. Emitted chunk separation is real; request timing is the gap.

## Feature-inventory check

All Workbench panes are implemented. This specification changes delivery and
recovery behavior, not product scope.

Parent feature statuses remain `Valmis`. A pane failure is shown as a temporary
availability problem, not as “feature not implemented”. The backlog card is a
performance and resilience finishing pass.

## User promise

- The current pane either shows its content, a named loading state or a named
  sanitized failure state; it is never silently blank.
- A pane that the user has not activated does not download its feature chunk.
- After a pane loads successfully once, switching away and back preserves its
  current mounted presentation state.
- If one pane fails, the header, setup context, Workbench tabs, other panes,
  saved browser data and global recovery remain usable.
- Reloading after a pane failure never clears saved data automatically.

## Goals

- Request only the initial Compare chunk at startup, plus direct/runtime/static
  dependencies required by the shell.
- Request each other lazy pane family on first activation.
- Keep every successfully visited pane mounted and hidden on later tab changes.
- Give the active tabpanel explicit `not-requested`, `loading`, `ready` and
  `failed` state metadata.
- Render accessible, bounded loading and failure UI in the active panel.
- Catch lazy-import, render and lifecycle errors at the nearest pane boundary.
- Isolate Workspace tool failures inside Settings.
- Preserve the root Error Boundary for shell, composition, synchronous shared
  presenter and boundary-component failures.
- Measure shell-ready and initial-pane-ready separately and prove deferred
  request behavior from a production build.

## Non-goals

- Do not introduce routing, server rendering, service workers, offline caching,
  speculative idle loading or a CDN prefetch policy.
- Do not unmount a successfully visited pane merely because it becomes hidden.
- Do not move feature/domain state from App into pane-local state as part of the
  loader change.
- Do not add a global state library, context registry or generic application
  controller.
- Do not change calculation Worker lifecycle, formulas, storage schemas,
  transfer envelopes or provider behavior.
- Do not catch event-handler errors or rejected controller Promises with a React
  Error Boundary; those remain with their typed feature outcomes.
- Do not offer saved-data-ignore mode for an isolated chunk failure. That mode
  remains a full-app recovery tool.
- Do not show raw import URLs, chunk hashes, exception messages, stacks,
  component stacks or persisted values.
- Do not claim lower total artifact bytes. The change delays requests; it does
  not remove required feature code.
- Do not add per-engine visual baselines or change the deployment target.

## Pane-family registry

Use one closed mapping owned beside the Workbench shell/composition boundary:

| Pane family        | Workbench tab ids       | Delivery owner                                    |
| ------------------ | ----------------------- | ------------------------------------------------- |
| Stats              | `stats`                 | synchronous entry owner                           |
| Loadout            | `loadout`               | `loadout-pane` lazy chunk                         |
| Compare            | `compare`               | `compare-pane` lazy chunk; initial requested pane |
| Duel               | `duel`                  | `duel-pane` lazy chunk                            |
| Loot               | `loot`                  | `loot-pane` lazy chunk                            |
| Trip               | `trip`                  | `trip-pane` lazy chunk                            |
| Risk               | `risk`                  | `risk-pane` lazy chunk                            |
| Cannon             | `cannon`                | `cannon-pane` lazy chunk                          |
| Planner            | `planner`               | `planner-pane` lazy chunk                         |
| Economy / Settings | `economy`, `settings`   | one shared `economy-settings-lazy` chunk          |
| Workspace tools    | nested under `settings` | nested `workspace-backup-panel` lazy chunk        |

Every `WorkbenchTabId` must map exhaustively to one family. Typecheck or a
focused test must fail when a tab is added without a load owner and label.

Stats still receives the same pane Error Boundary even though it has no lazy
loader. A Stats render/lifecycle error should not erase other tabs.

## Request and mount lifecycle

Maintain a session-only set of requested pane families in the App composition
root or a small shell-owned hook. It is presentation delivery state and is not
persisted.

Rules:

1. Initialize the set with the URL-selected family; missing/invalid URL state
   uses Compare because it remains the default active tab.
2. Every tab/quick-navigation/action route continues through the single typed
   `activateWorkbenchTab(tabId, source)` owner.
3. That owner adds the mapped family to the requested set before or in the same
   state transaction as changing `activeTab`.
4. Render a lazy pane subtree only if its family has been requested.
5. Do not remove a family after it resolves, fails or becomes hidden.
6. Continue passing the current `hidden`/mode contract so successfully mounted
   pane state and effects behave as they do today.
7. Activating Economy or Settings requests the shared family once; switching
   between those tabs makes no additional module request or remount.
8. Workspace tools are requested only when Settings content renders. Economy
   activation alone must not request the Workspace presenter chunk.

Derive “requested because currently active” synchronously so there is no blank
intermediate render if React batches the set and tab updates differently.

Do not attach loading to hover, pointer entry or tab focus in this goal. Roving
keyboard focus may pass across several tabs without expressing activation, and
must not download them.

## Pane load-state contract

Expose the active family state on `#workbench-active-panel`:

```text
data-pane-family="compare"
data-pane-load-state="loading"
```

Allowed states:

- `not-requested`: defensive only; an active mapped tab should transition in
  the same render and tests treat a lasting state as a defect;
- `loading`: a requested lazy module has not mounted;
- `ready`: the active pane component mounted successfully; and
- `failed`: the nearest pane boundary contains an import/render/lifecycle
  failure.

Stats is `ready` once its synchronous subtree mounts. A hidden requested pane
may continue loading or fail, but its state is not announced until the user
activates that family.

The root `data-app-startup-state="ready"` continues to mean runtime data and the
shared shell are usable. Update the startup measurement language and script so
“initial workbench ready” additionally waits for the active pane's `ready`
marker. Do not silently change the meaning of existing historical measurements;
report new shell-ready and initial-pane-ready fields separately.

## Loading presentation

Replace every `fallback={null}` with the shared pane fallback. While active it
renders inside the existing tabpanel:

```text
Loading <current tab label>…
```

Contract:

- one lightweight section with the current tab's visible label;
- `role="status"` and polite live behavior only while the family is active;
- `aria-busy="true"` on the active panel;
- sufficient minimum block size to keep setup/results around it stable;
- no fake progress percentage, spinner dependency or long explanatory copy;
- no focus move away from the activating tab; and
- hidden fallbacks are absent from the accessibility tree and cannot announce.

When the pane mounts, remove `aria-busy`, set `ready` and reveal existing pane
content. A fast cached revisit shows no fallback because the pane stayed
mounted.

## Failure isolation

### Boundary placement

Each pane subtree uses this order:

```text
PaneErrorBoundary
  Suspense
    Pane
```

The boundary catches:

- rejected lazy imports;
- render failures in that pane;
- constructor/lifecycle failures in descendants; and
- failures in the pane's own lazy nested presenter unless a narrower boundary
  owns it.

The boundary does not catch:

- event-handler throws;
- arbitrary asynchronous rejection after render;
- Worker/controller outcomes already represented by feature state; or
- failures in the shell, registry or boundary fallback itself.

Those categories keep their current controller or root boundary owner.

### Visible failure

For active `<Pane label>`, render one fixed region:

```text
<Pane label> is unavailable
This part of the simulator could not be loaded. Other tabs are still available.
Your saved browser data was not changed.
```

Use `role="alert"`, a heading and actions appropriate to the known failure
kind:

- lazy/chunk failure: **Reload simulator**;
- already loaded render/lifecycle failure: **Try pane again** and
  **Reload simulator**.

All other Workbench tabs remain operable. Normal tab activation hides the
failed region without resetting it; returning shows the same contained state.

Do not render the thrown value or add application telemetry/logging from this
boundary. React/browser development diagnostics are not user-visible copy and
must not be copied into test artifacts containing user data.

### Retry and reload

**Try pane again** resets only the already loaded pane Error Boundary and
remounts that pane family. App-owned domain/persistence state remains unchanged;
pane-local presentation state may reset and the fixed copy need not promise
otherwise.

After a successful Try, move focus to the active tabpanel because the invoking
button is removed. On repeated failure, keep the new failure controls reachable
without an automatic loop.

A rejected lazy import does not promise pane-only Retry because `React.lazy`
caches its loader Promise and browser module failures may also be retained for
the document. **Reload simulator** performs the existing normal reload. It does
not set safe-session mode and does not clear or repair storage.

## Nested Workspace isolation

Keep the existing named Workspace loading fallback and add a boundary local to
the Workspace tools region.

If its presenter chunk fails:

- Settings navigation, hidden-tier controls, local-state recovery and monster-
  specific management remain usable;
- only the `Workspace tools` region shows fixed failure copy and normal reload;
- no Workspace candidate, live setup or browser storage is changed; and
- the parent Economy/Settings pane remains `ready` with the nested region
  identified as failed.

Restore-plan and executor dynamic imports happen after explicit Workspace
actions and remain owned by the Workspace controller's typed busy/error state.
If current controller code cannot normalize one of those import failures,
implementation must add a fixed controller outcome rather than rely on a React
boundary.

## Hidden pane behavior

Loaded hidden panes retain the existing mounted-state contract. This means:

- App continues to calculate and pass current typed props;
- pane-local disclosure, filter and draft state survives navigation where it
  does today;
- hidden DOM uses the current `hidden`/mode semantics and is not tabbable or
  exposed in the accessibility tree;
- hidden pane loading/failure statuses do not announce; and
- a failure caused by a hidden pane update is contained and becomes visible
  only when that pane is activated.

This goal does not authorize hidden panes to run new background network or
calculation work. Existing active flags for Compare, Duel, Planner and Risk
remain authoritative.

## Performance and artifact contract

### Network request evidence

In a cold production-preview context:

1. startup may request direct entry assets, the generated runtime chunk, shared
   static dependencies and the initial Compare chunk;
2. it must not request Loadout, Duel, Loot, Trip, Risk, Cannon, Planner,
   Economy/Settings or Workspace presenter chunks before activation;
3. activating one lazy family requests its emitted chunk and required shared
   dependencies exactly once;
4. revisiting the family produces no second feature-chunk request; and
5. activating Settings after Economy reuses their shared chunk and requests
   Workspace tools only when the Settings-owned region renders.

Tests identify chunks by stable emitted stem plus hash or a build-produced
manifest; they never hard-code a complete hash.

### Startup measurement

Extend `npm run startup:measure` additively with:

- shell/runtime ready time;
- initial active-pane ready time;
- JavaScript request/transfer/decoded bytes at shell ready;
- the same totals at initial pane ready; and
- the list of requested JavaScript paths for each checkpoint.

Cold/warm paired samples, medians and workstation-evidence caveats remain. Do
not compare the new initial-pane field directly with an old root-only
`appReadyMs` without labeling the semantic difference.

### Deterministic artifact gate

- Direct entry raw/gzip budgets remain D-098's existing limits.
- All feature assets remain hashed and covered by immutable asset headers.
- The build must still emit separate bounded pane chunks; merging all panes
  back into entry fails the purpose even if request tests are mocked.
- No limit is raised solely to accommodate the small loader/boundary registry.
- Total artifact byte count may stay similar; only request timing is claimed.

## Privacy and security

- Pane status contains only fixed product labels and fixed messages.
- Never expose chunk URLs, hashes, local paths, error messages, stacks,
  component stacks, storage keys or payload contents.
- Failure and Retry do not read, export, clear, replace or repair saved data.
- Normal reload retains the current storage selection. Safe-session behavior is
  entered only through the existing explicit full-app recovery action.
- No new remote logging, error reporting, analytics or network origin is added.
- Production CSP and same-origin chunk loading remain unchanged.

## Accessibility and focus

- The selected tab remains selected while its pane loads or fails.
- Initial activation leaves focus on the tab/initiating control.
- Active loading is one polite status; hidden loading is silent.
- Active failure is one alert and includes a heading plus native buttons.
- Other tabs remain in the same roving tablist and keyboard navigation works
  from the selected tab.
- Successful pane Retry focuses `#workbench-active-panel`; normal initial load
  does not move focus.
- `aria-busy` is true only for the active pending pane and false/absent after
  ready or failure.
- Reduced motion, narrow viewport and 200% zoom retain readable bounded states.

## Implementation outline

1. Add the exhaustive pane-family metadata/label/importer registry without
   moving domain state or large JSX ownership.
2. Add a requested-family set initialized with Compare and route all activations
   through its existing App action.
3. Conditionally render unvisited lazy families while retaining visited hidden
   families.
4. Add a shared pane status/fallback and class Error Boundary capable of
   distinguishing sanitized loader failure from post-load render failure.
5. Wrap Stats and every lazy family; add the narrower Workspace boundary.
6. Connect active-panel state/`aria-busy` and retry focus without duplicating
   global status announcements.
7. Normalize any Workspace post-render dynamic-import rejection through its
   controller if inspection finds an uncovered path.
8. Extend production-preview request/failure tests and startup measurement.
9. Confirm artifact chunk names/count/budgets and update owning architecture,
   testing and operations evidence.

## Required unit and component tests

Add focused coverage proving:

- every Workbench tab maps to exactly one pane family and label;
- Compare is requested initially and no other lazy family is;
- first activation adds a family; repeated activation is idempotent;
- Economy and Settings share one requested family;
- requested families are never removed on tab changes;
- loading output has the correct label/status/busy semantics only while active;
- a sanitized lazy rejection is caught without raw error content and offers
  Reload only;
- an already loaded render/lifecycle failure offers pane Retry plus Reload;
- pane Retry remounts only that subtree and calls the focus-return contract;
- a hidden pane failure does not announce and becomes visible on activation;
- shell/other-pane test sentinels remain mounted after one pane fails; and
- Workspace failure leaves sibling Settings regions rendered.

Keep the existing `ApplicationErrorBoundary` tests. Add a root-level regression
that a shell failure still reaches full-app recovery; pane isolation must not
swallow errors above its boundary.

## Required production-preview tests

Use request observation/routing against a production build to prove:

1. cold startup request set excludes every unvisited feature chunk;
2. initial Compare shows a named loading state under throttled response, then
   becomes ready;
3. activating Risk under a throttled chunk shows `Loading Risk…`, leaves the
   tabs usable and resolves without focus theft;
4. visiting Risk twice requests its feature chunk once and preserves a
   pane-local control value;
5. Economy then Settings requests the shared pane once and Workspace only on
   Settings activation;
6. aborting one unvisited pane chunk yields its sanitized local failure while
   Stats and another pane remain usable and saved storage stays byte-for-byte
   unchanged;
7. normal Reload recovers when the route allows the chunk on the new document;
8. an injected one-time post-load render failure recovers through **Try pane
   again** without reloading or changing saved data; and
9. a Workspace chunk failure leaves Settings siblings usable.

Do not rely solely on jsdom mocks: the central promise is real emitted-chunk
request timing and production-browser failure containment.

The cross-browser release manifest adopts the startup/all-pane and failure rows
after its separate specification is implemented.

## Validation commands

Implementation is complete only after exact focused filenames/scripts are
recorded by the testing owner. Expected minimum:

```bash
npm run typecheck
npm run test -- src/tests/application-error-boundary.test.tsx
npm run test -- src/tests/deployment-readiness.test.ts
npm run startup:measure
npm run test:e2e -- --workers=1 --grep "pane loading|pane failure"
npm run architecture:check
npm run build
npm run verify
git diff --check
```

Run the complete functional Chromium suite because every tab changes delivery
lifecycle. Run the read-only visual suite; update snapshots only if the new
loading/failure states intentionally enter the owned baseline matrix.

## Completion criteria

- Startup requests Compare but no unvisited lazy pane chunk.
- Every first activation shows content or named loading/failure feedback.
- Successfully visited panes remain mounted and reuse one feature request.
- One pane import/render/lifecycle failure cannot remove shared shell, tabs or
  other pane usability.
- Stats and nested Workspace use the correct isolation boundary.
- Loader failures use Reload; post-load failures can retry only the pane.
- Saved browser data remains byte-for-byte unchanged across failure, Retry and
  normal Reload.
- Startup measurement distinguishes shell and initial-pane readiness.
- Entry budgets, hashed chunks, CSP, calculations, persistence, accessibility
  and root recovery remain intact.
- Browser and component regressions pass with no raw failure detail in the DOM.

## Open questions

None for specification. Speculative prefetch, router integration and offline
chunk caching remain separate product/performance decisions and are not needed
to complete this goal.

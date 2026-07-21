# Workbench browser history and page-context specification

- Status: implemented and browser-verified 2026-07-21
- Priority: medium
- Estimated effort: M
- Owner: pure workbench URL state, App navigation composition and document title
- Feature-inventory parents: Desktop workbench, Keyboard navigation, mobile
  result/navigation loop and lazy pane loading (`Valmis`)
- Depends on: the current 11-tab allowlist, pane-family request lifecycle and
  share-fragment capture contract
- Executable goal:
  [PF-06 · Add workbench browser history and context](../project/goals/pf-06-workbench-history-context.md)

## Purpose

Make the active workbench pane part of browser history and page context. A user
must be able to reload a pane, open an allowlisted pane URL and use browser
Back/Forward without losing the current setup or being returned silently to
Monsters.

The browser title should identify the active pane and current target so tabs,
history and assistive-technology context are meaningful.

## Implementation result

`src/app/state/workbench-browser-context.ts` now owns exact parsing for the 11
`WORKBENCH_TABS` ids, Compare fallback/canonicalization, root/sub-path URL
writing, the exhaustive activation-source history policy and source-backed title
formatting. `App` initializes the active pane and requested lazy family from the
captured URL, canonicalizes only invalid `pane` entries, writes one entry for
changed user/routed activation, uses replace for internal restoration and owns
one cleaned-up `popstate` listener. History activation never writes recursively.

The ready title follows pane, source-backed target and dynamic Loadout style.
The static title remains during startup and the effect restores the prior title
on cleanup. Popstate retains normal focus unless the prior focus belonged to the
pane being hidden, in which case the newly active tab receives focus after the
render settles. Share capture preserves pane/safe query state and removes only
its setup fragment; the Share action still generates a clean query-free setup
URL.

Focused coverage passes 7 files / 109 tests including all 11 ids, invalid and
bounded input, URL/hash preservation, title and lazy-family seeding. The named
Chromium transaction passes 1/1 and the complete CB-01 through CB-12 release
manifest passes 36/36 in Firefox, desktop WebKit and iPhone 13-emulated WebKit.
Architecture passes at 178 source modules / 164 client-reachable modules, eight
entrypoints and zero cycles. The final integrated repository gate is recorded in
the dated testing evidence log.

## Pre-implementation evidence and resolved problem

Before PF-06, `App` initialized `activeTab` to `compare` and
`activateWorkbenchTab()` only updated React state plus lazy pane-family requests.
The URL did not record the pane, so reload and Back/Forward lost workbench
context.

`index.html` provided only the static title `2004scape Combat Simulator`; the
ready app did not update `document.title`.

The 11 workbench ids and the lazy first-activation lifecycle are already typed.
Shareable setup capture uses the URL fragment once and removes only its `setup`
entry while preserving query parameters. Safe-session fallback uses the
`index_sim_safe_session=1` query parameter. New pane URL ownership must compose
with both.

## Feature-inventory boundary

All parent rows remain `Valmis`. This is a work-context continuity improvement,
not a new pane or persistence feature.

The first-visit/default-pane decision remains unchanged:

- no `pane` parameter means `compare`/Monsters;
- invalid input falls back to the same default; and
- only an explicit allowlisted URL or history entry changes initial pane.

This card does not resolve any broader product question about making another
pane the default.

## URL contract

### Query parameter

Use one query parameter:

```text
pane=<workbench-tab-id>
```

Accepted values are exactly the current `WorkbenchTabId` allowlist:

```text
stats
loadout
compare
duel
loot
trip
risk
cannon
planner
economy
settings
```

Parsing is case-sensitive and exact. Reject duplicate `pane` parameters,
empty values, unknown ids, encoded path/control characters and arrays. Invalid
input must not be reflected into ids, selectors, titles or logs.

### Canonical default

- A URL without `pane` activates `compare` and remains without `pane` on first
  load.
- `?pane=compare` is valid and may remain; do not add it automatically for the
  default.
- An invalid/duplicate value activates `compare` and removes all invalid `pane`
  entries with `history.replaceState`, preserving every unrelated query
  parameter and fragment.

### Preservation

Every pane URL write must preserve:

- current origin and deployment base path;
- all unrelated query parameters, including `index_sim_safe_session`;
- every unrelated fragment entry; and
- the `setup` fragment until the existing share-capture owner has inspected and
  removed it.

The workbench history owner never decodes, creates or deletes setup payloads.
The existing Share action continues to generate its own clean static setup URL
without inheriting pane or safe-session query state.

## Navigation contract

Use an explicit activation source:

```ts
type WorkbenchActivationSource =
  "initial-url" | "user" | "routed-action" | "history" | "internal-restore";
```

### Initial URL

1. Parse the URL through a pure allowlist helper.
2. Initialize active tab from the valid pane or `compare` fallback.
3. Seed requested pane families from that initial tab so a direct Planner,
   Risk, Settings or other optional-pane URL requests its lazy chunk immediately.
4. Do not push a history entry on mount.
5. Canonicalize only invalid/duplicate pane parameters with `replaceState`.

The static pre-React shell and startup guard remain independent of pane chunks.
An optional deep-linked pane failure remains contained by the existing
pane-level failure boundary after the shared shell is ready.

### User navigation

Tab click, roving-tab keyboard activation and mobile More selection:

- activate/request the selected pane through the existing lifecycle;
- `pushState` one entry with its exact `pane` value when the selected pane
  differs from the current pane; and
- do nothing to history when reactivating the current pane.

One key press/click creates at most one history entry. Horizontal tab scrolling
does not create an entry.

### Routed actions

Existing actions such as `Review in Economy`, `Edit in Loadout`, warning routes
and Settings review routes create one history entry when they move to a
different pane. Their existing follow-up focus/disclosure intent remains
attached to the activation and runs after the lazy pane is ready.

If a routed action targets the already active pane, it performs its focus or
disclosure intent without adding a duplicate entry.

### Browser Back/Forward

One `popstate` listener reparses the current URL and activates the valid pane
without another push or replace. It must:

- request the pane's lazy family if not yet requested;
- retain mounted visited pane state under the current lazy contract;
- ignore obsolete completion from a pane no longer active;
- fall back safely to `compare` for an externally altered invalid URL; and
- update title only after current ready state is composed.

Back/Forward changes pane only. It does not restore form values, setup, scroll
position, selected table rows or calculation results from historical snapshots.

### Internal restoration

Internal temporary navigation that deliberately restores a previous pane as
part of one operation uses `internal-restore` and `replaceState` or no URL write,
as appropriate. It must not create a misleading extra Back step.

Audit every current `activateWorkbenchTab()` call site and classify it. Add an
exhaustive helper/API so new call sites cannot silently choose history behavior.

## Page-title contract

### Ready title

When the app is ready, set:

```text
<Pane label> · <Target monster name> · 2004scape Combat Simulator
```

Examples:

```text
Planner · Hill Giant · 2004scape Combat Simulator
Economy · Hill Giant · 2004scape Combat Simulator
Ranged setup · Dagannoth · 2004scape Combat Simulator
```

Use the same source-backed target and dynamic Loadout tab label as the visible
workbench. If the target display label is unavailable, use fixed sanitized
`Unknown target`, never a raw error or source path.

Title updates when:

- active pane changes;
- current target changes; or
- combat style changes while the Loadout pane is active.

It does not include player name, gear, prices, dirty status, raw ids,
calculation state or imported filenames.

### Startup and failure

- Keep the static `2004scape Combat Simulator` title before runtime readiness.
- Bootstrap/application fatal error may use
  `Error · 2004scape Combat Simulator` with fixed copy only, but implementing
  that optional failure title is not required for this card.
- On App unmount in component tests, restore the prior document title so tests
  and embedded harnesses do not leak global state.

Title changes use `document.title`; do not add a redundant assertive live region
for every pane activation.

## Focus, scroll and accessibility

- Existing direct tab keyboard focus remains on the activated tab.
- Routed actions retain their explicit target-heading/control focus behavior
  after lazy readiness.
- `popstate` does not generally steal focus. If focus is inside the pane being
  hidden, move it to the newly active tab after that tab exists; otherwise
  retain current focus.
- Do not scroll the document to the top on every history activation. Existing
  pane-local scroll state may remain mounted as today.
- `aria-selected`, `aria-controls`, dynamic Loadout label and the visible pane
  must agree with the URL-derived active id.
- A title uses plain text and source-backed names. It is useful browser/AT
  context, not a substitute for pane headings or tab semantics.

## Architecture and ownership

Create a DOM-free URL helper under app state or browser adapter ownership with
explicit functions equivalent to:

```ts
parseWorkbenchPaneUrl(url): ParsedWorkbenchPane
createWorkbenchPaneUrl(url, pane): string
removeInvalidWorkbenchPane(url): string
formatWorkbenchDocumentTitle(input): string
```

Requirements:

- `WORKBENCH_TABS`/`WorkbenchTabId` remains the sole pane allowlist;
- URL parsing/writing has no React or pane-component dependency;
- `App` owns one active-tab state and composes activation source, pane-family
  request, history write and existing focus requests;
- one thin effect owns `popstate` registration and cleanup;
- one thin effect owns the ready document title and cleanup;
- lazy pane owners remain unchanged; and
- no pane reads `window.location` or writes history directly.

Do not persist active pane in localStorage, Workspace, setup files or share
payloads. Browser history is the only continuity owner.

## Security and privacy constraints

- Accept only exact allowlisted pane ids.
- Never render arbitrary query values into DOM ids, CSS selectors or titles.
- Preserve but do not interpret unrelated query/fragment data.
- Do not put current player name, imported content or local state into history
  state or title.
- History state may contain a fixed version/tag plus pane id; it must not contain
  setup payloads or snapshots.
- Do not add analytics, telemetry or server requests for navigation.

## Required tests

### Pure URL/title tests

- Parse every allowed pane and the no-parameter default.
- Reject unknown, empty, mixed-case, duplicate, control/path-like and oversized
  values.
- Canonicalize invalid pane input while preserving safe-session query and
  unrelated fragment entries.
- Create a pane URL under root and sub-path deployment without losing query or
  fragment.
- Prove the workbench helper does not remove `#setup`; prove the existing share
  capture removes only setup and preserves pane.
- Format static, dynamic Loadout and fallback titles without raw ids/errors.

### App and component tests

- Valid initial pane seeds the correct requested pane family; missing/invalid
  uses Compare.
- User and routed activations push once; same-pane activation does not.
- History activation never pushes recursively.
- Internal restore does not add a misleading history step.
- Listener and title effects clean up exactly once.
- Active tab, URL, panel visibility and title always agree.
- Popstate focus moves only when the old active element becomes hidden.

### Browser tests

1. Open `?pane=planner`, verify Planner loads directly and title names Planner
   plus target.
2. Navigate Planner → Economy → Trip with tab, routed and mobile-More actions.
3. Use Back twice and Forward twice; verify URL, visible pane, lazy readiness,
   retained pane state and title each time.
4. Reload on Planner and remain on Planner with setup state unchanged.
5. Open invalid/duplicate pane input and verify safe Compare fallback plus URL
   canonicalization.
6. Open `?pane=planner&index_sim_safe_session=1#setup=<fixture>` and prove safe
   mode, share review/capture, pane URL and fragment cleanup compose without
   losing each other's state.
7. Verify keyboard focus and 390 px mobile navigation.

Run the case in Chromium, Firefox and WebKit because History API, lazy loading,
focus and URL behavior form a supported-browser workflow.

### Validation

Run at minimum:

```sh
npm run typecheck
npm run test -- <focused workbench-url/app-shell/pane-delivery/share-url suites>
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "restores workbench pane through browser history"
git diff --check
```

No visual baseline change is required if the visible UI is unchanged. Run the
existing mobile navigation case to guard active-tab reveal and overflow.

## Acceptance criteria

- Every allowlisted pane can be opened and reloaded through `?pane=<id>`.
- Missing/invalid input preserves the current Compare default and invalid input
  is safely canonicalized.
- User/routed pane navigation creates useful Back/Forward history without loops
  or duplicate same-pane entries.
- Direct and historical activation request lazy pane families correctly and
  preserve current mounted-visited behavior.
- Safe-session query and share-fragment capture compose without data loss.
- Ready document title names the active pane and current source-backed target.
- No active-pane persistence schema, setup/share payload or initial default
  changes.
- Focused unit, App, three-browser, architecture and diff checks pass.

## Open questions

None. Whether a future release changes the default pane remains a separate
product decision and is intentionally not answered by this history contract.

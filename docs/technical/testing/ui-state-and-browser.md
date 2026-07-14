# UI, state and browser testing

This guide owns the feature view-model, persistence, controller, pane and functional browser inventory. The authoritative gate summary and change-type matrix remain in
[the main testing guide](../testing.md).

The feature-file map, shared-fixture boundary and title-preservation contract
are owned by
[the implemented feature test-suite split](../feature-test-suite-split-spec.md).

## UI, adapters and persistence tests

The current rewrite UI tests live in:

- `src/tests/*-view-model.test.ts`
- `src/tests/ui-performance.test.ts`
- `src/tests/ui-adapters.test.ts`
- `src/tests/e2e/*.spec.ts`

Run unit/integration coverage with:

```sh
npm run test
```

Run browser smoke tests with:

```sh
npm run test:e2e
```

They cover:

- UI form state to `SimulationRequest` separation
- searchable weapon, ammo, spell and equipment-slot option view models
- supported special attack state to `SimulationRequest.specialAttack` mapping, including ranged spec-arrow fallback, DBA boost suppression and magic unsupported fallback
- source-backed size-1/large dragon halberd selected-target behavior plus warning surfacing only for the missing-size legacy fallback
- manual accuracy/damage/speed override state to `SimulationRequest.manualOverrides` mapping and visible combat metric changes
- MonsterCard view-model contract for nullable monster stats, active defence rows and compact setup summaries
- extended trip-control state to `TripPolicy` mapping without leaking trip fields into `SimulationRequest`
- scarce/AFK Trip controls, inventory reserve details, prayer restore capacity, Trip summary Auto/Manual wording and derived general potion recommendation status/`canApply` state in the UI view model
- domain-backed result, compare and planner view models
- Stats combat roll detail metrics for melee/ranged/magic paths and fallback rendering for unavailable roll values; active setup `Damage distribution` view-model labels, bucket accessibility text and probability-total invariants; and TTK/kills/hr/GP/kill mapping
- Stats source breakdown view-model rows and source-detail records for normal attack, special attack and cannon statuses, including normal and event-scoped source histograms, melee/ranged modeled special detail, magic/DBA fallback detail, dragon-halberd partial warning detail, cannon-enabled metrics and idle cannon detail; plus XP routing rows, cannon-only XP row visibility, modeled Prayer/Magic-alch total-XP rows and Trip/banking summary mapping
- Stats event-scoped special-hit and fired-cannonball histograms, probability totals, partial-special support and inactive/idle null states
- active assumptions/modifiers summary view-model rows for empty/default state, manual combat overrides, enabled cannon settings, loot settings, loot action overrides, imported/synced PriceSet modifiers, money warnings, dragon-halberd special warning, explicit safespot and protection-prayer split rows, targeted reset metadata, review-only boundaries, reset scoping and stable priority order/five-row overflow
- Duel comparison view-model rows for live setup and saved snapshots against the current monster, including deltas and best-marker fields
- Duel structured setup diffs, shared-context exclusions and expanded combat/trip/XP/economy impact deltas
- structured money warning view models for price alias and fallback surfacing
- random-herb `Unid` valuation through all eleven source item ids, exact-price
  precedence, weighted EV, selected-row/nested-row presentation and the visible
  generic `unidentified_guam` proxy warning when species prices are absent
- dense compare monster/drop filters, irrelevant monster state, active-target forced visibility and derived row state markers
- dense compare XP/hr and net GP/hr visible-row scale affordance model, including separate positive and negative net GP/hr scaling
- special attack result metrics in the UI view model
- numeric summary parity for the default melee fixture and a ranged safespot fixture
- cannon-enabled view-model coverage for visible XP/hr, GP/hr, net GP/hr and supply changes
- linked cannon/sparse assumptions, cannon reserve impact and cannonball supply costs in the UI view model
- a performance smoke test that keeps the immediate level-input calculation path smaller than compare/planner full-panel work
- versioned rewrite setup persistence through `PersistedEnvelope<T>`
- separate versioned Duel snapshot persistence under `index-sim:duel-snapshots`, including snapshot name/form normalization, max-list limits, strict export/import envelope validation, safe merge behavior and rejection of computed-result payloads
- dense compare filter defaults, persisted irrelevant monster state and cleanup of unknown monster ids
- per-combat-type loadout stash/restore, persisted schema validation and active loadout mapping into `SimulationRequest`
- multi-prayer and multi-boost normalization, canonical `None` handling, unknown id dropping and same-category replacement before `SimulationRequest`
- manual combat override persistence/defaulting and bounded domain behavior
- active weapon, gear, ammo and spell selection mapping into `SimulationRequest`, including two-handed weapon shield lock/clear behavior
- deterministic visible-candidate gear quick actions for the active combat style, including current-selection ties, shield-lock disabled state and generated-or-fallback requirement reason copy
- rewrite-owned monster-specific custom setup create/restore/remove helpers, persisted schema validation and dense row marker/calculation mapping
- per-monster loot settings for high-alch enablement, kill overhead and talisman spot, with separate persistence and reset helpers from `index-sim:loot-prefs`
- defaulting and sanitization for newly modeled trip-control fields in persisted rewrite setups
- defaulting and sanitization for special attack controls in persisted rewrite setups, including unknown, combat-style-incompatible and DBA-conflicting active/per-style/custom setup state
- versioned per-monster cannon settings persistence in the rewrite setup envelope
- derived general potion recommendations staying out of persisted rewrite setup state
- versioned last-player hiscores and browser-local price history persistence through `PersistedEnvelope<T>`
- shared plus browser-local Economy movers/trends, `Save local comparison` and confirmed `Clear local history` that removes only `index-sim:price-history`
- refusal to implicitly migrate mismatched persisted versions
- validated `PriceSet` import errors with non-fatal UI notices and retry recovery
- non-fatal rewrite setup import failures for invalid JSON, unsupported setup versions, invalid schema data and oversized files, preserving the visible and persisted setup while leaving file input retryable
- Playwright smoke covers the workbench shell and complete accepted workflow inventory, including generated requirement copy and the remaining missing-size legacy dragon-halberd warning path; detailed cases live in `src/tests/e2e/*.spec.ts` and the visual matrix.

Run the focused browser smoke for the visible Stats workflow with:

```sh
npm run test:e2e -- --grep "Stats"
```

Run the focused browser smoke for the accepted Goal 1 Combat/Stats/Special slice
with:

```sh
npm run test:e2e -- --workers=1 -g "restores per-combat-style"
npm run test:e2e -- --workers=1 -g "shows Stats XP routing"
npm run test:e2e -- --workers=1 -g "selects special attacks"
npm run test:e2e -- --workers=1 -g "explains setup ownership"
```

The setup-ownership case verifies current prayer/boost, potion-carry/prayer
restore and loot-policy summaries, the negative net-GP supply gap, direct Trip
and active-style navigation and the explicit combat-potion labels. The
2026-07-11 focused Chromium run passed this case together with desktop console,
mobile order, multi-prayer/multi-boost and potion-carry coverage (5/5).

Run the focused browser smoke for the Dense Compare scale indicators with:

```sh
npm run test:e2e -- --grep "dense XP"
```

Run the focused browser smoke for Dense Compare calculation freshness with:

```sh
npm run test:e2e -- --grep "calculation freshness"
```

Run the focused browser smoke for Dense Compare release-path numeric snapshots with:

```sh
npm run test:e2e -- --grep "release-path dense"
```

Run the focused browser smoke for the accepted Goal 2 Dense/Compare slice with:

```sh
npm run test:e2e -- --workers=1 -g "keeps the desktop workbench inside one console viewport"
npm run test:e2e -- --workers=1 -g "keeps long selected monster names readable"
npm run test:e2e -- --workers=1 -g "keeps compact setup actions, Risk controls and Duel summaries readable"
npm run test:e2e -- --workers=1 -g "keeps every workbench tab inside a narrow mobile viewport"
npm run test:e2e -- --workers=1 -g "keeps search inside the dropdown and supports keyboard selection"
npm run test:e2e -- --workers=1 -g "uses popup search for every primary long-choice field"
npm run test:e2e -- --workers=1 -g "keeps the Food dropdown search and results inside the mobile viewport"
npm run test:e2e -- --workers=1 -g "keeps Dense Compare mobile and tablet overflow contained"
npm run test:e2e -- --workers=1 -g "shows dense compare calculation freshness"
npm run test:e2e -- --workers=1 -g "filters dense compare rows and persists hidden monsters"
npm run test:e2e -- --workers=1 -g "shows dense row markers"
npm run test:e2e -- --workers=1 -g "matches browser-rendered dense numeric snapshots"
npm run test:e2e -- --workers=1 -g "sorts the full monster table and selects a target row"
```

The desktop console case fixes the viewport at 1280×720, waits for the dense
rows, asserts that document/body height stays inside the viewport, verifies
`auto` vertical overflow ownership for PlayerSidebar, the active pane and
MonsterCard, scrolls the two overflowing regions and confirms `window.scrollY`
remains zero. The mobile/tablet case continues to own normal document flow,
pane order and horizontal table containment. The 2026-07-11 focused Chromium
run passed all three desktop-console, mobile-order and mobile/tablet-overflow
cases (3/3).

The long-value case selects Water Elemental through the setup context, verifies
that both synchronized monster selects expose the complete label, measures the
rendered label against usable select width at 1280x720 and confirms that setup
guide summaries use wrapping rather than ellipsis.

The whole-UI audit regressions cover the compact setup action row, Risk action
containment, Duel summary wrapping, the shared popup-combobox presentation and
document-width/setup-context containment for every workbench tab at 390x844.
The keyboard case filters and selects Magic `Fire Wave`; the inventory case
opens the setup/MonsterCard targets, weapon, every gear slot, ammo, spell, Trip
food, Risk target drop and Economy snapshot/trend-item popups and confirms the
search stays inside each. The mobile case checks the Food popup and selected
Swordfish state at 390x844. The Settings recovery case verifies that a large
legacy-migration notice owns a bounded desktop scroll area instead of covering
workbench controls. The final full gate passed 73/73 browser cases; `npm run verify` passed 586 unit tests,
19/19 legacy goldens, build/artifact, lint, format and diff checks with artifact
SHA-256 `66f25a71cabfd55811a51f78303b34bfb7f49b6d026f188ba2c97c7ddebd431c`.

Run the focused browser smoke for the accepted Loot/Economy slice with:

```sh
npm run test:e2e -- --workers=1 -g "updates per-monster loot settings"
npm run test:e2e -- --workers=1 -g "updates current monster loot actions"
npm run test:e2e -- --workers=1 -g "shows loot value composition"
npm run test:e2e -- --workers=1 -g "renders scheduled price status"
npm run test:e2e -- --workers=1 -g "keeps market UI scheduled-only"
npm run test:e2e -- --workers=1 -g "analyzes and manages browser-local price history"
npm run test:e2e -- --workers=1 -g "keeps shared scheduled price history"
```

Run the focused browser smoke for the accepted Trip slice with:

```sh
npm run test:e2e -- --workers=1 -g "updates trip survival controls"
npm run test:e2e -- --workers=1 -g "updates manual food controls"
npm run test:e2e -- --workers=1 -g "updates trip food, banking"
npm run test:e2e -- --workers=1 -g "updates trip potion carry"
npm run test:e2e -- --workers=1 -g "shows inactive trip potion recommendation"
npm run test:e2e -- --workers=1 -g "updates prayer restore detail"
npm run test:e2e -- --workers=1 -g "enables cannon"
```

Run the focused browser smoke for local destructive-action Undo coverage with:

```sh
npm run test:e2e -- --grep "Duel tab|custom setups|loot actions|Active modifiers loot"
```

Dense/Compare release classification: D-032 accepts the release-path browser
numeric snapshots as sufficient for the current Dense/Compare release slice.
The optional all-fixture browser-display expansion and repository-local visual
suite are now implemented evidence; only pane-level detail beyond the covered
states and promotion to a canonical remote merge gate remain later decisions.

Run the focused browser smoke for Dense Compare mobile/tablet overflow containment with:

```sh
npm run test:e2e -- --grep "Dense Compare mobile"
```

Run the focused browser smoke for the visible Duel workflow with:

```sh
npm run test:e2e -- --grep "Duel"
```

For the bounded setup-diff extension, the minimum focused validation is:

```sh
npm run test -- src/tests/*-view-model.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 --grep "uses the Duel tab"
git diff --check
```

The view-model case verifies user-facing item labels, all exposed impact deltas,
the null live-row diff and exclusion of the shared target, Planner targets and
inactive per-style caches. The browser case verifies the visible DPS delta and
the `aria-expanded`/`aria-controls` review flow. It does not require a snapshot
schema migration or live upstream test.

For Stats source distributions, use:

```sh
npm run test -- src/tests/*-view-model.test.ts
npm run typecheck
npm run test:e2e -- --workers=1 --grep "selects special attacks|enables cannon"
git diff --check
```

The unit cases verify per-special-hit and per-fired-cannonball inputs against the
existing domain results, probability totals close to one, partial dragon-halberd
status and null inactive/idle histograms. The focused browser cases verify scope
copy and accessible bucket lists. No live upstream or visual baseline update is
required; the existing Stats visual fixture has inactive special/cannon sources
and the normal histogram presentation remains shared and unchanged.

For the bounded workbench keyboard pass, run:

```sh
npm run typecheck
npm run test:e2e -- --workers=1 --grep "loads the dense combat spreadsheet root|supports bounded keyboard navigation"
npm run test:e2e -- --workers=1
git diff --check
```

The focused case owns skip-link, tablist/tabpanel, roving focus and computed
focus-outline assertions. Because the semantic role change updates Workbench
locators throughout the browser suite, the complete Playwright run is required
for this goal. No live upstream service is involved.

## Rewrite setup file-transfer controller validation

The current parser truth remains in `src/tests/setup-import.test.ts`, with
persistence and recovery coverage in `ui-adapters.test.ts` and
`local-state-recovery-controller.test.ts`. The implemented
[setup file-transfer controller specification](../setup-file-transfer-controller-spec.md)
adds the DOM-free controller suite plus successful import/export browser
coverage. `App.tsx` now owns only the typed Apply and input-reset bridges.

Run at minimum after changes to this boundary:

```sh
npm run test -- src/tests/setup-file-transfer-controller.test.ts src/tests/setup-import.test.ts src/tests/ui-adapters.test.ts src/tests/local-state-recovery-controller.test.ts
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "setup import|Export setup"
npm run test:e2e -- --workers=1
npm run verify
git diff --check
```

The controller suite passes 12/12, the combined command 78/78, targeted browser
coverage 2/2 and the complete Chromium gate 77/77. The existing failure/retry
case and new successful transfer/export case jointly own the browser regression
boundary.

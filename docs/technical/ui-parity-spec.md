# UI Parity Specification

- Status: living parity specification; the accepted V1 replacement slice is implemented and remaining wider-parity boundaries are explicit
- Date: 2026-07-08
- Owner: technical docs
- Product inventory: [../product/feature-inventory.md](../product/feature-inventory.md)
- Legacy UI source: `views.jsx` and `planner.jsx`
- Rewrite UI source: `src/app`

## Goal

The refactored Vite/React implementation should feel like the same combat workbench as the legacy UI, with cleaner internals. Calculation parity alone is not enough. The default layout, tab order, workflow grouping and feature discoverability must match the old tool closely enough that an existing user can move from legacy to rewrite without hunting for controls.

Current cross-slice bucket ownership: [rewrite-parity-report.md](rewrite-parity-report.md#core-uiworkbench-gap-buckets) summarizes the remaining core UI/workbench parity gaps for the accepted V1 slices. This specification keeps the detailed slice contracts below.

## Non-goals

- Do not reintroduce runtime Babel, CDN React or real `window.*` ownership into the production app path.
- Do not add database, auth or backend behavior beyond accepted decisions. Hiscores and live market sync are accepted product features and are specified in [live-integrations-spec.md](live-integrations-spec.md).
- Do not delete the archived legacy files as part of UI parity work.
- Do not treat the current compact rewrite dashboard as the target layout for full replacement.

## Accepted Direction: Dense Spreadsheet First

Decision [D-014](../project/decisions.md) makes the legacy-style dense combat spreadsheet the next UI parity target.

The rewrite should first replicate the `CombatSpreadsheet` workflow from `views.jsx`, not the current card-like two-column dashboard. The target is a compact, calculation-first screen where the user can adjust the active loadout and immediately compare every monster in one dense table.

The dense spreadsheet is the default `Compare` pane inside the accepted
three-zone workbench. D-075 keeps that desktop workbench viewport-bound like the
legacy console instead of letting the table define the document height, and
D-082 extends the same scroll ownership to compact landscape workspaces.

### Dense Spreadsheet Layout

Desktop layout:

```text
Chrome: workspace / sim / combat.spreadsheet                         TYPE
Compact setup strip: TYPE ATT STR DEF STANCE PRAYER BOOST ACC+ DMG+ SPD F/KL TARGET
Metric strip: DPS MAX HIT HIT % TTK KILLS/HR XP/HR GP/HR NET GP/KILL
Header strip: All monsters - current loadout - row count and sort hint
Scrollable dense table: one row per monster, sortable columns, row click selects target
```

The view must use strips and tables, not dashboard cards. It should fit the first viewport with the current target, active combat type, key metrics and the first rows of the monster table visible.

At desktop widths, normal laptop heights and compact landscape workspaces from
621 px wide, the header and three-zone shell fit one viewport. PlayerSidebar,
the active center pane and MonsterCard have independent, visible scroll
boundaries; the document itself must not become the scroll owner for a long
Compare table. Compact landscape narrows the side tracks and lets the setup
context scroll horizontally instead of stacking the entire workbench. Auto-
sized grid rows align to the start so short Player content cannot stretch
across the table height. Portrait tablet widths through 980 px and mobile widths
through 620 px keep normal document flow, with the existing pane order and
contained horizontal table overflow.

### Compact Setup Strip

Required order and behavior:

| Slot | Melee label | Ranged label | Magic label | Behavior                                                                                                                                                                                                        |
| ---- | ----------- | ------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | TYPE        | TYPE         | TYPE        | Read-only mirror of the PlayerSidebar combat type. PlayerSidebar is the only visible combat-type mutator.                                                                                                       |
| 2    | ATT         | RNG          | MAG         | Primary offensive level.                                                                                                                                                                                        |
| 3    | STR         | reserved     | SPELL       | Melee strength, ranged reserved alignment cell, or magic spell select.                                                                                                                                          |
| 4    | DEF         | DEF          | DEF         | Defence level.                                                                                                                                                                                                  |
| 5    | STANCE      | STANCE       | STANCE      | Weapon/style control using the same stance options as the active combat type.                                                                                                                                   |
| 6    | PRAYER      | PRAYER       | PRAYER      | Compact primary prayer selector. It preserves other active compatible prayer categories, shows a `+N` marker for them and updates rewrite `prayers` state.                                                      |
| 7    | BOOST       | BOOST        | BOOST       | Compact primary combat-boost selector. It preserves other active compatible boost categories, shows a `+N` marker for them and updates rewrite `boosts` state. Potion inventory stays explicitly owned by Trip. |
| 8    | ACC+        | ACC+         | M+%         | Manual accuracy or magic accuracy adjustment. Empty value uses the derived equipment/stance value.                                                                                                              |
| 9    | DMG+        | DMG+         | DMG%        | Manual damage adjustment. Empty value uses the derived equipment/ammo/spell value.                                                                                                                              |
| 10   | SPD         | SPD          | SPD         | Manual attack speed in seconds. Empty value uses the weapon/style-derived speed.                                                                                                                                |
| 11   | F/KL        | F/KL         | F/KL        | Food per kill or current trip food pressure. If the rewrite cannot yet write this directly, show the current model value read-only.                                                                             |
| 12   | TARGET      | TARGET       | TARGET      | Monster select. Changing target updates the metric strip and highlights the table row.                                                                                                                          |

The legacy source renders these controls into a 13-column grid even though the named control set is effectively 12 slots. The rewrite can keep 12 named slots plus a reserved rhythm column, or preserve 13 physical grid columns, but labels and visual rhythm should match the old spreadsheet.

D-077 keeps this strip dense without treating every slot as equally wide.
Numeric cells may stay narrow, while target, spell, stance, prayer and boost
receive semantic minimum widths and retain contained horizontal overflow.
Selected values in native selects expose their complete label as a title, and
text summaries that can grow vertically wrap instead of using a hard ellipsis.
The 1280x720 Water Elemental browser contract measures enough rendered select
space for the complete label, including reserved room for the native arrow.

D-079 supersedes D-078's interim filter-plus-native-select presentation. Every
`SearchableSelectField` is now a select-style ARIA combobox: its closed trigger
shows the selected value, and opening it reveals the search field, match count
and listbox in one popup. The contract applies to the setup-context and
MonsterCard targets, weapons, ammo, spells, gear slots, Trip food, Risk target
drop and Economy snapshot/trend item. Arrow keys, Home/End, Enter and Escape
work from the popup search, selection returns focus to the trigger and clicking
outside closes the popup. Short categorical fields remain native selects. The
compact `TARGET` and `SPELL` strip controls remain native quick duplicates so a
popup is not clipped by the strip's horizontal overflow owner; their primary
owning fields are searchable. The same audit keeps the compact setup action row
on one readable line, allows Risk actions to wrap inside their grid cell and
wraps Duel loadout summaries instead of clipping them.

### Setup Ownership And Quick Navigation

D-076 added setup-ownership summaries above the workbench. D-080 removes the
redundant `Where to edit` heading and explanatory sentence while retaining the
three current-value buttons for active-style setup, Trip and Loot. The compact
setup labels use `PRAYER` and `BOOST`; `POT` is not used because it conflates a
combat boost with Trip-owned potion inventory.

When net GP is negative because supply GP/kill exceeds loot GP/kill, Stats and
Compare show the exact per-kill gap plus `Edit prayers & boosts` and `Review
potion carry` actions. This is navigation and explanation only: it does not
change the form, simulation request, prices, persistence or supply formulas.

### Metric Strip

The selected-monster context bar is the only always-visible owner of the compact
DPS, effective XP/hr and net GP/hr summary. PlayerSidebar remains input-focused
and does not duplicate those target-, Trip-, loot- and price-dependent results.
Stats owns the detailed player and cannon XP routing. The fuller Stats/Compare
metric strip may repeat the current values inside its analysis context.

Required cells, in order:

1. DPS
2. MAX HIT
3. HIT %
4. TTK
5. KILLS/HR
6. XP/HR
7. GP/HR NET
8. GP/KILL

Formatting requirements:

- Labels are uppercase and compact.
- Numeric values are monospace or tabular figures.
- DPS uses 2 decimals.
- Hit chance uses percent formatting.
- TTK uses seconds or minute/second formatting matching legacy `fmtTime`.
- XP/hr and GP/hr use compact thousands formatting when large.
- The mapping between legacy `result.dps` and rewrite `combat.effectiveDps` must be verified before full replacement, especially once special attacks and cannon controls are exposed.

### Active Assumptions / Modifiers Summary

The shared Stats/Compare result area must include a summary of active
assumptions and modifiers that affect the current result. It is view-model data,
not DOM-derived state.

Required behavior:

- Show a subdued `Default assumptions active` state when no summary rows are active.
- Show at most five priority rows by default, with a `+N more` expandable list for overflow.
- Prioritize calculation confidence warnings, then custom setup/cannon/manual combat overrides, loot/economy modifiers, trip-rate modifiers and settings modifiers.
- Include a `Review` action per row that switches to the owning workbench tab without resetting or mutating the underlying setting.
- Include a `Reset` action only for active rows with a narrow, already-owned reset path: manual combat overrides, current-monster cannon settings, current-monster loot settings, current-monster loot action overrides, explicit safespot override, Trip scarce spot enablement and hidden gear tiers.
- Reset actions must affect only the row's modifier family, keep `Review` available, announce a short status message and stay keyboard/screen-reader accessible.
- Keep calculation confidence warnings, special fallback warnings, active PriceSet/source rows, custom setup rows, protection prayer, inherited Trip high-alch rows, manual Trip controls and supply settings review-only until a separate unambiguous reset policy exists.
- Do not add fields to `SimulationRequest`, persisted setup schema versions, live provider paths or legacy migration policy.

Current implementation note: `createSimulationViewModel()` returns
`activeAssumptions`, built from the validated current form/context and existing
view-model warning data. It covers price and special-attack confidence warnings,
active custom setup, manual combat overrides, enabled per-monster cannon settings,
per-monster loot settings, loot action overrides, active non-bundled PriceSet,
scarce spot, explicit safespot override, protection prayer, manual food/bank/prayer controls,
changed supply settings and hidden gear tiers. Stats and Compare render the same
summary below the metric strip. `Review` only changes the active tab. `Reset` is shown only on the scoped resettable rows above; for example, resetting current-monster loot settings does not remove loot action overrides, resetting loot action overrides does not remove per-monster loot settings, resetting current-monster cannon does not change Trip scarce state, resetting explicit safespot returns to Auto and resetting Trip scarce spot leaves the target-count and respawn values in place.

### Keyboard Interaction

The Workbench navigation uses a roving ARIA tablist with one active Tab stop,
Left/Right wraparound and Home/End activation. It controls one dynamic active
tabpanel labelled by the selected tab. A first-focus skip link targets that
panel, and common controls use a high-contrast focus-visible outline. Dense
monster rows use one selected-row Tab stop; Up/Down wrap focus across visible
rows, Home/End jump to the ends and Enter/Space retain target selection. Mouse
and touch behavior remain unchanged. D-070 treats this as a bounded keyboard
contract rather than a WCAG conformance claim. The owning details are in the
[accessibility and keyboard specification](accessibility-keyboard-spec.md).

### Combat, Stats, Special And Result V1 Slice

Status date: 2026-07-08. The accepted V1 replacement line for this slice is
visible workflow parity in the root Vite rewrite, not a clone of legacy
script-order internals.

| Classification         | Items                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Release impact                                                                                                                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `release-required`     | PlayerSidebar owns combat-type mutation and routes to one dynamically labelled active setup tab; compact `TYPE` mirrors state read-only. Melee/ranged/magic loadouts stash and restore style-owned weapon, ammo, spell, gear, prayers, boosts, manual overrides and special-attack state, then end with the active setup's normal-versus-selected-special `Damage distribution`; `SimulationRequest` receives normalized combat request data without UI-only or saved-setup state; Result summary keeps the existing metric strip and Active assumptions review/reset boundaries; Stats shows combat roll detail, XP routing, source breakdown/detail for normal attack, special attack and cannon, Trip/banking summary and event-scoped special/cannon distributions; supported melee/ranged special attack controls show current domain metrics; magic unsupported and DBA boost states suppress `specialAttack` request data. | Complete for this slice.                                                                                                                                                                                                                                       |
| `later`                | Full price-aware, quest-aware or ownership-aware loadout optimization; browser detail coverage beyond the completed all-fixture metric strip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Not required unless a later release makes one of these evidence areas a blocker. D-073/D-088 complete bounded visible whole-loadout optimization for current-target normal DPS with generated numeric current-level eligibility.                               |
| `implemented evidence` | Repository-local visual regression suite from [visual-regression-spec.md](visual-regression-spec.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Implemented with isolated Chromium config and reviewed Darwin baselines; remote merge-blocking status still needs a CI decision.                                                                                                                               |
| `legacy-only`          | Runtime Babel, CDN React, production `window.*` ownership, archived legacy layout internals and script-order coupling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Not ported by design.                                                                                                                                                                                                                                          |
| `decision-needed`      | New special attack formulas and magic DPS specials.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Keep as explicit future decisions, not blockers for the accepted V1 slice. D-046 accepts the current ranged/magic/halberd auto-safespot behavior as the V1 default UX with user override, and D-050 keeps the dragon halberd NPC-size fallback warning for V1. |

### Dense Monster Table

The table must show all monsters in `GameDataSnapshot`, not just the top N rows.

Required column order:

1. Monster
2. HIT %
3. MAX
4. DPS
5. TTK
6. K/HR
7. XP/HR
8. GP/KL
9. GP/HR
10. NET GP/HR

Required behavior:

- Default sort is XP/HR descending, matching legacy `CombatSpreadsheet`.
- Header clicks sort by that column and toggle direction.
- Sort direction is visible in the header.
- Name sorting is alphabetical.
- Numeric columns are right-aligned.
- The active target row is highlighted and has a leading marker.
- Row click selects the target monster and updates the setup strip, metric strip and current simulation.
- The header/status strip shows whether dense rows are current for the live setup or still updating from the previous debounced calculation.
- The table header stays visible while the table body scrolls.
- Horizontal overflow stays inside the table container on small screens.
- Existing custom setup, per-monster alch and per-monster overhead behavior must be represented once those state maps are ported. The current rewrite represents rewrite-owned custom setup rows and shows stable dense-row state markers for custom setup, high-alch override and kill-overhead override state.

### Table State

Dense spreadsheet state belongs in versioned rewrite UI state, not in `SimulationRequest`.

Minimum state:

- active dense-table sort key
- active dense-table sort direction
- selected target monster

Implemented parity state:

- monster text filter
- drop-name filter
- relevant/irrelevant toggle and persisted relevance
- custom setup marker
- per-monster alch marker
- per-monster overhead marker
- hidden/irrelevant marker
- forced-current-target marker

Later parity state:

- additional legacy compare maps only after their migration/reset policy is accepted

The legacy `sim_compare_sort_v1` key should not be read implicitly until migration, import/reset or no-migration behavior is accepted.

### Responsiveness

Desktop target:

- The compact setup strip fits on one row at typical desktop widths.
- The metric strip has 8 equal cells.
- The monster table fills the remaining vertical space.
- Row height should stay dense, roughly 24-32 px.

Tablet and mobile target:

- The setup strip may horizontally scroll or wrap into compact rows, but it must preserve the legacy order.
- The metric strip may become 2 or 4 columns.
- The table must horizontally scroll instead of dropping columns.
- The current target, combat type and DPS/XP/hr/GP/hr metrics must remain visible before the table.

### Visual Contract

- Use a quiet utilitarian dark tool surface.
- Avoid cards inside cards and marketing-style blocks.
- Prefer strip headers, compact fields, sticky table headers and tabular numbers.
- Keep labels short and uppercase.
- Use stable control heights so changing options does not resize rows.
- Do not hide missing legacy controls by changing the layout shape; disabled/read-only controls are acceptable during staged implementation.

### Dense Spreadsheet Implementation Phases

#### Phase A0: specification and state shape

- Record the dense spreadsheet as the accepted next target.
- Define view-model fields for all required table columns.
- Decide which fields are read-only in the first slice because the rewrite state does not yet own manual overrides.

Current implementation note: the rewrite now has the Phase A dense spreadsheet
shell in the root UI. It uses the dense compare view-model for all monsters,
explicit dense table sort keys/directions, XP/hr-desc default sorting,
versioned rewrite setup state for the dense sort setting, row-click target
selection, an active-row marker, sticky table headers and contained horizontal
overflow. Legacy `sim_compare_sort_v1` is still intentionally not read.

#### Phase A1: root dense view

- Replace the current card-like root dashboard with the dense spreadsheet shell.
- Render compact setup strip, metric strip and full all-monster table.
- Keep existing domain-backed calculations and adapters.

Current implementation note: complete for the initial root slice. The compact
strip exposes primary setup controls, manual accuracy/damage/speed override
controls and derived food pressure; full gear/trip and multi-select detail still
belong to later workbench/parity fill.

#### Phase A2: table interaction parity

- Add sortable headers, row-click target selection, active-row marker and persisted sort.
- Add Playwright smoke coverage for row count, sorting and target selection.

Current implementation note: complete for the initial root slice. Playwright
smoke coverage checks full-table row count, Monster sorting and target
selection through the dense table. The Compare toolbar also exposes a
screen-reader-announced `Current`/`Updating` freshness status while the
debounced dense calculation catches up; the table remains interactive during
the pending state.

#### Phase A3: legacy compare parity fill

- Add name/drop filters, relevant toggle, custom setup marker and per-monster state markers.
- Add browser-rendered numeric snapshots for representative dense table rows.

Current implementation note: the rewrite now includes monster-name filter,
drop-name filter, show hidden/irrelevant toggle, reset filters and
rewrite-owned persisted irrelevant monster state in the versioned dense compare
UI state. Drop filtering matches monster drop names, item keys and nested
expanded drop-row names available in `GameDataSnapshot`. The active current
target remains visible even when filters or irrelevant state would otherwise
hide it. Stable row state markers are present for custom setup, high-alch
override, kill-overhead override, hidden/irrelevant and forced-current-target
rows. Playwright coverage now snapshots browser-rendered dense numeric cells for
release-path rows covering default melee Hill Giant, melee alch-relevant Chaos
Dwarf, ranged safespot Greater Demon, cannon-enabled ranged Dagannoth with
negative net GP/hr, magic safespot Blue Dragon and a custom Green Dragon setup
with high-alch plus kill-overhead markers. It also locks the related
metric-strip numbers for default melee, alch-relevant melee, ranged safespot,
cannon, magic safespot, custom loot settings, loot action override, manual
food/prayer trip, imported PriceSet, mocked market sync and compatible legacy
import paths. Dense XP/HR and NET GP/HR cells now include compact
row-scale indicators derived from the currently visible rows after sort/filter;
net GP/hr uses separate positive and negative relative scales so profitable and
loss-making rows remain visually distinct while the numeric value remains the
primary content.

Mobile/tablet implementation note: Playwright now smokes Dense Compare at
390px mobile and 768px tablet widths. The smoke verifies that the page itself
does not gain horizontal overflow, the wide monster table scrolls inside
`.dense-table-wrap`, sticky headers do not overlap the first visible body row,
compact setup controls, metric strip and initial rows remain visible, and the
current target remains forced-visible after irrelevant-state plus long
monster/drop filter paths.

### Dense/Compare Release Classification

Status date: 2026-07-08. This classification applies to the current Vite
rewrite Dense/Compare V1 replacement slice, not to deleting archived legacy
files or claiming full visual parity.

Current Dense/Compare release blocker list: none. The release-required items
below are implemented and have unit/view-model or Playwright evidence. The
feature inventory rows are `Valmis` for the visible V1 replacement workflow
because later and decision-needed items below are not blockers for this slice.

Decision: D-032 accepts the current release-path browser numeric coverage for
this slice. The existing browser evidence covers representative default melee,
melee alch-relevant, ranged safespot, ranged cannon, magic safespot and custom
loot-settings marker rows plus related metric-strip workflows. The user has now
authorized the optional all-fixture browser-display expansion as later work; it
is now completed non-blocking evidence. The repository-local visual matrix is
also implemented; only remote merge-blocking promotion and broader future
scenario/platform expansion remain outside the accepted release gate.

| Item                                                                                                                                                        | Classification         | Release note                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dense shell, compact setup strip, metric strip, full all-monster table, default XP/hr sort, sortable headers, row target selection and active target marker | `release-required`     | Implemented in the root workbench and smoke-covered.                                                                                                                                                                                                                                                               |
| Monster/drop filters, show hidden/irrelevant toggle, reset filters, persisted irrelevant monster state and forced-current-target visibility                 | `release-required`     | Implemented through rewrite-owned dense compare state and covered by view-model/browser tests.                                                                                                                                                                                                                     |
| Row markers for custom setup, high-alch override, kill-overhead override, hidden/irrelevant and forced-current-target rows                                  | `release-required`     | Implemented and covered as release usability evidence.                                                                                                                                                                                                                                                             |
| Custom setup dense row calculations and per-monster loot-setting markers                                                                                    | `release-required`     | Implemented for rewrite-owned custom setups and current per-monster loot settings.                                                                                                                                                                                                                                 |
| Visible-row XP/hr and net GP/hr scale indicators                                                                                                            | `release-required`     | Implemented and browser-smoked through filtered visible-row paths.                                                                                                                                                                                                                                                 |
| Mobile/tablet containment for the dense table                                                                                                               | `release-required`     | Implemented with contained horizontal table scroll and browser-smoked at mobile and tablet widths.                                                                                                                                                                                                                 |
| Browser-rendered numeric snapshots for representative release paths                                                                                         | `release-required`     | Accepted by D-032 as sufficient for this release slice.                                                                                                                                                                                                                                                            |
| All-fixture browser-display expansion                                                                                                                       | `completed optional`   | The 18-case rewrite fixture adapter is unit-covered; its focused metric-strip Playwright case passes 1/1 and the expanded default gate passes 56/56.                                                                                                                                                               |
| Repository-local visual regression suite                                                                                                                    | `implemented evidence` | Implemented in [visual-regression-spec.md](visual-regression-spec.md); it is not a remote merge gate without a separate CI runner decision.                                                                                                                                                                        |
| Exact legacy CSS/layout pixel matching and script-order `window.*` internals                                                                                | `legacy-only`          | The rewrite preserves user workflow shape, not archived implementation internals.                                                                                                                                                                                                                                  |
| Deeper legacy compare-state migration beyond compatible `sim_compare_sort_v1` and `sim_irrelevant_v1` import                                                | `decision-needed`      | Do not implicitly read or migrate additional legacy compare maps without a separate migration/no-migration decision.                                                                                                                                                                                               |
| Final default relationship between Dense Compare and the broader tabbed workbench                                                                           | `decision-needed`      | Current release can ship with Compare as the active dense pane; final product default remains a UX decision.                                                                                                                                                                                                       |
| Worker-backed heavy calculation runner                                                                                                                      | `implemented evidence` | Representative Compare/Planner and max Duel matrix runs missed the accepted 200 ms main-thread budget, so Dense Compare, Planner and on-demand Duel matrix now use a typed cancellable Web Worker. A Chromium Long Task smoke covers all three paths; formulas, persistence and `SimulationRequest` are unchanged. |

## Layout Contract

### Desktop shell

The default desktop workbench must use the legacy three-zone shell:

```text
Chrome
+---------------+------------------------------------+------------------+
| PlayerSidebar | SetupBar + TabBar + active pane    | MonsterCard      |
| 280px         | minmax(0, 1fr)                     | 320px            |
+---------------+------------------------------------+------------------+
```

Required behavior:

- The first viewport shows the chrome, combat setup context, tab bar and current target context.
- Left and right rails scroll independently from the active center pane.
- The center pane owns tab content and keeps horizontal overflow contained inside tables when needed.
- The tab bar is horizontally scrollable instead of wrapping into unrelated rows.
- UI density should stay close to legacy: compact metrics, tables, h-strip section headers and searchable selects.

Current implementation note: the rewrite now has the three-zone workbench shell:
left PlayerSidebar, center setup context bar plus horizontally scrollable
legacy-order TabBar and active pane routing, and a right-side MonsterCard rail.
The left rail, center pane and MonsterCard rail have independent scroll
containers on desktop. On mobile the zones stack in workflow order, with
MonsterCard after the active pane. The final default-pane decision remains open.

The global Player lookup belongs to the header rather than the PlayerSidebar.
Its player-name field and Lookup action stay directly available in the chrome;
service feedback stays compact and a successful seven-skill preview opens in a
bounded overlay with the existing Apply action. The header utility must not
increase the desktop chrome beyond the compact console rhythm or collapse the
active pane at the 640x360 landscape contract. Persistent runtime and price
fallback labels do not belong in the header; Economy and Settings own that
detail, while transient action feedback remains available through scoped
notices and the global polite status announcer.

### Mobile shell

Mobile can stack the zones, but must preserve workflow order:

1. Chrome
2. Player setup/sidebar controls
3. SetupBar
4. TabBar
5. Active pane
6. Target/monster context

The mobile version may collapse rails into accordions only when the current combat type, effective XP/hr, net GP/hr and target name remain visible or one tap away.

## Navigation Contract

The current tab order keeps one navigation owner per concept:

1. Stats
2. Current combat-style setup
3. Monsters
4. Setups
5. Loot
6. Trip
7. Risk
8. Cannon
9. Planner
10. Economy
11. Settings

Additional requirements:

- Monsters is the default tab.
- The setup tab is labelled `Melee setup`, `Ranged setup` or `Magic setup` from PlayerSidebar state and never changes combat type itself.
- PlayerSidebar is the only visible combat-type switch; compact `TYPE` is read-only.
- A combat-type change must preserve per-style loadouts in the same way the legacy reducer stashes and restores loadouts.
- Tab labels should remain short and familiar. Secondary status text can be visually suppressed, but tab placement must stay stable.
- Deep linking to tabs is optional, but Playwright tests should be able to select each tab deterministically.

## State Contract

Keep the rewrite's domain boundaries, but model the legacy UI state explicitly:

- `SimulationRequest` remains clean and domain-facing.
- UI form state must include per-combat-type loadouts.
- Versioned persisted state must account for per-monster custom setups, default setup, current target, loot prefs, hidden gear tiers, compare relevance, compare sort, planner UI config, duel snapshots, cannon settings, per-monster alch, overhead and jewel-spot maps.
- Legacy keys now have an import/keep/clear UX for known keys, compatible `sim_input_v3` setup fields, compatible hidden tiers, dense compare state and unambiguous loot preferences. Legacy custom setup snapshots (`monsterSetups`) and cannon maps (`cannonByMonster`) live inside `sim_input_v3`, not under separate keys, and have compatible nested import paths. D-048 keeps `sim_planner_v1` review-only/not migrated for V1, and D-049 keeps legacy price-history keys review-only/not migrated for V1.
- Per-monster settings must not be hidden inside generic trip state. They must appear where users expect them: setup scope in SetupBar, alch/overhead in Loot, cannon in Cannon/Trip, target selection in MonsterCard.

Current implementation note: rewrite setup persistence is version 3. The active
form state stores `perStyleLoadouts` for melee, ranged and magic with weapon,
ammo, spell, style, gear, prayers, boosts, sustained state, repot threshold,
special attack and manual accuracy/damage/speed overrides where `null` means
derived/default. Combat-type changes from the PlayerSidebar, TabBar or compact
strip stash the current active loadout and restore the target style loadout.
The same rewrite setup envelope now also stores `defaultForm`, `setupMode` and
`customSetupsByMonster` for rewrite-owned monster-specific custom setup
snapshots. Target changes load the monster custom setup when one exists, or the
default setup with the selected monster otherwise. Loot prefs, dense sort and
cannon maps remain separate shared state outside per-style loadouts and custom
setup snapshots. Older rewrite setup versions still follow the existing
version-mismatch rejection path; no implicit v1/v2 rewrite setup migration is
implemented in this slice. Legacy migration implementation note: archived runtime
`sim_input_v3` persisted custom setups as `monsterSetups` snapshots and per-spot
cannon settings as `cannonByMonster`. The current migration flow parses
`sim_input_v3` only for compatible active setup fields, detects those nested
maps with bounded metadata for the review/reset plan, leaves them out of
rewrite-owned custom setup/cannon state on Import and removes them only through
confirmed Clear of the known `sim_input_v3` key. A future deep parser or
different intentional-reset UI needs a separate product decision.

## Required Panes

### PlayerSidebar

Required placement: left rail.

Required controls and displays:

- Combat type segmented control.
- Levels, with fields filtered by combat type plus Defence, HP and Prayer.
- Stance/style control, including weapon-specific melee stance names and attack type.
- No persistent target- or Trip-derived result metrics; the selected-monster
  context bar owns the compact DPS, effective XP/hr and net GP/hr summary, and
  Stats owns detailed XP routing.

Current implementation note: the PlayerSidebar is present in the root rewrite.
It exposes combat-type switching, combat-style-filtered level fields plus
Defence/HP/Prayer and stance/style selection. The
service-aware Hiscores lookup and bounded preview/apply popover are owned by the
global header utility. The header keeps Player lookup directly after the
non-growing product brand instead of centering it in leftover space. A
successful preview opens automatically and dismisses on `Escape`, an outside
pointer action or its own summary control; `Escape` returns focus to that
control.

### SetupBar

Required placement: directly above the tab bar.

Required controls and displays:

- Current monster name.
- Default loadout vs custom loadout state.
- Toggle between editing custom setup and default setup when a custom setup exists.
- Create custom setup for this monster.
- Remove custom setup and fall back to default.

Current implementation note: the current slice has a SetupBar above the TabBar
with current monster, default/custom setup status, target selection, create
custom setup, edit default/custom toggle, remove custom setup and key metrics.
The flow persists rewrite-owned monster-specific custom setup snapshots and
falls back to the default setup when a custom setup is removed. Legacy custom
setup key migration remains outside this slice.

### MonsterCard

Required placement: right rail.

Required controls and displays:

- Target monster search select.
- Drop-name filter for target search.
- Current setup state badge.
- Monster stats: combat, HP, defence/attack values and active defence highlight.
- Equipment overview: weapon/ammo/spell, active attack/damage bonus, speed, prayers, potions, sustained mode and ring effects.

Current implementation note: the root rewrite now renders MonsterCard in the
right desktop rail and after the active pane on mobile. It uses the app-level
MonsterCard view-model for current target stats, active defence row from
`SimulationResult.debug.defenceField`, default/custom setup badge and compact
weapon/ammo/spell setup overview. Target search/select uses the same target
switch path as SetupBar so custom setups restore consistently. Drop filtering
shares the dense compare `dropFilter` state instead of creating a second filter
truth. Full visual regression coverage remains outside this slice.

### Stats

Required content:

- Large metrics for DPS, effective XP/hr, effective net GP/hr and hit chance.
- Combat roll metrics: max hit, effective accuracy, effective damage, tick/speed, TTK, cycle, kills/hr and GP/kill.
- Banking trip metrics when trip modeling applies.
- A normal-versus-selected-special main hit-distribution comparison plus separately scoped special-hit and cannonball detail histograms.
- XP routing chips.

Current implementation note: the rewrite Stats pane now includes the shared
metric strip, active assumptions/modifiers summary, a compact source breakdown,
combat roll detail metrics, XP routing chips, a Trip & banking summary and an
exact discrete normal-versus-special hit-distribution comparison. The source breakdown and combat
roll detail are derived in the view-model from existing combat, special attack,
trip and cannon outputs. The source breakdown lists normal attack, special
attack and cannon with modeled, partial, not modeled or inactive status and shows
available DPS, DPS gain context, XP/hr, hit chance, max hit, supply-cost and note
fields without changing formulas or adding new provider dependencies. Combat
roll detail shows normal-attack effective accuracy, effective damage, attack
roll, active monster defence roll, hit chance, max hit, average hit, attack
speed seconds, attack cycle ticks and the current result TTK, kills/hr and
GP/kill. Missing, non-finite or unsupported values stay `null`/`-` instead of
being displayed as zero. The same view-model now also exposes per-source detail records for
UI expansion: each detail carries status, status label, metrics, notes, warnings
and an optional histogram. The Stats UI renders source-detail cards for special
attack and cannon from that contract. Special detail shows the spec weapon, hit
count, max hit, hit chance, specs/hr, DPS with spec, DPS gain, warning notes and
the current XP limitation note. Cannon detail shows effective targets, cannon
DPS, balls/hr, balls/kill, cannon ranged XP/hr, ball cost/hr, ball cost/kill,
cannonballs/trip and sparse/idle/respawn-bound state. Normal attack, a selected
supported DPS special and an actively firing cannon now reuse the same domain
single-event distribution model. Special scope is one modeled special hit and
cannon scope is one fired cannonball under D-069; the UI names that scope and
does not claim kill, trip or hourly variance. Separately, D-083's main comparison
uses the verified independent component-roll contract to show one complete
selected special activation against one normal attack. Inactive,
idle, invalid or unsupported source histograms remain `null`. Missing or
unsupported metrics stay `null`/`-` instead of being displayed as zero. Magic DPS
specials are `not modeled`, the DBA special boost path is `inactive` because it
is modeled as a boost rather than a DPS special, and cannon idle/respawn-bound
state is copied from the current Trip cannon output. XP routing is derived in the
view-model from the current combat XP breakdown and trip output: player combat
XP/hr is always shown, cannon ranged XP/hr appears only when cannon contributes,
skill-specific combat XP rows are listed, Prayer XP is modeled from current bury
loot rows and Magic alch XP is modeled from tracked in-trip alch casts. The
`totalXpPerHour` value is composed
from those modeled XP source rows. The Trip & banking summary mirrors the
current trip result for kills/trip, trip length, bank time, effective kills/hr,
supply/kill, net GP/hr, current bound, safespot and protection state. Hit
distribution bucket data is derived from the current combat result through the
domain/view-model boundary. It separates miss from an accurate zero, mixes the
normal sustained-roll samples, aligns normal and whole-special integer outcomes
on one probability scale, exposes exact/cumulative values on focus or hover and
in an accessible table, and shows expected-damage plus full-target-HP/KO context.
Long exact domains scroll only inside the chart rather than widening the page.
This does not change the `SimulationResult` contract or combat golden baselines.
Further combat roll edge-case parity, full browser-display expansion and visual
regression remain open parity work.

### Active combat-style loadout

Required shared content:

- One dynamically labelled setup tab for the PlayerSidebar-selected combat style.
- Searchable weapon/gear selectors.
- Best-in-slot action for worn gear.
- Worn equipment slot list with two-handed off-hand lock.
- Offensive and defensive bonus summaries.
- Manual bonus and attack-speed overrides.
- Prayer selector, boost selector, sustained mode and repot threshold.
- Ring of Wealth, Legends Quest and recoil controls where applicable.

Required style-specific content:

- Melee: special attack weapon, DBA special boost and restore handling.
- Ranged: bow vs thrown mode, arrows, ranged special weapon and spec-arrow selection.
- Magic: staff, spell, rune cost, god spell staff/charge handling and magic-specific boosts.

Current implementation note: the rewrite workbench exposes one active equipment pane backed by the PlayerSidebar-selected combat style and `GameDataSnapshot` option data. Its dynamic tab label identifies Melee, Ranged or Magic without acting as another style switch. The pane provides searchable weapon selectors, style selectors, per-slot gear quick action buttons, primary prayer/boost selectors, multi-prayer and multi-boost checkbox controls with same-category replacement and canonical `None` handling, sustained/repot controls, manual accuracy/damage/speed override controls, equipment slot selectors, an equipment bonus summary, Ranged ammo selection and Magic spell selection. The setup view model checks the selected weapon and equipped gear slots against generated Attack, Strength, Defence, Ranged and Magic requirements from `GameDataSnapshot.requirements`, falls back to D-051 only for legacy or missing rows and surfaces unmet item/skill/current-level/required-level warnings in the loadout pane and Active assumptions. This warning is read-only and non-blocking: manual gear selection remains allowed, Review routes to the active combat-style loadout tab and no reset action is added. The gear quick action MVP scores only currently visible slot candidates for the active combat style: melee uses active attack-type bonus plus weighted strength, ranged uses ranged attack plus weighted ranged strength, and magic uses magic attack plus magic damage when present. Its reason text uses the same generated-or-fallback requirement lookup to disclose when the recommended or current-best visible item is above the current player levels, but it does not filter candidates or block selection. D-073/D-088 provide one bounded `Optimize loadout` action across the visible current-revision weapon and worn-equipment choices. Its checked-by-default session-local `Respect current levels` policy filters only new candidates through the same numeric requirement lookup; the unchanged setup remains the no-regression baseline and an explicit unchecked state restores D-073's warning-only candidate behavior. The optimizer builds a capped deterministic frontier, evaluates survivors with the accepted simulator for current-target normal DPS, reports skipped ineligible choices and a bounded result when capped, and supports one complete Undo. Ammo and spell are not independently searched, while prices, quests, ownership, future gear and hidden non-current candidates are excluded. Selecting a two-handed weapon clears and locks the shield slot while the weapon remains active. These controls write the versioned per-combat-type loadout state and flow through `formToSimulationRequest()` as multi-value prayer/boost arrays; the optimizer eligibility policy itself is not persisted and does not enter the request. Manual overrides map to `SimulationRequest.manualOverrides`; invalid or out-of-range values are rejected by persisted-state validation and defensively ignored by the combat domain.

Current special-attack implementation note: the dense rewrite UI has an interim Special attack section that exposes the existing domain-supported melee and ranged DPS special weapons, ranged spec-arrow selection for bow specials and result metrics for spec max hit, hit chance, specs/hr, DPS with spec and DPS gain. The control writes versioned rewrite setup state and `formToSimulationRequest()` only emits `specialAttack` for valid supported selections. Magic special attack UI shows a compact unsupported state because no magic DPS special path is currently modeled, and it emits no `specialAttack` request. DBA special boost is modeled as a boost/spec-energy state instead of a DPS-special weapon: when the DBA boost is active the DPS-special selector is paused, no conflicting `specialAttack` request is emitted, and the Trip pane is the visible owner of the DBA restore carry toggle and summary row. Persisted setup normalization drops unknown, combat-style-incompatible and DBA-conflicting special state from active, per-style and custom setup state. Under D-071, dragon halberd uses one selected-target hit for source-backed size 1 and two for size greater than 1. Missing-size legacy contexts preserve the D-050 double-hit fallback and structured warning. Adjacent-target simulation and new special formulas remain outside this slice.

### Monsters

Required content:

- Full monster table, not only top-N summaries.
- Sortable columns for name, hit chance, max hit, DPS, TTK, kills/hr, effective XP/hr and effective net GP/hr.
- Monster name filter.
- Drop filter.
- Row click selects target.
- Current target marker.
- Custom setup marker.
- Relevant/irrelevant toggle and persisted relevance.
- Bar visualization for XP/hr and GP/hr.

Current implementation note: Monsters shares the metric strip and active
assumptions/modifiers summary with Stats above the dense monster table.

### Loot

Required content:

- Full drop table for current target.
- Reset drop overrides.
- Optimize for gp/hr.
- High-alch loot toggle stored per monster.
- Kill overhead control stored per monster.
- Expandable sub-table rows.
- Herb `unid`, gem/herb high-value and regular loot/alch/bury/skip actions.
- Talisman spot control for random-jewel sub-table.
- Hover or detail affordance showing net GP/hr impact by action.
- Prayer XP from burying.
- Loot value composition section.

Current implementation note: the root rewrite UI exposes the full current-target loot workflow, meaningful action controls, per-monster settings, composition/nested/action-impact detail and price-history context from the same merged shared/local analysis used by Economy. Generated high alch controls alch profitability. D-089 moves the D-072 conditional quest/clue rows out of the ordinary action table into one collapsed native disclosure; their source chance, sanitized eligibility and locked Skip remain visible on demand, and they still contribute no value or trip effect while exact player state is unavailable. D-090 lets Economy overlay and reset one validated browser-local item price while preserving the selected/scheduled/bundled base and generated high alch. Economy owns the read-only shared plus local comparison workflow; D-049 still keeps full legacy history migration out of V1, while root-variable and scheduled-run evidence remain operations work after the successful live dry-run.

#### Loot/Economy nested workflow parity slice

This slice finishes the visible nested loot/economy workflow that remains open
after the current drop action table, per-monster loot settings and browser-local
Economy tab. It must make loot value composition inspectable without requiring
users to infer how GP/kill, effective net GP/hr or action choices were produced.

Source and status:

- Source: backlog item for remaining Loot/economy parity plus this UI parity
  spec's Loot and Economy requirements.
- Feature inventory status: `Loot/economy summary` is `Valmis` for the accepted
  visible V1 replacement workflow.
- Current state: the drop table, action selection, per-action net GP/hr impact,
  full nested drop detail, loot value composition, trip-state row labels,
  conditional eligibility labels, merged shared/local history context in Loot
  row detail and Economy exist. This visible slice is closed; exact player-state
  activation, configured scheduled-run evidence, backend/account history and
  full legacy history migration remain outside the slice.

In scope:

- Expand nested drop rows into full detail tables for tagged rows such as random
  jewels, herbs, caskets and ultra-rare tables.
- Add a loot value composition section that shows the top contributors to the
  current target's loot value and the remaining tail.
- Make action impact per drop readable as a small comparison table or detail
  panel instead of only compact inline chips.
- Reuse the active `PriceSet`, current `lootBreakdown`, `actionImpacts`,
  rewrite-owned loot prefs and browser-local Economy history state.

Out of scope:

- Live market provider work, upstream selection or production hosting.
- Server-side or shared price history.
- Full legacy price-history migration.
- Per-child action overrides inside nested tables unless the domain later creates
  stable child row ids and an accepted preference schema.

User experience requirements:

- The Loot tab must keep the current toolbar for high-alch, overhead, talisman
  spot, reset and optimize controls.
- A `Loot value composition` section must be visible near the drop table. It
  should show at least the top 8 positive contributors by GP/kill, each row's
  selected action, GP/kill contribution, share of positive loot value and a final
  `Other drops` row when remaining contributors exist.
- The composition section must use the same post-action `evGp` values that feed
  `TripLootSupplyResult.gpPerKill`. If the trip layer has marked a row as eaten
  food or displaced by inventory pressure, the section must label that row rather
  than silently showing the pre-trip value.
- Composition totals should match displayed `Loot GP/kill` within rounding. If
  rounding or negative/zero-value rows prevent an exact match, show the residual
  only as a small display note, not as a separate calculation source.
- Parent drop rows with `_expand` data must open a full nested detail table, not
  a capped preview. The detail table should show child name, weight or chance
  when available, item key/tag when available, unit or row price when available,
  and the child share of the parent EV when it can be derived from numeric
  weights.
- Nested detail rows are explanatory in this slice. The parent row remains the
  action and persistence owner.
- Action impact details must show every available action for the parent row with
  action label, resulting effective net GP/hr, delta versus default, selected
  marker and default marker.
- Action-specific detail should be shown where applicable: bury prayer XP, alch
  value minus nature rune cost, alch casts per kill, `unid` herb valuation,
  `value` high-value table valuation and skip/loot inventory effect notes.
- If an action is not available, it should be omitted from the action selector.
  A disabled explanatory row is acceptable only when it gives a concrete reason
  such as high-alch being off or alch profit being non-positive.
- Missing price or approximate-data warnings from the domain should remain
  visible near the affected row or in the row details.
- Economy history context may be shown only from browser-local accepted history:
  latest price, baseline price and local delta for the row item when the item is
  tracked. Do not call a live service from this workflow.

View-model requirements:

- Extend `LootDropRowViewModel` or adjacent view-model data rather than deriving
  nested display math directly in React markup.
- Preserve stable parent `rowId` ownership for `index-sim:loot-prefs`.
- Add composition rows derived from the current `TripLootSupplyResult` with:
  parent row id, display name, selected action, GP/kill contribution, share,
  optional state flags for eaten/displaced rows and optional child-count metadata.
- Expand nested rows from `_expand` into full display records with normalized
  numeric weight/price fields when present and raw display strings otherwise.
- Action impact view models should include enough metadata for selected/default
  markers and action-specific notes without recalculating simulation results in
  the React component.
- Keep all new UI state, such as open detail rows or selected detail panels,
  separate from `SimulationRequest`. Persist it only if a clear user workflow
  requires it; if persisted, use a versioned rewrite-owned UI state key.

Acceptance criteria:

- For a monster with random herb, random jewel, casket or ultra-rare rows, the
  user can open the parent row and inspect every nested child row available in
  `_expand`.
- The user can identify the top loot contributors and see how much each selected
  action contributes to GP/kill.
- Changing a drop action updates the selected action marker, row delta, action
  impact detail and loot value composition without changing unrelated row prefs.
- High-alch enablement changes available alch actions and action details for the
  current monster while preserving per-monster setting persistence.
- Browser-local Economy history, when present, enriches visible row context
  without requiring a network provider and without mutating price history.
- The workflow remains usable on mobile/tablet by keeping the main drop table
  horizontally scrollable and rendering nested/action details as contained
  disclosure panels or dialogs.

Validation target:

- Unit/view-model tests cover composition totals, top contributor/tail grouping,
  full nested row expansion, action impact metadata and eaten/displaced row
  labels.
- Existing trip/loot/supply parity tests continue to pass without changing
  domain GP/hr semantics.
- Playwright smoke opens Loot, expands a nested row, changes an action and checks
  that composition/action impact text updates.
- If Economy-history context is added to Loot rows, unit tests use local
  `PriceHistoryState` fixtures and must not call live services.
- Implementation validation should include `npm run typecheck`, focused unit
  tests, relevant Playwright smoke coverage when browser behavior changes and
  `git diff --check`.

### Trip

Required content:

- Food selector and food-count auto/manual control.
- Potion/vial/single-dose settings and dose recommendations.
- Bank time auto/manual control.
- Protection prayer and prayer restore modes: potions, altar and flick.
- Safespot toggle and explanation.
- Antifire and antipoison controls when relevant.
- Inventory reserve controls: teleport, ammo recovery, DBA restore and rune slots.
- Scarce spot / AFK target and respawn controls.
- Cannon-at-spot toggle and target count when scarce mode is enabled.
- Food-per-kill override.
- Trip outcome, effective rates, supply rates, ammo and prayer drain details.

Current implementation note: the rewrite state/schema now models `bankSeconds` as a nullable auto/manual value plus `potionSets`, `potionDoses`, `singleDose`, `dbaRestore`, `runeSlots`, `safespot`, `protect`, `recoilRings`, `foodCount`, `foodPerKillOverride`, `prayerPotionSets`, `prayerPotionDoses`, `altarSeconds`, `scarceSpot`, `targetsAtSpot` and `respawnSeconds`, and maps active Trip assumptions into `TripPolicy` without adding Trip fields to `SimulationRequest`. Version 3 rewrite setup envelopes remain backward compatible because newly modeled fields default through the Zod schema, and legacy auto bank time imports as `bankSeconds: null`. The root UI exposes food selector, bank time Auto/Manual seconds, single-dose toggle, general potion vials/doses, a general potion recommendation panel with recommended carry, repot interval, active-trip estimate, inactive/no-boost/manual-carry/below/above/matched status and Apply recommendation action, teleport item, ranged ammo recovery, DBA restore only when the melee DBA special boost is active, magic rune slots, safespot Auto/On/Off, protect prayer, antifire, antipoison, prayer restore auto/manual vials/manual doses, altar timing, scarce/AFK target count and respawn seconds, food-count auto/manual, food-per-kill override and recoil ring count when ring of recoil is equipped. Non-applicable reserve controls stay visible in disabled/read-only form for the current combat style or setup except DBA restore, which is hidden until the DBA boost makes it relevant. The domain applies enabled scarce/respawn limits to effective trip rates before prayer-per-kill is calculated. The general potion recommendation is derived in `src/domain/trip` from selected general combat boosts, `sustained`, `repotThreshold`, finite `cycleSec * killsPerTrip` active fighting time and the current vial/single-dose mode; sustained-off setups show an inactive repeat-dose state, no general combat boost shows a no-boost state, non-finite trip estimates guide the user to manual `vials/type` or `doses/type` carry, and active finite estimates enable Apply only when the recommended carry differs from the current general potion carry. It is not persisted and Apply only writes `potionSets` or `potionDoses`. The Cannon pane can link its target count and respawn seconds into the same Trip sparse state, so cannon-at-spot sparse assumptions are visible in the Cannon workflow instead of hidden in generic Trip state. The Trip summary is grouped by survival, prayer, food, inventory reserve, potions, scarce cap, recoil and outcome/effective rates, and uses user-facing labels for `Bank time` (`Auto 90s`/`Manual 60s` style), `Food count` (`Auto 12`/`Manual 8` style), `Prayer restore` (`Auto 3 vials`, `Manual 8 doses` or `Manual 3 vials`), `Protection prayer`, `Potion carry`, `Potion slots`, `Loot capacity` and `Effective K/hr`. It keeps the same selected food, teleport reserve, ammo recovery, rune slots, active survival, prayer carried, max kills from prayer, prayer points per dose, recoil assumptions, respawn-bound status, inventory reserve slots/parts, potion parts/costs, free-at-start details, supply/kill and ammo/kill details, plus DBA restore only when the DBA boost is active. Open question: should exact archived legacy UI `potRec` numerical parity be accepted as a requirement?

Release classification: the visible Trip controls and grouped Trip result workflow are accepted for V1 replacement in the rewrite architecture. Exact archived legacy `potRec` numerical parity, prayer potion modeling changes, live/provider data and canonical data choices remain decision-needed follow-ups, not blockers for this accepted Trip slice.

### Cannon

Required content:

- Per-monster enable toggle.
- Target count and respawn controls.
- Explanation of cannon accuracy and XP rules.
- Idle state when the spot is too sparse.
- Effective targets, cannon DPS, balls/hr, balls/kill, cannon ranged XP/hr, ball cost/hr, ball cost/kill and ball price.
- Kills/hr uplift vs solo.
- Respawn-bound warning.
- Cannonballs to bring per trip and per-trip ball cost.

Current implementation note: the root rewrite now exposes Cannon as its own workbench tab in the legacy tab order. It owns per-monster enable, target count and respawn settings in versioned rewrite setup state, provides current-monster reset, can link its spot assumptions to Trip sparse state, and displays idle/respawn-bound status plus compact accuracy, XP, supply, sparse-link and inventory-reserve notes. The output metrics cover effective targets, cannon DPS, balls/hr, balls/kill, cannon ranged XP/hr, effective XP/hr with cannon, effective net GP/hr with cannon, ball cost/hr, ball cost/kill, ball price, cannonballs/trip, ball cost/trip and kills/hr uplift. Browser tests snapshot the expanded Cannon output for the ranged Dagannoth cannon path. Legacy cannon-map migration remains a legacy storage decision, not part of the visible Cannon tab parity.

### Setup comparison

Required content:

- Save current setup action.
- Persisted saved setups.
- Rename, load and delete controls for saved setups.
- Versioned saved-setup export/import with bounded validation and non-destructive merge behavior.
- Table comparing live and saved setups on the current monster.
- Best markers for effective XP/hr, effective net GP/hr and GP/XP.
- A visible DPS delta and an expandable live-versus-snapshot review for active setup fields and calculated impact.
- On-demand cross-monster matrix for live and saved setups with metric selection, filtering and per-monster best markers.

Current implementation note: the rewrite Setups tab now exposes the visible
saved-setup workflow over the Goal 1 foundation. `src/app/state/duel-snapshots.ts`
owns version 1 of the separate rewrite-local `index-sim:duel-snapshots`
persistence contract. Saved payloads store validated and normalized
`CombatSetupFormState` values only, reject oversized persisted lists, cap
app-side mutations to 12 saved setups and do not store calculated results, upstream
data, player names or shared-link data. The UI can snapshot the current setup,
rename saved setups, load one into the live editor while preserving the current
target monster and delete individual saved setups. Browser persistence is
automatic; version 1 export/import is grouped under `Manage saved setups` for
backup or transfer. Import rejects oversized, malformed,
unsupported-version and computed-result payloads, updates matching ids and adds
new snapshots only while the current 12-entry cap has room. The comparison table
uses `createDuelComparisonViewModel()` to build live plus snapshot rows by
re-simulating each snapshot setup against the current active monster, including
XP/hr, effective net GP/hr, GP/XP and best-marker fields where live can also win.
Each saved row also exposes one keyboard-operable `Review diff` panel at a time.
The panel groups normalized active setup field differences and shows snapshot-minus-live
calculated deltas for combat, trip, XP and economy metrics. The target, cannon,
loot policy and prices are shared recalculation inputs rather than snapshot
differences; Planner targets and inactive per-style caches are excluded. D-068
keeps this comparative and does not claim per-field causal attribution. The
snapshot persistence and export/import schema are unchanged.
The optional all-monster comparison is built only after an explicit user action through
`createDuelMatrixViewModel()`. It evaluates the live setup and at most 12 saved
setups across the current generated monster catalog, exposes DPS, XP/hr, net
GP/hr and GP/XP views, supports a local monster filter and marks the best setup
within each monster row. The matrix is not persisted and is treated as stale
when setup, snapshot, price, cannon or loot inputs change, so normal setup edits
do not trigger a full cross-monster recalculation.
Compatible legacy `sim_input_v3.duelSetups` rows migrate through the same bounded
form validation into the rewrite-owned saved-setup storage. Existing rewrite
saved setups win conflicts, the shared 12-entry cap applies and invalid or computed
rows produce sanitized skip reasons. The planned active setup permalink is
specified separately and does not share this collection. Account-backed saves,
shared saved-setup collections and server-backed sharing remain out of scope.

### Planner

Required content:

- Use `src/domain/planner` as the calculation owner.
- Preserve the accepted rewrite Planner UI flow: optimize-for display, avg-over-session toggle, only-current-gear toggle, recompute control, skill locks, current XP fields, target fields, notes/warnings, summary metrics, order of training, gear timeline, DPS vs cumulative XP chart and gear pool editor. D-047 keeps legacy future/hypothetical weapons out of V1, so they are not part of the accepted Planner slice.
- Planner UI state must be versioned and persisted separately from pure domain input.

Current implementation note: `src/app/state/planner.ts` now owns version 1 of the rewrite Planner UI state contract under `index-sim:planner-ui`. The state covers metric, target levels, current XP values, skill locks, avg-over-session, only-current-gear and gear-pool restrictions. `src/app/view-models/simulation.ts` adapts that state into `src/domain/planner` input/options and validates gear-pool ids against the active `GameDataSnapshot`/default planner pool. The workbench Planner tab now exposes the visible workflow for optimize metric, current XP, target levels, skill locks, active avg-over-session, only-current-gear, explicit Recompute, summary metrics, training order, unlock summary, gear pool editor, gear timeline, DPS-vs-cumulative-XP chart and empty/error states. Recompute snapshots the Planner UI state into a calculation state and does not mutate combat setup, target monster, loadout or price state; changing avg-over-session marks the Planner pending until Recompute. Avg-over-session maps to the domain Planner `sustained` option independently of the combat setup sustained control. Planner output consumes source-backed generated numeric requirements, including Strength, and surfaces an info warning only when it falls back to D-051 for a legacy or missing row. The V1 Planner acceptance line is backed by deterministic domain golden fixtures plus visible Planner smoke. The gear pool editor only narrows the current non-hypothetical default planner pool; D-047 keeps future/hypothetical gear out of V1. D-048 keeps legacy `sim_planner_v1` detect/review-only and not migrated. Quest-state requirements, D-051 fallback removal and legacy planner numeric parity remain later boundaries.

Release classification: the visible Planner tab and rewrite-domain Planner workflow are accepted for V1 replacement. D-047 keeps future/hypothetical gear exposure out of V1, D-048 keeps legacy `sim_planner_v1` state review-only/not migrated and D-051 keeps a bounded fallback for legacy/missing rows. Exact legacy planner numeric parity, quest-state requirements and fallback removal remain later follow-ups, not blockers for this accepted Planner slice.

### Economy

Required content if price history remains a product feature:

- Price age badge.
- Snapshot count, items tracked, moved count and latest snapshot age.
- Latest-vs-previous / latest-vs-first selector.
- Shared/local snapshot counts plus `Save local comparison` and `Clear local history` controls.
- Top gainers and fallers.
- Item filter.
- Movers table with item, trend sparkline, price, baseline, GP delta and percent delta.
- Item-selectable chronological trend with latest, minimum, maximum, net change
  and exact shared/local snapshot points.

Current implementation note: Economy is complete for the accepted slice. It
loads committed `price-history.json` into a read-only shared analysis source and
merges capped `index-sim:price-history` comparisons only in memory. The UI shows
shared/local/total counts, movers, sparklines and exact item trend points across
both sources. `Save local comparison` records the active composed PriceSet;
`Clear local history` requires confirmation and removes only the local key, so
shared points remain visible. Selected local market prices still win over
scheduled then bundled prices, while generated high alch wins in every source.
Missing values and zero baselines remain finite. Backend/account history and
live scheduled-run evidence remain separate boundaries.

### Loot/Economy Release Classification

Status date: 2026-07-08. This classification applies to the visible
Loot/Economy V1 replacement workflow in the root Vite rewrite, not to
production market automation or full legacy storage migration.

| Classification     | Items                                                                                                                                                                                                                                                                                                                                                      | Release impact                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `release-required` | Current-monster loot actions/settings; reset/optimize with Undo; loot composition/nested detail; structured price warnings; active market-price context; generated high alch; local PriceSet override/reset; shared read-only plus local comparison history; `Save local comparison`; confirmed `Clear local history`; movers, sparklines and item trends. | Complete for this slice.                                                         |
| `later`            | Further Economy analysis beyond the local movers/trend workflow, visual scenarios beyond the implemented repository-local matrix and remote merge-gate promotion.                                                                                                                                                                                          | Not required unless a later release makes one of these evidence areas a blocker. |
| `legacy-only`      | Archived `market.js` current-monster nested sync behavior, legacy script-order globals, legacy `/api/prices` or `/api/scrape` production copy and legacy runtime internals.                                                                                                                                                                                | Not ported by design for the rewrite V1 path.                                    |
| `decision-needed`  | Full legacy history migration and backend/account history.                                                                                                                                                                                                                                                                                                 | Keep as explicit future work, not blockers for the accepted visible slice.       |

### Settings

Required content:

- Price and alch import inside Settings.
- Gear-tier hiding controls.
- Price/alch counts and import status.
- Scheduled static price snapshot status following [live-integrations-spec.md](live-integrations-spec.md).
- Service-aware scheduled/unavailable/fallback state for market prices. Production copy must not point users to `run_sim.py` or imply user-triggered upstream refresh.

Current implementation note: Settings Price data shows scheduled status and active PriceSet metadata. Imports use the validated parser, keep imported market prices, replace imported alch with generated Revision 274 values, persist the selected override and add a local comparison. Reset clears only the selected key, preserves shared/local history and returns to scheduled or bundled prices. Economy owns merged read-only shared plus local comparison analysis. Settings Gear controls remain separately backed by `index-sim:hidden-gear-tiers` and preserve current/None selections.

## Implementation Phases

### Phase A: dense spreadsheet parity

- Replace the current two-column rewrite dashboard shell with the dense spreadsheet root view.
- Add compact setup strip, metric strip and full all-monster sortable table.
- Keep the broader three-zone shell as the full workbench target after the dense table parity slice is usable.
- Add Playwright smoke coverage for row count, sorting, row-click target selection and responsive overflow.

### Phase B: workbench shell parity

- Add SetupBar, TabBar and MonsterCard scaffolding around or alongside the dense spreadsheet flow.
- Keep existing rewrite view-model calculations where possible.
- Add Playwright smoke coverage for shell geometry, tab order and independent scroll containers.

Current implementation note: complete for the accepted V1 workbench shell slice.
The root rewrite now has the workbench shell foundation with PlayerSidebar,
setup context bar, workflow-order TabBar, active pane routing for Stats,
combat-style setup, Monsters, Setups, Loot, Trip, Risk, Cannon, Planner and
Economy/Settings surfaces, and a visible right-side MonsterCard rail. Full
visual regression remains open.

### Phase C: setup and equipment parity

- Move combat type, levels, stance and trip-rate summary into PlayerSidebar.
- Show current gear/boost controls in one dynamically labelled setup tab.
- Add per-combat-type loadout stash/restore.
- Add MonsterCard target search, drop filter and equipment overview.

Current implementation note: complete for the accepted V1 setup and equipment
slice. Combat type, levels, stance and key trip-rate summary are in
PlayerSidebar, and per-combat-type loadout stash/restore is implemented in
versioned setup state. One active-style equipment pane now covers searchable
weapon, ammo, spell and gear selectors, per-slot active-style
gear quick actions, bonus summaries and two-handed shield locking. SetupBar now
covers rewrite-owned monster-specific custom setup create/edit/remove, manual
accuracy/damage/speed overrides and target switch restore. MonsterCard now adds
target search, shared drop filter, active defence highlight and compact
equipment overview in the right rail. Full best-in-slot semantics and legacy
custom setup migration remain open.

### Phase D: main workflow parity

- Restore full Stats, Monsters, Loot and Trip tab workflows.
- Add UI-level tests for changing a target, editing a loadout, sorting/filtering Monsters, changing loot actions and changing trip assumptions.

Current implementation note: Stats, Result summary, Loot/Economy and Trip are
complete for the accepted V1 replacement slices, and Monsters has the accepted
D-032 release classification. Remaining exact legacy numeric questions are later
or decision-needed scope.

### Phase E: missing tab parity

- Compatible legacy `duelSetups` migration is implemented; unsupported rows stay
  non-fatal and visible only through sanitized migration metadata.
- Add remaining Settings parity, subject to product decisions for live sync and
  price history.
- Add any remaining persisted UI state for settings or later accepted
  per-monster maps.

### Phase F: replacement hardening

- Extend browser-rendered numeric snapshots from the current dense table row and
  metric-strip workflow coverage to any remaining representative legacy fixtures
  once those workflows become release blockers.
- Extend migration/reset UX for remaining review-only legacy `localStorage` areas if deeper migration is accepted. The current rewrite already classifies known keys in the review UI, imports compatible setup, prices, hidden tiers, dense compare and unambiguous loot prefs, shows what import/keep/clear will do, hardens `sim_planner_v1` as detect/review-only rather than importing it into rewrite Planner state, and shows legacy `monsterSetups`/`cannonByMonster` as nested `sim_input_v3` review-only areas that are not deeply imported.
- Update [rewrite-parity-report.md](rewrite-parity-report.md) when browser UI parity evidence exists.

## Acceptance Criteria

UI parity is acceptable when:

- Phase A presents the dense spreadsheet as the root workflow with the compact setup strip, 8-cell metric strip, full all-monster table, sortable headers and row-click target selection.
- The main workbench layout and tab order match the legacy workflow.
- Every preserved legacy workflow in [../product/feature-inventory.md](../product/feature-inventory.md) is implemented or has an accepted intentional delta.
- Existing users can find combat setup, target selection, equipment, compare, loot, trip, cannon, duel, planner, economy and settings from the same conceptual locations as before.
- `npm run typecheck`, relevant unit tests, Playwright smoke tests and `git diff --check` pass for the implementation change.
- Any backend-backed features are either implemented behind accepted decisions or visibly disabled with accurate copy.

## Open Questions

- Should the dense spreadsheet remain the final default root view, or become a compact mode once the full tabbed workbench is restored?
- Should HP and Prayer level editing be added to the dense setup strip even though the legacy spreadsheet did not expose them there?
- Should direct DPS or effective DPS own the dense spreadsheet's `DPS` label after special attacks and cannon behavior are exposed?
- Should hiscores lookup and live market sync be hosted by a Node service, serverless functions or another same-origin runtime?
- Should the rewrite migrate legacy browser state or provide a one-time reset/import flow?
- Should known legacy UI bugs be preserved until parity is achieved, or fixed during the UI parity work with explicit release notes?
- What visual tolerance should be used for browser screenshots: exact legacy styling, or layout/workflow parity with updated component styling?

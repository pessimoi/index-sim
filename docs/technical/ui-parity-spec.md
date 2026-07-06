# UI Parity Specification

- Status: implementation target specification
- Date: 2026-07-05
- Owner: technical docs
- Product inventory: [../product/feature-inventory.md](../product/feature-inventory.md)
- Legacy UI source: `views.jsx` and `planner.jsx`
- Rewrite UI source: `src/app`

## Goal

The refactored Vite/React implementation should feel like the same combat workbench as the legacy UI, with cleaner internals. Calculation parity alone is not enough. The default layout, tab order, workflow grouping and feature discoverability must match the old tool closely enough that an existing user can move from legacy to rewrite without hunting for controls.

## Non-goals

- Do not reintroduce runtime Babel, CDN React or real `window.*` ownership into the production app path.
- Do not add database, auth or backend behavior beyond accepted decisions. Hiscores and live market sync are accepted product features and are specified in [live-integrations-spec.md](live-integrations-spec.md).
- Do not delete the archived legacy files as part of UI parity work.
- Do not treat the current compact rewrite dashboard as the target layout for full replacement.

## Accepted Direction: Dense Spreadsheet First

Decision [D-014](../project/decisions.md) makes the legacy-style dense combat spreadsheet the next UI parity target.

The rewrite should first replicate the `CombatSpreadsheet` workflow from `views.jsx`, not the current card-like two-column dashboard. The target is a compact, calculation-first screen where the user can adjust the active loadout and immediately compare every monster in one dense table.

This dense spreadsheet can be the root rewrite view during parity work. Its final relationship to the full tabbed workbench remains open: it may stay as the default view, become a "Spreadsheet" or "Compare" mode, or coexist with the three-zone workbench described below.

### Dense Spreadsheet Layout

Desktop layout:

```text
Chrome: workspace / sim / combat.spreadsheet                         TYPE
Compact setup strip: TYPE ATT STR DEF STANCE PRAY POT ACC+ DMG+ SPD F/KL TARGET
Metric strip: DPS MAX HIT HIT % TTK KILLS/HR XP/HR GP/HR NET GP/KILL
Header strip: All monsters - current loadout - row count and sort hint
Scrollable dense table: one row per monster, sortable columns, row click selects target
```

The view must use strips and tables, not dashboard cards. It should fit the first viewport with the current target, active combat type, key metrics and the first rows of the monster table visible.

### Compact Setup Strip

Required order and behavior:

| Slot | Melee label | Ranged label | Magic label | Behavior                                                                                                                                          |
| ---- | ----------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | TYPE        | TYPE         | TYPE        | Combat type segmented/select control. Changing type applies style defaults while preserving levels and target.                                    |
| 2    | ATT         | RNG          | MAG         | Primary offensive level.                                                                                                                          |
| 3    | STR         | reserved     | SPELL       | Melee strength, ranged reserved alignment cell, or magic spell select.                                                                            |
| 4    | DEF         | DEF          | DEF         | Defence level.                                                                                                                                    |
| 5    | STANCE      | STANCE       | STANCE      | Weapon/style control using the same stance options as the active combat type.                                                                     |
| 6    | PRAY        | PRAY         | PRAY        | Compact primary prayer selector. Multi-prayer detail can be deferred to the full workbench, but this control must update rewrite `prayers` state. |
| 7    | POT         | POT          | POT         | Compact primary boost selector. Multi-boost detail can be deferred to the full workbench, but this control must update rewrite `boosts` state.    |
| 8    | ACC+        | ACC+         | M+%         | Manual accuracy or magic accuracy adjustment. Empty value uses the derived equipment/stance value.                                                |
| 9    | DMG+        | DMG+         | DMG%        | Manual damage adjustment. Empty value uses the derived equipment/ammo/spell value.                                                                |
| 10   | SPD         | SPD          | SPD         | Manual attack speed in seconds. Empty value uses the weapon/style-derived speed.                                                                  |
| 11   | F/KL        | F/KL         | F/KL        | Food per kill or current trip food pressure. If the rewrite cannot yet write this directly, show the current model value read-only.               |
| 12   | TARGET      | TARGET       | TARGET      | Monster select. Changing target updates the metric strip and highlights the table row.                                                            |

The legacy source renders these controls into a 13-column grid even though the named control set is effectively 12 slots. The rewrite can keep 12 named slots plus a reserved rhythm column, or preserve 13 physical grid columns, but labels and visual rhythm should match the old spreadsheet.

### Metric Strip

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
selection through the dense table.

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
representative default melee Hill Giant, settled ranged Greater Demon and
cannon-enabled ranged Dagannoth rows, and also locks the related metric-strip
numbers for default melee, ranged safespot, cannon, loot action override,
manual food/prayer trip, imported PriceSet, mocked market sync and compatible
legacy import paths.

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

Current implementation note: the rewrite now has a workbench shell foundation
around the dense spreadsheet flow. It includes a left PlayerSidebar, center
setup context bar, horizontally scrollable legacy-order TabBar and active pane
routing. This slice is intentionally two-zone: the right-side MonsterCard,
independent rail scrolling polish and final default-pane decision remain open.

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

The main tab order must match legacy:

1. Stats
2. Melee
3. Ranged
4. Magic
5. Compare
6. Loot
7. Trip
8. Cannon
9. Duel
10. Planner
11. Economy
12. Settings

Additional requirements:

- Stats is the default tab.
- Melee, Ranged and Magic tabs double as combat-type switches.
- A combat-type change must preserve per-style loadouts in the same way the legacy reducer stashes and restores loadouts.
- Tab labels should remain short and familiar. Secondary status text can be visually suppressed, but tab placement must stay stable.
- Deep linking to tabs is optional, but Playwright tests should be able to select each tab deterministically.

## State Contract

Keep the rewrite's domain boundaries, but model the legacy UI state explicitly:

- `SimulationRequest` remains clean and domain-facing.
- UI form state must include per-combat-type loadouts.
- Versioned persisted state must account for per-monster custom setups, default setup, current target, loot prefs, hidden gear tiers, compare relevance, compare sort, planner UI config, duel snapshots, cannon settings, per-monster alch, overhead and jewel-spot maps.
- Legacy keys now have an import/keep/clear UX for known keys and compatible `sim_input_v3` setup fields. `sim_planner_v1`, `sim_loot_prefs_v1`, `sim_hidden_tiers_v1`, compare/cannon maps and legacy price-history keys still need either deeper migration, intentional reset handling or an accepted no-migration decision.
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
implemented in this slice.

## Required Panes

### PlayerSidebar

Required placement: left rail.

Required controls and displays:

- Combat type segmented control.
- Levels, with fields filtered by combat type plus Defence, HP and Prayer.
- Hiscores lookup with service-aware `available`, `unavailable` or disabled-runtime state from the same-origin API. Full live acceptance still needs a production runtime and authoritative upstream decision.
- Stance/style control, including weapon-specific melee stance names and attack type.
- Effective trip rates: XP/hr, net GP/hr and XP/hr by skill.

Current implementation note: the PlayerSidebar is present in the root rewrite.
It exposes combat-type switching, combat-style-filtered level fields plus
Defence/HP/Prayer, stance/style selection, service-aware hiscores lookup with
preview/apply and key effective rates. Full skill-XP row ownership and broader
gear controls remain later parity work.

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

### Stats

Required content:

- Large metrics for DPS, effective XP/hr, effective net GP/hr and hit chance.
- Combat roll metrics: max hit, effective accuracy, effective damage, tick/speed, TTK, cycle, kills/hr and GP/kill.
- Banking trip metrics when trip modeling applies.
- Hit distribution histogram.
- XP routing chips.

### Melee, Ranged and Magic

Required shared content:

- Dedicated tab per combat style.
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

Current implementation note: the rewrite workbench now exposes Melee, Ranged and Magic equipment panes backed by `GameDataSnapshot` option data. They provide searchable weapon selectors, style selectors, single prayer/boost controls, sustained/repot controls, manual accuracy/damage/speed override controls, equipment slot selectors, an equipment bonus summary, Ranged ammo selection and Magic spell selection. Selecting a two-handed weapon clears and locks the shield slot while the weapon remains active. These controls write the versioned per-combat-type loadout state and flow through `formToSimulationRequest()`. Manual overrides map to `SimulationRequest.manualOverrides`; invalid or out-of-range values are rejected by persisted-state validation and defensively ignored by the combat domain.

Current special-attack implementation note: the dense rewrite UI has an interim Special attack section that exposes the existing domain-supported melee and ranged DPS special weapons, ranged spec-arrow selection for bow specials and result metrics for spec max hit, hit chance, specs/hr, DPS with spec and DPS gain. The control writes versioned rewrite setup state and `formToSimulationRequest()` only emits `specialAttack` for valid supported selections. Magic special attack UI is disabled because no magic DPS special path is currently modeled, and DBA restore/detail behavior remains a separate Trip/workbench parity step.

### Compare

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

Current implementation note: the root rewrite UI exposes a full current-target drop table with stable row-id based action overrides, versioned rewrite-owned loot preference persistence, reset current monster, deterministic bounded optimize for net GP/hr, per-action net GP/hr impact, rewrite-owned per-monster loot settings and a browser-local accepted-price history summary. Available actions are restricted to meaningful row/action pairs: bones can bury, herbs can unid/value, gem rows can value and alch is exposed only when the current monster's high-alch setting is enabled and profitable. Per-monster loot settings persist separately from row preferences and currently cover high-alch enablement, auto/manual kill overhead seconds and underground/overground talisman spot. Nested rows have a compact expandable preview. The Economy tab now owns full browser-local price-history analysis, Snapshot now and confirmed Clear history; fuller nested-table loot/economy workflows remain separate parity steps.

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

Current implementation note: the rewrite state/schema now models `safespot`, `protect`, `recoilRings`, `foodCount`, `foodPerKillOverride`, `prayerPotionSets`, `prayerPotionDoses`, `altarSeconds`, `scarceSpot`, `targetsAtSpot` and `respawnSeconds`, and maps active restore-mode/scarce values into `TripPolicy` without adding Trip fields to `SimulationRequest`. The root UI exposes safespot Auto/On/Off, protect prayer, antifire, antipoison, prayer restore auto/manual vials/manual doses, altar timing, scarce/AFK target count and respawn seconds, food-count auto/manual, food-per-kill override and recoil ring count when ring of recoil is equipped. The domain applies enabled scarce/respawn limits to effective trip rates before prayer-per-kill is calculated. The Cannon pane can link its target count and respawn seconds into the same Trip sparse state, so cannon-at-spot sparse assumptions are visible in the Cannon workflow instead of hidden in generic Trip state. The Trip summary shows active survival, prayer restore, prayer carried, max kills from prayer, prayer points per dose, food and recoil assumptions, respawn-bound status, inventory reserve slots/parts, potion slots/parts, loot capacity and free-at-start details. Fuller legacy trip-control placement/wording remains a separate parity step.

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

### Duel

Required content:

- Snapshot live loadout action.
- Persisted setup snapshots.
- Rename, load and delete snapshot controls.
- Table comparing live and saved setups on the current monster.
- Best markers for effective XP/hr, effective net GP/hr and GP/XP.

### Planner

Required content:

- Use `src/domain/planner` as the calculation owner.
- Preserve the legacy planner UI flow: optimize-for display, future weapons toggle, avg-over-session toggle, only-current-gear toggle, live/pause/recompute controls, skill locks, current XP fields, target fields, notes, summary metrics, order of training, gear timeline, DPS vs cumulative XP chart and gear pool editor.
- Planner UI state must be versioned and persisted separately from pure domain input.

Current implementation note: `src/app/state/planner.ts` now owns version 1 of the rewrite Planner UI state contract under `index-sim:planner-ui`. The state covers metric, target levels, current XP values, skill locks, avg-over-session, only-current-gear and gear-pool restrictions. `src/app/view-models/simulation.ts` adapts that state into `src/domain/planner` input/options and validates gear-pool ids against the active `GameDataSnapshot`/default planner pool. The workbench Planner tab now exposes the visible workflow for optimize metric, current XP, target levels, skill locks, only-current-gear, explicit Recompute, summary metrics, training order, unlock summary, gear pool editor, gear timeline, DPS-vs-cumulative-XP chart and empty/error states. Recompute snapshots the Planner UI state into a calculation state and does not mutate combat setup, target monster, loadout or price state. The gear pool editor only narrows the current non-hypothetical default planner pool; it does not enable future/hypothetical gear or choose a generated requirement source. Legacy `sim_planner_v1` is detect/review-only until a separate migration decision exists: the migration UX reports that Planner data was found, warns that it is not imported, keeps it on Import/Keep, preserves existing `index-sim:planner-ui` state and removes it only through confirmed Clear with the other known legacy keys. Full legacy Planner migration, active avg-over-session semantics and legacy planner numeric parity remain open.

### Economy

Required content if price history remains a product feature:

- Price age badge.
- Snapshot count, items tracked, moved count and latest snapshot age.
- Latest-vs-previous / latest-vs-first selector.
- Snapshot now and clear history controls.
- Top gainers and fallers.
- Item filter.
- Movers table with item, trend sparkline, price, baseline, GP delta and percent delta.

Current implementation note: the Economy tab records capped browser-local history snapshots only after validated imported or synced `PriceSet` values are accepted active, and `Snapshot now` can capture the current active `PriceSet` without calling a network service. The tab shows active/latest price-set labels, latest snapshot age, tracked item count, snapshot count, moved item count, Previous/First/Snapshot baseline selection, item filter, top gainers/fallers and a movers table with latest price, baseline price, GP delta and percent delta. Missing or zero baseline prices render without `Infinity`/`NaN`. `Clear history` requires confirmation and removes only the rewrite-owned `index-sim:price-history` key. Trend sparklines and fuller economy workflows remain open.

### Settings

Required content:

- Price and alch import inside Settings.
- Gear-tier hiding controls.
- Price/alch counts and import status.
- Market sync controls following [live-integrations-spec.md](live-integrations-spec.md).
- Service-aware `available`, `unavailable` or disabled-runtime state for live sync when the accepted integration endpoint or provider is unavailable. Production copy must not point users to `run_sim.py`.

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

Current implementation note: partially complete. The root rewrite now has the
workbench shell foundation with PlayerSidebar, setup context bar, legacy-order
TabBar and active pane routing for existing Stats, combat-style setup, Compare,
Loot, Trip, Cannon and Economy/Settings surfaces. Duel and Planner are visible
as planned tab destinations only. MonsterCard scaffolding and independent rail
scroll evidence remain open.

### Phase C: setup and equipment parity

- Move combat type, levels, stance and trip-rate summary into PlayerSidebar.
- Split current gear/boost controls into Melee, Ranged and Magic tabs.
- Add per-combat-type loadout stash/restore.
- Add MonsterCard target search, drop filter and equipment overview.

Current implementation note: partially complete. Combat type, levels, stance
and key trip-rate summary are in PlayerSidebar, and per-combat-type loadout
stash/restore is implemented in versioned setup state. Dedicated Melee, Ranged
and Magic equipment panes now cover searchable weapon, ammo, spell and gear
selectors plus bonus summaries and two-handed shield locking. SetupBar now
covers rewrite-owned monster-specific custom setup create/edit/remove, manual
accuracy/damage/speed overrides and target switch restore. Best-in-slot actions,
hidden-tier settings, legacy custom setup migration and MonsterCard
target/equipment overview remain open.

### Phase D: main workflow parity

- Restore full Stats, Compare, Loot and Trip tab workflows.
- Add UI-level tests for changing a target, editing a loadout, sorting/filtering Compare, changing loot actions and changing trip assumptions.

### Phase E: missing tab parity

- Add Cannon, Duel, Economy and Settings parity, subject to product decisions for live sync and price history.
- Add persisted UI state for duel snapshots, planner config, hidden tiers, relevance and per-monster maps.

### Phase F: replacement hardening

- Extend browser-rendered numeric snapshots from the current dense table row and
  metric-strip workflow coverage to any remaining representative legacy fixtures
  once those workflows become release blockers.
- Extend migration/reset UX for review-only legacy `localStorage` keys if deeper migration is accepted. The current rewrite already classifies known keys in the review UI, shows what import/keep/clear will do and hardens `sim_planner_v1` as detect/review-only rather than importing it into rewrite Planner state.
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

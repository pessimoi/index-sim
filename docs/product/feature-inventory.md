# Feature inventory

- Status: current snapshot
- Date: 2026-07-21
- Owner: product docs
- Scope: visible legacy-vs-rewrite feature coverage.

## Status meanings

- `Valmis`: Present in the root Vite rewrite UI.
- `Osittainen`: Present, but with reduced controls, reduced parity evidence or missing legacy migration.
- `Suunniteltu`: Known legacy capability, rewrite requirement or bounded backlog item not implemented in the root rewrite UI yet.
- `Avoin`: Needs a product decision before implementation.

## Rewrite UI parity

Desktop workbench layout is `Valmis` under D-075: the root app now matches the
legacy console shape with one viewport-bound three-zone shell, compact
monospace controls and independent Player, active-pane and MonsterCard
scrolling. D-082 extends that contract to 640x360-style compact landscape
workspaces: document scroll stays at zero and the three pane owners remain
side-by-side. Portrait tablet widths through 980 px and mobile widths through
620 px retain normal document flow and the accepted pane order.

Workbench browser context is `Valmis`: all 11 allowlisted panes support exact
`pane=<id>` deep links, reload and non-recursive Back/Forward history through the
existing lazy-family lifecycle. Queryless first load remains Monsters/Compare;
invalid or duplicate pane entries are removed without losing unrelated query or
fragment state. User, roving-keyboard and More selections plus routed review
actions write one history entry only when the pane changes. The ready document
title follows pane, source-backed target and dynamic Loadout style. Active pane
is browser context only, not persisted or transferred.

Setup discoverability is `Valmis` under D-076: an always-visible `Where to
edit` bar shows current prayers/combat boosts, potion carry/prayer restore and
loot policy with direct links to their owning panes. `BOOST` replaces the
ambiguous compact `POT` label, Trip labels combat potion amounts explicitly,
and negative net GP explains the supply-vs-loot gap with direct review actions.

Compact text readability is `Valmis` under D-077: setup controls keep the dense
console rhythm but assign wider tracks to semantic text values such as target,
spell, stance, prayer and boost. Selected values are also available as native
hover/focus titles, and quick-navigation summaries wrap instead of ending in a
hard ellipsis.

User-facing entity names, unit semantics, compact abbreviation expansions and
the remaining Settings/Economy price-information duplication are now an
implemented finishing pass in
[the user-facing language specification](../technical/user-facing-language-units-information-hierarchy-spec.md).
Source-backed names are primary, exact IDs remain in labelled technical
disclosures, timing/GP/XP semantics share one presentation contract and
Settings routes its short active-PriceSet summary to Economy's sole detailed
Market owner. Compact text readability, Loot/economy summary and Market price
sync remain `Valmis`; their calculations, selectors and PriceSet transactions
did not change.

The 2026-07-11 whole-UI audit is `Valmis` under D-078, the selector follow-up
under D-079 and the control-ownership cleanup under D-080. All 11 workbench tabs
were inspected at desktop width and exercised
through a 390 px mobile-width browser contract. Long monster, weapon, ammo,
spell, gear, food, risk-drop, snapshot and trend-item choices now open one
select-style popup with its search and result count inside; the closed state
shows only the current selection. Short categorical fields remain native
selects. The compact `TARGET` and `SPELL` strip controls remain native quick
duplicates of their searchable owning fields so the horizontally scrolling
console strip stays compact. The same audit keeps setup actions legible,
contains both Risk actions, wraps Duel loadout summaries and avoids hard
truncation in Economy mover names.

Combat-type ownership is `Valmis` under D-080. PlayerSidebar is the only visible
Melee/Ranged/Magic mutator. The center navigation exposes one dynamic active
setup tab, compact `TYPE` is read-only, and switching or importing a style still
restores the accepted per-style loadout. The same pass removes redundant quick-
navigation intro copy and keeps all six manual-override input/reset pairs usable;
the three compact reset actions use a narrow labelled icon.

| Feature                      | Rewrite status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application failure recovery | `Valmis`       | The pre-React startup guard, fixed runtime-bootstrap failure and root React Error Boundary now cover the complete startup-to-ready render line. A post-ready pane render/lifecycle failure replaces the workbench with sanitized fixed copy and offers `Reload simulator` plus a tab-scoped `Open with saved data ignored for this session`. Safe mode chooses fresh in-memory state before any persisted loader, keeps later writes/clears in memory, shows a session-only notice and never reads, overwrites or deletes the original local data. Bootstrap and post-ready failures have separate unit coverage; the focused Chromium path provokes a ready-pane failure and proves safe recovery plus unchanged saved setup. No domain, generated-data or persisted-schema contract changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Keyboard navigation          | `Valmis`       | The root workbench has a first-focus skip link, a roving ARIA tablist over one dynamically labelled active tabpanel and arrow/Home/End tab activation. Interactive controls use a high-contrast `:focus-visible` outline without layout shifts, including nested file inputs. Dense Compare keeps only the selected monster row in sequential Tab order; Up/Down/Home/End move focus across visible rows and Enter/Space select the target while click behavior remains unchanged. D-079 popup comboboxes move focus into their internal search, support ArrowUp/Down, Home/End, Enter and Escape, and return focus after selection or cancellation. D-080 keeps one dynamic setup tab in the roving tablist while PlayerSidebar owns style mutation. The full production-preview Playwright suite passes 73/73 after the control-ownership audit. D-070 records this as a bounded keyboard interaction contract, not a WCAG conformance or assistive-technology certification claim. No form schema, persistence, domain, provider, auth, database or tenant behavior changed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Basic combat setup           | `Valmis`       | The root workbench keeps the accepted per-style setup, searchable loadout, quick-action, import/recovery and compact-control workflows. Loadout and Active assumptions warnings consume source-backed generated Attack, Strength, Defence, Ranged and Magic requirements; the active Revision 274 snapshot supplies 94 rows, while D-051 remains only for legacy or missing rows. Manual selection and quick-action requirement copy stay read-only and non-blocking, and requirement policy remains outside `SimulationRequest`. D-073/D-088 provide a bounded whole-loadout action that searches only visible current-revision weapon and equipment choices, defaults to filtering new candidates against current numeric levels, evaluates current-target normal DPS through the accepted simulator, reports skipped ineligible choices and capped search and supports one complete Undo. The unchanged current setup remains the no-regression baseline even when it has an unmet requirement, and an explicit session-local control restores the original warning-only candidate policy. Ammo/spell are not independently searched and D-047 still excludes future/hypothetical gear. The implemented [safe active setup reset](../technical/active-setup-reset-spec.md) keeps the current target, selected style, mode, saved Duel comparisons, prices and histories; reviews grouped current-to-default changes; resets all three style caches plus the active Default/current-target Custom owner; and offers complete durable/session-only persistence-aware Undo. The implemented [Default/custom mode and autosave clarity pass](../technical/setup-mode-autosave-clarity-spec.md) makes the active owner, action destinations and exact browser-local/session-only save outcome explicit without adding another setup type or changing the current state machine. Setup-file replacement now discloses all 13 apply-scope groups through the shared exhaustive form registry, with exact included/excluded scope, stale/Refresh, synchronous Apply protection and disabled no-op. Status stays `Valmis` because these are safety and clarity improvements to the accepted workflow; price-, quest- and ownership-aware optimization remains separate later work.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Result summary               | `Valmis`       | DPS, max hit, hit chance, effective kills/hr, effective XP/hr, effective gross GP/hr, GP/kill, supply/kill and effective net GP/hr are visible in the root metric strip; compact labels expand to the same full accessible rate basis. D-101 removes advisory price lists and price-confidence rows from Active assumptions: only active missing or explicit fallback values create one compact `Price data incomplete` section, whose `Review price data` action opens and focuses Economy's complete disclosure. The separate Active assumptions summary is built in the simulation view-model from validated current UI/app state, shows at most five prioritized non-price rows plus expandable overflow, and its Review actions only switch to the owning tab. Targeted Reset actions remain available only for safely resettable active rows: manual combat overrides, current-monster cannon, current-monster loot settings, current-monster loot action overrides, explicit safespot, Trip scarce spot and hidden gear tiers. Special warnings, active PriceSet/source rows, custom setup, protection prayer, inherited Trip high-alch, manual Trip controls and supply settings remain review-only. Playwright scaffold coverage snapshots the browser-rendered metric strip for default melee, ranged safespot, cannon-enabled ranged, loot action override, manual food/prayer trip, imported PriceSet, mocked market sync and compatible legacy import paths, and smokes Active summary Reset for manual, loot and cannon paths. Ring-of-recoil XP/hr attribution is an accepted rewrite intentional delta: legacy remains comparison evidence, but combat XP stays attributed to direct player combat damage rather than trip-layer recoil damage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Risk and variability         | `Valmis`       | D-074 and [the implementation specification](../technical/risk-variability-spec.md) add a separate on-demand Risk tab for kill-time P10/P50/P90, food-sufficiency risk, kills/trip and trip-cycle ranges, timed net-GP ranges and drop/GP target probabilities. Identical normalized inputs use a deterministic seed, 10,000-trial work runs behind the cancellable calculation worker and setup/price/loot/control changes mark results stale. Its explicit idle/building/ready/stale/failed lifecycle retains and labels the previous result on failure, exposes fixed safe `Retry analysis` and keeps failed/stale output out of Trip/Result fresh-result bridges. The visible model coverage distinguishes sampled normal/player/incoming/loot-occurrence sources from mean-only special, poison, cannon and loot-quantity detail. Current expected TTK, net GP and kills/trip retain `FullSimulationResult` ownership and show compact fresh risk ranges with a Risk link; no risk controls or results are persisted. Focused domain/worker tests and the full 586-test repository gate pass. The production-preview Chromium case passes 1/1 and covers Run, all five outputs, coverage/warnings, fresh/stale state and cancellation, including the status priority between cancelled work and stale prior results.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Stats analysis               | `Valmis`       | The Stats tab retains the accepted metric strip, Active assumptions, normal/special/cannon source detail, combat rolls, XP routing, Trip summary and accessible event distributions. Whole-Trip effective kills remain the headline, while combat-roll kills, cannon Ranged XP and cannon ball cost are explicitly named on-site diagnostics before banking/travel efficiency. Supported specials show per-hit distributions and active cannon shows per-fired-ball distributions under D-069. D-071 now supplies NPC size for 63/63 generated monsters: dragon halberd models one selected-target hit at size 1 and two above size 1, while missing-size legacy contexts retain the visible D-050 fallback warning. Adjacent-target behavior and new/magic special formulas remain outside scope. Status stays `Valmis` because this refines source truth behind the existing Special/Stats workflow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Dense spreadsheet view       | `Valmis`       | Root rewrite UI has the Phase A dense shell as the current Compare/Dense pane inside the workbench shell: compact control strip, metric strip, full all-monster sortable table whose four hourly decision columns use effective kills, XP, gross GP and net GP with aligned visible values, sorting and best markers while legacy sort ids remain compatible, explicit idle/building/ready/stale/failed calculation status, labelled previous rows and fixed safe `Retry comparison`, persisted dense sort, row-click target selection, active row marker, stable row state markers for custom setup, high-alch override, kill-overhead override, hidden/irrelevant and forced-current-target rows, custom setup row calculations, monster/drop filters, show hidden/irrelevant toggle, reset filters, rewrite-owned irrelevant monster state, sticky header and contained horizontal overflow. The current target stays visible when filters or irrelevant state would otherwise hide it. XP/hr and net GP/hr cells include compact row-scale indicators based on the currently visible rows, with net GP/hr distinguishing profitable and loss-making rows while keeping numbers primary. Playwright snapshots browser-rendered release-path dense numeric cells for default melee Hill Giant, melee alch-relevant Chaos Dwarf, ranged safespot Greater Demon, cannon-enabled ranged Dagannoth with negative net GP/hr, magic safespot Blue Dragon and a custom Green Dragon row with loot-setting markers, plus the related metric strip; it also smokes scale indicators through a filtered view and mobile/tablet overflow containment with internal table scrolling. D-032 accepts the release-path browser numeric coverage, the all-fixture browser-display expansion covers all 18 golden setups and the repository-local visual suite covers desktop/tablet Dense states. Broader legacy compare-state migration, pane-level detail beyond the covered states and promotion to a canonical remote visual gate remain later decisions, not blockers for this slice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Loot/economy summary         | `Valmis`       | Root rewrite UI exposes current-monster drop actions, loot settings, deterministic net GP/hr optimization with Undo, loot composition, nested detail, trip-state labels and structured price context. D-085 preserves numeric formulas and provenance; D-101 marks only values consumed by the active monetary calculation as aggregate notices, keeps inactive alternatives beside their Loot row or nested contributor and suppresses exact one-GP coin noise. Economy owns the complete collapsed `Price data notes (N)` disclosure with every active issue and confidence note; no duplicate aggregate Loot block or passive `N more` remains. Economy also merges read-only version-2 `price-history.json` with version-2 browser-local comparisons for movers, sparklines, item trends and point status. One shared price-time presentation keeps snapshot capture, market observation and evaluation visibly distinct with friendly zoned exact dates, signed age copy and canonical semantic `<time>` values; trend points, collision-safe selectors/lifecycle reviews and expanded Loot latest/baseline facts consume that prepared presentation without changing history identity. `Save local comparison` and confirmed `Clear local history` affect only `index-sim:price-history`; valid v1 local rows migrate as unknown and shared history remains unchanged. D-058 exact identities, D-052 fallback-only aliases, D-072 typed conditional loot and D-049's full legacy-history boundary remain in force.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Trip controls                | `Valmis`       | The Trip pane now exposes the main food, banking, potion carry and inventory reserve path: food selector, food-count auto/manual, nullable auto/manual bank time, single-dose toggle, general potion vials/doses, a visible domain-owned general potion carry recommendation with match status and Apply recommendation action, teleport item, ranged ammo recovery, melee DBA restore when the DBA special boost is active, magic rune slots, safespot override, protect prayer, antifire, antipoison, scarce/AFK spot controls, food-per-kill override and recoil ring count. Prayer mode, prayer potion auto/manual vials/manual doses and altar timing are also visible, while high-alch ownership stays in Loot. The Cannon pane can link its target/respawn spot to the same Trip sparse cap, so cannon-at-spot assumptions are no longer hidden in generic Trip state. The Trip summary is grouped by the legacy workflow shape: survival, prayer, food, inventory reserve, potions, scarce cap, recoil and outcome/effective rates. It shows selected food, Auto/Manual bank time, teleport reserve, ammo recovery, DBA restore, rune slots, active survival, `Protection prayer`, Auto/Manual prayer restore, prayer carried, max kills from prayer, prayer points per dose, Auto/Manual food count, recoil, inventory reserve slots/parts, potion carry, potion inventory slots/parts/costs, loot capacity, free-at-start details, supply/kill, ammo/kill and `Effective kills/hr`. The recommendation is derived from selected general combat boosts, sustained boost decay, repot threshold and finite active fighting time; it exposes inactive, no-boost, manual-carry, below, above and matched states, enables Apply only when the derived carry differs from current general potion carry, and Apply writes only `potionSets` in vial mode or `potionDoses` in single-dose mode. It does not change prayer potion modeling, live data, canonical data or provider decisions. V1 replacement parity is accepted for the visible Trip controls and Trip result workflow in the rewrite architecture. Exact archived legacy `potRec` numerical parity remains a decision-needed follow-up, not a blocker for this slice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Monster comparison           | `Valmis`       | The root rewrite keeps the full dense all-monster table in the Monsters pane with legacy column order, default XP/hr descending sort, sortable headers, explicit idle/building/ready/stale/failed calculation status, labelled previous rows and fixed safe `Retry comparison`, row target selection, monster/drop filters, show hidden/irrelevant toggle, reset filters, persisted irrelevant monster state and row markers for custom setup, high-alch override, kill-overhead override, hidden/irrelevant and forced-current-target rows. Rows with rewrite-owned custom setups are calculated from that monster-specific setup snapshot. MonsterCard mirrors target selection in the right rail through the same target switch path; monster and drop filters stay beside the all-monster table they affect. Browser-rendered numeric snapshots cover release-path default melee, melee alch-relevant, ranged safespot, ranged cannon, magic safespot and custom loot-settings rows, with active-row and forced-current-target marker checks; mobile/tablet smoke verifies active target visibility after irrelevant/filter paths and contained table overflow. The completed all-fixture case reloads all 18 golden setups and compares every visible metric-strip value with source-backed view-model output, and the repository-local visual suite covers desktop/tablet Compare states. D-032 accepts the release-path coverage for the current release slice. Broader legacy compare-state migration, pane-level browser detail beyond the covered states and promotion to a canonical remote visual gate remain later decisions, not blockers for this slice.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Planner                      | `Valmis`       | The rewrite Planner retains the accepted optimize metric, current XP, targets, locks, avg-over-session, only-current-gear, Recompute, summary, training order, unlock, pool, chart, timeline and warning workflow. Its summary and training-order headings explicitly name effective XP/hr or effective net GP/hr while retaining the existing optimization inputs. Summary and training order now follow the primary targets and Recompute controls, while the unchanged pool selections and slot resets live in an initially collapsed, keyboard-operable `Advanced gear pool · selected/total` disclosure after the results. Lifecycle feedback and fixed safe `Retry plan` remain directly beside the retained result; the last plan and captured metric context survive refresh failure, while first failure remains resultless. Versioned Planner UI state maps into `src/domain/planner` without entering `SimulationRequest`, unknown pool ids are dropped and D-047 limits choices to current non-hypothetical snapshot items. Eligibility and unlock binding now consume D-071 source-backed Attack, Strength, Defence, Ranged and Magic requirements; D-051 warns only for legacy or missing generated rows. Golden and browser evidence remain the V1 replacement line, and D-048 keeps `sim_planner_v1` review-only. Status stays `Valmis`; this is an information-hierarchy change, while quest-state requirements, fallback removal and exact legacy numeric parity remain separate boundaries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Special attacks              | `Valmis`       | The root rewrite retains supported melee/ranged special selection, ranged spec ammo, versioned persistence, safe `SimulationRequest.specialAttack` mapping, visible metrics, DBA suppression/Trip restore ownership and a non-emitting magic unsupported state. D-071 now drives dragon halberd from generated NPC size: one selected-target hit at size 1 and two above size 1. Missing-size legacy contexts retain the structured D-050 fallback warning. Adjacent-target behavior, new special formulas and magic DPS specials remain later scope. Status stays `Valmis` because this is a source-backed formula refinement of the accepted workflow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Cannon                       | `Valmis`       | Root rewrite UI exposes the Cannon workbench tab for per-monster enable, target count, respawn seconds, current-monster reset, Trip sparse-linking, respawn-bound status, aligned controls and compact accuracy/XP/supply/sparse/inventory notes. D-100 removes the false minimum-mob idle threshold: finite sparse spots retain a small expected fire rate, combined output includes player competition for live targets and a separate theoretical `Cannon only DPS` assumes player damage zero without feeding XP/GP/K/hr. Cannonball price still applies to combined balls/hr, balls/kill and per-trip supply, so effective net GP/hr includes the actual modeled ball cost exactly once. The remaining output set covers effective targets, combined cannon DPS, balls/hr, balls/kill, cannon ranged XP/hr, effective XP/hr, effective net GP/hr, ball cost/hr, ball cost/kill, ball price, cannonballs/trip, ball cost/trip and same-spot player-only kills/hr uplift. Browser-rendered snapshots cover a cannon-enabled ranged Dagannoth dense row, root metric strip and expanded Cannon output values. Legacy cannon-map migration remains tracked under Legacy saved setup migration, not this visible Cannon workflow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Setup comparison             | `Valmis`       | Root rewrite UI exposes the Setups tab for saved setup comparison. Users can save the current setup with a deterministic unique name, explicitly rename through Save/Cancel, load a saved setup into the live editor while preserving the current target monster, delete individual saved setups with one-step in-memory Undo and compare live plus saved rows against the current monster. Historical duplicate names remain readable with visible ordinal disambiguation and unique accessible row actions. The comparison table shows DPS, effective XP/hr, effective net GP/hr, net GP/XP and effective kills/hr deltas plus best markers, with live eligible to win; displayed kills, sorting, deltas and best markers all use the whole-Trip effective rate. Each saved row keeps the keyboard-operable calculated `Review diff` panel for normalized active setup fields and snapshot-minus-live combat, trip, XP and economy impact. Its separate Load action now opens the exhaustive shared form-registry review, blocks no-op or stale replacement, refreshes against the same row id and retains the current target plus complete one-step Undo. The current target, cannon, loot policy and active prices are shared recalculation context rather than snapshot differences; Planner targets and inactive per-style caches are excluded, and D-068 avoids unsupported causal attribution. The user-triggered all-monster comparison compares the same live plus saved setups across every current generated monster for DPS, effective XP/hr, effective net GP/hr or net GP/XP, with monster filtering, current-target highlighting and per-monster best markers. Comparison output is calculated only on demand and is invalidated when form, snapshots, prices, cannon, loot preferences or loot settings change. Saved setups persist in the separate rewrite-owned `index-sim:duel-snapshots` v1 key, store validated `CombatSetupFormState` only and are capped at 12 entries. Export/import retains the strict version 1 envelope and validation, then classifies every row: matching IDs default to Keep, explicit Replace exposes a source-backed field diff, selected additions consume visible capacity and conflicting recipient names block Apply. A changed collection makes the review stale until Refresh. Changed Merge/rename writes and verifies the one versioned key before live publication, offers explicit session-only fallback after safe failure and exposes one raw/live-guarded global Undo. Compatible legacy `sim_input_v3.duelSetups` rows retain their separate existing-wins semantics. Account-backed saves and shared permalinks remain outside this visible workflow. |
| Market price sync            | `Valmis`       | Rewrite UI shows committed static status, explicit active source, semantic snapshot/PriceSet time and per-item provenance/freshness counts with no user-triggered upstream refresh. Scheduled capture, active scheduled/bundled/selected creation, manual update, value observation and last evaluation use one strict `en-GB` browser-zone presentation with UTC fallback, signed age and semantic `<time dateTime>` output. Date-only compatible PriceSets keep date-only precision and invalid compatible values degrade to fixed copy; canonical timestamps still own storage, identity, ordering and freshness. D-102 removes full-PriceSet import from the topbar and Settings duplicates: one collapsed `Advanced PriceSet tools` disclosure under Market now explains complete replacement/non-merge semantics, the accepted JSON shape, generated high-alch authority and the separate `Manual item price` correction path before exposing export/import/reset. D-099 makes the disabled automatic refresh state explicit while retaining the writer and hardened workflow template outside `.github/workflows`. D-085 makes `prices.json`, `price-provenance.json` and version-2 `price-history.json` one validated logical set. D-086 derives all 49 active herb/gem/casket/ultra-rare dependencies from Trip valuation tables. D-087 admits twelve source-reviewed identified rows, so readiness is 39/49 mapped and the only remaining gaps are ten unsupported species-specific unidentified herbs on the visible generic-unid proxy path. The writer records accepted observations and preserves value-establishing origin/time/quality on retained attempts. Generated Revision 274 prices fill missing numeric ids only at runtime with explicit fallback metadata; generated high alch remains authoritative. Selected PriceSet and local comparison storage migrate from v1 to v2 without inventing observation times. Re-enabling automatic refresh requires a future explicit capacity decision and successful scheduled-run evidence before any scheduled-current claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Hiscores                     | `Valmis`       | Hiscores is required for v1 replacement. Rewrite UI has player input, same-origin status/lookup calls, validated browser adapter, preview and Apply flow for Attack, Strength, Defence, Hitpoints, Prayer, Ranged and Magic, with service-aware disabled copy instead of `run_sim.py` instructions. Preview and Apply are scoped to the normalized current Player input: changing to a different player clears the preview, late lookup responses for an old input are ignored, Apply rechecks freshness before mutating levels and the preview names the returned player, source and fetchedAt metadata from the validated response. Disabled and unavailable service states keep the player input visible, disable Lookup and direct users to the Player level fields as the working manual fallback without clearing manual levels. Compatible legacy `sim_hiscore_player` can be imported into the rewrite-owned last-player key. The repo-owned Vite dev/preview API boundary now injects a strict first-party 2004Scape JSON provider under D-061, with fixed-origin, redirect, timeout, response-size, schema and sanitized-error guards. D-065 fixes the player-query logging and retention policy, and D-066 implements the root-path Cloudflare Worker runtime with observability and Logpush disabled; D-067 accepts the repository implementation as complete; a future adopter must verify its own deployed routing, privacy and live lookup before claiming that instance is publicly live.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Legacy saved setup migration | `Valmis`       | The Legacy Migration V1 boundary is implemented in the rewrite UI. It detects known legacy browser storage keys, shows Import/Keep/Clear choices, displays a metadata-only outcome summary for importable/skipped/review-only areas and displays a per-key review table for every known legacy key with `migrate`, `review-only`, `intentional-reset` or `legacy-only` handling. Import keeps legacy data and stores only rewrite-owned dismissed/imported state; Keep dismisses without deletion; Clear removes only known legacy keys after explicit confirmation with the exact clear list shown. The import flow validates and imports compatible `sim_input_v3` active setup fields, nested `sim_input_v3.monsterSetups` into rewrite-owned monster-specific custom setup state, nested `sim_input_v3.cannonByMonster` into rewrite-owned per-monster cannon state, compatible nested `sim_input_v3.duelSetups` rows into rewrite-owned Duel snapshot state, `sim_hiscore_player`, current legacy price/alch maps as an explicit `PriceSet`, `sim_hidden_tiers_v1`, `sim_compare_sort_v1`/`sim_irrelevant_v1` and compatible `sim_loot_prefs_v1` drop-name preferences that resolve to unambiguous current monster row ids. Existing rewrite custom setup, cannon and Duel snapshot entries win over conflicting legacy rows. Invalid, oversized, unsafe map keys, unknown monster/item/gear ids and ambiguous names are skipped with visible sanitized reasons. D-048 keeps `sim_planner_v1` as intentional review-only/not-migrated V1 state, and D-049 keeps full legacy price-history payloads review-only/not migrated for V1; both are explicit V1 decisions, not ambiguous found-but-not-imported errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### 2026-07-21 specced release-readiness quality gaps

Every visible parent row remains `Valmis`. The code/document audit found six
separate correctness, feedback, accessibility, browser-evidence and resilience
gaps rather than six missing product features. None comes from an `Osittain
valmis` row: zero are partial-feature completions and all six are newly
identified quality gaps over accepted workflows.

The implementation order is:

1. [Implemented cross-tab local-state conflict protection](../technical/cross-tab-local-state-conflict-spec.md)
   prevents a healthy stale tab from silently replacing newer browser data. It composes the
   existing attention, Settings, Workspace backup and global Undo owners without changing any
   parent row's persistence schema or product status.
2. [Implemented browser file-export outcome feedback](../technical/file-export-outcome-feedback-spec.md)
   makes every existing export report only a truthful started/failed result.
3. [Implemented Duel-only legacy import readiness](../technical/duel-only-legacy-import-readiness-spec.md)
   connects the current saved-setup plan to its already implemented transaction.
4. [Automated assistive-technology accessibility foundation](../technical/assistive-technology-accessibility-spec.md)
   now owns the exact AT-01 through AT-12 manifest, coherent searchable-selector
   semantics, zero-finding axe checkpoints and 320 CSS-pixel / 200% text
   reflow evidence. The required VoiceOver/Safari and NVDA/browser manual rows
   remain `not run`, so the supported-release accessibility statement stays open.
5. [Implemented cross-browser release support](../technical/cross-browser-release-support-spec.md)
   retains the complete Chromium suite and adds the bounded CB-01 through
   CB-12 manifest in Firefox, desktop WebKit and mobile WebKit emulation. It
   does not claim branded Safari or physical iOS support.
6. [Implemented lazy pane loading and failure isolation](../technical/lazy-pane-loading-failure-isolation-spec.md)
   requests Compare initially and optional pane families on first activation,
   retains visited pane state, replaces blank waits with named status and keeps
   a pane or nested Workspace failure below the shared shell.

The first item is the most urgent because it protects data integrity across a
normal multi-tab use case. Without it, Setup, Planner, Loot, saved Duel setups,
prices, histories, preferences and Workspace-managed state can each remain
functionally complete in one tab while still being silently overwritten by an
older open tab. The other five improve trust and release evidence, but none
compensates for that data-loss risk.

### 2026-07-21 next specced product-finishing quality gaps

All 19 visible parent rows remain `Valmis`. A follow-up whole-product audit
identified six additional presentation, review, resilience and work-context
gaps over the accepted workflows. Zero are partial-feature completions, none
adds a provider/infrastructure dependency and none duplicates the still-open
manual VoiceOver/NVDA evidence gate.

The ordered implementation set is:

1. **Implemented 2026-07-21 · Critical · M:** [Result rate semantics](../technical/result-rate-semantics-spec.md)
   now keeps primary Result, Dense, saved setup, Trip and Planner decisions on
   the same sustained whole-cycle hourly basis. Stats retains explicitly
   labelled on-site diagnostics, while formulas and the existing
   composed-result fields remain unchanged.
2. **Implemented 2026-07-21 · High · M:** [Entity label collision disambiguation](../technical/entity-label-collision-disambiguation-spec.md)
   adds reviewed semantic descriptors for known collisions, exact-id fallback
   for uncertain meanings and unique accessible row context for repeated Loot
   entries without renaming, merging or recalculating source identities.
3. **Implemented 2026-07-21 · High · L:** [Setup transfer complete change review](../technical/setup-transfer-change-review-spec.md)
   gives setup files, shared links and saved-row Load exhaustive grouped
   `Current → Incoming` review through one form registry, with per-flow scope,
   stale/Refresh and synchronous Apply/Load protection. Existing parsing,
   compatibility, persistence, Dismiss and complete Undo remain intact.
4. **Implemented 2026-07-21 · High · M:** [Session-only exit protection and direct backup](../technical/session-only-exit-protection-spec.md)
   arms one bounded browser leave warning only after meaningful non-durable
   Workspace-area changes. The existing coherent export acknowledges exact
   included state from its typed request result; omitted sensitive Hiscores
   state, failures and later edits remain protected.
5. **Implemented 2026-07-21 · Medium · M:** [Transfer artifact scope and filename clarity](../technical/transfer-artifact-scope-filenames-spec.md)
   distinguishes combat setup, saved collection, PriceSet, full Workspace and
   metadata-only recovery artifacts before action. New exports share one
   contextual sortable bounded filename contract; old names still import by
   content and no format, transaction, persistence or Undo contract changed.
6. **Implemented 2026-07-21 · Medium · M:** [Workbench browser history and page context](../technical/workbench-browser-history-context-spec.md)
   makes allowlisted panes reloadable and Back/Forward-aware through a `pane`
   query parameter and names the active pane/target in the ready document title.
   Share/safe URL state composes unchanged, and the first-visit Compare default
   plus every persistence and transfer schema remain unchanged.

All six items are complete. The rate work keeps the underlying on-site
diagnostics available without mixing them into primary whole-Trip decisions,
and the final browser-context step remains presentation/session navigation only.

The directly executable implementation prompts, PF-03 split boundary,
dependencies, required checks and documentation state transitions are indexed
in [the product-finishing goal map](../project/goals/README.md).

### 2026-07-21 workbench browser context completion

Desktop workbench, keyboard navigation, mobile navigation and lazy pane loading
remain `Valmis`. The pure URL owner accepts only the existing 11-id allowlist,
preserves base paths plus unrelated query/hash state and formats the ready title
from trusted pane/target context. App owns one explicit activation-source path:
direct tab/keyboard/More choices and routed actions push only on change, history
never writes recursively and share Undo uses internal replace. The named
Chromium journey covers Planner deep link, retained state, two Back/Forward
round trips, reload, focus, 390 px More, invalid canonicalization and combined
pane/safe/share state. The release manifest passes 36/36 across Firefox and
desktop/mobile WebKit profiles; no branded-Safari, physical-iOS or manual
screen-reader claim was added.

### 2026-07-21 transfer artifact clarity completion

`Basic combat setup`, `Setup comparison`, `Market price sync`, Workspace backup
and local-state recovery remain `Valmis`. Their five existing JSON flows now
use the exact combat-setup, saved-collection, PriceSet, full-Workspace and
metadata-only-recovery action names with connected scope copy. One pure helper
generates bounded ASCII contextual filenames with the active revision where the
artifact owns it and one compact UTC instant; recovery does not invent a
revision. Existing envelope contents, parser selection, review transactions,
persistence and Undo did not change, and valid former fixed-name setup and
collection files remain importable by content.

### 2026-07-21 entity-label collision implementation

`Basic combat setup`, `Loot/economy summary`, `Market price sync` and `Planner`
remain `Valmis`. Their shared presentation now resolves collisions from the
explicit active snapshot: key halves and the four dragonhides use reviewed
semantic descriptors, all uncertain duplicate names use labelled exact ids and
same-named actionable rows receive source-fact context before a deterministic
ordinal. Search, keyboard selection, action names and compact/zoomed layouts use
the same prepared accessible identity. Generated names, exact ids, price
aliases, row math, persistence and the separate manual VoiceOver/NVDA gate are
unchanged.

### 2026-07-21 setup-transfer change-review completion

`Basic combat setup`, `Setup sharing` and `Setup comparison` remain `Valmis`.
A validated setup file opens a complete 13-group comparison over its six-family
scope. Shared links reuse the same eight form groups and add only incoming-target
cannon, exact Loot actions and loot settings. Saved-row Load reuses the form
registry while current target/cannon/loot/prices remain shared context and the
calculated Duel impact stays separate. Every flow exposes exact included and
excluded scope, semantic Current/Incoming values, applicable stale/Refresh and
a synchronous final guard; file/share PriceSet changes remain non-stale. No-op
actions cannot mutate or create Undo, and changed Apply/Load delegates to the
existing complete transaction and Undo. No envelope, parser, persistence
schema, compatibility rule or calculated formula changed.

### 2026-07-21 result rate semantics completion

`Result summary`, `Stats analysis`, `Dense spreadsheet view`, `Trip controls`,
`Planner` and `Setup comparison` remain `Valmis`. Result, mobile context, Dense,
saved setup, Trip and Planner primary hourly values now share the effective
whole-Trip basis. Stats and cannon source detail name their narrower values as
on-site diagnostics. Dense and saved setup presentation keeps visible values,
sorts, deltas and best markers on the same fields, while existing Dense sort
ids and all simulation, Planner, Risk and persistence contracts remain
unchanged.

### 2026-07-20 global Undo visibility and targeted Reset completion

`Basic combat setup`, `Result summary`, `Cannon` and `Loot/economy summary`
remain `Valmis`. The implemented
[global Undo and targeted Reset contract](../technical/global-undo-visibility-targeted-reset-spec.md)
keeps the existing single session-local Undo visible across desktop, compact
landscape and normal-flow mobile/portrait layouts. One visible polite owner now
suppresses duplicate global announcements, and all seven accepted Active
assumptions Reset classes plus mirrored pane entry points use the same
changed/no-op/restore rule. Manual overrides, Cannon, scarce spot, safespot and
hidden gear tiers gained the missing recovery while the two Loot paths retain
their existing exact owner behavior. Five-viewport production-preview evidence
proves reachability and horizontal containment; no reset target, history stack,
persisted Undo, storage schema or calculation changed.

### 2026-07-20 monster-specific changes management completion

`Basic combat setup`, `Dense spreadsheet view`, `Monster comparison`,
`Cannon` and `Loot/economy summary` remain `Valmis`. The implemented
[monster-specific changes management contract](../technical/monster-specific-changes-management-spec.md)
adds one searchable/filterable Settings union over the existing Custom setup,
Cannon, effective Loot action, Loot settings and Compare-hidden records,
including removable unavailable rows. Owner-specific Review selects the target
and focuses the current editor or Compare row. Review-gated one-monster cleanup
uses the Workspace-shared exact-preimage batch boundary and complete durable or
explicit session-only Undo; active Custom returns to same-target Default while
unrelated state is retained. No setup type, inline duplicate editor,
cross-monster wipe, storage schema or calculation path was added.

### Implemented local price-history lifecycle management follow-up

`Loot/economy summary` and `Market price sync` remain `Valmis`. The implemented
[local price-history lifecycle contract](../technical/local-price-history-lifecycle-management-spec.md)
exposes every existing browser-local comparison, its `N/20` capacity and the
exact next replacement under Economy Price history. It adds review-gated
one-point removal and full-capacity replacement through the implemented
exact-raw Economy Undo, while an accepted PriceSet at capacity remains accepted
without silently evicting history. Shared history stays read-only; history v2,
provenance, analysis formulas, Workspace transfer and provider policy remain
unchanged. The separate
[price date and time presentation contract](../technical/price-date-time-presentation-spec.md)
owns the visible timestamp follow-up.

### Implemented complete and actionable Planner notices follow-up

`Planner`, `Trip controls`, `Loot/economy summary` and `Market price sync`
remain `Valmis`. The implemented
[Planner warning completeness and actions contract](../technical/planner-warning-completeness-actions-spec.md)
preserves every distinct structured notice through the calculation Worker,
includes start, displayed-step and training-stance warning contexts, exposes
the existing truncated-plan truth as an issue and removes the former
four-message display cap. One native disclosure distinguishes issues from
notes and current output from a retained previous plan; each row routes by structured
code and item identity to the closest existing Planner, Loadout, Economy or
Trip review target. The work adds no formula, automatic edit or Recompute,
warning acknowledgement, persistence schema, provider or backend.

### Implemented saved setup Merge and rename safety follow-up

`Setup comparison` remains `Valmis`. The implemented
[saved setup Merge and rename safety contract](../technical/saved-setup-merge-rename-safety-spec.md)
replaces the former count-only incoming-ID-wins file Apply with a complete
per-row review: unchanged rows remain fixed, matching IDs default to Keep and
require explicit Replace, additions consume selected capacity and conflicting
recipient names must be resolved. Direct rename uses explicit Save/Cancel
instead of blur commit, while changed Merge/rename is one durability-aware
single-key transaction with complete Undo and stale-value protection. Duel v1
storage/file schemas, the 12-row cap, context/compatibility validation,
Workspace and legacy Merge policy, calculations and account/server scope remain
unchanged.

### Specced user-friendly price dates and times follow-up

`Market price sync` and `Loot/economy summary` remain `Valmis`. The proposed
[price date and time presentation contract](../technical/price-date-time-presentation-spec.md)
will replace raw ISO and sliced date output with semantic English `en-GB`
browser-local dates, explicit short time zones for instants, signed relative
age and accessible `<time>` markup. Snapshot capture/PriceSet creation, item
observation, refresh evaluation and manual update remain separately labelled;
date-only values never invent a time or zone. The same contract covers Market,
the compact Settings summary, manual-price detail, selected provenance, shared
and local history summaries, trend points and Loot history context without
changing schemas, timestamps, freshness policy, price formulas, providers,
persistence or backend scope.

### 2026-07-20 mobile result and navigation completion note

`Basic combat setup`, `Result summary` and `Keyboard navigation` remain
`Valmis`. Normal-flow mobile/portrait presentation now reuses the current
three `contextMetrics` directly after Player setup, keeps New/Edit/Remove/Reset
on one 40-pixel-high four-column row and exposes all eleven workbench tabs
through measured boundary arrows plus a `WORKBENCH_TABS`-derived More list.
The 390 × 844-, 620 × 844- and 768 × 1024-browser matrix proves result updates,
one tablist/tabpanel, active-tab reveal, Home/End/arrows, 12/14-pixel text
minimums and horizontal containment. This is dated responsive evidence for the
three existing rows, not a new feature, calculation or persistence surface.

### 2026-07-20 Economy destructive-action Undo completion note

`Market price sync`, manual item prices, `Loot/economy summary`, local price
history and Workspace backup/restore remain `Valmis`. Confirmed local-history
clear, manual item reset, base-price-equivalent Apply, confirmed clear-all and
confirmed imported PriceSet reset now use the existing single global Undo.
Durable Undo restores the exact prior raw string or missing key only after a
post-action byte comparison; safe-session, storage failure and cross-tab drift
restore live state only and leave saved data untouched with truthful copy.
Unavailable manual rows, shared history, generated high alch and unrelated
storage remain isolated. This adds recovery to existing rows without a new
feature family, key, schema, backend or persisted Undo history.

### 2026-07-18 local-state attention completion note

Existing browser-local setup, Planner, Loot, Duel, price and Hiscores workflows
remain `Valmis`. One non-dismissible ready-shell notice now distinguishes saved
data that could not load from changes that may not persist, exposes only the
allowlisted health-report count and at most three labels, and moves Review focus
to the detailed Settings recovery heading. Clear, replacement, blocking,
current-session fallback and D-016/D-030 no-silent-migration behavior remain
owned by the existing recovery controller.

### 2026-07-18 setup replacement completion note

Basic setup import/export and setup comparison remain `Valmis`. Selecting an
external rewrite setup now prepares one validated in-memory candidate and
shows resolved metadata before any write or live mutation; Dismiss leaves the
current and persisted setup untouched. Explicit Apply replaces the active
form, default form, setup mode, custom setups, Dense preferences and cannon
settings together, and both imported Apply and saved-row Load now expose the
existing one-step Undo over a complete prior rewrite setup. Undo persists when
available and reports a session-only restore when it is not. The setup export,
rewrite persistence and saved-setup collection schemas remain unchanged.

### 2026-07-18 numeric input completion note

Player, Trip, Cannon, Risk, Loot, Planner, manual-price and manual combat
override workflows remain `Valmis`. Their shared numeric fields now keep the
literal edit draft separate from the last accepted calculation value, reject
malformed, out-of-range and off-step text visibly without clamping or rounding,
and share Enter/blur, Escape, optional Reset and external-update behavior.
Only accepted finite values or an explicitly committed optional empty value
reach application state and persistence. Existing ranges, defaults, schemas,
domain formulas and calculated outputs are unchanged.

### 2026-07-19 Planner XP and target integrity completion note

Planner remains `Valmis` with its version-1 storage and explicit
`Recompute plan` boundary. Stored Current XP zero now appears as Auto at the
canonical live-level floor instead of literal zero; an explicit value is valid
only inside that level's inclusive XP interval, with level 99 accepting up to
200,000,000. Manual, setup, share, saved-load, Hiscores and Undo level changes
reconcile incompatible XP to Auto and raise unlocked lower targets, while a
locked target remains a visible inactive saved preference. Every skill row
states the next plan's effective start XP and target, and dirty output states
that it still uses the last recomputed inputs. The XP curve, Planner search,
scoring, gear, Trip policy, worker protocol and persistence schema are
unchanged.

### 2026-07-19 Duel matrix lifecycle completion note

Setup comparison remains `Valmis` and its all-monster calculation stays
explicitly on demand. The matrix now distinguishes not built, building,
current, stale and failed states; a fixed visible failure offers Retry without
exposing Worker details. The latest successful table remains available during
rebuilds, source changes and failed refreshes only with an explicit previous-
result label, while strict form, saved-setup, context, cannon and loot-source
identity decides whether output is current. Obsolete tasks are cancelled,
late results are ignored and removing the final saved setup clears the matrix
session. Comparison formulas, filtering, sorting, Worker protocol and all
persistence schemas are unchanged.

### 2026-07-19 Dense, Planner and Risk calculation lifecycle completion note

Dense spreadsheet, Planner and Risk remain `Valmis`. Their Worker-backed paths
now share explicit idle, building, ready, stale and failed presentation while
retaining their existing automatic/debounced, explicit-Recompute and explicit-
Run trigger rules. A first failure shows fixed visible copy and Retry; a failed
refresh keeps the latest successful rows, plan or risk result only as labelled
previous output. Exact source and task identity cancel obsolete work and reject
late settlement, and only a ready Risk result reaches the compact cross-pane
bridges. Formulas, request/result protocol, filters, sorts, controls and all
persistence schemas are unchanged.

### 2026-07-19 game revision presentation completion note

Source-backed game data remains one accepted `Valmis` runtime rather than a
revision-selection feature. The raw generator now requires an explicit bounded
game revision and writes one matching revision/source/commit/generated-at
context across the generated snapshot, source pin and impact evidence. Root
bootstrap/readiness requires that context. Every ready shell identifies
`Revision 274`, and Settings shows the sanitized snapshot/source detail plus
the rule that active PriceSet pricing stays separate. Historical runtime
loading, source fetching and revision switching remain excluded. Carrying this
context through setup, saved-setup and share transfers is completed by the
following transfer note.

### 2026-07-19 contextual setup transfer completion note

Basic setup import/export, setup comparison and setup sharing remain `Valmis`.
New rewrite setup and saved-setup files use dedicated external envelopes with
Revision 274 plus exact snapshot id, while their browser-local version 3 and
version 1 states remain unchanged. Older supported files remain reviewable as
context unknown. Saved-setup parsing shows add/update/limit effects before an
explicit Merge, and setup replacement still uses the complete Apply/Undo
transaction. New share links are version 2; version 1 links remain readable
without inferring a revision from a different id. Every context class still
runs active entity compatibility checks, uses the recipient's current runtime
and PriceSet and excludes prices, player identity, computed output and raw
source provenance.

### 2026-07-19 contextual item-price correction completion note

`Result summary`, `Loot/economy summary` and `Market price sync` remain
`Valmis`. D-101's exact item identities now drive stable typed actions in
compact Result, row/nested Loot and complete Economy price notices. One
App-owned latest-request-wins transition revalidates D-090's active item set,
opens Economy, selects the exact correctable item and focuses `Manual price`;
inspect-only targets focus their exact disclosure action. A single actionable
Result issue may use the direct route, while multiple issues retain aggregate
review without an implicit selection. Apply/Reset identify item, value and
manual/base current-result use. D-090 still owns the separate manual overlay,
D-102 keeps full-PriceSet transfer separate and price formulas, provenance,
storage, history and generated high alch stay unchanged.

### 2026-07-12 Loot and manual-price completion note

`Loot/economy summary` and `Market price sync` remain `Valmis`. D-089 groups
the existing inactive D-072 quest/clue rows into one collapsed `Conditional
drops` disclosure while preserving source chance, sanitized eligibility,
locked Skip and zero calculation effects. D-090 adds removable item-level local
price corrections over the resolved base PriceSet, with truthful manual
provenance, one-item reset, confirmed clear-all and local-state recovery. High
alch, shared history and the base PriceSet stay unchanged; `Save local
comparison` remains the only action that records an active manual value into
local history. A base that temporarily lacks a stored item leaves that override
visible as unavailable and inactive, and restoring a compatible base reactivates
it without moving an uncommitted draft between item selectors.

### 2026-07-12 Hit distribution note

The active Melee/Ranged/Magic setup now ends with a `Damage distribution`
section that replaces the tall horizontal normal-hit bucket list with an exact
vertical discrete chart. Miss and an accurate zero are separate, normal attack
uses filled bars, and a separately selected spec weapon adds a patterned
whole-special comparison under D-083. Expected-damage markers, exact and
cumulative focus/hover values, an on-demand accessible table and full-target-HP
KO context use the same probability series. Per-special-hit and
per-fired-cannonball source-detail histograms remain explicitly scoped under
D-069 in Stats, and long exact domains scroll only inside the chart.

### 2026-07-11 rewrite reliability note

The cross-project rewrite audit did not add or reopen a feature row. Existing
`Valmis` workflows keep that status because the changes harden their current
implementation: setup and Duel recovery now reject ambiguous or
current-game-data-incompatible state without overwriting it, browser/state/API
JSON boundaries are bounded and fail closed, and heavy Dense Compare, Planner
and on-demand Duel matrix calculations run through a cancellable worker. Dense
sort/filter/marker presentation remains synchronous over completed rows, so UI
preference edits do not recompute all monsters. Formulas, visible feature scope,
`SimulationRequest`, auth, database, tenant, provider and deployment decisions
did not change; these are reliability/performance fixes rather than duplicate
features.

D-081 refines the existing Trip, Stats and Risk rows without adding a new
feature or persisted setup field. Revision 274 now provides 55 exact and eight
partial typed NPC incoming-attack classifications. Trip exposes one normalized
descriptor and the visible `Source-backed`, `Partial model` or
`Compatibility fallback` label; Stats repeats that status, while Risk samples
only exact descriptors and reports partial/fallback contributions as mean-only.
Dragonfire and poison retain their existing separate Trip ownership.

### 2026-07-20 Hiscores Apply Undo completion note

Hiscores remains `Valmis`: lookup, preview, normalized-player freshness and
Apply are implemented. The completed
[Hiscores Apply Undo follow-up](../technical/hiscores-apply-undo-spec.md) adds
one exact pre-Apply form snapshot and the existing global one-step Undo. Stale
and zero-change attempts cannot replace a useful pending action, the current
preview follows Apply and Undo, and Planner reconciles both transitions while
leaving the provider, API, preview, persistence schemas and Planner's existing
XP/target reconciliation contract unchanged.

## Planned extensions

| Feature                      | Rewrite status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup sharing                | `Valmis`       | The root rewrite implements the static URL-fragment workflow in the [shareable setup permalink specification](../technical/shareable-setup-permalink-spec.md), extended by the contextual transfer contract. `Share setup` creates a bounded version 2 base64url link from validated Revision 274 context, active form and current-monster Cannon/loot choices; version 1 remains readable with exact-id or unknown-revision normalization. The recipient reviews all eight form groups plus incoming-target Cannon, exact source-labelled Loot actions and Loot settings before explicit Load. Included-scope changes require Refresh and a synchronous guard blocks raced Load; PriceSet-only changes remain non-stale and no-op disables Load. Dismiss clears the candidate and changed Load retains one complete in-memory Undo. Strict size/schema/duplicate-key/entity checks and sanitized errors protect both versions. Prices, player name, history, custom/Duel collections, computed output and raw provenance remain excluded, and clipboard failure keeps the URL selectable. No backend, account, database, provider or production domain is required. |
| Workspace backup and restore | `Valmis`       | The root rewrite implements the complete local workflow in [the Workspace specification](../technical/workspace-backup-restore-spec.md): a bounded Revision-aware nine-area file, two-sided Hiscores opt-in, zero-mutation Review, typed Replace/Merge effects, selected-only logical atomic Apply with exact handled-failure rollback, explicit session-only recovery and one complete durable/session-only Undo. Legacy-migration dismissal is never transferred and the metadata-only recovery report remains distinct. This is user-controlled local file durability, not crash-atomic storage, account, database, server or cross-device synchronization.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

The implemented repository-local visual regression suite is tracked as
test/release evidence in
[visual-regression-spec.md](../technical/visual-regression-spec.md), not as a
user-visible feature row. Making it a remote merge gate remains an open CI
decision.

## Maintenance rule

Update this file when a visible workflow is added, removed, intentionally scoped down or accepted as a legacy-only behavior.

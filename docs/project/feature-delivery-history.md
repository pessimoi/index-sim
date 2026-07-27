# Feature delivery history

- Status: historical
- Date: 2026-07-27
- Owner: product delivery evidence
- Evidence: verified
- Contract: closed

These completion notes were extracted from the living feature inventory
during DOCS-01. Their wording and dates are retained as historical delivery
evidence. Current feature status remains in
[the feature inventory](../product/feature-inventory.md).

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

The ordered implementation set is complete:

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

### 2026-07-22 release-polish specifications

All 19 visible parent rows remain `Valmis`. A release-polish audit identified
six implementation-ready quality gaps in discoverability, feedback, mobile
navigation, Undo consistency, table affordance and fallback readability. Zero
are partial-feature completions, none adds provider or infrastructure scope and
none duplicates the open manual VoiceOver/NVDA evidence gate.

The ordered implementation set is complete:

1. **Implemented 2026-07-22 · Critical · M:** [Workspace backup discoverability](../technical/release-polish-workspace-backup-discoverability-spec.md)
   keeps the complete backup in the existing Settings owner without changing
   setup or Workspace envelopes. A 2026-07-23 placement revision removed the
   space-heavy permanent header duplicate while retaining accessible setup-file
   scope guidance.
2. **Implemented 2026-07-22 · High · M:** [Visible action feedback](../technical/release-polish-visible-action-feedback-spec.md)
   adds visible, deduplicated outcomes for action paths that previously only
   updated the visually hidden global status.
3. **Implemented 2026-07-22 · High · M:** [Mobile MonsterCard navigation loop](../technical/release-polish-mobile-monstercard-loop-spec.md)
   adds a mobile Compare-to-Monster-details jump and return path while
   preserving accepted pane order.
4. **Implemented 2026-07-22 · High · M:** [Recommendation and optimizer Undo](../technical/release-polish-recommendation-optimizer-undo-spec.md)
   gives Trip recommendations, Loot optimizer and Loadout optimizer one
   changed/no-op/Undo contract.
5. **Implemented 2026-07-22 · High · M:** [Wide table discoverability](../technical/release-polish-wide-table-discoverability-spec.md)
   adds overflow cues and sticky identity behavior for narrow wide-table
   workflows without changing table content or calculations.
6. **Implemented 2026-07-22 · Medium · S:** [Hiscores fallback readability](../technical/release-polish-hiscores-fallback-readability-spec.md)
   makes Hiscores disabled/error fallback copy readable and directly routes to
   manual Player level editing.

The 26 first-mismatch Darwin pairs were reviewed before the initial candidate
write and all 37 tracked current-vs-HEAD pairs before final acceptance. One
nested Loot-mobile sticky-cell occlusion was fixed before acceptance, and two
complete read-only visual runs pass 26/26. The release-polish round is complete;
manual VoiceOver/NVDA evidence remains a separate open gate.

Execution slicing, required checks and implementation evidence are indexed in
[the product-finishing goal map](../project/goals/README.md), with completion
status summarized in
[the backlog](../project/backlog-history.md#2026-07-22-release-polish-specifications).

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

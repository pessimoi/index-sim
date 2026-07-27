# User-facing language, units and information hierarchy specification

- Status: implemented
- Date: 2026-07-19
- Owner: technical documentation
- Evidence: verified
- Contract: closed

Decision context: this specification extends D-077 compact readability and
D-102 PriceSet surface consolidation. It does not reopen either decision or
change the calculation, data, persistence or PriceSet transaction contracts.

Priority: medium. Estimated implementation size: M.

Primary dependencies:

- `GameDataSnapshot` item and monster name fields;
- Economy, Loot, MonsterCard and Settings presentation models;
- Cannon, Trip, Loadout, Dense Compare and compact-shell semantic labels; and
- current responsive contracts and reviewed visual baselines.

## Implementation evidence

- `src/app/view-models/presentation-language.ts` owns the focused typed
  source-first entity-label, compact accessible-label and semantic-unit
  contracts. Domain, generated-data and persistence schemas remain unchanged.
- Loot, Economy and MonsterCard render source/snapshot names as primary copy and
  keep exact Item ID, Monster ID, Loot row ID and Tag values in labelled native
  disclosures with selectable `code` text. PriceSet/history-only ids receive a
  classified deterministic fallback and remain searchable by exact id.
- Shared fields, metric presenters and dense headers preserve accepted compact
  visible tokens while exposing full semantic names. Source monster speed stays
  in game ticks; player speed and Cannon/Trip respawn stay in seconds.
- Settings renders one short active PriceSet summary. Economy alone renders the
  detailed Market surface, and the typed review intent changes only the active
  tab and post-render heading focus.
- Focused and complete unit/component/browser coverage owns label precedence,
  technical identity, units, compact semantics, Settings/Economy hierarchy and
  unchanged price transactions. The reviewed Darwin update changed 15 expected
  fixture screenshots; the following read-only matrix passes 20/20 across all
  31 baselines with no clipping, widening, control loss or numeric change. The
  complete functional Chromium matrix passes 98/98, and `npm run verify` passes
  94 files / 935 tests plus 19 goldens, typecheck, architecture, build/artifact,
  lint, formatting and diff checks.

## Purpose

Finish the presentation semantics of the existing root Vite rewrite so that it
reads as an end-user tool instead of exposing implementation vocabulary as
primary content.

The implementation has four bounded goals:

1. show source-backed human-readable item and monster names as primary labels;
2. make seconds, minutes, game ticks, GP and XP unambiguous in visible and
   accessible output;
3. give compact abbreviations an expanded accessible meaning without widening
   the accepted dense layout; and
4. remove the remaining Settings/Economy price-information duplication.

This is a presentation-only finishing pass. Existing numeric values, formulas,
entity ids, PriceSet contents and state transitions remain unchanged.

## Feature-inventory check

- `Compact text readability` remains `Valmis` under D-077. That decision owns
  clipping, semantic control widths, selected-value titles and wrapping. It
  does not define the meaning of units or compact abbreviations.
- `Loot/economy summary` remains `Valmis`. The existing action, composition,
  nested-loot, price-note and history workflows remain in place.
- `Market price sync` remains `Valmis` for the accepted committed/imported/manual
  price paths. D-102 owns the single advanced full-PriceSet workflow in Market;
  it does not require Settings to repeat Market diagnostics.
- MonsterCard, Cannon, Trip, Dense Compare and the compact setup strip remain
  current implemented workflows. This specification changes their presentation
  semantics only where units, abbreviations or technical ids are unclear.

No feature status changes when this specification is implemented. The work is
a release-quality refinement of already accepted workflows.

## Why this work is timely

The gaps do not change calculation correctness, but they directly affect
whether the application reads as a finished user tool or as a developer-facing
diagnostic surface. The source names, typed timing fields, established Economy
owner and visual baselines already exist, so the remaining work is bounded and
can be verified without introducing a new data or architecture foundation.

## Verified pre-implementation gaps

The implementation evidence above closes this snapshot. The bullets below are
retained as the inspected before-state that motivated the bounded change, not
as claims about the current production path.

The following behavior was present in the inspected pre-implementation path:

- `GameDataSnapshot.items[*].name` and `monsters[*].name` are required validated
  source fields, and `createPriceItemLabels()` already exposes item names.
  Nevertheless, several fallbacks and pane templates render a canonical id as
  ordinary secondary text.
- Loot shows `row.key`, `row.tag` or `row.rowId` under every primary drop name.
  Nested and conditional rows also expose keys directly in their normal table
  content. Values such as `uncut_dragonstone` and `rune_spear` therefore read as
  user content instead of technical identity.
- Economy mover rows render a human name followed immediately by `Item ID`, the
  selected-item provenance summary starts from the raw id, and price-note rows
  append an id to their normal footer.
- MonsterCard renders the monster id beneath the source-backed name. Its
  `attackSpeed` source stat is shown as a bare number even though the source
  value is in game ticks. The separate player setup overview correctly derives
  seconds, but uses a compact `2.4s` value.
- Cannon labels its numeric input only `Respawn`, while Trip labels the same
  concept `Respawn sec`. Manual attack-speed input uses `Attack speed sec`.
- Dense and compact surfaces use labels such as `GP/KL`, `F/KL`, `XP/HR`,
  `TTK`, `ACC+`, `DMG+` and `SPD` without one shared expansion contract.
- Settings renders a detailed scheduled-price summary and active PriceSet
  summary in `Price data`, then immediately renders the shared `Market` section
  with substantially the same scheduled and active information. Economy is
  already the owner of Market administration and analysis.
- Focused component and browser tests currently assert parts of the duplicated
  summaries and visible technical-id copy, so the intended semantic change must
  update those assertions deliberately rather than weakening them.

## User-facing entity-label contract

### Source-name precedence

Primary item and monster labels use this order:

1. the validated `name` field from the active `GameDataSnapshot`;
2. the source-backed row name already carried by a loot or history presentation
   record; and
3. a presentation-only humanized fallback when an imported or historical id is
   not present in the active snapshot.

The fallback replaces underscores with spaces and applies sentence-style
capitalization. It must be marked internally as a fallback so a view can expose
`Source name unavailable` in technical details. It must not be persisted,
written into generated data or presented as source provenance.

Do not use an id as a primary label merely because lookup failed. Do not replace
a valid source name with title-cased id text. Searches may continue matching
both name and id.

### Presentation shape

The app presentation layer should expose one small typed label contract with
equivalent meaning to:

```ts
interface EntityDisplayLabel {
  name: string;
  technicalId: string | null;
  source: "game-data" | "row-source" | "fallback";
}
```

The exact interface and helper names may differ. The contract belongs in
`src/app/view-models`; it must not enter domain, generated-data or persistence
schemas.

View models pass `name` and technical identity separately. Components must not
reconstruct a visible name from an id, and a generic React presenter must not
read `GameDataSnapshot` directly.

### Technical identity disclosure

Canonical ids remain available for support, reproducibility and copy/paste, but
they are secondary technical information:

- use a native collapsed `details` disclosure named `Technical details` or an
  existing row disclosure with a clearly labelled technical subsection;
- render each value as labelled `dl` content and selectable `code` text;
- distinguish `Item ID`, `Monster ID`, `Loot row ID` and `Tag` rather than
  combining them into one ambiguous fallback string;
- omit absent fields instead of showing a second synthetic identifier; and
- identify a presentation fallback with `Source name unavailable` without
  suggesting that the humanized text came from game data.

A new clipboard API, copy toast or persisted disclosure state is not required.
Selectable `code` inside the native disclosure satisfies the bounded copy path.
Technical ids must not be hidden only in `title`, CSS-generated content or an
unlabelled icon.

### Surface requirements

#### Loot

- The drop name remains the only always-visible identity in ordinary and
  conditional drop rows.
- Remove always-visible `row.key`, `row.tag` and `row.rowId` sublines.
- Add item id, row id and tag to the existing `Value details`/nested detail
  panel under a `Technical details` subsection.
- Nested rows show their source-backed `name` as the primary cell. Replace the
  always-visible key/tag column with a compact technical disclosure in that row
  or move the values into the parent row's technical detail list.
- Price-note copy uses the resolved item name. An optional item id belongs in
  the same technical subsection, not in the ordinary note footer.
- Sorting, action selection, price-note association and row identity continue
  to use the unchanged canonical ids internally.

#### Economy

- Manual-price, trend, mover, provenance and price-note primary content uses
  `GameDataSnapshot.items[*].name` through the shared view-model label map.
- Mover rows no longer show `Item ID: ...` as always-visible secondary copy.
- Selected-item provenance shows the human-readable item name in its normal
  summary. Its id and metadata keys are available in technical details.
- An imported or historical PriceSet-only id remains searchable by its raw id,
  receives a clearly marked humanized fallback label and preserves the exact id
  in technical details.
- Full PriceSet file-format help may continue to use canonical ids because that
  disclosure is explicitly a technical transfer workflow under D-102.

#### MonsterCard and monster choices

- The source-backed monster name remains the card heading and option label.
- Remove the always-visible monster-id subtitle. Put the id in one collapsed
  card-level `Technical details` disclosure.
- Searchable monster controls continue matching the id as a hidden search term;
  the closed trigger and option name remain human-readable.
- Weapon, ammo, spell and ring labels use their source names. A missing
  presentation lookup uses the same marked fallback rule rather than exposing
  the id as ordinary setup copy.

## Units and abbreviations

### General rules

- A number with a value suffix uses a space before the unit: `2.4 s`, `6 ticks`,
  `500 GP` and `30 XP`.
- A rate whose label or column header already owns the unit keeps a bare numeric
  value. Do not render `Net GP/hr 500 GP/hr`.
- Percentages retain the compact `12.5%` form.
- GP and XP stay uppercase in visible UI copy. Lowercase `gp` and `xp` are
  reserved for code identifiers, not user-facing units.
- A source monster `attackSpeed` value is in game ticks. It is not a seconds
  value and must render as `1 tick` or `N ticks`.
- Derived player `attackSpeedSec`, Trip respawn state and Cannon respawn state
  are seconds. Their input labels name seconds explicitly.
- Minute, hour and day age/duration output must not use an unexplained single
  letter. Prefer visible `min`, `hr` and `day`/`days`; dense output may retain a
  shorter token only with the expanded accessible text below.
- Missing and unlimited values retain the current `-` and `unlimited` semantics;
  do not append a misleading unit to either.

### Compact-label map

The compact visual form may remain where width is constrained, but every use
must expose the corresponding expanded accessible text.

| Visible compact form     | Expanded accessible meaning                        |
| ------------------------ | -------------------------------------------------- |
| `HP`                     | Hitpoints                                          |
| `ACC`, `ACC+`            | Accuracy; accuracy bonus where used as an override |
| `M+%`                    | Magic accuracy percentage bonus                    |
| `DMG`, `DMG+`            | Damage; damage bonus where used as an override     |
| `DMG%`                   | Magic damage percentage bonus                      |
| `SPD`                    | Attack speed in seconds                            |
| `HIT %`                  | Hit chance percentage                              |
| `MAX`                    | Maximum hit                                        |
| `DPS`                    | Damage per second                                  |
| `TTK`                    | Time to kill                                       |
| `K/HR`, `K/hr`           | Kills per hour                                     |
| `XP/HR`, `XP/hr`         | Experience points per hour                         |
| `XP/KL`, `XP/kill`       | Experience points per kill                         |
| `GP/KL`, `GP/kill`       | Gold pieces per kill                               |
| `GP/HR`, `GP/hr`         | Gold pieces per hour                               |
| `NET GP/HR`, `Net GP/hr` | Net gold pieces per hour                           |
| `F/KL`                   | Food per kill                                      |
| `EV`, `EV/kill`          | Expected value; expected value per kill            |
| `s`, `sec`               | Seconds                                            |
| `min`                    | Minutes                                            |
| `hr`                     | Hours or per hour according to context             |
| `tick`, `ticks`          | Game tick or game ticks                            |
| `GP`                     | Gold pieces                                        |
| `XP`                     | Experience points                                  |

This is a presentation map, not a glossary of domain formulas. `KL` continues
to mean one kill in the accepted compact layout; it must never be announced as
the letters K-L.

### Accessible rendering

Use native labels and existing `.visually-hidden` support rather than a new
tooltip framework:

- input labels should be self-explanatory visible text where space permits,
  for example `Respawn (seconds)` and `Attack speed (seconds)`;
- a compact control may keep `SPD` or `F/KL`, but its associated input/output
  receives the complete accessible name;
- sortable compact table headers keep their short visible token while the
  button name is, for example, `Sort by gold pieces per kill`;
- read-only metrics expose a combined accessible label such as
  `Food per kill: 1.25` when the visible label is `F/KL`; and
- visible unit values that remain abbreviated expose full accessible value text,
  for example visible `2.4 s` with accessible `2.4 seconds`.

Do not rely on `title` alone. A native title may supplement mouse discovery,
but the expanded meaning must be present in the accessibility tree. Avoid
announcing both the compact token and expansion twice.

### Required corrections in the named surfaces

- MonsterCard source stat: `Attack speed` plus `6 ticks`, with an accessible
  value of `6 game ticks`.
- MonsterCard setup overview: `Attack speed` plus `2.4 s`, with seconds in the
  accessible value. Do not call this tick-based source data.
- Cannon and Trip inputs: use the same visible `Respawn (seconds)` label.
- Manual player speed override: use `Attack speed (seconds)` in the full Loadout
  field. The compact `SPD` control keeps its short visual label and receives the
  expanded accessible name.
- Price ages use explicit minute/hour/day tokens and expanded accessible text.
- Loot detail strings use uppercase `GP` and `XP`, including `GP/item`,
  `GP/kill`, `XP/kill` and expected-value detail.
- Dense Compare and the compact setup strip apply the compact-label map without
  increasing the accepted visual column labels.

## Settings and Economy information hierarchy

### Settings summary

Settings keeps one short `Price data` card containing only:

- active PriceSet label;
- active source label, including the manual-override count when active;
- active PriceSet age; and
- one `Review in Economy` action.

The card may retain one availability/status pill. It does not render scheduled
snapshot metadata, item/alch counts, provenance counts, fallback text, price
history controls or full-PriceSet transfer controls.

The `Calculation context` note should say only that setup transfers do not
include prices; it must not become a second active-PriceSet summary.

`Review in Economy` activates the existing Economy workbench tab and moves
focus to the `Market` heading after render. The action changes no data, does not
open `Advanced PriceSet tools` or `Price data notes`, does not alter the URL and
is not persisted.

### Economy ownership

Economy remains the sole detailed price-data owner and retains:

- scheduled snapshot status and diagnostics;
- complete active PriceSet metadata and provenance counts;
- automatic-refresh-disabled explanation;
- manual item prices;
- the D-102 `Advanced PriceSet tools` disclosure;
- save/clear local comparison actions;
- complete current-result price notes; and
- history summary, movers, trend and selected-item provenance.

The shared `Market` section renders only when Economy is active. Settings must
not expose it below its short summary. `EconomySettingsPane` may remain the
shared pure pane family; this requirement changes conditional composition, not
state or transaction ownership.

This specification supersedes only the earlier presentation requirement that
Settings repeat price/alch counts and scheduled diagnostics. D-102's one
advanced Market workflow, PriceSet controller behavior and Settings gear/local
state responsibilities remain unchanged.

## Ownership and implementation boundaries

### View models

- `src/app/view-models/price-data.ts`
  - continue to build the `GameDataSnapshot` item-name map;
  - return human label and technical id separately for manual price, history,
    mover, selected-provenance and price-note presentation;
  - centralize only the bounded fallback-name behavior needed by price data.
- `src/app/view-models/loot.ts`
  - retain source drop names and expose technical keys/tags/row ids separately;
  - use uppercase unit copy and the shared semantic unit formatter where
    applicable.
- `src/app/view-models/monster-card.ts`
  - distinguish tick-based monster source speed from seconds-based player setup
    speed in the presentation contract;
  - apply source-name/fallback rules to named setup selections.
- `src/app/view-models/settings.ts` or the existing composed price-data model
  - expose only the fields needed for the short Settings PriceSet summary;
  - do not duplicate PriceSet state or derive a second source-of-truth object.
- `src/app/view-models/formatting.ts` and one focused presentation-language
  module
  - own pure visible/accessibility text for the accepted unit and abbreviation
    map;
  - remain DOM-free and calculation-free.

Do not create a catch-all localization framework, domain-level label registry
or duplicate item-name cache. The active snapshot and existing view models are
the sources.

### Components

- `src/app/components/panes/loot-pane.tsx` and
  `economy-settings-pane.tsx` render human labels first and native technical
  disclosures second.
- `monster-card-panel.tsx` renders tick/second semantics and the monster-id
  disclosure.
- `cannon-pane.tsx`, `trip-pane.tsx`, `loadout-pane.tsx`,
  `compare-pane.tsx` and `workbench-shell.tsx` consume the bounded unit and
  abbreviation presentation contract.
- Shared field/presenter APIs may gain optional visible/accessibility label
  props. Existing consumers without compact abbreviations must retain their
  current accessible names.
- `App.tsx` owns only the Settings-to-Economy tab/focus transaction and existing
  model composition. It does not resolve names or format units inline.
- `src/app/styles.css` may add only technical-disclosure, compact semantic-label
  and responsive wrapping rules needed by the target markup.

### Preserved sources of truth

- `GameDataSnapshot` owns item and monster source names and raw monster attack
  speed ticks.
- Combat owns `TICK_SECONDS` and all attack-speed calculation/conversion.
- Trip/Cannon state continues to store respawn seconds.
- `PriceSet` owns numeric prices, source metadata and active/fallback selection.
- Existing view models remain the only adapters from domain/state values to UI
  presentation.

No presenter may convert the MonsterCard source tick value to seconds and then
present it as the source stat. No unit helper may round or mutate a number before
the existing feature formatter has selected its accepted precision.

## State, data and security boundaries

The implementation adds no new persisted or external contract:

- no `GameDataSnapshot`, `PriceSet`, setup, history or localStorage schema
  changes;
- no generated-data rewrite, id migration or alias-map change;
- no combat, Trip, loot, economy, Planner, Risk or Cannon formula change;
- no backend, database, auth, provider, network or deployment change;
- no clipboard permission or remote label lookup;
- no raw imported file content, local path or unbounded parser detail in the
  technical disclosures; and
- no locale selector or translation catalog.

The current product language remains English. “User-facing language” in this
specification means clear presentation vocabulary, not Finnish localization or
multi-language support.

## Implementation sequence

### Phase 1 - freeze semantic contracts

1. Add focused tests for the currently ambiguous MonsterCard speed, Cannon/Trip
   respawn labels, compact abbreviations, visible item ids and duplicated
   Settings/Market summaries.
2. Introduce the pure entity-label and semantic-unit/abbreviation presentation
   shapes without changing rendered output.
3. Inventory every production `src/app` use of the compact-label map so no
   affected context is silently left unexplained.

### Phase 2 - humanize entity presentation

1. Adapt Loot, Economy and MonsterCard view models to return source name and
   technical identity separately.
2. Remove always-visible ids from ordinary row/card content.
3. Add the native technical disclosures and verify that exact ids remain
   selectable and searchable.

### Phase 3 - apply units and abbreviation expansions

1. Correct tick-versus-second presentation first.
2. Align Cannon, Trip and Loadout input labels.
3. Apply GP/XP casing, spacing and duration/age unit rules.
4. Add complete accessible names to compact strip and dense-table labels while
   preserving their visible widths.

### Phase 4 - consolidate Settings into Economy

1. Replace Settings' detailed Price data block with the short active summary.
2. Render the full Market section only in Economy mode.
3. Add the Settings-to-Economy activation and heading-focus action.
4. Preserve all existing Economy price transactions and notices unchanged.

### Phase 5 - visual review and documentation evidence

1. Run focused semantic and browser regressions.
2. Run the complete visual suite read-only against current baselines.
3. Review every affected actual/diff image; update only explicitly accepted
   baselines using the existing visual-regression policy.
4. Refresh the feature inventory, UI parity/current implementation notes,
   testing evidence and backlog status with actual implementation evidence.

## Required tests

### Unit and view-model tests

- A known generated item resolves to its exact source name and retains its id as
  separate technical data.
- A PriceSet/history-only id receives the deterministic fallback label,
  fallback classification and exact technical id.
- Loot parent, nested and conditional presentation never substitutes a key/tag
  for an available source name.
- MonsterCard exposes source `attackSpeed: 6` as six game ticks and keeps the
  derived setup speed in seconds.
- Singular/plural unit text covers one second/minute/tick/hour/day and a
  representative plural value.
- The compact-label map includes every token listed in this specification and
  does not use lowercase visible GP/XP output.
- The short Settings summary derives from the same active PriceSet presentation
  used by Economy.

### Component tests

- Loot and Economy show `Uncut dragonstone` and `Rune spear` as primary labels;
  their underscored ids appear only inside labelled technical details.
- MonsterCard's heading is the source monster name, its id is absent from the
  always-visible subtitle area and available under `Technical details`.
- Monster source speed renders `6 ticks`; player setup speed renders `2.4 s`.
- Cannon and Trip fields both have the accessible name `Respawn (seconds)`.
- Compact `F/KL`, `GP/KL`, `XP/HR`, `TTK` and `SPD` remain visually present in
  their accepted dense locations and expose their expanded accessible names.
- Settings renders exactly one short `Active PriceSet summary`, no scheduled
  snapshot detail and no `Market price data` section.
- Economy retains exactly one detailed Market section, one scheduled summary,
  one active summary and one advanced full-PriceSet workflow.
- The Settings action calls only the typed Economy-navigation intent.

Do not use a page-wide `not.toContain(itemId)` assertion: technical details are
required to contain exact ids. Assert the primary label container and technical
disclosure separately.

### Browser tests

- From Settings, `Review in Economy` activates Economy and focuses its `Market`
  heading without changing price state or opening a disclosure.
- A screen-reader-oriented role/name assertion verifies expanded compact header
  and control names, including gold pieces per kill and food per kill.
- Loot and Economy searchable item workflows accept an id query while showing
  the source name as the selected/primary label.
- MonsterCard, Cannon and Trip expose the correct tick/second names after target
  changes, persistence reload and Cannon/Trip sparse linking.
- Existing price import/reset/manual/history tests continue to pass from
  Economy and no longer locate detailed Market controls inside Settings.

### Visual regressions

Run the complete existing visual matrix. At minimum, review actual/diff output
for root shell/MonsterCard, Cannon, Loot, Economy and Settings scenarios at all
owned widths. The expected changes are human labels, technical-id removal from
primary content, explicit units and the shorter Settings hierarchy. Any numeric
change, control loss, overflow, table widening or unrelated pane diff is a
regression.

Baseline writes remain an explicit reviewed step under
`visual-regression-spec.md`; passing functional tests does not authorize an
automatic screenshot update.

## Validation commands

Implementation requires at least:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/price-data-view-model.test.ts src/tests/loot-view-model.test.ts src/tests/monster-card-view-model.test.ts src/tests/settings-view-model.test.ts src/tests/economy-settings-pane.test.ts src/tests/loot-pane.test.ts src/tests/monster-card-panel.test.ts src/tests/cannon-pane.test.ts src/tests/trip-pane.test.ts src/tests/app-shell-components.test.ts
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
npm run verify
git diff --check
```

If focused test ownership changes before implementation, use the current owners
documented in `testing.md` and record the exact replacement command. A visual
mismatch is review evidence, not an automatic test failure to bypass.

## Acceptance criteria

- Source-backed human item and monster names are primary throughout the affected
  production surfaces.
- Technical ids remain discoverable, labelled and selectable, but are not
  ordinary always-visible user copy.
- Monster source attack speed is visibly and accessibly in game ticks; derived
  player speed and respawn inputs are unambiguously in seconds.
- Seconds, minutes, ticks, GP and XP follow one visible casing/spacing contract.
- Every accepted compact abbreviation has an expanded accessible meaning.
- Settings contains only the short active PriceSet summary and a direct,
  focus-correct Economy action.
- Economy remains the sole owner of detailed Market, PriceSet, provenance,
  price-note and history content.
- No numeric result, sorting identity, persistence envelope, PriceSet
  transaction, generated artifact or domain formula changes.
- Responsive and visual review finds no clipping, widening, overflow or lost
  interaction in the affected desktop, compact-landscape or mobile scenarios.
- Focused tests, complete functional Chromium, reviewed visual regression,
  repository verification and `git diff --check` pass.

## Open questions

None for implementation. A future full localization system, copy-to-clipboard
button for technical ids and broader terminology redesign are separate product
decisions and are not implied by this specification.

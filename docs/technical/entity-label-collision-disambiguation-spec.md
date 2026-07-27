# Entity label collision disambiguation specification

- Status: implemented
- Date: 2026-07-21
- Owner: shared entity-label presentation and option/row view models
- Evidence: verified
- Contract: closed

- Priority: high
- Estimated effort: M
- Feature-inventory parents: Basic combat setup, Loot/economy summary, Market
  price sync and Planner (`Valmis`)
- Depends on: source-name-first presentation and the active generated
  `GameDataSnapshot`
- Executable goal:
  [PF-02 · Disambiguate colliding entity labels](../project/goals/pf-02-entity-label-collisions.md)

## Purpose

Make every selectable or actionable entity distinguishable when two current
items or two rows have the same source-backed display name.

Source names remain primary and technical ids remain secondary. The goal is
not to rewrite game data; it is to add the minimum stable semantic context
needed to select, inspect and act on the intended identity.

## Verified current behavior and problem

The implemented language contract correctly prefers generated names over raw
technical ids. `createEntityDisplayLabel()` currently returns the preferred
name without knowing whether another identity has the same name.

The active Revision 274 snapshot contains real collisions, including:

- `loop_half_key` and `tooth_half_key` as `Half of a key`;
- four color-specific dragonhide ids as `Dragonhide`; and
- `guam_leaf` and `herb_guam` as `Guam leaf`.

Loot tables can also contain multiple rows named `Coins` or `Dragonhide` for
the same monster, sometimes representing different quantity/chance bands.

Searchable options currently render `option.hint` visually but set the option's
`aria-label` to `option.label` alone. Two options can therefore look or sound
identical even when their ids differ. Economy and Loot tables can expose
duplicate row names next to different actions without a stable verbal
distinction.

This is an identity and accessibility problem. Selecting by position or price
is not a safe substitute for naming the entity.

## Feature-inventory boundary

All parent workflows remain `Valmis`. This specification extends the existing
source-name-first presentation contract only where names collide. It does not
reopen data provenance, generated identity, price aliases, loot calculation,
selector mechanics or the open manual assistive-technology evidence gate.

The assistive-technology run must be repeated for affected selectors and row
actions after implementation, but this card does not replace or close the
VoiceOver/NVDA release evidence owned by
`assistive-technology-accessibility-spec.md`.

## Terminology

- **Base name**: source-backed game-data or row-source name selected by the
  existing precedence contract.
- **Entity collision**: two different technical ids with the same normalized
  base name in the active entity catalog.
- **Row collision**: two different actionable rows in one visible collection
  with the same normalized base name, regardless of whether their item ids are
  equal.
- **Disambiguator**: short semantic context appended only when needed to make
  the identity unique.
- **Technical fallback**: a labelled exact id used only when no reviewed
  semantic disambiguator is available.

Normalize collision comparison with Unicode-aware trim, whitespace collapse
and case-insensitive comparison. Do not remove punctuation or words in a way
that can collapse genuinely different source names.

## User-facing label contract

### Entity identity collisions

For catalog entities, build one deterministic collision index from the active
`GameDataSnapshot`. A display-label resolver receives the base label, exact id
and optional reviewed semantic descriptor.

Use this precedence:

1. unique base name: show the base name unchanged;
2. colliding base name with a reviewed semantic descriptor: show
   `<base name> — <descriptor>`;
3. colliding base name without a reviewed descriptor: show
   `<base name> — ID <technical id>`; and
4. missing base name: retain the existing humanized-id fallback and the exact
   technical disclosure.

The first implementation must include reviewed descriptors for the known
high-visibility current collisions:

| Technical id       | Required descriptor |
| ------------------ | ------------------- |
| `loop_half_key`    | `loop half`         |
| `tooth_half_key`   | `tooth half`        |
| `dragonhide_black` | `black`             |
| `dragonhide_blue`  | `blue`              |
| `dragonhide_green` | `green`             |
| `dragonhide_red`   | `red`               |

These descriptors are presentation metadata backed by current source identity
and provenance review. Keep them in a bounded typed registry next to the shared
presentation owner, not in components and not as generated-data mutations.

Other collisions may use a reviewed descriptor when the repository proves its
meaning. When meaning is uncertain, use the exact labelled technical fallback
and record the unresolved semantic naming as an open data question; do not
guess, merge or rename the identity.

### Row collisions

Entity disambiguation alone is insufficient when the same item identity occurs
in multiple rows. Within each Loot or Economy row collection:

- start with the resolved entity label;
- when two actionable rows still collide, append a concise row descriptor from
  already modeled source facts;
- prefer quantity/range and exact displayed chance, for example
  `Coins — 5–35 · 1/16`; and
- if source facts still do not make the accessible row/action name unique,
  append a stable one-based `row 1`, `row 2` ordinal after deterministic source
  order.

An ordinal is a last presentation fallback, not identity. It must never feed
calculation, persistence, row matching or price lookup.

Do not collapse two rows merely because id, name, chance or value appears
duplicated. A merge requires separate source/data proof and is outside this
specification.

### Visible and accessible forms

The full disambiguated label is required in:

- the closed state of searchable selectors;
- searchable listbox option text or an adjacent visible hint;
- each option's computed accessible name;
- Loot and Economy table row identity;
- row action accessible names such as price correction, history inspection or
  loot action selection;
- Planner gear choices and unlock references when the candidate set collides;
  and
- any compact summary where two colliding identities can appear together.

A visual hint may keep the base name visually prominent, but it must not be
`aria-hidden` when the option's `aria-label` omits it. Prefer preparing one
`accessibleLabel` in the view model and assigning it explicitly.

Technical-id disclosures from the existing language contract remain available
for inspection. A semantic descriptor does not remove the exact id from those
disclosures.

## Scope inventory

### Required entity sets

At minimum, collision indexing and use cover:

- current item catalog options used by Loadout and Planner;
- current monster options, even if the active snapshot currently has no
  duplicate monster names;
- Economy item/history/manual-price option lists and tables;
- current monster Loot rows, including nested composite rows; and
- contextual Result/Loot/Economy item actions.

The monster path is included to prevent a future generated duplicate from
silently recreating the problem.

### Excluded sets

- free-form saved setup names use their existing unique-name/ordinal contract;
- arbitrary raw legacy names remain sanitized by their migration owners;
- warning message deduplication remains code-based and must not switch to
  display-label equality; and
- price aliasing remains exact-id-first in `src/domain/economy`.

## Architecture and ownership

- `src/app/view-models/presentation-language.ts` owns normalized collision keys,
  the typed semantic-descriptor registry and the resolved visible/accessible
  label contract.
- A pure catalog-index helper accepts validated game data. It has no React,
  storage or browser dependency.
- Feature view models pass row-specific quantity/chance context and prepare
  final unique action labels.
- `SearchableSelectField` renders prepared visible and accessible labels; it
  does not derive meaning from ids.
- Loot and Economy pane components render prepared row labels and action names;
  they do not deduplicate data.
- Domain, generated data, PriceSet, loot evaluation and storage owners remain
  unchanged.

Avoid a global module singleton tied to one snapshot. Tests and runtime bootstrap
must be able to build the resolver from an explicit `GameDataSnapshot`.

## Stability requirements

- A catalog entity's semantic label is stable across filtering and sort order.
- Adding an unrelated unique entity does not rename existing labels.
- Adding a new collision may cause the colliding group to gain descriptors; a
  focused generated-data guard must make that reviewed change visible.
- Row ordinals follow deterministic source order, never current table sort.
- Search must match base name, semantic descriptor and exact technical id so a
  user can find either representation.
- Persisted values, React keys and domain requests continue to use exact ids or
  existing stable row ids, never display labels.

## Accessibility and responsive behavior

- Every option in one open listbox has a unique accessible name.
- Every same-named row action within one table has a unique accessible name.
- Disambiguators remain present at 320 CSS pixels and 200% text zoom; they may
  wrap but must not be available only on hover.
- Search count/status behavior and current combobox keyboard interactions stay
  unchanged.
- Screen readers must hear the same semantic descriptor a sighted user can
  inspect. If a compact visible hint is separate, its content must be included
  through the explicit accessible label.
- Color words such as `black` and `blue` are identity text, not color-only
  status encoding.

## Security and data constraints

- Never render arbitrary source paths, raw JSON, unvalidated imported labels or
  error values as disambiguators.
- Technical ids come only from the validated active snapshot or validated
  current row contract.
- Keep labels as text nodes/attributes; do not introduce HTML rendering.
- Do not expose a browser-local price, action or history value as the only
  identity distinction.

## Required tests

### Pure and view-model tests

- Build a minimal snapshot containing the key-half, dragonhide and Guam
  collisions and prove deterministic labels.
- Prove unique source names remain unchanged.
- Prove an unreviewed collision uses labelled exact-id fallback without
  guessing.
- Prove normalization catches case/whitespace duplicates but preserves
  meaningfully different punctuation/wording.
- Prove search matches base name, descriptor and technical id.
- Prove two same-item Loot rows receive quantity/chance context and remain
  distinct after table sorting.
- Prove row identity, price lookup, persistence and calculations still use
  original ids/row ids.
- Add an active-snapshot audit listing every colliding item/monster base name,
  descriptor coverage and fallback use. Unexpected changes fail with an
  actionable fixture update path.

### Component and browser tests

- Open a searchable selector containing both key halves and all four
  dragonhides; verify visible and accessible option names are unique.
- Select each option by keyboard and prove the exact intended id is applied.
- Inspect Economy rows for `Half of a key`, `Dragonhide` and `Guam leaf` and
  prove actions name the intended identity.
- Inspect a monster Loot table with repeated `Coins` rows and prove row/action
  names remain unique while values and expected GP are unchanged.
- Exercise desktop, compact landscape, 390 px mobile and the 320 CSS-pixel /
  200% text accessibility viewport.
- Run the affected automated accessibility checkpoints. Record VoiceOver and
  NVDA follow-up in the existing manual evidence owner rather than claiming
  that gate complete here.

### Validation

Run at minimum:

```sh
npm run typecheck
npm run test -- <focused presentation-language/selector/loot/economy/planner suites>
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "disambiguates colliding entity labels"
git diff --check
```

Run relevant read-only visual cases because selectors and table rows can grow.
Baseline writes remain governed by the visual-regression specification.

## Acceptance criteria

- Different ids with the same source name are distinguishable anywhere they
  can be selected or acted on together.
- Repeated actionable rows remain distinguishable even when they share an item
  id and base name.
- Known key-half and dragonhide collisions use reviewed semantic descriptors;
  unknown semantics fall back to a labelled exact id.
- Visible labels, accessible names and row actions agree on identity.
- Source names remain primary, exact technical ids remain inspectable and no
  generated name or domain identity changes.
- Search, sorting, calculation, persistence and price lookup continue to use
  stable ids rather than labels.
- Focused unit, browser, accessibility, architecture and diff checks pass.

## Implementation evidence

Implemented on 2026-07-21 without changing generated data, PriceSet aliases,
calculation inputs, persisted schemas or exact entity/row identities.

- `src/app/view-models/presentation-language.ts` now owns a snapshot-explicit
  item/monster collision index, Unicode-aware normalization, the bounded six-id
  semantic-descriptor registry and deterministic row disambiguation. The
  resolver applies unique base name, reviewed descriptor, labelled exact id
  and existing humanized fallback in that order.
- Loadout, monster, Loot, Economy and Planner view models consume the shared
  resolver. Searchable options carry one prepared accessible label and remain
  searchable by base name, descriptor and exact id. Components continue to
  mutate and key by exact ids or stable row ids.
- The active Revision 274 audit freezes 25 colliding item-name groups and zero
  monster-name groups. Reviewed descriptors cover `dragonhide` and
  `half of a key`; the other 23 groups use the truthful labelled exact-id
  fallback: adamant arrow/dart/kiteshield/knife, antipoison(3), black
  kiteshield, cape, dragon vambraces, dragonhide body/chaps, druid's robe,
  Guam leaf, iron kiteshield, mithril arrow/dart/kiteshield/knife, monk's robe,
  rune 2h sword/kiteshield, steel kiteshield, unidentified herb and wizards
  hat. The audit fails on an unreviewed inventory change.
- Hobgoblin (armed)'s seven `Coins` rows resolve from deterministic source
  order using quantity and chance before any ordinal fallback. Unit and browser
  tests prove one row action does not mutate another row or change expected-GP
  identity.
- The required focused suites pass 61/61, the accessibility scan passes 13/13,
  and the named Chromium transaction passes at desktop, compact landscape,
  390 px mobile and 320 CSS px / 200% text. The transaction keyboard-selects
  both key halves and all four dragonhides, resolves both Guam ids, applies an
  exact manual-price id and preserves seven unique Loot action names.
- The checked Vite startup passes normal `ready` and controlled lazy-entry
  `error` states with one marker and fixed sanitized copy. Typecheck, lint and
  the 173-module/159-client-reachable zero-cycle architecture check pass. The
  final 28-file artifact has 21 JavaScript chunks, a direct entry of 276,038
  raw / 83,402 gzip bytes and SHA-256
  `c39de62f36a14f3eecb11a8b76f9e5b253e34321be9151a9b87624ad2a242f44`.
- The final clean cumulative `npm run verify` rerun passes 115/115 Vitest files
  and 1,102/1,102 tests, 19/19 goldens, typecheck, lint, formatting, the
  174-module/160-client-reachable zero-cycle architecture check, build and
  artifact validation. The resulting 28-file artifact keeps 21 JavaScript
  chunks and the direct entry within budget at 276,038 raw / 83,401 gzip bytes;
  its SHA-256 is
  `75581ad5c6ab09c63501182ece97724fd7eb23b5949d150e06c41009e8f51621`.
- The relevant Darwin visual run was read-only: five of eight baselines matched
  and the three expected Loot-mobile, Economy-desktop and Planner-mobile diffs
  were inspected without clipping, lost controls or baseline writes.
  VoiceOver/Safari and NVDA/browser remain `not run` under the existing manual
  accessibility owner.

## Open questions

The semantic relationship between currently duplicated names such as
`guam_leaf` and `herb_guam` must not be inferred from equal name/price/source
reference alone. Until a source review establishes a better descriptor or
alias decision, the exact-id fallback is the required truthful presentation.

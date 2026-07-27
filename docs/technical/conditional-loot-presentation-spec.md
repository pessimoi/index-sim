# Conditional loot presentation specification

- Status: implemented
- Date: 2026-07-12
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

Keep all 25 source-backed quest/clue conditional rows visible without letting
inactive zero-value rows dominate the ordinary current-monster loot workflow.
Group them in one collapsed-by-default disclosure while preserving the exact
D-072 eligibility and calculation boundary.

## Existing behavior

- Four quest-gated and 21 clue-tertiary rows exist in generated Revision 274
  data.
- Every conditional row remains inactive while exact player state is absent.
- The rows contribute zero GP, inventory, alch, prayer and Risk effects and
  accept only locked `Skip`.
- The Loot table currently mixes them into the same full nine-column action
  table as actionable ordinary drops.

## Presentation contract

- Split the existing Loot view-model rows by `eligibilityDescription`; do not
  add a second domain calculation or mutate a row.
- Keep ordinary actionable rows in `Current monster drops`.
- Render inactive rows under one native `details` disclosure labelled
  `Conditional drops (N)` and collapsed by default.
- The disclosure explains that the rows are source-backed, excluded from all
  totals and not user-activatable in this phase.
- Each conditional row shows name/key or tag, source chance, exact sanitized
  eligibility description, inactive state and locked `Skip` action.
- The root Loot drop count distinguishes ordinary and conditional rows.
- Keyboard and screen-reader behavior uses native disclosure/table semantics.

## State and calculation boundaries

- No new state, persistence, player progression, quest, clue, members, request,
  share-link or import schema.
- No change to `evaluateLoot()`, loot preferences, optimization, market
  dependencies, Trip, Economy or Risk.
- Stored stale preferences still cannot activate a conditional row.
- The existing detailed row view-model remains the source for conditional
  labels and chance; raw RuneScript conditions stay hidden.

## Tests

- View-model tests retain locked `Skip`, sanitized eligibility and zero value.
- Browser coverage verifies the collapsed group, count, disclosure copy,
  source chance, eligibility text and absence from the ordinary action table.
- Existing numeric/golden outputs remain unchanged.

## Documentation and decision

- Record the presentation boundary as D-089.
- Keep Loot/economy summary `Valmis`; this is a bounded presentation refinement.
- Exact activation remains behind a separate player-state decision.

## Done criteria

- Conditional rows remain discoverable but no longer clutter the ordinary
  action table.
- The disclosure is truthful, accessible and calculation-neutral.
- Focused UI/browser and repository gates pass.

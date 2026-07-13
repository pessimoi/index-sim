# Conditional quest and clue loot specification

Status: implemented on 2026-07-11 under D-072; exact player-state activation remains decision-gated.

## Purpose

Close the explicit Revision 274 loot-policy gap for four quest-gated runtime
drops and 21 clue-scroll tertiary calls. The rows must no longer disappear from
the generated snapshot, but the simulator must not value them as unconditional
loot while player quest and clue-ownership state is unknown.

Loot/economy remains `Valmis`; this is a bounded source-data and policy
completion phase for its existing generated loot and visible breakdown paths.

## Accepted source evidence

### Quest-gated rows

The active 63-monster runtime catalog contains four currently excluded rows:

- Chaos druid: Unholy symbol mould, one weighted `random(128)` branch available
  after the Observatory Quest source state is complete.
- Mountain troll: Prison key and cell key, each available only at its exact
  Troll Stronghold source stage and while the player does not already own the
  corresponding key.
- Troll general: Prison key, available before the prison stage and while the
  player does not already own the key.

The generator may accept only these reviewed RuneScript shapes. Unknown
quest/NPC-state conditions, changed item ids or changed expressions fail closed
instead of becoming unconditional loot.

### Clue tertiary rows

- Reviewed runtime handlers call `trail_easycluedrop`,
  `trail_mediumcluedrop` or `trail_hardcluedrop` with a positive integer
  rarity and `npc_coord`.
- The called procedure rolls one tier-specific clue at probability `1 / rarity`.
- It returns without a drop on non-members maps or when the player already owns
  any clue.
- The exact clue object is selected from a tier enum. The simulator therefore
  models a tier-level synthetic row, not a fabricated single item id or price.
- Unknown tiers, invalid rarity, changed call arguments or duplicate calls for
  one runtime handler fail closed.

## Generated data contract

Add an optional `eligibility` object to `DropDefinition`:

- `kind: "quest"` includes a stable policy id and a sanitized user-facing
  description of the required quest/ownership state.
- `kind: "clue"` includes `tier`, `membersOnly: true` and
  `requiresNoClue: true`.
- Conditional rows retain their source chance and quantity and receive the same
  repository-relative generated provenance as core loot.
- Clue rows use a stable `clue_<tier>` tag and no item key, market price or
  invented reward value.
- Raw RuneScript conditions, local absolute paths and parser diagnostics are
  not embedded in generated output or UI copy.

The raw snapshot must contain all four quest rows and all 21 clue rows. The
source audit continues to report their counts, but describes them as modeled
default-valuation exclusions rather than missing snapshot rows.

## Runtime policy

- `evaluateLoot()` treats every row with `eligibility` as inactive while no
  matching player-state contract exists.
- Inactive conditional rows contribute zero GP, prayer XP, alch casts,
  inventory pressure and trip food displacement.
- Stored or imported loot-action overrides cannot activate a conditional row.
- The loot optimizer skips conditional rows.
- Current-monster market-sync expansion ignores conditional rows because they
  cannot contribute value and must not create missing-mapping diagnostics.
- The visible loot table includes the row, shows its source chance and a
  sanitized `Quest state not modeled` or `Clue eligibility not modeled` state,
  and locks its only action to `Skip`.
- No blanket `include quest drops` or `include clue drops` switch is added:
  such a switch would conflate distinct quest stages and clue ownership.

This policy preserves existing combat, trip and economy numbers while making
the source-backed omission explicit and future-extensible.

## State and compatibility boundaries

- No quest-state, clue inventory, membership or bank schema is added to
  `SimulationRequest`, persisted UI state, share links or imports.
- Existing unconditional `DropDefinition` rows are behaviorally unchanged.
- Legacy or test snapshots without `eligibility` remain compatible.
- A future exact player-state model may activate individual policy ids, but it
  requires a separate product/state decision and tests.

## Security boundaries

- No network, provider, auth, tenant, database or user-triggered refresh work.
- Do not expose raw source conditions, raw source payloads or internal parser
  issue text.
- Invalid conditional data is schema-invalid or parser-fatal; it must not break
  rendering or silently enter value calculations.

## Tests

- Raw parser tests cover each accepted quest policy, every clue tier and rarity,
  source chance, duplicate/invalid clue calls and unknown conditional shapes.
- Schema tests accept valid eligibility and reject invalid policy shapes.
- Generated-data tests assert four quest and 21 clue rows in the committed
  snapshot with no default valuation effect.
- Trip/domain tests assert zero GP/inventory/alch effects and override immunity.
- UI tests assert visible conditional state, one locked Skip action and
  sanitized copy.
- Regenerate source audit, snapshot and revision-impact evidence; run focused
  parser/generator/trip/UI tests, typecheck, golden tests, the full verification
  gate and `git diff --check`.

## Documentation and decision

- Update feature inventory, architecture, testing, UI parity, backlog,
  revision-impact and rewrite-parity evidence without changing the existing
  `Valmis` feature status.
- Record the modeled-row/default-exclusion policy as the next accepted decision
  and explicitly supersede D-055 only for snapshot inclusion.

## Done criteria

- All 25 reviewed conditional rows exist in the generated runtime with typed
  eligibility and sanitized provenance.
- Default simulation numbers remain unchanged and cannot be altered by stale
  conditional-row preferences.
- The Loot UI exposes the rows and truthful inactive reason without suggesting
  that quest or clue state is modeled.
- Evidence and validation pass, then this goal is committed and pushed before
  Goal 6.

The implemented D-089 presentation follow-up is specified in
[conditional-loot-presentation-spec.md](conditional-loot-presentation-spec.md).
It changes only how these existing inactive rows are grouped in Loot.

# Source-backed incoming damage specification

Status: implemented under D-081 on 2026-07-11; validation evidence recorded in
[testing.md](testing.md). The generated
[63-monster evidence report](../project/npc-attack-source-audit.md) remains
source evidence, while D-081 owns the accepted formula, context, overlay and
baseline boundaries.

## Purpose

Replace the generated runtime's implicit melee-only incoming-damage assumption
with typed, source-backed NPC attack profiles. Trip remains the expected-value
owner and Risk consumes the same normalized incoming model instead of deriving
a parallel interpretation.

This is a calculation-correctness extension to the accepted Trip and Risk
workflows. It does not add player accounts, quest state, a backend or new
persisted setup fields.

## Current state and verified problem

The committed Revision 274 snapshot contains 63 monsters with typed
`incomingAttacks`: 55 exact and eight partial. Legacy/test snapshots may still
omit the contract and exercise the visible compatibility fallback.

`computeIncomingDamage()` therefore:

- reads untyped `atkType` through a generic record and defaults it to `melee`,
- reads untyped `maxHit` when present,
- otherwise derives max hit from `strength` and `strBonus`, and
- selects the player's melee slash defence unless the untyped attack type says
  `ranged` or `magic`.

The standard melee max-hit fallback is not inherently fabricated. The pinned
LostCity melee procedure calculates the same source formula from NPC Strength
and `strengthbonus`, and the current generated snapshot has those inputs for all
63 rows. The correctness gap is broader:

- a single untyped/default-melee interpretation cannot represent standard
  ranged or magic attacks,
- fixed-max-hit and spell-backed attacks use different source rules,
- scripted dragonfire, boss and other special attacks can be conditional or
  multi-style, and
- Risk currently samples whatever aggregate values Trip produced without a
  typed statement of which incoming sources are exact or mean-only.

The implementation must therefore model attack profiles and coverage, not
blindly add one manually maintained `maxHit` number to every monster.

## Accepted source evidence for the specification

The pinned LostCity source establishes the following candidate rules:

- `npc_combat_melee.rs2` owns the normal melee attack roll and max hit. It uses
  NPC Attack/Strength, `attackbonus`/`strengthbonus`, the controlled-style `+9`
  effective-level adjustment and the shared `combat_stat`/`combat_maxhit`
  procedures.
- `npc_combat_ranged.rs2` owns the normal ranged attack roll and max hit. It
  uses NPC Ranged, `rangeattack`, `rangebonus` and the same shared roll/max-hit
  procedures.
- `npc_combat_magic.rs2` owns normal NPC spell accuracy and obtains max hit
  either from the selected spell row or an explicit forced max hit.
- NPC configs and handler bindings own attack rate, relevant combat params and
  the script that actually performs an attack.
- Individual RuneScripts own fixed, conditional or multi-style attacks such as
  dragonfire and boss-specific attacks.

Repository-relative source references may be emitted as provenance. Raw source
bodies, absolute local paths and parser diagnostics must not enter generated
artifacts or UI copy.

## Required source audit before formula acceptance

Implemented by `npm run npc:attack-audit` and the committed
[Revision 274 report](../project/npc-attack-source-audit.md). The audit resolves
55 exact source cases and eight partial cases. It preserves four explicit
source-weighted dragon branches and leaves four contextual/effect paths without
inferred weights. The requirements below remain the regression contract for
that tool.

The audit and loot extraction share one bounded RuneScript reader. The active
report records 1,659 relevant source files / 7,174,051 bytes and the enforced
file-count, per-file, total-byte, reachable-block and report-size limits. Source
and scripts symlinks are rejected instead of followed outside the checkout.

Add a deterministic audit over the active 63-monster runtime catalog. For each
monster it must report:

- resolved NPC config and combat handler,
- every detected incoming attack family,
- source attack type, rate, accuracy inputs and max-hit rule,
- whether attack selection has a source-backed fixed probability, a
  context-dependent rule or an unresolved rule,
- whether poison or dragonfire is a separate overlay, and
- normalized repository-relative provenance.

Every active monster must be classified as `exact`, `partial` or `fallback`.
The audit must fail on stale runtime/source identities, conflicting duplicate
profiles, invalid numeric bounds and unknown parser shapes. It must not invent
probabilities for distance-, phase-, health- or state-dependent branches.

The audit result is evidence for D-081. It does not claim that the eight partial
handlers can be modeled exactly.

## Generated data contract

Add an optional typed `incomingAttacks` array to `MonsterDefinition`. Legacy and
test snapshots may omit it. Generated Revision 274 rows must contain at least
one classified entry or an explicit fallback classification.

The implemented normalized shape additionally stores formula inputs and an
explicit monster-level coverage classification:

```ts
type IncomingAttackType = "melee" | "ranged" | "magic";

type IncomingAttackProfile = {
  id: string;
  attackType: IncomingAttackType;
  attackSpeedTicks: number;
  maxHit: number;
  formulaId:
    | "standard-melee-v1"
    | "standard-ranged-v1"
    | "spell-row-v1"
    | "forced-max-hit-v1"
    | "scripted-fixed-v1";
  formulaInputs:
    { kind: "standard"; level: number; bonus: number } | { kind: "source-value"; value: number };
  accuracy:
    { kind: "standard"; level: number; bonus: number } | { kind: "always" } | { kind: "mean-only" };
  selection:
    | { kind: "always" }
    | { kind: "weighted"; weight: number }
    | { kind: "contextual"; reason: string };
  coverage: "exact" | "partial" | "fallback";
  provenance: DataProvenance;
};
```

Contract rules:

- `id` is stable within one monster and is not a global item/entity id.
- `attackSpeedTicks` is a positive finite tick count.
- `maxHit` is a non-negative integer resolved from the reviewed source formula,
  spell row, forced value or script. It is generated, not hand-maintained in UI
  or domain code.
- Standard profiles retain their source level and bonus so accuracy remains
  dependent on the current player's relevant defence.
- Weighted profiles require source-backed positive weights and are normalized
  only within the exact source selection group.
- Contextual profiles are never silently converted to equal weights.
- Sanitized `reason` values come from an allowlist; raw script expressions are
  not serialized.
- Unknown attack types, invalid weights, unsupported formulas and ambiguous
  overlays fail generation or remain an explicit fallback; they never become
  an exact melee profile.

The generator stores and tests the versioned formula identifier, sanitized
inputs and resolved `maxHit`. Trip validates the exact formula again at the
runtime boundary. Poison and dragonfire remain separate overlays.

## Runtime ownership and calculation behavior

### One normalized incoming descriptor

Introduce a pure Trip-domain function that converts the active monster's typed
profiles, current player defence/loadout, Trip protection and safespot settings
into one normalized incoming descriptor.

`computeIncomingDamage()` must consume that descriptor. Risk must consume the
same descriptor or the resulting structured Trip output. Risk must not parse
`MonsterDefinition`, choose attack types or recreate max-hit formulas itself.

### Expected damage

For an exact standard profile, expected normal damage uses:

```text
attack opportunities
  × source-backed selection probability
  × hit probability against the relevant player defence
  × mean damage for the source damage distribution
```

The current uniform inclusive `0..maxHit` source distribution has mean
`maxHit / 2`. Protection prayer applies only to the matching attack type.
D-046 safespot behavior remains unchanged unless a separate source-backed
encounter decision reopens it.

The implementation must preserve source integer/floor semantics. Formula
changes are calculation changes and require focused evidence; floating-point
algebra that merely looks equivalent is insufficient.

### Multiple and contextual attacks

- Exact weighted profiles may contribute to one expected-value aggregate.
- A contextual profile without a source-backed selection frequency contributes
  only through an explicitly reviewed mean-only/fallback policy.
- The UI and Risk coverage must not label a contextual aggregate as exact.
- Dragonfire, poison and other overlays must have one owner. Moving an overlay
  into an attack profile must remove the old parallel addition in the same
  change so damage is never double-counted.
- Multi-hit attacks require an exact event schedule before their variance may
  be sampled. Otherwise their accepted expected contribution remains
  mean-only.

### Compatibility fallback

Legacy/test snapshots without `incomingAttacks` retain the current formula and
current safespot/protection behavior. The result must carry a structured
`fallback` coverage state and sanitized warning.

The generated Revision 274 adapter must not silently use that compatibility
path for a row classified `exact`. A row classified `partial` or `fallback`
must expose that status in readiness/audit evidence and in the user-visible
assumptions detail when incoming damage is relevant.

## Result, Risk and UI contract

- Extend Trip's structured incoming result with attack-profile coverage and
  sanitized source labels. Do not add these fields to `SimulationRequest`.
- Keep existing expected-value ownership in `FullSimulationResult` unchanged.
- Risk samples exact standard attack profiles using the same opportunity,
  selection, hit and damage semantics used by Trip.
- Partial, contextual and unsupported sources appear in
  `RiskModelCoverage.meanOnlySources`; Risk must not claim fully sampled
  incoming variance when they materially contribute.
- Trip/Stats assumptions detail shows `Source-backed`, `Partial model` or
  `Compatibility fallback`. No new setup control is required.
- Existing manual `foodPerKillOverride` remains authoritative and visibly
  suppresses stochastic incoming-food demand as already specified by Risk.

## Baseline and impact policy

- Archived legacy golden fixtures remain unchanged and continue to cover the
  compatibility path.
- Standard melee generated rows should remain numerically unchanged unless the
  audit finds a real source or integer-semantics discrepancy.
- Ranged, magic, fixed/scripted and multi-style changes are intentional only
  when backed by the pinned source and a reviewed decision.
- Regenerated revision-impact and numeric-user-path reports must classify every
  changed TTK, food/trip, kills/hr, XP/hr, GP/hr and Risk output.
- Do not refresh golden, numeric or visual baselines merely to make changed
  numbers pass.

## Scope exclusions

- Player starting HP, exact eat ticks, overheal and death probability.
- Encounter positioning, distance simulation or automatic safespot changes.
- Dynamic NPC phases or AI simulation without an exact bounded source model.
- Quest/player state, accounts, database storage or provider calls.
- Changes to player outgoing combat formulas.
- Removal of archived legacy/reference assets.

## Required implementation phases

1. Produce and review the 63-monster source audit.
2. Accept the typed profile, formula and unresolved-context policy in
   `docs/project/decisions.md`.
3. Add schema/parser/generator support and committed classified profiles.
4. Introduce the pure Trip incoming descriptor and migrate expected-value
   calculation without changing compatibility behavior.
5. Make Risk consume the same descriptor and coverage.
6. Add visible source/fallback assumptions and regenerate impact evidence.
7. Run focused, numeric, golden, browser and repository verification gates.

## Tests

### Source and generator

- Standard melee fixture proving source integer semantics.
- Standard ranged fixture using Ranged level, range attack and range strength.
- Magic spell-row and forced-max-hit fixtures.
- Fixed/scripted attack fixture and separate dragonfire/poison overlay fixture.
- Exact weighted, contextual, conflicting, unknown and invalid profile cases.
- All 63 active monsters classified with repository-relative provenance and no
  raw source body or absolute path.

### Domain and Risk

- Melee, ranged and magic profiles choose the corresponding player defence and
  protection prayer.
- Expected damage matches the exact profile mixture without double-counting.
- Safespot and manual food override retain their existing ownership.
- Legacy/missing-profile snapshots preserve the current result and emit
  fallback coverage.
- Risk is deterministic for exact profiles and reports partial/mean-only
  coverage for contextual or unsupported sources.
- Non-finite, negative or non-progressing inputs fail closed.

### Integration and impact

- Generated runtime readiness/source audit.
- Focused generator, Trip, Risk, full-simulation and view-model tests.
- `npm run numeric:audit` and reviewed `npm run numeric:audit:write` only after
  intentional accepted changes.
- `npm run test:golden`, `npm run verify`, relevant production-preview
  Playwright coverage and `git diff --check`.

## Remaining future decisions

- Which contextual or multi-style handlers in the active 63-monster catalog
  have enough source evidence for exact V1 weights?
- What additional pinned evidence would justify replacing a partial handler's
  compatibility expected value?
- Should a future migration move any scripted overlay into the descriptor and
  remove its current separate Trip owner in the same reviewed change?

## Done criteria

- Every active Revision 274 monster is audited and classified.
- Exact generated profiles use reviewed source attack type, speed, accuracy and
  max-hit semantics; unresolved profiles remain visibly partial/fallback.
- Trip and Risk share one normalized incoming-damage owner.
- No scripted/overlay damage is double-counted.
- Legacy snapshots remain compatible and generated fallback use is visible.
- All numeric changes are reviewed and the required validation gates pass.

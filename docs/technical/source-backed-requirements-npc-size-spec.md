# Source-backed requirements and NPC size specification

Status: implemented on 2026-07-11 under D-071.

## Purpose

Close two explicit source-data gaps in the current Revision 274 runtime:

1. populate generated item skill requirements from the pinned LostCity
   `levelrequire` RuneScripts instead of leaving the runtime requirement map
   empty, and
2. populate NPC size from pinned `.npc` configs so dragon halberd target-hit
   behavior no longer needs the D-050 fallback in the generated runtime.

Basic combat setup, Planner and Special attacks remain `Valmis`; this is a
source-backed completion phase for their existing warning/filter/formula paths.

## Accepted source evidence

### Item skill requirements

- `scripts/levelrequire/scripts/tier*.rs2` owns equip triggers in the form
  `[opheld2,item] @levelrequire_...(numeric arguments, last_slot);`.
- `scripts/levelrequire/scripts/levelrequire.rs2` defines the called labels and
  their exact base-skill checks.
- The generated contract supports Attack, Strength, Defence, Ranged and Magic.
- Quest-wrapper labels contribute their explicit numeric skill checks, but
  quest completion itself remains outside this contract.
- `levelrequire_iban_staff` is the one accepted fixed 50 Magic / 50 Attack
  definition with no numeric trigger arguments.
- Unknown call shapes, invalid levels, conflicting duplicate rows and stale
  runtime/source identity mappings fail generation with sanitized errors.

### NPC size and dragon halberd

- LostCity `NpcType.size` defaults to 1 and `.npc` configs may override it with
  `size=N`.
- `pvm_dragon_halberd.rs2` performs the second full target hit only when
  `nc_size(npc_type) > 1`.
- For a size-1 target the script may seek a separate adjacent NPC at reduced
  accuracy; this simulator models one selected target and therefore does not
  attribute that adjacent-target hit to the selected target.

## Generated data contract

- Add optional `strength` to item requirement skills.
- Add positive integer `size` to generated `MonsterDefinition` rows.
- The raw generator emits `size: 1` when the source NPC config omits the field.
- The raw generator emits a top-level `requirements` map for current runtime
  weapons/equipment that resolve to source equip triggers.
- Requirement provenance names only repository-relative source refs and states
  that quest clauses are excluded.
- Raw source bodies and local absolute paths remain excluded from artifacts.

## Runtime behavior

- Planner and loadout requirement checks consume generated Strength together
  with the four existing skills.
- D-051 manual fallback remains for legacy snapshots and current runtime items
  with no generated requirement row.
- Dragon halberd uses one selected-target hit for source-backed size 1 and two
  selected-target hits for source-backed size greater than 1.
- Missing `monster.size` preserves the legacy double-hit fallback and D-050
  warning for legacy/missing-data contexts.
- A source-backed size removes that fallback warning.

## Baseline and impact policy

- Archived legacy golden fixtures remain unchanged and continue to exercise the
  missing-size fallback.
- Generated-runtime impact evidence must record the intentional dragon-halberd
  delta on small targets.
- No unrelated combat, trip, loot or planner baseline may be updated.
- Source-backed requirement rows are expected to change Planner/loadout warning
  provenance and may change Planner eligibility where the manual fallback was
  absent or incomplete; these changes must be reviewed in generated impact and
  focused tests.

## Scope exclusions

- Quest completion requirements and quest state.
- Adjacent-target or area-of-effect simulation.
- Future/hypothetical gear.
- Removal of the D-051 fallback.
- Magic DPS specials, provider decisions, auth, database, tenant state or live
  upstream tests.

## Tests

- Raw parser tests cover requirement call families, Strength, quest-wrapper
  skill extraction, Iban staff, conflicts, unknown calls and source refs.
- Raw monster tests cover explicit and default size.
- Domain tests cover size-1, size-greater-than-1 and missing-size dragon
  halberd behavior/warnings.
- Planner and UI tests cover generated Strength and source-backed policy copy.
- Regenerate committed outputs and revision-impact evidence, then run focused
  generator/domain/planner/UI tests, typecheck, golden tests, full verify and
  `git diff --check`.

## Documentation and decision

- Update feature inventory notes without changing `Valmis` statuses.
- Update architecture, testing, UI parity, backlog, revision-impact and rewrite
  parity evidence.
- Record the source/formula acceptance and fallback boundary as D-071.

## Done criteria

- The committed generated runtime contains source-backed requirements and NPC
  sizes.
- Current generated Planner/loadout consumers use generated policy where rows
  exist, including Strength.
- Dragon halberd follows source-backed selected-target size behavior while
  legacy missing-size contexts retain the visible fallback.
- Evidence and validation pass, then this goal is committed and pushed before
  Goal 5.

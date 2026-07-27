# Requirement-aware loadout optimizer specification

- Status: implemented
- Date: 2026-07-12
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

Extend the implemented D-073 bounded whole-loadout optimizer so its default
candidate policy recommends only weapon and worn-equipment choices that meet
the active player's known Attack, Strength, Defence, Ranged and Magic levels.
Keep manual setup editing warning-only and preserve an explicit way to run the
original visible-catalog search without requirement filtering.

## Existing behavior

- D-073 maximizes current-target normal DPS over visible current-revision
  weapon and equipment choices.
- The unchanged current form is always the no-regression baseline.
- Generated Revision 274 requirements are primary for 94 current item rows;
  D-051 remains the compatibility lookup for legacy or missing rows.
- Selected setup requirement warnings and per-slot quick-action reason copy are
  visible but do not block manual gear selection.
- Apply and one-step Undo already use the existing default/custom setup owner.

## Accepted architecture

The optimizer receives an explicit eligibility policy:

```ts
type LoadoutEligibilityPolicy = "respect-current-levels" | "ignore-requirements";
```

- `respect-current-levels` is the UI and function default.
- `ignore-requirements` preserves the original D-073 candidate behavior.
- The policy is an optimizer input only. It is not added to
  `SimulationRequest`, `CombatSetupFormState`, persisted setup state, imports,
  Duel snapshots, Planner state or share links.
- Eligibility uses the same generated-first/D-051-fallback requirement lookup
  as setup warnings. An item with no known numeric requirement remains eligible.
- Quest state, item ownership and prices are not inferred.

## Candidate policy

When `respect-current-levels` is active:

1. Filter visible weapon candidates whose known numeric requirements exceed the
   active form levels.
2. Filter visible equipment candidates independently per slot by the same rule.
3. Keep `none` eligible for every supported slot.
4. Keep the unchanged current form as the explicit baseline even when it has an
   unmet requirement. The optimizer may leave that baseline unchanged, but it
   must not propose a different item with an unmet requirement.
5. Apply the existing hidden-tier, two-handed, ammo-normalization, Pareto-frontier,
   cap, deterministic tie and no-regression rules after eligibility filtering.

The result reports the active policy and the count of visible weapon/equipment
choices excluded by numeric requirements. The count is diagnostic UI copy; it
does not alter scoring or persistence.

## UI behavior

- Add a checked-by-default `Respect current levels` control beside
  `Optimize loadout`.
- The control is session-local and intentionally resets to the safe default on
  reload.
- Successful status and Undo copy retain the DPS delta and add the number of
  ineligible choices skipped when the safe policy is active.
- If no eligible candidate improves the current form, leave state unchanged and
  report that the current loadout is already best among eligible visible gear.
- Turning the control off uses the original D-073 visible-catalog search and
  keeps existing requirement warnings on any selected result.

## Non-goals

- Blocking manual item selection or per-slot `Best` actions.
- Quest-, clue-, ownership-, price- or future-gear-aware optimization.
- Independently searching ammo or spells.
- Removing D-051 or changing generated requirement provenance.
- Persisting the optimizer policy or adding it to shared setup payloads.
- Changing combat, Trip, Planner or economy formulas.

## Tests

- Default optimization excludes unmet weapon and equipment candidates.
- The unchanged unmet baseline remains available without a DPS regression.
- Unknown requirements remain eligible.
- `ignore-requirements` retains D-073's warning-only candidate behavior.
- Excluded-choice counts are deterministic and do not double-count gear across
  weapon frontiers.
- Existing visible-option, hidden-tier, two-handed, cap, invalid-limit,
  performance, Apply and Undo coverage remains green.
- Browser coverage verifies the checked default, apply/Undo and unchanged target
  and active style.

## Documentation and decision

- Record the candidate-policy boundary as D-088.
- Keep Basic combat setup `Valmis`; this is a bounded next phase of the existing
  optimizer, not a new top-level feature.
- Close only generated numeric requirement-aware optimization. Price-aware,
  quest-aware and ownership-aware objectives remain later work.

## Done criteria

- Default whole-loadout optimization proposes only known level-eligible new
  weapon and equipment choices.
- Manual selection remains warning-only, and the original D-073 search is still
  available through an explicit control.
- The current form remains a no-regression baseline.
- No request or persisted schema changes.
- Focused tests, browser smoke, repository verification and owning documents are
  current.

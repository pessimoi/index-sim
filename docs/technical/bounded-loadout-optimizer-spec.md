# Bounded loadout optimizer specification

Status: implemented on 2026-07-11 under D-073; D-088 adds the implemented default numeric-level eligibility policy.

D-088 later extends this implemented D-073 contract with the checked-by-default
numeric-level eligibility policy in
[requirement-aware-loadout-optimizer-spec.md](requirement-aware-loadout-optimizer-spec.md).
The original warning-only candidate policy remains available explicitly; this
document otherwise retains the D-073 implementation boundary.

## Purpose

Add one bounded whole-loadout action to the existing `Valmis` Basic combat
setup workflow. The action should improve the active setup's normal-attack DPS
against the current monster without turning the setup editor into a
price-aware, quest-aware or progression optimizer.

## Existing behavior

- Each equipment slot has a `Best` quick action based on a deterministic
  style-specific bonus heuristic.
- The weapon picker, equipment pickers and hidden-tier policy already define
  the user's visible current-revision candidate set.
- `applyWeaponSelection()` owns weapon/style/ammo normalization and two-handed
  shield clearing.
- `simulateCombat()` owns the accepted current-target combat formula.
- Requirement warnings are visible and non-blocking; generated requirements are
  primary and D-051 fallback remains for legacy/missing rows.

## Optimization contract

The optimizer receives the normalized active form, current `SimulationContext`,
visible weapon options and visible options for every equipment slot.

- Objective: maximize `CombatSimulationResult.dps`, the normal-attack DPS for
  the current monster.
- Candidate weapons: visible weapons for the active combat style only.
- Candidate equipment: visible current-revision rows for all nine equipment
  slots, including the current selection retained by hidden-tier filtering.
- Ranged ammo and magic spell are not independently searched. Weapon changes use
  `applyWeaponSelection()` so thrown ammo and invalid bow ammo remain normalized.
- Style changes are only those required by `applyWeaponSelection()` for a
  candidate weapon.
- A two-handed candidate forces shield `none`; one-handed candidates evaluate
  the visible shield set.
- Special-attack, poison, trip, cannon, loot and economy effects are not part of
  the objective. Existing setup state remains otherwise unchanged.

## Bounded search

For each visible weapon:

1. Build equipment combinations one slot at a time from the two combat-relevant
   bonus dimensions: active accuracy plus melee Strength, ranged Strength or
   magic damage.
2. Deduplicate equal bonus pairs, preferring fewer changes from the current
   form and then a stable item-id order.
3. Remove combinations dominated in both bonus dimensions.
4. Cap the surviving frontier at 512 deterministic states per weapon. If a cap
   is reached, retain the accuracy/damage extremes and sample the ordered
   trade-off frontier evenly, then mark the result `capped`.
5. Evaluate each frontier state through `simulateCombat()` and select the
   highest finite normal DPS.

The unchanged current form is always an explicit candidate. Equal DPS prefers
fewer changed loadout fields and then stable ids, so an optimizer run cannot
create cosmetic churn. The returned result must never reduce DPS versus the
current form, even when a frontier cap or invalid candidate is encountered.

## Requirements and visibility policy

- Hidden tiers are excluded because the UI passes its already-filtered option
  lists. A hidden current selection remains eligible exactly as it remains
  visible in the picker.
- Numeric item requirements do not remove candidates in this phase. This
  preserves the existing non-blocking setup policy; any unmet requirements on
  the selected result continue to appear through the generated/fallback warning
  path.
- No future/hypothetical gear is introduced. D-047 current-revision scope
  remains unchanged.
- No item price, market state, quest state, clue state or ownership is read.

## UI behavior

- Add one clear `Optimize loadout` command next to the active loadout controls.
- The action applies the returned normalized form through existing setup-mode
  ownership, so default and custom setups continue to update consistently.
- A successful change reports changed fields and the normal-DPS delta in the
  existing local Undo strip.
- Undo restores the complete pre-optimization form through the same setup-mode
  ownership path.
- If no visible candidate improves the current form, leave state unchanged and
  report that the current loadout is already best among visible gear.
- A capped result remains applicable but the status copy must say the search was
  bounded.

## State and compatibility boundaries

- No new persisted schema, storage key, import/export shape, share-link field or
  `SimulationRequest` field.
- Per-style loadout stashing, default/custom setup ownership and current target
  remain unchanged.
- Existing per-slot `Best` actions remain available.
- Planner gear pools and Planner scoring are not changed or reused as hidden
  optimizer policy.

## Security boundaries

- No network, provider, auth, tenant, database or user-triggered data refresh.
- Candidate ids come only from validated in-memory `GameDataSnapshot` rows and
  UI option allowlists.
- Invalid ids or non-finite simulation results are skipped with sanitized
  status; raw parser/provenance data is not exposed.

## Tests

- Unit tests cover deterministic improvement, current-form tie preference,
  hidden candidate exclusion, two-handed shield behavior, non-blocking
  requirement warnings, cap reporting and no-regression fallback.
- Performance coverage keeps the current full visible catalog within a bounded
  synchronous interaction budget.
- Focused Playwright covers apply plus one-step Undo and verifies that the
  current active style/monster remain in place.
- Run typecheck, focused UI/domain/state tests, golden tests, full verification,
  `git diff --check` and focused browser smoke.

## Documentation and decision

- Update Basic combat setup notes while keeping status `Valmis`: this is a
  bounded extension of the existing loadout workflow.
- Close only the bounded whole-loadout part of the later parity row. Full
  price-aware, quest-aware and requirement-aware optimization stays later.
- Record the objective, candidate and bounded-search policy as D-073.

## Done criteria

- The active setup can be optimized across visible weapon and equipment choices
  for current-target normal DPS.
- The result is deterministic, never lowers baseline DPS, honors hidden-tier and
  two-handed boundaries, and keeps requirement warnings non-blocking.
- Apply/Undo, tests, evidence and owning documents are complete.

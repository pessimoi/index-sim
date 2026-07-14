# Simulation and MonsterCard view-model refactor specification

Status: Specced, not implemented.

## Purpose

Split the remaining MonsterCard-owned presentation model out of
`src/app/view-models/simulation.ts` while preserving the current main
simulation view-model contract.

This is the next small ownership cleanup after the App composition-root,
Stats/Loadout, Compare/Duel, Planner, Risk, Loot/Trip and Economy/Settings
refactors. It is intentionally narrower than a domain rewrite: the numeric
truth still belongs to `FullSimulationResult` and the existing domain modules.

## Current evidence

Verified on 2026-07-14:

- `src/app/view-models/simulation.ts` is 476 lines.
- It exports the main `SimulationViewModel` and `createSimulationViewModel()`
  contract.
- It also exports the MonsterCard type family, `createMonsterCardViewModel()`
  and `monsterOptions()`.
- The MonsterCard block is a contiguous UI presentation family inside the
  module. It owns monster stat rows, defence rows, active defence highlighting,
  setup badge text, compact setup summary and target option sorting.
- `createSimulationViewModel()` already reuses the combat result from
  `simulateFullSimulation()` when composing `monsterCard`; the composed path
  must not add another combat simulation.
- Direct external consumers are small:
  - `App.tsx` imports `monsterOptions()` and `createSimulationViewModel()`.
  - `MonsterCardPanel` and its test need only the `MonsterCardViewModel` type.
  - `ui-view-model.test.ts` has focused MonsterCard assertions mixed into a
    large multi-feature suite.
  - Compare and Duel continue to import `createSimulationViewModel()` for their
    current numeric paths.

## Non-goals

- Do not change combat, trip, loot, XP, rate, risk or planner formulas.
- Do not change `FullSimulationResult`, worker request/result envelopes,
  persisted state, import/export shapes, share links, browser storage keys,
  UI copy, CSS, layout or visual baselines.
- Do not split `src/domain/trip/index.ts`,
  `scripts/game-data-generator-core.ts`, `src/app/App.tsx` or the main
  simulation adapter further in the same goal.
- Do not introduce a compatibility barrel or re-export moved MonsterCard
  symbols from `simulation.ts`.
- Do not rename the UI-facing composed result contract.

## Target module ownership

Add `src/app/view-models/monster-card.ts`.

It owns:

- `MonsterCardViewModel` and `MonsterCardViewModelOptions`;
- module-private MonsterCard detail types unless a current direct consumer needs
  to name them;
- MonsterCard stat row, defence row, active defence and setup summary helpers;
- `createMonsterCardViewModel()` for direct, standalone MonsterCard
  characterization;
- a result-reuse builder, for example
  `createMonsterCardViewModelFromCombat()`, that receives an existing
  `SimulationRequest`, `SimulationContext`, `CombatSimulationResult` and
  options;
- `monsterOptions()` as the target selection option presenter.

Keep `src/app/view-models/simulation.ts` as the cross-feature composition
adapter.

It continues to own:

- `SimulationViewModel`;
- `SimulationViewModelOptions`;
- `createSimulationViewModel()`;
- composition over `simulateFullSimulation()`;
- hit distribution, Stats, Loadout/setup requirements, Active assumptions,
  Loot and Trip joins;
- warning buckets;
- legacy raw Loot compatibility aliases: `topLoot`, `lootRows` and
  `lootSummary`.

After the move, `simulation.ts` imports the MonsterCard type and result-reuse
builder from `monster-card.ts`. It should no longer import `simulateCombat()`,
`AttackType`, `CombatStyle`, `styleOptions`, `signedBonus` or `formatNumber`
solely for MonsterCard work.

## Dependency direction

The accepted direction is:

```text
domain/shared + domain/combat + app/state/ui-state + app/view-models/loadout/formatting
  -> app/view-models/monster-card.ts
  -> app/view-models/simulation.ts
  -> feature consumers
```

`monster-card.ts` must not import `simulation.ts`, React components,
controllers, browser APIs, storage, workers, adapters or pane modules.

`simulation.ts` must not re-export MonsterCard symbols after the move. Direct
consumers must import from the new owner.

## Public export surface

The implementation should narrow named exports where current code allows it:

- `simulation.ts` should export only the main simulation symbols:
  `SimulationViewModel`, `SimulationViewModelOptions` and
  `createSimulationViewModel()`.
- `monster-card.ts` should export only:
  `MonsterCardViewModel`, `MonsterCardViewModelOptions`,
  `createMonsterCardViewModel()`,
  `createMonsterCardViewModelFromCombat()` and `monsterOptions()`.
- Detail types such as stat keys, defence keys, row contracts and setup summary
  fragments should stay module-private unless TypeScript forces an exported
  name or a real consumer needs that name.

This preserves the direct-owner policy used by the earlier D-093 refactors and
removes unused broad named exports from the main simulation adapter.

## Implementation phases

1. Characterize the current MonsterCard behavior before moving code.
   - Move or duplicate the focused MonsterCard cases out of the large
     `ui-view-model.test.ts` into `src/tests/monster-card-view-model.test.ts`.
   - Cover melee stab/slash/crush active defence, ranged and magic active
     defence, nullable missing stats/defence fields, setup badge text,
     weapon/ammo/spell/ring summary and target option sorting.
   - Keep at least one integrated `createSimulationViewModel().monsterCard`
     assertion in `ui-view-model.test.ts` so the composed adapter remains
     covered.

2. Create `src/app/view-models/monster-card.ts`.
   - Move the MonsterCard helpers and target option sorting into the new file.
   - Keep the standalone builder behavior by mapping form state with
     `formToSimulationRequest()` and running one `simulateCombat()` call.
   - Add the result-reuse builder for `simulation.ts` so the composed path uses
     the existing combat result from `simulateFullSimulation()`.

3. Update imports.
   - `App.tsx` imports `monsterOptions()` from `monster-card.ts` and keeps
     `createSimulationViewModel()` from `simulation.ts`.
   - `MonsterCardPanel` and its test import `MonsterCardViewModel` from
     `monster-card.ts`.
   - Direct MonsterCard unit tests import from `monster-card.ts`.
   - Compare, Duel, Trip, Loot, Stats/Loadout and performance consumers keep
     importing `createSimulationViewModel()` from `simulation.ts`.

4. Remove obsolete declarations from `simulation.ts`.
   - Delete the moved MonsterCard types, constants and helpers.
   - Delete the direct `simulateCombat()` import if it is no longer needed by
     the main adapter.
   - Do not add re-exports for moved symbols.

5. Update living documentation after implementation.
   - Mark this specification as implemented.
   - Update `docs/technical/architecture.md` with the new module count and
     line-count evidence.
   - Move the backlog card from `Specced` to `Done` with test evidence.
   - Add a short validation note to `docs/technical/testing.md` if the
     implementation changes authoritative evidence counts.

## Acceptance criteria

- `createSimulationViewModel()` signature, option names and returned field names
  remain unchanged.
- `SimulationViewModel.monsterCard` keeps the same runtime shape and values.
- The composed simulation path performs one full simulation and reuses its
  combat result for MonsterCard composition.
- Standalone `createMonsterCardViewModel()` remains available from
  `monster-card.ts` for focused tests and direct characterization.
- `simulation.ts` no longer exports MonsterCard-specific detail types or
  builders.
- No compatibility barrel or moved-symbol re-export is added.
- `npm run architecture:check` reports no cycle, exception or orphan.
- Numeric audit and goldens remain unchanged.
- Browser behavior and visual baselines remain unchanged.

## Validation plan

Focused source checks:

```sh
npm run typecheck
npm run architecture:check
npm run test -- src/tests/monster-card-view-model.test.ts src/tests/monster-card-panel.test.ts src/tests/ui-view-model.test.ts src/tests/app-shell-components.test.tsx src/tests/full-simulation-result.test.ts src/tests/rewrite-fixture.test.ts src/tests/ui-performance.test.ts src/tests/compare-duel-panes.test.ts src/tests/compare-duel-controllers.test.ts
```

Numeric and artifact checks:

```sh
npm run numeric:audit
npm run test:golden
npm run build
npm run deploy:verify-artifact
npm run lint
npm run format:check
git diff --check
```

Browser checks:

```sh
npm run test:e2e -- --workers=1 --grep "switches the target through MonsterCard|updates MonsterCard active defence|places MonsterCard after the active pane"
npm run test:e2e -- --workers=1
npm run test:e2e:visual -- --workers=1
```

Use the visual command in read-only comparison mode. Do not update baselines for
this ownership-only refactor unless a separately reviewed visual defect is
found.

Final handoff gate:

```sh
npm run verify
```

If the environment blocks localhost browser startup, record the exact sandbox or
port-bind failure in `docs/technical/testing.md` and keep the source, numeric,
golden and artifact checks as the minimum accepted evidence.

## Rollback plan

Because this is a move-only ownership refactor, rollback should be simple:

- restore the moved MonsterCard declarations in `simulation.ts`;
- restore direct imports from `simulation.ts`;
- remove `monster-card.ts` and the new focused test file;
- keep any documentation note that explains why the split was deferred.

Do not refresh numeric baselines, visual baselines or generated artifacts as a
rollback step.

## Open questions

- None for the specced ownership split.
- Broader decomposition of the main simulation adapter remains conditional on a
  concrete maintenance problem beyond the current MonsterCard family.

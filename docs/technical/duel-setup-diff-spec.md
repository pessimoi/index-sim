# Duel setup diff and impact explanation specification

- Status: accepted for implementation
- Date: 2026-07-11
- Owner: technical docs
- Source: approved post-V1 extension Goal 1
- Feature-inventory parent: `Duel snapshots` (`Valmis`)
- Related decisions: D-031, D-042, D-049, D-059 and D-067

## Purpose

Extend the completed Duel workflow so a user can understand both what differs
between a saved snapshot and the active setup and how the calculated outputs
differ on the current target.

This is a bounded next phase of the existing `Valmis` feature. It does not
create another snapshot model, change simulation formulas or reopen account-
backed/shared Duel collections.

## Existing behavior

The current Duel pane already:

- stores normalized `CombatSetupFormState` snapshots in a separate version 1
  local persistence envelope;
- compares live plus saved setups against the active target;
- shows max hit, DPS, XP/hr, net GP/hr, GP/XP and kills/hr;
- computes row deltas for DPS, XP/hr, net GP/hr and GP/XP, although the current
  table only renders the latter three;
- exposes best markers, Load/Delete/Rename, import/export and an on-demand
  all-monster matrix;
- keeps calculated results out of persisted snapshot data.

The missing user-facing phase is a structured setup-field diff and a broader,
clearly bounded result-impact explanation.

## Comparison contract

Every snapshot row is compared with the normalized current live form after the
snapshot monster id is replaced with the active target, matching the existing
Duel simulation contract.

Compare only inputs that can affect the current Duel calculation or the setup
that Load would apply:

- active combat style and attack style;
- player combat levels;
- active weapon, relevant ammo/spell and all equipment slots;
- active prayers and boosts;
- sustained/repot policy;
- special-attack weapon/ammo;
- manual accuracy, damage and speed overrides;
- ring of wealth;
- Trip food, banking, potion, prayer, reserve, survival, safespot/protection,
  scarce-spot and recoil inputs.

Do not report these as snapshot differences:

- monster id, because every row intentionally uses the current target;
- inactive per-style loadout caches, because they do not affect the compared
  row result;
- Planner targets, because they are not simulation inputs;
- current PriceSet, cannon settings, per-monster loot actions or loot settings,
  because the existing Duel calculation shares those current contexts across
  live and snapshot rows;
- calculated output, warnings, provenance or raw data.

The detail panel must state the shared-context boundary instead of implying
that shared values belong to the snapshot.

## View-model contract

Extend `DuelComparisonRowViewModel` with a non-persisted setup diff for snapshot
rows. The live row has no diff.

Each changed-field item contains:

- stable id;
- category;
- user-facing label;
- formatted live value;
- formatted snapshot value.

Categories are ordered and grouped as:

1. Combat
2. Levels
3. Loadout
4. Gear
5. Prayers and boosts
6. Special and overrides
7. Trip

Entity ids must be converted through the active validated game data or existing
UI option labels. Missing labels fall back to sanitized ids; no provenance path
or parser diagnostic is exposed.

Expand result deltas to cover:

- max hit;
- DPS;
- hit chance in percentage points;
- TTK seconds;
- effective XP/hr;
- effective net GP/hr;
- GP/XP when both values exist;
- kills/hr;
- kills/trip;
- supply cost/hr.

The explanation may summarize differences but must not claim that one specific
field caused a metric change when several inputs differ. Wording is comparative
(`Compared with live`) rather than causal (`Weapon increased DPS`). Non-finite
or unavailable metrics render as unavailable, not fake zero.

## UI behavior

- Keep the current dense Duel table and persistence/actions unchanged.
- Render the already-computed DPS delta in the DPS cell.
- Add one `Review diff` action for snapshot rows.
- The action toggles an accessible detail row linked with `aria-expanded` and
  `aria-controls`; at most one snapshot diff is expanded at a time.
- The panel shows a compact impact grid, grouped changed fields and the shared-
  context note.
- A setup with no effective input differences shows an explicit zero-change
  state and retains zero metric deltas.
- Loading, renaming, deleting, importing or exporting snapshots behaves exactly
  as before. Expanded-row state is UI-only and is never persisted.
- Desktop, tablet and mobile layouts must keep the comparison table horizontally
  contained and the expanded content readable without page-width overflow.

## State and security boundaries

- Do not change `DuelSnapshotsState`, its storage key or version.
- Do not add diff/output fields to export or legacy migration payloads.
- Do not add fields to `SimulationRequest`.
- Do not persist expanded UI state or calculated differences.
- Do not expose raw source paths, provenance payloads, parser issues, player
  identity, prices beyond existing calculated metrics or external request data.
- No auth, account, tenant, database, deployment or provider change.

## Documentation updates

- Add this spec to the technical documentation map.
- Extend the `Duel snapshots` feature-inventory note without changing `Valmis`.
- Update UI parity, testing, rewrite parity and backlog evidence.
- Record the accepted comparison/shared-context boundary as D-068.

## Tests

At minimum:

- view-model tests for ordered/grouped loadout, level, gear, prayer/boost,
  special/override and Trip differences;
- prove the target id, inactive loadouts and Planner targets are excluded;
- prove snapshot rows use active game-data labels and have finite deltas;
- prove live rows have no setup diff and snapshots remain calculation-free;
- focused Playwright coverage for opening/closing a diff, visible before/after
  values, impact deltas and unchanged Load behavior;
- refresh reviewed Duel visual baselines if the expanded panel changes them;
- `npm run typecheck`, focused unit tests and `git diff --check`;
- full `npm run verify` before delivery.

## Done when

- every snapshot row can explain its effective input differences from live;
- the UI shows the agreed metric deltas, including DPS;
- shared current contexts are labeled and never misrepresented as snapshot data;
- no snapshot/persistence/request schema changes occur;
- focused unit/browser/visual evidence passes or an exact environment limitation
  is recorded;
- owning docs and backlog are current;
- the change is committed and pushed to `master` before Goal 2 starts.

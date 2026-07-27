# Cannon finite occupancy, cost and presentation specification

- Status: implemented
- Date: 2026-07-17
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose

This specification owns the current Dwarf multicannon calculation and visible
presentation contract. It replaces the former sparse-spot shortcut that could
declare the cannon idle whenever unrestricted player DPS exceeded the available
spawn supply.

The implemented result must answer three different questions without mixing
their outputs:

1. What are the actual combined player-plus-cannon rates at this spot?
2. How much does the cannon improve kills/hr over the same player at the same
   spot without cannon damage?
3. What theoretical DPS would this cannon produce if the player remained
   combat-eligible but dealt no damage?

Only the first calculation may feed effective K/hr, XP/hr, GP/hr, supply and
trip results. The third is the comparison-only `Cannon only DPS` metric.

## Accepted source evidence

The accepted game-content reference is LostCityRS/Content Revision 274
[`cannon_fire.rs2`](https://github.com/LostCityRS/Content/blob/274/scripts/quests/quest_mcannon/scripts/cannon_fire.rs2).
The script advances the cannon through eight directions one game tick at a time
and fires when the current direction contains a valid target. It does not
define a minimum target count, so `Mobs at spot < 7` must not by itself produce
an idle result.

The runtime does not expose exact spawn coordinates, synchronized spawn phases
or target-to-direction occupancy to this simulator. D-100 therefore accepts a
finite expected-occupancy model over the available target-count and respawn
inputs instead of inventing exact spatial behavior.

## Scope

This specification covers:

- finite target occupancy for sparse cannon spots;
- combined player-plus-cannon rates;
- same-spot player-only K/hr comparison;
- theoretical cannon-only DPS;
- cannonball usage, price warnings and supply/net-GP routing;
- cannon status and metric presentation;
- per-monster settings, Trip sparse linking and reset behavior;
- desktop control alignment and responsive stacking;
- focused unit, integration, browser and visual acceptance evidence.

## Non-goals

This goal does not add:

- exact spawn positions or pathing;
- synchronized respawn timers;
- an input for how many targets share one cannon direction;
- exact multi-target/double-hit geometry;
- a player-AFK mode or a persisted `player deals zero damage` setting;
- a separate cannon accuracy stat or equipment formula;
- new persistence, setup-sharing or migration schema versions;
- a second cost or XP stream for theoretical `Cannon only DPS`.

## Ownership

- `src/domain/trip/index.ts` owns occupancy, shot rate, cannon damage, cannon
  supply, trip quantities, warnings and effective economy inputs.
- `src/domain/simulation/index.ts` owns effective player and cannon XP
  composition after trip efficiency.
- `src/app/state/ui-state.ts` owns the versioned per-monster Cannon schema and
  defaults.
- `src/app/App.tsx` owns current-monster mutation, persistence, reset and the
  explicit Cannon-to-Trip sparse synchronization bridge.
- `src/app/components/panes/cannon-pane.tsx` owns pure status, copy, metric
  formatting and control presentation.
- `src/app/styles.css` owns desktop alignment and responsive layout.

The historical component extraction boundary remains documented in
[cannon-pane-extraction-spec.md](cannon-pane-extraction-spec.md). That document
does not own the D-100 formulas.

## Input and state contract

### Per-monster settings

The persisted `CannonSettings` row remains:

```ts
interface CannonSettings {
  enabled?: boolean;
  targets?: number | null;
  respawnSec?: number | null;
}
```

The rewrite schema normalizes it to:

- `enabled`: boolean, default `false`;
- `targets`: integer `1..8`, default `3`;
- `respawnSec`: integer `1..3600` or `null`, default `null`;
- `null` respawn: current monster respawn when present, otherwise `60` seconds.

Settings remain keyed by monster. Reset deletes only the current monster's
custom Cannon row and restores the defaults; it must not reset Trip sparse
state.

### Calculation prerequisites

The combined overlay exists only when:

- Cannon is enabled;
- current player DPS is positive; and
- effective target HP is positive.

`Cannon only DPS` is an internal comparison branch of a valid combined overlay.
It sets damage contribution from the player to zero while retaining the
assumption that the player remains combat-eligible. It is not an independently
selectable no-player-combat simulation mode.

### Combat and price inputs

- Cannon accuracy uses the current combat result's `hitChance`.
- Maximum cannonball hit is `min(30, monster.cannonMax ?? 30)`.
- Mean damage on an accurate cannonball is half the maximum hit.
- One full cannon rotation is eight `0.6 s` game ticks, or `4.8 s`.
- Cannonball price uses the active `PriceSet` key `mcannonball`.
- Missing cannonball price uses the reviewed numeric fallback `180` and emits
  the normal structured fallback warning when the cannon consumes balls.

## Finite occupancy model

### Definitions

Let:

- `N` = configured spawns (`Mobs at spot`);
- `R` = respawn seconds;
- `H` = effective target HP;
- `D_p` = player DPS while a target is available;
- `p` = current hit chance;
- `M` = maximum cannonball hit;
- `T = 4.8 s` = full eight-direction rotation;
- `c = p × (M / 2) / T` = cannon DPS per average live target;
- `E` = expected number of live targets, bounded to `[0, N]`.

Because the UI does not know spawn phases, each spawn's alive state is modeled
as independent. The alive fraction is `q(E) = E / N`, and the probability that
at least one target is alive for the player is:

```text
U(E) = 1 - (1 - E / N)^N
```

Combined kills per second while at the spot are:

```text
K(E) = (D_p × U(E) + c × E) / H
```

Expected live and respawning targets must balance:

```text
E + K(E) × R = N
```

The implementation solves this monotonic balance deterministically with 64
bisection iterations over `[0, N]`. It must return finite, bounded outputs for
every schema-valid input.

### Combined player-plus-cannon branch

The combined branch uses the actual positive `D_p` and `c`:

```text
effective targets = E_combined
player active fraction = U(E_combined)
cannon DPS = c × E_combined
balls/s = E_combined / T
combined kills/s = K(E_combined)
TTK = 1 / combined kills/s
cycle = TTK + per-kill overhead
kills/hr = 3600 / cycle
```

The player's own DPS therefore competes with the cannon for finite live-target
time. On a sparse spot, combined `Cannon DPS` can be lower than theoretical
`Cannon only DPS` even while total kills/hr is higher.

### Same-spot player-only branch

The K/hr uplift denominator is not the unrestricted base combat rate. It solves
the same `N`, `R`, `H` and independent-spawn occupancy with `c = 0` and the
actual player DPS:

```text
kphNoCannon = 3600 / (1 / K_player_only + overhead)
K/hr uplift = kphWithCannon / kphNoCannon - 1
```

This keeps the comparison fair when the spot is already respawn-limited.

### Theoretical cannon-only branch

The comparison branch solves the same occupancy with `D_p = 0`:

```text
E_cannon_only + ((c × E_cannon_only) / H) × R = N
Cannon only DPS = c × E_cannon_only
```

This value must not replace combined `cannonDps` and must not enter:

- player or cannon XP/hr;
- kills/hr or effective K/hr;
- balls/hr, balls/kill or trip quantities;
- supply cost;
- GP/hr or effective net GP/hr;
- Stats source-distribution inputs.

## Cannonball usage and cost contract

All actual cannonball quantities derive from the combined branch:

```text
balls/hr = balls/s × 3600
balls/kill = balls/s / combined kills/s
ball cost/hr = balls/hr × ball price
ball cost/kill = balls/kill × ball price
cannonballs/trip = balls/kill × kills/trip
ball gp/trip = ball cost/kill × kills/trip
```

`Balls/hr` and `Ball cost/hr` are raw continuous spot-fire diagnostics. Per-kill
overhead and trip efficiency do not alter those two display values. The
effective economy path instead uses the per-kill quantity:

```text
supply.ballCostPerKill = cannon.ballCostPerKill
supplyCostPerKill = food + potions + ammo + runes + recoil + cannonballs
effective net GP/hr =
  (loot GP/hr × loot fraction - supplyCostPerKill × kills/hr) × trip efficiency
```

The cannonball term appears exactly once in `supplyCostPerKill`. Theoretical
`Cannon only DPS` creates no quantity and no cost. A used fallback/uncertain
cannonball price is relevant to the current result only when combined
`ballsPerHour > 0`.

## XP contract

Raw combined cannon Ranged XP is:

```text
Cannon Ranged XP/hr = 2 × combined cannon DPS × 3600
```

The composed effective result applies trip efficiency:

```text
cannon effective XP/hr = Cannon Ranged XP/hr × trip efficiency
effective XP/hr = player effective XP/hr + cannon effective XP/hr
```

Player combat XP uses the combined player active fraction and the player's
share of target HP. `Cannon only DPS` is never converted to XP.

## Status contract

The visible status priority is:

1. `off` when the per-monster toggle is disabled;
2. `idle` only when a valid overlay explicitly reports `ballsPerSec === 0`;
3. `respawn-bound` when the cannon fires and player active fraction is below
   `0.999`;
4. `active` otherwise.

There is no target-count threshold in this state machine. In particular,
`targets = 1..6` must not imply `idle`. A one-target, long-respawn spot must
retain small positive effective targets, cannon DPS and ball consumption and
normally present as `respawn-bound`.

The idle copy remains a defensive presentation state for a future genuinely
zero-shot domain result:

```text
Idle: this spot is too sparse for the cannon to fire.
```

It must not be used to describe merely low occupancy.

## Cannon pane presentation contract

### Controls

The desktop control row remains, in order:

1. `Set up cannon` toggle;
2. `Mobs at spot` number field (`1..8`);
3. `Respawn` number field (`1..3600`);
4. `Link Trip sparse` toggle;
5. `Reset monster cannon` button.

Both toggle containers and the action container align to the bottom of the
five-column grid. Toggle controls and the reset button use the same `2.15rem`
minimum height. At the existing narrow breakpoint, the grid becomes one column
without fixed horizontal overflow.

### Trip sparse linking

- Enabling `Link Trip sparse` enables Trip scarce mode and copies the current
  Cannon target count and respawn seconds.
- While the assumptions are linked, editing either Cannon numeric control also
  updates its Trip counterpart.
- Unlinking disables Trip scarce mode but retains its numeric values.
- Resetting Cannon settings does not mutate Trip sparse state.

### Enabled metric order

The primary metric list remains in this exact order:

1. `Effective targets`
2. `Cannon DPS`
3. `Cannon only DPS`
4. `Balls/hr`
5. `Balls/kill`
6. `Cannon Ranged XP/hr`
7. `Effective XP/hr`
8. `Effective net GP/hr`
9. `Ball cost/hr`
10. `Ball cost/kill`
11. `Ball price`
12. `Cannonballs/trip`
13. `Ball gp/trip`
14. `K/hr uplift`

`Cannon DPS` and `Cannon only DPS` use two-decimal teal presentation. Cost and
net-GP values retain gold presentation. The secondary list continues to show
accuracy rule, XP rule, supply impact, sparse link, inventory reserve and Trip
sparse K/hr.

When disabled, both DPS values render as `0.00`, combined ball quantities/cost
render as zero or unavailable, and already calculated non-cannon effective XP
and net GP remain visible.

## Persistence and compatibility

- Existing rewrite setup envelopes remain valid; no version bump is required.
- Existing per-monster Cannon rows retain their current defaults and bounds.
- Setup sharing and compatible legacy Cannon-map migration keep the same schema.
- The D-100 numeric change is an accepted intentional delta from the archived
  sparse hard-idle behavior, not a legacy-parity regression.
- Cannon settings remain shared per monster rather than stored in an individual
  combat-style loadout or Duel snapshot.

## Acceptance criteria

### Domain and economy

- A schema-valid one-target sparse spot with positive combat inputs produces
  finite positive effective targets, balls/hr and combined cannon DPS.
- No `targets < 7` branch or equivalent minimum-mob idle rule exists.
- Effective targets stay in `[0, N]`; player active fraction stays in `[0, 1]`.
- Combined cannon damage uses actual player competition for target occupancy.
- Player-only uplift uses the same spot, not unrestricted base K/hr.
- Theoretical cannon-only DPS uses zero player damage and remains comparison-only.
- Ball cost/hr, cost/kill and cost/trip reconcile exactly with their quantities
  and the active cannonball price.
- Supply includes `ballCostPerKill` exactly once, and effective net GP/hr changes
  through the combined supply path.
- Cannon effective XP derives from combined cannon DPS only.
- Missing/uncertain used cannonball prices retain structured relevance warnings.

### UI and state

- `Cannon only DPS` appears immediately after combined `Cannon DPS` in enabled
  and disabled output.
- A sparse positive-fire case shows `respawn-bound`, not `idle`.
- Existing active, off, defensive idle and divergent Trip-link copy remains
  covered.
- Desktop toggles, number inputs and reset action share a consistent bottom
  edge and control height.
- Narrow layouts stack controls in one column.
- Link, live numeric synchronization, unlink and reset obey the explicit Trip
  ownership rules above.

## Test matrix

| Case                     | Required evidence                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Cannon disabled          | Null overlay; zero/unavailable Cannon metrics; base effective outputs remain visible.                       |
| One target, long respawn | Positive finite shots/DPS/cost, `respawn-bound`, never target-count idle.                                   |
| Several sparse targets   | Finite bounded occupancy and monotonic balance.                                                             |
| Dense targets            | Active or bounded status without exceeding configured targets.                                              |
| Player competition       | Combined Cannon DPS is lower than cannon-only DPS when the player consumes target uptime.                   |
| Same-spot uplift         | `kphNoCannon` comes from player-only occupancy and positive cannon damage improves combined K/hr.           |
| Cannon-only isolation    | Changing/exposing the comparison value does not change XP, GP, supply, K/hr or histogram inputs.            |
| Price accounting         | Hour, kill and trip costs equal quantity times price; supply receives the kill cost once.                   |
| Missing ball price       | Fallback value is finite and the warning is current-result relevant only while balls are used.              |
| XP routing               | Combined raw cannon XP and efficiency-adjusted effective cannon XP reconcile; theoretical DPS is excluded.  |
| Trip linking             | Link copies values, linked edits synchronize, unlink preserves numbers, Cannon reset leaves Trip untouched. |
| Pane contract            | Exact labels/order/precision/status copy and aligned desktop controls.                                      |
| Browser numerics         | Cannon-enabled Dagannoth output matches the composed result and accepted numeric snapshot.                  |
| Visual regression        | Reviewed desktop Cannon image confirms aligned controls and the added comparison metric.                    |

## Required validation

For a future formula, routing or visible-contract change, run:

```sh
npm run test -- src/tests/trip-loot-supply.test.ts src/tests/xp-parity.test.ts src/tests/stats-view-model.test.ts src/tests/cannon-pane.test.ts
npm run test:golden
npm run typecheck
npm run architecture:check
npm run test:e2e -- --workers=1 --grep "enables cannon|matches browser-rendered dense numeric snapshots"
npm run test:e2e:visual -- --workers=1 --grep "Cannon desktop"
npm run verify
git diff --check
```

Playwright and visual commands require the compatible browser/localhost
environment described in [testing.md](testing.md). Baseline writes remain
explicit review actions, not automatic acceptance.

## Open questions and reopen triggers

- Exact position, target direction, spawn synchronization or multi-target
  geometry requires new explicit inputs and Revision 274 evidence before this
  expected-occupancy model may be replaced.
- A true player-deals-zero/AFK operating mode requires an explicit combat
  eligibility contract; the comparison-only metric does not authorize one.
- Revisit the independent-spawn assumption only with concrete source/runtime
  evidence or a user-facing phase/geometry input that can support a more exact
  model.
- Revisit the `Ball cost/hr` label only if the UI needs to distinguish its raw
  continuous-fire diagnostic more explicitly from efficiency-adjusted effective
  net GP/hr. The current calculation ownership must remain unchanged during a
  label-only pass.

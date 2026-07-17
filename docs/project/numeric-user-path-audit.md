# Numeric user-path audit

- Status: cross-path clean
- Date: 2026-07-17
- Runtime: source-backed generated Revision 274 snapshot with scheduled static prices and generated fallbacks
- Scope: Result, Dense Compare, calculation worker, Duel live, Duel matrix, saved setup round-trip and archived legacy golden evidence

## Cross-path consistency

- Generated matrix: 189 monster/combat-style cases
- Golden setup variants: 18 cases
- Numeric path comparisons: 5958
- Mismatches above abs 1e-9 and relative 1e-9: 0

All audited current-runtime paths produced the same numeric values within the audit tolerance.

## Fixes made during this audit

- `FullSimulationResult.rates.ttkSec` now uses the Trip path's cannon/poison/recoil-adjusted kill time. The prior combat-only value disagreed with the same result's kills/hr, XP/hr and economy rates when auxiliary damage was active.
- Stats combat-roll detail continues to expose the normal player-combat TTK separately.
- Ordinary caskets use the exact Revision 274 opened-content table; the generated parent object cost cannot override the component EV.
- D-100 replaces the false minimum-mob cannon idle threshold with finite independent-spawn occupancy and keeps theoretical cannon-only DPS out of effective rates and supply cost.

## Source-backed casket correction

The focused correction compares the prior generated parent object cost with the current component-derived opened value. It is classified separately from generic market-price differences.

| Monster                           | Drop chance | Previous parent value | Opened contents EV | GP/kill delta | Classification       |
| --------------------------------- | ----------: | --------------------: | -----------------: | ------------: | -------------------- |
| Dagannoth (lvl 74) (dagannoth)    |        0.8% |                 50.00 |              3,384 |         26.05 | source-backed-casket |
| Dagannoth (lvl 92) (dagannoth_92) |        0.8% |                 50.00 |              3,384 |         26.05 | source-backed-casket |
| Rock Crab (rock_crab)             |        0.8% |                 50.00 |              3,384 |         26.05 | source-backed-casket |

## Large legacy-to-rewrite observations

- Compared metric values: 198
- Large threshold findings: 17
- Unclassified findings needing review: 0

Legacy comparisons are evidence, not current runtime truth. Economy deltas are expected when embedded legacy prices differ from the scheduled/generated PriceSet. A finding requires both the metric-specific absolute and relative threshold to be exceeded.

| Fixture                                      | Metric                |   Legacy |  Rewrite | Relative delta | Classification | Note                                                                                                                                           |
| -------------------------------------------- | --------------------- | -------: | -------: | -------------: | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| magic_fire_bolt_chaos_druid_alch             | effectiveNetGpPerHour |   34,900 |  -48,870 |         171.4% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks.                                        |
| ranged_steel_knives_chaos_druid_inventory    | effectiveNetGpPerHour | -345,261 |  244,739 |         170.9% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks.                                        |
| ranged_steel_knives_chaos_druid_inventory    | supplyCostPerKill     |    2,275 |    84.80 |          96.3% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks.                                        |
| ranged_yew_longbow_black_demon_no_recovery   | effectiveNetGpPerHour |  -28,711 |  -87,888 |          67.3% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks.                                        |
| ranged_magic_shortbow_dagannoth_cannon       | effectiveNetGpPerHour | -256,270 | -511,399 |          49.9% | price-source   | Legacy uses embedded prices; rewrite uses scheduled/generated prices plus D-100 finite cannon occupancy.                                       |
| ranged_magic_shortbow_greater_demon_spec     | effectiveNetGpPerHour |  -11,661 |  -22,589 |          48.4% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks.                                        |
| ranged_magic_shortbow_dagannoth_cannon       | supplyCostPerKill     |   812.03 |    1,556 |          47.8% | price-source   | Legacy uses embedded prices; rewrite uses scheduled/generated prices plus D-100 finite cannon occupancy.                                       |
| ranged_magic_shortbow_dagannoth_cannon       | effectiveXpPerHour    |   44,558 |   82,748 |          46.2% | accepted-delta | D-100 replaces the legacy sparse hard-idle formula with finite player-plus-cannon occupancy; rewrite XP also composes the combined cannon row. |
| magic_water_bolt_tribesman_poison_safespot   | effectiveNetGpPerHour |  -86,417 | -157,387 |          45.1% | accepted-delta | D-055 accepts source-backed Revision 274 Tribesman combat and loot deltas.                                                                     |
| ranged_yew_longbow_black_demon_no_recovery   | supplyCostPerKill     |    2,645 |    4,754 |          44.4% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks.                                        |
| melee_black_dragon_food_limited_trip         | effectiveNetGpPerHour |  -42,521 |  -27,306 |          35.8% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks.                                        |
| magic_water_bolt_tribesman_poison_safespot   | supplyCostPerKill     |    1,388 |    2,145 |          35.3% | accepted-delta | D-055 accepts source-backed Revision 274 Tribesman combat and loot deltas.                                                                     |
| magic_fire_bolt_chaos_druid_alch             | supplyCostPerKill     |   855.13 |    1,216 |          29.7% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks.                                        |
| melee_rune_scimitar_hill_giant_super_prayers | effectiveNetGpPerHour | -109,053 |  -80,658 |          26.0% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks.                                        |
| magic_water_bolt_tribesman_poison_safespot   | ttkSec                |    20.27 |    25.89 |          21.7% | accepted-delta | D-055 accepts source-backed Revision 274 Tribesman combat and loot deltas.                                                                     |
| magic_water_bolt_tribesman_poison_safespot   | killsPerHour          |   158.09 |   126.83 |          19.8% | accepted-delta | D-055 accepts source-backed Revision 274 Tribesman combat and loot deltas.                                                                     |
| magic_water_bolt_tribesman_poison_safespot   | effectiveKph          |   132.15 |   110.40 |          16.5% | accepted-delta | D-055 accepts source-backed Revision 274 Tribesman combat and loot deltas.                                                                     |

## Interpretation boundaries

- Zero cross-path mismatches means the current Result/Dense/Duel/worker presentations agree; it does not prove the underlying formula is historically correct.
- Legacy price and archived trip-model differences are not silently accepted as rewrite truth.
- Browser display formatting remains covered separately by the all-fixture Playwright metric-strip and release-path numeric snapshot cases.
- Planner legacy parity remains the separately bounded `npm run planner:parity` audit.

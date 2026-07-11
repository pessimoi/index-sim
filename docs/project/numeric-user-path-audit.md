# Numeric user-path audit

- Status: cross-path clean
- Date: 2026-07-11
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

## Large legacy-to-rewrite observations

- Compared metric values: 198
- Large threshold findings: 17
- Unclassified findings needing review: 0

Legacy comparisons are evidence, not current runtime truth. Economy deltas are expected when embedded legacy prices differ from the scheduled/generated PriceSet. A finding requires both the metric-specific absolute and relative threshold to be exceeded.

| Fixture                                      | Metric                |   Legacy |  Rewrite | Relative delta | Classification | Note                                                                                                    |
| -------------------------------------------- | --------------------- | -------: | -------: | -------------: | -------------- | ------------------------------------------------------------------------------------------------------- |
| magic_fire_bolt_chaos_druid_alch             | effectiveNetGpPerHour |   34,900 |  -42,836 |         181.5% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks. |
| ranged_steel_knives_chaos_druid_inventory    | effectiveNetGpPerHour | -345,261 |  237,119 |         168.7% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks. |
| ranged_steel_knives_chaos_druid_inventory    | supplyCostPerKill     |    2,275 |    84.80 |          96.3% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks. |
| ranged_yew_longbow_black_demon_no_recovery   | effectiveNetGpPerHour |  -28,711 |  -89,335 |          67.9% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks. |
| ranged_magic_shortbow_greater_demon_spec     | effectiveNetGpPerHour |  -11,661 |  -30,619 |          61.9% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks. |
| ranged_magic_shortbow_dagannoth_cannon       | effectiveNetGpPerHour | -256,270 | -516,801 |          50.4% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks. |
| ranged_magic_shortbow_dagannoth_cannon       | effectiveXpPerHour    |   44,558 |   84,897 |          47.5% | accepted-delta | Rewrite XP/HR composes player and cannon effective XP; legacy keeps cannon XP in a separate row.        |
| ranged_magic_shortbow_dagannoth_cannon       | supplyCostPerKill     |   812.03 |    1,524 |          46.7% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks. |
| ranged_yew_longbow_black_demon_no_recovery   | supplyCostPerKill     |    2,645 |    4,754 |          44.4% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks. |
| magic_water_bolt_tribesman_poison_safespot   | effectiveNetGpPerHour |  -86,417 | -147,179 |          41.3% | accepted-delta | D-055 accepts source-backed Revision 274 Tribesman combat and loot deltas.                              |
| magic_water_bolt_tribesman_poison_safespot   | supplyCostPerKill     |    1,388 |    2,068 |          32.9% | accepted-delta | D-055 accepts source-backed Revision 274 Tribesman combat and loot deltas.                              |
| melee_black_dragon_food_limited_trip         | effectiveNetGpPerHour |  -42,521 |  -29,180 |          31.4% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks. |
| magic_fire_bolt_chaos_druid_alch             | supplyCostPerKill     |   855.13 |    1,175 |          27.2% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks. |
| melee_rune_scimitar_hill_giant_super_prayers | effectiveNetGpPerHour | -109,053 |  -80,579 |          26.1% | price-source   | Legacy uses embedded gamedata.js prices; rewrite uses scheduled static prices plus generated fallbacks. |
| magic_water_bolt_tribesman_poison_safespot   | ttkSec                |    20.27 |    25.89 |          21.7% | accepted-delta | D-055 accepts source-backed Revision 274 Tribesman combat and loot deltas.                              |
| magic_water_bolt_tribesman_poison_safespot   | killsPerHour          |   158.09 |   126.83 |          19.8% | accepted-delta | D-055 accepts source-backed Revision 274 Tribesman combat and loot deltas.                              |
| magic_water_bolt_tribesman_poison_safespot   | effectiveKph          |   132.15 |   110.40 |          16.5% | accepted-delta | D-055 accepts source-backed Revision 274 Tribesman combat and loot deltas.                              |

## Interpretation boundaries

- Zero cross-path mismatches means the current Result/Dense/Duel/worker presentations agree; it does not prove the underlying formula is historically correct.
- Legacy price and archived trip-model differences are not silently accepted as rewrite truth.
- Browser display formatting remains covered separately by the all-fixture Playwright metric-strip and release-path numeric snapshot cases.
- Planner legacy parity remains the separately bounded `npm run planner:parity` audit.

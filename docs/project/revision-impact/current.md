# Current Game Revision Impact

Status: raw LostCity source report.

## Source

- Source ref: LostCityRS/Content / 274 / 376072662e78a314bf35bb18815be39521491a6b
- Source path: `.sources/lostcity-content`
- Generated at: 2026-07-09T00:00:00.000Z
- Generator version: raw-lostcity-runtime-catalog-5
- Generator command: `npm run data:generate -- --source-dir .sources/lostcity-content --output-root . --generated-at 2026-07-09T00:00:00.000Z --game-revision 274 --impact-outlier-limit 25`

## Runtime Status

- Runtime bootstrap: source-backed generated snapshot.
- The Vite app loads committed `src/data/generated/game-data.json` with scheduled static prices and generated item fallbacks.
- The legacy-derived static bridge remains regression/reference evidence and is not the root runtime.

## Validation Status

- `GameDataSnapshotSchema`: pass
- `game-data.json`: generated and schema-valid
- `source-pin.json`: generated JSON
- `revision-impact/current.md`: generated
- Output hygiene: pass
- Source item id uniqueness and alias-map collision gates: pass
- Diff baseline: valid at `src/data/generated/legacy-derived-runtime-game-data.json`
- Calculation-impact suite: pass (11 pass, 0 needs-review, 0 failed)
- Informational all-monster scan: outliers-found (38 outliers, 25 shown)

## Snapshot Diff Summary

| Section | Added | Removed | Changed |
| --- | ---: | ---: | ---: |
| items | 19 | 0 | 371 |
| monsters | 0 | 0 | 63 |
| weapons | 0 | 0 | 17 |
| ammo | 0 | 0 | 10 |
| spells | 0 | 0 | 0 |
| requirements | 94 | 0 | 0 |
| equipment | 0 | 0 | 6 |
| drops | 91 | 51 | 1048 |

- items added: `2dose2antipoison`, `3dose2antipoison`, `adamant_javelin`, `black_dagger_p`, `black_mace`, `black_med_helm`, `black_robe`, `blackwizhat`, +11 more
- items removed: none
- items changed: `1dose2defense`, `2dose1strength`, `3dose1defense`, `3doseantipoison`, `adamant_arrow`, `adamant_axe`, `adamant_dart`, `adamant_dart_p`, +363 more

- monsters added: none
- monsters removed: none
- monsters changed: `al_kharid_warrior`, `baby_blue_dragon`, `bandit`, `barbarian`, `bear`, `black_demon`, `black_dragon`, `black_knight`, +55 more

- weapons added: none
- weapons removed: none
- weapons changed: `addy_dart_w`, `addy_knife_w`, `bronze_dart_w`, `bronze_knife_w`, `dragon_dagger`, `dragon_dagger_p`, `iron_dart_w`, `iron_knife_w`, +9 more

- ammo added: none
- ammo removed: none
- ammo changed: `addy_dart`, `addy_knife`, `bronze_knife`, `iron_knife`, `mith_dart`, `mith_knife`, `rune_dart`, `rune_knife`, +2 more

- requirements added: `adamant_full_helm`, `adamant_kite`, `adamant_platebody`, `adamant_platelegs`, `adamant_scimitar`, `addy_dart_w`, `addy_knife_w`, `archer_helm`, +86 more
- requirements removed: none
- requirements changed: none

- equipment added: none
- equipment removed: none
- equipment changed: `amulet.unholy_symbol`, `body.monk_robe_top`, `gloves.chaos_gauntlets`, `legs.monk_robe_bottom`, `ring.ring_of_recoil`, `ring.ring_of_wealth`

- drops added: `al_kharid_warrior.18`, `bandit.19`, `barbarian.20`, `black_demon.21`, `black_dragon.20`, `black_dragon.22`, `black_knight.23`, `blue_dragon.21`, +83 more
- drops removed: `bandit.19.0`, `black_demon.21.0`, `black_dragon.20.0`, `black_knight.23.0`, `blue_dragon.21.0`, `chaos_druid.16.0`, `chaos_druid.8`, `chaos_druid_warrior.19.0`, +43 more
- drops changed: `al_kharid_warrior.0`, `al_kharid_warrior.1`, `al_kharid_warrior.10`, `al_kharid_warrior.11`, `al_kharid_warrior.12`, `al_kharid_warrior.13`, `al_kharid_warrior.14`, `al_kharid_warrior.15`, +1040 more

## Calculation Impact

- Representative suite: pass
- Cases: 11 run, 11 pass, 0 needs-review, 0 failed
- Case filter: none
- Price set: Current prices.json + generated item fallbacks
- Metrics: DPS, kills/hr, XP/hr, GP/hr and GP/XP deltas only.
- Accepted changed cases: 11; each accepted delta cites its owning decision in the case notes.

| Case | Tags | Status | DPS Δ | Kills/hr Δ | XP/hr Δ | GP/hr Δ | GP/XP Δ | Notes |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `raw_melee_giant` | `raw-source`, `melee`, `giant` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -9.512215 (-0.007671%) | -0.000199 (-0.007671%) | Accepted source-backed monster combat and core-loot delta under D-055; economy metrics use generated high alch under D-063. |
| `raw_ranged_giant` | `raw-source`, `ranged`, `giant` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -7.941053 (-0.008176%) | -0.000199 (-0.008176%) | Accepted source-backed monster combat and core-loot delta under D-055; economy metrics use generated high alch under D-063. |
| `raw_magic_giant` | `raw-source`, `magic`, `giant` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -1.283459 (+0.008871%) | -0.00012 (+0.008871%) | Accepted source-backed monster combat and core-loot delta under D-055; economy metrics use generated high alch under D-063. |
| `raw_melee_black_dragon` | `raw-source`, `melee`, `black_dragon` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -830.574189 (-1.175191%) | -0.099578 (-1.175191%) | Accepted source-backed monster combat and core-loot delta under D-055; economy metrics use generated high alch under D-063. |
| `raw_ranged_black_dragon` | `raw-source`, `ranged`, `black_dragon` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -610.441544 (-1.340333%) | -0.099578 (-1.340333%) | Accepted source-backed monster combat and core-loot delta under D-055; economy metrics use generated high alch under D-063. |
| `raw_magic_black_dragon` | `raw-source`, `magic`, `black_dragon` | pass | -0.225848 (-75.805749%) | -4.268003 (-75.805749%) | -2700.37 (-26.617975%) | -36761.03 (-214.819605%) | -4.326133 (-256.468297%) | Accepted source-backed monster combat and core-loot delta under D-055; economy metrics use generated high alch under D-063. |
| `raw_melee_dark_wizard_20` | `raw-source`, `melee`, `dark_wizard_20` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -9.667501 (-0.011966%) | -0.000209 (-0.011966%) | Accepted source-backed monster combat and core-loot delta under D-055; economy metrics use generated high alch under D-063. |
| `raw_ranged_dark_wizard_20` | `raw-source`, `ranged`, `dark_wizard_20` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -8.368222 (-0.013171%) | -0.000209 (-0.013171%) | Accepted source-backed monster combat and core-loot delta under D-055; economy metrics use generated high alch under D-063. |
| `raw_magic_dark_wizard_20` | `raw-source`, `magic`, `dark_wizard_20` | pass | -0.040106 (-12.765378%) | -5.893132 (-12.765378%) | -497.498204 (-4.800924%) | -1366.41 (+6.663916%) | -0.238299 (+12.043016%) | Accepted source-backed monster combat and core-loot delta under D-055; economy metrics use generated high alch under D-063. |
| `raw_thrown_rune_knife_black_dragon` | `raw-source`, `ranged`, `thrown`, `high-tier` | pass | +0.18755 (+28.409091%) | +3.502876 (+28.409091%) | +3547.36 (+28.409091%) | +28461.47 (-2.601133%) | +21.161952 (-24.149555%) | Accepted source-backed thrown-weapon accuracy delta under D-057; economy metrics use generated high alch under D-063. |
| `raw_dragon_halberd_rock_crab_size` | `raw-source`, `melee`, `special-attack`, `npc-size` | pass | -0.108235 (-4.671338%) | -7.116852 (-4.671338%) | -1896.64 (-4.671338%) | -494.867026 (-4.655996%) | +0.000042 (+0.016094%) | Accepted source-backed dragon halberd selected-target hit-count delta under D-071. |

### Informational All-Monster Scan

- Informational all-monster scan: outliers-found
- Baselines: `raw_melee`, `raw_ranged`, `raw_magic`
- Monsters scanned: 63
- Evaluations: 189
- Outliers: 38 found, 25 shown
- Outlier limit: 25
- Price set: Current prices.json + generated item fallbacks
- Thresholds: DPS/kills/hr/XP/hr over 10%; GP/hr/GP/XP over 25%.
- This scan is informational and does not change representative merge-blocking status.
- Hidden by limit: 13

| Baseline | Monster | Kind | Reasons | DPS Δ | Kills/hr Δ | XP/hr Δ | GP/hr Δ | GP/XP Δ | Warnings |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Raw magic (magic) | `bandit` / Bandit | threshold-outlier | GP/hr changed -47.594807% over 25%; GP/XP changed -47.594807% over 25% | 0 (0%) | 0 (0%) | 0 (0%) | -371.831448 (-47.594807%) | -0.035844 (-47.594807%) | 38 -> 37 |
| Raw magic (magic) | `black_dragon` / Black Dragon | threshold-outlier | DPS changed -75.805749% over 10%; kills/hr changed -75.805749% over 10%; XP/hr changed -26.617975% over 10%; GP/hr changed -214.819605% over 25%; GP/XP changed -256.468297% over 25% | -0.225848 (-75.805749%) | -4.268003 (-75.805749%) | -2700.37 (-26.617975%) | -36761.03 (-214.819605%) | -4.326133 (-256.468297%) | 60 -> 60 |
| Raw magic (magic) | `chaos_druid` / Chaos Druid | warning-count-increase | warning count increased from 45 to 56 | -0.016419 (-5.211726%) | -2.88328 (-5.211726%) | -205.001189 (-1.976394%) | -2931.9 (-11.706023%) | -0.239675 (-9.925802%) | 45 -> 56 |
| Raw magic (magic) | `chaos_druid_warrior` / Chaos Druid Warrior | warning-count-increase | warning count increased from 49 to 59 | 0 (0%) | 0 (0%) | 0 (0%) | -0.03789 (+0.004912%) | -0.000004 (+0.004912%) | 49 -> 59 |
| Raw magic (magic) | `dark_wizard` / Dark Wizard (lvl 7) | warning-count-increase | warning count increased from 26 to 27 | -0.009549 (-3.039376%) | -2.750128 (-3.039376%) | -122.270703 (-1.180346%) | -648.370792 (+6.523419%) | -0.074799 (+7.795782%) | 26 -> 27 |
| Raw magic (magic) | `dark_wizard_20` / Dark Wizard (lvl 20) | threshold-outlier | DPS changed -12.765378% over 10%; kills/hr changed -12.765378% over 10%; warning count increased from 26 to 27 | -0.040106 (-12.765378%) | -5.893132 (-12.765378%) | -497.498204 (-4.800924%) | -1366.41 (+6.663916%) | -0.238299 (+12.043016%) | 26 -> 27 |
| Raw magic (magic) | `deadly_red_spider` / Deadly red spider | threshold-outlier | kills/hr changed -42.880519% over 10% | -0.003421 (-1.085776%) | -23.722759 (-42.880519%) | +66.510614 (+0.65699%) | 0 (0%) | +0.020116 (-0.652702%) | 2 -> 1 |
| Raw magic (magic) | `druid` / Druid | threshold-outlier | DPS changed -13.897937% over 10%; kills/hr changed -13.897937% over 10%; GP/XP changed +27.816837% over 25% | -0.043783 (-13.897937%) | -5.167846 (-13.897937%) | -539.523085 (-5.200804%) | -2618.02 (+21.169334%) | -0.331615 (+27.816837%) | 26 -> 26 |
| Raw magic (magic) | `green_dragon` / Green Dragon | threshold-outlier | DPS changed -56.083869% over 10%; kills/hr changed -56.083869% over 10%; XP/hr changed -20.056058% over 10%; GP/hr changed -86.039896% over 25%; GP/XP changed -82.537633% over 25% | -0.171887 (-56.083869%) | -8.195934 (-56.083869%) | -2046.93 (-20.056058%) | -50257.88 (-86.039896%) | -4.72387 (-82.537633%) | 45 -> 45 |
| Raw magic (magic) | `icegiant` / Ice Giant | warning-count-increase | warning count increased from 35 to 36 | 0 (0%) | 0 (0%) | 0 (0%) | +81.563622 (-0.31285%) | +0.007735 (-0.31285%) | 35 -> 36 |
| Raw magic (magic) | `jungle_spider` / Jungle spider | threshold-outlier | kills/hr changed -44.43244% over 10% | -0.004846 (-1.538183%) | -17.681306 (-44.43244%) | +21.790984 (+0.213751%) | 0 (0%) | +0.006528 (-0.213295%) | 2 -> 1 |
| Raw magic (magic) | `mountain_troll` / Mountain Troll | threshold-outlier | DPS changed -15.707564% over 10%; kills/hr changed -25.021646% over 10% | -0.049484 (-15.707564%) | -3.525162 (-25.021646%) | -635.69331 (-6.040705%) | -1563.74 (+6.435715%) | -0.30659 (+13.278537%) | 32 -> 30 |
| Raw magic (magic) | `poison_spider` / Poison spider | threshold-outlier | kills/hr changed -60.96592% over 10% | -0.003991 (-1.266739%) | -27.114774 (-60.96592%) | +75.555154 (+0.742691%) | 0 (0%) | +0.02261 (-0.737216%) | 2 -> 1 |
| Raw magic (magic) | `skeleton_unarmed` / Skeleton (unarmed) | threshold-outlier | kills/hr changed +40% over 10%; GP/hr changed -54.051388% over 25%; GP/XP changed -54.045256% over 25% | 0 (0%) | +18.516246 (+40%) | -1.383994 (-0.013342%) | +7172.64 (-54.051388%) | +0.691383 (-54.045256%) | 38 -> 37 |
| Raw magic (magic) | `tribesman` / Tribesman | threshold-outlier | kills/hr changed -22.78481% over 10%; GP/hr changed +266.538956% over 25%; GP/XP changed +266.516583% over 25% | 0 (0%) | -8.472364 (-22.78481%) | +0.633266 (+0.006104%) | -7662 (+266.538956%) | -0.738527 (+266.516583%) | 45 -> 44 |
| Raw melee (melee) | `chaos_druid` / Chaos Druid | warning-count-increase | warning count increased from 44 to 55 | 0 (0%) | 0 (0%) | 0 (0%) | -4.001538 (-0.000957%) | -0.000088 (-0.000957%) | 44 -> 55 |
| Raw melee (melee) | `chaos_druid_warrior` / Chaos Druid Warrior | warning-count-increase | warning count increased from 48 to 58 | 0 (0%) | 0 (0%) | 0 (0%) | -0.27269 (-0.000125%) | -0.000006 (-0.000125%) | 48 -> 58 |
| Raw melee (melee) | `dark_wizard` / Dark Wizard (lvl 7) | warning-count-increase | warning count increased from 25 to 26 | 0 (0%) | 0 (0%) | 0 (0%) | -15.892024 (-0.010541%) | -0.000362 (-0.010541%) | 25 -> 26 |
| Raw melee (melee) | `dark_wizard_20` / Dark Wizard (lvl 20) | warning-count-increase | warning count increased from 25 to 26 | 0 (0%) | 0 (0%) | 0 (0%) | -9.667501 (-0.011966%) | -0.000209 (-0.011966%) | 25 -> 26 |
| Raw melee (melee) | `deadly_red_spider` / Deadly red spider | threshold-outlier | kills/hr changed -42.09723% over 10% | -0.128974 (-5.138016%) | -161.880743 (-42.09723%) | +545.130459 (+1.329847%) | 0 | 0 | 1 -> 0 |
| Raw melee (melee) | `icegiant` / Ice Giant | warning-count-increase | warning count increased from 34 to 35 | 0 (0%) | 0 (0%) | 0 (0%) | +584.4026 (+1.590296%) | +0.013064 (+1.590296%) | 34 -> 35 |
| Raw melee (melee) | `jungle_spider` / Jungle spider | threshold-outlier | kills/hr changed -44.01578% over 10% | -0.117998 (-4.91569%) | -120.750492 (-44.01578%) | -11.536936 (-0.028179%) | 0 | 0 | 1 -> 0 |
| Raw melee (melee) | `mountain_troll` / Mountain Troll | threshold-outlier | DPS changed +16.694716% over 10%; XP/hr changed +16.798062% over 10% | +0.340272 (+16.694716%) | +3.703033 (+4.213997%) | +6515.61 (+16.798062%) | +3229.9 (+7.502442%) | -0.088335 (-7.95871%) | 31 -> 29 |
| Raw melee (melee) | `poison_spider` / Poison spider | threshold-outlier | kills/hr changed -61.120102% over 10% | -0.177854 (-7.916031%) | -173.459316 (-61.120102%) | -176.776997 (-0.467461%) | 0 | 0 | 1 -> 0 |
| Raw melee (melee) | `skeleton_unarmed` / Skeleton (unarmed) | threshold-outlier | kills/hr changed +29.886468% over 10%; GP/hr changed +29.889841% over 25%; GP/XP changed +39.231878% over 25% | -0.082838 (-3.175542%) | +102.060627 (+29.886468%) | -3034.17 (-6.709697%) | +39536.09 (+29.889841%) | +1.147551 (+39.231878%) | 37 -> 36 |

## Current Scope

- Runtime monster combat fields and reviewed loot are parsed directly from pinned LostCity NPC config and RuneScript handlers.
- Runtime item, weapon, ammo, spell and equipment calculation fields are parsed directly from pinned LostCity object, param and dbrow configs.
- Simulator-only synthetic identities remain explicitly app-owned; four quest-gated rows and 21 clue tertiaries carry typed eligibility and stay excluded from default valuation until exact player state is modeled.
- Item skill requirements are parsed from pinned levelrequire triggers/definitions; quest completion clauses remain outside the generated contract, and NPC size comes from config with the source default of 1.
- The root browser runtime consumes this committed source-backed generated snapshot; the legacy-derived static bridge remains reference and rollback evidence.
- Source object costs provide item/alch fallbacks; scheduled PriceSet values remain outside this generator and take precedence in the staged generated runtime adapter.
- The committed calculation-impact report and the focused direct-source impact commands remain separate evidence views over the same normalized domain contract.
- Generated item requirements are consumed by Planner/setup checks and gear quick action reason copy; D-051 manual fallback remains only for runtime items without a generated row and legacy snapshots.
- Source-backed NPC size drives dragon halberd selected-target hit count; missing-size legacy snapshots retain the visible D-050 fallback.
- Market prices and market price history are outside this game-data snapshot workflow.
- Historical generated snapshot archives are intentionally not committed.

## Open Questions

- Which later product phase, if any, should model quest completion clauses that accompany some source-backed numeric item requirements?
- When can the transitional legacy-derived runtime identity reference be replaced by an app-owned generated catalog manifest?

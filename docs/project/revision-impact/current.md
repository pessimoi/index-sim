# Current Game Revision Impact

Status: raw LostCity source report.

## Source

- Source ref: LostCityRS/Content / 376072662e78a314bf35bb18815be39521491a6b
- Source path: `.sources/lostcity-content`
- Generated at: 2026-07-09T00:00:00.000Z
- Generator version: raw-lostcity-runtime-catalog-2
- Generator command: `npm run data:generate -- --source-dir .sources/lostcity-content --output-root . --generated-at 2026-07-09T00:00:00.000Z --impact-outlier-limit 25`

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
- Calculation-impact suite: pass (10 pass, 0 needs-review, 0 failed)
- Informational all-monster scan: outliers-found (22 outliers, 22 shown)

## Snapshot Diff Summary

| Section | Added | Removed | Changed |
| --- | ---: | ---: | ---: |
| items | 15 | 0 | 371 |
| monsters | 0 | 0 | 63 |
| weapons | 0 | 0 | 17 |
| ammo | 0 | 0 | 10 |
| spells | 0 | 0 | 0 |
| requirements | 0 | 0 | 0 |
| equipment | 0 | 0 | 6 |
| drops | 66 | 51 | 1048 |

- items added: `2dose2antipoison`, `3dose2antipoison`, `adamant_javelin`, `black_dagger_p`, `black_mace`, `black_med_helm`, `black_robe`, `blackwizhat`, +7 more
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

- equipment added: none
- equipment removed: none
- equipment changed: `amulet.unholy_symbol`, `body.monk_robe_top`, `gloves.chaos_gauntlets`, `legs.monk_robe_bottom`, `ring.ring_of_recoil`, `ring.ring_of_wealth`

- drops added: `bandit.19`, `black_demon.21`, `black_dragon.20`, `black_knight.23`, `blue_dragon.21`, `chaos_druid.16`, `chaos_druid.8.0`, `chaos_druid.8.1`, +58 more
- drops removed: `bandit.19.0`, `black_demon.21.0`, `black_dragon.20.0`, `black_knight.23.0`, `blue_dragon.21.0`, `chaos_druid.16.0`, `chaos_druid.8`, `chaos_druid_warrior.19.0`, +43 more
- drops changed: `al_kharid_warrior.0`, `al_kharid_warrior.1`, `al_kharid_warrior.10`, `al_kharid_warrior.11`, `al_kharid_warrior.12`, `al_kharid_warrior.13`, `al_kharid_warrior.14`, `al_kharid_warrior.15`, +1040 more

## Calculation Impact

- Representative suite: pass
- Cases: 10 run, 10 pass, 0 needs-review, 0 failed
- Case filter: none
- Price set: Current prices.json + alch.json + generated item fallbacks
- Metrics: DPS, kills/hr, XP/hr, GP/hr and GP/XP deltas only.
- Accepted changed cases: 10; each accepted delta cites its owning decision in the case notes.

| Case | Tags | Status | DPS Δ | Kills/hr Δ | XP/hr Δ | GP/hr Δ | GP/XP Δ | Notes |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `raw_melee_giant` | `raw-source`, `melee`, `giant` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -8.57648 (-0.006908%) | -0.00018 (-0.006908%) | Accepted source-backed monster combat and core-loot delta under D-055. |
| `raw_ranged_giant` | `raw-source`, `ranged`, `giant` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -7.159877 (-0.007393%) | -0.00018 (-0.007393%) | Accepted source-backed monster combat and core-loot delta under D-055. |
| `raw_magic_giant` | `raw-source`, `magic`, `giant` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -1.157202 (+0.009605%) | -0.000108 (+0.009605%) | Accepted source-backed monster combat and core-loot delta under D-055. |
| `raw_melee_black_dragon` | `raw-source`, `melee`, `black_dragon` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -1384.33 (-1.994062%) | -0.165968 (-1.994062%) | Accepted source-backed monster combat and core-loot delta under D-055. |
| `raw_ranged_black_dragon` | `raw-source`, `ranged`, `black_dragon` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -1017.43 (-2.300681%) | -0.165968 (-2.300681%) | Accepted source-backed monster combat and core-loot delta under D-055. |
| `raw_magic_black_dragon` | `raw-source`, `magic`, `black_dragon` | pass | -0.225848 (-75.805749%) | -4.268003 (-75.805749%) | -2700.37 (-26.617975%) | -36203.2 (-194.058333%) | -4.19602 (-228.176258%) | Accepted source-backed monster combat and core-loot delta under D-055. |
| `raw_melee_dark_wizard_20` | `raw-source`, `melee`, `dark_wizard_20` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -9.215031 (-0.011755%) | -0.0002 (-0.011755%) | Accepted source-backed monster combat and core-loot delta under D-055. |
| `raw_ranged_dark_wizard_20` | `raw-source`, `ranged`, `dark_wizard_20` | pass | 0 (0%) | 0 (0%) | 0 (0%) | -7.976563 (-0.013065%) | -0.0002 (-0.013065%) | Accepted source-backed monster combat and core-loot delta under D-055. |
| `raw_magic_dark_wizard_20` | `raw-source`, `magic`, `dark_wizard_20` | pass | -0.040106 (-12.765378%) | -5.893132 (-12.765378%) | -497.498204 (-4.800924%) | -1325.79 (+7.196605%) | -0.224048 (+12.602568%) | Accepted source-backed monster combat and core-loot delta under D-055. |
| `raw_thrown_rune_knife_black_dragon` | `raw-source`, `ranged`, `thrown`, `high-tier` | pass | +0.18755 (+28.409091%) | +3.502876 (+28.409091%) | +3547.36 (+28.409091%) | +26863.98 (-2.450933%) | +21.095563 (-24.032585%) | Accepted source-backed thrown-weapon accuracy delta under D-057. |

### Informational All-Monster Scan

- Informational all-monster scan: outliers-found
- Baselines: `raw_melee`, `raw_ranged`, `raw_magic`
- Monsters scanned: 63
- Evaluations: 189
- Outliers: 22 found, 22 shown
- Outlier limit: 25
- Price set: Current prices.json + alch.json + generated item fallbacks
- Thresholds: DPS/kills/hr/XP/hr over 10%; GP/hr/GP/XP over 25%.
- This scan is informational and does not change representative merge-blocking status.

| Baseline | Monster | Kind | Reasons | DPS Δ | Kills/hr Δ | XP/hr Δ | GP/hr Δ | GP/XP Δ | Warnings |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Raw magic (magic) | `black_dragon` / Black Dragon | threshold-outlier | DPS changed -75.805749% over 10%; kills/hr changed -75.805749% over 10%; XP/hr changed -26.617975% over 10%; GP/hr changed -194.058333% over 25%; GP/XP changed -228.176258% over 25% | -0.225848 (-75.805749%) | -4.268003 (-75.805749%) | -2700.37 (-26.617975%) | -36203.2 (-194.058333%) | -4.19602 (-228.176258%) | 3 -> 3 |
| Raw magic (magic) | `dark_wizard_20` / Dark Wizard (lvl 20) | threshold-outlier | DPS changed -12.765378% over 10%; kills/hr changed -12.765378% over 10% | -0.040106 (-12.765378%) | -5.893132 (-12.765378%) | -497.498204 (-4.800924%) | -1325.79 (+7.196605%) | -0.224048 (+12.602568%) | 0 -> 0 |
| Raw magic (magic) | `deadly_red_spider` / Deadly red spider | threshold-outlier | kills/hr changed -42.880519% over 10% | -0.003421 (-1.085776%) | -23.722759 (-42.880519%) | +66.510614 (+0.65699%) | 0 (0%) | +0.018568 (-0.652702%) | 0 -> 0 |
| Raw magic (magic) | `druid` / Druid | threshold-outlier | DPS changed -13.897937% over 10%; kills/hr changed -13.897937% over 10%; GP/hr changed +26.269515% over 25%; GP/XP changed +33.19682% over 25% | -0.043783 (-13.897937%) | -5.167846 (-13.897937%) | -539.523085 (-5.200804%) | -2618.13 (+26.269515%) | -0.31893 (+33.19682%) | 0 -> 0 |
| Raw magic (magic) | `green_dragon` / Green Dragon | threshold-outlier | DPS changed -56.083869% over 10%; kills/hr changed -56.083869% over 10%; XP/hr changed -20.056058% over 10%; GP/hr changed -85.768804% over 25%; GP/XP changed -82.198531% over 25% | -0.171887 (-56.083869%) | -8.195934 (-56.083869%) | -2046.93 (-20.056058%) | -50973.95 (-85.768804%) | -4.786573 (-82.198531%) | 2 -> 2 |
| Raw magic (magic) | `jungle_spider` / Jungle spider | threshold-outlier | kills/hr changed -44.43244% over 10% | -0.004846 (-1.538183%) | -17.681306 (-44.43244%) | +21.790984 (+0.213751%) | 0 (0%) | +0.006026 (-0.213295%) | 0 -> 0 |
| Raw magic (magic) | `mountain_troll` / Mountain Troll | threshold-outlier | DPS changed -15.707564% over 10%; kills/hr changed -25.021646% over 10% | -0.049484 (-15.707564%) | -3.525162 (-25.021646%) | -635.69331 (-6.040705%) | -1550.52 (+7.063263%) | -0.290922 (+13.946431%) | 0 -> 0 |
| Raw magic (magic) | `poison_spider` / Poison spider | threshold-outlier | kills/hr changed -60.96592% over 10% | -0.003991 (-1.266739%) | -27.114774 (-60.96592%) | +75.555154 (+0.742691%) | 0 (0%) | +0.02087 (-0.737216%) | 0 -> 0 |
| Raw magic (magic) | `skeleton_unarmed` / Skeleton (unarmed) | threshold-outlier | kills/hr changed +40% over 10%; GP/hr changed -63.104329% over 25%; GP/XP changed -63.099406% over 25% | 0 (0%) | +18.516246 (+40%) | -1.383994 (-0.013342%) | +7051.12 (-63.104329%) | +0.679694 (-63.099406%) | 2 -> 2 |
| Raw magic (magic) | `tribesman` / Tribesman | threshold-outlier | kills/hr changed -22.78481% over 10%; GP/hr changed -6179.58% over 25%; GP/XP changed -6179.21% over 25% | 0 (0%) | -8.472364 (-22.78481%) | +0.633266 (+0.006104%) | -7838.14 (-6179.58%) | -0.755522 (-6179.21%) | 2 -> 2 |
| Raw melee (melee) | `deadly_red_spider` / Deadly red spider | threshold-outlier | kills/hr changed -42.09723% over 10% | -0.128974 (-5.138016%) | -161.880743 (-42.09723%) | +545.130459 (+1.329847%) | 0 | 0 | 0 -> 0 |
| Raw melee (melee) | `jungle_spider` / Jungle spider | threshold-outlier | kills/hr changed -44.01578% over 10% | -0.117998 (-4.91569%) | -120.750492 (-44.01578%) | -11.536936 (-0.028179%) | 0 | 0 | 0 -> 0 |
| Raw melee (melee) | `mountain_troll` / Mountain Troll | threshold-outlier | DPS changed +16.694716% over 10%; XP/hr changed +16.798062% over 10% | +0.340272 (+16.694716%) | +3.703033 (+4.213997%) | +6515.61 (+16.798062%) | +3212.81 (+7.52174%) | -0.08746 (-7.942188%) | 0 -> 0 |
| Raw melee (melee) | `poison_spider` / Poison spider | threshold-outlier | kills/hr changed -61.120102% over 10% | -0.177854 (-7.916031%) | -173.459316 (-61.120102%) | -176.776997 (-0.467461%) | 0 | 0 | 0 -> 0 |
| Raw melee (melee) | `skeleton_unarmed` / Skeleton (unarmed) | threshold-outlier | kills/hr changed +29.886468% over 10%; GP/hr changed +29.889757% over 25%; GP/XP changed +39.231788% over 25% | -0.082838 (-3.175542%) | +102.060627 (+29.886468%) | -3034.17 (-6.709697%) | +38866.27 (+29.889757%) | +1.12811 (+39.231788%) | 2 -> 2 |
| Raw melee (melee) | `tribesman` / Tribesman | threshold-outlier | kills/hr changed -22.965509% over 10%; GP/hr changed -27.267036% over 25%; GP/XP changed -26.910547% over 25% | -0.05797 (-2.269675%) | -63.033498 (-22.965509%) | -220.084128 (-0.487744%) | -58220.39 (-27.267036%) | -1.273393 (-26.910547%) | 2 -> 2 |
| Raw ranged (ranged) | `deadly_red_spider` / Deadly red spider | threshold-outlier | kills/hr changed -44.78012% over 10% | -0.152523 (-7.553234%) | -146.305438 (-44.78012%) | -1172.05 (-3.36521%) | 0 (0%) | -0.006799 (+3.4824%) | 0 -> 0 |
| Raw ranged (ranged) | `jungle_spider` / Jungle spider | threshold-outlier | kills/hr changed -46.380873% over 10% | -0.139542 (-7.385144%) | -104.29497 (-46.380873%) | -1426.78 (-4.251558%) | 0 (0%) | -0.008997 (+4.440342%) | 0 -> 0 |
| Raw ranged (ranged) | `mountain_troll` / Mountain Troll | threshold-outlier | DPS changed -59.251974% over 10%; kills/hr changed -63.669104% over 10%; XP/hr changed -59.28207% over 10%; GP/hr changed -80.020385% over 25%; GP/XP changed -50.931654% over 25% | -0.865754 (-59.251974%) | -40.718041 (-63.669104%) | -16734.54 (-59.28207%) | -19433.58 (-80.020385%) | -0.438177 (-50.931654%) | 0 -> 0 |
| Raw ranged (ranged) | `poison_spider` / Poison spider | threshold-outlier | DPS changed -10.142518% over 10%; kills/hr changed -63.039753% over 10% | -0.173211 (-10.142518%) | -142.22647 (-63.039753%) | -1617.92 (-5.381767%) | 0 (0%) | -0.012865 (+5.687875%) | 0 -> 0 |
| Raw ranged (ranged) | `skeleton_unarmed` / Skeleton (unarmed) | threshold-outlier | kills/hr changed +30.10878% over 10%; GP/hr changed +32.067244% over 25%; GP/XP changed +41.323997% over 25% | -0.097964 (-4.586895%) | +88.188625 (+30.10878%) | -2540.48 (-6.550022%) | +33583.58 (+32.067244%) | +1.115821 (+41.323997%) | 2 -> 2 |
| Raw ranged (ranged) | `tribesman` / Tribesman | threshold-outlier | kills/hr changed -22.798134% over 10%; GP/hr changed -28.174173% over 25%; GP/XP changed -27.978612% over 25% | -0.025961 (-1.253427%) | -52.710937 (-22.798134%) | -103.21031 (-0.271531%) | -48759.23 (-28.174173%) | -1.27388 (-27.978612%) | 2 -> 2 |

## Current Scope

- Runtime monster combat fields and reviewed core loot are parsed directly from pinned LostCity NPC config and RuneScript handlers.
- Runtime item, weapon, ammo, spell and equipment calculation fields are parsed directly from pinned LostCity object, param and dbrow configs.
- Simulator-only synthetic identities remain explicitly app-owned; quest-gated drops, clue tertiaries and generated requirement skill mapping remain outside the raw candidate.
- The root browser runtime consumes this committed source-backed generated snapshot; the legacy-derived static bridge remains reference and rollback evidence.
- Source object costs provide item/alch fallbacks; scheduled PriceSet values remain outside this generator and take precedence in the staged generated runtime adapter.
- The committed calculation-impact report and the focused direct-source impact commands remain separate evidence views over the same normalized domain contract.
- Generated item requirements are consumed by Planner/setup checks and gear quick action reason copy when the runtime snapshot supplies them; the active raw snapshot has no authoritative requirement map, so those consumers use the D-051 manual fallback.
- NPC-size, dragon halberd behavior and final special-case source truth are not decided here.
- Market prices and market price history are outside this game-data snapshot workflow.
- Historical generated snapshot archives are intentionally not committed.

## Open Questions

- Which authoritative source semantics should map object level requirements into attack, defence, ranged and magic requirement skills without relying on manual classification?
- When can the transitional legacy-derived runtime identity reference be replaced by an app-owned generated catalog manifest?
